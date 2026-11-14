# large-scale-ep 独立教学审查

审查日期：2026-11-10。审查者：本轮新的独立审查代理 `continuation_ep_review`。只读教学页面与图规格；本文件是唯一写入产物。依据为 `AGENTS.md`、`docs/wiki-writing-standard.md` 和接续计划；纯文档审查，未启用 Ponytail，未启动子代理。

**首轮结论：文本审查发现 1 个 P1、6 个 P2，尚不能验收。** 后续定向复审已关闭 R1 的文本概念错误，补读又发现 R8、R9 两个 P2，见本文末尾的增补记录。其余问题按下列证据修订并自查；SVG 生成和浏览器验收仍须完成。这里不把写手的 43 项初判、历史报告或旧 SVG 当作本轮独审结论。

## 读取范围与检查点

- 完整阅读当前 `wiki/concepts/large-scale-ep.md`（418 行），以及 `large-scale-ep.yaml`、`large-scale-ep-flow.yaml`、`large-scale-ep-deploy.yaml` 全部规格。
- 阅读本批三份 diff 与 `large-scale-ep-judgments.tsv`。正文 diff 因行尾差异把全页呈现为替换，因此另从 `before.zip` 读取同一页面，用 Python `splitlines()` 后作 unified diff，逐块核对实际语义改动；没有据此批量改写正文。
- 阅读来源摘录 1–26、28–37、39–43；来源 8 另用固定 Git 原文 L224–282 核对，21、33、37 对修订后的扩展范围补读。44 只读取“与 43 字节相同”的归档描述，没有把描述计为又读一份原文。27 的外部模型配置与 38 的完整 raw 归档未在此次独审重新全文阅读；不对这两项作新的认证。
- 交叉核对 DP 页的定义与请求归属（L114–166），EP 页的示意、逻辑载荷、GLM 路由与场景 M（定向读取 L140–264、L428–546 相关段落及全部标题），部署页的单/双机子账（L159–181）、硬件页的设备边界说明，以及并发页、one-request 的目标标题。没有把这些定向阅读写成相邻页面全部重新验收。
- 定向查看固定 Git 树、文档版本 diff、配置工厂与配置装饰器、rc2 上游启动校验。具体范围和结论见下文。
- 未打开浏览器、未查看本轮生成 SVG、未运行 NPU。尚未运行本批的 build/lint/audit/diagrams 检查；这些由主任务在修订及生成后统一执行。

本报告行号对应以下读取检查点；后续编辑后请按引文文本定位：

| 文件 | SHA256 |
| --- | --- |
| `wiki/concepts/large-scale-ep.md` | `b44fa65f3a6cccc4c9b2cd5ac7824a130553695f164ffc12441553ad5803cbfd` |
| `wiki/diagrams/large-scale-ep.yaml` | `ef204fb319d477e044752e414f85922bb1cb049e4356bd8e32b830ff65b838ef` |
| `wiki/diagrams/large-scale-ep-flow.yaml` | `b5aac85dbfbc185141dc48868be69cfd5ab477ead5704c409a416dfc4a9f3228` |
| `wiki/diagrams/large-scale-ep-deploy.yaml` | `f8125a0fb9daaa1b39291027d18b8d77b74e1d6221b07571adf20cfaf610cf7c6` |

## 必须修订的问题

### R1 · P1 · 首图解释把 DP 写成拆分同一请求的 token

**位置：** 正文 L125；对应首图的两机源 token 分布。

**问题与影响：** 文本先说一句「我吃了苹果」被切成 4 个 token，再说这些 token 分在两台机器，并解释为“请求本来就由 DP 分给不同的卡去算 attention”。读者会得出 DP 把同一请求的 token 拆给不同执行组的错误结论。DP 页 L116、L122 明确“同一请求归属一个组”“DP 不切请求”；EP 任意源卡分布示意不能用 DP 拆句解释。这是核心概念冲突，按写作标准为 P1。

**复现：** 连读本页 L125 与 `data-parallel.md` L116–122，尝试回答“这四个 token 属于一条请求还是四条请求、DP 到底分配什么”。两页当前无法给出一致答案。

**修法：** 保留首图的专家分配、路由和 7/3 份计数。将四个词明确写为示意 token 标签，可来自四条不同请求；说明 DP 分配完整请求，图从 MoE 入口观察各源卡已有的 token，不模拟一句话的 attention 被 DP 拆开。EP 页 L196 也借用同一句话作标签，建议同步加一句“这里只示意 MoE 源 token 分布，不表示 DP 拆分同一请求”，防止回链重新引入误读。首节顺带就地解释 token、专家和 router 的作用，避免初学者必须先打开链接才能理解图。

