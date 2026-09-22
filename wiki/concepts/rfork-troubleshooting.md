---
id: rfork-troubleshooting
title: RFork 排错：从第一条异常还原版本、阶段与资源状态
type: feature
summary: >-
  给用户和 Agent 的 RFork
  工作版排错入口。按真实日志定位配置、匹配、注册、metadata、读取、租约、发布和回退，列出可证结论、候选原因及要补的证据，避免凭单行错误定因。
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
updated: '2026-09-23'
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

## 一句话

**先固定代码版本，再找第一条具体异常，最后确认失败后模型和资源停在哪个状态。** 这页的日志来自用户 RFork 工作版；它给诊断路径，不预先替某次现场事故认定根因。

## 发报错时，一次给这些信息最省来回

```text
RFork 代码提交 / 当前补丁序列：
vLLM、vllm-ascend、torch / torch_npu、CANN、YuanRong 版本：
设备型号；实例 / 节点 / Worker 拓扑：
main 还是 draft；global rank / TP rank / PP rank / EP rank：
两端模型内容版本、dtype、量化、TP/PP/DP/EP、NZ、EPLB 配置：
两端完整启动参数（凭据脱敏，保留结构与对应关系）：
Planner 是项目示例还是现场实现；版本、TTL、容量、是否多副本：
seed IP:port 与 TransferEngine session endpoint：
最早具体异常前后日志（同时保留 main/draft、相关 rank 的上下文）：
最后结果：退出 / fallback 成功 / 推理可用 / 仅 seed 发布失败 / 卡住：
复现次数、触发条件、最近修改、与默认加载的对照：
```

`USER_ID` 是租约凭据，使用可关联的脱敏值或已有 `lease=` 哈希；不要把不同 rank 的日志全部擦成同一个标识。只有一行 warning 时，Agent 应先指出缺哪些证据，不能填造调用经过。

## 第一遍读日志，只定位阶段和能证明的结果

| 日志片段 / 现象 | 到了哪里 | 可以直接确认的事实 | 下一步看哪一页 |
|---|---|---|---|
| `requires ... TransferEngine` / session 初始化失败 | 创建后端 | RFork 依赖/初始化未完成，不等于默认 loader 必然失败 | [配置](rfork-config.md) |
| `model initialization took` | 模型骨架构造后 | 本次初始化已返回，不代表已读真实权重 | [启动](rfork-startup.md) |
| `uses post-load tensor layout transfer` | processed 路径 | 选中了前置布局准备 | [布局](rfork-layout.md) |
| `planner seed acquisition failed` | 申请来源 | 请求、响应或解析失败，后面可能表现为 seed miss | [身份](rfork-identity.md) |
| `has no available ... seed` | 未取得 lease | 当前尝试会转默认 loader；正常冷启动也可能发生 | [身份](rfork-identity.md) |
| `register_memory_region time` | 注册完成 | 该次注册入口返回成功 | [内存](rfork-memory.md) |
| `seed metadata request ...` | 元数据 HTTP | 控制通道出问题，尚不能归因 native read | [传输](rfork-transfer.md) |
| `manifest names differ` / `Weight info mismatch` | 清单验收 | 结构对不上，通常在读取前就被挡住 | [传输](rfork-transfer.md) |
| `Failed to transfer weights chunk` | native read | 至少一个批次未成功，早先批次可能已写入 | [传输](rfork-transfer.md) |
| `weight transfer completed` | 读取结束 | 所列同步读取成功；继续找后处理、release 与 seed 发布 | [生命周期](rfork-lifecycle.md) |
| `seed promotion is deferred` | 本地 READY 后 | 等 source lease 确认释放，模型可继续启动 | [生命周期](rfork-lifecycle.md) |
| `fallback aborted ... weights are pinned` | 回退安全门 | 旧服务或注册资源未能安全清理，拒绝分配第二份模型 | [内存](rfork-memory.md) |

这里的阶段映射来自 Planner client、backend、Session 与 loader 的日志位置。最后一条泛化的 `RFork transfer failed` 不是足够精确的根因。[C1][C2][C4][C5][C6][C7][C8][C9]

## 有 seed 却没命中，先查 key 和容量，再查网络

候选原因包括：两端配置 fingerprint 不同、rank/角色不同、seed 上报失败、心跳失效、相同 key 下容量耗尽，或者 get_seed 请求到了没有同一份状态的 Planner 副本。这些都只是候选，不能由“无来源”四个字直接判定。[I]

收集两端 session 初始化日志、完整 key、`/add_seed` 响应与实际 Planner 记录，再查 `/get_seed` 的状态及返回头。客户端会把请求异常也转成 None，所以应向前找 acquisition failed，而不是一律解释成正常冷启动。[C1]

不要先修改 key 算法、删掉 rank 或让不同量化配置共用 fingerprint 来提高命中率；那会移除原本用于防止拿错权重的边界。

## metadata / manifest 报错，优先比较两端清单

先看[官网与工作版差异](../sources/rfork-official-guide.md)：不要用官网分隔符 key、旧成功日志或随机端口的概括直接诊断本版。若本地 seed health 成功而远端 metadata 失败，继续检查 advertise 地址、实际监听接口与跨节点访问；本地回环健康检查不覆盖它们，详见[配置](rfork-config.md)。

