---
id: rfork-lifecycle
title: RFork 生命周期：模型可用、租约归还、成为 seed 是三件事
type: feature
summary: >-
  新实例读完权重之后，还要把借来的名额还给 Planner，再决定要不要自己当来源。这页讲这几件事各自什么时候算完成：还名额失败会怎样、Planner
  回 400 和 404 各说明什么、心跳和租约各看哪个钟、关停时为什么不一定马上清干净，以及现在还没有续租。
aliases:
  - RFork 生命周期
  - RFork DEFERRED
  - RFork lease release rejected
  - RFork lease remains unresolved
  - RFork seed promotion
  - RFork put_seed
  - RFork TTL
chapters: []
order: 80
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/types.py#L12-L52'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L64-L148'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L150-L253'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L296-L425'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L427-L501'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L111-L167'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L169-L267'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L39-L75'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L127-L190'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L192-L286'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L431-L484'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L69-L109'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/config.py#L11-L15'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork-transfer
    kind: builds-on
    note: 最后一次同步读成功后才进入 TRANSFERRED，此后释放租约与发布 seed 可异步推进
  - to: rfork-memory
    kind: builds-on
    note: 会话结束不能只清掉 Python 状态；还要确认服务与传输内存的清理条件
contradicts: []
updated: '2026-09-25'
rawSources:
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-59591a4419847f7e688d941665e517ceeff58268f61c79d46d5e2398c4b5e7ce.md
  - >-
    raw/sha256-5bad70ef874cd30dbb1c42ecd2370b814b3bafa2c63fceb2ab55f1da7f506deb.md
  - >-
    raw/sha256-629e6f8b0215485342250f376eedf494ef1b55f5de26f189da5f5a615659eba1.md
  - >-
    raw/sha256-7c1cf46ed24557ae509144bda485106fc93a596c0e8a111ed26f83c3491c0981.md
---

## 权重已经读完了，Planner 却不收回租约，这个实例还能用吗

新实例 B 向已有实例 A 借来源时，要先从 Planner 那里拿一个借用名额，也就是**租约**。假设 B 已经把权重全部读完、模型也切到了推理模式，这时 B 去还租约，Planner 回了一个 400。

B 会怎样？答案是：**租约没还上，会挡住 B 以后自己当来源（成为新 seed），但不一定挡住 B 把已经装好权重的模型继续启动起来。** 工作版把还租约放到一个后台线程里，失败了有限次重试；它不会把失败假装成还上了，也没有实现自动续租。

所以上面那个场景里，B 会记下「这份租约没了结」、停掉这份租约的重试、不再把自己登记成来源；加载器仍然可以把模型交出去。B 后面到底有没有把推理请求服务起来，要看整个启动过程的结果。

「还租约报错之后卡住了」这种现象，至少还要分开看：后台还租约那条线程的结果如何、主模型加载结束了没有、是不是正在加载投机解码的 draft 模型、其他 rank 是否还卡在初始化、API 服务到底 ready 了没有。单凭一个 HTTP 状态码，推不出进程锁死。

```wiki-diagram
file: rfork-lifecycle
```

## 七个阶段记的是本机资源走到哪一步，不是 Planner 那边的状态

工作版给每次加载建一个会话，会话在七个阶段之间走。每个阶段只说明本机这边的事，读的时候最容易多推一步：

| 阶段 | 本机这边的意思 | 不能据此推断 |
|---|---|---|
| 已建立 | 会话建好了，可以准备模型、去申请来源 | 模型已经装好；Planner 上一定有来源 |
| 已借到 | 拿到了向来源借用的租约 | 内存已经登记、权重已经读到 |
| 待清理 | 开始做可能留下登记副作用的操作，或者清理还没做完 | 此刻一定出了没法恢复的故障——正常开始传输时也会临时进入这一步 |
| 已传完 | 登记内存、拿元数据、读权重都成功了 | 后处理和「当来源」的发布已经结束 |
| 就绪 | 当来源所需的模型和内存登记都备好了 | 借来的租约已经还上；Planner 已经能发现自己 |
| 服务中 | 本机的来源服务起来了、第一次上报成功、心跳线程也启动了 | 整个模型 API 服务 ready；以后每次心跳都会成功 |
| 已收尾 | 这个会话的传输引擎清理成功 | 其他 Worker、或同一进程里另一个主模型 / draft 会话也清完了 |

「就绪」「服务中」说的是 RFork 自己「当来源」这件事走到哪了，不是 vLLM HTTP 服务统一的就绪信号。

## 还租约交给后台线程，结果只分三种

