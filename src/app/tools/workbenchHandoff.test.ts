import { describe, expect, it } from "vitest";
import {
  buildCalculatorQueryParams,
  buildDeployChatAnalysis,
  buildDoctorChatAnalysis,
  buildTroubleshootChatAnalysis,
  cardIdToHardwareFamily,
  createWorkbenchHandoffStore,
  hasReconcilableStartupMetrics,
  parseCalculatorQueryParams,
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
});
