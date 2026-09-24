---
id: combine-quant-mode-2a3f7cd47997
title: combine_quant_mode
type: param
summary: >-
  MoE 的 MC2 combine 阶段（专家算完把结果收回来的那次 all-to-all）通信时用哪种量化：非 0 就强行覆盖模型自己推出来的模式，只认
  0/2/3/4，默认 0 不干预。在册版本里只有 main 有，v0.23 与 v0.26 两个发布分支上配了会被静默忽略。
origin: seed
aliases:
  - MC2 combine 通信量化
  - combine 阶段通信量化模式
  - 强制 combine 量化模式
chapters:
  - '14'
  - '17'
verified:
  - main
evidence: C
updated: '2026-09-24'
relations:
  - to: expert-parallel
    kind: builds-on
    note: >-
      它改的是 MC2 那对 dispatch / combine 算子里 combine 那一半的通信量化位，而 MC2 正是 EP 收发 token
      的通道
  - to: quantization
    kind: builds-on
    note: 默认值 0 的含义是「跟着模型权重声明的 quant_type 走」，要判断覆盖掉了什么，先得知道 quant_type 从哪来
  - to: ascend-config-system
    kind: builds-on
    note: >-
      它是 main 上 pydantic AscendConfig 的顶层 Literal 字段，v0.23 / v0.26 那套逐键 .get()
      根本不认识这个名字
contradicts: []
sources:
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L474'
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L474
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/token_dispatcher.py#L274-L287'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/token_dispatcher.py#L162-L173'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/token_dispatcher.py#L327-L333'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/moe_comm_method.py#L215-L232'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/fused_moe/moe_comm_method.py#L473-L524'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L471-L474'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L316-L336'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L83
  - 'vllm-ascend@baa023ad:tests/ut/test_ascend_config.py#L1632-L1663'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L455'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1671'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L61-L67'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L32-L38'
  - >-
    vllm-ascend@39fef3f8fe71e71a8b7a684ae0f62b85ff18661f:vllm_ascend/ascend_config.py#L486
rawSources:
  - >-
    raw/sha256-79a5ae22b065a783af11ee034b70e8f7a2a05feeb4589e15b8dcd74952c8e662.md
  - >-
    raw/sha256-b4c233521b02d2783805e7bb877b5cc54f0a1ce018f865c48fe3005500157cba.md
  - >-
    raw/sha256-bb12681ba71dd7e1d6ac81a0dcc8f6eb79f44f0a62b8decbb7126f9e511359e3.md
  - >-
    raw/sha256-f0620a0aa51e253e6317b8c200fef748f9a19d4f602343246dd853e3c06121e5.md
---
## 一句话

`combine_quant_mode` 只管一件事：MoE 的 **MC2 combine 阶段**——专家算完、把结果沿 EP 组收回各自 rank 的那次 all-to-all——在通信时用哪种量化。非 0 就把 `npu_moe_distribute_combine_v2` 的 `comm_quant_mode` 实参**强行**设成这个值，压过模型量化类型推出来的那个；`0`（默认）表示不干预 [C3]。

**它只动 combine 那一半。** 同一个 `TokenDispatcherWithMC2` 里，dispatch 方向的 `quant_mode` 是另一段独立的 `if / elif`，从头到尾不看这个键 [C4]。所以它造得出「发出去一种精度、收回来另一种」的不对称状态——这正是它存在的理由，而不是副作用。

