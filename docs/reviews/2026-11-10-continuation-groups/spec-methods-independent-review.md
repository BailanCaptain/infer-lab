# Speculative decoding 方法补充：独立复核

复核者：`spec_final_review`，与作者 `groups_replay_review` 分离。结论：本页本批 115 条新增引文在下述范围内可验收；发现的 4 类 P2 已修正并复核，无未解决 P1/P2。全站五项工程检查、来源白名单和母账关账由根助手统一完成，本记录不替代它们。

最终页面：`wiki/concepts/speculative-decoding.md`，SHA-256 `71b3c8c8f496078aaefdd0b7708fe921295b519059aca60ceeae8351e2f40a8b`。作者交接 SHA 为 `a920e960e2933bbed53f72fe0d8ef08d11c6aa388f35c5684db9379d0004888b`。修前原始字节保存在 `.tmp/continuation-groups-2026-11-10/spec-independent/before-review-fixes.md`，全部独审改动见同目录 `review-fixes.diff`。

## 实际复核范围

已读项目写作标准、知识库指南、当前教学正文、作者差异及保留清单。新增源码/官方指南的 111 个引文范围全部独立从 Git 固定提交或 Arctic 固定 raw URL 取得，核对文件及截取范围 SHA；共 99 个不同范围，未以作者的 supported 标签代替阅读。大部分逐段实际阅读；153/154 与 152、159 与 158 使用独立验证的相同字节复用，158 则逐项读完整函数相对已读 146 的差异。既有来源 64 的 rc2 草稿工厂另实际重读。逐条判定、引用地址、范围、身份和边界在 [115 项独立判定](spec-methods-independent-judgments.json)。本轮不声称重新逐条裁定旧 67 项，也不增加全文总计。

四篇论文均在线重新取得固定版本 HTML，SHA 与作者快照完全相同。独立复核的是页内结论所需方法章节与技术图：EAGLE §3.1–3.3 / Fig6，IBM MLP §3.1 / Fig1，Suffix §3 / Fig1，PARD §3.1–3.2 / timeline 与训练图。不是把作者全文阅读数再记一次，也没有扩大到论文参考文献全生态。在线身份记录见 `paper-identity.json`，逐项范围见判定 175–178。

Arctic 0.1.1 发布包另外按本轮 PyPI JSON 校验 sdist SHA，再从归档读取两文件，与已经独立下载的固定 GitHub 文件逐字节比较一致。记录为 `arctic-release-independent.json`。须精确登记的只有两个文件 URL：

- `https://github.com/snowflakedb/ArcticInference/blob/3145f23e4c54465f1f19c4592e6713f905ab29f1/arctic_inference/suffix_decoding/cache.py`
- `https://github.com/snowflakedb/ArcticInference/blob/3145f23e4c54465f1f19c4592e6713f905ab29f1/csrc/suffix_decoding/suffix_tree.cc`

后者有两个引文行段，总共 3 条引文；不据此放开整个域名。

## 问题、修正和复核

1. **P2：Suffix 版本校验说错。** 原文声称要求 `arctic-inference>=0.1.1`；固定 `_validate_suffix_decoding` 在缺依赖时提示安装 `==0.1.1`，调用的 `has_arctic_inference()` 仅探测模块。现明确区分安装提示与版本下限校验，不把所有更新版本视为已核。依据为新增来源 83/86/92/95 及独立补读 `vllm@0fc695fc:vllm/utils/import_utils.py` 的对应函数。
2. **P2：常见误解与新 block 反例冲突。** 原句仅把 entropy verify 列为改变分布的选项。现在同时说明 block / entropy 的接受规则边界；反例又明确 entropy 和 synthetic 模式均关闭，greedy 返回陈述也限定普通非 synthetic 路径。四版中 synthetic+block 的较早报错与该反例不冲突。
3. **P2：源码区层级不合标准。** 三个额外 H3 改为所属标准小节内的加粗引导语，正文和表格全部保留。最终源码区 H3 精确为“怎么开、会报什么错、开销和什么时候别开、版本差异、源码位置”。
4. **P2：旧算例浏览器显示错误。** `45（主干）+3×1…=48` 被 calc 渲染为右侧结果 **45**，其后公式落入注释。仅把公式改成 `45 + 3 × 1 = 48 层`，原解释独立放注释行。实际重开后右侧显示 **48 层**，原教学信息保留；未改渲染器。

