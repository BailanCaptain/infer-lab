---
id: vllm-ascend-repo-map
title: vllm_ascend 目录地图
type: concept
summary: 昇腾插件有十几万行 Python，按职责能分成六组。第一遍只用读其中三组，其余等碰到具体问题再去翻。
aliases: [目录结构, 代码结构, 仓库结构, repo map, vllm_ascend 目录]
chapters: ["20"]
order: 10
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L38-L42
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L128-L146
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L268-L269
  - vllm-ascend@2c59ff10:vllm_ascend/ops/__init__.py#L21-L33
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L82-L100
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L127-L145
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L1001-L1001
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L95-L96
  - vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/token_dispatcher.py#L34-L34
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L740-L766
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "D"
relations:
  - to: vllm-ascend-overview
    kind: builds-on
    note: 看地图之前要先知道这个仓库为什么存在，边界在哪里
  - to: one-request
    kind: builds-on
    note: 那条请求会走进五个目录；量化、投机解码、310P 专用这三个目录里的文件它一个都不碰
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 第一次打开这个仓库，从哪读起

你想弄清楚昇腾插件到底做了什么，于是打开了它的代码目录，看到的是：v0.23 维护分支上 23 个子目录、442 个 Python 文件、约 13 万行；v0.26 分支上涨到 24 个子目录、500 个文件、约 15 万行。

从头读一遍不现实，也没必要。按「这个目录负责什么」分成六组之后，第一遍真正要读的只有三组；两个版本上都是这三组。下面这张图按真实行数把最大的几个目录排了一遍。

```wiki-diagram
file: vllm-ascend-repo-map
```

## 六组里只有第一组是主干

**第一组 · 主干（三个目录）。** 「单卡执行」管一张卡上从拿到一批请求到算出结果的全部流程；「注意力」管注意力怎么算、KV Cache 长什么形状；「算子替换」把上游的线性层、归一化、专家层等换成昇腾实现。读懂这三个就能跟完一次请求。其中单卡执行那组有一个文件就五千多行，占了整组的三分之一以上，是全仓库最该精读的一个文件，见 [NPUModelRunner 怎么读](npu-model-runner.md)。

**第二组 · 接缝（三个目录）。** 这一组不实现推理逻辑，只负责「怎么接进上游 vLLM」。最大的是「接上游的补丁」，六十多个文件，都是在运行时把上游的对象换掉，见 [Patch 机制](ascend-patch-system.md)。

**第三组 · 并行与通信（四个目录）。** 「跨卡通信」单独就有两万多行，是除算子替换外第二大的目录，覆盖[张量并行（TP）](tensor-parallel.md)、流水并行、数据并行、[专家并行（EP）](expert-parallel.md)的通信，以及 KV 传输、权重传输。第一遍可以不进去，但排查跨卡问题一定会回到这里。

**第四组 · 图与编译（两个目录）。** 两条路径：一条是 ACL Graph 加昇腾自己的编译后端，另一条是实验性的，见 [图模式层](graph-mode-layer.md)。

**第五组 · 模型、权重与采样（六个目录）。** [量化](quantization.md)、模型加载、[投机解码](speculative-decoding.md)都在这一组。共同点是「用到这个模型或这个特性时才会走到」。

**第六组 · 专用与周边。** 最大的是 310P 专用目录：310P 这一代硬件的专用实现，形状上是整套主干的平行副本。另有一个目录里没有 Python 文件，只是编译出的算子放置的地方。这一组第一遍**应该跳过**，尤其是 310P 那个目录，它会让人误以为同一个类有两套互相矛盾的实现。

## 文件多不等于重要

把各目录的文件数和行数放在一起看，会发现两种完全不同的形状：

- **算子替换和补丁**：文件多，单个文件小。一个文件管一个算子或一处替换，靠目录名和文件名就能定位。
- **单卡执行和注意力**：文件少，单个文件极大。靠文件名定位不到，必须按函数名跳转。

这决定了两种读法。第一次跟请求路径时，算子替换是被动的一层：它是模型往前算时被调到的实现，不是你要追的入口。单卡执行那组的文件数只有它的三分之一，却是主干。

## 那条请求会走进哪几组

拿[贯穿全库的例子](one-request.md)来对照：Qwen3.6-35B-A3B 跑在一张 Atlas A3 卡的两颗 NPU 上，bf16 权重，注意力对半切（TP=2），专家按编号分给两颗 NPU。它会走进五个目录：

