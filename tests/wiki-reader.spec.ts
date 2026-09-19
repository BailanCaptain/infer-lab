import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("offline reader identifies the exact build snapshot and can retry", async ({ page }, info) => {
  const snapshot = JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        "--input-type=module",
        "-e",
        "import {readKnowledgeSnapshot} from './server/snapshot.ts'; const {registry,pageTexts,revision}=await readKnowledgeSnapshot(process.cwd()); console.log(JSON.stringify({registry,pageTexts,revision}));",
      ],
      { encoding: "utf8", maxBuffer: 4 << 20 },
    ),
  );
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
  await page.getByRole("button", { name: "刷新知识库" }).click();
  await expect(page.getByTestId("reader-version")).toHaveText(`知识版本 ${snapshot.revision.slice(0, 12)}`);
  await expect(page.getByRole("status")).toHaveCount(0);
});
