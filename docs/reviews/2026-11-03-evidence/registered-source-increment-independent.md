# 固定来源登记：独立复核

2026-11-03，root。复核 `registered-source-increment.diff` 的三文件全部差异，并结合已完整读过的 `sources.ts`、`sources.test.ts` 及 lint 的使用位置判断。接受本次增量。

登记严格限于一个 op-plugin 官方算子文档和三个 Tokenizers 固定源码文件。Tokenizers 保持生态来源分类，不能单独支持 S；没有把整个组织、仓库、其他提交或讨论区放行。域名与路径匹配实现未改，HANDBOOK 与登记同步。原有通信依赖测试筛选条件改为只含 Ascend/pytorch，避免新加入的官方 op-plugin 条目误入生态来源用例；旧有条目覆盖未减少。

本轮独立执行 `pnpm exec vitest run scripts/wiki/sources.test.ts scripts/wiki/lint.test.ts`：2 个文件、105 项测试通过，退出码 0。输出有现存 Vite 下一主版本原生配置加载的兼容性提示，不影响本轮结果。作者另有先红后绿、Biome、typecheck、build 与 wiki lint 日志；此报告不把作者日志算作 root 重跑。

单独接受 `seed-comment-increment.diff`：只修改解释，不变更任何固定提交。当前远端 tag/branch 与本地旧 tag 的指向不同，使用明确的提交说明更合适，不能再由本地旧 tag 推断远端当前标签身份。

不涉及前端行为；未执行浏览器或 NPU 验收。此结论只覆盖来源分类增量，不代表被引文档的每项内容、全站引文或设备能力全部验收。
