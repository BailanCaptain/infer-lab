# enable-sleep-mode-extra-cleanup 审查记录

## P5 写作记录（2026-10-02，第 27 批小修）

**改了什么。** 保留参数页四段式（一句话 / 事实表 / 为什么存在 / 开了的代价）和两节自动生成内容，沿用现有图 `wiki/diagrams/enable-sleep-mode-extra-cleanup.yaml`（一字未改，diagrams --check 290 张一致）。正文 7353 → 9617 字（wiki:audit 口径）；来源 26 → 33 条（只在末尾追加，原有编号不动）；frontmatter `updated` 改 2026-10-02，summary 与 relations 未动。

1. **一句话节·清理内容说准**：「销毁 HCCL 通信域」改为「释放 HCCL 的设备侧通信组（同一个通信组里的 CPU 侧那份不销毁）」——`_release_hccl_resources` 只拆 device communicator / 共享组引用 / 不共享的 device group，`cpu_group` 留在 `destroy()` 里才销毁。
2. **一句话节·版本口径**：原文写「v0.23.0 与 v0.26 分支（2026-09-17 的源码快照）」，改为按钉住版本点名 2c59ff10（维护分支）、db701c1f（含 GLM 代码的 orphan 提交）、2ed6cbba（v0.26）、baa023ad（main）。
3. **一句话节·纠一条错结论（本轮最主要的修正）**：旧版写「做清理的 `sleep_mem_optimized.py` 三版逐字相同」。实测 md5：2c59ff10 / db701c1f / baa023ad 为 `ce66f1dc957daa7cab4af6f370c532be`，2ed6cbba 为 `8fc9162244abf2d8674ead45474a56b9`，`git diff` 为 4 增 6 删。改为：v0.23 两个提交与 main 逐字相同；v0.26 把硬写死的三个图参数集合换成遍历 `acl_graph.iter_graph_params()`，而那个生成器会把按 LoRA 分组的 dict 逐份 yield，清理动作不变、用 LoRA 时覆盖面更全。
4. **一句话节·替掉旧算例**：删掉「单卡起 Qwen3-0.6B 答 37 token 的问题」那段（旧算例不是主线），换成「放到 GLM 双机：没开，也不该开」——2×A2×8 在线推理、教程两机命令里没有 `--enable-sleep-mode` 也没有 `--additional-config`、没有训练进程抢这 16 张卡，所以没人调 `sleep()`；链接 `glm-5-3-flash-two-node.md#部署前提` 与 `npu-worker-lifecycle.md#开销和什么时候别开`。旧结论「要 RL 训练循环与引擎同卡轮流上场」保留。
5. **一句话节·无实测数写明**：加一句「能省多少显存、唤醒慢多少，没有公开的实测数」，并写明 GLM 的权重 / KV cache 账目不是这个开关的效果，真实数值只能看运行日志。全页没有任何收益数字。
6. **事实表（仍 10 行）**：
   - 配置键行：「搬到 main 多半是启动即报错」改为按源码分支写——顶层未知键进 `extra="forbid"` 的 `AscendConfig`，构造阶段报验证错，标「源码分支如此，未实跑」+ [C12] [!]。
   - 类型 / 默认值行：补上逐版本行号（`ascend_config.py:163` / `:175` / main 的 `RlConfig` 字段），写明四个钉住版本默认都是 `False`。
   - 「前置开关」行改为「前置条件」并纠错：旧版写「必须同时 `--enable-sleep-mode`／不开 sleep mode 时这段代码根本不被调用」。守卫只读 additional_config 这个键，不读 `--enable-sleep-mode`；`CaMemAllocator.get_instance()` 在没开 sleep mode 时也只是新建一个空实例、不报错；真正的前置是有人调 `sleep(level≥1)`（`level<1` 在 EngineCore 就 return，到不了 Worker）。标「源码分支如此，未实跑」。
   - sleep 时释放行：补 HCCL 那一半的门控（`torch.distributed` 已初始化），与 ACL 那一半的 `use_aclgraph` 并列。
   - 适用部署行：v0.23/v0.26 列由「文档未限定」改为「文档只说面向 RL 负载，没限同卡」；main 列保留「same-device」；跨卡那句补官方表格依据（不同 NPU 时用 pause/resume + `hccl` 权重传输，通常不需要 sleep mode）。
