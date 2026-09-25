---
id: epd-disaggregation
title: "EPD 分离：把视觉编码器也拆到单独的节点上"
type: feature
summary: 多模态模型先要把图算成一串 embedding，EPD 分离把这一步单独放到一类节点（E）上跑，算好的结果交给 prefill / decode 那边直接用，PD 节点上不再跑视觉编码器。
aliases: [EPD 分离, EPD Disaggregation, Disaggregated-encoder, 分离式编码器, 编码器分离, E 实例, E 节点, ec_transfer_config, ec_role, ECConnector, ECExampleConnector, encoder cache, EC 连接器]
chapters: ["18"]
order: 20
sources:
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/epd_disaggregation.md#L3-L13
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/epd_disaggregation.html
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/epd_disaggregation.md#L17-L33
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/epd_disaggregation.md#L39-L48
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/epd_disaggregation.md#L56-L63
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/epd_disaggregation.md#L65-L73
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/epd_disaggregation.md#L81-L85
  - vllm@0fc695fc:vllm/config/ec_transfer.py#L10-L36
  - vllm@0fc695fc:vllm/config/ec_transfer.py#L88-L104
  - vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/factory.py#L77-L85
  - vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/base.py#L139-L148
  - vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/example_connector.py#L52-L57
  - vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/example_connector.py#L98-L118
  - vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/example_connector.py#L120-L133
  - vllm@0fc695fc:vllm/distributed/ec_transfer/ec_connector/example_connector.py#L192-L200
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L142-L146
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1285-L1296
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L546-L550
  - vllm@0fc695fc:vllm/v1/worker/ec_connector_model_runner_mixin.py#L67-L69
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L4049-L4055
  - vllm@0fc695fc:vllm/v1/outputs.py#L318-L335
  - vllm@0fc695fc:vllm/config/scheduler.py#L233-L235
  - vllm@0fc695fc:vllm/config/multimodal.py#L123-L131
  - vllm@0fc695fc:examples/disaggregated/ec_both_encoder/ec_both_encoder.sh#L43-L54
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2051-L2058
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4909-L4919
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L817-L820
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1892-L1900
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L2267-L2275
  - vllm-ascend@2c59ff10:examples/disaggregated_encoder/disagg_1e1pd_example.sh#L89-L104
  - vllm-ascend@2c59ff10:examples/disaggregated_encoder/disagg_1e1pd_example.sh#L111-L124
  - vllm-ascend@2c59ff10:examples/disaggregated_encoder/disagg_1e1pd_example.sh#L135-L141
  - vllm-ascend@2c59ff10:examples/disaggregated_encoder/disagg_epd_proxy.py#L106-L115
  - vllm-ascend@2c59ff10:examples/disaggregated_encoder/disagg_epd_proxy.py#L165-L184
  - vllm-ascend@2c59ff10:examples/disaggregated_encoder/disagg_epd_proxy.py#L312-L321
  - vllm-ascend@2c59ff10:examples/disaggregated_encoder/disagg_epd_proxy.py#L402-L430
  - vllm-ascend@2c59ff10:examples/disaggregated_encoder/disagg_epd_proxy.py#L717-L720
  - vllm-ascend@2c59ff10:examples/disaggregated_encoder/disagg_epd_proxy.py#L726-L732
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: pd-disaggregation
    kind: builds-on
    note: E 是在 P 节点和 D 节点之外再拆出来的第三类节点；KV 怎么在 P 和 D 之间传归那一页，这一页只管 embedding 怎么从 E 到 P
  - to: one-request
    kind: builds-on
    note: 那条纯文本请求连代理的第一道判断都过不去，而且那个模型的 PD 分离三个版本都不支持；这一页说明把模型和输入换成什么才触发得了
  - to: vllm-scheduler
    kind: builds-on
    note: 「盘上命中的图不扣编码算力额度」发生在调度器挑编码输入那一段，每步怎么发名额由那一页讲
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 发一句话再带一张图，看图那一步能不能挪到别的机器上

你给一个多模态模型发「这张图里有几只猫？」外加一张照片。语言模型读不懂像素，得先由模型自带的**视觉编码器**把图算成一串 [embedding](embedding.md)，和文字的 embedding 排在一起，[prefill](prefill.md) 才能开始。平常这一步就在跑 prefill 的那台机器上顺手做了。

EPD 分离回答的是：**这一步能不能单独拿出去，放到另一类节点上做？** 它在 [PD 分离](pd-disaggregation.md)之上再拆出一类节点——E（Encode）节点只跑视觉编码器，算出的图像 embedding 交给 P 节点 / D 节点那边，PD 那边就不用再跑一遍视觉编码器。官方给的理由有三条：视觉编码器和语言模型体量差着数量级，该各自扩缩；纯文本请求整条绕开视觉编码器；同一张图的编码结果能跨进程复用。

