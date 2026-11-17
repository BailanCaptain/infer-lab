# 1075 参数身份底层复审：Changes Requested

2026-11-16 23:02 UTC，砚砚。0 P1 / 2 P2；仅为当前参数身份子段结论，044 仍未完成。作者交付 `0001794869982376-001075-238ac553`；审阅 `pages.ts` SHA `84a78d12686690e8fc66db4d20043cc7cca5737de229d306d0791da9f24320a8` 与 `identities.ts` `9c52577ab61e400d9d3199b5e89519d5e024981e48531668f42f794bb94bcf99`。相关前序实证保留于 `1060-param-identity-inprogress-review.md`。

## P2-1：固定定义缺失时仍以标题和默认值确认错误身份

`scripts/wiki/params/pages.ts` 的 `isConfirmedExistingPage` 在历史 Git 定义不可读且 commit 改变时，退回 `old.data.title === entry.name`、`type` 和 `default` 比较。这些字段不能区分同文件、同名的不同类；替换 frontmatter ID 后，即使旧页实际属于另一类，也可把待确认 entry 当成已确认参数。

独立 `1073-param-legacy-context-matrix.mts 1073-param-legacy-context-red.json` 实跑 exit 1：两个类均声明 `size: int = 1`，无旧源码上下文的错误类被放行。相同输入在传入真实 `repoDir` 后正确拒绝；合法类跨 commit 行号迁移及两向旧命名绑定对照均正常，共 5 项仅此项失败。因而无须放宽正例或保留猜测回退；真实调用方提供现有固定仓上下文，信息不足时明确拒绝。

`resolveParamRepoDir` 的 configured → `root/<repo>` → `root/repo` 夹具路径回退也不应进入生产规则。固定来源身份应由单一恢复入口验证 repo、commit、file、class 与参数路径；测试使用真实种子配置或显式上下文，不能让夹具缺省约定替代生产来源。

## P2-2：新加元数据使同版本旧页无法正常进入 prose intake

`scripts/wiki/params/pages.ts` 构造生成区时无条件给普通类字段增加“所属类”行，`scripts/wiki/params/ingest.ts:41` 随即比较生成区字节。对未含该行的旧合法页面，同 commit、同 entry 也误报“参数定义与本次快照不同”，尚未调用模型就退出。

独立 `1071-param-legacy-ingest.mts 1071-param-legacy-ingest-seeded-red.json` 使用真实 Git 与有效 seeds，exit 1、模型调用 0、已发布副本未变。修复须保留同版本旧生成区原字节，并从固定来源核身份；不得以先修改正式文章补一行作为前提，也不得绕过真实定义切换保护。此为工程兼容修复，非阶段二文章整改。

## 已保留的通过证据与接续

root `1074-param-binding-corpus-inprogress.json` 实测当前 identities 字节下 430 个扫描项与改前绑定均无回归；仅在内存改变展示标题也无绑定变化，163 篇正式页摘要未变。`use-layerwise` 合法旧标识的定义恢复问题已在前轮独立关闭，28 / 33 与改前一致。

作者已在 1077 同任务短轮接收 1070–1074 的详细证据，直接完成上述两项，不重复开启另一实现者。收口后根审再验拒绝与合法对照、真实 ingest/publish/CLI、原绑定语料及静态门禁。UI、AST、失败回执修复仍分后续子段；正式文章、缓存、3D 和原服务不变。待用户决定事项：无。
# 23:12 UTC 同轮补充：完整身份校验还缺文件范围

1077 当前 `pages.ts=226976f8…`、`identities.ts=24252efb…` 上，1073 的同值异类 5 项与 1071 的同版本旧页 ingest 均已由 root 独立转绿；430 条真实参数记录的绑定和显示标题变化检查也无回归。这些结果保留，不重开已闭合的反例。

但 P2-1 的同根范围仍遗漏 `file`：`matchesBoundParamTarget` 对有类行只比较类名，对旧无类行恢复 Git 定义后也只比较类名，未验证定义文件。隔离两个文件 `a_config.py` / `b_config.py` 都定义 `Config.size: int = 1`，将 A 的 `role: definition` 显式绑定指向 B 的 `legacy-b-size` 页，当前两种旧页格式都错误返回 B 的稳定 ID。这会让同步发布将另一个文件中的参数写入该旧页。

稳定复现：`%TEMP%/infra-wiki-review-20261115/1080-param-binding-file-scope.mts 1080-param-binding-file-scope-red.json`，exit 1，2 个合法同文件对照通过、2 个跨文件绑定均漏拦；0 供应商调用、0 正式写入。请沿当前“文件/类/路径完整身份”的同一修复收口，比较已确认的完整身份，不再逐次增加单字段 fallback；`role: reference` 的有意跨文件引用语义须保留。现行 430 条绑定语料是兼容性对照，不能通过修改正式映射或文章规避。

