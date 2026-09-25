---
id: rfork-layout
title: RFork 张量布局：先对齐算子要的形状，再决定搬什么
type: feature
summary: >-
  新实例从老实例读权重前，要先弄清权重此刻是什么样子：开了量化或 NZ 格式，就在读之前先把自己的布局转好；否则按原形状读完再处理。
  要搬的张量不只在参数表里，同名的必须一致，本机自己的工作区不搬。
aliases:
  - RFork 张量布局
  - RFork processed layout
  - RFork checkpoint layout
  - RFork NZ
  - RFork topk_indices_buffer
  - RFork conflicting tensor entries
  - collect_transferable_tensors
chapters: []
order: 50
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L503-L519'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L335-L411'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L584-L644'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L18-L55'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L58-L152'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L155-L208'
  - >-
    rfork@3284850b:tests/ut/model_loader/rfork/test_tensor_safety_isolated.py#L143-L170
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L317-L345'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork-startup
    kind: builds-on
    note: processed 路径把后处理挪到申请租约前，改变整条启动路径的顺序
  - to: rfork-identity
    kind: builds-on
    note: dtype、量化与 NZ 策略先进入兼容性指纹，再对齐具体张量清单
contradicts: []
updated: '2026-09-25'
rawSources:
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-5f3e3227968d32d9fcc21a566c964c88b54df66a96481747265dad39632dbe25.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
  - >-
    raw/sha256-ced334d86bb2fbc3284d127854ea3710bee45de12d95cdd91aeb6efb5e08e13f.md
---

## B 从 A 读来的权重，形状能直接用吗

[实例 B](rfork.md) 启动时不读磁盘，而是从已经跑着的实例 A 的 NPU 上直接读权重。问题是：A 显存里的权重，还是 checkpoint 文件里那个形状吗？

不一定。RFork 搬的是模型**此刻实际在用**的 NPU 张量。**量化打包、NZ 格式转换都可能换掉张量的形状、底层存储，甚至换掉有哪些张量**，所以 B 必须先具备和 A 一样的布局，不能把 checkpoint 里的原始形状当成永远成立。

## 先看 B 要不要转布局

决定走哪条路的是 B 的启动配置，不是请求里有多少 token。三个条件任一成立，B 就走「转好布局再搬」（processed layout）这条路：

- 模型开了量化；
- 权重 NZ 模式配成强制转换（配置值 2）；
- 当前硬件的策略要求权重必须是 NZ 格式。

都不成立，就走「按原形状搬」（checkpoint layout）。实际排查时不要凭印象推定，先读两端配置，再看启动日志里有没有「用加载后布局传输」那一行，再确定下面哪条路适用。

## 两条路，后处理放的位置不同

先说清两个容易误读的词。**「读」指的是通过传输引擎从 A 的 NPU 把字节读回来**，不是从磁盘读 checkpoint 文件；**「按原形状」说的是「张量此刻还保持 checkpoint 里的形状」**，不是「收到的是磁盘文件」。两条路都靠远端 NPU 读取拿数据。

```wiki-diagram
file: rfork-layout
```

| 路径 | 从 A 读之前 | 从 A 读之后 | B 自己成为 seed 之前 |
|---|---|---|---|
| 转好布局再搬 | 搭好模型 → 做完加载后处理 → 等 NPU 同步 | 不再重复一般后处理，直接进入推理模式和发布判断 | 登记的已经是处理后的最终缓冲区 |
| 按原形状搬 | 搭好模型后直接申请租约 | 执行后处理，但临时跳过未量化 MoE 的特定一步 | 重新刷新内存登记，因为后处理可能换掉底层存储 |

「转好布局再搬」这条路，是先对还空着的目标模型做布局准备，再用 A 的真实数据覆盖对应缓冲区。NPU 上的转换可能是异步的，所以登记、读取之前必须先同步；否则转换和远端写入可能同时碰到同一批目标字节。

## MoE 有两道临时处理，不是关掉所有校验

**转好布局再搬**：读之前做布局准备时，某些 MoE 量化方法的后处理外面包着一层「共享专家」校验。这时真实权重还没装进来，校验必然出错，所以临时换回被包装的原函数；离开这一步时，不管成功还是出异常，都换回来。

**按原形状搬**：读完之后做后处理时，只把「未量化的融合 MoE」那一种方法的后处理临时变成什么都不做；dense 层照常后处理，结束时同样恢复。

