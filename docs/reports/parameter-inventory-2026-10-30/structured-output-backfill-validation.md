# C 首批结构化输出补写与验证

交付日期：2026-11-01。按 [C 批计划](c-scenario-plan.md)完成 **20 个原项，合写 17 条参考说明**，唯一主说明为 [structured-output](../../../wiki/concepts/structured-output.md#对照源码)。不另建重复参数页；原有机制、算例与图继续复用。[独立审查报告](structured-output-independent-review.md)列出逐项位置、发现、修订与复核证据。

## 范围与版本

覆盖 W0513、W0528–W0537、W1033–W1035、W1199–W1202、W1697、W0435，共 20 项。其中 W0536 与旧标签的 3 个子项合写一条，仍分别验收，故为 17 条参考说明。原计划中 6 项缺参数说明、14 项参考信息不全，本批均已补齐到计划要求的说明范围。

基线仍是 vLLM `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665` / Ascend `db701c1fd31de40ab028628ee2580ae68c7fd3c0`；三版对照为 v0.23、v0.26 固定 `568afb3a`、main 固定 `84030bbe`，Ascend 对照沿用 `2c59ff10`、`2ed6cbba`、`baa023ad`。没有把当前互联网 main 当作现场版本，也没有核实运行中镜像摘要。XGrammar 新标签与分隔符另外核对 v0.2.0 的固定 `5433fdbe`；vLLM 的依赖范围并不等于镜像锁定这一版本。

## 补写内容与关键边界

- 请求入口：response_format、structured_outputs、六类互斥约束、HTTP/SDK/Python 层级、完整 schema 请求、正则和文法 JSON 转义、新旧 structural tag，以及旧 begin/end/schema 的外部别名。
- 请求辅助项：两个 disable 开关与 whitespace_pattern 在三份固定版本中均未传入文法编译，不能写成覆盖服务值。main 编译签名虽多可选停止编号，仍未消费这三个字段。
- 服务配置：父容器、backend、两项 disable、enable_in_reasoning；讲清默认、显式后端限制、配置拒绝条件、parser 状态与约束时机。guidance 仅补缺失的 additionalProperties，不覆盖显式 true。
- 缓存：VLLM_XGRAMMAR_CACHE_MB 默认 512，实际乘 1024×1024，故为 MiB；创建 compiler 时读取，区别于 KV cache，不臆测 0/负数是关闭或无限。
- 三版错误阶段与后端能力：基线 json_object=false 后续找不到有效类型，后两版提前拒绝；空白 JSON、NUL 正则、超时保护逐版说明。Outlines 无 JSON_OBJECT 编译分支；LM Format Enforcer 不支持正草稿数，不能直接套本部署 MTP=3。

来源由 45 条增加到 91 条，新增 46 条固定引用。为核对新标签结构与默认分隔符，在来源规则及 HANDBOOK 精确登记 XGrammar 固定提交下的 structural_tag.py、compiler.py 两个文件；未开放整个仓库或浮动分支。

## 信息保留与阅读修订

独立比较本轮写前副本：教学区除缓存单位 MB→MiB 更正外一致；两张图的 YAML/SVG、两个 calc、已废弃历史尾注均保留。原有 GLM 词表/填表/缓冲/搬运数字、MTP 回滚、思考阶段、单后端和异步整批等待没有被参数说明替换。页末特殊 token、设备开销与 V2 组合的待核仍保留。

独立审查发现并关闭三个 P2：表格转义导致复制出的 JSON 无效；“禁空白”容易误解为删除全部分隔空格；长别名列表挤占首屏。两处写作 P3（台账数量进入正文、指向未落地参考）也已关闭。作者浏览器检查另修正三张表的长字段/路径排版，最终 13 张表均不超过正文父容器宽度。

为保留精确检索又恢复入门阅读，WikiPage 的别名区由段落改为原生 details，默认收起，按页面 id 重置。全部 47 个别名仍在数据中。修改前截图稳定复现首屏挤占；修改后实际验证鼠标展开、Enter 收起、切换 sampling 再返回均默认关闭。没有新增依赖、搜索分支或单页特殊判断；同一页头组件的其他有别名页面也采用该显示方式。

## 本轮验证证据

本地证据根目录：`tools/wiki-runtime/structured-output-20261101/`。表中路径均相对该目录。

| 验证 | 结果与证据 |
|---|---|
| 三版隔离源码检查 | 66/66，`version-review/contract-results.json` |
| 独立源码、保留性与边界检查 | 123/123，`independent/source-review-results.json` |
| 作者 CLI 精确检索 | 26/26，`cli-retrieval.json` |
| 独立 CLI 精确检索 | 20/20，`independent/cli-retrieval.json` |
| 最终浏览器逐项检索 | 26/26 第一条为目标页，`ui-retrieval-final.json`；真实目录搜索，无模型回答冒充命中 |
| 浏览器阅读 | 首两屏、动机/代价、两图上下部、两个 calc、请求/服务/版本表实际阅读；`ui-first-final.png`、`ui-second-final.png`、`ui-motivation-final.png`、`ui-glm.png`、`ui-glm-final.png`、`ui-calc1.png`、`ui-calc2.png`、`ui-request.png`、`ui-service.png`、`ui-versions.png` |
| 实际 DOM 检查 | 13/13 表宽适配；5/5 JSON 成员片段解析成功；入口链接对应实际 heading，`ui-layout.json` |
| 别名操作 | 默认收起、完整展开、键盘收起、跨页重置通过，`ui-aliases.json`、`ui-alias-navigation.json`、`ui-aliases-open.png` |
| 来源白名单先红后绿 | 新两个允许案例修前失败，修后 sources/lint 88/88，`source-test-red.log`、`source-test-green.log`；独立 sources 31/31 |
| 页头与检索相关回归 | WikiPage、retrieve、page-names、sources 四文件 70/70，`ui-related-tests.log`；独立 WikiPage 2/2 |
| TypeScript 与代码规范 | `pnpm exec tsc --noEmit` 通过，`tsc-final.log`；Biome 检查本轮三个代码文件通过，`biome-final.log` |
| 构建与内容 | `pnpm wiki:build`、`pnpm exec vite build --outDir preview-dist`、`pnpm check:content` 通过；167 页、11 主章节，无重复；对应 `wiki-build-final.log`、`build-final.log`、`content-final.log` |
| wiki lint | 通过，其他页面 8 条既有非阻塞提醒；`lint-final.log` |
| 强制审计 | 104/104 标准页通过；5013 条来源，无无效 commit、缺文件、越界行号或未知仓库；`audit-final.log` |

审计的通过范围是本地引用、行号与写作标准，不等于全部 URL 联网验证或结论语义检查；语义由本轮固定源码核读及独立审查补足。UI 使用本地构建预览，未发布远端。验收后停止本轮临时预览进程，将最终构建归档到证据目录的 final-preview-dist；仓库根目录不遗留生成产物。交付时再次汇总检索结果、报告文件链接及最终页哈希，见 delivery-check.json。

## 进度与限制

A/B 优先范围原 100 个单元，加本批 20 个原项，累计完成 120 个原台账单元；本批写作上合为 17 条，不把父子合写当作漏验。历史 C 台账 989 项中已有 20 项交付，尚有 969 项后续安排；这是历史工作身份的进度，不是剩余公开参数数或确认缺口数。原 CSV/JSON 保持规划快照，避免静默改写历史；最新状态以 README 与本报告为准。

没有执行真实 HTTP/vLLM 服务、XGrammar/guidance 库集成或 NPU 推理；隔离源码检查不能替代这些运行验证。全量 C/D 尚未完成。按既定顺序下一场景是诊断与观测，进入时继续拆分范围并核消费者，不在本轮提前补写。需用户决定的事项：无。
