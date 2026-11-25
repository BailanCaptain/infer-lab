import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "../../server/tool-evidence";
import { type AgentWiki, createCachedAgentWikiLoader, handleRpc, makeAgentWiki } from "./agent-access";

const pages = [
  {
    id: "block-table",
    title: "Block Table：每条请求一行",
    aliases: ["块表"],
    summary: "块表把逻辑位置翻成物理块号。",
    chapters: ["11"],
    evidence: "C",
    verified: ["releases/v0.23.0", "releases/v0.26.0rc"],
    file: "concepts/block-table.md",
    relations: [{ to: "kv-cache-spec", kind: "builds-on", note: "块多大由 spec 定" }],
    backlinks: [{ from: "paged-attention", kind: "enables", note: "分页注意力靠块表取块" }],
    text: "块表正文",
  },
  {
    id: "kv-cache-spec",
    title: "KV Cache Spec",
    aliases: [],
    summary: "每层 KV 的形状与字节数。",
    chapters: ["11"],
    evidence: "C",
    verified: [],
    file: "concepts/kv-cache-spec.md",
    relations: [],
    backlinks: [],
    text: "spec 正文",
  },
];

const wiki = (): AgentWiki => makeAgentWiki(pages as never);

describe("makeAgentWiki", () => {
  it("search 走站内问答同一个检索入口：别名精确命中排第一，带上文件路径与已核对版本", () => {
    const [first] = wiki().search("块表");
    expect(first).toMatchObject({
      id: "block-table",
      file: "wiki/concepts/block-table.md",
      how: "exact",
      verified: ["releases/v0.23.0", "releases/v0.26.0rc"],
    });
  });

  it("getPage 返回正文；id 不存在时返回 undefined 而不是抛错", () => {
    expect(wiki().getPage("block-table")?.text).toBe("块表正文");
    expect(wiki().getPage("nope")).toBeUndefined();
  });

  it("neighbors 同时给出这页声明的边和别的页指回来的边，每条带理由", () => {
    expect(wiki().neighbors("block-table")).toEqual([
      {
        id: "kv-cache-spec",
        title: "KV Cache Spec",
        kind: "builds-on",
        note: "块多大由 spec 定",
        direction: "out",
      },
      {
        id: "paged-attention",
        title: "paged-attention",
        kind: "enables",
        note: "分页注意力靠块表取块",
        direction: "in",
      },
    ]);
  });
});

