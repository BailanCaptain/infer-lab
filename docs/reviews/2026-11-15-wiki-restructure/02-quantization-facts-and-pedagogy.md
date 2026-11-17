# 样板 2：`wiki/concepts/quantization.md` 旧事实与教学改进清单

- **目标文件**：[`wiki/concepts/quantization.md`](../../../wiki/concepts/quantization.md)（455 行，`id: quantization`，`type: feature`）
- **拟采用修订类型**：`editorial`（保护前 342 行成熟主干，仅将 `L167/173/200` 数学公式接入 KaTeX、对 `L345-L372` 与 `L399-L415` 中被剥离的参数/变量/函数与代码标识按语义恢复反引号、将 `L399-L402` `v0.30.0rc2` 补丁段并入四版本对照结构；本轮清单未提出需 `supersede.claims` 的正文纠错，不人为捏造正文旧错；若后续独立检视或源码核对发现新反证，则按实改判并启用 `supersede.claims` 有证更正，不以保真要求固化未核实旧错）
- **冻结与主干保护项**：
  1. 原样保护前 342 行（`L137-L342`）成熟教学主干，不推倒重写；
  2. 原样保护 `L228-L230` 3D 围栏 `wiki-scene`（`inference-mechanism:5`）及其强绑定的 `L206-L220` 三元素玩具算例（`x = [0.523, -0.31, 1.27]`、`w = [0.40, -2.54, 0.86]`、`sₓ = 0.01`、`s𝑤 = 0.02`、`qₓ = [52, -31, 127]`、`q𝑤 = [20, -127, 43]`、整数乘加 `10438`、`ŷ = 2.0876`、`y = 2.0888`、差 `0.0012`）；
  3. 原样保留 4 张 2D 图：[`quantization`](../../../wiki/diagrams/quantization.yaml)（`L145`）、[`quantization-intuition`](../../../wiki/diagrams/quantization-intuition.yaml)（`L189`）、[`quantization-dot`](../../../wiki/diagrams/quantization-dot.yaml)（`L202`）、[`quantization-flow`](../../../wiki/diagrams/quantization-flow.yaml)（`L309`）；
  4. 原样保留 `L111-L114` 已核验的 `verified: [releases/v0.23.0, releases/v0.26.0rc, main]` 列表（不在无独立全页核验回执时擅自增删）。

---

## 一、 现有 `sources`（55 条，L35-L110）核对

