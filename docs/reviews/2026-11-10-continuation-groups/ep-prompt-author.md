# NIXL 输入边界：作者交审

状态：本小增量已稳定，待根助手新的独立审查；EP 母文 88 的全部承接尚未关闭。

## 问题与实际改动

固定 EP 部署指南的 D 请求示例注释称 prompt 被忽略。四版 NIXL pull 调度实际读取 D 请求的 prompt 长度；源端交接字典给远端定位与块信息，不提供替代 prompt 的 token 序列。整段命中后，EngineCore 留最后一个位置计算，基线 Runner 从 D 本地的 token 序列取这一位置。因此不能照抄该注释让 D 使用任意占位输入。

唯一解释加在 PD 的 NIXL 小节：新增“交接定位信息以后，D 还需要原来的输入吗？”两段，四版表新增一行，页末加来源索引，来源 111–120 为 10 个新精确范围，另复用 18、90、100、104、107 共 5 个已有范围。没有把 NIXL 用法改成 Ascend Mooncake 配方，没有改原 GLM 传输/容量解释。

## 保留和并发边界

改前文件 `.tmp/continuation-groups-2026-11-10/moe-spec-followthrough/pd-disaggregation-before.md` 的 SHA 为 `c490e510f61b747aab3d37a235ce23504f1a0b323fe0d862fe76933f417d77c5`。作者稿 SHA 为 `d174cc801d3c8c709625faa2092fb34ce592916857f2de982d0079823c907a8d`。完整作者 diff 位于同目录 `pd-prompt-author.diff`；机械来源和逐项作者判断在 `ep-prompt-author-additions.json`。

人工逐组对照：原混部/PD 首屏与代价、交接顺序、P/D 资源换算、EPD/主机 embedding、NIXL 30 秒/5 秒/20 秒租约算式、450/480 秒多轮边界、GLM 两类状态与块大小缺口、四版 Mooncake 表、误解和缺少设备实测均原样保留；原 110 个来源顺序不变。没有修改任何图、3D、calc 或已有段落，只插入上述内容。并发会话此后若修改 PD 或关联图，不能计入本作者 diff；验收应按这次哈希与增量范围重新比对。

## 实际验证

- 原函数 CPU 复现：`repro-nixl-prompt.py` 从四个固定版本提取真实方法，普通非 Mamba 拉取路径的四 token 请求均得到命中 4、完成后位置 3；两 token 请求均得到命中 2、完成后位置 1。结果保存在 `repro-nixl-prompt.json`。未执行网络传输、模型前向或 NPU/CUDA 设备运行。
- `pnpm check:content` 退出 0，日志 `moe-spec-followthrough/prompt-content.log`。统一 lint/audit/diagrams/build 留根助手结合并发稳定状态运行，不以本次内容检查替代。
- 5201 浏览器实际打开，前两屏、新段与四版表四张截图已查看。页面 SHA 前后相同，pageerror 0，文档级横向溢出 false；新锚点实际 ID 为 `交接定位信息以后d-还需要原来的输入吗`，直达后标题顶部 107.70px。截图与报告在 `moe-spec-followthrough/review-replay-prompt-browser/`。原图和算例没有本次修改，不借这次截图重新声称其他会话图已验收。

阅读计数：13 篇母文为既有全文重读，本小增量新增官方全文计数 0；10 条是引用范围，不是 10 篇全文。新 Speculators 四篇资料和其余 MoE/投机承接另记在 `moe-spec-followthrough-reading.json`，不挪入本次关闭范围。
