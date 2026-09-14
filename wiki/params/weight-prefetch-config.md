---
id: weight-prefetch-config
title: weight_prefetch_config
type: param
summary: v0.23.0 的 additional_config 开关，把 linear 层权重提前搬进 L2 cache，藏在 quantize / gating / SwiGLU 这些 vector 计算背后；main 上整套机制已删除，传这个键会直接报错。
aliases: [权重预取配置, weight prefetch, enable_prefetch]
chapters: ["19"]
sources:
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/weight_prefetch.md#L1-L5
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/weight_prefetch.md#L25-L32
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/weight_prefetch.html
  - vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L66-L69
  - vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L117-L122
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L52-L53
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L704-L720
  - vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L13-L15
  - vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L26-L34
  - vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L46-L69
  - vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L71-L86
  - vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L88-L104
  - vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L134-L156
  - vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L158-L186
  - vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L230-L238
  - vllm-ascend@2c59ff10:vllm_ascend/ops/register_custom_ops.py#L126-L145
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L509-L528
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L336-L338
  - vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_static.py#L81-L89
  - vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L153-L158
  - vllm-ascend@2c59ff10:vllm_ascend/ops/activation.py#L37-L43
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/experts_selector.py#L71-L74
  - vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L351-L369
  - vllm-ascend@28bf3a2e:docs/source/user_guide/release_notes.md#L114-L128
  - vllm-ascend@28bf3a2e:docs/source/tutorials/features/suffix_speculative_decoding.md#L92-L95
evidence: "C"
relations: []
contradicts: []
updated: "2026-09-14"
---

## 一句话

`weight_prefetch_config` 是 v0.23.0 的 `--additional-config` 子配置，开了之后 vllm-ascend 会在一条独立的 NPU stream 上，把下一个 linear 层的权重提前从 HBM 搬进 **L2 cache**，让这段搬运藏在当前正在跑的 vector 算子（quantize、MoE gating top_k、RMSNorm、SwiGLU）背后，从而降低 linear 计算时的 MTE 占用 [S1]。**两版行为完全分叉** [!]：v0.23.0 上它是一个可用的 `dict` 开关，默认 `{}` 即关闭；main（`28bf3a2e`）上整套 `vllm_ascend/ops/weight_prefetch.py` 与配置字段都已删除，而顶层 `AscendConfig` 是 `extra="forbid"` 的 pydantic 模型 [C23]，所以传这个键不是被忽略，而是启动直接失败。它只有一个子键值得单独看：[prefetch_ratio](prefetch-ratio.md)。

## 事实表

| 项 | v0.23.0 | main | 意味着什么 |
|---|---|---|---|
| 字段本身 | `dict`，默认 `{}` | 已删除 | main 上传它会被 `extra="forbid"` 拒绝，不是静默忽略——升级时必须从启动命令里删掉 |
| `enabled` | `bool`，默认 `False` [C7] | — | 只写 `"weight_prefetch_config": {}` 等于没开；必须显式 `{"enabled": true}` |
| `prefetch_ratio` | 唯一子键，五个权重各一个比例，见 [prefetch_ratio](prefetch-ratio.md) | — | 默认那组值是按 Qwen3-235B-A22B-W8A8 / `--max-num-seqs 144` 调的，换模型换并发就不再是最优 |
| 预取目的地 | L2 cache | — | 不额外占 HBM——`torch_npu.npu_prefetch` 只搬数据不分配张量 [D] |
| 单次预取上限 | 18 MiB（`MAX_PREFETCH_WEIGHT_SIZE`）[C8] | — | 单层权重再大也只预取 18 MiB，ratio 调到 1.0 以上也没意义；代码里这个 clamp 只写在 MLP 两条路径上，attn/moe 靠后端截断 |
| MoE `gate_up` 触发门槛 | 本次 forward `num_tokens >= 96` [C12] | — | 小 batch decode 下 MoE 预取整条路径被跳过，profiling 里看不到 CMO 就是这个原因 |
| MLP 触发门槛 | 本次 forward `num_tokens < 500` | — | 方向与 MoE 相反：dense 模型的长 prefill 反而不预取 |
| `attn` 的 qkv/o 路径 | 仅 `AscendW8A8LinearMethod.apply` 且 `x.dtype != torch.int8` [C19] | — | 非 W8A8 的模型即使 `enabled: true`，`attn` 那两个 ratio 也完全不起作用 |
| `mlp` / `moe` 互斥 | `mlp` 只在非 MoE 模型开，`moe` 只在 MoE 模型开 | — | 一次运行里最多有一个生效，两组 ratio 不会同时被读 |
| 越界 ratio | 落在 `[0, 1]` 外的值被静默丢弃 | — | 写 `1.5` 不报错也不 clamp，而是这一项消失；某模块 ratio 全丢光时该模块自动关闭 |

