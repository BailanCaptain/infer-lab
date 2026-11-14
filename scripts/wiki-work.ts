import { parseArgs } from "node:util";
import { assessGap, listCoverageAssessments, prepareCoverageReview } from "../server/coverage-work";
import { listGaps, splitGapAlias } from "./wiki/gap-ledger";
import { listTasks } from "./wiki/queue";
import { configuredWorkflowPolicy, isProduction } from "./wiki/sync-config";
import { workOne } from "./wiki/worker";

try {
  const command = process.argv[2] ?? "list";
  if (command === "list" && process.argv.length <= 3) {
    console.log(
      JSON.stringify(
        {
          gaps: listGaps(process.cwd()),
          assessments: listCoverageAssessments(process.cwd()),
          worker: isProduction(process.cwd()) ? "production-review-required" : "budgeted-review-required",
          queue: listTasks(process.cwd()),
        },
        null,
        2,
      ),
    );
  } else if (command === "run") {
    const { values } = parseArgs({
      args: process.argv.slice(3),
      options: {
        task: { type: "string" },
        source: { type: "string", multiple: true },
        page: { type: "string", multiple: true },
        file: { type: "string", multiple: true },
        "timeout-ms": { type: "string", default: "180000" },
        "job-budget-usd": { type: "string" },
        "attempt-budget-usd": { type: "string" },
        "max-attempts": { type: "string" },
        "retry-failed": { type: "boolean" },
      },
    });
    const id = values.task ?? listTasks(process.cwd()).find((t) => t.state === "queued")?.id;
    if (!id) throw new Error("没有待运行任务");
    const policy = configuredWorkflowPolicy(process.cwd(), {
      maxAttempts: Number(values["max-attempts"]),
      maxCostUsd: Number(values["job-budget-usd"]),
      reserveUsd: Number(values["attempt-budget-usd"]),
    });
    console.log(
      JSON.stringify(
        await workOne(process.cwd(), id, policy, {
          sources: values.source,
          pages: values.page,
          prFiles: values.file,
          timeoutMs: Number(values["timeout-ms"]),
          retry: values["retry-failed"],
        }),
        null,
        2,
      ),
    );
  } else if (command === "prepare") {
    const { values } = parseArgs({
      args: process.argv.slice(3),
      options: {
        job: { type: "string" },
        source: { type: "string", multiple: true },
        page: { type: "string", multiple: true },
      },
    });
    if (!values.job || !/^[a-f0-9]{64}$/.test(values.job)) throw new Error("需要 --job <诊断 jobId>");
    if (values.page && !values.source) throw new Error("--page 需与 --source 一同提供");
    console.log(
      JSON.stringify(
        await prepareCoverageReview(
          process.cwd(),
          values.job,
          values.source ? { sources: values.source, pages: values.page } : undefined,
        ),
        null,
        2,
      ),
    );
  } else if (command === "split-gap") {
    // 说法不同被判为同一题、其实不是：把那个问法拆回自己的缺口（不调模型）
    const { values } = parseArgs({ args: process.argv.slice(3), options: { alias: { type: "string" } } });
    if (!values.alias || !/^[a-f0-9]{64}$/.test(values.alias))
      throw new Error("需要 --alias <别名 key>，见 list 输出里各缺口的 aliases");
    console.log(JSON.stringify(await splitGapAlias(process.cwd(), values.alias), null, 2));
  } else if (command === "assess") {
    const { values } = parseArgs({
      args: process.argv.slice(3),
      options: {
        gap: { type: "string" },
        "job-budget-usd": { type: "string" },
        "attempt-budget-usd": { type: "string" },
        "max-attempts": { type: "string" },
        "timeout-ms": { type: "string", default: "60000" },
        "retry-failed": { type: "boolean" },
      },
    });
    if (!values.gap || !/^[a-f0-9]{64}$/.test(values.gap)) throw new Error("需要 --gap <缺口 key>");
    const policy = configuredWorkflowPolicy(process.cwd(), {
      maxAttempts: Number(values["max-attempts"]),
      maxCostUsd: Number(values["job-budget-usd"]),
      reserveUsd: Number(values["attempt-budget-usd"]),
    });
    const result = await assessGap(process.cwd(), values.gap, policy, {
      retry: values["retry-failed"],
      timeoutMs: Number(values["timeout-ms"]),
    });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } else
    throw new Error(
      "用法：pnpm wiki:work list | split-gap --alias <key> | prepare --job <诊断 jobId> [--source <raw 行号引用> ...] [--page <已有页 id> ...] | assess --gap <key> | run --task <id>；测试模式需 --job-budget-usd N --attempt-budget-usd N --max-attempts N；正式模式仅记账。失败仍需 --retry-failed，产物停在待审。",
    );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
