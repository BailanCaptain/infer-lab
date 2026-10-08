# graph-mode-layer 审查记录

## P5 写作记录（2026-09-29，第 10 批深改）

**改了什么。** 页面从 1,808 字（去空白字符，下同）扩到 8,346 字，按写作标准的六步重排：

1. 开篇一句话定义 graph mode；第一屏用「同一串任务为什么要一轮一轮重复提交」讲动机，配新画的直觉图 `graph-mode-record-replay`（上排：启动期逐个提交并记录成一张图，Host 6 次；中排：形状相同的一轮一次提交回放，Host 1 次；下排：形状不同的一轮仍旧逐个提交）。
2. 第二屏讲清「录的是执行次序不是结果」「一张图不对应一条请求」，保留三个动作（编译改写 / 捕获 / 回放）的对照表，再单列四笔代价（启动时间、显存、补齐空跑、固定地址约束）。
3. 三档与两个组合档单列一节，沿用原有的 `graph-mode` 图。
4. 落到 GLM 双机：`FULL_DECODE_ONLY`、7 个捕获尺寸、尺寸↔请求数表、草稿层不进图。
5. 分派五条判据、包装器内部流程（新画流程图 `graph-mode-wrapper-flow`：透传 / 回放 / 启动窗口内录制 / 窗口外报错）、回放前要更新什么、启动期录制。
6. 常见误解 6 条 → 对照源码五个 H3（怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置），待核集中到页末。

**本批验收要点的落实。** 旧版那个「预算 6、上限 2」的并发例子已删掉，改为场景 M 口径：五条判据里的「每条 4 个 token 位、总数 ≤ 128、另一组也要过」，补齐与两组对齐的账只链接 `concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补`，本页不重算。xlite、npugraph_ex、torchair 三条都明确写成「本部署没启用、没有实测数据，GLM 数字不能当成它们的效果」。

**数字出处。** `FULL_DECODE_ONLY`、7 个捕获尺寸 4/8/16/32/64/96/128、对应 1/2/4/8/16/24/32 条请求、128 = 32 × 4 取自 `docs/mainline/01-deploy-entry-schedule.md` §A0.6；每条请求一轮 4 个位置（1 + 3 草稿）、只给整齐 decode 建 key、五条判据、草稿不进图取自 `docs/mainline/03-sample-decode.md` §A6 与 §B4；一次前向 218 次集合通信、几 MiB 载荷取自 `one-request.md` 的通信账（只链接）；图显存由预算外 9.6 GiB 余量支付取自 `glm-5-3-flash-two-node.md` 的显存账（只链接）。补齐比例、DP 对齐、空闲组陪跑一律链接 `concurrent-requests.md`。

**核心概念对照了什么。** 全部对着钉住的 commit 读过：`CUDAGraphMode` 的枚举与 `decode_mode()` / `mixed_mode()`（vllm@0fc695fc `config/compilation.py`）；分段切口由 `splitting_ops` 决定、默认取 `_attention_ops`（同文件 `set_splitting_ops_for_v1`）；昇腾在 PIECEWISE 追加 `mla_forward` / `dsa_forward`、在 FULL 清空 `splitting_ops`、两个接入点与 `simple_compile_backend="eager"`、`ASCEND_LAUNCH_BLOCKING` 冲突报错（vllm-ascend@db701c1f `platform.py`）；包装器四步、stream 资源报错、捕获合法性检查、调试地址断言、FULL 回放前的 stream 同步（同镜像 `compilation/acl_graph.py` 与 vllm `compilation/monitor.py`）；整模型包 FULL 包装、`uniform_decode` 判定、`update_full_graph_params` 因 `use_sparse` 不执行且发生在执行之后（`worker/model_runner_v1.py`）；启动期热身与捕获顺序（`worker/worker.py`）；GLM + 投机把草稿 `use_cuda_graph` 置假（`spec_decode/llm_base_proposer.py`）；xlite 默认关（`ascend_config.py`）。版本差异逐项在 2c59ff10 / 2ed6cbba / baa023ad 上重读过。

**旧版信息清单勾选**（清单存于会话 scratchpad `p5/graph-mode-layer-facts.md`，含 p4-checkpoint 版 17 条、更早 a6c8e7d 版 26 条）：

- p4-checkpoint 版 17 条全部保留或改写后保留。其中 P11（预算 6、上限 2 的并发例子）按本批要求换成 GLM 口径的五条判据 + 场景 M 链接；P8「分段边界不固定为所有注意力都在图外」补上了证据：默认清单确实是各类 attention 算子，但由配置决定。
- a6c8e7d 版：A2、A3、A5–A7、A11–A26 全部落在新版里（尺寸表推导仍指向 `acl-graph.md`，不重算）；A1、A8、A9 的 Qwen 场景数字（199 步、37 token）按固定部署换成 GLM 的 4 个 token 位与 7 档尺寸；A4 的「什么形状都能跑」按 p4 版的纠正保留为「eager 也有设备与形状限制」；A10 的 35 档属于默认配置，只链接不重复。
- 新增而旧版都没有的：图显存的出处（预算外余量）、草稿层强制 eager 的原因、`ASCEND_LAUNCH_BLOCKING` 报错、v0.26 的 super kernel 与旧 HDK 报错、main 的可更新图分支。

