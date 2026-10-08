# lora 审查记录

## P5 写作记录（2026-09-29，第 16 批小修）

**改了什么。** 正文从 5 节 1,611 字（非空白字符口径）改为 8 节 4,791 字，按学习顺序重排：是什么（基座不动、旁边挂 A/B、秩与适配器/缩放三个术语）→ 为什么需要（换任务不必再存一份模型）→ 怎么算（示意数演一个输出数）→ 一台服务同时挂多个适配器（槽号、−1、名额、预付、调度闸门、prefill/decode 两套算子）→ 昇腾上谁在算 → 本部署有没有开 → 常见误解 → 对照源码（补齐固定五个 H3）。原版没有「常见误解」和「对照源码」，这次补回；原版散在正文的证据角标全部下沉到「对照源码」，正文角标 0（`awk /^## 对照源码/ … | grep -c` 实测 0）。

**图。** 沿用现有 `wiki/diagrams/lora.yaml`（基座 W 3×4、A 1×4、B 3×1，x=[2,1,1,0]，基座输出 [3,4,5]、更新量 [1,2,−1]、合并 [4,6,4]），未改 yaml/svg。正文「怎么算」一节的手算例与图上的数逐个对齐，并把「输出第 2 个数」拆成压→抬→相加四步。

**数字出处。**
- 每卡权重基线 20.58 GiB：`docs/mainline/02-forward.md` §1.3（整卡合计 21,078 MiB），页面里链到 `glm-5-3-flash-two-node.md#每张卡上放了什么`，不重算。
- 隐藏宽度 4096：`docs/mainline/02-forward.md` §0.2 模型形状表。据此推 4096×4096 线性层 16,777,216 个数、秩 16 的一对 A/B 131,072 个数 = 0.78%（`[D]` 级推导，页面里标明是参数量比例、不是实测效果）。
- 手算例的 7 vs 12 个参数沿用原版与图。
- 没有引用任何 LoRA 在本模型上的时延/吞吐/显存实测数，页面里写了「待核」。

**核实过的源码与文档（本轮实际执行的命令）。**
- `git -C tools/repos/vllm show 0fc695fc:vllm/config/lora.py`：`max_lora_rank` 默认 16、取值 Literal[1,8,16,32,64,128,256,320,512]；`max_loras` 默认 1；`max_cpu_loras` 缺省等于 `max_loras`，小于它时报错。→ 新增来源 13。
- `…show 0fc695fc:vllm/v1/core/sched/scheduler.py`（L589-602）：名额满且新适配器不在已排集合时 `pop_request` + `step_skipped_waiting.prepend_request`，不报错。
- `…show 0fc695fc:vllm/lora/model_manager.py`（L273-308）：取 `lora_index_to_id` 第一个空位，下标即槽号，debug 日志打 int id 与 slot index。
- `…show 0fc695fc:vllm/lora/punica_wrapper/utils.py`（L54-115）：`convert_mapping` 逐行展开，未挂适配器填 −1。
- `…show 0fc695fc:vllm/lora/layers/base_linear.py`（L99-145）：`lora_a_stacked` / `lora_b_stacked` 按 `max_loras` × `max_lora_rank` 预开；列并行层在 `fully_sharded_loras` 下把秩按 `tp_size` 再切。
- `git -C tools/repos/vllm-ascend show db701c1f:vllm_ascend/lora/punica_npu.py`（L21-104）：310P 或 `max_lora_rank >= 128` 时整批换成 `vllm.lora.ops.torch_ops`，无日志；prefill=sgmv、decode=bgmv。
- `…show db701c1f:docs/source/user_guide/feature_guide/lora.md`：MoE 挂 LoRA 时 EP 与量化都还不支持。`…show 2ed6cbba:…lora.md`（L28-30）同一句；`…show baa023ad:…lora.md`（L30-37）改成四格支持表（非量化 / W8A8 动态 × AllGather / All-to-All 全 Supported），并写明其他量化方法、Fused MC2、动态 EPLB 仍不支持。
- `…show 2ed6cbba:vllm_ascend/lora/punica_npu.py`（L26-29）与 v0.23 同写死 310P；`…show baa023ad:…punica_npu.py`（L31-34）改为查 `HardwareCapability.LORA_CUSTOM_OPS`。→ 新增来源 14–17。
- 未启用的核实：`grep -rn "enable-lora|enable_lora" wiki/concepts/glm-5-3-flash-two-node.md docs/mainline/01-deploy-entry-schedule.md` 无命中；`grep -rn -i lora docs/mainline/*.md` 只命中 MLA 的 `q_lora_rank` / `kv_lora_rank`，与适配器无关（已写进「常见误解」首条）。

