import { expect, test } from "@playwright/test";

const error = "AttributeError: 'AscendReplicatedLinear' object has no attribute 'weight_scale'";
const source = "if self.wq_b.weight_scale is not None:\n    scale = self.wq_b.weight_scale\n";

for (const width of [1440, 390]) {
  test(`报错提问与 Markdown 代码展示 ${width}px`, async ({ page, context }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(
      ({ error, source }) => {
        localStorage.setItem(
          "wiki-chat-history-v1",
          JSON.stringify({
            version: 1,
            input: "",
            msgs: [
              { key: "q", role: "user", text: `${error} 这个报错在社区中存在吗` },
              {
                key: "a",
                role: "agent",
                status: "complete",
                text: `这种 \`${error}\`，出错位置是 \`sfa_v1.py\` 的 \`indexer_select_post_process\`，读取 \`self.wq_b.weight_scale\`。\n\n示意代码：\n\n\`\`\`python\n${source}\`\`\``,
              },
            ],
          }),
        );
      },
      { error, source },
    );
    await page.goto("/#/wiki/sequence-parallel");
    await page.getByTestId("chat-open").click();
    const question = page.locator(".wiki-chat-msg.is-user");
    await expect(question).toContainText(error);
    await expect(question.locator(".wiki-chat-author")).toHaveCount(0);
    const prose = page.locator(".wiki-chat-prose");
    await expect(prose.locator("p code").first()).toHaveText(error);
    await expect(prose.locator("p code").nth(1)).toHaveText("sfa_v1.py");
    const block = page.getByTestId("chat-code-block");
    await expect(block).toContainText("python");
    await expect(block.locator("pre")).toHaveText(source);
    await block.getByRole("button", { name: "复制代码", exact: true }).click();
    await expect(block.getByRole("button", { name: "已复制", exact: true })).toBeVisible();
    await page.getByTestId("chat-input").fill("继续核对这个报错");
    await expect(block.getByRole("button", { name: "已复制", exact: true })).toBeVisible();
    // Windows clipboard converts LF to CRLF; compare the code without that platform convention.
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\r\n/g, "\n")).toBe(source);
    const log = page.getByTestId("chat-log");
    expect(await log.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByTestId("chat-drawer").screenshot({ path: info.outputPath("chat-code.png") });
  });
}
