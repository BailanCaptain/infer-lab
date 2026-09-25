---
id: rfork-identity
title: RFork 身份匹配：同模型、同布局，还要同一份分片
type: feature
summary: B 想借 A 的权重，两边必须各自算出一模一样的 seed key：先把模型版本、数值类型、并行大小和布局算成一个指纹，再加上「我要的是哪一份分片、是主模型还是草稿模型」。本页讲这把钥匙里有什么、没有什么，为什么同一个模型也可能找不到来源，以及为什么钥匙对上了也不代表权重内容一样。
aliases:
  - RFork fingerprint
  - RFork seed key
  - RFork 身份匹配
  - build_compatibility_fingerprint
  - build_seed_key
  - planner returned no compatible seed
chapters: []
order: 40
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L32-L104'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L107-L157'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L170-L251'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/identity.py#L254-L287'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L113-L176'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L441-L501'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L69-L109'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L192-L213'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork-terms
    kind: builds-on
    note: 必须先区分组内 rank、global rank、world size 与模型角色，才能理解 key 的组成
contradicts: []
updated: '2026-09-25'
rawSources:
  - >-
    raw/sha256-59591a4419847f7e688d941665e517ceeff58268f61c79d46d5e2398c4b5e7ce.md
  - >-
    raw/sha256-5bad70ef874cd30dbb1c42ecd2370b814b3bafa2c63fceb2ab55f1da7f506deb.md
  - >-
    raw/sha256-b497eef4c4973a8d3ffb141a76c2caf3aa52fc165c864cd90016ccf7555c796c.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## 同一个模型，B 为什么还是借不到 A 的权重

继续[总览](rfork.md)里的 A、B 场景：两边都跑同一份 Qwen3-0.6B，都只用一张卡（TP=1），张量并行编号都是 0。看上去 B 理所当然能借到 A 的权重——可只要 B 的数值类型、模型版本或者权重在卡上的排布方式和 A 不一样，Planner 就不会把 A 交给 B。

原因是 Planner 不按「这个目录看起来是同一个模型」来找来源，而是按一把钥匙精确匹配：这把钥匙叫 **seed key**，A 和 B 各自独立算出来，一个字节都不能差。它分两次算：

1. 先把「模型是哪个版本、数值怎么存、怎么切分、在卡上怎么排」这些配置写成一段固定格式的描述，算一次 SHA256，得到**兼容性指纹**——回答「这两份权重能不能互换」。
2. 再把指纹和「我要的是哪一份分片、是主模型还是草稿模型」拼在一起，再算一次 SHA256，得到 seed key——回答「我要的是其中哪一份」。

```wiki-diagram
file: rfork-identity
```

反过来，把用户的问题从 37 个 token 换成 100 个 token，seed key 不会变：输入的 token 和请求编号都不在这两段描述里。这把钥匙属于「模型怎么加载、怎么切分」，不属于某一条用户请求。

本页讲的是 RFork 工作版（钉在来源里的那个提交）的匹配规则；社区 v0.23 / v0.26 / main 上没有这两层哈希，版本边界见[总览](rfork.md)。

## 第一次哈希：两份权重能不能互换

指纹的描述里按意思可以分成六组。只要任何一组两边不一样，指纹就不同，A 和 B 就被分进两个池子。

| 组别 | 放进去的内容 | 为什么排错时要两边一起看 |
|---|---|---|
| 模型名字 | 模型地址、部署策略名 | 写法不同就分池；它们只是用来区分的文字，不会去下载模型 |
| 模型版本 | 模型的版本号；没写就去模型配置里找提交号 | 本地权重可能根本没有版本号，所以不能拿它证明内容相同 |
| 数值怎么存 | 数值类型、量化方法、整份量化配置的摘要 | 同样每个数 2 字节的两种类型也不能当成一样 |
| 模型结构 | 模型配置里的模型类型、架构名、配置类 | 区分主模型和结构不同的加载配置 |
| 怎么切分 | 张量并行、流水线并行、专家并行、数据并行各自的组大小，是否开了专家并行、是不是 MoE 模型 | 编号相同但切法不同，同一个编号拿到的权重含义也不同 |
| 在昇腾卡上怎么排 | 权重的 NZ 排布模式、硬件的权重排布策略 | 同一个模型换了排布策略，字节不能直接互换 |

算之前会先把描述「整理成固定样子」：字典按键排序、集合固定顺序、数值类型和枚举统一写法，尽量不把进程地址之类每次运行都会变的东西写进去——否则两边配置一样，指纹也会对不上。

模型版本按固定顺序找：先看显式指定的版本，再看模型版本字段，再去两类模型配置里找提交号。一个都没有就记为空。注意这只是「记下写了什么版本」，并没有去核对模型文件本身。

## 第二次哈希：要的是其中哪一份

指纹说明「能不能互换」，但一个实例切成几份时，B 的每张卡要的只是其中一份。所以 seed key 在指纹之外，还放进模型名字、部署策略名、三种并行编号和主 / 草稿角色。

