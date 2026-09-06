# LLM Wiki Implementation Plan

**Feature:** F001 — `docs/features/F001-llm-wiki.md`
**Goal:** 让课程拥有一个由 agent 写、人只审、进 git 累积、互相链接的知识库，学习者在 `#/wiki` 右侧问名词就有基于知识库的回答。
**Acceptance Criteria:**（照抄 feature doc，本计划全覆盖）
- AC1 · 骨架与派生：`wiki/HANDBOOK.md` 六个 H2 切片可被程序切出；`pnpm wiki:build` 从 frontmatter 派生 `index.md` 与 `registry.json`，重复运行 `git diff` 为空。
- AC2 · Lint 把关：`pnpm wiki:lint` 拒收空 sources、非法 frontmatter、重复 id/alias、断链、孤页，非零退出并指名文件与规则；纳入 `pnpm check`。
- AC3 · ingest 引擎：扇出提取（每 feature 一次 `claude -p`，并发 3，每 agent 只写自己两个文件）+ 串行整合；失败不阻塞并记录；`--only / --skip-existing / --retry-failed / --dry-run`；spawn stub 单测。
- AC4 · 试点批 10 页合格：11 章 KV Cache 组，sources 指向 `vllm-ascend@28bf3a2e` 真实行号，抽 3 页人核，agent 未越界。
- AC5 · 批量灌种：10 到 21 章全部特性 + 30 个 `Step.terms`；`wiki:lint --terms` 通过；`pnpm check` 全绿。
- AC6 · 站内消费：`#/wiki` 阅读页 + `<Term>` 悬停卡，Playwright 验收。
- AC7 · 聊天问答：`server/` spawn `claude -p` 只读白名单，SSE 流式，`--resume` 多轮。
- AC8 · 存进 wiki 与 PR ingest：草稿产出、PR ingest 经 sanitize、批准 / 驳回面板。

**Architecture:** 三层（`wiki/raw` 不可变摘录、`wiki/concepts|sources` agent 维护的页面、`wiki/HANDBOOK.md` schema）+ 三操作（ingest / query / lint）。ingest 是「扇出提取 + 串行整合」：并行 agent 各写自己的 `_drafts/<id>.md` 与 `raw/<id>.md`，整合 agent 一次一个跨页写，程序按批前批后快照差集判越界，所以不需要任何锁。`index.md` 与 `registry.json` 由程序从 frontmatter 派生，agent 禁写。站内消费只读 `registry.json` 与页面原文；聊天由 `server/` 薄运行器 spawn 同一套 CLI 封装。
**Tech Stack:** TypeScript + tsx 脚本（`scripts/wiki/*` 纯函数 + `scripts/wiki-*.ts` 入口）、zod 3（schema 脚本与前端共用）、gray-matter（frontmatter）、yaml（种子清单）、vitest 5、本机 `claude` CLI 2.1.263、Node 22 `child_process`。

---

## 锚点核实记录（2026-09-07，worktree `feat/llm-wiki` @ `009412b`）

1. 术语 id 来源：`src/sim/model/forwardLayer.ts:63` `terms: string[]`，21 个 step 共 30 个不同 id。取法：`buildLayerTimeline(getPresetSpec("qwen3-0.6b"), getTokenPreset())` 后收集 `steps[].terms`（`forwardLayer.ts:683`，`presets.ts:33`）。`scripts/bench-forward.ts` 已证明 scripts 可直接相对导入 `src/sim`。
2. 层序：`scripts/check-deps.ts:9` `design ← sim ← timeline ← viz2d ← content ← app`。`src/content/wiki/schema.ts` 只依赖 zod，不违反层序；`scripts/` 与 `server/` 在 `src/` 之外，不受层序约束。
3. tsconfig：`tsconfig.node.json` include `scripts`（lib ES2023，无 DOM）；`tsconfig.app.json` include `src`（`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess` 开）。schema.ts 同时被两边编译，代码要兼容两套严格度。
4. vitest include `scripts/**/*.test.ts`（`vitest.config.ts:6`），biome include `scripts/**`（`biome.json`），所以脚本测试与 lint 无需改配置。
5. 依赖：zod `^3.25`（不是 4）；本次新增 devDeps `gray-matter ^4.0.3`、`yaml ^2.9.0`（已 `pnpm add -D`，待随 Task 1 提交）。
6. `scripts/check-content.ts` 13 行占位；`pnpm check` = typecheck + lint + test + check:deps + check:content，现状 126/126。
7. 证据等级七档见 `PLAN.md:105-119`；章节表见 `PLAN.md:47-81`；钉住 commit `PLAN.md:119`。
8. claude CLI 实测支持 `--allowedTools`（逗号或空格分隔，支持 `Bash(git *)` 形式的规则）、`--disallowedTools`、`--add-dir`、`--append-system-prompt`、`--output-format stream-json`、`--include-partial-messages`、`--resume`、`--max-turns`、`--max-budget-usd`、`--tools`、`--restricted`。stdin 非 TTY 时 `-p` 从 stdin 读 prompt。
9. Multi-Agent 借用点（`C:\Users\-\Desktop\Multi-Agent\packages\api\src\`）：`wiki/handbook-slicer.ts:69` H2 切片；`runtime/claude-command.ts:19` 入口解析顺序；`runtime/base-runtime.ts:280-284` prompt 走 stdin、`:164` `taskkill /pid /t /f`；`runtime/claude-runtime.ts:62` stream-json 解包；`wiki/sanitize/` 零依赖五层防注入（第五步复制）。Multi-Agent 的 claude 调用全靠 `bypassPermissions`，不用白名单，本项目不照搬。
10. gray-matter 用 js-yaml：`updated: 2026-09-07` 不加引号会解析成 `Date`；`evidence: !` 不加引号是 YAML tag 语法错误。HANDBOOK 规定 `evidence` 必须加引号，程序侧把 `Date` 规范化回 `YYYY-MM-DD`。
11. 本仓库无 remote，只有 `main`；worktree `../infra-view-new-llm-wiki` 已建，分支 `feat/llm-wiki`，`pnpm install` 完成。主仓的未跟踪 intro 文件不在 worktree 里，不碰。

## 设计决策（实施中不再重议）

| # | 决策 | 理由 |
|---|------|------|
| D1 | ingest 用 `--allowedTools Read Grep Glob Write(<path>)` 白名单 + `--disallowedTools Bash Edit …`，不传 `--permission-mode`。`-p` 非交互下未授权工具自动拒绝 | agent 面对不可信源码与 PR 文本，工具面必须最小。`Write(路径)` 规则是否按路径生效由 Spike W1 实证；不生效则退化为裸 `Write` + 快照越界检查 |
| D2 | 越界检查用文件快照（path → mtime+size）批前批后差集，不用 `git status` | 并发 agent 同时跑，`git status` 分不清谁写的；快照差集只要不在本批允许集合就判失败，且不受未提交改动干扰 |
| D3 | ingest 用 `--output-format stream-json --verbose`，只解析 `assistant.tool_use`（实时打印在读哪个文件）与 `result`（session_id、is_error、cost） | 10 个并行 agent 跑十几分钟，要能看到活着；不需要 partial delta |
| D4 | prompt 走 stdin；`--append-system-prompt` 只放 HANDBOOK 切片 | Windows argv 32 KB 上限（Multi-Agent 踩过 `ENAMETOOLONG`） |
| D5 | 整合 agent 不删文件：写 `_drafts/_integration.json` 决策，引擎按决策删草稿、追加 `log.md` | agent 没有 Bash；删除动作由程序做，可测可回滚 |
| D6 | `index.md` / `registry.json` 完全确定性（不含时间戳），`log.md` 只由 ingest 在晋升时追加 | AC1 要求重复 build 无 diff；build 若写时间戳会污染 git |
| D7 | `wiki:lint` 的「`Step.terms` 缺页」规则只在 `--terms` 开启；第一步 `pnpm check` 不带，第二步补齐 30 页后在 package.json 加上 | 30 个术语页在第二步才产出，第一步就让 check 红是把阶段目标当断言 |
| D8 | 草稿（`_drafts/`）不进 lint 与 build；引擎在整合前用同一 `parsePage` 校验草稿 frontmatter，不合法的草稿直接记失败 | 未审内容不能进 registry；但格式错要尽早暴露 |
| D9 | 每页 `sources` 允许两种值：`repo@commit:path#L起-L止` 或 `https://` URL（官方文档，evidence S） | 术语页要引本仓库 `infer-lab@<commit>:src/sim/...`，特性页引 vllm-ascend，来源页引文档 URL |
| D10 | 章节标题表放 `src/content/wiki/chapters.ts`，内容照抄 `PLAN.md` §1.1，build 与 lint 共用 | 单一真相源；PLAN 是文档不能被程序读，抄一份并在注释里指回 |
| D11 | agent cwd = `wiki/`，会连带加载仓库根 `CLAUDE.md`。先接受；试点若发现它干扰 agent，再加一行 `wiki/CLAUDE.md` 指向系统提示中的 HANDBOOK 切片 | 不预设问题；HANDBOOK 仍是唯一 schema |
| D12 | 第一步只克隆 vllm-ascend；`tools/repos/` 进 `.gitignore` | 用户拍板 |
| D13 | 页面正文中文、`title` 英文原名、`aliases` 放中文 | 用户拍板 |
| D14 | ingest agent 不传 `--model` | 用户拍板 |

## Out of scope（本计划不做）

- 向量检索 / qmd（触发：页数 > 300）。
- codex 作为 ingest agent（触发：claude 试点合格且用户要求；`RunAgent` 接口已抽象，接入只加一个 runner）。
- 章节页右栏（触发：章节页存在；抽屉组件在 AC7 做成可复用）。
- 租约 / 围栏令牌 / CAS / ACL / SQLite FTS / adaptive recall / cron / 写入账本。
- 第一步不克隆 vllm。

---

## Phase 1：骨架 + ingest 引擎 + 试点批（AC1–AC4）

### Task 1: 页面 schema（zod，脚本与前端共用）

**Files:**
- Modify: `package.json`（devDeps 已加 gray-matter、yaml；本 task 只提交）
- Create: `src/content/wiki/schema.ts`
- Create: `src/content/wiki/chapters.ts`
- Test: `src/content/wiki/schema.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { CHAPTER_TITLES } from "./chapters";
import { pageFrontmatterSchema, parseRepoRef, registrySchema } from "./schema";

const ok = {
  id: "kv-cache",
  title: "KV Cache",
  type: "concept",
  summary: "缓存每层每个 token 的 K 与 V，decode 时不再重算。",
  aliases: ["KV 缓存"],
  chapters: ["05", "11"],
  sources: ["vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L120-L188"],
  evidence: "C",
  related: ["paged-attention"],
  updated: "2026-09-07",
};

describe("pageFrontmatterSchema", () => {
  it("合法页通过，可选数组有默认值", () => {
    const r = pageFrontmatterSchema.parse({ ...ok, aliases: undefined, related: undefined });
    expect(r.aliases).toEqual([]);
    expect(r.related).toEqual([]);
    expect(r.contradicts).toEqual([]);
  });
  it("空 sources 拒收", () => {
    expect(() => pageFrontmatterSchema.parse({ ...ok, sources: [] })).toThrow(/sources/);
  });
  it("sources 只接受 repo@commit:path#L 或 URL", () => {
    expect(() => pageFrontmatterSchema.parse({ ...ok, sources: ["attention_v1.py"] })).toThrow();
    expect(pageFrontmatterSchema.parse({ ...ok, sources: ["https://docs.vllm.ai/x"] }).sources).toHaveLength(1);
  });
  it("id 必须 kebab-case，evidence 只认七档，updated 必须是日期串", () => {
    expect(() => pageFrontmatterSchema.parse({ ...ok, id: "KV_Cache" })).toThrow();
    expect(() => pageFrontmatterSchema.parse({ ...ok, evidence: "X" })).toThrow();
    expect(pageFrontmatterSchema.parse({ ...ok, evidence: "!" }).evidence).toBe("!");
    expect(() => pageFrontmatterSchema.parse({ ...ok, updated: "昨天" })).toThrow();
  });
  it("parseRepoRef 拆出 repo/commit/path/行号", () => {
    expect(parseRepoRef("vllm-ascend@28bf3a2e:a/b.py#L10-L20")).toEqual({
      repo: "vllm-ascend",
      commit: "28bf3a2e",
      path: "a/b.py",
      lineStart: 10,
      lineEnd: 20,
    });
    expect(parseRepoRef("vllm-ascend@28bf3a2e:a/b.py")).toEqual({ repo: "vllm-ascend", commit: "28bf3a2e", path: "a/b.py" });
    expect(parseRepoRef("https://x")).toBeNull();
  });
  it("registry 是 pages 数组，每项多一个 file", () => {
    const r = registrySchema.parse({ version: 1, pages: [{ ...ok, file: "concepts/kv-cache.md" }] });
    expect(r.pages[0]?.file).toBe("concepts/kv-cache.md");
  });
});

describe("CHAPTER_TITLES", () => {
  it("00 到 21 共 22 章", () => {
    expect(Object.keys(CHAPTER_TITLES)).toHaveLength(22);
    expect(CHAPTER_TITLES["11"]).toBe("KV Cache 内存系统");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/content/wiki/schema.test.ts`
