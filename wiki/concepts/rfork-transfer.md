---
id: rfork-transfer
title: RFork 传输：登记空位、核对清单、分批读字节
type: feature
summary: >-
  借到 seed 后，B 的每个 Worker 先把放权重的空位登记给传输引擎，再用 HTTP 向 seed 要清单、整份逐项核对，
  通过后由 B 按地址分批把字节读进来；任何一步失败都先注销登记、撤掉半成品再回退。也讲登记怎样保住内存，
  以及主模型和草稿模型共享地址时字节怎么分开算。
aliases:
  - RFork manifest
  - RFork shape mismatch
  - RFork dtype mismatch
  - RFork weight transfer completed
  - Failed to transfer weights chunk
  - get_rfork_transfer_engine_info
  - RFork 元数据校验
  - RFork 内存注册
  - RFork storage owner
  - RFork shared draft
  - batch_register_memory_ex
  - RFork registration rollback
  - RFork tensor range
chapters: []
order: 70
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/seed_client.py#L89-L153'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/manifest.py#L50-L111'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/manifest.py#L164-L252'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L633-L730'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L121-L152'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L732-L793'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L28-L47'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L103-L148'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/seed_server.py#L165-L193'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L33-L37'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L40-L118'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L155-L175'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L271-L354'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L356-L461'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L463-L561'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L563-L614'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L492-L501'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L584-L591'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L255-L286'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork-layout
    kind: builds-on
    note: 必须先确定最终可传张量，才能登记它们此刻对应的内存范围
  - to: rfork-identity
    kind: builds-on
    note: key 匹配只负责挑候选来源，选中以后仍必须核验逐张量元数据
contradicts: []
updated: '2026-10-02'
rawSources:
  - >-
    raw/sha256-073796cbe486e20d214f38511765d39c6eeadc44ccf5568f0097b54b2d1dc28e.md
  - >-
    raw/sha256-08e247f5a691a563c2eff1e3b7b7835da4aa7a60b5f12a5627edb5077776702d.md
  - >-
    raw/sha256-1ae36dd2945d6704b17e8d8c2d24f1e68a61a92f72ed3f18b9ba0c7dfcc97db3.md
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-83e2a01865a32aa947474f37b05149cfa00df90169b1014f4d2301934a03afb6.md
  - >-
    raw/sha256-ced334d86bb2fbc3284d127854ea3710bee45de12d95cdd91aeb6efb5e08e13f.md
---

## 找到 seed 以后，B 怎样把 A 显存里的权重搬过来

新实例 B 的每个 Worker 已经通过[身份匹配](rfork-identity.md)借到了一个 seed：实例 A 上跑着同一个模型、同一个分片的那个 Worker。**传输**说的是接下来这一段：把 A 显存里的权重字节搬进 B 的显存。B 先把放权重的空位登记给传输引擎，再向 A 要一份清单、和自己的逐项对上，最后由 B 按地址分批把字节读过来；中间任何一步失败，都先撤销已经做过的事，再回退到默认加载。

拿一个只有三块权重的小模型来看，大小是示意数：A 的第 r 号卡上放着 W1、W2、W3，分别是 0.6、0.3、0.8 GiB；B 的第 r 号卡已经把模型搭好，三块权重的位置都留好了，还空着。

```wiki-diagram
file: rfork-transfer
```

1. **登记空位。** B 把这三段空位所在的显存登记给传输引擎（YuanRong TransferEngine）。读的两端都得登记过，A 那一份在它当 seed 时就登记好了。
2. **要清单。** B 通过 HTTP 问 A：每块权重叫什么、在 A 显存的哪个地址、有多少个元素、每个元素几字节、什么形状和类型。这份清单（manifest）只是描述，权重本身不走 HTTP。
3. **核清单。** B 拿 A 的清单和自己的逐项对照，三块全部对上才往下走；有一项对不上，一个字节都不读。
4. **分批读。** 由 B 发起，按「A 的地址 → B 的地址」把字节读过来。一批累计不超过 1 GiB：W1 和 W2 合起来 0.9 GiB 装一批，再放 W3 就是 1.7 GiB，超了，所以 W3 另起一批。

读完以后，B 的三段和 A 的三块一模一样；A 那边什么都没少，这是读、不是搬走，A 照常推理、继续当 seed。

