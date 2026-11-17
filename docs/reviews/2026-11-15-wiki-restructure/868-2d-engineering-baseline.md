# 045 后续 2D 工程入口核查（证据 UI 868 期间的只读准备）

核查时间：2026-11-16 13:31 UTC。沿用户 741 的框架优先顺序，本文只保存下一短批的实际入口与复现，不新增总方案、不把未实施功能计为完成。当前作者仍在实现 868 证据 UI，第 1 段数据底座已由 862-evidence-foundation-rereview.md 审定。

## 当前实测

在隔离 Git 仓的固定提交上运行 `%TEMP%/infra-wiki-review-20261115/868-next-2d-baseline.mts`（exit 0，JSON 为同名前缀 `.json`）：

- 伴生 `{mode: "native-svg", id, caption, size, pins}` 当前被 `diagramSpecSchema` 拒绝，提示 `layout` 只接受 `scene | figure`。
- `links[].bend` 当前被 strict schema 拒绝；已有 `curve` 双控制点仍是唯一弧线路径。`texts[].font: "mono"` 亦被拒绝；这里的 `font` 只是候选输入示例，最终字段接口尚未定义。
- 10 段文字、长句、`select_moe_comm_method` 分别触发三类已有提示，和唯一方案明确要移除的三类吻合；不包含自由画板复杂度/跨图复用建议，后两者不应被顺手删除。
- `pins` 引用的 `line_2` 经真实 `git show <commit>:fixture.py` 读取存在，但因没有重复登记到页级 `sources` 被 `diagram-identifier` 拒绝。
- 将符号换为 `nonexistent_fixture_symbol` 会额外触发 `diagram-symbol`；这是需要保留的 AC11 校验。几何反例仍报告两个框重叠 `50×30px`，几何门禁也应保留。

探针的第一次本地运行因脚本缺少一个闭括号失败，修正探针后得到上述结果；不把脚本语法失败计作产品红灯。

## 已定位的真实入口与必要依赖

1. `scripts/wiki/diagrams.ts` 的 `diagramSpecSchema`、`loadDiagrams`、`specPins`、`renderDiagram` 是共同入口。原生图需要可区分的伴生元数据与同名 SVG，不能只在阅读组件里接一个旁路。
2. `scripts/wiki-diagrams.ts` 当前对每一张图无条件 `renderDiagram` 并比对/覆盖 SVG。原生通道必须识别并保留人工 SVG，检查缺文件、身份与画布等约定；连续运行不得改写人工内容。
3. `scripts/wiki/drop-assets.ts` 的 `stageDropDiagram` 当前只从 YAML 渲染，`validateDropAssets` 当前要求 SVG 等于渲染结果；两处须按通道区分。原生 SVG 与伴生 YAML 仍作为整组 Review 资源，保持来源、公开范围与正向 SVG 清洗门禁，不能通过放宽整组审批绕开。
4. `scripts/wiki/diagram-audit.ts` 的 `auditSpecs` / `specPins` 对所有通道保留固定 blob + symbol 核验。移除“图 pin 必须在页级 sources 重复出现”的限制，需要先完成图下证据入口及精确多 pin 展示；这正是 868 后下一证据 UI 短段的依赖。
5. `server/snapshot.ts`、`scripts/wiki/evidence.ts`、`src/content/wiki/WikiDiagram.tsx` 均消费相同图身份与 pins；原生 SVG 应沿已审正向清洗器进入正式阅读和审阅预览。人工注册交互式 React 2D 使用编译期白名单，不允许 Drop 提供代码、模块地址或动态导入路径。
6. `scripts/wiki/figure.ts` 的弧线渲染与 `cubicPoints` 几何检查应共享同一 bend 到控制点的解释，避免看起来弯了而越界/碰撞检查仍按直线。现有 `curve` 输入与旧图产物保持兼容，显式冲突组合需明确处理。
7. 880 收口后补核真实整合入口：`drop-integration.ts:97`、`:108`、`:121` 的生成、局部编辑、分节生成三个 schema 均分别声明 `{id, yaml}`，`:3189` 也仅向 `stageDropDiagram` 传 YAML。原生 SVG 资源不能只改 `stageDropDiagram` 而漏掉这三种调用；应提取共同的资源输入契约，允许原生通道带同名 SVG 纯数据，保留旧 figure 输入的兼容和 YAML/SVG 整组审批。人工注册 React 2D 是仓库静态白名单，不能把组件代码或模块地址加入这些模型输出。

## 下一批验收依据

- 先完成证据 UI/图 pin 小批，再进入 2D；不混入教学 3D、仿真、模型或硬件探索。
- 原生/figure 两通道经真实静态构建、阅读、审阅资源校验；重复 CLI 不覆盖人工 SVG，缺配套文件可见拒绝。
- AC11 正反例、几何错误、外链/事件/脚本 SVG 拦截保留；bend 正负/零和已有 curve、mono 实际 SVG 渲染纳入验证。
- 人工注册交互式 2D 要有可操作的最小真实实例与未注册 ID 拒绝，不以空注册表冒充交付。
- 桌面 1440px 浏览器实际操作与截图；图画布维持方案的 900px 上限。正式 wiki 与既有服务均未被本次探针修改。

