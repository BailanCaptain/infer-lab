/**
 * pnpm wiki:cite-screen [--apply] [--out <file>]
 *
 * 引用的机械预筛。`wiki:audit` 只查「行号在文件范围内」，查不出「这几行并不支持这句话」。
 * 这里对每个只带一个编号标记（[C3] / [S1]）的句子，取出句中反引号里的代码标识符，看它是否
 * 出现在所引的那几行里：
 *   - 就在所引范围附近（同一个函数 / 同一张表）→ 范围太窄。`--apply` 会把范围放宽到盖住它
 *     （最多往外 40 行、总长不超过 120 行）；不加 `--apply` 只报数，不改文件；
 *   - 离得远，或整个文件里都没有 → 列进清单，需要人打开源码判断。
 * 清单里误报很多（句子顺带提到的上下文标识符、引用本来就是为了证明「不存在」、文档里的
 * 配置键）：2026-09-20 第一次跑，91 条里 81 条是误报、10 条是真问题；另有 48 条范围太窄。
 * 所以它是「派人核对之前先缩小范围」的工具，不是能挂进 CI 的闸。它也只看标识符——数字错、
 * 行为说反这类问题它看不见。
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
import { configuredRepoRoots } from "./wiki/repo-roots";

/** 仓库名 → 本地路径，与 wiki:lint / wiki:audit 同一个来源（wiki/seeds/ 下全部 seeds） */
const REPO = configuredRepoRoots(process.cwd());
const NEAR = 40;
const MAX_LEN = 120;
const SOURCE_RE = /^([\w-]+)@([a-f0-9]+):([^#]+)#L(\d+)(?:-L(\d+))?$/;

const cache = new Map<string, string[] | null>();
function show(repo: string, commit: string, path: string): string[] | null {
  const key = `${repo}@${commit}:${path}`;
  if (!cache.has(key)) {
    const dir = REPO[repo];
    let lines: string[] | null = null;
    if (dir) {
      try {
        lines = execFileSync("git", ["-C", dir, "show", `${commit}:${path}`], {
          encoding: "utf8",
          maxBuffer: 1 << 28,
          stdio: ["ignore", "pipe", "ignore"],
        }).split("\n");
      } catch {
        lines = null;
      }
    }
    cache.set(key, lines);
  }
  return cache.get(key) ?? null;
}

const apply = process.argv.includes("--apply");
const outFile = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : undefined;
const far: string[] = [];
const absent: string[] = [];
let widened = 0;
let pagesTouched = 0;

for (const name of readdirSync("wiki/concepts")
  .filter((n) => n.endsWith(".md"))
  .sort()) {
  const id = name.slice(0, -3);
  const path = `wiki/concepts/${name}`;
  const raw = readFileSync(path, "utf8");
  const text = raw.replace(/\r\n/g, "\n");
  const end = text.indexOf("\n---", 4);
  const sources: string[] = parse(text.slice(4, end)).sources ?? [];
  // 代码块里的反引号不是正文论断
  const body = text.slice(end + 4).replace(/^(`{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
  const want = new Map<number, [number, number]>();

  body.split("\n").forEach((line, li) => {
    for (const sentence of line.split(/(?<=[。；])/)) {
      const marks = [...sentence.matchAll(/\[([CS])(\d+)\]/g)];
      // 一句多个标记时分不清哪个标识符归哪条来源，不判
      if (marks.length !== 1) continue;
      const mark = marks[0];
      if (!mark) continue;
      const n = Number(mark[2]);
      const parsed = SOURCE_RE.exec(sources[n - 1] ?? "");
      if (!parsed) continue;
      const [, repo = "", commit = "", file = "", from = "1", to] = parsed;
      const lines = show(repo, commit, file);
      if (!lines) continue;
      const a = Number(from);
      const b = Number(to ?? from);
      const idents = [...sentence.matchAll(/`([A-Za-z_][A-Za-z0-9_.]{3,})`/g)]
        .map((m) => (m[1] ?? "").split(".").pop() ?? "")
        .filter((x) => x && !/^(True|False|None)$/.test(x));
      const where = `${id} L${li + 1} ${mark[0]}`;
      const quote = `\n    句：${sentence.trim().slice(0, 120)}`;
      for (const ident of idents) {
        const [ca, cb] = want.get(n) ?? [a, b];
        const cited = lines.slice(ca - 1, cb).join("\n");
        if (cited.includes(ident)) continue;
        const hits = lines.flatMap((l, i) => (l.includes(ident) ? [i + 1] : []));
        if (hits.length === 0) {
          absent.push(`${where} \`${ident}\` 不在 ${file}（${repo}@${commit}）${quote}`);
          continue;
        }
        const near = hits.filter((h) => h >= ca - NEAR && h <= cb + NEAR);
        const na = Math.min(ca, ...near);
        const nb = Math.max(cb, ...near);
        if (near.length === 0 || nb - na + 1 > MAX_LEN) {
          const gap = (h: number) => Math.min(Math.abs(h - a), Math.abs(h - b));
          const closest = hits.reduce((x, y) => (gap(y) < gap(x) ? y : x));
          far.push(`${where} \`${ident}\` 引 ${file}#L${a}-L${b}，最近出现在第 ${closest} 行${quote}`);
          continue;
        }
        want.set(n, [na, nb]);
      }
    }
  });

  let head = text.slice(0, end);
  for (const [n, [na, nb]] of want) {
    const old = sources[n - 1];
    if (!old) continue;
    const next = old.replace(/#L\d+(?:-L\d+)?$/, `#L${na}-L${nb}`);
    // 同一条来源在 frontmatter 里出现不止一次就不动，免得改错位置
    if (old === next || head.split(old).length !== 2) continue;
    head = head.replace(old, next);
    widened++;
  }
  if (apply && head !== text.slice(0, end)) {
    const eol = raw.includes("\r\n") ? "\r\n" : "\n";
    writeFileSync(path, (head + text.slice(end)).replace(/\n/g, eol));
    pagesTouched++;
  }
}

const report = [
  `# 离得远或放宽后太长（${far.length}）`,
  ...far,
  "",
  `# 标识符不在所引文件里（${absent.length}）`,
  ...absent,
  "",
].join("\n");
if (outFile) writeFileSync(outFile, report);
else if (!apply) console.log(report);
const applied = apply ? `，已改 ${pagesTouched} 页` : "（未应用，加 --apply 才改）";
console.log(`可就近放宽的来源 ${widened} 条${applied}；离得远 ${far.length}；不在所引文件 ${absent.length}`);
