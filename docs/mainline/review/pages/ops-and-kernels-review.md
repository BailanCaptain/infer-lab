# ops-and-kernels 审查记录

## P5 写作记录（2026-09-28，深改）

### 改了什么

按六步骨架重写全页（正文 3,767 → 19,047 字符）：问题式 H2「一次矩阵乘，到底是谁在算？」+ op / kernel 各一句定义 + 直觉图 + 四层对照表 → 为什么要分这么多层、四条代价 → 在 GLM 双机上沿一层走过哪些算子（九站表）→ 四类特殊层集中讲（W8A8 量化矩阵乘 / KDA / 稀疏 MLA / MoE 分发与合并）→ 常见误解 8 条 → 对照源码五个 H3（怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置）。正文不写证据角标，角标全部在「对照源码」之后。

- 直觉图 `wiki/diagrams/ops-layers.yaml` 重画：画布 900×480，只画五层（模型 → 换实现的三条路 → 两类算子 → 运行库 → 设备核函数）与份数（顶层和底层各叠 depth 2），不写字节、不写代码名。旧图只有「框架分派 / 模型直接调用」两条路，新图补上量化方法这一条，并把 CANN 单独画成一层。
- 来源清单从 8 条扩到 31 条，全部指向实际推理代码路径（`vllm/`、`vllm_ascend/`、`csrc/`），没有一条指向 `tests/`。稀疏 MLA 只引生产路径（`sfa_v1.py#L1994-L2028` → `indexer_kpool_mla_v1.py#L1065-L1104` → `device/device_op.py#L719-L793` → `csrc` 绑定 → `aclnnSparseFlashAttention`），`_sparse_attention_pytorch` 只在「常见误解」里作为反例出现，不作出处。
- 新增内容：四层对照表（层 / 是什么 / 谁负责 / 在哪能看到）；替换表 26 项 + 版本门控 2 项的准确计数；量化方法与替换表是两套机制；`DeviceOperator` 按芯片型号再分一次叉；权重加载后转 NZ 格式是融合算子的前提；MC2 分发 / 合并算子用 `hasattr` 探测 v2 版本；KDA prefill 缺算子时的完整报错原文。

### 数字与出处

- 数字取自底稿 `docs/mainline/02-forward.md` 的 §3.4（W8A8 稠密线性：动态量化 + `npu_quant_matmul`）、§4.2（KDA 的短卷积 / prefill 分块 / decode 递推与块长 64）、§5.5（稀疏 MLA 的生产调用链、布局与 aclnn 绑定）、§6.6（专家计算三步算子与 NZ 格式要求）。形状、字节、通信次数本页不重算，链接到 `one-request.md`；部署前提链接 `glm-5-3-flash-two-node.md#部署前提`；量化细节链接 `quantization.md`；后端选择链接 `attention-backend-family.md`；调用链认站链接 `request-call-chain.md`。
- 核心概念逐条对照源码核实（vllm-ascend 读 orphan commit `db701c1f`，vLLM 读 `0fc695fc`）：
  - `CustomOp.__new__` 按类名换类、`__init__` 里把前向方法定死、`dispatch_forward` 在 out-of-tree 平台返回 `forward_oot`（`custom_op.py#L109-L133`、`#L174-L207`）。
  - 替换表 26 项，`vllm_version_is("0.23.0")` 门控再加 `FusedMoE` 与 `KimiGatedDeltaNetAttention`；结尾 `CustomOp.register_oot` 循环 + 进程内标记（`utils.py#L734-L762`、`#L763-L768`、`#L818-L823`）。
  - `enable_custom_op()` 的懒加载、A5 与 `VLLM_BATCH_INVARIANT` 两个关闭条件、`libcust_opapi.so` 的重试（`utils.py#L409-L452`）。
  - `AscendRMSNorm.forward_oot` 的两条路径（`layernorm.py#L63-L88`）。
  - W8A8 线性 `npu_dynamic_quant` → `npu_quant_matmul`（`w8a8_dynamic.py#L75-L125`）；不量化走 `torch.ops.vllm.unquantized_gemm` 且加载后转 NZ（`linear.py#L83-L107`）。
  - mHC 的 `npu_hc_pre_v2` / `npu_hc_post` 与一层里的先后（`glm5_next.py#L2147-L2169`、`#L2213-L2240`）；四路残差、每子层前后各一次，与底稿 §2.2、§2.3 一致。
  - KDA 的 `_require_ascendc_prefill_ops` 报错原文、`npu_causal_conv1d_custom`、`recurrent_kda`、`kda_gate_cumsum` + `chunk_kda_fwd`（`kimi_kda.py#L157-L166`、`#L294-L331`、`#L355-L388`、`#L430-L475`）。
  - MC2 `npu_moe_distribute_dispatch_v2` / `combine_v2` 与 `hasattr` 探测（`token_dispatcher.py#L108-L120`、`#L225-L240`、`#L329-L340`）；专家三步算子（`moe_mlp.py#L133-L215`）；专家权重转 NZ（`w8a8_dynamic.py#L353-L366`）。
  - `csrc/torch_binding.cpp#L2848-L2860` 的 schema 与 `sparse_flash_attention_torch_adpt.h#L124-L125` 的 `EXEC_NPU_CMD(aclnnSparseFlashAttention, …)`——这是页面上「扩展算子最终落到 CANN 算子」唯一一条实际走通的证据链。