7. **为什么存在节**：删掉无出处的「RL 场景里这往往正是 batch size 上不去的那一档」，改为「省多少取决于通信域个数和图捕获尺寸表，源码不算固定值，官方也没给过数」。新增「照源码点一遍」两条：HCCL 半边（等 PP 发送句柄 → `torch.npu.synchronize()` → 逐组释放设备侧资源、`device_group` 置 None、`cpu_group` 不动；唤醒 `restore_hccl()` 以 `create_cpu_group=False` 就地重建并刷新 MoE dispatcher 句柄）；ACL 图半边（三套图参数的 `workspaces` 置 None、列表字段清空、wrapper 的 `concrete_aclgraph_entries` 清空且 `first_run_finished=False`、`cudagraph_manager.graphs` 清空且 `_graphs_captured=False`），并点明已捕获的图是被当作从没捕获过。`rl_config.enabled` 段补上覆盖 `weight_nz_mode` 时的 warning 原文。
8. **开了的代价节**：
   - 「v0.23.0 上别用字符串传值」扩成「v0.23 与 v0.26 上」（2ed6cbba 同样是 `additional_config.get` 取原值）。
   - 新增「清理中途报错不会被吞掉」：这两条路径上没有 `try`/`except`，异常原样抛给 `sleep()` / `wake_up()` 的调用方；`restore_hccl()` 对还活着的组返回 `False`，重复唤醒不会建两遍。
   - 「ACL 图没开时只省 HCCL 一半」补反向情形：单卡、`torch.distributed` 未初始化时 HCCL 那一半整段跳过，只清图。
   - 新增「怎么确认它真的生效了：看日志」，附三条日志模板原文：`Sleep mode released HCCL and attention workspace memory: %.3f GiB.`、`Destroyed %d HCCL process groups for sleep mode.`（只有销毁了至少一个组才打）、`Restored %d HCCL process groups after sleep mode.`。
   - 启动命令引导语由「完整可复制的启动命令」改为「官方 RL 指南给的启动命令（本项目没有跑过这条命令）」。
9. **标记密度**：改完一度到 43 处（超 30）。删掉重复指同一来源的 [C]（同一结论在表格与正文各标一次的那些），现为 30 处，lint 不再报 mark-flood；被删标记对应的来源条目仍在 frontmatter 里。

**逐版本核对的源码（钉住版本，全部用 `git show <commit>:<path>` 读）。**
- 开关与默认值：2c59ff10 与 db701c1f `vllm_ascend/ascend_config.py:163`（`additional_config.get("enable_sleep_mode_extra_cleanup", False)`）；2ed6cbba `:175` 同写法；baa023ad `:270` 是 `RlConfig.sleep_mode_extra_cleanup: bool = False`，`:377` 的示例也写 `false`。
- 生效条件：2c59ff10 / db701c1f `worker/worker.py:223`（sleep）、`:278`（wake_up）用 `getattr(..., False)`；2ed6cbba `:229` / `:268` 同；baa023ad `:253` / `:292` 是 `rl_config.enabled and rl_config.sleep_mode_extra_cleanup`。
- 清理实现：`device_allocator/sleep_mem_optimized.py` 的 `SleepWakeupManager.sleep/wakeup`（`use_aclgraph` 门控、HCCL 先于 ACL 唤醒）、`AclGraphSleepWakeupManager`（清 workspace / reset 图参数 / tags 分支）、`HcclSleepWakeupManager`（`torch.distributed.is_initialized()` 门控、PP 句柄、`npu.synchronize`、三条日志）。四版 md5 比对见第 3 条。
- HCCL 组的销毁与恢复：2c59ff10 `patch/worker/patch_distributed.py:190-245`（`_release_hccl_resources` / `destroy_hccl` / `restore_hccl`，`cpu_group` 不在其中、`restore_hccl` 幂等）。
- 不开 sleep mode 也不报错：db701c1f `device_allocator/camem.py:141-149`（`get_instance` 缺实例时直接新建）。
- level 0 到不了 Worker：vllm@0fc695fc `vllm/v1/engine/core.py:739-745`（`if level < 1: return pause_future`）。另核 `entrypoints/llm.py:807-830`、`entrypoints/serve/dev/sleep/api_router.py` 都没有 `enable_sleep_mode` 断言。
- main 的未知键处理：baa023ad `ascend_config.py:1661-1671`（`unknown_keys` + `vllm_omni` 豁免只打 warning 后丢键）、`:455` 的 `ConfigDict(extra="forbid")`；`RlConfig.apply` 在 `:270-292`。
- 上游单测：baa023ad `tests/ut/worker/test_worker_v1.py:612`（`enabled=False, sleep_mode_extra_cleanup=True` → 不走清理）、`tests/ut/test_ascend_config.py:101-105`（`"false"` 被强转成 `False`）。
- 官方文档：2c59ff10 / db701c1f / 2ed6cbba `docs/.../additional_config.md`（默认 `False`）与 `feature_guide/sleep_mode.md:48-58`（做了什么 + 取舍原文）；baa023ad `additional_config.md:245`（Same-device mode）、`feature_guide/rl.md:42,55,102-116`（same-NPU、跨卡用 pause/resume + hccl、顶层键 removed、迁移表）、`release_notes.md:110-120`（该告警在 v0.26.0rc1 的 Known Issues 段内，#15648）。

**数字出处。** 本页没有任何量化效果数字，也没有引用底稿里的 GLM 数值；唯一的部署事实「教程两机命令没开 sleep mode / 没有 additional-config」来自 `wiki/concepts/npu-worker-lifecycle.md` 的本部署参数一段（该页标 [S1]，源头是官方两机教程命令），16 卡与 2×A2×8 来自 `glm-5-3-flash-two-node.md#部署前提`。队列写的「数字取自 01 §A0」在本页只用到 A0 的部署前提口径（16 卡 / 在线推理 / 启动命令里有什么），没有搬 A0 的显存与块数账目。

