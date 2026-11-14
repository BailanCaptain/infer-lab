import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../src/content/chapters";
import { COURSE_LESSONS } from "../src/content/course";

describe("课程正文交付契约", () => {
  it("22 章都有可读正文、具体例子、自测和可追溯材料", () => {
    expect(Object.keys(COURSE_LESSONS).sort()).toEqual(CHAPTERS.map((chapter) => chapter.id));
    for (const chapter of CHAPTERS) {
      const lesson = COURSE_LESSONS[chapter.id]!;
      expect(lesson.sections.length, chapter.id).toBeGreaterThanOrEqual(3);
      expect(new Set(lesson.sections.map((section) => section.id)).size).toBe(lesson.sections.length);
      expect(lesson.sections.some((section) => section.example?.code)).toBe(true);
      const text = [lesson.lead, ...lesson.sections.flatMap((section) => section.paragraphs)].join("");
      expect(text).not.toMatch(/LLM-Wiki|尚待编排|待补充|\/wiki/);
      expect(lesson.check.question.length).toBeGreaterThan(10);
      expect(lesson.check.answer.length).toBeGreaterThan(30);
      expect(lesson.sources.length).toBeGreaterThan(0);
      for (const section of lesson.sections) {
        if (section.table) {
          for (const row of section.table.rows) expect(row.length).toBe(section.table.columns.length);
        }
        if (section.figure?.kind === "model") {
          expect(section.figure.segment).toBeGreaterThanOrEqual(1);
          expect(section.figure.segment).toBeLessThanOrEqual(40);
        }
      }
      for (const source of lesson.sources) {
        if (source.startsWith("https://")) expect(new URL(source).hostname).toBeTruthy();
        else expect(existsSync(source.split("#")[0]!), source).toBe(true);
      }
    }
  });
});
