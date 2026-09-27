---
id: rfork-startup
title: RFork 启动：准备模型以后才借 seed，失败后先清理再重建
type: feature
summary: >-
  新实例用 RFork 启动时，先把自己的模型搭好、布局转好，再去借一份来源读权重；借不到或读失败，就把这一轮彻底清理干净，改用普通方式从磁盘重新加载。这页按真实顺序走一遍，也讲清两种提前返回和两种「没有可用来源」。
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
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L69-L109'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork
    kind: builds-on
    note: 总览先分清 Planner、元数据 HTTP 与字节传输，这里按真实调用顺序串起来
contradicts: []
updated: '2026-09-26'
rawSources:
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-629e6f8b0215485342250f376eedf494ef1b55f5de26f189da5f5a615659eba1.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## B 要向 A 借权重，为什么不一上来就借

沿用[总览](rfork.md)的两个实例：A 已经正常加载、成了别人可以借的 seed；B 正在启动，想把 A 的权重直接读过来。最直觉的做法是 B 一启动就去 Planner 那里申请借用 A——可工作版偏偏把申请往后放，先干完一大堆自己的活才去借。为什么？借不到又怎么办？

答案是这一页的主线：**B 先把本地模型和需要的布局准备好，再去借 seed、登记内存、读数据；借不到或读失败时，先把这一轮安全清理干净，再用普通加载方式重来一遍。**「模型成功加载」和「B 成功把自己发布成 seed」是两件分开判断的事。

本页讲的全部是 RFork 工作版（钉在来源里的那个提交）的行为，社区 v0.23 / v0.26 / main 上没有这条加载路径；版本边界见[总览](rfork.md)。

```wiki-diagram
file: rfork-startup
```

## 借之前，B 得先把自己的模型搭好

B 要读 A 的权重，得先有地方放。它必须先知道自己有哪些层、每个张量分配多大、是什么数据类型和布局，才能告诉远端「读到我这里的这些地址」。RFork 没法只拿一个模型名字，就凭空把远端的模型「挂」进 B。

所以用了 RFork，模型初始化这一步的成本仍然要付。RFork 的目标是缩短本地模型加载的等待，使 B 更早进入后续准备阶段；它不直接优化模型的逐步 decode。整个服务什么时候真正就绪，还取决于 RFork 之后的启动环节，不能拿权重读取那一段的耗时代替。

## 主路径上的十步

| 顺序 | B 做了什么 | 做完手里有什么 |
|---|---|---|
| 1 | 启动参数选了 RFork 加载方式 | 从额外配置里读出的 RFork 配置 |
| 2 | 检查专家负载均衡（EPLB）相关开关 | 命中任一条就直接走普通加载，不建 RFork 会话 |
| 3 | 建立 RFork 会话 | 主模型和 draft 模型各自的会话、身份、Planner 客户端、传输引擎 |
| 4 | 先给全局状态拍个快照，再初始化模型 | 本次尝试的模型对象和张量 |
| 5 | 看 draft 模型是不是整份共用主模型的权重 | 整份共用就直接切到推理模式返回，后面的传输全跳过 |
| 6 | 需要时做布局后处理，并等 NPU 同步完 | B 的张量已经是 A 会对外暴露的那种最终布局 |
| 7 | 向 Planner 申请租约 | 一份分片对得上的租约，或者明确没拿到 |
| 8 | 从 A 读权重 | 本机内存已登记，拿到并核对了远端清单，分批读完 |
| 9 | 按布局路径做完剩下的后处理，切到推理模式 | 可以交回去的模型 |
| 10 | 尝试把 B 自己发布成 seed | 已启动 / 延期 / 失败——和模型能不能交回分开判断 |

归还租约的后台线程，只有第 8 步整段读成功之后才会启动。登记内存、拿清单、读数据任何一步失败，都不走这条路，而是由后面讲的回退清理去安排归还。

## 晚一点申请租约，省的是 A 被占着的时间

如果先借再建模型，租约的有效期会被初始化、量化后处理和 NPU 同步这些活吃掉。工作版把申请放到这些步骤之后，租约覆盖的主要就只剩登记内存、交换清单、读数据和等待归还。

打个比方（假设的数字，不是实测）：初始化 20 秒、布局处理 10 秒、登记加读取 15 秒。晚申请以后，前 30 秒都不占 A 的借用名额。

代价是：没借到 seed 时，B 已经把模型准备过一遍了。工作版不会把这份可能已经转过布局的空模型直接交给普通加载器去填，而是清掉这次尝试，重新走普通加载。所以一次没命中的冷启动，模型准备要付两遍。

## 借不到或读失败：先拆干净，再从磁盘重来

回退不是把模型变量删掉就完事。模型在初始化时，会被好几处全局登记表、缓存和已登记的内存引用着；这些不清掉，旧模型的内存就放不掉。

