import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getTroubleshootFixture } from "../../sim/troubleshoot/fixtures";
import { analyzeTroubleshootInput, type LogAnalysisReport } from "../../sim/troubleshoot/logAnalyzer";
import { WARGAME_SCENARIOS } from "../../sim/wargame/scenarios";
import { TroubleshootHardwareStage } from "./TroubleshootHardwareStage";
import { deriveHardwareFaultFrame } from "./troubleshootHardwareModel";

describe("troubleshootHardwareModel — 3D Ascend Fault Replay State Derivation", () => {
  it("replays CASE-01 Rank 3 OOM -> Rank 0/1/2 waiting sequentially on Atlas 800T A2", () => {
    const case01 = WARGAME_SCENARIOS.find((s) => s.id === "rank3-oom-ei0006")!;
    const report = analyzeTroubleshootInput(case01.telemetryText);

    // Stage 0: initial participating frame — 4 active slots (0..3), 4 idle slots (4..7), honest schematic mode when ASCEND_RT_VISIBLE_DEVICES is absent
    const f0 = deriveHardwareFaultFrame(report, "a2-64g", 0);
    expect(f0.mappingMode).toBe("single-node-schematic");
    expect(f0.stages.length).toBe(6); // Stage 0 + Rank 3 OOM + Rank 0 + Rank 1 + Rank 2 + EngineCore_DP0 shutdown cascade
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

    // Stage 4 (10:12:35, L5..L7): all three worker ranks (0/1/2) show confirmed-cascade waiting on Rank 3; Stage 5 adds EngineCore_DP0 shutdown
    const fStage4 = deriveHardwareFaultFrame(report, "a2-64g", 4);
    expect(fStage4.rankUnits.slice(0, 4).map((u) => u.state)).toEqual([
      "confirmed-cascade",
      "confirmed-cascade",
      "confirmed-cascade",
      "root-cause",
    ]);
    expect(fStage4.waitingArcs.map((a) => [a.fromRank, a.toRank])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
    ]);
    const fFinal = deriveHardwareFaultFrame(report, "a2-64g", 5);
    expect(fFinal.activeStage.focusLineNumber).toBe(10);
    expect(fFinal.waitingArcs.map((a) => [a.fromRank, a.toRank])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
    ]);
  });

  it("clears root-cause highlight and omits causal waiting arcs on pure EI0002/Notify watchdog timeout logs", () => {
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
    expect(hostFrame.linkFaultMarks).toEqual([]);
  });

  it("distinguishes concrete HCCL NIC/route link fault on Rank 2 from EI0006 wait cascades on Ranks 0/1/3 across replay stages", () => {
    const linkFaultLog = [
      "2026-04-12 10:11:05.100 ERROR [Rank 2] RuntimeError: HCCL_SOCKET_IFNAME=enp65s0f0 RaSocketConnect failed: No route to host",
      "2026-04-12 10:12:35.100 ERROR [Rank 0] EI0006 Notify wait execute timeout",
      "2026-04-12 10:12:35.200 ERROR [Rank 1] EI0006 Notify wait execute timeout",
      "2026-04-12 10:12:35.300 ERROR [Rank 3] EI0006 Notify wait execute timeout",
    ].join("\n");
    const report = analyzeTroubleshootInput(linkFaultLog);

    const s0 = deriveHardwareFaultFrame(report, "a2-64g", 0);
    expect(s0.stages.length).toBe(5);
    expect(s0.linkFaultMarks).toEqual([]);
    expect(s0.waitingArcs).toEqual([]);
    expect(
      s0.rankUnits.slice(0, 4).every((u) => u.state === "participating" && u.faultMechanism === "none"),
    ).toBe(true);

    // Stage 1: only Rank 2 local link fault appears (0 waiting arcs yet)
    const s1 = deriveHardwareFaultFrame(report, "a2-64g", 1);
    expect(s1.rankUnits[2]?.state).toBe("root-cause");
    expect(s1.rankUnits[2]?.faultMechanism).toBe("hccl-link-fault");
    expect(s1.rankUnits[2]?.ifaceOrPort).toBe("enp65s0f0");
    expect(s1.rankUnits[2]?.statusLabel).toContain("enp65s0f0");
    expect(s1.linkFaultMarks).toEqual([
      {
        rank: 2,
        logicalRank: 2,
        peerRank: null,
        peerLogicalRank: null,
        kind: "nic-bind-or-route",
        ifaceOrPort: "enp65s0f0",
        label: "网卡/路由建链故障 (enp65s0f0) · L1",
        lineNumber: 1,
      },
    ]);
    expect(s1.waitingArcs).toEqual([]);

    // Intermediate Stage 2: only Rank 0 has entered wait cascade
    const s2 = deriveHardwareFaultFrame(report, "a2-64g", 2);
    expect(s2.linkFaultMarks).toHaveLength(1);
    expect(s2.waitingArcs).toEqual([{ fromRank: 0, toRank: 2, lineNumber: 2 }]);

    // Final Stage 4: Rank 2 retains linkFaultMark while Ranks 0/1/3 coexist with purple waitingArcs -> Rank 2
    const sEnd = deriveHardwareFaultFrame(report, "a2-64g", 4);
    expect(sEnd.linkFaultMarks).toHaveLength(1);
    expect(sEnd.linkFaultMarks[0]?.ifaceOrPort).toBe("enp65s0f0");
    expect([0, 1, 3].every((r) => sEnd.rankUnits[r]?.state === "confirmed-cascade")).toBe(true);
    expect([0, 1, 3].every((r) => sEnd.rankUnits[r]?.faultMechanism === "hccl-wait-cascade")).toBe(true);
    expect(sEnd.waitingArcs.map((a) => [a.fromRank, a.toRank])).toEqual([
      [0, 2],
      [1, 2],
      [3, 2],
    ]);
  });

  it("keeps EI0006 Getting socket times out [Wait][LinkEstablish] as unattributed hccl-link-timeout with 0 arcs and 0 marks", () => {
    const linkTimeoutLog = [
      "2026-04-12 10:12:35.100 ERROR [Rank 0] EI0006 Getting socket times out [Wait][LinkEstablish]",
      "2026-04-12 10:12:35.200 ERROR [Rank 1] EI0006 Getting socket times out [Wait][LinkEstablish]",
    ].join("\n");
    const report = analyzeTroubleshootInput(linkTimeoutLog);
    const frame = deriveHardwareFaultFrame(report, "a2-64g", 99);

    expect(frame.rankUnits.some((u) => u.state === "root-cause")).toBe(false);
    expect(frame.rankUnits[0]?.state).toBe("unattributed-timeout");
    expect(frame.rankUnits[0]?.faultMechanism).toBe("hccl-link-timeout");
    expect(frame.rankUnits[0]?.statusLabel).toBe("建链超时（对端/路由待核）· L1");
    expect(frame.rankUnits[1]?.state).toBe("unattributed-timeout");
    expect(frame.rankUnits[1]?.faultMechanism).toBe("hccl-link-timeout");
    expect(frame.waitingArcs).toEqual([]);
    expect(frame.linkFaultMarks).toEqual([]);
  });

  it("keeps multi-node [node-P] link-fault logs in logical-only mode with 0 physical linkFaultMarks", () => {
    const multiNodeLinkFault = [
      "[node-P] [Rank 0] 2026-04-12 10:11:05.100 ERROR EJ0001 HCCL_SOCKET_IFNAME=eth9 RaSocketBind failed: Cannot assign requested address",
      "[node-D] [Rank 0] 2026-04-12 10:12:35.100 ERROR EI0006 Notify wait execute timeout",
    ].join("\n");
    const report = analyzeTroubleshootInput(multiNodeLinkFault);
    const frame = deriveHardwareFaultFrame(report, "a3-die64g", 99);

    expect(frame.mappingMode).toBe("logical-only");
    expect(frame.rankUnits.every((u) => u.state === "unmapped" && u.faultMechanism === "none")).toBe(true);
    expect(frame.linkFaultMarks).toEqual([]);
    expect(frame.waitingArcs).toEqual([]);
  });

  it("handles RoCE port down, EI0004/EI0009/EJ0001 transport init, explicit faultMechanism, visible-device remapping, and mechanism compression", () => {
    const syntheticReport: LogAnalysisReport = {
      inputKind: "logs",
      totalLines: 5,
      detectedRanks: [0, 1, 2, 3],
      visibleDevices: [4, 5, 6, 7],
      firstFaultVerdict: {
        rank: 1,
        confidence: "high",
        rationale: "synthetic multi-mechanism link fault test",
        primaryEvidenceLines: [],
        cascadeRanks: [0],
        rankSource: "explicit-rank",
        slotMappable: true,
        cascadeCausalState: "confirmed-after",
        timelineEvents: [
          {
            id: "e1",
            lineNumber: 1,
            timestamp: "10:00:01.000",
            timestampMs: 1000,
            rank: 1,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            signalTag: "RuntimeError",
            rawLine: "RuntimeError: wrapper on rank 1",
          },
          {
            id: "e2",
            lineNumber: 2,
            timestamp: "10:00:01.100",
            timestampMs: 1100,
            rank: 1,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            signalTag: "HCCL link",
            rawLine: "RoCE port 0 link is down on device",
          },
          {
            id: "e3",
            lineNumber: 3,
            timestamp: "10:00:01.200",
            timestampMs: 1200,
            rank: 2,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            signalTag: "EI0009",
            rawLine: "EI0009 Device transport init error",
          },
          {
            id: "e4",
            lineNumber: 4,
            timestamp: "10:00:01.300",
            timestampMs: 1300,
            rank: 3,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            signalTag: "custom-hccl-tag",
            rawLine: "socket init failure on eth0",
            faultMechanism: "hccl-link",
          } as unknown as NonNullable<LogAnalysisReport["firstFaultVerdict"]["timelineEvents"]>[number],
          {
            id: "e5",
            lineNumber: 5,
            timestamp: "10:00:05.000",
            timestampMs: 5000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "confirmed-cascade",
            signalTag: "HCCL EI0006",
            rawLine: "EI0006 Notify wait execute timeout",
          },
        ],
      },
      metrics: { hasMetrics: false, rawMetricCount: 0 },
      findings: [],
      unmatchedErrorLines: [],
    };

    const frame = deriveHardwareFaultFrame(syntheticReport, "a2-64g", 99);
    expect(frame.mappingMode).toBe("single-node-mapped");
    // Logical Rank 1 -> physical slot 5 (RoCE port down must NOT be swallowed by earlier RuntimeError on Rank 1)
    expect(frame.rankUnits[5]?.state).toBe("root-cause");
    expect(frame.rankUnits[5]?.faultMechanism).toBe("hccl-link-fault");
    expect(frame.rankUnits[5]?.ifaceOrPort).toBe("RoCE port 0");
    expect(frame.rankUnits[5]?.statusLabel).toBe("RoCE 端口掉链 (RoCE port 0) · L2");
    // Logical Rank 2 -> physical slot 6 (EI0009 transport-init)
    expect(frame.rankUnits[6]?.faultMechanism).toBe("hccl-link-fault");
    // Logical Rank 3 -> physical slot 7 (faultMechanism: "hccl-link" fallback)
    expect(frame.rankUnits[7]?.faultMechanism).toBe("hccl-link-fault");
    expect(frame.rankUnits[7]?.ifaceOrPort).toBe("eth0");
    // Logical Rank 0 -> physical slot 4 waits on physical slot 5 (Rank 1)
    expect(frame.rankUnits[4]?.faultMechanism).toBe("hccl-wait-cascade");
    expect(frame.waitingArcs).toEqual([{ fromRank: 4, toRank: 5, lineNumber: 5 }]);
    expect(frame.linkFaultMarks).toEqual([
      {
        rank: 5,
        logicalRank: 1,
        peerRank: null,
        peerLogicalRank: null,
        kind: "roce-port-down",
        ifaceOrPort: "RoCE port 0",
        label: "RoCE 端口掉链 (RoCE port 0) · L2",
        lineNumber: 2,
      },
      {
        rank: 6,
        logicalRank: 2,
        peerRank: null,
        peerLogicalRank: null,
        kind: "transport-init",
        ifaceOrPort: null,
        label: "HCCL 传输初始化故障 · L3",
        lineNumber: 3,
      },
      {
        rank: 7,
        logicalRank: 3,
        peerRank: null,
        peerLogicalRank: null,
        kind: "nic-bind-or-route",
        ifaceOrPort: "eth0",
        label: "网卡/路由建链故障 (eth0) · L4",
        lineNumber: 4,
      },
    ]);
  });

  it("consumes analyzer kind/mechanism/ruleId so HCCL p2p timeout stays unattributed and Mooncake No route stays general-root", () => {
    const p2pReport = analyzeTroubleshootInput(
      "[Rank 1] 2026-04-12 10:00:00.000 ERROR HCCL p2p timeout during comm init",
    );
    expect(p2pReport.firstFaultVerdict.confidence).toBe("low");
    expect(p2pReport.firstFaultVerdict.timelineEvents?.[0]?.kind).toBe("unattributed-cascade");
    const p2pFrame = deriveHardwareFaultFrame(p2pReport, "a2-64g", 99);
    expect(p2pFrame.rankUnits.some((u) => u.state === "root-cause")).toBe(false);
    expect(p2pFrame.rankUnits[1]?.state).toBe("unattributed-timeout");
    expect(p2pFrame.rankUnits[1]?.faultMechanism).not.toBe("hccl-link-fault");
    expect(p2pFrame.linkFaultMarks).toEqual([]);

    const mooncakeReport = analyzeTroubleshootInput(
      "[Rank 0] 2026-04-12 10:00:00.000 ERROR MooncakeConnectorV1 failed: No route to host",
    );
    expect(mooncakeReport.findings.map((f) => f.ruleId)).toContain("mooncake-pd-transfer-error");
    const mooncakeFrame = deriveHardwareFaultFrame(mooncakeReport, "a2-64g", 99);
    expect(mooncakeFrame.rankUnits[0]?.state).toBe("root-cause");
    expect(mooncakeFrame.rankUnits[0]?.faultMechanism).toBe("general-root");
    expect(mooncakeFrame.linkFaultMarks).toEqual([]);
  });

  it("preserves root-cause against later timeout on the same rank and keeps sequential root stages + hostTag + RoCE port label", () => {
    // 1. OOM first on Rank 2, then later unattributed/cascade timeout on Rank 2 must NOT overwrite root-cause
    const oomThenTimeoutReport: LogAnalysisReport = {
      inputKind: "logs",
      totalLines: 2,
      detectedRanks: [2],
      visibleDevices: null,
      firstFaultVerdict: {
        rank: 2,
        confidence: "high",
        rationale: "Rank 2 OOM then later timeout",
        primaryEvidenceLines: [],
        cascadeRanks: [],
        rankSource: "explicit-rank",
        slotMappable: true,
        cascadeCausalState: "confirmed-after",
        timelineEvents: [
          {
            id: "e1",
            lineNumber: 1,
            timestamp: "10:00:01.000",
            timestampMs: 1000,
            rank: 2,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "memory-oom",
            ruleId: "oom-stage-split",
            signalTag: "NPU HBM OOM",
            rawLine: "ERROR [Rank 2] NPU out of memory",
          },
          {
            id: "e2",
            lineNumber: 2,
            timestamp: "10:00:10.000",
            timestampMs: 10000,
            rank: 2,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "unattributed-cascade",
            mechanism: "wait-cascade",
            ruleId: "hccl-timeout-cascade",
            signalTag: "HCCL EI0002",
            rawLine: "ERROR [Rank 2] EI0002 Notify wait execute timeout",
          },
        ],
      },
      metrics: { hasMetrics: false, rawMetricCount: 0 },
      findings: [],
      unmatchedErrorLines: [],
    };
    const oomFrame = deriveHardwareFaultFrame(oomThenTimeoutReport, "a2-64g", 99);
    expect(oomFrame.stages).toHaveLength(3);
    expect(oomFrame.rankUnits[2]?.state).toBe("root-cause");
    expect(oomFrame.rankUnits[2]?.faultMechanism).toBe("general-root");

    // 2. Same-rank RaSocketBind followed by RoCE port 2 link down preserves BOTH independent link markers & stages
    const seqLinkLog = [
      "2026-04-12 10:00:01.000 ERROR [Rank 1] RaSocketBind failed on enp65s0f0: Cannot assign requested address",
      "2026-04-12 10:00:02.000 ERROR [Rank 1] RoCE port 2 link down",
    ].join("\n");
    const seqReport = analyzeTroubleshootInput(seqLinkLog);
    const s1 = deriveHardwareFaultFrame(seqReport, "a2-64g", 1);
    const s2 = deriveHardwareFaultFrame(seqReport, "a2-64g", 2);
    expect(s2.stages).toHaveLength(3);
    expect(s1.linkFaultMarks[0]?.kind).toBe("nic-bind-or-route");
    expect(s1.linkFaultMarks[0]?.ifaceOrPort).toBe("enp65s0f0");
    expect(s2.linkFaultMarks).toHaveLength(2);
    expect(s2.linkFaultMarks[0]?.kind).toBe("nic-bind-or-route");
    expect(s2.linkFaultMarks[0]?.ifaceOrPort).toBe("enp65s0f0");
    expect(s2.linkFaultMarks[1]?.kind).toBe("roce-port-down");
    expect(s2.linkFaultMarks[1]?.ifaceOrPort).toBe("RoCE port 2");
    // Slot HUD keeps winning primary root evidence (L1 RaSocketBind) without drifting to L2
    expect(s2.rankUnits[1]?.evidenceLineNumber).toBe(1);
    expect(s2.rankUnits[1]?.statusLabel).toBe("网卡/路由建链故障 (enp65s0f0) · L1");

    // 2b. v7 P2-1: Keeping winning duplicate preserves chronological replay order (10:00:02 L2 -> 10:00:03 L3)
    const chronoReport: LogAnalysisReport = {
      inputKind: "logs",
      totalLines: 3,
      detectedRanks: [0, 1],
      visibleDevices: null,
      firstFaultVerdict: {
        rank: 0,
        confidence: "high",
        rationale: "oom",
        primaryEvidenceLines: [
          { lineNumber: 3, rank: 0, timestamp: "10:00:03", rawLine: "OOM primary", kind: "root-cause" },
        ],
        cascadeRanks: [],
        rankSource: "explicit-rank",
        slotMappable: true,
        timelineEvents: [
          {
            id: "c1",
            lineNumber: 1,
            timestamp: "10:00:01",
            timestampMs: 1000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "memory-oom",
            signalTag: "NPU OOM",
            rawLine: "OOM L1",
          },
          {
            id: "c2",
            lineNumber: 2,
            timestamp: "10:00:02",
            timestampMs: 2000,
            rank: 1,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "link-bind-fault",
            iface: "eth9",
            signalTag: "RaSocketBind",
            rawLine: "bind eth9",
          },
          {
            id: "c3",
            lineNumber: 3,
            timestamp: "10:00:03",
            timestampMs: 3000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "memory-oom",
            signalTag: "NPU OOM",
            rawLine: "OOM L3",
          },
        ],
      },
      metrics: { hasMetrics: false, rawMetricCount: 0 },
      findings: [],
      unmatchedErrorLines: [],
    };
    const chronoFrame = deriveHardwareFaultFrame(chronoReport, "a2-64g", 99);
    expect(chronoFrame.stages).toHaveLength(3);
    expect(chronoFrame.stages[1]?.timestamp).toBe("10:00:02");
    expect(chronoFrame.stages[1]?.focusLineNumber).toBe(2);
    expect(chronoFrame.stages[2]?.timestamp).toBe("10:00:03");
    expect(chronoFrame.stages[2]?.focusLineNumber).toBe(3);
    expect(chronoFrame.rankUnits[0]?.statusLabel).toBe("首错真凶 · L3");

    // 3. Dual-host Rank 0 collision keeps BOTH host events and enforces true logical-only neutrality
    const dualHostLog = [
      "[node-P] [Rank 0] 2026-04-12 10:00:01.000 ERROR RaSocketBind failed on eth9: Cannot assign requested address",
      "[node-D] [Rank 0] 2026-04-12 10:00:02.000 ERROR RaSocketBind failed on eth9: Cannot assign requested address",
    ].join("\n");
    const dualReport = analyzeTroubleshootInput(dualHostLog);
    const dualFrame = deriveHardwareFaultFrame(dualReport, "a2-64g", 1);
    expect(dualFrame.stages).toHaveLength(3);
    expect(dualFrame.mappingMode).toBe("logical-only");
    expect(dualFrame.activeStage.focusRank).toBeNull();
    expect(dualFrame.rankUnits.every((u) => u.logicalRank === null && u.state === "unmapped")).toBe(true);

    // 4. SSR neutrality & narrow container check on TroubleshootHardwareStage
    const html = renderToStaticMarkup(
      createElement(TroubleshootHardwareStage, {
        report: dualReport,
        defaultCardId: "a2-64g",
        selectedRank: 0,
        onSelectEvidence: () => {},
      }),
    );
    expect(html).toContain("minmax(min(100%, 280px), 1fr)");
    expect(html).not.toContain("border:2px solid");
    const slot0Match = /<button\b[^>]*data-testid="troubleshoot-3d-slot-0"[^>]*>/.exec(html);
    expect(slot0Match).not.toBeNull();
    expect(slot0Match?.[0]).toContain("disabled");
    expect(slot0Match?.[0]).toContain('aria-disabled="true"');
  });

  it("enforces per-event provenance, peerRank endpoint preservation, link-peer-refused isolation, HUD root stability, visible-only labels, EngineCore_DP0, and hostTag captions", () => {
    // 1. P1-9: device=1 slotMappable=false never paints physical Slot 5 even with ASCEND_RT_VISIBLE_DEVICES=4,5
    const devReport = analyzeTroubleshootInput(
      [
        "export ASCEND_RT_VISIBLE_DEVICES=4,5",
        "10:00:00 ERROR [Rank 0] RuntimeError: NPU out of memory",
        "10:00:01 ERROR device=1 HCCL RoCE port 1 link down",
      ].join("\n"),
    );
    const devFrame = deriveHardwareFaultFrame(devReport, "a2-64g", 99);
    expect(devFrame.mappingMode).toBe("single-node-mapped");
    expect(devFrame.rankUnits[4]?.state).toBe("root-cause");
    expect(devFrame.rankUnits[5]?.state).toBe("idle");
    expect(devFrame.rankUnits[5]?.statusLabel).toBe("可见待命");
    expect(devFrame.linkFaultMarks).toEqual([]);
    expect(devFrame.stages).toHaveLength(3);

    // 2. P1-9: multi-instance visible maps (4,5 vs 6,7) never paint instance B onto instance A's slot 5
    const multiInstReport = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "instance=B ASCEND_RT_VISIBLE_DEVICES=6,7",
        "10:00:00 ERROR instance=A [Rank 0] RuntimeError: NPU out of memory",
        "10:00:01 ERROR instance=B [Rank 1] HCCL RoCE port 1 link down",
      ].join("\n"),
    );
    const multiInstFrame = deriveHardwareFaultFrame(multiInstReport, "a2-64g", 99);
    expect(multiInstFrame.rankUnits[4]?.state).toBe("root-cause");
    expect(multiInstFrame.rankUnits[5]?.state).toBe("idle");
    expect(multiInstFrame.linkFaultMarks).toEqual([]);
    expect(multiInstFrame.stages).toHaveLength(3);

    // 3. P2: two distinct peers on same rank preserve both milestones and peerRank/peerLogicalRank
    const peerReport = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 2] ERROR HCCL RoCE port 1 link down to peer rank 3",
        "10:00:01 [Rank 2] ERROR HCCL RoCE port 1 link down to peer rank 4",
      ].join("\n"),
    );
    const peerFrame = deriveHardwareFaultFrame(peerReport, "a2-64g", 99);
    expect(peerFrame.stages).toHaveLength(3);
    expect(peerFrame.linkFaultMarks).toHaveLength(2);
    expect(peerFrame.linkFaultMarks.map((m) => [m.rank, m.peerRank, m.peerLogicalRank])).toEqual([
      [2, 3, 3],
      [2, 4, 4],
    ]);

    // 4. P2: HUD root evidenceLineNumber & statusLabel stay locked to L1 OOM even after L2 exitcode -9
    const exit9Report = analyzeTroubleshootInput(
      [
        "10:00:00 [Rank 2] ERROR RuntimeError: NPU out of memory",
        "10:00:01 [Rank 2] ERROR Worker exited with exitcode -9",
      ].join("\n"),
    );
    const exit9Frame = deriveHardwareFaultFrame(exit9Report, "a2-64g", 99);
    expect(exit9Frame.rankUnits[2]?.state).toBe("root-cause");
    expect(exit9Frame.rankUnits[2]?.statusLabel).toBe("首错真凶 · L1");
    expect(exit9Frame.rankUnits[2]?.evidenceLineNumber).toBe(1);

    // 5. P2: ECONNREFUSED / link-peer-refused never creates a severed-cable mark and maps cleanly to cascade/wait
    const peerRefusedReport: LogAnalysisReport = {
      inputKind: "logs",
      totalLines: 3,
      detectedRanks: [0, 1, 2],
      visibleDevices: null,
      firstFaultVerdict: {
        rank: 0,
        confidence: "high",
        rationale: "rank 0 OOM caused c10d connection refused on peers",
        primaryEvidenceLines: [
          {
            lineNumber: 1,
            rank: 0,
            timestamp: "10:00:00.000",
            rawLine: "Rank 0 RuntimeError: NPU out of memory",
            kind: "root-cause",
          },
        ],
        cascadeRanks: [1, 2],
        rankSource: "explicit-rank",
        slotMappable: true,
        cascadeCausalState: "confirmed-after",
        timelineEvents: [
          {
            id: "e1",
            lineNumber: 1,
            timestamp: "10:00:00.000",
            timestampMs: 1000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "memory-oom",
            signalTag: "NPU HBM OOM",
            rawLine: "Rank 0 RuntimeError: NPU out of memory",
          },
          {
            id: "e2",
            lineNumber: 2,
            timestamp: "10:00:01.000",
            timestampMs: 2000,
            rank: 1,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "confirmed-cascade",
            mechanism: "link-peer-refused",
            peerRank: 0,
            signalTag: "c10d ECONNREFUSED",
            rawLine: "[c10d] failed to connect (errno: 111 - Connection refused)",
          },
          {
            id: "e3",
            lineNumber: 3,
            timestamp: "10:00:01.200",
            timestampMs: 2200,
            rank: 2,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "unattributed-cascade",
            mechanism: "link-peer-refused",
            signalTag: "Connection reset",
            rawLine: "ECONNREFUSED Connection refused",
          },
        ],
      },
      metrics: { hasMetrics: false, rawMetricCount: 0 },
      findings: [],
      unmatchedErrorLines: [],
    };
    const refusedFrame = deriveHardwareFaultFrame(peerRefusedReport, "a2-64g", 99);
    expect(refusedFrame.linkFaultMarks).toEqual([]);
    expect(refusedFrame.rankUnits[0]?.state).toBe("root-cause");
    expect(refusedFrame.rankUnits[1]?.state).toBe("confirmed-cascade");
    expect(refusedFrame.rankUnits[2]?.state).toBe("unattributed-timeout");
    expect(refusedFrame.waitingArcs).toEqual([{ fromRank: 1, toRank: 0, lineNumber: 2 }]);

    // 6. P2: visible-but-unobserved devices get 可见待命, EngineCore_DP0 survives replay, hostTag shows in stage title
    const visReport = analyzeTroubleshootInput(
      "export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3,4,5,6,7\n10:00:00 [Rank 0] ERROR RuntimeError: NPU out of memory",
    );
    const visFrame = deriveHardwareFaultFrame(visReport, "a2-64g", 99);
    expect(visFrame.rankUnits.slice(1).every((u) => u.state === "idle" && u.statusLabel === "可见待命")).toBe(
      true,
    );

    const dpReport = analyzeTroubleshootInput(
      "10:00:00 ERROR (EngineCore_DP0 pid=11) RuntimeError: NPU out of memory",
    );
    const dpFrame = deriveHardwareFaultFrame(dpReport, "a2-64g", 99);
    expect(dpFrame.stages).toHaveLength(2);
    expect(dpFrame.stages[1]?.title).toContain("协调进程 DP0");

    const hostReport = analyzeTroubleshootInput(
      [
        "[node-P] [Rank 0] 2026-04-12 10:00:01.000 ERROR RaSocketBind failed on eth9: Cannot assign requested address",
        "[node-D] [Rank 0] 2026-04-12 10:00:02.000 ERROR EI0006 Notify wait execute timeout",
      ].join("\n"),
    );
    const hostFrame = deriveHardwareFaultFrame(hostReport, "a2-64g", 99);
    expect(hostFrame.stages[1]?.title).toContain("node-P");
    expect(hostFrame.stages[2]?.title).toContain("node-D");

    // 7. P2: EI0004 transport-init maps to distinct transport-init mark & legend cleanly
    const tInitReport: LogAnalysisReport = {
      ...peerRefusedReport,
      detectedRanks: [2],
      firstFaultVerdict: {
        rank: 2,
        confidence: "high",
        rationale: "EI0004",
        primaryEvidenceLines: [
          { lineNumber: 1, rank: 2, timestamp: "10:00:00", rawLine: "EI0004", kind: "root-cause" },
        ],
        cascadeRanks: [],
        rankSource: "explicit-rank",
        slotMappable: true,
        timelineEvents: [
          {
            id: "t1",
            lineNumber: 1,
            timestamp: "10:00:00",
            timestampMs: 1000,
            rank: 2,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "link-transport-init",
            signalTag: "EI0004",
            rawLine: "Rank 2 EI0004 rank table mismatch",
          },
        ],
      },
    };
    const tInitFrame = deriveHardwareFaultFrame(tInitReport, "a2-64g", 99);
    expect(tInitFrame.linkFaultMarks[0]?.kind).toBe("transport-init");
  });

  it("Round-3 Codex closure: handles PID/group scope isolation, genuine Rank 15 INFO bounds, activeStage Stage-0 sync, EI0004 RaSocket init, and CASE-01 DP0 retention", () => {
    // 1. P1-2: genuine [Rank 15] INFO worker ready alongside Rank 0 OOM MUST NOT be silently dropped (triggers logical-only on 8-card A2)
    const base = analyzeTroubleshootInput("10:00:00 [Rank 0] ERROR RuntimeError: NPU out of memory");
    const genuineRank15Report: LogAnalysisReport = {
      ...base,
      detectedRanks: [0, 15],
    };
    const genuineRank15Frame = deriveHardwareFaultFrame(genuineRank15Report, "a2-64g", 99);
    expect(genuineRank15Frame.mappingMode).toBe("logical-only");
    expect(genuineRank15Frame.rankUnits.every((u) => u.state === "unmapped")).toBe(true);

    // 2. P1-3 / P2-1: PID-inherited instance=B & group=decode never paint slot 5, AND activeStage at step 0 syncs with stages[0]
    const pidLogs = analyzeTroubleshootInput(
      [
        "instance=A ASCEND_RT_VISIBLE_DEVICES=4,5",
        "10:00:00 ERROR (Worker pid=10) instance=A EI0006 Notify wait execute timeout",
        "10:00:01 ERROR (Worker pid=11) instance=B EI0006 Notify wait execute timeout",
        "10:00:02 ERROR (Worker pid=10) [Rank 0] RuntimeError: NPU out of memory",
        "10:00:03 ERROR (Worker pid=11) [Rank 1] HCCL RoCE port 1 link down",
      ].join("\n"),
    );
    const pidFrame0 = deriveHardwareFaultFrame(pidLogs, "a2-64g", 0);
    expect(pidFrame0.stages[0]?.title).toBe("首帧 · 整机就绪（Rank 0 参与运行）");
    expect(pidFrame0.activeStage.title).toBe("首帧 · 整机就绪（Rank 0 参与运行）");
    const pidFrame = deriveHardwareFaultFrame(pidLogs, "a2-64g", 99);
    expect(pidFrame.mappingMode).toBe("single-node-mapped");
    expect(pidFrame.rankUnits[4]?.state).toBe("root-cause");
    expect(pidFrame.rankUnits[5]?.state).toBe("idle");
    expect(pidFrame.rankUnits[5]?.statusLabel).toBe("可见待命");
    expect(pidFrame.linkFaultMarks).toEqual([]);

    const groupReport: LogAnalysisReport = {
      ...base,
      visibleDevices: [4, 5],
      detectedRanks: [0, 1],
      firstFaultVerdict: {
        ...base.firstFaultVerdict,
        timelineEvents: [
          {
            id: "g1",
            lineNumber: 1,
            timestamp: "10:00:00",
            timestampMs: 1000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "memory-oom",
            signalTag: "NPU HBM OOM",
            rawLine: "group=prefill [Rank 0] RuntimeError: NPU out of memory",
          },
          {
            id: "g2",
            lineNumber: 2,
            timestamp: "10:00:01",
            timestampMs: 2000,
            rank: 1,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "link-port-down",
            signalTag: "RoCE link down",
            rawLine: "group=decode [Rank 1] HCCL RoCE port 1 link down",
          },
        ],
      },
    };
    const groupFrame = deriveHardwareFaultFrame(groupReport, "a2-64g", 99);
    expect(groupFrame.mappingMode).toBe("single-node-mapped");
    expect(groupFrame.rankUnits[5]?.state).toBe("idle");
    expect(groupFrame.linkFaultMarks).toEqual([]);

    // 3. P2-3: EI0004/EI0009/EJ0001 + "RaSocket transport init failed" classifies as transport-init, NOT severed-cable nic-bind-or-route
    const raTransportInit = analyzeTroubleshootInput(
      "10:00:00 ERROR [Rank 0] EI0004 HCCL RaSocket transport init failed",
    );
    const raTransportFrame = deriveHardwareFaultFrame(raTransportInit, "a2-64g", 99);
    expect(raTransportFrame.linkFaultMarks[0]?.kind).toBe("transport-init");

    // 4. P2-2: EngineCore_DP0 EI0002 Notify wait execute timeout cascade stays in replay stages
    const dpTimeoutReport: LogAnalysisReport = {
      ...base,
      detectedRanks: [0],
      firstFaultVerdict: {
        ...base.firstFaultVerdict,
        timelineEvents: [
          ...(base.firstFaultVerdict.timelineEvents ?? []),
          {
            id: "dp0-ei0002",
            lineNumber: 2,
            timestamp: "10:00:01",
            timestampMs: 2000,
            rank: 0,
            rankSource: "worker-dp-pp",
            slotMappable: false,
            kind: "confirmed-cascade",
            mechanism: "wait-cascade",
            signalTag: "EI0002",
            rawLine: "10:00:01 (EngineCore_DP0 pid=11) ERROR EI0002 Notify wait execute timeout",
          },
        ],
      },
    };
    const dpTimeoutFrame = deriveHardwareFaultFrame(dpTimeoutReport, "a2-64g", 99);
    expect(dpTimeoutFrame.stages).toHaveLength(3);
    expect(dpTimeoutFrame.stages[2]?.title).toContain("协调进程 DP0");

    // 5. Codex v3 #1/#9/#10: device=15 never erases worker Rank 15, mappable group fault survives unmappable earlier peer fault, and explicit link-transport-init overrides diagnostic RoCE text
    const worker15Device15: LogAnalysisReport = {
      ...base,
      detectedRanks: [0, 15],
      firstFaultVerdict: {
        ...base.firstFaultVerdict,
        timelineEvents: [
          ...(base.firstFaultVerdict.timelineEvents ?? []),
          {
            id: "dev15",
            lineNumber: 2,
            timestamp: "10:00:01",
            timestampMs: 2000,
            rank: 15,
            rankSource: "device-id",
            slotMappable: false,
            kind: "root-cause",
            mechanism: "link-port-down",
            signalTag: "RoCE",
            rawLine: "10:00:01 ERROR device=15 HCCL RoCE port 1 link down",
          },
        ],
      },
    };
    expect(deriveHardwareFaultFrame(worker15Device15, "a2-64g", 99).mappingMode).toBe("logical-only");

    const groupDedupeReport: LogAnalysisReport = {
      ...base,
      visibleDevices: [4, 5],
      detectedRanks: [0, 1],
      firstFaultVerdict: {
        ...base.firstFaultVerdict,
        timelineEvents: [
          {
            id: "r0",
            lineNumber: 1,
            timestamp: "10:00:00",
            timestampMs: 1000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "memory-oom",
            signalTag: "OOM",
            rawLine: "group=prefill [Rank 0] OOM",
            groupTag: "prefill",
          } as LogAnalysisReport["firstFaultVerdict"]["timelineEvents"] extends ReadonlyArray<infer T>
            ? T
            : never,
          {
            id: "d1",
            lineNumber: 2,
            timestamp: "10:00:01",
            timestampMs: 2000,
            rank: 1,
            rankSource: "explicit-rank",
            slotMappable: false,
            kind: "root-cause",
            mechanism: "link-port-down",
            peerRank: 0,
            signalTag: "RoCE",
            rawLine: "group=decode [Rank 1] RoCE port 1 down peer rank 0",
            groupTag: "decode",
          } as LogAnalysisReport["firstFaultVerdict"]["timelineEvents"] extends ReadonlyArray<infer T>
            ? T
            : never,
          {
            id: "p1",
            lineNumber: 3,
            timestamp: "10:00:02",
            timestampMs: 3000,
            rank: 1,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "link-port-down",
            peerRank: 0,
            signalTag: "RoCE",
            rawLine: "group=prefill [Rank 1] RoCE port 1 down peer rank 0",
            groupTag: "prefill",
          } as LogAnalysisReport["firstFaultVerdict"]["timelineEvents"] extends ReadonlyArray<infer T>
            ? T
            : never,
        ],
      },
    };
    const gdFrame = deriveHardwareFaultFrame(groupDedupeReport, "a2-64g", 99);
    expect(gdFrame.linkFaultMarks).toHaveLength(1);
    expect(gdFrame.linkFaultMarks[0]?.logicalRank).toBe(1);
    expect(gdFrame.rankUnits[5]?.state).toBe("root-cause");

    const initAdviceReport: LogAnalysisReport = {
      ...base,
      detectedRanks: [2],
      firstFaultVerdict: {
        rank: 2,
        confidence: "high",
        rationale: "EI0004",
        primaryEvidenceLines: [
          {
            lineNumber: 1,
            rank: 2,
            timestamp: "10:00:00",
            rawLine: "EI0004 transport init failed. Verify whether RoCE port 1 link is down",
            kind: "root-cause",
          },
        ],
        cascadeRanks: [],
        rankSource: "explicit-rank",
        slotMappable: true,
        timelineEvents: [
          {
            id: "init-advice",
            lineNumber: 1,
            timestamp: "10:00:00",
            timestampMs: 1000,
            rank: 2,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "link-transport-init",
            signalTag: "EI0004",
            rawLine:
              "10:00:00 [Rank 2] EI0004 transport init failed. Verify whether RoCE port 1 link is down",
          },
        ],
      },
    };
    expect(deriveHardwareFaultFrame(initAdviceReport, "a2-64g", 99).linkFaultMarks[0]?.kind).toBe(
      "transport-init",
    );
  });

  it("Round-5 Codex closure: preserves INFO Rank 15 in multi-instance scope, respects activeScopeDetectedRanks, and prevents prose ECONNREFUSED/RoCE from overriding authoritative mechanisms", () => {
    const base = analyzeTroubleshootInput("");

    // v4 #1a: Instance A has INFO [Rank 15] + [Rank 0] OOM; Instance B has [Rank 1] fault -> Rank 15 forces logical-only
    const info15MultiInst: LogAnalysisReport = {
      ...base,
      detectedRanks: [0, 1, 15],
      visibleDevices: [4, 5],
      firstFaultVerdict: {
        rank: 0,
        confidence: "high",
        rationale: "OOM",
        primaryEvidenceLines: [
          {
            lineNumber: 4,
            rank: 0,
            timestamp: "10:00:01",
            rawLine: "10:00:01 ERROR instance=A [Rank 0] RuntimeError: NPU out of memory",
            kind: "root-cause",
          },
        ],
        cascadeRanks: [],
        rankSource: "explicit-rank",
        slotMappable: true,
        instanceTag: "A",
        timelineEvents: [
          {
            id: "a0",
            lineNumber: 4,
            timestamp: "10:00:01",
            timestampMs: 1000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "memory-oom",
            signalTag: "NPU HBM OOM",
            rawLine: "10:00:01 ERROR instance=A [Rank 0] RuntimeError: NPU out of memory",
            instanceTag: "A",
          },
          {
            id: "b1",
            lineNumber: 5,
            timestamp: "10:00:02",
            timestampMs: 2000,
            rank: 1,
            rankSource: "explicit-rank",
            slotMappable: false,
            kind: "root-cause",
            mechanism: "link-port-down",
            signalTag: "RoCE",
            rawLine: "10:00:02 ERROR instance=B [Rank 1] HCCL RoCE port 1 link down",
            instanceTag: "B",
          },
        ],
      },
    };
    expect(deriveHardwareFaultFrame(info15MultiInst, "a2-64g", 99).mappingMode).toBe("logical-only");

    // v4 #1b: activeScopeDetectedRanks distinguishes A with INFO [Rank 1] ready ([0,1]) vs without ([0])
    const readyRank1MultiInst: LogAnalysisReport = {
      ...info15MultiInst,
      detectedRanks: [0, 1],
      activeScopeDetectedRanks: [0, 1],
    };
    const withoutReadyRank1MultiInst: LogAnalysisReport = {
      ...info15MultiInst,
      detectedRanks: [0, 1],
      activeScopeDetectedRanks: [0],
    };
    const frameWithReady = deriveHardwareFaultFrame(readyRank1MultiInst, "a2-64g", 99);
    const frameWithoutReady = deriveHardwareFaultFrame(withoutReadyRank1MultiInst, "a2-64g", 99);
    expect(frameWithReady.mappingMode).toBe("single-node-mapped");
    expect(frameWithReady.rankUnits[5]?.state).toBe("participating");
    expect(frameWithReady.rankUnits[5]?.statusLabel).toBe("参与运行");
    expect(frameWithoutReady.rankUnits[5]?.state).toBe("idle");
    expect(frameWithoutReady.rankUnits[5]?.statusLabel).toBe("可见待命");

    // v4 #2: Diagnostic prose mentioning ECONNREFUSED or RoCE must not override authoritative mechanism
    const oomProseRefused = analyzeTroubleshootInput(
      "10:00:00 [Rank 2] ERROR RuntimeError: NPU out of memory. Do not confuse with ECONNREFUSED",
    );
    const oomProseFrame = deriveHardwareFaultFrame(oomProseRefused, "a2-64g", 99);
    expect(oomProseFrame.rankUnits[2]?.state).toBe("root-cause");
    expect(oomProseFrame.rankUnits[2]?.faultMechanism).toBe("general-root");

    const initWithRefusedAndBindWithRoce: LogAnalysisReport = {
      ...base,
      detectedRanks: [1, 2],
      firstFaultVerdict: {
        rank: 1,
        confidence: "high",
        rationale: "bind",
        primaryEvidenceLines: [
          {
            lineNumber: 1,
            rank: 1,
            timestamp: "10:00:00",
            rawLine: "RaSocketBind failed; verify whether RoCE port 1 link is down",
            kind: "root-cause",
          },
        ],
        cascadeRanks: [],
        rankSource: "explicit-rank",
        slotMappable: true,
        timelineEvents: [
          {
            id: "bind-roce-prose",
            lineNumber: 1,
            timestamp: "10:00:00",
            timestampMs: 1000,
            rank: 1,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "link-bind-fault",
            signalTag: "RaSocketBind",
            rawLine: "RaSocketBind failed on eth9; verify whether RoCE port 1 link is down",
          },
          {
            id: "init-refused-prose",
            lineNumber: 2,
            timestamp: "10:00:01",
            timestampMs: 2000,
            rank: 2,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "link-transport-init",
            signalTag: "EI0004",
            rawLine: "EI0004 transport init failed (note: distinct from ECONNREFUSED)",
          },
        ],
      },
    };
    const mechFrame = deriveHardwareFaultFrame(initWithRefusedAndBindWithRoce, "a2-64g", 99);
    expect(mechFrame.linkFaultMarks.find((m) => m.rank === 1)?.kind).toBe("nic-bind-or-route");
    expect(mechFrame.linkFaultMarks.find((m) => m.rank === 1)?.ifaceOrPort).toBe("eth9");
    expect(mechFrame.linkFaultMarks.find((m) => m.rank === 2)?.kind).toBe("transport-init");
    expect(mechFrame.linkFaultMarks.find((m) => m.rank === 2)?.ifaceOrPort).toBeNull();
  });

  it("Round-6 Codex closure: authoritative non-link mechanism beats hccl-link ruleId and advice clauses never steal bind/route ifaceOrPort", () => {
    const base = analyzeTroubleshootInput("");

    // v5 #9: mechanism="memory-oom" MUST beat ruleId="hccl-link-or-ifname-fault" + advice mentioning RoCE port 1
    const oomRuleConflict: LogAnalysisReport = {
      ...base,
      detectedRanks: [0],
      firstFaultVerdict: {
        rank: 0,
        confidence: "high",
        rationale: "oom",
        primaryEvidenceLines: [
          {
            lineNumber: 1,
            rank: 0,
            timestamp: "10:00:00",
            rawLine: "10:00:00 [Rank 0] NPU out of memory. Advice: check whether RoCE port 1 link is down",
            kind: "root-cause",
          },
        ],
        cascadeRanks: [],
        rankSource: "explicit-rank",
        slotMappable: true,
        timelineEvents: [
          {
            id: "oom-vs-rule",
            lineNumber: 1,
            timestamp: "10:00:00",
            timestampMs: 1000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            ruleId: "hccl-link-or-ifname-fault",
            mechanism: "memory-oom",
            signalTag: "NPU HBM OOM",
            rawLine: "10:00:00 [Rank 0] NPU out of memory. Advice: check whether RoCE port 1 link is down",
          },
        ],
      },
    };
    const oomConflictFrame = deriveHardwareFaultFrame(oomRuleConflict, "a2-64g", 99);
    expect(oomConflictFrame.rankUnits[0]?.faultMechanism).toBe("general-root");
    expect(oomConflictFrame.linkFaultMarks).toHaveLength(0);

    // v5 #10: typed link-bind-fault without structured ifaceOrPort extracts eth9 before advice RoCE port 1
    const bindClauseOnly: LogAnalysisReport = {
      ...base,
      detectedRanks: [1],
      firstFaultVerdict: {
        rank: 1,
        confidence: "high",
        rationale: "bind",
        primaryEvidenceLines: [
          {
            lineNumber: 1,
            rank: 1,
            timestamp: "10:00:00",
            rawLine: "RaSocketBind failed on eth9; verify whether RoCE port 1 link is down",
            kind: "root-cause",
          },
        ],
        cascadeRanks: [],
        rankSource: "explicit-rank",
        slotMappable: true,
        timelineEvents: [
          {
            id: "bind-no-iface-field",
            lineNumber: 1,
            timestamp: "10:00:00",
            timestampMs: 1000,
            rank: 1,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "link-bind-fault",
            signalTag: "RaSocketBind",
            rawLine: "RaSocketBind failed on eth9, verify whether RoCE port 1 link is down",
          },
        ],
      },
    };
    const bindFrame = deriveHardwareFaultFrame(bindClauseOnly, "a2-64g", 99);
    expect(bindFrame.linkFaultMarks[0]?.kind).toBe("nic-bind-or-route");
    expect(bindFrame.linkFaultMarks[0]?.ifaceOrPort).toBe("eth9");
    expect(bindFrame.rankUnits[1]?.ifaceOrPort).toBe("eth9");

    // v6 P2-2: Duplicate same-rank memory-oom preserves explicitly designated primary evidence line L2
    const dupOomWinL2: LogAnalysisReport = {
      ...base,
      detectedRanks: [0],
      firstFaultVerdict: {
        rank: 0,
        confidence: "high",
        rationale: "L2 primary",
        primaryEvidenceLines: [
          {
            lineNumber: 2,
            rank: 0,
            timestamp: "10:00:01",
            rawLine: "10:00:01 [Rank 0] ERROR RuntimeError: NPU out of memory (root)",
            kind: "root-cause",
          },
        ],
        cascadeRanks: [],
        rankSource: "explicit-rank",
        slotMappable: true,
        timelineEvents: [
          {
            id: "oom-1",
            lineNumber: 1,
            timestamp: "10:00:00",
            timestampMs: 1000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "memory-oom",
            signalTag: "NPU OOM",
            rawLine: "10:00:00 [Rank 0] ERROR RuntimeError: NPU out of memory (secondary)",
          },
          {
            id: "oom-2",
            lineNumber: 2,
            timestamp: "10:00:01",
            timestampMs: 2000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "memory-oom",
            signalTag: "NPU OOM",
            rawLine: "10:00:01 [Rank 0] ERROR RuntimeError: NPU out of memory (root)",
          },
        ],
      },
    };
    const dupFrame = deriveHardwareFaultFrame(dupOomWinL2, "a2-64g", 99);
    expect(dupFrame.rankUnits[0]?.evidenceLineNumber).toBe(2);
    expect(dupFrame.rankUnits[0]?.statusLabel).toBe("首错真凶 · L2");

    // v8 P2-3: Unmapped explicit peerRank (e.g. peerRank=15 on visibleDevices=[4,5]) must NOT blame root Rank 0
    const unmappedPeerCascade: LogAnalysisReport = {
      ...base,
      visibleDevices: [4, 5],
      detectedRanks: [0, 1],
      firstFaultVerdict: {
        rank: 0,
        confidence: "high",
        rationale: "Rank 0 root",
        primaryEvidenceLines: [
          {
            lineNumber: 1,
            rank: 0,
            timestamp: "10:00:00",
            rawLine: "10:00:00 [Rank 0] ERROR RuntimeError: NPU out of memory",
            kind: "root-cause",
          },
        ],
        cascadeRanks: [1],
        rankSource: "explicit-rank",
        slotMappable: true,
        timelineEvents: [
          {
            id: "r0-root",
            lineNumber: 1,
            timestamp: "10:00:00",
            timestampMs: 1000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "memory-oom",
            signalTag: "NPU OOM",
            rawLine: "10:00:00 [Rank 0] ERROR RuntimeError: NPU out of memory",
          },
          {
            id: "r1-peer15",
            lineNumber: 2,
            timestamp: "10:00:10",
            timestampMs: 11000,
            rank: 1,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "confirmed-cascade",
            mechanism: "link-establish-timeout",
            peerRank: 15,
            signalTag: "EI0006",
            rawLine: "10:00:10 [Rank 1] ERROR EI0006 Getting socket times out connecting to rank 15",
          },
        ],
      },
    };
    const peer15Frame = deriveHardwareFaultFrame(unmappedPeerCascade, "a2-64g", 99);
    expect(peer15Frame.waitingArcs).toHaveLength(0);
    expect(peer15Frame.rankUnits[5]?.waitingOnRank).toBeNull();
    expect(peer15Frame.rankUnits[5]?.statusLabel).toContain("Rank 15");
    expect(peer15Frame.rankUnits[5]?.statusLabel).not.toContain("Rank 0");

    // v9 P2-7: Distinct link-bind-fault vs link-route-fault on same eth9/peer preserve both marks & primary L4 priority
    const bindAndRoutePrimaryL4: LogAnalysisReport = {
      ...base,
      detectedRanks: [0, 1],
      firstFaultVerdict: {
        rank: 0,
        confidence: "high",
        rationale: "L4 route fault primary",
        primaryEvidenceLines: [
          {
            lineNumber: 4,
            rank: 0,
            timestamp: "10:00:02",
            rawLine: "10:00:02 [Rank 0] ERROR eth9 no route to peer rank 1",
            kind: "root-cause",
          },
        ],
        cascadeRanks: [],
        rankSource: "explicit-rank",
        slotMappable: true,
        timelineEvents: [
          {
            id: "br-1",
            lineNumber: 3,
            timestamp: "10:00:01",
            timestampMs: 1000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "link-bind-fault",
            iface: "eth9",
            peerRank: 1,
            signalTag: "RaSocketBind",
            rawLine: "10:00:01 [Rank 0] ERROR RaSocketBind eth9 failed peer rank 1",
          },
          {
            id: "br-2",
            lineNumber: 4,
            timestamp: "10:00:02",
            timestampMs: 2000,
            rank: 0,
            rankSource: "explicit-rank",
            slotMappable: true,
            kind: "root-cause",
            mechanism: "link-route-fault",
            iface: "eth9",
            peerRank: 1,
            signalTag: "No route to host",
            rawLine: "10:00:02 [Rank 0] ERROR eth9 no route to peer rank 1",
          },
        ],
      },
    };
    const brFrame = deriveHardwareFaultFrame(bindAndRoutePrimaryL4, "a2-64g", 99);
    expect(brFrame.rankUnits[0]?.evidenceLineNumber).toBe(4);
    expect(brFrame.linkFaultMarks.map((m) => m.lineNumber)).toEqual([3, 4]);
  });

  it("Post-merge seam closure: respects explicit null hostTag on remote host= prose and labels local peer with uncertain timing", () => {
    const remoteHostBodyLog = [
      "10:00:00 [Rank 0] ERROR RuntimeError: remote host=a failed",
      "10:00:01 [Rank 1] ERROR EI0006 Getting socket times out, peer rank 0",
    ].join("\n");
    const remoteRep = analyzeTroubleshootInput(remoteHostBodyLog);
    const remoteFrame = deriveHardwareFaultFrame(remoteRep, "a2-64g", 99);
    expect(remoteFrame.rankUnits[1]?.state).toBe("confirmed-cascade");
    expect(remoteFrame.waitingArcs).toEqual([{ fromRank: 1, toRank: 0, lineNumber: 2 }]);

    const uncertainLocalPeerRep = analyzeTroubleshootInput(
      [
        "10:00:02 [Rank 0] ERROR RaSocketBind failed on eth9",
        "10:00:01 [Rank 1] ERROR ECONNREFUSED connecting to peer rank 0",
      ].join("\n"),
    );
    const uncertainFrame = deriveHardwareFaultFrame(uncertainLocalPeerRep, "a2-64g", 99);
    expect(uncertainFrame.rankUnits[1]?.statusLabel).toContain("时序待核");
    expect(uncertainFrame.rankUnits[1]?.statusLabel).not.toContain("跨节点/未映射");
  });
});
