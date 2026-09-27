---
id: rfork-transfer
title: RFork 传输：先验整张清单，再按地址读字节
type: feature
summary: >-
  新实例找到可借权重的来源后，先向它要一份“去哪读、读哪些”的说明，把两边每一块权重的名字、个数和类型逐项对上，
  整份通过才按地址分批把字节读过来；也讲清“说明拿到了”“字节读完了”“模型算得对”各自证明了什么。
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
updated: '2026-09-25'
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

## 新实例已经找到了 seed，能不能马上往自己的显存里写

新实例 B 通过[身份匹配](rfork-identity.md)找到了一个跑着同一模型的实例 A 当 seed，自己的模型也搭好了、放权重的空位也登记好了（见下文「登记了地址，权重就能活到传输结束吗」一节）。下一步是不是直接把 A 的字节拷过来？

**不是。拿到 seed 不等于可以直接写内存。** B 要先做三件事：

1. 向 A 要一份说明：数据从哪个传输端点读，A 那边每块权重在什么地址、多少个元素、什么形状和类型。这份说明走 HTTP，**HTTP 只传描述，不传权重本身**。
2. 把 A 的这张清单和自己的清单逐项对照，整份都对得上才继续；形状允许在元素个数不变的前提下换个看法。
3. 最后才由 B 主动发起读取，按批从 A 的显存把字节读进自己的地址。数据走的是传输引擎（TransferEngine），不是那条 HTTP。

```wiki-diagram
file: rfork-architecture
```

下面按这三步讲，最后说清楚“传完了”这句话到底证明了什么。

## 要搬多少字节，只看权重清单，不看请求有多长

RFork 在请求执行前加载权重。传输量等于实际清单中各张量“元素个数 × 每元素字节数”的总和；请求输入长度和 KV Cache 的每 token 字节数用于另一类状态计算，不参与这里的权重清单求和。

举一个只为演示算法的小清单：W1 是 1024×1024 的 float16（每个元素 2 字节），W2 是 1024 个元素的 float32（每个元素 4 字节）。W1 是 2,097,152 字节，W2 是 4,096 字节，合计 2,101,248 字节，约 2.004 MiB。这不是任何真实模型的权重清单。

## 第一步：先用 HTTP 要一份“去哪读、读哪些”的说明

B 带着 seed key 向 A 的 seed 服务发一个请求，拿回来的说明里有三样东西：

| 内容 | 用在哪一步 |
|---|---|
| A 那边传输引擎的会话标识（不能为空） | 真正读数据时要连的远端端点 |
| 每块权重的名字 → 这块权重的信息 | 和本地清单对照，生成要读的地址列表 |
| 每块权重的名字 → 形状 | 和上一项里带的形状互相核对 |

新版 seed 服务一次就把三样都返回。老服务不带形状那一块时，B 会再单独要一次形状。这一步出问题有两种情况，处理不一样，别混为一谈：

- **这次请求本身出了网络异常**：只有权重信息里每一项已经自带完整的形状和类型，才降级继续，日志里留一条警告；否则整次取说明失败。
- **请求有回应，但不是成功状态**（比如 404）：B 不再追问，当作这次没有形状信息，交给后面的清单核对兜底——那里缺形状或缺类型一律拒绝。

说明本身的格式不对——整个回应不是一张表、主字段不是恰好两项、会话标识为空、权重信息不是一张表——都会在读任何数据之前失败。网络异常、回应解析失败，也都记成“取说明失败”。**所以不能只凭 HTTP 端口通了就说这一步完成了。**

key 不对时的表现容易误判。A 的 seed 服务对取说明的请求**不会**回一个“拒绝”状态，而是照常回应，只是主字段是空的；B 把它当成“格式不对”，报的也是格式不对。所以看到“seed 回的传输说明格式不对”，**先核 seed key，别先去查网络**。seed 服务另有两个接口：一个带 key 的健康检查，key 不对才会回“请求错误”；一个存活检查，只说自己还活着。排错时要记下是哪个接口、回的什么状态、回的什么内容，三个接口的“成功”不能混用。

## 清单上的每一项写着五个量，元素个数和字节数要分清

说明里每块权重是一项，一项有五个量：

- A 那边这块权重的**起始地址**；
- **元素个数**；
- **每个元素几字节**；
- **形状**和**类型**：告诉你这串字节该怎么解释。