这两处作用在不同阶段、不同方法范围。调试时要先说清「哪条布局路径、哪一种量化方法」，不能一句「RFork 不做后处理」概括。

## 要搬的张量，不只在参数表里

| 到哪里找 | 按原形状搬 | 转好布局再搬 |
|---|---|---|
| 模型参数 | 扫 | 扫 |
| 模型 buffer | 扫 | 扫 |
| 量化实现对象里的公开属性 | 扫其中的张量和容器 | 同样扫 |
| 其他模块公开属性里的张量和容器 | 不做这层大范围扫描 | 扫 |

转好布局后的模型，可能把派生权重挂在普通属性上，或者藏进量化实现对象里；只扫参数表会漏掉。扫描时防着循环引用，不扫函数、方法和类本身；带公开属性的可调用自定义对象，在允许扫对象的那条路上仍会被检查。

扫到的张量里，元数据占位张量、空张量和不在 NPU 上的张量都不算。另外登记时还会检查已经真正分配、却不在 NPU 上的参数和 buffer，免得「漏了 CPU 上的状态却说整个模型传完了」。这并不等于检查任意 Python 对象里的一切状态。

**为什么派生状态这么要紧。** 官方文档讲量化时专门点了两个派生权重的名字，提醒的是：**原始权重之外的派生状态也影响推理结果**。必须先把 B 的算子布局和派生张量建出来，再把 A 的对应数据读进去，B 才不会留下由「空壳、还没加载的权重」算出来的派生值。工作版靠加载后处理准备布局、再大范围扫描普通属性和量化实现对象来覆盖这些状态，不是靠写死这两个名字来保证所有模型都完整。

举个例子：有一种稀疏注意力实现，会把一块原始的投影权重拆开、转置成两份算子真正使用的权重，原来那块可能已被释放成空。只对比 checkpoint 文件或参数个数，就会漏掉真正参与计算的状态。验收应当看最终的张量清单，并和默认加载方式对照输出。

## 同一个名字只能对应一份数据

同一个逻辑名字，可能从参数表和公开属性各找到一次。如果是同一个对象，或者地址、元素个数、形状、数据类型、步长全都相同，就去重；否则直接报「同名张量冲突」失败，不会悄悄留下大的或小的那个。

反过来，不同名字可以指向同一块存储的不同视图。这些名字可能都得进清单；后面的内存登记会合并部分范围，但传输是按逻辑名字逐个读的，所以同一段字节可能被读回多次。不能只按本地地址给远端读取去重，原因见[传输页](rfork-transfer.md)。

## 本机的工作区不从 A 搬

有一类张量是运行时的临时工作区，比如给 top-k 选择存下标的那块缓冲区。它的容量由**本实例**的批处理上限决定，不是应该从 A 继承的权重。A 和 B 批处理上限不同，这块缓冲区大小就不同，硬搬会出错。

所以工作版有一张「只属于运行时」的张量名单，两条路共用的采集入口按名字最后一段比对，把名单里的都排除掉。不管它挂在直接属性、buffer 还是量化实现对象下面，都进不了清单。

随修复一起加的测试是这样验证的：造两个批处理上限分别为 2048 和 4096 的模型，这块工作区分别是 2048 × 2048 和 4096 × 2048 个 int32，也就是 16 MiB 和 32 MiB，差 16 MiB。期望排除之后两边的权重清单完全一样，普通权重和打包权重仍然保留。这是测试样例的数，不代表所有模型工作区的实际大小。

**边界：这是一张写明名字的排除名单。** 名单里现在只有这一个名字，它不会自动识别其他临时工作区，也没有证明改任何调度参数都兼容。以后新增工作区要重新审视名单，不能照抄成「排除所有 buffer」。

## 常见误解

- **「形状一样，布局就一样」**——量化打包、数据类型、底层存储和算子策略也影响字节怎么解释。
- **「转好布局再搬，是收到数据后才转换」**——正好相反：B 先转换并同步，再读入 A 已经处理好的张量。
- **「排除工作区那个修复解决了所有形状不匹配」**——它只解决特定本机工作区被误传的问题；权重本身不匹配仍然应该拒绝。

## 对照源码

### 怎么开

