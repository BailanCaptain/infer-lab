# 量化工具、加载时转换与产物承接：作者检查

本组针对 99 项目录的 54–56、58–67、69–70，新增 39 个来源出现项。目标是解释官方量化入口之间的关系，不把量化库的全部功能、全部模型和设备组合纳入一个无边界的兼容承诺。本记录为作者交付；独立审查、全站检查、总账关闭另行登记。

## 教学成果与保留

- quantization-methods 增加“部署前制作包 → 引擎加载/转换 → 每次前向”的三个环节；以无需校准的 FP8_DYNAMIC RTN 和使用样本的 SmoothQuant+GPTQ W8A8 配方作对照。
- 对照 LLM-Compressor、AutoAWQ/GPTQModel、AutoRound、ModelOpt、Quark、TorchAO、bitsandbytes 的工具角色、导出信息和实际消费者。明确 GPTQ 算法可生成 compressed-tensors 产物、AutoAWQ 格式不等于运行 AWQ、GPTQModel 的 dynamic 模块配置不等于激活动态量化。
- 补 GGUF 的 tokenizer/config 与内置路径迁至插件的版本条件，接到插件主解释。补 online 的 CLI/Python 片段、默认值、整份规格覆盖、未设 weight 与不支持 activation 组合的真实消费者，以及 rc2 targets/组合路径。Ascend 同名 MXFP8 注册单独说明。
- quantization 只增加到上述主解释的回链；已有零点、舍入、点积、GLM 逐层精度与容量账保留。两页原 70 个 sources 前缀逐项保持，六张静态图的 YAML/SVG 共 12 文件逐字节相同。无 3D 文件修改。

改前归档 `.tmp/continuation-groups-2026-11-10/quant-tail/author-before/before.zip`，SHA256 `fb5c06a825f3bc6e472113c060c9dade05b0d242ba0567954e1453aab8060458`。逐页前后哈希、差异和来源保留结果见 `quant-methods-author-preservation.json` 及 quant-tail 两份 diff。每个新来源的完整身份、范围、摘录摘要与作者主张见 `quant-methods-additions.json`。

## 阅读范围

详细实际范围在 `.tmp/continuation-groups-2026-11-10/quant-tail/read-progress-20261111.md`，固定原文与下载清单在 quant-tail。39 条引用均验证了固定文件字节及行号，随后要由新审查者判断是否支持当前主张；这一步不靠行号存在代替语义。

除既有母文外，实际跟进了 online 配置、配置识别、层方法、FP8 转换、BnB 预量化 TP 限制、TorchAO 重载、ModelOpt/Quark 元数据消费；四版同文和完整非空差异复用按明确范围记录。外部跟进包括 LLMCompressor 主流程及图、AWQ/GPTQ 示例、GGUF 插件入口/注册，Quark 五份说明与完整模型支持表，以及 AutoRound/GPTQModel/TorchAO 与当前教学主张相关的小节。没有把下载的长 README 全文、链接目录、模型权重或全部库 API 当成已读。Quark live 页保留时间/内容摘要，不将其较新 API 和旧 vLLM 母文拼成一条可运行命令。

本组新增全站全文计数保持 0，待总账按内容摘要去重。不是阅读了 39 篇完整材料。

## 作者验证

- `python -X utf8 .tmp/continuation-groups-2026-11-10/quant-author-evidence.py`：39 个新增引用范围合法，70 个旧来源与 12 份静态图文件保留。
- `pnpm check:content`：registry 164 页通过。单页标准脚本两页均无问题：方法页教学正文约 4473 字、行内代码 3.13/千字、正文角标 0、calc 2、免责比例约 2.44%；量化页约 5823 字、1.03/千字、正文角标 0、calc 4、免责比例约 1.27%。该字数是标准工具对教学正文的口径，非含 frontmatter/源码区全文字符数。最新测量 JSON 保存在 author-standard.json。
- 浏览器脚本 `quant-author-browser.mjs` 实际打开两页前两屏、补充段落、图与表，实际点击插件入口、Ascend 量化入口、量化环节回链。成功一轮报告 errors=[]、两页无整页横向溢出、所有表容器不溢出；新三列工具表和四版表已实际看图，无文字截断。之前两次动态 import/旧 workflow 锁导致的失败另保留，不作为成功证据。最后元数据与 online 消费者措辞微调后再次运行，报告以最后保存的哈希为准。
- 已实际查看方法页两张静态图、两块 calc、四张表与新增段落；量化页静态图、四块数值账及回链显示。256 项分组账为 128/132/144 B、平均 4.5 bit，缩放前后点积均 3；原 INT8 点积显示 10438、还原 2.0876、原数 2.0888，未被本组改写。
- 量化页原有交互 3D 的自动截图停在“正在准备”状态；该截图不算播放验收。本组未改它，3D 实际播放属于后续全站路径验收，须依 3D 标准单列，不能用静态截图冒充。

## 配套代码与待完成项

来源白名单按精确固定文件补 Arctic 两份、AutoRound/GPTQModel 两份；后因结构化输出增量补同版 XGrammar 四份。未放宽目录、分支、其他提交或伪装域名。每轮先用失败测试确认缺项，再修改规则和 HANDBOOK：第一轮 4 失败/57 通过 → 120 通过，第二轮 4 失败/61 通过 → 124 通过，Biome 两文件通过。测试进程退出码 0，但有两个 Vite server 的 10 秒关闭超时诊断，不能表述成没有任何运行提示。代码独审与全站五项检查仍待统一。

没有 NPU/GPU、量化工具执行、精度或性能实测；无新 verified 标记。本组内容等待新独立审查者处理 P1/P2 后再验收入账。
