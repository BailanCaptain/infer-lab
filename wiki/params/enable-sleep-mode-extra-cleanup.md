---
id: enable-sleep-mode-extra-cleanup
title: enable_sleep_mode_extra_cleanup
type: param
summary: >-
  sleep 时额外释放 HCCL 设备侧通信组并清空 ACL 图工作区，默认关闭；v0.23/v0.26 用顶层键，v0.30.0 与 main
  迁至 rl_config.sleep_mode_extra_cleanup 并引入 HCCL anchor。
aliases:
  - sleep 模式额外清理
  - rl_config.sleep_mode_extra_cleanup
  - additional_config.enable_sleep_mode_extra_cleanup
  - HcclSleepWakeupManager
legacyAnchors:
  一句话: 它额外清理什么，两代配置入口怎么迁？
  为什么存在: 休眠与唤醒的清理次序及 HCCL 生命周期锚点
  开了的代价: 唤醒代价、常见踩坑、日志定位与启动命令
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
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L363-L394'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L259-L301'
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/device_allocator/sleep_mem_optimized.py#L35-L72
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/device_allocator/sleep_mem_optimized.py#L154-L248
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L379-L410'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L324-L373'
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/device_allocator/sleep_mem_optimized.py#L154-L248
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: S
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 清理插在 NPUWorker.sleep() / wake_up() 这一层，管的是 worker 启动时建起来的那些通信域和已捕获的图
  - to: ascend-config-system
    kind: builds-on
    note: 这个键从顶层搬进 rl_config 子配置，旧写法在 v0.30.0 与 main 上会撞上 extra="forbid"——搬家的机制在那一页
  - to: vllm-ascend-for-rl
    kind: builds-on
    note: v0.30.0 与 main 将该能力收归 rl_config.sleep_mode_extra_cleanup，面向同卡 RL 训推交替的显存让出场景
contradicts: []
updated: 2026-11-19T00:00:00.000Z
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

## 它额外清理什么，两代配置入口怎么迁？

在同卡（same-device）强化学习后训练里，同一张 NPU 需要在推理生成与模型训练之间交替使用，进入训练前必须通过 sleep mode 尽量腾空推理显存（整体流程见 [vLLM-Ascend for RL](../concepts/vllm-ascend-for-rl.md)）。推理进程占用的设备显存分两层：`CaMemAllocator` 可睡眠内存池内的权重与 KV cache（基本 sleep mode 已负责备份或释放），以及池外残留的 **HCCL 设备侧通信组缓冲**和 **ACL 图的 attention workspace**。

开启额外清理后，休眠阶段会拆除 HCCL 设备侧业务通信组（保留 `cpu_group`）并清空 ACL 图工作区、作废已录制的图；唤醒阶段再恢复设备侧通信域，并在恢复 KV 阶段重捕获 ACL 图。**在 `v0.30.0` 与 `main` 中，旧顶层键 `enable_sleep_mode_extra_cleanup` 已迁入 `rl_config`：同卡 RL 需腾空池外显存时应配 `{"rl_config": {"enabled": true, "sleep_mode_extra_cleanup": true}}`，异卡分离或看重快速唤醒的普通服务保持默认 `false`，且切勿在 `v0.30.0` / `main` 中继续传旧顶层键。**

**两代配置入口的迁移（旧键移除 ≠ 清理功能移除）**：该开关全版本均默认 `False`，并在 `v0.27+`（PR #13838 迁移 pydantic）后收归 `rl_config` 一键模式子配置：

| 对比维度 | `v0.23.0` 与 `v0.26.0rc`（含 GLM `db701c1f`） | `v0.30.0` 与 `main` |
| --- | --- | --- |
| 配置键路径与默认 | 顶层 `additional_config["enable_sleep_mode_extra_cleanup"]`，`bool = False` | 嵌套 `additional_config["rl_config"]["sleep_mode_extra_cleanup"]`，`bool = False` |
| 生效守卫 | 仅查本开关为真（`getattr` 守卫） | 必须 **`rl_config.enabled` 与 `rl_config.sleep_mode_extra_cleanup` 同时为真**；漏写 `enabled: true` 等于没开 |
| 字符串 `"false"` 与未知键 | `.get()` 取原值，JSON 写字符串 `"false"` 会反向判真 | pydantic 宽松强转 `"false"` → `False`；旧顶层键通常被 [AscendConfig](../concepts/ascend-config-system.md) 的 `extra="forbid"` 拒收（装 `vllm_omni` 时告警过滤并静默无效） |
| 联动前置项 | 须手工配 `weight_nz_mode: 0`、设 `VLLM_SERVER_DEV_MODE=1` 并移除 `expandable_segments` | `rl_config.enabled: true` 自动强制 `weight_nz_mode=0`（打 warning）、设 `VLLM_SERVER_DEV_MODE=1` 并移除 `PYTORCH_NPU_ALLOC_CONF` 里的 `expandable_segments` |
| 适用部署与前置条件 | 须实际调用 `sleep(level >= 1)`（`level < 1` 在 EngineCore 即返回）；文档未限同卡 | 同左；官方明确限**同卡模式**（异卡训练/rollout 靠 pause/resume + HCCL 权重传输，通常不需 sleep mode） |

