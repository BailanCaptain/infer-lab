# fine-grained-tp 审查记录

## P5 写作记录（2026-09-29，第 18 批深改）

**改了什么。** 正文从 2358 字（p4-checkpoint，本页此前未改过）扩到 17404 字（含对照源码；教学正文 11252 字，写作标准口径 5391 字）。按「是什么 → 为什么需要、代价 → 怎么算（示意数）→ 各模块差异 → 通信与显存怎样比 → GLM 双机 → 常见误解 → 对照源码」重排为八个 H2。保留入链锚点「不同模块需要不同通信」（lm-head.md 第 219 行指向它）。

**讲法。** 核心区别讲成「组里的卡手里是不是同一批 token」：普通 TP 组输入相同，一次 All-Reduce 收尾；沿 DP 组队的卡服务不同请求，入口要收集、出口只把各自 token 送回（Reduce-Scatter 或 All-to-All），用一张 ≤4 行小表对照。三样隐性代价（补齐、步调绑定、陪跑）和「只借卡、不改请求」放在第二节。通用节只用示意数，GLM 数字只在 GLM 一节。

**图（三张）。**
- 新增直觉图 `fine-grained-tp-intuition.yaml`：4 张卡 DP4，行 = 模块、列 = 卡，词表嵌入与稠密 MLP 两两合存、attention 每卡整份、路由专家按 EP、lm_head 四卡合存；右栏标进出这一层的交换。借 AMD 参考图「每层一条横带、按卡切块、成对对照」的手法（看了 refs/amd-06-hi、amd-10-hi 与 HOW-THEY-TEACH §3–4），用本站图元重画，画出了 AMD 缺的分组边界与交换。
- 重画 `fine-grained-tp.yaml`（词表查找）：换成带数的示意，A 查 6、B 查 1，故意让各自要的行都在对方卡上，显出为什么非收集不可；图上写出 [0, 0]/[1, 3]/[2, 5] 的变化。
- 新增代码流程图 `fine-grained-tp-flow.yaml`：配置 → 前提检查（不满足即报错）→ recompute 绑定 → 沿 DP 建组 → 构造时换组 → 四个模块的前向，带 pins。
- 分镜动图按 09-29 暂停令未加。三张图 `figureProblems` 为 0；仅有「lm_head 是代码名」的非阻塞提醒，与 lm-head-intuition 等现有图一致。

**数字与出处。** 通用节全部示意数（2 卡、8 词 × 2 维、D = 4；示意账 1 GiB、k = 4、b = 8、H = 4096）。GLM 数字：lm_head 每卡 151.25 MiB、R1 decode All-Gather 1.18 MiB 取自 02 §7.3；词表 154880 × 4096 取自 02 §2.3；稠密 MLP 每层每卡 18.0 MiB 取自 02 §3.3；稀疏 MLA 里逐卡复制的投影取自 02 §5.2；KDA 头切法（02 §4.3）核对后未用到正文。组大小 2/1 时的 605 MiB、1.182 GiB、72.0 MiB/层、128 行补齐与 19,824,640 B 跨机 All-to-All 由源码规则 + 上述底稿数静态推算，页上标明未实测。官方实测表（DeepSeek-R1 W8A8、32 卡 A2、DP32+EP32、组 8、batch 24）取自 vllm-ascend 官方特性文档 Fine_grained_TP.md，明确限定于该部署。