**旧版信息清单勾选**（清单存 scratchpad `p5/enable-sleep-mode-extra-cleanup-facts.md`，F1–F32；基线是 p4-checkpoint 14591fd，与改前现版一致）。
- F1–F5、F8–F11、F13–F15、F17–F24、F27–F32：保留，其中 F4 / F9 补了逐版本提交与行号，F13 补门控，F16 补官方依据。
- F6（三版逐字相同）：**判定为错并改写**，证据见第 3 条（md5 + diff）。
- F7（单卡 Qwen3-0.6B 旧算例走不到）：算例删除，结论「要 RL 循环与引擎同卡」保留并换成 GLM 双机口径。
- F12（必须同时 `--enable-sleep-mode`；不开就不会被调用）：**判定为不准并改写**，守卫不读该标志；保留「普通在线服务没人调 `sleep()`，所以不会发生」这个实际结论。
- F25、F26：保留，F26 的适用版本由 v0.23.0 扩到 v0.23 与 v0.26。

**P1 疑点。** 无。两处标了「源码分支如此，未实跑」的推断：① 旧顶层键在 main 上是构造阶段报错（没有真跑 main 起服务）；② 没开 sleep mode 时若有人调 `sleep()`，这两件清理照样执行（没有实跑验证）。两处都在页面上写明了未实跑，没有写成定论。

**待核。** ① main 上那条验证错误的完整报文（pydantic 原文）未取，页面只说「构造阶段报验证错」，没有附报错原文；② v0.26 的 DeepSeek-V4 告警只有 release notes 一句话，issue #15648 的具体现象未取（未联网）；③ 三条日志只有模板，没有真实运行输出可附。

**三检。** `pnpm wiki:lint` 通过（5 处待留意均为他页：4 页 mark-dominance、1 页 sources 密度，另 `params/enable-matmul-allreduce.md` 的 mark-flood 是同批别的写手的页）；`pnpm wiki:diagrams --check` 290 张与 spec 一致；`pnpm wiki:audit` 通过，本页 evidence=S、正文 9617 字 / 6 节、来源 33 条全部行号有效（越界 0、无效 commit 0、文件不存在 0）。

**跳过。** 无读取被拦；未读 HANDBOOK、docs/plans/ 与 frontmatter 的 raw 引用正文。

## P5 审查（10-02）

审查员独立核对（只审不改页面）。口径：参数页小修，保持四段式，只看任务文件写明的问题与写手两处纠错；不按深入页骨架扣分。

**分数：7 / 10。** P1 2 条，P2 1 条，P3 5 条。两处纠错本身都成立；扣分在写手新加的两句推断。

**结构与学习顺序。** 四段式保留（一句话 / 事实表 / 为什么存在 / 开了的代价），两节自动生成内容未动（diff 最后一个 hunk 在旧 122 行，版本谱系之后无改动）。顺序是：是什么（82）→ 为什么（111–113）→ 怎么做（119–124）→ 代价（128–146），参数页口径下通过。没有收益数字：88–90 行明写「没有公开的实测数」，全页没有搬 GLM 显存或块数账目，通过。

**两处纠错复核（都成立）。**
- F6「三版逐字相同」改写：我在 tools/repos/vllm-ascend 下重算了 `device_allocator/sleep_mem_optimized.py` 的 md5。2c59ff10、db701c1f、baa023ad 都是 ce66f1dc…，2ed6cbba 是 8fc91622…；`git diff --stat` 为 4 增 6 删，差异只在 `clear_all_attention_workspaces` / `reset_all_graph_params` 两个函数改用 `iter_graph_params()` 遍历。属实。
- F12「守卫读 --enable-sleep-mode」改写：2c59ff10 / db701c1f 的 `worker/worker.py:223` 与 `:278`、2ed6cbba 的 `:229` 与 `:268` 都是 `getattr(get_ascend_config(), "enable_sleep_mode_extra_cleanup", False)`；baa023ad 的 `:253` 与 `:292` 是 `rl_config.enabled and rl_config.sleep_mode_extra_cleanup`。都不读 `enable_sleep_mode`。vllm@0fc695fc `v1/engine/core.py:743-744` 在 `level < 1` 时直接 return；`vllm/v1/engine`、`entrypoints`、`executor` 下没有 `enable_sleep_mode` 断言。属实。sleep 中清理排在 `CaMemAllocator.get_instance()` 之前（2c59ff10 worker.py:223-227，main :253-256），所以「没开 sleep mode 时真调 `sleep()` 也会清理」这句成立，且页面已标「未实跑」。

