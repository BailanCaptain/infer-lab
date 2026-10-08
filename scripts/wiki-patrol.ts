import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseSeeds } from "./wiki/ingest";
import { patrol } from "./wiki/maintenance";

try {
  const { values } = parseArgs({
    options: {
      seeds: { type: "string", default: "wiki/seeds/vllm-ascend.yaml" },
      "max-age-days": { type: "string", default: "30" },
    },
  });
  const result = await patrol(
    process.cwd(),
    parseSeeds(readFileSync(values.seeds, "utf8")),
    Number(values["max-age-days"]),
  );
  console.log(JSON.stringify(result, null, 2));
  if (result.findings.length) process.exitCode = 1;
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