- 版本差异按 `git ls-tree` / `git show` 实核：`2c59ff10` 没有 `ops/kimi_kda.py`、没有 GLM 模型文件，替换表里也没有 KDA；`2ed6cbba` 有 `kimi_kda.py`（报错在 `#L148`）与 Kimi K3，但没有 GLM；`baa023ad` 把 GLM 放进 `models/glm5next/` 包，`npu_hc_pre_v2` 仍在（`model.py#L499`），且 `layernorm.py` 的带残差分支不再二选一、直接调自编译融合算子。`get_device_adaptor` / `DeviceOperator` 三个版本都在。

### 旧版信息清单逐条勾选

清单存于本轮 scratchpad（`p5/ops-and-kernels-facts.md`），共 19 条。

| 编号 | 旧版结论 | 处理 |
|---|---|---|
| F1 | op / kernel 各自的定义 | 保留，第一屏 |
| F2 | 算子数 ≠ kernel 启动数 | 保留，第一屏 + 常见误解第 2 条 + `[D]` |
| F3 | 数学之外还要定布局、实现、划分、下发 | 保留，第一屏首段与四层表 |
| F4 | `CustomOp` 查登记表、`forward_oot` / native 回落 | 保留，「怎么开」`[C2]` |
| F5 | `register_ascend_customop` 的映射与进程内标记 | 保留，「为什么要分这么多层」+「怎么开」+ 源码位置两行 |
| F6 | 登记项不等于自编译 kernel | 保留，常见误解第 1 条 |
| F7 | `AscendRMSNorm` 的两条底层路径 | 保留，九站表 + 版本差异行 |
| F8 | torch_npu 与自编译扩展各提供什么 | 保留，第一屏图后段 + 四层表「算子接口」行 |
| F9 | 扩展延迟初始化与启用条件 | 保留，「怎么开」两条 `[C6]` |
| F10 | 两类实现都要处理形状 / dtype / 布局 / workspace；快慢由实测判断 | 部分保留：排布要求升级成「代价」一节的独立条目与 NZ 段落；「快慢由实测判断」落在「开销」节末尾与待核。dtype / workspace 两个词删掉——那是 kernel 内部的粒度，属于 `op-to-ai-core.md`，本页留在算子接口这一层 |
| F11 | GLM 两处 RMSNorm、mHC 四路残差经 `hc_pre` / `hc_post` | 保留并补全：九站表 + 表后专门一段讲四路残差与两个子层各一次 |
| F12 | `hc_pre` / `hc_post` 调 `_C_ascend` 专用算子 | 保留，九站表 + 源码位置 |
| F13 | 误解：「都只调现成算子」「所有层同一张替换表」 | 保留，常见误解第 3 条 |
| F14 | KDA 与稀疏 MLA 的后端关系链接后端页 | 保留，GLM 一节末尾 |
| F15 | 出现扩展名 ≠ 镜像里装好，边界链接来源基线 | 保留，GLM 一节末尾 + 常见误解第 4 条 |
| F16 | `register_dummy_fusion_op` 的占位对象、`default` 为 `None` | 保留结论（常见误解第 4 条 + 源码位置 `[C8]` + 待核第 3 条）；`default = None` 这个字段名删掉，改写成「没有可执行实现」——页面上不需要字段级细节，源码行已给 |
| F17 | 追踪一个算子的四步顺序 | 保留，第一屏表后 |
| F18 | 下一页 `op-to-ai-core.md` 演示归一化 | 保留，第一屏末尾 |
| F19 | 图：两类实现路径并列，自定义扩展不是已有算子的下一级 | 保留并加强：新图把两类算子画成同一层的并列两块，上面接三条「换实现」的路 |

