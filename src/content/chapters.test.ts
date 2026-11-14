import { describe, expect, it } from "vitest";
import plan from "../../PLAN.md?raw";
import { CHAPTERS, findChapter } from "./chapters";
import { CHAPTER_IDS, CHAPTER_TITLES } from "./wiki/chapters";

describe("22 章课程契约", () => {
  it("保留原 00–21 编号并与知识库元数据共用标题", () => {
    expect(CHAPTER_IDS).toEqual(Array.from({ length: 22 }, (_, index) => String(index).padStart(2, "0")));
    expect(CHAPTERS.every((chapter) => CHAPTER_TITLES[chapter.id] === chapter.title)).toBe(true);
    for (const chapter of CHAPTERS) expect(plan).toContain(`\`${chapter.id}\``);
  });
  it("不把非法章节地址默认为某一章", () => {
    for (const id of [undefined, "", "3", "22", "../wiki"]) expect(findChapter(id)).toBeUndefined();
  });
});