**清理内容、时机和出错行为，逐条按源码核过。**
- HCCL：`patch_distributed.py:190-208` 拆 device communicator、release 共享键、destroy 不共享组；`:230-236` 把 `device_group` 置 None；`cpu_group` 只在 `destroy()`（`:224-228`）里销毁；`restore_hccl` 在 `:238-245`，组还活着时返回 False，用 `create_cpu_group=False` 重建。与 82、123、140 行一致。
- ACL：`sleep_mem_optimized.py:73-114` 依次把 workspaces 置 None、把列表字段清空、清 `concrete_aclgraph_entries`、`first_run_finished=False`、`graphs.clear()`、`_graphs_captured=False`。`:121-128` 在 tags 不含 kv_cache 时 return。与 103、124、138 行一致。
- 门控与日志：`:50` 是 `use_aclgraph`，`:173` 是 `torch.distributed.is_initialized()`，`:179-180` 在 `num_destroyed > 0` 时才打日志，`:186` 是无条件打。三条日志模板与 144–146 行逐字一致。sleep 与 wakeup 路径上没有 try/except（文件里 `except` 只出现在 license 行；patch_distributed 的 try 在 `__init__` `:130-149`，不在这条路径上），140 行成立。
- main：`ascend_config.py:455` 是 `ConfigDict(extra="forbid")`，`:1661-1671` 是 unknown_keys 与 vllm_omni 豁免，`:280` 的 warning 原文与 126 行逐字一致；旧键在 baa023ad 的 vllm_ascend 下零命中，也不在 `_NON_USER_INPUT_KEYS`（`:1615-1658`）里。137 行成立。
- 文档：main `feature_guide/rl.md:42,55,105-116` 与 104、148–157 行一致（启动命令逐字相同）；`release_notes.md:120` 位于 v0.26.0rc1 的 Known Issues 段（`:110`），与 136 行一致；2c59ff10 的 `sleep_mode.md:48-57` 与 130 行一致。

**旧版信息清单。** 清单存在（旧会话 scratchpad `p5/enable-sleep-mode-extra-cleanup-facts.md`，F1–F32）。抽 6 条到新版：F2→82 行 ✓，F11→99 行 ✓，F15→103 行 ✓，F17→105 与 136 行 ✓，F23→126 行 ✓，F28→137 行 ✓；另看了 F30→139 行、F31→150–157 行 ✓。F6、F12 的改写见上，属实。F7 的旧算例已删，结论保留在 88 行。`git diff p4-checkpoint` 删掉的正文行（旧 72/74/76/82–91/99/107/116/118–120/122）在新版都有对应，没有丢信息。

**lint 的 facts-overflow 提醒。** 现在 `pnpm wiki:lint` 通过，本页 0 条（5 处待留意都是他页的 mark-flood）。事实表 10 行，等于 `scripts/wiki/limits.ts:9` 的 `FACTS_BUDGET = 10`，也没有「来源」列，规则（`lint.ts:514-529`）不触发。无需处理。

### P1

1. **139 行「反过来，单卡跑、`torch.distributed` 还没初始化时，HCCL 那一半整段跳过，只清图」：把推断写成了定论，而且在实际部署里不成立。** NPUWorker 的 `init_device` 不加条件就会调 `_init_worker_distributed_environment()`，以 hccl 后端执行 `init_distributed_environment(world_size, …)`（2c59ff10 worker.py:497 与 :989-994；2ed6cbba :481 与 :1091；baa023ad :475 与 :1213）。单卡 world_size=1 也会初始化，所以 `sleep_mem_optimized.py:173` 的门控在正常起来的 Worker 上总为真。把「单卡跑」和「未初始化」绑在一起，读者会以为单卡不拆 HCCL。**改法**：删掉这半句，或改成「`is_initialized()` 门控是防御性的；经 Worker 正常启动的引擎（含单卡）都已初始化，所以实际都会走 HCCL 那一半」。
2. **86 行「清理的动作没变，覆盖面在用 LoRA 时更全」：把推断写成了定论，比较对象也不对。** v0.26 的 acl_graph 把 `_graph_params` 改成 `GraphParamsByLoRA = dict[bool, GraphParams]`（2ed6cbba acl_graph.py:329），`set_graph_params` 不论用不用 LoRA 都建 False/True 两份（:370）。清理改为 `iter_graph_params()`（:355-360），是为了适配这个新结构。v0.23 与 main 的 `_graph_params` 只有一份 `GraphParams`（2c59ff10 :300、baa023ad :368），acl_graph.py 里一处 lora 都没有，谈不上「不全」。**改法**：改成「v0.26 把图参数按带不带 LoRA 存成两份（dict），清理随之改为逐份遍历；v0.23 与 main 只有一份，清理动作相同」。

### P2

1. **134 行「上游单测里就专门造了这个组合来验证不走清理路径 [C16]」：夸大了单测的用途。** baa023ad `tests/ut/worker/test_worker_v1.py:612` 所在的用例是 `test_wake_up_does_not_transpose_moe_weights`（:597-638），断言的是 MoE 权重不转置和 allocator 的调用。它只是间接覆盖了这一点：Worker 没有 `sleep_wakeup_manager`，走进清理就会 AttributeError。全库也没有别的用例专测「只给子键不清理」。**改法**：结论改由守卫源码（worker.py:253/:292 的 `and`）支撑；单测降为「有一条 wake_up 用例用了 `enabled=False` + 子键 True 的组合并跑通」，或者删去。这条是旧内容 F25，写手记录里沿用了「→ 不走清理」的说法。

