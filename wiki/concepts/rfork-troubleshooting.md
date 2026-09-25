---
id: rfork-troubleshooting
title: RFork 排错：从第一条异常还原版本、阶段与资源状态
type: feature
summary: >-
  RFork 出错时从哪查起：先确认是哪一版代码，再找日志里最早的那条具体异常，最后看模型、租约和显存各停在哪一步。按「借不到来源、两端清单对不上、显存登记或清理出错、读数据失败、还租约被拒、看起来卡住」六类现象，分别列出能确定的事、可能的原因、该补的证据和不该做的事。
aliases:
  - RFork 排错
  - RFork 报错
  - RFork troubleshooting
  - RFork transfer failed
  - RFork startup failed
  - RFork cleanup failed
  - RFork 卡住
  - RFork OOM
  - RFork 400
  - RFork 404
chapters: []
order: 100
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L69-L155'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L207-L461'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L463-L614'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L633-L793'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/seed_client.py#L89-L153'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L150-L253'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L335-L501'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L563-L710'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/manifest.py#L164-L252'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L18-L25'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork-startup
    kind: builds-on
    note: 报错必须落在真实启动阶段上，后续 fallback 可能掩盖了最初失败
  - to: rfork-lifecycle
    kind: builds-on
    note: lease 未释放、模型加载失败和 seed 未发布是不同状态，恢复措施也不同
  - to: rfork-config
    kind: builds-on
    note: 多数定位需要同时拿到两端参数、端口与 Planner 配置，不能只看 receiver
contradicts: []
updated: '2026-09-25'
rawSources:
  - >-
    raw/sha256-073796cbe486e20d214f38511765d39c6eeadc44ccf5568f0097b54b2d1dc28e.md
  - >-
    raw/sha256-08e247f5a691a563c2eff1e3b7b7835da4aa7a60b5f12a5627edb5077776702d.md
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-59591a4419847f7e688d941665e517ceeff58268f61c79d46d5e2398c4b5e7ce.md
  - >-
    raw/sha256-83e2a01865a32aa947474f37b05149cfa00df90169b1014f4d2301934a03afb6.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
  - >-
    raw/sha256-ced334d86bb2fbc3284d127854ea3710bee45de12d95cdd91aeb6efb5e08e13f.md
---

## 日志最后一行写着「传输失败、回退到默认加载」，该从哪查起

新实例 B 想从已经在跑的实例 A 那里借权重，启动日志最后一条 RFork 警告是「传输失败，清理后回退到默认加载」。这一行本身几乎不说明原因：同一句「传输失败」可能出在显存登记、元数据请求、清单核对，也可能真的是读数据那一步失败；回退之后的日志还可能把最初的失败盖住。

所以排错按三步走：**先固定代码版本，再找第一条具体异常，最后确认失败之后模型和资源停在哪个状态。** 这页的日志都来自用户的 RFork 工作版；它给的是诊断路径，不预先替某次现场事故认定根因。

## 报问题时一次交齐这些信息，最省来回

```text
RFork 代码提交 / 当前补丁序列：
vLLM、vllm-ascend、torch / torch_npu、CANN、YuanRong 版本：
设备型号；实例 / 节点 / Worker 拓扑：
主模型还是投机解码的 draft 模型；global rank / TP rank / PP rank / EP rank：
两端模型内容版本、dtype、量化、TP/PP/DP/EP、NZ、EPLB 配置：
两端完整启动参数（凭据脱敏，保留结构与对应关系）：
Planner 是项目示例还是现场实现；版本、租约有效期、容量、是否多副本：
来源（seed）的 IP:端口，与数据传输引擎的会话端点：
最早具体异常前后的日志（同时保留主模型 / draft、相关 rank 的上下文）：
最后结果：退出 / 回退成功 / 推理可用 / 仅没能登记为来源 / 卡住：
复现次数、触发条件、最近修改、与默认加载的对照：
```

借用编号是租约凭据，要脱敏，但脱敏后仍要能对上号——用可关联的替代值，或日志里已有的哈希；不要把不同 rank 的日志全部擦成同一个标识。只有一行警告时，应先指出还缺哪些证据，不能凭空补出调用经过。

## 第一遍读日志：只认出走到了哪一步

B 借权重的过程大致按下表从上往下走。拿到日志后，先找最靠下的那条「走到这里了」的记录，再看它后面紧跟的第一条异常。每条日志能确定的事情很有限，别多推一步：