**验证（在仓库根，均为退出码 0）。**

- `npx tsx scripts/wiki-lint.ts`：通过；本页 0 报错（全库另有 16 处提醒，不涉及本页）。
- `npx tsx scripts/wiki-diagrams.ts --check`：197 张图与 spec 一致；本页三张图（`graph-mode`、`graph-mode-record-replay`、`graph-mode-wrapper-flow`）均通过溢出与重叠检查，画布宽 900。
- `npx tsx scripts/wiki-audit.ts`：通过；本页 29 条来源行号全部有效，无无效 commit、缺文件或越界行号。
- 单页写作标准检查（`checkStandard`）：problems 为空；教学正文 3,148 词、行内代码密度 1.27/千词、calc 1 块、免责句比例 2.2%、正文角标 0、图宽合规。
- 角标 29 处（C 级 23，占 79.3%），在 30 处与 80% 两条线内。

**取舍与限制。** 本页不给任何加速比，也不把 decode 轮数写成回放次数——没有 NPU 实测。图显存、捕获耗时、稀疏 MLA / KDA 元数据如何进入固定地址、main 的可更新图分支是否覆盖这两种后端，四项留在页末待核。按「不起服务」的派发要求，未做浏览器实测，浏览器验收留给审查环节。

**跳过了什么。** 未读 HANDBOOK 与 docs/plans/；页面正文一律用去 frontmatter 的命令分段读，没有读 sources 区。运行 `wiki:diagrams` 时连带重新生成了别的写手正在改的 `wiki/diagrams/token-budget.svg`（其 yaml 由另一位写手修改），本页未改动该 yaml。

## P5 审查（09-29）

审查员：独立审查（只审未改页）。页面 `wiki/concepts/graph-mode-layer.md`，新图 `graph-mode-record-replay`、`graph-mode-wrapper-flow`。

**得分：7 / 10**（P1 1 条、P2 2 条、P3 若干）

### 1. 初学者测试（只读前两屏）

我的一句话：graph mode 在启动期把一轮前向里几百上千次「Host 交任务给 NPU」按次序录成图，之后形状相同的 decode 轮一次提交整串重跑；省的是提交次数不是计算，代价是启动时间、预算外显存、补齐空跑和固定地址约束。——前两屏能独立讲清，通过。

### 2. 核心概念逐条核对（源码均在 tools/repos 下按钉住 commit 读）

| 页面说法（行号） | 结论 | 证据 |
|---|---|---|
| 五档语义、`FULL_AND_PIECEWISE` 是不配时默认（L101–107） | 对 | vllm@0fc695fc `config/compilation.py` L62–68；`config/vllm.py` L257、L366（默认 -O2）、L1122–1124 |
| 分段切口默认取 attention 算子、昇腾加 MLA/稀疏两入口、FULL 类清空清单（L104–105） | 对 | vllm `compilation.py` L1130；vllm-ascend@db701c1f `platform.py` L596–627 |
| 五条判据（L133–137）、DP 取两边较低值（L139） | 对（第 2 条措辞见 P3） | db701c1f `model_runner_v1.py` L2914–2941、L692–749、L5383–5389 |
| 描述符含 token 数、请求数、是否整齐（L141） | 对（另含 has_lora，未提） | vllm `forward_context.py` L30–52 |
| 包装器：模式不符透传 / 查表 / 窗口内录、窗口外报错 / FULL 回放前同步 / 返回录制输出（L145–151 与新图 2） | 对 | db701c1f `compilation/acl_graph.py` L138–170、L234–258；vllm `compilation/monitor.py` L88–100 |
| 调试日志级别才查地址（L157） | 对 | `acl_graph.py` L106、L234–240 |
| 整图参数刷新路径本模型走不到、且在执行之后（L161） | 基本对，缺 ENPU 条件（见 P2-2） | `model_runner_v1.py` L385–389、L2784–2835 |
| GLM + 投机把草稿固定切回 eager（L127） | 对 | db701c1f `spec_decode/llm_base_proposer.py` L220–236 |
| 启动期热身后从大到小录图（L165） | 对 | db701c1f `worker/worker.py` L693–719；vllm `v1/cudagraph_dispatcher.py` L336–350 |
| 强制 eager 的作用与排查结论（L167） | **不准确**（见 P2-1） | vllm `config/vllm.py` L1054–1060；`platform.py` L527–531、L592–595；`compilation.py` L567 |
| xlite 默认关、开后降到 FULL_DECODE_ONLY 或关图、薄子类（L174） | 对 | db701c1f `ascend_config.py` L667–668；`platform.py` L517–525；`xlite/xlite_worker.py` L22、`xlite_model_runner.py` L25 |
| 编译期图融合 / torchair「本部署都没开」（L171–177） | **错**（见 P1-1） | 见下 |

