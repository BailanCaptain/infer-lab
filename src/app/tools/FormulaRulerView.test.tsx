import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  extractWikiToolFences,
  type FormulaRulerMode,
  parseWikiToolFence,
} from "../../content/wiki/toolFence";
import { evaluateDeployPlan } from "../../sim/modelspec/deployCalculator";
import { WikiToolBlock } from "../wiki/WikiToolBlock";
import { FormulaRulerView, nextCustomDrawerOpen } from "./FormulaRulerView";
import {
  CUSTOM_INFERENCE_BADGE_TEXT,
  createTargetMachineStore,
  MAX_CUSTOM_HF_CONFIG_BYTES,
  TARGET_MACHINE_STORAGE_KEY,
  targetMachineStore,
} from "./targetMachineStore";

afterEach(() => {
  targetMachineStore.resetToBaseline();
});

describe("FormulaRulerView & targetMachineStore", () => {
  it("renders all 6 formula-ruler modes via WikiToolBlock SSR with real single-source numbers and zero placeholder", () => {
    const modes: readonly {
      mode: FormulaRulerMode;
      model?: string;
      expectedFromPage: string;
      token: string;
    }[] = [
      { mode: "kv-token-bytes", model: "qwen3-8b", expectedFromPage: "kv-cache", token: "18.000 MiB" },
      { mode: "gqa-ratio", model: "qwen3-8b", expectedFromPage: "gqa", token: "576.00 KiB" },
      { mode: "mla-compression", model: "qwen3-8b", expectedFromPage: "mla", token: "1,152 B / 层" },
      { mode: "tp-shard-comm", model: "qwen3-8b", expectedFromPage: "tensor-parallel", token: "15.26 GiB" },
      {
        mode: "moe-ep-dispatch",
        model: "qwen3-30b-a3b",
        expectedFromPage: "expert-parallel",
        token: "128 选 top-8",
      },
      {
        mode: "cold-start-budget",
        model: "qwen3-8b",
        expectedFromPage: "kv-cache-memory-profiling",
        token: "57.60 GiB",
      },
    ];

    for (const item of modes) {
      const fence = `tool: formula-ruler\nmode: ${item.mode}\nmodel: ${item.model}`;
      const html = renderToStaticMarkup(createElement(WikiToolBlock, { source: fence }));
      expect(html).toContain('data-testid="wiki-tool-formula-ruler"');
      expect(html).toContain('data-testid="formula-ruler-view"');
      expect(html).toContain(`data-testid="lens-${item.mode}"`);
      expect(html).not.toContain("wiki-tool-placeholder");
      expect(html).not.toContain("wiki-tool-loading");
      expect(html).not.toContain('data-testid="wiki-tool-invalid"');
      expect(html).toContain('data-deviated="false"');
      expect(html).not.toContain(CUSTOM_INFERENCE_BADGE_TEXT);
      expect(html).toContain("恢复审定基线");
      expect(html).toContain("带此配置打开部署算账台 →");
      expect(html).toContain(`fromPage=${item.expectedFromPage}`);
      expect(html).toContain(item.token);
    }
  });

  it("updates all 6 lenses reactively across targetMachineStore transitions and resets cleanly to baseline", () => {
    let notifyCount = 0;
    const unsub = targetMachineStore.subscribe(() => {
      notifyCount += 1;
    });

    // 1. Switch to Qwen3-30B-A3B + TP=8 + W8A8_DYNAMIC + 128K + u=0.85 -> triggers GQA KV replication & custom badge
    targetMachineStore.setPreset("qwen3-30b-a3b");
    targetMachineStore.setTpSize(8);
    targetMachineStore.setWeightPrecision("w8a8_dynamic");
    targetMachineStore.setMaxModelLen(131072);
    targetMachineStore.setGpuMemoryUtilization(0.85);
    targetMachineStore.setCardId("a3-die64g");
    expect(notifyCount).toBe(6);

    const gqaHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, { source: "tool: formula-ruler\nmode: gqa-ratio\nmodel: qwen3-8b" }),
    );
    expect(gqaHtml).toContain('data-deviated="true"');
    expect(gqaHtml).toContain(CUSTOM_INFERENCE_BADGE_TEXT);
    expect(gqaHtml).toContain('data-testid="gqa-kv-replication-alert"');
    expect(gqaHtml).toContain("num_kv_head_replicas = 2");
    expect(gqaHtml).toContain("24.00 KiB");
    expect(gqaHtml).toContain("preset=qwen3-30b-a3b");
    expect(gqaHtml).toContain("tp=8");
    expect(gqaHtml).toContain("precision=w8a8_dynamic");
    expect(gqaHtml).toContain("maxLen=131072");

    const tpHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, { source: "tool: formula-ruler\nmode: tp-shard-comm\nmodel: qwen3-8b" }),
    );
    expect(tpHtml).toContain("2 次/层 · 共 96 次");

    const moeOnMoeHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: "tool: formula-ruler\nmode: moe-ep-dispatch\nmodel: qwen3-30b-a3b",
      }),
    );
    expect(moeOnMoeHtml).not.toContain('data-testid="moe-non-moe-hint"');
    expect(moeOnMoeHtml).toContain("16 完整专家 / 卡");

    // 2. Switch to non-MoE Qwen3-8B on moe-ep-dispatch -> shows friendly switch-to-qwen3-30b-a3b hint
    targetMachineStore.setPreset("qwen3-8b");
    const moeOnDenseHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, {
        source: "tool: formula-ruler\nmode: moe-ep-dispatch\nmodel: qwen3-30b-a3b",
      }),
    );
    expect(moeOnDenseHtml).toContain('data-testid="moe-non-moe-hint"');
    expect(moeOnDenseHtml).toContain("qwen3-30b-a3b");

    // 3. Switch to DeepSeek-V3 MLA on mla-compression -> renders direct MLA latent compression
    targetMachineStore.setPreset("deepseek-v3-mla");
    const mlaDirectHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, { source: "tool: formula-ruler\nmode: mla-compression" }),
    );
    expect(mlaDirectHtml).toContain('data-testid="metric-mla-latent-layer"');
    expect(mlaDirectHtml).toContain("1,152 B");
    expect(mlaDirectHtml).toContain("56.89×");
    expect(mlaDirectHtml).not.toContain('data-testid="mla-non-mla-compare-note"');

    // 4. One-click reset restores baseline state and clears custom inference badge
    targetMachineStore.resetToBaseline();
    const resetHtml = renderToStaticMarkup(
      createElement(WikiToolBlock, { source: "tool: formula-ruler\nmode: kv-token-bytes\nmodel: qwen3-8b" }),
    );
    expect(resetHtml).toContain('data-deviated="false"');
    expect(resetHtml).not.toContain(CUSTOM_INFERENCE_BADGE_TEXT);
    expect(resetHtml).toContain("144.00 KiB");
    unsub();
  });

  it("safely validates custom HuggingFace config.json (<=64KB), persists to localStorage, and survives privacy-mode exceptions", () => {
    const memMap = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => memMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memMap.set(k, v);
      },
      removeItem: (k: string) => {
        memMap.delete(k);
      },
    };
    const isolatedStore = createTargetMachineStore(mockStorage);

    // Valid custom GQA config.json (16 layers, 16Q:2KV, head_dim=128 -> single layer 2*2*128*2 = 1024 B, 16 layers = 16 KiB)
    const customCfg = JSON.stringify({
      model_type: "qwen3",
      architectures: ["Qwen3ForCausalLM"],
      hidden_size: 2048,
      num_hidden_layers: 16,
      num_attention_heads: 16,
      num_key_value_heads: 2,
      head_dim: 128,
      intermediate_size: 6144,
      vocab_size: 32000,
    });
    const okRes = isolatedStore.applyCustomConfig(customCfg);
    expect(okRes.ok).toBe(true);
    expect(memMap.has(TARGET_MACHINE_STORAGE_KEY)).toBe(true);

    const customHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, {
        mode: "kv-token-bytes",
        fromPage: "kv-cache",
        store: isolatedStore,
      }),
    );
    expect(customHtml).toContain("1,024 B");
    expect(customHtml).toContain("16.00 KiB");
    expect(customHtml).toContain(CUSTOM_INFERENCE_BADGE_TEXT);
    expect(customHtml).toContain("customModel=");
    expect(customHtml).toContain("fromPage=kv-cache");

    // Hydrates persisted custom config & parameters into a fresh store instance
    isolatedStore.setTpSize(2);
    const rehydratedStore = createTargetMachineStore(mockStorage);
    expect(rehydratedStore.getSnapshot().tpSize).toBe(2);
    expect(rehydratedStore.getSnapshot().modelMode).toBe("custom");
    expect(rehydratedStore.getSnapshot().customSpec?.numLayers).toBe(16);

    // Rejects >64KB payload safely without crashing
    const oversized = `{"model_type":"qwen3","pad":"${"a".repeat(MAX_CUSTOM_HF_CONFIG_BYTES + 128)}"}`;
    const bigRes = isolatedStore.applyCustomConfig(oversized);
    expect(bigRes.ok).toBe(false);
    expect(bigRes.error).toContain("64 KB");

    const errHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, {
        mode: "cold-start-budget",
        store: isolatedStore,
      }),
    );
    expect(errHtml).toContain('data-testid="formula-ruler-config-error"');
    expect(errHtml).toContain("64 KB");

    // Rejects malformed JSON and non-finite numbers cleanly
    expect(isolatedStore.applyCustomConfig("{not valid json").ok).toBe(false);
    expect(isolatedStore.applyCustomConfig('{"model_type":"qwen3","hidden_size":1e400}').ok).toBe(false);

    // Privacy-mode throwing storage never throws on init, mutation, or reset
    const throwingStorage = {
      getItem: () => {
        throw new Error("SecurityError: localStorage disabled");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    const privateStore = createTargetMachineStore(throwingStorage);
    expect(() => privateStore.setPreset("qwen3-30b-a3b")).not.toThrow();
    expect(() => privateStore.resetToBaseline()).not.toThrow();
  });

  it("verifies all 6 modified concept pages contain valid formula-ruler fences that SSR cleanly", () => {
    const expectedPages: readonly { file: string; mode: FormulaRulerMode }[] = [
      { file: "wiki/concepts/kv-cache.md", mode: "kv-token-bytes" },
      { file: "wiki/concepts/gqa.md", mode: "gqa-ratio" },
      { file: "wiki/concepts/mla.md", mode: "mla-compression" },
      { file: "wiki/concepts/tensor-parallel.md", mode: "tp-shard-comm" },
      { file: "wiki/concepts/expert-parallel.md", mode: "moe-ep-dispatch" },
      { file: "wiki/concepts/kv-cache-memory-profiling.md", mode: "cold-start-budget" },
    ];

    for (const item of expectedPages) {
      const raw = readFileSync(join(process.cwd(), item.file), "utf8");
      const fences = extractWikiToolFences(raw);
      const rulerFences = fences
        .map((f) => parseWikiToolFence(f.source))
        .filter((p) => p.ok && p.spec.tool === "formula-ruler");
      expect(rulerFences, item.file).toHaveLength(1);
      const parsed = rulerFences[0]!;
      expect(parsed.ok && parsed.spec.mode).toBe(item.mode);

      const rawBlock = fences.find((f) => f.source.includes("tool: formula-ruler"))!;
      const html = renderToStaticMarkup(createElement(WikiToolBlock, { source: rawBlock.source }));
      expect(html).toContain(`data-testid="lens-${item.mode}"`);
      expect(html).not.toContain("wiki-tool-placeholder");
    }
  });

  it("keeps customDraftText separate from validatedCustomJsonText across persistence and deep-links, and allows collapsing drawer in custom mode", () => {
    const memMap = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => memMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memMap.set(k, v);
      },
      removeItem: (k: string) => {
        memMap.delete(k);
      },
    };
    const store = createTargetMachineStore(mockStorage);
    const validCfg = JSON.stringify({
      model_type: "qwen3",
      architectures: ["Qwen3ForCausalLM"],
      hidden_size: 2048,
      num_hidden_layers: 16,
      num_attention_heads: 16,
      num_key_value_heads: 2,
      head_dim: 128,
      intermediate_size: 6144,
      vocab_size: 32000,
    });

    expect(store.applyCustomConfig(validCfg).ok).toBe(true);
    expect(store.getSnapshot().customDraftText).toBe(validCfg);
    expect(store.getSnapshot().validatedCustomJsonText).toBe(validCfg);

    // Entering an invalid draft updates customDraftText only; subsequent TP/card persistence keeps validatedCustomJsonText
    expect(store.applyCustomConfig("{broken_draft").ok).toBe(false);
    expect(store.getSnapshot().customDraftText).toBe("{broken_draft");
    expect(store.getSnapshot().validatedCustomJsonText).toBe(validCfg);

    store.setTpSize(4);
    store.setCardId("a3-die64g");
    const persistedRaw = memMap.get(TARGET_MACHINE_STORAGE_KEY) ?? "";
    expect(persistedRaw).not.toContain("{broken_draft");
    expect(persistedRaw).toContain("Qwen3ForCausalLM");

    const rehydrated = createTargetMachineStore(mockStorage);
    expect(rehydrated.getSnapshot().modelMode).toBe("custom");
    expect(rehydrated.getSnapshot().tpSize).toBe(4);
    expect(rehydrated.getSnapshot().customSpec?.numLayers).toBe(16);
    expect(rehydrated.getSnapshot().validatedCustomJsonText).toBe(validCfg);
    expect(rehydrated.getSnapshot().customDraftText).toBe(validCfg);

    // Drawer opens initially in custom mode, shows draft, keeps validated customModel deep-link, and collapses cleanly on toggle
    const openHtml = renderToStaticMarkup(createElement(FormulaRulerView, { store }));
    expect(openHtml).toContain('data-testid="formula-ruler-custom-drawer"');
    expect(openHtml).toContain("收起 config.json");
    expect(openHtml).toContain("{broken_draft");
    expect(openHtml).toContain("customModel=");

    let drawerOpen = true;
    drawerOpen = nextCustomDrawerOpen(drawerOpen, "toggle");
    expect(drawerOpen).toBe(false);
    const collapsedHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { store, customDrawerOpen: drawerOpen }),
    );
    expect(collapsedHtml).not.toContain('data-testid="formula-ruler-custom-drawer"');
    expect(collapsedHtml).toContain("粘贴/拖入 config.json");
    expect(collapsedHtml).toContain('aria-expanded="false"');
    expect(collapsedHtml).toContain('data-deviated="true"');

    drawerOpen = nextCustomDrawerOpen(drawerOpen, "toggle");
    expect(drawerOpen).toBe(true);
    const reopenedHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { store, customDrawerOpen: drawerOpen }),
    );
    expect(reopenedHtml).toContain('data-testid="formula-ruler-custom-drawer"');
  });

  it("disables DeployCalculator handoff button instead of silently dropping customModel when compact config.json exceeds 4096 chars", () => {
    const store = createTargetMachineStore(null);
    const largeValidCfg = JSON.stringify({
      model_type: "qwen3_next",
      architectures: ["Qwen3NextForCausalLM"],
      hidden_size: 4096,
      num_hidden_layers: 256,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      head_dim: 128,
      intermediate_size: 12288,
      vocab_size: 151936,
      layer_types: Array.from({ length: 256 }, (_, i) =>
        i % 4 === 3 ? "full_sliding_attention_block" : "linear_kda_recurrent_block",
      ),
    });
    expect(largeValidCfg.length).toBeGreaterThan(4096);
    expect(store.applyCustomConfig(largeValidCfg).ok).toBe(true);
    expect(store.getSnapshot().validatedCustomJsonText.length).toBeGreaterThan(4096);

    const html = renderToStaticMarkup(createElement(FormulaRulerView, { store }));
    expect(html).not.toContain('href="#/tools?');
    expect(html).toContain('data-testid="formula-ruler-calculator-url-limit-note"');
    expect(html).toContain("自定义 config.json 超过 URL 分享长度上限，请复制 JSON 到部署算账台粘贴");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("disabled");
  });

  it("distinguishes positive KV pool insufficient for single max-len sequence from zero-KV budget overflow, and updates MLA/TP lenses accurately", () => {
    // Item 4A: Qwen3-8B on a2-32g + 131072 -> positive KV pool (11.00 GiB @ u=0.90, 11.64 GiB @ u=0.92), warns single 131K seq shortfall
    const shortStore = createTargetMachineStore(null);
    shortStore.setPreset("qwen3-8b");
    shortStore.setCardId("a2-32g");
    shortStore.setMaxModelLen(131072);
    expect(
      renderToStaticMarkup(createElement(FormulaRulerView, { mode: "kv-token-bytes", store: shortStore })),
    ).toContain("79,872 tok");
    shortStore.setGpuMemoryUtilization(0.92);

    for (const mode of ["kv-token-bytes", "cold-start-budget"] as const) {
      const html = renderToStaticMarkup(createElement(FormulaRulerView, { mode, store: shortStore }));
      expect(html).toContain("11.64 GiB");
      expect(html).toContain("84,608 tok");
      expect(html).toContain('data-testid="kv-single-seq-shortfall-alert"');
      expect(html).toContain("不足单条 131K 满长序列（需调小 max-model-len 或扩卡）");
      expect(html).not.toContain("0.00 GiB (超支)");
      expect(html).not.toContain("预算不足 (OOM)");
    }

    // Item 4B: Qwen3-30B-A3B on a2-32g + TP=1 -> weights exceed budget (kvPoolPointBytes <= 0) -> shows 0.00 GiB (超支)
    const overflowStore = createTargetMachineStore(null);
    overflowStore.setPreset("qwen3-30b-a3b");
    overflowStore.setCardId("a2-32g");
    for (const mode of ["kv-token-bytes", "cold-start-budget"] as const) {
      const html = renderToStaticMarkup(createElement(FormulaRulerView, { mode, store: overflowStore }));
      expect(html).toContain("0.00 GiB (超支)");
      expect(html).not.toContain('data-testid="kv-single-seq-shortfall-alert"');
    }

    // Item 5A: MLA vs GQA dynamically reflects TP head sharding vs MLA latent replication
    const mlaStore = createTargetMachineStore(null);
    mlaStore.setPreset("qwen3-8b");
    const mlaTp1Html = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "mla-compression", store: mlaStore }),
    );
    expect(mlaTp1Html).toContain("0.48×（省 52.3%）");
    expect(mlaTp1Html).not.toContain("省一半");

    mlaStore.setTpSize(8);
    const mlaTp8Html = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "mla-compression", store: mlaStore }),
    );
    expect(mlaTp8Html).toContain("纯 TP=8 下 GQA 切头而 MLA 复制潜缓存：每卡为 Qwen3-8B 的 3.81×");
    expect(mlaTp8Html).not.toContain("省一半");

    // Item 5B: tp-shard-comm shows 0 B cumulative cross-rank traffic at TP=1 and labels multi-rank formula with TP≥2
    const tpStore = createTargetMachineStore(null);
    tpStore.setPreset("qwen3-8b");
    const tp1CommHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "tp-shard-comm", store: tpStore }),
    );
    expect(tp1CommHtml).toContain("36 层累计 0 B（TP≥2 时每步为 9.00 MiB）");
    expect(tp1CommHtml).toContain("36 层累计 0 B（TP≥2 时每步为 288.00 MiB）");
    expect(tp1CommHtml).not.toContain("36 层累计 9.00 MiB");

    tpStore.setTpSize(2);
    const tp2CommHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "tp-shard-comm", store: tpStore }),
    );
    expect(tp2CommHtml).toContain("36 层累计 9.00 MiB");
    expect(tp2CommHtml).toContain("36 层累计 288.00 MiB");

    // Review closure: FormulaRuler explicitly passes pp=1 & dp=1 so DeepSeek-V3 MLA does not jump to PP=2 in calculator
    const dsStore = createTargetMachineStore(null);
    dsStore.setPreset("deepseek-v3-mla");
    const dsRulerHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "mla-compression", store: dsStore }),
    );
    expect(dsRulerHtml).toContain("pp=1");
    expect(dsRulerHtml).toContain("dp=1");

    // Full reactivity: switching card/precision/maxLen/u updates GQA, MLA, TP, EP, and ColdStart lenses visibly
    const gqaBaseStore = createTargetMachineStore(null);
    gqaBaseStore.setPreset("qwen3-8b");
    const gqaA264Html = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "gqa-ratio", store: gqaBaseStore }),
    );
    gqaBaseStore.setCardId("a2-32g");
    gqaBaseStore.setWeightPrecision("w8a8");
    gqaBaseStore.setMaxModelLen(131072);
    gqaBaseStore.setGpuMemoryUtilization(0.82);
    const gqaUpdatedHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "gqa-ratio", store: gqaBaseStore }),
    );
    expect(gqaA264Html).toContain("Atlas A2 64G");
    expect(gqaUpdatedHtml).toContain("Atlas A2 32G");
    expect(gqaUpdatedHtml).toContain("u=0.82");
    expect(gqaUpdatedHtml).toContain("131K");
    expect(gqaUpdatedHtml).toContain("w8a8");

    // When weights alone overflow on TP=1 (e.g. Qwen3-30B-A3B BF16 on A2 64G), maxLen changes still report 1-seq KV requirement
    const epOomStore = createTargetMachineStore(null);
    epOomStore.setPreset("qwen3-30b-a3b");
    const ep32kHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "moe-ep-dispatch", store: epOomStore }),
    );
    epOomStore.setMaxModelLen(131072);
    const ep128kHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "moe-ep-dispatch", store: epOomStore }),
    );
    expect(ep32kHtml).toContain("1条32K需KV");
    expect(ep128kHtml).toContain("1条131K需KV");
  });

  it("surfaces q1Fit blockers, distinguishes non-KV OOM causes, handles KDA state exhaustion, and keeps TP=1/ALLGATHER EP accurate", () => {
    // P2-3A: 310P + BF16 must surface q1Fit blocker banner & block safe status in ColdStartBudgetLens
    const p310Store = createTargetMachineStore(null);
    p310Store.setPreset("qwen3-8b");
    p310Store.setCardId("310p-24g");
    p310Store.setWeightPrecision("bf16");
    const p310Html = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "cold-start-budget", store: p310Store }),
    );
    expect(p310Html).toContain('data-testid="formula-ruler-blockers-alert"');
    expect(p310Html).toContain("配置硬阻塞");
    expect(p310Html).toContain("硬阻塞");
    expect(p310Html).not.toContain("7 级账目与 1−u 余量安全");

    // P2-3B: Indivisible GQA heads (24Q:6KV at TP=4) must not claim "安全切分上限 TP=6" or "零冗余均分"
    const indivStore = createTargetMachineStore(null);
    const indivCfg = JSON.stringify({
      model_type: "qwen3",
      architectures: ["Qwen3ForCausalLM"],
      hidden_size: 3072,
      num_hidden_layers: 16,
      num_attention_heads: 24,
      num_key_value_heads: 6,
      head_dim: 128,
      intermediate_size: 8192,
      vocab_size: 32000,
    });
    expect(indivStore.applyCustomConfig(indivCfg).ok).toBe(true);
    indivStore.setTpSize(4);
    const gqaIndivHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "gqa-ratio", store: indivStore }),
    );
    expect(gqaIndivHtml).toContain('data-testid="formula-ruler-blockers-alert"');
    expect(gqaIndivHtml).toContain("整除阻塞");
    expect(gqaIndivHtml).not.toContain("零冗余均分");
    expect(gqaIndivHtml).not.toContain("安全切分上限 TP=6");

    // P2-4: non_kv_exceeds_budget (weights <= budget but weights + act + non-torch > budget) must not misreport weights alone exceeded
    const nonKvPlan = evaluateDeployPlan({
      model: "qwen3-30b-a3b",
      cardId: "a2-32g",
      weightPrecision: "bf16",
      tpSize: 2,
      enableEp: false,
      maxModelLen: 32768,
      gpuMemoryUtilization: 0.95,
    });
    expect(nonKvPlan.fourQuestions.q2Capacity.oomStatus).toBe("non_kv_exceeds_budget");
    const nonKvStore = createTargetMachineStore(null);
    nonKvStore.setPreset("qwen3-30b-a3b");
    nonKvStore.setCardId("a2-32g");
    nonKvStore.setWeightPrecision("bf16");
    nonKvStore.setTpSize(2);
    nonKvStore.setGpuMemoryUtilization(0.95);
    const nonKvHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "gqa-ratio", store: nonKvStore }),
    );
    expect(nonKvHtml).toContain("权重+激活+非Torch/HCCL 合计");
    expect(nonKvHtml).not.toMatch(/权重 \d+\.\d+ GiB 超预算/);

    // P2-5: Hybrid KDA on A2 32G BF16 TP=1 u=0.82 (positive KV budget consumed entirely by fixed linear state)
    const kdaStore = createTargetMachineStore(null);
    kdaStore.setPreset("hybrid-kda-gqa");
    kdaStore.setCardId("a2-32g");
    kdaStore.setGpuMemoryUtilization(0.82);
    kdaStore.setMaxModelLen(4096);
    const kdaKvHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "kv-token-bytes", store: kdaStore }),
    );
    expect(kdaKvHtml).toContain("0 tok（KDA 状态占满）");
    expect(kdaKvHtml).toContain("单调小 max-model-len 无效");
    expect(kdaKvHtml).not.toContain("仅低于单条");
    const kdaBudgetHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "cold-start-budget", store: kdaStore }),
    );
    expect(kdaBudgetHtml).toContain("6.40 GiB (分页 0 块)");
    expect(kdaBudgetHtml).toContain("KDA 固定状态占满分页池");

    // P2-6: MoeEpDispatchLens at TP=1 shows 0 B and no contradictory 3.00 MiB/tok; small TP on A2 labels ALLGATHER separately
    const epTp1Store = createTargetMachineStore(null);
    epTp1Store.setPreset("qwen3-30b-a3b");
    epTp1Store.setTpSize(1);
    const epTp1Html = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "moe-ep-dispatch", store: epTp1Store }),
    );
    expect(epTp1Html).toContain("0 B（单卡免跨卡派发）");
    expect(epTp1Html).not.toContain("3.00 MiB/tok");

    epTp1Store.setTpSize(2);
    const epTp2AllgatherHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "moe-ep-dispatch", store: epTp1Store }),
    );
    expect(epTp2AllgatherHtml).toContain("ALLGATHER（全收集模式）");
    expect(epTp2AllgatherHtml).toContain("非逐 token top-");

    // Codex confirmation fixes:
    // 1) 24Q:6KV at TP=8 (replicated but TP % nKV !== 0) AND 310P BF16 must not show contradictions in GqaRatioLens
    indivStore.setTpSize(8);
    const gqaTp8IndivHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "gqa-ratio", store: indivStore }),
    );
    expect(gqaTp8IndivHtml).toContain("整除阻塞");
    expect(gqaTp8IndivHtml).not.toContain("replicas=2");

    const gqa310pHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "gqa-ratio", store: p310Store }),
    );
    expect(gqa310pHtml).toContain("配置硬阻塞");
    expect(gqa310pHtml).not.toContain("安全切分上限");

    // 2) Pure linear_kda custom model (fits with 0 full-attention paged blocks) must NOT misreport KDA exhausted
    const pureKdaStore = createTargetMachineStore(null);
    const pureKdaCfg = JSON.stringify({
      model_type: "qwen3_next",
      architectures: ["Qwen3NextForCausalLM"],
      hidden_size: 4096,
      num_hidden_layers: 32,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      head_dim: 128,
      intermediate_size: 11008,
      vocab_size: 32000,
      layer_types: ["linear_kda"],
      linear_num_key_heads: 16,
      linear_num_value_heads: 32,
      linear_key_head_dim: 128,
      linear_value_head_dim: 128,
      linear_conv_kernel_dim: 4,
    });
    expect(pureKdaStore.applyCustomConfig(pureKdaCfg).ok).toBe(true);
    const pureKdaHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "gqa-ratio", store: pureKdaStore }),
    );
    expect(pureKdaHtml).not.toContain("KDA 占满");
    expect(pureKdaHtml).toContain("纯 KDA 按并发预留");
    // Pure linear_kda must show 0.00 KiB paged KV rather than fictional 256.00 KiB GQA bytes
    expect(pureKdaHtml).toContain("当前纯线性 KDA（0 层分页 KV）");
    expect(pureKdaHtml).toContain("0.00 KiB");
    expect(pureKdaHtml).not.toContain("当前 GQA（32Q:16KV）");

    // 3) csa2-sparse-mla formula in KvTokenBytesLens includes the 130 B indexer alongside (512+64)*2B
    const csa2Store = createTargetMachineStore(null);
    csa2Store.setPreset("csa2-sparse-mla");
    const csa2Html = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "kv-token-bytes", store: csa2Store }),
    );
    expect(csa2Html).toContain("1,282 B");
    expect(csa2Html).toContain("+ 索引 130B");
  });

  it("Session audit P1-2, P2-2 & P2-4: strips token/_name_or_path from custom config, preserves active preset on invalid JSON draft, and matches 310P Stage-7 bytes on Calculator handoff", () => {
    const memMap = new Map<string, string>();
    const memStorage = {
      getItem: (k: string) => memMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memMap.set(k, v);
      },
      removeItem: (k: string) => {
        memMap.delete(k);
      },
    };
    const store = createTargetMachineStore(memStorage);
    const dirtyCfg = JSON.stringify({
      model_type: "qwen3",
      architectures: ["Qwen3ForCausalLM"],
      hidden_size: 4096,
      intermediate_size: 12288,
      num_hidden_layers: 36,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      vocab_size: 151936,
      token: "AUDITMARK",
      _name_or_path: "/secret/internal/AUDITMARK",
    });
    expect(store.applyCustomConfig(dirtyCfg).ok).toBe(true);
    expect(store.getSnapshot().validatedCustomJsonText).not.toContain("AUDITMARK");
    expect([...memMap.values()].join(" ")).not.toContain("AUDITMARK");

    const customHtml = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "kv-token-bytes", store }),
    );
    expect(customHtml).not.toContain("AUDITMARK");

    // P2-4: Selecting preset B then typing invalid JSON "{" must NOT revert modelMode back to stale custom model A
    store.setPreset("qwen3-0.6b");
    expect(store.getSnapshot().modelMode).toBe("preset");
    const badRes = store.applyCustomConfig("{");
    expect(badRes.ok).toBe(false);
    expect(store.getSnapshot().modelMode).toBe("preset");
    expect(store.getSnapshot().presetOverrideId).toBe("qwen3-0.6b");

    // P2-2: 310P handoff passes effective cudagraphMode so Calculator produces identical Stage-7 bytes
    store.setCardId("310p-24g");
    store.setWeightPrecision("fp16");
    store.setTpSize(1);
    store.setGpuMemoryUtilization(0.9);
    store.setMaxModelLen(32768);
    const p310Html = renderToStaticMarkup(
      createElement(FormulaRulerView, { mode: "cold-start-budget", store }),
    );
    const hrefMatch = /href="#\/tools\?([^"]+)"/.exec(p310Html);
    expect(hrefMatch).not.toBeNull();
    const rawQuery = hrefMatch![1]!.replace(/&amp;/g, "&");
    expect(rawQuery).toContain("cudagraph=NONE");
    expect(rawQuery).toContain("eager=1");

    // Round-2 P2-1: Legacy localStorage customJsonText is scrubbed immediately upon store initialization
    const legacyBacking = new Map<string, string>();
    const legacyStorage = {
      getItem: (k: string) => legacyBacking.get(k) ?? null,
      setItem: (k: string, v: string) => {
        legacyBacking.set(k, v);
      },
      removeItem: (k: string) => {
        legacyBacking.delete(k);
      },
    };
    legacyBacking.set(
      TARGET_MACHINE_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        modelMode: "custom",
        presetOverrideId: null,
        customJsonText: dirtyCfg,
        cardId: "a2-64g",
        weightPrecision: "bf16",
        tpSize: 1,
        maxModelLen: 32768,
        gpuMemoryUtilization: 0.9,
        enableEp: false,
      }),
    );
    const hydratedLegacyStore = createTargetMachineStore(legacyStorage);
    expect(hydratedLegacyStore.getSnapshot().modelMode).toBe("custom");
    expect([...legacyBacking.values()].join(" ")).not.toContain("AUDITMARK");

    // Round-2 P2-2 + Round-3 key-order closure: Object-form linear_kda, dsa, and engram_config before use_engram: false preserve identical deploy math
    for (const extraObj of [
      { linear_kda: { enabled: true, token: "AUDITMARK" } },
      { dsa: { index_topk: 2048, token: "AUDITMARK" }, kv_lora_rank: 512 },
      { engram_config: { enabled: true, token: "AUDITMARK" }, use_engram: false, cpu_offload: false },
    ]) {
      const objCfg = {
        model_type: "qwen3",
        hidden_size: 4096,
        intermediate_size: 12288,
        num_hidden_layers: 8,
        num_attention_heads: 32,
        num_key_value_heads: 8,
        vocab_size: 151936,
        ...extraObj,
      };
      const beforePlan = evaluateDeployPlan({ model: objCfg, cardId: "a2-64g", tpSize: 1 });
      const objStore = createTargetMachineStore(null);
      const applied = objStore.applyCustomConfig(JSON.stringify(objCfg));
      expect(applied.ok).toBe(true);
      const snap = objStore.getSnapshot();
      expect(snap.validatedCustomJsonText).not.toContain("AUDITMARK");
      const afterObj = JSON.parse(snap.validatedCustomJsonText) as Record<string, unknown>;
      const afterPlan = evaluateDeployPlan({ model: afterObj, cardId: "a2-64g", tpSize: 1 });
      expect(afterPlan.stages.map((s) => s.pointEstimateBytes)).toEqual(
        beforePlan.stages.map((s) => s.pointEstimateBytes),
      );
    }
  });
});
