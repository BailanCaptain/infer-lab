---
id: npu-worker-lifecycle
title: NPUWorker：从出生到能接请求的六步
type: feature
summary: 一颗 NPU 上守着一个 Worker。它从被建出来到能接第一条请求要走六步：换补丁、选卡、装权重、量显存、分 KV 块、录图。顺序是固定的——走到第四步，KV Cache 能有多大才第一次有答案。
aliases: [NPUWorker, WorkerBase, Worker 生命周期, worker 启动, 启动时序, init_device, compile_or_warm_up_model]
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
    note: 第四步那次实测到底怎么算出可用字节数，公式和扣减项在那一页
  - to: kv-cache-spec
    kind: builds-on
    note: 第五步按 KVCacheConfig 分配张量，每层每块的形状由 spec 决定
  - to: one-request
    kind: builds-on
    note: 那条请求写笔记的块、decode 回放的图，都是这六步留下的产物
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一句话

一颗 NPU 上守着一个 Worker（守着一颗 NPU 干活的那个进程，模型真正在它手里算）。它从被建出来到能接第一条请求，要按固定顺序走六步：换补丁、选卡、装权重、量显存、分 KV 块、录图。每一步的产物都是下一步的前提，所以顺序不能换——最要紧的一条是：**第四步之前，KV Cache 能有多大还没人知道。**

```wiki-diagram
file: worker-lifecycle
```

## 问题：敲下启动命令之后，那一阵子它在干什么

按官方示例把[贯穿例子](one-request.md)的模型（Qwen3.6-35B-A3B，两颗 NPU）拉起来，从敲命令到日志里出现「能接请求」，中间要等上一阵，日志一行行往外滚。这段时间机器没有闲着：两颗 NPU 上各有一个 Worker，各自在走同一条六步的路。等的就是这六步。

## 六步各自改变了什么

**一、换补丁。** 昇腾的适配有一部分是「把上游代码的某些行为当场换掉」。Worker 一出生先把这些替换做完，再注册昇腾自己的算子（在 NPU 上真正执行的一小段计算）。这一步走完，这个进程里的上游代码已经不是原样了——后面每一步跑的都是换过的版本。为什么每个进程都得各打一遍补丁，见[三个进程与 patch 注入点](engine-processes.md)。

**二、选卡。** 到这一步 Worker 才真正拿到自己那颗 NPU。也是在这里，它把真正跑模型的那一站——[ModelRunner](npu-model-runner.md)——建出来：建它需要先知道用哪颗卡，所以只能等选完卡再建。

**三、装权重。** 把训练好就不再变的那些数字从磁盘搬进这颗 NPU 的显存。两颗 NPU 各装自己分到的那一份，怎么切开的在[张量并行](tensor-parallel.md)。

**四、量显存。** 装完权重，该给 KV Cache（把算过的 K 和 V 存起来，下一步直接读，不重算）划地盘了。但 Worker 不是看配置文件里写了多少就信多少，而是**实测**：拿一批假数据把整个模型真跑一遍，看这一趟最多占掉多少显存，然后做一道减法——拿到手的显存，减去权重和刚才实测出的运行开销，剩下的才是 KV Cache 的预算。减法的每一项在[KV Cache 显存怎么量出来](kv-cache-memory-profiling.md)。

**五、分 KV 块。** 按第四步的预算，把 KV 池真正划出来。从这一刻起，池子里才有一块块的 KV 块（KV Cache 被切成的小段，一段存固定个数的 token）。贯穿例子那条请求后来写 237 个 token 笔记用的那个 2048 个位置的块，物理位置就是这一步定下的。

**六、录图。** decode 阶段每步只算 1 个 token，活碎，一次次现场下发指令太亏。所以启动时先热身跑几遍，再把一整趟计算录下来（捕获），之后每步照着回放，见[图模式](graph-mode-layer.md)。贯穿例子那 199 步 decode 回放的，就是这里录下的图。

## 顺序为什么不能换

