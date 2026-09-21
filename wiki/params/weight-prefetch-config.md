---
id: weight-prefetch-config
title: weight_prefetch_config
type: param
summary: >-
  v0.23.0 的 additional_config 开关，把 linear 层权重提前搬进 L2 cache，藏在 quantize / gating
  / SwiGLU 这些 vector 计算背后；v0.24.0rc 起整套机制已删除，v0.26 上传这个键被静默忽略，main 上直接报错。
aliases:
  - 权重预取配置
  - weight prefetch
  - enable_prefetch
chapters:
  - '19'
sources:
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/weight_prefetch.md#L1-L5
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/weight_prefetch.md#L25-L32
  - >-
    https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/weight_prefetch.html
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L66-L69
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L117-L122
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L52-L53'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L704-L720'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L13-L15'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L26-L34'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L46-L69'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L71-L86'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L88-L104'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L134-L156'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L158-L186'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L230-L238'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/register_custom_ops.py#L126-L145'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L509-L528'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L336-L338'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_static.py#L81-L89'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L153-L158'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/activation.py#L37-L43'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/experts_selector.py#L71-L74'
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L436-L454'
  - 'vllm-ascend@b255ab59:docs/source/user_guide/release_notes.md#L235-L249'
  - >-
    vllm-ascend@b255ab59:docs/source/tutorials/features/suffix_speculative_decoding.md#L92-L95
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L52
  - 'vllm-ascend@b255ab59:docs/source/user_guide/release_notes.md#L56-L62'
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1650-L1661'
  - >-
    vllm-ascend@b255ab59:vllm_ascend/model_executor/offloader/prefetch.py#L1-L22
  - 'vllm-ascend@b255ab59:docs/source/tutorials/models/Qwen3-Dense.md#L541-L541'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73'
  - 'vllm-ascend@2ed6cbba:docs/source/tutorials/models/Qwen3-Dense.md#L554-L554'
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: C
relations:
  - to: ascend-config-system
    kind: builds-on
    note: 它只是 additional_config 里的一个子配置对象；main 上被 extra="forbid" 当未知键拒收的机制在那一页
contradicts: []
updated: '2026-09-21'
rawSources:
  - >-
    raw/sha256-03a47659756fa092cca4e20a1677217bd9da69cd038f5e54121938ea1c077bd9.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
---

## 一句话

`weight_prefetch_config` 是 v0.23.0 的 `--additional-config` 子配置：开了之后 vllm-ascend 在一条独立的 NPU stream 上，把下一个 linear 层的权重提前从 HBM 搬进 **L2 cache**，让这段搬运藏在当前正在跑的 vector 算子（quantize、MoE gating top_k、RMSNorm、SwiGLU）背后，压低 linear 计算时的 MTE 占用 [S1]。默认 `{}`，等于关闭；该碰它的是高吞吐场景，低延迟优先的场景上游直接说别开。

**存在范围**：它到 v0.23 维护分支为止能用，v0.24.0rc 起整套 `vllm_ascend/ops/weight_prefetch.py` 和配置字段已被删除，v0.26 分支（2026-09-17 的源码快照）与 main 开发主线上都没有这个键——引入与移除的 PR 见下面「版本谱系」。**两边删得不一样** [!]：v0.26 的 `AscendConfig` 还是普通类，逐个键 `.get()` 取值，不认识的键被静默忽略 [C31]，照旧配置它服务起得来、只是什么都不会发生；main 的顶层 `AscendConfig` 是 `extra="forbid"` 的 pydantic 模型 [C23]，同一条命令会在配置解析阶段直接失败。它只有一个子键值得单独看：[prefetch_ratio](prefetch-ratio.md)。

[那条请求](../concepts/one-request.md)在 v0.23 上至少不会被门槛挡住：Qwen3-0.6B 是稠密模型，37 token 的 prefill 和之后的每一步 decode 都满足 `num_tokens < 500`，走的是 MLP 那条路。具体搬多少字节、哪几块搬不动，下面「开了的代价」里按这条请求算了一遍。