### P3

1. 页首 summary（截图第一屏的副标题）和图里 ② 的标题仍写「销毁 HCCL 通信域」，正文 82 行已改成「释放设备侧通信组（CPU 侧不销毁）」。图沿用函数名 `destroy_hccl`，可以接受；建议把 summary 跟正文对齐。
2. 123–124 行「照源码点一遍」先列 HCCL、后列 ACL。实际 sleep 时先清图、再拆 HCCL（`sleep_mem_optimized.py:50-52`），图里也是 ①ACL ②HCCL。建议对调两条，或注明执行顺序。
3. 145 行「这行不出现说明 HCCL 那一半没做」：不出现只说明没有任何组返回 destroyed（`:179`），不一定是整段跳过。建议改成「说明一个组都没拆」。
4. 写手记录第 32 条「`get_instance()` 没开 sleep mode 时只是新建空实例、不报错」不准确：`camem.py:151-157` 的 `__init__` 会断言 `PYTORCH_NPU_ALLOC_CONF` 里没有 `expandable_segments:True`。如果环境里设了这一项，清理已经做完之后 `sleep()` 才抛 AssertionError。页面 100 行没写「不报错」，所以不扣页面分。可以在「前置条件」一行补半句。
5. 88 行链接文字说「Worker 启动那一页核过命令里有什么」，锚点 `#开销和什么时候别开`（npu-worker-lifecycle.md:205）那节只写了 sleep mode 没开（:211）；「没有 additional-config」写在 `### 怎么开` 的 :186。可以接受，也可以改指 `#怎么开`。

**链接与锚点。** 88 行 `../concepts/glm-5-3-flash-two-node.md#部署前提`（:49）和 `../concepts/npu-worker-lifecycle.md#开销和什么时候别开`（:205）都能解析，`#开了的代价` 也能解析。全库入链只有 wiki/index.md:116、:250（不带锚点）和 log.md，lint 跨页锚点校验通过。

**三检。** `pnpm wiki:lint` 通过（本页 0 条待留意）；`pnpm wiki:audit` 退出码 0，本页 evidence=S、正文 9617 字 / 6 节、来源 33 条，全库无效 commit 0、行号越界 0。

**浏览器。** 用 Playwright 只读访问 5193（宽 1440），截了第一屏与「为什么存在」的图：scratchpad `enable-sleep-mode-extra-cleanup-review-first.png`、`enable-sleep-mode-extra-cleanup-review-diagram.png`。图正常渲染，页面上没有 meta 文本，没有新加分镜。

**跳过。** 没有读取被拦。按纪律没读 HANDBOOK、docs/plans/、frontmatter 的 sources 区和「版本谱系 / 参数定义」两节的自动生成正文；写手共同要求 codex-p5-common.md 未读，审查不需要。

## P5 修订记录（2026-10-02，针对上面 7 分审查）

每条都自己回到钉住版本源码核过，不是照审查意见照抄。正文 9617 → 9988 字；来源 33 → 35 条（只追加，原编号不动，第 29 条的行号范围由 `#L355-L360` 扩到 `#L329-L370`，以覆盖类型定义与 `set_graph_params`）；内联标记仍 30 处（新增 2 处、删掉 2 处重复指同一结论的）。图未动。

**P1-1（139 行「单卡跳过 HCCL」）：已改正。** 自核：`2c59ff10:vllm_ascend/worker/worker.py:496-497` 的 `init_device` 无条件调 `_init_worker_distributed_environment()`，该函数在 `:989-996` 以 `"hccl"` 后端调 `init_distributed_environment(world_size, …)`——单卡 `world_size=1` 也会初始化，所以 `sleep_mem_optimized.py:173` 的 `torch.distributed.is_initialized()` 在正常起来的 Worker 上恒为真。页面改为：这道门是防御性的，正常起来的引擎（含单卡）都已初始化，别指望靠它跳过拆组；事实表「sleep 时释放」一行同步补这一句，新增来源第 34 条 `worker.py#L989-L996` 并标 [C34]。原来那半句「单卡跑、未初始化时整段跳过，只清图」已删。

**P1-2（86 行「LoRA 时覆盖更全」）：已按源码重写，不再有推断。** 自核：`2ed6cbba:vllm_ascend/compilation/acl_graph.py:329` 定义 `GraphParamsByLoRA = dict[bool, GraphParams]`，`:370` 的 `set_graph_params` 用 `{has_lora: _new_graph_params(...) for has_lora in (False, True)}` 固定建两份（与是否真用 LoRA 无关）；`2c59ff10:acl_graph.py:300` 与 `baa023ad:acl_graph.py:368` 都是单个 `GraphParams`，两份文件里 `lora` 零命中。页面改为：v0.26 把图参数按「带不带 LoRA」存成两份 dict、都建，清理随之改为 `iter_graph_params()` 逐份遍历；v0.23 与 main 只有一份，清理动作一样。「覆盖面更全」这个比较删除。