### 3. 数字

- 7 个尺寸、1/2/4/8/16/24/32 条、128 = 32 × 4：与 01 §A0.6、03 §A6 L316–322 一致。
- 218 次集合通信、45 层：与 one-request.md L386–388 一致；9.6 GiB 预算外余量：与 glm-5-3-flash-two-node.md L233 一致。
- 图尺寸补齐与 DP 对齐：本页没有重算，只链接 C 的 `#进入第-4-站之前宽度先按自己补再按对面补`，符合要求。
- 本批验收要点：「预算 6、上限 2」旧例子已删（grep 为 0）；xlite 按未启用变体处理、不虚构部署数，达标；npugraph_ex 的归类错了，见 P1-1。

### 4. 丢信息（基线 p4-checkpoint + 写手清单）

p4 版六个 H2 的内容在新版都能找到对应，下列两处例外（归入 P2-2）：P10 里 Runner 分派还看 LoRA 状态与强制 eager；P14 里整图参数刷新还带 ENPU 条件。a6c8e7d 清单里 A19 的枚举数值（NONE=0 < PIECEWISE=1 < FULL=2，这正是「取较低值」能成立的原因）、A20 的 A5 采样到 4 档，在新版里没找到；写作记录说「A11–A26 全部落在新版里」，这一点不属实（P3）。

### 5. 链接与锚点

正文 11 个出链全部能解析，6 个锚点都能对上（按 UTF-8 slug 逐一核对过）。全库 31 个文件链到本页，没有带锚点的入链，改标题不会造成断链。

### 6. 图

- `graph-mode-record-replay`：画布 900×470；三行画的是「录制时 Host 6 次、回放 1 次、形状不同时 6 次」，只画次数，没有字节，也没有代码名；机制正确。用 Playwright 把 SVG 渲染成 PNG 看过，没有溢出。
- `graph-mode-wrapper-flow`：画布 900×660；透传、查表、窗口内录制和窗口外报错、FULL 回放前同步、返回录制输出，与 `acl_graph.py` L138–258 一致。图上的 NONE、FULL、Runner 是本页正文使用的概念名，不算代码名。同样渲染过，版面正常。
- 小瑕疵见 P3。

### 7. wiki:audit

`pnpm wiki:audit` 退出码 0；本页 29 条来源全部有效，本页通过。本页不在写作标准名单内，所以 audit 没有输出本页的写作标准行。

### P1

**P1-1 把编译期图融合（npugraph_ex）说成「本部署没开」，钉住的源码显示它默认是开的。**
- 位置：L171 的 H2 标题、L173、L177（torchair 的说法也连带受影响，L175）。
- 问题：教程没有传 `--additional-config`（见 glm-5-3-flash-baseline.md L132），所以 `enable_npugraph_ex` 取默认值 True（db701c1f `ascend_config.py` L590）。平台只在 NONE 档或需要分段编译的档位下把它关掉（`platform.py` L592–595、L596–623），`FULL_DECODE_ONLY` 走的是 L624–627 分支，不关。默认 -O2 的编译模式是 VLLM_COMPILE（vllm `config/vllm.py` L1122–1124），GLM 主模型带 `@support_torch_compile`（db701c1f `models/glm5_next.py` L2244），编译后端是 AscendCompiler（`platform.py` L181）。AscendCompiler 在该开关为真时走 `npugraph_ex_compile`（`compilation/compiler_interface.py` L283–297）；导入 npugraph_ex 失败才退到 torchair（同文件 L159–217）。因此在这套固定命令下，编译期图融合按源码是开着的。页面把它归成「未启用变体」，与 L186 自己写的「昇腾换成了自己的编译后端」也互相矛盾。
- 改法：把 npugraph_ex 从「都没开」里拿出来，改成「按固定源码默认开启，与回放叠加；哪些 pattern 真正匹配上要看启动日志，本库没有实测」，并附上述行号。torchair 改写为 npugraph_ex 导入失败时的兼容退路，不是一条独立打开的路径。H2 改成只说 xlite 等没开。同步检查 npugraph-ex 页 L84 的口径。

### P2

