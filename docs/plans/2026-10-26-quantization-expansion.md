# 量化知识补全：研究、修订与验收记录

资料核读开始于 2026-10-26；修订与页面验收于 2026-10-28 继续。用户要求先查阅大量可信资料，再补齐量化相关知识，尤其核实 ND/NZ 的名称。

## 范围与去向

原库已有详细的 INT8 W8A8 执行和 C8 缓存实现，但 ND 查询没有专页，NZ 主要落到 RFork 场景，量化方法、校准与验收缺少系统入口。本轮补齐推理部署所需的主线，不声称穷尽所有量化研究算法。

| 内容 | 去向 | 本轮处理 |
| --- | --- | --- |
| ND/NZ 名称、分块顺序、补齐、shape/stride/dtype、加载后处理 | [tensor-layout](../../wiki/concepts/tensor-layout.md) | 新增专页与两图 |
| W/A/C、粒度、校准、PTQ/QAT、RTN/AWQ/GPTQ/SmoothQuant、QLoRA、产物与后端 | [quantization-methods](../../wiki/concepts/quantization-methods.md) | 新增专页与两图 |
| 数值误差、任务质量、内存、TTFT/TPOT/ITL、goodput、对照流程 | [quantization-evaluation](../../wiki/concepts/quantization-evaluation.md) | 新增专页与两图 |
| scale、零点、舍入、截断、动态/静态、GLM 分层条件 | [quantization](../../wiki/concepts/quantization.md) | 保留原算例与执行依据，补导航、别名及范围说明 |
| FP32/FP16/BF16、INT4/INT8、FP8、FP4、NF4 | [low-precision-formats](../../wiki/concepts/low-precision-formats.md) | 补基础比较，保留 MX/NVFP4/HiF8、DeepSeek 与 A2/A3 原有材料 |
| INT8 C8、FP8 KV、KIVI、布局与缓存精度区别 | [kv-cache-quantization](../../wiki/concepts/kv-cache-quantization.md) | 扩充概念范围，保留固定 GLM 未启用缓存量化的结论 |
| 术语、跨实例布局、具体算子边界 | TERMS、rfork-layout、ops-and-kernels | 修正过宽表述并回链 |

目录使用已有 frontmatter toc 机制，索引和 registry 由 wiki:build 生成，没有修改检索或目录实现。

## 可信资料登记

下列资料由写手实际打开阅读；独立审阅者又对 ND/NZ、对齐尺寸、三种算法、固定 NZ 分支和 benchmark 公式做了交叉核对。网站文档的适用范围不自动扩大为本站部署支持矩阵。