元素个数 × 每个元素几字节 = 这块要读的字节数。代码能看懂好几种旧格式的写法，但“能看懂”不等于“会放行”：最后核对要求形状和类型都齐全；老格式里缺类型的那种，不能只凭“每个元素字节数一样”就过关。

## 第二步：第一个字节写进来之前，整份清单必须过这几道门

1. 本地和远端的名字都得非空、不重复，名字集合要一致。只有确认完全落在主模型登记范围里的共享项，才按明确规则跳过——不能把随便哪个缺了的项都当成共享。
2. 地址、元素个数、每个元素几字节都得是正整数，不能拿真/假值冒充数字；形状每一维是非负整数，各维相乘等于元素个数。
3. 单独给的形状表，名字集合要和权重表一致；同一块权重两份形状对不上，直接失败。
4. 本地每块权重，远端的元素个数、每个元素几字节、类型都必须一致；两边的总条数和总字节数还要再对一遍。
5. 整份核完才去调形状、生成读取列表、开始读。不会出现“后面某一项没通过，前面几项已经悄悄传过来了”的情况。

这是一组**结构和类型的核对，不是对权重内容做校验和**。清单里也没有带远端完整的步长（stride）信息，所以不能把“通过了这些检查”说成“任何非连续布局都安全”——布局能不能对上，仍然依赖两端的代码、模型和硬件前提一致。

## 形状可以换个看法，元素个数和类型不能变

远端形状和本地一样，就什么都不动。不一样但元素个数相同，就试着把本地这块权重**换一个形状去看同一段存储**；换不了就终止。这只是换视图，不是插值、不是转置、也不是扩容。

比如本地是 6 个元素排成一行，远端是 2×3：元素都是 6 个，有机会换视图。本地 6 个、远端 8 个，就不能“自动适配”。**字节数一样也不行**：float16 和 bfloat16 都是每个元素 2 字节，类型不同照样拒绝。

## 第三步：大权重切成不超过 1 GiB 的批次去读

读之前先切分：单块权重的字节段超过 1 GiB 的，先切成若干段、每段不超过 1 GiB；然后把这些段装批，一批累计不超过 1 GiB、段数不超过 512。这两个上限是写死在代码里的，不能从启动选项改。

比如一块 2.5 GiB 的大权重，会切成 1、1、0.5 GiB 三段。每段的源地址和目标地址都按已经读过的字节往后挪——不是把同一个源地址读三遍。

读由接收方 B 发起，一批一次同步读取：B 给出自己的目标地址、A 的源地址和每段长度。任何一批返回错误，都记下是第几批、这批第一块和最后一块权重叫什么、底层返回的错误，然后走失败清理。

有一个有意保留的代价：不同名字的权重可能指向同一段存储（别名）。实现上仍然按名字逐个读，因为只看本地地址合并不安全——证明不了两个名字在远端也有同样的偏移关系。所以日志里统计的字节数可能比去重后的真实存储量大。

## “传完了”只说明这些读都成功返回了

传完那条日志里的权重块数、批数、GiB、耗时、每秒 GiB，只算这段读取本身。模型搭建、布局准备、显存登记、HTTP 取说明的时间都不在里面；这些阶段各有自己的分段耗时日志。

它也不自动证明端到端输出和默认加载方式一样。现场验收要用同一个模型、同样的采样设置和输入去比输出，并覆盖量化、MoE、主模型和草稿模型共享这些实际会用到的路径。

## 常见误解

- **“HTTP 回了成功，说明权重传完了”**——那只是拿到了说明；权重还要走传输引擎读过来。
- **“元素个数或类型对不上，一定是网络把数据弄坏了”**——这类不一致在读任何字节之前就被发现，先查两端版本和布局。
- **“吞吐高就说明启动快”**——读取可能只占启动的一部分，要把分段耗时和整个服务就绪的时间放在一起看。

## 登记了地址，权重就能活到传输结束吗（原 rfork-memory 页）

以下内容由原 `rfork-memory` 页并入，2026-09-27 只作搬运，未重写文风。

