import { parseArgs } from "node:util";
import { readCorpus } from "./wiki/corpus";
import { enqueueTask } from "./wiki/queue";
import { configuredWorkflowPolicy } from "./wiki/sync-config";
import { syncGithub } from "./wiki/sync-github";
import { workOne } from "./wiki/worker";
import { digest } from "./wiki/workflow";

export async function prIngestCli(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      pr: { type: "string" },
      file: { type: "string", multiple: true },
      repo: { type: "string", default: "vllm-project/vllm-ascend" },
      "dry-run": { type: "boolean" },
      "retry-failed": { type: "boolean" },
      "job-budget-usd": { type: "string" },
      "attempt-budget-usd": { type: "string" },
      "max-attempts": { type: "string" },
    },
  });
  const number = Number(values.pr);
  if (!Number.isInteger(number) || number < 1) throw new Error("--pr 需要正整数编号");
  if (values["dry-run"]) {
    console.log(
      JSON.stringify({
        repo: values.repo,
        number,
        modelStarted: false,
        networkStarted: false,
        destination: "draft-review",
      }),
    );
    return;
  }
  const policy = configuredWorkflowPolicy(process.cwd(), {
    maxCostUsd: Number(values["job-budget-usd"]),
    reserveUsd: Number(values["attempt-budget-usd"]),
    maxAttempts: Number(values["max-attempts"]),
  });
  const root = process.cwd();
  await syncGithub(root, values.repo, { numbers: [number] });
  const pr = readCorpus(root, values.repo).find((r) => r.kind === "pr" && r.number === number);
  if (!pr) throw new Error("该编号不是 PR");
  const task = await enqueueTask(root, {
    kind: "pr",
    repo: values.repo,
    number,
    sourceHash: digest(JSON.stringify(pr)),
  });
  console.log(
    JSON.stringify(
      await workOne(root, task.id, policy, { retry: values["retry-failed"], prFiles: values.file }),
      null,
      2,
    ),
  );
}
