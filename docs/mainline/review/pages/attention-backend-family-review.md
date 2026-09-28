# attention-backend-family 审查记录

## P5 写作记录（2026-09-28，深改）

### 改了什么

按六步骨架重写全页：问题式 H2 +「后端是模型层和设备算子之间的那层代码」一句话定义 + 直觉图 → 为什么要分出这一层 / 两条代价 → 放到 GLM 双机沿一个 token 落数字（含 Runner 分组）→ 四类特殊"层"集中讲 → 常见误解 6 条 → 对照源码五个 H3。旧版 7 个平铺 H2 里的结论全部落位，没有新增未经核对的说法。

- 直觉图 `wiki/diagrams/attention-backend-choice.yaml` 重画：只画"层类型 → 后端 → 算子"的两条分支和份数（KDA 34 层、稀疏 MLA 11 层 + MTP 第 45 层，外加同层挂的两个缓存后端），不写字节，画布 900×470。按 `wiki:diagrams` 的建议去掉了图上的代码名和整句说明。
- 原 `flash-attention-3` 页并入的内容改成一节「如果模型是密集注意力：FA3 这条分支」，删掉「只作搬运，未重写文风」这句页面上的 meta 文本。
- 新增：Runner 分组键的说明与 GLM 的实际分组结果、"一个稀疏 MLA 层注册三个条目"、MTP 第 45 层为什么也走 MLA、常见误解里关于平台选择表和单测参考实现的两条。

### 出处修订（本批验收要点）

| 原出处 | 问题 | 换成 |
|---|---|---|
| `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L980-L1061`（旧文件第 18 行） | 落在 `_sparse_attention_pytorch`（L857–L1064）里，这个方法没有生产调用点，只被 `tests/ut/models/test_glm5_next_indexer_kpool_mla.py` 调用 | `#L1065-L1104`（`_execute_sparse_flash_attention_process` 重写）、`vllm_ascend/device/device_op.py#L719-L793`（`npu_sparse_flash_attention`）、`vllm_ascend/attention/sfa_v1.py#L1994-L2028`（父类调用点与算完之后的 V 解压、输出投影） |

全页其余 14 条旧出处逐条看过，没有第二条指向 `tests/`：`glm5_next.py`、`utils.py`、`kimi_kda.py`、`model_runner_v1.py`、`platform.py`、`fa3_v1.py`、官方文档与两篇论文都在生产路径或文档上。这条错误出处同时写进了正文「常见误解」第 3 条，说明那段 PyTorch 参考实现里 query 按 16 个一块的分块常量不能用来描述 NPU 推理的 tiling。

来源表从 17 条扩到 36 条，按"怎么开 / 会报什么错 / 版本差异"的需要补齐了上游入口（`vllm@0fc695fc`）与三个快照（2c59ff10 / 2ed6cbba / baa023ad）的对应行号。

### 数字取自哪一节

- 层构成 45 = 34 KDA + 11 稀疏 MLA（第 3、7、11 … 43 层），MTP 第 45 层也是稀疏 MLA、存 KV 的是 12 层：`docs/mainline/02-forward.md` §0 的层类型表、§0.4 排除表与 §5.6 前的说明。
- 稀疏 MLA 每查询最多 2051 个位置、一层一卡 33.6 MFLOP / token、主干 11 层约 370 MFLOP / token：`02-forward.md` §5.5，标为 `[D]` 的静态上界；挑选过程本身不重算，链接 `sparse-attention.md`。
- KDA 分支的算子与 PCP 拒绝：`02-forward.md` §4.2。
- R1 第一步 1 条请求 4 个 token（教学设定）、每卡 KDA 8 头 / MLA 8 头：`01-deploy-entry-schedule.md` §A3。

### 核心概念对照了哪份源码

「GLM 各层实际走哪个后端、哪个算子」全部用 `git -C tools/repos/vllm-ascend show <commit>:<path>` 读原文核过：

