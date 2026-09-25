---
id: acl-graph
title: "ACL Graph：批的 token 数先垫到捕获过的档位，垫不上就整步退回单算子模式"
type: feature
summary: 启动的时候把整网的算子下发顺序按一批固定尺寸各录一遍，之后每一步按 token 数和「这批是不是整齐的 decode」查录过的图直接回放，省掉的是每个算子喊一次的下发时间，一次计算都没省。
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
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L113-L133
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1162-L1176
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1214-L1216
  - vllm-ascend@baa023ad:vllm_ascend/compilation/breakable_aclgraph.py#L38-L45
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L527-L531
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2326-L2335
  - vllm-ascend@2c59ff10:vllm_ascend/ops/gdn_attn_builder.py#L223-L224
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L5040-L5068
  - vllm@0fc695fc:vllm/config/compilation.py#L1339-L1369
  - vllm@0fc695fc:vllm/config/compilation.py#L1453-L1468
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/gdn_attn_builder.py#L226
  - vllm-ascend@baa023ad:vllm_ascend/ops/gdn_attn_builder.py#L317-L318
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
updated: "2026-09-25"
origin: seed
---

## 录好的图是死的，来的批是活的

[那条请求](one-request.md)开着图模式——默认就开着，不用配。可是启动时录好的每张图，批的形状都是定死的：录的时候放进去几个 token，回放时就只认几个 token。而真跑起来的批每步都不一样——第 1 步一批 37 个 token，后面 199 步每步 1 个。**形状对不上，录好的图怎么用得上？**

ACL Graph（昇腾上实现图模式的那套机制）的答案分三步：先备一把只有 35 档的尺，来的批向上垫到最近的一档；再按「这批是不是整齐的 decode」分进两套图；两样都对不上，整步退回单算子模式。至于图模式到底省什么，[图模式层](graph-mode-layer.md)已经讲过：一声回放省掉的是每个算子喊一次的 host 下发时间，**一次计算都没省**，所以收益几乎全落在算得少、算子一个不少的 decode 上。

## 一把 35 档的尺，来的批先垫

录一张图要花启动时间和显存，不可能什么尺寸都录，只能挑一批固定尺寸预先录好。那条请求什么都没配，这批尺寸就按默认算出来：服务最多同时跑 256 条请求，decode 每条每步 1 个 token，所以最大档是 256；档位从 1、2、4、8 起步，之后每隔 8 一档，一共 **35 档**。

```wiki-diagram
file: acl-graph
```

200 步在这把尺上只发生两件事：

| 这一步 | 批里 token 数 | 是整齐的 decode 吗 | 垫到 | 吃哪套图 |
|---|---|---|---|---|
| 第 1 步 prefill | 37 | 不是：批里是还没算完的 prompt | **40** | 按段的图 |
| 第 2 到第 200 步 | 1 | 是 | 不用垫 | 整趟的图，199 步同一张 |

37 不在档上，向上取到 40，白算 3 个位置——垫出来的位置算完就扔。1 正好是最小档，而且 199 步的批长得一模一样，回放的是同一张图，一个 token 都不用垫。

还有一条不显眼的规则：批的 token 数超过最大档（这里是 256）时，这一步**整步退回单算子模式，不报错也不打招呼**。「我明明开了图模式怎么没加速」，多半栽在这里。

## 两套图：整趟的挑剔，按段的宽容

为什么第 1 步吃不上整趟的图？因为两套图认批的方式不一样：

- **整趟回放的图**挑剔：只给「整齐的 decode」录——批里每条请求都恰好只算 1 个 token（不带投机解码时；带投机是每条 1+k 个）。查图的时候连「批里有几条请求」都要对得上。
- **按段回放的图**宽容：整网按注意力算子切成几段，每段一张图，注意力本身在段与段之间现算。查图只看垫完的 token 总数，不管批里混了什么。

第 1 步批里是 37 个还没算完的 prompt token，不是整齐的 decode，整趟的图查不到，落到按段的图。混合批只要混进一条 prefill，整批就不整齐了——这是连续批处理和整趟图之间真实存在的张力。

这个模型还有一层身份要交代：40 层里 30 层是[线性注意力](linear-attention.md)，只有 10 层是全注意力。昇腾给线性注意力那套算子声明的图支持等级是「只支持整齐批」，全注意力是「什么批都支持」，整台模型按最低的那档算。默认组合——decode 走整趟、其余走按段——正好没超出「只支持整齐批」的范围，配置检查原样放行；要是手动要求「混合批也走整趟」，启动时会被改回默认组合，只打一条警告。**所以混合模型的 decode 照样整图捕获，被挡的只是混合批那半。**

