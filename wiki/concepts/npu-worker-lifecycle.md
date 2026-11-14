---
id: npu-worker-lifecycle
title: NPUWorker 启动：一张卡按什么顺序准备好接请求
type: feature
summary: >-
  每张 NPU 上有一个 NPUWorker。启动时它先换补丁、选卡建通信组、装本卡那份权重、试跑量出 KV cache 预算；EngineCore
  收齐各卡的数、按最紧的那张卡定块数并发回配置后，每张卡再建缓存池，最后预热并录 decode
  图。每一步用到上一步的产物，所以顺序固定。预算怎么扣、块怎么借、系统怎么分层各有专页，本页只讲这条先后链。
aliases:
  - NPUWorker
  - WorkerBase
  - Worker 生命周期
  - worker 启动
  - 启动时序
  - Worker 启动顺序
  - init_device
  - load_model
  - initialize_from_config
  - compile_or_warm_up_model
  - 六步启动
  - load_format
  - load-format
  - '--load-format'
  - 权重加载格式
  - safetensors_load_strategy
  - '--safetensors-load-strategy'
  - trust_remote_code
  - '--trust-remote-code'
  - 模型解析
  - hf_overrides
  - model_impl
  - tokenizer_revision
  - code_revision
chapters:
  - '10'
order: 110
sources:
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L90-L133'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L447-L503'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L521'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L988'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L668-L691'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L894-L905'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L789'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L626-L634'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L236-L317'
  - 'vllm@0fc695fc:vllm/v1/executor/abstract.py#L118-L126'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3717-L3795'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_process_weights_after_loading.py#L18-L64
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L136-L191'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/weight_utils.py#L801-L1027'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1545-L1551'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L162-L162'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L706-L798'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_process_weights_after_loading.py#L18-L21
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_weight_utils.py#L36-L74'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L748-L778'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/model_executor/warmup/kernel_warmup.py#L36-L49
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L549-L620'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1129-L1138'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L300-L322'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L156-L162'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2018-L2018'
  - >-
    raw:sha256-2591dc384678a937fe68a029644482014f40962be3f0c3e3f16bc30685fc3704.md#L1-L1135
  - 'vllm@0fc695fc:vllm/config/load.py#L25-L85'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/__init__.py#L34-L132'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/default_loader.py#L97-L209'
  - 'vllm@568afb3a:vllm/config/load.py#L14-L85'
  - 'vllm@568afb3a:vllm/model_executor/model_loader/__init__.py#L33-L66'
  - 'vllm@568afb3a:vllm/model_executor/model_loader/default_loader.py#L128-L242'
  - 'vllm@84030bbe:vllm/config/load.py#L25-L85'
  - 'vllm@84030bbe:vllm/model_executor/model_loader/__init__.py#L33-L66'
  - 'vllm@84030bbe:vllm/model_executor/model_loader/default_loader.py#L128-L242'
  - 'vllm@0fc695fc:vllm/config/model.py#L140-L155'
  - 'vllm@568afb3a:vllm/config/model.py#L140-L155'
  - 'vllm@84030bbe:vllm/config/model.py#L150-L185'
  - 'vllm@568afb3a:vllm/model_executor/model_loader/weight_utils.py#L840-L974'
  - 'vllm@84030bbe:vllm/model_executor/model_loader/weight_utils.py#L866-L1000'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L491-L506'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L837-L858'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L1178-L1221'
  - >-
    vllm-ascend@7d825229:vllm_ascend/model_executor/warmup/kernel_warmup.py#L39-L53
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L266-L275'
  - 'vllm@ced6857a:vllm/config/load.py#L30-L66'
  - 'vllm@ced6857a:vllm/config/model.py#L167-L167'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/weight_utils.py#L888-L939'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/__init__.py#L50-L66'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/default_loader.py#L186-L230'
  - 'vllm@84030bbe:vllm/model_executor/model_loader/utils.py#L147-L155'
  - 'vllm@84030bbe:vllm/model_executor/layers/attention/__init__.py#L26-L30'
  - 'vllm@ced6857a:vllm/config/load.py#L12-L96'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/weight_utils.py#L866-L1000'
  - 'vllm@ced6857a:vllm/config/model.py#L163-L169'
  - 'vllm@ced6857a:vllm/config/model.py#L628-L637'
  - 'vllm@ced6857a:vllm/config/model.py#L1705-L1721'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L557-L657'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L837-L970'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/attention.py#L301-L321'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/utils.py#L146-L158'
  - 'vllm@ced6857a:vllm/model_executor/layers/attention/__init__.py#L26-L30'
  - 'vllm-ascend@7d825229:vllm_ascend/model_executor/warmup/kernel_warmup.py#L1-L53'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L1171-L1221'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/__init__.py#L33-L66'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/default_loader.py#L128-L230'
  - 'vllm@ced6857a:vllm/v1/executor/multiproc_executor.py#L662-L686'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L284-L356'
  - 'vllm@ced6857a:vllm/v1/executor/abstract.py#L120-L135'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/default_loader.py#L110-L126'
  - 'vllm@0fc695fc:vllm/transformers_utils/config.py#L689-L874'
  - 'vllm@0fc695fc:vllm/transformers_utils/config.py#L206-L302'
  - 'vllm@0fc695fc:vllm/model_executor/models/registry.py#L1064-L1264'
  - 'vllm@0fc695fc:vllm/config/model.py#L489-L560'
  - 'vllm@0fc695fc:vllm/tokenizers/registry.py#L196-L279'
  - 'vllm@0fc695fc:vllm/tokenizers/hf.py#L160-L215'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/default_loader.py#L293-L317'
  - 'vllm@568afb3a:vllm/transformers_utils/config.py#L688-L813'
  - 'vllm@568afb3a:vllm/model_executor/models/registry.py#L1122-L1322'
  - 'vllm@568afb3a:vllm/config/model.py#L506-L572'
  - 'vllm@568afb3a:vllm/tokenizers/registry.py#L181-L266'
  - 'vllm@568afb3a:vllm/model_executor/model_loader/default_loader.py#L326-L350'
  - 'vllm@ced6857a:vllm/transformers_utils/config.py#L757-L886'
  - 'vllm@ced6857a:vllm/model_executor/models/registry.py#L1217-L1423'
  - 'vllm@ced6857a:vllm/config/model.py#L553-L641'
  - 'vllm@ced6857a:vllm/tokenizers/registry.py#L203-L321'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/default_loader.py#L326-L350'
  - 'vllm@84030bbe:vllm/transformers_utils/config.py#L748-L877'
  - 'vllm@84030bbe:vllm/model_executor/models/registry.py#L1208-L1414'
  - 'vllm@84030bbe:vllm/config/model.py#L553-L641'
  - 'vllm@84030bbe:vllm/tokenizers/registry.py#L203-L321'
  - 'vllm@84030bbe:vllm/model_executor/model_loader/default_loader.py#L326-L350'
  - 'vllm@ced6857a:vllm/transformers_utils/repo_utils.py#L52-L87'
  - 'vllm@84030bbe:vllm/transformers_utils/repo_utils.py#L52-L87'
  - 'vllm@ced6857a:vllm/transformers_utils/repo_utils.py#L93-L125'
  - 'vllm@0fc695fc:vllm/transformers_utils/repo_utils.py#L204-L222'
  - 'vllm@0fc695fc:vllm/transformers_utils/repo_utils.py#L245-L341'
  - 'vllm@0fc695fc:vllm/config/model.py#L125-L189'
  - 'vllm@0fc695fc:vllm/config/model.py#L271-L315'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/utils.py#L40-L94'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/utils.py#L178-L234'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/base_loader.py#L43-L85'
  - 'vllm@0fc695fc:vllm/model_executor/model_loader/__init__.py#L133-L148'
  - 'vllm@568afb3a:vllm/config/model.py#L127-L189'
  - 'vllm@568afb3a:vllm/config/model.py#L273-L328'
  - 'vllm@ced6857a:vllm/config/model.py#L142-L214'
  - 'vllm@ced6857a:vllm/config/model.py#L309-L368'
  - 'vllm@84030bbe:vllm/config/model.py#L142-L214'
  - 'vllm@84030bbe:vllm/config/model.py#L309-L368'
  - 'https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/docs/configuration/model_resolution.md#L1-L23'
  - 'https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/docs/design/huggingface_integration.md#L1-L31'
  - 'https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/docs/models/supported_models.md#L1-L210'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L779-L858'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1565-L1629'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0rc2
  - main