新实例要从已经跑着的实例那里直接读权重，前提是老实例先把每块权重的地址登记给传输引擎。但**登记一个地址，并不会让地址背后的权重自动活到传输结束**：权重被后处理换掉、被分配器回收，登记表里的地址照样还在，远端读到的就是别人的数据。所以工作版做了三件事——分清「权重自己那一段」和「它所在的整块内存」，把权重和它背后的原始存储一起保住，只有确认注销或整个传输引擎顺利结束后才放手。

**用一小段权重看清两种范围。** 分配器给出一块 `[1000, 2024)` 的内存，共 1024 字节；权重 W 从 1128 开始，64 个 float16 元素、每个 2 字节，所以 W 自己占 `[1128, 1256)`，共 128 字节。登记时要写四个数：`(1128, 128, 1000, 1024)`——前两个是 W 的**逻辑范围**（起点、长度），后两个是它所在那整块的**支撑范围**。传输引擎只读逻辑范围，不会把整块都当权重读走。这些数字只用来演示半开区间，1000 不是真实地址；半开区间包含起点、不包含终点，所以两段相邻范围可以在同一个端点衔接，不会重复一个字节。

**先找所在的块，再登记权重那一段。** 工作版先从 NPU 显存快照里取出所有正在使用的分配块，挑出和要传的权重有交集的那些，排好序，把重叠或紧挨着的块并成一段；为了不让每个权重都把所有块扫一遍，它先给权重范围排序、记下前缀里最远的终点。接着减去主模型已经登记过的块（draft 场景，见下文），再逐个检查每个权重的逻辑范围是否**完整落在**剩下的某一块里；找不到完整覆盖就直接失败，不会把越界的范围硬塞给传输引擎。同一块里相交或相邻的逻辑范围可以合成一项，中间有空洞的就分成几项，每一项都带着那四个数，分批交给带支撑范围的批量注册接口（下文叫 Ex 注册）。这是客户端这边的调用约定；现场的 YuanRong 版本能不能接受「同一个分配块里登记多段逻辑范围」，还要拿真实的 Ex 接口在 NPU 上验证——老接口一次只收（地址、长度）两个数，说不清「这段范围坐落在哪个分配块里」，它能不能注册说明不了 Ex 接口会怎样处理同块多段。

**为什么只保住权重对象还不够。** 设想 W 的地址已经登记好，随后某个后处理步骤把 W 的数据整个换成了新张量：在 Python 里 W 还活着，但它已经指向新的存储，旧地址却还留在传输引擎的登记表里。只保住 W 这个对象，挡不住旧存储被分配器回收再分给别人。所以工作版维护两张保活列表：一张存登记时收集到的张量，另一张单独存**登记那一刻**取到的原始存储；取不到有效的存储持有者就直接失败。这也解释了走普通 checkpoint 加载路径时，后处理结束后为什么要刷新一次登记——之后当种子给别人读的，必须是最终模型当前真正在用的地址。

**draft 和主模型共享的是地址区间。** 投机解码的 draft 模型常和主模型（target）共用一部分权重。draft 加载时会拿到主模型已登记的那些块当作「排除区间」，完全落在这些区间里的 draft 张量就认定主模型已经登记过，不再重复登记。

| 情况 | 工作版怎么处理 | 排查时要确认什么 |
|---|---|---|
| 没有共享 | 照常登记全部可传张量 | 两端清单是否一致 |
| 部分共享 | 跳过完全被主模型块覆盖的张量，只传独立部分 | 共享块和独立块是否真的不重叠 |
| 所有可传权重都共享 | 判定为可以整体复用，直接进入推理模式返回 | 主模型已正确加载；没有不支持的非 NPU 状态 |
| 张量只有一部分落在排除区间里 | 不算完全共享；减掉排除区间后可能找不到完整覆盖而失败 | 不能只凭地址相邻就说能安全传输 |

全部共享时连后处理也跳过：后处理可能原地改动共享的存储，或者给共享的参数重新换数据，那样会把主模型弄坏；这个提前返回发生在申请租约和预处理之前。共享判断只看地址区间，它不检查主模型权重的数值对不对。

**登记失败时不能直接清空列表。** 批量注册报错时未必会告诉调用方「前面哪几项其实已经成功了」，所以工作版在**每一批提交之前**就把这一批所有尝试登记的逻辑起点记进待清理列表，存储持有者也继续保着。失败后它会尝试注销这些地址；如果回滚没做干净，就把所有仍说不清状态的地址和持有者都留着，等后面再清理——这时不能当作「什么都没发生」的失败。批量注销时如果返回「查无此地址」，它不会把整批当成已经干净，而是逐个地址重试；单个地址返回查无此地址，才算这一项确实不存在。

