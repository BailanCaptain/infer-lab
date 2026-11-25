import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  doctorAnalysisInputSchema,
  redactSensitiveText,
  runDeployToolEvidenceWithPlan,
  runDeterministicToolEvidence,
  TOOL_EVIDENCE_LIMITS,
  troubleshootAnalysisInputSchema,
} from "../../server/tool-evidence";
import { buildIndex, retrieve } from "../../src/content/wiki/retrieve";
import { type RegistryEntry, registrySchema } from "../../src/content/wiki/schema";
import { runPdConfigDoctor, runSingleConfigDoctor } from "../../src/sim/doctor/configDoctor";
import {
  buildCurrentPlanCliHint,
  GIB,
  resolveDoctorModelTraits,
  WAVE4_DEMO_PRESETS,
} from "../../src/sim/modelspec/deployCalculator";
import { MODEL_PRESETS } from "../../src/sim/modelspec/presets";
import { parseAscendStartupLog, reconcileStartupLog } from "../../src/sim/modelspec/startupLogParser";
import { analyzeTroubleshootInput } from "../../src/sim/troubleshoot/logAnalyzer";

/**
 * 给站外的 agent（Claude Code、Codex、任何 MCP 客户端）用的只读入口。
 *
 * 站内问答有自己的 HTTP 接口，但那只绑本机、只服务网页。用户 2026-09-21 问「知识库做完以后
 * agent 怎么调用」，当时的回答是「基本没有」。这里补上三个只读动作，`pnpm wiki:find` 与
 * MCP server 都只是它的壳——检索仍然只有 `src/content/wiki/retrieve.ts` 那一个入口，
 * 命中规则与站内问答完全一致，不另起一套。
 */

export type AgentPage = RegistryEntry & { text: string };

export interface AgentWiki {
  search: (query: string, limit?: number) => AgentHit[];
  getPage: (id: string) => (AgentHit & { text: string }) | undefined;
  neighbors: (id: string) => AgentEdge[];
}

export interface AgentHit {
  id: string;
  title: string;
  summary: string;
  /** 相对仓库根的路径，agent 可以直接打开 */
  file: string;
  evidence: string;
  /** 这页已经对过哪几个版本；没列出的版本不代表不成立，只是没人对过 */
  verified: string[];
  how?: string;
  via?: string;
}

export interface AgentEdge {
  id: string;
  title: string;
  kind: string;
  note: string;
  /** out = 这页自己声明的边；in = 别的页指回来的边（由 wiki:build 派生） */
  direction: "out" | "in";
}

export function makeAgentWiki(pages: AgentPage[]): AgentWiki {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const index = buildIndex(pages);
  const hitOf = (p: AgentPage): AgentHit => ({
    id: p.id,
    title: p.title,
    summary: p.summary,
    file: `wiki/${p.file}`,
    evidence: p.evidence,
    verified: p.verified,
  });
  const titleOf = (id: string) => byId.get(id)?.title ?? id;
  return {
    search: (query, limit = 5) =>
      retrieve(query, index, { limit, expand: true }).flatMap((h) => {
        const page = byId.get(h.id);
        return page ? [{ ...hitOf(page), how: h.how, ...(h.via ? { via: h.via } : {}) }] : [];
      }),
    getPage: (id) => {
      const page = byId.get(id);
      return page ? { ...hitOf(page), text: page.text } : undefined;
    },
    neighbors: (id) => {
      const page = byId.get(id);
      if (!page) return [];
      return [
        ...page.relations.map((r) => ({
          id: r.to,
          title: titleOf(r.to),
          kind: r.kind,
          note: r.note,
          direction: "out" as const,
        })),
        ...page.backlinks.map((b) => ({
          id: b.from,
          title: titleOf(b.from),
          kind: b.kind,
          note: b.note,
          direction: "in" as const,
        })),
      ];
    },
  };
}

export type AgentWikiSource = AgentWiki | (() => AgentWiki);

/** 从磁盘上的派生物建：registry.json 给元数据，页面文件给正文 */
export function loadAgentWiki(root: string): AgentWiki {
  const registry = registrySchema.parse(
    JSON.parse(readFileSync(join(root, "src/content/wiki/registry.json"), "utf8")),
  );
  return makeAgentWiki(
    registry.pages.map((page) => ({ ...page, text: readFileSync(join(root, "wiki", page.file), "utf8") })),
  );
}

