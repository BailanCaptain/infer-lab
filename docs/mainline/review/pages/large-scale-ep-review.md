# large-scale-ep 审查记录

## P5 写作记录（2026-09-29，第 14 批深改）

**改了什么。** 正文从 1,879 字扩到 18,952 字（audit 口径；对照源码之上的教学正文 5,683 字，standard 口径）。按「是什么 → 为什么、代价 → 怎么做 → 细节与变体 → GLM → 误解 → 对照源码」重排为 9 个 H2：大规模 EP 是什么 → 为什么铺这么大、代价 → 每个 DP rank 怎样各自成为一个服务 → 为什么常和 PD 分离一起用 → 官方示例 8 台 A3 → 昇腾上组要多大才走得上 MC2 → GLM 双机 EP16 基线 → 常见误解 → 对照源码（五个 H3）。EP 的 dispatch/combine、DP+EP 组合、All-to-All 只一句话加链接，不重讲。

**图（3 张，全部新画）。**
- `large-scale-ep.yaml`（直觉图，替换旧的抽象 P/D 拓扑）：沿用 EP 页「我吃了苹果」4 token、E0–E7、k=2、路由不变；上半 EP4 一台机器每卡 2 专家，下半 EP8 两台机器每卡 1 专家（token 放在卡 0/2/4/6）。画出全部 7 份跨卡派发，跨机 3 份用红线；专家上方小方块是每个专家收到的份数，卡标签写每卡份数。读者能直接数出：每卡专家 2→1、跨机 0→3、最忙/平均 4/2→3/1。借参考图库 AMD「成对对照」手法（同一骨架只改一处），不照搬其配色和只画两条箭头的做法。
- `large-scale-ep-flow.yaml`（代码流程图）：左列一个 vllm serve 进程成为外置 rank 的先后与「非 MoE 报错」分支；右列示例 proxy 处理一条请求的先后（先 P 后 D，KV 由连接器直传）。带 5 条 pins。
- `large-scale-ep-deploy.yaml`：官方示例 4 台 P 各自 EP16、4 台 D 合成 EP64、proxy 与 P→D KV。
- 按派发说明没有截图；三张图都过了 figureProblems（无溢出、无重叠），`pnpm wiki:diagrams --check` 一致。

**数字与出处。**
- 基础节全部用示意数：EP 页示意模型 60 GiB 专家权重 ÷ 4/16/64；「至少一个 rank 带长 prefill」1 − 0.95ᴺ（p=5% 为示意，已写明独立同概率假设）；示例 proxy 估分按源码线性式代入示意请求体长度。
- 官方示例数（DeepSeek-R1 256 专家、8 台 A3、P DP2×TP8 EP16、D DP64×TP1 EP64、72 个服务、端口 9000/20001 偏移）取自 `vllm-ascend@db701c1f` 文档与 Mooncake 连接器源码，明确标为另一模型、另一硬件，不代入 GLM。
- GLM 只作 EP16 基线：288÷16=18（02 §6.3）、MC2 门槛 128（02 §6.4，唯一出处 one-request）、纯 decode EP 交换 ≤31.5 MiB 与场景 M 4.15 GiB（02 §8.4–8.5，唯一出处 EP 页与 concurrent-requests）、理想均分 38/6048 行（02 §8.6）、EP8 vs EP16 与 KV 约 2.5 倍（唯一出处 glm-5-3-flash-two-node）。全部只写结论加链接，不重算。专家负载与迁移引用 EP 页、concurrent-requests 与 eplb；EP16 以上不给任何 GLM 数字，写入待核。

