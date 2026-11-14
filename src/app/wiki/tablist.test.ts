import { describe, expect, it } from "vitest";
import { tabIndexAfterKey } from "./tablist";

describe("tabIndexAfterKey", () => {
  it("左右方向键循环切换", () => {
    expect(tabIndexAfterKey("ArrowRight", 0, 4)).toBe(1);
    expect(tabIndexAfterKey("ArrowRight", 3, 4)).toBe(0);
    expect(tabIndexAfterKey("ArrowLeft", 0, 4)).toBe(3);
    expect(tabIndexAfterKey("ArrowLeft", 2, 4)).toBe(1);
  });

  it("Home / End 跳到第一个和最后一个", () => {
    expect(tabIndexAfterKey("Home", 2, 4)).toBe(0);
    expect(tabIndexAfterKey("End", 1, 4)).toBe(3);
  });

  it("其他键不处理", () => {
    expect(tabIndexAfterKey("Enter", 1, 4)).toBeUndefined();
    expect(tabIndexAfterKey("ArrowDown", 1, 4)).toBeUndefined();
    expect(tabIndexAfterKey("Home", 0, 0)).toBeUndefined();
  });
});
