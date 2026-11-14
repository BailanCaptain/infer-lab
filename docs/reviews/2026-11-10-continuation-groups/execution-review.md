# 执行、输入与 Worker 组独立审查

审查者为 `/root/groups_replay_review`；写手为根代理。本报告当前状态是**48个冻结旧引文、44个新增补证项及本组页面内容已独立复审通过**。旧项为47项带适用范围支持、1项固定源码摘录归档支持；44个新增项均按当前主张另行人工判断。根代理的最终五项工程检查已全部退出0，记录在 `execution-verification.json`；独审另核日志指纹及28文件最终哈希一致。本组验收不表示全站官方覆盖已完成。

## 冻结与范围

从 `remaining-after-supplement225.json` 按原 page_id/source_number/ref 键冻结48项：runner14、worker8、prepare10、engine13、RL2、size1。6个原页面哈希与队列一致，当前来源编号和原ref均一致。`execution-manifest.json` 记录逐项键和6页/11图的28文件SHA；原件在 `.tmp/continuation-groups-2026-11-10/execution/before.zip`。

实际阅读全文6页，查看11个静态图、9个演算渲染与6页首两屏。独立读取46个固定源码片段、GLM固定教程430行和EngineCore源码摘录归档848行。除原48项外，按新主张追读rc2状态、加载器、实际调用方、平台条件及上游MRV2设计；精确范围见 `execution-evidence-additions.json`。没有把39条表行/补证组或代码文件行数记作39篇全文。

历史阅读：已读取 trial-200 的独立审查全文及本组4页逐项判断；closeout独立报告的本组修正/保留表与size来源范围修正；group-06参数字段身份审查。历史结论用于定位和保留，本轮48项均另读原文重判。其它历史来源未冒称在本轮全部重新读过。

## 初审发现（均已修订并复审关闭）

| 编号 | 严重性 | 发现与影响 | 已交写手的修订方向 |
|---|---|---|---|
| EX01 | P1 | runner把“温度接近0”称greedy，混淆temperature=0与小正数随机采样 | 统一前组已核结论：0才greedy，小正值仍随机；保留两行5词算例 |
| EX02 | P1 | runner/worker/prepare/engine首两屏仍主要是定义、图和步骤，收益与代价段落在之后；按写作标准未通过开篇验收 | 在首图前给属于该机制的收益与代价，后文详细解释保留 |
| EX03 | P2 | runner仍用相同seed单独推出各卡结果一致 | 限定同分数、算法、随机流和取数顺序；不能跨后端或批次直接保证 |
| EX04 | P2 | runner、worker、prepare、RL旧逐项版本表漏rc2，页前概述不能覆盖每一行 | 根据39条人工补证按行补rc2；EngineCore整文件同字节可明确复用但限制到那两个文件 |
| EX05 | P2 | runner首图权重框“启动时装好，之后不动”与已修正文和RL页矛盾 | 限定普通在线推理跨步复用，保持权重/请求记录/KV三类生命周期图 |
| EX06 | P2 | prepare流程图只写“追加块号”，正文来源38已明确恢复请求替换 | 图改为更新块号，简述追加/替换；A/C演算不改 |
| EX07 | P2 | 官方MRV2设计已有持久状态与每步输入分离、pinned快照和增量设备写入，本站只呈现开关与旧链 | 补上游设计承接，明确它不证明Ascend V2能力已跑通 |
| EX08 | P2 | 5个概念页末仍以“待核/缺口”呈现维护语气 | 改为读者可用的测量/适用边界；保留缺日志、无NPU、无吞吐或训练联调事实 |
| EX09 | P2 | rc2的Router Replay实际拒绝MRV1；旧RL能力清单若只列服务开关会让读者启动失败 | 补平台校验调用与函数，说明rc2必须V2及模型兼容条件；不倒推旧main |
| EX10 | P2 | rc2多线程默认加载器只兼容None/lazy，不能把普通iterator的prefetch条件推广到该分支 | 限定普通路径，补冲突报错；GLM未启该字段的原预读算例保留 |
| EX11 | P2 | rc2 V2补丁实际63行，独审初稿误写L1–L64并被两个新增来源采用 | 独审证据和教学来源均改为L1–L63，44个新增范围全部重检有效；原错误记录留在初轮差量 |
| EX12 | P3 | Worker方法表去掉代码样式后，双下划线被Markdown解释，__init__显示成init | 仅该单元恢复代码样式，最终表截图已看到完整标识符 |

rc2 MRV1还拒绝PCP>1，已要求prepare版本表对应说明。FA3路径依然仅无PCP才判定；统一RL总开关和子开关、模型类别、软件包条件都必须保留。

## 证据与浏览器

初轮独立浏览器：`node .tmp/continuation-groups-2026-11-10/review-execution-browser.mjs`，6页均打开、各点1条内链，页面错误0、横向溢出0，读取前后28文件哈希稳定。报告为 `.tmp/continuation-groups-2026-11-10/execution/browser/report.json`。首轮截图的部分图顶被站点固定页头遮挡，另由首屏截图补看；最终脚本已将图顶对齐页头之下，将在改后重新截图。这不是内容通过的替代证明：EX02由实际首两屏发现。

实际查看官方MRV2的5张图，逐一与ced6857a Git资产字节核同。官方目录反查与正文阅读范围见 `execution-official-reading.json`：MRV2全文206行及5图、GLM教程全文430行已重读；安装指南只记录实际读过的母文本和include，未读嵌套include不计整份渲染文档完成。本组这些已存在资料不虚增全局新全文数。

