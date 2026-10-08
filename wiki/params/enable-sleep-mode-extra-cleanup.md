---
id: enable-sleep-mode-extra-cleanup
title: enable_sleep_mode_extra_cleanup
type: param
summary: >-
  sleep 时额外释放 HCCL 设备侧通信组、清空 ACL 图工作区，把分配器池子之外的那两块显存也还给训练进程；默认关闭，因为唤醒要重建通信域并重新捕获图。v0.23
  与 v0.26 都是顶层键，main 上才搬进 rl_config。
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
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L252-L255'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L291-L294'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1613-L1671'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L245-L245
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L292-L299
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/sleep_mode.md#L53-L63
  - 'vllm-ascend@baa023ad:tests/ut/worker/test_worker_v1.py#L610-L613'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/rl.md#L102-L116'
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L163
  - 'vllm-ascend@baa023ad:tests/ut/test_ascend_config.py#L99-L107'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/device_allocator/sleep_mem_optimized.py#L47-L64
  - >-
    vllm-ascend@baa023ad:vllm_ascend/device_allocator/sleep_mem_optimized.py#L116-L128
  - >-
    vllm-ascend@baa023ad:vllm_ascend/device_allocator/sleep_mem_optimized.py#L146-L186
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L280-L294'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L175-L175'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L228-L230'
  - 'vllm-ascend@2ed6cbba:docs/source/user_guide/release_notes.md#L120-L120'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_distributed.py#L190-L245
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
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: S
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 清理插在 NPUWorker.sleep() / wake_up() 这一层，管的是 worker 启动时建起来的那些通信域和已捕获的图
  - to: ascend-config-system
    kind: builds-on
    note: 这个键从顶层搬进 rl_config 子配置，旧写法在 main 上会撞上 extra="forbid"——搬家的机制在那一页
contradicts: []
updated: "2026-10-02"
rawSources:
  - >-
    raw/sha256-024d8bdfc8e0a81cafa0b07e205478201aefcd1adf86c717b31c22e7c02f74cf.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
---

## 一句话

RL 后训练里推理引擎和训练进程抢同一张卡，`sleep()` 默认只退还 sleep-mode 分配器那个池子里的显存。打开这个开关，`sleep()` 会再多做两件事：释放 HCCL 的设备侧通信组（同一个通信组里的 CPU 侧那份不销毁，只拆设备侧），清空 ACL 图的 attention workspace 并作废已捕获的图——池子外压着的那两块也还给训练侧 [S8]。默认 `false`，该碰它的只有「同卡 RL、显存卡在最后一档、唤醒慢一点无所谓」的人。

配置写法只在 main 上变了：**v0.23 列的两个提交**（维护分支 2c59ff10、含 GLM 代码的 orphan 提交 db701c1f [C32]）**和 v0.26**（2ed6cbba）都是顶层键 `enable_sleep_mode_extra_cleanup`，照旧 `additional_config.get(..., False)` 读取，`sleep()` / `wake_up()` 里那对守卫也只是挪了行号、逻辑一字未改；到 main（baa023ad）这个顶层键才**被移除**，功能搬进 `rl_config.sleep_mode_extra_cleanup`，还得和 `rl_config.enabled: true` 一起给 [C9]。

做清理的 `sleep_mem_optimized.py` 在 2c59ff10、db701c1f 和 main 上逐字相同；v0.26 只差两处写法（4 增 6 删）：那一版把 ACL 图参数按「带不带 LoRA」存成两份 dict，不管实际用不用 LoRA 都建两份 [C29]，所以清理改成用 `acl_graph.iter_graph_params()` 逐份遍历 [C28]；v0.23 与 main 的图参数只有一份，清理动作一样。

