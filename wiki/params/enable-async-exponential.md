---
id: enable-async-exponential
title: enable_async_exponential
type: param
summary: >-
  把采样用的指数分布随机数提前挪到副 stream 上生成，与本步 model forward 重叠；v0.23.0 默认关闭并已标记待废弃，main
  上已整体删除，残留的这个键还会让启动直接失败。
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
  - 'vllm-ascend@b255ab59:vllm_ascend/sample/sampler.py#L21-L45'
  - 'vllm-ascend@b255ab59:vllm_ascend/sample/sampler.py#L75-L86'
  - 'vllm-ascend@b255ab59:docs/source/user_guide/release_notes.md#L1449'
  - 'https://huggingface.co/Qwen/Qwen3-0.6B'
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L262
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L436-L454'
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1650-L1669'
  - 'vllm-ascend@b255ab59:docs/source/user_guide/release_notes.md#L56-L64'
verified: ["main", "releases/v0.23.0"]
evidence: C
relations:
  - to: ascend-config-system
    kind: builds-on
    note: 它只是 additional_config 里的一个键，开没开、能不能写，全由那条 AscendConfig 校验链说了算——main 上把它挡在启动期的正是这一环
  - to: npu-model-runner
    kind: builds-on
    note: 预填 q 的调用点就在 execute_model 里、跑 28 层之前那几行，副流能藏进 forward 全靠这个位置
contradicts: []
updated: '2026-09-20'
rawSources:
  - >-
    raw/sha256-2442e12b25adb63de1772ce4e3bcff88ee8ef4434f84f27a425dd9e167cd50d2.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
---

## 一句话

`enable_async_exponential` 改的只是一个**时机**：随机采样要用的那批 `q ~ Exp(1)` 随机数，默认是在 softmax 算完之后才现填，开了就提前到 model forward 之前、在副流 `global_stream()` 上填，藏进 28 层前向里，采样时直接取 [C2]。v0.23.0 上默认 `False` [C1]，而且发版当天就被官方写进了待废弃清单 [S8]——**新部署别碰它**。

到 main（`b255ab59`）这条路径整段没了：参数、`do_async_exponential`、`set_q_event` 和事件对象一并删除 [C11]，采样只剩同步的 `random_sample` [C10]。要紧的是残留的键不会被无视——`AscendConfig` 是 `extra="forbid"` 的 pydantic 模型，启动命令里还留着 `enable_async_exponential`，**进程直接起不来**（唯一的例外见「开了的代价」第 6 条）[C15] [!]。

名字是这个参数最大的坑：这里的 exponential 跟 softmax 里的 `exp` 无关，指数分布随机数是 softmax **之后**那一步才用的。

## 事实表

| 项 | v0.23.0 | main | 意味着什么 |
|---|---|---|---|
| 默认值 | `False` | 参数不存在 | main 上写进 `additional_config` 会被 `extra="forbid"` 当错别字拒掉，启动即失败 [!] |
| 类型与入口 | bool，`additional_config` | — | 只能在启动时定，不能按请求开关 |
| `VLLM_BATCH_INVARIANT=1` 时 | 静默置回 `False` [C1] | — | 两者互斥，且没有任何告警；以为开了其实没开 |
| 预生成的 `q` | `(logits_indices.shape[0], vocab_size)`，fp32 [C5] | — | 显存开销随 batch × 词表走，和模型多大无关 |
| Qwen3-0.6B、batch 32 时 `q` | 18.55 MiB / 步 [D] | — | 小模型大词表时这块比 hidden state 还大 |
| [那条请求](../concepts/one-request.md)上 | batch 1，`q` 593.5 KiB / 步；greedy 时压根不取用 [D] | — | 单请求要藏的只有一次 593.5 KiB 的填充，profile 上看不出区别 |
| 取用前的同步方式 | `Event.synchronize()` | — | 阻塞的是 host 线程，比同步路径的 `wait_stream`（device 侧）代价更重 |
| 与 `enable_reduce_sample` 同开 | `q` 照生成，但分支不取用 | — | 白付一次分配和一次副流计算，零收益 |
| 采样公式 | `probs.div_(q).argmax(dim=-1)` | 同式 | 两条路径数学上同分布，开关本身不改采样语义 |
| 官方状态 | Ready to Deprecate | 已删除 | 新部署不要依赖它 |

