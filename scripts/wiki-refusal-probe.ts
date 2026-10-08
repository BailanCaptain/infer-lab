/**
 * 哪一页让 Opus 5.5 拒答（安全分类器拦截，CLI 换 Opus 5 接手，见 wiki/model-use.ts）。
 *
 * history（不花钱）：扫本机 CLI 会话记录里问答快照的 model_refusal_fallback，
 *   报每次被拦的是哪条消息、那之前模型读过哪些页。拒答事件的 refusedUserMessageUuid 指向被拦的那条。
 * probe（付费，每次调用记进共享预算账本，purpose 带页面路径）：把页面逐页单独交给 Opus 5.5
 *   （受限启动器：无工具、固定 WORK_MODEL），看哪页触发拒答。默认对象是全部知识页，
 *   另加 HANDBOOK.md 与 index.md——2026-09-23 下午以前它们整份在问答系统提示词里。
 *
 *   pnpm wiki:refusal-probe history
 *   pnpm wiki:refusal-probe probe --dry-run                 只列对象和字数，不调模型
 *   pnpm wiki:refusal-probe probe --limit 3                 先试前三页
 *   pnpm wiki:refusal-probe probe wiki/concepts/block-table.md
 *   pnpm wiki:refusal-probe probe --split 3 wiki/HANDBOOK.md   按 ##/### 切开逐节探
 *   pnpm wiki:refusal-probe bisect wiki/HANDBOOK.md             整份被拦、单节不拦时，二分从头累积到哪一节开始被拦
 *   pnpm wiki:refusal-probe minimize --range 1-13 wiki/HANDBOOK.md 缩到「合起来就被拦」的最小几段
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import type { AgentRequest } from "./wiki/batch";
import { PAGE_DIRS } from "./wiki/pages";
import { restrictedArgs } from "./wiki/restricted-claude";
import { selectedAgent } from "./wiki/selected-agent";

const root = process.cwd();
const rel = (p: string) => relative(root, p).replace(/\\/g, "/");

type Block = {
  type: string;
  id?: string;
  name?: string;
  input?: Record<string, string | undefined>;
  tool_use_id?: string;
};
/** 会话记录的一行；拒答事件的字段在记录文件里是 camelCase（stdout 上才是 snake_case） */
interface Row {
  type?: string;
  subtype?: string;
  uuid?: string;
  timestamp?: string;
  message?: { content?: string | Block[] };
  requestId?: string;
  refusedUserMessageUuid?: string;
  originalModel?: string;
  fallbackModel?: string;
  apiRefusalCategory?: string;
}

