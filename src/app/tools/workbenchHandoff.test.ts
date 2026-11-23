import { describe, expect, it } from "vitest";
import { RANK_PATTERNS as LOG_ANALYZER_RANK_PATTERNS } from "../../sim/troubleshoot/logAnalyzer";
import {
  buildCalculatorQueryParams,
  buildDeployChatAnalysis,
  buildDoctorChatAnalysis,
  buildTroubleshootChatAnalysis,
  cardIdToHardwareFamily,
  createWorkbenchHandoffStore,
  extractLineIdentitySpans,
  extractRank,
  hasReconcilableStartupMetrics,
  parseCalculatorQueryParams,
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
});
