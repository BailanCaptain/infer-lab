import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as AnswerSaveModule from "./AnswerSave";

describe("AnswerSave 退回审阅与失败耗尽恢复入口", () => {
  it("POST save 返回 rejected 时同时保留查看退回记录与显式「重新生成待审稿」，普通查看不发请求，仅主动点击发送 newAttempt", async () => {
    const createController = (AnswerSaveModule as Record<string, unknown>)
      .createAnswerSaveController as typeof AnswerSaveModule extends {
      createAnswerSaveController: infer F;
    }
      ? F
      : undefined;
    expect(createController).toBeTypeOf("function");

    const answerId = "c".repeat(64);
    const rejectedReviewId = "b".repeat(64);
    const nextReviewId = "d".repeat(64);
    const savePayloads: unknown[] = [];
    const openedReviews: string[] = [];

    const request = async <T,>(path: string, body?: unknown): Promise<T> => {
      if (path === "status") {
        return { models: { chatProvider: "codex" } } as T;
      }
      if (path === `answers/${answerId}/save`) {
        savePayloads.push(body);
        const payload = body as { retry?: boolean; newAttempt?: boolean };
        if (payload.newAttempt) {
          return { jobId: "e".repeat(64), reviewId: nextReviewId, state: "pending" } as T;
        }
        return { jobId: "a".repeat(64), reviewId: rejectedReviewId, state: "rejected" } as T;
      }
      throw new Error(`unexpected path: ${path}`);
    };

    const ctrl = (createController as CallableFunction)({
      answerId,
      onReview: (id: string) => openedReviews.push(id),
      request,
    });

    // 初始折叠态：不发任何 /save 请求
    expect(savePayloads).toEqual([]);
    let html = renderToStaticMarkup(
      <AnswerSaveModule.AnswerSaveView state={ctrl.getState()} actions={ctrl.actions} />,
    );
    expect(html).toContain("存进 Wiki");

    // 展开面板：只拉取 status，不自动触发 /save
    await ctrl.actions.openForm();
    expect(savePayloads).toEqual([]);
    html = renderToStaticMarkup(
      <AnswerSaveModule.AnswerSaveView state={ctrl.getState()} actions={ctrl.actions} />,
    );
    expect(html).toContain("生成待审草稿");

    // 点击「生成待审草稿」：收到 state === "rejected"
    await ctrl.actions.submit();
    expect(savePayloads).toEqual([{ retry: false }]);
    expect(openedReviews).toEqual([]);

    html = renderToStaticMarkup(
      <AnswerSaveModule.AnswerSaveView state={ctrl.getState()} actions={ctrl.actions} />,
    );
    expect(html).toContain("查看保存结果");
    expect(html).toContain("重新生成待审稿");
    expect(html).toContain("消耗 Codex 的 ChatGPT 账户额度");
    expect(html).toContain("不会自动重跑");

    // 点击「查看保存结果」看退回记录：只打开旧审阅单，绝不自动重跑或发 newAttempt
    ctrl.actions.viewReview();
    expect(openedReviews).toEqual([rejectedReviewId]);
    expect(savePayloads).toHaveLength(1);

    // 读者主动点击「重新生成待审稿」：才发送 { newAttempt: true } 并切换到新待审稿
    await ctrl.actions.submit();
    expect(savePayloads).toEqual([{ retry: false }, { newAttempt: true }]);
    expect(openedReviews).toEqual([rejectedReviewId, nextReviewId]);

    html = renderToStaticMarkup(
      <AnswerSaveModule.AnswerSaveView state={ctrl.getState()} actions={ctrl.actions} />,
    );
    expect(html).toContain("查看保存结果");
    expect(html).not.toContain("重新生成待审稿");
  });

  it("失败耗尽（1/2 普通重试 -> 2/2 耗尽）后切换为「重新生成待审稿」合法恢复入口并沿用原预算", async () => {
    const createController = (AnswerSaveModule as Record<string, unknown>)
      .createAnswerSaveController as CallableFunction;
    expect(createController).toBeTypeOf("function");

    const answerId = "f".repeat(64);
    const recoveredReviewId = "9".repeat(64);
    const savePayloads: unknown[] = [];
    const openedReviews: string[] = [];
    let attempt = 0;

    const request = async <T,>(path: string, body?: unknown): Promise<T> => {
      if (path === "status") {
        return { models: { chatProvider: "claude" } } as T;
      }
      if (path === `answers/${answerId}/save`) {
        savePayloads.push(body);
        attempt++;
        if (attempt === 1) {
          throw Object.assign(new Error("Error: 编译草稿 schema 无效"), {
            canNewAttempt: false,
            budgetUsd: 1,
          });
        }
        if (attempt === 2) {
          throw Object.assign(new Error("Error: transient model failure"), {
            canNewAttempt: true,
            budgetUsd: 1,
          });
        }
        return { jobId: "8".repeat(64), reviewId: recoveredReviewId, state: "pending" } as T;
      }
      throw new Error(`unexpected path: ${path}`);
    };

    const ctrl = createController({
      answerId,
      onReview: (id: string) => openedReviews.push(id),
      request,
    });

    await ctrl.actions.openForm();
    ctrl.actions.setBudget("1");

    // 第 1 次失败（1/2）：仍处于原任务可重试状态（查看状态 / 重试）
    await ctrl.actions.submit();
    expect(savePayloads[0]).toEqual({ budgetUsd: 1, retry: false });
    let html = renderToStaticMarkup(
      <AnswerSaveModule.AnswerSaveView state={ctrl.getState()} actions={ctrl.actions} />,
    );
    expect(html).toContain("查看状态 / 重试");
    expect(html).not.toContain("重新生成待审稿");

    // 第 2 次失败（2/2 耗尽）：服务端返回 canNewAttempt: true，切换为「重新生成待审稿」且提示沿用预算
    await ctrl.actions.submit();
    expect(savePayloads[1]).toEqual({ retry: true });
    html = renderToStaticMarkup(
      <AnswerSaveModule.AnswerSaveView state={ctrl.getState()} actions={ctrl.actions} />,
    );
    expect(html).toContain("重新生成待审稿");
    expect(html).toContain("沿用原总预算（1 美元");

    // 第 3 次读者主动点击「重新生成待审稿」：发 { newAttempt: true }（不重传冲突预算）并恢复成功
    await ctrl.actions.submit();
    expect(savePayloads[2]).toEqual({ newAttempt: true });
    expect(openedReviews).toEqual([recoveredReviewId]);
  });
});
