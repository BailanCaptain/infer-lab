import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sourceLines } from "./audit";
import { gitText } from "./git";
import { parseSeeds } from "./ingest";
import { loadPages } from "./pages";
import { saveRawSnapshot } from "./raw";
import { localFile } from "./review-files";

/** Bounded local source discovery. Records selected line ranges; never pretends to have read whole files. */
export function findGapSources(root: string, question: string, seedsPath = "wiki/seeds/vllm-ascend.yaml") {
  const file = localFile(root, seedsPath);
  if (!existsSync(file)) return [];
  const stop = new Set([
    "main",
    "config",
    "configuration",
    "what",
    "does",
    "this",
    "that",
    "with",
    "true",
    "false",
    "vllm",
    "ascend",
  ]);
  // Existing titles/aliases are locators only; their prose is never used as new evidence.
  const topics = loadPages(join(root, "wiki")).pages.filter((p) =>
    [p.fm.title, ...p.fm.aliases, p.fm.id].some((label) =>
      question.toLowerCase().includes(label.toLowerCase()),
    ),
  );
  const expanded = `${question} ${topics.map((p) => p.fm.id.replace(/-/g, "_")).join(" ")}`;
  const terms = [...new Set(expanded.toLowerCase().match(/[a-z_][a-z0-9_]{3,}/g) ?? [])]
    .filter((t) => !stop.has(t))
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);
  if (!terms.length) return [];
  const seeds = parseSeeds(readFileSync(file, "utf8"));
  const versions = [...new Set(question.match(/v\d+\.\d+\.\d+(?:rc\d*)?/g) ?? [])];
  if (versions.length > 1) return []; // Cross-version comparisons need an explicitly selected source packet.
  const sources: string[] = [];
  for (const [name, repo] of Object.entries(seeds.repos)) {
    const ref = versions.length
      ? Object.keys(repo.refs).find((r) => r === versions[0] || r === `releases/${versions[0]}`)
      : "main";
    const pin = ref ? repo.refs[ref] : undefined;
    if (!pin) continue;
    const dir = resolve(root, repo.path);
    // 先按最具体（最长）的词找文件，再依次放宽：2026-09-23 真实缺口里 hccl_buffer_size 只在 utils.py 出现，
    // 而按路径字母序先到的是三份只含泛词 hccl 的 docs，三个名额被它们占满，补料判定只能答「未判明」
    const paths = [
      ...new Set(
        terms.flatMap((term) =>
          gitText(
            dir,
            ["grep", "-l", "-i", "--fixed-strings", "-e", term, pin, "--", "vllm_ascend/", "docs/source/"],
            true,
          )
            .split(/\r?\n/)
            .filter(Boolean)
            .map((p) => p.slice(p.indexOf(":") + 1))
            .filter((p) => /\.(py|md|rst)$/.test(p))
            .sort(),
        ),
      ),
    ];
    for (const path of paths) {
      if (sources.length >= 3) return sources;
      const text = gitText(dir, ["show", `${pin}:${path}`]);
      const lines = sourceLines(text);
      const picked = new Set<number>();
      for (let i = 0; i < lines.length && picked.size < 100; i++)
        if (terms.some((t) => lines[i]!.toLowerCase().includes(t)))
          for (
            let line = Math.max(0, i - 8);
            line <= Math.min(lines.length - 1, i + 8) && picked.size < 100;
            line++
          )
            picked.add(line);
      if (!picked.size) continue;
      const excerpt = [
        `来源：${name}@${pin}:${path}`,
        `选择范围：最多 100 行上下文；全文 ${lines.length} 行，未提供完整文件。`,
        ...[...picked]
          .sort((a, b) => a - b)
          .map((line) => `${name}@${pin}:${path}#L${line + 1}\n${lines[line]}`),
      ].join("\n");
      if (excerpt.length > 20_000) continue;
      const raw = saveRawSnapshot(join(root, "wiki"), excerpt);
      sources.push(`raw:${raw.slice(4)}#L1-L${sourceLines(excerpt).length}`);
    }
  }
  return sources;
}
