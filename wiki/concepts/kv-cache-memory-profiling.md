---
id: kv-cache-memory-profiling
title: KV Cache Memory Profiling：整卡的九成，减掉量出来的三块
type: feature
summary: >-
  启动时跑一遍最大规模的假数据前向，量出权重、激活峰值、非 torch 三块；整卡容量 × gpu_memory_utilization
  减掉这三块，就是 KV Cache 的字节预算。图捕获不在这个减法里。
aliases:
  - KV Cache Memory Profiling
  - 显存探测
  - KV Cache 显存探测
  - KV Cache 显存测算
  - KV Cache 内存探测
  - KV Cache 显存预算
  - 显存预算探测
  - 显存 profiling
  - determine_available_memory
chapters:
  - '11'
sources:
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L445-L458'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L464-L480'
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L548-L619'
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L621-L648'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L526-L574'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L576-L597'
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L504-L538'
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L877-L923'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L730-L771'
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L4042-L4058'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3684-L3697'
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L4165-L4168'
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L5801-L5811'
  - 'vllm-ascend@b255ab59:vllm_ascend/_310p/worker_310p.py#L113-L137'
  - 'vllm-ascend@2c59ff10:vllm_ascend/_310p/worker_310p.py#L103-L123'
  - 'vllm-ascend@b255ab59:tests/ut/worker/test_worker_multi_instance.py#L171-L224'
  - 'vllm-ascend@b255ab59:tests/ut/worker/test_worker_multi_instance.py#L147-L169'
  - 'vllm-ascend@b255ab59:tests/ut/worker/test_worker_v1.py#L1302-L1309'
  - 'vllm-ascend@b255ab59:docs/source/faqs.md#L139-L149'
  - 'vllm-ascend@b255ab59:docs/source/tutorials/models/Dots3-Note.md#L398-L408'
  - >-
    vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L138-L138
  - >-
    https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/v1/worker/utils.py#L405-L425
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L650-L732'
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L540-L546'
  - 'vllm-ascend@b255ab59:vllm_ascend/worker/worker.py#L1096-L1107'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L511-L605'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L3714-L3730'
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: C
relations:
  - to: kv-cache-spec
    kind: builds-on
    note: profiling 只产出一个字节数，除以 spec 声明的每块字节数才变成块数
  - to: one-request
    kind: builds-on
    note: 这一页算出的 3875 块里，那条请求只占 2 块；每块 14 MiB 这个除数也是从那条请求来的
contradicts: []
updated: '2026-09-21'
rawSources:
  - >-
    raw/sha256-28e0c42a4da3e1d1ae42ea272529d11b6a688cde2e0759b672471cc832358025.md
  - >-
    raw/sha256-a1026f7df3575e077953d95909c1d1d1639fcad49299256f5fcb3069614b9e26.md
---

## 一句话

KV Cache 要的是「剩下的全部显存」，可「剩下多少」在启动那一刻谁都不知道——权重看模型和量化方式，激活峰值看算子实现，还有一大块 ACL context、HCCL 缓冲、驱动层分配谁都数不清。`NPUWorker.determine_available_memory()` 的办法是实测：先拍一张启动快照，再故意跑一遍最坏情况的假数据前向，两张快照一减就得到那三块。**整卡容量 × `gpu_memory_utilization` 减掉这三块，就是 KV Cache 的字节预算** [C3]。这个数是后面一切分块、调度、抢占的总量上限——**但它没算图捕获那一块**，这是这一页最值得记住的一条。

```wiki-diagram
file: kv-cache-memory-profiling
```

## 那条请求走到这里

[那条请求](one-request.md)一共只要 2 块 KV，可它能不能要到，取决于引擎启动时这一步算出的数。把它跑起来：

```bash
vllm serve Qwen/Qwen3-0.6B \
  --gpu-memory-utilization 0.9 \
  --max-model-len 4096 \
  --block-size 128
```