必须保留的教学语义见 `execution-preservation-checklist.md`。独审未修改教学页、应用代码和其它会话3D。没有NPU运行、真实吞吐/显存/接受率或训练循环验收；全站官方覆盖尾项另账继续。

## 修订后独立验收

EX01 的0温度与小正温度已按采样参数实际分支区分；EX02的4页首两屏现在能读出各自动机与代价；EX03保留分数、算法、随机流及调用顺序条件；EX04逐项四版表与Worker六方法行号已核；EX05/06两张图分别改为普通推理跨步复用、续跑追加/抢占恢复替换；EX07加入官方MRV2承接并保留设备实现与Ascend支持的区别；EX08改成实测/适用边界且保留缺日志、缺profiling及训练联调事实；EX09给出实际平台校验链和V2必需条件；EX10明确多线程分支的策略冲突。终轮 EX11/12 也已修正。合计2项P1、9项P2、1项P3全部关闭。

48项原键及逐项判断在 `execution-manual.tsv` / `execution-judgments.json`；44个新增项为runner12、worker18、prepare8、RL6，逐项人工判断在 `execution-additions-manual.tsv` / `execution-additions-judgments.json`。39组补证的语义判断与最终44个去重后的来源项是不同计数，均不是全文篇数。原6页sources前缀完整保留，没有改号、删除旧引用或把已读资料重新增加为全文数。

全文件字节比较也已入正式证据：vLLM `core.py` 的 ced6857a/84030bbe 两份SHA均为 `268bf40534a853812867ae8e80040f190983cb364b41182b55969aace20c93f5`；Ascend `patch_engine_core.py` 的7d825229/baa023ad两份SHA均为 `050f71806f8b06bb391dbfc506e588d220aa6ebfc05ba67c6f7f8dc6649d1419`。default_loader.py和config/load.py也字节相同。其余6对Ascend执行/配置文件不同，逐条表行只能依各自实际范围判断；完整SHA见 `execution-evidence-additions.json`。哈希相同不被记作全文逐行阅读。

最终浏览器命令为 `node .tmp/continuation-groups-2026-11-10/review-execution-browser.mjs final-browser-v3`，退出0，6页打开、6条基本内链与3条新增承接链接均成功，页面错误0、横向溢出0、28文件读取前后哈希稳定。3条新链接为prepare→MRV2、MRV2→版本表、engine→DP prefill节奏，已核到真实目标标题。`final-browser-v2` 曾因审查脚本漏写目标标题末尾的问号而超时；它不是页面坏链，修正精确定位器后重新实际点击通过。

初轮已实际查看11静态图及全部演算展示；改后实际复看6页首两屏、2张改图、7张变动表、MRV2新段与新增链接目标。Worker表的__init__修正后又实际看图；verified变化后的首屏也复看。未变化的9图、8个calc和size公式块按原实际阅读与最终字节边界复用，不把仅截图保存说成额外全文阅读。公式/算例、条件、误解和原有链接去向经完整差量与逐条保留表检查，没有用数字字符串一致代替语义判断。

最终28文件指纹及6页哈希在 `execution-final-acceptance.json`。页面SHA如下：

| 页面 | 最终SHA256 |
|---|---|
| npu-model-runner | 126271fbe20b24d4eea26c562bc0c50acaeaa87ef447cbb3b3722d7194ddb8f6 |
| npu-worker-lifecycle | f86c281eeda5f93fe507e06f80fad8304fdffce73abe6bd40c05c4aaf807b53d |
| prepare-inputs-flow | a0005c99a2847a2dd2d33d74c0c8c341ce8a522978e1e4d7ceebb9963f4a21e6 |
| vllm-engine-core | 11ed3fb80d37983f04b38a06b523d5a2fe1a1729fde94174bcc6ca78d6262402 |
| vllm-ascend-for-rl | 8ca5e5b713f14da141e16f68072383f16fd6ecd8347630fda17a42293f64ecc2 |
| size-40a1c2ca47b8（未改） | b375f406188dde56584c3c915b7780bbd6e49e4f5b96079fe2457c689788f553 |

本轮另复读了此前已读的0fc695fc优化指南全文462行，仍记0新全文。安装指南只复用根代理已有全篇阅读、独审实际读主文本和已列include；未将未展开嵌套include或未读链接算作新全文。DeepSeek生产文章缺3图和论文外部资产清单仍是全站尾项，不在这48+44项验收中自动关闭。

最后根代理自行发现EngineCore的main表述把两个比较提交称为“配套”；改为分别核对的比较点，并明确不证明实际安装组合。独审已重读该唯一差量并在浏览器打开版本段实际查看，`execution/engine-final-delta.json`记录28文件读取前后稳定、错误0；本次只复查这一页，前述v3证据继续覆盖其它内容。13个EngineCore旧项及总验收文件已刷新到上表最终SHA。rc2 Worker构造函数另实际补读123–213及相邻卸载辅助函数至245，确认不是仅凭尾部摘录推断旧0.23.0回退已消失。

根代理最终重新执行的 `check:content`、`wiki:lint`、`wiki:audit`、`wiki:diagrams --check`、`build` 均退出0，使用 `execution-closed-*` 日志。独审未冒称亲自执行这些工程命令；已核5份日志SHA及检查清单的28文件SHA。最终包为 `.tmp/continuation-groups-2026-11-10/execution-final.zip`，文件数、字节数和SHA另存 `execution-archive.json`；包含改前快照、最终教学文件、人工逐项账、固定证据、浏览器与工程日志。后续若修改教学文件，应以新哈希重新决定验收范围。