**P2（134 行把普通单测说成专门验证）：已改准确。** 自核：`baa023ad:tests/ut/worker/test_worker_v1.py:597` 的用例名是 `test_wake_up_does_not_transpose_moe_weights`，`:610-613` 只是把 `rl_config` 造成 `enabled=False, sleep_mode_extra_cleanup=True`，断言的是 MoE 权重不转置。页面改为：结论由守卫的 `and` 支撑（指向事实表「生效条件」一行），上游没有专门测这条的用例，只有这条 `wake_up` 用例顺带用了该组合并跑通，仍保留 [C16]。

**P3：4 条处理，1 条判定不改。**

1. frontmatter summary 的「额外销毁 HCCL 通信域」改为「额外释放 HCCL 设备侧通信组」，与正文对齐。图里 ② 沿用函数名 `destroy_hccl`，按审查意见保留不动。
2. 「照源码点一遍」两条按执行次序对调成「先是 ACL 图半边 / 再是 HCCL 半边」（依据 `sleep_mem_optimized.py:50-52` 的次序），引导句写明睡下去是这个次序、唤醒整个反过来。
3. 日志那条括注改为「只有至少拆掉一个组才打；这行不出现说明一个组都没拆，不等于整段没执行」。
4. 补上 `CaMemAllocator.__init__` 的断言（`2c59ff10:device_allocator/camem.py:151-156`：`PYTORCH_NPU_ALLOC_CONF` 里带 `expandable_segments:True` 就 assert 失败），放在「为什么存在」讲池子那一句的括注里，写明它是在清理做完之后才抛；新增来源第 35 条 `camem.py#L141-L156` 标 [C35]，原处的 [C2] 去掉以守住标记上限。
5. 88 行的链接改指 `npu-worker-lifecycle.md#怎么开`（那一节 `:186` 才是「教程命令里没有 additional-config」的出处），链接文字改为「Worker 启动那一页核过教程命令里有什么」。

**上面写作记录里一处说法同步纠正。** 「`get_instance` 缺实例时直接新建、不报错」应为：`get_instance` 本身不报错，但它新建实例时 `__init__` 会断言环境变量，设了 `expandable_segments:True` 就抛 AssertionError；页面已按这个写。

**三检（全站退出码 0）。** `pnpm wiki:lint` exit 0 通过（5 处待留意都是他页，本页 0 条）；`pnpm wiki:diagrams --check` exit 0，290 张与 spec 一致；`pnpm wiki:audit` exit 0，本页 evidence=S、正文 9988 字 / 6 节、来源 35 条，全库行号有效 3417、无效 commit 0、行号越界 0、文件不存在 0。

**仍留的待核（页面已写明，未写成定论）。** ① 旧顶层键在 main 上报的 pydantic 验证错原文未取；② v0.26 的 DeepSeek-V4 告警只有 release notes 一句，issue #15648 的现象未取（未联网）；③ 三条日志只有模板，没有真实运行输出。

## P5 复审（10-02）

独立复审员，只审不改页面。逐条回到钉住版本源码核对写手的修订，不采信修订记录里的自核结论。行号均为页面文件实际行号。

**分数：8.5 / 10。** 上轮两条 P1、一条 P2 都已修好；上轮 P3 五条中四条修好、一条（P3-4）修法带出了新问题。新增 P1 0 条、P2 1 条、P3 2 条。

### 上轮 P1 / P2 复核

1. **P1-1「单卡跳过 HCCL」：已修好。** 现 103 行事实表与 141 行都改为「`is_initialized()` 门是防御性的，正常起来的引擎（含单卡）总是开的」。自核：2c59ff10 `worker.py` 的 `_init_device` 在 :497 无条件调 `_init_worker_distributed_environment()`（:395-497 之间只有一处 `raise ValueError`，没有提前 return），该函数 :989-994 以 `"hccl"` 后端调 `init_distributed_environment(world_size, …)`；2ed6cbba :481 / :1088-1092、baa023ad :475 / :1210-1214 相同。vllm@0fc695fc `distributed/parallel_state.py:1567` 起，在未初始化时无论走 split-group 分支还是 :1609 的 `torch.distributed.init_process_group(...)` 都会建 WORLD 组，`world_size=1` 不例外。门在 `sleep_mem_optimized.py:173`（`is_available() and is_initialized()`）。改后说法成立，旧半句已删。
2. **P1-2「LoRA 时覆盖更全」：已修好。** 现 88 行改为「v0.26 把 ACL 图参数按带不带 LoRA 存成两份 dict、都建，清理改用 `iter_graph_params()` 逐份遍历；v0.23 与 main 只有一份，清理动作一样」。自核：2ed6cbba `compilation/acl_graph.py:329` 为 `GraphParamsByLoRA = dict[bool, GraphParams]`，:370 / :390 / :410 对主图、草稿图、草稿 prefill 图都用 `for has_lora in (False, True)` 建两份，:355-360 的 `iter_graph_params()` 遍历三套、dict 则展开 values；2c59ff10 :300 与 baa023ad :368 都是单个 `GraphParams`，两版 acl_graph.py `lora`（不分大小写）零命中。`sleep_mem_optimized.py` 的 blob：2c59ff10 / db701c1f / baa023ad 同为 598701cf…，2ed6cbba 为 63fb40cf…，`git diff --stat` 4 增 6 删，差异只是两处三连调用换成 `for params in acl_graph.iter_graph_params()`。改后说法成立，「覆盖面更全」已删。
3. **P2「单测专门验证」：已修好。** 现 136 行改为「结论由守卫的 `and` 支撑；上游没有专门测这条的用例，只有一条 `wake_up` 用例顺带用了该组合」。自核：baa023ad `worker.py:253` 与 :292 都是 `rl_config.enabled and rl_config.sleep_mode_extra_cleanup`；`tests/ut/worker/test_worker_v1.py` 里出现 `sleep_mode_extra_cleanup` 的四个用例（:497 `test_sleep_uses_rl_extra_cleanup`、:517 `test_wake_up_mode_enabled`、:560、:597 `test_wake_up_does_not_transpose_moe_weights`），只有 :612 用了 `enabled=False` + 子键 True，且该用例断言的是 MoE 权重不转置。说法准确。

