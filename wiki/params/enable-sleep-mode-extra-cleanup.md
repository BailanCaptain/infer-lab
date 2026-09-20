---
id: enable-sleep-mode-extra-cleanup
title: enable_sleep_mode_extra_cleanup
type: param
summary: >-
  sleep 时额外销毁 HCCL 通信域、清空 ACL 图工作区，把分配器池子之外的那两块显存也还给训练进程；默认关闭，因为唤醒要重建通信域并重新捕获图。v0.23
  是顶层键，main 上已搬进 rl_config。
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
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L261-L292'
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L252-L255'
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L291-L294'
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1603-L1661'
  - >-
    vllm-ascend@b255ab59:docs/source/user_guide/configuration/additional_config.md#L241-L241
  - >-
    vllm-ascend@b255ab59:docs/source/user_guide/configuration/additional_config.md#L288-L295
  - >-
    vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/sleep_mode.md#L53-L63
  - 'vllm-ascend@b255ab59:tests/ut/worker/test_worker_v1.py#L598-L601'
  - 'vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/rl.md#L102-L116'
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L163
  - 'vllm-ascend@b255ab59:tests/ut/test_ascend_config.py#L99-L107'
  - >-
    vllm-ascend@b255ab59:vllm_ascend/device_allocator/sleep_mem_optimized.py#L47-L64
  - >-
    vllm-ascend@b255ab59:vllm_ascend/device_allocator/sleep_mem_optimized.py#L116-L128
  - >-
    vllm-ascend@b255ab59:vllm_ascend/device_allocator/sleep_mem_optimized.py#L146-L186
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L280-L294'
evidence: S
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 清理插在 NPUWorker.sleep() / wake_up() 这一层，管的是 worker 启动时建起来的那些通信域和已捕获的图
  - to: ascend-config-system
    kind: builds-on
    note: 这个键从顶层搬进 rl_config 子配置，旧写法在 main 上会撞上 extra="forbid"——搬家的机制在那一页
contradicts: []
updated: '2026-09-20'
rawSources:
  - >-
    raw/sha256-024d8bdfc8e0a81cafa0b07e205478201aefcd1adf86c717b31c22e7c02f74cf.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
---

## 一句话

RL 后训练里推理引擎和训练进程抢同一张卡，`sleep()` 默认只退还 sleep-mode 分配器那个池子里的显存。打开这个开关，`sleep()` 会再多做两件事：销毁 HCCL 通信域，清空 ACL 图的 attention workspace 并作废已捕获的图——池子外压着的那两块也还给训练侧 [S8]。默认 `false`，该碰它的只有「同卡 RL、显存卡在最后一档、唤醒慢一点无所谓」的人 [S7]。

配置写法两版不同：v0.23.0 是顶层键 `enable_sleep_mode_extra_cleanup`，main 上这个顶层键**已被移除**，功能搬进 `rl_config.sleep_mode_extra_cleanup`，还得和 `rl_config.enabled: true` 一起给 [C9] [C10]。搬家的只是开关——做清理的 `sleep_mem_optimized.py` 两版逐字相同。

[那条请求](../concepts/one-request.md)走不到这里：单卡起 Qwen3-0.6B 答一个 37 token 的问题，既没给 `--enable-sleep-mode`，也没有训练进程来抢卡，这段代码一次都不会被调用。要它生效，得先有个 RL 训练循环和推理引擎在同一张卡上轮流上场。

## 事实表

| 项 | v0.23.0 | main | 意味着什么 |
|---|---|---|---|
| 配置键 | 顶层 `enable_sleep_mode_extra_cleanup` | `rl_config.sleep_mode_extra_cleanup` [C9] | 把 v0.23.0 的配置原样搬到 main，多半是**启动即报错**而不是被忽略 [!] |
| 类型 / 默认值 | bool / `False` | bool / `false` | 不显式打开就永远不走这条路径 |
| 生效条件 | 本开关为真 | `rl_config.enabled` **与**本开关同时为真 [C10] | main 上只写子键、漏掉 `enabled: true`，等于没开 |
| 取值解析 | `additional_config.get` 取原值，字符串 `"false"` 也是真 | pydantic lax 强转，`"false"` → `False` [C19] | v0.23.0 上用字符串传 `"false"` 会**反向打开**开关 [D] |
| 前置开关 | 必须同时 `--enable-sleep-mode` | 同左 | 不开 sleep mode 时这段代码根本不被调用 |
| sleep 时释放 | HCCL 通信域 + ACL 图 workspace | 同左 | ACL 图那一半还要 `model_runner.use_aclgraph` 为真才执行 [C20] |
| wake_up 时补偿 | 重建 HCCL + 刷新 MoE 通信域 + `capture_model()` | 同左 | 唤醒延迟上升，量级取决于图捕获耗时 |
| 分标签唤醒 | 仅当 `tags` 为 `None` 或含 `"kv_cache"` 时重捕获图 | 同左 | `wake_up(tags=["weights"])` 不会触发重捕获 [C21] |
| 适用部署 | 文档未限定 | 明确限「同卡（same-device）模式」[S13] | 跨卡 RL 走 pause/resume + HCCL 权重传输，不用这个开关 |

官方参数表：[v0.23.0](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html) / [latest](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)。

## 为什么存在

sleep mode 是给 RL 后训练（PPO / GRPO / DPO 这类在线算法）准备的：生成阶段用 vLLM 跑自回归，训练阶段要同一张 NPU 做前反向，两个阶段的并行策略还常常不同，所以生成一结束就得把显存让出来。`llm.sleep()` 做的就是这件事——level 1 把权重换出到 CPU、丢弃 KV cache，level 2 连权重一起丢。

