# 1196 AST 隔离演练准备记录

已审只读入口在完整正式库实际运行成功；此记录只封存计划与隔离副本，**尚未执行 apply，也不授权修改正式文章**。只读子批结论见 `1192-ast-readonly-final-review.md`。

- 实际命令：`node --import tsx scripts/wiki-ast-migrate.ts --wiki-root wiki --out %TEMP%/infra-wiki-review-20261115/1196-ast-readonly-163.json --dry-run`。
- `1196-ast-plan-command.json/log`：2026-11-17 05:32:09–05:33:52 UTC，exit 0，耗时约 103 秒；本轮不以临时性能猜测替代实际结果。
- 计划 SHA-256：`8b0d354a1517af2ed7d0675840369a0e0b511dac17315e7247f08686a1eeaf81`，163 页。
- `1196-prepare-ast-apply-copy.mjs` 实跑 exit 0；目标 `%TEMP%/infra-wiki-review-20261115/1196-ast-apply-oLooEU/wiki`，163 篇输入均与原正式文件逐字节哈希一致。
- `1196-ast-apply-copy.json` 保存计划哈希、每篇输入/副本哈希及预期输出哈希。未执行迁移写入；原正文没有修改。

后续沿原 Task 044 验收显式 apply：在上述隔离目标应用同一计划，全批写入前验证输入与计划，损坏/过期计划必须零写入；输出须逐篇匹配计划，重复应用及再规划须幂等。继续保护 BOM、行尾、来源、生成区、代码/公式/HTML、链接锚点与 3D。文章整理与人工待办留第二阶段，不是第一阶段通过条件。

当前作者按 1196 派工先处理 1179 协商预算 P2；没有并发派入 AST 写入开发。真实样本仍保留 generation 1、312 次断点，阶段一尚未签署。

05:51 UTC 的 `1199-phase1-preservation.json` 再次实测 exit 0：891 个历史运行文件及 398 个冻结文件无变化，2,851 份正式资料/封存缓存摘要仍为 `205167aa29acb2438c741b695815c3f79b0c7b81868e3710d26fa001ec1618a0`；4173、4174、4196 既有服务均 HTTP 200，入口资源与此前一致。