**核心概念对照了什么（vllm-ascend@db701c1f，逐段读源码）。**
- 建组：`parallel_state.py` 的 `_create_or_get_group` 把 rank 排成 PP × DP × TP，在每个 PP、TP 坐标上沿 DP 每 k 个一组；GLM 双机下组大小 2 即 {i, i+8}，与 vLLM DP 组（`vllm@0fc695fc parallel_state.py#L1833-L1848`）相同。
- 换组即换切分：`AscendVocabParallelEmbedding.__init__` 用新组的 world_size 当 tp_size；`CustomLinearOp` 注释与 `ops/linear.py` 用 `get_parallel_op` 返回的 tp_size 切权重，说明通信组同时决定权重切几份——所以细粒度组是替换而非叠加在 TP 组上，TP8 部署开组 2 会让每卡存得更多（本页新增的关键结论，旧版没有）。
- 四个模块数据流：`_forward_embed_tp`（静态缓冲区 + all_gather_into_tensor + 掩码 + reduce_scatter_tensor）、`_get_logits_lmheadtp`（all_gather → 本地打分 → all_to_all，all_to_all 按 dim0 拆、按最后一维拼，已读 `npu_communicator.py` 确认语义）、`MLPColumnParallelOp`/`MLPRowParallelOp`（all_gather dim0 / reduce_scatter dim0）、`OProjRowParallelOp`（按特征段 transpose 后 all_to_all_single → 行切矩阵乘 → reduce_scatter）。
- 按层名挑算子与 `is_moe_layer`：只换非 MoE 层的 MLP，共享专家不受影响；`wo_a`/`wo_b` 走 DSV4 算子，交换在 `dsa_v1.py` 内；GLM 模型文件不引用任何细粒度 TP 判定，其稀疏 MLA 走 sfa_v1 路径（02 §5.2），低秩输出投影一项对 GLM 无作用。
- 前提与报错：`FinegrainedTPConfig`（MoE、整除 DP、o_proj 的 TP=1 / graph mode / KV consumer）、recompute 绑定（`ascend_config.py#L143-L161`）、平台只许 D 节点（`platform.py#L680-L700`）、FlashComm2 冲突、embedding 静态容量报错、lm_head 行数补齐与空跑假打分（`model_runner_v1.py#L1320`、`#L3604`）。
- GLM 双机未启用：02 §2.2 步 3 与 §7.2 步 6 记录两个判定默认假；D 页参数表与 ascend-config-system 页确认未传 Ascend 配置。
- 版本：v0.23（2c59ff10）与 v0.26（2ed6cbba）的配置类与固定镜像逐行 diff 相同；建组函数 v0.26 逐行相同；main（baa023ad）移除 olora、改 pydantic、拒绝负数、lm_head 改 all_to_all_single 并加「行数整除组大小」检查与 replicated 头绕行。vLLM 上游 0fc695fc 无此特性（git grep 为空）。
- 官方文档与代码不一致：文档称支持稠密模型，钉住代码对非 MoE 直接 AssertionError，页上以代码为准并写进常见误解。

**旧版信息清单勾选**（清单在会话 scratchpad `p5/fine-grained-tp-facts.md`，F1–F16）：
- F1 DP 重复、EP 只分专家 → 「为什么需要它」首段。
- F2 普通 TP 一套切法 vs 模块另设组 → 第一节。
- F3 沿 DP 建组、固定 PP/TP 坐标 → 第一节 + 源码位置「建组」。
- F4 协作、不拼序列、不改路由 → 第二节「只是借卡，不改请求」+ 常见误解第 3 条。
- F5 DP4/TP1/组 2 教学布局 → 直觉图（0/1、2/3 两两一组）。
- F6 本地查不够 → 第三节「麻烦马上出现」。
- F7 8 行词表例 → 保留并加数；编号改为 A=6、B=1（原为 1、6），让「要的行在对方卡」显式成立，属示意数调整。
- F8 整数 vs 向量、实现含收集/掩码/归约、长度不同要协调 → 第三节末段。
- F9 四模块数据流表（含 reduce-sample 分支）→ 「不同模块需要不同通信」三个 H3 + 汇总表。
- F10 表是代码路径、不代表所有模型都构造 → 该节末段 + 常见误解第 5 条。
- F11 154880 × 4096 × 2 = 1,268,776,960 B ≈ 1.182 GiB、两片各 0.591 GiB、单矩阵口径、不证明 GLM 可用 → GLM 一节 calc 与其后说明（并补出组大小 2/1 相对 TP8 反而变大的结论）。
- F12 容量降、通信增、调用次数、收益取决于多项、不能直接换算 → 「省下的和多付的」四个因素 + 官方表后一段。
- F13 五字段、MoE、整除 DP、OProj/OLoRA 条件、配置接受≠走路径 → 怎么开 / 会报什么错 / 常见误解第 5 条。
- F14 Embedding/OProj 需 recompute、只许 D、P 侧告警关闭、混部拒绝 → GLM 一节 + 会报什么错。
- F15 按配置值判定、TP 坐标上建组、OProj 限 TP>1 不能外推 → 源码位置 + 常见误解最后一条。
- F16 聚焦归属、GLM 适用性待核、主线未被替换 → GLM 一节已按源码逐项核完适用性（能开的两项反而变大，另三项开不起来），末句保留「主线未被替换」；原「沿源码阅读路线继续核对」一句因已核完删去。
全部 16 条落地，无删除。