## 事实表

| 项 | v0.23.0 | v0.26.0rc | main | 意味着什么 |
|---|---|---|---|---|
| 字段本身 | `dict`，默认 `{}` | 已删除，未知键被静默忽略 | 已删除，未知键被 `extra="forbid"` 拒绝 | 升级时两边都要从启动命令里删掉：v0.26 上留着是白传，main 上留着是起不来 |
| `enabled` | `bool`，默认 `False` [C7] | — | — | 只写 `"weight_prefetch_config": {}` 等于没开；必须显式 `{"enabled": true}` |
| `prefetch_ratio` | 唯一子键，五个权重各一个比例，见 [prefetch_ratio](prefetch-ratio.md) | — | — | 默认那组值是按 Qwen3-235B-A22B-W8A8 / `--max-num-seqs 144` 调的，换模型换并发就不再是最优 |
| 预取目的地 | L2 cache | — | — | 不额外占 HBM——`torch_npu.npu_prefetch` 只搬数据不分配张量 [D] |
| 单次预取上限 | 18 MiB（`MAX_PREFETCH_WEIGHT_SIZE`）[C8] | — | — | 单层权重再大也只预取 18 MiB，ratio 调到 1.0 以上也没意义；代码里这个 clamp 只写在 MLP 两条路径上，attn/moe 靠后端截断 |
| MoE `gate_up` 触发门槛 | 本次 forward `num_tokens >= 96` [C12] | — | — | 小 batch decode 下 MoE 预取整条路径被跳过，profiling 里看不到 CMO 就是这个原因 |
| MLP 触发门槛 | 本次 forward `num_tokens < 500` | — | — | 方向与 MoE 相反：dense 模型的长 prefill 反而不预取 |
| `attn` 的 qkv/o 路径 | 仅 `AscendW8A8LinearMethod.apply` 且 `x.dtype != torch.int8` [C19] | — | — | 非 W8A8 的模型即使 `enabled: true`，`attn` 那两个 ratio 也完全不起作用 |
| `mlp` / `moe` 互斥 | `mlp` 只在非 MoE 模型开，`moe` 只在 MoE 模型开 | — | — | 一次运行里最多有一个生效，两组 ratio 不会同时被读 |
| 越界 ratio | 落在 `[0, 1]` 外的值被静默丢弃 | — | — | 写 `1.5` 不报错也不 clamp，而是这一项消失；某模块 ratio 全丢光时该模块自动关闭 |

## 为什么存在

Linear 层在昇腾上的瓶颈常常不在 Cube 而在 MTE——权重从 HBM 搬到片上的带宽没喂饱，Cube 就在等数据。官方文档把这件事说得很直白：linear 层的 MTE 利用率偏高，于是上游专门开了一条预取流水，与原有的 vector 计算流水并行跑，把权重提前搬到 L2，降低 linear 计算期间的 MTE 占用，间接提高 Cube 效率。

代码里这条「独立流水线」就是一条 `torch.npu.Stream` 单例，加上一对成对出现的自定义算子：`prefetch_preprocess` 让预取流等一下计算流、切过去发预取，`prefetch_postprocess` 让计算流回头等预取流 [C16]。配置在 `NPUModelRunner.__init__` 里被交给一个进程内全局的 `WeightPrefetchMethod` 单例，各算子再通过 `get_weight_prefetch_method()` 取回来。三个插桩点分别是：MoE 的 `select_experts` 里预取 `w13_weight`、`CustomRowParallelOp.apply` 之后预取下一层 `mlp.gate_up_proj`、`AscendSiluAndMul.forward_oot` 里把 `mlp.down_proj` 的预取夹在 SwiGLU 前后。

