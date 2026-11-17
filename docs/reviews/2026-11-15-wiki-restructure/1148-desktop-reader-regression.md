# 阶段一桌面阅读器回归：生产阅读与开发样本

砚砚 / gpt-6-astra，2026-11-17 02:24 UTC。基于 `1142-param-display-final-review.md` 的审定生产字节。当前工程验证，不是阶段一最终签署。

**结论：现有两套 Playwright 中授权范围内的 52 项桌面用例均获得实际通过证据。** 50 项在隔离生产构建通过；另 2 项原本访问仅开发模式开放的样本路由，在独立开发服务补跑通过。用户 248 明确排除的两个手机用例未执行。未删改测试或降低断言。

- 命令入口：临时 `1141-isolated-playwright.mjs 1140-param-final-reader.json 1142-desktop-reader-regression wiki-reader-ux.spec.ts wiki.spec.ts`；实际子进程执行 Playwright 原测试文件、单 worker、无重试、`--grep-invert 手机`。复制的163页与 `/nested/` 生产资源仅由随机端口 `127.0.0.1:49700` 提供；所有未被各测试本地 fixture 拦截的 `/api` 返回503，不接真实模型或写服务。
- `1142-desktop-reader-regression.json` / 完整 report/log：50通过、2失败、exit1，保留原产物；目录组记忆/焦点、1440/1920居中与拖拽侧栏、来源编号、路由/锚点/后退、桌面字体/表格/算式、问答/保存/状态UI协议均通过。其中 `wiki-reader-ux.spec.ts` 8/8通过。
- 两项失败根因是验收环境：`tests/wiki.spec.ts:1232` 算式旧格式和 `:1514` 纯文本格对齐都访问 `/#/dev/wiki-specimen`；`src/app/App.tsx:70` 明确只在 `import.meta.env.DEV` 注册该路由，生产构建不应包含它。因此原失败记录不被写成产品全绿，也不要求向生产开放开发路由。
- 补跑 `1148-dev-specimen-check.mts`：使用已有隔离内容根目录，Vite Node API 随机端口 `127.0.0.1:54368`，NODE_ENV=development，reader插件根和Vite缓存均隔离，禁止API代理；以原断言和 `--grep 算式块：冒号旧写法|纯文本块按字符格对齐` 精确选择上述两项。`1148-dev-specimen-browser.json` / log/report 显示 **2/2通过，exit0，flaky0**。
- 两次运行真实模型调用0；临时HTTP/Vite服务与浏览器均关闭。未接管、停止或改变4173/4174/4196。

全部产物位于 `C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/`。微分片P2、AST只读预演和四类真实整合/问答闭环仍继续，文章整改留第二阶段；最终独立签署后停工。