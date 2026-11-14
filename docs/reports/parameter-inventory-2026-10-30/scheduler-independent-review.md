# B3 调度参数独立审查

审查日期：2026-10-31。审查者为本批新建的 `scheduler_independent_review`，未编写 wiki 正文。依据 [wiki 写作标准](../../wiki-writing-standard.md) 阅读 Scheduler 全文、本轮六页 diff、两张调度图的 YAML、固定源码及实际验证日志。**源码、内容、修订、浏览器图像和检索证据复审通过；没有未关闭的 P1/P2。**

## 范围与方法

本批十单元为 async_scheduling、enable_chunked_prefill、long_prefill_token_threshold、max_long_partial_prefills、max_num_batched_tokens、max_num_partial_prefills、max_num_seqs、scheduler_cls、scheduler_reserve_full_isl、scheduling_policy。参数入口、默认派生与三版参考集中在 [Scheduler](../../../wiki/concepts/vllm-scheduler.md)，异步判定继续由 [async scheduling](../../../wiki/concepts/async-scheduling.md) 维护。另核对 chunked-prefill 的联动条件与回链、PD 页的 partial-prefill 平台重置条件，以及 balance-scheduling、short-request-first 的锚点和全 decode 场景限定。

对照基线 vLLM `0fc695fc` 与 GLM Ascend `db701c1f`，并核 vLLM `568afb3a`、`84030bbe` 及 Ascend `2c59ff10`、`2ed6cbba`、`baa023ad` 的相关差异。独立获取的文件保存在 `tools/wiki-runtime/scheduler-20261031/sources/`；配置和 EngineArgs 源文件复用上一批已经下载的固定提交文本。审查按本轮 before 快照比较，没有把更早的未提交修改算作本轮。

## 发现与修订

| 级别 | 位置与影响 | 依据及处理 | 复审结果 |
|---|---|---|---|
| P2 | Scheduler 的场景门槛把 running 全按每条 4 个位置扣，容易被当作所有 running 的规则 | running 可含未完成的 prefill；已将既有 128、8068 和场景 M 演算限定于已有请求全在 decode，其他情况按实际差值 | 已关闭，数值和唯一出处链接保留 |
| P2 | 图和常见误解把“从 running 队尾抢占”写成无条件规则，与新增 priority 参考冲突 | 0fc scheduler.py L461–499 在缺块时区分 fcfs 和 priority；已给图注及总结加默认 fcfs 条件，流程图节点同时补 waiting 恢复请求的已生成部分 | 已关闭，原布局保留 |
| P2 | 关闭 chunked prefill 被概括为一定不切开输入，漏掉正阈值先截断 | 三版 waiting 均先截 long_prefill_token_threshold，随后才检查关分块时是否超过余量。输入 100、预算 100、阈值 20、分块 False 仍排 20；已补组合例子，并同步 Scheduler 与 chunked-prefill 的相关旧句 | 已关闭，三版真实分支最小执行均复现 |
| P2 | 含源码区全文的行内代码密度超标准，虽未触发教学区自动检查 | 初次独立统计 Scheduler 13.57、async 19.43、PD 14.86 个/千汉字；写手只移除重复代码底色，保留标识、事实与来源 | 已降至标准以内，统计见下文 |
| 来源补齐 | PD 页原来把平台重置说成“无条件”，且容易误以为能绕过上游入口拒绝 | 四份 Ascend 文件均是 getattr(..., 1) != 1 才写回；旧两版 EngineArgs 更早拒绝非 1，main 已删除字段，缺字段时不写入。正文修正并追加各平台/入口 sources | 已核对实际条件与调用先后 |

预审也核出了两个 partial-prefill 字段在 main 删除、阈值边界变化、draft_model 异步自动判定变化和 watermark 的差异；这些已进入初稿，不冒称为初稿遗留错误。没有发现本批新增 P1。

## 十单元事实核对

- **预算与条数：** 输入 None、配置类兜底和实际入口默认值分开；硬件表、batched-DP 特例、throughput 仅翻倍缺省值、关分块抬预算、乘积封顶及最后条数取 min 的顺序正确。显式预算 32、条数缺省最终为 32/32；显式 32/64 保留后由校验拒绝。GLM 显式 8192/32 保留。
- **分块与阈值：** 生成式 encoder-decoder 例外保留；关闭分块的预算等于模型长度可过对应检查。阈值在 running 和 waiting 都使用，不能只按“长 prompt 分类”理解；基线负值不截断、0.26 起非负、main 上界校验与删除 4% 派生均已区分。
- **两个 partial-prefill 字段：** v0.23/v0.26 的字段默认 1，不等于 1 在标准入口即拒绝；配置类里的并发与 4% 分支不是可用的启动调优功能。main 的字段、EngineArgs 与 CLI 均删除。没有据字段文案承诺短请求插队。
- **策略：** priority 小数值更优先，同值比到达时间；缺块时按最大二元组选择受抢占者。它不导致 waiting 的高优先请求立即替换已满的 running，waiting 仍受预算、条数和容量约束。
- **完整输入容量检查：** 默认 True；检查与本步分配分开，不提前分配未知输出。0.26/main 的 watermark 只在指定准入条件下增加余量，默认 0，不能把新增条件抹成三版实现完全相同。
- **异步和选类：** None 自动、False 关闭、True 不兼容硬失败分开；draft_model 在旧两版自动关闭而 main 自动允许，MTP 基线不受此差异影响。显式 scheduler_cls 绕过默认类选择，平台后写覆盖与同步自定义类的风险保留。未把配置为 True 当作实际运行 AsyncScheduler 的证明。
- **来源映射：** 主参考新增 sources 42–58 的字段、CLI、拒绝分支、默认派生、异步差异与 watermark 行号对应正文描述。PD 追加来源未改变旧索引；async 新版本行由已有 main 的 VllmConfig 来源支持。