describe("handleRpc（MCP 的 stdio JSON-RPC）", () => {
  it("initialize 报出协议版本与只读工具能力", () => {
    const res = handleRpc(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      wiki(),
    );
    expect(res).toMatchObject({
      id: 1,
      result: { protocolVersion: "2025-06-18", capabilities: { tools: {} } },
    });
  });

  it("tools/list 给出七个只读工具，且惰性 wiki getter 在列表与仿真调用期间不被触发", () => {
    let loaded = 0;
    const lazyWiki = () => {
      loaded += 1;
      return wiki();
    };
    const res = handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }, lazyWiki);
    const tools =
      (
        res?.result as
          | { tools: { name: string; inputSchema?: { properties?: Record<string, unknown> } }[] }
          | undefined
      )?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual([
      "wiki_search",
      "wiki_get_page",
      "wiki_neighbors",
      "ascend_plan_deploy",
      "ascend_lint_serve_cmd",
      "ascend_diagnose_log",
      "ascend_reconcile_startup_log",
    ]);
    const deployProps = (tools.find((t) => t.name === "ascend_plan_deploy")?.inputSchema?.properties ??
      {}) as Record<string, Record<string, unknown>>;
    const reconcileProps = Object.keys(
      tools.find((t) => t.name === "ascend_reconcile_startup_log")?.inputSchema?.properties ?? {},
    );
    expect(reconcileProps).toEqual(
      expect.arrayContaining([
        "kvCacheDtype",
        "weightNzMode",
        "pcpSize",
        "dcpSize",
        "blockSize",
        "userSpecifiedBlockSize",
        "enforceEager",
        "enableEplb",
        "dynamicEplb",
        "engramCpuOffload",
        "numSpecTokens",
        "cudagraphCaptureCount",
        "decodeBatchSize",
        "prefillTokens",
        "decodeContextLen",
        "maxNumBatchedTokens",
        "maxNumSeqs",
      ]),
    );
    for (const intField of [
      "tpSize",
      "ppSize",
      "dpSize",
      "pcpSize",
      "dcpSize",
      "blockSize",
      "maxModelLen",
      "maxNumBatchedTokens",
      "maxNumSeqs",
      "numSpecTokens",
      "cudagraphCaptureCount",
      "decodeBatchSize",
      "prefillTokens",
      "decodeContextLen",
    ]) {
      expect(deployProps[intField]?.type).toBe("integer");
      expect(typeof deployProps[intField]?.minimum).toBe("number");
      expect(typeof deployProps[intField]?.maximum).toBe("number");
    }
    expect(deployProps.gpuMemoryUtilization).toMatchObject({
      type: "number",
      minimum: 0.1,
      maximum: 0.99,
    });
    expect(deployProps.model?.oneOf).toBeDefined();

    const searchProps = (tools.find((t) => t.name === "wiki_search")?.inputSchema?.properties ??
      {}) as Record<string, Record<string, unknown>>;
    expect(searchProps.limit).toMatchObject({ type: "integer", minimum: 1, maximum: 50 });

    const lintProps = (tools.find((t) => t.name === "ascend_lint_serve_cmd")?.inputSchema?.properties ??
      {}) as Record<string, Record<string, unknown>>;
    expect(Object.keys(lintProps)).toEqual(
      expect.arrayContaining(["crossNodeRoce", "decodeHardwareFamily", "modelTraitOverride", "mode"]),
    );
    expect(loaded).toBe(0);

    const deployRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 21,
        method: "tools/call",
        params: {
          name: "ascend_plan_deploy",
          arguments: { model: "qwen3-8b", cardId: "a2-64g", tpSize: 1 },
        },
      },
      lazyWiki,
    );
    const deployBody = JSON.parse(
      (deployRes?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "{}",
    );
    expect(deployBody.keyMetrics.modelId).toBe("qwen3-8b");
    expect(deployBody.stages).toHaveLength(7);
    expect(loaded).toBe(0);
  });

  it("确定性体检、多卡首错 Rank 定位与启动日志对账工具正确返回结果，非法参数返回 isError 而非协议崩坏", () => {
    const lintRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 31,
        method: "tools/call",
        params: {
          name: "ascend_lint_serve_cmd",
          arguments: {
            command: "vllm serve Qwen/Qwen3-8B --tensor-parallel-size 2",
            hardwareFamily: "A2",
            version: "v0.30.0",
          },
        },
      },
      wiki,
    );
    const lintJson = JSON.parse(
      (lintRes?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "{}",
    );
    expect(lintJson.keyMetrics.scope).toBe("single");

    const logRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 32,
        method: "tools/call",
        params: {
          name: "ascend_diagnose_log",
          arguments: {
            rawInput: [
              "2026-04-12 10:12:35.402 ERROR [Worker_TP0] [Rank 0] EI0006 Notify wait execute timeout",
              "2026-04-12 10:11:05.214 ERROR [Worker_TP3] [Rank 3] RuntimeError: NPU out of memory during capture_model()",
            ].join("\n"),
          },
        },
      },
      wiki,
    );
    const logJson = JSON.parse(
      (logRes?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "{}",
    );
    expect(logJson.firstFaultVerdict.rank).toBe(3);

    const reconRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 33,
        method: "tools/call",
        params: {
          name: "ascend_reconcile_startup_log",
          arguments: {
            model: "qwen3-8b",
            cardId: "a2-64g",
            tpSize: 1,
            logText: [
              "INFO [Rank 0] Model loading took 15.29 GiB and 10.1 seconds",
              "INFO [Rank 0] Available KV cache memory: 36.20 GiB",
            ].join("\n"),
          },
        },
      },
      wiki,
    );
    const reconJson = JSON.parse(
      (reconRes?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "{}",
    );
    expect(reconJson.items).toHaveLength(6);

    const badArg = handleRpc(
      {
        jsonrpc: "2.0",
        id: 34,
        method: "tools/call",
        params: { name: "ascend_plan_deploy", arguments: { model: "qwen3-8b", cardId: "bad-card" } },
      },
      wiki,
    );
    expect(badArg?.error).toBeUndefined();
    expect(badArg?.result).toMatchObject({ isError: true });

    // HTML comment / ANSI single-source sanitization consistency
    const htmlCommentLog = handleRpc(
      {
        jsonrpc: "2.0",
        id: 35,
        method: "tools/call",
        params: {
          name: "ascend_diagnose_log",
          arguments: {
            rawInput: "INFO worker ready\n<!-- ERROR [Rank 3] RuntimeError: NPU out of memory -->",
          },
        },
      },
      wiki,
    );
    const htmlCommentJson = JSON.parse(
      (htmlCommentLog?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "{}",
    );
    expect(htmlCommentJson.keyMetrics.firstFaultRank).toBe(htmlCommentJson.firstFaultVerdict.rank);
    expect(htmlCommentJson.keyMetrics.findingCount).toBe(htmlCommentJson.findings.length);

    // Explicit targetRank absent from startup log returns isError instead of silent fallback to TP0
    const missingRankRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 36,
        method: "tools/call",
        params: {
          name: "ascend_reconcile_startup_log",
          arguments: {
            model: "qwen3-8b",
            cardId: "a2-64g",
            tpSize: 1,
            targetRank: "Worker_TP7",
            logText: "INFO [Worker_TP0] Model loading took 15.29 GiB and 10.1 seconds",
          },
        },
      },
      wiki,
    );
    expect(missingRankRes?.result).toMatchObject({ isError: true });

    // Custom config.json model in ascend_plan_deploy uses sanitized model for cliHint too (never leaks raw tokens)
    const rawSecret = "hf_abcdefghijklmnopqrstuvwxyz123456";
    const customDeployRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 37,
        method: "tools/call",
        params: {
          name: "ascend_plan_deploy",
          arguments: {
            cardId: "a2-64g",
            model: {
              model_type: "qwen3",
              architectures: [`Qwen3ForCausalLM ${rawSecret}`],
              hidden_size: 4096,
              intermediate_size: 12288,
              num_hidden_layers: 36,
              num_attention_heads: 32,
              num_key_value_heads: 8,
              vocab_size: 151936,
              max_position_embeddings: 32768,
            },
          },
        },
      },
      wiki,
    );
    const customDeployText =
      (customDeployRes?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "";
    expect(customDeployText).not.toContain(rawSecret);
    expect(JSON.parse(customDeployText).cliHint).toContain("[REDACTED]");
  });

  it("真实纯 Node stdio 子进程启动 wiki-mcp.ts 零 virtual 报错并区分 -32700 与业务参数错误", async () => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/wiki-mcp.ts"], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c: string) => stdoutChunks.push(c));
    child.stderr.on("data", (c: string) => stderrChunks.push(c));

    const requests = [
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      "{broken-json AWS_SECRET_ACCESS_KEY=AUDITMARK_RAW_LINE",
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "ascend_plan_deploy", arguments: { model: "qwen3-8b", cardId: "a2-64g" } },
      }),
      JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "ascend_lint_serve_cmd", arguments: { command: "" } },
      }),
    ];
    child.stdin.end(`${requests.join("\n")}\n`);

    const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
    expect(code).toBe(0);
    expect(stderrChunks.join("")).toBe("");
    const lines = stdoutChunks
      .join("")
      .trim()
      .split(/\r?\n/)
      .map((l) => JSON.parse(l));
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatchObject({ id: 1, result: { capabilities: { tools: {} } } });
    expect(lines[1]).toMatchObject({
      id: null,
      error: { code: -32700, message: "Invalid JSON-RPC payload" },
    });
    expect(JSON.stringify(lines[1])).not.toContain("AUDITMARK_RAW_LINE");
    expect(JSON.stringify(lines[1])).not.toContain("broken-json");
    expect(lines[2]?.result?.isError).toBe(false);
    expect(lines[3]?.result?.isError).toBe(true);
  }, 20_000);

  it("tools/call 把结果放进 text 内容；查不到的页是 isError，不是协议错误", () => {
    const ok = handleRpc(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "wiki_search", arguments: { query: "块表" } },
      },
      wiki(),
    );
    const body = (ok?.result as { content: { text: string }[] } | undefined)?.content[0]?.text ?? "[]";
    expect(JSON.parse(body)[0]?.id).toBe("block-table");
    const miss = handleRpc(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "wiki_get_page", arguments: { id: "nope" } },
      },
      wiki(),
    );
    expect(miss?.result).toMatchObject({ isError: true });
  });

  it("通知没有 id，不回包；不认识的方法回 -32601", () => {
    expect(handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, wiki())).toBeUndefined();
    expect(handleRpc({ jsonrpc: "2.0", id: 5, method: "resources/list" }, wiki())).toMatchObject({
      id: 5,
      error: { code: -32601 },
    });
  });

  it("P1-3: ascend_diagnose_log 与 ascend_reconcile_startup_log 彻底脱敏多类凭据、PEM 与 IPv4 并保留版本号与 token 计数", async () => {
    const { redactSensitiveText } = await import("../../server/tool-evidence");
    const pemBlock = [
      "-----BEGIN PRIVATE KEY-----",
      "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7AUDITMARKPEM",
      "-----END PRIVATE KEY-----",
    ].join("\n");
    const multilineSecret = 'AWS_SECRET_ACCESS_KEY="line1_AUDITMARK_ML\nline2_AUDITMARK_ML2"';
    const directRedacted = redactSensitiveText(`${pemBlock}\n${multilineSecret}\nv0.30.0 10.20.30.40`);
    expect(directRedacted).not.toContain("AUDITMARKPEM");
    expect(directRedacted).not.toContain("AUDITMARK_ML");
    expect(directRedacted).not.toContain("AUDITMARK_ML2");
    expect(directRedacted).not.toContain("10.20.30.40");
    expect(directRedacted).toContain("v0.30.0");
    expect(directRedacted).toContain("[REDACTED]");

    const logWithSecrets = [
      "2026-11-20 10:00:01.000 [Rank 0] INFO v0.30.0 max_num_batched_tokens=2048 eos_token_id=151645",
      '2026-11-20 10:00:02.000 [Rank 1] ERROR RuntimeError: NPU out of memory AWS_SECRET_ACCESS_KEY=AUDITMARK_AWS PRIVATE_KEY=AUDITMARK_PK HUGGINGFACE_TOKEN=AUDITMARK_HF redis://:AUDITMARK_REDIS@10.20.30.40:6379/0 {"access_token": "AUDITMARK_JSON"}',
      "2026-11-20 10:00:03.000 [Rank 2] ERROR HCCL Error: EI0006 timeout connecting 192.168.1.99",
    ].join("\n");

    const diagRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 41,
        method: "tools/call",
        params: { name: "ascend_diagnose_log", arguments: { rawInput: logWithSecrets } },
      },
      wiki,
    );
    const diagText =
      (diagRes?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "";
    for (const marker of [
      "AUDITMARK_AWS",
      "AUDITMARK_PK",
      "AUDITMARK_HF",
      "AUDITMARK_REDIS",
      "AUDITMARK_JSON",
      "10.20.30.40",
      "192.168.1.99",
    ]) {
      expect(diagText).not.toContain(marker);
    }
    const diagJson = JSON.parse(diagText);
    expect(diagJson.firstFaultVerdict.primaryEvidenceLines[0].rawLine).toContain("[REDACTED]");
    expect(diagJson.findings[0].matchedLines[0].rawLine).toContain("[REDACTED]");

    const reconRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 42,
        method: "tools/call",
        params: {
          name: "ascend_reconcile_startup_log",
          arguments: {
            model: "qwen3-8b",
            cardId: "a2-64g",
            tpSize: 1,
            logText: [
              "INFO [Rank 0] v0.30.0 Model loading took 15.29 GiB and 10.1 seconds",
              "INFO [Rank 0] Available KV cache memory: 36.20 GiB",
              "ERROR [Rank 0] AWS_SECRET_ACCESS_KEY=AUDITMARK_RECON PRIVATE_KEY=AUDITMARK_RECON2 redis://:AUDITMARK_RECON3@192.168.10.20:6379",
            ].join("\n"),
          },
        },
      },
      wiki,
    );
    const reconText =
      (reconRes?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "";
    for (const marker of ["AUDITMARK_RECON", "AUDITMARK_RECON2", "AUDITMARK_RECON3", "192.168.10.20"]) {
      expect(reconText).not.toContain(marker);
    }

    const reconErrRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 420,
        method: "tools/call",
        params: {
          name: "ascend_reconcile_startup_log",
          arguments: {
            model: "qwen3-8b",
            cardId: "a2-64g",
            tpSize: 1,
            targetRank: "Rank_AWS_SECRET_ACCESS_KEY=AUDITMARK_RANK",
            logText: "INFO [Rank 0] Model loading took 15.29 GiB and 10.1 seconds",
          },
        },
      },
      wiki,
    );
    const reconErrText =
      (reconErrRes?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "";
    expect(reconErrRes?.result).toMatchObject({ isError: true });
    expect(reconErrText).not.toContain("AUDITMARK_RANK");
    expect(reconErrText).toContain("[REDACTED]");
    // Verify non-secret version string v0.30.0 and token-count identifiers remain unredacted
    const diagRawRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 43,
        method: "tools/call",
        params: {
          name: "ascend_diagnose_log",
          arguments: {
            rawInput:
              "2026-11-20 10:00:01 [Rank 0] ERROR v0.30.0 max_num_batched_tokens=2048 eos_token_id=151645 RuntimeError: NPU out of memory",
          },
        },
      },
      wiki,
    );
    const diagRawText =
      (diagRawRes?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "";
    expect(diagRawText).toContain("v0.30.0");
    expect(diagRawText).toContain("max_num_batched_tokens=2048");
    expect(diagRawText).toContain("eos_token_id=151645");
  });

  it("P2-7: 拒绝非整数 tpSize/limit 与越界 gpuMemoryUtilization（避免静默截断）", () => {
    const floatTp = handleRpc(
      {
        jsonrpc: "2.0",
        id: 51,
        method: "tools/call",
        params: {
          name: "ascend_plan_deploy",
          arguments: { model: "qwen3-8b", cardId: "a2-64g", tpSize: 1.5 },
        },
      },
      wiki,
    );
    expect(floatTp?.result).toMatchObject({ isError: true });

    const lowUtil = handleRpc(
      {
        jsonrpc: "2.0",
        id: 52,
        method: "tools/call",
        params: {
          name: "ascend_plan_deploy",
          arguments: { model: "qwen3-8b", cardId: "a2-64g", gpuMemoryUtilization: 0.05 },
        },
      },
      wiki,
    );
    expect(lowUtil?.result).toMatchObject({ isError: true });

    const highUtil = handleRpc(
      {
        jsonrpc: "2.0",
        id: 53,
        method: "tools/call",
        params: {
          name: "ascend_plan_deploy",
          arguments: { model: "qwen3-8b", cardId: "a2-64g", gpuMemoryUtilization: 0.999 },
        },
      },
      wiki,
    );
    expect(highUtil?.result).toMatchObject({ isError: true });

    const floatLimit = handleRpc(
      {
        jsonrpc: "2.0",
        id: 54,
        method: "tools/call",
        params: { name: "wiki_search", arguments: { query: "块表", limit: 1.5 } },
      },
      wiki,
    );
    expect(floatLimit?.result).toMatchObject({ isError: true });
  });

  it("P2-8: ascend_lint_serve_cmd P/D 模式返回逐端 prefill/decode envClassifications 与 effectiveRewrites", () => {
    const pdRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 61,
        method: "tools/call",
        params: {
          name: "ascend_lint_serve_cmd",
          arguments: {
            command:
              'HCCL_OP_EXPANSION_MODE=AIV vllm serve Qwen/Qwen3-8B --tensor-parallel-size 2 --kv-transfer-config \'{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_producer"}\'',
            decodeCommand:
              'ASCEND_RT_VISIBLE_DEVICES=0,1 vllm serve Qwen/Qwen3-8B --tensor-parallel-size 2 --kv-transfer-config \'{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer"}\'',
            hardwareFamily: "A2",
            decodeHardwareFamily: "A2",
            version: "v0.30.0",
          },
        },
      },
      wiki,
    );
    const pdJson = JSON.parse(
      (pdRes?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "{}",
    );
    expect(pdJson.keyMetrics.scope).toBe("pd");
    expect(Array.isArray(pdJson.crossInstanceFindings)).toBe(true);
    expect(Array.isArray(pdJson.prefill?.envClassifications)).toBe(true);
    expect(Array.isArray(pdJson.prefill?.effectiveRewrites)).toBe(true);
    expect(Array.isArray(pdJson.decode?.envClassifications)).toBe(true);
    expect(Array.isArray(pdJson.decode?.effectiveRewrites)).toBe(true);
    expect(
      pdJson.prefill.envClassifications.some((e: { name: string }) => e.name === "HCCL_OP_EXPANSION_MODE"),
    ).toBe(true);
    expect(
      pdJson.decode.envClassifications.some((e: { name: string }) => e.name === "ASCEND_RT_VISIBLE_DEVICES"),
    ).toBe(true);
    expect(pdJson.prefill.effectiveRewrites.length).toBeGreaterThan(0);
    expect(pdJson.decode.effectiveRewrites.length).toBeGreaterThan(0);
  });

  it("Round-2 P1-3: 非敏感冒号前缀（memory: / env: / max_tokens:）不会吞掉后续凭据赋值", async () => {
    const res = handleRpc(
      {
        jsonrpc: "2.0",
        id: 71,
        method: "tools/call",
        params: {
          name: "ascend_diagnose_log",
          arguments: {
            rawInput:
              "ERROR [Rank 0] RuntimeError: NPU out of memory: AWS_SECRET_ACCESS_KEY=测试标记_MEM env: PRIVATE_KEY=测试标记_ENV max_tokens: api_key: org:测试标记_COLON=1 TOKENIZER_API_KEY=测试标记_TOKKEY --bearer 测试标记_BEARER --tokenizer /models/Qwen",
          },
        },
      },
      wiki,
    );
    const outText = (res?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "";
    expect(outText).not.toContain("测试标记_MEM");
    expect(outText).not.toContain("测试标记_ENV");
    expect(outText).not.toContain("测试标记_COLON");
    expect(outText).not.toContain("测试标记_TOKKEY");
    expect(outText).not.toContain("测试标记_BEARER");
    expect(outText).toContain("--tokenizer /models/Qwen");

    const yamlSample = [
      '"api_key": >-',
      "  org;AUDITMARK_SVR_FOLDED=tail",
      "auth_token:",
      "  # comment",
      "  AUDITMARK_SVR_COMMENT",
      "secret_key: org;part AUDITMARK_SVR_SPACE",
      "refresh_token: first",
      "",
      "  - AUDITMARK_SVR_BLANK_DASH",
      "- private_key: |",
      "    \tAUDITMARK_SVR_SEQ_TAB1",
      "    AUDITMARK_SVR_SEQ_TAB2",
      "  max_model_len: 8192",
      "- secret_key: >-",
      "  # public note",
      "  tp_size: 4",
      "{client_secret: AUDITMARK_SVR_FLOW_A; project AUDITMARK_SVR_FLOW_B, dp_size: 2}",
      'curl -H "Authorization: ApiKey AUDITMARK_SVR_HDR" https://example.invalid/',
      'Authorization: Digest username*=UTF-8\'\'AUDITMARK_SVR_RFC5987, realm="r", nonce="n", response="0123456789abcdef0123456789abcdef"',
      "vllm serve Qwen/Qwen3-8B",
    ].join("\n");
    const maskedServerText = redactSensitiveText(yamlSample);
    expect(maskedServerText).toContain("  # public note");
    expect(maskedServerText).toContain("  max_model_len: 8192");
    expect(maskedServerText).toContain("  tp_size: 4");
    expect(maskedServerText).toContain("dp_size: 2");
    for (const m of [
      "AUDITMARK_SVR_FOLDED",
      "AUDITMARK_SVR_COMMENT",
      "AUDITMARK_SVR_SPACE",
      "AUDITMARK_SVR_BLANK_DASH",
      "AUDITMARK_SVR_SEQ_TAB1",
      "AUDITMARK_SVR_SEQ_TAB2",
      "AUDITMARK_SVR_FLOW_A",
      "AUDITMARK_SVR_FLOW_B",
      "AUDITMARK_SVR_HDR",
      "AUDITMARK_SVR_RFC5987",
      "0123456789abcdef0123456789abcdef",
    ]) {
      expect(maskedServerText).not.toContain(m);
    }

    const yamlLogRes = handleRpc(
      {
        jsonrpc: "2.0",
        id: 72,
        method: "tools/call",
        params: {
          name: "ascend_lint_serve_cmd",
          arguments: {
            command: yamlSample,
            hardwareFamily: "A2",
            version: "v0.30.0",
          },
        },
      },
      wiki,
    );
    const yamlLogText =
      (yamlLogRes?.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text ?? "";
    for (const m of [
      "AUDITMARK_SVR_FOLDED",
      "AUDITMARK_SVR_COMMENT",
      "AUDITMARK_SVR_SPACE",
      "AUDITMARK_SVR_BLANK_DASH",
      "AUDITMARK_SVR_SEQ_TAB1",
      "AUDITMARK_SVR_SEQ_TAB2",
      "AUDITMARK_SVR_FLOW_A",
      "AUDITMARK_SVR_FLOW_B",
      "AUDITMARK_SVR_HDR",
      "AUDITMARK_SVR_RFC5987",
      "0123456789abcdef0123456789abcdef",
    ]) {
      expect(yamlLogText).not.toContain(m);
    }
    expect(yamlLogText).toContain("max_num_batched_tokens=2048");

    // Round-6 closures: single-line shell flow mapping, valid YAML block scalar with nested command/YAML, and Digest header followed by TP_SIZE=4
    const singleFlowMasked = redactSensitiveText(
      "vllm serve Qwen/Qwen3-8B --config '{client_secret: QA_SVR_FIRST; project QA_SVR_LAST, tp_size: 4}'",
    );
    expect(singleFlowMasked).not.toContain("QA_SVR_FIRST");
    expect(singleFlowMasked).not.toContain("QA_SVR_LAST");
    expect(singleFlowMasked).toContain("tp_size: 4");

    const nestedK8sMasked = redactSensitiveText(
      [
        "data:",
        "  app.yaml: |",
        "    secret_key:",
        "      org:QA_SVR_NESTED=1",
        "    max_model_len: 8192",
        "  run.sh: |",
        "    vllm serve Qwen/Qwen3-8B --config '{client_secret: QA_SVR_CMD_A; project QA_SVR_CMD_B, dp_size: 2}'",
        'Authorization: Digest username="alice", response="0123456789abcdef0123456789abcdef"  \r',
        "TP_SIZE=4",
        "MAX_MODEL_LEN=8192",
      ].join("\n"),
    );
    for (const m of ["QA_SVR_NESTED", "QA_SVR_CMD_A", "QA_SVR_CMD_B", "0123456789abcdef0123456789abcdef"]) {
      expect(nestedK8sMasked).not.toContain(m);
    }
    expect(nestedK8sMasked).toContain("    max_model_len: 8192");
    expect(nestedK8sMasked).toContain("dp_size: 2");
    expect(nestedK8sMasked).toContain("TP_SIZE=4");
    expect(nestedK8sMasked).toContain("MAX_MODEL_LEN=8192");

    // Round-7 closures: server parity for apostrophe flow, collection alias, heredoc, 4-level block,
    // quoted YAML Authorization, valid YAML strings/comments/anchors, and standalone Bearer newline
    const { parse: parseYaml } = await import("yaml");
    expect(
      redactSensitiveText(
        'vllm serve M --config "{client_secret: team\'s QA_FIRST; project QA_LAST, tp_size: 4}"',
      ),
    ).not.toContain("QA_FIRST");
    expect(redactSensitiveText("common: &demo QA_DEMO\napi_keys: [*demo]\ntp_size: 4")).not.toContain(
      "QA_DEMO",
    );
    expect(
      redactSensitiveText(
        "command: |\n  cat <<EOF\n  defaults: &key QA_DEMO\n  client_secret: *key\n  EOF\ntp_size: 4",
      ),
    ).not.toContain("QA_DEMO");
    const deepMasked = redactSensitiveText(
      "a: |\n  b: |\n    c: |\n      d: |\n        client_secret: QA_FIRST; project QA_LAST\n        tp_size: 4",
    );
    expect(deepMasked).not.toContain("QA_FIRST");
    expect(deepMasked).not.toContain("QA_LAST");
    const authYamlMasked = redactSensitiveText(
      "headers:\n  Authorization: 'Basic QA_BASIC_TOKEN'\n  Proxy-Authorization: \"Digest username=QA_USER, response=QA_RESPONSE\"",
    );
    expect(authYamlMasked).not.toContain("QA_BASIC_TOKEN");
    expect(authYamlMasked).not.toContain("QA_USER");
    expect(authYamlMasked).not.toContain("QA_RESPONSE");
    expect(parseYaml(redactSensitiveText("client_secret: QA_DEMO\ntp_size: 4"))).toEqual({
      client_secret: "[REDACTED]",
      tp_size: 4,
    });
    expect(parseYaml(redactSensitiveText("client_secret: # optional value\ntp_size: 4"))).toEqual({
      client_secret: null,
      tp_size: 4,
    });
    expect(parseYaml(redactSensitiveText("client_secret: &key QA_DEMO\ncopy: *key\ntp_size: 4"))).toEqual({
      client_secret: "[REDACTED]",
      copy: "[REDACTED]",
      tp_size: 4,
    });
    const bareBearerMasked = redactSensitiveText("log: Bearer\nTP_SIZE=4\nMAX_MODEL_LEN=8192");
    expect(bareBearerMasked).toContain("TP_SIZE=4");
    expect(bareBearerMasked).toContain("MAX_MODEL_LEN=8192");
  });

  it("WS6 真实 193 页仓库契约：createCachedAgentWikiLoader 惰性复用并覆盖全部 7 个工具、新晋升参数与 qwen3-32b / qwen3-235b-a22b", () => {
    const realLoader = createCachedAgentWikiLoader(process.cwd());
    expect(realLoader()).toBe(realLoader());

    const callTool = (id: number, name: string, args: Record<string, unknown>) => {
      const res = handleRpc(
        { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
        realLoader,
      );
      const result = res?.result as { content?: { text: string }[]; isError?: boolean } | undefined;
      expect(result?.isError, `${name} (${id}): ${result?.content?.[0]?.text}`).toBe(false);
      return result?.content?.[0]?.text ?? "";
    };

    // 1. wiki_search: exact Top-1 on newly promoted params
    const searchHits = JSON.parse(callTool(801, "wiki_search", { query: "shared_engram", limit: 5 }));
    expect(searchHits[0]).toMatchObject({
      id: "shared-engram-31bf0d820403",
      how: "exact",
      file: "wiki/params/shared-engram-31bf0d820403.md",
    });

    // 2. wiki_get_page: promoted param pages load real markdown + frontmatter sources
    for (const promotedId of [
      "shared-engram-31bf0d820403",
      "runtime-config-hot-reload-9c9ab794933a",
      "quantized-all-reduce-config-3cc69e492011",
      "megamoe-shared-expert-fusion-5a99901d47e6",
    ]) {
      const md = callTool(802, "wiki_get_page", { id: promotedId });
      expect(md).toContain(`id: ${promotedId}`);
      expect(md).toContain("sources:");
    }

    // 3. wiki_neighbors: real bidirectional graph edges on promoted param
    const neighbors = JSON.parse(callTool(803, "wiki_neighbors", { id: "shared-engram-31bf0d820403" }));
    expect(Array.isArray(neighbors)).toBe(true);
    expect(neighbors.length).toBeGreaterThan(0);

    // 4. ascend_plan_deploy on qwen3-32b and qwen3-235b-a22b
    const plan32 = JSON.parse(
      callTool(804, "ascend_plan_deploy", {
        model: "qwen3-32b",
        cardId: "a2-64g",
        tpSize: 2,
        weightPrecision: "bf16",
      }),
    );
    expect(plan32.keyMetrics.modelId).toBe("qwen3-32b");
    expect(plan32.stages).toHaveLength(7);

    const plan235 = JSON.parse(
      callTool(805, "ascend_plan_deploy", {
        model: "qwen3-235b-a22b",
        cardId: "a3-die64g",
        tpSize: 8,
        weightPrecision: "w8a8_dynamic",
        enableEp: true,
      }),
    );
    expect(plan235.keyMetrics.modelId).toBe("qwen3-235b-a22b");
    expect(plan235.stages).toHaveLength(7);
    expect(plan235.blockers).toHaveLength(0);

    // 5. ascend_lint_serve_cmd on dotted --additional-config.runtime_config_hot_reload 1.0 & shared_engram
    const lintHotReload = JSON.parse(
      callTool(806, "ascend_lint_serve_cmd", {
        command:
          "VLLM_USE_V2_MODEL_RUNNER=1 vllm serve Qwen/Qwen3-32B -tp 2 --additional-config.runtime_config_hot_reload 1.0",
        hardwareFamily: "A2",
        version: "main",
      }),
    );
    expect(lintHotReload.keyMetrics.scope).toBe("single");
    expect(Array.isArray(lintHotReload.findings)).toBe(true);

    const lintEngram = JSON.parse(
      callTool(807, "ascend_lint_serve_cmd", {
        command:
          "vllm serve Qwen/Qwen3-235B-A22B -tp 8 --enable-expert-parallel --additional-config '{\"shared_engram\": true}'",
        hardwareFamily: "A3",
        version: "main",
      }),
    );
    expect(lintEngram.keyMetrics.scope).toBe("single");
    expect(Array.isArray(lintEngram.findings)).toBe(true);

    // 6. ascend_diagnose_log: multi-rank root cause vs EI0006 cascade
    const diag = JSON.parse(
      callTool(808, "ascend_diagnose_log", {
        rawInput: [
          "2026-11-25 10:01:02.100 ERROR [Rank 5] RuntimeError: NPU out of memory during capture_model()",
          "2026-11-25 10:02:30.400 ERROR [Rank 0] EI0006 Notify wait execute timeout",
        ].join("\n"),
      }),
    );
    expect(diag.firstFaultVerdict.rank).toBe(5);

    // 7. ascend_reconcile_startup_log on qwen3-32b and qwen3-235b-a22b
    const recon32 = JSON.parse(
      callTool(809, "ascend_reconcile_startup_log", {
        model: "qwen3-32b",
        cardId: "a2-64g",
        tpSize: 2,
        weightPrecision: "bf16",
        logText: [
          "INFO [Rank 0] Model loading took 30.52 GiB and 18.4 seconds",
          "INFO [Rank 0] Available KV cache memory: 22.10 GiB",
        ].join("\n"),
      }),
    );
    expect(recon32.items).toHaveLength(6);

    const recon235 = JSON.parse(
      callTool(810, "ascend_reconcile_startup_log", {
        model: "qwen3-235b-a22b",
        cardId: "a3-die64g",
        tpSize: 8,
        weightPrecision: "w8a8_dynamic",
        enableEp: true,
        logText: [
          "INFO [Rank 0] Model loading took 27.60 GiB and 24.2 seconds",
          "INFO [Rank 0] Available KV cache memory: 24.80 GiB",
        ].join("\n"),
      }),
    );
    expect(recon235.items).toHaveLength(6);
  });
});
