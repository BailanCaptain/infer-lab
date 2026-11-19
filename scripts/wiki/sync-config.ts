import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  CHAT_PROVIDERS,
  type ChatProvider,
  defaultModelForProvider,
} from "../../src/content/wiki/chat-models";
import { MODEL_ID, WORK_MODEL } from "./model-use";
import { workflowPolicySchema } from "./workflow-policy";

export const ENV_VAR_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;
export const CLAUDE_SETTING_SOURCES_RE = /^[a-zA-Z0-9,_-]*$/;
export const ANTHROPIC_VERSION_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export const harnessCommandSchema = z
  .object({
    command: z.string().trim().min(1),
    args: z.array(z.string()).default([]),
  })
  .strict();
export type HarnessCommand = z.infer<typeof harnessCommandSchema>;

export const syncConfigSchema = z
  .object({
    mode: z.enum(["test", "production"]).default("test"),
    seeds: z.string().default("wiki/seeds/vllm-ascend.yaml"),
    fetch: z.boolean().default(false),
    parameters: z.boolean().default(true),
    python: z.string().min(1).optional(),
    /** 本机 Codex 客户端路径，避免计划任务和桌面会话从 PATH 选到不同版本。 */
    codexCli: z.string().min(1).optional(),
    /** 允许 Codex 读取本机用户配置（~/.codex），以支持自定义 Codex harness / 第三方提供商。 */
    codexAllowUserConfig: z.boolean().optional(),
    /** 本机 Claude Code / CCR 客户端路径（支持 Windows npm .cmd 包装器自动解包到 node + cli.js）。 */
    claudeCli: z.string().min(1).optional(),
    /** 透传给 Claude Code 的 --setting-sources（默认 ""，如 "user,local" 以启用 CCR / DeepSeek Anthropic 配置）。 */
    claudeSettingSources: z.string().regex(CLAUDE_SETTING_SOURCES_RE).optional(),
    /** 透传给 Claude Code 子进程的额外环境变量（放 sync.config.local.json，绝不暴露到 /api/wiki/status）。 */
    claudeEnv: z.record(z.string().regex(ENV_VAR_NAME_RE), z.string()).optional(),
    /** OpenAI 兼容或 Anthropic 兼容 HTTP API 根地址（如 https://api.deepseek.com/v1 或 http://127.0.0.1:3456）。 */
    apiBaseUrl: z
      .string()
      .url()
      .refine((u) => /^https?:\/\//i.test(u), "apiBaseUrl 仅支持 http/https 地址")
      .optional(),
    /** 存放 API 密钥的环境变量名（如 DEEPSEEK_API_KEY / OPENAI_API_KEY / ANTHROPIC_AUTH_TOKEN；绝不存明文密钥）。 */
    apiKeyEnv: z.string().regex(ENV_VAR_NAME_RE, "apiKeyEnv 必须是合法环境变量名").optional(),
    /** Anthropic 兼容接口版本头（默认 2023-06-01）。 */
    anthropicVersion: z.string().regex(ANTHROPIC_VERSION_RE).optional(),
    /** 自定义命令行 Harness（shell: false，stdin 传入 prompt，stdout 输出回复）。 */
    harnessCommand: harnessCommandSchema.optional(),
    maxNewParamPages: z.number().int().min(0).max(100).nullable().optional(),
    github: z.boolean().default(false),
    githubRepo: z.string().default("vllm-project/vllm-ascend"),
    patrolAgeDays: z.number().int().nonnegative().default(30),
    /** 巡检时把站外链接真的请求一遍（不调模型）；404 / 410 进巡检问题清单 */
    checkUrls: z.boolean().default(false),
    paid: workflowPolicySchema.optional(),
    maxTasks: z.number().int().min(0).max(100).nullable().optional(),
    reconcileBatches: z.number().int().min(0).max(100).nullable().optional(),
    driftSample: z.number().int().min(0).max(100).nullable().optional(),
    /** 全 Wiki 共用的模型；保留 chatModel 字段以兼容原配置 */
    chatModel: z.string().regex(MODEL_ID).optional(),
    chatProvider: z.enum(CHAT_PROVIDERS).default("claude"),
    /** 部署时填接入模型的实际可用窗口；不是知识库或单份材料的容量上限。 */
    contextWindowTokens: z.number().int().min(32768).max(4_000_000).default(128_000),
    outputReserveTokens: z.number().int().min(4096).max(128_000).default(16_384),
  })
  .strict()
  .transform((config) =>
    config.mode === "production"
      ? {
          ...config,
          maxNewParamPages: config.maxNewParamPages === undefined ? null : config.maxNewParamPages,
          maxTasks: config.maxTasks === undefined ? null : config.maxTasks,
          reconcileBatches: config.reconcileBatches === undefined ? null : config.reconcileBatches,
          driftSample: config.driftSample === undefined ? null : config.driftSample,
          paid: { accountingOnly: true as const },
        }
      : {
          ...config,
          maxNewParamPages: config.maxNewParamPages === undefined ? 10 : config.maxNewParamPages,
          maxTasks: config.maxTasks === undefined ? 0 : config.maxTasks,
          reconcileBatches: config.reconcileBatches === undefined ? 0 : config.reconcileBatches,
          driftSample: config.driftSample === undefined ? 0 : config.driftSample,
        },
  );

/** Shared defaults plus local overrides for model selection and machine-specific settings. */
export function readSyncConfig(path: string): z.output<typeof syncConfigSchema> {
  const read = (file: string) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});
  return syncConfigSchema.parse({ ...read(path), ...read(path.replace(/\.json$/, ".local.json")) });
}

