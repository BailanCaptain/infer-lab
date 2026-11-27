---
id: kv-pool-range-debug-83e8b165addd
title: kv_pool_range_debug
type: param
origin: seed
evidence: C
summary: >-
  main 分支用于替代旧环境变量 VLLM_ASCEND_KVPOOL_RANGE_DEBUG 的 KV Pool 审计日志开关（默认 false）：设为
  true 后对 Mooncake 后端整键读写及分层 KV 传输的逐层区间与提交动作输出 [KVPOOL_RANGE_DEBUG] JSON 日志。
aliases:
  - additional_config.kv_pool_range_debug
  - VLLM_ASCEND_KVPOOL_RANGE_DEBUG
  - KVPOOL_RANGE_DEBUG
  - KV Pool 区间调试日志
relations:
  - to: mooncake-connector
    kind: builds-on
    note: 整键读写事件埋在 Mooncake 后端，分层区间与提交事件埋在 Layerwise KV 传输层
  - to: pd-disaggregation
    kind: builds-on
    note: 用于联调跨实例 KV 池读写偏移、长度与提交时序，正常线上流量应保持关闭
  - to: ascend-config-system
    kind: builds-on
    note: main 分支将原本挂在 envs.py 的环境变量正式迁入 additional_config 统一受管字段
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: '2026-11-26'
legacyAnchors:
  一句话: 用途与配置入口
  为什么存在: 三类审计日志事件与版本迁移
  开了的代价: 代价与互斥边界
sources:
  - >-
    vllm-ascend@8d6180e28e0941fcfc85999bf2aafe194e98f8f6:vllm_ascend/ascend_config.py#L670
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L46-L62
  - >-
    vllm-ascend@8d6180e2:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise/kv_transfer.py#L34-L88
  - 'vllm-ascend@c09d3e20:vllm_ascend/envs.py#L83-L86'
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L43-L59
  - >-
    vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L47-L102
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L27-L60'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L90'
  - >-
    vllm-ascend@8d6180e2:docs/source/user_guide/configuration/additional_config.md#L60
rawSources:
  - >-
    raw/sha256-a32318f528e820e35d2696b603125b541a63a9489e72352ceb5367f8b56b2f06.md
---
## 用途与配置入口

在联调基于 Ascend Store / [Mooncake](../concepts/mooncake-connector.md) 的 KV Pool（尤其是逐层异步传输 Layerwise 模式）时，最难排查的是「某几层的字节区间偏移算错了」或「数据发完但对端没收到提交标记」。`kv_pool_range_debug` 是 `main` 分支在 `--additional-config` 顶层提供的结构化 JSON 审计日志开关（默认 `false`）：

```bash
vllm serve /models/Qwen3-30B-A3B \
  --tensor-parallel-size 4 --enable-expert-parallel \
  --kv-transfer-config '{"kv_connector":"AscendStoreConnector","kv_role":"kv_both","kv_connector_extra_config":{"lookup_rpc_port":"1","backend":"mooncake"}}' \
  --additional-config '{"kv_pool_range_debug": true}'
```

开启后，Ascend Store（KV Pool）传输链路会在 `INFO` 日志里打印带固定前缀 `[KVPOOL_RANGE_DEBUG]` 的单行紧凑 JSON，方便测试脚本直接按行过滤并核对整键操作、逐层地址区间和完成提交记录。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| `main` 配置入口 | `--additional-config '{"kv_pool_range_debug": true}'` | 类型 `bool`，默认 `false`；仅在集成联调时临时打开 |
| `v0.30.0` 对应入口 | 环境变量 `VLLM_ASCEND_KVPOOL_RANGE_DEBUG=1` | `v0.30.0` 严格只认 `0` / `1` 环境变量，尚无 `kv_pool_range_debug` 附加键 |
| 日志前缀与级别 | `logger.info("[KVPOOL_RANGE_DEBUG] {...}")` | 单行无空格紧凑 JSON，可直接用 `grep '\[KVPOOL_RANGE_DEBUG\]'` 提取校验 |
| 覆盖连接器范围 | `AscendStoreConnector` / `MooncakeConnectorStoreV1`（`ascend_store` 路径） | 走 `kv_p2p` 的直连连接器（如 `MooncakeLayerwiseConnector`）不经过 `ascend_store`，不会触发这三处埋点 |
| 异常容错保护 | 日志序列化与输出外层包裹异常吞没保护 | 调试日志本身遇到非预期字段类型时绝不中断实际 KV 传输 |
| 版本可用性 | `additional_config` 键仅 `main`（`8d6180e2`）支持 | `main` 下旧环境变量不再生效；标准 `v0.30.0`（未装 `vllm_omni`）传新键直接报错，`v0.23.0`/`v0.26.0rc` 用 `.get()` 静默忽略 |

