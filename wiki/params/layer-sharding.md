---
id: layer-sharding
title: layer_sharding
type: param
summary: >-
  点名一组同构 Linear，让第 i 层的权重只存在通信组内第 i % K 张卡上，前向时异步广播取回；只能在 PD 分离的 P 节点开，main
  上已整体删除。
aliases:
  - Layer Sharding Linear
  - 层间权重分片
  - 按层切权重
chapters:
  - '13'
sources:
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L105-L112'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L338-L346'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layer_shard_linear.py#L39-L56'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layer_shard_linear.py#L211-L253'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layer_shard_linear.py#L122-L152'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/layer_shard_linear.py#L285-L296'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L412-L417'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L712-L724'
  - 'vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L191-L226'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1293-L1297'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1309-L1317'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1538-L1549'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/model_loader/rfork/rfork_loader.py#L236-L247
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L766-L775'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/layer_sharding.md#L5-L18
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/layer_sharding.md#L30-L42
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L86
  - 'vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L114-L128'
  - 'vllm-ascend@2c59ff10:docs/source/tutorials/models/GLM5.md#L359'
  - 'vllm-ascend@2c59ff10:docs/source/tutorials/models/DeepSeek-V3.2.md#L486'
  - 'vllm-ascend@b255ab59:vllm_ascend/utils.py#L1458-L1473'
  - 'vllm-ascend@b255ab59:vllm_ascend/weight_switch/linear.py#L146-L182'
  - 'vllm-ascend@b255ab59:docs/source/tutorials/models/GLM5.2.md#L1030'
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L105
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L438-L454'
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1603-L1651'
  - >-
    vllm-ascend@b255ab59:docs/source/user_guide/configuration/additional_config.md#L76
  - 'vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1650-L1661'
  - 'vllm-ascend@b255ab59:docs/source/user_guide/release_notes.md#L56-L64'
verified: ["main", "releases/v0.23.0"]
evidence: C
relations:
  - to: enable-matmul-allreduce
    kind: conflicts-with
    note: >-
      同在 _get_row_parallel_op 的分派链上，ShardedCPRowParallelOp 排在前面——切了 o_proj
      的那一层就静默不再走 matmul-allreduce 融合算子，没有告警
contradicts: []
updated: '2026-09-20'
rawSources:
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
  - >-
    raw/sha256-d5ae5978ab15999f012c8b4e21f00edf25723b330a507f4453b4a61869032de9.md
---

## 一句话

`layer_sharding` 接一个**层名列表**——不是官方表写的 dict——把这些名字对应的 Linear 权重按层号轮流分到一个通信组的 K 张卡上：第 `i` 层只存在 rank `i % K` 上，其余卡上这块权重被置空，前向时靠异步 broadcast 提前一层取回 [C3]。默认 `None`，也就是不开。

该碰它的只有一种人：跑 DeepSeek-V3 这类深层模型、做了 PD 分离、而且 P 节点显存已经放不下的运维。别的场景要么根本起不来——`kv_role` 不是 `kv_producer` 就抛 `ValueError` [C2]——要么是净亏。

**[那条请求](../concepts/one-request.md)用不到它。** Qwen3-0.6B 单卡、没有 `kv_transfer_config`，把这个键配上连启动都过不去。而且这一页讲的整套机制只活在 v0.23 维护分支上：它在那里就已被官方列入待废弃清单 [S18]，main 开发主线（`b255ab59`）上参数、实现文件、feature guide 全部删干净，发布说明里明写着「Removed layer sharding. #11953」[S29]。

官方文档对应页：[Layer Sharding Linear Guide](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/layer_sharding.html)、[Additional Configuration](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)、[Release Notes](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/release_notes.html)（latest 版下前两者已不存在）。

## 事实表

