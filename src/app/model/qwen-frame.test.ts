import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeployCalculatorView } from "../tools/DeployCalculatorView";
import { parseCalculatorQueryParams } from "../tools/workbenchHandoff";
import {
  buildHardwareDeployHref,
  CARD_TO_3D_HARDWARE_MAP,
  computeHardwareNodeSlotLayout,
  encodeHardwareDeployOverlay,
  type HardwareDeployOverlayPayload,
  parseHardwareDeployOverlay,
} from "./hardwareDeployOverlay";
import {
  appendFromPageToExperienceRoute,
  buildExperienceIframeSrc,
  buildHardwareExperienceIframeSrc,
  buildModelSwitchTo,
  buildModelTabTo,
  isExperienceFrameReady,
  parseHardwareLevel,
  resolveExperienceBackTarget,
  resolveModelEdition,
  resolveQwenVariant,
  safeCheckExperienceFrameReady,
  sanitizeAnchor,
} from "./qwen-frame";

describe("qwen-frame 路由与状态解析", () => {
  it("resolveModelEdition 默认路由到 Qwen3-8B，并 100% 兼容 GLM 旧深链与显式参数", () => {
    expect(resolveModelEdition(new URLSearchParams(""))).toBe("qwen3-8b");
    expect(resolveModelEdition(new URLSearchParams("view=layer"))).toBe("qwen3-8b");
    expect(resolveModelEdition(new URLSearchParams("model=qwen3-8b"))).toBe("qwen3-8b");
    expect(resolveModelEdition(new URLSearchParams("model=glm-5-3-flash"))).toBe("glm-5-3-flash");

    // 兼容历史 Wiki 深链（未传 model，但携带合法 1..40 整数 segment）与历史课程「打开 GLM 计算演示」（experience=1）
    expect(resolveModelEdition(new URLSearchParams("view=play&segment=28"))).toBe("glm-5-3-flash");
    expect(resolveModelEdition(new URLSearchParams("segment=1"))).toBe("glm-5-3-flash");
    expect(resolveModelEdition(new URLSearchParams("segment=40"))).toBe("glm-5-3-flash");
    expect(resolveModelEdition(new URLSearchParams("experience=1"))).toBe("glm-5-3-flash");
    expect(resolveModelEdition(new URLSearchParams("experience=1&model=qwen3-8b"))).toBe("qwen3-8b");

    // 非法 segment 不误判为 GLM；显式 model=qwen3-8b 优先于 segment
    expect(resolveModelEdition(new URLSearchParams("segment=0"))).toBe("qwen3-8b");
    expect(resolveModelEdition(new URLSearchParams("segment=41"))).toBe("qwen3-8b");
    expect(resolveModelEdition(new URLSearchParams("segment=2.5"))).toBe("qwen3-8b");
    expect(resolveModelEdition(new URLSearchParams("segment=abc"))).toBe("qwen3-8b");
    expect(resolveModelEdition(new URLSearchParams("model=qwen3-8b&segment=28"))).toBe("qwen3-8b");
  });

  it("resolveQwenVariant 严格限定 8b 或 30b-a3b", () => {
    expect(resolveQwenVariant(new URLSearchParams(""))).toBe("8b");
    expect(resolveQwenVariant(new URLSearchParams("variant=8b"))).toBe("8b");
    expect(resolveQwenVariant(new URLSearchParams("variant=30b-a3b"))).toBe("30b-a3b");
    expect(resolveQwenVariant(new URLSearchParams("variant=unknown"))).toBe("8b");
  });

  it("parseHardwareLevel 严格校验 0..4 整数，拦截小数、负数与 NaN", () => {
    expect(parseHardwareLevel(new URLSearchParams("level=0"), false)).toBe(0);
    expect(parseHardwareLevel(new URLSearchParams("level=2"), false)).toBe(2);
    expect(parseHardwareLevel(new URLSearchParams("level=4"), false)).toBe(4);

    // 拦截非法值，一律回退 0
    expect(parseHardwareLevel(new URLSearchParams("level=2.5"), false)).toBe(0);
    expect(parseHardwareLevel(new URLSearchParams("level=-1"), false)).toBe(0);
    expect(parseHardwareLevel(new URLSearchParams("level=5"), false)).toBe(0);
    expect(parseHardwareLevel(new URLSearchParams("level=NaN"), false)).toBe(0);
    expect(parseHardwareLevel(new URLSearchParams("level=abc"), false)).toBe(0);
    expect(parseHardwareLevel(new URLSearchParams("level="), true)).toBe(0);

    // 未传 level 时按是否 npu 模块视图决定默认值
    expect(parseHardwareLevel(new URLSearchParams(""), false)).toBe(0);
    expect(parseHardwareLevel(new URLSearchParams(""), true)).toBe(3);
  });

  it("resolveExperienceBackTarget 支持章节返回、Wiki fromPage/fromAnchor 原路返回与非法页兜底", () => {
    expect(resolveExperienceBackTarget(new URLSearchParams("fromPage=attention-qkv"), { id: "03" })).toEqual({
      to: "/chapters/03",
      label: "返回第 03 章",
    });

    const wikiBack = resolveExperienceBackTarget(new URLSearchParams("fromPage=attention-qkv"), null);
    expect(wikiBack.to).toBe("/wiki/attention-qkv");
    expect(wikiBack.label).toMatch(/^返回「.+」$/);

    const withAnchor = resolveExperienceBackTarget(
      new URLSearchParams("fromPage=attention-qkv&fromAnchor=%23%23kv-cache%00%0a"),
      null,
    );
    expect(withAnchor.to).toBe("/wiki/attention-qkv#kv-cache");

    expect(resolveExperienceBackTarget(new URLSearchParams("fromPage=non-existent-page-999"), null)).toEqual({
      to: "/wiki",
      label: "返回主章节",
    });
    expect(resolveExperienceBackTarget(new URLSearchParams(""), null)).toEqual({
      to: "/wiki",
      label: "返回主章节",
    });
  });

  it("sanitizeAnchor 清洗首字符 # 与非法控制字符", () => {
    expect(sanitizeAnchor("##section-1\u0000\u001f")).toBe("section-1");
    expect(sanitizeAnchor("  #gqa-4-1  ")).toBe("gqa-4-1");
    expect(sanitizeAnchor("")).toBe("");
    expect(sanitizeAnchor(null)).toBe("");
  });

  it("appendFromPageToExperienceRoute 仅为 /model 与 /hardware 内部链接自动附加 fromPage 并保留原参", () => {
    expect(appendFromPageToExperienceRoute("/model?view=play&segment=28", "mla")).toBe(
      "/model?view=play&segment=28&fromPage=mla",
    );
    expect(appendFromPageToExperienceRoute("/hardware?vendor=ascend&level=3", "hbm")).toBe(
      "/hardware?vendor=ascend&level=3&fromPage=hbm",
    );
    expect(appendFromPageToExperienceRoute("/model", "attention-qkv")).toBe("/model?fromPage=attention-qkv");
    expect(appendFromPageToExperienceRoute("/model?view=play&fromPage=already", "mla")).toBe(
      "/model?view=play&fromPage=already",
    );
    expect(appendFromPageToExperienceRoute("/wiki/kv-cache#hbm", "mla")).toBe("/wiki/kv-cache#hbm");
    expect(appendFromPageToExperienceRoute("/model?view=play", undefined)).toBe("/model?view=play");
  });

  it("buildExperienceIframeSrc 与顶栏切换链接保留 fromPage/fromAnchor 且正确路由双模型", () => {
    expect(
      buildExperienceIframeSrc({
        baseUrl: "/",
        edition: "qwen3-8b",
        variant: "8b",
        viewId: "play",
      }),
    ).toBe("/experiences/qwen-flow/master/index.html?view=play&site=1&variant=8b");

    expect(
      buildExperienceIframeSrc({
        baseUrl: "/",
        edition: "qwen3-8b",
        variant: "30b-a3b",
        viewId: "layer",
      }),
    ).toBe("/experiences/qwen-flow/master/index.html?view=layer&site=1&variant=30b-a3b");

    expect(
      buildExperienceIframeSrc({
        baseUrl: "/",
        edition: "glm-5-3-flash",
        variant: "8b",
        viewId: "play",
        segment: 28,
      }),
    ).toBe("/experiences/glm-flow/master/chapter.html?site=1&segment=28");

    const params = new URLSearchParams("view=play&fromPage=attention-qkv&fromAnchor=gqa&variant=30b-a3b");
    const tabHref = buildModelTabTo({
      base: "/model",
      viewId: "layer",
      edition: "qwen3-8b",
      params,
    });
    expect(tabHref).toContain("view=layer");
    expect(tabHref).toContain("fromPage=attention-qkv");
    expect(tabHref).toContain("fromAnchor=gqa");
    expect(tabHref).toContain("variant=30b-a3b");

    const switchToGlm = buildModelSwitchTo({
      base: "/model",
      targetEdition: "glm-5-3-flash",
      viewId: "layer",
      params,
    });
    expect(switchToGlm).toContain("model=glm-5-3-flash");
    expect(switchToGlm).toContain("view=layer");
    expect(switchToGlm).toContain("fromPage=attention-qkv");
    expect(switchToGlm).toContain("fromAnchor=gqa");
  });

  it("isExperienceFrameReady 与 safeCheckExperienceFrameReady 杜绝缺失 #loading 或异常 iframe 污染 readyKeys", () => {
    // 硬件页：空窗口或 SPA 回退/错误 HTML（无 #loading 节点）必须返回 false
    expect(isExperienceFrameReady(null, "hardware", "hardware")).toBe(false);
    expect(isExperienceFrameReady(undefined, "hardware", "hardware")).toBe(false);
    expect(isExperienceFrameReady({ document: { getElementById: () => null } }, "hardware", "hardware")).toBe(
      false,
    );

    // 硬件页：#loading 仍在加载且未出现重试按钮 -> false
    expect(
      isExperienceFrameReady(
        {
          document: {
            getElementById: (id) => (id === "loading" ? { hidden: false, querySelector: () => null } : null),
          },
        },
        "hardware",
        "hardware",
      ),
    ).toBe(false);

    // 硬件页：#loading 已隐藏，或显式渲染了重试按钮 -> true
    expect(
      isExperienceFrameReady(
        {
          document: {
            getElementById: (id) => (id === "loading" ? { hidden: true, querySelector: () => null } : null),
          },
        },
        "hardware",
        "hardware",
      ),
    ).toBe(true);
    expect(
      isExperienceFrameReady(
        {
          document: {
            getElementById: (id) =>
              id === "loading"
                ? { hidden: false, querySelector: (sel) => (sel === "button:not([hidden])" ? {} : null) }
                : null,
          },
        },
        "hardware",
        "hardware",
      ),
    ).toBe(true);

    // 模型页按视图分别检查 __chapter / __arch / __truth
    expect(isExperienceFrameReady({ __chapter: { state: { ready: true } } }, "model", "play")).toBe(true);
    expect(isExperienceFrameReady({ __chapter: { state: { ready: false } } }, "model", "play")).toBe(false);
    expect(isExperienceFrameReady({ __arch: { ready: true } }, "model", "arch")).toBe(true);
    expect(isExperienceFrameReady({ __truth: { ready: true } }, "model", "model")).toBe(true);
    expect(isExperienceFrameReady({ __truth: { ready: false } }, "model", "layer")).toBe(false);

    // 跨域/异常/未就绪 iframe 抛错时绝不返回 ready: true
    expect(
      safeCheckExperienceFrameReady(
        () => {
          throw new Error("Blocked a frame with origin");
        },
        "hardware",
        "hardware",
      ),
    ).toEqual({ ready: false });
    expect(
      safeCheckExperienceFrameReady(
        () => ({
          document: {
            getElementById: () => {
              throw new Error("SecurityError");
            },
          },
        }),
        "hardware",
        "hardware",
      ),
    ).toEqual({ ready: false });
    const readyWin = { __arch: { ready: true } };
    expect(safeCheckExperienceFrameReady(() => readyWin, "model", "arch")).toEqual({
      ready: true,
      win: readyWin,
    });
  });

  it("D.3: 解析子帧 variant-change / ready 消息以同步顶栏 URL，并在超时后停止 32ms 轮询且仍接受同代迟到 ready 消息", async () => {
    const mod = (await import("./qwen-frame")) as Record<string, unknown>;
    const parseMsg = mod.parseExperienceFrameMessage as
      | ((data: unknown) => { type: string; variant?: string } | null)
      | undefined;
    const syncParams = mod.syncQwenVariantSearchParams as
      | ((params: URLSearchParams, variant: "8b" | "30b-a3b") => URLSearchParams)
      | undefined;
    const createProbe = mod.createExperienceReadyProbe as
      | ((opts: {
          expectedSeq: number;
          getCurrentSeq: () => number;
          isActiveTarget: () => boolean;
          checkReady: () => boolean;
          onReady: () => void;
          onTimeout: () => void;
          pollIntervalMs?: number;
          timeoutMs?: number;
          setIntervalFn: (cb: () => void, ms: number) => number;
          clearIntervalFn: (id: number) => void;
          setTimeoutFn: (cb: () => void, ms: number) => number;
          clearTimeoutFn: (id: number) => void;
        }) => { notifyMessageReady: (seq?: number) => void; dispose: () => void })
      | undefined;

    expect(typeof parseMsg).toBe("function");
    expect(typeof syncParams).toBe("function");
    expect(typeof createProbe).toBe("function");

    expect(parseMsg!({ type: "qwen-experience:variant-change", variant: "30b-a3b" })).toEqual({
      type: "variant-change",
      variant: "30b-a3b",
    });
    expect(parseMsg!({ type: "qwen-experience:variant-change", variant: "evil" })).toBeNull();
    expect(parseMsg!({ type: "qwen-experience:ready", viewId: "arch", variant: "30b-a3b" })).toMatchObject({
      type: "ready",
      variant: "30b-a3b",
    });

    const synced = syncParams!(new URLSearchParams("view=play&fromPage=moe"), "30b-a3b");
    expect(synced.get("variant")).toBe("30b-a3b");
    const layerTab = buildModelTabTo({
      base: "/model",
      viewId: "layer",
      edition: "qwen3-8b",
      params: synced,
    });
    expect(layerTab).toContain("view=layer");
    expect(layerTab).toContain("variant=30b-a3b");

    // Verify 32ms ready-poll stops at timeout while late ready message for active seq still succeeds
    let pollCb: (() => void) | null = null;
    let timeoutCb: (() => void) | null = null;
    let clearedIntervals = 0;
    let readyCount = 0;
    let timeoutCount = 0;
    let frameReady = false;
    let currentSeq = 7;

    const probe = createProbe!({
      expectedSeq: 7,
      getCurrentSeq: () => currentSeq,
      isActiveTarget: () => true,
      checkReady: () => frameReady,
      onReady: () => {
        readyCount += 1;
      },
      onTimeout: () => {
        timeoutCount += 1;
      },
      setIntervalFn: (cb) => {
        pollCb = cb;
        return 101;
      },
      clearIntervalFn: (id) => {
        if (id === 101) {
          clearedIntervals += 1;
          pollCb = null;
        }
      },
      setTimeoutFn: (cb) => {
        timeoutCb = cb;
        return 202;
      },
      clearTimeoutFn: () => {
        timeoutCb = null;
      },
    });

    expect(pollCb).not.toBeNull();
    // Fire timeout -> must clear the 32ms interval immediately!
    timeoutCb!();
    expect(timeoutCount).toBe(1);
    expect(clearedIntervals).toBe(1);
    expect(pollCb).toBeNull();

    // Late message for active seq=7 when frame becomes ready -> still commits ready!
    frameReady = true;
    probe.notifyMessageReady();
    expect(readyCount).toBe(1);

    // Stale seq must never commit
    currentSeq = 8;
    probe.notifyMessageReady();
    expect(readyCount).toBe(1);
    probe.dispose();

    // R2.6: infer-lab-experience ready message (whole/viewer.js), __wholeReady check, & slow background recovery after timeout
    expect(parseMsg!({ source: "infer-lab-experience", type: "ready" })).toMatchObject({
      type: "ready",
    });
    expect(isExperienceFrameReady({ __wholeReady: true } as never, "hardware", "hardware")).toBe(true);

    let slowPollCb: (() => void) | null = null;
    let slowReady = false;
    let slowCommitted = 0;
    const slowProbe = createProbe!({
      expectedSeq: 11,
      getCurrentSeq: () => 11,
      isActiveTarget: () => true,
      checkReady: () => slowReady,
      onReady: () => {
        slowCommitted += 1;
      },
      onTimeout: () => {},
      ...({ slowPollIntervalMs: 500 } as Record<string, unknown>),
      setIntervalFn: (cb, ms) => {
        if (ms === 500) slowPollCb = cb;
        return ms === 500 ? 303 : 301;
      },
      clearIntervalFn: () => {},
      setTimeoutFn: (cb) => {
        timeoutCb = cb;
        return 302;
      },
      clearTimeoutFn: () => {},
    });
    timeoutCb!();
    expect(slowPollCb).not.toBeNull();
    slowReady = true;
    slowPollCb!();
    expect(slowCommitted).toBe(1);
    slowProbe.dispose();
  });

  it("R2.6b: play 内 8b -> 30b-a3b 后执行 play -> arch -> play 往返时，重新挂载的 play 子帧必须构建 variant=30b-a3b 而绝不复用旧 8b src", async () => {
    const { resolveInPlaceVariantSync, buildExperienceIframeSrc } = await import("./qwen-frame");

    const playSrc8b = buildExperienceIframeSrc({
      baseUrl: "/",
      edition: "qwen3-8b",
      variant: "8b",
      viewId: "play",
      segment: null,
    });
    const playSrc30b = buildExperienceIframeSrc({
      baseUrl: "/",
      edition: "qwen3-8b",
      variant: "30b-a3b",
      viewId: "play",
      segment: null,
    });
    const archSrc30b = buildExperienceIframeSrc({
      baseUrl: "/",
      edition: "qwen3-8b",
      variant: "30b-a3b",
      viewId: "arch",
      segment: null,
    });

    // 1. User clicks 30b-a3b inside play (mounted as playSrc8b): even if setSearchParams flushes one render later, keeps domKey=playSrc8b without reload
    const initialState = {
      baseIdentity: "model:qwen3-8b:play:0",
      variant: "30b-a3b" as const,
      domKey: playSrc8b,
      initialSrc: playSrc8b,
      urlSynced: false,
    };
    const preUrlFlush = resolveInPlaceVariantSync({
      state: initialState,
      kind: "model",
      edition: "qwen3-8b",
      baseIdentity: "model:qwen3-8b:play:0",
      qwenVariant: "8b",
      mountedKeys: [playSrc8b],
      computedSrc: playSrc8b,
      defaultFrameKey: playSrc8b,
    });
    expect(preUrlFlush.frameKey).toBe(playSrc8b);
    expect(preUrlFlush.src).toBe(playSrc8b);
    expect(preUrlFlush.nextState?.urlSynced).toBe(false);

    // 2. URL catches up to variant=30b-a3b while still in play: marks urlSynced=true and preserves mounted playSrc8b in place
    const syncedPlay = resolveInPlaceVariantSync({
      state: preUrlFlush.nextState,
      kind: "model",
      edition: "qwen3-8b",
      baseIdentity: "model:qwen3-8b:play:0",
      qwenVariant: "30b-a3b",
      mountedKeys: [playSrc8b],
      computedSrc: playSrc30b,
      defaultFrameKey: playSrc30b,
    });
    expect(syncedPlay.frameKey).toBe(playSrc8b);
    expect(syncedPlay.src).toBe(playSrc8b);
    expect(syncedPlay.nextState?.urlSynced).toBe(true);

    // 3. Switch play -> arch: baseIdentity changes -> state immediately clears to null and loads archSrc30b
    const onArch = resolveInPlaceVariantSync({
      state: syncedPlay.nextState,
      kind: "model",
      edition: "qwen3-8b",
      baseIdentity: "model:qwen3-8b:arch:0",
      qwenVariant: "30b-a3b",
      mountedKeys: [playSrc8b, archSrc30b],
      computedSrc: archSrc30b,
      defaultFrameKey: archSrc30b,
    });
    expect(onArch.nextState).toBeNull();
    expect(onArch.src).toBe(archSrc30b);

    // 4. Switch arch -> play (play iframe was unmounted and remounts): MUST build playSrc30b (variant=30b-a3b), NEVER stale playSrc8b!
    const backToPlay = resolveInPlaceVariantSync({
      state: onArch.nextState,
      kind: "model",
      edition: "qwen3-8b",
      baseIdentity: "model:qwen3-8b:play:0",
      qwenVariant: "30b-a3b",
      mountedKeys: [archSrc30b],
      computedSrc: playSrc30b,
      defaultFrameKey: playSrc30b,
    });
    expect(backToPlay.nextState).toBeNull();
    expect(backToPlay.src).toBe(playSrc30b);
    expect(backToPlay.src).toContain("variant=30b-a3b");
    expect(backToPlay.frameKey).toBe(playSrc30b);
  });

  it("R3.6: 从默认 /#/model 帧内切到 30b-a3b 后点击顶部导航回到无 query 的 /#/model 时，必须显式触发 syncChildVariant='8b' 使复用子帧复位回 8B", async () => {
    const { resolveInPlaceVariantSync, buildExperienceIframeSrc } = await import("./qwen-frame");
    const playSrc8b = buildExperienceIframeSrc({
      baseUrl: "/",
      edition: "qwen3-8b",
      variant: "8b",
      viewId: "play",
      segment: null,
    });
    const playSrc30b = buildExperienceIframeSrc({
      baseUrl: "/",
      edition: "qwen3-8b",
      variant: "30b-a3b",
      viewId: "play",
      segment: null,
    });

    // Subcase A: URL synced to variant=30b-a3b, then user clicks top-nav "模型" (/model -> qwenVariant="8b", locationKey="nav-reset")
    const synced30b = {
      baseIdentity: "model:qwen3-8b:play:0",
      variant: "30b-a3b" as const,
      domKey: playSrc8b,
      initialSrc: playSrc8b,
      urlSynced: true,
      originLocationKey: "loc-1",
    };
    const resetRes = resolveInPlaceVariantSync({
      state: synced30b,
      kind: "model",
      edition: "qwen3-8b",
      baseIdentity: "model:qwen3-8b:play:0",
      qwenVariant: "8b",
      locationKey: "nav-reset",
      mountedKeys: [playSrc8b],
      computedSrc: playSrc8b,
      defaultFrameKey: playSrc8b,
    } as never) as unknown as {
      nextState: unknown;
      src: string;
      frameKey: string;
      syncChildVariant?: string;
    };
    expect(resetRes.nextState).toBeNull();
    expect(resetRes.frameKey).toBe(playSrc8b);
    expect(resetRes.syncChildVariant).toBe("8b");

    // Subcase B: Even if urlSynced was still false on originLocationKey="loc-1" and user navigated to a new locationKey="nav-reset" without ?variant=
    const unsynced30b = {
      baseIdentity: "model:qwen3-8b:play:0",
      variant: "30b-a3b" as const,
      domKey: playSrc8b,
      initialSrc: playSrc8b,
      urlSynced: false,
      originLocationKey: "loc-1",
    };
    const resetUnsynced = resolveInPlaceVariantSync({
      state: unsynced30b,
      kind: "model",
      edition: "qwen3-8b",
      baseIdentity: "model:qwen3-8b:play:0",
      qwenVariant: "8b",
      locationKey: "nav-reset",
      mountedKeys: [playSrc8b],
      computedSrc: playSrc8b,
      defaultFrameKey: playSrc8b,
    } as never) as unknown as {
      nextState: unknown;
      syncChildVariant?: string;
    };
    expect(resetUnsynced.nextState).toBeNull();
    expect(resetUnsynced.syncChildVariant).toBe("8b");
    expect(playSrc30b).not.toBe(playSrc8b);
  });

  it("Track 3C (#9): deploy 参数紧凑编解码与严格防篡改范围校验", () => {
    const sample: HardwareDeployOverlayPayload = {
      modelKey: "qwen3-30b-a3b",
      cardId: "a3-die64g",
      tp: 4,
      pp: 1,
      dp: 1,
      ep: true,
      totalRanks: 4,
      cardGiB: 64,
      u: 0.9,
      weightGiB: 14.52,
      kvGiB: 38.4,
      runtimeGiB: 4.85,
      oomStatus: "fits",
      calc: {
        subMode: "static",
        weightPrecision: "bf16",
        kvCacheDtype: "int8",
        weightNzMode: 2,
        pcp: 1,
        dcp: 2,
        maxModelLen: 65536,
        cudagraphMode: "FULL_DECODE_ONLY",
        useV2ModelRunner: true,
        version: "main",
      },
    };
    const encoded = encodeHardwareDeployOverlay(sample);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = parseHardwareDeployOverlay(encoded);
    expect(decoded).toMatchObject({
      modelKey: "qwen3-30b-a3b",
      cardId: "a3-die64g",
      tp: 4,
      pp: 1,
      dp: 1,
      ep: true,
      totalRanks: 4,
      cardGiB: 64,
      u: 0.9,
      weightGiB: 14.52,
      kvGiB: 38.4,
      runtimeGiB: 4.85,
      oomStatus: "fits",
    });
    expect(decoded?.calc).toMatchObject({
      weightPrecision: "bf16",
      kvCacheDtype: "int8",
      weightNzMode: 2,
      dcp: 2,
      maxModelLen: 65536,
      cudagraphMode: "FULL_DECODE_ONLY",
      useV2ModelRunner: true,
      version: "main",
    });

    const b64 = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj), "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    // 拦截伪造 cardGiB（310p-24g 标称单芯 24 GiB，篡改为 64 GiB 必须拒绝）
    expect(
      parseHardwareDeployOverlay(
        b64({
          v: 1,
          m: "qwen3-8b",
          c: "310p-24g",
          tp: 2,
          pp: 1,
          dp: 1,
          ep: 0,
          r: 2,
          cg: 64,
          u: 0.9,
          w: 8,
          kv: 8,
          rt: 2,
          oom: "fits",
        }),
      ),
    ).toBeNull();
    // 拦截 totalRanks 与 tp*pp*dp*pcp 不一致
    expect(
      parseHardwareDeployOverlay(
        b64({
          v: 1,
          m: "qwen3-8b",
          c: "a2-64g",
          tp: 2,
          pp: 1,
          dp: 1,
          ep: 0,
          r: 8,
          cg: 64,
          u: 0.9,
          w: 8,
          kv: 40,
          rt: 4,
          oom: "fits",
        }),
      ),
    ).toBeNull();
    // 拦截未知卡型、未知模型枚举、越界 u 与负数显存
    expect(
      parseHardwareDeployOverlay(
        b64({
          v: 1,
          m: "evil-xss",
          c: "a2-64g",
          tp: 1,
          pp: 1,
          dp: 1,
          ep: 0,
          r: 1,
          cg: 64,
          u: 0.9,
          w: 8,
          kv: 40,
          rt: 4,
          oom: "fits",
        }),
      ),
    ).toBeNull();
    expect(
      parseHardwareDeployOverlay(
        b64({
          v: 1,
          m: "qwen3-8b",
          c: "a2-64g",
          tp: 1,
          pp: 1,
          dp: 1,
          ep: 0,
          r: 1,
          cg: 64,
          u: 1.5,
          w: 8,
          kv: 40,
          rt: 4,
          oom: "fits",
        }),
      ),
    ).toBeNull();
    expect(
      parseHardwareDeployOverlay(
        b64({
          v: 1,
          m: "qwen3-8b",
          c: "a2-64g",
          tp: 1,
          pp: 1,
          dp: 1,
          ep: 0,
          r: 1,
          cg: 64,
          u: 0.9,
          w: -1,
          kv: 40,
          rt: 4,
          oom: "fits",
        }),
      ),
    ).toBeNull();
    expect(parseHardwareDeployOverlay("not-valid-base64!!!")).toBeNull();
    expect(parseHardwareDeployOverlay("a".repeat(1200))).toBeNull();
  });

  it("Track 3C (#9): 卡型到 3D 机型、A3 双裸片 / 310P 双芯 PCIe 槽位及跨机截断精确映射", () => {
    expect(CARD_TO_3D_HARDWARE_MAP["a2-64g"].hardwareModel).toBe("atlas-800t-a2");
    expect(CARD_TO_3D_HARDWARE_MAP["a2-32g"].hardwareModel).toBe("atlas-800t-a2");
    expect(CARD_TO_3D_HARDWARE_MAP["a3-die64g"].hardwareModel).toBe("atlas-800i-a3");
    expect(CARD_TO_3D_HARDWARE_MAP["310p-24g"].hardwareModel).toBe("atlas-800-3000");
    expect(CARD_TO_3D_HARDWARE_MAP["950dt-128g"].hardwareModel).toBe("ascend-950dt");

    // A3 双芯模组：TP=4 占用 npu0 [R0,R1] 与 npu1 [R2,R3]，其余 6 颗物理模组空闲，整机可容 16 Ranks
    const a3Tp4 = computeHardwareNodeSlotLayout({
      modelKey: "qwen3-30b-a3b",
      cardId: "a3-die64g",
      tp: 4,
      pp: 1,
      dp: 1,
      ep: true,
      totalRanks: 4,
      cardGiB: 64,
      u: 0.9,
      weightGiB: 15,
      kvGiB: 36,
      runtimeGiB: 5,
      oomStatus: "fits",
    });
    expect(a3Tp4.ranksPerNode).toBe(16);
    expect(a3Tp4.isMultiNode).toBe(false);
    expect(a3Tp4.activePhysicalSlotCount).toBe(2);
    expect(a3Tp4.slots[0]?.active).toBe(true);
    expect(a3Tp4.slots[0]?.dies.map((d) => [d.rankIndex, d.active])).toEqual([
      [0, true],
      [1, true],
    ]);
    expect(a3Tp4.slots[1]?.dies.map((d) => [d.rankIndex, d.active])).toEqual([
      [2, true],
      [3, true],
    ]);
    expect(a3Tp4.slots[2]?.active).toBe(false);
    expect(a3Tp4.arcs).toEqual([
      { fromRank: 0, toRank: 1, kind: "tp" },
      { fromRank: 1, toRank: 2, kind: "tp" },
      { fromRank: 2, toRank: 3, kind: "tp" },
    ]);

    // 310P 4 张双芯 PCIe 卡：card0(-1) 与 card2(+1) 下层卡向外侧 X 偏移引出，整机 8 Ranks
    const duo8 = computeHardwareNodeSlotLayout({
      modelKey: "qwen3-8b",
      cardId: "310p-24g",
      tp: 4,
      pp: 2,
      dp: 1,
      ep: false,
      totalRanks: 8,
      cardGiB: 24,
      u: 0.85,
      weightGiB: 4.2,
      kvGiB: 7.5,
      runtimeGiB: 8.1,
      oomStatus: "fits",
    });
    expect(duo8.ranksPerNode).toBe(8);
    expect(duo8.activePhysicalSlotCount).toBe(4);
    expect(duo8.slots.map((s) => [s.partSuffix, s.displacedOutwardX])).toEqual([
      ["card0", -1],
      ["card1", 0],
      ["card2", 1],
      ["card3", 0],
    ]);
    expect(duo8.arcs.some((a) => a.kind === "pp" && a.fromRank === 0 && a.toRank === 4)).toBe(true);

    // 跨机 32 Ranks 在单机 8 Ranks (A2) 下诚实标记 nodeCount=4、本机激活 8 Ranks
    const multiNode = computeHardwareNodeSlotLayout({
      modelKey: "deepseek-v3-mla",
      cardId: "a2-64g",
      tp: 8,
      pp: 2,
      dp: 2,
      ep: true,
      totalRanks: 32,
      cardGiB: 64,
      u: 0.9,
      weightGiB: 22,
      kvGiB: 28,
      runtimeGiB: 6,
      oomStatus: "fits",
    });
    expect(multiNode.isMultiNode).toBe(true);
    expect(multiNode.nodeCount).toBe(4);
    expect(multiNode.localActiveRanks).toBe(8);
  });

  it("Track 3C (#9): 算账台 calc-open-3d-hardware 跳转、whole iframe 透传默认 level=2 与返回部署算账台往返", () => {
    for (const mode of ["full", "quick-screen", "minimal"] as const) {
      const html = renderToStaticMarkup(
        createElement(DeployCalculatorView, { mode, embedded: mode !== "full" }),
      );
      expect(html).toContain('data-testid="calc-open-3d-hardware"');
      expect(html).toContain("在 3D 整机中透视此方案 (TP=1) →");
    }

    const href = buildHardwareDeployHref(
      {
        modelKey: "qwen3-30b-a3b",
        cardId: "a3-die64g",
        tp: 4,
        pp: 2,
        dp: 1,
        ep: true,
        totalRanks: 8,
        cardGiB: 64,
        u: 0.9,
        weightGiB: 8.1,
        kvGiB: 42.3,
        runtimeGiB: 4.5,
        oomStatus: "fits",
        calc: {
          weightPrecision: "w8a8_dynamic",
          kvCacheDtype: "int8",
          maxModelLen: 65536,
          cudagraphMode: "FULL_DECODE_ONLY",
        },
      },
      new URLSearchParams("fromPage=mla&fromAnchor=kv-compress"),
    );
    expect(href.startsWith("#/hardware?")).toBe(true);
    const hwParams = new URLSearchParams(href.slice("#/hardware?".length));
    expect(hwParams.get("model")).toBe("atlas-800i-a3");

    // 省略 level 时合法 deploy 默认展开 level=2；篡改 deploy 回退 level=0 且不透传
    const paramsNoLevel = new URLSearchParams(`deploy=${hwParams.get("deploy")}`);
    expect(parseHardwareLevel(paramsNoLevel, false)).toBe(2);
    const iframeSrc = buildHardwareExperienceIframeSrc({ baseUrl: "/", params: paramsNoLevel });
    expect(iframeSrc).toContain("level=2");
    expect(iframeSrc).toContain("model=atlas-800i-a3");
    expect(iframeSrc).toContain(`deploy=${hwParams.get("deploy")}`);

    const tamperedSrc = buildHardwareExperienceIframeSrc({
      baseUrl: "/",
      params: new URLSearchParams("deploy=tampered_bad_payload"),
    });
    expect(tamperedSrc).toBe("/experiences/whole/index.html?site=1&vendor=ascend&level=0");

    // 顶栏返回：章节优先 > deploy 跳回算账台还原全部参数（并保留旁侧 Wiki 返回入口）
    expect(resolveExperienceBackTarget(hwParams, { id: "05" })).toEqual({
      to: "/chapters/05",
      label: "返回第 05 章",
    });
    const back = resolveExperienceBackTarget(hwParams, null);
    expect(back.label).toBe("返回部署算账台微调");
    expect(back.to.startsWith("/tools?")).toBe(true);
    expect(back.secondary?.to).toBe("/wiki/mla#kv-compress");

    const calcRoundTrip = parseCalculatorQueryParams(new URLSearchParams(back.to.slice("/tools?".length)));
    expect(calcRoundTrip).toMatchObject({
      presetId: "qwen3-30b-a3b",
      cardId: "a3-die64g",
      tpSize: 4,
      ppSize: 2,
      enableEp: true,
      gpuMemoryUtilization: 0.9,
      weightPrecision: "w8a8_dynamic",
      kvCacheDtype: "int8",
      maxModelLen: 65536,
      cudagraphMode: "FULL_DECODE_ONLY",
    });

    // Review closures: explicit PP=1 & DP=1 preserved for non-unit presets (deepseek-v3-mla), and customModel preserved on return
    const dsHref = buildHardwareDeployHref({
      modelKey: "deepseek-v3-mla",
      cardId: "a2-64g",
      tp: 8,
      pp: 1,
      dp: 1,
      ep: true,
      totalRanks: 8,
      cardGiB: 64,
      u: 0.9,
      weightGiB: 42,
      kvGiB: 12,
      runtimeGiB: 4,
      oomStatus: "fits",
    });
    const dsBack = resolveExperienceBackTarget(new URLSearchParams(dsHref.slice("#/hardware?".length)), null);
    const dsBackParams = new URLSearchParams(dsBack.to.slice("/tools?".length));
    expect(dsBackParams.get("pp")).toBe("1");
    expect(dsBackParams.get("dp")).toBe("1");

    const customJson = JSON.stringify({
      model_type: "qwen3",
      hidden_size: 2048,
      intermediate_size: 6144,
      num_hidden_layers: 24,
      num_attention_heads: 16,
      num_key_value_heads: 4,
      vocab_size: 151936,
      max_position_embeddings: 32768,
    });
    const customHref = buildHardwareDeployHref(
      {
        modelKey: "custom-dense",
        cardId: "a2-64g",
        tp: 1,
        pp: 1,
        dp: 1,
        ep: false,
        totalRanks: 1,
        cardGiB: 64,
        u: 0.9,
        weightGiB: 4,
        kvGiB: 48,
        runtimeGiB: 3,
        oomStatus: "fits",
      },
      undefined,
      customJson,
    );
    const customHwParams = new URLSearchParams(customHref.slice("#/hardware?".length));
    const customBack = resolveExperienceBackTarget(customHwParams, null);
    expect(customBack.label).toBe("返回部署算账台微调");
    expect(new URLSearchParams(customBack.to.slice("/tools?".length)).get("customModel")).toBe(customJson);

    // Missing customModel on custom-* key honestly indicates custom model cannot be auto-restored
    customHwParams.delete("customModel");
    expect(resolveExperienceBackTarget(customHwParams, null).label).toContain("超长自定义模型需重新粘贴");

    // Session audit P1-2, P2-12 & P2-13: customModel strips unrelated secrets, DP>1 without EP emits dp arcs, and headroomOverflow round-trips alongside oomStatus
    const dirtyCustomJson = JSON.stringify({
      model_type: "qwen3",
      hidden_size: 2048,
      intermediate_size: 6144,
      num_hidden_layers: 24,
      num_attention_heads: 16,
      num_key_value_heads: 4,
      vocab_size: 151936,
      token: "AUDITMARK",
      _name_or_path: "/private/AUDITMARK",
    });
    const sanitizedHref = buildHardwareDeployHref(
      {
        modelKey: "custom-dense",
        cardId: "310p-24g",
        tp: 1,
        pp: 1,
        dp: 2,
        ep: false,
        totalRanks: 2,
        cardGiB: 24,
        u: 0.95,
        weightGiB: 1.2,
        kvGiB: 10.5,
        runtimeGiB: 13.4,
        oomStatus: "insufficient_for_single_max_len_seq",
        headroomOverflow: true,
      },
      undefined,
      dirtyCustomJson,
    );
    expect(sanitizedHref).not.toContain("AUDITMARK");
    const sanParams = new URLSearchParams(sanitizedHref.slice("#/hardware?".length));
    expect(sanParams.get("customModel") ?? "").not.toContain("AUDITMARK");
    const parsedOverlay = parseHardwareDeployOverlay(sanParams.get("deploy"));
    expect(parsedOverlay).not.toBeNull();
    expect(parsedOverlay!.oomStatus).toBe("insufficient_for_single_max_len_seq");
    expect(parsedOverlay!.headroomOverflow).toBe(true);
    const dpLayout = computeHardwareNodeSlotLayout(parsedOverlay!);
    expect(dpLayout.arcs).toEqual([{ fromRank: 0, toRank: 1, kind: "dp" }]);
  });
});
