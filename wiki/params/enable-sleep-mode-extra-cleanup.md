---
id: enable-sleep-mode-extra-cleanup
title: enable_sleep_mode_extra_cleanup
type: param
summary: >-
  sleep 时额外释放 HCCL 设备侧通信组、清空 ACL 图工作区；默认关闭，因为唤醒要重建通信域并重新捕获图。v0.23 与 v0.26
  使用顶层键，固定 main 与 rc2 使用 rl_config。rc2 还用跨休眠周期的 HCCL anchor 保护通信域清理与恢复。
aliases:
  - sleep 模式额外清理
  - rl_config.sleep_mode_extra_cleanup
chapters:
  - '19'
sources:
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L162-L163'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L216-L228'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L272-L280'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/device_allocator/sleep_mem_optimized.py#L47-L64
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/device_allocator/sleep_mem_optimized.py#L116-L128
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/device_allocator/sleep_mem_optimized.py#L172-L186
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L82-L82
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/sleep_mode.md#L48-L58
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L261-L292'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L241-L258'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L291-L294'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1613-L1671'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L245-L245
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L292-L299
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/sleep_mode.md#L53-L63
  - 'vllm-ascend@baa023ad:tests/ut/worker/test_worker_v1.py#L595-L638'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rl.md#L102-L116'
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L163
  - 'vllm-ascend@baa023ad:tests/ut/test_ascend_config.py#L99-L107'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/device_allocator/sleep_mem_optimized.py#L47-L64
  - >-
    vllm-ascend@baa023ad:vllm_ascend/device_allocator/sleep_mem_optimized.py#L72-L128
  - >-
    vllm-ascend@baa023ad:vllm_ascend/device_allocator/sleep_mem_optimized.py#L146-L186
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L280-L294'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L175-L175'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L228-L230'
  - 'vllm-ascend@2ed6cbba:docs/source/user_guide/release_notes.md#L120-L120'
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_distributed.py#L190-L245'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/device_allocator/sleep_mem_optimized.py#L78-L101
  - 'vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L329-L370'
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/configuration/additional_config.md#L78-L78
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L739-L745'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L162-L163'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rl.md#L50-L57'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L989-L996'
  - 'vllm-ascend@2c59ff10:vllm_ascend/device_allocator/camem.py#L141-L156'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L772-L790'
  - >-
    raw:sha256-684654386952329a556fc6feab7fbc11dc918d6820a88738367952291841b497.md#L1-L612
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L1659-L1673
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:docs/source/user_guide/release_notes.md#L120-L120
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L365-L395'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L246-L263'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L276-L299'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1893-L1908'
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L63-L71
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L154-L248
  - >-
    vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L257-L302
  - 'vllm-ascend@2c59ff10:vllm_ascend/device_allocator/camem.py#L195-L249'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L241-L249'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L197-L200'
  - 'https://github.com/vllm-project/vllm-ascend/pull/9585'
  - 'https://github.com/vllm-project/vllm-ascend/pull/13838'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L681-L692'
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
evidence: S
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 清理插在 NPUWorker.sleep() / wake_up() 这一层，管的是 worker 启动时建起来的那些通信域和已捕获的图
  - to: ascend-config-system
    kind: builds-on
    note: 这个键从顶层搬进 rl_config 子配置，旧写法在 main 上会撞上 extra="forbid"——搬家的机制在那一页
contradicts: []
updated: 2026-11-03T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-024d8bdfc8e0a81cafa0b07e205478201aefcd1adf86c717b31c22e7c02f74cf.md
  - >-
    raw/sha256-684654386952329a556fc6feab7fbc11dc918d6820a88738367952291841b497.md
  - >-
    raw/sha256-9a1de295e137cf7cc6a824745d1a77381a799fc5a3d37c3290ec02c040e09ea7.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
---

## 一句话

**v0.30.0rc2 对照：** 旧顶层键不存在，有效入口仍是 rl_config.sleep_mode_extra_cleanup，默认 False。Worker 的 sleep、wake_up 都同时检查 rl_config.enabled 与此清理子键；只开子键而不启用 RL 配置不会调用额外清理管理器。旧键移除与清理功能移除是两回事。

