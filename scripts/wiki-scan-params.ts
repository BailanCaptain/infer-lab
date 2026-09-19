import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseSeeds } from "./wiki/ingest";
import { scanRepo } from "./wiki/params/scan";
import { atomicText } from "./wiki/workflow";

try {
  const { values } = parseArgs({
    options: {
      ref: { type: "string", default: "main" },
      seeds: { type: "string", default: "wiki/seeds/vllm-ascend.yaml" },
      out: { type: "string" },
    },
  });
  const seeds = parseSeeds(readFileSync(values.seeds, "utf8"));
  const repoName = seeds.repos["vllm-ascend"] ? "vllm-ascend" : Object.keys(seeds.repos)[0]!;
  const repo = seeds.repos[repoName]!;
  const pin = repo.refs[values.ref];
  if (!pin) throw new Error("ref 未在 seeds 钉定");
  const data = scanRepo(resolve(repo.path), pin);
  const target = resolve(values.out ?? `wiki/lineage/params-${encodeURIComponent(values.ref)}.json`);
  mkdirSync(dirname(target), { recursive: true });
  atomicText(
    target,
    `${JSON.stringify({ schemaVersion: 1, repo: repoName, ref: values.ref, ...data }, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      file: target,
      commit: data.commit,
      count: data.entries.length,
      suspect: data.entries.filter((p) => p.confidence === "suspect").length,
    }),
  );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