**验证（本轮实跑）。** `pnpm wiki:lint`：通过，本页 0 报错、0 提醒（中途一度 31 个角标触发 mark-flood 提醒，已减到 30 个，C 级 23/30 = 76.7%）。`pnpm wiki:diagrams --check`：271 张图与 spec 一致；本页三张图只有 lm_head 代码名的非阻塞提醒。`pnpm wiki:audit`：本页 26 条来源全部行号有效、0 错误；图的 pins 符号全部命中。写作标准实测（scripts/wiki/standard.ts 的 measureStandard）：5391 字、行内代码 0.0/千字、对照源码之上角标 0、calc 0.74/千字、相邻块 0、图先行、免责 0.0%、图宽合格。为了只渲染本页三张图而不改写其他写手的 SVG，临时在仓库根放过两个 tsx 小脚本调用 renderDiagram / measureStandard，已删除。未截图、未起服务，浏览器验收由审查环节负责。

**跳过。** 没读 codex-p5-common.md（派发说明要求不读）；知乎参考 403 打不开（refs/INDEX.md 已记录），只看了本地 AMD / xzclass 图；没有任何读取被拦。

**疑点（留给审查）。**
- 官方表里词表嵌入也快了 1.0 ms，但查表每步只读用到的几行，文档没解释，页末列为待核。
- lm_head 组大小 2 时 128 行补齐与 18.9 MiB 跨机 All-to-All 是按 `model_runner_v1.py#L1320-L1322` 的补齐规则与 all_to_all 语义推的，未跑。
- 「每轮固定开销在小批量时占大头」标 [I]，是一般经验。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审未改页面）。基线 vllm-ascend@db701c1f，对照 2c59ff10 / 2ed6cbba / baa023ad。

**结论：8.0 / 10。学习顺序通过；audit 本页通过；P1 1 条，P2 1 条，P3 7 条。**

### 验证记录
- `pnpm wiki:audit`：exit 0，本页 26 条来源全部 ✓（日志 scratchpad `audit-fgtp-review.txt`）。`pnpm wiki:lint`：exit 0，本页 0 报错 0 提醒（含跨页锚点；入链 lm-head.md → `#不同模块需要不同通信` 仍有效）。
- 写作标准（`std-one.mts` 调 `auditStandard`）：5391 字，行内代码 0.0/千字、角标 0、calc 0.74/千字、相邻块 0、图先行、免责 0%、图宽，全过。注意本页**不在** `scripts/wiki/standard-pages.json` 名单里，audit 不会替它把关（见 P3-7）。
- 旧版信息清单存在（旧会话 `p5/fine-grained-tp-facts.md`，F1–F16）。抽查 F3、F7、F8、F11、F14、F15 六条，新版均在（F14 的「P 侧告警关闭」在会报什么错表第 20 行）。
- 5193 未运行（ERR_CONNECTION_REFUSED），按纪律不起服务；改用 Playwright 直接渲染三张 SVG：scratchpad `fine-grained-tp-review-fine-grained-tp-intuition.png`、`…-fine-grained-tp.png`、`…-fine-grained-tp-flow.png`。第一屏整页截图未拍。