| 项 | v0.23 维护分支（`2c59ff10`） | main 开发主线（`b255ab59`） | 意味着什么 |
|---|---|---|---|
| 是否存在 | 有 | **已删除**：`vllm_ascend/` 下 `layer_sharding` 零命中，`ops/layer_shard_linear.py` 与 feature guide 均不存在 | 照 v0.23.0 的教程往新版上搬，通常是**启动直接报错**而不是被忽略；装了 vLLM-Omni 才降级成一条 warning [C25][C28] |
| 实际类型 / 默认值 | `list[str]`，默认 `None` | — | 官方表写的 `dict` / `{}` 两项都是错的 [!]；写成 `{"o_proj": ...}` 不会报错，但 `"o_proj" in {...}` 的语义变成查键，行为不是你想要的 |
| 取值 | 层名，取 `prefix` 最后一段，如 `["o_proj", "q_b_proj"]` | — | 名字拼错只有一条 `warning_once`，不报错、静默不切，得去日志里找 |
| 子键 | **没有**，它是扁平列表 | — | 不存在「dict 里有哪些键」这回事；`prefetch_step` 在两个注册点都写死 1，用户无法调 |
| 权重归属 | 第 `i` 层落在组内 rank `i % K` | — | K 是 `shard_weight` 组大小，不是 TP size；TP 切层内、它切层间，两者正交 |
| 常驻缓冲 | `prefetch_step + 1 = 2` 份整权重 / 每个 series | — | 省下的不是 1/K 而是 `总量/K + 2×单层`，层数少时这 2 份能吃掉大半收益 |
| 启用前提 | `kv_role` 必须是 `kv_producer`，否则启动抛 `ValueError` | — | 混部（无 `kv_transfer_config`）、`kv_both`、D 节点一律起不来 |
| 配 FlashComm2 时取值 | 只能严格等于 `["o_proj"]`，否则 `ValueError` | FlashComm2 本身也已从 `vllm_ascend/` 删除 | 想同时切 `q_b_proj` 就不能开 FlashComm2，只能走 DSA-CP 那条路 |
| 配 RFork 时 | 静默降级：RFork 被绕过，退回默认 loader | — | 只有一条 warning，模型加载变慢而不报错，容易被当成「RFork 没生效」排查半天 |
| 官方状态 | 已列入 Ready to Deprecate，与 FlashComm2 同批 | 已执行 | 新部署不要引入；已有部署要准备迁移 |

## 为什么存在

深层模型里有一类权重矩阵，**每层结构完全一样、数值各不相同，而且每层都必须以完整形态驻留**。最典型的是 DeepSeek-V3/R1 这类 61 层模型的 `o_proj`：一旦开了 FlashComm2 或 DSA-CP，输出投影矩阵在该层前向时需要全量在手，没法靠 TP 继续摊薄。61 份全量矩阵压在每张卡上，纯粹是容量问题——不是算得慢，是放不下。

`layer_sharding` 的做法是换一个维度切：**TP 切的是层内（一个矩阵切给多张卡），它切的是层间（多个矩阵轮流放）**。注册时，不归本卡的层直接 `dispose_tensor` 把张量置空，并把 `weight_loader` 换成 no-op——连从磁盘读都省了 [C4]。前向时靠 `reach_layer` 发一个异步 `dist.broadcast`，到该层 `forward` 入口再 `wait_weight` 收。因为 `prefetch_step` 恒为 1 [C6]，能用来遮掩这次通信的，正好是一层 attention 的计算时间。

```wiki-diagram
file: layer-sharding
```

「只能在 P 节点」不是实现凑合，是设计前提。上游把理由直接写在代码注释里：广播只有被更重的 prefill 计算盖住才划算，所以只在 P 侧实例启用 [C12]。Decode 阶段每层计算量小得多，同样一次广播遮不住，就成了净亏。这条在 `platform.py` 里是启动期硬校验，不是建议。

