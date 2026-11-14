import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { PartBlock } from "../src/app/course/matrix-parts";
import { ffnSpec } from "../src/app/wiki/scene-flow-graph";
import { SCENE_LESSONS } from "../src/app/wiki/scene-lessons";
import {
  clipPosition,
  expertAssignments,
  parallelPhase,
  parallelSeconds,
  phaseAt,
  phaseProgress,
  scenePosition,
  TP_DOWN_WEIGHT,
} from "../src/app/wiki/scene-playback";
import { MATMUL_OUTPUT, modelTeaching, requestTeaching } from "../src/app/wiki/scene-teaching";
import { modelSpec } from "../src/app/wiki/wiki-data-renderer";
import { compactComputation, tokenFocus } from "../src/app/wiki/wiki-scene-layout";

const root = `${process.cwd()}/public/experiences/glm-flow/`;
const moduleAt = (file: string) => import(pathToFileURL(`${root}master/${file}.js`).href);
const config = JSON.parse(readFileSync(`${root}reference/official-config.json`, "utf8")).text_config;

describe("continuous scene timeline", () => {
  it("fixed chapter clips never advance to a different concept", () => {
    for (let mode = 0; mode < 3; mode++) {
      const duration = parallelSeconds(mode);
      expect(clipPosition(-1, 3, mode, true)).toEqual({ time: 0, step: mode, progress: 0 });
      expect(clipPosition(duration / 2, 3, mode, true)).toEqual({
        time: duration / 2,
        step: mode,
        progress: 0.5,
      });
      for (const time of [duration, duration + 1, duration * 2])
        expect(clipPosition(time, 3, mode, true)).toEqual({ time: duration, step: mode, progress: 1 });
    }
  });
  it("native computation clips can spend 24 seconds on their own calculation", () => {
    expect(clipPosition(12, 4, 1, false, 24)).toEqual({ time: 12, step: 1, progress: 0.5 });
    expect(clipPosition(99, 4, 2, false, 24)).toEqual({ time: 24, step: 2, progress: 1 });
  });
  it("introduces the input before splitting and preserves communication time", () => {
    expect(parallelPhase(0.05).phase).toBe(0);
    expect(parallelPhase(0.25).phase).toBe(1);
    expect(parallelPhase(0.4).phase).toBe(2);
    expect(parallelPhase(0.6).phase).toBe(3);
    expect(parallelPhase(0.8).phase).toBe(4);
    expect(parallelPhase(1)).toEqual({ phase: 5, local: 1 });
  });
  it("SwiGLU has two branches, limiting, gating and an output projection", () => {
    const f = ffnSpec("4096", "2048");
    expect(f.edges.filter((e) => e.from === "input").map((e) => e.to)).toEqual(["gate", "up"]);
    expect(f.edges.filter((e) => e.to === "multiply").map((e) => e.from)).toEqual(["silu", "clamp"]);
    expect(f.nodes.filter((n) => n.kind === "weight").map((n) => n.id)).toEqual(["gate", "up", "down"]);
    const writeback = modelSpec(3);
    for (const [from, to] of [
      ["streams", "comb"],
      ["delta", "post"],
      ["mixed", "add"],
      ["distributed", "add"],
    ])
      expect(writeback.edges.some((e) => e.from === from && e.to === to)).toBe(true);
  });
  it("the small matrix example produces four actual dot products", () => {
    expect(MATMUL_OUTPUT).toEqual([8, 6, 5, 7]);
    expect(modelTeaching(1, 0).tensors[2]!.rows).toEqual([["?", "?", "?", "?"]]);
    expect(modelTeaching(1, 0.24).tensors[2]!.rows).toEqual([["8", "?", "?", "?"]]);
    expect(modelTeaching(1, 1).tensors[2]!.rows).toEqual([["8", "6", "5", "7"]]);
    expect(modelTeaching(2, 0.5).operators).toEqual(["⊙", "="]);
  });
  it("R1 distinguishes scheduling bookkeeping, verified output and unverified candidates", () => {
    expect(requestTeaching(0, 1).tensors[2]!.rows).toEqual([["4", "4"]]);
    expect(requestTeaching(2, 0.3).tensors[0]!.rows).toEqual([["y₀"]]);
    expect(requestTeaching(2, 0.6).tensors[1]!.rows).toEqual([["4", "5"]]);
    expect(requestTeaching(2, 1).tensors[1]!.rows).toEqual([["4", "5", "6", "7"]]);
  });
  it("scrubs across steps, holds the final result, and clamps invalid input", () => {
    expect(scenePosition(12, 4)).toEqual({ time: 12, step: 1, progress: 0 });
    expect(scenePosition(99, 4)).toEqual({ time: 48, step: 3, progress: 1 });
    expect(scenePosition(Number.NaN, 4)).toEqual({ time: 0, step: 0, progress: 0 });
    expect(phaseAt(1)).toBe(3);
    expect(phaseProgress(1)).toBe(1);
  });
  it("eight unique selected experts occupy six valid owner cards, including the source", () => {
    for (let source = 0; source < 16; source++) {
      const experts = expertAssignments(source);
      expect(new Set(experts.map((item) => item.expert)).size).toBe(8);
      expect(new Set(experts.map((item) => item.rank)).size).toBe(6);
      expect(experts.some((item) => item.rank === source)).toBe(true);
      for (const item of experts) {
        expect(Math.floor(item.expert / 18)).toBe(item.rank);
        expect(item.expert).toBeLessThan(288);
      }
    }
  });
});