### R2 · P2 · “默认一个前端”的修订没有贯穿正文

**位置：** 正文 L182 的“只起一个 API server”，L324 的“外置 rank 走最后一种”；流程图已改为“默认起 1 个”。

**证据：** `vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L99-L148` 仅在 `api_server_count is None` 时为 external 默认设 1；显式值大于 1 会进入 L143–144 的 `run_multi_api_server`。local DP 个数为 1 不限制 API server 进程数只能是 1。

**影响与复现：** 以 external rank 且显式 API server 数为 2 代入固定分支，代码走多个前端，而正文宣称只能走单前端；读者会再次混淆端点、前端进程和引擎数。

**修法：** L182 改为默认 1 个前端，明确可显式调整；L324 写默认情况下的落点，并保留显式多个前端的分支。L362 的“只起一个 API server”也须改为默认数的推断/设置，避免同一绝对化说法残留。

### R3 · P2 · 三版表加一段 rc2 跳过同步条件不足以覆盖本页的四版事实

**位置：** 正文 L367–381，尤其 L371–379 的版本表。

**问题与影响：** rc2 段仅覆盖逐步 DP 元数据同步。文档修正、纯 DP proxy、PD proxy、Mooncake 端口、外置启动校验、未知配置键、通信选择这七行都没有 rc2 对照。读者无法判断 rc2 是否仍会拒绝旧配置、是否还需自写纯 DP 路由。L378 的 main“拒绝，启动报错”还丢掉了上文 L349 已保留的 Omni 例外。

**已补读的依据：**

- 固定 seed 中 rc2 是 Ascend `7d825229`，配套 vLLM `ced6857a`，不能拿 main 的 `84030bbe` 代替。
- `git diff baa023ad 7d825229 -- docs/source/user_guide/feature_guide/large_scale_ep.md` 无差异；四版本目录树的纯 DP proxy 存在性见补证记录。
- `vllm@ced6857a:vllm/engine/arg_utils.py#L2223-L2258` 保留 fault tolerance 依赖 external、DP>1 的 dense 拒绝以及 external rank/local 个数的 ValueError。
- `vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1893-L1912` 保留可发现 vllm_omni 时过滤未知顶层键的分支；`config_utils.py#L43-L48` 仍用 extra=forbid。
- main→rc2 的 PD proxy diff 改动请求 ID 与 decoder 释放防重；不能把“挑法一致”扩写成“整个 proxy 没变”。

**修法：** 扩为逐项四版表或等效的逐项明确说明；重复的规则允许写“与 main 相同”，但必须实际核过该行。未知顶层键一行保留 Omni 条件。Mooncake 的 rc2 消费位置和四版 proxy 挑法仍需写手补相应固定引用，本报告不以文件 diff 的行数认证这些未逐段展开的消费者。

### R4 · P2 · A3 超容量回退漏了融合模式 1 的例外

**位置：** 正文 L207 和 L353。

**证据与复现：** `vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L255-L282`：令 token 数大于 capacity、融合模式为 1、EP world 不超过 32，L277–282 仍返回 FUSED_MC2；融合模式 2 在该超容量分支才明确关掉融合。当前“超过了……All-to-All（A3）”“A3……超过走 ALLTOALL”没有默认/关闭融合前提。

**影响：** 读者用该页解释一次真实选路时，会把合法 FUSED_MC2 分支误当异常。

**修法：** 教学段将 MC2/All-to-All 二选一明确限定在默认关闭融合的普通 A3 路径；源码区补模式 1 的上述例外及模式 2 的超容量回退。保留已有 A2 三条件，不把 A3 的例外写进 A2。

### R5 · P2 · GLM 的 2.5 倍容量结论丢失子账条件

**位置：** 正文 L286。

**证据：** `glm-5-3-flash-two-node.md#为什么是两台机器不是一台` L163–177 明确 2.5 倍来自“所列语言权重子账”，未计视觉塔、MTP 旋转矩阵和量化辅助张量，并假设 64 GiB×0.85 预算、3.4 GiB 激活与非 torch 占用。该页数为 3908/1577≈2.48，不是实测请求容量。

**影响：** 本页“多出来的显存让 KV cache 的块数约翻到 2.5 倍”不带条件，容易被复用为实际部署结果。链接不能替代转述时保留适用前提。

**修法：** 改为“按部署页同一组语言权重子账与显存假设，KV 块预算约为 2.5 倍”，保留链接，不在本页重推；同时说明实际容量还要扣表外项并以 profile 为准。

