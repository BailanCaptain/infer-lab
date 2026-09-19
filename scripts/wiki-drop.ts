import { parseArgs } from "node:util";
import { acceptDrop, dropFiles } from "./wiki/drop";
import { workflowPolicySchema } from "./wiki/workflow-policy";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      why: { type: "string" },
      "job-budget-usd": { type: "string" },
      "attempt-budget-usd": { type: "string" },
      "max-attempts": { type: "string" },
      "dry-run": { type: "boolean" },
      "retry-failed": { type: "boolean" },
    },
  });
  if (positionals.length !== 1 || !values.why)
    throw new Error(
      "wiki:drop <文本文件或小目录> --why <理由> [--dry-run]；执行时还需每任务预算、每次预留与次数上限",
    );
  const files = dropFiles(positionals[0]!);
  if (values["dry-run"]) console.log(JSON.stringify({ files, why: values.why, calls: 0 }));
  else {
    const policy = workflowPolicySchema.parse({
      maxCostUsd: Number(values["job-budget-usd"]),
      reserveUsd: Number(values["attempt-budget-usd"]),
      maxAttempts: Number(values["max-attempts"]),
    });
    for (const file of files) {
      const result = await acceptDrop(
        process.cwd(),
        file,
        { why: values.why, policy },
        { retry: values["retry-failed"] },
      );
      console.log(JSON.stringify(result));
      if (result.state !== "draft") process.exitCode = 1;
      if (result.state === "failed") break;
    }
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
