---
id: enable-async-exponential
legacyAnchors:
  一句话: 它曾经提前执行哪一步，为什么自 v0.25.1rc1 起被移除？
  为什么存在: 为什么叫 exponential 而不是 softmax，以及副流重叠的取舍
  开了的代价: 历史版本的六项代价与升级清理
  历史版本的六项代价glm-双机-mtp-形状冲突与升级清理: 提前抽随机数遇上多候选采样时哪里会错位
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

**`enable_async_exponential` 曾用于在模型前向计算开始前，提前抽好随机采样所需的随机数 $q \sim \text{Exp}(1)$。** 名字里的 `exponential` 指的是为采样生成指数分布随机数，不是前一步 `softmax` 里的指数运算 `exp`。

该开关在 `v0.23.0` 发版当天即列入官方待废弃清单，并自 `v0.25.1rc1`（PR #12306）起连同 `do_async_exponential`、`set_q_event` 与 `async_exponential_event` 一并移除（`v0.30.0` 仍保留同步 `random_sample`，`main` 已退役 MRV1 `sampler.py`）。新部署切勿使用；升级到 `v0.30.0` 或 `main` 时必须从 `--additional-config`（见 [AscendConfig](../concepts/ascend-config-system.md)）中删掉它，否则常规环境会触发 `extra="forbid"` 启动报错（仅装有 `vllm_omni` 时告警过滤，`v0.26.0rc` 静默忽略）。

在仍含此键的 `v0.23.0` 中，它默认 `False`。默认路径在 `softmax` 算完后才现抽随机数；开启后，[NPUModelRunner](../concepts/npu-model-runner.md) 会在本步模型各层前向开始前，把随机数生成任务提前提交到副流 `global_stream()`，争取与前向计算重叠（同批下线的还有 layer sharding、FlashComm2、multistream-overlap gate、matmul all-reduce 融合与 weight prefetch）。

## 事实表

核对旧版采样脚本与跨版本升级影响时，直接查看下表：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 历史配置路径 | `additional_config["enable_async_exponential"]`（`bool = False`） | 仅在 `v0.23.0` / `v0.24.0rc` 存在且已标 Ready to Deprecate |
| `v0.30.0` / `main` 现状 | 已彻底移除；`v0.30.0` 保留同步 `random_sample`，`main` 退役 MRV1 `sampler.py` | 升级后必须从 `additional_config` 删除该键，否则除 `vllm_omni` 告警过滤外直接报错（`v0.26.0rc` 静默忽略） |
| 优化目标与常见误解 | 提前在 `global_stream()` 生成采样用的 $q \sim \text{Exp}(1)$ | 名字里的 `exponential` 指随机数分布，**不是** `softmax` 里的 `exp` |
| 模型收益分化 | 历史 PR #4501 中稠密 32B 正收益，但 `Qwen3-30B` MoE 反而变慢 | MoE 无论是否开启 EP 均出现吞吐下降，上游因此保持默认关闭 |
| 静默失效与白做分配 | `VLLM_BATCH_INVARIANT=1` 静默将其置回 `False`；全 greedy 或 `enable_reduce_sample` 步不消费预填的 `q` | 开启批不变性时本项无声失效；贪心或归约采样下白占 `(batch, vocab_size)` `fp32` 显存 |
| 同步与 MTP 风险 | 取用前调 `Event.synchronize()` 阻塞 host 线程；MTP 多候选行与 1 行 bonus 不切片直接相除 | 会拖慢异步调度主机侧流水，且在旧版 MTP 随机采样下存在形状不匹配风险 |

## 为什么叫 exponential 而不是 softmax，以及副流重叠的取舍

