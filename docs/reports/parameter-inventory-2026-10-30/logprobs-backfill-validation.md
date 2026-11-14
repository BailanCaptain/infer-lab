# B8 概率记录补写验证

2026-11-01，B8 **7/7 单元已补写并验收通过**，完成独立审查和检索验证，无未关闭 P1/P2。本轮没有新增参数页：生成记录归 sampling，提示词记录归 prefill，prefix-caching 只补语义回链。按已有教学例子展开，不重复 softmax、罚分、停止条件与缓存机制。

基线为 vLLM 0fc695fc / GLM Ascend db701c1f；对照 rc 568afb3a / 2ed6cbba、固定 main 84030bbe / baa023ad，另核 Ascend 社区维护 2c59ff10。固定源码不证明现场镜像的安装内容。本轮没有运行完整 vLLM 服务、GLM tokenizer 或 NPU 推理测试。

## 单元与唯一归属

| 单元 | 参数 | 主页面与补齐内容 |
|---|---|---|
| W0480 | flat_logprobs | sampling：Python 默认 false、容器字段与位置区间、重复编号、首提示词空区间、HTTP 未暴露 |
| W0489 | logprob_token_ids | sampling：指定取值与生成白名单区别、128 上限、ID 范围、Python 数量校验、HTTP 新版转换、rank 与 MTP 边界 |
| W0490 | logprobs | sampling：Python/Chat/Completion 类型差异，None/false/0/正数/−1，已选 token 与候选、返回结构 |
| W0505 | prompt_logprobs | prefill：hᵢ 评 xᵢ₊₁、首项无评分、额外投影、APC 默认派生、分块聚合、echo/stream、HTTP 层级与三版模式 |
| W0544 | top_logprobs | sampling：Chat 默认 0、依赖 logprobs=true、null 与 −1、候选数量与生成条数区别 |
| W1607 | logprobs_mode | sampling：服务四模式、原始边界、greedy/MTP 分支、HTTP 夹断；提示词特殊处理回链 prefill |
| W1621 | max_logprobs | sampling：服务默认 20、0/−1、请求仍需启用、同时限制提示词、指定编号独立校验、新版下界检查 |

七个单元含 Python 与 HTTP 示例，沿用六词分布新增一块 ln/exp 演算；提示词评分沿用 x₀…x₃ 表解释错位，没有另造词表算例。

## 独立审查与修订

[独立报告](logprobs-independent-review.md)由本轮独立代理 logprobs_independent_review 编写，实读标准、原页面、两页全文、三页 before→after、四张图及固定源码，独立执行真实源码 AST 函数 fixture **203 条断言**。外围模型配置与张量调用使用受控桩，属于函数级语义检查，不是 Pydantic 全栈、设备算子或双机集成验收。

关键修订与边界：

- 基线/rc Completion 拒绝 logprobs=−1；main 协议放行，但返回器候选字典仍为空，不能宣称完整词表导出可用。
- 指定编号在基线仅 Python 有。rc/main HTTP 的非空列表优先，会将传入引擎的 logprobs 置 None；Python 显式两项数量相等的规则不能套到 HTTP。
- 指定列表的 rank 是枚举填值，重复编号合并还能覆盖已选项，不能当真实全词表排名。
- 固定 Ascend MTP 的指定编号未完整贯通；处理后模式的额外 token 有模式覆盖传递边界。默认原始口径与设备实测分开说明。
- 基线提示词始终按原始对数概率算；rc/main 的 logits 两模式取原始分数，也不加生成端罚分、温度和截断。
- 提示词 HTTP 层级分别是 Chat 响应顶层、Completion choice 内；显式 stream+0 通过字段校验不代表 SSE 有独立提示词字段。echo 派生和缓存显式覆盖单列解释。
- prefill-flow 只改 caption 与⑤的生成行限定，880×972 布局不变；已有 penalty 表的长首列标签缩短，完整类名移至相邻正文，事实不删。

