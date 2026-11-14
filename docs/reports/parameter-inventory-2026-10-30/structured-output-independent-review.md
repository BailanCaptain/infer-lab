# C 首批结构化输出独立审查

审查日期：2026-11-01。审查者：本轮新建的 `structured_independent_review` agent，独立于正文写手。按 `docs/wiki-writing-standard.md` 和本目录 `c-scenario-plan.md`，阅读实际页面、两份图 spec、既有快照和下载的固定源码；没有读取 `tools/repos/`，没有修改正文、图或 registry。

## 结论与范围

通过本轮独立审查：未发现 P1；发现的三项 P2（两项事实/示例、一项首屏阅读）和两项 P3 均已修订并复核关闭。没有未关闭的本轮审查问题。结论包括实际阅读文档/图、固定源码核对、独立 CLI 检索及查看写手提供的本轮浏览器证据，不代表完成 NPU 实测。

本轮只验收 C 首批 20 个原项合写的 17 条参考说明，不把 C 后续后端诊断项、工具/parser 完整参考或 NPU 性能实测算作本轮完成。唯一主说明为 `wiki/concepts/structured-output.md`，没有拆出重复参数页。

| 参考说明 | 原台账 | 当前页位置与审查结论 |
|---|---|---|
| response_format | W0513 | 402–410：Chat/Completion、四种类型、schema 别名、同传替换与互斥 |
| structured_outputs | W0528 | 402–443：HTTP/SDK/Python 层级、None/空对象、六选一 |
| json | W0533 | 415、425、596：对象/字符串、schema 示例、较新版本空串校验 |
| json_object | W0534 | 416、426、553、597：true/false/None 与错误阶段 |
| choice | W0529 | 417、427、598：字符串候选、空列表、重复项不加权 |
| regex | W0535 | 418、429、599：转义、后端校验、超时与 NUL 差异 |
| grammar | W0532 | 419、430、600：EBNF、Lark 转换、后端边界 |
| structural_tag、旧 begin/end/schema | W0536、W1033–W1035 | 445–490、601：新旧结构、外部别名、序列化入口、后端分流；4 个原项合写 1 条 |
| 请求 disable_any_whitespace | W0531 | 492–500：False，未传入编译，不覆盖服务值 |
| 请求 disable_additional_properties | W0530 | 同上：False，不触发 guidance 改写 |
| 请求 whitespace_pattern | W0537 | 同上：None，字符串虽可保留但不参与文法 |
| structured_outputs_config | W1697 | 502–523：启动 JSON/Python、缺省对象、服务层级 |
| 服务 backend | W1199 | 506–509、559–566：auto、四个显式后端、Ascend 单后端、MTP 限制 |
| 服务 disable_any_whitespace | W1201 | 508、513：显式后端校验、自由空白与默认分隔符 |
| 服务 disable_additional_properties | W1200 | 509、515–523：guidance 前提，仅补缺失值，不覆盖显式 true |
| 服务 enable_in_reasoning | W1202 | 510、525–529：parser 有无、开关、思考结束状态组合 |
| VLLM_XGRAMMAR_CACHE_MB | W0435 | 511、531、606：默认 512、MiB、构造时读取、非整数错误、0/负数语义不臆测 |

行号以审查时页面为准；原项身份来自计划，未重新扩张范围。

## 初学者复述与信息保留

独立阅读开头直觉、动机与代价后的复述：模型仍给候选打分，文法根据已经输出的前缀算出下一步允许哪些 token；不允许的分数在采样前变成 −∞。它不是事后修 JSON，也不替模型判断答案是否真实。示意中原最高分的候选 3 被禁止，候选 1、4、6 留下，选最高分时取 6；输出 token 后，文法继续推进，下步允许集合会变化。收益是正常写完时格式符合编译后的规则，代价来自编译、逐步填表和同步，以及 Ascend V1 搬运整张 logits、MTP 候选检查与回滚、异步整批等待。实际 UI 首屏已出现概念定义，第二张截图完整显示机制图；动机与代价另外留图，不靠删减解释强压进两个物理视口。

两张图的 YAML 均实际阅读：直觉图的 8 个候选、分数、允许 1/4/6、选中 6 与正文一致；流程图保留 API → EngineCore → worker、V1/V2 分支、MTP 回滚与异步等待。图宽均为 880，未因参数补写改变机制图。

独立脚本把正文与本轮写前副本比较：教学区除 `512 MB` 更正为 `512 MiB` 外完全相同，两个 calc 完全相同，两张图的 YAML/SVG 均字节相同，`已废弃的说法` 整段尾注完全相同。人工复核保留了 154880/154856、4840、19,360 B、128 行、2.36 MiB、1.18/37.8/75.6 MiB 的原有条件，MTP 四行、V1 往返、单后端、思考起点、停止截断和异步整批等待未被参数表替换。页末特殊 token、设备开销、V2 组合等待核仍保留。