`0.9` 是默认值，官方 OOM 指南就是从这个旋钮开始调 [S19]；`block-size` 不是选的：昇腾上不写就由配置检查里的 `refresh_block_size` 填成 128。卡按 Atlas 800I A2 的 64 GiB 算，激活峰值与非 torch 两块只能实测，这里取一组典型值 [A]：

| 这一步 | 算式 | 结果 |
|---|---|---|
| 立预算 | `64 GiB × 0.9` | 57.60 GiB |
| 权重 | 596M 参数 × 2 B（bf16） | 1.11 GiB |
| 激活峰值 + 非 torch | 实测值，这里假设 2.30 + 1.20 | 3.50 GiB |
| KV 预算 | `57.60 − 1.11 − 3.50` | **52.99 GiB** |
| 换成块 | `52.99 GiB ÷ 14 MiB` | 3875 块 = 496,000 个 token 的位置 |

权重那行可以拿计算器复核：每层 attn `1024×2048 + 1024×1024 + 1024×1024 + 2048×1024 = 6.29M`，MLP（intermediate=3072）`3 × 1024×3072 = 9.44M`，每层 15.73M × 28 层 = 440.4M，加上 tied 词表 `151936×1024 = 155.6M`，共约 596M 参数 [D]。

**3875 块，那条请求只占 2 块。** 它永远碰不到这个上限——真正会撞上它的是并发和长上下文，而这正是这个数存在的理由。同一台机器换成 Atlas 300I Duo（310P），最后还要整除 2：`52.99 ÷ 2 = 26.49 GiB`，块数掉到 1937。

## 分母是整卡，不是空闲

`gpu_memory_utilization` 乘的是 `init_snapshot.total_memory`，也就是**整卡容量**，不是启动时的空闲容量。上游 vLLM v0.23.0 的 `request_memory()` 是同一个算式 [C22]，这不是昇腾改出来的。

这条选择有代价也有理由。好处是同一张卡上起两个实例、各自 `--gpu-memory-utilization 0.4`，第二个实例照样按 `64 × 0.4 = 25.6 GiB` 立预算，不会因为第一个实例已经占了 25.6 GiB 就把自己算成负数——上游为此专门留了一条回归测试 [C16]。坏处是这个乘法不认账：别人占走的显存不会自动从预算里扣，只在启动时做一次「空闲 < 请求量就直接抛 `ValueError`」的粗检查。

反过来用也成立：官方的 CPU offload 文档把调小 `gpu_memory_utilization` 当成驱动卸载的手柄——NPU 侧块池越小，淘汰越频繁，CPU 池的命中机会越多 [S21]，见 [KV Cache CPU Offload](kv-cache-cpu-offload.md)。

## 量的是两张快照的差，不是任何一个绝对值

三块的来路各不相同，混着看会以为它们出自同一次测量：

- `weights_memory` 不是现算的，是 `load_model()` 结束时记下的 `model_memory_usage`，profiling 只是把它当参数传进上下文；
- `non_torch_increase` 由上游的 `memory_profiling` 上下文从进出两张快照的差值推出来，ACL context、HCCL 缓冲、驱动层分配都落在这一项里；
- `torch_peak_increase` 被**手动覆写**过：代码在 `memory_profiling` 上下文**内部**、图捕获之前单独读一次 `allocated_bytes.all.peak`，再减去 profiling 前的峰值，为的是不把图池分配算进激活。

「跑一遍最坏情况」这件事本身也被昇腾加过料，而且各分支加的不是同一件事 [!]：v0.26 起多了 sparse offload 的 topk 缓冲预分配 [C27][C10]，v0.23 多了 PCP 分支——`pcp_size > 1` 时把 `max_num_tokens` 缩小到 `ceil(max_num_tokens / (pcp_size × 2)) × 2` 再跑，跑完还原 [C11]。后者会直接压低测出的激活峰值，从而放大 KV 预算。

## 图捕获的显存不在预算里