顺序变了，但 19 条没有一条是无理由删掉的。

### 验证

- `pnpm wiki:lint`：退出码 0，`ok wiki:lint 通过（另有 19 处待留意）`；`grep ops-and-kernels` 命中 0。第一次跑报过本页 `mark-flood`（54 处角标），把「证据索引」的逐条枚举改成指向源码位置表、并删掉重复角标后降到 21 处（16 个 `[C]`、4 个 `[D]`、1 个 `[I]`，`[C]` 占比 76%，低于 80% 的等级集中阈值）。
- `pnpm wiki:diagrams --check`：退出码 0，`193 张图与 spec 一致`；生成时本页图无 problem、无 advisory（图上没有代码名、文字 7 段）。生成那一趟顺带重写了 `attention-cost.svg`（别人改过 yaml 后未重新生成），内容由脚本产出，未手工改动。
- `pnpm wiki:audit`：退出码 0，`行号越界 0、文件不存在 0、无效 commit 0`；本页记为「正文 10117 字 / 6 节 / 来源 31 条」。
- 没起服务、没占端口、没改 `standard-pages.json`（本页不在名单内）、没提交 git、没有碰 `vllm-kv-block-allocation`、`attention-cost`、`gqa`、`one-request` 四页。

### 跳过的内容

- frontmatter 的 sources 区：旧版只 grep 出 8 行原样读了一遍用于编号对照，没有通读其它 frontmatter。
- `HANDBOOK`、`docs/plans/`：未读。
- 底稿 `02-forward.md` 只读了 §3.4、§4.2、§5.5、§6.6 与 §6.4、§2.1–§2.3 的相关片段，其余没读。
- 源码全部用 `git show | sed -n` 按段读，单次不超过 50 行；没有整文件读取。
- 有一次生成回复时被安全分类器拦下（内容未产出），跳过后继续，未影响任何文件修改。

### 待核（已写进页面）

1. 缺 A2 上的 profiling：算子耗时、tiling、实际 kernel 启动次数都没有实测数据，页面因此不写任何耗时与分块数字。
2. 稠密 MLP 是否和共享专家一样命中带 SwiGLU 的融合分支（与底稿 §3.4 的待核同源）。
3. 占位融合名字后续由哪条图改写路径消费，没有跟到消费者。

---

## P5 审查（09-28）

独立审查，只审不改。对象：深改后的 `wiki/concepts/ops-and-kernels.md`（220 行，正文约 10.5k 字）。

**打分：8.5 / 10。P1：0；P2：2；P3：2。**

### 初学者测试（只读前两屏）

能说清：「模型里一行 Python 运算（一次归一化、一次矩阵乘）要经过换实现、算子接口、CANN 运行库三四次转手，才在设备上启动叫 kernel 的程序；代价是看不出谁在算、算子数不等于 kernel 启动数。」问题式 H2、一句话定义、直觉图、第二屏讲为什么和四条代价，结构齐。通过。