## 固定源码独立核对

三份上游固定为 `0fc695fc`、`568afb3a`、`84030bbe`，GLM 执行侧沿用 `db701c1f`。从本轮 `sources/`、`version-review/` 逐文件读取，而非将 facts 报告当作审查结论。另独立取得 XGrammar `5433fdbe` 的 `compiler.py`，核对空白参数与分隔符默认。

关键核对包括：

- 六种约束按 `is not None` 计数；辅助字段不算约束。json_object=false 在基线后续无法选类型，在后两版提前拒绝。三版空 choice 和空白 grammar 均拒绝。
- response_format 转成相应的单个约束并通过 `dataclasses.replace` 合并：同名替换、异名触发互斥，text 保留已有约束；不是整个容器简单覆盖。
- 请求的三个辅助字段没有进入编译数据流。基线/rc 的编译签名为类型与内容，main 额外有可选 stop_token_ids，但仍没有三个辅助字段。
- 服务两项 disable 开关组合逐一检查：任意空白限显式 xgrammar/guidance，额外属性限显式 guidance；auto=true 的组合会在配置校验拒绝。guidance 递归补缺失的 additionalProperties=false，保留显式 true，不修改调用者原对象。
- 旧 structural_tag 的 begin/end/schema 别名与新 format 分流、Outlines 缺 JSON_OBJECT、LM Format Enforcer 正草稿数拒绝，不能因前端接受对象就推断所选后端可编译。GLM MTP=3 的边界已在错误表明确。

## 发现与关闭证据

| 级别 | 位置与影响 | 原始依据 | 修订与复核 |
|---|---|---|---|
| P2，已关闭 | regex/EBNF 表格示例：普通 Markdown 吃掉 JSON 转义，复制呈现文本会成为非法 JSON | 实际 react-markdown + remark-gfm 渲染；修前 `independent/markdown-escaping.html` | 改 inline code；修后提取 code 文本再 JSON.parse，2/2 通过，见 `rendered-examples.json` |
| P2，已关闭 | 服务 disable_any_whitespace：容易被读成删除标点间全部空格，导致对输出/长度的错误预期 | 固定 XGrammar compiler.py 144–192，默认 separators 在 indent=None 时为 `(', ', ': ')`；vLLM 未覆写 separators | 当前 513 行明确限制自由格式空白、不保证删除全部标点间空格，补固定源码来源 |
| 信息，已澄清 | main 编译入口比前两版多可选停止编号 | 独立脚本初轮实际发现 4 个后端签名不同，证据保留于 `source-review-first-signature-observation.json` | 当前 500 行按版本说明；修订独立断言后的 123/123 不掩盖该差异 |
| P3，已关闭 | 400 行把“17 条”台账编排带入读者正文 | wiki 写作标准要求不把维护者编排理由写进教学正文 | 当前改为“先区分两种请求入口” |
| P3，已关闭 | 411 行指向未落地的“该场景的参考”，没有可用链接 | 实际 Markdown 只有抽象转述，没有目标 | 当前回链已有“入口处理”小节，保留 tool_choice 派生 schema 的边界 |
| P2，已关闭 | UI 首屏的完整 aliases 占约 11 行，把教学正文挤到屏幕下方 | 审查者实际查看 `ui-first.png` 与 `ui-second.png`；违反标准“不要让首屏别名、参数压过概念” | 默认收起的原生 details 保留全部 47 个别名，查看最终首屏/机制图/展开截图和交互 JSON 后确认正文恢复、展开内容保留 |

## 独立验证与边界

证据根目录：`tools/wiki-runtime/structured-output-20261101/independent/`。

| 验证 | 命令/证据 | 结果 |
|---|---|---|
| 固定源码隔离执行与 AST、保留性 | `python .../independent/check_review.py`；`source-review-results.json` | 123/123 |
| 真实 Markdown 渲染后的 JSON 转义 | `node .../independent/check-rendered-examples.mjs`；`rendered-examples.json` | 2/2 |
| 实际 CLI 检索 | `pnpm.cmd --silent wiki:find <名称> --json --limit 1`；`cli-retrieval.json` | 20/20 第一条 exact 命中 structured-output |
| 来源白名单窄改动 | `pnpm exec vitest run scripts/wiki/sources.test.ts`；`source-allowlist-tests.txt` | 1 文件、31/31；仅精确放行固定 XGrammar 提交下两个文件，伪域名、main、其他文件/讨论仍拒绝 |
| WikiPage 既有回归 | `pnpm exec vitest run src/app/pages/WikiPage.test.ts`；`wiki-page-tests.txt` | 1 文件、2/2；该检查不替代新折叠入口的浏览器点击验证 |

