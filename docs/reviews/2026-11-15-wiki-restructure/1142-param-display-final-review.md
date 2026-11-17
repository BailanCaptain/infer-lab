# 1142 参数展示与来源编号独立终验

砚砚 / gpt-6-astra，2026-11-17 02:21 UTC。原 Task 044；作者最终交付 `0001794881892170-001142-ce271909`，共享入口及测试隔离交付 `0001794881490276-001138-6c056c17`。基于实际代码、精确文件哈希、独立回归及真实 Chromium 操作。

**Approved，0 P1 / 0 P2，仅参数展示与来源编号工程子批。** `1133-param-display-review.md` 的两项 P2 与单一真相源要求均已闭合。原 `1132-real-edit-granularity-review.md` 微分片 P2 仍未修复，原 044、阶段一及全方案均未完成。

## 闭合内容

- 参数展示名从受保护的参数身份派生；`KVPPConfig.size` 保留真实类字段身份，JSON 多层配置显示 parent.leaf；手写参数页原题目不变。稳定 id、文件、原 frontmatter title、aliases 均不改。页头、目录、面包屑、检索、词条与推荐阅读统一消费同一展示值。
- `generatedSection`、参数受保护节与身份解析只有 `src/content/wiki/param-display.ts` 一份纯实现，原 Node 两个入口直接 import/re-export；原导出契约保留，snapshot implementation 指纹已覆盖公共文件。独立检查引用同一性与 lineage/params 保护回归通过。
- 快照测试只读主仓 33 篇参数页与四个 oracle；所有构建、WorkflowStore/快照生产及身份刷新均在 mkdtemp 隔离副本中执行，finally 清理。真实缓存不写、不删、不回滚。
- 文件名仅在真实 file 元数据存在时进入精确匹配表，不进入压平模糊表，不再改变旧 DropDiscovery 普通问题分数及缓存输入。
- 来源列表恢复原生 decimal/list-item 编号；原证据按钮与外链双动作保留。

## 本轮独立证据

产物根目录 `C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/`，所有旧红灯与旧报告保留。

1. `1141-param-cache-tests.json/log`：9 套件 **103 tests passed，exit 0**（retrieve、param-display、reader-store、toc、index、WikiPage、隔离快照、lineage、params/pages）。`1138-param-shared-tests.json/log` 的 6 套件 25 项亦通过；两组存在重叠，不相加虚报总数。
2. `1141-param-final-types.json`、`1142-param-biome.json`（17 文件）、`1142-param-deps.json`：均 exit 0。
3. `1140-param-final-build.json/log`：Node 子进程包装记录真实构建退出码 **0**；`1140-param-final-reader.json` 中 buildPassed/codeUnchanged/formalUnchanged 全 true。独立复制 163 页、只在临时根目录生产 `/nested/` 构建和快照。
4. `1141-parameter-five-query-browser.json/png`：断 API、1440×900，四个真实参数样本的 20 项页头/目录/面包屑/搜索/稳定 URL 检查通过；每页依次使用 id、文件名、相对路径、原题目、别名、展示名，共 24 次查询全部命中正确展示名。errors=[]，closed=true，正式样本 SHA 未变。已实际打开截图复核。
5. `1140-param-cache-resume-observed.json`：真实 258 次批次完整隔离克隆经生产 startDrop，**providerCalls=0，全部258历史调用与不可变回执保持原字节**，首个新帧恢复 drop-edit `[856,909)`；预算、完整规则、notes、target、必需原文及代次保持一致，原批次树零变化。探针的 exit 1 / allPassed=false 仅因另案微分片长度 53 字符仍不满足 meaningfulNextRange；其缓存恢复检查全部 true。不得把这个组合探针写成全绿或将微分片问题隐藏。
6. 沿用字节未变 UI 已独立验证的 `1133-source-numbering-browser.json`（60 来源编号/双动作）、`1134-param-live-browser-v2.json`（18 项真实隔离快照刷新/旧ID/query/中文锚点/历史/懒载/三栏）、`1135-reader-state-browser-v3.json`（7 项图 step=3、精确 pin、横滚、DOM实例、推荐阅读键盘跳转）。后者是合成已保存聊天 DTO 的界面协议验证，不冒充真实模型语义 E2E。