function history(): void {
  const projects = join(homedir(), ".claude", "projects");
  // CLI 按 cwd 把非字母数字换成 - 作目录名；问答快照在 <wiki>/tools/wiki-runtime/knowledge/object-*
  const prefix = root.replace(/[^a-zA-Z0-9]/g, "-");
  const seen = new Set<string>();
  let total = 0;
  const onQuestion: string[] = [];
  const onToolResult: string[] = [];
  for (const dir of readdirSync(projects).filter((d) => d.startsWith(prefix))) {
    for (const file of readdirSync(join(projects, dir)).filter((f) => f.endsWith(".jsonl"))) {
      const rows: Row[] = readFileSync(join(projects, dir, file), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l));
      const blocks = (r: Row | undefined): Block[] =>
        Array.isArray(r?.message?.content) ? r.message.content : [];
      const toolUses = new Map(
        rows.flatMap((r) =>
          blocks(r)
            .filter((b) => b.type === "tool_use")
            .map((b) => [b.id, b] as const),
        ),
      );
      for (const refusal of rows.filter((r) => r.subtype === "model_refusal_fallback")) {
        // --resume --fork-session 会把旧会话连同旧的拒答事件一起抄进新文件，按 requestId 去重
        const key = refusal.requestId ?? refusal.uuid ?? `${file}:${refusal.timestamp}`;
        if (seen.has(key)) continue;
        seen.add(key);
        total++;
        const at = rows.findIndex((r) => r.uuid === refusal.refusedUserMessageUuid);
        const target = at < 0 ? undefined : rows[at];
        const upTo = at < 0 ? rows.indexOf(refusal) : at + 1;
        const read = rows
          .slice(0, upTo)
          .flatMap(blocks)
          .filter((b) => b.type === "tool_use" && b.name === "Read")
          .map((b) => b.input?.file_path?.replace(/\\/g, "/").replace(/^.*\/object-[^/]+\//, "") ?? "?");
        // 字符串消息里还有 CLI 注入的「被安全分类器拦下」提示，只认问答服务发的提问
        const question = rows
          .slice(0, upTo)
          .map((r) => r.message?.content)
          .filter((c): c is string => typeof c === "string" && c.startsWith("学习者的问题："))
          .at(-1)
          ?.split("\n")[0]
          ?.replace(/^学习者的问题：/, "")
          .slice(0, 60);
        let what: string;
        if (!target) what = "记录里找不到被拦消息";
        else if (typeof target.message?.content === "string") {
          what = "提问那条消息";
          onQuestion.push(key);
        } else {
          const results = blocks(target).filter((b) => b.type === "tool_result");
          const names = results.map((b) => {
            const use = toolUses.get(b.tool_use_id);
            return `${use?.name}(${use?.input?.file_path ?? use?.input?.pattern ?? use?.input?.url ?? ""})`;
          });
          what = `工具结果 ${names.join("、") || "?"}`;
          onToolResult.push(...names);
        }
        console.log(
          `${refusal.timestamp}  [${refusal.apiRefusalCategory ?? "?"}]  ${refusal.originalModel} → ${refusal.fallbackModel}`,
        );
        console.log(`  问题：${question ?? "?"}`);
        console.log(`  被拦：${what}`);
        console.log(`  此前已读页：${read.length ? [...new Set(read)].join("、") : "无"}`);
        console.log(`  记录：${dir}/${file}\n`);
      }
    }
  }
  console.log(
    `共 ${total} 次拒答（按 requestId 去重）：拦在提问上 ${onQuestion.length} 次，拦在工具结果上 ${onToolResult.length} 次` +
      (onToolResult.length ? `（${onToolResult.join("、")}）` : ""),
  );
}

const RULES =
  "你在读一个中文技术知识库（vLLM / vLLM-Ascend 大模型推理部署）的一页。用两三句话说这页讲什么，不要复述原文。";

function defaultTargets(): string[] {
  const wiki = join(root, "wiki");
  const dirs = [...PAGE_DIRS, "warnings"].map((d) => join(wiki, d)).filter((d) => existsSync(d));
  const pages = dirs.flatMap((d) =>
    readdirSync(d)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => join(d, f)),
  );
  return [join(wiki, "HANDBOOK.md"), join(wiki, "index.md"), ...pages];
}

/** 探测对象：整页，或按标题切开的一节。label 是 页面路径 或 页面路径#标题 */
interface Piece {
  label: string;
  text: string;
}

/** level 为 2 时按 `## ` 切，为 3 时 `## ` 与 `### ` 都切；标题前的开头（frontmatter 等）单独算一段 */
function split(page: string, text: string, level?: number): Piece[] {
  if (!level) return [{ label: page, text }];
  const heading = new RegExp(`^(?=#{2,${level}} )`, "m");
  return text.split(heading).map((part) => {
    const title = /^#+ (.+)/.exec(part)?.[1]?.trim();
    return { label: `${page}#${title ?? "(开头)"}`, text: part };
  });
}

type Verdict = { kind: "passed" | "refused" | "failed"; costUsd: number; line: string };

async function probeOnce({ label, text }: Piece, budget: number): Promise<Verdict> {
  const req: AgentRequest = {
    id: `refusal-probe:${label}`,
    cwd: root,
    args: restrictedArgs(RULES, budget),
    stdin: `页面 ${label} 全文如下：\n\n${text}`,
    timeoutMs: 300_000,
    allowedWrites: [],
  };
  const r = await selectedAgent(root, `refusal-probe:${label}`)(req);
  const costUsd = r.costUsd ?? 0;
  const refusal = r.models?.switches.find((s) => s.event === "model_refusal_fallback");
  const [kind, verdict]: [Verdict["kind"], string] = refusal
    ? ["refused", `拒答 [${refusal.reason ?? "?"}] ${refusal.from} → ${refusal.to}`]
    : !r.ok
      ? ["failed", `失败 ${r.reason}`]
      : ["passed", `通过（作答 ${r.models?.answered.join("、") ?? "?"}）`];
  const line = `${verdict.padEnd(44)} $${costUsd.toFixed(4)}  ${label}`;
  console.log(line);
  return { kind, costUsd, line };
}