Expected: FAIL — Cannot find module './schema'

**Step 3: Write minimal implementation**

`src/content/wiki/chapters.ts`：

```typescript
/**
 * 章节编号 → 标题。真相源是 PLAN.md §1.1（22 章）；这里是给程序读的副本，改 PLAN 时同步。
 */
export const CHAPTER_TITLES: Record<string, string> = {
  "00": "从一次对话开始：推理到底在算什么",
  "01": "Token、Embedding 与向量",
  "02": "矩阵乘法与张量形状",
  "03": "Transformer 层的双层数据流",
  "04": "Attention 深入",
  "05": "Prefill 与 Decode",
  "06": "MoE",
  "07": "昇腾 NPU 剖面",
  "08": "服务器与机柜",
  "09": "一次请求的硬件旅程",
  "10": "引擎架构与插件机制",
  "11": "KV Cache 内存系统",
  "12": "调度",
  "13": "并行 I：TP / PP / DP",
  "14": "并行 II：EP / DPA / EPLB / large-scale EP",
  "15": "并行 III：SP / CP / PCP / DCP",
  "16": "图模式与算子",
  "17": "量化与投机解码",
  "18": "PD / EPD 分离与 KV 传输",
  "19": "性能工程",
  "20": "读源码",
  "21": "PR 影响分析",
};
export const CHAPTER_IDS = Object.keys(CHAPTER_TITLES);
```

`src/content/wiki/schema.ts`：

```typescript
/**
 * wiki 页面 frontmatter 的 schema。脚本（wiki-build / wiki-lint / wiki-ingest）与前端读取器共用。
 * 字段含义见 wiki/HANDBOOK.md「页面格式」，那里是人读的真相源，这里是机器读的。
 */
import { z } from "zod";

export const PAGE_TYPES = ["concept", "feature", "source", "pr"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** 证据等级，沿用 PLAN.md §1.4 七档 */
export const EVIDENCE_LEVELS = ["S", "C", "D", "A", "I", "M", "!"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** repo@commit:path#L起-L止（行号可省略） */
export const REPO_REF_RE = /^([a-z0-9][a-z0-9-]*)@([0-9a-f]{7,40}):([^\s#]+)(?:#L(\d+)(?:-L(\d+))?)?$/;
export const URL_RE = /^https?:\/\/\S+$/;

export function isSourceRef(s: string): boolean {
  return REPO_REF_RE.test(s) || URL_RE.test(s);
}

export interface RepoRef {
  repo: string;
  commit: string;
  path: string;
  lineStart?: number;
  lineEnd?: number;
}

export function parseRepoRef(ref: string): RepoRef | null {
  const m = REPO_REF_RE.exec(ref);
  if (!m) return null;
  const out: RepoRef = { repo: m[1] ?? "", commit: m[2] ?? "", path: m[3] ?? "" };
  if (m[4] !== undefined) out.lineStart = Number(m[4]);
  if (m[5] !== undefined) out.lineEnd = Number(m[5]);
  return out;
}

const idField = z.string().regex(ID_RE, "id 必须是 kebab-case");

export const pageFrontmatterSchema = z.object({
  id: idField,
  title: z.string().min(1),
  type: z.enum(PAGE_TYPES),
  summary: z.string().min(1).max(200, "summary 是一句话，不超过 200 字"),
  aliases: z.array(z.string().min(1)).default([]),
  chapters: z.array(z.string().regex(/^\d{2}$/)).default([]),
  sources: z
    .array(z.string().refine(isSourceRef, "sources 每项必须是 repo@commit:path#L起-L止 或 https URL"))
    .min(1, "sources 不得为空"),
  evidence: z.enum(EVIDENCE_LEVELS),
  related: z.array(idField).default([]),
  contradicts: z.array(z.string()).default([]),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "updated 必须是 YYYY-MM-DD"),
});
export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;

export const registryEntrySchema = pageFrontmatterSchema.extend({
  /** 相对 wiki/ 的 posix 路径，如 concepts/kv-cache.md */
  file: z.string(),
});
export type RegistryEntry = z.infer<typeof registryEntrySchema>;

export const registrySchema = z.object({
  version: z.literal(1),
  pages: z.array(registryEntrySchema),
});
export type Registry = z.infer<typeof registrySchema>;
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/content/wiki/schema.test.ts`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/content/wiki/
git commit -m "feat(F001): wiki page schema and chapter table shared by scripts and app"
```

---

### Task 2: HANDBOOK.md 与 H2 切片器

**Files:**
- Create: `wiki/HANDBOOK.md`
- Create: `scripts/wiki/handbook.ts`
- Test: `scripts/wiki/handbook.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { HANDBOOK_H2, HandbookSliceMissingError, loadHandbook, sliceHandbook } from "./handbook";

const doc = `---
title: x
---
# 前言（不进任何切片）

## 页面格式
A1
### 子节
A2

## 提取
B

## 整合
C

## 查询
D

## Lint
E

## 人类须知
F

## 未知标题
丢弃
`;

