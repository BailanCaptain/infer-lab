# 参数身份底座 1079 独立复审

2026-11-16 23:15 UTC，砚砚独立检视。**Changes Requested，0 P1 / 1 P2**。本结论取代 1078 对旧一批字节的“两项未闭合”描述；仅保留 1082 已发送的同根文件范围遗漏，不重复处理原反例。

## 已实证闭合

- `pages.ts=226976f8650d8a549b1580bf375749193ac4a02d6e66252714f7d676b7eb82bf`，`identities.ts=24252efb7c61a515869c1cb8277acc8fb5854792a4948051cfc5f7c32eb5076a`，`ingest.ts=666871c77b1c6fcc35beee0a96423237c9c02909a92b604496044d8f5257baaf`。逐项回读真实调用方 `publish-sync.ts` 与 `wiki-build-param-pages.ts` 已传入受配置约束的仓库上下文，原目录、哈希及类型/默认值猜测回退已移除。
- `1073-param-legacy-context-matrix.mts 1079-param-identity-inprogress.json`：exit 0，5/5；合法跨提交行迁移保留，同值异类在有/无旧仓库上下文时均拒绝。
- `1071-param-legacy-ingest.mts 1079-param-ingest-inprogress.json`：exit 0，3/3；真实 `ingestParam` 调用成功，旧自动定义区与正式页字节保持，供应商调用 0。
- root Vitest 8 套、37 项全部通过：pages / identities / provenance / ingest / publish-sync / cli / sync-cli / lineage-apply，exit 0，79.99s。日志 `1079-root-param-regression.log`。全仓 `tsc -b tsconfig.json --noEmit --pretty false` exit 0。
- `1079-param-binding-corpus.json`：430 条真实扫描记录对照旧实现无绑定回归；仅变更内存展示标题不改变绑定；163 篇正式页未变。
- `1060-root-final-definition-corpus.json`：33 参数页中 28 页可恢复，与旧实现相同；5 项既有资料不足留待二阶段，不能伪造身份。`1082-param-lineage-cli.json`：实际隔离 CLI 两类同名字段分别计算谱系，第二次执行无写入，ID、标题及固定定义保留。

## P2：definition 映射未验证定义文件

`scripts/wiki/params/identities.ts` 的 `matchesBoundParamTarget` 对显式类行只比较类名，对旧无类行从 Git 恢复条目后也只比较类名。两个不同文件都定义 `Config.size: int = 1` 时，A 文件 `role: definition` 的绑定能指向 B 文件的旧页，随后同步路径可以把 A 参数写入 B 稳定 URL。`file` 本来就是 `parameterKey` 的身份维度，不能被叶名与类名相同代替。

复现：`1080-param-binding-file-scope.mts 1080-param-binding-file-scope-red.json`，exit 1；2 个同文件对照通过，带类行与无类行两种跨文件绑定均错误接受。固定字节与 1079 完全一致，0 正式写入、0 供应商调用。修复应在共享身份判定中核对文件/类/路径（保留有证据的旧路径兼容），并保留显式 `reference` 跨文件引用语义；不得改正式绑定或正文迁就实现。

原 1073 / 1071 绿灯不撤销；新修复只需针对受影响入口补充反例，并复验 430 条既有身份兼容。参数展示 UI、AST 工具、1038 失败回执仍是后续工程短段；阶段一未通过，文档内容整改不作为本阶段条件。
