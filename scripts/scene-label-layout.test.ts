import { describe, expect, it } from "vitest";
import { type LabelRect, placeSceneCellLabel, placeSceneLabel } from "../src/app/wiki/scene-label-layout";

const bounds = { x: 8, y: 100, width: 784, height: 570 };
const intersects = (a: LabelRect, b: LabelRect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

describe("SwiGLU labels leave projected matrices visible", () => {
  it("moves a value label outside its block without shrinking the type", () => {
    const block = { x: 400, y: 300, width: 60, height: 30 };
    const label = { x: 380, y: 295, width: 100, height: 40 };
    const placed = placeSceneLabel(label, [block], bounds);
    expect(intersects(placed, block)).toBe(false);
    expect([placed.width, placed.height]).toEqual([100, 40]);
  });
  it("separates four depth labels even when the camera projects them onto one point", () => {
    const occupied = [{ x: 400, y: 300, width: 60, height: 30 }];
    for (let i = 0; i < 4; i++) {
      const placed = placeSceneLabel({ x: 380, y: 295, width: 100, height: 40 }, occupied, bounds);
      expect(occupied.some((r) => intersects(r, placed))).toBe(false);
      occupied.push(placed);
    }
  });
  it("keeps rotated labels below the fixed heading and inside the canvas", () => {
    const placed = placeSceneLabel({ x: -30, y: 70, width: 160, height: 35 }, [], bounds);
    expect(placed.x).toBeGreaterThanOrEqual(bounds.x);
    expect(placed.y).toBeGreaterThanOrEqual(bounds.y);
    expect(placed.x + placed.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  });
  it("leaves an already clear label where it was", () => {
    const wanted = { x: 90, y: 160, width: 90, height: 40 };
    expect(placeSceneLabel(wanted, [{ x: 500, y: 300, width: 30, height: 30 }], bounds)).toEqual(wanted);
  });
  it("attaches each value beside its own block with a short gap on either side", () => {
    const block = { x: 400, y: 300, width: 60, height: 30 };
    const size = { width: 70, height: 24 };
    expect(placeSceneCellLabel(block, size, "left", [], bounds)).toEqual({ x: 322, y: 303, ...size });
    expect(placeSceneCellLabel(block, size, "right", [], bounds)).toEqual({ x: 468, y: 303, ...size });
  });
  it("follows each depth slice instead of reordering values into a detached column", () => {
    const blocks = [0, 1, 2, 3].map((i) => ({ x: 400 - i * 24, y: 420 - i * 65, width: 60, height: 30 }));
    const occupied = [...blocks];
    for (const block of blocks) {
      const placed = placeSceneCellLabel(block, { width: 70, height: 24 }, "right", occupied, bounds);
      expect(placed.x).toBe(block.x + block.width + 8);
      expect(placed.y + placed.height / 2).toBe(block.y + block.height / 2);
      expect(occupied.some((r) => intersects(r, placed))).toBe(false);
      occupied.push(placed);
    }
  });
  it("avoids neighboring matrices without shrinking the numeric label", () => {
    const block = { x: 400, y: 300, width: 60, height: 30 };
    const neighbor = { x: 470, y: 300, width: 60, height: 30 };
    const placed = placeSceneCellLabel(block, { width: 70, height: 24 }, "right", [neighbor], bounds);
    expect(intersects(placed, block)).toBe(false);
    expect(intersects(placed, neighbor)).toBe(false);
    expect([placed.width, placed.height]).toEqual([70, 24]);
  });
  it("makes a short adjustment to leave a calculation wire readable", () => {
    const block = { x: 400, y: 300, width: 60, height: 30 };
    const wire = { x: 480, y: 200, width: 1, height: 250 };
    const placed = placeSceneCellLabel(block, { width: 70, height: 24 }, "right", [], bounds, [wire]);
    expect(intersects(placed, wire)).toBe(false);
    expect(placed.x).toBeLessThanOrEqual(500);
  });
  it("prioritizes the owning block when wire avoidance would send its label to another row", () => {
    const block = { x: 400, y: 300, width: 60, height: 30 };
    const occupiedWireLane = { x: 470, y: 100, width: 120, height: 570 };
    const placed = placeSceneCellLabel(block, { width: 70, height: 24 }, "right", [], bounds, [
      occupiedWireLane,
    ]);
    expect(placed).toEqual({ x: 468, y: 303, width: 70, height: 24 });
    expect(intersects(placed, block)).toBe(false);
  });
  it("keeps a label near the edge inside a narrow canvas and clear of its block", () => {
    const narrow = { x: 8, y: 100, width: 380, height: 570 };
    const block = { x: 310, y: 300, width: 60, height: 30 };
    const placed = placeSceneCellLabel(block, { width: 90, height: 24 }, "right", [], narrow);
    expect(intersects(placed, block)).toBe(false);
    expect(placed.x).toBeGreaterThanOrEqual(narrow.x);
    expect(placed.x + placed.width).toBeLessThanOrEqual(narrow.x + narrow.width);
    expect(placed.x + placed.width / 2).toBe(block.x + block.width / 2);
    expect(placed.y + placed.height).toBe(block.y - 8);
  });
});