**存在范围。** 在册版本里只有 main 有（上游后来分出的 v0.28/v0.29 rc 分支也带着它，不在册），2026-09-07 由 PR [#15441](https://github.com/vllm-project/vllm-ascend/pull/15441) 引入（见下面「版本谱系」）；v0.23 维护分支与 v0.26 分支（2026-09-17 的源码快照）在 `vllm_ascend/` 和 `docs/source/` 下都搜不到这个名字。那两个分支的 `AscendConfig` 还是逐键 `additional_config.get(...)` 的普通类 [C14]，配上它**既不报错也不生效**；main 反过来是 `extra="forbid"` 的 pydantic 模型 [C12]，名字拼错就启动失败（装了 vLLM-Omni 才降成一条 warning）[C13]。

[那条请求](../concepts/one-request.md)用不到它：Qwen3-0.6B 是 dense 模型，没有 MoE 层，MC2 这条通道根本不存在。要走到这里，至少得换成开了 [EP](../concepts/expert-parallel.md) 的 MoE 模型。

官方参数表：[latest](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html)（v0.23.0 与 v0.26.0rc1 两版的表里没有这一行）。

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 合法取值 | `Literal[0, 2, 3, 4]`，别的整数一律 `ValueError` [C1] | 官方表写「int，取值范围请查算子文档」[S10]，实际只有这四个过得了校验——照算子文档填 1 会在启动期被挡回来 [!] |
| 默认值 | `0` | 不覆盖，按 `quant.comm_quant_mode` / `quant_type` 那两级默认推 |
| `2` / `4` 的含义 | 2 = 传统 int 通信量化，4 = MXFP `float8_e4m3` [C8] | 这两个是仓库里唯一有注释解释过的值 |
| `3` 的含义 | 白名单放行，但 `vllm_ascend/` 与 `docs/` 里没有任何一处说它是什么 [!] | 想用只能去 CANN 算子文档确认，本仓库给不出依据 |
| 传字符串 | `"4"` 直接抛 `ValueError` [C11] | 与 `weight_nz_mode` 这类 lax 强转的 int 键**不一样**，JSON 里带引号就起不来 |
| 生效路径 | 只有 `MC2CommImpl` 会走到 [C6] | `enable_fused_mc2=1` 的 `FusedMC2CommImpl` 整个重写了 `fused_experts`，压根不调 `token_combine`，这个键读都不会被读 [C7] [!] |
| 生效阶段 | 只有 combine | dispatch 侧那段 `quant_mode` 不看它 |
| 优先级 | 高于 `combine_metadata.quant.comm_quant_mode`，也高于 W8A8MXFP 默认的 4 | 它是**第一顺位**，不是兜底默认，上游单测专门锁了这条 |
| 校验范围 | 只校验「是不是这四个数」 | 没有任何「本模型 / 本硬件支持不支持这个模式」的检查，配错要到算子里才炸或者悄悄掉精度 |
| 官方示例 dict | **没收录它** [C9] | `AscendConfig` 文档字符串里那份自称「列出每个支持的键」的样例配置漏了这一行，别拿它当键的全集 [!] |

## 为什么存在

MC2 是昇腾上 EP 的那对收发算子：`npu_moe_distribute_dispatch_v2` 把 token 按路由发到持有专家的 rank，专家算完，`npu_moe_distribute_combine_v2` 再按权重把结果收回来 [C5]。两次都是真·跨卡通信，量越大越贵，所以算子本身留了一个 `comm_quant_mode` 参数——通信时先把张量压到低精度再发。

这个精度原本是**推**出来的，不是配的。combine 侧的顺序是三级兜底：模型侧显式给了 `quant.comm_quant_mode` 就用它，否则 `quant_type` 是 `W8A8MXFP` 就用 4，再否则 0（不量化）[C3]。dispatch 侧是另一套相似但不同的推断。推断的前提是「通信精度跟着权重量化类型走」，而这个前提在调优、验证新算子、或者权重量化类型与硬件支持的通信量化不匹配时就不成立了——于是加了一个把前两级全部短路掉的开关：

```python
combine_quant_mode = get_ascend_config().combine_quant_mode
if combine_quant_mode:
    quant_mode = combine_quant_mode
elif comm_quant_mode is not None:
    ...
```

`if combine_quant_mode:` 用的是真值判断，所以 `0` 既是默认值也是「关闭」的表达方式，不需要额外的 `enable_` 开关。配置对象是进程内单例，这一行虽然在每次前向里现读，值在启动后不会变。

**为什么只给 combine、不给 dispatch。** 两个方向的数据不一样重：dispatch 发的是 token 的 hidden states，combine 收的是专家输出并且紧接着要按 topk 权重加权求和，两侧对量化误差的容忍度和算子支持的模式都不同。上游只把 combine 这一侧开放成可配，dispatch 侧保持推断——这也是这个键叫 `combine_quant_mode` 而不是 `mc2_quant_mode` 的原因。

## 开了的代价

**精度是纯亏的那一头。** 把 combine 从 0 调到 2 或 4，省的是一次 all-to-all 的字节数，付的是专家输出在加权求和之前先被压一遍。没有任何校验拦着你给一个 bf16 未量化的模型配 `combine_quant_mode: 4`——能不能跑、跑出来准不准，全看算子自己。这个键的定位是调优／排查旋钮，不是性能默认项。

**它对 fused MC2 那条路无效，而且不会告诉你。** `FusedMC2CommImpl` 的 `fused_experts` 走的是 `torch.ops._C_ascend.dispatch_ffn_combine` 融合算子或 CANN MegaMoe，整条路径上没有 `token_combine` 这一步。也就是说 `--additional-config '{"enable_fused_mc2": 1, "combine_quant_mode": 4}'` 会正常启动、正常出结果，而 `combine_quant_mode` 一次都没被读到 [!]。要验证它是否生效，得先确认自己落在非融合的 `MC2CommImpl` 上。官方表给这一行的描述是「Fused MC2 configuration」，那是从上一行 `enable_fused_mc2` 抄过来的 [S10]——照它理解成「要先开融合 MC2」正好把结论弄反。

**取值卡得比文档紧。** `Literal[0, 2, 3, 4]` 是编译期白名单：`1` 会被 pydantic 拒收，`"4"` 这种字符串同样拒收，上游为这两条各写了一个单测 [C11]。官方表让你「参考算子文档的有效取值范围」[S10]，但算子文档里合法的值不一定在这四个里——以代码为准，超出白名单的值根本递不到算子手上 [!]。

**升级方向上只有一种失败模式。** 这个键从 main 往回搬到 v0.23 / v0.26 是静默无效（逐键 `.get()` 不认识的键直接丢）[C14] [C15]；反过来不存在问题——它本来就是新加的。所以在旧分支上看到有人配了它，唯一正确的结论是「这行配置什么都没做」。

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
| releases/v0.28.0rc | 有（2 个文件） |
| releases/v0.29.0rc | 有（2 个文件） |
| main | 有（2 个文件） |

- **引入**：2026-09-07 · 203ae3eb0a734c3a7ba638d84e116bcca24b1a09 · PR [#15441](https://github.com/vllm-project/vllm-ascend/pull/15441) —— [Feature][Quant] Introduce combine_quant_mode to force MC2 combine stage communication quantization (#15441)
  包含该提交的 tag：未找到；分支：main、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-15908-new-refactor
  - `vllm_ascend/ops/fused_moe/token_dispatcher.py` +6 / −1（文本行变化）
  - `vllm_ascend/ascend_config.py` +4 / −0（文本行变化）

当前含该标识符的 tag：未找到

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["combine_quant_mode"]` |
| 类型 | `Literal[0, 2, 3, 4]` |
| 默认表达式 | `0` |
| 定义 | `vllm_ascend/ascend_config.py:486` [C16] |
| 版本 | main · 39fef3f8fe71e71a8b7a684ae0f62b85ff18661f |

字段注释：

When non-zero, force the MC2 combine stage's comm quant_mode to this value (e.g. 4 = MXFP float8_e4m3 communication quantization) regardless of the model's quant_type, 0 means disabled (use the model's own quant).

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
