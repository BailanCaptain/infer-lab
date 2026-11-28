import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseAllDocuments, stringify as stringifyYaml } from "yaml";
import { FULL_SINGLE_DOCTOR_PRESETS } from "../../sim/doctor/presets";
import { evaluateDeployPlan } from "../../sim/modelspec/deployCalculator";
import { parseHfConfig } from "../../sim/modelspec/parseHfConfig";
import { parseAscendStartupLog, reconcileStartupLog } from "../../sim/modelspec/startupLogParser";
import { getVllmMetricSampleName } from "../../sim/troubleshoot/evidenceLineMatcher";
import { TROUBLESHOOT_FIXTURES } from "../../sim/troubleshoot/fixtures";
import {
  analyzeTroubleshootInput,
  RANK_PATTERNS as LOG_ANALYZER_RANK_PATTERNS,
} from "../../sim/troubleshoot/logAnalyzer";
import { chatAnalysisSchema as historyChatAnalysisSchema } from "../wiki/chat-history";
import {
  buildDeployViewChatAnalysis,
  buildDeployViewSharedParams,
  buildReconcileAssistantAttachment,
  DeployCalculatorView,
} from "./DeployCalculatorView";
import {
  applyControlledTabQueryUpdate,
  buildAiCoreQueryParams,
  buildCalculatorQueryParams,
  buildDeployChatAnalysis,
  buildDoctorChatAnalysis,
  buildDoctorChatAnalysisWithReason,
  buildDoctorQueryParams,
  buildDoctorShareLink,
  buildTroubleshootChatAnalysis,
  buildTroubleshootQueryParams,
  cardIdToHardwareFamily,
  createWorkbenchHandoffStore,
  decodeDoctorCommandParam,
  encodeDoctorCommandParam,
  evaluateCalculatorModelGate,
  extractLineIdentitySpans,
  extractRank,
  hasMetricsTruncatedMarker,
  hasNonFiniteNumber,
  hasReconcilableStartupMetrics,
  isRuleEvidenceLine,
  MAX_DOCTOR_COMMAND_CHARS,
  MAX_WORKBENCH_SHARE_URL_CHARS,
  METRICS_TRUNCATED_MARKER,
  matchExactDoctorPresetId,
  matchExactTroubleshootFixtureId,
  parseAiCoreQueryParams,
  parseCalculatorQueryParams,
  parseCustomModelParam,
  parseDoctorQueryParams,
  parseTroubleshootQueryParams,
  RANK_PATTERNS,
  resolveToolsBackTarget,
  sanitizeDiagnosticText,
  serializeCustomModelForShare,
  truncateTroubleshootLog,
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

  it("Red-Team P1: qwen3-32b 与 qwen3-235b-a22b 在算账 URL、体检 hint/mid 与 AI 分析载荷白名单中无损往返", () => {
    for (const presetId of ["qwen3-0.6b", "qwen3-32b", "qwen3-235b-a22b"] as const) {
      const calcParams = buildCalculatorQueryParams({
        subMode: "static",
        presetId,
        cardId: "a2-64g",
        tpSize: presetId === "qwen3-235b-a22b" ? 8 : presetId === "qwen3-32b" ? 2 : 1,
        ppSize: 1,
        dpSize: 1,
        enableEp: presetId === "qwen3-235b-a22b",
      });
      expect(calcParams.get("preset")).toBe(presetId);
      const parsedCalc = parseCalculatorQueryParams(calcParams);
      expect(parsedCalc.presetId).toBe(presetId);

      const docShare = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: presetId,
        commandText: `vllm serve ${presetId} -tp 2`,
      });
      expect(docShare.ok).toBe(true);
      if (docShare.ok) {
        const parsedDoc = parseDoctorQueryParams(docShare.params);
        expect(parsedDoc.modelHint).toBe(presetId);
      }

      const autoMidShare = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        sharedModelId: presetId,
        commandText: `vllm serve /models/${presetId} -tp 2`,
      });
      expect(autoMidShare.ok).toBe(true);
      if (autoMidShare.ok) {
        expect(parseDoctorQueryParams(autoMidShare.params).sharedModelId).toBe(presetId);
      }

      const chatPayload = buildDeployChatAnalysis({
        model: presetId,
        cardId: "a2-64g",
        tpSize: 2,
      });
      expect(chatPayload?.model).toBe(presetId);
    }

    // IPv6 precision: C++ a::b / HH:MM:SS / [12:34:56] preserved; uppercase FD00::1 / trailing 2001:db8:: & [2001:db8::] redacted
    const ipv6Precision = sanitizeDiagnosticText(
      "12:34:56 [12:34:56] a::b a::b::c std::bad_alloc c10::Error FD00::1 FE80::1 2001:db8:: 2001:db8::1 fe80::1 ::1 [2001:db8::]:8000",
    );
    expect(ipv6Precision.sanitized).toBe(
      "12:34:56 [12:34:56] a::b a::b::c std::bad_alloc c10::Error <REDACTED_IP> <REDACTED_IP> <REDACTED_IP> <REDACTED_IP> <REDACTED_IP> <REDACTED_IP> [<REDACTED_IP>]:8000",
    );
    const upperIpv6Share = buildDoctorShareLink({
      topology: "single",
      hardwareFamily: "A2",
      version: "v0.30.0",
      modelHint: "auto",
      commandText: "vllm serve Qwen/Qwen3-8B --host FD00::1 -tp 2",
    });
    expect(upperIpv6Share.ok).toBe(true);
    if (upperIpv6Share.ok) {
      expect(upperIpv6Share.redactionCount).toBe(1);
      expect(parseDoctorQueryParams(upperIpv6Share.params).sharedCommand).toContain("--host <REDACTED_IP>");
    }

    // dpLocal written only from explicit valid dpLocalSize (never resurrected from stale preserve URL, nor exceeding ranksPerNode)
    const explicitDpLocal = buildCalculatorQueryParams({
      subMode: "static",
      presetId: "qwen3-30b-a3b",
      cardId: "a2-64g",
      tpSize: 4,
      dpSize: 2,
      dpLocalSize: 1,
      enableEp: true,
    });
    expect(explicitDpLocal.get("dpLocal")).toBe("1");

    const clearedDpLocal = buildCalculatorQueryParams(
      {
        subMode: "static",
        presetId: "qwen3-30b-a3b",
        cardId: "a2-64g",
        tpSize: 4,
        dpSize: 2,
        enableEp: true,
      },
      new URLSearchParams("dpLocal=1"),
    );
    expect(clearedDpLocal.get("dpLocal")).toBeNull();

    const overNodeDpLocal = buildCalculatorQueryParams({
      subMode: "static",
      presetId: "qwen3-30b-a3b",
      cardId: "a2-64g",
      tpSize: 8,
      dpSize: 4,
      dpLocalSize: 2,
      enableEp: true,
    });
    expect(overNodeDpLocal.get("dpLocal")).toBeNull();
  });

  it("Wave 2: >300KB EI0006 flood + 1 RaSocketConnect failed: No route to host preserves root cause & new Tier-1 signals after buildTroubleshootChatAnalysis", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");
    const floodHead = Array.from(
      { length: 1800 },
      (_, idx) =>
        `2026-11-24 10:01:${String(idx % 60).padStart(2, "0")}.${String(idx % 1000).padStart(3, "0")} ERROR [Worker_TP${idx % 8}] [Rank ${idx % 8}] EI0006 Notify wait execute timeout on group_step_${idx} ${"w".repeat(60)}`,
    );
    const singleRootCause =
      "[ERROR] HCCP(41003,python):2026-11-24-10:00:02.110.204 [ra_socket.cc:412] [Rank 3] RaSocketConnect failed: No route to host 192.0.2.12:16666";
    const floodTail = Array.from(
      { length: 1500 },
      (_, idx) =>
        `2026-11-24 10:02:${String(idx % 60).padStart(2, "0")}.${String(idx % 1000).padStart(3, "0")} ERROR [Worker_TP${idx % 8}] [Rank ${idx % 8}] Watchdog caught collective operation timeout EI0006 seq_${idx} ${"q".repeat(60)}`,
    );
    const massiveFloodLog = [...floodHead, singleRootCause, ...floodTail].join("\n");
    expect(massiveFloodLog.length).toBeGreaterThan(350_000);

    const payload = buildTroubleshootChatAnalysis(massiveFloodLog);
    expect(payload).toBeDefined();
    expect(payload!.rawInput.length).toBeLessThanOrEqual(65_536);
    expect(payload!.rawInput).toContain("RaSocketConnect failed: No route to host <REDACTED_IP>:16666");
    expect(payload!.rawInput).not.toContain("192.0.2.12");

    const diag = analyzeTroubleshootInput(payload!.rawInput);
    expect(diag.firstFaultVerdict.rank).toBe(3);
    expect(diag.findings.map((f) => f.ruleId)).toContain("hccl-link-or-ifname-fault");
    expect(diag.findings.map((f) => f.ruleId)).toContain("hccl-timeout-cascade");

    // Verify all new Tier-1 decisive root tokens survive a >300KB EI0006 storm
    const newTier1Samples = [
      "[Rank 1] DispatchFFNCombine: HCCL_BUFFSIZE is too SMALL, m = 128, k = 2048, topK = 8",
      "[Rank 2] ValueError: ERROR: ModelSlim Quantization Config Not Found (quant_model_description.json)",
      "[Rank 4] torch._dynamo.exc.BackendCompilerFailed: There was no fake impl registered for op_x",
      "[Rank 5] GE compile failed E19999: coreNum is 0, tiling failed",
      "[Rank 6] OSError: /dev/davinci_manager: No such file or directory; libascend_hal.so error code 507008 107002",
    ];
    for (const sample of newTier1Samples) {
      const stormWithSample = [...floodHead.slice(0, 1400), sample, ...floodTail.slice(0, 1200)].join("\n");
      expect(stormWithSample.length).toBeGreaterThan(300_000);
      const compacted = buildTroubleshootChatAnalysis(stormWithSample);
      expect(compacted?.rawInput).toContain(sample);
    }
  });

  it("P1-1 & P2/P3 compaction: redacts IPv4 sentence-dot and RFC-4291 IPv6 forms, keeps benign quant_model_description.json INFO at Tier 0, and preserves new decisive tokens", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");
    const ipLine = [
      "2026-11-24 10:00:01 [Rank 0] v0.30.0 1.2.3.4.5 [12:34:56] a::b peer=192.0.2.12.",
      "peer=[2001:db8:1:2:3:4:5::]:123 [::a:b:c:d:e:f:1]:80 [fe80::1%eth0] [::ffff:192.0.2.12] ::ffff:192.0.2.12 peer2=::c000:201 peer3=::abcd peer4=1:: peer5=1234::abcd connect to fd00::1234: Connection refused",
      "Authorization: Negotiate ZGVtbw== | Proxy-Authorization: Bearer --DEMOtoken | Authorization: 'Digest username=\"O''Brien\", response=\"0123456789abcdef0123456789abcdef\"'",
      'Proxy-Authorization: "Bearer DEMO\\\nERROR disk full"',
    ].join("\n");
    const ipPayload = buildTroubleshootChatAnalysis(ipLine);
    expect(ipPayload).toBeDefined();
    expect(ipPayload!.rawInput).toContain("v0.30.0 1.2.3.4.5 [12:34:56] a::b peer=<REDACTED_IP>.");
    expect(ipPayload!.rawInput).toContain(
      "peer=[<REDACTED_IP>]:123 [<REDACTED_IP>]:80 [<REDACTED_IP>] [<REDACTED_IP>] <REDACTED_IP> peer2=<REDACTED_IP> peer3=<REDACTED_IP> peer4=<REDACTED_IP> peer5=<REDACTED_IP> connect to <REDACTED_IP>: Connection refused",
    );
    expect(ipPayload!.rawInput).not.toContain("c000:201");
    expect(ipPayload!.rawInput).not.toContain("::abcd");
    expect(ipPayload!.rawInput).not.toContain("1234::abcd");
    expect(ipPayload!.rawInput).not.toContain("peer4=1::");
    expect(ipPayload!.rawInput).not.toContain("fd00::1234");
    expect(ipPayload!.rawInput).not.toContain("192.0.2.12");
    expect(ipPayload!.rawInput).not.toContain("2001:db8:1:2:3:4:5::");
    expect(ipPayload!.rawInput).not.toContain("fe80::1");
    expect(ipPayload!.rawInput).not.toContain("ZGVtbw==");
    expect(ipPayload!.rawInput).not.toContain("--DEMOtoken");
    expect(ipPayload!.rawInput).not.toContain("0123456789abcdef0123456789abcdef");
    expect(ipPayload!.rawInput).not.toContain("DEMO\\");
    expect(ipPayload!.rawInput).toContain('ERROR disk full"');

    const v2RedactionInput = [
      "INFO Authorization: X fixture_one",
      'Authorization: "Bearer\n  fixture_two"',
      "Proxy-Authorization: 'Bearer\n  fixture_three'",
      "INFO peer=abcd::efab peer:fd00::1234 ipv6:fe80::1",
    ].join("\n");
    const v2Payload = buildTroubleshootChatAnalysis(v2RedactionInput);
    expect(v2Payload?.rawInput).not.toContain("fixture_one");
    expect(v2Payload?.rawInput).not.toContain("fixture_two");
    expect(v2Payload?.rawInput).not.toContain("fixture_three");
    expect(v2Payload?.rawInput).not.toContain("abcd::efab");
    expect(v2Payload?.rawInput).not.toContain("fd00::1234");
    expect(v2Payload?.rawInput).not.toContain("fe80::1");

    // 800 benign `INFO ... loaded quant_model_description.json` lines MUST stay INFO tier and NEVER evict a single RaSocket root cause
    const benignQuantInfo = Array.from(
      { length: 800 },
      (_, idx) =>
        `2026-11-24 10:00:${String(idx % 60).padStart(2, "0")}.000 INFO [Rank ${idx % 8}] loaded quant_model_description.json shard=${idx} ${"m".repeat(70)}`,
    );
    const singleRaSocket = "[Rank 3] ERROR HCCP RaSocketConnect failed: No route to host 192.0.2.12:16666";
    const floodQuantLog = [
      ...benignQuantInfo.slice(0, 400),
      singleRaSocket,
      ...benignQuantInfo.slice(400),
      ...Array.from(
        { length: 600 },
        (_, idx) =>
          `2026-11-24 10:02:${String(idx % 60).padStart(2, "0")}.000 ERROR [Rank ${idx % 8}] EI0002 Notify wait execute timeout seq=${idx} ${"q".repeat(60)}`,
      ),
    ].join("\n");
    expect(floodQuantLog.length).toBeGreaterThan(120_000);
    const quantCompacted = buildTroubleshootChatAnalysis(floodQuantLog);
    expect(quantCompacted).toBeDefined();
    expect(quantCompacted!.rawInput).toContain(
      "RaSocketConnect failed: No route to host <REDACTED_IP>:16666",
    );
    expect(analyzeTroubleshootInput(quantCompacted!.rawInput).firstFaultVerdict.rank).toBe(3);

    // Additional decisive root tokens (`mc2 group is not initialized`, `expert_map is required`, `EZ3002`, `EZ3003`, `EL0004`) survive >100KB floods
    const extraDecisive = [
      "[Rank 1] AssertionError: mc2 group is not initialized",
      "[Rank 2] AssertionError: expert_map is required for MC2 token dispatch.",
      "[Rank 4] GE compile failed EZ3002 unsupported op",
      "[Rank 5] GE compile failed EZ3003 no kernel engine",
      "[Rank 6] EL0004: Failed to allocate memory.",
    ];
    for (const sample of extraDecisive) {
      const storm = [...benignQuantInfo, sample, ...benignQuantInfo].join("\n");
      expect(storm.length).toBeGreaterThan(120_000);
      expect(buildTroubleshootChatAnalysis(storm)?.rawInput).toContain(sample);
    }
  });

  it("Final redaction closure: multiline full-header quotes, unbounded RFC9110 schemes, partial pastes, shell \\\\\\n continuations, comma assignments, and escaped quotes across all entry points", () => {
    const scheme33 = "x".repeat(33);
    const scheme40 = "x!#$%&'*+.^_`|~-".repeat(3).slice(0, 40);
    const corpus = [
      'curl -H "Authorization: Bearer \\\n  fixture_hdr_dq" https://example.invalid/a',
      "curl -H 'Proxy-Authorization: Bearer \n  fixture_hdr_sq' https://example.invalid/b",
      `INFO Authorization: ${scheme33} fixture_rfc33`,
      `INFO Proxy-Authorization: ${scheme40} \\\n  fixture_rfc40`,
      "API_TOKEN=part1\\\nfixture_unq_cont vllm serve Qwen/Qwen3-8B --port 8000",
      "export API_KEY=part1\\\n  fixture_exp_cont",
      "export API_KEY=first,fixture_comma",
      "API_KEYS=k_comma1,k_comma2 API_TOKENS=tok_comma1,tok_comma2",
      "vllm serve Qwen/Qwen3-8B --api-key k_cli1,k_cli2 --api-key=k_cli3,k_cli4 --api-key=p_eq1\\\n  p_eq2",
      'curl --header Authorization:fixture_bare_hdr -H "X-Api-Key: xak_1 xak_2" -H "Cookie: sid=cook_1; uid=cook_2" https://example.invalid/c',
      "export ESC_SGL_POSIX_API_KEY='sgl_p1'\\''sgl_p2' ESC_SGL_ALT_API_KEY='sgl_a1'\"'\"'sgl_a2' ESC_SGL_DBL_API_KEY='sgl_d1''sgl_d2' ESC_DBL_SECRET=\"dbl_p1\\\"dbl_p2\"",
      "INFO Authorization: AWS4-HMAC-SHA256 Credential=AKIA1234567890ABCDEF/20261128/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=aws4_sig_fixture",
      'flow_json: { "api_key": flow_secret_val, "model": "qwen" }',
      'Config(api_key=call_secret_val, model="qwen")',
      "INFO api_keys: [arr_secret1, arr_secret2] api_key: { value: obj_secret_val }",
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAPartialPemFixture\nERROR disk full",
      'PRIVATE_KEY="part1\nfixture_partial_nl\nERROR disk full',
      "API_KEY='part1\\",
      'curl -H "Authorization: Bearer \\\n  fixture_unclosed_hdr',
    ].join("\n");

    const leaks = [
      "fixture_hdr_dq",
      "fixture_hdr_sq",
      "fixture_rfc33",
      "fixture_rfc40",
      "fixture_unq_cont",
      "fixture_exp_cont",
      "fixture_comma",
      "k_comma1",
      "k_comma2",
      "tok_comma1",
      "tok_comma2",
      "k_cli1",
      "k_cli2",
      "k_cli3",
      "k_cli4",
      "p_eq1",
      "p_eq2",
      "fixture_bare_hdr",
      "xak_1",
      "xak_2",
      "cook_1",
      "cook_2",
      "sgl_p1",
      "sgl_p2",
      "sgl_a1",
      "sgl_a2",
      "sgl_d1",
      "sgl_d2",
      "dbl_p1",
      "dbl_p2",
      "AKIA1234567890ABCDEF",
      "aws4_sig_fixture",
      "flow_secret_val",
      "call_secret_val",
      "arr_secret1",
      "arr_secret2",
      "obj_secret_val",
      "PartialPemFixture",
      "fixture_partial_nl",
      "part1\\",
      "fixture_unclosed_hdr",
    ];

    // 1. sanitizeDiagnosticText + strict idempotency
    const san1 = sanitizeDiagnosticText(corpus);
    const san2 = sanitizeDiagnosticText(san1.sanitized);
    expect(san2.sanitized).toBe(san1.sanitized);
    expect(san2.redactionCount).toBe(0);
    for (const secret of leaks) {
      expect(san1.sanitized).not.toContain(secret);
    }
    expect(san1.sanitized).toContain("vllm serve Qwen/Qwen3-8B --port 8000");
    expect(san1.sanitized).toContain('"model": "qwen"');
    expect(san1.sanitized).toContain('model="qwen")');
    expect(san1.sanitized).toContain("ERROR disk full");
    expect(san1.sanitized).toContain("https://example.invalid/a");
    expect(san1.sanitized).toContain("https://example.invalid/b");

    const decodeRawBase64UrlParam = (encoded: string): string => {
      const std = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const padded = std.padEnd(Math.ceil(std.length / 4) * 4, "=");
      return Buffer.from(padded, "base64").toString("utf8");
    };

    // 2. buildDoctorShareLink -> raw wire bytes check BEFORE parseDoctorQueryParams (each vector fits under 4096 share URL cap)
    const shareVectors = [
      'curl -H "Authorization: Bearer \\\n  fixture_hdr_dq" https://example.invalid/ && vllm serve Qwen/Qwen3-8B',
      "curl -H 'Proxy-Authorization: Bearer \n  fixture_hdr_sq' https://example.invalid/ && vllm serve Qwen/Qwen3-8B",
      `INFO Authorization: ${scheme33} fixture_rfc33\nvllm serve Qwen/Qwen3-8B`,
      "API_TOKEN=part1\\\nfixture_unq_cont vllm serve Qwen/Qwen3-8B",
      "export API_KEY=first,fixture_comma\nvllm serve Qwen/Qwen3-8B",
      'PRIVATE_KEY="part1\nfixture_partial_nl',
      "API_KEY='part1\\",
      "export API_KEY='sgl_p1'\\''sgl_p2' && vllm serve Qwen/Qwen3-8B",
    ];
    for (const vec of shareVectors) {
      const link = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: vec,
      });
      expect(link.ok).toBe(true);
      if (!link.ok) continue;
      const rawWireCmd = link.params.get("cmd");
      expect(rawWireCmd).toBeTruthy();
      const rawDecodedBytes = decodeRawBase64UrlParam(rawWireCmd!);
      for (const secret of leaks) {
        expect(rawDecodedBytes).not.toContain(secret);
      }
      const decoded = parseDoctorQueryParams(link.params);
      expect(decoded.sharedCommand).toBe(rawDecodedBytes);
    }

    // Crafted external ?cmd= share link is also sanitized on decode by parseDoctorQueryParams
    const craftedParams = new URLSearchParams({
      tab: "doctor",
      cmd: encodeDoctorCommandParam('PRIVATE_KEY="part1\nfixture_partial_nl'),
    });
    const parsedCrafted = parseDoctorQueryParams(craftedParams);
    expect(parsedCrafted.sharedCommand).toBe('PRIVATE_KEY="[REDACTED_KEY]"\n');

    // 3. buildDoctorChatAnalysis & buildTroubleshootChatAnalysis
    const docAnalysis = buildDoctorChatAnalysis({ command: corpus });
    expect(docAnalysis).toBeDefined();
    for (const secret of leaks) {
      expect(docAnalysis!.command).not.toContain(secret);
    }
    const trAnalysis = buildTroubleshootChatAnalysis(corpus);
    expect(trAnalysis).toBeDefined();
    for (const secret of leaks) {
      expect(trAnalysis!.rawInput).not.toContain(secret);
    }
    expect(trAnalysis!.rawInput).toContain("ERROR disk full");
  });

  it("Red-Team xhigh closure: covers CR-only scalars, partial PEMs, quoted cookies, concat shell quotes, broken YAML anchors, structured env, ANSI, --host a::b, and 520-char schemes", () => {
    const scheme520 = "x".repeat(520);
    const edgeCases = [
      "credentials: |\n  endpoint: https://u:p@host/\n  value: yaml_block_sample\nmodel: qwen",
      'export API_KEY="cr_first\rcr_second" --port 80',
      "Authorization: Bearer \\\ncol0_auth_cont",
      "INFO Bearer bear_first\\\nbear_second",
      'INFO Authorization: Digest username="demo", response="digest_unclosed\nERROR digest_retained',
      'INFO Cookie: mode=ok; sid="cook_q_1"\nINFO Cookie: sid="cook_q_2"; mode=test',
      'export API_KEY=before_concat"after_concat" --api-key=flag_before"flag_after"',
      "curl -H 'X-Api-Key: xak_one'\\''xak_two' -H 'Authorization: Bearer auth_one'\\''auth_two'",
      "-----BEGIN PRIVATE KEY-----\nQUJD \nREVG_PEM_SP\nINFO pem_sp_retained",
      "-----BEGIN PRIVATE KEY-----\nQUJD_TRUNC\nERROR pem_trunc_retained\n-----BEGIN PRIVATE KEY-----\nREVG_COMPLETE\n-----END PRIVATE KEY-----\nINFO pem_done",
      "API_KEYS=[REDACTED],comma_after_redacted",
      "public: &shared alias_leak_sample\napi_key: *shared\nunfinished: [",
      "env:\n  - name: API_KEY\n    value: struct_env_sample\n  - name: MAX_TOKENS\n    value: 1024",
      "\x1b[32mAPI_KEY\x1b[0m=ansi_demo_value",
      "vllm serve M --host a::b",
      `INFO Authorization: ${scheme520} fixture_520`,
    ];

    const forbidden = [
      "yaml_block_sample",
      "cr_second",
      "col0_auth_cont",
      "bear_second",
      "digest_unclosed",
      "cook_q_1",
      "cook_q_2",
      "after_concat",
      "flag_after",
      "xak_two",
      "auth_two",
      "REVG_PEM_SP",
      "QUJD_TRUNC",
      "REVG_COMPLETE",
      "comma_after_redacted",
      "alias_leak_sample",
      "struct_env_sample",
      "ansi_demo_value",
      "a::b",
      "fixture_520",
    ];

    for (const vec of edgeCases) {
      const s1 = sanitizeDiagnosticText(vec);
      const s2 = sanitizeDiagnosticText(s1.sanitized);
      expect(s2.sanitized, `idempotency for: ${vec}`).toBe(s1.sanitized);
      expect(s2.redactionCount, `zero 2nd count for: ${vec}`).toBe(0);
      for (const secret of forbidden) {
        expect(s1.sanitized, `leak ${secret} in ${vec}`).not.toContain(secret);
      }

      const share = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: vec,
      });
      expect(share.ok).toBe(true);
      if (share.ok) {
        const parsed = parseDoctorQueryParams(share.params);
        expect(parsed.sharedCommand).toBeDefined();
        for (const secret of forbidden) {
          expect(parsed.sharedCommand).not.toContain(secret);
        }
      }
    }

    expect(
      sanitizeDiagnosticText(
        "credentials: |\n  endpoint: https://u:p@host/\n  value: yaml_block_sample\nmodel: qwen",
      ).sanitized,
    ).toContain("model: qwen");
    expect(
      sanitizeDiagnosticText(
        'INFO Authorization: Digest username="demo", response="digest_unclosed\nERROR digest_retained',
      ).sanitized,
    ).toContain("ERROR digest_retained");
    expect(
      sanitizeDiagnosticText(
        "-----BEGIN PRIVATE KEY-----\nQUJD_TRUNC\nERROR pem_trunc_retained\n-----BEGIN PRIVATE KEY-----\nREVG_COMPLETE\n-----END PRIVATE KEY-----\nINFO pem_done",
      ).sanitized,
    ).toContain("ERROR pem_trunc_retained");
    expect(
      sanitizeDiagnosticText(
        "env:\n  - name: API_KEY\n    value: struct_env_sample\n  - name: MAX_TOKENS\n    value: 1024",
      ).sanitized,
    ).toContain("value: 1024");
    expect(sanitizeDiagnosticText("vllm serve M --host a::b").sanitized).toBe(
      "vllm serve M --host <REDACTED_IP>",
    );
    expect(sanitizeDiagnosticText("sym=a::b").sanitized).toBe("sym=a::b");

    // Performance guard against quadratic URI backtracking on 16KB hex metadata
    const bigHex = `INFO metadata=${"deadbeef".repeat(2048)}`;
    const t0 = performance.now();
    const hexRes = sanitizeDiagnosticText(bigHex);
    expect(performance.now() - t0).toBeLessThan(150);
    expect(hexRes.redactionCount).toBe(0);
  });

  it("Astra xhigh closure: covers all 13 P1, 8 P2, and 2 P3 findings end-to-end with raw wire assertions", async () => {
    const decodeWire = (raw: string): string => {
      const std = raw.replace(/-/g, "+").replace(/_/g, "/");
      return Buffer.from(std.padEnd(Math.ceil(std.length / 4) * 4, "="), "base64").toString("utf8");
    };

    const astraVectors = [
      "-----BEGIN PRIVATE KEY-----\nQUJD\n12/3\nREVG_PEM12\n-----END PRIVATE KEY-----",
      "-----BEGIN PRIVATE KEY-----\nComment: fixture\n\nVEVTVF9CRU1fQUJD",
      "-----BEGIN PRIVATE KEY-----\nQUJD\n-----BEGIN PRIVATE KEY-----\nREVG\n-----END PRIVATE KEY-----\nR0hJX05FU1RFRA==\n-----END PRIVATE KEY-----",
      "curl -u demo:curl_u_secret -b sid=curl_b_secret https://example.invalid/keep",
      "curl --cookie sid=cookie_arg_secret https://example.invalid/keep2 && curl --user u:user_arg_pw https://example.invalid/keep3",
      "curl -H 'X-Api-Key: demo'xak_concat -H 'Authorization: Bearer 'auth_concat",
      "PASSWORD=before{mid_brace_pw}after",
      'curl -d "{\\"password\\":\\"esc_json_pw\\",\\"model\\":\\"qwen3\\"}"',
      "INFO Authorization: Basic\r\n dGVzdF9mb2xk\nINFO Cookie: sid=demo;\n user=fold_cookie_secret",
      "password: |\r  cr_only_block_secret\nmodel: qwen",
      "name: &n API_KEY\njob: {name: *n, value: alias_desc_secret}",
      "shared: &n broken_frag_secret\nINFO ready\napi_key: *n",
      "a: &n1 *n2\nINFO mid\nb: &n2 trans_anchor_secret\nINFO done\napi_key: *n1",
      'TOKENIZER_TOKEN=tok_tok_secret\n{"name":"TOKENIZER_TOKEN","value":"tok_struct_secret"}',
      '{"auths":{"registry":{"auth":"dGVzdF9hdXRocw=="}}}',
      "Bearer test",
      "//net_u:net_p_secret@proxy.example/path",
      "vllm serve M --host 'a::b' --ip=\"2001:db8::1\"",
      '{"host":"a::b"}',
      'API_KEY="open\nError: disk full',
      "\x1b[38:5:2mINFO ansi_colon_ok\x1b[0m",
    ];
    const secrets = [
      "REVG_PEM12",
      "VEVTVF9CRU1fQUJD",
      "R0hJX05FU1RFRA==",
      "curl_u_secret",
      "curl_b_secret",
      "cookie_arg_secret",
      "user_arg_pw",
      "xak_concat",
      "auth_concat",
      "mid_brace_pw",
      "esc_json_pw",
      "dGVzdF9mb2xk",
      "fold_cookie_secret",
      "cr_only_block_secret",
      "alias_desc_secret",
      "broken_frag_secret",
      "trans_anchor_secret",
      "tok_tok_secret",
      "tok_struct_secret",
      "dGVzdF9hdXRocw==",
      "Bearer test",
      "net_p_secret",
      "a::b",
      "2001:db8::1",
    ];

    for (const vec of astraVectors) {
      const s1 = sanitizeDiagnosticText(vec);
      const s2 = sanitizeDiagnosticText(s1.sanitized);
      expect(s2.sanitized, `idempotency failed for: ${vec}`).toBe(s1.sanitized);
      expect(s2.redactionCount, `2nd pass count != 0 for: ${vec}`).toBe(0);
      for (const secret of secrets) {
        expect(s1.sanitized, `leaked ${secret} in ${vec}`).not.toContain(secret);
      }

      const link = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: vec,
      });
      expect(link.ok).toBe(true);
      if (link.ok) {
        const wireBytes = decodeWire(link.params.get("cmd")!);
        for (const secret of secrets) {
          expect(wireBytes, `wire leaked ${secret} in ${vec}`).not.toContain(secret);
        }
        const parsed = parseDoctorQueryParams(link.params);
        expect(parsed.sharedCommand).toBe(wireBytes);
      }

      const pdLink = buildDoctorShareLink({
        topology: "pd",
        hardwareFamily: "A2",
        decodeHardwareFamily: "A3",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: vec,
        prefillCommandText: vec,
        decodeCommandText: vec,
      });
      expect(pdLink.ok).toBe(true);
      if (pdLink.ok) {
        const pWire = decodeWire(pdLink.params.get("pcmd")!);
        const dWire = decodeWire(pdLink.params.get("dcmd")!);
        for (const secret of secrets) {
          expect(pWire).not.toContain(secret);
          expect(dWire).not.toContain(secret);
        }
        const parsedPd = parseDoctorQueryParams(pdLink.params);
        expect(parsedPd.sharedPrefillCommand).toBe(pWire);
        expect(parsedPd.sharedDecodeCommand).toBe(dWire);
      }

      const tr = buildTroubleshootChatAnalysis(vec);
      expect(tr).toBeDefined();
      for (const secret of secrets) {
        expect(tr!.rawInput).not.toContain(secret);
      }
    }

    // Preserved URLs, query @, python -u, docker --user 1000:1000, HF_HUB_DISABLE_IMPLICIT_TOKEN, sym=c10::add, Error: disk full, valid null JSON
    const benignCheck = sanitizeDiagnosticText(
      [
        "curl --cookie sid=cook_secret https://example.invalid/keep",
        "https://example.org?x=a@b",
        "HF_HUB_DISABLE_IMPLICIT_TOKEN=1 python3 -u run.py --max-tokens 16",
        "docker run --user 1000:1000 img",
        "sym=c10::add sym2=a::b",
        'API_KEY="open\nError: disk full',
        '{"password":null}',
      ].join("\n"),
    );
    expect(benignCheck.sanitized).toContain("https://example.invalid/keep");
    expect(benignCheck.sanitized).toContain("https://example.org?x=a@b");
    expect(benignCheck.sanitized).toContain("HF_HUB_DISABLE_IMPLICIT_TOKEN=1");
    expect(benignCheck.sanitized).toContain("python3 -u run.py --max-tokens 16");
    expect(benignCheck.sanitized).toContain("docker run --user 1000:1000 img");
    expect(benignCheck.sanitized).toContain("sym=c10::add sym2=a::b");
    expect(benignCheck.sanitized).toContain("Error: disk full");
    expect(benignCheck.sanitized).toContain('{"password":null}');
    expect(JSON.parse('{"password":null}')).toEqual({ password: null });

    // P1-13: buildDeployChatAnalysis strips non-structural custom fields (api_key, auths)
    const customAnalysis = buildDeployChatAnalysis({
      model: {
        model_type: "qwen3",
        hidden_size: 4096,
        num_hidden_layers: 36,
        num_attention_heads: 32,
        num_key_value_heads: 8,
        intermediate_size: 12288,
        vocab_size: 151936,
        api_key: "deploy_custom_secret",
        auths: { registry: { auth: "dGVzdF9kZXBsb3k=" } },
      },
      cardId: "a2-64g",
    });
    expect(customAnalysis).toBeDefined();
    expect(JSON.stringify(customAnalysis)).not.toContain("deploy_custom_secret");
    expect(JSON.stringify(customAnalysis)).not.toContain("dGVzdF9kZXBsb3k=");

    // P2-3: Doctor links omit dirty fromAnchor while preserving clean wiki page/anchor pair
    const dirtyAnchorLink = buildDoctorShareLink(
      {
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: "vllm serve Qwen/Qwen3-8B -tp 2",
      },
      new URLSearchParams("fromPage=kv-cache&fromAnchor=API_KEY%3Dsample"),
    );
    expect(dirtyAnchorLink.ok).toBe(true);
    if (dirtyAnchorLink.ok) {
      expect(dirtyAnchorLink.url).not.toContain("API_KEY");
      expect(dirtyAnchorLink.url).not.toContain("sample");
      expect(dirtyAnchorLink.params.get("fromAnchor")).toBeNull();
      expect(dirtyAnchorLink.params.get("fromPage")).toBe("kv-cache");
    }
    const dirtyIpAnchor = buildDoctorShareLink(
      {
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: "vllm serve Qwen/Qwen3-8B -tp 2",
      },
      new URLSearchParams("fromPage=kv-cache&fromAnchor=192.0.2.1"),
    );
    expect(dirtyIpAnchor.ok).toBe(true);
    if (dirtyIpAnchor.ok) {
      expect(dirtyIpAnchor.params.get("fromAnchor")).toBeNull();
    }
    expect(resolveToolsBackTarget(new URLSearchParams("fromPage=kv-cache&fromAnchor=192.0.2.1")).hash).toBe(
      "",
    );

    // P3-1: Invisible-only commands cannot produce an ok:true unrestorable link
    const emptyInvShare = buildDoctorShareLink({
      topology: "single",
      hardwareFamily: "A2",
      version: "v0.30.0",
      modelHint: "auto",
      commandText: "\u200b",
    });
    expect(emptyInvShare.ok).toBe(false);

    // P2-7 & P2-8: Linear scaling on 16KB single-line assignments & deep nested neutral JSON
    const singleLineMany = Array.from({ length: 1200 }, () => "API_KEY=demo").join(" ");
    const tAssign = performance.now();
    const resAssign = sanitizeDiagnosticText(singleLineMany);
    expect(performance.now() - tAssign).toBeLessThan(200);
    expect(resAssign.redactionCount).toBe(1200);

    let nestedNeutral = "1";
    for (let k = 0; k < 24; k += 1) nestedNeutral = `{"x":${nestedNeutral}}`;
    const tNest = performance.now();
    const resNest = sanitizeDiagnosticText(nestedNeutral);
    expect(performance.now() - tNest).toBeLessThan(100);
    expect(resNest.sanitized).toBe(nestedNeutral);
    expect(resNest.redactionCount).toBe(0);

    // Performance regression guard: nested neutral YAML parsed at most once inside redactYamlCredentials
    const { redactYamlCredentials } = await import("../../sim/shared/yamlRedactor");
    const yamlRes = redactYamlCredentials(nestedNeutral, () => false, "[REDACTED]");
    expect(yamlRes).toEqual({ text: nestedNeutral, count: 0 });
  });

  it("Verifier closure: closes quote-end off-by-one, Step 8.5 isolation, bash -c concat, curl bundles/CLI flags, O(N) DoS, PEM tail/JSON, folded Digest/Cookie, cross-fragment aliases, and HCCL_IF_IP", () => {
    const decodeWire = (raw: string): string => {
      const std = raw.replace(/-/g, "+").replace(/_/g, "/");
      return Buffer.from(std.padEnd(Math.ceil(std.length / 4) * 4, "="), "base64").toString("utf8");
    };

    expect(sanitizeDiagnosticText("export API_KEY='foo\\'\nMODEL=qwen3").sanitized).toBe(
      "export API_KEY='[REDACTED_KEY]'\nMODEL=qwen3",
    );
    expect(sanitizeDiagnosticText("export API_KEY='foo\\' --port 8000").sanitized).toBe(
      "export API_KEY='[REDACTED_KEY]' --port 8000",
    );
    expect(sanitizeDiagnosticText("export API_KEY='foo\\'; echo keep_me").sanitized).toBe(
      "export API_KEY='[REDACTED_KEY]'; echo keep_me",
    );
    expect(sanitizeDiagnosticText("export API_KEY='foo\\'bar_concat --port 8000").sanitized).toBe(
      "export API_KEY='[REDACTED_KEY]' --port 8000",
    );
    expect(sanitizeDiagnosticText("HCCL_IF_IP=a::b").sanitized).toBe("HCCL_IF_IP=<REDACTED_IP>");
    expect(sanitizeDiagnosticText("sym=c10::add").sanitized).toBe("sym=c10::add");

    const vectors = [
      'echo \'a"b\' && curl -d "{\\"password\\":\\"leak_after_sq\\"}"',
      '# comment "open\ncurl -d "{\\"password\\":\\"leak_after_comment\\"}"',
      'INFO msg="unclosed\ncurl -d "{\\"password\\":\\"leak_prevline\\"}"',
      "bash -c \"curl -H 'X-Api-Key: demo'sample_in_dq\"",
      "bash -c \"curl -H 'Authorization: Basic 'sample_in_dq_auth\"",
      "bash -c \"API_KEY='s1's2_in_dq\"",
      "curl -su demo:comb_su https://example.invalid/keep",
      "curl -kLu demo:comb_klu -sU demo:comb_su_cap https://example.invalid/keep",
      "curl -sbu demo:comb_sbu -sb sid=comb_sb https://example.invalid/keep",
      "curl -sudemo:comb_att https://example.invalid/keep",
      "curl -usub:comb_usub https://example.invalid/keep",
      "curl --oauth2-bearer secret_oauth2_tok https://example.invalid/keep",
      "curl --oauth2-bearer=secret_oauth2_eq https://example.invalid/keep",
      "mycli --session-id sid_secret_val --session-id=sid_eq_val --port 8000",
      "mycli --basic-auth bauth_val --basic-auth=bauth_eq --authorization raw_sec --proxy-authorization raw_psec",
      "docker-cli --registry-auth reg_auth_val --port 8000",
      'bash -c "curl -u secret_user_tok https://example.invalid/keep"',
      'bash -c "curl -b secret_cook_str https://example.invalid/keep"',
      '["-----BEGIN PRIVATE KEY-----\nQUJD\nX-Custom: foo\nREVG_PEM_JSON\n-----END PRIVATE KEY-----"]',
      'curl -d "{\\"key\\":\\"-----BEGIN PRIVATE KEY-----\\\\nSECRET_PEM_ESC\\\\n-----END PRIVATE KEY-----\\",\\"model\\":\\"qwen3\\"}"',
      '{"key":"-----BEGIN PRIVATE KEY-----\nSECRET_PEM_RAW\n-----END PRIVATE KEY-----","model":"qwen3"}',
      'INFO Authorization: Digest username="alice" \n  response="digest_sp_nl"\nENV_KEEP=1',
      "INFO Cookie: a=1\n ; b=cook_semi_next\nX-Keep: ok",
      "name: &n API_KEY\nINFO ready\njob: {name: *n, value: desc_alias_frag_sec}",
      "name: &n API_KEY\nINFO ready\n- name: *n\n    value: desc_block_frag_sec",
      'INFO {"auths":{"very-long-private-container-registry.internal.corp.example.com:5000":{"username":"ops","email":"ops@example.com","auth":"long_reg_sec"}',
      'auths:\n  ghcr.io:\n    note: "unclosed\n    auth: "broken_auth_sec"',
      'INFO header uses Bearer "quoted_bearer_sec"',
      "INFO header uses Bearer part1:part2_bearer_sec",
      "//net_u:net_p_single@proxy:8080/path",
      'INFO payload="{\\"broken\\":1\ncurl -d "{\\"password\\":\\"leak_after_trunc_json\\"}"',
      'INFO msg="unclosed \\"foo\ncurl -d "{\\"password\\":\\"leak_l1_esc\\"}"',
      'INFO secret="{\\"api_key\\":\\"leak_l1_part\\"\ncurl -d "{\\"password\\":\\"leak_l2_part\\"}"',
      "curl -4u demo:sec_4u https://example.invalid/keep",
      "curl -6U proxy:sec_6U https://example.invalid/keep",
      "curl -nu demo:sec_nu https://example.invalid/keep",
      '{ "auths": { "ghcr.io": {\n  "auth": "pretty_l1_reg_sec"',
      'curl -d "{\\"key\\":\\"-----BEGIN PRIVATE KEY-----\\\\nQUJD\\\\n-----BEGIN PRIVATE KEY-----\\\\nINNER2_ESC\\\\n-----END PRIVATE KEY-----  \\\\nOUTER2_ESC\\\\n-----END PRIVATE KEY-----\\",\\"model\\":\\"qwen3\\"}"',
      'INFO payload="{\\"api_key\\":\\"leak_l1_p2\\"\nbash -c "curl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_l2_bash\\\\\\"}\\""',
      'INFO secret="{\\"api_key\\":\\"leak_l1_part\\"\ncurl -d " {\\"password\\":\\"leak_l2_space\\"}"',
      'INFO payload="{\\"api_key\\":\\"leak_l1_ind\\"\n  mytool -d " {\\"password\\":\\"leak_l2_ind\\"}"',
      'bash -c "\ncurl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_l2_mc\\\\\\"}\\" https://example.invalid\n"',
      'bash -c "set -e\ncurl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_in_multiline_bash\\\\\\"}\\" https://example.invalid/keep\n"',
      "INFO {bad: @x, v1: {k: 1}, v2: {k: 1}, v3: {k: 1}, v4: {k: 1}, v5: {k: 1}, v6: {k: 1}, v7: {k: 1}, sec: {name: API_KEY, value: leak_after_7_valid}}",
      "INFO {bad: @x, a1: {k: 1}, a2: {k: 1}, a3: {k: 1}, a4: {k: 1}, a5: {k: 1}, a6: {k: 1}, a7: {k: 1}, cfg: {anchor_holder: &sec leak_anchor_8, password: *sec}}",
      "INFO {bad: @x, a1: {k: 1}, a2: {k: 1}, a3: {k: 1}, a4: {k: 1}, a5: {k: 1}, a6: {k: 1}, a7: {k: 1}, holder: {x: &sec2 leak_anchor_cross}, cfg: {api_key: *sec2}}",
      "INFO {bad: @x, b1: {p: @}, b2: {p: @}, b3: {p: @}, b4: {p: @}, b5: {p: @}, b6: {p: @}, b7: {p: @}, sec: {name: API_KEY, value: leak_after_7_bad}}",
      'API_KEY="unclosed_val\n  bash -c "curl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_ind_bash\\\\\\"}\\""',
      'API_KEY="unclosed_val\n\tbash -c "curl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_tab_bash\\\\\\"}\\""',
      'INFO secret="{\\"api_key\\":\\"leak_l1_ind2\\"\n  curl -d "{\\"password\\":\\"leak_ind_curl\\"}"',
      'INFO secret="{\\"api_key\\":\\"leak_l1_low\\"\nmodel=qwen3 curl -d "{\\"password\\":\\"leak_lower_env\\"}"',
      'API_KEY="unclosed_val\nvllm serve /models/qwen3 --port 8000\nmytool "curl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_l3\\\\\\"}\\""',
      'API_KEY="unclosed_val\npython3 -c "curl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_py_c\\\\\\"}\\""',
      'API_KEY="unclosed_val\nssh user@10.0.0.1 "curl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_ssh\\\\\\"}\\""',
      'API_KEY="unclosed_val\nzsh -c "curl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_zsh\\\\\\"}\\""',
      'INFO secret="{\\"api_key\\":\\"leak_l1_opt\\"\n  mytool --opt=1 && curl -d "{\\"password\\":\\"leak_after_opt\\"}"',
      "INFO {d1:{d2:{d3:{d4:{d5:{d6:{d7:{d8:{sec: {name: API_KEY, value: leak_depth8}, bad: @}}}}}}}}}",
      "INFO {d1:{d2:{d3:{d4:{d5:{d6:{d7:{d8:{holder: {x: &sec leak_d8_alias}, cfg: {api_key: *sec}, bad: @}}}}}}}}}",
      'bash -c "set -e\ncurl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_l3_pipe\\\\\\"}\\" https://example.invalid\n" | jq .',
      'bash -c "set -e\ncurl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_l3_gt\\\\\\"}\\" https://example.invalid\n" > /tmp/out',
      'bash -c "set -e\ncurl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_l3_2gt\\\\\\"}\\" https://example.invalid\n" 2>&1',
      'bash -c "set -e\ncurl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_l3_bg\\\\\\"}\\" https://example.invalid\n" &',
    ];
    const forbidden = [
      "leak_after_sq",
      "leak_after_comment",
      "leak_prevline",
      "sample_in_dq",
      "sample_in_dq_auth",
      "s2_in_dq",
      "comb_su",
      "comb_klu",
      "comb_su_cap",
      "comb_sbu",
      "comb_sb",
      "comb_att",
      "comb_usub",
      "secret_oauth2_tok",
      "secret_oauth2_eq",
      "sid_secret_val",
      "sid_eq_val",
      "bauth_val",
      "bauth_eq",
      "raw_sec",
      "raw_psec",
      "reg_auth_val",
      "secret_user_tok",
      "secret_cook_str",
      "REVG_PEM_JSON",
      "SECRET_PEM_ESC",
      "SECRET_PEM_RAW",
      "digest_sp_nl",
      "cook_semi_next",
      "desc_alias_frag_sec",
      "desc_block_frag_sec",
      "long_reg_sec",
      "broken_auth_sec",
      "quoted_bearer_sec",
      "part2_bearer_sec",
      "net_p_single",
      "leak_after_trunc_json",
      "leak_l1_esc",
      "leak_l1_part",
      "leak_l2_part",
      "sec_4u",
      "sec_6U",
      "sec_nu",
      "pretty_l1_reg_sec",
      "INNER2_ESC",
      "OUTER2_ESC",
      "leak_l1_p2",
      "leak_l2_bash",
      "leak_l2_space",
      "leak_l1_ind",
      "leak_l2_ind",
      "leak_l2_mc",
      "leak_in_multiline_bash",
      "leak_after_7_valid",
      "leak_anchor_8",
      "leak_anchor_cross",
      "leak_after_7_bad",
      "leak_ind_bash",
      "leak_tab_bash",
      "leak_l1_ind2",
      "leak_ind_curl",
      "leak_l1_low",
      "leak_lower_env",
      "leak_l3",
      "leak_py_c",
      "leak_ssh",
      "leak_zsh",
      "leak_l1_opt",
      "leak_after_opt",
      "leak_depth8",
      "leak_d8_alias",
      "leak_l3_pipe",
      "leak_l3_gt",
      "leak_l3_2gt",
      "leak_l3_bg",
    ];
    for (const vec of vectors) {
      const s1 = sanitizeDiagnosticText(vec);
      const s2 = sanitizeDiagnosticText(s1.sanitized);
      expect(s2.sanitized, `idempotency for: ${vec}`).toBe(s1.sanitized);
      expect(s2.redactionCount, `zero 2nd count for: ${vec}`).toBe(0);
      expect(s1.sanitized, `]] corruption in: ${vec}`).not.toContain("]]");
      for (const secret of forbidden) {
        expect(s1.sanitized, `leak ${secret} in ${vec}`).not.toContain(secret);
      }
      const link = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: vec,
      });
      expect(link.ok).toBe(true);
      if (link.ok) {
        const wire = decodeWire(link.params.get("cmd")!);
        for (const secret of forbidden) {
          expect(wire, `wire leak ${secret} in ${vec}`).not.toContain(secret);
        }
        expect(parseDoctorQueryParams(link.params).sharedCommand).toBe(wire);
      }
    }

    expect(
      sanitizeDiagnosticText(
        'curl -d "{\\"key\\":\\"-----BEGIN PRIVATE KEY-----\\\\nSECRET_PEM_ESC\\\\n-----END PRIVATE KEY-----\\",\\"model\\":\\"qwen3\\"}"',
      ).sanitized,
    ).toContain('\\"model\\":\\"qwen3\\"}');
    expect(
      sanitizeDiagnosticText(
        'INFO Authorization: Digest username="alice" \n  response="digest_sp_nl"\nENV_KEEP=1',
      ).sanitized,
    ).toContain("\nENV_KEEP=1");
    expect(sanitizeDiagnosticText("INFO Cookie: a=1\n ; b=cook_semi_next\nX-Keep: ok").sanitized).toContain(
      "\nX-Keep: ok",
    );
    expect(sanitizeDiagnosticText("curl -su demo:comb_su https://example.invalid/keep").sanitized).toContain(
      "https://example.invalid/keep",
    );
    expect(sanitizeDiagnosticText("grep -nu pattern_keep src/app.ts").sanitized).toBe(
      "grep -nu pattern_keep src/app.ts",
    );
    expect(
      sanitizeDiagnosticText(
        '{"auths":{"ghcr.io":{"auth":"reg_scoped_sec"}}}\n{"service":{"auth":"keep_non_auths"}}',
      ).sanitized,
    ).toContain('"auth":"keep_non_auths"');
    expect(
      sanitizeDiagnosticText(
        'curl -d "{\\"key\\":\\"-----BEGIN PRIVATE KEY-----\\\\nQUJD\\\\n-----BEGIN PRIVATE KEY-----\\\\nINNER2_ESC\\\\n-----END PRIVATE KEY-----  \\\\nOUTER2_ESC\\\\n-----END PRIVATE KEY-----\\",\\"model\\":\\"qwen3\\"}"',
      ).sanitized,
    ).toContain('\\"model\\":\\"qwen3\\"}');
    expect(sanitizeDiagnosticText('API_KEY="unclosed\nvllm serve Qwen/Qwen3-8B --port 8000').sanitized).toBe(
      'API_KEY="[REDACTED_KEY]"\nvllm serve Qwen/Qwen3-8B --port 8000',
    );
    expect(
      sanitizeDiagnosticText(
        'INFO secret="{\\"api_key\\":\\"leak_l1_part\\"\ncurl -d " {\\"password\\":\\"leak_l2_space\\"}"',
      ).sanitized,
    ).toContain('\ncurl -d " ');
    expect(
      sanitizeDiagnosticText('API_KEY="unclosed_val\n  vllm serve /models/qwen3 --host 10.2.3.4 --port 8000')
        .sanitized,
    ).toBe('API_KEY="[REDACTED_KEY]"\n  vllm serve /models/qwen3 --host <REDACTED_IP> --port 8000');
    expect(
      sanitizeDiagnosticText('API_KEY="unclosed_val\nenv FOO=bar vllm serve /models/qwen3 --port 8000')
        .sanitized,
    ).toBe('API_KEY="[REDACTED_KEY]"\nenv FOO=bar vllm serve /models/qwen3 --port 8000');
    expect(
      sanitizeDiagnosticText('{"auths":{"ghcr.io":{"auth":"s1"}},"other":{"auth":"keep_plain"}}').sanitized,
    ).toBe('{"auths":{"ghcr.io":{"auth":"[REDACTED_KEY]"}},"other":{"auth":"keep_plain"}}');
    const multilineBashOut = sanitizeDiagnosticText(
      'bash -c "set -e\ncurl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_in_multiline_bash\\\\\\"}\\" https://example.invalid/keep\n"',
    ).sanitized;
    expect(multilineBashOut).toContain("set -e");
    expect(multilineBashOut).toContain("https://example.invalid/keep");
    expect(multilineBashOut).not.toContain("leak_in_multiline_bash");
    expect(
      sanitizeDiagnosticText("INFO {bad: @x, cfg: {anchor_holder: &pub keep_pub_anchor, ref: *pub}}")
        .sanitized,
    ).toBe("INFO {bad: @x, cfg: {anchor_holder: &pub keep_pub_anchor, ref: *pub}}");
    expect(
      sanitizeDiagnosticText('API_KEY="unclosed_val\nvllm serve /models/qwen3 --port 8000\necho "done"')
        .sanitized,
    ).toBe('API_KEY="[REDACTED_KEY]"\nvllm serve /models/qwen3 --port 8000\necho "done"');
    expect(
      sanitizeDiagnosticText(
        'API_KEY="unclosed_val\nvllm serve /models/qwen3 --port 8000\nmytool "curl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_l3\\\\\\"}\\""',
      ).sanitized,
    ).toContain("\nvllm serve /models/qwen3 --port 8000\n");
    expect(
      sanitizeDiagnosticText(
        'bash -c "set -e\ncurl -d \\"{\\\\\\"password\\\\\\":\\\\\\"leak_l3_pipe\\\\\\"}\\" https://example.invalid\n" | jq .',
      ).sanitized,
    ).toContain('" | jq .');

    // P1-5 O(N) CPU DoS regression guards
    const dosInputs = [
      `${"{".repeat(200)}'a: b ${"}".repeat(32)}`,
      `${"{a: ".repeat(120)}'unclosed ${"}".repeat(120)}`,
      `${"{".repeat(32000)} a: b`,
      `https://${"a:b".repeat(10000)}/p`,
      `https://${":".repeat(16000)}/p`,
      `//${":".repeat(16000)}/p`,
    ];
    for (const [idx, d] of dosInputs.entries()) {
      const t = performance.now();
      sanitizeDiagnosticText(d);
      expect(performance.now() - t, `DoS[${idx}] ${d.slice(0, 24)} len=${d.length}`).toBeLessThan(450);
    }
  });

  it("P2-7: every TROUBLESHOOT_FIXTURES entry keeps ruleIds + firstFaultRank parity across EI0006, RuntimeError, and benign INFO >64KB floods", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");
    const MAX_TROUBLESHOOT_CHARS = 64 * 1024;

    // Drift guard: every non-comment line matched by any rule in the fixtures must satisfy `isRuleEvidenceLine`.
    for (const fx of TROUBLESHOOT_FIXTURES) {
      const report = analyzeTroubleshootInput(fx.content);
      for (const finding of report.findings) {
        for (const matched of finding.matchedLines) {
          if (matched.rawLine.trim().startsWith("#")) continue;
          expect(
            isRuleEvidenceLine(matched.rawLine),
            `isRuleEvidenceLine missed ${fx.id}/${finding.ruleId}: ${matched.rawLine}`,
          ).toBe(true);
        }
      }
    }

    const floods: ReadonlyArray<readonly [string, (i: number) => string]> = [
      [
        "ei0006",
        (i) =>
          `[ERROR] HCCL(1234,python):2025-11-28-10:00:${String(i % 60).padStart(2, "0")}.000.000 [rank${i % 16}] EI0006: Getting socket times out. Reason: remote rank ${i % 16} no response cnt=${i}`,
      ],
      [
        "runtimeStorm",
        (i) => `[rank${i % 8}] RuntimeError: worker step ${i} failed with op_${i % 997} mismatch shape ${i}`,
      ],
      [
        "info",
        (i) =>
          `INFO 11-28 10:00:${String(i % 60).padStart(2, "0")} [model_runner.py:${i % 900}] step ${i} running normally with batch ${i % 64}`,
      ],
    ];

    for (const [floodName, gen] of floods) {
      const floodLines: string[] = [];
      let totalLen = 0;
      for (let i = 0; totalLen <= MAX_TROUBLESHOOT_CHARS + 4096; i += 1) {
        const line = gen(i);
        floodLines.push(line);
        totalLen += line.length + 1;
      }
      const mid = Math.floor(floodLines.length / 2);

      for (const fx of TROUBLESHOOT_FIXTURES) {
        const merged = [
          ...floodLines.slice(0, mid),
          ...fx.content.split("\n"),
          ...floodLines.slice(mid),
        ].join("\n");
        expect(merged.length).toBeGreaterThan(MAX_TROUBLESHOOT_CHARS);
        const fullDiag = analyzeTroubleshootInput(merged);
        const truncated = truncateTroubleshootLog(merged, MAX_TROUBLESHOOT_CHARS);
        expect(truncated.length).toBeLessThanOrEqual(MAX_TROUBLESHOOT_CHARS);
        const truncDiag = analyzeTroubleshootInput(truncated);
        expect(
          truncDiag.findings.map((f) => f.ruleId).sort(),
          `ruleIds parity failed for ${floodName} x ${fx.id}`,
        ).toEqual(fullDiag.findings.map((f) => f.ruleId).sort());
        expect(
          truncDiag.firstFaultVerdict.rank,
          `firstFaultRank parity failed for ${floodName} x ${fx.id}`,
        ).toBe(fullDiag.firstFaultVerdict.rank);
      }
    }

    // Dedicated audit probes amid >64KB EI0006 cascade flood: IFNAME invalid, detached ASCEND_RT_VISIBLE_DEVICES,
    // GE compile failed, MC2 hierarchy, ModelSlim quant mismatch, device-count, glog ADXL, DEBUG hotpath.
    const eiFlood = Array.from(
      { length: 750 },
      (_, i) => `[Rank ${i % 4}] EI0006 Notify wait execute timeout seq=${i} ${"w".repeat(60)}`,
    );
    const infoHead = Array.from({ length: 350 }, () => `INFO ${"x".repeat(100)}`);
    const probes: ReadonlyArray<{ line: string; expectedRule: string; expectedRank?: number }> = [
      {
        line: "[Rank 3] HCCL_SOCKET_IFNAME invalid",
        expectedRule: "hccl-link-or-ifname-fault",
        expectedRank: 3,
      },
      {
        line: "[Rank 2] ERROR GE compile failed",
        expectedRule: "torchair-ge-graph-compile-fault",
        expectedRank: 2,
      },
      {
        line: "[Rank 1] ValueError: fused mc2 op cannot be used with hierarchy communication",
        expectedRule: "moe-mc2-or-modelslim-quant-fault",
        expectedRank: 1,
      },
      {
        line: "[Rank 4] ValueError: Quantization method specified in the model config (ascend) does not match the quantization method specified (none)",
        expectedRule: "moe-mc2-or-modelslim-quant-fault",
        expectedRank: 4,
      },
      {
        line: "[Rank 5] ValueError: local_world_size (8) must be less than or equal to the number of visible devices",
        expectedRule: "cann-driver-or-device-env-fault",
        expectedRank: 5,
      },
      {
        line: "W1123 07:23:51.968192  7379 transfer_executor_base.cpp:64] Dest buffer device_id=1 >= endpoint count 1, falling back to 192.0.2.1:20165",
        expectedRule: "mooncake-adxl-endpoint-fallback",
      },
      {
        line: "(Worker_TP0 pid=35438) DEBUG 11-23 02:25:45 [worker.py:768] torch reserved memory: 54.21 GiB, torch allocated memory: 51.22 GiB",
        expectedRule: "debug-logging-hotpath-overhead",
      },
    ];
    for (const probe of probes) {
      const log = [...infoHead, "ASCEND_RT_VISIBLE_DEVICES=7,4,2,6", probe.line, ...eiFlood].join("\n");
      expect(log.length).toBeGreaterThan(MAX_TROUBLESHOOT_CHARS);
      const tr = truncateTroubleshootLog(log, MAX_TROUBLESHOOT_CHARS);
      const diag = analyzeTroubleshootInput(tr);
      expect(
        diag.findings.map((f) => f.ruleId),
        `probe ${probe.expectedRule}`,
      ).toContain(probe.expectedRule);
      expect(diag.visibleDevices).toEqual([7, 4, 2, 6]);
      if (probe.expectedRank !== undefined) {
        expect(diag.firstFaultVerdict.rank).toBe(probe.expectedRank);
      }
    }
  }, 60_000);

  it("P2-8: compactOverlongLine stays <1s on 1MB ERROR / 300KB aclnnFoo lines and preserves decisive R13/R14 codes (507015 / 161002)", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");
    const repeatToBytes = (unit: string, target: number) =>
      unit.repeat(Math.ceil(target / unit.length)).slice(0, target);

    const err1Mb = repeatToBytes("ERROR ", 1024 * 1024);
    const t0 = performance.now();
    const outErr = truncateTroubleshootLog(err1Mb);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(outErr.length).toBeLessThanOrEqual(64 * 1024);

    const aclnn300Kb = repeatToBytes("aclnnFoo ", 300 * 1024);
    const t1 = performance.now();
    const outAclnn = truncateTroubleshootLog(aclnn300Kb);
    expect(performance.now() - t1).toBeLessThan(1000);
    expect(outAclnn.length).toBeLessThanOrEqual(64 * 1024);

    const multiAclnn = `INFO head\n${aclnn300Kb}\nINFO tail`;
    const t2 = performance.now();
    const outMultiAclnn = truncateTroubleshootLog(multiAclnn);
    expect(performance.now() - t2).toBeLessThan(1000);
    expect(outMultiAclnn.length).toBeLessThanOrEqual(64 * 1024);

    // 10.5KB single line flooded with 35x `ERROR q...` before decisive 507015 / 161002 / 507034 / 507035 / EL0004 / EZ3002 / EZ3003
    const infoFlood = `INFO ${"x".repeat(100)}\n`.repeat(700);
    for (const [code, expectedRule] of [
      ["507015", "cann-plog-aicore-fault"],
      ["161002", "cann-opapi-or-aclnn-fault"],
      ["507034", "cann-plog-aicore-fault"],
      ["507035", "cann-plog-aicore-fault"],
      ["EL0004", "cann-driver-or-device-env-fault"],
      ["EZ3002", "torchair-ge-graph-compile-fault"],
      ["EZ3003", "torchair-ge-graph-compile-fault"],
    ] as const) {
      const tailContext =
        code === "EL0004" ? "EL0004 Failed to allocate memory" : `RUNTIME error code: ${code}`;
      const overlong = `[Rank 3] ${`ERROR ${"q".repeat(240)} `.repeat(35)}${tailContext} ${"z".repeat(1810)}`;
      const full = `${infoFlood}${overlong}\n${"INFO tail\n".repeat(10)}`;
      const tr = truncateTroubleshootLog(full);
      expect(tr, `decisive code ${code} dropped`).toContain(code);
      const diag = analyzeTroubleshootInput(tr);
      expect(
        diag.findings.map((f) => f.ruleId),
        `rule missing for ${code}`,
      ).toContain(expectedRule);
      expect(diag.firstFaultVerdict.rank).toBe(3);
    }

    // Surrogate-pair safety: compacting an emoji-heavy overlong line never emits lone UTF-16 surrogates.
    const emojiLine = `🚀`.repeat(40_000);
    const compactedEmoji = truncateTroubleshootLog(emojiLine);
    expect(compactedEmoji.length).toBeLessThanOrEqual(64 * 1024);
    expect(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(compactedEmoji),
    ).toBe(false);
  });

  it("P2-9: preserves all consumed metric families when possible and appends METRICS_TRUNCATED_MARKER when any consumed sample is dropped", async () => {
    const { analyzeTroubleshootInput } = await import("../../sim/troubleshoot/logAnalyzer");
    const { runDeterministicToolEvidence } = await import("../../../server/tool-evidence");

    // (a) 1,600 consumed preemption samples exceed 64KB → marker emitted & server nulls under-counted aggregates.
    const hugePreemptions = [
      ...Array.from(
        { length: 1600 },
        (_, i) => `vllm:num_preemptions_total{engine="${i}",model="qwen3-8b"} 1`,
      ),
      ...Array.from({ length: 800 }, () => `INFO ${"x".repeat(80)}`),
    ].join("\n");
    const truncatedPreemptions = truncateTroubleshootLog(hugePreemptions);
    expect(truncatedPreemptions.length).toBeLessThanOrEqual(64 * 1024);
    expect(hasMetricsTruncatedMarker(truncatedPreemptions)).toBe(true);
    expect(truncatedPreemptions.split("\n").at(-1)).toBe(METRICS_TRUNCATED_MARKER);

    const payload = buildTroubleshootChatAnalysis(hugePreemptions);
    expect(payload).toBeDefined();
    const ev = runDeterministicToolEvidence(payload!);
    expect(ev.keyMetrics.metricsIncomplete).toBe(true);
    expect(ev.keyMetrics.numPreemptionsTotal).toBeNull();
    expect(ev.keyMetrics.kvCacheUsageRatio).toBeNull();

    // (b) >64KB histogram buckets surrounding consumed KV=0.98 + waiting=5 + preemptions=11 → all consumed samples survive intact, no marker.
    const bucketStorm = Array.from(
      { length: 1200 },
      (_, i) =>
        `vllm:time_to_first_token_seconds_bucket{engine="0",le="${(i * 0.01).toFixed(2)}",model="qwen3-8b"} ${i}`,
    );
    bucketStorm.splice(
      600,
      0,
      'vllm:kv_cache_usage_perc{engine="0",model="qwen3-8b"} 0.98',
      'vllm:num_requests_waiting{engine="0",model="qwen3-8b"} 5',
      'vllm:num_preemptions_total{engine="0",model="qwen3-8b"} 11',
    );
    const bucketLog = bucketStorm.join("\n");
    expect(bucketLog.length).toBeGreaterThan(64 * 1024);
    const truncatedBuckets = truncateTroubleshootLog(bucketLog);
    expect(hasMetricsTruncatedMarker(truncatedBuckets)).toBe(false);
    const bucketDiag = analyzeTroubleshootInput(truncatedBuckets);
    expect(bucketDiag.metrics.kvCacheUsageRatio).toBeCloseTo(0.98, 4);
    expect(bucketDiag.metrics.numPreemptionsTotal).toBe(11);
    expect(bucketDiag.findings.map((f) => f.ruleId)).toContain("metrics-kv-preemption-storm");

    // Marker detector only matches a standalone line, not an inline mention in prose.
    expect(hasMetricsTruncatedMarker(`INFO note: ${METRICS_TRUNCATED_MARKER} inline`)).toBe(false);
  });

  it("P2-12, P3-18 & P3 char policy: rejects oversized/NUL/lone-surrogate Doctor commands, bounds deep JSON iteratively, and redacts calculator share leaves", () => {
    // P2-12: oversized command or decodeCommand rejected instead of sliced to 8192.
    const paddedCmd = `vllm serve Qwen/Qwen3-8B${" ".repeat(MAX_DOCTOR_COMMAND_CHARS - 24)} --max-num-batched-tokens 1234`;
    expect(buildDoctorChatAnalysis({ command: paddedCmd })).toBeUndefined();
    const overCmdRes = buildDoctorChatAnalysisWithReason({ command: paddedCmd });
    expect(overCmdRes.ok).toBe(false);
    if (!overCmdRes.ok) {
      expect(overCmdRes.reason).toContain(String(MAX_DOCTOR_COMMAND_CHARS));
    }
    expect(
      buildDoctorChatAnalysis({
        command: "vllm serve Qwen/Qwen3-8B",
        decodeCommand: paddedCmd,
      }),
    ).toBeUndefined();

    // Redaction expansion pushing command > MAX_DOCTOR_COMMAND_CHARS also rejected instead of sliced.
    const expandingCmd = `vllm serve Qwen/Qwen3-8B ${"--api-key a ".repeat(680)}`;
    expect(expandingCmd.length).toBeLessThanOrEqual(MAX_DOCTOR_COMMAND_CHARS);
    expect(sanitizeDiagnosticText(expandingCmd).sanitized.length).toBeGreaterThan(MAX_DOCTOR_COMMAND_CHARS);
    expect(buildDoctorChatAnalysis({ command: expandingCmd })).toBeUndefined();

    // Surrogate-safe modelId clipping (119 ASCII chars + 🚀 = 121 UTF-16 code units; must not emit lone surrogate).
    const emojiModelId = `${"m".repeat(119)}🚀`;
    const emojiDoc = buildDoctorChatAnalysis({
      command: "vllm serve Qwen/Qwen3-8B",
      modelId: emojiModelId,
    });
    expect(emojiDoc?.modelId).toBe("m".repeat(119));

    // P3 char policy: NUL and lone UTF-16 surrogates rejected symmetrically across encode, share, chat, and decode.
    for (const bad of ["vllm serve M\0 --port 8000", "vllm serve M \uD800", "vllm serve M \uDC00"]) {
      expect(() => encodeDoctorCommandParam(bad)).toThrow(RangeError);
      expect(buildDoctorChatAnalysis({ command: bad })).toBeUndefined();
      const share = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: bad,
      });
      expect(share.ok).toBe(false);
    }
    // Base64url of "vllm\0serve" rejected by decoder too.
    expect(decodeDoctorCommandParam("dmxsbQBzZXJ2ZQ")).toBeNull();

    // P3-18: 4,000-deep nested array does not throw RangeError in hasNonFiniteNumber / buildDeployChatAnalysis / gate / share.
    let deep: unknown = 1;
    for (let i = 0; i < 4000; i += 1) deep = [deep];
    const deepConfigObj: Record<string, unknown> = {
      architectures: ["Qwen3ForCausalLM"],
      model_type: "qwen3",
      hidden_size: 4096,
      num_hidden_layers: 36,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      intermediate_size: 12288,
      vocab_size: 151936,
      junk: deep,
    };
    expect(() => hasNonFiniteNumber(deep)).not.toThrow();
    expect(hasNonFiniteNumber(deep)).toBe(true);
    expect(() => buildDeployChatAnalysis({ model: deepConfigObj, cardId: "a2-64g" })).not.toThrow();
    expect(buildDeployChatAnalysis({ model: deepConfigObj, cardId: "a2-64g" })).toBeUndefined();
    const deepJson = JSON.stringify(deepConfigObj);
    expect(evaluateCalculatorModelGate(deepJson, true).ok).toBe(false);
    expect(serializeCustomModelForShare(deepJson).ok).toBe(false);
    expect(parseCustomModelParam(new URLSearchParams({ customModel: deepJson }))).toBeNull();

    // P3-18: serializeCustomModelForShare and parseCustomModelParam apply sanitizeStructuralJsonLeaves identically to chat.
    const configWithSecret = JSON.stringify({
      architectures: ["Qwen3ForCausalLM", "hf_AAAAAAAAAAAAAAA"],
      model_type: "qwen3",
      hidden_size: 4096,
      num_hidden_layers: 36,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      intermediate_size: 12288,
      vocab_size: 151936,
    });
    const shareRes = serializeCustomModelForShare(configWithSecret);
    expect(shareRes.ok).toBe(true);
    if (shareRes.ok) {
      expect(shareRes.compact).not.toContain("hf_AAAAAAAAAAAAAAA");
      expect(shareRes.compact).toContain("Qwen3ForCausalLM");
    }
    const parsedShare = parseCustomModelParam(new URLSearchParams({ customModel: configWithSecret }));
    expect(parsedShare).not.toBeNull();
    expect(parsedShare).not.toContain("hf_AAAAAAAAAAAAAAA");
  });

  it("Wave 2 redactor closure (P1-1..P1-4, P2-5/10/11, P3-13..16): covers CLI short flags, argv arrays, K8s Secret, URI @, collections, YAML merges/aliases, Huawei/provider tokens, and host IP aliases", () => {
    // P1-1: command-aware short secret flags
    expect(
      sanitizeDiagnosticText("docker login -u demo -p docker_p_sec registry.example.invalid").sanitized,
    ).toBe("docker login -u demo -p [REDACTED] registry.example.invalid");
    expect(sanitizeDiagnosticText("mysql -u root -pmysql_att_sec -p app_db_keep").sanitized).toBe(
      "mysql -u root -p[REDACTED] -p app_db_keep",
    );
    expect(sanitizeDiagnosticText("sshpass -p ssh_p_sec ssh host").sanitized).toBe(
      "sshpass -p [REDACTED] ssh host",
    );

    // P1-2: JSON & YAML argv sequence arrays
    const argvJson = sanitizeDiagnosticText(
      '{"args":["--api-key","k8s_arg_sec","--api-key=k8s_eq_sec"]}',
    ).sanitized;
    expect(argvJson).not.toContain("k8s_arg_sec");
    expect(argvJson).not.toContain("k8s_eq_sec");
    const argvYaml = sanitizeDiagnosticText(
      "command:\n  - vllm\n  - serve\n  - --hf-token\n  - k8s_hf_sec",
    ).sanitized;
    expect(argvYaml).not.toContain("k8s_hf_sec");

    // P1-3: Kubernetes kind: Secret preserves keys and redacts all data / stringData values
    const k8sSecret = sanitizeDiagnosticText(
      "apiVersion: v1\nkind: Secret\nmetadata:\n  name: x\nstringData:\n  opaque_label: opaque_k1\ndata:\n  hf_b64: WlFYazI=",
    ).sanitized;
    expect(k8sSecret).toContain("opaque_label:");
    expect(k8sSecret).toContain("hf_b64:");
    expect(k8sSecret).not.toContain("opaque_k1");
    expect(k8sSecret).not.toContain("WlFYazI=");

    // P1-4, P2-5, P3-13: last-@ URI userinfo, network-path, query params, and balanced `=` collections
    expect(
      sanitizeDiagnosticText("postgres://app:Pa@ss:w0rd@db.internal:5432/app //u:np_sec@registry/v2")
        .sanitized,
    ).toBe("postgres://[REDACTED_AUTH]@db.internal:5432/app //[REDACTED_AUTH]@registry/v2");
    expect(
      sanitizeDiagnosticText("https://h/?token=(tok_paren)&page=1 https://h/?token=tok_frag#status")
        .sanitized,
    ).toBe("https://h/?token=[REDACTED_KEY]&page=1 https://h/?token=[REDACTED_KEY]#status");
    expect(
      sanitizeDiagnosticText("Namespace(api_key=('t1', 't2'), port=1) API_KEYS=[e1, e2]").sanitized,
    ).toBe("Namespace(api_key=[REDACTED_KEY], port=1) API_KEYS=[REDACTED_KEY]");

    // P2-10, P3-14: YAML merge keys, indentless seq, dangling alias cleanup, `---` isolation, weak-key guards
    const yamlEdge = sanitizeDiagnosticText(
      [
        "base: &base {name: HF_TOKEN}",
        "env: [{<<: *base, value: zqx_merge_sec}]",
        "credentials: &a {token: zqx_alias_sec}",
        "copy: *a",
        "---",
        "model: &a qwen",
      ].join("\n"),
    ).sanitized;
    expect(yamlEdge).not.toContain("zqx_merge_sec");
    expect(yamlEdge).not.toContain("zqx_alias_sec");
    expect(yamlEdge).not.toContain("copy: *a");
    expect(yamlEdge).toContain("model: &a qwen");
    expect(sanitizeDiagnosticText("password:\n- zqx_seq_sec\nmodel: qwen").sanitized).not.toContain(
      "zqx_seq_sec",
    );
    const safeProse = [
      "secret_ratio: 0.25",
      "use_secret: false",
      "token_type_ids: [1, 2]",
      "secretKeyRef:",
      "  name: hf",
      "  key: token",
      "The Bearer of this token",
    ].join("\n");
    expect(sanitizeDiagnosticText(safeProse).sanitized).toBe(safeProse);

    // P3-13 / P3-15 / P3-16: status=401 & escaped Python logs, Huawei AK/SK, provider tokens, netrc/XML, line counts, P2-11 host aliases
    expect(sanitizeDiagnosticText("INFO Authorization: Basic YTpi status=401 path=/v1").sanitized).toBe(
      "INFO Authorization: Basic [REDACTED_TOKEN] status=401 path=/v1",
    );
    expect(
      sanitizeDiagnosticText(
        "send: b'GET / HTTP/1.1\\r\\nHost: x\\r\\nAuthorization: Bearer py_req_sec\\r\\n\\r\\n'",
      ).sanitized,
    ).toBe("send: b'GET / HTTP/1.1\\r\\nHost: x\\r\\nAuthorization: Bearer [REDACTED_TOKEN]\\r\\n\\r\\n'");
    const providers = sanitizeDiagnosticText(
      "HUAWEICLOUD_SDK_AK=hw_ak OBS_SK=hw_sk obsutil config -i=oi -k=ok glpat-abcdefghijklmnopqr AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123 xoxb-1234-5678-secret machine m login u password netrc_sec <password>xml_sec</password>",
    ).sanitized;
    for (const leaked of [
      "hw_ak",
      "hw_sk",
      "oi",
      "ok",
      "glpat-",
      "AIzaSy",
      "xoxb-",
      "netrc_sec",
      "xml_sec",
    ]) {
      expect(providers).not.toContain(leaked);
    }
    const pemLines = "L1\n-----BEGIN PRIVATE KEY-----\nQUJD\n-----END PRIVATE KEY-----\nL5";
    expect(sanitizeDiagnosticText(pemLines).sanitized.split("\n")).toHaveLength(5);
    expect(
      sanitizeDiagnosticText("host=192.0.2.1 host=192.0.2.2 host=192.0.2.1 --endpoint 198.51.100.7")
        .sanitized,
    ).toBe("host=REDACTED_IP_1 host=REDACTED_IP_2 host=REDACTED_IP_1 --endpoint <REDACTED_IP>");

    const tDot = performance.now();
    sanitizeDiagnosticText(`${"1.".repeat(32000)} token=ok`);
    expect(performance.now() - tDot).toBeLessThan(150);
  });

  it("Astra closure: closes non-ASCII whitespace loop, quoted docker/argv/SecretList/URI/percent-query/Python-quote/Bearer-cont redaction, merge/YAML/XML/JWT/Basic edges, and matcher/compaction/perf guards", () => {
    // P1-1..P1-8
    expect(sanitizeDiagnosticText("curl\u00a0-u demo:s3cr3t").sanitized).not.toContain("s3cr3t");
    expect(sanitizeDiagnosticText('docker login "registry" -p DOCKER_Q_SEC').sanitized).not.toContain(
      "DOCKER_Q_SEC",
    );
    expect(sanitizeDiagnosticText('["--api-key","STANDALONE_ARG_SEC"]').sanitized).not.toContain(
      "STANDALONE_ARG_SEC",
    );
    expect(
      sanitizeDiagnosticText("command: [docker]\nargs: [login, -p, CMD_ARG_SEC]").sanitized,
    ).not.toContain("CMD_ARG_SEC");
    expect(
      sanitizeDiagnosticText("name: &opt --hf-token\nargs: [*opt, ALIAS_ARG_SEC]").sanitized,
    ).not.toContain("ALIAS_ARG_SEC");
    expect(
      sanitizeDiagnosticText("apiVersion: v1\nkind: SecretList\nitems:\n- data: {license: REVNTw==}")
        .sanitized,
    ).not.toContain("REVNTw==");
    expect(
      sanitizeDiagnosticText("base: &k {kind: Secret}\n<<: *k\ndata:\n  license: REVNTw==").sanitized,
    ).not.toContain("REVNTw==");
    expect(
      sanitizeDiagnosticText(
        "postgres://app:PG_U_SEC@db_replica:5432/app https://app:V4M_SEC@[::ffff:192.0.2.1]/",
      ).sanitized,
    ).toBe("postgres://[REDACTED_AUTH]@db_replica:5432/app https://[REDACTED_AUTH]@[<REDACTED_IP>]/");
    expect(sanitizeDiagnosticText("https://h/v1%20models?%74oken=(PCT_TOK_SEC)&page=1").sanitized).toBe(
      "https://h/v1%20models?%74oken=[REDACTED_KEY]&page=1",
    );
    const pyOut = sanitizeDiagnosticText(
      "Namespace(api_key=['a\\'b]c', 'PY_SECOND_SEC'], port=8000)",
    ).sanitized;
    expect(pyOut).not.toContain("PY_SECOND_SEC");
    expect(pyOut).toContain("port=8000");
    const bearerCont = sanitizeDiagnosticText(
      "INFO Bearer \\\n  BEARER_CONT_SEC\n[Rank 2] NPU out of memory",
    ).sanitized;
    expect(bearerCont).not.toContain("BEARER_CONT_SEC");
    expect(bearerCont.split("\n")).toHaveLength(3);
    const bearerWrap = sanitizeDiagnosticText("INFO Bearer a\\\nb\n[Rank 2] NPU out of memory").sanitized;
    expect(bearerWrap.split("\n")).toHaveLength(3);

    // P2-1..P2-8
    expect(sanitizeDiagnosticText("docker login -p --demo registry").sanitized).not.toContain("--demo");
    expect(
      sanitizeDiagnosticText(
        "base: &a {name: HF_TOKEN}\ncommon: &b {<<: *a}\nenv: [{<<: *b, value: MERGE2_SEC}]",
      ).sanitized,
    ).not.toContain("MERGE2_SEC");
    expect(sanitizeDiagnosticText("INFO client_secret=0.783191").sanitized).not.toContain("0.783191");
    expect(
      sanitizeDiagnosticText("machine registry\nlogin user\naccount build\npassword NETRC_ORD_SEC").sanitized,
    ).not.toContain("NETRC_ORD_SEC");
    expect(
      sanitizeDiagnosticText(
        `<password type="string">XML_ATTR_SEC</password><password>${"X".repeat(2100)}</password>`,
      ).sanitized,
    ).not.toMatch(/XML_ATTR_SEC|X{32}/);
    const jwtHdr = Buffer.from('{"alg":"HS256"}').toString("base64url");
    const jwtPld = Buffer.from('{\n  "sub":"demo"\n}').toString("base64url");
    expect(sanitizeDiagnosticText(`${jwtHdr}.${jwtPld}.JWT_EWOG_SIG`).sanitized).toBe("[REDACTED_KEY]");
    const commentSeq = sanitizeDiagnosticText("password:\n# note\n- foo\nmodel: qwen").sanitized;
    expect(parseAllDocuments(commentSeq)[0]?.errors ?? ["err"]).toHaveLength(0);
    expect(commentSeq).not.toContain("foo");
    const basicOom = sanitizeDiagnosticText(
      "[Rank 3] INFO Authorization: Basic YTpi NPU out of memory",
    ).sanitized;
    expect(basicOom).toContain("NPU out of memory");
    expect(basicOom).not.toContain("YTpi");

    // P2-10..P2-13, P2-15, P2-18..P2-20, P3-5, P3-7
    expect(
      isRuleEvidenceLine(`[Rank 3] HCCL_SOCKET_IFNAME interfaces=${"eth0,eth1,".repeat(25)} invalid`),
    ).toBe(true);
    const longHostLine = `[Rank 3] 2026-11-28 10:00:00 ${"x".repeat(1600)} host=192.0.2.1 ${"y".repeat(1700)} NPU out of memory`;
    const compactedHostOut = truncateTroubleshootLog(`INFO h\n${longHostLine}`, 2000);
    expect(compactedHostOut.length).toBeLessThanOrEqual(2000);
    expect(compactedHostOut).toContain("host=192.0.2.1");
    expect(compactedHostOut).toContain("NPU out of memory");
    const port507Line = `[Rank 3] ERROR ${`port=507015 ${"q".repeat(900)}`.repeat(4)}retCode: 507015 ${"z".repeat(1810)}`;
    expect(truncateTroubleshootLog(`INFO h\n${port507Line}\nINFO t`, 2000)).toContain("retCode: 507015");
    expect(getVllmMetricSampleName('vllm:num_preemptions_total{engine="0"} NaN')).toBeNull();
    expect(hasNonFiniteNumber(Array.from({ length: 100_005 }, () => null))).toBe(true);

    const tQ = performance.now();
    sanitizeDiagnosticText(`INFO blob=${"A".repeat(21_848)}`);
    expect(performance.now() - tQ).toBeLessThan(150);

    const tM = performance.now();
    expect(getVllmMetricSampleName(`vllm:num_requests_running ${"9".repeat(50_000)}ms`)).toBeNull();
    expect(performance.now() - tM).toBeLessThan(20);

    const tY = performance.now();
    sanitizeDiagnosticText("token: |\n  a\n".repeat(1250));
    expect(performance.now() - tY).toBeLessThan(250);
  });

  it("Astra Round-2 closure: closes quoted flags, registry cmd confusion, split command/args, forward YAML anchors, logged argv arrays, IDN/IPv6 query, Python escapes, space labels, netrc/XML/JWT/Basic, split rules, causal tags, and pcpSize", () => {
    // P1-2..P1-10
    expect(sanitizeDiagnosticText('docker login "--password" DBL_PW registry').sanitized).toBe(
      'docker login "--password" [REDACTED] registry',
    );
    expect(sanitizeDiagnosticText("docker login '-p' SGL_PW").sanitized).toBe("docker login '-p' [REDACTED]");
    expect(sanitizeDiagnosticText("docker login curl -p CURL_REG_PW").sanitized).toBe(
      "docker login curl -p [REDACTED]",
    );
    expect(
      sanitizeDiagnosticText('{"command":["docker","login","--password"],"args":["SPLIT_ARGS_PW"]}')
        .sanitized,
    ).not.toContain("SPLIT_ARGS_PW");
    expect(
      sanitizeDiagnosticText(
        "items: &entries [{data: {license: FWD_SECLIST_PW}}]\nmanifest: {kind: SecretList, items: *entries}",
      ).sanitized,
    ).not.toContain("FWD_SECLIST_PW");
    expect(
      sanitizeDiagnosticText(
        "defaults: &args [login, -p, FWD_ARGS_PW]\ncontainer: {command: [docker], args: *args}",
      ).sanitized,
    ).not.toContain("FWD_ARGS_PW");
    expect(sanitizeDiagnosticText('INFO argv=["--api-key","LOG_ARGV_SEC"]').sanitized).not.toContain(
      "LOG_ARGV_SEC",
    );
    expect(sanitizeDiagnosticText("https://user:IDN_SEC@bücher.example/").sanitized).toBe(
      "https://[REDACTED_AUTH]@bücher.example/",
    );
    expect(sanitizeDiagnosticText("https://[2001:db8::1]/path?%74oken=IPV6_Q_SEC").sanitized).toBe(
      "https://[<REDACTED_IP>]/path?%74oken=[REDACTED_KEY]",
    );
    const pyEsc = sanitizeDiagnosticText("Namespace(api_key=['a\\']c', 'PY_ESC2_SEC'], port=8000)").sanitized;
    expect(pyEsc).not.toContain("PY_ESC2_SEC");
    expect(pyEsc).toContain("port=8000");
    expect(
      sanitizeDiagnosticText("Namespace(api_key=['a\\']', 'PY_ESC_ADJ'], port=8000)").sanitized,
    ).not.toContain("PY_ESC_ADJ");
    expect(sanitizeDiagnosticText("api key: ZQXspace").sanitized).toBe('api key: "[REDACTED_KEY]"');
    expect(sanitizeDiagnosticText("api key: ZQXyaml\nmodel: qwen").sanitized).toBe(
      'api key: "[REDACTED_KEY]"\nmodel: qwen',
    );
    expect(sanitizeDiagnosticText("INFO api key: ZQXlog").sanitized).toBe("INFO api key: [REDACTED_KEY]");
    expect(sanitizeDiagnosticText("primary key: col_id").sanitized).toBe("primary key: col_id");

    // P2-1..P2-7
    expect(sanitizeDiagnosticText("docker login -p --port registry").sanitized).toBe(
      "docker login -p [REDACTED] registry",
    );
    expect(sanitizeDiagnosticText("vllm serve Qwen/Qwen3-8B --api-key --port 8000").sanitized).toContain(
      "--port 8000",
    );
    expect(sanitizeDiagnosticText("SECRET=0.783191").sanitized).toBe("SECRET=[REDACTED_KEY]");
    expect(sanitizeDiagnosticText("secret_ratio: 0.25\nuse_secret: false").sanitized).toBe(
      "secret_ratio: 0.25\nuse_secret: false",
    );
    expect(
      sanitizeDiagnosticText('machine registry login user password "sample \\"NETRC_ESC_PW\\""').sanitized,
    ).not.toContain("NETRC_ESC_PW");
    expect(sanitizeDiagnosticText("default password NETRC_DEF_PW").sanitized).not.toContain("NETRC_DEF_PW");
    const netrcNonLeak = sanitizeDiagnosticText(
      "INFO default route over ethernet\nINFO login user\n[Rank 3] password NPU out of memory",
    ).sanitized;
    expect(netrcNonLeak).toContain("[Rank 3] password NPU out of memory");
    expect(
      sanitizeDiagnosticText(
        '<password\n type="string">XML_NL_SEC</password><password><![CDATA[XML_CDATA_SEC]]></password>',
      ).sanitized,
    ).not.toMatch(/XML_NL_SEC|XML_CDATA_SEC/);
    const jwtHdrEmpty = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url");
    expect(sanitizeDiagnosticText(`${jwtHdrEmpty}.e30.EMPTY_SIG`).sanitized).toBe("[REDACTED_KEY]");
    expect(
      sanitizeDiagnosticText("[Rank 3] INFO Authorization: Basic YTpiY2Q= NPU out of memory").sanitized,
    ).toBe("[Rank 3] INFO Authorization: Basic [REDACTED_TOKEN] NPU out of memory");

    // P2-9..P2-15
    const flood = Array.from({ length: 350 }, () => `INFO ${"x".repeat(105)}`);
    const geLine = `[Rank 3] GE compile ${"component_or_device_descriptor_".repeat(9)} failed`;
    const freeMemLine = `[Rank 3] Free memory on device (${"dev_".repeat(80)}) on startup is less than desired`;
    for (const targetLine of [geLine, freeMemLine]) {
      expect(isRuleEvidenceLine(targetLine)).toBe(true);
      const excerpt = truncateTroubleshootLog([...flood, targetLine, ...flood].join("\n"));
      expect(analyzeTroubleshootInput(excerpt).findings.length).toBeGreaterThan(0);
    }
    const ifnameLong = `[Rank 3] HCCL_SOCKET_IFNAME ${"eth0,".repeat(280)} invalid ${"tail_".repeat(600)}`;
    const ifnameExcerpt = truncateTroubleshootLog([...flood, ifnameLong, ...flood].join("\n"));
    expect(analyzeTroubleshootInput(ifnameExcerpt).findings[0]?.ruleId).toBe("hccl-link-or-ifname-fault");

    const portSpam = Array.from(
      { length: 4 },
      (_, k) => `[Rank 3] ${"p".repeat(90)} port=507015 idx=${k} ${"t".repeat(200)}`,
    );
    const eiFlood = Array.from(
      { length: 220 },
      (_, k) =>
        `[Rank 0] ERROR 2026-11-28 10:01:${String(k % 60).padStart(2, "0")} EI0006 timeout ${"w".repeat(220)}`,
    );
    const realRet = `[Rank 3] ${"p".repeat(90)} retCode=507015 ${"t".repeat(200)}`;
    const dedupSource = [...eiFlood, ...portSpam, ...flood.slice(0, 9), realRet, ...eiFlood].join("\n");
    const dedupOut = truncateTroubleshootLog(dedupSource);
    expect(dedupOut).toContain("retCode=507015");
    expect(analyzeTroubleshootInput(dedupOut).firstFaultVerdict.rank).toBe(3);

    const labelTypes = [
      "port",
      "pid",
      "line",
      "step",
      "tokens",
      "device_id",
      "local_rank",
      "global_rank",
      "device",
      "rank",
    ];
    const metaSpamLine = `[Rank 3] ${labelTypes.map((l) => `${l}=507015 ${"m".repeat(300)}`).join(" ")} retCode: 507015 ${"z".repeat(400)}`;
    expect(truncateTroubleshootLog(`INFO h\n${metaSpamLine}\nINFO t`, 2500)).toContain("retCode: 507015");

    for (const scopeTag of ["instance=inst-a", "group=pg-a", "noderank=1"]) {
      const otherTag = scopeTag.replace("-a", "-b").replace("=1", "=2");
      const l0 = `[Rank 3] 2026-11-28 10:00:00 ${"a".repeat(2000)} ${scopeTag} ${"b".repeat(2000)} NPU out of memory`;
      const l1 = `[Rank 0] 2026-11-28 10:00:01 ${"c".repeat(2000)} ${otherTag} ${"d".repeat(2000)} EI0006 timeout`;
      expect(l0.length).toBeGreaterThan(3600);
      expect(l1.length).toBeGreaterThan(3600);
      const payload = buildTroubleshootChatAnalysis([...flood, l0, l1, ...flood].join("\n"))!;
      expect(payload.rawInput).toContain("...[单行中段省略]...");
      expect(analyzeTroubleshootInput(payload.rawInput).firstFaultVerdict.cascadeRanks).toEqual([]);
    }

    const aliasLower = sanitizeDiagnosticText("host=192.0.2.1 host=redacted_ip_1").sanitized;
    expect(aliasLower).toBe("host=REDACTED_IP_2 host=redacted_ip_1");
    expect(getVllmMetricSampleName("vllm:num_preemptions_total\u00a07")).toBe("vllm:num_preemptions_total");

    // P2-19, P2-20, P2-22, P2-24, P2-25, P3-2, P3-4
    const tPerf = performance.now();
    sanitizeDiagnosticText(`${" ".repeat(80_000)}x`);
    sanitizeDiagnosticText(`-----BEGIN PRIVATE KEY-----\n${"A".repeat(8000)}!`);
    sanitizeDiagnosticText(JSON.stringify(Array.from({ length: 600 }, () => ({ api_key: "S" }))));
    expect(performance.now() - tPerf).toBeLessThan(250);

    const viewState = {
      cardId: "a2-64g" as const,
      version: "v0.30.0" as const,
      weightPrecision: "bf16" as const,
      kvCacheDtype: "auto" as const,
      weightNzMode: 0 as const,
      tpSize: 2,
      ppSize: 2,
      dpSize: 1,
      dpLocalSize: 1,
      pcpSize: 2,
      dcpSize: 1,
      enableEp: false,
      useV2ModelRunner: true,
      gpuMemoryUtilization: 0.9,
      maxModelLen: 4096,
      maxNumBatchedTokens: 2048,
      maxNumSeqs: 64,
      cudagraphMode: "PIECEWISE" as const,
      prefillTokens: 2048,
      decodeBatchSize: 16,
      decodeContextLen: 1024,
    };
    const deployWithPcp = buildDeployViewChatAnalysis("qwen3-8b", viewState);
    const viewPlan = evaluateDeployPlan({ model: "qwen3-8b", ...buildDeployViewSharedParams(viewState) });
    expect(deployWithPcp?.pcpSize).toBe(2);
    expect(deployWithPcp?.dpLocalSize).toBe(1);
    expect(deployWithPcp?.useV2ModelRunner).toBe(true);
    expect(viewPlan.inputSummary.pcpSize).toBe(2);
    expect(viewPlan.fourQuestions.q1Fit.blockers).toEqual([]);
    expect(viewPlan.fourQuestions.q1Fit.verdict).toBe("pass");

    const wideObj: Record<string, null> = {};
    for (let k = 0; k < 100_001; k += 1) wideObj[`k${k}`] = null;
    expect(hasNonFiniteNumber(wideObj)).toBe(true);

    const zwDecode = buildDoctorChatAnalysisWithReason({
      command: "vllm serve /models/qwen3 --tp 4",
      decodeCommand: "\u200b",
    });
    expect(zwDecode.ok).toBe(false);
  });

  it("Astra Round-3 closure: closes wrapper/compose/mysql=/scalar-argv/k8s-backslash/uri/py-quote, bare auth/netrc/xml/jwt, causal/roce/oom/guard/atomic-split/smmu/aclnn/perf, and decode/version/budget edges", () => {
    // P1.1 wrapper & INFO prefixes + decoded Doctor link
    for (const cmd of [
      "sudo -u deploy docker login -p R3_WRAP_PW registry.example",
      "INFO docker login -p R3_INFO_PW registry.example",
    ]) {
      const s = sanitizeDiagnosticText(cmd);
      expect(s.sanitized).not.toMatch(/R3_WRAP_PW|R3_INFO_PW/);
      const doc = buildDoctorChatAnalysis({ command: `${cmd} && vllm serve Qwen/Qwen3-8B` })!;
      expect(doc.command).not.toMatch(/R3_WRAP_PW|R3_INFO_PW/);
      const link = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: `${cmd} && vllm serve Qwen/Qwen3-8B`,
      });
      expect(link.ok).toBe(true);
      if (link.ok) {
        const dec = parseDoctorQueryParams(link.params);
        expect(dec.sharedCommand).not.toMatch(/R3_WRAP_PW|R3_INFO_PW/);
      }
    }

    // P1.2 Compose entrypoint + command, P1.3 -pabc=secret, P1.4 scalar argv
    const composeYaml = [
      "entrypoint:",
      "  - docker",
      "  - login",
      "command:",
      "  - -p",
      "  - R3_CMP_YAML",
    ].join("\n");
    expect(sanitizeDiagnosticText(composeYaml).sanitized).not.toContain("R3_CMP_YAML");
    expect(
      sanitizeDiagnosticText('{"entrypoint":["docker","login"],"command":["-p","R3_CMP_JSON"]}').sanitized,
    ).not.toContain("R3_CMP_JSON");
    expect(
      sanitizeDiagnosticText('{"entrypoint":"docker login","command":"-p R3_CMP_STR"}').sanitized,
    ).not.toContain("R3_CMP_STR");
    expect(sanitizeDiagnosticText('["mysql","-pabc=R3_EQ_SEC"]').sanitized).not.toContain("R3_EQ_SEC");
    expect(sanitizeDiagnosticText('["docker","login","-pabc=R3_DEQ_SEC"]').sanitized).not.toContain(
      "R3_DEQ_SEC",
    );
    expect(
      sanitizeDiagnosticText('message: INFO argv=["--api-key","R3_SCALAR_SEC"]').sanitized,
    ).not.toContain("R3_SCALAR_SEC");
    expect(
      sanitizeDiagnosticText('{"message":"INFO argv=[\\"--api-key\\",\\"R3_JSCALAR_SEC\\"]"}').sanitized,
    ).not.toContain("R3_JSCALAR_SEC");
    expect(sanitizeDiagnosticText('config: |\n  argv=["--api-key","R3_BLK_SEC"]').sanitized).not.toContain(
      "R3_BLK_SEC",
    );

    // P1.5..P1.8 K8s Secret backslash, IDN/% & apostrophe URIs, comma/paren URL paths, Python quote prose
    const k8sBs = [
      "apiVersion: v1",
      "kind: Secret",
      "stringData:",
      "  license: R3_BS_SEC\\",
      "  other: R3_SIB_SEC",
    ].join("\n");
    expect(sanitizeDiagnosticText(k8sBs).sanitized).not.toMatch(/R3_BS_SEC|R3_SIB_SEC/);
    expect(sanitizeDiagnosticText("https://user:R3_IDN_PW@b%C3%BCcher.example/").sanitized).toBe(
      "https://[REDACTED_AUTH]@b%C3%BCcher.example/",
    );
    expect(sanitizeDiagnosticText("https://user:p'ssR3@b%C3%BCcher.example/").sanitized).toBe(
      "https://[REDACTED_AUTH]@b%C3%BCcher.example/",
    );
    expect(sanitizeDiagnosticText("//user:p'ssR3@b%C3%BCcher.example/v2").sanitized).toBe(
      "//[REDACTED_AUTH]@b%C3%BCcher.example/v2",
    );
    expect(sanitizeDiagnosticText("https://h.example/v1/models/a,b?%74oken=R3_COMMA_SEC").sanitized).toBe(
      "https://h.example/v1/models/a,b?%74oken=[REDACTED_KEY]",
    );
    expect(
      sanitizeDiagnosticText("https://h.example/models/weights(v2)?%74oken=R3_PAREN_SEC").sanitized,
    ).toBe("https://h.example/models/weights(v2)?%74oken=[REDACTED_KEY]");
    expect(
      sanitizeDiagnosticText("Namespace(api_key=['a\\', ', 'R3_PY_KEY2'], msg=\"it's ok\")").sanitized,
    ).not.toContain("R3_PY_KEY2");
    expect(
      sanitizeDiagnosticText("Namespace(api_key=['a\\', ', 'R3_PY_KEY3']) user's note").sanitized,
    ).not.toContain("R3_PY_KEY3");

    // P2.1..P2.4 bare HTTP header, quoted netrc machine, XML ws+CDATA, JWT leading space
    const bareAuthOom = sanitizeDiagnosticText("Authorization: Basic YTpiY2Q= NPU out of memory").sanitized;
    expect(bareAuthOom).toBe("Authorization: Basic [REDACTED_TOKEN] NPU out of memory");
    expect(analyzeTroubleshootInput(bareAuthOom).findings.map((f) => f.ruleId)).toContain("oom-stage-split");
    expect(
      sanitizeDiagnosticText('machine "registry.example" login operator password R3_NETRC_PW').sanitized,
    ).not.toContain("R3_NETRC_PW");
    expect(
      sanitizeDiagnosticText(
        '<password\n type="string">R3_XML_WS</password ><password>pre<![CDATA[R3_XML_CD]]></password>',
      ).sanitized,
    ).not.toMatch(/R3_XML_WS|R3_XML_CD/);
    const jwtSpHdr = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url");
    const jwtSpPay = Buffer.from(' {"sub":"R3_JWT_SP"}').toString("base64url");
    expect(sanitizeDiagnosticText(`${jwtSpHdr}.${jwtSpPay}.SIG3`).sanitized).toBe("[REDACTED_KEY]");

    // P2.6..P2.11 causal IPs, unbounded RoCE, Ascend context, status=0 guard, atomic split at 512B, smmu 512/1024B
    for (const tagKey of ["instance", "group"]) {
      const caLog = [
        `[2026-11-28 10:00:00] [Rank 3] ${tagKey}=192.0.2.1 RuntimeError: NPU out of memory`,
        `[2026-11-28 10:00:01] [Rank 0] ${tagKey}=192.0.2.2 EI0006 Notify wait execute timeout`,
      ].join("\n");
      const sanCa = sanitizeDiagnosticText(caLog).sanitized;
      expect(analyzeTroubleshootInput(sanCa).firstFaultVerdict.cascadeRanks).toEqual([]);
    }
    const flood = Array.from({ length: 350 }, () => `INFO ${"x".repeat(105)}`);
    const roceLong = `[Rank 3] RoCE ${"eth0_rx_".repeat(12)} port ${"detail_".repeat(15)} down transport disconnected`;
    expect(
      analyzeTroubleshootInput(truncateTroubleshootLog([...flood, roceLong, ...flood].join("\n"))).findings[0]
        ?.ruleId,
    ).toBe("hccl-link-or-ifname-fault");
    const ascendOomLog = [
      ...flood,
      "[Rank 3] INFO Using Ascend NPU backend",
      ...flood.slice(0, 20),
      "[Rank 3] ERROR torch.cuda.OutOfMemoryError: CUDA out of memory",
      ...flood,
    ].join("\n");
    expect(
      analyzeTroubleshootInput(truncateTroubleshootLog(ascendOomLog)).findings.map((f) => f.ruleId),
    ).toContain("oom-stage-split");
    const benignZeroLong = `[Rank 3] INFO status=0 ${"z".repeat(4200)} CANN error code: 507015 ${"y".repeat(600)}`;
    expect(analyzeTroubleshootInput(truncateTroubleshootLog(benignZeroLong, 512)).findings).toEqual([]);
    expect(
      analyzeTroubleshootInput(
        truncateTroubleshootLog(
          [benignZeroLong, ...flood.map((_, idx) => `INFO ${idx} ${"x".repeat(170)}`)].join("\n"),
        ),
      ).findings,
    ).toEqual([]);
    const split512 = `[Rank 3] HCCL_SOCKET_IFNAME ${"eth0,".repeat(80)} invalid ${"tail_".repeat(80)}`;
    const out512 = truncateTroubleshootLog(split512, 512);
    expect(out512.length).toBeLessThanOrEqual(512);
    expect(analyzeTroubleshootInput(out512).findings[0]?.ruleId).toBe("hccl-link-or-ifname-fault");
    const smmuFx = TROUBLESHOOT_FIXTURES.find((f) => f.id === "cann-plog-smmu-0x26-fault")!;
    const smmuFlooded = [...flood, ...smmuFx.content.split("\n"), ...flood].join("\n");
    for (const smallBudget of [512, 1024]) {
      const rSmall = analyzeTroubleshootInput(truncateTroubleshootLog(smmuFlooded, smallBudget));
      expect(rSmall.firstFaultVerdict.rank, `smmu rank at ${smallBudget}`).toBe(2);
      expect(
        rSmall.findings.map((f) => f.ruleId),
        `smmu rules at ${smallBudget}`,
      ).toEqual(expect.arrayContaining(["cann-plog-aicore-fault", "hccl-timeout-cascade"]));
    }

    // P2.15..P2.19 complexity & P3.3 / P3.4 (exercising real closing XML tags, repeated single-line headers, shared YAML seq)
    const tR3 = performance.now();
    sanitizeDiagnosticText(`${"<password>".repeat(400)}demo${"</password>".repeat(400)}`);
    sanitizeDiagnosticText(`${"Authorization: Bearer a; ".repeat(600)}\nNPU out of memory`);
    sanitizeDiagnosticText(
      `base: &base\n${Array.from({ length: 120 }, (_, k) => `  k${k}: v${k}`).join("\n")}\nitems:\n${Array.from({ length: 120 }, () => "  - {<<: *base}").join("\n")}`,
    );
    truncateTroubleshootLog(`aclnn${"A".repeat(200_000)}! failed`);
    expect(performance.now() - tR3).toBeLessThan(600);
    expect(buildDoctorChatAnalysisWithReason({ command: "vllm serve m", decodeCommand: "\x1b[0m" }).ok).toBe(
      false,
    );
    expect(sanitizeDiagnosticText("INFO [build] CANN version 8.0.0.1").sanitized).toBe(
      "INFO [build] CANN version 8.0.0.1",
    );
  });

  it("Astra Round-4 closure: closes taskset/compose-split/shared-scalar/wrapped-yaml/secret-leaf/uri-sq/rel-query, xml-pi/jwt36/nbsp-host/ascend-span/zero-status/cascade-order/domain-pid/roce-sem/aclgraph-gap/trailing-marker, and idempotency/version/whitespace", () => {
    const flood = Array.from({ length: 350 }, () => `INFO ${"x".repeat(105)}`);

    // P1.1 wrapper positionals (`taskset 1`, `chrt -f 50`) across sanitizer, doctor analysis & share link
    for (const cmd of [
      "taskset 1 docker login -p R4_TASK_PW reg.example",
      "chrt -f 50 docker login -p R4_CHRT_PW reg.example",
    ]) {
      expect(sanitizeDiagnosticText(cmd).sanitized).not.toMatch(/R4_TASK_PW|R4_CHRT_PW/);
      const doc = buildDoctorChatAnalysis({ command: `${cmd} && vllm serve m` })!;
      expect(doc.command).not.toMatch(/R4_TASK_PW|R4_CHRT_PW/);
      const link = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: `${cmd} && vllm serve m`,
      });
      expect(link.ok).toBe(true);
      if (link.ok) {
        expect(parseDoctorQueryParams(link.params).sharedCommand).not.toMatch(/R4_TASK_PW|R4_CHRT_PW/);
      }
    }

    // P1.2 split string entrypoint/command + New P1 shared anchored command scalar
    expect(
      sanitizeDiagnosticText('{"entrypoint":"docker","command":"login -p R4_SPLIT_PW"}').sanitized,
    ).not.toContain("R4_SPLIT_PW");
    const sharedScalarYaml = [
      "services:",
      "  svc1:",
      "    entrypoint: [docker, login]",
      '    command: &sharedCmd "-p R4_SHARED_SCALAR"',
      "  svc2:",
      "    entrypoint: [echo]",
      "    command: *sharedCmd",
    ].join("\n");
    const sharedOut = sanitizeDiagnosticText(sharedScalarYaml).sanitized;
    expect(sharedOut).not.toContain("R4_SHARED_SCALAR");
    expect(parseAllDocuments(sharedOut).every((d) => d.errors.length === 0)).toBe(true);

    // P1.4 wrapped plain YAML scalar from yaml.stringify({ lineWidth: 26 })
    const wrappedYaml = stringifyYaml(
      { message: 'INFO argv=["--api-key","R4_WRAP_SCALAR"]' },
      { lineWidth: 26 },
    );
    const wrappedRes = sanitizeDiagnosticText(wrappedYaml).sanitized;
    expect(wrappedRes).not.toContain("R4_WRAP_SCALAR");
    expect(parseAllDocuments(wrappedRes).every((d) => d.errors.length === 0)).toBe(true);

    // P1.5 K8s Secret Authorization whole leaf + idempotency
    const k8sAuth = [
      "apiVersion: v1",
      "kind: Secret",
      "stringData:",
      "  Authorization: Bearer sample label",
    ].join("\n");
    const k8sSan1 = sanitizeDiagnosticText(k8sAuth);
    expect(k8sSan1.sanitized).not.toContain("label");
    expect(sanitizeDiagnosticText(k8sSan1.sanitized).redactionCount).toBe(0);

    // P1.6 single-quoted URI + P1.7 path-relative query + P3.4 JSON version
    expect(sanitizeDiagnosticText("'https://docs@example.test'").sanitized).toBe(
      "'https://[REDACTED_AUTH]@example.test'",
    );
    expect(sanitizeDiagnosticText("v1/models/a,b?%74oken=R4_REL_SEC").sanitized).toBe(
      "v1/models/a,b?%74oken=[REDACTED_KEY]",
    );
    expect(sanitizeDiagnosticText('{"version":"8.0.0.1"}').sanitized).toBe('{"version":"8.0.0.1"}');

    // P2.3 XML PI + New P2.7 nested XML perf, P2.4 36-space JWT, P2.6 NBSP instance tag, New P3.1 idempotency
    expect(sanitizeDiagnosticText("<password>demo<?note ok?>text</password>").sanitized).toBe(
      "<password>[REDACTED_KEY]</password>",
    );
    const jwt36Hdr = Buffer.from('{"alg":"HS256"}').toString("base64url");
    const jwt36Pay = Buffer.from(`${" ".repeat(36)}{"sub":"R4_JWT36"}`).toString("base64url");
    expect(sanitizeDiagnosticText(`${jwt36Hdr}.${jwt36Pay}.SIG36`).sanitized).toBe("[REDACTED_KEY]");

    const nbspLog = [
      "[2026-11-28 10:00:00] [Rank 3] instance=\u00a0192.0.2.1 RuntimeError: NPU out of memory",
      "[2026-11-28 10:00:01] [Rank 0] instance=\u00a0192.0.2.2 EI0006 timeout",
    ].join("\n");
    expect(
      analyzeTroubleshootInput(sanitizeDiagnosticText(nbspLog).sanitized).firstFaultVerdict.cascadeRanks,
    ).toEqual([]);

    const pass1Bare = sanitizeDiagnosticText("Authorization: Basic YTpiY2Q= NPU out of memory");
    const pass2Bare = sanitizeDiagnosticText(pass1Bare.sanitized);
    expect(pass2Bare.sanitized).toBe("Authorization: Basic [REDACTED_TOKEN] NPU out of memory");
    expect(pass2Bare.redactionCount).toBe(0);

    // P2.8 Ascend scope anchor 50 lines before OR 15 lines after generic OOM
    for (const isAfter of [false, true]) {
      const midRoutine = Array.from({ length: isAfter ? 15 : 50 }, (_, k) => `INFO routine step ${k} ok`);
      const oomSeq = isAfter
        ? [
            "[Rank 3] ERROR torch.cuda.OutOfMemoryError: CUDA out of memory",
            ...midRoutine,
            "[Rank 3] INFO Using Ascend NPU backend",
          ]
        : [
            "[Rank 3] INFO Using Ascend NPU backend",
            ...midRoutine,
            "[Rank 3] ERROR torch.cuda.OutOfMemoryError: CUDA out of memory",
          ];
      const res = analyzeTroubleshootInput(
        truncateTroubleshootLog([...flood, ...oomSeq, ...flood].join("\n")),
      );
      expect(res.findings.map((f) => f.ruleId)).toContain("oom-stage-split");
    }

    // P2.9 zero status error_code=0 / errno=0 / status=0x0000 with >6000 char line
    for (const zeroTok of ["error_code=0", "errno=0", "status=0x0000"]) {
      const longBenign = `[Rank 3] ${"p".repeat(1500)} ${zeroTok} ${"q".repeat(4200)} CANN error code: 507015 ${"r".repeat(900)}`;
      expect(analyzeTroubleshootInput(truncateTroubleshootLog(longBenign, 512)).findings).toEqual([]);
      expect(
        analyzeTroubleshootInput(truncateTroubleshootLog([...flood, longBenign, ...flood].join("\n")))
          .findings,
      ).toEqual([]);
    }

    // P2.11 hccl-rasocket-ifname-cascade at 512 + New P2.6 sleep-nz / pd-mooncake firstFault line preservation
    const rasocketFx = TROUBLESHOOT_FIXTURES.find((f) => f.id === "hccl-rasocket-ifname-cascade")!;
    const ras512 = analyzeTroubleshootInput(
      truncateTroubleshootLog([...flood, ...rasocketFx.content.split("\n"), ...flood].join("\n"), 512),
    );
    expect(ras512.firstFaultVerdict.rank).toBe(3);
    expect(ras512.findings.map((f) => f.ruleId)).toEqual(
      expect.arrayContaining(["hccl-link-or-ifname-fault", "hccl-timeout-cascade"]),
    );

    const sleepFx = TROUBLESHOOT_FIXTURES.find((f) => f.id === "real-910b3-sleep-nz-wakeup")!;
    const sleep512 = analyzeTroubleshootInput(
      truncateTroubleshootLog([...flood, ...sleepFx.content.split("\n"), ...flood].join("\n"), 512),
    );
    expect(sleep512.findings.map((f) => f.ruleId)).toContain("sleep-mode-fractal-nz-wakeup");
    expect(sleep512.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber).toBe(353);

    const moonFx = TROUBLESHOOT_FIXTURES.find((f) => f.id === "real-910b3-pd-mooncake-config")!;
    const moon512 = analyzeTroubleshootInput(
      truncateTroubleshootLog([...flood, ...moonFx.content.split("\n"), ...flood].join("\n"), 512),
    );
    expect(moon512.findings.map((f) => f.ruleId)).toContain("mooncake-pd-transfer-error");
    expect(moon512.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber).toBe(355);

    // P2.16 shared YAML seq O(n) + New P2.2 domain-aware PID + New P2.3 RoCE disconnected + New P2.4 aclgraph gap + New P2.5 NBSP port + New P3.4 trailing marker + P3.3 whitespace decode
    const tSeq = performance.now();
    const seqYaml = `cmd: &c [${Array.from({ length: 40 }, () => '"x"').join(",")}]\nsvcs:\n${Array.from({ length: 40 }, (_, i) => `  s${i}:\n    command: *c`).join("\n")}`;
    sanitizeDiagnosticText(seqYaml);
    expect(performance.now() - tSeq).toBeLessThan(200);

    const pidConflictBase = [
      ...flood,
      "[Rank 1] host=node-a pid=77 INFO init",
      ...flood.slice(0, 22),
      "[Rank 2] host=node-b pid=77 INFO init",
      ...flood.slice(0, 22),
    ];
    for (const b of [512, 1024, 65536]) {
      expect(
        analyzeTroubleshootInput(
          truncateTroubleshootLog(
            [...pidConflictBase, "pid=77 RuntimeError: NPU out of memory", ...flood].join("\n"),
            b,
          ),
        ).firstFaultVerdict.rank,
      ).toBeNull();
      expect(
        analyzeTroubleshootInput(
          truncateTroubleshootLog(
            [...pidConflictBase, "host=node-b pid=77 RuntimeError: NPU out of memory", ...flood].join("\n"),
            b,
          ),
        ).firstFaultVerdict.rank,
      ).toBe(2);
    }

    const roceLongSem = `[Rank 3] RoCE ${"z".repeat(1800)} port ${"z".repeat(1800)} down ${"z".repeat(1800)} transport disconnected ${"z".repeat(1800)}`;
    const roceRes = analyzeTroubleshootInput(
      truncateTroubleshootLog([...flood, roceLongSem, ...flood].join("\n")),
    );
    expect(roceRes.firstFaultVerdict.rank).toBe(3);
    expect(roceRes.findings.map((f) => f.ruleId)).toContain("hccl-link-or-ifname-fault");

    const aclGap = `[Rank 3] ERROR ${"p".repeat(500)} aclgraph ${"a".repeat(280)} unsupported ${"q".repeat(500)}`;
    expect(analyzeTroubleshootInput(truncateTroubleshootLog(aclGap, 512)).findings).toEqual([]);

    const nbspPortFlood = Array.from(
      { length: 100 },
      (_, i) => `[Rank ${i}] INFO port\u00a0507015 ${"t".repeat(60)}`,
    );
    const nbspPortLog = [...nbspPortFlood, "[Rank 101] CANN error code: 507015", ...flood].join("\n");
    for (const b of [512, 1024]) {
      expect(analyzeTroubleshootInput(truncateTroubleshootLog(nbspPortLog, b)).firstFaultVerdict.rank).toBe(
        101,
      );
    }

    const endDroppedLog = [
      ...Array.from({ length: 400 }, (_, i) => `[Rank ${i % 8}] NPU out of memory ${"x".repeat(200)}`),
      ...Array.from({ length: 120 }, () => `INFO ${"t".repeat(1900)}`),
    ].join("\n");
    expect(buildTroubleshootChatAnalysis(endDroppedLog)!.rawInput).toMatch(
      /^\.\.\.\s*\[日志节选：[^\]]*\]\s*\.\.\.\s*$/m,
    );

    expect(buildDoctorChatAnalysisWithReason({ command: "vllm serve m", decodeCommand: " " }).ok).toBe(false);
  });

  it("Astra Round-5 closure: closes taskset hex mask, docker-ctx split, URI '' apostrophe, comma rel-URL & ReDoS, XML CDATA/comment close & perf, 5K-space JWT, 45-NBSP domain & multiline JSON version, auth/cookie O(N), 340/550B OOM span, status=0/DEBUG admission, host-PID conflict, err-completed, aclgraph cross-gap & 2nd anchor, zero-status displacement, calculator attachment metadata & 4-dec SSR parity, trailing marker 512B, and Doctor escaping budget", () => {
    const flood = Array.from({ length: 350 }, () => `INFO ${"x".repeat(105)}`);

    // P1.1 bare hexadecimal taskset CPU mask across sanitizer, Doctor analysis & share link
    for (const cmd of [
      "taskset ff docker login -p R5_HEX_PW reg.example",
      "taskset 0f mysql -pR5_MYSQL_HEX -e 'select 1'",
      "taskset -a ff sshpass -p R5_SSH_HEX ssh host",
    ]) {
      expect(sanitizeDiagnosticText(cmd).sanitized).not.toMatch(/R5_HEX_PW|R5_MYSQL_HEX|R5_SSH_HEX/);
      const doc = buildDoctorChatAnalysis({ command: `${cmd} && vllm serve m` })!;
      expect(doc.command).not.toMatch(/R5_HEX_PW|R5_MYSQL_HEX|R5_SSH_HEX/);
      const link = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: `${cmd} && vllm serve m`,
      });
      expect(link.ok).toBe(true);
      if (link.ok) {
        expect(parseDoctorQueryParams(link.params).sharedCommand).not.toMatch(
          /R5_HEX_PW|R5_MYSQL_HEX|R5_SSH_HEX/,
        );
      }
    }

    // P1.2 split Docker global option before login across JSON/YAML strings & arrays
    expect(
      sanitizeDiagnosticText('{"entrypoint":"docker --context","command":"prod login -p R5_DOC_CTX reg"}')
        .sanitized,
    ).not.toContain("R5_DOC_CTX");
    expect(
      sanitizeDiagnosticText(
        'entrypoint: ["docker", "-H"]\ncommand: ["tcp://10.0.0.1", "login", "-p", "R5_DOC_H"]',
      ).sanitized,
    ).not.toContain("R5_DOC_H");

    // P1.6 single-quoted YAML URI with doubled apostrophe + P1.7 comma filename rel-URL + R5.1 ReDoS
    expect(sanitizeDiagnosticText("'https://user:p''qR5@example.test/v1'").sanitized).toBe(
      "'https://[REDACTED_AUTH]@example.test/v1'",
    );
    expect(sanitizeDiagnosticText("file,v2?%74oken=R5_REL_COMMA").sanitized).toBe(
      "file,v2?%74oken=[REDACTED_KEY]",
    );
    const tRelRedos = performance.now();
    sanitizeDiagnosticText(`a${"/a".repeat(250)}=b?%74oken=ok`);
    expect(performance.now() - tRelRedos).toBeLessThan(30);

    // P2.3 + New P2.7 XML CDATA/comment close + O(N) unclosed perf + P2.4 >4KB JWT whitespace
    expect(sanitizeDiagnosticText("<password>real<!-- </password> --></password>").sanitized).toBe(
      "<password>[REDACTED_KEY]</password>",
    );
    expect(sanitizeDiagnosticText("<password>real<![CDATA[</password>]]>x</password>").sanitized).toBe(
      "<password>[REDACTED_KEY]</password>",
    );
    expect(sanitizeDiagnosticText("<password>real<?pi </password> ?>x</password>").sanitized).toBe(
      "<password>[REDACTED_KEY]</password>",
    );
    const xmlTimedPayload = `${"<password>a<!-- </password> --><![CDATA[</password>]]>x</password> ".repeat(200)}${"a".repeat(20_000)}`;
    const unclosedCmtXmlTimed = `${"<password>a<!-- unclosed </other> ".repeat(200)}${"a".repeat(20_000)}`;
    const unclosedCdataXmlTimed = `${"<secret>b<![CDATA[ unclosed ".repeat(200)}${"a".repeat(20_000)}`;
    const tXmlTimed = performance.now();
    const xmlTimedOut = sanitizeDiagnosticText(xmlTimedPayload).sanitized;
    const unclosedCmtOut = sanitizeDiagnosticText(unclosedCmtXmlTimed).sanitized;
    const unclosedCdataOut = sanitizeDiagnosticText(unclosedCdataXmlTimed).sanitized;
    expect(performance.now() - tXmlTimed).toBeLessThan(80);
    expect(xmlTimedOut).not.toContain("<password>a");
    expect(unclosedCmtOut).toContain("<!-- unclosed");
    expect(unclosedCdataOut).toContain("<secret>[REDACTED_KEY]");

    const jwt5kHdr = Buffer.from('{"alg":"HS256"}').toString("base64url");
    const jwt5kPay = Buffer.from(`${" ".repeat(5000)}{"sub":"R5_JWT5K"}`).toString("base64url");
    const jwtBracePay = Buffer.from(`{\n${" ".repeat(5000)}"sub":"R5_JWT5K2"}`).toString("base64url");
    expect(sanitizeDiagnosticText(`${jwt5kHdr}.${jwt5kPay}.SIG5K`).sanitized).toBe("[REDACTED_KEY]");
    expect(sanitizeDiagnosticText(`${jwt5kHdr}.${jwtBracePay}.SIG5K`).sanitized).toBe("[REDACTED_KEY]");

    // P2.6 >40 NBSP host tag + P3.4 multiline JSON version + P2.15/R5.11 linear headers
    const nbsp45Log = [
      `[2026-11-28 10:00:00] [Rank 3] instance=${"\u00a0".repeat(45)}192.0.2.1 RuntimeError: NPU out of memory`,
      `[2026-11-28 10:00:01] [Rank 0] instance=${"\u00a0".repeat(45)}192.0.2.2 EI0006 timeout`,
    ].join("\n");
    expect(
      analyzeTroubleshootInput(sanitizeDiagnosticText(nbsp45Log).sanitized).firstFaultVerdict.cascadeRanks,
    ).toEqual([]);
    expect(sanitizeDiagnosticText('{\n  "version":\n  "8.0.0.1"\n}').sanitized).toBe(
      '{\n  "version":\n  "8.0.0.1"\n}',
    );
    const tHdr = performance.now();
    sanitizeDiagnosticText(
      `INFO ${"Cookie: a=1; b=2; ".repeat(400)}\n${"Authorization: Bearer x; ".repeat(400)}`,
    );
    expect(performance.now() - tHdr).toBeLessThan(400);

    // P2.8 padded 50-before / 15-after Ascend scope bridges + P2.9 / R5.4 benign suppressors at 512B
    for (const [count, padLen, after] of [
      [50, 340, false],
      [15, 550, true],
    ] as const) {
      const midPad = Array.from({ length: count }, (_, k) => `INFO routine ${k} ${"x".repeat(padLen)}`);
      const seq = after
        ? [
            "[Rank 3] ERROR torch.cuda.OutOfMemoryError: CUDA out of memory",
            ...midPad,
            "[Rank 3] INFO Using Ascend NPU backend",
          ]
        : [
            "[Rank 3] INFO Using Ascend NPU backend",
            ...midPad,
            "[Rank 3] ERROR torch.cuda.OutOfMemoryError: CUDA out of memory",
          ];
      expect(
        analyzeTroubleshootInput(
          truncateTroubleshootLog([...flood, ...seq, ...flood].join("\n")),
        ).findings.map((f) => f.ruleId),
      ).toContain("oom-stage-split");
    }
    const domainStarveZero = `[Rank 3] host=${"h".repeat(120)} group=${"g".repeat(120)} instance=${"i".repeat(120)} status=0 ${"z".repeat(400)} CANN error code: 507015`;
    expect(analyzeTroubleshootInput(truncateTroubleshootLog(domainStarveZero, 512)).findings).toEqual([]);
    const debugSuppress = `[Rank 3] ${"p".repeat(1800)} CANN error code: 507015 ${"q".repeat(1800)} DEBUG ready ${"r".repeat(1800)}`;
    const compactedDebugSolo = truncateTroubleshootLog(debugSuppress, 1200);
    const compactedDebugFlood = truncateTroubleshootLog([...flood, debugSuppress, ...flood].join("\n"));
    expect(compactedDebugSolo).toContain("...[单行中段省略]...");
    expect(compactedDebugFlood).toContain("...[单行中段省略]...");
    expect(analyzeTroubleshootInput(compactedDebugSolo).findings).toEqual([]);
    expect(analyzeTroubleshootInput(compactedDebugFlood).findings).toEqual([]);

    // New P2.2 same-host PID conflict, New P2.3 err-completed, New P2.4 cross-gap, R5.3 2nd anchor, R5.5 100 zero-status
    const sameHostPid = [
      ...flood,
      "[Rank 1] host=node-a pid=77 INFO init",
      "[Rank 2] host=node-a pid=77 INFO init",
      "host=node-a pid=77 RuntimeError: NPU out of memory",
      ...flood,
    ].join("\n");
    for (const b of [512, 1024, 65536]) {
      expect(
        analyzeTroubleshootInput(truncateTroubleshootLog(sameHostPid, b)).firstFaultVerdict.rank,
      ).toBeNull();
    }
    const errCompletedRoce = `[Rank 3] RoCE ${"z".repeat(1800)} err completed ${"z".repeat(1800)} port ${"z".repeat(1800)} down ${"z".repeat(1800)} disconnected`;
    expect(
      analyzeTroubleshootInput(truncateTroubleshootLog([...flood, errCompletedRoce, ...flood].join("\n")))
        .findings[0]?.ruleId,
    ).toBe("hccl-link-or-ifname-fault");
    const aclHeadTail = `[Rank 3] ERROR aclgraph ${"a".repeat(420)} unsupported ${"b".repeat(80)}`;
    expect(analyzeTroubleshootInput(truncateTroubleshootLog(aclHeadTail, 512)).findings).toEqual([]);
    const twoAnchorGraph = `[Rank 3] ERROR aclgraph warmup ok ${"a".repeat(300)} aclgraph capture failed ${"b".repeat(120)}`;
    for (const b of [512, 1024]) {
      const r = analyzeTroubleshootInput(
        truncateTroubleshootLog([...flood, twoAnchorGraph, ...flood].join("\n"), b),
      );
      expect(r.firstFaultVerdict.rank).toBe(3);
      expect(r.findings.map((f) => f.ruleId)).toContain("graph-capture-failure");
    }
    const zero100PlusReal = [
      ...Array.from({ length: 100 }, (_, k) => `[Rank 1] INFO status=0 CANN error code: 507015 seq=${k}`),
      "[Rank 101] ERROR CANN error code: 507015",
      ...flood,
    ].join("\n");
    for (const b of [512, 1024]) {
      const r = analyzeTroubleshootInput(truncateTroubleshootLog(zero100PlusReal, b));
      expect(r.firstFaultVerdict.rank).toBe(101);
      expect(r.findings.map((f) => f.ruleId)).toContain("cann-plog-aicore-fault");
    }

    // New P3.4 empty-selection fallback at 512B + R5.9 Doctor escaping budget
    const eightInfo = Array.from({ length: 8 }, (_, k) => `INFO step=${k} ${"t".repeat(175)}`).join("\n");
    expect(truncateTroubleshootLog(eightInfo, 512)).toMatch(/^\.\.\.\s*\[日志节选：[^\]]*\]\s*\.\.\.\s*$/m);
    const escapingOverflowCmd = 'vllm serve m --chat-template "<|im_start|><|im_end|>" '.padEnd(8190, "a");
    expect(escapingOverflowCmd.length).toBeLessThanOrEqual(MAX_DOCTOR_COMMAND_CHARS);
    expect(buildDoctorChatAnalysisWithReason({ command: escapingOverflowCmd }).ok).toBe(false);

    // R5.2 + R5.6 actual calculator SSR render & attachment sanitization parity
    const ssrHtml = renderToStaticMarkup(
      createElement(DeployCalculatorView, {
        mode: "full",
        searchParams: new URLSearchParams(
          "tab=calculator&preset=qwen3-8b&card=a2-64g&tp=2&pp=2&pcp=2&dpLocal=1&v2=1&u=0.9004",
        ),
      }),
    );
    expect(ssrHtml).toContain("deploy-calculator-view");
    expect(ssrHtml).toContain("[11373, 11746]");
    expect(ssrHtml).toContain("--gpu-memory-utilization 0.9004");

    const customSpec = parseHfConfig({
      model_type: "qwen3",
      architectures: ["Llama sk-r5archsecret1234567"],
      hidden_size: 4096,
      num_hidden_layers: 36,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      intermediate_size: 12288,
      vocab_size: 151936,
    });
    const customState = {
      cardId: "a2-64g" as const,
      version: "v0.30.0" as const,
      weightPrecision: "bf16" as const,
      kvCacheDtype: "auto" as const,
      weightNzMode: 1 as const,
      tpSize: 1,
      ppSize: 1,
      dpSize: 1,
      pcpSize: 1,
      dcpSize: 1,
      enableEp: false,
      gpuMemoryUtilization: 0.9,
      maxModelLen: 4096,
      maxNumBatchedTokens: 2048,
      maxNumSeqs: 64,
      cudagraphMode: "PIECEWISE" as const,
      prefillTokens: 512,
      decodeBatchSize: 16,
      decodeContextLen: 4096,
    };
    const customPlan = evaluateDeployPlan({ model: customSpec, ...buildDeployViewSharedParams(customState) });
    const customPayload = historyChatAnalysisSchema.parse(
      buildDeployViewChatAnalysis(
        {
          model_type: "qwen3",
          architectures: ["Llama sk-r5archsecret1234567"],
          hidden_size: 4096,
          num_hidden_layers: 36,
          num_attention_heads: 32,
          num_key_value_heads: 8,
          intermediate_size: 12288,
          vocab_size: 151936,
        },
        customState,
      ),
    );
    const customAtt = buildReconcileAssistantAttachment({
      plan: {
        ...customPlan,
        spec: { ...customPlan.spec, name: "qwen3\u001b]0;hijack\u0007\nmodel" },
        card: { ...customPlan.card, name: "Atlas\u0007Card", shortName: "A2\n64G" },
      },
      recon: {
        ...reconcileStartupLog(customPlan, parseAscendStartupLog("")),
        summary: "ok\u001b[31m\nsummary",
      },
      lines: "",
      deployAnalysis: customPayload as never,
    });
    expect(JSON.stringify(customAtt)).not.toContain("sk-r5archsecret1234567");
    for (const bad of ["\u0007", "\u001b", "\n"]) {
      expect(customAtt.title).not.toContain(bad);
      expect(customAtt.summary).not.toContain(bad);
    }
    expect(historyChatAnalysisSchema.parse(customAtt.analysis)).toBeTruthy();
  });

  it("New P3.6: DeployCalculatorView SSR wiring emits live schema-valid 4-decimal deployAnalysis and redacted custom model payload", async () => {
    const capturedPayloads: Array<ReturnType<typeof buildDeployViewChatAnalysis>> = [];
    vi.resetModules();
    try {
      vi.doMock("./workbenchHandoff", async () => {
        const actual = await vi.importActual<typeof import("./workbenchHandoff")>("./workbenchHandoff");
        return {
          ...actual,
          buildDeployViewChatAnalysis: (...args: Parameters<typeof actual.buildDeployViewChatAnalysis>) => {
            const payload = actual.buildDeployViewChatAnalysis(...args);
            capturedPayloads.push(payload);
            return payload;
          },
        };
      });
      const [
        { createElement: liveCreateElement },
        { renderToStaticMarkup: liveRender },
        { DeployCalculatorView: LiveView },
        { chatAnalysisSchema: liveSchema },
      ] = await Promise.all([
        import("react"),
        import("react-dom/server"),
        import("./DeployCalculatorView"),
        import("../wiki/chat-history"),
      ]);

      liveRender(
        liveCreateElement(LiveView, {
          mode: "full",
          searchParams: new URLSearchParams(
            "tab=calculator&preset=qwen3-8b&card=a2-64g&tp=2&pp=2&pcp=2&dpLocal=1&v2=1&u=0.9004",
          ),
        }),
      );
      liveRender(
        liveCreateElement(LiveView, {
          mode: "full",
          embedded: true,
          initialModel: JSON.stringify({
            model_type: "qwen3",
            architectures: ["Llama sk-r5archsecret1234567"],
            hidden_size: 4096,
            num_hidden_layers: 36,
            num_attention_heads: 32,
            num_key_value_heads: 8,
            intermediate_size: 12288,
            vocab_size: 151936,
          }),
        }),
      );

      expect(capturedPayloads).toHaveLength(2);
      const [presetCaptured, customCaptured] = capturedPayloads;
      expect(liveSchema.parse(presetCaptured)).toBeTruthy();
      expect(presetCaptured).toMatchObject({
        cardId: "a2-64g",
        tpSize: 2,
        ppSize: 2,
        pcpSize: 2,
        dpLocalSize: 1,
        useV2ModelRunner: true,
        gpuMemoryUtilization: 0.9004,
      });
      expect(liveSchema.parse(customCaptured)).toBeTruthy();
      expect(JSON.stringify(customCaptured)).not.toContain("sk-r5archsecret1234567");
    } finally {
      vi.doUnmock("./workbenchHandoff");
      vi.resetModules();
    }
  });

  it("Astra Round-6 closure: closes taskset -- mask, !$&*; rel-URL, primary+graph secondary compaction, >75% Ascend bridge, 16-cmd YAML *args O(N), browser ReDoS metric guard, R6.1/R6.5 BEL & redactionCount, R6.2/R6.4 budgets, and R6.6 trailing omission", () => {
    // P1.1 taskset end-of-options `--` before positional CPU mask
    for (const cmd of [
      "taskset -- 0f docker login -p R6_DASH_PW reg.example",
      "sudo -- taskset -- ff mysql -pR6_SUDO_PW -e 'select 1'",
    ]) {
      expect(sanitizeDiagnosticText(cmd).sanitized).not.toMatch(/R6_DASH_PW|R6_SUDO_PW/);
      const doc = buildDoctorChatAnalysis({ command: `${cmd} && vllm serve m` })!;
      expect(doc.command).not.toMatch(/R6_DASH_PW|R6_SUDO_PW/);
      const link = buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: `${cmd} && vllm serve m`,
      });
      expect(link.ok).toBe(true);
      if (link.ok) {
        expect(parseDoctorQueryParams(link.params).sharedCommand).not.toMatch(/R6_DASH_PW|R6_SUDO_PW/);
      }
    }

    // P1.7 sub-delims `!$&*;` in relative filename before encoded query param
    expect(sanitizeDiagnosticText("report!dev/a$b;c*d?%74oken=R6_REL_BANG").sanitized).toBe(
      "report!dev/a$b;c*d?%74oken=[REDACTED_KEY]",
    );

    // New P2.4 primary CANN fault must not hide fabricated secondary graph-capture-failure after compaction
    const cannPlusGraphLine = `[Rank 3] ERROR CANN error code: 507015 aclgraph ${"g".repeat(600)} unsupported ${"q".repeat(60)}`;
    const pad = Array.from({ length: 120 }, () => `INFO queue normal ${"v".repeat(120)}`);
    const cannGraphTrunc = truncateTroubleshootLog([...pad, cannPlusGraphLine, ...pad].join("\n"), 512);
    expect(analyzeTroubleshootInput(cannGraphTrunc).findings.map((f) => f.ruleId)).toEqual([
      "cann-plog-aicore-fault",
    ]);

    // P2.8 >75% Ascend scope bridge fits within 65,536-char default handoff budget (actually truncated >85KB input)
    const bridgePad = Array.from({ length: 420 }, (_, i) => `INFO routine_pad_${i} warmup steady state ok`);
    const heavyRoutineBridge = Array.from({ length: 50 }, (_, k) => `INFO routine ${k} ${"x".repeat(970)}`);
    const longAscendBridgeLog = [
      ...bridgePad,
      "[Rank 2] INFO Using Ascend NPU backend",
      ...heavyRoutineBridge,
      "[Rank 2] ERROR torch.cuda.OutOfMemoryError: CUDA out of memory",
      ...bridgePad,
    ].join("\n");
    const longBridgeTrunc = truncateTroubleshootLog(longAscendBridgeLog);
    expect(longBridgeTrunc.length).toBeLessThan(longAscendBridgeLog.length);
    expect(longBridgeTrunc).toContain("已省略第");
    expect(analyzeTroubleshootInput(longBridgeTrunc).findings.map((f) => f.ruleId)).toContain(
      "oom-stage-split",
    );

    // P2.16 distinct ordinary command names sharing YAML *shared_args stay strictly linear
    const sharedArgsYaml = [
      "base_args: &shared_args",
      ...Array.from({ length: 32 }, (_, i) => `  - --opt-${i}`),
      "  - val",
      "services:",
      ...Array.from({ length: 16 }, (_, s) => `  svc${s}:\n    command: cmd${s}\n    args: *shared_args`),
    ].join("\n");
    const tShared = performance.now();
    const sharedOut = sanitizeDiagnosticText(sharedArgsYaml).sanitized;
    expect(performance.now() - tShared).toBeLessThan(80);
    expect(sharedOut).toContain("cmd15");

    // P2.20 browser hasReconcilableStartupMetrics never triggers quadratic regex backtracking
    const badPromLine = `vllm:kv_cache_usage_perc ${"1".repeat(50_000)}x`;
    const tBrowserMetric = performance.now();
    expect(hasReconcilableStartupMetrics(badPromLine)).toBe(false);
    expect(performance.now() - tBrowserMetric).toBeLessThan(80);
    expect(hasReconcilableStartupMetrics("vllm:kv_cache_usage_perc 0.82")).toBe(true);

    // R6.1 + R6.5 BEL control stripping + accurate redactionCount across attachment & structural JSON
    const belArchModel = {
      model_type: "qwen3",
      architectures: ["Llama\u0007Bearer R6_ARCH_SECRET"],
      hidden_size: 4096,
      num_hidden_layers: 36,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      intermediate_size: 12288,
      vocab_size: 151936,
    };
    const belState = {
      cardId: "a2-64g" as const,
      version: "v0.30.0" as const,
      weightPrecision: "bf16" as const,
      kvCacheDtype: "auto" as const,
      weightNzMode: 1 as const,
      tpSize: 1,
      ppSize: 1,
      dpSize: 1,
      pcpSize: 1,
      dcpSize: 1,
      enableEp: false,
      gpuMemoryUtilization: 0.9,
      maxModelLen: 4096,
      maxNumBatchedTokens: 2048,
      maxNumSeqs: 64,
      cudagraphMode: "PIECEWISE" as const,
      prefillTokens: 512,
      decodeBatchSize: 16,
      decodeContextLen: 4096,
    };
    const belSpec = parseHfConfig(belArchModel);
    const belPlan = evaluateDeployPlan({ model: belSpec, ...buildDeployViewSharedParams(belState) });
    const belPayload = historyChatAnalysisSchema.parse(buildDeployViewChatAnalysis(belArchModel, belState));
    const belAtt = buildReconcileAssistantAttachment({
      plan: belPlan,
      recon: reconcileStartupLog(belPlan, parseAscendStartupLog("")),
      lines: "",
      deployAnalysis: belPayload as never,
    });
    expect(belAtt.redactionCount).toBeGreaterThanOrEqual(1);
    const serializedBel = JSON.stringify(belAtt);
    expect(serializedBel).not.toContain("R6_ARCH_SECRET");
    expect(serializedBel).not.toContain("\\u0007");
    expect(serializedBel).not.toContain("\u0007");

    // R6.2 + R6.4 Doctor modelId post-neutralization budget & closed comment command parity
    expect(
      buildDoctorChatAnalysisWithReason({
        command: "vllm serve Qwen/Qwen3-8B",
        modelId: `<!--${"m".repeat(116)}`,
      }).ok,
    ).toBe(false);
    const exactClosedCommentCmd = `vllm serve m # <!-- ok --> ${"a".repeat(
      MAX_DOCTOR_COMMAND_CHARS - "vllm serve m # <!-- ok --> ".length,
    )}`;
    expect(exactClosedCommentCmd.length).toBe(MAX_DOCTOR_COMMAND_CHARS);
    expect(
      buildDoctorChatAnalysisWithReason({
        command: exactClosedCommentCmd,
        decodeCommand: exactClosedCommentCmd,
      }).ok,
    ).toBe(true);

    // R6.6 512B excerpt of 24 records with dropped tail always emits trailing omission marker
    const twentyFourTailDropped = [
      `[Rank 1] ERROR CANN error code: 507015 ${"a".repeat(60)}`,
      ...Array.from({ length: 18 }, (_, k) => `INFO step ${k + 2} ${"w".repeat(12)}`),
      ...Array.from({ length: 5 }, (_, k) => `INFO long tail ${k + 20} ${"z".repeat(160)}`),
    ].join("\n");
    const excerpt24 = truncateTroubleshootLog(twentyFourTailDropped, 512);
    expect(excerpt24.length).toBeLessThanOrEqual(512);
    expect(excerpt24).toMatch(/\.\.\.\s*\[日志节选：已省略第\s*\d+[–-]24\s*行常规输出\]\s*\.\.\.\s*$/);

    const midGapTwentyFour = [
      `INFO head ${"h".repeat(28)}`,
      ...Array.from({ length: 13 }, (_, k) => `INFO pre ${k + 2} ${"w".repeat(180)}`),
      `[Rank 2] ERROR CANN error code: 507015 ${"p".repeat(120)}`,
      ...Array.from({ length: 4 }, (_, k) => `INFO post ${k + 16} ${"s".repeat(20)}`),
      ...Array.from({ length: 5 }, (_, k) => `INFO long tail ${k + 20} ${"t".repeat(220)}`),
    ].join("\n");
    const excerptMidGap24 = truncateTroubleshootLog(midGapTwentyFour, 512);
    expect(excerptMidGap24.length).toBeLessThanOrEqual(512);
    expect(excerptMidGap24).toMatch(/\.\.\.\s*\[日志节选：已省略第\s*\d+[–-]24\s*行常规输出\]\s*\.\.\.\s*$/);
  });

  it("Astra Round-7 closure: masks semi-delimited rel-URL & EOF XML, drops engine-core-init aclgraph exclusions, neutralizes control-joined leaves, preserves L10+L19 trailing marker, and enforces CJK UTF-8 byte bounds", () => {
    // P1.7 semicolon before %74oken in relative and absolute URLs
    const relSemi = sanitizeDiagnosticText("GET /a;file/v2?%74oken=ZQX_SEMI_SECRET_1");
    expect(relSemi.sanitized).not.toContain("ZQX_SEMI_SECRET_1");
    expect(relSemi.sanitized).toBe("GET /a;file/v2?%74oken=[REDACTED_KEY]");
    const absSemi = sanitizeDiagnosticText("curl https://host/a;b?%74oken=ZQX_SEMI_SECRET_2");
    expect(absSemi.sanitized).not.toContain("ZQX_SEMI_SECRET_2");
    expect(absSemi.sanitized).toBe("curl https://host/a;b?%74oken=[REDACTED_KEY]");

    // New P1 EOF-truncated XML secrets preserve newline counts while avoiding CLI placeholder false positives
    for (const xmlCase of [
      { raw: "<password>ZQX_EOF_XML", leak: "ZQX_EOF_XML", lines: 1 },
      { raw: "<secret><api_key>ZQX_NESTED_EOF\nINFO line", leak: "ZQX_NESTED_EOF", lines: 2 },
      { raw: '<?xml version="1.0"?><password><![CDATA[ZQX_CDATA_EOF', leak: "ZQX_CDATA_EOF", lines: 1 },
      { raw: "<password>ZQX_TAG_EOF</pass", leak: "ZQX_TAG_EOF", lines: 1 },
      { raw: "<password>ZQX_CMT_EOF<!-- note\nINFO ok", leak: "ZQX_CMT_EOF", lines: 2 },
    ]) {
      const out = sanitizeDiagnosticText(xmlCase.raw);
      expect(out.sanitized).not.toContain(xmlCase.leak);
      expect(out.sanitized).toContain("[REDACTED_KEY]");
      expect(out.sanitized.split("\n").length).toBe(xmlCase.lines);
    }
    expect(sanitizeDiagnosticText("enter <token> to continue and run --port 8000").sanitized).toBe(
      "enter <token> to continue and run --port 8000",
    );

    // New P2.4 graph-capture-failure Engine core initialization failed exclusion preserved in truncation + compaction
    const pad = Array.from({ length: 180 }, (_, k) => `INFO routine warmup step=${k} steady state`);
    const excludedAclGraphLine = `[Rank 1] ERROR aclgraph ${"p".repeat(1200)} unsupported Engine core initialization failed ${"q".repeat(1200)}`;
    const excludedEngineProcLine = "[Rank 1] ERROR aclgraph unsupported EngineCoreProc died unexpectedly";
    for (const excludedLine of [excludedAclGraphLine, excludedEngineProcLine]) {
      for (const b of [512, 1024, 65_536]) {
        const trunc = truncateTroubleshootLog([...pad, excludedLine, ...pad].join("\n"), b);
        expect(analyzeTroubleshootInput(trunc).findings.map((f) => f.ruleId)).not.toContain(
          "graph-capture-failure",
        );
      }
    }

    // R6.1 control-joined structural leaf redaction & attachment/calculator parity
    const sharedCtrl = serializeCustomModelForShare(
      JSON.stringify({
        model_type: "qwen3",
        architectures: ["Qwen3ForCausalLM", "token\u0007=ZQX_CTRL_LEAF_SECRET"],
        hidden_size: 4096,
        num_hidden_layers: 36,
        num_attention_heads: 32,
        num_key_value_heads: 8,
        intermediate_size: 12288,
        vocab_size: 151936,
        notes: "token\u0007=ZQX_CTRL_NOTE_SECRET",
      }),
    );
    expect(sharedCtrl.ok).toBe(true);
    if (sharedCtrl.ok) {
      expect(sharedCtrl.compact).not.toContain("ZQX_CTRL_LEAF_SECRET");
      expect(sharedCtrl.compact).not.toContain("ZQX_CTRL_NOTE_SECRET");
      expect(sharedCtrl.compact).not.toContain("\u0007");
      expect(sharedCtrl.compact).not.toContain("\\u0007");
    }
    const ctrlDeploy = buildDeployViewChatAnalysis(
      {
        model_type: "qwen3",
        architectures: ["token\u0007=ZQX_CTRL_ARCH_SECRET"],
        hidden_size: 4096,
        num_hidden_layers: 36,
        num_attention_heads: 32,
        num_key_value_heads: 8,
        intermediate_size: 12288,
        vocab_size: 151936,
      },
      {
        cardId: "a2-64g",
        version: "v0.30.0",
        weightPrecision: "bf16",
        kvCacheDtype: "auto",
        weightNzMode: 1,
        tpSize: 1,
        ppSize: 1,
        dpSize: 1,
        pcpSize: 1,
        dcpSize: 1,
        enableEp: false,
        gpuMemoryUtilization: 0.9,
        maxModelLen: 4096,
        maxNumBatchedTokens: 2048,
        maxNumSeqs: 64,
        cudagraphMode: "PIECEWISE",
        prefillTokens: 512,
        decodeBatchSize: 16,
        decodeContextLen: 4096,
      },
    );
    expect(JSON.stringify(ctrlDeploy)).not.toContain("ZQX_CTRL_ARCH_SECRET");

    // R6.4 comment-only Doctor fields & share link rejected cleanly
    expect(buildDoctorChatAnalysisWithReason({ command: "<!-- only comment -->" }).ok).toBe(false);
    expect(
      buildDoctorChatAnalysisWithReason({
        command: "vllm serve Qwen/Qwen3-8B",
        decodeCommand: "<!-- only comment -->",
      }).ok,
    ).toBe(false);
    expect(
      buildDoctorChatAnalysisWithReason({
        command: "vllm serve Qwen/Qwen3-8B",
        modelId: "<!-- only comment -->",
      }).ok,
    ).toBe(false);
    expect(
      buildDoctorShareLink({
        topology: "single",
        hardwareFamily: "A2",
        version: "v0.30.0",
        modelHint: "auto",
        commandText: "<!-- only comment -->",
      }).ok,
    ).toBe(false);

    // R6.6 24-record 512B input with both L10 and L19 faults preserves trailing omission marker
    const l10AndL19Records = [
      ...Array.from({ length: 9 }, (_, k) => `INFO init step ${k + 1} ${"a".repeat(75)}`),
      `[Rank 1] ERROR CANN error code: 507015 ${"b".repeat(118)}`,
      ...Array.from({ length: 8 }, (_, k) => `INFO mid step ${k + 11} ${"c".repeat(75)}`),
      `[Rank 2] ERROR CANN error code: 507015 ${"d".repeat(118)}`,
      ...Array.from({ length: 5 }, (_, k) => `INFO tail step ${k + 20} ${"e".repeat(145)}`),
    ].join("\n");
    const excerptL10L19 = truncateTroubleshootLog(l10AndL19Records, 512);
    expect(excerptL10L19.length).toBeLessThanOrEqual(512);
    expect(excerptL10L19).toContain("L10");
    expect(excerptL10L19).toContain("L19");
    expect(excerptL10L19).toMatch(/\.\.\.\s*\[日志节选：已省略第\s*\d+[–-]24\s*行常规输出\]\s*\.\.\.\s*$/);

    // P2.8 / R6.4 multi-byte UTF-8 CJK logs & Doctor commands bounded strictly in bytes
    const cjkFlood = `${"中".repeat(25_000)}\n[Rank 0] ERROR CANN error code: 507015`;
    const cjkTrunc = truncateTroubleshootLog(cjkFlood);
    expect(Buffer.byteLength(cjkTrunc, "utf8")).toBeLessThanOrEqual(65_536);
    expect(cjkTrunc).toContain("507015");
    const cjkPayload = buildTroubleshootChatAnalysis(cjkFlood);
    expect(cjkPayload).toBeDefined();
    expect(Buffer.byteLength(cjkPayload!.rawInput, "utf8")).toBeLessThanOrEqual(65_536);
    expect(buildDoctorChatAnalysisWithReason({ command: `vllm serve m # ${"中".repeat(3400)}` }).ok).toBe(
      false,
    );

    // New P3 DeployCalculator out-of-range UI fields clamped to schema caps
    const clampedDeploy = buildDeployViewChatAnalysis(
      {
        model_type: "qwen3",
        hidden_size: 4096,
        num_hidden_layers: 36,
        num_attention_heads: 32,
        num_key_value_heads: 8,
        intermediate_size: 12288,
        vocab_size: 151936,
      },
      {
        cardId: "a2-64g",
        version: "v0.30.0",
        weightPrecision: "bf16",
        kvCacheDtype: "auto",
        weightNzMode: 1,
        tpSize: 1,
        ppSize: 1,
        dpSize: 1,
        pcpSize: 1,
        dcpSize: 1,
        enableEp: false,
        gpuMemoryUtilization: 1.5,
        maxModelLen: 2_000_000,
        maxNumBatchedTokens: 2_000_000,
        maxNumSeqs: 65_537,
        cudagraphMode: "PIECEWISE",
        prefillTokens: 2_000_000,
        decodeBatchSize: 70_000,
        decodeContextLen: 2_000_000,
      },
    );
    expect(clampedDeploy).toBeDefined();
    expect(clampedDeploy!.maxNumSeqs).toBe(65_536);
    expect(clampedDeploy!.maxModelLen).toBe(1_048_576);
    expect(clampedDeploy!.gpuMemoryUtilization).toBe(0.99);
    expect(() => historyChatAnalysisSchema.parse(clampedDeploy)).not.toThrow();
  });

  it("Astra Round-8 closure: masks inline url=file;?%74oken=, inline=<password>, control-boundary Bearer, Doctor BEL/blank-line comments, 66KB aclgraph exclusion, 72KB single-line CJK CANN fault, and low calculator share query round-trip", () => {
    // 1. P1.7 inline key=file;?%74oken=
    expect(sanitizeDiagnosticText("INFO url=report.txt;?%74oken=ZQX_INLINE_SEMI").sanitized).toBe(
      "INFO url=report.txt;?%74oken=[REDACTED_KEY]",
    );

    // 2. EOF inline =<password>SAMPLE
    const inlineXml = sanitizeDiagnosticText("INFO payload=<password>ZQX_INLINE_XML_SECRET");
    expect(inlineXml.sanitized).not.toContain("ZQX_INLINE_XML_SECRET");
    expect(inlineXml.sanitized).toBe("INFO payload=<password>[REDACTED_KEY]");

    // 3. R6.1 two-pass BEL-before-Bearer & token\u0007=SECRET across sanitize + share decode
    const belBearer = sanitizeDiagnosticText("INFO Llama\u0007Bearer ZQX_BEL_BEARER");
    expect(belBearer.sanitized).toBe("INFO LlamaBearer [REDACTED_TOKEN]");
    const docCtrlShare = buildDoctorShareLink({
      topology: "single",
      hardwareFamily: "A2",
      version: "v0.30.0",
      modelHint: "auto",
      commandText: "vllm serve token\u0007=ZQX_SHARE_CTRL --port 8000",
    });
    expect(docCtrlShare.ok).toBe(true);
    if (docCtrlShare.ok) {
      const parsedDoc = parseDoctorQueryParams(docCtrlShare.params);
      expect(parsedDoc.sharedCommand).not.toContain("ZQX_SHARE_CTRL");
      expect(parsedDoc.sharedCommand).not.toContain("\u0007");
      expect(parsedDoc.sharedCommand).toContain("token=[REDACTED_KEY]");
    }

    // 4. R6.4 blank-line & BEL-suffixed comment-only Doctor fields
    for (const badComment of ["<!-- only\n\ncomment -->", "<!-- only -->\u0007"]) {
      expect(buildDoctorChatAnalysisWithReason({ command: badComment }).ok).toBe(false);
      expect(
        buildDoctorChatAnalysisWithReason({ command: "vllm serve m", decodeCommand: badComment }).ok,
      ).toBe(false);
      expect(buildDoctorChatAnalysisWithReason({ command: "vllm serve m", modelId: badComment }).ok).toBe(
        false,
      );
      expect(
        buildDoctorShareLink({
          topology: "single",
          hardwareFamily: "A2",
          version: "v0.30.0",
          modelHint: "auto",
          commandText: badComment,
        }).ok,
      ).toBe(false);
    }

    // 5. >65KB single-line aclgraph exclusion + 72KB single-line CJK CANN fault
    const bigExcluded = `[Rank 1] ERROR aclgraph unsupported ${"x".repeat(65_536)} Engine core initialization failed ${"y".repeat(1000)}`;
    const bigExclPayload = buildTroubleshootChatAnalysis(bigExcluded);
    expect(bigExclPayload).toBeDefined();
    expect(bigExclPayload!.rawInput).toContain("Engine core initialization failed");
    expect(analyzeTroubleshootInput(bigExclPayload!.rawInput).findings).toEqual([]);

    const singleCjk = `${"中".repeat(24_000)} [Rank 1] ERROR CANN error code: 507015`;
    const singleCjkPayload = buildTroubleshootChatAnalysis(singleCjk);
    expect(singleCjkPayload).toBeDefined();
    expect(Buffer.byteLength(singleCjkPayload!.rawInput, "utf8")).toBeLessThanOrEqual(65_536);
    expect(singleCjkPayload!.rawInput).toContain("507015");
    expect(analyzeTroubleshootInput(singleCjkPayload!.rawInput).findings.map((f) => f.ruleId)).toContain(
      "cann-plog-aicore-fault",
    );

    // 6. Fullwidth chat-template neutralization 8192B -> 8190B accepted by client
    const fwCmd = `vllm serve m ${"中".repeat(2718)}＜|im_start|＞${"a".repeat(9)}`;
    expect(Buffer.byteLength(fwCmd, "utf8")).toBe(8_192);
    expect(buildDoctorChatAnalysisWithReason({ command: fwCmd }).ok).toBe(true);

    // 7. Valid low calculator query bounds (maxLen=256, batchTokens=128, decodeCtx=64) preserved on reopen
    const lowQueryParams = buildCalculatorQueryParams({
      presetId: "qwen3-8b",
      cardId: "a2-64g",
      maxModelLen: 256,
      maxNumBatchedTokens: 128,
      decodeContextLen: 64,
    });
    const lowQueryHtml = renderToStaticMarkup(
      createElement(DeployCalculatorView, {
        mode: "full",
        searchParams: lowQueryParams,
      }),
    );
    expect(lowQueryHtml).toContain('value="256"');
    expect(lowQueryHtml).toContain('value="128"');
    expect(lowQueryHtml).toContain('value="64"');
    expect(lowQueryHtml).toContain("--max-model-len 256");
    expect(lowQueryHtml).toContain("--max-num-batched-tokens 128");
  });

  it("Astra Round-9 closure: rejects comment-only share cmd/pcmd/dcmd on decode, runs two-pass Bearer on Doctor modelId, bounds EOF XML to newline, enforces post-redaction 8192B Doctor cap, and matches input min bounds", () => {
    // 1. Incoming share cmd/pcmd/dcmd comment-only payloads rejected on decode
    const toB64Url = (s: string): string => Buffer.from(s, "utf8").toString("base64url");
    for (const bad of ["<!-- only -->", "<!-- only\n\ncomment -->", "<!-- only -->\u0007"]) {
      expect(decodeDoctorCommandParam(toB64Url(bad))).toBeNull();
      expect(
        parseDoctorQueryParams(new URLSearchParams({ cmd: toB64Url(bad) })).sharedCommand,
      ).toBeUndefined();
      expect(
        parseDoctorQueryParams(new URLSearchParams({ pcmd: toB64Url(bad), dcmd: toB64Url("vllm serve m") }))
          .sharedPrefillCommand,
      ).toBeUndefined();
    }

    // 2. Doctor modelId two-pass BEL-Bearer redaction
    const docModelBearer = buildDoctorChatAnalysisWithReason({
      command: "vllm serve Qwen/Qwen3-8B",
      modelId: "INFO Llama\u0007Bearer ZQX_MODEL_BEARER",
    });
    expect(docModelBearer.ok).toBe(true);
    if (docModelBearer.ok) {
      expect(docModelBearer.payload.modelId).not.toContain("ZQX_MODEL_BEARER");
      expect(docModelBearer.payload.modelId).toBe("INFO LlamaBearer [REDACTED_TOKEN]");
    }

    // 3. Inline EOF XML =<password> stops at newline so subsequent fault line survives
    const xmlPlusFault = "INFO payload=<password>ZQX_INLINE_XML\n[Rank 1] ERROR CANN error code: 507015";
    const xmlFaultSan = sanitizeDiagnosticText(xmlPlusFault).sanitized;
    expect(xmlFaultSan).not.toContain("ZQX_INLINE_XML");
    expect(xmlFaultSan).toContain("INFO payload=<password>[REDACTED_KEY]");
    expect(xmlFaultSan).toContain("[Rank 1] ERROR CANN error code: 507015");
    const xmlFaultDiag = analyzeTroubleshootInput(xmlFaultSan);
    expect(xmlFaultDiag.firstFaultVerdict.rank).toBe(1);
    expect(xmlFaultDiag.findings.map((f) => f.ruleId)).toContain("cann-plog-aicore-fault");

    // 4. Doctor command whose redaction expansion >8192B (even if neutralization shrinks <=8192B) rejected cleanly
    const expandBeforeNeutralize = `vllm serve mm ${"中".repeat(2714)}＜|im_start|＞ --api-key X`;
    expect(Buffer.byteLength(expandBeforeNeutralize, "utf8")).toBeLessThanOrEqual(8_192);
    expect(
      Buffer.byteLength(sanitizeDiagnosticText(expandBeforeNeutralize).sanitized, "utf8"),
    ).toBeGreaterThan(8_192);
    expect(buildDoctorChatAnalysisWithReason({ command: expandBeforeNeutralize }).ok).toBe(false);

    // 5. Calculator full UI inputs expose schema minimums (64 / 1 / 1) instead of raising 257/129/65 to 512/256/128
    const lowUiHtml = renderToStaticMarkup(
      createElement(DeployCalculatorView, {
        mode: "full",
        searchParams: buildCalculatorQueryParams({
          presetId: "qwen3-8b",
          cardId: "a2-64g",
          maxModelLen: 256,
          maxNumBatchedTokens: 128,
          decodeContextLen: 64,
        }),
      }),
    );
    expect(lowUiHtml).not.toContain('min="512"');
    expect(lowUiHtml).not.toContain('min="256"');
    expect(lowUiHtml).not.toContain('min="128"');
  });
});
