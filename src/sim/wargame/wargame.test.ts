import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSourceRef } from "../rules";
import { judgeWarGameSubmission } from "./judge";
import {
  DEFAULT_WARGAME_SCENARIO_ID,
  getWarGameScenario,
  isWarGameScenarioId,
  WARGAME_SCENARIO_IDS,
  WARGAME_SCENARIOS,
} from "./scenarios";

const here = dirname(fileURLToPath(import.meta.url));

describe("Track 3B wargame scenarios & deterministic anti-cheat judge", () => {
  it("enforces sim-layer purity (no React, Zustand, content, or app imports) and 6 scenario contracts", () => {
    for (const rel of ["./scenarios.ts", "./judge.ts"]) {
      const src = readFileSync(resolve(here, rel), "utf8");
      expect(src).not.toMatch(/from\s+["']react/);
      expect(src).not.toMatch(/from\s+["']zustand/);
      expect(src).not.toMatch(/from\s+["'][^"']*(?:content|app)\//);
    }

    expect(WARGAME_SCENARIOS).toHaveLength(6);
    expect(WARGAME_SCENARIO_IDS).toEqual([
      "rank3-oom-ei0006",
      "910b3-u090-aclgraph-oom",
      "metrics-preemption-avalanche",
      "legacy-v030-silent-degrade",
      "exit-137-cgroup-sigkill",
      "pd-mooncake-kv-mismatch",
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
        commandText: fixed1.replace("Qwen/Qwen3-30B-A3B", "Qwen/Qwen3-8B"),
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
  });
});
