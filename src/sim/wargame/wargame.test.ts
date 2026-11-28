import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSourceRef } from "../rules";
import { judgeWarGameSubmission, parseDottedJsonValue } from "./judge";
import {
  DEFAULT_WARGAME_SCENARIO_ID,
  getWarGameScenario,
  isWarGameScenarioId,
  WARGAME_SCENARIO_IDS,
  WARGAME_SCENARIOS,
} from "./scenarios";

const here = dirname(fileURLToPath(import.meta.url));

describe("Track 3B wargame scenarios & deterministic anti-cheat judge", () => {
  it("enforces sim-layer purity (no React, Zustand, content, or app imports) and 8 scenario contracts", () => {
    for (const rel of ["./scenarios.ts", "./judge.ts"]) {
      const src = readFileSync(resolve(here, rel), "utf8");
      expect(src).not.toMatch(/from\s+["']react/);
      expect(src).not.toMatch(/from\s+["']zustand/);
      expect(src).not.toMatch(/from\s+["'][^"']*(?:content|app)\//);
    }

    expect(WARGAME_SCENARIOS).toHaveLength(8);
    expect(WARGAME_SCENARIO_IDS).toEqual([
      "rank3-oom-ei0006",
      "910b3-u090-aclgraph-oom",
      "metrics-preemption-avalanche",
      "legacy-v030-silent-degrade",
      "exit-137-cgroup-sigkill",
      "pd-mooncake-kv-mismatch",
      "a3-dual-die-static-kernel-trap",
      "a3-pd-mc2-buffsize-ifname-trap",
    ]);
    expect(isWarGameScenarioId(DEFAULT_WARGAME_SCENARIO_ID)).toBe(true);
    expect(isWarGameScenarioId("non-existent")).toBe(false);
    expect(getWarGameScenario("non-existent").id).toBe(DEFAULT_WARGAME_SCENARIO_ID);

    for (const sc of WARGAME_SCENARIOS) {
      expect(sc.question.options).toHaveLength(4);
      expect(sc.hints).toHaveLength(3);
      // Anti-spoiler: hints must never state "选 B" / "选 C" option letters
      for (const h of sc.hints) {
        expect(h).not.toMatch(/选项\s*[ABCD]|选\s*[ABCD]\b/);
      }
      expect(sc.debrief.sourceAnchors.length).toBeGreaterThanOrEqual(2);
      for (const anchor of sc.debrief.sourceAnchors) {
        expect(parseSourceRef(anchor.ref)).not.toBeNull();
      }
      expect(sc.debrief.wikiRefs.length).toBeGreaterThanOrEqual(2);

      // Initial broken command must NEVER pass even if the quiz option is answered right
      const initialRes = judgeWarGameSubmission({
        scenarioId: sc.id,
        selectedOptionId: sc.question.correctOptionId,
        commandText: sc.initialCommand,
        decodeCommandText: sc.initialDecodeCommand,
      });
      expect(initialRes.passed).toBe(false);
      expect(initialRes.unlockedDebrief).toBeNull();
    }
  });

  it("judges Scenario 1 (rank3-oom-ei0006) and Scenario 2 (910b3-u090-aclgraph-oom) with strict anti-cheat", () => {
    const sc1 = getWarGameScenario("rank3-oom-ei0006");
    const fixed1 = sc1.initialCommand.replace(
      "--gpu-memory-utilization 0.96",
      "--gpu-memory-utilization 0.88",
    );

    // Passing solution
    const pass1 = judgeWarGameSubmission({
      scenarioId: "rank3-oom-ei0006",
      selectedOptionId: "B",
      commandText: fixed1,
    });
    expect(pass1.passed).toBe(true);
    expect(pass1.oomStatus).toBe("ok");
    expect(pass1.unlockedDebrief).not.toBeNull();

    // Anti-cheat: wrong quiz option
    expect(
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "A",
        commandText: fixed1,
      }).passed,
    ).toBe(false);

    // Anti-cheat: typo flag `--gpu-mem-util 0.88`
    const typo1 = `${fixed1} --gpu-mem-util 0.88`;
    const typoRes1 = judgeWarGameSubmission({
      scenarioId: "rank3-oom-ei0006",
      selectedOptionId: "B",
      commandText: typo1,
    });
    expect(typoRes1.passed).toBe(false);
    expect(typoRes1.checks.find((c) => c.id === "cli-syntax-and-unknown-flags")?.passed).toBe(false);

    // Anti-cheat: model swap to Qwen/Qwen3-8B or dropping EP
    expect(
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: fixed1.replace("/models/Qwen3-30B-A3B-W8A8", "Qwen/Qwen3-8B"),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: fixed1.replace("--enable-expert-parallel", ""),
      }).passed,
    ).toBe(false);

    // Scenario 2: both valid routes pass, while `--enforce-eager` or u=0.90 under FULL_AND_PIECEWISE fails
    const sc2 = getWarGameScenario("910b3-u090-aclgraph-oom");
    const routeA2 = sc2.initialCommand.replace(
      "--gpu-memory-utilization 0.95",
      "--gpu-memory-utilization 0.88",
    );
    const pass2A = judgeWarGameSubmission({
      scenarioId: "910b3-u090-aclgraph-oom",
      selectedOptionId: "C",
      commandText: routeA2,
    });
    expect(pass2A.passed).toBe(true);
    expect(pass2A.oomStatus).toBe("ok");

    const routeB2 = sc2.initialCommand
      .replace("--gpu-memory-utilization 0.95", "--gpu-memory-utilization 0.90")
      .replace("FULL_AND_PIECEWISE", "FULL_DECODE_ONLY");
    const pass2B = judgeWarGameSubmission({
      scenarioId: "910b3-u090-aclgraph-oom",
      selectedOptionId: "C",
      commandText: routeB2,
    });
    expect(pass2B.passed).toBe(true);
    expect(pass2B.oomStatus).toBe("ok");

    // Anti-cheat: adding `--enforce-eager` or `cudagraph_mode: "NONE"` MUST be rejected
    expect(
      judgeWarGameSubmission({
        scenarioId: "910b3-u090-aclgraph-oom",
        selectedOptionId: "C",
        commandText: `${routeA2} --enforce-eager`,
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "910b3-u090-aclgraph-oom",
        selectedOptionId: "C",
        commandText: sc2.initialCommand.replace(
          "--gpu-memory-utilization 0.95",
          "--gpu-memory-utilization 0.90",
        ),
      }).passed,
    ).toBe(false);
  });

  it("judges Scenarios 3, 4, 5, and 6 and blocks retired env, JSON typos, CUDA env, and PD mismatches", () => {
    // Scenario 3: /metrics preemption avalanche -> converge max-num-seqs <= 128, u in 0.86~0.90, enable prefix caching
    const sc3 = getWarGameScenario("metrics-preemption-avalanche");
    const halfFixed3 = sc3.initialCommand.replace("--max-num-seqs 512", "--max-num-seqs 64");
    expect(
      judgeWarGameSubmission({
        scenarioId: "metrics-preemption-avalanche",
        selectedOptionId: "B",
        commandText: halfFixed3,
      }).passed,
    ).toBe(false);

    const fixed3 = sc3.initialCommand
      .replace("--max-num-seqs 512", "--max-num-seqs 64")
      .replace("--no-enable-prefix-caching", "--enable-prefix-caching")
      .replace("--gpu-memory-utilization 0.72", "--gpu-memory-utilization 0.88");
    const pass3 = judgeWarGameSubmission({
      scenarioId: "metrics-preemption-avalanche",
      selectedOptionId: "B",
      commandText: fixed3,
    });
    expect(pass3.passed).toBe(true);
    expect(pass3.oomStatus).toBe("ok");

    // Scenario 4: v0.30.0 retired VLLM_ASCEND_ENABLE_NZ + --enforce-eager -> weight_nz_mode:0 + graph mode
    const sc4 = getWarGameScenario("legacy-v030-silent-degrade");
    expect(sc4.telemetryText).toContain("1,840 tok/s");
    expect(sc4.telemetryText).toContain("790 tok/s");
    const fixed4 = sc4.initialCommand
      .replace("export VLLM_ASCEND_ENABLE_NZ=0\n", "")
      .replace("--enforce-eager", `--additional-config '{"weight_nz_mode":0}'`);
    const pass4 = judgeWarGameSubmission({
      scenarioId: "legacy-v030-silent-degrade",
      selectedOptionId: "C",
      commandText: fixed4,
    });
    expect(pass4.passed).toBe(true);
    expect(pass4.oomStatus).toBe("ok");

    // Keeping retired env var or misspelling JSON key `weight_nz_mod` must fail
    expect(
      judgeWarGameSubmission({
        scenarioId: "legacy-v030-silent-degrade",
        selectedOptionId: "C",
        commandText: `export VLLM_ASCEND_ENABLE_NZ=0\n${fixed4}`,
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "legacy-v030-silent-degrade",
        selectedOptionId: "C",
        commandText: fixed4.replace("weight_nz_mode", "weight_nz_mod"),
      }).passed,
    ).toBe(false);

    // Scenario 5: exit 137 -> MUST fix BOTH docker --shm-size/--memory AND ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
    const sc5 = getWarGameScenario("exit-137-cgroup-sigkill");
    // Only renaming CUDA_VISIBLE_DEVICES while leaving --shm-size=64m --memory=32g MUST FAIL (P2-10 regression)
    const onlyEnvFixed5 = sc5.initialCommand.replace(
      "CUDA_VISIBLE_DEVICES=0,1,2,3",
      "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3",
    );
    expect(
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: onlyEnvFixed5,
      }).passed,
    ).toBe(false);

    const fixed5 = onlyEnvFixed5
      .replace("--shm-size=64m", "--shm-size=16g")
      .replace("--memory=32g", "--memory=128g");
    const pass5 = judgeWarGameSubmission({
      scenarioId: "exit-137-cgroup-sigkill",
      selectedOptionId: "B",
      commandText: fixed5,
    });
    expect(pass5.passed).toBe(true);
    expect(pass5.oomStatus).toBe("ok");

    // Duplicate device IDs 0,0,0,0 or wildly slashing u=0.45 must fail
    expect(
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: fixed5.replace("ASCEND_RT_VISIBLE_DEVICES=0,1,2,3", "ASCEND_RT_VISIBLE_DEVICES=0,0,0,0"),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: fixed5.replace("--gpu-memory-utilization 0.90", "--gpu-memory-utilization 0.45"),
      }).passed,
    ).toBe(false);

    // Scenario 6: PD Mooncake -> fix P (kv_producer) and D (TP=8 -> TP=2, kv_consumer, drop --kv-cache-dtype int8)
    const sc6 = getWarGameScenario("pd-mooncake-kv-mismatch");
    const fixed6P = sc6.initialCommand.replace('"kv_role":"kv_consumer"', '"kv_role":"kv_producer"');
    const fixed6D = (sc6.initialDecodeCommand ?? "")
      .replace("--tensor-parallel-size 8", "--tensor-parallel-size 2")
      .replace('"kv_role":"kv_producer"', '"kv_role":"kv_consumer"')
      .replace("    --kv-cache-dtype int8 \\\n", "");
    const pass6 = judgeWarGameSubmission({
      scenarioId: "pd-mooncake-kv-mismatch",
      selectedOptionId: "B",
      commandText: fixed6P,
      decodeCommandText: fixed6D,
    });
    expect(pass6.passed).toBe(true);
    expect(pass6.oomStatus).toBe("ok");
    expect(pass6.pdDoctor?.errors).toHaveLength(0);

    // P1-4 Anti-cheat regressions: bogus --dtype, bogus cudagraph_mode, UnknownConnector, and Decode TP=1 MUST ALL FAIL
    const sc2 = getWarGameScenario("910b3-u090-aclgraph-oom");
    const valid2 = sc2.initialCommand.replace(
      "--gpu-memory-utilization 0.95",
      "--gpu-memory-utilization 0.88",
    );
    expect(
      judgeWarGameSubmission({
        scenarioId: "910b3-u090-aclgraph-oom",
        selectedOptionId: "C",
        commandText: `${valid2} --dtype nonsense`,
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "910b3-u090-aclgraph-oom",
        selectedOptionId: "C",
        commandText: valid2.replace("FULL_AND_PIECEWISE", "BOGUS_MODE"),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "pd-mooncake-kv-mismatch",
        selectedOptionId: "B",
        commandText: fixed6P.replace("MooncakeConnectorV1", "UnknownConnector"),
        decodeCommandText: fixed6D.replace("MooncakeConnectorV1", "UnknownConnector"),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "pd-mooncake-kv-mismatch",
        selectedOptionId: "B",
        commandText: fixed6P,
        decodeCommandText: fixed6D
          .replace("ASCEND_RT_VISIBLE_DEVICES=4,5", "ASCEND_RT_VISIBLE_DEVICES=4")
          .replace("--tensor-parallel-size 2", "--tensor-parallel-size 1"),
      }).passed,
    ).toBe(false);

    // Anti-cheat: kv_both or empty command must fail
    expect(
      judgeWarGameSubmission({
        scenarioId: "pd-mooncake-kv-mismatch",
        selectedOptionId: "B",
        commandText: fixed6P.replace('"kv_producer"', '"kv_both"'),
        decodeCommandText: fixed6D,
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: "   ",
      }).passed,
    ).toBe(false);

    // Review closures: valid v0.30.0 additional_config key (enable_cpu_binding) passes, while PCP=2 rank inflation is rejected
    const sc1 = getWarGameScenario("rank3-oom-ei0006");
    const fixed1WithCpuBind = `${sc1.initialCommand.replace("0.96", "0.88")} --additional-config '{"enable_cpu_binding":true}'`;
    expect(
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: fixed1WithCpuBind,
      }).passed,
    ).toBe(true);

    const pcpInflated1 = `export VLLM_USE_V2_MODEL_RUNNER=1\n${sc1.initialCommand
      .replace("0,1,2,3", "0,1,2,3,4,5,6,7")
      .replace("0.96", "0.88")} --prefill-context-parallel-size 2`;
    const pcpRes = judgeWarGameSubmission({
      scenarioId: "rank3-oom-ei0006",
      selectedOptionId: "B",
      commandText: pcpInflated1,
    });
    expect(pcpRes.passed).toBe(false);
    expect(pcpRes.checks.find((c) => c.id === "target-model-and-topology")?.passed).toBe(false);

    // Round-2 closures: Case 5 quoted Docker flags, Case 6 extra_config.decode.tp_size tamper, and Case 2 --dtype float32
    const base5 = sc5.initialCommand.replace(
      "CUDA_VISIBLE_DEVICES=0,1,2,3",
      "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3",
    );
    expect(
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: base5
          .replace("--shm-size=64m", '--shm-size="16g"')
          .replace("--memory=32g", '--memory="128g"'),
      }).passed,
    ).toBe(true);
    expect(
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: base5.replace("--shm-size=64m", '--shm-size="16g"').replace("--memory=32g", "-m32g"),
      }).passed,
    ).toBe(false);

    expect(
      judgeWarGameSubmission({
        scenarioId: "pd-mooncake-kv-mismatch",
        selectedOptionId: "B",
        commandText: fixed6P,
        decodeCommandText: fixed6D.replace('"decode":{"tp_size":2', '"decode":{"tp_size":8'),
      }).passed,
    ).toBe(false);

    expect(
      judgeWarGameSubmission({
        scenarioId: "910b3-u090-aclgraph-oom",
        selectedOptionId: "C",
        commandText: `${sc2.initialCommand.replace("0.95", "0.88")} --dtype float32`,
      }).passed,
    ).toBe(false);

    // Wave 1 P1-4: Case 2 separates 0.6B [M] stack from 8B [C] adapted scenario; Case 5 avoids claiming 铁证 without kernel/cgroup OOM evidence
    expect(sc2.evidenceBadge).toBe("C");
    expect(sc2.telemetryText).toContain("Qwen3-0.6B");
    expect(sc5.question.explanation).not.toContain("铁证");
    expect(sc5.hints.join(" ")).not.toContain("真凶");
    expect(sc5.debrief.rootCauseChain).toMatch(/dmesg|OOMKilled|memory\.events/);
    const lowU5 = judgeWarGameSubmission({
      scenarioId: "exit-137-cgroup-sigkill",
      selectedOptionId: "B",
      commandText: base5
        .replace("--shm-size=64m", '--shm-size="16g"')
        .replace("--memory=32g", '--memory="128g"')
        .replace("--gpu-memory-utilization 0.90", "--gpu-memory-utilization 0.70"),
    });
    expect(lowU5.passed).toBe(false);
    expect(lowU5.checks.map((c) => c.detail).join(" ")).not.toContain("137 属容器 DRAM/shm 问题");

    // Scenario 7 (CASE-07 community-adapted A3 dual-Die + static_kernel + PIECEWISE silent-reset trap)
    const sc7 = getWarGameScenario("a3-dual-die-static-kernel-trap");
    expect(sc7.provenanceLabel).toBe("社区案例脱敏改编");
    expect(sc7.initialCommand).toContain("/models/Qwen3-30B-A3B-W8A8");
    const fixed7 = sc7.initialCommand
      .replace("ASCEND_RT_VISIBLE_DEVICES=0", "ASCEND_RT_VISIBLE_DEVICES=0,1")
      .replace("--gpu-memory-utilization 0.96", "--gpu-memory-utilization 0.88")
      .replace('"cudagraph_mode":"PIECEWISE"', '"cudagraph_mode":"FULL_DECODE_ONLY"')
      .replace(
        '{"enable_npugraph_ex":false,"enable_static_kernel":true}',
        '{"enable_npugraph_ex":true,"enable_static_kernel":true}',
      );
    const pass7 = judgeWarGameSubmission({
      scenarioId: "a3-dual-die-static-kernel-trap",
      selectedOptionId: "C",
      commandText: fixed7,
    });
    expect(pass7.passed).toBe(true);
    expect(pass7.oomStatus).toBe("ok");

    // v0.30.0 default True: omitting enable_npugraph_ex while keeping enable_static_kernel:true is ALSO accepted
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-dual-die-static-kernel-trap",
        selectedOptionId: "C",
        commandText: fixed7.replace(
          '{"enable_npugraph_ex":true,"enable_static_kernel":true}',
          '{"enable_static_kernel":true}',
        ),
      }).passed,
    ).toBe(true);

    // Near-miss 7A: cross-card odd pairing 0,2 or out-of-range 100,101 rejected on A3 dual-Die (0..15)
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-dual-die-static-kernel-trap",
        selectedOptionId: "C",
        commandText: fixed7.replace("ASCEND_RT_VISIBLE_DEVICES=0,1", "ASCEND_RT_VISIBLE_DEVICES=0,2"),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-dual-die-static-kernel-trap",
        selectedOptionId: "C",
        commandText: fixed7.replace("ASCEND_RT_VISIBLE_DEVICES=0,1", "ASCEND_RT_VISIBLE_DEVICES=100,101"),
      }).passed,
    ).toBe(false);

    // Near-miss 7B: leaving PIECEWISE silently resets npugraph_ex / static_kernel -> rejected
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-dual-die-static-kernel-trap",
        selectedOptionId: "C",
        commandText: fixed7.replace('"FULL_DECODE_ONLY"', '"PIECEWISE"'),
      }).passed,
    ).toBe(false);

    // Near-miss 7C: deleting enable_static_kernel or leaving enable_npugraph_ex:false -> rejected
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-dual-die-static-kernel-trap",
        selectedOptionId: "C",
        commandText: fixed7.replace(
          '{"enable_npugraph_ex":true,"enable_static_kernel":true}',
          '{"enable_npugraph_ex":true}',
        ),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-dual-die-static-kernel-trap",
        selectedOptionId: "C",
        commandText: fixed7.replace(
          '{"enable_npugraph_ex":true,"enable_static_kernel":true}',
          '{"enable_npugraph_ex":false,"enable_static_kernel":true}',
        ),
      }).passed,
    ).toBe(false);
  });

  it("judges Scenario 8 (a3-pd-mc2-buffsize-ifname-trap) cross-layer P/D fixes and blocks 20+ cheat/bypass cases", () => {
    const sc8 = getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap");
    expect(sc8.order).toBe(8);
    expect(sc8.code).toBe("CASE-08");
    expect(sc8.topology).toBe("pd");
    expect(sc8.telemetryText).toContain("EI0002 Notify wait execute timeout");
    expect(sc8.telemetryText).not.toContain("EI0006 Notify wait execute timeout");
    expect(sc8.telemetryText).not.toContain("fallback NIC eth9");
    expect(sc8.question.prompt).toContain("时间戳最晚的记录（10:00:10）报出 node-D Rank 0");
    expect(sc8.question.prompt).not.toContain("日志尾行报出 node-D Rank 0");
    expect(sc8.telemetryText).toContain("RaSocket");
    expect(sc8.telemetryText).toContain("HCCL_BUFFSIZE=8MB");

    const fixed8P = sc8.initialCommand
      .replace(
        "HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9",
        "HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0",
      )
      .replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11");
    const fixed8D = (sc8.initialDecodeCommand ?? "").replace("HCCL_BUFFSIZE=8", "HCCL_BUFFSIZE=128");

    // 1. Golden solution passes
    const pass8 = judgeWarGameSubmission({
      scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
      selectedOptionId: "C",
      commandText: fixed8P,
      decodeCommandText: fixed8D,
    });
    expect(pass8.passed).toBe(true);
    expect(pass8.oomStatus).toBe("ok");
    expect(pass8.pdDoctor?.errors).toHaveLength(0);
    expect(pass8.pdDoctor?.prefill.moeCommSelection?.method).toBe("FUSED_MC2");
    expect(pass8.pdDoctor?.decode.moeCommSelection?.method).toBe("FUSED_MC2");
    expect(pass8.unlockedDebrief).not.toBeNull();

    // 2. Equivalent valid variants: `=enp65s0f0`, reordered `-tp 2 -q ascend`, inline env, and `FULL` @ u=0.85
    const eqP = `ASCEND_RT_VISIBLE_DEVICES=0,1 HCCL_SOCKET_IFNAME==enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0 HCCL_IF_IP=192.0.2.11 HCCL_BUFFSIZE=128 vllm serve /models/Qwen3-30B-A3B-W8A8 -q ascend -tp 2 --enable-expert-parallel --max-num-batched-tokens 2048 --max-num-seqs 128 --max-model-len 16384 --gpu-memory-utilization 0.85 --additional-config '{"enable_fused_mc2":1}' --compilation-config '{"cudagraph_mode":"FULL"}' --kv-transfer-config '{"kv_role":"kv_producer","kv_connector":"MooncakeConnectorV1","kv_connector_extra_config":{"decode":{"dp_size":1,"pp_size":1,"tp_size":2},"prefill":{"dp_size":1,"tp_size":2}}}'`;
    const eqD = fixed8D
      .replace("HCCL_SOCKET_IFNAME=enp65s0f0", 'HCCL_SOCKET_IFNAME="=enp65s0f0"')
      .replace('"FULL_DECODE_ONLY"', '"FULL"')
      .replace("0.88", "0.85");
    const passEq = judgeWarGameSubmission({
      scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
      selectedOptionId: "C",
      commandText: eqP,
      decodeCommandText: eqD,
    });
    expect(passEq.passed).toBe(true);

    // Valid compilation_config.mode (3 and "VLLM_COMPILE") passes
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
        selectedOptionId: "C",
        commandText: fixed8P.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","mode":3'),
        decodeCommandText: fixed8D.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","mode":"VLLM_COMPILE"'),
      }).passed,
    ).toBe(true);

    // 3. Adversarial cheat/bypass negative matrix
    const negativeCases: ReadonlyArray<{
      name: string;
      option?: "A" | "B" | "C" | "D";
      pCmd?: string;
      dCmd?: string;
      failedCheck?:
        | "root-cause-choice"
        | "cli-syntax-and-unknown-flags"
        | "target-model-and-topology"
        | "config-doctor-clean"
        | "memory-and-graph-guard"
        | "scenario-specific-fix";
    }> = [
      { name: "wrong option A (timeout inflation)", option: "A", failedCheck: "root-cause-choice" },
      { name: "wrong option B (disable EP/eager)", option: "B", failedCheck: "root-cause-choice" },
      { name: "only fix D, leave P broken", pCmd: sc8.initialCommand, failedCheck: "scenario-specific-fix" },
      {
        name: "only fix P, leave D HCCL_BUFFSIZE=8",
        dCmd: sc8.initialDecodeCommand ?? "",
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "leave P HCCL_IF_IP=192.0.2.12",
        pCmd: fixed8P.replace("HCCL_IF_IP=192.0.2.11", "HCCL_IF_IP=192.0.2.12"),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "omit P HCCL_IF_IP",
        pCmd: fixed8P.replace(" HCCL_IF_IP=192.0.2.11", ""),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "swap D HCCL_IF_IP to 192.0.2.11",
        dCmd: fixed8D.replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11"),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "leave P GLOO_SOCKET_IFNAME=eth9",
        pCmd: fixed8P.replace("GLOO_SOCKET_IFNAME=enp65s0f0", "GLOO_SOCKET_IFNAME=eth9"),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "leave P HCCL_SOCKET_IFNAME=eth9",
        pCmd: fixed8P.replace("HCCL_SOCKET_IFNAME=enp65s0f0", "HCCL_SOCKET_IFNAME=eth9"),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "omit D HCCL_BUFFSIZE (rely on 200 default)",
        dCmd: fixed8D.replace(" HCCL_BUFFSIZE=128", ""),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "set D HCCL_BUFFSIZE=65535",
        dCmd: fixed8D.replace("HCCL_BUFFSIZE=128", "HCCL_BUFFSIZE=65535"),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "timeout inflation HCCL_EXEC_TIMEOUT=1800",
        pCmd: `export HCCL_EXEC_TIMEOUT=1800\n${fixed8P}`,
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "drop --quantization ascend (rely on -W8A8 path hint)",
        pCmd: fixed8P.replace("    --quantization ascend \\\n", ""),
        failedCheck: "target-model-and-topology",
      },
      {
        name: "swap model path to Qwen/Qwen3-30B-A3B",
        dCmd: fixed8D.replace("/models/Qwen3-30B-A3B-W8A8", "Qwen/Qwen3-30B-A3B"),
        failedCheck: "target-model-and-topology",
      },
      {
        name: "shrink --max-num-seqs to 64",
        dCmd: fixed8D.replace("--max-num-seqs 128", "--max-num-seqs 64"),
        failedCheck: "target-model-and-topology",
      },
      {
        name: "shrink --max-num-batched-tokens to 1024",
        pCmd: fixed8P.replace("--max-num-batched-tokens 2048", "--max-num-batched-tokens 1024"),
        failedCheck: "target-model-and-topology",
      },
      {
        name: "shrink --max-model-len to 8192",
        pCmd: fixed8P.replace("--max-model-len 16384", "--max-model-len 8192"),
        failedCheck: "target-model-and-topology",
      },
      {
        name: "cross-card ASCEND_RT_VISIBLE_DEVICES=0,2",
        pCmd: fixed8P.replace("ASCEND_RT_VISIBLE_DEVICES=0,1", "ASCEND_RT_VISIBLE_DEVICES=0,2"),
        failedCheck: "target-model-and-topology",
      },
      {
        name: "off-card ASCEND_RT_VISIBLE_DEVICES=2,3",
        dCmd: fixed8D.replace("ASCEND_RT_VISIBLE_DEVICES=0,1", "ASCEND_RT_VISIBLE_DEVICES=2,3"),
        failedCheck: "target-model-and-topology",
      },
      {
        name: "disable enable_fused_mc2=0",
        dCmd: fixed8D.replace('"enable_fused_mc2":1', '"enable_fused_mc2":0'),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "change enable_fused_mc2=2 (MegaMoe)",
        pCmd: fixed8P.replace('"enable_fused_mc2":1', '"enable_fused_mc2":2'),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "switch to PIECEWISE",
        pCmd: fixed8P.replace('"FULL_DECODE_ONLY"', '"PIECEWISE"'),
        failedCheck: "memory-and-graph-guard",
      },
      {
        name: "add --enforce-eager",
        dCmd: `${fixed8D} --enforce-eager`,
        failedCheck: "memory-and-graph-guard",
      },
      {
        name: "set use_cudagraph: false in compilation-config",
        pCmd: fixed8P.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","use_cudagraph":false'),
        failedCheck: "memory-and-graph-guard",
      },
      {
        name: "set u=0.92 out of 0.85..0.90 band",
        dCmd: fixed8D.replace("--gpu-memory-utilization 0.88", "--gpu-memory-utilization 0.92"),
        failedCheck: "memory-and-graph-guard",
      },
      {
        name: "set kv_role=kv_both",
        pCmd: fixed8P.replace('"kv_producer"', '"kv_both"'),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "delete kv_connector_extra_config",
        dCmd: fixed8D.replace(
          ',"kv_connector_extra_config":{"prefill":{"tp_size":2,"dp_size":1},"decode":{"tp_size":2,"dp_size":1,"pp_size":1}}',
          "",
        ),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "pass --kv-cache-dtype int8 on both sides",
        pCmd: `${fixed8P} --kv-cache-dtype int8`,
        dCmd: `${fixed8D} --kv-cache-dtype int8`,
        failedCheck: "config-doctor-clean",
      },
      {
        name: "pass --load-format dummy",
        pCmd: `${fixed8P} --load-format dummy`,
        failedCheck: "target-model-and-topology",
      },
      {
        name: "decoy second vllm serve command",
        pCmd: `${fixed8P}\nvllm serve /models/Qwen3-30B-A3B-W8A8 --tensor-parallel-size 2`,
        failedCheck: "cli-syntax-and-unknown-flags",
      },
      {
        name: "echo spoofing without real export",
        pCmd: `echo "export HCCL_IF_IP=192.0.2.11"\n${sc8.initialCommand}`,
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "bare flag fragment without vllm serve on P",
        pCmd: fixed8P.replace("vllm serve /models/Qwen3-30B-A3B-W8A8", "--model /models/Qwen3-30B-A3B-W8A8"),
        failedCheck: "cli-syntax-and-unknown-flags",
      },
      {
        name: "bare flag fragment without vllm serve on D",
        dCmd: fixed8D.replace("vllm serve /models/Qwen3-30B-A3B-W8A8", "--model /models/Qwen3-30B-A3B-W8A8"),
        failedCheck: "cli-syntax-and-unknown-flags",
      },
      {
        name: "decoy second command via builtin `command vllm serve`",
        pCmd: `${fixed8P}\ncommand vllm serve /models/other --tensor-parallel-size 2`,
        failedCheck: "cli-syntax-and-unknown-flags",
      },
      {
        name: "decoy second command via `nohup vllm serve`",
        dCmd: `${fixed8D}\nnohup vllm serve /models/other --tensor-parallel-size 2 &`,
        failedCheck: "cli-syntax-and-unknown-flags",
      },
      {
        name: "trailing space inside GLOO_SOCKET_IFNAME quotes",
        pCmd: fixed8P.replace("GLOO_SOCKET_IFNAME=enp65s0f0", 'GLOO_SOCKET_IFNAME="enp65s0f0 "'),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "trailing space inside HCCL_SOCKET_IFNAME quotes",
        dCmd: fixed8D.replace("HCCL_SOCKET_IFNAME=enp65s0f0", 'HCCL_SOCKET_IFNAME="enp65s0f0 "'),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "trailing space inside HCCL_IF_IP quotes",
        pCmd: fixed8P.replace("HCCL_IF_IP=192.0.2.11", 'HCCL_IF_IP="192.0.2.11 "'),
        failedCheck: "scenario-specific-fix",
      },
      {
        name: "invalid compilation_config.mode=12",
        pCmd: fixed8P.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","mode":12'),
        failedCheck: "cli-syntax-and-unknown-flags",
      },
      {
        name: "invalid compilation_config.mode=NO_COMPILATION",
        dCmd: fixed8D.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","mode":"NO_COMPILATION"'),
        failedCheck: "cli-syntax-and-unknown-flags",
      },
      {
        name: "empty kv_connector_module_path string",
        pCmd: fixed8P.replace(
          '"kv_connector":"MooncakeConnectorV1"',
          '"kv_connector":"MooncakeConnectorV1","kv_connector_module_path":""',
        ),
        failedCheck: "cli-syntax-and-unknown-flags",
      },
      {
        name: "whitespace-only kv_connector_module_path",
        dCmd: fixed8D.replace(
          '"kv_connector":"MooncakeConnectorV1"',
          '"kv_connector":"MooncakeConnectorV1","kv_connector_module_path":"   "',
        ),
        failedCheck: "cli-syntax-and-unknown-flags",
      },
      {
        name: "non-string kv_connector_module_path",
        pCmd: fixed8P.replace(
          '"kv_connector":"MooncakeConnectorV1"',
          '"kv_connector":"MooncakeConnectorV1","kv_connector_module_path":123',
        ),
        failedCheck: "cli-syntax-and-unknown-flags",
      },
    ];

    for (const tc of negativeCases) {
      const res = judgeWarGameSubmission({
        scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
        selectedOptionId: tc.option ?? "C",
        commandText: tc.pCmd ?? fixed8P,
        decodeCommandText: tc.dCmd ?? fixed8D,
      });
      expect(res.passed, `expected negative case "${tc.name}" to fail`).toBe(false);
      expect(res.unlockedDebrief, `expected debrief locked for "${tc.name}"`).toBeNull();
      if (tc.failedCheck) {
        expect(
          res.checks.find((c) => c.id === tc.failedCheck)?.passed,
          `expected check "${tc.failedCheck}" to fail for "${tc.name}"`,
        ).toBe(false);
      }
    }
  });

  it("closes all P1-10..13, P2, and P3 judge and scenario audit regressions", () => {
    const sc5 = getWarGameScenario("exit-137-cgroup-sigkill");
    const fixed5 = sc5.initialCommand
      .replace("CUDA_VISIBLE_DEVICES=0,1,2,3", "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3")
      .replace("--shm-size=64m", "--shm-size=16g")
      .replace("--memory=32g", "--memory=128g");

    // P1-13: CASE-05 blocks echo spoofing, post-IMAGE Docker flags, last-wins --ipc=private, and devices >= 8
    expect(
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: fixed5.replace("docker run", "echo docker run"),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: fixed5
          .replace("--shm-size=16g", "--shm-size=64m")
          .replace("quay.io/ascend/vllm-ascend:v0.30.0", "quay.io/ascend/vllm-ascend:v0.30.0 --shm-size=16g"),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: fixed5.replace("--shm-size=16g", "--ipc=host --ipc=private --shm-size=64m"),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: fixed5.replace(
          "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3",
          "ASCEND_RT_VISIBLE_DEVICES=8,9,10,11",
        ),
      }).passed,
    ).toBe(false);

    // P1-10 & P1-11 & P3: CASE-07 enforces exact checkpoint, --quantization ascend, single launch, bans dummy, and accurate debrief
    const sc7 = getWarGameScenario("a3-dual-die-static-kernel-trap");
    expect(sc7.debrief.rootCauseChain).toContain('"enable_npugraph_ex":false');
    expect(sc7.debrief.rootCauseChain).not.toContain("漏配 enable_npugraph_ex");
    const fixed7 = sc7.initialCommand
      .replace("ASCEND_RT_VISIBLE_DEVICES=0", "ASCEND_RT_VISIBLE_DEVICES=0,1")
      .replace("--gpu-memory-utilization 0.96", "--gpu-memory-utilization 0.88")
      .replace('"cudagraph_mode":"PIECEWISE"', '"cudagraph_mode":"FULL_DECODE_ONLY"')
      .replace(
        '{"enable_npugraph_ex":false,"enable_static_kernel":true}',
        '{"enable_npugraph_ex":true,"enable_static_kernel":true}',
      );
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-dual-die-static-kernel-trap",
        selectedOptionId: "C",
        commandText: fixed7.replace("    --quantization ascend \\\n", ""),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-dual-die-static-kernel-trap",
        selectedOptionId: "C",
        commandText: fixed7.replace("/models/Qwen3-30B-A3B-W8A8", "Qwen/Qwen3-30B-A3B"),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-dual-die-static-kernel-trap",
        selectedOptionId: "C",
        commandText: `${fixed7} --load-format dummy`,
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-dual-die-static-kernel-trap",
        selectedOptionId: "C",
        commandText: fixed7.replace(
          "vllm serve /models/Qwen3-30B-A3B-W8A8",
          "--model /models/Qwen3-30B-A3B-W8A8",
        ),
      }).passed,
    ).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "a3-dual-die-static-kernel-trap",
        selectedOptionId: "C",
        commandText: `${sc7.initialCommand}\n${fixed7}`,
      }).passed,
    ).toBe(false);

    // P1-10, P1-12, P2 & P3: CASE-08 heredoc/exit, first --model, invalid booleans/JSON, connector paths, valid aliases & wrappers
    const sc8 = getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap");
    const P8 = sc8.initialCommand
      .replace(
        "HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9",
        "HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0",
      )
      .replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11");
    const D8 = (sc8.initialDecodeCommand ?? "").replace("HCCL_BUFFSIZE=8", "HCCL_BUFFSIZE=128");

    const assertCase08 = (pCmd: string, dCmd: string, expected: boolean) => {
      expect(
        judgeWarGameSubmission({
          scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
          selectedOptionId: "C",
          commandText: pCmd,
          decodeCommandText: dCmd,
        }).passed,
      ).toBe(expected);
    };

    // Valid wrappers, upstream v0.30 aliases, CompilationConfig fields, and benign env forms
    assertCase08(P8.replace("vllm serve", "exec vllm serve"), D8, true);
    assertCase08(P8.replace("vllm serve", "sudo -E vllm serve"), D8, true);
    assertCase08(
      P8.replace(
        /vllm serve([\s\S]*)$/,
        (_m, rest: string) => `bash -c "vllm serve${rest.replace(/"/g, '\\"')}"`,
      ),
      D8,
      true,
    );
    assertCase08(P8.replace("--enable-expert-parallel", "-ep"), `${D8} -pcp 1 -dcp 1`, true);
    assertCase08(
      P8.replace(
        `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
        "-cc.cudagraph_mode FULL_DECODE_ONLY",
      ),
      D8.replace(
        '"FULL_DECODE_ONLY"',
        '"FULL_DECODE_ONLY","mode":"vllm_compile","cudagraph_copy_inputs":false',
      ),
      true,
    );
    assertCase08(
      P8.replace("HCCL_SOCKET_IFNAME=enp65s0f0", "HCCL_SOCKET_IFNAME=enp65s0"),
      D8.replace("HCCL_BUFFSIZE=128", "HCCL_BUFFSIZE=0128"),
      true,
    );
    assertCase08(
      P8.replace("GLOO_SOCKET_IFNAME=enp65s0f0", "GLOO_SOCKET_IFNAME=enp65s0f0,enp65s0f0"),
      D8.replace("HCCL_BUFFSIZE=128", "HCCL_BUFFSIZE=128 HCCL_CONNECT_TIMEOUT=120"),
      true,
    );
    // MooncakeConnectorV1 is resolved via vllm_ascend registry to class MooncakeConnector; explicit module_path fails getattr(mod, "MooncakeConnectorV1")
    assertCase08(
      P8.replace(
        '"kv_connector":"MooncakeConnectorV1"',
        '"kv_connector":"MooncakeConnectorV1","kv_connector_module_path":"vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_connector"',
      ),
      D8,
      false,
    );

    // Invalid shells, wrong first --model, bogus bool args, bogus earlier JSON, bogus connector/path, and removed use_cudagraph
    assertCase08(`cat <<'END'\n${P8}\nEND`, D8, false);
    assertCase08(P8.replace("vllm serve", "exit 0\nvllm serve"), D8, false);
    assertCase08(
      P8.replace(
        "vllm serve /models/Qwen3-30B-A3B-W8A8",
        "vllm serve --model /models/other --model /models/Qwen3-30B-A3B-W8A8",
      ),
      D8,
      false,
    );
    assertCase08(`${P8} --enforce-eager=false`, D8, false);
    assertCase08(P8.replace("--enable-expert-parallel", "--enable-expert-parallel true"), D8, false);
    assertCase08(
      P8.replace("--compilation-config", `--compilation-config '{"mode":"NOT_A_MODE"}' --compilation-config`),
      D8,
      false,
    );
    assertCase08(P8.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","use_cudagraph":true'), D8, false);
    assertCase08(
      P8.replace('"kv_connector":"MooncakeConnectorV1"', '"kv_connector":" MooncakeConnectorV1 "'),
      D8,
      false,
    );
    assertCase08(
      P8.replace(
        '"kv_connector":"MooncakeConnectorV1"',
        '"kv_connector":"MooncakeConnectorV1","kv_connector_module_path":"math"',
      ),
      D8,
      false,
    );
    assertCase08(P8, D8.replace("HCCL_BUFFSIZE=128", "HCCL_BUFFSIZE=128 HCCL_CONNECT_TIMEOUT=300"), false);
  });

  it("Round-3 Codex closure: enforces shell semantics, strict JSON types, HCCL_SOCKET_IFNAME exact vs prefix, docker IMAGE/command, and python-api --model", () => {
    const sc1 = getWarGameScenario("rank3-oom-ei0006");
    const fixed1 = sc1.initialCommand.replace(
      "--gpu-memory-utilization 0.96",
      "--gpu-memory-utilization 0.88",
    );
    const sc5 = getWarGameScenario("exit-137-cgroup-sigkill");
    const fixed5 = sc5.initialCommand
      .replace("CUDA_VISIBLE_DEVICES=0,1,2,3", "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3")
      .replace("--shm-size=64m", "--shm-size=16g")
      .replace("--memory=32g", "--memory=128g");
    const sc8 = getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap");
    const P8 = sc8.initialCommand
      .replace(
        "HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9",
        "HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0",
      )
      .replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11");
    const D8 = (sc8.initialDecodeCommand ?? "").replace("HCCL_BUFFSIZE=8", "HCCL_BUFFSIZE=128");

    const check08 = (p: string, d = D8) =>
      judgeWarGameSubmission({
        scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
        selectedOptionId: "C",
        commandText: p,
        decodeCommandText: d,
      }).passed;
    const check01 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check05 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;

    // Shell edge cases (P1-4, P1-5, P1-6)
    expect(check01(`cat <<\\EOF\n${fixed1}\nEOF`)).toBe(false);
    expect(check01(`helper() {\n${fixed1}\n}\nhelper_missing`)).toBe(false);
    expect(check01(`if false && true; then\n${fixed1}\nfi`)).toBe(false);
    expect(check01(`bash -n -c ${JSON.stringify(fixed1)}`)).toBe(false);
    expect(check01(`exec true\n${fixed1}`)).toBe(false);
    const serve05Body = fixed5.slice(fixed5.indexOf("vllm serve"));
    expect(
      check05(
        `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\nexport -n ASCEND_RT_VISIBLE_DEVICES\ndocker run -d --name vllm-qwen30b --shm-size=16g --memory=128g -e ASCEND_RT_VISIBLE_DEVICES quay.io/ascend/vllm-ascend:v0.30.0 ${serve05Body}`,
      ),
    ).toBe(false);
    expect(
      check05(
        `ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\ndocker run -d --name vllm-qwen30b --shm-size=16g --memory=128g -e ASCEND_RT_VISIBLE_DEVICES quay.io/ascend/vllm-ascend:v0.30.0 ${serve05Body}`,
      ),
    ).toBe(false);

    // Dual-selector & python-api precedence (P1-7)
    expect(
      check01(
        fixed1.replace(
          "vllm serve /models/Qwen3-30B-A3B-W8A8",
          "vllm serve /models/Qwen3-30B-A3B-W8A8 --model /models/Qwen3-30B-A3B-W8A8",
        ),
      ),
    ).toBe(false);
    expect(
      check01(
        fixed1.replace(
          "vllm serve /models/Qwen3-30B-A3B-W8A8",
          "python -m vllm.entrypoints.openai.api_server /models/Qwen3-30B-A3B-W8A8",
        ),
      ),
    ).toBe(false);
    expect(
      check01(
        fixed1.replace(
          "vllm serve /models/Qwen3-30B-A3B-W8A8",
          "python -m vllm.entrypoints.openai.api_server --model /models/wrong --model /models/Qwen3-30B-A3B-W8A8",
        ),
      ),
    ).toBe(true);
    expect(
      check01(
        fixed1.replace(
          "vllm serve /models/Qwen3-30B-A3B-W8A8",
          "python -m vllm.entrypoints.openai.api_server --model /models/Qwen3-30B-A3B-W8A8 --model /models/wrong",
        ),
      ),
    ).toBe(false);

    // CASE-05 docker edge cases (P1-8, P1-9, P3-3)
    expect(check05(fixed5.replace("docker run -d", "docker run -d -q"))).toBe(true);
    expect(
      check05(
        fixed5.replace("--shm-size=16g", "--shm-size=17179869184").replace("--memory=128g", "--memory=0"),
      ),
    ).toBe(true);
    expect(check05(fixed5.replace(" quay.io/ascend/vllm-ascend:v0.30.0", ""))).toBe(false);
    expect(
      check05(
        fixed5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "quay.io/ascend/vllm-ascend:v0.30.0 true"),
      ),
    ).toBe(false);

    // Compilation & KV strict JSON types + dotted ordering (P2-5, P2-6)
    expect(check08(P8.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","full_cuda_graph":true'))).toBe(
      false,
    );
    expect(
      check08(P8.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","cudagraph_copy_inputs":"potato"')),
    ).toBe(false);
    expect(
      check08(
        P8.replace(
          '"kv_connector":"MooncakeConnectorV1"',
          '"kv_connector":"MooncakeConnectorV1","kv_port":"bad"',
        ),
      ),
    ).toBe(false);
    expect(
      check08(
        P8.replace(
          `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
          `-cc.cudagraph_mode FULL_DECODE_ONLY --compilation-config '{"cudagraph_mode":"NONE"}'`,
        ),
      ),
    ).toBe(true);
    expect(
      check08(
        P8.replace(
          `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
          `-cc.cudagraph_mode NONE --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
        ),
      ),
    ).toBe(false);

    // HCCL_SOCKET_IFNAME exact vs prefix (P2-8)
    expect(check08(P8.replace("HCCL_SOCKET_IFNAME=enp65s0f0", "HCCL_SOCKET_IFNAME=enp"))).toBe(true);
    expect(check08(P8.replace("HCCL_SOCKET_IFNAME=enp65s0f0", "HCCL_SOCKET_IFNAME==enp65s0f0"))).toBe(true);
    expect(check08(P8.replace("HCCL_SOCKET_IFNAME=enp65s0f0", "HCCL_SOCKET_IFNAME==enp65s0"))).toBe(false);
  });

  it("Round-4 Codex closure: blocks set -n, set -e;false, <<'', f()(), post-serve docker, --entrypoint, unforwarded container env, and aligns CompilationConfig/KVTransferConfig/-O/--served-model-name", () => {
    const sc1 = getWarGameScenario("rank3-oom-ei0006");
    const fixed1 = sc1.initialCommand.replace(
      "--gpu-memory-utilization 0.96",
      "--gpu-memory-utilization 0.88",
    );
    const sc5 = getWarGameScenario("exit-137-cgroup-sigkill");
    const fixed5 = sc5.initialCommand
      .replace("CUDA_VISIBLE_DEVICES=0,1,2,3", "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3")
      .replace("--shm-size=64m", "--shm-size=16g")
      .replace("--memory=32g", "--memory=128g");
    const sc8 = getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap");
    const P8 = sc8.initialCommand
      .replace(
        "HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9",
        "HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0",
      )
      .replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11");
    const D8 = (sc8.initialDecodeCommand ?? "").replace("HCCL_BUFFSIZE=8", "HCCL_BUFFSIZE=128");

    const check01 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check05 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check08 = (p: string, d = D8) =>
      judgeWarGameSubmission({
        scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
        selectedOptionId: "C",
        commandText: p,
        decodeCommandText: d,
      }).passed;

    // Shell P1-3: set -n, set -e; false, <<'', uncalled f() (...)
    expect(check01(`set -n\n${fixed1}`)).toBe(false);
    expect(check01(`set -o noexec\n${fixed1}`)).toBe(false);
    expect(check01(`set -e\nfalse\n${fixed1}`)).toBe(false);
    expect(check01(`cat <<''\n${fixed1}\n`)).toBe(false);
    expect(check01(`f() (\n${fixed1}\n)\n`)).toBe(false);

    // Docker P1-4 / P1-5: ordering, --entrypoint, unknown docker flag, host env isolation without -e
    const serveBody = fixed5.slice(fixed5.indexOf("vllm serve"));
    const dockerLineOnly =
      "docker run -d --name vllm-qwen30b --shm-size=16g --memory=128g --device=/dev/davinci0 --device=/dev/davinci1 --device=/dev/davinci2 --device=/dev/davinci3 --device=/dev/davinci_manager --device=/dev/devmm_svm --device=/dev/hisi_hdc -v /usr/local/Ascend/driver/lib64/:/usr/local/Ascend/driver/lib64/ -v /models:/models quay.io/ascend/vllm-ascend:v0.30.0";
    expect(check05(`${serveBody}\n${dockerLineOnly}`)).toBe(false);
    const inDockerBase = dockerLineOnly.replace(
      "quay.io/ascend/vllm-ascend:v0.30.0",
      `-e ASCEND_RT_VISIBLE_DEVICES=0,1,2,3 quay.io/ascend/vllm-ascend:v0.30.0 ${serveBody}`,
    );
    expect(check05(inDockerBase)).toBe(true);
    expect(check05(inDockerBase.replace("quay.io", "--entrypoint=/bin/true quay.io"))).toBe(false);
    expect(check05(inDockerBase.replace("quay.io", "--bogus-docker-flag=1 quay.io"))).toBe(false);
    expect(check05(`export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\n${dockerLineOnly} ${serveBody}`)).toBe(false);
    expect(
      check05(
        `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\n${dockerLineOnly.replace("quay.io", "-e ASCEND_RT_VISIBLE_DEVICES quay.io")} ${serveBody}`,
      ),
    ).toBe(true);

    // P2-4 / P2-5: CompilationConfig & KVTransferConfig schemas
    expect(check08(P8.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","compile_sizes":["potato"]'))).toBe(
      false,
    );
    expect(
      check08(P8.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","inductor_compile_config":null')),
    ).toBe(false);
    expect(
      check08(
        P8.replace(
          '"FULL_DECODE_ONLY"',
          '"FULL_DECODE_ONLY","pass_config":{"enable_qk_norm_rope_fusion":"potato"}',
        ),
      ),
    ).toBe(false);
    expect(check08(P8.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","ir_enable_torch_wrap":null'))).toBe(
      true,
    );
    expect(
      check08(P8.replace('"MooncakeConnectorV1"', '"MooncakeConnectorV1","kv_load_failure_policy":"potato"')),
    ).toBe(false);
    expect(
      check08(
        P8.replace(
          "--kv-transfer-config",
          `--kv-transfer-config '{"kv_connector":"MooncakeConnectorV1"}' --kv-transfer-config`,
        ),
      ),
    ).toBe(false);
    expect(
      check08(P8.replace('"MooncakeConnectorV1"', '"MooncakeConnectorV1","kv_connector_module_path":null')),
    ).toBe(true);

    // P2-6 / P2-7 / P2-8: dotted replacements, -O/-O3 vs JSON, --served-model-name nargs=+
    expect(
      check08(
        P8.replace(
          `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
          `--compilation-config '{"mode":0,"cudagraph_mode":"NONE"}' -cc.cudagraph_mode FULL_DECODE_ONLY`,
        ),
      ),
    ).toBe(true);
    expect(
      check08(
        P8.replace(
          `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
          `-cc.cudagraph_mode FULL_DECODE_ONLY -cc.cudagraph_copy_inputs potato -cc.cudagraph_copy_inputs false`,
        ),
      ),
    ).toBe(true);
    expect(
      check08(
        P8.replace(
          `--kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer","kv_connector_extra_config":{"prefill":{"tp_size":2,"dp_size":1},"decode":{"tp_size":2,"dp_size":1,"pp_size":1}}}'`,
          `--kv-transfer-config.kv_connector MooncakeConnectorV1 --kv-transfer-config.kv_role kv_producer --kv-transfer-config.kv_connector_extra_config.prefill.tp_size 2 --kv-transfer-config.kv_connector_extra_config.prefill.dp_size 1 --kv-transfer-config.kv_connector_extra_config.decode.tp_size 2 --kv-transfer-config.kv_connector_extra_config.decode.dp_size 1 --kv-transfer-config.kv_connector_extra_config.decode.pp_size 1`,
        ),
      ),
    ).toBe(true);
    expect(check08(P8.replace("--compilation-config", "-O"))).toBe(false);
    expect(check01(`${fixed1} -O1`)).toBe(true);
    expect(check08(`${P8} -O3`)).toBe(true);
    expect(
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: `${fixed1} -O3`,
      }).checks.find((c) => c.id === "cli-syntax-and-unknown-flags")?.passed,
    ).toBe(true);
    expect(
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: `${fixed1} --optimization-level 3`,
      }).checks.find((c) => c.id === "cli-syntax-and-unknown-flags")?.passed,
    ).toBe(true);
    expect(
      check01(
        fixed1
          .replace(
            "vllm serve /models/Qwen3-30B-A3B-W8A8",
            "vllm serve --served-model-name qwen /models/Qwen3-30B-A3B-W8A8",
          )
          .replace("--served-model-name qwen3-30b-a3b", ""),
      ),
    ).toBe(false);
    expect(
      check01(
        fixed1.replace("--served-model-name qwen3-30b-a3b", "--served-model-name qwen3-30b-a3b qwen3-alias"),
      ),
    ).toBe(true);
  });

  it("Round-5 Codex closure: fixes NBSP freeze, while/command-exit/test, heredoc comment backslash, subshell fn, docker image/args/bool=val, pass/dynamic shapes, nullable kv, dotted prefix groups, O0 empty cc, and model position", () => {
    const sc1 = getWarGameScenario("rank3-oom-ei0006");
    const fixed1 = sc1.initialCommand.replace(
      "--gpu-memory-utilization 0.96",
      "--gpu-memory-utilization 0.88",
    );
    const sc5 = getWarGameScenario("exit-137-cgroup-sigkill");
    const fixed5 = sc5.initialCommand
      .replace("CUDA_VISIBLE_DEVICES=0,1,2,3", "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3")
      .replace("--shm-size=64m", "--shm-size=16g")
      .replace("--memory=32g", "--memory=128g");
    const sc8 = getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap");
    const P8 = sc8.initialCommand
      .replace(
        "HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9",
        "HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0",
      )
      .replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11");
    const D8 = (sc8.initialDecodeCommand ?? "").replace("HCCL_BUFFSIZE=8", "HCCL_BUFFSIZE=128");

    const check01 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check05 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check08 = (pCmd: string, dCmd = D8) =>
      judgeWarGameSubmission({
        scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
        selectedOptionId: "C",
        commandText: pCmd,
        decodeCommandText: dCmd,
      }).passed;

    // #2: Non-breaking space (\u00A0) must never spin or hang the lexer
    expect(check01(`echo hi\u00A0\n${fixed1}`)).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "vllm\u00A0serve"))).toBe(false);

    // #3: while false / until true / command exit 0 / test 1 = 2 && / unknown && never reach serve
    expect(check01(`while false; do ${fixed1}; done`)).toBe(false);
    expect(check01(`until true; do ${fixed1}; done`)).toBe(false);
    expect(check01(`command exit 0\n${fixed1}`)).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "test 1 = 2 && vllm serve"))).toBe(false);
    expect(check01(`test 1 = 2 && {\n${fixed1}\n}`)).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "[ 1 = 2 ] && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "nonexistent_tool && vllm serve"))).toBe(false);

    // #4: Heredoc opener with comment ending in trailing backslash still suppresses heredoc body
    expect(check01(`cat <<EOF # comment \\\n${fixed1}\nEOF`)).toBe(false);

    // #5: Subshell function definition f() ( export ... ) does not leak exports to caller
    const p8ServeIdx = P8.indexOf("vllm serve");
    const p8Exports = P8.slice(0, p8ServeIdx).trim().replace(/\n+/g, "; ");
    const p8Serve = P8.slice(p8ServeIdx);
    expect(check08(`f() (\n${p8Exports}\n)\nf\n${p8Serve}`)).toBe(false);
    expect(check08(`f() {\n${p8Exports}\n}\nf\n${p8Serve}`)).toBe(true);

    // #6, #7, #8: Docker unrelated image, shell-assign inside container cmd, '' image, -d=potato, CASE-08 bad docker
    expect(check05(fixed5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "busybox:latest"))).toBe(false);
    const serveBody5 = fixed5.slice(fixed5.indexOf("vllm serve"));
    const dockerBase5 =
      "docker run --name vllm-qwen30b --shm-size=16g --memory=128g --device=/dev/davinci0 --device=/dev/davinci1 --device=/dev/davinci2 --device=/dev/davinci3 --device=/dev/davinci_manager --device=/dev/devmm_svm --device=/dev/hisi_hdc -v /usr/local/Ascend/driver/lib64/:/usr/local/Ascend/driver/lib64/ -v /models:/models quay.io/ascend/vllm-ascend:v0.30.0";
    expect(
      check05(
        `${dockerBase5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "--entrypoint='' quay.io/ascend/vllm-ascend:v0.30.0")} ASCEND_RT_VISIBLE_DEVICES=0,1,2,3 ${serveBody5}`,
      ),
    ).toBe(false);
    expect(
      check05(
        `${dockerBase5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "--entrypoint='' quay.io/ascend/vllm-ascend:v0.30.0")} env ASCEND_RT_VISIBLE_DEVICES=0,1,2,3 ${serveBody5}`,
      ),
    ).toBe(true);
    expect(check05(`${dockerBase5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "''")} ${serveBody5}`)).toBe(
      false,
    );
    expect(check05(fixed5.replace("docker run -d", "docker run -d=potato"))).toBe(false);
    expect(check08(`docker run --bogus-flag quay.io/ascend/vllm-ascend:v0.30.0\n${P8}`)).toBe(false);

    // #11: compile_sizes "cudagraph_capture_sizes", PassConfig & DynamicShapesConfig strictness
    expect(
      check08(
        P8.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","compile_sizes":["cudagraph_capture_sizes"]'),
      ),
    ).toBe(true);
    expect(
      check08(
        P8.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","pass_config":{"sp_min_token_num":"potato"}'),
      ),
    ).toBe(false);
    expect(
      check08(
        P8.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY","dynamic_shapes_config":{"type":"potato"}'),
      ),
    ).toBe(false);
    expect(
      check08(
        P8.replace(
          '"FULL_DECODE_ONLY"',
          '"FULL_DECODE_ONLY","dynamic_shapes_config":{"type":"backed_size_oblivious","evaluate_guards":false}',
        ),
      ),
    ).toBe(true);

    // #12: Nullable kv_connector / kv_role allowed when overridden by later valid config, non-null without role rejected
    expect(
      check08(
        P8.replace(
          "--kv-transfer-config",
          `--kv-transfer-config '{"kv_connector":null,"kv_role":null}' --kv-transfer-config`,
        ),
      ),
    ).toBe(true);
    expect(
      check08(
        P8.replace(
          "--kv-transfer-config",
          `--kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":null}' --kv-transfer-config`,
        ),
      ),
    ).toBe(false);

    // #13 & #14: Separate dotted prefix groups + JSON-quoted dotted scalar strings
    expect(
      check08(
        P8.replace(
          `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
          `-cc.cudagraph_mode POTATO --compilation-config.cudagraph_mode FULL_DECODE_ONLY`,
        ),
      ),
    ).toBe(false);
    expect(
      check08(
        P8.replace(
          `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
          `-cc.cudagraph_mode '"FULL_DECODE_ONLY"'`,
        ),
      ),
    ).toBe(true);

    // #15: Positional model after optional flag fails when --served-model-name is specified
    expect(
      check01(
        fixed1.replace(
          "vllm serve /models/Qwen3-30B-A3B-W8A8",
          "vllm serve -pcp 1 /models/Qwen3-30B-A3B-W8A8",
        ),
      ),
    ).toBe(false);

    // #16: -O0 preserved under '--compilation-config "{}"', and -O3=1 rejected
    expect(check01(`${fixed1} -O0 --compilation-config '{}'`)).toBe(false);
    expect(check01(`${fixed1} -O3=1`)).toBe(false);

    // #17: CASE-08 GLOO_SOCKET_IFNAME contract alignment
    expect(sc8.missionConstraints.join("\n")).toContain("每项均为 enp65s0f0");
    expect(check08(P8.replace("GLOO_SOCKET_IFNAME=enp65s0f0", "GLOO_SOCKET_IFNAME=enp65s0f0,lo"))).toBe(
      false,
    );
  });

  it("Round-6 Codex closure (v4): blocks empty for-in, quoted done, unmatched (, <<END#x, command -v missing, cd /missing, BigInt test, env command, detached host serve & bogus images, and aligns return, 1k/1e3, recursive dotted merge, underscore group, custom_ops/backend & Ascend connectors", () => {
    const sc1 = getWarGameScenario("rank3-oom-ei0006");
    const fixed1 = sc1.initialCommand.replace(
      "--gpu-memory-utilization 0.96",
      "--gpu-memory-utilization 0.88",
    );
    const sc5 = getWarGameScenario("exit-137-cgroup-sigkill");
    const fixed5 = sc5.initialCommand
      .replace("CUDA_VISIBLE_DEVICES=0,1,2,3", "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3")
      .replace("--shm-size=64m", "--shm-size=16g")
      .replace("--memory=32g", "--memory=128g");
    const sc8 = getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap");
    const P8 = sc8.initialCommand
      .replace(
        "HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9",
        "HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0",
      )
      .replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11");
    const D8 = (sc8.initialDecodeCommand ?? "").replace("HCCL_BUFFSIZE=8", "HCCL_BUFFSIZE=128");

    const check01 = (cmd: string) =>
      judgeWarGameSubmission({ scenarioId: "rank3-oom-ei0006", selectedOptionId: "B", commandText: cmd })
        .passed;
    const check05 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check08 = (pCmd: string, dCmd = D8) =>
      judgeWarGameSubmission({
        scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
        selectedOptionId: "C",
        commandText: pCmd,
        decodeCommandText: dCmd,
      }).passed;

    // v4 #3: Empty for-in, while false + echo "done", unmatched '('
    expect(check01(`for item in; do\n${fixed1}\ndone`)).toBe(false);
    expect(check01(`for item; do\n${fixed1}\ndone`)).toBe(false);
    expect(check01(`while false; do\necho "done"\n${fixed1}\ndone`)).toBe(false);
    expect(check01(`(\n${fixed1}`)).toBe(false);

    // v4 #4: <<END#x keeps full delimiter
    expect(check01(`cat <<END#x\nEND\n${fixed1}\nEND#x`)).toBe(false);

    // v4 #5: command -v missing_tool, cd /nonexistent, BigInt precision in test
    expect(check01(fixed1.replace("vllm serve", "command -v missing_audit_tool && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "cd /no/such/directory && vllm serve"))).toBe(false);
    expect(
      check01(fixed1.replace("vllm serve", "test 9007199254740992 -eq 9007199254740993 && vllm serve")),
    ).toBe(false);

    // v4 #6: env command fails (external wrapper does not execute shell builtins)
    expect(check01(fixed1.replace("vllm serve", "env command vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "command env vllm serve"))).toBe(true);

    // v4 #7: CASE-05 requires in-container vllm serve and rejects non-vllm images like cann/nginx:alpine, nginx:alpine, ubuntu:24.04
    expect(check05(fixed5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "cann/nginx:alpine"))).toBe(false);
    expect(check05(fixed5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "nginx:alpine"))).toBe(false);
    expect(check05(fixed5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "ubuntu:24.04"))).toBe(false);
    const serveBody5 = fixed5.slice(fixed5.indexOf("vllm serve"));
    expect(
      check05(
        `docker run -d --name vllm-qwen30b --shm-size=16g --memory=128g quay.io/ascend/vllm-ascend:v0.30.0\nexport ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\n${serveBody5}`,
      ),
    ).toBe(false);

    // v4 #8: return from brace function does not terminate caller
    expect(check01(`f() {\nreturn 0\n}\nf\n${fixed1}`)).toBe(true);
    expect(check01(`f() {\nexit 0\n}\nf\n${fixed1}`)).toBe(false);

    // v4 #9: Dotted 1k and 1e3 values match upstream argparse_utils.py
    expect(
      check08(
        P8.replace('"FULL_DECODE_ONLY"', '"FULL_DECODE_ONLY"').replace(
          `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
          `-cc.cudagraph_mode FULL_DECODE_ONLY -cc.pass_config.sp_min_token_num 1k`,
        ),
      ),
    ).toBe(true);
    expect(
      check08(
        P8.replace(
          `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
          `-cc.cudagraph_mode FULL_DECODE_ONLY -cc.pass_config.sp_min_token_num 1e3`,
        ),
      ),
    ).toBe(true);

    // v4 #10: Repeated dotted objects merge recursively, preserving invalid fields
    expect(
      check08(
        P8.replace(
          `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
          `-cc.cudagraph_mode FULL_DECODE_ONLY -cc.pass_config '{"sp_min_token_num":"potato"}' -cc.pass_config '{"eliminate_noops":true}'`,
        ),
      ),
    ).toBe(false);

    // v4 #11: Underscore/hyphen long dotted prefix normalizes into one group while -cc stays separate
    expect(
      check08(
        P8.replace(
          `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
          `--compilation_config.cudagraph_mode POTATO --compilation-config.cudagraph_mode FULL_DECODE_ONLY`,
        ),
      ),
    ).toBe(true);

    // v4 #12: Earlier compilation configs reject invalid custom_ops or invalid backend under VLLM_COMPILE
    expect(
      check08(
        P8.replace(
          "--compilation-config",
          `--compilation-config '{"custom_ops":["potato"]}' --compilation-config`,
        ),
      ),
    ).toBe(false);
    expect(
      check08(
        P8.replace(
          "--compilation-config",
          `--compilation-config '{"mode":"VLLM_COMPILE","backend":"potato"}' --compilation-config`,
        ),
      ),
    ).toBe(false);

    // v4 #13: Registered Ascend v0.30.0 connectors like MooncakeConnectorV2 are accepted in overridden KV configs
    expect(
      check08(
        P8.replace(
          "--kv-transfer-config",
          `--kv-transfer-config '{"kv_connector":"MooncakeConnectorV2","kv_role":"kv_producer"}' --kv-transfer-config`,
        ),
      ),
    ).toBe(true);
  });

  it("Round-7 Codex closure: closes shell operator/loop/heredoc/context/return edges, strict Docker image ref, W8A8 checkpoint consistency, upstream JSON/dotted ints & fusion conflicts, core connectors, and HCCL list", () => {
    const sc1 = getWarGameScenario("rank3-oom-ei0006");
    const fixed1 = sc1.initialCommand.replace(
      "--gpu-memory-utilization 0.96",
      "--gpu-memory-utilization 0.88",
    );
    const sc5 = getWarGameScenario("exit-137-cgroup-sigkill");
    const fixed5 = sc5.initialCommand
      .replace("CUDA_VISIBLE_DEVICES=0,1,2,3", "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3")
      .replace("--shm-size=64m", "--shm-size=16g")
      .replace("--memory=32g", "--memory=128g");
    const sc6 = getWarGameScenario("pd-mooncake-kv-mismatch");
    const fixed6P = sc6.initialCommand.replace('"kv_role":"kv_consumer"', '"kv_role":"kv_producer"');
    const fixed6D = (sc6.initialDecodeCommand ?? "")
      .replace("--tensor-parallel-size 8", "--tensor-parallel-size 2")
      .replace('"kv_role":"kv_producer"', '"kv_role":"kv_consumer"')
      .replace("    --kv-cache-dtype int8 \\\n", "");
    const sc8 = getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap");
    const P8 = sc8.initialCommand
      .replace(
        "HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9",
        "HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0",
      )
      .replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11");
    const D8 = (sc8.initialDecodeCommand ?? "").replace("HCCL_BUFFSIZE=8", "HCCL_BUFFSIZE=128");

    const check01 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check05 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check08 = (p: string, d = D8) =>
      judgeWarGameSubmission({
        scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
        selectedOptionId: "C",
        commandText: p,
        decodeCommandText: d,
      }).passed;

    // v5 #1: Leading/trailing && and trailing unmatched ) fail cleanly
    expect(check01(`&& ${fixed1}`)).toBe(false);
    expect(check01(`${fixed1} &&`)).toBe(false);
    expect(check01(`${fixed1} )`)).toBe(false);
    expect(check01(`if true; then :; fi ) && ${fixed1}`)).toBe(false);
    expect(check01(`true && ; ${fixed1}`)).toBe(false);

    // v5 #2: break and continue inside loops prevent subsequent launch
    expect(check01(`while true; do break\n${fixed1}\ndone`)).toBe(false);
    expect(check01(`for x in 1 2; do break; ${fixed1}; done`)).toBe(false);
    expect(check01(`for x in 1 2; do if true; then continue; fi; ${fixed1}; done`)).toBe(false);

    // v5 #3: double-quoted heredoc preserves literal backslash before non-special chars (<<"END\q")
    expect(check01(`cat <<"END\\q"\nENDq\n${fixed1}\nEND\\q`)).toBe(false);
    expect(check01(`cat <<"END\\q"\nhi\nEND\\q\n${fixed1}`)).toBe(true);

    // v5 #4: printf/cat strictness + cd / support
    expect(check01(fixed1.replace("vllm serve", "printf '%' && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "cat /nonexistent_audit_example && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "cd / && vllm serve"))).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "printf '%s\\n' ok && vllm serve"))).toBe(true);

    // v5 #5: External execution wrappers (`env`, `exec`) cannot invoke functions or shell builtins
    expect(check01(`f() {\n${fixed1}\n}\nenv f`)).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "env cd . && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "exec command vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "command cd . && vllm serve"))).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "command env vllm serve"))).toBe(true);

    // v5 #6: Operand-less `return` preserves caller $? (`false; return;` -> 1)
    expect(check01(`f() { false; return; }\n${fixed1.replace("vllm serve", "f && vllm serve")}`)).toBe(false);
    expect(check01(`f() { true; return; }\n${fixed1.replace("vllm serve", "f && vllm serve")}`)).toBe(true);

    // v5 #7: Docker image reference grammar (reject uppercase repo & empty tag, allow sha256 digest)
    expect(
      check05(fixed5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "quay.io/ascend/VLLM-ASCEND:v0.30.0")),
    ).toBe(false);
    expect(check05(fixed5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "quay.io/ascend/vllm-ascend:"))).toBe(
      false,
    );
    expect(
      check05(
        fixed5.replace(
          "quay.io/ascend/vllm-ascend:v0.30.0",
          `quay.io/ascend/vllm-ascend@sha256:${"a".repeat(64)}`,
        ),
      ),
    ).toBe(true);

    // v5 #8, #16, #19: CASE-01, CASE-05, CASE-06 require W8A8 checkpoint, device passthrough & consistent telemetry
    expect(sc1.mustKeep.targetModelCanonical).toBe("/models/Qwen3-30B-A3B-W8A8");
    expect(sc5.mustKeep.targetModelCanonical).toBe("/models/Qwen3-30B-A3B-W8A8");
    expect(sc5.initialCommand).toContain("--device=/dev/davinci0");
    expect(sc5.telemetryText).toContain("--shm-size=64m");
    expect(sc6.mustKeep.targetModelCanonical).toBe("/models/Qwen3-30B-A3B-W8A8");
    expect(check01(fixed1.replace("/models/Qwen3-30B-A3B-W8A8", "Qwen/Qwen3-30B-A3B"))).toBe(false);
    expect(check05(fixed5.replace("/models/Qwen3-30B-A3B-W8A8", "Qwen/Qwen3-30B-A3B"))).toBe(false);
    expect(
      judgeWarGameSubmission({
        scenarioId: "pd-mooncake-kv-mismatch",
        selectedOptionId: "B",
        commandText: fixed6P.replace("/models/Qwen3-30B-A3B-W8A8", "Qwen/Qwen3-30B-A3B"),
        decodeCommandText: fixed6D,
      }).passed,
    ).toBe(false);

    const P8CcDotted = P8.replace(
      `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
      "-cc.cudagraph_mode FULL_DECODE_ONLY",
    );

    // v5 #11: Dotted plain-integer fallback (+1000, 01)
    expect(check08(`${P8CcDotted} -cc.pass_config.sp_min_token_num +1000`)).toBe(true);
    expect(check08(`${P8CcDotted} -cc.pass_config.sp_min_token_num 01`)).toBe(true);

    // v5 #12: Typed JSON config expands bare human-readable numbers (`1k`) outside quotes
    expect(
      check08(
        P8.replace(
          "--compilation-config",
          `--compilation-config '{"pass_config":{"sp_min_token_num":1k}}' --compilation-config`,
        ),
      ),
    ).toBe(true);

    // v5 #13: `-cc.custom_ops+` appends cleanly without duplication and keeps `+` items as strings
    expect(check08(`${P8CcDotted} -cc.custom_ops+ all -cc.custom_ops+ +rotary_embedding`)).toBe(true);
    expect(check08(`${P8CcDotted} -cc.compile_sizes+ 123`)).toBe(false);

    // v7 P2-8 (superseding literal v5 #14): On Ascend NPU (PlatformEnum.OOT), PassConfig.__post_init__
    // disables CUDA/ROCm-only rotary fusions before CompilationConfig checks +rotary_embedding vs -rotary_embedding.
    for (const fusionFlag of [
      "fuse_rope_kvcache",
      "enable_qk_norm_rope_fusion",
      "fuse_qk_norm_rope_kvcache",
    ]) {
      expect(
        check08(
          P8.replace(
            "--compilation-config",
            `--compilation-config '{"pass_config":{"${fusionFlag}":true},"custom_ops":["-rotary_embedding"]}' --compilation-config`,
          ),
        ),
      ).toBe(true);
    }
    expect(
      check08(
        P8.replace(
          "--compilation-config",
          `--compilation-config '{"custom_ops":["+rotary_embedding","-rotary_embedding"]}' --compilation-config`,
        ),
      ),
    ).toBe(false);

    // v5 #15: Core vLLM KV connectors pass validation in overridden configs
    for (const conn of [
      "ExampleConnector",
      "LMCacheMPConnector",
      "NixlPullConnector",
      "NixlPushConnector",
      "MooncakeStoreConnector",
    ]) {
      expect(
        check08(
          P8.replace(
            "--kv-transfer-config",
            `--kv-transfer-config '{"kv_connector":"${conn}","kv_role":"kv_producer"}' --kv-transfer-config`,
          ),
        ),
      ).toBe(true);
    }

    // v5 #18: HCCL_SOCKET_IFNAME allows comma list where at least one prefix matches enp65s0f0
    expect(check08(P8.replace("HCCL_SOCKET_IFNAME=enp65s0f0", "HCCL_SOCKET_IFNAME=enp,eth"))).toBe(true);
    expect(check08(P8.replace("HCCL_SOCKET_IFNAME=enp65s0f0", "HCCL_SOCKET_IFNAME=eth9,eth0"))).toBe(false);
  });

  it("Round-8 Codex closure (v6): compound separators, non-breaking infinite loops, condition exits, heredoc line-continuations/spaces, printf/cat/cd guards, fn return/depth, CASE-05 image/device/mounts, HCCL modifiers, connector module paths, -cc space negative ops, underscored ints, background exit, builtins", () => {
    const sc1 = getWarGameScenario("rank3-oom-ei0006");
    const fixed1 = sc1.initialCommand.replace(
      "--gpu-memory-utilization 0.96",
      "--gpu-memory-utilization 0.88",
    );
    const sc5 = getWarGameScenario("exit-137-cgroup-sigkill");
    const fixed5 = sc5.initialCommand
      .replace("CUDA_VISIBLE_DEVICES=0,1,2,3", "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3")
      .replace("--shm-size=64m", "--shm-size=16g")
      .replace("--memory=32g", "--memory=128g");
    const sc8 = getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap");
    const P8 = sc8.initialCommand
      .replace(
        "HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9",
        "HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0",
      )
      .replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11");
    const D8 = (sc8.initialDecodeCommand ?? "").replace("HCCL_BUFFSIZE=8", "HCCL_BUFFSIZE=128");

    const check01 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check05 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check08 = (p: string, d = D8) =>
      judgeWarGameSubmission({
        scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
        selectedOptionId: "C",
        commandText: p,
        decodeCommandText: d,
      }).passed;

    // v6 P1-1: Compound command must be followed by separator/redirection, not a bare command word
    expect(check01(fixed1.replace("vllm serve", "(true) vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "{ true; } vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "if true; then :; fi vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "(true) >/dev/null && vllm serve"))).toBe(true);

    // v6 P1-2: Infinite loops without break terminate execution and fail rather than falling through
    expect(check01(fixed1.replace("vllm serve", "while true; do continue; done; vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "until false; do continue; done; vllm serve"))).toBe(false);

    // v6 P1-3: exit inside condition terminates script
    expect(check01(fixed1.replace("vllm serve", "if exit 0; then :; fi; vllm serve"))).toBe(false);

    // v6 P1-4: Unquoted heredoc honors backslash-newline line continuation; NBSP is not IFS whitespace
    expect(check01(`cat <<END\nline \\\nEND\n${fixed1}\nEND`)).toBe(false);
    expect(check01(`cat <<END\u00a0\nEND\n${fixed1}\nEND\u00a0`)).toBe(false);
    expect(check01(`cat <<END\u00a0\nhi\nEND\u00a0\n${fixed1}`)).toBe(true);

    // v6 P1-5: printf invalid numeric operand, cat unknown long/short flags, cd excess operands fail
    expect(check01(fixed1.replace("vllm serve", "printf '%d' oops && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "printf '%d' 42 && vllm serve"))).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "cat --not-a-cat-option && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "cd / / && vllm serve"))).toBe(false);

    // v6 P1-6: Function preserves incoming $? on bare return & maintains function scope in () body
    expect(check01(fixed1.replace("vllm serve", "f() { return; }\nfalse\nf && vllm serve"))).toBe(false);
    expect(check01(`f() (return 1; ${fixed1})\nf`)).toBe(false);
    expect(check01(`f() { (return 1); ${fixed1}; }\nf`)).toBe(true);

    // v6 P1-7: Subshell nesting depth guard fails closed (exit != 0); space-separated 10 nested subshells succeed
    expect(
      check01(fixed1.replace("vllm serve", `${"( ".repeat(9)}false${" )".repeat(9)} && vllm serve`)),
    ).toBe(false);
    expect(
      check01(fixed1.replace("vllm serve", `${"( ".repeat(10)}true${" )".repeat(10)} && vllm serve`)),
    ).toBe(true);

    // v6 P1-8, P1-9, P1-10 + v7 P1-3: CASE-05 enforces Ascend image, NPU device mappings, host driver & model mounts
    expect(check05(fixed5)).toBe(true);
    expect(check05(fixed5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "vllm/vllm-openai:latest"))).toBe(
      false,
    );
    expect(check05(fixed5.replace(/\s+--device=\S+/g, ""))).toBe(false);
    expect(
      check05(
        fixed5
          .replace("--device=/dev/davinci0", "--device=/dev/davinci6")
          .replace("--device=/dev/davinci1", "--device=/dev/davinci7"),
      ),
    ).toBe(false);
    expect(check05(fixed5.replace(" -v /models:/models", ""))).toBe(false);
    expect(check05(fixed5.replace(" -v /models:/models", " -v /models"))).toBe(false);
    expect(
      check05(fixed5.replace(" -v /usr/local/Ascend/driver/lib64/:/usr/local/Ascend/driver/lib64/", "")),
    ).toBe(false);
    expect(
      check05(
        fixed5
          .replace(/\s+--device=\S+/g, "")
          .replace(
            " -v /usr/local/Ascend/driver/lib64/:/usr/local/Ascend/driver/lib64/",
            " --runtime=ascend -e ASCEND_VISIBLE_DEVICES=0,1,2,3",
          ),
      ),
    ).toBe(true);

    // v6 P2-3: Global HCCL selector modifier grammar (^ exclusion & = exact match)
    expect(check08(P8.replace("HCCL_SOCKET_IFNAME=enp65s0f0", "HCCL_SOCKET_IFNAME=^eth,enp"))).toBe(false);
    expect(check08(P8.replace("HCCL_SOCKET_IFNAME=enp65s0f0", "HCCL_SOCKET_IFNAME==eth9,enp"))).toBe(false);
    expect(check08(P8.replace("HCCL_SOCKET_IFNAME=enp65s0f0", "HCCL_SOCKET_IFNAME=^eth"))).toBe(true);

    // v6 P2-4: Known core connector requires exact registered module path
    expect(
      check01(
        `${fixed1} --kv-transfer-config '{"kv_connector":"ExampleConnector","kv_role":"kv_both","kv_connector_module_path":"vllm.utils.argparse_utils"}'`,
      ),
    ).toBe(false);
    expect(
      check01(
        `${fixed1} --kv-transfer-config '{"kv_connector":"ExampleConnector","kv_role":"kv_both","kv_connector_module_path":"vllm.distributed.kv_transfer.kv_connector.v1.example_connector"}'`,
      ),
    ).toBe(true);

    // v6 P2-5: Space-separated -cc.custom_ops+ preserves -rotary_embedding as negative custom op
    const P8NoRotaryFusion = P8.replace(
      `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
      `-cc.cudagraph_mode FULL_DECODE_ONLY -cc.pass_config '{"fuse_rope_kvcache":false,"enable_qk_norm_rope_fusion":false,"fuse_qk_norm_rope_kvcache":false}'`,
    );
    expect(check08(`${P8NoRotaryFusion} -cc.custom_ops+ all -cc.custom_ops+ -rotary_embedding`)).toBe(true);

    // v6 P2-6: Dotted int fallback supports Python underscored integers
    expect(check08(`${P8NoRotaryFusion} -cc.pass_config.sp_min_token_num 1_000`)).toBe(true);

    // v6 P2-7: Background command exit runs in isolated subshell without terminating parent
    expect(check01(fixed1.replace("vllm serve", "exit 1 & vllm serve"))).toBe(true);

    // v6 P2-8: command -v printf and test +1 -eq 1 succeed
    expect(check01(fixed1.replace("vllm serve", "command -v printf >/dev/null && vllm serve"))).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "test +1 -eq 1 && vllm serve"))).toBe(true);
  });

  it("Round-9 Codex closure (v7): Docker device/bind/runtime/hardware-tag validation, redirection/arithmetic/deep-syntax/pipeline/unknown-if/fn-precedence/sleep/export/octal/exit00/quotes/while-reval, for/$var/bash-c positional, Unicode & large Python ints, PdConnector ban, CASE-05 takeaway", () => {
    const sc1 = getWarGameScenario("rank3-oom-ei0006");
    const fixed1 = sc1.initialCommand.replace(
      "--gpu-memory-utilization 0.96",
      "--gpu-memory-utilization 0.88",
    );
    const sc5 = getWarGameScenario("exit-137-cgroup-sigkill");
    const fixed5 = sc5.initialCommand
      .replace("CUDA_VISIBLE_DEVICES=0,1,2,3", "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3")
      .replace("--shm-size=64m", "--shm-size=16g")
      .replace("--memory=32g", "--memory=128g");
    const sc8 = getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap");
    const P8 = sc8.initialCommand
      .replace(
        "HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9",
        "HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0",
      )
      .replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11");
    const D8 = (sc8.initialDecodeCommand ?? "").replace("HCCL_BUFFSIZE=8", "HCCL_BUFFSIZE=128");

    const check01 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "rank3-oom-ei0006",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check05 = (cmd: string) =>
      judgeWarGameSubmission({
        scenarioId: "exit-137-cgroup-sigkill",
        selectedOptionId: "B",
        commandText: cmd,
      }).passed;
    const check08 = (p: string, d = D8) =>
      judgeWarGameSubmission({
        scenarioId: "a3-pd-mc2-buffsize-ifname-trap",
        selectedOptionId: "C",
        commandText: p,
        decodeCommandText: d,
      }).passed;

    // v7 P1-1..P1-4: CASE-05 container security, hardware tag & Ascend runtime semantics
    expect(check05(fixed5.replace("--device=/dev/davinci0", "--device=/dev/null:/dev/davinci0"))).toBe(false);
    expect(check05(fixed5.replace("--device=/dev/davinci0", "--device=/dev/davinci0:/dev/davinci0:m"))).toBe(
      false,
    );
    expect(check05(fixed5.replace("--device=/dev/davinci0", "--device=/dev/davinci0:/dev/davinci0:rw"))).toBe(
      true,
    );
    expect(check05(fixed5.replace("-v /models:/models", "-v /dev/null:/models"))).toBe(false);
    expect(
      check05(
        fixed5.replace(
          "-v /usr/local/Ascend/driver/lib64/:/usr/local/Ascend/driver/lib64/",
          "-v /dev/null:/usr/local/Ascend/driver/lib64/",
        ),
      ),
    ).toBe(false);
    expect(check05(fixed5.replace("-v /models:/models", "-v /models:/models:invalid"))).toBe(false);
    expect(check05(fixed5.replace("-v /models:/models", "-v /models:/models:ro"))).toBe(true);
    expect(
      check05(
        fixed5
          .replace(/\s+--device=\S+/g, "")
          .replace(
            " -v /usr/local/Ascend/driver/lib64/:/usr/local/Ascend/driver/lib64/",
            " --runtime=ascend",
          ),
      ),
    ).toBe(false);
    expect(
      check05(
        fixed5
          .replace(/\s+--device=\S+/g, "")
          .replace(
            " -v /usr/local/Ascend/driver/lib64/:/usr/local/Ascend/driver/lib64/",
            " --runtime=ascend -e ASCEND_VISIBLE_DEVICES=void",
          ),
      ),
    ).toBe(false);
    expect(
      check05(
        fixed5
          .replace(/\s+--device=\S+/g, "")
          .replace(
            " -v /usr/local/Ascend/driver/lib64/:/usr/local/Ascend/driver/lib64/",
            " --runtime=ascend -e ASCEND_VISIBLE_DEVICES=0,1,2,3 -e ASCEND_RUNTIME_OPTIONS=NODRV",
          ),
      ),
    ).toBe(false);
    expect(
      check05(
        fixed5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "quay.io/ascend/vllm-ascend:v0.30.0-310p"),
      ),
    ).toBe(false);
    expect(
      check05(
        fixed5.replace("quay.io/ascend/vllm-ascend:v0.30.0", "quay.io/ascend/vllm-ascend:v0.30.0-openeuler"),
      ),
    ).toBe(true);

    // v7 P1-5..P1-16: Shell parser/evaluator parity with Bash
    expect(check01(fixed1.replace("vllm serve", "(true) </nonexistent_audit_example && vllm serve"))).toBe(
      false,
    );
    expect(check01(fixed1.replace("vllm serve", "((true)) && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "(( 1 + 1 == 2 )) && vllm serve"))).toBe(true);
    expect(
      check01(
        fixed1.replace(
          "vllm serve",
          `if false; then ${"( ".repeat(10)}true && ;${" )".repeat(10)}; fi\nvllm serve`,
        ),
      ),
    ).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "false && : | vllm serve"))).toBe(false);
    expect(
      check01(fixed1.replace("vllm serve", "if missing_audit_tool; then :; else exit 0; fi; vllm serve")),
    ).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "if test -d /; then exit 0; fi; vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "echo() { return 1; }\necho && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "echo() { return 1; }\ncommand echo && vllm serve"))).toBe(
      true,
    );
    expect(check01(fixed1.replace("vllm serve", "sleep invalid && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "sleep 0.1 && vllm serve"))).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "export invalid-name && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "printf '%d' 08 && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "printf '%d' 07 && vllm serve"))).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "(exit 00) || vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "f() { return 00; }\nf || vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "'!' false && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "cd '~' && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "cd ~ && vllm serve"))).toBe(true);
    const body1 = fixed1.slice(fixed1.indexOf("vllm serve"));
    expect(
      check01(
        `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\nexport HCCL_BUFFSIZE=1024\nguard() { return 0; }\nwhile guard; do ${body1}; guard() { return 1; }; done\n${body1}`,
      ),
    ).toBe(false);

    // v7 P2-3..P2-7 & P3-1
    expect(check01(fixed1.replace("vllm serve", "exit 1 && true & vllm serve"))).toBe(true);
    expect(check01(`cat <<END\nEN\\\nD\n${fixed1}`)).toBe(true);
    expect(
      check01(
        `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\nexport HCCL_BUFFSIZE=1024\nfor item in a b; do test "$item" = b && ${body1}; done`,
      ),
    ).toBe(true);
    expect(
      check01(
        `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\nexport HCCL_BUFFSIZE=1024\nbash -c 'for item do test "$item" = b && ${body1}; done' _ a b`,
      ),
    ).toBe(true);
    const P8CcDotted = P8.replace(
      `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
      "-cc.cudagraph_mode FULL_DECODE_ONLY",
    );
    expect(check08(`${P8CcDotted} -cc.pass_config.sp_min_token_num １２`)).toBe(true);
    expect(check08(`${P8CcDotted} -cc.pass_config.sp_min_token_num +9007199254740993`)).toBe(true);
    expect(
      check01(`${fixed1} --kv-transfer-config '{"kv_connector":"PdConnector","kv_role":"kv_both"}'`),
    ).toBe(false);
    expect(sc5.debrief.takeaway).toContain("64m");
    expect(sc5.debrief.takeaway).not.toContain("排查 --shm-size=16g");
  });

  it("Round-10 Codex closure (v8): CASE-01 EI0006 terminology, host NPU bounds/dedup, regular file bind rejection, --ipc/--publish bounds, redirection EISDIR/hosts, pwd/printf -v, fn-before-export, unset -f, pipefail/nounset/set-opt, numeric $?/$$, invalid/64-bit exit, $var for-splitting, arith short-circuit & i64 wrap, exact BigInt & Unicode suffix, explicit connector modules, X='abc' & errexit condition fn", () => {
    const sc1 = getWarGameScenario("rank3-oom-ei0006");
    const fixed1 = sc1.initialCommand.replace(
      "--gpu-memory-utilization 0.96",
      "--gpu-memory-utilization 0.88",
    );
    const body1 = fixed1.slice(fixed1.indexOf("vllm serve"));
    const sc5 = getWarGameScenario("exit-137-cgroup-sigkill");
    const fixed5 = sc5.initialCommand
      .replace("CUDA_VISIBLE_DEVICES=0,1,2,3", "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3")
      .replace("--shm-size=64m", "--shm-size=16g")
      .replace("--memory=32g", "--memory=128g");
    const sc8 = getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap");
    const P8 = sc8.initialCommand
      .replace(
        "HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9",
        "HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0",
      )
      .replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11");
    const D8 = (sc8.initialDecodeCommand ?? "").replace("HCCL_BUFFSIZE=8", "HCCL_BUFFSIZE=128");
    const check01 = (cmd: string) =>
      judgeWarGameSubmission({ scenarioId: sc1.id, selectedOptionId: "B", commandText: cmd }).passed;
    const check05 = (cmd: string) =>
      judgeWarGameSubmission({ scenarioId: sc5.id, selectedOptionId: "B", commandText: cmd }).passed;
    const check08 = (p: string, d = D8) =>
      judgeWarGameSubmission({
        scenarioId: sc8.id,
        selectedOptionId: "C",
        commandText: p,
        decodeCommandText: d,
      }).passed;

    // v8 P2-1: CASE-01 EI0006 authentic socket setup timeout wording
    expect(sc1.telemetryText).toContain("EI0006 Getting socket times out!");
    expect(sc1.telemetryText).not.toContain("Notify wait execute timeout");

    // v8 P1-1..P1-3: CASE-05 host NPU range/uniqueness, directory source, --ipc & --publish
    expect(check05(fixed5.replace("--device=/dev/davinci0", "--device=/dev/davinci99:/dev/davinci0"))).toBe(
      false,
    );
    expect(check05(fixed5.replace("--device=/dev/davinci0", "--device=/dev/davinci1:/dev/davinci0"))).toBe(
      false,
    );
    expect(check05(fixed5.replace("-v /models:/models", "-v /etc/hosts:/models"))).toBe(false);
    expect(
      check05(
        fixed5.replace(
          "-v /usr/local/Ascend/driver/lib64/:/usr/local/Ascend/driver/lib64/",
          "-v /etc/passwd:/usr/local/Ascend/driver/lib64/",
        ),
      ),
    ).toBe(false);
    expect(check05(fixed5.replace("--shm-size=16g", "--shm-size=16g --ipc=none"))).toBe(false);
    expect(check05(fixed5.replace("--shm-size=16g", "--shm-size=16g --ipc=unknown"))).toBe(false);
    expect(check05(fixed5.replace("--shm-size=16g", "--shm-size=16g --publish=70000:70000"))).toBe(false);
    expect(check05(fixed5.replace("--shm-size=16g", "--shm-size=16g --publish=8000:8000/tcp"))).toBe(true);

    // v8 P1-4..P1-13: Bash semantics parity
    expect(check01(fixed1.replace("vllm serve", "(true) > / && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "(true) < /etc/hosts && vllm serve"))).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "pwd -Z && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "pwd -P && vllm serve"))).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "printf -v bad-name '%s' x && vllm serve"))).toBe(false);
    expect(
      check01(
        fixed1.replace("vllm serve", "printf -v ok_name '%s' abc && test \"$ok_name\" = abc && vllm serve"),
      ),
    ).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "export() { return 1; }\nexport X=1 && vllm serve"))).toBe(
      false,
    );
    expect(
      check01(fixed1.replace("vllm serve", "export() { return 1; }\ncommand export X=1 && vllm serve")),
    ).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "f() { :; }\nunset -f f\nf && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "set -o pipefail; false | true && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "set -o pipefail; true | true && vllm serve"))).toBe(true);
    expect(check01(fixed1.replace("vllm serve", 'set -u; echo "$UNSET_VAR" && vllm serve'))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "set -o bad_audit_option && vllm serve"))).toBe(false);
    expect(
      check01(fixed1.replace("vllm serve", 'f() { return 42; }\nf; test "$?" -eq 1 && vllm serve')),
    ).toBe(false);
    expect(
      check01(fixed1.replace("vllm serve", 'f() { return 42; }\nf; test "$?" -eq 42 && vllm serve')),
    ).toBe(true);
    expect(check01(fixed1.replace("vllm serve", 'test "$$" = 0 && vllm serve'))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "(exit '') && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "(exit 9223372036854775808) && vllm serve"))).toBe(false);
    expect(
      check01(
        `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\nexport HCCL_BUFFSIZE=1024\nitems=a\nfor x in $items; do ${body1}; done\n${body1}`,
      ),
    ).toBe(false);
    expect(
      check01(
        `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\nexport HCCL_BUFFSIZE=1024\nitems="a b"\nfor x in $items; do test "$x" = b && ${body1}; done`,
      ),
    ).toBe(true);
    expect(check01(fixed1.replace("vllm serve", 'x=0; ((1 || ++x)); test "$x" -eq 1 && vllm serve'))).toBe(
      false,
    );
    expect(check01(fixed1.replace("vllm serve", "(( 9223372036854775807 + 1 > 0 )) && vllm serve"))).toBe(
      false,
    );
    expect(check01(fixed1.replace("vllm serve", "(( 9223372036854775807 + 1 < 0 )) && vllm serve"))).toBe(
      true,
    );

    // v8 P2-4..P2-8
    expect(parseDottedJsonValue("+9007199254740993")).toBe(9007199254740993n);
    expect(parseDottedJsonValue("１２k")).toBe(12000);
    expect(parseDottedJsonValue("１K")).toBe(1024);
    const P8CcDotted = P8.replace(
      `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
      "-cc.cudagraph_mode FULL_DECODE_ONLY",
    );
    expect(
      check08(`${P8CcDotted} -cc.pass_config.sp_min_token_num １２k -cc.max_cudagraph_capture_size １K`),
    ).toBe(true);
    expect(
      check08(
        P8.replace(
          "--kv-transfer-config",
          `--kv-transfer-config '{"kv_connector":"AscendSimpleCPUOffloadConnector","kv_role":"kv_both","kv_connector_module_path":"vllm_ascend.distributed.kv_transfer.kv_pool.simple_cpu_offload.simple_cpu_offload_connector"}' --kv-transfer-config`,
        ),
      ),
    ).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "X='abc'; test \"$X\" = abc && vllm serve"))).toBe(true);
    expect(check08(P8.replace("export HCCL_IF_IP=", "HCCL_CONNECT_TIMEOUT=120 export HCCL_IF_IP="))).toBe(
      true,
    );
    expect(check01(fixed1.replace("vllm serve", "f() { false; return 0; }\nset -e\nf && vllm serve"))).toBe(
      true,
    );
    expect(check01(fixed1.replace("vllm serve", "f() { false; echo dead; }\nset -e\nf; vllm serve"))).toBe(
      false,
    );
  });

  it("Round-11 Codex closure (v9): CASE-01 wording, CASE-05 canonical davinci/mount shadowing/--ipc case/-p/--mount options, unlisted connector, BigInt runtime retention, shell loop/redir/glob/scoping/printf/expansion fixes", () => {
    const sc1 = getWarGameScenario("rank3-oom-ei0006");
    const fixed1 = sc1.initialCommand.replace(
      "--gpu-memory-utilization 0.96",
      "--gpu-memory-utilization 0.88",
    );
    const body1 = fixed1.slice(fixed1.indexOf("vllm serve"));
    const sc5 = getWarGameScenario("exit-137-cgroup-sigkill");
    const fixed5 = sc5.initialCommand
      .replace("CUDA_VISIBLE_DEVICES=0,1,2,3", "ASCEND_RT_VISIBLE_DEVICES=0,1,2,3")
      .replace("--shm-size=64m", "--shm-size=16g")
      .replace("--memory=32g", "--memory=128g");
    const sc8 = getWarGameScenario("a3-pd-mc2-buffsize-ifname-trap");
    const P8 = sc8.initialCommand
      .replace(
        "HCCL_SOCKET_IFNAME=eth9 GLOO_SOCKET_IFNAME=eth9",
        "HCCL_SOCKET_IFNAME=enp65s0f0 GLOO_SOCKET_IFNAME=enp65s0f0",
      )
      .replace("HCCL_IF_IP=192.0.2.12", "HCCL_IF_IP=192.0.2.11");
    const D8 = (sc8.initialDecodeCommand ?? "").replace("HCCL_BUFFSIZE=8", "HCCL_BUFFSIZE=128");
    const check01 = (cmd: string) =>
      judgeWarGameSubmission({ scenarioId: sc1.id, selectedOptionId: "B", commandText: cmd }).passed;
    const check05 = (cmd: string) =>
      judgeWarGameSubmission({ scenarioId: sc5.id, selectedOptionId: "B", commandText: cmd }).passed;
    const check08 = (p: string, d = D8) =>
      judgeWarGameSubmission({
        scenarioId: sc8.id,
        selectedOptionId: "C",
        commandText: p,
        decodeCommandText: d,
      }).passed;

    // v9 P2 #9: CASE-01 authentic Available KV cache vs capture_model() attribution
    expect(sc1.debrief.takeaway).toContain("capture_model()");
    expect(sc1.debrief.takeaway).not.toContain("阶段，可用 KV");

    // v9 P1 #1..#6: CASE-05 Docker strictness
    expect(check05(fixed5.replace("--device=/dev/davinci0", "--device=/dev/davinci00:/dev/davinci0"))).toBe(
      false,
    );
    expect(
      check05(fixed5.replace("--device=/dev/davinci0", "--device=/dev/nonexistent-audit:/dev/davinci0")),
    ).toBe(false);
    expect(
      check05(
        fixed5.replace("-v /models:/models", "-v /models:/models -v /dev/null:/models/Qwen3-30B-A3B-W8A8"),
      ),
    ).toBe(false);
    expect(check05(fixed5.replace("-v /models:/models", "-v /usr:/models"))).toBe(false);
    expect(check05(fixed5.replace("--shm-size=16g", "--shm-size=16g --ipc=HOST"))).toBe(false);
    expect(check05(fixed5.replace("--shm-size=16g", "--shm-size=16g -p 8000-8001:9000-9002"))).toBe(false);
    expect(check05(fixed5.replace("--shm-size=16g", "--shm-size=16g -p [:::]8000:8000"))).toBe(false);
    expect(check05(fixed5.replace("--shm-size=16g", "--shm-size=16g -p [::1]:8000:8000"))).toBe(true);
    expect(
      check05(
        fixed5.replace(
          "-v /models:/models",
          "--mount type=bind,source=/models,target=/models,bind-nonrecursive=bogus",
        ),
      ),
    ).toBe(false);

    // v9 P2 #1..#3: Connectors + BigInt precision
    expect(
      check08(
        P8.replace(
          "--kv-transfer-config",
          `--kv-transfer-config '{"kv_connector":"DefinitelyMissingConnector","kv_role":"kv_both","kv_connector_module_path":"vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_hybrid_connector"}' --kv-transfer-config`,
        ),
      ),
    ).toBe(false);
    expect(
      check08(
        P8.replace(
          "--kv-transfer-config",
          `--kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_both","kv_connector_module_path":"vllm_ascend.distributed.kv_transfer.kv_p2p.mooncake_hybrid_connector"}' --kv-transfer-config`,
        ),
      ),
    ).toBe(true);
    expect(parseDottedJsonValue("9007199254740993")).toBe(9007199254740993n);
    const P8CcDotted = P8.replace(
      `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`,
      "-cc.cudagraph_mode FULL_DECODE_ONLY",
    );
    expect(check08(`${P8CcDotted} -cc.pass_config.sp_min_token_num 9007199254740993`)).toBe(true);

    // v9 P1 #7..#20 & P2 #4..#6: Shell parser/evaluator & expansion parity
    expect(
      check01(
        `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\nexport HCCL_BUFFSIZE=1024\nfor ((i=0;i<65;i++)); do true; done\n${body1}`,
      ),
    ).toBe(true);
    expect(
      check01(
        `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\nexport HCCL_BUFFSIZE=1024\nfor d in /usr/bi[n]; do test "$d" = /usr/bin && ${body1}; done`,
      ),
    ).toBe(true);
    expect(
      check01(fixed1.replace("vllm serve", "cat /usr/bin/env >/dev/null && cd /usr && vllm serve")),
    ).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "sleep inf && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "mkdir /tmp && vllm serve"))).toBe(false);
    expect(check01(fixed1.replace("vllm serve", "mkdir -p /tmp && vllm serve"))).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "bash -o bogus_audit_opt -c true && vllm serve"))).toBe(
      false,
    );
    expect(check01(fixed1.replace("vllm serve", "command() { return 1; }\ncommand true && vllm serve"))).toBe(
      false,
    );
    expect(
      check01(
        fixed1.replace("vllm serve", 'X=a; fn() { test "$X" = b; }\nX=b fn && test "$X" = a && vllm serve'),
      ),
    ).toBe(true);
    expect(
      check01(fixed1.replace("vllm serve", "printf -v pv '%04d' 7 && test \"$pv\" = 0007 && vllm serve")),
    ).toBe(true);
    expect(
      check01(
        fixed1.replace(
          "vllm serve",
          `${'env printf -v pv "%s" abc >/dev/null 2>&1; test -z "$'}{pv:-}" && vllm serve`,
        ),
      ),
    ).toBe(true);
    expect(check01(fixed1.replace("vllm serve", 'x="a b"; test "$x" = $x && vllm serve'))).toBe(false);
    expect(
      check01(fixed1.replace("vllm serve", `${'echo "$'}{MISSING_AUDIT_VAR:?required}"; vllm serve`)),
    ).toBe(false);
    expect(
      check01(fixed1.replace("vllm serve", 'set -- hello b && test "$#$1" = 2hello && vllm serve')),
    ).toBe(true);
    expect(check01(fixed1.replace("vllm serve", "(exit 0 1) || vllm serve"))).toBe(true);
    expect(
      check01(
        `export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3\nexport HCCL_BUFFSIZE=1024\nif false; then :; else test "$?" -eq 1 && ${body1}; fi`,
      ),
    ).toBe(true);
    expect(check01(fixed1.replace("vllm serve", 'test "$$" = 12345 && vllm serve'))).toBe(false);
    expect(
      check01(
        fixed1.replace("vllm serve", 'f() { test "$10" = "a0"; }\nf a b c d e f g h i z && vllm serve'),
      ),
    ).toBe(true);

    // Post-merge seam closure: reject max_num_batched_tokens < max_num_seqs and mixed broken mgmt NIC in HCCL_SOCKET_IFNAME
    expect(
      check08(
        P8.replace("--max-num-seqs 128", "--max-num-seqs 4096").replace(
          "--max-num-batched-tokens 2048",
          "--max-num-batched-tokens 2048",
        ),
        D8,
      ),
    ).toBe(false);
    expect(check08(P8.replace("HCCL_SOCKET_IFNAME=enp65s0f0", "HCCL_SOCKET_IFNAME=eth9,enp65s0f0"), D8)).toBe(
      false,
    );
  });
});
