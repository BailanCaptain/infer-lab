import { parseArgs } from "node:util";
import { syncGithub } from "./wiki/sync-github";

try {
  const { values } = parseArgs({
    options: {
      repo: { type: "string", default: "vllm-project/vllm-ascend" },
      full: { type: "boolean" },
      numbers: { type: "string" },
    },
  });
  if (values.full && values.numbers) throw new Error("--full 与 --numbers 不能同时使用");
  console.log(
    JSON.stringify(
      await syncGithub(process.cwd(), values.repo, {
        full: values.full,
        numbers: values.numbers?.split(",").map(Number),
      }),
      null,
      2,
    ),
  );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
