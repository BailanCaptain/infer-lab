---
id: rfork-transfer
title: RFork 传输：先验整张清单，再按地址读字节
type: feature
summary: >-
  追踪 seed HTTP 元数据、manifest 验证、shape 对齐与 TransferEngine
  分块同步读取。解释元数据成功、字节传完和模型正确之间的边界，并给出字节计算例子。
aliases:
  - RFork manifest
  - RFork shape mismatch
  - RFork dtype mismatch
  - RFork weight transfer completed
  - Failed to transfer weights chunk
  - get_rfork_transfer_engine_info
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
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork-memory
    kind: builds-on
    note: 所有本地接收地址必须先有有效注册与保活，元数据校验不能替代内存安全
  - to: rfork-identity
    kind: builds-on
    note: key 匹配只负责挑候选来源，选中以后仍必须核验逐张量元数据
contradicts: []
updated: '2026-09-23'
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

## 一句话

**拿到 seed 不等于可以直接写内存。** 工作版先检查本地与远端张量清单，再对齐允许的 shape，最后调用 TransferEngine 分批同步读取；数据来自 seed NPU，HTTP 只传描述。[C1][C6]

```wiki-diagram
file: rfork-architecture
```

## 那条请求的 token 数，不参与这里的字节计算

RFork 在请求开始前加载权重。对[那条请求](one-request.md)的模型，传输量应对实际收集到的每个权重计算 `numel × element_size`，再求和；不能拿 37 个输入 token 或 KV 的每 token 字节数代入。

如果教学清单只有 W1=`(1024,1024)` float16 和 W2=`(1024,)` float32，那么分别是 2,097,152 与 4,096 字节，共 2,101,248 字节，约 2.004 MiB。这不是 Qwen3-0.6B 的实际权重清单，只演示算法。[A][D]

## 元数据里装的是“去哪里读”和“读哪些东西”

接收端向 seed 的 `/get_rfork_transfer_engine_info?seed_key=...` 发 GET。主要字段为：

| 字段 | 内容 | 用在哪一步 |
|---|---|---|
| `rfork_transfer_engine_info[0]` | 非空的 TransferEngine session ID | 真正数据读取的远端端点 |
| `rfork_transfer_engine_info[1]` | 名字到权重信息的映射 | 对照本地张量并生成地址列表 |
| `rfork_transfer_engine_shape_info` | 名字到 shape 的映射，可内嵌 | 与权重条目中的 shape 交叉核对 |

新服务可以在一次响应里同时返回权重与 shape 信息。老服务未内嵌 shape 字段时，客户端另请求 `/get_rfork_transfer_engine_shape_info`，而这一步的容错分两种情况，不要混为一谈：

- **这个请求抛网络异常**：只有权重条目自己已经带着完整的 shape 与 dtype，才降级继续（日志写 optional shape metadata request failed）；否则异常继续上抛，整次取元数据失败。[C1]
- **请求返回了非 200**（例如 404）：客户端不再追问，直接当作这次没有 shape 信息，由后面的清单校验兜底——那里缺 shape 或 dtype 一律拒绝。[C1][C3]

响应不是 mapping、主字段不是两项序列、session ID 为空或 weight manifest 不是 mapping，都在进入 native read 之前失败。网络异常和 JSON 解析异常会记录 metadata request failed，不能只根据 HTTP 端口连通就说这一步完成。

服务端还有一处排错区别：metadata 请求的 `seed_key` 不匹配时，当前接口返回主字段为 None 的 JSON，并非统一返回 HTTP 400；带 key 的 `/health_check_with_key` 才会对不匹配返回 400。`/rfork_fetch_seed` 只返回简单存活状态。因此要记录出错的具体路径、状态码与返回体，不能把三个接口的“成功”混用。[C9]

key 不匹配在接收端看到的也不是什么鉴权错误：主字段成了 `None`，客户端按“不是两项序列”处理，日志写 `RFork seed returned malformed transfer metadata.`。看到这句先核 seed_key，别先去查网络。[C1]

## 一项权重清单的五个量，要分清元素数与字节数

