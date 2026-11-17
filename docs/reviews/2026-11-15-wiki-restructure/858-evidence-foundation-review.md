# 045 离线证据底座独立复审（858）

2026-11-16，基于作者 000858 与当前实际字节。**Changes Requested，0 P1 / 1 P2**。仅数据底座评审；导航子批既有 Approved 保持，证据 UI 尚未接入。

## P2：越界来源的错误描述反而使整个证据包/构建失败

位置：`scripts/wiki/evidence.ts` 的 `rangeMeta` 与 `out-of-range` 分支、`src/content/wiki/evidence-schema.ts` 的 repo `unavailable` 行号约束。

现有页面解析与 reader 快照接受语法合法的 `vllm@<commit>:a.py#L0-L2`。生成器正确识别 start < 1，却将 lineStart: 0 填进 unavailable 对象；该对象 schema 要求正数，最终 `readerPageEvidenceSchema.parse` 再抛错。于是一个应诚实展示“行号越界”的来源会让整页证据不可读，并使调用 `buildAllLockedEvidence` 的 Vite writeBundle 失败。未知仓库/缺失文件分支也携带同类 rangeMeta，应沿同一入口处理。

**独立可复现证据**：运行 `%TEMP%/infra-wiki-review-20261115/858-evidence-range-probe.mts`，输出 `858-evidence-range-red.json`。隔离 Git 仓与单页快照，原库未改；正常 L1-L2 成功，超尾 L2-L99 返回 unavailable 且 bulk count=1，L0-L2 的 readerKeptPage=true，但单页与整批均抛 too_small，path=entries[ref].lineStart。

建议保留原始 ref 与 out-of-range 归因，只在不可用条目里携带可表示的有效范围元数据，或给错误条目独立定义错误范围表示；不要把 0 修成 1、把错误来源装作 ok、关闭整包验证或放宽 ok 摘录的真实行号约束。补覆盖零起/零止、反序及不可安全表示范围，并核查 unknown-repo/missing-file 等同根分支；证明其他有效来源继续可用、静态构建能完成。

## 已实际通过与范围

- root 实际执行 `node node_modules/vitest/vitest.mjs run src/content/wiki/evidence.test.ts server/evidence.test.ts src/content/wiki/reader-store.test.ts src/content/wiki/schema.test.ts server/reader-build.test.ts server/reader-skip.test.ts scripts/wiki/check-content.test.ts --reporter=dot`：7 files / 33 tests passed，exit 0。
- 已逐读生成器、前端 schema/controller/store、HTTP handler、插件与原 854 baseline 差异。固定 Git blob、原文已发布白名单与哈希检查、pin 独立行范围、静态 fetch 与 live revision 校验设计可继续保留。
- 当前没有 UI 交付，尚不宣称四类样本浏览器证据面板验收完成。全库构建和 UI 应在本项修复后继续。
- 无新模型调用；正式 wiki、3D、原缓存、旧 Review888、既有服务未改。原反例产物保留，修复复验另写 green。

## 审阅字节

HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f`，共享未提交修改以 SHA-256 为准。

| 文件 | SHA-256 |
| --- | --- |
| src/content/wiki/evidence-schema.ts | 75a5693f459dff0bd8449e1e386c40d69508a7ad893e9dde1d668d14738dde6e |
| scripts/wiki/evidence.ts | 5221232f0bcf48f7b19ab50e6c0e8b1630b66afd45fce210a73f5e6e9f45454f |
| server/evidence.ts | b9d12c368d46c059211cde21190aebf485efdf6e29c7cec859e8d1d881af07b4 |
| src/content/wiki/evidence.test.ts | 4240b8f9d99ed2871ceabd449dfe1ce4a3b19cfcfe85f6a3f6ac07a475167b96 |
| server/evidence.test.ts | c07fcd7341c7a006661c6f09b133d8a1489207d3bb433b8a36a93d04c0808451 |
| server/snapshot.ts | 328e7540370bb158ba65eea12eaf2bf59d4a362718a0d7df8b6966d0a1749bcd |
| server/app.ts | a5e664762f23ea1215a2663da711f4b4f25403150ed1a4e8cb1a9344e5b8f0eb |
| src/content/wiki/reader-store.ts | f30d2132aecc5f0f198ad57eb56ec298ab37cc6a7f92954643bcddf5417cc983 |
| src/content/wiki/index.ts | 039d87c36c97b0b1bbe16adf3a49fbdee29ab308a4c37f8c7c711d090c3c1aae |
| src/wiki-snapshot.d.ts | f2f09e72852961ee4e5a97381752cf1264dbe1921251e37e73a02577e8faeafa |
| scripts/wiki/reader-plugin.ts | d29b310d964feeff68e4df8004310c0d7a738e680de8daee603262da037c1e21 |

## 独立加载链补证（2026-11-16 13:11 UTC）

root 另运行 `%TEMP%/infra-wiki-review-20261115/858-evidence-loader-browser.mts`，实际调用本轮 Vite 插件构建隔离两页、内容寻址 raw 样本，以随机 localhost 端口及 `/nested/` 托管，真实 Chromium 操作。`858-evidence-loader-browser/report.json` 11 项 true，pageErrors=[]：首开零证据请求，abort 首次 JSON 后同页重试成功，未取另一页或页面正文 chunk；静态请求零 API，实时版本切换返回新版 raw 内容且旧 revision 返回409，跨站 Origin返回403。浏览器/临时服务均在 finally 关闭，fixture 仅清理经路径检查的专用临时目录。

这只验证数据加载链；样本 HTML 不是实际 WikiPanel，JSON 未执行也不等同于尚未实现的证据 UI 的文本渲染验收。P2 越界范围仍以返修与原反例转绿为准。
## 全库产物与固定来源逐条核验补证

root 隔离 Vite 生产构建 `858-root-full-58483f37346e420cb9bd83b122d41632`，`858-root-full-build.log` 记录 exit 0；`tsc -b --noEmit`、`check-deps.ts` 均 exit 0。163 份证据 JSON 共 39,092,155 B，revision `03d0c97a476b1babf8d27cc0dac131352b79f519a4f59a13e03497388f01cf38`。

随后独立脚本 `858-root-static-pack-audit.mts` 通过 91 次只读 `git show <commit>:<path>`（禁用 lazy fetch）和 `readRawSnapshot` 校验，逐条比对四类真实样本的返回文字、真实行号和总行数，不调用证据生成器作为预期值：共149条本地 repo/raw entry 完全一致，11条 URL 仅 external；量化图的6次异范围pin均有独立entry。报告 `858-root-static-pack-audit.json`。这一结果针对有效正式来源；原越界反例仍待修复，不以正常样本全绿覆盖异常分支。