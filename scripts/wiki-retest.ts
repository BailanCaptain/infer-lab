import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { acceptRetest, prepareRetest, runRetest } from "./wiki/retest";

try {
  const command = process.argv[2];
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: { input: { type: "string" }, task: { type: "string" }, review: { type: "string" } },
  });
  if (command === "prepare" && values.input)
    console.log(
      JSON.stringify(
        await prepareRetest(process.cwd(), JSON.parse(readFileSync(values.input, "utf8"))),
        null,
        2,
      ),
    );
  else if (command === "run" && values.task)
    console.log(JSON.stringify(await runRetest(process.cwd(), values.task, values.review), null, 2));
  else if (command === "accept" && values.task && values.input)
    console.log(
      JSON.stringify(
        await acceptRetest(process.cwd(), values.task, JSON.parse(readFileSync(values.input, "utf8"))),
        null,
        2,
      ),
    );
  else
    throw new Error(
      "wiki:retest prepare --input plan.json | run --task ID [--review ID] | accept --task ID --input 人工逐题复核.json",
    );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
