# 投机方法、统计与状态：作者交审记录

状态：作者已完成，等待根助手独立审查和统一工程验收。本文不宣布整个 MoE/EP/投机目录或全站完成。

本组修改 `wiki/concepts/speculative-decoding.md`。冻结 SHA256：`a920e960e2933bbed53f72fe0d8ef08d11c6aa388f35c5684db9379d0004888b`。新增 115 条引文，原 67 条编号与内容不变；逐项主张、范围和源码哈希在 `spec-methods-additions.json`。这 115 条不是 115 篇全文。

## 本次处理的问题

- 草稿串行 K 次、同一检查点、无需额外 KV 等说法原先容易跨方法泛化。保留 GLM 1 层调用 3 遍的原算例，另解释文本匹配、独立草稿、MTP/EAGLE、PARD 并行草稿的工作与资源差别；Gemma4 assistant 检查点作为同检查点说法的边界。
- ngram 实际扫描当前 prompt 加输出；双缺省窗口都为 5。Suffix 有当前请求树和历史响应树，缺省 K 取树深 24，官方示例的 32 不是最终缺省值；全局记录为 0 时当前树仍可用。固定依赖走线性候选路径，论文的树验证与混合策略没有自动变成当前 vLLM 行为。
- MLP 的论文与官方教程存在，不代表固定版本可用：四版 Ascend 工厂没有 MLP 路由，上游基线 MRV1 也没有接入且注册项被注释。直接链接的 issue/PR 对话已读，未把关闭未合并 PR 当修复。
- 隐藏状态采集是缓存及文件导出链，K=1；文件路径返回与写盘完成分开，由文件锁同步读取。Ascend 提取器存在不代表上游 CUDA 文件导出例可原样在 NPU 上跑。
- Speculators 短入口涉及 target/tokenizer/draft 重解读，旧版重建配置，新版先合并用户值再锁定 method/model。四版表和相关实际调用已补齐。异词表开关实际名为 `use_heterogeneous_vocab`；上游 rc2/main 的映射初始化不能套给 Ascend rc2 的直接基类初始化。
- 区分草稿接受率 A/D、平均接受长度 1+A/R 和逐位置按全部轮次归一的比例。增加两轮 K=3、接受 0/2 的算例。请求级统计追到配置、scheduler、output processor、Chat/Completions 消费者；包含 n=1、单 prompt、最终 usage 与服务端强制开启 usage 条件。统计先于停止截断，不能当客户端真实输出数。
- 原文尾部两个未读调用链已补齐：block verify 实际接受/恢复规则，以及 KDA 的 a−1 索引和 align 搬移后重置 1。设备接受率、耗时和 v0.26 草稿滑窗实际影响仍作为测量边界保留。

## block verify 的证据范围

本结论只针对 Ascend `additional_config.rejection_sampler_config.enable_block_verify`，不是所有称为 block verification 的算法，也不是对上游同名配置的泛化结论。K 至少为 3、随机采样、entropy/synthetic 关闭；全 greedy 请求早于该随机分支返回。

完整读取基线分派、逐位置独立随机数生成、恢复分派、普通/整块接受、实际恢复分布及 Triton 核心；还读取 rc2 完整分派与内核，v0.26/main 分派完整差异。基线/2c/2ed/baa 的 PyTorch block 函数同字节；rc2 删去 selected-vocab 分支，保留该接受规则。一般概率比下，Triton 和 PyTorch 对累计比值的裁剪位置并不完全相同，本反例限定确定性草稿 q=1，二者规则一致，未声称二者普遍等价。

原始函数 CPU 复现：`.tmp/continuation-groups-2026-11-10/moe-spec-followthrough/reproduce-block-cpu.py`，结果 `block-cpu-result.json`。执行原始 `rejection_sample`、随机数生成、恢复与接受函数，仅由 CPU 分配适配器将 `pin_memory=True` 改为 False；`HAS_TRITON=False`，未运行 NPU/Triton 内核。

设每个前缀下目标 p(A)=p(B)=0.5、草稿确定 A、K=3。固定 U=[0.8,0.1,0.9] 时普通验证返回 B，整块验证返回 AAA+bonus，reduce 开关两路均复现。普通原函数的 65,536 次首词 A 比例为 0.499130249；整块为 0.762542725。解析下界为 `0.5 + 0.25 ln2 ≈ 0.673286795`，仅前两种互斥通过事件就超过目标 0.5；恢复分布只剩 B，不能抵消。其余四比较点的原 block 函数也执行了同一固定输入，但没有称其他版本全服务已运行。

请求统计另用原 `RequestSpecDecodeMetrics` 类做 CPU 标准库复现：`reproduce-request-metrics.py` / `request-metrics-cpu-result.json`。两轮提出 3/3、接受 0/2 得到平均长度 2、接受率 1/3、直方图 [1,0,1,0]。

## 阅读与保留

10 个官方投机母页全文重读属于已有材料复用，新增全文记 0。四篇论文全文、算法、附录、表格和共 36 张技术图均实读/实看；Suffix HTML 的缺图用精确版本 PDF 第 9 页补回。详见 `moe-spec-paper-reading.json`。

另全文读 Speculators 四份固定文档、PyTorch IBM 官方文章；后者四张静图和 GIF 的 49 帧（9 张拼图）均实看。这 9 份外部全文候选交根助手按全局哈希去重，未直接计入总账。Arctic 的 cache.py 全文及 C++ 树选择范围是源码阅读；与 PyPI 0.1.1 逐字节相同的官方固定文件已核，不将 v0.1.0 tag 误称为 v0.1.1 tag。完整训练生态、每个模型卡、所有 Arctic 构建/测试文件未作已读声明。

`spec-methods-author-preservation.json` 和作者 ZIP 保存了改前/改后、逐项保留判断、源前缀校验、差异及 2 张 SVG 的 YAML/SVG。原 5 个 calc 块逐字节保留，只新增 1 个统计算例；原链接目的地没有删除。两张图资产四个文件同字节保留，实际浏览器看图确认与限定后的文字一致。GLM 45+3=48、32×4=128、12 层 KV/34 层 KDA 等原数字解释保留。

## 验证与待独审事项

- `pnpm check:content` 返回 0，记录在 `spec-author-content.log`。作者后续两处文字仅限定固定基线和候选提满条件；根助手统一检查需覆盖最终 SHA。
- 浏览器实际打开新正文、首屏、4 个新/改表、接受率 calc、KDA 段和两张旧图，点击接受率锚点成功。最终浏览器哈希稳定；pageerror=0，页面和被测表格/单元格均无横向溢出。记录在 `review-replay-spec-browser/report.json`；截图保存后已实际查看，最后两处限定句对应的图资产保持不变。
- 作者 lint 当时唯一阻塞为 Arctic 官方固定提交来源尚未登记白名单。已交根助手按官方固定 commit 的边界方式处理，未降低证据等级或删除来源来通过检查。其余全站 10 条既有非阻塞 notes 没有归为本组修复。
- 尚无根助手对本组 115 条的最终独立判断，也未将全站五项检查或设备实测冒认为已完成。母账 15/25/88 的 MoE/EP 后续仍继续。