/** 按 registry.json 与各页面正文 mtime+size 惰性加载缓存：纯 initialize / tools/list / sim 工具调用零全库文件 I/O */
export function createCachedAgentWikiLoader(root: string): () => AgentWiki {
  let cached: { stamp: string; files: string[]; wiki: AgentWiki } | undefined;
  const regPath = join(root, "src/content/wiki/registry.json");
  const computeStamp = (files: readonly string[]): string => {
    const regStat = statSync(regPath);
    const parts = [`reg:${regStat.mtimeMs}:${regStat.size}`];
    for (const rel of files) {
      const st = statSync(join(root, "wiki", rel));
      parts.push(`${rel}:${st.mtimeMs}:${st.size}`);
    }
    return parts.join("|");
  };
  return () => {
    if (cached) {
      const regStat = statSync(regPath);
      if (cached.stamp.startsWith(`reg:${regStat.mtimeMs}:${regStat.size}|`)) {
        const nextStamp = computeStamp(cached.files);
        if (nextStamp === cached.stamp) return cached.wiki;
      }
    }
    const registry = registrySchema.parse(JSON.parse(readFileSync(regPath, "utf8")));
    const files = registry.pages.map((p) => p.file);
    const wiki = makeAgentWiki(
      registry.pages.map((page) => ({ ...page, text: readFileSync(join(root, "wiki", page.file), "utf8") })),
    );
    cached = { stamp: computeStamp(files), files, wiki };
    return wiki;
  };
}

const ALLOWED_PRESET_IDS = new Set<string>([
  ...MODEL_PRESETS.map((p) => p.id),
  ...WAVE4_DEMO_PRESETS.map((p) => p.id),
]);
const ADVERTISED_PRESET_LIST = [...ALLOWED_PRESET_IDS].join("、");

function resolveDeployPlan(rawArgs: Record<string, unknown>) {
  return runDeployToolEvidenceWithPlan(rawArgs);
}

const DEPLOY_INPUT_SCHEMA_PROPERTIES = {
  model: {
    oneOf: [
      { type: "string", enum: [...ALLOWED_PRESET_IDS] },
      { type: "object", additionalProperties: true },
    ],
    description: `内置模型预设 ID（${ADVERTISED_PRESET_LIST}），或 HuggingFace config.json 对象`,
  },
  cardId: {
    type: "string",
    enum: ["a2-64g", "a2-32g", "a3-die64g", "310p-24g", "950dt-128g"],
    description: "昇腾卡型 ID",
  },
  version: { type: "string", enum: ["v0.30.0", "main", "rfork"] },
  weightPrecision: {
    type: "string",
    enum: ["bf16", "fp16", "w8a8", "w8a8_dynamic", "w4a8", "fp8_block", "w8a8sc_310p"],
  },
  kvCacheDtype: { type: "string", enum: ["auto", "int8", "mxfp8"] },
  blockSize: { type: "integer", minimum: 1, maximum: 4096 },
  userSpecifiedBlockSize: { type: "boolean" },
  weightNzMode: { type: "integer", enum: [0, 1, 2] },
  tpSize: { type: "integer", minimum: 1, maximum: 256 },
  ppSize: { type: "integer", minimum: 1, maximum: 256 },
  dpSize: { type: "integer", minimum: 1, maximum: 256 },
  pcpSize: { type: "integer", minimum: 1, maximum: 256 },
  dcpSize: { type: "integer", minimum: 1, maximum: 256 },
  enableEp: { type: "boolean" },
  enableEplb: { type: "boolean" },
  dynamicEplb: { type: "boolean" },
  engramCpuOffload: { type: "boolean" },
  numSpecTokens: { type: "integer", minimum: 0, maximum: 16 },
  gpuMemoryUtilization: { type: "number", minimum: 0.1, maximum: 0.99 },
  maxModelLen: { type: "integer", minimum: 64, maximum: 1_048_576 },
  maxNumBatchedTokens: { type: "integer", minimum: 1, maximum: 1_048_576 },
  maxNumSeqs: { type: "integer", minimum: 1, maximum: 65_536 },
  cudagraphMode: {
    type: "string",
    enum: ["NONE", "PIECEWISE", "FULL_DECODE_ONLY", "FULL", "FULL_AND_PIECEWISE"],
  },
  cudagraphCaptureCount: { type: "integer", minimum: 0, maximum: 512 },
  enforceEager: { type: "boolean" },
  decodeBatchSize: { type: "integer", minimum: 1, maximum: 65_536 },
  prefillTokens: { type: "integer", minimum: 1, maximum: 1_048_576 },
  decodeContextLen: { type: "integer", minimum: 1, maximum: 1_048_576 },
} as const;