describe("sliceHandbook", () => {
  it("按 H2 切六片，H3 归当前片，标题行保留，未知 H2 与前言丢弃", () => {
    const s = sliceHandbook(doc);
    expect(s.pageFormat).toBe("## 页面格式\nA1\n### 子节\nA2\n\n");
    expect(s.extract.trim()).toBe("## 提取\nB");
    expect(s.human.trim()).toBe("## 人类须知\nF");
    expect(JSON.stringify(s)).not.toContain("丢弃");
    expect(JSON.stringify(s)).not.toContain("前言");
  });
  it("任一切片缺失即抛错并指名", () => {
    expect(() => sliceHandbook(doc.replace("## 查询\nD\n", ""))).toThrow(HandbookSliceMissingError);
    expect(() => sliceHandbook(doc.replace("## 查询\nD\n", ""))).toThrow(/查询/);
  });
  it("真实 HANDBOOK.md 六片齐全", () => {
    const s = loadHandbook(`${process.cwd()}/wiki`);
    for (const key of Object.keys(HANDBOOK_H2) as (keyof typeof HANDBOOK_H2)[]) {
      expect(s[key].length, key).toBeGreaterThan(50);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/wiki/handbook.test.ts`
Expected: FAIL — Cannot find module './handbook'

**Step 3: Write minimal implementation**

`scripts/wiki/handbook.ts`（思路借自 Multi-Agent `wiki/handbook-slicer.ts:69`）：

```typescript
/**
 * 把 wiki/HANDBOOK.md 按 H2 切成六片，分别注入不同角色的 agent。
 * 程序只做索引（切片），不做语义判断；H3 及以下归属当前 H2；前言与未知 H2 丢弃。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const HANDBOOK_H2 = {
  pageFormat: "页面格式",
  extract: "提取",
  integrate: "整合",
  query: "查询",
  lint: "Lint",
  human: "人类须知",
} as const;
export type HandbookSliceKey = keyof typeof HANDBOOK_H2;
export type HandbookSlices = Record<HandbookSliceKey, string>;

export class HandbookSliceMissingError extends Error {
  constructor(readonly key: HandbookSliceKey) {
    super(`HANDBOOK 缺少 H2 切片「${HANDBOOK_H2[key]}」（${key}）`);
    this.name = "HandbookSliceMissingError";
  }
}

const H2_TO_KEY = new Map<string, HandbookSliceKey>(
  (Object.entries(HANDBOOK_H2) as [HandbookSliceKey, string][]).map(([k, h]) => [h, k]),
);

export function sliceHandbook(content: string): HandbookSlices {
  const slices: HandbookSlices = { pageFormat: "", extract: "", integrate: "", query: "", lint: "", human: "" };
  let current: HandbookSliceKey | null = null;
  for (const line of content.split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      current = H2_TO_KEY.get((m[1] ?? "").trim()) ?? null;
      if (current) slices[current] += `${line}\n`;
      continue;
    }
    if (current) slices[current] += `${line}\n`;
  }
  for (const key of Object.keys(HANDBOOK_H2) as HandbookSliceKey[]) {
    if (!slices[key].trim()) throw new HandbookSliceMissingError(key);
  }
  return slices;
}

export function loadHandbook(wikiRoot: string): HandbookSlices {
  return sliceHandbook(readFileSync(join(wikiRoot, "HANDBOOK.md"), "utf8"));
}
```

`wiki/HANDBOOK.md`（schema 真相源，全文）：

```markdown
---
title: infer-lab Wiki Handbook
updated: 2026-09-07
---
# infer-lab Wiki Handbook

这是 `wiki/` 的唯一规则文件。程序按下面六个 H2 切片，把「页面格式 + 提取」给提取 agent、「页面格式 + 整合」给整合 agent、「页面格式 + 查询」给问答 agent、「Lint」给 lint 脚本作对照、「人类须知」只给人看。改规则只改这一个文件。

## 页面格式

每页是一个 markdown 文件，文件名 `<id>.md`，放在 `concepts/`（术语与特性页）或 `sources/`（来源摘要页、PR 页）。frontmatter 字段：

```yaml
---
id: kv-cache                      # kebab-case，与文件名一致；术语页与 Step.terms 的 id 一致
title: KV Cache                   # 英文原名
type: concept                     # concept | feature | source | pr
summary: 缓存每层每个 token 的 K 与 V，decode 时不再重算。   # 一句话，≤200 字，悬停卡直接用
aliases: [KV 缓存]                # 中文名与常见别称
chapters: ["05", "11"]            # 归属章节，两位数字符串
sources:                          # 不得为空
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L120-L188
evidence: "C"                     # 必须加引号；S 官方文档 / C 钉住 commit 的源码 / D 推导 / A 假设 / I 推断 / M 实测 / ! 冲突
related: [paged-attention]        # 其它页的 id
contradicts: []                   # 整合阶段发现矛盾时填 "<id>: 一句话"，留给人审
updated: "2026-09-07"             # 必须加引号，否则 YAML 会解析成日期对象
---
```

正文用中文，英文术语、代码、标识符原样保留。固定四节，用 H2：

1. `## 是什么`：两三句，先说它解决什么问题。
2. `## 形状与数值`：涉及张量时写出形状，用 Qwen3-0.6B 的真实维度（H=1024，n_q=16，n_kv=8，d_h=128，28 层）；涉及配置项时写出默认值与来源行号。
3. `## 在哪一步出现`：对应课程哪一章、请求路径的哪个阶段、源码里哪个类或函数（写 `文件#L起-L止`）。
4. `## 常见误解`：一到三条，每条一句纠正。

链接用相对 markdown 链接：同目录 `[PagedAttention](paged-attention.md)`，跨目录 `[来源](../sources/xxx.md)`。不用 `[[wikilink]]`。引用代码片段时链接到 `../raw/<id>.md`。

`sources` 每项两种写法：`repo@commit:path#L起-L止`（repo 是 `vllm-ascend`、`vllm`、`infer-lab` 之一，commit 是钉住的短 hash）或 `https://` URL（只用于 evidence 为 S 的官方文档）。写行号必须是你实际打开并阅读过的行。

## 提取

你是提取 agent。一次只负责一个 feature，任务描述在用户消息里。

规则：
- 只允许写两个文件：`_drafts/<id>.md`（页面草稿，格式见「页面格式」）和 `raw/<id>.md`（你实际引用的源码片段）。任何其它路径一律不写。写完这两个文件就结束，回复一行 `DONE <id> sources=<数量>`。
- 只读来源目录（`--add-dir` 给你的仓库）。从任务给的入口文件开始，用 Grep / Glob 追到定义处，读到能回答「它是什么、怎么配置、在哪个调用链上、和哪些特性互斥或依赖」为止。
- `raw/<id>.md` 格式：H1 标题，然后每个片段一节：`## <path>#L起-L止`，下面一个代码块贴原文（不改动一字），再一行你为什么引用它。只贴你在页面里用到的片段，每段不超过 60 行。
- `sources` 里每一项都要在 `raw/<id>.md` 里有对应片段；反过来 raw 里每个片段都要被正文引用到。
- 不确定的写成推断并把 `evidence` 降到 `I`，不要编造行号。找不到任何源码依据就不要写页面，回复 `FAIL <id> <原因>`。
- 不要读 `_drafts/` 里别人的草稿，不要修改 `concepts/`、`index.md`、`log.md`。
- `related` 只填你确定存在或本批会产生的 id（任务描述里会列出本批 id）。

## 整合

你是整合 agent。一次处理一批草稿，任务描述里列出草稿 id。

规则：
- 读 `_drafts/` 里列出的草稿和 `concepts/` 里全部现有页，做四件事：
  1. 判重与合并：草稿与现有页讲同一个东西 → 把草稿的新增内容合进现有页，草稿记为 merged。
  2. 建双向 `related`：A 的 related 含 B，则 B 的 related 也要含 A。
  3. 标矛盾：草稿与现有页对同一事实说法不同 → 两边 `contradicts` 各加一条 `"<对方id>: 一句话"`，不要自行裁决。
  4. 晋升：通过的草稿原样写到 `concepts/<id>.md`（`updated` 改为今天）。
- 你只能写 `concepts/` 下的文件和 `_drafts/_integration.json`，不能删除任何文件。决策文件格式：
  ```json
  { "promoted": ["id"], "merged": [{ "from": "id", "into": "id" }], "rejected": [{ "id": "id", "reason": "..." }], "contradictions": [{ "a": "id", "b": "id", "note": "..." }] }
  ```
- 拒收条件：sources 为空、行号明显编造（文件不存在）、正文少于三节、summary 超过一句话。
- 不写 `index.md`、`log.md`，它们由程序派生。
- 写完决策文件后回复一行 `DONE integrate promoted=<n> merged=<n> rejected=<n>`。

## 查询

你是课程知识库的问答 agent，回答学习者关于大模型推理、vLLM、vLLM-Ascend 与昇腾硬件的问题。

规则：
- 先读 `index.md` 找相关页，再读页面正文，再回答。找不到相关页就明说「知识库里还没有这一条」，然后用你自己的知识简短回答并标注「（未收录）」。
- 回答用中文，引用页面时用相对链接 `[KV Cache](concepts/kv-cache.md)`，让前端能跳转。每个结论后面带页面的 evidence 等级，如 `[C]`。
- 不超过 300 字，先给一句话答案，再展开。
- 你只有读工具，不要尝试写文件。学习者点「存进 wiki」时程序会把你的回答变成草稿。

## Lint

`pnpm wiki:lint` 执行以下规则，任一失败即非零退出并指名文件：

- `schema`：frontmatter 不符合「页面格式」（含 sources 为空、evidence 不在七档、updated 非日期）。
- `dup-id`：两个文件同 id；`dup-alias`：alias 与其它页的 id 或 alias 重复（忽略大小写）。
- `unknown-chapter`：chapters 含不存在的章节号。
- `related-missing`：related 指向不存在的 id。
- `broken-link`：正文相对链接指向不存在的文件。
- `orphan`：concept / feature 页既没有 chapters，也没有任何页链接到它。
- `log-format`：`log.md` 的 H2 不符合 `## [YYYY-MM-DD] ingest|build|review | 标题`。
- `missing-term`（`--terms` 时）：`src/sim/model/forwardLayer.ts` 的 `Step.terms` 里有 id 没有页。

## 人类须知

- 目录：`concepts/` 术语与特性页，`sources/` 来源摘要与 PR 页，`raw/` 不可变摘录（agent 写一次后不改），`_drafts/` 待整合与人审，`seeds/` 灌种清单，`index.md` 与 `log.md` 派生物。
- 命令：`pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml [--only a,b] [--skip-existing] [--retry-failed] [--dry-run] [--phase extract|integrate|all]`；`pnpm wiki:build`；`pnpm wiki:lint [--terms]`。
- 人审：看 `_drafts/_integration.json` 与 `git diff wiki/concepts`，随机抽页对照 `raw/` 与 `tools/repos/` 源码。不满意改本文件对应切片重跑，不要手改草稿。
- 失败：`_drafts/_failures.json` 记录每个失败 feature 的原因与 session id；`--retry-failed` 只重跑它们。
- 来源仓库在 `tools/repos/<repo>`，钉住 `seeds/*.yaml` 里的 commit；不在 git 里，`pnpm wiki:clone` 重建。
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/wiki/handbook.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add wiki/HANDBOOK.md scripts/wiki/handbook.ts scripts/wiki/handbook.test.ts
git commit -m "feat(F001): wiki HANDBOOK as the single schema source with H2 slicer"
```

---

### Task 3: 页面读取器（frontmatter 解析 + 规范化）

**Files:**
- Create: `scripts/wiki/pages.ts`
- Test: `scripts/wiki/pages.test.ts`

**Step 1: Write the failing test**

```typescript
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPages, parsePage } from "./pages";

const good = `---
id: kv-cache
title: KV Cache
type: concept
summary: 一句话
chapters: ["11"]
sources:
  - vllm-ascend@28bf3a2e:a.py#L1-L2
evidence: "C"
updated: 2026-09-07
---
## 是什么
正文
`;

describe("parsePage", () => {
  it("解析 frontmatter，未加引号的日期规范化成字符串", () => {
    const r = parsePage("concepts/kv-cache.md", good);
    expect(r.problems).toEqual([]);
    expect(r.page?.fm.updated).toBe("2026-09-07");
    expect(r.page?.body.trim()).toBe("## 是什么\n正文");
  });
  it("文件名与 id 不一致 / schema 错误 → problems 指名文件与规则", () => {
    expect(parsePage("concepts/other.md", good).problems[0]).toMatchObject({ file: "concepts/other.md", rule: "id-file" });
    const r = parsePage("concepts/kv-cache.md", good.replace("sources:\n  - vllm-ascend@28bf3a2e:a.py#L1-L2", "sources: []"));
    expect(r.page).toBeUndefined();
    expect(r.problems[0]).toMatchObject({ rule: "schema" });
    expect(r.problems[0]?.message).toContain("sources");
  });
  it("没有 frontmatter → schema 错误", () => {
    expect(parsePage("concepts/x.md", "# 裸文件").problems[0]?.rule).toBe("schema");
  });
});

describe("loadPages", () => {
  it("只读 concepts/ 与 sources/，跳过 _drafts/ 与 raw/", () => {
    const root = mkdtempSync(join(tmpdir(), "wiki-"));
    for (const d of ["concepts", "sources", "_drafts", "raw"]) mkdirSync(join(root, d));
    writeFileSync(join(root, "concepts/kv-cache.md"), good);
    writeFileSync(join(root, "sources/doc.md"), good.replace("id: kv-cache", "id: doc").replace("type: concept", "type: source"));
    writeFileSync(join(root, "_drafts/kv-cache.md"), good);
    writeFileSync(join(root, "raw/kv-cache.md"), "# raw");
    const { pages, problems } = loadPages(root);
    expect(problems).toEqual([]);
    expect(pages.map((p) => p.file).sort()).toEqual(["concepts/kv-cache.md", "sources/doc.md"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/wiki/pages.test.ts`
Expected: FAIL — Cannot find module './pages'

**Step 3: Write minimal implementation**

```typescript
/**
 * 读 wiki 页面：gray-matter 解 frontmatter → 规范化（Date → 字符串）→ zod 校验。
 * 只负责 concepts/ 与 sources/；草稿由 ingest 引擎单独调用 parsePage。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";
import { type PageFrontmatter, pageFrontmatterSchema } from "../../src/content/wiki/schema";

export const PAGE_DIRS = ["concepts", "sources"] as const;

export interface WikiPage {
  /** 相对 wikiRoot 的 posix 路径 */
  file: string;
  fm: PageFrontmatter;
  body: string;
}

export interface PageProblem {
  file: string;
  rule: string;
  message: string;
}

function normalize(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  }
  return out;
}

export function parsePage(file: string, text: string): { page?: WikiPage; problems: PageProblem[] } {
  const problems: PageProblem[] = [];
  let data: Record<string, unknown>;
  let body: string;
  try {
    const m = matter(text);
    data = normalize(m.data as Record<string, unknown>);
    body = m.content;
  } catch (e) {
    return { problems: [{ file, rule: "schema", message: `frontmatter 解析失败：${(e as Error).message}` }] };
  }
  const r = pageFrontmatterSchema.safeParse(data);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join(".") || "frontmatter"}: ${i.message}`).join("；");
    return { problems: [{ file, rule: "schema", message: msg }] };
  }
  const stem = basename(file, ".md");
  if (stem !== r.data.id) problems.push({ file, rule: "id-file", message: `文件名 ${stem} 与 id ${r.data.id} 不一致` });
  return { page: { file, fm: r.data, body }, problems };
}

export function loadPages(wikiRoot: string): { pages: WikiPage[]; problems: PageProblem[] } {
  const pages: WikiPage[] = [];
  const problems: PageProblem[] = [];
  for (const dir of PAGE_DIRS) {
    const abs = join(wikiRoot, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs).filter((n) => n.endsWith(".md")).sort()) {
      const file = `${dir}/${name}`;
      const r = parsePage(file, readFileSync(join(abs, name), "utf8"));
      if (r.page) pages.push(r.page);
      problems.push(...r.problems);
    }
  }
  return { pages, problems };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/wiki/pages.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add scripts/wiki/pages.ts scripts/wiki/pages.test.ts
git commit -m "feat(F001): wiki page loader with frontmatter normalization"
```

---

### Task 4: wiki:build（index.md + registry.json，确定性）

**Files:**
- Create: `scripts/wiki/build.ts`
- Create: `scripts/wiki-build.ts`
- Modify: `package.json` scripts
- Test: `scripts/wiki/build.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import type { WikiPage } from "./pages";
import { buildRegistry, renderIndex } from "./build";

const page = (id: string, type: WikiPage["fm"]["type"], chapters: string[]): WikiPage => ({
  file: `${type === "source" ? "sources" : "concepts"}/${id}.md`,
  body: "",
  fm: {
    id, title: id.toUpperCase(), type, summary: `${id} 摘要`, aliases: [], chapters,
    sources: ["https://x"], evidence: "S", related: [], contradicts: [], updated: "2026-09-07",
  },
});

describe("renderIndex", () => {
  it("按 type 分组再按章节分组，输出确定且不含时间", () => {
    const pages = [page("b", "concept", ["11"]), page("a", "feature", ["11", "12"]), page("doc", "source", [])];
    const md = renderIndex(pages);
    expect(md).toContain("## 概念（concept）\n- [B](concepts/b.md) — b 摘要");
    expect(md).toContain("## 特性（feature）\n- [A](concepts/a.md) — a 摘要");
    expect(md).toContain("### 11 KV Cache 内存系统\n- [A](concepts/a.md)\n- [B](concepts/b.md)");
    expect(md).toContain("### 12 调度\n- [A](concepts/a.md)");
    expect(md).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(renderIndex([...pages].reverse())).toBe(md);
  });
});

describe("buildRegistry", () => {
  it("按 id 排序，每项带 file", () => {
    const r = buildRegistry([page("b", "concept", []), page("a", "concept", [])]);
    expect(r.version).toBe(1);
    expect(r.pages.map((p) => p.id)).toEqual(["a", "b"]);
    expect(r.pages[0]?.file).toBe("concepts/a.md");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/wiki/build.test.ts`
Expected: FAIL — Cannot find module './build'

**Step 3: Write minimal implementation**

`scripts/wiki/build.ts`：

```typescript
/**
 * 派生物生成：index.md（人读目录）与 src/content/wiki/registry.json（前端读）。
 * 完全由 frontmatter 决定，不含时间戳，重复运行无 diff。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHAPTER_TITLES } from "../../src/content/wiki/chapters";
import { PAGE_TYPES, type PageType, type Registry } from "../../src/content/wiki/schema";
import { loadPages, type WikiPage } from "./pages";

const TYPE_LABEL: Record<PageType, string> = { concept: "概念", feature: "特性", source: "来源", pr: "PR" };

const byId = (a: WikiPage, b: WikiPage) => a.fm.id.localeCompare(b.fm.id);
const link = (p: WikiPage) => `[${p.fm.title}](${p.file})`;

export function renderIndex(pages: WikiPage[]): string {
  const sorted = [...pages].sort(byId);
  const out: string[] = ["# Wiki 索引", "", `派生文件，由 \`pnpm wiki:build\` 生成，勿手改。共 ${sorted.length} 页。`, ""];
  for (const type of PAGE_TYPES) {
    const group = sorted.filter((p) => p.fm.type === type);
    if (!group.length) continue;
    out.push(`## ${TYPE_LABEL[type]}（${type}）`);
    for (const p of group) {
      const ch = p.fm.chapters.length ? ` \`${p.fm.chapters.join(" ")}\`` : "";
      out.push(`- ${link(p)} — ${p.fm.summary}${ch}`);
    }
    out.push("");
  }
  out.push("## 按章节", "");
  for (const [id, title] of Object.entries(CHAPTER_TITLES)) {
    const group = sorted.filter((p) => p.fm.chapters.includes(id));
    if (!group.length) continue;
    out.push(`### ${id} ${title}`);
    for (const p of group) out.push(`- ${link(p)}`);
    out.push("");
  }
  return `${out.join("\n").trimEnd()}\n`;
}

export function buildRegistry(pages: WikiPage[]): Registry {
  return { version: 1, pages: [...pages].sort(byId).map((p) => ({ ...p.fm, file: p.file })) };
}

export function runBuild(rootDir: string): { pageCount: number; problems: number } {
  const wikiRoot = join(rootDir, "wiki");
  const { pages, problems } = loadPages(wikiRoot);
  for (const p of problems) console.error(`x ${p.file} [${p.rule}] ${p.message}`);
  writeFileSync(join(wikiRoot, "index.md"), renderIndex(pages));
  const outDir = join(rootDir, "src/content/wiki");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "registry.json"), `${JSON.stringify(buildRegistry(pages), null, 2)}\n`);
  return { pageCount: pages.length, problems: problems.length };
}
```

`scripts/wiki-build.ts`：

```typescript
import { runBuild } from "./wiki/build";