| 走到哪一步 | 看到这一步的日志，能确定什么 | 下一步看哪一页 |
|---|---|---|
| 建立数据传输后端 | 若这里就报缺依赖或初始化失败：RFork 这条路没准备好，**不等于**默认加载也必然失败 | [配置](rfork-config.md) |
| 模型骨架造好 | 本次初始化返回了，**不代表**已经读到真实权重 | [启动](rfork-startup.md) |
| 选了「加载后再对齐布局」的路径 | 这次走了需要先准备布局的路线 | [布局](rfork-layout.md) |
| 向 Planner 申请来源失败 | 请求、响应或解析出了错；后面可能表现为「没有来源」 | [身份](rfork-identity.md) |
| 没有可用来源 | 这次没借到，转默认加载；正常的第一次冷启动也会这样 | [身份](rfork-identity.md) |
| 显存登记完成 | 这一次登记成功返回 | [内存](rfork-memory.md) |
| 向来源要元数据出错 | 控制通道（HTTP）出了问题，还不能归到读数据那一步 | [传输](rfork-transfer.md) |
| 清单核对不通过 | 两端结构对不上，通常在读数据之前就被挡住了 | [传输](rfork-transfer.md) |
| 某一批数据读失败 | 至少一批没读成；更早的批次可能已经写进去了 | [传输](rfork-transfer.md) |
| 数据读完 | 列出的同步读取都成功了；接着查后处理、还租约和登记为来源 | [生命周期](rfork-lifecycle.md) |
| 「当来源」延后 | 本机已经准备好，等借来的租约确认还上再登记；模型可以继续启动 | [生命周期](rfork-lifecycle.md) |
| 回退被安全门挡下 | 旧的模型或登记过的显存没能安全清掉，拒绝再分配第二份模型 | [内存](rfork-memory.md) |

每一步对应的日志原文见下半「对照源码 · 会报什么错」。最后那句笼统的「传输失败」不能当根因。

## 明明有来源却没借到：先查配对键和容量，再查网络

**可能的原因**（都只是候选，不能从「没有可用来源」几个字直接判定）：两端配置算出来的指纹不同；rank 或角色不同；来源登记失败；来源的心跳失效了；同一个配对键下名额已经用完；或者申请请求落到了一个没有同一份状态的 Planner 副本上。

**先收集**：两端会话初始化的日志、完整的配对键、来源登记请求的响应、Planner 上实际的记录，再查申请来源那个请求的状态码和返回头。客户端会把请求出错也折算成「没借到」，所以要往前找有没有「申请来源失败」，而不是一律当成正常冷启动。

**不要做**：先改配对键的算法、把 rank 从键里删掉、或者让不同量化配置共用一个指纹来提高命中率——那会拆掉原本用来防止借错权重的边界。

## 元数据或清单报错：先把两端清单摆在一起比

先看[官网与工作版差异](../sources/rfork-official-guide.md)：不要拿官网的键格式、旧的成功日志或「随机端口」这类概括直接诊断本版。如果本机检查来源服务健康是好的、但远端取元数据失败，接着查对外公布的地址、实际监听的网卡和跨节点能不能访问——本机回环的健康检查覆盖不到这些，详见[配置](rfork-config.md)。

| 现象 | 先补的证据 | 不该直接做的事 |
|---|---|---|
| 元数据请求返回了非成功状态码 | 来源地址、查询用的键、响应体、服务端日志 | 当成 NPU 链路故障 |
| 两端清单里的张量名字不一样多 | 两端版本、同名模型实际可传的张量列表、draft 共享哪些 | 忽略差集继续读 |
| 清单条目缺形状或数据类型 | 返回条目的实际结构，是不是混进了旧来源 | 猜一个数据类型补上 |
| 数据类型不一致 | 数据类型、量化配置、实际张量的类型 | 因为每个元素字节数相同就强制转换 |
| 元素个数 / 大小不一致 | 元素个数、每元素字节、形状、张量名 | 直接改成任意形状 |
| 两份形状记录互相矛盾 | 主清单与单独的形状清单里同名的那一条 | 随便挑一份用 |

差集里如果出现一个**运行期临时缓冲区**：工作版按名字把它排除在采集之外——它的大小由接收端自己的调度上限决定，从来源抄过来反而是错的。所以两端都跑本工作版时不该看到它，看到了先查采集那一侧的版本；但其他张量的差异不能都往这个已知问题上推。

## 显存登记或清理出错：留住底层错误和地址关系

**登记时说某段张量范围没被完全覆盖**：检查张量的逻辑范围、NPU 显存分配器的快照和被排除的块，重点看是不是有部分共享或布局换过。不要把登记范围扩大到整张卡来绕过这道检查。这里的方向是推断，要拿现场数据证实。

**批量登记接口缺失或失败**：记下数据系统的真实版本、它的显存登记接口、错误码和这一批的逻辑范围 / 实际支撑范围。「接口不存在」和「登记的区间不合法」是两类问题。

