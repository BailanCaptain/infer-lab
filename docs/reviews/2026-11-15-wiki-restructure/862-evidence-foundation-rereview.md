# 045 离线证据底座独立复验（862）

2026-11-16，承接作者 000858 与 000862 同根 P2 返修。**下列实际字节 Approved，0 P1 / 0 P2；仅数据底座通过，证据面板 UI、045 其余子项与框架整体验收未完成。**

## 修复与独立复验

`normalizeRequestedLineRange` 统一认定 1-based 安全整数且有序的范围。错误范围保留原 ref，已存在 blob 返回 unavailable/out-of-range，不伪造起止行；unknown-repo / missing-file / invalid-commit 继续保留各自原因，省略不可表示的范围元数据。无效范围的 GitHub 链接回到对应固定文件而非生成 L0 或指数形式锚点。ok 摘录仍要求合法行号与实际行数一致，未放宽真实性门禁。

- 原独立反例 `858-evidence-range-red.json` 保留；`862-evidence-range-probe.mts` 复跑输出 `862-evidence-range-green.json`：L0-L2 与超安全整数均返回 unavailable，单页和整批不再抛错；L1-L2 正常摘录、L2-L99 的越界结果均保持。
- root 运行 `vitest run server/evidence.test.ts src/content/wiki/evidence.test.ts src/content/wiki/index.test.ts --reporter=dot`：**3 files / 19 tests passed，exit 0**（`862-root-evidence-tests.log`）。包含坏范围与好 repo/raw 同页共存并实际调用 Vite build；覆盖零起、零止、反序、超安全整数及未知仓库/缺文件/错误 commit 分支。
- 返修后 `tsc -b --noEmit` exit 0；全部11文件 `biome check` 0错误/警告。

## 底座总体证据与限制

- 858 首轮 root 相关7套33测试、类型检查、依赖检查均 exit 0。与返修19测试有重叠，不累加为独立用例总数。
- root 独立 Chromium 数据加载链11项通过：/nested/ 静态首开零证据请求、第一次网络中止后同 URL 重试、仅加载所选页且不取正文 chunks、live 精确版本、旧版本409和跨站403；`858-evidence-loader-browser/report.json`，pageErrors=[]。这是加载链，不冒充真实 WikiPanel 视觉验收。
- root 全库隔离生产构建 exit0，163份JSON共39,092,155 B（`858-root-full-58483f37346e420cb9bd83b122d41632`）；构建基于返修前有效来源。返修后另由混合坏/好来源 Vite 用例验证改动分支，未重复无关全量构建。
- `858-root-static-pack-audit.json`：独立91次只读 git show 与原文hash读取，逐条比较四类真实样本149条本地摘录的文字、真实行号与总行数；11条外部URL仅外链。量化6次不同于页来源的图pin范围均正确保留。
- 来源配置映射、固定blob、已发布raw白名单与hash、同一reader revision、每页JSON按需读取、store跨版本响应防护均保留。缺失材料显示真实不可用，不从网络擅自抓取。
- 下一轮实际接线 WikiPanel/WikiPage/WikiDiagram/EvidencePane，验证四类样本入口、多pin、行号及1440px无重叠、文本不执行、焦点/失败恢复。该轮不以四篇教学重写为前置。
- 本轮没有模型付费调用；正式wiki、3D、仿真、原210缓存、旧Review888、已有服务未修改；隔离临时服务/浏览器均结束。

## 审定字节

HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f`；未提交内容必须以下列SHA-256而非仅HEAD识别。

| 文件 | SHA-256 |
| --- | --- |
| src/content/wiki/evidence-schema.ts | 0019269b6a45649ed74035ce5720cdd1198d070a59946079630a0c869171884b |
| scripts/wiki/evidence.ts | e7e5e12ca8da4dcac074e9fb134dfd6df5bf3a09cc374475020d5088e272c5e3 |
| server/evidence.ts | b9d12c368d46c059211cde21190aebf485efdf6e29c7cec859e8d1d881af07b4 |
| src/content/wiki/evidence.test.ts | dc36a1741a2918f36f758139af53c0b02cdaa527ceb8d67ad747be810d0bc2d2 |
| server/evidence.test.ts | bedfeacfb9e69438f216d9777461d60c284f0229a2651d8ced789bb905dfee83 |
| server/snapshot.ts | 328e7540370bb158ba65eea12eaf2bf59d4a362718a0d7df8b6966d0a1749bcd |
| server/app.ts | a5e664762f23ea1215a2663da711f4b4f25403150ed1a4e8cb1a9344e5b8f0eb |
| src/content/wiki/reader-store.ts | f30d2132aecc5f0f198ad57eb56ec298ab37cc6a7f92954643bcddf5417cc983 |
| src/content/wiki/index.ts | 039d87c36c97b0b1bbe16adf3a49fbdee29ab308a4c37f8c7c711d090c3c1aae |
| src/wiki-snapshot.d.ts | f2f09e72852961ee4e5a97381752cf1264dbe1921251e37e73a02577e8faeafa |
| scripts/wiki/reader-plugin.ts | d29b310d964feeff68e4df8004310c0d7a738e680de8daee603262da037c1e21 |

作者随后在 000865（0001794835165853-000865-fc84884b）交付相同11文件摘要；4个返修SHA与本报告逐字一致，其余7文件未变。该回执与root864在途交叉，不重复跑已过检查。868已建立原045下一UI短轮派工。
