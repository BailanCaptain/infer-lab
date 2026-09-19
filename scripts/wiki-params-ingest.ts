import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { paramEntrySchema } from "../src/content/wiki/schema";
import { gitText } from "./wiki/git";
import { parseSeeds } from "./wiki/ingest";
import { ingestParam } from "./wiki/params/ingest";
import { paramId } from "./wiki/params/pages";
import { scanRepo } from "./wiki/params/scan";
import { workflowPolicySchema } from "./wiki/workflow-policy";

export async function paramIngestCli(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      params: { type: "string" },
      input: { type: "string", default: "wiki/lineage/params-main.json" },
      seeds: { type: "string", default: "wiki/seeds/vllm-ascend.yaml" },
      "dry-run": { type: "boolean" },
      "retry-failed": { type: "boolean" },
      "job-budget-usd": { type: "string" },
      "attempt-budget-usd": { type: "string" },
      "max-attempts": { type: "string" },
    },
  });
  if (!values.params) throw new Error("参数正文补写需 --params <name,...>");
  const data = z
    .object({
      repo: z.string(),
      ref: z.string(),
      commit: z.string().regex(/^[a-f0-9]{40}$/),
      entries: paramEntrySchema.array(),
    })
    .parse(JSON.parse(readFileSync(values.input, "utf8")));
  const names = values.params.split(",");
  if (names.length > 10) throw new Error("正文补写每批最多 10 个参数");
  const rows = names.map((name) => {
    const found = data.entries.filter((p) => p.name === name || paramId(p) === name);
    if (found.length !== 1) throw new Error(`参数不唯一，使用完整 id：${name}`);
    return found[0]!;
  });
  if (values["dry-run"]) {
    console.log(JSON.stringify({ targets: rows.map(paramId), modelStarted: false }));
    return;
  }
  const policy = workflowPolicySchema.parse({
    maxCostUsd: Number(values["job-budget-usd"]),
    reserveUsd: Number(values["attempt-budget-usd"]),
    maxAttempts: Number(values["max-attempts"]),
  });
  const repo = parseSeeds(readFileSync(values.seeds, "utf8")).repos[data.repo];
  if (!repo) throw new Error("参数仓库未配置");
  const actual = scanRepo(resolve(repo.path), data.commit).entries;
  for (const entry of rows) {
    const original = actual.find((p) => paramId(p) === paramId(entry));
    if (
      !original ||
      JSON.stringify({ ...original, review: undefined, occurrences: undefined }) !==
        JSON.stringify({ ...entry, review: undefined, occurrences: undefined })
    )
      throw new Error(`参数记录与源码不符：${entry.name}`);
    const source = gitText(resolve(repo.path), ["show", `${data.commit}:${entry.file}`]);
    console.log(
      JSON.stringify(
        await ingestParam(process.cwd(), { ...data, entry, source }, policy, {
          retry: values["retry-failed"],
        }),
      ),
    );
  }
}
