import { describe, expect, it } from "vitest";
import {
  CHAT_HISTORY_KEY,
  type ChatHistory,
  chatHttpError,
  readChatHistory,
  writeChatHistory,
} from "./chat-history";

describe("聊天记录持久化", () => {
  it("保留正文、GitHub 结果、草稿与会话", () => {
    const saved: ChatHistory = {
      version: 1,
      input: "接着问",
      sessionId: "session",
      msgs: [
        {
          key: "answer",
          role: "agent",
          text: "回答",
          status: "complete",
          answerId: "receipt",
          trace: {
            status: "done",
            complete: true,
            scope: { repos: ["vllm-project/vllm-ascend"], since: "2025-10-11" },
            candidates: [
              {
                repo: "vllm-project/vllm-ascend",
                number: 15712,
                kind: "issue",
                title: "相关报错",
                url: "https://github.com/vllm-project/vllm-ascend/issues/15712",
                state: "closed",
              },
            ],
          },
        },
      ],
    };
    let raw = "";
    writeChatHistory(
      {
        setItem: (key, value) => {
          expect(key).toBe(CHAT_HISTORY_KEY);
          raw = value;
        },
      },
      saved,
    );
    expect(readChatHistory({ getItem: () => raw })).toEqual(saved);
  });

  it("刷新中断保留部分回答，撤下搜索和核对的等待态，不复用占用中的会话", () => {
    const saved = {
      version: 1,
      input: "草稿",
      sessionId: "busy-session",
      msgs: [
        {
          key: "partial",
          role: "agent",
          text: "已收到的部分",
          status: "pending",
          trace: { status: "searching" },
          quality: { status: "checking" },
        },
      ],
    };
    const restored = readChatHistory({ getItem: () => JSON.stringify(saved) });
    expect(restored.sessionId).toBeUndefined();
    expect(restored.msgs[0]).toMatchObject({
      text: "已收到的部分",
      status: "interrupted",
      trace: { status: "failed" },
      quality: { status: "unavailable" },
    });
  });

  it("答案已持久化后在独立核对期间刷新：保留 complete 状态与 sessionId，收起悬挂的核对等待态且不伪造 answerId", () => {
    const saved: ChatHistory = {
      version: 1,
      input: "",
      sessionId: "persisted-session",
      msgs: [
        {
          key: "done-answer",
          role: "agent",
          text: "完整回答正文",
          status: "complete",
          quality: { status: "checking" },
        },
      ],
    };
    const restored = readChatHistory({ getItem: () => JSON.stringify(saved) });
    expect(restored.sessionId).toBe("persisted-session");
    expect(restored.msgs[0]).toMatchObject({
      text: "完整回答正文",
      status: "complete",
      quality: { status: "unavailable" },
    });
    expect(restored.msgs[0]?.answerId).toBeUndefined();
  });

  it("坏记录与禁用存储交给界面报告，不让无效数据进入渲染", () => {
    expect(() => readChatHistory({ getItem: () => '{"msgs":null}' })).toThrow();
    expect(() =>
      writeChatHistory(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        { version: 1, msgs: [], input: "" },
      ),
    ).toThrow("quota");
  });
});

describe("问答接口的错误说明", () => {
  it("409 时带上后端返回的中文说明", () => {
    expect(chatHttpError(409, JSON.stringify({ error: "Error: 这段会话正在回答，请等待结束后再提问" }))).toBe(
      "服务返回 409：这段会话正在回答，请等待结束后再提问",
    );
  });
  it("响应体不是 JSON 或没有说明时只报状态码", () => {
    expect(chatHttpError(502, "<html>bad gateway</html>")).toBe("服务返回 502");
    expect(chatHttpError(500, "")).toBe("服务返回 500");
  });
});
