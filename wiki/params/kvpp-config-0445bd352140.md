---
id: kvpp-config-0445bd352140
title: kvpp_config
type: param
summary: >-
  AscendConfig 上的 KVPP 子配置，只有 size 一个字段，由 enable_kvpp 与 TP × PCP 算出而不是用户填；写进
  additional_config 会被静默剔掉。在册版本里只有 main 有；GLM 双机钉住的版本没有，换到 main 开了也过不了启动检查。
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
updated: '2026-10-02'
relations:
  - to: kvpp
    kind: builds-on
    note: 这个对象只是 KVPP 那一套机制的开关读数，层怎么分、广播怎么发、收益与限制全在那一页
  - to: ascend-config-system
    kind: builds-on
    note: 它是工厂注入的字段而不是用户输入，能不能写、写了会怎样，由 _NON_USER_INPUT_KEYS 那条构造链决定
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L518'
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
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L532
  - >-
    vllm-ascend@bea70ab8fa233a06a7483337f42a1e3f2c8a117c:vllm_ascend/ascend_config.py#L546
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L629
  - >-
    vllm-ascend@4ebb3090fc3c13c26557dcaae353882e70246649:vllm_ascend/ascend_config.py#L627
rawSources:
  - >-
    raw/sha256-439f3d59c68ccbab5b7c12b7f491d8ac3c3e1a37dc972643dfd812e5f797f6a2.md
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-b6dee85cabd61a407e769b3afe87cad9ebab694e8557acb71a692aba730e6c8a.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

