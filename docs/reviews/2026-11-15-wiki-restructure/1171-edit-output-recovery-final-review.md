# 1171 编辑输出定点恢复独立终验

结论：**Approved，0 P1 / 0 P2，仅本工程子批**。`1160-edit-output-recovery-review.md` 的唯一 P2 已闭合；四类真实模型全流程与 AST 工具仍待完成，阶段一尚未签署。作者交付：`0001794890014954-001171-e8b6b7ff`；独立审阅：砚砚 / gpt-6-astra。

## 最终实现与锁定字节

`drop-context.ts:184` 提取共同 `validateDropEdits`，即时校验绑定候选 hash、当前分片范围、累计编辑的原文匹配、重叠及 UTF-16 代理对边界。`drop-integration.ts:3836` 在每个分片返回后、合并编辑和图资源之前调用；出错时仍定位当前片段，使用现有有界修复机制。`applyDropEdits` 最终再次复用相同检查；不移动偏移、不丢弃编辑、不改写旧缓存、不换代。

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/drop-context.ts` | `ab5fa469d0995e99a3c4ac0ae6a4c44d218eefd8e5100cee121babb8f3c052ab` |
| `scripts/wiki/drop-integration.ts` | `9d8c03feba93b32b589fbbafe8d7e654d82c37f87a3c85239bf0e518a1554ee0` |
| `scripts/wiki/drop-convergence.test.ts` | `572cd0252c7fae5a4d529e9fef12859dc627ad076359c9275da942365e777b81` |
| `scripts/wiki/drop-run.ts`（未改） | `651bcf7015b385901a102891c7fbb76576457aab422561b95835d81e8cd3e022` |

## root 实际验证

证据目录：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`。

- `1168-root-edit-repair.json` / `1168-root-edit-repair-command.json`：运行原真实 271 次批次的隔离克隆，**8/8 检查通过、exit 0**。首个新帧准确修复 contribution 0 的 `[3792,5212)`，带第 260 次错误输出及明确原文不匹配理由，24,167B ≤ 26,424B；原 rules、notes、materials 保持；随后复用后续缓存并进入 contribution 1。271 条旧调用、原缓存、原批次及 generation 1 均未变。
- `1170-edit-target-final.json/log`：两项新增用例 **2/2 通过、exit 0**，覆盖错误原文、跨片与片内重叠、代理对边界、前序缓存不重跑、后续片不提前执行及有界失败。
- `1170-edit-convergence-final.json/log`：最终测试字节整套 **14/14 通过、exit 0**。此前夹具把补充文字插入旧行内部，违反其声明的 supplement 保留契约；作者改成段落边界合法插入，未放宽正文保护。`1168-root-edit-tests.log`、`1169-edit-target-test.log` 的失败证据保留。
- `1168-root-edit-tests.json/log` 中另两套 `drop-context` / `drop-run` 已通过；`1169-edit-integration-tests.json/log` 的 `drop-integration` / `drop-receipt` / `server/drop` **37/37 通过、exit 0**。结合最终收敛套件，本次关联 **6 个套件、61 个不同测试**通过；重复执行的两个定向用例不重复计数。
- `1169-edit-recovery-types.json`、`1169-edit-recovery-biome.json`、`1169-edit-recovery-deps.json` 均 exit 0。最终夹具字节另执行只读 `biome check scripts/wiki/drop-convergence.test.ts`，exit 0、无修改。生产字节在这些验证期间未变。

克隆使用受控 runner，**零真实模型调用**；其中终态 failed 来自探针在下一贡献的主动 `ROOT_CONTROLLED_STOP`，不等于完整 E2E 已完成。原错误回放红灯保留，作者另有 `1166-author-edit-repair-green.json` 相互印证，未拿作者结果替代上述 root 实测。

## 后续边界

可以在新的本子批批准清单下恢复原隔离批次 `3895c20b-11be-4200-8292-540668d0bef1` 的 generation 1，从原 271 次继续真实模型整合；保留此前预算和微分片批准清单，不自动批准 Review。AST 三项 P2 及隔离 apply 仍由原作者下一独立短轮处理。

本结论不允许修改正式文章、旧 Review、210 缓存或冻结资产；文章整改与新产品仍留后续。阶段一全部工程和四类真实闭环最后独立签署后停工，现有站点服务继续保留。
