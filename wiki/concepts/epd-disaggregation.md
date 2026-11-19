---
id: epd-disaggregation
title: EPD 分离（多模态编码器 / Prefill / Decode 三池解耦）：ECConnector 缓存交接与独立扩缩
type: feature
origin: direct
summary: >-
  EPD 分离把多模态视觉编码器拆为独立 E 节点池，经 ECConnector（ECExampleConnector / v0.30.0 ECMemcacheConnector / main AscendECMooncakeConnector）跨进程交接编码缓存，并与 MooncakeLayerwise PD 分离组成独立扩缩的 E/P/D 三池集群。
aliases:
  - EPD
  - EPD 分离
  - EPD Disaggregation
  - Disaggregated-encoder
  - 分离式编码器
  - 编码器分离
  - E 实例
  - E 节点
  - ec_transfer_config
  - ec_role
  - ECConnector
  - ECExampleConnector
  - ECMemcacheConnector
  - AscendECMooncakeConnector
  - encoder cache
  - EC 连接器
chapters:
  - '18'
order: 25
sources:
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/epd_disaggregation.md#L1-L36'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/epd_disaggregation.md#L39-L85'
  - 'vllm@ced6857a:vllm/distributed/ec_transfer/ec_connector/base.py#L1-L90'
  - 'vllm@ced6857a:vllm/distributed/ec_transfer/ec_connector/example_connector.py#L50-L65'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L646-L652'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L2311-L2320'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/ec_transfer/ec_memcache_connector.py#L1-L130'
  - 'vllm-ascend@c09d3e20:examples/disaggregated_encoder/disagg_1e1pd_example.sh#L86-L140'
  - 'vllm-ascend@c09d3e20:examples/disaggregated_encoder/disagg_epd_proxy.py#L402-L436'
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/epd_disaggregation.md#L1-L40'
  - 'vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/epd_disaggregation.md#L1-L40'
  - 'vllm-ascend@8d6180e2:vllm_ascend/distributed/ec_transfer/ec_connector/mooncake/connector.py#L1-L48'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: pd-disaggregation
    kind: builds-on
    note: 先理解 Prefill 与 Decode 分离及两池交接 KV 的基本原理，再把视觉编码器抽离为第三池 E
  - to: multimodal-inference
    kind: builds-on
    note: 掌握单实例内 ViT 视觉编码、占位覆写与编码缓存概念，才能看懂跨进程 EC 缓存交接在传什么
  - to: mooncake-connector
    kind: builds-on
    note: 完整 E/P/D 三池部署中，P→D 段由 MooncakeLayerwise 逐层推 KV，社区 main 起 E→P 段亦对接 Mooncake EC 底座
  - to: ucm
    kind: alternative-to
    note: 外部集中式缓存（如 UCM / Memcache）同样可作为跨实例复用编码嵌入的共享存储层
contradicts: []
updated: '2026-11-19'
---

**EPD 分离（Encoder–Prefill–Decode Disaggregation）是在 [PD 分离](pd-disaggregation.md) 的基础上，进一步把多模态模型中负责图像/视频/音频特征提取的编码器阶段（E 节点）拆进独立的 vLLM 实例池，通过 `ECConnector` 将编码器输出张量（encoder cache）交接给 Prefill（P 节点）或混合 PD 实例，实现“视觉编码、语言预填充、语言解码”三段各自独立配卡与扩缩容的分布式推理架构。**

单实例[多模态推理](multimodal-inference.md)虽然简单，但在高并发图文混跑集群里会立刻暴露出三重资源错配：视觉编码器（ViT）本身只有几百 MB 到 `1 GiB` 权重，却被迫跟着 32B/72B 语言主干一起开高倍 TP/EP 并占用整组高端 NPU；多张高分辨率图片突发涌入时，会阻塞同实例里的纯文本请求拉高 TTFT；而单实例内置的编码器缓存（`EncoderCacheManager`）又无法跨进程共享，同一张热门底图发到不同实例只能反复重算。EPD 分离正是为了把这三股不同脾气的负载彻底解耦。

## E / P / D 三池怎样接力：多模态经 E 预编码，纯文本直通旁路

```wiki-diagram
file: epd-fig-three-pool
```

在实际部署中，EPD 架构支持两种组合形态：**两池轻量形态（`E + PD`）**——保留单一 PD 实例跑语言模型，仅把视觉编码拆给独立 E 池；以及**三池完整形态（`E + P + D`）**——再把语言侧拆成 P 与 D 两池。

以 `examples/disaggregated_encoder/disagg_epd_proxy.py` 中的负载均衡代理为例，一条请求的完整流转路径清晰分叉：