白名单审查同时读了 classifySource 实现、两条新增记录、对应测试与 HANDBOOK 两行。别名修订只把 WikiPage 原段落换成原生 details/summary，默认关闭，仍渲染全部 aliases，以 page.id 为 key 防换页后保留展开状态；独立读了这 6 行及相邻结构、CSS。没有把同一工作区中其他来源/容器内存条目或 WikiPage 既有大量改动视作本轮改动。此少量代码使用 Ponytail full 的范围控制；教学文档仍按 wiki 标准保留必要解释。

源码隔离检查只运行提取的纯 Python 数据类/校验与辅助函数，main 的 VLLMValidationError 在隔离环境以 ValueError 表示；没有启动 HTTP 服务、真实 tokenizer、XGrammar/guidance 编译器或 NPU 推理。新 format 只核协议/类型与固定来源，不冒充镜像库版本实测。当前页保留的真实待核不因本轮参数收录而关闭。

写手运行的 lint/build/audit 日志已阅读，属于旁证而非本审查者重跑：目标页写作统计口径为教学区 6036 字，行内代码 0.2/千字、源码区上方角标 0、免责 1.8%、图宽通过；仓库 lint 的 8 条非阻塞提醒均非本目标页。

## 浏览器证据复核

浏览器由写手实际操作；本审查者打开本轮本地截图并读取原始交互/布局 JSON，未冒称自己操作浏览器。实际查看 `ui-first-final.png`、`ui-second-final.png`、`ui-motivation-final.png`、`ui-glm.png` 与 `ui-glm-final.png`、`ui-aliases-open.png`，以及请求/服务/版本/检索截图。首图完整的选择与回填箭头、流程图上下半的 V1/V2/MTP/异步分支可读；图文未出现冲突，长表的可见列没有互相覆盖。两个 calc 截图 `ui-calc1.png`、`ui-calc2.png` 中的输入、单位与结果完整，2.36 MiB、37.8/75.6 MiB 与正文口径一致。

- `ui-aliases.json`：默认 open=false，点击后 open=true，47 个别名仍完整，键盘关闭成功。
- `ui-alias-navigation.json`：跳往另一页时关闭，返回本页也关闭；与 page.id 作为 key 的实现一致。
- `ui-retrieval-final.json`：别名折叠代码最终构建后再执行的实际浏览器检索，独立读取并汇总为 26/26 通过、26/26 第一条为目标页；不与本审查者独立 CLI 的 20/20 混算。先前 `ui-retrieval.json` 保留作过程记录，不作为此处最终构建证据。
- `ui-layout.json`：13/13 表宽不超父容器；实际 DOM 提取的 5 个 HTTP 成员片段全部能解析 JSON；入口回链与实际 heading ID 对应。

最终源码/保留性复核绑定页面 SHA256：`76c4463f30d348b0d013fd28ac12dc6fc8d4e732c2d03b352e7e03d19b915b1f`。重要限制仍是没有现场 NPU、tokenizer 或实际镜像文法库编译证据；这些在页末待核保留。需用户决定的问题：无。

## 交付记录收尾复核

另外阅读了作者的 `structured-output-backfill-validation.md`、本目录 README 与 C 场景计划执行更新。20 个原项/17 条说明、原 6 项缺说明与 14 项不完整、A/B 100 加本批为 120、历史 C 989 减 20 为 969 的口径相互一致；没有把规范化规划单元 982 与历史原项 989 混算，也没有把 969 宣称为已确认漏收的公开参数数。

逐项对照现有原始证据：作者三版 66/66、白名单先红 2 个失败再绿 88/88、四文件 70/70、内容 167 页/11 主题、Biome 3 文件、审计 104/104 与 5013 条来源，以及最终 UI 26/26，均与报告相符。此收尾只读既有结果，没有重复运行已通过的检查。

README 明确标出最新交付，旧 A/B 100 项和 C 规划段落被标为历史口径；C 计划用独立的执行更新说明首批已交付，并明确下面仍保留规划当时的“下一批/未修改正文”叙述。CSV/JSON 仍呈现 C-only planning 的历史状态，最新交付从 README/本轮报告读取；未发现把历史规划检查伪装成本轮补写验证，或将全量 C/D 宣称完成的情况。下一场景“诊断与观测”与计划优先级表的下一行一致。未发现新增 P1/P2/P3。