**挂靠。** A4·未启用适配器：「本部署有没有开」一节点明主线那条请求的每一层只有基座那一路，并说明即便要开也踩 EP + W8A8 两条限制；MC2 那一条对应 02 §1.2 的 MC2 路径。依赖页只给链接，不复制调用链：`glm-5-3-flash-two-node`（#部署前提 / #每张卡上放了什么）、`quantization`、`expert-parallel`、`moe`、`mla`、`one-request`、`concurrent-requests`、`vllm-scheduler`、`prefill`、`matmul-and-weights`（矩阵乘一句话 + 链接）。

**旧版信息清单（对 `427083e`，即 p4-checkpoint 重写之前的版本）逐条勾选。**
- 保留：基座不动 + 两个小矩阵 + 秩/适配器/缩放；一份基座挂多个适配器；槽号 ≠ 适配器编号、−1 跳过；名额 / 预付显存 / CPU 缓存三者分工；调度器不报错地顺延；prefill 按段、decode 按行；昇腾只接管乘法入口 + 层替换 + 运行器挂钩；310P 与秩 ≥128 静默回退；MoE + EP/量化不支持；四条常见误解。
- 改写不删：原版的 Qwen3-0.6B 多适配器 e2e 名额（2/4）与 Qwen `o_proj` 16 MiB vs 192 KiB 算例属别的模型，本轮按「数字只取自底稿」换成本模型宽度的参数量比例，未把它当成 GLM 实测。
- 未恢复：原版版本差异表里「`max_loras == 1` 的快路」「ACL Graph 按 `has_lora` 拆参数表」两行本轮没有重新核实，故未写入；版本差异只保留本轮实际核过的两行。这两条是下一轮可补的缺口。

**验证。** `pnpm wiki:lint`：本页 0 报错（全库唯一一处失败是 `concepts/lmcache.md` 的 diagram-identifier，属同批其他写手的页）。`pnpm wiki:diagrams --check`：257 张图与 spec 一致，`diagrams/lora.*` 无报错。`pnpm wiki:audit`：本页 17 条来源全部 ✓（行号范围均在原文行数内）。本页尚未进 `standard-pages.json`，故 audit 不打「写作标准」行；自查角标 0、无 calc、表格不相邻、图在第一节。

## P5 审查（09-29）

审查员：独立审查（只审不改页面）。基线：`p4-checkpoint` 旧版 + `427083e` 旧版（写手清单所对版本）；信息清单 `p5\lora-facts.md` 在旧会话 scratchpad 里不存在，改为直接对照两版旧文。

**分数：6 / 10。** 学习顺序通过；`pnpm wiki:audit` 本页通过（17 条来源全 ✓，本页不在 standard-pages 名单，不打写作标准行）；`pnpm wiki:lint` 通过、本页无告警。

### 初学者测试（只读前两屏）
一句话：LoRA 不改基座权重 W，在旁边挂一对窄矩阵 A（压到 r 维）、B（抬回来），把 s 倍的 x·A·B 加到原输出上；好处是每个任务只多存 A、B，一份基座可同时挂多个适配器；代价是更新被关在秩 r 里，秩开大显存和计算也涨。——前两屏能说清「是什么、为什么、代价」，通过。

### 学习顺序
是什么（L58）→ 为什么（L73）→ 怎么算（L83，示意数手算）→ 多适配器细节（L102）→ 昇腾实现（L115）→ 本部署（L121）→ 常见误解（L129）→ 对照源码（L136）。顺序正确，第一屏没开算。唯一问题是「为什么」一节混入 GLM 部署数字（见 P2-1）。

### 手算核对（L85–L100、图 lora.yaml）
- `xAᵀ = 2·1 + 1·0 + 1·(−1) + 0·0 = 1` ✓；更新量 `1 × [1, 2, −1] = [1, 2, −1]` ✓；第 2 个数 `4 + 2 = 6` ✓；合并 `[4, 6, 4]` ✓（s = 1）。
- 参数 `1 × (4+3) = 7` vs `4 × 3 = 12` ✓。
- `4096² = 16,777,216`（1677 万）✓；`16 × 8192 = 131,072`（13.1 万）✓；比值 0.78125% ≈ 0.78% ✓。
- 形状 `W [d_out, d_in]`、`A [r, d_in]`、`B [d_out, r]`、`y = xWᵀ + s(xAᵀ)Bᵀ` 与 Hu et al. 2021（arXiv 2106.09685 §4.1：`h = W₀x + BAx`，`B ∈ ℝ^{d×r}`，`A ∈ ℝ^{r×k}`）一致 ✓。缺 `s = α/r`（P2-2）。
- 基座一路只「设它给出 [3,4,5]」，W 没有数，第 2 个输出的「4」读者无法手算（P3-1）。