### 初学者测试（只读前两屏）
细粒度 TP 让词表嵌入、lm_head、输出投影、稠密 MLP 各自选分组：把本来各服务不同请求、各存一整份的几张卡沿 DP 方向编成一组合存一份；代价是进这层前要收集全组输入、算完把结果送回各自的卡，还要补齐、步调绑定。——能说清，通过。

### 学习顺序
是什么（定义 + 4 卡直觉图）→ 为什么（DP 重复存、读权重）与代价 → 怎么算（2 卡 8 词示意）→ 各模块差异 → 省下与多付（示意账 + 官方表）→ GLM 双机 → 误解 → 对照源码。通用节只用示意数，GLM 数字全在 GLM 一节。通过。

### 核心概念与源码核对（db701c1f）
- 配置五字段、默认 0：`ascend_config.py#L505-L515` ✓；MoE、整除 DP 的 AssertionError `#L558-L574` ✓；输出投影要 TP=1 / graph mode / KV consumer `#L518-L540` ✓；词表嵌入与输出投影绑 recompute `#L143-L161` ✓；recompute 只许 D 节点、P 节点告警关闭、混部 ValueError `platform.py#L680-L700` ✓。
- 建组 `parallel_state.py#L117-L133`：rank 网格 (PP, DP, TP)，固定 PP、TP 坐标沿 DP 每 k 个一组；GLM 双机组 2 = {i, i+8} ✓。
- 换组即换切分：`vocab_parallel_embedding.py#L64-L73` 以新组 world_size 为 tp_size ✓，所以 TP8 部署开组 2 每卡反而存更多，结论正确。
- 四模块数据流：嵌入静态缓冲 + all_gather_into_tensor + 掩码 + RS（`#L170-L210`）✓；lm_head AG → 打分 → all_to_all，enable_reduce_sample 时跳过（`#L303-L320`）✓；MLP AG dim0 / RS dim0、OProj 按特征 transpose → all_to_all_single → 矩阵乘 → RS（`linear_op.py#L183-L300`）✓；`is_moe_layer` 按 first_k_dense_replace 判定、共享专家不换（`#L801-L820`）✓。
- lm_head 补齐：`model_runner_v1.py#L1320-L1322` 为 max_num_reqs × uniform_decode_query_len ✓（32 × 4 见 D 页参数表第 82 行）。
- 版本：v0.23/v0.26 的前提检查、recompute 绑定同 db701c1f；main 无 olora、拒绝负数、lm_head 改 all_to_all_single 加整除检查 ✓。官方文档 `Fine_grained_TP.md#L29`（称支持稠密模型）、`#L93-L101`（实测表）与页面一致 ✓。

### 数字手算（全部吻合）
- 示意：8 词查表 [0,0]+[2,5]=[2,5]、[1,3]+[0,0]=[1,3]；h_A·词6 = 1×1+2×(−1) = −1；AG 每卡收 3×8×4096×2 = 196,608 B，RS 每卡发 3/4 × 32 行 = 24 行 = 196,608 B，合计 393,216 B = 384 KiB；1 GiB ÷ 4 = 0.25 GiB；ring 下 AG+RS 与 k×b 行上 All-Reduce 的 2(k−1)bH 相等。
- 官方表 5.8 + 1.51 + 0.9 + 1.51 = 9.72 GB ✓。
- GLM：19360×4096×2 = 158,597,120 B = 151.25 MiB；77440×4096×2 = 634,388,480 B = 605 MiB ≈ 0.591 GiB；154880×4096×2 = 1,268,776,960 B ≈ 1.182 GiB；MLP 18.0×8/2 = 72.0 MiB，三层 54→216 MiB；128×77440×2 = 19,824,640 B ≈ 18.9 MiB。底稿 02 第 26、119–127、188–189、228、795–798 行对得上。

### 本部署是否启用
未启用：02 第 167、789 行记两个判定默认假，D 页未传 Ascend 配置。打开后的数字全标「静态推算、没有实测」，没有把 GLM 主线数字当成该特性效果，也没有虚构部署实测数。通过。

### AMD 参考图
直觉图借了 amd-10-hi「每卡一列、每层一条横带」的骨架，但改成行 = 模块、按组画边界、右栏标进出交换，配色和图元是本站的；没有照抄。