**核心概念对照了什么。**
- 外置 DP 负载均衡：`vllm@0fc695fc` 的 `config/parallel.py`（字段注释、`local_engines_only`、环境变量回退只在命令行 DP ≤1 时走）、`engine/arg_utils.py#L1843-L1902`（非 MoE ValueError、本地 DP 个数断言、hybrid 自动切 external）、`entrypoints/cli/serve.py#L71-L148`（四种 LB 互斥、四个启动落点）；上游 `docs/serving/data_parallel_deployment.md`（内置分派前端在大 DP 下可能成瓶颈、hybrid、external）与 `expert_parallel_deployment.md`（PD 时 prefill/decode 用不同通信后端）。
- 示例 proxy：`load_balance_proxy_server_example.py` 的 `_priority`、`calculate_prefill_score`、`_pick_server`/`_release_load`、`assign_instances`、`build_prefill_request`。
- MoE 通信选择：`ascend_forward_context.py#L96-L101`（取 DP 组最大 token 数）、`#L239-L282`（A2 三条件；A3 超容量走 ALLTOALL，融合版 MC2 默认关、模式 1 要求 EP≤32）、`envs.py#L102`。
- PD 下跳过 DP 同步与分层通信：`utils.py#L1169-L1172`、`#L1257-L1298`，`token_dispatcher.py#L115-L133`。
- 三版：文档 db701c1f = 2c59ff10；2ed6cbba 只改 tab 语法加一处提示框；baa023ad 删 4 处 JSON 尾逗号和一处续行符。`dp_load_balance_proxy_server.py` 在 v0.26 起删除。proxy 挑法、Mooncake 端口公式三版相同（main 移到 `mooncake/base_worker.py`）。上游 vLLM 568afb3a 仍是断言，84030bbe 改 ValueError 并要求 fault tolerance 走外置 LB。

**纠正旧版的三处。**
1. 旧版（含 59893fa）说示例 proxy 记的是「正在处理的 token 数」和「占着的 KV cache」。源码：负载按请求体字节数估；prefill 端记线性估分到 `active_kv_cache`，`active_tokens` 从不增加；decode 端记请求体长度。已按源码改写，并用 calc 说明常数 120 占大头。
2. 旧版说附加配置的两个键在三个版本都「静默无效」。main（baa023ad）的 AscendConfig 改为 pydantic `extra="forbid"`，未知键启动报错（装了 vllm-omni 时只告警并丢弃）；v0.23/v0.26 仍静默忽略。已分版本写。
3. 旧版说 main 删了「5 处 JSON 尾逗号」。实为 4 处 JSON 尾逗号 + proxy 命令末尾 1 处续行符。

**不丢信息勾选。** 旧版清单取 p4-checkpoint（A1–A15）和 P4 重建前最后一版 59893fa（B1–B25），逐条勾选见会话 scratchpad `p5/large-scale-ep-facts.md`：全部落地，无删除；旧版 Qwen3.6 例子随全站换成 GLM。

**参考。** 看了参考图库 INDEX / HOW-THEY-TEACH，以及 amd-05、amd-06-hi、amd-10-hi、amd-15 四张图。借用：成对对照、把状态写在卡上、EP_SIZE 与每卡专家的除法落地。没借：AMD 只画两条带名字的 AllToAll 箭头（本页画出每份 token 的真实去向）；AMD 的 MI300X 结论不引用。

**自查。** `pnpm wiki:lint` 本页 0 错 0 待留意（全站其余待留意都是别页的 mark-flood）；`pnpm wiki:diagrams --check` 一致；`pnpm wiki:audit` 通过、本页 37 条来源全部行号有效；standard 检查全绿（行内代码 0/千字、对照源码之上角标 0、calc 0.70/千字、相邻块 0、图先行、免责 1.2%、图宽）。全页角标 24 处。

**中途事故。** 写到一半时第一节里的锚点 `#每个-dp-rank-怎样各自成为一个服务` 指向尚未写出的一节，导致站点报页面不合法；随后写入该节后锚点解析，之后每次保存都跑 lint。「分层通信」一句临时去掉过到对照源码的锚点，写完对照源码后已恢复。

**待核（已写进页末）。** 文档模板只用环境变量传 DP 参数时在线服务的实际行为；官方示例 D 侧是否满足跳过 DP 同步的条件；EP16 以上 GLM 部署；跨机流量占比、分层通信收益、真实专家负载分布。

**跳过。** 没截图（派发说明要求不截图、不起服务）。pydantic 对尾逗号的报错写手本机无法核（无 pydantic），已由审查用 pydantic 2.13.5 实测核实（报 `json_invalid: Invalid JSON: trailing comma`），并写进页面出处。

## P5 审查（09-29）

审查员：独立审查（未开子代理）。页面现版 339 行，教学正文 L61–L256，对照源码 L257–L339（只 grep 核结构，另按派活要求读了 L281–L290 报错表与 L330–L339 待核）。

**分数：9 / 10。** P1 0 条，P2 0 条，P3 5 条。

