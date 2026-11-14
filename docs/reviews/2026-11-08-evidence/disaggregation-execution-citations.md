# 分离部署 / 外部缓存 / 设备执行：逐项核验

状态：安全检查点，暂停等待主会话串行续跑；整组未完成。独立复审由主会话统一调度。未启动审查子代理，sessionID：无。所有支持判定均来自手写阅读记录，脚本只合并编号、来源及文件哈希。

| 页面 | 来源数 | 已登记判断 | 当前 SHA256 |
|---|---:|---:|---|
| pd-disaggregation | 72 | 0 | 6146e1e1959c58f0dbf0a000f01dbc88cdb650e498d418fb7f90165c2a530823 |
| mooncake-connector | 64 | 0 | 8776763ab22b6176c00323a18faa0ff8d83c685912dcb5d7ab45c5ccb09cc839 |
| kv-pool | 57 | 0 | 4a06f92a540bf264c254e0d74af8824e0b944d5620a4674a8c6821179ebde5f2 |
| recompute-scheduler | 43 | 0 | fe4629408c050c85459f97f5e1eb7ea0c28a6b957f78d5e4c3a8f4859345c1de |
| ucm | 37 | 0 | 1a19353ef4f7fc074b0912664dc5b95437dc310e22d23d4c51416302e033beeb |
| lmcache | 24 | 24 | 19ee4bc472f40e68f0b92a1b4b895b3d47c9ab2149cf3053dcb6dd0540fbd53e |
| swa-bounded-replay | 8 | 0 | 3448e403e219cfb27d1f8cb54a275344aaa39da37b8385720c13160e1fc4dcc8 |
| large-scale-ep | 44 | 0 | d4509399fc14e8e43ec1715016f74968d21b14434f7904ce88fdb7b7535e5ae9 |
| ops-and-kernels | 40 | 40 | 29b2bb2adca14f343fbd6b01c3431efcb22395d3698f64331b34d524e6c87804 |
| op-to-ai-core | 27 | 0 | 02d559aa718728d29a16a622193c7e58ad7e3576c6f8eabc163c1e5b5cc94cf6 |

计数：{"已读待判": 343, "待核": 9, "支持": 50, "部分支持": 13, "重复存档": 1}

详细逐项原文范围、主张与判定见同名 JSON。源码范围读过才登记；原始材料的存档不增加独立证据。

## 本轮实际修订

- LMCache：初始化配置与尾块条件、跨版本结论范围；图注明确分层示意不证明外部实现顺序。
- ops-and-kernels：packed MLA 缓存来源、MoE 融合分支、CustomOp 报错触发条件。
- Mooncake：V1 并非默认连接器，超时显式值优先，Layerwise D 侧 PCP>1 在初始化已被拒绝。
- PD：补单 token 提示词不进入 N−1 截断的边界。

## 验证与限制

待本组修订收束后运行定向生成与检查；全站检查交主会话。尚未作独立复审、浏览器阅读或 NPU 实测。

## 串行续跑交接（2026-11-08）

按用户最新指示停在安全检查点，不再读取下一项。**整组未完成，未独审，不得据此更新全站完成状态。** 未启动任何审查子代理，sessionID：无。

### 已保存的实际工作

- 10 页正文均已全文阅读；原始来源初始 414 条，LMCache 新增两条固定版本选择入口，当前 416 条。逐项读过的范围已经记入 JSON 的 read_ranges；`已读待判` 仅表示实际阅读，不能计入支持或验收。
- 手写语义记录目前只覆盖 LMCache 24 条、ops-and-kernels 40 条。判为部分支持的项包含尚需补证或复审的条件，不代表整页闭合。
- 本轮内容修改只有 `wiki/concepts/lmcache.md`、`wiki/concepts/ops-and-kernels.md`、`wiki/concepts/mooncake-connector.md`、`wiki/concepts/pd-disaggregation.md` 与 `wiki/diagrams/lmcache.yaml`。改前工作区基线在 `.tmp/wiki-evidence-resume-2026-11-08/baseline/wiki/`，不要用 HEAD 替代它。
- 原始存档做过实际内容比较：ops-and-kernels 来源 32 的 31 段、PD 来源 57 的 56 段、op-to-ai-core 来源 24 的 21 段，与各自固定 git 原文逐段比较后相同（比较时只剔除每段首尾空白）。对应源码已实际阅读；重复存档不增加独立证据。其他 raw 存档尚未比对。
- 实际读过 9 份图 spec：pd-disaggregation-intuition、pd-disaggregation、pd-state-boundary、mooncake-connector、mooncake-connector-hooks、lmcache、ops-layers、op-to-ai-core-intuition、op-to-ai-core。只读了 YAML，没有浏览器视觉验收。`mooncake-connector-hooks` 的 scheduler.py#L2112-L2128 图 pin 尚未读取。

### 完全未读取的来源（9 项）

| 页 | 来源编号 | 尚缺什么 |
|---|---|---|
| mooncake-connector | 57 | raw 存档逐段核对 |
| kv-pool | 46、55、56、57 | raw 存档与 921ccc52 后续官方部署指南 |
| recompute-scheduler | 41 | raw 存档逐段核对 |
| large-scale-ep | 38 | raw 存档逐段核对 |
| swa-bounded-replay | 1、7 | 2609.19969v1 原报告相关章节；固定 cache_engine.py |

