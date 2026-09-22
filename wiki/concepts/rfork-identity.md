---
id: rfork-identity
title: RFork 身份匹配：同模型、同布局，还要同一份分片
type: feature
summary: 两层 SHA256 分别表达配置兼容性和分片身份。说明指纹包含哪些字段、不包含什么，为什么同名模型仍找不到 seed，以及为什么不能把匹配当成权重内容验证。
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
updated: '2026-09-23'
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

## 一句话

**Planner 不按“这个目录看起来是同一模型”找 seed，而是按两端独立算出的 seed key 精确匹配。** 工作版先把兼容性配置算成 fingerprint，再把 fingerprint 与分片位置、main/draft 角色算成 seed key。[C3][C4]

本页讲的是 RFork 工作版（钉在来源里的那个提交）的匹配规则，社区 v0.23 / v0.26 / main 上没有这两层哈希；版本边界见[总览](rfork.md)。

```wiki-diagram
file: rfork-identity
```

## 那条请求换到第二个实例，权重身份必须对上

继续[总览](rfork.md)里的 A、B 教学场景：两端都跑同一份 Qwen3-0.6B、TP=1。TP rank 都为 0，这只是其中一个条件。B 的 dtype、模型 revision 或布局策略不同，fingerprint 仍会变，Planner 就不会选中 A。[A]

反过来，把问题由 37 token 换成 100 token，不会直接改变 seed key：输入 token 和请求 ID 不在描述符中。key 属于模型加载与分片，不属于每条用户请求。[C3][C4]

## 第一层哈希说明“配置上可不可以互换”

`build_compatibility_fingerprint` 的描述符包含下列组别。这里按语义分组，精确字段以源码为准。[C3]

| 组别 | 纳入的内容 | 为什么排错时需要两边一起看 |
|---|---|---|
| 模型标识 | `model_url`、`model_deploy_strategy_name` | 文本不同就分池；它们不是在线下载动作 |
| 模型版本 | model revision，缺省时尝试 HF config 的提交信息 | 本地权重可能没有 revision，不能据此证明内容相同 |
| 数值表示 | dtype、量化方法、量化配置整体摘要 | 同为 2 字节的两种 dtype 也不能当成一样 |
| 模型结构 | `hf_config` / `hf_text_config` 的 model type、architectures、配置类 | 区分主模型和不同结构的加载配置 |
| 并行布局 | TP、PP、EP、DP world size，是否启用 EP、是否为 MoE | rank 相同但切分方式不同，权重含义仍不同 |
| 昇腾布局 | `weight_nz_mode`、hardware layout policy | 相同模型在不同布局策略下，不能直接交换字节 |

规范化会排序字典键、固定集合顺序、统一 dtype / Enum 的表示，尽量避免把进程地址之类不稳定的 `repr` 写进摘要。遇到容器自引用会抛 `ValueError`，而不是无限递归。[C1]

模型 revision 的取值顺序是显式 `revision`、`model_revision`，再看两类 HF config 的 `_commit_hash` / `commit_hash` / `revision`。都没有就为 None；这不是自动校验了模型文件。[C2]

## 第二层哈希说明“我需要其中哪一份”

seed key 的输入是 fingerprint、模型标识、部署策略、`tp_rank`、`pp_rank`、`ep_rank` 和布尔角色 `is_draft_worker`。最后一个是保留的 wire-format 字段名：Python 形参叫 `is_draft_model`，写进被哈希的那段 JSON 描述符时改叫 `is_draft_worker`，为的是和早先算出来的 seed key 保持一致 [C4]。它只存在于这段 JSON 里，Planner 的 HTTP header 中没有这个字段——去协议里找它会一无所获，但不代表角色没进 key。

| 身份 | 是否进入最终匹配 | 具体含义 |
|---|---|---|
| TP rank | 直接进入 key | 取同一张量切片 |
| PP rank | PP>1 时读组内 rank，否则 None | 取同一流水线层段 |
| EP rank | 开了 EP、且 `is_moe_model` 不是 `False` 时才读（是 `None` 也照读） | 取同一专家分片；EP 组没初始化会直接报错 |
| main / draft | 直接进入 key | 不把目标模型和草稿模型的清单混在一起 |
| global rank | 不直接进入 key | 不应拿物理部署编号限制跨实例复用 |
| DP rank | 不直接进入 key | 但 DP world size 已进入 fingerprint |
| 节点 IP、P/D 角色 | 不在这两份描述符里 | 同配置的跨节点、P/D 实例有机会共享来源 |

rank 读取与 draft 判断见加载器；draft 除了 `runner_type == "draft"`，还识别 `_mtp` model type 和以 `MTPModel` 结尾的 architecture。[C5][C6]

TP=4 时，B 的四个 Worker 各自找匹配分片，并没有一个“整模型 seed 实例”的原子选择动作。它们可以来自不同来源实例——示例 Planner 只按 seed key 逐次挑一个还有余量的来源，不做跨 rank 的整体分配 [C8]；一致性依赖各分片的身份与元数据检查，不是“所有 rank 都选中了同一个 IP”。[C6][C7][D]

## key 一样仍不能证明权重内容相同

这两层哈希输入的都是配置描述，**没有读取所有权重并计算内容 checksum，也没有把 RFork 代码提交号写进 fingerprint**。两个目录的权重被悄悄替换，但 model_url、revision 和其他字段不变，仍可能算出相同 key。[C3][C4][D]

因此维护 RFork 时要同时记录模型文件版本和 RFork 提交。修改传输协议、张量采集规则或派生权重语义后，应隔离旧 seed；可使用新的部署策略名建立独立池，但这只是运维隔离，不能代替一致性测试。[I]

`max_num_batched_tokens` 没有直接进入 fingerprint。patch7 专门把相关的 `topk_indices_buffer` 留在本地，原因见[张量布局](rfork-layout.md)。不要为绕过 shape 报错随意把不匹配字段从指纹删掉。

## “没找到 seed”要分清匹配不到和根本没查成功

`GET /get_seed` 的 404 被视为当前无可用来源；返回 200 还必须包含 IP、port、USER_ID、rank。网络异常、非 200 状态、不完整响应，也会记录 acquisition failed 并返回 None。加载器最终都可能打印“没有 seed”。[C7]

示例 Planner 还会检查可用资源点：相同 key 下所有来源都满了，同样返回无来源。它并不替客户端重新计算兼容性。[C8]

排查顺序：确认两端完整 fingerprint / seed key → 确认来源上报成功且未过期 → 查相同 key 下的容量 → 查请求是否到达同一个 Planner 状态存储 → 最后再解释为正常冷启动。[I]

## 常见误解

- **“SEED_KEY 就是 model_url”**——它是包含指纹与 rank 的 SHA256 摘要；只比较路径查不全。
- **“fingerprint 相同就是权重完全一致”**——这是配置兼容性门槛，内容一致性仍需模型版本与实测证据。
- **“改了并发配置一定必须换 seed”**——要看该配置是否影响兼容性描述符或可传张量。patch7 对 topk 工作区做了明确排除，不能推广为所有并发差异都兼容。
