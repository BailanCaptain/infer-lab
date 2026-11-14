# B8 概率记录：独立审查

审查日期：2026-11-01。独立审查对象为 logprobs、prompt_logprobs、top_logprobs、logprob_token_ids、flat_logprobs、max_logprobs、logprobs_mode。最终状态：**PASS，B8 七单元的文档审查通过；本轮发现的问题已修订并复核，无未关闭 P1/P2。** 已完成固定源码、受控函数、实际正文/diff、图、检索与浏览器截图审查；这不是 NPU 或完整 HTTP 服务运行验收。

## 证据范围与方法

先读项目 wiki 写作标准、知识库读页规则，以及 sampling、prefill、prefix-caching 的已有相关说明。独立从官方 raw.githubusercontent.com 下载固定源码，没有读取 tools/repos。下载证据位于 `tools/wiki-runtime/logprobs-20261101/independent/`，初始 48 份清单见 downloads.json；随后补取三版 logprobs.py、v1/outputs.py、gpu_input_batch.py、提示词 HTTP 数值处理，以及 community Ascend 的三个文件。最终 63 个文件的固定 URL、SHA256 与行数见 source-manifest.json。

核对 vLLM 提交 0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665、568afb3a13806beb53bb2e6bd518269357b237c0、84030bbe3d74d99bad477a3d2e37a973ccd8865c，以及 Ascend GLM db701c1fd31de40ab028628ee2580ae68c7fd3c0、community 2c59ff1047573f40a471cf7535f01a8877344415、rc 2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f、main baa023ada41a5b889cac6249845a688aab130892。GLM 专用 orphan commit 不当作 community v0.23 的证据。

独立执行命令：

```text
python tools/wiki-runtime/logprobs-20261101/independent/review_fixture.py
PASS 203 assertions: pinned AST validators, response serializer, and FlatLogprobs containers
```

fixture 从下载源码提取完整函数 AST，实际执行 check_logprobs、_validate_logprobs、_create_completion_logprobs、clamp_prompt_logprobs、num_logprobs 与 FlatLogprobs 的真实方法，并隔离执行 __post_init__ 中原有的 APC 默认值分支；只替代响应 DTO、tokenizer 调用、错误类型及外部模型配置。宿主 Python 3.9 对 flat 容器移除运行期 union 类型别名、泛型基类参数并延迟注解，其方法体未改。断言明细见 fixture-results.json。此验证不等于完整 Pydantic、HTTP 服务、torch tensor、GLM 双机或 NPU 集成测试。

## 已确认的关键边界

| 项 | 独立结论 | 固定源码位置 |
|---|---|---|
| 三种入口的 logprobs | Python 为 int/None，Chat 为 bool/None；Chat 候选数使用 top_logprobs。Completion 为 int/None，不能把 Chat 形状照搬 | 三版 sampling_params.py、chat_completion/protocol.py、completion/protocol.py |
| −1 | Python 的生成/提示词与 Chat 的 top_logprobs 支持 −1，但受引擎上限限制；Completion 基线、rc 的请求校验拒绝所有负数，main 才放行 −1 | base Completion protocol 410–430；rc 447–490；main 489–552 |
| main Completion −1 返回缺口 | main 的协议放行不等于候选全量可用：serializer 对 −1 使用 `num_output_top_logprobs >= i`，返回候选字典为空，实际生成 token 的 score 仍返回 | main completion/serving.py 652–742；fixture 三版实际执行 |
| prompt 流式 | HTTP 检查拒绝 stream=true 与 prompt_logprobs>0 或 −1；0 可通过该检查。echo 在转换阶段派生参数，不能据校验放行宣称流中会返回整段 prompt 结果 | 三版两个协议的 check_logprobs 与 to_sampling_params |
| 指定 ID 的入口 | 基线 Python 有此字段，HTTP 无声明/传递；rc/main 新增 HTTP 字段。Chat 要 logprobs=true，Completion 要 logprobs 非 None，均不兼容 beam search | rc/main 两个 protocol 的 check_logprobs |
| 指定 ID 的上限 | 至多 128 个，编号落在模型词表范围；若同时显式给 logprobs，必须等于列表长度。仅指定 ID 列表的路径不受 max_logprobs=20 的数量门槛约束；显式 logprobs 仍受它限制 | base sampling_params.py 713–774；三版 fixture |
| 指定 ID 的返回与 rank | Sampler 总在第 0 列带实际生成 token，再带指定 ID；普通位置字典对同 ID 去重。后续追加函数为其他项填写 1..n 的序号，不能把指定 ID 的 rank 当作真实全词表名次 | sampler.py 151–225；logprobs.py 175–207 |
| flat 的含义 | 三版为 Python 内部返回容器开关，HTTP 协议无此字段；其原始数组可保留重复 ID，按位置访问得到字典才去重。首提示词无前文：普通容器是 None，flat 是空范围，取位置为 {} | logprobs.py 31–207；三版 fixture |
| 默认与全量成本 | max_logprobs=20，−1 将门槛解释为模型词表大小；logprobs_mode 默认 raw_logprobs，四种模式区分 logits/log-softmax 和处理前后。请求 −1 不绕过服务上限 | config/model.py 224–239；sampling_params.py 713–774 |
| prompt 的模式差异 | 基线 prompt helper 总算 log-softmax；rc/main 在两个 logits 模式下返回原始 logits，其余算原始 log-softmax，不应用生成采样处理链。不能把生成分布四模式一一套到 prompt | base gpu_model_runner.py 5399–5509；rc 5562–5679；main 5608–5725 |
| HTTP 负值夹断 | HTTP 生成 token 和候选 score 使用 max(score,−9999)，只设下界，正 logits 不会被压为 0；因此改 logits 模式后字段名仍叫 logprob，含义却已变 | 三版 completion/serving.py；chat_completion/serving.py |
| HTTP prompt 负值 | prompt 的辅助函数只替换负无穷，有限值 −10000 保留，不同于生成字段的下界处理 | base openai/engine/serving.py 475–487；rc generate/base/serving.py 305–317；main 376–388；三版 fixture |
| APC | prompt_logprobs 非 None 时，请求未显式指定 skip_reading_prefix_cache 则默认跳过读取；0 也启用这个默认。明确传 false 会保留 false，不能描述成无条件强制关闭全局 APC | SamplingParams.__post_init__；KVCacheManager.get_computed_blocks |