### P1
1. **「DSA」指错实现，和 sparse-attention / glm-5-3-flash 两页矛盾**（第 260、270 行；会报什么错表第 296 行「DSA 输出投影」）。页面把 `dsa_v1.py` 叫成「DSA（DeepSeek 的稀疏注意力）那一类 attention」，并说「GLM 的稀疏 MLA 走的是另一套实现」。但 `platform.py#L812-L816` 里 `dsa_v1.AscendDSABackend` 是 use_compress=True 的 DeepSeek-V4 压缩注意力；而 sparse-attention.md 第 47 行、glm-5-3-flash.md 第 153 行写明 GLM-5.3-Flash 用的就是 DSA（它走 `sfa_v1`，02 第 365 行）。读者会读出「GLM 不是 DSA」，问答也会给出矛盾答案。改法：把这三处改成「DeepSeek-V4 的压缩稀疏 attention 实现（dsa_v1，带 compress 的那一路）」，并补半句「GLM 的 DSA 式稀疏 MLA 走 sfa_v1，不读这个字段」。

### P2
1. **「低秩输出投影」一个名字指两样东西**（第 71、200、260 行）。第 71 行说它是 v0.26 及以前单独的一项（olora 字段，main 已移除）；第 200 行说「DeepSeek 一类模型的低秩输出投影另有一套写法，交换在 attention 内部」，这其实是 **oproj 字段**作用在 DeepSeek-V4 的 wo_a/wo_b 上（`linear_op.py#L685`、`#L721`、`dsa_v1.py#L1580`），main 上还在（baa023ad `linear_op.py#L304`、`#L312`）。读者会以为 main 已经删掉了第 200 行那条路。改法：第 200 行写明「输出投影这一项碰到 DeepSeek-V4 的两段式 wo_a/wo_b 时……」，并和 olora 字段分开说。

### P3
1. 第 231 行把「输出投影变慢是因为每层多一轮通信」写成定论，页末证据标的是推断 [I]；同表里稠密 MLP 也是每层一轮却变快了，正文没交代（R1 只有前 3 层稠密）。改法：加「多半是」，再补半句 R1 只有 3 层稠密 MLP。
2. 第 96 行说词表嵌入「省下的主要是显存」，第 229 行官方表却是快了 1.0 ms，正文没对上（只在页末待核）。改法：表后加一句「文档没给分项原因」。
3. 第 254 行「lm_head All-Gather 在机内传约 1.18 MiB」：02 第 798 行的 1.18 MiB 是 All-Gather **之后**拼出的整份分数，不是每卡传的量（每卡收 7/8 ≈ 1.03 MiB）；接着又拿它和「每卡发给搭档 18.9 MiB」比。改法：写成「拼出约 1.18 MiB 的分数」，或两边都用每卡收发量。
4. 第 254 行的 32 × 4 = 128 在 D 页第 82 行已经推过，按单一出处原则这里链过去即可，不再自己乘。
5. 第一节第 71 行在定义句里塞了版本信息（「v0.26 及以前…main 已移除」），初学者第一屏用不上；挪到 GLM 一节或对照源码。第 262 行末句「官方双机主线的切法没有被本页的教学布局替换」有点像写给审稿人的话，可删。
6. 「组里的卡服务不同请求 → 入口收集、出口送回」在第 87、100–103、105–110、140、146–149、177 行讲了约 6 遍；补齐在第 114、142、219 行讲了 3 遍，第 219 行与第 114 行几乎同一句。不算注水，但第 87 行后半句和第 219 行可以删。另外第 177–179 行 MLP「入口 All-Gather、出口 Reduce-Scatter」就是 sequence-parallel 的两头，可以补一句链接、点明差别（SP 切的是同一批 token，这里是不同请求的 token）。
7. MTP（第 254 行）、W8A8（第 222 行）、稀疏 MLA（第 237 行）首次出现没有中文解释，补半句。本页没进 `standard-pages.json`，收尾时加进名单，让 audit 也检查本页。图 `fine-grained-tp.yaml` 里 RS → 卡 0 的连线贴着卡 0 外框右边走（渲染图 x≈1318），和边框重叠，可以往外让一点。