独立运行 `python tools/wiki-runtime/scheduler-20261031/independent-checks.py`，**58 条断言通过**，结果见同目录 `independent-checks.json`。脚本提取固定源码的函数体和 waiting 原始分支，用轻量配置 fixture 执行；仅去除注解/装饰器，waiting 外加一层 while 保留 break 语义，没有改写原控制流。覆盖默认派生、显式覆盖、联合校验、partial 拒绝、4% 分支及关分块与正阈值的组合。这是源码分支验证，不是完整 vLLM 启动或 NPU 推理。

## 教学与保留核对

从 Scheduler 开头与机制图可复述：调度器在模型前向前决定哪些请求各算几个位置、借哪些块；预算限制位置数，条数限制 running 的宽度，二者都不能替代 KV 容量。先续 running 会让新请求等待，长输入可能多步处理，缺块抢占增加重算成本。图中 20 个位置先给 A、B 各 1，余下 18 给 C，C 还有 9 个留到下一步；这是通用示意，不是 GLM 测量值。

另独立打开三张关联页各自真实页首与下一屏，复述如下：async scheduling 让 CPU 趁 NPU 做本步时提前安排下一步，减少设备等 CPU 的空档；结果尚未返回，代价是先记 token 占位、随后补真值并销账，图中的 13 格与 11 格是示意。chunked prefill 把装不下预算的长提示词分段，保存并接续前段历史；正在 decode 的请求可以继续推进，长请求则更晚拿到首 token，并付出重复读历史与每步额外处理的成本。PD 分离把同一请求的 prefill、decode 交给两套独立实例，各有调度器和块池；代价是在两套实例之间交接历史状态，本站 GLM 双机主线没有启用它。这六张新增截图中的定义、前置解释和首图可读，没有因本批参数回链调整破坏开篇。

本轮保留 R1 的 4 token、MTP 3 候选、每步 4 个位置、每 DP 8192/32、纯 decode 128、场景 M 的 6048/8068 和长提示词三步、五缓存组与 640 逻辑块、前缀关闭时重算、默认 BalanceScheduler 及其他变体、现有两个实机待核项。联合预算推导仍回链唯一出处，没有复制并发页的整份账。async 的机制与条件复用原文；chunked 的机器审计尾注与 before 内容一致。

独立统计去除 frontmatter 和代码围栏、按汉字计数，教学区四页都是 0 个行内代码、0 个证据角标。含源码区的全文密度分别为 Scheduler **12.44**、async **12.52**、chunked **12.05**、PD **12.88** 个/千汉字；总角标分别 24、27、30、29，C 类占比均低于 80%。calc 数分别 1、4、4、1，第一张图前均无 calc。详见 `independent-metrics.json`。未以删掉边界、旧事实或待核项降低统计值；双下划线标识保留代码样式，避免被 Markdown 当作强调而隐藏下划线。

## 验证状态

已阅读本轮最终日志：`wiki-audit-final.log` 报 104/104 标准名单页通过，167 页、4688 条来源中 4424 条行号有效、264 条 URL 未联网验证，无无效 commit、缺文件或越界；raw 摘录另有 1399 条待核。`wiki-lint-final.log` 通过，8 条提示均不在本批修改页面；`wiki-diagrams---check-final.log` 报 331 张图与 spec 一致。`check-content-final.log` 为 11 个主题、167 页完整且无重复；`build-final.log` 为索引生成成功；`product-build-final.log` 的 TypeScript 与 Vite 构建通过，53.30 秒。以上为审查者阅读写手本轮实际命令日志，不冒称重复执行了这些构建。自动来源校验不证明 raw 摘录或结论语义，独立事实核对见上文。

审查者使用图片工具实际打开 **34 张浏览器截图**，包括 Scheduler 首屏、定义、动机与代价、两图上下、新参数表上下、默认派生、阈值组合、版本表各段和 calc；还包括 async、chunked、PD 各自真实前两屏，async 的参考与新版本行、chunked 的条件与参考、PD 的重置说明、各页回链落点、align 校验落点以及最终 UI 搜索结果。新增参数表和版本表可读，没有截字或内容叠压；PD 原有大版本表仍使用横向滚动，本轮新重置说明正常排版。截图由写手实际操作浏览器生成，审查者独立读图，不冒称接管并重复操作了浏览器。

`retrieval.json` 的 **20/20** 下划线/连字符精确查询均命中预期首项；`ui-retrieval.json` 的 **10/10** 目录搜索均记录一个匹配页面并成功点击加载。async 两种查询保留在已有机制页，再通过参数参考回链进入 Scheduler，其余九项直接到 Scheduler；这是保留单一别名归属的明确安排。回链截图与 Markdown 目标锚点一致，Mamba align 的已有校验被复用，没有复制第二份解释。

实际部署日志、线上安装提交与 GLM 双机吞吐/时延仍未实测，不用静态参数审查替代。
