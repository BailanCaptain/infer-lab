# op-to-ai-core 写作记录

## P5 写作记录（GPT-6 Astra，10-02）

本记录是写手自查，不冒充独立审查结论。任务为第 11 批深改，挂靠 A4；遵循 common-v2 的“不起服务、不截图、不碰 5193 / 8790”，浏览器验收留给审查员。

### Why / What

旧页已经正确区分 GLM 无 residual 路径和可选残差融合扩展，但第一屏只有归一化公式，缺矩阵/向量分工直觉、主线站点衔接与三版本差异。本次保留旧事实，补齐读者从算子语义走到设备执行所需的解释。

- 页面：`wiki/concepts/op-to-ai-core.md`。先讲算子、kernel、Cube/Vector 与 RMSNorm，再讲分块/融合的原因、残差融合数值示意、Host tiling、搬入/归约/写回；之后进入 GLM 实际路径和 W8A8 专家执行段，最后为误解与源码。
- 新图：`wiki/diagrams/op-to-ai-core-intuition.yaml/.svg`，860×450；画一个矩阵乘与激活融合算子的矩阵执行段→向量执行段，下面对照纯向量归一化。图只表示依赖，不表示核数比例、实际启动数量或片上交接承诺。
- 重绘：`wiki/diagrams/op-to-ai-core.yaml/.svg`，880×900；A3 张量/注意力元数据→A4→是否传 residual→扩展可用性→Host 分块→设备处理。明确残差在 CopyIn 中就写回。
- 保留 `GLM 实际从哪里调用 RMSNorm` 标题，已有 reading-vllm-ascend 入链不变；补 one-request 与 prepare-inputs-flow 关系。ai-core 已有指向本页的关系，未重复反向登记。
- A3 元数据只解释消费边界，构造过程回链 prepare-inputs-flow。未向其他页面搬运内容，也未修改其他写手文件、脚本、源码、测试、标准名单和计划。

### 数字与条件

| 数字/机制 | 底稿与核实范围 |
|---|---|
| W8A8 线性方法先动态量化再矩阵乘 | `docs/mainline/02-forward.md` §3.4；底稿标记的“稠密 MLP 实际 apply/激活融合分支待核”继续保留，未升级为镜像运行事实 |
| MC2 专家 rows×4096→两路合计4096→2048→4096，每卡18专家 | 同底稿 §6.6；形状与专家分布只引用结论并回链 one-request，不重复推导完整权重账、R1 字节账或 MC2 容量门槛 |
| 派发已量化时复用整数输入及 dynamic_scale，否则先量化 | §6.6，另核实际条件及融合/拆分分支 |
| 4096×2 B=8192 B=8 KiB；写出再读回16 KiB | 继承 P4 的单行中间量示例，宽度与 §6.6 一致；明确只计该张量的逻辑读写、不含缓存/合并/其他输入输出、不等于实测或融合实际节省量 |
| R1 prompt=4 token | 教学设定，首现说明并回链 R1；没有复算或写死 R1 块数 |
| x=[1,3]、residual=[1,−1]、γ=[1,1]、ε=0→s=[2,2]、r=0.5、y=[1,1] | 新增示意演算；非零输入暂取 ε=0 仅为便于手算，真实模型使用其配置 ε；演示融合后仍要保留两份语义不同的结果，不是部署数 |
| 扩展3份输出张量 | 固定提交 C++ 适配层直接分配 y、rstd、更新后残差，属于源码事实 |

### 核心概念原始证据

以下文件均实际读取过相关段；版本对象通过本地 git show 核对，未使用检出目录冒充 orphan commit。

