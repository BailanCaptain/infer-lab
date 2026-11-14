# 量化尾项及八条精确来源路径：独立验收

审查者：`/root/child_sources_review`。作者：root。日期：2026-11-11。本轮独立审查通过：量化新增解释在下述教学范围内承接官方材料，5 项 P2 已由作者修改并由本审查复核；未遗留 P1/P2。八条来源白名单增量也通过独立代码审查。此结论不等于全部递归外链全文已读、所有量化后端实测，亦不替代 root 的统一工程检查。

## 范围与实际阅读

先依项目要求完整阅读 wiki 写作标准；已有 3D 的回归前完整阅读教学 3D 标准。两份教学页 `quantization-methods.md`、`quantization.md` 全文、改前归档与实际 diff 均已读。量化作者记录 `read-progress-20261111.md` 已读，用来区分作者阅读与独立阅读，不将作者记录冒充本审查的全文阅读。

逐项阅读新增来源 16–54 的 39 个固定范围，核对原始 Git blob / 固定 GitHub 原文 SHA 与摘录 SHA、行界和实际正文承接。31 与 30、48 与 47 的正文分别逐字节相同，按同内容复用阅读；仍分别核对来源身份。额外读取 W4A8 第 75–78 行与 FP8 apply 第 181–190 行，要求作者将证据范围扩大至完整支持相应句子。另读 baseline→v0.26 online/base 的 47 行完整差异，直接比较 rc2/main 配置与 online/base、v0.26/rc2/main GGUF 文档原始 blob，均与正文限定的同文范围一致。

新来源承接关系已核实：

- 16–20、36、53：制作量化包、加载时转换与运行时动态激活分别发生何时；FP8_DYNAMIC 的 RTN 无校准与 W8A8 SmoothQuant/GPTQ 有校准不混同。LLM-Compressor 流程图实际打开查看，图中模型/数据/算法→压缩产物→vLLM 与应用另行提供请求的关系，支持机制说明而不构成硬件性能实证。
- 21–27、37–39、44–46、51–52：算法、工具、格式和运行实现分层；AutoAWQ 弃用与 AWQ 方法支持分开；AutoRound scheme/format、GPTQModel 模块覆盖与融合边界、TorchAO 序列化和设备布局、BnB 预量化 TP 限制均保持固定来源的适用范围。
- 28–35、49–50、54：旧配置覆盖整份 linear/moe 规格，纯 online 的 weight/activation 消费限制，以及 rc2 targets/组合边界。字段存在不等于任意组合有算子；方法识别、平台与 dtype 校验在加载链上分别发生。Ascend 同名注册可以覆盖上游类，不据相同名称断言执行同一在线转换。
- 40–43：旧内置 GGUF 的单文件限制，后续独立插件注册量化/加载器/配置解析器的关系，tokenizer/hf-config-path 的作用及 CUDA/ROCm 前提。旧限制不直接套用新插件，更不推广到 NPU。
- 47–48：Ascend rc2/main 的 ModelOpt MXFP8 两名注册与本地 Linear/MoE 方法选择；只支持所列类和范围的结论。

没有将 Quark 所有子页、AutoRound 全本高级配方、GPTQModel 全本新闻或后端矩阵列为本审查全文阅读；本审查只接受已读固定范围支撑当前教学结论。全局新增全文阅读计数为 0。

## 五项 P2 及关闭证据

| 问题 | 作者修订与独立复核 |
|---|---|
| 通用三节位于 GLM 落地段之后，破坏通用→具体顺序 | 三节移至 GLM 前；与改前归档提取比较，GLM 整段原文完全相同 |
| W4A8 来源范围漏了 Arm/KleidiAI 第 75 行 | 来源 19 改为 L75–L173；重新读取、原文/摘录 SHA 校验通过 |
| FP8 来源范围止于 fallback 中途，未含普通消费者 | 来源 36 改为 L58–L190；正常 `apply_weights` 返回分支已读且入引文 |
| AutoAWQ 工具表没有交代指南弃用条件 | 补充转向 LLM-Compressor，并区分工具库与 AWQ 方法；与来源 21 相符 |
| GGUF 版本说明漏旧路径单文件条件 | 明确 v0.23 内置路径只接受单文件、多分片先合并，并明确不套给新插件；与来源 40 相符 |

所有修订后的最终 diff 已读。没有为解决这些问题删除既有解释、旧来源或图。

## 保留、算例和浏览器