| 编号（1-based） | `sources` 引用条目 | 覆盖的核心机制与版本 | 去向分类 |
|---|---|---|---|
| 来源 1–2 (`L36-L39`) | `GLM5.3-Flash.md` 官方双机教程 (`[S1]`)、HuggingFace `GLM-5.3-Flash/config.json` (`[S2]`) | `--quantization ascend` 启动入口、上游模型结构声明 vs 量化目录实际描述文件 | **保留** |
| 来源 3–7 (`L40-L44`) | `vllm-ascend@db701c1f:vllm_ascend/quantization/` (`utils.py#L83-L214`, `modelslim_config.py#L60-L70, #L365-L470, #L632-L736`, `methods/registry.py#L19-L62`) | 自动探测顺序、第二层用户值优先与 warning、`[C4]`–`[C6]` `quant_model_description.json` 逐层取精度/`FLOAT` 跳过/融合分片一致性/Embedding 回退、`[C7]` `(quant_type, layer_type)` 注册表 | **保留** |
| 来源 8–11 (`L45-L52`) | `vllm-ascend@db701c1f:vllm_ascend/quantization/methods/` (`w8a8_dynamic.py#L48-L152, #L155-L289, #L353-L370`, `w8a8_static.py#L33-L141`) | `[C8]`–`[C10]` 动态 Linear 与 MoE 两块权重（gate+up、down）、逐通道 scale/offset、加载后转置与 FP32 系数副本、router 288 列校验；`[C11]` 静态整张量激活 scale/offset、整数偏置与反量化系数 | **保留** |
| 来源 12–13 (`L53-L54`) | `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/` (`moe_stage_params.py#L91-L119`, `moe_mlp.py#L88-L229`) | `[C12][C13]` W8A8 MC2 dispatch 带 INT8 激活与 FP32 动态系数、专家入口跳过重复量化、SwiGLU 与中间再量化融合分支 | **保留** |
| 来源 14–17, 22–24 (`L55-L58, L67-L70`) | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py` (6 处行段), `vllm@0fc695fc:.../gate_linear.py#L47-L65` | `[C14]`–`[C17]`、`[C22]`–`[C24]` 哪些部件建层时不接量化配置（KDA 九投影、indexer K/打分、嵌入表、router FP32）vs 接量化配置（稠密 MLP、路由/共享专家、MLA 投影、indexer Q、词表头） | **保留** |
| 来源 18–21, 33–35, 52–54 (`L59-L66, L79-L81, L106-L108`) | `vllm-ascend@{2c59ff10,2ed6cbba,baa023ad}` 下 `w8a8_dynamic.py`, `w8a8_static.py`, `modelslim_config.py`, `utils.py` | `[C18]`–`[C21]` v0.23 / v0.26 / main 三版文件路径迁移、超大投影拆块分支去留、FlashComm2 分支范围与 `fp8` 探测取消 A5 限制 | **保留** |
| 来源 25–32, 36 (`L71-L78, L82`) | `vllm@{0fc695fc,568afb3a,84030bbe}:vllm/config/model.py` (7 处行段), `vllm-ascend@db701c1f:vllm_ascend/platform.py#L140-L145` | 上游 `dtype`/`quantization` 解析、`auto` 分支（pooling 优先 FP16）、两层冲突校验与固定 NPU 支持列表 | **保留** |
| 来源 37–46 (`L83-L98`) | `vllm-ascend@7d825229` (`w8a8_dynamic.py`, `w8a8_static.py`, `modelslim_config.py`, `mxfp_c8.py`, `attention_c8_mxfp.py`, `utils.py`) | `v0.30.0rc2` `PreparedLinearInput` 预量化输入复用、ModelSlim `C8-MXFP` (`kv-cache-dtype=mxfp8`、FAKQuant 让位、拒绝 PCP/DCP/非因果/滑窗、PD 四张量 Mooncake 要求) | **保留** |
| 来源 47–51, 55 (`L99-L105, L109-L110`) | ModelScope `GLM-5.3-Flash-w8a8` `9e55cbc8` & `3121f187` `quant_model_description.json` (`[S47][S48]`), `ascend_forward_context.py`, `token_dispatcher.py`, CANN `aclnnDynamicQuant.md` (`[S55]`) | 两快照 MLA 四投影 `FLOAT` vs `W8A8_DYNAMIC` 差异；A2 MC2 选路三条件（`<=24` 专家/卡、`EP>=16`、token 容量）与 `quant_mode=2` / combine `0`；CANN 动态量化公式 | **保留** |

---

## 二、 逐段旧事实与版本/硬件限定条件三出口核对表