`capture_model()` 在 `compile_or_warm_up_model()` 里才调用，那时 KV Cache 张量早已按上面那个预算申请完毕；它的返回值是实测的图池字节数。单元测试把这件事钉死了：profiling 期间不调用上游的 `profile_cudagraph_memory`、也不设 `npugraph_memory_estimate` [C17]。

**所以「profiling 过了」不等于「起得来」。** 官方模型手册记着这个坑的实测后果：自动 profiling 分到一个很大的 KV，图捕获阶段峰值超限，worker 直接 `died unexpectedly` [S20]。

补救办法写在日志里。图捕获跑完后，worker 把四块加起来、再扣掉固定的 150 MiB 安全余量，给出一条可以直接抄的 `--kv-cache-memory=<字节数>` [C8]。接着前面那组数，假设图池吃了 1.80 GiB、启动时空闲 63.20 GiB [A]：

```
non_kv_memory          = 1.11 + 2.30 + 1.20 + 1.80 = 6.41 GiB
suggested_to_requested = 57.60 − 6.41 − 0.146 = 51.04 GiB
suggested_to_gpu_limit = 63.20 − 6.41 − 0.146 = 56.64 GiB
```

第一个数比刚才的 52.99 GiB 小 1.95 GiB，差额正是图池那 1.80 GiB 加安全余量。**这也解释了默认值为什么是 0.9 而不是 0.99**：`64 × 0.1 = 6.4 GiB` 那条尾巴就是留给图池和运行期碎片的，官方 OOM 指南让你调小它，调的就是这条尾巴 [D]。

## 主公式之后，main 还要过四道手

v0.23 算完 `requested_memory − non_kv_cache_memory` 就 `return`。main 不是，返回值还要再过四层，每层都可能改写它 [C4]；v0.26 只接了其中第 2、3 两层：

1. **多组缩放**——模型有多个 KV cache group（注意力 + Mamba 这类混合架构）时，按「最大一组的每块字节 ÷ 所有组的每块字节之和」把预算缩小，因为昇腾按层建连续缓冲，不缩会超 [C23]。单组模型两个数相等，原样返回——那条请求就是单组 [D]。
2. **层复用缩放**——[Layerwise Offload](kv-cache-layerwise-offload.md) 开启且存在层复用时，预算乘上「层数 ÷ 缓冲区个数」。
3. **稀疏重规划**——[Sparse KV Offload](kv-cache-sparse-offload.md) 开启时，整个数字交给 `plan_sparse_kv_offload_memory` 按 NPU、DRAM、workload 三个上限重排，返回 `final_planner_bytes`。
4. **KV 流水并行预算**——`_apply_kvpp_memory_budget` 把字节数换算成块数再乘回每块字节；只有 `kvpp_config.size > 1` 时才建这个计划，否则原样透传 [C25]。

那条单卡请求四道全不触发：第一道要换混合架构的模型，第二、三道要配 PD 分离，第四道要开 KV 流水并行。

main 还在 profiling 的第一行插了 `maybe_apply_startup_plan(self)`，并在建议值为正时调 `maybe_save_startup_plan()`——上游新加的机制，把这次量出来的结果存下来，下次同样配置的启动直接套用，不必再量一遍 [I]。这两个名字在 v0.26 的 `vllm_ascend` 里 grep 不到。

Atlas 300I Duo（310P）走的是另一条路：整个方法被覆盖，预算**再整除 2**，注释说明是给算子 workspace 和其它缓存留地方；RC 形态下还改用 `psutil.virtual_memory()` 统计，因为主机内存与设备内存共享 [C14]。三版的折半逻辑逐字相同，main 只是在它后面接了上面第 1 条的多组缩放 [C15]。

预算落到 `initialize_from_config()` 之后怎么切成块，是 [KV Cache Spec](kv-cache-spec.md) 的事。

## 三个分支在这一步的差别