const r = runBuild(process.cwd());
console.log(`ok wiki:build ${r.pageCount} 页 → wiki/index.md, src/content/wiki/registry.json`);
if (r.problems) {
  console.error(`wiki:build 有 ${r.problems} 个页面未通过解析，已跳过；运行 pnpm wiki:lint 查看`);
  process.exit(1);
}
```

`package.json` scripts 增：

```json
"wiki:build": "tsx scripts/wiki-build.ts",
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/wiki/build.test.ts && pnpm wiki:build && pnpm wiki:build && git status --short wiki src/content/wiki`
Expected: PASS (2 tests)；两次 build 后 `wiki/index.md` 与 `registry.json` 各出现一次（新文件），第二次不再变化。

**Step 5: Commit**

```bash
git add scripts/wiki/build.ts scripts/wiki/build.test.ts scripts/wiki-build.ts package.json wiki/index.md src/content/wiki/registry.json
git commit -m "feat(F001): wiki:build derives index.md and registry.json deterministically"
```

---

### Task 5: wiki:lint 规则 + 纳入 pnpm check

**Files:**
- Create: `scripts/wiki/lint.ts`
- Create: `scripts/wiki-lint.ts`
- Modify: `scripts/check-content.ts`
- Modify: `package.json`（`wiki:lint`，`check` 追加 `&& pnpm wiki:lint`）
- Test: `scripts/wiki/lint.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { collectStepTerms, lintPages, lintLog } from "./lint";
import type { WikiPage } from "./pages";

const mk = (id: string, over: Partial<WikiPage["fm"]> = {}, body = ""): WikiPage => ({
  file: `concepts/${id}.md`,
  body,
  fm: {
    id, title: id, type: "concept", summary: "s", aliases: [], chapters: ["11"], sources: ["https://x"],
    evidence: "S", related: [], contradicts: [], updated: "2026-09-07", ...over,
  },
});
const opts = { chapterIds: ["11", "12"], existsFile: (rel: string) => rel === "raw/a.md" };

describe("lintPages", () => {
  it("干净输入无问题", () => {
    expect(lintPages([mk("a", { related: ["b"] }, "[b](b.md) [raw](../raw/a.md)"), mk("b", { related: ["a"] })], opts)).toEqual([]);
  });
  it("dup-id / dup-alias（忽略大小写，alias 撞 id 也算）", () => {
    const r = lintPages([mk("a"), { ...mk("a"), file: "sources/a.md" }, mk("b", { aliases: ["A"] })], opts);
    expect(r.map((p) => p.rule)).toEqual(expect.arrayContaining(["dup-id", "dup-alias"]));
  });
  it("unknown-chapter / related-missing / broken-link", () => {
    const r = lintPages([mk("a", { chapters: ["99"], related: ["nope"] }, "[x](nope.md) [ok](../raw/a.md) [web](https://z)")], opts);
    expect(r.map((p) => p.rule).sort()).toEqual(["broken-link", "related-missing", "unknown-chapter"]);
    expect(r.find((p) => p.rule === "broken-link")?.message).toContain("nope.md");
  });
  it("orphan：无 chapters 且无入链；有入链即不算", () => {
    expect(lintPages([mk("lonely", { chapters: [] })], opts)[0]?.rule).toBe("orphan");
    expect(lintPages([mk("lonely", { chapters: [] }), mk("a", {}, "[l](lonely.md)")], opts)).toEqual([]);
    expect(lintPages([mk("doc", { chapters: [], type: "source" })], opts)).toEqual([]);
  });
  it("missing-term 只在给了 requiredTerms 时检查", () => {
    expect(lintPages([mk("a")], { ...opts, requiredTerms: ["a", "kv-cache"] })).toEqual([
      { file: "src/sim/model/forwardLayer.ts", rule: "missing-term", message: "Step.terms 引用的 kv-cache 没有页面" },
    ]);
  });
});

describe("lintLog", () => {
  it("H2 必须是 ## [YYYY-MM-DD] ingest|build|review | 标题", () => {
    expect(lintLog("## [2026-09-07] ingest | KV Cache\n内容\n")).toEqual([]);
    expect(lintLog("## 2026-09-07 随便\n")[0]?.rule).toBe("log-format");
  });
});

