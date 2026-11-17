# 044 参数身份与谱系底座独立终验

2026-11-16 23:21 UTC，砚砚独立检视当前在盘字节。**Approved，0 P1 / 0 P2，仅本底座短段**。1079/1082 的跨文件 definition 错绑关闭；本结论不代表 044 的展示 UI、AST 工具或阶段一全部完成。

## 改动与适用边界

参数展示标题不再参与受保护定义的身份恢复。`matchesConfirmedParamDefinition` 是已确认参数页刷新与显式 definition 绑定的共用入口，核对仓库、固定来源、文件、类及路径（保留有证据的旧路径兼容）。同版本固定行保持有效；跨版本旧无类行页依靠实际 Git blob 恢复，无法取得上下文时不靠标题、默认值、哈希或猜测目录放行。显式 reference 仍只标记引用，不生成第二篇参数页。

`ingestParam`、同步发布及骨架 CLI 均传入配置中或调用方实际持有的仓库根。同版本旧生成区不强加新的类行，原保护区字节检查保留。谱系 CLI 按固定定义定位；显示名和规范 ID 不互相替代。新实现未修改正式参数文章、身份映射或教学正文。

## 独立证据

全部产物位于 `%TEMP%/infra-wiki-review-20261115`，原红灯保留：

- `1083-root-file-scope-green.json`：4/4，带类行和无类行两种跨文件错绑拒绝、两个同文件对照接受。
- `1083-root-identity-adversarial-green.json`：17/17，展示名变化、固定定义、未审疑似项、错误 ID、损坏引用、reference 等正反例通过。
- `1083-root-legacy-context-green.json`：5/5，同值异类有/无仓库上下文均拒绝，合法跨版本行迁移通过。
- `1083-root-legacy-ingest-green.json`：真实 `ingestParam` 路径 3/3，旧保护区与发布页保持原字节；确定性代理 1 次，真实供应商 0 次。
- `1083-root-binding-corpus-green.json`：真实 430 条扫描记录相对改造前无绑定回归；只改变内存显示标题后绑定不变；163 篇正式页 SHA 不变。
- root Vitest `1083-root-param-regression.log`：8 files / 38 tests，exit 0，77.51s。覆盖 pages、identities、provenance、ingest、publish-sync、cli、sync-cli、lineage-apply。全仓类型与依赖方向检查 exit 0。
- 全仓只读 `biome check .`：660 files，exit 0，0 errors；29 warnings / 6 infos 如实保留（`1083-root-full-biome-final.log`）。一份旧 root 探针 JSON 的格式错误已单独规范化，原始字节保存在 `1083-825-legacy-adversarial-original.json`，深比较确认 JSON 值完全相同，证据 `1083-record-format-verification.json`；没有混入生产修复。
- 未变谱系/恢复链继续沿用本轮实跑：`1082-param-lineage-cli.json`（两类同名字段的真实隔离 CLI 两次运行，第二次无写入）；`1060-root-final-definition-corpus.json`（28/33 与旧实现一致）。其余 5 页为既有资料不足，不伪造定义，留待二阶段文章核对。

## 锁定字节

完整 13 文件 SHA-256 清单：`1083-root-param-hashes.json`（23:20:29 UTC）。核心：

| 文件 | SHA-256 |
| --- | --- |
| scripts/wiki/params/pages.ts | b625e04e2649723f850b115bc0c6b0590da9d035975df49e706ff61839808a37 |
| scripts/wiki/params/identities.ts | 591fe403d859a801ecdc55c591c3f2d87d667cf52a80f8087d4d06ae43b7d27b |
| scripts/wiki/params/provenance.ts | 8c4d9bf8d697d1ed313de1ba14be8a58603d85228f2142aac1d3fbb21cbc430b |
| scripts/wiki/params/ingest.ts | 666871c77b1c6fcc35beee0a96423237c9c02909a92b604496044d8f5257baaf |
| scripts/wiki/params/publish-sync.ts | 5df010c9ccac14c8c6a22654f6f1bdbfe31d212813a5abe9a350f9dbc1c77ea6 |
| scripts/wiki-build-param-pages.ts | c00be439051ebbc83cfb551832d199f43cd0262ad5dba90f280dce65af25efa3 |
| scripts/wiki-lineage-apply.ts | f8ebb798be25bb222a4b39ae9176e178f034b0cbfcad338ce9d9737799be890d |
| scripts/wiki-lineage.ts | 61db023384d6c71c19016850322c89490af1ebca6fe12c389dc75f8553e55ef2 |

下一短段先用原 1038 任务关闭失败原始响应覆盖问题，再恢复第 173 次真实批次。044 剩余展示 UI/AST 以及 045 来源编号回归继续按原任务执行；文章整改、后续独立产品和正式迁移应用均不进入阶段一。第一阶段终签后停派，服务保留。