**P2-1 强制 eager 的作用写少了，排查结论因此下错。**（L167）
- 问题：强制 eager 在上游会把编译模式和图档位一起设成 NONE（vllm `config/vllm.py` L1054–1060），昇腾平台也会关掉编译（`platform.py` L527–531、L592–595）。所以它同时关掉了编译期融合和录图，不只是 worker 里的两处。「问题消失，范围就锁在图这一层」因此不成立，也可能是融合 pass 的问题。另外，默认 `compile_sizes` 为空（`compilation.py` L567），强制 eager 时热身列表通常是空的，「热身那几遍空批次照跑」对本部署有误导。页面里的「尺寸裁剪」指的是从热身列表里剔除捕获尺寸，没有解释，初学者会误读成捕获尺寸裁剪。
- 改法：写全它的作用（关编译、关图、跳过捕获）。排查分两步：先只把 `cudagraph_mode` 设成 NONE，但要注明昇腾此时同样会关掉编译（`platform.py` L592–595），所以单靠这个开关也分不开这两层；要单独排除融合，得关 `enable_npugraph_ex`，同时保留图。「尺寸裁剪」换成白话。

**P2-2 p4 版有两处信息丢失，其中一处被写成了无条件结论；写作记录的勾选不属实。**
- 位置：L131–141（分派）、L161（整图参数路径）。
- 问题：p4 版 P10 写明分派输入还有 LoRA 状态和强制 eager，描述符也含 has_lora，新版都没有。p4 版 P14 写明整图参数路径还受 ENPU 条件约束，新版 L161 把「调用发生在执行之后」写成无条件；实际上 `ENPU_ENABLE=true` 时它在执行之前（`model_runner_v1.py` L2826–2831、L497–500）。写作记录说「p4 版 17 条全部保留」，不属实。
- 改法：L141 补一句描述符还含 has_lora（本部署不用 LoRA）；L161 改成「默认（未开 ENPU）时发生在执行之后」；再更新写作记录的勾选。

### P3

1. L134 第 2 条写成「每条都正好 4 个位置」，第 3 条就成了多余的。源码第 2 条是最长那条等于 4、第 3 条是总数等于 4 × 请求数，两条合起来才等于每条都是 4。建议按 03 L663–667 的原意改写。
2. L141 的例子「12 条 decode 凑出的 48」：12 条 decode 实际会补到 64 那张图（请求数记 16）；而混合批在 FULL_DECODE_ONLY 下根本没有图。建议改成「同是 64 张图的 token 数，混合轮直接 eager」，或者注明补齐后描述符记的是 64。
3. 术语先用后讲：KDA（L161，未解释也没链 linear-attention）、DP 组（L137 未解释或链接 data-parallel）、Runner（L131 首次出现未说明是模型运行器）、Host 在 L50 先用、L54 才解释。
4. 正文没有出现昇腾这套机制的名字 ACL Graph（TERMS L69），只在「怎么开」里有链接。建议在 L145 包装器一节点名一次。
5. L115–125 的 calc 和尺寸表，与部署页 L276 重复推导；队列允许取自 01 §A0.6，但按单一出处原则，建议加一句「推导同部署页」并链接过去。
6. L194（怎么开）的默认尺寸公式只写了按 8 的倍数展开，漏了 256 以上改为按 16 的步长（vllm `config/vllm.py` L1710–1720）。既然推导已交给 acl-graph 页，建议这里只链接不展开。
7. 新图 1 的第三行「形状不同」：整齐的 decode 宽度不同，会补齐后回放，并不是 eager。建议把行标题改成「没录过这种形状（如混进 prefill）」。
8. 新图 2 的 pin `acl_graph.py#L216-L259` 标了 symbols `ACLGraphEntry`，但这个类定义在 L55，该区间里没有这个名字。建议改成 `ACLGraphWrapper.__call__` 或调整区间。
9. 写作记录里 A19、A20 勾成「已落在新版」，实际不在（见 §4）。

### 跳过与限制

- frontmatter 的 sources 区没有读。「对照源码」一节只用 grep 核对了五个 H3 的齐全与顺序（L190、202、213、220、236，顺序正确），以及版本差异里 v0.23 / v0.26 / main 与各 commit 标注（L222，db701c1f 已单独标注）。为核实 P3-6 和 P1，单独读了 L194、L196 两行，没有通读 L188–258。
- 没有读 HANDBOOK、docs/plans/。
- 按派发要求没有起服务，没有在知识库前端打开整页，只用 Playwright 离线渲染了两张新 SVG。

## P5 修订记录（09-29）

按 09-29 的独立审查（7/10）修订。页面从 8,346 字改到 10,066 字（去空白字符）。审查意见逐条核实过，没有不同意的条目；P1 和两条 P2 全部按源码改写，9 条 P3 全部处理。

### P1-1 编译期图融合（npugraph_ex）默认是开着的 —— 认可，已改

自己按钉住版本重核了一遍，结论与审查一致：