describe("collectStepTerms", () => {
  it("从真实 forwardLayer 收到 30 个不重复 id", () => {
    const terms = collectStepTerms();
    expect(terms).toHaveLength(30);
    expect(terms).toContain("kv-cache");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/wiki/lint.test.ts`
Expected: FAIL — Cannot find module './lint'

**Step 3: Write minimal implementation**

`scripts/wiki/lint.ts`：

```typescript
/**
 * wiki 静态检查。规则清单与 HANDBOOK「Lint」切片一一对应。
 */
import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { buildLayerTimeline } from "../../src/sim/model/forwardLayer";
import { getTokenPreset } from "../../src/sim/model/presets";
import { getPresetSpec } from "../../src/sim/modelspec/presets";
import { CHAPTER_IDS } from "../../src/content/wiki/chapters";
import { loadPages, type PageProblem, type WikiPage } from "./pages";

export interface LintOptions {
  chapterIds: string[];
  /** 相对 wikiRoot 的文件是否存在（正文链接可指向 raw/ 等非页面文件） */
  existsFile: (rel: string) => boolean;
  requiredTerms?: string[];
}

const LINK_RE = /\]\(([^)\s]+)\)/g;

function linkTargets(page: WikiPage): string[] {
  const dir = posix.dirname(page.file);
  const out: string[] = [];
  for (const m of page.body.matchAll(LINK_RE)) {
    const raw = m[1] ?? "";
    if (/^(https?:|mailto:|#)/.test(raw)) continue;
    out.push(posix.normalize(posix.join(dir, raw.split("#")[0] ?? "")));
  }
  return out;
}

export function lintPages(pages: WikiPage[], opts: LintOptions): PageProblem[] {
  const problems: PageProblem[] = [];
  const ids = new Map<string, WikiPage>();
  const files = new Set(pages.map((p) => p.file));
  const inbound = new Set<string>();

  for (const p of pages) {
    const prev = ids.get(p.fm.id);
    if (prev) problems.push({ file: p.file, rule: "dup-id", message: `id ${p.fm.id} 已被 ${prev.file} 使用` });
    else ids.set(p.fm.id, p);
  }
  const names = new Map<string, string>();
  for (const p of pages) names.set(p.fm.id.toLowerCase(), p.file);
  for (const p of pages) {
    for (const a of p.fm.aliases) {
      const key = a.toLowerCase();
      const owner = names.get(key);
      if (owner && owner !== p.file) problems.push({ file: p.file, rule: "dup-alias", message: `alias「${a}」与 ${owner} 重复` });
      else names.set(key, p.file);
    }
  }
  for (const p of pages) {
    for (const c of p.fm.chapters) {
      if (!opts.chapterIds.includes(c)) problems.push({ file: p.file, rule: "unknown-chapter", message: `章节 ${c} 不存在` });
    }
    for (const r of p.fm.related) {
      if (!ids.has(r)) problems.push({ file: p.file, rule: "related-missing", message: `related 指向不存在的 ${r}` });
      else inbound.add(r);
    }
    for (const t of linkTargets(p)) {
      const target = pages.find((q) => q.file === t);
      if (target) inbound.add(target.fm.id);
      else if (!files.has(t) && !opts.existsFile(t)) problems.push({ file: p.file, rule: "broken-link", message: `链接 ${t} 不存在` });
    }
  }
  for (const p of pages) {
    const teach = p.fm.type === "concept" || p.fm.type === "feature";
    if (teach && !p.fm.chapters.length && !inbound.has(p.fm.id)) {
      problems.push({ file: p.file, rule: "orphan", message: "没有章节归属，也没有任何页链接到它" });
    }
  }
  for (const t of opts.requiredTerms ?? []) {
    if (!ids.has(t)) problems.push({ file: "src/sim/model/forwardLayer.ts", rule: "missing-term", message: `Step.terms 引用的 ${t} 没有页面` });
  }
  return problems;
}

const LOG_H2 = /^## \[\d{4}-\d{2}-\d{2}\] (ingest|build|review) \| .+$/;

export function lintLog(text: string): PageProblem[] {
  const out: PageProblem[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.startsWith("## ") && !LOG_H2.test(line)) {
      out.push({ file: "log.md", rule: "log-format", message: `第 ${i + 1} 行：${line}` });
    }
  });
  return out;
}

export function collectStepTerms(): string[] {
  const tl = buildLayerTimeline(getPresetSpec("qwen3-0.6b"), getTokenPreset());
  return [...new Set(tl.steps.flatMap((s) => s.terms))].sort();
}

export function runLint(rootDir: string, flags: { terms: boolean }): PageProblem[] {
  const wikiRoot = join(rootDir, "wiki");
  const { pages, problems } = loadPages(wikiRoot);
  const opts: LintOptions = { chapterIds: CHAPTER_IDS, existsFile: (rel) => existsSync(join(wikiRoot, rel)) };
  if (flags.terms) opts.requiredTerms = collectStepTerms();
  const logPath = join(wikiRoot, "log.md");
  const logProblems = existsSync(logPath) ? lintLog(readFileSync(logPath, "utf8")) : [];
  return [...problems, ...lintPages(pages, opts), ...logProblems];
}
```

`scripts/wiki-lint.ts`：

```typescript
import { runLint } from "./wiki/lint";

const problems = runLint(process.cwd(), { terms: process.argv.includes("--terms") });
for (const p of problems) console.error(`x ${p.file} [${p.rule}] ${p.message}`);
if (problems.length) {
  console.error(`\nwiki:lint 失败：${problems.length} 处`);
  process.exit(1);
}
console.log("ok wiki:lint 通过");
```

`scripts/check-content.ts` 改为：

```typescript
/**
 * 内容校验：wiki registry 结构合法；章节出现后再校验 Term / Evidence / Lab 引用（PLAN M1 任务 10）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { registrySchema } from "../src/content/wiki/schema";

const registryPath = join(process.cwd(), "src/content/wiki/registry.json");
if (existsSync(registryPath)) {
  const r = registrySchema.safeParse(JSON.parse(readFileSync(registryPath, "utf8")));
  if (!r.success) {
    console.error(`x registry.json 不合法：${r.error.issues[0]?.message}`);
    process.exit(1);
  }
  console.log(`ok 内容校验：registry ${r.data.pages.length} 页`);
}
const chaptersDir = join(process.cwd(), "src/content/chapters");
if (!existsSync(chaptersDir)) {
  console.log("ok 内容校验：尚无章节，Term 引用检查跳过");
  process.exit(0);
}
console.log("ok 内容校验通过（占位）");
```

`package.json`：

```json
"wiki:lint": "tsx scripts/wiki-lint.ts",
"check": "pnpm typecheck && pnpm lint && pnpm test && pnpm check:deps && pnpm check:content && pnpm wiki:lint",
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/wiki/lint.test.ts && pnpm check`
Expected: PASS (8 tests)；`pnpm check` 全绿（wiki 此时 0 页，lint 通过）。

**Step 4b: AC2 红灯实证**（不提交产物）

```bash
mkdir -p wiki/concepts
printf -- '---\nid: bad\ntitle: Bad\ntype: concept\nsummary: s\nchapters: ["11"]\nsources: []\nevidence: "C"\nupdated: "2026-09-07"\n---\n[x](nope.md)\n' > wiki/concepts/bad.md
pnpm wiki:lint; echo exit=$?
rm wiki/concepts/bad.md
```
Expected: 输出含 `x concepts/bad.md [schema] sources: sources 不得为空`，`exit=1`。（断链在 schema 失败时不再单独报，属预期：先修 frontmatter。）

**Step 5: Commit**

```bash
git add scripts/wiki/lint.ts scripts/wiki/lint.test.ts scripts/wiki-lint.ts scripts/check-content.ts package.json
git commit -m "feat(F001): wiki:lint rules wired into pnpm check; check-content validates registry"
```

---

### Task 6: ingest · 种子 schema 与 prompt 构造（纯函数）

**Files:**
- Create: `scripts/wiki/ingest.ts`
- Test: `scripts/wiki/ingest.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import type { HandbookSlices } from "./handbook";
import { extractRequest, integrateRequest, parseSeeds } from "./ingest";

const seedsYaml = `
repos:
  vllm-ascend:
    url: https://github.com/vllm-project/vllm-ascend
    commit: 28bf3a2e
    path: tools/repos/vllm-ascend
features:
  - id: paged-attention
    title: PagedAttention
    type: feature
    chapters: ["11"]
    repo: vllm-ascend
    entry: [vllm_ascend/attention/attention_v1.py]
    ask: 块级 KV 布局与 block table 如何进入 attention 算子
`;
const hb: HandbookSlices = { pageFormat: "PF", extract: "EX", integrate: "IN", query: "Q", lint: "L", human: "H" };
const ctx = { handbook: hb, wikiRoot: "C:/w/wiki", repoRoots: { "vllm-ascend": "C:/w/tools/repos/vllm-ascend" }, today: "2026-09-07", timeoutMs: 1000, batchIds: ["paged-attention", "block-table"] };

describe("parseSeeds", () => {
  it("解析并校验；feature.repo 必须在 repos 里；priority 默认 2", () => {
    const s = parseSeeds(seedsYaml);
    expect(s.features[0]?.priority).toBe(2);
    expect(() => parseSeeds(seedsYaml.replace("repo: vllm-ascend", "repo: nope"))).toThrow(/nope/);
  });
});

describe("extractRequest", () => {
  it("argv：stream-json、系统提示=页面格式+提取、add-dir、白名单只含两个 Write 路径、黑名单含 Bash", () => {
    const s = parseSeeds(seedsYaml);
    const req = extractRequest(s.features[0]!, s, ctx);
    expect(req.cwd).toBe("C:/w/wiki");
    expect(req.args.slice(0, 4)).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
    expect(req.args[req.args.indexOf("--append-system-prompt") + 1]).toBe("PF\n\nEX");
    expect(req.args[req.args.indexOf("--add-dir") + 1]).toBe("C:/w/tools/repos/vllm-ascend");
    const allowed = req.args.slice(req.args.indexOf("--allowedTools") + 1, req.args.indexOf("--disallowedTools"));
    expect(allowed).toEqual(["Read", "Grep", "Glob", "Write(_drafts/paged-attention.md)", "Write(raw/paged-attention.md)"]);
    expect(req.args.slice(req.args.indexOf("--disallowedTools") + 1)).toContain("Bash");
    expect(req.allowedWrites).toEqual(["_drafts/paged-attention.md", "raw/paged-attention.md"]);
  });
  it("stdin 含 id、commit、入口、ask、今天日期、本批 id、两个允许路径", () => {
    const s = parseSeeds(seedsYaml);
    const { stdin } = extractRequest(s.features[0]!, s, ctx);
    for (const t of ["paged-attention", "28bf3a2e", "vllm_ascend/attention/attention_v1.py", "block table", "2026-09-07", "block-table", "_drafts/paged-attention.md", "raw/paged-attention.md"]) {
      expect(stdin).toContain(t);
    }
    expect(stdin).not.toContain("PF"); // 系统提示不重复塞进 stdin
  });
});

describe("integrateRequest", () => {
  it("白名单：concepts/** 写与编辑、决策文件；stdin 列草稿 id", () => {
    const req = integrateRequest(["a", "b"], ctx);
    const allowed = req.args.slice(req.args.indexOf("--allowedTools") + 1, req.args.indexOf("--disallowedTools"));
    expect(allowed).toEqual(["Read", "Grep", "Glob", "Write(concepts/**)", "Edit(concepts/**)", "Write(_drafts/_integration.json)"]);
    expect(req.args[req.args.indexOf("--append-system-prompt") + 1]).toBe("PF\n\nIN");
    expect(req.stdin).toContain("_drafts/a.md");
    expect(req.allowedWrites).toEqual(["concepts/**", "_drafts/_integration.json"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/wiki/ingest.test.ts`
Expected: FAIL — Cannot find module './ingest'

**Step 3: Write minimal implementation**

`scripts/wiki/ingest.ts`（本 task 只含种子与 prompt 部分；Task 7 追加执行部分）：

```typescript
/**
 * ingest 引擎的纯函数部分：种子清单 schema、两类 agent 请求的构造、stream-json 解析、快照差集、并发池。
 * 真正 spawn 在 claude-cli.ts；入口在 scripts/wiki-ingest.ts。
 */
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ID_RE, PAGE_TYPES } from "../../src/content/wiki/schema";
import type { HandbookSlices } from "./handbook";

export const seedsSchema = z
  .object({
    repos: z.record(
      z.object({
        url: z.string().url(),
        commit: z.string().regex(/^[0-9a-f]{7,40}$/),
        /** 相对仓库根 */
        path: z.string().min(1),
      }),
    ),
    features: z.array(
      z.object({
        id: z.string().regex(ID_RE),
        title: z.string().min(1),
        type: z.enum(PAGE_TYPES),
        chapters: z.array(z.string().regex(/^\d{2}$/)).min(1),
        priority: z.number().int().min(1).max(3).default(2),
        repo: z.string(),
        entry: z.array(z.string().min(1)).min(1),
        ask: z.string().min(1),
      }),
    ),
  })
  .superRefine((s, ctx) => {
    for (const f of s.features) {
      if (!s.repos[f.repo]) ctx.addIssue({ code: "custom", message: `feature ${f.id} 的 repo「${f.repo}」不在 repos 里` });
    }
    const seen = new Set<string>();
    for (const f of s.features) {
      if (seen.has(f.id)) ctx.addIssue({ code: "custom", message: `feature id 重复：${f.id}` });
      seen.add(f.id);
    }
  });
export type Seeds = z.infer<typeof seedsSchema>;
export type SeedFeature = Seeds["features"][number];

export function parseSeeds(text: string): Seeds {
  return seedsSchema.parse(parseYaml(text));
}

export interface IngestContext {
  handbook: HandbookSlices;
  wikiRoot: string;
  /** repo 名 → 绝对路径 */
  repoRoots: Record<string, string>;
  today: string;
  timeoutMs: number;
  /** 本批全部 feature id，供 related 参考 */
  batchIds: string[];
}

export interface AgentRequest {
  id: string;
  cwd: string;
  args: string[];
  stdin: string;
  timeoutMs: number;
  /** 相对 cwd 的允许写路径（glob），供越界检查 */
  allowedWrites: string[];
}

const DISALLOWED = ["Bash", "Edit", "MultiEdit", "NotebookEdit", "WebFetch", "WebSearch", "Task", "Agent"];

function baseArgs(system: string): string[] {
  return ["-p", "--output-format", "stream-json", "--verbose", "--append-system-prompt", system, "--max-turns", "80"];
}

export function extractRequest(f: SeedFeature, seeds: Seeds, ctx: IngestContext): AgentRequest {
  const repo = seeds.repos[f.repo];
  if (!repo) throw new Error(`repo ${f.repo} 未定义`);
  const repoRoot = ctx.repoRoots[f.repo];
  if (!repoRoot) throw new Error(`repo ${f.repo} 没有本地路径`);
  const draft = `_drafts/${f.id}.md`;
  const raw = `raw/${f.id}.md`;
  const args = [
    ...baseArgs(`${ctx.handbook.pageFormat.trim()}\n\n${ctx.handbook.extract.trim()}`),
    "--add-dir", repoRoot,
    "--allowedTools", "Read", "Grep", "Glob", `Write(${draft})`, `Write(${raw})`,
    "--disallowedTools", ...DISALLOWED,
  ];
  const stdin = [
    `任务：为 feature「${f.title}」写一页 wiki 草稿。`,
    "",
    `- id: ${f.id}`,
    `- type: ${f.type}`,
    `- chapters: ${JSON.stringify(f.chapters)}`,
    `- updated: "${ctx.today}"`,
    `- 来源仓库：${f.repo}@${repo.commit}，本地只读路径 ${repoRoot}`,
    `- sources 写法：${f.repo}@${repo.commit}:<相对路径>#L起-L止`,
    `- 入口文件：${f.entry.join("、")}`,
    `- 要回答的问题：${f.ask}`,
    `- 本批其它 feature id（related 可引用）：${ctx.batchIds.filter((x) => x !== f.id).join(", ") || "无"}`,
    "",
    `只允许写这两个文件（相对当前目录）：${draft}、${raw}。写完回复 DONE ${f.id} sources=<数量>。`,
  ].join("\n");
  return { id: f.id, cwd: ctx.wikiRoot, args, stdin, timeoutMs: ctx.timeoutMs, allowedWrites: [draft, raw] };
}

export function integrateRequest(draftIds: string[], ctx: IngestContext): AgentRequest {
  const args = [
    ...baseArgs(`${ctx.handbook.pageFormat.trim()}\n\n${ctx.handbook.integrate.trim()}`),
    "--allowedTools", "Read", "Grep", "Glob", "Write(concepts/**)", "Edit(concepts/**)", "Write(_drafts/_integration.json)",
    "--disallowedTools", ...DISALLOWED.filter((t) => t !== "Edit"),
  ];
  const stdin = [
    `任务：整合 ${draftIds.length} 份草稿进 concepts/。今天是 ${ctx.today}。`,
    "",
    "草稿文件：",
    ...draftIds.map((id) => `- _drafts/${id}.md`),
    "",
    "按「整合」规则处理，写 _drafts/_integration.json，回复 DONE integrate promoted=<n> merged=<n> rejected=<n>。",
  ].join("\n");
  return { id: "_integrate", cwd: ctx.wikiRoot, args, stdin, timeoutMs: ctx.timeoutMs, allowedWrites: ["concepts/**", "_drafts/_integration.json"] };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/wiki/ingest.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add scripts/wiki/ingest.ts scripts/wiki/ingest.test.ts
git commit -m "feat(F001): ingest seeds schema and agent request builders"
```

---

### Task 7: ingest · stream-json 解析、快照差集、并发池、批执行

**Files:**
- Modify: `scripts/wiki/ingest.ts`（追加）
- Test: `scripts/wiki/ingest.test.ts`（追加）

**Step 1: Write the failing test**（追加）

```typescript
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyIntegration, diffSnapshot, parseStreamJsonLine, runExtractPhase, runPool, snapshotDir, strayPaths, type AgentResult, type RunAgent } from "./ingest";

describe("parseStreamJsonLine", () => {
  it("取 tool_use 名称与目标、result 的 session/cost/is_error；其它返回 null", () => {
    expect(parseStreamJsonLine(JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "a.py" } }] } })))
      .toEqual({ kind: "tool", name: "Read", target: "a.py" });
    expect(parseStreamJsonLine(JSON.stringify({ type: "result", subtype: "success", is_error: false, session_id: "s1", total_cost_usd: 0.5 })))
      .toEqual({ kind: "result", isError: false, sessionId: "s1", costUsd: 0.5 });
    expect(parseStreamJsonLine("not json")).toBeNull();
    expect(parseStreamJsonLine(JSON.stringify({ type: "user" }))).toBeNull();
  });
});

describe("snapshot / stray", () => {
  it("差集只含新增或改动的文件；允许 glob 与精确路径", () => {
    const root = mkdtempSync(join(tmpdir(), "snap-"));
    mkdirSync(join(root, "_drafts"));
    writeFileSync(join(root, "index.md"), "old");
    const before = snapshotDir(root);
    writeFileSync(join(root, "_drafts/a.md"), "x");
    writeFileSync(join(root, "index.md"), "changed!");
    const changed = diffSnapshot(before, snapshotDir(root)).sort();
    expect(changed).toEqual(["_drafts/a.md", "index.md"]);
    expect(strayPaths(changed, ["_drafts/a.md", "raw/a.md"])).toEqual(["index.md"]);
    expect(strayPaths(["concepts/x.md", "_drafts/_integration.json"], ["concepts/**", "_drafts/_integration.json"])).toEqual([]);
  });
});

describe("runPool", () => {
  it("并发不超过上限，结果按输入顺序", async () => {
    let active = 0;
    let peak = 0;
    const r = await runPool([1, 2, 3, 4, 5], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((res) => setTimeout(res, 5));
      active--;
      return n * 10;
    });
    expect(r).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });
});

describe("runExtractPhase", () => {
  const setup = () => {
    const root = mkdtempSync(join(tmpdir(), "wiki-"));
    for (const d of ["_drafts", "raw", "concepts"]) mkdirSync(join(root, d));
    return root;
  };
  const feat = (id: string) => ({ id, title: id, type: "feature" as const, chapters: ["11"], priority: 2, repo: "r", entry: ["a.py"], ask: "?" });
  const seeds = { repos: { r: { url: "https://x", commit: "28bf3a2e", path: "tools/repos/r" } }, features: [feat("a"), feat("b"), feat("c")] };
  const mkCtx = (root: string) => ({ handbook: hb, wikiRoot: root, repoRoots: { r: "/r" }, today: "2026-09-07", timeoutMs: 100, batchIds: ["a", "b", "c"] });
  const good = (id: string) => `---\nid: ${id}\ntitle: ${id}\ntype: feature\nsummary: s\nchapters: ["11"]\nsources: [r@28bf3a2e:a.py#L1-L2]\nevidence: "C"\nupdated: "2026-09-07"\n---\n## 是什么\nx\n`;

  it("成功的写草稿；失败的记 _failures.json；越界写判失败；草稿 frontmatter 不合法判失败", async () => {
    const root = setup();
    const calls: string[] = [];
    const runAgent: RunAgent = async (req) => {
      calls.push(req.id);
      if (req.id === "a") writeFileSync(join(root, "_drafts/a.md"), good("a"));
      if (req.id === "b") {
        writeFileSync(join(root, "_drafts/b.md"), good("b"));
        writeFileSync(join(root, "concepts/evil.md"), "越界");
      }
      if (req.id === "c") writeFileSync(join(root, "_drafts/c.md"), "---\nid: c\n---\n");
      const r: AgentResult = { id: req.id, ok: true, exitCode: 0, sessionId: `s-${req.id}`, stderrTail: "" };
      return r;
    };
    const out = await runExtractPhase(seeds.features, seeds, mkCtx(root), { runAgent, concurrency: 2, log: () => {} });
    expect(calls.sort()).toEqual(["a", "b", "c"]);
    expect(out.succeeded).toEqual(["a"]);
    expect(Object.keys(out.failures).sort()).toEqual(["b", "c"]);
    expect(out.failures.b?.reason).toContain("concepts/evil.md");
    expect(out.failures.c?.reason).toContain("schema");
    const saved = JSON.parse(readFileSync(join(root, "_drafts/_failures.json"), "utf8"));
    expect(saved.b.sessionId).toBe("s-b");
  });
  it("agent 返回 ok=false 也记失败，且不阻塞其它", async () => {
    const root = setup();
    const runAgent: RunAgent = async (req) => {
      if (req.id === "a") writeFileSync(join(root, "_drafts/a.md"), good("a"));
      return { id: req.id, ok: req.id === "a", exitCode: req.id === "a" ? 0 : 1, reason: "timeout", stderrTail: "" };
    };
    const out = await runExtractPhase(seeds.features, seeds, mkCtx(root), { runAgent, concurrency: 3, log: () => {} });
    expect(out.succeeded).toEqual(["a"]);
    expect(out.failures.b?.reason).toBe("timeout");
  });
});

