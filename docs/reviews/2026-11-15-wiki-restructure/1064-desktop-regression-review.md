# 阶段一桌面回归：来源列表编号回归

2026-11-16 22:48 UTC，砚砚。此为阶段内工程回归记录，不是阶段一最终验收。文章正文与正式来源零修改，现有 4173 / 4174 / 4196 服务未用于本次测试。

## P2：证据列表失去编号，来源 N 无法直接对照

`src/design/wiki.css:3201` 的 `.wiki-source-item { display: flex }` 覆盖原生有序列表项目；`src/app/pages/WikiPage.tsx:807` 仍使用 `<ol><li>`，但没有其他可见编号。结果是文末六十条来源只剩地址，读者无法直接对应正文引用的来源序号。根因是新增“面板打开 / 外链打开”双动作时改变了 `li` 的布局角色。

原有 `tests/wiki.spec.ts:463` 直接复现：第 1 项 `display` 实际为 `flex`，应保持 `list-item` 与 decimal 编号。独立真实 Chromium 探针 `1064-source-numbering.mjs source-numbering-confirmed-red` 再次复现，exit 1（预期红灯）：`sourceCount=60`、`numberingLost=true`；首项外部来源卡仍可正常打开，`pageErrors=[]`，临时服务和浏览器已关闭。截图已目视核验，确无数字前缀，不能将其当作仅测试实现细节差异而删断言。

产物：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/1064-desktop-lzBcqo/source-numbering-confirmed-red.json` 与同名 PNG。保留编号与双动作，同时验证编号、角标地址和来源索引逐条对应；本问题应在阶段一闭合，不涉及文章整改。

## 已跑的桌面回归与环境差异

独立复制 163 篇正式页及来源、图资源，构建生产包，随机本机端口、API 返回 503。`1064-desktop-regression.mts --execute-once` 使用独立 Playwright 配置，没有继承仓库固定的 4173 服务。运行 49 项桌面测试，46 项通过、3 项失败，原始命令 exit 1；正式页与读者代码摘要前后不变，服务关闭。配置按用户 248 仅排除五项手机测试，其余测试原文未修改。

其中两项失败访问 `/#/dev/wiki-specimen`，该路由按 `App.tsx` 契约只在 DEV 存在。第一次开发复验仍继承了宿主 `NODE_ENV=production`，因此仍是 404；确认环境根因后只在隔离进程中设置 `NODE_ENV=development`，回读 `server.config.isProduction=false`。`dev-specimens-v2/results.json` 记录原两项测试均通过（Playwright 子进程 exit 0，20.3 秒），API 仍关闭、真实模型调用为零，服务器已关闭。外层 PowerShell 重定向工具回执为 exit 1，未据此宣称整个脚本门禁 exit 0；测试结论来自子进程退出码与原始结果文件。

因此，49 项桌面测试当前按适用环境验证为 48 项通过、1 项来源编号工程回归。生产构建、两次开发环境检查、失败 trace 和截图均保留于临时目录；不将此次提前回归当作参数 UI、迁移工具或四类真实样本全链路已经完成。最终受后续改动影响的检查仍须复验。