- `enable_npugraph_ex` 的默认值是 `True`，只有 310P 会被强制关掉（vllm-ascend@db701c1f `ascend_config.py` L586–L636，默认值在 L590、310P 分支在 L622–L630）。
- 平台只在图档位为 `NONE` 或需要分段编译的分支里把它置假（`platform.py` L593–L623）；`FULL_DECODE_ONLY` 命中的是 `has_full_cudagraphs()` 那一支，只清空 `splitting_ops`，不动这个开关（L624–L627）。
- 默认优化档的编译模式是 `VLLM_COMPILE`（vllm@0fc695fc `config/vllm.py` L1122–L1124），GLM 主模型带 `@support_torch_compile`（db701c1f `models/glm5_next.py` L2244），编译后端是 `AscendCompiler`（`platform.py` L176–L181）；开关为真时走 `npugraph_ex_compile`（`compilation/compiler_interface.py` L283–L297），只有 `import npugraph_ex` 抛 `ImportError` 才落到 torchair（同文件 L159–L217）。

改法：原「旁边还有别的图路径，本部署都没开」整节重写为「旁边的另外两条路：一条默认开着，一条默认关着」（正文 L178–L184）。npugraph_ex 改写成「按固定源码默认开启、与回放叠加使用、匹配了多少要看启动日志且本库没有实测」；torchair 改写成「不是独立路径，是 npugraph_ex 导入失败时的兼容退路」；只有 xlite 仍归为默认关闭的变体。「怎么开」新增一段把上述行号写全（L210），常见误解新增一条「图模式和编译期融合不是一回事」（L194）。npugraph-ex 页不属于本轮范围，未改动。

### P2-1 强制 eager 的作用与排查结论 —— 认可，已改

核实：上游在配置阶段就把 `mode` 与 `cudagraph_mode` 一起设成 `NONE`，日志原话是等价于 `-cc.mode=none -cc.cudagraph_mode=none`（vllm `config/vllm.py` L1054–L1060）；昇腾平台随后关掉自己的编译模式（`platform.py` L527–L531），并在图档位为 `NONE` 时置假 `enable_npugraph_ex`（L593–L595）。`compile_sizes` 默认为 `None`（vllm `config/compilation.py` L565–L567），所以本部署热身循环没有尺寸可跑。

改法：正文 L172–L174 重写——写明它把编译期改写和录图一起关掉、热身这时没有尺寸可跑；排查结论改成「只能把范围缩到编译或图两层之一」，并说明只把图档位设成 `NONE` 也分不开（昇腾同时会关编译），要分层得单独关融合而保留图。「开销和什么时候别开」的排查条目（L228 一带）同步改写，「怎么开」补一段行号（L212）。「尺寸裁剪」这个没解释的词已删除。

### P2-2 p4 版两处信息丢失 + 勾选不属实 —— 认可，已改

- 分派输入与描述符：正文 L146 补上「描述符还含有没有用 LoRA（本部署不用）」和「分派时还看 LoRA 状态与有没有强制 eager」。
- 整图参数刷新路径：核实 `model_runner_v1.py` L2824–L2834 确实分两支——`enable_enpu` 为真时先刷新再执行，否则先执行再刷新。正文 L166 改成「默认（没开 ENPU）时发生在执行之后，开了 ENPU 才挪到执行之前」，不再写成无条件结论。
- 勾选：scratchpad 的 `p5/graph-mode-layer-facts.md` 追加了「09-29 第二次勾选」，逐条重记。第二次补回的还有 P1 的「提交开销占比随模型、批次、硬件而变」、P4 的「枚举名沿用 CUDA 术语、昇腾照用同一枚举」、P5 的「编译改写由编译接口里的 pass 负责」、P15 的「7 个尺寸是命令写死的，不配时程序自己算」、A14 的上游/昇腾分工、A19 的枚举顺序、A20 的 A5 再裁尺寸。确认删掉的四条也写明了理由：A21 的 `ACLGraphEntry` 字段清单（实现细节，已给源码位置）、A22 的 warmup 剔除与补区间端点（本部署 `compile_sizes` 为空，分支不生效）、A24 的 piecewise 分段各录一张（归 acl-graph）、A25 的 xlite 文件行数（行数不是机制）。A23 旧版那句「强制 eager 时 compile_sizes 的 dummy run 照跑」按上面的证据改正，不再保留。

### P3（9 条全部处理）