下面是顺着六步推出来的，不是源码里的声明：

| 想换的顺序 | 为什么不行 |
|---|---|
| 先分 KV 块再量显存 | 预算是量出来的产物，没有第四步就没有「分多少」这个数 |
| 先建 ModelRunner 再选卡 | 建它需要先知道用哪颗卡 |
| 先装权重再换补丁 | 装权重走的那条路本身就被补丁改过，补丁必须更早 |
| 先录图再装权重 | 录图要真跑一遍模型，没有权重跑不了 |

## 那条请求享受到的是六步的产物

贯穿例子那条请求进门时，六步早就走完了。它碰到的一切都是启动期定好的：

- 池子里一共有多少个 KV 块，是第四步减出来的一个**常数**，运行期不会变多；
- 它的笔记写进哪片显存，是第五步分配时定的；
- 它 decode 每一步回放的图，是第六步录的。

所以「跑着跑着放不下了」在这套引擎里通常不是显存突然不够，而是**块不够**——块一共有多少，得回启动的第四步查账。

## 排查启动报错，先看挂在第几步

启动期出的错，按挂在第几步就能圈定范围：

- 挂在第一步：补丁或算子注册的问题；
- 挂在第二步：卡没选到，先查设备可见性的设置；
- 挂在第四步、且提示可用显存反而变大：实测的前提被打破了，多半是同一台机器上别的进程在这期间释放了显存；
- 挂在第六步：录图的问题，先切到不录图的模式跑一遍，确认是不是图的事。

具体查哪个开关、报错原文长什么样，见下半。

## 常见误解

- **「第二步只是选卡」**——ModelRunner 也是在那里建出来的；在那之前它根本不存在。
- **「KV Cache 大小由启动参数直接决定」**——参数只表达意图，实际字节数是第四步实测后减出来的。就算手工指定了大小，那遍假数据也照跑，因为顺带把模型编译了。
- **「省显存的睡眠功能只影响运行期」**——其实第三步和第五步就按它分了叉：开着它，权重和 KV Cache 各进各的专用内存池，方便以后整池释放。

## 对照源码

### 怎么开

- `NPUWorker` 继承上游 `WorkerBase` [C1]，一张卡一个。六步对应六个方法，行号见「源码位置」。
- 第一步 `__init__`：先按 `COMPILE_CUSTOM_KERNELS` 决定是否警告，然后 `adapt_patch()` 打 worker 层 patch，接着 `ops.register_dummy_fusion_op()`、非 A5 设备注册 ATB 扩展、`register_ascend_customop(vllm_config)`、`init_ascend_config(vllm_config)`、配置日志、`check_ascend_device_type()`，最后才 `super().__init__()` [C2]。这一步结束时进程内的上游行为已被替换、AscendConfig 单例已有值 [D]。
- 第二步 `init_device`：`self.device = self._init_device()`，初始化 workspace 管理器，然后才造 model runner——源码注释写明理由：「Init ModelRunner here, so that we have access to self.device」[C3]。按 `use_v2_model_runner` 在 `NPUModelRunnerV2` 与 `NPUModelRunner` 之间选。
- 第三步 `load_model`：`enable_sleep_mode` 开着就用 `CaMemAllocator` 的 `tag="weights"` 池，否则 `nullcontext()`；之后若配了权重传输就建传输引擎 [C6]。
- 第四步 `determine_available_memory`：产物是 `self.available_kv_cache_memory_bytes = self.requested_memory - profile_result.non_kv_cache_memory`，中间必须真跑一遍 `self.model_runner.profile_run()` [C5]。配了 `kv_cache_memory_bytes` 走快路径：跳过整段测算、直接返回这个值，但 `profile_run()` 照跑，注释写明那是为了编译模型 [C4]。
- 第五步 `initialize_from_config(kv_cache_config)`：先 `ensure_kv_transfer_initialized`，再按 sleep mode 选 `tag="kv_cache"` 池，然后 `self.model_runner.initialize_kv_cache(kv_cache_config)` 真正分配张量 [C8]。
- 第六步 `compile_or_warm_up_model`：从 `compilation_config` 取 `compile_sizes` 与 `cudagraph_capture_sizes`，把已经要捕获的尺寸从 warmup 列表剔掉，再按 compile range 补齐端点，warmup 跑完 `capture_model()` [C7]。
- 「先装权重再打 patch 不行」的实证：权重加载路径被 `patch_process_weights_after_loading`、`patch_weight_utils` 改过（后者 v0.26 上已删），patch 必须更早 [C9]。
- 上半排查清单对应的开关：第二步挂 → 查 `ASCEND_RT_VISIBLE_DEVICES`；第六步挂 → 先开 `enforce_eager` 把捕图那段跳过来确认范围[A]。

