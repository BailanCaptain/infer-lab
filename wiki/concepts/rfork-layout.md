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
updated: '2026-10-02'
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

[实例 B](rfork.md) 启动时不读磁盘，而是按地址把已经在跑的实例 A 显存里的权重字节读过来。这里说的**张量布局**，指一块权重在显存里的形状、数据类型、存储格式，以及模型为它额外建出来的派生张量。按地址逐字节对拷，只有两边布局完全一样才成立。

问题是：A 显存里的权重，往往已经不是 checkpoint 文件里那个样子了。看一个示意的例子：

- checkpoint 里有一块专家权重，6 行 × 4 列，int8，共 24 个数、24 个字节。
- A 加载完以后会做一步**加载后处理**：先把它转置成 4 × 6，再转成 NZ 格式（把矩阵切成小块、按块连续存放的设备内部排布，昇腾的融合矩阵乘只认它，见[算子与内核](ops-and-kernels.md)）；另外还把它的缩放系数另存了一份 FP32 副本，这个张量 checkpoint 里根本没有。
- 后处理直接换掉了原来那份数据，所以 A 显存里只剩处理后的这一版。

B 要是照 checkpoint 开一个 6 × 4 的空位来接，24 个字节一个不少都能收到，可它们的先后顺序已经是转置、分块之后的，按 6 × 4 去解释就全错了；那份 FP32 副本，B 上连放的地方都没有。

只看转置这一步就能看出错在哪。checkpoint 按行存，第 2 行第 1 个数排在第 5 个字节；转置成 4 × 6 以后，它落到第 1 行第 2 个位置，变成第 2 个字节。B 按 6 × 4 去读第 2 个字节，以为拿到的是第 1 行第 2 个数，实际拿到的是原来第 2 行第 1 个数。再叠上 NZ 分块，顺序还要再打乱一次。

所以 RFork 搬的是模型**此刻实际在用**的张量。**量化打包、NZ 格式转换会改张量：有的换形状，有的换底层存储，有的还会多出新张量**；B 必须先具备和 A 一样的布局，不能把 checkpoint 里的原始形状当成永远成立。

## 为什么不能先收下，再自己转

直觉上，B 也可以先按 checkpoint 的样子收下字节，再自己跑一遍后处理。A 的后处理没动过布局时，确实可以这样做，后面的「按原形状搬」就是这条路。可一旦 A 的后处理像开头例子那样改过布局，就行不通了，原因在 A 那边：A 显存里已经没有 checkpoint 版的字节可给，只有处理后的那一版。

这时 B 只能反过来做：先对还空着的模型跑同样的后处理，造出名字、形状、类型、格式都和 A 一样的空位，再用 A 的真实数据把这些空位覆盖掉。空壳上算出来的派生值也会被一并覆盖，前提是这些派生张量都被列进了要搬的清单，后面专门讲怎么找全。

把两种顺序并排放着看：上一行是这种先转布局、再从 A 读的做法；下一行是 A 没动过布局时，先读、再后处理的做法。

```wiki-diagram
file: rfork-layout
```