这四步是 [RFork 总览](rfork.md)里那八步的第 4–7 步展开。Planner、HTTP 元数据、权重字节三条通道各管什么，见总览的[三条通道](rfork.md#三条通道协调清单字节各走各的)。

## 为什么不直接拷：每一步各防一种事故

B 已经知道要的是哪一份权重，看起来只要「把 A 的那段显存复制过来」就行。实际上上面每一步都在挡一种具体的事故：

- **不登记，传输引擎不碰这段内存。** 传输引擎只按登记过的地址读写。传输引擎的登记表只记地址，不管地址背后的存储死活；所以工作版在登记这一步还另外把这些存储保住，免得它们在传输途中被回收、改分给别的张量（见下文[登记了地址，权重就能活到传输结束吗](#登记了地址权重就能活到传输结束吗)）。
- **不要清单，B 不知道去哪读。** A 和 B 是两个进程，各自向分配器要显存，同一块权重在两边的地址不一样。A 那边的地址只能问 A。
- **不先整份核对，字节会被读错意思。** 显存里只是一串字节，怎么解释全靠形状和类型。float16 和 bfloat16 都是每个元素 2 字节，按字节数完全对得上，可把 float16 的字节当 bfloat16 去用，得到的全是错的数。所以核对要在第一个字节写进来之前做完，而且要整份做完：边读边核的话，后面某一项不通过时，前面几块已经被覆盖，模型成了半新半旧。
- **失败不撤销，卡上会同时有两份模型。** 登记时保住的存储会一直占着显存，半成品模型也还在；不先注销、撤掉，回退时再从存储加载一份，就是两份权重同时占卡。

分批读不在这张事故清单里：它是代码给单次同步读定的上限，累计不超过 1 GiB、不超过 512 段，超过 1 GiB 的大张量先切段。为什么取这两个值，源码里没有说明。

代价也要算清。传输省掉的只是「找文件、从存储读、名字映射与切片、主机到卡的拷贝」这几步；B 照样要先搭模型，要转布局的模型（开了量化、权重 NZ 模式为 2 或硬件要求 NZ）还要先对空参数跑一遍后处理（见[张量布局](rfork-layout.md#先看-b-要不要转布局)）。登记、要清单、核对也各占一点时间，日志里分段记着，见下文[「传完了」只说明这些读都成功返回了](#传完了只说明这些读都成功返回了)。

## 要搬多少字节：只看清单，不看请求

RFork 在服务接请求之前加载权重，所以要搬的量只由清单决定：每块权重「元素个数 × 每个元素几字节」，全部加起来。请求有多长、KV Cache 每个 token 占多少字节，算的是另一类状态，和这里无关。

用一个只为演示算法的两项清单算一遍：

```calc
title: 两项清单要读多少字节（示意清单）
W1 = 1024 × 1024 个元素 × 2 B（float16） = 2,097,152 B
W2 = 1024 个元素 × 4 B（float32） = 4,096 B
合计 = 2,097,152 + 4,096 = 2,101,248 B ≈ 2.004 MiB
> 这不是任何真实模型的权重清单
```

GLM 双机每张卡要读多少，见下文[放到 GLM 双机](#放到-glm-双机每张卡传两次字节和批数分开记)。

## 第一步：先把 B 的空位登记给传输引擎

B 搭好模型以后，先把这次要收的每块权重登记给传输引擎。登记写下的不只是「权重从哪开始、有多长」，还有它所在的那一整块内存。

**用一小段权重看清两种范围。** 分配器给出一块 [1000, 2024) 的内存；权重 W 从 1128 开始，有 64 个 float16 元素。W 自己那一段叫**逻辑范围**，它所在的整块叫**支撑范围**，登记时四个数一起交：

```calc
title: 一段权重的两种范围（示意地址）
W 的长度 = 64 个元素 × 2 B = 128 B
W 的终点 = 1128 + 128 = 1256
所在整块的长度 = 2024 − 1000 = 1024 B
登记的四个数 = (1128, 128, 1000, 1024)
> 前两个是 W 的逻辑范围（起点、长度），后两个是支撑范围；1000 不是真实地址
```

传输引擎只读写逻辑范围，不会把整块都当成权重。这里的范围都是半开区间：包含起点、不包含终点，所以相邻的两段可以在同一个端点衔接，不会重复一个字节。

**先找所在的块，再登记权重那一段。** 具体分四步：

1. 从 NPU 显存快照里取出所有正在使用的分配块，挑出和要传的权重有交集的那些，排好序，把重叠或首尾相接的块并成一段。为了不让每块权重都把全部分配块扫一遍，先给权重范围排序、记下前缀里最远的终点，再二分查找。
2. 如果是草稿模型，减掉主模型已经登记过的块（见下文[主模型和草稿模型共享地址](#主模型和草稿模型共享地址时谁登记谁来传)）。
3. 逐个检查每块权重的逻辑范围是否**完整落在**剩下的某一段里；找不到完整覆盖就直接失败，不会把越界的范围硬塞给传输引擎。
4. 同一段里相交或相邻的逻辑范围合成一项，中间有空洞就分成几项；每项带着那四个数，每批最多 4096 项，交给带支撑范围的批量注册接口（下文叫 Ex 注册）。

Ex 注册是客户端这边的调用约定。现场的 YuanRong 版本能不能接受「同一个分配块里登记多段逻辑范围」，要拿真实的 Ex 接口在 NPU 上验证：老接口一次只收（地址、长度）两个数，说不清这段范围坐落在哪个分配块里，它的表现说明不了 Ex 接口会怎样处理同块多段。传输引擎没有 Ex 注册接口时，登记直接失败；模型里有不在 NPU 上的张量时，登记一开始就拒绝。

## 登记了地址，权重就能活到传输结束吗

光靠传输引擎的登记表不能。传输引擎那里只记下「这段地址可以读写」，地址背后的存储会不会被回收，它不管；能让权重活到传输结束的，是工作版在登记这一步另外做的保活。

设想 W 的地址已经登记好，随后某个后处理步骤把 W 的数据整个换成了新张量。在 Python 里 W 还活着，但它已经指向新的存储；旧地址还留在传输引擎的登记表里，旧存储一旦没人引用，就会被分配器回收、再分给别的张量。这时远端按旧地址读到的就是别人的数据。只保住 W 这个对象，挡不住这件事。

所以工作版在登记的同时维护两张保活列表：一张存登记时收集到的张量，另一张单独存**登记那一刻**取到的原始存储；取不到有效的存储持有者就直接失败。两张列表要等确认注销、或者整个传输引擎顺利结束以后才放手。

这也解释了为什么有时要重新登记一次。走 checkpoint 布局时（大致是不量化、也不强制昇腾 NZ 格式的模型；NZ 是昇腾的一种分块存储格式），权重读完以后才跑后处理，后处理有时会给张量换上新的存储；从磁盘回退加载的那条路也一样。这两种情况下，B 当 seed 之前都要按最终模型重新登记，之后给别人读的，必须是最终模型当前真正在用的地址。走处理后布局时（量化模型都走这条），传输时登记的就是最终的缓冲区，B 当 seed 时直接沿用这份登记，不再重登。走哪条布局怎么判定，见[张量布局](rfork-layout.md)。

## 第二步：用 HTTP 向 A 要清单

登记好以后，B 带着 seed key（身份匹配时算出的那把哈希键，说明「要的是哪一份权重」）向 A 的 seed 服务发一个请求。A 的 seed 服务是 A 上专门回答元数据的 HTTP 服务。回来的说明里有三样东西：

| 内容 | 用在哪一步 |
|---|---|
| A 那边传输引擎的会话标识（不能为空） | 真正读数据时要连的远端端点 |
| 每块权重的名字 → 这块权重的信息 | 和本地清单对照，生成要读的地址列表 |
| 每块权重的名字 → 形状 | 和上一项里带的形状互相核对 |

新版 seed 服务一次就把三样都返回。老服务的回应里没有形状那一项时，B 会再单独要一次形状。这次补要出问题分两种情况，处理不一样，别混为一谈：

- **补要时网络异常**：只有权重信息里每一项已经自带完整的形状和类型，才降级继续，日志里留一条警告；否则整次取清单失败。
- **补要有回应，但不是成功状态**（比如 404）：B 不再追问，当作这次没有形状信息，交给后面的核对兜底——那里缺形状或缺类型一律拒绝。

清单本身格式不对——整个回应不是一张表、主字段不是恰好两项、会话标识为空、权重信息不是一张表、形状那一项不是一张表——都在读任何数据之前失败。主请求回了非成功状态、网络异常、回应解析失败，也都算取清单失败。**所以不能只凭 HTTP 端口通了就说这一步完成了。**

seed key 不对时的表现容易误判。A 的 seed 服务对取清单的请求**不会**回一个「拒绝」状态，而是照常回应，只是主字段是空的；B 把它当成格式不对，报的也是格式不对。所以看到「seed 回的传输元数据格式不对」，**先核 seed key，别先去查网络**。seed 服务另有两个接口：一个带 key 的健康检查，key 不对才回 400（请求错误）；一个存活检查，只说自己还活着。排错时要记下是哪个接口、回的什么状态、回的什么内容，三个接口的「成功」不能混用。

## 清单上每一项写着五个量，元素个数和字节数要分清

清单里每块权重是一项，一项有五个量：A 那边这块权重的**起始地址**、**元素个数**、**每个元素几字节**、**形状**和**类型**。前三个决定读哪一段字节，后两个决定这串字节该怎么解释。

元素个数 × 每个元素几字节 = 这块要读的字节数。比如前面两项清单里的 W1，是 1024 × 1024 的 float16：元素个数 1,048,576，每个 2 字节，要读 2,097,152 字节。

代码能看懂好几种旧格式的写法，但「能看懂」不等于「会放行」：最后核对要求形状和类型都齐全；老格式里缺类型的那种三元组，不能只凭「每个元素字节数一样」就过关。

## 第三步：第一个字节写进来之前，整份清单要过五道门

1. **名字。** 本地和远端的名字都得非空、不重复，名字集合要一致。只有确认完全落在主模型登记范围里的共享项，才按明确规则跳过（见下文[主模型和草稿模型共享地址](#主模型和草稿模型共享地址时谁登记谁来传)）——不能把随便哪个缺了的项都当成共享。
2. **字段合法。** 地址、元素个数、每个元素几字节都得是正整数，不能拿真/假值冒充数字；形状每一维是非负整数，各维相乘等于元素个数。
3. **两份形状一致。** 单独给的形状表，名字集合要和权重表一致；同一块权重两份形状对不上，直接失败。
4. **逐块、总量都对上。** 本地每块权重，远端的元素个数、每个元素几字节、类型都必须一致；两边的总条数和总字节数还要再对一遍。
5. **整份核完才动手。** 全部通过后，才去调形状、生成读取列表、开始读。不会出现「后面某一项没通过，前面几项已经悄悄传过来了」的情况。

这是一组**结构和类型的核对，不是对权重内容做校验和**。清单里也没有远端完整的步长（stride）信息，所以不能把「通过了这些检查」说成「任何非连续布局都安全」。布局能不能对上，仍然依赖两端的代码、模型和硬件前提一致；这些前提由[身份匹配](rfork-identity.md)的兼容性指纹先筛过一遍。

## 形状可以换个看法，元素个数和类型不能变

远端形状和本地一样，就什么都不动。不一样但元素个数相同，就把本地这块权重**换一个形状去看同一段存储**，也就是换个视图；换不了就终止。这只是换视图，不是插值、不是转置、也不是扩容：地址不变，登记也不受影响。

比如本地是 6 个元素排成一行，远端是 2×3：2 × 3 = 6，元素个数相同，可以换视图。本地 6 个、远端 2×4 = 8 个，就不能「自动适配」。**字节数一样也不行**：float16 和 bfloat16 都是每个元素 2 字节，类型不同照样拒绝。

## 第四步：大张量切成不超过 1 GiB 的段，再按批读

读之前先切段：一块权重超过 1 GiB 的，切成若干段、每段不超过 1 GiB。然后按清单顺序把段装批：装下一段会让这批超过 1 GiB，或者这批已经有 512 段，就封批、另起一批。这两个上限写死在代码里，不能从启动选项改。四个张量怎么装成几批，总览里[演过一遍](rfork.md#借一次权重b-的每个-worker-走哪几步)；这里只看切段时地址怎么走。

一块 2.5 GiB 的大权重会切成 1、1、0.5 GiB 三段。每段的源地址和目标地址都按已经切出去的字节往后挪，不是把同一个地址读三遍。设这块权重在 A 那边从 a 开始、在 B 这边从 b 开始：

```calc
title: 2.5 GiB 的权重切成三段（示意）
1 GiB = 1024³ B = 1,073,741,824 B
第 2 段起点 = a + 1,073,741,824
第 3 段起点 = a + 2 × 1,073,741,824 = a + 2,147,483,648
第 3 段长度 = 2.5 GiB − 2 GiB = 0.5 GiB
> B 这边的目标地址从 b 起按同样的偏移往后挪
```

读由接收方 B 发起：一批一次同步读取，B 给出自己的目标地址、A 的源地址和每段长度。任何一批返回错误，都记下是第几批、这批第一块和最后一块权重叫什么、底层返回的错误，然后走下一节的失败撤销。

有一个有意保留的代价：不同名字的权重有时指向同一段存储（别名）。实现上仍然按名字逐个读，因为只看本地地址合并不安全——证明不了两个名字在远端也有同样的偏移关系。所以重叠的字节可能被读两遍，日志里统计的字节数也可能比去重后的真实存储量大。

## 任何一步失败：先撤销，再回退

从开始登记那一刻起，这次传输就被标成「需要清理」，四步全部成功才解除。中途哪一步失败，包括底层直接抛异常，加载器都按这个顺序收拾：

1. 会话清理，依次做三件事：停掉 seed 服务；归还借来的租约；seed 服务确实停掉了，才注销已登记的内存（服务还在对外发清单时不能注销，见本节最后一条）。租约这次没还上，交给后台继续重试，不挡回退；服务没停掉或内存没注销干净，整轮清理最多再试 1 次，共 2 次。
2. 撤掉半成品模型在进程里留下的登记。
3. seed 服务没停掉、或登记没注销干净，就直接报错、**拒绝回退**：旧权重还被登记钉在显存里，再分配一份模型就是两份权重同时占卡。
4. 收拾干净了，才改用默认加载从存储读一遍，读完同样把自己登记成 seed。

回退之后的完整路径见[启动路径](rfork-startup.md)。下面三条讲内存登记这一层怎样才算撤干净。

**登记失败时不能直接清空列表。** 批量注册报错时，未必会告诉调用方「前面哪几项其实已经成功了」。所以工作版在**每一批提交之前**，就把这一批所有尝试登记的逻辑起点记进待清理列表，存储持有者也继续保着。失败后它会尝试注销这些地址；回滚没做干净，就把所有仍说不清状态的地址和持有者都留着，等后面再清。这时不能当作「什么都没发生」的失败。

**注销返回「查无此地址」，也要逐个确认。** 按接口约定，批量注销遇到第一个不存在的地址就可以停下，后面的地址根本没处理。所以批量注销返回「查无此地址」时，工作版不把整批当成已经干净，而是逐个地址重试；单个地址返回「查无此地址」，才算这一项确实不存在。

**注销登记和结束引擎各管一层。** 注销登记只释放当前登记的这批权重，回退路径还能继续用同一个传输引擎。结束引擎是把整个传输引擎关掉，只有它成功了，才清掉登记状态和会话编号、把引擎标成未初始化；引擎回「还没准备好」时最多试 10 次、每次隔 1 秒。seed 的 HTTP 服务还在被持有时，会话拒绝直接注销登记，免得 seed 服务还在对外公布已经失效的地址。

## 「传完了」只说明这些读都成功返回了

传完那条日志里的权重块数、批数、GiB、耗时、每秒 GiB，只算这段读取本身。搭模型、布局处理、显存登记、HTTP 取清单的时间都不在里面：登记、取清单、读取三段另有一条分段耗时日志，搭模型和布局处理也各有自己的耗时日志。

它也不自动证明端到端输出和默认加载一样。现场验收要用同一个模型、同样的采样设置和输入去比输出，并覆盖量化、MoE、主模型和草稿模型共享这些实际会用到的路径。「成功」分几种层次，见总览的[「成功」至少有四种](rfork.md#成功至少有四种不能压成一个开关)。

## 主模型和草稿模型共享地址时，谁登记、谁来传

投机解码的草稿模型（draft）常和主模型（target）共用一部分权重（见[投机解码](speculative-decoding.md)）。两者各是一套 RFork 会话：各自登记、各自要清单、各自核对、各自读。草稿加载时，会拿到主模型已登记的那些块当作「排除区间」；完全落在这些区间里的草稿张量，就认定主模型已经登记过、字节也已经由主模型那次传输读过来了，草稿不再重复登记，也不再重复读。

| 情况 | 工作版怎么处理 | 排查时要确认什么 |
|---|---|---|
| 没有共享 | 照常登记、照常传全部可传张量 | 两端清单是否一致 |
| 部分共享 | 跳过完全被主模型块覆盖的张量，只登记、只传独立部分 | 共享块和独立块是否真的不重叠 |
| 所有可传权重都共享 | 判定为整体复用，直接进入推理模式返回 | 主模型已正确加载；没有不在 NPU 上的状态 |
| 张量只有一部分落在排除区间里 | 不算共享；减掉排除区间后可能找不到完整覆盖而失败 | 不能只凭地址相邻就说能安全传输 |

全部共享时连后处理也跳过：后处理可能原地改动共享的存储，或者给共享的参数重新换数据，那样会把主模型弄坏。这个提前返回发生在申请租约和对空参数做后处理之前，所以这时草稿连租约都不申请。共享判断只看地址区间，不检查主模型权重的数值对不对。

字节也按会话分开记：被跳过的共享张量，不进草稿的清单、核对和读取，只在主模型那次传输里读一遍。所以「主模型的字节 + 草稿的字节」不会把共享部分算两遍；反过来，也不能把共享权重的字节再加进草稿那一份。

## 放到 GLM 双机：每张卡传两次，字节和批数分开记

这一节是推演，不是实测：我们的部署（见[部署前提](glm-5-3-flash-two-node.md#部署前提)）按教程命令没有开 RFork，工作版代码树里也没有 GLM-5.3-Flash 的模型实现。每张卡读多少字节、主模型至少几批，总览的[放到 GLM 双机](rfork.md#放到-glm-双机再起一个同构实例每张卡借多少)一节已经逐项算过：主模型约 20,572 MiB、至少 21 批；MTP 草稿模型（GLM 自带的多 token 预测层，投机解码时负责先猜后面几个 token）约 844 MiB；每张卡合计约 21,416 MiB（约 20.91 GiB）。这里只讲传输这一层要分清的三件事。

**两份清单分两个会话，从不装进同一批。** 主模型和草稿模型各走一遍上面的四步，各有自己的清单和批次。草稿那份不到 1 GiB，清单不超过 512 条时一批读完。

```calc
title: GLM 每张卡的批量读次数（下限）
分开装批 = 21 + 1 = 22 次
> 21 是总览算出的主模型批数下限，1 是草稿那一批
合起来除（错误算法） = ⌈21,416 MiB ÷ 1,024 MiB⌉ = 21 次
> 两份清单不会装进同一批，合起来除会少算草稿那一批
```

说是下限，是因为装批还要看张量的大小和顺序，总字节除以 1 GiB 只是最少的批数；实际批数以两条传完日志为准，现场还没有实测。

**排除区间防止共享部分算两遍；在这套部署里它没有东西可排。** 草稿加载时拿主模型登记过的块当排除区间。按源码推，传输那一刻草稿手里的张量没有一块落在主模型的块里：MTP 层是独立的一整套权重，草稿自建的词嵌入和输出头也是新分配的显存，要等加载结束以后才换成主模型的同名张量。所以草稿一块都不跳过，两份字节直接相加，没有重复。

**登记会把草稿的旧词表钉住。** 那两份自建的词表张量传输时要读，这是草稿要读的字节比它常驻的 540.75 MiB 多出来的主要部分（常驻账见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)）。加载结束后草稿改用主模型的同名张量，可登记时保住的旧存储放不掉；W8A8 走处理后布局，B 当 seed 时又沿用这份登记。按源码推，B 当 seed 期间每张卡多占约 302.5 MiB、折成 KV 块约少 38 块，尚未实测，推导见总览的[这套部署现在能不能受益](rfork.md#这套部署现在能不能受益)。

## 常见误解

- **「HTTP 回了成功，说明权重传完了。」** 那只是拿到了清单；权重还要走传输引擎读过来。
- **「元素个数或类型对不上，一定是网络把数据弄坏了。」** 这类不一致在读任何字节之前就被发现，先查两端的版本和布局。
- **「吞吐高就说明启动快。」** 读取只是启动里的一段，要把分段耗时和整个服务就绪的时间放在一起看。
- **「清一下显存缓存，这些权重就释放干净了。」** 还被保活列表、全局登记表或传输资源拿着的存储，不会因此变成可释放。
- **「同一个分配块里只能登记一个张量。」** 客户端明确支持在一块里写多段逻辑范围；现场运行时支不支持，要实测。
- **「把保活列表删掉，就能解决显存不够。」** 列表里保着的，正是还不能证明可以安全释放的内存；应该先查登记、注销和全局引用。
- **「主模型字节加草稿字节，会把共享的权重算两遍。」** 完全共享的张量在草稿会话里被跳过，只在主模型那次传输里读一遍。GLM 双机上，传输那一刻草稿没有共享块，两份直接相加。

## 对照源码

### 怎么开

本页各步只在接收端用 `--load-format rfork` 启动、且已选中 seed 时发生；参数、默认值与端口见[配置与部署](rfork-config.md)。两个分批上限 `MAX_TRANSFER_CHUNK_BYTES = 1024**3`、`MAX_TRANSFER_CHUNK_WEIGHTS = 512` 是模块常量，不是 CLI 参数。[C10]

### 会报什么错

登记（第一步，`register_memory_region`）在取清单之前：模型里有非 NPU 张量时报 `RFork does not support mixed-device model state; ...`；传输引擎缺 Ex 注册接口时报 `RFork requires YuanRong TransferEngine with MemoryRegistration and batch_register_memory_ex support.`；其余登记侧报错见本节末段。

取清单（`fetch_seed_transfer_info`）：接收端 GET `/get_rfork_transfer_engine_info?seed_key=...`。[C1]

| 正文说的情况 | 日志原文 |
|---|---|
| 主请求非 200 | `RFork seed metadata request returned status=...` |
| 回应不是 mapping | `RFork seed returned malformed transfer metadata response.` |
| 主字段不是两项序列（含 key 不匹配时主字段为 `None`） | `RFork seed returned malformed transfer metadata.` |
| session ID 为空或 weight manifest 不是 mapping | `RFork seed returned an invalid session or weight manifest.` |
| 形状那一项（内嵌或补要回来的）不是 mapping | `RFork seed returned a malformed shape manifest.` |
| 补要 `/get_rfork_transfer_engine_shape_info` 时抛网络异常、但权重条目已带 shape 与 dtype | `RFork optional shape metadata request failed; using complete weight metadata` |
| 其余异常（含上一条不满足降级条件时重新抛出的异常、JSON 解析异常） | `RFork seed metadata request failed for ...` |

三项字段名：`rfork_transfer_engine_info[0]` 是 session ID，`rfork_transfer_engine_info[1]` 是名字 → 权重信息，`rfork_transfer_engine_shape_info` 是名字 → shape（可内嵌）。补要 shape 返回非 200 时 `shapes` 保持 `None`，由 manifest 校验兜底。[C3]

seed 服务端：metadata 与 shape 接口在 `seed_key` 不匹配时返回字段为 `None` 的 JSON，不是 HTTP 400；`/health_check_with_key` 不匹配才返回 400；`/rfork_fetch_seed` 只回 `{"status": "ok"}`。[C9]

清单核对（`manifest.py`）常见报错：`Weight info mismatch for ...`（numel / element size 不一致）、`Weight dtype mismatch for ...`、`RFork manifest entry for ... must include shape and dtype`、`RFork conflicting shape metadata for ...`、`RFork remote shape manifest names differ from weight manifest.`、`RFork manifest count/bytes differ: ...`。条目格式为 `(ptr, numel, element_size, shape, dtype)`；解析器兼容旧 tuple / mapping，但缺 dtype 的老三元组过不了最终校验。[C2] 名称集合与共享项跳过规则、整体校验先于 reshape 与读取见 [C4]；扣掉共享项后名字仍不一致时，`transfer_backend.py` 报 `RFork manifest names differ: local_only=..., remote_only=...`。

形状调整（`reshape_tensor_to_seed_shape`）：numel 不同报 `Weight shape mismatch for ...`；`tensor.data.view(seed_shape)` 抛异常报 `Failed to reshape RFork tensor ...`。[C7]

读取：每批调 `batch_transfer_sync_read(session_id, client_ptrs, seed_ptrs, lengths)`，参数里本地目标地址在前、远端源地址在后，别看反；失败报 `Failed to transfer weights chunk %d/%d, first: %s, last: %s, ret=%s` 后返回 False。[C6]


内存登记一侧：逻辑范围找不到完整覆盖的支撑块时，打印 `tensor range ... is not fully covered by a registration block` 后失败，不会把越界范围提交给传输引擎 [C14]；取不到有效的 storage owner 直接失败 [C12]；看到 `registration rollback is incomplete` 说明注册失败后的回滚没做完，要同时检查后面的 `fallback aborted` 和显存状态，不能当作零副作用失败；批量注销返回 `kNotFound` 时逐地址重试，单地址 `kNotFound` 视为该项已不存在，其他错误留在 unresolved addresses [C15]；`finalize_transfer_engine` 只在返回 `kNotReady` 时重试，其他错误或异常直接失败 [C16]；seed HTTP 服务仍被持有时，session 拒绝直接注销 MR [C19]，日志是 `RFork refuses to unregister memory while the seed server is owned.`。

失败撤销（`rfork_loader.py`）：`transfer_from_seed` 返回 False 时 loader 抛 `transfer failed.`，打印 `RFork transfer failed: ..., clean up and fall back to default loader`，再调 `prepare_for_fallback` 最多 2 次（`FALLBACK_CLEANUP_MAX_ATTEMPTS`）。`prepare_for_fallback`（`session.py` L274–286）依次停 seed 服务、归还租约、服务停掉才注销登记，归还失败交后台重试；`can_schedule_seed` 只看服务已停且登记已注销，租约没还上不挡回退。清理失败时报 `RFork fallback aborted because seed service or registered memory cleanup failed; ...`，拒绝分配第二份模型。

### 开销和什么时候别开

分块：单个 tensor 字节段超过 1 GiB 先拆成不超过 1 GiB 的连续片段，再按累计 ≤ 1 GiB、段数 ≤ 512 分批。[C5] 2.5 GiB 张量切成 1 + 1 + 0.5 GiB 三段、源与目标地址按已传字节偏移，是按该规则的假设例子。[A][D]

别名重复读：注释明言按逻辑名逐个读、接受 alias 重叠字节的重复读取，只按本地地址合并不安全；`bytes` 统计因此可能大于唯一存储量。

完成日志 `RFork weight transfer completed: weights=..., chunks=..., bytes=... GiB, elapsed=...s, throughput=... GiB/s` 只计这段读取循环；session 另有 registration / metadata / read 分段日志。[C8]

教学字节例推导：W1 = 1024 × 1024 × 2 B = 2,097,152 B；W2 = 1024 × 4 B = 4,096 B；合计 2,101,248 B ÷ 1,048,576 ≈ 2.004 MiB。假设清单，不是 Qwen3-0.6B 或任何真实模型的实际权重清单。[A][D]

wire manifest 不携带完整远端 stride，校验是结构与类型核对而非内容 checksum——这是由条目五元组推出的结论。[D]


内存登记一侧：每批注册最多 4096 项，是模块常量、不可配置 [C10]；finalize 最多尝试 10 次、间隔 1 秒，也是模块常量，和 lease release 的三次重试是两个独立设置。张量范围索引靠排序加前缀最大终点，避免逐张量扫描全部分配块 [C11]。同一 backing allocation 上多段逻辑范围的 Ex 注册是客户端约定；现场 YuanRong 版本是否支持、`kNotFound` / 部分成功 / 批量中止的语义，都要在真实 NPU 和实际库上验证，源码阅读与 CPU 测试不能替代。W 被 `W.data = 新张量` 替换后旧地址仍在 TransferEngine 注册表里、只保 W 不能保旧 storage，是由保活实现推出的结论 [D]。

GLM 双机的数（推演，未实测）：主模型 session 约 20,572 MiB、至少 21 批，草稿 session 约 844 MiB、1 批，取自主线底稿 01 §A0.8「在我们部署下的具体数字」；草稿常驻 540.75 MiB 取自 02 §7.5。现场核对时，主模型和草稿各看自己那条 `RFork weight transfer completed` 日志，别把两条的 `bytes`、`chunks` 混成一条比。processed layout 下 seed 发布沿用接收时的登记、不重登（`session.py` L317–334），所以草稿两份词表张量的旧 storage 在本实例当 seed 期间一直被保活，即底稿 01 §A0.8 待核 6 的约 302.5 MiB / 约 38 块。

### 版本差异

本页只讲 RFork 工作版（`verified: rfork:main`，钉 `3284850b`）。社区 v0.23 / v0.26 / main 都没有 `manifest.py`、`seed_client.py`（它们由工作版 patch 0004 新建），社区版的元数据走 `seed_protocol.py`、没有独立的 manifest 校验层；逐补丁对照见 [RFork 总览](rfork.md) 的「版本差异」。

社区版（v0.23 维护分支 `2c59ff10`、v0.26 `2ed6cbba`、main `baa023ad`，以及含 GLM 代码的 `db701c1f`）的 `rfork/` 目录都是同样 6 个文件，`transfer_backend.py` 里本页相关的差别：分批上限同为 1 GiB / 512，但单个张量不切段；登记用 `batch_register_memory(addresses, sizes)`，只有地址和长度、没有支撑范围，也没有 storage owner 保活；清单只逐张量核 numel 与 element size（`Weight info mismatch`），不核 dtype、总条数与总字节。

### 源码位置

工作版 `rfork@3284850b`，路径前缀 `vllm_ascend/model_loader/rfork/`：

| 步骤 | 位置 |
|---|---|
| 四步的顺序：登记 → 取清单 → 读，分段耗时日志 | `session.py` L103–148 |
| 取清单、shape 补要与降级 | `seed_client.py` L89–153 `fetch_seed_transfer_info` |
| 条目解析与字段合法性 | `manifest.py` L50–111 |
| 逐张量对照、总条数与总字节 | `manifest.py` L164–252 |
| 名称集合、共享项跳过、先校验后读 | `transfer_backend.py` L626–730 |
| 大张量拆段与分批 | `transfer_backend.py` L121–152 |
| 读列表、批量同步读、完成日志 | `transfer_backend.py` L732–793 |
| 形状视图调整 | `tensor_layout.py` L28–48 `reshape_tensor_to_seed_shape` |
| seed 服务端各接口 | `seed_server.py` L162–188 |
| 分批上限常量 | `transfer_backend.py` L33–37 |
| 传输失败 → 清理 → 回退或拒绝回退 | `rfork_loader.py` L622–672 |
| 会话清理顺序：停服务、还租约、注销登记 | `session.py` L274–286；`types.py` L38–49 |
| seed 发布前是否重新登记 | `session.py` L317–334 |

内存登记一侧：

| 步骤 | 位置 |
|---|---|
| 找相交分配块、张量范围索引 | `transfer_backend.py` L40–118 |
| 保活列表：Tensor 与注册时的 storage | `transfer_backend.py` L155–175 |
| 按 `exclude_blocks` 排除 target 已覆盖的 draft 张量 | `transfer_backend.py` L271–354 |
| 检查完整覆盖、合并逻辑范围、`batch_register_memory_ex` 与失败回滚 | `transfer_backend.py` L356–461 |
| `unregister_memory_region`，`kNotFound` 逐地址重试 | `transfer_backend.py` L463–561 |
| `finalize_transfer_engine`，成功才清登记状态与 session ID | `transfer_backend.py` L563–614 |
| draft 加载器取 `registered_weight_blocks` 当 `exclude_blocks` | `rfork_loader.py` L492–501 |
| `can_reuse_shared_weights` 为真时直接 eval 返回 | `rfork_loader.py` L584–591 |
| seed HTTP 服务仍被持有时拒绝注销 MR | `session.py` L255–286 |
