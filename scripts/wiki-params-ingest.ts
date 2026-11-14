import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { paramEntrySchema } from "../src/content/wiki/schema";
import { gitText } from "./wiki/git";
import { parseSeeds } from "./wiki/ingest";
import { loadPages } from "./wiki/pages";
import { parameterBindings, parameterPageId } from "./wiki/params/identities";
import { ingestParam } from "./wiki/params/ingest";
import { paramId } from "./wiki/params/pages";
import { scanRepo } from "./wiki/params/scan";
import { parameterKey, withoutLocations } from "./wiki/params/sync";
import { configuredWorkflowPolicy } from "./wiki/sync-config";

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
  const pages = loadPages(resolve("wiki")).pages;
  const bindings = parameterBindings(process.cwd());
  const rows = names.map((name) => {
    const binding = bindings.find((b) => b.repo === data.repo && b.pageId === name && b.role !== "reference");
    const found = data.entries.filter(
      (p) =>
        p.name === name ||
        paramId(p) === name ||
        (binding !== undefined && parameterKey(p) === parameterKey(binding)),
    );
    if (found.length !== 1) throw new Error(`参数不唯一，使用完整 id：${name}`);
    const entry = found[0]!;
    return { entry, id: parameterPageId(process.cwd(), data.repo, entry, pages) };
  });
  const targets = rows.filter((row) => row.id !== undefined);
  const skippedReferences = rows.filter((row) => row.id === undefined).map((row) => row.entry.name);
  if (values["dry-run"] || !targets.length) {
    console.log(
      JSON.stringify({ targets: targets.map((row) => row.id), skippedReferences, modelStarted: false }),
    );
    return;
  }
  if (skippedReferences.length) console.log(JSON.stringify({ skippedReferences }));
  const policy = configuredWorkflowPolicy(process.cwd(), {
    maxCostUsd: Number(values["job-budget-usd"]),
    reserveUsd: Number(values["attempt-budget-usd"]),
    maxAttempts: Number(values["max-attempts"]),
  });
  const repo = parseSeeds(readFileSync(values.seeds, "utf8")).repos[data.repo];
  if (!repo) throw new Error("参数仓库未配置");
  const actual = scanRepo(resolve(repo.path), data.commit).entries;
  for (const { entry } of targets) {
    const original = actual.find((p) => paramId(p) === paramId(entry));
    if (
      !original ||
      JSON.stringify(withoutLocations({ ...original, review: undefined })) !==
        JSON.stringify(withoutLocations({ ...entry, review: undefined }))
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