但 `sleep()` 只管 `CaMemAllocator` 这个内存池里的东西 [C2]。池子之外还压着两块显存：HCCL 通信域自带的缓冲区，以及 ACL 图捕获时留下的 attention workspace。推理侧睡着了，这两块仍占着卡，训练侧就少了这么多可用显存——RL 场景里这往往正是 batch size 上不去的那一档。这个开关就是把这两块也一并退还。

```wiki-diagram
file: enable-sleep-mode-extra-cleanup
```

顺序是有讲究的：清理发生在分配器换出**之前**（图还在、通信域还在的时候才清得动），唤醒时反过来——先 `allocator.wake_up()` 把权重和 KV cache 搬回卡上，再重建通信域、刷新 MoE dispatcher 手里的句柄，最后视 `tags` 决定要不要重捕获图 [C23]。

main 把这个开关收进 `rl_config` 这个「RL 一键模式」子配置，不只是改了个名字。`rl_config.enabled` 为真会连带强制 `weight_nz_mode=0`、设 `VLLM_SERVER_DEV_MODE=1`、从 `PYTORCH_NPU_ALLOC_CONF` 里摘掉 `expandable_segments`（它与 sleep-mode 内存池不兼容）[C9] [S17]。旧写法要用户自己逐项配的那些 RL 前置项，现在由 `enabled: true` 一次给全；逐字对照见官方迁移表 [S14]。

## 开了的代价

**唤醒变慢，这是主要代价。** 睡前作废了已捕获的 ACL 图，唤醒就必须重新 `capture_model()` 把图全部捕获一遍；HCCL 通信域也要逐个 `restore_hccl()` 重建。官方把这条取舍写得很直白：**当「唤醒快」比「睡时省显存」更重要时，保持这个开关关闭** [S15]。默认值就是按这个判断定的。

几个容易踩的点：

- **main 上必须写两个键。** `rl_config.enabled and rl_config.sleep_mode_extra_cleanup` 是与关系，只给子键不给 `enabled: true` 静默无效——上游单测里就专门造了这个组合来验证不走清理路径 [C16]。
- **v0.23.0 上别用字符串传值。** 那一版直接 `additional_config.get(...)` 取原值再当布尔用，JSON 里写 `"false"`（带引号）在 Python 里是真值，结果是**想关反而开了**。main 的 `RlConfig` 是 pydantic 模型，`"false"` 会被强转成 `False`，不吃这个亏；顺带，写错子键名在 main 上直接 `ValueError` [C19]。
- **旧写法在 main 上基本是硬错误。** 顶层未知键不在豁免名单里，会原样进入 `extra="forbid"` 的 `AscendConfig`，构造阶段就抛验证错误 [!]。唯一的例外是装了 `vllm_omni`：那种环境下未知键只打一条 warning 然后被悄悄丢掉，`enable_sleep_mode_extra_cleanup` 就成了真正的静默无效 [C12]。所以「起不来」反而是好消息，「起来了但没省显存」才要去查是不是撞上了这条豁免。
- **分标签唤醒时重捕获只发生一次。** level 2 的两段式唤醒 `wake_up(tags=["weights"])` → 外部灌新权重 → `wake_up(tags=["kv_cache"])`，图只在第二次捕获 [C21]；顺序反过来会在权重还没就位时把图捕获掉。
- **ACL 图没开时只省下 HCCL 那一半。** ACL 图清理受 `model_runner.use_aclgraph` 门控 [C20]，eager 模式下打开这个开关只释放通信域内存，唤醒代价也相应只剩重建 HCCL。

完整可复制的启动命令（main，同卡模式）：

```bash
VLLM_WORKER_MULTIPROC_METHOD=spawn \
vllm serve Qwen/Qwen3-0.6B \
    --enable-sleep-mode \
    --additional-config '{"rl_config": {"enabled": true, "sleep_mode_extra_cleanup": true}}'
```

v0.23.0 上的等价写法是 `--additional-config '{"enable_sleep_mode_extra_cleanup": true}'`，其余不变。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（2 个文件） |

- **引入**：2026-06-22 · 92eeab2fe9a73394d2118de3c8459d69cc9d8e62 · PR [#9585](https://github.com/vllm-project/vllm-ascend/pull/9585) —— [Feature] vllm-ascend sleep mode optimization for residual memory usage (#9585)
  包含该提交的 tag：v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/patch/worker/patch_distributed.py` +85 / −49（文本行变化）
  - `vllm_ascend/ascend_config.py` +2 / −0（文本行变化）
  - `vllm_ascend/compilation/acl_graph.py` +2 / −0（文本行变化）
  - `vllm_ascend/device_allocator/sleep_mem_optimized.py` +186 / −0（文本行变化）
  - `vllm_ascend/ops/fused_moe/token_dispatcher.py` +7 / −0（文本行变化）
- **移除**：2026-08-24 · 9cf7a0a23944b032d512040f4da542777042cc3e · PR [#13838](https://github.com/vllm-project/vllm-ascend/pull/13838) —— [Refactor][Config] Migrate AscendConfig to @config pydantic dataclass (#13838)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.27.1rc、origin/revert-15210-glm52_v2_dspark、origin/rfc/megakernel
  - `vllm_ascend/ascend_config.py` +674 / −748（文本行变化）
  - `vllm_ascend/utils.py` +17 / −25（文本行变化）
  - `vllm_ascend/compilation/graph_fusion_pass_manager.py` +7 / −5（文本行变化）
  - `vllm_ascend/model_loader/rfork/rfork_loader.py` +3 / −5（文本行变化）
  - `vllm_ascend/spec_decode/llm_base_proposer.py` +5 / −3（文本行变化）

当前含该标识符的 tag：v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1

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