### 跳过
- 「## 对照源码」只用 grep 核对了五个 H3 的顺序和 v0.23/v0.26/main；为核对版本表和证据，另读了第 310–322、338–352 行。
- 第一屏整页截图未拍（5193 没在跑，没有起服务）。没读 codex-p5-common.md、HANDBOOK、docs/plans。所有读取都没被拦。

## P5 修订记录（10-02）

**P1（已修）。** 先核口径：sparse-attention.md 第 47 行、glm-5-3-flash.md 第 153 行都写明 GLM 用的「DSA」= DeepSeek Sparse Attention（机制名，GLM 走 `sfa_v1`，02 §5.2）；而 `dsa_v1.py` 是 `platform.py#L806-L817` 后端表里 use_compress=True 的那一路（DeepSeek-V4 压缩式 attention）。审查意见成立。改了 5 处：GLM 一节「低秩输出投影」条目（改成「DeepSeek-V4 压缩式 attention 的实现」+「GLM 用的 DSA 式稀疏 MLA 走的是另一条代码路，不读这个字段」）、常见误解第 5 条、会报什么错表的 n_local_groups 行、源码位置「GLM 的层名」条、页末证据段。frontmatter 新增来源 `platform.py#L806-L817`（C27）并在证据段引用；为保持角标 ≤30，删去与 C11 重复支撑同一句的 [C12]（is_moe_layer 定义，来源保留）。

**P2（已修）。** 「低秩输出投影」一名两指：第一节定义句改为「另有第五项只对特定模型的低秩式输出投影生效，放在后文讲」（版本信息同时移出，见 P3-5）；「四个模块放在一起看」段改写明：oproj 字段碰到 DeepSeek-V4 两段式投影（wo_a/wo_b，`linear_op.py#L685/L721`、`dsa_v1.py#L1580`）时另有一套写法，第五项 olora 也只在这一类实现里生效；版本差异表 main 一格补「输出投影作用于 DeepSeek-V4 两段式投影的写法仍在」（核了 baa023ad `linear_op.py#L304/L312`）。

**P3（7 条全修，除一条按约束跳过）。**
1. 官方表后改为「多半是因为」，补 DeepSeek-R1 只有前 3 层稠密、一次前向只多 3 轮；对应把代价清单里「模型有几十层就多几十轮」改成「有这种层的层数越多轮数越多」。
2. 表后补「词表嵌入是查表、每步本来只读用到的几行，表里也快了 1.0 ms，文档没有给分项原因」。
3. 1.18 MiB 改为「机内拼出约 1.18 MiB 的整份分数，每张卡收到其中约 7/8」。
4. 删去 32 × 4 = 128 的重推，改链接 D 页「关键参数各管哪一步」。
5. 第一节版本括注移走（版本差异表已覆盖）；删末句「官方双机主线的切法没有被本页的教学布局替换」。
6. 删第一节右栏说明里重复的「收集/送回」半句；代价清单删「补齐」条、改在引语里回指第二节；稠密 MLP 一节补 SP 链接并点明差别（SP 是同一批 token 按行分开省重复活，这里是不同请求的 token 凑组借权重）。
7. 首现补注：W8A8（权重和激活都量化成 8 位整数）、MTP（multi-token prediction，草拟层）、稀疏 MLA（压低维 + 挑位置，链 sparse-attention）；图 `fine-grained-tp.yaml` 的 RS→卡 0 连线 via x 879→889，离开外框边线，已重渲染。`standard-pages.json` 按派发约束不改（审查通过后由主会话加入名单）。

**验证（本轮实跑）。** `pnpm wiki:lint`：通过，本页 0 报错 0 提醒（角标 30，C 级 23/30）。`pnpm wiki:diagrams --check`：271 张图与 spec 一致。`pnpm wiki:audit`：本页 27 条来源全部 ✓。正文 18049 字。