| 原文位置 | 原子事实与版本/硬件限定条件摘要 | 关联来源 / 标记 | 出口分类 | 新稿承接位置与说明 |
|---|---|---|---|---|
| `L137-L164` | 量化定义、BF16（2B）vs INT8（1B，`-128..127`）、`s=0.1` 四数示意（`0.26→3→0.3`、`1.04→10→1.0`、`-0.18→-2→-0.2`、`13→127→12.7` 截断，配 `quantization` 图）、W8A8 边界（累加器/scale/层间隐藏向量可为其他格式）、权重常驻部署 vs 权重卸载限定、MoE 仅读选中专家及批内复用/缓存/算子分块限定 | `[D]`、单一出处概念链接 | **保留** | 原样保留 `## 量化是什么？` 与 `## 为什么需要量化？` 全部正文与限定条件 |
| `L165-L184` | 对称量化公式 `q = clamp(round(x / s), -128, 127)` 与 `x̂ = s × q`（半格误差界 `s ÷ 2`、理想对称取法 `s = max(|x|) ÷ 127`、离群值拉大 `s`）；非对称量化引入零点 `z`：`q = clamp(round(x / s) + z, -128, 127)` 与 `x̂ = s × (q - z)`（`z = -128` 下 `13` 不再截断的 `calc` 算例）；GLM 双机动态 W8A8 激活对称无零点，权重文件虽存 offset 但矩阵乘不用，静态量化激活才用 offset | `[C8]`、`[C11]`、`[S55]`、`[D]` | **保留** | 原样保留 `## 一个数怎样压下去、再还原回来` 段落与 `calc`；待包 2 挂载 KaTeX 后将 `L167`、`L173` 行内公式升级为数学公式渲染（保持完全等价的数学表达式） |
| `L185-L231` | W8A8 矩阵乘四步（权重按输出通道离线压、激活按 token 现算、宽整数乘加累加、乘回 `sₓ × s𝑤` 还原 BF16，配 `quantization-intuition` 与 `quantization-dot` 图）；**原样保护 `L200` 求和公式、`L206-L220` 三元素玩具算例（`[0.523, -0.31, 1.27] · [0.40, -2.54, 0.86] → 10438 → 2.0876 vs 2.0888`）与 `L228-L230` `wiki-scene` `inference-mechanism:5`**；粒度取舍（整张量 vs 逐通道/逐 token） | `[C8]`、`[S55]`、`[D]` | **保留** | 原样保护，仅将 `L200` `ŷ = sₓ × s𝑤 × Σ qₓᵢ q𝑤ᵢ` 升级为 KaTeX 行内公式 |
| `L232-L277` | `4096 × 4096` 权重矩阵节省账（`32 MiB → 16 MiB + 16 KiB ≈ 50.05%`）、三笔代价（累积误差须重评、运行时/加载布局开销、按层生效且省下字节需经显存探测才知 KV 余量）；动态 vs 静态量化四维对比表（何时定 scale、粒度、好处、代价）及离线平滑/裁剪仍可能需校准样本说明 | `[C8]`、`[C11]`、`[D]` | **保留** | 原样保留 `## 省下什么，付出什么` 与 `## 动态量化和静态量化，差在什么时候算系数` |
| `L278-L342` | GLM 双机落点：`--quantization ascend` 加载 W8A8 包（`9e55cbc8` 与 `3121f187` 两快照）；权重加载后转置与分块布局；路由专家占大头（每卡每层 `432 MiB`，42 层 `17.72 GiB`，占 `3121f187` 所列语言权重子账 `20.58 GiB` 大头，表外项见部署页）；本地 18 专家合成两块权重，scale/offset `576 KiB` + FP32 副本 `288 KiB` 仅占 `0.2%`；`FLOAT` 跳过与 Embedding 缺条目回退例外（配 `quantization-flow` 图）；建层不接量化 vs 接量化由描述文件决定的分层依据表（含 `9e55cbc8` vs `3121f187` 在 MLA 四投影上的 `FLOAT` vs `W8A8_DYNAMIC` 差异）；A2 MC2 选路三条件与 `quant_mode=2` 传 INT8 激活 + FP32 scale、combine 为 `0`；6 条常见误解 | `[S1]`、`[S2]`、`[C4]`–`[C17]`、`[C22]`–`[C24]`、`[S47]`、`[S48]`、来源 49–51 | **保留** | 原样保留 `## 放到 GLM 双机` 与 `## 常见误解` 全部正文、表格、算式与限定条件 |
| `L343-L455` | `## 对照源码` 核验区：`### 怎么开`（`--dtype`、`--quantization`、`--load-format` 三入口区分，`auto` 在普通生成 vs pooling 优先 FP16 分支，两层量化识别与第二层 warning 边界，`AscendModelSlimConfig` 注册表键）、`### 会报什么错`（5 条加载/执行报错表）、`### 开销和什么时候别开`（超大维度拆块分支、浮点回退须真实浮点权重）、`### 版本差异`（`v0.23` `2c59ff10`/`db701c1f`、`v0.26` `2ed6cbba`、`v0.30.0rc2` `7d825229`、`main` `baa023ad` 四版本对比及 `C8-MXFP` `kv-cache-dtype=mxfp8` 边界）、`### 源码位置`、`**来源与结论对应**`（`[S1]`–`[S55]`、`[C4]`–`[C24]`、`[D]`）与 `**待核**` | 全部 55 条 `sources` 与角标 | **保留** | 文末默认折叠的 `## 对照源码` 核验区：恢复 `L345-L372` 与 `L399-L415` 中被剥离的参数/类名/文件名反引号，并将 `L399-L402` 的 `v0.30.0rc2` 段落合入四版本对照表与紧随其后的 `C8-MXFP` 专项说明，零事实删减 |

