import { describe, expect, it } from "vitest";
import { answeredBy, MODEL_ID, modelSwitched, trackModels } from "./model-use";

describe("model identifiers passed as one CLI argument", () => {
  it.each(["sonnet", "claude-opus-5-5[1m]", "deepseek,deepseek-chat", "openrouter,qwen/qwen3-coder:free"])(
    "accepts aliases and CCR routes: %s",
    (model) => expect(MODEL_ID.test(model)).toBe(true),
  );
  it.each([
    "",
    "--tools",
    "a b",
    "a\nb",
    "a\n",
    "a\r\n",
    "a;rm",
    "a&b",
    "$(whoami)",
    "a`b",
    'a"b',
    "p,",
    ",m",
    "p,m,extra",
  ])("rejects malformed identifiers and shell syntax: %s", (model) =>
    expect(MODEL_ID.test(model)).toBe(false),
  );
});

const line = (value: unknown) => JSON.stringify(value);
const init = (model: string) => line({ type: "system", subtype: "init", model, session_id: "s" });
const assistant = (model: string) =>
  line({ type: "assistant", message: { model, content: [{ type: "text", text: "答" }] }, session_id: "s" });
const result = line({
  type: "result",
  subtype: "success",
  is_error: false,
  total_cost_usd: 0.1,
  modelUsage: { "claude-haiku-4-5-20251001": {}, "claude-opus-5[1m]": {} },
});

// 形状照 CLI 2.1.280 的 SDK 输出定义（stdout 是 snake_case；会话记录文件里是 camelCase，不走这里）
describe("trackModels：从 stream-json 认出实际作答模型", () => {
  it("2026-09-23 实遇：Opus 5.5 以 frontier_llm 拒答，Opus 5 接手作答", () => {
    const t = trackModels();
    for (const l of [
      init("claude-opus-5-5[1m]"),
      line({
        type: "system",
        subtype: "model_refusal_fallback",
        trigger: "refusal",
        direction: "retry",
        scope: "session",
        original_model: "claude-opus-5-5[1m]",
        fallback_model: "claude-opus-5",
        request_id: "req_1",
        api_refusal_category: "frontier_llm",
        content: "Opus 5.5 (1M context)'s safeguards flagged this session…",
        uuid: "u",
        session_id: "s",
      }),
      assistant("claude-opus-5"),
      assistant("claude-opus-5"),
      result,
    ])
      t.observe(l);
    const use = t.result();
    expect(use).toEqual({
      requested: "claude-opus-5-5[1m]",
      answered: ["claude-opus-5"],
      switches: [
        {
          event: "model_refusal_fallback",
          from: "claude-opus-5-5[1m]",
          to: "claude-opus-5",
          reason: "frontier_llm",
        },
      ],
    });
    expect(answeredBy(use)).toBe("claude-opus-5");
    expect(modelSwitched(use)).toBe(true);
  });

  it("模型不可用、额度同意框换模型也记下，原因取 trigger / choice", () => {
    const t = trackModels();
    t.observe(init("claude-fable-5-1"));
    t.observe(
      line({
        type: "system",
        subtype: "model_consent_fallback",
        choice: "cancelled",
        original_model: "claude-fable-5-1",
        fallback_model: "claude-opus-5-5",
      }),
    );
    t.observe(
      line({
        type: "system",
        subtype: "model_fallback",
        trigger: "overloaded",
        original_model: "claude-opus-5-5",
        fallback_model: "claude-opus-5",
      }),
    );
    expect(t.result()?.switches).toEqual([
      {
        event: "model_consent_fallback",
        from: "claude-fable-5-1",
        to: "claude-opus-5-5",
        reason: "cancelled",
      },
      { event: "model_fallback", from: "claude-opus-5-5", to: "claude-opus-5", reason: "overloaded" },
    ]);
  });

  it("只认 assistant 消息上的模型：用量表里的辅助小模型不算作答", () => {
    const t = trackModels();
    for (const l of [init("claude-opus-5[1m]"), assistant("claude-opus-5"), result]) t.observe(l);
    const use = t.result();
    expect(use?.answered).toEqual(["claude-opus-5"]);
    // [1m] 只是上下文长度后缀，同一个模型不算换手
    expect(modelSwitched(use)).toBe(false);
  });

  it("没有换手事件、消息上的模型却和启动时不同，也算换了", () => {
    const t = trackModels();
    for (const l of [init("claude-opus-5-5[1m]"), assistant("claude-opus-5-5"), assistant("claude-opus-5")])
      t.observe(l);
    const use = t.result();
    expect(use?.answered).toEqual(["claude-opus-5-5", "claude-opus-5"]);
    expect(answeredBy(use)).toBe("claude-opus-5");
    expect(modelSwitched(use)).toBe(true);
  });

  it("坏行、无关事件不影响；一点模型信息都没有时返回 undefined", () => {
    const t = trackModels();
    for (const l of ["", "not json", "null", line({ type: "rate_limit_event" }), line({ type: "system" })])
      t.observe(l);
    expect(t.result()).toBeUndefined();
    expect(answeredBy(undefined)).toBeUndefined();
    expect(modelSwitched(undefined)).toBe(false);
  });
});
