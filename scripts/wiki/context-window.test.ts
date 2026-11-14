import { expect, it } from "vitest";
import { inputByteLimit, textChunks } from "./context-window";
import { wikiFixture } from "./test-fixture";

it("uses the configured window, reserving instructions and output instead of assuming 200K", () => {
  const f = wikiFixture();
  try {
    f.write(
      "wiki/sync.config.json",
      JSON.stringify({ contextWindowTokens: 64000, outputReserveTokens: 8192 }),
    );
    expect(inputByteLimit(f.root, "规则")).toBe(64000 - 8192 - 8192 - 6);
    f.write("wiki/sync.config.local.json", JSON.stringify({ contextWindowTokens: 256000 }));
    expect(inputByteLimit(f.root, "规则")).toBe(256000 - 8192 - 8192 - 6);
  } finally {
    f.cleanup();
  }
});

it("splits huge unbroken Unicode lines without losing bytes or splitting surrogate pairs", () => {
  const text = `${'汉字😀\\"'.repeat(1000)}\nsecond line\n`;
  const parts = textChunks(text, 127);
  expect(parts.map((p) => p.text).join("")).toBe(text);
  for (const part of parts) {
    expect(Buffer.byteLength(part.text, "utf8")).toBeLessThanOrEqual(127);
    expect(part.text).toBe(text.slice(part.start, part.end));
    expect(part.text).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
  }
});
