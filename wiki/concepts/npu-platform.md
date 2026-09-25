---
id: npu-platform
title: NPUPlatform
type: feature
summary: 昇腾插件里的平台类。vLLM 遇到任何和硬件有关的问题都来问它；它除了回答，还会在启动时改写、拦下你给的配置。
aliases: [NPUPlatform, platform.py, 平台类, 昇腾平台类, PlatformEnum.OOT, check_and_update_config, get_device_total_memory]
chapters: ["10"]
order: 60
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L128-L146
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L176-L182
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L184-L204
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L275-L290
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L312-L333
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L338-L348
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L349-L360
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L361-L449
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L450-L472
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L815-L841
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L880-L896
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L82-L100
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2305-L2332
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L127-L144
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L408-L426
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L336-L344
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L903-L911
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L224-L237
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1400
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L671-L671
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L563-L567
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L27-L30
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L457-L479
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L687-L687
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: ascend-config-system
    kind: builds-on
    note: 启动时改写与最终定稿的，就是那一页解出来的那份配置
  - to: one-request
    kind: builds-on
    note: 那条请求一步能拿多少 token 名额、全注意力层用哪套注意力实现，都是从这个类这里定下来的
  - to: vllm-platform-interface
    kind: builds-on
    note: 上游定好「要问平台哪些问题」，这一页是昇腾对这张问题单的答卷
contradicts: []
updated: "2026-09-25"
origin: seed
---

vLLM 本身不认识昇腾。它把所有「这块硬件是什么、该怎么用」的问题写成一张问题单，由硬件插件交一份答卷；昇腾插件交的答卷就是这个平台类。它答的问题分四类：报身份、改配置、拦配置、指路。中间那两类「改」和「拦」意味着**你在命令行里写的配置，和最后真正生效的配置，可以不是一回事**。

```wiki-diagram
file: platform-surface
```

## 从一个问题开始：一步为什么只收 2048 个 token

拿[全库那个例子](one-request.md)来说：Qwen3.6-35B-A3B 跑在两颗昇腾 NPU 上，用 API 服务的方式起起来。不手动设的话，调度器一步最多只给 2048 个 token 名额。同样的 vLLM 跑在显存 80 GiB 的 H100 上，这个默认值是 8192。

昇腾的卡显存并不小，为什么走了小的那一档？答案就在这个平台类里：

1. vLLM 定这个默认值之前，会先问平台「这块卡总共多少显存」，显存够大（70 GiB 起）就给大档。
2. 昇腾的平台类在这个时刻**答不上来**——它直接报错。
3. vLLM 把这个错吞掉，当成显存是 0，于是落进小档：API 服务 2048，直接在 Python 里用 vLLM 是 8192。

所以不管卡上插了多大的显存，在昇腾上默认都走小档。这次提问只有 37 个 token，离 2048 很远，一步就能全部算完；但请求一多，一步能收的 token 总数就卡在 2048 上。想要更多，得自己在启动时写明。

它为什么不答？不是忘了写。要查显存，就得先把昇腾那套底层运行库拉起来，而这套运行库在一个进程里只许初始化一次；在启动这么早的时候拉起来，后面正式初始化时就会出错。**一个故意不答的问题，改变了调度器的默认行为**——这是「硬件插件」这种做法最典型的一种连带效应。

## 这次提问身上的三个数，都问过它

| 这次提问的哪个数 | 平台类在这里做了什么 |
|---|---|
| 一步最多 2048 个 token 名额 | 上一节说的：显存问题答不上，上游退回小档 |
| 全注意力那 10 层用哪套注意力实现 | 上游来问，平台类查表回答。这个模型的全注意力层是普通的多头注意力（16 个 Q 头、2 个 KV 头），不是压缩过的变体，所以查到的是昇腾最普通的那一套 |
| 一个 KV 块 2048 个位置 | 平台类定块大小时发现这是一个「全注意力 + 线性注意力」的混合模型，就不按通用规则填 128，而是交给它在启动最早那一刻装上的一个补丁去算，算出来是 2048 |

第三行值得多看一眼：块大小表面上是平台类定的，实际上它只说了一句「混合模型我不管」，真正干活的是它自己提前装好的补丁。块大小具体怎么从 128 算到 2048，见 [one-request](one-request.md) 的「对照源码」和 [KV 块是怎么分出来的](vllm-kv-block-allocation.md)。

## 第一类：报身份

最简单的一类。上游问「你叫什么、在 PyTorch 里用哪个名字、哪个环境变量决定能看见哪几颗 NPU、在分布式框架里算哪种资源」，平台类照实回答：设备名叫 npu，PyTorch 里走一个留给外部硬件的专用通道，可见设备由昇腾自己的环境变量控制。

这一类里唯一反直觉的，就是上面那个「显存多大」答不上来。在最新的开发主线上，它改成了「运行库已经起来了就如实回答，还没起来照样报错」——但决定调度默认值的那一刻运行库还没起来，所以三个版本的结果一样：默认都走小档。

