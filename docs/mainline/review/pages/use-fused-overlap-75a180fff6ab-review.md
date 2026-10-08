# use-fused-overlap-75a180fff6ab 审查记录

## P5 写作记录（2026-10-02，第 29 批小修）

**旧版信息清单（小修，短版）。** `git diff p4-checkpoint` 的差异只落在自动生成区：「参数定义」的定义行号 1630 → 1631、角标 [C22] → [C23]、扫描提交 4d1412d1 → b64b4d71，以及 sources 里相应两条补充。正文四节（一句话 / 事实表 / 为什么存在 / 开了的代价）自 p4 起一字未改，不存在旧版结论丢失的风险。旧版结论逐条勾选：

1. 嵌套路径 `additional_config["sparse_kv_offload_config"]["use_fused_overlap"]`、`bool`、默认 `false` —— 保留。
2. 写到顶层在 main 上被 `extra="forbid"` 拒掉 —— 保留。
3. 存在范围只有 main；v0.26 的 `SparseKVOffloadConfig` 是逐键 `.get()` 的普通类、写了静默忽略；v0.23 维护分支整套特性不存在 —— 保留。
4. 事实表十行（真实路径、类型默认、生效前提、官方文档缺失、报错里的假配置块名、decode 分叉、prefill 不接管、TP 分工、额外常驻对象、覆盖版本）—— 全部保留；「生效前提」「覆盖版本」两行按本轮核实补写，没有加行（仍是 10 行，`facts-overflow` 不触发）。
5. 「为什么存在」的三件（配置读取、`_forward_decode` 分叉、TP rank 0 不对称）—— 保留，但把「它被读三次，落在三个不同的对象上」改成「配置被读两次，落在两个对象上」：钉住的 `baa023ad` 上配置读取只有两处（`vllm_ascend/attention/sfa_kv_offload.py#L203`、`vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L493`），原句的「三」与源码不符。
6. 代价五条（假配置块名、文档缺失、两条 stream + 元数据常驻、不接管 prefill、升级降级要手改）—— 保留。

**本轮改了六处。4 段式结构与节名未动；本页没有图，「沿用现有图」等于无图可改。**