// ---- MCP：stdio 上的 JSON-RPC 2.0，一行一条消息。只实现只读工具要用到的那几个方法。 ----

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface RpcReply {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

const TOOLS = [
  {
    name: "wiki_search",
    description:
      "在 vLLM / vLLM-Ascend 知识库里找页面。按页面 id、标题、别名精确或宽松命中，再按关键词与页面关系扩展。返回命中页的 id、标题、一句话摘要、文件路径、证据等级和已核对的版本。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "要查的名词、参数名或问题" },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "最多返回几页，默认 5" },
      },
      required: ["query"],
    },
  },
  {
    name: "wiki_get_page",
    description:
      "按 id 取一页的完整 markdown（含 frontmatter 里的来源列表，来源形如 repo@commit:path#L起-L止）。",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "wiki_neighbors",
    description:
      "这一页和哪些页有关：它建立在谁之上、谁建立在它之上、和谁互斥或互为替代。每条边带一句理由。回答问题时用它把相关页串起来。",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "ascend_plan_deploy",
    description: `确定性昇腾部署显存与并行算账工具（零幻觉）。输入模型预设 ID（可选：${ADVERTISED_PRESET_LIST}）或 HuggingFace config.json 对象与昇腾卡型（a2-64g、a2-32g、a3-die64g、310p-24g、950dt-128g），核算最少卡数、7 级显存拆解、KV Cache 容量、HCCL 缓冲、Roofline 瓶颈与推荐 CLI 命令。`,
    inputSchema: {
      type: "object",
      properties: DEPLOY_INPUT_SCHEMA_PROPERTIES,
      required: ["model", "cardId"],
    },
  },
  {
    name: "ascend_lint_serve_cmd",
    description:
      "确定性 vllm-ascend 启动命令体检器。支持单实例 command 或 P/D 分离（command + decodeCommand），检测硬报错（error）、静默改写（silent-rewrite）、告警（warn）、环境变量状态与实际生效参数表，并给出上游源码锚点；P/D 模式并输出 prefill / decode 逐端 envClassifications 与 effectiveRewrites。",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          minLength: 1,
          maxLength: TOOL_EVIDENCE_LIMITS.maxCommandChars,
          description: "单机或 Prefill 实例的 vllm serve 命令（可含环境变量前缀）",
        },
        decodeCommand: {
          type: "string",
          minLength: 1,
          maxLength: TOOL_EVIDENCE_LIMITS.maxCommandChars,
          description: "可选：P/D 分离下 Decode 实例的 vllm serve 命令",
        },
        mode: { type: "string", enum: ["minimal", "full"] },
        hardwareFamily: { type: "string", enum: ["A2", "A3", "310P", "A5"] },
        decodeHardwareFamily: { type: "string", enum: ["A2", "A3", "310P", "A5"] },
        version: { type: "string", enum: ["v0.30.0", "main", "rfork"] },
        crossNodeRoce: { type: "boolean", description: "可选：是否跨节点 RoCE 互联" },
        modelId: {
          type: "string",
          minLength: 1,
          maxLength: 120,
          description: "可选：模型预设 ID（如 qwen3-8b、qwen3-30b-a3b）",
        },
        modelTraitOverride: {
          type: "object",
          additionalProperties: false,
          description: "可选：覆盖模型结构特征（如自定义模型 MoE / MLA / 头数）",
          properties: {
            isMoe: { type: "boolean" },
            useMla: { type: "boolean" },
            sfaDcpReplicatedIndexer: { type: "boolean" },
            numExperts: { type: "integer", minimum: 1, maximum: 16_384 },
            numExpertsPerTok: { type: "integer", minimum: 1, maximum: 1_024 },
            numAttentionHeads: { type: "integer", minimum: 1, maximum: 4_096 },
            numKvHeads: { type: "integer", minimum: 1, maximum: 4_096 },
            headDim: { type: "integer", minimum: 1, maximum: 4_096 },
          },
        },
      },
      required: ["command"],
    },
  },
  {
    name: "ascend_diagnose_log",
    description:
      "确定性昇腾 / CANN / HCCL / vLLM 报错日志与 /metrics 诊断器。自动定位多卡交错日志中的首错 Rank（First-Fault Rank）、时间戳依据、故障分类与现场取证命令。",
    inputSchema: {
      type: "object",
      properties: {
        rawInput: {
          type: "string",
          minLength: 1,
          maxLength: TOOL_EVIDENCE_LIMITS.maxTroubleshootChars,
          description: "粘贴的报错日志文本或 Prometheus /metrics 输出",
        },
      },
      required: ["rawInput"],
    },
  },
  {
    name: "ascend_reconcile_startup_log",
    description:
      "将理论部署参数与实机 vllm-ascend 启动日志逐项对账（权重显存、非 KV 开销、可用 KV 显存、KV token 数、ACLGraph 录图显存与 1-u 余量），支持指定 targetRank。",
    inputSchema: {
      type: "object",
      properties: {
        ...DEPLOY_INPUT_SCHEMA_PROPERTIES,
        logText: {
          type: "string",
          minLength: 1,
          maxLength: TOOL_EVIDENCE_LIMITS.maxTroubleshootChars,
          description: "实机启动日志文本",
        },
        targetRank: {
          type: "string",
          minLength: 1,
          maxLength: 80,
          description: "可选：指定对账的 Worker Rank 标签",
        },
      },
      required: ["model", "cardId", "logText"],
    },
  },
];