---

## 三、 具体讲法改进位置与实施要点

1. **保护前 342 行成熟主干与 `L228-L230` 3D 围栏（`L137-L342`）**：
   - 前 342 行的递进结构（4 个数直觉 → 对称/非对称与离群值 → 矩阵乘四步与 3 元素手算 + 3D 场景 `inference-mechanism:5` → 4096×4096 省存账 → 动静态对比 → GLM 双机逐层精度与 MC2 INT8 派发 → 常见误解）已非常扎实，**不做删改或重排**。
   - 仅在包 2 接通 KaTeX 后，将 `L167`（对称量化）、`L173`（非对称量化）、`L200`（矩阵乘反量化求和 `ŷ = sₓ × s𝑤 × Σ qₓᵢ q𝑤ᵢ`）三处纯文本公式替换为标准 `$...$` 行内数学公式渲染（使用 `\text{clamp}`、`\text{round}` 与标准 ASCII 减号 `-` 替换原文 Unicode `−` U+2212）。
2. **按语义恢复参数、变量、函数与配置标识反引号，避免普通技术名词无意义代码底色（`L345-L372`, `L399-L415`）**：
   - 旧 `maxInlineCodePerK: 13` 行内代码密度门禁由包 2（`§5.2` `L340`）废止，无需再借 `## 对照源码` 位置规避旧配额；将 `L351-L371` 中的 `--dtype`、`--quantization`、`--load-format`、`auto`、`half/float16`、`bfloat16`、`float/float32`、`torch.dtype`、`None`、`ascend`、`compressed-tensors`、`fp8`、`deepseek_v4_fp8`、`W8A8_DYNAMIC`、`quant_model_description.json`、`config.json`、`FLOAT`、`linear`、`moe` 等参数、变量、函数与配置标识符按语义恢复反引号包裹，同时普通技术名词保持正体、避免无意义代码底色。
3. **归并 `L399-L402` 的 `v0.30.0rc2` 尾部版本补丁段（`L397-L415`）**：
   - 将 `L399-L400` 关于 `v0.30.0rc2`（`7d825229` + 上游 `ced6857a`）动态/静态 W8A8 及 `PreparedLinearInput` 的说明并入 `L405` 钉点列表与 `L407-L411` 版本对照表（扩为 `v0.23` / `v0.26` / `v0.30.0rc2` / `main` 四行）；
   - 将 `L401-L402` 关于 `v0.30.0rc2` 新增 ModelSlim `C8-MXFP`（`kv-cache-dtype=mxfp8`、FAKQuant 让位、`fa_v.scale` 映射、拒绝 PCP/DCP/非因果/滑窗、PD 四张量 Mooncake 要求及与 GLM KPool SFA C8 / LightningIndexer C8 的区分）作为紧跟四版本表的独立说明段保留，消除突兀的粗体首句补丁感。