1. **后端只在整套卸载启用时才选。** 「生效前提」行与「为什么存在」开头各补一处：`AscendSFABackend` 的 `get_builder_cls()` / `get_impl_cls()` 先判 `sparse_kv_offload_config.enabled`，为真才换成 `sfa_kv_offload` 的 builder / impl，否则 decode 全程是普通 SFA，这个键连读都不会发生（`vllm-ascend@baa023ad:vllm_ascend/attention/sfa_v1.py#L284-L309`，新增来源 [C24]）。
2. **main 的默认值与配置类归属按源码核实。** `baa023ad:vllm_ascend/ascend_config.py#L1468-L1478` 的 `SparseKVOffloadConfig` 字段是 `enabled` / `topk_buffer_size` / `dram_size_per_dp_GB` / `keep_device_kv_cache` / `topk`（`init=False`）/ `use_fused_overlap: bool = False`；与页面原有结论一致，没有改结论，只在新增段落里把六个字段列齐。
3. **两条 RuntimeError 原文逐字附出处。** 旧版只写了共同片段，现按源码逐字写出：`mapped membership allocation requires kv_offload_decode_config.use_fused_overlap=true`（`baa023ad:.../sparse_kv_offload_manager.py#L654-L655`，[C11]）、`get_fused_overlap_cpu_kv_inputs requires kv_offload_decode_config.use_fused_overlap=true`（同文件 `#L714-L716`，[C12]）。并补一句：抛错的两个函数正是 fused 路径自己要调的（`sfa_kv_offload.py#L558` 取 membership map、`#L911` 取主机侧 KV 输入），所以是防误用的硬前提，不是降级点。`kv_offload_decode_config` 全仓不存在仍按 [D]（grep 推导）标记，没有升级成定论。
4. **decode 分支与 TP rank 0 不对称。** 原有结论核对通过并保留：分叉 `if self.use_fused_overlap:` 在 `_forward_decode` 内部（`sfa_kv_offload.py#L1035`）；planner 预热判据 `if not (self.use_fused_overlap and self.tp_rank == 0): return 0`（manager `#L557`）；副 stream 只在 `tp_rank == 0 and use_fused_overlap and capturing and not has_prefill` 时用（manager `#L1090-L1093`）；非 0 rank 恢复成非拥有的 GVA 视图（manager `#L851` 一带）。
5. **版本差异（含提交号）。** 新增一段：在册 main 钉 `baa023ad`，类里没有任何与它互斥的键；文末「参数定义」自动扫描的是更晚的 main 提交 `b64b4d714484feaa6ca71edc99b98318fe6d2f0d`（2026-09-28），那一版多出 `fused_op_type`（默认 `none`）与派生属性 `use_fused_copy_sfa`，并新增校验 `fused_copy_sfa and use_fused_overlap are mutually exclusive`（`#L1621-L1646`，新增来源 [C25]），所以页面底部那段「约束线索」在钉住版本上还不存在。GLM 代码线快照 `db701c1f` 的 `AscendConfig` 连 `SparseKVOffloadConfig` 这个类都没有，各块配置逐块 `additional_config.get(...)` 取，写上这个嵌套块既不读也不报（`db701c1f:vllm_ascend/ascend_config.py#L27-L40`，新增来源 [C26]）。这一段放在「开了的代价」末尾而不是「版本谱系」里：版本谱系整节由 `pnpm wiki:lineage` 生成，手改会被夜间重跑覆盖。
6. **GLM 双机只给结论 + 链接，并写明待核。** 换到 main 也开不了，五道拦路条件（第一道是设备型号只放行 Atlas A3）不在本页重讲，链到 `kv-cache-sparse-offload.md#放到-glm-双机硬件这一关就过不去`；部署前提链到 `glm-5-3-flash-two-node.md#部署前提`（两个锚点都按 `src/content/wiki/anchors.ts` 的 `headingSlug` 算过，均命中目标页现有 H2）。**待核**写明缺什么：开与不开在 decode 时延、每步搬运字节、显存占用上都没有实测数（官方文档没有这个键，手上也没有 A3 机器日志）；并写明底稿 02 §6.5–6.8 的 MC2 字节数与 W8A8 专家算子数字属于 MoE 站，不是这个开关的效果，不许挪用充当收益。

**数字与出处口径。** 正文没有引用底稿部署数字：任务单列的 02 §6.5–6.8 是 MoE 站的账，与这个 decode 侧开关不同站，只写成「不能挪用」的禁用说明。版本口径按派发说明：main = `baa023ad`，v0.26 = `2ed6cbba`，GLM 代码线 = `db701c1f`（orphan commit，用 `git -C tools/repos/vllm-ascend show db701c1f:<path>` 读）。

**sources 变化。** 追加 3 条共 26 条：[C24] `baa023ad:vllm_ascend/attention/sfa_v1.py#L284-L309`、[C25] `b64b4d71…:vllm_ascend/ascend_config.py#L1621-L1646`、[C26] `db701c1f:vllm_ascend/ascend_config.py#L27-L40`。为压住 `mark-flood`（上限 30 处、单一等级上限 80%）去掉 4 处重复角标：事实表里重复的 [C11] 与 [C13]、「为什么存在」末尾重复的 [C12]、新增段里重复的 [C3]；这些事实在同页别处仍带角标。`updated` 改为 2026-10-02。

**验证。** `pnpm wiki:lint`：本页 0 报错 0 警告（全库另有 2 处报错、6 处警告，都在别的写手正在改的 `params/prefetch-ratio.md` 等页）。`pnpm wiki:diagrams --check`：290 张图与 spec 一致（本页无图）。`pnpm wiki:audit`：本页通过，26 条来源的行号在钉住仓库里都存在。正文 5,567 → 7,122 个非空白字符（audit 计 7,877 字 / 6 节）。

**疑点与跳过。** 无 P1。跳过了 `csrc/` 下 `npu_fused_sparse_attention_overlap` 算子本身的实现与 README：读那一带时被安全分类器拦过一次，本轮没有再打开，因此「算子内部把搬运与计算重叠」只沿用 Python 侧模块注释的说法，没有写分块或流水细节 —— **待核：算子侧的重叠粒度，以及它对 selection buffer 尺寸的要求**。

