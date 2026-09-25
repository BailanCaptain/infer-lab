---
id: ucm
title: UCM：共享前缀存储与 PD 传输要分开看
type: feature
summary: >-
  把算过的前缀 KV 从卡上挪到本机内存和共享存储里存着，卡装不下、服务重启也还能复用。PD 分离时它有两种用法：集中式让 P 节点把 KV
  写进共享存储、D 节点再取出来；P2P 则由 Mooncake 直接把 KV 传给 D 节点，UCM 只在 P 节点旁边管前缀复用。两条路不能混为一谈。
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
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/ucm_deployment.md#L299-L330
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
    note: 集中式存储与 Mooncake P2P 是两种把 P 节点的 KV 送给 D 节点的部署路径
  - to: kv-pool
    kind: alternative-to
    note: UCMConnector 与 AscendStoreConnector 分别接自己的存储实现，配置和容量语义不能互换
  - to: kv-cache-layerwise-offload
    kind: alternative-to
    note: 两边都有叫 use_layerwise 的开关，但这一页的写在 UCM yaml 顶层、由外部 ucm 包读，那一页的是 AscendStoreConnector 从 kv_connector_extra_config 读的另一个开关
contradicts: []
updated: '2026-09-25'
rawSources:
  - >-
    raw/sha256-b02fcec2ac497a6a4141c5124ee3aa3e4daff01994d99d56f16e32cb3aa97707.md
---

## 卡上放不下的前缀，能不能存到硬盘上接着用？

设想一个客服服务：每条请求开头都带着同一段几千 token 的说明书。[前缀缓存](prefix-caching.md)能让第二条请求直接拿第一条算好的那段 KV，不用重算——可这些 KV 只能待在卡上。卡上的地方要先留给正在算的请求，前缀一多就被挤掉；服务一重启，全部清空。

UCM（统一缓存管理）要解决的就是这件事：**把前缀的 KV 往下挪，放进本机内存，再往下落到硬盘或共享存储里，卡装不下、服务重启了，也还能找回来接着用。**

它还顺带引出第二个问题：既然 KV 已经落在一块大家都能读的存储上，[PD 分离](pd-disaggregation.md)时 P 节点算完的 KV，能不能就经这块存储交给 D 节点？能，但这只是 UCM 的一种部署方式。读部署图时要分清两件事：**谁保存可复用的前缀，谁把这一次请求的 KV 从 P 节点送到 D 节点。**

先说例子。本库贯穿的那个模型 Qwen3.6-35B-A3B，**三个版本的支持矩阵里 PD 分离都是 ❌**（见[一条请求](one-request.md)的版本差异表），拿它讲 UCM 的 PD 部署会讲一件跑不起来的事。所以这一页沿用官方 UCM 部署文档的例子：一个 32B 的稠密模型，P 节点和 D 节点各用 4 颗 NPU 切开跑，两个 P、两个 D。机制和模型无关，换模型只是 KV 的大小变。

```wiki-diagram
file: ucm
```

## 三层：卡上、本机内存、共享存储

UCM 把 KV 放进三层：

| 层 | 在哪 | 干什么 |
|---|---|---|
| 第一层 | 卡上的显存 | 正在算的请求用，最快 |
| 第二层 | 这台机器的内存 | 常用前缀的快取，比回存储读快 |
| 第三层 | 本地硬盘，或多台机器共同挂载的存储 | 持久保存，容量跟着存储走，不跟着卡走 |

官方推荐的那种配置把这三层串成两段搬运：**卡 ↔ 本机内存**一段，**本机内存 ↔ 存储**一段。示例里本机内存那层给了 64 GB——这是示例值，不是卡上显存的大小，也不是对哪个模型都合适的推荐值。

第三层写的是一条存储路径。只在一台机器上跑时，本地硬盘也行；**一旦要让 P 节点和 D 节点经它交接，这条路径必须指向两边真的都能读到的同一份共享存储**，比如两台机器都挂上的网络文件系统。两台机器各自写了同一个目录名，不代表它们看见的是同一份文件；只把路径字符串配成一样，还没完成存算分离。

## 命中在排队时就定了，KV 在算的过程中一层层交出去

要明白「共享存储为什么能当 P → D 的交接点」，得先知道 UCM 是怎么接进 vLLM 的。它是一个 KV 连接器，和其他连接器一样分两半：

