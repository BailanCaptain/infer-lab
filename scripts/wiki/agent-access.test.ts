import { describe, expect, it } from "vitest";
import { type AgentWiki, handleRpc, makeAgentWiki } from "./agent-access";

const pages = [
  {
    id: "block-table",
    title: "Block Table：每条请求一行",
    aliases: ["块表"],
    summary: "块表把逻辑位置翻成物理块号。",
    chapters: ["11"],
    evidence: "C",
    verified: ["releases/v0.23.0", "releases/v0.26.0rc"],
    file: "concepts/block-table.md",
    relations: [{ to: "kv-cache-spec", kind: "builds-on", note: "块多大由 spec 定" }],
    backlinks: [{ from: "paged-attention", kind: "enables", note: "分页注意力靠块表取块" }],
    text: "块表正文",
  },
  {
    id: "kv-cache-spec",
    title: "KV Cache Spec",
    aliases: [],
    summary: "每层 KV 的形状与字节数。",
    chapters: ["11"],
    evidence: "C",
    verified: [],
    file: "concepts/kv-cache-spec.md",
    relations: [],
    backlinks: [],
    text: "spec 正文",
  },
];

const wiki = (): AgentWiki => makeAgentWiki(pages as never);

describe("makeAgentWiki", () => {
  it("search 走站内问答同一个检索入口：别名精确命中排第一，带上文件路径与已核对版本", () => {
    const [first] = wiki().search("块表");
    expect(first).toMatchObject({
      id: "block-table",
      file: "wiki/concepts/block-table.md",
      how: "exact",
      verified: ["releases/v0.23.0", "releases/v0.26.0rc"],
    });
  });

  it("getPage 返回正文；id 不存在时返回 undefined 而不是抛错", () => {
    expect(wiki().getPage("block-table")?.text).toBe("块表正文");
    expect(wiki().getPage("nope")).toBeUndefined();
  });

  it("neighbors 同时给出这页声明的边和别的页指回来的边，每条带理由", () => {
    expect(wiki().neighbors("block-table")).toEqual([
      {
        id: "kv-cache-spec",
        title: "KV Cache Spec",
        kind: "builds-on",
        note: "块多大由 spec 定",
        direction: "out",
      },
      {
        id: "paged-attention",
        title: "paged-attention",
        kind: "enables",
        note: "分页注意力靠块表取块",
        direction: "in",
      },
    ]);
  });
});

describe("handleRpc（MCP 的 stdio JSON-RPC）", () => {
  it("initialize 报出协议版本与只读工具能力", () => {
    const res = handleRpc(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      wiki(),
    );
    expect(res).toMatchObject({
      id: 1,
      result: { protocolVersion: "2025-06-18", capabilities: { tools: {} } },
    });
  });

  it("tools/list 给出三个只读工具", () => {
    const res = handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, wiki());
    expect((res?.result as { tools: { name: string }[] }).tools.map((t) => t.name)).toEqual([
      "wiki_search",
      "wiki_get_page",
      "wiki_neighbors",
    ]);
  });

  it("tools/call 把结果放进 text 内容；查不到的页是 isError，不是协议错误", () => {
    const ok = handleRpc(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "wiki_search", arguments: { query: "块表" } },
      },
      wiki(),
    );
    expect(JSON.parse((ok?.result as { content: { text: string }[] }).content[0]?.text ?? "")[0].id).toBe(
      "block-table",
    );
    const miss = handleRpc(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "wiki_get_page", arguments: { id: "nope" } },
      },
      wiki(),
    );
    expect(miss?.result).toMatchObject({ isError: true });
  });

  it("通知没有 id，不回包；不认识的方法回 -32601", () => {
    expect(handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, wiki())).toBeUndefined();
    expect(handleRpc({ jsonrpc: "2.0", id: 5, method: "resources/list" }, wiki())).toMatchObject({
      id: 5,
      error: { code: -32601 },
    });
  });
});