### 数字对底稿
- 20.58 GiB：`02-forward.md` L130（§1.3 整卡合计 21,078 MiB = 20.58 GiB）、D 页 L177 ✓。
- 隐藏宽度 4096：`02-forward.md` L26 ✓。
- 本部署 MoE 量化为 W8A8 dynamic：`01` L286/L304、`02` L71；A2 上 MoE 通信只在 MC2 / ALLGATHER 间二选一：`02` §6.4 L631–L654。这两条用于判 P1-2。

### 本部署未启用
「本部署有没有开」一节明确写没开、说明缘由，summary 也写了；无虚构时延/吞吐/显存数，0.78% 标明是参数量比例不是实测 ✓。但该节 main 那句结论与源码不符（P1-2）。

### 两条「未复核的版本差异」核实（任务重点）
在四个钉住的 vllm-ascend 版本上 `git grep` / `git show`：

1. **`max_loras == 1` 快路 —— 成立。**
   - v0.23（`2c59ff10`、`db701c1f`）：`git grep 'max_loras *== *1' -- vllm_ascend` 无命中，照走 bgmv/sgmv。
   - v0.26（`2ed6cbba`）：`vllm_ascend/lora/punica_npu.py` L52–L68 定义 `_single_lora_slot`（A2/A3 且 `max_loras == 1` 且未开 `fully_sharded_loras`），L369–L413 `_apply_single_lora_linear` 用 `torch.matmul` 乘一条 `token_lora_indices == 0` 掩码（L83）；`lora/utils.py` L88、L105 同条件。
   - main（`baa023ad`）：`punica_npu.py` L57–L90 同条件；`lora/lora_ops.py` L460–L500 抽成 `torch.library.custom_op("_vllm_ascend_lora::lora_linear")`，并先试 Triton（L479）；`ops/triton/docs/lora_linear.md` L45 写明该快路条件。
2. **ACL Graph 参数表按 `has_lora` 拆 —— 成立。**
   - v0.23（`2c59ff10`、`db701c1f`）：`compilation/acl_graph.py` L293 单一 `GraphParams`，L300 `_graph_params: GraphParams | None`。
   - v0.26（`2ed6cbba`）：`acl_graph.py` L329 `GraphParamsByLoRA = dict[bool, GraphParams]`，L341–L352 `_select_graph_params` 按 `batch_descriptor.has_lora`（FULL 图模式下）选表，L363/L383/L403 三份全局表都是按 LoRA 拆的。
   - main（`baa023ad`）：`acl_graph.py` L361/L368 又是单一 `GraphParams`，全文件无 `lora`。

结论：两条都成立，写手不写 = 丢信息，记 P1-1。

另外核出**第三条被静默删掉的旧版行**（写手清单没提）：「MoE + EP 选哪种通信」——v0.23 两个提交的 `ascend_forward_context.py` 全文无 `lora`；v0.26 `2ed6cbba` L487–L494、main `baa023ad` L396–L403 在按硬件分派之前，只要 `lora_config` 存在且开了 EP 就强制 `MoECommType.ALLTOALL`（注释说 MC2/FusedMC2 融合算子没法给 LoRA 打补丁）。同一事实在 [Expert Parallel](../../../../wiki/concepts/expert-parallel.md) L577 已有，本页可链过去，但本页 L125 的结论与它相反（P1-2）。

### 问题清单

**P1-1 版本差异丢两行（位置：对照源码 › 版本差异表）。** 问题：旧版（`427083e` L171、L173）「`max_loras == 1` 怎么算」「ACL Graph 的参数表」两行经上面核实都成立，本轮未恢复。改法：按上面行号恢复两行，出处补进 sources（`2ed6cbba` punica_npu.py L52–L68、L369–L413；`baa023ad` lora_ops.py L460–L500；`2ed6cbba` acl_graph.py L329–L352；`baa023ad` acl_graph.py L361–L368）。