describe("applyIntegration", () => {
  it("promoted 且 concepts 存在 → 删草稿、写 log 行；merged 删草稿；rejected 保留；promoted 但 concepts 缺 → problem", () => {
    const root = mkdtempSync(join(tmpdir(), "wiki-"));
    for (const d of ["_drafts", "concepts"]) mkdirSync(join(root, d));
    for (const id of ["a", "b", "c", "d"]) writeFileSync(join(root, `_drafts/${id}.md`), `---\nid: ${id}\ntitle: T${id}\n---\n`);
    writeFileSync(join(root, "concepts/a.md"), "---\nid: a\ntitle: Ta\n---\n");
    const r = applyIntegration(root, { promoted: ["a", "d"], merged: [{ from: "b", into: "a" }], rejected: [{ id: "c", reason: "空" }], contradictions: [] }, "2026-09-07");
    expect(existsSync(join(root, "_drafts/a.md"))).toBe(false);
    expect(existsSync(join(root, "_drafts/b.md"))).toBe(false);
    expect(existsSync(join(root, "_drafts/c.md"))).toBe(true);
    expect(existsSync(join(root, "_drafts/d.md"))).toBe(true);
    expect(r.problems[0]).toContain("d");
    expect(readFileSync(join(root, "log.md"), "utf8")).toContain("## [2026-09-07] ingest | Ta");
    expect(readFileSync(join(root, "log.md"), "utf8")).toContain("merged b → a");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/wiki/ingest.test.ts`
Expected: FAIL — parseStreamJsonLine is not exported

**Step 3: Write minimal implementation**（追加到 `scripts/wiki/ingest.ts`）

```typescript
import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, posix, relative } from "node:path";
import { parsePage } from "./pages";

export type AgentEvent =
  | { kind: "tool"; name: string; target?: string }
  | { kind: "result"; isError: boolean; sessionId?: string; costUsd?: number };

export interface AgentResult {
  id: string;
  ok: boolean;
  exitCode: number | null;
  sessionId?: string;
  costUsd?: number;
  reason?: string;
  stderrTail: string;
}
export type RunAgent = (req: AgentRequest, onEvent?: (e: AgentEvent) => void) => Promise<AgentResult>;

export function parseStreamJsonLine(line: string): AgentEvent | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (obj.type === "assistant") {
    const msg = obj.message as { content?: { type: string; name?: string; input?: Record<string, unknown> }[] } | undefined;
    const tool = msg?.content?.find((c) => c.type === "tool_use");
    if (!tool?.name) return null;
    const input = tool.input ?? {};
    const target = (input.file_path ?? input.pattern ?? input.path) as string | undefined;
    return target !== undefined ? { kind: "tool", name: tool.name, target } : { kind: "tool", name: tool.name };
  }
  if (obj.type === "result") {
    const e: AgentEvent = { kind: "result", isError: Boolean(obj.is_error) };
    if (typeof obj.session_id === "string") e.sessionId = obj.session_id;
    if (typeof obj.total_cost_usd === "number") e.costUsd = obj.total_cost_usd;
    return e;
  }
  return null;
}

// ---------- 快照与越界 ----------

export type Snapshot = Map<string, string>;

export function snapshotDir(root: string): Snapshot {
  const out: Snapshot = new Map();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs);
      else out.set(relative(root, abs).replace(/\\/g, "/"), `${st.mtimeMs}:${st.size}`);
    }
  };
  walk(root);
  return out;
}

export function diffSnapshot(before: Snapshot, after: Snapshot): string[] {
  const changed: string[] = [];
  for (const [p, sig] of after) if (before.get(p) !== sig) changed.push(p);
  return changed;
}

function globToRe(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${esc}$`);
}

export function strayPaths(changed: string[], allowed: Iterable<string>): string[] {
  const res = [...allowed].map(globToRe);
  return changed.filter((p) => !res.some((re) => re.test(p)));
}

// ---------- 并发池 ----------

export async function runPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
  return results;
}

// ---------- 扇出提取 ----------

export interface FailureRecord {
  at: string;
  reason: string;
  sessionId?: string;
  stderrTail?: string;
}
export type Failures = Record<string, FailureRecord>;

export const FAILURES_FILE = "_drafts/_failures.json";

export function readFailures(wikiRoot: string): Failures {
  const p = join(wikiRoot, FAILURES_FILE);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Failures) : {};
}

export function writeFailures(wikiRoot: string, failures: Failures): void {
  writeFileSync(join(wikiRoot, FAILURES_FILE), `${JSON.stringify(failures, null, 2)}\n`);
}

export interface ExtractDeps {
  runAgent: RunAgent;
  concurrency: number;
  log: (line: string) => void;
}

export async function runExtractPhase(
  features: SeedFeature[],
  seeds: Seeds,
  ctx: IngestContext,
  deps: ExtractDeps,
): Promise<{ succeeded: string[]; failures: Failures }> {
  const before = snapshotDir(ctx.wikiRoot);
  const allowedAll = new Set<string>([FAILURES_FILE]);
  const requests = features.map((f) => extractRequest(f, seeds, ctx));
  for (const r of requests) for (const w of r.allowedWrites) allowedAll.add(w);

  const failures: Failures = readFailures(ctx.wikiRoot);
  const succeeded: string[] = [];
  const results = await runPool(requests, deps.concurrency, async (req) => {
    deps.log(`▶ ${req.id}`);
    const r = await deps.runAgent(req, (e) => {
      if (e.kind === "tool") deps.log(`  ${req.id}: ${e.name} ${e.target ?? ""}`);
    });
    deps.log(`${r.ok ? "✓" : "✗"} ${req.id}${r.reason ? ` (${r.reason})` : ""}`);
    return r;
  });

  const stray = strayPaths(diffSnapshot(before, snapshotDir(ctx.wikiRoot)), allowedAll);
  for (const p of stray) rmSync(join(ctx.wikiRoot, p), { force: true });

  for (const r of results) {
    const draftPath = join(ctx.wikiRoot, `_drafts/${r.id}.md`);
    let reason = r.ok ? undefined : (r.reason ?? `exit ${r.exitCode}`);
    if (!reason && stray.length) reason = `本批出现越界写入，已删除：${stray.join(", ")}`;
    if (!reason && !existsSync(draftPath)) reason = "agent 结束但没有产出草稿";
    if (!reason) {
      const parsed = parsePage(`_drafts/${r.id}.md`, readFileSync(draftPath, "utf8"));
      if (parsed.problems.length) reason = parsed.problems.map((p) => `[${p.rule}] ${p.message}`).join("；");
    }
    if (reason) {
      const rec: FailureRecord = { at: new Date().toISOString(), reason, stderrTail: r.stderrTail };
      if (r.sessionId) rec.sessionId = r.sessionId;
      failures[r.id] = rec;
    } else {
      delete failures[r.id];
      succeeded.push(r.id);
    }
  }
  writeFailures(ctx.wikiRoot, failures);
  return { succeeded, failures };
}

// ---------- 整合决策 ----------

export const integrationSchema = z.object({
  promoted: z.array(z.string()),
  merged: z.array(z.object({ from: z.string(), into: z.string() })),
  rejected: z.array(z.object({ id: z.string(), reason: z.string() })),
  contradictions: z.array(z.object({ a: z.string(), b: z.string(), note: z.string() })).default([]),
});
export type Integration = z.infer<typeof integrationSchema>;

function titleOf(wikiRoot: string, rel: string): string {
  const p = join(wikiRoot, rel);
  if (!existsSync(p)) return rel;
  const m = /^title:\s*(.+)$/m.exec(readFileSync(p, "utf8"));
  return m?.[1]?.trim() ?? rel;
}

export function applyIntegration(wikiRoot: string, d: Integration, today: string): { problems: string[]; logLines: string[] } {
  const problems: string[] = [];
  const logLines: string[] = [];
  for (const id of d.promoted) {
    if (!existsSync(join(wikiRoot, `concepts/${id}.md`))) {
      problems.push(`promoted ${id} 但 concepts/${id}.md 不存在，草稿保留`);
      continue;
    }
    rmSync(join(wikiRoot, `_drafts/${id}.md`), { force: true });
    logLines.push(`## [${today}] ingest | ${titleOf(wikiRoot, `concepts/${id}.md`)}\n晋升 concepts/${id}.md\n`);
  }
  for (const m of d.merged) {
    rmSync(join(wikiRoot, `_drafts/${m.from}.md`), { force: true });
    logLines.push(`## [${today}] ingest | ${titleOf(wikiRoot, `concepts/${m.into}.md`)}\nmerged ${m.from} → ${m.into}\n`);
  }
  for (const c of d.contradictions) logLines.push(`## [${today}] review | 矛盾 ${c.a} vs ${c.b}\n${c.note}\n`);
  if (logLines.length) appendFileSync(join(wikiRoot, "log.md"), `${logLines.join("\n")}\n`);
  return { problems, logLines };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/wiki/ingest.test.ts && pnpm lint`
Expected: PASS (10 tests)；biome 无报错。

**Step 5: Commit**

```bash
git add scripts/wiki/ingest.ts scripts/wiki/ingest.test.ts
git commit -m "feat(F001): ingest fan-out runner with snapshot boundary check, failures ledger, integration apply"
```

---

### Task 8: claude CLI 运行器 + wiki-ingest 入口（含 --dry-run）

**Files:**
- Create: `scripts/wiki/claude-cli.ts`
- Create: `scripts/wiki-ingest.ts`
- Modify: `package.json`（`wiki:ingest`）
- Test: `scripts/wiki/claude-cli.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { resolveClaudeCommand } from "./claude-cli";