**生效范围边界**：只有实际执行 `sleep(level >= 1)` 与 `wake_up()` 的同卡训推交替流程才有额外清理收益；未开启睡眠或异卡分离的在线推理服务（含[启动与生命周期](../concepts/npu-worker-lifecycle.md#怎么开)，官方参数表见 [v0.23.0](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html) 与 [latest](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)）不会进入该路径。

## 事实表

配置同卡 RL 睡眠额外清理或升级旧脚本时，先核对以下入口与唤醒规则：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| `v0.30.0` / `main` 入口 | `additional_config["rl_config"]["sleep_mode_extra_cleanup"]`（`bool = False`） | 必须与 `rl_config.enabled: true` **同时为真**才生效；继续写旧顶层键名会被 `extra="forbid"` 拒收 |
| `v0.23.0` / `v0.26.0rc` 入口 | `additional_config["enable_sleep_mode_extra_cleanup"]`（`bool = False`） | 旧版 `.get()` 不转字符串，写 `"false"` 会反向判真；且需手工设 `weight_nz_mode: 0` |
| 额外释放对象 | HCCL 设备侧业务通信组（保留 `cpu_group`）+ ACL 图 attention workspace | 多卡下 `v0.30.0`/`main` 先建跨休眠 HCCL lifecycle anchor 保活控制面，再拆业务组 |
| 分标签唤醒与重录图 | 仅 `wake_up(tags=None)` 或 `tags` 含 `"kv_cache"` 时重调 `capture_model()` | `tags=["weights"]` 或 `tags=[]` 均跳过录图；切勿在权重未灌入就绪前提前传 `"kv_cache"` |
| 唤醒时延分工 | 唤醒时执行 `restore_hccl()` 恢复已拆通信域；仅 `tags=None` 或含 `"kv_cache"` 的唤醒阶段重捕获 ACL 图 | 唤醒速度优先或异卡训练/推理分离场景应保持关闭 |

## 休眠与唤醒的清理次序及 HCCL 生命周期锚点

休眠时，额外清理发生在 `CaMemAllocator` 释放内存映射**之前**。唤醒时，分配器先按 `tags` 重新映射设备内存并拷回有 CPU 备份的数据（旧 KV 无备份只恢复空间，level 2 权重仍须外部灌入）；随后再执行通信域恢复、刷新 MoE token dispatcher 句柄，并按 `tags` 决定是否重捕获 ACL 图。注意 `CaMemAllocator` 首次构造时会拒绝 `expandable_segments:True`（分配器环境变量的作用与冲突排查见[昇腾运行时与调优](../concepts/ascend-runtime-and-tuning.md)）。

```wiki-diagram
file: enable-sleep-mode-extra-cleanup
```

下面按模块列出休眠与唤醒动作（`v0.23` 与 `v0.26` 的动作基本一致，仅 `v0.26` 按是否带 LoRA 拆成两份图参数字典并用 `acl_graph.iter_graph_params()` 遍历）：

| 清理模块 | `sleep()` 动作 | `wake_up(tags)` 恢复与边界 |
| --- | --- | --- |
| **ACL 图清理**（仅 `use_aclgraph` 为真） | 将主图、草稿图、草稿 prefill 图三套参数中按 token 数保存的 `workspaces` 逐个置 `None`，清空列表字段与各 graph wrapper 的 `concrete_aclgraph_entries`，将 `first_run_finished` 置 `False`，最后清空 `model_runner.cudagraph_manager` 的图并将 `_graphs_captured` 置 `False`（回到从未捕获状态） | 仅 `tags` 为 `None` 或含 `"kv_cache"` 时重调 `capture_model()`；`tags=["weights"]` 与 `tags=[]` 均跳过 |
| **HCCL 业务通信组清理** | 先对未完成的 PP 发送句柄执行 `wait()`、清空发送记录并调用 `torch.npu.synchronize()`，再销毁 device communicator、按引用计数退还共享 HCCL 组、销毁非共享组并将 `device_group` 置 `None`（保留 `cpu_group`） | `restore_hccl()` 就地重建设备组（`create_cpu_group=False`，存活组返回 `False` 防重复创建）并刷新 MoE dispatcher 句柄 |
| **跨休眠周期 HCCL lifecycle anchor**（`v0.30.0` / `main` 新增） | 为防销毁全部设备通信组时拉崩多卡 HCCL 控制面，`HcclSleepWakeupManager` 在多 rank 下先建临时保活组并 `barrier` 完成物理初始化，再清业务组；单 rank、anchor 创建/初始化失败或 MoE 拆卸准备失败时跳过本轮 HCCL 清理（记 `sleep_hccl_policy=skip`） | 先恢复业务组并完成图重捕获，再释放 anchor；分阶段仅醒 `weights` 时继续保留 anchor，直到 `kv_cache` 恢复并重捕获完成后收尾（详见 [sleep mode 版本差异](../concepts/sleep-mode.md#版本差异)） |

## 唤醒代价、常见踩坑、日志定位与启动命令

开启额外清理后，唤醒代价分两步：`restore_hccl()` 会在首次唤醒时重建已拆除的 HCCL 设备侧通信域（已恢复的存活组不会重复创建），而 `capture_model()` **仅在 `tags` 为 `None` 或含 `"kv_cache"` 时才重捕获 ACL 图**。官方因此建议唤醒时延优先时保持关闭，实战中还需留意五类常见坑：

- **新版必须同时写两个键**：`v0.30.0` 与 `main` 上 `rl_config.enabled` 与 `rl_config.sleep_mode_extra_cleanup` 是与关系，漏写 `enabled: true` 不会调用清理管理器。若继续在 `v0.30.0` / `main` 里保留旧顶层键，常规环境会被 `extra="forbid"` 直接拒收；装有 `vllm_omni` 时则会告警过滤并静默失效。
- **分标签唤醒与空列表语义**：`wake_up(tags=["weights"])` 与 `tags=[]`（空列表不等同于 `None`）都会跳过图捕获。按 `weights` → 灌入新权重 → `kv_cache` 两段式唤醒时，ACL 图只在第二步捕获；但若重复传 `None` 或含 `"kv_cache"`，管理器会再次执行 `capture_model()`，切勿在权重灌入完成前提前传 `"kv_cache"`。
- **eager 模式与异常传播**：未开启 ACL 图时会跳过图清理与重捕获，是否拆除 HCCL 取决于分布式初始化状态及新版 anchor / MoE 拆卸准备结果。旧版（`v0.23` / `v0.26` / 早期 `baa023ad`）没有外层异常兜底，中途报错直接抛给调用方；新版则在 anchor 初始化或 MoE 拆卸准备失败时记日志并跳过本轮 HCCL 清理。
- **旧版字符串坑与 DeepSeek-V4 风险提示**：`v0.23` 与 `v0.26` 切勿传字符串 `"false"`（会反向判真）。此外，`v0.26` 发布说明记录了 DeepSeek-V4 开启额外清理后唤醒无法恢复的已知缺陷（#15648），对应版本应避免在该模型上开启。
- **日志观测口径**：日志里的 GiB 是整张卡清理前后空闲显存的差值（受同期其他进程分配影响，并非单个通信组精确归因）：
  - `Sleep mode released HCCL and attention workspace memory: %.3f GiB.`（清理结束时记录整卡空闲显存变化）
  - `Destroyed %d HCCL process groups for sleep mode.`（正常完成且至少拆掉一个组时打印；缺行不直接等于零释放）
  - `Restored %d HCCL process groups after sleep mode.`（唤醒时打印，即使恢复数为 0 也会打）

**启动命令示例**（`v0.30.0` 与 `main` 同卡 RL 写法，以主基线标准模型 `Qwen/Qwen3-8B` 为例，本工作区未实机运行，照搬前须核对模型与单卡显存容量）：

```bash
VLLM_WORKER_MULTIPROC_METHOD=spawn \
vllm serve Qwen/Qwen3-8B \
    --enable-sleep-mode \
    --additional-config '{"rl_config": {"enabled": true, "sleep_mode_extra_cleanup": true}}'
```

若停留在 `v0.23.0` 或 `v0.26.0rc`，须手动传 `--additional-config '{"enable_sleep_mode_extra_cleanup": true, "weight_nz_mode": 0}'`（非零 NZ 会在 `wake_up` 入口被拒绝），同时显式设置 `VLLM_SERVER_DEV_MODE=1` 并从 `PYTORCH_NPU_ALLOC_CONF` 清除 `expandable_segments`（完整流程与分配器约束见 [sleep mode](../concepts/sleep-mode.md#怎么开) 与[昇腾运行时与调优](../concepts/ascend-runtime-and-tuning.md)）。

## 对照源码

下表汇总 `enable_sleep_mode_extra_cleanup` 与 `rl_config.sleep_mode_extra_cleanup` 在四个基线版本的入口与 HCCL anchor 演化，其后列出核心源码锚点：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 配置入口与默认 | 顶层 `enable_sleep_mode_extra_cleanup = False` [C1] | 同左 [C24] | `rl_config.sleep_mode_extra_cleanup = False`（须同开 `rl_config.enabled`）[C53][C54] | 同 `v0.30.0` [C57][C58] | 旧键移除不等于清理功能移除；升级须迁到 `rl_config` [!] |
| 布尔强转与未知键 | `.get()` 取原值（`"false"` 为真） | 同左；发布说明记 DeepSeek-V4 #15648 [S26] | pydantic 强转；旧顶层键拒收（Omni 告警过滤） | 同 `v0.30.0` | 新版避免字符串反转坑，并自动处理 NZ / dev mode / `expandable_segments` [S17] |
| HCCL 清理与恢复机制 | 直接销毁/重建设备组（无 anchor） | 同左（ACL 图按双 dict `iter_graph_params()` 遍历） | 新增跨休眠周期 HCCL lifecycle anchor；单 rank 或初始化失败跳过 [C55][C56] | 同 `v0.30.0` [C59] | 分阶段唤醒 `weights` 时保留 anchor 至 `kv_cache` 恢复并重捕获完成 [D] |

- **两代配置与 Worker 守卫**：`v0.23` / `db701c1f` / `v0.26` 见 `ascend_config.py` 与 `worker.py`（来源 1–3、18、24–25、32、34、48、52）；`v0.30.0` 与 `main` 见 `c09d3e20:ascend_config.py#L363-L394, worker.py#L259-L301`（来源 53–54）与 `8d6180e2:ascend_config.py#L379-L410, worker.py#L324-L373`（来源 57–58）；历史 `baa023ad`/`7d825229` 及单测见来源 9–12、16、19、23、38、40–43。
- **清理管理器、分配器与官方文档**：`sleep_mem_optimized.py` 见 `2c59ff10`（来源 4–6）、`2ed6cbba`（来源 28–29）、`baa023ad`（来源 20–22）、`7d825229`（来源 44–46）、`c09d3e20`（来源 55–56）与 `8d6180e2`（来源 59）；`patch_distributed.py`、`camem.py`、`platform.py` 与 `vllm@0fc695fc`（EngineCore `level < 1` 早退与 dev mode 接口）见来源 27、31、35–36、47、49；官方文档与 PR 见来源 7–8、13–15、17、26、30、33、39、50–51 [S8][S13][S15][S33]。
- **历史 PR 显存报告与归因边界**：公开 [PR #9585](https://github.com/vllm-project/vllm-ascend/pull/9585) 曾记录开启 EP 时睡后占用从约 `3.2 GB` 降至约 `0.7 GB`、未开 EP 时从约 `1.26 GB` 降至约 `0.72 GB`（原单位 GB）[M50]；该记录未给出完整模型与硬件条件且包含 rotary cache 清理，不能将总差值直接归因于本页两项动作或外推到其他部署 [D]。
- **待核**：本仓库无目标 NPU 上开启与关闭额外清理的精确显存释放量、唤醒重捕获耗时对照，以及新版 `expandable_segments` 移除与分配器首次构造顺序的端到端实测验证 [D]。

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
  包含该提交的 tag：v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/jlumbroso/free-disk-space-2.0.0、origin/main、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/releases/v0.33.0rc、origin/revert-20758-feature/glm53-kernel-block-size、origin/revert-21727-codex/dspark-megamoe-cann921、origin/revert-22181-codex/kimi-pcp-dcp-dspark-main、origin/revert-22679-accuracy-lower-bound-only、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/patch/worker/patch_distributed.py` +85 / −49（文本行变化）
  - `vllm_ascend/ascend_config.py` +2 / −0（文本行变化）
  - `vllm_ascend/compilation/acl_graph.py` +2 / −0（文本行变化）
  - `vllm_ascend/device_allocator/sleep_mem_optimized.py` +186 / −0（文本行变化）
  - `vllm_ascend/ops/fused_moe/token_dispatcher.py` +7 / −0（文本行变化）
- **移除**：2026-08-24 · 9cf7a0a23944b032d512040f4da542777042cc3e · PR [#13838](https://github.com/vllm-project/vllm-ascend/pull/13838) —— [Refactor][Config] Migrate AscendConfig to @config pydantic dataclass (#13838)
  包含该提交的 tag：v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/jlumbroso/free-disk-space-2.0.0、origin/main、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/releases/v0.33.0rc、origin/revert-20758-feature/glm53-kernel-block-size、origin/revert-21727-codex/dspark-megamoe-cann921、origin/revert-22181-codex/kimi-pcp-dcp-dspark-main、origin/revert-22679-accuracy-lower-bound-only、origin/rfc/megakernel
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