## P5 审查（10-02）

审查员：独立审查（Opus 5.5），只审不改页面。范围：正文第 82–137 行（一句话 / 事实表 / 为什么存在 / 开了的代价），版本谱系与参数定义两节只核与正文的口径一致。源码只读配置层与调度层（`ascend_config.py`、`config_utils.py`、`attention/sfa_v1.py`、`attention/sfa_kv_offload.py`、`sparse_kv_offload_manager.py`），未打开 `csrc/` 与任何 `.cpp`。

**分数：8.0 / 10**（P1 0 条，P2 3 条，P3 6 条）

### 初学者测试（只读前两屏）

我的一句话：它是 Sparse KV Offload 在 decode 上的第二条路开关——不再把 top-k 没命中的 KV 搬回 NPU 热缓冲，而是让一个融合算子直接读主机内存里的全量 KV；代价是多两条常驻 stream 和一块元数据、TP 组里 rank 0 独占 CPU 池、官方文档没有它、报错还指向一个不存在的配置块。能说清，**学习顺序通过**（参数页四节式：一句话 → 事实表 → 为什么存在 → 代价，本页无计算环节，不需要 calc；GLM 只在代价末尾给结论 + 链接）。一句话段对初学者偏密（indexer、H2D、常驻 SFA 一口气出现），但首词就链到概念页，参数页可接受。

### 派发重点逐条核对（钉住版本源码）

1. **main 默认值与所属配置类** —— 通过。`baa023ad:vllm_ascend/ascend_config.py` L1467–1478：`@config` 修饰的 `SparseKVOffloadConfig`，六个字段 `enabled` / `topk_buffer_size` / `dram_size_per_dp_GB` / `keep_device_kv_cache` / `topk`（`init=False`）/ `use_fused_overlap: bool = False`；`from_additional_config` 走 `cls(**user_config)`（L1489–1496）。`config_utils.py` L43 默认 `ConfigDict(extra="forbid")`，顶层未知键会被 `AscendConfig` 拒（L1612–1631 只剥掉非用户键）。
2. **两条 RuntimeError 原文逐字** —— 通过。manager L654–655、L714–716 与页面第 123 行逐字一致；`kv_offload_decode_config` 在 `baa023ad` 的 `vllm_ascend/` 与 `docs/` 里只出现在这两条报错字符串本身（`git grep -c` = 2，同一文件），没有任何同名配置块——「指向不存在的配置块」成立（措辞见 P3-2）。
3. **decode 分支与 TP rank 0 不对称** —— 机制通过，函数名错（见 P2-1）。分叉 `if self.use_fused_overlap:` 在 `sfa_kv_offload.py` L1035；planner 预热判据 manager L557；副 stream 判据 L1093（`tp_rank == 0 and use_fused_overlap and capturing and not has_prefill`）；非 0 rank 恢复共享 CPU KV 视图 L851–856；两条 stream + `1 + max_num_topk_rows` int32 元数据 L778–787。配置读取确为两处（`sfa_kv_offload.py` L203、manager L493），「读三次 → 两次」的改动正确。
4. **后端只在 sparse_kv_offload 启用时才选** —— 通过。`baa023ad:vllm_ascend/attention/sfa_v1.py` L277 `AscendSFABackend`，`get_builder_cls()` / `get_impl_cls()` 先判 `sparse_kv_offload_config.enabled` 才换成 `sfa_kv_offload` 的类（L284–309）。
5. **版本差异** —— 通过。`baa023ad`（2026-09-21）是 `b64b4d71`（2026-09-28）的祖先；`baa023ad` 的 `ascend_config.py` 无 `fused_op_type`；`b64b4d71` L1634 `fused_op_type: str = "none"`、L1637–1638 派生 `use_fused_copy_sfa`、L1644–1645 互斥校验原文与页面一致（类型是 `ValueError`，页面没写类型，不算错）。GLM 代码线 `db701c1f` 的 `ascend_config.py` 无 `SparseKVOffloadConfig`，`vllm_ascend/` 下 `sparse_kv_offload` / `use_fused_overlap` 零命中，`AscendConfig` 逐块 `.get()` 且无未知键检查——「既不读也不报」成立。v0.26（`2ed6cbba` L1042–1054）是普通类、四个键 `.get()`，顶层只有 `short_request_first_config` 有未知键检查——「两种写法都一声不吭」成立。v0.23（`2c59ff10`）`vllm_ascend/` 下无 `sparse_kv_offload`。
6. **GLM 双机** —— 通过。第 135 行只给结论 + 链到 `kv-cache-sparse-offload.md#放到-glm-双机硬件这一关就过不去`（目标 H2 在该页第 151 行，五道门槛、第一道 A3 与本页表述一致），没有重讲；部署前提链到 `glm-5-3-flash-two-node.md#部署前提`（目标第 49 行）。**没有虚构收益数字**，第 137 行明确写无实测数。
7. **官方文档** —— 通过。`baa023ad` 下 `docs/` 无 `use_fused_overlap`；`layerwise_and_sparse_kv_cache_offloading.md` 的 Decode 启动示例只有三个键（L223–227）；含 `sparse_kv_offload` 的 docs 只有 4 个文件，不含 `additional_config.md`。

