# 928 原生 SVG Drop 返修独立复验

2026-11-16 17:04 UTC，砚砚 / gpt-6-astra。结论：**Changes Requested，0 P1 / 1 P2**。922 的两项 P2 已由真实入口独立复现闭合，但完整回归发现现行规则与原有 128K 长篇修订路径的组合超预算，须在本任务内修复后再批准该代码子批。

## 本轮核对字节

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/drop-integration.ts` | `1543e992c1f4b6a2e1f2a9ca9f25264d5637f7ad21c132ded3d83549432d0947` |
| `scripts/wiki/drop-receipt.ts` | `a18012a694b0f13f0b3c0d60b879270960de8596c81006b7c28600ca7f03a941` |
| `scripts/wiki/drop-assets.ts` | `7985fb02c1a85956047194606ab2245e8b27209a93854db0f51f1c6c126d9c85` |
| `scripts/wiki/drop-native-shared-review.test.ts` | `753237e6abe9489d91fbb811323b193bd91902b1369ac69a28805962f7194318` |

## 已闭合的两项 P2

- 真实新尝试的 generated / section / edited 指令已经允许 `native-svg` 的 `{id,yaml,svg}` 纯数据并禁止可执行代码，新增 native 伴生契约；旧封存规则保持兼容。新三路调用测试通过。
- 生产资产复核与批准门禁共用 `diagramMaterialPaths`，native 的当前 YAML 与 SVG 同时绑定。root `928-shared-native-contradiction-check2.json` 显示未改写的 old-device 页实际收到新 SVG 并拒绝四/八请求矛盾；`928-shared-native-compatible-check3.json` 显示合法更新经过默认验证进入 Review 并正常批准，删除 SVG 绑定、截短范围与错误 hash 均被拒绝。确定性零付费夹具，不冒充真实模型语义验收。
- `928-native-cache-replay.json` 在隔离副本复用 210 次缓存，仅在第 211 次未缓存的 drop-discover 请求由拒绝调用模型的代理终止；原现场 1363 文件与 batch 不变，付费调用为零。回放前后上述生产文件 SHA 一致。

## P2：真实标准下的 128K 长篇修订超出输入预算

位置：`scripts/wiki/drop-integration.ts:3178-3191` 长文固定 12000 字节范围与完整编辑规则/必要来源的组包；实际拒绝点 `:1982-1984`。稳定复现是已有 `scripts/wiki/drop-integration.test.ts:1029` 的 `integrates a long concepts/ teaching page revision under real handbook, writing standard, and TERMS.md at 128K`，使用真实手册、标准与术语，128000 窗口和 16384 输出预留。

实际结果：`整合：paged-attention:0:0 输入 28562 > 26798 字节，必要证据仍超量，保留未完成范围`；批次为 failed，原断言要求 review。现行手册 `b6972b55…` / 标准 `bb8f4d00…` 与新规则的组合使既有长篇编辑入口不可用。说明文档自身的 12 项契约测试通过不能替代这条真实写管线路径。

补充保留现场的独立探针 `953-budget-probe.mts`：当前手册报告 `953-budget-current-red.json` 重现相同 28562 > 26798；隔离副本改用 931 之前的手册后，`953-budget-old-handbook.json` 仍以 28562 > 27715 失败。两者在相同的新代码和现行标准下运行，均尚未调用第一次 drop-edit；不是仅回退手册即可解决。探针沿原测试的验证隔离设置，未批准发布，所有模型调用由确定性代理模拟。

修复方向：依据真实完整规则和序列化负载选择可容纳的编辑范围，或消除规则注入中的实际重复，保留原文完整覆盖与稳定偏移；不要提高配置预算、缩减测试长文、删去必要来源或降低失败断言。也必须保持旧 210 封存调用的字节与缓存兼容。用既有失败测试先红后绿，并回归三路 native 输入及共享资产检查。

## 本轮验证与边界

root `vitest run` 覆盖 drop-native-shared-review、drop-native-svg、drop-assets、drop-integration、review、diagrams、diagram-cli、diagram-audit、snapshot-diagram：**9 files，84 passed / 1 failed，exit 1，171.59s**，完整日志 `%TEMP%/infra-wiki-review-20261115/928-root-regression.log`。`tsc -b --noEmit` exit 0。除上述预算问题外没有新发现。

用户授权、作者与保护边界不变：由烁烁沿 045 收口，root 独立复验，暂不叠加浏览器/React 新范围。931 文档同步已经独立批准；本报告不撤销已通过的独立框架子批，也不宣称 045 或阶段一完成。

## 17:20 UTC 恢复与独立边界探针

955 同作者结构化交接已在任务持久化，但旧执行 `9c20792e-19b2-4265-bd36-00e528dd6492` 仍占用运行态。root 按 839 既有恢复授权核对公开 Queue 的精确源消息与当前执行后，通过同一条 955 的正式 `queue/<entry>/steer` 控制结束旧轮并启动同作者短轮；返回 `started=true`，随后生命周期回读确认新执行 `5bda3dde-92a1-4003-9b18-9ffa7ddfe747`，旧执行已不在 activeRuns。没有并发改生产代码，也没有仅凭 Task 状态推断旧进程已退出。控制回执 `955-runtime-handoff-receipt.json` 保留。

旧 934/940/942 三条 root 自己的待处理补充已被当前 955/956 覆盖（文档同步完成、旧 WIP 未定义变量已闭合），仅撤出其剩余队列派发；原共享消息历史保留。回执 `955-superseded-notification-withdrawals.json`。

独立 `955-budget-boundary-probe.mts` 在原测试基础上增加实际编辑范围的完整覆盖、UTF-16 字符边界、完整系统规则后的序列化输入预算与旧事实出现次数观测。当前 `53058e0f…` 字节上：原夹具 `955-budget-boundary-current.json` 为 28562 > 27403；含反斜杠、双引号与非 BMP 字符的合法长正文 `955-budget-boundary-escaped.json` 为 30344 > 27403，同属原 P2。两者均未进入首个编辑调用，`allInputsFit=true` 仅表示之前已发出的调用未超限，绝不等于整合成功。复验应写新的报告文件，成功时还需确认完整范围连续覆盖与 260 处原有条件保留。

root 已在作者修复期间完成独立浏览器子批（`955-native-drop-browser-review.md`，真实批准 API、静态重建与断 API 的精确图 pin 阅读通过）。因此作者本短轮只收预算与必要回归，无须重复未变 UI 的验收。
