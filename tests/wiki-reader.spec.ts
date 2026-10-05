import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { ReaderSnapshot } from "../src/content/wiki/schema";

test("offline reader identifies the exact build snapshot and can retry", async ({ page }, info) => {
  // tsx handles the snapshot's transitive JSON imports. Pass the growing payload through a file,
  // not execFileSync's bounded stdout buffer.
  const file = join(tmpdir(), `wiki-reader-${randomUUID()}.json`);
  let snapshot: ReaderSnapshot;
  try {
    execFileSync(process.execPath, [
      "--import",
      import.meta.resolve("tsx"),
      "--input-type=module",
      "-e",
      "import {writeFileSync} from 'node:fs'; import {readKnowledgeSnapshot} from './server/snapshot.ts'; const {registry,pageTexts,revision}=await readKnowledgeSnapshot(process.cwd()); writeFileSync(process.argv[1], JSON.stringify({registry,pageTexts,revision}));",
      file,
    ]);
    snapshot = JSON.parse(readFileSync(file, "utf8"));
  } finally {
    rmSync(file, { force: true });
  }
  let online = false;
  await page.route("**/api/wiki/pages", async (route) => {
    if (!online) return route.abort();
    await route.fulfill({
      json: { registry: snapshot.registry, pageTexts: snapshot.pageTexts, revision: snapshot.revision },
    });
  });
  await page.goto("/#/wiki/block-table");
  await expect(page.getByTestId("reader-version")).toHaveText(`构建版本 ${snapshot.revision.slice(0, 12)}`);
  await expect(page.getByTestId("reader-version")).toHaveAttribute("title", snapshot.revision);
  await expect(page.getByTestId("wiki-body")).toContainText("物理块");
  await expect(page.getByRole("status")).toContainText("仍显示以上版本");
  await page.screenshot({ path: info.outputPath("wiki-reader-offline.png"), fullPage: true });
  online = true;
  // 刷新与问答、审阅收在同一个侧栏里
  await page.getByTestId("chat-open").click();
  await page.getByRole("button", { name: "刷新知识库" }).click();
  await expect(page.getByTestId("reader-version")).toHaveText(`知识版本 ${snapshot.revision.slice(0, 12)}`);
  await expect(page.getByRole("status")).toHaveCount(0);
});
