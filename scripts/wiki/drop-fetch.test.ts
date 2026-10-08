import { expect, it } from "vitest";
import { extractHtml, fetchDrop, publicAddress } from "./drop-fetch";

it("extracts static content, code and tables while reporting unread media", () => {
  const result = extractHtml(
    "<html><nav>menu</nav><main><h1>缓存资料</h1><p>这是足够长的正文，解释缓存和队列之间的关系。".repeat(1) +
      '缓存需要版本条件和明确的来源，不能因为上传时间较晚就推翻现有结论。阅读材料后需要保存实际正文和链接。</p><pre>run --cache</pre><table><tr><th>版本</th><th>值</th></tr><tr><td>v1</td><td>2</td></tr></table><img src="x.png" alt="分组图"><script>secret()</script><a href="/docs">官方文档</a></main></html>',
    "https://example.com/page",
  );
  expect(result.text).toContain("| 版本 | 值 |");
  expect(result.text).toContain("run --cache");
  expect(result.text).not.toContain("secret()");
  expect(result.text).not.toContain("menu");
  expect(result.text).toContain("https://example.com/docs");
  expect(result.omissions.join()).toContain("未解析");
  expect(() => extractHtml('<div id="app"></div>', "https://example.com")).toThrow("正文不足");
});
it("rejects local/private and alternative IP encodings before any request", async () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.2",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "2002:7f00:1::",
  ])
    expect(publicAddress(address)).toBe(false);
  expect(publicAddress("8.8.8.8")).toBe(true);
  for (const url of [
    "http://127.1",
    "http://2130706433",
    "file:///etc/passwd",
    "http://user:pass@example.com",
  ])
    await expect(fetchDrop(url)).rejects.toThrow();
});
