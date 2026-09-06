import { describe, expect, it } from "vitest";
import { buildHardwareTimeline } from "../buildTimeline";
import { buildLayerTimeline } from "../model/forwardLayer";
import { getPresetSpec } from "../modelspec/presets";
import type { Step } from "../timeline/types";
import { validateTimeline } from "../timeline/validate";
import { mapResidency, mapTimelineResidency } from "./mapResidency";
import { NPU_910B, validateNpuSpec } from "./spec";

const model = getPresetSpec("qwen3-0.6b");
const preset = { id: "hardware-test", text: "占位", tokens: ["1", "2"], ids: [1, 2] };
const raw = buildLayerTimeline(model, preset);
const mapped = mapTimelineResidency(raw);
const step = (id: string): Step => mapped.steps.find((s) => s.id === id)!;

describe("910B 概念剖面与双层时间线", () => {
  it("spec 锚点可解析，未知物理数量不被填写", () => {
    expect(validateNpuSpec(NPU_910B)).toEqual([]);
    expect(NPU_910B.physical.hbmStacks).toBeNull();
    expect(NPU_910B.physical.hccsLanes).toBeNull();
    expect(NPU_910B.anchors["hbm[3]"]).toBeDefined();
    expect(NPU_910B.anchors["hccs[6]"]).toBeDefined();
    for (const id of ["l1", "l0a", "l0b", "l0c", "ub", "cube", "vector", "pcie"])
      expect(NPU_910B.anchors[id]).toBeDefined();
    const bad = structuredClone(NPU_910B);
    bad.anchors.cube!.part = "missing";
    expect(validateNpuSpec(bad).join()).toContain("锚点");
  });

  it("21 步驻留齐全、字节一致、保持模型数值和输入不变", () => {
    expect(mapped.steps).toHaveLength(21);
    expect(validateTimeline(mapped)).toEqual([]);
    expect(mapped.tensors).toBe(raw.tensors);
    for (const [i, s] of mapped.steps.entries()) {
      expect(s.model).toBe(raw.steps[i]!.model);
      expect(s.hardware.specId).toBe(NPU_910B.id);
      expect(s.hardware.explanation).toBeTruthy();
      expect(s.evidence.some((id) => id.startsWith("HW-A"))).toBe(true);
      for (const id of s.model.tensors) expect(s.hardware.residency[id]).toBeDefined();
      for (const tr of s.hardware.transfers) expect(tr.bytes).toBe(mapped.tensors[tr.tensor]!.bytes);
      expect(raw.steps[i]!.hardware).toEqual({ residency: {}, transfers: [], active: [] });
    }
    expect(mapTimelineResidency(mapped)).toEqual(mapped);
  });

  it("投影沿 L1/L0A、L0B 读取，L0C 写回；权重主要驻留 HBM", () => {
    const s = step("L0.attn.q");
    const kinds = (id: string) => s.hardware.transfers.filter((t) => t.tensor === id).map((t) => t.to.k);
    expect(kinds("L0.ln1.out")).toEqual(["l2", "l1", "l0a"]);
    expect(kinds("L0.attn.q_proj")).toEqual(["l2", "l1", "l0b"]);
    expect(s.hardware.transfers.find((t) => t.tensor === "L0.attn.q")?.from.k).toBe("l0c");
    expect(s.hardware.residency["L0.attn.q_proj"]).toEqual({ k: "hbm", slot: 0, region: "weight" });
    expect(s.hardware.active).toContain("cube");
    expect(s.hardware.active).not.toContain("hccs");
  });

  it("向量步走 UB；Q/K 双路都被处理，score 缩放也包含 Vector", () => {
    for (const id of ["L0.ln1", "L0.attn.qknorm", "L0.attn.rope", "L0.attn.softmax", "L0.mlp.act"]) {
      const s = step(id);
      expect(s.hardware.active).toContain("vector");
      expect(s.hardware.active).not.toContain("cube");
      for (const line of s.model.lineage) {
        for (const input of line.from)
          expect(s.hardware.transfers.some((t) => t.tensor === input && t.to.k === "ub")).toBe(true);
        expect(s.hardware.transfers.some((t) => t.tensor === line.out && t.from.k === "ub")).toBe(true);
      }
    }
    expect(step("L0.attn.scores").hardware.active).toEqual(expect.arrayContaining(["cube", "vector"]));
  });

  it("Embedding 只搬所选行，id 使用 int32 字节，视图拼接不搬运", () => {
    const s = step("embed.gather");
    expect(mapped.tensors.ids!.bytes).toBe(preset.ids.length * 4);
    expect(s.hardware.transfers.some((t) => t.tensor === "model.embed_tokens")).toBe(false);
    const rows = s.hardware.transfers.find((t) => t.tensor === "L0.x_in");
    expect(rows?.from).toEqual({ k: "hbm", slot: 0, region: "weight" });
    expect(rows?.bytes).toBe(preset.ids.length * model.hidden * model.bytesPerParam);
    expect(s.hardware.transfers.filter((t) => t.tensor === "ids").map((t) => t.to.k)).toEqual([
      "pcie",
      "hbm",
      "l2",
      "ub",
    ]);
    const merge = step("L0.attn.merge");
    expect(merge.hardware.transfers).toEqual([]);
    expect(merge.hardware.active).toEqual(["host"]);
    expect(merge.hardware.residency["L0.attn.ctx"]).toEqual(merge.hardware.residency["L0.attn.ctx_merged"]);
  });

  it("KV 的 K、V 都读入，合并块写往 HBM KV 区，未激活跨卡链路", () => {
    const s = step("L0.kv.write");
    for (const id of ["L0.attn.k_rope", "L0.attn.v_heads"])
      expect(s.hardware.transfers.some((t) => t.tensor === id && t.to.k === "ub")).toBe(true);
    expect(s.hardware.transfers.at(-1)?.to).toEqual({ k: "hbm", slot: 2, region: "kv" });
    expect(s.hardware.active).not.toContain("hccs");
    expect(s.hardware.active).not.toContain("cube");
  });

  it("组合入口与映射一致；支持无 qkNorm 及非零层号", () => {
    const built = buildHardwareTimeline(model, preset);
    expect(built.steps).toEqual(mapped.steps);
    expect(built.hardwareSpec).toEqual(NPU_910B);
    const other = structuredClone(model);
    other.layers[1]!.attention.qkNorm = false;
    const variant = buildHardwareTimeline(other, preset, { layerIndex: 1 });
    expect(variant.steps).toHaveLength(20);
    expect(validateTimeline(variant)).toEqual([]);
  });

  it("整条时间线可 structuredClone，适合后续 Worker 消息传递", () => {
    const cloned = structuredClone(mapped);
    expect(validateTimeline(cloned)).toEqual([]);
    expect(cloned.tensors["L0.attn.ctx"]!.data).toBe(cloned.tensors["L0.attn.ctx_merged"]!.data);
    const withoutSpec = { ...cloned };
    delete withoutSpec.hardwareSpec;
    expect(validateTimeline(withoutSpec).some((i) => i.message.includes("hardwareSpec"))).toBe(true);
  });

  it("缺失 Q/K 双路中的 K 搬运会被拦截", () => {
    const badStep = structuredClone(step("L0.attn.qknorm"));
    badStep.hardware.transfers = badStep.hardware.transfers.filter((t) => !t.tensor.includes(".k_"));
    expect(
      validateTimeline({ ...mapped, steps: [badStep] }).some((i) => i.message.includes("搬运不完整")),
    ).toBe(true);
  });

  it("自定义槽位由 spec 驱动；坏 spec、未知算子和缺失 lineage 张量明确报错", () => {
    const spec = structuredClone(NPU_910B);
    spec.regions.act = 3;
    const custom = mapTimelineResidency(raw, spec);
    expect(custom.steps[1]!.hardware.residency["L0.ln1.out"]).toEqual({ k: "hbm", slot: 3, region: "act" });
    spec.regions.kv = 99;
    expect(() => mapTimelineResidency(raw, spec)).toThrow(/槽位/);
    const broken = structuredClone(raw.steps[1]!);
    broken.model.lineage[0]!.from.push("missing");
    expect(() => mapResidency(broken, NPU_910B, raw.tensors)).toThrow(/missing/);
    const noOp = structuredClone(raw.steps[1]!);
    delete noOp.model.op;
    expect(() => mapResidency(noOp, NPU_910B, raw.tensors)).toThrow(/算子/);
    const unknown = structuredClone(raw.steps[1]!);
    unknown.model.op!.kind = "unsupported" as never;
    expect(() => mapResidency(unknown, NPU_910B, raw.tensors)).toThrow(/算子/);
  });
});