1. 第 2 条判据改成「排得最多的那条请求也只有 4 个 token 位」，第 3 条后补一句「第 2、3 条合起来才等于每条都是 4」（L139–L140）。
2. L146 的例子换成「同样补齐到 64 个 token 位，16 条整齐 decode 回放 64 那张图，混进 prefill 的一轮在这一档配置下没有图」。
3. 术语：Host 首次出现（L50）就地解释；Runner 首次出现（L136）写成「模型运行器（Runner，负责准备本轮张量、再调用模型的那一层）」；DP 组链接 `data-parallel.md` 并就地解释；KDA 改成「这个模型里那 34 层线性注意力」并链接 `linear-attention.md`。
4. 正文 L150 点名 ACL Graph 并链接 `acl-graph.md`。
5. calc 后补一句，说明同一笔账在部署页「启动时发生了什么」也出现过，本页不另立一套（L121 一带）。
6. 「怎么开」的默认尺寸公式不再展开（原文漏了 256 以上按 16 递增），改成只说「会按 `max_num_seqs` 与草稿数自动算出来」并链接 acl-graph（L202）。
7. 图 1 第三行标题改成「没录过这种形状（例如混进 prefill）：仍旧逐个提交」。
8. 图 2 的 pin `acl_graph.py#L216-L259` 的 symbols 由 `ACLGraphEntry` 改成 `replay`（该标识符确在区间内，符合 `diagram-symbol` 的校验方式）。
9. 见 P2-2 的勾选说明。

### 本轮验证

- `npx tsx scripts/wiki-lint.ts`：通过，本页 0 报错（全库另有 16 处提醒，与本页无关）。
- `npx tsx scripts/wiki-diagrams.ts --check`：198 张图与 spec 一致。中途另一位写手的 `pd-disaggregation.yaml` 一度有重叠导致全库渲染中断，我只用 `renderDiagram` 重生成了本页三张图的 SVG，未改动别人的 yaml；对方修好后全库 `--check` 已通过。
- `npx tsx scripts/wiki-audit.ts`：通过，本页 34 条来源行号全部有效，无无效 commit、缺文件或越界行号。
- 单页写作标准检查（`checkStandard`）：problems 为空；教学正文 3,791 词、行内代码 1.06/千词、calc 1 块、免责句 1.9%、正文角标 0、图宽合规。角标 30 处（C 级 22，占 73.3%），在 30 处与 80% 两条线内。
- 未起服务、未做浏览器实测，浏览器验收仍留给审查环节。

## P5 复审（09-29）

复审员：独立复审（只审未改页）。范围：首审 P1、两条 P2 是否改准，清单抽查，修订是否引入新问题，audit。行号均为现版文件行号（含 frontmatter）。

**复审得分：8 / 10**（首审 P1 已修好；两条 P2 已改；新增 P1 0 条、P2 1 条、P3 3 条）

### 1. 首审 P1：编译期图融合默认开没开 —— 已修好

自己在钉住版本上重核（tools/repos 下 git show）：
- vllm-ascend@db701c1f `ascend_config.py` L590：`enable_npugraph_ex` 默认 True；L40–41 从 `additional_config` 取；教程未传 `--additional-config`（wiki/sources/glm-5-3-flash-baseline.md L132）。
- `platform.py` L593–595（档位 NONE）与 L596–623（需要分段）才置假；`FULL_DECODE_ONLY` 在 vllm@0fc695fc `config/compilation.py` L62、L77–84 下 `requires_piecewise_compilation()` 为假、`has_full_cudagraphs()` 为真，命中 `platform.py` L624–627，只清空 `splitting_ops`，不动开关。
- vllm `config/vllm.py` L1122–1124（默认编译模式 VLLM_COMPILE）；`models/glm5_next.py` L2244（`@support_torch_compile`）；`platform.py` L181（AscendCompiler）；`compiler_interface.py` L283–298 走 `npugraph_ex_compile`，L211–217 导入失败才落到 torchair。
- 三个版本列的默认值也核了：2c59ff10 L609、2ed6cbba L601、baa023ad L113 均为 True，与 L245 表格一致。

页面现状：L178 标题、L180–182、L194、L210 均已改成「默认开、与回放叠加、torchair 是导入失败的退路、只有 xlite 默认关」，全文 grep 不再有「都没开」的说法。结论：P1 真正修好。

### 2. 首审两条 P2

- **P2-1 强制 eager —— 已改准。** L172、L174、L212、L229 写全了「编译 + 图两层一起关、热身无尺寸、捕获跳过」，排查结论改成「只能缩到两层之一」，并说明只把图档位设成 NONE 分不开（`platform.py` L593–595）。核对：vllm `config/vllm.py` L1054–1060；vllm-ascend `worker/worker.py` L695（`compile_sizes or []`）、L718–719（非 eager 才捕获）；vllm `compilation.py` L567（`compile_sizes` 默认 None）。「尺寸裁剪」已删。遗留一点见新增 P2-N1。
- **P2-2 两处丢信息 —— 已补回。** L146 补了描述符含 LoRA、分派还看 LoRA 状态与强制 eager；L166 改成默认（未开 ENPU）在执行之后、开了才在之前，核对 `model_runner_v1.py` L2825–2835、L497–500（ENPU 来自 C 侧 getenv）、L2784–2788（sparse/compress 条件）。写作记录勾选已重记。

