---
id: rfork-layout
title: RFork 张量布局：先对齐算子要的形状，再决定搬什么
type: feature
summary: >-
  新实例从老实例读权重前，要先弄清权重此刻是什么样子：开了量化或 NZ 格式，就在读之前先把自己的布局转好；否则先读取，再执行适用的后处理。
  要搬的张量不只在参数表里，同名的必须一致，本机自己的工作区不搬。
aliases:
  - RFork 张量布局
  - RFork processed layout
  - RFork checkpoint layout
  - RFork NZ
  - RFork topk_indices_buffer
  - RFork conflicting tensor entries
  - collect_transferable_tensors
  - processed layout
  - checkpoint layout
  - RFork 排除名单
  - _RUNTIME_ONLY_TENSOR_NAMES
chapters: []
order: 50
sources:
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L729-L746'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L562-L639'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L805-L877'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/tensor_layout.py#L34-L69'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/tensor_layout.py#L205-L259'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/tensor_layout.py#L260-L458'
  - 'vllm-ascend@8d6180e2:tests/ut/model_loader/rfork/test_registration_cache_isolated.py#L63-L85'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L490-L559'
  - >-
    raw:sha256-1e7bc5a59579149471bf29de22fff5348fb9d62ebae4d3fe51971e2abf41bcdd.md#L1-L422
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/tensor_layout.py#L30-L61'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/manifest.py#L164-L214'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/fused_moe/routed_experts.py#L105-L145'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L780-L828'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/local_weights.py#L61-L97'
verified:
  - main
evidence: C
relations:
  - to: rfork
    kind: builds-on
    note: 先从总览区分直读与回退两条路径，再深入量化与 NZ 格式为何把后处理前移到传输之前
  - to: rfork-startup
    kind: builds-on
    note: processed 路径把后处理挪到申请租约前，改变整条启动路径的顺序
  - to: rfork-identity
    kind: builds-on
    note: dtype、量化与 NZ 策略先进入兼容性指纹，再对齐具体张量清单
  - to: tensor-layout
    kind: builds-on
    note: 理解昇腾 ND 与 NZ 分块存储格式及补齐差异，是判断 processed layout 不可省去后处理的前提
  - to: quantization
    kind: builds-on
    note: W8A8 等权重量化在加载后会转置、转 NZ 并生成额外 FP32 缩放副本，直接决定是否走 processed 路径
  - to: device-memory
    kind: builds-on
    note: 派生权重与运行期临时缓冲均驻留在 NPU 设备显存中，按张量底层 storage 与格式校验决定可传边界
contradicts: []
updated: '2026-11-19'
rawSources:
  - >-
    raw/sha256-1e7bc5a59579149471bf29de22fff5348fb9d62ebae4d3fe51971e2abf41bcdd.md
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
- A 加载完以后会做一步**加载后处理**：先把它转置成 4 × 6，再转成 [NZ 分块格式](tensor-layout.md)；固定 W8A8 专家的分组矩阵乘与 SwiGLU 融合路径要求这种排布，不能推广成所有昇腾矩阵乘都只认 NZ。另外还把它的缩放系数另存了一份 FP32 副本，这个张量 checkpoint 里根本没有。
- 后处理直接换掉了原来那份数据，所以 A 显存里只剩处理后的这一版。

B 要是照 checkpoint 开一个 6 × 4 的空位来接，连“字节数相同”都不足以保证读对。先只看转置并连续化、暂不叠加 NZ：载荷仍为 24 字节，顺序已经改变，按原形状解释会把元素放错；那份 FP32 副本，B 上还缺相应位置。

只看转置并连续化就能看出错在哪。checkpoint 按行存，第 2 行第 1 个数排在第 5 个字节；转置成 4 × 6 以后，它落到第 1 行第 2 个位置，变成第 2 个字节。B 按 6 × 4 去读第 2 个字节，以为拿到的是第 1 行第 2 个数，实际拿到的是原来第 2 行第 1 个数。再叠加 NZ，既要核对分块顺序，还要核对补齐和实际存储大小，不能继续按 24 字节估算物理载荷。

