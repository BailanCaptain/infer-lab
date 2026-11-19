---
id: npu-platform
title: NPUPlatform：配置校验与设备实现选择
type: feature
summary: >-
  昇腾插件交给 vLLM 的平台实现。启动时它按组合校验整份配置、就地改写，再答出 Worker 类、注意力后端与图包装的类名；也是「查不到设备显存以后默认
  token 预算怎么定」的唯一推导处。
aliases:
  - NPUPlatform
  - platform.py
  - 平台类
  - 昇腾平台类
  - PlatformEnum.OOT
  - check_and_update_config
  - get_device_total_memory
  - get_attn_backend_cls
  - worker_cls
  - 默认 token 预算
  - 回退档
  - refresh_block_size
chapters:
  - '10'
order: 60
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L128-L206'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1330-L1340'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2010-L2051'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L275-L331'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L338-L428'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L430-L448'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L500'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L500-L528'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L529-L634'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1054-L1060'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L636-L700'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L886'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1446'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L74-L84'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L228-L234'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L186-L192
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2300-L2335'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L38-L64'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L642-L652'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2484-L2566'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L274-L426'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L225-L238'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L457-L495'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1491-L1502'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1232-L1248'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm@0fc695fc:vllm/config/vllm.py#L850-L860'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1880-L1905'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L150-L160
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1255-L1260'
  - 'vllm@f7e62e3d:vllm/envs.py#L1143-L1148'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L175-L180'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2372-L2377'
  - >-
    vllm@0fc695fc:vllm/transformers_utils/model_arch_config_convertor.py#L252-L308
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L30
  - 'vllm@0fc695fc:vllm/config/cache.py#L46'
  - 'vllm@0fc695fc:vllm/config/cache.py#L231-L239'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L338-L480'
  - >-
    raw:sha256-1dc31584af8351da9ceeef16c9e41373f5abd84c2501b7f0f7b4f67dd4866b6d.md#L1-L1290
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1625-L1711'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1714-L1783'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L893-L900'
  - 'vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L255-L268'
  - >-
    https://www.modelscope.cn/api/v1/models/Eco-Tech/GLM-5.3-Flash-w8a8/repo?Revision=9e55cbc8e2b19e20c63b08b916d2582f25a22504&FilePath=config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L335-L424'
  - 'vllm@0fc695fc:vllm/config/model.py#L1768-L1811'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_speculative_config.py#L120-L154'
  - 'vllm@0fc695fc:vllm/config/model.py#L751-L758'
  - 'vllm@0fc695fc:vllm/config/model.py#L1646-L1648'
  - 'vllm@0fc695fc:vllm/transformers_utils/model_arch_config_convertor.py#L345-L363'
  - 'vllm@0fc695fc:vllm/transformers_utils/model_arch_config_convertor.py#L581-L613'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L478-L504'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L621-L633'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L372-L377'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L674-L694'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L230-L244'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L232-L245'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L478-L525'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1365-L1375'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L260-L273'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L606-L683'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1570-L1580'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2700-L2740'
  - 'vllm@ba15685a:vllm/engine/arg_utils.py#L2985-L3030'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: vllm-platform-interface
    kind: builds-on
    note: 先理解平台契约：谁在问、当前平台怎么选出来
  - to: ascend-config-system
    kind: builds-on
    note: 配置的三路输入与优先级，本页只讲平台这一道校验与改写
  - to: attention-backend-family
    kind: builds-on
    note: 区分通用选择接口与 GLM 两类层的专用后端
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 选出的 Worker 类接着做起卡、量显存、切块
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-1dc31584af8351da9ceeef16c9e41373f5abd84c2501b7f0f7b4f67dd4866b6d.md
  - >-
    raw/sha256-deeaac288e4901b0b767fc1a62fe08407cceb4040cf308ba9e3e8654a4244bce.md
---

## 你写在命令里的配置，为什么不是最后生效的那一份

**NPUPlatform 是昇腾插件交给 vLLM 的那份平台实现：启动时它把整份汇总配置过一遍——不支持的组合当场报错，该改的就地改掉——再在被问到时答出 Worker（管一张卡、执行前向的进程实现）、注意力后端、图包装这些「用哪个实现」的类名。** [Platform 契约](vllm-platform-interface.md)规定上游怎么问、当前平台怎么选出来；本页只讲昇腾这一侧答了什么、改了什么。


```wiki-diagram
file: platform-surface
```