代价是搭模型和后处理一步都省不了，B 实际省下哪几步见[总览](rfork.md#w8a8-为什么省不掉后处理)。

另外不用担心两边各走各的路：下一节决定路线的三项配置，都算进了[兼容性指纹](rfork-identity.md)。两边这三项一样，判断结果就一样；不一样，指纹不同，Planner 根本不会把它们配到一起。

## 先看 B 要不要转布局

决定走哪条路的是 B 的启动配置，不是请求里有多少 token。三个条件任一成立，B 就走「转好布局再搬」（processed layout）这条路：

- 模型开了量化；
- 权重 NZ 模式配成 2。这个配置取 0 表示一律不转 NZ，取 1（默认）时量化权重转、BF16 / FP16 权重不转，取 2 连 BF16 / FP16 权重也转；
- 当前硬件的策略要求权重必须是 NZ 格式。

可以这样理解第二条为什么只认 2：取 1 时要转 NZ 的是量化权重，而开了量化，第一条已经成立；取 2 时，不量化的模型也会被换掉底层格式，所以也得先转好再搬。

都不成立，就走「按原形状搬」（checkpoint layout）：张量此刻还是 checkpoint 里的样子，可以先读再做后处理。实际排查时不要凭印象推定，先读两端配置，再看启动日志里有没有「用加载后布局传输」那一行，再确定下面哪条路适用。

## 两条路，后处理放的位置不同

先说清两个容易误读的词。**「读」指的是通过传输引擎从 A 的 NPU 把字节读回来**，不是从磁盘读 checkpoint 文件；**「按原形状」说的是「张量此刻还保持 checkpoint 里的形状」**，不是「收到的是磁盘文件」。两条路都靠远端 NPU 读取拿数据。先后顺序见前面的图，逐个阶段对比如下：

| 路径 | 从 A 读之前 | 从 A 读之后 | B 自己成为 seed 之前 |
|---|---|---|---|
| 转好布局再搬 | 搭好模型 → 做完加载后处理 → 等 NPU 同步 | 不再重复一般后处理，直接进入推理模式和发布判断 | 登记的已经是处理后的最终缓冲区 |
| 按原形状搬 | 搭好模型后直接申请租约 | 执行后处理，但临时跳过未量化 MoE 的特定一步 | 一律重新刷新内存登记，防后处理换掉了底层存储 |

「转好布局再搬」这条路，是先对还空着的目标模型做布局准备，再用 A 的真实数据覆盖对应缓冲区。NPU 上的格式转换是异步执行的，所以登记、读取之前必须先同步；不同步，转换和远端写入就有同时碰到同一批目标字节的风险。

## MoE 有两道临时处理，不是关掉所有校验

**转好布局再搬**：如果打开了共享专家的多流重叠（multistream overlap shared expert，默认关），每个带共享专家的 MoE 层会给自己量化方法的后处理外面再包一层校验：后处理做完，拿「共享专家拆成两段算」和「合起来算」的结果对比。读之前做布局准备时，真实权重还没装进来，对着空壳做这个对比没有意义，所以临时换回被包装的原函数；离开这一步时，不管成功还是出异常，都换回来。没打开这个开关，就没有这层包装，这一步什么也不换。

**按原形状搬**：读完之后做后处理时，只把「未量化的融合 MoE」那一种方法的后处理临时变成什么都不做；dense 层照常后处理，结束时同样恢复。

这两处作用在不同阶段、不同方法范围。调试时要先说清「哪条布局路径、哪一种量化方法」，不能一句「RFork 不做后处理」概括。

## 要搬的张量，不只在参数表里

| 到哪里找 | 按原形状搬 | 转好布局再搬 |
|---|---|---|
| 模型参数 | 扫 | 扫 |
| 模型 buffer | 扫 | 扫 |
| 模块上名为 impl 的实现对象（注意力后端等）的公开属性 | 扫其中的张量和容器 | 同样扫 |
| 其他模块公开属性里的张量和容器 | 不做这层大范围扫描 | 扫 |

这里的 impl 不是量化方法，而是模块挂着的算子实现对象，最常见的是注意力层的后端实现。后处理建出的派生权重，源码里见到两种挂法：挂在模块的普通属性上（W8A8 MoE 层那份 FP32 副本），或者挂在 impl 对象上（MLA 拆出的两份权重）。这两种都不在参数表里，只扫参数表会漏掉。扫描时防着循环引用，不扫函数、方法和类本身；带公开属性的可调用自定义对象，在允许扫对象的那条路上仍会被检查。

扫到的张量里，元数据占位张量、空张量和不在 NPU 上的张量都不算。另外登记时还会检查已经真正分配、却不在 NPU 上的参数和 buffer，免得「漏了 CPU 上的状态却说整个模型传完了」。这并不等于检查任意 Python 对象里的一切状态。

**为什么派生状态这么要紧。** 官方文档讲量化时专门点了两个派生权重的名字，它们属于 [MLA](mla.md)（Multi-head Latent Attention，把各头要用的 K、V 先压成一条共用的短向量存起来、用时再展开的注意力）：MLA 的实现对象在加载后从一块投影权重拆出这两份，挂在 impl 上。文档提醒的是：**原始权重之外的派生状态也影响推理结果**。必须先把 B 的算子布局和派生张量建出来，再把 A 的对应数据读进去，B 才不会留下由「空壳、还没加载的权重」算出来的派生值。工作版靠加载后处理准备布局、再大范围扫描普通属性和 impl 对象来覆盖这些状态，不是靠写死这两个名字来保证所有模型都完整。

举个例子：有一种稀疏注意力实现，会把一块原始的投影权重拆开、转置成两份算子真正使用的权重，原来那块随即被释放成元素个数为 0 的空张量。只对比 checkpoint 文件或参数个数，就会漏掉真正参与计算的状态。验收应当看最终的张量清单，并和默认加载方式对照输出。

## 同一个名字只能对应一份数据

同一个逻辑名字，有时会从参数表和公开属性各找到一次。如果是同一个对象，或者地址、元素个数、形状、数据类型、步长全都相同，就去重；否则直接报「同名张量冲突」失败，不会悄悄留下大的或小的那个。

反过来，不同名字可以指向同一块存储的不同视图。这些名字都会进清单；后面的内存登记会合并部分范围，但传输是按逻辑名字逐个读的，所以同一段字节会被读回多次。不能只按本地地址给远端读取去重，原因见[传输页](rfork-transfer.md)。

## 本机的工作区不从 A 搬

有一类张量是运行时的临时工作区，比如给 top-k 选择存下标的那块缓冲区。它的容量由**本实例**的批处理上限决定，不是应该从 A 继承的权重。A 和 B 批处理上限不同，这块缓冲区大小就不同，硬搬会出错。

所以工作版有一张「只属于运行时」的张量名单，两条路共用的采集入口按名字最后一段比对，把名单里的都排除掉。不管它挂在直接属性、buffer 还是 impl 对象下面，都进不了清单。

批处理上限不在兼容性指纹里，所以 A 和 B 可以配得不一样、照样被 Planner 配到一起。随修复一起加的测试就是这个场景：造两个批处理上限分别为 2048 和 4096 的模型，工作区的行数等于批处理上限，每行 2048 个下标，每个下标是 4 字节的 int32。

```calc
title: 测试里两份工作区差多少
上限 2048 = 2048 × 2048 × 4 B = 16 MiB
上限 4096 = 4096 × 2048 × 4 B = 32 MiB
相差 = 32 MiB − 16 MiB = 16 MiB
> 元素个数不同，不排除的话，核清单时就会因形状对不上而失败
```

测试期望排除之后两边的权重清单完全一样，普通权重和打包权重仍然保留。这是测试样例的数，不代表所有模型工作区的实际大小。

**边界：这是一张写明名字的排除名单。** 名单里现在只有这一个名字，它不会自动识别其他临时工作区，也没有证明改任何调度参数都兼容。以后新增工作区要重新审视名单，不能照抄成「排除所有 buffer」。

## 放到 GLM 双机：W8A8 走哪条路，哪些张量要留意

先说清前提：这一节的结论全部按源码推出，没有在部署上实测，下面各小节不再逐处重复。我们的部署是一个实例跨两台机器、16 张卡，TP8、DP2、EP16、W8A8（见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。工作版代码树里没有 GLM-5.3-Flash 的模型实现，下面是把工作版的 RFork 加载器和固定镜像 db701c1f 里的 GLM 模型放在一起推出来的；官方 GLM 双机教程也没有开 RFork。谁向谁借、每张卡读多少字节，见[总览的 GLM 双机一节](rfork.md#放到-glm-双机再起一个同构实例每张卡借多少)，这里不重算。

### 走哪条路：量化这一条就够了

部署开了 W8A8 [量化](quantization.md)，第一个条件直接成立，所以走「转好布局再搬」。NZ 模式命令里没配，取默认的 1，不影响这个判断，但它和硬件策略一样算进指纹，A 和 B 必须一致。

后处理对 GLM 路由专家做的就是开头例子那三件事，见[总览](rfork.md#w8a8-为什么省不掉后处理)。对本页要紧的只有一点：那份 FP32 副本挂在 MoE 层的普通属性上，不是参数也不是 buffer，要靠「其他模块公开属性」那一层扫描才进得了清单。

### MoE 那两道临时处理，这套部署都用不上

- 读之前那一道，只在打开共享专家多流重叠时才有东西可换。教程命令没开这个开关，默认是关，所以这一步遍历一遍、什么也不换。
- 读之后那一道只在「按原形状搬」时出现，而且只管未量化的融合 MoE。GLM 走的是另一条路，专家也全是 int8 的。

### top-k 下标缓冲：正是排除名单要防的情况

GLM 的 MLA 层带一个[稀疏注意力](sparse-attention.md)索引器，它要为这一批里的每个 token 存下选中的历史位置，于是模型初始化时开了一块工作区：行数是这一批最多的 token 数 8192，每行 2048 + 4 − 1 = 2051 个下标，int32。主干 11 个 MLA 层共用这一块；MTP 层（投机解码里负责先猜后面几个 token 的那一层，见[投机解码](speculative-decoding.md)）自己另开一块，宽度向上取到 128 的倍数，是 2176。

```calc
title: GLM 每张卡上的 top-k 下标缓冲
主干一份 = 8192 × 2051 × 4 B = 67,207,168 B ≈ 64.09 MiB
MTP 一份 = 8192 × 2176 × 4 B ≈ 68.0 MiB
合计 = 64.09 MiB + 68.0 MiB ≈ 132.1 MiB
> 大小跟着「这一批最多多少 token」走，不是权重
```

这块缓冲作为普通属性挂在每个 MLA 层的索引器上，走「转好布局再搬」时会被扫到，而且每挂一处就是一个不同的逻辑名字。不排除的话，会有两个问题：

- 同一块字节按名字被读回很多次，白白多传；
- 「这一批最多多少 token」不在指纹里。B 如果把它从 8192 改成别的值，元素个数就和 A 对不上，整次借用在核清单时失败。

排除名单按名字最后一段比对，这些挂载点全被拦下，132.1 MiB 不进清单。上部署核对时，看 B 的清单里有没有以这个名字结尾的条目。

## 常见误解

- **「形状一样，布局就一样」**——量化打包、数据类型、底层存储和算子策略也影响字节怎么解释。
- **「转好布局再搬，是收到数据后才转换」**——正好相反：B 先转换并同步，再读入 A 已经处理好的张量。
- **「排除工作区那个修复解决了所有形状不匹配」**——它只解决特定本机工作区被误传的问题；权重本身不匹配仍然应该拒绝。
- **「GLM 是 MoE 量化模型，MoE 那两道临时处理都会起作用」**——一道要开共享专家多流重叠才有东西可换，一道只在按原形状搬时出现，这套部署两道都用不上。
- **「扫描里的 impl 就是量化方法」**——impl 是模块挂着的算子实现对象，最常见的是注意力后端；量化方法另外挂着，量化产生的派生张量多半挂在层自己身上。

## 对照源码

### 怎么开

- 走 processed layout 的判断在 `_requires_processed_layout_transfer`：`model_config.quantization` 非空；或 `get_ascend_config().weight_nz_mode == 2`；或 `get_current_hardware_profile().weight_layout_policy` 为 `FORCE_NZ`。AscendConfig 在早期或纯 CPU 检查时取不到会被忽略，硬件策略取不到时返回 False。[C1]
- `weight_nz_mode` 来自 `--additional-config` 的同名键或环境变量 `VLLM_ASCEND_ENABLE_NZ`：0 不转，1（默认）BF16 / FP16 不转、量化权重转，2 连 BF16 / FP16 也转。
- 选中 processed 时打印 `RFork %s model uses post-load tensor layout transfer.`，之后有一行 `RFork %s model layout processing took %.2f seconds` 记布局准备耗时。[C3]
- 读前那道 MoE 处理要有包装可换：只有 `multistream_overlap_shared_expert` 为真（默认 False；与 fused MC2 同开时会被强制关掉）且该层 `shared_experts is not None` 时，MoE 层才给 `process_weights_after_loading` 包上 `_validate_shared_expert_consistency`。
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
- SFA 会把原 `kv_b_proj` 拆分、转置成两份算子实际使用的权重，旧 Parameter 的张量随即被 `dispose_layer` 置成 0 元素空张量（`vllm_ascend/attention/sfa_v1.py#L724-L725`、`vllm_ascend/utils.py#L656-L657`）；实现与名词解释见[官方核读中的源码对照](../sources/rfork-official-guide.md)。官网模型表里的测试不能自动算到本工作版上。[I]

### 版本差异

本页按 RFork 工作版（`rfork@3284850b`）写。社区各版本的 `rfork_loader.py` 也有 processed / checkpoint 两条路，但细节不同：

- **v0.23（`2c59ff10`）、v0.26（`2ed6cbba`）、带 GLM 代码的 `db701c1f`**：`_requires_processed_layout_transfer` 只看 `quantization` 是否非空，不看 NZ 模式和硬件策略；日志是 `RFork uses post-load tensor layout transfer for quantized model.`；后处理完直接进传输，没有 `torch.npu.synchronize`，也没有两道 MoE 临时处理。
- **main（`baa023ad`）**：判断条件仍只有量化；补上了同步、读前换回 `__wrapped__` 和按原形状路径跳过 `AscendUnquantizedFusedMoEMethod` 后处理这两道 MoE 处理。
- **四个社区版本共同**：张量采集写在 `transfer_backend.py` 里，没有 `tensor_layout.py`；按 `data_ptr` 去重、同一起始地址只留第一个名字，没有同名冲突报错；没有运行时排除名单，`topk_indices_buffer` 会照常进清单。

逐补丁对照见[总览](rfork.md)的「版本差异」。

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
- `vllm_ascend/ops/fused_moe/fused_moe.py#L410-L413`、`#L493-L506`：仅在 `multistream_overlap_shared_expert` 为真且该层有共享专家时，用 `@wraps` 给量化方法的后处理包上共享专家一致性校验。
- `vllm_ascend/ascend_config.py#L153`（重叠开关默认 False）、`#L194-L195`（与 fused MC2 同开时强制关）、`#L262-L269`（`weight_nz_mode` 的取值与来源）；`vllm_ascend/utils.py#L266-L279`（0 / 1 / 2 三档的转换规则）。
- `vllm_ascend/quantization/methods/w8a8_dynamic.py#L353-L366`：W8A8 专家权重转置、转 NZ，新建 `w13_weight_scale_fp32`。

GLM 一节另用固定镜像 `vllm-ascend@db701c1f`：

- `vllm_ascend/models/glm5_next.py#L2252-L2259`：`topk_indices_buffer` 形状为 `(max_num_batched_tokens, index_topk + index_kpool - 1)`、int32；`#L1260`、`#L402`：索引器把它存成普通属性。
- `vllm_ascend/models/glm5_next_mtp.py#L64-L77`：MTP 层另开一份，宽度取到 128 的倍数。
- 社区版对照：`2c59ff10:vllm_ascend/model_loader/rfork/rfork_loader.py#L219-L220`、`#L275-L277`；`baa023ad:…/rfork_loader.py#L175`、`#L202-L206`、`#L330-L331`、`#L390`；`baa023ad:…/transfer_backend.py#L149-L164`（按 `data_ptr` 去重）。
