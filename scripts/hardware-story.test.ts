import { describe, expect, it } from "vitest";
import { DP_STOPS, dpDeployment, dpRequestFrame, epIntroduction } from "../src/app/wiki/scene-hardware-story";
import { parallelTransfer } from "../src/app/wiki/scene-playback";

it("lands every contribution before adding it and retains the sum across handoffs", () => {
  for (let i = 0; i < 8; i++) {
    expect(parallelTransfer((i + 0.7) / 8).count).toBe(i);
    expect(parallelTransfer((i + 0.9) / 8).count).toBe(i + 1);
    expect(parallelTransfer((i + 1) / 8).count).toBe(i + 1);
  }
  expect(parallelTransfer(1)).toEqual({ index: 7, local: 1, count: 8 });
  expect(parallelTransfer(0)).toEqual({ index: 0, local: 0, count: 0 });
});

describe("hardware stories keep the cause before the transfer", () => {
  it("shows the whole model, separates machine ownership, then lands card shards before requests", () => {
    expect(dpDeployment(0)).toEqual({ stage: 0, copies: 0, landing: 0 });
    expect(dpDeployment(0.5)).toEqual({ stage: 1, copies: 1, landing: 0 });
    expect(dpDeployment(1)).toEqual({ stage: 2, copies: 1, landing: 1 });
    expect(dpRequestFrame(DP_STOPS[1] - 0.001).requests.every((r) => r.place === "user")).toBe(true);
  });
  it("lets A arrive before selection, then accounts for it before B arrives", () => {
    expect(dpRequestFrame(0).requests.map((r) => r.place)).toEqual(["user", "user"]);
    const arrival = dpRequestFrame((DP_STOPS[1]! + DP_STOPS[2]!) / 2);
    expect(arrival.requests[0].place).toBe("arriving");
    expect(arrival.waiting).toEqual([0, 0]);
    const second = dpRequestFrame((DP_STOPS[3]! + DP_STOPS[4]!) / 2);
    expect(second.requests[0].place).toBe("group");
    expect(second.requests[1].place).toBe("arriving");
    expect(second.scores).toEqual([4, 0]);
  });
  it("does not compute either request before it lands; replies keep their owners", () => {
    for (let i = 0; i <= 1000; i++) {
      const frame = dpRequestFrame(i / 1000);
      if (frame.stage === 5) expect(frame.requests.every((r) => r.place === "group")).toBe(true);
      frame.requests.forEach((r, owner) => {
        expect(r.owner).toBe(owner);
      });
    }
    expect(dpRequestFrame(1).requests.map((r) => r.place)).toEqual(["done", "done"]);
    expect(dpRequestFrame(0)).toEqual(dpRequestFrame(0));
  });
  it("introduces an MoE input and resident experts before showing a routing choice", () => {
    expect(epIntroduction(0)).toEqual({ stage: 0, arrived: 0, selected: false });
    expect(epIntroduction(0.5).selected).toBe(false);
    expect(epIntroduction(0.8)).toMatchObject({ stage: 2, arrived: 1, selected: true });
  });
});