启动的账也能算：35 档 × 两套 = 70 份形状要在启动期各跑一遍假批录下来，按段那套每份还要切成几段各录一张。开图模式启动慢，钱花在这里。

## 整趟的图回放到一半，会被 host 改参数

整趟的图里有一样东西录不进去：注意力算子得知道「每条请求到现在攒了多少 token」，这个数每步都在涨，而图里的算子参数录的那一刻就固化了。

昇腾的办法是**录图时就在注意力算子前面埋一个等待点**。回放跑到那里会停住；host 在旁边一条单独的流上，拿这一步的真实长度重算工作区、把算子参数换掉，然后放行，图接着往下放。所以调用顺序反直觉：先把整张图的回放发出去、再去做参数更新——反正图会停在等待点等它。

开着[异步调度](async-scheduling.md)时（那条请求默认就开着），整趟回放前还要多做一次同步：不然第 i 步的参数更新可能抢在第 i−1 步的图还没放完时就落下去，被上一步的回放吃掉。

## 常见误解

- **「开了图模式，每步都在回放图。」**——那条请求的第 1 步就不是：37 个 token 先垫到 40，走的是按段的图；token 数超过最大档时更干脆，整步退回单算子模式，不报错也不警告。
- **「捕获尺寸写什么就录什么。」**——序列并行要求档位对齐会筛掉一批，A5 硬件会等距砍到只剩 4 档，超过一步 token 上限的会被截掉，三道剪刀都不问你。
- **「彻底关掉图模式的那个开关，只是少录几张图。」**——它同时把编译模式一起关掉；它是排查图模式问题的那一刀，不是性能旋钮。

## 对照源码

### 怎么开

默认就开着。那条请求什么都没配，三件事被默认决定：优化级是默认的 `-O2`，它的预设里 `cudagraph_mode = FULL_AND_PIECEWISE` [C32]；`max_num_seqs` 由 `EngineArgs` 按 usage context 定——昇腾在这一步拿不到显存数、走小档，`vllm serve` 下是 **256** [C47]（`SchedulerConfig` 字段上那个 128 只是没有 usage context 时的兜底值，实际启动用不到）；捕获尺寸就此算出来：

```
昇腾注入的上限 = min(max_num_seqs × decode_query_len, 512) = min(256 × 1, 512) = 256   [C11]
再与 max_num_batched_tokens（默认 2048）取小                                  → 256
尺寸表 = [1, 2, 4] + range(8, 256, 8) + [256] = 1 2 4 8 16 … 240 248 256      → 35 档  [C31]
```

上游 `_set_cudagraph_sizes()` 的默认上限是 `min(max_num_seqs × decode_query_len × 2, 512)` [C30]；昇腾在 `apply_config_platform_defaults()` 里抢先把 `max_cudagraph_capture_size` 填好，docstring 明说「与上游唯一有意为之的差别就是去掉那个 CUDA 取向的 ×2」[C12]。所以同样的 `max_num_seqs`，在 512 封顶之前昇腾默认捕获的最大尺寸只有 CUDA 的一半；到了 512 及以上两边同被截断，一样大。填过之后上游那段 `if max_cudagraph_capture_size is None` 不再进，尺寸表生成、token 上限截断、SP 过滤全照上游走。

开关只有三个，昇腾自己的那个只管编译期：

| 想做的事 | 怎么写 | 落到哪 |
|---|---|---|
| 整个关掉 | `--enforce-eager` | `_use_aclgraph()` 为假，捕获和回放都不发生 |
| 换模式 / 换尺寸 | `--compilation-config '{"cudagraph_mode": "...", "cudagraph_capture_sizes": [...]}'` | 上游字段，昇腾只在配置检查里按平台收窄 |
| 控编译期优化 | `--additional-config '{"ascend_compilation_config": {"enable_npugraph_ex": false}}'` | 昇腾自己的 `AscendCompilationConfig` |

要自己定尺寸就直接给列表，两个键都是上游的：

```bash
vllm serve Qwen/Qwen3.6-35B-A3B \
  --compilation-config '{"cudagraph_mode": "FULL_DECODE_ONLY", "cudagraph_capture_sizes": [1, 8, 16, 32]}'
```

`FULL_DECODE_ONLY` 的意思是「只给整齐 decode 录全图，混合批一律走 eager」，它和 `FULL` 是仅有的两个会打开 Npugraph_ex 那层编译期优化的模式。那条请求这么配，prefill 那步不再垫到 40，199 步 decode 照样回放，代价是 prefill 彻底不吃图。手写了 `cudagraph_capture_sizes` 之后昇腾那个默认上限就不注入了，上游只做去重、排序、按 `max_num_batched_tokens` 截断。