**注销登记和结束引擎各管一层。** 注销登记只释放当前登记的这批权重，好让回退路径继续用同一个传输引擎；结束引擎则是把整个传输引擎关掉，只有它成功了才会清掉登记状态和会话编号，并把引擎标成未初始化。种子的 HTTP 服务还在被持有时，会话会拒绝直接注销登记，免得元数据服务还在对外公布已经失效的地址。

内存这一侧还有三个常见误解：「清一下显存缓存，这些权重就释放干净了」——还被持有者、全局登记表或传输资源拿着的存储不会因此变成可释放；「同一个分配块里只能登记一个张量」——客户端明确支持在一块里写多段逻辑范围，运行时是否支持要现场核实；「把保活列表删掉就能解决显存不够」——列表里保着的正是还不能证明可以安全释放的内存，应该先查登记、注销和全局引用。

## 对照源码

### 怎么开

本页各步只在接收端用 `--load-format rfork` 启动、且已选中 seed 时发生；参数、默认值与端口见[配置与部署](rfork-config.md)。两个分批上限 `MAX_TRANSFER_CHUNK_BYTES = 1024**3`、`MAX_TRANSFER_CHUNK_WEIGHTS = 512` 是模块常量，不是 CLI 参数。[C10]

### 会报什么错

取说明（`fetch_seed_transfer_info`）：接收端 GET `/get_rfork_transfer_engine_info?seed_key=...`。[C1]

| 上半说的情况 | 日志原文 |
|---|---|
| 主请求非 200 | `RFork seed metadata request returned status=...` |
| 回应不是 mapping | `RFork seed returned malformed transfer metadata response.` |
| 主字段不是两项序列（含 key 不匹配时主字段为 `None`） | `RFork seed returned malformed transfer metadata.` |
| session ID 为空或 weight manifest 不是 mapping | `RFork seed returned an invalid session or weight manifest.` |
| 补要 `/get_rfork_transfer_engine_shape_info` 时抛网络异常、但权重条目已带 shape 与 dtype | `RFork optional shape metadata request failed; using complete weight metadata` |
| 其余异常（含上一条不满足降级条件时重新抛出的异常、JSON 解析异常） | `RFork seed metadata request failed for ...` |

三项字段名：`rfork_transfer_engine_info[0]` 是 session ID，`rfork_transfer_engine_info[1]` 是名字 → 权重信息，`rfork_transfer_engine_shape_info` 是名字 → shape（可内嵌）。补要 shape 返回非 200 时 `shapes` 保持 `None`，由 manifest 校验兜底。[C3]

seed 服务端：metadata 与 shape 接口在 `seed_key` 不匹配时返回字段为 `None` 的 JSON，不是 HTTP 400；`/health_check_with_key` 不匹配才返回 400；`/rfork_fetch_seed` 只回 `{"status": "ok"}`。[C9]

清单核对（`manifest.py`）常见报错：`Weight info mismatch for ...`（numel / element size 不一致）、`Weight dtype mismatch for ...`、`RFork manifest entry for ... must include shape and dtype`、`RFork conflicting shape metadata for ...`、`RFork remote shape manifest names differ from weight manifest.`、`RFork manifest count/bytes differ: ...`。条目格式为 `(ptr, numel, element_size, shape, dtype)`；解析器兼容旧 tuple / mapping，但缺 dtype 的老三元组过不了最终校验。[C2] 名称集合与共享项跳过规则、整体校验先于 reshape 与读取见 [C4]。

形状调整（`reshape_tensor_to_seed_shape`）：numel 不同报 `Weight shape mismatch for ...`；`tensor.data.view(seed_shape)` 抛异常报 `Failed to reshape RFork tensor ...`。[C7]

读取：每批调 `batch_transfer_sync_read(session_id, client_ptrs, seed_ptrs, lengths)`，参数里本地目标地址在前、远端源地址在后，别看反；失败报 `Failed to transfer weights chunk %d/%d, first: %s, last: %s, ret=%s` 后返回 False。[C6]