1. **代理多路径识别与选池**：代理收到 `/v1/chat/completions` 请求后先调用 `has_mm_input(req_data)` 检查是否含图/视频/音频，并按**最小活跃 token 负载优先队列**挑选目标实例。如果只是纯文本请求，彻底绕过 E 池直通 P → D，零视觉排队等待。
2. **E 池（`ec_role = "ec_producer"`）极简执行与提前退出**：对多模态请求，代理先发一轮预编码请求（`fanout_encoder_primer`）给 E 实例。进入 `model_runner_v1` 后，只要检测到 `has_ec_transfer() and not get_ec_transfer().is_consumer`，Worker 仅执行 `self._execute_mm_encoder(scheduler_output)` 算出视觉嵌入、经 `ECConnector` 写出远端共享缓存，随即调用 `make_empty_encoder_model_runner_output` **直接提前返回，完全不跑语言模型主干也不分配海量 LLM KV Cache**。正因如此，官方脚本给 E 节点的显存水位只需设成 **`--gpu-memory-utilization 0.01`**，却能把 `--max-num-batched-tokens` 拉高到 `114688` 专心吞吐图片。
3. **P 池（`ec_role = "ec_consumer"`）拉取编码缓存并完成语言 Prefill**：E 端确认写完后，代理携带同一个 `x-request-id` 将请求转发给 P（或 PD）实例。P 端调度器发现 `ECConnector` 已命中对应 `mm_hash`，直接跳过本地 ViT 计算，由 Worker 拉回视觉嵌入填入 `encoder_cache`，完成语言主干 Prefill。
4. **D 池（`kv_role = "kv_consumer"`）承接 KV 持续解码**：在三池形态下，P 与 D 之间配合 `MooncakeLayerwiseConnector`（见 [Mooncake 连接器](mooncake-connector.md)）逐层把计算出的 KV Cache 推给 D 端（由 D 端借 Metaserver 反向触发远端 P 任务，计算与通信重叠），随后由 D 池稳态逐字吐出流式结果。

## E 池为什么远比 P/D 省卡？一笔跨节点传输账单

把 ViT 拆出来是否会带来巨大的跨机网络开销？按一张常见 `448×448` 图像（`patch_size=14`、$2 \times 2$ 合并后为 `256` 个视觉 token）与语言隐维 $D_{\text{llm}} = 4096$、`BF16`（`2 B`）算一笔直观的对比账：

| 交接内容与阶段 | 典型单图载荷体积（`256` 视觉 token，`BF16`） | 与 P→D 传递 KV Cache 的体量对照 |
|---|---|---|
| **E → P 交接视觉嵌入（Encoder Cache）** | $256 \times 4096 \times 2\text{ B} = \mathbf{2\text{ MiB}}$ | 仅单张二维嵌入矩阵，无层数乘数 $L$；若换成 16 帧视频（`4096` 视觉 token）也仅 `32 MiB` |
| **P → D 交接历史 KV（以 `Qwen3-8B` 36 层 GQA 计）** | $256 \times 36 \times 2 \times (8 \times 128) \times 2\text{ B} = \mathbf{36\text{ MiB}}$ | 随层数 $L$ 线性放大；当文本 + 视觉总长达到 `32K` token 时，整条请求的 KV 高达 **`4.5 GiB`** |

可见 **E → P 的视觉嵌入传输量通常比 P → D 的 KV 传输量小一个量级以上**。用几 MiB 的嵌入传输，换取把轻巧的 ViT 独立放到少量专用 E 卡上弹性扩缩、同时让昂贵的 P/D 集群彻底告别 ViT 干扰并跨进程共享热门图片嵌入，在多图高并发业务里非常划算。

## `ECConnector` 双角色抽象与三代连接器演进

跨进程交接视觉嵌入由 vLLM V1 的 `ECConnectorBase` 抽象统一承接，并在调度进程与设备 Worker 进程间拆成**控制面（`ECConnectorRole.SCHEDULER`）**与**数据面（`ECConnectorRole.WORKER`）**两半：

```wiki-diagram
file: epd-fig-ec-connector
```

1. **Scheduler 角色（不占 NPU 显存）**：负责调用 `check_caches_exist()` / `ensure_cache_available()` 按内容哈希 `mm_hash` 确认远端是否已存好目标嵌入，在 `update_state_after_alloc()` 里记录本步需要加载或保存的清单，打包成 `ECConnectorMetadata` 随 `SchedulerOutput` 下发给 Worker。
2. **Worker 角色（NPU 数据面读写）**：P/PD 端按元数据执行 `start_load_ec()` 将嵌入拉入本地 `encoder_cache`；E 端算完 ViT 后执行保存并由 `wait_for_save()` 确保落盘或写入远端共享内存。