会话存在时，回退先做三件事：停掉 seed 服务、安排归还租约、注销这次登记的内存。清理最多试两轮。判断「能不能继续回退」时，看的是服务停了没有、内存重置了没有；租约是后台异步归还的，不要求这时已经确认还掉。

除此之外还要清下面这些地方：

| 要清的东西 | 为什么它会留住旧模型 |
|---|---|
| 构建层时登记的前向上下文 | 登记进去的层对象还挂在配置上 |
| 全局的 MoE 层列表 | 列表里还引用着专家层 |
| 昇腾的 MoE 登记表 | 就算没开动态 EPLB，适配层也可能留着层 |
| 旋转位置编码（RoPE）的缓存 | 初始化过程中加进去的缓存条目 |
| 编译器留下的字节码钩子 | 绑定的方法会把编译包装乃至整个解码器一起保活 |
| 传输后端持有的张量和底层存储 | 注销没确认之前，必须保住底层内存 |

前五类由加载器按本次尝试之前拍的快照恢复，并且保留此前已经成功加载的主模型 / draft 状态；最后一类由传输后端自己管。就连模型构造到一半就抛错、模型变量还没赋上值的情况，也要清。

如果停服务或注销内存仍然失败，加载器会直接报错终止，拒绝再分配第二份模型。这是为了防止旧权重还被登记着、又分配出一整份新模型；不是「把错误吞掉继续跑」。**不要为了让回退成功而删掉这个检查。**

## 重来时，只把加载方式改回普通

回退用的加载配置，是从原配置复制出来的一份：加载方式改成自动，RFork 的额外配置清空，然后交给 vLLM 的普通加载入口。这样 RFork 配置不会绕一圈又把普通加载带回 RFork。反过来，模型路径、权重文件这些普通加载要用的东西，必须照样可用。

普通加载自己也失败时，会抛出异常并打一行专门的日志。这时要同时留着两样东西：最初 RFork 为什么失败，以及普通加载具体错在哪——不能只盯着前面那条警告。

普通加载成功后，如果会话还在、清理条件也满足，这个实例仍可以试着把自己发布成 seed。就算发布失败，已经加载好的模型也会原样交回，后面的启动流程照常继续。

## 两种提前返回，不是漏了日志

- **开了 EPLB 就整个绕过 RFork。** 判断条件有三个，任何一个成立都算：并行配置里开了 EPLB、额外配置里开了动态 EPLB、或者额外配置里填了导出专家映射用的记录路径。也就是说，只开了普通 EPLB、或者只是想导出专家映射，RFork 同样不会跑：它在建会话之前就直接走普通加载，之后也不会按 RFork 流程发布 seed。偏偏这时的日志只说「开了动态 EPLB 时关闭 RFork 传输」，照字面读，会以为自己没开「动态」就不受影响。
- **draft 模型整份共用主模型权重。** 所有要传的权重都已经被主模型登记过的内存覆盖，而且没有不支持的非 NPU 状态时，直接复用现有权重、切到推理模式返回；不再申请租约，也不重复做布局后处理。

只共用一部分的 draft 模型会继续走后面的流程：跳过共用的部分，只传它自己独有的张量，细节见[传输与内存](rfork-transfer.md)。

## 「没有可用 seed」有两种来源，日志长得一样

第 7 步拿不到租约时，加载器一律报同一个原因，并按 rank 打出「没有可用的 seed，本地加载并把自己注册成 seed」。可会话申请失败其实有两类原因，日志并不区分：

| 哪一类 | 发生了什么 | 先查什么 |
|---|---|---|
| 已尝试申请，但未取得可用租约 | 自检通过后尝试查询，可能没有匹配来源，也可能发生网络异常、非200响应或响应信息不完整 | 客户端 warning、HTTP状态、连接情况，再查两端的 seed key 与[身份匹配](rfork-identity.md) |
| 会话自己拒绝申请 | 上一份租约的归还线程还活着、归还已停止、或会话状态不对，**这次查询根本没发出去** | 本进程更早的租约归还日志，见[生命周期](rfork-lifecycle.md) |

先结合客户端 warning 与 session 状态判断：是否通过本地自检，查询是否成功，响应是否完整。Planner 的请求记录可以辅助定位；连接失败可能使请求未到达 Planner，因此没有服务端记录不能单独证明会话拒绝了申请。[C11][C12]

## 常见误解

- **「借不到 seed 就等于什么都没做」**——申请发生在初始化和必要的布局处理之后，没借到也已经付过成本。
- **「回退就是在同一份模型上重新读一遍文件」**——工作版会清理并重建，避免转了一半的布局和普通加载器的假设冲突。
- **「看到 seed 启动失败，就得重新加载模型」**——模型已经加载成功时，seed 只是附加服务；要单独看后面推理是否就绪。

## 对照源码

### 怎么开