- 层类型分支 `glm5_next.py#L2072-L2105`、判断函数 `#L216-L227`。
- KDA 层：模型层构造上游 `KimiGatedDeltaNetAttention`（`#L2081`），算子注册表在 `utils.py#L763-L768` 的 `vllm_version_is("0.23.0")` 分支里把它换成 `AscendKimiGatedDeltaNetAttention`；该类 `get_attn_backend` 返回 `AscendGDNAttentionBackend`（`kimi_kda.py#L232-L233`）。算子：decode 走 `recurrent_kda`（`#L368`），prefill 走 `kda_gate_cumsum` + `chunk_kda_fwd`（`#L439`、`#L452`、`#L459`），短卷积走 `npu_causal_conv1d_custom`（`#L312`）；`#L402-L403` 抛 `NotImplementedError("Kimi KDA prefill does not yet support PCP.")`。
- 稀疏 MLA 层：`AscendIndexerKPoolMLAAttention`（`glm5_next.py#L2018-L2049`）→ 后端 `AscendIndexerKPoolMLABackend`（`#L171-L178`）→ `indexer_kpool_mla_v1.py#L1065-L1104` → `device_op.py#L719-L793` 的 `torch.ops._C_ascend.npu_sparse_flash_attention`（`sparse_mode != 3` 直接抛 `ValueError`）。
- 同层的两个缓存后端：`AscendIndexerKPoolBackend`（`glm5_next.py#L306-L307`，规格 `MLAAttentionSpec`）与 `AscendIndexerKPoolStateBackend`（`#L364-L365`，规格 `AscendIndexerKPoolStateSpec`），两者 `forward` 为空。
- 分组键：`model_runner_v1.py#L5039-L5063`，键是 `(full_cls_name, layer_kv_cache_spec)`；`#L5065-L5083` 每组建一个元数据构建器。
- 「GLM 不走平台选择表」：平台表在 `platform.py#L805-L831`，按 `(use_mla, use_sparse, use_compress)` 取值；GLM 的层自己实现 `get_attn_backend()`，Runner 直接调层的方法，不经过 `get_attn_backend_cls`。上游只有 `MLAAttention` 这类通用层才在 `vllm@0fc695fc:vllm/model_executor/layers/attention/mla_attention.py#L386-L392` 调 `get_attn_backend` 进平台表。

### 版本差异口径

v0.23 列 = 2c59ff10，v0.26 列 = 2ed6cbba，main 列 = baa023ad；db701c1f 单独标注为本部署专用镜像的 orphan commit，不算进 v0.23 列。表头写法照 `wiki/concepts/data-parallel.md` 的「版本差异」。逐条核过：

- `ls-tree | grep glm5 | grep '\.py$'`：2c59ff10 没有任何 GLM Python 文件，2ed6cbba 只有 `tests/e2e/pull_request/eight_card/test_glm5_2.py`（GLM5.2 的端到端测试），baa023ad 有 `vllm_ascend/models/glm5next/` 整包。
- Kimi KDA 注册：db701c1f 在版本分支里；2ed6cbba `utils.py#L706-L732` 在无条件字典里；baa023ad 的类改名为 `AscendKimiK3DeltaAttention`。
- main 的 GLM KDA 层 `models/glm5next/kda.py#L266-L267` 仍返回 `AscendGDNAttentionBackend`；稀疏 MLA 层改用上游 `MultiHeadLatentAttentionWrapper`（`models/glm5next/attention.py#L301-L327`），后端因此回到平台表的 `AscendSFABackend`；尾状态后端改名 `AscendIndexerKPoolTailBackend`（`kv_cache.py#L173-L178`）。
- FA3 触发条件：2c59ff10 / 2ed6cbba / db701c1f 都是「显式选 `FLASH_ATTN` 且 `use_batch_invariant`」；baa023ad 改成「没开 PCP 且 `rl_config.enable_training_consistency`」（`platform.py#L1357-L1364`），310P 分支换成按硬件画像判断并另加 PCP 专用表。