| 身份 | 进不进最终的钥匙 | 意思 |
|---|---|---|
| 张量并行编号 | 直接进 | 拿同一块张量切片 |
| 流水线并行编号 | 流水线并行超过 1 段时读组内编号，否则记为空 | 拿同一段层 |
| 专家并行编号 | 开了专家并行、且没有明确标成「不是 MoE」时才读 | 拿同一份专家；这时专家并行组还没建好会直接报错 |
| 主模型 / 草稿模型 | 直接进 | 不把目标模型和草稿模型的权重清单混在一起 |
| 全局编号 | 不直接进 | 不该拿物理部署位置限制跨实例借用 |
| 数据并行编号 | 不直接进 | 但数据并行的组大小已经在指纹里 |
| 节点 IP、预填充 / 解码角色 | 两段描述里都没有 | 配置相同的跨节点实例、预填充和解码实例都有机会互借 |

怎么判断自己是草稿模型：运行类型写明是草稿，或者模型类型以 MTP 结尾、架构名以 MTP 模型结尾，都算。

## 一个实例的几张卡，可以各借各的

假设 B 用四张卡（TP=4）。B 的四个进程各自拿自己的 seed key 去问 Planner，并没有「整份模型从某一个来源实例拿」这样一次性的选择。四份分片完全可能来自不同的来源实例——示例 Planner 只是按 seed key 逐个挑一个还有空余名额的来源，不做跨卡的整体分配。

所以「借来的四份拼得起来」靠的是每份分片自己的钥匙和之后的权重清单核对，而不是「四张卡都选中了同一个 IP」。

## 钥匙对上了，也不能证明权重内容一样

两次哈希的输入都是**配置描述**：没有把权重读一遍算内容校验和，也没有把 RFork 代码的提交号写进指纹。如果有人悄悄替换了某个目录里的权重文件，但模型地址、版本号和其他配置都没变，两边仍然会算出同一把钥匙。

所以维护 RFork 时，要同时记下模型文件的版本和 RFork 代码的提交。改了传输方式、改了哪些张量要传、改了派生权重的含义之后，应该把旧来源隔离开——换一个新的部署策略名就能单独成池。但这只是运维上的隔离，不能替代一致性测试。

反过来也要小心：别为了绕过某个形状报错，就随手把对不上的字段从指纹里删掉。例如单批最多处理多少 token 这个配置并不在指纹里，和它相关的那块工作区是专门改成「留在本地、不借」的，原因见[张量布局](rfork-layout.md)。

## 「没找到来源」要分清是匹配不到，还是根本没问成

B 问 Planner 要来源，以下几种情况最后都会落到同一句「没有可用来源，改从本地加载」：

- Planner 明确说「这个钥匙下现在没有来源」；
- 同一把钥匙下的来源都满了——示例 Planner 会把这种情况也当作没有来源，它并不替 B 重新判断兼容性；
- 网络出错、Planner 返回了别的错误、或者回复缺了必要信息。

前两种是真的匹配不到，第三种是根本没问成，日志表面上看起来一样。排查时建议按这个顺序走：

1. 先把两边完整的指纹和 seed key 打出来比；
2. 确认来源实例确实登记成功、还没过期；
3. 看同一把钥匙下的来源是不是都占满了；
4. 看两边的请求是不是到了同一个 Planner 的状态存储；
5. 以上都没问题，才当成正常的冷启动（本来就还没有来源）。

## 常见误解

- **「seed key 就是模型地址」**——它是包含指纹和分片编号的 SHA256 摘要；只比路径查不全。
- **「指纹相同，权重就完全一致」**——指纹只是配置上能不能互换的门槛，内容是否一致还要靠模型版本和实测。
- **「改了并发相关的配置，就一定要换来源」**——要看这个配置是否进了指纹、或者是否影响要传的张量。那块 top-k 工作区是专门排除掉的，不能推广成「所有并发差异都兼容」。

## 对照源码

### 怎么开

seed key 需要两项配置：模型地址和部署策略名，可以写在 `model_loader_extra_config` 里，也可以用环境变量 `MODEL_URL` 和 `MODEL_DEPLOY_STRATEGY_NAME`。两者任一为空，`build_seed_key` 直接报错（见下一节）。`identity.py:263-269` [C4]

想让某批实例单独成池（例如改了传输协议或张量采集规则后隔离旧来源），换一个新的 `model_deploy_strategy_name` 即可——它同时进入指纹和 seed key。`identity.py:218-220`、`identity.py:276-285` [C3][I]

### 会报什么错

**算钥匙时：**

- `RuntimeError: RFork seed key is not set: model_url=..., model_deploy_strategy_name=...`——两项配置缺一项。`identity.py:263-269`
- `RuntimeError: RFork requires a compatibility fingerprint for the seed key`——没有先算指纹就算 seed key。`identity.py:270-274`
- 规范化遇到容器自引用会抛 `ValueError`，而不是无限递归。[C1]
- 开了 EP 且 `is_moe_model` 不是 `False`（为 `None` 也照读）时要读 EP 组内 rank；EP 组未初始化会直接报错。[C5][C6]