```wiki-diagram
file: epd-disaggregation
```

## 贯穿例子用不上它，本页换一个带视觉的模型

[那条请求](one-request.md)是在 Qwen3.6-35B-A3B 上问一句 37 个 token 的纯文本问题，**没有图，整条 EPD 链路一步都不会走**：代理收到请求后第一件事就是看消息里有没有图片或音频，没有就直接转给 PD，「先过 E」那一步整个跳过。而且还有更早的一道坎——这个模型在三个版本的支持矩阵里，PD 分离都是 ❌（见[那一页](one-request.md)的「会报什么错」和版本差异），而 EPD 是搭在 PD 分离之上的。

所以本页讲机制时换成官方启动脚本里的例子：

| 贯穿例子 | 本页换成 | 为什么 |
|---|---|---|
| Qwen3.6-35B-A3B，TP=2 | Qwen2.5-VL-7B-Instruct | 官方 1E1PD 脚本的默认模型，带视觉编码器 |
| 同一组卡上跑完整条请求 | 两张卡：一张跑 E，一张跑 PD | 脚本就是这么分的 |
| 37 个 token 的文字 | 文字 + 一张图 | 只有带图片（或音频）的请求才会被送去 E |

## E 节点不留笔记，也不跑语言模型

E 节点上的进程**既不分 [KV Cache](kv-cache.md)，也不跑语言模型那几十层**。启动时它一层注意力都不登记，引擎自然一块 KV 也不给它；于是官方脚本敢把 E 的显存比例只写成 1%，而 PD 那边写 90%。每次收到请求，它只把图喂进视觉编码器，算完就返回一个「空」结果，语言模型的前向根本不开始。

代理那边也不看 E 返回了什么，只等它说一声「成了」，就把原请求转给 PD。

**但要算清楚代价：拆出去的只有视觉编码器那一段算力，权重没拆。** E 节点跑的是同一个模型的同一条启动命令，整份权重照样加载，所以 1E1PD 的两张卡上各摆着一份 7B 权重，其中一张只用得上它的视觉编码器。省下的是 PD 那边的编码算力和首 token 延迟，花掉的是一整张卡的权重显存。

## 两个节点之间只有一个共享目录

E 算好的 embedding 怎么到 PD 手里？答案很朴素：**写成文件放进一个目录，PD 去那个目录里找。** 每张图按内容算一个指纹，一张图一个子目录；E 把张量先搬回 CPU 再存盘，PD 查的时候就是看这个文件在不在。目录默认是本机的临时目录，所以两个节点要么在同一台机器上，要么自己换成真正的共享存储——官方没给别的传法。

这和 [PD 分离](pd-disaggregation.md)那边正好相反：P 到 D 的 KV 传输昇腾自己写了一整套连接器；E 到 PD 这一段昇腾没有自己的实现，用的就是上游这一个参考实现。

## 盘上已有的图不占 PD 的编码额度

PD 的调度器每一步给视觉编码留了一份额度（和一步能处理的 token 数一样大），每张要本地编码的图都从里面扣。**已经在盘上的图走另一条路：只登记「待读取」，不扣这份额度。** 所以外部加载的图等于把额度白送给同一批里别的图。

读取发生在 PD 节点真正干活的进程里：拼 embedding 之前先把文件读进内存里的编码缓存，后面的 prefill 看到的就和本地算出来的一样。只有「消费方」角色会去读。昇腾自己改过的几个调度器（比如[重算调度器](recompute-scheduler.md)）把这几处原样照搬了，换调度器不影响这条链。

## 两种拆法，差的只是一个开关

- **E + PD**：P 和 D 合在一个节点里，只拆出 E。本页的例子就是这种，两张卡。它压根没有 KV 传输。
- **E + P + D**：三类节点全拆开，P 到 D 那一段走 PD 分离的 KV 传输。

两种拆法在代理上的区别只是「prefill 那一路给不给地址」。另外还有一种不是拆分部署的用法：一个节点既存又读，只为了让同一张图的编码结果跨进程复用——这个在 v0.23 上会出问题，见下面的版本差异。

## 常见误解

- **「E 节点只加载视觉编码器，所以很省显存。」**——省的只是 KV Cache 那一块，权重一点没省：E 和 PD 跑的是同一个模型。那个 1% 的显存比例压的是 KV 预算，不是权重。
- **「代理会把图和文字分开，只把图发给 E。」**——默认不会。默认模式只是把原请求整个复制一份、把最多生成数改成 1 再发给 E，文字原样带着；真正剥掉文字、每张图单发一条的是另一种分发模式。
- **「EPD 是 PD 分离的一部分，PD 配好就有了。」**——两套配置互不相干，连接器也是两套。E + PD 形态里 PD 合在一个节点，根本没有 KV 传输。

