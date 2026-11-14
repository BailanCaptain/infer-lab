/**
 * 一次 claude 调用实际由哪个模型作答。
 *
 * CLI 会自己换模型接着答：主模型拒答（model_refusal_fallback）、不可用或过载（model_fallback）、
 * 额度同意框没过（model_consent_fallback）。2026-09-23 的问答全部是 Opus 5.5 以 frontier_llm 拒答、
 * Opus 5 接手，界面和记录里都看不出来。stdout 的 stream-json 上这些是 system 事件（字段 snake_case，
 * 形状见 CLI 的 SDK 输出定义）；每条 assistant 消息还带着自己的 message.model。
 */
import { z } from "zod";

/** --model 的单个参数：别名、完整 id 或 CCR provider,model；拒绝空白、参数开头和 shell 语法。 */
export const MODEL_ID =
  /^(?:[a-zA-Z0-9][a-zA-Z0-9._-]*,)?[a-zA-Z0-9][a-zA-Z0-9._:/-]*(\[[a-z0-9]+\])?$(?![\s\S])/;

/** Legacy Claude default and stable recipe marker. Runtime calls use selectedModel(root). */
export const WORK_MODEL = "claude-opus-5-5[1m]";

export const modelUseSchema = z
  .object({
    /** 启动时 CLI 选定的模型（system/init） */
    requested: z.string().optional(),
    /** assistant 消息上的模型，按首次出现的顺序；用量表里的辅助小模型不算 */
    answered: z.array(z.string()),
    switches: z.array(
      z
        .object({
          event: z.string(),
          from: z.string(),
          to: z.string(),
          /** 拒答类别、不可用原因或同意框结果，CLI 给了才有 */
          reason: z.string().optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type ModelUse = z.infer<typeof modelUseSchema>;

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export function trackModels() {
  let requested: string | undefined;
  const answered: string[] = [];
  const switches: ModelUse["switches"] = [];
  return {
    observe(line: string): void {
      let e: Record<string, unknown>;
      try {
        e = JSON.parse(line);
      } catch {
        return;
      }
      if (!e || typeof e !== "object") return;
      if (e.type === "system" && e.subtype === "init") requested = str(e.model) ?? requested;
      else if (e.type === "system" && typeof e.subtype === "string" && e.subtype.endsWith("fallback")) {
        const from = str(e.original_model);
        const to = str(e.fallback_model);
        const reason = str(e.api_refusal_category) ?? str(e.trigger) ?? str(e.choice);
        if (from && to) switches.push({ event: e.subtype, from, to, ...(reason ? { reason } : {}) });
      } else if (e.type === "assistant") {
        const model = str((e.message as { model?: unknown } | undefined)?.model);
        if (model && !answered.includes(model)) answered.push(model);
      }
    },
    result(): ModelUse | undefined {
      if (!requested && !answered.length && !switches.length) return undefined;
      return { ...(requested ? { requested } : {}), answered: [...answered], switches: [...switches] };
    },
  };
}

/** 最后作答的模型；一条 assistant 消息都没有时退回启动时选定的 */
export const answeredBy = (use: ModelUse | undefined) => use?.answered.at(-1) ?? use?.requested;

const base = (model: string) => model.replace(/\[[^\]]*\]$/, "");

/** 换过模型：CLI 报了换手，或者作答模型和启动时选定的不是同一个（[1m] 后缀不算不同） */
export const modelSwitched = (use: ModelUse | undefined) =>
  !!use &&
  (use.switches.length > 0 ||
    (!!use.requested && use.answered.some((model) => base(model) !== base(use.requested!))));
