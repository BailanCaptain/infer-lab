# 044 参数身份短段：在盘独立反例

2026-11-16 22:20 UTC，砚砚。作者仍在 1056 短段实现中；以下是当前字节的可复现问题，不是整批最终验收。两个 P2 应在本短段闭合，正式文章不作整改。

**22:28 UTC 正式交付复审：Changes Requested，0 P1 / 2 P2。** 已完整读取作者 1062 交付，九个文件摘要与交付一致；上述两个问题仍存在，沿用本文和原反例，不增加新范围。独立生产 CLI 探针 `1056-param-lineage-cli.mts 1060-param-lineage-cli-inprogress.json` 已实际 exit 0：两个同名字段各自的版本有/无结论、类范围、标题/ID/固定段保留、二次执行幂等全部通过，不能以该正向路径覆盖下文的反例。

本次独立结论以实际 diff、固定 Git 反例和真实现有页恢复对比为据；作者报告的 15 文件/67 项测试与静态门禁作为作者交付记录，不冒充 root 本轮执行。两项 P2 修复后再运行定向回归和最终摘要核验。

## P2：同名尾字段仍可混淆两个定义

`scripts/wiki/params/pages.ts` 的 `isConfirmedExistingPage` 接受相同 `json_path` 或相同定义文件；`scripts/wiki/params/identities.ts` 的 `matchesBoundParamTarget` 对普通路径主要比较尾字段，并仅在另一个 natural ID 页面也存在时拒绝跨绑。同文件的两个类都可能被静态扫描成 `additional_config["size"]`，这些条件不足以恢复完整身份。

独立固定 Git blob 含 `FirstConfig.size` 和 `SecondConfig.size`，稳定 ID 分别为 `size-07e203a0d7f0` 与 `size-c6888fde1a31`：

- `1056-param-identity-adversarial.mts 1060-param-identity-inprogress.json`：exit 1，16/17 通过。把第二个定义的旧页换成第一个页面 ID 后，仍能冒充已确认旧页刷新。
- `1060-param-identity-matrix.mts 1060-param-identity-matrix-red.json`：exit 1。显式绑定指向错误类的页面、且库存只有该错误目标页时，两方向都被接受。入口不应依赖“正确页也刚好在库存中”才保护错误绑定。

后一探针运行前后生产 SHA 不变：`pages.ts` 为 `313ce5d8ba842f7eac9f1a5dc0f342dccba1ec592c15081140917198e5b04f3d`；`identities.ts` 为 `3cd87fd24f8a5bba1f1057236ab7baa2dd2464df06923f1fdbab1ecdcc9e79cd`。两个探针只写隔离夹具，正式库零写入。

## P2：合法旧标识与扫描表示不同，新增谱系回归

对 33 篇正式参数页调用只读固定定义恢复：HEAD 旧入口恢复 28 页，当前 `provenance.ts`（`e0c1eae3c407cc9950ff126ef43d86f940413fc061c923b7ee4b0e8265288d90`）恢复 27 页。唯一新增失败是 `use-layerwise-b475778cd352`。

该页固定来源指向 `YuanrongConfig.use_layerwise` 的精确文件和第 20 行，生成区标识为 `YuanrongConfig["use_layerwise"]`；现扫描器返回同一类、文件、行和字段，但其路径字符串为 `additional_config["use_layerwise"]`。直接要求字符串相等导致拒绝原本可恢复的定义。必须兼容可证明的同一身份，不能改文章、删掉类约束或用尾字段泛匹配代替。本文不认证它与连接器公共配置入口相同，现有文章明确区分二者。

证据：`1060-param-definition-corpus.mts` 的两份只读输出 `1060-param-definition-head.json` 与 `1060-param-definition-corpus-baseline.json`。后者名字含 baseline，但实际是 22:16 的新代码在盘取样；前者才是通过 `git show HEAD:scripts/wiki/params/provenance.ts` 恢复的改前函数，依赖的固定段提取、Git 读取与扫描语义未变。两次正式页摘要均未变化。其余五项未恢复情况改前已有，不作为此次内容整改要求。

## 后续展示的只读依据

`1060-param-display-inventory.mts 1060-param-display-baseline.json` 实读 163 页，其中 33 页是参数页、32 页有生成区身份、10 页有显式定义绑定。`KVPPConfig.size` 与 `AscendConfig.kvpp_config` 明确属于“字段身份（不代表用户输入入口）”；不能从别名推断成可写输入路径。`profiling-chunk-config` 无生成区身份，应保留现有标题语义，不猜父级。

