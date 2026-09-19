import { expect, it } from "vitest";
import { buildParamPage, paramId, protectedParamSection } from "./pages";
import { scanSources } from "./scan";

it("refreshes generated facts while preserving authored explanation and distinguishes nested same-name fields", () => {
  const [row] = scanSources({ "vllm_ascend/config.py": "class ExampleConfig:\n    limit: int = 1\n" });
  const input = { repo: "vllm-ascend", ref: "main", commit: "a".repeat(40), entry: row!, date: "2026-09-15" };
  const first = buildParamPage(input);
  expect(buildParamPage(input, first)).toBe(first);
  const authored = first.replace("骨架，待补：为什么存在。", "限制队列可以防止资源耗尽。[D]");
  const next = buildParamPage({ ...input, entry: { ...row!, default: "2" } }, authored);
  expect(next).toContain("限制队列可以防止资源耗尽。");
  expect(protectedParamSection(next)).toContain("2");
  expect(paramId({ ...row!, json_path: 'additional_config["nested"]["limit"]' })).not.toBe(paramId(row!));
  expect(() => buildParamPage({ ...input, entry: { ...row!, confidence: "suspect" } })).toThrow(/复核/);
});
