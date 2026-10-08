---
id: enable-async-exponential
title: enable_async_exponential
type: param
summary: >-
  把采样用的指数分布随机数提前挪到副 stream 上生成，与本步 model forward 重叠；v0.23.0
  默认关闭并已标记待废弃，v0.25.1rc 起已整体删除，残留的这个键在 v0.26 上被静默忽略、在 main 通常拒收，能发现 vLLM-Omni
  时会警告并过滤未知顶层键。
aliases:
  - 异步指数分布重叠
  - Asynchronous exponential overlap
chapters:
  - '19'
sources:
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L256-L263'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L90-L103'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L182-L191'
  - 'vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L20-L43'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2278-L2283'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L531-L537'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L76
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L114-L122'
  - 'vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/test_sampler.py#L72-L96'
  - 'vllm-ascend@baa023ad:vllm_ascend/sample/sampler.py#L21-L45'
  - 'vllm-ascend@baa023ad:vllm_ascend/sample/sampler.py#L75-L86'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L1449'
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L262
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L437-L455'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1679'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L64'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/sample/sampler.py#L33-L44'
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
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
updated: '2026-10-08'
rawSources:
  - >-
    raw/sha256-2442e12b25adb63de1772ce4e3bcff88ee8ef4434f84f27a425dd9e167cd50d2.md
  - >-
    raw/sha256-85323d2e93b398686b5459a1de5dc797e7a82b50cc8cb5ef47056ec4e08e6cf1.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
---

## 一句话

`enable_async_exponential` 改的只是一个**时机**：随机采样要用的那批 `q ~ Exp(1)` 随机数，默认是在 softmax 算完之后才现填，开了就提前到 model forward 之前、在副流 `global_stream()` 上填，藏进模型各层的前向里，采样时直接取 [C2]。v0.23.0 上默认 `False` [C1]，而且发版当天就被官方写进了待废弃清单 [S8]——**新部署别碰它**。

**存在范围。** 它到 v0.24.0rc 为止还在，**v0.25.1rc 起**参数、`do_async_exponential`、`set_q_event` 和事件对象整段删除，v0.26 分支（2026-09-17 的源码快照）与 main 上都只剩同步的 `random_sample`，PR 号见下面「版本谱系」。**残留的键在两边下场不同** [!]：v0.26 的 `AscendConfig` 还是普通类，逐个键 `.get()` 取值，不认识的键被静默忽略 [C17]，服务起得来、重叠不再发生；main 的 `AscendConfig` 是 `extra="forbid"` 的 pydantic 模型，同一条启动命令通常会被拒收；若能发现 vLLM-Omni，未知顶层键会警告并过滤（详见「开了的代价」第 6 条）[C14][C15]。

