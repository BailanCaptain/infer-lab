---
id: enable-async-exponential
legacyAnchors:
  一句话: 它曾经提前执行哪一步，为什么自 v0.25.1rc1 起被移除？
  事实表: 对照源码
  为什么存在: 为什么叫 exponential 而不是 softmax，以及副流重叠的取舍
  开了的代价: 历史版本的六项代价、GLM 双机 MTP 形状冲突与升级清理
title: enable_async_exponential
type: param
summary: >-
  旧版采样优化开关：将随机采样用的指数分布随机数 q 提前到副流与 model forward 重叠生成。v0.23.0 默认关闭并已标记待废弃，自
  v0.25.1rc1 起整体移除；v0.26.0rc 静默忽略，v0.30.0 与 main 通常拒收（可发现 vllm_omni 时告警过滤）。
aliases:
  - 异步指数分布重叠
  - Asynchronous exponential overlap
  - additional_config.enable_async_exponential
  - do_async_exponential
chapters:
  - '19'
sources:
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L256-L263'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L90-L103'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L146-L191'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L20-L43'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2278-L2322'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L531-L537'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L76
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L114-L127'
  - 'vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/test_sampler.py#L72-L96'
  - 'vllm-ascend@baa023ad:vllm_ascend/sample/sampler.py#L21-L45'
  - 'vllm-ascend@baa023ad:vllm_ascend/sample/sampler.py#L75-L86'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L1449'
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L262
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L437-L455'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1679'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L64'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L359'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/sample/sampler.py#L33-L44'
  - >-
    raw:sha256-27ff819500f0d6e295f100ac4db34f14cf0420942b816505028d74277b7cd7a9.md#L1-L274
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L549-L565'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - 'vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L151-L198'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1492-L1578'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2247-L2291'
  - 'vllm-ascend@c09d3e20:vllm_ascend/sample/sampler.py#L18-L42'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1850-L1910'
  - 'vllm-ascend@c09d3e20:vllm_ascend/config_utils.py#L43-L50'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L2018-L2033'
  - 'vllm-ascend@8d6180e2:vllm_ascend/_310p/worker/v2/sample/random_sample.py#L12-L22'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: ascend-config-system
    kind: builds-on
    note: >-
      它只是 additional_config 里的一个键，开没开、能不能写，全由那条 AscendConfig 校验链说了算——main
      通常把它挡在启动期的正是这一环
  - to: npu-model-runner
    kind: builds-on
    note: 预填 q 的调用点就在 execute_model 里、跑模型各层之前那几行，副流能藏进 forward 全靠这个位置
  - to: sampling
    kind: builds-on
    note: 它挪动的是采样里「按概率抽」那一步要用的指数分布随机数 q；q 为什么能代替按概率抽，见 sampling
contradicts: []
updated: 2026-11-19T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-2442e12b25adb63de1772ce4e3bcff88ee8ef4434f84f27a425dd9e167cd50d2.md
  - >-
    raw/sha256-27ff819500f0d6e295f100ac4db34f14cf0420942b816505028d74277b7cd7a9.md
  - >-
    raw/sha256-703d348dfed5c48687d7ecc8b88872ff05f85ddde437c775ada624d740514e88.md
  - >-
    raw/sha256-85323d2e93b398686b5459a1de5dc797e7a82b50cc8cb5ef47056ec4e08e6cf1.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
---

## 它曾经提前执行哪一步，为什么自 v0.25.1rc1 起被移除？

`enable_async_exponential` 曾是 `additional_config`（见 [AscendConfig](../concepts/ascend-config-system.md)）下的布尔开关，改的只有一个**执行时机**：随机采样所需的指数分布随机数 $q \sim \text{Exp}(1)$ 默认在 softmax 算完后才现填；开启后，会在 [NPUModelRunner](../concepts/npu-model-runner.md) 本步 model forward 开始之前提交到副流（独立 NPU stream）`global_stream()` 预先填充，争取把生成耗时藏进模型各层前向里。

