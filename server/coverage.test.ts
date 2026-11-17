import { expect, it } from "vitest";
import { coverageSignals } from "./coverage";

it("records structured uncertainty independently of wording and recognizes ordinary Chinese abstention", () => {
  expect(
    coverageSignals('无法确定。\n<!-- wiki-coverage: {"satisfied":null,"reason":"版本材料不足"} -->', []).map(
      (s) => s.kind,
    ),
  ).toEqual(["agent-uncovered"]);
  expect(coverageSignals("现有材料不足，无法确定。", [])).toHaveLength(1);
  expect(coverageSignals("无法从已有资料判断这个版本是否支持。", [])).toHaveLength(1);
  expect(
    coverageSignals('资料充分。\n<!-- wiki-coverage: {"satisfied":true,"reason":"已读取所需页面"} -->', []),
  ).toEqual([]);
});

it("does not infer coverage from low scores, a normal answer or code examples", () => {
  expect(coverageSignals("默认值为 1，见 [A](sources/a.md)。", [])).toEqual([]);
  expect(coverageSignals("示例 `知识库里还没有`", [])).toEqual([]);
});
it("records model-declared absence and web attempts with distinct, conservative reasons", () => {
  const signals = coverageSignals("知识库里还没有这一条。", [
    { name: "Read", target: "sources/a.md" },
    { name: "WebFetch", target: "https://docs.vllm.ai/" },
    { name: "WebFetch", target: "https://docs.vllm.ai/" },
    { name: "WebSearch", target: "chunk_config documentation" },
  ]);
  expect(signals.map((signal) => signal.kind)).toEqual(["agent-uncovered", "web-attempt", "web-attempt"]);
  expect(signals[1]!.reason).toContain("未核实访问成功");
});
