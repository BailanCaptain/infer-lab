import { parseArgs } from "node:util";
import { initBudget, planBudgetResume, readBudget, resumeBudget } from "./wiki/budget";

try {
  const command = process.argv[2] ?? "status";
  if (command === "status") console.log(JSON.stringify(readBudget(process.cwd()), null, 2));
  else if (command === "resume") {
    const { values } = parseArgs({
      args: process.argv.slice(3),
      options: {
        preview: { type: "boolean" },
        plan: { type: "string" },
        reason: { type: "string" },
      },
    });
    if (values.preview && !values.plan && !values.reason)
      console.log(JSON.stringify(planBudgetResume(process.cwd()), null, 2));
    else if (!values.preview && values.plan && values.reason)
      console.log(JSON.stringify(await resumeBudget(process.cwd(), values.plan, values.reason), null, 2));
    else
      throw new Error("resume --preview 只预览；用户明确接受后用 resume --plan <指纹> --reason <批准依据>");
  } else if (command === "init") {
    const { values } = parseArgs({
      args: process.argv.slice(3),
      options: {
        "limit-usd": { type: "string" },
        "prior-charged-usd": { type: "string" },
        "reserve-usd": { type: "string" },
        "max-calls": { type: "string" },
      },
    });
    console.log(
      JSON.stringify(
        await initBudget(process.cwd(), {
          limitUsd: Number(values["limit-usd"]),
          priorChargedUsd: Number(values["prior-charged-usd"]),
          reserveUsd: Number(values["reserve-usd"]),
          maxCalls: Number(values["max-calls"]),
        }),
        null,
        2,
      ),
    );
  } else
    throw new Error(
      "用法：wiki:budget status | init --limit-usd N --prior-charged-usd N --reserve-usd N --max-calls N | resume --preview | resume --plan <指纹> --reason <批准依据>；既有账本不能重置，恢复保留全部预留且需明确批准",
    );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