**放到 GLM 双机：没开，也不该开。** 本部署是 2×A2×8 的在线推理（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)），教程两机命令里既没有 `--enable-sleep-mode`，也没有 `--additional-config`（[Worker 启动那一页核过教程命令里有什么](../concepts/npu-worker-lifecycle.md#怎么开)），更没有训练进程来抢这 16 张卡——谁也不会去调 `sleep()`，这两件清理一次都不会发生。要它有意义，得先有个 RL 训练循环和推理引擎在同一张卡上轮流上场。

**能省多少显存、唤醒慢多少，没有公开的实测数**：官方文档只给方向（省睡时显存、换来更慢的唤醒），不给数字；GLM 双机那套权重和 KV cache 账目是另一回事，不是这个开关的效果。要真实数值，只能看自己环境里跑出来的日志（见「[开了的代价](#开了的代价)」）。

## 事实表

| 项 | v0.23.0 与 v0.26.0rc | main | 意味着什么 |
|---|---|---|---|
| 配置键 | 顶层 `enable_sleep_mode_extra_cleanup`（2c59ff10 / db701c1f / 2ed6cbba） | `rl_config.sleep_mode_extra_cleanup`（baa023ad） | v0.23 → v0.26 升级这个键不用改；旧写法到 main 上会撞 `extra="forbid"`，是构造阶段报错而不是被忽略（源码分支如此，未实跑）[C12] [!] |
| 类型 / 默认值 | bool / `False`：2c59ff10 与 db701c1f 的 `ascend_config.py:163`、2ed6cbba 的 `:175` [C1] [C24]；三版官方参数表也都写 `False` | bool / `False`：`RlConfig` 字段默认 | 四个钉住版本上**默认都是关**；不显式打开就永远不走这条路径 |
| 生效条件 | 本开关为真（`getattr(ascend_config, ..., False)` 守卫） | `rl_config.enabled` **与**本开关同时为真 [C10] | main 上只写子键、漏掉 `enabled: true`，等于没开 |
| 取值解析 | `additional_config.get` 取原值，字符串 `"false"` 也是真 | pydantic lax 强转，`"false"` → `False` [C19] | v0.23 与 v0.26 上用字符串传 `"false"` 都会**反向打开**开关 [D] |
| 前置条件 | 得有人真去调 `sleep(level≥1)`：`level<1` 在 EngineCore 就返回，到不了 Worker [C31] | 同左 | 守卫只读这个键，**不读** `--enable-sleep-mode`；没开 sleep mode 时池子是空的，但真调 `sleep()` 的话这两件清理照样做；而 v0.23 / v0.26 的平台层在没开 sleep mode 时默认会给 `PYTORCH_NPU_ALLOC_CONF` 补上 `expandable_segments:True` [C36]，所以清理做完后 `sleep()` 大概率在取分配器那一步抛 AssertionError（源码分支推断，未实跑；main 把这段注入挪了位置，且 RL 模式会反过来摘掉这一项，先后顺序本轮未核）[!] |
| sleep 时释放 | HCCL 设备侧通信组 + ACL 图 workspace | 同左 | 两半各有门控：HCCL 那一半要 `torch.distributed` 已初始化 [C6]——Worker 的 `init_device` 不加条件就会初始化分布式（单卡 `world_size=1` 也一样）[C34]，所以这道门实际总是开的；ACL 图那一半要 `model_runner.use_aclgraph` 为真 [C20] |
| wake_up 时补偿 | 重建 HCCL + 刷新 MoE 通信域 + `capture_model()` | 同左 | 唤醒延迟上升，量级取决于图捕获耗时 |
| 分标签唤醒 | 仅当 `tags` 为 `None` 或含 `"kv_cache"` 时重捕获图 | 同左 | `wake_up(tags=["weights"])` 不会触发重捕获 |
| 适用部署 | 文档只说面向 RL 负载，没限同卡 | 明确限「同卡（same-device）模式」[S13] | 官方表格写明：训练与 rollout 用不同 NPU 时靠 pause/resume + `hccl` 权重传输，通常不需要 sleep mode [S33] |
| 已知缺陷 | v0.26 上 DeepSeek-V4 开了它可能唤醒不回来（#15648） | 未列入 | 在 v0.26 上跑 DeepSeek-V4 就别开这个开关 |

官方参数表：[v0.23.0](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html) / [latest](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)。

## 为什么存在

sleep mode 是给 RL 后训练（PPO / GRPO / DPO 这类在线算法）准备的：生成阶段用 vLLM 跑自回归，训练阶段要同一张 NPU 做前反向，两个阶段的并行策略还常常不同，所以生成一结束就得把显存让出来。`llm.sleep()` 做的就是这件事——level 1 把权重换出到 CPU、丢弃 KV cache，level 2 连权重一起丢。生成与训练怎样交替、新权重怎样换回推理端，见[vLLM-Ascend for RL](../concepts/vllm-ascend-for-rl.md)。

但 `sleep()` 只管 `CaMemAllocator` 这个内存池里的东西（这个分配器构造时还会断言 `PYTORCH_NPU_ALLOC_CONF` 里没有 `expandable_segments:True`；开了 sleep mode 时它在加载权重那一步就构造，所以这个断言是**启动时**就炸，不会等到 `sleep()`）[C35]。池子之外还压着两块显存：HCCL 通信域自带的缓冲区，以及 ACL 图捕获时留下的 attention workspace。推理侧睡着了，这两块仍占着卡，训练侧就少了这么多可用显存。这个开关就是把这两块也一并退还；省下来具体是多少，取决于通信域个数和图捕获的尺寸表，源码里不会算出一个固定值，官方也没给过数。

```wiki-diagram
file: enable-sleep-mode-extra-cleanup
```

顺序是有讲究的：清理发生在分配器换出**之前**（图还在、通信域还在的时候才清得动），唤醒时反过来——先 `allocator.wake_up()` 把权重和 KV cache 搬回卡上，再重建通信域、刷新 MoE dispatcher 手里的句柄，最后视 `tags` 决定要不要重捕获图。

照源码点一遍，睡下去时按这个次序做两半：

- **先是 ACL 图半边**：把三套图参数（主图、草稿图、草稿 prefill 图）里按 token 数存的 `workspaces` 逐个置 `None`，把参数里成列表的字段清空，再清掉每个 graph wrapper 的 `concrete_aclgraph_entries` 并把 `first_run_finished` 置回 `False`，最后清掉 `model_runner.cudagraph_manager` 里的图并把 `_graphs_captured` 置 `False` [C21]。也就是说，已捕获的图不是「暂时失效」，而是被当作从没捕获过。
- **再是 HCCL 半边**：先 `wait()` 掉 Worker 手里还没完成的 PP 发送句柄，再 `torch.npu.synchronize()`，然后逐个通信组释放设备侧资源——销毁 device communicator、按引用计数退还共享的 HCCL 组、销毁不共享的那些组，最后把 `device_group` 置 `None`；`cpu_group` 不动 [C27]。唤醒时 `restore_hccl()` 就地重建设备组（`create_cpu_group=False`）并重建 communicator，再刷新 MoE token dispatcher 持有的组句柄。

main 把这个开关收进 `rl_config` 这个「RL 一键模式」子配置，不只是改了个名字。`rl_config.enabled` 为真会连带强制 `weight_nz_mode=0`、设 `VLLM_SERVER_DEV_MODE=1`、从 `PYTORCH_NPU_ALLOC_CONF` 里摘掉 `expandable_segments`（它与 sleep-mode 内存池不兼容）[S17]。覆盖 `weight_nz_mode` 时会打一条 warning：`RL config requires weight_nz_mode=0; overriding AscendConfig.weight_nz_mode from %s to 0.` [C9]旧写法要用户自己逐项配的那些 RL 前置项，现在由 `enabled: true` 一次给全；逐字对照见官方迁移表。

## 开了的代价

**唤醒变慢，这是主要代价。** 睡前作废了已捕获的 ACL 图，唤醒就必须重新 `capture_model()` 把图全部捕获一遍；HCCL 通信域也要逐个 `restore_hccl()` 重建。官方把这条取舍写得很直白：**当「唤醒快」比「睡时省显存」更重要时，保持这个开关关闭** [S15]。默认值就是按这个判断定的。

几个容易踩的点：

- **main 上必须写两个键。** `rl_config.enabled and rl_config.sleep_mode_extra_cleanup` 是与关系，只给子键不给 `enabled: true` 静默无效（守卫就是这个 `and`，见事实表「生效条件」一行）。上游没有专门测这条的用例，只有一条 `wake_up` 用例顺带用了 `enabled=False` + 子键 `True` 的组合并跑通 [C16]。
- **v0.23 与 v0.26 上别用字符串传值。** 这几版都是直接 `additional_config.get(...)` 取原值再当布尔用，JSON 里写 `"false"`（带引号）在 Python 里是真值，结果是**想关反而开了**。main 的 `RlConfig` 是 pydantic 模型，`"false"` 会被强转成 `False`，不吃这个亏；顺带，写错子键名在 main 上直接报验证错。
- **v0.26 上跑 DeepSeek-V4 别开它。** v0.26.0rc 的 Known Issues 里明写着：DeepSeek-V4 的 sleep mode 配上 `sleep_mode_extra_cleanup` 可能唤醒后恢复不回来（issue #15648），并顺带提醒 sleep mode 主要面向训练场景 [S26]。这是本页唯一一条只在 v0.26 上成立的告警。
- **旧写法在 main 上基本是硬错误（v0.26 上则不用改）。** 顶层未知键不在豁免名单里，会原样进入 `extra="forbid"` 的 `AscendConfig`，构造阶段就抛验证错误 [!]。唯一的例外是装了 `vllm_omni`：那种环境下未知键只打一条 warning 然后被悄悄丢掉，`enable_sleep_mode_extra_cleanup` 就成了真正的静默无效。所以「起不来」反而是好消息，「起来了但没省显存」才要去查是不是撞上了这条豁免。
- **分标签唤醒时重捕获只发生一次。** level 2 的两段式唤醒 `wake_up(tags=["weights"])` → 外部灌新权重 → `wake_up(tags=["kv_cache"])`，图只在第二次捕获；顺序反过来会在权重还没就位时把图捕获掉。
- **ACL 图没开时只省下 HCCL 那一半。** ACL 图清理受 `model_runner.use_aclgraph` 门控，eager 模式下打开这个开关只释放通信域内存，唤醒代价也相应只剩重建 HCCL。HCCL 那一半另有一道 `torch.distributed.is_initialized()` 的门，但它实际总是开的（见事实表「sleep 时释放」一行），别指望靠它跳过拆组。
- **清理中途报错不会被吞掉。** 这两条路径上没有 `try`/`except`，销毁、重建、重捕获里任何一步抛错都会原样冒到 `sleep()` / `wake_up()` 的调用方。好的一面是 `restore_hccl()` 对还活着的组返回 `False`，重复唤醒不会把组建两遍。

**怎么确认它真的生效了：看日志。** 清理和恢复各自会打一条 INFO，省了多少、恢复了几个组都在里面，这也是唯一能拿到真实数值的地方。源码里的日志模板逐字是：

- `Sleep mode released HCCL and attention workspace memory: %.3f GiB.`（清理完打一次，GiB 是实测增量）
- `Destroyed %d HCCL process groups for sleep mode.`（只有至少拆掉一个组才打；这行不出现说明一个组都没拆，不等于整段没执行）
- `Restored %d HCCL process groups after sleep mode.`（唤醒时打，哪怕恢复数是 0 也会打）

官方 RL 指南给的启动命令（main，同卡模式；本项目没有跑过这条命令，照搬前自己核一遍模型和环境）：

```bash
VLLM_WORKER_MULTIPROC_METHOD=spawn \
vllm serve Qwen/Qwen3-0.6B \
    --enable-sleep-mode \
    --additional-config '{"rl_config": {"enabled": true, "sleep_mode_extra_cleanup": true}}'
```

v0.23.0 与 v0.26 分支上的等价写法都是 `--additional-config '{"enable_sleep_mode_extra_cleanup": true}'`，其余不变。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 无 |
| releases/v0.18.0 | 无 |
| releases/v0.20.2rc | 无 |
| releases/v0.21.0rc | 无 |
| releases/v0.22.1rc | 无 |
| releases/v0.23.0 | 有（2 个文件） |
| releases/v0.24.0rc | 有（2 个文件） |
| releases/v0.25.1rc | 有（2 个文件） |
| releases/v0.26.0rc | 有（2 个文件） |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 无 |
| releases/v0.29.0rc | 无 |
| main | 无 |

- **引入**：2026-06-22 · 92eeab2fe9a73394d2118de3c8459d69cc9d8e62 · PR [#9585](https://github.com/vllm-project/vllm-ascend/pull/9585) —— [Feature] vllm-ascend sleep mode optimization for residual memory usage (#9585)
  包含该提交的 tag：v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/patch/worker/patch_distributed.py` +85 / −49（文本行变化）
  - `vllm_ascend/ascend_config.py` +2 / −0（文本行变化）
  - `vllm_ascend/compilation/acl_graph.py` +2 / −0（文本行变化）
  - `vllm_ascend/device_allocator/sleep_mem_optimized.py` +186 / −0（文本行变化）
  - `vllm_ascend/ops/fused_moe/token_dispatcher.py` +7 / −0（文本行变化）
- **移除**：2026-08-24 · 9cf7a0a23944b032d512040f4da542777042cc3e · PR [#13838](https://github.com/vllm-project/vllm-ascend/pull/13838) —— [Refactor][Config] Migrate AscendConfig to @config pydantic dataclass (#13838)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/megakernel
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