所以 RFork 搬的是模型**此刻实际在用**的张量。**量化打包、NZ 格式转换会改张量：有的换形状，有的换底层存储，有的还会多出新张量**；B 必须先具备和 A 一样的布局，不能把 checkpoint 里的原始形状当成永远成立。

## 为什么不能先收下，再自己转

直觉上，B 也可以先按 checkpoint 的样子收下字节，再自己跑一遍后处理。问题是，A 显存里提供的是当前张量，可能早已转置、转换格式或增加了派生张量。接收端必须按这份实际布局解释字节；不能把 A 的最终结果当成原始权重，再无差别地处理一次。

开头的量化例子采用「转好布局再搬」：B 先对还空着的模型跑同样的后处理，造出名字、形状、类型、格式都和 A 一样的空位，再用 A 的真实数据把这些空位覆盖掉。空壳上算出来的派生值也会被一并覆盖，前提是这些派生张量都被列进了要搬的清单，后面专门讲怎么找全。

把两种顺序并排放着看：上一行先做全面的布局准备，再从 A 读；下一行不先跑这一步，核对清单并读取之后，再执行适用的后处理。下一行并不保证 A 的布局没有变过，未量化 MoE 就有下面要讲的例外。

```wiki-diagram
file: rfork-layout
```

代价是搭模型和后处理一步都省不了，B 实际省下哪几步见[总览](rfork.md#w8a8-为什么省不掉后处理)。

另外不用担心两边各走各的路：下一节决定路线的三项配置，都算进了[兼容性指纹](rfork-identity.md)。两边这三项一样，判断结果就一样；不一样，指纹不同，Planner 根本不会把它们配到一起。

## 先看 B 要不要转布局

决定走哪条路的是 B 的启动配置，不是请求里有多少 token。三个条件任一成立，B 就走「转好布局再搬」（processed layout）这条路：

- 模型开了量化；
- 权重 NZ 模式配成 2。在普通权重格式选择函数中，0 关闭可选转换，1（默认）允许符合条件的量化权重转换，2 还允许 BF16 / FP16；硬件强制策略和专家方法里直接调用的转换需要另查，0 不是全局禁用所有 NZ；
- 当前硬件的策略要求权重必须是 NZ 格式。

这里的判断有两个具体边界：量化项只区分是否未设置，不把所有假值都视作未设置；NZ 模式则先排除布尔值，再看转换得到的整数是否为 2。读配置时，需要按这两个条件判断路线。

可以这样理解第二条为什么只认 2：取 1 时要转 NZ 的是量化权重，而开了量化，第一条已经成立；取 2 时，不量化的模型也会被换掉底层格式，所以也得先转好再搬。

都不成立，就走「先读后处理」（代码称 checkpoint layout）：B 不先跑全面的加载后处理，而是在核对清单、读取后执行适用的后处理。这个路径名不保证 seed 上的张量仍是 checkpoint 形状。实际排查时先读两端配置，再看启动日志里有没有「用加载后布局传输」那一行，并核对实际清单。

## 两条路，后处理放的位置不同

先说清两个容易误读的词。**「读」指的是通过传输引擎从 A 的 NPU 把字节读回来**，不是从磁盘读 checkpoint 文件；**checkpoint layout 是接收端执行路径的名字**，不是来源字节保持原始形状的承诺。两条路都靠远端 NPU 读取拿数据。先后顺序见前面的图，逐个阶段对比如下：

| 路径 | 从 A 读之前 | 从 A 读之后 | B 自己成为 seed 之前 |
|---|---|---|---|
| 转好布局再搬 | 搭好模型 → 做完加载后处理 → 等 NPU 同步 | 不再重复一般后处理，直接进入推理模式和发布判断 | 登记的已经是处理后的最终缓冲区 |
| 先读后处理 | 搭好模型后直接申请租约；核对清单时按需要调整视图形状 | 执行后处理，但临时跳过未量化 MoE 的特定一步 | 一律重新刷新内存登记，防后处理换掉了底层存储 |

「转好布局再搬」这条路，是先对还空着的目标模型做布局准备，再用 A 的真实数据覆盖对应缓冲区。NPU 上的格式转换是异步执行的，所以登记、读取之前必须先同步；不同步，转换和远端写入就有同时碰到同一批目标字节的风险。

## MoE 有两道临时处理，不是关掉所有校验

**转好布局再搬**：如果打开了共享专家的多流重叠（`multistream_overlap_shared_expert`，默认关），每个带共享专家的 MoE 层会在量化后处理外面再包一层校验——后处理做完后，拿「共享专家拆成两段算」和「合起来算」的结果比对。读之前对空壳做布局准备时，真实权重还没装进来，做这个比对没有意义，所以临时换回被包装的原函数；离开这一步时不管成功还是抛错都会恢复。没开这个开关就没有这层包装，这一步什么也不换。

**先读后处理**：读完之后做后处理时，只把「未量化的融合 MoE」那一种方法的后处理临时变成空操作；dense 层照常后处理，结束时同样恢复。

拿一个未量化 MoE 张量就能看清原因。即使没有量化、NZ 模式为默认 `1` 且硬件未强制 NZ，来源端的未量化 MoE 后处理也会转置专家权重。取无需补齐的示意张量 `(1, 6, 4)`：A 转置并连续化后变为 `(1, 4, 6)`，仍有 24 个元素。B 的空位最初是 `(1, 6, 4)`；核清单时，在 `numel` 相同且 `view` 可行的前提下将它改成 `(1, 4, 6)`，再读入 A 已转置的字节。此时若再跑一遍相同的 MoE 转置，反而会把布局改回去，所以读取后跳过这一特定方法。若补齐导致 `numel` 不同或无法建立视图，则不能靠这一步接收，仍需失败回退；改视图也不等于转换 ND/NZ 格式。

这两处作用在不同阶段、不同方法范围。调试时要先说清「哪条布局路径、哪一种量化方法」，不能一句「RFork 不做后处理」概括。

## 要搬的张量，不只在参数表里

| 到哪里找 | 先读后处理 | 转好布局再搬 |
|---|---|---|
| 模型参数 | 扫 | 扫 |
| 模型 buffer | 扫 | 扫 |
| 模块上名为 impl 的实现对象（注意力后端等）的公开属性 | 扫其中的张量和容器 | 同样扫 |
| 其他模块公开属性里的张量和容器 | 不做这层大范围扫描 | 扫 |

这里的 impl 不是量化方法，而是模块挂着的算子实现对象，最常见的是注意力层的后端实现。后处理建出的派生权重，源码里见到两种挂法：挂在模块的普通属性上（W8A8 MoE 层那份 FP32 副本），或者挂在 impl 对象上（MLA 拆出的两份权重）。这两种都不在参数表里，只扫参数表会漏掉。扫描时防着循环引用，不扫函数、方法和类本身；带公开属性的可调用自定义对象，在允许扫对象的那条路上仍会被检查。

扫到的张量里，元数据占位张量、空张量和不在 NPU 上的张量都不算。另外登记时还会检查已经真正分配、却不在 NPU 上的参数和 buffer，免得「漏了 CPU 上的状态却说整个模型传完了」。这并不等于检查任意 Python 对象里的一切状态。

**为什么派生状态这么要紧。** 官方文档讲量化时专门点了两个派生权重的名字，它们属于 [MLA](mla.md)（Multi-head Latent Attention，把各头要用的 K、V 先压成一条共用的短向量存起来、用时再展开的注意力）：MLA 的实现对象在加载后从一块投影权重拆出这两份，挂在 impl 上。文档提醒的是：**原始权重之外的派生状态也影响推理结果**。必须先把 B 的算子布局和派生张量建出来（流程见[启动路径](rfork-startup.md)），再把 A 的对应数据读进去，B 才不会留下由「空壳、还没加载的权重」算出来的派生值。当前上游主线（`main@8d6180e2`）靠加载后处理准备布局、再大范围扫描普通属性和 impl 对象来覆盖这些驻留在[设备显存](device-memory.md)里的状态，不是靠写死这两个名字来保证所有模型都完整。

举个例子：有一种稀疏注意力实现，会把一块原始的投影权重拆开、转置成两份算子真正使用的权重，原来那块随即被释放成元素个数为 0 的空张量。只对比 checkpoint 文件或参数个数，就会漏掉真正参与计算的状态。验收应当看最终的张量清单，并和默认加载方式对照输出。

## 同一个名字只能对应一份数据

同一个逻辑名字，有时会从参数表和公开属性各找到一次。如果是同一个对象，或者地址、元素个数、形状、数据类型、步长全都相同，就去重；否则直接报「同名张量冲突」失败，不会悄悄留下大的或小的那个。

反过来，不同名字可以指向同一块存储的不同视图。这些名字都会进清单；后面的内存登记会合并部分范围，但传输是按逻辑名字逐个读的，所以同一段字节会被读回多次。不能只按本地地址给远端读取去重，原因见[传输页](rfork-transfer.md)。

## 本机的工作区不从 A 搬

有一类张量是运行时的临时工作区，比如给 top-k 选择存下标的那块缓冲区。它的容量由**本实例**的批处理上限决定，不是应该从 A 继承的权重。A 和 B 批处理上限不同，这块缓冲区大小就不同，硬搬会出错。

所以当前主线有一张「只属于运行时」的张量名单，两条路共用的采集入口按名字最后一段比对，把名单里的都排除掉。不管它挂在直接属性、buffer 还是 impl 对象下面，都进不了清单。

批处理上限不在兼容性指纹里，所以 A 和 B 可以配得不一样、照样被 Planner 配到一起。随修复一起加的测试就是这个场景：造两个批处理上限分别为 `2048` 和 `4096` 的模型，工作区的行数等于批处理上限，每行 `2048` 个下标，每个下标是 `4` 字节的 `int32`：

| 批处理上限（测试样例） | 工作区字节算式 | 大小 |
|---|---|---|
| `2048` | $2048 \times 2048 \times 4\text{ B}$ | $16\text{ MiB}$ |
| `4096` | $4096 \times 2048 \times 4\text{ B}$ | $32\text{ MiB}$ |

$$\text{差额} = 32\text{ MiB} - 16\text{ MiB} = 16\text{ MiB}$$

两边元素个数不同，不排除的话，核清单时就会因形状对不上而失败。

测试期望排除之后两边的权重清单完全一样，普通权重和打包权重仍然保留。这是测试样例的数，不代表所有模型工作区的实际大小。

**边界：这是一张写明名字的排除名单。** 当前 `main` 主基线的名单包含三项：`topk_indices_buffer`（稀疏注意力 top-k 下标缓冲区）、`_rope_derived_cos_cache` 与 `_rope_derived_sin_cache`（RoPE 派生余弦/正弦缓存）。它不会自动识别其他临时工作区，也没有证明改任何调度参数都兼容。以后新增工作区要重新审视名单，不能照抄成「排除所有 buffer」。

## 放到 GLM 双机：W8A8 走哪条路，哪些张量要留意

先说清前提：这一节的结论全部按源码推出，没有在部署上实测，下面各小节不再逐处重复。我们的部署是一个实例跨两台机器、16 张卡，TP8、DP2、EP16、W8A8（见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。

社区上游 `vllm-ascend@8d6180e2` 已包含 GLM-5.3-Flash 的模型实现（`vllm_ascend/models/glm5next/` 下的 `Glm5NextForCausalLM` / `Glm5NextForConditionalGeneration` 与 `Glm5NextMTP`）及官方部署教程（`docs/source/tutorials/models/GLM5.3-Flash.md`），但尚未给出专用的 GLM-5.3-Flash RFork 配方或验收表（且官方指南提示 `Glm5NextMTP` 暂未纳入自动 checkpoint 归属恢复）。本站的 GLM 双机 W8A8 历史算例钉在固定镜像 `db701c1f`，下面把上游 `main@8d6180e2` 的 RFork 加载器规则和该模型放在一起推演。谁向谁借、每张卡读多少字节见[总览的 GLM 双机一节](rfork.md#放到-glm-双机再起一个同构实例每张卡借多少)，这里不重算。

### 走哪条路：量化这一条就够了

部署开了 W8A8 [量化](quantization.md)，第一个条件直接成立，所以走「转好布局再搬」。NZ 模式命令里没配，取默认的 1，不影响这个判断，但它和硬件策略一样算进指纹，A 和 B 必须一致。

后处理对 GLM 路由专家做的就是开头例子那三件事，见[总览](rfork.md#w8a8-为什么省不掉后处理)。对本页要紧的只有一点：那份 FP32 副本挂在 MoE 层的普通属性上，不是参数也不是 buffer，要靠「其他模块公开属性」那一层扫描才进得了清单。

### MoE 那两道临时处理，这套部署都用不上

- 读之前那一道，只在打开共享专家多流重叠时才有东西可换。教程命令没开这个开关，默认是关，所以这一步遍历一遍、什么也不换。
- 读之后那一道只在「先读后处理」时出现，而且只管未量化的融合 MoE。GLM 走的是另一条路，专家也全是 int8 的。

### top-k 下标缓冲：正是排除名单要防的情况

GLM 的 MLA 层带一个[稀疏注意力](sparse-attention.md)索引器，它要为这一批里的每个 token 存下选中的历史位置，于是模型初始化时开了一块工作区：行数是这一批最多的 token 数 `8192`，每行 $2048 + 4 - 1 = 2051$ 个下标，`int32`。主干 11 个 MLA 层共用这一块；MTP 层（投机解码里负责先猜后面几个 token 的那一层，见[投机解码](speculative-decoding.md)）自己另开一块，宽度向上取到 128 的倍数，是 `2176`：

| 缓冲归属（每张卡，随最大批 token 数变化） | 字节算式（`int32`，每元素 4 B） | 占用大小 |
|---|---|---|
| 主干 11 层共用一份 | $8192 \times 2051 \times 4\text{ B} = 67{,}207{,}168\text{ B}$ | $\approx 64.09\text{ MiB}$ |
| MTP 草稿一份（宽度对齐 128 倍数） | $8192 \times 2176 \times 4\text{ B}$ | $\approx 68.0\text{ MiB}$ |

$$\text{合计} = 64.09 + 68.0 \approx 132.1\text{ MiB（运行期工作区，不是权重）}$$

这块缓冲作为普通属性挂在每个 MLA 层的索引器上，走「转好布局再搬」时会被扫到，而且每挂一处就是一个不同的逻辑名字。不排除的话，会有两个问题：

- 同一块字节按名字被读回很多次，白白多传；
- 「这一批最多多少 token」不在指纹里。B 如果把它从 8192 改成别的值，元素个数就和 A 对不上，整次借用在核清单时失败。

排除名单按名字最后一段比对，这些挂载点全被拦下，132.1 MiB 不进清单。上部署核对时，看 B 的清单里有没有以这个名字结尾的条目。

## 常见误解

- **「形状一样，布局就一样」**——量化打包、数据类型、底层存储和算子策略也影响字节怎么解释。
- **「转好布局再搬，是收到数据后才转换」**——正好相反：B 先转换并同步，再读入 A 已经处理好的张量。
- **「排除工作区那个修复解决了所有形状不匹配」**——它只解决特定本机工作区被误传的问题；权重本身不匹配仍然应该拒绝。
- **「GLM 是 MoE 量化模型，MoE 那两道临时处理都会起作用」**——一道要开共享专家多流重叠才有东西可换，一道只在先读后处理时出现，这套部署两道都用不上。
- **「扫描里的 impl 就是量化方法」**——impl 是模块挂着的算子实现对象，最常见的是注意力后端；量化方法另外挂着，量化产生的派生张量多半挂在层自己身上。

## 对照源码

### 怎么开

- 走 processed layout 的判断在 `_requires_processed_layout_transfer`：`model_config.quantization is not None`；或 `get_ascend_config().weight_nz_mode == 2`（排除布尔值）；或 `get_current_hardware_profile().weight_layout_policy` 为 `FORCE_NZ`。`AscendConfig` 或硬件策略取不到时按 `False` 处理。[C1]
- `weight_nz_mode` 定义在 `vllm_ascend/ascend_config.py#L718-L765`（默认 1，仅允许 `0/1/2`）。0/1/2 控制普通选择函数里的可选转换，不覆盖所有硬件与专家路径；完整边界见 [ND/NZ](tensor-layout.md)。
- 选中 processed 时在 debug 级别打 `RFork %s model uses post-load tensor layout transfer.` 与 `RFork %s model layout processing took %.2f seconds`；登记与读取后另在 INFO 级别输出有界 `RFork tensor layout summary`（含语义/物理摘要与最多 3 个代表张量）。[C3]
- 读前那道 MoE 处理要有包装可换：只有 `multistream_overlap_shared_expert` 为真（默认 False；与 fused MC2 同开时会被强制关掉）且该层有共享专家时，MoE 层才给 `process_weights_after_loading` 包上校验；processed 路径传输完成后另调 `_refresh_rfork_flatquant_state` 刷新 FlatQuant 宿主标量。[C2]
- processed：构建模型 → `process_weights_after_loading` → `torch.npu.synchronize` → `register_destination`（绑定结构摘要）→ 借租约并读取；checkpoint：构建后直接登记并借租约，读完再做后处理（跳过未量化 MoE 重复转换），成为 seed 前重新刷新内存登记。[C8][C12]

### 会报什么错

- 同名张量 ID 冲突或歧义容器键：`RFork encountered conflicting tensor IDs in one model.` / `RFork found distinct container entries with one tensor ID label: ...`。[C6]
- 非连续/重叠视图：`RFork cannot transfer a tensor with gapped or overlapping storage: ...`（`validate_transferable_tensor_layout`）。[C5]
- 本地与 seed 形状不同时，只在元素个数一致时尝试 `view` 成 seed 形状；元素个数不同打 `Weight shape mismatch for %s: local=%s, seed=%s` 并失败，`view` 失败打 `Failed to reshape RFork tensor ...`。

### 开销和什么时候别开

- 不同逻辑名对应同一 storage 的视图时，传输按逻辑名执行，同一段字节可能被读回多次；分层 BFS 扫描（`_collect_shortest_path_tensors`）对完全相同的张量范围做去重，但不同视图仍作为独立条目传输。[D]
- 测试工作区 16 MiB / 32 MiB 的来历：`2048 × 2048 × 4 B = 16 MiB`，`4096 × 2048 × 4 B = 32 MiB`，仅测试样例字节推导。[D]
- 排除名单 `_RUNTIME_ONLY_TENSOR_NAMES` 包含 `topk_indices_buffer`、`_rope_derived_cos_cache` 与 `_rope_derived_sin_cache` 三项，不会自动识别其他临时缓冲区。[C4][D]
- Engram CPU 卸载表经 `local_weights.py` 在本地加载后，由 `get_local_tensor_ids` 豁免非 NPU 状态检查；未完成加载的宿主张量仍会被拒绝。[C14]
- SFA 会把原 `kv_b_proj` 拆分、转置成 `W_UV`/`W_UK_T`，旧权重随后由 `dispose_layer` 释放；实现与名词解释见[官网核读页](../sources/rfork-official-guide.md)。[I]

### 版本差异

| 维度 | `v0.23.0` (`2c59ff10`) / `v0.26.0rc` (`2ed6cbba`) | `v0.30.0` (`c09d3e20`) | `main` (`8d6180e2`) |
|---|---|---|---|
| processed 判定 | 仅看 `quantization` 非空；无 NPU 同步与 MoE 临时处理 | 量化 / `weight_nz_mode == 2` / `FORCE_NZ`，含同步与两道 MoE 处理 | 同 `v0.30.0`，新增 FlatQuant 宿主标量刷新 |
| 张量采集与去重 | 写在 `transfer_backend.py` 中，按 `data_ptr` 去重 | 独立 `tensor_layout.py`，收集 ID/shape/dtype/NPU format 生成结构摘要 | 分层 BFS 去重 + 确定性张量 ID、复用登记扫描清单与摘要（PR `#17366`） |
| 运行期排除名单 | 无 | 仅 `topk_indices_buffer` | 扩展为 `topk_indices_buffer`、`_rope_derived_cos_cache`、`_rope_derived_sin_cache` |
| 非 NPU 状态检查 | 无独立检查 | 拒绝所有已物化非 NPU 参数/buffer | 豁免由 `local_weights.py` 完成本地加载的 Engram 宿主表 |

固定镜像 `db701c1f` 与 `v0.23.0` 一致；旧开发快照 `baa023ad` 已补同步与两道 MoE 处理，但仍无 `tensor_layout.py` 与排除名单。完整对照见[总览](rfork.md#版本差异)。

### 源码位置

以下均为社区上游 `vllm-ascend@8d6180e2`，路径前缀 `vllm_ascend/model_loader/rfork/`（另注除外）：

- `rfork_loader.py#L729-L746`：`_requires_processed_layout_transfer`，量化（`is not None`）/ `weight_nz_mode == 2`（排除 bool）/ `FORCE_NZ` 三条件。
- `rfork_loader.py#L562-L639`：`_iter_ascend_moe_quant_methods`、`_rfork_pre_transfer_weight_processing`、`_rfork_skip_unquantized_moe_post_load_processing`、`_refresh_rfork_flatquant_state`。
- `rfork_loader.py#L805-L877`：共享复用、processed 后处理 + `torch.npu.synchronize`、先登记后借与传输后收尾。
- `tensor_layout.py#L34-L69`：`_RUNTIME_ONLY_TENSOR_NAMES`（3 项）、`_is_runtime_only_tensor`、`build_structural_digest`。
- `tensor_layout.py#L205-L259`：`reshape_tensor_to_seed_shape`、`is_transferable_tensor`、`is_non_overlapping_dense_tensor`、`validate_transferable_tensor_layout`。
- `tensor_layout.py#L260-L458`：分层 BFS `_collect_shortest_path_tensors`、`collect_transferable_tensors`、`find_non_npu_state_tensors`。
- `tests/ut/model_loader/rfork/test_registration_cache_isolated.py#L63-L85`：batching limits 2048 / 4096 排除 `topk_indices_buffer` 单测。[C7]
- `session.py#L490-L559`：checkpoint 路径成为 seed 前重新 `register_memory_region` 刷新登记。
- `vllm_ascend/ops/fused_moe/routed_experts.py#L105-L145`：`AscendUnquantizedFusedMoEMethod.process_weights_after_loading`。
- `transfer_backend.py#L780-L828`：接收端 `reshape_tensor_to_seed_shape` 与 `log_tensor_layout_summary`。[C13]
- `local_weights.py#L61-L97`：Engram 宿主表加载、记录、豁免与释放。
- `v0.30.0` 对照：`vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/tensor_layout.py#L30-L61`、`manifest.py#L164-L214`。[C10]
- GLM 推演参照固定镜像 `vllm-ascend@db701c1f`：`vllm_ascend/models/glm5_next.py#L2252-L2259`、`glm5_next_mtp.py#L64-L77`。
