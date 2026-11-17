import { join } from "node:path";
import { parseArgs } from "node:util";
import { compileRaw, planRawCompile } from "./wiki/compile-raw";
import { loadHandbook } from "./wiki/handbook";
import { prepareRawInput } from "./wiki/prepare-input";
import { selectedAgent } from "./wiki/selected-agent";
import { configuredWorkflowPolicy } from "./wiki/sync-config";
import { originSchema, WorkflowStore } from "./wiki/workflow";

try {
  const { values } = parseArgs({
    options: {
      id: { type: "string" },
      source: { type: "string" },
      origin: { type: "string" },
      "job-budget-usd": { type: "string" },
      "attempt-budget-usd": { type: "string" },
      "max-attempts": { type: "string" },
      "timeout-min": { type: "string", default: "10" },
      "dry-run": { type: "boolean" },
      "retry-failed": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "wiki:compile --id <id> --source <raw:sha256-…md#L起-L止> --origin <seed|chat|drop|pr|gap> [--dry-run] [--job-budget-usd N --attempt-budget-usd N --max-attempts N] [--retry-failed]：只编译一份已归档材料，停在草稿，不导入新文件或自动整合。",
    );
  } else {
    if (!values.id || !values.source) throw new Error("必须指定 --id 和 --source；用 --help 查看用法");
    const root = process.cwd();
    const prepared = prepareRawInput(join(root, "wiki"), values.source);
    const input = {
      id: values.id,
      source: values.source,
      origin: originSchema.parse(values.origin),
      timeoutMs: Number(values["timeout-min"]) * 60_000,
      rules: loadHandbook(
        join(root, "wiki"),
        `${values.id}\n${values.source}\n${prepared.compilerData ?? ""}`,
        true,
      ).pageFormat,
    };
    if (values["dry-run"]) {
      const plan = planRawCompile(root, input);
      console.log(
        JSON.stringify(
          { dryRun: true, screening: plan.prepared.receipt, args: plan.args, stdin: plan.stdin },
          null,
          2,
        ),
      );
      if (plan.prepared.receipt.blocked) process.exitCode = 1;
    } else {
      const policy = configuredWorkflowPolicy(root, {
        maxCostUsd: Number(values["job-budget-usd"]),
        reserveUsd: Number(values["attempt-budget-usd"]),
        maxAttempts: Number(values["max-attempts"]),
      });
      const result = await compileRaw(new WorkflowStore(root), input, policy, {
        runAgent: selectedAgent(root, "raw-compile"),
        retry: values["retry-failed"],
      });
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
