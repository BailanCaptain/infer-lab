---
id: use-layerwise-b475778cd352
title: use_layerwise
type: param
summary: >-
  KV 池连接器的逐层开关：把 KV 的存取粒度从「整趟前向搬一次」降到「一层搬一次」。它不在 additional_config 里，真正的入口是
  --kv-transfer-config 的 kv_connector_extra_config；三个版本都有，默认 false。
origin: seed
aliases:
  - 逐层 KV 存取开关
  - kv_connector_extra_config.use_layerwise
  - layerwise 总开关
chapters:
  - '11'
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
evidence: C
updated: "2026-09-23"
relations:
  - to: kv-cache-layerwise-offload
    kind: builds-on
    note: 这个键就是那一页讲的「按层搬」的总开关，机制、收益和 buffer 复用在那一页，本页只讲键本身
  - to: kv-pool
    kind: builds-on
    note: >-
      它是 AscendStoreConnector 的 kv_connector_extra_config 里的一个键，连接器怎么挂上 vLLM KV
      Connector 接口在那一页
contradicts: []
sources:
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py#L20
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L104-L115
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L95-L102
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L22-L56
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L52-L68
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py#L26-L49
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/memcache_backend.py#L80-L93
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L672-L693
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/connector.py#L69
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_pool.md#L33'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kv_pool.md#L1215'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/context_parallel.md#L113
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L83-L92
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L570-L591
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L75-L78
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L229-L236
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L92-L101
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/connector.py#L69
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md#L195
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py#L20
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_layerwise.py#L26
rawSources:
  - >-
    raw/sha256-669514da04972a318ae33b644177e18d6c100c687828799c60d6aaf0457cc877.md
  - >-
    raw/sha256-d3d9a827c7c10514c64a59996d439dd3073b7e210488d124f267f418725693c2.md
---
## 一句话

**先说配置路径：这个键不在 `additional_config` 里**——三个版本的 `vllm_ascend/` 里都没有任何一处从 `additional_config` 读这个名字。绝大多数人要配的那一处，入口是 `--kv-transfer-config` 里的 `kv_connector_extra_config`：

```bash
--kv-transfer-config '{"kv_connector":"AscendStoreConnector","kv_role":"kv_producer",
  "kv_connector_extra_config":{"backend":"memcache","use_layerwise":true}}'
```

它是 [Layerwise KV Offload](../concepts/kv-cache-layerwise-offload.md) 的总开关：把 KV 的存取粒度从「整趟前向结束后搬一次」降到「一层算完搬一层」，让搬运与下一层的计算重叠。机制在那一页，这里只讲这个键本身。

**同名的地方有四处，别配串了。** 四处都叫 `use_layerwise`，但归属和默认值不同：

1. `AscendStoreConnector` 的 `kv_connector_extra_config`，默认 `false`——绝大多数人要配的就是这一处 [C2]；
2. P2P 连接器 `kv_p2p/sfa_pd_rd2h` 的 `kv_connector_extra_config`，默认 **`true`**（v0.26 起才有这个连接器）[C9]；
3. Yuanrong 后端自己的 JSON 配置文件（路径由环境变量 `YR_CONFIG_PATH` 给），默认 `false` [C1]——**文末自动生成区钉的是这一处**，所以那里的标识写成 `YuanrongConfig["use_layerwise"]`，指的是那份 JSON 的字段而不是 `additional_config`；官方要求它必须与第 1 处取值一致 [S11]；
4. UCM 自己那份 yaml 配置文件（路径由环境变量 `UCM_CONFIG_FILE` 给）的顶层键，由外部 `ucm` 包读取，不走 `kv_connector_extra_config`——部署示例里集中式配 `false`、P2P 与混部配 `true`，出处与读法见 [UCM](../concepts/ucm.md)。

**存在范围。** 第 1 处三个版本都有、默认值和读法一字未变 [C13] [C17]；第 2、3 处分别是 v0.26 与 main 才出现的；第 4 处由外部 `ucm` 包定义，本仓库三个版本的 UCM 包装层都只转发、不读取它。三个版本上都没有校验去比对这几处是否一致。

[那条请求](../concepts/one-request.md)用不到它：Qwen3-0.6B 单卡、没有 `--kv-transfer-config`，连接器根本不会被构造。

