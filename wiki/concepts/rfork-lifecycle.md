---
id: rfork-lifecycle
title: RFork 生命周期：传完权重、交出模型、当上 seed、接请求各是一步
type: feature
summary: >-
  B 的一个 Worker 借完权重后，传完、交出模型、还上租约当 seed、整个实例接请求是四个时刻。讲会话八个状态（含先登记的 REGISTERED）、还租约快慢重试与 400/404
  各说明什么、可选 LEASE_TTL_SEC 周期续租、发布 seed 的已启动/延期/失败、回退清理与关停留下什么。
aliases:
  - RFork 生命周期
  - RForkSession
  - RForkLifecycleState
  - LeaseReleaseResult
  - RForkSeedServiceStartResult
  - RForkFallbackCleanupResult
  - can_schedule_seed
  - RFork 租约归还
  - RFork lease release outcome
  - RFork DEFERRED
  - RFork lease release rejected
  - RFork lease remains unresolved
  - RFork seed promotion
  - RFork put_seed
  - RFork TTL
legacyAnchors:
  会话的七个状态每个只说明本机这一侧: 会话的八个状态每个只说明本机这一侧
  五个钟各管各的现在没有续租: 五个钟各管各的可选周期续租
chapters: []
order: 80
sources:
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/types.py#L14-L120'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L115-L276'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L289-L445'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L490-L659'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L660-L864'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/planner_client.py#L196-L287'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/planner_client.py#L289-L391'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L40-L80'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L135-L206'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L207-L339'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L475-L567'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/planner_client.py#L137-L195'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/config.py#L11-L16'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L153-L204'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L858-L957'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/rfork.md#L275-L380'
  - 'vllm-ascend@2c59ff10:vllm_ascend/model_loader/rfork/rfork_worker.py#L102-L108'
  - 'vllm-ascend@2c59ff10:vllm_ascend/model_loader/rfork/seed_protocol.py#L157-L187'
  - 'vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/rfork_loader.py#L393-L405'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L75-L114'
  - >-
    raw:sha256-cf79cda8c5def129ae408d6c21bc35fa1f20df5d244b4aa3485fb569d08ba6ed.md#L1-L1300
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/planner_client.py#L117-L245'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/session.py#L149-L188'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/session.py#L261-L364'
verified:
  - main
evidence: C
relations:
  - to: rfork-transfer
    kind: builds-on
    note: 最后一次同步读成功后才进入 TRANSFERRED；会话结束不能只清掉 Python 状态，还要确认服务与传输内存的清理条件
  - to: rfork
    kind: builds-on
    note: 总览里借权重的八步走完以后，这页接着讲第 8 步之后各件事什么时候算数
  - to: rfork-startup
    kind: builds-on
    note: 回退怎么拆模型、从存储重读在启动页；这页只讲清理结果怎样决定能不能回退、回退后还能不能当 seed
contradicts: []
updated: '2026-11-19'
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
  - >-
    raw/sha256-cf79cda8c5def129ae408d6c21bc35fa1f20df5d244b4aa3485fb569d08ba6ed.md
---

## B 的权重传完了，它算「起来了」吗