### 会报什么错

- 第四步的断言：profile 之后的可用显存必须小于初始快照的可用显存，否则报 `Error in memory profiling.`，报错文案直接点名常见原因——同容器里其他进程在 profiling 期间释放了显存。也就是说 profile 没占住显存本身就被当成异常 [D]。
- 第三步开 sleep mode 时，`CaMemAllocator` 要求当前用量为 0，否则断言失败：`Sleep mode can only be used for one instance per process.`。
- 第二步选 v2 runner 会打警告（不是错）：`npu model runner v2 is in developing, some features doesn't work for now.`——看到它说明 `use_v2_model_runner` 生效了。

### 开销和什么时候别开

- 启动慢主要慢在第四步（真跑一遍假批）和第六步（逐尺寸 warmup 加捕获）[D]。
- `enforce_eager` 为真时跳过的是尺寸剔除/补齐和最后的 `capture_model()`，`compile_sizes` 里的 warmup 仍然照跑；代价是运行期回到逐算子下发。
- v0.26 上 warmup 之后还会无条件插一次 `kernel_warmup(self)`，`enforce_eager` 也拦不住 [C10]——启动慢在第六步时，v0.26 上要多认这一段。
- 配 `kv_cache_memory_bytes` 能跳过第四步的测算部分，但假批照跑，省不掉编译那份时间。

### 版本差异

六步的划分、顺序和每一步的产物在两个版本上一样，差在第六步里多了一段、以及第一步打的 patch 少了一个：

| 项 | v0.23 维护分支 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| 第六步 warmup 之后 | 跑完 `_dummy_run` 就去 `capture_model()` | 中间无条件插一次 `kernel_warmup(self)`，`enforce_eager` 也拦不住 | 启动慢在第六步时，v0.26 上还要多认一段算子预热，它不在 `compile_sizes` 里 |
| 改权重加载路径的 worker patch | `patch_process_weights_after_loading` 与 `patch_weight_utils` 两个 | 只剩 `patch_process_weights_after_loading`，`patch_weight_utils` 整个文件已删 [C11] | 「patch 必须早于装权重」这条理由还在；照 v0.23 的印象去 v0.26 上找 `patch_weight_utils` 会扑空 |

### 源码位置

六个方法都在 `vllm_ascend/worker/worker.py`；v0.26 列是在 `2ed6cbba` 上重新数的 [D]。注意文件里的排列顺序不是执行顺序——第四步的方法排在第三步前面。

| 步骤 | 方法 | v0.23 行号 | v0.26 行号 |
|---|---|---|---|
| 一、换补丁 | `__init__` | 90 | 99 |
| 二、选卡、造 runner | `init_device` | 505 | 489 |
| 三、装权重 | `load_model` | 681 | 723 |
| 四、量显存 | `determine_available_memory` | 527 | 511 |
| 五、分 KV 块 | `initialize_from_config` | 907 | 1001 |
| 六、warmup 与捕获 | `compile_or_warm_up_model` | 706 | 748 |

worker 层 patch 的清单在 `vllm_ascend/patch/worker/__init__.py`（两个版本各一份）。
