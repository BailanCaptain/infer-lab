/**
 * Spike D（Node 版）：真实尺寸单层前向 + 惰性权重生成 + 硬件映射/校验计时。
 * 用法：pnpm bench:forward [预设 id ...]，默认 qwen3-0.6b 与 qwen3-8b，各跑 3 次。
 * 验收（计划 §2.10 #3b）：0.6B < 0.5s，8B < 5s；浏览器 Worker 内的数字另测。
 */
import { buildHardwareTimeline } from "../src/sim/buildTimeline";
import { getPresetSpec } from "../src/sim/modelspec/presets";

const ids = [151644, 872, 198, 108386, 3837, 151645];
const preset = { id: "bench", text: "（占位）", tokens: ids.map(String), ids };
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ["qwen3-0.6b", "qwen3-8b"];
const RUNS = 3;

for (const id of targets) {
  const spec = getPresetSpec(id);
  const ms: number[] = [];
  let steps = 0;
  let tensors = 0;
  for (let r = 0; r < RUNS; r++) {
    const tl = buildHardwareTimeline(spec, preset);
    ms.push(tl.buildMs);
    steps = tl.steps.length;
    tensors = Object.keys(tl.tensors).length;
  }
  const best = Math.min(...ms);
  console.log(
    `${spec.name}: S=${ids.length} 单层 ${steps} 步 / ${tensors} 个张量，耗时 ${ms.map((m) => m.toFixed(0)).join(" / ")} ms，最快 ${best.toFixed(0)} ms`,
  );
}