### R6 · P2 · A3 例子的逻辑设备口径仍在算式和端口段切回“卡/颗”

**位置：** 正文 L246–259；L229/L233 与部署图 caption 已改为逻辑设备。

**问题与影响：** 新前提是每台 16 个可见逻辑设备，后面却仍说“每颗 NPU 放多少专家”“P 每卡”“rank 占 8 张卡”“第几张卡”。本轮任务专门区分物理卡与逻辑设备；在计数段切回未限定的物理名词，会使读者把 TP8 或每设备专家数解释成 8 块物理卡。

**依据：** `launch_online_dp.py#L54-L59` 按可见设备 ID 分配 TP；`mooncake_connector.py#L2027-L2036` 使用 TP/PP/PCP rank 得到 device_index，不读取物理板卡数量。硬件页 L173 明确软件 Device 与物理板卡不能画等号。

**修法：** 仅在这个 A3 实例中统一为“每逻辑设备专家数”“每 rank 8 个逻辑设备及 8 个 Worker”“本 rank 内设备索引”。保留普通 EP 示意、GLM A2 中已约定的“卡”称呼，不额外推断具体 A3 机型的物理卡数。

### R7 · P2 · 三项历史/配置主张有补证，但现有来源仍不足以独立支撑

**位置：** 正文 L349、L373–374，对应来源 29、30、37。

**问题：** 来源 29 只有 main 的一个启动片段，不能单独支撑“四处逗号和续行符都已修”；来源 30 只证明旧文件存在，不证明后续分支删除；扩到 L1679 的来源 37 证明参数传入和 Omni 过滤，仍缺校验器的 extra=forbid 定义。初判已诚实标为 context/待补，不能发布时把这些证据缺口默认为已关闭。

**修法：** 保留已经被下文实际 Git 核对支持的事实，把完整版本 diff/树对象证据落在维护记录，并给页面补对应固定原文范围/链接；严格校验新增 `config_utils.py#L43-L48` 与 AscendConfig 装饰器位置，或链接正式配置页的已核规则并保留其固定源。不要为了减少来源删掉历史事实。补后更新逐项判断，区别原片段支持范围与新补证。

## 本轮补证的实际结果

1. **纯 DP proxy 的历史存在性。** 分别运行 `git -C tools/repos/vllm-ascend ls-tree -r --name-only <ref> examples/external_online_dp`，ref 为 `2c59ff10`、`2ed6cbba`、`baa023ad`、`7d825229`。只有第一棵树列出 `dp_load_balance_proxy_server.py`；其他三棵树保留 README、launcher、template。结论是这个固定路径的示例已移除，不是“整个仓库不存在任何可能作外部路由的程序”。
2. **四处逗号与一处续行符。** `git diff 2ed6cbba baa023ad -- docs/source/user_guide/feature_guide/large_scale_ep.md` 只有五块实际改动：旧行 156、219、410、431 去掉 kv_port 后尾逗号；旧行 323 去掉 proxy 最后一行续行符。`db701c1f→2c59ff10` 该文档无差异，`baa023ad→7d825229` 也无差异。主张可保留，但来源 29 的单段不能替代这个完整比较。
3. **严格配置。** main `ascend_config.py` L295–302 的 `@config` 类与 `config_utils.py` L43–48 的 pydantic dataclass/extra=forbid 相连；未知键经 L1660–1679 传入，若能发现 vllm_omni 则先过滤。rc2 对应类 L398–405、工厂 L1893–1912，装饰器函数同范围相同。只作静态代码核对，未重新执行 pydantic 2.13.5 的旧测试，未冒称启动实测。
4. **修订后的端口证据。** db701c1f 的 `mooncake_connector.py#L2027-L2036` 同时包含 DP×TP×PP×PCP 偏移、device_index 与 handshake_port；修订后的引用比旧 L1640–1655 完整，正文 PP1/PCP1 示例的 20001–20064 以及 P 两段 8 设备端口算术成立。

## 信息保留、图与数字

归一化 diff 的实际变化保留了示意专家账、proxy 估分、概率例子、4P4D 配置、72 服务、端口、GLM 128/31.5 MiB/4.15 GiB/38 行/6048 行、误解及待核条目。性能段将保证收益缩小为有条件的潜在收益，PD 段从“几乎总是”缩小为可配合，未删掉动机或代价。两处引用范围扩展和 A3 逻辑设备说明属于证据/口径修补，没有发现本批实际 diff 丢失原有有效机制。