**放到 GLM 双机。** 它挂在每步前向之后的采样那一步（采样在哪、谁来做见 [sampling · 放到 GLM 双机](../concepts/sampling.md#放到-glm-双机采样在哪一步谁来做)）。本部署用的 v0.23 维护分支和含 GLM 代码的 db701c1f 都还带着这个开关，默认关闭，启动命令也没有传 additional config，所以**本部署没开**，采样走同步路径。假如在这套部署上打开：GLM 不写采样参数时按 T = 1、top-p 0.95 随机采样，确实会走到取用 q 的分支；但本部署开着 MTP，两边行数对不上 [C3] [C5]：q 按全部分数行建，行数 = 各请求的（候选数 + 1）之和，本部署 decode 每请求 4 行（1 行确定 token + 3 行候选，见主线底稿 03 §A5）；有候选时采样改由拒绝采样器做，它只把每请求 1 行（补抽最后那个 token 的那行）交给采样器（03 §A6）；取用处直接拿整块 q 去原地相除，不按行切片。两块张量第 0 维不等、q 那一维又不是 1，按 PyTorch 的广播规则，带随机采样请求的 MTP decode 步会报形状错误 [D]——这是按源码推出来的，没有在设备上实跑，上游也没有针对「投机解码 + 本开关」的修复提交（之后只有整体删除）。也就是说，在这套部署上它多半不是「快一点慢一点」的问题，而是开了可能就跑不起来；下文 PR 里的数字来自别的模型，不能当成本部署的效果。

## 事实表

| 项 | v0.23.0 | v0.26.0rc | main | 意味着什么 |
|---|---|---|---|---|
| 默认值 | `False` | 参数不存在，键被静默忽略 | 参数不存在，键被 `extra="forbid"` 拒掉 | v0.26 上写进 `additional_config` 起得来但毫无作用，main 通常拒收；能发现 vLLM-Omni 时先警告并过滤，功能仍已删除 [C15] |
| 类型与入口 | bool，`additional_config` | — | — | 只能在启动时定，不能按请求开关 |
| `VLLM_BATCH_INVARIANT=1` 时 | 静默置回 `False` [C1] | — | — | 两者互斥，且没有任何告警；以为开了其实没开 |
| 预生成的 `q` | `(logits_indices.shape[0], vocab_size)`，fp32 [C5] | — | — | 显存开销随 batch × 词表走，和模型多大无关 |
| GLM 双机是否开启 | 没开：开关在、默认 `False`、启动命令未传 | — | — | 本部署的采样一直走同步路径 |
| 假如在 GLM 双机上打开，`q` 多大 | 每张卡各一份（8 张 TP 卡各自跑同样的采样）；每行 154880 × 4 B = 619,520 B；R1 的 decode 步 4 行 ≈ 2.36 MiB，满载 decode 128 行 ≈ 75.6 MiB [D] | — | — | 只是这块张量的大小，不是收益；全是 greedy 请求的步里它填了也不被取用 |
| 取用前的同步方式 | `Event.synchronize()` | — | — | 阻塞的是 host 线程，比同步路径的 `wait_stream`（device 侧）代价更重 |
| 同步路径的 `record_stream` | 没有 | 已补上 | 已补上 | 跨流分配的 `q` 到 v0.26 才登记给消费流，v0.23 上是个潜在的提前复用风险 |
| 采样公式 | `probs.div_(q).argmax(dim=-1)` | 同式 | 同式 | 三个版本数学上同分布，开关本身不改采样语义 |
| 官方状态 | Ready to Deprecate | 已删除 | 已删除 | 新部署不要依赖它 |

## 为什么存在

采样的最后一步不调 `torch.multinomial`（那会触发 CPU-NPU 同步），而是给每个词发一个服从指数分布的随机数 q，取「概率 ÷ q」最大的那个，结果等同于按概率抽、全程留在设备上；为什么这样抽的概率正好对，见 [sampling · 真实实现怎样「按概率抽」](../concepts/sampling.md#真实实现怎样按概率抽)。

**这里的 exponential 不是 softmax 里的 `exp`。** softmax 在前一行已经算完了（`logits.softmax(dim=-1, dtype=torch.float32)`），`q.exponential_()` 是在它之后**另外**抽一批服从指数分布的随机数 [C3]。名字撞车是这个参数最容易被误解的地方。

问题在于 `q.exponential_()` 这个填充算子本身在 NPU 上不便宜——源码注释点明它可能落到 AI CPU 上执行 [C2]。同步路径里它夹在 softmax 和 argmax 之间，主流必须等它。本参数做的事就是把这段挪到前面去：

```wiki-diagram
file: enable-async-exponential
```

两条路径其实都在 `global_stream()` 上填 `q`——同步路径的 `random_sample` 也先 `npu_stream_switch(global_stream())` 再 `wait_stream` 收回来 [C4]。所以开关买到的不是「换条流」，而是**填的时刻**：从「主流已经算到采样了才开始填」挪到「forward 刚要开始就填」。`global_stream()` 是进程级单例流，不是本特性独占的。

引入它的是 PR [#4501](https://github.com/vllm-project/vllm-ascend/pull/4501)。该 PR 描述里给的数据是 A2 上 Qwen2.5-32B 约 +2.3%，A3 上 Qwen2.5-32B 约 +7%、Qwen3-32B 约 +13.3% 吞吐，而 Qwen3-30B（MoE）不论开不开 expert parallel 都变慢（开 EP 约 868 → 803 tok/s，不开 EP 约 −0.8%），所以默认值定成了 `False` [I]。PR 写的测试配置是 TP4、enforce-eager（不用图模式）。PR 只说它在 MoE 模型上可能表现不好，没有给原因；这些都是别的模型上的数，不是 GLM 双机的效果。

精度方面：两条路径的采样公式完全一致，同一个 `generator` 按同样顺序逐行填充，带 seed 的请求拿到的随机数序列不变，所以**分布上没有精度影响**。真正的影响是可复现性口径——`VLLM_BATCH_INVARIANT` 要求逐 batch 位级一致，而本特性换掉了 `q` 的生成时机与分配来源，因此配置层直接把两者判成互斥。

## 开了的代价

**1. 与 batch invariant 静默互斥。** `enable_async_exponential` 只有在 `VLLM_BATCH_INVARIANT` 为假时才真正为真，而且不打日志。上游自己的 e2e 用例为此专门 `monkeypatch.setenv("VLLM_BATCH_INVARIANT", "0")` 并单建一个 `LLM` 实例，注释里写明「would silently disable async_exponential」[C9]。这是最容易踩的坑：开了没生效，profile 上却看不出区别。

该用例里的写法（只用来说明两个条件要同时满足；这个开关已被删除，新部署不要照抄）：

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

**2. 每步多一块 batch × 词表的 fp32 显存。** `do_async_exponential` 用 `b_s=logits_indices.shape[0]`、`head_dim=vocab_size` 新建张量——注意 `head_dim` 这个形参名有误导性，它装的是词表大小，不是注意力头维度。按 GLM 的 154880 词表，每行 619,520 B，R1 decode 步与满载时的大小见上面事实表 [D]。不开 MTP 时，同步路径的 `q = torch.empty_like(probs)` 其实一样大 [C4]，所以增量不是「多出一块」，而是「这块的生命周期被拉长到整个 forward」——峰值显存与 forward 的激活峰值撞在一起。开着 MTP 时两边不再一样大：异步的 q 按全部分数行建，同步路径只为补抽的那 1 行建——按源码推断，行数不一致会让取用那一步报错（未实跑），见「一句话」里 GLM 双机那段。

**3. 与 `enable_reduce_sample` 同开时纯亏。** `forward_native` 里取用 `self.q` 的代码在 `enable_reduce_sample` 的 `else` 分支上；走 reduce sample 时 `probs` 的宽度是各 rank 候选拼起来的，根本不是 `vocab_size`，那条分支照旧调 `random_sample` 重新抽一遍。而 `do_async_exponential` 的调用点不看 `enable_reduce_sample`，于是副流上的活白干。同理，若某一步全是 greedy 请求、`forward_native` 压根不被调用，这次分配也是浪费。

**4. 收尾是 host 侧阻塞。** 取用前那句 `self.async_event.synchronize()` 挡住的是调用它的 CPU 线程，而同步路径用的 `torch.npu.current_stream().wait_stream(global_stream())` 只在设备侧排序、不挡 host。在 async scheduling 场景下 host 线程本该提前去准备下一步，这里被拽回来等一下。注释只写了「Add synchronize to prevent synchronize error」，没说明为何不用 `wait_event`。

**5. 跨 stream 分配的张量没有 `record_stream`。** `q` 在 `global_stream()` 上分配、在默认流上被 `div_` 消费，v0.23.0 的 `do_async_exponential` 没有对它调 `record_stream`；而 **v0.26 分支起**同步路径的 `random_sample` 里**补上**了 `q.record_stream(torch.npu.current_stream())` [C18]，main 上也是同一句 [C10]。缓存分配器只按分配流的完成情况回收显存，跨流消费不登记就可能提前复用——源码里没有针对异步路径的直接断言，这是按那条补丁的意图反推出来的 [D]。

**6. v0.25.1rc 起已经没有它了，main 通常拒收残留键，Omni 共用配置时会警告并过滤。** v0.23.0 的 release notes 发版时就把 “Asynchronous exponential overlap” 写进了 Ready to Deprecate [S8]（[线上页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/release_notes.html)），到 main 开发主线上兑现得很彻底：`AscendSampler.__init__` 不再建 `async_exponential_event` [C11]，`set_q_event` / `do_async_exponential` 连同 `AscendTopKTopPSampler` 里的取用分支、`model_runner_v1` 的调用点一并删除，`additional_config` 文档表里也没有这一行。v0.26 分支上同样一处引用都不剩，留下的都是同步的 `random_sample`。

**升级时必须把这个键从启动命令里删掉，没有替代参数要迁移。** 到 main 它不在 `_NON_USER_INPUT_KEYS` 的豁免名单里，会原样进到 `AscendConfig(**kwargs)`，被 `extra="forbid"` 当成错别字报出来 [C15]——唯一的例外是装了 `vllm_omni`，那种情况下它只打一条 warning 然后被丢掉。到 v0.26 则没有这层校验，键被跳过、什么提示都没有，所以**唯一能察觉的信号是采样不再与 forward 重叠**，得靠 profiling 看 [!]。同批列进那张待废弃清单的还有 layer sharding、FlashComm2、**FlashComm3 的 multistream-overlap gate**（是 FlashComm3，不是 FlashComm2）、Hamming sparse、matmul all-reduce 系列融合、weight prefetch 与 dynamic-batch SLO。这张清单不是说说而已：v0.26.0rc1 的 release notes 里，除本项之外的大半已经逐条兑现了删除 [S16]。

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
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 无 |
| releases/v0.29.0rc | 无 |
| main | 无 |

- **引入**：2025-12-20 · 5d02eed16f6e4e5187259583f9db16a916095ab3 · PR [#4501](https://github.com/vllm-project/vllm-ascend/pull/4501) —— [Performance] Add async exponential while model executing (#4501)
  包含该提交的 tag：v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/ascend_config.py` +5 / −0（文本行变化）
  - `vllm_ascend/sample/sampler.py` +30 / −0（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +6 / −0（文本行变化）
- **移除**：2026-07-18 · 4f0a38a95c439b30948c30e777403633e0dd638b · PR [#12306](https://github.com/vllm-project/vllm-ascend/pull/12306) —— [Refactor] asnc exponential optimization unset (#12306)
  包含该提交的 tag：v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel
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

## 已废弃的说法

### 2026-10-08 · 修订 aa7f3456b6e847d7

旧说法（历史记录，已废弃）：

```text
同一条启动命令**进程直接起不来**（唯一的例外见「开了的代价」第 6 条）[C14]
```

替代结论：

```text
同一条启动命令通常会被拒收；若能发现 vLLM-Omni，未知顶层键会警告并过滤（详见「开了的代价」第 6 条）[C14][C15]
```

废弃依据（来源是否支持结论仍须人审）：

- `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1679`

旧说法（历史记录，已废弃）：

```text
main 上启动即失败 [!]
```

替代结论：

```text
main 通常拒收；能发现 vLLM-Omni 时先警告并过滤，功能仍已删除 [C15]
```

废弃依据（来源是否支持结论仍须人审）：

- `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1679`

旧说法（历史记录，已废弃）：

```text
**6. v0.25.1rc 起已经没有它了，留在 main 上会让服务起不来。**
```

替代结论：

```text
**6. v0.25.1rc 起已经没有它了，main 通常拒收残留键，Omni 共用配置时会警告并过滤。**
```

废弃依据（来源是否支持结论仍须人审）：

- `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1679`

旧文的来源编号（仅解释上方历史原文）：

1. `vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L256-L263`
2. `vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L90-L103`
3. `vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L182-L191`
4. `vllm-ascend@2c59ff10:vllm_ascend/sample/sampler.py#L20-L43`
5. `vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2278-L2283`
6. `vllm-ascend@2c59ff10:vllm_ascend/utils.py#L531-L537`
7. `vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L76`
8. `vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L114-L122`
9. `vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/test_sampler.py#L72-L96`
10. `vllm-ascend@baa023ad:vllm_ascend/sample/sampler.py#L21-L45`
11. `vllm-ascend@baa023ad:vllm_ascend/sample/sampler.py#L75-L86`
12. `vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L1449`
13. `vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L262`
14. `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L437-L455`
15. `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1679`
16. `vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L64`
17. `vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73`
18. `vllm-ascend@2ed6cbba:vllm_ascend/sample/sampler.py#L33-L44`
