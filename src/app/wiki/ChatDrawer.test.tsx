import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import * as ChatDrawerModule from "./ChatDrawer";
import { CHAT_HISTORY_KEY, readChatHistory } from "./chat-history";

interface FakeStorage {
  data: Map<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function createMemoryStorage(): FakeStorage {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function sseChunk(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

describe("ChatDrawer 会话早期持久化与卸载刷盘", () => {
  it("收到 persisted 后立即持久化完整回答；在独立核对期间点击停止保留 complete 与 sessionId，且不渲染入库按钮", async () => {
    const createChatController = (
      ChatDrawerModule as unknown as {
        createChatController?: (deps: {
          storage: Pick<Storage, "getItem" | "setItem">;
          fetchImpl: typeof fetch;
        }) => {
          getState: () => ReturnType<typeof ChatDrawerModule.useChat> & { sessionId?: string };
          send: (preset?: string) => Promise<void>;
          stop: () => void;
          dispose: () => void;
        };
      }
    ).createChatController;
    expect(createChatController).toBeTypeOf("function");

    const storage = createMemoryStorage();
    let seenBodies: Array<{ message: string; sessionId?: string }> = [];
    let checkingReached!: () => void;
    const onChecking = new Promise<void>((resolve) => {
      checkingReached = resolve;
    });

    let call = 0;
    const fetchImpl: typeof fetch = async (_input, init) => {
      call++;
      seenBodies = [
        ...seenBodies,
        JSON.parse(String(init?.body ?? "{}")) as { message: string; sessionId?: string },
      ];
      if (call === 1) {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              sseChunk("knowledge", { revision: "a".repeat(64), sessionId: "sid-1", online: true }),
            );
            controller.enqueue(sseChunk("text", { text: "已完成引用的回答。" }));
            controller.enqueue(sseChunk("cite", { cited: true, selfDeclaredUncovered: false }));
            controller.enqueue(sseChunk("persisted", { sessionId: "sid-1", revision: "a".repeat(64) }));
            controller.enqueue(sseChunk("quality", { status: "checking" }));
            checkingReached();
            init?.signal?.addEventListener(
              "abort",
              () => {
                controller.error(Object.assign(new Error("Aborted"), { name: "AbortError" }));
              },
              { once: true },
            );
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            sseChunk("knowledge", { revision: "a".repeat(64), sessionId: "sid-1", online: true }),
          );
          controller.enqueue(sseChunk("text", { text: "续接会话的第二轮回答。" }));
          controller.enqueue(sseChunk("cite", { cited: true, selfDeclaredUncovered: false }));
          controller.enqueue(sseChunk("persisted", { sessionId: "sid-1", revision: "a".repeat(64) }));
          controller.enqueue(
            sseChunk("done", { sessionId: "sid-1", answerId: "b".repeat(64), revision: "a".repeat(64) }),
          );
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };

    const controller = createChatController!({ storage, fetchImpl });
    const firstTurn = controller.send("第一问");
    await onChecking;
    await expect.poll(() => controller.getState().msgs[1]?.quality?.status).toBe("checking");

    // persisted 到达后，即便尚未结束独立核对，localStorage 已落盘 complete 状态与 sessionId
    const midSaved = readChatHistory(storage);
    expect(midSaved.sessionId).toBe("sid-1");
    expect(midSaved.msgs[1]?.status).toBe("complete");
    expect(midSaved.msgs[1]?.answerId).toBeUndefined();

    // 在独立核对期间点停止：不应回退成 interrupted，也不得丢失 sessionId 或冒出 answerId
    controller.stop();
    await firstTurn;

    const afterStop = controller.getState();
    const firstAgent = afterStop.msgs[1]!;
    expect(firstAgent.status).toBe("complete");
    expect(firstAgent.text).toBe("已完成引用的回答。");
    expect(firstAgent.quality).toMatchObject({ status: "unavailable" });
    expect(firstAgent.answerId).toBeUndefined();

    const html = renderToStaticMarkup(
      <ChatDrawerModule.ChatPane id="chat" chat={afterStop} hidden={false} onReview={() => {}} />,
    );
    expect(html).not.toContain("回答已中断");
    expect(html).not.toContain("存进 Wiki");

    await controller.send("追问第二问");
    expect(seenBodies[1]).toEqual({ message: "追问第二问", sessionId: "sid-1" });
    controller.dispose();
  });

  it("卸载 dispose() 在 200ms 防抖窗口内先刷入 textBatch 与 localStorage，再触发 abort()", async () => {
    const createChatController = (
      ChatDrawerModule as unknown as {
        createChatController?: (deps: {
          storage: Pick<Storage, "getItem" | "setItem">;
          fetchImpl: typeof fetch;
        }) => {
          setInput: (v: string) => void;
          send: (preset?: string) => Promise<void>;
          dispose: () => void;
        };
      }
    ).createChatController;
    expect(createChatController).toBeTypeOf("function");

    const storage = createMemoryStorage();
    const events: string[] = [];
    const trackedStorage = {
      getItem: (k: string) => storage.getItem(k),
      setItem: (k: string, v: string) => {
        events.push("writeStorage");
        storage.setItem(k, v);
      },
    };

    let chunkPushed!: () => void;
    const ready = new Promise<void>((resolve) => {
      chunkPushed = resolve;
    });

    const fetchImpl: typeof fetch = async (_input, init) => {
      const stream = new ReadableStream<Uint8Array>({
        start(streamController) {
          streamController.enqueue(
            sseChunk("knowledge", { revision: "a".repeat(64), sessionId: "sid-unmount" }),
          );
          streamController.enqueue(sseChunk("text", { text: "尚未满 50ms 批处理的流式片段" }));
          setTimeout(chunkPushed, 5);
          init?.signal?.addEventListener(
            "abort",
            () => {
              events.push("abortSignal");
              // 验证 abort 触发时，最新分片已经先一步写进 localStorage
              const rawAtAbort = storage.getItem(CHAT_HISTORY_KEY) ?? "";
              expect(rawAtAbort).toContain("尚未满 50ms 批处理的流式片段");
              streamController.error(Object.assign(new Error("Aborted"), { name: "AbortError" }));
            },
            { once: true },
          );
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };

    const controller = createChatController!({ storage: trackedStorage, fetchImpl });
    const turnPromise = controller.send("测试卸载刷盘");
    await ready;
    controller.setInput("卸载前刚敲的草稿");
    events.length = 0;

    controller.dispose();
    await turnPromise;

    const abortIndex = events.indexOf("abortSignal");
    const writeBeforeAbort = events.indexOf("writeStorage");
    expect(writeBeforeAbort).toBeGreaterThanOrEqual(0);
    expect(abortIndex).toBeGreaterThan(writeBeforeAbort);

    const restored = readChatHistory(storage);
    expect(restored.input).toBe("卸载前刚敲的草稿");
    expect(restored.msgs[1]?.text).toBe("尚未满 50ms 批处理的流式片段");
    expect(restored.msgs[1]?.status).toBe("interrupted");
    expect(restored.sessionId).toBeUndefined();
  });

  it("pagehide 触发时先冲刷 50ms textBatch 再写入存储，保留未完成轮次语义且不提前中止流", async () => {
    const mod = ChatDrawerModule as unknown as {
      createChatController: (deps: {
        storage: Pick<Storage, "getItem" | "setItem">;
        fetchImpl: typeof fetch;
      }) => {
        getState: () => ReturnType<typeof ChatDrawerModule.useChat>;
        send: (preset?: string) => Promise<void>;
        flush: () => void;
        dispose: () => void;
      };
      bindPageHideFlush?: (
        target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
        controller: { flush: () => void; dispose: () => void },
      ) => () => void;
    };
    expect(mod.bindPageHideFlush).toBeTypeOf("function");

    const storage = createMemoryStorage();
    let finishStream!: () => void;
    let aborted = false;

    const fetchImpl: typeof fetch = async (_input, init) => {
      const stream = new ReadableStream<Uint8Array>({
        start(streamController) {
          streamController.enqueue(
            sseChunk("knowledge", { revision: "a".repeat(64), sessionId: "sid-pagehide" }),
          );
          streamController.enqueue(sseChunk("text", { text: "LAST-CHUNK-MUST-SURVIVE" }));
          finishStream = () => {
            streamController.enqueue(sseChunk("text", { text: " + 后续分片" }));
            streamController.enqueue(
              sseChunk("persisted", { sessionId: "sid-pagehide", revision: "a".repeat(64) }),
            );
            streamController.enqueue(sseChunk("done", { sessionId: "sid-pagehide" }));
            streamController.close();
          };
          init?.signal?.addEventListener(
            "abort",
            () => {
              aborted = true;
              streamController.error(Object.assign(new Error("Aborted"), { name: "AbortError" }));
            },
            { once: true },
          );
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
    };

    const controller = mod.createChatController({ storage, fetchImpl });
    const fakeWindow = new EventTarget();
    const unbind = mod.bindPageHideFlush!(fakeWindow, controller);

    const turnPromise = controller.send("测试 pagehide 刷盘");
    // 等下一宏任务（0ms，远早于 50ms textBatch 定时器），模拟流刚推入分片即触发浏览器 pagehide
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    fakeWindow.dispatchEvent(new Event("pagehide"));

    // 1. 原始存储立即包含刚到达的流式文字，且保持未完成 pending 语义
    const rawSaved = JSON.parse(storage.getItem(CHAT_HISTORY_KEY) ?? "{}") as {
      msgs?: Array<{ text?: string; status?: string }>;
    };
    expect(rawSaved.msgs?.[1]?.text).toBe("LAST-CHUNK-MUST-SURVIVE");
    expect(rawSaved.msgs?.[1]?.status).toBe("pending");

    // 2. 若此时浏览器已完成刷新重建，readChatHistory 会将 pending 归一化为 interrupted 且保留该段文字
    const reloaded = readChatHistory(storage);
    expect(reloaded.msgs[1]?.text).toBe("LAST-CHUNK-MUST-SURVIVE");
    expect(reloaded.msgs[1]?.status).toBe("interrupted");
    expect(reloaded.sessionId).toBeUndefined();

    // 3. 若页面并未卸载（如 bfcache 或取消跳转），活动流未被 abort，后续分片与完成态正常落地
    expect(aborted).toBe(false);
    finishStream();
    await turnPromise;
    expect(controller.getState().msgs[1]?.text).toBe("LAST-CHUNK-MUST-SURVIVE + 后续分片");
    expect(controller.getState().msgs[1]?.status).toBe("complete");

    unbind();
  });

  it("ChatPane 与 ChatMarkdown 透传 currentId：裸 #锚点、相对 .md 链接与推荐阅读均走 SPA 路由且外链具备安全属性", () => {
    const state = {
      msgs: [
        {
          key: "a1",
          role: "agent" as const,
          text: "见 [本页开关](#怎么开)、[分块](chunked-prefill.md#核心权衡) 与 [官方文档](https://docs.vllm.ai/en/latest/)。",
          status: "complete" as const,
          related: [
            {
              id: "chunked-prefill",
              title: "Chunked Prefill",
              href: "#/wiki/chunked-prefill#核心权衡",
              note: "相关机制",
            },
          ],
        },
      ],
      input: "",
      setInput: () => {},
      busy: false,
      send: async () => {},
      stop: () => {},
      storageError: "",
    };

    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ["/wiki/quantization"] },
        createElement(ChatDrawerModule.ChatPane, {
          id: "wiki-panel-chat",
          chat: state,
          currentId: "quantization",
          hidden: false,
          onReview: () => {},
        }),
      ),
    );

    // MemoryRouter 下 <Link to="/wiki/..."> 渲染出的 href 以 "/wiki/" 开头（而非裸 "#怎么开" 或原生 "#/wiki/..."）
    expect(html).not.toContain('href="#怎么开"');
    expect(html).toMatch(/href="\/wiki\/quantization#(?:怎么开|%E6%80%8E%E4%B9%88%E5%BC%80)"/);
    expect(html).toMatch(/href="\/wiki\/chunked-prefill#(?:核心权衡|%E6%A0%B8%E5%BF%83%E6%9D%83%E8%A1%A1)"/);
    expect(html).not.toContain('href="#/wiki/chunked-prefill');
    expect(html).toContain('href="https://docs.vllm.ai/en/latest/" target="_blank" rel="noreferrer"');
  });

  it("P2-7: ChatDrawer 表单提交与 Enter 快捷键在离线态直接拦截，绝不触发 send()", () => {
    const mod = ChatDrawerModule as unknown as {
      handleChatFormSubmit?: (
        e: { preventDefault: () => void },
        isOffline: boolean,
        send: () => void,
      ) => void;
      handleChatInputKeyDown?: (
        e: {
          key: string;
          shiftKey: boolean;
          nativeEvent: { isComposing: boolean };
          preventDefault: () => void;
        },
        isOffline: boolean,
        send: () => void,
      ) => void;
    };
    expect(mod.handleChatFormSubmit).toBeTypeOf("function");
    expect(mod.handleChatInputKeyDown).toBeTypeOf("function");

    let sendCalls = 0;
    let prevented = 0;
    const send = () => {
      sendCalls += 1;
    };
    const preventDefault = () => {
      prevented += 1;
    };

    // 离线态表单提交与 Enter：阻止默认提交但不调用 send
    mod.handleChatFormSubmit!({ preventDefault }, true, send);
    mod.handleChatInputKeyDown!(
      { key: "Enter", shiftKey: false, nativeEvent: { isComposing: false }, preventDefault },
      true,
      send,
    );
    expect(prevented).toBe(2);
    expect(sendCalls).toBe(0);

    // Shift+Enter 或 IME 输入法组合态不触发发送
    mod.handleChatInputKeyDown!(
      { key: "Enter", shiftKey: true, nativeEvent: { isComposing: false }, preventDefault },
      false,
      send,
    );
    mod.handleChatInputKeyDown!(
      { key: "Enter", shiftKey: false, nativeEvent: { isComposing: true }, preventDefault },
      false,
      send,
    );
    expect(sendCalls).toBe(0);

    // 在线态 Enter 与表单提交正常触发 send
    mod.handleChatInputKeyDown!(
      { key: "Enter", shiftKey: false, nativeEvent: { isComposing: false }, preventDefault },
      false,
      send,
    );
    mod.handleChatFormSubmit!({ preventDefault }, false, send);
    expect(sendCalls).toBe(2);
  });
});