首图规格的计数独立核对：总工作为 4×2=8 对，E2 的一对本卡处理，两种布局都是 7 份跨卡；EP8 中跨机恰为我→E4、了→E3、苹果→E3 三份，最忙 3 份、平均 1 份、两卡无工作。EP4 最忙 4 份、平均 2 份。上述成立不消除 R1 的请求归属错误。

实际用 Python 重算：40×128×12 MiB=60 GiB；EP16=3.75 GiB；EP64=960 MiB；proxy 示意值为 154.5745、465.0745；独立概率示意为 9.75%、55.987%、96.248%；对应 EP 页公式的两笔逻辑载荷为 31.510 MiB 与 4.1485 GiB。按本页的取整精度都一致，未把它们当链路 trace。

格式静态结果：三图宽均为 900；首图前没有 calc，也没有 GLM 字节/形状账。4 个 calc 分散在 4 个承载内容的 H2；源码区 H3 顺序符合标准，源码区后无新增 H2。教学正文（去 frontmatter、止于“对照源码”、字符数按去空白且保留 Markdown/拉丁字母逐字符统计）10431 字符、行内代码 0、证据角标 0；含源码区全文 18405 字符、行内代码 114 对，约 6.19 对/千字符；角标 25 处，其中 C 17 处，占 68%。这不是项目自动 audit 的替代结果。

## 初学者复述与剩余验收

按文本阅读顺序，开头和“为什么需要”两段可复述为：专家权重分散后，每设备存得少；token 去持有选中专家的设备计算，再收回结果；多机增加跨机份数和负载不均，最忙的参与者拖长这一层。外部请求入口不决定所有专家计算位置。这个主干直觉成立，但 R1 使“请求为什么已经散在各卡”得到错误答案，因此初学者关卡暂不通过。

由于本轮 SVG 尚待生成，此处“开头两段”是文本审查范围，不冒称实际桌面视口的前两屏已通过。修订后需实际打开页面，检查首图路由与图注、A3 逻辑设备表/calc、API 默认数在正文和流程图的一致性、四版表及跨页入口，再完成项目要求的检查。前置术语也应在实际首屏检查中确认已就地解释。

Open Questions：没有需要用户重新决定的产品问题；存在上述必须修订项，以及浏览器、自动检查与 NPU 实测范围的明确边界。

## 写手修订后的 P1 复审

再次实际读取当前页面 L119–141；随后记录页面 SHA256 为 `f12756aef970ab78c205b6c38bb30a40da250194aca4f7479958620309729776`（并发中的其他修订也会改变全文哈希）。L125 现明确“四个 token 标签可以来自四条不同请求”“不表示 DP 把同一句话拆开”“图从 MoE 层入口开始观察”“DP 把完整请求分给执行组”。路由、源卡分布与首图计数均保留，和 DP 页的请求归属一致。

**R1：文本层面的 P1 已关闭。** 这不是浏览器前两屏或整页教学验收通过。EP 页 L196 仍保留单句 token 的任意源卡示意，但没有把该分布归因于 DP；本页已经明确区分，因此不以那句存量示意阻止本页 R1 关闭。

## rc2 七项版本事实的补读与可用引用

以下是接到写手补读请求后新读取的固定原文范围，和首轮范围分开记。rc2 使用 Ascend `7d825229`、vLLM `ced6857a`；所有行号均为 `git show <commit>:<path>` 的原始行号。

