import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildIndex, retrieve } from "../../src/content/wiki/retrieve";
import { type RegistryEntry, registrySchema } from "../../src/content/wiki/schema";

/**
 * 给站外的 agent（Claude Code、Codex、任何 MCP 客户端）用的只读入口。
 *
 * 站内问答有自己的 HTTP 接口，但那只绑本机、只服务网页。用户 2026-09-21 问「知识库做完以后
 * agent 怎么调用」，当时的回答是「基本没有」。这里补上三个只读动作，`pnpm wiki:find` 与
 * MCP server 都只是它的壳——检索仍然只有 `src/content/wiki/retrieve.ts` 那一个入口，
 * 命中规则与站内问答完全一致，不另起一套。
 */

export type AgentPage = RegistryEntry & { text: string };

export interface AgentWiki {
  search: (query: string, limit?: number) => AgentHit[];
  getPage: (id: string) => (AgentHit & { text: string }) | undefined;
  neighbors: (id: string) => AgentEdge[];
}

export interface AgentHit {
  id: string;
  title: string;
  summary: string;
  /** 相对仓库根的路径，agent 可以直接打开 */
  file: string;
  evidence: string;
  /** 这页已经对过哪几个版本；没列出的版本不代表不成立，只是没人对过 */
  verified: string[];
  how?: string;
  via?: string;
}

export interface AgentEdge {
  id: string;
  title: string;
  kind: string;
  note: string;
  /** out = 这页自己声明的边；in = 别的页指回来的边（由 wiki:build 派生） */
  direction: "out" | "in";
}

export function makeAgentWiki(pages: AgentPage[]): AgentWiki {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const index = buildIndex(pages);
  const hitOf = (p: AgentPage): AgentHit => ({
    id: p.id,
    title: p.title,
    summary: p.summary,
    file: `wiki/${p.file}`,
    evidence: p.evidence,
    verified: p.verified,
  });
  const titleOf = (id: string) => byId.get(id)?.title ?? id;
  return {
    search: (query, limit = 5) =>
      retrieve(query, index, { limit, expand: true }).flatMap((h) => {
        const page = byId.get(h.id);
        return page ? [{ ...hitOf(page), how: h.how, ...(h.via ? { via: h.via } : {}) }] : [];
      }),
    getPage: (id) => {
      const page = byId.get(id);
      return page ? { ...hitOf(page), text: page.text } : undefined;
    },
    neighbors: (id) => {
      const page = byId.get(id);
      if (!page) return [];
      return [
        ...page.relations.map((r) => ({
          id: r.to,
          title: titleOf(r.to),
          kind: r.kind,
          note: r.note,
          direction: "out" as const,
        })),
        ...page.backlinks.map((b) => ({
          id: b.from,
          title: titleOf(b.from),
          kind: b.kind,
          note: b.note,
          direction: "in" as const,
        })),
      ];
    },
  };
}

/** 从磁盘上的派生物建：registry.json 给元数据，页面文件给正文 */
export function loadAgentWiki(root: string): AgentWiki {
  const registry = registrySchema.parse(
    JSON.parse(readFileSync(join(root, "src/content/wiki/registry.json"), "utf8")),
  );
  return makeAgentWiki(
    registry.pages.map((page) => ({ ...page, text: readFileSync(join(root, "wiki", page.file), "utf8") })),
  );
}

// ---- MCP：stdio 上的 JSON-RPC 2.0，一行一条消息。只实现只读工具要用到的那几个方法。 ----

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface RpcReply {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

const TOOLS = [
  {
    name: "wiki_search",
    description:
      "在 vLLM / vLLM-Ascend 知识库里找页面。按页面 id、标题、别名精确或宽松命中，再按关键词与页面关系扩展。返回命中页的 id、标题、一句话摘要、文件路径、证据等级和已核对的版本。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "要查的名词、参数名或问题" },
        limit: { type: "number", description: "最多返回几页，默认 5" },
      },
      required: ["query"],
    },
  },
  {
    name: "wiki_get_page",
    description:
      "按 id 取一页的完整 markdown（含 frontmatter 里的来源列表，来源形如 repo@commit:path#L起-L止）。",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "wiki_neighbors",
    description:
      "这一页和哪些页有关：它建立在谁之上、谁建立在它之上、和谁互斥或互为替代。每条边带一句理由。回答问题时用它把相关页串起来。",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

export function handleRpc(msg: RpcMessage, wiki: AgentWiki): RpcReply | undefined {
  if (msg.id === undefined) return undefined; // 通知不回包
  const reply = (result: unknown): RpcReply => ({ jsonrpc: "2.0", id: msg.id as number | string, result });
  const text = (value: unknown, isError = false) =>
    reply({
      content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
      isError,
    });

  if (msg.method === "initialize")
    return reply({
      protocolVersion: (msg.params?.protocolVersion as string | undefined) ?? "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "llm-wiki", version: "1" },
      instructions:
        "只读的 vLLM / vLLM-Ascend 知识库。先 wiki_search，再 wiki_get_page 读正文，用 wiki_neighbors 找相关页。页面结论带来源与证据等级；verified 没列出的版本表示还没人对过。",
    });
  if (msg.method === "ping") return reply({});
  if (msg.method === "tools/list") return reply({ tools: TOOLS });
  if (msg.method === "tools/call") {
    const name = msg.params?.name;
    const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
    if (name === "wiki_search") return text(wiki.search(String(args.query ?? ""), Number(args.limit) || 5));
    if (name === "wiki_neighbors") return text(wiki.neighbors(String(args.id ?? "")));
    if (name === "wiki_get_page") {
      const page = wiki.getPage(String(args.id ?? ""));
      return page ? text(page.text) : text(`没有 id 为 ${String(args.id)} 的页；先用 wiki_search 找`, true);
    }
    return text(`没有这个工具：${String(name)}`, true);
  }
  return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `不支持的方法：${msg.method}` } };
}