## 894 派工后的独立实物基线

2026-11-16 14:29–14:30 UTC，886 已在 891 独立 Approved，图 pins 阅读前置已满足；894 已沿原 045 派发 figure 增强第一段。以下只读/隔离探针没有与作者并发改动生产代码：

- `894-legacy-diagram-bytes.mts` 在读取前后校验渲染器哈希稳定，实际读取 **351 张**正式图；规格问题为 0，全部渲染结果与在盘 SVG 字节相等。保存 `894-legacy-diagram-before.json`，包括每份 YAML、SVG 与渲染结果的 SHA-256。旧文字中的 355 张不能代替本轮实读数量。
- `894-native-pipeline-probe.mts 894-native-pipeline-baseline.json` 在独立临时库实际运行 `stageDropDiagram`、`wiki-diagrams --check`、连续两次 CLI 生成及 `createReview`/`approveReview` 的资源门禁。当前合法原生 SVG + 伴生 YAML 均因不支持 `mode: native-svg` 被拒；原生 SVG 字节保持不变，批准后的状态仍为 `pending`，目标正式 SVG 没有写入。
- 此探针的 Review 使用 `validate: () => []` 隔离资源门禁，其余内建批准门禁仍执行；它不是材料录入、语义事实核验或问答端到端验收。未来原生通道实现后，还需实际验证安全属性、缺配套文件/身份/画布错误、重复生成保留字节、整组批准与恢复发布。
- 首次探针 CLI 因本地脚本把 Windows 绝对路径直接传给 `--import` 失败；已改为 `file:` URL 后重新取得上述实际 CLI 规格拒绝。有效证据是 `894-native-pipeline-baseline.json`，不是首次含 loader 错误的 `894-native-pipeline-red.json`。

上述文件均位于 `%TEMP%/infra-wiki-review-20261115/`，独立库 `894-native-pipeline-U5wYDw` 保留用于复核。原生产库、旧 888 Review、原 210 缓存与既有服务没有写入。

## 902 原生 SVG 入口的独立 XML 反例

figure 子批已由 `897-figure-foundation-review.md` 审定，900 登记 Approved；902 进入原生 SVG 第 1 轮共同契约与 CLI。root 在作者实现期间仅创建隔离验收输入，未修改生产代码。

`902-native-acceptance-cases.mts 902-native-acceptance-baseline.json`（exit 0）创建 20 个配套/身份/画布/XML/安全属性案例，目录 `902-native-cases-V5Nu1J`。实际 Chromium `DOMParser(..., "image/svg+xml")` 拒绝缺闭标签、错配闭标签、重复属性、无引号属性、未转义 `&` 五类输入，而 parse5 的 HTML 解析均可恢复出 svg 元素。现有清洗器单测使用的 parse5 FakeDOMParser 不提供 XML 合法性保证；原生通道不能只据此接受损坏原文。共享 `ALLOWED_TAGS` / `allowedAttribute` 仍是属性值安全规则的单一出处。

基线运行时 `supported=false`；此时坏案例被拒仅证明原生 schema 尚未实现，不计为安全负例已通过。实现后使用同脚本 `--cli <新的报告名>.json` 复验：合法输入 `--check`、连续两次生成均成功且字节不变，其余配套/画布/安全/XML 反例明确失败并不改原 SVG。浏览器仅在 about:blank 中调用 DOMParser，无外部抓取、付费模型或原库写入，浏览器已关闭。

## 910 原生图发布机制依赖复核

907 第 1 轮由 `907-native-svg-foundation-review.md` 提出 2 项 P2，910 正在同作者返修。root 在此期间只读下一段入口，并用 `910-native-review-baseline.mts 910-native-review-valid-raw.json` 在独立库 `910-native-review-MyC0DA` 实跑正常 `createReview` / `approveReview`，**未传 `validate: () => []`**。隔离材料经 `saveRawSnapshot` 固定哈希，候选页、原生 SVG、伴生 YAML 组成一个 Review。默认 lint、来源核验及资源门禁通过；`afterWrite` 在 SVG 写入后受控抛错，状态保持 `publishing`；再次 `approveReview` 恢复至 `published`，SVG/YAML/正文均与待审字节一致，`validateIntegration=[]`（exit 0）。既有发布恢复机制可复用，无需为原生图新建发布旁路。

第一次 `910-native-review-baseline.json` 因探针只引用 `example.invalid` 被正常 `source-domain` 门禁拒绝，保持 `pending` 且零正式资源写入；这是夹具缺乏合法来源，不是产品失败。补充真实隔离 raw 材料后取得上述成功证据。两份报告均保留。

此项仍是手工组装的隔离 Review，**不是 Drop 调用链、模型事实复核或四类问答 E2E**。下一段必须验证 `drop-integration.ts` 的 generated/edited/section 共用资源契约、真实 caller 向 `stageDropDiagram` 传 SVG、坏配套与注入拒绝、整组 Review 及浏览器实际消费，不以本基线替代这些未完成项。
