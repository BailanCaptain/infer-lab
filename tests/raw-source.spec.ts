import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { saveRawSnapshot } from "../scripts/wiki/raw";
import { collectPublishedRawPaths } from "../scripts/wiki/raw-viewer";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { handleRawSource } from "../server/raw";
import { rawSourceHref } from "../src/content/wiki/schema";

let fixture: ReturnType<typeof wikiFixture>;
let server: Server;
let origin: string;
let ref: string;
let unpublishedHash: string;
test.beforeAll(async () => {
  fixture = wikiFixture();
  const wiki = join(fixture.root, "wiki");
  const path = saveRawSnapshot(wiki, "first\n<script>window.rawExecuted=true</script>\n资料第三行\n");
  ref = `raw:${path.slice(4)}#L2-L3`;
  const unpublishedPath = saveRawSnapshot(
    wiki,
    "UNPUBLISHED-SYNTHETIC-MATERIAL-NO-APPROVED-PAGE\nquarantined line\n",
  );
  unpublishedHash = /^raw\/sha256-([a-f0-9]{64})\.md$/.exec(unpublishedPath)![1]!;
  fixture.write(
    "wiki/concepts/published-fixture.md",
    [
      "---",
      "id: published-fixture",
      "title: 已发布测试页",
      "type: concept",
      "summary: 已通过审阅的正式页",
      `sources: [${JSON.stringify(ref)}]`,
      "evidence: S",
      "updated: '2026-11-15'",
      "---",
      "正文。\n",
    ].join("\n"),
  );
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
  await context.route("**/wiki-raw/sha256-*.html*", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${origin}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  await page.goto("/#/wiki/block-table");
  const sources = page.getByTestId("wiki-sources");
  await sources.locator("summary").click();
  const link = sources.locator(`a[href="${rawSourceHref(ref)}"]`);
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

test("inline raw: markdown links survive ReactMarkdown urlTransform while blocking unsafe protocols", async ({
  page,
  context,
}) => {
  await context.route("**/api/wiki/pages", async (route) => {
    const registry = JSON.parse(readFileSync(join(process.cwd(), "src/content/wiki/registry.json"), "utf8"));
    const target = registry.pages.find((p: { id: string }) => p.id === "block-table");
    target.sources = [ref];
    const pageTexts = registry.pages.map((p: { file: string; id: string }) => ({
      file: p.file,
      text:
        p.id === "block-table"
          ? [
              "## 核心机制",
              "",
              `正文直接链接到[归档摘录](${ref})，同时包含[越界归档](raw:../HANDBOOK.md#L1)与[脚本链接](javascript:window.rawExecuted=true)。`,
              "",
            ].join("\n")
          : readFileSync(join(process.cwd(), "wiki", p.file), "utf8"),
    }));
    await route.fulfill({ json: { registry, pageTexts, revision: "c".repeat(64) } });
  });
  await context.route("**/wiki-raw/sha256-*.html*", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: `${origin}${url.pathname}${url.search}` }) });
  });

  await page.goto("/#/wiki/block-table");
  const body = page.getByTestId("wiki-body");
  const rawInlineLink = body.getByRole("link", { name: "归档摘录", exact: true });
  await expect(rawInlineLink).toBeVisible();
  await expect(rawInlineLink).toHaveAttribute("href", rawSourceHref(ref)!);

  for (const label of ["越界归档", "脚本链接"]) {
    const unsafeHref = await body
      .locator("a", { hasText: label })
      .first()
      .evaluate((el) => el.getAttribute("href") ?? "");
    expect(unsafeHref).toBe("");
  }

  const popupPromise = context.waitForEvent("page");
  await rawInlineLink.click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await expect(popup.getByRole("heading", { name: "本地原文" })).toBeVisible();
  await expect(popup.locator("#L2")).toContainText("<script>window.rawExecuted=true</script>");
  expect(await popup.evaluate(() => Reflect.get(window, "rawExecuted"))).toBeUndefined();
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
  const hash = /^raw:sha256-([a-f0-9]{64})\.md#/.exec(ref)?.[1];
  expect(hash).toBeTruthy();
  for (const [path, status] of [
    ["/wiki-raw/HANDBOOK.html", 400],
    [`/wiki-raw/sha256-${hash}.html?lines=0`, 400],
    [`/wiki-raw/sha256-${"0".repeat(64)}.html?lines=1`, 404],
    [`/wiki-raw/sha256-${unpublishedHash}.html?lines=1`, 404],
    [`/wiki-raw/sha256-${hash}.html?lines=99`, 422],
  ] as const) {
    const response = await request.get(`${origin}${path}`);
    expect(response.status()).toBe(status);
    const body = await response.text();
    expect(body).not.toContain("first");
    expect(body).not.toContain("UNPUBLISHED-SYNTHETIC-MATERIAL-NO-APPROVED-PAGE");
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
  await context.route("**/wiki-raw/sha256-*.html*", async (route) => {
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

test("pure static vite preview opens raw: snapshot offline without /api backend", async ({
  page,
  context,
}) => {
  expect(
    existsSync(join(process.cwd(), "dist/index.html")) && existsSync(join(process.cwd(), "dist/wiki-raw")),
    "dist/wiki-raw must be generated by pnpm build before preview verification",
  ).toBe(true);
  const expectedDistFiles = [...collectPublishedRawPaths(join(process.cwd(), "wiki"))]
    .map((p) => `${p.slice(4, -3)}.html`)
    .sort();
  const actualDistFiles = readdirSync(join(process.cwd(), "dist/wiki-raw")).sort();
  expect(actualDistFiles).toEqual(expectedDistFiles);

  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const addr = probe.address();
  if (!addr || typeof addr === "string") throw new Error("Failed to allocate preview port");
  const previewPort = addr.port;
  await new Promise<void>((resolve, reject) => probe.close((err) => (err ? reject(err) : resolve())));

  const previewProc = spawn(
    process.execPath,
    [
      join(process.cwd(), "node_modules/vite/bin/vite.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(previewPort),
      "--strictPort",
    ],
    { cwd: process.cwd(), stdio: "pipe" },
  );

  const previewOrigin = `http://127.0.0.1:${previewPort}`;
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(previewOrigin);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        // wait until vite preview listens
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(ready).toBe(true);

    // Block every /api/** request completely to prove static reading never needs a backend server.
    await context.route("**/api/**", (route) => route.abort());

    await page.goto(`${previewOrigin}/#/wiki/quantization`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const staticSourceCheck = page.getByTestId("wiki-body").getByTestId("wiki-source-check");
    expect(await staticSourceCheck.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    const staticFirstH3 = staticSourceCheck.locator(".wiki-source-check-body > h3").first();
    const staticH3Id = await staticFirstH3.getAttribute("id");
    await expect(staticFirstH3).toBeHidden();

    await page.goto(`${previewOrigin}/#/wiki/acl-graph`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto(`${previewOrigin}/#/wiki/quantization#${staticH3Id}`);
    await expect.poll(() => staticSourceCheck.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
    await expect(staticFirstH3).toBeVisible();

    await page.goto(`${previewOrigin}/#/wiki/acl-graph`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const sources = page.getByTestId("wiki-sources");
    await sources.locator("summary").click();
    const rawLink = sources.locator('a[href^="./wiki-raw/sha256-"]').first();
    await expect(rawLink).toBeVisible();

    const popupPromise = context.waitForEvent("page");
    await rawLink.click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    await expect(popup.getByRole("heading", { name: "本地原文" })).toBeVisible();
    await expect(popup.locator("#raw-range")).toContainText("引用第 1–");
    expect(await popup.locator(".selected").count()).toBeGreaterThan(0);

    await popup.getByRole("link", { name: "第 3 行", exact: true }).click();
    await expect(popup).toHaveURL(/#L3$/);

    // Verify client-side out-of-range guard on static HTML files.
    const baseRawUrl = popup.url().split("?")[0]!;
    await popup.goto(`${baseRawUrl}?lines=999999`);
    await expect(popup.getByRole("alert")).toContainText("引用行号越界");
    await expect(popup.locator("#raw-body .line")).toHaveCount(0);
  } finally {
    previewProc.kill();
  }
});
