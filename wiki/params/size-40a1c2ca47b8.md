---
id: size-40a1c2ca47b8
title: size
type: param
summary: >-
  KVPPConfig 里唯一的字段：KVPP 把层分成几份的那个除数，int、默认 1（即关闭），开了 KVPP 后等于 TP ×
  PCP，用户不能直接写。只在 main 开发主线上有。
aliases:
  - kvpp_config.size
  - additional_config.kvpp_config.size
  - KVPP 组大小
  - kvpp_size
chapters:
  - '11'
origin: seed
verified:
  - main
evidence: C
updated: "2026-09-22"
relations:
  - to: kvpp-config-0445bd352140
    kind: builds-on
    note: size 是 kvpp_config 里唯一的字段，这个数由谁算出来、为什么用户写不进去，在那一页
  - to: kvpp
    kind: builds-on
    note: 它是 KVPP 分层广播的除数，层归属、广播时机与实测收益都在那一页
sources:
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L64
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L60-L77'
  - 'vllm-ascend@baa023ad:vllm_ascend/distributed/parallel_state.py#L76-L89'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L128-L159'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1096-L1103'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_placement.py#L19-L44'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1500-L1502'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L4772-L4774'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/kvpp.md#L97-L104'
  - >-
    https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kvpp.html
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1629-L1634'
rawSources:
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

这个 `size` 是 `KVPPConfig` 里**唯一的字段**，也是 [KVPP](../concepts/kvpp.md) 那套机制里唯一的数：**一个 PP stage 上的层，要分成几份**。`int`、默认 `1`，而 `1` 就等于关——所有消费点写的都是 `size > 1`。开了 KVPP 之后它等于 `tensor_parallel_size × prefill_context_parallel_size` [C2]，你没法单独指定；能不能往 `additional_config` 里写、写了会怎样，见 [`kvpp_config`](kvpp-config-0445bd352140.md)。

**存在范围。** 只在 main 开发主线上有。v0.23 维护分支与 v0.26 分支（2026-09-17 源码快照）上没有 KVPP，`git grep -i kvpp -- vllm_ascend docs/source` 在这两个提交上一条都不返回 [D]。这一页讲的是这个数在运行时被谁除、除完影响什么。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 类型与默认 | `int = 1`，所在类是 frozen 的 [C2] | 默认值本身就是「关」；对象冻结，运行时也改不了这个数 |
| 开了之后取什么值 | `TP × PCP` [C2] | 想让它是 8，办法是把 TP 开到 8，不是去配一个 8 |
| 层怎么分 | `divmod(本 stage 的层数, size)`，前 `remainder` 个 rank 各多拿一层 [C4] | 层数不是 `size` 的整数倍时各卡不等量，显存预算按拿得最多的那张算 |
| 每块物理字节 | `自己那几层的 bundle + 2 × 最大的那一层` [C6] | 常数项 `2` 是写死的 `KVPP_SCRATCH_BUFFER_COUNT`，不随 `size` 变 |
| 压缩倍数 | `L / (ceil(L/size) + 2)`，`L` 是层数 [D] | 卡加得再多也压不过 `L / 3`——这是 KVPP 的天花板，和 TP 开多大无关 |
| 建组断言 | `assert size == global_pcp_size * global_tp_size` [C3] | 复制域永远是 PCP × TP，不跨 DP 副本、不跨 PP stage |
| 本卡在组里的编号 | `get_tp_group().rank_in_group % size` [C5] | PCP=1 时它就是 TP 组内序号；owner 编号与 TP 编号一一对应 |
| MTP 的 cache | 不参与划分，每张卡各留一份 [C4] | 开 MTP 时省下的比例比 `size` 暗示的小 |
| `size == 1` 时 | 建组、校验、换分配路径三件事全不发生 | 单卡上写 `enable_kvpp: true` 不报错也不生效 |
| 覆盖版本 | 只有 main | 两个发布分支上这个字段与整套 KVPP 都不存在 |

## 为什么存在

需要一个数的地方只有一处：`map_kvpp_layers_to_owners` 里那句 `base, remainder = divmod(len(layer_indices), kvpp_size)` [C4]。层按层号排好序之后**连续**切成 `size` 段，第 `owner_rank` 段的长度是 `base + int(owner_rank < remainder)`——前 `remainder` 个 rank 各多拿一层。这就是 `size` 的全部工作。

围着这句除法，另外三处各自读一次：

- **建组**：`parallel_state.py` 只在 `size > 1` 时建名为 `kvpp` 的通信组，并顺手断言它等于 `global_pcp_size * global_tp_size` [C3]。等式两边都是同一个乘法，所以这条断言实际是在拦「有人绕过工厂改了这个数」。
- **进校验**：`platform.py` 在启动期 `size > 1` 才调 `validate()`。
- **换分配路径**：model runner 见 `size > 1` 就改走 `allocate_kvpp_cache`，并把 `hybrid_with_attn_and_mamba` 置回 `False` [C8]；worker 则用 `get_tp_group().rank_in_group % size` 算出本卡是第几个 owner，据此建物理分配计划 [C5]。