### 必做项结果
- **初学者测试（只读前两屏）**：大规模 EP 就是把一套 MoE 路由专家摊到几十台机器、上百张卡上，每卡只存几个；省下的显存给 KV cache、decode 每步读的权重也少；代价是派发去向更散、更多跨机，整组要等最慢那张卡，所有 rank 还得一起走。通过。
- **学习顺序**：是什么（EP4→EP8 直觉图，只用示意数）→ 为什么 / 代价（示意模型 60 GiB ÷ 4/16/64）→ 怎么做（每个 DP rank 一个服务 + 示例 proxy 估分）→ PD 分离 → 官方 A3 示例 → MC2 规模条件 → GLM 双机 → 误解 → 对照源码。基础节没有 GLM 数字，通用节都在 GLM 节之前，第一节末尾只有一个节内锚点。**通过。**
- **变体与数字**：官方示例明确标「另一个模型、另一代硬件，不代入 GLM」；256 专家判据表写明「只看判据，不代表真实部署」；GLM 节写明本站没有 EP16 以上的部署和实测，EP16 以上写进待核。三个示意 calc 都标了示意和假设。没有虚构部署数字，没有把 GLM 数字当成大规模 EP 的效果。**通过。**
- **示意演算逐个手算**：直觉图 EP4 卡 0/1/2/3 收 1/4/2/1 份，EP8 卡 0–7 收 0/1/1/3/1/1/0/1 份，跨卡派发 7 份（吃→E2 本卡），跨机 3 份（我→E4、了→E3、苹果→E3），yaml 的 links 里正好 3 条 danger，和正文一致；40×128×12 MiB = 61,440 MiB = 60 GiB，÷4/16/64 = 15 GiB / 3.75 GiB / 960 MiB；4,000÷4×0.0345+120.0745 = 154.57，40,000 对应 465.07；1−0.95² = 0.0975，1−0.95¹⁶ ≈ 0.560，1−0.95⁶⁴ ≈ 0.962；4×2+4×16 = 72，256÷16 = 16，256÷64 = 4；端口 20001+63 = 20064，P 侧 rank1 = 20001+8 = 20009 起。全部对。
- **GLM 数字对底稿**：18 个/卡、128 门槛（02 L651–L654）、31.5 MiB（02 L905）、4.15 GiB 与 6.09 GiB（02 L891；concurrent-requests L347）、38 行 / 6048 行（expert-parallel L453、L400）、KV 约 2.5 倍（glm-5-3-flash-two-node L72、L119），都只写结论加链接、没有重算。场景 M 的 12 / 7 条与 6000 token 和 concurrent-requests L98–L99 一致。
- **丢信息**：按 p4-checkpoint 五个 H2 逐条对照：每 rank 专家变少、没有通用开关、EP 组≠全部 NPU、三类数据流（请求元数据 / EP 组内 / P→D KV）、端点≠进程、proxy 的 `active_tokens + 0.3 × active_kv_cache`（在对照源码 L274）、先 P 后 D 且 P 限 1 token、DeepSeek-R1 72 个端点与非 EP128、不能代入 GLM、更大组不自动更高吞吐（不均、消息、缓冲、争用、同步）、A2/A3 选路不同、PD 取舍——都还在。facts 清单抽查 B11、B12、B14–B16、B19、B22–B24 属实。
- **链接与锚点**：`pnpm wiki:lint` 通过（10 处待留意均为别页）；入链 glm-5-3-flash-two-node L282、one-request L355、index L74/L216 均不带锚点，能解析。
- **`pnpm wiki:audit`**：通过；本页 37 条来源行号全部有效（审计行：正文 18952 字 / 9 节）。`pnpm wiki:diagrams --check`：257 张一致。
- **对照源码结构**：五个 H3 齐全、顺序正确；版本差异表有 v0.23、v0.26、main 三列。对照源码之上 0 个行内代码、0 个证据角标；每节 ≤1 个 calc，表格与 calc 不相邻。