## 事实表

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 配置路径 | `kv_connector_extra_config["use_layerwise"]` | 同左 | 同左 | 这是第 1 处、绝大多数人要配的那一处；文末生成区钉的是第 3 处 Yuanrong JSON，别把两者混成一个键 [!] |
| 类型 / 默认 | `bool` / `false`，`.get()` 取原值 | 同左 | 同左 | 没有 pydantic 强转，JSON 里写 `"false"`（带引号）是真值 [D] |
| 后端特殊布局的判据 | `use_layerwise and backend == "memcache"`，叫 `use_gva_layerwise` | 同左 | 改由后端注册表查：`use_layerwise and layerwise_data_plane == "block_key"`，而 `mooncake` 的协议模块声明 `LAYERWISE_DATA_PLANE = "block_key"`、`memcache` 声明 `"gva"` [C4] [C21] | 同一份配置在 main 上走的是另一套数据面；`use_gva_layerwise` 和 `is_block_key_layerwise` 这两个名字在 main 上都已搜不到 [!] |
| 额外校验 | 无 | 无 | mooncake + layerwise 时 PP / PCP / DCP 任一 > 1 直接 `ValueError` | main 上多一道启动期闸门，只允许纯 TP 拓扑 |
| 对 `load_async` 的影响 | 开了就把 `load_async` 静默按成 false [C14] | 同左 | 同左 | 两个键同时配 `true` 不报错，异步加载那一半安静失效 [!] |
| 对图模式的影响 | — | — | 连接器声明 `requires_piecewise_for_cudagraph` 返回本键的值 [C3] | main 上开它会把 ACLGraph 顶成 PIECEWISE 模式 |
| 官方文档口径 | 只支持 `memcache`，`mooncake` / `yuanrong` 不支持 [S15] | 同左 | 参数表仍写「requires the memcache backend」[S10]，同一版却另有一篇 mooncake layerwise 指南 | main 上文档自相矛盾，以代码为准：mooncake 才是被专门判定的那个 [!] |
| 与 CP 的关系 | 文档明写未集成 | 同左 | KV 池化 + PCP 只支持 `use_layerwise=false` [S12] | 开了 CP 就别想同时开它 |
| 混合 KV cache | 抛 `NotImplementedError` | 同左 | 未在文档复述 | MLA + 滑窗这类多 KV 组模型上开不了 |
| Yuanrong 那一处的作用 | — | — | 为真时调度器侧也 `store.init()` 一个仅元数据的客户端 [C6] | 配错会多起/少起一个客户端，症状是元数据查询失败而不是报错 |

## 为什么存在

不开这个键时，KV 池连接器按「整趟前向」的粒度工作：一次请求的 KV 全部算完再统一写出去，或者在调度阶段一次性把命中的前缀全部拉回来。粒度粗的好处是简单，坏处是搬运完全串行在计算前后——prefill 越长，等待越久。

开了之后代码分叉的地方很多，但可以归成三类：

1. **查询起点变了。** 调度侧算「从第几个块开始查外部命中」时，非逐层模式从 `num_computed_tokens // block_size` 起步，逐层模式直接从 0 起步。
2. **异步加载被关掉。** `return need_to_allocate, self.load_async and not self.use_layerwise`——逐层模式下加载必须跟着层走，不能再交给后台线程。
3. **后端要有按层寻址的能力。** 一个块的 KV 被拆成每层一份对象，所以 key 的构造方式也得换：v0.23 / v0.26 用 `use_gva_layerwise` 把这条路硬绑在 `memcache` 上；main 把这个判断挪进了后端协议注册表——`backend_map` 给每个后端登记一个 `layerwise_protocol` 模块，连接器拿 `get_layerwise_protocol` / `get_layerwise_data_plane` 查出数据面再判 `== "block_key"` [C4]。`mooncake` 的协议模块声明 `"block_key"` [C21]，`memcache` 声明 `"gva"` 并自己持有 `extract_layout_config` 那道 opt-in 闸门 [C7]，`yuanrong` 压根没登记 layerwise 协议 [C4]。