**这个数决定的是除法的分母，不是省下的倍数。** 每卡每块的物理字节是 `persistent + KVPP_SCRATCH_BUFFER_COUNT × scratch`，其中 `scratch` 取最大的那一层、常数是写死的 `2`（一个给当前层、一个给下一层的预取）[C6]。设层数 `L`、每层字节 `b`，拿得最多的那张卡是 `ceil(L/size)` 层：

```
不开 KVPP：每卡每块 = L × b
开了之后：每卡每块 = (ceil(L / size) + 2) × b
放大倍数 = L / (ceil(L / size) + 2)
```

`size` 大到 ≥ `L` 时 `ceil` 就是 1，倍数封顶在 `L / 3` [D]。层数 60 的模型，TP 从 8 加到 16，倍数从 `60/(8+2)=6` 只涨到 `60/(4+2)=10`，再往上无论多少卡都过不了 20——**这条上限来自那个写死的 2，不是来自卡数不够。**

## 开了的代价

**它不是你配出来的，所以「调大它」这个动作不存在。** 唯一的旋钮是 `enable_kvpp`，官方配置表里就那一行加上 `--enforce-eager`，并明写「不需要配广播粒度，也不需要单独的 KVPP 并行大小」[S9]（[线上页](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kvpp.html)）。往 `additional_config` 里塞 `{"kvpp_config": {"size": 4}}` 会被 `_NON_USER_INPUT_KEYS` 静默剔掉 [C11]，实际跑的还是 `TP × PCP`。

**`size` 跟着 TP 走，意味着调 TP 会连带改变 KV 的物理摆法。** 同一份模型从 TP8 改到 TP4，除了权重切法变了，每张卡常驻的层数也从 `L/8` 变成 `L/4`，每卡 KV 容量因此掉一截；反过来把 TP 加大，省的是 KV 但每层广播的字节数不变、次数不变。两件本该独立的事被这条乘法绑在了一起。

**层数除不尽时，亏的是拿得最多的那张卡。** `divmod` 给的是「前 `remainder` 个 rank 多一层」[C4]，而块数由 `get_num_blocks` 按本卡实际字节算 [C6]——各卡算出的块数会不一样，最终全局块数取的是最小的那个，等于让多拿一层的卡决定全局容量 [I]。层数刚好是 `size` 整数倍时没有这笔损失。

**`size == 1` 是最安静的失败态。** 单卡或 TP=1、PCP=1 的场景下它恒为 1，`validate()` 那六条硬校验一条都不跑 [C7]，服务照常起来，日志里没有任何一句说 KVPP 没生效。要确认它真的开了，只能看有没有建出 `kvpp` 通信组。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 有（149 个文件） |
| releases/v0.18.0 | 有（184 个文件） |
| releases/v0.20.2rc | 有（226 个文件） |
| releases/v0.21.0rc | 有（239 个文件） |
| releases/v0.22.1rc | 有（245 个文件） |
| releases/v0.23.0 | 有（267 个文件） |
| releases/v0.24.0rc | 有（272 个文件） |
| releases/v0.25.1rc | 有（266 个文件） |
| releases/v0.26.0rc | 有（304 个文件） |
| releases/v0.27.1rc | 有（341 个文件） |
| releases/v0.28.0rc | 有（389 个文件） |
| releases/v0.29.0rc | 有（417 个文件） |
| main | 有（416 个文件） |

- **引入**：2025-02-05 · d5e7756028bd5884ade96b654555c375770a2f64 · PR [#3](https://github.com/vllm-project/vllm-ascend/pull/3) —— [Core] Init vllm-ascend (#3)
  包含该提交的 tag：v0.7.1rc1、v0.7.3、v0.7.3.post1、v0.7.3rc1、v0.7.3rc2、v0.8.4rc1、v0.8.4rc2、v0.8.5rc1、v0.9.0rc1、v0.9.0rc2、v0.9.1、v0.9.1rc1、v0.9.1rc2、v0.9.1rc3、v0.9.2rc1、v0.10.0rc1、v0.10.1rc1、v0.10.2rc1、v0.11.0、v0.11.0rc0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/v0.11.0-dev、origin/v0.7.1-dev、origin/v0.7.3-dev、origin/v0.9.1-dev
  - `vllm_ascend/__init__.py` +21 / −0（文本行变化）
  - `vllm_ascend/attention.py` +678 / −0（文本行变化）
  - `vllm_ascend/communicator.py` +28 / −0（文本行变化）
  - `vllm_ascend/model_runner.py` +620 / −0（文本行变化）
  - `vllm_ascend/ops/__init__.py` +18 / −0（文本行变化）

当前含该标识符的 tag：v0.7.1rc1、v0.7.3、v0.7.3.post1、v0.7.3rc1、v0.7.3rc2、v0.8.4rc1、v0.8.4rc2、v0.8.5rc1、v0.9.0rc1、v0.9.0rc2、v0.9.1、v0.9.1rc1、v0.9.1rc2、v0.9.1rc3、v0.9.2rc1、v0.10.0rc1、v0.10.1rc1、v0.10.2rc1、v0.11.0、v0.11.0rc0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["kvpp_config"]["size"]` |
| 类型 | `int` |
| 默认表达式 | `1` |
| 定义 | `vllm_ascend/ascend_config.py:64` [C1] |
| 版本 | main · baa023ada41a5b889cac6249845a688aab130892 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
