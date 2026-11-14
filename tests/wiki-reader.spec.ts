import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import type { ReaderSnapshot } from "../src/content/wiki/schema";

test("offline reader identifies the exact build snapshot and can retry", async ({ page }, info) => {
  // tsx handles the snapshot's transitive JSON imports. Pass the growing payload through a file,
  // not execFileSync's bounded stdout buffer.
  const file = join(tmpdir(), `wiki-reader-${randomUUID()}.json`);
  const fixture = wikiFixture();
  const restoredText = `离线恢复验收 ${randomUUID()}`;
  let snapshot: ReaderSnapshot;
  try {
    // Reading a snapshot takes a workflow lock. Keep this test away from the live app's
    // state/status readers while using exactly the same published content as Vite.
    cpSync(join(process.cwd(), "wiki"), join(fixture.root, "wiki"), {
      recursive: true,
      filter: (path) => !path.split(/[\\/]/).includes("_jobs"),
    });
    const editedPage = join(fixture.root, "wiki/concepts/block-table.md");
    writeFileSync(editedPage, `${readFileSync(editedPage, "utf8")}\n${restoredText}\n`);
    execFileSync(process.execPath, [
      "--import",
      import.meta.resolve("tsx"),
      "--input-type=module",
      "-e",
      "import {writeFileSync} from 'node:fs'; import {readReaderSnapshot} from './server/snapshot.ts'; writeFileSync(process.argv[1], JSON.stringify(await readReaderSnapshot(process.argv[2])));",
      file,
      fixture.root,
    ]);
    snapshot = JSON.parse(readFileSync(file, "utf8"));
  } finally {
    rmSync(file, { force: true });
    fixture.cleanup();
  }
  let online = false;
  await page.route("**/api/wiki/pages", async (route) => {
    if (!online) return route.abort();
    await route.fulfill({
      json: snapshot,
    });
  });
  await page.goto("/#/wiki/block-table");
  const version = page.getByTestId("reader-version");
  await expect(version).toHaveAttribute("title", /^[a-f0-9]{64}$/);
  const buildRevision = await version.getAttribute("title");
  // A production build can predate live edits. The isolated API intentionally supplies a newer publication;
  // exact build/API parity for identical inputs is covered by server/reader-build.test.ts.
  await expect(version).toHaveText(`构建版本 ${buildRevision!.slice(0, 12)}`);
  expect(snapshot.revision).not.toBe(buildRevision);
  await expect(page.getByTestId("wiki-body")).toContainText("物理块");
  await expect(page.getByTestId("wiki-body")).not.toContainText(restoredText);
  await page.getByText("内容与版本", { exact: true }).click();
  await expect(page.getByRole("status")).toContainText("仍显示以上版本");
  await page.screenshot({ path: info.outputPath("wiki-reader-offline.png"), fullPage: true });
  online = true;
  // 刷新与问答、审阅收在同一个侧栏里
  await page.getByTestId("chat-open").click();
  await page.getByRole("button", { name: "刷新知识库" }).click();
  await expect(page.getByTestId("reader-version")).toHaveText(`知识版本 ${snapshot.revision.slice(0, 12)}`);
  await expect(page.getByTestId("wiki-body")).toContainText(restoredText);
  await expect(page.getByRole("status").filter({ hasText: "仍显示以上版本" })).toHaveCount(0);
});
