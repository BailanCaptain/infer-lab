---
id: rfork-troubleshooting
title: RFork 排错：从第一条异常还原版本、阶段与资源状态
type: feature
summary: >-
  RFork 出错时从哪查起：借租约前登记显存失败写 destination registration failed.，借到来源后的取清单、核清单、分批读三步失败共用
  transfer failed.，缺必填配置抛 RForkConfigurationError 直接中止。按六类现象列出证据、候选原因与排查步骤；示例 Planner 的 400 来自请求头解析失败，到期回 404。
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
  - destination registration failed
  - RFork 首错定位
  - RFork 400 404
chapters: []
order: 100
sources:
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/planner_client.py#L137-L287'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L227-L551'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L552-L694'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L695-L876'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/seed_client.py#L58-L110'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L289-L478'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L490-L864'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L747-L957'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/manifest.py#L87-L214'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/tensor_layout.py#L34-L42'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L254-L288'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L289-L339'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L426-L474'
  - 'vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py#L531-L567'
  - 'vllm-ascend@8d6180e2:tests/ut/model_loader/rfork/test_rfork_planner.py#L44-L120'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L115-L276'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/safety.py#L9-L21'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/rfork_loader.py#L153-L204'
  - 'vllm@0fc695fc:vllm/envs.py#L796'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/config.py#L11-L51'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/seed_client.py#L24-L56'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/tensor_layout.py#L410-L444'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/transfer_backend.py#L128-L190'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/session.py#L75-L114'
  - >-
    raw:sha256-3a82c2b420a34567fe8f4c358cea81e2e5df56395a32bdde4c1378a3b6729ffc.md#L1-L1692
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/planner_client.py#L117-L245'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/session.py#L261-L364'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/transfer_backend.py#L224-L269'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_loader/rfork/types.py#L68-L81'
verified:
  - main
evidence: C
relations:
  - to: rfork-startup
    kind: builds-on
    note: 报错必须落在真实启动阶段上，后续 fallback 可能掩盖了最初失败
  - to: rfork-transfer
    kind: builds-on
    note: destination registration failed. 与 transfer failed. 两类汇总分别对应显存登记和借后三步传输，须沿传输阶段定位首错
  - to: rfork-lifecycle
    kind: builds-on
    note: lease 未释放、模型加载失败和 seed 未发布是不同状态，恢复措施也不同
  - to: rfork-config
    kind: builds-on
    note: 多数定位需要同时拿到两端参数、端口与 Planner 配置，不能只看 receiver
  - to: inference-troubleshooting
    kind: builds-on
    note: RFork 排障承接全站「先固定版本、再按首错定位阶段」的证据化排障方法
  - to: device-memory
    kind: builds-on
    note: 回退阶段 OOM 与回滚不完整须结合 NPU 显存分配快照、保活列表与全局引用共同判定
  - to: cann-hccl
    kind: builds-on
    note: 多卡初始化日志静默或卡住时，须将 RFork 读数据等待与其余 rank 卡在 HCCL 集合通信区分开
contradicts: []
legacyAnchors:
  放到-glm-双机32-份租约16-个-rank-各查各的: 用-rank模型角色和租约标识串起启动日志
updated: '2026-11-19'
rawSources:
  - >-
    raw/sha256-073796cbe486e20d214f38511765d39c6eeadc44ccf5568f0097b54b2d1dc28e.md
  - >-
    raw/sha256-08e247f5a691a563c2eff1e3b7b7835da4aa7a60b5f12a5627edb5077776702d.md
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-3a82c2b420a34567fe8f4c358cea81e2e5df56395a32bdde4c1378a3b6729ffc.md
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

新实例 B 想从已经在跑的实例 A 那里借权重，启动日志里最后一条 RFork 警告是「传输失败，清理后回退到默认加载」。模型最后照样起来了，可这次为什么没借成？

**RFork 排错**，就是从这句笼统的汇总往前找，还原三件事：跑的是哪一版代码，借权重走到了哪一步，失败之后模型、租约和显存各停在什么状态。

```wiki-diagram
file: rfork-troubleshooting
```

图里是按社区上游 `main`（`8d6180e2`）顺序拆出的两段核心检查和三类汇总：

- **借租约之前先登记显存（`register_destination`）**：这一步检查不通过返回 `False` 时，先在登记处记一条具体 error，再由加载器抛出 `RuntimeError("destination registration failed.")`，汇总原因写的是 `destination registration failed.`（**不是** `transfer failed.`）。
- **借到来源以后走三步（`transfer_from_seed`：向 A 要清单 → 核对清单 → 分批读权重）**：这三步检查不通过返回 `False` 时，源码先在出错处记一条具体 error，再统一抛出 `RuntimeError("transfer failed.")`；这三种情况的汇总连原因一栏都一字不差，只写 `transfer failed.`，能分辨是哪一步的，是汇总前面紧挨着的那条具体异常。
- **任一步直接抛可恢复异常**：比如来源地址不合法、取不到 storage owner、同名冲突张量或传输引擎读取调用直接抛错，前面没有单独的具体日志，汇总的原因一栏就是那条异常原文。注意缺少三项必填配置或严格参数非法抛 `RForkConfigurationError` 时，进程会**直接中止启动**，不打这句汇总，也不走回退。

所以拿到汇总，先看它的原因一栏：写 `destination registration failed.` 就查登记侧；只写 `transfer failed.` 就往前找这个 rank 的第一条具体异常；写的是别的内容，那就是异常本身。多数时候那条异常就紧挨着汇总，但有两种例外：登记失败、回滚又没做完时，紧挨着汇总的是「回滚没做完」那条，原始的登记报错还在更前面；多个 rank 的日志混在一起时，中间还会插进别的 rank 的行。

所以排错按三步走：**先固定代码版本，再找第一条具体异常，最后确认失败之后模型、租约和显存各停在哪个状态。** 这页的日志均对照社区上游 `vllm-ascend` `main`（`8d6180e2`）源码；它给的是诊断路径，不预先替某次现场事故认定根因。

## 为什么不能只看最后那句：同一句话背后是不同的状态

只看汇总，至少会把三类完全不同的情况混在一起：

- **登记失败，或借到后中途失败**：对应图里两段。登记显存在借租约之前，失败汇总写 `destination registration failed.`；借到来源后的取清单、核清单、分批读三步失败汇总都写 `transfer failed.`。坏在读数据那一步时，前面几批权重已经写进了 B 的显存。回退前要先把这些撤干净，撤不干净，回退会被安全门挡下，拒绝再分配第二份模型。

  清理失败时，旧权重仍被保活，阻止第二份模型分配是为了避免在旧资源尚未安全释放时继续加载。因此，看到回退被挡下，还不能据此认定已经发生显存不足；需要结合更早的具体异常判断。