## 第二类：启动时改你的配置

这一类是平台类和一张「属性表」最大的区别。

启动最早的时候，平台类会先做三件事：把昇腾的一批全局补丁装上（包括上面那个算块大小的）；在命令行的量化选项里加上「ascend」这个取值——vLLM 原本不认识它，是这里加进去的；再按芯片型号导入对应的[量化](quantization.md)配置。

等整份配置拼好之后，平台类还要再过一遍。开头两步都是「不是我的事就走」：设备类型不是 npu 直接返回，没有模型配置就提醒一句后返回。接着跑一组校验（下一节），然后读出昇腾自己的那份配置（见[昇腾配置体系](ascend-config-system.md)），再按它改写整份配置：换成昇腾的工作进程、定块大小、打开昇腾的自定义算子，等等。

所以排查「我明明配了，怎么没生效」时，**先来这一层看**，别先怀疑配置文件写错了。

## 第三类：先拦下不合法的组合

改写之前，平台类先按固定顺序检查几种配置组合，不合法的当场报错、拒绝启动：

- **按层切分**只许在 [PD 分离](pd-disaggregation.md)的 P 节点上开；
- [投机解码](speculative-decoding.md)和 decode 侧的[上下文并行（CP）](context-parallel.md)怎么搭；
- 几种并行方式能不能同时开，比如数据并行和 prefill 侧上下文并行同时大于 1 就不行；
- PD 分离、流水线并行和 MTP 三者怎么搭。

碰到「这套配置项就是起不来」，报错文本就写在这几个检查里，直接搜报错比翻文档快。要注意这组检查**各版本不一样**：维护分支上有四个，下一个大版本只剩两个，开发主线又换了开头那个——拿一个版本的报错去另一个版本的源码里搜，可能搜不到。细节见下半「版本差异」。

## 第四类：指路

最后一类问题是「具体用哪个实现」：注意力用哪一套、NPU 之间通信用哪个类、编译走哪个后端、[图模式](graph-mode-layer.md)的捕获回放用哪个包装。平台类自己不做这些事，只回答一个类的名字，vLLM 按名字去加载。

这几个回答是从平台层跳进各子系统的入口，顺着它们能走到[注意力实现家族](attention-backend-family.md)和[图模式层](graph-mode-layer.md)。

## 常见误解

- **「平台类只是一张属性表」**——它还会改配置、拦配置。你写的启动配置和实际生效的配置可能不是一回事。
- **「显存多大答不上来是个 bug」**——是故意的，为的是不在启动太早的时候拉起昇腾运行库；开发主线上运行库起来之后已经能答，但决定调度默认值的那一刻仍然答不上。
- **「平台类说关掉 PyTorch 的编译，说明昇腾不支持图模式」**——只说明它不走上游那条默认编译路；昇腾自己那套在「指路」那一类的另外两个回答里。

## 对照源码

### 怎么开

- 不需要开：装上 vllm-ascend 后，vLLM 通过插件机制加载这个类，`_enum = PlatformEnum.OOT`（out-of-tree）[C1]。上游那张问题单见 [vllm-platform-interface](vllm-platform-interface.md)。
- 身份一组都在类体顶部：`device_name` / `device_type` 为 `"npu"`，`ray_device_key = "NPU"`，`device_control_env_var = "ASCEND_RT_VISIBLE_DEVICES"`，`dispatch_key = "PrivateUse1"`，`simple_compile_backend = "eager"`（注释 `# Disable torch.compile()`）。
- 默认 token 预算：上游 `arg_utils.py` 在 `try` 里调 `current_platform.get_device_total_memory()`，异常时 `device_memory = 0`；`>= 70 GiB` 且不是 A100 才走大档（`LLM_CLASS: 16384`、`OPENAI_API_SERVER: 8192`），否则 `LLM_CLASS: 8192`、`OPENAI_API_SERVER: 2048` [C13]。昇腾上 `get_device_total_memory` 在 v0.23 / v0.26 无条件 `raise NotImplementedError`，docstring 写明 `DO NOT IMPLEMENT` 的原因是会提前初始化 `torch_npu` [C4]；main 上改成 `torch.npu.is_initialized()` 为假时抛、为真时返回 `torch.npu.mem_get_info` 的总量 [C18]。要更大预算就显式设 `--max-num-batched-tokens`。
- `pre_register_and_update`：`adapt_patch(is_global_patch=True)`、把 `ASCEND_QUANTIZATION_METHOD` 追加进 `--quantization` 的 `choices`、按 `is_310p()` 导入量化配置类 [C3]。`adapt_patch(is_global_patch=True)` 导入 `vllm_ascend.patch.platform` [C21]，后者在非 310P 上导入 `patch_mamba_config` [C22]——这就是算出 2048 块大小的那个补丁（公式与代入见 [one-request](one-request.md) 的「对照源码」）。机制见 [ascend-patch-system](ascend-patch-system.md)。
- `check_and_update_config`（v0.23 第 450 行起）：`device_type != "npu"` 直接返回，`model_config is None` 时 warning 后返回；`maybe_auto_detect_quantization` 之后按序跑四个 `_validate_*`，再 `_fix_incompatible_config` 和 `init_ascend_config` [C9]。后面在第 671 行调 `refresh_block_size(vllm_config)` [C20]：`block_size is None` 时先填 128，但 `model_config.is_hybrid` 为真就直接返回，交给模型专属的算法 [C19]。
- `update_block_size_for_backend` 在 `mamba_cache_mode == "align"` 时把 `mamba_block_size` 对齐到 `block_size`，并断言前者是后者的整数倍 [C5]。
- 指路一组：`get_attn_backend_cls` 以 `(use_mla, use_sparse, use_compress)` 查 `backend_map`，`(False, False, False)` 得 `vllm_ascend.attention.attention_v1.AscendAttentionBackend`；`FLASH_ATTN` 且通过 `_validate_fa3_backend` 时返回 `AscendFABackend`；310P 走 `backend_map_310` 选 `_310p/` 下的专用后端 [C10]。Qwen3.6-35B-A3B 的全注意力层不是 MLA、不是稀疏，落在 `(False, False, False)` [D]。`get_device_communicator_cls`、`get_compile_backend` [C2]、`get_static_graph_wrapper_cls` [C11] 各返回一个类路径字符串。

