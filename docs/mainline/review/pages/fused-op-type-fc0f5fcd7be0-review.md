# fused_op_type 审查记录

## 写作记录（10-04）

写手：Opus 5.5。本记录是写手自查与交接，不替代独立审查。分工见 [absolute-balance-threshold 的写作记录](absolute-balance-threshold-71578a0c428d-review.md#写作记录10-04)：本页是本写手 6 页里的第 3 页。

**版本核实。** `fused_op_type` 由 `1e9e03bc`（PR #17392，2026-09-26）引入；`git merge-base --is-ancestor 1e9e03bc <c>` 对 `2c59ff10`、`db701c1f`、`2ed6cbba`、`baa023ad` 为否，对 `4d1412d1`、`4ebb3090` 为是；`git log -S fused_op_type` 显示引入后字段定义未再改。骨架自动区用的是 `4ebb3090`（2026-10-02 main），正文按它核。

**核过的事实与出处（均为 `4ebb3090`，除非另注）。**

- 字段、默认 `"none"`、注释（Q1/MTP LIM + copy-SFA，C8 算子不被选）、`use_fused_copy_sfa` 属性：`ascend_config.py:1628-1634`。
- 取值校验与互斥报错原文：`:1638-1641`；只有 `enabled` 才做服务侧检查：`:1658-1660`；DSpark、TopK=2048 与 1–7 行、热缓冲 256 对齐与 `[Q_max*2048, 16128]`：`:1689-1700`（判断式写的是 `<= 16256`，但 256 对齐后最大合法值就是 16128，与报错文本一致）。
- 每步是否真走融合路径（无 prefill 或 dummy、`1 <= max_query_len <= 7`）：`attention/sfa_kv_offload.py:269-273`；回退时作废驻留记录的注释：`:647-650`。
- 四步 → 两步与两个 kernel 名：PR #17392 说明（`git show -s 1e9e03bc`）。
- 钉住版本：`baa023ad` 整块 `cls(**user_config)`（`ascend_config.py:1494`）+ `config_utils.py:43` `extra="forbid"`；`2ed6cbba` 逐键 `.get`（`ascend_config.py:1047-1054`）；v0.23 / GLM 快照无此特性，引用 use_fused_overlap 页已核过的结论。

**[D] / [I]**：热缓冲下限 2048/4096/8192 的换算；GLM 推演（`index_topk` 2048 取自 sparse-attention 页，MTP 3 个取自部署页 → 4 行，默认 4096 < 8192 会报 hot budget 错）为 [D]；融合省时的机理、回退后「下一步可能重搬」为 [I]。无实测数，页面写明。

**未写进页面、留给审查**：GLM 的逻辑块 640 与「热槽数须为块大小整数倍」那条（Sparse KV Offload 页按 `baa023ad` 引）在 `4ebb3090` 上是否仍在，本轮没核，所以没推「同时满足 256 与 640 对齐的最小值」。

**lint**：保存后 `pnpm wiki:lint` 通过。

**跳过的内容**：无。

## 审查（10-04）

审查员：Opus 5.5（独立审查，只审不改页面）。口径：参数页四段式，不套深入页骨架。

**分数：9 / 10。** P1 0 条，P2 1 条，P3 3 条。

**结构与格式。** 一句话 / 参数定义（自动生成）/ 事实表 / 为什么存在 / 开了的代价 / 版本谱系齐全；「骨架 / 待补」计数 0；frontmatter 合法。`git diff` 删除行只有骨架占位与旧 summary / updated。`pnpm wiki:audit` 退出码 0、本页无报错（来源 13 条）；`pnpm wiki:lint` 退出码 0。

**版本口径专项：通过。** 自己核：`1e9e03bc`（PR #17392，2026-09-26 17:48）对 `2c59ff10` / `db701c1f` / `2ed6cbba` / `baa023ad` 均非祖先，对 `4d1412d1`、`4ebb3090` 是祖先；`git log -S fused_op_type 4ebb3090 -- ascend_config.py` 只有 `1e9e03bc` 一条，「之后字段定义没再改」属实。正文第 50 行写清了引入日期与 PR、按 `4ebb3090`（10-02 main）核对、钉住四版都没有，与自动谱系（main 有、各 release 无）一致，不会让读者以为钉住版本有。措辞瑕疵见 P2-1。

**逐条对源码。**
- `4ebb3090:ascend_config.py:1628-1634` 字段、默认 `"none"`、注释、`use_fused_copy_sfa` ✓；`:1636-1641` 取值与互斥报错原文逐字一致 ✓；`:1658-1660` 未 `enabled` 直接返回，服务侧检查只在打开时做 ✓；`:1687-1700` DSpark 报错、`TopK=2048 and 1–7 query rows`、热缓冲 256 对齐与 `[Q_max*2048, 16128]` 报错原文 ✓（判断式写 `<= 16256`，256 对齐后最大合法值确为 16128，写手说明属实）；默认 `topk_buffer_size = 4096` ✓。
- 每步走融合的条件：`attention/sfa_kv_offload.py:269-273`（无 prefill 或 offload dummy，且 `1 <= max_query_len <= 7`）✓；回退时作废驻留记录的注释 `:647-650` ✓，页面把「下一步可能重搬」标成 [I] ✓。
- PR 说明：原流程 LI → LRU selection → Sparse Onload → SFA，新流程 LIM → Copy_SFA，两个 kernel 名逐字一致 ✓；PR 无效果数字，页面明说 ✓。
- 钉住版本：`baa023ad:1466-1468` `@config` 装饰的 `SparseKVOffloadConfig` 无此字段，`:1494` `cls(**user_config)`，`config_utils.py:43` `extra="forbid"` ✓；`2ed6cbba:1047-1054` 逐键 `.get`、未开直接返回，其余键忽略 ✓；`2c59ff10`、`db701c1f` 的 `ascend_config.py` 里 `sparse_kv_offload` 出现 0 次 ✓。
- [D] 手算：每请求行数 × 2048 → 不开 MTP 2048、草拟 1 个 4096、草拟 3 个 8192 ✓；默认 4096 只够 1–2 行 ✓。GLM：`index_topk=2048` 出自 sparse-attention 页第 181 行、MTP 每轮 3 个出自 D 页第 84 行，均为链接引用 ✓；1 + 3 = 4 行在 1–7 内、4 × 2048 = 8192 > 4096 会报 hot budget 错 ✓，且写了「假如前面的门槛都过了」的前提 ✓。

**数字与效果。** 无虚构效果数字，事实表专列「实测收益：无」；GLM 数字只用于推门槛，没有当成本参数效果 ✓。

**浏览器实测。** Playwright 1440 宽打开 `http://localhost:5193/#/wiki/fused-op-type-fc0f5fcd7be0`，第一屏与事实表屏渲染正常（表格三列、行内报错原文可读）；截图存审查员 scratchpad `fused-op-type-fc0f5fcd7be0-review-1.png`、`-review-2.png`。

**P2**
1. 事实表第 82 行「意味着什么」列写「镜像比 `baa023ad` 新才认这个键」。`baa023ad` 是 09-21，本字段 09-26 才进 main，09-21 到 09-26 之间的镜像同样不认，这句会让读者把门槛放早。改法：写成「镜像要包含 `1e9e03bc`（09-26，PR #17392）才认这个键」。

**P3**
1. 第 95 行「每一步之间都要把中间结果写回显存再读出来、各付一次启动开销」是按算子融合一般道理推的，源码与 PR 没写；第 97 行才补 [I]。建议第 95 行这句也标 [I] 或改成「一般来说」。
2. 第 46 行把「LIM 管打分和热缓冲进出、Copy_SFA 管拷行和算 attention」归给 PR 说明；PR 只给了 4 步 → 2 步和两个 kernel 名，具体哪几步并进哪个算子是按名字对应推的，可加半句说明或标 [I]。
3. 入链只有 index。use_fused_overlap 页第 139 行已经讲到 `fused_op_type` 与互斥，kv-cache-sparse-offload 页未提及；建议这两处各加一个到本页的链接（不是本页写手的页，供后续处理）。

**写手留的疑点**（GLM 逻辑块 640 与「热槽数须为块大小整数倍」在 `4ebb3090` 是否仍在）：本轮 grep 只见 `sfa_kv_offload.py:569` `pages_per_row = topk_buffer_size // block_size`，未找到显式的整除校验，没查完，不下结论；页面未据此推数，不影响本页。

**跳过**：sources 区；对照源码节（本页无此节）。

## 修订记录（10-04，写手）

- **P2-1 已改**：事实表「意味着什么」改为「镜像要包含 `1e9e03bc`（09-26，PR #17392）才认这个键」。
- **P3-1 已改**：「每一步之间都要写回显存再读出来、各付一次启动开销」句末注明是按算子融合一般道理说的，标 [I]。
- **P3-2 已改**：一句话节改为「四步换两步与两个算子名出自 PR 说明；哪几步并进哪个算子是按算子名对应出来的 [I]」。
- **P3-3 未改**：要加链接的 use_fused_overlap 页与 kv-cache-sparse-offload 页不是本写手的页，按分工不动，留给页主处理。
- 复跑：`pnpm wiki:lint`、`pnpm wiki:audit` 退出码均 0。
