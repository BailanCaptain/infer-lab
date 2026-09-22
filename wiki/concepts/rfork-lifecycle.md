---
id: rfork-lifecycle
title: RFork 生命周期：模型可用、租约归还、成为 seed 是三件事
type: feature
summary: >-
  按工作版 Session 状态解释异步有界释放、延期发布、心跳与租约 TTL、回退和 shutdown。区分 HTTP
  400/404、重试耗尽与真实模型失败，并标出未实现的续租。
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
updated: '2026-09-23'
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

## 一句话

**租约没有释放成功，可以阻止这个 Worker 成为新 seed，却不一定阻止已经装好权重的模型继续启动。** 工作版把释放放到有界重试的后台线程；它不把失败伪装成释放成功，也没有实现自动续租。[C3]

```wiki-diagram
file: rfork-lifecycle
```

## 那条请求能否运行，不能只看 Planner 的最后一行

假设实例 B 已经成功读完权重并完成 eval，Planner 此时对释放返回 400。工作版会留下 unresolved lease、停止对应释放重试、禁止发布 seed；加载器仍可返回模型，B 后续是否真正服务了那条请求要看整体启动结果。

因此“释放报错后卡住”至少要继续区分：释放线程的结果、main 是否结束、是否在加载 draft、其他 rank 是否仍卡在初始化，以及 API 服务是否 ready。不能从单个 HTTP 状态推断进程锁死。[I]

## 七个状态描述本地资源，不是 Planner 的状态副本

| Session 状态 | 本地含义 | 不能据此推断 |
|---|---|---|
| `INITIALIZED` | session 已建立、可准备模型 / 申请来源 | 模型已装好，Planner 一定有 seed |
| `LEASED` | 已拿到 source lease | MR 已注册或权重已读到 |
| `CLEANUP_REQUIRED` | 开始了可能产生注册副作用的操作，或清理未完成 | 此刻一定发生了不可恢复故障；传输开始也会临时进入它 |
| `TRANSFERRED` | 注册、取元数据与读取成功 | 后处理和 seed 发布已结束 |
| `READY` | 完成 seed 准备所需的模型与注册步骤 | 上游租约已释放、自己已被 Planner 发现 |
| `SERVING` | 本地 seed 服务启动、初次上报成功、心跳线程已启动 | 模型 API 服务整体 ready，或未来心跳永远成功 |
| `FINALIZED` | session 的引擎清理成功 | 其他 Worker 或其他 main/draft session 也清完了 |

状态定义见 `types.py`，迁移写在 Session 的各个方法里。`READY` / `SERVING` 是 RFork 的 seed 生命周期用语，不是 vLLM HTTP 服务统一的就绪信号。[C1]

## 一个 lease 只交给一个释放线程，网络请求在锁外进行

成功传输把状态置为 TRANSFERRED 并安排后台释放，启动线程不等待本次 HTTP release。释放线程在 session RLock 下取 lease 与更新计数，离开锁后发请求，再持锁把结果对应回同一 lease。[C3]

| 结果 | 客户端判定 | 后续动作 |
|---|---|---|
| HTTP 200 / 404 | `RELEASED` | 清掉 lease，尝试推进延期 seed 发布 |
| 网络请求异常、408、429、5xx | `RETRYABLE` | 在次数预算内等待后重试 |
| 400、其他拒绝、重定向等 | `REJECTED` | 立即停止，不等用完次数 |

默认总共 3 次，包含第一次请求，瞬时失败间隔 30 秒——这两个数是[配置页](rfork-config.md)讲的 `rfork_lease_release_max_attempts` 与 `rfork_lease_release_retry_interval_sec` 的默认值，配置里改了这里就跟着变。永久拒绝或耗尽预算后保留 unresolved lease、清掉延期发布任务，并记录不会广告为 seed；不因这一结果重载有效权重。[C3][C13]

“释放网络请求不持 session 锁”是一个有范围的保证。注册和读取仍在 session 锁内进行，seed 发布及部分清理也包含网络动作；不能推广成所有线程路径绝不阻塞。[C2]

## 404 是客户端接受的协议结果，不是过去一直安全的证明

先按请求方向辨认协议：下表的字段都放在 **HTTP headers**，不是自行猜测的 JSON body；同样一个 404，在不同接口中含义不同。[C6][C7][C12]

| 调用 | 主要请求头 | 成功响应 / 客户端解释 |
|---|---|---|
| GET `/get_seed` | `SEED_KEY` | 200 的响应头必须有 `SEED_IP`、`SEED_PORT`、`USER_ID`、`SEED_RANK`；404 表示没有可用来源 |
| POST `/put_seed` | 来源的 IP、PORT、RANK 和本次 `USER_ID` | 200/404 视为释放完成；此请求不发送 SEED_KEY，也不代表把自己加入 seed 池 |
| POST `/add_seed` | 自己的 KEY、IP、PORT、TP RANK、`SEED_REFCNT: 0` | 只接受 200；初次发布和心跳共用此接口 |
| POST `/remove_seed` | 自己的 KEY、IP、PORT、TP RANK | 200/404 视为已撤销；属于关闭来源服务，不是 receiver 归还借用 |

