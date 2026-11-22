import { describe, expect, it } from "vitest";
import {
  appendFromPageToExperienceRoute,
  buildExperienceIframeSrc,
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

    // 兼容历史 Wiki 深链（未传 model，但携带合法 1..40 整数 segment）
    expect(resolveModelEdition(new URLSearchParams("view=play&segment=28"))).toBe("glm-5-3-flash");
    expect(resolveModelEdition(new URLSearchParams("segment=1"))).toBe("glm-5-3-flash");
    expect(resolveModelEdition(new URLSearchParams("segment=40"))).toBe("glm-5-3-flash");

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
});