async function probe(pieces: Piece[], opts: { dryRun: boolean; budget: number; jobs: number }) {
  if (opts.dryRun) {
    for (const p of pieces) console.log(`${String(p.text.length).padStart(7)}  ${p.label}`);
    console.log(
      `共 ${pieces.length} 个对象，${pieces.reduce((s, p) => s + p.text.length, 0)} 字符；每次调用上限 $${opts.budget}`,
    );
    return;
  }
  const refused: string[] = [];
  const failed: string[] = [];
  let cost = 0;
  let next = 0;
  const worker = async () => {
    while (next < pieces.length) {
      const piece = pieces[next++]!;
      const v = await probeOnce(piece, opts.budget);
      cost += v.costUsd;
      if (v.kind === "refused") refused.push(piece.label);
      if (v.kind === "failed") failed.push(piece.label);
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.jobs, pieces.length) }, worker));
  console.log(
    `\n共 ${pieces.length} 个对象，花费 $${cost.toFixed(4)}；拒答 ${refused.length}${refused.length ? `：${refused.join("、")}` : ""}` +
      (failed.length ? `；失败 ${failed.length}：${failed.join("、")}` : ""),
  );
}

/**
 * 整份被拦、单节都不被拦时，找「从头累积到哪一节开始被拦」：把前 k 节拼起来探，对 k 二分。
 * 前提是内容越多越容易被拦（单调）；分类器可能有随机性，所以先确认整份被拦，找到边界后两端各复测一次。
 */
async function bisect(page: string, pieces: Piece[], budget: number) {
  const head = (k: number): Piece => ({
    label: `${page}#前${k}段（止于「${pieces[k - 1]!.label.split("#").at(-1)}」）`,
    text: pieces
      .slice(0, k)
      .map((p) => p.text)
      .join(""),
  });
  let cost = 0;
  const run = async (k: number) => {
    const v = await probeOnce(head(k), budget);
    cost += v.costUsd;
    if (v.kind === "failed") throw new Error(`调用失败，二分中止：${v.line}`);
    return v.kind === "refused";
  };
  let lo = 0;
  let hi = pieces.length;
  if (!(await run(hi))) {
    console.log(`\n整份这次没被拦，无从二分；花费 $${cost.toFixed(4)}`);
    return;
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (await run(mid)) hi = mid;
    else lo = mid;
  }
  console.log("\n边界复测：");
  const hiAgain = await run(hi);
  const loAgain = lo > 0 ? !(await run(lo)) : true;
  console.log(
    `\n前 ${lo} 段通过，加上第 ${hi} 段「${pieces[hi - 1]!.label.split("#").at(-1)}」后被拦` +
      `（复测：前 ${hi} 段${hiAgain ? "仍被拦" : "这次通过"}，前 ${lo} 段${loAgain ? "仍通过" : "这次被拦"}）；花费 $${cost.toFixed(4)}`,
  );
}

/**
 * 找一组「合起来就被拦」的最小内容（delta debugging 的 ddmin，只做补集测试）：先在节一级缩，
 * 再把剩下的节拆成段落（空行分隔）继续缩。结果是 1-最小：去掉其中任何一段都不再被拦；
 * 但不一定唯一——同一页里可能还有别的组合也会被拦。前提是同一内容判定稳定（09-23 的复测都一致），
 * 所以最后再复测一次最小组合。
 */