在 `vllm-ascend` 的演进中，`ECConnector` 依次经历了三代实现：

| 连接器实现 | 适用定位与底层介质 | 核心机制与配置要点 |
|---|---|---|
| **`ECExampleConnector`**（上游内置） | 功能验证、单机或共享文件系统小集群 | 按 `shared_storage_path` 将视觉嵌入存成 `safetensors` 文件；支持 `ec_producer` / `ec_consumer` 角色配对 |
| **`ECMemcacheConnector`**（`v0.30.0` 新增） | 面向多实例高速内存缓存共享（`MemcacheBackend`） | 支持 `ec_both` 共享模式：命中 `mm_hash` 即跳过 ViT，未命中算完写入 Memcache；Worker 侧在 NPU 预分配并向后端 `register_buffer` 注册定长接收缓冲 `_recv_buffer`（容量 `recv_buffer_tokens` 默认 **`8192`**，须落在 `[2048, max_num_batched_tokens]` 区间内） |
| **`AscendECMooncakeConnector`**（`main` 新增） | 与 Mooncake PD 统一底座的生产级零拷贝/高速池传输 | 复用上游 `ECMooncakeConnector` 调度壳，在昇腾侧替换为 `AscendECMooncakeScheduler` 与 `AscendECMooncakeWorker`，并与同批新增的 CPU `ECConnector` 形成互补 |

## 部署时的关键限制与配置红线

- **跨进程缓存必须关闭进程内 Processor 缓存**：官方文档明确要求在启用跨进程编码缓存复用时配置 **`--mm-processor-cache-gb 0`**，避免各实例进程内缓存与跨实例共享键不一致。
- **E 节点关闭前缀缓存并拉低显存水位**：E 节点不运行语言解码、不需要大块 KV Cache，示例脚本配套设置了 `--gpu-memory-utilization 0.01`、`--no-enable-prefix-caching` 与 `--enable-request-id-headers`（供代理用 `x-request-id` 串联 E/P/D 三跳）。
- **与 PD 分离共用约束**：一旦展开成完整 `E + P + D` 三池，P 到 D 的 KV 传输仍完整受限于 [Mooncake 连接器](mooncake-connector.md) 的切分与对齐规则（如 `TP_P % TP_D == 0` 等）。

## 常见误解

- **「E 节点只是把 ViT 拆出去，启动时还是要像正常 LLM 一样预留 `0.9` 的显存给 KV Cache？」**：错。`ec_producer` 角色在 `model_runner_v1` 中算完 `_execute_mm_encoder` 后立即提前退出，不会进入语言模型前向；官方 E 节点示例显存利用率低至 `--gpu-memory-utilization 0.01`，把几乎全部多余空间留给大批量图像编码激活。
- **「开了 EPD 分离后，纯文本请求也要先去 E 节点绕一圈，反而变慢？」**：错。`disagg_epd_proxy.py` 在入口通过 `has_mm_input` 判别请求类型，纯文本请求完全不经过 E 池，直接走 P → D（或 PD），反而因为不再被多模态编码阻塞而获得更低 TTFT。
- **「`ECMemcacheConnector` 的 `recv_buffer_tokens` 设得越小越省显存，比如设成 `512` 就行？」**：错。源码 `_get_recv_buffer_tokens` 硬性要求 `2048 <= recv_buffer_tokens <= max_num_batched_tokens`（默认 `8192`），低于 `2048` 或超过批上限启动时就会直接抛 `ValueError`。
- **「用了 EPD 就必须同时部署 P 和 D 两套语言节点，不能渐进落地？」**：错。EPD 原生支持 `E + PD` 两池渐进部署（把代理的 `--prefill-servers-urls` 设为 `"disable"` 即可），先单独把视觉编码拆出去弹性扩缩，待长文与并发上量后再演进为完整 `E + P + D` 三池。

## 对照源码

### 怎么开

- **快速验证 `1E + 1PD`（共享文件系统 `ECExampleConnector`）**：E 节点以 `--gpu-memory-utilization 0.01 --no-enable-prefix-caching --enable-request-id-headers` 搭配 `--ec-transfer-config '{"ec_connector":"ECExampleConnector","ec_role":"ec_producer","ec_connector_extra_config":{"shared_storage_path":"/tmp/ec_cache"}}'` 启动；PD 节点将 `ec_role` 设为 `"ec_consumer"` 并指向同一路径，再由 `disagg_epd_proxy.py` 串联入口 [S2]。
- **`v0.30.0` 多实例 Memcache 共享缓存（`ECMemcacheConnector`）**：按如下 `--ec-transfer-config` 接入，无需修改上游 vLLM 源码：