evidence: C
relations:
  - to: engine-processes
    kind: builds-on
    note: Worker 在哪个进程里、每个 EngineCore 起几个 Worker，由执行器决定
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 第四步量预算时每一项怎么扣、为什么试跑两次，推导在那一页
  - to: kv-cache-spec
    kind: builds-on
    note: 第五步按缓存配置分配张量，每层每页的形状由规格决定
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 启动只建好池子，请求来了才从池里借块、用完归还
  - to: graph-mode-layer
    kind: builds-on
    note: 第六步录下的图，运行时怎样被选中和回放
contradicts: []
updated: 2026-11-10T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-2591dc384678a937fe68a029644482014f40962be3f0c3e3f16bc30685fc3704.md
  - >-
    raw/sha256-ce73fe4f9a70a8b33634bccdddc0b84b99c25b5c54958d90f8c18d317dea45da.md
---

## 一张卡上的 Worker，启动时按什么顺序做准备？

**NPUWorker 是 vllm-ascend 里管一张 NPU 的执行角色：每张卡一个，启动时把这张卡准备好，之后替引擎执行每一步前向。它按固定顺序做六件事：换补丁、选卡并建通信组、装权重、量出能给 KV cache 的显存、按引擎发来的配置建缓存池、预热并录图。后一步要用前一步的产物，所以顺序不能换。**

几个词先说清楚。KV cache 是每条请求已经算过的历史状态，后面每一步前向都要接着读，见 [KV cache](kv-cache.md)。通信组约定哪几张卡一起做同一次集合通信，见[通信基础](collective-communication.md)。录图是把一次前向的算子序列预先录下来，之后按同样的尺寸照着回放，省掉逐个下发算子的开销。EngineCore 是负责调度、分配 KV 块的引擎进程，管着一组一起执行前向的卡；本部署两台机器各一个，各管本机的卡。

这些准备把开销提前到了启动期：读权重占用存储带宽与主机内存，试跑和录图要真的执行模型；同组有一张卡没准备好，其余卡也要等。批量上限或并行布局变了，预算和执行图就要重新准备，不能只沿用上次启动的数字。

```wiki-diagram
file: worker-lifecycle
```

图里画三个 Worker，代表「每张卡一个」；有几张卡就有几个，各自走同一条路。横跨各列的汇总框是管这几张卡的那一个 EngineCore。图中重点标出两处启动协调；试跑和录图中的集合通信也需要同组成员配合：

- **第②步，同组的 Worker 要到齐。** 通信组要所有成员都报到才建得成，一张卡没起来，别的卡就卡在这一步。
- **第④步之后，要等 EngineCore 汇总。** 每个 Worker 只报「我还能给 KV cache 多少显存」；EngineCore 收齐后统一可调度的块数，把各卡对应的缓存配置发回，每张卡才开始第⑤步。本页同一张量并行组（TP：多卡合算同一批、各持部分权重）的布局相同；流水线并行（PP：按层分成多个执行阶段）中，各阶段负责的层不同时，各卡配置可以不同。

六步各自留下什么：

