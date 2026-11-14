# MLP E014 增量独立复核

2026-11-03，审查者 review_groups_03_04，未参与本增量教学页写作。

结论：接受已修订增量。实际完整读取 `mlp-e014.diff`、当前相邻正文和流程图 YAML；核对 SVG 的标题/说明差异，未做视觉、浏览器或 NPU 验收。本报告不替代整页 37 条 sources 的逐条核验。

实际原始证据：

- pre-norm 论文 2002.04745v2：§3.1–3.4、§4 全文，确认初始化假设、所测翻译/BERT 设置和 RAdam 的 post-LN 无 warm-up 反例。不能推出任意 post-LN 都必须预热或任意 pre-LN 都不需预热。原文 HTML 的章节缓存位于 `.tmp/evidence-2026-11-03/groups-01-02/paper-2002.04745v2-*-compact.txt`。
- RMSNorm 论文 1910.07467v1：§3、§4、§6 全文；均方根与中心化区别成立，性能描述是论文实验结果，未当作当前 NPU 测量。原文公式也不能证明任意实现没有偏移。
- `db701c1f`：layernorm.py 28–88；glm5_next_mtp.py 104–123；fused_moe_0_23_0.py 345–358、559–670；`0fc695fc` deepseek_mtp.py 44–60。确认偏移加载分支、位置 0 的输入清零、配方旋转、出块 TP All-Reduce、shared_head RMSNorm，以及共享专家量化融合的 weight_scale/type 条件和普通后备 act_fn。
- `baa023ad` utils.py 841–866；复用此前本人已完整读取的 `db701c1f` utils.py 735–762/819–820、linear_op.py 535–613、w8a8_dynamic.py 48–153，以及 `0fc695fc` custom_op.py 109–207/261–353。固定注册链与原生激活、两个投影调用、逻辑操作不等于设备 kernel 数、TP/SP 分支条件均成立。

发现并关闭一项 P2：当前页 395 行原“每个位置读一遍 H 个数”无法由 NPU wrapper 证明实际访存次数。写手改为 H 个分量的平方和/缩放及线性逻辑工作量，保留实际内核访存/耗时边界；已读改后整句并接受。原有 RMSNorm/LayerNorm 算例、MLP 形状与 GLM 子层解释保留。图只增补输入处理、TP/SP 和块内范围的说明，未改变布局或数值。

接受时 SHA256：

| 文件 | SHA256 |
|---|---|
| wiki/concepts/mlp-residual-norm.md | 4897f991da75411e67aae50e331f771aa1a25381cf2e4c795c37ee20545d48ba |
| wiki/diagrams/mlp-residual-norm-flow.yaml | b92f310b5b82ee207823fc7054a8ef920459ccb1a0b6e41ae951db425e2d01aa |
| wiki/diagrams/mlp-residual-norm-flow.svg | d54bc66c3432a80a1957476cd8ff9c7f3877e897b4150a75cf236c8c61706161 |

未关闭问题：本增量无。整页其他来源的完整核验由原负责组记录，不能由此报告推定完成。
