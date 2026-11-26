import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCurrentPlanCliHint, evaluateDeployPlan } from "../../sim/modelspec/deployCalculator";
import { parseCalculatorQueryParams } from "../tools/workbenchHandoff";
import {
  buildCalculatorReturnToFromDeploy,
  buildHardwareDeployHref,
  buildHardwareDeployHrefFromCommand,
  canRestoreDeployModelOnReturn,
  computeEpExpertRange,
  computeHardwareNodeSlotLayout,
  computePpLayerRange,
  computeRankShardSummary,
  DEPLOY_MODEL_DISPLAY_NAMES,
  encodeHardwareDeployOverlay,
  type HardwareDeployOverlayPayload,
  MAX_DEPLOY_OVERLAY_PARAM_CHARS,
  matchDeployPresetModelKey,
  parseHardwareDeployOverlay,
} from "./hardwareDeployOverlay";
import { resolveExperienceBackTarget, resolveExperienceWikiContextLink } from "./qwen-frame";

describe("WS2: 新增预设模型键、单卡权重/KV切分透视与单命令直跳 3D", () => {
  it("支持 qwen3-32b 与 qwen3-235b-a22b 紧凑编解码（<=1024 字符）及算账台无损往返", () => {
    expect(DEPLOY_MODEL_DISPLAY_NAMES["qwen3-32b"]).toBe("Qwen3-32B");
    expect(DEPLOY_MODEL_DISPLAY_NAMES["qwen3-235b-a22b"]).toBe("Qwen3-235B-A22B");

    for (const modelKey of ["qwen3-32b", "qwen3-235b-a22b"] as const) {
      const payload: HardwareDeployOverlayPayload = {
        modelKey,
        cardId: "a3-die64g",
        tp: 8,
        pp: 2,
        dp: 1,
        ep: modelKey === "qwen3-235b-a22b",
        totalRanks: 16,
        cardGiB: 64,
        u: 0.9,
        weightGiB: 16.4,
        kvGiB: 35.2,
        runtimeGiB: 4.8,
        oomStatus: "fits",
        calc: {
          weightPrecision: "w8a8_dynamic",
          maxModelLen: 32768,
        },
      };
      const encoded = encodeHardwareDeployOverlay(payload);
      expect(encoded.length).toBeLessThanOrEqual(MAX_DEPLOY_OVERLAY_PARAM_CHARS);
      const parsed = parseHardwareDeployOverlay(encoded);
      expect(parsed?.modelKey).toBe(modelKey);
      expect(canRestoreDeployModelOnReturn(parsed!)).toBe(true);

      const href = buildHardwareDeployHref(payload, new URLSearchParams("fromPage=moe"));
      const hwParams = new URLSearchParams(href.slice("#/hardware?".length));
      expect(hwParams.get("customModel")).toBeNull();
      const returnTo = buildCalculatorReturnToFromDeploy(parsed!, hwParams);
      expect(returnTo).toContain(`preset=${modelKey}`);
      expect(returnTo).toContain("fromPage=moe");
    }

    const viewerJs = readFileSync("public/experiences/whole/viewer.js", "utf8");
    expect(viewerJs).toContain("'qwen3-32b':'Qwen3-32B'");
    expect(viewerJs).toContain("'qwen3-235b-a22b':'Qwen3-235B-A22B'");
    expect(viewerJs).toContain("单卡权重与缓存切分卡");
  });

  it("computePpLayerRange 与 computeRankShardSummary 严格遵循余数层规则、KV 复制、MLA 潜向量、MoE EP 与双芯槽位", () => {
    // 1. PP 余层规则：61 层 PP=2 -> [31, 30]；94 层 PP=4 -> [23, 24, 24, 23]
    expect(computePpLayerRange(61, 2, 0)).toMatchObject({ startLayer: 0, endLayer: 30, layerCount: 31 });
    expect(computePpLayerRange(61, 2, 1)).toMatchObject({ startLayer: 31, endLayer: 60, layerCount: 30 });
    expect([0, 1, 2, 3].map((s) => computePpLayerRange(94, 4, s).layerCount)).toEqual([23, 24, 24, 23]);

    // 2. Qwen3-235B-A22B (numKvHeads=4) 在 A3 双 Die (TP=8, PP=2, EP=true) -> KV 头复制 + 双 Die 映射 + EP 专家容量
    const qwen235Payload: HardwareDeployOverlayPayload = {
      modelKey: "qwen3-235b-a22b",
      cardId: "a3-die64g",
      tp: 8,
      pp: 2,
      dp: 1,
      ep: true,
      totalRanks: 16,
      cardGiB: 64,
      u: 0.9,
      weightGiB: 15.2,
      kvGiB: 36.1,
      runtimeGiB: 5.1,
      oomStatus: "fits",
    };
    const r3 = computeRankShardSummary(qwen235Payload, 3);
    expect(r3.physicalSlotIndex).toBe(1);
    expect(r3.dieIndexInSlot).toBe(1);
    expect(r3.hardwareSlotLabel).toContain("双芯模组 npu1 · Die 1");
    expect(r3.groupBadge).toBe("DP 副本 #0 · PP 段 #0 · TP 秩 #3");
    expect(r3.ppSummary).toContain("第 0–46 层（共 47/94 层 + 输入词表 embed_tokens）");
    expect(r3.tpSummary).toContain("QKV / GateUp 按列切 1/8");
    expect(r3.tpSummary).toContain("O / Down 按行切 1/8");
    expect(r3.kvHeadReplicated).toBe(true);
    expect(r3.kvReplicationNotice).toContain("KV 头复制 (TP > numKvHeads)");
    expect(r3.kvReplicationNotice).toContain("KV1");
    expect(r3.moeSummary).toContain("EP 开启（EP 域=8）");
    expect(r3.moeSummary).toContain("E48–E63（容量 16 个/卡");
    expect(r3.collectiveSummary).toContain("TP 组内 All-Reduce");
    expect(r3.collectiveSummary).toContain("EP 组内 All-to-All 或 MC2");
    expect(r3.collectiveSummary).toContain("PP 段间 P2P");
    expect(r3.topologyBoundaryNote).toContain("不冒充交换芯片物理走线");

    // 3. DeepSeek-V3 MLA 在跨机 A2 (TP=8, PP=2, DP=2, EP=true -> 32 Ranks) -> MLA 潜向量全卡驻留 + 共享专家 + 跨机提示
    const dsMultiNode: HardwareDeployOverlayPayload = {
      modelKey: "deepseek-v3-mla",
      cardId: "a2-64g",
      tp: 8,
      pp: 2,
      dp: 2,
      ep: true,
      totalRanks: 32,
      cardGiB: 64,
      u: 0.9,
      weightGiB: 22.0,
      kvGiB: 28.0,
      runtimeGiB: 6.0,
      oomStatus: "fits",
    };
    const r24 = computeRankShardSummary(dsMultiNode, 24);
    expect(r24.isMultiNode).toBe(true);
    expect(r24.isLocalNodeRank).toBe(false);
    expect(r24.nodeIndex).toBe(3);
    expect(r24.dpReplica).toBe(1);
    expect(r24.ppStage).toBe(1);
    expect(r24.tpRank).toBe(0);
    expect(r24.ppSummary).toContain("第 31–60 层（共 30/61 层 + final_norm / lm_head");
    expect(r24.mlaLatentNotice).toContain("MLA 潜向量全卡驻留");
    expect(r24.moeSummary).toContain("EP 开启（EP 域=16）");
    expect(r24.moeSummary).toContain("容量 16 个/卡");
    expect(r24.moeSummary).toContain("1 个共享专家各卡常驻");

    // 4. 310P Duo 双芯标卡 + EP 关闭 MoE
    const duoMoeNoEp = computeRankShardSummary(
      {
        modelKey: "qwen3-30b-a3b",
        cardId: "310p-24g",
        tp: 4,
        pp: 1,
        dp: 1,
        ep: false,
        totalRanks: 4,
        cardGiB: 24,
        u: 0.85,
        weightGiB: 8.5,
        kvGiB: 6.2,
        runtimeGiB: 5.1,
        oomStatus: "fits",
      },
      2,
    );
    expect(duoMoeNoEp.hardwareSlotLabel).toContain("PCIe 标卡 card1 · Chip 0");
    expect(duoMoeNoEp.kvHeadReplicated).toBe(false);
    expect(duoMoeNoEp.kvSummary).toContain("持有 1/4 个 KV 头（KV2）");
    expect(duoMoeNoEp.moeSummary).toContain("EP 关闭：全部 128 个路由专家均驻留本卡");
  });

  it("buildHardwareDeployHrefFromCommand 支持单条合格 vllm serve 命令并严格拒绝多命令、未知模型/卡型或越界并行度", () => {
    for (const [cmd, expectedKey] of [
      ["vllm serve Qwen/Qwen3-0.6B -tp 1", "qwen3-0.6b"],
      ["vllm serve Qwen/Qwen3-8B --tensor-parallel-size 2", "qwen3-8b"],
      ["vllm serve /models/Qwen3-30B-A3B -tp 4 --enable-expert-parallel", "qwen3-30b-a3b"],
      ["vllm serve Qwen/Qwen3-32B -tp 4 --gpu-memory-utilization 0.9", "qwen3-32b"],
      [
        "vllm serve Qwen/Qwen3-235B-A22B -tp 8 -pp 2 --enable-expert-parallel --quantization w8a8_dynamic",
        "qwen3-235b-a22b",
      ],
      [
        "vllm serve deepseek-ai/DeepSeek-V3 -tp 8 -pp 2 --enable-expert-parallel --quantization w8a8_dynamic",
        "deepseek-v3-mla",
      ],
    ] as const) {
      const href = buildHardwareDeployHrefFromCommand(cmd, { hardwareFamily: "A3" });
      expect(href, cmd).not.toBeNull();
      const sp = new URLSearchParams(href!.slice("#/hardware?".length));
      const parsed = parseHardwareDeployOverlay(sp.get("deploy"));
      expect(parsed?.modelKey).toBe(expectedKey);
      expect(parsed?.cardId).toBe("a3-die64g");
    }

    // 多命令合写、占位符、未知模型、缺失卡型、非 {1,2,4,8} 并行度、未知量化一律返回 null
    expect(
      buildHardwareDeployHrefFromCommand("vllm serve Qwen/Qwen3-8B -tp 1\nvllm serve Qwen/Qwen3-32B -tp 2", {
        cardId: "a2-64g",
      }),
    ).toBeNull();
    expect(buildHardwareDeployHrefFromCommand("vllm serve <model> -tp 2", { cardId: "a2-64g" })).toBeNull();
    expect(
      buildHardwareDeployHrefFromCommand("vllm serve meta-llama/Llama-4-Scout -tp 4", { cardId: "a2-64g" }),
    ).toBeNull();
    expect(buildHardwareDeployHrefFromCommand("vllm serve Qwen/Qwen3-8B -tp 2")).toBeNull();
    expect(
      buildHardwareDeployHrefFromCommand("vllm serve Qwen/Qwen3-32B -tp 16", { cardId: "a3-die64g" }),
    ).toBeNull();
    expect(
      buildHardwareDeployHrefFromCommand("vllm serve Qwen/Qwen3-8B --quantization bitsandbytes", {
        cardId: "a2-64g",
      }),
    ).toBeNull();
  });

  it("resolveExperienceWikiContextLink 为 /model 与 /hardware 提供不重复的对应原理页链接且不改动 resolveExperienceBackTarget", () => {
    const mDefault = new URLSearchParams("");
    expect(resolveExperienceBackTarget(mDefault, null)).toEqual({ to: "/wiki", label: "返回主章节" });
    expect(
      resolveExperienceWikiContextLink({
        kind: "model",
        params: mDefault,
        backTarget: resolveExperienceBackTarget(mDefault, null),
      }),
    ).toMatchObject({ pageId: "request-overview", to: "/wiki/request-overview" });

    const mMoe = new URLSearchParams("variant=30b-a3b");
    expect(resolveExperienceWikiContextLink({ kind: "model", params: mMoe })?.pageId).toBe("moe");

    const mGlm = new URLSearchParams("model=glm-5-3-flash");
    expect(resolveExperienceWikiContextLink({ kind: "model", params: mGlm })?.pageId).toBe("glm-5-3-flash");

    // 当 fromPage 已指向 request-overview 时，自动切换到互补页避免顶栏重复
    const fromOverview = new URLSearchParams("fromPage=request-overview");
    const backOverview = resolveExperienceBackTarget(fromOverview, null);
    expect(backOverview.to).toBe("/wiki/request-overview");
    expect(
      resolveExperienceWikiContextLink({ kind: "model", params: fromOverview, backTarget: backOverview })
        ?.pageId,
    ).toBe("gqa");

    // 硬件默认 -> hardware-devices；携带 TP>1 deploy -> tensor-parallel
    expect(
      resolveExperienceWikiContextLink({ kind: "hardware", params: new URLSearchParams("") })?.pageId,
    ).toBe("hardware-devices");
    const tpHref = buildHardwareDeployHrefFromCommand("vllm serve Qwen/Qwen3-32B -tp 4", {
      cardId: "a2-64g",
    })!;
    const hwTpParams = new URLSearchParams(tpHref.slice("#/hardware?".length));
    expect(resolveExperienceWikiContextLink({ kind: "hardware", params: hwTpParams })?.pageId).toBe(
      "tensor-parallel",
    );
  });

  it("Red-Team #2–#5: 严格校验全局 DP、阻断拓扑、Shell 拼接/$VAR/非法 dtype/未声明量化/自定义 PP 分段与往返边界", () => {
    // 蒸馏模型与混淆变体严格拒绝
    expect(matchDeployPresetModelKey("DeepSeek-R1-Distill-Qwen-32B")).toBeNull();
    expect(matchDeployPresetModelKey("deepseek-ai/DeepSeek-R1-0528-Qwen3-8B")).toBeNull();
    expect(matchDeployPresetModelKey("Qwen/Qwen2.5-32B")).toBeNull();

    // #3: 全局 --data-parallel-size 4 + --data-parallel-size-local 1 必须保持全局 dp=4, totalRanks=32
    const dpHref = buildHardwareDeployHrefFromCommand(
      "vllm serve Qwen/Qwen3-32B -tp 8 --data-parallel-size 4 --data-parallel-size-local 1",
      { cardId: "a3-die64g" },
    );
    expect(dpHref).not.toBeNull();
    const dpParsed = parseHardwareDeployOverlay(
      new URLSearchParams(dpHref!.slice("#/hardware?".length)).get("deploy"),
    );
    expect(dpParsed).toMatchObject({ tp: 8, pp: 1, dp: 4, totalRanks: 32 });
    expect(
      buildHardwareDeployHrefFromCommand(
        "vllm serve Qwen/Qwen3-32B -tp 8 --data-parallel-size 4 --data-parallel-size-local 3",
        { cardId: "a3-die64g" },
      ),
    ).toBeNull();

    // #4: 耦合规则阻断（DCP>TP、PCP 缺 MRV2、可见卡数不足、310P 缺 float16）一律返回 null
    for (const blockedCmd of [
      "vllm serve Qwen/Qwen3-8B -tp 1 --decode-context-parallel-size 8",
      "vllm serve Qwen/Qwen3-8B -tp 2 --prefill-context-parallel-size 2",
      "ASCEND_RT_VISIBLE_DEVICES=0,1 vllm serve Qwen/Qwen3-32B -tp 4",
    ]) {
      expect(buildHardwareDeployHrefFromCommand(blockedCmd, { cardId: "a2-64g" }), blockedCmd).toBeNull();
    }
    expect(
      buildHardwareDeployHrefFromCommand("vllm serve Qwen/Qwen3-8B -tp 2", { cardId: "310p-24g" }),
    ).toBeNull();
    expect(
      buildHardwareDeployHrefFromCommand("vllm serve Qwen/Qwen3-8B -tp 2 --dtype float16", {
        cardId: "310p-24g",
      }),
    ).not.toBeNull();

    // #5: Shell 拼接、未展开变量、非法 dtype、隐式/不支持量化后缀、VLLM_PP_LAYER_PARTITION、越界 max-model-len 一律返回 null
    const unexpandedBraceVar = ["$", "{TP_SIZE}"].join("");
    for (const invalidCmd of [
      "vllm serve Qwen/Qwen3-8B -tp 2 || echo fallback",
      "vllm serve Qwen/Qwen3-8B -tp 2 && echo done",
      "vllm serve Qwen/Qwen3-8B -tp 2; echo done",
      "vllm serve Qwen/Qwen3-8B -tp 2 | tee serve.log",
      "echo boot\nvllm serve Qwen/Qwen3-8B -tp 2",
      "vllm serve $MODEL -tp 2",
      `vllm serve Qwen/Qwen3-8B -tp ${unexpandedBraceVar}`,
      "vllm serve Qwen/Qwen3-8B -tp 2 --dtype potato",
      "vllm serve Qwen/Qwen3-8B -tp 2 --dtype float32",
      "vllm serve Qwen/Qwen3-8B-AWQ -tp 2",
      "vllm serve Qwen/Qwen3-8B-GPTQ -tp 2",
      "vllm serve Qwen/Qwen3-8B-W8A8 -tp 2",
      "vllm serve deepseek-ai/DeepSeek-R1-Distill-Qwen-32B -tp 4",
      "VLLM_PP_LAYER_PARTITION=15,21 vllm serve Qwen/Qwen3-8B -tp 2 -pp 2",
      "vllm serve Qwen/Qwen3-8B -tp 2 --max-model-len 32",
    ]) {
      expect(buildHardwareDeployHrefFromCommand(invalidCmd, { cardId: "a2-64g" }), invalidCmd).toBeNull();
    }

    // 显式声明受支持的 ModelSlim --quantization ascend 与运行参数正常透传并完成 round-trip
    const validQuantHref = buildHardwareDeployHrefFromCommand(
      "VLLM_USE_V2_MODEL_RUNNER=1 vllm serve Qwen/Qwen3-8B-W8A8 -tp 2 --quantization ascend --max-num-batched-tokens 4096 --max-num-seqs 128 --enforce-eager",
      { cardId: "a2-64g" },
    );
    expect(validQuantHref).not.toBeNull();
    const validQuantParsed = parseHardwareDeployOverlay(
      new URLSearchParams(validQuantHref!.slice("#/hardware?".length)).get("deploy"),
    );
    expect(validQuantParsed?.calc).toMatchObject({
      weightPrecision: "w8a8",
      maxNumBatchedTokens: 4096,
      maxNumSeqs: 128,
      cudagraphMode: "NONE",
      useV2ModelRunner: true,
    });
  });

  it("Red-Team #6: hardwareDeployOverlay 与 whole/viewer.js 同步满足 EP 商余切分、纯稠密 PP 段、零维 RoPE MLA 与 PCP 通信语义", () => {
    // 提取 whole/viewer.js 中的纯计算函数以在单测中与 TypeScript 单真源做逐项等价校验
    const viewerSrc = readFileSync("public/experiences/whole/viewer.js", "utf8");
    const startIdx = viewerSrc.indexOf("const DEPLOY_MODEL_SPECS={");
    const endIdx = viewerSrc.indexOf("const DEPLOY_OOM_LABELS={");
    expect(startIdx).toBeGreaterThan(0);
    expect(endIdx).toBeGreaterThan(startIdx);
    const makeViewerCompute = new Function(
      "customModelJson",
      `
      const location = { search: customModelJson ? ('?customModel=' + encodeURIComponent(customModelJson)) : '' };
      const window = { parent: null };
      ${viewerSrc.slice(startIdx, endIdx)}
      return computeDeployRankShard;
    `,
    ) as (
      customModelJson: string | null,
    ) => (plan: Record<string, unknown>, rankIdx: number) => Record<string, unknown>;

    // 1. EP 专家区间严格遵循 expert_map_manager.py 商数+余数（E=10, EP=4 -> 3, 3, 2, 2；Rank 2 为 E6–E7 而非 E6–E8）
    expect(
      [0, 1, 2, 3].map((r) => {
        const rng = computeEpExpertRange(10, 4, r);
        return [rng.count, rng.startExpert, rng.endExpert];
      }),
    ).toEqual([
      [3, 0, 2],
      [3, 3, 5],
      [2, 6, 7],
      [2, 8, 9],
    ]);

    const customMoe10Json = JSON.stringify({
      model_type: "qwen3_moe",
      vocab_size: 151936,
      hidden_size: 2048,
      intermediate_size: 6144,
      moe_intermediate_size: 1536,
      num_hidden_layers: 16,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      n_routed_experts: 10,
      num_experts_per_tok: 2,
      first_k_dense_replace: 8,
    });
    const hybridPayload: HardwareDeployOverlayPayload = {
      modelKey: "custom-moe",
      cardId: "a2-64g",
      tp: 2,
      pp: 2,
      dp: 2,
      ep: true,
      totalRanks: 8,
      cardGiB: 64,
      u: 0.9,
      weightGiB: 8,
      kvGiB: 20,
      runtimeGiB: 3,
      oomStatus: "fits",
    };
    const viewerHybrid = makeViewerCompute(customMoe10Json);
    const viewerHybridPlan = {
      modelKey: "custom-moe",
      totalRanks: 8,
      ranksPerNode: 8,
      diesPerSlot: 1,
      partPrefix: "npu",
      cardGiB: 64,
      nodeCount: 1,
      tp: 2,
      pp: 2,
      dp: 2,
      pcp: 1,
      dcp: 1,
      ep: true,
    };

    // 2. 纯稠密 PP 段 0（第 0–7 层 < first_k_dense_replace=8）：Rank 0 不驻留任何路由/共享专家，也不报 EP All-to-All
    const tsStage0 = computeRankShardSummary(hybridPayload, 0, customMoe10Json);
    const jsStage0 = viewerHybrid(viewerHybridPlan, 0);
    expect(tsStage0.routedExpertsOnRank).toBe(0);
    expect(tsStage0.moeSummary).toContain("全为稠密 FFN 层");
    expect(tsStage0.moeSummary).not.toContain("E0");
    expect(tsStage0.collectiveSummary).not.toContain("EP 组内");
    expect(String(jsStage0.moeText)).toContain("全为稠密 FFN 层");
    expect(String(jsStage0.moeText)).not.toContain("E0");
    expect(String(jsStage0.commText)).not.toContain("EP 组内");
    expect(String(jsStage0.ppBudgetNote)).toContain("瓶颈 PP 段");

    // PP 段 1（第 8–15 层全为 MoE，EP=4）：Rank 6 对应 dpReplica=1, ppStage=1, tpRank=0 -> epRank=2 -> E6–E7（2 个专家）
    const tsStage1Rank6 = computeRankShardSummary(hybridPayload, 6, customMoe10Json);
    const jsStage1Rank6 = viewerHybrid(viewerHybridPlan, 6);
    expect(tsStage1Rank6.epRank).toBe(2);
    expect(tsStage1Rank6.routedExpertsOnRank).toBe(2);
    expect(tsStage1Rank6.moeSummary).toContain("E6–E7");
    expect(tsStage1Rank6.moeSummary).not.toContain("E6–E8");
    expect(tsStage1Rank6.collectiveSummary).toContain("EP 组内 All-to-All 或 MC2");
    expect(String(jsStage1Rank6.moeText)).toContain("E6–E7");
    expect(String(jsStage1Rank6.moeText)).not.toContain("E6–E8");

    // 3. 零维 RoPE MLA (qk_rope_head_dim=0) 与 PCP-only (TP=1, PP=1, DP=1, PCP=2) 集合通信语义
    const zeroRopeMlaJson = JSON.stringify({
      model_type: "deepseek_v3",
      vocab_size: 129280,
      hidden_size: 4096,
      intermediate_size: 11008,
      num_hidden_layers: 12,
      num_attention_heads: 32,
      num_key_value_heads: 32,
      kv_lora_rank: 512,
      qk_nope_head_dim: 128,
      qk_rope_head_dim: 0,
      v_head_dim: 128,
    });
    const pcpOnlyPayload: HardwareDeployOverlayPayload = {
      modelKey: "custom-mla",
      cardId: "a2-64g",
      tp: 1,
      pp: 1,
      dp: 1,
      ep: false,
      totalRanks: 2,
      cardGiB: 64,
      u: 0.9,
      weightGiB: 10,
      kvGiB: 20,
      runtimeGiB: 3,
      oomStatus: "fits",
      calc: { pcp: 2 },
    };
    const tsZeroRope = computeRankShardSummary(pcpOnlyPayload, 1, zeroRopeMlaJson);
    const jsZeroRope = makeViewerCompute(zeroRopeMlaJson)(
      {
        modelKey: "custom-mla",
        totalRanks: 2,
        ranksPerNode: 8,
        diesPerSlot: 1,
        partPrefix: "npu",
        cardGiB: 64,
        nodeCount: 1,
        tp: 1,
        pp: 1,
        dp: 1,
        pcp: 2,
        dcp: 1,
        ep: false,
      },
      1,
    );
    expect(tsZeroRope.kvSummary).toContain("c_KV(512)");
    expect(tsZeroRope.kvSummary).not.toContain("k_R(");
    expect(String(jsZeroRope.kvText)).toContain("c_KV(512)");
    expect(String(jsZeroRope.kvText)).not.toContain("k_R(");

    expect(tsZeroRope.collectiveSummary).toContain("PCP 上下文并行");
    expect(tsZeroRope.collectiveSummary).not.toContain("无跨卡集合通信");
    expect(String(jsZeroRope.commText)).toContain("PCP 上下文并行");
    expect(String(jsZeroRope.commText)).not.toContain("零跨卡集合通信");

    // 4. 多机节点切换器已接入 whole/viewer.js，确保任意远端节点 Rank（如 16..31）均可检视
    expect(viewerSrc).toContain("deploy-node-selector");
    expect(viewerSrc).toContain("selectDeployNode");

    // 5. 从配置体检台跳转（fromTools=doctor）时，顶栏主返回指向配置体检台，旁侧保留算账台或原知识页入口
    const doctorHref = buildHardwareDeployHrefFromCommand("vllm serve Qwen/Qwen3-8B -tp 2", {
      hardwareFamily: "A2",
      version: "v0.30.0",
    });
    expect(doctorHref).not.toBeNull();
    const doctorParams = new URLSearchParams(`${doctorHref!.slice("#/hardware?".length)}&fromTools=doctor`);
    const doctorBack = resolveExperienceBackTarget(doctorParams, null);
    expect(doctorBack.to).toBe("/tools?tab=doctor");
    expect(doctorBack.label).toBe("返回配置体检台");
    expect(doctorBack.secondary?.to).toContain("/tools?tab=calculator");

    // 6. 拒绝 --kv-cache-memory-bytes 覆盖与 DeepSeek-V3.2 误映射；保留 --data-parallel-size-local 多机布局
    expect(
      buildHardwareDeployHrefFromCommand(
        "vllm serve Qwen/Qwen3-30B-A3B -tp 4 --enable-expert-parallel --kv-cache-memory-bytes 1048576",
        { hardwareFamily: "A2", version: "v0.30.0" },
      ),
    ).toBeNull();
    expect(
      buildHardwareDeployHrefFromCommand(
        "vllm serve deepseek-ai/DeepSeek-V3.2 -tp 8 -pp 4 --enable-expert-parallel",
        {
          hardwareFamily: "A3",
          version: "v0.30.0",
        },
      ),
    ).toBeNull();

    const dpLocalHref = buildHardwareDeployHrefFromCommand(
      "vllm serve Qwen/Qwen3-30B-A3B -tp 4 --enable-expert-parallel --data-parallel-size 2 --data-parallel-size-local 1",
      { hardwareFamily: "A2", version: "v0.30.0" },
    );
    expect(dpLocalHref).not.toBeNull();
    const dpLocalDecoded = parseHardwareDeployOverlay(
      new URLSearchParams(dpLocalHref!.slice("#/hardware?".length)).get("deploy"),
    );
    expect(dpLocalDecoded?.calc?.dpLocal).toBe(1);
    const dpLocalLayout = computeHardwareNodeSlotLayout(dpLocalDecoded!);
    expect(dpLocalLayout.totalRanks).toBe(8);
    expect(dpLocalLayout.ranksPerNode).toBe(4);
    expect(dpLocalLayout.nodeCount).toBe(2);
    expect(dpLocalLayout.localActiveRanks).toBe(4);

    // 7. 带引号的 --kv-cache-memory-bytes / --num-gpu-blocks-override 同样拒绝；3D -> 算账台 -> 3D 保持 dpLocal 多机节点数
    expect(
      buildHardwareDeployHrefFromCommand("vllm serve Qwen/Qwen3-8B -tp 2 '--kv-cache-memory-bytes' 1048576", {
        hardwareFamily: "A2",
        version: "v0.30.0",
      }),
    ).toBeNull();
    expect(
      buildHardwareDeployHrefFromCommand('vllm serve Qwen/Qwen3-8B -tp 2 "--num-gpu-blocks-override=512"', {
        hardwareFamily: "A2",
        version: "v0.30.0",
      }),
    ).toBeNull();

    const calcReturnUrl = buildCalculatorReturnToFromDeploy(dpLocalDecoded!);
    const calcReturnParams = new URLSearchParams(calcReturnUrl.slice("/tools?".length));
    expect(calcReturnParams.get("dpLocal")).toBe("1");

    // 8. 算账台可复制/交接启动命令同样保留 --data-parallel-size-local，确保 3D -> 算账台 -> 体检台 -> 3D 节点数一致；
    //    切换模板清空 dpLocal 时不再从旧 URL 回填，且扩 TP 超过单机上限时自动清除失效 dpLocal
    const parsedCalcReturn = parseCalculatorQueryParams(calcReturnParams);
    expect(parsedCalcReturn.dpLocalSize).toBe(1);
    const calcPlan = evaluateDeployPlan({
      model: "qwen3-30b-a3b",
      cardId: "a2-64g",
      tpSize: parsedCalcReturn.tpSize ?? 4,
      dpSize: parsedCalcReturn.dpSize ?? 2,
      ...(parsedCalcReturn.dpLocalSize !== undefined ? { dpLocalSize: parsedCalcReturn.dpLocalSize } : {}),
      enableEp: Boolean(parsedCalcReturn.enableEp),
    });
    expect(calcPlan.inputSummary.dpLocalSize).toBe(1);
    const rebuilt3dHref = buildHardwareDeployHref(
      {
        ...dpLocalDecoded!,
        calc: { ...dpLocalDecoded!.calc, dpLocal: calcPlan.inputSummary.dpLocalSize },
      },
      calcReturnParams,
    );
    const rebuiltDecoded = parseHardwareDeployOverlay(
      new URLSearchParams(rebuilt3dHref.slice("#/hardware?".length)).get("deploy"),
    );
    expect(rebuiltDecoded?.calc?.dpLocal).toBe(1);
    expect(computeHardwareNodeSlotLayout(rebuiltDecoded!).nodeCount).toBe(2);

    const calcCli = buildCurrentPlanCliHint(calcPlan);
    expect(calcCli).toContain("--data-parallel-size-local 1");
    const doctor3dHref = buildHardwareDeployHrefFromCommand(calcCli, {
      hardwareFamily: "A2",
      version: "v0.30.0",
    });
    expect(doctor3dHref).not.toBeNull();
    const doctor3dDecoded = parseHardwareDeployOverlay(
      new URLSearchParams(doctor3dHref!.slice("#/hardware?".length)).get("deploy"),
    );
    expect(computeHardwareNodeSlotLayout(doctor3dDecoded!).nodeCount).toBe(2);

    // Template reset clears dpLocal -> neither 3D href nor CLI resurrects stale dpLocal=1 from calcReturnParams
    const reset3dHref = buildHardwareDeployHref(
      {
        ...dpLocalDecoded!,
        calc: { ...dpLocalDecoded!.calc, dpLocal: undefined },
      },
      calcReturnParams,
    );
    const resetDecoded = parseHardwareDeployOverlay(
      new URLSearchParams(reset3dHref.slice("#/hardware?".length)).get("deploy"),
    );
    expect(resetDecoded?.calc?.dpLocal).toBeUndefined();
    expect(computeHardwareNodeSlotLayout(resetDecoded!).nodeCount).toBe(1);

    // Raising TP from 2 to 8 on A2 (8 ranks/node) invalidates dpLocal=2 (16 ranks/node) cleanly
    const overNodePlan = evaluateDeployPlan({
      model: "qwen3-30b-a3b",
      cardId: "a2-64g",
      tpSize: 8,
      dpSize: 4,
      dpLocalSize: 2,
      enableEp: true,
    });
    expect(overNodePlan.inputSummary.dpLocalSize).toBeUndefined();
    expect(buildCurrentPlanCliHint(overNodePlan)).not.toContain("--data-parallel-size-local");
  });
});