| 具体日志 | 优先补的证据 | 不应直接做的事 |
|---|---|---|
| `metadata request returned status=...` | seed URL、query key、响应体、服务端日志 | 把它当成 NPU 链路故障 |
| `manifest names differ: local_only=..., remote_only=...` | 两端版本、同名模型的实际可传张量列表、draft 共享范围 | 忽略差集继续读 |
| `must include shape and dtype` | 返回条目的实际 JSON 结构，是否混入旧 seed | 补一个猜测 dtype |
| `Weight dtype mismatch` | dtype、量化配置、实际 Tensor dtype | 因 element size 相同就强制转换 |
| `Weight info mismatch` | numel、element size、shape、张量名称 | 直接 reshape 成任意大小 |
| `conflicting shape metadata` | 主 manifest 与独立 shape manifest 的同名条目 | 随意选择其中一份 |

这些拒绝点见 manifest 验证。[C4][C9] 若差集里出现 `topk_indices_buffer`：工作版把它列为**运行期临时张量**，按名字排除在采集之外——它的容量由接收端自己的调度上限决定，从 seed 抄过来反而是错的。[C10] 所以两端都跑本工作版时不该看到它，看到了先查采集器版本；但其他张量的差异不能一概归因这个已知问题。

## 内存注册或清理失败，保留 native 错误与地址关系

`tensor range ... not fully covered`：检查逻辑 Tensor 范围、NPU allocator snapshot 和 exclude_blocks，重点判断是否存在部分共享或布局更换；不要扩大范围到整卡来绕过覆盖检查。[C2][I]

`batch_register_memory_ex` 缺失或失败：记录真实数据系统版本、MemoryRegistration API、错误码与该批逻辑/支撑范围；缺 API 与注册区间非法是两类问题。[C2]

`batch_unregister_memory ...`、`registration rollback is incomplete` 或 finalize `kNotReady`：保留完整连续日志与活动传输情况。只出现 not-found 不能断言整批都清掉；代码会逐地址补查。不要释放 storage owners 来制造显存下降。[C2][C3]

回退 OOM 要区分“旧模型仍被引用”与“默认 loader 自身就装不下”。同时对照 discarded compilation hooks、MoE/forward/RoPE 状态恢复和已注册内存清理；仅靠 `gc.collect` 调用次数无法证明权重已释放。[C8][I]

## 字节传输失败，HTTP 连通性只解决了一部分问题

读取失败时收集 chunk 序号、首末 weight 名、native ret、两端 TransferEngine endpoint、设备编号与网络配置。metadata 服务端口通不代表数据端点通；advertise IP 也不自动覆盖 TransferEngine 自动选出的 IP，两者的来源见[配置](rfork-config.md)的四类端点表。[I]

某一批失败时，前面的成功批次可能已经写入目标模型。工作版随后清理并回退，不允许把这份半加载模型直接标 ready。当前源码没有逐字节内容校验，因此“全部 read 返回成功”后出现输出异常，也需要做与默认加载的权重/输出对照。[C4][C8]

## `put_seed` 返回 400 / 404，要先分清现象和根因

400 在工作版 release 分类中是 REJECTED，停止该 lease 的释放重试；网络异常、408/429/5xx 才属于 RETRYABLE。200/404 是客户端认可的 RELEASED。[C1]

**400 本身不能证明 TTL 过期。** 候选还包括租约 ID 不存在、来源身份不一致、字段协议不同、路由到了另一份内存状态、Planner 重启或服务端其他校验；必须用实际响应体和服务端记录筛选。[I]

如果前面已有 `weight transfer completed`，后面只有 `worker will not advertise a seed. Model loading/inference may continue.`，可以先判断是租约账本未解决、发布被抑制；不能直接写成模型加载失败。[C6]

不要把所有 400 改判成功，也不要在未核实服务端契约前把 404 当成按时归还的证明。原始 lease TTL、心跳 TTL 与租约获得到最后 read 的耗时，必须分别记录。

## “卡住”必须拿到各线程 / rank 的实际位置

日志长期不动只能说明没有新日志，不证明死锁。工作版 release 请求在 session 锁外，注册和同步读取却仍可占有锁；main 完成后又可能开始 draft，其他 rank 的 collective 等待也不在一行 RFork warning 里。[C6][C8][I]

也不要按“request timeout=10 秒、最多 3 次”认定 30 秒后必然退出：重试间还有等待，Requests timeout 不是端到端截止时间，见[配置中的耗时边界](rfork-config.md)。

现场应取得线程栈、各 rank 的最后阶段、native read 是否在途、CPU/NPU 利用率和进程存活信息，再区分网络等待、设备调用、锁竞争、draft 初始化或上层启动等待。知识库不会因为某条日志里写了“release”就编造阻塞栈。

## Agent 应按这个格式给出诊断

1. **版本与范围**：报错代码是否匹配本章基线；哪些依赖和现场 Planner 尚未核对。
2. **已经证实的事实**：引用用户日志时间、rank、原文，再链接支持解释的知识页和源码位置。
3. **当前失败阶段与影响**：模型加载、租约记账、seed 发布、清理分别是什么结果。
4. **候选原因**：按证据强弱排序，明确写“推断”，不把候选写成定因。
5. **下一步验证**：每一步说明要拿什么证据、结果 A/B 分别排除什么，不先堆一串调参命令。
6. **处理建议与验收**：只有原因足够清楚才建议补丁；验证覆盖复现、回退、输出一致性和资源清理。

诊断记录可以保留为问答来源页，但不能凭一次对话反写工作版行为、篡改原始补丁或把尚未实测的推断升级为源码事实。