## P5 复审（10-02）

复审员：Opus 5.5（独立复审，只审不改；范围为首审 P1/P2 与本轮删改）。

**结论：9.0 / 10。P1 已修好，三页口径一致；P2 已修好；新增 P1 0 条、P2 0 条、P3 3 条；audit 本页通过。**

### 验证记录
- 本轮改动对照基线：首审所读的正文即 scratchpad `fgtp/body.md`（09-29，首审行号 = body 行号 + 64，抽查第 71/200/260/296 行均对上）；与现版正文（去 frontmatter，存 `fgtp/body-now.md`）`diff` 共 19 处改动，全部落在修订记录列出的范围内，无记录外改动。
- `pnpm wiki:audit`：exit 0，本页 27 条来源全部 ✓（日志 scratchpad `fgtp/audit-rereview.txt` 第 956 行起）。`pnpm wiki:lint`：exit 0，本页 0 报错 0 提醒（`fgtp/lint-rereview.txt`）；新链接 D 页 `#关键参数各管哪一步` 由 lint 跨页锚点校验通过，D 页第 82 行确有 32 与每请求 4 token → 128。`pnpm wiki:diagrams --check`：271 张图与 spec 一致。
- 源码复核（tools/repos/vllm-ascend）：db701c1f `platform.py#L806-L817` 后端表 `(use_mla, use_sparse, use_compress)` = (True, True, False) → sfa_v1、(True, False, True) → dsa_v1 ✓；`ops/linear_op.py#L685/L721` 的 wo_a/wo_b → `DSV4OProj*`、`dsa_v1.py#L440` 判 `deepseek_v4`、`#L1580/L1585` oproj 与 n_local_groups 报错、`#L1647` olora ✓；olora 另只出现在 `context_parallel/dsa_cp.py#L1257`，它的 Impl 继承 dsa_v1 的 `DSAAttentionImpl`，仍属同一实现，「只在 DeepSeek-V4 压缩式 attention 里被读到」成立。baa023ad `linear_op.py#L304/L312` wo_a/wo_b 仍在、vllm_ascend 下已无 olora ✓。GLM 侧：`models/glm5_next.py#L175-L178` 直接返回 `AscendIndexerKPoolMLABackend`，其 Impl 继承 `AscendSFAImpl`（`indexer_kpool_mla_v1.py#L557`），该文件不读 oproj/olora ✓。

### P1 复核（DSA 叫法）：已修好
- 本页现文：第 260 行（GLM 一节）写「低秩输出投影只在 DeepSeek-V4 压缩式 attention 的实现里被读到；GLM 用的 DSA（DeepSeek Sparse Attention）式稀疏 MLA 走另一条代码路」；第 270 行（误解）、第 296 行（报错表，改为「DeepSeek-V4 压缩式 attention 的输出投影」）、第 334 行（源码位置，dsa_v1 = 后端表里带 compress 的那一路，GLM 的 DSA 式稀疏 MLA 走 sfa_v1）、第 344 行（证据段）口径相同。全文已无「DSA（DeepSeek 的稀疏注意力）那一类」或把 dsa_v1 称作 DSA 的说法。
- 对照：sparse-attention.md 第 47 行、glm-5-3-flash.md 第 153 行都写 GLM-5.3-Flash 沿用 DeepSeek-V3.2 的 DSA（DeepSeek Sparse Attention）。三页都把「DSA」当机制名、并明说 GLM 用它；本页只说 dsa_v1 这个**实现**不是 GLM 那条路。读者不会得出「GLM 不用 DSA」。
- 范围外发现（不计入本页）：**prefix-caching.md 第 140 行**说「GLM 稀疏注意力层文件里」有关 APC 的死分支、「这条路上后端固定是 `AscendDSABackend`」。实际该文件 `models/layer/attention/layer.py` 的 `DSAAttention` 是 DeepSeek-V4 的 attention 层（import 了 `DeepseekV4SWACache`，被 `models/deepseek_v4.py#L103`、`ops/dsa.py#L33` 引用），GLM 的后端名是 `ASCEND_INDEXER_KPOOL_MLA`（`indexer_kpool_mla_v1.py#L528`）。这句与本页、sparse-attention、glm-5-3-flash 三页口径冲突，会让读者以为 GLM 走 AscendDSABackend。建议主会话另派该页修：改成「DeepSeek-V4 的 DSA 层文件里……」，GLM 侧另说明它根本不经过这段代码。