### 旧版信息清单勾选

清单 21 条存在 `scratchpad/p5/attention-backend-family-facts.md`，逐条勾选结果：**20 条保留**（位置见清单），**1 条改写后保留**——F5 旧版说"固定参考路径接收已有候选索引，检查因果范围与位置有效性"，那段描述的正是只供单测使用的 `_sparse_attention_pytorch`；新版按生产路径改成"设备算子只在选中的位置上读潜向量、打分、汇合"，挑选与因果范围的推导链接 `sparse-attention.md`。**没有删除任何一条。** F7 的投影 / 门控 / 输出归一化逐步细节留在 `linear-attention.md`，本页只保留分支结论和源码行号。

### 验证

- `pnpm wiki:lint`：退出码 1，4 条阻塞错误全部属于别人的页（`concepts/vllm-v1-shape.md`、`diagrams/vllm-v1-shape-loop.yaml`、`diagrams/worker-lifecycle-flow.yaml`、`concepts/npu-worker-lifecycle.md`）；`grep -c attention-backend-family` = 0。中途本页报过两次 `mark-flood`（角标 45 处、C 级 84%），已用区间写法压到 30 以内并给两条静态推导挂 `[D]`，现已无条目。
- `pnpm wiki:diagrams`：退出码 0，只更新本页的 `attention-backend-choice.svg`；`--check` 的 2 条失败都在 `diagrams/vllm-v1-shape.yaml`。
- `pnpm wiki:audit`：本页一行由 `✗ 1 条有问题`（`glm5next/attention.py#L301-L330` out-of-range，文件只有 327 行）改成全 ✓，正文 8571 字 / 7 节 / 来源 36 条；剩下的 1 条失败在 `concepts/vllm-v1-shape.md`。
- 没起服务、没占端口、没改 `standard-pages.json`、没提交 git；没碰 `npu-worker-lifecycle`、`vllm-v1-shape`、`vllm-kv-block-allocation`。

### 读文件纪律

严格串行，每次一个工具调用；HANDBOOK、`docs/plans/` 未读；底稿只按行号读了 `02-forward.md` 的 §4.2、§5.5 与层构成几行、`01-deploy-entry-schedule.md` 的 §A3；源码全部先 grep 行号再读 ≤80 行。没有读取被拦。

## P5 审查（09-28）

独立审查，只审未改页面。对象：`wiki/concepts/attention-backend-family.md`（工作区未提交版，正文约 8669 字 / 7 节）。

**分数：8.0 / 10**（本页无 P1；4 条 P2；6 条 P3。另有 1 条跨页 P1 属于 `request-call-chain.md`）。

### 1. 初学者测试（只读前两屏）

> 注意力后端是每层自带的、夹在模型层和设备算子之间的那层代码：层报出自己是哪种注意力，后端据此决定用哪份状态、怎么组织这批 token、调哪个算子；GLM 一次前向同时走 KDA 和稀疏 MLA 两类后端。代价是后端不能随便换（机制、状态布局、dtype、head 形状、并行约束五件事都要对上），且每多一种机制 Runner 就多一套元数据构建器。

能说清“是什么、代价在哪”。卡点是术语：第一屏就出现 KDA、稀疏 MLA，GDN、MTP、indexer、KPool 在正文里始终没有一句中文解释（见 P2-1）。

### 2. 核心概念逐条对照（vllm-ascend@db701c1f，vLLM@0fc695fc）