### 核心机制对照（附行号）
- 外置 DP LB：`vllm@0fc695fc` `engine/arg_utils.py` L1859–L1880——给了 DP rank 就进 external，非 MoE 且 DP>1 抛 ValueError，本地 DP 必须是 1 或不写；`entrypoints/cli/serve.py` L71–L148——三种 LB 互斥，external / multi-port 默认 1 个 API server。与正文 L123–L125 及流程图一致。
- 上游文档：`docs/serving/data_parallel_deployment.md` L77（大 DP 下 API server 可能成瓶颈，多开也仍在 head 节点）、L85（hybrid）；`expert_parallel_deployment.md` L231–L232（P 用 high_throughput、D 用 low_latency）。与 L121、L160 一致。
- MoE 选路：`vllm-ascend@db701c1f` `ascend_forward_context.py` L97（取 DP 组最大 token 数）、`_select_a2_moe_comm_method`（≤24 专家/卡、EP≥16、≤容量）、`_select_a3_moe_comm_method`（超容量走 ALLTOALL；融合版模式 1 要 EP≤32）；`envs.py` 融合版默认 0。v0.23 / v0.26 / main 三版判据相同。与 L148、L200–L205 一致。
- 示例 proxy：`load_balance_proxy_server_example.py` L205–L211（prefill 估分 = 长度÷4×0.0345+120.0745，decode 记请求体长度）、L276–L281、L384–L401、L905–L928（先挑 P、等 P 返回 kv_transfer_params 再挑 D）、L801（max_tokens=1）。与 L131–L140 一致。
- Mooncake 端口：`mooncake_connector.py`@db701c1f L2028–L2036：kv_port + dp_rank × tp × pp × pcp，再加卡序号。与 L196 一致。
- 分层通信与跳过 DP 同步：`utils.py` L1169–L1172、L1257–L1270（分层通信要求 global_bs=0 即各 rank token 数一致，与跳过 DP 同步互斥）。与 L217 及对照源码一致。
- 官方文档（v0.23 维护分支 `large_scale_ep.md`）：L6（8 台 A3、前 4 P 各自主节点、后 4 D 用 192.0.0.5）、L13（A2 机内 HCCS/机间 RDMA，A3 全 HCCS）、L145–L166 与 L211–L231（P：TP8、16384、seqs 4、enforce-eager；D：TP1、256、seqs 28）、L247–L291（dp_size 2/64、本机 16、端口 9000 起）、L489（参数不针对优化）。与 L166–L196 一致。

### 写手自报待核的「尾逗号」一条
页面 L285 把「启动时参数解析失败」**写成了确定结论，没有标待核**，页末待核清单里也没有这一条。我补做了核对：
- 文档确有尾逗号：v0.23 维护分支 `large_scale_ep.md` L165、L230 是 `"kv_port": "20001",` 后接 `}`；v0.26 L156、L219 仍在；main L156、L219、L410 已删。
- 解析链：`vllm@0fc695fc` `engine/arg_utils.py` L328–L333，数据类参数走 `TypeAdapter(cls).validate_json(val)`，ValidationError 转成 `argparse.ArgumentTypeError`；vLLM 依赖 `pydantic >= 2.12.0`（requirements/common.txt L17）。
- 实测：用本机 codex runtime 自带的 pydantic 2.13.5 跑 `TypeAdapter(dataclass).validate_json('{"kv_connector":"X","kv_role":"kv_producer",}')`，报 `json_invalid: Invalid JSON: trailing comma`；嵌套字典里的尾逗号同样报错。
- 结论：L285 的说法**成立**，写成确定结论没有问题，不必改成待核。只需把写作记录「跳过」一行更新为已核（见 P3-5）。

### 参考图（AMD）有无照抄
看了 `refs/amd-10-hi.png`（DP=8+EP：8 列 GPU，专家行上下各一条 AllToAll 横箭头）和 INDEX 对 amd-05/06/15 的描述。本页直觉图是 EP4 与 EP8 上下成对对照，画出每一份 token 的真实去向、跨机的用红线、每个专家头上用小方块数工作量，配色和图元都是本站的；没有 AMD 的列式骨架、AllToAll 横箭头，也没有引用 AMD 的 MI300X 结论。**没有照抄**，只借了「同一骨架只改一处」的对照讲法。页面上没有提参考来源的 meta 文本。没有新增分镜。

### 注水 / 重复
- 审计口径的 18,952 字里，教学正文（L61–L256，去掉代码块）只有约 8,500 个非空白字符（中文约 5,100 字），对照源码约 6,400 字符；教学部分是旧版的约 4.5 倍，不是 10 倍。八个 H2 每节 900–1,300 字符，新增的都是新信息（官方示例、端口偏移、proxy 估分、256 专家判据表、PD 必要性的示意概率），**没有大段注水**。
- moe / expert-parallel / data-parallel / collective-communication / eplb 都是一两句加链接：EP 回顾两句（L66）、专家常驻链到 EP 页（L88）、交换量链到 EP 页（L102）、负载不均与 EPLB 各一句（L103）、陪跑一句（L104）、DP rank 两句（L119）、进程分工一句（L121）、All-Gather / All-to-All 只在括号里注一句（L148）。**没有重讲。**
- 小范围重复见 P3-1、P3-2。