它在 `v0.23.0` 默认 `False`，且发版当天就已列入官方 Ready to Deprecate 待废弃清单——**新部署不要依赖它**。

**自 `v0.25.1rc1` 起（PR #12306），该开关连同 `do_async_exponential`、`set_q_event` 与 `async_exponential_event` 事件对象一并删除**（同批待废弃下线的还有 layer sharding、FlashComm2、multistream-overlap gate、Hamming sparse、matmul all-reduce 融合、weight prefetch 与 dynamic-batch SLO）。升级后保留旧键的行为按版本分叉：

| 版本 | 残留 `enable_async_exponential` 的行为 | 采样路径现状 |
| --- | --- | --- |
| `v0.26.0rc` | `AscendConfig` 仍为普通类逐键 `.get()`，未知顶层键静默忽略（能启动但无异步重叠） | 同步 `random_sample` 补上 `q.record_stream(torch.npu.current_stream())` |
| `v0.30.0` | `AscendConfig` 启用 `extra="forbid"` 且不豁免本键，通常直接报错；仅环境可发现 `vllm_omni` 时告警过滤未知顶层键 | `vllm_ascend/sample/sampler.py` 仅保留同步 `random_sample` |
| `main` | 同 `v0.30.0` | MRV1 采样器整体退役（仅 `310p/worker/v2` 等路径保留同步 `random_sample`） |

## 为什么叫 exponential 而不是 softmax，以及副流重叠的取舍

