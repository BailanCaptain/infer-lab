import { describe, expect, it } from "vitest";
import { getTroubleshootFixture } from "../../sim/troubleshoot/fixtures";
import { analyzeTroubleshootInput } from "../../sim/troubleshoot/logAnalyzer";
import { WARGAME_SCENARIOS } from "../../sim/wargame/scenarios";
import { deriveHardwareFaultFrame } from "./troubleshootHardwareModel";

describe("troubleshootHardwareModel — 3D Ascend Fault Replay State Derivation", () => {
  it("replays CASE-01 Rank 3 OOM -> Rank 0/1/2 waiting sequentially on Atlas 800T A2", () => {
    const case01 = WARGAME_SCENARIOS.find((s) => s.id === "rank3-oom-ei0006")!;
    const report = analyzeTroubleshootInput(case01.telemetryText);

    // Stage 0: initial participating frame — 4 active slots (0..3), 4 idle slots (4..7), honest schematic mode when ASCEND_RT_VISIBLE_DEVICES is absent
    const f0 = deriveHardwareFaultFrame(report, "a2-64g", 0);
    expect(f0.mappingMode).toBe("single-node-schematic");
    expect(f0.stages.length).toBe(5); // Stage 0 + Rank 3 OOM + Rank 0 + Rank 1 + Rank 2
    expect(f0.rankUnits.slice(0, 4).map((u) => u.state)).toEqual([
      "participating",
      "participating",
      "participating",
      "participating",
    ]);
    expect(f0.rankUnits.slice(4).every((u) => u.state === "idle")).toBe(true);
    expect(f0.waitingArcs).toEqual([]);

    // Stage 1 (10:11:05.214, L8): Rank 3 lights up as root-cause, Ranks 0..2 still participating
    const f1 = deriveHardwareFaultFrame(report, "a2-64g", 1);
    expect(f1.activeStage.focusRank).toBe(3);
    expect(f1.activeStage.focusLineNumber).toBe(8);
    expect(f1.rankUnits[3]?.state).toBe("root-cause");
    expect(f1.rankUnits.slice(0, 3).map((u) => u.state)).toEqual([
      "participating",
      "participating",
      "participating",
    ]);
    expect(f1.waitingArcs).toEqual([]);

    // Final Stage (10:12:35, L5..L7): Rank 0/1/2 all show confirmed-cascade waiting on Rank 3
    const fEnd = deriveHardwareFaultFrame(report, "a2-64g", 4);
    expect(fEnd.rankUnits.slice(0, 4).map((u) => u.state)).toEqual([
      "confirmed-cascade",
      "confirmed-cascade",
      "confirmed-cascade",
      "root-cause",
    ]);
    expect(fEnd.waitingArcs.map((a) => [a.fromRank, a.toRank])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
    ]);
  });

  it("clears root-cause highlight and omits causal waiting arcs on pure EI0006 timeout logs", () => {
    const pureTimeout = analyzeTroubleshootInput(
      getTroubleshootFixture("pure-hccl-timeout-no-primary").content,
    );
    const frame = deriveHardwareFaultFrame(pureTimeout, "a2-64g", 99);
    expect(frame.mappingMode).toBe("single-node-schematic");
    expect(frame.rankUnits.some((u) => u.state === "root-cause")).toBe(false);
    expect(frame.rankUnits.slice(0, 3).every((u) => u.state === "unattributed-timeout")).toBe(true);
    expect(frame.waitingArcs).toEqual([]);
  });

  it("maps logical Rank through ASCEND_RT_VISIBLE_DEVICES to real physical slots and falls back to logical-only when out of range", () => {
    const subSliceLog = [
      "export ASCEND_RT_VISIBLE_DEVICES=4,5,6,7",
      "2026-04-12 10:11:05.214 ERROR [Worker_TP0] [Rank 0] RuntimeError: NPU out of memory. Tried to allocate 1.80 GiB",
      "2026-04-12 10:12:35.100 ERROR [Worker_TP1] [Rank 1] EI0006 Notify wait execute timeout",
    ].join("\n");
    const subReport = analyzeTroubleshootInput(subSliceLog);
    expect(subReport.visibleDevices).toEqual([4, 5, 6, 7]);
    const mapped = deriveHardwareFaultFrame(subReport, "a2-64g", 99);
    expect(mapped.mappingMode).toBe("single-node-mapped");
    // Physical slots 0..3 stay idle; physical slot 4 carries logical Rank 0 (root-cause); physical slot 5 carries logical Rank 1 (confirmed-cascade)
    expect(mapped.rankUnits.slice(0, 4).every((u) => u.state === "idle")).toBe(true);
    expect(mapped.rankUnits[4]?.rank).toBe(4);
    expect(mapped.rankUnits[4]?.logicalRank).toBe(0);
    expect(mapped.rankUnits[4]?.physicalSlot).toBe(4);
    expect(mapped.rankUnits[4]?.state).toBe("root-cause");
    expect(mapped.rankUnits[5]?.logicalRank).toBe(1);
    expect(mapped.rankUnits[5]?.state).toBe("confirmed-cascade");
    expect(mapped.waitingArcs).toEqual([{ fromRank: 5, toRank: 4, lineNumber: 3 }]);

    const ep9Report = analyzeTroubleshootInput(
      "(Worker_DP1_TP1_DCP1_EP9 pid=289610) ERROR 09-10 08:52:41 RuntimeError: error code is 507015",
    );
    // Exceeds 8-rank A2, fits 16-die A3 (schematic without ASCEND_RT_VISIBLE_DEVICES)
    expect(deriveHardwareFaultFrame(ep9Report, "a2-64g", 1).mappingMode).toBe("logical-only");
    expect(deriveHardwareFaultFrame(ep9Report, "a3-die64g", 1).mappingMode).toBe("single-node-schematic");
    expect(deriveHardwareFaultFrame(ep9Report, "a3-die64g", 1).rankUnits[9]?.physicalSlot).toBe(4);
    expect(deriveHardwareFaultFrame(ep9Report, "a3-die64g", 1).rankUnits[9]?.dieIndex).toBe(1);

    // Multi-host device=3 stays logical-only even on 8-rank A2
    const hostDev = analyzeTroubleshootInput(
      "[host b] 2026-04-12 10:05:00 ERROR device=3 RuntimeError: NPU out of memory",
    );
    const hostFrame = deriveHardwareFaultFrame(hostDev, "a2-64g", 1);
    expect(hostFrame.mappingMode).toBe("logical-only");
    expect(hostFrame.rankUnits.every((u) => u.state === "unmapped")).toBe(true);
  });
});