独立运行 `python -X utf8 .tmp/continuation-groups-2026-11-10/quant-tail/independent-verify.py`：39 个固定范围的原文/摘录 SHA 全部一致；原有 70 条 sources 均为逐项相同前缀；12 个静态图文件（6 YAML、6 SVG）与改前 zip 逐字节一致。GLM 段原文保留另由 `independent-aux.py` 验证。数值复算：256 项 INT4 载荷 128 B，加分组系数后 132/144 B，后者每权重 4.5 bit；等价缩放前后点积均为 3；INT8 点积 10438，乘系数得到 2.0876，与原数 2.0888 相差 0.0012。所有示意仍明确是教学数据。

独立运行 `independent-browser.mjs`，浏览器 1440×1100，实际打开两页前两屏、7 个目标章节、13 个 figure、11 个 table，并点击三条跨页链接等待目标标题。两页哈希稳定，0 pageerror，0 页面横向溢出；38 张截图均实际打开查看。首次普通 figure 截图中的 3D 尚处懒加载，因此不将该张当作 3D 通过证据；另运行 `independent-scene.mjs` 等待 ready 后，以 2× 实际连续播放至 63 秒终点，查看 6 个播放阶段截图和放大状态，确认 10438、2.0876、0.0012 与正文一致，放大/退出正常。此为未修改旧场景的播放回归，不虚称本轮重做了 3D。

前两屏复述：方法页先区分权重/激活/KV 的量化对象，再解释误差与分组；W8A8 页先用四个数解释 scale、舍入、截断，再说明省存储和访问的原因。新增段落把工具的产物接回加载器与后端条件，不将上游 GPU/CPU 示例当作 NPU 启动教程。维护记录留在此审查档案，没有放入教学正文。

独立运行 `pnpm exec tsx .../quant-tail/independent-measure.ts`（完整命令在 summary）：教学字数 4548/5823，行内代码每千字 3.078/1.030，正文角标均 0，calc 每千字 0.440/0.687，免责词比例 2.400%/1.274%；无堆叠块，首图在正文第 6/10 行，图前 calc 为 0。未加载图资源的 measureStandard 不用作图宽结论；图宽和布局以上述实际查看为依据。

## 八条来源白名单代码独审

仅此代码部分按 AGENTS 使用 Ponytail full 与 i-have-adhd，纯教学审查不套用代码技能。比较接受过的 io131 检查点 zip，验证其中三文件 SHA 为 before；读取实际 diff、`sources.ts` 全文、新旧相邻测试和分类消费者。增量只包含 8 条固定 commit + 精确文件路径、8 个对应参数化测试数据行及 HANDBOOK 对照行，没有改分类器算法。

四条 XGrammar 文件固定在 `5433fd...`（tokenizer_info.py、tokenizer_info.cc、tokenizer_info_impl.h、grammar_matcher.cc）；ArcticInference 两条固定在 `3145f23...`（cache.py、suffix_tree.cc）；AutoRound step_by_step 固定在 `a85997e...`；GPTQModel README 固定在 `be3852b...`。全部为 ecosystem，不提升为官方引证。精确 host/path 匹配保持原逻辑，主分支、同仓其他文件、子路径、.bak 后缀、伪造域名继续拒绝。

本审查实际运行 `pnpm exec vitest run scripts/wiki/sources.test.ts`：65/65 通过，exit 0；`pnpm exec biome check scripts/wiki/sources.ts scripts/wiki/sources.test.ts`：2 files，no fixes，exit 0。另读作者两轮 red 日志，各 4 个新路径在增量前分类失败；作者 120/124 的组合绿灯为作者证据，不冒充本审查执行。无未解决 P1/P2，无本审查代码修改。

## 冻结与剩余职责

最终教学页 SHA：methods `f9f9567dbecbaca3875afefd38e5168dbccdbb5849c1c4c6fcee7eac856d7696`；quantization `6947ffc3cd2b28da5100b7ce4ab573c2a045b67fc4960d92a0f5eab15bbe0b51`。来源和三代码文件的 before/after SHA、截图文件 SHA、复算与验证命令见同名 summary JSON 及其引用的原始证据。

未执行量化制作或 NPU/GPU 模型推理，没有质量/速度/显存实测结论。全站工程检查、最终归档、台账与来源状态更新由 root 负责；本审查不改总账，也不宣称这些统一工作已经完成。无需用户决策的未决项：无。