| 写手说法 | 判定 | 证据 |
|---|---|---|
| 主干 45 层：34 层 KDA，11 层稀疏 MLA（第 3、7 … 43 层） | 对 | 官方 config（`glm-flow/reference/official-config.json` 的 `text_config`）：`num_hidden_layers=45`，`layer_types` 45 项，非 `linear_attention` 的下标正是 [3,7,…,43]；`linear_attn_config.kda_layers` 34 项；与底稿 02 §1.1 层表（L86-L91）一致 |
| MTP 第 45 层也走稀疏 MLA | 对 | `num_nextn_predict_layers=1`，MTP 首层号 = `num_hidden_layers` = 45（`glm5_next.py#L135-L145`）；MTP 用同一个 `AscendGlm5NextDecoderLayer(is_mtp_layer=True)`（`glm5_next_mtp.py#L84-L92`）；`_is_kda_layer` 先走 `config.is_kda_layer`（`glm5_next.py#L216-L218`），该方法在 `transformers_utils/configs/glm5_next.py#L264-L269` 要求 `layer_idx < len(layer_types)`，45 越界返回假 → MLA 分支（`glm5_next.py#L2080-L2105`）。页面“层类型表只有 45 项、索引落在表外”的推理成立 |
| 34 层 KDA 走 GDN 后端 | 对 | 层里构造上游 `KimiGatedDeltaNetAttention`（`glm5_next.py#L2080-L2085`），`utils.py#L763-L768` 在 `vllm_version_is("0.23.0")` 分支注册成 `AscendKimiGatedDeltaNetAttention`；其 `get_attn_backend` 返回 `AscendGDNAttentionBackend`（`ops/kimi_kda.py#L232-L233`）。同文件里的 `AscendGlm5NextLinearAttention`（`glm5_next.py#L1541`）全库无引用，不在路径上，页面没有误用它 |
| 11 层稀疏 MLA + MTP 走 IndexerKPoolMLA 后端 | 对（出处不准，见 P2-3） | 报后端的是 `AscendIndexerKPoolMLAAttention` 内部的 `IndexerKPoolMLACacheLayer`：`ops/indexer_kpool_mla.py#L78` 赋值、`#L136-L137` 返回 `AscendIndexerKPoolMLABackend`，该层在 `#L166` 构造。页面引的 `glm5_next.py#L171-L178` `_get_indexer_kpool_mla_backend` 全库无调用点 |
| 同层另挂两个只管缓存的后端，前向为空 | 对 | indexer 里构造 `state_cache`（`glm5_next.py#L1298`）与 `k_cache`（`#L1306`，`cache_role="indexer"`）；二者 `forward(self): ...`（`#L309`、`#L367`），分别报 `AscendIndexerKPoolBackend`（`#L306-L307`）与 `AscendIndexerKPoolStateBackend`（`#L364-L365`），规格分别是 `MLAAttentionSpec` 与 `AscendIndexerKPoolStateSpec`。“一层对应三个分组键”成立 |
| 注意力类注册替换，且挂在上游 0.23.0 分支 | 对 | `utils.py#L763-L768` |
| Runner 按「类名 + 缓存规格」分组，每组一个元数据构建器 | 对 | `model_runner_v1.py#L5052-L5059`：`key = (full_cls_name, layer_kv_cache_spec)`；`#L5065-L5083` 每组 `get_builder_cls()(...)` 建一个 builder |
| KDA prefill 拒绝 PCP>1；decode 逐 token 更新 | 对 | `ops/kimi_kda.py#L402-L403` 抛 `NotImplementedError`；decode 调 `recurrent_kda`（`#L355-L388`） |
| 平台后端表按三个布尔量挑；FA3 拒绝 MLA/稀疏、要外部包 | 对 | `platform.py#L807-L831`（`(use_mla, use_sparse, use_compress)` 查表）；`#L835-L858` 批不变未开返回假、`key != (False, False)` 抛错、缺 `flash_attn_npu_v3` / `flash_attn_with_kvcache` 抛错 |
| FA3 缓存形状 `[2, …]`、kernel block 128、decode `causal=False` / prefill `causal=True` | 对 | `fa3_v1.py#L36`、`#L40`、`#L116-L136` |

