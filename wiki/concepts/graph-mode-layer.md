---
id: graph-mode-layer
title: 图模式层
type: feature
summary: 图模式把一整趟计算提前录下来，之后照着回放，省掉一个一个下发算子的开销；它分单算子、分段、整趟几档，录像在启动的最后一步做完。
aliases: [ACL Graph, ACLGraphWrapper, AscendCompiler, 图模式, graph mode, piecewise, xlite, 单算子模式, eager 模式]
chapters: ["16"]
order: 30
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L128-L134
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L176-L182
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L892-L897
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L55-L64
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L65-L85
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L706-L732
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L680-L690
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/ACL_Graph.md#L1-L14
  - https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/ACL_Graph.html
  - vllm-ascend@2c59ff10:vllm_ascend/xlite/xlite_worker.py#L16-L30
  - vllm-ascend@2c59ff10:vllm_ascend/xlite/xlite_model_runner.py#L19-L36
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L768-L778
  - vllm@0fc695fc:vllm/config/compilation.py#L53-L69
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "S"
relations:
  - to: npu-model-runner
    kind: builds-on
    note: 捕获与回放包的就是 runner 的执行体，_dummy_run 是跑假批的那一步
  - to: one-request
    kind: builds-on
    note: 那条请求的 199 步 decode 形状一样，回放的是同一张图——图模式的收益几乎全在这里
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 199 步，每一步都在重复同一串下发

[那条请求](one-request.md)：Qwen3.6-35B-A3B 跑在两颗昇腾 NPU 上，问题 37 个 token，回答 200 个 token。第一步把 37 个 token 一起算完，之后 199 步每步只算 1 个。

每一步都要把 40 层从头走一遍，每层里有注意力、挑专家、算专家、归一化等好几个[算子](matmul-and-weights.md)（算子就是 NPU 上真正执行的一小段计算，比如一次矩阵乘）。NPU 自己不知道下一个该算什么，得由 CPU 一个一个告诉它：「现在算这个，数据在这里」。这叫**下发**。

问题就出在这里：decode 那 199 步每步只算 1 个 token，NPU 上每个算子都很快就算完了，反倒是 CPU 下发的那点时间开始显眼——NPU 算完一个，还要等 CPU 把下一个递过来。而这 199 步，下发的是一模一样的一串东西。

**图模式**的办法是：把这一整串下发提前录下来（叫**捕获**），之后每一步不再一个一个下发，而是一句话让 NPU 照录好的那串从头播一遍（叫**回放**）。录下来的那一串就叫一张「图」。

## 三档：一个一个下发、按段回放、整趟回放

```wiki-diagram
file: graph-mode
```

同一趟前向，按「录多少」分成三档：

- **单算子模式**（也叫 eager 模式）：什么都不录，每个算子由 CPU 单独下发。最慢，但最好排查，什么形状都能跑。
- **分段回放**（piecewise）：把一趟前向在注意力那里切开，注意力之外的部分各录成一段图；注意力自己每步照常下发。注意力留在外面，是因为它最依赖「这一步有几个 token、每个 token 前面有多长」这些每步都在变的东西。
- **整趟回放**（full）：连注意力一起，整趟前向录成一张图。下发最省，但对注意力要求最高——这一步的注意力参数必须能在回放前塞进录好的图里。

还有两种组合档：「decode 步整趟回放，其他步单算子」，以及「decode 步整趟回放，其他步分段回放」。后一种是什么都不配时的默认档。之所以把 decode 单独拎出来，是因为 decode 步的形状最整齐——批里每条请求都只有 1 个 token——整趟录最划算。

## 那条请求走到这里

那条请求的 200 步，在图模式眼里只有两类：

- **第 1 步**，批里有 37 个 token。录像是按批里 token 数分档录的，37 不在档位表里，要么补到一个录过的档，要么不走整趟图。
- **第 2 到第 200 步**，每步 1 个 token，**199 步的形状一模一样**，查到的是同一个档、回放的是同一张图。

这解释了图模式的收益结构：**它几乎全部来自 decode**。prefill 的形状千变万化，每种都录不划算；decode 的形状高度重复，录一次能用上千次。那条请求 199 次回放同一张图，省掉的是 199 次把 40 层的算子一个一个递给 NPU。

档位表本身怎么来的，在 [ACL Graph](acl-graph.md) 里有完整推算：默认配置下从 1 到 256 一共 35 档。

## 录像在启动的最后一步