**上轮 P3 处理复核。** ① summary（frontmatter 第 6 行）已改为「释放 HCCL 设备侧通信组」✓。② 123–126 行已按执行次序对调成先 ACL 后 HCCL，与 `sleep_mem_optimized.py:50-52` 一致；唤醒「先恢复 HCCL 再重捕获图」与 :60-64 一致 ✓。③ 147 行括注改为「一个组都没拆，不等于整段没执行」，与 :179-180 一致 ✓。⑤ 90 行链接改指 `npu-worker-lifecycle.md#怎么开`（:175），「没有 additional-config」在 :186 ✓。④ 见下面新 P2-1。

### 抽查 6 条（清理什么 / 何时清 / 出错怎样），0 条错

| # | 页面 | 说法 | 源码 | 结论 |
|---|---|---|---|---|
| 1 | 125 | ACL 半边：三套图参数 workspaces 置 None、列表字段清空、wrapper 的 `concrete_aclgraph_entries` 清空并 `first_run_finished=False`、`cudagraph_manager.graphs` 清空并 `_graphs_captured=False` | 2c59ff10 `sleep_mem_optimized.py:73-119` | ✓ |
| 2 | 126 | HCCL 半边：先 `wait()` PP 发送句柄、`torch.npu.synchronize()`、再逐组拆；`device_group` 置 None；唤醒 `restore_hccl()` 以 `create_cpu_group=False` 重建并重建 communicator，再刷新 MoE dispatcher | `sleep_mem_optimized.py:172-186`；`patch/worker/patch_distributed.py:230-246` | ✓ |
| 3 | 121 / 123 | 睡：先清理、后 `allocator.sleep()`；醒：先 `allocator.wake_up()`，再 HCCL，最后视 tags 重捕获 | `worker.py:223-228`、:248-249、:278-280；`sleep_mem_optimized.py:47-64` | ✓ |
| 4 | 105 / 140 | `tags` 为 None 或含 `kv_cache` 才重捕获；两段式唤醒只在第二次捕获 | `sleep_mem_optimized.py:121-128` | ✓ |
| 5 | 142 | 两条路径无 try/except；`restore_hccl()` 对还活着的组返回 False | `worker.py:216-285` 无 try；patch_distributed 的 try 在 :85（destroy 包装）与 :130-149（`__init__`），不在此路径；:240-241 | ✓ |
| 6 | 102 | `level<1` 在 EngineCore 就返回，到不了 Worker | vllm@0fc695fc `v1/engine/core.py:741-742` | ✓ |

另核：147/148 行日志条件（:179-180 有条件、:186 无条件）✓；141 行 eager 模式只走 HCCL 半边（:50、:63 的 `use_aclgraph`）✓；86 行 v0.23 → v0.26 守卫只挪行号（2c59ff10 :223/:278 → 2ed6cbba :229/:268，同为 `getattr(..., "enable_sleep_mode_extra_cleanup", False)`）✓。

### 新增问题

#### P2