- **单卡执行**：每颗 NPU 上的整个执行流程，启动时也在这里把两颗 NPU 之间的通信组建好；
- **注意力**：40 层里那 10 层全注意力要算注意力、写 KV Cache；
- **算子替换**：线性层、归一化、专家层都被换成了昇腾实现，模型往前算时会被调到；
- **跨卡通信**：两颗 NPU 之间的通信组在这里定义，专家层把 token 发出去、收回来也要用到其中的一个组；
- **接上游的补丁**：这个模型每个块 2048 个位置，就是补丁按线性注意力状态的大小换算出来的。

另外三个目录里的文件它一个都不碰：

- **量化**：用的是 bf16 权重，没开量化；
- **投机解码**：没开；
- **310P 专用**：跑在 A3 上，不是 310P。

**「13 万行」之所以吓人，是因为它把所有场景的代码加在了一起。** 任何一条具体的请求只会走过其中一部分，而且就算在走进的五个目录里，它也只经过少数几个文件。先钉死一条请求，再决定读哪几个目录，是读这个仓库唯一可行的办法。

## 版本之间：目录几乎没变，代码变了很多

v0.23 维护分支和 main 开发主线在目录层面差 8 项，各有 4 个对方没有的；其余 21 个子目录两边同名。**同名不等于同内容**：同一个类，在两个分支上的行号能差出四十多行。

v0.26 分支比 v0.23 只差两项：少了一个文件，多了一个目录；v0.23 的 23 个子目录在 v0.26 上一个不少。可文件数和行数涨了一大截：442 个文件变成 500 个，13 万行变成 15 万行，**涨的部分全在同名目录内部**。所以「目录没变」千万别读成「代码没变」。

唯一改了名次的是单卡执行那组：v0.26 上文件多了十个，行数反而少了一千，补丁那组因此在行数上越过了它。它仍然是第一遍就该读的那个。

## 常见误解

- **「目录名能直接推出职责」**——大部分能，有两个例外要记住：名字叫「核心」的那个目录不是核心推理逻辑，而是接上游调度与 KV Cache 管理的接缝；名字叫「模型执行」的那个在 v0.23 上只有 3 个文件，远比名字听起来小。两者的目录名见下半的表。
- **「310P 专用目录是旧代码」**——它是 310P 这一代硬件的专用实现，在 v0.23 与 v0.26 两个分支上都是活的。看到同名类有两套实现，先确认自己在看哪一套。
- **「文件多的目录最重要」**——算子替换文件最多，但第一次读请求路径时它是被动的一层；单卡执行文件只有它的三分之一，却是主干。

## 对照源码

这一节给要自己去读源码的人：目录名、文件数、行数和行号都在这里。

### 版本差异

- **v0.23 与 main 在目录层面差 8 项** [D]：v0.23 维护分支独有 `flash_common3_context.py`、`kv_offload/`、`memcache_comm_fence.py`、`simple_kv_offload/`；main 独有 `config_utils.py`、`ec_manager/`、`observability/`、`weight_switch/`。其余 21 个子目录两边同名，但内容不同：`platform.py` 里 `class NPUPlatform` 在 v0.23 上是第 128 行 [C2]、在 main 上是第 82 行 [C5]。对照方法见[怎么读这个仓库](reading-vllm-ascend.md)。
- **v0.26（`2ed6cbba`）比 v0.23（`2c59ff10`）只差两项** [D]：`flash_common3_context.py` 没了，多出一个 `transformers_utils/`。增长全在同名目录内部 [A]；`class NPUPlatform` 在 v0.26 上是第 127 行，只比 v0.23 差一行 [C6]。
- **`worker/` 在 v0.26 上掉了名次** [D]：文件 31 → 41，行数 14486 → 13481。原因是 `pcp_utils.py`（2387 行）与 `kvcomp_utils.py` 这两个大文件没了，新增的十来个小文件多半落在 `worker/v2/spec_decode/` 下。`worker/model_runner_v1.py` 在 v0.23 上 5251 行，占 `worker/` 的三分之一；v0.26 上 5314 行，占五分之二 [D]。
- `model_executor/` 在 v0.23 上 3 个文件 263 行，v0.26 上 9 个文件 876 行 [D]。
- 把 `ops/fused_moe/fused_moe.py` 的 `AscendFusedMoE` 登记进替换表的那段带版本判断，只在 `vllm_version_is("0.23.0")` 时生效 [C10]；其他版本上专家层怎么接进来，见[专家并行](expert-parallel.md)。

