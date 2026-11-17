# 参数展示与迁移验收的只读补充基线

2026-11-17 00:27 UTC，砚砚。这是原 044 后续工程验收输入，不是新方案、内容整改或通过结论。当前预算响应契约子批继续优先，尚未派入展示实现。

## 参数显示的真实依据

`1090-param-display-baseline.json` 取扫描恢复数据作为初始样本，但其 `size` 预期与“派生字段不冒充用户输入入口”的约束存在冲突。正式 `wiki/params/size-40a1c2ca47b8.md:161` 明确记录 `字段身份（不代表用户输入入口） | KVPPConfig.size`，扫描器的 `additional_config["kvpp_config"]["size"]` 仅为 suspect 推断。因此验收预期校正为 **`KVPPConfig.size`**，不能要求 UI 输出推测配置路径。

`1118-display-oracle.mts` 只读解析既有受保护自动区，另存 `1118-param-display-oracle.json`，旧基线和旧红灯不覆盖。四个样本预期：

| 稳定 ID | 展示名称 | 依据 |
| --- | --- | --- |
| `size-40a1c2ca47b8` | `KVPPConfig.size` | 明确字段身份；不声称可写配置 |
| `enable-super-kernel-ce990e186bfa` | `ascend_compilation_config.enable_super_kernel` | 固定自动区 JSON 路径的 parent / leaf |
| `absolute-balance-threshold-71578a0c428d` | `stair_config.absolute_balance_threshold` | 固定自动区 JSON 路径的 parent / leaf |
| `profiling-chunk-config` | `动态切块配置（profiling_chunk_config）` | 无可确认自动区，保留原标题 |

`1118-param-display-browser.mjs 1064-desktop-regression.json 1118-param-display-corrected-red` 在隔离生产构建、随机端口、1440×900 Chromium 真实执行，exit 1：前三页页头 / 目录 / 搜索仍为 leaf，面包屑仍未显示当前页；手写参数页原标题保持；四页 ID、query 及正式文件 SHA 全保持，浏览器异常为空，服务和浏览器均关闭。报告 / 截图 `1118-param-display-corrected-red.{json,png}` 保留。未来应在新隔离构建跑同一探针，并补旧链接、锚点与历史、实时快照、来源证据及搜索懒加载回归；不改正式 frontmatter、正文、registry 或参数文件 ID 来“完成”显示功能。

## AST 工具的解析边界

- `1119-ast-section-inventory.json` 只读扫描 163 页，原 SHA 不变；按实际 H2 范围计数，1,212 处纯文本来源表达在 `## 对照源码`，54 处在其他位置。该数字只表示位置，不是可自动迁移数量。不能把正文中的所有“来源 N”无差别改为机器角标，破坏主干 `prose-marks` 约束；参数事实表例外需单独判断。
- 自动生成区应保护到下一个同级 H2，复用现有 `generatedSection` 语义；旧 993 库存探针以第一自动区保护到全文末尾，属于粗略库存口径，不能照抄为迁移规则。
- `1100-ast-reference-disambiguation.json` 已核实五例“来源 8，657–693”等后半数字为源码行号；不能展开为来源编号。真实“来源 32–34”才是来源序号范围。上下文不能确定时报告人工处理，保留原文。
- 保留 frontmatter、来源顺序及编号、自动区、代码 / 公式 / 链接 / HTML / 3D fence 的字节；版本适用条件不得随标签搬离原结论。只读计划必须有前后摘要、位置与原因，隔离 apply 必须可重复且幂等，预期以源文件摘要校验避免对已变化文件套用旧计划。

上述是工具与验证要求，不要求第一阶段整改任何文章。正式页只做预演；实际应用、审阅、发布演练使用隔离副本，内容判断与整理留第二阶段。没有新增用户决策。

证据目录：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`。
