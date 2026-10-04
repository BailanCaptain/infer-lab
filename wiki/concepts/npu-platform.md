---
id: npu-platform
title: NPUPlatform：配置校验与设备实现选择
type: feature
summary: 昇腾插件交给 vLLM 的平台实现。启动时它按组合校验整份配置、就地改写，再答出 Worker 类、注意力后端与图包装的类名；也是「查不到设备显存以后默认 token 预算怎么定」的唯一推导处。
aliases: [NPUPlatform, platform.py, 平台类, 昇腾平台类, PlatformEnum.OOT, check_and_update_config, get_device_total_memory, get_attn_backend_cls, worker_cls, 默认 token 预算, 回退档, refresh_block_size]
chapters: ["10"]
order: 60
sources:
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L128-L206
  - vllm@0fc695fc:vllm/config/vllm.py#L1330-L1340
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2010-L2020
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L275-L331
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L338-L372
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L430-L448
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L480
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L500-L528
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L529-L634
  - vllm@0fc695fc:vllm/config/vllm.py#L1054-L1060
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L636-L700
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L886
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1446
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L74-L84
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L228-L234
  - vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L186-L192
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2300-L2335
  - vllm@0fc695fc:vllm/config/scheduler.py#L38-L64
  - vllm@0fc695fc:vllm/config/parallel.py#L642-L652
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2484-L2566
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L274-L426
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L225-L238
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L457-L495
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1491-L1502
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1239-L1248
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - vllm@0fc695fc:vllm/config/vllm.py#L850-L860
  - vllm@0fc695fc:vllm/config/vllm.py#L1880-L1905
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L150-L160
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1255-L1260
  - vllm@f7e62e3d:vllm/envs.py#L1143-L1148
  - vllm@0fc695fc:vllm/config/parallel.py#L175-L180
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2372-L2377
  - vllm@0fc695fc:vllm/transformers_utils/model_arch_config_convertor.py#L252-L308
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L30
  - vllm@0fc695fc:vllm/config/cache.py#L46
  - vllm@0fc695fc:vllm/config/cache.py#L231-L239
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L450-L480
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: vllm-platform-interface, kind: builds-on, note: 先理解平台契约：谁在问、当前平台怎么选出来}
  - {to: ascend-config-system, kind: builds-on, note: 配置的三路输入与优先级，本页只讲平台这一道校验与改写}
  - {to: attention-backend-family, kind: builds-on, note: 区分通用选择接口与 GLM 两类层的专用后端}
  - {to: npu-worker-lifecycle, kind: builds-on, note: 选出的 Worker 类接着做起卡、量显存、切块}
contradicts: []
updated: "2026-09-28"
origin: direct
---

## 你写在命令里的配置，为什么不是最后生效的那一份

**NPUPlatform 是昇腾插件交给 vLLM 的那份平台实现：启动时它把整份汇总配置过一遍——不支持的组合当场报错，该改的就地改掉——再在被问到时答出 Worker（管一张卡、执行前向的进程实现）、注意力后端、图包装这些「用哪个实现」的类名。** [Platform 契约](vllm-platform-interface.md)规定上游怎么问、当前平台怎么选出来；本页只讲昇腾这一侧答了什么、改了什么。

```wiki-diagram
file: platform-surface
```

图分三段，对应两个时刻。**校验和改写发生在启动时的同一次调用里**：上游把汇总配置（模型、并行、缓存等选项合成的那一个对象）交过来，平台先看几组组合能不能跑，不能就抛错、启动到此结束；能跑就直接修改这个对象——Worker 类名写进并行配置，缓存精度写进缓存配置，块大小按通用规则补齐或改回 128（混合模型保留更早写入的值）。**答名字发生在稍后**：Worker 起卡、模型建层的时候，才有人拿着「这层是不是 MLA、是不是稀疏」来问该用哪个注意力后端。图右下角那条虚线是例外：GLM 的两类注意力层在自己的算子实现里写死了后端，不查平台这张表。

## 为什么这层非要能改配置，代价在哪