## 三类审计日志事件与版本迁移

开启开关后，Ascend Store 的后端与分层传输路径按实际触发的传输事件输出三类 JSON 载荷：
1. **Mooncake 后端整键操作**（`mooncake_backend.py`）：在非分层整块键的批量注册、写入或读取完成时，按当批键记录动作与返回码；
2. **Layerwise 逐层区间传输**（`layerwise/kv_transfer.py`）：某次请求批次（`req_meta`）实际发生逐层切片收发时，每层汇总当批活跃键输出一条 `"event":"range"`，包含层号、各键起止字节偏移、请求字节数与返回码，用于核对 Prefill 与 Decode 两端切片几何是否一致；
3. **Layerwise 提交确认**：分层传输收尾提交时输出 `"event":"commit"` 及键数量与结果码，用于排查悬挂未提交的接收等待。若区间或整键日志中的 `results` 出现负值报错，可顺着键大小与地址区间继续核查宿主机锁页缓冲和内存注册状态（见[主机内存与大页](../concepts/host-memory-and-hugepages.md)）。

**`v0.30.0` 与 `main` 的配置入口不同**。`v0.30.0`（`c09d3e20`）通过 `vllm_ascend/envs.py` 中的二值环境变量 `VLLM_ASCEND_KVPOOL_RANGE_DEBUG=1`（仅接受 `"0"` 或 `"1"`）开启。`main`（`8d6180e2`）移除了该环境变量，改为在各消费点直接读取 `get_ascend_config().kv_pool_range_debug`。两版均可在触发实际 KV Pool 读写后用 `grep '\[KVPOOL_RANGE_DEBUG\]'` 检索日志，以是否出现 `{"event":...}` 行确认入口已生效。

## 代价与互斥边界

- **传输线程上的 JSON 序列化与日志 handler 开销**：埋点仅在实际走入 Ascend Store 整键读写或 Layerwise 逐层收发/提交时触发，未发生池传输的请求步不会打点。一旦进入 Layerwise 传输，每层完成当批拷贝后都会在传输线程内构造嵌套列表、调用 `json.dumps` 并交给 `logger.info`；真实 I/O 阻塞程度取决于活跃传输批次频次、模型层数以及当前 Python 日志 handler（如标准输出管道缓冲或同步写盘配置）。高并发压测与线上服务应保持默认的关闭状态，避免日志格式化与 handler 锁拖慢传输线程。
- **跨版本脚本混写互不生效**：升至 `main` 后若只保留旧脚本里的 `export VLLM_ASCEND_KVPOOL_RANGE_DEBUG=1`，进程不会报错，但传输时不会输出任何 `[KVPOOL_RANGE_DEBUG]` 日志。反过来在标准 `v0.30.0` 中传入 `"kv_pool_range_debug": true`，则会因 `AscendConfig` 不含该字段而在启动校验阶段直接失败。

## 对照源码

下表对照四个固定教学快照中 KV Pool 区间审计开关的入口形式与埋点位置：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| 配置入口 | 无 [C7] | 无 [C8] | `envs.VLLM_ASCEND_KVPOOL_RANGE_DEBUG`（严格 `0`/`1`）[C4][!] | `AscendConfig.kv_pool_range_debug: bool = False` [C1] |
| Mooncake 整键埋点 | — | — | `mooncake_backend.py` 读 `envs` 输出 JSON [C5] | 同文件改读 `get_ascend_config().kv_pool_range_debug` [C2] |
| 分层区间与提交埋点 | — | — | `ascend_store/kv_transfer.py` 两处读 `envs` [C6] | 迁入 `layerwise/kv_transfer.py` 两处读 `AscendConfig` [C3][!] |

- **官方文档与开销边界**：`additional_config.md` 说明该键用于替代旧 `VLLM_ASCEND_KVPOOL_RANGE_DEBUG` 环境变量，并建议正常运行时保持禁用以避开逐层日志开销 [S9]；实际打点按当次传输批次与层事件触发，并经 `logger.info` 交由当前日志 handler 输出 [C2][C3][D]。
- **待核**：尚无实机测量 Layerwise 高并发传输下打开本开关对 P99 TTFT 的具体退化幅度。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["kv_pool_range_debug"]` |
| 所属类 | `AscendConfig` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:670` [C1] |
| 版本 | main · 8d6180e28e0941fcfc85999bf2aafe194e98f8f6 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `AscendConfig.kv_pool_range_debug` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 无 | `7d825229` |
| releases/v0.30.0 | 无 | `c09d3e20` |