### 信息清单与丢信息

- `git diff p4-checkpoint HEAD -- <页>` 只有自动生成区（定义行号 1630→1631、[C22]→[C23]、扫描提交 4d1412d1→b64b4d71）与 sources 两条，写手「p4 以来只有自动生成区变动」**属实**。
- `git diff p4-checkpoint -- <页>` 的删除行逐条对照：事实表三行只去了重复角标、内容保留或扩写；「读三次」改「读两次」经源码核实；RuntimeError 段由共同片段改为逐字两条；「开了就多常驻」段只去了角标。**无信息丢失。**
- 清单抽 6 条到新版：嵌套路径与默认值（L84/L86/L94/L95）、`extra="forbid"`（L86/L131）、v0.26 静默 / v0.23 不存在（L88/L131）、事实表 10 行（L94–L103，数过）、为什么存在三件（L111/L113–L117）、代价五条（L123–L131）——全部在。

### P2

- **P2-1 函数名错：`_forward_decode` 不存在。** 位置：第 111 行「真正的分叉写在 `_forward_decode` 里那句 `if self.use_fused_overlap:` [C10]」；写作记录第 4 条也写成「在 `_forward_decode` 内部（L1035）……核对通过」。事实：`baa023ad:vllm_ascend/attention/sfa_kv_offload.py` 全文没有 `_forward_decode`，L1035 位于 `AscendSFAKVOffloadImpl` 覆盖的 `_execute_sparse_flash_attention_process`（L1001 起）；引入提交 `1493369b` 与 `b64b4d71`（L1568）同样没有这个函数。影响：读者按名字去搜找不到；写作记录把未核对的项写成「核对通过」。复现：`git -C tools/repos/vllm-ascend show baa023ad:vllm_ascend/attention/sfa_kv_offload.py | grep -n '_forward_decode\|def _execute_sparse_flash_attention_process'`。改法：改成「子类覆盖的 `_execute_sparse_flash_attention_process` 里那句」，并顺手核 [C10] 的行号是否指 L1035。
- **P2-2 未核的算子行为在页面上写成了定论。** 位置：第 109 行「一次**同步的** H2D 搬运」「搬运与计算在算子内部重叠掉」。Python 侧唯一的说明是模块注释 L17–19：用 `npu_fused_sparse_attention_overlap` 替换「常驻 onload + SFA」，从共享 CPU 池读全量 KV、NPU 上留选择缓冲——**没说重叠，也没说默认路径是同步的**；写作记录自己也承认重叠粒度待核、来源只是 Python 侧。跳过 csrc 是正当处理，本条不为跳过扣分，扣的是「待核只写在记录里、页面上是定论」。改法：第 109 行改成「按模块注释，它不再把 miss 搬回热缓冲……算子名里的 overlap 指搬运与计算重叠，重叠的粒度与对选择缓冲尺寸的要求待核（算子实现未核）」，「同步的」删掉或同样标待核。
- **P2-3 页面上的过程性说明（meta 文本）。** 位置：第 137 行第二句「主线底稿里 MoE 那一段的数字（MC2……W8A8 专家算子）是另一站的账……不能挪过来充当收益」。这句是写给写手的禁令（来源是任务单列的 02 §6.5–6.8），「主线底稿」是内部用语，读者读到这里不会想到 MC2，反而被引去一个无关话题。改法：删掉这一句，第一句「三项都没有实测数」已经足够。

