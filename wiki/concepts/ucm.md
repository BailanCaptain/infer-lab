---
id: ucm
title: UCM：共享前缀存储与 PD 传输要分开看
type: feature
summary: >-
  UCM 通过连接器把 KV 接到主机缓存和持久存储。集中式 PD 经共享存储传 KV；P2P 示例则由 Mooncake 传 KV、UCM 服务
  Prefill 前缀复用，两条路径不能混为一谈。
aliases:
  - UCM
  - Unified Cache Manager
  - UCMConnector
  - UCMConnectorV1
  - UcmPipelineStore
  - 统一缓存管理
chapters:
  - '11'
  - '13'
order: 100
sources:
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/ucm_deployment.md#L5-L38
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/ucm_deployment.md#L68-L175
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/ucm_deployment.md#L202-L206
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/ucm_deployment.md#L270-L294
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/ucm_deployment.md#L373-L416
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L37-L69
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L100-L159
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py#L194-L218
  - 'vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L59'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L85-L89'
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/ucm_deployment.html
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/ucm_deployment.md#L236-L247
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector/connector.py#L37-L324
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - main
evidence: S
relations:
  - to: prefix-caching
    kind: builds-on
    note: UCM 的前缀存储扩展复用的落点，命中收益仍来自少算已有前缀
  - to: pd-disaggregation
    kind: builds-on
    note: 集中式存储与 Mooncake P2P 是两种把 Prefill 的 KV 送给 Decode 的部署路径
  - to: kv-pool
    kind: alternative-to
    note: UCMConnector 与 AscendStoreConnector 分别接自己的存储实现，配置和容量语义不能互换
  - to: kv-cache-layerwise-offload
    kind: alternative-to
    note: 两边都有叫 use_layerwise 的开关，但这一页的写在 UCM yaml 顶层、由外部 ucm 包读，那一页的是 AscendStoreConnector 从 kv_connector_extra_config 读的另一个开关
contradicts: []
updated: '2026-09-23'
rawSources:
  - >-
    raw/sha256-b02fcec2ac497a6a4141c5124ee3aa3e4daff01994d99d56f16e32cb3aa97707.md
---

## 一句话

UCM（Unified Cache Manager）把 KV 放进 **HBM → 本机 DRAM → 存储后端**的分层体系，让前缀复用可以依托外部持久存储 [S1]。读部署图时必须分清两件事：**谁保存可复用前缀，谁把本次请求的 KV 从 Prefill 送到 Decode。**

```wiki-diagram
file: ucm
```

## 那条请求默认用不到它

[那条请求](one-request.md)是单卡、37 token 输入、200 token 输出，没有外部连接器，也没有拆开 Prefill 与 Decode。要观察 UCM，可以先加外部存储，再让两次请求共享长前缀 [A]；要观察集中式 PD，还必须把服务拆成 P、D 两端并提供它们都能访问的存储。

共享目录尤其容易误配：两个节点都写 `/mnt/test1`，不代表它们看见的是同一份文件。官方集中式 PD 示例明确要求所有 P、D 节点访问同一个共享后端，例如 NFS 挂载或 3FS [S2]。只把路径字符串配成一样，还没完成存算分离。

## 谁判命中、KV 什么时候交出去

在看部署图之前得先知道这套东西是怎么转的，否则「共享存储能当 P → D 的交接点」这句话是推不出来的。官方给的定位是：UCM 是一层**外部 KV 存储**，把存算解耦，本机 DRAM 当快取、共享后端做持久层，前缀缓存的容量因此跟着存储系统走而不是跟着卡走 [S1]。

本仓库里能读到的只有接口这一层，它分两侧：

- **调度侧决定命中。** 每个请求进来，vLLM 拿 `get_num_new_matched_tokens(request, num_computed_tokens)` 问连接器：「本机已经算出这么多 token 了，你那边还能再供上多少？」包装层原样转给外部引擎，数由它给；块分配完再用 `update_state_after_alloc` 回告实际拿到多少 [C8]。**所以命中是在排产阶段判的**，等轮到前向时，这个请求要加载多少 token 已经定死了。
- **执行侧决定落盘时机。** 前向开始前 `start_load_kv`，每层 attention 之前 `wait_for_layer_load`，本层算完 `save_kv_layer`，前向退出前 `wait_for_save` 挡住 paged buffer 被覆盖 [C7]。**KV 是在前向过程中逐层交出去的**，不是请求结束后整块搬走——这也是 yaml 里那个 `use_layerwise` 想要的东西。

**读不到的部分要说破：前缀 key 怎么算、块怎么淘汰、写是同步还是异步、重启之后靠什么把旧前缀找回来，全在外部 `ucm` 包里，这个仓库看不到。** 连 `UCM_CONFIG_FILE` 都只出现在文档的启动命令里：在三个在册提交上对 `vllm_ascend/` grep 这个键，零命中——读取和解析这份 yaml 的代码不在本仓库 [D]。

把两侧接起来，开头那个问题就有答案了：P 侧在前向途中把 KV 逐层写进外部引擎，D 侧在排产时拿 `get_num_new_matched_tokens` 问同一个引擎「这段前缀你有没有」。**两端问的是同一个引擎、同一个后端，D 问到的才会是 P 刚写进去的那份**——共享存储能当 P → D 的交接点，靠的就是这条路径，而不是 KV 在两个进程之间直接飞过去 [S2]。

