# B1 默认与采样：独立审查

2026-10-31。审查者为本轮新建的 defaults_sampling_review，与写手及前批审查者不同。按 [wiki 写作标准](../../wiki-writing-standard.md) 阅读实际 [sampling 页](../../../wiki/concepts/sampling.md)、改前快照、本轮 diff、两图 YAML 及固定源码，并打开 21 张最终浏览器截图、复核两份检索记录。审查完成，过渡文稿中的 1 项 P2 已关闭，当前无未关闭 P1/P2/P3。

## 范围与版本

八个单元是 temperature、top_p、top_k、min_p、请求 seed，以及启动 seed、generation_config、override_generation_config。主页面仍为 sampling，不新建重复参考页。

实际核读 vLLM 0fc695fc、568afb3a、84030bbe 的 SamplingParams、普通 Chat/Completions 协议、ModelConfig、离线 LLM 与 CLI；固定 Ascend 为 db701c1f。来源 135 的 [NumPy 官方 legacy 接口文档](https://numpy.org/doc/stable/reference/random/legacy.html) 本轮在线打开，核到传统整数种子的 0 到 2³²−1 范围。这里核的是参考源码调用链与接口约束，没有验证线上镜像安装内容或 NPU 输出。

## 核对结果与修订

**P2：from_optional 的 top-k 空值不能当成中性默认。已关闭。** 读取过渡 diff 时发现它与 temperature、top-p 一起被列为可归一化 None。固定基线 sampling_params.py 的 from_optional 只对 temperature、top_p 执行条件回退，top_k 与 min_p 原样传给构造函数，随后数值比较会拒绝 None。影响是照文传入空值的离线示例会失败。审查反馈时写手已修正实际正文；本审查者复读当前「怎么开」并增加三版独立断言，确认表述为 top-k、min_p 均应传数值。过渡 diff 不作为当前页面仍有缺陷的证据。

其他关键结论已逐条核对：

- 普通 Chat/Completions 的四项采样字段省略或 null 时先合并服务默认，请求 seed 直接传递；Python 构造参数对象没有 HTTP 合并层。BatchChat 的基线数值默认与新版 None 单列，没有混成所有接口同一行为。
- 三版模型默认提取均先按键覆盖，再读取六项名单；override 的 null 覆盖掉模型值后被过滤，而请求 null 继承服务值。seed 不在这份默认名单。vllm 模式跳过模型采样默认，仍应用覆盖字典，特殊 token 另走读取链。
- 小正温度先抬升到 0.01；范围校验先于 greedy 截断归零。MTP 兼容检查读取归一化后的 min_p，以大于 0.00001 为条件；因此随机 min_p=0.1 拒绝，greedy 下合法 0.1 归零后通过，非法值仍先失败。
- 请求 seed=-1 归为 None，0 保留为独立种子；HTTP 有符号 int64 与全局初始化所用 NumPy 范围分开。Ascend model_runner_v1.py L748–763 实际调用父类状态更新，上游 gpu_model_runner.py L1204–1211 才按 RANDOM_SEED 创建设备发生器，没有仅凭继承类名推定执行路径。
- 首两屏关于 greedy 的说明已限定分数与并列处理一致，随机种子段区分起点、取数顺序和模型数值。离线示例新建参数对象，避免事后赋值跳过初始化归一化。

## 独立分支验证

从三份固定 Git 对象按 AST 提取原函数体：get_diff_sampling_param、from_optional、__post_init__、_verify_args、_verify_greedy_sampling、_validate_spec_decode，main 还提取其序列数校验辅助函数。仅去除注解与装饰器以便隔离执行；logger、无关的环境上限、异常构造及 thinking budget 校验用桩，不替换被验证分支。

每版 22 项，共 **66 项断言通过**。覆盖两种 seed 特殊值、温度抬升、greedy 重置与非法参数先拒、top-k 类型、四项 None 行为、MTP min-p 门槛、温度上限/有限性版本差异、auto/vllm 的默认覆盖、覆盖 null、忽略名单外 seed、最大新 token 字段重命名。

可复跑脚本与结果位于 tools/wiki-runtime/defaults-sampling-20261031/independent-branch-checks.py 与 independent-branch-checks.json。它们是源码分支验证，没有导入 Torch/NPU，也没有发送 HTTP 模型请求。

## 信息保留与教学核对

对照 sampling-before.md 与实际 diff，原六词分数、温度表、top-k/top-p 截断、指数噪声、三种 penalty、偏置/允许编号/禁词、最少长度与 MTP bonus 边界、GLM 词表形状和采样分工、现有误解与待核均保留。修改的是默认来源、种子边界和当前批的参考说明；输出预算与停止编号继续回链唯一归属页。

独立脚本确认机器审计尾注逐字相同，六个 calc 标题与两图引用完整，结果为 independent-retention-checks.json。两个 YAML 的六词数值与 TP8 流向也已核读。初学者可以从前部解释出：模型先给每个词打分，采样决定下一枚编号；随机路径增加分布处理与排序成本，greedy 在相同分数下取消随机选择；后部默认覆盖表只解释参数来源，没有重做既有概率推导。

## 浏览器与检索

独立打开 21 张最终浏览器截图：首两屏、动机、直觉图两部分、两层种子、默认覆盖表、请求参考表两部分、离线示例、启动表与片段、版本表分段、流程图两部分、原 softmax calc、检索和两个跨页落点。表格文字可读，参数名没有挤出正文；首图先于 calc，六词数值与正文一致。早期 first.png 显示旧别名集合，不计入这 21 张；first-final.png 已显示新增别名。

实际检查 retrieval.json，12 个 CLI 查询均以 sampling 为首项且 how=exact；ui-retrieval.json 的 9 个查询均为 1 个匹配，并记录点击后的 sampling URL 与标题。预算和停止条件两处链接由写手在浏览器实点，budget-link.png、stop-link.png 显示对应页面「怎么开」内容。审查者复核的是实际操作记录与图像，不冒称自己另跑了一套浏览器点击。

读过 metrics.json：去代码围栏与机器审计尾注后，教学区 10997 个汉字、行内代码每千字 0.91；含源码区 19116 个汉字、每千字 5.28；教学区角标 0，全文 26 个角标，其中 C 19 个，低于 80%。沿用六个 calc，各小节不增加第二个；两图宽均为 880。审计日志本轮显示 167 页来源检查无无效 commit、缺文件、行号越界或未知仓库，强制写作标准 104/104 通过。其他三页同时有会话外变动，不能把全库由 101 到 104 的改善归为此次 sampling 补写；URL/raw 语义也不在自动审计的通过范围内。

## 来源登记代码的附加审查

NumPy 这条来源触发既有来源登记约束，写手仅在 sources.ts 的表中增加 numpy.org/doc/stable/reference/random/legacy.html 的精确路径、分类为 ecosystem，并同步 HANDBOOK 和一条边界测试。此小范围代码审查单独使用 Ponytail 与项目授权的协作规则，教学正文仍按 wiki 标准审查。

本审查者比较 sources-before.ts、sources-test-before.ts、handbook-before.md 与实际三文件，阅读 classifySource、supportsOfficialEvidence、handbookDomains 全部实现及 lint 的两个消费者。仍以 hostname 全等和 URL pathname 精确匹配为边界；没有增加前缀放行，没有改分类分支或证据等级计算。生态分类不能单独支持 S，测试覆盖同目录其他页、路径追加、伪装域名及手册和代码表一致性。

独立执行 `pnpm exec vitest run scripts/wiki/sources.test.ts scripts/wiki/lint.test.ts`，2 个文件、81 项测试通过。测试过程出现已有 Vite 未来 native config 提醒，没有失败。改动只增加一条固定数据，依现有逐来源分类路径运行，没有引入网络访问或新状态。代码部分无需修正；未独立重跑写手的 TypeScript/生产构建，正文浏览器复核见上一节。