## 对照源码

### 怎么开

三个在册版本都有这个特性，文档口径一样：`epd_disaggregation.md` 在三个 commit 上都存在，v0.23 与 main 是同一个 blob，v0.26 与它们的差异只有四处 `prefill` → `pre-fill` 的拼写，所以按 v0.23 维护分支写 [S1]。官方的三条理由见 [S3]。

一份能跑的 E+PD 配置（裁自官方脚本 [C30][C31]）：

```bash
# E 节点：只跑视觉编码器，不要 KV 缓存
ASCEND_RT_VISIBLE_DEVICES=0 vllm serve Qwen/Qwen2.5-VL-7B-Instruct \
  --port 19534 --gpu-memory-utilization 0.01 --enforce-eager \
  --enable-request-id-headers --no-enable-prefix-caching \
  --ec-transfer-config '{"ec_connector": "ECExampleConnector", "ec_role": "ec_producer",
    "ec_connector_extra_config": {"shared_storage_path": "/tmp/ec_cache"}}'

# PD 节点：同一个模型、同一个目录，角色反过来
ASCEND_RT_VISIBLE_DEVICES=1 vllm serve Qwen/Qwen2.5-VL-7B-Instruct \
  --port 19535 --gpu-memory-utilization 0.9 --enforce-eager \
  --enable-request-id-headers \
  --ec-transfer-config '{"ec_connector": "ECExampleConnector", "ec_role": "ec_consumer",
    "ec_connector_extra_config": {"shared_storage_path": "/tmp/ec_cache"}}'

# 代理：E + PD 形态就把 prefill 这一路写成 disable
python examples/disaggregated_encoder/disagg_epd_proxy.py --port 10001 \
  --encode-servers-urls  http://localhost:19534 \
  --prefill-servers-urls disable \
  --decode-servers-urls  http://localhost:19535
```

每个值的来由：

- `ec_role` 必须给（见下一节）；`ec_producer` 是 E、`ec_consumer` 是 PD [C8]。
- 两个显存比例：E 侧 `get_kv_cache_spec` 在 producer 这一路直接 `return {}` [C26]，一层注意力都不登记，引擎一块 KV 也不给它 [D]，所以 0.01 够用；PD 侧 0.9。
- `--enable-request-id-headers` 让代理传过去的 `x-request-id` 生效，两侧都要开。
- `--prefill-servers-urls disable` 是代理认的字面量——`disable` / `none` / 空串都会把 `p_urls` 清成空表，prefill 那一跳整个不存在。E + PD 与 E + P + D 两种形态差的就是这一个参数。
- 代理的第一道判断是 `has_mm_input`：扫 `messages` 里每个 content 项，`type` 不是 `image_url` / `audio_url` / `input_audio` 就返回 False，`forward_non_stream` 里「先过 E」那一步整个跳过 [C35]。
- E 侧 `execute_model` 在 `_update_states` 之后分叉：只调 `_execute_mm_encoder`，然后 `return make_empty_encoder_model_runner_output(...)` [C25]。
- 连接器：上游注册表里 EC 这一类只注册了 `ECExampleConnector` 一项 [C10]。`save_caches` 先判 `if not self.is_producer: return`，再把张量 `detach().cpu()` 存成 safetensors [C13]；文件路径是 `<shared_storage_path>/<mm_hash>/encoder_cache.safetensors` [C15]，`shared_storage_path` 从 `ec_connector_extra_config` 里取，默认 `/tmp` [C12]；`has_cache_item` 就是一次 `os.path.exists` [C14]。**昇腾侧没有自己的 EC 连接器**：三个 commit 上 `git grep ec_connector -- vllm_ascend` 命中的全是引用上游符号的地方，`vllm_ascend/distributed/` 下没有 `ec_transfer` 目录 [I]。
- 调度：命中 `has_cache_item` 就把下标塞进 `external_load_encoder_input`、`num_embeds_to_schedule += num_encoder_embeds` 后 `continue`；本地编码那条路多一行 `encoder_compute_budget -= num_encoder_embeds` [C17]。这个预算每步从 `max_num_encoder_input_tokens` 起算，它等于 `max_num_batched_tokens` [C22]。外部加载的下标照样走 `update_state_after_alloc` 记进待加载表 [C18]，`build_connector_meta` 打包进 `scheduler_output`，worker 在 `start_load_caches` 里把文件读进 `encoder_cache`，时机在 `_gather_mm_embeddings` 之前 [C11]；mixin 里写死 `if ec_connector.is_consumer:` 才加载 [C19]。昇腾的 `RecomputeScheduler` 把这几处 `ec_connector` 调用原样抄了 [C27]。
- 分发模式：`--encoder-dispatch-mode` 默认 `single` [C37]，走 `_encode_single_request`，`deepcopy` 原请求再把 `max_tokens` 改成 1 [C34]；真正剥掉文字、每张图一条请求的是 `fanout`。

