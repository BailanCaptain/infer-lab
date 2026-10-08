# Q/K Norm 与固定版本问答验收（2026-10-07）

本记录承接 [课程入口对账](wiki-terms-gap-audit.md) 与 [P6](2026-10-05-p6-acceptance.md)，范围是补齐最后一个课程入口、修复真实问答暴露的问题，并完成这组固定知识快照的问答检查。它不代表真实多 ref 导入、参数 suspect 或 GitHub 排错全部验收。

## 教学内容与来源

`wiki/concepts/mlp-residual-norm.md` 新增「Q/K Norm：先按头归一化，再加入位置」，解释逐 token、逐头的范围、与 pre-norm 的区别、Q/K 增益各自跨头共享、投影后及 RoPE 前的顺序，并明确 V 不参与这一步。沿用 [3,4] 和 [6,8] 算例，区别均方根为 1 与向量长度为 1。新增课程别名后，入口为 **30/30**；没有把普通 RMSNorm 的旧讲解冒充 Q/K Norm。

新增来源为 Transformers v4.51.3 对应提交 `5f4ecf2d9f867a1255131d2461d75793c0cf1db2` 的 `src/transformers/models/qwen3/modeling_qwen3.py#L62-L222`。已通过 GitHub 提交/Contents API 读取原文；blob 为 `5fec83d47888e44a0f3e0ffb2b067ce08e4712d3`。Qwen3 结论不外推到固定 GLM 部署。来源识别只放行 `github.com/huggingface/transformers/blob/` 为生态原始实现，不升级成昇腾官方支持证据；域名仿冒、fork、issue 与 PR 的负例保留。

独立审查者 `/root/qknorm_review` 已阅读标准、完整正文、改前版本、源码与 diff，查看前两屏及已有图，并实际操作新章节和 Attention/RoPE 链接。没有 P1/P2；一处 P3「下方版本对照」改成明确指向「版本差异」小节后复核关闭。原有残差、两种归一化、MLP、GLM 数字、版本边界、待核事项、误解、图和来源保留；新增 Qwen3 内容没有替换 GLM 结论。

写作自查：源码区以前 6,144 计数字/词，行内代码 1、每千字 0.163；calc 3、每千字 0.488；正文证据角标 0；首图位置、源码 H3 顺序、连续块检查通过。全页证据标记 30。页面保留原有图，没有为了增加入口另造重复图。

## 问答链路修正

1. 带章节片段的相对链接及 `#/wiki/...#章节` 现在共用页面归属检查。不存在的页面、无效来源编号和代码示例仍不被认可；相关阅读、独立审阅和保存回执也使用相同匹配。
2. 问句中的完整英文术语按词边界参与标题匹配，避免明确询问 MLP 时被泛泛提到模型或版本的页面挤出。仍使用唯一 `retrieve()`，未增加另一套聊天检索。
3. 作答的完整页面窗口由 80,000 调整为 128,000 字符：真实 TP/通信/MLP 三页合计已超过旧窗口。独立审阅优先读引用页完整正文，共用 128,000 字符上限，最多 10 页，超限明确标注截断。结构化调用仅此处显式申请 160,000 字符输入上限，其他判定仍为 40,000。
4. 引文仅归一化 CRLF/LF 换行；页面归属、原文字符、数字和空白仍校验。真实三版表格引文曾因换行误报，故障用例先失败，再验证相同文字可通过、数字变化仍拒绝。
5. Windows 上一次 `rename` 返回 EPERM 导致审阅回执无法写入。原子写入现在对 EPERM/EACCES/EBUSY 最多尝试 5 次，累计等待 200ms；不删除旧文件，持续失败仍抛错，临时文件清理。故障注入验证暂时占用可恢复、永久失败保留旧数据、其他错误不重试。

尝试过按问题/回答选择短摘录，但真实 GLM 例仍缺少关键维度和顺序，未将 `undetermined` 算作通过。最终删除该摘录算法，采用完整引用页。代价是独立审阅会读取更多 token；容量仍有限，不能据此宣称检查了全库或外部原文。

## 真实评测契约与历史结果

冻结知识库 revision：`b8f96d1b2a162dcc3778fb9d0be15e12acfe31199bde08723989a7343457b623`。每题使用全新 HTTP 会话与真实 `handleChat`，全局选择 Codex / `gpt-6.1-sol`；预期答案先写入 manifest，只供宿主核对，不发送模型。问答、评判、账本都在隔离副本中，正式聊天和缺口不写入。记录请求模型和 token，不声称 CLI 返回了实际服务模型或美元价格。