### P3

- **P3-1 版本表述自相矛盾。** 第 125 行「至今没有进任何在册版本」与第 88 行「在册版本里只有 main 有」、第 103 行「在册 main 钉在 baa023ad」冲突（p4 遗留）。改成「至今没有进任何 release tag」，与版本谱系「当前含该标识符的 tag：未找到」对齐。
- **P3-2** 第 98、123 行「`kv_offload_decode_config` 一处都找不到」：严格说它就出现在这两条报错字符串里。改成「除了这两条报错本身，`vllm_ascend/` 和 `docs/` 里再无此名」。
- **P3-3** 第 99 行「分叉点在注意力算子内部」：分叉在 Python 的注意力后端 Impl 里，「算子」容易被读成 kernel。改成「在注意力后端的 Impl 里」。
- **P3-4** 第 115 行「OpenMP 线程池」：Python 侧（manager L557–559）只调用 `sparse_kv_warmup_lru_resident_threads`，没有 OpenMP 字样，出处可能在 `.cpp`（本轮按纪律未读），p4 遗留，未核。
- **P3-5 行内代码偏密。** 第 82–137 行 101 处行内代码 / 5,603 个非空白字符 ≈ 18 处每千字（audit 按 7,875 字算约 12.8，本页不在名单内只统计）。参数页标识符多，可接受；下次扩写时把事实表外重复出现的标识符改用中文指代。
- **P3-6 写作记录不准。** 记录说去掉了 4 处重复角标（[C11]、[C13]、[C12]、[C3]），实际「开了就多常驻两条 stream」段的 [C14] 也去掉了（[C14] 仍在第 111 行，不影响溯源）。

### 验证

- `pnpm wiki:audit`：全库 ok；本页条目 `params/use-fused-overlap-75a180fff6ab.md … 正文 7875 字 / 6 节 来源 26 条`，无 ✗、无越界、无文件不存在。**本页通过。**
- `pnpm wiki:lint`：ok，5 处待留意均为别的页，本页 0 报错 0 警告。
- 入链：`wiki/concepts/kv-cache-sparse-offload.md`、`wiki/index.md` 指向本页；出链两个锚点都命中目标页现有 H2。
- 浏览器：Playwright 1440×900 只读打开 `http://localhost:5193/#/wiki/use-fused-overlap-75a180fff6ab`，H2 依次为 一句话 / 事实表 / 为什么存在 / 开了的代价 / 版本谱系 / 参数定义（自动生成）/ 接着看，渲染正常；本页无图、无分镜。截图：scratchpad `use-fused-overlap-75a180fff6ab-review-1.png`（第一屏）、`-review-2.png`（开了的代价）。小瑕疵：第 84 行角标后的「。」在第一屏折到下一行行首，不改也行。

### 跳过

- `csrc/` 与 `.cpp` 算子实现：按派发说明未读（P2-2、P3-4 只针对页面标注，不针对跳过）。
- frontmatter sources 区：未读，交 audit 校验；[C10] 指向的行号未逐条核。
- 版本谱系与参数定义两节：自动生成，只核口径，未逐行读。

## P5 修订记录（2026-10-02，按上面的 P5 审查修）