- **调度那半决定命中。** 一条请求进来排队时，调度器问连接器：「本机已经有这么多 token 的 KV 了，你那边还能再供上多少？」数由 UCM 给。分完块再回告实际拿到多少。**所以命中是在排队阶段判的**，等轮到真正算的时候，这条请求要从外面加载多少 token 已经定死了。
- **干活那半决定什么时候交出去。** 开始算之前发起加载；每层注意力算之前等这一层的 KV 到位；这一层算完就把它交出去存；整轮算完之前再等一下，确保存完了卡上的位置才被覆盖。**KV 是在计算过程中一层层交出去的**，不是请求结束后整块搬走。

把两半接起来，交接点就说得通了：P 节点在计算途中把 KV 一层层写进 UCM；D 节点排队时问同一套 UCM「这段前缀你有没有」。**两端问的是同一个后端，D 节点问到的才会是 P 节点刚写进去的那份**——集中式 PD 分离靠的就是这条路，而不是 KV 在两个进程之间直接飞过去。

也要把读不到的说破：前缀怎么算成查找的键、块怎么淘汰、写是同步还是异步、重启之后靠什么把旧前缀找回来，**全在外部的 UCM 软件包里，昇腾这个仓库里看不到**。连那份配置文件由谁读、怎么解析，也不在这个仓库里。

## 两种 PD 分离，KV 走的路不一样

| 部署方式 | 这一次 P → D 的 KV 怎么走 | UCM 在哪儿干活 |
|---|---|---|
| 集中式 | P 节点写进共享存储，D 节点从共享存储取 | P、D 两边都接 UCM，共享存储就是交接点 |
| P2P（点对点） | [Mooncake](mooncake-connector.md) 从 P 节点直接传给 D 节点 | 只在 P 节点上管前缀复用；P 节点同时挂两个连接器，D 节点只挂 Mooncake |

所以「开了 UCM，KV 就经存储传」只对集中式成立。P2P 那种，搬这一次请求 KV 的是 Mooncake，UCM 管的是「P 节点下次遇到同样的开头时少算一段」。

官方示例里还有一个细节沿着这条分界走：「算一层交一层」那个开关，在 P2P 的 P 节点和单机混部两份示例里都是打开的——这两份都装在要算提问的机器上；集中式那份是关的，而且 P、D 两边共用同一份配置。**一份配置同时管两端，挑值时就不能只看 P 节点**。文档没解释每个值为什么这么定，这些只是各示例的选择，不能当成固定默认值。

## 这层适配只证明「接得上」，证明不了「存得住」

昇腾这边给 UCM 写的那一层适配，做的事只有一件：启动时创建外部 UCM 软件包里的引擎，此后每个问题都原样转过去，自己不留任何状态。

所以**它证明的是「接得上」，不是「存得住」**。能不能持久保存、怎么淘汰、机器坏了怎么恢复，全在被转过去的那一侧，这个仓库的代码对此一个字都没有。三个版本都有这层适配，内容一样，只是 main 上换了个文件位置（见下半）。另外，三个版本的部署页写的前提都是 vLLM 与昇腾适配层的 main 开发主线，UCM 本身要按外部指南另装——这不能证明任意 UCM 版本都能配任一发布分支。

## 常见误解

- **「UCM 一开，P 节点和 D 节点就一定经存储传 KV。」**——只有集中式是这条路；P2P 那种，传输仍然是 Mooncake 的事。
- **「连接器注册成功，就证明后端能持久保存。」**——注册只确认入口；读写、跨机器可见、重启后能否复用，都要在实际后端上验证。
- **「第二次请求变快了，改善就全归 UCM。」**——还要分清是从外部存储命中的，还是卡上本来的前缀缓存命中的；前缀、路由和并发条件不控制住，两类收益分不开。

## 对照源码

### 怎么开

UCM 本身要按外部指南安装；三个分支的部署页前提都写 vLLM 与 vllm-ascend 的 main [S2]。官方的定位：UCM 是一层外部 KV 存储，HBM → 本机 DRAM → 存储后端（SSD / NFS / 3FS）三层，本机 DRAM 当快取、共享后端做持久层 [S1]。

**第一步：写 UCM 配置文件。** 官方混部示例用下面这份；`cache_buffer_capacity_gb: 64` 是主机缓存容量的示例值 [S5]：

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