**批量注销出错、回滚没做完、或收尾时报「还没准备好」**：保留完整连续的日志和当时有没有传输在进行。只看到「找不到」不能断言整批都清掉了——代码会逐个地址补查。不要为了让显存数字降下来去释放持有张量存储的对象。

**回退时显存不够（OOM）**：先分清是「旧模型还被引用着」，还是「默认加载本身就装不下」。同时对照被丢弃的编译钩子、MoE / 前向 / RoPE 状态有没有恢复、登记过的显存有没有清掉；光看垃圾回收调用了几次，证明不了权重已经释放。这一条同样是推断方向。

## 读数据那一步失败：HTTP 通了只解决了一半

**先收集**：失败的是第几批、这一批首末两个权重的名字、底层返回码、两端数据传输引擎的端点、设备编号和网络配置。元数据服务的端口通，不代表数据端点通；对外公布的地址也不会自动覆盖传输引擎自己选出的地址，两者的来源见[配置](rfork-config.md)的四类端点表。

**要知道的后果**：某一批失败时，前面成功的批次可能已经写进了目标模型。工作版随后清理并回退，不允许把这份半加载的模型直接标成就绪。当前源码**没有逐字节内容校验**，所以「所有读取都返回成功」之后如果输出异常，也要拿默认加载的权重 / 输出来对照。

## 还租约被 Planner 回 400 或 404：分清现象和根因

工作版对还租约的回应分三类：200 和 404 当作「已归还」；网络出错、408、429、5xx 算「可以再试」；400 算「被拒」，这份租约立即停止重试。

**400 本身不能证明租约过期了。** 候选还包括：借用编号不存在、来源身份对不上、字段约定不同、请求落到了另一份内存状态、Planner 重启过、或服务端的其他校验。这些都是推断，要用实际响应体和服务端记录来筛。

如果前面已经有「数据读完」，后面只有一句「不会把自己登记为来源，模型加载 / 推理可以继续」，可以先判断为：租约账没了结、登记为来源这件事被压下了——**不能**直接写成模型加载失败。

**不要做**：把所有 400 改判成功；在没核实服务端约定之前，把 404 当成「按时归还」的证明。租约有效期、心跳有效期、从拿到租约到最后一次读取的耗时，这三个时间要分别记下来。

## 「卡住了」：必须拿到每个线程、每个 rank 的实际位置

日志长时间不动，只能说明没有新日志，不能证明死锁。还租约的网络请求不占会话锁，但显存登记和同步读取仍然会占着锁；主模型加载完后可能接着加载 draft 模型；其他 rank 在集合通信上的等待，也不会出现在某一行 RFork 警告里。这些都是可能的原因，需要现场证据。

也不要按「单次请求超时 10 秒、最多 3 次」推算 30 秒后必然退出：重试之间还有等待，单次请求超时也不是端到端的截止时间，见[配置里的耗时边界](rfork-config.md)。

现场要拿到：线程栈、每个 rank 的最后阶段、底层读取是否还在进行、CPU / NPU 利用率、进程是否存活。再据此分清是网络等待、设备调用、锁竞争、draft 初始化，还是上层启动在等。知识库不会因为某条日志里出现了「还租约」就编一个阻塞栈出来。

## 给出诊断时按这六步写

1. **版本与范围**：报错的代码是否就是本章基线；哪些依赖和现场 Planner 还没核对。
2. **已经证实的事实**：引用用户日志的时间、rank、原文，再链接能支撑解释的知识页和源码位置。
3. **当前失败在哪一步、影响多大**：模型加载、租约记账、登记为来源、清理，分别是什么结果。
4. **候选原因**：按证据强弱排序，明确写「推断」，不把候选写成定因。
5. **下一步验证**：每一步说清要拿什么证据、结果 A / B 分别排除什么，不先堆一串调参命令。
6. **处理建议与验收**：只有原因足够清楚时才建议补丁；验证要覆盖复现、回退、输出一致性和资源清理。

诊断记录可以留作问答来源页，但不能凭一次对话反过来改写工作版行为的描述、篡改原始补丁，或者把没实测过的推断升级成源码事实。

## 对照源码

### 会报什么错

上半「第一遍读日志」表格对应的日志原文（阶段映射来自 Planner 客户端、传输后端、Session 与 loader 的日志位置）[C1][C2][C4][C5][C6][C7][C8][C9]：

