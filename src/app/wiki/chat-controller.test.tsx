import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as ApiModule from "./api";
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
    expect(c1.getState().msgs[1]?.toolNotice).toContain("质检阶段偶发异常");
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

  it("[A1 & A2] distinguishes local service-down (x-wiki-backend-offline / ECONNREFUSED) from pure static build, renders 重新连接, deduplicates health probes, and preserves draft & pendingAttachment", async () => {
    const storage = createMemoryStorage();
    const origFetch = globalThis.fetch;
    try {
      // 1. Local Vite proxy header `x-wiki-backend-offline: 1` -> sets "service-down" (NOT "offline" / StaticBackendOfflineError)
      globalThis.fetch = async () =>
        new Response("offline", {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8", "x-wiki-backend-offline": "1" },
        });
      await expect(ApiModule.wikiRequest("pages")).rejects.toThrow();
      expect(ApiModule.getBackendAvailability() as string).toBe("service-down");

      // 2. Pure static SPA HTML fallback WITHOUT `x-wiki-backend-offline: 1` -> sets "offline" (StaticBackendOfflineError)
      globalThis.fetch = async () =>
        new Response("<!doctype html><html></html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      await expect(ApiModule.wikiRequest("pages")).rejects.toSatisfy((e) =>
        ApiModule.isStaticOfflineError(e),
      );
      expect(ApiModule.getBackendAvailability()).toBe("offline");

      // 3. Switch back to service-down and verify WikiPanel & ChatPane UI + draft/pendingAttachment preservation across reconnect
      setBackendAvailability("service-down" as never);
      const sentPayloads: Array<{ message: string }> = [];
      const controller = createChatController({
        storage,
        fetchImpl: async (_input, init) => {
          sentPayloads.push(JSON.parse(String(init?.body ?? "{}")) as { message: string });
          const stream = new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(sseChunk("text", { text: "重连成功后正常回答。" }));
              c.enqueue(sseChunk("done", { sessionId: "sid-reconnected" }));
              c.close();
            },
          });
          return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
        },
      });

      const attachment = {
        title: "配置体检脱敏摘要",
        summary: "2 项告警",
        sanitizedBlock: "vllm serve Qwen/Qwen3-8B",
      };
      controller.setInput("我敲到一半的本地排障问题");
      controller.setPendingAttachment(attachment);

      // Sending while service-down must be blocked without losing draft or attachment
      await controller.send();
      expect(sentPayloads).toHaveLength(0);
      expect(controller.getState().input).toBe("我敲到一半的本地排障问题");
      expect(controller.getState().pendingAttachment).toEqual(attachment);

      const serviceDownPanelHtml = renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(WikiPanel, {
            revision: "deadbeef12345678",
            mode: "local",
            chat: controller.getState(),
            layout: "chat",
            onLayout: () => {},
            onRefresh: async () => false,
          }),
        ),
      );
      expect(serviceDownPanelHtml).toContain("问答服务未启动");
      expect(serviceDownPanelHtml).toContain("重新连接");
      expect(serviceDownPanelHtml).not.toContain("纯静态离线浏览");

      const serviceDownChatHtml = renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(ChatPane, {
            id: "wiki-panel-chat",
            chat: controller.getState(),
            hidden: false,
            onReview: () => {},
          }),
        ),
      );
      expect(serviceDownChatHtml).toContain(
        "本地问答服务未启动：请在终端运行 pnpm dev:server（或 pnpm dev:all），再点上方「重新连接」",
      );

      // 4. Probe health deduplicating concurrent clicks -> flips to "online" while preserving draft & pendingAttachment
      const probeFn = (
        ApiModule as unknown as {
          probeBackendHealth?: (fetchImpl?: typeof fetch) => Promise<string>;
        }
      ).probeBackendHealth;
      expect(probeFn).toBeTypeOf("function");

      let healthCalls = 0;
      const healthFetch: typeof fetch = async () => {
        healthCalls += 1;
        await new Promise((r) => setTimeout(r, 15));
        return new Response(JSON.stringify({ ok: true, pages: 42, revision: "a".repeat(64) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      };
      const [r1, r2, r3] = await Promise.all([
        probeFn!(healthFetch),
        probeFn!(healthFetch),
        probeFn!(healthFetch),
      ]);
      expect(healthCalls).toBe(1);
      expect([r1, r2, r3]).toEqual(["online", "online", "online"]);
      expect(ApiModule.getBackendAvailability()).toBe("online");
      expect(controller.getState().input).toBe("我敲到一半的本地排障问题");
      expect(controller.getState().pendingAttachment).toEqual(attachment);

      // Now user clicks Send -> draft + attachment go out cleanly!
      await controller.send();
      expect(sentPayloads).toHaveLength(1);
      expect(sentPayloads[0]?.message).toContain("我敲到一半的本地排障问题");
      expect(sentPayloads[0]?.message).toContain("vllm serve Qwen/Qwen3-8B");
      expect(controller.getState().msgs[1]?.status).toBe("complete");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("[A3 & B3] parses CRLF SSE frames split mid-CRLF across chunks without marking interrupted, and surfaces post-persisted error/notice as toolNotice", async () => {
    const storage = createMemoryStorage();
    const enc = new TextEncoder();
    const controller = createChatController({
      storage,
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              const rev = "a".repeat(64);
              // Split `\r` and `\n` right across chunk boundaries!
              c.enqueue(
                enc.encode(`event: knowledge\r\ndata: {"revision":"${rev}","sessionId":"sid-crlf"}\r`),
              );
              c.enqueue(enc.encode("\n\r"));
              c.enqueue(enc.encode("\nevent: text\r"));
              c.enqueue(enc.encode('\ndata: {"text":"CRLF 代理完整正文。"}\r\n\r'));
              c.enqueue(
                enc.encode(
                  `\nevent: persisted\r\ndata: {"sessionId":"sid-crlf","revision":"${rev}"}\r\n\r\n`,
                ),
              );
              c.enqueue(
                enc.encode(
                  'event: notice\r\ndata: {"kind":"receipt-save-failed","message":"回答回执未能保存，暂无法存入 Wiki"}\r\n\r\n',
                ),
              );
              c.enqueue(enc.encode('event: done\r\ndata: {"sessionId":"sid-crlf"}\r\n\r'));
              c.enqueue(enc.encode("\n"));
              c.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        ),
    });

    await controller.send("测试 CRLF 分片");
    const msg = controller.getState().msgs[1]!;
    expect(msg.status).toBe("complete");
    expect(msg.text).toBe("CRLF 代理完整正文。");
    expect(msg.toolNotice).toContain("回答回执未能保存");
    expect(readChatHistory(storage).sessionId).toBe("sid-crlf");
  });

  it("[R2-P2-5] restores draft & structured attachment on first-send disconnect, prevents stale failures from clobbering online, and times out hung health probes", async () => {
    const storage = createMemoryStorage();
    setBackendAvailability("online");

    let backendUp = false;
    const sentPayloads: Array<{ message: string; analysis?: unknown }> = [];
    const controller = createChatController({
      storage,
      fetchImpl: async (_input, init) => {
        if (!backendUp) {
          return new Response("service-down", {
            status: 200,
            headers: { "content-type": "text/plain", "x-wiki-backend-offline": "1" },
          });
        }
        sentPayloads.push(JSON.parse(String(init?.body ?? "{}")) as { message: string; analysis?: unknown });
        return new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(sseChunk("text", { text: "重连后完整携带结构化分析载荷。" }));
              c.enqueue(sseChunk("done", { sessionId: "sid-r2" }));
              c.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      },
    });

    const structuredAttachment = {
      title: "部署算账快照",
      summary: "Qwen3-8B · A2 64G",
      sanitizedBlock: "TP=2",
      analysis: { kind: "deploy" as const, model: "qwen3-8b", cardId: "a2-64g" as const, tpSize: 2 },
    };
    controller.setInput("首次发送即断连的草稿");
    controller.setPendingAttachment(structuredAttachment);

    // 1. First send hits service-down before stream starts -> draft & structured attachment restored, no dead summary bubble!
    await controller.send();
    expect(ApiModule.getBackendAvailability()).toBe("service-down");
    expect(controller.getState().input).toBe("首次发送即断连的草稿");
    expect(controller.getState().pendingAttachment).toEqual(structuredAttachment);
    expect(controller.getState().msgs).toHaveLength(0);

    // 2. Hung `/health` probe times out cleanly without wedging future reconnect attempts!
    const probeWithTimeout = ApiModule.probeBackendHealth as (
      f?: typeof fetch,
      timeoutMs?: number,
    ) => Promise<string>;
    const hungResult = await probeWithTimeout(() => new Promise<Response>(() => {}), 25);
    expect(hungResult).toBe("service-down");

    // 3. Stale in-flight wikiRequest started BEFORE probeBackendHealth succeeds cannot clobber "online" back to "service-down"
    const origFetch = globalThis.fetch;
    try {
      let rejectStale!: (err: Error) => void;
      globalThis.fetch = () =>
        new Promise<Response>((_resolve, reject) => {
          rejectStale = reject;
        });
      const staleReq = ApiModule.wikiRequest("reviews");

      // Meanwhile health probe succeeds -> sets "online"
      const recovered = await probeWithTimeout(
        async () =>
          new Response(JSON.stringify({ ok: true, pages: 10, revision: "a".repeat(64) }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        500,
      );
      expect(recovered).toBe("online");
      expect(ApiModule.getBackendAvailability()).toBe("online");

      // Stale request rejects AFTER online recovery -> must NOT clobber "online"!
      rejectStale(new TypeError("stale network failure"));
      await expect(staleReq).rejects.toThrow();
      expect(ApiModule.getBackendAvailability()).toBe("online");
    } finally {
      globalThis.fetch = origFetch;
    }

    // 4. Re-sending now sends BOTH restored draft AND structured `analysis` payload!
    backendUp = true;
    await controller.send();
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0]?.message).toContain("首次发送即断连的草稿");
    expect(sentPayloads[0]?.analysis).toEqual(structuredAttachment.analysis);
  });

  it("[R3-P2-9-10-11] preserves draft & attachment on 200 SSE pre-frame EOF/reset, losslessly merges concurrent typing B with sent draft A, and guards refresh() static offline against stale epochs", async () => {
    const storage = createMemoryStorage();
    setBackendAvailability("online");

    const attachmentD1 = {
      title: "排障快照 D1",
      summary: "EI0006 诊断",
      sanitizedBlock: "HCCL timeout",
      analysis: { kind: "troubleshoot" as const, rawInput: "HCCL timeout" },
    };

    // 1. P2-9: 200 text/event-stream returns empty EOF (0 SSE frames) -> draft & structured attachment restored!
    let scenario: "empty-eof" | "stream-reset" | "typing-while-offline" = "empty-eof";
    let releaseOfflineResp!: () => void;
    const controller = createChatController({
      storage,
      fetchImpl: async () => {
        if (scenario === "empty-eof") {
          return new Response(
            new ReadableStream<Uint8Array>({
              start(c) {
                c.close();
              },
            }),
            { status: 200, headers: { "content-type": "text/event-stream" } },
          );
        }
        if (scenario === "stream-reset") {
          return new Response(
            new ReadableStream<Uint8Array>({
              pull() {
                return Promise.reject(new TypeError("TCP connection reset before first SSE frame"));
              },
            }),
            { status: 200, headers: { "content-type": "text/event-stream" } },
          );
        }
        await new Promise<void>((r) => {
          releaseOfflineResp = r;
        });
        return new Response("offline", {
          status: 200,
          headers: { "content-type": "text/plain", "x-wiki-backend-offline": "1" },
        });
      },
    });

    controller.setInput("长问题草稿 P2-9");
    controller.setPendingAttachment(attachmentD1);
    await controller.send();
    expect(controller.getState().input).toBe("长问题草稿 P2-9");
    expect(controller.getState().pendingAttachment).toEqual(attachmentD1);
    expect(controller.getState().msgs).toHaveLength(0);

    // Stream TCP reset before first SSE frame also preserves draft & attachment!
    setBackendAvailability("online");
    scenario = "stream-reset";
    await controller.send();
    expect(controller.getState().input).toBe("长问题草稿 P2-9");
    expect(controller.getState().pendingAttachment).toEqual(attachmentD1);
    expect(controller.getState().msgs).toHaveLength(0);

    // 2. P2-10: Send draft A + attachment D1, type B while waiting, then offline -> A is preserved alongside B (never lost)!
    setBackendAvailability("online");
    scenario = "typing-while-offline";
    controller.setInput("原草稿 A");
    controller.setPendingAttachment(attachmentD1);
    const sendPromise = controller.send();
    await new Promise((r) => setTimeout(r, 10));
    controller.setInput("等待期间新打的 B");
    releaseOfflineResp();
    await sendPromise;
    expect(controller.getState().input).toContain("原草稿 A");
    expect(controller.getState().input).toContain("等待期间新打的 B");
    expect(controller.getState().pendingAttachment).toEqual(attachmentD1);

    // 3. P2-11: Stale `/pages` returning static HTML (triggering StaticBackendOfflineError) + stale `/reviews` rejecting AFTER `/health` reconnect MUST NOT clobber "online" or reset lastOnlineEpoch!
    const origFetch = globalThis.fetch;
    try {
      let resolveStalePages!: (r: Response) => void;
      let rejectStaleReviews!: (e: Error) => void;
      globalThis.fetch = (input) => {
        const url = String(input);
        if (url.includes("/pages")) {
          return new Promise<Response>((r) => {
            resolveStalePages = r;
          });
        }
        return new Promise<Response>((_r, rej) => {
          rejectStaleReviews = rej;
        });
      };

      const { runAssistantSnapshotRefresh } = await import("./assistant-context");
      const staleRefreshPromise = runAssistantSnapshotRefresh();
      const staleReviewsReq = ApiModule.wikiRequest("reviews");

      // Reconnect probe succeeds -> online!
      const probeRes = await ApiModule.probeBackendHealth(
        async () =>
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      );
      expect(probeRes).toBe("online");
      expect(ApiModule.getBackendAvailability()).toBe("online");

      // Stale `/pages` resolves with static SPA HTML -> runs REAL assistant-context refresh catch!
      resolveStalePages(
        new Response("<!doctype html><html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
      await expect(staleRefreshPromise).resolves.toBe(false);
      expect(ApiModule.getBackendAvailability()).toBe("online");

      // Stale `/reviews` rejects right after -> must STILL stay "online"!
      rejectStaleReviews(new TypeError("stale reviews failed"));
      await expect(staleReviewsReq).rejects.toThrow();
      expect(ApiModule.getBackendAvailability()).toBe("online");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("[R4-Inv4 & R4-Inv5] handles upstream DOMException AbortError when !signal.aborted, preserves leading 4-space indent, keeps retryAttachment on D2 collision, and commits monotonic startSeq watermarks", async () => {
    const storage = createMemoryStorage();
    setBackendAvailability("online");

    const d1 = {
      title: "部署快照 D1",
      summary: "Qwen3-8B",
      sanitizedBlock: "TP=2",
      analysis: { kind: "deploy" as const, model: "qwen3-8b", cardId: "a2-64g" as const, tpSize: 2 },
    };
    const d2 = {
      title: "排障快照 D2",
      summary: "EI0006",
      sanitizedBlock: "ERROR EI0006",
      analysis: { kind: "troubleshoot" as const, rawInput: "ERROR EI0006" },
    };

    let mode: "upstream-abort" | "indent-merge" | "d2-collision" | "live-ok" = "upstream-abort";
    let releaseTurn!: () => void;
    const sentBodies: Array<{ message: string; analysis?: unknown }> = [];

    const controller = createChatController({
      storage,
      fetchImpl: async (_input, init) => {
        if (mode === "upstream-abort") {
          return new Response(
            new ReadableStream<Uint8Array>({
              start(c) {
                c.error(new DOMException("upstream cancelled", "AbortError"));
              },
            }),
            { status: 200, headers: { "content-type": "text/event-stream" } },
          );
        }
        if (mode === "indent-merge" || mode === "d2-collision") {
          await new Promise<void>((r) => {
            releaseTurn = r;
          });
          return new Response(
            new ReadableStream<Uint8Array>({
              start(c) {
                c.close();
              },
            }),
            { status: 200, headers: { "content-type": "text/event-stream" } },
          );
        }
        sentBodies.push(JSON.parse(String(init?.body ?? "{}")) as { message: string; analysis?: unknown });
        return new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(sseChunk("text", { text: "重试成功恢复 D1.analysis" }));
              c.enqueue(sseChunk("done", { sessionId: "sid-r4" }));
              c.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      },
    });

    // 1. P2-9: Upstream throws DOMException("upstream cancelled", "AbortError") while client signal.aborted === false
    controller.setInput("上游 AbortError 草稿");
    controller.setPendingAttachment(d1);
    await controller.send();
    expect(controller.getState().input).toBe("上游 AbortError 草稿");
    expect(controller.getState().pendingAttachment).toEqual(d1);
    expect(controller.getState().msgs).toHaveLength(0);

    // 2. P2-10a: Leading 4-space code indentation on line 1 is preserved verbatim when merging with concurrent input B
    setBackendAvailability("online");
    mode = "indent-merge";
    controller.setPendingAttachment(null);
    controller.setInput("    vllm serve Qwen/Qwen3-8B --tp 2");
    const indentPromise = controller.send();
    await new Promise((r) => setTimeout(r, 10));
    controller.setInput("补充说明 B");
    releaseTurn();
    await indentPromise;
    expect(controller.getState().input).toBe("    vllm serve Qwen/Qwen3-8B --tp 2\n补充说明 B");

    // 3. P2-10b: User sends A + D1, then types B AND attaches D2 while waiting -> failed message retains `retryAttachment` with full `D1.analysis`, and retryFailedMessage resends A + D1.analysis!
    setBackendAvailability("online");
    mode = "d2-collision";
    controller.setInput("原问题 A");
    controller.setPendingAttachment(d1);
    const d2Promise = controller.send();
    await new Promise((r) => setTimeout(r, 10));
    controller.setInput("新问题 B");
    controller.setPendingAttachment(d2);
    releaseTurn();
    await d2Promise;

    expect(controller.getState().input).toBe("新问题 B");
    expect(controller.getState().pendingAttachment).toEqual(d2);
    const failedAgentMsg = controller.getState().msgs.find((m) => m.role === "agent");
    expect(failedAgentMsg?.status).toBe("failed");
    expect(failedAgentMsg?.retryAttachment?.analysis).toEqual(d1.analysis);

    setBackendAvailability("online");
    mode = "live-ok";
    const retryFn = (controller as unknown as { retryFailedMessage?: (key: string) => Promise<void> })
      .retryFailedMessage;
    expect(typeof retryFn).toBe("function");
    await retryFn!(failedAgentMsg!.key);
    expect(sentBodies).toHaveLength(1);
    expect(sentBodies[0]?.message).toContain("原问题 A");
    expect(sentBodies[0]?.analysis).toEqual(d1.analysis);
    expect(controller.getState().input).toBe("新问题 B");
    expect(controller.getState().pendingAttachment).toEqual(d2);

    // 4. P2-11 (Invariant 5): Old `/reviews` (seq=1) fails FIRST, then newer `refresh()` `/pages` (seq=2) returns 304 -> state MUST become "online"!
    const origFetch = globalThis.fetch;
    try {
      let rejectOldReviews!: (e: Error) => void;
      let resolveNewPages304!: (r: Response) => void;
      globalThis.fetch = (input) => {
        const url = String(input);
        if (url.includes("/reviews")) {
          return new Promise<Response>((_r, rej) => {
            rejectOldReviews = rej;
          });
        }
        return new Promise<Response>((r) => {
          resolveNewPages304 = r;
        });
      };

      const oldReviewsPromise = ApiModule.wikiRequest("reviews");
      const { runAssistantSnapshotRefresh } = await import("./assistant-context");
      const newRefreshPromise = runAssistantSnapshotRefresh();

      // Old seq=1 fails FIRST -> "service-down"
      rejectOldReviews(new TypeError("old reviews ECONNREFUSED"));
      await expect(oldReviewsPromise).rejects.toThrow();
      expect(ApiModule.getBackendAvailability()).toBe("service-down");

      // Newer seq=2 returns 304 Not Modified -> startSeq >= newestVerdictStartSeq -> MUST flip to "online"!
      resolveNewPages304(new Response(null, { status: 304 }));
      await newRefreshPromise;
      expect(ApiModule.getBackendAvailability()).toBe("online");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("[R5-P2-5 & R5-P2-6] persists failed message retryAttachment across reload into ChatDrawer retry button, and binds deduplicated snapshot refresh to actual underlying HTTP startSeq", async () => {
    const storage = createMemoryStorage();
    const d1 = {
      title: "D1 部署算账快照",
      summary: "Qwen3-8B · A2 64G",
      sanitizedBlock: "vllm serve Qwen/Qwen3-8B --tp 2",
      analysis: {
        kind: "deploy" as const,
        model: "qwen3-8b",
        cardId: "a2-64g" as const,
        tpSize: 2,
      },
    };
    const d2 = {
      title: "D2 排障摘要",
      summary: "HCCL timeout",
      sanitizedBlock: "ERROR EI0006",
      analysis: { kind: "troubleshoot" as const, rawInput: "ERROR EI0006" },
    };

    // 1. P2-5: Fail A + D1 while D2 occupies pendingAttachment, flush to storage, reload a brand-new controller from storage, verify retryFailedMessage still sends full D1.analysis!
    let releaseFailTurn!: () => void;
    const c1 = createChatController({
      storage,
      fetchImpl: async () => {
        await new Promise<void>((r) => {
          releaseFailTurn = r;
        });
        return new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      },
    });
    setBackendAvailability("online");
    c1.setInput("原问题 A（跨刷新保留）");
    c1.setPendingAttachment(d1);
    const p1 = c1.send();
    await new Promise((r) => setTimeout(r, 10));
    c1.setInput("新草稿 B");
    c1.setPendingAttachment(d2);
    releaseFailTurn();
    await p1;
    c1.flush();

    // Reload from localStorage into a brand-new controller instance
    const reloadedPayloads: Array<{ message: string; analysis?: unknown }> = [];
    setBackendAvailability("online");
    const c2 = createChatController({
      storage,
      fetchImpl: async (_input, init) => {
        reloadedPayloads.push(
          JSON.parse(String(init?.body ?? "{}")) as { message: string; analysis?: unknown },
        );
        return new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(sseChunk("text", { text: "刷新后重试成功" }));
              c.enqueue(sseChunk("done", { sessionId: "sid-r5" }));
              c.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      },
    });
    const reloadedFailedMsg = c2.getState().msgs.find((m) => m.role === "agent" && m.status === "failed");
    expect(reloadedFailedMsg).toBeDefined();
    expect(reloadedFailedMsg?.retryAttachment?.analysis).toEqual(d1.analysis);

    const drawerHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(ChatPane, {
          id: "wiki-panel-chat",
          chat: c2.getState(),
          backendAvailable: "online",
          hidden: false,
          onReview: () => {},
        }),
      ),
    );
    expect(drawerHtml).toContain('data-testid="chat-retry-failed"');
    expect(drawerHtml).toContain("重试发送");

    await c2.retryFailedMessage!(reloadedFailedMsg!.key);
    expect(reloadedPayloads).toHaveLength(1);
    expect(reloadedPayloads[0]?.message).toContain("原问题 A（跨刷新保留）");
    expect(reloadedPayloads[0]?.analysis).toEqual(d1.analysis);

    // 2. P2-6: R1 starts /pages (seq=1), then /reviews starts (seq=2), then R2 deduplicates onto R1's /pages (MUST reuse seq=1, NOT mint seq=3!).
    // When /reviews (seq=2) fails first -> "service-down", and old /pages (seq=1) resolves 304 afterwards, state MUST stay "service-down"!
    const origFetch = globalThis.fetch;
    try {
      let resolveSharedPages304!: (r: Response) => void;
      let rejectNewerReviews!: (e: Error) => void;
      let pagesFetchCalls = 0;
      globalThis.fetch = (input) => {
        const url = String(input);
        if (url.includes("/pages")) {
          pagesFetchCalls += 1;
          return new Promise<Response>((r) => {
            resolveSharedPages304 = r;
          });
        }
        return new Promise<Response>((_r, rej) => {
          rejectNewerReviews = rej;
        });
      };

      const { runAssistantSnapshotRefresh } = await import("./assistant-context");
      const r1 = runAssistantSnapshotRefresh();
      const reviewsReq = ApiModule.wikiRequest("reviews");
      const r2 = runAssistantSnapshotRefresh();
      expect(pagesFetchCalls).toBe(1);

      // Newer /reviews (seq=2) fails FIRST -> "service-down"
      rejectNewerReviews(new TypeError("reviews ECONNREFUSED"));
      await expect(reviewsReq).rejects.toThrow();
      expect(ApiModule.getBackendAvailability()).toBe("service-down");

      // Older deduplicated /pages (seq=1) finishes 304 afterwards -> MUST NOT clobber "service-down" back to "online"!
      resolveSharedPages304(new Response(null, { status: 304 }));
      await Promise.all([r1, r2]);
      expect(ApiModule.getBackendAvailability()).toBe("service-down");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("[R6-5 & R6-6] tolerates out-of-range/corrupted retryAttachment fields without wiping chat history, re-persists failed retry across repeated disconnects, and keeps service-down when deduplicated snapshot refresh rejects", async () => {
    const storage = createMemoryStorage();

    // 1. R6-5a: Out-of-range `maxNumSeqs: 65537` and malformed `retryAttachment` on a single message MUST NOT wipe out chat history!
    storage.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify({
        version: 1,
        input: "保留草稿",
        msgs: [
          { key: "m1-u", role: "user", text: "历史第一问" },
          {
            key: "m1-a",
            role: "agent",
            text: "失败一",
            status: "failed",
            rawDraft: "历史第一问",
            retryAttachment: {
              title: "算账超范围参数",
              summary: "65537 seqs",
              sanitizedBlock: "vllm serve Qwen",
              analysis: { kind: "deploy", model: "qwen3-8b", cardId: "a2-64g", maxNumSeqs: 65537 },
            },
          },
          {
            key: "m2-a",
            role: "agent",
            text: "损坏附件消息仍保留正文",
            status: "failed",
            retryAttachment: { broken: 123 },
          },
        ],
      }),
    );
    const parsedHistory = readChatHistory(storage);
    expect(parsedHistory.msgs).toHaveLength(3);
    expect(parsedHistory.msgs[1]?.retryAttachment?.title).toBe("算账超范围参数");
    expect(parsedHistory.msgs[2]?.text).toBe("损坏附件消息仍保留正文");
    expect(parsedHistory.msgs[2]?.retryAttachment).toBeUndefined();

    // 2. R6-5b: Reload controller -> click `retryFailedMessage` while STILL offline (throws TypeError) -> reload AGAIN -> retryAttachment + analysis MUST survive in storage!
    const retryStore = createMemoryStorage();
    const d1 = {
      title: "跨连续断网保留快照",
      summary: "Qwen3-8B",
      sanitizedBlock: "vllm serve Qwen/Qwen3-8B --tp 4",
      analysis: { kind: "deploy" as const, model: "qwen3-8b", cardId: "a2-64g" as const, tpSize: 4 },
    };
    retryStore.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify({
        version: 1,
        input: "输入框里正在写的另一段话",
        msgs: [
          { key: "r-u", role: "user", text: "原问题", rawDraft: "原问题", retryAttachment: d1 },
          {
            key: "r-a",
            role: "agent",
            text: "上次失败",
            status: "failed",
            rawDraft: "原问题",
            retryAttachment: d1,
          },
        ],
      }),
    );

    setBackendAvailability("online");
    const cOfflineRetry = createChatController({
      storage: retryStore,
      fetchImpl: async () => {
        throw new TypeError("still ECONNREFUSED on retry");
      },
    });
    await cOfflineRetry.retryFailedMessage!("r-a");
    cOfflineRetry.flush();

    // Reload a third controller after the failed retry: failed message & D1.analysis MUST still be persisted!
    const sentAfterReconnect: Array<{ message: string; analysis?: unknown }> = [];
    setBackendAvailability("online");
    const cAfterSecondReload = createChatController({
      storage: retryStore,
      fetchImpl: async (_input, init) => {
        sentAfterReconnect.push(
          JSON.parse(String(init?.body ?? "{}")) as { message: string; analysis?: unknown },
        );
        return new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(sseChunk("text", { text: "恢复连接后重试成功" }));
              c.enqueue(sseChunk("done", { sessionId: "sid-r6" }));
              c.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      },
    });
    const survivingFailed = cAfterSecondReload
      .getState()
      .msgs.find((m) => m.role === "agent" && m.status === "failed");
    expect(survivingFailed).toBeDefined();
    expect(survivingFailed?.retryAttachment?.analysis).toEqual(d1.analysis);
    expect(cAfterSecondReload.getState().input).toBe("输入框里正在写的另一段话");

    await cAfterSecondReload.retryFailedMessage!(survivingFailed!.key);
    expect(sentAfterReconnect).toHaveLength(1);
    expect(sentAfterReconnect[0]?.analysis).toEqual(d1.analysis);

    // 3. R6-6: Concurrent `r1` and `r2` share one `/pages` fetch which rejects with `ECONNREFUSED`:
    // superseded `r1` swallowed in `reader-store` MUST NOT report `"online"` over `"service-down"`!
    const origFetch = globalThis.fetch;
    try {
      let rejectSharedPages!: (e: Error) => void;
      globalThis.fetch = () =>
        new Promise<Response>((_r, rej) => {
          rejectSharedPages = rej;
        });

      setBackendAvailability("online");
      const { runAssistantSnapshotRefresh } = await import("./assistant-context");
      const r1 = runAssistantSnapshotRefresh();
      const r2 = runAssistantSnapshotRefresh();

      rejectSharedPages(new TypeError("pages ECONNREFUSED"));
      const settled = await Promise.allSettled([r1, r2]);
      expect(settled.some((s) => s.status === "rejected")).toBe(true);
      expect(ApiModule.getBackendAvailability()).toBe("service-down");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("[R7-3 & R7-4] preserves retryAttachment & ChatDrawer retry button when retry is interrupted on pagehide, and never leaks failed isolated retryAttachment into compose pendingAttachment", async () => {
    const storage = createMemoryStorage();
    const d1 = {
      title: "D1 独立重试附件",
      summary: "Qwen3-8B",
      sanitizedBlock: "vllm serve Qwen/Qwen3-8B --tp 2",
      analysis: { kind: "deploy" as const, model: "qwen3-8b", cardId: "a2-64g" as const, tpSize: 2 },
    };

    storage.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify({
        version: 1,
        input: "另一份正在敲的新草稿（无附件）",
        msgs: [
          { key: "old-u", role: "user", text: "旧问题", rawDraft: "旧问题", retryAttachment: d1 },
          {
            key: "old-a",
            role: "agent",
            text: "旧失败",
            status: "failed",
            rawDraft: "旧问题",
            retryAttachment: d1,
          },
        ],
      }),
    );

    // 1. R7-4: Isolated retry fails with TypeError while compose box has `"另一份正在敲的新草稿（无附件）"` and `pendingAttachment === null`:
    // MUST NOT copy `d1` into `pendingAttachment` or leak `d1` into subsequent send of the new draft!
    let mode: "fail-retry" | "send-new-draft" | "hang-for-pagehide" | "retry-ok" = "fail-retry";
    const sentBodies: Array<{ message: string; analysis?: unknown }> = [];
    let releaseHung!: () => void;

    setBackendAvailability("online");
    const c1 = createChatController({
      storage,
      fetchImpl: async (_input, init) => {
        if (mode === "fail-retry") {
          throw new TypeError("isolated retry ECONNREFUSED");
        }
        if (mode === "hang-for-pagehide") {
          await new Promise<void>((r) => {
            releaseHung = r;
          });
          return new Response(
            new ReadableStream({
              start(c) {
                c.close();
              },
            }),
            {
              status: 200,
              headers: { "content-type": "text/event-stream" },
            },
          );
        }
        sentBodies.push(JSON.parse(String(init?.body ?? "{}")) as { message: string; analysis?: unknown });
        return new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(sseChunk("text", { text: "ok" }));
              c.enqueue(sseChunk("done", { sessionId: "sid-r7" }));
              c.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      },
    });

    await c1.retryFailedMessage!("old-a");
    expect(c1.getState().input).toBe("另一份正在敲的新草稿（无附件）");
    expect(c1.getState().pendingAttachment).toBeNull();

    setBackendAvailability("online");
    mode = "send-new-draft";
    await c1.send();
    expect(sentBodies).toHaveLength(1);
    expect(sentBodies[0]?.message).toBe("另一份正在敲的新草稿（无附件）");
    expect(sentBodies[0]?.analysis).toBeUndefined();

    // 2. R7-3: Start retry on the surviving failed bubble, fire `flush()` (simulating `pagehide`) while `pending`, reload a new controller:
    // `interrupted` message MUST retain `retryAttachment.analysis`, `ChatPane` MUST render `chat-retry-failed`, and retrying sends `d1.analysis`!
    const failedStillThere = c1.getState().msgs.find((m) => m.role === "agent" && m.status === "failed");
    expect(failedStillThere).toBeDefined();

    mode = "hang-for-pagehide";
    const hungRetry = c1.retryFailedMessage!(failedStillThere!.key);
    await new Promise((r) => setTimeout(r, 10));
    c1.flush(); // simulates pagehide flushing pending turn to storage

    // Reload brand-new controller while previous retry was pending -> becomes `interrupted`
    const reloadedSent: Array<{ message: string; analysis?: unknown }> = [];
    setBackendAvailability("online");
    const c2 = createChatController({
      storage,
      fetchImpl: async (_input, init) => {
        reloadedSent.push(JSON.parse(String(init?.body ?? "{}")) as { message: string; analysis?: unknown });
        return new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(sseChunk("text", { text: "interrupted retry ok" }));
              c.enqueue(sseChunk("done", { sessionId: "sid-r7-2" }));
              c.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      },
    });

    releaseHung();
    await hungRetry.catch(() => {});

    const interruptedMsg = c2.getState().msgs.find((m) => m.role === "agent" && m.status === "interrupted");
    expect(interruptedMsg).toBeDefined();
    expect(interruptedMsg?.retryAttachment?.analysis).toEqual(d1.analysis);

    const interruptedHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(ChatPane, {
          id: "wiki-panel-chat",
          chat: c2.getState(),
          backendAvailable: "online",
          hidden: false,
          onReview: () => {},
        }),
      ),
    );
    expect(interruptedHtml).toContain('data-testid="chat-retry-failed"');

    await c2.retryFailedMessage!(interruptedMsg!.key);
    expect(reloadedSent).toHaveLength(1);
    expect(reloadedSent[0]?.analysis).toEqual(d1.analysis);
  });
});