## Ascend 与 MTP 的独立风险判断

固定 Ascend 的普通 sampler 继承上游 forward/gather，在 AscendTopKTopPSampler.forward_native 中可见 processed_logits 和 processed_logprobs 分支。仅凭构造器遗留 TODO 不能断言四模式全不支持。启用 reduce sampling 会改成候选空间，不能把普通完整词表路径的编号与分数解释直接搬过去；本 GLM 配方默认未启用该开关。

固定 GLM、rc、main 的拒绝采样器均给 bonus sampler 传 max_num_logprobs=−1 和模式覆盖；其 metadata 保留指定 ID 映射。普通 sampler 却优先返回指定 ID 列，拒绝采样器继承的 _get_logprobs_tensors 只接收数量、目标/bonus 分数、已选编号，最后调用 gather_logprobs，没有指定 ID 的重新收集逻辑。因此不能把 logprob_token_ids 在 MTP 下写成稳定支持；先在未开启 speculative_config 的实例验证是可审计的使用边界。尚无 NPU 执行证据，不断言某种输入必然报特定异常。

三个上游固定提交的 sampler.forward 都未把 logprobs_mode_override 继续传给 sample。MTP bonus 的 processed 模式覆盖因此存在实现边界；最终文档应明确默认 raw 路径与需要额外验证的 processed bonus，不凭配置枚举宣称整套 GLM MTP 四模式已经实测。

## 正文复审与已修问题

2026-11-01 已实读三个页面正文及新增段落，对照本轮 sampling.before.md、prefill.before.md、prefix-caching.before.md 的实际 diff。sampling 保留原六词分布、温度、截断、偏置、penalty、噪声、种子、最少长度与 GLM MTP 的结论和演算；只将原有简短四模式句子替换为完整教学段。prefill 保留跨轮处理、预算与通信限制、状态标签、GLM 对照、未实测项；新增提示词评分没有改写普通生成的行数账。prefix-caching 只收窄请求跳过读取的前提并回链，不复制参数解释。

独立 preservation-check.json 记录：sources 原顺序保留（sampling 143→175、prefill 29→48、prefix-caching 25→25）；原别名全保留；sampling 的 6 个旧 calc、prefill 的 5 个旧 calc 全保留；机器审计尾逐字保留。这些机械对照辅助逐段语义审查，不能单独替代它。

| 级别 | 实际发现 | 修订与复核 |
|---|---|---|
| P2 | 初稿把 Python 指定 ID 与数量必须相等的校验搬到 rc/main HTTP，误称 Chat/Completion 数量要等于列表长度 | 已改为非空指定 ID 优先；真实转换 AST 的 12 项追加断言证实数量 0/1/7 均转换为 None |
| P2 | 初稿可能让人误以为指定列表中的实际 token 始终保留全词表 rank，忽略重复键后写覆盖 | 已明确指定 ID 路径不可据 rank 判断真实名次；三版追加断言证实 sampled rank 可被枚举覆盖 |
| P2 | 原 prefill-flow 的“每条请求取哪几行算词表分数”把普通生成行数写得过宽 | 图⑤已限定“生成采样”，caption 明确额外提示词评分另取行；流程、尺寸与布局保留 |
| P2 | 新增 community Ascend sampler 来源 111–171 未覆盖非 reduce 的 processed 分支 | 已改为 146–191，并将 rejection 来源扩到 185–260，复核已覆盖实际分支与 bonus 模式覆盖 |

