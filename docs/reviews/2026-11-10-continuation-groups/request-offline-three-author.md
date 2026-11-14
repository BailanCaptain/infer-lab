# 离线 metrics / RPC / cache 三页作者交接

本轮是教学作者补充，尚待新的独立审查者验收。未改总账、API 页、图片或全局全文阅读计数；工程全套检查由 root 统一运行。

## 实际阅读与范围

通读三页原文、三份 request-offline-*-findings.md；逐项核验 evidence.json 的 28 / 62 / 74 项固定 Git 原文与摘录哈希，共 164 项。按内容去重后实际阅读 metrics 8、RPC 24、cache 26 段（含版本间不同内容），不是 164 篇全文。全部范围与哈希在 `.tmp/continuation-groups-2026-11-10/offline-three-author/input-integrity.json`，阅读文本在同目录 `*-unique-scopes.txt`。本轮不新增全局全文计数。

## 主位置与教学补充

- inference-performance-analysis：在已有 Gauge / Counter / Histogram 之后解释 Python 指标快照；沿用 100→140 得增量 40 的示意，说明标签、进程 REGISTRY、Vector、读取不推进请求。源码区补离线构造默认关闭统计、启用方式、断言与四版无输出步更新差异。普通在线的默认值保留并明确范围。
- request-call-chain：在离线队列之后解释公开 RPC 与模型回调，两个 Worker 各回 A/B 的示意说明结果列表；补当前执行器组、包装对象与局部模型、MP 截止时间、UniProc 不计时中断、失败不回滚。原“只读第 0 号回复”及其待核现在明确限定生成内部路径，保留原含义与待核。源码区示例仅返回类名。
- request-teardown：在收尾/抢占机制之后解释离线重置；沿用 A/B 共用块 9 例子，区分默认失败、强制抢占继续生成、清前缀与清媒体/encoder 状态。补 null 块条件、bool / None、外部 connector 的可选调用及非事务边界；rc2 的多池与 warmup 写明具体引擎路径，未误称整个公开方法先等待全部请求。

每个机制均有“是什么、何时用、示意、代价、参数、限制、四版差异”，不另造平行入口页。新回链实际落到离线队列、多模态三种缓存与 UCM 验证流程。

## 保留核验

改前快照为同证据目录 `*-before.md`，逐页统一 diff 为 `*.diff`。实际阅读 diff 后确认：旧主线、七站、GLM 数字、停止条件、监控标签/采样、还块顺序、异常与待核未删除；只对上述新入口必要的默认值、范围、null 占位条件作精确修订。新增段落后将“下表三项”指名为 stop / stop_token_ids / ignore_eos，避免读者误认前面的 reset 参数。

| 页 | 原 sources | 新 sources | 保留的图 / calc |
|---|---:|---:|---:|
| inference-performance-analysis | 83 | 99 | 2 / 2 |
| request-call-chain | 140 | 166 | 6 / 1 |
| request-teardown | 76 | 108 | 2 / 1 |

旧 sources 均为新列表逐项相同的前缀。10 个图围栏、4 个 calc 围栏完全相同；图资源未编辑。新增 74 项（16 / 26 / 32）均以固定 Git 原文重核路径及行界，详细原文与摘录哈希、最终文件 SHA、快照 SHA 见 verification.json。五个 Python 代码块均通过 ast.parse；这是语法检查，不是模型或硬件运行。

## 作者浏览器验收

实际运行 `node .tmp/continuation-groups-2026-11-10/offline-three-author/browser.mjs`，打开本机 5201 的三页，检查前两屏、新机制段、新示例、四版表和全部 14 个 figure（10 图、4 calc），点击三条跨页链接并等待目标标题。32 张证据图均实际查看；最后微调后的 RPC 表与停止参数过渡又查看一次。最终 browser.json：三页 SHA 前后一致，0 pageerror，0 页面横向溢出，三个链接目标标题可见。第一次脚本因目标标题漏写问号而等待超时；补正验收选择器后重跑通过，未更改页面锚点。

初学者前两屏复述：性能页寻找真正阻止下一步的依赖，加速非关键段不一定缩短完成时间，采集也有成本；调用链页沿七站认进程，跨进程需编码、传输与等待，报错须接回原始日志；收尾页是三处分别清请求记录并归还引用，共用块仍由另一请求持有，归还不抹数据。新段落复述：读快照要先完成实验并取同标签增量；公开 RPC 是各 Worker 的控制结果；冷前缀实验要检查重置结果且区分媒体缓存。

`measure.ts` 调用项目 measureStandard，口径为对照源码之前的教学正文（汉字与英文单词，围栏不算字数）：字数 5685 / 6204 / 8428；行内代码每千字 0 / 9.026 / 0；正文角标均 0；calc 每千字 0.352 / 0.161 / 0.119；免责词匹配比例 2.410% / 1.075% / 2.490%。固定源码 H3 顺序及相邻块检查无问题。首图位于正文第 14 / 33 / 8 行，图前 calc 均 0；首图前数字 token 10 / 33 / 0（包括部署页名中的数字、站号与原示意，不把这个机械计数当教学优劣）。未加载图资源的 measureStandard 不用于宣称图宽校验；图片未改并已实际查看。

## 限制与待项

未运行真实 LLM、NPU、多 DP 回调或外部 connector 清理；无此硬件实验结论。公开 RPC 的版本表只覆盖所读 UniProc / MP 默认同步路径，未扩大到 Ray / 自定义执行器。保留原生成路径非回复 rank 异常的设备实证待核。新的首次独立审查与 root 的统一工程检查仍待执行；作者自查不能替代它们。

## 独审 P2 的作者修订（2026-11-11）

独立审查发现旧“常见误解”、旧版本表和 C30 归档句的“所有块空闲”漏了 null 占位例外。已先保存 `request-teardown-before-null-review.md`，仅将这三句统一为“除 null 占位块以外的块都空闲”，与新 reset 主线一致。重新运行 verify.py：74 项固定范围、原 sources 前缀、10 图 / 4 calc 保留与 5 个 Python 片段语法检查通过。新的收尾页 SHA 为 `070f709f68e7b3e1e4776b4097f5a92a049aa2eb7b96575eb1cc308cd9b4194b`。运行 null-followup.mjs 实际查看三处渲染，三图已逐一打开，无 pageerror；旧 browser.json 继续保留初次作者验收快照，本次补验另记 null-followup.json。独立结论由 root 复核，不由作者自行关闭。