组建在哪几张卡上，取决于走哪条分支：FlashComm2 场景用 otp 组、DSA-CP 场景按全复制建、其余用全局 TP 组。注意那里的判据是 `layer_sharding is not None`，所以传一个空列表 `[]` 会照样建出 `shard_weight` 组，却因为 `platform.py` 对空值提前返回而跳过 P 节点校验 [C9]——空列表是个既不报错也不生效、只白建一个通信组的状态。

## 开了的代价

**显存这笔账（DeepSeek-V3/R1，W8A8，单节点 16 卡、TP16、PP1）。** `o_proj` 权重形状是 `[hidden_size, num_heads × v_head_dim] = [7168, 128 × 128] = [7168, 16384]`，即 117,440,512 个元素；int8 每元素 1 字节，单层 **112 MiB**。61 层全量驻留 = `112 MiB × 61 = 6832 MiB ≈ 6.67 GiB`。切到 K = 16 张卡后，本卡只留 `6832 / 16 = 427 MiB`，再加 2 份窗口缓冲 `2 × 112 = 224 MiB`，共 **651 MiB**，省下约 **6.0 GiB**。这里的维度取自 DeepSeek-V3 的公开配置、K 由上面的组建规则推算，两者都不是从源码直接读出的常数 [D]。

**通信这笔账。** 每张卡对它不负责的那 15/16 的层都要收一份全量权重：`61 × (15/16) × 112 MiB ≈ 6.3 GiB`，**每次前向、每张卡**。摊到每层约 105 MiB，必须在一层 attention 的计算时间内传完 [D]。这就是为什么它对 batch 小、序列短的场景是纯负收益——官方在配置读取处直接告警：不配 FlashComm2 / DSA-CP 就开，性能会显著退化 [C1]。

**和谁抢 `o_proj`。** `_get_row_parallel_op` 的分派是有序的：`ShardedCPRowParallelOp`（DSA-CP + layer sharding 的 `o_proj` 路径）排在 `oproj_tensor_parallel_size`、[matmul-allreduce](enable-matmul-allreduce.md)、FlashComm2 各条之前 [C8]。也就是说 DSA-CP 场景下切了 `o_proj`，这一层就不会再走 matmul-allreduce 或 FlashComm2 的 row-parallel 实现——不报错，静默生效，看 profiling 时容易困惑。

**文档自相矛盾的一处，配之前务必确认。** feature guide 的 DSA-CP 示例是 `VLLM_ASCEND_ENABLE_FLASHCOMM1=1` 配 `["q_b_proj", "o_proj"]` [S16]，DeepSeek-V3.2 教程也给了同样的可复制启动行；但 GLM5 / GLM5.2 / InternVL3.5 三篇教程都写着「开了 FlashComm 后 `layer_sharding` 不能包含 `o_proj`」[S19]。源码层面 DSA-CP + `o_proj` 的路径是存在且被专门分派的，所以这条限制更像是模型相关而非全局，但上游没有任何一处把话说圆 [!]。按模型选对应教程的说法，不要跨模型套用。

**升到 main，旧启动命令通常起不来。** `AscendConfig` 是 `extra="forbid"` 的 pydantic 模型，未知 key 当拼写错误 fail fast [C25]；`_NON_USER_INPUT_KEYS` 的豁免名单里只放了同批下线的 `enable_flashcomm1`，没有放 `layer_sharding` [C26]。报错比静默忽略好，至少不会让人以为显存省下来了。

**但有一个例外：装了 vLLM-Omni 就不报错。** 构造 `AscendConfig` 前先算出 `unknown_keys`，非空且 `importlib.util.find_spec("vllm_omni")` 找得到时，只打一条「这些键对 vLLM-Ascend 无效」的 warning 再把它们剔掉 [C28]。同一份旧配置，在纯 vllm-ascend 环境里启动失败，在装了 Omni 的环境里只留一行 warning 就跑起来——后者更坑，因为你会以为 `layer_sharding` 还在生效。