### 会报什么错

`check_and_update_config` 开头那组校验（v0.23 顺序）：

| 校验 | 拦的是什么 |
|---|---|
| `_validate_layer_sharding_config` | `layer_sharding` 只许在 PD 分离的 P 节点开；`kv_role` 不是 `kv_producer` 就抛 `ValueError` [C6] |
| `_validate_draft_decode_context_parallel_config` | 投机解码与 decode 侧上下文并行（DCP）的组合 [C8] |
| `_validate_parallel_config` | 并行组合，例如 `data_parallel_size > 1` 同时 `prefill_context_parallel_size > 1` 就抛错 |
| `_validate_pd_pp_mtp_config` | PD 分离、PP 与 MTP 三者的组合 |

- 另有 `_validate_kv_load_failure_policy`，不在开头那组、排在 `init_ascend_config` 之后（v0.23 [C24]、v0.26 [C17]）：配了 `kv_transfer_config` 且 `kv_load_failure_policy=recompute` 时，混合模型断言失败，报 `Hybrid models do not support recompute mode kv load failure policy now.`。Qwen3.6-35B-A3B 就是混合模型，做 PD 分离时这个策略不能选 recompute [D]。
- 默认预算那条路上的 `NotImplementedError` 不会冒出来——被上游 `except Exception` 吞掉。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 |
|---|---|---|---|
| 开头的校验 | 4 个：layer sharding → draft DCP → 并行 → PD+PP+MTP | 2 个：draft DCP → 并行 [C15] | `_validate_indexer_pp_config` → draft DCP → 并行，后两个改成模块级函数 [C23] |
| `layer_sharding` 这个键 | 有，只许在 P 节点开 | `vllm_ascend/` 下 grep 不到 [D]；配了不报错，只是不认识的键 | 未核 |
| `_validate_parallel_config` | DP>1 且 PCP>1 同时开才抛 | 只要没开 v2 model runner，PCP>1 就抛 | 未核 |
| `_validate_kv_load_failure_policy` | 有，第 687 行，排在 `init_ascend_config` 之后 | 有，同样在 `init_ascend_config` 之后（第 650 行） | 未核 |
| `get_device_total_memory` | 无条件抛 | 无条件抛 | 初始化后返回真实显存，之前照抛 |
| `class NPUPlatform` 起始行 | 128 | 127 [C14] | 82 [C12] |

[!] 拿 v0.23 的报错去 v0.26 源码里搜函数名会搜不到——那两个校验连同它们拦的组合一起没了。行号在三个分支上各不相同（v0.26 差 1 行、main 差 46 行 [D]），所以本库所有来源都写成 `repo@commit:path#L起-L止`。

### 源码位置

| 看什么 | 去哪里 |
|---|---|
| 类本体、身份、四组方法 | `vllm_ascend/platform.py`，`class NPUPlatform` |
| 通用块大小规则、混合模型为何跳过 | `vllm_ascend/utils.py`，`refresh_block_size` |
| 全局补丁入口 | `vllm_ascend/utils.py`，`adapt_patch`；`vllm_ascend/patch/platform/__init__.py` |
| 混合模型块大小 | `vllm_ascend/patch/platform/patch_mamba_config.py` |
| 默认 token 预算 | 上游 `vllm/engine/arg_utils.py`，`get_batch_defaults` 一带 |