| 结论 | 提交、文件与行号 |
|---|---|
| GLM 构造两处 RMSNorm，mHC 后单参数调用 | `vllm-ascend@db701c1f`：`vllm_ascend/models/glm5_next.py:2129–2169,2212–2235` |
| 注册、设备方法选择 | 同提交 `vllm_ascend/utils.py:735–768`；`vllm@0fc695fc`：`vllm/model_executor/custom_op.py:110–149,174–207` |
| residual/bias 分支，已有接口回退 | `vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py:63–88` |
| 延迟加载、批不变性/A5 门控及失败日志 | 同提交 `vllm_ascend/utils.py:409–467` |
| Host 读取向量核数/UB、选择精度/分块 | 同提交 `csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp:19–58,208–222,373–411` |
| tiling key 选择模板 | 同提交 `csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.cpp:23–71` |
| 残差搬入相加后写回，向量归约与缩放 | 同提交 `csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h:96–155,167–208,320–334` |
| 三份输出与 CANN 下发入口 | 同提交 `csrc/moe/add_rms_norm_bias/add_rms_norm_bias_torch_adpt.h:21–50` |
| 动态线性量化/普通与拆分矩阵乘 | 同提交 `vllm_ascend/quantization/methods/w8a8_dynamic.py:75–126` |
| MC2 专家已有量化输入复用、融合或拆分及第二组矩阵乘 | 同提交 `vllm_ascend/ops/fused_moe/moe_mlp.py:133–220` |
| v0.23/v0.26/main 的 RMSNorm 差异 | `2c59ff10:ops/layernorm.py:63–88`、`2ed6cbba:ops/layernorm.py:63–86`、`baa023ad:ops/layernorm.py:64–84`，均带 `vllm_ascend/` 前缀；对应 utils 行号分别409–467、401–459、521–579 |

`git diff 2c59ff10 db701c1f -- vllm_ascend/ops/layernorm.py` 为空，支持固定工作版与维护分支在此类实现上相同。三版模型目录用 `git ls-tree -r --name-only <pin> vllm_ascend/models` 核对：两个发布钉点无 GLM5，main 为 models/glm5next/。没有把 main 的“直接导入并调用扩展”写成固定镜像的回退行为。

