import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { CHAPTER_IDS, CHAPTER_TITLES } from "../../src/content/wiki/chapters";
import { buildIndex, citedPageLinks } from "../../src/content/wiki/retrieve";
import { ID_RE, parseRawRef } from "../../src/content/wiki/schema";
import { type AgentRequest, type AgentResult, positiveInteger, type RunAgent, runBatch } from "./batch";
import { lintPages, splitProblems } from "./lint";
import { relevantPageIds } from "./navigation";
import { loadPages, parsePage } from "./pages";
import { prepareRawInput } from "./prepare-input";
import { readRawSnapshot, withRawSources } from "./raw";
import { RESTRICTED_PROFILE, restrictedArgs } from "./restricted-claude";
import { sanitizeRawInput } from "./sanitize";
import { unfence } from "./structured";
import { atomicText, digest, originSchema, type WorkflowStore, type WorkInput } from "./workflow";
import type { WorkflowPolicy } from "./workflow-policy";

/** 编译一份材料的超时：真实编译用过 99 秒与 144 秒（2026-09-16），补写与投喂共用这一个值 */
export const COMPILE_TIMEOUT_MS = 180_000;

export interface RawCompileInput {
  id: string;
  source: string;
  origin: WorkInput["origin"];
  rules: string;
  timeoutMs: number;
  purpose?: "answer-record";
  answerPages?: string[];
  context?: { why: string; sourceId: string };
}

/** Also used by CLI dry-run; performs no writes and starts no agent. */
export function planRawCompile(root: string, input: RawCompileInput) {
  if (!ID_RE.test(input.id) || !input.rules.trim()) throw new Error("编译目标或规则无效");
  originSchema.parse(input.origin);
  positiveInteger(input.timeoutMs, "timeoutMs");
  const prepared = prepareRawInput(join(root, "wiki"), input.source);
  const material = prepared.compilerData
    ? (JSON.parse(prepared.compilerData) as { lines?: { text: string }[] })
    : null;
  const inventory = loadPages(join(root, "wiki"));
  if (inventory.problems.length) throw new Error("现有页面无法解析，不能提供编译导航");
  const others = inventory.pages.filter((page) => page.fm.id !== input.id);
  // 问答记录只链回答用到的页；其余编译只列与材料相关的页：列全库时 104 页就占 10,660 字符（2026-09-23）
  const listed = input.answerPages
    ? others
        .filter((page) => input.answerPages!.includes(page.fm.id))
        .sort((a, b) => a.fm.id.localeCompare(b.fm.id))
    : relevantPageIds(buildIndex(inventory.pages.map((p) => ({ ...p.fm, text: p.body }))), {
        ids: [input.id],
        query: [
          input.id,
          input.context?.why.slice(0, 500),
          ...(material?.lines ?? []).map((l) => l.text),
        ].join("\n"),
      })
        .ids.filter((id) => id !== input.id)
        .map((id) => others.find((page) => page.fm.id === id)!);
  const navigation = {
    note: "仅用于章节归属、relations 和页面链接，不是正文事实来源。事实仍只能来自 material；不能凭标题推导邻居的实现。没有适合的关系时保留缺口，不编造关联。引用本地 raw 材料时，图节点使用材料里的真实类名或函数名；文件路径写在正文，避免把源码文件当作运行组件。pages 只列与本次材料相关的页，omitted 是没列出的页数；没列出不代表库里没有。",
    chapterIds: CHAPTER_IDS,
    chapterTitles: CHAPTER_TITLES,
    pages: listed.map((page) => {
      const title = sanitizeRawInput(page.fm.title);
      if (title.blocked) throw new Error("编译导航标题清洗阻塞");
      return { id: page.fm.id, title: title.text, file: page.file };
    }),
    omitted: others.length - listed.length,
  };
  const args = restrictedArgs(input.rules);
  const context = input.context
    ? Object.fromEntries(
        Object.entries(input.context).map(([key, value]) => {
          const clean = sanitizeRawInput(value);
          if (clean.blocked) throw new Error("编译上下文清洗阻塞");
          return [key, clean.text];
        }),
      )
    : undefined;
  const stdin = JSON.stringify({
    mode: "local-material",
    id: input.id,
    purpose: input.purpose,
    answerPages: input.answerPages,
    context,
    navigation,
    material,
  });
  if (stdin.length > 64_000)
    throw new Error("编译材料超过 64000 字符；请明确缩小来源行号范围，不截断证据、不启动模型");
  const work: WorkInput = {
    origin: input.origin,
    sources: [{ ref: input.source, hash: prepared.receipt.rawHash }],
    targets: [input.id],
    recipeHash: digest(
      JSON.stringify({ profile: RESTRICTED_PROFILE, args, stdin, screening: prepared.receipt }),
    ),
  };
  return { prepared, work, args, stdin };
}

const readOptional = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : undefined);

