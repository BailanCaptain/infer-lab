import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { handleRawSource } from "../server/raw";
import { rawSourceHref } from "../src/content/wiki/schema";

let fixture: ReturnType<typeof wikiFixture>;
let server: Server;
let origin: string;
let ref: string;
test.beforeAll(async () => {
  fixture = wikiFixture();
  const wiki = join(fixture.root, "wiki");
  const path = saveRawSnapshot(wiki, "first\n<script>window.rawExecuted=true</script>\n资料第三行\n");
  ref = `raw:${path.slice(4)}#L2-L3`;
  server = createServer((req, res) => {
    if (!handleRawSource(req, res, wiki)) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture server");
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  fixture?.cleanup();
});

test("local citation opens the original lines without executing HTML", async ({ page, context }) => {
  // Substitute the reader's complete runtime snapshot, so the API cannot overwrite a module-only mock.
  await context.route("**/api/wiki/pages", async (route) => {
    const text = readFileSync(join(process.cwd(), "src/content/wiki/registry.json"), "utf8");
    const registry = JSON.parse(text);
    // Point the page under test at the snapshot; "first source in the registry" drifts as pages are added.
    registry.pages.find((p: { id: string }) => p.id === "block-table").sources[0] = ref;
    const pageTexts = registry.pages.map((p: { file: string }) => ({
      file: p.file,
      text: readFileSync(join(process.cwd(), "wiki", p.file), "utf8"),
    }));
    // This payload is a citation-viewer fixture, not a real knowledge publication.
    await route.fulfill({ json: { registry, pageTexts, revision: "a".repeat(64) } });
  });
  await context.route("**/api/wiki/raw?*", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${origin}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  await page.goto("/#/wiki/block-table");
  const link = page.locator(`a[href="${rawSourceHref(ref)}"]`).first();
  await expect(link).toBeVisible();
  const popupPromise = context.waitForEvent("page");
  await link.click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await expect(popup.getByRole("heading", { name: "本地原文" })).toBeVisible();
  await expect(popup.locator("#L2")).toContainText("<script>window.rawExecuted=true</script>");
  await expect(popup.locator(".selected")).toHaveCount(2);
  expect(await popup.evaluate(() => Reflect.get(window, "rawExecuted"))).toBeUndefined();
  await popup.getByRole("link", { name: "第 3 行", exact: true }).click();
  await expect(popup).toHaveURL(/#L3$/);
});

test("viewer rejects traversal, missing snapshots and out-of-range lines", async ({ request }) => {
  for (const [source, status] of [
    ["raw:../HANDBOOK.md#L1", 400],
    [`raw:sha256-${"0".repeat(64)}.md#L1`, 422],
    [ref.replace("#L2-L3", "#L99"), 422],
  ] as const) {
    const response = await request.get(`${origin}/api/wiki/raw?ref=${encodeURIComponent(source)}`);
    expect(response.status()).toBe(status);
    expect(await response.text()).not.toContain("first");
  }
});

test("inferred pages expose their raw source without numbered evidence marks", async ({
  page,
  context,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.route("**/api/wiki/pages", async (route) => {
    const registry = JSON.parse(readFileSync(join(process.cwd(), "src/content/wiki/registry.json"), "utf8"));
    const inferred = registry.pages.find((p: { id: string }) => p.id === "block-table");
    inferred.evidence = "I";
    inferred.sources = [ref];
    const pageTexts = registry.pages.map((p: { file: string; id: string }) => ({
      file: p.file,
      text:
        p.id === "block-table"
          ? "## 一句话\n归档问答只提供推断 [I]。\n"
          : readFileSync(join(process.cwd(), "wiki", p.file), "utf8"),
    }));
    await route.fulfill({ json: { registry, pageTexts, revision: "b".repeat(64) } });
  });
  await context.route("**/api/wiki/raw?*", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: origin + url.pathname + url.search }) });
  });
  await page.goto("/#/wiki/block-table");
  await expect(page.locator(".wiki-mark-link")).toHaveCount(0);
  const sources = page.getByTestId("wiki-sources");
  await expect(sources).toBeVisible();
  await sources.locator("summary").click();
  const link = sources.getByRole("link").first();
  await expect(link).toHaveAttribute("href", rawSourceHref(ref)!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("inferred-source.png"), fullPage: true });
  const popupPromise = context.waitForEvent("page");
  await link.click();
  const popup = await popupPromise;
  await expect(popup.locator("#L2")).toContainText("<script>window.rawExecuted=true</script>");
  expect(await popup.evaluate(() => Reflect.get(window, "rawExecuted"))).toBeUndefined();
});