**那件事 main 上由谁做。** 判定函数从 `enable_dsa_cp_with_layer_shard` 改名成 `enable_dsa_cp_full_o_proj`，判定条件一字未改（没配 KV 池化、或本实例是 kv_producer 含 `kv_both`），注释把新做法写明了：`o_proj` 权重常驻分片态，DSA-CP prefill 需要全量时由运行时**异步 gather 出一份临时全量权重**，用完即弃 [C21]。

承接这件事的代码也搬了家。`vllm_ascend/quantization/tp_weight_switch.py` 在 `78cd10de`（PR [#14814](https://github.com/vllm-project/vllm-ascend/pull/14814)）里被拆成 `vllm_ascend/weight_switch/linear.py` 和 `o_proj.py`：`TPWeightSwitchMixin` 改名 `WeightSwitchMixin`，统一开关位 `supports_tp_weight_switch` 改名 `supports_weight_switch`，适用范围从 TP 一个并行域扩到了多个 [C22]。要在 main 上找这套机制，别再照 `tp_weight_switch` 这个名字搜。

**真要用户点名的那个开关，main 上叫 `enable_pcp_o_proj_weight_sharding`。** `bool`、默认 `False`，让 SFA-PCP 在加载期把 `o_proj` 权重按 PCP 组切开、运行时在本地视图与 gather 视图之间切换；官方表明确写着它不影响 DSA-CP [S27]。和 `layer_sharding` 的差别在于用户说了算的范围小了一圈：切哪个权重、按哪个并行域切都定死了，你只能决定开不开。

**main 上的过时文字还在，别当真。** GLM5.2、GLM5 两篇教程以及两份部署模板里都还留着「开了 FlashComm 后 `layer_sharding` 不能包含 `o_proj`」[S23]。`vllm_ascend/` 里既没有 `layer_sharding` 也没有 FlashComm2，这句话现在两头都落空。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 有（6 个文件） |
| releases/v0.18.0 | 有（7 个文件） |
| releases/v0.20.2rc | 有（7 个文件） |
| releases/v0.21.0rc | 有（7 个文件） |
| releases/v0.22.1rc | 有（7 个文件） |
| releases/v0.23.0 | 有（8 个文件） |
| releases/v0.24.0rc | 无 |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 无 |
| main | 无 |

- **引入**：2026-01-08 · f7db812ed7514194f15ef479817997113bf115bd · PR [#5181](https://github.com/vllm-project/vllm-ascend/pull/5181) —— [refactor] Refactor the interface for shard weight and remove the flashcomm2 o_shared interface. (#5181)
  包含该提交的 tag：v0.13.0、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/distributed/parallel_state.py` +67 / −51（文本行变化）
  - `vllm_ascend/attention/sfa_v1.py` +23 / −34（文本行变化）
  - `vllm_ascend/ops/{shared_weight_layer.py => layer_shard_linear.py}` +56 / −28（文本行变化）
  - `vllm_ascend/attention/mla_v1.py` +23 / −27（文本行变化）
  - `vllm_ascend/utils.py` +34 / −15（文本行变化）
- **移除**：2026-07-15 · 896012151dbaaa444e940f19106fde877d616dc9 · PR [#11953](https://github.com/vllm-project/vllm-ascend/pull/11953) —— [Refactor] remove layer sharding (#11953)
  包含该提交的 tag：v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel
  - `vllm_ascend/ops/layer_shard_linear.py` +0 / −296（文本行变化）
  - `vllm_ascend/ops/flashcomm2_oshard_manager.py` +0 / −103（文本行变化）
  - `vllm_ascend/ops/linear_op.py` +1 / −72（文本行变化）
  - `vllm_ascend/distributed/parallel_state.py` +1 / −51（文本行变化）
  - `vllm_ascend/attention/sfa_v1.py` +3 / −37（文本行变化）

当前含该标识符的 tag：v0.13.0、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0rc1

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["layer_sharding"]` |
| 类型 | `unknown` |
| 默认表达式 | `None` |
| 定义 | `vllm_ascend/ascend_config.py:105` [C24] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