手写的尺寸之外还有两道昇腾自己的剪刀：

- **SP 对齐**：TP > 1 且开了 sequence parallel 时，不是 `tp_size` 倍数的尺寸被筛掉，`max_cudagraph_capture_size` 跟着改成筛完的最大值。
- **A5 只留 4 档**：`AscendDeviceType.A5` 且走 piecewise 编译时，`prune_capture_sizes_for_950()` 在原表上等距采样，硬砍到 `MAX_CAPTURE_SIZES_FOR_950 = 4` 档（首尾必留），只打一条 warning [C14]。代到上面那 35 档：`step = (35−1)/(4−1) ≈ 11.3`，四舍五入取下标 0、11、23、34，也就是 **1、72、168、256** [D]。

上半说的「整台模型按最低支持等级算」对应的是注意力后端的声明：GQA 后端声明 `AttentionCGSupport.ALWAYS` [C29]；Qwen3.6-35B-A3B 的 30 层线性注意力（`config.json` 里 `full_attention_interval = 4` [S52]）走 `AscendGDNAttentionMetadataBuilder`，声明 `UNIFORM_BATCH` [C48]（MLA / SFA / DSA 三个后端声明的也是 `UNIFORM_BATCH`）。runner 的 `_check_and_update_cudagraph_mode()` 扫过所有 kv cache 组的后端取最低 [C49]，交给上游 `resolve_cudagraph_mode_and_sizes()`：要求混合批全图（`cudagraph_mode=FULL`）而最低等级不是 `ALWAYS` 时，降到 `FULL_AND_PIECEWISE`（`splitting_ops` 含注意力时）或 `FULL_DECODE_ONLY`，打一条 warning；默认的 `FULL_AND_PIECEWISE` 在 `UNIFORM_BATCH` 下哪个检查都不触发，原样保留 [C50]。

`enable_npugraph_ex` 默认 `True`，但**只在 FULL / FULL_DECODE_ONLY 下真生效**：`cudagraph_mode` 为 `NONE` 或需要 piecewise 编译时，平台层把它连同 `enable_static_kernel` 一起写回 `False`。那条请求跑默认的 `FULL_AND_PIECEWISE`，`requires_piecewise_compilation()` 为真，所以 npugraph_ex 在它身上根本没开 [D]。

### 会报什么错

- 两个发布分支上 `ASCEND_LAUNCH_BLOCKING=1` 与图模式**互斥且不降级**，是启动时 `raise ValueError` [C18]。调试时顺手 export 过这个变量的人第一个撞上；main 上这道闸已经拆了，见版本差异。
- 混合模型（带线性注意力 / mamba 层）开 full 图时，上游检查 `max_num_seqs` 不得超过 mamba 缓存的块数——每条 decode 序列要占一块；超了就启动 `raise ValueError`，提示调小 `max_num_seqs` 或调大 `gpu_memory_utilization` [C51]。
- 捕获报 `207008` 或 `Stream resources are insufficient` 时，vllm-ascend 把它重抛成带处置建议的错误；piecewise 最容易撞上，因为它录的图最多。
- encoder-decoder 模型被强制收到 `PIECEWISE`，编译模式不是 `VLLM_COMPILE` 就收到 `NONE`；context parallel 下 `cudagraph_mode="FULL"` 官方自述「支持得还不够」；310P 与 Atlas 200I Pro 不支持 `enable_npugraph_ex`。
- 最隐蔽的一种恰恰不报错：`dispatch()` 里 `num_tokens > max_cudagraph_capture_size` 直接返回 `NONE`，整步 eager，没有 warning [C36]。

### 开销和什么时候别开