### 3. 出处替换是否成立（原第 18 行一带）

成立，三条都在 A2 上 GLM 推理的生产路径上：

1. **调用点** `sfa_v1.py#L1994-L2028`：在 `AscendSFAImpl.forward`（`#L1650`）里，除 `attn_metadata is None` 的 profiling 早退（`#L1660-L1666`）外无条件执行；`AscendIndexerKPoolMLAImpl.forward` 的两条返回都走 `super().forward`（`indexer_kpool_mla_v1.py#L800-L857` 内）。`#L2004` 起是 `_v_up_proj` 与 `o_proj`，与页面“算完之后的 V 解压、输出投影”一致。
2. **重写** `indexer_kpool_mla_v1.py#L1065-L1104`：`_execute_sparse_flash_attention_process` 覆盖父类同名方法，取 packed MLA cache 后调 `DeviceOperator.execute_sparse_attention_indexer_kpool_mla(..., sparse_mode=3)`。
3. **设备算子** `device/device_op.py#L719-L793`：属于 `BaseDeviceAdaptor`；`get_device_adaptor`（`#L2317-L2326`）只对 A5、310P 换子类，A2 走基类，因此是本部署实际执行的版本（A5 另有 `#L1724` 的重写）。`key=value=packed_kv_cache`、`sparse_mode != 3` 抛错（`#L736-L737`），与页面“潜向量同时当 K 和 V，只认 sparse_mode=3”一致。

旧出处 `#L980-L1061` 确实落在 `_sparse_attention_pytorch`（`#L858-L1064`）内；全库调用点只有 `tests/ut/models/test_glm5_next_indexer_kpool_mla.py#L1661`、`#L1762`，chunk 常量 16 在 `#L36`。页面常见误解第 3 条的说法属实。

### 4. 数字对照底稿

| 页面数字 | 底稿 | 结论 |
|---|---|---|
| R1 第一步 1 条请求、4 token，每卡 KDA 8 头、稀疏 MLA 8 头（L88） | 01 §A3 L733-L741；02 §4.3 L271 | 一致 |
| 34 / 11 / 第 3、7…43 层 / MTP 第 45 层（L90） | 02 §1.1 L89-L91 + 官方 config | 一致 |
| 每查询最多 2051 位置 = 2048 + 0–3 尾部（L99） | 02 §5.5 L470 | 一致 |
| 一层一卡 33.6 MFLOP/token，主干 11 层约 370（L99） | 02 §5.5 L464-L467；`sparse-attention.md` L162-L163 | 一致（8×2051×512×2×2 = 33.6 M） |
| 存 KV 的是 12 层（L125） | 02 §5.5 L472“12 层（含 MTP）” | 一致 |
| KDA prefill/decode 分岔（L94） | 02 §4.2 L264-L266 | 一致 |

写手自报疑点“算子 tiling 与 HBM 流量没有实测”：页面**没有**写成具体数字。正文 L99 明确 33.6/370 是“不含 softmax、投影和 kernel 补齐的静态上界”，L151 说明 16 的分块不能描述 NPU tiling；对照源码末尾“待核”列出“tiling 与 HBM 流量没有实测，本页的 MFLOP 与位置数都是静态上界”（L218-L220）。全页 grep `HBM|MiB|GB/s|字节` 在正文无命中。**不构成 P1。**

### 5. 丢信息核对

`git diff HEAD` 删除 43 行（frontmatter 14 行、正文 29 行）。按旧 7 个 H2 与写手清单 F1–F21 逐条对照新版：F1–F6、F8–F21 都在（FA3 的“未启用批不变退回默认流程”在 L169，“缺外部模块/接口”在 L168，sliding window、`FULL_DECODE_ONLY`、beta、PIECEWISE 在 L178）；旧 sources 里两条 arXiv 仍在（L47-L48）。唯一缩水的是 F7：KDA 前向“独立 Q/K/V 投影 + 写入系数 + 门控量 → KDA 运算 → 输出归一化与投影”在本页正文已无，只剩源码位置表的行标签；写手称细节留在 `linear-attention.md`，实查那页有 β 与门控公式（L100、L123-L133），但没有输出归一化与 `o_proj` 这一步（见 P3-6）。清单勾选基本属实。

