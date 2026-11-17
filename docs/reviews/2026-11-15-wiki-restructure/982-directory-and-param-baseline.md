# 044 第一阶段工程项：只读验收基线

依据唯一方案包 5 工程范围与用户 `000969`。本文件仅记录现有入口、可复现问题和验收依据，不是新的总方案，不启动阶段二正文重写。代码仍由烁烁实现、文档由墨墨维护、砚砚独立检视。

## 目录与 2A 导览

root 实跑 `%TEMP%/infra-wiki-review-20261115/982-directory-engineering-baseline.mts`（exit 0），结果同名 `.json`。它只读 `loadPages` 并调用生产 `buildToc`；当前正式库 163 页，解析错误 0，目录 163 项且无重复。

- `src/content/wiki/toc.ts:55` 的开篇次序仍为 learning-guide → glm-5-3-flash → one-request → concurrent-requests；实际 `one-request` 位于第 3 项，而其正文称为“上一页”的 `glm-5-3-flash-two-node` 在第 89 项。`request-overview` 尚不存在。按后续用户 993，本阶段只实现目录与可选导览槽位；新增概览或修改现有导览正文留到第二阶段。可选槽位用内存/隔离夹具验证。
- `src/content/wiki/toc.ts:225` 的 RFork 前缀规则把真实 `type: source` 的 `rfork-official-guide` 放进“RFork 工作版 / 工作版机制与维护”。修复应保持来源身份与显式编排语义，普通 RFork 机制页仍留在原专题，并保持每页恰好一次。
- 现有 low-precision-formats 通过显式 `toc` 插在 quantization 之后；基础路线验收需同时覆盖静态主目录与显式放置页，不能只测试一组没有 `toc` 的合成页面。
- `one-request.md` 原 ID、`#一条请求要走过七站`、请求 R1 及被引用锚点都要保留。当前正文中锚点存在，`R1` 出现 62 次；次数只用于基线定位，不作为事实完整性通过标准。内容保护仍核实际段落与锚点。

实际浏览器验收须看到导览入口、目录、页头必要的 builds-on 前置阅读、前后翻页和旧 URL/中文锚点相互一致。按用户 993，不修改任何文章正文；写入、审核、发布演练只用隔离副本。内容整改一律留待，不作为工程验收的前置。

2026-11-16 19:44:47 UTC 附加只读反例：`%TEMP%/infra-wiki-review-20261115/1000-directory-order-probe.mts` 实跑 exit 1，报告 `1000-directory-order-red.json`。163 页仍各出现一次，17 页显式分组位置仍正确，正式页摘要未变；学习依赖顺序、双机案例后紧接 `one-request`、RFork 来源归位、可选概览槽位和前缀不抢占 source/pr/param 五项未满足。反例还保存了全部含显式页的组内原顺序与 order 值，供代码作者校正合并规则；不以统一排序破坏已有学习依赖。

20:05:28 UTC 在独立全库夹具 `1024-directory-wE2SQu` 的生产构建上运行 `1024-directory-browser.mts 1024-directory-root-red2`，exit 1：实际浏览器重现学习顺序、one-request 位置、前置导览缺失和翻页前驱四项失败；163 页唯一性、既有 legacyId/query/中文锚点/单步后退与前进、1440px 推挤布局仍通过，pageErrors 为空，临时服务和浏览器均关闭。正式文章未变；仅在隔离 one-request 的 frontmatter 增添测试旧 ID，正文原字节不变。首次 red 目录另有探针嵌套函数的 __name 序列化错误；已只修探针并以上述 red2 完整复跑，不将该脚本问题计作产品缺陷。构建与夹具脚本为 `1024-directory-fixture.mts`，已有报告不得覆盖。

## 参数展示与稳定身份