| 日志片段 | 上半的哪一步 |
|---|---|
| `requires ... TransferEngine` / session 初始化失败 | 建立数据传输后端 |
| `model initialization took` | 模型骨架造好 |
| `uses post-load tensor layout transfer` | 选了加载后对齐布局（processed 路径） |
| `planner seed acquisition failed` | 向 Planner 申请来源失败 |
| `has no available ... seed` | 没有可用来源，未取得 lease |
| `register_memory_region time` | 显存登记完成 |
| `seed metadata request ...` | 向来源要元数据出错 |
| `manifest names differ` / `Weight info mismatch` | 清单核对不通过 |
| `Failed to transfer weights chunk` | 某一批数据读失败（native read） |
| `weight transfer completed` | 数据读完 |
| `seed promotion is deferred` | 本地 READY 后「当来源」延后，等 source lease 确认释放 |
| `fallback aborted ... weights are pinned` | 回退被安全门挡下 |

最后那句 `RFork transfer failed: ..., clean up and fall back to default loader` 是 loader 的汇总警告，不是足够精确的根因。 `get_seed` 请求异常、非 200、响应头不全都会被 `acquire_seed` 捕获并返回 None，只留一条 `planner seed acquisition failed` 警告，所以「无来源」要往前找这条。

清单类报错的原文（拒绝点在 manifest 验证）：

| 上半现象 | 日志原文 |
|---|---|
| 元数据请求非成功状态 | `metadata request returned status=...` |
| 张量名字差集 | `manifest names differ: local_only=..., remote_only=...` |
| 缺形状或数据类型 | `must include shape and dtype` |
| 数据类型不一致 | `Weight dtype mismatch` |
| 元素个数 / 大小不一致 | `Weight info mismatch`（比 numel 与 element size） |
| 两份形状记录矛盾 | `conflicting shape metadata` |

上半说的运行期临时缓冲区是 `topk_indices_buffer`：`tensor_layout.py` 把它列入 `_RUNTIME_ONLY_TENSOR_NAMES`，按名字末段排除在采集之外，容量由接收端自己的调度上限决定。[C10]

显存登记与清理类报错[C3]：

- `tensor range ... not fully covered`：对照逻辑 Tensor 范围、NPU allocator snapshot 与 exclude_blocks。[I]
- `batch_register_memory_ex` 缺失或失败：日志为 `requires YuanRong TransferEngine with MemoryRegistration ...`；记录 MemoryRegistration API、错误码与该批逻辑 / 支撑范围。
- `batch_unregister_memory ...`、`registration rollback is incomplete`、finalize `kNotReady`：只出现 not-found 不能断言整批清掉，代码会逐地址补查；不要释放 storage owners。
- 回退 OOM：对照 discarded compilation hooks、MoE / forward / RoPE 状态恢复与已注册内存清理；`gc.collect` 调用次数不能证明权重已释放。[I]

读取失败时的日志为 `Failed to transfer weights chunk %d/%d, first: %s, last: %s, ret=%s`，给出批次序号、首末 weight 名与 native ret。 失败后清理并回退、不标 ready；源码无逐字节内容校验。 metadata 端口与 TransferEngine 数据端点、advertise IP 与 TransferEngine 自动选出的 IP 的区别是推断性提醒，端点来源见[配置](rfork-config.md)。[I]

还租约（`put_seed`）的分类：200/404 → `RELEASED`；`requests` 异常、408、429、5xx → `RETRYABLE`；400、其他状态（请求不跟随重定向）→ `REJECTED`，停止该 lease 的释放重试。 400 的候选原因是推断。[I] 发布被抑制时 Session 记的是 `worker will not advertise a seed. Model loading/inference may continue.`。 日志里的 `lease=` 是 `USER_ID` 的哈希摘要，发报错时可用它代替原值关联 rank。

「卡住」相关：release 请求在 session 锁外发出，注册和同步读取仍在锁内；main 完成后可能开始 draft。[I] `rfork_request_timeout_sec`（10 秒）是 Requests 单次 timeout，不是端到端截止时间。

### 版本差异

本页只讲用户确认的 RFork 工作版（`rfork@3284850b`）。上面的日志文本、Session、Planner 客户端都来自工作版补丁，社区 v0.23 / v0.26 / main 的代码对不上，逐补丁对照见[总览页](rfork.md)与[版本维护](rfork-maintenance.md)；官网写法与工作版的差异见[官网与工作版差异](../sources/rfork-official-guide.md)。

### 源码位置

- Planner 客户端 `acquire_seed` / `release_seed_once`：`planner_client.py`
- 创建后端、依赖检查、显存登记与回滚：`transfer_backend.py`
- 注销与清理：`transfer_backend.py`
- 取 metadata、清单比对、分批 native read：`transfer_backend.py`
- seed metadata HTTP 请求：`seed_client.py`
- 异步释放 lease 与发布抑制：`session.py`
- `start_seed_service` 与延期发布、shutdown：`session.py`
- loader 主流程、seed miss、失败回退与 pinned 安全门：`rfork_loader.py`
- manifest 条目校验：`manifest.py`
- 运行期临时张量排除名单：`tensor_layout.py`
