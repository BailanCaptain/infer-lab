import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { readCorpus } from "./wiki/corpus";
import { mapDocRef, traceIssue } from "./wiki/corpus-trace";
import { parseSeeds } from "./wiki/ingest";

try {
  const { values } = parseArgs({
    options: {
      issue: { type: "string" },
      repo: { type: "string", default: "vllm-project/vllm-ascend" },
      seeds: { type: "string", default: "wiki/seeds/vllm-ascend.yaml" },
      ref: { type: "string", default: "main" },
    },
  });
  const number = Number(values.issue);
  if (!Number.isInteger(number) || number < 1) throw new Error("需要 --issue <编号>");
  const records = readCorpus(process.cwd(), values.repo);
  const repo = parseSeeds(readFileSync(values.seeds, "utf8")).repos[values.repo.split("/")[1]!];
  if (!repo?.refs[values.ref]) throw new Error("所选仓库与 ref 未在 seeds 钉定");
  const dir = resolve(repo.path);
  const issue = records.find((r) => r.kind === "issue" && r.number === number);
  if (!issue) throw new Error("issue 尚未采集");
  console.log(
    JSON.stringify(
      {
        ...traceIssue(records, number, dir),
        docs: issue.docs.map((d) => mapDocRef(dir, d, values.ref, repo.refs[values.ref]!)),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
