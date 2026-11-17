# 649 独立检视断点（690，2026-11-16）

本记录是进行中代码的可复现检查，不是最终放行。原作者仍需提交精确版本与验证结果。正式 wiki、旧审阅记录、3D、原 210 次缓存均未被本次探针修改。

## 已验证

- 在 `drop-integration.ts` SHA-256 `9d5f030157cac757d8c38a8d04d03d1c713b0dc8ee0602525d6b142bb83f81a1` 上，独立运行 `drop-convergence.test.ts`：图材料直接定位、非发现阶段已读范围、同段外层续轮比较记录、混合 request/read 与单片读页四项通过。
- 第五项原夹具先在 coverage 因多余 `verdicts` 被 strict schema 拒绝，随后又因生成页缺少 `## 对照源码` 被拒。这些失败不能证明编辑参考入口有错。
- `%TEMP%/infra-wiki-review-20261115/690-editorial-guide-probe.mts` 修正的是独立临时夹具，不改作者测试。使用语法合法的 `raw:sha256-<编辑参考hash>.md#L1-L2` 伪装事实来源，实际被事实白名单拒绝；第二次保留真实来源的合规输出进入整组 Review，`approveReview` 在隔离夹具发布成功。批准期间模型调用增量 0；全探针付费模型调用 0。结果：`690-editorial-guide-probe.json`。
- 类型检查尚未通过：`node node_modules/typescript/bin/tsc -b --noEmit --pretty false` 在 `drop-integration.ts:1260` 报 TS2322，`parsedReqObj.outcome` 未窄化。已交 693 同作者短回合修正。

## P2：v4 真实缓存的越界校正帧漏了兼容处理

- 实跑：`node --import tsx %TEMP%/infra-wiki-review-20261115/690-649-cache-replay.mts`。脚本复制原现场后回放；所有未缓存模型请求立即以 `ISOLATED_REPLAY_BOUNDARY_NO_MODEL_INVOKED` 停止，全局网络禁用。原现场只读。
- 原 batch `4c552fdf-de07-4069-a5f8-33c15586903a` / generation 1 / protocol 4 / 210 calls；原 1363 个缓存文件与 batch 内容检查零变化。
- 首个未命中是第四份来源 `sha256-ede00f3a...` 的 `drop-extract` 越界补读校正帧，不是“整批第一次提取请求”。原缓存输入 `370dd55d97ea33afee74c35a26ba3a07471ea7b40172496ad8f582c01ca6adda.input.json` 已存在。
- 精确 JSON 差异只有 `navigation.activeResources[0].inspectedInStage` 和 `.remainingRanges` 两个新字段；rules 两侧均 1023 字符，其余输入相同。新帧 hash `a0e4892a1c1dc541209dd0dbe145b72d198c1b74ec82869861f5fd1301cc8602`。
- 位置：`drop-integration.ts` 的 rangeErrors 分支（约 1358 行）给非发现阶段追加已读字段，但旧帧兼容选择只覆盖后面的普通与预算协商分支。因此原可复用输入会重调模型。
- 证据：`690-649-cache-replay.json`、`690-cache-frame-diff.json`，隔离副本 `690-649-replay-jecCCr`，均在上述 TEMP 检视目录。回放付费调用 0、网络调用 0；遇首个未缓存边界即停，未声称 210 次全部命中。

建议沿同根因统一帧构造和纯缓存探测，覆盖普通、预算协商与越界校正三条出口；不要继续为每一分支复制提示词和多层 fallback。`ask.cached` 具有输入回执记录副作用，不能充当无副作用的存在性查询。必须继续保留 v3 字节兼容与旧缓存文件，不通过清缓存或加调用上限掩盖问题。

## 后续边界

693 短回合先收口类型与测试夹具，不把本条缓存修复重新塞进该轮。待作者交回后，649 依原任务继续；独立复审、全部相关回归和真实隔离缓存验证通过前不发起新的付费整合。分块预填充三份返修候选的 038 Approved 仍有效（见 679 报告），039 教学复审须独立完成；量化已双审，均尚未正式发布。
