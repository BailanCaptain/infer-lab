---
id: acl-graph
title: "ACLGraph：批的 token 数先垫到捕获过的尺寸，垫不上就按 eager 跑"
type: feature
summary: 启动期把整网的算子下发序列按一批固定尺寸录成图，运行期按「token 数 + 这批是不是整齐的 decode」查缓存回放，省掉每个算子一次的 host 下发开销。
aliases: [ACLGraph, ACL 图, cudagraph_mode, cudagraph_capture_sizes, FULL_DECODE_ONLY, FULL_AND_PIECEWISE, npugraph_ex, 图捕获与回放]
chapters: ["16"]
order: 40
sources:
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/graph_mode.md#L26-L29
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/graph_mode.md#L40-L45
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/graph_mode.md#L126-L132
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/graph_mode.md#L111-L120
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/graph_mode.md#L14-L20
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/graph_mode.md#L268-L272
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/graph_mode.md#L178-L184
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/graph_mode.html
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/ACL_Graph.md#L57-L63
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/ACL_Graph.md#L78-L96
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L207-L241
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L248-L261
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L74-L76
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L109-L126
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L549-L568
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L570-L587
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L593-L633
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L645-L657
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L607-L615
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L640-L659
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L138-L152
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L243-L257
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L666-L671
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2949-L2961
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2809-L2832
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2856-L2870
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L918-L924
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L491-L518
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L263-L271
  - vllm@0fc695fc:vllm/config/vllm.py#L1667-L1682
  - vllm@0fc695fc:vllm/config/vllm.py#L1702-L1729
  - vllm@0fc695fc:vllm/config/vllm.py#L243-L257
  - vllm@0fc695fc:vllm/config/vllm.py#L364-L366
  - vllm@0fc695fc:vllm/config/scheduler.py#L42-L44
  - vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L86-L95
  - vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L276-L285
  - vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L306-L328
  - vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L209-L235
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L599-L606
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L634-L635
  - vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L37-L47
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L113-L133
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L1153-L1167
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L1205-L1207
  - vllm-ascend@b255ab59:vllm_ascend/compilation/breakable_aclgraph.py#L38-L45
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L527-L531
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: graph-mode-layer
    kind: builds-on
    note: ACLGraphWrapper 的四步、两个平台接入点、enforce_eager 只跳捕获不跳 warmup 都在那一页，这里只讲用法和行为
  - to: one-request
    kind: builds-on
    note: 第 1 步 37 个 token 被垫到 40、后面 199 步各 1 个 token，这一页所有的数都从这条请求推出来
  - to: npu-model-runner
    kind: builds-on
    note: 选模式、垫 token 数、full 图的注意力参数更新，三件事都发生在 runner 的一次 forward 里
  - to: async-scheduling
    kind: builds-on
    note: FULL 回放前那次 current_stream().synchronize() 就是为异步调度加的，否则第 i 步的参数更新会被第 i−1 步的回放吃掉
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

ACLGraph 把「整网的算子下发序列」在启动期录成图，运行期一次 `replay()` 放完——**省掉的是每个算子一次的 host 侧下发开销，一次计算都没省**。所以收益几乎全在 decode：那里一步只算 1 个 token，算子多、算得少、host 下发占比最高。

三个在册版本上都有 `vllm_ascend/compilation/acl_graph.py`；官方文档把 ACLGraph 记在 v0.9.0rc1 起、把配套的编译期优化 Npugraph_ex 记在 v0.15.0rc1 起 [S1]（[线上同页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/graph_mode.html)）。主干行为三版一致，差异集中在两个配置键和一处门禁函数改名。先破一个旧说法：讲昇腾图模式的旧文几乎都提 `update_aclgraph_sizes()`，这个函数在三个在册版本上都 grep 不到——设计文档写明这个本地启发式已被移除，现在保留上游的尺寸与分派逻辑，只在捕获失败时重写报错 [S9]。

```wiki-diagram
file: acl-graph
```

## 那条请求走到这里

[那条请求](one-request.md)什么都没配，于是三件事被默认决定：优化级是默认的 `-O2`，它的预设里 `cudagraph_mode = FULL_AND_PIECEWISE` [C32]，`max_num_seqs` 用上游默认的 128。昇腾的注意力后端把图支持等级声明成 `ALWAYS`，这个模式才在配置检查里原样保留下来 [D]。捕获尺寸就此算出来：

```
昇腾注入的上限 = min(max_num_seqs × decode_query_len, 512) = min(128 × 1, 512) = 128   [C11]
再与 max_num_batched_tokens（默认 2048）取小                                  → 128
尺寸表 = [1, 2, 4] + range(8, 129, 8) = 1 2 4 8 16 24 … 112 120 128           → 19 档  [C31]
```

200 步分成两类，分水岭是「这一批是不是整齐的 decode」：

