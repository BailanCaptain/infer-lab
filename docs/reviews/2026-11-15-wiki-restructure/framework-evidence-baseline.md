# 阶段一离线证据面板：现有入口与样本核验

依据唯一方案 §4.2、包 4 及用户 `000741`；这份记录是原 `045` 下一短批的实施前证据，不是平行方案。导航兼容 `813` 正在独立推进，不把本项混入该短轮。

## 已实跑的四类样本

root 执行 `%TEMP%/infra-wiki-review-20261115/framework-evidence-baseline.mts`，同名 JSON 保存结果，exit 0。只读正式页、图规格、固定 Git blob 和内容寻址 raw；未修改正式内容或启动模型调用。

- 全库解析为 **163 页、8,707 条来源**：8,026 条 `repo@commit:path#L...`、162 条 `raw:`、519 条外部 URL；repo 引用全部带行号。页面和图规格解析错误均为 0。
- 四类样本读取源码与 raw 均无缺失或越界；下表为引用范围文本的未压缩字节之和（按每页精确 ref 去重，不是最终资源体积）。

| 样本 | 页 sources | 图 pins | 引用文本字节 | 引用行数 |
| --- | ---: | ---: | ---: | ---: |
| `chunked-prefill` | 51 | 7 | 87,069 | 1,815 |
| `quantization` | 55 | 8 | 158,859 | 3,745 |
| `enable-super-kernel-ce990e186bfa` | 37 | 0 | 46,372 | 926 |
| `inference-troubleshooting` | 12 | 0 | 19,828 | 413 |

量化图有 6 次 pin 使用不同于页 sources 字符串的精确行范围（其中一个范围重复）；现有 `diagram-audit.ts` 只要求同一 `repo@commit:path` 出现在 sources，不能用页来源编号替代 pin 的行范围。实际 blob 和范围均已核实。不要把此结果误称为图来源校验失败。

## 可复用入口与实际缺口

- `src/app/pages/WikiPage.tsx:620` 的编号角标当前直接打开 `hrefOfSource`；repo 跳 GitHub，raw 跳已实现的静态原文页。`WikiPanel.tsx:11` 只有 chat/drop/review/status，尚无 evidence 视图。
- `src/content/wiki/WikiDiagram.tsx` 当前只消费 `id/svg`；`scripts/wiki/diagrams.ts:275` 的 `specPins` 已是统一图来源出口。静态页模块当前只带 SVG，需要按页携带对应 pins/证据资料。
- `scripts/wiki/reader-plugin.ts` 从同一锁定 reader snapshot 拆页，现有 JSON fetch 的失败重试方式可复用。摘录必须绑定这份快照的正式页与图，不在构建尾部重新枚举变化中的 wiki。
- `scripts/wiki/repo-roots.ts` 提供受配置约束的仓库映射与版本 refs；`git.ts` 的 `warmBlobs/createBlobReader` 只取钉住提交的 blob；`audit.ts:35` 的 `sourceLines` 定义真实行号切分。不能读取工作树冒充引用版本。
- `scripts/wiki/raw.ts` 的 `readRawSnapshot` 校验 hash；`raw-viewer.ts` 已有正式引用 allowlist、行范围校验、HTML 转义及纯静态阅读入口。未发布 Review raw 仍沿专用 API 边界，不能因新面板打包进公开资源。

## 下一短批应验证的完整路径

1. 同一 WikiPanel 右列增加证据视图；点击正文编号来源、来源列表或图下“对照源码”可看对应片段、真实行号和版本标识，主文与本页目录不重叠。图多 pin 必须有可选且可识别的具体来源。
2. 构建期按页准备静态资料、浏览器按需读取；断 API、子路径部署、首次失败后重试、跨页/快照切换时旧异步结果不覆盖新选择。打开一页不拉全库来源。
3. 对 repo/raw 展示实际读取的证据；外部 URL 在未有合法已存快照时明确保留外链，不编造离线内容，也不自动联网抓取未知 URL。已知 repo 提供钉住提交的 GitHub 外链；未知仓库不猜链接。
4. 测试越界、篡改 raw、未发布 raw、缺失 blob、HTML/脚本样本文本、pin 与页面行范围不同等实际失败路径；保留来源及 SVG 安全门禁。UI 使用文本节点或既有安全渲染，不让证据内容执行。
5. 在上述四类少量真实样本里验证编号/图 pin/行高亮，并做桌面 1440px 实际浏览器无重叠检查。只做工程必要适配，不全面重写文章；所有 3D 保持冻结。

本记录不表示证据面板已实现；当前只完成实施前只读核验。

## 全库读取补证（2026-11-16 11:49 UTC）

为避免只凭四类样本决定数据加载方式，root 另以同一脚本 `--all` 读取全部正式页面及其实际使用的图 pins；输出 `framework-evidence-full-census.json`，保留原四样本报告不变。163 页、8,707 条 sources 全部参与，页面/图解析错误为 0，本地固定 blob、raw hash 与引用范围检查错误为 0；共 136 次本地 Git 进程调用，没有联网或模型调用。

按每页精确 ref 去重、跨页不去重，摘录合计 **22,061,836 B / 495,934 行**。这是实际选中范围的纯文本规模，不是最终 JSON 或压缩资源体积。最大单页 `api-server-entry` 为 1,226,521 B，随后 `sampling` 871,862 B、`request-call-chain` 570,654 B；因此证据资料应按页/选择按需加载，不能跟首屏主包或检索索引一次加载全库。外部 URL 仍仅保留外链，不能将“无本地读取错误”表述成已保存这些网站的离线全文。
