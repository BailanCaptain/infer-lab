import { parseArgs } from "node:util";
import { detectDrift } from "./wiki/drift";
import { workflowPolicySchema } from "./wiki/workflow-policy";

try {
  const { values } = parseArgs({
    options: {
      sample: { type: "string", default: "1" },
      threshold: { type: "string", default: "0.3" },
      only: { type: "string" },
      seeds: { type: "string", default: "wiki/seeds/vllm-ascend.yaml" },
      "job-budget-usd": { type: "string" },
      "attempt-budget-usd": { type: "string" },
      "max-attempts": { type: "string" },
      "retry-failed": { type: "boolean" },
    },
  });
  const policy = workflowPolicySchema.parse({
    maxAttempts: Number(values["max-attempts"]),
    maxCostUsd: Number(values["job-budget-usd"]),
    reserveUsd: Number(values["attempt-budget-usd"]),
  });
  console.log(
    JSON.stringify(
      await detectDrift(
        process.cwd(),
        {
          sample: Number(values.sample),
          threshold: Number(values.threshold),
          seeds: values.seeds,
          ids: values.only?.split(","),
          policy,
        },
        { retry: values["retry-failed"] },
      ),
      null,
      2,
    ),
  );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
