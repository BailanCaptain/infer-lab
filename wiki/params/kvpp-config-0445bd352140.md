---
id: kvpp-config-0445bd352140
title: kvpp_config
type: param
summary: >-
  AscendConfig 上的 KVPP 子配置，只有 size 一个字段，由 enable_kvpp 与 TP × PCP 算出而不是用户填；写进
  additional_config 会被静默剔掉。只在 main 开发主线上有。
aliases:
  - additional_config.kvpp_config
  - KVPP 配置对象
  - KVPPConfig.from_vllm_config
  - KVPP 派生子配置
chapters:
  - '11'
origin: seed
verified:
  - main
evidence: C
updated: "2026-09-22"
relations:
  - to: kvpp
    kind: builds-on
    note: 这个对象只是 KVPP 那一套机制的开关读数，层怎么分、广播怎么发、收益与限制全在那一页
  - to: ascend-config-system
    kind: builds-on
    note: 它是工厂注入的字段而不是用户输入，能不能写、写了会怎样，由 _NON_USER_INPUT_KEYS 那条构造链决定
sources:
  - >-
    vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L518
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L518
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L60-L77'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L79-L100'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1629-L1634'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1678'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1500-L1502'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/parallel_state.py#L76-L89'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1096-L1103'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4772-L4774'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L215-L219
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L135-L159'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L97-L104'
  - >-
    https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kvpp.html
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L50'
rawSources:
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

`kvpp_config` 是 `AscendConfig` 上的一个 frozen 子配置对象，**里面只有 `size` 一个字段**——[KVPP](../concepts/kvpp.md) 把层分给谁，除的就是这个数。真正要记住的是：**它不是你能配的键**。工厂调 `KVPPConfig.from_vllm_config(vllm_config)` 算出它，读的是 `additional_config["enable_kvpp"]` 和 `tensor_parallel_size × prefill_context_parallel_size` [C3]，再作为关键字参数塞进 `AscendConfig`；`"kvpp_config"` 这个名字本身写在 `_NON_USER_INPUT_KEYS` 里，用户传进来的同名键在进 pydantic 之前就被丢掉了 [C5]。

**存在范围。** 只在 main 开发主线上有，v0.23 维护分支与 v0.26 分支（2026-09-17 源码快照）上都没有——两个分支上 `git grep -i kvpp -- vllm_ascend docs/source` 一条都不返回 [D]。那两个分支的 `AscendConfig` 还是普通类、逐个键 `.get()`，不认识的键静默忽略 [C16][C15]，所以在它们上面配这个键既不报错也不做任何事。它随哪个 PR 进来的，见下面「版本谱系」。

这一页只讲这个字段本身：谁给它赋值、谁读它、配错了会怎样。KVPP 省的是什么、每层广播多少字节、六条启动校验分别在拦什么，都在[概念页](../concepts/kvpp.md)。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 字段构成 | frozen `@config` 类，唯一字段 `size: int = 1` [C3] | 没有第二个旋钮——广播粒度、owner 怎么分都不可配，官方文档把这句话直接写了出来 [S13] |
| 谁给它赋值 | `KVPPConfig.from_vllm_config(vllm_config)` | 值是**算出来**的不是读出来的；用户往 `additional_config["kvpp_config"]` 写这条路径不通，所以扫描器现在也不把它当用户参数 [!] |
| `enable_kvpp` 为假时 | `cls()`，即 `size = 1` | 默认路径上它恒等于 1，整套机制等于不存在 |
| `enable_kvpp` 为真时 | `size = tensor_parallel_size × prefill_context_parallel_size` [C3] | TP=1、PCP=1 的单卡上开了也还是 1，什么都不会发生 |
| 写进 `additional_config` | 被 `_NON_USER_INPUT_KEYS` 过滤，无日志 [C6] | main 上别的错键会被 `extra="forbid"` 拒收，这个键不会——静默无效是唯一结局 |
| 生效阈值 | 全部消费点都写成 `size > 1` | 校验、建 `kvpp` 通信组、换 KV cache 分配路径，三件事挂的是同一个阈值 |
| 校验时机 | `size > 1` 才调 `validate()` | 那六条 `ValueError` 在 `size == 1` 时一条都不跑，单卡上配错了不会有任何提示 |
| 重复计算 | 四处各自 `from_vllm_config` 一遍 [D] | 它必须是纯推导：构造 `AscendConfig` 时算一次，platform、worker、层划分各再算一次 |
| 覆盖版本 | 只有 main 有 | v0.23 / v0.26 上连 KVPP 这套机制都不存在 |

## 为什么存在