昇腾随机采样的最后一步不调用会触发 CPU-NPU 同步的 `torch.multinomial`。代码改为给每个词表位置抽一个服从 $\text{Exp}(1)$ 的随机数 $q$，再算 `probs.div_(q).argmax(dim=-1)`，全程留在设备上完成按概率抽样（数学等价性见[采样 · 真实实现怎样「按概率抽」](../concepts/sampling.md#真实实现怎样按概率抽)）。

**名字里的 `exponential` 对应 `q.exponential_()` 抽取指数分布随机数，绝非 `logits.softmax(...)` 里的 `exp`。** 由于 `q.exponential_()` 在部分场景会落到 AI CPU 执行、耗时可观，同步路径把它夹在 `softmax` 与 `argmax` 之间容易让主流等待；异步开关便把生成起点挪到整步前向之前：

```wiki-diagram
file: enable-async-exponential
```

注意两条路径其实都在同一个进程级单例流 `global_stream()` 上生成 `q`（同步路径同样先切到 `global_stream()` 再用 `wait_stream` 收回）。本开关并没有新建专属流，只是把生成时刻从采样前前移到了前向开始前。

**历史 PR #4501 的吞吐对照（TP4、`enforce-eager` 测试条件，不代表其他部署收益）**：

| 硬件与模型 | 相对关闭的吞吐变化 | 结论 |
| --- | --- | --- |
| A2 · `Qwen2.5-32B` | 约 `+2.3%` | 稠密模型见正收益 |
| A3 · `Qwen2.5-32B` / `Qwen3-32B` | 约 `+7%` / `+13.3%` | 稠密模型见正收益 |
| `Qwen3-30B`（MoE，开 EP / 不开 EP） | 约 `868 → 803 tok/s` / `-0.8%` | 无论是否开 EP 均变慢（PR 未说明原因），默认值因此保持 `False` |

只要 `q` 的形状与采样行对齐且各元素独立服从 $\text{Exp}(1)$，输出概率分布就保持无偏。不过异步路径在每步前向开始前无条件预抽，抽取次数、行数与随机数消费次序均异于同步路径，因此同一随机种子下不保证逐 token 一致，且与批不变性模式互斥。

## 历史版本的六项代价与升级清理

在仍保留本开关的 `v0.23.0`（及历史镜像 `db701c1f`）上，开启它会带来六项代价与边界：

1. **与 `VLLM_BATCH_INVARIANT=1` 静默互斥**：仅当 `VLLM_BATCH_INVARIANT` 为假时本项才生效，冲突时不打印任何日志。上游端到端用例为此专门显式设置 `VLLM_BATCH_INVARIANT=0`（以下旧写法仅作条件说明，新部署切勿照抄）：

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

2. **`q` 驻留整趟前向，拉高激活显存水位**：`do_async_exponential` 分配形状为 `(logits_indices.shape[0], vocab_size)` 的 `fp32` 张量（形参名虽叫 `head_dim`，实际传入的是词表大小）。不带多候选采样时它与同步路径张量同大，但生命周期横跨整次前向，与层间激活峰值叠加；开启多候选采样时，异步 `q` 按「主干行 + 全部候选行」分配，体积大于同步路径每请求仅 1 行的分配。
3. **遇全贪心步或 `enable_reduce_sample` 时白做预填**：预填发生在前向开始前，不检查本步采样方式。若本步全是贪心采样，或走各卡先筛候选再拼接的 `enable_reduce_sample` 分支（仍调同步 `random_sample` 重抽），预填好的 `q` 根本无人消费。
4. **消费前阻塞主机线程**：取用 `self.q` 前调用的是 `self.async_event.synchronize()`（阻塞 CPU 线程等待设备事件），而非仅在设备流排序的 `wait_event` / `wait_stream`，在异步调度下会拖慢主机侧提前编排下一步的[下发流水线](../concepts/ascend-runtime-and-tuning.md#为什么推理时延常卡在-host-cpu-下发空泡而非-ai-core-计算)。
5. **旧版跨流使用缺少 `record_stream`**：`q` 在 `global_stream()` 分配，却在默认计算流上被 `div_` 消费。`v0.23.0` 未调用 `record_stream` 登记跨流生命周期（跨流显存回收机制见 [`PYTORCH_NPU_ALLOC_CONF` 跨流复用](../concepts/ascend-runtime-and-tuning.md#pytorch_npu_alloc_conf跨流显存提前复用-vs-禁切大块)）；`v0.26.0rc` 与 `v0.30.0` 已在同步 `random_sample` 中补齐 `q.record_stream(torch.npu.current_stream())`。
6. **升级到 `v0.30.0` / `main` 必须删键**：`v0.26.0rc` 静默忽略该键，而 `v0.30.0` 与 `main` 默认以 `extra="forbid"` 拒收报错（仅 `vllm_omni` 环境告警过滤）。

## 提前抽随机数遇上多候选采样时哪里会错位

当部署同时开启多候选投机解码（如 MTP 每轮起草 3 个候选）与随机采样时，前向预填与尾部采样的行数口径会发生错位。以历史双机 `GLM-5.3-Flash` 部署为例（采样站位置见 [sampling · 放到 GLM 双机](../concepts/sampling.md#放到-glm-双机采样在哪一步谁来做)；镜像 `db701c1f` 默认 `False` 且未传该键，实际一直走同步采样）：

- **每卡显存占位账**：8 张 TP 卡各自执行采样。按词表 `154880` 计算，每行 `fp32` 随机数占 $154880 \times 4\text{ B} = 619{,}520\text{ B}$；单请求 R1 的 `4` 行约占 **`2.36 MiB`**，满载 32 请求共 `128` 行约占 **`75.6 MiB`**。
- **`4` 行预填对 `1` 行消费的形状错位**：前向开始前，`do_async_exponential` 按每条请求全部 `logits` 索引行分配 `q`（1 个基础位置 + 3 个 MTP 草稿，每请求 **4 行**）；但到了采样阶段，拒绝采样器批改完草稿后，只把每条请求的 **1 行** bonus `logits` 交给采样器。取用处未做行切片就将 1 行概率张量与 4 行 `q` 原地相除，按源码静态推演会触发张量形状不匹配错误（设备端具体报错文本待复现，该旧开关现已整体移除）。

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
  包含该提交的 tag：v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/jlumbroso/free-disk-space-2.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/releases/v0.33.0rc、origin/revert-20758-feature/glm53-kernel-block-size、origin/revert-21727-codex/dspark-megamoe-cann921、origin/revert-22181-codex/kimi-pcp-dcp-dspark-main、origin/revert-22679-accuracy-lower-bound-only、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/ascend_config.py` +5 / −0（文本行变化）
  - `vllm_ascend/sample/sampler.py` +30 / −0（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +6 / −0（文本行变化）
- **移除**：2026-07-18 · 4f0a38a95c439b30948c30e777403633e0dd638b · PR [#12306](https://github.com/vllm-project/vllm-ascend/pull/12306) —— [Refactor] asnc exponential optimization unset (#12306)
  包含该提交的 tag：v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/jlumbroso/free-disk-space-2.0.0、origin/main、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/releases/v0.33.0rc、origin/revert-20758-feature/glm53-kernel-block-size、origin/revert-21727-codex/dspark-megamoe-cann921、origin/revert-22181-codex/kimi-pcp-dcp-dspark-main、origin/revert-22679-accuracy-lower-bound-only、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel
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