main 上还多了一层保护，只是这一版已经不再由一个 mooncake 专用函数把关：连接器构造时调通用的 `validate_layerwise_topology`，它把 `parallel_config` 转交给后端协议自己的 `validate_topology` [C4]。mooncake 那一份检查 PP / PCP / DCP，任一大于 1 就抛 `ValueError("Mooncake block-key layerwise currently supports TP-only topology; ...")` [C5]。原因写在函数文档里——当前的 block key 里没有这几个维度的坐标，多机多维并行会让不同 rank 算出同一个 key。

## 开了的代价

**`load_async` 会被静默吃掉。** 这是最容易踩的一条：两个键都配 `true` 不会有任何提示，逐层模式直接把异步加载按成 `false` [C8]。想要的是「异步 + 逐层」，得到的是「同步 + 逐层」，性能对不上账时很难从日志里看出来 [!]。

**main 上它会改图模式。** `AscendStoreConnector.requires_piecewise_for_cudagraph` 直接返回这个键，也就是开了逐层就必须走 PIECEWISE 的 ACLGraph——整图捕获那条路用不了，图模式的收益要重新算。

**后端选错就等于没开，而文档在 main 上是错的。** 逐层需要后端支持按层寻址：v0.23 / v0.26 是 `memcache`，官方文档也明写 `mooncake` 和 `yuanrong` 不支持；到了 main，被专门判定为 block-key 逐层的变成了 `mooncake`，还专门出了一篇 mooncake layerwise 的指南 [S19]，可参数表那一行仍原封不动写着「requires the `memcache` backend」。这两句话在同一个 commit 里互相打架，以代码为准 [!]。

**并行维度上限制很硬。** main 上 mooncake + 逐层只允许纯 TP；KV 池化配 PCP 时官方要求 `use_layerwise=false`；v0.23 的限制清单里还写着混合 KV cache 会抛 `NotImplementedError`、CP 注意力尚未集成逐层的 wait/save 调用 [S16]。**这些都不是性能建议，是会让服务起不来或行为不对的硬条件。**

**三处同名配置没人帮你对齐。** Yuanrong 那份 JSON 里的 `use_layerwise` 必须与连接器 extra config 里的一致，但代码里没有任何一处做这个比对——两边写反了只会表现成调度器侧的元数据客户端起了或没起 [C6]，排查起点离现象很远。而且这三处全在 `.get()` 兜底的路径上，不受 `AscendConfig` 那套 `extra="forbid"` 管——键名拼错既不报错也没有日志，只会安静地取默认值 [C2]。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 有（3 个文件） |
| releases/v0.18.0 | 有（3 个文件） |
| releases/v0.20.2rc | 有（3 个文件） |
| releases/v0.21.0rc | 有（3 个文件） |
| releases/v0.22.1rc | 有（3 个文件） |
| releases/v0.23.0 | 有（3 个文件） |
| releases/v0.24.0rc | 有（3 个文件） |
| releases/v0.25.1rc | 有（3 个文件） |
| releases/v0.26.0rc | 有（7 个文件） |
| releases/v0.27.1rc | 有（8 个文件） |
| releases/v0.28.0rc | 有（9 个文件） |
| main | 有（9 个文件） |

- **引入**：2025-09-18 · cef43b524e5dbf24434ac330235c5c835284c580 · PR [#2913](https://github.com/vllm-project/vllm-ascend/pull/2913) —— [Feat] A Connector that supports Mooncake store (#2913)
  包含该提交的 tag：v0.11.0、v0.11.0rc0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/v0.11.0-dev
  - `vllm_ascend/worker/model_runner_v1.py` +3 / −9（文本行变化）
  - `vllm_ascend/distributed/__init__.py` +5 / −0（文本行变化）
  - `vllm_ascend/distributed/mooncake/__init__.py` +0 / −0（文本行变化）
  - `vllm_ascend/distributed/mooncake/config_data.py` +447 / −0（文本行变化）
  - `vllm_ascend/distributed/mooncake/kv_transfer.py` +251 / −0（文本行变化）

当前含该标识符的 tag：v0.11.0、v0.11.0rc0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `YuanrongConfig["use_layerwise"]` |
| 类型 | `bool` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/yuanrong_backend.py:20` [C20] |
| 版本 | main · baa023ada41a5b889cac6249845a688aab130892 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