线上实际打开了 [CANN 8.0.RC2 基本架构](https://www.hiascend.com/doc_center/source/zh/canncommercial/80RC2/developmentguide/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html)与 [RMSNorm 原论文页面](https://arxiv.org/abs/1910.07467)，分别核对计算单元职责和均方缩放定义；精确公式还与上述设备源码对照。未把通用架构材料当成本部署性能测量。本页不推导 TP/DP/EP 或通信原语，未另取这些主题的参考图。

### P4 信息清单逐项勾选

动笔前通过 `git show p4-checkpoint:wiki/concepts/op-to-ai-core.md` 读取旧正文，清单保存于 `tmp/p5/op-to-ai-core-facts.md`。逐项结论：15/15 保留，迁移0、删除0。

| 清单 | 核对结果与新版位置 |
|---|---|
| F01 | 保留：RMSNorm公式、同宽与矩阵乘区别；第一节与融合节，基础链接保留 |
| F02 | 保留：两处 norm、hc_pre、单参数调用；GLM 节 |
| F03 | 保留：注册/forward_oot/已有接口、kernel 数量边界；GLM、误解及源码区 |
| F04 | 保留：GLM 实际路径与可选 residual 对照；融合节及流程图 |
| F05 | 保留：s、y、bias、两份返回与扩展回退；公式、示意、源码区 |
| F06 | 保留：省下发/重复访问的条件、残差仍写回、无收益承诺；动机、设备、流量节 |
| F07 | 保留：批不变性/设备门控与加载失败；源码开关、错误、版本表 |
| F08 | 保留：输出分配及 EXEC_NPU_CMD；动机、Host、源码区 |
| F09 | 保留：Host 规划与设备计算职责；Host 节 |
| F10 | 保留：三种精度、行列模板、核数/UB/偏置条件、阈值含义；Host 节 |
| F11 | 保留：key 对应模板而非硬件容量；Host 节 |
| F12 | 保留：搬入、归约、缩放、写出；设备节及流程图，细化残差提前写回位置 |
| F13 | 保留：全局/局部容量、分块与访问顺序、AI Core 链接；动机/Host/设备节 |
| F14 | 保留：4096、BF16、8192 B/8 KiB、16 KiB 及逻辑访问限制；GLM 的单行 calc |
| F15 | 保留：先核语义/误差/分派/布局/分块，再做硬件与端到端测量；优化判断与源码开销节 |

### Evidence：验证与密度

- 字数按**去 frontmatter、正文 Markdown 去全部空白字符**计，包含源码区与链接目标：**1938→7913**。若保留空白，parsePage 的正文长度为2141→8696。不是仅汉字数。
- 项目写作标准口径（汉字加英文词，去链接地址，不计围栏内容）：教学正文3475字；行内代码0、0/千字；calc 2块、0.576/千字；对照源码以上证据角标0；相邻表/calc冲突0；免责触发3/105句=2.86%。来源区8处角标，6 C+2 S，C占75%，23条来源均保留对应关系。
- 第一张图位于页面53–55行；图前无部署数字、无数值算例、calc 0。两图宽860/880，均≤900。源码区为最后H2，五个H3顺序完整；既有跨页锚点保留。
- 每次保存页面后运行 `pnpm.cmd wiki:lint`。最初裸 `pnpm` 被本机 PowerShell 执行策略阻止，换用 `.cmd` 后执行；曾出现的本页关系枚举、反向重复边、图缺派生物等已当场修复。
- 最后一轮 `pnpm.cmd wiki:lint`：**本页0报错**，全站退出1，剩余 `npugraph-ex.md` 指向不存在的 `output-processor.md`。别页错误未修改。
- `pnpm.cmd check:content`：退出0，registry 133页通过；工具提示“尚无章节，Term引用检查跳过”。此命令未重建 registry，不能把133与审计读取的138页混作同一范围。
- `pnpm.cmd wiki:diagrams --check`：最后退出0，**281张图与spec一致**。本页图无边界/重叠错误。流程图的6条代码名提示为非阻塞建议：本图用于展示实际代码分叉，保留必要方法名；通用直觉图不放代码名。
- `pnpm.cmd wiki:audit`：本页23条来源无错误，21条源码行号有效、2条URL由本轮另行联网打开；全站退出1，2条行号越界来自 api-server-entry 的 `renderers/base.py:1018–1059` 和 streaming-output 的 `engine/detokenizer.py:309–345`。raw摘录未定位的提示不等于已验证摘录；本轮直接读固定提交核对语义。
- 本页未在强制写作名单中，因此另用既有 `checkStandard` 单独检查：**problems=[]**。未修改名单。用既有 `figureProblems` 与 `renderDiagram` 对两张图单独检查：**problems=[]，svgMatches=true**。
- `git diff --check -- wiki/concepts/op-to-ai-core.md wiki/diagrams/op-to-ai-core.yaml wiki/diagrams/op-to-ai-core.svg` 通过；本轮无 git 提交。

日志和临时只读检查入口保存在 `tmp/p5/op-to-ai-core-{lint,content,diagrams,audit}.log` 及同目录辅助文件，不提交。生成 SVG 仅调用已有渲染器、仅写本页两张派生图；正文和图 spec 均手写。

### Tradeoff / Open Questions

自查无 P1 疑点。仍缺固定镜像 NPU profiling：稠密 MLP 运行时 apply/激活融合选择，专家融合具体命中分支、kernel 数量、设备访问和加速幅度均未宣称实测完成。相关缺口明确留在页末。

依用户 common-v2 跳过起服务、截图及浏览器验收，不占用5193/8790；没有硬件实测，没有独立审查冒名背书。独立审查与浏览器操作由审查环节执行。需要用户决定的事项：无。

## P5 审查（09-29）

审查员：Claude Opus 5.5（独立审查，只审不改页面）。基线 `p4-checkpoint`，现版为工作区未提交状态。

### 结论

**8.5 / 10。学习顺序通过；`pnpm wiki:audit` 本页通过（23 条来源无 ✗，写作标准 problems 为空）；P1 = 0，P2 = 4，P3 = 3。**

### 必做项逐条

1. **初学者测试（只读前两屏）**：一句话——「算子说要算什么，kernel 是卡上真正执行它的程序；落到 AI Core 就是把运算拆成适合矩阵单元和向量单元的执行段、安排数据搬进搬出，代价是分块的搬运、循环和等待。」前两屏（§1 谁在干活、§2 为什么分块和融合）能说清概念与代价，第一屏无 GLM 数字、无演算，直觉图在第 53–55 行，符合「先是什么 → 为什么 → 怎么算」。通用理解各节全部排在 GLM 节之前，GLM 之后只剩常见误解与对照源码，符合基础页第 13 条。
2. **核心概念核对（固定提交实读，附行号）**：
   - `vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py` 70–88：`residual is not None` → `enable_custom_op()` 真走 `torch.ops._C_ascend.npu_add_rms_norm_bias`、假走 `torch_npu.npu_add_rms_norm` 再按 bias 相加；无 residual 走 `torch_npu.npu_rms_norm`，`bias_loaded` 时再加。页面第 92、124 行与流程图分支一致 ✓
   - 同提交 `vllm_ascend/models/glm5_next.py` 2217–2233：`hc_pre(...)` 得 `layer_input` 后 `self.input_layernorm(layer_input)` / `self.post_attention_layernorm(layer_input)`，均为单参数。页面第 124 行一致 ✓
   - 同提交 `csrc/moe/add_rms_norm_bias/op_host/add_rms_norm_bias_tiling.cpp` 209–222：`GetCoreNumAiv()` 与 `GetCoreMemSize(UB, ubSize)`，并扣除 `UB_USED`。页面第 100 行「读取可用向量核数与 UB 容量」一致 ✓
   - 同提交 `csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h` 110–151：`CopyIn` 内搬入 x1/x2、`Add` 后 `DataCopyCustom(xGm[...], x_out, ...)` 写回；`CopyOutRstd` 在行循环之后。页面第 108 行「残差在 CopyIn 中就写回」「在相应循环结束处保存缩放统计量」一致 ✓
   - 同提交 `vllm_ascend/quantization/methods/w8a8_dynamic.py` 82–121：先 `npu_dynamic_quant`，随后按 `layer._chunk_size > 0` 走两次 `npu_quant_matmul` + `torch.cat`，否则单次。页面第 134 行「按加载时设置拆成两次矩阵乘再拼接」一致 ✓
   - 同提交 `vllm_ascend/ops/fused_moe/moe_mlp.py` 133–212：`w1_scale_bias is None and w1_offset is None and is_mc2` 下分「融合 `npu_grouped_matmul_swiglu_quant`」与「`npu_grouped_matmul` + `npu_dequant_swiglu_quant`」两路；dispatch 已带 `dynamic_scale` 时不重复量化。页面第 136、140 行一致 ✓
   - 结论：**核心概念无错。**
3. **数字对底稿**：`docs/mainline/02-forward.md` §6.6 表给出 `[rows,4096] × [18,4096,4096] → [rows,4096] → swiglu → [rows,2048] → × [18,2048,4096] → [rows,4096]`，与页面第 138 行的形状链一致；每卡 18 个路由专家与 `one-request.md:313`「42 层 MoE：每卡 18 个专家」一致。§3.4 标注稠密 MLP `apply` 分支「待核」，页面只写到「不能只数一次线性层调用」，没有把待核升级成已验证 ✓。双机前提（2×A2×8、TP8/DP2/EP16、W8A8）与 `glm-5-3-flash-two-node.md:51` 一致 ✓。4096 × 2 B = 8 KiB、一写一读 16 KiB 与旧版同源，且明示只算该张量逻辑读写、不是实测 ✓。未出现 R1 块数定值、未自行重算 R1 ✓。
4. **丢信息**：`git diff p4-checkpoint -- wiki/concepts/op-to-ai-core.md` 的删除行共 28 行（不含空行），逐条落位：旧 §「从一行隐藏表示开始」的 RMSNorm 语义进第 51、71–78 行；GLM 两处调用、注册与分派进第 124、166 行；`npu_add_rms_norm_bias` / `npu_add_rms_norm` / `EXEC_NPU_CMD(aclnnAddRmsNormBias, ...)` 进 aliases 与源码区第 172、178 行；tiling 精度/阈值/key 进第 100–102 行；8 KiB / 16 KiB 进第 144–152 行；旧的正文证据角标 [C1]–[C13] 被删除，符合「对照源码之上不出现角标」。旧标题「GLM 实际从哪里调用 RMSNorm」保留，`reading-vllm-ascend.md:103` 的入链仍可解析。**未发现信息丢失。**
5. **旧版信息清单抽查**：清单存在于 `tmp/p5/op-to-ai-core-facts.md`（写手沙箱写不进 scratchpad，按派发说明在仓内）。抽查 F03、F07、F09、F10、F11、F12、F14 共 7 条，均在新版找得到对应位置（第 160、168/172、96、100、102、108、144–152 行），勾选属实。
6. **链接与锚点**：`pnpm wiki:lint` 通过（仅 5 处与本页无关的 mark-flood 提示），锚点硬校验已覆盖 `one-request.md#第-4-站…`、`#示例请求-r1-与官方双机部署`、`#42-层-moe每卡-18-个专家`、`#moe-通信走-mc2-还是-allgather`、`glm-5-3-flash-two-node.md#部署前提`。全库指向本页的锚点只有 `reading-vllm-ascend.md:103`，仍有效。
7. **audit**：`pnpm wiki:audit` 本页 21 条行号来源全 ✓、2 条 URL，无 ✗；写作标准行内代码 2.9/千字、角标 0、相邻块 0、图先行 ✓、图宽 ✓。全站退出 1 的两条越界来自 `npugraph-ex.md` 与别页，与本页无关。
8. **浏览器实测（未完成）**：Playwright 1440 宽打开 `http://localhost:5193/#/wiki/op-to-ai-core`，页面空白、控制台 5 条 502；`http://127.0.0.1:8790` 无响应，后端未运行。按纪律不起服务，故改为把两张 SVG 内联渲染截图（`scratchpad\op-to-ai-core-review-op-to-ai-core-intuition.png`、`…-op-to-ai-core.png`）审图，**页面级排版与浏览器观感本轮未验证**。

### P1

无。

### P2

- **P2-1（重复，跨页）**：本页第 134–140 行（§「归一化之后，矩阵和向量执行段怎样接上」）与同批 `ai-core.md` 第 95–99 行讲的是同一件事——W8A8 稠密层先动态量化再量化矩阵乘、MoE grouped matmul、4096 → gate/up → SwiGLU → 2048 → 4096、dispatch 已量化则复用、融合与拆分两分支，连「完整形状见 one-request#42-层-moe每卡-18-个专家」的链接都相同。**归属建议：机制留在本页**（本批队列要求本页画「算子分配到矩阵单元与向量单元的执行段」，这段正是直觉图的落点），`ai-core.md` 压成一句话 + 链接。两页都在本轮改动，任选其一收口即可，否则后续数字改动会两处漂移。**与 ai-core 审查员只记这一条。**
- **P2-2（meta 文本）**：直觉图 `wiki/diagrams/op-to-ai-core-intuition.yaml/.svg` 底部灰字「数据依赖示意 · 无核数或性能比例」是写给审查者看的免责说明，属于页面 meta 文本（09-28 口径记 P2）。改法：删掉，或换成对读者有用的标注（例如直接标「中间结果经 GM 交接」）。
- **P2-3（演算走的是非实际分支）**：全页唯一的手算（第 82–88 行 calc）用的是带 residual 的融合对照分支，而 GLM 实际路径不传 residual，第 51 行也只用文字描述 RMSNorm，没有给出 residual 缺省时的式子。初学者容易把对照分支当成实际路径。改法：在第 71–78 行的式子后补一句「不传 residual 时即 s = x，后两行照旧」，或在 §1 保留旧版的两行纯 RMSNorm 式子。
- **P2-4（免责重复）**：「要以设备测量为准 / 不能据此宣称加速 / 需 profiling」在第 65、116、138、152、160 行共出现 5 次，语义重合。扩写 4 倍后这是最明显的注水点。改法：保留 §「怎样判断优化是否成立」和误解最后一条，其余三处删掉或并进该节。

### P3

- 第 118–120 行先用 mHC，第 124 行才解释它是什么（术语先用后讲，同屏内，影响小）。
- 第 138 行用 SiLU 未作解释，前文也没出现过；建议改成「门控激活（SiLU）」或一笔带过。
- 直觉图第二组标题「对照：RMSNorm 归一化」语义重复（RMSNorm 本身就是归一化），建议「对照：纯向量的 RMSNorm」。

### 本轮跳过 / 未验证

- 按纪律跳过 frontmatter 的 sources 区、代码与命令块、`## 对照源码` 正文（只用 grep 核了五个 H3 的齐全与顺序，以及版本差异表里 v0.23 `2c59ff10` / v0.26 `2ed6cbba` / main `baa023ad` 与 `db701c1f` 的 orphan 标注）。
- 读页面正文第 94–118 行那一段时被安全分类器拦了一次，之后改用更小粒度重读，该段内容（Host tiling、设备侧、优化判断）已按分段读完并核对。
- 浏览器页面级验收未完成，原因见必做项第 8 条；两张图已单独渲染审过。

## P5 修订记录（GPT-6 Astra）

日期：2026-10-02。本轮依据末尾 P5 审查修订；以开始工作时的页面为基线，不重做旧版信息清单。实际修复 6 条；P2-1 按用户补充指示保留本页完整讲解，跨页收口留给后续任务。本轮没有判定不成立的审查意见，没有修改 `ai-core.md`。

### Why / What：逐条对应

| 审查项 | 处理结果与证据 |
|---|---|
| P1 | 原审查无 P1；本轮自查未发现新增 P1 疑点。 |
| P2-1：与 ai-core 重复 | 接受审查的归属建议，完整保留本页「归一化之后，矩阵和向量执行段怎样接上」（134–142 行）的动态量化、专家分组、融合/拆分分支、形状链和量化结果复用。用户明确要求不要碰 `ai-core.md`，另一页改为一句话加链接不在本轮执行；因此不宣称跨页重复已经消除。 |
| P2-2：图中 meta 文本 | 删除 `op-to-ai-core-intuition.yaml` 原第 25 行的免责灰字，重新生成 SVG；保留数据依赖箭头与先矩阵乘、再激活的教学说明。未采用“经 GM 交接”的示例替换，以免把特定交接路径写成所有融合实现的通则。 |
| P2-3：缺少无 residual 的公式对应 | 页面第 80 行明确无 residual 时 s=x，继续使用 r、y 两式，接口仅返回 y；带残差的原演算仍保留作实现对照。实际读取固定提交 `vllm-ascend@db701c1f:vllm_ascend/ops/layernorm.py:63–88`：有 residual 返回二元组，无 residual 最终只返回 x；同提交 `vllm_ascend/models/glm5_next.py:2212–2235` 的两处归一化均为单参数调用。 |
| P2-4：重复测量提示 | 删除原第 65 行的测量提示，把启动数量及单元交接取决于实现的条件移至「怎样判断优化是否成立」（现第 118 行）；MoE 段仅解释图与实际运算的对应。第 154 行改为直接说明 16 KiB 的统计范围、缓存/访问合并影响与省流量的成立条件。保留优化判断节及误解末条的测量要求；原有待核事项仍在页末。 |
| P3-1：mHC 先用后讲 | 删除融合对照段中提前出现的 mHC 名字，把多路残差混合的解释移到实际首次出现处（第 122 行），后面的两个 RMSNorm 调用说明不再重复定义；相关结构链接保留。固定提交的 hc_pre → 单参数归一化顺序同上。 |
| P3-2：SiLU 未解释 | 第 140 行就地解释为逐元素的平滑非线性激活，并说明变换后的值充当门、与另一支对应相乘。核对站内 `mlp-residual-norm.md:142–151` 及 [PyTorch SiLU 文档](https://docs.pytorch.org/docs/2.14/generated/torch.nn.SiLU.html)；完整形状仍链接主线，不在本轮新增推导。 |
| P3-3：图标题重复 | 直觉图第二组标题改为“对照：纯向量的 RMSNorm”（YAML 第 7 行，SVG 第 7 行），明确与上方矩阵、向量协作的区别。 |

### Evidence：数字、验证与自查

- 本轮没有改变数值算例、部署数或 sources。重新读取底稿 `docs/mainline/02-forward.md` §3.4（233–237 行）与 §6.6（699–711 行）：保留稠密 MLP 运行分支待核，专家形状仍为 4096 → 两支合计 4096 → 2048 → 4096，每卡 18 个专家；4096/BF16 的单行 8 KiB、逻辑写读 16 KiB 沿用原计算，不改成已测节省量。另打开 [RMSNorm 原论文摘要](https://arxiv.org/abs/1910.07467)核对按均方根缩放的概念。
- `pnpm.cmd wiki:lint`：退出 0，本页 0 报错；全站 5 条非阻塞 mark-flood 提示均来自其他页。保存页面后即执行。
- `pnpm.cmd wiki:diagrams --check`：退出 1，全站唯一阻塞来自 `diagrams/speculative-decoding.yaml items[14]`，“位置 8 · 主模型”文字约 100px、框内只有 88px；按范围要求没有修改另一页。本页 0 报错，并补跑既有 `tmp/p5/check-op-to-ai-core-diagrams.ts`：两张图均为 `problems=[]`、`svgMatches=true`，分别为 860×450 与 880×900，独立确认边界及 YAML/SVG 一致性，避免将全站提前退出误当成本页完整验证。
- `pnpm.cmd wiki:audit`：退出 0，本页 23 条来源无错误，其中 21 条源码行号有效；全站 138 页，本地引用错误 0，名单内 86 页写作标准均通过。该命令不验证 URL 可访问性、raw 摘录或语义；本轮对新增澄清另读固定源码，未声称重审全部来源。
- `pnpm.cmd check:content`：退出 0，registry 133 页通过；工具提示尚无章节，Term 引用检查跳过。registry 与 audit 的页面统计范围不同。
- 另用既有 `tmp/p5/measure-op-to-ai-core.ts` 调用 `checkStandard`：`problems=[]`。教学正文统计口径为汉字加英文词、去链接地址与围栏：3505 字，行内代码 0/千字，calc 2 块、0.571/千字，正文证据角标 0，相邻表/calc 冲突 0，免责触发 3/108 句（2.78%）。首图仍在第 53–55 行，图前无部署数和数值演算、calc 0；对照源码仍为末尾 H2，五个 H3 顺序不变。
- 本轮改前→改后为 **7913→7958 字符**：去 frontmatter 与全部空白，包含源码区和 Markdown 链接目标，并非纯汉字数。开始时的页面副本保存在 `tmp/p5/op-to-ai-core-revision-before.md`，已用 `git diff --no-index` 检查本轮差异；diff 返回 1 表示存在预期修改。
- `git diff --check -- wiki/concepts/op-to-ai-core.md wiki/diagrams/op-to-ai-core-intuition.yaml wiki/diagrams/op-to-ai-core-intuition.svg wiki/diagrams/op-to-ai-core.yaml wiki/diagrams/op-to-ai-core.svg` 通过。仅手工修改本页与直觉图 spec，调用既有渲染器同步本页图；修订记录追加在本文件，无 git 提交。
- 命令日志：`tmp/p5/op-to-ai-core-revision-{lint,diagrams,audit,content}.log`。旧版信息清单按用户要求不重做；本轮差异复核保留原数字、分支、链接、误解和待核内容。

### Tradeoff / Open Questions

按共用说明 v2 不起服务、不截图、不占用 5193/8790；本轮未作浏览器页面验收或 NPU 测量。保留固定镜像稠密 MLP 实际分支、MoE 融合命中、kernel 数量、实际流量与加速幅度的待核项。本页两张图的结构和派生物已验证，页面视觉验收仍由审查环节完成。P2-1 的另一页收口依用户指示另行处理；本轮需要用户决定的问题：无。