- 走 processed layout 的判断在 `_requires_processed_layout_transfer`：`model_config.quantization` 非空；或 `get_ascend_config().weight_nz_mode == 2`；或 `get_current_hardware_profile().weight_layout_policy` 为 `FORCE_NZ`。AscendConfig 在早期或纯 CPU 检查时取不到会被忽略，硬件策略取不到时返回 False。[C1]
- 选中 processed 时打印 `RFork %s model uses post-load tensor layout transfer.`。[C3]
- processed：构建模型 → `process_weights_after_loading` → `torch.npu.synchronize`，之后再申请租约和读取；checkpoint：构建后直接申请租约，读完再做后处理。
- checkpoint 路径成为 seed 前，启动 seed 服务的入口会重新 `register_memory_region`，因为后处理可能替换 storage。[C8]

### 会报什么错

- 同名张量来源不一致：`RFork encountered conflicting tensor entries for logical name ...`，比较对象身份以及地址、numel、shape、dtype、stride。[C5]
- 本地与 seed 形状不同时，只在元素个数一致时尝试 `view` 成 seed 形状；元素个数不同打 `Weight shape mismatch for %s: local=%s, seed=%s` 并失败，view 失败打 `Failed to reshape RFork tensor ...`。[C4]

### 开销和什么时候别开

- 不同逻辑名对应同一 storage 的视图时，传输按逻辑名执行，同一段字节可能被读回多次。[D]
- 测试工作区 16 MiB / 32 MiB 的来历：`2048 × 2048 × 4 B = 16 MiB`，`4096 × 2048 × 4 B = 32 MiB`。只是测试样例的字节推导。[D]
- 排除名单 `_RUNTIME_ONLY_TENSOR_NAMES` 目前只有 `topk_indices_buffer` 一项，不能据此推断其他 scratch 或任意 scheduler 参数改动都兼容。[D]
- 官方文档点名的 `W_UV` / `W_UK_T` 原文出处见[官方核读页](../sources/rfork-official-guide.md)，本页只引工作版源码；工作版不硬编码这两个名字。[C6]
- SFA 会把原 `kv_b_proj` 拆分、转置成两份算子实际使用的权重，旧 Parameter 可能被释放为空；实现与名词解释见[官方核读中的源码对照](../sources/rfork-official-guide.md)。官网模型表里的测试不能自动算到本工作版上。[I]

### 源码位置

以下均为工作版 `rfork@3284850b`，路径前缀 `vllm_ascend/model_loader/rfork/`（测试除外）：

- `rfork_loader.py#L503-L519`：`_requires_processed_layout_transfer`，量化 / `weight_nz_mode == 2` / `FORCE_NZ` 三个条件。
- `rfork_loader.py#L335-L411`：`_rfork_pre_transfer_weight_processing`（L354 起，把特定 MoE quant method 的包装后处理临时换成 `__wrapped__`，跳过 shared-expert 包装校验）与 `_rfork_skip_unquantized_moe_post_load_processing`（L386 起，只把 `AscendUnquantizedFusedMoEMethod` 的后处理置为 no-op）；两者都在退出时恢复原方法。
- `rfork_loader.py#L584-L644`：两条路径的分叉与先后顺序，processed 路径的 `process_weights_after_loading` 与 `torch.npu.synchronize`。
- `tensor_layout.py#L18-L55`：`_RUNTIME_ONLY_TENSOR_NAMES = frozenset({"topk_indices_buffer"})`，`_is_runtime_only_tensor` 按 `rsplit(".", 1)[-1]` 比对；`reshape_tensor_to_seed_shape`；`is_transferable_tensor` 排除 meta、空张量和非 NPU 张量。
- `tensor_layout.py#L58-L152`：对象扫描与 `_try_collect`（L118 起），循环引用防护、不扫函数 / 方法 / 类，排除运行时张量，同名冲突检查。
- `tensor_layout.py#L155-L208`：`collect_processed_layout_tensors`（扫 Parameters、buffers、Module 公开属性与 `impl`）、`collect_checkpoint_layout_tensors`（Parameters、buffers 与 `impl`）、统一入口 `collect_transferable_tensors`；注册入口检查已物化的非 NPU Parameters / buffers。
- `tests/ut/model_loader/rfork/test_tensor_safety_isolated.py#L143-L170`：batching limits 2048 / 4096，topk 张量 `(2048, 2048)` / `(4096, 2048)`、int32，排除后两份清单相同，普通 weight 与 packed weight 保留。
- `session.py#L317-L345`：启动 seed 服务时重新调用 `register_memory_region` 刷新登记。
