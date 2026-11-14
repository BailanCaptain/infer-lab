import type { RunAgent } from "../../scripts/wiki/batch";

export const dropBrowserAgent: RunAgent = async (req) => {
  const p = JSON.parse(req.stdin);
  let value: unknown;
  if (p.mode === "drop-extract" || p.mode === "drop-read")
    value = {
      summary: "缓存规则",
      quotes: [p.materials[0].text],
      conditions: [],
      topics: [{ name: "缓存规则", query: "缓存" }],
    };
  else if (p.mode === "drop-discover")
    value = {
      read: [],
      fetch: [],
      search: [],
      pages: [
        {
          path: "sources/drop-cache.md",
          reason: "补充缓存规则",
          toc: { part: "references", section: "公开资料" },
          evidence: [p.notes[0].ref],
          comparisons: [],
        },
      ],
      question: "",
      report: "新增缓存规则及图示，来源已保存。",
      done: true,
      outcome: { kind: "integrate", reason: "新增缓存规则", comparisons: [] },
    };
  else if (p.mode === "drop-generate")
    value = {
      text: `---\nid: drop-cache\ntitle: 新缓存规则\ntype: source\nsummary: 每组包含两个单元\nsources: [${p.notes[0].ref}]\nevidence: I\nupdated: '2026-10-06'\n---\n每组包含两个单元。\n\n\`\`\`wiki-diagram\nfile: drop-cache-figure\n\`\`\`\n`,
      revision: null,
      diagrams: [
        {
          id: "drop-cache-figure",
          yaml: "layout: figure\nid: drop-cache-figure\ncaption: 两个单元\nsize: [400, 160]\nitems:\n  - at: [40, 40]\n    size: [140, 60]\n    text: 两个单元\n    tone: kv\n",
        },
      ],
    };
  else value = { issues: [], contradictions: [], report: "已核对图文数量一致" };
  if (p.mode === "drop-generate")
    (value as { text: string }).text += "\n```calc\ntitle: 单元容量\n数据量 = 2 × 1 B = 2 B\n```\n";
  return { id: req.id, ok: true, exitCode: 0, costUsd: 0, stderrTail: "", output: JSON.stringify(value) };
};