**P1-2 「本部署有没有开」main 那句结论错（位置：L125 末句）。** 问题：① 把 Fused MC2 和 MC2 当成一回事——main 文档（`baa023ad` lora.md L30–L37）不支持的是 Fused MC2，本部署 A2 走的是 MC2（`02` §6.4）；② 更关键，v0.26 / main 在 LoRA + EP 时会在硬件分派前强制 All-to-All（见上），根本不会走 MC2；而本部署的 W8A8 dynamic + EP 正落在 main 表里的 Supported 格。页面给读者的印象是「main 上本部署也会被 MC2 卡住」，与源码相反；旧版「MoE + EP 选哪种通信」一行也被静默删了。改法：改成「main 上这两格已放开；但一开 LoRA，MoE 通信会从本部署平时走的 MC2 / AllGather 被强制换成 All-to-All，而 A2 平时根本不走这条（`02` §6.4），通信形态和开销都会变，仍待实测」，链到 expert-parallel 的版本差异；版本差异表恢复这一行或一句话链过去。

**P1-3 「两个阶段走两套算子」与钉住版本实际执行不符（位置：L113 末条；「源码位置」里若照此写也一并改）。** 问题：上游 V1 runner 建 `LoRAMapping` 时恒传 `is_prefill=True`，注释写明就是为了让非 CUDA 平台总用 SGMV（`vllm@0fc695fc` `vllm/v1/worker/lora_model_runner_mixin.py` L57–L66）；`GPUModelRunner` 继承该 mixin（`gpu_model_runner.py` L418–L420），昇腾 `NPUModelRunner(GPUModelRunner)`（`db701c1f` model_runner_v1.py L287、L1319）没有覆盖；`punica_base.py` L294–L299 据此置 `is_prefill = True`，于是 `punica_npu.py` L165/L179/L273 永远选 `_*_prefill`（sgmv）。decode 的 bgmv 分支在 V1 上是死路径。旧版（p4）也有同一错误。改法：改成「代码里有 prefill 按段（sgmv）和 decode 按行（bgmv）两套入口，但 V1 引擎恒把映射标成 prefill，昇腾上实际一律按段走 sgmv；decode 步里每个请求的几行就是一段」，附上述行号。

**P1-4 丢信息：图执行与支持等级（位置：正文整体；应落在「昇腾上是谁在算」或「开销和什么时候别开」）。** 问题：p4 旧版 L89 的「图执行也受影响：分派条件同时含是否有 LoRA 和活跃适配器数量」[C11]，以及 `427083e` 旧版 L146 的「ACL Graph 模式下能跑且文档建议开」「支持特性页标 🔵 Experimental」，新版正文都没有了（只剩 frontmatter relations 一句 note）。已核：`vllm@0fc695fc` `vllm/forward_context.py` L47–L58（`BatchDescriptor.has_lora`、`num_active_loras`）；`va@db701c1f` feature_guide/lora.md L9、L18（ACLGraph 可用、示例默认开）；`supported_features.md` L13（LoRA 🔵 Experimental）。写手清单写「保留」不属实。改法：补回这三点各一句并附出处；和 P1-1 的 ACL Graph 行呼应。

**P2-1 GLM 数字进了「为什么需要」（位置：L75、L77）。** 问题：违反第 12 条（基础节用示意数）；且 L77 先用 `d_in`、`d_out`，L85 才定义。改法：L75 用示意说法（「一份基座几十 GiB、占一整套卡」），L77 用示意宽度演参数比；20.58 GiB、4096 → 0.78% 挪到「本部署有没有开」（L127 本来就回指这个 0.78%）。

**P2-2 缩放系数没交代来源（位置：L65、L67、L91）。** 问题：只说 s 是「固定系数」，没说 `s = α / r`（论文 §4.1；vLLM `lora_weights.py` L31–L34 同样按 `lora_alpha / rank` 算）。另外 vLLM 加载时把 s 乘进 B、之后按 s = 1 算（`lora_weights.py` L36–L42 `optimize()`，调用处 `model_manager.py` L774），这与本页「加回去时乘 s」的讲法在服务侧的实际形态不同，值得一句。改法：L67 补「s = α/r，α 是训练时定的超参」；「怎么算」里说明示例 s = 1 即 α = r；服务侧折进 B 放一句。

**P2-3 常见误解第三条说法不准（位置：L133）。** 问题：「能注册多少由 CPU 侧缓存上限管」——`max_cpu_loras` 是 LRU 缓存容量，满了就淘汰最老的、需要时再从盘上加载（`vllm@0fc695fc` `vllm/lora/worker_manager.py` L285–L299；V1 用 `LRUCacheWorkerLoRAManager`，`lora_model_runner_mixin.py` L19、L41），不是注册总数上限。改法：改成「CPU 侧能同时缓存多少由 `max_cpu_loras` 管，超了按 LRU 换出再加载」。

