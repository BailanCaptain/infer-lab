import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  inspectThread,
  loadTraceConfig,
  searchErrors,
  searchPlan,
  TraceSession,
  traceFailures,
  verifyFix,
} from "./wiki/github-trace";

async function main() {
  const command = process.argv[2] ?? "help";
  if (command === "help") {
    console.log(
      "wiki:github-trace plan|search --input <日志文件> 或 --query <错误关键词> [--repo <配置内仓库>]；inspect --url <issue/PR>；verify --repo <仓库> --fix <完整SHA> --target <ref>。网络命令支持 --refresh、--no-cache、--output <证据JSON>。不调模型、不全量导入、不发布知识页。",
    );
    return;
  }
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      input: { type: "string" },
      query: { type: "string" },
      repo: { type: "string", multiple: true },
      url: { type: "string" },
      fix: { type: "string" },
      target: { type: "string" },
      refresh: { type: "boolean" },
      "no-cache": { type: "boolean" },
      output: { type: "string" },
    },
  });
  const config = loadTraceConfig(process.cwd());
  const session = new TraceSession(
    config,
    undefined,
    values["no-cache"] ? undefined : join(process.cwd(), "tools/wiki-runtime/github-trace/cache"),
    values.refresh,
  );
  let result: unknown;
  if (command === "plan" || command === "search") {
    if (!!values.input === !!values.query) throw new Error("选择 --input 或 --query 之一");
    const plan = searchPlan(
      config,
      values.input ? readFileSync(resolve(values.input), "utf8") : values.query!,
      new Date(),
      values.repo,
    );
    result = command === "plan" ? plan : await searchErrors(session, plan);
  } else if (command === "inspect") {
    if (!values.url) throw new Error("需要 --url");
    result = await inspectThread(session, values.url);
  } else if (command === "verify") {
    if (values.repo?.length !== 1 || !values.fix || !values.target)
      throw new Error("需要一个 --repo，以及 --fix、--target");
    result = await verifyFix(session, values.repo[0]!, values.fix, values.target);
  } else throw new Error("未知命令，运行 wiki:github-trace help 查看用法");
  const packet = {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    command,
    result,
    requests: session.requests,
    cacheHits: session.cacheHits,
    evidence: session.receipts,
  };
  const json = JSON.stringify(packet, null, 2);
  if (values.output) {
    const file = resolve(values.output);
    if (
      !file.startsWith(`${resolve("tools/wiki-runtime")}\\`) &&
      !file.startsWith(`${resolve("tools/wiki-runtime")}/`)
    )
      throw new Error("证据输出仅写 tools/wiki-runtime/ 下；不直接写正式知识页");
    mkdirSync(resolve(file, ".."), { recursive: true });
    writeFileSync(file, `${json}\n`);
  }
  console.log(json);
  const failures = traceFailures(command, result);
  if (failures.length) {
    console.error(`GitHub 查询失败（结果不完整，不能当作零命中）：${failures.join("；")}`);
    process.exitCode = 1;
  }
}
main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