### 3. 清单抽查（旧会话 scratchpad `p5/graph-mode-layer-facts.md`，用 shuf 随机抽 5 条）

| 条目 | 勾选 | 新版位置 | 结果 |
|---|---|---|---|
| A5 分段在注意力处切开、切口外照常提交 | ✓ | L109（并按 P8 改为「配置决定」） | 在 |
| A7 两个组合档、FULL_AND_PIECEWISE 为默认、decode 整齐才划算 | ✓ | L112 | 在 |
| A16 npugraph_ex / torchair 不属于图档位 | ✓ | L180–181、L194（以「两层」表述，未逐字说不属于那几档，意思在） | 在 |
| A4 eager 适合排查（并被 P9 纠正「不万能」） | ✓ | L98、L172、L229 | 在 |
| P15 捕获入口在启动预热；尺寸由配置决定 | ✓ | L116、L170、L202 | 在 |

5 条通过 5 条。

### 4. git diff（只看删改）

本文件 HEAD 与 p4-checkpoint 相同，`git diff` 反映的是整轮 P5 改写（+230 / −35），无法单独拆出本次修订那一轮（首审时的版本未提交），因此本轮修订的删改是按修订记录逐段定点读的。35 行删除里：frontmatter 的 title / summary 改写，aliases 是旧版的超集（L6）；正文删除的 p4 旧句逐条在新版找到对应（三动作表 L79–83、枚举与接入 L112/L210、分派 L136–146、包装器 L150–158、数据更新 L162–166、三层证据 L176、评估方法 L230）。未发现丢信息。

### 5. 新增问题

**P1：0 条。**

**P2-N1 把「编译期融合」等同于 npugraph_ex，「单独关融合而保留图」没有给出正确的开关。**（L180、L174、L229）
- 问题：`enable_npugraph_ex` 为假时，AscendCompiler 并不停止融合，而是改走 `fusion_pass_compile`（db701c1f `compiler_interface.py` L300–301、L47–69），照样执行昇腾自己的 pass manager；该 manager 默认挂上 norm-quant、qknorm-rope、allreduce-rmsnorm、muls-add 四个融合 pass（`graph_fusion_pass_manager.py` L49–72，均以 `.get(..., True)` 默认开）。每个 pattern 同时注册到 inductor pattern matcher 和 npugraph_ex 两边（`passes/base_pattern.py` L41–63）。所以关掉 npugraph_ex 只是换了一个编译后端，融合改写仍在。读者按 L180 的命名去关 `enable_npugraph_ex`，会误以为已排除融合层，P2-1 修好的排查结论在这一步又不成立。
- 改法：L180 改成「npugraph_ex 是这层默认的编译后端；关掉它时 AscendCompiler 仍经自己的 pass manager 做同一批融合」。L174 / L229 的「单独关融合」写清要关的是各 `fuse_*` 开关（并附上述行号），或注明「仅关 npugraph_ex 不够」；若写成把编译模式设为 none、同时保留 `FULL_DECODE_ONLY`，要标「源码上可行，未实测」。

**P3**
1. 图 1 的 row 标题已改（`graph-mode-record-replay.yaml` L8），但 caption（同文件 L3）仍写「形状不同的一轮仍旧逐个提交」，与首审 P3-7 同一问题只改了一半。
2. L146「同样补齐到 64 个 token 位」用在混进 prefill 的那一轮上不准确：`FULL_DECODE_ONLY` 下混合轮没有图，不会按图尺寸补齐。建议改成「两轮 token 总数都是 64」。
3. 清单 A22 的删除理由只对一半：`worker.py` L702–711 的「补区间端点」不依赖 `compile_sizes`，只要某个 compile range 里没有捕获尺寸就会追加一次热身，是否在本部署触发取决于 compile ranges（本轮未核）。页面 L170「按需要编译的尺寸跑几遍空批次」与 L172「没有尺寸可跑」之间因此留有一处模糊。只影响记录，不改分。

### 6. wiki:audit

`pnpm wiki:audit` 退出码 0，全库 133 页、无效 commit / 缺文件 / 越界行号均为 0。本页一行摘要为 34 条来源、11026 字 / 12 节，34 条全部 ✓；本页不在写作标准名单内，没有标准行。输出存于本会话 scratchpad `audit-gml-rereview.txt`（L810 起）。本页通过。

### 7. 跳过与限制