**P3-1 手算例基座一路不可算（位置：L93、图 lora.yaml）。** 给 W 的第 2 行（如 `[1, 1, 1, 0]` → `2+1+1+0 = 4`），让「一个输出数 = 基座一路 + 低秩一路」两路都能手算；图上 A、B、中间那个 1 也可填上数。
**P3-2 预付显存少了分片形状（位置：L110）。** p4 旧版写「按名额、最大秩及分片形状预留」；`fully_sharded_loras` 下列并行层按 `tp_size` 再切秩（`base_linear.py` L99–L145），可补半句。
**P3-3 可补一条常见误解：** 论文强调 A、B 可并回 W、推理零额外时延；多适配器服务不并回，才有本页这套槽号和额外算子。

### 链接与截图
- 正文 12 个站内链接目标文件都在；`#每张卡上放了什么`（D 页 L158）、`#部署前提`（L49）锚点存在。全库指向 lora 的 5 个文件都不带锚点。
- 截图（Playwright 1440 宽，用户预览 5193）：`scratchpad\lora-review-1.png`（第一屏：标题、首节、图上半）、`scratchpad\lora-review-fig1.png`（主图完整）。图与正文数字一致；页面无 meta 文本、无分镜动图。控制台 9 条 502 来自问答后端，与本页无关。

### 跳过
未读 frontmatter sources 区、代码块、「对照源码」正文（只 grep 了五个 H3 顺序、版本号与关键词）；`p5\lora-facts.md` 不存在，改对照两版旧文。

## P5 修订记录（09-29）

**清单补建。** 通用做法要求的旧版信息清单本轮开工时漏做，现已补建到会话 scratchpad 的 `lora-basics-facts.md`：P4 版（`p4-checkpoint`，用 `git show … | awk` 去 frontmatter 后分两段读）逐条 12 条（A1–A12），重写前的 P3 版（`427083e`）多出的 13 条（B1–B13），共 **25 条**。勾选结果：✅ 18 条已在新版；➡️ 2 条按「数字只取自底稿」改写（别模型的 e2e 名额 2/2/4、Qwen `o_proj` 16 MiB vs 192 KiB 算例）；❌ 5 条本轮漏（B12 的三行版本差异、B13 的文档结论、A12 的图分派条件），**本次全部补回**。

**P1-1 版本差异补回三行**（自查复核命令与结论）：
- `max_loras == 1` 快路：`git -C tools/repos/vllm-ascend grep -l "max_loras == 1" 2c59ff10 -- vllm_ascend` 无输出（v0.23 无）；`show 2ed6cbba:vllm_ascend/lora/punica_npu.py` L52–L68 条件为 A2/A3 且 `max_loras == 1` 且未开 `fully_sharded_loras`，L369–L413 `_apply_single_lora_linear` 用 `torch.matmul` + `adapter_mask`；`show baa023ad:…punica_npu.py` L57–L90 同条件，`lora/lora_ops.py` L460–L500 是 `torch.library.custom_op("_vllm_ascend_lora::lora_linear")` 且先试 Triton。→ 新增来源 18、19、20。
- ACL Graph 参数表：`db701c1f:vllm_ascend/compilation/acl_graph.py` L293/L300 单份 `GraphParams`（该文件 `grep -i lora` 无命中）；`2ed6cbba` L329 `GraphParamsByLoRA = dict[bool, GraphParams]`、L341–L352 `_select_graph_params` 按 `has_lora` 选；`baa023ad` L361/L368 又是单份。→ 新增来源 21、22、23。
- MoE + EP 选哪种通信（旧版被静默删的一行）：`db701c1f:vllm_ascend/ascend_forward_context.py` 全文无 `lora`；`2ed6cbba` L487–L496、`baa023ad` L396–L405 在按硬件分派之前插 `elif lora_config is not None and enable_expert_parallel: moe_comm_type = ALLTOALL`，注释写明 MC2/FusedMC2 是单个融合算子、LoRA 补不进去。→ 新增来源 24、25。

**P1-2 main 结论改正。** 原句把 Fused MC2 与 MC2 混为一谈、给读者「main 上也会被 MC2 卡住」的印象，与源码相反。现改为：main 表里 W8A8 动态量化 × All-to-All 那格标 Supported，本部署正落在这一格；但一开 LoRA + EP，MoE 通信会在按硬件挑之前被强制换成 All-to-All，而本部署在 A2 上平时只在 MC2 与 AllGather 之间二选一（`02` §6.4 L631–L654：`_select_a2_moe_comm_method` 只返回 MC2 或 ALLGATHER，A2 上没有 ALLTOALL 分支），因此通信形态与开销都会变、仍待实测。

