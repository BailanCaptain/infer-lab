import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setBackendAvailability } from "./api";
import { createWikiAssistantController } from "./assistant-context";
import { ChatPane, createChatController } from "./ChatDrawer";
import { CHAT_HISTORY_KEY, readChatHistory } from "./chat-history";
import { WikiPanel } from "./WikiPanel";

interface FakeStorage {
  data: Map<string, string>;
  writes: number;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function createMemoryStorage(): FakeStorage {
  const data = new Map<string, string>();
  const store: FakeStorage = {
    data,
    writes: 0,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      store.writes += 1;
      data.set(key, value);
    },
  };
  return store;
}

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

describe("chat-controller P2 稳定性加固与静态离线优雅降级", () => {
  beforeEach(() => {
    setBackendAvailability("unknown");
  });
  afterEach(() => {
    setBackendAvailability("unknown");
  });

  it("Bug 2a: 200 text/html SPA 回退立即报离线提示且不显示「回答已中断」；无 content-type 的单元测试桩仍正常流式读取", async () => {
    const storage = createMemoryStorage();
    const htmlFetch: typeof fetch = async () =>
      new Response("<!doctype html><html><body>SPA fallback</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });

    const controller = createChatController({ storage, fetchImpl: htmlFetch });
    await controller.send("为什么报 EI0006？");

    const state = controller.getState();
    const agentMsg = state.msgs[1]!;
    expect(agentMsg.text).toContain("当前静态环境未连接本地问答服务，请使用顶部搜索（Ctrl+K）查阅知识库。");
    expect(agentMsg.status).toBe("failed");

    const rendered = renderToStaticMarkup(
      createElement(ChatPane, { id: "chat", chat: state, hidden: false, onReview: () => {} }),
    );
    expect(rendered).toContain("当前静态环境未连接本地问答服务");
    expect(rendered).not.toContain("回答已中断");

    // 重置离线态后再测无头流式读取
    setBackendAvailability("unknown");
    // 兼容未设置 content-type header 的单测 Response(ReadableStream)
    const bareStreamFetch: typeof fetch = async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(sseChunk("text", { text: "无头流式回复" }));
          c.enqueue(sseChunk("done", { sessionId: "sid-bare" }));
          c.close();
        },
      });
      return new Response(stream, { status: 200 });
    };
    const bareController = createChatController({
      storage: createMemoryStorage(),
      fetchImpl: bareStreamFetch,
    });
    await bareController.send("测试无头响应");
    expect(bareController.getState().msgs[1]?.text).toBe("无头流式回复");
    expect(bareController.getState().msgs[1]?.status).toBe("complete");
  });

  it("Bug 2b: HTTP 503 或 SSE error 后紧跟 cite + done 时，绝不标记为 complete，也不写入伪造 sessionId / answerId", async () => {
    const storage503 = createMemoryStorage();
    const controller503 = createChatController({
      storage: storage503,
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "模型配额耗尽" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
    });
    await controller503.send("测试 503");
    expect(controller503.getState().msgs[1]?.status).toBe("failed");
    expect(controller503.getState().msgs[1]?.status).not.toBe("complete");
    expect(readChatHistory(storage503).msgs[1]?.status).toBe("failed");

    const storageSseErr = createMemoryStorage();
    const seenBodies: Array<{ message: string; sessionId?: string }> = [];
    let call = 0;
    const sseErrFetch: typeof fetch = async (_input, init) => {
      call += 1;
      seenBodies.push(JSON.parse(String(init?.body ?? "{}")) as { message: string; sessionId?: string });
      if (call === 1) {
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(sseChunk("knowledge", { revision: "a".repeat(64), sessionId: "sid-uncommitted" }));
            c.enqueue(sseChunk("trace", { status: "searching" }));
            c.enqueue(sseChunk("error", { message: "agent 失败：子进程异常退出" }));
            c.enqueue(
              sseChunk("cite", { cited: false, selfDeclaredUncovered: false, reason: "回答尚未完整核对" }),
            );
            c.enqueue(sseChunk("done", { sessionId: "sid-uncommitted", answerId: "f".repeat(64) }));
            c.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(sseChunk("text", { text: "第二轮正常恢复" }));
          c.enqueue(sseChunk("done", { sessionId: "sid-clean" }));
          c.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };

    const controllerErr = createChatController({ storage: storageSseErr, fetchImpl: sseErrFetch });
    await controllerErr.send("第一轮触发 error+done");

    const failedMsg = controllerErr.getState().msgs[1]!;
    expect(failedMsg.status).toBe("failed");
    expect(failedMsg.text).toContain("agent 失败：子进程异常退出");
    expect(failedMsg.answerId).toBeUndefined();
    expect(failedMsg.uncited).toBeUndefined();
    expect(failedMsg.trace).toMatchObject({ status: "failed" });

    const persistedAfterFail = readChatHistory(storageSseErr);
    expect(persistedAfterFail.msgs[1]?.status).toBe("failed");
    expect(persistedAfterFail.sessionId).toBeUndefined();

    await controllerErr.send("第二轮重试");
    expect(seenBodies[1]?.sessionId).toBeUndefined();
    expect(controllerErr.getState().msgs[3]?.status).toBe("complete");
  });

  it("Bug 2c: 单调 turnId 隔离陈旧轮次——Turn A 被 stop() 后迟到的回调与 finally 绝不清空 Turn B 的 busy 或覆盖 sessionId", async () => {
    const storage = createMemoryStorage();
    let resolveTurnAFetch!: () => void;
    let emitLateTurnAFrames!: () => void;
    let finishTurnB!: () => void;
    const seenBodies: Array<{ message: string; sessionId?: string }> = [];

    let call = 0;
    const fetchImpl: typeof fetch = async (_input, init) => {
      call += 1;
      seenBodies.push(JSON.parse(String(init?.body ?? "{}")) as { message: string; sessionId?: string });
      if (call === 1) {
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(sseChunk("knowledge", { revision: "a".repeat(64), sessionId: "sid-turn-a" }));
            c.enqueue(sseChunk("text", { text: "Turn A 前半段" }));
            emitLateTurnAFrames = () => {
              c.enqueue(sseChunk("text", { text: " + 迟到脏数据" }));
              c.enqueue(sseChunk("persisted", { sessionId: "sid-turn-a", revision: "a".repeat(64) }));
              c.enqueue(sseChunk("done", { sessionId: "sid-turn-a" }));
              c.close();
              resolveTurnAFetch();
            };
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(sseChunk("knowledge", { revision: "b".repeat(64), sessionId: "sid-turn-b" }));
          c.enqueue(sseChunk("text", { text: "Turn B 正常流式内容" }));
          finishTurnB = () => {
            c.enqueue(sseChunk("persisted", { sessionId: "sid-turn-b", revision: "b".repeat(64) }));
            c.enqueue(sseChunk("done", { sessionId: "sid-turn-b" }));
            c.close();
          };
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };

    const turnADoneGate = new Promise<void>((r) => {
      resolveTurnAFetch = r;
    });

    const controller = createChatController({ storage, fetchImpl });
    const turnAPromise = controller.send("问题 A");
    await new Promise((r) => setTimeout(r, 10));

    // 用户中止 Turn A，并立即发起 Turn B（此时 Turn A 底层流尚未真正关闭）
    controller.stop();
    expect(controller.getState().busy).toBe(false);

    const turnBPromise = controller.send("问题 B");
    await new Promise((r) => setTimeout(r, 10));
    expect(controller.getState().busy).toBe(true);

    // 此时 Turn A 迟到的帧和 finally 到达：不得把 busy 置回 false，也不得覆盖 Turn B 的 sessionId
    emitLateTurnAFrames();
    await turnADoneGate;
    await turnAPromise;

    expect(controller.getState().busy).toBe(true);
    expect(controller.getState().msgs[1]?.text).not.toContain("迟到脏数据");
    expect(controller.getState().msgs[1]?.status).toBe("interrupted");

    finishTurnB();
    await turnBPromise;
    expect(controller.getState().busy).toBe(false);
    expect(controller.getState().msgs[3]?.status).toBe("complete");
    expect(readChatHistory(storage).sessionId).toBe("sid-turn-b");
  });

  it("静态离线模式优雅隐藏后端专属页签与刷新按钮，并支持不污染 localStorage 草稿的脱敏诊断附件预览", async () => {
    const storage = createMemoryStorage();
    const sentPayloads: Array<{ message: string }> = [];
    const controller = createChatController({
      storage,
      fetchImpl: async (_input, init) => {
        sentPayloads.push(JSON.parse(String(init?.body ?? "{}")) as { message: string });
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(sseChunk("text", { text: "已收到脱敏快照" }));
            c.enqueue(sseChunk("done", { sessionId: "sid-att" }));
            c.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      },
    });
    const assistant = createWikiAssistantController({
      active: true,
      getChat: () => controller.getState(),
    });

    // 1. 用户先在输入框敲了一段未发送草稿，落盘到 localStorage
    controller.setInput("我原本写了一半的问题草稿");
    controller.flush();
    expect(readChatHistory(storage).input).toBe("我原本写了一半的问题草稿");
    const writesBeforeAttachment = storage.writes;

    // 2. 从工程工作台点击「送入问答助手」挂载 pendingAttachment（内存态）
    assistant.openChat({
      pendingAttachment: {
        title: "配置体检脱敏摘要",
        summary: "检测到 2 项阻断与 1 项静默改写",
        sanitizedBlock: "vllm serve Qwen/Qwen3-8B --api-key [REDACTED_KEY] --host <REDACTED_IP>",
        suggestedQuestion: "请结合 vllm serve 体检结果给出修改建议",
      },
    });

    // 原有草稿完好保留，且挂载附件本身零次写入 localStorage
    expect(controller.getState().input).toBe("我原本写了一半的问题草稿");
    expect(storage.writes).toBe(writesBeforeAttachment);
    expect(storage.getItem(CHAT_HISTORY_KEY)).not.toContain("REDACTED_KEY");

    // 3. 静态离线模式下渲染 WikiPanel：隐藏 Drop/审阅/状态 页签，保留 问答/证据，展示离线提示与复制诊断摘要按钮
    const offlinePanelHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(WikiPanel, {
          revision: "deadbeef12345678",
          mode: "build",
          backendAvailable: "offline",
          chat: controller.getState(),
          layout: "chat",
          onLayout: () => {},
          onRefresh: async () => false,
        }),
      ),
    );
    expect(offlinePanelHtml).toContain("问答");
    expect(offlinePanelHtml).toContain("证据");
    expect(offlinePanelHtml).not.toContain('id="wiki-panel-tab-drop"');
    expect(offlinePanelHtml).not.toContain('id="wiki-panel-tab-review"');
    expect(offlinePanelHtml).not.toContain('id="wiki-panel-tab-status"');
    expect(offlinePanelHtml).not.toContain("刷新知识库");

    const offlineChatHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(ChatPane, {
          id: "wiki-panel-chat",
          chat: controller.getState(),
          backendAvailable: "offline",
          hidden: false,
          onReview: () => {},
        }),
      ),
    );
    expect(offlineChatHtml).toContain(
      "当前为纯静态离线浏览模式：可使用 Ctrl+K 全站检索，或复制下方脱敏诊断摘要",
    );
    expect(offlineChatHtml).toContain("配置体检脱敏摘要");
    expect(offlineChatHtml).toContain("复制诊断摘要");

    // 4. 点击发送时，将用户原有草稿与脱敏快照合并发出，并自动清空内存附件
    await controller.send();
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0]?.message).toContain("我原本写了一半的问题草稿");
    expect(sentPayloads[0]?.message).toContain("vllm serve Qwen/Qwen3-8B --api-key [REDACTED_KEY]");
    expect(controller.getState().pendingAttachment).toBeNull();
  });

  it("P2-6: 透传 pendingAttachment.analysis，兼容 SSE toolEvidence 事件，并用 done.finalText 权威替换正文", async () => {
    const storage = createMemoryStorage();
    const sentPayloads: Array<{ message: string; sessionId?: string; analysis?: unknown }> = [];
    const controller = createChatController({
      storage,
      fetchImpl: async (_input, init) => {
        sentPayloads.push(
          JSON.parse(String(init?.body ?? "{}")) as {
            message: string;
            sessionId?: string;
            analysis?: unknown;
          },
        );
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(sseChunk("knowledge", { revision: "a".repeat(64), sessionId: "sid-analysis" }));
            c.enqueue(
              sseChunk("toolEvidence", {
                kind: "deploy",
                toolVersion: "deploy-calculator@1",
                summary: "[部署算账确定性核算] 摘要",
              }),
            );
            c.enqueue(sseChunk("text", { text: "流式中间草稿片段" }));
            c.enqueue(
              sseChunk("done", {
                sessionId: "sid-analysis",
                answerId: "c".repeat(64),
                finalText: "Codex 终稿权威正文（已核对工具证据）",
              }),
            );
            c.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      },
    });

    controller.setPendingAttachment({
      title: "部署算账快照",
      summary: "Qwen3-8B · A2 64G",
      sanitizedBlock: "TP=2, u=0.90",
      suggestedQuestion: "请分析单卡显存偏差",
      analysis: {
        kind: "deploy",
        model: "qwen3-8b",
        cardId: "a2-64g",
        tpSize: 2,
        gpuMemoryUtilization: 0.9,
      },
    });

    await controller.send();
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0]?.analysis).toEqual({
      kind: "deploy",
      model: "qwen3-8b",
      cardId: "a2-64g",
      tpSize: 2,
      gpuMemoryUtilization: 0.9,
    });
    expect(controller.getState().msgs[1]?.text).toBe("Codex 终稿权威正文（已核对工具证据）");
    expect(controller.getState().msgs[1]?.answerId).toBe("c".repeat(64));
    expect(controller.getState().msgs[1]?.status).toBe("complete");
    expect(controller.getState().pendingAttachment).toBeNull();
  });

  it("P2-7: 离线态 send() 强拦截且不清空草稿或附件；点击首轮预设问题仅发预设并保留未发草稿与附件", async () => {
    const storage = createMemoryStorage();
    const sentPayloads: Array<{ message: string; analysis?: unknown }> = [];
    const controller = createChatController({
      storage,
      fetchImpl: async (_input, init) => {
        sentPayloads.push(JSON.parse(String(init?.body ?? "{}")) as { message: string; analysis?: unknown });
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(sseChunk("text", { text: "预设问题回答" }));
            c.enqueue(sseChunk("done", { sessionId: "sid-preset" }));
            c.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      },
    });

    const attachment = {
      title: "排障快照",
      summary: "命中 1 条规则",
      sanitizedBlock: "ERROR EI0006",
      analysis: { kind: "troubleshoot" as const, rawInput: "ERROR EI0006" },
    };
    controller.setInput("我尚未发出的重要草稿");
    controller.setPendingAttachment(attachment);

    // 1. 离线态：直接早退，不发请求，绝不清空草稿与附件
    setBackendAvailability("offline");
    await controller.send();
    await controller.send("KV Cache 是什么");
    expect(sentPayloads).toHaveLength(0);
    expect(controller.getState().msgs).toHaveLength(0);
    expect(controller.getState().input).toBe("我尚未发出的重要草稿");
    expect(controller.getState().pendingAttachment).toEqual(attachment);

    // 2. 在线态点击预设快捷问题：仅发该预设，完整保留未发草稿与未消费附件
    setBackendAvailability("online");
    await controller.send("KV Cache 是什么");
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0]).toEqual({ message: "KV Cache 是什么" });
    expect(controller.getState().input).toBe("我尚未发出的重要草稿");
    expect(controller.getState().pendingAttachment).toEqual(attachment);
  });

  it("P2-10: persisted 事件携带 finalText 时立即替换正文，质检期间点击停止仍与后端权威定稿一致", async () => {
    const storage = createMemoryStorage();
    let releaseQuality: (() => void) | undefined;
    const controller = createChatController({
      storage,
      fetchImpl: async (_input, init) => {
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(sseChunk("knowledge", { revision: "a".repeat(64), sessionId: "sid-p2-10" }));
            c.enqueue(sseChunk("text", { text: "思考草稿：先检索再作答。\n\n权威定稿正文。" }));
            c.enqueue(
              sseChunk("persisted", {
                sessionId: "sid-p2-10",
                revision: "a".repeat(64),
                finalText: "权威定稿正文。",
              }),
            );
            c.enqueue(sseChunk("quality", { status: "checking" }));
            init?.signal?.addEventListener("abort", () => {
              try {
                c.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
              } catch {
                // already closed
              }
            });
            releaseQuality = () => {
              c.enqueue(sseChunk("done", { sessionId: "sid-p2-10", finalText: "权威定稿正文。" }));
              c.close();
            };
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      },
    });

    const sendPromise = controller.send("测试质检期间停止");
    await new Promise((r) => setTimeout(r, 20));

    // Before done arrives (during quality check), persisted.finalText must already replace streamed text
    expect(controller.getState().msgs[1]?.text).toBe("权威定稿正文。");
    expect(controller.getState().msgs[1]?.status).toBe("complete");

    // User clicks Stop between persisted and done
    controller.stop();
    await sendPromise;

    expect(releaseQuality).toBeDefined();
    expect(controller.getState().msgs[1]?.text).toBe("权威定稿正文。");
    expect(controller.getState().msgs[1]?.status).toBe("complete");
    expect(readChatHistory(storage).msgs[1]?.text).toBe("权威定稿正文。");
  });

  it("P2-10: persisted 之后收到的 error 事件或流读取异常不得篡改已落盘的 complete 正文", async () => {
    // 1. Trailing `event: error` after persisted
    const storage1 = createMemoryStorage();
    const c1 = createChatController({
      storage: storage1,
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(sseChunk("knowledge", { revision: "a".repeat(64), sessionId: "sid-err-after" }));
              c.enqueue(sseChunk("text", { text: "草稿\n\n权威定稿正文。" }));
              c.enqueue(
                sseChunk("persisted", {
                  sessionId: "sid-err-after",
                  revision: "a".repeat(64),
                  finalText: "权威定稿正文。",
                }),
              );
              c.enqueue(sseChunk("error", { message: "质检阶段偶发异常" }));
              c.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        ),
    });
    await c1.send("测试 persisted 后置 error");
    expect(c1.getState().msgs[1]?.text).toBe("权威定稿正文。");
    expect(c1.getState().msgs[1]?.status).toBe("complete");
    expect(readChatHistory(storage1).msgs[1]?.text).toBe("权威定稿正文。");

    // 2. Stream exception after persisted
    const storage2 = createMemoryStorage();
    const c2 = createChatController({
      storage: storage2,
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(sseChunk("knowledge", { revision: "a".repeat(64), sessionId: "sid-throw-after" }));
              c.enqueue(sseChunk("text", { text: "草稿\n\n权威定稿正文2。" }));
              c.enqueue(
                sseChunk("persisted", {
                  sessionId: "sid-throw-after",
                  revision: "a".repeat(64),
                  finalText: "权威定稿正文2。",
                }),
              );
              setTimeout(() => {
                c.error(new TypeError("network reset after persisted"));
              }, 10);
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        ),
    });
    await c2.send("测试 persisted 后置断流");
    expect(c2.getState().msgs[1]?.text).toBe("权威定稿正文2。");
    expect(c2.getState().msgs[1]?.status).toBe("complete");
    expect(readChatHistory(storage2).msgs[1]?.text).toBe("权威定稿正文2。");
  });
});
