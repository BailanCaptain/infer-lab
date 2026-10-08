import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { DEFAULT_CODEX_MODEL } from "../../src/content/wiki/chat-models";
import { MODEL_ID, WORK_MODEL } from "./model-use";
import { workflowPolicySchema } from "./workflow-policy";

export const syncConfigSchema = z
  .object({
    seeds: z.string().default("wiki/seeds/vllm-ascend.yaml"),
    fetch: z.boolean().default(false),
    parameters: z.boolean().default(true),
    python: z.string().min(1).optional(),
    maxNewParamPages: z.number().int().min(0).max(10).default(10),
    github: z.boolean().default(false),
    githubRepo: z.string().default("vllm-project/vllm-ascend"),
    patrolAgeDays: z.number().int().nonnegative().default(30),
    /** 巡检时把站外链接真的请求一遍（不调模型）；404 / 410 进巡检问题清单 */
    checkUrls: z.boolean().default(false),
    paid: workflowPolicySchema.optional(),
    maxTasks: z.number().int().min(0).max(10).default(0),
    reconcileBatches: z.number().int().min(0).max(10).default(0),
    driftSample: z.number().int().min(0).max(10).default(0),
    /** 全 Wiki 共用的模型；保留 chatModel 字段以兼容原配置 */
    chatModel: z.string().regex(MODEL_ID).optional(),
    chatProvider: z.enum(["claude", "codex"]).default("claude"),
  })
  .strict();

/** Shared defaults plus local overrides for model selection and machine-specific settings. */
export function readSyncConfig(path: string): z.output<typeof syncConfigSchema> {
  const read = (file: string) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});
  return syncConfigSchema.parse({ ...read(path), ...read(path.replace(/\.json$/, ".local.json")) });
}

export function selectedModel(root: string) {
  const config = readSyncConfig(join(root, "wiki/sync.config.json"));
  return {
    provider: config.chatProvider,
    model: config.chatModel ?? (config.chatProvider === "codex" ? DEFAULT_CODEX_MODEL : WORK_MODEL),
  };
}