### 6. 图

`pnpm wiki:diagrams --check` 退出码 0，`192 张图与 spec 一致`，日志里无 `attention-backend-choice` 告警。`attention-backend-choice.yaml` / `.svg` 画布 900×470（≤900）；图上无字节数；层数“34 层”“11 层 + MTP 第 45 层”、“GDN 后端”“稀疏 MLA 后端”“同层再挂两个缓存后端（索引器 K 池 / kpool 尾状态）”与正文、源码一致。

### 7. 版本差异口径

L182 已写明：v0.23 = 2c59ff10、v0.26 = 2ed6cbba、main = baa023ad，db701c1f 为本部署专用 orphan commit、不算进 v0.23 列。`git ls-tree` 实查：2c59ff10 无任何 GLM/KDA 的 `.py`；2ed6cbba 只有 `vllm_ascend/ops/kimi_kda.py` 与 KDA 单测；baa023ad 有 glm5next 相关实现与测试。与 L186 一致。

### 8. 检查脚本

- `pnpm wiki:audit`：退出码 0，`ok wiki:audit …通过`；本页行 `evidence=C 正文 8669 字 / 7 节 来源 36 条`，无针对本页的告警。
- `pnpm wiki:lint`：退出码 0，`ok wiki:lint 通过（另有 18 处待留意）`，18 处里没有本页。
- 结构：五个 H3 齐全且顺序正确（L161/L165/L174/L180/L193）；对照源码之上无证据角标；正文行内代码约 4 处；无 calc。
- meta 文本：旧版“以下事实由原 flash-attention-3 页并入，只作搬运”已删；正文未见参考来源或写作说明类文字。

### 问题清单

**P1（本页）**：无。

**跨页 P1（不属本页，建议另开任务）**：`wiki/concepts/request-call-chain.md` L162 与 L339 写“GLM 的稀疏 MLA 命中 `(True, True, False)` → `AscendSFABackend`”。源码里 GLM 的 MLA 缓存层自己返回 `AscendIndexerKPoolMLABackend`（`ops/indexer_kpool_mla.py#L78`、`#L136-L137`），不经过平台表；本页常见误解第 2 条（L149）的说法是对的，两页互相矛盾。改法：改 request-call-chain 那两处，并链接到本页。

**P2**