- `Cache|Posix` 把 Device ↔ Host（Cache Store）与 Host ↔ 存储后端（Posix Store）串起来，文档称 PipelineStore 是推荐的 UCM 连接器 [S2]。
- `storage_backends` 是后端路径；混部示例允许本地 SSD 或 NFS，集中式跨节点 PD 则要求所有 P、D 节点访问同一个共享后端，例如 NFS 挂载或 3FS [S2]。
- 末尾两个键缩进在最外层，**属于这份 UCM yaml 本身，不在 `ucm_connector_config` 里**，由外部 `ucm` 包读。`use_layerwise` 因此和 [Layerwise KV Offload](kv-cache-layerwise-offload.md) 那个同名开关**不是一个东西**——那一个是 `AscendStoreConnector` 从 `--kv-transfer-config` 的 `kv_connector_extra_config` 里读的，默认关，两者既不互通也不互相覆盖。
- `enable_event_sync` 在集中式 PD [S2]、P2P 的 P 侧 [S12]、混部 [S5] 每一份示例 yaml 里都是 `true`（集中式那份 `use_layerwise` 翻成 `false` 时它也还是 `true`），但部署文档从头到尾没有一句话解释它管什么，本库也没有第二处能引的说法——只能照录不解释。
- `use_layerwise` 的取值：P2P 的 P 侧 [S12]、混部 [S5] 为 `true`；集中式 PD 唯一一份 yaml 为 `false`，P、D 两端的 `vllm serve` 用同一个 `UCM_CONFIG_FILE` 指向它 [S2][I]。

**第二步：服务侧挂连接器。** 通过 `--kv-transfer-config` 选 `UCMConnector`、设 `kv_role: "kv_both"`，在 `kv_connector_extra_config` 里用 `UCM_CONFIG_FILE` 指向上面的文件 [S5]。集中式 PD 的 P、D 两端都这样配，示例为 QwQ-32B、`--tensor-parallel-size 4` [S2]。

**P2P 的配法不同**：Mooncake 负责 P → D 的直传，UCM 在 Prefill 节点上提供前缀缓存 [S3]。P 侧用 `MultiConnector` 把 `MooncakeConnectorV1`（`kv_producer`）和 `UCMConnector`（`kv_both`）组合起来 [S4]；D 侧只配 `MooncakeConnectorV1`（`kv_consumer`），不挂 UCM [S14]。示例为 2P2D、两端各 TP=4 [S4][S14]。

配置入口、文件在每台机器上是否可见、依赖是否装好，是三件都要检查的事。

### 开销和什么时候别开

- 这层适配只是转发：构造时创建外部 UCM 包的引擎，整个类只有 `_ucm_engine` 一个成员，每个方法原样转过去 [C6][C13]。持久性、淘汰策略、故障恢复语义全在外部包里，本仓库无从判断；`UCM_CONFIG_FILE` 只出现在文档的启动命令里，在三个在册提交上对 `vllm_ascend/` grep 这个键零命中——读取和解析这份 yaml 的代码不在本仓库 [D]。
- 调度侧：`get_num_new_matched_tokens(request, num_computed_tokens)` 转给外部引擎给数，块分配后 `update_state_after_alloc` 回告实际拿到多少 [C8]。执行侧：前向开始前 `start_load_kv`，每层 attention 前 `wait_for_layer_load`，本层算完 `save_kv_layer`，前向退出前 `wait_for_save` 挡住 paged buffer 被覆盖 [C7]。
- 测收益时，要把外部命中与本机 HBM 前缀命中分开统计，并控制前缀、路由、并发条件，否则两类收益无法区分 [I]。
- 同名本地目录不等于共享存储：集中式跨节点 PD 若后端不是真共享，D 侧从外部引擎问不到 P 侧写入的前缀 [S2][I]。

### 版本差异

三版包装层主体逻辑一致；main 那份连行号都没动：`UCMConnectorV1` 仍在第 37 行，`start_load_kv`、`wait_for_save`、`get_num_new_matched_tokens` 仍在第 100、151、194 行，方法体照样只有一句转发。v0.26 分支指 2026-09-17 的 rc 源码快照；main 指本库当前钉点。

| 项 | v0.23 维护分支／v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 注册指向的模块 | `kv_pool.ucm_connector` | `kv_pool.ucm_connector.connector` | 配置名仍是 `UCMConnector`；自行 import 内部模块时要留意路径变化 [C9][C10] |
| 部署页 | 有 | 有 | 三个分支的前提都写 vLLM 与 vllm-ascend 的 main，UCM 安装交给外部指南 [S2]；本页的三版本核对只覆盖仓库中已有的入口、包装层和部署说明，不证明任意 UCM 版本与发布分支兼容 |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 连接器注册 | `vllm_ascend/distributed/kv_transfer/__init__.py`，`register_connector("UCMConnector", ...)` |
| 包装层（v0.23 / v0.26） | `vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector.py`，`UCMConnectorV1` |
| 包装层（main） | `vllm_ascend/distributed/kv_transfer/kv_pool/ucm_connector/connector.py` |
| 部署方式与示例配置 | `docs/source/user_guide/feature_guide/ucm_deployment.md`；在线版见 [S11] |
