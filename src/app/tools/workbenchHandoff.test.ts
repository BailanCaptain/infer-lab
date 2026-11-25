import { describe, expect, it } from "vitest";
import { FULL_SINGLE_DOCTOR_PRESETS } from "../../sim/doctor/presets";
import { TROUBLESHOOT_FIXTURES } from "../../sim/troubleshoot/fixtures";
import { RANK_PATTERNS as LOG_ANALYZER_RANK_PATTERNS } from "../../sim/troubleshoot/logAnalyzer";
import {
  applyControlledTabQueryUpdate,
  buildAiCoreQueryParams,
  buildCalculatorQueryParams,
  buildDeployChatAnalysis,
  buildDoctorChatAnalysis,
  buildDoctorQueryParams,
  buildDoctorShareLink,
  buildTroubleshootChatAnalysis,
  buildTroubleshootQueryParams,
  cardIdToHardwareFamily,
  createWorkbenchHandoffStore,
  decodeDoctorCommandParam,
  encodeDoctorCommandParam,
  extractLineIdentitySpans,
  extractRank,
  hasReconcilableStartupMetrics,
  MAX_DOCTOR_COMMAND_CHARS,
  MAX_WORKBENCH_SHARE_URL_CHARS,
  matchExactDoctorPresetId,
  matchExactTroubleshootFixtureId,
  parseAiCoreQueryParams,
  parseCalculatorQueryParams,
  parseDoctorQueryParams,
  parseTroubleshootQueryParams,
  RANK_PATTERNS,
  resolveToolsBackTarget,
  sanitizeDiagnosticText,
} from "./workbenchHandoff";

