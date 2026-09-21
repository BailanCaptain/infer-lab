---
id: epd-disaggregation
title: "EPD 分离：把视觉编码器也拆成一类实例"
type: feature
summary: 多模态模型的视觉编码器单独起一个实例（E），算出的图像 embedding 经 EC 连接器交给 prefill/decode 那边，PD 上不再跑视觉塔。
aliases: [EPD 分离, EPD Disaggregation, Disaggregated-encoder, 分离式编码器, 编码器分离, E 实例, ec_transfer_config, ec_role, ECConnector, ECExampleConnector, encoder cache, EC 连接器]
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
    note: E 是在 P 和 D 之外再拆出来的第三类实例；KV 怎么在 P 和 D 之间传归那一页，这一页只管 embedding 怎么从 E 到 P
  - to: one-request
    kind: builds-on
    note: 那条纯文本请求连代理的第一道判断都过不去，这一页说明把模型和输入换成什么才触发得了
  - to: vllm-scheduler
    kind: builds-on
    note: 「盘上命中的图不扣编码算力预算」发生在调度器挑编码输入那一段，每步怎么发名额由那一页讲
contradicts: []
updated: "2026-09-22"
origin: seed
---

## 一句话

EPD 分离是在 [PD 分离](pd-disaggregation.md)之上**再拆出一类实例**：多模态模型的视觉编码器单独起一个 vLLM 进程（E），它算出的图像 embedding 交给 prefill / decode 那边，PD 上就不用再跑一遍视觉塔。官方给的理由是三条——**编码器和语言模型体量差着数量级、该各自扩缩；纯文本请求整条绕开视觉塔；编码结果能跨进程复用** [S3]。

三个在册版本上都有这个特性，而且文档口径一样：`git ls-tree` 比下来 `epd_disaggregation.md` 在三个 commit 上都存在，v0.23 与 main 还是同一个 blob，v0.26 与它们的差异只有四处 `prefill` → `pre-fill` 的拼写。所以正文按 v0.23 维护分支写 [S1]。但昇腾侧 worker 判角色的那一行 v0.23 与上游不同，`ec_both` 会踩到，见下面的差异表。

```wiki-diagram
file: epd-disaggregation
```

## 那条请求用不到它

[那条请求](one-request.md)是 Qwen3-0.6B 上一句 37 个 token 的纯文本问题——**没有图，整条 EPD 链路一步都不会走。** 代理的第一道判断就是 `has_mm_input`：扫 `messages` 里每个 content 项，`type` 不是 `image_url` / `audio_url` / `input_audio` 就返回 False，于是 `forward_non_stream` 里「先过 E」那一步整个跳过，请求直奔 PD。

要走到这里，得把它的三项设定换掉 [A]：

| 那条请求 | 换成什么 | 为什么是这个 |
|---|---|---|
| Qwen3-0.6B，纯语言 | Qwen2.5-VL-7B-Instruct | 官方 1E1PD 脚本的默认模型，带视觉塔 |
| 单卡 | 两张卡，`CARD_E=0` 跑 E、`CARD_PD=1` 跑 PD | 脚本就是这么分的 |
| 37 个 token 的文字 | 文字 + 一张 base64 图 | 只有 `image_url` 这类项才让 `has_mm_input` 为真 |

## E 实例不是「小一号的模型」，是一个不分 KV 缓存的壳

**E 上那个进程既不分 KV 缓存、也不跑语言模型的前向。** 两处代码各管一件：

- `get_kv_cache_spec` 在这一路直接 `return {}` [C26]，一层注意力都不登记，引擎自然一块 KV 也不给它 [D]。这就是启动脚本敢把 E 的 `--gpu-memory-utilization` 写成 **0.01**、而 PD 那边同一个脚本写 **0.9** 的原因 [C30]。
- `execute_model` 在 `_update_states` 之后就分叉：只调 `_execute_mm_encoder`，然后 `return make_empty_encoder_model_runner_output(...)`，语言模型的前向根本没到。

那这次 HTTP 调用凭什么返回 200？因为那个「空」输出并不空：`sampled_token_ids` 被填成 `[[0] for _ in req_ids]`，每条请求一个 token id 0 [C21]——紧挨着的注释写的却是「one empty list per request」`[!]`。代理要的本来也只是一个 200，响应体它不看。

**代价要算清楚：拆出去的只有视觉塔那一段算力，权重没拆。** E 实例跑的是同一条 `vllm serve <同一个模型>`，整份权重照样加载，所以 1E1PD 的两张卡上各摆着一份 7B 权重，其中一张只用得着它的视觉塔 [D]。省下的是 PD 的编码算力和 TTFT，花掉的是一整张卡的权重显存。

## 连接器只有一个，而且它是在往磁盘上写文件

上游注册表里 EC 这一类只注册了 `ECExampleConnector` 一项 [C10]，文档也直说当前的参考通路就是它。**昇腾侧没有自己的 EC 连接器**：三个 commit 上 `git grep ec_connector -- vllm_ascend` 命中的全是引用上游符号的地方，`vllm_ascend/distributed/` 下没有任何 `ec_transfer` 目录 [I]。这和 [PD 分离](pd-disaggregation.md)那边昇腾自己写了一整套 Mooncake 连接器正好相反。

它做的事很朴素：E 侧 `save_caches` 先判 `if not self.is_producer: return`，再把张量 `detach().cpu()` 存成 safetensors；文件路径是 `<shared_storage_path>/<mm_hash>/encoder_cache.safetensors` [C15]，`shared_storage_path` 从 `ec_connector_extra_config` 里取，默认 **`/tmp`** [C12]；PD 侧的 `has_cache_item` 就是一次 `os.path.exists`。所以「连接器」在 1E1PD 里等于**两个进程共用一个目录**，跨节点得自己换成真正的共享存储，文档没给别的实现 [I]。