### 核心概念对照源码（全部在 db701c1f，vLLM 0fc695fc）

逐条核实，未发现讲错：

- 替换表 26 项 + 版本门控 2 项（FusedMoE、KimiGatedDeltaNetAttention）：`vllm_ascend/utils.py#L690-L768` 逐项数过，26+2 精确。「进程启动时注册一次」对应 `_ASCEND_CUSTOMOP_IS_REIGISTERED` 守卫。
- CustomOp 构造时换类、构造时定死前向：`vllm/model_executor/custom_op.py#L109-L133`（`op_registry_oot` 换类，`__init__` 里 `dispatch_forward`）。
- RMSNorm 两条路：`ops/layernorm.py#L63-L88` — 无残差 `torch_npu.npu_rms_norm`；带残差 `enable_custom_op()` 时 `_C_ascend.npu_add_rms_norm_bias`，否则退 `torch_npu.npu_add_rms_norm`。页面说法（含「归一化能退回」）与代码一致。
- W8A8：`quantization/methods/w8a8_dynamic.py#L75-L125` — `npu_dynamic_quant` → `npu_quant_matmul`（weight_scale + pertoken_scale，`output_dtype=x.dtype` 即 BF16 直出），页面两步说法正确。
- mHC：`models/glm5_next.py#L2147-L2169` — `torch.ops._C_ascend.npu_hc_pre_v2` / `npu_hc_post`，模型文件写死不走替换表；四条流 = `config.mhc_num_residual_streams`（L2133），底稿 02 首屏表 `hc_mult=4`。
- **KDA（重点抽查）**：`ops/kimi_kda.py` — 短卷积 `_C_ascend.npu_causal_conv1d_custom`（L294-L331）、conv 窗口 4（L186 `linear_conv_kernel_dim` 默认 4）、prefill `l2norm_fwd` → `kda_gate_cumsum` → `chunk_kda_fwd`（L430-L475）、`_KDA_CHUNK_SIZE=64`（L38）、decode `recurrent_kda` 且 `use_qk_l2norm_in_kernel=True, use_gate_in_kernel=True`（L355-L388）；缺算子抛 RuntimeError 无回退（L157-L166，`kda_gate_cumsum`/`chunk_kda_fwd` 两个）。页面「窗口 4 / 块长 64 / 门控归一化在算子内 / 硬依赖抛错」全部对上。
- **稀疏 MLA（重点抽查）**：生产链路 `sfa_v1.py#L1994-L2028`（forward 调 `_execute_sparse_flash_attention_process`）→ 子类重写 `indexer_kpool_mla_v1.py#L1065-L1104`（三份缓存角色 `("kv","indexer_state","indexer")` 在 L818-L822 校验，取 packed MLA KV）→ `device/device_op.py#L719-L793`（`torch.ops._C_ascend.npu_sparse_flash_attention`，`sparse_block_size=1`、`layout_query="TND"`、`layout_kv="PA_BSND"`）→ `csrc/torch_binding.cpp#L2848-L2860` 绑定 → `sparse_flash_attention_torch_adpt.h#L93-L149` 调 `aclnnSparseFlashAttention`。页面布局与参数全对。测试专用的纯 PyTorch 实现（约 L857-L1064）页面没有当出处，且在正文和常见误解里明确点出它只被单测调用——正确。
- MoE：`ops/fused_moe/token_dispatcher.py` — `hasattr(torch_npu, "npu_moe_distribute_dispatch_v2")` 属性探测（L112）、dispatch v2/旧版二选一（L225-L240）、combine 同理（L329-L340）；专家三步 `moe_mlp.py#L125-L215` — `dynamic_scale is None` 才做激活量化（跳过条件与页面一致）、融合分支 `grouped_matmul_swiglu_quant_weight_nz_tensor_list` / `npu_grouped_matmul_swiglu_quant`（名字里带 NZ，「只吃 NZ」成立，权重转 NZ 在 `w8a8_dynamic.py#L353-L366`）、第二步 `npu_grouped_matmul_gmm2`。
- 占位对象：`ops/__init__.py#L39-L55` `dummyFusionOp`，`default=None`，页面说法正确。
- 按芯片选适配类：`device/device_op.py#L2317-L2326`，A2 落 `BaseDeviceAdaptor`，与对照源码表一致。
- 层表「注意力本身由后端表决定」与 attention-backend-family.md 的框架（KDA 层报 AscendGDNAttentionBackend）口径一致，不算错。