describe("resolveClaudeCommand", () => {
  it("顺序：CLAUDE_CLI 环境变量 → ~/.local/bin/claude(.exe) → 裸 claude（shell）", () => {
    expect(resolveClaudeCommand({ CLAUDE_CLI: "C:/x/claude.exe" }, () => true)).toEqual({ command: "C:/x/claude.exe", shell: false });
    const home = { USERPROFILE: "C:/Users/me" };
    expect(resolveClaudeCommand(home, (p) => p.endsWith("claude.exe"), "win32")).toEqual({ command: "C:/Users/me/.local/bin/claude.exe", shell: false });
    expect(resolveClaudeCommand({ HOME: "/home/me" }, (p) => p.endsWith("/claude"), "linux")).toEqual({ command: "/home/me/.local/bin/claude", shell: false });
    expect(resolveClaudeCommand({}, () => false)).toEqual({ command: "claude", shell: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/wiki/claude-cli.test.ts`
Expected: FAIL — Cannot find module './claude-cli'

**Step 3: Write minimal implementation**

`scripts/wiki/claude-cli.ts`（Windows 处理借自 Multi-Agent `runtime/claude-command.ts`、`base-runtime.ts:164,280`）：

```typescript
/**
 * spawn 本机 claude CLI 跑一次 -p。prompt 走 stdin（Windows argv 上限 32 KB），
 * stdout 按行解析 stream-json，超时用 taskkill /T /F 杀整树。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import type { AgentEvent, AgentRequest, AgentResult, RunAgent } from "./ingest";
import { parseStreamJsonLine } from "./ingest";

export interface ClaudeCommand {
  command: string;
  shell: boolean;
}

export function resolveClaudeCommand(
  env: NodeJS.ProcessEnv = process.env,
  exists: (p: string) => boolean = existsSync,
  platform: NodeJS.Platform = process.platform,
): ClaudeCommand {
  if (env.CLAUDE_CLI && exists(env.CLAUDE_CLI)) return { command: env.CLAUDE_CLI, shell: false };
  const home = env.USERPROFILE || env.HOME || "";
  const local = `${home.replace(/\\/g, "/")}/.local/bin/claude${platform === "win32" ? ".exe" : ""}`;
  if (home && exists(local)) return { command: local, shell: false };
  return { command: "claude", shell: true };
}

export function killTree(pid: number, platform: NodeJS.Platform = process.platform): void {
  if (platform === "win32") spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { shell: true, windowsHide: true });
  else process.kill(pid, "SIGKILL");
}

export const runClaude: RunAgent = (req: AgentRequest, onEvent?: (e: AgentEvent) => void) =>
  new Promise<AgentResult>((resolve) => {
    const cmd = resolveClaudeCommand();
    const child = spawn(cmd.command, req.args, { cwd: req.cwd, shell: cmd.shell, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let sessionId: string | undefined;
    let costUsd: number | undefined;
    let isError = false;
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) killTree(child.pid);
    }, req.timeoutMs);

    createInterface({ input: child.stdout }).on("line", (line) => {
      const e = parseStreamJsonLine(line);
      if (!e) return;
      if (e.kind === "result") {
        isError = e.isError;
        sessionId = e.sessionId;
        costUsd = e.costUsd;
      }
      onEvent?.(e);
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-2000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ id: req.id, ok: false, exitCode: null, reason: `spawn-error: ${err.message}`, stderrTail: stderr });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const base = { id: req.id, exitCode: code, stderrTail: stderr } as AgentResult;
      if (sessionId) base.sessionId = sessionId;
      if (costUsd !== undefined) base.costUsd = costUsd;
      if (timedOut) resolve({ ...base, ok: false, reason: `timeout ${req.timeoutMs}ms` });
      else if (code !== 0) resolve({ ...base, ok: false, reason: `exit ${code}` });
      else if (isError) resolve({ ...base, ok: false, reason: "result.is_error" });
      else resolve({ ...base, ok: true });
    });
    child.stdin.end(req.stdin, "utf8");
  });

/** --dry-run 用：把一次调用打印成可复制的命令行（stdin 另起一段） */
export function formatDryRun(req: AgentRequest): string {
  const cmd = resolveClaudeCommand();
  const q = (s: string) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
  return [`cd ${req.cwd}`, `${cmd.command} ${req.args.map(q).join(" ")}`, "--- stdin ---", req.stdin, "-------------"].join("\n");
}
```

`scripts/wiki-ingest.ts`：

```typescript
/**
 * pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml [--only a,b] [--skip-existing] [--retry-failed]
 *                  [--concurrency 3] [--timeout-min 20] [--phase extract|integrate|all] [--dry-run]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runBuild } from "./wiki/build";
import { formatDryRun, runClaude } from "./wiki/claude-cli";
import { loadHandbook } from "./wiki/handbook";
import { applyIntegration, extractRequest, type IngestContext, integrateRequest, integrationSchema, parseSeeds, readFailures, runExtractPhase } from "./wiki/ingest";
import { runLint } from "./wiki/lint";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const flag = (name: string) => process.argv.includes(name);

const root = process.cwd();
const wikiRoot = join(root, "wiki");
const seedsPath = arg("--seeds");
if (!seedsPath) {
  console.error("用法：pnpm wiki:ingest --seeds wiki/seeds/<name>.yaml [--only a,b] [--skip-existing] [--retry-failed] [--dry-run]");
  process.exit(2);
}
const seeds = parseSeeds(readFileSync(seedsPath, "utf8"));
const phase = arg("--phase", "all") as "extract" | "integrate" | "all";
const dryRun = flag("--dry-run");
const today = new Date().toISOString().slice(0, 10);

const repoRoots: Record<string, string> = {};
for (const [name, r] of Object.entries(seeds.repos)) {
  const abs = resolve(root, r.path);
  if (!dryRun && !existsSync(abs)) {
    console.error(`x 仓库 ${name} 不在 ${abs}，先跑 pnpm wiki:clone`);
    process.exit(2);
  }
  repoRoots[name] = abs;
}

let features = seeds.features;
const only = arg("--only");
if (only) features = features.filter((f) => only.split(",").includes(f.id));
if (flag("--retry-failed")) {
  const failed = Object.keys(readFailures(wikiRoot));
  features = features.filter((f) => failed.includes(f.id));
}
if (flag("--skip-existing")) {
  features = features.filter((f) => !existsSync(join(wikiRoot, `_drafts/${f.id}.md`)) && !existsSync(join(wikiRoot, `concepts/${f.id}.md`)));
}
features = [...features].sort((a, b) => a.priority - b.priority);

const ctx: IngestContext = {
  handbook: loadHandbook(wikiRoot),
  wikiRoot,
  repoRoots,
  today,
  timeoutMs: Number(arg("--timeout-min", "20")) * 60_000,
  batchIds: features.map((f) => f.id),
};

async function main() {
  if (phase !== "integrate") {
    if (dryRun) {
      for (const f of features) console.log(formatDryRun(extractRequest(f, seeds, ctx)));
    } else {
      const r = await runExtractPhase(features, seeds, ctx, { runAgent: runClaude, concurrency: Number(arg("--concurrency", "3")), log: (s) => console.log(s) });
      console.log(`提取完成：成功 ${r.succeeded.length}，失败 ${Object.keys(r.failures).length}（见 wiki/_drafts/_failures.json）`);
    }
  }
  if (phase !== "extract") {
    const draftIds = readdirSync(join(wikiRoot, "_drafts")).filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3));
    if (!draftIds.length) {
      console.log("没有草稿可整合");
      return;
    }
    const req = integrateRequest(draftIds, ctx);
    if (dryRun) {
      console.log(formatDryRun(req));
      return;
    }
    const r = await runClaude(req, (e) => e.kind === "tool" && console.log(`  integrate: ${e.name} ${e.target ?? ""}`));
    if (!r.ok) {
      console.error(`x 整合失败：${r.reason}`);
      process.exit(1);
    }
    const decision = integrationSchema.parse(JSON.parse(readFileSync(join(wikiRoot, "_drafts/_integration.json"), "utf8")));
    const applied = applyIntegration(wikiRoot, decision, today);
    for (const p of applied.problems) console.error(`x ${p}`);
    console.log(`整合完成：晋升 ${decision.promoted.length}，合并 ${decision.merged.length}，拒收 ${decision.rejected.length}，矛盾 ${decision.contradictions.length}`);
    const b = runBuild(root);
    console.log(`wiki:build ${b.pageCount} 页`);
    const problems = runLint(root, { terms: false });
    for (const p of problems) console.error(`x ${p.file} [${p.rule}] ${p.message}`);
    if (problems.length) process.exit(1);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

`package.json`：

```json
"wiki:ingest": "tsx scripts/wiki-ingest.ts",
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/wiki/claude-cli.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS (1 test)；typecheck、lint 通过。

**Step 5: Commit**

```bash
git add scripts/wiki/claude-cli.ts scripts/wiki/claude-cli.test.ts scripts/wiki-ingest.ts package.json
git commit -m "feat(F001): claude CLI runner and wiki:ingest entry with dry-run"
```

---

### Task 9 · Spike W1：`Write(路径)` 权限规则在 `-p` 下是否按路径生效（限时 15 分钟，一次真实调用）

**产出是决策，不是交付物。**

```bash
cd wiki && mkdir -p _drafts raw
printf '请依次做两件事：1) 用 Write 工具把内容 "ok" 写到 _drafts/spike.md；2) 用 Write 工具把内容 "bad" 写到 concepts/spike.md。两件都尝试后，报告每一步工具是否被允许。' \
 | ~/.local/bin/claude -p --output-format json --allowedTools Read "Write(_drafts/spike.md)" --disallowedTools Bash Edit --max-turns 6
ls _drafts concepts; rm -f _drafts/spike.md concepts/spike.md; cd ..
```

判定：
- `_drafts/spike.md` 存在且 `concepts/spike.md` 不存在 → 规则按路径生效，D1 成立，Task 6 的 argv 保持。
- 两个都存在 → 路径规则不生效：Task 6 改为裸 `Write`，越界防线只剩快照检查（Task 7 已实现），并在 feature doc 的 Design Decisions 记录。
- 两个都不存在 → 语法未被识别；试 `Write(./_drafts/spike.md)` 与 `Write(**/_drafts/*)` 各一次，仍不行则同上退化。

记录结果到 `docs/features/F001-llm-wiki.md` Design Decisions 表（D1 行）。

---

### Task 10: 浅克隆 vllm-ascend，钉 commit

**Files:**
- Create: `scripts/wiki-clone.ts`
- Modify: `.gitignore`（`tools/repos/`）
- Modify: `package.json`（`wiki:clone`）

**Step 1**：`.gitignore` 追加：

```
# wiki ingest 的源码仓库（浅克隆，钉 seeds/*.yaml 的 commit）
tools/repos/
```

**Step 2**：`scripts/wiki-clone.ts`：

```typescript
/**
 * pnpm wiki:clone --seeds wiki/seeds/vllm-ascend.yaml
 * 按种子里的 repos 浅克隆到 tools/repos/<name> 并 checkout 钉住的 commit。已存在则只校验 HEAD。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseSeeds } from "./wiki/ingest";

const i = process.argv.indexOf("--seeds");
const seedsPath = process.argv[i + 1];
if (i < 0 || !seedsPath) {
  console.error("用法：pnpm wiki:clone --seeds wiki/seeds/<name>.yaml");
  process.exit(2);
}
const git = (args: string[], cwd?: string) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
const seeds = parseSeeds(readFileSync(seedsPath, "utf8"));
for (const [name, r] of Object.entries(seeds.repos)) {
  const dir = resolve(process.cwd(), r.path);
  if (!existsSync(dir)) {
    mkdirSync(dirname(dir), { recursive: true });
    console.log(`克隆 ${name} ← ${r.url}`);
    git(["clone", "--filter=blob:none", "--no-checkout", r.url, dir]);
    git(["fetch", "--depth", "1", "origin", r.commit], dir);
    git(["checkout", "--detach", r.commit], dir);
  }
  const head = git(["rev-parse", "HEAD"], dir);
  if (!head.startsWith(r.commit)) {
    console.error(`x ${name} HEAD ${head.slice(0, 8)} ≠ 钉住的 ${r.commit}`);
    process.exit(1);
  }
  console.log(`ok ${name} @ ${head.slice(0, 8)} → ${dir}`);
}
```

`package.json`：`"wiki:clone": "tsx scripts/wiki-clone.ts"`。

**Step 3**：先写 Task 11 的种子文件（至少 repos 段），再跑：

Run: `pnpm wiki:clone --seeds wiki/seeds/vllm-ascend.yaml`
Expected: `ok vllm-ascend @ 28bf3a2e → …/tools/repos/vllm-ascend`；`git status` 不显示 `tools/repos/`。

**Step 4: Commit**

```bash
git add .gitignore scripts/wiki-clone.ts package.json
git commit -m "feat(F001): wiki:clone pins source repos under tools/repos"
```

---

### Task 11: 试点种子 `wiki/seeds/vllm-ascend.yaml`（11 章 KV Cache 组）

**Files:**
- Create: `wiki/seeds/vllm-ascend.yaml`

**Step 1**：先写 repos 段 + 十个 feature 的 id/title/ask，`entry` 先填候选路径；克隆完成后用下面的命令校正每个 entry 确实存在并指向定义处：

```bash
cd tools/repos/vllm-ascend
ls vllm_ascend/attention vllm_ascend/worker vllm_ascend/distributed
grep -rln "block_table\|block_tables" vllm_ascend | head
grep -rln "prefix_cach\|enable_prefix_caching" vllm_ascend docs | head
grep -rln "kv_pool\|KVPool\|kv_cache_pool" vllm_ascend docs | head
grep -rln "cpu_offload\|CPUOffload\|offload" vllm_ascend docs | head
grep -rln "layerwise\|sparse.*offload" vllm_ascend docs | head
grep -rln "determine_available_memory\|get_kv_cache_spec" vllm_ascend | head
grep -rln "kv_cache_dtype\|int8.*kv" vllm_ascend docs | head
cd ../../..
```

**Step 2**：种子文件（entry 以校正结果为准）：

```yaml
# 11 章 KV Cache 内存系统 · 试点批。跑法：pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml
repos:
  vllm-ascend:
    url: https://github.com/vllm-project/vllm-ascend
    commit: 28bf3a2e            # PLAN.md 事实基线，2026-08-29 核验
    path: tools/repos/vllm-ascend

features:
  - id: paged-attention
    title: PagedAttention
    type: feature
    chapters: ["11"]
    priority: 1
    repo: vllm-ascend
    entry: [vllm_ascend/attention/attention_v1.py]
    ask: 昇腾后端的 attention 算子如何按 block 读 KV Cache；block_size 与 KV 布局（形状、dtype）是什么；与 vLLM 上游 PagedAttention 的差异。
  - id: block-table
    title: Block Table
    type: concept
    chapters: ["11"]
    priority: 1
    repo: vllm-ascend
    entry: [vllm_ascend/attention/attention_v1.py, vllm_ascend/worker/model_runner_v1.py]
    ask: block table 的形状、如何从请求的逻辑 block 映射到物理 block、每步 decode 时怎样更新并传给算子。
  - id: kv-cache-spec
    title: KV Cache Spec
    type: feature
    chapters: ["11"]
    priority: 1
    repo: vllm-ascend
    entry: [vllm_ascend/worker/model_runner_v1.py]
    ask: get_kv_cache_spec 如何按层声明 KV Cache 的 block 形状与字节数；每 token 每层 KV 字节的计算公式。
  - id: kv-cache-memory-profiling
    title: KV Cache Memory Profiling
    type: feature
    chapters: ["11"]
    priority: 1
    repo: vllm-ascend
    entry: [vllm_ascend/worker/worker_v1.py]
    ask: determine_available_memory 如何用 profile run 决定可分配给 KV Cache 的 HBM 字节数；gpu_memory_utilization 在昇腾上的语义。
  - id: prefix-caching
    title: Prefix Caching
    type: feature
    chapters: ["11"]
    priority: 1
    repo: vllm-ascend
    entry: [vllm_ascend/worker/model_runner_v1.py, docs/source/user_guide]
    ask: 前缀缓存在昇腾后端如何启用、命中时跳过哪些计算、与 chunked prefill 的关系；哈希以 block 为单位的依据。
  - id: kv-pool
    title: KV Pool
    type: feature
    chapters: ["11"]
    priority: 2
    repo: vllm-ascend
    entry: [vllm_ascend/distributed]
    ask: KV Pool 是什么、解决什么问题、KV 在池与 HBM 之间怎么搬、配置项与限制。
  - id: kv-cache-cpu-offload
    title: KV Cache CPU Offload
    type: feature
    chapters: ["11"]
    priority: 2
    repo: vllm-ascend
    entry: [vllm_ascend/distributed, docs/source/user_guide]
    ask: 把 KV Cache 卸载到 CPU 内存的机制、触发条件、搬运路径与带宽代价、配置项。
  - id: kv-cache-layerwise-offload
    title: Layerwise KV Offload
    type: feature
    chapters: ["11"]
    priority: 2
    repo: vllm-ascend
    entry: [vllm_ascend/distributed]
    ask: 逐层卸载与逐层传输的实现：按层粒度的搬运如何与前向重叠、涉及的 stream 与同步点。
  - id: kv-cache-sparse-offload
    title: Sparse KV Offload
    type: feature
    chapters: ["11"]
    priority: 3
    repo: vllm-ascend
    entry: [vllm_ascend/distributed, vllm_ascend/attention]
    ask: 稀疏卸载保留哪些 token 的 KV、选择依据、对精度与吞吐的影响；若源码里没有明确实现就回复 FAIL。
  - id: kv-cache-quantization
    title: KV Cache Quantization
    type: feature
    chapters: ["11", "17"]
    priority: 2
    repo: vllm-ascend
    entry: [vllm_ascend/quantization, vllm_ascend/attention/attention_v1.py]
    ask: kv_cache_dtype 支持哪些取值、int8 KV 的 scale 从哪来、attention 算子如何消费量化 KV。
```

**Step 3**：`pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml --dry-run | head -60`
Expected: 打印 10 段命令，每段 `--allowedTools` 只含本 feature 的两个 Write 路径，stdin 含 ask；末尾一段是 integrate 命令。

**Step 4: Commit**

```bash
git add wiki/seeds/vllm-ascend.yaml
git commit -m "feat(F001): pilot seeds for chapter 11 KV cache features"
```

---

### Task 12: 跑试点批 + 人审报告（AC4）

**Step 1**：提取（真实调用 10 次，默认并发 3，超时 20 分钟）：

```bash
pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml --phase extract
cat wiki/_drafts/_failures.json
git status --short wiki
```
Expected: `_drafts/` 与 `raw/` 各出现 ≤10 个文件；`git status` 只显示这些路径与 `_failures.json`；失败项（若有）用 `--retry-failed` 重跑一次。

**Step 2**：整合 + 派生 + lint：

```bash
pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml --phase integrate
cat wiki/_drafts/_integration.json
cat wiki/index.md
```
Expected: `concepts/` 出现晋升页，`index.md` 列出它们，lint 通过。

**Step 3**：人审报告（写到 `docs/plans/llm-wiki-pilot-review.md`，给用户看）：随机抽 3 页，每页列出 `sources` 每一项，用 `sed -n '<起>,<止>p' tools/repos/vllm-ascend/<path>` 贴出实际行，判定「行号对 / 行号偏 / 编造」；再对照 `raw/<id>.md` 是否与源码逐字一致。附：10 页 summary 一览、每页字数、失败清单、总花费（result 事件的 `total_cost_usd` 之和，打印在 ingest 日志里）。

**Step 4**：用户审阅。合格 → Commit；不合格 → 改 `wiki/HANDBOOK.md` 对应切片，`rm wiki/_drafts/*.md wiki/raw/*.md wiki/concepts/*.md`，重跑 Step 1–3。不进入 Phase 2。

```bash
git add wiki/ src/content/wiki/registry.json docs/plans/llm-wiki-pilot-review.md
git commit -m "feat(F001): pilot batch — chapter 11 KV cache pages from vllm-ascend@28bf3a2e"
```

---

### Task 13: 文档同步

- `PLAN.md`：新增「七、知识库与问答（F001）」段，指向 feature doc；§2.6 内容管线里 Term 注册表改为「由 `src/content/wiki/registry.json` 提供」。
- `HANDOFF.md`：「现状」加一段 wiki 骨架与试点批状态；「工作区约定」加 `tools/repos/`（可 `pnpm wiki:clone` 重建）。
- `README.md` 文档表加 `wiki/HANDBOOK.md`、`docs/features/`。
- `docs/features/F001-llm-wiki.md`：AC1–AC4 打勾，Timeline 加试点批日期与结果，Spike W1 结论进 Design Decisions。

```bash
git add PLAN.md HANDOFF.md README.md docs/
git commit -m "docs(F001): sync PLAN/HANDOFF/README with wiki skeleton and pilot result"
```

---

## Phase 2：批量灌种（AC5）

细化时机：Phase 1 试点验收通过后，按试点暴露的问题修订 HANDBOOK，再展开下面的任务。

### Task 14: 术语种子 `wiki/seeds/infer-lab-terms.yaml`

repos 加 `infer-lab`（url 本仓库、commit 取 `git rev-parse --short HEAD`、path `.`）。30 个 `Step.terms` id 各一条，`type: concept`，`entry` 指向 `src/sim/model/forwardLayer.ts` 与对应算子文件（`src/sim/tensor/ops.ts`），`chapters` 按术语出现的章（01/03/04/05），`ask` 要求写出 Qwen3-0.6B 的真实形状。ingest 时 `--add-dir` 指向本仓库 `src/sim`。

### Task 15: 特性种子分章补全

`wiki/seeds/vllm-ascend.yaml` 追加 10、12–21 章的特性（每章 8–15 条，来源 PLAN §1.1 各章列出的机制名 + `docs/source/user_guide/feature_guide` 目录下的文档页）。15 章的 64K 长序列两条路径与「current 禁配」标 `evidence: "!"`。

### Task 16: 分章执行

每章：`pnpm wiki:ingest --seeds … --only <该章 id 列表>` → 人抽查 2–3 页 → 下一章。最后 `pnpm wiki:lint --terms` 通过后，`package.json` 的 `wiki:lint` 改为带 `--terms`。

### Task 17: 术语页 ↔ 特性页交叉 related

整合阶段自然完成；最后跑一次 `--phase integrate` 让整合 agent 在全量页面上补双向 related 并列矛盾。

验收：`wiki/index.md` 列出全部页；`pnpm check` 全绿；feature doc AC5 打勾。

---

## Phase 3：站内消费（AC6）

### Task 18: 读取器 `src/content/wiki/index.ts`

`import registry from "./registry.json"`（`resolveJsonModule` 已开）+ `import.meta.glob("/wiki/concepts/*.md", { query: "?raw", import: "default" })` 与 `sources/`。导出 `getPage(id)`、`listPages()`、`findByAlias(text)`。测试：registry 与 glob 的文件集合一致。

### Task 19: `<Term id>` 悬停卡 `src/content/wiki/Term.tsx`

读 registry 的 `summary`；悬停 / 聚焦显示，点击跳 `#/wiki/<id>`；无 id 时开发环境 console.warn。样式用 `src/design/tokens.css` 的橙色行动色只做下划线。

### Task 20: `#/wiki` 与 `#/wiki/:id` 页面 `src/app/pages/WikiPage.tsx`

三栏：左目录（按 type 再按章节，数据来自 registry）、中页面（remark-gfm 渲染正文，相对链接改写为 hash 路由，`sources` 渲染成角标，指向 GitHub `https://github.com/vllm-project/vllm-ascend/blob/<commit>/<path>#L起-L止`）、右抽屉占位（Phase 4 填）。路由加进 `src/app/App.tsx`。

### Task 21: Playwright `tests/wiki.spec.ts`

打开 `#/wiki`，点目录第一项，断言 H1；悬停正文 `<Term>` 断言摘要出现；点 related 链接断言 URL 变化。截图给用户目测。

---

## Phase 4：server + 聊天（AC7）

### Task 22: `server/index.ts`（node:http，无框架）

路由：`POST /api/wiki/chat`（body `{ message, sessionId? }`，SSE：`text` 增量、`done` 带 `sessionId`）；`GET /api/wiki/health`。tsconfig.node include 加 `server`。

### Task 23: `server/wiki-agent.ts`

复用 `scripts/wiki/claude-cli.ts` 的解析与 kill，新增流式变体：`--output-format stream-json --include-partial-messages`，解析 `content_block_delta.text_delta`；系统提示 = HANDBOOK「页面格式 + 查询」切片 + `index.md` 全文；`--allowedTools Read Grep Glob`、`--disallowedTools Write Edit Bash …`；`--resume <sessionId>` 续聊；cwd = `wiki/`。

### Task 24: 前端抽屉 `src/app/wiki/ChatDrawer.tsx`

fetch + ReadableStream 读 SSE；消息里的相对链接改写为 `#/wiki/<id>`；「存进 wiki」按钮 POST `/api/wiki/file-answer`（Phase 5 实现，此处先禁用）。

### Task 25: 开发联动

`vite.config.ts` 加 `server.proxy["/api"] = "http://127.0.0.1:8790"`；`package.json` 加 `dev:server`（`tsx watch server/index.ts`）与 `dev` 改为 concurrently 同起（新增 devDep `concurrently`）。

验收：右栏问「KV Cache 是什么」，流式回答含 `concepts/kv-cache.md` 链接并可跳转。

---

## Phase 5：存进 wiki 与 PR ingest（AC8）

### Task 26: `POST /api/wiki/file-answer`

body `{ question, answer, sessionId }` → 写 `_drafts/qa-<slug>-<date>.md`（type concept，sources 由回答里引用的页面 sources 汇总，evidence 取最低），走同一 `parsePage` 校验。

### Task 27: sanitize 模块

整目录复制 Multi-Agent `packages/api/src/wiki/sanitize/` 到 `scripts/wiki/sanitize/`（含测试），去掉 `Buffer` 之外的运行时假设，接入 PR ingest 的输入前处理。

### Task 28: `pnpm wiki:ingest --pr <n>`

`git -C tools/repos/vllm-ascend fetch origin refs/pull/<n>/head:pr-<n>`；用 GitHub REST（无需 gh，`https://api.github.com/repos/vllm-project/vllm-ascend/pulls/<n>`）取标题、正文、变更文件，经 sanitize 后作为 ask；`type: pr`，落 `sources/pr-<n>.md`；`sources` 指向 PR head commit。

### Task 29: 草稿面板

`#/wiki/drafts`：列 `_drafts/*.md`，显示 diff（与 `concepts/` 同 id 页对比），按钮批准（POST `/api/wiki/drafts/approve` → 引擎晋升 + build + lint）/ 驳回（移到 `_drafts/_rejected/`）。

验收：ingest 一个真实 PR，草稿 diff 可读，`raw/` 与 `tools/repos/` 未被修改（`git -C tools/repos/vllm-ascend status` 干净）。

---

## 验证总表

| AC | 命令 / 动作 | 预期 |
|---|---|---|
| AC1 | `pnpm wiki:build && pnpm wiki:build && git diff --stat wiki/index.md src/content/wiki/registry.json` | 第二次无 diff |
| AC2 | Task 5 Step 4b | 非零退出，输出含文件名与规则 |
| AC3 | `pnpm vitest run scripts/wiki` + `pnpm wiki:ingest … --dry-run` | 测试全绿；dry-run 打印 11 段命令不 spawn |
| AC4 | Task 12 人审报告 | 3 页抽查行号属实；`git status` 无越界 |
| AC5 | `pnpm wiki:lint --terms && pnpm check` | 通过 |
| AC6 | `pnpm test:e2e`（wiki.spec） | 3 断言通过 + 截图 |
| AC7 | 浏览器 `#/wiki` 提问 | 流式回答含可跳转链接 |
| AC8 | `pnpm wiki:ingest --pr <n>`；面板批准 | 草稿出现；`tools/repos` 干净 |

## 风险与回退

- **Write 路径规则不生效**（Spike W1）：退化为快照检查，已实现；越界文件会被删除并判该批失败。
- **agent 编造行号**：HANDBOOK 要求 raw 逐字贴片段；人审用 `sed -n` 对照；不合格改「提取」切片重跑。
- **额度**：试点 10 次；ingest 日志累计 `total_cost_usd`；Phase 2 前给用户报总额。
- **仓库根 CLAUDE.md 干扰 agent**（D11）：加 `wiki/CLAUDE.md` 一行指回系统提示。
- **Windows 路径**：所有相对路径 posix 化（`replace(/\\/g, "/")`），快照与 glob 都用 posix。