`get_seed` 的响应内容若只写进 JSON、没放进预期响应头，即使 HTTP 200，客户端也会因不完整而放弃。[C12] `SEED_REFCNT: 0` 是客户端每次都照发的固定值，示例 Planner 收下后也不拿它算容量（容量由 Planner 自己的配置决定），所以它不能当作现场来源必无活动读者的证明。[C11][I]

**下面这段是示例 Planner 的口径，不是协议要求。** 示例 Planner 在租约过期或查不到匹配 lease 时，`put_seed` 返回 False，再被接口转成 404；包括身份不匹配的失败也可能落在同一个响应。因此客户端接受 404，最多说明按当前协议把释放视为完成，不能证明它在传输结束前没有超时。[C10][C11]

生产 Planner 如果用 404 表示其他错误，或用 400 表示 userID 不存在，不能直接照搬示例的解释。工作版没有把所有 400 当幂等成功；应保留实际响应体、租约关联 ID 和服务端记录，再解释现场原因。[C6][I]

日志中的 `lease=` 是 USER_ID 的哈希摘要，便于关联重试而不直接输出凭据。接收端日志与 Planner 日志若使用不同形式的 ID，需要现场建立对应，不能只按报错时间猜。

## 心跳、租约有效期、客户端超时：各走各的几个时钟

| 时钟 | 谁维护 | 工作版 / 示例默认值 | 作用 |
|---|---|---|---|
| 心跳等待间隔 | seed 客户端 | 30 秒 | 上一次 HTTP 心跳结束后再等，不是固定频率定时器 |
| heartbeat TTL | 示例 Planner | 60 秒 | 来源长时间未上报，就从候选池清掉 |
| lease TTL | 示例 Planner | 60 秒 | 借用超期后回收容量点 |
| request timeout | RFork 客户端 | 10 秒 | 单次 HTTP 的连接/读取等待限制，不是整个业务流程的硬截止时间 |
| seed 健康检查预算 | RFork 客户端 | 5 秒 | 启动本地 seed 服务时等它答健康检查；shutdown 时心跳线程的 join 预算也以它作下界 |

客户端这三个数（30 / 10 / 5 秒）是 `rfork_heartbeat_interval_sec`、`rfork_request_timeout_sec`、`rfork_seed_timeout_sec` 的默认值，可在 `model_loader_extra_config` 里改，改法见[配置页](rfork-config.md)；两个 TTL 属于示例 Planner，改客户端不会动它们。心跳通过 `/add_seed` 更新来源健康，只刷新来源记录的 `last_heartbeat_ts`，不碰借用者 lease 的 `leased_at`。[C8][C9][C13]

**当前没有 lease renewal。** 设计文档讨论了续租方案，但现有客户端未调用 `/renew_seed`。lease TTL 到期只改变示例 Planner 的容量账本，没有向正在执行的 native read 发出取消信号。短 TTL 可能在旧传输仍进行时再次放出名额。[C10][D]

## 延期发布时，模型和注册资源仍由 session 持有

`start_seed_service` 返回三个值：STARTED、DEFERRED、FAILED。若模型和注册已经 READY、source lease 尚在，就保存模型与发布参数，返回 DEFERRED；只有 STARTED 转成 bool 才是真。[C4]

释放成功后，后台线程尝试 `_promote_deferred_seed_locked`。若 release 被永久拒绝或重试耗尽，延期任务取消，不会无限循环自我恢复。也就是说，DEFERRED 只承诺“释放成功就接着发布”，不承诺释放一定成功；要查明 Planner 状态后再决定运维恢复方案。[D]

## shutdown 不等租约 I/O，但也不承诺立即释放所有内存

shutdown 先发停止信号，不启动新的释放请求，也不等待释放线程中的 HTTP。随后停止心跳，尝试撤销 Planner 上的 seed 广告，关闭本地 seed HTTP 服务；服务成功停止且 lease 已无未决项时才 finalize 引擎。[C5]

心跳的 join 有单独等待预算——取「`rfork_seed_timeout_sec`」与「连接 + 读取两段 timeout 再加一秒宽限」里的较大值，上面时钟表里那 5 秒就是它的下界；撤销 seed 失败时保留本地服务供重试。lease unresolved 时保留 TransferEngine 状态，依赖在途请求的确认或 Planner 侧回收策略处理租约。不能把函数返回 False 当成“清理已完成”。[C5]

示例 Planner 的 seed、lease 都存在单进程内存字典中。多副本是否共享状态、重启如何恢复、如何对活动 reader 做可靠保护，属于生产 Planner 的实现责任；本章没有拿这个 Python 示例替代现场服务的契约。[C9][I]

这里的 `self.seed_lease` 是**本 session 向别的来源借来的租约**，不是其他接收端正在借用自己的租约集合。它为 None，只证明本地没有未决的向外借用；撤销广告只阻止后续发现，关闭 metadata HTTP 也不会自动取消已拿到地址的远端 native read。安全退出仍依赖传输引擎的清理契约与现场 reader 排空机制，不能仅从本地状态推导“远端都读完了”。[C2][I]

## 常见误解

- **“心跳正常，租约就不会过期”**——健康上报和借用有效期各自计时。
- **“收到 404 说明按时归还了”**——它可能已被回收，成功响应不能追溯证明传输期间有效。
- **“shutdown 不等 release，所以马上就退干净”**——它仍有其他清理动作；无法确认安全时还会保留资源。