UCM 来源 29 是无行号的完整 GLM 教程 URL，本轮只读取同一固定提交的 237–353 行（所引用的双机部署节）；不能记成全文阅读。其他已读但未判的项逐条列在 JSON，不需要重新整读旧巨型账本。

### 明确待闭合的发现

| 级别 | 位置 | 证据、影响与下一步 |
|---|---|---|
| P2 | kv-pool 正文“搬失败怎么办”、常见误解 | 来源 13/48 的同步路径只对单组登记 invalid blocks，多组只记录错误并跳过回退；正文仍泛称失败默认结束，应把单组/多组边界放回正文并与源码区统一。 |
| P2 | pd-disaggregation 失败后改 recompute 的说明 | 已读 `db701c1f:platform.py#L892-L900`（recompute-scheduler 来源 11）明确拒绝 hybrid+recompute，PD 页尚未补这项限制及引用。 |
| P2 | ucm 官方对比数与示例配方 | 来源 10 启动上限 17000，来源 11 测试输入 32000/64000/128000；官方数可按原表保留，但不能把所列启动命令当成完整可复现配方。需说明测试启动配置缺口，不能猜改值。 |
| P2 | large-scale-ep 稠密模型报错通例 | 来源 10 的拒绝条件还包含 data_parallel_size>1；正文把“指定 rank”泛称一定报错，需补完整条件。 |
| P2 | large-scale-ep 来源 27 | 当前页仍是浮动 main；本轮已联网核到 revision `56d4cbbb4d29f4355bab4b9a39ccb717a14ad5ad`，固定 config.json 确认 n_routed_experts=256、num_experts_per_tok=8。尚未改 pin。 |
| P2 | recompute-scheduler 来源 40 及 C40 角标 | PR #10742 的 body 已读，OOM/工具调用限制是作者设计说明，不是固定源码 C 证据；merge SHA 为 6329838c9fa47becfc05aa65ada8a03208cf037c。分支祖先关系未在本轮验证，需降级该说明并分别核实源码行为。 |
| P2 | pd-disaggregation 图的失败路径 | 图从“成功或失败都会通知”直接连到 D 前向；默认失败策略会结束请求，应在原布局内标清成功才放行，失败另按策略处理。尚未改图。 |
| P2 | ops-and-kernels 来源 15/17/28/33 与版本表 | 已读的卷积片段未给出宽 4 常量、chunk 片段未给出 64 定义；旧版无 KDA/GLM 及完整注册表一致还需定点补证。来源 33 截止导入段，不覆盖完整登记表。 |

Mooncake 的已修改项仍要独审：V1 并非启动默认；传输超时尊重显式 ASCEND_TRANSFER_TIMEOUT；Layerwise 消费者 PCP>1 在 scheduler 初始化先被拒绝（已读 802–815），允许的 D 配置下两套端口公式一致。PD 新增单 token 截断边界：N>1 才截，N=1 不能从四 token 算例外推正确恢复。

### 读到的关键原文定位

- 所有固定 git 源码可用 `.tmp/wiki-evidence-resume-2026-11-08/disaggregation-read.py <page-id> <source-numbers>` 定点读；该工具不生成语义判断。
- SWA 来源 2–6、8 已通过固定 `raw.githubusercontent.com/deepseek-ai/DeepInfer/774ce244…` 原文阅读，URL 与文件路径已在逐项 read_ranges；其中 2 的命中策略要求在 `[L1−128,L1]` 区间查 SWA，不只是查单个边界。当前教学例子是无对应状态的假设，仍需与完整原报告核对。
- op-to-ai-core 来源 14 的 CANN 页面首次 Transport error、第二次获取成功并读完文字；原图未打开。不能记“原文不可取得”。来源 15 实读 arXiv HTML v1 的 §4/式(4)及主体文字，附录返回被截断。
- UCM、KV pool 的版本表中“逐字相同”“包内零命中”等全范围断言尚未在本轮重做完整比较，不得用局部片段相同代替。

### 验证、生成与后续顺序

- 尚未运行本组定向内容/Lint、类型检查、构建或浏览器验收；全站集成检查由主会话执行。
- `lmcache.yaml` 只改 caption，**对应 SVG 尚未重新生成**。请定向生成该专用图，保留其他图现状。不要把当前 YAML/SVG 状态当成通过。
- 本轮手算检查过 LMCache 的 600/256 分块、PD 的 1999/640 与 1999/2560、Mooncake 地址示意与 33064ms、RMSNorm 两元素示意；未运行数学测试，也未核完所有跨页实际部署子账。
- 已确认无法取得的原文：本检查点无；未尝试/未读项目仍保留待核，不能填入不可取得统计。
- 续跑先关闭上表已发现问题，再按 JSON 的已读待判逐项补手写判断、补漏版本与图 pin，读取 9 项缺口；最后由主会话统一独审与检查。
- 合并脚本只写本组 JSON/MD，手写判断在 `.tmp/wiki-evidence-resume-2026-11-08/disaggregation-notes.json`，逐项阅读清单在 `disaggregation-read-checkpoint.json`。修改正式账本后再跑该脚本会覆盖手改，续跑应先维护这些输入或停用脚本。