那 199 次回放有个前提：启动时就得把每个档位真跑一遍录下来。所以 vLLM 启动的最后一段是「按每个档位跑一遍假批并录像」，档位越多、这一段越久。开图模式启动慢，钱主要花在这里。

录像不是第一次来请求时才做的——等你发出第一条请求时，所有档位早已录好。

打开「强制单算子模式」的开关，录像这一步整个跳过，每一步都一个一个下发。这是排查图模式问题最快的一刀：打开之后问题消失，范围就锁在图模式这一层。

## 谁决定这一步走哪档

负责捕获和回放的那个包装，自己**不做任何判断**。每一步开始前，上游已经算好「这一步走哪档、查哪个 key」并放在一个公共的地方；包装只照单执行：档位对不上就直接调原函数，对得上就按 key 查——没录过就现场录，录过就回放。

所以「为什么这一步没走图」，要查的是上游怎么给这一步定的档，不是查这个包装。

## 上游管通用，昇腾管三件事

图模式的大部分概念——几档怎么定义、每一步怎么选档、按批大小分档和补齐——都是 vLLM 通用的，昇腾照用。昇腾仓库只补三件事：接到昇腾平台的入口、昇腾录像带来的额外限制（比如档位要裁剪）、以及回放时让注意力参数保持正确的那套机制。

读这一层前先接受这个分工，否则会在昇腾仓库里找通用的图概念而找不到。

## 旁边还有别的图路径

- **xlite** 是另一条图执行路径，默认关着，要在额外配置里单独打开。它的执行进程和模型运行器只是在昇腾原有的那两个上薄薄包一层，不是另起一套。第一遍读可以跳过，但要知道它存在，否则看到两套运行器会困惑。
- 昇腾还有另外几条图路径（名字见下半「怎么开」），它们不是本页讲的这三档，别混为一谈。

## 常见误解

- **「平台配置里写着关掉编译，说明昇腾只能单算子跑。」**——它关掉的只是上游默认的那条编译路径；昇腾换成了自己的编译后端和自己的图包装，图模式照样有。
- **「图包装自己决定这一步用不用图。」**——它不决定，它无条件照上游给的档位和 key 执行。
- **「录像是第一次请求来时才做的。」**——启动期就按档位全部录好了，这也是启动慢的主要来源之一。

## 对照源码

### 怎么开

- 昇腾不走上游 `torch.compile` 的默认路径：`NPUPlatform` 里 `simple_compile_backend: str = "eager"`，同行注释 `# Disable torch.compile()` [C1]。图模式换成两个接入点 [D]：`get_compile_backend()` 返回 `"vllm_ascend.compilation.compiler_interface.AscendCompiler"`，docstring 说以前默认用 EagerAdaptor、为做图融合才定义了自己的后端 [C2]；`get_static_graph_wrapper_cls()` 返回 `"vllm_ascend.compilation.acl_graph.ACLGraphWrapper"`，docstring 写「Get piecewise backend class for piecewise graph」[C3]。
- 三档加两个组合档对应上游 `CUDAGraphMode`：`NONE = 0`、`PIECEWISE = 1`、`FULL = 2`、`FULL_DECODE_ONLY = (FULL, NONE)`、`FULL_AND_PIECEWISE = (FULL, PIECEWISE)`；类注释说明前三个同时充当运行时分派用的具体模式 [C13]。组合档元组的第一位是 decode 步用的档、第二位是混合批用的档。
- 不配任何东西时，默认优化级 `-O2` 的预设是 `cudagraph_mode = FULL_AND_PIECEWISE`；`vllm serve` 下 `max_num_seqs` 实际默认是 256（`SchedulerConfig` 字段上的 128 只是没有 usage context 时的兜底），于是捕获尺寸表是 `[1, 2, 4] + range(8, 256, 8) + [256]`，共 35 档；A5 走 piecewise 时还会等距采样砍到 4 档（1、72、168、256）。推导与出处都在 [ACL Graph](acl-graph.md)，这里不重复钉行号。
- `ACLGraphWrapper` 类注释的四步 [C5]：① 初始化时指定模式（`FULL` 或 `PIECEWISE`）；② 运行时从 forward context 拿 `runtime_mode` 与 `batch_descriptor`（作 key），原话「blindly trust them」；③ `runtime_mode` 是 `NONE` 或与本包装器不匹配，直接调被包裹的 runnable；④ 匹配时，key 不在就新建缓存项并捕获，在就回放。缓存项结构是 `ACLGraphEntry`（`batch_descriptor`、`aclgraph`、`output`、调试用的 `input_addresses`）[C4]。
- 捕获发生在 `compile_or_warm_up_model` [C6]：先取 `compile_sizes` 作 warmup 列表；`enforce_eager` 为假且 `cudagraph_mode` 不是 `NONE` 时，把已在 `cudagraph_capture_sizes` 里的尺寸从 warmup 列表剔掉；再按 `get_compile_ranges()` 给没有任何尺寸落进去的区间补上区间端点；然后按尺寸从大到小逐个 `_dummy_run`；最后 `enforce_eager` 为假才 `capture_model()`。
- 强制单算子模式就是 `enforce_eager`（命令行 `--enforce-eager`）。注意 里两处 `if not self.model_config.enforce_eager`：为真时尺寸裁剪和末尾的 `capture_model()` 都跳过，但 `compile_sizes` 里的尺寸照样逐个 `_dummy_run`，那个循环在 `if` 外面。
- 官方设计文档划的边界 [S8]（[线上同页](https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/ACL_Graph.html)）：通用图模型（`CUDAGraphMode`、运行时分派、batch descriptor、分桶与 padding、full 与 piecewise 的定义）看上游；这份只讲平台接入点、ACL 图捕获的额外约束、回放期间保证注意力参数正确的机制。实现分工：vLLM 提供通用分派路径，`vllm-ascend` 提供平台包装器、捕获尺寸裁剪、ACL 图回放所需的注意力更新逻辑 [S8]。
- xlite：开关是 `additional_config` 里的 `xlite_graph_config`，对应 `XliteGraphConfig`，`enabled` 与 `full_mode` 默认都是 `False` [C7]。`xlite_worker.py` 与 `xlite_model_runner.py` 是 `NPUWorker`、`NPUModelRunner` 的薄子类 [C10][C11]。
- npugraph_ex、torchair 是另外的图路径，不属于上面 `CUDAGraphMode` 这几档，别混为一谈；npugraph_ex 见 [ACL Graph](acl-graph.md)。

