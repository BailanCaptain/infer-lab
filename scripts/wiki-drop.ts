import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { dropFiles } from "./wiki/drop";
import { acceptBatch, readBatch } from "./wiki/drop-batch";
import { startDrop } from "./wiki/drop-run";

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      why: { type: "string" },
      series: { type: "string" },
      previous: { type: "string" },
      identity: { type: "string" },
      version: { type: "string" },
      batch: { type: "string" },
      "new-attempt": { type: "boolean" },
      url: { type: "string" },
      "dry-run": { type: "boolean" },
      "collect-only": { type: "boolean" },
      "retry-failed": { type: "boolean" },
      "max-attempts": { type: "string" },
      "job-budget-usd": { type: "string" },
      "attempt-budget-usd": { type: "string" },
    },
  });
  if (
    positionals.length > 1 ||
    [!!values.batch, !!values.url, positionals.length === 1].filter(Boolean).length !== 1
  )
    throw new Error(
      "wiki:drop <文本文件或目录> 或 --url <网页> [--why <可选目的>] [--series <系列>] [--collect-only] [--dry-run]",
    );
  if (values["job-budget-usd"] || values["attempt-budget-usd"])
    throw new Error("正式 Drop 已取消美元业务限额；测试请使用显式测试运行配置");
  const calls = values["max-attempts"] ? Number(values["max-attempts"]) : undefined;
  if (calls !== undefined && (!Number.isSafeInteger(calls) || calls < 1))
    throw new Error("显式测试调用限额必须为正整数");
  const inputs = values.batch
    ? []
    : values.url
      ? [{ name: values.url, url: values.url }]
      : dropFiles(positionals[0]!, Number.MAX_SAFE_INTEGER).map((file) => ({
          name: basename(file),
          text: new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(file)),
        }));
  if (inputs.length > 1 && values.identity)
    throw new Error("来源标识只用于单份资料；目录内文件需分别指定来源");
  const items = inputs.map((item) => ({ ...item, identity: values.identity, version: values.version }));
  if (values["dry-run"])
    console.log(
      JSON.stringify({ items: items.map((i) => ({ name: i.name })), why: values.why ?? "", calls: 0 }),
    );
  else {
    const batch = values.batch
      ? readBatch(process.cwd(), values.batch)
      : await acceptBatch(process.cwd(), {
          key: randomUUID(),
          why: values.why ?? "",
          series: values.series,
          previous: values.previous,
          items,
        });
    if (values["collect-only"] || batch.issues.length) {
      console.log(JSON.stringify(batch, null, 2));
      if (batch.issues.length) process.exitCode = 1;
    } else {
      const done = await (
        await startDrop(
          process.cwd(),
          batch.id,
          { retry: values["retry-failed"], newAttempt: values["new-attempt"] },
          { ...(calls !== undefined ? { testLimits: { calls } } : {}) },
        )
      ).done;
      console.log(JSON.stringify(done, null, 2));
      if (!["review", "published", "archived"].includes(done.state)) process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
