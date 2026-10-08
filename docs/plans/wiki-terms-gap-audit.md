# 课程术语入口与历史缺口对账（2026-10-06）

> 10-07 后续：Q/K Norm 正文、来源与独立审查已补齐，当前入口为 **30/30**。下方 29/30 是本次对账时的历史状态；最新问答与回归证据见 [补齐记录](wiki-qknorm-multiversion-acceptance.md)。

本轮核对 F001 AC5 的课程入口与 F004 的缺口状态，修正两种误报。它不是全库内容质量或全部 feature 的验收结论。

## 结果与实现

课程由 `collectStepTerms()` 给出 30 个术语。旧状态只比较文件名，报 24 个未匹配，忽略了页面已有的标题和别名。阅读器、状态服务和 `wiki:lint --terms` 现在共用 `src/content/wiki/page-names.ts` 的精确匹配：先 id，再标题/别名；忽略大小写和两端空白，相似检索结果不算已有入口。

逐项对照现有正文后，在 5 页的 aliases 中补充 15 个课程标识。正式正文、图和原有来源未改写；生成索引已重建。当前 **29/30 有对应入口，qk-norm 仍缺**。入口匹配只证明可以找到讲解页，不表示该页已覆盖课程所有模型、版本和边界。

| 课程术语 | 对应页面 |
|---|---|
| attention-scores、attention-weights、causal-mask、context-vector、dot-product、head-dim、key、multi-head、output-projection、query、softmax、value | attention-qkv |
| decode、prefill | prefill |
| down-projection、mlp、pre-norm、residual、rmsnorm、silu、swiglu | mlp-residual-norm |
| embedding | embedding |
| gqa | gqa |
| hidden-size | layers-and-hidden |
| kv-cache | kv-cache |
| linear-projection | matmul-and-weights |
| position、rope | rope |
| token | token |
| qk-norm | 尚缺针对课程中 Q/K 逐头归一化的 Wiki 讲解；未将普通 RMSNorm 页直接算作已覆盖 |

缺口账本旧视图仅按累计提问次数判断状态，没有扣除队列关单时记录的 `closureObservationCount`。现按已关闭任务计数计算 `pendingCount`；累计次数与原记录保留，关单后新问题重新从 1/3 收集，到 3 次才重新排队。状态页展示待处理数量、已关闭历史、每条问题及本轮/累计次数；课程映射可以直接点击跳转。

## 三条历史问答记录

| 问题 | 本轮读取到的状态 | 依据与处置 |
|---|---|---|
| profiling_chunk_config 的 smooth_factor | 已关闭；累计 3 次 | 任务 `53a289cd03207f72319bf5989d3658a56e2e34683b80b2dbeecada0cab1d09da`；关单覆盖 3 次；9 月 23 日 review 回执哈希吻合，original/holdout/version/no-evidence 均 passed。保留历史，不重新排队。 |
| HCCL_BUFFSIZE / hccl_buffer_size 与 MC2 | 已关闭；累计 5 次 | 任务 `b55b91f027b7f50a3d829a6ece0c8623fa3c8ce032ee7a93743ff1a3945cec63`；关单覆盖 5 次；9 月 23 日 review 回执哈希吻合，同样 4 类 passed。保留历史，不重新排队。 |
| 固定 GLM 双机 Sleep Mode 的实际释放显存与恢复延迟 | 收集中 1/3，仍待实测 | sleep-mode 正文明确区分示意与实测。本轮没有固定硬件实验，不生成数字、不补造提问、不关单。 |

上述两条关闭结论是**历史人工语义验收记录**，不是本轮用新模型重新问答的结果，也不保证后续源码变化后仍然成立。本轮未改动 `_gaps.json`、原关单记录或夜间模型配额。

## 验证证据

本机诊断文件在忽略目录 `tools/wiki-runtime/`：

- `terms-red.log`：别名覆盖与关单视图两项回归先失败（2 failed / 60 passed）。
- `terms-green.log`：4 文件 68 测试通过，含精确匹配、id 优先、无效页面不算覆盖、关单后重新累计。
- `terms-check.log`：`pnpm check` 通过，129 文件 **1,056 测试**通过；类型、Lint、依赖、内容、288 图一致性和 Wiki lint 均通过。既有 Lint 17 警告、3 提示以及 Wiki 4 条 mark-flood 提示保留；不把提示数称为零问题。
- `terms-coverage.log`：`pnpm wiki:lint --terms` 如实报告唯一 `missing-term: qk-norm`，因此该专项尚未全通过；不能把普通 `pnpm check` 通过写成 30/30 内容覆盖。
- `terms-browser.log`：新增真实浏览器回归 1/1 通过。隔离服务读取实际状态逻辑，验证别名跳转和已关闭/新观察分别显示。
- `terms-browser-live.log`、`terms-live-status.json`、`terms-status.png`：实际 5193 网页显示缺少入口 1/30、待处理 1、已关闭 2；操作 attention-scores 链接进入 Attention 正文，五个改别名页面实际打开，未捕获页面脚本错误。
- `terms-build.log`：`pnpm build` 通过，Vite 构建 5.63 秒。
- `terms-audit.log`：143 页、3,858 来源；3,699 本地源码行号有效，104/104 标准页通过。159 个 URL 未联网验证、3,534 raw 摘录未逐项核对；不声称本次做了全库语义审查。

## 剩余工作

1. 给 qk-norm 补充有版本边界、来源和独立审查的教学正文，再挂接入口；不能用普通 RMSNorm 别名消掉数字。
2. Sleep Mode 实测需要固定部署与真实设备数据，继续保留证据缺口。当前无需用户为本轮代码修正另行审批。
3. P6 原计划的成组真实问答、多版本导入、参数 suspect 和 GitHub 负例验收仍按原顺序推进；夜间模型任务继续关闭。