权重传成功后，会话切到「已传完」并安排一个后台线程去还租约；负责启动的那条线程不等这次 HTTP 请求，接着往下做后处理。一份租约只交给一个还租约的线程。

这个线程先拿会话锁，取出要还的租约、更新重试计数；然后**放开锁**再发网络请求；回来后再拿锁，把结果对回同一份租约。结果只分三类：

| Planner 的回应 | 客户端怎么认 | 接下来做什么 |
|---|---|---|
| HTTP 200 或 404 | 已归还 | 清掉这份租约，试着接着把「当来源」发布出去 |
| 网络请求出错、408、429、5xx | 可以再试 | 在次数预算内等一会儿再试 |
| 400、其他拒绝、重定向等 | 被拒 | 立即停止，不等次数用完 |

默认总共试 3 次（包括第一次），两次之间隔 30 秒；这两个数都能在[配置页](rfork-config.md)里改。被拒或者次数用完以后，这份租约留在「没了结」的状态，已经排好的「当来源」发布任务被取消，日志里会写明不会把自己登记为来源；**不会因为这个结果去重新加载已经装好的权重**。

「还租约的网络请求不占会话锁」只在这一段成立。登记内存和读权重仍然是在会话锁里做的，登记成来源和部分清理也包含网络动作——不能推广成「所有线程在任何时候都不会被堵住」。

## Planner 回 404，只能算「按约定当作还了」

B 和 Planner 之间有四种请求，参数都放在 HTTP 请求头里，不在 JSON 正文里。同样一个 404，在不同请求里意思不一样：

| 请求在做什么 | 客户端怎么认 |
|---|---|
| 找一个可借的来源 | 200 且响应头里带齐来源的地址、端口、借用编号、rank 才算拿到；404 表示没有可用来源 |
| 归还借用的租约 | 200 和 404 都当作还完了；这个请求不代表把自己加进来源池 |
| 登记自己为来源 / 发心跳 | 只认 200；第一次登记和之后的心跳用的是同一个接口 |
| 撤销自己的来源登记 | 200 和 404 都当作撤销了；这是来源关服务时用的，不是借用方还租约 |

找来源时，Planner 就算回了 200，如果该放在响应头里的内容只写在了正文 JSON 里，客户端也会因为信息不全而放弃。登记来源时客户端每次都带一个固定的「当前借用人数 0」，示例 Planner 收下后也不拿它算容量（容量由 Planner 自己的配置决定），所以它**不能**证明现场这个来源没人在读。

**下面这段说的是仓库里示例 Planner 的做法，不是协议要求。** 示例 Planner 在租约已过期、或者查不到匹配的租约时，归还会失败，接口把它转成 404；身份对不上的失败也可能落到同一个 404。所以客户端接受 404，最多说明「按当前约定把这次归还当作完成」，**不能证明传输结束前租约没有超时**。

生产用的 Planner 如果拿 404 表示别的错误，或者拿 400 表示「借用编号不存在」，就不能照搬示例的解释。工作版并没有把所有 400 都当成「已经还过了」；现场要保留实际的响应体、租约对应的编号和 Planner 端的记录，再判断原因。

## 心跳、租约有效期、请求超时：各看各的钟

| 钟 | 谁在计 | 默认值 | 管什么 |
|---|---|---|---|
| 心跳间隔 | 来源这边的客户端 | 30 秒 | 上一次心跳请求结束后再等这么久，不是固定频率的定时器 |
| 心跳有效期 | 示例 Planner | 60 秒 | 来源太久没上报，就从候选池里清掉 |
| 租约有效期 | 示例 Planner | 60 秒 | 借用超期后把名额收回 |
| 单次请求超时 | RFork 客户端 | 10 秒 | 一次 HTTP 的连接 / 读取最多等多久，不是整件事的截止时间 |
| 来源服务健康检查 | RFork 客户端 | 5 秒 | 启动本机来源服务时等它回应健康检查的时间；关停时等心跳线程退出也不少于这个数 |

客户端这三个数（30 / 10 / 5 秒）都能在[配置页](rfork-config.md)里改；两个有效期是示例 Planner 自己的，改客户端动不了它们。心跳只刷新「这个来源最近一次报平安的时间」，**不碰借用方租约的起算时间**——心跳正常，不等于借来的租约不会过期。

**现在没有续租。** 设计文档讨论过续租方案，但当前客户端没有调用续租接口。租约到期只改了示例 Planner 的名额账本，并不会通知正在进行的权重读取停下来。所以有效期设得太短，可能出现旧的读取还没结束、名额已经又被发出去的情况。