async function minimize(page: string, pieces: Piece[], budget: number) {
  let cost = 0;
  let calls = 0;
  const refuses = async (units: Piece[], stage: string) => {
    const chars = units.reduce((s, u) => s + u.text.length, 0);
    const v = await probeOnce(
      {
        label: `${page}#${stage}（${units.length} 个单元，${chars} 字）`,
        text: units.map((u) => u.text).join("\n\n"),
      },
      budget,
    );
    cost += v.costUsd;
    calls++;
    if (v.kind === "failed") throw new Error(`调用失败，中止：${v.line}`);
    return v.kind === "refused";
  };
  const ddmin = async (start: Piece[], stage: string) => {
    let units = start;
    let n = 2;
    while (units.length >= 2) {
      const size = Math.ceil(units.length / n);
      let reduced = false;
      for (let i = 0; i < units.length; i += size) {
        const rest = [...units.slice(0, i), ...units.slice(i + size)];
        if (await refuses(rest, stage)) {
          units = rest;
          n = Math.max(n - 1, 2);
          reduced = true;
          break;
        }
      }
      if (!reduced) {
        if (n >= units.length) break;
        n = Math.min(n * 2, units.length);
      }
    }
    return units;
  };
  // 节一级单元少、每次都是大文本，逐个试删只要「节数」次调用；ddmin 在这里反而多花（13 节要 20 多次）
  const oneByOne = async (start: Piece[], stage: string) => {
    let units = start;
    for (const u of start) {
      if (units.length < 2) break;
      const rest = units.filter((x) => x !== u);
      if (await refuses(rest, stage)) units = rest;
    }
    return units;
  };
  const title = (p: Piece) => p.label.split("#").at(-1)!;
  if (!(await refuses(pieces, "起点"))) {
    console.log(`\n起点这次没被拦，无从缩小；花费 $${cost.toFixed(4)}`);
    return;
  }
  const sections = await oneByOne(pieces, "节");
  console.log(`\n节一级剩下 ${sections.length} 节：${sections.map(title).join("、")}\n`);
  const paragraphs = sections.flatMap((s) =>
    s.text
      .split(/\n\s*\n/)
      .filter((t) => t.trim())
      .map((text, i) => ({ label: `${page}#${title(s)} ¶${i + 1}`, text })),
  );
  const minimal = await ddmin(paragraphs, "段落");
  console.log("\n复测最小组合：");
  const again = await refuses(minimal, "最小组合复测");
  console.log(
    `\n最小组合 ${minimal.length} 段（复测${again ? "仍被拦" : "这次通过，结论不稳"}）；${calls} 次调用，花费 $${cost.toFixed(4)}\n`,
  );
  for (const p of minimal) console.log(`---- ${title(p)}\n${p.text}\n`);
}

try {
  const command = process.argv[2];
  const { values, positionals } = parseArgs({
    args: process.argv.slice(3),
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean" },
      limit: { type: "string" },
      split: { type: "string" },
      range: { type: "string" },
      budget: { type: "string", default: "0.5" },
      jobs: { type: "string", default: "1" },
    },
  });
  if (command === "history") history();
  else if (command === "bisect") {
    const level = Number(values.split ?? "3");
    if ((level !== 2 && level !== 3) || positionals.length !== 1)
      throw new Error("用法：bisect [--split 2|3] <一个页面>");
    const file = join(root, positionals[0]!);
    await bisect(rel(file), split(rel(file), readFileSync(file, "utf8"), level), Number(values.budget));
  } else if (command === "minimize") {
    const level = Number(values.split ?? "3");
    if ((level !== 2 && level !== 3) || positionals.length !== 1)
      throw new Error("用法：minimize [--split 2|3] [--range 起-止] <一个页面>");
    const file = join(root, positionals[0]!);
    let pieces = split(rel(file), readFileSync(file, "utf8"), level);
    if (values.range) {
      // 1 起算、含两端，编号与 probe --dry-run --split 列出的顺序一致
      const [from, to] = values.range.split("-").map(Number);
      if (!from || !to || from > to || to > pieces.length) throw new Error(`--range 超出 1-${pieces.length}`);
      pieces = pieces.slice(from - 1, to);
    }
    await minimize(rel(file), pieces, Number(values.budget));
  } else if (command === "probe") {
    const budget = Number(values.budget);
    const jobs = Number(values.jobs);
    const level = values.split === undefined ? undefined : Number(values.split);
    if (!(budget > 0) || !Number.isInteger(jobs) || jobs < 1)
      throw new Error("--budget 要正数，--jobs 要正整数");
    if (level !== undefined && level !== 2 && level !== 3) throw new Error("--split 只接受 2 或 3");
    const files = positionals.length ? positionals.map((f) => join(root, f)) : defaultTargets();
    const pieces = files.flatMap((f) => split(rel(f), readFileSync(f, "utf8"), level));
    await probe(values.limit ? pieces.slice(0, Number(values.limit)) : pieces, {
      dryRun: !!values["dry-run"],
      budget,
      jobs,
    });
  } else
    throw new Error(
      "用法：wiki:refusal-probe history | probe [--dry-run] [--split 2|3] [--limit N] [--budget USD] [--jobs N] [页面…] | bisect [--split 2|3] <页面> | minimize [--split 2|3] [--range 起-止] <页面>",
    );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