图分三段，对应两个时刻。**校验和改写发生在启动时的同一次调用里，而且相互穿插**：上游把汇总配置（模型、并行、缓存等选项合成的那一个对象）交过来，平台先做前置检查，再直接修改这个对象——Worker 类名写进并行配置，缓存精度写进缓存配置，块大小按通用规则补齐或改回 128（混合模型保留更早写入的值）。后面还会检查图模式和 PD 角色；这些检查失败时，前面的改写已经发生，启动仍会停止。**注意力后端的答名字发生在稍后**：Worker 起卡、模型建层的时候，才有人拿着「这层是不是 MLA、是不是稀疏」来问该用哪个注意力后端。图右下角是例外：GLM 的两类注意力层在自己的算子实现里写死了后端，不查平台这张表。

## 为什么这层非要能改配置，代价在哪

先看一个真实的数：官方双机命令写了显存预算比例、每步 token 预算、每步请求数上限、单请求长度上限这些参数，没有 `--block-size`。而本部署的逻辑块推导值是 640 个 token。这个值不是平台这一步写的，而是由更早一步的[补丁](ascend-patch-system.md)写入：上游构造汇总配置时，先跑混合模型（这里混合稀疏 MLA 与[线性注意力](linear-attention.md)）的配置检查，昇腾换进去的那一版把块大小写成 640；平台在更晚的时候才被调用，它负责的是**不把 640 改回 128**——通用规则里「块大小不是 128 就改回 128」那一条，遇到混合模型会跳过。算法与 640 的来历见[部署页那一节](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。如果平台只能「报属性」，这类适配就得在其他配置阶段完成；用户不能只看命令是否显式填写就判断最终块大小。

代价是三条，后面三节各讲一条：

1. **输入值和生效值分家。** 排查「我配了怎么没效果」要多看一层：先确认平台这一步有没有把它改掉，再去看消费者。配置本身的三路输入和优先级在[昇腾配置体系](ascend-config-system.md#解析完还会被改写生效值不是你写的值)。
2. **校验是跟着版本走的。** 建配置之前的校验数量随版本不断演进：`v0.23.0` 是 4 个类方法，`v0.26.0rc` 精简为 2 个（删掉了层切分校验），`v0.30.0` 扩充为 7 项前置校验加量化/FP8 能力断言，`main` 则在入口首行直接调用 `apply_v2_model_runner_config_patch()` 锁定 MRV2 并退役 MRV1 专属校验（对照见[配置页版本差异](ascend-config-system.md#版本差异)）。拿一个版本的报错去另一个版本搜函数名往往搜不到。
3. **「拒答」也是一种行为。** 固定旧镜像的 `get_device_total_memory` 主动抛不支持；一个不回答的问题改变了上游默认调度预算的档位，这是本页专门要讲清的一条链。`v0.30.0` 与 `main` 改为守卫式查询——设备初始化后可答、未初始化前仍拒答，由于默认预算判定早于 `torch_npu` 初始化，在线服务未显式传参时依然落回小档起点 `2048`，不能把旧版的一律拒答与新版的守卫行为混为一谈。

## 校验与改写怎样影响执行

上游在汇总配置构造到最后一段时调用平台的这个方法，所以它看到的是「用户输入 + 上游默认值」合起来的完整一份。方法内部的先后是固定的：

```wiki-diagram
file: platform-check-order
```

**两道早退。** 设备类型不是 npu 就直接返回；没有模型配置就打一条警告后返回。这两条保证同一份代码在别的设备上不乱改东西。

**先认量化，再跑校验。** 认量化这一步决定后面按哪套量化实现去读权重；它排在校验之前，所以校验能看到量化识别的结果。

**四个校验，按固定顺序。** 任一不通过就抛错，启动到此结束：

| 校验 | 拦的是什么组合 | 对本部署意味着什么 |
|---|---|---|
| 层切分 | 按层切分只许开在 [PD 分离](pd-disaggregation.md)的 producer 一侧 | 本部署没开 PD 分离，也没配这个键 |
| 投机 + decode 侧上下文并行 | 两者本身可以同开。只有开了[投机解码](speculative-decoding.md)、decode 侧[上下文并行](context-parallel.md)（DCP）大于 1、且草稿模型不是 MLA 时，才查三条头数约束：草稿的张量并行数要大于 KV 头数；DCP 不超过「草稿张量并行数 ÷ KV 头数」；每个 KV 头对应的 Q 头数能被 DCP 整除。MLA 草稿直接放行 | 本部署开着 MTP，但 DCP 是 1，这一条不触发 |
| 并行组合 | 数据并行大于 1 且 prefill 侧上下文并行大于 1 | **直接管着本部署**：这里 DP 是 2，prefill 侧上下文并行只能留在 1 |
| 流水线并行 + MTP | 开了 MTP 且流水线并行大于 1 时，只要不在 PD 分离的 producer 一侧就抛错——没配 PD 分离也照样抛 | 本部署流水线并行是 1，不触发 |

**修不兼容组合，然后建昇腾配置。** 平台先把几组已知不兼容的取值改成能跑的，再建那份昇腾自己的配置对象。建与取的规则、缓存条件都在[昇腾配置体系](ascend-config-system.md)，本页不重复。

**定编译与图模式。** 这一段按是否走 xlite 执行模式、是否要求纯 eager、请求的图模式档位来定最终的编译与图捕获方式。这一段会在四种情况下把图整段关掉：开了 xlite 全图模式却没开投机解码（同时改成纯 eager）；编译档位不是昇腾支持的那两种；请求的图模式档位既不是分段图也不含整图；编码器-解码器模型请求了整图、又没走 vLLM 编译。要求纯 eager 时，上游在这之前已经把图关了。本部署里还有一条与模型有关的改写：模型配置带 indexer 的 top-k 字段时，缓存精度被改写成模型自身的 dtype。GLM 的文本配置正好有这个字段，所以这条对本部署生效。图模式本身见[图模式层](graph-mode-layer.md)。

这条配置路径关闭 Inductor（一种编译后端），图模式却由单独的配置控制：图模式关闭时，编译模式也关闭，并关闭对应的 NPU 图执行扩展；图模式要求分段编译时，则必须选择 vLLM 编译模式。因此，不能仅凭 Inductor 关闭就判断图模式也已关闭。

**选 Worker 类。** 只有当并行配置里的 Worker 类写着「自动」时才选，三条分支互斥：310P 设备走 310P 专用 Worker；开了 xlite 执行模式走 xlite Worker；其余走常规的 NPUWorker。

**定块大小。** 通用规则有两条：块大小空着就先填 128（上游构造缓存配置 `CacheConfig` 时，它的 after 校验器已把空着的块大小填成类常量 `DEFAULT_BLOCK_SIZE = 16`，所以这条是兜底）；已设的值不是 128、且开了前缀缓存或 chunked prefill，就强制改回 128。混合模型只跳过后一条，连同 xlite 模式下「不超过 128」的限制——所以补丁更早写进的 640 能留下来。同一个词在这套部署里有五种含义，逻辑块、kernel 块、各缓存组的块和调度器的块都不是一个数，消歧表在[缓存规格](kv-cache-spec.md)。

**最后三条按 PD 角色的检查。** 均衡调度只允许 PD 混合角色或没配 KV 传输，显式的 producer / consumer 角色直接报错；KV 载入失败策略选重算时，混合模型断言失败；重算调度在 producer 上只警告并被重置为关，在既不是 producer 也不是 consumer 时报错。这三条说明同一个开关的含义依赖周围配置，不能逐个独立打开就认为组合成立。

## 默认预算为何不能只看一个数字

把前面 `check_and_update_config` 在 `v0.30.0` / `main` 上的六段改写级联，与更早一步在 `EngineArgs` 发生的「拒答总显存 → 回落默认预算 `2048`」隐藏链条合在一张图里，两条启动线的先后因果一目了然：

```wiki-diagram
file: npu-platform-fig-override-cascade
```

这里说的预算是**调度预算**：一步最多收多少个 token 参与计算，它限制的是工作量，不是显存（调度侧怎么用它见[调度器](vllm-scheduler.md)）。用户不写这个参数时，它的默认值是上游按硬件挑一档，而挑档要先问平台一句话，链条有三段。

**第一段：平台被问显存，选择不答。** 上游在把各项选项汇总成配置对象之前，先把这个默认值定下来。定的时候它调平台的「这块设备总共多少字节显存」，昇腾的固定实现一律抛不支持，注释写明理由：实现它会顺带把设备运行库提前拉起来，而这个库在一个进程里只许初始化一次，提前拉起来会让后面正式初始化出错。上游把异常吞掉，按 0 字节继续往下算。

**第二段：按容量选档，另有一条批式 DP 入口。** 容量不小于 70 GiB 且设备名里没有 a100，选大档：库调用方式 16384、API 服务方式 8192；否则选小档：8192 与 2048。这个固定镜像的容量查询失败后落在小档，原因是查询被拒绝。对照一下：同一条命令放到 H100 上（显存不小于 70 GiB、设备名不含 a100，上游源码注释点名 H100 和 MI300x 走大档），API 服务方式默认 8192；固定镜像因查询失败，这一步落到 2048。

另外有一条不看档位的入口：当专家分发后端是低时延 DeepEP 或 NIXL EP 这两种之一、开了专家并行、且数据并行大于 1 时，上游判定为「批式 DP MoE」，预算起点取 256 这个常量；它和档位表是两条互斥的路。同一个常量也是 MoE 层配置中最大 token 数字段的缺省值。旧版的「MoE DP 分块」参数也默认 256，注释说明它是每个 DP rank 批式派发的工作单位。但这些缺省值不能证明现行通信内核每次最多装 256：后面的吞吐模式仍能把未显式设置的预算翻倍，模型长度等条件还会继续调整它。

**第三段：默认值还要按条件调整。** 吞吐模式分别把未显式设置的 token 预算和请求数上限翻一倍。对未显式设置的 token 预算，没开 chunked prefill（把长提示词拆成几步送）时抬到至少等于单请求长度上限；多模态 prefix-LM 还要容纳单个媒体项的最小 token 数；最后按「请求数上限 × 单请求长度上限」收窄。请求数上限若未显式设置，再按 token 预算收窄。缺省常量本身也有三个：预算 2048、批式 DP 的 256、请求数上限 128。

**token 预算与请求数上限各有一道独立闸门。** 进入这个默认值函数后，问显存和选档仍照常发生，不管用户写没写参数；只有用户没显式写的那一项才被默认值填充并接受相应调整。显式 token 预算在这个函数内保持原值，却不会阻止未显式设置的请求数上限被翻倍或收窄。最终生效值还要继续经过配置验证与后续消费者。

所以三件事不能混着说：

- **拒答不等于没有显存。** 真正的显存账在 Worker 起卡、加载权重之后按占用测量得出，推导在[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。
- **回退档不等于「昇腾默认每步 2048 token」。** 2048 只是 API 服务方式在小档上的起点，后面还要过第三段那四次加减，而且只在没显式设置时才成立。
- **调度预算不等于缓存块大小。** 前者说一步收多少 token，后者说历史状态按多大一页存，见[缓存规格](kv-cache-spec.md)。

## 落到 GLM 双机：这一层交出的名字和数

本页挂靠 [A0：启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)。固定部署是两台 A2、每台 8 卡，TP8 / DP2 / EP16、W8A8，参数取值与推导见[部署前提](glm-5-3-flash-two-node.md#部署前提)。平台在这套部署上交出的答案：

| 上游问什么 | 本部署得到什么 |
|---|---|
| 自动选哪个 Worker 类 | 常规 NPUWorker：不是 310P 设备，xlite 执行模式也没开 |
| 注意力后端用哪个 | 通用接口按三个标志查表回答；GLM 的两类层不走这张表 |
| 图包装与编译后端用哪个 | 昇腾自己的图包装类与编译器类，不是上游那条默认编译路 |
| 设备通信器类 | 昇腾的通信器类，通信后端名由 Worker 给出 |
| 缓存精度 | 因为模型配置带 indexer 的 top-k 字段，被改写成模型自身的 dtype |
| 逻辑块多大 | 补丁更早定成 640 个 token；平台遇到混合模型，跳过「改回 128」那一条，640 留下 |

**注意力后端那一行要展开讲，否则容易记错。** 通用接口的查表键是三个标志：是不是 MLA、是不是稀疏、是不是压缩，四个组合各对一个昇腾后端类；命令行指定 FlashAttention 且额外条件成立时另走 FA3 后端；310P 设备有自己的一张表。但 GLM 的稀疏 MLA 层在自己的算子实现里直接写死了配套的后端类，KDA 层由算子返回专用的 GDN 后端。所以「在通用表里挑一个名字」不能代表 GLM 这两类层的实际实现，完整对应关系见[注意力后端](attention-backend-family.md)。

FA3 验证还限制了配置组合：请求 FlashAttention 后端、进入该验证且启用用于训练与推理一致性场景的批次不变选项时，MLA 或稀疏注意力组合会报错；未启用该选项时，验证不通过并转用插件后端。这是该验证路径的组合限制，不能据此判断所有 MLA 配置都无法选择注意力后端。

**预算那一行反过来：平台的拒答不改变本部署的显式预算。** 官方命令写了每步 8192 个 token，同时写了请求数上限 32 和显存预算比例 0.85；两项预算都显式给出，所以这个默认值函数保留 8192 和 32。把 token 预算参数删掉、保留其余条件，可以推一遍：在这个阶段，专家分发后端尚为默认的 allgather/reducescatter，不进批式 DP 路径；API 服务方式的小档起点是 2048；均衡模式不翻倍；生成模型默认支持 chunked prefill，不触发长度抬升；最后取 min(32 × 133,120, 2048) = **2048**。稍后的平台还能改写分发后端，不能拿那个后写值倒推本函数当时的分支。

这份推导还要求模型不启用多模态 prefix-LM。固定公开 W8A8 配置的架构是多模态的 `Glm5NextForConditionalGeneration`，配置中没有 `is_mm_prefix_lm`，GLM 也不在上游默认名单中，因此按这份配置不触发该下限。若现场配置或覆盖项把它设为真，就要重新计算媒体项下限；公开配置不能代替容器内最终配置和启动日志。[平台契约页](vllm-platform-interface.md#主机内存设备显存和-token-预算怎样分账)给的是同一个结论，完整链条只在本页推导。

**并行那条校验对本部署是硬约束。** 这里 DP 是 2，所以 prefill 侧上下文并行只能是 1；想开它就得先放弃 DP，而 DP2 是这套双机部署分派请求的方式。

读完可以沿三个结果继续往下走：Worker 类名进 [Worker 启动](npu-worker-lifecycle.md)，块大小与缓存精度进[状态池分配](vllm-kv-block-allocation.md)，后端类名进各层的注意力执行。组合通过校验只说明能进下一阶段，不等于模型已经跑起来。

## 常见误解

- **「平台只是一张属性表，读一读就知道硬件能干什么」**——它同时会拒绝组合、就地改写配置。命令里写的值和最终生效的值可以不同，排查要先确认这一层改过什么。
- **「查不到设备显存是个 bug」**——固定旧镜像主动拒绝这个查询，注释解释它会导致设备运行库过早初始化。`v0.30.0` 与 `main` 改为守卫式查询：未初始化时拒绝，初始化后可答；是否落到回退档取决于查询时设备运行库是否已经初始化。
- **「昇腾默认每步只收 2048 个 token」**——2048 只是 API 服务方式在小档上的起点，后面还有翻倍、抬升、收窄四道加减；并且选档照常发生，选出的值只在没显式写这个参数时才生效，本部署显式写了 8192。
- **「注意力后端在通用映射里挑一个名字就是 GLM 的实现」**——GLM 的稀疏 MLA 层与 KDA 层都在自己的算子实现里绑定专用后端，不查那张表。
- **「平台把 PyTorch 的编译关了，说明昇腾不支持 graph mode」**——关掉的只是上游那条默认编译路，昇腾自己的编译器类和图包装类是平台另外两个回答给出的。
- **「校验通过就说明这套配置能部署」**——通过只说明能进下一阶段；权重格式、算子、硬件是否相符要到 Worker 加载模型时才见分晓。

## 对照源码

**配置分支的来源范围。** 已核专用镜像 `db701c1f`：来源 11 的 `platform.py` 第 650–660 行仅在 `parallel_config` 存在且 `worker_cls == "auto"` 时，按 310P、Xlite、普通 `NPUWorker` 的顺序选择，把完整类路径写回 `parallel_config.worker_cls`。来源 9 第 592–603 行对应 `use_inductor=False`、图模式 `NONE` 时关闭编译与 `npugraph_ex`、分段编译要求 `VLLM_COMPILE`；来源 12 第 805–858 行对应 `FLASH_ATTN` 的验证入口和 `use_batch_invariant`、MLA/稀疏组合门槛，后续还有依赖包及接口检查。这些条件不能替代设备执行验证，也不推广到其他版本或所有后端组合。

### 怎么开

- **不需要开。** 装上 vllm-ascend 之后，vLLM 通过插件机制加载这个类，`_enum = PlatformEnum.OOT`（仓库外平台）；发现与激活过程见[插件注册](platform-plugin-registration.md)。身份字段都在类体顶部：`device_name` / `device_type` 为 `"npu"`，`ray_device_key = "NPU"`，`device_control_env_var = "ASCEND_RT_VISIBLE_DEVICES"`，`dispatch_key = "PrivateUse1"`，`simple_compile_backend = "eager"`（注释写的是 `# Disable torch.compile()`）。
- **配置前的准备：** `pre_register_and_update` 调 `adapt_patch(is_global_patch=True)` 装全局补丁，把 `ASCEND_QUANTIZATION_METHOD` 追加进 `--quantization` 的候选（所以 `--quantization ascend` 不是上游自带取值），再按 `is_310p()` 导入对应的量化配置类。GLM 的配置类型与模型实现不在这里登记：前者由[补丁](ascend-patch-system.md)模块补进上游的配置表，后者走通用的[模型插件登记](platform-plugin-registration.md)。注册一个量化名只表示后面解析配置时认得它，不表示模型能按这套量化跑起来——那还要求权重格式、模型实现、算子与硬件互相对得上。
- **调用时机：** `VllmConfig.__post_init__` 在构造末尾调 `current_platform.check_and_update_config(self)`；而默认调度预算在这之前、`EngineArgs` 里由 `_set_default_max_num_seqs_and_batched_tokens_args` 定好。两件事不在同一刻，是本页「拒答改变默认档」那条链的前提。
- **`check_and_update_config` 内部顺序**（`db701c1f` 第 450 行起）：两道早退 → `maybe_auto_detect_quantization` → 四个 `_validate_*` → `_fix_incompatible_config` → `init_ascend_config` → 日志与 KV 传输 id → 编译与 `cudagraph_mode` → `worker_cls` 三选一 → `refresh_block_size` → `custom_ops = ["all"]`（非 310P）→ 均衡调度、KV 载入失败策略、重算调度三条角色检查。

  两道早退见来源 7 第 453–463 行：存在 `device_config` 且其有效设备类型不是 `npu`，或缺少 `model_config`，都会直接返回，不执行后续昇腾配置更新；缺少模型配置时还会记录警告。设备配置若没有 `device_type` 属性，这里用平台自身的设备类型作为默认值。
- **块大小的通用规则：** `refresh_block_size` 在 `block_size is None` 时填 128，`deepseek_v4` 另有 32 / 64 / 128 的限制，`model_config.is_hybrid` 为真就直接返回，交给模型专属算法。另有 `update_block_size_for_backend`：仅当前缀缓存关闭、混合 KV 管理器启用、配置了 KV 传输且 `mamba_cache_mode == "align"` 时处理 Mamba 块；原值为空或等于最大模型长度就改成逻辑块大小，其他值则断言它是逻辑块大小的整数倍。
- **要更大的每步预算就显式写 `--max-num-batched-tokens`。** 官方 GLM 双机命令写的是 8192。
- **通用后端选择：** `get_attn_backend_cls` 以 `(use_mla, use_sparse, use_compress)` 查 `backend_map`：`(False, False, False)` 得 `AscendAttentionBackend`，`(True, False, False)` 得 `AscendMLABackend`，`(True, True, False)` 得 `AscendSFABackend`，`(True, False, True)` 得 `AscendDSABackend`；选定 `FLASH_ATTN` 且 `_validate_fa3_backend` 通过时返回 `AscendFABackend`；310P 走 `backend_map_310`。GLM 侧的直接绑定：`IndexerKPoolMLACacheLayer` 把 `self.attn_backend` 设成 `AscendIndexerKPoolMLABackend`；`AscendKimiGatedDeltaNetAttention.get_attn_backend` 返回 `AscendGDNAttentionBackend`。
- **其他「答名字」的接口：** `get_compile_backend` 返回 `AscendCompiler`（被写进 `compilation_config.oot_compiler`），`get_static_graph_wrapper_cls` 返回 `ACLGraphWrapper`，`get_device_communicator_cls` 返回 `NPUCommunicator`。

### 会报什么错

| 报错 | 触发条件 |
|---|---|
| `additional_config.layer_sharding can only be enabled in PD-disaggregated's P node.` | 配了层切分而 `kv_role` 不是 `kv_producer`（只在 v0.23） |
| `PCP (Prefill Context Parallelism) and DP (Data Parallelism) cannot be enabled simultaneously...` | `data_parallel_size > 1` 且 `prefill_context_parallel_size > 1` |
| `PP+MTP is only supported on PD-disaggregated P nodes (kv_role='kv_producer').` | MTP + `pipeline_parallel_size > 1`，且不在 producer 一侧 |
| `enable_balance_scheduling only supports PD-mixed mode...` | 开了均衡调度、存在 KV 传输配置，且 `kv_role` 不是 `kv_both` |
| `Hybrid models do not support recompute mode kv load failure policy now.` | `kv_load_failure_policy=recompute` 且模型是混合模型（断言） |
| `recompute_scheduler_enable can only be enabled on PD-disaggregated D nodes...` | 开了重算调度而角色不是 consumer；在 producer 上只警告并重置为关 |
| `ACL graph is incompatible with ASCEND_LAUNCH_BLOCKING=1.` | 图模式没关而环境里设了这个调试变量 |
| `Invalid draft model parallel config for speculative decoding: ...` | `decode_context_parallel_size > 1` 且草稿模型不是 MLA 时，三条头数约束任一不满足（草稿 TP 大于 KV 头数；DCP ≤ 草稿 TP ÷ KV 头数；每个 KV 头对应的 Q 头数能被 DCP 整除） |

在默认预算查询这条路径中，`NotImplementedError` 被 `except Exception` 捕获，容量占位值改为 0；其他调用点若没有相同的异常处理，仍会把异常向外传播。

### 开销和什么时候别开

本页没有平台钩子的耗时测量，不能据“启动时调用”就认定开销可忽略；配置对象也能被多次构造。排查时应区分注册、配置检查、硬件查询及后续所选组件的耗时。下面关注配置变化带来的后果。

- **不要靠删校验来验证组合。** 被拦的组合往往在更下游没有实现，删掉检查只会把报错推迟到运行时。
- **别把一个版本的报错当通用知识。** 校验数量与函数名三个版本都不同，见下表。
- **显式写了每步预算，就不要再按「默认值」推断行为**，反之也一样：删掉这个参数不会回到 8192。
- **310P 与 xlite 是另外两条 Worker 分支**，它们的行为不能套到常规 A2 路径上；本部署走的是常规分支。

- **缓存精度那条改写是跟着模型配置走的**，换模型要重新看，不能当成昇腾的全局默认。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`，GLM 专用镜像 `db701c1f` 同属此分支期）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）。**`v0.30.0` 与 `main` 均对 `get_device_total_memory` 实行守卫式查询：在 `EngineArgs` 解析默认值阶段 `torch_npu` 尚未初始化，仍抛出 `NotImplementedError("NPU total memory is unavailable before torch_npu initialization")`，使未显式设置 `--max-num-batched-tokens` 的在线 API 服务继续回落到小档起点 `2048`；`main` 在 `check_and_update_config` 入口首行直接调用 `apply_v2_model_runner_config_patch()` 锁定 MRV2。**

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| `check_and_update_config` 起始行与前置校验 | L450；4 个类方法（层切分 → 投机+DCP → 并行 → PD+PP+MTP） | L408；2 个类方法（投机+DCP → 并行），已移除层切分校验 | **L478**（`#L478-L525`）：先 `_validate_model_runner_config` / `indexer_pp` / `routing_replay` / `pcp_dcp` / `draft_dcp` / `parallel` / `engram`，再自动识别量化、`validate_turboquant` 与 FP8 能力断言 | **L606**（`#L606-L683`）：首行调用 `apply_v2_model_runner_config_patch()` 与 `sync_v2_extra_kwargs`，补齐 `compress_ratios` 兼容，新增 `_validate_glm5next_dflash2_pp_config`，退役 MRV1 专属校验 |
| 设备总显存查询 `get_device_total_memory` | 无条件抛 `NotImplementedError` | 无条件抛 `NotImplementedError` | 未初始化抛 `NotImplementedError`，初始化后读 `torch.npu.mem_get_info`（`#L232-L245`） | 延续守卫式查询（`#L260-L273`） |
| 未初始化抛错对默认 `max_num_batched_tokens` 的影响 | `arg_utils` 捕获异常置 `device_memory=0`，在线 API 服务默认回落小档起点 `2048` | 相同 | 上游新增 ≥160 GiB 档，但 `EngineArgs` 仍早于 `torch_npu` 初始化，抛错回落 `2048` 行为不变 | 延续回落 `2048`（`arg_utils.py#L2985-L3030`） |
| 并行与 CP 校验边界 | `DP > 1` 且 `PCP > 1` 才抛 | 未开 V2 runner 时 `PCP > 1` 即抛 | 延续 MRV1 拒绝 `PCP > 1` 与 routed-experts 返回；SFA C8 核对硬件能力，GQA/MQA 要求 `PCP == DCP`；非空 `num_speculative_tokens_per_batch_size` 在 MLA 放行前被拒；KVPP>1 交 `KVPPConfig` | 全量 MRV2 下走后端与 PCP 管理器校验；延续 PCP/DCP、草稿与 KVPP 约束 |
| 自动选 Worker | 方法内硬编码 310P / Xlite / `NPUWorker` | 同左 | 常规分支取 `HardwareProfile.default_worker_cls`（`#L1365-L1375`），Xlite 受能力与开关双门控 | 延续 `HardwareProfile.default_worker_cls`（`#L1570-L1580`） |

`v0.30.0` 与 `main` 对主模型和独立草稿模型分别校验，不能用主模型通过启动证明草稿拓扑合法；更多上下文并行边界见 [CP 页](context-parallel.md#版本差异)。GLM 专用镜像 `db701c1f` 的四个前置校验顺序、显存无条件拒答与 A2 Worker 选择与 `v0.23.0`（`2c59ff10`）一致，具体编译开关复位与重算调度复位细节见源码对照。

### 源码位置

| 看什么 | 去哪里 |
|---|---|
| 类本体、身份字段、各组方法 | `vllm_ascend/platform.py`，`class NPUPlatform` |
| 校验与改写的全部顺序 | 同上，`check_and_update_config` |
| 四个校验各自的条件 | 同上，`_validate_layer_sharding_config`、`_validate_draft_decode_context_parallel_config`、`_validate_parallel_config`、`_validate_pd_pp_mtp_config` |
| 通用块大小规则、混合模型跳过「改回 128」 | `vllm_ascend/utils.py`，`refresh_block_size` |
| 上游先填的默认块大小 16 | 上游 `vllm/config/cache.py`，`CacheConfig.DEFAULT_BLOCK_SIZE` 与 `_apply_block_size_default` |
| 全局补丁入口 | `vllm_ascend/utils.py`，`adapt_patch` |
| 混合模型的块大小算法 | `vllm_ascend/patch/platform/patch_mamba_config.py` |
| GLM 两类层的后端绑定 | `vllm_ascend/ops/indexer_kpool_mla.py`、`vllm_ascend/ops/kimi_kda.py` |
| 默认调度预算的档位与加减 | 上游 `vllm/engine/arg_utils.py`，`get_batch_defaults` 与 `_set_default_max_num_seqs_and_batched_tokens_args` |
| 平台校验的调用点 | 上游 `vllm/config/vllm.py`，`VllmConfig.__post_init__` |
| 补丁写 640 为什么早于平台 | 同上，`__post_init__` 先调 `try_verify_and_update_config`（混合模型配置检查），后调 `check_and_update_config` |
| 批式 DP 的 256 从哪来 | 上游 `vllm/model_executor/layers/fused_moe/config.py` 的 `max_num_tokens` 缺省值；删掉前的 `VLLM_MOE_DP_CHUNK_SIZE`（`vllm/envs.py`） |

**本页的条件性推导。** 将固定源码与部署参数合起来：常规 A2、未开 xlite 且 Worker 自动选择时，得到 NPUWorker；DP2 要求 PCP1；未配层切分、KV 传输和重算调度时，不触发相应角色限制；GLM 文本配置的 indexer top-k 字段触发缓存精度改写。官方命令显式写了 token 预算 8192 与请求数上限 32，默认值函数保留两者。只删掉 token 预算后，在前文列出的默认值和模型配置条件下，得到 min(32 × 133,120, 2048) = 2048。[D] 这份演算保留全部前提，不代替现场启动日志。

**来源与结论的对应。** 以下编号均指页头 sources：

- 身份字段、编译器和准备钩子见来源 1；平台调用与更早的预算构造见 2–3；设备总显存拒答及 Mamba 块更新的完整条件见 4。
- 前置校验见 5–7；缓存精度、编译与图模式见 8–10；Worker、块大小调用、算子开关和角色检查见 11，KV 载入失败策略的实际断言另见 42。
- 通用后端、FA3 检查及包装类见 12；块大小规则见 13；GLM 专用后端与 indexer top-k 配置分别见 14–16。
- 默认档位见 17；常量见 18；批式 DP 条件见 19；token 与请求数的两套独立调整条件见 20，均衡模式默认值见 54。MoE 缺省 token 数和旧分块参数分别见 30–31，不能从缺省值推出通信内核容量上限。
- 640 的写入时序见 27–29；默认分发后端与 chunked prefill 开关见 32–33，模型的 chunked prefill 能力判定见 46；多模态 prefix-LM 判定见 34，GLM 配置与元数据见 44–45；默认块大小 16 及其填充见 36–37。
- v0.23 的四项前置校验见 38；v0.26 rc 的两项校验与 Worker 分支见 21、53；main 的查询守卫、配置调用、并行限制、Worker 选择和 A2 默认类见 22–25、43；rc2 的主模型与草稿限制及实际入口调用见 40–41、52，初始化后容量查询见来源 56。
- 官方双机的 8192、32、0.85 等参数见来源 26，命令全文与镜像边界见[来源基线](../sources/glm-5-3-flash-baseline.md)。

**怎样确认现场值。** 公开配置已经给出了多模态架构和 prefix-LM 字段的情况，main 的 A2 硬件画像也明确写着常规 NPUWorker；但本页没有容器最终配置、删去预算参数后的启动日志或 NPU 实测。因此，2048 是上述条件下的代码推导，Worker 的类路径也不是该设备组合已成功运行的证明。

草稿的 MLA 判定要跟完整链，不能只看主模型名字：来源 55 构造草稿配置时传入覆盖函数，来源 47 的覆盖把草稿顶层类型改成 `glm5_next_mtp`；来源 48 按顶层类型选转换器，来源 35 只为 `glm5_next` / `glm5_next_text` 注册专用转换器，上游映射见 51。落到基类时，来源 34 的 MLA 名单也没有这些 GLM 类型；转换结果写入结构字段（来源 50），再由 `use_mla` 读取并叠加环境开关（来源 49）。按这组固定注册和构造路径，草稿不走 MLA 放行分支；本部署 DCP1 会在此判断之前返回，改成 DCP 大于 1 才需要继续核草稿头数约束。这仍是固定代码路径的判断，不是 DCP 部署通过记录。