1. **术语先用后讲**（L70、L90、L94-L95、L121、L147、L155）。GDN 全页正文没有解释，读者看不懂“KDA 层为什么报 GDN 后端”；MTP 首现 L90 没说是“多 token 预测的草稿层”；MLA 没给一句中文含义；indexer、KPool 在 L95、L121 直接用；“批不变”首现 L155 在误解里，解释在对照源码 L163。改法：在第一屏或第二屏补一句术语说明，例如“GDN = Gated DeltaNet，KDA 是它的变体，昇腾的 KDA 实现沿用了 GDN 后端的接口名”；MTP、MLA、indexer/KPool 各补半句，或在首现处链接 `mla.md` / `sparse-attention.md` 的对应小节。
2. **全库指向本页的锚点已失效**：`wiki/concepts/linear-attention.md:235` 链接 `attention-backend-family.md#kda-路径使用递推和卷积状态`，旧 H2 已删。改法：把那条链接改到本页 `#放到-glm-双机一个-token-走过-45-层要问-45-次`；补上 P2-1 的 GDN 说明后，也可以改指那一处。
3. **主 MLA 后端的出处指向没人调用的函数**：源码位置 L198“三个后端的延迟导入（主 MLA、尾状态、K 池）→ `glm5_next.py#L171-L196`”里 `_get_indexer_kpool_mla_backend`（L171-L178）没有任何调用点。结论没错，但证据不对。另外表格 L95“层里构造的对象”实际是一个套娃：`AscendGlm5NextMLAAttention` → `AscendIndexerKPoolMLAAttention` → `IndexerKPoolMLACacheLayer` 报后端。改法：sources 与源码位置补 `vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L39-L45`、`#L74-L82`、`#L136-L137`；L198 的描述改成“尾状态、K 池两个缓存后端的延迟导入 `#L181-L196`”。
4. **R1 数字没有链接依赖页**（协调者补充项）：L88 直接讲“R1 的第一步 1 条请求、4 个 token，每卡 KDA 8 头、稀疏 MLA 8 头”，没有链接 `one-request.md`（它的“示例请求 R1 与官方双机部署”“34 层 KDA”“11 层稀疏 MLA”几节有这些数字）；部署前提已链接 `glm-5-3-flash-two-node.md#部署前提`，这点合格。改法：把“R1”链接到 `one-request.md` 对应小节。调用链方面，本页只讲“层 → 后端 → 算子”这一段本页专属的链，没有重讲进程/类/函数链，不需要搬到 `request-call-chain.md`；可以在 L149 末尾加一个指向它的链接（修好上面的跨页 P1 之后）。

**P3**

1. L86 标题“要问 45 次”和图顶文字“一个 token 每经过一层，都要先回答……”暗示运行时逐 token 查询，和 L90“装配时就定死了”、L105“Runner 在初始化时”不一致。建议改成“45 层各自在装配时定好后端”一类说法。
2. 层号从 0 起没有交代：“主干 45 层”加“MTP 的第 45 层”容易被读成第 45 层是主干最后一层。建议写明“主干是第 0–44 层，MTP 编号 45”。
3. L99 的 33.6 / 370 MFLOP 推导在 `sparse-attention.md` L162-L163，本页只把链接挂在 2051 上。建议写成“推导见稀疏注意力”，明确这两个数也只在那里算。
4. L88“8 张卡拿到同样的 4 个 token”应写明是 R1 所在 DP 组的 TP8 那 8 张卡（双机共 16 卡）。
5. MTP 越界判假这一条，实际走的是配置类的 `is_kda_layer`（`vllm_ascend/transformers_utils/configs/glm5_next.py#L264-L269`）。本页只引了 `glm5_next.py#L216-L227` 的分派；建议把配置类这一处补进 sources。
6. KDA 前向的“Q/K/V 投影 → 写入系数 β → 门控 → KDA 运算 → 输出归一化 → o_proj”在本页正文已没有；`linear-attention.md` 有 β 和门控，但没有输出归一化和 o_proj 这一步。建议在分支表第 1 行补半句，或者确认 linear-attention 补上。

### 跳过的内容

- frontmatter 的 sources 区（L12-L48）：没有通读，只用 grep 定位了 L24-L26 三条替换出处，以及 L47-L48 的 arXiv 是否还在。
- 「## 对照源码」正文（L159-L221）：只用 grep 核了 H3、版本名和关键词；L216 证据索引长行只看了前 160 字。
- HANDBOOK、`docs/plans/`：未读。没有被拦截的读取。

## P5 修订记录（09-28）

按本页「P5 审查（09-28）」的 4 条 P2 与协调者点名的两项跨页修复处理。P3 未处理（P3-1 若改 H2 会连带改掉别页刚修好的锚点，暂不动）。

