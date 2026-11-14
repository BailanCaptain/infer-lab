import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const registry = JSON.parse(readFileSync("src/content/wiki/registry.json", "utf8")) as {
  pages: { id: string; title: string }[];
};

test("记录长页首次打开与再次切回的时间", async ({ page }, info) => {
  // Measure the article bundle without a different API publication changing it mid-sample.
  await page.route("**/api/wiki/pages", (route) => route.abort());
  await page.goto("/#/wiki/learning-guide");
  await expect(page.getByTestId("wiki-body")).toBeVisible();
  const samples = [];
  for (const id of [
    "one-request",
    "glm-5-3-flash-two-node",
    "collective-communication",
    "chunked-prefill",
    "one-request",
    "glm-5-3-flash-two-node",
    "collective-communication",
    "chunked-prefill",
  ]) {
    const start = performance.now();
    await page.evaluate((id) => {
      location.hash = `/wiki/${id}`;
    }, id);
    await expect(page.locator(".wiki-article h1")).toHaveText(registry.pages.find((p) => p.id === id)!.title);
    await expect(page.getByTestId("wiki-body")).toBeVisible();
    await page
      .getByTestId("wiki-body")
      .evaluate(
        () =>
          new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
    samples.push({ id, ms: Math.round(performance.now() - start) });
  }
  console.log("NAVIGATION_SAMPLES", JSON.stringify(samples));
  await info.attach("navigation.json", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
});