首轮自动审计触发 sampling 的免责词命中率 3.5%；其中新增“可能”用于概率含义，已改为直接的条件概率表述，并把扁平重复项改成明确成立条件。MTP、HTTP、缓存和版本限制全部保留，复审 104/104 通过。

## 实际验证

| 检查 | 本轮结果 |
|---|---|
| wiki:build / check:content | 167 页索引与正文完整，11 个主主题无重复 |
| wiki:lint | 通过；8 条其他页面的非阻塞提醒 |
| wiki:diagrams / --check | 331 张图一致，只更新 prefill-flow.svg |
| wiki:audit | 104/104 强制页面通过；4892 条来源，4627 条行号有效，无无效 commit、缺文件或越界 |
| tsc -b / vite build | 类型检查与独立预览构建通过；最终构建 45.57 s |
| 独立源码 fixture | 203/203 断言通过 |
| CLI 检索 | 15/15 首位命中主页面；独立另核七个规范名称，均 exact 首位 |
| 真实站内检索 | 17/17 可检索并点击进入主页面，含两个完整 -- 开关名 |
| 跨页链接 | 4 条实际点击落点正确：采样→prefill 版本、prefill→缓存、缓存→提示词评分、提示词→对数演算 |
| 浏览器阅读 | 25 张过程/验收截图覆盖两页首屏、图、算例、参数/版本表、JSON/Python、边界与回链；最终 sampling 17 表及 prefill 8 表均无超宽 |
| git diff --check | 本轮页面、图、报告无空白错误 |

UI 首次用完整 --logprobs-mode 搜不到，补两个完整 CLI aliases 后重新构建，最终两项均成功；没有修改检索产品代码。CLI 仍用不带前导 -- 的拼写，因为现有解析器会把前导 -- 当选项。审计自身不联网验证 265 条 URL，1601 条 raw 引用内容仍属全库待核；本轮事实另据官方固定源码下载和独立核读，不把全库结构通过说成全库语义认证。检索验证覆盖入口与可达性，没有做生成式问答质量评测。

版本表 21 是第一次标签修订后仍有 973 px 溢出的过程截图，不用作关闭证据；最终 22 截图与 layout-widths.json 记录修正后表格不超过 961 px，sampling 各表所在容器 scrollWidth=clientWidth。长类名和对象名移入正文/值列，语义保留。独立审查者实看全部最终截图及量测后封审通过。

## 保留性与密度

证据目录为 `tools/wiki-runtime/logprobs-20261101/`。保留清单、before 快照、metrics、独立 preservation-check、源码下载、fixture、命令日志、DOM、搜索/链接/表宽 JSON 与截图均可复查。原 sampling 143 条、prefill 29 条 sources 顺序不变，分别追加到 175、48；全部旧别名和机器尾注逐字保留。原六块与五块 calc 均逐字保留，sampling 只新增一块对数换算。原部署数字、penalty/停止推导、场景 M、两页性能与 MTP 待核保留。

密度口径为排除 frontmatter 和围栏后计 U+4E00–U+9FFF 汉字；教学区以“对照源码”为界。sampling 教学行内代码 10、证据角标 0，全文行内代码约 5.1/千汉，角标 26（C 类 19）；prefill 教学行内代码与角标均为 0，全文约 5.0/千汉，角标 30（C 类 22）。所有旧来源标号保持对应，未为比例添加虚假来源。

prefix-caching 只给原有一句加条件与回链，其旧全文行内代码 61 处未扩张，按纯汉字口径约 15.4/千汉，是既有密度；教学区仍为 0。项目审计采用汉字加拉丁单词的另一口径并已通过，不把两种口径混称为全部低于 13。三页源码区 H3 顺序不变，首图前均无 calc。

## 取舍与后续

这是知识库参考补齐：未修上游 MTP、Completion 导出或 HTTP 协议，也未测设备性能。用明确的版本/路径限制保留可用范围；原有未测事项继续留在各页。

B8 验收后累计为 A 批 11 加 B 批 71，共 **82 个单元**，B 批 **71/89**；下一批是 B9 Ascend 融合与布局 **5 个单元**。待用户决定事项：无。
