import { parseArgs } from "node:util";
import { reconcileBatches, reconcileCycle } from "./wiki/reconcile";
import { configuredWorkflowPolicy, isProduction } from "./wiki/sync-config";

try {
  const { values } = parseArgs({
    options: {
      plan: { type: "boolean" },
      "max-batches": { type: "string", default: "1" },
      "job-budget-usd": { type: "string" },
      "attempt-budget-usd": { type: "string" },
      "max-attempts": { type: "string" },
      "retry-failed": { type: "boolean" },
    },
  });
  const batches = reconcileBatches(process.cwd()).map((b) => b.map((p) => p.fm.id));
  if (values.plan) console.log(JSON.stringify({ batches, coversWholeInventory: true }, null, 2));
  else {
    const max = isProduction(process.cwd()) ? null : Number(values["max-batches"]);
    if (max !== null && (!Number.isInteger(max) || max < 1)) throw new Error("max-batches 必须为正整数");
    const policy = configuredWorkflowPolicy(process.cwd(), {
      maxCostUsd: Number(values["job-budget-usd"]),
      reserveUsd: Number(values["attempt-budget-usd"]),
      maxAttempts: Number(values["max-attempts"]),
    });
    const result = await reconcileCycle(process.cwd(), max, policy, { retry: values["retry-failed"] });
    console.log(JSON.stringify(result));
    if (result.failures.length) process.exitCode = 1;
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