- 没有读 frontmatter 的 sources 区、HANDBOOK、docs/plans/。
- 「对照源码」只定点读了 L208–212、L225–231、L232–248（为核 P1 / P2 的改动与版本表），没有通读 L196–272。
- 正文只读了 L55–195，没有重审整页；首审已核过、本轮未改的段落没有重读。
- 按派发要求不起服务，没有在知识库前端打开整页，也没有重新渲染 SVG 查看；图只核了 yaml。
- 没有跑 wiki-lint 与 wiki-diagrams --check（写手记录里称已通过，本轮未复现）。

## P5 复审后修订（09-29）

按复审（8/10）修订：新增的 P2-N1 已改，3 条 P3 一并处理。没有不同意的条目。页面 10,066 → 10,657 字（去空白字符），来源 34 → 36 条。

### P2-N1 「编译期融合」不等于 npugraph_ex，关它不算关融合 —— 认可，已改

自己在钉住版本上重核，结论与复审一致：

- `AscendCompiler.compile` 在 `enable_npugraph_ex` 为真时走 `npugraph_ex_compile`，为假时走 `fusion_pass_compile`（db701c1f `compilation/compiler_interface.py` L283–L301，`else` 分支在 L300–L301）。
- `fusion_pass_compile` 取编译配置里的 pass manager 并作用到计算图上（同文件 L47–L69，`compile_inner` 里 `current_pass_manager(graph)`）。所以关掉 npugraph_ex 只是换了一个编译后端，pass 照跑。
- 该 manager 的 `configure` 默认挂四个融合 pass：`fuse_norm_quant`、`fuse_qknorm_rope`、`fuse_allreduce_rms`、`fuse_muls_add`，四个都写成 `ascend_compilation_config.get(..., True)`，默认全开（`compilation/graph_fusion_pass_manager.py` L49–L72；前后两项在 310P 上另有关闭条件）。

改法：

- 正文「旁边的另外两条路」那一条重写（L182）：标题改成「编译期融合按固定源码是开着的」，并补一句「npugraph_ex 只是这一层默认用的编译后端，不等于融合本身；把它关掉只是换一条编译路径，pass manager 照样做同一批融合（归一化与量化、qk 归一化与 RoPE、AllReduce 与 RMSNorm、乘加），这几项各有开关且默认全开」。
- 正文强制 eager 那一段的排查建议改成「要把两层分开，得逐个关掉那几个融合开关而保留图——只关 npugraph_ex 不够，只把图档位设成 NONE 也不够」（L176 一带）。「开销和什么时候别开」的同一条同步改写。
- 「怎么开」新增一段写全行号（L214），并在 sources 追加两条：`compiler_interface.py#L44-L69`、`graph_fusion_pass_manager.py#L44-L75`（新编号 C35、C36）。为守住 30 处角标上限，删掉了两处重复标记（默认优化档预设、torchair 退路），这两条的落点仍在「源码位置」表里。
- 「源码位置」表补一行「四个融合 pass 与它们的开关」，并把 `fusion_pass_compile` 加进编译后端那一行。

### P3（3 条）

1. 图 1 的 caption 同步改成「没录过的形状仍旧逐个提交」（`graph-mode-record-replay.yaml` 第 3 行），与首审 P3-7 改过的 row 标题一致；SVG 已重新生成。
2. 正文 L148 的例子改成「两轮的 token 总数同样是 64」，并补一句混合轮「也不按图尺寸补齐」。
3. A22 的删除理由按复审改正：`worker.py` L702–L711 的「补区间端点」确实不依赖 `compile_sizes`，但整段都在 `if not self.model_config.enforce_eager` 之内（L696 起），所以强制 eager 时热身列表确实为空，正常启动时热身尺寸则可能来自区间端点。正文「启动时录、运行时放」首句据此改写成「热身的尺寸来自显式指定要编译的尺寸，再加上没有被任何捕获尺寸覆盖到的编译区间端点」，与后一段「强制 eager 时没有尺寸可跑」不再模糊。scratchpad 的清单文件已追加这条补正，A22 由「删除」改记为「保留」。

### 本轮验证

- `npx tsx scripts/wiki-lint.ts`：通过，本页 0 报错（全库另有 15 处提醒，与本页无关）。
- `npx tsx scripts/wiki-diagrams.ts --check`：本轮先跑出「198 张图与 spec 一致」；随后另一位写手改了 `attention-qkv-flow.yaml`，全库 --check 报的是那一张 SVG 待重生成，本页三张图不在其中，也没有替别人重生成。
- `npx tsx scripts/wiki-audit.ts`：通过，本页 36 条来源行号全部有效，无无效 commit、缺文件或越界行号。
- 单页写作标准检查（`checkStandard`）：problems 为空；教学正文 3,899 词、行内代码 1.03/千词、calc 1 块、免责句 1.9%、正文角标 0、图宽合规；角标 30 处（C 级 22，占 73.3%）。
- 未起服务，未做浏览器实测。
