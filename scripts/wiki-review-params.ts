import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { paramEntrySchema } from "../src/content/wiki/schema";
import { gitText } from "./wiki/git";
import { parseSeeds } from "./wiki/ingest";
import { paramId } from "./wiki/params/pages";
import { reviewParam } from "./wiki/params/review";
import { scanRepo } from "./wiki/params/scan";
import { withoutLocations } from "./wiki/params/sync";
import { atomicText } from "./wiki/workflow";
import { workflowPolicySchema } from "./wiki/workflow-policy";

try {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      only: { type: "string" },
      seeds: { type: "string", default: "wiki/seeds/vllm-ascend.yaml" },
      "job-budget-usd": { type: "string" },
      "attempt-budget-usd": { type: "string" },
      "max-attempts": { type: "string" },
      "retry-failed": { type: "boolean" },
    },
  });
  if (!values.input || !values.only)
    throw new Error("review-params 需要 --input 与 --only <参数名>，每次只复核一个候选");
  const text = readFileSync(values.input, "utf8");
  const data = z
    .object({
      repo: z.string(),
      ref: z.string(),
      commit: z.string().regex(/^[a-f0-9]{40}$/),
      entries: paramEntrySchema.array(),
    })
    .passthrough()
    .parse(JSON.parse(text));
  const candidates = data.entries.filter(
    (p) => (p.name === values.only || paramId(p) === values.only) && p.confidence === "suspect" && !p.review,
  );
  if (candidates.length !== 1) throw new Error("必须唯一定位一个尚未复核的疑似项；不批量调用");
  const entry = candidates[0]!;
  const repo = parseSeeds(readFileSync(values.seeds, "utf8")).repos[data.repo];
  if (!repo) throw new Error("未知源码仓库");
  const actual = scanRepo(resolve(repo.path), data.commit).entries.find((p) => paramId(p) === paramId(entry));
  if (!actual || JSON.stringify(withoutLocations(actual)) !== JSON.stringify(withoutLocations(entry)))
    throw new Error("参数候选与钉定源码不符");
  const source = gitText(resolve(repo.path), ["show", `${data.commit}:${entry.file}`]);
  const policy = workflowPolicySchema.parse({
    maxCostUsd: Number(values["job-budget-usd"]),
    reserveUsd: Number(values["attempt-budget-usd"]),
    maxAttempts: Number(values["max-attempts"]),
  });
  const updated = await reviewParam(process.cwd(), entry, source, policy, undefined, values["retry-failed"]);
  if (readFileSync(values.input, "utf8") !== text) throw new Error("扫描记录在复核中发生变化");
  data.entries[data.entries.indexOf(entry)] = updated;
  atomicText(values.input, JSON.stringify(data, null, 2));
  console.log(JSON.stringify({ name: entry.name, review: updated.review }));
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