| 用例 | 预先规定的事实检查点 |
|---|---|
| qknorm-heads | 各头独立；Q/K 两组共享增益共 256；RoPE 前；V 不参与 |
| qknorm-holdout | 两个未在教学页出现的输入 [5,12]、[10,24] 均约为 [0.544,1.305]；长度 √2 |
| three-pinned-versions | `2c59ff10`、`2ed6cbba` 无 GLM 模型文件；`baa023ad` 有 Glm5NextMLP；不推断今天远端最新版 |
| activation-version-boundary | `db701c1f` 不检查 hidden_act，仍用 SiLU；`baa023ad` 拒绝 relu；该 main 的序列并行路径不切 MLP 权重且末尾无 All-Reduce |
| model-boundary | Qwen3 逐头机制不能套用 GLM 的 1536/512 低秩 RMSNorm；区分 KDA；固定 GLM 不做 RoPE |
| hardware-no-evidence | 明确缺固定 GLM 双机 Sleep Mode 真实释放量及唤醒延迟，不拿示意或其他设备填空 |

前两版不存在 GLM 文件已用本地 `git ls-tree` 核对；两个后续提交的 MLP 构造与 forward 已用 `git show` 核对。不是仅依赖评判模型的打分。

原始失败记录全部保留于 `tools/wiki-runtime/`：

- `multiversion-20261006/`：章节引用误报；两个版本题漏材料；三例独立判定未定。
- `multiversion-20261006-after/`：六个回答符合宿主事实检查点；独立评判 5 covered、1 undetermined，最后一例不能算自动通过。
- `multiversion-20261006-final/`：首例完成，第二例回答完成但审阅受额度影响，后四例明确报额度不足；不计成功。
- `multiversion-20261007-resume/`：五例续跑，三例 covered；激活版本题回执遇到 EPERM，模型边界题仍因摘录缺证据而未定。
- `multiversion-20261007-whole/`：完整页面方案六例新会话，5 covered；三版本例仅因 CRLF/LF 引文校验失败，原始回执保留。
- `multiversion-20261007-crlf/`：换行修正后，三版本例新会话真实复测 covered，仍返回表格引文；不是把历史失败记录改写为通过。

最终六类均有真实作答、独立评判 covered、有效页面引用和 answerId，全部没有外部工具调用或模型切换。宿主逐题复核了上表的事实检查点。最终索引为 `tools/wiki-runtime/qknorm-final-case-index.json`，绑定来源目录、sessionId、revision 和判定 jobId；结果是修复后分轮闭合的六类样本，不是首轮成功率，也不代表全库准确率。

## 验证

源分类红绿记录：`qknorm-source-red.log`、`qknorm-source-green.log`（66 项通过）。引用/上下文复现记录：`qknorm-context-red.log`（6 项失败）及后续 green；完整引用页、持久化保护及结构化判定局部回归 `qknorm-whole-pages-green.log`（36 项通过）。临时摘录策略的失败日志不删除。

10-06 修复版本的 `qknorm-verified-check.log` 为 130 文件、1,066 测试通过，构建通过；这是完整页面/文件占用修正前的基线。`qknorm-e2e.log` 为 15/15 浏览器回归通过。

实际 5193 网页已重启服务并复验：课程缺入口 0/30，待处理缺口 1、已关闭历史 2；点击 qk-norm 进入 MLP，章节锚点准确落位；重放真实 HTTP 回答后没有无引用误报，引用链接可点击进入对应章节。重放用于浏览器渲染验证，不冒充新的真实模型调用。日志 `qknorm-final-browser.log`，截图 `qknorm-status.png`、`qknorm-section.png`、`qknorm-answer-anchor.png`。

`qknorm-final-audit.log`：143 页、3,859 条来源，3,699 本地行号有效，104/104 标准页通过。160 个 URL、3,535 个 raw 摘录未逐项核验，本结论不覆盖其语义。专项 `wiki:lint --terms` 通过。

最终 `pnpm check` 已通过：**131 文件、1,073 测试**，类型、Lint、依赖、内容、288 图一致性及 Wiki lint 均通过，记录为 `qknorm-final-20261007-check.log`。既有 17 个 Lint 警告、3 个提示及 4 条 mark-flood 提示保留，不声明零提示。随后 `pnpm build` 通过，记录为 `qknorm-final-20261007-build.log`。最终 CRLF 正负例为 `qknorm-crlf-red.log`（1 项失败）→ `qknorm-crlf-green.log`（15 项通过）；最新浏览器实测见上。

实现与检查已落盘，API 已重启加载本轮修正，网页仍在 `http://localhost:5193/#/wiki`。本轮未提交或推送。

## 后续边界

课程入口和本组问答收尾后，P6 下一项是当前全局模型的真实多 ref 导入、参数 suspect 复核与 GitHub 负例。问答引用三个版本不等同于三版本资料自动导入已验收。Sleep Mode 真实硬件缺口保留；夜间模型配额保持关闭。无新增产品拍板项。