**P2-1 函数名改正（已修）。** 自己复核：`git -C tools/repos/vllm-ascend show baa023ad:vllm_ascend/attention/sfa_kv_offload.py` 全文没有 `_forward_decode`；L1035 的 `if self.use_fused_overlap:` 位于 `AscendSFAKVOffloadImpl` 覆盖的 `_execute_sparse_flash_attention_process`（def 在 L1001）。页面「为什么存在」改为「`AscendSFAKVOffloadImpl` 覆盖的 `_execute_sparse_flash_attention_process` 里那句 `if self.use_fused_overlap:`」，并加一句「源码里没有 `_forward_decode` 这个名字」免得读者去搜。顺带把「开了的代价」里 prefill 那句改准：prefill 那一半是**交回父类的同名实现**（`super()._execute_sparse_flash_attention_process`，L1047-L1058 调用处），不是另一个函数。

**[C10] 行号核对（审查员未核，本轮补核）。** sources 第 10 条是 `baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L1035-L1047`，分叉确实起于 L1035（`if self.use_fused_overlap:`），其后到 L1047 是 `_execute_fused_overlap_offload_decode(...)` 的实参列表，范围正确，不改。同时核了 [C8]=L13-L19（模块注释两条路）、[C9]=L202-L205（Impl 侧配置读取），两条也对得上。

**P2-2 定论降级为推断 + 待核落到页面（已修）。** 删掉「一次**同步的** H2D 搬运」与「搬运与计算在算子内部重叠掉」两处定论。改成两段：第一段只写模块注释支持的事实（默认路径是「搬回 miss → 跑常驻 SFA」两步，开了之后换成算子直接读共享 CPU 池、NPU 只留选择缓冲）；第二段标题是「它到底怎么 overlap，Python 侧看不出来」，写明这是从名字与 `fused_plan_stream` 这条副流读出来的推断 [D]，并在页面上落下**待核**：重叠粒度（按行／按块／按层）、对选择缓冲尺寸的要求、默认路径那次搬运是否真的卡住后续计算。按纪律仍未打开 `csrc/`。

**P2-3 meta 文本删除（已修）。** 删掉末段第二句（「主线底稿里 MoE 那一段的数字……不能挪过来充当收益」）。那是给写手的禁令，留在写作记录里即可；页面末段只留「三项都没有实测数——官方文档没有这个键，也没有 A3 机器的运行日志」。

**P3 处理。**

- P3-1（已修）：「至今没有进任何在册版本」→「至今没有进任何 release tag（见版本谱系末尾「当前含该标识符的 tag：未找到」）」，与「在册 main 有」不再冲突。
- P3-2（已修）：两处改成「除了这两条报错字符串本身，`vllm_ascend/` 和 `docs/` 里再无这个名字」。
- P3-3（已修）：事实表「分叉点在注意力算子内部」→「分叉在注意力后端的 Impl 里，不在调度或 connector 层」。
- P3-4（核过，不改）：「OpenMP 线程池」有 Python 侧依据——manager `_warmup_external_lru_planner_threads` 调 `sparse_kv_warmup_lru_resident_threads` 后打的日志原话是 `Warmed external LRU planner OpenMP team with %s threads`（`baa023ad:.../sparse_kv_offload_manager.py#L559-L562`）。不是 `.cpp` 才有的说法，页面表述保留。
- P3-5（不改，记在案）：参数页标识符密集，本页不在写作标准名单内，只统计；本轮净增的行内代码集中在新加的两段，没有再堆。
- P3-6（已更正）：上一条写作记录说去掉 4 处重复角标，实际是 5 处——「开了就多常驻两条 stream」段的 [C14] 也去掉了（[C14] 在「为什么存在」仍有一处，溯源不受影响）。本轮又去掉新段里重复的 [C8]（[C8] 在「一句话」仍有一处），为的是把内联角标压回 30 处以内。

**验证（全站退出码 0）。** `pnpm wiki:lint` exit 0：本页 0 报错 0 警告（全库 5 处待留意均为别页）。`pnpm wiki:diagrams --check` exit 0：290 张图与 spec 一致，本页无图。`pnpm wiki:audit` exit 0：本页 `正文 8215 字 / 6 节 来源 26 条`，行号校验通过。4 段式节名与节序未动，没有新增节、没有新增来源。

**仍未核（跳过）。** `csrc/` 下 `npu_fused_sparse_attention_overlap` 的实现与 README：按派发说明未打开，页面已按推断 + 待核标注。