「藏在 vector 计算背后」这个说法在 `gate_up` 这条路径上尤其实在：它的起点判据是 `curr_layer_prefix.split(".")[-2] == "self_attn"` [C14]，也就是在 attention 的 o_proj 算完时就去取**同一层 MLP** 的 gate_up 权重，提前量接近一整个 attention 的时间。

这个开关的血缘可以一直追到 `enable_prefetch` 与环境变量 `VLLM_ASCEND_ENABLE_PREFETCH_MLP`；v0.23.0 是它统一成 `weight_prefetch_config` 之后的形态 [I]。但同一份 v0.23.0 release notes 已经把 Weight prefetch 列进「Ready to Deprecate」[S24]，PR #11949 随后把它整体摘掉，v0.26.0rc1 的发布说明里记着这一笔 [S27]。**没有等价替代参数**——去向是直接下线，不是改名。

别认错门：main 上确实还有个 `vllm_ascend/model_executor/offloader/prefetch.py`，但它自己第一行就写明是「prefetch-based CPU offloading」，搬的是权重在 HBM 与主机内存之间的进出，和这里的 L2 预取不是一回事 [C29]。

## 开了的代价

**先看它到底会不会被触发。** 这是最容易踩空的一步：`enabled: true` 只是必要条件，运行期还有两道方向相反的 token 门槛。MoE 模型要 `num_tokens >= 96` 才预取，dense 模型的 MLP 路径要 `num_tokens < 500` 才预取。所以对 dense 模型，一次几千 token 的 prefill **根本不走预取**，首 token 延迟基本不受影响；收益全落在 decode 阶段。反过来，MoE 模型的小 batch decode 也拿不到 MoE 侧的预取。

**再看它值多少。** 以 Qwen3-0.6B（dense，H=1024，28 层，`intermediate_size = 3072`，bf16，TP=1）算一遍 [D]：

- `mlp.gate_up_proj.weight` 形状 `[2 × 3072, 1024] = [6144, 1024]`，共 6,291,456 个元素，bf16 每元素 2 B → **12,582,912 B = 12 MiB**。默认 ratio 1.0，12 MiB < 18 MiB 上限，整块权重都被预取。
- `mlp.down_proj.weight` 形状 `[1024, 3072]`，3,145,728 个元素 × 2 B → **6,291,456 B = 6 MiB**，同样全量预取。
- 一层 MLP 合计 18 MiB，28 层一轮 decode 要搬 504 MiB——这正是「decode 是访存瓶颈」的量化版本，也是预取有得赚的原因。
- 这个模型是 bf16 而非 W8A8，所以 `attn` 的 `qkv`/`o` 两个 ratio 写了也白写：`qkv_proj.weight` 是 `[4096, 1024]`（q 16×128 + k 8×128 + v 8×128 = 4096）8 MiB、`o_proj.weight` 是 `[1024, 2048]` 4 MiB，这 12 MiB 不会被预取。

（`intermediate_size = 3072` 取自 Qwen3-0.6B 的模型配置，不在本页引用的两个仓库里，故整段标 [D]。换成 TP>1 时每 rank 的权重按 TP 切分，上面的数要除以 TP。）

**代价。** 官方把话说在前面：既然是拿 vector 计算来掩盖预取流水，预取就**会反过来影响计算**；优先低延迟而非高吞吐的场景，最好不要开 [S1]。低并发下预取往往没有收益，应该调小 ratio 或干脆关掉。判断方法也给了：抓 profiling，看预取（timeline 上表现为单条 stream 上的 CMO 操作）是否与并行的 vector 算子（如 SwiGlu）真的重叠、且不晚于该算子结束 [S2]。显存侧没有额外代价——预取只是把数据搬进 cache，不分配新张量 [D]；多出来的是一条常驻 stream 和一对同步点。

**配置本身的三个坑。**