既有桌面 Playwright 两套件正在独立随机端口的同份构建中另行运行；本记录不预报其最终结果。原有 4173/4174/4196 服务未接管、未重启。

## 审定字节

以下17文件在本轮逐一计算；与作者最终声明一致。构建期间这些生产文件保持稳定。

| 文件 | SHA-256 |
| --- | --- |
| src/content/wiki/param-display.ts | 6d97f905b79a78ef4ebaa8bd8f03a2a852116fce780f179505560b6e7700f06c |
| scripts/wiki/lineage.ts | bd5ee4e3c1428fcd1f64552a50ebb3a5ea6e13874d5b438b7e54f75d9e2d0212 |
| scripts/wiki/params/pages.ts | 9a00c44f7ca4a404c27cdcff3203061fb5d99293e3a9c06d2d316bb8302950e2 |
| server/param-display-snapshot.test.ts | b6313ba4d4ee0e4073647c380e6ab7ab6e4625ee22a4b02a4f955a1310d5db99 |
| src/content/wiki/retrieve.ts | 9bbc7895de88cb6bd0d8d7f9d51ac9f17db31c898c61638c5f352cbf0a8da5f3 |
| src/content/wiki/param-display.test.ts | 7261ab19c311f044c5fd7942a189afc1695679e5eddc7d948e21c0856a8bd1d0 |
| src/content/wiki/schema.ts | c3fbc85893827b3f59ccf19ba865d3f43d36f6cfe192b33755605f49f29ac09c |
| src/content/wiki/page-names.ts | 8e6316796f5484622083bceb337bec128d37e7c4a22e46d7ae6996b227cb36f6 |
| src/content/wiki/toc.ts | 97412859f2aa0a6a6003508e0da5aa35640acc46927a5df9b0ea1206b6e6bef9 |
| src/content/wiki/reader-store.ts | 57ad247afb8190c690019c7b5a13a9a6aac1cc22b101f89b508bbe68005071f9 |
| src/content/wiki/Term.tsx | f8ac729f94d009cd59aa3519f7fb2c2f49f4a19ed73cb0f121ab2fa647549e25 |
| src/app/wiki/WikiLink.tsx | ac8896fd5e0e3173649593b6ca9d15f5904f1c063419cee39849b918db4fd58d |
| src/app/pages/WikiPage.tsx | 6465b39688aa1fe4f47b38e2acb9c1ce03f5c9e48d6c3d15fdbf2edabb6061e7 |
| src/app/pages/WikiPage.test.ts | 9e6ac6d9169901ad1ccf95c1bc996307f27ec04b334601e66e7a9494625f1ed7 |
| src/design/wiki.css | fdcc7503b64d27f31ecf8ed69b450cddd877d200efac29f23f75cc103acaf8c0 |
| server/snapshot.ts | 2c80ad2553aaecf4135942bf25f7ff98f13ff51f0fbcf1c6952d60fcc3ae7202 |
| server/related-reading.ts | 7f849c45fe923fb0e792bbe2d12228a235576bab2fec639c3578b26bb73bb601 |

## 下一步与停工边界

沿原 044 下一短轮修复微分片；在隔离克隆证明旧258次缓存零重跑、从856连续承接、必需证据和完整预算规则不减后，才恢复原同代真实 E2E。随后完成 AST 工具/只读预演与四类样本 Review、隔离发布恢复、阅读、真实问答保存/缺口闭环。文章正文、例子、内容纠错全部第二阶段；本阶段最终由砚砚独立签署并发布验收记录及后续清单后停工待令，不派第二阶段或四个独立产品。现有站点服务保持。