顺带一个坑：文档给的示例路径 `examples/online_serving/disaggregated_encoder/disagg_1e1pd/` 两个仓库里都不存在 [S4] `[!]`——昇腾仓库里是 `examples/disaggregated_encoder/`，上游是 `examples/disaggregated/disaggregated_encoder/`；而且 1E1P1D 那个脚本只有上游有，昇腾仓库里只有 1E1PD 一个 [D]。

一份能跑的 E+PD 配置（裁自官方脚本）：

```bash
# E 实例：只跑视觉塔，不要 KV 缓存
ASCEND_RT_VISIBLE_DEVICES=0 vllm serve Qwen/Qwen2.5-VL-7B-Instruct \
  --port 19534 --gpu-memory-utilization 0.01 --enforce-eager \
  --enable-request-id-headers --no-enable-prefix-caching \
  --ec-transfer-config '{"ec_connector": "ECExampleConnector", "ec_role": "ec_producer",
    "ec_connector_extra_config": {"shared_storage_path": "/tmp/ec_cache"}}'

# PD 实例：同一个模型、同一个目录，角色反过来
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

每个值的来由：`ec_role` 必须给，只给 `ec_connector` 而 `ec_role` 是 None 会直接 `ValueError`；两个显存比例见上一节；`--enable-request-id-headers` 是让代理传过去的 `x-request-id` 生效，两侧都要开；`--prefill-servers-urls disable` 是代理认的字面量——`disable` / `none` / 空串都会把 `p_urls` 清成空表，于是 prefill 那一跳整个不存在。文档说的两种形态（E + PD 合并、E + P + D 全拆）差的就是这一个参数。

## 盘上命中的那张图不占 PD 的编码算力预算

结论：PD 上一张已经在盘上的图，**既不跑视觉塔，也不从 `encoder_compute_budget` 里扣额度**。

调度器挑编码输入时先问 `has_cache_item`；命中就把下标塞进 `external_load_encoder_input`、`num_embeds_to_schedule += num_encoder_embeds`，然后 `continue`。紧跟在 `continue` 后面的才是本地编码那条路，它比前者多一行 `encoder_compute_budget -= num_encoder_embeds` [C17]——**跳过的正是这行减法**。这个预算每步从 `max_num_encoder_input_tokens` 起算，而它就等于 `max_num_batched_tokens` [C22]，所以外部加载的图等于白送额度给同批的其它图 [D]。

两条路在 worker 侧汇合：外部加载的下标照样走 `update_state_after_alloc` 把 `mm_hash` 记进待加载表，`build_connector_meta` 打包进 `scheduler_output`，worker 再在 `start_load_caches` 里把文件读进 `encoder_cache` 字典，时机是 `_gather_mm_embeddings` 之前。这一路**只有 consumer 走**：mixin 里写死了 `if ec_connector.is_consumer:` 才加载。换掉调度器不影响这条链——昇腾 fork 的 [RecomputeScheduler](recompute-scheduler.md) 等几个调度器都把上游这几处 `ec_connector` 调用原样抄了过去。

文档列的限制只有两条：PD 那半边照 [PD 分离](pd-disaggregation.md)那页的限制算；另一条写的是「Disable `--mm-processor-cache-gb 0` if you want to use cross-process caching」，这句话本身是拧的——该参数默认 **4 GiB**，它自己的注释写明「Set to 0 to disable this cache completely」[C23]，所以它想说的是「想要跨进程复用就把它设成 0」`[!]`。

## v0.23 上 `ec_both` 会把实例变成哑巴

| 项 | v0.23 维护分支 | v0.26 分支与 main | 意味着什么 |
|---|---|---|---|
| worker 判角色的写法 | `get_ec_transfer().is_producer` [C25] | `not get_ec_transfer().is_consumer` [C28] | 上游两版一直是后者；写 `ec_producer` 或 `ec_consumer` 时两种写法等价，只有 `ec_both` 分叉 [D] |
| `ec_role: "ec_both"` | 进 producer 分支：只跑视觉塔、返回空输出、KV 缓存 0 块 | 与上游一致，照常跑完整模型 | `[!]` v0.23 上它启动不报错，但这个实例永远吐不出一个真 token——而 `ec_both` 是上游有官方示例的正经形态 [D] |

`ec_both` 是「一个实例自己存、自己读」，为的是官方列的第三条好处（跨进程复用编码结果），不是分离部署。v0.23 上要这个效果只能等升级。

## 常见误解

- **「E 实例只加载视觉塔，所以很省显存。」**——省的只是 KV 缓存那一块，权重一点没省：E 和 PD 跑的是同一条 `vllm serve`、同一个模型。`--gpu-memory-utilization 0.01` 压的是 KV 缓存预算，不是权重 [D]。
- **「代理会把图和文字分开，只把图发给 E。」**——默认不会。`--encoder-dispatch-mode` 默认是 `single` [C37]，走的 `_encode_single_request` 只是 `deepcopy` 一份原请求再把 `max_tokens` 改成 1，文字原样带着——尽管它的 docstring 写着「with all text removed」`[!]`。真正剥掉文字、每张图一条请求的是 `fanout` 那条路。
- **「EPD 是 PD 分离的一部分，PD 配好就有了。」**——两套参数互不相干：PD 走 `--kv-transfer-config`，EPD 走 `--ec-transfer-config`，连接器注册表也是两个。E + PD 形态里 PD 合在一个实例里，压根没有 KV 传输。