| 这一步 | 批里 token 数 | `uniform_decode` | 垫到 | 落到哪套图 |
|---|---|---|---|---|
| 第 1 步 prefill | 37 | 假 | **40** | PIECEWISE |
| 第 2 到第 200 步 | 1 | 真 | 1（本来就是一档） | **FULL** |

**37 为什么变成 40**：37 不在表里，向上取到 ≥ 37 的第一档 [C35]，白算 3 个位置。**为什么落不到 FULL**：FULL 的 key 只为整齐 decode 建，带着精确的 `num_reqs` 和 `uniform=True`，prefill 这一批不满足，才退到放宽了这两项的 PIECEWISE key。**decode 那 199 步的 key 一模一样**（`num_tokens=1`、`num_reqs=1`、`uniform=True`），回放同一张图，一个 padding token 都不用 [D]。

启动代价同样能算：19 档 × 两套 key = 38 个 batch_descriptor 要在启动期各跑一遍假批录下来，piecewise 那一套每个 descriptor 还要按 `splitting_ops` 切成多段各录一张 [D]。开图模式启动慢，钱花在这里。

## 上限是 `max_num_seqs`，不是 CUDA 那边的两倍

结论先说：**同样的 `max_num_seqs`，昇腾默认捕获的最大尺寸只有 CUDA 的一半。**

上游 `_set_cudagraph_sizes()` 的默认上限是 `min(max_num_seqs × decode_query_len × 2, 512)` [C30]；昇腾在 `apply_config_platform_defaults()` 里抢先把 `max_cudagraph_capture_size` 填好，docstring 明说「与上游唯一有意为之的差别就是去掉那个 CUDA 取向的 ×2」[C12]。填过之后上游那段 `if max_cudagraph_capture_size is None` 不再进，尺寸表生成、token 上限截断、SP 过滤全照上游走。

上限之外还有两道昇腾自己的剪刀：

- **SP 对齐**：TP > 1 且开了 sequence parallel 时，不是 `tp_size` 倍数的尺寸被筛掉，`max_cudagraph_capture_size` 跟着改成筛完的最大值。
- **A5 只留 4 档**：`AscendDeviceType.A5` 且走 piecewise 编译时，`prune_capture_sizes_for_950()` 在原表上等距采样，硬砍到 `MAX_CAPTURE_SIZES_FOR_950 = 4` 档（首尾必留），只打一条 warning [C14]。代到上面那 19 档：`step = (19−1)/(4−1) = 6`，取下标 0、6、12、18，也就是 **1、40、88、128** [D]。

要自己定就直接给列表，两个键都是上游的：

```bash
vllm serve Qwen/Qwen3-0.6B \
  --compilation-config '{"cudagraph_mode": "FULL_DECODE_ONLY", "cudagraph_capture_sizes": [1, 8, 16, 32]}'
```

`FULL_DECODE_ONLY` 的意思是「只给整齐 decode 录全图，混合批一律走 eager」，它和 `FULL` 是仅有的两个会打开 Npugraph_ex 那层编译期优化的模式。那条请求这么配，prefill 那步不再垫到 40，199 步 decode 照样回放，代价是 prefill 彻底不吃图。手写了 `cudagraph_capture_sizes` 之后昇腾那个默认上限就不注入了，上游只做去重、排序、按 `max_num_batched_tokens` 截断。

## 一步 forward 怎么落到图上：先看大小，再垫，最后查 key

三段判断全在上游的 `CudagraphDispatcher.dispatch()` 里，昇腾不插手：

1. **先看大小。** `num_tokens > max_cudagraph_capture_size` 直接返回 `NONE`，这一步整步按 eager 跑 [C36]。**没有 warning，也不报错**——「我明明开了图模式怎么没加速」多半就是这里。
2. **垫。** 正好等于某一档就用那一档，否则向上取到下一档，垫出来的位置算白工。
3. **查 key。** 先查 FULL，再查放宽了 `num_reqs` 与 `uniform` 的 PIECEWISE，两套都没有才返回 `NONE`。

`uniform_decode` 由昇腾侧的 `_determine_batch_execution_and_padding()` 判定：这一批每个请求都只排了 `uniform_decode_query_len`（无投机解码时是 1）个 token，且总 token 数正好等于请求数乘它。**混进一条 prefill，整批就不 uniform 了**，这一步只能吃 piecewise——这是连续批处理和 full 图之间真实存在的张力。

结果经 forward context 交给 `ACLGraphWrapper`，它自己不再判断，那一层的结构见[图模式层](graph-mode-layer.md)。

## full 图不是录完就不管：注意力参数在回放途中被改掉

FULL 模式下有一样东西录不进图：`seq_lens` 每步都变，而 workspace 和算子 task 已经固化。昇腾的办法是**捕获时就往图里埋一个等待点**——先记下 `torch.npu.ExternalEvent()` 的 `wait(stream)` 与 `reset(stream)`，再录注意力算子。回放走到那里会停住等这个 event。

放行的是 `update_graph_params()`：它在一条单独的 update stream 上，拿 forward context 里**当前这一步**的 `seq_lens` 重算 workspace，用 `graph_task_update_begin/end` 把算子 task 的入参换掉，最后 `event.record(update_stream)` [C28]。

