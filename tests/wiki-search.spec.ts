import { expect, test } from "@playwright/test";

test("目录按标题、别名和参数名筛选，展开参数并能清除无结果查询", async ({ page }) => {
  await page.goto("/#/wiki");
  const toc = page.getByTestId("wiki-toc");
  const search = toc.getByRole("searchbox", { name: "搜索知识库目录" });
  await search.fill("QK-Norm");
  const mlp = toc.getByRole("link", { name: /^MLP、residual/ });
  await expect(mlp).toBeVisible();
  await mlp.click();
  await expect(page).toHaveURL(/#\/wiki\/mlp-residual-norm$/);
  await search.fill("layer_sharding");
  const parameter = toc.getByRole("link", { name: "layer_sharding", exact: true });
  await expect(parameter).toBeVisible();
  await parameter.click();
  await expect(page).toHaveURL(/#\/wiki\/layer-sharding$/);
  await search.fill("不存在的目录条目-closure");
  await expect(toc.getByRole("status")).toContainText("没有匹配的页面");
  await toc.getByRole("button", { name: "清除搜索" }).click();
  await expect(search).toHaveValue("");
  await expect(toc.getByRole("link", { name: /^Sleep Mode：/ })).toBeVisible();
  await expect(parameter).toBeVisible();
});