/** One archived source -> screened text -> validated draft. Never integrates. */
export async function compileRaw(
  store: WorkflowStore,
  input: RawCompileInput,
  policy: WorkflowPolicy,
  deps: { runAgent: RunAgent; retry?: boolean },
): Promise<AgentResult> {
  const plan = planRawCompile(store.root, input);
  const job = await store.enqueue(plan.work, policy, plan.prepared.receipt);
  const base: AgentResult = {
    id: input.id,
    jobId: job.id,
    ok: false,
    exitCode: 1,
    stderrTail: "",
    costUsd: 0,
  };
  if (job.state === "blocked") return { ...base, reason: "清洗阻塞；没有启动编译，需审查材料" };
  if (job.state === "integrated") return { ...base, ok: true, exitCode: 0, reason: "同证据任务已整合" };
  if (job.state === "draft") {
    if (!store.matchesDraft(job, input.id)) throw new Error("已记录草稿或来源发生变化");
    return { ...base, ok: true, exitCode: 0, reason: "复用已有草稿" };
  }
  const attempt = await store.claim(job.id, deps.retry);
  const wiki = join(store.root, "wiki");
  const draft = `_drafts/${input.id}.md`;
  let stage: string | undefined;
  let result = base;
  try {
    const before = readOptional(join(wiki, draft));
    stage = mkdtempSync(join(tmpdir(), "wiki-compile-"));
    const request: AgentRequest = {
      id: input.id,
      cwd: stage,
      args: [...plan.args, "--max-budget-usd", String(attempt.reservedUsd)],
      stdin: plan.stdin,
      timeoutMs: input.timeoutMs,
      allowedWrites: [],
    };
    const batch = await runBatch([request], { concurrency: 1, runAgent: deps.runAgent });
    result = { ...batch.results[0]!, jobId: job.id };
    mkdirSync(join(wiki, "_jobs/compilations"), { recursive: true });
    atomicText(
      join(wiki, `_jobs/compilations/${job.id}.${attempt.token}.output.json`),
      JSON.stringify(result),
    );
    if (!result.ok) throw new Error(result.reason ?? "编译失败");
    if (readdirSync(stage).length) throw new Error("无工具编译产生了文件，拒绝发布");
    if (!result.output || Buffer.byteLength(result.output, "utf8") > 128 * 1024)
      throw new Error("缺少 Markdown 结果或结果过大");
    // 模型偶尔把整页包进一层 ```markdown 围栏（2026-09-23 真实重编）；剥掉包装再按页面 schema 验
    const output = unfence(result.output);
    const parsed = parsePage(draft, output);
    if (!parsed.page || parsed.problems.length) throw new Error("编译草稿 schema 无效");
    if (
      input.purpose === "answer-record" &&
      (parsed.page.fm.type !== "source" || parsed.page.fm.evidence !== "I")
    )
      throw new Error("问答记录必须为 source / I，不能把模型回答升格为一手证据");
    if (parsed.page.fm.sources.some((s) => s !== input.source)) throw new Error("草稿引用了未提供的来源");
    if (input.purpose === "answer-record") {
      const known = new Set(input.answerPages ?? []);
      const links = citedPageLinks(parsed.page.body).map((href) =>
        href.split("/").at(-1)!.replace(/\.md$/, ""),
      );
      const targets = [...links, ...parsed.page.fm.related, ...parsed.page.fm.relations.map((r) => r.to)];
      if (!targets.length || targets.some((id) => !known.has(id)))
        throw new Error("问答草稿必须关联已提供的页面，不能引用未知页面");
    }
    // 2026-09-25 起不再规定开头必须是「## 一句话」；准入只挡掉连一个小节都没有的输出
    if (!/^##\s+\S/m.test(parsed.page.body)) throw new Error("草稿正文没有任何 ## 小节");
    const loaded = loadPages(wiki);
    const issues = splitProblems(
      lintPages([...loaded.pages.filter((p) => p.fm.id !== input.id), parsed.page], {
        chapterIds: CHAPTER_IDS,
        existsFile: (p) => existsSync(join(wiki, p)),
      }),
    ).errors;
    if (loaded.problems.length || issues.length)
      throw new Error(`草稿 lint 失败：${JSON.stringify([...loaded.problems, ...issues])}`);
    const path = parseRawRef(input.source)!.path;
    const text = withRawSources(output, [path], input.origin);
    const finished = await store.finish(
      job.id,
      attempt.token,
      {
        ok: true,
        costUsd: result.costUsd,
        artifacts: { [draft]: digest(text), [path]: plan.prepared.receipt.rawHash },
      },
      () => {
        if (
          digest(readRawSnapshot(wiki, path)) !== plan.prepared.receipt.rawHash ||
          readOptional(join(wiki, draft)) !== before
        )
          throw new Error("编译期间来源或草稿发生变化");
        mkdirSync(join(wiki, "_drafts"), { recursive: true });
        atomicText(join(wiki, draft), text);
      },
    );
    return {
      ...result,
      output: undefined,
      ok: finished.state === "draft",
      reason: finished.attempts.at(-1)?.reason,
    };
  } catch (error) {
    const reason = String(error);
    await store.finish(job.id, attempt.token, { ok: false, costUsd: result.costUsd, reason });
    return { ...result, output: undefined, ok: false, reason };
  } finally {
    try {
      if (stage && existsSync(stage)) {
        const within = relative(realpathSync(tmpdir()), realpathSync(stage));
        if (
          !within.startsWith("wiki-compile-") ||
          within.includes("..") ||
          lstatSync(stage).isSymbolicLink() ||
          resolve(stage) === resolve(tmpdir())
        )
          console.warn("编译临时目录位置异常，保留现场");
        else rmSync(stage, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`编译临时目录清理失败，保留现场：${String(error)}`);
    }
  }
}