## PipelineStore 的配置描述两段搬运

官方混部示例使用下面这份配置；64 是示例的主机缓存容量值，不是设备显存大小，也不是对所有模型都合适的推荐值 [S5]：

```yaml
ucm_connectors:
  - ucm_connector_name: UcmPipelineStore
    ucm_connector_config:
      store_pipeline: "Cache|Posix"
      storage_backends: /mnt/test1
      cache_buffer_capacity_gb: 64
enable_event_sync: true
use_layerwise: true
```

`Cache|Posix` 把 Device ↔ Host 与 Host ↔ 存储后端串起来 [S2]。`storage_backends` 是后端路径；混部示例允许本地 SSD 或 NFS，集中式跨节点 PD 则要求共享存储。不能把混部的本地目录原样搬到两台机器上，就认为二者已经连通。

注意末尾那两个键的归属：它们缩进在最外层，**属于这份 UCM yaml 本身，不在 `ucm_connector_config` 里面**，由外部 `ucm` 包读。`use_layerwise` 因此和 [Layerwise KV Offload](kv-cache-layerwise-offload.md) 讲的那个同名开关**不是一个东西**——那一个是 `AscendStoreConnector` 从 `--kv-transfer-config` 的 `kv_connector_extra_config` 里读的，默认关，两者既不互通也不互相覆盖。`enable_event_sync` 则是本页明摆着的一个缺口：集中式 PD [S2]、P2P 的 P 侧 [S12]、混部 [S5]，**每一份示例 yaml 里它都写着 `true`**——连 `use_layerwise` 在集中式那份翻成 `false` 时，它也还是 `true`。可那篇部署文档从头到尾没有一句话解释它管什么，本库也没有第二处能引的说法，所以这里只能照录不解释，别把它当成已经讲清楚的东西。

服务侧通过 `--kv-transfer-config` 选择 `UCMConnector`、设置 `kv_role: "kv_both"`，并在 `kv_connector_extra_config` 里用 `UCM_CONFIG_FILE` 指向上述文件 [S5]。配置入口、文件可见性、依赖安装是三件都要检查的事。

## 集中式 PD 和 P2P 的 KV 走两条不同的路

| 部署方式 | 本次 P → D 的 KV 怎么走 | UCM 在哪儿工作 |
|---|---|---|
| 集中式 PD | P 写统一存储，D 从统一存储取 | P、D 都接 UCM，存储是二者的交接点 [S2] |
| P2P PD | Mooncake 从 P 直接传给 D | UCM 在 P 侧做前缀复用；示例用 MultiConnector 组合两种连接器 [S3][S4] |

官方示例里 `use_layerwise` 的取值也沿着这条分界走：配 `true` 的两份（P2P 的 P 侧前缀缓存 [S12]、混部 [S5]）装在**会跑 Prefill 的那类实例**上；配 `false` 的那份是集中式 PD 的唯一一份 yaml，P、D 两端的 `vllm serve` 用同一个 `UCM_CONFIG_FILE` 指向它 [S2]——一份配置同时管两端，挑值时就不能只考虑 P 侧 [I]。文档没解释每个值为什么这么定，所以这些只是各部署示例的选择，不能据此推成所有版本的固定默认值。

## 这层适配只能证明接入点，证明不了存储语义

把上面那套钩子摊开看，昇腾这边的包装层做的事只有一件：构造时创建外部 UCM 包的引擎，此后每个方法都原样转过去——整个类只有 `_ucm_engine` 这一个成员，自己不留任何状态 [C6][C13]。所以**它证明的是「接得上」，不是「存得住」**——持久性、淘汰策略、故障恢复语义全在被转发的那一侧，本仓库的代码对此一个字都没有。

发布分支和 main 都有这条接入路线。v0.26 分支这里指 2026-09-17 的 rc 源码快照；main 指本库当前钉点。三版包装层的主体逻辑一致——main 那份连**行号都没动**：`UCMConnectorV1` 仍在第 37 行，`start_load_kv`、`wait_for_save`、`get_num_new_matched_tokens` 仍在第 100、151、194 行，方法体照样只有一句转发 [C6][C13]。变的只是它所在的模块路径：

| 项 | v0.23 维护分支／v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 注册指向的模块 | `kv_pool.ucm_connector` | `kv_pool.ucm_connector.connector` | 配置名仍是 `UCMConnector`；自行 import 内部模块时要留意路径变化 [C9][C10] |

另一个边界比文件搬家更重要：**三个分支虽然都有部署页，但页面前提仍写 vLLM 与 vllm-ascend 的 main，并把 UCM 安装交给外部指南** [S2]。这不能证明任意 UCM 版本与发布分支都兼容；本页的三版本核对仅覆盖仓库中已有的入口、包装层和部署说明。

## 常见误解

- **“UCM 一开，P 和 D 就一定通过存储传 KV。”**——只有集中式 PD 是这条路线；P2P 示例的传输责任仍在 Mooncake。
- **“UCMConnector 注册成功，就证明后端能持久保存。”**——注册只确认入口；读写、跨节点可见性和重启后复用仍需在实际后端验证。
- **“两次请求更快，就能把改善全部归给 UCM。”**——还应核对外部命中与本机 HBM 命中，控制前缀、路由和并发条件，否则两类收益无法区分 [I]。
