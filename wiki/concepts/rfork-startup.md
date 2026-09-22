---
id: rfork-startup
title: RFork 启动：准备模型以后才借 seed，失败后先清理再重建
type: feature
summary: >-
  沿 RForkModelLoader.load_model 走一遍 seed 命中、未命中、共享 draft、EPLB
  绕过与失败回退。解释模型初始化、布局处理、租约和发布的先后关系。
aliases:
  - RFork 启动
  - RFork load_model
  - RFork fallback
  - RFork late acquisition
  - RFork has no available
  - RFork fallback aborted
chapters: []
order: 30
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L414-L418'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L441-L519'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L521-L620'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L622-L710'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L174-L333'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L81-L109'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L274-L286'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/types.py#L40-L52'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L373-L382'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L103-L148'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L64-L80'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork
    kind: builds-on
    note: 总览先分清 Planner、元数据 HTTP 与字节传输，这里按真实调用顺序串起来
  - to: rfork-terms
    kind: builds-on
    note: 初始化、processed layout、draft 和 lease 是这条启动路径的几个关键对象
contradicts: []
updated: '2026-09-23'
rawSources:
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-629e6f8b0215485342250f376eedf494ef1b55f5de26f189da5f5a615659eba1.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## 一句话

RFork 工作版的顺序是：**先建本地模型和需要的布局，再借 seed、注册内存、读数据；借不到或读失败时，安全清理后再用默认加载器重建。** 成功加载与成功发布 seed 分开处理。[C3]

本页讲的全部是 RFork 工作版（钉在来源里的那个提交）的行为，社区 v0.23 / v0.26 / main 上没有这条加载路径；版本边界见[总览](rfork.md)。

```wiki-diagram
file: rfork-startup
```

## 那条请求用上 RFork，发生在请求到达之前

沿用[总览](rfork.md)的两个实例：A 先正常加载并成为 seed，B 申请启动。B 必须先知道自己有哪些层、每个张量分配多大、什么 dtype 和布局，才能给远端读取提供目标地址。RFork 不可能只拿一个模型名称就凭空把远端模型“挂”进 B。[D]

这也解释了为什么 RFork 仍有模型初始化成本。对于那条 37 token 请求，加速的收益是“B 更早有机会开始接请求”，不是保证每一步 decode 更快。端到端 ready 还取决于 RFork 之后的启动环节，不能用单段权重读取耗时替代。

## 主路径上每一步究竟做了什么

| 顺序 | 动作 | 成功后拿到了什么 |
|---|---|---|
| 1 | `--load-format rfork` 选择 `RForkModelLoader` | 从 extra config 读出的 RForkConfig [C1] |
| 2 | 检查 EPLB 相关开关 | 命中任一条就直接默认加载，不建 RFork session |
| 3 | `_ensure_rfork_session` | main/draft session、身份、Planner client、TransferEngine [C2] |
| 4 | 保存全局状态快照，`initialize_model` | 本次尝试的模型对象与张量 |
| 5 | 检查 draft 是否全量共享 target 权重 | 若全量共享，直接 eval 返回，后面的传输路径全跳过 |
| 6 | 需要时执行 processed-layout 后处理并同步 NPU | 接收端已具备 seed 会暴露的最终张量布局 |
| 7 | `acquire_seed` | 一次可匹配分片的租约，或明确没有拿到租约 |
| 8 | `transfer_from_seed` | 注册本地 MR、取得远端元数据、验收并分批读取 |
| 9 | 按布局路径完成余下后处理，`model.eval()` | 加载器可返回的模型 |
| 10 | 尝试 `start_seed_service` | STARTED / DEFERRED / FAILED；与返回模型分别判断 |

1–7 的实现见加载器前半段，8–10 见后半段 [C3][C4]。租约的后台释放线程只在第 8 步整段传输成功之后才启动；注册、元数据、读取任一步失败时不走这条路，改由下一节的回退清理去安排释放 [C10]。

## 晚申请租约，是把准备时间从占用时间中拿出去

如果先借 seed 再建模型，租约的有效期会被初始化、量化后处理和 NPU 同步吃掉。工作版把申请点移到这些步骤之后 [C3]，于是租约覆盖的主要是注册、元数据交换、读取和释放的等待 [I]。

例如初始化 20 秒、布局处理 10 秒、注册与读取 15 秒，晚申请使前 30 秒不占用 seed 借用名额；这只是解释时序的假设，不是实测启动数据。[A]

代价是：没有 seed 时，B 已经准备过一遍模型。工作版不会把这份可能经过转换的空模型直接交给 checkpoint loader 填；它清掉本次尝试，再走默认加载 [C4]。所以一次没命中的冷启动，模型准备的开销要付两遍 [D]。

## 回退需要解除资源和全局引用，`del model` 还不够