### P3
1. **L148、L200–L205、L215、L251：MC2 选路的「DP 组最大 token 数 + 容量门槛」讲了四遍。** 改法：L204 的 A2 第三条和 L215 前半句改成「token 数那条见[前一节](#为什么常和-pd-分离一起用)」，只保留规模条件的新内容。
2. **L244–L255 常见误解 12 条，有 5 条是正文原话的复述**（EP 组≠全部卡 = L177；稠密模型 = L125；proxy 不按实时负载 = L140；端点≠进程 = L123/L194；KV 不经 proxy = L140）。不算错，但偏长。改法：这 5 条压成一句一条，或并成两三条。
3. **L123「rank 之间唯一要约好的是 DP 主节点的地址和端口」说得过满。** 同页流程图写的是「同时给 DP 总数、主节点地址和 RPC 端口」，各 rank 还要用同样的 DP 总数和模型配置。改法：改成「rank 之间要约好 DP 总数和 DP 主节点的地址、端口」。
4. **直觉图卡标签用词不一致**：上半「卡 0 · 收到 1 份」，下半「卡 0 · 0 份」。改法：下半也写「收到 N 份」，或上半去掉「收到」。
5. **写作记录 L40 的「跳过」仍写着没核 pydantic 尾逗号报错。** 本审查已核（见上），改成「已由审查用 pydantic 2.13.5 实测核实」。

### 截图
写手没截图；按派发说明用 Playwright（1440 宽）打开用户预览 http://localhost:5193/#/wiki/large-scale-ep（没起停服务）：第一屏 `scratchpad/large-scale-ep-review-1.png`，直觉图 `large-scale-ep-review-2.png`，流程图 `large-scale-ep-review-4.png`，部署图 `large-scale-ep-review-fig5.png`（scratchpad = 580bfd6e 会话）。三张图都没有溢出和遮挡；直觉图上半 7 条派发线挤在约 30 px 高的走线带里，能追、略密，不单列问题。

### 跳过
对照源码正文只读了 L281–L290 和 L330–L339，其余 grep 核结构；没有读 frontmatter 来源区（交给 audit）；队列验收要点里的「流水和换出变体」本页不涉及。

## P5 修订记录（09-29）

按审查 P3 五条和协调意见修订，全部完成：

1. **MC2 选路只讲一处。** 「DP 组最大 token 数 + 容量门槛 + 全组换路」只在「为什么常和 PD 分离一起用」一节讲全。「在昇腾上，组要多大才走得上 MC2」改成只讲 A2 的两条规模条件和 A3 无规模条件，token 那条一句话加页内链接；删掉该节末尾「组大小这一条是定死的……」一段；误解「EP 组够大就一定走 MC2」改成一句话加页内链接。顺带改正一处链接文字：原写「前一节」，实际隔了一节，改为「PD 分离那一节」。
2. **常见误解去掉五条复述。** 删去「EP 组就是全部卡」「稠密模型也能这样铺」「proxy 按实时负载分派」「外部端点就是进程」「KV 经 proxy 转发」，这五条信息在正文的位置逐条记在 scratchpad `p5/large-scale-ep-facts.md`「P5 修订」一节。新增三条读者真会有的误解：外置分派后各 rank 仍不独立（每层 MoE 要全组到场、一起换路、一起陪跑）；P、D 两侧 EP 组不必一样大；GLM 双机跨了两台机器 ≠ 大规模 EP 的部署形态。误解现为 10 条。
3. **「唯一要约好」改为「要约好 DP 总数，以及 DP 主节点的地址和端口」**，和流程图第一格一致。
4. **直觉图卡标签统一**：上半「卡 N · 收到 M 份」改为「卡 N · M 份」，与下半一致（下半卡宽 96px，加「收到」会挤出标签位）。
5. **写作记录「跳过」一行**改为已由审查用 pydantic 2.13.5 实测核实；页面「会报什么错」表的尾逗号一行补上出处 [C35] 和「实测于 pydantic 2.13.5，报 json_invalid: Invalid JSON: trailing comma」。

**检查。** `pnpm wiki:lint` 通过，本页 0 错 0 待留意（其余 10 处待留意均为别页 mark-flood）；`pnpm wiki:diagrams --check` 257 张一致；`pnpm wiki:audit` 通过，本页 37 条来源行号有效，正文 18,726 字；standard 检查全绿（教学正文 5,498 字，行内代码 0/千字，对照源码之上角标 0，calc 0.73/千字，免责 1.3%）。全页角标 25 处。每次保存后都跑了 lint。