| 本页版本表的项目 | rc2 可以写的结论 | 精确证据 |
| --- | --- | --- |
| 官方文档 | 与固定 main 文档字节相同，已经去掉四处 JSON 尾逗号和 proxy 最后一处续行符；不代表其他旧模板问题都修好 | `vllm-ascend@7d825229:docs/source/user_guide/feature_guide/large_scale_ep.md#L151-L159`、`#L214-L222`、`#L320-L324`、`#L404-L432`；`git diff baa023ad 7d825229 -- <该路径>` 无差异。文档仍在 L307–322 使用那四个旧 proxy 参数，不应写“模板全部修复”。 |
| 纯 DP 外置 proxy | 固定 `examples/external_online_dp/dp_load_balance_proxy_server.py` 已不在 rc2；与 v0.26/main 的该路径存在性相同 | 四棵 `ls-tree` 的实际输出见前节；固定目录入口为 `https://github.com/vllm-project/vllm-ascend/tree/7d825229/examples/external_online_dp`。这是树对象证据，不伪造不存在文件的行号。 |
| PD proxy 的挑法 | 与另外三版的两种估分及优先级相同：P 请求长度线性估分记 KV 账，D 记长度；按角色的最小优先级挑后端 | `vllm-ascend@7d825229:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L234-L240`（估分）、`#L305-L328`（priority/小顶堆）、`#L381-L430`（记账）、`#L1036-L1042`（原始请求体字节数）。先 P 后 D 在 `#L952-L980`。复核对比：v0.23 L205–211/L276–281/L387–401；v0.26 L234–240/L305–310/L416–430；main L233–239/L304–309/L415–429。这里只说挑法相同，错误释放与请求 ID 行为有变化。 |
| Mooncake 端口偏移 | 官方例子用的 V1 仍采用 DP×TP×PP×PCP 加设备索引；V1 仍在旧文件，V2 另有拆分实现 | `vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/__init__.py#L45-L59` 明确 V1/V2 注册；V1 公式 `vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2184-L2193`；V2 公式 `vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L105-L112`。主表应以 V1 为范围。 |
| 上游外置分派 | 显式 rank 推出 external，本地 DP 个数必须 1/省略；缺 rank 或本地数量不合法是 ValueError；fault tolerance 要求 external；external 本身要求 DP>1；前端数默认 1，可显式多开 | `vllm@ced6857a:vllm/engine/arg_utils.py#L2220-L2258`；`vllm/config/parallel.py#L515-L518`（DP>1）；`vllm/entrypoints/cli/serve.py#L105-L123` 与 `#L145-L154`（默认和启动分支）；`parallel.py#L603-L609`（本地引擎范围）。 |
| 未知附加配置顶层键 | 通常严格拒绝；可发现 vllm_omni 时，未知顶层键先警告再从 Ascend 输入过滤。不能外推为未知子配置也放行 | `vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L398-L405`（类装饰器）、`#L1893-L1912`（工厂/Omni）、`vllm_ascend/config_utils.py#L31-L50`（pydantic dataclass/extra=forbid）。 |
| A2/A3 MoE 通信选择 | 使用硬件策略分派。普通 A2 为专家密度/EP规模/token容量三条件；A3 先看融合/受支持的 MegaMoE 分支，随后按容量选普通 MC2 或 ALLTOALL；未开 EP/单成员与 LoRA+EP 是外层分支，不能略去 | `vllm-ascend@7d825229:vllm_ascend/device/hardware_profile.py#L284-L313`（A2/A3 策略）；`vllm_ascend/ascend_forward_context.py#L297-L333`（两个选择器）、`#L366-L414`（外层选择）；`#L87-L97`（MegaMoE 谓词）。默认值 `ascend_config.py#L575-L580` 的 prefill MC2 false、`#L607-L609` 的 fused MC2 0；输入值 2 在 `#L659-L677` 用于 MegaMoE 测试能力并归一成 1，不能套用旧 GLM 的模式 2 含义。容量来源见本页原来源 41 的 L243–274。 |

补读 Mooncake 旧分支对照：v0.26 `mooncake_connector.py#L2116-L2125`、main `#L2176-L2185` 均保留相同公式。main 注册 `distributed/kv_transfer/__init__.py#L45-L53` 与 rc2 一样区分 V1 和 V2。

### R8 · P2 · 版本表把 V1/V2 的文件位置混成一次迁移

**位置：** 首轮页面 L376，“main……代码拆进 mooncake/ 子目录”。

**证据与影响：** 官方示例传的是 MooncakeConnectorV1。main/rc2 注册表都仍把 V1 指向 `kv_p2p/mooncake_connector.py`，把 V2 指向 `kv_p2p/mooncake/connector.py`。因此现有表会引导读者追错官方示例的执行代码。

**修法：** 表中改成“V1 公式相同；V2 另有子目录实现”，或只保留 V1 的端口行为，源码位置区再区分两个连接器。具体引用见上表。

### R9 · P2 · 外置模式本身要求 DP>1，需与 dense 专属报错分开

**位置：** 首轮页面 L184、L321–322、L339 及版本表外置分派一行。

**证据：** 四个固定上游版本的 `vllm/config/parallel.py` 都有 `data_parallel_size <= 1 and data_parallel_external_lb` 时抛错：v0.23 L447–450、v0.26 L462–465、main L511–514、rc2 L515–518。

**影响与修法：** 当前补上“dense 拒绝分支还要求 DP>1”是正确的，但不能据此使读者以为 MoE/外置 DP1 可启动。怎么开中明确 external 要求 DP>1；报错区保留该通用检查，和 dense 模型的另一个错误分开。只核固定代码，不声称实际拉起了设备服务。