`kvpp_config` 是 `AscendConfig` 上的一个 frozen 子配置对象，**里面只有 `size` 一个字段**，即 KVPP 那一组有几张卡。[KVPP](../concepts/kvpp.md#kvpp-是什么) 把一组卡里各存一份、内容相同的 MLA KV cache 按层分给组里的卡，每层只由一张常驻卡长期保存；层按几张卡来分，除的就是这个数。真正要记住的是：**它不是你能配的键**。工厂调 `KVPPConfig.from_vllm_config(vllm_config)` 算出它，读的是 `additional_config["enable_kvpp"]` 和 `tensor_parallel_size × prefill_context_parallel_size` [C3]，再作为关键字参数塞进 `AscendConfig`；`"kvpp_config"` 这个名字本身写在 `_NON_USER_INPUT_KEYS` 里，用户传进来的同名键在进 pydantic 之前就被丢掉了 [C5]。

**存在范围。** 本站跟踪的三个版本里只在 main 开发主线（`baa023ad`）上有，v0.23 维护分支（`2c59ff10`）与 v0.26 分支（`2ed6cbba`）上都没有——两个分支上 `git grep -i kvpp -- vllm_ascend docs/source` 一条都不返回 [D]。那两个分支的 `AscendConfig` 还是普通类、逐个键 `.get()`，不认识的键静默忽略 [C16][C15]，所以在它们上面配这个键既不报错也不做任何事。本站 GLM 双机钉住的含 GLM 代码提交 `db701c1f` 也一样：没有 KVPP，`AscendConfig` 同样逐键 `.get()`。它随哪个 PR 进来的，见下面「版本谱系」。

这一页只讲这个字段本身：谁给它赋值、谁读它、配错了会怎样。KVPP 省的是什么、每层广播多少字节、启动检查分别在拦什么，都在[概念页](../concepts/kvpp.md)。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 字段构成 | frozen `@config` 类，唯一字段 `size: int = 1` [C3] | 没有第二个旋钮——广播粒度、owner 怎么分都不可配，官方文档把这句话直接写了出来 [S13] |
| 谁给它赋值 | `KVPPConfig.from_vllm_config(vllm_config)` | 值是**算出来**的不是读出来的；用户往 `additional_config["kvpp_config"]` 写这条路径不通，所以扫描器现在也不把它当用户参数 [!] |
| `enable_kvpp` 为假时 | `cls()`，即 `size = 1` | 默认路径上它恒等于 1，整套机制等于不存在 |
| `enable_kvpp` 为真时 | `size = tensor_parallel_size × prefill_context_parallel_size` [C3] | TP=1、PCP=1 的单卡上开了也还是 1，什么都不会发生 |
| 写进 `additional_config` | 被 `_NON_USER_INPUT_KEYS` 过滤，无日志 [C6] | main 上别的错键会被 `extra="forbid"` 拒收（装了 vLLM-Omni 时改成告警后丢弃），这个键不会——静默无效是唯一结局 |
| 生效阈值 | 全部消费点都写成 `size > 1` | 校验、建 `kvpp` 通信组、换 KV cache 分配路径，三件事挂的是同一个阈值 |
| 校验时机 | `size > 1` 才调 `validate()` | 那七条 `ValueError` 在 `size == 1` 时一条都不跑，单卡上配错了不会有任何提示 |
| 重复计算 | main `baa023ad` 上 7 处各自 `from_vllm_config` 一遍，另 3 处读单例 | 它必须是纯推导：配置工厂、platform 启动检查、worker、层划分等处各算一次，结果必须一样 |
| 覆盖版本 | 本站跟踪的三个版本里只有 main 有（v0.28.0rc / v0.29.0rc 发布分支也已带上，见「版本谱系」） | v0.23 / v0.26 和 GLM 钉住的 `db701c1f` 上连 KVPP 这套机制都不存在 |
| GLM 双机（TP8、PCP1） | 钉住版本里没有；换到 main 写 `enable_kvpp: true`，算出 `size = 8` | 过不了启动检查，见下文「开了的代价」末段 |

## 为什么存在

把它做成一个对象而不是 `AscendConfig` 上一个裸的 `int`，是因为**这个数在 `AscendConfig` 建好之前、或者在拿不到单例的地方就有人要用**。`parallel_state.py` 初始化 `kvpp` 通信组时读 `get_ascend_config().kvpp_config.size`，那时单例已经在了；但 `platform.py` 的启动校验跑在更早的位置，它拿不到单例，只能自己 `KVPPConfig.from_vllm_config(vllm_config)` 再算一遍 [C7]。`worker.py` 算 KV cache spec 时同理 [C9]，`map_kvpp_layers_to_owners` 在各个 worker 进程里划分层归属时也同理。main `baa023ad` 上调 `from_vllm_config` 的共 7 处：配置工厂首算 1 处，拿不到单例时自己重算 6 处；另有 3 处读单例。一个只吃 `vllm_config`、没有副作用的类方法，是让这些地方算出同一个数的最省事办法。

`size > 1` 这一个条件同时打开三件事。这里只说它们读这个数，各自怎么做在概念页：

- **建组**：建名为 `kvpp` 的通信组，并断言 `kvpp_size == global_pcp_size * global_tp_size`——这条断言等于把上面那条乘法又钉了一次 [C8]；组里的卡怎么排见概念页的[怎么开](../concepts/kvpp.md#怎么开)。
- **分层**：层按这个数分给组里的卡，除不尽时前几张卡各多拿一层 [C12]；怎么分、每卡留多少显存见[层怎么分](../concepts/kvpp.md#层怎么分每张卡要留多少显存)。
- **换分配路径**：model runner 改走 `allocate_kvpp_cache`，并把 `hybrid_with_attn_and_mamba` 置回 `False` [C10]；Mooncake 的 worker 也据此决定要不要把层-owner 映射发出去 [C11]。算到某层时历史怎样到位，见[概念页这一节](../concepts/kvpp.md#算到某一层时历史怎样到位)。

## 开了的代价

**它没有「开」这个动作，真正的开关是 `enable_kvpp`。** 启动命令里该写的是 `--additional-config '{"enable_kvpp": true}'`，官方那张配置表里只有这一行加上 `--enforce-eager`，并且明写「不需要配广播粒度，也没有单独的 KVPP 并行大小」[S13]（[线上页](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kvpp.html)）。

**配了 `kvpp_config` 的下场是「什么都不发生」，而且比报错更难查。** main 上的 `AscendConfig` 是 `extra="forbid"` 的 pydantic 模型，写错一个键通常会让进程起不来；但 `kvpp_config` 在进 pydantic 之前就被过滤掉了 [C6]，所以

```bash
# 这条命令能正常起来，KVPP 也确实开着，但 size=4 完全没有被采纳
vllm serve <非混合的 MLA 模型> --tensor-parallel-size 8 --enforce-eager \
    --additional-config '{"enable_kvpp": true, "kvpp_config": {"size": 4}}'
```

跑出来的 `size` 是 8（TP × PCP），不是 4。日志里一个字都不会提这件事 [!]。

**`size` 落在 1 上，代价是整条校验链都不跑。** `validate()` 的七条 `ValueError`（DCP 不为 1、连接器不对、decode 侧没关、没给 `--enforce-eager`、模型不是非混合 MLA、投机解码方法不是 `mtp`、MTP 步数不固定）全挂在 `size > 1` 之后 [C4][C7]，逐条的报错原文见概念页的[会报什么错](../concepts/kvpp.md#会报什么错)。也就是说单卡上写 `enable_kvpp: true` 不会被任何一条拦住，服务照常起来，KVPP 一点没生效——想知道是不是真开了，得去看有没有建出 `kvpp` 通信组。

**按 PP stage 切、按 DP 副本分组的那几件事，也都由这一个数定死。** 组大小既然恒等于 `PCP × TP`，就意味着 KVPP 的复制域永远不跨 DP 副本、不跨 PP stage。`from_vllm_config` 里那两行注释说的就是这个：DCP 关着时，MLA 缓存在 PCP 把 KV 收齐之后各卡一样，层的归属就在这个复制域里分，不跨 DP、PP。这是设计意图，不是可调项。

**放到 GLM 双机：这个字段只会算出 8，然后在启动检查里停下。** 本站 GLM 双机（见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)）钉住的 `db701c1f` 没有 KVPP，`enable_kvpp` 和 `kvpp_config` 写进去都被静默忽略。换到 main 写 `enable_kvpp: true`，TP8、PCP1 算出 `size = 8 × 1 = 8`，大于 1，于是 platform 调 `validate()`：先撞「只支持 eager」那条，补上 `--enforce-eager` 后再撞「只支持非混合 MLA」那条，建组、分层、换分配路径一样都走不到。报错原文见概念页的[会报什么错](../concepts/kvpp.md#会报什么错)，GLM 为什么过不了见概念页的 [GLM 一节](../concepts/kvpp.md#放到-glm-双机这套部署能开-kvpp-吗)；本部署没有任何 KVPP 实测数。

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
| releases/v0.29.0rc | 有（6 个文件） |
| main | 有（7 个文件） |

- **引入**：2026-09-11 · 45b74a6904a2ea7b90c4f441da014003984099d2 · PR [#16094](https://github.com/vllm-project/vllm-ascend/pull/16094) —— [Feature][KVPP] Add eager KV layer parallelism with full-layer broadcast (#16094)
  包含该提交的 tag：未找到；分支：origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-15908-new-refactor
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
| 定义 | `vllm_ascend/ascend_config.py:627` [C20] |
| 版本 | main · 4ebb3090fc3c13c26557dcaae353882e70246649 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
