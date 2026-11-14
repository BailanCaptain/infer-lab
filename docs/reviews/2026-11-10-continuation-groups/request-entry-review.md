# API 入口与流式输出：独立审查

状态：**本组内容与视觉独审通过：186 项旧引文与 97 项新增补证分别验收，全部已发现 P1/P2 已修订并复审关闭。** 工程检查由根线程另记，本报告不代替其回执；也不证明全站完成、283篇官方全文读完或设备运行通过。独立审查者：`/root/groups_recompute_review`，2026-11-10。

## 范围与计数

冻结依据为 [manifest](request-entry-manifest.json)；API 126个旧来源中122个仍在队列，6/22/54/106已由前批闭合，本批不重计。Streaming64个全部纳入。共181个固定源码范围（累计8100引用行，81个固定文件）、4个URL occurrence、1个raw档案。全部固定范围已实际阅读；重复版本采用实际diff对已读段核验，未凭文件名或行号存在给语义通过。

逐项结果在 [旧项判断](request-entry-manual-judgments.json) 与 [新增判断](request-entry-new-manual-judgments.json)，每条保留原来源、页hash、原文hash、人工说明及相关发现。最终API193个sources，streaming94个；其中4项属于前批，未重复计入本次283项。raw2727行中53/53嵌入片段与固定git内容完全一致，仅记档案完整性。HF tokenizer.json完整解析，全部36个added-token记录及decoder/pretokenizer已读；144万行词表没有逐行人工全文阅读。tokenizer_config全文33行；Recipe两文全文233/116行。网络抓取与sha见 `.tmp/continuation-groups-2026-11-10/request-entry/review-url-integrity.json`。

先读写作标准、知识库使用规约、完整两页与4个图的YAML，再展开官方 online_serving/README、openai_compatible_server、renderer、serve_args母页与prompt_embeds79行。母页中的模型、工具、推理、多模态及内嵌协议链接需要展开，不能把母页读完记作全部子文读完；本组根审查者承担扩展官方覆盖，独审不冒领其阅读全文。本文独审补读的47个rc2跨度、9个Ascend补丁跨度、后续24个消费者/嵌入跨度及写手追加的其他固定原文，均已逐项实读或对已读全文作实际差异比较。9个补丁跨页重复引用等使最终新增occurrence为97，不能把跨度数直接相加当独立文档数。原始记录为 `.tmp/.../request-entry/review-rc2-evidence-additions.json`、`review-patch-evidence-additions.json`、`review-final-evidence-additions.json`；97项正式编号见新增判断，不加入186旧项计数。

## 发现与处理状态

| 编号/级别 | 实际问题、影响与证据 | 修法与状态 |
|---|---|---|
| RE-01 P1 | 两页初版1440×1100首两屏到图与机制，未见代价，违反初学者复述要求。原图不是问题，收益/代价位置过晚。 | 已在图前补短说明；首屏复验及最终两页4屏复看通过，关闭。 |
| RE-02 P2 | API首句将引擎输入概括为编号与采样，遗漏官方prompt_embeds输入与已有EngineCoreRequest嵌入字段；源码28、114及固定prompt_embeds文档。 | 首句限定纯文本主线；新节完整区分Chat内容/Completion整输入/多模态，形状校验、模板、上下文计数和未测边界已核，关闭。 |
| RE-03 P2 | “工具调用要另开”容易把auto条件推广到所有模式，普通HF named/required也要求parser但不等同enable-auto；0fc render/serving183–266、rc2 online_renderer197–233。 | 守卫、auto/named/required与应用执行职责已补；none默认仍给模板tools、exclude开关另排除，关闭。 |
| RE-04 P2 | 流式工具结尾统一说tool_calls不成立；0fc chat/serving816–828和rc2 748–775对named保留引擎finish原因。 | 已补named保留stop/length等引擎原因，auto/required实际产生调用才改tool_calls，关闭。 |
| RE-05 P2 | 表称基线两个单独parser、v26才组合；0fc已创建每choice组合parser并调用parse_delta。 | 四版表改为基线已组合，另有prompt推理边界辅助状态；来源84闭环，关闭。 |
| RE-06 P2 | rc含义含混；大部分表缺rc2；API将98dff2a8与84030bbe同时标main，新增rc2总述不能替代逐项核对。 | 四版表完成，rc2默认/校验/消费者分别核；YaRN及encoder-decoder边界保留；main统一84030bbe，98dff仅历史原文，关闭。 |
| RE-07 P2 | 原文只写SSEhelper迁移，读者无法配置；HTTPkeepalive不能替代响应中的SSE注释保活。 | 默认0、整数秒、非负校验、注释帧、代理条件、无token/usage语义及双向回链均核；旧两版无该选项，rc2/main有，关闭。 |
| RE-08 P2 | “内部ID以对外ID开头”忽略n>1的index_前缀，parallel_sampling52–94。 | 改包含关系并保留候选序号，关闭。 |
| RE-09 P2 | Ascend“入口不改/只有Kimi”“其他聊天补丁”过度概括。v26有recompute_chat包装；db/2c有空tool_calls序列化补丁；rc2有GLM53模板签名守卫。 | 已按真实imports与条件补四版，恢复字段限定私有请求，空列表不等于启用解析；没有补丁仅限所核入口，关闭。 |
| RE-10 P2 | “每步工作量与输出多长无关”把增量解码收益推广到所有输出拼接/解析；“有新token或结束才发”忽略KVtransfer/pooling分支。 | 改为避免重复全串解码，发送条件限定普通文本主线；正文、源码表与证据归档一致，关闭。 |
| RE-11 P2 | 三版嵌入校验不能统一称直接to_dense；v26改线程锁，rc2/main增加原dtype稠密化前预算。 | 新四版行与2GiB说明明确单张量numel×element_size、max_bytes>0条件、非HTTP/并发总限、旧版无该检查；新来源180–190，关闭。 |