所以调用顺序反直觉：`_model_forward()` 里是**先 `run_model()` 把回放 launch 出去、后调 `_update_full_graph_params_if_needed()`** [C26]——只有 `enable_enpu` 的软切分场景反过来，先 update 再 run，同一段源码的注释说那里要先 record 后 wait。设计文档写的是「Before replay, `update_full_graph_params()` calls the backend specific `update_graph_params()`」[S10]——按 Python 调用顺序这句不成立 [!]；成立的说法是「在图里那个注意力算子真正执行之前」。

也正因为如此，FULL 回放前要多做一次 `torch.npu.current_stream().synchronize()`（仅 `runtime_mode == FULL` 且不是 eagle 合图路径）：异步或多线程下，第 i 步的 CPU 侧 record 可能跑在第 i−1 步回放完成之前。那条请求默认就开着[异步调度](async-scheduling.md)，这一刀对它实打实要走。

## 开关只有三个，昇腾自己的那个只管编译期

| 想做的事 | 怎么写 | 落到哪 |
|---|---|---|
| 整个关掉 | `--enforce-eager` | `_use_aclgraph()` 为假，捕获和回放都不发生 |
| 换模式 / 换尺寸 | `--compilation-config '{"cudagraph_mode": "...", "cudagraph_capture_sizes": [...]}'` | 上游字段，昇腾只在配置检查里按平台收窄 |
| 控编译期优化 | `--additional-config '{"ascend_compilation_config": {"enable_npugraph_ex": false}}'` | 昇腾自己的 `AscendCompilationConfig` |

`enable_npugraph_ex` 默认 `True`，但**只在 FULL / FULL_DECODE_ONLY 下真生效**：`cudagraph_mode` 为 `NONE` 或需要 piecewise 编译时，平台层把它连同 `enable_static_kernel` 一起写回 `False` [C17]。那条请求跑默认的 `FULL_AND_PIECEWISE`，`requires_piecewise_compilation()` 为真，所以 npugraph_ex 在它身上根本没开 [D]。`enable_static_kernel` 默认 `False`，开了要在启动捕获阶段多花几分钟到几十分钟编译定形算子，而且断言要求 npugraph_ex 同开。

会真踩到的硬约束：

- `ASCEND_LAUNCH_BLOCKING=1` 与图模式**互斥且不降级**，是启动时 `raise ValueError` [C18]。调试时顺手 export 过这个变量的人第一个撞上。
- encoder-decoder 模型被强制收到 `PIECEWISE`，编译模式不是 `VLLM_COMPILE` 就收到 `NONE`；context parallel 下 `cudagraph_mode="FULL"` 官方自述「支持得还不够」；310P 与 Atlas 200I Pro 不支持 `enable_npugraph_ex`。
- 捕获报 `207008` 或 `Stream resources are insufficient` 时，vllm-ascend 把它重抛成带处置建议的错误；piecewise 最容易撞上，因为它录的图最多 [S4]。

## 三个版本的差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| `enable_super_kernel` | 没有这个键 | 有，不写就跟随 `enable_static_kernel` [C40] | 有，字段默认 `False`，但只写 `enable_static_kernel` 时仍跟随它 [C42] | [!] 在 v0.23 上照 v0.26 文档写这个键，会掉进 `**kwargs` 被静默忽略 |
| A5 砍 4 档的门禁 | `get_ascend_device_type() == AscendDeviceType.A5` | 同左 | 改判 `HardwareCapability.REDUCED_CUDAGRAPH_CAPTURE_SIZES` [C44] | 行为一样（都是 4 档），但按旧名字在 main 上 grep 不到 |
| 捕获尺寸要对齐 TP 的触发条件 | 只有 `enable_sp` | 同左 | 还包括 shared-expert DP 与 DSA CP [C43] | [!] main 上更多配置会改写你手写的 `cudagraph_capture_sizes` |
| 可打断的图包装器 | 无 | 无 | 多一个 `BreakableACLGraphWrapper` [C45] | main 上图模式多出一条路径 |

## 常见误解

- **「开了图模式，每一步都在回放图。」**——那条请求的第 1 步就不是：37 个 token 的 prefill 先被垫到 40，再落到 piecewise。token 数超过最大捕获尺寸时更干脆，`dispatch()` 返回 `NONE`，整步 eager，不报错也不警告。
- **「`cudagraph_capture_sizes` 写什么就捕获什么。」**——SP 对齐会筛掉不是 `tp_size` 倍数的档，A5 会等距采样砍到 4 档，超过 `max_num_batched_tokens` 的还会被截断，三道都不问你。
- **「`--enforce-eager` 只是少录几张图，别的不变。」**——它同时把编译模式打到 `CompilationMode.NONE`，`splitting_ops` 还没定的话一并置空 [C46]；它是排查图模式问题的那一刀，不是性能旋钮。