### P2 复核（低秩输出投影一名两指）：已修好
- 第 72 行定义句改为「另有第五项只对特定模型的低秩式输出投影生效，放在后文讲」，不再和 oproj 混名；第 201 行写明是「输出投影这一项碰到 DeepSeek-V4 压缩式 attention 的两段式投影」时另有写法，并单独点出第五项「低秩输出投影」也只在这类实现生效；第 316 行版本表 main 一格补「输出投影作用于 DeepSeek-V4 两段式投影的写法仍在」。读者不会再以为 main 删掉了 wo_a/wo_b 那条路。与源码一致。

### 本轮删改是否丢信息：未丢
- 定义句删掉的版本括注（v0.26 及以前有低秩输出投影、main 移除）由第 316 行版本表覆盖。
- 第一节右栏说明删掉的「先收集、再送回」半句，第二节与各模块小节均有。
- 32 × 4 = 128 改链 D 页，D 页参数表给出 32、4 与 128，可追溯。
- 代价清单删去的「补齐」条并入引语（回指第二节第 115 行，那里讲了补齐），清单剩三条，与「还要看三件事」对上。
- 删去的「官方双机主线的切法没有被本页的教学布局替换」属写给审稿人的话，无信息。
- 证据段删 [C12]：来源仍在 frontmatter，[C11]（`linear_op.py#L673-L790`）里的 `not is_moe_layer(prefix)` 足以支撑「只换非 MoE 层」；但见 P3-2。

### 新增 P3
1. 第 344 行「该实现与 GLM 走的 sfa_v1 在平台后端表里分属两路 [C27]」与第 334 行的写法暗示 GLM 是经后端表选到 sfa_v1 的；实际 GLM 由 `glm5_next.py#L175-L178` 直接绑定 `AscendIndexerKPoolMLABackend`（Impl 继承 sfa_v1 的 `AscendSFAImpl`），不经后端表。结论「GLM 不读这个字段」没错，只是证据不精确。改法：第 334 行写成「GLM 直接绑定 indexer_kpool_mla_v1 的后端（继承 sfa_v1）」，证据段加 glm5_next 那几行。
2. 删 [C12] 后，第 332 行「`is_moe_layer` 按 `first_k_dense_replace` 等判定」在证据段没有角标指向 `linear_op.py#L801-L820`。角标上限紧时可不加，但最好在证据段那句后补回或改挂到该句。
3. frontmatter `updated` 仍是 2026-09-29（第 62 行），本轮 10-02 有实质改动，宜改为 2026-10-02。

### 跳过
- 只复核 P1/P2 与本轮 diff，未重审整页讲法与数字（首审已过）；未复看渲染图（diagrams --check 通过）。`standard-pages.json` 仍未加入本页，按派发由主会话处理。没读 HANDBOOK、basics-standard.md。所有读取都没被拦。

**跨页顺带修（10-02，主会话指派）。** prefix-caching.md 第 140 行把 `DSAAttention` 层文件（`models/layer/attention/layer.py`，持 `DeepseekV4SWACache`，引用方是 `models/deepseek_v4.py`）误写成「GLM 稀疏注意力层文件」。按 sparse-attention / glm-5-3-flash 口径改为「DeepSeek-V4 压缩式 attention 的层文件」，句末补「GLM 的 DSA 式稀疏 MLA 也不走这个文件（链 sparse-attention）」；来源 C17 行号扩为 `layer.py#L100-L120` 以覆盖 `DeepseekV4SWACache` 一行。死分支结论本身不变。该页其他内容未动。`pnpm wiki:lint`、`pnpm wiki:audit`：prefix-caching 0 报错（25 条来源全 ✓）。