额外引用精度已修：API旧16只覆盖长度错误，不含tokenizer+1具体实现，新增191补0fc params300–322；旧74截止auto判断首行，新增192补完整返回；旧38截止GenerationError分支开头，新增193补模板400与通用500。显式truncation_side与truncate_prompt_tokens非None的联合例外基线已存在，正文/源码表已一致。模型名LoRA/skip条件以来源5联合registry94判断；补丁目录说明不是实际加载证据，已追实际imports。新来源127–168、169–193、stream65–94已分组映射到结论并实看浏览器；停止串因果说明也已补回，未因四版表扩列丢掉适用场景。

## 初学者复述与视觉证据

修订后只读前两屏可复述：API前端把请求协议整理成引擎能接的输入，先留回程记录再送到引擎；模板/分词用CPU，每条在途请求的记录用主机内存，前端忙会增加进入模型前的等待。流式则把生成编号逐步转成片段，让人更早看到开头；代价是反复拼JSON和写持有的连接，字符不完整或停止串尾部缓冲会推迟可见文字。两项不再依赖页尾才能理解代价。

初次实际浏览器：5201、Chromium、1440×1100；2页、9figure（4机制/流程图和5calc）、18table，人工实看全部figure及表；81个唯一站内链接逐一实际点击通过。最终再次访问2页，新增后共19table；87个唯一站内链接（54+33）实际点击，URL与锚点全部通过；横向页面overflow false、pageerrors空。实际复看最终首两屏、两张流程图、新嵌入表和修改的四版表；其余原图与calc已在初审实看，4组图8文件字节未变。终验记录为 `.tmp/.../request-entry/review-final-browser/report.json`，最后仅来源索引与摘要的小改另实看4张截图并绑定当前页hash，见 `review-index-recheck/report.json`。

## 保留与交付边界

[保留清单](request-entry-preservation.md)的全部条目已对冻结before.zip与最终全文diff复验：机制、5个calc、GLM/R1固定数字、示意边界、误解、链接和待核均保留；错误概括有上述原文依据而修正。来源186旧+97新引用编号核对分别186/186和97/97。独审没有修改教学文件。

最终10文件快照、每文件hash和验收范围见 [独审验收清单](request-entry-independent-acceptance.json)，快照为 `.tmp/.../request-entry/review-accepted.zip`。页hash：API `a6718e3c924b96a7fc2d21b8ed4d9e6bb8ba70bdab5a442d4628ffd726b59ff2`，stream `efdd085f594212dd1b345d7468c1a2cb70af0a45e40d6e9c48fb57b8d7e073c6`。本报告范围内未关闭P1/P2：无。根线程本组最终[工程回执](request-verification.json)已回填：check:content、wiki:lint、wiki:audit、wiki:diagrams --check、build五项退出码均为0，原有lint警告保留；本次只补回执，不重冻页面或快照哈希。未运行NPU、GLM双机、Recipe服务或代理保活端到端测试，原待核限制已保留。
