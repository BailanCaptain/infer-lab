import type { Page } from "@playwright/test";

export async function openLocalScene(page: Page, kind: string) {
  const detail = page.locator(`details[data-layer-detail="${kind}"]`);
  if ((await detail.getAttribute("open")) === null) await detail.locator(":scope > summary").click();
}