### 会报什么错

- 只给 `ec_connector` 而 `ec_role` 是 None，直接 `ValueError` [C9]。
- E 返回的「空」输出其实不空：`sampled_token_ids` 被填成 `[[0] for _ in req_ids]`，每条请求一个 token id 0 [C21]——紧挨着的注释写的却是「one empty list per request」`[!]`。代理只要一个 200，响应体不看。
- 文档给的示例路径 `examples/online_serving/disaggregated_encoder/disagg_1e1pd/` 两个仓库里都不存在 [S4] `[!]`——昇腾仓库里是 `examples/disaggregated_encoder/`，上游是 `examples/disaggregated/disaggregated_encoder/`；1E1P1D 那个脚本只有上游有，昇腾仓库里只有 1E1PD [D]。
- `_encode_single_request` 的 docstring 写着「with all text removed」，但实际文字原样带着 `[!]`。
- 文档限制里那句「Disable `--mm-processor-cache-gb 0` if you want to use cross-process caching」本身是拧的：该参数默认 4 GiB，注释写明「Set to 0 to disable this cache completely」[C23]，意思应是「想要跨进程复用就把它设成 0」`[!]`。
- v0.23 上 `ec_role: "ec_both"` 启动不报错，但实例吐不出一个真 token，见版本差异。

### 开销和什么时候别开

- **权重翻倍**：E 实例跑的是同一条 `vllm serve <同一个模型>`，整份权重照样加载，1E1PD 两张卡上各一份 7B 权重 [D]。`--gpu-memory-utilization 0.01` 压的是 KV 缓存预算，不是权重 [D]。
- **跨节点**：默认目录 `/tmp` 是本机的，跨机器必须自己挂共享存储，文档没给别的连接器 [I]。
- **限制**：文档只列两条——PD 那半边照 [PD 分离](pd-disaggregation.md)的限制算；另一条是上面那句 `--mm-processor-cache-gb` [S7]。
- **贯穿例子**：Qwen3.6-35B-A3B 的 PD 分离在三个版本的支持矩阵里都是 ❌（[one-request](one-request.md)），不要拿它来试 EPD。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支与 main | 意味着什么 |
|---|---|---|---|
| 文档 | 有 | 有，只差 4 处拼写 [S1] | 口径一致 |
| worker 判角色的写法 | `get_ec_transfer().is_producer` | `not get_ec_transfer().is_consumer` [C28][C29] | 上游两版一直是后者 [C20]；写 `ec_producer` 或 `ec_consumer` 时两种写法等价，只有 `ec_both` 分叉 [D] |
| `ec_role: "ec_both"` | 进 producer 分支：只跑视觉塔、返回空输出、KV 缓存 0 块 | 与上游一致，照常跑完整模型 | `[!]` v0.23 上它启动不报错，但这个实例永远吐不出一个真 token——而 `ec_both` 是上游有官方示例的正经形态 [C24][D] |

`ec_both` 是「一个实例自己存、自己读」，为的是官方列的第三条好处（跨进程复用编码结果），不是分离部署。v0.23 上要这个效果只能等升级。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 特性文档 | `docs/source/user_guide/feature_guide/epd_disaggregation.md` |
| EC 配置与角色 | 上游 `vllm/config/ec_transfer.py` |
| 连接器注册表、基类 | 上游 `vllm/distributed/ec_transfer/ec_connector/factory.py`、`base.py` |
| 落盘与查盘 | 上游 `vllm/distributed/ec_transfer/ec_connector/example_connector.py`，`save_caches` / `has_cache_item` |
| 命中不扣编码预算 | 上游 `vllm/v1/core/sched/scheduler.py`，挑编码输入那一段 |
| worker 读盘 | 上游 `vllm/v1/worker/ec_connector_model_runner_mixin.py` |
| E 侧只跑编码器、不分 KV | `vllm_ascend/worker/model_runner_v1.py`，`execute_model` / `get_kv_cache_spec` |
| 启动脚本与代理 | `examples/disaggregated_encoder/disagg_1e1pd_example.sh`、`disagg_epd_proxy.py` |