内存登记一侧（原 rfork-memory 页）：逻辑范围找不到完整覆盖的支撑块时，打印 `tensor range ... is not fully covered by a registration block` 后失败，不会把越界范围提交给传输引擎 [C14]；取不到有效的 storage owner 直接失败 [C12]；看到 `registration rollback is incomplete` 说明注册失败后的回滚没做完，要同时检查后面的 `fallback aborted` 和显存状态，不能当作零副作用失败；批量注销返回 `kNotFound` 时逐地址重试，单地址 `kNotFound` 视为该项已不存在，其他错误留在 unresolved addresses [C15]；`finalize_transfer_engine` 只在返回 `kNotReady` 时重试，其他错误或异常直接失败 [C16]；seed HTTP 服务仍被持有时，session 拒绝直接注销 MR [C19]。

### 开销和什么时候别开

分块：单个 tensor 字节段超过 1 GiB 先拆成不超过 1 GiB 的连续片段，再按累计 ≤ 1 GiB、段数 ≤ 512 分批。[C5] 2.5 GiB 张量切成 1 + 1 + 0.5 GiB 三段、源与目标地址按已传字节偏移，是按该规则的假设例子。[A][D]

别名重复读：注释明言按逻辑名逐个读、接受 alias 重叠字节的重复读取，只按本地地址合并不安全；`bytes` 统计因此可能大于唯一存储量。

完成日志 `RFork weight transfer completed: weights=..., chunks=..., bytes=... GiB, elapsed=...s, throughput=... GiB/s` 只计这段读取循环；session 另有 registration / metadata / read 分段日志。[C8]

教学字节例推导：W1 = 1024 × 1024 × 2 B = 2,097,152 B；W2 = 1024 × 4 B = 4,096 B；合计 2,101,248 B ÷ 1,048,576 ≈ 2.004 MiB。假设清单，不是 Qwen3-0.6B 或任何真实模型的实际权重清单。[A][D]

wire manifest 不携带完整远端 stride，校验是结构与类型核对而非内容 checksum——这是由条目五元组推出的结论。[D]


内存登记一侧（原 rfork-memory 页）：每批注册最多 4096 项，是模块常量、不可配置 [C10]；finalize 最多尝试 10 次、间隔 1 秒，也是模块常量，和 lease release 的三次重试是两个独立设置。张量范围索引靠排序加前缀最大终点，避免逐张量扫描全部分配块 [C11]。同一 backing allocation 上多段逻辑范围的 Ex 注册是客户端约定；现场 YuanRong 版本是否支持、`kNotFound` / 部分成功 / 批量中止的语义，都要在真实 NPU 和实际库上验证，源码阅读与 CPU 测试不能替代。W 被 `W.data = 新张量` 替换后旧地址仍在 TransferEngine 注册表里、只保 W 不能保旧 storage，是由保活实现推出的结论 [D]。

### 版本差异

本页只讲 RFork 工作版（`verified: rfork:main`，钉 `3284850b`）。社区 v0.23 / v0.26 / main 都没有 `manifest.py`、`seed_client.py`（它们由工作版 patch 0004 新建），社区版的元数据走 `seed_protocol.py`、没有独立的 manifest 校验层；逐补丁对照见 [RFork 总览](rfork.md) 的「版本差异」。

### 源码位置

| 步骤 | 位置 |
|---|---|
| 取说明、shape 补要与降级 | `seed_client.py` `fetch_seed_transfer_info` |
| 条目解析与字段合法性 | `manifest.py` L50–111 |
| 逐张量对照、总条数与总字节 | `manifest.py` L164–252 |
| 名称集合、共享项跳过、先校验后读 | `transfer_backend.py` L633–730 |
| 大张量拆段与分批 | `transfer_backend.py` L121–152 |
| 读列表、批量同步读、完成日志 | `transfer_backend.py` L732–793 |
| 形状视图调整 | `tensor_layout.py` `reshape_tensor_to_seed_shape` |
| 分段耗时日志 | `session.py` L103–148 |
| seed 服务端各接口 | `seed_server.py` L165–193 |
| 分批上限常量 | `transfer_backend.py` L33–37 |

内存登记一侧（原 rfork-memory 页），工作版 `rfork@3284850b`，路径前缀 `vllm_ascend/model_loader/rfork/`：

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