- **启动期**：35 档 × 两套 key = 70 个 batch_descriptor 要各跑一遍假批录下来，piecewise 那一套每个 descriptor 还要按 `splitting_ops` 切成多段各录一张 [D]。`enable_static_kernel`（默认 `False`）再加几分钟到几十分钟的定形算子编译，且断言要求 npugraph_ex 同开。
- **运行期**：垫位是白工（37 → 40 白算 3 个位置）；FULL 回放前多一次 `torch.npu.current_stream().synchronize()`——条件是 `runtime_mode == FULL` 且不是 eagle 合图路径，`enable_enpu` 的软切分场景由 runner 自己排序、这里跳过 [C22]。这一刀是给[异步调度](async-scheduling.md)加的：异步或多线程下，第 i 步的 CPU 侧 record 可能跑在第 i−1 步回放完成之前。
- **什么时候别开**：排查图模式问题用 `--enforce-eager` 一刀关干净——它同时把编译模式打到 `CompilationMode.NONE`，`splitting_ops` 还没定的话一并置空 [C46]；它是排查刀，不是性能旋钮。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| `enable_super_kernel` | 没有这个键 | 有，不写就跟随 `enable_static_kernel` [C40] | 有，字段默认 `False`，但只写 `enable_static_kernel` 时仍跟随它 [C42] | [!] 在 v0.23 上照 v0.26 文档写这个键，会掉进 `**kwargs` 被静默忽略 |
| A5 砍 4 档的门禁 | `get_ascend_device_type() == AscendDeviceType.A5` | 同左 | 改判 `HardwareCapability.REDUCED_CUDAGRAPH_CAPTURE_SIZES` | 行为一样（都是 4 档），但按旧名字在 main 上 grep 不到 |
| 捕获尺寸要对齐 TP 的触发条件 | 只有 `enable_sp` | 同左 | 还包括 shared-expert DP 与 DSA CP | [!] main 上更多配置会改写你手写的 `cudagraph_capture_sizes` |
| 可打断的图包装器 | 无 | 无 | 多一个 `BreakableACLGraphWrapper` [C45] | main 上图模式多出一条路径 |
| `ASCEND_LAUNCH_BLOCKING=1` 撞上图模式 | 启动 `raise ValueError` | 同左 | 检查已删，`vllm_ascend/` 里 grep 不到这个变量 | [!] 同一条命令在两个发布分支上起不来、在 main 上照常开图 |
| GDN（线性注意力）后端的图支持等级 | `UNIFORM_BATCH` | 同左 | 同左 | 混合模型「decode 整图、混合批按段」的行为三版一致 |

三个在册版本上都有 `vllm_ascend/compilation/acl_graph.py`；官方文档把 ACLGraph 记在 v0.9.0rc1 起、把配套的编译期优化 Npugraph_ex 记在 v0.15.0rc1 起 [S1]（[线上同页](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/graph_mode.html)）。另外破一个旧说法：讲昇腾图模式的旧文几乎都提 `update_aclgraph_sizes()`，这个函数在三个在册版本上都 grep 不到——设计文档写明这个本地启发式已被移除，现在保留上游的尺寸与分派逻辑，只在捕获失败时重写报错 [S9]。

### 源码位置

- 上限注入与平台收窄：`vllm_ascend/platform.py` 的 `apply_config_platform_defaults()`，A5 采样 `prune_capture_sizes_for_950()`。
- 尺寸表生成：上游 `vllm/config/vllm.py` 的 `_set_cudagraph_sizes()` 与 `cudagraph_capture_sizes` 校验。
- 一步 forward 落图的三段判断都在上游 `CudagraphDispatcher.dispatch()`，昇腾不插手：超上限返回 `NONE`、向上取档、先查 FULL 的精确 key 再查放宽了 `num_reqs` 与 `uniform` 的 PIECEWISE key。
- `uniform_decode` 由昇腾侧 `_determine_batch_execution_and_padding()` 判定：每条请求都只排了 `uniform_decode_query_len`（无投机解码时是 1）个 token，且总 token 数正好等于请求数乘它。
- 后端支持等级取最低：`vllm_ascend/worker/model_runner_v1.py` 的 `_check_and_update_cudagraph_mode()`；降级链条在上游 `vllm/config/compilation.py` 的 `resolve_cudagraph_mode_and_sizes()`；GDN 后端的声明在 `vllm_ascend/ops/gdn_attn_builder.py`。
- 回放与等待点：`vllm_ascend/compilation/acl_graph.py` 的 `ACLGraphWrapper`，回放前的 synchronize；注意力参数更新 `update_graph_params()` 用 `torch.npu.ExternalEvent()` 的 wait / record 与 `graph_task_update_begin/end` 换算子入参，在 `vllm_ascend/attention/attention_v1.py`[C28]。
- 调用顺序：`_model_forward()` 里**先 `run_model()` 把回放 launch 出去、后调 `_update_full_graph_params_if_needed()`**——只有 `enable_enpu` 的软切分场景反过来，先 update 再 run，同一段源码的注释说那里要先 record 后 wait。设计文档写的是「Before replay, `update_full_graph_params()` calls the backend specific `update_graph_params()`」[S10]——按 Python 调用顺序这句不成立 [!]；成立的说法是「在图里那个注意力算子真正执行之前」。
- 包装层的四步、两个平台接入点、`enforce_eager` 只跳捕获不跳 warmup：见[图模式层](graph-mode-layer.md)。