1. 子键是 `enabled` 不是 `enable`。main 上残留的 suffix speculative decoding 教程还写着 `{"enable":true}` [S25]，在 v0.23.0 上它会被 `.get("enabled", False)` 读成关闭、静默无效，在 main 上则直接因未知键报错。
2. `prefetch_ratio` 是**整体替换**而非逐键合并；好在 `WeightPrefetchMethod` 会对缺失的模块用 `.get(..., {}) or {...}` 逐模块回填默认值 [C10]，所以只写 `{"mlp": {...}}` 实际仍然安全——但这层保护在配置对象里看不出来，别依赖它去推别的子配置。
3. MLP `down` 的预取依赖 sequence parallel，要用就得同时开。

**升级之后必须动手删，两个方向的坑不一样。** 升到 v0.26 分支时，`AscendConfig` 仍是逐个键 `.get()` 的普通类，这个键既没人读也没人拦，服务照常起来、预取一次都不发生——最难查的正是这种「配了等于没配」。升到 main 则因为 `extra="forbid"`，把 v0.23.0 的启动命令原样搬到 `b255ab59` 会在配置解析阶段就失败，而不是打一条 warning 继续跑。唯一的例外是装了 `vllm_omni` 的环境：那里未知键改成打 warning 再丢掉，于是它变成真正的静默无效——起得来但什么都没开 [C28]。

**要删的不止你自己的脚本。** 上游仓库里还留着过期示例：suffix speculative decoding 教程 [S25] 和 Qwen3 稠密模型教程 [S30] 都还写着 `weight_prefetch_config`，v0.26 分支上同一条命令也仍在 [S32]。照抄它们在 main 上会起不来，在 v0.26 上则是白配。想要同类收益只能走别的路子（图模式、算子融合等），这个参数本身没有对应物。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 有（6 个文件） |
| releases/v0.18.0 | 有（5 个文件） |
| releases/v0.20.2rc | 有（5 个文件） |
| releases/v0.21.0rc | 有（5 个文件） |
| releases/v0.22.1rc | 有（5 个文件） |
| releases/v0.23.0 | 有（5 个文件） |
| releases/v0.24.0rc | 无 |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 无 |
| main | 无 |

- **引入**：2025-10-09 · ff3757593614964f7ab91dab3da0c4aee568bec8 · PR [#3146](https://github.com/vllm-project/vllm-ascend/pull/3146) —— [1/N][Feat] Add weight prefetch feature for Attention layers (#3146)
  包含该提交的 tag：v0.11.0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/v0.11.0-dev
  - `vllm_ascend/utils.py` +10 / −14（文本行变化）
  - `vllm_ascend/attention/mla_v1.py` +13 / −13（文本行变化）
  - `vllm_ascend/torchair/torchair_mla.py` +13 / −13（文本行变化）
  - `vllm_ascend/torchair/models/torchair_deepseek_v2.py` +5 / −4（文本行变化）
  - `vllm_ascend/ascend_forward_context.py` +11 / −2（文本行变化）
- **移除**：2026-07-16 · e77502ef715f612f2cc6f3c833174431f26cb765 · PR [#11949](https://github.com/vllm-project/vllm-ascend/pull/11949) —— [Refactor] Remove weight prefetch config (#11949)
  包含该提交的 tag：v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel
  - `vllm_ascend/ops/weight_prefetch.py` +0 / −238（文本行变化）
  - `vllm_ascend/ops/register_custom_ops.py` +1 / −40（文本行变化）
  - `vllm_ascend/utils.py` +1 / −25（文本行变化）
  - `vllm_ascend/ascend_config.py` +0 / −22（文本行变化）
  - `vllm_ascend/quantization/methods/w8a8_static.py` +0 / −15（文本行变化）

当前含该标识符的 tag：v0.11.0、v0.11.0rc1、v0.11.0rc2、v0.11.0rc3、v0.12.0rc1、v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["weight_prefetch_config"]` |
| 类型 | `unknown` |
| 默认表达式 | `{}` |
| 定义 | `vllm_ascend/ascend_config.py:52` [C26] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