## 为什么存在

Linear 层在昇腾上的瓶颈常常不在 Cube 而在 MTE——权重从 HBM 搬到片上的带宽没喂饱，Cube 就在等数据。官方文档把这件事说得很直白：linear 层的 MTE 利用率偏高，于是上游专门开了一条预取流水，与原有的 vector 计算流水并行跑，把权重提前搬到 L2，降低 linear 计算期间的 MTE 占用，间接提高 Cube 效率。

代码里这条「独立流水线」就是一条 `torch.npu.Stream` 单例，加上一对成对出现的自定义算子：`prefetch_preprocess` 让预取流等一下计算流、切过去发预取，`prefetch_postprocess` 让计算流回头等预取流 [C16]。配置在 `NPUModelRunner.__init__` 里被交给一个进程内全局的 `WeightPrefetchMethod` 单例，各算子再通过 `get_weight_prefetch_method()` 取回来。三个插桩点分别是：MoE 的 `select_experts` 里预取 `w13_weight`、`CustomRowParallelOp.apply` 之后预取下一层 `mlp.gate_up_proj`、`AscendSiluAndMul.forward_oot` 里把 `mlp.down_proj` 的预取夹在 SwiGLU 前后。

「藏在 vector 计算背后」这个说法在 `gate_up` 这条路径上尤其实在：它的起点判据是 `curr_layer_prefix.split(".")[-2] == "self_attn"` [C14]，也就是在 attention 的 o_proj 算完时就去取**同一层 MLP** 的 gate_up 权重，提前量接近一整个 attention 的时间。

这个开关的血缘可以一直追到 `enable_prefetch` 与环境变量 `VLLM_ASCEND_ENABLE_PREFETCH_MLP`；v0.23.0 是它统一成 `weight_prefetch_config` 之后的形态 [I]。但同一份 v0.23.0 release notes 已经把 Weight prefetch 列进「Ready to Deprecate」，到 main 上 `vllm_ascend/ops/weight_prefetch.py` 与配置字段一起消失，**没有等价替代参数**——去向是直接下线，不是改名。需要注意别认错门：main 上的 `vllm_ascend/model_executor/offloader/prefetch.py` 是 CPU 权重卸载的预取（HBM ↔ 主机内存），和这里的 L2 预取不是一回事 [I]。

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

**升级到 main 时必须动手删。** 因为 `extra="forbid"`，把 v0.23.0 的启动命令原样搬到 main 上会在配置解析阶段就失败，而不是打一条 warning 继续跑。想在 main 上要同类收益，只能走别的路子（图模式、算子融合等），这个参数本身没有对应物。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出，不由人或 agent 撰写。

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
| main | 无 |

**移除**：2026-07-16，PR [#11949](https://github.com/vllm-project/vllm-ascend/pull/11949) —— [Refactor] Remove weight prefetch config (#11949)

影响面（删除行数最多的几个文件）：

- `vllm_ascend/ops/weight_prefetch.py` −238
- `vllm_ascend/ops/register_custom_ops.py` −40
- `vllm_ascend/utils.py` −25
- `vllm_ascend/ascend_config.py` −22
- `vllm_ascend/quantization/methods/w8a8_static.py` −15

**引入**：2025-10-09，PR [#3146](https://github.com/vllm-project/vllm-ascend/pull/3146) —— [1/N][Feat] Add weight prefetch feature for Attention layers (#3146)