function runSimTool(name: string, args: Record<string, unknown>): unknown {
  if (name === "ascend_plan_deploy") {
    const { evidence, plan } = resolveDeployPlan(args);
    return {
      summary: evidence.summary,
      keyMetrics: evidence.keyMetrics,
      cliHint: buildCurrentPlanCliHint(plan),
      stages: plan.stages.map((s) => ({
        id: s.id,
        title: s.title,
        pointGiB: Number((s.pointEstimateBytes / GIB).toFixed(2)),
        lowGiB: Number((s.lowBytes / GIB).toFixed(2)),
        highGiB: Number((s.highBytes / GIB).toFixed(2)),
      })),
      hcclTotalMaterializedMiB: Number(plan.hcclEstimate.totalMaterializedMiB.toFixed(1)),
      blockers: plan.fourQuestions.q1Fit.blockers.map((b) => ({
        id: b.id,
        title: b.title,
        detail: b.message,
        ...(b.remediation ? { remediation: b.remediation } : {}),
        sources: b.sources,
      })),
      silentRewrites: plan.fourQuestions.q1Fit.silentRewrites.map((r) => ({
        id: r.id,
        title: r.title,
        param: r.param,
        fromValue: r.fromValue,
        toValue: r.toValue,
        detail: r.message,
        sources: r.sources,
      })),
    };
  }
  if (name === "ascend_lint_serve_cmd") {
    const checked = doctorAnalysisInputSchema.parse({ kind: "doctor", ...args });
    const evidence = runDeterministicToolEvidence(checked);
    const command = String(evidence.sanitizedInput.command ?? "");
    const decodeCommand =
      typeof evidence.sanitizedInput.decodeCommand === "string"
        ? evidence.sanitizedInput.decodeCommand
        : undefined;
    const safeModelId =
      typeof evidence.sanitizedInput.modelId === "string" ? evidence.sanitizedInput.modelId : undefined;
    const resolvedTraits = resolveDoctorModelTraits(safeModelId, checked.modelTraitOverride);
    const opts = {
      hardwareFamily: checked.hardwareFamily ?? ("A2" as const),
      version: checked.version ?? ("v0.30.0" as const),
      ...(checked.crossNodeRoce !== undefined ? { crossNodeRoce: checked.crossNodeRoce } : {}),
      ...(resolvedTraits ? { modelTraitOverride: resolvedTraits } : {}),
    };
    if (decodeCommand) {
      const report = runPdConfigDoctor(command, decodeCommand, {
        ...opts,
        ...(checked.decodeHardwareFamily ? { decodeHardwareFamily: checked.decodeHardwareFamily } : {}),
      });
      return {
        summary: evidence.summary,
        keyMetrics: evidence.keyMetrics,
        findings: report.allFindings,
        crossInstanceFindings: report.crossInstanceFindings,
        prefill: {
          envClassifications: report.prefill.envClassifications,
          effectiveRewrites: report.prefill.effectiveRewrites,
        },
        decode: {
          envClassifications: report.decode.envClassifications,
          effectiveRewrites: report.decode.effectiveRewrites,
        },
      };
    }
    const report = runSingleConfigDoctor(command, { ...opts, mode: checked.mode ?? "full" });
    return {
      summary: evidence.summary,
      keyMetrics: evidence.keyMetrics,
      findings: report.findings,
      effectiveRewrites: report.effectiveRewrites,
      envVars: report.envClassifications,
      unknownFlags: report.parsed.unknownFlags,
    };
  }
  if (name === "ascend_diagnose_log") {
    const redactedArgs =
      typeof args.rawInput === "string" ? { ...args, rawInput: redactSensitiveText(args.rawInput) } : args;
    const checked = troubleshootAnalysisInputSchema.parse({ kind: "troubleshoot", ...redactedArgs });
    const evidence = runDeterministicToolEvidence(checked);
    const sanitizedRawInput = redactSensitiveText(String(evidence.sanitizedInput.rawInput ?? ""));
    const report = analyzeTroubleshootInput(sanitizedRawInput);
    const safeKeyMetrics = Object.fromEntries(
      Object.entries(evidence.keyMetrics).map(([k, v]) => [
        k,
        typeof v === "string" ? redactSensitiveText(v) : v,
      ]),
    );
    return {
      summary: redactSensitiveText(evidence.summary),
      keyMetrics: safeKeyMetrics,
      firstFaultVerdict: {
        ...report.firstFaultVerdict,
        rationale: redactSensitiveText(report.firstFaultVerdict.rationale),
        primaryEvidenceLines: report.firstFaultVerdict.primaryEvidenceLines.map((line) => ({
          ...line,
          rawLine: redactSensitiveText(line.rawLine),
        })),
      },
      findings: report.findings.map((finding) => ({
        ...finding,
        title: redactSensitiveText(finding.title),
        summary: redactSensitiveText(finding.summary),
        mechanism: redactSensitiveText(finding.mechanism),
        experimentStep: redactSensitiveText(finding.experimentStep),
        matchedLines: finding.matchedLines.map((line) => ({
          ...line,
          rawLine: redactSensitiveText(line.rawLine),
        })),
      })),
      metrics: report.metrics,
    };
  }
  const reconcileSchema = z.object({
    logText: z.string().trim().min(1).max(TOOL_EVIDENCE_LIMITS.maxTroubleshootChars),
    targetRank: z.string().trim().min(1).max(80).optional(),
  });
  const { logText, targetRank } = reconcileSchema.parse(args);
  const { logText: _lt, targetRank: _tr, ...deployArgs } = args;
  const { plan } = resolveDeployPlan(deployArgs);
  const safeLogInput = redactSensitiveText(logText);
  const safeTargetRank = targetRank ? redactSensitiveText(targetRank) : undefined;
  const logEvidence = runDeterministicToolEvidence({ kind: "troubleshoot", rawInput: safeLogInput });
  const sanitizedLogText = redactSensitiveText(String(logEvidence.sanitizedInput.rawInput ?? ""));
  const parsedLog = parseAscendStartupLog(
    sanitizedLogText,
    safeTargetRank ? { targetRank: safeTargetRank } : {},
  );
  if (safeTargetRank) {
    const matched =
      parsedLog.selectedRankLabel !== null &&
      parsedLog.selectedRankLabel.toLowerCase() === safeTargetRank.toLowerCase();
    if (!matched) {
      const detected =
        parsedLog.detectedRanks.length > 0 ? parsedLog.detectedRanks.join("、") : "无明确 Rank 标签";
      throw new Error(
        redactSensitiveText(
          `启动日志中未找到请求的 targetRank="${safeTargetRank}"（已识别 Rank：${detected}）`,
        ),
      );
    }
  }
  const reconciliation = reconcileStartupLog(plan, parsedLog);
  return {
    overallStatus: reconciliation.overallStatus,
    summary: redactSensitiveText(reconciliation.summary),
    selectedRankLabel: reconciliation.selectedRankLabel
      ? redactSensitiveText(reconciliation.selectedRankLabel)
      : null,
    detectedRanks: parsedLog.detectedRanks.map(redactSensitiveText),
    items: reconciliation.items.map((item) => ({
      ...item,
      summary: redactSensitiveText(item.summary),
      likelyRootCauses: item.likelyRootCauses.map(redactSensitiveText),
    })),
    logErrors: reconciliation.logErrors.map(redactSensitiveText),
    hcclAccountingNote: redactSensitiveText(reconciliation.hcclAccountingNote),
  };
}

