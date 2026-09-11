/**
 * 问答的纯函数部分：请求构造、stream-json 解析、SSE 拼帧。
 * 真正 spawn 复用 scripts/wiki/claude-cli.ts；HTTP 在 server/index.ts。
 *
 * 与 ingest 的提取 agent 的区别：这里**只读**，不给任何写工具，
 * 学习者的提问不能改动知识库（要写只能走「存进 wiki」的草稿流程，AC8）。
 */
import type { AgentRequest } from "../scripts/wiki/ingest";
import type { Neighborhood } from "../src/content/wiki/relations";

export interface ChatHandbook {
  pageFormat: string;
  query: string;
}

export interface ChatContext {
  wikiRoot: string;
  /** wiki/index.md 全文，注入系统提示让 agent 知道有哪些页 */
  indexMd: string;
  timeoutMs: number;
}

export interface ChatHit {
  id: string;
  title: string;
  summary: string;
  evidence: string;
  score: number;
  how: string;
}

export interface ChatInput {
  message: string;
  sessionId?: string;
  /** retrieve() 给出的候选页；由 server 层调用 AC10 的接口取得 */
  hits?: ChatHit[];
  /** 命中页的子图：地基 / 下游 / 同层，每条带说明关系的 note */
  graph?: { id: string; title: string; neighborhood: Neighborhood }[];
}

export type ChatEvent =
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; target?: string }
  | { kind: "result"; isError: boolean; sessionId?: string; costUsd?: number };

/**
 * 问答 agent 不许碰的工具。与提取不同，这里必须禁 Write 与 Edit——学习者的提问
 * 不能改动知识库（要写只能走「存进 wiki」的草稿流程，AC8）。
 *
 * 但**允许联网**（2026-09-11 修正）：知识库没收录的问题，只回一句「没有」价值有限；
 * 能读官方文档给出带出处的答案才有用。可引来源仍由 HANDBOOK 的白名单约束。
 * 另外，agent 需要上网本身就是知识库缺口的信号，F004 AC3 拿它当补页的触发条件。
 *
 * 放开联网要两步：从 DISALLOWED 拿掉、往 ALLOWED 加上。`--allowedTools` 在 `-p`
 * 模式下是白名单，不在表里的工具会被直接拒（实测 2026-09-11）。
 */
const ALLOWED = ["Read", "Grep", "Glob", "WebFetch", "WebSearch"];
const DISALLOWED = ["Write", "Edit", "NotebookEdit", "Bash", "Task", "Agent"];

/**
 * 子图注入。回答「什么是 X」时只读 X 一页是不够的——2026-09-11 实测就是读一页
 * 就停了，因为那时候边是无类型的 `related`，agent 既不知道该去哪页，也不知道
 * 去了之后怎么把两页接起来。现在把地基 / 下游 / 同层连同 note 一起给它，
 * 让答案能按「它依赖什么 → 它是什么 → 谁用它 → 边界」组织。
 */
function graphBlock(graph?: { id: string; title: string; neighborhood: Neighborhood }[]): string[] {
  const out: string[] = [];
  for (const g of graph ?? []) {
    const n = g.neighborhood;
    if (!n.foundations.length && !n.dependents.length && !n.siblings.length) continue;
    out.push("", `「${g.title}」（${g.id}）的子图——按「查询」规则沿它组织回答：`);
    const section = (title: string, items: { id: string; note: string }[]) => {
      if (!items.length) return;
      out.push(`  ${title}：`);
      for (const it of items) out.push(`    - ${it.id}：${it.note}`);
    };
    section("地基（先交代，一句话即可）", n.foundations);
    section("下游（说清学了有什么用）", n.dependents);
    section("同层（变体 / 互斥 / 替代，用来划边界）", n.siblings);
  }
  if (out.length) {
    out.push("", "子图里的页要真的打开读，不要只拿上面这几行拼答案。");
  }
  return out;
}