describe("wiki scenes use the published master's tensors", () => {
  it("the displayed down-weight shards reconstruct the official dense projection", () => {
    expect(TP_DOWN_WEIGHT.input).toBe(config.intermediate_size);
    expect(TP_DOWN_WEIGHT.output).toBe(config.hidden_size);
    const shardElements = (TP_DOWN_WEIGHT.input / TP_DOWN_WEIGHT.shards) * TP_DOWN_WEIGHT.output;
    expect(shardElements * TP_DOWN_WEIGHT.shards).toBe(config.intermediate_size * config.hidden_size);
    expect(shardElements / 1024 ** 2).toBe(6);
    expect((3 * config.moe_intermediate_size * config.hidden_size) / 1024 ** 2).toBe(24);
  });
  it("every referenced tensor exists and local views retain its dimensions", async () => {
    const [truth, model, flow, full] = await Promise.all([
      moduleAt("truth-spec"),
      moduleAt("model-spec"),
      moduleAt("flow-layout"),
      moduleAt("model-layout"),
    ]);
    for (const kind of ["model-compute", "token-flow"] as const) {
      const layout =
        kind === "model-compute"
          ? flow.layoutFlow(truth.layerSpec(config, 6, 0))
          : full.layoutModel(model.modelSpec(config, 6));
      const blocks: PartBlock[] = layout.blocks.map(flow.toWorld);
      SCENE_LESSONS[kind].steps.forEach((step, index) => {
        const selected = blocks.filter((b) => step.blocks.includes(b.id));
        expect(selected.map((b) => b.id).sort()).toEqual([...step.blocks].sort());
        if (kind !== "model-compute") return;
        const compact = compactComputation(selected, index);
        if (!compact) return;
        for (const moved of compact.blocks) {
          const original = selected.find((b) => b.id === moved.id)!;
          expect(moved.x1 - moved.x0).toBeCloseTo(original.x1 - original.x0);
          expect(moved.y1 - moved.y0).toBeCloseTo(original.y1 - original.y0);
          expect(moved.div).toEqual(original.div);
        }
        if (index === 1) {
          for (const result of ["Q", "K", "V"])
            expect(compact.arrows.some((a) => a.from === "x_attn" && a.to === result)).toBe(true);
        }
      });
    }
  });

  it("highlights the sixth token using shader cell coordinates, through every stream", async () => {
    const [truth, flow, lookModule, three] = await Promise.all([
      moduleAt("truth-spec"),
      moduleAt("flow-layout"),
      moduleAt("flow-look"),
      import(pathToFileURL(`${root}../vendor/build/three.module.js`).href),
    ]);
    const layout = flow.layoutFlow(truth.layerSpec(config, 6, 0));
    const blocks: PartBlock[] = layout.blocks.map(flow.toWorld);
    for (const id of ["residual_in", "x_attn", "gate_ffn"]) {
      const block = blocks.find((b) => b.id === id)!;
      const look = lookModule.makeFlowLook();
      const mesh = look.addBlock(new three.Scene(), block);
      look.dimOne(id, 0.7);
      look.focus(id, tokenFocus(block), 0);
      const uniforms = mesh.material.uniforms;
      const inFocus = (cell: number[]) =>
        cell.every(
          (v, axis) =>
            v >= uniforms.uF0.value.getComponent(axis) && v <= uniforms.uF1.value.getComponent(axis),
        );
      const cell = [block.div[0] / 2, block.div[1] / 2, block.div[2] - 0.5];
      cell[block.orient === "row" ? 1 : 0] = 5.5;
      expect(inFocus(cell)).toBe(true);
      cell[block.orient === "row" ? 1 : 0] = 0.5;
      expect(inFocus(cell)).toBe(false);
      expect(uniforms.uDimIn.value).toBe(0);
      expect(uniforms.uDim.value).toBe(0.7);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  });
});