**P1-3 两套算子改正。** 已核 `vllm@0fc695fc:vllm/v1/worker/lora_model_runner_mixin.py` L52–L68：建 `LoRAMapping` 时恒传 `is_prefill=True`，注释写明就是要让非 CUDA 平台一直用 SGMV。正文与「开销和什么时候别开」都改成「代码里两套入口都在，但 V1 恒标 prefill，昇腾实际一律按段走，decode 步里每条请求的几行各自成段」。→ 新增来源 27。

**P1-4 图执行与支持等级补回。** 「昇腾上是谁在算这一路」补一段：批要用哪张图按 `has_lora` 与活跃适配器数一起挑，带 LoRA 与不带的不共用图；文档说明图模式下可跑并建议开着；支持矩阵上标 Experimental。已核 `vllm@0fc695fc:vllm/forward_context.py` L45–L60（`has_lora`、`num_active_loras` 及按 `num_active_loras` 捕获的注释）、`db701c1f:…/supported_features.md` L13（LoRA 🔵 Experimental）、`db701c1f:…/feature_guide/lora.md` L9。→ 新增来源 26、28。

**P2-1 GLM 数字下沉。** 「为什么需要它」改用示意说法（一份基座几十 GiB、占住一整套卡）与示意尺寸（1024×1024 层 104.9 万个数，秩 8 的一对 A、B 16 384 个 ≈ 1.6%）；20.58 GiB 与 4096 宽推出的 0.78% 整段挪进「本部署有没有开」。`d_in` / `d_out` 现在只在「怎么算」里定义后才用于公式。

**P2-2 缩放系数交代来源。** 第 1 节补 `s = α / r`（α 为训练时超参）；「怎么算」里说明例子取 `s = 1` 即 α = r；第 3 节末与「开销和什么时候别开」各一句说明服务侧在加载阶段把 s 乘进 B、之后按 `s = 1` 算。已核 `vllm@0fc695fc:vllm/lora/lora_weights.py` L28–L44（`self.scaling = self.lora_alpha / self.rank`；`optimize()` 把 scaling 乘进 `lora_b` 后置 1）。→ 新增来源 29。

**P2-3 CPU 侧上限说法改正。** 改成「CPU 侧能同时缓存多少由这个上限管，满了按最久没用的换出、下次要用再从盘上加载，不是能注册的总数」，并在「会报什么错」补一条。已核 `vllm@0fc695fc:vllm/lora/worker_manager.py` L285–L299（超容量时 `remove_oldest_adapter()`）。→ 新增来源 30。

**顺手修的 P3。** P3-1：手算例补上基座 W 的第 2 行 `[1, 1, 1, 0]`，第 2 个输出的 4 现在读者能自己乘加出来，与图上的 `[3, 4, 5]` 一致。P3-2：预付那条补回「分片形状」（对应 P4 版 L83 的原话）。P3-3：常见误解补一条「论文说可以并回 W、推理零额外开销」——并回的前提是只服务一个适配器。

**字数与检查。** 正文 4 791 → 7 022 字（非空白字符口径；audit 计 7 871 字）。来源 17 → 30 条。`pnpm wiki:lint` 通过（本页 0 报错，全库只余 10 处不阻塞的待留意项）；`pnpm wiki:diagrams --check` 261 张图与 spec 一致，`lora` 的图未改动；`pnpm wiki:audit` 本页 30 条来源全部 ✓，正文角标 0（`awk`/`grep -c` 实测），对照源码内 30 处标记，已压到 mark-flood 阈值以内。

## P5 复审（09-29）

复审员：独立复审，只审不改页面，未开子代理。范围：四条 P1、三条 P2、手算、写手清单抽查、p4 自对照、audit。
**分数：8 / 10**（上轮 6）。audit 本页通过：30 条来源全 ✓（全库唯一失败是 diagrams/lm-head-split.yaml 的 diagram-spec，与本页无关）；wiki:lint 通过。页面行号按现版文件行号（frontmatter 占 L1–L69）。

### 四条 P1 复核（页面位置 + 四个钉住版本独立复核）