- **根本没借到**：Planner 说没有可用来源，或者申请来源这个请求本身出了错。B 直接清理并走默认加载，不打那句汇总。正常的第一次冷启动也走这条路。
- **借成了，只是没当成来源**：权重读完了，后台还租约被永久拒绝（如 400），B 照常推理，只是不把自己登记为来源。这一类连回退都没有，模型加载是成功的。

总览页把这几种结果归纳成[「成功」至少有四种](rfork.md#成功至少有四种不能压成一个开关)。把它们压成一句「RFork 失败了」，下一步就会查错方向：明明是租约记账的问题，却去查 NPU 链路。

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
日志级别（默认 INFO 还是开了 DEBUG）：
最早具体异常前后的日志（同时保留主模型 / draft、相关 rank 的上下文）：
最后结果：退出 / 回退成功 / 推理可用 / 仅没能登记为来源 / 卡住：
复现次数、触发条件、最近修改、与默认加载的对照：
```

日志级别要写上，因为有几条关键日志默认看不到：「这次没借到来源」只有 TP 序号为 0 的 Worker 按 INFO 打，其余 Worker 按 DEBUG 打；Planner 明确回「没有来源」时，客户端也只记一条 DEBUG。默认 INFO 级别下，大多数 rank 上「没借到」是静悄悄的。

借用编号是租约凭据，要脱敏，但脱敏后仍要能对上号：日志里租约那一栏记的就是它的哈希摘要，可以直接拿来关联；不要把不同 rank 的日志全部擦成同一个标识。只有一行警告时，应先指出还缺哪些证据，不能凭空补出调用经过。

## 第一遍读日志：只认出走到了哪一步

B 借权重的过程大致按下表从上往下走。拿到日志后，先找最靠下的那条「走到这里了」的记录，再看它后面紧跟的第一条异常。每条日志能确定的事情很有限，别多推一步：

| 走到哪一步 | 看到这一步的日志，能确定什么 | 机制在哪一节 |
|---|---|---|
| 命中可变权重守卫绕过 | 开启 sleep mode、在线权重传输或 `--enable-eplb` 时，打一条 `RFork transfer is disabled when ... is enabled; using the default model loader.` warning 并直接走默认加载，后续借权重日志均不出现 | [启动 · 两处提前离开](rfork-startup.md#两处提前离开不是漏了步骤) |
| 建立数据传输后端 | 若这里就报缺依赖或初始化失败：RFork 这条路没准备好，**不等于**默认加载也必然失败 | [配置 · 依赖和限制](rfork-config.md#设置写对了还不够依赖和限制要实际核对) |
| 模型骨架造好 | 本次初始化返回了，**不代表**已经读到真实权重 | [启动 · 十步](rfork-startup.md#十步各做什么做完手里有什么) |
| 选了「加载后再对齐布局」的路径 | 这次走了需要先准备布局的路线 | [布局 · 两条路](rfork-layout.md#两条路后处理放的位置不同) |
| 显存登记完成并绑定 `seed_key` | 这一次目的显存登记成功返回、结构摘要与 `seed_key` 已绑定（在借租约之前） | [传输 · 第一步](rfork-transfer.md#第一步先把-b-的空位登记给传输引擎) |
| 向 Planner 申请来源失败 | 请求、响应或解析出了错；后面会表现为「没有来源」 | [身份 · 没借到要分清](rfork-identity.md#没借到要分清钥匙没算出来匹配不到还是根本没问成) |
| 没有可用来源 | 这次没借到，转默认加载；正常的第一次冷启动也会这样 | [启动 · 三类来源](rfork-startup.md#没有可用-seed有三类来源要靠旁边的日志分开) |
| 向来源要元数据出错 | 控制通道（HTTP）出了问题，还不能归到读数据那一步 | [传输 · 第二步](rfork-transfer.md#第二步用-http-向-a-要清单) |
| 清单核对不通过 | 两端结构、类型或 NPU 格式对不上，在读数据之前就被挡住了 | [传输 · 第三步](rfork-transfer.md#第三步第一个字节写进来之前整份清单要过五道门) |
| 第 k 批数据读失败 | 第 1 到 k−1 批已经读完、写进了 B 的显存 | [传输 · 第四步](rfork-transfer.md#第四步大张量切成不超过-1-gib-的段再按批读) |
| 数据读完 | 列出的同步读取都成功了；接着查后处理、还租约和登记为来源 | [传输 · 传完了](rfork-transfer.md#传完了只说明这些读都成功返回了) |
| 「当来源」延后 | 本机已经准备好，等借来的租约确认还上再登记；模型可以继续启动 | [生命周期 · 发布 seed](rfork-lifecycle.md#发布-seed已启动延期失败) |
| 回退被安全门挡下 | 旧的模型或登记过的显存没能安全清掉，拒绝再分配第二份模型 | [传输 · 任何一步失败](rfork-transfer.md#任何一步失败先撤销再回退) |

表中「向来源要元数据出错」在当前 `main`（`8d6180e2`）只涉及 `/get_rfork_transfer_engine_info` 这一个接口。一次响应必须同时返回三样：`rfork_protocol_version = 1`、`rfork_transfer_engine_info`（会话 ID 与严格五元组权重清单 `(ptr, numel, element_size, shape, dtype)`），以及 `rfork_transfer_engine_format_info`（逐张量 NPU 存储格式）。

`seed_key` 不匹配时服务端直接回 HTTP 404，早期分支单独请求 `/get_rfork_transfer_engine_shape_info` 的兼容路径已移除。任何协议版本不符、字段缺失或格式清单非法，都会记一条 error 并返回未取得元数据。

每一步对应的日志原文见下半「对照源码 · 会报什么错」。

举一个示意的例子，演一遍怎么读。某个 Worker 的日志按时间顺序是这四条（用中文转述）：

1. 显存登记完成，用时 0.8 秒；
2. 第 7/12 批读失败，日志给出这一批首末两个权重的名字和底层返回码；
3. 汇总：传输失败，原因一栏只有 `transfer failed.`，清理后回退；
4. 默认加载的日志。

读法是：最靠下的「走到这里了」是第 1 条，紧跟着的第一条异常是第 2 条，所以失败在分批读。能读到第 7 批，说明登记、借租约、要清单、核清单都过了；第 1 到 6 批已经写进 B 的显存，第 7 批写到了哪里，日志不说。下一步要查的是数据传输引擎的端点和返回码，不是元数据端口。第 3 条汇总没有提供任何新信息。

## 明明有来源却没借到：先查配对键和容量，再查网络

客户端会把三类情况都折算成「没借到」：

1. Planner 明确回 404「没有来源」（客户端 `acquire_seed` 在所有 Worker 上仅记一条 DEBUG `RFork planner has no available seed`）；
2. 请求出错，或状态码既不是 200 也不是 404（记「申请来源失败」warning）；
3. 响应头缺项、端口或 rank 不能转为整数、端口 $\le 0$ / $> 65535$、rank $< 0$，或可选 `LEASE_TTL_SEC` 非法（同样记「申请来源失败」warning）。

注意区分两条不同层级的日志：Planner 客户端的 404 记录始终是逐 Worker 的 DEBUG 日志，而加载器在拿到空结果后紧接着输出的 `RFork %s seed acquisition was unsuccessful; loading locally.` 是加载层汇总（仅 `tp_rank == 0` 为 INFO、其余 rank 为 DEBUG），两者不是同一条日志。如果来源地址字段本身是非法 URL、与租约端口冲突或携带用户凭据，则会在构造来源 URL 时抛 `ValueError` 并走「传输失败」汇总。看到加载层「没有可用来源」时，务必往前找有没有客户端的「申请来源失败」警告，不要一律当成正常冷启动。

**候选原因**（都要拿证据筛，不能从「没有可用来源」几个字直接判定）：两端配置算出来的指纹或结构摘要不同；rank 或角色不同；来源登记失败；来源的心跳失效进入 draining；同一个配对键下名额已经用完；或者申请请求落到了一个没有同一份状态的 Planner 副本上。配对键由哪些量算出来，见[身份 · 部署指纹里写了什么](rfork-identity.md#部署指纹里写了什么)。

**先收集**：两端会话初始化的日志、完整的配对键与结构摘要、来源登记请求的响应、Planner 上实际的记录，再查申请来源那个请求的状态码和返回头。

**不要做**：先改配对键的算法、把 rank 从键里删掉、或者让不同量化配置共用一个指纹来提高命中率——那会拆掉原本用来防止借错权重的边界。

## 元数据或清单报错：先把两端清单摆在一起比

先看[官方指南与当前主线对照](../sources/rfork-official-guide.md)：区分指南日期和实际实现，不拿旧键格式、成功日志或“随机端口”的概括直接诊断；整体证据化排障方法承接全站[推理排障总入口](inference-troubleshooting.md)。如果本机健康检查通过、远端却取不到元数据，再查公布地址、监听网卡和跨节点连通性；本机回环检查覆盖不到这些。四类端口的含义见[配置](rfork-config.md#四类端口谁监听谁来连由什么决定)。

清单要过哪几道门、每一项记了哪五个量及 NPU 格式，见[传输 · 第三步](rfork-transfer.md#第三步第一个字节写进来之前整份清单要过五道门)。对应到现象：

| 现象 | 先补的证据 | 不该直接做的事 |
|---|---|---|
| 元数据请求返回了非 200 状态码（含错 key 回 404） | 来源地址、查询用的键、响应体、服务端日志 | 当成 NPU 链路故障 |
| 协议版本不符或主字段/格式表非法 | 返回 JSON 结构与 `rfork_protocol_version`、两端版本 | 跳过协议或格式检查 |
| 两端清单里的张量名字不一样多 | 两端版本、同名模型实际可传的张量列表、draft 共享哪些 | 忽略差集继续读 |
| 清单条目非严格五元组 | 返回条目的实际结构，是不是混进了旧版本来源 | 猜一个形状或数据类型补上 |
| 数据类型不一致 | 数据类型、量化配置、实际张量的类型 | 因为每个元素字节数相同就强制转换 |
| 元素个数 / 每元素字节不一致 | 元素个数、每元素字节、形状、张量名 | 直接改成任意形状 |
| NPU 存储格式不一致或格式清单缺失 | 两端 `torch_npu.get_npu_format`、权重 NZ 模式与后处理路径 | 忽略格式差异强行按字节读 |
| 条数或总字节对不上 | 两端清单的条数、总字节，差在哪几条 | 只比对一部分就放行 |

差集里如果出现运行期临时缓冲区或派生缓存：上游 `main`（`8d6180e2`）按名字末段排除 `_RUNTIME_ONLY_TENSOR_NAMES` 中的三项——`topk_indices_buffer`、`_rope_derived_cos_cache` 与 `_rope_derived_sin_cache`——它们属于本机运行期状态，从来源抄过来反而是错的（见[布局 · 本机的工作区不从 A 搬](rfork-layout.md#本机的工作区不从-a-搬)）。两端都跑本基线时不该看到它们，看到了先查采集那一侧的版本；但其他张量的差异不能都往这条排除名单上推。

## 显存登记或清理出错：留住底层错误和地址关系

登记是借权重的第一步，登记过的设备显存地址什么时候能撤、撤不干净会怎样，见[传输 · 登记了地址，权重就能活到传输结束吗](rfork-transfer.md#登记了地址权重就能活到传输结束吗)和[任何一步失败：先撤销，再回退](rfork-transfer.md#任何一步失败先撤销再回退)（注意这里排查的是 NPU 设备显存块向传输引擎的登记，不同于主机侧 DRAM 的锁页内存 `mlock` / `pin_memory` 配额限制，后者见[主机内存、大页与 IPC 稳态](host-memory-and-hugepages.md)）。

**登记时说某段张量范围没被完全覆盖**：检查张量的逻辑范围、NPU 显存分配器的快照和被排除的块，重点看是不是有部分共享或布局换过。不要把登记范围扩大到整张卡来绕过这道检查。这个排查方向是从源码推出来的，现场证据见[哪些结论还要到现场核](#哪些结论还要到现场核)。

**批量登记出错，分两种日志**：一种说传输引擎缺少带显存登记对象的批量登记接口，这是数据系统版本不对；另一种是登记调用抛了异常或返回了错误码，日志带着这一批有多少段和返回码，这是登记的区间或引擎状态有问题。两种要分开报：记下数据系统的真实版本、错误码和这一批的逻辑范围 / 实际支撑范围。

**批量注销出错、回滚没做完、或收尾时报「还没准备好」**：保留完整连续的日志和当时有没有传输在进行。收尾时引擎回「还没准备好」，代码会隔一段时间再试；回别的错误码就直接停。只看到「找不到」不能断言整批都清掉了：源码把批量注销回「找不到」当成「后面的地址没处理」，随后逐个地址补查。不要为了让显存数字降下来去释放持有张量存储的对象。

**回退时显存不够（OOM）**：先分清是「旧模型还被引用着」，还是「默认加载本身就装不下」（结合[设备显存](device-memory.md)快照分析）。同时对照被丢弃的编译钩子、MoE / 前向 / RoPE 状态有没有恢复、登记过的显存有没有清掉；光看垃圾回收调用了几次，证明不了权重已经释放。这一条同样是推断出的方向。

## 读数据那一步失败：HTTP 通了只解决了一半

**先收集**：失败的是第几批、这一批首末两个权重的名字、底层返回码、两端数据传输引擎的端点、设备编号和网络配置（运行期网卡、超时与设备通信环境变量见 [CANN Runtime 与任务下发调优](ascend-runtime-and-tuning.md)）。元数据服务的端口通，不代表数据端点通；对外公布的地址也不会自动覆盖传输引擎自己选出的地址，两者的来源见[配置的四类端口](rfork-config.md#四类端口谁监听谁来连由什么决定)。

**要知道的后果**：批是按顺序一批一批同步读的，第 k 批失败时，第 1 到 k−1 批已经写进了目标模型。当前上游主线随后清理并回退，不允许把这份半加载的模型直接标成就绪。分批的规则见[传输 · 第四步](rfork-transfer.md#第四步大张量切成不超过-1-gib-的段再按批读)。

当前源码**没有逐字节内容校验**，所以「所有读取都返回成功」之后如果输出异常，也要拿默认加载的权重 / 输出来对照，见[「传完了」只说明这些读都成功返回了](rfork-transfer.md#传完了只说明这些读都成功返回了)。

## 还租约被 Planner 回 400 或 404：分清现象和根因

B 读完权重后在后台线程里还租约：200 和 404 记为已归还，请求出错、408、429、5xx 记为可以再试，400 和其他状态码记为被拒、立即停；这三类结果，以及「404 只算按约定还了、400 本身不能证明租约过期」的道理，见[生命周期 · 还租约](rfork-lifecycle.md#还租约一个后台线程三种结果)和[400 和 404 各说明了什么](rfork-lifecycle.md#400-和-404-各说明了什么)。排错时还要多知道下面几件事。

**被拒不等于模型加载失败。** 前面已经有「数据读完」，后面跟着「还租约停止，不会登记为来源，模型加载和推理可以继续」，就应判断为：租约账没了结，登记为来源这件事被压下了。

**配示例 Planner 时，400 与租约到期无关。** 示例 Planner 的还租约接口只在请求头解析不过时回 400：来源地址、端口、rank、借用编号这四个头缺项或为空，端口或 rank 非整数，或端口小于 1、rank 小于 0。响应体里会直接写出解析错误，客户端警告日志会原样截录（借用编号替换为占位符）。

客户端拿到租约时已按同一套条件检验过这四个值。两端均跑本基线且中间没有改写请求头的代理时，这类 400 不该出现；真出现了，先读日志里的响应体，再确认 Planner 是否为示例实现以及链路中是否存在代理改写。

**现场 Planner 的 400 另算。** 现场有过一次记录：还租约收到 400，日志没留响应体；另拿编造的借用编号去试，回复是「找不到这个编号」（见[生命周期](rfork-lifecycle.md#400-和-404-各说明了什么)）。所以现场的 400 里，「编号找不到」是候选之一；编号找不到又分过期、来源身份对不上、请求落到另一份内存状态、Planner 重启几种来源。这些都是推断，要拿实际响应体和 Planner 那边的记录来筛。

**配示例 Planner 时，404 有五类常见来源。** 示例 Planner 处理归还时先清掉已到期的租约，再查这次的借用编号；下面几种都会让 B 拿到 404，客户端一律记成「已归还」：

1. 租约已经到期，被清掉了；
2. 借用编号不存在，或者来源身份对不上；
3. 同一份租约还第二次；
4. 前一次归还其实已经生效，只是回应超时：客户端把超时算作「可以再试」，隔 30 秒再还时，Planner 那边已经删了这份租约；
5. Planner 重启过、内存里的租约全没了，或者 Planner 部署成多副本、这次归还落到了另一份内存状态。

（注：在当前上游 `main` 示例 Planner 中，来源主动撤销登记 `/remove_seed` 或心跳超时会把该 seed 标成 `draining` 停止新分配，**不会**提前删掉活跃租约；因此正在归还的活跃租约仍会收到 200，只有等租约到期被清理后才会回 404。）

它的单元测试专门验证了「到期后再还 → 404」「还第二次 → 404」以及 `draining` 期间保留活跃租约。

一个 404 是不是到期收回，可以用 B 自己的耗时记录来判（对照开篇漏斗图下栏的时间标尺）。B 每次还租约都会记录尝试次数与 `held_elapsed`（从开始申请租约到收到归还回应的耗时）。示例 Planner 从发出租约才开始计时，比 B 开始申请晚、比 B 收到回应早，所以 Planner 一侧这份租约的实际年龄必短于 `held_elapsed`（前提是期间未调钟）。按默认租约有效期 $T_{\text{lease}} = 60\text{ 秒}$（启动 Planner 时可改）：

| 情形（示意数） | 客户端记录耗时 $t_{\text{held}}$ | 与 $60\text{ 秒}$ 比较 | 能得出的判断 |
|---|---|---|---|
| 情形一 | $48.2\text{ 秒}$ | $48.2 < 60$ | 还的时候租约还没到期，这个 404 另有原因 |
| 情形二 | $75.6\text{ 秒}$ | $75.6 \ge 60$ | 到期收回成了候选之一，再拿 Planner 一侧的记录核对 |

情形一能下确定的结论：示例 Planner 只在年龄达到有效期时才按到期收回，年龄比 `48.2` 秒还短，就轮不到这一种。接着按上面的清单往下查：结果日志里这是不是第 2 或第 3 次尝试、前一次是不是「请求超时」（对应第 4 种）；借用编号与来源身份是否对得上（第 2 种）；Planner 有没有重启或落到另一副本（第 5 种）。情形二只把到期列成候选，因为其他几种 404 同样会发生。

**不要做**：把所有 400 改判成功；在没核实服务端约定之前，把 404 当成「按时归还」的证明。租约有效期、心跳有效期、从拿到租约到最后一次读取的耗时，这三个时间要分别记下来。

## 「卡住了」：必须拿到每个线程、每个 rank 的实际位置

日志长时间不动，只能说明没有新日志，不能直接证明死锁，必须分开排查三类等待位置：第一是本进程内的**会话线程与锁范围**，后台还租约的网络请求在会话锁外面发出，而显存登记与分批同步读取都在会话锁内执行；第二是**草稿模型的接力加载**，开启投机解码时，主模型加载返回后紧接着开始加载 draft 模型；第三是**其他 rank 的通信与运行时等待**，其余 rank 卡在 [CANN 与 HCCL](cann-hccl.md) 集合通信或底层设备流同步（见 [CANN Runtime 与任务下发调优](ascend-runtime-and-tuning.md)）时，也不会出现在某一行 RFork 警告里。到底是哪一种，要靠现场证据来分。

也不要按「单次请求超时 10 秒、最多 3 次」推算 30 秒后必然退出：重试之间还有等待，单次请求超时也不是端到端的截止时间，见[配置里的耗时边界](rfork-config.md#超时重试间隔和租约有效期是三个量)。

现场要拿到：线程栈、每个 rank 的最后阶段、底层读取是否还在进行、CPU / NPU 利用率、进程是否存活。再据此分清是网络等待、设备调用、锁竞争、draft 初始化，还是上层启动在等。不要因为日志里出现了「还租约」，就推断启动阻塞在还租约上。

## 给出诊断时按这六步写

1. **版本与范围**：报错的代码是否就是本章基线；哪些依赖和现场 Planner 还没核对。
2. **已经证实的事实**：引用用户日志的时间、rank、原文，再链接能支撑解释的知识页和源码位置。
3. **当前失败在哪一步、影响多大**：模型加载、租约记账、登记为来源、清理，分别是什么结果。
4. **候选原因**：按证据强弱排序，明确写「推断」，不把候选写成定因。
5. **下一步验证**：每一步说清要拿什么证据、结果 A / B 分别排除什么，不先堆一串调参命令。
6. **处理建议与验收**：只有原因足够清楚时才建议补丁；验证要覆盖复现、回退、输出一致性和资源清理。

## 哪些结论还要到现场核

上面凡是源码能说明的，都已经写成事实并在下半给出位置；剩下这几条源码说明不了，以下四条待核：

- **现场 Planner 的还租约接口**：如果不是示例实现，400、404 各代表什么，要拿它的代码或接口约定来定。
- **三条推断出的排查方向**：登记范围没覆盖、回退时显存不够、元数据端口通而数据端点不通，要现场日志和显存快照来证实。
- **实测耗时**：一次热启动的实际读速、各段耗时和还租约耗时，缺一次实机记录。
- **「卡住」时各线程停在哪里**：要现场线程栈和每个 rank 的最后阶段。

## 用 rank、模型角色和租约标识串起启动日志

以下按历史 GLM 16 卡拓扑与 `8d6180e2` 的 RFork 规则联合推演，实际清单和可用性以合并部署记录为准（拓扑见[部署前提](glm-5-3-flash-two-node.md#部署前提)）。当同构扩容实例进入借用流程时，排错账目按下面四条对齐：

- **32 套会话与成功取得时的 32 张租约**：主模型和草稿模型各开一套会话、各算一把配对键，16 个 rank 各自对应来源实例的同号 Worker。当 32 套会话全部走到借用阶段并各自成功取得租约时，共产生 32 张租约（失败重试或未命中的申请另计），还租约的结果日志也按各自租约哈希摘要与 `global_rank` 分别对号。谁向谁借见[总览页](rfork.md#谁向谁借16-个-worker-各借各的主模型和草稿模型各一套)。
- **默认 INFO 级别只有 rank 0 和 rank 8 打加载层未命中汇总**：`RFork %s seed acquisition was unsuccessful; loading locally.` 只在 `tp_rank == 0` 的 Worker 上按 INFO 打；TP8 下 `tp_rank = r mod 8`，16 个 rank 里只有 `0` 和 `8` 满足，其余 14 个 rank 及逐会话的 Planner 404 记录均需开启 `DEBUG` 才能看到。
- **读失败日志里的批数下界**：主模型所列语言张量的读取子账约为每卡 `20,572 MiB`，每批不超过 `1 GiB`，所以仅这部分就至少 `21` 批。草稿子账约 `844 MiB`，不能据此保证完整草稿只需一批：还必须确认包括表外项的实际清单不超过 `1 GiB`、切段数不超过 `512`。字节范围和未计项目见[每张卡读多少](rfork.md#每张卡读多少读的字节和常驻的权重是两本账)。
- **示例 Planner 默认 60 秒租约与可选续租**：使用仓库**示例 Planner** 的默认 `60` 秒租约且未启用 `LEASE_TTL_SEC` 续期时，主模型语言子账本身要求平均读速至少约 `0.33 GiB/s`（表外字节、取清单与归还耗时另计），到期后示例 Planner 会在清扫或借还时收回名额并使归还收到 404；若 Planner 返回 `LEASE_TTL_SEC` 并支持 `/renew_seed_lease`，客户端会在传输期间周期续租，详见[配置 · 默认 60 秒的租约够不够](rfork-config.md#默认-60-秒的租约够不够)。首次无同身份来源时的正常回退与三类可变权重绕过警告，统一对照上文[第一遍读日志表](#第一遍读日志只认出走到了哪一步)及[总览](rfork.md#这套部署现在能不能受益)。

## 常见误解

- **「最后那句汇总就是原因。」** 借租约前登记显存失败写 `destination registration failed.`；借到后的要清单、核清单、分批读三步检查没通过时，汇总一字不差只写 `transfer failed.`，原因要看它前面那条具体异常；只有某一步直接抛可恢复异常时，汇总的原因一栏才是异常原文（缺必填配置则抛 `RForkConfigurationError` 直接中止，不打汇总）。
- **「Planner 回 400，说明租约过期了。」** 示例 Planner 的 400 只来自请求头解析失败；租约到期回的是 404。
- **「回 404 就是按时还上了。」** 客户端自己的日志就写着：404 只说明那边没有这份租约。
- **「没有可用来源，就是正常冷启动。」** 申请来源的请求出错也会折算成「没借到」，要往前找「申请来源失败」。
- **「还租约失败，等于模型加载失败。」** 读完之后还租约失败，模型照常推理，只是不当来源。
- **「数据读完了，权重就一定对。」** 当前源码没有逐字节内容校验；输出异常时要拿默认加载对照。
- **「日志不动就是死锁。」** 只说明没有新日志，要拿线程栈和每个 rank 的位置。

## 对照源码

### 怎么开

排错不需要额外开关，要的是把日志打全、把 Planner 的设置记下来：

- **日志级别**：RFork 用 vLLM 的 logger，级别由 `VLLM_LOGGING_LEVEL` 决定，默认 `INFO`。[C19] 加载汇总与「没借到」只在 `tp_rank == 0` 的 Worker 上打 `info`，其余打 `debug`（`rfork_loader.py#L153-L155` 的 `_is_rfork_summary_rank`，用在 `#L165` 与 `#L884`；`session.py#L135-L141` 绑定 `seed_key` 与 `transfer_backend.py#L865-L875` 传输完成日志同样按 `tp_rank == 0` 打 `info`）；`post-load tensor layout transfer` 在 `#L819-L822` 记 `debug`；Planner 回 404 时 `acquire_seed` 只记 `debug`（`planner_client.py#L152-L154`）。要看全 rank，设 `VLLM_LOGGING_LEVEL=DEBUG`。
- **示例 Planner 的租约有效期**：`--lease-ttl-sec`，或环境变量 `RFORK_MOCK_LEASE_TTL_SEC`，默认 `DEFAULT_LEASE_TTL_SEC = 60`（`examples/rfork/rfork_planner.py#L40`、`#L74`、`#L628-L631`）；心跳有效期 `RFORK_MOCK_HEARTBEAT_TTL_SEC` 默认 60（`#L72`）。
- **还租约的重试**：默认快速阶段最多 3 次、间隔 30 秒（超次后暂态失败转 ≥60 秒慢试），单次请求超时 10 秒（`config.py#L11-L15`）。
- RFork 本身怎么开（load format 与各项设置）见[配置 · 怎么开](rfork-config.md#怎么开)。

### 会报什么错

上半「第一遍读日志」表格对应的日志原文，按社区上游 `vllm-ascend@8d6180e2` 出现顺序（`%s` 等是源码里的格式占位符，原样照抄）：

| 日志原文 | 位置与级别 | 上半的哪一步 |
|---|---|---|
| `RFork requires the YuanRong TransferEngine, MemoryRegistration, and ErrorCode APIs.` | `transfer_backend.py#L235-L237`，`ImportError`，进汇总 | 建立数据传输后端（缺依赖） |
| `YuanRong TransferEngine initialize({endpoint!r}, 'ascend', {device_name!r}) failed: {result.to_string()}` | `transfer_backend.py#L247-L250`，`RuntimeError`，进汇总 | 建立数据传输后端（初始化失败） |
| `RFork %s model initialization took %.2f seconds` | `rfork_loader.py#L791-L795`，debug | 模型骨架造好 |
| `RFork %s model uses post-load tensor layout transfer.` | `rfork_loader.py#L819-L822`，debug | 选了加载后对齐布局（processed 路径） |
| `register_memory_region time: %.4fs, weights: %d` | `transfer_backend.py#L538-L542`，debug | 显存登记完成（在借租约之前） |
| `RFork %s seed identity bound: seed_key=%s, structural_digest=%s` | `session.py#L135-L141`，tp_rank 0 为 info、其余 debug | 结构摘要与 `seed_key` 绑定完成 |
| `RFork planner seed acquisition failed: %s` | `planner_client.py#L193`，warning | 向 Planner 申请来源失败 |
| `RFork planner has no available seed for seed_key=%s` | `planner_client.py#L153`，debug | Planner 回 404 |
| `RFork %s seed acquisition was unsuccessful; loading locally.` | `rfork_loader.py#L884-L888`，tp_rank 0 为 info、其余 debug | 没有可用来源 |
| `RFork seed metadata request returned status=%s` | `seed_client.py#L71`，error | 向来源要元数据出错（非 200，含错 key 回 404） |
| `RFork seed metadata request failed for %s: %s` | `seed_client.py#L109`，error | 向来源要元数据出错（请求或 JSON 异常） |
| `Failed to transfer weights chunk %d/%d, first: %s, last: %s, ret=%s` | `transfer_backend.py#L848-L855`，error | 第 k 批读失败 |
| `RFork weight transfer completed: tp_rank=%s, weights=%d, chunks=%d, bytes=%.2f GiB, elapsed=%.4fs, throughput=%.2f GiB/s` | `transfer_backend.py#L865-L875`，tp_rank 0 为 info、其余 debug | 数据读完 |
| `RFork transfer stages: lease=%s global_rank=%s registration=%.3fs metadata=%.3fs read=%.3fs` | `session.py#L266-L273`，debug | 数据读完（含各段耗时） |
| `RFork seed promotion is deferred until the source seed lease is released; the transferred model remains available for inference.` | `session.py#L548-L551`，debug | 「当来源」延后 |
| `RFork fallback aborted because seed service or registered memory cleanup failed; tensor owners remain retained. Refusing to allocate a second model while old weights are pinned.` | `rfork_loader.py#L922-L926`，`RuntimeError` | 回退被安全门挡下 |
| `RFork transfer failed: %s, clean up and fall back to default loader` | `rfork_loader.py#L902`，warning | 汇总（仅可恢复异常） |
| `RFork transfer is disabled when %s is enabled; using the default model loader.` | `rfork_loader.py#L769-L772`、`safety.py#L9-L21`，warning | 命中 sleep mode / 在线权重传输 / `enable_eplb` 时整体绕开 |

汇总里的 `%s` 分三类来路（均在 `rfork_loader.py#L833-L902` 与 `session.py#L115-L276`）：[C8][C16]

- **借租约前登记显存返回 `False`**：`session.register_destination` 返回 `False`（`session.py#L115-L142`）时，加载器抛出 `RuntimeError("destination registration failed.")`（`rfork_loader.py#L835-L836`），汇总写 `RFork transfer failed: destination registration failed., clean up and fall back to default loader`；前面具体错误日志在 `transfer_backend.py#L416-L531`。
- **借到后传输三步检查返回 `False`**：向 A 要清单、核清单、分批读的检查不过时，`session.transfer_from_seed` 返回 `False`（`session.py#L232-L276`），加载器抛出 `RuntimeError("transfer failed.")`（`rfork_loader.py#L850-L851`），汇总一字不差只写 `RFork transfer failed: transfer failed., clean up and fall back to default loader`。这些返回 `False` 的点之前都先记一条 error 级具体日志（要元数据 `seed_client.py#L70-L110` 含自身异常 `#L108-L110`，核清单 `manifest.py#L103-L212`，比对与分批读 `transfer_backend.py#L710-L856`）。
- **直接抛异常**：缺少必填配置或严格参数非法抛 `RForkConfigurationError` 时，由 `rfork_loader.py#L889-L892` 直接重新抛出并**中止启动**（不打汇总、不回退）。其余可恢复异常 `RFORK_FALLBACK_EXCEPTIONS = (ImportError, OSError, RuntimeError, ValueError)` 由 `rfork_loader.py#L893-L902` 接住并把 `str(e)` 填进汇总，前面没有单独具体日志。已知抛出点：拼来源 URL 的 `build_seed_url`（`session.py#L250` 调用、`seed_client.py#L24-L55`，端口越界、URL 非法、端口冲突或带凭据抛 `ValueError`）；登记取不到存储所有者抛 `RuntimeError("RFork could not retain the original storage owner for a registered tensor")`（`transfer_backend.py#L419` → `#L181`）；采集张量遇歧义容器键或冲突 ID 抛 `ValueError`（`tensor_layout.py#L414-L416`、`#L440-L441`，在 `transfer_backend.py#L387` 与 `#L762` 调用）；分批 `iter_transfer_chunks`（`transfer_backend.py#L829` 调用、`#L135` / `#L137` 抛 `ValueError`）；读取 `batch_transfer_sync_read`（`#L841`）外无 `try`，引擎未初始化时 `_engine` 抛 `RuntimeError("TransferEngine is not initialized.")`（`#L279-L282`）；建会话（`rfork_loader.py#L674-L710`）、造模型（`#L782-L790`，开启 Engram CPU offload 半途失败于 `#L894-L900` 直接抛错中止）与读后处理（`#L858-L864`）也在 `#L776` 起的 `try` 内。

`acquire_seed` 把 404、非 200、租约头不全（`planner returned incomplete seed lease headers`）、端口/rank 非整数、端口 $\le 0$ 或 $> 65535$、rank $< 0$ 以及可选 `LEASE_TTL_SEC` 非法都折成 `None`（`planner_client.py#L137-L205`），加载器抛 `_RForkSeedUnavailable`（`rfork_loader.py#L847-L848`）进「没有可用来源」分支（`#L880-L888`），不打汇总。[C1]

清单类报错的原文（拒绝点在 `validate_weight_manifest` 和 `read_weights_from_seed`，完整清单见[传输页 · 会报什么错](rfork-transfer.md#会报什么错)）：[C9]

| 上半现象 | 日志原文 | 位置 |
|---|---|---|
| 张量名字差集 | `RFork manifest names differ: local_only=%s, remote_only=%s` / `RFork manifest names differ after validated shared skips: ...` | `transfer_backend.py#L756`、`#L771`；`manifest.py#L124-L129` |
| 权重条目非严格五元组 | `Invalid weight info for %s: %s` | `manifest.py#L147` |
| 数据类型不一致 | `Weight dtype mismatch for %s, expected %s, got %s` | `manifest.py#L181-L187` |
| 元素个数 / 每元素字节不一致 | `Weight info mismatch for %s, expected (%s, %s), got (%s, %s)`（比 `numel` 与 `element_size`） | `manifest.py#L171-L179` |
| NPU 存储格式缺失或不一致 | `RFork remote format manifest is missing, malformed, or differs from the weight manifest.` / `Weight storage format mismatch for %s: seed=%s local=%s. ...` | `manifest.py#L138`、`#L195-L201` |
| 条数或总字节对不上 | `RFork manifest count/bytes differ: local=(%d, %d), remote=(%d, %d)` | `manifest.py#L204-L211` |

上半说的运行期排除名单 `_RUNTIME_ONLY_TENSOR_NAMES` 定义在 `tensor_layout.py#L34`，包含全部 **3** 项：`topk_indices_buffer`、`_rope_derived_cos_cache` 与 `_rope_derived_sin_cache`；`_is_runtime_only_tensor`（`#L39-L40`）按名字末段排除在采集之外。[C10]

显存登记与清理类报错：[C2][C3]

| 上半现象 | 日志原文 | 位置 |
|---|---|---|
| 范围没被完全覆盖 | `RFork tensor range [%d, %d) is not fully covered by a registration block` | `transfer_backend.py#L460-L464` |
| 缺批量登记接口 | `RFork requires YuanRong TransferEngine with MemoryRegistration and batch_register_memory_ex support.` | `transfer_backend.py#L495-L497` |
| 登记调用抛异常 | `TransferEngine memory registration raised for batch of %d logical regions: %s` | `transfer_backend.py#L512-L515` |
| 登记返回错误码 | `TransferEngine memory registration failed for batch of %d logical regions, ret: %s` | `transfer_backend.py#L521-L524` |
| 回滚没做完 | `RFork registration rollback is incomplete; preserving registration state for retry.` | `transfer_backend.py#L528-L530` |
| 「找不到」后仍有地址没注销 | `batch_unregister_memory left %d regions registered after a not-found result.` | `transfer_backend.py#L578-L581` |
| 收尾失败 | `TransferEngine finalize failed on attempt %d/%d: %s` | `transfer_backend.py#L678-L682` |

批量注销回「找不到」时改走 `_unregister_addresses_individually` 逐地址补查（`transfer_backend.py#L573`、`#L603-L620`）；收尾只有错误码等于 `ErrorCode.kNotReady` 时才隔 `retry_interval_sec` 再试，其他错误码直接返回 `False`（`#L680-L693`）。登记范围、回退 OOM 两条的排查方向是推断。[I]

读失败按批顺序同步执行：`for index, ... in enumerate(chunks, 1)` 逐批 `batch_transfer_sync_read`，第一批出错就记日志并 `return False`（`transfer_backend.py#L839-L856`），之后清理并回退、不标就绪；源码无逐字节内容校验。[C4] metadata 端口与 TransferEngine 数据端点、advertise IP 与 TransferEngine 自动选出的 IP 的区别是推断性提醒。[I]

还租约，客户端一侧（`planner_client.py#L207-L255`，`allow_redirects=False`）与 Session 一侧（`session.py#L344-L410`）：[C6]

| 日志原文 | 位置与级别 | 结果 |
|---|---|---|
| `RFork planner lease release setup failed: %s` | `planner_client.py#L212`，warning | `REJECTED`（Planner 地址没配） |
| `RFork lease release acknowledged: lease=%s status=%s (404 means absent, not verified timely release)` | `planner_client.py#L229-L237`，200 为 debug、404 为 info | 200 / 404 → `RELEASED` |
| `RFork planner lease release rejected: lease=%s status=%s response=%r` | `planner_client.py#L239-L249`，可重试为 debug、其余为 warning | 408、429、5xx → `RETRYABLE`；其余（含 400、3xx）→ `REJECTED` |
| `RFork lease release request failed: lease=%s error=%s` | `planner_client.py#L251-L254`，debug | `requests` 异常 → `RETRYABLE` |
| `RFork lease release outcome: lease=%s attempt=%d/%d result=%s held_elapsed=%.3fs` | `session.py#L362-L369`，debug | 每次的结论；`held_elapsed` 从 `acquisition_started`（`session.py#L157`、`#L167`）算起。前一次 `requests` 超时（`RETRYABLE`）而 Planner 其实已删掉租约时，下一次就是 `attempt=2/3 result=RELEASED`（拿到的是 404） |
| `RFork lease release stopped: lease=%s attempts=%d; lease remains unresolved, worker will not advertise a seed. Model loading/inference may continue.` | `session.py#L387-L392`，error | `REJECTED` 时停止并丢掉 `_deferred_seed_start`（暂态错误超 3 次后转 ≥60s 慢试，不停止） |

日志里的 `lease=` 是 `USER_ID` 的 SHA-256 摘要前 12 位（`lease_log_id`，`planner_client.py#L33-L35`），响应体里的 `USER_ID` 换成 `<lease-id>`、截到 256 字符（`#L30`、`#L237-L238`）。

示例 Planner 一侧（`vllm-ascend@8d6180e2:examples/rfork/rfork_planner.py`）：[C11]

| 情况 | 回应 | 位置 |
|---|---|---|
| 请求头缺失或为空 | 400，`missing required header: {key}` | `#L426-L431`、`#L457-L464` |
| 端口 / rank 不是整数或越界 | 400，`invalid integer header` / `must be >= ...` | `#L433-L441`、`#L457-L464` |
| 租约到期、借用编号不存在、来源身份不符、重复归还 | 404，`lease not found`（`put_seed` 先回收到期租约再查） | `#L254-L270`、`#L320-L332`、`#L531-L547` |
| 来源心跳超时或主动 `/remove_seed` 且仍有活跃租约 | 标记 `draining`（`/remove_seed` 回 409），停止新分配，待活跃租约归还或到期后再删除记录 | `#L272-L315`、`#L549-L567` |
| 正常归还 | 200 | `#L546` |

单元测试覆盖租约到期边界、心跳不续租以及 draining 期间不直接删除活跃租约（`tests/ut/model_loader/rfork/test_rfork_planner.py#L44-L120`，来源 15）。示例 Planner 的计时用 `time.time`，租约在 `now - leased_at >= lease_ttl_sec` 时收回。现场 Planner 的约定待核。

「卡住」相关：release 请求在 session 锁外发出（`session.py#L329-L332`），注册和同步读取仍在锁内；main 完成后可能开始 draft。[I] `rfork_request_timeout_sec`（10 秒）是 Requests 单次 timeout，不是端到端截止时间。

### 开销和什么时候别开

- **开 DEBUG 的代价**：每一批读完都会多一行 `transfer weights chunk %d/%d done, time: %.4fs`（`transfer_backend.py#L857-L862`），16 个 rank、主模型至少 21 批时日志量明显变大；查完就调回 `INFO`。
- **还没核实现场 Planner 的约定之前，别改客户端分类**：把 400 改判 `RELEASED`、或把 404 改成要求重试，都会让「租约账没了结」变得看不见。
- RFork 本身什么时候不值得开（单实例部署、sleep mode / 在线权重传输 / `enable_eplb` 等），见[总览 · 开销和什么时候别开](rfork.md#开销和什么时候别开)。

### 版本差异

| 维度 | `v0.23.0` (`2c59ff10`) / `v0.26.0rc` (`2ed6cbba`) | `v0.30.0` (`c09d3e20`) | `main` (`8d6180e2`) |
|---|---|---|---|
| 错误排查模型 | 旧六文件结构，无独立 Session、manifest 校验与归还分类 | 独立 `RForkSession` + 结构摘要 + 必须返回 `LEASE_TTL_SEC` + 3 次快试转 ≥60s 慢试 + `get_rpc_port()` | 同 `v0.30.0`，`LEASE_TTL_SEC` 改为可选；`RForkConfigurationError` 直接中止启动；新增未知键 warning、协议版本 1 校验与错 key 回 404；draining 撤回回 409 |

固定镜像 `db701c1f` 与 `v0.23.0` 一致；旧开发快照 `baa023ad` 仍属六文件结构（`v0.30.0` 对照见来源 26–28）。完整四版本对照见[总览](rfork.md#版本差异)。

### 源码位置

以下都在社区上游 `vllm-ascend@8d6180e2`（除另注外均在 `vllm_ascend/model_loader/rfork/`）：

- Planner 客户端 `acquire_seed` / `release_seed_once` / `renew_seed_once`：`planner_client.py#L137-L287`
- 先登记后借租约、续租与传输三段日志：`session.py#L115-L276`
- 后台还租约（快慢重试与 `REJECTED` 停止）、延期推进与回退准备：`session.py#L289-L478`
- `start_seed_service`、心跳与 `shutdown`：`session.py#L490-L864`
- 后端初始化（`get_rpc_port`）、显存登记与回滚：`transfer_backend.py#L227-L551`
- 注销（`kNotFound` 逐地址补查）与 `finalize_transfer_engine`：`transfer_backend.py#L552-L694`
- 清单比对、视图调整、稠密布局复验与分批同步读：`transfer_backend.py#L695-L876`
- seed URL 校验与元数据请求（协议版本 `1`）：`seed_client.py#L24-L56`、`#L58-L110`
- loader 主流程、配置中止、seed miss、失败回退与安全门：`rfork_loader.py#L153-L204`、`#L747-L957`；绕过守卫 `safety.py#L9-L21`
- 严格五元组与 NPU format 校验：`manifest.py#L87-L214`
- 运行期临时张量排除名单（3 项）与冲突 ID 检测：`tensor_layout.py#L34-L42`、`#L410-L444`
- 示例 Planner：`examples/rfork/rfork_planner.py#L254-L339`、`#L426-L474`、`#L531-L567`；单测 `tests/ut/model_loader/rfork/test_rfork_planner.py#L44-L120`
- 默认值、已知键与 `RForkConfigurationError`：`config.py#L11-L51`；清理结果：`types.py#L68-L81`
- 日志级别：`vllm@0fc695fc:vllm/envs.py#L796`