describe("双层校验拒绝损坏的数据", () => {
  it.each([
    [
      "空硬件",
      (s: Step) => {
        s.hardware = { residency: {}, transfers: [], active: [] };
      },
    ],
    [
      "漏搬运",
      (s: Step) => {
        s.hardware.transfers = [];
      },
    ],
    [
      "字节不一致",
      (s: Step) => {
        s.hardware.transfers[0]!.bytes++;
      },
    ],
    [
      "无效字节",
      (s: Step) => {
        s.hardware.transfers[0]!.bytes = Number.NaN;
      },
    ],
    [
      "缺驻留",
      (s: Step) => {
        delete s.hardware.residency[s.model.tensors[0]!];
      },
    ],
    [
      "非法槽位",
      (s: Step) => {
        s.hardware.transfers[0]!.from = { k: "hbm", slot: 99, region: "act" };
      },
    ],
    [
      "非法路径",
      (s: Step) => {
        s.hardware.transfers[0]!.to = { k: "l0a" };
      },
    ],
    [
      "缺活跃单元",
      (s: Step) => {
        s.hardware.active = [];
      },
    ],
    [
      "未知证据",
      (s: Step) => {
        s.evidence.push("HW-S99");
      },
    ],
    [
      "缺少教学假设证据",
      (s: Step) => {
        s.evidence = s.evidence.filter((id) => id !== "HW-A05");
      },
    ],
  ] as const)("%s", (_label, corrupt) => {
    const bad = { ...mapped, steps: mapped.steps.map((s) => structuredClone(s)) };
    corrupt(bad.steps[2]!);
    expect(validateTimeline(bad).length).toBeGreaterThan(0);
  });
});