session 存在时先调用 `prepare_for_fallback`，包含停止 seed 服务、安排释放 source lease、注销本次注册内存。加载器最多尝试两轮清理；`can_schedule_seed` 实际检查的是服务停止与内存重置，不要求异步 lease 已确认释放。[C4][C7][C8]

| 要清的东西 | 为什么会留下模型引用 |
|---|---|
| `static_forward_context` | 构建层时登记的对象仍在配置中 |
| `static_all_moe_layers` | MoE 层的全局列表仍引用专家层 |
| Ascend MoE registry | 即使没开动态 EPLB，adaptor 也可能保留层 |
| RoPE cache | 初始化过程中加入的缓存条目 |
| Dynamo bytecode hooks | 绑定方法把编译包装器乃至 decoder 保活 |
| TransferEngine 的 Tensor / storage owners | 注销未确认前，必须保住底层内存 |

前五类由加载器按本次尝试前的快照恢复，并保留此前已经成功加载的 main/draft 状态；最后一类由传输后端管理。构造函数中途抛错、`model` 还没赋值的情况也需要清理。[C5]

如果服务或 MR 清理仍失败，抛出 `RFork fallback aborted ... Refusing to allocate a second model while old weights are pinned.`。这是防止旧权重还被登记着又分配第二份模型；不是“把错误吞掉继续跑”。不要把这个检查删掉来追求回退成功。[C4]

## 真正调用默认加载器时，还原的是加载方式

回退配置是原 `LoadConfig` 的浅拷贝，`load_format` 设成 `auto`，清空 RFork extra config，再调用 vLLM 的 `get_model` [C5]。因此 RFork 配置不会递归把默认加载又带回 RFork；模型路径、权重文件和常规加载依赖仍必须可用。

默认加载器自己失败会抛出异常并打印 `RFork fallback default loader failed.`。此时要同时保留原 RFork 原因和默认加载的具体错误，不能只盯住前一个 warning。[C4]

如果本地加载成功，已有 session 且清理条件满足，仍可以尝试让这个 Worker 成为 seed。即使 seed 启动失败，辅助函数也保留已经加载好的模型，让调用者继续后面的启动流程。[C6]

## 两个提前返回，不要当成漏日志

- **EPLB 绕过**：判定函数名字叫 `_is_dynamic_eplb_enabled`，但它有三个触发条件，任意一个为真就绕过 RFork——`parallel_config.enable_eplb` 为真、`additional_config.eplb_config.dynamic_eplb` 为真、或者 `additional_config.eplb_config.expert_map_record_path` 非空 [C9]。也就是说只加了 `--enable-eplb`、或者只设了导出专家映射用的 `expert_map_record_path`，RFork 同样不会跑：它先于建立 session 就走默认 loader，也不会再按普通 RFork 流程发布 seed。日志只说 “RFork transfer is disabled when dynamic EPLB is enabled”，照字面读会以为自己没开 dynamic 就不受影响 [!]。
- **draft 全量共享**：所有可传权重都已经被 target 注册块覆盖，且没有不支持的非 NPU 状态时，复用现有权重并直接 eval；不重新申请租约，不重复布局后处理。[C3]

部分共享的 draft 则继续后续流程，跳过共享范围、传独立张量，细节见[内存与共享](rfork-memory.md)。

## “没有可用 seed”有两种来源，日志长得一样

第 7 步拿不到租约时，加载器一律抛 `planner returned no compatible seed`，并按 rank 打出 `RFork has no available main/draft seed; loading locally and registering this worker as a seed.`。但 `session.acquire_seed()` 返回 False 有两类原因，日志不区分 [C11]：

| 哪一类 | 发生了什么 | 先查什么 |
|---|---|---|
| 真的没有匹配来源 | session 通过了自检，向 Planner 发了 `GET /get_seed`，收到 404 或不完整响应 | 两端的 seed key、来源是否上报、[身份匹配](rfork-identity.md) |
| session 自己拒绝申请 | 上一份租约的后台释放线程还活着、释放已停、或会话状态不是 `INITIALIZED`，**根本没有发出这次 HTTP 请求** | 本进程更早的 `RFork lease release` 日志，见[生命周期](rfork-lifecycle.md) |

分辨方法：第一类在 Planner 侧有一次请求记录，第二类没有。先确认 Planner 收没收到请求，再决定是查匹配还是查上一次租约 [I]。

## 常见误解

- **“借不到 seed 就没做任何工作”**——晚申请发生在初始化与必要布局处理之后，未命中仍有成本。
- **“fallback 就在同一份模型上重新读文件”**——本实现会清理并重建，以免半成品布局与默认 loader 假设冲突。
- **“看到 seed 启动失败一定要重载模型”**——模型已成功加载时，seed 是附加服务；要单独检查后续推理就绪结果。