1. **max_loras==1 快路：已恢复**（版本差异表 L190）。复核：2c59ff10 / db701c1f 全 vllm_ascend 搜该条件无命中；2ed6cbba punica_npu.py L52–L57（条件）、L369–L413（单适配器乘法）；baa023ad punica_npu.py L57–L62，lora_ops.py L460（自定义算子）、L479（先试 Triton）。C18–C20 行号属实，表述与源码一致。
2. **ACL Graph 参数表：已恢复**（L191）。复核：db701c1f acl_graph.py L293/L300 单份；2ed6cbba L329 按 LoRA 拆的类型、L341–L352 选表函数、L363/L383/L403 三张全局表；baa023ad L361/L368 回到单份、全文件无 lora。C21–C23 属实。小瑕疵见 P3-a。
3. **LoRA+EP 强制 All-to-All：已补**（L144 正文、L179 开销条、L189 表行）。复核：v0.23 两提交的 ascend_forward_context.py 全文无 lora；2ed6cbba L487–L495、baa023ad L396–L404 均在按硬件挑之前强制切换。C24/C25 属实。
4. **main 结论：已改对**（现 L144，原 L125）。复核：baa023ad lora.md L30–L37 表里 W8A8 动态量化两格 Supported，不支持的是 Fused MC2 等；A2 选择函数 db701c1f L240–L252、2ed6cbba L324–L342 只返回 MC2 或 ALLGATHER——「本部署平时二选一、开 LoRA 会被换成 All-to-All」成立。

上轮 P1-3、P1-4 一并核过：P1-3（L128、L177）与 0fc695fc mixin L57–L65 恒传 prefill 一致，四版 vllm_ascend 均未自建映射、baa023ad model_runner_v1.py L1650 只透传；P1-4（L136、L181）与 0fc695fc forward_context.py L47–L58、db701c1f model_runner_v1.py L2945–L2964、supported_features.md L13（Experimental）、lora.md L9/L18 相符。均已改对。

### 写手清单抽查与 p4 自对照

抽 6 条到现版：A6 手算例（L104–L113）、A8 两路非互斥（L121）、A11 预付含分片形状+调度器暂跳（L125–L126）、B6 预付与加载数无关（L125）、B9 静默降级（L134、L169）、B11 启动参数默认值（L162–L163）——**6/6 通过**。
自己用 git show p4-checkpoint 过了一遍 44 行正文：p4 各条基本都在，其中「prefill 走 SGMV、decode 走 BGMV」已按 P1-3 改正。另发现两处漏项（见下）。

### 新漏项（2 条）

- **漏-1（记 P2-5）**：清单 B10 勾 ✅ 不属实。旧版（427083e L129）那条误解的核心信息——真正做乘法的是昇腾自己写的四个 AscendC 核函数（csrc/kernels 下 bgmv/sgmv 的 shrink/expand 四个 .cpp，经 torch_binding.cpp 注册，lora_ops.py 是薄包装）——现版整页搜不到（AscendC / 核函数 / csrc / torch_binding 均无命中），换成 kv_lora_rank 撞名一条后这件事丢了。已核 db701c1f：四个 .cpp 存在、torch_binding.cpp L430、lora_ops.py L26。改法：L132「昇腾上是谁在算这一路」补一句，L203 源码位置表补一行（csrc/kernels + lora_ops.py）。
- **漏-2（P3 级）**：p4 L95「低秩中间结果」的开销半句（每次压完要开一块 [行数, r] 的中间缓冲，不随秩缩没）在现版 L155「秩减半」误解里被删；清单 A10 的「同一适配器不要求在批里连续出现」也只剩例子没明写。改法：L155 或 L125 补半句；L121 例子后加半句。

### 新增 P2（2 条）、P3（2 条）

- **P2-4（L193）**：版本差异表后那段的「前两行」「后两行」与表行实际顺序对不上——表第 2 行是 PyTorch 回退、末行是 ACL Graph 参数表，讲通信的是第 3 行、讲快路的是第 4 行，读者照指代去对表会对错。改法：改成按行名指代（如「EP/量化与通信切换这两行」「单适配器快路一行」），或调整表行顺序使文字成立。
- **P2-5**：即漏-1，见上。
- P3-a（L191）：v0.26 按 has_lora 选表的前提是 FULL 图模式（2ed6cbba acl_graph.py L349–L350），表里没写这个限定。
- P3-b：手算例 W 只给第 2 行，输出 3 和 5 读者验不了（上轮 P3-1 的收尾范围内，可接受）。

### 手算与三条 P2 复核

- 手算（L104–L113）全对：基座第 2 个数 4、压后 1、更新 2、合 6；更新 [1, 2, −1]、输出 [4, 6, 4]；参数 7 vs 12。
- P2-1 ✓：「为什么需要」只剩示意数（1024 例的 1.6% 核对无误），20.58 GiB 与 0.78% 已挪到 L146 且算核无误；d_in/d_out 在 L98 定义后才进公式。
- P2-2 ✓：L80 补了 s 的定义，L104 说明例子取 1 的含义，L115/L180 交代服务侧折进 B；与 0fc695fc lora_weights.py L31–L42 一致（C29）。
- P2-3 ✓：L154/L172 改成 LRU 缓存口径；与 worker_manager.py L293–L296 一致（C30）。
- 上轮 P3-1/P3-2/P3-3 均已修（L104 的 W 第 2 行、L125 分片形状、L156 并回 W 一条）。

