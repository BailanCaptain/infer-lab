import { describe, expect, it } from "vitest";
import { buildChatRequest, parseChatLine, sseFrame } from "./chat";

const hb = { pageFormat: "PF", query: "Q" };
const ctx = { wikiRoot: "C:/w/wiki", indexMd: "# 索引\n- kv-cache", timeoutMs: 60_000 };

describe("parseChatLine", () => {
  it("从 stream_event 的 text_delta 取增量", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { type: "content_block_delta", delta: { type: "text_delta", text: "KV " } },
    });
    expect(parseChatLine(line)).toEqual({ kind: "text", text: "KV " });
  });

  it("忽略 assistant 信封里的整段文本，避免与增量重复", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "KV Cache 是……" }] },
    });
    expect(parseChatLine(line)).toBeNull();
  });

  it("工具调用转成 tool 事件，让前端能显示正在查哪一页", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "concepts/kv-cache.md" } }] },
    });
    expect(parseChatLine(line)).toEqual({ kind: "tool", name: "Read", target: "concepts/kv-cache.md" });
  });

  it("result 带回 sessionId 供多轮续聊", () => {
    const line = JSON.stringify({ type: "result", is_error: false, session_id: "s-1", total_cost_usd: 0.01 });
    expect(parseChatLine(line)).toEqual({ kind: "result", isError: false, sessionId: "s-1", costUsd: 0.01 });
  });

  it("非 JSON 与无关事件返回 null", () => {
    expect(parseChatLine("not json")).toBeNull();
    expect(parseChatLine(JSON.stringify({ type: "system" }))).toBeNull();
  });
});

describe("buildChatRequest", () => {
  it("cwd 是 wiki/，系统提示 = 页面格式 + 查询 + index.md", () => {
    const req = buildChatRequest({ message: "KV Cache 是什么" }, hb, ctx);
    expect(req.cwd).toBe("C:/w/wiki");
    const sys = req.args[req.args.indexOf("--append-system-prompt") + 1] ?? "";
    expect(sys).toContain("PF");
    expect(sys).toContain("Q");
    expect(sys).toContain("kv-cache");
  });

  it("只给只读工具；写类工具一律禁掉", () => {
    const req = buildChatRequest({ message: "x" }, hb, ctx);
    const allowed = req.args.slice(req.args.indexOf("--allowedTools") + 1, req.args.indexOf("--disallowedTools"));
    expect(allowed).toEqual(["Read", "Grep", "Glob"]);
    const disallowed = req.args.slice(req.args.indexOf("--disallowedTools") + 1);
    for (const t of ["Write", "Edit", "Bash", "WebFetch", "WebSearch"]) {
      expect(disallowed).toContain(t);
    }
  });

  it("提问走 stdin，不进 argv（Windows argv 有 32KB 上限）", () => {
    const req = buildChatRequest({ message: "很长的问题".repeat(100) }, hb, ctx);
    expect(req.stdin).toContain("很长的问题");
    expect(req.args.join(" ")).not.toContain("很长的问题");
  });

  it("带 sessionId 时加 --resume 续聊", () => {
    const req = buildChatRequest({ message: "那它多大", sessionId: "s-1" }, hb, ctx);
    expect(req.args[req.args.indexOf("--resume") + 1]).toBe("s-1");
  });

  it("不带 sessionId 时没有 --resume", () => {
    expect(buildChatRequest({ message: "x" }, hb, ctx).args).not.toContain("--resume");
  });

  it("检索到的候选页写进 stdin，给 agent 指路", () => {
    const req = buildChatRequest(
      { message: "KV Cache 是什么", hits: [{ id: "kv-cache", title: "KV Cache", summary: "s", evidence: "C", score: 1000, how: "exact" }] },
      hb,
      ctx,
    );
    expect(req.stdin).toContain("kv-cache");
  });

  it("聊天不允许写文件，allowedWrites 为空", () => {
    expect(buildChatRequest({ message: "x" }, hb, ctx).allowedWrites).toEqual([]);
  });
});

describe("sseFrame", () => {
  it("拼成合法 SSE 帧", () => {
    expect(sseFrame("text", { text: "hi" })).toBe('event: text\ndata: {"text":"hi"}\n\n');
  });

  it("换行不会破坏帧结构（JSON 里被转义）", () => {
    const frame = sseFrame("text", { text: "a\nb" });
    expect(frame.split("\n\n").length).toBe(2);
    expect(frame).toContain("\\n");
  });
});