1. **换补丁。** 在本进程里把上游 vLLM 的一部分函数换成昇腾版，注册昇腾自己的算子（在 NPU 上真正执行的一小段计算），读入昇腾的配置。从这以后，本进程跑的都是换过的代码。补丁只对当前进程生效，所以每个 Worker 进程都要各换一遍，见[进程与补丁](engine-processes.md#补丁和配置为什么要每个进程各做一遍)。
2. **选卡，建通信组。** Worker 绑定自己那张卡，先拍一张显存快照，记下这时还空着多少；再用 HCCL（昇腾的集合通信库，见 [CANN 与 HCCL](cann-hccl.md)）建通信组；最后建 [ModelRunner](npu-model-runner.md)，它负责组织每一步的输入、调用模型、管理 KV 张量。ModelRunner 要知道用哪张卡，所以只能在选卡之后建。

3. **装权重。** 从权重文件里读出本卡分到的那一份，拷进显存，再换成昇腾算子要的存储布局。本部署未启用运行期权重更新，后续请求复用这些权重。
4. **量预算。** 用假数据按一步的上限试跑一次前向，量出临时张量最多占多少；再拿「总显存 × 显存比例」减去权重、这个峰值和不经 PyTorch 分配的占用，剩下的就是 KV cache 的预算。每一项怎么扣，见 [KV cache 显存预算](kv-cache-memory-profiling.md)。

5. **建缓存池。** 按 EngineCore 发回的缓存配置，把 KV cache 的张量一次分配出来。池里有多少块从这里起固定；哪条请求用哪几块，是请求来了之后才借的，见 [KV 块分配](vllm-kv-block-allocation.md)。
6. **预热，录图。** 先按预热列表里的尺寸各跑一次假前向，把第一次执行才做的准备提前做掉；再按固定的几个尺寸录下 decode 步的图，见[图执行](graph-mode-layer.md)。decode 是逐步生成新 token 的阶段，每一步每个请求只算很少几个新位置；prefill 则是处理提示词并建立历史状态的阶段，可以分多轮完成。


Worker 是一个角色，它是不是单独占一个进程，由执行器决定；本部署用多进程执行器，每个 Worker 是一个独立进程，见 [executor 决定 Worker 是不是独立进程](engine-processes.md#executor-决定-worker-是不是独立进程)。六步走完以后，每一步的调度计划怎样从 EngineCore 发到各个 Worker、再交给 ModelRunner，见[请求调用链](request-call-chain.md)。

## 为什么要在接请求之前一次做完？代价在哪？

**KV 池的大小是启动时定下的常数，运行期不会变多。所以必须先量清楚还剩多少显存，再一次把池子分出来，最后才录图。** 在我们的双机部署里，每张卡的池子按算例切成 3,855 块，每个块号占 7.969 MiB，推导只在[双机部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)维护。服务跑起来以后，请求只是从这 3,855 块里借和还。「跑着跑着放不下」通常不是显存突然不够，而是块借完了，要回到第④步查预算。

顺序是由依赖推出来的，下表每一行都是一种不能成立的换法：

| 想换的顺序 | 为什么不行 |
|---|---|
| 先建缓存池，再量预算 | 池子多大，就是第④步量出来的那个数；没有它，第⑤步不知道分多少 |
| 先建 ModelRunner，再选卡 | ModelRunner 一建就要绑定设备，得先知道是哪张卡 |
| 先装权重，再换补丁 | 装完权重后的后处理入口被补丁换过；补丁晚了，GLM 的 MLA 层（一种把每个历史位置压成一条短向量来存的注意力层）会漏掉自己的后处理，见下文第①步 |
| 先录图，再装权重或建缓存池 | 录图要真跑一遍 decode 前向：没权重算不了，没缓存池没处读写 KV；图占的显存还要落在预算之外，只能等 KV 切完再录 |

**代价是启动慢，而且慢在三处。** 装权重要把整份权重文件从存储读一遍，主模型和 MTP 草稿层（模型自带、先猜后面几个 token 的那一层）还各把文件过一遍；量预算要真跑前向，GLM 跑两次；预热和录图要按每个尺寸各跑一遍。这笔时间每次启动都要付，换来的是运行期不再分配 KV 显存、decode 步可以直接回放图。另外，量出来的预算只对这一套配置成立：批量上限、执行方式、并行布局、量化方案换了任何一项，都要重新走一遍。

**本页只管这条先后链。** 第④步每一项怎么扣、为什么试跑两次，在 [KV cache 显存预算](kv-cache-memory-profiling.md)；第⑤步分出的池子里块怎样借出、共享、归还，在 [KV 块分配](vllm-kv-block-allocation.md)；每层每页存什么形状，在 [KV cache 规格](kv-cache-spec.md)；整套系统哪些部件换成了昇腾版、Worker 处在哪一层，在 [vllm-ascend 如何接入 vLLM](vllm-ascend-overview.md)；平台怎样指定用 NPUWorker 这个类，在 [NPUPlatform](npu-platform.md)。

## 装权重之前，怎样知道要构造哪一种模型？

**模型目录里有结构说明、权重和分词规则，三者要彼此匹配。** 配置告诉程序有多少层、每层多宽以及采用哪类模型；执行实现是把这些层真正算出来的代码；权重是填进各层参数的数；tokenizer 则把输入文字变成模型能查表的编号。找到配置文件，只完成了第一步，不能据此判断权重、分词器和设备实现已经可用。

普通 Hugging Face 加载先查模型来源对应的配置：本地目录直接读文件；仓库 ID 按所选修订查本地缓存，需要时再访问 Hub。读配置可能发生在创建 Worker 之前；Worker 的第③步依据已经整理好的模型配置，构造本卡的参数，再填入权重。分词器由文本入口使用，不是每张 NPU 各自加载的一套模型权重。

```wiki-diagram
file: model-resolution-flow
```

这里有四个不同的选择，不能用一个“模型加载成功”把它们混在一起：

| 选择什么 | 依据什么 | 选定后还缺什么 |
|---|---|---|
| 配置类 | 配置中的 model_type，必要时使用已登记的兼容类或 Hugging Face 的自动配置类 | 得到结构说明，还没构造模型或读入权重 |
| 执行实现 | 配置中的 architectures 与运行时模型注册表；还受所选模型后端约束 | 实现能否加载、是否支持当前设备与所需特性 |
| 权重文件 | 普通默认加载器使用模型来源和修订，再按加载格式选文件 | 张量名称、形状、分片与实现一致，随后还要做后处理 |
| tokenizer | 独立的分词器来源、修订和模式；未指定来源时跟随模型 | 编号与模型词向量表、特殊 token 和模板的约定一致 |

**改声明，不能把权重变成另一种模型。** 架构名称缺失时，当前实现会先尝试从模型类型补出名称；补不出来、别名没有登记或名称有歧义时，才需要按实际模型确认覆盖值。官方用 Cerebras-GPT 的 GPT-2 结构演示显式声明 GPT2LMHeadModel；这个覆盖只修正“选择哪份实现”，不会把张量重排成任意新架构。解析配置所用的模型类型与执行类名也是两回事，覆盖前者甚至会改变读取配置时选择的类。

**分词器可以单独指定，但编号必须与权重对应。** 用示意数看：模型训练时把“猫”放在编号 7，对应词向量表第 7 行；另一个 tokenizer 若把“猫”编成 12，模型就会取第 12 行。即使两个词表大小相同，读到的也不是训练时约定的那一行。更换 tokenizer 不会自动重排权重；编号的具体查表过程见 [token 与词向量](token.md)。

执行实现也有选择条件。默认优先使用已登记的原生实现；原架构名都未登记等条件满足时，才尝试兼容的 Transformers 实现。这里仍由 vLLM 组织调度和执行，并非另起一个 Transformers 服务。已经选中的原生实现若导入失败、张量不匹配或设备算子不支持，不会因为“自动”二字就保证换后端修好。Ascend 的实际模型注册与算子替换还要一起核对，本页后面的 GLM 部分继续使用固定镜像的原生实现。

## 放到 GLM 双机：一次启动，16 个 Worker 各走一遍

[官方双机部署](glm-5-3-flash-two-node.md#部署前提)是 2 台 Atlas 800 A2、每台 8 张卡：TP8 把同一个矩阵切给机内 8 张卡，DP2 把请求分给两台机器各自排队执行，EP16 把 MoE 层的 288 个专家分到全部 16 张卡（MoE 层里有很多个叫「专家」的小网络，每个 token 只交给其中少数几个计算，见 [MoE](moe.md)）；权重用 W8A8 量化，即权重和激活都用 8 位整数计算。机器 0 起 API server、DP 协调进程和一个 EngineCore，机器 1 用 headless 模式（不带 HTTP 前端、只跑引擎）只起一个 EngineCore；每个 EngineCore 派生 8 个 Worker 进程，一个 Worker 占一张卡，合计 16 个 Worker、20 个进程。进程怎么起，见[双机部署页的启动七步](glm-5-3-flash-two-node.md#启动时发生了什么)：本页的第①步发生在它的第二步、Worker 进程刚起来时，第②到⑥步依次对应它的第三到第七步。

下图把六步落到代码上：前三步是执行器建 Worker 进程时顺手调用的，后三步由 EngineCore 在初始化 KV cache 时统一下发。

```wiki-diagram
file: worker-lifecycle-flow
```

### ① 换补丁：GLM 的 MLA 层靠它接上权重后处理

**16 个 Worker 进程各在构造函数里换一遍补丁，其中一个补丁决定 GLM 的 MLA 层装完权重后有没有人给它做后处理。** MLA（Multi-head Latent Attention）是 GLM 在 12 个层上用的注意力（主干 11 层加 MTP 层）：它把每个历史位置压成一条短的潜向量存进 KV cache，用的时候再展开，见 [MLA](mla.md)；GLM 的这 12 层还只挑一部分历史来读，这部分见[稀疏注意力](sparse-attention.md)。GLM 实际推理用的 MLA 模块是 vllm-ascend 自己写的一个类，不是上游 vLLM 的 MLA 类。上游装完权重后会逐个模块做后处理，其中注意力这一轮只认上游自己的几个注意力类；本部署镜像里的补丁换掉了这个后处理入口，把 GLM 这个 MLA 类加进名单，它才会被转交给注意力后端做自己的后处理。补丁要是晚于装权重，这 12 层的后处理就会被跳过。各类补丁在哪个进程、什么时候生效，见 [Patch 机制](ascend-patch-system.md#两类-patch-各在什么时候哪个进程里生效)。

### ② 选卡、建通信组：先拍快照，再建三类组

**每个 Worker 按「DP 组号 × 8 + 本机序号」得到全局编号 0–15，先拍显存快照，再用 HCCL 建起 TP、DP、EP 三类通信组。** 机器 0 的卡是 0–7，机器 1 的卡是 8–15；这个编号叫 rank，是卡在通信组里的编号，和 token 的位置无关。TP 组是每台机器内的 8 张卡，DP 组是两台机器上序号相同的两张卡（0 和 8、1 和 9……），EP 组是全部 16 张卡，MoE 层的 dispatch（把 token 发到持有所选专家的卡）和 combine（把专家算完的结果收回原卡、加权相加）都在这个组里走，见 [expert parallel](expert-parallel.md)。这几组怎样分出来，推导在[双机部署页](glm-5-3-flash-two-node.md#16-张卡怎样分组)。

快照拍在建组之前，所以 HCCL 为各通信组预留的缓冲会算进第④步的「非 torch 增量」，见[三项扣减](kv-cache-memory-profiling.md#三项扣减在-glm-里各是什么)。快照同时做一道启动检查：这张卡此刻的空闲显存，必须不少于「总显存 × 0.85」这份预算，否则当场报错退出。

两台机器的 EngineCore 之间还有一条 CPU 上的通信组，只用来同步两件事：还有没有请求没做完、要不要暂停。那条组由 EngineCore 建，不是 Worker 在这一步建的，见 [data parallel](data-parallel.md)。

保存设备之后，先初始化工作空间管理器，再选择并创建 ModelRunner（负责组织模型执行的对象）。工作空间用于组织执行需要的临时空间；这一步只准备好执行对象，模型本身仍在后续加载步骤中构建并加载。

### ③ 装权重：只拷本卡那一份

**每个 Worker 把本卡需要的权重留在设备上；默认加载路径为主模型和 MTP 分别遍历权重文件。** 3121f187 配方所列主要语言权重的子账约为每卡 20.58 GiB，完整加载占用还要计视觉塔、MTP 旋转矩阵和量化辅助张量等。加载分四段：

1. 按本卡分片的形状，在卡上把参数一次开好，这时还是空的。
2. 逐个打开权重文件，把每个张量交给它所在层的加载函数。TP 切的层只截出本卡那一段；路由专家只收本卡的 18 个（第 r 张卡收编号 18r 到 18r+17，比如 11 号卡收 198–215），其余丢掉。截好的那段从主机内存拷进卡上的参数。
3. 全部拷完后做一遍昇腾版的后处理：int8 权重先转置，再转成 NZ（昇腾矩阵单元使用的分块存储格式），缩放系数另存一份 FP32 副本；MLA 层转交给注意力后端处理。处理后卡上张量的样子和文件里不同，叫 processed layout。第①步说的那个补丁，换的就是这一段的入口。
4. 主模型这一遍不收 MTP 层；草稿模型再把文件过一遍，只收 MTP 层。

20.58 GiB 子账的范围、旧新量化配方差异，见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。加载前后的实测显存差才会被记成「权重占用」，第④步直接拿来扣。教程命令打开了预取：每个 Worker 在后台先把分给自己的那一份文件读进操作系统的页缓存，前台同时逐个读张量。

```calc
title: 用主要语言权重子账演示一次启动的读取量
其余权重还原成整份 = 1,774.5 MiB × 8 + 727.5 MiB = 14,923.5 MiB ≈ 14.57 GiB
> 每卡除路由专家外的 2,502 MiB 里，727.5 MiB 每卡整份相同，1,774.5 MiB 按 TP8 切成 8 份，所以乘 8 再加回
语言部分的重建估算 = 290.25 GiB 路由专家 + 14.57 GiB 其余 ≈ 304.8 GiB
> 沿用 3121f187 的子账口径，未计视觉塔、MTP 旋转矩阵和量化辅助项；它不是完整文件大小
每个 Worker 后台预取 = 304.8 GiB ÷ 16 ≈ 19.05 GiB
> 预取按文件个数分给 16 个 Worker，这里假设各文件大小均匀
每个 Worker 前台过手 = 2 × 304.8 GiB（主模型一遍、草稿一遍） = 609.6 GiB
每卡主要语言权重子账 = 20.58 GiB
> 理想化假设同机 8 个 Worker 复用页缓存、语言部分只从存储读一遍时，这一部分约 305 GiB；完整读取量须按实际文件重新算
```

路由专家 290.25 GiB 的结论见 [TP 页：哪些权重归 TP、哪些由 EP 分走](tensor-parallel.md#先区分哪些权重归-tp哪些已经由-ep-分走)，逐项推导在 TP 页的开销一节；727.5 MiB 与 1,774.5 MiB 这两份怎样分出来，见 [TP 页的三档比较](tensor-parallel.md#固定卡数比较-tp4tp8tp16只缩小可切部分)。304.8 GiB 是从主要语言权重子账重建的估算，不能替代启动日志 `Checkpoint size` 所统计的 safetensors 文件大小；加载后的类型转换、副本和布局，也不能直接当作文件里的字节。算例中的前台每 Worker 约 610 GiB，表达的是主模型和草稿两次遍历的倍数关系，不是磁盘流量实测：默认不按专家过滤，不在本卡的专家也会读出后丢弃；专家过滤开关默认关着，见对照源码。另有一种热启动方式 RFork，从另一个已经跑着的实例的显存里借权重，借不到再回到上面这条路径；教程没有开它，见 [RFork 启动](rfork-startup.md)。

### ④ 量预算：各卡报数，EngineCore 定块数

**每个 Worker 先报出每层要存的状态规格，再试跑两次量出 KV 预算；EngineCore 按最紧的那张卡定块数，算例是每卡 30.00 GiB、3,855 块。** 规格要先报，是因为各层存的东西不一样：MLA 层按 token 存历史，KDA 层（GLM 的线性注意力层，见[线性注意力](linear-attention.md)）每条请求存一份固定大小的状态，不能都按普通的逐 token K/V 估算。规格决定了一个逻辑块装 640 个 token、全部层编成 5 个缓存组，见 [KV cache 规格](kv-cache-spec.md)。试跑先按 128 个 token 跑一次，量到 MoE 的 MC2 通信路径（MC2 是把专家计算和跨卡收发合在一起执行的昇腾实现，一步的 token 不超过 128 时才走它，见 [MoE 通信那一节](one-request.md#moe-通信走-mc2-还是-allgather)）；再按一步的上限 8192 个跑一次，见[试跑两次](kv-cache-memory-profiling.md#试跑两次先按-128-个-token再按-8192-个)。

教程把显存比例设为 0.85，没有指定显式 KV 预算，所以走自动扣减这条路。上面 30.00 GiB、3,855 块依赖每卡总量 64 GiB、完整权重预算 21 GiB，以及「激活峰值加非 torch 占用」3.4 GiB 这组教学假设；三者都还没有实机日志。20.58 GiB 只是主要语言权重子账，不能替代完整权重预算。推导和适用条件只在[双机部署页](glm-5-3-flash-two-node.md#两种块数各在什么时候用)维护。每台机器的 EngineCore 收齐本机 8 个 Worker 报来的数，各自折成块数，再取最小值；两台机器之间不再对齐，见[各卡取最小](kv-cache-memory-profiling.md#切成块各卡取最小块数不等于并发数)。

Worker 在显存预算分析之前已经创建。EngineCore 取得各卡预算、据此生成 KV cache 配置时，会比较生成配置前后的最大模型长度；值有变化，就同步给 Worker，避免它继续使用旧长度。触发条件不限于长度缩短；本教程配置是否实际触发调整，还要看启动时的配置和结果。

### ⑤ 建缓存池：一次分配，运行时再借

**每个 Worker 收到同一份缓存配置，把 5 个缓存组的 KV 张量一次分配出来；到这一步，池里有了块，但还没有哪一块属于哪条请求。** 同一个块号的物理空间被不同组的层共享，所以占住一个块号就等于占住 [7.969 MiB](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。分配前还要准备 KV 传输，即把 KV cache 在不同实例之间收发的连接，prefill 和 decode 分开部署时才用得上；本部署没有配置 KV 传输，这一步没有要建的连接。

启动时还没有任何请求。以示例请求 R1 为例，它的 prompt 是 4 个 token（设定见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)），它的块要等调度第一步才从池里借，请求结束再还回池里。借几块、哪一步借、什么时候还，见 [R1 从借块到还块](vllm-kv-block-allocation.md#放到-glm-双机r1-从借块到还块)。

### ⑥ 预热、录图：图的显存从预算外出

**主模型按 7 个尺寸录 decode 图，对应 1 到 32 个请求；录图用的显存不在第④步的任何扣减项里，从预算外那 15% 支付。** 教程把图模式设为只录纯 decode 步，捕获 4、8、16、32、64、96、128 个 token。MTP 让每个请求一步算 1 个真 token 加 3 个草稿 token，所以这 7 个尺寸对应 1、2、4、8、16、24、32 个请求，见[启动第七步](glm-5-3-flash-two-node.md#启动时发生了什么)。命令里的另一处「不录图」开关写在草稿模型的配置里，只管草稿模型，主模型照样录图。

录图之前先按预热列表里的尺寸各跑一次假前向，本部署具体有几个尺寸要看启动日志。捕获尺寸不再重复预热；教程没有设编译尺寸，预热列表只剩为覆盖编译区间补上的端点。录图的显存为什么在预算外、预算外还要装什么，见[预算外的 15%](kv-cache-memory-profiling.md#预算外的-15图副本和启动前已被占的)。

预热列表非空时，按尺寸从大到小跑假前向，然后才决定是否录图。强制 eager 模式会跳过录图，也不再为编译区间补预热端点，但仍保留已有编译尺寸的预热循环；若这份列表为空，循环一次也不执行，不能据此断言 eager 模式下一定跑过尺寸预热。

录完图还有三件收尾：没有指定显式预算时，每张卡打一行日志，报出权重、激活峰值、非 torch 占用和图内存四项实际用量，并给出建议的显式预算；在 A2 这类卡上用一次小矩阵乘预热 ATB（昇腾的一套加速算子库），免得第一条请求写 KV 时变慢；CPU 绑核默认打开，这时把 Worker 进程绑到分给它的 CPU 核上，见 [CPU 绑核](cpu-binding.md#放到-glm-双机8-个-worker-各绑在哪里)。最后重置随机种子，这张卡就可以接请求了。

## 常见误解

- **「第②步只是选卡」。** 显存快照和 ModelRunner 都在这一步：快照拍在建通信组之前，ModelRunner 建在选卡之后，在那之前它根本不存在。
- **「KV cache 有多大，看启动参数就知道」。** 显存比例只定预算，实际字节数是第④步减出来的。手工指定显式预算时，试跑照样要跑，因为它顺带完成模型的首次编译；填一个很大的数也不会多出物理显存，第⑤步分配时照样放不下。
- **「每个 Worker 自己决定分多少块」。** Worker 只报可用字节；可调度块数由 EngineCore 汇总确定，各卡按分发给自己的配置分配；本页同构 TP 组受最紧的那张卡约束。
- **「启动时已经给请求分好了块」。** 第⑤步只建池子。R1 用的块是调度第一步才借的，请求结束就还回池里，见上文第⑤步。
- **「录了图，之后每一步都回放图」。** 本部署只录纯 decode 步；带 prefill 的混合批走逐算子执行，两个 DP 组里有一组不能用图，两组这一步都退回逐算子执行，见[双机部署的后果](glm-5-3-flash-two-node.md#这套部署给后面各章留下的后果)和 [ACL Graph](acl-graph.md)。一个请求一步也不止 1 个 token，MTP 下是 4 个。
- **「命令里写了不录图，主模型就不录」。** 那个开关只管草稿模型，见第⑥步。
- **「省显存的 sleep mode 只影响运行期」。** 第③步和第⑤步就按它分叉：开着时，权重和 KV cache 各进一个专用内存池，以后可以整池释放；一个进程里只能有一个这样的实例。本部署没开。
- **「源码里方法的排列顺序就是执行顺序」。** 量预算的方法写在装权重前面，执行时却在它后面。执行顺序看调用方，见下面的「源码位置」。

## 对照源码

**初始化与预热的来源范围。** 已核固定源码：来源 4 的镜像 `worker.py` 第 505–521 行对应设备、工作空间与 Runner 的先后顺序，来源 6 对应后续模型加载；来源 11 的上游 `core.py` 第 266–280 行在 `get_kv_cache_configs` 前后比较 `max_model_len`，变化时广播 `update_max_model_len`；来源 9 的镜像 `worker.py` 第 695–719 行对应可为空的 `warmup_sizes`、降序循环及 `enforce_eager` 门槛。这些是指定版本的静态路径，不能代替本部署长度是否调整、实际预热尺寸及设备执行结果的日志，也不自动适用于其他启动路径。

### 怎么开

启动流程没有总开关，每次启动都会走完；下面按调用方和步骤列出入口，以及改变它的参数。

- **谁来调。** `NPUWorker` 继承上游 `WorkerBase`，平台通过 `worker_cls` 指定用它，见 [NPUPlatform](npu-platform.md)。执行器的 `WorkerProc` 构造时依次调 `init_device()` 和 `load_model()`[C10]；`EngineCore._initialize_kv_caches` 先广播 `get_kv_cache_spec` 与 `determine_available_memory`，自己用 `get_kv_cache_configs` 定块数，再调执行器的 `initialize_from_config`[C11]；执行器对每个 Worker 先广播 `initialize_from_config`，紧接着广播 `compile_or_warm_up_model`[C12]。
- **① 构造函数。** 先按 `COMPILE_CUSTOM_KERNELS` 决定要不要警告，然后 `adapt_patch()` 打 worker 层 patch，接着 `ops.register_dummy_fusion_op()`、非 A5 设备注册 ATB 扩展、`register_ascend_customop(vllm_config)`、`init_ascend_config(vllm_config)`、配置日志、`check_ascend_device_type()`，最后才 `super().__init__()`[C2]。
- **② `init_device`。** `_init_device` 里依次 `torch.npu.set_device`、`empty_cache`、建 `MemorySnapshot`、算 `requested_memory = total_memory × gpu_memory_utilization`、空闲不足就抛错，然后 `_init_worker_distributed_environment`，最后设随机种子[C3]。建组用 `init_distributed_environment(..., "hccl")`，再 `ensure_model_parallel_initialized` 和 `init_ascend_model_parallel`（建 MC2 等昇腾自己的组）[C5]；全局 rank 的偏移在上游 `parallel_state` 里。回到 `init_device`，先初始化 workspace 管理器，再按 `use_v2_model_runner` 在 `NPUModelRunnerV2` 与 `NPUModelRunner` 之间选，源码注释写明理由：「Init ModelRunner here, so that we have access to self.device」[C4]。
- **③ `load_model`。** `enable_sleep_mode` 开着就用 `CaMemAllocator` 的 `tag="weights"` 池，否则 `nullcontext()`；配了 `weight_transfer_config` 再建权重传输引擎[C6]。`NPUModelRunner.load_model` 在 `DeviceMemoryProfiler` 区间内加载主模型，并在配置了草稿模型时加载草稿模型；退出区间后才把显存增量记为 `model_memory_usage`，因此这笔统计包含草稿加载[C13]。加载器由 `--load-format` 决定：默认 `auto` 对应 `DefaultModelLoader`，可读本地目录，也可先下载远端仓库文件；插件注册的 `rfork` 改为借别的实例的显存，见 [RFork 启动](rfork-startup.md)。本部署读 safetensors 走 `safetensors_weights_iterator`，`prefetch` 策略另起后台线程预读[C16]。后处理入口被 `patch_process_weights_after_loading` 换成 `ascend_process_weights_after_loading`，镜像版把 `AscendIndexerKPoolMLAAttention` 加进 `_ASCEND_ATTENTION_POST_LOAD_TYPES`[C14]；这个类就是 GLM 实际推理用的 MLA 模块，它的 `process_weights_after_loading` 转给 `mla_cache_layer`，再转给后端 `impl`[C15]。
- **④ `determine_available_memory`。** `kv_cache_memory_bytes` 的配置值经 Python 真值判断为真时走快路径：照跑 `profile_run()`（注释写明是为了编译模型），然后原样返回；否则在 `memory_profiling` 区间里跑 `profile_run()`，得到 `available_kv_cache_memory_bytes = requested_memory − non_kv_cache_memory`[C7]。
- **⑤ `initialize_from_config(kv_cache_config)`。** 先 `ensure_kv_transfer_initialized`，sleep mode 开着时进 `tag="kv_cache"` 池，然后 `model_runner.initialize_kv_cache(kv_cache_config)` 真正分配张量[C8]。
- **⑥ `compile_or_warm_up_model`。** warmup 列表取 `compile_sizes` 的副本；非 `enforce_eager` 且 `cudagraph_mode` 不为 NONE 时，剔掉 `cudagraph_capture_sizes` 里已有的尺寸；只要非 `enforce_eager`，还会为没被覆盖的编译区间补端点，即使图模式为 NONE。最后按列表从大到小逐个 `_dummy_run`。非 `enforce_eager` 才 `capture_model()`；没指定显式预算时打印四项用量和建议值（多留 150 MiB）；非 A5 设备调 `_warm_up_atb()`；`enable_cpu_binding` 为真时 `bind_cpus`，失败只告警；最后 `set_random_seed`[C9]。`enable_cpu_binding` 在昇腾配置里默认为真，见 `ascend_config.py` 第 162 行。
- **本部署的参数。** 教程两机命令写了 `--gpu-memory-utilization 0.85`、`--compilation-config` 里的 `FULL_DECODE_ONLY` 和 7 个捕获尺寸、`--speculative-config` 里的 `"enforce_eager":true`、`--safetensors-load-strategy prefetch`；`--kv-cache-memory`、`--load-format`、sleep mode、KV 传输和 `additional-config` 都没有出现[S1]。`"enforce_eager":true` 写在草稿模型的配置里，只管草稿模型，主模型仍录 decode 图[I]。

**加载格式怎样选。** CLI 的 --load-format 对应 EngineArgs / LoadConfig 的 load_format，Python 离线引擎也用同名关键字；类型是字符串，定义默认 auto，加载时按注册表找类。它不接收权重路径：路径由 model 指定；也不决定 INT8 或 BF16，精度与量化入口见[量化页](quantization.md#怎么开)。例如在既有命令中追加 `--load-format safetensors`，表示选择该加载路径；离线对应 load_format="safetensors"。

**配置、实现和分词器的入口。** 下表都是启动配置；CLI 用连字符，Python 使用同名下划线关键字。model 是模型目录或仓库 ID，对外服务别名另见 [API 入口](api-server-entry.md#怎么开)。这些选择在模型准备阶段生效，请求里的 model 名称不会重新下载或切换底层权重。

| CLI 参数 / Python 配置 | 定义默认及实际作用 |
|---|---|
| --hf-config-path / hf_config_path | 默认 None，使用 model 的配置；显式指定时只改变配置来源，普通默认加载器的权重来源仍由 model 决定 |
| --config-format / config_format | 默认 auto，按文件探测 Mistral/HF 配置；这是配置格式，和 load_format 选择权重读取器分开 |
| --hf-overrides / hf_overrides | 默认空字典，覆盖配置内容；Python 另可传回调。architectures 影响执行实现选择，model_type 会在选择配置类前参与；不会转换权重 |
| --model-impl / model_impl | 默认 auto；vllm 选择原生实现，transformers 要求兼容的 Transformers 实现；其他后端按实际注册和依赖核对 |
| --tokenizer / tokenizer | 定义默认 None，整理配置时填为 model；独立指定不改变普通默认加载器的权重来源 |
| --tokenizer-mode / tokenizer_mode | 默认 auto，选择分词器实现；模式与词表来源是两回事，具体编号约定见 token 页 |
| --revision / revision | 定义默认 None；可填模型仓库的分支、标签或提交 ID，参与模型配置及普通权重获取 |
| --tokenizer-revision / tokenizer_revision | 定义默认 None，整理配置时继承 revision；即使 tokenizer 改成另一仓库，也不会自动猜出该仓库匹配的修订 |
| --code-revision / code_revision | 定义默认 None；传给模型配置与自定义模型代码的加载入口，不把它当 tokenizer_revision，也不能用它替代代码信任开关 |

例如已确认结构与 GPT-2 实现兼容时，官方示例使用 `hf_overrides={"architectures": ["GPT2LMHeadModel"]}`；CLI 对应 --hf-overrides 后的一份 JSON 对象。复现一套模型时，应一起记录模型来源、配置来源、执行后端、tokenizer 来源及各自修订；远端分支名可移动，提交 ID 才能精确说明所取版本。本地目录则要保存实际文件版本，传入 revision 不会把本地文件切换成某次 Git 提交。这些是通用加载入口，不是让 GLM 教程改成 GPT-2 的部署参数。

固定基线的默认 auto 先检查有无 consolidated\*.safetensors，有则选 Mistral 文件布局，否则进入 hf 路径，按 \*.safetensors、\*.bin 的次序选首个有文件的模式；模型允许 fall_back_to_pt 时再把 \*.pt 加到候选末尾，模型自定义文件模式还可覆盖候选。因此，auto 不是“找到任何文件就读”。基线即使显式指定 safetensors 也可能追加 \*.pt 候选，但这种混合可能把 pt 文件交给 safetensors 读取器，不能当成可靠的兼容加载方法；v0.26 与 main 已限制这种回退，见版本差异。远端仓库需要下载相应文件及索引，本地目录则直接查文件；后续仍要按索引排除重复分片并检查是否找到权重。

| 用途 | 基线注册的值 | 适用条件与代价 |
|---|---|---|
| 常规读盘 | auto、hf、safetensors、pt、mistral | hf 按 HF 文件布局；pt 读 \*.pt；mistral 读 consolidated\*.safetensors。文件后缀不是量化方法名 |
| 读盘变体 | npcache、fastsafetensors、instanttensor | npcache 用 \*.bin 并建立 NumPy 缓存；后两项换读取实现。额外依赖和设备支持须匹配，instanttensor 是 CUDA 路径，不能当作 NPU 加速开关 |
| 专用加载器 | tensorizer、sharded_state、runai_streamer、runai_streamer_sharded、modelexpress | 使用各自的序列化、分片或传输约定，需配套文件与依赖；不是互换名称就能读普通模型包 |
| 量化文件入口 | bitsandbytes、gguf | 注册的是专用加载器；存在于上游注册表不代表固定 Ascend 设备可运行 |
| 测试占位 | dummy | 生成用于分析的随机权重；不用于真实问答质量验收 |

自定义加载器可用 register_model_loader 注册；RFork 属于独立工作版/插件扩展，不是这里三版上游自带的格式。GLM 教程没有显式 --load-format，沿用 auto；它设置的 --safetensors-load-strategy prefetch 是**选中 safetensors 之后如何读文件**的策略，不能把 prefetch 填进 load_format。原理和内存账见本页第③步，避免把预读误认为换了模型精度。

**读盘策略与代码信任。** safetensors_load_strategy 的 CLI 名为 `--safetensors-load-strategy`，Python EngineArgs / LLM 使用同名下划线关键字。定义默认 None；它与显式 lazy 不同：None 在检测到 NFS、NFS4 或 Lustre，且整份 checkpoint 不超过可用主机内存的 90% 时自动预读；其他情况沿用映射读取。lazy 始终跳过自动预读，按需触及映射文件；eager 每次把一个完整文件读到主机内存再解析；prefetch 在后台预读 checkpoint 到操作系统页缓存，前台仍用映射方式取张量；不要求先读完整份 checkpoint 才开始取张量。GLM 的显式 prefetch 会绕过自动选择条件，超过 90% 只告警，仍尝试预读。None 是省略/Python 空值，不是名为 None 的策略字符串。

`--trust-remote-code` 对应 trust_remote_code，布尔值默认 false；GLM 教程显式开启。它在加载模型配置、分词器及相关 HF 自定义实现时允许使用模型仓库中的代码，可能早于 Worker 装权重执行。开启并不强制改用 Transformers 模型后端，也不表示所有 safetensors 文件包含代码；固定原生 GLM 路径仍按本页六步执行。离线构造对应 trust_remote_code=True，服务请求不能逐条改变这个启动决定。请求可否改聊天模板是另一项，见 [API 模板信任](api-server-entry.md#怎么开)。

### 会报什么错

配置阶段报找不到有效仓库或配置文件时，先查来源、revision 和 config_format；不是先换权重精度。`No model architectures are specified` 表示补全后仍没有架构名称；名称已给出但实现不兼容，则应查运行时模型注册、Transformers 兼容检查和设备支持。需要仓库自定义配置代码时，错误也可能发生在 Worker 装权重之前。覆盖架构名只能用于已确认的等价实现，不拿任意“支持列表里的名字”去绕过这个检查。

基线加载策略字段是自由字符串，拼错可能落入普通映射读取而不报“未知策略”；v0.26 rc / main 改为限定枚举，会拒绝未列出的值。支持的 torchao 分支要求相应 torchao 依赖，它不是 GLM W8A8 的选择。远程代码信任关闭、但模型配置或分词器确需自定义实现时，会在对应加载阶段失败；先核仓库文件与报错所指的实现，不以开启请求模板信任替代它。

启动期出错，先看挂在第几步，范围就圈定了一半：

加载格式不在运行时注册表中时会报 `Load format ... is not supported`；默认加载器找不到所选模式的文件会报 `Cannot find any model weights with ...`。前者查拼写、版本和插件注册，后者查模型路径、revision、文件列表与所选格式。文件找到了但张量名称/形状不匹配，是加载内容或架构问题；换成 dummy 会绕过真实权重，不能据此判定模型包已修复。

| 挂在哪一步 | 先查什么 | 报错或日志 |
|---|---|---|
| ① 换补丁 | 固定版本、依赖、导入条件、实际注册的类 | `COMPILE_CUSTOM_KERNELS` 为假时先打警告：without custom kernels, vllm-ascend will not function correctly |
| ② 选卡、建组 | 设备可见性（`ASCEND_RT_VISIBLE_DEVICES`）、rank 与通信组配置 | `Free memory on device (x/y GiB) on startup is less than desired GPU memory utilization (...)`：快照时空闲不足预算 |
| ③ 装权重 | 架构名、加载器、张量格式、本卡分片 | 开 sleep mode 时 `Sleep mode can only be used for one instance per process.` |
| ④ 量预算 | 显式还是自动路径、非缓存占用 | `Error in memory profiling. Initial free memory ... current free memory ...` |
| ⑤ 建缓存池 | 缓存规格、块数够不够一条最长请求 | EngineCore 侧的检查，报错原文见 [KV cache 显存预算](kv-cache-memory-profiling.md#会报什么错) |
| ⑥ 预热、录图 | 最后一个成功的尺寸、图模式 | 先开 `enforce_eager` 跳过录图，确认是不是图的问题 |

- 本页固定 NPU 实现的第④步断言要求试跑后的整卡空闲量严格小于启动快照；等于或变多都会触发检查。报错文字提到其他进程释放显存，但这只是待验证的解释，不能单凭报错认定原因，也不能把共用设备的进程限定在同一容器。先对齐本进程与同卡其他进程的分配、释放记录，再按[显存量测页](kv-cache-memory-profiling.md#空闲显存变多为什么量测反而失败)做对照；其他平台和版本仍须核对实际断言与记账方式。
- 第②步选 v2 runner 时会打警告（不是错）：`npu model runner v2 is in developing, some features doesn't work for now.`，看到它说明 `use_v2_model_runner` 生效了。
- 第③步读盘时打 `Checkpoint size: … GiB. Available RAM: … GiB.`，权重文件超过可用内存的 90% 只告警、不中止；装完打 `Loading model weights took … GB`，这就是第④步扣的权重占用。

### 开销和什么时候别开

- eager 会增加单文件的主机内存占用，prefetch 会占用文件页缓存并提前产生存储流量；容器中还要核对 [cgroup 内存账](device-memory.md#怎么开)。预读可能缩短冷启动读盘等待，但不保证提高生成吞吐，也不同于运行期 HBM 到 L2 的算子预取。trust_remote_code 是加载信任边界，允许模型仓库代码在服务进程权限下执行；只对已核查并固定 revision 的模型与配套代码开启，教程的 true 不推广到任意仓库。

- load_format 主要改变启动期的磁盘、网络、主机内存与权重传输开销，不会自动提高每一步生成速度。npcache 会多占缓存空间；专用读取器可能有额外设备/库要求。只在文件格式和运行环境匹配时更换，普通 GLM 复现先保留教程的 auto 与 prefetch 组合。
- 启动时间主要花在第③步（整份权重文件过两遍）、第④步（GLM 两次试跑）和第⑥步（逐尺寸预热加录图）[D]。
- `enforce_eager` 为真时，跳过的只是尺寸剔除、补端点和 `capture_model()`；`compile_sizes` 里的预热、ATB 预热和绑核照做。代价是运行期每一步都逐个下发算子。它适合用来确认启动失败是不是出在录图，不适合长期开着跑。
- `--kv-cache-memory` 只省掉第④步的扣减，试跑照跑，省不掉编译那份时间；它适合同一环境反复重启、希望块数稳定的场景，取值直接用第⑥步日志给的建议值，细节见 [KV cache 显存预算](kv-cache-memory-profiling.md#开销和什么时候别开)。
- `enable_ep_weight_filter` 默认关[C27]。打开后每个 Worker 只读本卡的 18 个专家，前台过手的量会大幅下降；它在昇腾上能不能直接用，见页末缺口。
- sleep mode 一个进程只能有一个实例；本部署不需要整池释放显存，教程命令里没有开它[S1]。

### 版本差异

模型解析按上游四个固定点核对，和下面 Ascend Worker 各阶段的实现分开。四版的 config_format、model_impl、tokenizer_mode 都默认 auto；hf_config_path、三个 revision 字段定义为 None，tokenizer 来源缺省跟随 model、tokenizer_revision 缺省继承 revision。普通默认加载器仍从传入模型配置的 model/revision 取主权重；模型额外权重、专用加载器和来源重定向要另看各自入口。

| 模型解析行为 | v0.23：0fc695fc | v0.26 rc：568afb3a | rc2：ced6857a | main：84030bbe |
|---|---|---|---|---|
| 缺少 architectures | 尝试按 model_type 补全，无法映射时提示覆盖 | 相同 | 相同 | 相同 |
| auto 尝试 Transformers | 原架构名全部未登记等条件下尝试；要求 is_backend_compatible | 相同 | 兼容检查另接受 _can_set_attn_implementation；仍受架构及后端条件限制 | 同 rc2 |
| 初始化时解析 Hub revision | 此处没有一次解析并复用的步骤 | 同左 | 配置与权重均仍来自 model 时，尽力解析模型修订；同源同修订的 tokenizer 可复用，否则单独解析 | 同 rc2 |
| 配置读取重试 | 此处直接调用配置解析器 | 同左 | 配置解析外加重试；默认共尝试 2 次，第一次失败后等 2 秒 | 同 rc2 |
| HF tokenizer 配置 | 加载前尝试读取并登记配置类 | 另将已有模型配置类预先登记 | HF 模式明确读 HF 配置，并把已取得配置传给 AutoTokenizer，减少重复读取；增加 Mistral 版本/文件组合检查 | 同 rc2 |

这里的 revision 解析是尽力而为：本地路径、ModelScope 或 Hub 解析失败时，保留原 revision；不能把它当成已成功锁定提交的证明。rc2/main 的 tokenizer 复用条件同时检查来源与原请求修订，独立分词器仍有自己的版本。配置读取重试只重试该解析调用，不代表配置错误、权重缺失或整个启动流程都会恢复。只查原生模型列表会漏掉符合条件的兼容后端；判断支持范围时，还要按本表核对实际选择与设备条件。

**v0.30.0rc2 保留分阶段启动，阶段内部增加了状态归属处理。** init_device 按最终配置选 MRV1/MRV2；加载后可建 weight_transfer_engine。KV 初始化在 DSpark speculator 存在且启用对应 KV 传输或逐层复用时，先登记 draft 缓存拥有者，再建 connector；discardable 池仅包缓存本体。清零 metadata 的共同门槛是 needs_kv_cache_zeroing，且 runner 提供 _init_kv_zero_meta：MRV2 满足即可，MRV1 还须同时有 Mamba 层、使用 Eagle3 且草稿 token 数大于 1。metadata 留在 sleep 池外。kernel_warmup 仍在 capture 条件前、无 Triton 则直接返回，但现在包含 rejection sampler、penalties、RMS、indexer 四项；early kernel/NZ warmup 另有配置且默认 false。

配套上游的 load_format=auto、safetensors_load_strategy=None、trust_remote_code=false 保留，NFS/NFS4/Lustre 与 90% RAM 的自动预读判断、显式 lazy 不预读的规则也在。rc2 的 pt 回退与远端索引条件和下述 main 相同：显式 safetensors 不追加 pt 候选，远端索引只在找到多个权重文件时下载，见来源 53。实际加载器注册含 modelexpress、ipc_cache，不含 gguf/bitsandbytes，不能只看 help 枚举认定可运行；新增注册也不证明每个 Ascend 模型都已测试该加载器。

**rc2/main 的多线程读取还有组合限制。** 默认加载器开启 enable_multithread_load 时，只接受省略策略或显式 lazy；与 eager、prefetch、torchao 搭配会被拒绝。因此，上面的自动预读与显式 prefetch 解释对应普通 safetensors iterator，不能同时套到多线程分支。旧 GLM 命令没有开启该字段，原读取算例保持原条件。

| 加载参数 | v0.23（0fc695fc） | v0.26 rc（568afb3a） | rc2（ced6857a） | main（84030bbe） |
|---|---|---|---|---|
| safetensors_load_strategy | 默认 None；四种读取分支，字段为 str | 默认与策略相同；字段限定四种枚举 | 同 v0.26；多线程另受上述限制 | 同 rc2 所列规则 |
| 自动预读 | NFS/NFS4/Lustre 且 checkpoint ≤ 可用 RAM 的 90%；显式 lazy 禁止，显式 prefetch 可超阈值继续 | 相同 | 普通 iterator 相同 | 普通 iterator 相同 |
| trust_remote_code | 默认 false；传给配置和 tokenizer 等入口 | 默认及用途相同 | 默认 false；配置读取与 generation config 也传 code_revision | 默认及用途相同；部分配置/processor 加载也传 code_revision |

上游调用顺序（`WorkerProc` 构造、`EngineCore` 初始化 KV cache）按 `vllm@0fc695fc` 读。执行侧按知识库固定快照核对：v0.23 列是 vllm-ascend 维护分支 2c59ff10，v0.26 列是 2ed6cbba，main 列是 baa023ad。**本页 GLM 部分读的是本部署专用镜像 db701c1f，它是另一个 orphan commit，不算进 v0.23 列：该镜像含 GLM 模型代码，2c59ff10 上没有；main 上 GLM 的代码在 `models/glm5next/` 下。** 镜像和 2c59ff10 的 `worker.py` 只差一个调试日志函数，六个方法逐字相同，行号从 `load_model` 起前移 13 行[D]。

| 项目 | v0.23 | v0.26 | rc2 | main |
|---|---|---|---|---|
| 普通启动调用顺序 | 六个方法、调用方和先后均存在 | 同 v0.23 | 设备后加载；拿预算后建缓存、预热 | 同一阶段依赖 |
| 后处理识别 | 额外认 DSAAttention；GLM 镜像另加专用 MLA 类 | 额外认 DSAAttention | 旧补丁已删，遍历实际 attention 子模块 | 同样遍历子模块 |
| 权重名字补丁 | patch_weight_utils 改 DeepSeek 的 kv scale 映射 | 已删 | 已删 | 已删 |
| ⑥ capture 前的 kernel_warmup | 无该入口 | Triton 可用时预热拒绝采样、惩罚项、RMS | 增加 indexer，共四类；仍有 Triton 门槛 | 所列三类同 v0.26 |
| ④ 预算修正 | 无新修正 | 见[显存预算版本表](kv-cache-memory-profiling.md#版本差异) | startup plan；分组、复用、offload、KVPP 按条件调整 | startup plan、分组缩放及可选特性调整 |
| ⑤ sleep 池 | 包住整个 initialize_kv_cache | 同 v0.23 | 只包缓存本体；DSpark 归属与清零元数据另处理 | 只包缓存本体，持久元数据在池外 |

rc2/main 的 GLM 使用 MultiHeadLatentAttentionWrapper 持有实际 attention 子层；上游后处理遍历子模块，按 attention 基类及可调用的后处理方法筛选，并非按 wrapper 类名识别。rc2 的普通多进程调用方仍先 init_device 再 load_model，再由 EngineCore 分配缓存并预热；弹性 EP 扩容另有分支，不用普通启动表替代它。上表的预热入口位于 capture 条件之前，所以 enforce_eager 不能单独阻止它；有没有实际设备预热，还取决于 Triton 门槛。

照 v0.23 的印象去 v0.26 或 main 上找 `patch_weight_utils` 会扑空；在 v0.26 上排查第⑥步变慢，还要多认 Triton 预热这一段。

来源 23 的 v0.26 固定源码 `kernel_warmup.py` 第 36–49 行还限定了 `HAS_TRITON`：为假时直接返回，为真时才调用拒绝采样、惩罚项和 RMS 三类预热入口。Triton kernel 是算子的一种设备实现。因此，表中“`enforce_eager` 拦不住”只说明调用位置在图捕获条件之前，不表示所有环境都会执行这些设备计算；具体执行结果仍须实机核对，这个版本的门槛也不能直接推广到其他分支。

load_format 另按上游 0fc695fc / 568afb3a / 84030bbe 核对：三版字段默认 auto，实际 auto 的 Mistral 探测、HF 文件候选与模型回退入口均存在。回退条件并不相同：v0.23 只检查 fall_back_to_pt；v0.26 和 main 还要求没有选择 safetensors 格式，因此显式 safetensors 不再追加 pt 候选。main 下载远端 safetensors 索引还要求已找到多个权重文件，v0.26 没有这个数量条件。可用加载器以下表的实际注册为准，不能仅凭帮助文档的枚举认定可用。

| 注册差异 | v0.23 | v0.26 rc | rc2 ced6857a | main 84030bbe |
|---|---|---|---|---|
| 常规、读盘变体、专用加载器与 dummy | 上述集合 | 相同 | 所列集合相同，含 modelexpress | 所列集合相同 |
| gguf | 注册 | 未注册 | 未注册 | 未注册 |
| bitsandbytes | 注册 | 注册 | 未注册 | 未注册 |
| ipc_cache | 未注册 | 未注册 | 已注册 | 已注册 |

这些是上游加载器的存在性；实际能否在 Ascend 使用仍受加载器实现、依赖和硬件约束。GLM 固定镜像的加载/后处理路径与 RFork 扩展各按本页对应来源，不从 main 的新入口反推旧镜像已有支持。

### 源码位置

六个方法都在 `vllm_ascend/worker/worker.py`。文件里的排列顺序不是执行顺序：第④步的方法排在第③步前面，第⑥步排在第⑤步前面[D]。

| 步骤 | 方法 | GLM 镜像 | v0.23 | v0.26 | rc2 | main |
|---|---|---|---|---|---|---|
| ① 换补丁 | `__init__` | 90 | 90 | 99 | 123 | 118 |
| ② 选卡、建组 | init_device（_init_device） | 505（395） | 505（395） | 489（385） | 491（384） | 483（379） |
| ③ 装权重 | load_model | 668 | 681 | 723 | 837 | 824 |
| ④ 量预算 | determine_available_memory | 527 | 527 | 511 | 557 | 549 |
| ⑤ 建缓存池 | initialize_from_config | 894 | 907 | 1001 | 1178 | 1129 |
| ⑥ 预热、录图 | compile_or_warm_up_model | 693 | 706 | 748 | 862 | 849 |

GLM 镜像列为 db701c1f，rc2 执行侧为 7d825229、配套上游为 ced6857a。main 的上游 84030bbe 是本页固定比较点，不据这张表推定某个 Ascend 镜像实际安装了该上游提交。

- 建组的 `_init_worker_distributed_environment` 在镜像第 975 行；上游调用方是执行器的 `WorkerProc` 与 `EngineCore._initialize_kv_caches`，见「怎么开」第一条；Runner 的加载与权重计量在 `model_runner_v1.py` 的 `load_model` 里；GLM 在镜像 `models/glm5_next.py` 第 2018 行实例化 `AscendIndexerKPoolMLAAttention`，这是「GLM 实际推理用这个 MLA 类」的直接出处。
- worker 层 patch 的清单在 `vllm_ascend/patch/worker/__init__.py`，各版本各一份。
- 本页的推断：第⑤步在本部署没有要建的 KV 传输连接，是由教程没配 KV 传输推出的[I]。读取算例用 304.8 GiB 语言部分估算说明文件遍历与页缓存复用的区别；完整文件大小看 `Checkpoint size`，磁盘实际读取量还取决于页缓存命中和并发读取，不能把约 305 GiB 当作实测值。

**证据与实测边界。**

常用加载入口的证据：来源 30–32 是基线字段、注册表与实际文件选择；33–35、36–38 分别核对 v0.26 rc 与 main。加载策略既有证据仍是来源 16；自定义格式的注册契约见来源 31，RFork 的具体能力按独立工作版页面限定。

来源 39–41 对应三版 trust_remote_code 字段默认；来源 16、42、43 对应三版 safetensors 实际读取分支。LoadConfig 的字段定义见来源 30、33、36；实际 GLM 两项启动取值以来源 1 的固定教程为准，不把通用默认写成部署值。

来源 56–60 是 rc2 的加载字段、普通读取器与配置代码信任；61–67 是启动阶段、后处理实际子模块、Triton 预热和缓存池边界；68–69 是注册表与文件选择；70–72 补足多进程执行器、EngineCore 与执行器抽象层的真实调用顺序；73 是多线程读取的策略冲突检查。

模型解析的通用入口与例子见来源 113–115；其中 HF 集成说明描述较早实现，当前条件由固定源码核对。来源 74–80 串起基线配置读取、原生/兼容实现选择、tokenizer 与主权重来源；81–85、86–90、91–95 分别对应 v0.26 rc、rc2、main 的同一条链。来源 96–98 是修订解析与局部重试，99–100 是本地、缓存和 Hub 的配置查找；101–102、107–112 是四版默认字段。来源 103–106 连接“选择执行类 → 构造参数 → 读取权重 → 后处理”，116–117 核对 CLI 名称与 EngineArgs 到 ModelConfig 的传递。示意的编号 7/12 用于解释分词器与词向量行必须一致，不是 GLM 的真实词表编号。

- 这套部署的实机启动日志：`Compile and warming up model for size` 各行（预热列表到底补了哪几个尺寸）、`Checkpoint size` 与 `Available RAM`、`Loading weights took`，以及第⑥步那行四项用量。各步耗时、每卡 64 GiB 和 3.4 GiB 的假设都要靠它定下来。
- 打开 `enable_ep_weight_filter` 在昇腾上能否直接用，没有实测；昇腾侧只在 EPLB 打开时把它换成空函数。
- GLM 的 MLA 层交给注意力后端之后，具体生成哪些运行期张量，本页没有展开。
- main 的包装层归属、上游后处理遍历及筛选已核到来源 26、54、55；具体 attention 后端如何改写权重和构造运行期布局，仍未在本页展开。
