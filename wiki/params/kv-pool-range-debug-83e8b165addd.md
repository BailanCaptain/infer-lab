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

开启开关后，Ascend Store 的后端与分层传输线程会记录三类 JSON 载荷：
1. **Mooncake 后端整键操作**（`mooncake_backend.py`）：记录非分层整块键的批量注册、写入或读取动作与键信息；
2. **Layerwise 逐层区间传输**（`layerwise/kv_transfer.py`）：每次逐层切片收发时输出层号、起止字节偏移与数据长度，用于核对 Prefill 与 Decode 两端切片几何是否严丝合缝；
3. **Layerwise 提交确认**：整组层传输收尾提交时输出对应请求/键的完成事件，用于排查悬挂未提交的接收等待。

值得特别留意的是 **`v0.30.0` 到 `main` 的入口切换**：在 `v0.30.0`（`c09d3e20`）中，同一套 `[KVPOOL_RANGE_DEBUG]` 日志由 `vllm_ascend/envs.py` 里的严格二值环境变量 `VLLM_ASCEND_KVPOOL_RANGE_DEBUG`（只接受 `"0"` 或 `"1"`）控制；到了 `main`（`8d6180e2`），环境变量被正式退役，全部消费点统一改为现读 `get_ascend_config().kv_pool_range_debug`。

## 代价与互斥边界

- **高频逐层 JSON 序列化与 I/O 放大**：在 Layerwise 模式下，每个请求每经过一层 Transformer 都会触发一次 `json.dumps` 和同步日志写入（例如 48 层模型单请求就要打几十行日志）。高并发压测或线上生产环境若忘记关回 `false`，Python 日志锁与磁盘/标准输出刷新会严重拖慢传输线程吞吐。
- **跨版本脚本切勿混写**：升级到 `main` 后如果仍沿用旧启动脚本里的 `export VLLM_ASCEND_KVPOOL_RANGE_DEBUG=1`，不会报错但一行 `[KVPOOL_RANGE_DEBUG]` 都打不出来；反过来在 `v0.30.0` 写 `"kv_pool_range_debug": true` 则会因未知 `AscendConfig` 字段直接启动失败。

## 对照源码

下表对照四个固定教学快照中 KV Pool 区间审计开关的入口形式与埋点位置：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
| --- | --- | --- | --- | --- |
| 配置入口 | 无 [C7] | 无 [C8] | `envs.VLLM_ASCEND_KVPOOL_RANGE_DEBUG`（严格 `0`/`1`）[C4][!] | `AscendConfig.kv_pool_range_debug: bool = False` [C1] |
| Mooncake 整键埋点 | — | — | `mooncake_backend.py` 读 `envs` 输出 JSON [C5] | 同文件改读 `get_ascend_config().kv_pool_range_debug` [C2] |
| 分层区间与提交埋点 | — | — | `ascend_store/kv_transfer.py` 两处读 `envs` [C6] | 迁入 `layerwise/kv_transfer.py` 两处读 `AscendConfig` [C3][!] |

- **官方文档建议**：`additional_config.md` 明确说明该键用于替代旧 `VLLM_ASCEND_KVPOOL_RANGE_DEBUG` 环境变量，并叮嘱正常运行时保持禁用以规避逐层日志开销 [S9]；逐层日志行数随层数与并发数放大由分层传输循环结构直接推导 [C3][D]。
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
