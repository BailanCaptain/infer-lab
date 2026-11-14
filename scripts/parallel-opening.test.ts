import { describe, expect, it } from "vitest";
import {
  mechanismChapters,
  mechanismFrame,
  mechanismSeconds,
  PP_SETUP,
  pcpMotion,
  ringMotion,
} from "../src/app/wiki/scene-parallel-mechanisms";
import { expertTransferProgress } from "../src/app/wiki/scene-playback";

describe("parallel opening precedes partition and calculation", () => {
  it("EP traces one long route at a time, with all deliveries complete before computing", () => {
    for (let n = 0; n <= 1000; n++) {
      const positions = Array.from({ length: 8 }, (_, i) => expertTransferProgress(n / 1000, i));
      expect(positions.filter((p) => p > 0 && p < 1).length).toBeLessThanOrEqual(1);
      if (n === 0) expect(positions).toEqual(Array(8).fill(0));
      if (n === 1000) expect(positions).toEqual(Array(8).fill(1));
    }
  });
  it("leaves time to recognize the complete object before it splits", () => {
    for (const kind of [0, 1, 2, 4]) {
      const first = mechanismFrame(kind, 2.4 / mechanismSeconds(kind));
      expect(first.reveal).toBe(1);
      expect(first.split).toBe(0);
      expect(mechanismChapters(kind)[1]!.start).toBeGreaterThanOrEqual(8);
    }
  });
  it("PP finishes placing layers before the request enters and computing starts", () => {
    const end = mechanismFrame(0, PP_SETUP * 0.84);
    expect(end.split).toBe(1);
    expect(end.setup).toBe(true);
    expect(end.first).toBe(0);
    expect(mechanismFrame(0, PP_SETUP).receive).toBe(0);
  });
  it("CP derives local Q/K/V only after whole input rows land, before attention", () => {
    for (let i = 0; i <= 1000; i++) {
      const p = i / 1000;
      const pcp = pcpMotion(p),
        ring = ringMotion(p);
      if (pcp.localKV > 0) expect(pcp.assign).toBe(1);
      if (ring.project > 0) expect(ring.assign).toBe(1);
      if (ring.phase > 0) expect(ring.project).toBe(1);
    }
    expect(ringMotion(1).project).toBe(1);
    expect(ringMotion(0).project).toBe(0);
  });
});
