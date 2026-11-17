# 第一阶段四类样本：隔离材料录入与整合实证

2026-11-16 18:52 UTC。依据用户 969、993、996；这是 Task 043 工程验收记录，不是文章整改或阶段一完成记录。

通过真实 `createWikiServer` 的 `POST /api/wiki/drops` 录入既有材料原文，第二次同键请求返回同一批次；`GET /api/wiki/drops/:id` 能回读持久记录。未调用 `/run`、未初始化或重置模型预算、未批准任何 Review。

| 验收体裁 | 原样复用材料 | SHA-256 前缀 | 原有审定状态 |
| --- | --- | --- | --- |
| 概念 | `candidates/01-chunked-prefill.md` | `0370306fb60f3435` | 038/039 双审 |
| 公式 | `candidates/02-quantization.md` | `931e8f056452b3e4` | 038/039 双审；复用现有量化公式，体裁不改变 frontmatter 类型 |
| 参数 | `candidates/03-enable-super-kernel-ce990e186bfa.md` | `c18906ea533a6db7` | 038 事实审通过；039 尚未完成，不冒充双审，不要求阶段一补写 |
| 排障 | 正式 `wiki/concepts/inference-troubleshooting.md` | `ae2646d352daad035` | 直接复用既有正式正文，内容整改留第二阶段 |

所有 `candidates/` 路径均相对本目录。上述材料是既有文章/编辑候选，不能重新包装成一手源码或硬件实测。

## 实际结果与持久坐标

- 隔离根：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/1000-framework-e2e-tTeaWJ`，包含 163 篇正式页基线副本，解析问题 0。
- 批次：`3895c20b-11be-4200-8292-540668d0bef1`，状态 `collecting`，4 个材料、0 个问题。
- HTTP：首次录入 201、幂等重放 201 且批次 ID 不变、回读 200。四份不可变 raw 快照逐字节等于原材料，完整 SHA/原文地址/revision 已存于下方 JSON。
- 原工程正式页/图/raw、已审候选和原 210 次缓存共 2851 个受保护文件，前后摘要完全一致；聚合摘要 `205167aa29acb2438c741b695815c3f79b0c7b81868e3710d26fa001ec1618a0`。
- 执行：`node --import tsx %TEMP%/infra-wiki-review-20261115/1000-four-sample-intake.mts`，exit 0。证据：同目录 `1000-four-sample-intake.json`。模型调用 0（仅录入/读取路由；复核无 runs 目录、无预算账户），临时 HTTP 服务已在 `finally` 关闭。

本轮只证明材料录入、原文保存及幂等回读。整合、整组 Review、可恢复发布、静态阅读、新会话问答引用、答案保存和缺口回流仍须在最终工程版本上完成，不能以本记录替代全流程验收。后续沿此隔离根与批次继续，保留历史 042 根、缓存与旧 Review。

## 隔离基线完整门禁

2026-11-16 18:56 UTC，实际执行 `node --import tsx %TEMP%/infra-wiki-review-20261115/1000-four-sample-preflight.mts`，exit 0。对上述隔离根调用真实 `validateIntegration(root, configuredRepoRoots(root))`，返回 `issues: []`；批次仍为 `collecting`、`sourceCount: 4`，没有绕过验证函数。完整输出保存在 `1000-four-sample-preflight.json`。这是整合前基线门禁，不代表已完成整合或发布。

## 真实整合开始（尚未验收）

2026-11-16 19:12:40 UTC 起（首次模型调用实录），沿同一隔离根与批次运行 `1000-four-sample-integrate.mts`，调用生产 `startDrop`、默认 `selectedAgent` 与默认 `validateIntegration`，没有协议代理或验证绕过。使用项目既有 Codex CLI / `gpt-6.1-sol` / 128K 窗口；将本轮完整四份原文及 969/993/996 限定传入，要求只复用已有材料、保护旧事实/来源/生成区，不开展正文整改、不自动发布。

实际执行以 `testLimits.calls: 12` 设置第一检查点；新隔离预算账户仅作记账，不能把其 `maxCalls` 当作 Drop 的有效限流。启动凭证为隔离根内 `1000-real-integration-started.json`，结束后另写 `1000-integration-checkpoint-12.json`。19:15 UTC 回读显示 `running`、6 次已记录调用，仍在材料提取阶段。本节尚不证明整合或整组 Review 成功；原文录入阶段的“模型调用 0”仅适用于上节已注明的录入操作。

19:21:54 UTC 到达显式 12 次检查点，状态为 `failed`、错误仅为“显式测试调用限额到达；保留进度，尚未验收”，12 次调用均已完成且无 provider error，受保护原文件不变。核对后于 19:23 UTC 运行 `1000-four-sample-resume.mts 24`，仅传 `retry: true`，仍为 generation 1，复用已保存输入/输出与解析缓存，不变更材料、规则或重置预算；后续新增调用从第 13 次开始。下一检查点凭证使用新文件名 `1000-integration-checkpoint-24.json`，尚未到达发布审定。

## 后续检查点与范围核对

19:37:05 UTC 达到 24 次检查点，19:48:05 UTC 达到 48 次检查点。均因显式调用限额停止；生产调用已完成且无 provider error，原 2851 个文件与已有同代缓存字节未变。四份材料提取完成后进入分段知识发现及覆盖复核，尚无 Review。

48 次时发现模型在完整资源目录中定位既有图和冻结场景的保留依赖。未因此启动 3D 改造或验收，也未修改缓存或伪造依赖核验。沿同一 generation 1 限量续至 64 次后，模型完成该段发现并进入 coverage 复核：保留原场景引用，明确未核依赖，未把它伪报为通过。64 次仍仅因检查点停止；已有文件和缓存保持不变。随后以相同 retry 方式续至 88 次检查点；所有检查点与续跑凭证均使用不同文件名留在隔离根。

这些是真实项目 Codex CLI / ChatGPT 记账调用（accountingOnly、chargedUsd 为 0），并非零模型调用或确定性代理。还不能据此签署整合、整组 Review 或四类全流程通过。后续只审工程闭环及保留契约，不补写文章、不把冻结 3D 的重新核验设为本阶段前置。

20:17:48 UTC 达到 112 次检查点，随后已核对 88 与 112 次凭证：112 次停在量化材料一段 coverage 复核之后，仍有后续段，尚不能称整篇量化材料完成；仍仅因显式限额退出，原文件和已有缓存摘要不变。概念材料已完成发现与复核，量化材料在逐段推进，并非重复旧调用。继续同代 retry 至 136 次检查点；测试脚本原 120 次上界是本轮自设检查护栏，并非用户预算，此次仅扩展到下一个 24 次检查点，不修改生产模型、费用策略或已封存输入输出。

20:26:47 UTC 到达 136 次检查点。量化、参数材料分别继续完成发现/覆盖复核，排障材料也随后推进；继续有界续至 160 次。该轮实际在 151 次、20:31:24 UTC 提前失败：四类发现与覆盖已完成，chunked-prefill 的比较复核收到相互矛盾的预算协商指令。宿主提示允许依据已核范围回答，随后却无条件拒绝结论。`1036-e2e-negotiation-review.md` 记录此 P2 和完整封存帧；20:38:37 UTC 同批零新模型调用重放再次复现（`newAgentCalls=0`、原调用记录/缓存不变）。本批仍为 generation 1、151 次实际模型调用、无 Review，等待同作者工程修复后接原断点，不重开材料、不删除缓存、不放宽原文门禁。