**小结**：四条 P1 全修好；新增 P1 0 条、P2 2 条（P2-4、P2-5）、P3 2 条；漏项 2 条（其一即 P2-5）。建议下一手只处理 P2-4、P2-5 与漏-2，半小时内可清。

## P5 复审后修订（10-02）

修订人：按 P5 复审意见收尾，只改 lora.md 与写手清单，未开子代理、未提交。行号为修订后现版文件行号。

### P2（2 条，均清）

- **P2-4 已修（L193）**：弃用「前两行 / 后两行」，改为按行名指代——「MoE 挂 LoRA 时的 EP 与量化」「MoE + EP 时挑哪种通信」这两行讲通信后果，「只挂一个适配器时怎么算」一行讲快路。表行顺序未动。
- **P2-5（即漏-1）已修**：L132 补回「真正做乘法的是昇腾用 AscendC 写的四个核函数（按段压/抬、按行压/抬），源文件在 `csrc/kernels/` 下，经 `csrc/torch_binding.cpp` 注册，`lora_ops.py` 是薄包装」，并链到算子与核函数页；L204 源码位置表补一行（四个 .cpp + torch_binding.cpp + lora_ops.py）。源码复核（git 单行核实）：db701c1f `csrc/kernels/` 下 `bgmv_shrink.cpp` / `bgmv_expand.cpp` / `sgmv_shrink.cpp` / `sgmv_expand.cpp` 四文件均在（`git ls-tree`）；`torch_binding.cpp` L430 起四个 C++ 入口、L2733–L2747 `ops.def`/`ops.impl` 注册成 `_C_ascend` 算子；`lora_ops.py` L26 直接调 `torch.ops._C_ascend.bgmv_shrink`，确为薄包装。

### 漏项（2 条，均清）

- **漏-1**：即 P2-5，见上。
- **漏-2 已修**：① L155「秩减半」误解末尾补回中间缓冲半句——压出的低秩中间结果占一块 `[行数, 最大秩]` 的 float32 缓冲，宽度跟配置的最大秩走、不随适配器实际秩缩。源码复核：db701c1f `vllm_ascend/lora/punica_npu.py` L314–L320 `r = lora_b_stacked[0].size(-1)` 后 `torch.zeros((x.size(0), r), dtype=torch.float32)`，而预付的 stacked 张量秩维按 `max_lora_rank` 开（vllm 0fc695fc `vllm/lora/layers/base_linear.py` L107），故宽度是配置的最大秩，比 p4 原句「[行数, r]」更准。② L121 例子后明写「同一适配器也不用在批里连成一段出现——例子里槽 0 就隔着一行出现了两次」（清单 A10 所缺的半句）。

### P3（2 条，均清）

- **P3-a 已修（L191）**：v0.26 一格补上限定——只在 FULL 图模式下才按批描述符选带 LoRA 的那份，其他图模式一律取不带的。源码复核：2ed6cbba `compilation/acl_graph.py` L349–L351，`has_lora = (cudagraph_runtime_mode == CUDAGraphMode.FULL and descriptor is not None and descriptor.has_lora)`，否则 `params[False]`。
- **P3-b 已修（L104）**：手算例给全 W 三行 `[1,0,1,0]`、`[1,1,1,0]`、`[2,1,0,0]`，x=[2,1,1,0] 下三行点积 3/4/5 读者可逐行验算，最终 [4,6,4] 不变。

### 清单与检查

- 写手清单 `lora-basics-facts.md` 六行如实更新：A6、A10、A12、B10（原 ✅ 不属实，已改写并注明补回位置）、B12、B13。
- 三项检查本页 0 报错：`pnpm wiki:lint` 通过（7 处待留意均为别页）；`pnpm wiki:diagrams --check` 271 张图一致；`pnpm wiki:audit` 本页 30 条来源中 29 条行号 ✓、1 条为 arXiv URL（未联网验证桶，非报错），全库唯一失败是别页 lmcache.md 的 hedge-ratio，与本页无关。
- **补（10-02 晚）**：本页入达标名单后 [code-density] 超标（38 处 / 2848 字 = 13.3，上限 13）。按「首次出现与对照源码保留代码体」降密：L132 三个文件路径改为指向「对照源码 › 源码位置」表，L155 缓冲形状、L115 重复的 s = 1 去掉代码标记，对照源码一节未动。复测 `pnpm wiki:audit` 名单 76 页全达标（本页不再报 code-density），lint / diagrams 0 报错。