RFork 让新实例 B 的每个 Worker 向已经在跑的实例 A 借权重：先从外部的 Planner 服务领一张**租约**（一次借用名额，附带一个借用编号），再按地址把 A 显存里的权重读过来，八个步骤见[总览](rfork.md#借一次权重b-的每个-worker-走哪几步)。读完以后，「起来了」至少要拆成四件事，它们在不同的时刻成立：

1. **权重传完**：这个 Worker 列出的读取全部成功返回。
2. **交出模型**：加载器把装好权重、切到推理模式的模型交回 vLLM。
3. **当上 seed**：借来的租约还上以后，B 起自己的元数据服务、到 Planner 登记，下一个实例就能向 B 借。
4. **接请求**：B 的所有 Worker 都做完加载之后的准备，API 服务开始收 HTTP 请求。

**RFork 生命周期**说的就是一个 Worker 上这几件事的先后，以及中途失败、进程退出时怎样清理。替它记账的是**加载会话**（RForkSession）：每个 Worker 的主模型一份，投机解码的草稿模型（draft）另一份。会话手里拿着租约、登记给传输引擎的显存、对外提供权重清单的 seed 服务，还有还租约、发心跳两个后台线程，并用一个状态记下自己走到了哪一步。

举个例子。B 的某个 Worker 读完权重，后台去 Planner 还租约，Planner 这次回了 503（服务暂时不可用）。启动不会停下来等：模型照样交出去，vLLM 接着量显存、切 KV cache 块、捕获图；「当 seed」先记成**延期**。30 秒后后台再还一次，Planner 回 200，这个 Worker 才起服务、去登记。这半分钟里，B 的启动一直在往前走，甚至整个实例已经开始接请求，但别人还借不到它。

```wiki-diagram
file: rfork-lifecycle
```

图里模型线不等别的线，只管把模型交出去；「当 seed」那条线从交出模型之前的那次发布分出来，要等租约了结，租约早已确认的话，seed 服务会在交出模型之前就起来；失败那条线先清理，清干净才回退到从存储读。

## 为什么要拆开：还租约不能拖住启动，没还清又不能当 seed

「延期」来自两条规矩同时成立：

- **还租约不占启动的时间。** 还租约是发往 Planner 的一次 HTTP 请求，Planner 忙或网络慢时要等、要重试。早期版本由启动线程自己同步去还，Planner 那边一卡，整个 Worker 的启动就跟着卡。现在传完以后把这件事交给后台线程，启动线程接着做后处理、交模型。
- **借来的账没了结，不对外当来源。** 会话还拿着一张没还上的租约时，代码直接拒绝起 seed 服务；当前代码只认确认过的归还（Planner 回 200 或 404）。于是 Planner 账上的 B 要么还是一笔没了结的借用，要么已经是可借的来源，两样不会同时成立。

代价也有两个。第一，**当 seed 会晚，甚至当不上。** 还租约至少要等一次 HTTP 往返；遇到 503 这类临时错误，默认先按 30 秒间隔快速尝试 3 次，之后转入至少 60 秒间隔的慢速重试，直到确认还上、被永久拒绝或进程关停。只有 Planner 明确拒绝（如 400）或关停时才会永久取消延期发布。第二，**「起来了」不能只看一个信号**，四件事要分别拿证据，见[四件事分开验收](#四件事分开验收)。

## 会话的八个状态：每个只说明本机这一侧

一个会话从建好开始，大体按下表从上往下走。每个状态只记本机这边的资源走到了哪一步，读的时候最容易多推一步：

| 状态 | 什么时候进来 | 不能据此推断 |
|---|---|---|
| 已建立（`INITIALIZED`） | 会话刚建好；或者清理干净、手里也没有租约 | 模型已经装好；Planner 上有可借的来源 |
| 已登记（`REGISTERED`） | 目的显存登记完成并绑定结构摘要，等待向 Planner 申请租约 | 已经拿到租约或开始读取权重 |
| 已借到（`LEASED`） | 从 Planner 拿到租约（若有 `LEASE_TTL_SEC` 则已起续租线程） | 权重已经读到 |
| 待清理（`CLEANUP_REQUIRED`） | 开始登记、开始读权重、开始起服务或清理未干净时 | 一定出了没法恢复的故障——正常执行阶段也会经过这个状态 |
| 已传完（`TRANSFERRED`） | 取清单、核对与分批读权重全部成功，已安排后台归还 | 后处理已经做完；租约已经还上 |
| 就绪（`READY`） | 当 seed 要用的模型和显存登记都备好了 | 租约已经还上；Planner 已经能找到自己 |
| 服务中（`SERVING`） | seed 服务起来、心跳线程已启动（首次上报遇暂态错误也会先进入 `SERVING` 由心跳重试） | 整个 API 服务就绪；之后每次心跳都成功 |
| 已收尾（`FINALIZED`） | 进程退出时服务与传输引擎成功关闭（含兼容旧无 TTL 租约时的尾次归还尝试） | 同一进程里另一个会话（主模型或草稿）也收尾了 |

「就绪」「服务中」只说 RFork 自己「当 seed」这件事走到了哪，不是 vLLM 的就绪信号。另有三处细节：

- **进「就绪」前要不要重新登记显存，看传的是哪种布局。** 走「转好布局再搬」的模型（开了量化、权重 NZ 模式为 2 或硬件要求 NZ）传的是后处理之后的最终布局，传完时登记的就是最终地址，直接进「就绪」。走「按原形状搬」的模型传的是原始布局，传完还要跑后处理，后处理会换掉一部分存储，所以要按最终的张量重新登记一遍；回退路径从存储读出的模型也一样。重新登记的这段时间会话又处在「待清理」，登记失败就注销、报「失败」，模型照样推理。两种布局的区别见[布局页](rfork-layout.md)。
- **心跳遇暂态错误会继续后台重试**，状态保持「服务中」；若 Planner 返回永久拒绝（`REJECTED`）或本机 seed 服务退出，心跳线程停止并切到「待清理」，再按开关尝试撤回登记。
- **停掉 seed 服务以后回到「就绪」**；停不干净就停在「待清理」，显存登记继续留着。

## 按时间走一遍：传完到当上 seed，中间几条线程各干各的

把开头那个例子配上示意数，按时间排开。传完的那一刻记作 0 秒：会话进入「已传完」，同时停止续租线程并起一条还租约线程；启动线程不等它，跑完后处理、切到推理模式，第 3 秒去发布 seed，发现租约还在手里，就把模型和发布参数存进会话、返回「延期」，然后把模型交出去。

```wiki-diagram
file: rfork-lifecycle-threads
```

还租约线程这边的时间线如下（示意秒数，现场以日志为准；启动线程第 `3` 秒就交出了模型，没等这 `36` 秒）：

| 时刻（示意） | 事件与算式 | 累计时刻 |
|---|---|---|
| 第 1 次还租约 | $0\text{ 秒}$ 发出，耗时 $2\text{ 秒}$ 收到 `503` | $2\text{ 秒}$ |
| 第 2 次还租约 | $2 + 30\text{ 秒}$ 快速重试间隔 | $32\text{ 秒}$ |
| 确认还上 | $32 + 2\text{ 秒}$ 往返，Planner 回 `200` | $34\text{ 秒}$ |
| 进入服务中 | $34 + 2\text{ 秒}$ 起服务并首次登记 | $36\text{ 秒}$ |
| 第一次心跳 | $36 + 30\text{ 秒}$ 心跳间隔 | $66\text{ 秒}$ |

注意两点：发布 seed 是在**还租约线程里**接着做的，不是启动线程回头去做；心跳线程起来后先等满一个间隔才报第一次平安，因为首次登记刚刚报过。

## 还租约：一个后台线程，三种结果

权重传成功后，会话先停掉续租线程，再为这张租约起一条后台归还线程，**一张租约同时只有一条**：线程还活着、或者这张租约已被永久拒绝，就不再起新的。线程每一轮这样做：

1. 拿会话锁，取出要还的租约，把次数加一；
2. **放开锁**，向 Planner 发一次归还请求；
3. 拿回锁，先确认会话里还是同一张租约，再按结果处理。

| Planner 的回应 | 客户端怎么认 | 接下来 |
|---|---|---|
| 200 或 404 | 已归还（`RELEASED`） | 清掉租约；有延期的发布，就接着做完 |
| 网络出错、408、429、5xx | 可以再试（`RETRYABLE`） | 前 3 次按配置间隔（默认 30 秒）快速重试，之后转入至少 60 秒间隔的慢速重试，直到确认还上、被拒或关停 |
| 400、其他状态、重定向；请求前的准备出错；线程里抛了异常 | 被拒（`REJECTED`） | 立即停，取消延期发布 |

快速重试次数（默认 3，含第一次）和快速重试间隔（默认 30 秒）都能在[配置页](rfork-config.md)里改；超过快速次数后，暂态失败不再放弃，而是自动降频到 `max(配置间隔, 60 秒)` 继续重试。重定向不跟随，直接算被拒。

被拒（`REJECTED`）以后：租约留在「没了结」状态；延期的发布任务被取消；日志写明这张租约没了结、不会把自己登记为来源、模型加载和推理可以继续。**已经装好的权重不会重新加载，已经登记的显存也不会因此注销**，一直留到进程退出时的收尾。

还有三点容易漏：

- **不占锁的只有这一段网络请求。** 登记显存、读权重仍然是在会话锁里做的；登记来源、撤销登记这些动作也包含网络请求。不能推广成「任何时候都不会被堵住」。
- **同一个会话再去借时，先看旧账。** 同一套加载配置再走一次 RFork 加载会复用会话；这时如果上一张租约的线程还活着、上一张租约已经停止重试，或者手里还留着没还的旧租约（这时会先补起一条还租约线程），会话这次直接不借，请求根本没发到 Planner，日志看上去和「没有可用来源」一样，见[启动页](rfork-startup.md)。
- **日志里的「被拒」警告不等于最终结果。** 只要回应不是 200 或 404，客户端都会先打一条带状态码和响应体开头的警告，措辞是「被拒」，503 也一样；这张租约最后算哪一类，看紧跟着的那条「归还结果」日志。原文见[会报什么错](#会报什么错)。

## 400 和 404 各说明了什么

B 和 Planner 之间一共四种请求，参数都放在 HTTP 请求头里，不在 JSON 正文里。同样一个 404，在不同请求里意思不一样：

| 请求在做什么 | 客户端怎么认 |
|---|---|
| 找一个可借的来源 | 200 且响应头带齐来源地址、端口、借用编号、rank 才算借到；404 是没有可用来源 |
| 归还借来的租约 | 200 和 404 都当作还完了；这个请求不会把自己加进来源池 |
| 登记自己为来源、发心跳 | 只认 200；首次登记和之后的心跳用同一个接口 |
| 撤销自己的来源登记 | 200 和 404 都当作撤销了；这是来源关服务时用的 |

找来源时，Planner 就算回了 200，该放在响应头里的字段如果只写在了 JSON 正文里，客户端也会因为信息不全而放弃。登记来源时客户端每次都带一个固定的「当前借用人数 0」，示例 Planner 收下也不拿它算名额，所以它**不能**证明这个来源此刻没人在读。

**404：只能算「按约定当作还了」。** 仓库自带的示例 Planner 在处理归还时，先把已经过期的租约清掉，再查这次的借用编号：查不到、或者来源身份对不上，都回 404。所以客户端接受 404，只说明这次归还按当前约定算完成，**不能证明传输期间租约一直有效**。工作版的设计文档专门提过：这会把「租约早就过期、名额已经放回去」藏起来，启动照样显示成功。

**400：本身不能证明租约过期。** 理由来自三处：

1. 示例 Planner 里，过期的租约走的是上面那条 404；400 只在请求头缺字段、或者端口和 rank 取值不合法时出现。
2. 现场用的是另一个 Planner。设计文档记录过一次现场：权重传完以后，还租约收到 400，但当时的日志没有留下响应体；另外拿一个编造的借用编号去试，得到的回复是「找不到这个编号」。这只说明那个 Planner 怎样回应不存在的编号，说明不了真实那次失败的原因。
3. 就算现场的 400 意思是「编号找不到」，找不到也不只过期一种来源，身份对不上、请求落到另一份内存状态、Planner 重启过都会造成同样的结果。

所以看到 400，要拿实际响应体、这张租约的日志编号、从借到起算的持有时长，和 Planner 那边的记录一起对，排查顺序见[排错页](rfork-troubleshooting.md)。工作版没有把所有 400 都当成「已经还过了」，这是有意的：把它改判成功，会把真实的账目问题藏起来。

## 五个钟各管各的，可选周期续租

**TTL**（Time To Live，有效期）指一条记录从起算到被自动作废的时长。RFork 里同时走着好几个钟，谁也不替谁计时：

| 钟 | 谁在计 | 默认值 | 管什么 |
|---|---|---|---|
| 心跳间隔 | 来源这边的客户端 | 30 秒 | 上一次心跳请求结束后再等这么久，不是固定频率的定时器 |
| 心跳 TTL | 示例 Planner | 60 秒 | 来源太久没报平安，就转入 draining 停止分配新租约 |
| 租约 TTL | 示例 Planner | 60 秒 | 从发出租约（或最近续租）起算，到点把名额收回 |
| 单次请求超时 | RFork 客户端 | 10 秒 | 一次 HTTP 的连接、读取各等多久，不是整件事的截止时间 |
| seed 服务健康检查 | RFork 客户端 | 5 秒 | 起 seed 服务时等它应答的时间 |

客户端这三个数能在配置里改；两个 TTL 是示例 Planner 自己的，客户端改不动。心跳只刷新「这个来源最近一次报平安的时间」，**不碰借用方租约的起算时间**——来源的心跳正常，不等于借来的租约不会过期。

**当前 `main` 主基线已支持可选续租与慢速归还重试。** 当 Planner 在 `GET /get_seed` 响应头中返回有限正数 `LEASE_TTL_SEC` 时，会话会自动启动 `RForkLeaseRenewal` 后台线程，每等待 `clamp(TTL / 3, 0.1, 30.0)` 秒调用一次 `POST /renew_seed_lease` 续期（例如 TTL = 60 秒时每等 20 秒续一次），并在传输结束进入后台归还或关停时立即停止；若旧 Planner 不返回 `LEASE_TTL_SEC`，则保持兼容不启动续租线程，关停时做一次有界尾次归还尝试。后台归还遇到暂态失败（网络异常、408、429、5xx）时，先按配置的快速次数（默认 3 次）和间隔（默认 30 秒）重试，之后转入至少 60 秒间隔的慢速重试，直到 `RELEASED`、`REJECTED` 或关停；`REJECTED` 仍立即停止并取消延期发布。撤回来源（`POST /remove_seed`）默认关闭，由 `rfork_seed_removal_supported`（`false` / `true` / `null` 自动探测）控制，示例 Planner 在仍有活跃租约时回 409（draining）而不直接删掉正在使用的租约。

## 发布 seed：已启动、延期、失败

模型交出之前，加载器会请会话「发布 seed」。会话按下面的顺序检查，结果只有三种：

1. 进程已经在关停 → **失败**。
2. 已经在「服务中」→ **已启动**（重复调用不出错）。
3. 手里有租约，而且它已经停止重试 → **失败**。
4. 状态不在「已建立、已借到、已传完、就绪」之内，比如还停在「待清理」→ **失败**。
5. 还没到「就绪」：按需要重新登记显存（见上面[八个状态](#会话的八个状态每个只说明本机这一侧)的第一条细节），成功就进「就绪」，失败就注销、报**失败**。
6. 租约还在手里 → 存下模型和发布参数，确认还租约线程在跑，报**延期**。
7. 都不是 → 真正去发布：算端口、起 seed 服务、到 Planner 首次登记、起心跳线程，全部成功就进「服务中」、报**已启动**，否则报**失败**。

只有「已启动」算成功。拿到「延期」时，会话自己打一条「发布延后、模型照常可用」的警告，加载器只当这次没起来；拿到「失败」，打一条「模型已经就绪、seed 服务没起来、推理可以继续」的警告；发布过程抛了异常，则打一条带堆栈的错误日志，说 seed 服务启动出了异常、推理可以继续。**两种情况都照样把模型交出去。**

第 7 步失败时（比如端口绑不上、Planner 不收首次登记），会话先停服务、撤登记；停干净了，就把这次的显存登记也注销掉；停不干净就留在「待清理」，显存继续登记着。端口怎么算、什么时候会撞见[配置页](rfork-config.md#四类端口谁监听谁来连由什么决定)。

延期的发布在租约确认还上以后，由还租约线程接着做，过程同第 7 步；失败或抛异常只记警告，模型照样推理。延期期间，模型和已登记的显存都还由这个会话拿着。「延期」只承诺**还上了就接着发布**，不承诺一定还得上：归还被拒、次数用完或者进程开始关停，延期任务都会被取消，不会无限地自己恢复。

## 中途失败：清理结果决定能不能回退、回退后能不能当 seed

传输中任何一步失败，或者根本没借到，加载器都先请会话「为回退做准备」，拿回一份**清理结果**，里面有三项：

| 项 | 成立的意思 |
|---|---|
| 服务停了 | seed 服务和心跳都停下，Planner 上的登记已撤掉 |
| 租约还了 | 手里没有没还的租约 |
| 显存注销了 | 这次登记给传输引擎的显存都注销了 |

三项都成立才算「全部干净」。但「能不能继续回退」只看**服务**和**显存**两项：租约是在后台还的，准备回退时如果还没还上，会话只确保还租约线程在跑，不要求此刻已经还上。加载器最多做两轮准备；两轮之后服务或显存仍没清干净，就直接报错、拒绝回退，因为旧权重还被登记钉在显存里，再分配一份模型就是两份权重同时占卡。回退还要清哪些全局登记、怎样从存储重读，见[启动页](rfork-startup.md#借不到或读失败先拆干净再从磁盘重来)。

回退加载成功后，同一个会话会再发布一次 seed，日志里把来源记为回退。这时会话处在「已建立」或「已借到」，要先按从存储读出的模型重新登记显存、进「就绪」，然后看手里的租约：

- **没借到就回退的**：手里本来就没有租约，直接发布，成功就是「已启动」。没有任何来源时，第一个实例走的就是这条。
- **借到了、读到一半失败的**：那张租约在准备回退时交给了后台去还。从存储重读要花一段时间，读完时归还已经确认，就直接发布；还没确认就「延期」，等后台确认后再发布；归还被拒，这次就当不上 seed。

会话没建起来时，回退加载完也不会去发布。

## 关停：进程退出时才收尾，返回「没清完」就是没清完

会话建好时，把自己的收尾函数挂到了进程退出的钩子上，所以这里的「关停」指 Worker 进程退出的那一刻。收尾按这个顺序：

1. 发停止信号：不再发起新的还租约请求，也不等正在进行的那一次；延期的发布直接取消。
2. 停心跳线程，等它退出。
3. 到 Planner 撤销自己的来源登记（自己最多试 3 次，两次间隔 0.1 秒、0.2 秒），再关掉本机的 seed 服务。
4. 前面都干净、而且手里没有没还的租约，才关闭传输引擎，进「已收尾」。

心跳线程这时也许正等着一次登记请求的回应，而单次请求超时对连接和读取各算一次，所以等它退出的上限取「健康检查时间」和「连接超时 + 读取超时 + 1 秒」里较大的那个。按默认值（连接 `10` 秒、读取 `10` 秒、余量 `1` 秒、健康检查下限 `5` 秒）：

$$\text{等待上限} = \max(5,\ 10 + 10 + 1) = \max(5,\ 21) = 21\text{ 秒}$$

其中 `5` 秒只是下限；过了 `21` 秒上限心跳线程还没退，就算没停干净，资源留着。

收尾函数返回「没清完」时，留下的东西各有原因：心跳没停下或撤销登记失败，本机 seed 服务和显存登记都留着，方便再试；租约没了结，传输引擎的状态留着，正在路上的那次归还还会不会收到确认要看那次请求，否则只能靠 Planner 那边的过期回收；关闭传输引擎没成功，也一样留着。**返回「没清完」不能当成「清理已完成」。**

还有两处容易看反：

- 会话里记的租约，是**本机向别的来源借来的那一份**，不是「别人正在向我借」的租约。它为空，只说明本机没有没还的外借。撤销来源登记只挡住以后的发现；关掉提供清单的 HTTP 服务，也不会取消远端已经拿到地址、正在进行的读取。能不能安全退出，要看传输引擎的清理约定，以及现场有没有先把正在读的借用方排空，不能单凭本机状态推出「远端都读完了」。
- 示例 Planner 把来源和租约都放在单个进程的内存里。多副本之间共不共享、重启以后怎么恢复、怎样可靠地保护正在读的借用方，是现场 Planner 自己要负责的事，不能拿这个 Python 示例当现场服务的约定。

## 四件事分开验收

[总览](rfork.md#成功至少有四种不能压成一个开关)列了几种「成功」各自证明什么。落到验收上，按下面的顺序一件一件拿证据，而且**每个会话都要有**：一个 Worker 有主模型、草稿两个会话，各自一套。

| 要验收的事 | 拿什么证据 | 拿到了也还没证明 |
|---|---|---|
| 传输：权重都读到了 | 「权重传完」那行的块数、批数、GiB、吞吐，加上登记、取清单、读取的分段耗时 | 后处理、发布已经做完 |
| 加载：模型从这条路交出 | 「登记加传输用了多少秒」那行，且没有「传输失败、回退」的警告 | 输出和默认加载一样 |
| 发布 seed：能被借了 | 「seed 服务已启动」那行带端口，Planner 上查得到这条登记 | 之后心跳一直成功；下一个实例一定配得上 |
| 可服务：能接请求了 | API 服务的健康检查正常，一条真实请求能出结果 | 每个 Worker 都当上了 seed |

前两件说的是「权重从哪来」，后两件分属「能不能被借」和「能不能用」，任何一件都推不出另一件。输出是否和默认加载一致，要用同一个模型、同样的输入和采样设置去比，见[传输页](rfork-transfer.md)。

## 放到 GLM 双机：一次热启动是 32 个会话各走各的

先交代前提：官方 GLM 双机教程的启动命令没有开 RFork；社区上游 `vllm-ascend@8d6180e2` 已包含 GLM-5.3-Flash 的模型实现（`vllm_ascend/models/glm5next/` 下的 `Glm5NextForCausalLM` / `Glm5NextForConditionalGeneration` 与 `Glm5NextMTP`）及官方部署教程（`docs/source/tutorials/models/GLM5.3-Flash.md`），但该教程与上游 RFork 官方指南尚未给出专用的 GLM-5.3-Flash RFork 配方或验收记录（且官方指南提示 `Glm5NextMTP` 暂未纳入自动 checkpoint 归属恢复）。同时本站 GLM 双机 W8A8 历史算例钉在固定镜像 `db701c1f`，因此这一节是按「命令里加上 RFork 加载、再起一个同构实例」把上游 `main@8d6180e2` 加载器机制与 GLM 双机拓扑放在一起推演的，不是现有部署的实测行为，详见[总览](rfork.md#这套部署现在能不能受益)。

GLM 双机是一个实例跨两台机器、16 张卡，TP8、DP2、EP16、W8A8，前提见[部署前提](glm-5-3-flash-two-node.md#部署前提)。如果再起一个同构实例 B 向它借，每张卡的主模型和 MTP 草稿模型各有一个会话，一共 32 个会话、32 张租约，谁向谁借见[总览](rfork.md#谁向谁借16-个-worker-各借各的主模型和草稿模型各一套)。生命周期也是 32 份，各自独立：各有一条还租约线程，各自决定要不要延期，当上 seed 以后各起一个 seed 服务、各有一条心跳线程。

全部当上 seed 以后，按默认 `30` 秒心跳间隔，Planner 收到的平安报告频率为：

$$\text{seed 服务个数} = 16\text{ 张卡} \times 2\text{（主模型、草稿）} = 32\text{ 个}, \qquad \text{折合频率} = \frac{32}{30\text{ 秒}} \approx 1.07\text{ 次/秒}$$

因为每次心跳请求结束后才开始等下一个间隔，实际频率会略低于 $1.07\text{ 次/秒}$。

固定了 seed 端口基数时，当前主线采用双槽公式 `base + 2 × global_rank + slot`（主模型槽 0、草稿槽 1），同一张卡上主模型与草稿不再撞号；即使端口被占用（`EADDRINUSE`）也会自动退回系统随机端口，见[配置页](rfork-config.md#固定端口基数怎样按主草分槽)。

**同一张卡上，草稿会话在主模型交出之后才开始。** RFork 的登记、传输、发布都在加载模型的那一次调用里做完，草稿模型要等主模型那次调用返回以后才开始加载。所以主模型的还租约线程在后台跑的同时，草稿会话正在借自己的那份（每卡约 844 MiB，主模型约 20.09 GiB，字节账见[总览](rfork.md#每张卡读多少读的字节和常驻的权重是两本账)）。两份都交出以后，这张卡才去量显存、切 KV cache 块、捕获图；API 服务要等两个 DP 组、两台机器的 16 张卡都做完这些才开始接请求。

**登记的显存在当 seed 期间一直钉着。** 归还被永久拒绝的会话也一样，登记要到进程退出才撤。登记会保住被登记张量的存储，大部分本来就是模型在用的权重，不多占；多占的是本该释放却放不掉的那部分，比如草稿后来改用主模型同名张量以后，它自己那两份词表张量。KV cache 预算是在加载之后量的，放不掉的这部分就直接少算进 KV 预算，估算见[总览](rfork.md#这套部署现在能不能受益)。

**现在只有一个实例。** 如果给它开了 RFork，第一次冷启动时 Planner 上没有来源，32 个会话都走回退，从存储读完以后手里没有租约，直接发布，这个实例就成了以后扩副本的来源。从交出模型到 API 可服务、从借到到当上 seed 各要多久，目前没有实机记录，要收集的日志列在页末。

## 常见误解

- **「日志说 seed 服务已启动，这个实例就能接请求了。」** 发布 seed 和 API 可服务是两件事：前者只说明这个会话能被借，后者要等全部 Worker 做完加载之后的准备。
- **「延期就是模型不可用。」** 延期的是「当 seed」，模型照样交出、照样推理。
- **「心跳正常，租约就不会过期。」** 报平安和借用各自计时，心跳不碰租约的起算时间；需要续期时应由 Planner 返回 `LEASE_TTL_SEC` 并配合 `/renew_seed_lease`。
- **「收到 404 说明按时还上了。」** 租约可能早就被回收了；这个回应不能倒回去证明传输期间一直有效。
- **「收到 400 说明租约过期了。」** 示例 Planner 里过期回的是 404；现场 Planner 的 400 对应什么，要看响应体和服务端记录。
- **「还租约被拒，显存就释放了。」** 被拒只取消发布，登记的显存留到进程退出。
- **「还租约报错以后日志不动了，是还租约把进程锁死了。」** 还租约的网络请求不占会话锁。要分别看还租约线程的结果、主模型加载结束没有、是不是正在加载草稿、其他 rank 是否还卡在初始化、API 服务起来没有，单凭一个 HTTP 状态码推不出锁死，见[排错页](rfork-troubleshooting.md#卡住了必须拿到每个线程每个-rank-的实际位置)。
- **「关停不等还租约，所以马上就退干净了。」** 它还有别的清理动作；确认不了安全时，会故意留着资源。

## 对照源码

### 怎么开

本页的机制没有单独的开关，用 `--load-format rfork` 走 RFork 加载器就生效。和生命周期有关的客户端设置写在 `--model-loader-extra-config` 里，写法见[配置页](rfork-config.md)：

| 键 | 默认 | 管什么 |
|---|---|---|
| `rfork_lease_release_max_attempts` | 3 | 快速阶段还租约次数，含第一次（超次后暂态失败转 ≥60 秒慢试） |
| `rfork_lease_release_retry_interval_sec` | 30 秒 | 快速阶段「可以再试」之后隔多久再还 |
| `rfork_heartbeat_interval_sec` | 30 秒 | 心跳间隔，上一次请求结束后起算 |
| `rfork_request_timeout_sec` | 10 秒 | 单次 HTTP 的连接、读取超时 |
| `rfork_seed_timeout_sec` | 5 秒 | seed 服务健康检查；也是关停时等心跳线程的下限 |
| `rfork_seed_removal_supported` | `false` | 控制是否调 `/remove_seed`（`false` 跳过、`true` 确认、`null` 自动探测） |

默认值见 `config.py`。[C13] 两个 TTL 属于 Planner：示例 Planner 用 `--lease-ttl-sec`（环境变量 `RFORK_MOCK_LEASE_TTL_SEC`）和 `--heartbeat-ttl-sec`（`RFORK_MOCK_HEARTBEAT_TTL_SEC`）设，默认都是 60 秒；客户端设置改不了它们。[C8]

### 会报什么错

状态和结果的类型都定义在 `types.py`：[C1]

| 本页叫法 | 源码 |
|---|---|
| 八个状态 | `RForkLifecycleState`：`INITIALIZED` 已建立、`REGISTERED` 已登记、`LEASED` 已借到、`TRANSFERRED` 已传完、`READY` 就绪、`CLEANUP_REQUIRED` 待清理、`SERVING` 服务中、`FINALIZED` 已收尾 |
| 还租约结果 | `LeaseReleaseResult`：`RELEASED` 已归还、`RETRYABLE` 可以再试、`REJECTED` 被拒 |
| 撤回与上报结果 | `SeedRemovalResult`（`REMOVED`/`ABSENT`/`DRAINING`/`UNSUPPORTED`/`UNCONFIRMED`/`RETRYABLE`/`REJECTED`）；`SeedReportStatus`（`ACCEPTED`/`RETRYABLE`/`REJECTED`） |
| 发布 seed 结果 | `RForkSeedServiceStartResult`：`STARTED`、`DEFERRED`、`FAILED`；只有 `STARTED` 转成布尔值为真 |
| 回退前清理结果 | `RForkFallbackCleanupResult`：`service_stopped`、`lease_released`、`memory_reset` 三项全真才为真；`can_schedule_seed` 只看 `service_stopped` 和 `memory_reset` |

日志原文，按出现先后：

- 借到（debug）：`RFork lease acquired: lease=%s global_rank=%s request_elapsed=%.3fs`
- 三段耗时（debug）：`RFork transfer stages: lease=%s global_rank=%s registration=%.3fs metadata=%.3fs read=%.3fs`；加载器另打 `RFork %s model registration and transfer took %.2f seconds`
- 延期（debug）：`RFork seed promotion is deferred until the source seed lease is released; the transferred model remains available for inference.`
- 非 200/404 的归还回应：`RFork planner lease release rejected: lease=%s status=%s response=%r`，响应体截前 256 字符、借用编号替换成 `<lease-id>`；503 也打这一条，最终分类看下一条。
- 每轮结果（debug）：`RFork lease release outcome: lease=%s attempt=%d/%d result=%s held_elapsed=%.3fs`；暂态慢试阶段按频次打 `RFork planner lease release is temporarily unavailable: ... background retries continue.`，恢复后打 `RFork planner lease release recovered`。
- 永久拒绝停止：`RFork lease release stopped: lease=%s attempts=%d; lease remains unresolved, worker will not advertise a seed. Model loading/inference may continue.`
- 线程异常：`RFork background lease release raised; retaining unresolved lease.`（按 `REJECTED` 处理）；线程起不来：`RFork could not start lease release worker; retaining unresolved lease.`
- 当上 seed（debug）：`RFork seed service started for global_rank=%s, port=%s`；首次上报 `RETRYABLE` 时打 warning `RFork seed service is running but planner advertisement is pending ... background heartbeats will retry.`
- 发布失败：`RFork seed service startup failed for global_rank=%s: %s`；加载器另打 `RFork %s model loaded from %s is ready, but seed service startup failed; inference can continue.`
- 延期发布失败：`RFork deferred seed promotion failed after the source lease was released; the model remains available for inference.`
- 心跳失败与停跳：`RFork planner seed heartbeat is temporarily unavailable for seed_key=%s: ...`；永久拒绝或服务退出时打 error `RFork seed heartbeat stopped after ...; inference can continue.`
- 撤销登记重试：`RFork planner seed removal attempt %d/%d returned status=%s`
- 关停留资源：`RFork shutdown retained registered memory because seed service cleanup is incomplete.`、`RFork shutdown retained TransferEngine state because the source lease is unresolved. …`、`RFork shutdown retained TransferEngine state because finalization did not complete.`
- 回退中止：`RuntimeError: RFork fallback aborted because seed service or registered memory cleanup failed; tensor owners remain retained. …`

这些日志分别在 `session.py`[C2][C3][C4][C5]、`planner_client.py`[C6] 和 `rfork_loader.py`[C15] 里。

五种 Planner 请求，字段都在 HTTP 请求头：[C7][C12]

| 调用 | 主要请求头 | 客户端怎么认 |
|---|---|---|
| GET `/get_seed` | `SEED_KEY` | 200 的响应头必须有 `SEED_IP`、`SEED_PORT`、`USER_ID`、`SEED_RANK`，可选 `LEASE_TTL_SEC`；404 是没有来源 |
| POST `/renew_seed_lease` | `SEED_IP`、`SEED_PORT`、`SEED_RANK`、`USER_ID` | 仅当 `get_seed` 返回有效 `LEASE_TTL_SEC` 时周期调用；200 为续租成功 |
| POST `/put_seed` | `SEED_IP`、`SEED_PORT`、`SEED_RANK`、`USER_ID` | 200/404 已归还；网络异常、408、429、5xx 可重试（先快后慢）；其余被拒；不跟随重定向 |
| POST `/add_seed` | 自己的 KEY、IP、PORT、TP RANK，`SEED_REFCNT: 0` | 200 接受；408/429/5xx 或网络异常为 `RETRYABLE`（后台重试）；其余 `REJECTED` |
| POST `/remove_seed` | `SEED_KEY`、`SEED_IP`、`SEED_PORT`、`SEED_RANK` | 受 `rfork_seed_removal_supported` 控制；200/已确认 404 为撤回，409 为 draining，405/501 为不支持，最多试 3 次 |

示例 Planner 的 `put_seed` 先清过期租约，查不到或来源身份不符就回 404 `lease not found`；请求头解析失败才回 400。[C10][C11] 日志里的 `lease=` 是 `USER_ID` 做 SHA256 后的前 12 位。

### 开销和什么时候别开

- 可选续租与心跳分离：心跳走 `/add_seed` 只刷新 `last_heartbeat_ts` 不续租；当 Planner 返回 `LEASE_TTL_SEC` 时，由独立的 `RForkLeaseRenewal` 线程按 `clamp(TTL / 3, 0.1, 30.0)` 秒调 `/renew_seed_lease` 续期，传输结束或关停即停。[C9][S16]
- 现场 Planner 若不支持 `LEASE_TTL_SEC` 续期，且租约 TTL 短于「取清单 + 读取 + 还租约」总时长，名额会在读完前被收回引发多读者争抢，应先调大 Planner 的 TTL 或升级支持续期。[D]
- 归还被 `REJECTED` 后，登记的显存不注销，要到进程退出的收尾才撤；这段时间被保活的存储一直占着。[D]
- 示例 Planner 把来源、租约放在单进程的内存字典里，多副本共享、重启恢复与生产级排空保护要由现场 Planner 自己负责。[I]

### 版本差异

| 维度 | `v0.23.0` (`2c59ff10`) / `v0.26.0rc` (`2ed6cbba`) | `v0.30.0` (`c09d3e20`) | `main` (`8d6180e2`) |
|---|---|---|---|
| 生命周期与状态机 | 无独立 `RForkSession`；传完同步调 1 次 `/put_seed`，无重试/延期 | 8 状态（含 `REGISTERED`）；后台归还 3 次快试 + ≥60s 慢试，支持 `DEFERRED` 延期发布 | 同 `v0.30.0`，新增 `SeedRemovalResult` 与 `SeedReportStatus`（首次上报 `RETRYABLE` 仍进 `SERVING` 由心跳重试） |
| 租约续期 | 无续期 | 强制要求 `get_seed` 返回有限正数 `LEASE_TTL_SEC` 并周期调用 `/renew_seed_lease` | `LEASE_TTL_SEC` 改为可选兼容旧 Planner；有 TTL 时按 `clamp(TTL/3, 0.1, 30.0)` 续期，无 TTL 关停时做一次尾次归还 |
| 撤回与 draining | 无 `/remove_seed` 协议细化 | 撤回直接调用 `/remove_seed` | 默认关闭 `/remove_seed`（由 `rfork_seed_removal_supported` 控制）；示例 Planner 对有活跃租约的 seed 回 409（draining） |

旧开发快照 `baa023ad` 仍沿用同步归还 1 次的旧逻辑（对照来源 17–19、22–24）。[C17][C22] 完整对照见[总览](rfork.md#版本差异)。

### 源码位置

以下路径相对社区上游 `vllm-ascend@8d6180e2`（除另注外均在 `vllm_ascend/model_loader/rfork/`）：

- 八状态、归还/撤回/上报/发布与清理结果类型：`types.py#L14-L120`。
- 会话构造与退出钩子 `atexit.register`：`session.py#L75-L114`。[C20]
- 先登记后借租约（`register_destination`、`acquire_seed`）、续租线程（`_start_lease_renewal_locked` / `_renew_seed_lease`）与传输（`transfer_from_seed`）：`session.py#L115-L276`。
- 后台还租约快慢重试（`_ensure_lease_release_retry_locked`、`_retry_seed_lease_release`、`_record_lease_release_locked`）、延期推进（`_promote_deferred_seed`）与回退准备（`prepare_for_fallback`）：`session.py#L289-L478`。
- `start_seed_service` 与 `_start_seed_service`（双槽端口、首次上报 `RETRYABLE` 后台重试与心跳启动）：`session.py#L490-L659`。
- 心跳线程 `_run_seed_heartbeat`、`_stop_seed_service`（等待上限 `HEARTBEAT_STOP_GRACE_SEC = 1.0`）、`_release_legacy_lease_on_shutdown` 与 `shutdown`：`session.py#L660-L864`。
- Planner 客户端：`acquire_seed`（`#L137-L195`）、`release_seed_once` 与 `renew_seed_once`（`#L196-L287`）、`remove_seed` 与 `report_seed_once`（`#L289-L391`）：`planner_client.py`。
- 加载器：`_start_rfork_seed_service`（`#L174-L204`）与传输后发布/回退两轮清理（`#L858-L957`）：`rfork_loader.py`。[C14]
- 示例 Planner：两个 TTL 默认值、`add_seed` / `get_seed` / `renew_seed_lease` / `put_seed` / `remove_seed`（409 draining）与过期回收：`examples/rfork/rfork_planner.py#L40-L80`、`#L135-L339`、`#L475-L567`。
- 上游指南协议与生命周期说明：`docs/source/user_guide/feature_guide/rfork.md#L275-L380`。[S16]

**待核：**

1. 现场 Planner 对 `/put_seed` 的 400/404、是否返回 `LEASE_TTL_SEC` 与支持 `/renew_seed_lease` / `/remove_seed`（409 draining），缺生产 Planner 源码或接口契约。
2. GLM 双机从借到到当上 seed、从交出模型到 API 可服务各要多久，缺实机日志。
3. 后台还租约、续租与 draining 撤回在 NPU 实机和现场 Planner 上的表现，缺真机联调记录。
