# Tensor layout E015 增量独立复核

2026-11-03，review_groups_03_04 独立审查，未参与该页写作。接受本增量；不表示本审查者逐条复验整页其他 sources。

已完整读 `tensor-layout-e015.diff`、当前正文 177–281、流程图 YAML 和 SVG 标题差异。量化两版的描述及实现选择复用本人此前的原始核验：9e55cbc8 与 3121f187 的 MLP 都为 W8A8_DYNAMIC，12 个 MLA 层四组投影从 FLOAT 改为 W8A8_DYNAMIC；不存在“实际量化描述未取得”的旧缺口。动态 W8A8 的 48–153 行已在 E013 独立读取，图仅限定这条分支与 BF16 输入输出，未改布局。

本次额外完整读取原始代码：`7d825229` fp8_block.py 178–239，确认先 resolve scale，再按 absorbed、硬件与分组形状分支；`db701c1f` ascend_config.py 579–640，确认旧编译子对象接收 kwargs、未取 weight_nz_mode；`baa023ad` config_utils.py 31–50，确认默认 extra=forbid。没有把这些源码分支当作运行包或 NPU 格式转换实测。

建议的两处残留“rc”已由写手明确为 v0.26 rc，当前 263、278 行已复看，避免与前面的 v0.30.0rc2 混淆。有效算例、数值与原布局保留；未发现本增量未关闭的 P1/P2。没有 UI、视觉或 NPU 验收。

接受时正文 SHA256：`cd59daa5cfd854c1041f6185ca5cdd9d02eaa6450f5a27330929d0f52ad05708`。图仅 caption 变化，完整差异保存在上述精确 diff。