当前输出条目是 `(ptr, numel, element_size, shape, dtype)`。`ptr` 是源张量地址，`numel` 是元素个数，`element_size` 是单个元素的字节数，shape 和 dtype 说明这些字节怎样解释。

解析器兼容若干旧 tuple / mapping 表示，但“能解析”不等于“会接受传输”。最终校验要求足够的 shape 和 dtype；缺少 dtype 的老三元组不能只凭元素字节数通过。[C2][C3]

## 在第一次写入之前，整份清单必须过这些门

1. 本地和远端名称都应非空、唯一；名称集合必须匹配。已确认完全被 target 注册范围覆盖的共享项有明确跳过规则，不能把任意缺失项当共享。[C4]
2. 地址、numel、element size 必须为正整数，不能用布尔值冒充数值。shape 各维是非负整数，维度乘积等于 numel。[C2]
3. 独立 shape 清单的名称集合要与权重清单一致；同一权重的两份 shape 若冲突，直接失败。[C3]
4. 对每个本地权重，远端 numel、element size、dtype 必须一致；总条目数与总字节数还要再次对齐。[C3]
5. 整体校验通过后才 reshape，然后形成读列表、开始同步读取。某个后续张量校验失败时，不应已经悄悄把前面张量传走。[C4]

这是一组结构与类型验证，不是权重内容 checksum。当前 wire manifest 也没有携带完整的远端 stride 信息；不能把通过这些检查写成“任何非连续布局都安全”。布局兼容仍依赖两端代码、模型和硬件前提。[D]

## shape 可以改变，元素数与类型不能随意改变

seed shape 与本地 shape 相同就不动；不同但 numel 一致时，代码尝试 `tensor.data.view(seed_shape)`，失败便终止。这是共享存储上的视图调整，不是插值、转置或扩容。[C7]

例如本地 `(6,)` 与远端 `(2,3)` 都有 6 个元素，有机会调整视图；本地 6 个元素、远端 8 个元素则不能“自动适配”。即使字节数相同，float16 与 bfloat16 也不会因同为 2 字节而被接受。[A][C3]

## 一次大模型读取会切成多个 chunk

每个 tensor 的字节段若超过 1 GiB，先拆成不超过 1 GiB 的连续片段。之后把片段按累计字节不超过 1 GiB、段数不超过 512 分批；这两个上限是写死在模块里的常量，不是 CLI 参数。[C5][C10]

一个假设的 2.5 GiB 大张量会分成 1、1、0.5 GiB 三段，源与目标地址都按已传字节偏移；并不是把同一源地址重复读三遍。[A][D]

每批调用 `batch_transfer_sync_read(remote_session, client_ptrs, seed_ptrs, lengths)`。调用者是接收端，所以参数中的本地目标地址与远端源地址不要看反。任一批返回错误，记录批次、首末权重名和 native 错误，随后走失败清理。[C6]

不同名字的 alias 可能重复覆盖相同字节。实现选择保留按名称读取：仅按本地地址合并，无法证明两个名字在远端也有相同偏移映射。日志统计的 bytes 因而可能大于去重后的唯一存储量。[C6]

## “传完”只证明这些同步读成功返回

`RFork weight transfer completed` 的 weights、chunks、GiB、elapsed、GiB/s 来自这段读取。它不含模型初始化、布局准备、MR 注册和元数据 HTTP 的全部耗时；session 另有 registration / metadata / read 分段日志。[C6][C8]

它也不自动证明端到端输出与默认加载器一致。现场验收要用同一模型、采样配置与输入对照输出，并覆盖量化、MoE、main/draft 共享等实际使用路径。

## 常见误解

- **“HTTP 200 说明权重传完了”**——它只完成对应 HTTP 接口；数据还要走 TransferEngine。
- **“Weight info mismatch 一定是网络损坏”**——元素数和类型不匹配通常在任何 native read 前就被发现，先看版本与布局。
- **“吞吐高就说明启动快”**——读取可能只占启动的一部分；需要分段耗时与整体 ready 时间一起判断。