### 源码位置

**六组与目录的对应**（v0.23 维护分支 `2c59ff10`）：

| 组 | 目录 |
|---|---|
| 主干 | `worker/`（单卡执行）、`attention/`（注意力）、`ops/`（算子替换） |
| 接缝 | `patch/`（接上游的补丁）、`core/`、`model_executor/` |
| 并行与通信 | `distributed/`（跨卡通信）等四个目录 |
| 图与编译 | `compilation/`（ACL Graph 与自有编译后端）、`xlite/`（实验性） |
| 模型、权重与采样 | `quantization/`、`model_loader/`（16 个文件，含 netloader 与 rfork 两个加载器）、`spec_decode/`（12 个文件）等六个目录 |
| 专用与周边 | `_310p/`（49 个文件）、`_cann_ops_custom/`（没有 `.py`，是构建产物的落点） |

**按规模排**（两列都实测于 `2c59ff10` 与 `2ed6cbba` [D]）：

| 目录 | 文件数 v0.23 → v0.26 | 行数 v0.23 → v0.26 | 什么时候读 |
|---|---|---|---|
| `ops/` | 89 → 96 | 23484 → 25737 | 追一个具体算子时 |
| `distributed/` | 46 → 53 | 20985 → 25547 | 排查跨卡问题时 |
| `attention/` | 17 → 17 | 14732 → 15188 | 第一遍就读 |
| `worker/` | 31 → 41 | 14486 → 13481 | 第一遍就读 |
| `patch/` | 64 → 76 | 10546 → 14058 | 怀疑上游行为被改过时 |
| `_310p/` | 49 → 49 | 6838 → 6648 | 只在 310P 上跑时 |
| `quantization/` | 27 → 27 | 6578 → 6748 | 开量化时 |

图里最长那条「其余 16 个目录」是 v0.23 上除表中 7 个目录外的另外 16 个子目录，连同 `vllm_ascend/` 根下 13 个 `.py`，合计 119 个文件、33012 行 [D]。

**入口与主干的几个钉点**：

- 插件入口：`vllm_ascend/__init__.py` 的 `register()` 返回 `"vllm_ascend.platform.NPUPlatform"`；`NPUPlatform` 定义在 `platform.py` 第 128 行起。
- 单卡执行主干：`worker/model_runner_v1.py` 的 `class NPUModelRunner(GPUModelRunner)` 在第 268 行。
- 算子替换的注册：`ops/__init__.py` 开头依次导入 `fused_moe`、`layernorm`、`register_custom_ops` 等模块；上游层到昇腾实现的替换表在 `utils.py` 的 `REGISTERED_ASCEND_OPS`，含 `ColumnParallelLinear`、`RowParallelLinear`、`QKVParallelLinear`、`RMSNorm`、`GatedDeltaNetAttention` 等。

**那条请求走进的五个目录，各自的一处证据**（例子设定见[贯穿全库的例子](one-request.md)的对照源码一节）：

- `worker/`：`worker.py` 第 1001 行调 `init_ascend_model_parallel(self.parallel_config)` 建昇腾自己的通信组。
- `distributed/`：`parallel_state.py` 第 95–96 行建 `mc2` 通信组；专家层的 `ops/fused_moe/token_dispatcher.py` 第 34 行导入 `get_mc2_group`。
- `ops/`：见上面的替换表；「37 个 token 补成 38、每颗 19 个」发生在 `ops/fused_moe/prepare_finalize.py`，行号见[贯穿全库的例子](one-request.md)。
- `patch/`：块大小 2048 由 `patch/platform/patch_mamba_config.py` 算出，推导见[贯穿全库的例子](one-request.md)。
- `attention/`：10 层全注意力走这里的注意力后端 [A]。
- 这个模型的线性注意力层是上游的 `QwenGatedDeltaNetAttention`，它是 `GatedDeltaNetAttention` 的子类；替换表按 `GatedDeltaNetAttention` 这个名字登记了 `ops/gdn.py` 的昇腾实现，但子类是否也被换掉本页没有核到，所以上半没写。
- 五个目录在 v0.23 上合计 31 + 17 + 89 + 64 + 46 = 247 个文件；不碰的三个目录 `quantization/`、`spec_decode/`、`_310p/` 合计 27 + 12 + 49 = 88 个文件 [D]。
