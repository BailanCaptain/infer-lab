---
id: npu-worker-lifecycle
title: NPUWorker 启动时序
type: feature
summary: 从建对象到能接请求，六步固定顺序：打 patch、选卡建 runner、装权重、profile 出显存预算、分配 KV 张量、编译与捕获图。
aliases: [NPUWorker, worker 启动, init_device, compile_or_warm_up_model, 启动时序]
chapters: ["10"]
order: 110
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L89-L92
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L101-L130
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L505-L523
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L527-L553
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L558-L595
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L681-L704
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L706-L732
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L907-L918
  - vllm-ascend@2c59ff10:vllm_ascend/patch/worker/__init__.py#L40-L41
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L772-L778
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/worker/__init__.py#L27-L33
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 第四步那次 profile 到底怎么算出可用字节数，公式和扣减项在那一页
  - to: kv-cache-spec
    kind: builds-on
    note: 第五步按 KVCacheConfig 分配张量，每层每块的形状由 spec 决定
  - to: one-request
    kind: builds-on
    note: 那条请求能不能在第 92 步要到第二块，取决于启动第四步算出的那个预算
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

`NPUWorker` 继承上游 `WorkerBase` [C1]，一张卡一个。它从建对象到能接请求要走六步，顺序是固定的，而且**第四步之前显存预算还不存在**——这条约束解释了为什么 KV Cache 的大小不可能更早定下来 [D]。

```wiki-diagram
file: worker-lifecycle
```

## 那条请求走到这里

那条请求到达时，这六步早就跑完了。它享受到的是六步的产物：

- 第四步算出的显存预算，决定了 KV 池里一共有多少块；
- 第五步分配的那些 KV 张量，就是它第 1 步和第 92 步拿到的那两块的物理位置；
- 第六步捕获的图，就是它 199 步 decode 每一步回放的那张。

**「第 92 步能不能要到第二块」这个问题，答案早在第四步就定了。** 池子里有多少块是启动期减出来的一个常数，运行期不会变大 [D]。所以「跑着跑着 OOM」在这套引擎里通常不是显存不够，是块不够；而块有多少，要回到这一页的第四步查。

## 六步各自改变了什么

**一、`__init__`。** 先按 `COMPILE_CUSTOM_KERNELS` 决定是否警告，然后 `adapt_patch()` 打 worker 层 patch，接着 `ops.register_dummy_fusion_op()`、按设备类型注册 ATB 扩展、`register_ascend_customop(vllm_config)`、`init_ascend_config(vllm_config)`、配置日志、`check_ascend_device_type()`，最后才 `super().__init__()` [C2]。这一步结束时进程内的上游行为已经被替换过，AscendConfig 单例也有值了 [D]。

**二、`init_device`。** 真正选卡（`self.device = self._init_device()`），初始化 workspace 管理器，然后**在这里才造 model runner**——源码注释写明了理由：「Init ModelRunner here, so that we have access to self.device」[C3]。按 `use_v2_model_runner` 在 `NPUModelRunnerV2` 与 `NPUModelRunner` 之间选，选 v2 时会打一条「v2 还在开发，部分特性不可用」的警告 [C3]。

**三、`load_model`。** 按 `enable_sleep_mode` 决定权重进哪个内存池：开了 sleep mode 就用 `CaMemAllocator` 的 `tag="weights"` 池，否则 `nullcontext()` [C6]。之后若配了权重传输就建传输引擎 [C6]。

**四、`determine_available_memory`。** 这一步的产物是 `self.available_kv_cache_memory_bytes`，算法是 `self.requested_memory - profile_result.non_kv_cache_memory` [C5]。中间必须真的跑一遍 `self.model_runner.profile_run()` [C5]。它还带一条断言：profile 之后的可用显存必须小于初始快照的可用显存，否则报错 [C5]——也就是说 profile 没占住显存本身就被当成异常 [D]。完整的扣减项与公式见 [KV Cache Memory Profiling](kv-cache-memory-profiling.md)。

**五、`initialize_from_config(kv_cache_config)`。** 先 `ensure_kv_transfer_initialized`，再按 sleep mode 选 `tag="kv_cache"` 的内存池，然后调 `self.model_runner.initialize_kv_cache(kv_cache_config)` 真正分配张量 [C8]。

**六、`compile_or_warm_up_model`。** 从 `compilation_config` 取 `compile_sizes` 与 `cudagraph_capture_sizes`，把已经要捕获的尺寸从 warmup 列表里剔掉，再按 compile range 补齐端点 [C7]。`enforce_eager` 为真时跳过的是这些剔除/补齐和最后的 `capture_model()`，`compile_sizes` 里的 warmup 仍然照跑 [C7]。

## 顺序为什么不能换

下表是顺着上面六步推出来的，不是源码里的声明 [D]：

| 想换的顺序 | 为什么不行 |
|---|---|
| 先分配 KV Cache 再 profile | 预算是 profile 的产物，第五步的 `kv_cache_config` 依赖第四步的字节数 [C5] |
| 先建 model runner 再选卡 | runner 的构造函数要 `self.device`，注释明说 [C3] |
| 先装权重再打 patch | 权重加载路径本身被 `patch_process_weights_after_loading`、`patch_weight_utils` 改过（后者 v0.26 上已删），patch 必须更早 [C9] |
| 先捕获图再装权重 | 捕获要跑真实 forward，没有权重跑不了 [C7] |

## v0.23 与 v0.26 的差异

六步的划分、顺序和每一步的产物在两个版本上一样，差在第六步里多了一段、以及第三步依赖的那个 patch 少了一个：

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| 第六步 warmup 之后 | 跑完 `_dummy_run` 就去 `capture_model()` | 中间无条件插一次 `kernel_warmup(self)`，`enforce_eager` 也拦不住 [C10] | 启动慢在第六步时，v0.26 上还要多认一段算子预热，它不在 `compile_sizes` 里 |
| 改权重加载路径的 worker patch | `patch_process_weights_after_loading` 与 `patch_weight_utils` 两个 | 只剩 `patch_process_weights_after_loading`，`patch_weight_utils` 整个文件已删 [C11] | 「patch 必须早于装权重」这条理由还在；照 v0.23 的印象去 v0.26 上找 `patch_weight_utils` 会扑空 |

## 排查时怎么用

启动期的报错，看它挂在第几步就能定位范围 [A]：

- 挂在第一步 → patch 或算子注册问题，去 `patch/` 与 `ops/`；
- 挂在第二步 → 设备可见性（`ASCEND_RT_VISIBLE_DEVICES`）或 workspace；
- 挂在第四步且提示可用显存反而变大 → 那条断言被触发了，profile 没有正常占住显存；
- 挂在第六步 → 图捕获，先试 `enforce_eager` 把捕图那段跳过来确认范围 [C7]。

## 常见误解

- **「`init_device` 只是选卡」**——model runner 也是在这里造的；在它之前 `self.model_runner` 还不存在 [D]。
- **「KV Cache 大小由启动参数直接决定」**——参数只给上限意图，实际字节数是第四步减出来的 [C5]。配了 `kv_cache_memory_bytes` 会走快路径：跳过整段测算、直接把这个值返回，但 `profile_run()` 照跑，源码注释写明那是为了编译模型 [C4]。
- **「sleep mode 只影响运行时」**——它在第三步和第五步分别决定权重与 KV Cache 进哪个内存池 [C6][C8]，是启动期就分叉的。