已有 `%TEMP%/infra-wiki-review-20261115/framework-param-display-baseline.json` 独立隔离反例：稳定 ID `size-441e6e7d4b28` 原标题 `size` 可以解析身份，单把展示标题换为 `npu_compilation_config.size` 会令 `parameterPageId` 报“参数身份映射目标不匹配”，并使谱系查找从 `size` 变成 `null`。自动生成段在探针内保持不变，正式库写入 0。

实现应在生成、身份绑定、谱系和阅读展示之间建立同一套明确映射，不用批量重命名 ID 掩盖标题耦合。验收包括：嵌套同名叶子区分、原稳定 ID 与文件名不变、原/新参数显示名检索、谱系版本定位、问答引用、既有自动区刷新路径；单靠阅读页标题截图不足以通过。

2026-11-16 20:14:52 UTC，root 补跑 `1031-param-provenance-probe.mts`（`1031-param-provenance-red.json`，exit 1）。在独立 Git 仓固定 blob 的两个同名 `size` 定义上，仅更换合成展示标题、自动区原字节不变：旧短标题可完成身份绑定、固定定义恢复及已确认旧页刷新；带父级的展示标题在三个入口均失败。两个定义仍保有不同稳定 ID。此探针的父级标签只测试显示与身份解耦，不认证实际可写配置路径；产品应以固定定义、明确绑定和完整路径为身份依据，不能通过删掉父级重新落回同名歧义。

## 基线文件摘要

| 文件 | SHA-256 |
| --- | --- |
| `src/content/wiki/toc.ts` | `afc0b6057dbf6ac7732b509882415dd8e4978336ff21bdd6fd2b4238688e8691` |
| `src/app/pages/WikiPage.tsx` | `b0bb9ffd2734ac581061aca8f7e6c68c06403e912adc0ae113d3e9668b6a3ae3` |
| `wiki/concepts/learning-guide.md` | `1734588c180e91bc4c0fb4afc4e20a73704791837c436808bab758de3a91a780` |
| `wiki/concepts/one-request.md` | `cb5e5fed9b9b02a7b98b4aadc5b48063b40edceca30ae4a1044ee21dea8da20f` |
| `wiki/sources/rfork-official-guide.md` | `3de2493bc563eeeee09e4047bb62438bb97b644aec569aa35ca6d923f1bea589` |

本轮只有只读检查和证据落盘；上述工程尚未实现或验收。第一阶段全部验收由砚砚签署后即停止派工，阶段二继续保留未启动。

## AST 迁移只读预演的输入边界

root 后续实际运行 `%TEMP%/infra-wiki-review-20261115/993-ast-migration-readonly-baseline.mts`（exit 0，同名 JSON 保存逐页坐标），复用阅读器的 `WIKI_REMARK_SYNTAX_PLUGINS` 解析 163 页，解析错误 0，运行前后全部正式页摘要一致。本探针只盘点节点，不生成迁移正文或发布包。

- 排除代码、链接、定义、HTML、数学节点及参数页受保护尾部后，125 页包含 1,127 处匹配 `来源 数字` 的文本表达式，其中 473 处为范围或列表。例如 `来源 48–51`、`来源 39–42、45`，不能只替换首个编号或只保留范围端点。
- 自动生成保护尾部内另有 139 处此类表达式，应保持原字节，由既有确定性同步入口管理，不能纳入正文自动替换。
- 探针另记录 36 页以加粗版本对照前缀开始的段落。这只是明确 AST 条件下的定位，不是完整语义分类，也不替代原计划中历史统计。版本段迁移需要保留其标题层级、条件、来源、代码和被引用锚点，不能按关键词删除。
- `scripts/wiki/sources.ts` 的粗分类 `repo` 也包含仓库内文档路径；将旧来源标记改为可点击引用时，不应把所有 Git 路径一律升级成已核源码证据等级。来源映射、完整编号范围及需要人工判定的条目应出现在预演报告中。

第一阶段工具验收应具备确定性差异、原文件摘要、保护区核对、重复运行一致性与正式库零写入的实际证据；全库内容应用仍留待阶段二授权。