后续展示应复用明确身份信息，在页头、目录、检索与链接呈现同一结果，稳定 ID、文件名、旧搜索入口、固定来源和生成区保留。来源不足处诚实保留原显示；阶段一不补正文、不改正式 frontmatter。上述临时脚本与 JSON 均位于 `C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`，原红灯保留。

1062 提供的路径分类可用于下一段呈现设计；其中 `userWritable: true` 不能仅由 `additional_config` 或类字典路径的语法推出。当前尚未接线，不另计一个实现问题；后续应显示可证明的路径/字段类别，真实可写能力继续以已有事实为准，不能把展示规则当能力认证。

## 1064 返修中：旧格式与跨版本的同根反例

2026-11-16 22:42:37 UTC，`1064-param-legacy-matrix.mts 1064-param-legacy-matrix-red.json` 实际 exit 1，四项中三项仍失败。取样 `pages.ts=5e32954ff8648c510f6a968cf788d6458dfc3f374ce57f4df4430fe43138127e`、`identities.ts=70db7ebfbecd1937519fdf08ccedbdee95786ae93bf2d94e6dfcf846c3df1b2e`，运行前后摘要一致，正式库零写入。

本轮新增的“所属类”行有助于新产物，但旧正式页没有该行，不能依靠重写文章来补齐。探针保留旧生成区格式（仅移除新生成器刚新增的类行，其他固定来源与原文保留），使用两个真实固定 Git 提交；第二个提交只在文件开头插入空行：合法旧身份跨版本行移动能正常刷新，作为正向对照；错误第二类旧页换成第一类 ID 后，跨提交刷新仍被接受。同名叶子字段通过显式绑定指向另一类的旧命名 ID（不带 12 位哈希）、库存只有该错误目标页时，两个方向也均被接受。

这仍是前述 P2-1 的完整身份恢复问题，不另扩范围：同提交行号检查、哈希 ID 推测和仅给新产物加字段，均不能代替已有固定定义的身份依据。不能以新生成器生成的新格式测试全绿来覆盖旧格式兼容；修复同时应保留合法行移动、430 条现有绑定及旧版本定义恢复。

**1067 正式交付复审（2026-11-16 22:48 UTC）：Changes Requested，0 P1 / 1 P2。** 交付的生产摘要与上述反例一致，P2-1 尚未闭合。P2-2 由 root 实际运行 `1060-param-definition-corpus.mts 1060-root-param-definition-green.json` 复验，exit 0：28/33 可恢复，`use-layerwise-b475778cd352` 成功，其余五项与改前完全相同；`provenance.ts=8c4d9bf8d697d1ed313de1ba14be8a58603d85228f2142aac1d3fbb21cbc430b` 运行前后不变，正式页摘要未变。1066 已将旧格式反例交同作者当前短轮，继续处理这一项完整身份问题，不提前启动 UI 或 AST。
# 1071 补充：旧格式同版本真实 ingest 路径

22:58 UTC，`1073-param-legacy-context-matrix.mts 1073-param-legacy-context-red.json` 在新 Git 夹具提供真实旧 commit 上下文，合法行号迁移、带上下文错误旧类、两向配置仓绑定共四项均正确；仅“未提供旧 blob 上下文，两个类同名且类型/默认值相同”的拒绝用例仍失败。当前 `pages.ts` `84a78d12…` / `identities.ts` `9c52577a…` 在缺少旧仓上下文时按旧标题、类型、默认值和替换过的 ID 放行了错误类。这是同一 P2 的剩余路径，证明应删除缺证据的猜测回退，而不是让测试依赖不同默认值。

2026-11-16 22:54 UTC，`1071-param-legacy-ingest.mts 1071-param-legacy-ingest-red.json` 在独立真实 Git 夹具复现同根兼容问题（exit 1，0 次模型调用，正式库零写入）：同一 commit、同一 entry 的旧生成区缺少本轮新加“所属类”行，`ingestParam` 重新生成 skeleton 后在 `ingest.ts:41` 的保护区字节比较失败，报“参数定义与本次快照不同”。此时定义本身完全未变。原已发布夹具仍未改动，失败发生于代理调用前。

这是旧格式完整身份修复必须保留的真实调用兼容性，不要求整改任何正式文章。新身份验证应利用固定来源恢复上下文，并保留同版本原生成区字节；不能为了强加元数据而让旧页失去原有处理能力。该探针和此前三个拒绝串绑反例同属 1069 当前短轮验证，不另开任务。