```json
{
  "ec_connector": "ECMemcacheConnector",
  "ec_connector_module_path": "vllm_ascend.distributed.ec_transfer.ec_memcache_connector",
  "ec_role": "ec_both",
  "ec_connector_extra_config": { "recv_buffer_tokens": 8192 }
}
```

### 会报什么错

| 拦截位置 | 触发条件 | 实际报错或行为 |
|---|---|---|
| `_get_recv_buffer_tokens` | 未传 `ec_transfer_config` 或 `recv_buffer_tokens` 非整数 / 越出 `[2048, max_num_batched_tokens]` | 立即抛出 `ValueError` 拒绝启动 |
| `AscendECMooncakeConnector.__init__`（`main`） | 传入既非 `SCHEDULER` 也非 `WORKER` 的非法 `role` | 抛出 `ValueError: Unknown EC connector role` |
| `disagg_epd_proxy.forward_non_stream` | 代理未完成 `decode_session` 初始化即收到流量 | 返回 `HTTPException(status_code=500, detail="Decode session not initialized")` |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 昇腾内置 `ECConnector` 实现 | 无独立 `vllm_ascend/distributed/ec_transfer/`，沿用上游 `ECExampleConnector` 配合 `MooncakeLayerwiseConnector` | 与 `v0.23.0` 一致 | **新增 `ECMemcacheConnector`**（`ec_memcache_connector.py`），接入 `MemcacheBackend` 与注册 NPU `recv_buffer` | **新增 `AscendECMooncakeConnector`**（`ec_connector/mooncake/`）与 CPU `ECConnector`（`ec_connector/cpu/`），并保留 `ECMemcacheConnector` |
| E 节点早退与代理分流 | 已支持 `ec_producer` 执行完 `_execute_mm_encoder` 早退及 `disagg_epd_proxy.py` 双路径分流 | 与 `v0.23.0` 一致 | 延续早退机制与 `1E+1PD` / `1E+1P+1D` 双部署脚本，文档补充 `--mm-processor-cache-gb 0` 跨进程提示 | 延续早退与代理架构，数据面切换至 Mooncake EC 异步拉取（`async_store_get.py`） |

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **官方特性指南与推导**：EPD 分离三大收益（独立扩缩、降纯文本 TTFT、跨进程缓存复用）见 `epd_disaggregation.md:1-36` [S1]；`1E+1PD` / `1E+1P+1D` 部署结构、代理策略、`MooncakeLayerwiseConnector` 衔接及 `--mm-processor-cache-gb 0` 限制见同文档 `39-85` 行 [S2]。文中单图 `256` 视觉 token 对应 `2 MiB` 嵌入与 `Qwen3-8B` 36 层 GQA `36 MiB` / `4.5 GiB` KV 传输体量对照按形状与字节宽直接推导 [D]。
- **上游 `ECConnector` 抽象与调度钩子**：`ECConnectorRole`、`ECConnectorMetadata` 与 `ECConnectorBase` 双角色接口见 `vllm/distributed/ec_transfer/ec_connector/base.py:1-90` [C3]；共享文件系统示例连接器 `ECExampleConnector` 见 `example_connector.py:50-65` [C4]；调度器校验远端编码缓存就绪 `ensure_cache_available` 见 `scheduler.py:646-652` [C5]。
- **昇腾 E 节点早退、`ECMemcacheConnector` 与部署脚本**：E 节点仅跑 `_execute_mm_encoder` 并返回空输出见 `model_runner_v1.py:2311-2320` [C6]；`v0.30.0` 新增 `ECMemcacheConnector`、缓冲区 `[2048, max_num_batched_tokens]` 校验与 `register_buffer` 注册见 `ec_memcache_connector.py:1-130` [C7]；`1E+1PD` 启动参数（含 `--gpu-memory-utilization 0.01`）见 `disagg_1e1pd_example.sh:86-140` [C8]；代理多路径分流 `has_mm_input` → `fanout_encoder_primer` → `maybe_prefill` → Decode 见 `disagg_epd_proxy.py:402-436` [C9]。
- **跨版本核验锚点**：`v0.23.0` 与 `v0.26.0rc` 既有 EPD 指南分别见两分支 `epd_disaggregation.md` [S10][S11]；`main` 新增 `AscendECMooncakeConnector` 角色封装见 `ec_connector/mooncake/connector.py:1-48` [C12]；经四版本树清单确认 `ec_transfer/` 目录自 `v0.30.0` 新增并在 `main` 扩展至 `mooncake/` 与 `cpu/` [D]。