把它做成一个对象而不是 `AscendConfig` 上一个裸的 `int`，是因为**这个数在 `AscendConfig` 建好之前就有人要用**。`parallel_state.py` 初始化 `kvpp` 通信组时读 `get_ascend_config().kvpp_config.size`，那时单例已经在了；但 `platform.py` 的启动校验跑在更早的位置，它拿不到单例，只能自己 `KVPPConfig.from_vllm_config(vllm_config)` 再算一遍 [C7]。`worker.py` 算 KV cache spec 时同理 [C9]，`map_kvpp_layers_to_owners` 在子进程里划分层归属时也同理。一个只吃 `vllm_config`、没有副作用的类方法，是让这四处算出同一个数的最省事办法。

值本身进了三条路：

- **建组**：`size > 1` 才建名为 `kvpp` 的通信组，并断言 `kvpp_size == global_pcp_size * global_tp_size`——这条断言等于把上面那条乘法又钉了一次 [C8]。
- **分层**：`divmod(层数, kvpp_size)`，前 `remainder` 个 rank 各多拿一层 [C12]。
- **换分配路径**：`size > 1` 时 model runner 直接走 `allocate_kvpp_cache`，并把 `hybrid_with_attn_and_mamba` 置回 `False` [C10]；Mooncake 的 worker 也据此决定要不要把层-owner 映射发出去 [C11]。

## 开了的代价

**它没有「开」这个动作，真正的开关是 `enable_kvpp`。** 启动命令里该写的是 `--additional-config '{"enable_kvpp": true}'`，官方那张配置表里只有这一行加上 `--enforce-eager`，并且明写「不需要配广播粒度，也没有单独的 KVPP 并行大小」[S13]（[线上页](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kvpp.html)）。

**配了 `kvpp_config` 的下场是「什么都不发生」，而且比报错更难查。** main 上的 `AscendConfig` 是 `extra="forbid"` 的 pydantic 模型，写错一个键通常会让进程起不来；但 `kvpp_config` 在进 pydantic 之前就被过滤掉了 [C6]，所以

```bash
# 这条命令能正常起来，KVPP 也确实开着，但 size=4 完全没有被采纳
vllm serve <非 hybrid 的 MLA 模型> --tensor-parallel-size 8 --enforce-eager \
    --additional-config '{"enable_kvpp": true, "kvpp_config": {"size": 4}}'
```

跑出来的 `size` 是 8（TP × PCP），不是 4。日志里一个字都不会提这件事 [!]。

**`size` 落在 1 上，代价是整条校验链都不跑。** `validate()` 的六条 `ValueError`（DCP 不为 1、连接器不对、decode 侧没关、没给 `--enforce-eager`、模型不是非 hybrid MLA、投机解码不是定步 MTP）全挂在 `size > 1` 之后 [C4][C7]。也就是说单卡上写 `enable_kvpp: true` 不会被任何一条拦住，服务照常起来，KVPP 一点没生效——想知道是不是真开了，得去看有没有建出 `kvpp` 通信组。

**按 PP stage 切、按 DP 副本分组的那几件事，也都由这一个数定死。** 组大小既然恒等于 `PCP × TP`，就意味着 KVPP 的复制域永远不跨 DP 副本、不跨 PP stage——这是 `from_vllm_config` 那两行注释给的设计意图，不是可调项。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 无 |
| releases/v0.18.0 | 无 |
| releases/v0.20.2rc | 无 |
| releases/v0.21.0rc | 无 |
| releases/v0.22.1rc | 无 |
| releases/v0.23.0 | 无 |
| releases/v0.24.0rc | 无 |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 有（6 个文件） |
| main | 有（6 个文件） |

- **引入**：2026-09-11 · 45b74a6904a2ea7b90c4f441da014003984099d2 · PR [#16094](https://github.com/vllm-project/vllm-ascend/pull/16094) —— [Feature][KVPP] Add eager KV layer parallelism with full-layer broadcast (#16094)
  包含该提交的 tag：未找到；分支：origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/revert-15908-new-refactor
  - `vllm_ascend/worker/worker.py` +26 / −4（文本行变化）
  - `vllm_ascend/platform.py` +5 / −2（文本行变化）
  - `vllm_ascend/attention/mla_v1.py` +8 / −1（文本行变化）
  - `vllm_ascend/worker/v2/attn_utils.py` +5 / −1（文本行变化）
  - `vllm_ascend/ascend_config.py` +42 / −0（文本行变化）

当前含该标识符的 tag：未找到

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["kvpp_config"]` |
| 类型 | `KVPPConfig` |
| 默认表达式 | `dataclasses.field(default_factory=KVPPConfig, kw_only=True)` |
| 定义 | `vllm_ascend/ascend_config.py:518` [C2] |
| 版本 | main · baa023ada41a5b889cac6249845a688aab130892 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