本次没有为局部 rc2 新增事实扩大整页 `verified` 标签；页面已明确区分四个上游比较点及 Ascend 实际执行侧，不能把字段支持当作设备验证。

## 原函数与调用链

**block verify。** 独立核对复现用 7 个固定文件与 `git show` 字节一致，读过脚本后重跑原函数。完整 `rejection_sample → sample_recovered_tokens → 普通/整块接受` 的 CPU 回退路径在 reduce 开、关两种情况下，固定随机数 `[0.8,0.1,0.9]` 均给出普通路径 `B`、block 路径 `AAA+bonus`。65,536 次真实随机数试验首 A 比例分别为 `0.4991302490234375` 与 `0.762542724609375`。解析下界 `0.5+0.25 ln2=0.6732867951` 已足以反驳首词目标概率 0.5；恢复分布只剩 B，不能抵消。另四个 Ascend 钉点的原 block 函数也实际运行相同确定性反例。

复现只将 CPU allocator 的 `pin_memory=True` 调成 False，函数体未改，`HAS_TRITON=False`。Triton 原函数也实际阅读；其一般情况下的乘积截断次序与 PyTorch 不完全相同，不能称任意输入等价。但本例 q=1、p=0.5，两个公式的差别不影响反例。四版的完整 dispatch、恢复调用、greedy/synthetic/entropy 边界已读或相同函数字节复用；未执行 Triton、NPU 或真实模型服务。记录为 `reproduction-input-identity.json` 和 `block-cpu-result.json`。CPU torch 有缺 NumPy 警告，不影响本脚本纯 Tensor 路径，断言全部通过。

**统计。** 已沿 CLI → ObservabilityConfig → 调度器计数 → EngineCoreOutput → 输出处理器 → Chat/Completions 非流式和流式消费者核对，特别检查 n=1、单 prompt、最终 usage 的请求/服务端门控。旧两版 `git grep` 不含请求级开关。原 `RequestSpecDecodeMetrics` 类独立执行两轮 K=3、接受 0/2，得到平均接受长度 2、接受率 1/3、直方图 `[1,0,1,0]`，与正文一致。调度器在停止截断前计数，因此不等于客户端字数或流块 token 数。

**方法与状态。** 实际核对了 ngram 当前序列/窗口缺省、Suffix 两棵树及单路径调用、并行草稿 mask 和早返回、MLP 缺失工厂/注册、hidden-state 缓存与文件锁、Speculators 版本合并、异词表上游映射与 Ascend 构造差异；没有由字段存在推断 NPU 支持。KDA 已贯通有效输出计数含补抽/bonus、align 搬移并重置 a=1、元数据索引、算子调用及内核 a−1 选槽。

## 保留与浏览器验收

独立比较旧页和当前页：所有原 Markdown 链接目的地保留；2 套 YAML/SVG 图均逐字节未变；旧 5 个 calc 中 4 个原文未变，另 1 个只修正上述显示错误；新增 1 个统计 calc。猫/坐/在/床、p/q 三词概率、位置 9→8 回退、条件接受率与 1.3 倍耗时、GLM 45+3=48、32×4=128、12 KV 层与 34 KDA 等解释和算例均保留。记录为 `preservation.json`。

在 `http://127.0.0.1:5201/#/wiki/speculative-decoding` 实际打开并查看前两屏、方法/采集/统计段、4 张新增或更新表格、2 张图和 6 个 calc。实际点击“接受率口径”、Batch invariance、GLM MTP 层链接，目标标题/锚点正确。最终浏览器报告前后 SHA 与交付页一致，pageerror=0，无整页横溢出，检查的表格单元格溢出=0。图的箭头、错开一格的比较、被拒位置、流程站号与正文一致；修后的 48 层实际截图已看。记录和截图在 `.tmp/continuation-groups-2026-11-10/spec-independent/browser/`。

首次两次打开因共享开发服务动态导入 500 失败，未作为通过；根助手处理失效 workflow lock 后重试成功，最终报告为成功重跑。`pnpm check:content` 实际返回 0：registry 164 页、11 个主题、正文完整无重复。全站 lint/build/测试等由根助手最终运行。

保留的限制是实际设备上的模型精度、吞吐、接受率/耗时，以及 v0.26 草稿滑窗影响，正文仍明确没有这些实测。无需要用户决定的问题。