## 租约没还上时，「当来源」先记作延期

启动本机来源服务有三种结果：已启动、延期、失败。如果模型和内存登记都已「就绪」，但借来的租约还没还上，会话就把模型和发布参数先存着，返回「延期」；只有「已启动」才算真的成功。

后台线程一旦确认租约还上了，就接着把延期的发布做完。如果归还被拒或者次数用完，延期任务直接取消，不会无限循环地自己恢复。也就是说，「延期」只承诺**租约还上了就接着发布**，不承诺租约一定能还上；要先查清 Planner 那边的状态，再决定怎么人工恢复。延期期间，模型和已登记的内存仍然由这个会话拿着。

## 关停不等还租约，但也不保证马上把内存全放掉

关停时，会话先发停止信号：不再发起新的还租约请求，也不等还租约线程里正在进行的 HTTP。接着停心跳、试着去 Planner 撤销自己的来源登记、关掉本机来源服务。只有来源服务确实停了、而且没有没了结的租约时，才会去清理传输引擎。

等心跳线程退出有自己的等待上限：取「来源服务健康检查时间」和「连接 + 读取两段超时再加一秒」里较大的那个，所以上面时钟表里的 5 秒是它的下限。撤销来源登记失败时，本机来源服务会留着，方便再试；租约没了结时，传输引擎的状态也会留着，靠在途请求的确认或 Planner 那边的回收规则去处理。**关停函数返回「没清完」，不能当成「清理已完成」。**

示例 Planner 把来源和租约都存在单个进程的内存字典里。多副本之间共不共享、重启后怎么恢复、怎么可靠地保护正在读的借用方，是生产 Planner 要自己负责的事；这一章不拿这个 Python 示例替代现场服务的约定。

还有一个容易看反的地方：会话里记的租约，是**本机向别的来源借来的那一份**，不是「别人正在向我借的租约」。它为空，只说明本机没有向外借用还没了结；撤销来源登记只挡住以后的发现，关掉提供元数据的 HTTP 服务，也不会自动取消远端已经拿到地址、正在进行的读取。能不能安全退出，还要看传输引擎的清理约定和现场有没有把在读的借用方排空，不能单凭本机状态推出「远端都读完了」。

## 常见误解

- **「心跳正常，租约就不会过期」**——报平安和借用有效期各自计时。
- **「收到 404 说明按时归还了」**——租约可能早就被回收了；这个响应不能倒回去证明传输期间一直有效。
- **「关停不等还租约，所以马上就退干净了」**——它还有别的清理动作；确认不了安全时，还会故意留着资源。

## 对照源码

### 怎么开

上半说的三个客户端时钟和两个重试参数都在 `model_loader_extra_config` 里配置，改法见[配置页](rfork-config.md)：还租约总次数 `rfork_lease_release_max_attempts`（默认 3，含首次）、瞬时失败间隔 `rfork_lease_release_retry_interval_sec`（默认 30 秒）、心跳间隔 `rfork_heartbeat_interval_sec`（30 秒）、单次请求超时 `rfork_request_timeout_sec`（10 秒）、来源服务健康检查预算 `rfork_seed_timeout_sec`（5 秒）。[C3][C13] 心跳有效期与租约有效期（各 60 秒）属于示例 Planner，不在客户端配置里。[C8][C9]

### 会报什么错

七个阶段对应的 Session 状态名（定义在 `types.py`，迁移写在 Session 各方法里）[C1]：

| 上半叫法 | 状态名 |
|---|---|
| 已建立 | `INITIALIZED` |
| 已借到 | `LEASED` |
| 待清理 | `CLEANUP_REQUIRED` |
| 已传完 | `TRANSFERRED` |
| 就绪 | `READY` |
| 服务中 | `SERVING` |
| 已收尾 | `FINALIZED` |

还租约的三种客户端判定是 `RELEASED`（200 / 404）、`RETRYABLE`（网络异常、408、429、5xx）、`REJECTED`（400、其他拒绝、重定向）；被拒或耗尽后留下 unresolved lease、清掉延期发布任务，并记录不会广告为 seed。 释放线程在 session RLock 下取 lease 与更新计数，离锁后发请求，再持锁把结果对回同一 lease。 注册与读取仍在 session 锁内，seed 发布及部分清理也含网络动作。[C2]

`start_seed_service` 返回 `STARTED`、`DEFERRED`、`FAILED` 三值，只有 `STARTED` 转成 bool 为真；READY 且 source lease 尚在时保存模型与发布参数并返回 `DEFERRED`。[C4] 释放成功后后台线程调用 `_promote_deferred_seed_locked` 推进延期发布；永久拒绝或重试耗尽则取消延期任务，不会无限自我恢复。[D]