**向 Planner 要来源时**（`PlannerClient.acquire_seed`，`planner_client.py:69-109`）[C7]：

- `GET /get_seed`，请求头只带 `SEED_KEY`；返回 404 视为当前无可用来源，只打 debug 日志，返回 `None`。`planner_client.py:72-79`
- 非 200 状态、响应头缺 `SEED_IP` / `SEED_PORT` / `USER_ID` / `SEED_RANK` 任一项、端口或 rank 不是合法整数，都会抛异常，被统一捕获成 warning `RFork planner seed acquisition failed: ...` 并返回 `None`。`planner_client.py:80-109`
- 加载器拿到 `None` 后抛内部的 `_RForkSeedUnavailable("planner returned no compatible seed")`，随后打印 `RFork has no available %s seed; loading locally and registering this worker as a seed.`（只在汇总 rank 上是 info，其余 rank 是 debug）。`rfork_loader.py:619-620`、`rfork_loader.py:647-649`

示例 Planner 在同一 key 下的来源都没有空余资源点时同样返回无来源，它不替客户端重新计算兼容性。[C8]

**关于 `is_draft_worker`：** 这是保留的 wire-format 字段名——Python 形参叫 `is_draft_model`，写进被哈希的 JSON 描述符时改叫 `is_draft_worker`，为的是和早先算出的 seed key 保持一致。`identity.py:283-284` 它只存在于这段 JSON 里，Planner 的 HTTP header 中没有这个字段——去协议里找它会一无所获，但不代表角色没进 key。

### 开销和什么时候别开

- 指纹和 seed key 都只哈希配置描述，**不读权重、不算内容 checksum、不含 RFork 代码提交号**。`identity.py:218-251`、`identity.py:276-287`[D]
- `max_num_batched_tokens` 没有直接进入指纹；patch7 把相关的 `topk_indices_buffer` 留在本地不传，原因见[张量布局](rfork-layout.md)。不要为绕过 shape 报错把不匹配字段从指纹里删掉。
- 修改传输协议、张量采集规则或派生权重语义后应隔离旧 seed；新部署策略名只是运维隔离，不能代替一致性测试。[I]

### 版本差异

两层哈希只在 RFork 工作版（`rfork@3284850b`）里有；社区 vLLM-Ascend v0.23 / v0.26 / main 上没有对应的指纹与 seed key，版本边界见[总览](rfork.md)。

工作版内部，`is_draft_worker` 字段名是为了和旧 seed key 兼容而保留的，改名会让新旧实例算出的 key 对不上。`identity.py:283-284`

### 源码位置

指纹描述符的精确字段（`build_compatibility_fingerprint`，`identity.py:196-251`）：

| 组别 | 字段 |
|---|---|
| 模型标识 | `model_url`、`model_deploy_strategy_name` |
| 模型版本 | `model_revision`（`_get_model_revision`） |
| 数值表示 | `dtype`、`quantization`、`quantization_config`（整体摘要） |
| 模型结构 | `architecture`：`hf_config` / `hf_text_config` 的 model type、architectures、配置类 |
| 并行布局 | `parallel`：`tensor_world_size`、`pipeline_world_size`、`expert_world_size`、`data_world_size`、`expert_parallel_enabled`、`is_moe_model` |
| 昇腾布局 | `weight_layout`：`weight_nz_mode`、`hardware_policy`（硬件 profile 的 `weight_layout_policy`） |

序列化用 `json.dumps(sort_keys=True, separators=(",", ":"))` 后取 `hashlib.sha256`。`identity.py:245-251`

seed key 描述符（`build_seed_key`，`identity.py:254-287`）：`compatibility_fingerprint`、`model_url`、`model_deploy_strategy_name`、`tp_rank`、`pp_rank`、`ep_rank`、`is_draft_worker`。

- `identity.py:32-104`：`_canonicalize_fingerprint_value` 规范化——排序字典键、固定集合顺序、统一 dtype / Enum 表示，避免不稳定的 `repr`；自引用抛 `ValueError`。
- `identity.py:107-157`：模型 revision 取值顺序——显式 `revision`、`model_revision`，再看 `hf_config` / `hf_text_config` 的 `_commit_hash` / `commit_hash` / `revision`；都没有则为 `None`。
- `identity.py:170-251`：`build_compatibility_fingerprint`。
- `identity.py:254-287`：`build_seed_key`。
- `rfork_loader.py:113-176`：draft 判断——`runner_type == "draft"`，或 model type 以 `_mtp` 结尾、architecture 以 `MTPModel` 结尾（`_is_mtp_hf_config` 在 `rfork_loader.py:112-126`，`_is_draft_model` 在 `rfork_loader.py:141-145`）。
- `rfork_loader.py:441-501`：读取 TP / PP / EP rank 与 `is_draft_model` 并构造 seed key；TP=4 时各 Worker 各自匹配分片，一致性依赖各分片的身份与元数据检查。[D]
- `planner_client.py:69-109`：`acquire_seed`。
- `examples/rfork/rfork_planner.py:192-213`：示例 Planner 按 seed key 逐次挑一个还有余量的来源，不做跨 rank 的整体分配。