rc2 的清理管理器新增跨休眠周期的 HCCL anchor：多 rank 下先创建保活通信组并用 barrier 实际初始化，再清理业务通信组；创建或初始化失败、MoE 拆卸准备失败时会跳过本轮 HCCL 清理，单 rank 也跳过。唤醒先恢复业务通信组与图，再释放 anchor；分阶段只唤醒 weights 时先保留它，等 kv_cache 恢复后再收尾。下文关于清理顺序及“没有 try/except”的走读仅对应旧快照，不能外推到 rc2；完整新流程见 [sleep mode 版本差异](../concepts/sleep-mode.md#版本差异)。

同卡 RL 后训练里，推理引擎需要在训练阶段让出显存。基本 sleep mode 释放可睡眠池中的分配；打开额外清理后，还会尝试释放 HCCL 的设备侧通信组，并清空 ACL 图的 attention workspace、作废已捕获的图。通信组的 CPU 侧保留，设备侧在唤醒时重建 [S8]。默认关闭；它适合需要进一步降低睡眠占用、能够接受恢复开销的同卡工作流。

配置入口分两代：v0.23维护快照2c59ff10、GLM db701c1f和v0.26 2ed6cbba使用顶层enable_sleep_mode_extra_cleanup，默认False；固定main baa023ad及rc2移到rl_config.sleep_mode_extra_cleanup，还须启用rl_config.enabled。旧三版sleep/wake_up的守卫相同，rc2清理与唤醒内部已增加前述anchor流程，不能因配置名相同就套旧实现。[C9][C32]

做清理的 `sleep_mem_optimized.py` 在 2c59ff10、db701c1f 和 main 上逐字相同；v0.26 只差两处写法（4 增 6 删）：那一版把 ACL 图参数按「带不带 LoRA」存成两份 dict，不管实际用不用 LoRA 都建两份 [C29]，所以清理改成用 `acl_graph.iter_graph_params()` 逐份遍历 [C28]；v0.23 与 main 的图参数只有一份，清理动作一样。

**GLM 双机的固定在线推理流程没有启用它。** 教程两机命令没有睡眠开关或额外清理配置，流程中也没有同卡训练阶段与 sleep 调用，因而不会为每次生成执行这些清理；部署前提与启动命令统一见 [Worker 启动](../concepts/npu-worker-lifecycle.md#怎么开)。如要改成同卡训练与推理交替，需要一起设计暂停请求、权重更新和唤醒流程。

**公开历史报告有显存数字，但不是固定 GLM 双机的效果。** [PR #9585](https://github.com/vllm-project/vllm-ascend/pull/9585) 作者报告：启用 EP 的测试中，睡后占用从约 3.2 GB 降到约 0.7 GB；未启用 EP 时从约 1.26 GB 降到约 0.72 GB。单位沿用作者的 GB，正文未给出足以复现该数值的完整模型与硬件条件，而且该 PR 的描述还包含 rotary cache 清理，不能把总差值归给本页固定实现的两项动作。固定 GLM 双机的释放量和唤醒时延仍需对应环境测量。

## 事实表

| 项 | v0.23.0 与 v0.26.0rc | main | 意味着什么 |
|---|---|---|---|
| 配置键 | 顶层 `enable_sleep_mode_extra_cleanup`（2c59ff10 / db701c1f / 2ed6cbba） | `rl_config.sleep_mode_extra_cleanup`（baa023ad） | v0.23 → v0.26 不需改键；main 通常拒绝未知键，但检测到 vllm_omni 时会先过滤未知键并告警。旧键被过滤不代表清理功能已开启；升级应使用 main 的嵌套键 |
| 类型 / 默认值 | bool / `False`：2c59ff10 与 db701c1f 的 `ascend_config.py:163`、2ed6cbba 的 `:175` [C1] [C24]；三版官方参数表也都写 `False` | bool / `False`：`RlConfig` 字段默认 | 四个钉住版本上**默认都是关**；不显式打开就永远不走这条路径 |
| 生效条件 | 本开关为真（`getattr(ascend_config, ..., False)` 守卫） | `rl_config.enabled` **与**本开关同时为真 [C10] | main 上只写子键、漏掉 `enabled: true`，等于没开 |
| 取值解析 | `additional_config.get` 取原值，字符串 `"false"` 也是真 | pydantic lax 强转，`"false"` → `False` [C19] | v0.23 与 v0.26 上用字符串传 `"false"` 都会**反向打开**开关 [D] |
| 前置条件 | 得有人真去调 `sleep(level≥1)`：`level<1` 在 EngineCore 就返回，到不了 Worker [C31] | 同左 | Worker 的清理守卫不读取睡眠开关，但正常使用仍应开启专用池。旧平台未启用睡眠时可能注入 expandable_segments:True；若分配器首次构造时该配置仍在，会触发断言。仅凭这些片段不能推导发生概率；main 的平台注入、RL 配置移除相对于分配器首次构造的顺序及最终环境值仍缺核定证据 [C35][C36] |
| sleep 时释放 | HCCL 设备侧通信组 + ACL 图 workspace | 同左 | HCCL 清理要求分布式已初始化；正常完成 Worker 初始化时会满足，包括单 rank。ACL 图清理另要求 use_aclgraph 为真。rc2 即使已初始化，也可能因 anchor 策略跳过 HCCL 清理，见开篇 |
| wake_up 时补偿 | 重建 HCCL + 刷新 MoE 通信域 + `capture_model()` | 同左 | 唤醒延迟上升，量级取决于图捕获耗时 |
| 分标签唤醒（含空列表） | 仅当 `tags` 为 `None` 或含 `"kv_cache"` 时重捕获图 | 同左 | `wake_up(tags=["weights"])` 与 `tags=[]` 都跳过重捕获；空列表不等于None（来源5）。设备恢复仍须核实际结果 |
| 适用部署 | 文档只说面向 RL 负载，没限同卡 | 明确限「同卡（same-device）模式」[S13] | 官方表格写明：训练与 rollout 用不同 NPU 时靠 pause/resume + `hccl` 权重传输，通常不需要 sleep mode [S33] |
| 已知缺陷 | 所列 v0.26 发布说明记录 DeepSeek-V4 开启额外清理后，可能在唤醒后无法恢复（#15648） | 本页来源没有给出 main 是否修复的结论 | 在这些已记录风险的快照上，DeepSeek-V4 应避免开启；其他提交须查修复范围 |

官方参数表：[v0.23.0](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html) / [latest](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)。

## 为什么存在

同卡训练工作流可能交替执行生成与训练：生成阶段用 vLLM 跑自回归，训练阶段要在同一张 NPU 上做前反向，因而需要推理引擎暂时让出显存。level 1 把权重池内容备份到 CPU、丢弃旧 KV；level 2 也不保留权重池内容，但 Worker 会另存运行所需的 buffers，持久分配仍保留。生成与训练怎样交替、新权重怎样换回推理端，见 [vLLM-Ascend for RL](../concepts/vllm-ascend-for-rl.md)。

基本睡眠主要管理 CaMemAllocator 的可睡眠分配；分配器首次构造时还会拒绝 expandable_segments:True。启用专用池的正常启动路径会在权重分配阶段使用它，因此冲突可能先在启动时暴露。池外的 HCCL 通信缓冲与 ACL 图 attention workspace 仍可能驻留。额外清理尝试释放这些资源，实际差值取决于通信组、图尺寸及分配器状态，不能直接套用前述历史 PR 数字。

```wiki-diagram
file: enable-sleep-mode-extra-cleanup
```

清理发生在分配器释放映射之前；唤醒时，分配器先按标签重新映射设备内存，并仅对有 CPU 备份的分配拷回内容。旧 KV 没有备份，只恢复空间；level 2 的权重仍须外部更新。随后重建通信域、刷新 MoE dispatcher 的句柄，最后按 tags 决定是否重捕获图 [C23][C47]。

照源码点一遍，睡下去时按这个次序做两半：

- **先是 ACL 图半边**：把三套图参数（主图、草稿图、草稿 prefill 图）里按 token 数存的 `workspaces` 逐个置 `None`，把参数里成列表的字段清空，再清掉每个 graph wrapper 的 `concrete_aclgraph_entries` 并把 `first_run_finished` 置回 `False`，最后清掉 `model_runner.cudagraph_manager` 里的图并把 `_graphs_captured` 置 `False` [C21]。也就是说，已捕获的图不是「暂时失效」，而是被当作从没捕获过。
- **再是 HCCL 半边**：先 `wait()` 掉 Worker 手里还没完成的 PP 发送句柄，再 `torch.npu.synchronize()`，然后逐个通信组释放设备侧资源——销毁 device communicator、按引用计数退还共享的 HCCL 组、销毁不共享的那些组，最后把 `device_group` 置 `None`；`cpu_group` 不动 [C27]。唤醒时 `restore_hccl()` 就地重建设备组（`create_cpu_group=False`）并重建 communicator，再刷新 MoE token dispatcher 持有的组句柄。

在分布式可用且已初始化时，HCCL清理先等待全部流水线发送句柄，再清空发送记录、同步NPU、销毁通信组（来源6，2c59ff10 sleep_mem_optimized.py 172–178）。顺序说明何时可清理，实际释放量和唤醒时延仍要测量。

main 把这个开关收进 `rl_config` 这个「RL 一键模式」子配置，不只是改了个名字。`rl_config.enabled` 为真会连带强制 `weight_nz_mode=0`、设 `VLLM_SERVER_DEV_MODE=1`、从 `PYTORCH_NPU_ALLOC_CONF` 里摘掉 `expandable_segments`（它与 sleep-mode 内存池不兼容）[S17]。覆盖 `weight_nz_mode` 时会打一条 warning：`RL config requires weight_nz_mode=0; overriding AscendConfig.weight_nz_mode from %s to 0.` [C9]旧写法要用户自己逐项配的那些 RL 前置项，现在由 `enabled: true` 一次给全；逐字对照见官方迁移表。

## 开了的代价

**恢复通信域和重捕获图增加唤醒工作。** ACL 图启用且 tags 为 None 或包含 kv_cache 时，唤醒会调用 capture_model；只唤醒 weights 时跳过图捕获。此前实际拆除的 HCCL 组也需要重建。官方建议唤醒时延优先时保持额外清理关闭 [S15]；具体增量取决于实际释放的组、图尺寸及唤醒标签。

几个容易踩的点：

- **main 上必须写两个键。** rl_config.enabled 与清理子键是与关系，只给子键不会调用清理管理器。现有 wake_up 单元测试用主开关 False、子键 True 的组合，核对的是权重布局与 allocator 调用；它不是此组合全部行为的设备验证 [C16]。
- **v0.23 与 v0.26 上别用字符串传值。** 这几版都是直接 `additional_config.get(...)` 取原值再当布尔用，JSON 里写 `"false"`（带引号）在 Python 里是真值，结果是**想关反而开了**。main 的 `RlConfig` 是 pydantic 模型，`"false"` 会被强转成 `False`，不吃这个亏；顺带，写错子键名在 main 上直接报验证错。
- **DeepSeek-V4 在所列 v0.26 快照上应避免开启。** 对应 Known Issues 记录：sleep mode 配合额外清理后可能无法从唤醒中恢复，并说明 sleep mode 主要面向训练。这里保留该快照的风险提示；发布说明没有给出修复提交，不能据此断言整个后续分支都受影响或 main 已修复。

- **旧写法在 main 上基本是硬错误（v0.26 上则不用改）。** 顶层未知键不在豁免名单里，会原样进入 `extra="forbid"` 的 `AscendConfig`，构造阶段就抛验证错误 [!]。唯一的例外是装了 `vllm_omni`：那种环境下未知键只打一条 warning 然后被悄悄丢掉，`enable_sleep_mode_extra_cleanup` 就成了真正的静默无效。所以「起不来」反而是好消息，「起来了但没省显存」才要去查是不是撞上了这条豁免。
- **两段式唤醒把图捕获放在 KV 阶段。** 按 weights → 外部灌新权重 → kv_cache 的顺序各调用一次时，图只在第二次调用捕获；如果重复传 None 或含 kv_cache 的标签，管理器仍会再次调用 capture_model，并没有“一个睡眠周期只捕获一次”的额外守卫。不要在权重未就绪时提前进入捕获阶段。
- **ACL 图没开时会跳过图清理和重捕获。** HCCL 是否实际拆除仍取决于初始化状态；rc2 还取决于 anchor 与 MoE 拆卸准备是否成功。不能据此保证每次 eager 睡眠都释放了某个固定大小的通信域。
- **清理中途报错不会被吞掉。** 这两条路径上没有 `try`/`except`，销毁、重建、重捕获里任何一步抛错都会原样冒到 `sleep()` / `wake_up()` 的调用方。好的一面是 `restore_hccl()` 对还活着的组返回 `False`，重复唤醒不会把组建两遍。

**日志可以定位执行步骤，并给出显存变化的观测值。** 下面的 GiB 是整张卡清理前后空闲显存的差，不是某个通信组的精确归因；其他进程同期分配或释放也会影响它。可结合设备监测与调用耗时验证。源码里的日志模板是：

- `Sleep mode released HCCL and attention workspace memory: %.3f GiB.`（清理结束时记录整卡空闲显存变化）
- `Destroyed %d HCCL process groups for sleep mode.`（正常完成且至少拆掉一个组时才打；没看到它还可能是日志级别或中途异常，不能单凭缺行判定零释放）
- `Restored %d HCCL process groups after sleep mode.`（唤醒时打，哪怕恢复数是 0 也会打）

官方 RL 指南给的启动命令（main，同卡模式；本项目没有跑过这条命令，照搬前自己核一遍模型和环境）：

```bash
VLLM_WORKER_MULTIPROC_METHOD=spawn \
vllm serve Qwen/Qwen3-0.6B \
    --enable-sleep-mode \
    --additional-config '{"rl_config": {"enabled": true, "sleep_mode_extra_cleanup": true}}'
```

旧 v0.23.0 与 v0.26 的清理键写成 `--additional-config '{"enable_sleep_mode_extra_cleanup": true, "weight_nz_mode": 0}'`，并显式设置 `VLLM_SERVER_DEV_MODE=1` 才能使用在线管理接口；睡眠开关与 spawn 仍保留。旧清理键不会像 rl_config.enabled 那样自动关闭 NZ，非零 NZ 会在 wake_up 入口被拒绝 [C48]。启动前还须移除不兼容的 expandable_segments 配置，完整小模型流程见 [sleep mode](../concepts/sleep-mode.md#怎么开)。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（2 个文件） |
| releases/v0.26.0rc | 有（2 个文件） |
| releases/v0.30.0rc2 | 无 |
| releases/v0.30.0 | 无 |

- **引入**：2026-06-22 · 92eeab2fe9a73394d2118de3c8459d69cc9d8e62 · PR [#9585](https://github.com/vllm-project/vllm-ascend/pull/9585) —— [Feature] vllm-ascend sleep mode optimization for residual memory usage (#9585)
  包含该提交的 tag：v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/zxy_fix_boradash
  - `vllm_ascend/patch/worker/patch_distributed.py` +85 / −49（文本行变化）
  - `vllm_ascend/ascend_config.py` +2 / −0（文本行变化）
  - `vllm_ascend/compilation/acl_graph.py` +2 / −0（文本行变化）
  - `vllm_ascend/device_allocator/sleep_mem_optimized.py` +186 / −0（文本行变化）
  - `vllm_ascend/ops/fused_moe/token_dispatcher.py` +7 / −0（文本行变化）
- **移除**：2026-08-24 · 9cf7a0a23944b032d512040f4da542777042cc3e · PR [#13838](https://github.com/vllm-project/vllm-ascend/pull/13838) —— [Refactor][Config] Migrate AscendConfig to @config pydantic dataclass (#13838)
  包含该提交的 tag：v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/megakernel、origin/zxy_fix_boradash
  - `vllm_ascend/ascend_config.py` +674 / −748（文本行变化）
  - `vllm_ascend/utils.py` +17 / −25（文本行变化）
  - `vllm_ascend/compilation/graph_fusion_pass_manager.py` +7 / −5（文本行变化）
  - `vllm_ascend/model_loader/rfork/rfork_loader.py` +3 / −5（文本行变化）
  - `vllm_ascend/spec_decode/llm_base_proposer.py` +5 / −3（文本行变化）

当前含该标识符的 tag：v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_sleep_mode_extra_cleanup"]` |
| 类型 | `unknown` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:163` [C18] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 对照源码

- 来源 38：vllm-ascend@baa023ad，vllm_ascend/ascend_config.py，L1659–L1673。
- 来源 39：vllm-ascend@2ed6cbba，docs/source/user_guide/release_notes.md，L120–L120。