export function buildChatRequest(
  input: ChatInput,
  handbook: ChatHandbook,
  ctx: ChatContext,
): AgentRequest {
  const system = [
    handbook.pageFormat.trim(),
    handbook.query.trim(),
    "",
    "以下是知识库索引（wiki/index.md），列出了当前全部页面：",
    ctx.indexMd.trim(),
  ].join("\n\n");

  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--append-system-prompt",
    system,
    "--max-turns",
    "20",
  ];
  if (input.sessionId) args.push("--resume", input.sessionId);
  args.push("--allowedTools", ...ALLOWED, "--disallowedTools", ...DISALLOWED);

  const lines = [`学习者的问题：${input.message}`];
  if (input.hits?.length) {
    lines.push(
      "",
      "程序预检索到这些可能相关的页（仅供参考，请自己打开确认）：",
      ...input.hits.map((h) => `- ${h.id}（${h.title}）[${h.evidence}] ${h.summary}`),
    );
  } else if (input.hits) {
    lines.push("", "程序预检索没有找到相关页。若你也找不到，请直接说知识库里还没有这一条。");
  }
  lines.push(...graphBlock(input.graph));

  return {
    id: "chat",
    cwd: ctx.wikiRoot,
    args,
    stdin: lines.join("\n"),
    timeoutMs: ctx.timeoutMs,
    allowedWrites: [],
  };
}

/**
 * 解析一行 stream-json。
 * 只取三类：增量文本、工具调用、最终 result。
 * `assistant` 信封里的整段文本**刻意忽略**——它与 text_delta 内容重复，
 * 两个都取会让回答出现两遍（Multi-Agent 的 claude-runtime.ts 同样处理）。
 */
export function parseChatLine(line: string): ChatEvent | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (obj.type === "stream_event") {
    const ev = obj.event as { type?: string; delta?: { type?: string; text?: string } } | undefined;
    if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta") {
      const text = ev.delta.text;
      if (typeof text === "string" && text.length > 0) return { kind: "text", text };
    }
    return null;
  }

  if (obj.type === "assistant") {
    const msg = obj.message as
      | { content?: { type: string; name?: string; input?: Record<string, unknown> }[] }
      | undefined;
    const tool = msg?.content?.find((c) => c.type === "tool_use");
    if (!tool?.name) return null;
    const input = tool.input ?? {};
    const target = (input.file_path ?? input.pattern ?? input.path) as string | undefined;
    return target !== undefined
      ? { kind: "tool", name: tool.name, target }
      : { kind: "tool", name: tool.name };
  }

  if (obj.type === "result") {
    const e: ChatEvent = { kind: "result", isError: Boolean(obj.is_error) };
    if (typeof obj.session_id === "string") e.sessionId = obj.session_id;
    if (typeof obj.total_cost_usd === "number") e.costUsd = obj.total_cost_usd;
    return e;
  }

  return null;
}

/** SSE 一帧。data 走 JSON，换行天然被转义，不会破坏帧边界。 */
export function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * 问答运行器：复用 spawnClaude 的管道，按问答的事件形状解析。
 * 文本增量单独回调，让 HTTP 层能边收边推 SSE。
 */
export async function runChat(
  req: AgentRequest,
  on: { text: (t: string) => void; tool?: (name: string, target?: string) => void },
): Promise<{ ok: boolean; sessionId?: string; costUsd?: number; reason?: string }> {
  const { spawnClaude } = await import("../scripts/wiki/claude-cli");
  const r = await spawnClaude(req, (line) => {
    const e = parseChatLine(line);
    if (!e) return;
    if (e.kind === "text") on.text(e.text);
    else if (e.kind === "tool") on.tool?.(e.name, e.target);
    else return { isError: e.isError, sessionId: e.sessionId, costUsd: e.costUsd };
  });
  const out: { ok: boolean; sessionId?: string; costUsd?: number; reason?: string } = { ok: r.ok };
  if (r.sessionId) out.sessionId = r.sessionId;
  if (r.costUsd !== undefined) out.costUsd = r.costUsd;
  if (r.reason) out.reason = r.reason;
  return out;
}