export const isProduction = (root: string) =>
  readSyncConfig(join(root, "wiki/sync.config.json")).mode === "production";

export const configuredWorkflowPolicy = (root: string, limits: unknown) =>
  workflowPolicySchema.parse(isProduction(root) ? { accountingOnly: true } : limits);

export interface ModelSelectionConfig {
  provider: ChatProvider;
  model: string;
  codexCli?: string;
  codexAllowUserConfig?: boolean;
  claudeCli?: string;
  claudeSettingSources?: string;
  apiBaseUrl?: string;
  apiKeyEnv?: string;
  anthropicVersion?: string;
  harnessCommand?: HarnessCommand;
}

/** Non-secret selection metadata persisted in jobs/drops. Never includes API key values or claudeEnv secrets. */
export function selectedModel(root: string): ModelSelectionConfig {
  const config = readSyncConfig(join(root, "wiki/sync.config.json"));
  return {
    provider: config.chatProvider,
    model: config.chatModel ?? defaultModelForProvider(config.chatProvider, WORK_MODEL),
    ...(config.codexCli ? { codexCli: config.codexCli } : {}),
    ...(config.codexAllowUserConfig ? { codexAllowUserConfig: config.codexAllowUserConfig } : {}),
    ...(config.claudeCli ? { claudeCli: config.claudeCli } : {}),
    ...(config.claudeSettingSources !== undefined
      ? { claudeSettingSources: config.claudeSettingSources }
      : {}),
    ...(config.apiBaseUrl ? { apiBaseUrl: config.apiBaseUrl } : {}),
    ...(config.apiKeyEnv ? { apiKeyEnv: config.apiKeyEnv } : {}),
    ...(config.anthropicVersion ? { anthropicVersion: config.anthropicVersion } : {}),
    ...(config.harnessCommand ? { harnessCommand: config.harnessCommand } : {}),
  };
}

/** Read runtime-only claudeEnv overrides without serializing them into batches, reviews, or status endpoints. */
export function readClaudeEnv(root: string): Record<string, string> | undefined {
  const config = readSyncConfig(join(root, "wiki/sync.config.json"));
  return config.claudeEnv;
}