### 出处与待核

- frontmatter 31 条出处逐行看过，**无一条指向 tests/**；稀疏 MLA 引用的正是生产路径三处（indexer_kpool_mla_v1 L1065-L1104、device_op L719-L793、sfa_v1 L1994-L2028）。
- 「待核」2 处（L170、L216-L220）：耗时/tiling/kernel 次数均未写具体数，与写手自报一致。
- 全页数字逐个过：26+2、34/11、第 3–44 层、四条流、窗口 4、块长 64、稀疏块 1、TP8/DP2/EP16、A2/A3/A5/310P、int8/FP32/BF16 —— 全部有源码或底稿出处，**没有无出处的数字**。

### 数字对照底稿（02-forward §3.4 / §4.2 / §5.5 / §6.6）

四节逐一对照，页面与底稿一致；块数（640）、MFLOP、MiB 等底稿数字页面均未重述，只留链接。后端选择只链 attention-backend-family.md、量化细节只链 quantization.md，抽查未见重讲。

### 丢信息

`git diff HEAD` 删除行逐条看过：旧版 7 个主题（几层表达、CustomOp 分派、torch_npu 与扩展、GLM 两个入口、占位对象、追踪顺序、源码入口边界）在新版全部保留且展开。**写手信息清单 `scratchpad/p5/ops-and-kernels-facts.md` 不存在**（p5 目录及整个 scratchpad 均搜过），改用旧版 diff 逐主题对照替代，未发现丢失。

### 链接、图、工具

- 页内 8 条链接目标文件全部存在，`glm-5-3-flash-two-node.md#部署前提` 锚点存在；全库入链只有纯页面链接、无锚点引用，改名无破坏。
- 直觉图 `ops-layers`：yaml/svg 宽 900（≤900 达标），只画层级、无字节数字，五层轴标与正文表一致；`pnpm wiki:diagrams --check` 本页通过。
- `pnpm wiki:audit`、`pnpm wiki:lint`：本页通过；三项检查唯一失败均为 concepts/prefix-caching.md（他人正在改的页面，与本页无关）。
- 对照源码五个 H3 齐全顺序正确；版本差异含 v0.23（2c59ff10，已验证该提交无 glm5_next.py / kimi_kda.py）、v0.26（2ed6cbba，有 kimi_kda.py）、main（baa023ad），db701c1f 单独标注为 orphan、不算进 v0.23 列——口径全对。
- 格式：对照源码之上无证据角标；行内代码约 11 个 / 10.5k 字；无 calc；无 meta 文本（无参考来源、无「放慢演示」类说明）。

### 问题清单

**P2-1（L101、L103、L131）MoE 分发/合并写成无条件 MC2。** 层表两行和 §MoE 首句「分发和合并各是一次 torch_npu 的 MC2 算子调用」没有限定条件；按底稿 §6.8，token 数 > 128 走 ALLGATHER 路线，dispatch/combine 不是 MC2 算子。段末虽有「走哪条通信路线由 token 数决定」，但初学者读完首句会以为 prefill 也是 MC2。改法：首句和表格加限定（如「MC2 路线下」/「小批量走 MC2，大批量走 All-Gather，见 moe.md」）。

**P2-2（L69）aclnn 首现无中文解释。** 表格「CANN 的 aclnn 接口与运行时」只说了归属，没讲 aclnn 是什么（CANN 的单算子调用接口层）；任务明确要求 kernel/op/CANN/torch_npu/aclnn 首现中文解释，前四个都有、aclnn 缺。改法：L69 加括号一句话。

**P3-1（L98、L101）术语先用后讲。** KDA 首现于层表 L98，展开在 L117；MC2 首现 L101，全页只描述行为、未解释这个缩写指什么。改法：表格首现处各加一个最短括号或把展开前移。

**P3-2（图与正文口径）** 直觉图第二层画三条换实现路，常见误解 #3 说「至少四套机制并存」（后端表没画进图）；正文 L62 也只说「三种办法」。不算错（图只画模块换实现），但建议在 L62 或图注一句话交代注意力的后端表在图里对应哪条，免得初学者对不上数。

### 跳过说明

按模板：未读 HANDBOOK、docs/plans、对照源码正文（只 grep 结构与版本行）、代码块；frontmatter 只看出处路径行。无被拦跳过的段落。


## P5 修订记录（09-28 二）

按「P5 审查（09-28）」的 2 条 P2 自修，P3 顺带处理了 MC2 缩写那半条：

| 编号 | 处理 | 落点 |
|---|---|---|
| P2-1 MC2 写成无条件 | **已改**。九站表「MoE 分发」格改为「纯 decode 步走 torch_npu 的 MC2 分发算子；混进大段 prefill 时换 All-Gather 路线」，「MoE 合并」格标明「MC2 路线下」；§MoE 的分发与合并新开首段先讲限定（MC2 是把发 token 和跨卡通信合在一个算子里的通信方式，本部署只在纯 decode 步走它，超门槛整层换 All-Gather，门槛推导链接底稿与 moe.md），原首句改为「MC2 路线下，……」。段末与新首段重复的那句「走哪条通信路线由 token 数决定」删掉，链接保留在新首段 | 九站表 L101/L103、§MoE 首段 |
| P2-2 aclnn 首现无解释 | **已改**。四层表「运行库」行的 aclnn 补括号：「CANN 提供的单算子 C 调用接口，一个函数对应一个算子」 | 四层表 L69 |
| P3-1（MC2 半条） | 顺带完成：MC2 的含义随 P2-1 的新首段给出。KDA 首现前移未做（表格格内空间有限，展开就在两屏内） | §MoE 首段 |
| P3-2 图与「四套机制」口径 | 未动，留给下轮（改图注需重生成 svg，且审查自评「不算错」） | — |

限定的口径对照底稿 02 §6.4：A2 上只在 MC2 与 ALLGATHER 之间二选一，纯 decode 步（≤128 token）必走 MC2、混进 chunked prefill 翻到 ALLGATHER；页面不重述 128 这个数，只说「纯 decode 步 / 超门槛」，数字留在底稿和 moe.md。

### 验证

- `pnpm wiki:lint`：退出码 0，`ok wiki:lint 通过（另有 19 处待留意）`；`grep ops-and-kernels` 命中 0。
- `pnpm wiki:audit`：退出码 1，唯一失败是 `concepts/prefix-caching.md` 的一条出处 out-of-range（他人正在改的页面，与本页无关）；本页 31 条出处全部 ✓，行号越界 0 条属于本页。
- 图未改动，未重跑 diagrams；没起服务、没改 standard-pages.json、没提交 git、没碰 gqa / prefix-caching / attention-cost。

## P5 修订记录（09-28 三）

本页入名单后报 [hedge-ratio] 5.1%（4/79 句）。处理：正文 4 处「可能」全部是源码可证实的分支行为，改成确定表述（量化方法与芯片各分一次叉、走哪条分支由扩展装没装上决定、归一化两条路都有、导入失败开关置假），出处已在源码位置表；「开销」节的行内待核合并到页末待核第 1 条，真实不确定性（profiling / 融合分支 / 占位消费者三条）原样保留在页末，没有改成断言。验证：`pnpm wiki:audit` 退出码 0（prefix-caching 也已被其作者修复），`pnpm wiki:lint` 退出码 0，本页均无告警。
