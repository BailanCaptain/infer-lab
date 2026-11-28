import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { resolveToolDeepLink } from "../../content/wiki/toolDeeplinks";
import { parseWikiToolFence } from "../../content/wiki/toolFence";
import {
  ASCEND_KNOB_CATALOG,
  applyKnobFixAction,
  evaluateKnobRecipe,
  KNOB_RECIPE_PRESETS,
  type KnobSelectionMap,
} from "../../sim/knobs";
import { AppShell } from "../AppShell";
import { ToolsPage } from "../pages/ToolsPage";
import { DiagramPageContext } from "../wiki/page-context";
import { WikiToolBlock } from "../wiki/WikiToolBlock";
import {
  AscendKnobRadarView,
  appendKnobRadarStateParams,
  matchesKnobFilter,
  resolveInitialRadarState,
} from "./AscendKnobRadarView";

describe("Direction 3A · AscendKnobRadarView & dual-habitat integration", () => {
  it("parses knob-radar wiki-tool fence in minimal and full modes", () => {
    const minParsed = parseWikiToolFence("tool: knob-radar\nmode: minimal");
    expect(minParsed.ok).toBe(true);
    if (minParsed.ok) {
      expect(minParsed.spec.tool).toBe("knob-radar");
      expect(minParsed.spec.mode).toBe("minimal");
    }

    const fullParsed = parseWikiToolFence(
      "tool: knob-radar\nmode: full\npreset: preset-a3-large-ep-moe\ntitle: 完整旋钮雷达",
    );
    expect(fullParsed.ok).toBe(true);

    expect(parseWikiToolFence("tool: knob-radar\nmode: quick-screen").ok).toBe(false);
  });

  it("renders embedded WikiToolBlock in minimal (top-8 scannable) and full modes outside RouterProvider", () => {
    const minimalHtml = renderToStaticMarkup(
      createElement(
        DiagramPageContext.Provider,
        { value: "ascend-env-and-serve" },
        createElement(WikiToolBlock, {
          source: [
            "tool: knob-radar",
            "mode: minimal",
            "preset: preset-910b3-w8a8-low-latency",
            "title: 昇腾环境变量与调优旋钮速查雷达",
            "summary: 检索源码实读开关并生成干净启动命令",
          ].join("\n"),
        }),
      ),
    );

    expect(minimalHtml).toContain('data-testid="wiki-tool-knob-radar"');
    expect(minimalHtml).toContain('data-testid="ascend-knob-radar-view"');
    expect(minimalHtml).toContain('data-mode="minimal"');
    expect(minimalHtml).toContain("昇腾环境变量与调优旋钮速查雷达");
    expect(minimalHtml).toContain("精简模式");
    expect(minimalHtml).toContain("检索源码实读开关并生成干净启动命令");
    expect(minimalHtml).toContain(
      `v0.30.0 c09d3e20 · main 8d6180e2 · ${ASCEND_KNOB_CATALOG.length} 项源码钉点开关`,
    );
    expect(minimalHtml).toContain("在独立工作台打开完整旋钮雷达 ↗");
    expect(minimalHtml).toContain(
      'href="#/tools?tab=knobs&amp;fromPage=ascend-env-and-serve&amp;preset=preset-910b3-w8a8-low-latency"',
    );
    expect(minimalHtml).toContain('data-testid="knob-minimal-expand-toggle"');
    expect(minimalHtml).toContain(`展开全部 ${ASCEND_KNOB_CATALOG.length} 项开关`);

    const renderedMinimalCards = minimalHtml.match(/data-testid="knob-card-/g) ?? [];
    expect(renderedMinimalCards).toHaveLength(8);

    const fullEmbeddedHtml = renderToStaticMarkup(
      createElement(AscendKnobRadarView, {
        mode: "full",
        initialPresetId: "preset-a3-large-ep-moe",
        embedded: true,
      }),
    );
    expect(fullEmbeddedHtml).toContain('data-mode="full"');
    expect(fullEmbeddedHtml).not.toContain('data-testid="knob-minimal-expand-toggle"');
    const renderedFullCards = fullEmbeddedHtml.match(/data-testid="knob-card-/g) ?? [];
    expect(renderedFullCards).toHaveLength(ASCEND_KNOB_CATALOG.length);
  });

  it("renders ToolsPage tab=knobs SSR, restores presets/filters/fromPage, and displays conflicts & 1-click fixes", async () => {
    const handler = createStaticHandler([
      {
        path: "/",
        Component: AppShell,
        children: [{ path: "tools", Component: ToolsPage }],
      },
    ]);
    const renderUrl = async (url: string) => {
      const ctx = await handler.query(new Request(url));
      if (ctx instanceof Response) throw new Error(`unexpected redirect on ${url}`);
      const router = createStaticRouter(handler.dataRoutes, ctx);
      return renderToStaticMarkup(createElement(StaticRouterProvider, { router, context: ctx }));
    };

    const defaultKnobsHtml = await renderUrl("http://localhost/tools?tab=knobs");
    expect(defaultKnobsHtml).toContain('data-testid="tools-tab-knobs"');
    expect(defaultKnobsHtml).toContain("⑥ 调参查字典");
    expect(defaultKnobsHtml).toContain("调优旋钮雷达");
    expect(defaultKnobsHtml).toContain("后三个提供芯片算子微观沙盘");
    expect(defaultKnobsHtml).toContain(`反查 ${ASCEND_KNOB_CATALOG.length} 个环境变量与隐藏开关`);
    expect(defaultKnobsHtml).toContain('data-testid="ascend-knob-radar-view"');
    expect(defaultKnobsHtml).toContain('data-testid="knob-ctx-pp"');
    expect(defaultKnobsHtml).toContain('data-testid="knob-shell-preview"');
    expect(defaultKnobsHtml).toContain('data-testid="knob-json-preview"');
    expect(defaultKnobsHtml).toContain("vllm serve");

    const minefieldHtml = await renderUrl(
      "http://localhost/tools?tab=knobs&preset=preset-legacy-docs-minefield&fromPage=ascend-config-system",
    );
    expect(minefieldHtml).toContain("返回主章节 · ascend-config-system");
    expect(minefieldHtml).toContain('href="/wiki/ascend-config-system"');
    expect(minefieldHtml).toContain("🔴 启动阻断");
    expect(minefieldHtml).toContain("🟠 静默重置/失效");
    expect(minefieldHtml).toContain("🟡 性能反噬陷阱");
    expect(minefieldHtml).toContain('class="wt-kr-strike"');
    expect(minefieldHtml).toContain("一键修复：");
    expect(minefieldHtml).toContain('data-testid="knob-fix-all"');

    // Inactive or embedded views ignore URL query params
    const foreignSearch = new URLSearchParams(
      "tab=knobs&preset=preset-deepseek-engram-multistream&ver=main&q=nonexistent_xyz",
    );
    const inactiveHtml = renderToStaticMarkup(
      createElement(AscendKnobRadarView, { mode: "full", isActive: false, searchParams: foreignSearch }),
    );
    expect(inactiveHtml).toContain('data-version="v0.30.0"');
    expect(inactiveHtml).not.toContain('data-testid="knob-empty-catalog"');
  });

  it("filters catalog by tuning goal, entry kind, and keyword, and converges 1-click fixActions cleanly", () => {
    const hcclCommEnv = ASCEND_KNOB_CATALOG.filter((spec) =>
      matchesKnobFilter(spec, "comm", "env", "HCCL_BUFFSIZE"),
    );
    expect(hcclCommEnv.some((k) => k.id === "env_hccl_buffsize")).toBe(true);
    expect(hcclCommEnv.every((k) => k.entryKind === "env" && k.goals.includes("comm"))).toBe(true);

    const nzMatches = ASCEND_KNOB_CATALOG.filter((spec) =>
      matchesKnobFilter(spec, "all", "additional_config", "weight_nz_mode"),
    );
    expect(nzMatches.some((k) => k.id === "cfg_weight_nz_mode")).toBe(true);

    const parsedInit = resolveInitialRadarState(
      undefined,
      new URLSearchParams("preset=preset-sleep-mode-fast-wakeup&goal=memory&kind=env&q=PYTORCH_NPU"),
    );
    expect(parsedInit.presetId).toBe("preset-sleep-mode-fast-wakeup");
    expect(parsedInit.context.sleepMode).toBe(true);
    expect(parsedInit.goalFilter).toBe("memory");
    expect(parsedInit.kindFilter).toBe("env");
    expect(parsedInit.searchQuery).toBe("PYTORCH_NPU");

    // Verify every catalog knob resolves a registered formal Wiki deep-link href with zero exceptions
    for (const knob of ASCEND_KNOB_CATALOG) {
      const link = resolveToolDeepLink(knob.wikiPageId, { anchor: knob.wikiAnchor });
      expect(link.href.startsWith("#/wiki/")).toBe(true);
    }

    // Verify 1-click fixAction state convergence on minefield preset
    const minefield = KNOB_RECIPE_PRESETS.find((p) => p.id === "preset-legacy-docs-minefield")!;
    let ctx = minefield.context;
    let sel: KnobSelectionMap = minefield.selections;
    for (let i = 0; i < 100; i += 1) {
      const evalRes = evaluateKnobRecipe(ctx, sel);
      const fixable = evalRes.findings.find((f) => f.severity !== "synergy" && f.fixAction !== undefined);
      if (!fixable?.fixAction) break;
      const next = applyKnobFixAction(ctx, sel, fixable.fixAction);
      ctx = next.context;
      sel = next.selections;
    }
    const cleanEval = evaluateKnobRecipe(ctx, sel);
    expect(cleanEval.blockers).toHaveLength(0);
    expect(cleanEval.silentResets).toHaveLength(0);
    expect(cleanEval.perfTraps).toHaveLength(0);
  });

  it("round-trips cleared selections (sel=none), full 12-field context, and custom selections in URL & embedded workbench link", () => {
    const emptyParams = new URLSearchParams("tab=knobs&fromPage=ascend-config-system");
    const customCtx = {
      version: "main" as const,
      soc: "A5" as const,
      modelKind: "engram_moe" as const,
      graphMode: "FULL_AND_PIECEWISE" as const,
      tpSize: 8 as const,
      dpSize: 4 as const,
      ppSize: 2 as const,
      epEnabled: true,
      sleepMode: false,
      rforkEnabled: true,
      loraEnabled: true,
      pdRole: "decode" as const,
    };
    appendKnobRadarStateParams(emptyParams, {
      context: customCtx,
      selections: {},
      matchedPresetId: undefined,
      goalFilter: "comm",
      kindFilter: "cli_core",
      searchQuery: "kv-cache",
    });
    expect(emptyParams.get("sel")).toBe("none");
    expect(emptyParams.get("pp")).toBe("2");
    expect(emptyParams.get("lora")).toBe("1");

    const restoredCleared = resolveInitialRadarState(undefined, emptyParams);
    expect(restoredCleared.selections).toEqual({});
    expect(restoredCleared.context).toEqual(customCtx);
    expect(restoredCleared.goalFilter).toBe("comm");
    expect(restoredCleared.kindFilter).toBe("cli_core");
    expect(restoredCleared.searchQuery).toBe("kv-cache");

    const customSelParams = new URLSearchParams("tab=knobs");
    appendKnobRadarStateParams(customSelParams, {
      context: customCtx,
      selections: { cli_kv_cache_dtype: "fp8", env_enable_batch_memcpy: "1" },
      matchedPresetId: undefined,
      goalFilter: "all",
      kindFilter: "all",
      searchQuery: "",
    });
    const restoredWithSel = resolveInitialRadarState(undefined, customSelParams);
    expect(restoredWithSel.selections).toEqual({
      cli_kv_cache_dtype: "fp8",
      env_enable_batch_memcpy: "1",
    });
    expect(restoredWithSel.context.ppSize).toBe(2);

    // Reject broken JSON string on valueType === "json" knob, allow valid array JSON on layer_sharding,
    // and preserve out-of-range enum values on URL sel param so evaluateKnobRecipe raises blocker findings
    const mixedUrlSelParams = new URLSearchParams(
      `tab=knobs&ver=main&sel=${encodeURIComponent(
        JSON.stringify({
          cfg_shared_engram: "broken JSON",
          cfg_retired_layer_sharding: '["o_proj"]',
          cfg_enable_fused_mc2: 99,
          cfg_weight_nz_mode: 9,
          env_vllm_logging_level: "ERROR",
          env_expert_map_record: "True",
          env_enable_batch_memcpy: "1",
        }),
      )}`,
    );
    const restoredMixed = resolveInitialRadarState(undefined, mixedUrlSelParams);
    expect(restoredMixed.selections.cfg_shared_engram).toBe("broken JSON");
    expect(restoredMixed.selections.cfg_retired_layer_sharding).toBe('["o_proj"]');
    expect(restoredMixed.selections.cfg_enable_fused_mc2).toBe(99);
    expect(restoredMixed.selections.cfg_weight_nz_mode).toBe(9);
    expect(restoredMixed.selections.env_vllm_logging_level).toBe("ERROR");
    expect(restoredMixed.selections.env_expert_map_record).toBe("True");
    expect(restoredMixed.selections.env_enable_batch_memcpy).toBe("1");
    const mixedMainEval = evaluateKnobRecipe(
      { ...restoredMixed.context, version: "main" },
      restoredMixed.selections,
    );
    expect(mixedMainEval.blockers.some((b) => b.id === "rule-invalid-json-knob-cfg_shared_engram")).toBe(
      true,
    );
    const mixedEval = evaluateKnobRecipe(
      { ...restoredMixed.context, version: "v0.30.0" },
      restoredMixed.selections,
    );
    expect(mixedEval.findings.some((f) => f.id === "rule-mrv1-expert-map-record-case-trap")).toBe(true);
    expect(mixedEval.blockers.some((b) => b.id === "rule-invalid-enum-knob-cfg_enable_fused_mc2")).toBe(true);
    expect(mixedEval.blockers.some((b) => b.id === "rule-invalid-enum-knob-cfg_weight_nz_mode")).toBe(true);

    // Lossless URL sel round-trip for 257-char string & non-string JSON field: never drops to 0 blockers
    for (const selCase of [
      { cfg_sparse_kv_offload_enabled: true, cli_kv_cache_dtype: "x".repeat(257) },
      { cfg_shared_engram: 2, cfg_enable_cpu_binding: true },
    ] as const) {
      const qCase = new URLSearchParams();
      appendKnobRadarStateParams(qCase, {
        context: {
          version: "main",
          soc: "A3",
          modelKind: "mla_moe",
          graphMode: "FULL_DECODE_ONLY",
          tpSize: 8,
          dpSize: 1,
          ppSize: 1,
          epEnabled: false,
          sleepMode: false,
          rforkEnabled: false,
          loraEnabled: false,
          pdRole: "decode",
        },
        selections: selCase,
        goalFilter: "all",
        kindFilter: "all",
        searchQuery: "",
      });
      const initCase = resolveInitialRadarState(undefined, qCase);
      expect(initCase.selections).toEqual(selCase);
      const ssrCase = renderToStaticMarkup(createElement(AscendKnobRadarView, { searchParams: qCase }));
      expect(ssrCase).toMatch(/data-testid="knob-copy-cmd"[^>]*disabled/);
      expect(ssrCase).toMatch(/data-testid="knob-copy-json"[^>]*disabled/);
    }

    // Non-primitive [0,1], oversized 513/262144-char strings, and truncated sel JSON never leak sentinels or enable copy
    for (const rawSel of [
      JSON.stringify({ env_ascend_rt_visible_devices: [0, 1], cfg_enable_cpu_binding: true }),
      JSON.stringify({ env_ascend_rt_visible_devices: "x".repeat(513), cfg_enable_cpu_binding: true }),
      JSON.stringify({ cfg_sparse_kv_offload_enabled: true, cli_kv_cache_dtype: "x".repeat(262144) }),
      "{}".padEnd(262145, " "),
      JSON.stringify({ note: "汉".repeat(90000) }),
      '{"cfg_enable_cpu_binding":tru',
    ]) {
      const qCorrupt = new URLSearchParams({ tab: "knobs", ver: "main", sel: rawSel });
      const initCorrupt = resolveInitialRadarState(undefined, qCorrupt);
      const evCorrupt = evaluateKnobRecipe(initCorrupt.context, initCorrupt.selections);
      expect(evCorrupt.blockers.length).toBeGreaterThan(0);
      expect(evCorrupt.shellCommand).not.toContain("__URL_SEL_CORRUPT__");
      const ssrCorrupt = renderToStaticMarkup(createElement(AscendKnobRadarView, { searchParams: qCorrupt }));
      expect(ssrCorrupt).toMatch(/data-testid="knob-copy-cmd"[^>]*disabled/);
    }

    const blockedHtml = renderToStaticMarkup(
      createElement(AscendKnobRadarView, {
        mode: "full",
        initialPresetId: "preset-legacy-docs-minefield",
        embedded: true,
      }),
    );
    expect(blockedHtml).toMatch(/data-testid="knob-copy-cmd"[^>]*disabled/);
    expect(blockedHtml).toMatch(/data-testid="knob-copy-json"[^>]*disabled/);

    // Version-scoped recommended value pills (P3-1): main hides VLLM_USE_V2_MODEL_RUNNER=0 pill
    const mainFullHtml = renderToStaticMarkup(
      createElement(AscendKnobRadarView, {
        mode: "full",
        initialPresetId: "preset-deepseek-engram-multistream",
        embedded: true,
      }),
    );
    expect(mainFullHtml).toContain('data-testid="knob-val-env_vllm_use_v2_model_runner-1"');
    expect(mainFullHtml).not.toContain('data-testid="knob-val-env_vllm_use_v2_model_runner-0"');
    const v030FullHtml = renderToStaticMarkup(
      createElement(AscendKnobRadarView, {
        mode: "full",
        initialPresetId: "preset-a3-large-ep-moe",
        embedded: true,
      }),
    );
    expect(v030FullHtml).toContain('data-testid="knob-val-env_vllm_use_v2_model_runner-0"');

    // Embedded workbench link carries non-default preset when active
    const embeddedA3 = renderToStaticMarkup(
      createElement(
        DiagramPageContext.Provider,
        { value: "ascend-config-system" },
        createElement(AscendKnobRadarView, {
          mode: "minimal",
          initialPresetId: "preset-a3-large-ep-moe",
          embedded: true,
        }),
      ),
    );
    expect(embeddedA3).toContain("preset=preset-a3-large-ep-moe");
    expect(embeddedA3).toContain("fromPage=ascend-config-system");
  });

  it("P2-2: external searchParams POP navigation (q=first -> q=second) triggers zero stale URL write-backs in React createRoot + act", async () => {
    class MiniDomNode {
      nodeType: number;
      tagName: string;
      nodeName: string;
      parentNode: MiniDomNode | null = null;
      childNodes: MiniDomNode[] = [];
      ownerDocument: MiniDomNode | null = null;
      style: Record<string, string> = {};
      dataset: Record<string, string> = {};
      _attrs = new Map<string, string>();
      _text = "";
      value = "";
      defaultValue = "";
      checked = false;
      defaultChecked = false;
      selected = false;
      defaultSelected = false;
      multiple = false;
      disabled = false;
      hidden = false;
      type = "";
      htmlFor = "";
      tabIndex = 0;
      open = false;
      defaultView: unknown = null;
      documentElement: MiniDomNode | null = null;
      body: MiniDomNode | null = null;
      activeElement: MiniDomNode | null = null;

      get options(): MiniDomNode[] {
        const opts: MiniDomNode[] = [];
        const walk = (n: MiniDomNode) => {
          for (const c of n.childNodes) {
            if (c.tagName === "OPTION") opts.push(c);
            else walk(c);
          }
        };
        walk(this);
        return opts;
      }

      constructor(nodeType: number, tagOrName: string, doc: MiniDomNode | null) {
        this.nodeType = nodeType;
        this.tagName = tagOrName.toUpperCase();
        this.nodeName = nodeType === 1 ? this.tagName : tagOrName;
        this.ownerDocument = doc;
      }

      get firstChild(): MiniDomNode | null {
        return this.childNodes[0] ?? null;
      }

      get lastChild(): MiniDomNode | null {
        return this.childNodes[this.childNodes.length - 1] ?? null;
      }

      get nextSibling(): MiniDomNode | null {
        if (!this.parentNode) return null;
        const idx = this.parentNode.childNodes.indexOf(this);
        return idx >= 0 ? (this.parentNode.childNodes[idx + 1] ?? null) : null;
      }

      get previousSibling(): MiniDomNode | null {
        if (!this.parentNode) return null;
        const idx = this.parentNode.childNodes.indexOf(this);
        return idx > 0 ? (this.parentNode.childNodes[idx - 1] ?? null) : null;
      }

      get className(): string {
        return this._attrs.get("class") ?? "";
      }

      set className(val: string) {
        this._attrs.set("class", val);
      }

      get nodeValue(): string {
        return this._text;
      }

      set nodeValue(val: string) {
        this._text = val;
      }

      get textContent(): string {
        if (this.nodeType === 3 || this.nodeType === 8) return this._text;
        return this.childNodes.map((c) => c.textContent).join("");
      }

      set textContent(val: string) {
        if (this.nodeType === 3 || this.nodeType === 8) {
          this._text = val;
          return;
        }
        this.childNodes = [];
        if (val.length > 0 && this.ownerDocument) {
          const textNode = new MiniDomNode(3, "#text", this.ownerDocument);
          textNode._text = val;
          textNode.parentNode = this;
          this.childNodes.push(textNode);
        }
      }

      appendChild(child: MiniDomNode): MiniDomNode {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
      }

      insertBefore(child: MiniDomNode, refNode: MiniDomNode | null): MiniDomNode {
        if (!refNode) return this.appendChild(child);
        if (child.parentNode) child.parentNode.removeChild(child);
        const idx = this.childNodes.indexOf(refNode);
        child.parentNode = this;
        if (idx === -1) this.childNodes.push(child);
        else this.childNodes.splice(idx, 0, child);
        return child;
      }

      removeChild(child: MiniDomNode): MiniDomNode {
        const idx = this.childNodes.indexOf(child);
        if (idx >= 0) {
          this.childNodes.splice(idx, 1);
          child.parentNode = null;
        }
        return child;
      }

      setAttribute(name: string, val: string): void {
        this._attrs.set(name, String(val));
        if (name === "value") this.value = String(val);
        if (name === "disabled") this.disabled = true;
      }

      getAttribute(name: string): string | null {
        return this._attrs.get(name) ?? null;
      }

      removeAttribute(name: string): void {
        this._attrs.delete(name);
        if (name === "disabled") this.disabled = false;
      }

      hasAttribute(name: string): boolean {
        return this._attrs.has(name);
      }

      contains(other: MiniDomNode | null): boolean {
        let cur = other;
        while (cur) {
          if (cur === this) return true;
          cur = cur.parentNode;
        }
        return false;
      }

      addEventListener(): void {}
      removeEventListener(): void {}

      createElement(tag: string): MiniDomNode {
        return new MiniDomNode(1, tag, this);
      }

      createElementNS(_ns: string, tag: string): MiniDomNode {
        return new MiniDomNode(1, tag, this);
      }

      createTextNode(text: string): MiniDomNode {
        const node = new MiniDomNode(3, "#text", this);
        node._text = String(text);
        return node;
      }

      createComment(data: string): MiniDomNode {
        const node = new MiniDomNode(8, "#comment", this);
        node._text = String(data);
        return node;
      }
    }

    const g = globalThis as Record<string, unknown>;
    const saved = {
      window: g.window,
      document: g.document,
      Node: g.Node,
      Element: g.Element,
      HTMLElement: g.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: g.IS_REACT_ACT_ENVIRONMENT,
    };

    const doc = new MiniDomNode(9, "#document", null);
    const html = doc.createElement("html");
    const body = doc.createElement("body");
    html.appendChild(body);
    doc.documentElement = html;
    doc.body = body;
    const container = doc.createElement("div");
    body.appendChild(container);
    class MiniHtmlIFrameElement extends MiniDomNode {}
    const fakeWin = {
      document: doc,
      location: { hash: "#/tools?tab=knobs&q=first", pathname: "/tools", search: "" },
      addEventListener: () => {},
      removeEventListener: () => {},
      setTimeout,
      clearTimeout,
      Node: MiniDomNode,
      Element: MiniDomNode,
      HTMLElement: MiniDomNode,
      HTMLIFrameElement: MiniHtmlIFrameElement,
    };
    doc.defaultView = fakeWin;

    g.window = fakeWin;
    g.document = doc;
    g.Node = MiniDomNode;
    g.Element = MiniDomNode;
    g.HTMLElement = MiniDomNode;
    g.IS_REACT_ACT_ENVIRONMENT = true;

    const findByTestId = (rootNode: MiniDomNode, testId: string): MiniDomNode | null => {
      if (rootNode.getAttribute("data-testid") === testId) return rootNode;
      for (const child of rootNode.childNodes) {
        const found = findByTestId(child, testId);
        if (found) return found;
      }
      return null;
    };

    const writes: string[] = [];
    const onUpdateSearchParams = (nextParams: URLSearchParams) => {
      writes.push(nextParams.toString());
    };

    let root: ReturnType<typeof createRoot> | null = null;
    try {
      root = createRoot(container as unknown as Element);
      await act(async () => {
        root?.render(
          createElement(AscendKnobRadarView, {
            mode: "full",
            isActive: true,
            searchParams: new URLSearchParams("tab=knobs&q=first"),
            locationKey: "entry-1",
            onUpdateSearchParams,
          }),
        );
      });
      expect(writes).toHaveLength(0);
      expect(findByTestId(container, "knob-search-input")?.value).toBe("first");

      // Simulate browser Back/Forward (POP) updating searchParams externally
      await act(async () => {
        root?.render(
          createElement(AscendKnobRadarView, {
            mode: "full",
            isActive: true,
            searchParams: new URLSearchParams("tab=knobs&q=second"),
            locationKey: "pop-2",
            onUpdateSearchParams,
          }),
        );
      });
      expect(writes).toHaveLength(0);
      expect(findByTestId(container, "knob-search-input")?.value).toBe("second");

      // Shared URL with A3 + Sparse KV + fp8_e4m3 preserves fp8_e4m3 and disables copy buttons
      const fp8UrlParams = new URLSearchParams();
      appendKnobRadarStateParams(fp8UrlParams, {
        context: {
          version: "v0.30.0",
          soc: "A3",
          modelKind: "mla_moe",
          graphMode: "FULL_DECODE_ONLY",
          tpSize: 8,
          dpSize: 1,
          ppSize: 1,
          epEnabled: false,
          sleepMode: false,
          rforkEnabled: false,
          loraEnabled: false,
          pdRole: "decode",
        },
        selections: {
          cfg_sparse_kv_offload_enabled: true,
          cli_kv_cache_dtype: "fp8_e4m3",
        },
        goalFilter: "all",
        kindFilter: "all",
        searchQuery: "",
      });
      const resolvedFp8 = resolveInitialRadarState(undefined, fp8UrlParams);
      expect(resolvedFp8.selections.cli_kv_cache_dtype).toBe("fp8_e4m3");
      await act(async () => {
        root?.render(
          createElement(AscendKnobRadarView, {
            mode: "full",
            isActive: true,
            searchParams: fp8UrlParams,
            locationKey: "pop-fp8-e4m3",
            onUpdateSearchParams,
          }),
        );
      });
      expect(findByTestId(container, "knob-copy-cmd")?.disabled).toBe(true);
      expect(findByTestId(container, "knob-copy-json")?.disabled).toBe(true);

      // Shared URL with main octave/ultraquant & whitespace-padded " bfloat16 " also preserves value and disables copy
      for (const badDtype of [
        "octave_k3v4",
        "octave_k3v3",
        "octave_k3v3_compact",
        "ultraquant_4bit",
        " bfloat16 ",
      ] as const) {
        const qBad = new URLSearchParams();
        appendKnobRadarStateParams(qBad, {
          context: {
            version: "main",
            soc: "A3",
            modelKind: "mla_moe",
            graphMode: "FULL_DECODE_ONLY",
            tpSize: 8,
            dpSize: 1,
            ppSize: 1,
            epEnabled: false,
            sleepMode: false,
            rforkEnabled: false,
            loraEnabled: false,
            pdRole: "decode",
          },
          selections: {
            cfg_sparse_kv_offload_enabled: true,
            cli_kv_cache_dtype: badDtype,
          },
          goalFilter: "all",
          kindFilter: "all",
          searchQuery: "",
        });
        const initBad = resolveInitialRadarState(undefined, qBad);
        expect(initBad.selections.cli_kv_cache_dtype).toBe(badDtype);
        const ssrBad = renderToStaticMarkup(createElement(AscendKnobRadarView, { searchParams: qBad }));
        expect(ssrBad).toMatch(/data-testid="knob-copy-cmd"[^>]*disabled/);
        expect(ssrBad).toMatch(/data-testid="knob-copy-json"[^>]*disabled/);
      }

      // GPT-Signoff-14 P2-2: fresh mount with sel={"cfg_enable_mlapo":true,"cfg_eplb_stair_rank_transfer_limit":1e20},
      // capturing component-written URL, and fresh remount from that written URL preserves blocker=1 and disabled copy buttons
      await act(async () => {
        root?.unmount();
      });
      writes.length = 0;
      const float1e20Params = new URLSearchParams(
        'tab=knobs&ver=main&soc=A3&model=mla_moe&graph=FULL_DECODE_ONLY&tp=8&dp=1&pp=1&pd=decode&ep=0&sleep=0&rfork=0&lora=0&sel={"cfg_enable_mlapo":true,"cfg_eplb_stair_rank_transfer_limit":1e20}',
      );
      await act(async () => {
        root = createRoot(container as unknown as Element);
        root.render(
          createElement(AscendKnobRadarView, {
            mode: "full",
            isActive: true,
            searchParams: float1e20Params,
            locationKey: "fresh-float-1e20-mount1",
            onUpdateSearchParams,
          }),
        );
      });
      expect(findByTestId(container, "knob-count-blocker")?.textContent).toContain("1");
      expect(findByTestId(container, "knob-copy-cmd")?.disabled).toBe(true);
      expect(findByTestId(container, "knob-copy-json")?.disabled).toBe(true);
      expect(writes.length).toBeGreaterThan(0);

      const rewrittenQuery = writes[writes.length - 1]!;
      const remountParams = new URLSearchParams(rewrittenQuery);
      await act(async () => {
        root?.unmount();
      });
      await act(async () => {
        root = createRoot(container as unknown as Element);
        root.render(
          createElement(AscendKnobRadarView, {
            mode: "full",
            isActive: true,
            searchParams: remountParams,
            locationKey: "fresh-float-1e20-mount2",
            onUpdateSearchParams,
          }),
        );
      });
      expect(findByTestId(container, "knob-count-blocker")?.textContent).toContain("1");
      expect(findByTestId(container, "knob-copy-cmd")?.disabled).toBe(true);
      expect(findByTestId(container, "knob-copy-json")?.disabled).toBe(true);

      // GPT-Signoff-15 P2-1 & P3-1: bare unsafe integer 9007199254740993 on string knob env_ascend_rt_visible_devices
      // stays rejected (1 -> 1 blocker across URL write-back), and 1e309 on STAIR triggers exactly 1 overflow blocker
      writes.length = 0;
      const visDevBareIntParams = new URLSearchParams(
        'tab=knobs&ver=main&soc=A3&model=mla_moe&graph=FULL_DECODE_ONLY&tp=8&dp=1&pp=1&pd=decode&ep=0&sleep=0&rfork=0&lora=0&sel={"cfg_enable_mlapo":true,"env_ascend_rt_visible_devices":9007199254740993}',
      );
      await act(async () => {
        root?.unmount();
        root = createRoot(container as unknown as Element);
        root.render(
          createElement(AscendKnobRadarView, {
            mode: "full",
            isActive: true,
            searchParams: visDevBareIntParams,
            locationKey: "vis-dev-bare-int-1",
            onUpdateSearchParams,
          }),
        );
      });
      expect(findByTestId(container, "knob-count-blocker")?.textContent).toContain("1");
      expect(findByTestId(container, "knob-copy-cmd")?.disabled).toBe(true);
      expect(findByTestId(container, "knob-copy-json")?.disabled).toBe(true);
      const visDevRewritten = writes[writes.length - 1] ?? visDevBareIntParams.toString();
      await act(async () => {
        root?.unmount();
        root = createRoot(container as unknown as Element);
        root.render(
          createElement(AscendKnobRadarView, {
            mode: "full",
            isActive: true,
            searchParams: new URLSearchParams(visDevRewritten),
            locationKey: "vis-dev-bare-int-2",
            onUpdateSearchParams,
          }),
        );
      });
      expect(findByTestId(container, "knob-count-blocker")?.textContent).toContain("1");
      expect(findByTestId(container, "knob-copy-cmd")?.disabled).toBe(true);
      expect(findByTestId(container, "knob-copy-json")?.disabled).toBe(true);

      const inf1e309Init = resolveInitialRadarState(
        undefined,
        new URLSearchParams(
          'tab=knobs&ver=main&soc=A3&model=mla_moe&graph=FULL_DECODE_ONLY&tp=8&dp=1&pp=1&pd=decode&ep=0&sleep=0&rfork=0&lora=0&sel={"cfg_eplb_stair_rank_transfer_limit":1e309}',
        ),
      );
      const inf1e309Eval = evaluateKnobRecipe(inf1e309Init.context, inf1e309Init.selections);
      expect(inf1e309Eval.blockers).toHaveLength(1);
      expect(inf1e309Eval.blockers[0]?.title).toContain("IEEE-754");
    } finally {
      await act(async () => {
        root?.unmount();
      });
      g.window = saved.window;
      g.document = saved.document;
      g.Node = saved.Node;
      g.Element = saved.Element;
      g.HTMLElement = saved.HTMLElement;
      g.IS_REACT_ACT_ENVIRONMENT = saved.IS_REACT_ACT_ENVIRONMENT;
    }
  });
});
