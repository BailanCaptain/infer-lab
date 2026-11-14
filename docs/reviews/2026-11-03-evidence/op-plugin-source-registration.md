# op-plugin 固定来源登记

通信量化页补读了 Ascend 官方 op-plugin 的固定文档 `aed3889c79923863fc9bfb36105cd6f577508cde/docs/zh/custom_APIs/torch_npu/torch_npu-npu_moe_distribute_combine_v2.md` 第 1–408 行。它定义模式 2/3/4 及 A2、A3、950DT 条件；页面保留其快照边界，不声称旧容器支持。对应 hiascend 页面本轮仅取得网页外壳，相同 pin 的 gitee 路径返回 404，因此引用实际取得并阅读的官方 GitHub 原件。

发布检查原先将此文件判为 `unlisted`。遵循 HANDBOOK 的新增权威来源同步要求，仅登记此完整路径为官方来源，同时同步 HANDBOOK。未扩展至整个组织或仓库，未调整证据级别和拦截规则。既有“通信依赖”参数化测试限定 `Ascend/pytorch`，保持原有全部依赖文件覆盖；新增 op-plugin 用独立测试覆盖其官方分类和负例。

实际验证：

- 红：`pnpm exec vitest run scripts/wiki/sources.test.ts`，新增用例 expected official / received unlisted；其余 43 项通过。日志 `.tmp/wiki-evidence-2026-11-03/op-plugin-red.txt`。
- 绿：`pnpm exec vitest run scripts/wiki/sources.test.ts scripts/wiki/lint.test.ts`，2 文件、102 项通过。日志 `op-plugin-green.txt`。
- `pnpm exec biome check scripts/wiki/sources.ts scripts/wiki/sources.test.ts`：2 文件通过，无自动修改。
- `pnpm typecheck` 与 `pnpm build` 均 exit 0，日志 `op-plugin-typecheck.txt` / `op-plugin-build.txt`。构建仍有既有插件耗时／资源提示，不视为视觉验收。

精确增量见 `op-plugin-source-registration.diff`，基于本轮 `.tmp/doc-gap-2026-11-03/evidence-op-plugin-before/` 快照，保留主任务已有未提交改动。独立代码复核尚待主任务；本记录不是独立审查签收。