独立阅读了 sampling-intuition、sampling-flow、prefill、prefill-flow、prefix-caching 的 YAML。已有采样直觉图表示抽取分布，正文新增说明清楚区分记录分布；prefill 首图保持普通自回归场景，图后增加未要求提示词记录的前提；流程图的生成行与额外评分已区分。prefix 图仅解释共享份数，参数边界回链正文，不需重画。

初学者复述检查：概率记录是沿实际输出/已知提示词位置附加数值，不增加输出候选或替换文字；对数概率是概率的自然对数，不是答案真实性的置信度。提示词的第 i+1 枚由第 i 个隐藏向量评分，第一枚无对应前文；开启会增加投影、归一化、传输，并默认放弃前缀读取。这些关键关系可由新增教学段及四位置对照表复述，未发现 P1 概念错误。

## 检索与浏览器复核

独立实际执行七个参数的 `pnpm -s wiki:find "参数名" --json`：prompt_logprobs 第一条 exact 命中 prefill，其余六个第一条 exact 命中 sampling。独立记录见 retrieval-results.json，结果保留三个固定版本标识。

独立查看主代理在桌面浏览器生成的 screenshots/01–18：两页首屏、采样直觉、新增 ln/exp 演算、参数和版本表、HTTP 示例、四位置错位表、首项空记录、流式与 echo/APC 边界、prefill-flow 的生成取行与说明均能正常阅读。表头、列与例子没有出现本批新增遮挡。图⑤限定为生成采样后与额外提示词评分不再冲突。这里只说明独立看过截图，不冒称独立操作了浏览器。

主代理实际点击的四条跨页链接记录在 link-results.json；独立对照实际 URL 与页面标题，sampling→prefill 版本差异、prefill→prefix 缓存条件、prefix→prefill 提示词评分、prefill→sampling 对数概率演算落点相符。主代理另发现旧 penalty 版本表的长类名导致横向溢出，将行名缩为中文并把完整 BatchChatCompletionRequest 放入相邻段；独立确认事实和类名保留。

核读本轮校验日志：check:content、wiki:lint、wiki:diagrams --check 通过；最终 wiki:audit 为 104/104，来源无无效 commit、缺文件或行号越界。首次 audit 的 sampling 免责句 3.5% 失败已通过措辞修订消除，MTP、reduce sampling、rank、HTTP −1、prompt 模式和未实测限制仍保留。此本地审计不证明所有外链或历史 raw 摘录的语义；独立源码核查范围以上述 63 份为准。

行内代码密度以汉字数计：sampling 和 prefill 教学正文分别约 0.81/0，含源码区约 5.11/4.98，每千字均低于 13；prefix 教学为 0，含源码区约 15.38，属于已有约 15.47 的下降，本轮只修改回链语句，不宣称该页全文已达到 13 的标准。三页教学角标均为 0，来源区角标与旧索引保留。

完整 CLI 别名补齐后，主代理的 ui-search-results.json 记录 17/17 查询成功，包括七参数、完整 --max-logprobs/--logprobs-mode、无前缀 CLI 名及中文别名；独立已核记录并查看 19/20 搜索截图。21 是表格首次修订的过程截图，仍有横向溢出，未用于声称问题关闭。继续缩短表头并把完整 SamplingParams、BatchChatCompletionRequest 放在相邻说明后，22 最终截图已无该横向滚动条；layout-widths.json 中 sampling 的 17 张表均 scrollWidth=clientWidth=961，prefill 的 8 张表均不超过父容器 961。独立实读最终文字，默认、范围、版本差异和完整类名均保留。

独立另查看 23/24 完整采样流程图的上、下部分及 25 Python 示例截图：已有 8 卡分工与 MTP 分支仍清楚，Python 循环按实际 token 取位置记录，指定 ID 的非 MTP 使用条件紧随示例。返回编号展示改成本页自足解释，写明 request return_tokens_as_token_ids=true 与 token_id:编号形式，去掉指向未讲该字段的 B7 段落链接，语义与已核返回器一致。

最终结论：七单元具备固定版本下的类型、默认、关闭/特殊值、入口、错误、成本、版本与 Ascend/MTP 限制；旧内容未重复重推或删减，新增查询可检索到唯一主页面。无需要用户决定的问题。仍待部署实测的是 NPU 延迟/内存、MTP 接受率与未承诺支持的组合；文档已保留这些限制，不把本轮受控 fixture 当作硬件或端到端证明。