### 开销和什么时候别开

- 启动代价：每个捕获尺寸都要在启动期跑一遍假批录下来；默认 35 档、`FULL_AND_PIECEWISE` 两套 key，piecewise 那套每个 descriptor 还要按 `splitting_ops` 切成多段各录一张（推算见 [ACL Graph](acl-graph.md)）[D]。
- 收益几乎全在 decode：decode 步形状一致、`batch_descriptor` 一致，命中同一缓存项回放[D]；prefill 形状多变，按 token 数分档后大多要补齐或落回非整趟图 [D]。
- 排查时先开 `enforce_eager`：问题消失就锁在图模式这一层[A]。

### 版本差异

两个接入点、包装器那四步、`enforce_eager` 那两处判断在 v0.26 上逐行一致；ACL Graph 自己那一摊的版本差异在 [ACL Graph](acl-graph.md)。这一页范围内只差两处。

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| warmup 跑完到捕获之间 | `_dummy_run` 循环跑完直接 `capture_model()` | 中间多插一步 `kernel_warmup(self)` [C12] | 启动日志里 warmup 之后、捕获之前多出一段耗时，不是卡住 |
| `xlite/` 的大小 | 5 个文件 1227 行，`xlite.py` 747 行、`utils.py` 395 行 | 还是 5 个文件，1220 行，`xlite.py` 722 行、`utils.py` 413 行 [D] | 分量在这两个文件之间挪了一点，两个薄子类和整体结构没变 |

### 源码位置

| 看什么 | 位置 |
|---|---|
| 关掉上游编译、两个接入点 | `vllm_ascend/platform.py`：`simple_compile_backend`、`get_compile_backend`、`get_static_graph_wrapper_cls` |
| 捕获与回放的包装 | `vllm_ascend/compilation/acl_graph.py`：`ACLGraphEntry`、`ACLGraphWrapper` |
| 启动期 warmup 与捕获 | `vllm_ascend/worker/worker.py`：`compile_or_warm_up_model` |
| 几档的定义 | 上游 `vllm/config/compilation.py`：`CUDAGraphMode` |
| xlite 开关与薄子类 | `vllm_ascend/ascend_config.py`：`XliteGraphConfig`；`vllm_ascend/xlite/` |
| 官方设计文档 | `docs/source/developer_guide/Design_Documents/ACL_Graph.md` [S8] |