## 为什么存在

采样的最后一步不是「按概率抽一个」的 `torch.multinomial`——那会触发 CPU-NPU 同步。vLLM 用的是指数分布竞赛（等价于 Gumbel-max）：给每个候选 token 抽一个独立的 `q_i ~ Exp(1)`，取 `argmax_i(p_i / q_i)`，结果的分布就等于按 `p` 抽样，全程留在设备上。

**这里的 exponential 不是 softmax 里的 `exp`。** softmax 在前一行已经算完了（`logits.softmax(dim=-1, dtype=torch.float32)`），`q.exponential_()` 是在它之后**另外**抽一批服从指数分布的随机数 [C3]。名字撞车是这个参数最容易被误解的地方。

问题在于 `q.exponential_()` 这个填充算子本身在 NPU 上不便宜——源码注释点明它可能落到 AI CPU 上执行 [C2]。同步路径里它夹在 softmax 和 argmax 之间，主流必须等它。本参数做的事就是把这段挪到前面去：

```wiki-diagram
file: enable-async-exponential
```

两条路径其实都在 `global_stream()` 上填 `q`——同步路径的 `random_sample` 也先 `npu_stream_switch(global_stream())` 再 `wait_stream` 收回来 [C4]。所以开关买到的不是「换条流」，而是**填的时刻**：从「主流已经算到采样了才开始填」挪到「forward 刚要开始就填」。`global_stream()` 是进程级单例流，不是本特性独占的。