四种 Planner 请求的协议（字段都在 HTTP headers，不在 JSON body）[C6][C7][C12]：

| 调用 | 主要请求头 | 成功响应 / 客户端解释 |
|---|---|---|
| GET `/get_seed` | `SEED_KEY` | 200 的响应头必须有 `SEED_IP`、`SEED_PORT`、`USER_ID`、`SEED_RANK`；404 表示没有可用来源 |
| POST `/put_seed` | 来源的 IP、PORT、RANK 和本次 `USER_ID` | 200/404 视为释放完成；此请求不发送 SEED_KEY，也不代表把自己加入 seed 池 |
| POST `/add_seed` | 自己的 KEY、IP、PORT、TP RANK、`SEED_REFCNT: 0` | 只接受 200；初次发布和心跳共用此接口 |
| POST `/remove_seed` | 自己的 KEY、IP、PORT、TP RANK | 200/404 视为已撤销；属于关闭来源服务，不是 receiver 归还借用 |

`get_seed` 的内容只写进 JSON、没放进预期响应头时，即使 HTTP 200 客户端也会因不完整而放弃。 `SEED_REFCNT: 0` 是客户端固定照发的值，示例 Planner 不拿它算容量，不能当作现场来源必无活动读者的证明。[C11][I]

示例 Planner 在租约过期或查不到匹配 lease 时 `put_seed` 返回 False，再被接口转成 404；身份不匹配也可能落到同一响应。[C10] 工作版没有把所有 400 当幂等成功；生产 Planner 的 404 / 400 语义要按实际响应体、租约关联 ID 与服务端记录解释。[I]

日志中的 `lease=` 是 `USER_ID` 的哈希摘要，便于关联重试而不直接输出凭据。接收端日志与 Planner 日志若使用不同形式的 ID，需要现场建立对应，不能只按报错时间猜。

「释放报错后卡住」要分开看释放线程结果、main 是否结束、是否在加载 draft、其他 rank 是否仍卡在初始化、API 服务是否 ready，不能从单个 HTTP 状态推断进程锁死。[I]

### 开销和什么时候别开

心跳经 `/add_seed` 更新来源健康，只刷新来源记录的 `last_heartbeat_ts`，不碰借用者 lease 的 `leased_at`。 当前客户端未调用 `/renew_seed`，没有 lease renewal；设计文档讨论过续租方案。lease TTL 到期只改变示例 Planner 的容量账本，不会向正在执行的 native read 发出取消信号，短 TTL 可能在旧传输仍进行时再次放出名额。[D]

示例 Planner 的 seed、lease 都存在单进程内存字典中；多副本共享、重启恢复、对活动 reader 的可靠保护属于生产 Planner 的实现责任。[I]

### 版本差异

本页只讲用户确认的 RFork 工作版（`rfork@3284850b`）。统一管租约和生命周期的 `RForkSession`、`types.py`、`planner_client.py` 由工作版补丁 0004 引入，社区 v0.23 / v0.26 / main 都没有这层代码，逐补丁对照见[总览页](rfork.md)的版本差异与[版本维护](rfork-maintenance.md)。

### 源码位置

- 状态与发布结果定义：`types.py`
- 取 lease、注册与传输，session 锁范围：`session.py`
- 异步有界释放、结果分类、重试预算、释放成功后推进延期发布的 `_promote_deferred_seed_locked`：`session.py`
- `start_seed_service` 与 `DEFERRED` 判定：`session.py`
- shutdown：停止信号、停心跳（join 预算取 `rfork_seed_timeout_sec` 与「连接 + 读取 timeout 再加 1 秒」的较大值）、撤销 seed、关 seed HTTP、lease 无未决项时才 finalize；lease unresolved 时保留 TransferEngine 状态，撤销失败保留本地服务供重试，返回 False 不代表清理完成。`self.seed_lease` 是本 session 向外借来的租约，为 None 只证明本地没有未决向外借用；撤销广告与关闭 metadata HTTP 不会取消远端已拿到地址的 native read。[I]
- Planner 客户端：`planner_client.py`，`get_seed` 响应头解析、释放与协议判定、`add_seed` / `remove_seed` 与心跳
- 客户端默认值：`config.py`
- 示例 Planner：`examples/rfork/rfork_planner.py`，两个 TTL 默认值、内存字典存储与 `add_seed` 刷新心跳、`get_seed` / `put_seed` / `remove_seed` 与过期回收、HTTP 路由与 404 转换