| 一手资料 | 本轮采用的范围 |
| --- | --- |
| [CANN 分形格式说明](https://www.hiascend.com/document/detail/en/CANNCommunityEdition/910/API/ascendcopapi/docs/en/api/SIMD-API/basic_api/cube_compute_ISASI/cube_compute_fractal_intro/key_fractal_format_detailed_explanation.md) | ND=N-Dimension；设备内存与片上格式、硬件代际分别核对 |
| [CANN ATC 数据格式说明](https://www.hiascend.com/doc_center/source/zh/canncommercial/850/devaids/atctool/atlasatc_16_0005.html) | NZ 块间列优先、块内行优先；大 N、小 z 命名与排列 |
| [ATB TransdataOperation](https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/910/acce/ascendtb/ascendtb_01_0083.html) | 同 dtype 转换、FP16/BF16 16×16、INT8 16×32 与输出维度 |
| [PyTorch Tensor Views 2.14](https://docs.pytorch.org/docs/2.14/tensor_view.html) | 转置视图、reshape 与 contiguous 的复制条件 |
| [PyTorch Quantization in Practice](https://pytorch.org/blog/quantization-in-practice/) | 缩放、校准、粒度、动态与静态的基础 |
| [PyTorch QAT](https://pytorch.org/blog/quantization-aware-training/) | 伪量化、训练与导出过程 |
| [SmoothQuant v6](https://arxiv.org/html/2211.10438v6) | 等价缩放、激活离群值和权重侧代价 |
| [AWQ v4](https://arxiv.org/html/2306.00978v4) | 激活感知通道缩放、weight-only、运行时反量化 |
| [GPTQ v2](https://arxiv.org/html/2210.17323v2) | 层输出重构、近似二阶信息与分块补偿 |
| [QLoRA](https://arxiv.org/abs/2305.14314) | 冻结量化基座、适配器、NF4、双重量化 |
| [BFLOAT16 研究 v3](https://arxiv.org/html/1905.12322v3) | FP32/FP16/BF16 字段位宽；局部分辨率算例由位宽推导 |
| [PyTorch BF16 说明](https://pytorch.org/blog/empowering-pytorch-on-intel-xeon-scalable-processors-with-bfloat16/) | BF16 定义交叉核对，不移植其 CPU 性能数字 |
| [FP8 Formats for Deep Learning v2](https://arxiv.org/html/2209.05433v2) | E4M3/E5M2 的具体字段、特殊值和范围 |
| [KIVI v2](https://arxiv.org/abs/2402.02750v2) | 二位缓存、K 逐通道与 V 逐 token；只作研究对照 |
| [上游 vLLM v0.25 FP8 KV 文档](https://docs.vllm.ai/en/v0.25.0/features/quantization/quantized_kvcache/) | 缩放粒度、后端限制、预热估计后固定的系数 |
| [Hugging Face PPL 文档](https://huggingface.co/docs/transformers/perplexity) | 困惑度定义、分词器和窗口对比较的影响 |
| [Ascend v0.23 量化指南](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/quantization.html) | ModelSlim、LLM-Compressor 与加载入口 |
| [Ascend 配置文档](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html) | 2026-10-26 核读的 weight_nz_mode 与独立 KV NZ 字段；与固定源码分开 |
| [Ascend 性能测试指南](https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/performance_and_debug/performance_benchmark.html) | 离线与在线性能测试入口 |
| [Ascend AISBench 指南](https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/evaluation/using_ais_bench.html) | 任务质量评测入口 |

固定实现首先从本地 tools/repos 读取，不以浮动网页替代：GLM Ascend `db701c1f`、上游 vLLM `0fc695fc`，以及 Ascend 三个对照快照 `2c59ff10`、`2ed6cbba`、`baa023ad`。逐项路径和行号在对应页面 sources 中。

量化指南在固定 GLM、v0.23、v0.26 的文件 blob 相同：`06c0a40199eda712442b5887e391e29ecb3090d7`；main 为 `b496cb95ede1e5aa0da1c8da1465eb9c8d0fb204`，新增分块 FP8 文件加载说明。这个比较仅证明该文档内容，不证明执行实现完全相同。

## 独立审阅及修订

按写作标准邀请新的只读审阅者 `/root/quantization_review`，不以写手自查代替独立审阅。首次审阅未发现新页的 P1 核心定义错误，提出四类 P2 与三项 P3，均在本轮修改：

| 问题 | 修订结果 |
| --- | --- |
| GLM 各投影被笼统写成动态 W8A8 | ops-and-kernels 区分 KDA 保持浮点与实际选中量化方法的层，保留逐层描述待核 |
| RFork 24 字节例叠加 NZ 后未算补齐 | 把 24 字节明确限定在转置并连续化；NZ 另核物理存储 |
| ND/NZ 页流程像全部 GLM 线性层的实测 | 正文与图注限定固定源码的动态 W8A8 方法，保留部署方法推断边界 |
| 重复别名与 evidence 分类不符 | 反量化别名留在总页；验收页按主要来源标 S，工程推导另标 D |
| 图中基线与候选像分别评不同指标 | 两路先汇入共同“逐项对照”，再分检查项 |
| FP8 KV 系数估计时机不够清楚 | 明确所引版本预热时用单批随机 token 估计后固定 |
| PTQ 说明像必需校准集 | 改为是否校准取决于方法 |

初学者复述与手算核查已完成：三张新页都能说明对象、机制与代价；重排顺序、17×17 补齐、分组载荷、等价缩放、MSE/L2 和串行耗时例均一致。

## 原内容保留与证据限制

本轮采用定点新增与替换。W8A8 原有对称/非对称算例、矩阵乘顺序、逐层精度依据、dispatch 及字节推导保留；低精度页的 MX/HiF8、DeepSeek 和并发添加的 A2/A3 内容保留；C8 的三条 Ascend 实现、PD 分离、偏移风险、版本差异和固定 GLM 未启用结论保留。RFork 的后处理转移、派生张量、工作区与版本分支保留；算子页的注册、KDA、MLA、MoE 调用链保留。

早期改前副本存于临时 sandbox，后续已不可访问。独立审阅因此没有完成完整的逐条旧文差分，本记录不把定点修改与当前内容核对写成完整历史无损证明。

模型包的完整逐层量化描述与离线配方仍未取得；没有 A2 双机设备精度、时延、峰值显存实测。新页 verified 保持为空，不把读源码、论文结果或手算数当成 NPU 验收结果。

## 验证记录

- 本轮八篇页面单独运行现有写作标准：全部通过；正文证据角标均为 0，行内代码 0–2.5/千字，calc 0–0.84/千字，首图和 900px 图宽均合规。详细数值保存在 test-results/quantization/focused-check.log。
- 同一检索入口实查 14 个问题：ND、NZ、PTQ、QAT、AWQ、GPTQ、SmoothQuant、校准、W4A16、BF16、NF4、KIVI、量化变慢均直接命中对应专题；“NZ ND是啥”首项为 tensor-layout。
- wiki:build 与 check:content 通过，当前工作区共 167 页、11 个主题；页数包含其他并发工作。
- wiki:lint 通过，另有 13 项非阻塞提示；build（含 tsc）通过。
- 全库 wiki:audit：4146 条来源，3898 条本地行号有效，无无效提交、缺文件、越界或未知仓库。唯一阻塞是非本轮的 glm-5-3-flash-two-node 正文含一个证据角标；未为此改动该页。
- audit 的 248 条 URL 状态不代表联网核验，3570 条 raw 引用待核也没有被宣称已补齐。本轮联网核读范围只以上方登记表为准。
- 六张新图已用项目 wiki:figshots 截图并逐张目视核对：文字、连线、分块顺序和共同验收入口可读，无内容越界；截图保存在 test-results/figshots，文件名前缀分别为 tensor-layout、quantization-methods、quantization-evaluation。wiki:diagrams --check 通过，当前 326 张图与 YAML 一致。
- 浏览器实际打开 ND/NZ、W8A8、方法、验收、数值格式和 KV 量化六页，检查首屏、算例与新增对照表。实际点击“ 四步计算 ”与“量化方法中的校准”跨页链接，均跳到对应章节；MSE 0.016667、相对 L2 4.88% 的算式显示正常。工具的语义点击一次未触发后，改用当前可访问性树中的链接完成导航，没有据此改动路由代码。
- pnpm exec vitest run src/content/wiki/toc.test.ts scripts/wiki/agent-access.test.ts：2 个文件、19 项测试通过。

待用户决定事项：无。资料边界已在页面中说明，不需要以部署试验作为本次知识库写作的前提。