1. **115 行括注「这个分配器构造时还会断言 `PYTORCH_NPU_ALLOC_CONF` 里没有 `expandable_segments:True`——设了的话，清理已经做完之后 `sleep()` 才抛 AssertionError」：只在「没开 sleep mode」这一种情况下成立，却写成了通用定论，而且挪进了讲正常池子的段落。** 这是上轮 P3-4 的修法带出的新问题。
   - 正常用法（开了 `--enable-sleep-mode`）下，`CaMemAllocator` 在 `load_model` 就构造了（2c59ff10 `worker.py:681-683`，`initialize_from_config` 的 :910-911 同理），断言（`camem.py:151-157`，2ed6cbba / baa023ad 同在 :151-153）在启动时就触发，引擎起不来，轮不到 `sleep()`；平台在开了 sleep mode 时也不会替用户注入这个值（2c59ff10 `platform.py:776`，2ed6cbba :777）。
   - 反过来，没开 sleep mode 时，平台默认会往 `PYTORCH_NPU_ALLOC_CONF` 里补 `expandable_segments:True`（2c59ff10 `platform.py:776-789`，2ed6cbba :777-789；用户自设了 `max_split_size_mb` 等才不补）。所以 102 行「没开 sleep mode 时池子是空的，但真调 `sleep()` 的话这两件清理照样做」的完整后果大概率是：两件清理做完，`get_instance()` 处抛 AssertionError。这不是「设了的话」才遇到的边角。
   - **影响**：读者在正常同卡 RL 部署里会以为环境变量设错只在 sleep 时才炸，误判排查方向；102 行那条「未实跑」的推断也少了真正的结局。
   - **改法**：115 行括注删去，或改成「开了 sleep mode 时，这个断言在加载模型时就会触发」；把「清理做完后才抛」移到 102 行「前置条件」那格，写成「没开 sleep mode 时平台默认给 `PYTORCH_NPU_ALLOC_CONF` 补上 `expandable_segments:True`，于是两件清理做完后 `sleep()` 会在取分配器时抛 AssertionError（源码分支推断，未实跑）」，并补来源 `platform.py#L776-L789`。main 把这段注入挪进 `_set_pytorch_npu_alloc_env`（baa023ad `platform.py:1318`，条件同样是没开 sleep mode，:1323），但 main 的生效条件要求 `rl_config.enabled`，而它会摘掉 `expandable_segments`（[S17]），两者先后本轮未核，所以这一格先只写 v0.23 / v0.26，main 核清先后再补。

#### P3

1. 103 行（事实表）和 141 行（代价）把「`is_initialized()` 门是防御性的、Worker 启动无条件初始化、单卡也一样」完整讲了两遍。建议 141 行只留一句「这道门实际总是开的（见事实表）」。
2. 121 行和 123 行的引导句都讲了一遍唤醒顺序。123 行括注里的「唤醒时整个反过来」可以删。

### 其他

**链接与锚点。** 90 行 `glm-5-3-flash-two-node.md#部署前提`（:49）与 `npu-worker-lifecycle.md#怎么开`（:175）都能解析；lint 跨页锚点校验通过。

**三检（全站）。** `pnpm wiki:lint` exit 0（5 处待留意都是他页 mark-flood，本页 0 条）；`pnpm wiki:audit` exit 0，本页 evidence=S、正文 9988 字 / 6 节、来源 35 条，新增的 `worker.py#L989-L996`、`camem.py#L141-L156` 两条都是 ✓；全库无效 commit 0、文件不存在 0、行号越界 0。参数页不在达标名单内，按派发不做名单口径自测。

**学习顺序。** 本轮改动没有动结构，仍是参数页四段式；新加的内容都落在原有节里，没有提前开算，也没有搬 GLM 数字。通过。

**浏览器。** 5193 未在运行（curl 连接失败）。按纪律不起服务，本轮没有截图。本轮改动只有文字，图没动（写手已跑 `wiki:diagrams --check`）。

**跳过。** 没有读取被拦。按纪律没读 HANDBOOK、docs/plans/、frontmatter 的 sources 区（新来源只靠 audit 校验）、「版本谱系 / 参数定义」两节的自动生成正文，也没读写手用的共同要求 codex-p5-common.md。

## P5 修订记录 2（2026-10-02，针对 8.5 分复审）

**复审 P2（115 行断言时机）：已改正，自核过。** 2c59ff10 `platform.py:776-790`——只有 `not model_config.enable_sleep_mode` 时平台才把 `expandable_segments:True` 补进 `PYTORCH_NPU_ALLOC_CONF`；2c59ff10 `worker/worker.py:681-683`——开了 sleep mode 时 `load_model` 就 `CaMemAllocator.get_instance()`，所以 `camem.py:151-156` 的断言在**启动加载权重**那一步触发，不是 `sleep()` 时。页面据此改两处：「为什么存在」那句括注改成「开了 sleep mode 时它在加载权重那一步就构造，所以这个断言是启动时就炸，不会等到 `sleep()`」；事实表「前置条件」一格补上没开 sleep mode 时的真实结局——平台默认补了这一项，于是两件清理做完后 `sleep()` 大概率在取分配器那步抛 AssertionError，标「源码分支推断，未实跑」，并注明 main 把注入挪了位置且 RL 模式会反过来摘掉该项、先后未核。新增来源第 36 条 `platform.py#L772-L790`（标 [C36]）；为守住 30 的标记上限，去掉「顺序是有讲究的」那句末尾重复的 [C23]（同一结论下面两条 bullet 已各带来源）。

**复审 P3 两条：都已处理。** ①「代价」里重复讲的 `is_initialized()` 那段压成一句并指回事实表；② 「照源码点一遍」引导句里重复的「唤醒时整个反过来」删掉（上一句已讲唤醒顺序）。

**检查。** `pnpm wiki:lint` exit 0（本页 0 条待留意）；`pnpm wiki:audit` exit 0，本页正文 10134 字 / 6 节、来源 36 条，全库行号越界 0、无效 commit 0、文件不存在 0。图未动。