采样的最后一步不调用 `torch.multinomial`（会触发 CPU-NPU 同步），而是为每个词表位置生成一个服从指数分布 $\text{Exp}(1)$ 的随机数 $q$，再计算 `probs.div_(q).argmax(dim=-1)`，全程留在设备上完成按概率抽样（数学等价性见[采样 · 真实实现怎样「按概率抽」](../concepts/sampling.md#真实实现怎样按概率抽)）。

**名字里的 `exponential` 指的是 `q.exponential_()` 抽指数分布随机数，不是前一行 `logits.softmax(dim=-1, dtype=torch.float32)` 里的 `exp`**——这是该参数最容易被误解之处。

因为 `q.exponential_()` 在 NPU 上不便宜（源码注释点明它可能落到 AI CPU 执行），同步路径把它夹在 softmax 与 argmax 之间会让主流干等。异步开关把填充起点前移到 forward 之前：

```wiki-diagram
file: enable-async-exponential
```

两条路径其实都在进程级单例流 `global_stream()` 上填 `q`（同步路径同样会 `npu_stream_switch(global_stream())` 再 `wait_stream` 收回），因此本开关换来的不是「另开一条专属流」，而是**把填充时刻从采样前挪到 forward 前**。

**历史 PR #4501 的吞吐对照（TP4、`enforce-eager` 测试条件，不代表其他部署收益）**：

| 硬件与模型 | 相对关闭的吞吐变化 | 结论 |
| --- | --- | --- |
| A2 · `Qwen2.5-32B` | 约 `+2.3%` | 稠密模型见正收益 |
| A3 · `Qwen2.5-32B` / `Qwen3-32B` | 约 `+7%` / `+13.3%` | 稠密模型见正收益 |
| `Qwen3-30B`（MoE，开 EP / 不开 EP） | 约 `868 → 803 tok/s` / `-0.8%` | 无论是否开 EP 均变慢（PR 未说明原因），默认值因此保持 `False` |

精度上，只要 `q` 形状与采样行对应且元素独立服从 $\text{Exp}(1)$，目标概率分布相同；但异步路径在 forward 前无条件预生成，抽取次数、行数与随机操作顺序可能与同步路径不同，同一 seed 不能保证逐 token 位级复现（且与 `VLLM_BATCH_INVARIANT` 互斥）。

## 历史版本的六项代价、GLM 双机 MTP 形状冲突与升级清理

在仍保留本开关的 `v0.23.0`（及 `db701c1f`）上，开启它会带来六项工程代价与坑点：

1. **与 `VLLM_BATCH_INVARIANT=1` 静默互斥**：只有 `VLLM_BATCH_INVARIANT` 为假时开关才真正生效，冲突时不打任何日志；上游 e2e 测试为此专门 `monkeypatch.setenv("VLLM_BATCH_INVARIANT", "0")` 并注释其会静默关闭异步指数采样（下面旧用例写法仅作条件说明，新部署不要照抄）：

```python
llm = LLM(
    model="Qwen/Qwen3-0.6B",
    max_model_len=8192,
    dtype="bfloat16",
    max_num_seqs=32,
    tensor_parallel_size=1,
    additional_config={"enable_async_exponential": True},
)
# 同时确保 VLLM_BATCH_INVARIANT 未被设为 1，否则本项静默失效
```

2. **`q` 提前占位且生命周期覆盖整次 forward**：`do_async_exponential` 分配形状为 `(logits_indices.shape[0], vocab_size)` 的 `fp32` 张量（形参名 `head_dim` 具误导性，实际传入的是词表大小而非头维度），显存随 `batch × vocab_size` 增长、与模型层数无关。不开 MTP 时它和同步路径的 `torch.empty_like(probs)` 同样大，增量来自与 forward 激活重叠驻留；开启 MTP 时异步 `q` 按全部候选+主干行建，比同步路径仅按每请求 1 行 bonus 建更大。
3. **与 `enable_reduce_sample` 或全 greedy 步同用时白做分配**：`forward_native` 仅在 `enable_reduce_sample` 的 `else` 分支取用 `self.q`（走 reduce sample 时 `probs` 宽度是各 rank 候选拼接而非 `vocab_size`，仍调同步 `random_sample` 重抽），全 greedy 步也不走随机采样分支；但 `do_async_exponential` 调用点不检查这些条件，预填的 `q` 无人消费。
4. **取用前是 host 侧阻塞同步**：取用前执行 `self.async_event.synchronize()` 会挡住调用 CPU 线程（同步路径 `wait_stream` 仅在设备侧排序、不挡 host），在 async scheduling 下会拖慢 host 提前准备下一步（源码注释仅写 `Add synchronize to prevent synchronize error`，未说明为何不用 `wait_event`）。
5. **跨流分配缺少 `record_stream`**：`q` 在 `global_stream()` 分配却在默认流被 `div_` 消费，`v0.23.0` 的异步与同步路径均未调 `record_stream`，存在显存分配器提前回收复用的潜在风险；`v0.26.0rc` 与 `v0.30.0` 在同步 `random_sample` 中补上了 `q.record_stream(torch.npu.current_stream())`。
6. **升级到 `v0.30.0` / `main` 必须删掉该键**：`v0.25.1rc1` 起已整体删除，`v0.26.0rc` 静默忽略（启动成功不等于重叠存在），`v0.30.0` 与 `main` 通常以 `extra="forbid"` 报错（仅环境可发现 `vllm_omni` 时告警过滤）。

**放到 GLM 双机部署（历史例外 B 算例）**：采样站位置见[sampling · 放到 GLM 双机](../concepts/sampling.md#放到-glm-双机采样在哪一步谁来做)。固定镜像 `db701c1f` 与 `v0.23.0` 虽带该开关，但默认 `False` 且启动命令未传 `additional_config`，**本部署一直走同步采样**。

假如强行开启，除 8 张 TP 卡各跑一份采样带来的显存占位（按 GLM `154880` 词表算，每行 `q` 占 $154880 \times 4\text{ B} = 619{,}520\text{ B}$，R1 的 4 行约 `2.36 MiB`、满载 128 行约 `75.6 MiB`）外，还会遇到 **MTP 行数冲突**：本部署默认按 `T = 1, top-p = 0.95` 随机采样且开启 MTP，`q` 按全部 logits 索引行（每请求「候选数 + 1」，通常 4 行）分配，而拒绝采样器只把每请求 1 行 bonus logits 交给采样器，取用处直接拿整块 `q` 原地相除而不切片——非零候选导致 `q` 行数大于输出行数，按源码推断会触发形状错误（尚未在设备复现；该功能后续已被整体移除）。

## 对照源码

下表对照 `enable_async_exponential` 在四个固定版本快照中的存续状态、采样同步与 `record_stream` 变化：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) |
|---|---|---|---|---|
| 开关与官方状态 | 存在，默认 `False`，已列 Ready to Deprecate [C1][S8] | 已移除（PR #12306），顶层键静默忽略 [C17] | 已移除，通常被 `extra="forbid"` 拒收；可发现 `vllm_omni` 时告警过滤 [C26][C27][!] | 同 `v0.30.0` [C28] |
| 同步路径 `record_stream` | 无 [C4] | 已补 `q.record_stream(...)` [C18] | 保留同步 `random_sample` 及 `record_stream` [C25] | MRV1 `sampler.py` 退役；310P v2 等路径保持同步采样 [C29] |
| `VLLM_BATCH_INVARIANT=1` | 静默置回 `False`（e2e 用例注释确认）[C1][C9] | — | — | — |
| 取用同步方式与公式 | host 侧 `Event.synchronize()`；`probs.div_(q).argmax(dim=-1)` [C3] | 设备侧 `wait_stream`；同式 | 设备侧 `wait_stream`；同式 [C25] | 同式 |

- **旧实现、副流位置与 PR 吞吐**：`v0.23.0` 的 `do_async_exponential` / `set_q_event` / AI CPU 注释、`model_runner_v1` 前向预填调用点与 `global_stream()` 见来源 2、3、5、6；`v0.23.0` 参数表与待废弃发布说明见来源 7、8（[v0.23 线上发布说明](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/release_notes.html)）[S7]；`v0.26.0rc1` 移除清单见来源 16 [S16]；PR #4501 吞吐测试（Qwen2.5/3-32B 正收益、MoE 变慢）的默认值推导见 [PR #4501](https://github.com/vllm-project/vllm-ascend/pull/4501) [I]。
- **跨流风险、GLM MTP 冲突与待核**：`v0.23.0` 异步路径缺 `record_stream` 的风险由 `v0.26.0rc` 同步补丁反推 [D]；GLM `q` 显存尺寸（`2.36 MiB` / `75.6 MiB`）与 MTP 行数冲突由来源 3、22–24 静态推导 [D][!]。**待核**：GLM MTP 强行开启本开关在旧镜像上的实机报错原文，以及全 greedy / `enable_reduce_sample` 下预填浪费的实测开销。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（3 个文件） |
| releases/v0.26.0rc | 无 |
| releases/v0.30.0rc2 | 无 |
| releases/v0.30.0 | 无 |

- **引入**：2025-12-20 · 5d02eed16f6e4e5187259583f9db16a916095ab3 · PR [#4501](https://github.com/vllm-project/vllm-ascend/pull/4501) —— [Performance] Add async exponential while model executing (#4501)
  包含该提交的 tag：v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/zxy_fix_boradash
  - `vllm_ascend/ascend_config.py` +5 / −0（文本行变化）
  - `vllm_ascend/sample/sampler.py` +30 / −0（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +6 / −0（文本行变化）
- **移除**：2026-07-18 · 4f0a38a95c439b30948c30e777403633e0dd638b · PR [#12306](https://github.com/vllm-project/vllm-ascend/pull/12306) —— [Refactor] asnc exponential optimization unset (#12306)
  包含该提交的 tag：v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel、origin/zxy_fix_boradash
  - `vllm_ascend/sample/sampler.py` +0 / −33（文本行变化）
  - `vllm_ascend/ascend_config.py` +0 / −9（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +0 / −7（文本行变化）

当前含该标识符的 tag：v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_async_exponential"]` |
| 类型 | `unknown` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:262` [C13] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
