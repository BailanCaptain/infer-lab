import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCalculatorReturnToFromDeploy,
  buildHardwareDeployHref,
  buildHardwareDeployHrefFromCommand,
  canRestoreDeployModelOnReturn,
  computePpLayerRange,
  computeRankShardSummary,
  DEPLOY_MODEL_DISPLAY_NAMES,
  encodeHardwareDeployOverlay,
  type HardwareDeployOverlayPayload,
  MAX_DEPLOY_OVERLAY_PARAM_CHARS,
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
});