先看一个真实的数：官方双机命令里只有通用参数——显存预算比例、每步 token 预算、每步请求数上限、单请求长度上限这些，没有 `--block-size`。而本部署实际用的逻辑块是 640 个 token。这个值不是平台这一步写的，而是由更早一步的[补丁](ascend-patch-system.md)写入：上游构造汇总配置时，先跑混合模型（一部分层用全注意力、一部分层用[线性注意力](linear-attention.md)）的配置检查，昇腾换进去的那一版把块大小写成 640；平台在更晚的时候才被调用，它负责的是**不把 640 改回 128**——通用规则里「块大小不是 128 就改回 128」那一条，遇到混合模型会跳过。算法与 640 的来历见[部署页那一节](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。如果平台只能「报属性」，这类值就得用户自己对着源码配，一处配错就是启动失败或性能异常。

代价是三条，后面三节各讲一条：

1. **输入值和生效值分家。** 排查「我配了怎么没效果」要多看一层：先确认平台这一步有没有把它改掉，再去看消费者。配置本身的三路输入和优先级在[昇腾配置体系](ascend-config-system.md#解析完还会被改写生效值不是你写的值)。
2. **校验是跟着版本走的。** 建配置之前的校验数量三个版本分别是四个、两个、三个（main 上是一个类方法加两个模块级函数），所以同一个键会在一个版本上被拦下、到另一个版本上压根不存在：层切分那个键在 v0.23 上有专门的校验，到 v0.26 已经删掉（对照见[那一页的版本差异](ascend-config-system.md#版本差异)）。拿一个版本的报错去另一个版本搜函数名会搜不到。
3. **「拒答」也是一种行为。** 设备总显存这个查询接口，昇腾故意不实现；一个不回答的问题改变了上游默认调度预算的档位，这是本页专门要讲清的一条链。

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

**选 Worker 类。** 只有当并行配置里的 Worker 类写着「自动」时才选，三条分支互斥：310P 设备走 310P 专用 Worker；开了 xlite 执行模式走 xlite Worker；其余走常规的 NPUWorker。

**定块大小。** 通用规则有两条：块大小空着就先填 128（上游构造缓存配置 `CacheConfig` 时，它的 after 校验器已把空着的块大小填成类常量 `DEFAULT_BLOCK_SIZE = 16`，所以这条是兜底）；已设的值不是 128、且开了前缀缓存或 chunked prefill，就强制改回 128。混合模型只跳过后一条，连同 xlite 模式下「不超过 128」的限制——所以补丁更早写进的 640 能留下来。同一个词在这套部署里有五种含义，逻辑块、kernel 块、各缓存组的块和调度器的块都不是一个数，消歧表在[缓存规格](kv-cache-spec.md)。

**最后三条按 PD 角色的检查。** 均衡调度只允许 PD 混合角色或没配 KV 传输，显式的 producer / consumer 角色直接报错；KV 载入失败策略选重算时，混合模型断言失败；重算调度在 producer 上只警告并被重置为关，在既不是 producer 也不是 consumer 时报错。这三条说明同一个开关的含义依赖周围配置，不能逐个独立打开就认为组合成立。

## 默认预算为何不能只看一个数字

这里说的预算是**调度预算**：一步最多收多少个 token 参与计算，它限制的是工作量，不是显存（调度侧怎么用它见[调度器](vllm-scheduler.md)）。用户不写这个参数时，它的默认值是上游按硬件挑一档，而挑档要先问平台一句话，链条有三段。

**第一段：平台被问显存，选择不答。** 上游在把各项选项汇总成配置对象之前，先把这个默认值定下来。定的时候它调平台的「这块设备总共多少字节显存」，昇腾的固定实现一律抛不支持，注释写明理由：实现它会顺带把设备运行库提前拉起来，而这个库在一个进程里只许初始化一次，提前拉起来会让后面正式初始化出错。上游把异常吞掉，按 0 字节继续往下算。

**第二段：按容量选档，另有一条批式 DP 入口。** 容量不小于 70 GiB 且设备名里没有 a100，选大档：库调用方式 16384、API 服务方式 8192；否则选小档：8192 与 2048。昇腾因为查不到容量，永远落在小档——**原因是这个查询被拒绝，不是卡的显存不够**。对照一下：同一条命令放到 H100 上（显存不小于 70 GiB、设备名不含 a100，上游源码注释点名 H100 和 MI300x 走大档），API 服务方式默认 8192；昇腾因为拒答，落到 2048。

另外有一条不看档位的入口：当专家分发后端是低时延 DeepEP 或 NIXL EP 这两种之一、开了专家并行、且数据并行大于 1 时，上游判定为「批式 DP MoE」，预算直接取 256 这个常量；它和档位表是两条互斥的路。256 的出处在上游代码里：同一个常量也是 MoE 层配置里「一步最多派发多少 token」的缺省值；它是在上游删掉旧的「MoE DP 分块」时引入的，旧分块参数的缺省值正是 256，注释写明在数据并行 + 专家并行 + 批式 all-to-all 分发下，每个数据并行组以 256 个 token 为单位派发。所以预算取 256，是让一步的 token 数不超过批式分发一次装得下的量——这是把这几处代码合起来得出的推论，上游没有直接写出理由。

**第三段：选出的档还会被加减四次。** 吞吐模式把预算和请求数上限各翻一倍；没开 chunked prefill（把长提示词拆成几步送）时，预算被抬到至少等于单请求长度上限；多模态模型另有自己的最小值；最后按「请求数上限 × 单请求长度上限」收窄，请求数上限再按预算收窄。缺省常量本身也有三个：预算 2048、批式 DP 的 256、请求数上限 128。

**整条链上有一道闸门，但它不在链的入口。** 问显存、拒答、选档每次启动都照常发生，不管用户写没写这个参数；闸门挡的是后面：只有用户没显式写时，选出的档才被写进去，翻倍、抬升、收窄也同样被这道闸门挡住。显式写了，选出的档就被丢弃，用户写的值原样生效。

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

**预算那一行反过来：平台的拒答在本部署里不产生后果。** 官方命令显式写了每步 8192 个 token（同时写了每步请求数上限 32、显存预算比例 0.85）。上一节的问显存、拒答、选小档照样发生，但选出的档被丢弃，不翻倍、不抬升、不收窄，生效的就是 8192。拒答只有在把这个参数从命令里删掉时才显出后果，按源码可以推一遍：命令没设专家分发后端，用的是默认的 allgather/reducescatter，不进批式 DP 那条路；API 服务方式在小档上起点是 2048；默认是均衡模式，不翻倍；chunked prefill 命令没写、按模型能力默认开着，不抬升；最后收窄取 min(32 × 133,120, 2048) = 2048。所以删掉之后大约是 **2048**，不是 8192。没核死的只有多模态 prefix-LM 那道下限：它要求模型既按多模态架构加载、又被判成 prefix-LM；按上游名单和 GLM 的配置类，GLM 不算 prefix-LM，这道下限不触发。例外是模型自带的配置文件里另写了这个开关字段并设为真，上游会优先读它；配置文件里有没有这个字段，列在页末清单里。[平台契约页](vllm-platform-interface.md#主机内存设备显存和-token-预算怎样分账)给的是同一个结论，完整链条只在本页推导。

**并行那条校验对本部署是硬约束。** 这里 DP 是 2，所以 prefill 侧上下文并行只能是 1；想开它就得先放弃 DP，而 DP2 是这套双机部署分派请求的方式。

读完可以沿三个结果继续往下走：Worker 类名进 [Worker 启动](npu-worker-lifecycle.md)，块大小与缓存精度进[状态池分配](vllm-kv-block-allocation.md)，后端类名进各层的注意力执行。组合通过校验只说明能进下一阶段，不等于模型已经跑起来。

## 常见误解

- **「平台只是一张属性表，读一读就知道硬件能干什么」**——它同时会拒绝组合、就地改写配置。命令里写的值和最终生效的值可以不同，排查要先确认这一层改过什么。
- **「查不到设备显存是个 bug」**——是故意不实现的：实现它会让设备运行库提前初始化，而它一个进程只许初始化一次。开发主线上运行库起来之后已经能答，但定默认预算的那一刻它还没起来，三个版本的档位结果一样。
- **「昇腾默认每步只收 2048 个 token」**——2048 只是 API 服务方式在小档上的起点，后面还有翻倍、抬升、收窄四道加减；并且选档照常发生，选出的值只在没显式写这个参数时才生效，本部署显式写了 8192。
- **「注意力后端在通用映射里挑一个名字就是 GLM 的实现」**——GLM 的稀疏 MLA 层与 KDA 层都在自己的算子实现里绑定专用后端，不查那张表。
- **「平台把 PyTorch 的编译关了，说明昇腾不支持 graph mode」**——关掉的只是上游那条默认编译路，昇腾自己的编译器类和图包装类是平台另外两个回答给出的。
- **「校验通过就说明这套配置能部署」**——通过只说明能进下一阶段；权重格式、算子、硬件是否相符要到 Worker 加载模型时才见分晓。

## 对照源码

### 怎么开

- **不需要开。** 装上 vllm-ascend 之后，vLLM 通过插件机制加载这个类，`_enum = PlatformEnum.OOT`（仓库外平台）；发现与激活过程见[插件注册](platform-plugin-registration.md)。身份字段都在类体顶部：`device_name` / `device_type` 为 `"npu"`，`ray_device_key = "NPU"`，`device_control_env_var = "ASCEND_RT_VISIBLE_DEVICES"`，`dispatch_key = "PrivateUse1"`，`simple_compile_backend = "eager"`（注释写的是 `# Disable torch.compile()`）。
- **配置前的准备：** `pre_register_and_update` 调 `adapt_patch(is_global_patch=True)` 装全局补丁，把 `ASCEND_QUANTIZATION_METHOD` 追加进 `--quantization` 的候选（所以 `--quantization ascend` 不是上游自带取值），再按 `is_310p()` 导入对应的量化配置类。GLM 的配置类型与模型实现不在这里登记：前者由[补丁](ascend-patch-system.md)模块补进上游的配置表，后者走通用的[模型插件登记](platform-plugin-registration.md)。注册一个量化名只表示后面解析配置时认得它，不表示模型能按这套量化跑起来——那还要求权重格式、模型实现、算子与硬件互相对得上。
- **调用时机：** `VllmConfig.__post_init__` 在构造末尾调 `current_platform.check_and_update_config(self)`；而默认调度预算在这之前、`EngineArgs` 里由 `_set_default_max_num_seqs_and_batched_tokens_args` 定好。两件事不在同一刻，是本页「拒答改变默认档」那条链的前提。
- **`check_and_update_config` 内部顺序**（`db701c1f` 第 450 行起）：两道早退 → `maybe_auto_detect_quantization` → 四个 `_validate_*` → `_fix_incompatible_config` → `init_ascend_config` → 日志与 KV 传输 id → 编译与 `cudagraph_mode` → `custom_ops = ["all"]`（非 310P）→ `worker_cls` 三选一 → `refresh_block_size` → 均衡调度、KV 载入失败策略、重算调度三条角色检查。
- **块大小的通用规则：** `refresh_block_size` 在 `block_size is None` 时填 128，`deepseek_v4` 另有 32 / 64 / 128 的限制，`model_config.is_hybrid` 为真就直接返回，交给模型专属算法。另有 `update_block_size_for_backend`：`mamba_cache_mode == "align"` 时把 mamba 块对齐到逻辑块，并断言前者是后者的整数倍。
- **要更大的每步预算就显式写 `--max-num-batched-tokens`。** 官方 GLM 双机命令写的是 8192。
- **通用后端选择：** `get_attn_backend_cls` 以 `(use_mla, use_sparse, use_compress)` 查 `backend_map`：`(False, False, False)` 得 `AscendAttentionBackend`，`(True, False, False)` 得 `AscendMLABackend`，`(True, True, False)` 得 `AscendSFABackend`，`(True, False, True)` 得 `AscendDSABackend`；选定 `FLASH_ATTN` 且 `_validate_fa3_backend` 通过时返回 `AscendFABackend`；310P 走 `backend_map_310`。GLM 侧的直接绑定：`IndexerKPoolMLACacheLayer` 把 `self.attn_backend` 设成 `AscendIndexerKPoolMLABackend`；`AscendKimiGatedDeltaNetAttention.get_attn_backend` 返回 `AscendGDNAttentionBackend`。
- **其他「答名字」的接口：** `get_compile_backend` 返回 `AscendCompiler`（被写进 `compilation_config.oot_compiler`），`get_static_graph_wrapper_cls` 返回 `ACLGraphWrapper`，`get_device_communicator_cls` 返回 `NPUCommunicator`。

### 会报什么错

| 报错 | 触发条件 |
|---|---|
| `additional_config.layer_sharding can only be enabled in PD-disaggregated's P node.` | 配了层切分而 `kv_role` 不是 `kv_producer`（只在 v0.23） |
| `PCP (Prefill Context Parallelism) and DP (Data Parallelism) cannot be enabled simultaneously...` | `data_parallel_size > 1` 且 `prefill_context_parallel_size > 1` |
| `PP+MTP is only supported on PD-disaggregated P nodes (kv_role='kv_producer').` | MTP + `pipeline_parallel_size > 1`，且不在 producer 一侧 |
| `enable_balance_scheduling only supports PD-mixed mode...` | 开了均衡调度而 `kv_role` 不是 `kv_both` |
| `Hybrid models do not support recompute mode kv load failure policy now.` | `kv_load_failure_policy=recompute` 且模型是混合模型（断言） |
| `recompute_scheduler_enable can only be enabled on PD-disaggregated D nodes...` | 开了重算调度而角色不是 consumer；在 producer 上只警告并重置为关 |
| `ACL graph is incompatible with ASCEND_LAUNCH_BLOCKING=1.` | 图模式没关而环境里设了这个调试变量 |
| `Invalid draft model parallel config for speculative decoding: ...` | `decode_context_parallel_size > 1` 且草稿模型不是 MLA 时，三条头数约束任一不满足（草稿 TP 大于 KV 头数；DCP ≤ 草稿 TP ÷ KV 头数；每个 KV 头对应的 Q 头数能被 DCP 整除） |

设备总显存那条路上的 `NotImplementedError` 不会冒到用户面前：上游用 `except Exception` 吞掉，把容量当成 0。

### 开销和什么时候别开

平台这一层本身的开销可以忽略：每个进程一次校验与改写，之后只是几个返回类名的调用。要权衡的是它带来的间接后果。

- **不要靠删校验来验证组合。** 被拦的组合往往在更下游没有实现，删掉检查只会把报错推迟到运行时。
- **别把一个版本的报错当通用知识。** 校验数量与函数名三个版本都不同，见下表。
- **显式写了每步预算，就不要再按「默认值」推断行为**，反之也一样：删掉这个参数不会回到 8192。
- **310P 与 xlite 是另外两条 Worker 分支**，它们的行为不能套到常规 A2 路径上；本部署走的是常规分支。
- **缓存精度那条改写是跟着模型配置走的**，换模型要重新看，不能当成昇腾的全局默认。

### 版本差异

按知识库固定快照核对：v0.23 列是 vllm-ascend 维护分支 2c59ff10，v0.26 列是 2ed6cbba，main 列是 baa023ad。**本部署跑的专用镜像 db701c1f 是另一个 orphan commit，不算进 v0.23 列：GLM 的模型代码与配置 patch 只在镜像里，2c59ff10 上只有两个 GLM 工具调用 patch。**下表 v0.23 列按 2c59ff10 写；平台文件在两者之间只差第 596 行之后几处编译开关复位和一处重算调度复位，下表各行（含起始行 450、四个校验的顺序）在镜像上完全相同。

| 项 | v0.23 | v0.26 | main | 意味着什么 |
|---|---|---|---|---|
| 建配置前的校验 | 四个类方法：层切分 → 投机 + DCP → 并行 → PD+PP+MTP | 两个：投机 + DCP → 并行 | 三个：一个类方法（索引器与流水线并行）加两个模块级函数（投机 + DCP、并行） | 拿一个版本的报错去另一个版本搜函数名会扑空 |
| 层切分这个键 | 有，只许在 producer 一侧 | 平台这一侧已无此校验 | 同样已无 | 同一个键，一个版本被拦、另一个版本压根不存在 |
| 设备总显存查询 | 无条件抛不支持 | 无条件抛不支持 | 运行库已初始化就返回真实容量，否则照抛 | 定默认预算那一刻运行库还没起来，三版都落小档 |
| 并行那条校验拦什么 | 数据并行大于 1 且 prefill 侧上下文并行大于 1 才抛 | 只要没开 v2 model runner，prefill 侧上下文并行大于 1 就抛 | 条件同 v0.26，另加一条 KVPP 检查 | 同一个参数在新版本上更早被拦，和 DP 开不开无关 |
| 自动选 Worker | 三条分支写在方法里：310P / xlite / NPUWorker | 同左结构 | 常规分支改由硬件画像给出默认 Worker 类，xlite 仍是单独分支 | main 上「常规选哪个 Worker」要先看硬件画像 |
| `check_and_update_config` 的起始行 | 450 | 408 | 457 | 行号三版都不同，所以本页来源一律写成「仓库@commit:路径#行号区间」 |

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

**本页的推论。** 以下结论由源码条件与本部署参数合成，不是某一行源码的直接引用：本部署既不是 310P、也没开 xlite，所以自动选 Worker 时落在常规分支 [D]；这里 DP 是 2，所以 prefill 侧上下文并行只能留在 1 [D]；本部署没开 PD 分离，所以层切分校验与三条角色检查都不触发 [D]；GLM 的文本配置带 indexer 的 top-k 字段，所以缓存精度那条改写对本部署生效 [D]；官方命令显式写了每步预算，所以选出的小档被丢弃、三道加减不发生，8192 原样生效 [D]；把这个参数从命令里删掉，按默认分发后端、均衡模式、chunked prefill 默认开、请求数上限 32、单请求长度上限 133,120 推，得到 min(32 × 133,120, 2048) = 2048 [D]（未实测，见待核）；GLM 的 MTP 草稿会不会被判成 MLA 不影响本部署（DCP 是 1），但决定了开 DCP 时投机 + DCP 那条会不会拦，见待核。

**正文证据归档。** 身份字段、编译后端与配置前的准备：[C1]；上游在配置构造末尾调用平台：[C2]，默认预算在这之前就定好：[C3]；设备总显存拒答与注释理由、按后端对齐 mamba 块的断言：[C4]；层切分、并行、投机加上下文并行这三个校验的条件：[C5]，PD 加流水线并行加 MTP 那一个：[C6]；校验与改写的顺序、两道早退、量化识别、建昇腾配置：[C7]；编译与图模式、缓存精度改写：[C8]，GLM 配置里的 indexer top-k 字段：[C14]；调试变量冲突、Worker 三选一、块大小调用、自定义算子与三条角色检查：[C9]，通用块大小规则与混合模型跳过：[C11]；通用后端映射、FA3 与 310P 分流、图包装类与通信器类：[C10]，GLM 两类层的后端绑定：[C12][C13]。档位门槛与两档取值：[C15]；三个缺省常量：[C16]；批式 DP MoE 的判定条件：[C17]；选档无条件发生、赋值与四道加减被「未显式设置」闸住：[C18]，H100 与 MI300x 走大档的注释在来源 15。补丁先于平台把块大小写成 640：来源 25–27；批式 DP 的 256 的出处：来源 28–29；删掉预算参数后的推导用到的默认分发后端、chunked prefill 默认值与 prefix-LM 判定：来源 30–32；插件只为 GLM 主模型登记 MLA 判定：来源 33。三版设备显存查询、v0.26 的校验数量与并行那条的条件：[C19][C20]；main 上校验的函数形态：[C21]，它的并行校验条件：[C22]；main 改由硬件画像给出常规 Worker 类：[C23]。官方双机命令显式写的每步预算、请求数上限与显存比例：[S24]，命令全文见[来源基线](../sources/glm-5-3-flash-baseline.md)。

**待核：** 缺这套硬件上的实测——删掉 `--max-num-batched-tokens` 之后启动日志里的实际预算值，以及 main 分支上硬件画像给出的常规 Worker 类在 A2 上的取值；两条都只按源码推导，没有在 NPU 上跑过。删掉预算参数后得 2048 这个推导，还缺一项：模型自带的配置文件里有没有 `is_mm_prefix_lm` 字段（有且为真，多模态下限可能把预算抬高；上游读法见 `vllm@0fc695fc:vllm/transformers_utils/model_arch_config_convertor.py#L293-L296`）。这道下限同时要求按多模态架构加载（`vllm@0fc695fc:vllm/engine/arg_utils.py#L2530-L2544`），插件对 GLM 同时登记了纯文本的 `Glm5NextForCausalLM` 和多模态的 `Glm5NextForConditionalGeneration`（`vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L12-L16`），走哪个由配置文件的 `architectures` 字段决定，也要一并查。另一项：GLM 的 MTP 草稿会不会被判成 MLA——静态看，草稿的模型类型被改成 `glm5_next_mtp`，它既不在上游的 MLA 名单里，插件也只给 `glm5_next` 和 `glm5_next_text` 登记了 MLA 判定，按这个读法草稿不算 MLA，开 DCP 时会被投机 + DCP 那条按头数检查；没有实跑确认。
