import { expect, it } from "vitest";
import { parseDocLinks } from "./corpus";

it("ignores malformed percent escapes in community doc links while retaining valid links", () => {
  const good = "https://docs.vllm.ai/projects/ascend/en/v0.23.0/usage/guide.html";
  expect(parseDocLinks(`https://docs.vllm.ai/projects/ascend/en/%ZZ/guide.html ${good}`)).toEqual([
    { url: good, version: "v0.23.0", path: "usage/guide.html" },
  ]);
});