| 编号 | 处理 | 落点 |
|---|---|---|
| P2-1 术语先用后讲 | **已改**。第一屏给 KDA（Kimi Delta Attention，线性注意力，历史压进固定大小的状态）和稀疏 MLA（Multi-head Latent Attention 的稀疏版）各补一句中文解释；分支表后新增一段解释 GDN（Gated DeltaNet，KDA 是它的变体，昇腾的 KDA 实现沿用了这个后端接口名）、indexer（为当前查询挑历史位置的小模块）与 KPool（相邻几个位置合成一个"池"再打分）；MTP 首现处补「Multi-Token Prediction，多 token 预测用的草稿层」；批不变首现处补「同一条输入不论和谁拼在一批里，结果都逐位相同」 | 正文首屏、GLM 一节、常见误解 |
| P2-2 / 审查 P2-3 主 MLA 后端出处 | **已改**。`_get_indexer_kpool_mla_backend`（`glm5_next.py#L171-L178`）确认全库无调用点（`git grep` 只有定义行；另两个 getter 在 `#L307`、`#L365` 有调用）。sources 第 3 条改成 `#L181-L196` 并改名为「尾状态、K 池两个缓存后端的延迟导入」；新增三条 `ops/indexer_kpool_mla.py#L39-L45`（`IndexerKPoolMLACacheLayer` 类定义与 `cache_role="kv"`）、`#L74-L82`（`attn_backend = AscendIndexerKPoolMLABackend`）、`#L136-L137`（`get_attn_backend` 返回它），追加在来源末尾所以既有角标编号不变；源码位置表拆成两行，证据索引补 [C37]–[C39]。分支表「层里构造的对象」一格改成「AscendIndexerKPoolMLAAttention，它内部再建一个缓存层对象，后端由这个缓存层报出」，如实写出套娃 | frontmatter、分支表、源码位置表、证据索引 |
| P2-3 / 审查 P2-4 R1 数字没链接 | **已改**。「R1 的第一步…」改成链接 [示例请求 R1](../../../wiki/concepts/one-request.md) 的「示例请求 R1 与官方双机部署」一节，并写明「这些数都在那一页推导」；顺手按 P3-4 把「8 张卡」限定为「R1 所在 DP 组的那 8 张卡」，按 P3-2 写明「主干是第 0–44 层」「编号 45 的 MTP 层」 | GLM 一节首段与层构成段 |
| 审查 P2-2 跨页锚点失效 | **已改**。`wiki/concepts/linear-attention.md:235` 的 `#kda-路径使用递推和卷积状态` 改成 `#放到-glm-双机一个-token-走过-45-层要问-45-次`。锚点按 `src/content/wiki/anchors.ts` 的 `headingSlug`（转小写、去标点、空格变 `-`）手算并核对；`grep -rn 'attention-backend-family.md#' wiki/` 确认全库只有这一处指向本页的锚点 | linear-attention.md |
| 跨页 P1 request-call-chain | **已核实并改**，结论见 `request-call-chain-review.md` 的「09-28 跨页修复」。要点：`AscendIndexerKPoolMLABackend`（`indexer_kpool_mla_v1.py#L521`）与 `AscendSFABackend`（`sfa_v1.py#L135`）都直接继承 `AttentionBackend`，是兄弟类；继承关系只存在于实现层（`#L557` 的 `AscendIndexerKPoolMLAImpl(AscendSFAImpl)`）、元数据（`#L78`）与构建器（`#L389`）。所以审查员判对了：GLM 的稀疏 MLA 层不走平台表、后端不是 `AscendSFABackend`，但"调用链里出现 sfa_v1"并不矛盾 | request-call-chain.md L162、L339 与 sources |

### 验证

- `pnpm wiki:lint`：退出码 0，`ok wiki:lint 通过（另有 17 处待留意）`；`grep` 三个改过的页 id，命中 0。
- `pnpm wiki:diagrams --check`：退出码 0，`192 张图与 spec 一致`（本轮没改图）。
- `pnpm wiki:audit`：退出码 0，`行号越界 0、文件不存在 0`，名单 37 页全部达标。新增的 5 条来源行号都在文件范围内。
- 没起服务、没占端口、没改 `standard-pages.json`、没提交 git；request-call-chain 只动了点到的两处与 sources 末尾，块数文字未动。
