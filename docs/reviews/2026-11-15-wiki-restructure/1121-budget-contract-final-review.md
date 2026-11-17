# 预算响应契约与历史缓存独立终验

2026-11-17 01:08 UTC，砚砚。原 Task 044 / 1116–1121 工程短轮，结论：**Approved，0 P1 / 0 P2**。本结论仅覆盖预算响应契约、对应预算计算和历史缓存兼容；不代表四类真实模型流程或第一阶段已完成。

## 审定字节与根因

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/drop-integration.ts` | `aafb3257895c1afd65696ce52c4b808603079e42eb9b58cfe4c19693b69fc6eb` |
| `scripts/wiki/drop-convergence.test.ts` | `1851fc56439291f31da9681c010b91463dec9598569f54829b4a4844fddd0c97` |
| 已审且未改的 `scripts/wiki/drop-run.ts` | `651bcf7015b385901a102891c7fbb76576457aab422561b95835d81e8cd3e022` |

共享工作区 HEAD 为 `f44c953f99e416b2dc174c3b2ad31a729b91d30f`，实际审查以表中未提交文件字节为准。作者为烁烁；本次砚砚未修改生产代码。

`budgetRequiresRequest` 同时决定实际发送的规则和响应 schema，普通阶段在预算协商时明确只接受 request；已封存且无待核项的发现阶段保留合法收敛。预算根据最终实际规则重新计算，正文 JSON、导航 limit 和宿主断言一致。旧协商帧仅在原响应通过当前 schema 且原规则预算允许时复用；新帧使用新契约。v3 现沿同一候选选择入口恢复 pre-1108 合法缓存。v4 的有限候选分别对应已存在的历史帧版本，服务于旧批次复用，不在失效后盲发旧协议或吞错。

## 独立复验

- `1116-v3-budget-cache-probe.mts 1121-root-v3-budget-cache-green.json`：exit 0。临时导出的真实 `DropSession.exchange` 与只恢复旧规则文本的控制组对照，普通帧、合法协商 request 帧、后续原文帧全部复用，续跑新增执行为 0。原 `1116-v3-budget-cache-current.json` 的一次协商重跑红灯保留未覆盖。
- `1116-budget-contract-probe.mts 1121-root-budget-contract-final.json`：exit 0。原 174 次批次的两个隔离克隆分别验证提前结论拒绝和正确 request 续进。实际首帧 73,718 B，上限 100,123 B；下一正常原文帧 40,351 B，上限 100,826 B。提前结论未形成合法缓存；原批次、前 174 次记录和全部旧回执原字节不变。零真实 provider 调用，此项不冒充语义验收。
- `1121-root-budget-regression.log`：6 套测试首跑为 53 passed / 2 failed，exit 1。两项均为新增测试夹具：未稳定进入预算分支，以及固定 50000 越界；5 套未失败文件为 45/45。后续 `1123-root-budget-fixture-recheck.log` 明确暴露手工旧缓存缺原始 `input-<digest>.json`。这些红灯均保留。
- 最终 `vitest run scripts/wiki/drop-convergence.test.ts --reporter=dot`：**10/10，exit 0**，13.43 秒，见 `1124-root-budget-convergence-final.log`。测试明确断言实际捕获非空；完整 caller 覆盖 v3/v4 合法旧 request 命中、非法旧结论拒绝且缓存原文不变、协商后真实切片装入、实际规则与输入预算一致及发现阶段已封存收敛。与前述其余 45 项合计覆盖 55 个不同测试，不将两次运行写成一次全绿命令。
- 最终 `tsc -b tsconfig.json --noEmit --pretty false`：exit 0，`1124-root-budget-typecheck-final.log`；两个文件只读 Biome 检查和依赖方向检查 exit 0。
- 前一生产版本的 `1116-root-cache210.json` 已证明 210 次封存批次的首个未缓存输入保持原摘要 `885c8172…`、旧缓存不变。本次生产差异只为 v3 增加已有候选入口，v4 历史分支未变，未重复该全批回放。此历史探针的 validation override 仅用于缓存协议比对，不能作为真实整合验收。

## 保护与后续

`1121-phase1-preservation.json` 于 00:59 UTC 核实 891 份历史运行材料、398 个冻结文件与 2851 份正式资料/旧缓存全部不变，原 4173 / 4174 / 4196 服务均 HTTP 200。已审 1107 调用回执与 1114 coverage 成果继续有效。

可恢复原 174 次、generation 1 的真实隔离批次，保持默认验证、独立 Review 和可恢复发布，不重建 attempt 或删改旧缓存。随后继续原 044 参数展示、来源编号、AST 只读预演及四类工程全流程；文章整改、第二阶段及四个独立产品仍待用户另行指示。阶段一最后独立签署后停止派工并保留站点服务。

全部独立探针、日志与摘要位于 `C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`。无新增用户决策。