引入它的是 PR [#4501](https://github.com/vllm-project/vllm-ascend/pull/4501)。该 PR 描述里给的数据是 A3 上 Qwen2.5-32B 约 +7%、Qwen3-32B 约 +13.3% 吞吐，而 Qwen3-30B（MoE）反而变慢，所以默认值定成了 `False` [I]——这解释了为什么一个「纯赚」的重叠优化不默认开：MoE 模型的副流本来就忙。

精度方面：两条路径的采样公式完全一致，同一个 `generator` 按同样顺序逐行填充，带 seed 的请求拿到的随机数序列不变，所以**分布上没有精度影响**。真正的影响是可复现性口径——`VLLM_BATCH_INVARIANT` 要求逐 batch 位级一致，而本特性换掉了 `q` 的生成时机与分配来源，因此配置层直接把两者判成互斥。

## 开了的代价

**1. 与 batch invariant 静默互斥。** `enable_async_exponential` 只有在 `VLLM_BATCH_INVARIANT` 为假时才真正为真，而且不打日志。上游自己的 e2e 用例为此专门 `monkeypatch.setenv("VLLM_BATCH_INVARIANT", "0")` 并单建一个 `LLM` 实例，注释里写明「would silently disable async_exponential」[C9]。这是最容易踩的坑：开了没生效，profile 上却看不出区别。

可复制的写法（取自该用例）：

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

**2. 每步多一块 batch × 词表的 fp32 显存。** `do_async_exponential` 用 `b_s=logits_indices.shape[0]`、`head_dim=vocab_size` 新建张量——注意 `head_dim` 这个形参名有误导性，它装的是词表大小，不是注意力头维度。Qwen3-0.6B 的 `vocab_size = 151936` [S13]，单行 `151936 × 4 B = 607,744 B ≈ 593.5 KiB`；`max_num_seqs=32` 满载时 `32 × 607,744 B = 19,447,808 B ≈ 18.55 MiB` [D]。同步路径的 `q = torch.empty_like(probs)` 其实一样大 [C4]，所以增量不是「多出一块」，而是「这块的生命周期被拉长到整个 forward」——峰值显存与 forward 的激活峰值撞在一起。

**3. 与 `enable_reduce_sample` 同开时纯亏。** `forward_native` 里取用 `self.q` 的代码在 `enable_reduce_sample` 的 `else` 分支上；走 reduce sample 时 `probs` 的宽度是各 rank 候选拼起来的，根本不是 `vocab_size`，那条分支照旧调 `random_sample` 重新抽一遍。而 `do_async_exponential` 的调用点不看 `enable_reduce_sample`，于是副流上的活白干。同理，若某一步全是 greedy 请求、`forward_native` 压根不被调用，这次分配也是浪费。

**4. 收尾是 host 侧阻塞。** 取用前那句 `self.async_event.synchronize()` 挡住的是调用它的 CPU 线程，而同步路径用的 `torch.npu.current_stream().wait_stream(global_stream())` 只在设备侧排序、不挡 host。在 async scheduling 场景下 host 线程本该提前去准备下一步，这里被拽回来等一下。注释只写了「Add synchronize to prevent synchronize error」，没说明为何不用 `wait_event`。

**5. 跨 stream 分配的张量没有 `record_stream`。** `q` 在 `global_stream()` 上分配、在默认流上被 `div_` 消费，v0.23.0 的 `do_async_exponential` 没有对它调 `record_stream`；而 main 在同步路径的 `random_sample` 里**补上**了 `q.record_stream(torch.npu.current_stream())` [C10]。缓存分配器只按分配流的完成情况回收显存，跨流消费不登记就可能提前复用——源码里没有针对异步路径的直接断言，这是按 main 那条补丁的意图反推出来的 [D]。

**6. main 上已经没有它了，而且留着会让服务起不来。** v0.23.0 的 release notes 发版时就把 “Asynchronous exponential overlap” 写进了 Ready to Deprecate [S8]（[线上页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/release_notes.html)），到 `b255ab59` 兑现得很彻底：`AscendSampler.__init__` 不再建 `async_exponential_event` [C11]，`set_q_event` / `do_async_exponential` 连同 `AscendTopKTopPSampler` 里的取用分支、`model_runner_v1` 的调用点一并删除，`additional_config` 文档表里也没有这一行 [!]。main 留下的是同步的 `random_sample`，并给它补了 `record_stream` [C10]。

**升级时必须把这个键从启动命令里删掉，没有替代参数要迁移。** 它不在 `_NON_USER_INPUT_KEYS` 的豁免名单里，会原样进到 `AscendConfig(**kwargs)`，被 `extra="forbid"` 当成错别字报出来 [C16]——唯一的例外是装了 `vllm_omni`，那种情况下它只打一条 warning 然后被丢掉。同批列进那张待废弃清单的还有 layer sharding、FlashComm2、**FlashComm3 的 multistream-overlap gate**（是 FlashComm3，不是 FlashComm2）、Hamming sparse、matmul all-reduce 系列融合、weight prefetch 与 dynamic-batch SLO。这张清单不是说说而已：v0.26.0rc1 的 release notes 里，除本项之外的大半已经逐条兑现了删除 [S17]。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（3 个文件） |

- **引入**：2025-12-20 · 5d02eed16f6e4e5187259583f9db16a916095ab3 · PR [#4501](https://github.com/vllm-project/vllm-ascend/pull/4501) —— [Performance] Add async exponential while model executing (#4501)
  包含该提交的 tag：v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/ascend_config.py` +5 / −0（文本行变化）
  - `vllm_ascend/sample/sampler.py` +30 / −0（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +6 / −0（文本行变化）
- **移除**：2026-07-18 · 4f0a38a95c439b30948c30e777403633e0dd638b · PR [#12306](https://github.com/vllm-project/vllm-ascend/pull/12306) —— [Refactor] asnc exponential optimization unset (#12306)
  包含该提交的 tag：v0.25.1rc1、v0.26.0rc1；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/revert-15210-glm52_v2_dspark、origin/rfc/megakernel
  - `vllm_ascend/sample/sampler.py` +0 / −33（文本行变化）
  - `vllm_ascend/ascend_config.py` +0 / −9（文本行变化）
  - `vllm_ascend/worker/model_runner_v1.py` +0 / −7（文本行变化）

当前含该标识符的 tag：v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["enable_async_exponential"]` |
| 类型 | `unknown` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:262` [C14] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
