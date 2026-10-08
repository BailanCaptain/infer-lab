import { expect, it } from "vitest";
import { stageDropDiagram, validateDropAssets } from "./drop-assets";
import { approveReview, createReview } from "./review";
import { replaceText, wikiContents } from "./review-files";
import { wikiFixture } from "./test-fixture";

it("rejects overflow and SVG drift, guards changed assets, and recovers a complete publication", async () => {
  const f = wikiFixture();
  const stage = wikiFixture();
  try {
    const yaml =
      "layout: figure\nid: cells\ncaption: 两个单元\nsize: [400, 180]\nitems:\n  - at: [30, 40]\n    size: [140, 60]\n    text: 两个单元\n    tone: kv\n";
    const text =
      "---\nid: cells\ntitle: 单元\ntype: source\nsummary: 两个单元\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-10-06'\n---\n```wiki-diagram\nfile: cells\n```\n";
    f.write("wiki/sources/cells.md", text);
    stageDropDiagram(f.root, "cells", yaml);
    const before = wikiContents(f.root);
    for (const [path, text] of before) replaceText(stage.root, path, text);
    expect(() => stageDropDiagram(stage.root, "cells", yaml.replace("[400, 180]", "[950, 180]"))).toThrow(
      "900",
    );
    stageDropDiagram(stage.root, "cells", yaml.replaceAll("两个", "三个"));
    const paths = ["wiki/diagrams/cells.yaml", "wiki/diagrams/cells.svg"];
    expect(validateDropAssets(stage.root, paths)).toEqual([]);
    const review = await createReview(f.root, before, wikiContents(stage.root), {
      promoted: [],
      merged: [],
      rejected: [],
      contradictions: [],
    });
    f.write("wiki/diagrams/cells.yaml", yaml + "# concurrent\n");
    await expect(approveReview(f.root, review.id, { validate: () => [] })).rejects.toThrow(
      "基础内容发生变化",
    );
    f.write("wiki/diagrams/cells.yaml", before.get(paths[0]!)!);
    let fail = true;
    await expect(
      approveReview(f.root, review.id, {
        validate: () => [],
        afterWrite: () => {
          if (fail) {
            fail = false;
            throw new Error("interrupted");
          }
        },
      }),
    ).rejects.toThrow("interrupted");
    expect((await approveReview(f.root, review.id, { validate: () => [] })).state).toBe("published");
    expect(validateDropAssets(f.root, paths)).toEqual([]);
    f.write("wiki/diagrams/cells.svg", "<svg>wrong</svg>");
    expect(validateDropAssets(f.root, paths).join()).toContain("不一致");
  } finally {
    f.cleanup();
    stage.cleanup();
  }
});