下表对照 **v0.23 维护分支**（2026-09-10 的源码快照 `2c59ff10`）、**v0.26 分支**（2026-09-17 的 `2ed6cbba`）与 **main 开发主线**（源码快照 `b255ab59`）。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 主公式之后 | 直接 `return` | 层复用 → 稀疏，两道 [C26] | 多组缩放 → 层复用 → 稀疏 → kvpp，四道 | 这些特性开了，返回值就不等于主公式 [!] |
| `--kv-cache-memory` 快路径 | 跳过全部计算，原样返回该值 | 也跳过，但仍过稀疏一道 | 也跳过，但仍过稀疏与 kvpp 两道 | 三版都不受 `gpu_memory_utilization` 约束 [!] |
| `profile_run()` 的加料 | EPLB 预热 + MC2 dummy run + PCP token 切分 | 同 main | EPLB 预热 + MC2 dummy run + sparse topk 缓冲 | v0.23 开 PCP 会压低激活峰值、放大预算 [!] |
| 跨次启动 | 每次启动都重量一遍 | 同 v0.23 | profiling 前 apply、给出建议值后 save | main 上第二次启动可能根本没量 [!] |
| 310P | 主公式结果 `// 2` | 同 v0.23 | 同式，后接多组缩放 | 同样的卡同样的配置，310P 只拿到一半 |

三版一致的有三条：分母都是整卡 `total_memory`、`non_kv_cache_memory` 都只有三项（图池不在内）、建议值的安全余量都是 `150 MiB`。

## 常见误解

- **「`gpu_memory_utilization=0.9` 是最多用掉空闲显存的 90%」**——分母是整卡 `total_memory`，不是 `free_memory`。卡上已经跑着别的东西时，0.9 意味着你要走的是整卡的九成，只有启动那一刻「空闲够不够」会被检查一次。
- **「profiling 过了就不会 OOM」**——预算里没有图池那一块，`capture_model()` 在 KV Cache 分配之后才吃显存。官方模型手册里就有 profiling 通过、图捕获把 worker 撑死的实测记录。
- **「预算算成负数会兜底成 0」**——不会，`int()` 之后原样返回负值，单元测试专门锁住了这个行为 [C18]。真正的报错要等到按这个字节数去切块时才出现。

## 已废弃的说法

### 2026-09-16 · 修订 ce37962dd2e9737a

旧说法（历史记录，已废弃）：

```text
昇腾侧和上游的关键分歧在**分母**。
```

替代结论：

```text
这里的预算按**整卡显存**计算，上游 vLLM v0.23.0 也是这样算的 [C22]。
```

废弃依据（来源是否支持结论仍须人审）：

- `https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/v1/worker/utils.py#L405-L425`

- `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L441-L454`

旧文的来源编号（仅解释上方历史原文）：

1. `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L441-L454`
2. `vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L464-L480`
3. `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L536-L584`
4. `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L586-L630`
5. `vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L526-L574`
6. `vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L576-L597`
7. `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L500-L534`
8. `vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L778-L821`
9. `vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L730-L771`
10. `vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3713-L3727`
11. `vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3684-L3697`
12. `vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3834-L3837`
13. `vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L5175-L5185`
14. `vllm-ascend@28bf3a2e:vllm_ascend/_310p/worker_310p.py#L113-L133`
15. `vllm-ascend@2c59ff10:vllm_ascend/_310p/worker_310p.py#L103-L123`
16. `vllm-ascend@28bf3a2e:tests/ut/worker/a2/test_worker_multi_instance.py#L172-L223`
17. `vllm-ascend@28bf3a2e:tests/ut/worker/a2/test_worker_multi_instance.py#L146-L168`
18. `vllm-ascend@28bf3a2e:tests/ut/worker/a2/test_worker_v1.py#L1109-L1116`
19. `vllm-ascend@28bf3a2e:docs/source/faqs.md#L138-L148`
20. `vllm-ascend@28bf3a2e:docs/source/tutorials/models/Dots3-Note.md#L398-L408`
21. `vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L109-L110`