export function handleRpc(msg: RpcMessage, wikiSource: AgentWikiSource): RpcReply | undefined {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    const rawId =
      msg && typeof msg === "object" && "id" in msg ? ((msg as { id?: number | string }).id ?? null) : null;
    return { jsonrpc: "2.0", id: rawId as number | string, error: { code: -32600, message: "非法请求" } };
  }
  if (msg.id === undefined) return undefined; // 通知不回包
  const getWiki = typeof wikiSource === "function" ? wikiSource : () => wikiSource;
  const reply = (result: unknown): RpcReply => ({ jsonrpc: "2.0", id: msg.id as number | string, result });
  const text = (value: unknown, isError = false) =>
    reply({
      content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
      isError,
    });

  if (msg.method === "initialize")
    return reply({
      protocolVersion: (msg.params?.protocolVersion as string | undefined) ?? "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "llm-wiki", version: "2" },
      instructions:
        "只读的 vLLM / vLLM-Ascend 双擎知识与确定性仿真服务。涉及显存算账、启动命令体检、报错首错 Rank 定位或启动日志对账时，先调 ascend_* 确定性工具拿精确数值与规则判定，再用 wiki_search / wiki_get_page / wiki_neighbors 核对源码行号与版本边界。",
    });
  if (msg.method === "ping") return reply({});
  if (msg.method === "tools/list") return reply({ tools: TOOLS });
  if (msg.method === "tools/call") {
    const name = String(msg.params?.name ?? "");
    const rawArgs = msg.params?.arguments ?? {};
    if (typeof rawArgs !== "object" || rawArgs === null || Array.isArray(rawArgs)) {
      return text("arguments 必须是 JSON 对象", true);
    }
    const args = rawArgs as Record<string, unknown>;
    try {
      if (name === "wiki_search") {
        if (typeof args.query !== "string" || !args.query.trim()) return text("缺少非空 query 参数", true);
        const limit = args.limit === undefined ? 5 : z.number().int().min(1).max(50).parse(args.limit);
        return text(getWiki().search(args.query, limit));
      }
      if (name === "wiki_neighbors") {
        if (typeof args.id !== "string" || !args.id.trim()) return text("缺少非空 id 参数", true);
        return text(getWiki().neighbors(args.id));
      }
      if (name === "wiki_get_page") {
        if (typeof args.id !== "string" || !args.id.trim()) return text("缺少非空 id 参数", true);
        const page = getWiki().getPage(args.id);
        return page
          ? text(page.text)
          : text(`没有 id 为 ${redactSensitiveText(args.id)} 的页；先用 wiki_search 找`, true);
      }
      if (
        name === "ascend_plan_deploy" ||
        name === "ascend_lint_serve_cmd" ||
        name === "ascend_diagnose_log" ||
        name === "ascend_reconcile_startup_log"
      ) {
        return text(runSimTool(name, args));
      }
      return text(`没有这个工具：${redactSensitiveText(name)}`, true);
    } catch (error) {
      const msgText =
        error instanceof z.ZodError
          ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
          : error instanceof Error
            ? error.message
            : String(error);
      return text(`参数或核算校验未通过：${redactSensitiveText(msgText)}`, true);
    }
  }
  return {
    jsonrpc: "2.0",
    id: msg.id,
    error: { code: -32601, message: `不支持的方法：${redactSensitiveText(msg.method)}` },
  };
}