describe("workbenchHandoff 跨工具交接、白名单参数与脱敏快照", () => {
  it("sanitizeDiagnosticText 脱敏 Bearer Token / API Key / 内网 IPv4，同时保留版本号、显存数字与核心术语", () => {
    const raw = [
      "HF_TOKEN=hf_SecretTokenValue987654321 vllm serve Qwen/Qwen3-30B-A3B \\",
      "  --api-key sk-live-abcdef1234567890 \\",
      "  --host 10.24.18.92 --port 8100 \\",
      '  --kv-transfer-config \'{"kv_connector":"MooncakeConnectorV1","prefill_url":"http://user:pass@192.168.12.34:8200"}\'',
      "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret",
      "Rank 3 Available KV cache memory: 24.80 GiB on v0.30.0",
    ].join("\n");

    const { sanitized, redactionCount } = sanitizeDiagnosticText(raw);
    expect(redactionCount).toBeGreaterThanOrEqual(4);
    expect(sanitized).not.toContain("hf_SecretTokenValue987654321");
    expect(sanitized).not.toContain("sk-live-abcdef1234567890");
    expect(sanitized).not.toContain("10.24.18.92");
    expect(sanitized).not.toContain("192.168.12.34");
    expect(sanitized).not.toContain("user:pass@");
    expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");

    // 核心诊断语义不能被误杀
    expect(sanitized).toContain("vllm serve");
    expect(sanitized).toContain("MooncakeConnectorV1");
    expect(sanitized).toContain("Rank 3");
    expect(sanitized).toContain("24.80 GiB");
    expect(sanitized).toContain("v0.30.0");
  });

  it("P1-6: sanitizeDiagnosticText 全量遮蔽 --api-key / --token 后续所有连续非选项值且尊重引号与换行边界", () => {
    const raw = [
      "vllm serve Qwen/Qwen3-8B --api-key EXAMPLE_ONE EXAMPLE_TWO --port 8000 --max-num-batched-tokens 4096",
      'bash -c "vllm serve Qwen/Qwen3-8B --token TOK_ALPHA TOK_BETA" --other',
      "vllm serve Qwen/Qwen3-8B --api-key 'QUOTED ONE' \"QUOTED TWO\" --host 127.0.0.1",
      "vllm serve Qwen/Qwen3-8B --api-key EXAMPLE_LINE1 \\",
      "  EXAMPLE_LINE2 --port 8000",
      "vllm serve Qwen/Qwen3-8B --api-key KEY_LINE1",
      "Qwen/NextLineNotAKey",
    ].join("\n");

    const { sanitized, redactionCount } = sanitizeDiagnosticText(raw);
    expect(sanitized).toContain("--api-key [REDACTED] [REDACTED] --port 8000 --max-num-batched-tokens 4096");
    expect(sanitized).toContain('bash -c "vllm serve Qwen/Qwen3-8B --token [REDACTED] [REDACTED]" --other');
    expect(sanitized).toContain("--api-key [REDACTED] [REDACTED] --host <REDACTED_IP>");
    expect(sanitized).toContain("--api-key [REDACTED] \\\n  [REDACTED] --port 8000");
    expect(sanitized).toContain("--api-key [REDACTED]\nQwen/NextLineNotAKey");
    for (const secret of [
      "EXAMPLE_ONE",
      "EXAMPLE_TWO",
      "TOK_ALPHA",
      "TOK_BETA",
      "QUOTED ONE",
      "QUOTED TWO",
      "EXAMPLE_LINE1",
      "EXAMPLE_LINE2",
      "KEY_LINE1",
    ]) {
      expect(sanitized).not.toContain(secret);
    }
    expect(redactionCount).toBeGreaterThanOrEqual(9);
  });

  it("parseCalculatorQueryParams / buildCalculatorQueryParams 严格按白名单解析并忽略非法参数", () => {
    const valid = new URLSearchParams(
      "tab=calculator&panel=reconcile&preset=qwen3-30b-a3b&card=a3-die64g&precision=w8a8_dynamic&kv=int8&tp=4&pp=2&dp=2&dcp=2&ep=1&u=0.92&maxLen=65536&version=main",
    );
    const parsed = parseCalculatorQueryParams(valid);
    expect(parsed).toEqual({
      subMode: "reconcile",
      presetId: "qwen3-30b-a3b",
      cardId: "a3-die64g",
      weightPrecision: "w8a8_dynamic",
      kvCacheDtype: "int8",
      tpSize: 4,
      ppSize: 2,
      dpSize: 2,
      dcpSize: 2,
      enableEp: true,
      gpuMemoryUtilization: 0.92,
      maxModelLen: 65536,
      version: "main",
    });

    const roundTrip = buildCalculatorQueryParams({
      subMode: "static",
      presetId: "qwen3-8b",
      tpSize: 2,
      weightPrecision: "w8a8",
    });
    expect(roundTrip.get("tab")).toBe("calculator");
    expect(roundTrip.get("preset")).toBe("qwen3-8b");
    expect(roundTrip.get("tp")).toBe("2");
    expect(roundTrip.get("precision")).toBe("w8a8");

    const untrusted = new URLSearchParams(
      "tab=calculator&panel=hack&preset=<script>&card=evil-gpu&precision=fp4_fake&tp=7&pp=99&u=5.5&version=v99",
    );
    expect(parseCalculatorQueryParams(untrusted)).toEqual({});
  });

  it("resolveToolsBackTarget 支持合法的 ?fromPage=<id>&fromAnchor=<anchor> 并拦截外部注入路径", () => {
    expect(
      resolveToolsBackTarget(
        new URLSearchParams("tab=doctor&fromPage=core-cli-params&fromAnchor=静默改写规则"),
      ),
    ).toEqual({
      pathname: "/wiki/core-cli-params",
      hash: "#静默改写规则",
      fromPage: "core-cli-params",
    });

    expect(resolveToolsBackTarget(new URLSearchParams("tab=calculator&fromPage=kv-cache"))).toEqual({
      pathname: "/wiki/kv-cache",
      hash: "",
      fromPage: "kv-cache",
    });

    expect(resolveToolsBackTarget(new URLSearchParams("tab=calculator&fromPage=https://evil.com"))).toEqual({
      pathname: "/wiki",
      hash: "",
      fromPage: null,
    });

    expect(resolveToolsBackTarget(new URLSearchParams("tab=calculator"))).toEqual({
      pathname: "/wiki",
      hash: "",
      fromPage: null,
    });
  });

  it("cardIdToHardwareFamily、hasReconcilableStartupMetrics 与跨工具交接仓库单调消费", () => {
    expect(cardIdToHardwareFamily("a2-64g")).toBe("A2");
    expect(cardIdToHardwareFamily("a3-die64g")).toBe("A3");
    expect(cardIdToHardwareFamily("310p-24g")).toBe("310P");
    expect(cardIdToHardwareFamily("950dt-128g")).toBe("A5");

    expect(hasReconcilableStartupMetrics("INFO [Rank 0] Available KV cache memory: 24.80 GiB")).toBe(true);
    expect(hasReconcilableStartupMetrics("RuntimeError: NPU out of memory during capture_model")).toBe(true);
    expect(hasReconcilableStartupMetrics("ERROR [Rank 0] EI0006 Notify wait execute timeout")).toBe(false);

    const store = createWorkbenchHandoffStore();
    let notifications = 0;
    const unsub = store.subscribe(() => {
      notifications += 1;
    });

    store.sendToDoctor({
      commandText: "vllm serve Qwen/Qwen3-8B --tensor-parallel-size 2",
      hardwareFamily: "A2",
      version: "v0.30.0",
      sourceLabel: "Qwen3-8B · A2 64G",
    });
    expect(notifications).toBe(1);
    const doctorPayload = store.consumeDoctor(0);
    expect(doctorPayload).toMatchObject({
      seq: 1,
      hardwareFamily: "A2",
      commandText: "vllm serve Qwen/Qwen3-8B --tensor-parallel-size 2",
    });
    // 同一 seq 不重复消费，且模拟组件卸载重挂（lastConsumedSeq 重置为 0）时绝不重放旧交接
    expect(store.consumeDoctor(1)).toBeNull();
    expect(store.consumeDoctor(0)).toBeNull();
    expect(store.getState().doctorPayload).toBeNull();

    store.sendToDoctor({
      commandText: "vllm serve Qwen/Qwen3-30B-A3B --tensor-parallel-size 4",
      hardwareFamily: "A3",
      version: "main",
      sourceLabel: "Qwen3-30B-A3B · A3",
    });
    expect(store.consumeDoctor(0)).toMatchObject({
      seq: 2,
      hardwareFamily: "A3",
    });
    expect(store.consumeDoctor(0)).toBeNull();

    store.sendToReconcile({
      logText: "Available KV cache memory: 24.80 GiB",
      sourceLabel: "排障工作台首错 Rank 3",
    });
    const reconPayload = store.consumeReconcile(0);
    expect(reconPayload).toMatchObject({
      seq: 1,
      logText: "Available KV cache memory: 24.80 GiB",
    });
    expect(store.consumeReconcile(1)).toBeNull();
    // 模拟离开 /tools 后再以 ?tab=calculator&panel=static 重挂：不得重放已消费的 reconcile 载荷
    expect(store.consumeReconcile(0)).toBeNull();
    expect(store.getState().reconcilePayload).toBeNull();
    unsub();
  });

  it("P2-6: 工作台结构化 analysis 构造器仅保留白名单字段、脱敏凭据并控制体积上限", () => {
    const deploy = buildDeployChatAnalysis({
      model: "qwen3-8b",
      cardId: "a2-64g",
      version: "v0.30.0",
      weightPrecision: "bf16",
      kvCacheDtype: "auto",
      weightNzMode: 1,
      tpSize: 2,
      ppSize: 1,
      dpSize: 1,
      dcpSize: 1,
      enableEp: false,
      gpuMemoryUtilization: 0.9,
      maxModelLen: 32768,
      maxNumBatchedTokens: 4096,
      maxNumSeqs: 256,
      cudagraphMode: "PIECEWISE",
      enforceEager: false,
      prefillTokens: 512,
      decodeBatchSize: 16,
      decodeContextLen: 4096,
    });
    expect(deploy).toMatchObject({
      kind: "deploy",
      model: "qwen3-8b",
      cardId: "a2-64g",
      tpSize: 2,
      gpuMemoryUtilization: 0.9,
    });
    expect(
      buildDeployChatAnalysis({
        model: "   ",
        cardId: "a2-64g",
      }),
    ).toBeUndefined();

    const doctor = buildDoctorChatAnalysis({
      command: "vllm serve Qwen/Qwen3-8B --api-key sk-live-secret123456 --host 10.1.2.3",
      decodeCommand: "vllm serve Qwen/Qwen3-8B --host 10.1.2.4",
      mode: "full",
      hardwareFamily: "A2",
      decodeHardwareFamily: "A3",
      version: "v0.30.0",
      crossNodeRoce: true,
    });
    expect(doctor).toMatchObject({
      kind: "doctor",
      mode: "full",
      hardwareFamily: "A2",
      decodeHardwareFamily: "A3",
      version: "v0.30.0",
      crossNodeRoce: true,
    });
    expect(doctor?.command).not.toContain("sk-live-secret123456");
    expect(doctor?.command).not.toContain("10.1.2.3");
    expect(doctor?.decodeCommand).not.toContain("10.1.2.4");
    expect(buildDoctorChatAnalysis({ command: "   " })).toBeUndefined();

    const trouble = buildTroubleshootChatAnalysis(
      "ERROR [Rank 0] EI0006 host=192.168.1.9 Bearer eyJhbGciOiJIUzI1NiJ9.secret",
    );
    expect(trouble?.kind).toBe("troubleshoot");
    expect(trouble?.rawInput).toContain("EI0006");
    expect(trouble?.rawInput).not.toContain("192.168.1.9");
    expect(trouble?.rawInput).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(buildTroubleshootChatAnalysis("   ")).toBeUndefined();
  });

  it("C.1: buildCalculatorQueryParams 显式保留 pp=1 / dp=1 与批处理/图模式覆盖，防止 deepseek-v3-mla 回退到默认 PP=2", () => {
    const sharePp1 = buildCalculatorQueryParams({
      subMode: "static",
      presetId: "deepseek-v3-mla",
      cardId: "950dt-128g",
      weightPrecision: "w8a8_dynamic",
      tpSize: 8,
      ppSize: 1,
      dpSize: 1,
      dcpSize: 1,
      enableEp: true,
      maxModelLen: 32768,
      maxNumBatchedTokens: 4096,
      maxNumSeqs: 64,
      cudagraphMode: "FULL_DECODE_ONLY",
      enforceEager: false,
      weightNzMode: 2,
    });
    expect(sharePp1.get("pp")).toBe("1");
    expect(sharePp1.get("dp")).toBe("1");
    expect(sharePp1.get("dcp")).toBe("1");
    const reloaded = parseCalculatorQueryParams(sharePp1);
    expect(reloaded.presetId).toBe("deepseek-v3-mla");
    expect(reloaded.ppSize).toBe(1);
    expect(reloaded.dpSize).toBe(1);
    expect(reloaded.dcpSize).toBe(1);
    expect(reloaded.maxNumBatchedTokens).toBe(4096);
    expect(reloaded.maxNumSeqs).toBe(64);
    expect(reloaded.cudagraphMode).toBe("FULL_DECODE_ONLY");
    expect(reloaded.enforceEager).toBe(false);
    expect(reloaded.weightNzMode).toBe(2);
  });

  it("C.2: >64KB 超长日志截断保留首部上下文 + 故障窗口 + 尾部现场，且 Doctor analysis 支持 modelId / modelTraitOverride", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");
    const headLines = [
      "2026-11-20 10:00:00.100 [Rank 0] INFO Available KV cache memory: 24.80 GiB",
      "2026-11-20 10:00:00.200 [Rank 0] INFO Entering compile_or_warm_up_model and capture_model",
    ];
    const fillerLines = Array.from(
      { length: 900 },
      (_, idx) =>
        `2026-11-20 10:01:${String(idx % 60).padStart(2, "0")}.000 [Rank ${idx % 8}] INFO Prefill batch step=${idx} ${"x".repeat(42)}`,
    );
    // Place root-cause fault well beyond 65,536 chars (~69,000+ chars)
    const tailFaultLines = [
      "2026-11-20 10:05:12.050 [Rank 5] RuntimeError: NPU out of memory during capture_model (ACL_ERROR_RT_MEMORY_ALLOCATION)",
      "2026-11-20 10:05:20.900 [Rank 0] ERROR EI0006 Notify wait execute timeout waiting for peer rank",
      "2026-11-20 10:05:21.000 [Rank 2] ERROR EI0006 Notify wait execute timeout waiting for peer rank",
    ];
    const longLog = [...headLines, ...fillerLines, ...tailFaultLines].join("\n");
    expect(longLog.length).toBeGreaterThan(68_000);

    const clientDiag = analyzeTroubleshootInput(longLog);
    expect(clientDiag.firstFaultVerdict.rank).toBe(5);

    const payload = buildTroubleshootChatAnalysis(longLog);
    expect(payload).toBeDefined();
    expect(payload!.rawInput.length).toBeLessThanOrEqual(65_536);

    const serverSideDiag = analyzeTroubleshootInput(payload!.rawInput);
    expect(serverSideDiag.firstFaultVerdict.rank).toBe(clientDiag.firstFaultVerdict.rank);
    expect(serverSideDiag.findings.map((f) => f.ruleId)).toEqual(clientDiag.findings.map((f) => f.ruleId));

    // Doctor modelId / modelTraitOverride handoff
    const docAnalysis = buildDoctorChatAnalysis({
      command: "vllm serve /models/custom-local-ckpt -tp 10 --decode-context-parallel-size 2",
      mode: "full",
      hardwareFamily: "A2",
      version: "v0.30.0",
      modelId: "qwen3-30b-a3b",
    });
    expect(docAnalysis?.modelId).toBe("qwen3-30b-a3b");
    expect(docAnalysis?.modelTraitOverride).toMatchObject({
      isMoe: true,
      numAttentionHeads: 32,
      numKvHeads: 4,
    });
  });

  it("R2.5: >320KB log with thousands of benign INFO HCCL lines & >8KB single overlong line with tail fault both preserve real RuntimeError", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");

    // (a) 325 KB log flooded with benign INFO HCCL chatter before a real RuntimeError
    const benignHcclFlood = Array.from(
      { length: 4200 },
      (_, idx) =>
        `2026-11-20 10:02:${String(idx % 60).padStart(2, "0")}.000 [Rank ${idx % 8}] INFO HCCL communicator init progress step=${idx} ${"m".repeat(26)}`,
    );
    const trailingChatter = Array.from(
      { length: 400 },
      (_, idx) =>
        `2026-11-20 10:09:00.${String(idx).padStart(3, "0")} [Rank 0] INFO cleanup step=${idx} ${"c".repeat(45)}`,
    );
    const hugeFloodLog = [
      "2026-11-20 10:00:00.100 [Rank 0] INFO Available KV cache memory: 18.00 GiB",
      ...benignHcclFlood,
      "2026-11-20 10:06:30.500 [Rank 3] RuntimeError: NPU out of memory during capture_model (ACL_ERROR_RT_MEMORY_ALLOCATION)",
      ...trailingChatter,
    ].join("\n");
    expect(hugeFloodLog.length).toBeGreaterThan(320_000);

    const floodPayload = buildTroubleshootChatAnalysis(hugeFloodLog);
    expect(floodPayload).toBeDefined();
    expect(floodPayload!.rawInput.length).toBeLessThanOrEqual(65_536);
    const floodDiag = analyzeTroubleshootInput(floodPayload!.rawInput);
    expect(floodDiag.firstFaultVerdict.rank).toBe(3);
    expect(floodDiag.findings.some((f) => f.ruleId === "oom-stage-split")).toBe(true);

    // (b) Overlong >8KB single line whose fault marker is at the very tail inside a >70KB log
    const tailFaultOverlongLine = `[Rank 7] structured_json_dump=${"a".repeat(8200)} RuntimeError: NPU out of memory during capture_model (ACL_ERROR_RT_MEMORY_ALLOCATION)`;
    const overlongLog = [
      ...Array.from(
        { length: 850 },
        (_, i) => `2026-11-20 10:00:01.000 [Rank 0] INFO step=${i} ${"x".repeat(55)}`,
      ),
      tailFaultOverlongLine,
      ...Array.from(
        { length: 120 },
        (_, i) => `2026-11-20 10:05:00.000 [Rank 0] INFO post=${i} ${"y".repeat(55)}`,
      ),
    ].join("\n");
    expect(overlongLog.length).toBeGreaterThan(70_000);

    const overlongPayload = buildTroubleshootChatAnalysis(overlongLog);
    expect(overlongPayload).toBeDefined();
    const overlongDiag = analyzeTroubleshootInput(overlongPayload!.rawInput);
    expect(overlongDiag.firstFaultVerdict.rank).toBe(7);
    expect(overlongDiag.findings.some((f) => f.ruleId === "oom-stage-split")).toBe(true);
  });

  it("R3.5: overlong line boundary split ([Rank 5] + 4600ch + RuntimeError) & negative exitcode=-9 followed by 80 normal lines preserve exact diagnosis after truncation", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");
    const { runDeterministicToolEvidence } = await import("../../../server/tool-evidence");

    const n = "INFO HCCL init OK\n";
    const first = `[Rank 5] ${"h".repeat(4600)} RuntimeError: worker died ${"x".repeat(1380)}`;
    const last = `[Rank 0] ${"z".repeat(4100)} exitcode=-9`;
    const log = `${n.repeat(3800)}${first}\n${n.repeat(12)}${last}\n${n.repeat(80)}`;
    expect(log.length).toBeGreaterThan(80_000);

    const fullDiag = analyzeTroubleshootInput(log);
    expect(fullDiag.firstFaultVerdict.rank).toBe(5);
    expect(fullDiag.findings.some((f) => f.ruleId === "exit-137-sigkill")).toBe(true);

    const truncatedPayload = buildTroubleshootChatAnalysis(log);
    expect(truncatedPayload).toBeDefined();
    expect(truncatedPayload!.rawInput.length).toBeLessThanOrEqual(65_536);

    const truncDiag = analyzeTroubleshootInput(truncatedPayload!.rawInput);
    expect(truncDiag.firstFaultVerdict.rank).toBe(fullDiag.firstFaultVerdict.rank);
    expect(truncDiag.findings.map((f) => f.ruleId)).toEqual(fullDiag.findings.map((f) => f.ruleId));

    const serverEv = runDeterministicToolEvidence(truncatedPayload!);
    expect(serverEv.keyMetrics.firstFaultRank).toBe(5);
    expect(String(serverEv.keyMetrics.topRuleIds)).toContain("exit-137-sigkill");
  });

  it("R4.2: compactOverlongLine has no 3-match cap so [Rank 5] ERROR RuntimeError: ChildFailedError: ... exitcode=-9 preserves exit-137-sigkill", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");
    const log =
      `[Rank 5] ERROR RuntimeError: ChildFailedError: ${"x".repeat(1600)} exitcode=-9 ${"y".repeat(2200)}\n` +
      "ok\n".repeat(21000);
    expect(log.length).toBeGreaterThan(66_000);

    const payload = buildTroubleshootChatAnalysis(log);
    expect(payload).toBeDefined();
    expect(payload!.rawInput.length).toBeLessThanOrEqual(65_536);

    const diag = analyzeTroubleshootInput(payload!.rawInput);
    expect(diag.firstFaultVerdict.rank).toBe(5);
    expect(diag.findings.some((f) => f.ruleId === "exit-137-sigkill")).toBe(true);

    // Repeated EI0006 tokens on the same overlong line must NOT squeeze out Tier-0 exitcode=-9 or [Rank 5]
    const repeatedEiLog =
      `[Rank 5] ERROR RuntimeError: ChildFailedError: ${`EI0006 ${"x".repeat(540)} `.repeat(6)} exitcode=-9 ${"y".repeat(1600)}\n` +
      "ok\n".repeat(22000);
    const repeatedPayload = buildTroubleshootChatAnalysis(repeatedEiLog);
    expect(repeatedPayload).toBeDefined();
    const repeatedDiag = analyzeTroubleshootInput(repeatedPayload!.rawInput);
    expect(repeatedDiag.firstFaultVerdict.rank).toBe(5);
    expect(repeatedDiag.findings.some((f) => f.ruleId === "exit-137-sigkill")).toBe(true);

    // Mid-line [Rank 5] at char ~905 (past headLen and >180 chars before ERROR) + 6x EI0006 + exitcode=-9 preserves Rank 5 & exit-137-sigkill
    const midLineRankLog =
      `${"p".repeat(905)}[Rank 5] ${"q".repeat(180)}ERROR RuntimeError: ChildFailedError: ${`EI0006 ${"x".repeat(540)} `.repeat(6)} exitcode=-9 ${"y".repeat(1600)}\n` +
      "ok\n".repeat(22000);
    const midLinePayload = buildTroubleshootChatAnalysis(midLineRankLog);
    expect(midLinePayload).toBeDefined();
    const midLineDiag = analyzeTroubleshootInput(midLinePayload!.rawInput);
    expect(midLineDiag.firstFaultVerdict.rank).toBe(5);
    expect(midLineDiag.findings.some((f) => f.ruleId === "exit-137-sigkill")).toBe(true);

    // Competing short timestamp (at 905) before full YYYY-MM-DD timestamp (at 1410) preserves full timestamp priority identical to logAnalyzer
    const competingTsLine = `${"a".repeat(905)}11-20 08:20:00.100 ${"b".repeat(485)}2026-11-20 08:00:00.100 ${"c".repeat(675)}[Rank 5] ${"d".repeat(180)}ERROR RuntimeError: ChildFailedError: exitcode=-9 ${"e".repeat(1800)}`;
    const competingTsLog = `${competingTsLine}\n2026-11-20 08:10:00.100 [Rank 2] ERROR RuntimeError: secondary\n${"ok\n".repeat(23000)}`;
    const competingPayload = buildTroubleshootChatAnalysis(competingTsLog);
    expect(analyzeTroubleshootInput(competingPayload!.rawInput).firstFaultVerdict.rank).toBe(5);
  });

  it("单一真相源收口：共享 logAnalyzer.RANK_PATTERNS，准确提取并保留 (Worker_TP0_EP0 pid=53742) 与 (Worker_DP1_TP3_EP7 pid=58361)", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");

    // 同一引用，杜绝私有正则副本漂移
    expect(RANK_PATTERNS).toBe(LOG_ANALYZER_RANK_PATTERNS);

    const tp0Ep0Line =
      "(Worker_TP0_EP0 pid=53742) INFO 11-23 02:42:59 [model_runner_v1.py:4476] Loading model weights took 14.2652 GB";
    const dp1Tp3Ep7Line =
      "(Worker_DP1_TP3_EP7 pid=58361) ERROR 11-23 02:50:40 [model_runner_v1.py:6612] torch.OutOfMemoryError: NPU out of memory. Tried to allocate 1.98 GiB";

    expect(extractRank(tp0Ep0Line)).toBe(0);
    expect(extractRank(dp1Tp3Ep7Line)).toBe(7);

    // 确认行身份高亮/截断窗口完整覆盖 Worker_TP0_EP0 与 Worker_DP1_TP3_EP7（即便落于超长行中段 > headLen）
    const midTp0Ep0 = `${"p".repeat(920)}${tp0Ep0Line} ${"q".repeat(3200)}`;
    const midDp1Tp3Ep7 = `${"p".repeat(920)}(Worker_DP1_TP3_EP7 pid=58361) ${"q".repeat(180)}ERROR 11-23 02:50:40 RuntimeError: NPU out of memory ${`EI0006 ${"x".repeat(540)} `.repeat(6)} ${"y".repeat(1600)}`;

    const spansTp0 = extractLineIdentitySpans(midTp0Ep0);
    expect(spansTp0.some(([s, e]) => midTp0Ep0.slice(s, e).includes("Worker_TP0_EP0"))).toBe(true);
    expect(spansTp0.some(([s, e]) => midTp0Ep0.slice(s, e).includes("11-23 02:42:59"))).toBe(true);

    const spansEp7 = extractLineIdentitySpans(midDp1Tp3Ep7);
    expect(spansEp7.some(([s, e]) => midDp1Tp3Ep7.slice(s, e).includes("Worker_DP1_TP3_EP7"))).toBe(true);
    expect(spansEp7.some(([s, e]) => midDp1Tp3Ep7.slice(s, e).includes("11-23 02:50:40"))).toBe(true);

    // 经 >64KB 工作台交接截断后仍准确归因 Rank 7
    const hugeEpLog = `${tp0Ep0Line}\n${midDp1Tp3Ep7}\n${"INFO step ok\n".repeat(6000)}`;
    expect(hugeEpLog.length).toBeGreaterThan(68_000);
    const payload = buildTroubleshootChatAnalysis(hugeEpLog);
    expect(payload).toBeDefined();
    expect(payload!.rawInput).toContain("Worker_TP0_EP0");
    expect(payload!.rawInput).toContain("Worker_DP1_TP3_EP7");
    const diag = analyzeTroubleshootInput(payload!.rawInput);
    expect(diag.detectedRanks).toEqual([0, 7]);
    expect(diag.firstFaultVerdict.rank).toBe(7);
  });

  it("P2-6: 225KB+ 日志含 165 条不同签名 RuntimeError 时仍优先保留后续 Rank 0 NPU OOM，并还原原始行号", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");
    const head = [
      "(EngineCore pid=35805) INFO 11-22 20:58:45 [model_runner_v1.py:4476] Loading model weights took 1.1397 GB",
      "(EngineCore pid=35805) INFO 11-22 20:59:23 [worker.py:660] Available KV cache memory: 53.47 GiB",
    ];
    // 165 distinct-signature RuntimeErrors (~1,050 chars each -> ~173KB) before the decisive Rank 0 OOM
    const runtimeErrorStorm = Array.from({ length: 165 }, (_, i) => {
      const alphaTag = `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + (Math.floor(i / 26) % 26))}_${"k".repeat((i % 7) + 1)}`;
      return `(APIServer pid=35800) ERROR 11-22 20:59:40 [engine_client.py:${100 + i}] RuntimeError: transient_${alphaTag}_dispatch_warning payload=${"m".repeat(950)}`;
    });
    const fillerBeforeOom = Array.from(
      { length: 82 },
      (_, i) => `(EngineCore pid=35805) INFO 11-22 20:59:50 [runner.py:${i}] warmup tick ${"w".repeat(120)}`,
    );
    // Line 250 = capture_model frame, Line 251 = call, Line 252 = Rank 0 NPU OOM
    const oomBlock = [
      '(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]   File "/mnt/workspace/vllm_ascend/worker/model_runner_v1.py", line 6613, in capture_model',
      "(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366]     cuda_graph_size = GPUModelRunner.capture_model(self)",
      "(EngineCore pid=35805) ERROR 11-22 20:59:56 [core.py:1366] torch.OutOfMemoryError: NPU out of memory. Tried to allocate 1.98 GiB (NPU 0; 60.96 GiB total capacity)",
    ];
    const tailFiller = Array.from(
      { length: 240 },
      (_, i) =>
        `(APIServer pid=35800) INFO 11-22 20:59:59 [shutdown.py:${i}] cleanup phase ${"z".repeat(160)}`,
    );

    const fullLog = [...head, ...runtimeErrorStorm, ...fillerBeforeOom, ...oomBlock, ...tailFiller].join(
      "\n",
    );
    expect(fullLog.length).toBeGreaterThan(220_000);

    const fullDiag = analyzeTroubleshootInput(fullLog);
    const fullOom = fullDiag.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(fullOom).toBeDefined();
    expect(fullOom!.matchedLines[0]?.lineNumber).toBe(252);

    const payload = buildTroubleshootChatAnalysis(fullLog);
    expect(payload).toBeDefined();
    expect(payload!.rawInput.length).toBeLessThanOrEqual(65_536);
    expect(payload!.rawInput).toContain("NPU out of memory");
    expect(payload!.rawInput).toContain("in capture_model");

    const truncDiag = analyzeTroubleshootInput(payload!.rawInput);
    const truncOom = truncDiag.findings.find((f) => f.ruleId === "oom-stage-split");
    expect(truncOom).toBeDefined();
    expect(truncOom!.title).toContain("图捕获");
    expect(truncOom!.matchedLines[0]?.lineNumber).toBe(252);
    expect(truncDiag.firstFaultVerdict.rank).toBe(0);
    expect(truncDiag.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber).toBe(252);
  });

  it("P2-6 regression: leading blank lines (`\\n\\n`) preserve exact 1-based original line numbers across truncation", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");
    const filler252 = Array.from(
      { length: 252 },
      (_, i) => `(APIServer pid=100) INFO 11-22 20:00:00 [init.py:${i}] filler ${"a".repeat(260)}`,
    );
    const oomLine255 =
      "(Worker_TP0 pid=200) ERROR 11-22 20:01:00 [core.py:1366] torch.OutOfMemoryError: NPU out of memory (NPU 0)";
    const tail80 = Array.from(
      { length: 80 },
      (_, i) => `(APIServer pid=100) INFO 11-22 20:02:00 [end.py:${i}] done ${"b".repeat(120)}`,
    );
    // Two leading blank lines (`L1` and `L2`), then 252 filler lines (`L3..L254`), so OOM sits on exact `L255`!
    const rawWithLeadingNewlines = `\n\n${[...filler252, oomLine255, ...tail80].join("\n")}`;
    expect(rawWithLeadingNewlines.length).toBeGreaterThan(75_000);

    const fullDiag = analyzeTroubleshootInput(rawWithLeadingNewlines);
    expect(fullDiag.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber).toBe(255);

    const payload = buildTroubleshootChatAnalysis(rawWithLeadingNewlines);
    expect(payload).toBeDefined();
    const truncDiag = analyzeTroubleshootInput(payload!.rawInput);
    expect(truncDiag.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber).toBe(255);
  });

  it("Track 1B: 增强版 sanitizeDiagnosticText 拦截任意大小写 DB_PASSWORD/SECRET/KEY 环境变量、JSON 凭据与 --*secret*/--*password*，且零误伤 v0.30.0 与常规标志", () => {
    const raw = [
      "export DB_PASSWORD=SuperSecretDbPass!2026",
      "export db_passwd = 'single quoted pass' MY_SECRET_KEY=\"double quoted secret\"",
      "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE SSH_PRIVATE_KEY=priv_abc123456 REDIS_AUTH_TOKEN=rtok_999",
      "PYTORCH_NPU_ALLOC_CONF=expandable_segments:True HCCL_BUFFSIZE=1024 \\",
      "vllm serve Qwen/Qwen3-30B-A3B --api-key k1 k2 --db-password=cli_pw --redis-secret 'cli sec' \\",
      "  --max-num-batched-tokens 4096 --speculative-num-draft-tokens 4 --host 10.24.18.92 \\",
      '  --additional-config \'{"redis_password":"json_pw_val","enable_npugraph_ex":true}\' # baseline v0.30.0',
    ].join("\n");

    const { sanitized, redactionCount } = sanitizeDiagnosticText(raw);
    expect(redactionCount).toBeGreaterThanOrEqual(10);
    for (const leaked of [
      "SuperSecretDbPass!2026",
      "single quoted pass",
      "double quoted secret",
      "AKIAIOSFODNN7EXAMPLE",
      "priv_abc123456",
      "rtok_999",
      "k1",
      "k2",
      "cli_pw",
      "cli sec",
      "10.24.18.92",
      "json_pw_val",
    ]) {
      expect(sanitized).not.toContain(leaked);
    }
    expect(sanitized).toContain("v0.30.0");
    expect(sanitized).toContain("--max-num-batched-tokens 4096");
    expect(sanitized).toContain("--speculative-num-draft-tokens 4");
    expect(sanitized).toContain("PYTORCH_NPU_ALLOC_CONF=expandable_segments:True");
    expect(sanitized).toContain("HCCL_BUFFSIZE=1024");
    expect(sanitized).toContain('"enable_npugraph_ex":true');
  });

  it("Track 1B: ConfigDoctor 自动参数白名单、显式分享链接脱敏编码与 >4096 超长门禁拒绝截断", () => {
    const preset = FULL_SINGLE_DOCTOR_PRESETS[0]!;
    expect(
      matchExactDoctorPresetId({
        topology: "single",
        commandText: preset.command,
        prefillCommandText: "",
        decodeCommandText: "",
      }),
    ).toBe(preset.id);
    expect(
      matchExactDoctorPresetId({
        topology: "single",
        commandText: `${preset.command} --port 9000`,
        prefillCommandText: "",
        decodeCommandText: "",
      }),
    ).toBeUndefined();

    const preserve = new URLSearchParams("fromPage=core-cli-params&fromAnchor=静默改写");
    const autoParams = buildDoctorQueryParams(
      { topology: "single", hardwareFamily: "A3", version: "main", modelHint: "qwen3-30b-a3b" },
      preserve,
    );
    expect(autoParams.get("tab")).toBe("doctor");
    expect(autoParams.get("fromPage")).toBe("core-cli-params");
    expect(autoParams.get("fromAnchor")).toBe("静默改写");
    expect(autoParams.has("cmd")).toBe(false);
    expect(autoParams.has("preset")).toBe(false);

    expect(
      parseDoctorQueryParams(
        new URLSearchParams("topology=evil&preset=<script>&hw=H100&dhw=B200&ver=v99&hint=bad&cmd=%%%"),
      ),
    ).toEqual({});
  });

  it("Track 1B: buildDoctorShareLink 单机/PD 自定义命令 UTF-8 编解码往返、凭据脱敏计数与 >4096 硬门禁", () => {
    const preserve = new URLSearchParams("fromPage=pd-disaggregation&fromAnchor=拓扑约束");
    const singleShare = buildDoctorShareLink(
      {
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "qwen3-8b",
        crossNodeRoce: true,
        commandText:
          "DB_PASSWORD=top_secret vllm serve Qwen/Qwen3-8B --api-key k_one k_two --host 10.11.12.13 # 中文备注 v0.30.0",
      },
      preserve,
    );
    expect(singleShare.ok).toBe(true);
    if (singleShare.ok) {
      expect(singleShare.usesPresetOnly).toBe(false);
      expect(singleShare.redactionCount).toBe(4);
      expect(singleShare.url.length).toBeLessThanOrEqual(MAX_WORKBENCH_SHARE_URL_CHARS);
      expect(singleShare.url).not.toContain("top_secret");
      expect(singleShare.url).not.toContain("10.11.12.13");
      const decoded = parseDoctorQueryParams(singleShare.params);
      expect(decoded.hardwareFamily).toBe("A2");
      expect(decoded.modelHint).toBe("qwen3-8b");
      expect(decoded.crossNodeRoce).toBe(true);
      expect(decoded.sharedCommand).toContain("中文备注 v0.30.0");
      expect(decoded.sharedCommand).not.toContain("top_secret");
      expect(decoded.sharedCommand).not.toContain("k_one");
      expect(decoded.sharedCommand).not.toContain("10.11.12.13");
    }

    const pdShare = buildDoctorShareLink({
      topology: "pd",
      hardwareFamily: "A3",
      decodeHardwareFamily: "A2",
      version: "main",
      modelHint: "qwen3-30b-a3b",
      commandText: "",
      prefillCommandText: "vllm serve Qwen/Qwen3-30B-A3B -tp 4 --host 192.168.1.10",
      decodeCommandText: "REDIS_SECRET=sec99 vllm serve Qwen/Qwen3-30B-A3B -tp 2",
    });
    expect(pdShare.ok).toBe(true);
    if (pdShare.ok) {
      expect(pdShare.redactionCount).toBe(2);
      const parsedPd = parseDoctorQueryParams(pdShare.params);
      expect(parsedPd.topology).toBe("pd");
      expect(parsedPd.decodeHardwareFamily).toBe("A2");
      expect(parsedPd.sharedPrefillCommand).toContain("<REDACTED_IP>");
      expect(parsedPd.sharedDecodeCommand).toContain("REDIS_SECRET=[REDACTED_KEY]");
    }

    // Overlong >4096 URL rejected without silent truncation
    const overlongShare = buildDoctorShareLink({
      topology: "single",
      hardwareFamily: "A2",
      version: "v0.30.0",
      modelHint: "auto",
      commandText: `vllm serve Qwen/Qwen3-8B ${"--env-note x ".repeat(280)}`,
    });
    expect(overlongShare.ok).toBe(false);
    if (!overlongShare.ok) {
      expect(overlongShare.reason).toContain(String(MAX_WORKBENCH_SHARE_URL_CHARS));
    }

    // Receiver also rejects >4096 query string & >MAX_DOCTOR_COMMAND_CHARS decoded payload
    const bigEncoded = encodeDoctorCommandParam("vllm serve Qwen/Qwen3-8B ".repeat(140));
    expect(bigEncoded.length).toBeGreaterThan(MAX_WORKBENCH_SHARE_URL_CHARS);
    expect(parseDoctorQueryParams(new URLSearchParams({ cmd: bigEncoded })).sharedCommand).toBeUndefined();
    const overMaxDecoded = encodeDoctorCommandParam("a".repeat(MAX_DOCTOR_COMMAND_CHARS + 10));
    expect(decodeDoctorCommandParam(overMaxDecoded, 20_000)).toBeNull();
  });

  it("Track 1B: AiCoreLab 与 TroubleshootWorkbench 参数编解码、自由文本零同步与保活面板 URL 隔离", () => {
    const preserve = new URLSearchParams("fromPage=ai-core&fromAnchor=双缓冲流水");
    const aicoreParams = buildAiCoreQueryParams(
      {
        arch: "950",
        doubleBuffer: true,
        fuseAddRmsNorm: false,
        quantFormat: "w8a8_dynamic",
        outlierCh64: 21.5,
      },
      preserve,
    );
    expect(aicoreParams.get("tab")).toBe("aicore");
    expect(aicoreParams.get("fromPage")).toBe("ai-core");
    expect(aicoreParams.get("fromAnchor")).toBe("双缓冲流水");
    expect(parseAiCoreQueryParams(aicoreParams)).toEqual({
      arch: "950",
      doubleBuffer: true,
      fuseAddRmsNorm: false,
      quantFormat: "w8a8_dynamic",
      outlierCh64: 21.5,
    });
    expect(
      parseAiCoreQueryParams(new URLSearchParams("arch=910a_fake&db=2&fuse=yes&quant=int4_fake&outlier=999")),
    ).toEqual({});
    expect(parseAiCoreQueryParams(new URLSearchParams("outlier=1e400"))).toEqual({});
    expect(parseAiCoreQueryParams(new URLSearchParams("outlier=0.2"))).toEqual({});

    // Troubleshoot: exact fixture match only; custom free-text log never produces fixture ID
    const firstFixture = TROUBLESHOOT_FIXTURES[0]!;
    expect(matchExactTroubleshootFixtureId(firstFixture.content)).toBe(firstFixture.id);
    expect(matchExactTroubleshootFixtureId(`${firstFixture.content}\nDB_PASSWORD=secret`)).toBeUndefined();

    const tsParams = buildTroubleshootQueryParams(
      {
        panel: "timeline",
        fixtureId: firstFixture.id,
        scenarioId: "kv-preemption-storm",
        step: 1,
      },
      preserve,
    );
    expect(parseTroubleshootQueryParams(tsParams)).toEqual({
      panel: "timeline",
      fixtureId: firstFixture.id,
      scenarioId: "kv-preemption-storm",
      step: 1,
    });
    expect(
      parseTroubleshootQueryParams(new URLSearchParams("panel=hack&fixture=evil&scenario=bad&step=-1")),
    ).toEqual({});
    expect(parseTroubleshootQueryParams(new URLSearchParams("step=999"))).toEqual({});

    // Keep-alive isolation: inactive tab update is strictly dropped; active tab preserves fromPage/fromAnchor
    const activeCalcSearch = new URLSearchParams(
      "tab=calculator&preset=qwen3-8b&tp=2&fromPage=kv-cache&fromAnchor=容量账本",
    );
    const hiddenDoctorAttempt = buildDoctorQueryParams({
      topology: "single",
      hardwareFamily: "A3",
      version: "main",
      modelHint: "auto",
    });
    expect(
      applyControlledTabQueryUpdate("calculator", "doctor", activeCalcSearch, hiddenDoctorAttempt),
    ).toBeNull();

    const activeDoctorSearch = new URLSearchParams("tab=doctor&fromPage=kv-cache&fromAnchor=容量账本");
    const mergedDoctor = applyControlledTabQueryUpdate(
      "doctor",
      "doctor",
      activeDoctorSearch,
      hiddenDoctorAttempt,
    );
    expect(mergedDoctor).not.toBeNull();
    expect(mergedDoctor?.get("tab")).toBe("doctor");
    expect(mergedDoctor?.get("fromPage")).toBe("kv-cache");
    expect(mergedDoctor?.get("fromAnchor")).toBe("容量账本");
    expect(mergedDoctor?.get("ver")).toBe("main");
    // Idempotent no-op when query already matches
    expect(applyControlledTabQueryUpdate("doctor", "doctor", mergedDoctor!, hiddenDoctorAttempt)).toBeNull();
  });

  it("Review closures: AWS_SESSION_TOKEN 经分享链接往返解码已彻底脱敏（零误伤 MAX_TOKENS），且继承的模型特征与剪贴板不可用诚实返回生效", async () => {
    const { copyTextToClipboard } = await import("./workbenchHandoff");
    const link = buildDoctorShareLink({
      topology: "single",
      hardwareFamily: "A2",
      version: "v0.30.0",
      modelHint: "auto",
      sharedModelId: "qwen3-8b",
      sharedTraitOverride: { isMoe: false, numAttentionHeads: 32, numKvHeads: 8, headDim: 128 },
      commandText:
        "AWS_SESSION_TOKEN=EXAMPLE_ONLY GITHUB_TOKEN=ghp_secret99 MAX_TOKENS=1024 vllm serve custom/hybrid -tp 3",
    });
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(link.redactionCount).toBe(2);
    const decoded = parseDoctorQueryParams(link.params);
    expect(decoded.sharedCommand).not.toContain("EXAMPLE_ONLY");
    expect(decoded.sharedCommand).not.toContain("ghp_secret99");
    expect(decoded.sharedCommand).toContain("AWS_SESSION_TOKEN=[REDACTED_KEY]");
    expect(decoded.sharedCommand).toContain("MAX_TOKENS=1024");
    expect(decoded.sharedModelId).toBe("qwen3-8b");
    expect(decoded.sharedTraitOverride).toEqual({
      isMoe: false,
      numAttentionHeads: 32,
      numKvHeads: 8,
      headDim: 128,
    });
    expect(await copyTextToClipboard("http://localhost/#/tools?tab=aicore")).toBe(false);

    // Wave 3 prep: Doctor fromVer round-trip & wargame controlled tab sync
    const radarLink = buildDoctorShareLink({
      topology: "single",
      hardwareFamily: "A2",
      version: "v0.30.0",
      fromVersion: "v0.23.0",
      modelHint: "auto",
      commandText: "VLLM_ASCEND_ENABLE_NZ=0 vllm serve Qwen/Qwen3-8B",
    });
    expect(radarLink.ok).toBe(true);
    if (radarLink.ok) {
      expect(radarLink.params.get("fromVer")).toBe("v0.23.0");
      expect(parseDoctorQueryParams(radarLink.params).fromVersion).toBe("v0.23.0");
    }
    const wgMerged = applyControlledTabQueryUpdate(
      "wargame",
      "wargame",
      new URLSearchParams("tab=wargame&fromPage=acl-graph"),
      new URLSearchParams("case=rank3-oom-ei0006"),
    );
    expect(wgMerged?.toString()).toBe("tab=wargame&fromPage=acl-graph&case=rank3-oom-ei0006");

    // Wave 3 review closure: Authorization: Basic / Token headers redacted in Doctor share links
    const basicSecret = "dXNlcjpzdXBlcnNlY3JldA==";
    const basicLink = buildDoctorShareLink({
      topology: "single",
      hardwareFamily: "A2",
      version: "v0.30.0",
      modelHint: "auto",
      commandText: `curl -H "Authorization: Basic ${basicSecret}" && vllm serve Qwen/Qwen3-8B`,
    });
    expect(basicLink.ok).toBe(true);
    if (basicLink.ok) {
      expect(basicLink.redactionCount).toBeGreaterThanOrEqual(1);
      const parsedBasic = parseDoctorQueryParams(basicLink.params);
      expect(parsedBasic.sharedCommand).not.toContain(basicSecret);
      expect(parsedBasic.sharedCommand).toContain("Authorization: Basic [REDACTED_TOKEN]");
    }
  });

  it("Session audit P1-1 & P3-2: redacts Redis empty-user URI, multiline PRIVATE_KEY, and HUGGINGFACE_TOKEN in decoded share links, and bounds timeline step <= 1", async () => {
    for (const secretCmd of [
      "KV_CACHE_URI=redis://:AUDITMARK@cache.internal:6379/0 vllm serve Qwen/Qwen3-8B",
      'PRIVATE_KEY="line1\nAUDITMARK\nline3" vllm serve Qwen/Qwen3-8B',
      "HUGGINGFACE_TOKEN=AUDITMARK vllm serve Qwen/Qwen3-8B --max-num-batched-tokens 4096",
    ]) {
      const shared = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: secretCmd,
      });
      expect(shared.ok).toBe(true);
      if (shared.ok) {
        expect(shared.redactionCount).toBeGreaterThanOrEqual(1);
        expect(shared.url).not.toContain("AUDITMARK");
        const decoded = parseDoctorQueryParams(shared.params);
        expect(decoded.sharedCommand).toBeDefined();
        expect(decoded.sharedCommand).not.toContain("AUDITMARK");
      }
    }

    // Multiline + HUGGINGFACE_TOKEN in P/D share links must also never survive decoding
    const pdShared = buildDoctorShareLink({
      topology: "pd",
      hardwareFamily: "A3",
      decodeHardwareFamily: "A3",
      version: "v0.30.0",
      modelHint: "auto",
      commandText: "",
      prefillCommandText: "HUGGINGFACE_TOKEN=AUDITMARK vllm serve Qwen/Qwen3-30B-A3B -tp 4",
      decodeCommandText:
        'REDIS_URL=redis://:AUDITMARK@kv.local:6379 PRIVATE_KEY="a\nAUDITMARK" vllm serve Qwen/Qwen3-30B-A3B -tp 2',
    });
    expect(pdShared.ok).toBe(true);
    if (pdShared.ok) {
      expect(pdShared.redactionCount).toBeGreaterThanOrEqual(3);
      const decodedPd = parseDoctorQueryParams(pdShared.params);
      expect(decodedPd.sharedPrefillCommand).not.toContain("AUDITMARK");
      expect(decodedPd.sharedDecodeCommand).not.toContain("AUDITMARK");
    }

    // Timeline step > 1 rejected cleanly
    expect(parseTroubleshootQueryParams(new URLSearchParams("panel=timeline&step=1")).step).toBe(1);
    expect(parseTroubleshootQueryParams(new URLSearchParams("panel=timeline&step=5")).step).toBeUndefined();

    // Round-2 closures: escaped quotes inside PRIVATE_KEY/flags are redacted, while --tokenizer & TOKENIZERS_PARALLELISM stay intact
    const escapedLink = buildDoctorShareLink({
      topology: "single",
      hardwareFamily: "A2",
      version: "v0.30.0",
      modelHint: "auto",
      commandText:
        'TOKENIZERS_PARALLELISM=false PRIVATE_KEY="line1\\"keep\nAUDITMARK_ESCAPED" vllm serve Qwen/Qwen3-8B --tokenizer /models/Qwen3-8B --api-key "k1\\"AUDITMARK_FLAG"',
    });
    expect(escapedLink.ok).toBe(true);
    if (escapedLink.ok) {
      const dec = parseDoctorQueryParams(escapedLink.params);
      expect(dec.sharedCommand).not.toContain("AUDITMARK_ESCAPED");
      expect(dec.sharedCommand).not.toContain("AUDITMARK_FLAG");
      expect(dec.sharedCommand).toContain("--tokenizer /models/Qwen3-8B");
      expect(dec.sharedCommand).toContain("TOKENIZERS_PARALLELISM=false");
    }

    const diagNested = sanitizeDiagnosticText(
      "NPU out of memory: AWS_SECRET_ACCESS_KEY=AUDITMARK_MEM max_tokens: PRIVATE_KEY=AUDITMARK_TOK api_key: org:AUDITMARK_COLON=tail",
    );
    expect(diagNested.sanitized).not.toContain("AUDITMARK_MEM");
    expect(diagNested.sanitized).not.toContain("AUDITMARK_TOK");
    expect(diagNested.sanitized).not.toContain("AUDITMARK_COLON");
    expect(diagNested.sanitized).toContain("max_tokens:");

    // Round-3 closures: backslash line-continuation inside double quotes & TOKENIZER_API_KEY must be redacted
    const contLink = buildDoctorShareLink({
      topology: "single",
      hardwareFamily: "A2",
      version: "v0.30.0",
      modelHint: "auto",
      commandText:
        'TOKENIZER_API_KEY=AUDITMARK_TOKKEY PRIVATE_KEY="part1\\\nAUDITMARK_CONT" vllm serve Qwen/Qwen3-8B --tokenizer /models/Qwen3-8B',
    });
    expect(contLink.ok).toBe(true);
    if (contLink.ok) {
      const decCont = parseDoctorQueryParams(contLink.params);
      expect(decCont.sharedCommand).not.toContain("AUDITMARK_TOKKEY");
      expect(decCont.sharedCommand).not.toContain("AUDITMARK_CONT");
      expect(decCont.sharedCommand).toContain("--tokenizer /models/Qwen3-8B");
    }

    // Round-4+5 closures: YAML quoted/unquoted keys (same-line `;`, next-line indented, `>-` folded, `|` literal) + Authorization: ApiKey
    const yamlAndHeaderCmd = [
      '"api_key":',
      "  org:AUDITMARK_NEXTLINE=tail",
      '"secret_key": >-',
      "  org:AUDITMARK_FOLDED=tail",
      "  second_line_AUDITMARK_FOLDED2",
      "private_key: |",
      "  org;AUDITMARK_LITERAL=tail",
      '"client_secret": org;AUDITMARK_SEMI=tail',
      '"access_key": org;part AUDITMARK_SPACE',
      "auth_token:",
      "  # comment before indented value",
      "  org:AUDITMARK_AFTER_COMMENT=tail",
      "refresh_token: first_line",
      "",
      "  - AUDITMARK_AFTER_BLANK_DASH",
      "- private_key: |",
      "    \tAUDITMARK_SEQ_TAB_L1",
      "    AUDITMARK_SEQ_TAB_L2",
      "  max_model_len: 8192",
      "- secret_key: >-",
      "  # public note",
      "  max_num_seqs: 128",
      "  tp_size: 4",
      "{client_secret: AUDITMARK_FLOW_A; project AUDITMARK_FLOW_B, dp_size: 2}",
      'curl -H "Authorization: ApiKey AUDITMARK_APIKEY" https://example.invalid/',
      `curl -H 'Authorization: Digest username="alice", realm="r", response="0123456789abcdef0123456789abcdef"' https://example.invalid/`,
      'Authorization: Digest username*=UTF-8\'\'AUDITMARK_RFC5987, realm="r", nonce="n1", response="fedcba9876543210fedcba9876543210"',
      "vllm serve Qwen/Qwen3-8B --max-model-len 8192",
    ].join("\n");
    const yamlLink = buildDoctorShareLink({
      topology: "single",
      hardwareFamily: "A2",
      version: "v0.30.0",
      modelHint: "auto",
      commandText: yamlAndHeaderCmd,
    });
    expect(yamlLink.ok).toBe(true);
    if (yamlLink.ok) {
      expect(yamlLink.redactionCount).toBeGreaterThanOrEqual(9);
      const decYaml = parseDoctorQueryParams(yamlLink.params);
      for (const m of [
        "AUDITMARK_NEXTLINE",
        "AUDITMARK_FOLDED",
        "AUDITMARK_FOLDED2",
        "AUDITMARK_LITERAL",
        "AUDITMARK_SEMI",
        "AUDITMARK_SPACE",
        "AUDITMARK_AFTER_COMMENT",
        "AUDITMARK_AFTER_BLANK_DASH",
        "AUDITMARK_SEQ_TAB_L1",
        "AUDITMARK_SEQ_TAB_L2",
        "AUDITMARK_FLOW_A",
        "AUDITMARK_FLOW_B",
        "AUDITMARK_APIKEY",
        "AUDITMARK_RFC5987",
        "0123456789abcdef0123456789abcdef",
        "fedcba9876543210fedcba9876543210",
      ]) {
        expect(decYaml.sharedCommand).not.toContain(m);
      }
      expect(decYaml.sharedCommand).toContain("  # public note");
      expect(decYaml.sharedCommand).toContain("  max_model_len: 8192");
      expect(decYaml.sharedCommand).toContain("  max_num_seqs: 128");
      expect(decYaml.sharedCommand).toContain("  tp_size: 4");
      expect(decYaml.sharedCommand).toContain("dp_size: 2");
      expect(decYaml.sharedCommand).toContain("vllm serve Qwen/Qwen3-8B --max-model-len 8192");
    }

    // Round-6 closures: single-line shell with YAML flow object, valid YAML block scalar embedding shell/YAML, and multiline Digest header preserving next-line env vars
    const singleLineFlowLink = buildDoctorShareLink({
      topology: "single",
      hardwareFamily: "A2",
      version: "v0.30.0",
      modelHint: "auto",
      commandText:
        "vllm serve Qwen/Qwen3-8B --config '{client_secret: QA_FIRST; project QA_LAST, tp_size: 4}'",
    });
    expect(singleLineFlowLink.ok).toBe(true);
    if (singleLineFlowLink.ok) {
      expect(singleLineFlowLink.redactionCount).toBeGreaterThanOrEqual(1);
      const decFlow = parseDoctorQueryParams(singleLineFlowLink.params).sharedCommand ?? "";
      expect(decFlow).not.toContain("QA_FIRST");
      expect(decFlow).not.toContain("QA_LAST");
      expect(decFlow).toContain("tp_size: 4");
    }

    const nestedBlockYaml = [
      "apiVersion: v1",
      "kind: ConfigMap",
      "data:",
      "  config.yaml: |",
      "    api_key:",
      "      org:QA_NESTED_BLOCK=tail",
      "    max_model_len: 8192",
      "  command: |",
      "    vllm serve Qwen/Qwen3-8B --config '{client_secret: QA_CMD_FIRST; project QA_CMD_LAST, tp_size: 4}'",
    ].join("\n");
    const nestedSan = sanitizeDiagnosticText(nestedBlockYaml);
    expect(nestedSan.redactionCount).toBeGreaterThanOrEqual(2);
    expect(nestedSan.sanitized).not.toContain("QA_NESTED_BLOCK");
    expect(nestedSan.sanitized).not.toContain("QA_CMD_FIRST");
    expect(nestedSan.sanitized).not.toContain("QA_CMD_LAST");
    expect(nestedSan.sanitized).toContain("    max_model_len: 8192");
    expect(nestedSan.sanitized).toContain("tp_size: 4");

    const digestMultiline = sanitizeDiagnosticText(
      'Authorization: Digest username="alice", response="0123456789abcdef0123456789abcdef"  \r\nTP_SIZE=4\r\nMAX_MODEL_LEN=8192',
    );
    expect(digestMultiline.sanitized).not.toContain("0123456789abcdef0123456789abcdef");
    expect(digestMultiline.sanitized).toContain("TP_SIZE=4");
    expect(digestMultiline.sanitized).toContain("MAX_MODEL_LEN=8192");

    // Round-7 closures: apostrophe inside flow scalar, alias inside collection, heredoc inside command:|,
    // 4-level nested block scalars, quoted YAML Authorization values, valid YAML string output, comments/anchors, standalone Bearer newline
    const { parse: parseYaml } = await import("yaml");

    const apostropheFlow = sanitizeDiagnosticText(
      'vllm serve M --config "{client_secret: team\'s QA_FIRST; project QA_LAST, tp_size: 4}"',
    );
    expect(apostropheFlow.sanitized).not.toContain("QA_FIRST");
    expect(apostropheFlow.sanitized).not.toContain("QA_LAST");
    expect(apostropheFlow.sanitized).toContain("tp_size: 4");

    const aliasInCollection = sanitizeDiagnosticText("common: &demo QA_DEMO\napi_keys: [*demo]\ntp_size: 4");
    expect(aliasInCollection.sanitized).not.toContain("QA_DEMO");
    expect(aliasInCollection.sanitized).toContain("tp_size: 4");

    const heredocInBlock = sanitizeDiagnosticText(
      "command: |\n  cat <<EOF\n  defaults: &key QA_DEMO\n  client_secret: *key\n  EOF\ntp_size: 4",
    );
    expect(heredocInBlock.sanitized).not.toContain("QA_DEMO");
    expect(heredocInBlock.sanitized).toContain("tp_size: 4");

    const deepBlocks = sanitizeDiagnosticText(
      "a: |\n  b: |\n    c: |\n      d: |\n        client_secret: QA_FIRST; project QA_LAST\n        tp_size: 4",
    );
    expect(deepBlocks.sanitized).not.toContain("QA_FIRST");
    expect(deepBlocks.sanitized).not.toContain("QA_LAST");
    expect(deepBlocks.sanitized).toContain("tp_size: 4");

    // 20-level nested block scalars also redact cleanly with no depth-16 cliff
    const depth20Lines = Array.from({ length: 20 }, (_, i) => `${"  ".repeat(i)}l${i}: |`);
    depth20Lines.push(`${"  ".repeat(20)}client_secret: QA_DEEP_FIRST; project QA_DEEP_LAST`);
    depth20Lines.push(`${"  ".repeat(20)}tp_size: 4`);
    const deep20 = sanitizeDiagnosticText(depth20Lines.join("\n"));
    expect(deep20.sanitized).not.toContain("QA_DEEP_FIRST");
    expect(deep20.sanitized).not.toContain("QA_DEEP_LAST");
    expect(deep20.sanitized).toContain("tp_size: 4");

    const quotedYamlAuth = sanitizeDiagnosticText(
      "headers:\n  Authorization: 'Basic QA_BASIC_TOKEN'\n  Proxy-Authorization: \"Digest username=QA_USER, response=QA_RESPONSE\"",
    );
    expect(quotedYamlAuth.sanitized).not.toContain("QA_BASIC_TOKEN");
    expect(quotedYamlAuth.sanitized).not.toContain("QA_USER");
    expect(quotedYamlAuth.sanitized).not.toContain("QA_RESPONSE");

    const plainYamlStr = sanitizeDiagnosticText("client_secret: QA_DEMO\ntp_size: 4").sanitized;
    expect(parseYaml(plainYamlStr)).toEqual({ client_secret: "[REDACTED_KEY]", tp_size: 4 });

    const commentYaml = sanitizeDiagnosticText("client_secret: # optional value\ntp_size: 4").sanitized;
    expect(parseYaml(commentYaml)).toEqual({ client_secret: null, tp_size: 4 });

    const anchorYaml = sanitizeDiagnosticText(
      "client_secret: &key QA_DEMO\ncopy: *key\ntp_size: 4",
    ).sanitized;
    expect(parseYaml(anchorYaml)).toEqual({
      client_secret: "[REDACTED_KEY]",
      copy: "[REDACTED_KEY]",
      tp_size: 4,
    });

    const bareBearerNewline = sanitizeDiagnosticText("log: Bearer\nTP_SIZE=4\nMAX_MODEL_LEN=8192").sanitized;
    expect(bareBearerNewline).toContain("TP_SIZE=4");
    expect(bareBearerNewline).toContain("MAX_MODEL_LEN=8192");
  });
});