启动时用 `--load-format rfork` 选中 `RForkModelLoader`，RFork 配置从 extra config 里读成 `RForkConfig`。[C1]

EPLB 绕过的判定函数叫 `_is_dynamic_eplb_enabled`，但三个条件任一为真都返回 true：`parallel_config.enable_eplb`、`additional_config.eplb_config.dynamic_eplb`、`additional_config.eplb_config.expert_map_record_path` 非空。[C9] 所以只加了 `--enable-eplb`，或只设了 `expert_map_record_path`，RFork 同样不跑。

回退配置是原 `LoadConfig` 的浅拷贝，`load_format` 设成 `auto`，清空 RFork extra config，再调 vLLM 的 `get_model`。[C5]

### 会报什么错

| 日志原文 | 对应上半哪一段 |
|---|---|
| `RFork transfer is disabled when dynamic EPLB is enabled` | EPLB 绕过；三个条件任一命中都会打这句 [!] |
| `planner returned no compatible seed`，随后按 rank 打 `RFork has no available main/draft seed; loading locally and registering this worker as a seed.` | 第 7 步没拿到租约，两类来源不区分 [C3][C11] |
| `RFork fallback aborted ... Refusing to allocate a second model while old weights are pinned.` | 停服务或注销 MR 仍失败，拒绝分配第二份模型 [C4] |
| `RFork fallback default loader failed.` | 默认加载器自己失败；要同时保留原 RFork 原因 |

`session.acquire_seed()` 返回 False 可能发生在本地自检，也可能发生在调用 Planner 客户端之后。客户端对连接异常、非200状态及缺少必要响应字段均返回空结果；404只是其中一种情况。[C12] 自检拒绝则包括上一份租约的释放线程仍活着、释放已停止或会话状态不是 `INITIALIZED`。[C11] 应据客户端异常、状态与服务端记录共同定位，不能把统一的 fallback 日志当成“没有匹配来源”的证明。

回退清理：session 存在时先调 `prepare_for_fallback`，包含停止 seed 服务、安排释放 source lease、注销本次注册的 MR；加载器最多尝试两轮；`can_schedule_seed` 实际检查的是服务停止与内存重置，不要求异步 lease 已确认释放。[C7][C8]

租约的后台释放线程只在 `transfer_from_seed` 整段成功后才启动；注册、元数据、读取任一步失败都改由回退清理安排释放。[C10]

本地加载成功后仍可尝试 `start_seed_service`；seed 启动失败时辅助函数保留已加载的模型，交回调用者。[C6]

### 开销和什么时候别开

晚申请：`acquire_seed` 排在 `initialize_model` 和 processed-layout 后处理、NPU 同步之后。 因此租约覆盖的主要是注册、元数据交换、读取和释放等待。[I]

上半「20 秒 + 10 秒 + 15 秒」是解释时序的假设，不是实测启动数据。[A]

未命中时，已初始化（可能已转过布局）的模型不会交给 checkpoint loader 填，而是清掉重建；所以一次没命中的冷启动，模型准备开销要付两遍。[D]

会开 EPLB 的部署（包括只想导出专家映射的），RFork 不会生效，见「怎么开」。

### 版本差异

本页只描述 RFork 工作版（来源里钉的 `3284850b`）。会话、晚申请租约、回退清理这条路径在社区 v0.23 / v0.26 / main 上都没有对应代码；社区各版本拿到了哪些补丁，见[总览](rfork.md)的「版本差异」。

### 源码位置

| 上半的哪一步 | 代码 |
|---|---|
| 1 选中加载器 | `RForkModelLoader`，读 `RForkConfig` |
| 2 EPLB 绕过 | `_is_dynamic_eplb_enabled` |
| 3 建会话 | `_ensure_rfork_session`：main/draft session、身份、Planner client、TransferEngine |
| 4–7 快照、初始化、draft 全共享判断、布局后处理、申请租约 | `load_model` 前半段，`initialize_model` → `acquire_seed` |
| 8–10 读权重、后处理与 `model.eval()`、发布 seed | `load_model` 后半段，`transfer_from_seed`、`start_seed_service`（STARTED / DEFERRED / FAILED） |
| 回退清理与重建 | 回退辅助函数；`prepare_for_fallback`；`can_schedule_seed` 的判定 |
| 回退后发布 seed | seed 发布辅助函数 |
| 租约申请与释放线程 | `session.acquire_seed`、传输与释放 |

回退清理恢复的五类全局引用在代码里的名字：`static_forward_context`、`static_all_moe_layers`、Ascend MoE registry、RoPE cache、Dynamo bytecode hooks；第六类是 TransferEngine 持有的 Tensor / storage owners，由传输后端管理。

draft 全量共享时复用现有权重直接 `eval`，不重新 `acquire_seed`、不重复布局后处理；部分共享的细节见[传输与内存](rfork-transfer.md)。
