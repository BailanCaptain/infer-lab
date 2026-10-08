# structured-output：P5 写作与独立审查记录

## P5 写作记录（2026-09-28，第 06 批）

### 接手状态与本轮范围

本页由两位写手先后完成。上一位写手写完了全部 H2 与对照源码区、两张图（structured-output、structured-output-flow）和旧版信息清单 `scratchpad/p5/structured-output-facts.md`，在收紧页末讲结束编号（stop token）的那一段时额度用完，没有跑验证、没有写记录。本轮接手时 `git diff p4-checkpoint --stat` 为 +248 / −44，H2 依次是：怎样只写出合法格式、为什么需要与代价、GLM 双机走一步（§1–§5）、思考阶段／异步调度／收尾、常见误解、对照源码。上一位写手具体核对过哪些源码，本轮无从得知，下文「核心概念的实际核对」只写本轮亲自读过的位置。

本轮只改 `wiki/concepts/structured-output.md` 和新建本记录，没有改两张图、其他页、src、scripts、tests，不提交 git。

### 本轮修改

1. **H3「收尾」重写**。旧句「没写到可以结束的位置之前，输出只会因为请求取消或输出长度上限而停下」不完整：停止字符串在 API server 还原文字时匹配，命中后通知 EngineCore 中止请求（`output_processor.py` L668–681），不经过文法；`check_stop` 还有可选的重复检测（`sched/utils.py` L119–128）。现改为「结束编号要经 bitmask 放行」一段 + 「四种不经过文法的停止」列表（取消、max_tokens／上下文上限、停止字符串、重复检测），并注明停止字符串出现在 JSON 字段值里也会在那里断开。标题改为「格式写完才放行结束编号，别的停止照样截断」；全库没有指向旧锚点的链接。
2. **结束编号交给谁**。补一句依据源码的事实：对非 Mistral 分词器，vLLM 调 `xgr.TokenizerInfo.from_huggingface` 时不传 stop_token_ids（`backend_xgrammar.py` L60–63），由 xgrammar 自己从分词器读；三个编号是什么改为链接 [token](../../../wiki/concepts/token.md) 的「编号要落在 154880 行之内」一节（该页 L100），不在本页重述。是否覆盖三个编号仍列待核。
3. **前后一致**。第二屏「两条边界」和常见误解第 2 条，都把「取消或长度上限」补成「取消、长度上限或命中停止字符串」，第二屏加了到「收尾」的页内锚点。
4. **来源与源码区**。sources 追加第 38 条 `vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L130`、第 39 条 `vllm@0fc695fc:vllm/v1/engine/output_processor.py#L668-L681`；源码位置表加「收尾：停止检查、停止字符串中止」一行；证据索引补收尾一句（终态填全 1 见 [C4]、不传结束编号见 [C7]、第 38、39 条）。

### 数字的出处

- 词表宽度 154880、分词器 154856 个编号、154820 个普通条目：沿用 [token](../../../wiki/concepts/token.md) 已推导的结果，本页只链接。
- 请求上限 32、草稿数 3：链接 [关键参数](../../../wiki/concepts/glm-5-3-flash-two-node.md)，本页未重算。
- 一行 4840 个整数、19,360 B、128 行约 2.36 MiB：由上面三个数按「每 32 个编号一个整数」推得，页内标 [D]。
- logits 往返 1.18 MiB、37.8 MiB：本轮核对 `docs/mainline/03-sample-decode.md` L181、L184（§A5），与页面一致；fp32 副本 75.6 MiB 按每数 4 B 翻倍。
- 结束编号 154820、154827、154829：`docs/mainline/01-deploy-entry-schedule.md` L599。
- 教学词表的 logits 1、4、2、6、0、3、5、−1 与允许集合 1、4、6：旧版原数，属示意 [A]。

### 核心概念的实际核对（本轮亲自读过的位置）

| 结论 | 核对位置 | 结果 |
| --- | --- | --- |
| bitmask 在 EngineCore 进程、CPU 上填，时机是前向已派发、结果未取回 | `vllm@0fc695fc:vllm/v1/engine/core.py` L455–463（`execute_model(non_block=True)` → `get_grammar_bitmask` → `sample_tokens(grammar_output)`） | 一致 |
| 异步调度下上一步 token 未确认时推迟填表与采样，前向照常派发 | 同文件 L510–593（`pending_structured_output_tokens` → `deferred_scheduler_output`） | 一致 |
| 昇腾 V1 把整张 logits 拷到 CPU、转 fp32、施加、拷回并恢复精度，原因是不支持 torch.compile | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py` L2417–2424 | 一致 |
| 文法终态、或不该填的行填全 1（有符号 −1） | `vllm@0fc695fc:vllm/v1/structured_output/__init__.py` L59、L186–197 | 一致 |
| 并行填表门槛 128；MTP 下逐位置填一行、临时接受草稿，遇 −1 停止推进（其后行填全 1），填完回滚 | 同文件 L62–64、L240、L276–291 | 一致 |
| vLLM 不向 xgrammar 传结束编号（非 Mistral） | `vllm@0fc695fc:vllm/v1/structured_output/backend_xgrammar.py` L41–63 | 一致，已写入正文 |
| 请求结束条件：eos、stop_token_ids、长度、重复检测 | `vllm@0fc695fc:vllm/v1/core/sched/utils.py` L94–130 | 与新「收尾」一致 |
| 停止字符串在前端匹配后中止 EngineCore 里的请求 | `vllm@0fc695fc:vllm/v1/engine/output_processor.py` L668–681 | 与新「收尾」一致 |
| 官方双机命令不带结构化输出参数、不带 reasoning parser；glm45 只在 FAQ 的函数调用配置里；不支持关思考 | `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md`：双机命令 L269、L318（§5.2），parser 参数 L418–425（§9 FAQ），enable_thinking L154、L428–430；全文无 structured | 一致 |

其余结论（后端 auto 退路、单后端补丁、编译线程与 100 微秒、xgrammar 回滚深度、V2 kernel 与默认值、版本差异表）本轮没有逐行重读，只确认 `pnpm wiki:audit` 对本页 39 条来源的行号全部有效。

### 旧版信息清单勾选

对照 `scratchpad/p5/structured-output-facts.md`（旧版取自 `p4-checkpoint`，本轮确认 HEAD 与 p4-checkpoint 的本页正文相同），本轮按新正文逐条复核：

- F1–F5、F7–F25：全部在新版中找到，位置与清单所列一致（首节与直觉图、第二屏、GLM §1–§5、思考阶段／异步调度两个 H3、常见误解、源码区、待核）。
- F6（取消或长度上限会在格式完成前截断）：保留，并扩展为四种不经过文法的停止，见 H3「收尾」。
- F17（思考阶段）：保留并改写。旧版「不应从第一个思考 token 起无条件套用」在官方命令下不成立，因为命令里没有 reasoning parser；新版写成「取决于配置，官方命令从第一个输出 token 起就约束」，依据见上表教程行与 `__init__.py` 的 should_fill_bitmask／should_advance。
- M1：旧版 14 条 aliases 全部保留（脚本比对无缺失），另加 guidance、JSON schema、response_format；chapters 17 不变；relations 保留 one-request、token、speculative-decoding，另加 npu-model-runner、async-scheduling。
- 删除：无。

### 校验记录

| 命令 | 结果 |
| --- | --- |
| `pnpm wiki:lint` | 通过；19 处待留意均在其他页（vllm-ascend-overview、vllm-v1-shape 等的 mark-flood），本页无 |
| `pnpm wiki:diagrams --check` | 182 张图与 spec 一致；本页两张图无警告 |
| `pnpm wiki:audit` | 退出码 1，唯一失败在其他页：`concepts/gap-a5164fe10fa9184412f8.md` 的 `vllm@0fc695fc:vllm/utils/mem_utils.py#L256-L276` 行号越界。本页 39 条来源行号全部有效，2 条 GitHub URL 未联网验证 |
| 写作标准单页自查（用 `scripts/wiki/standard.ts` 的 checkStandard 在 scratchpad 跑本页；本页不在 standard-pages.json 名单内） | 无问题：正文内联代码 1 处（0.2／千字）、证据角标 0、calc 2 个、hedge 比例 2%、无超宽图 |

字数：正文由改写前 2,161 字符增至 15,120 字符（与 audit 的「正文 15120 字」一致），6 个 H2。

### 尚未核实

- 页末四条待核不变：编译、填表、V1 往返、MTP 接受率、格式正确率均无固定部署实测；154856–154879 是否被屏蔽、xgrammar 读出的结束编号是否覆盖 154820／154827／154829，缺 xgrammar 源码；无 reasoning parser 时思考段受约束对答案质量的影响；本部署是否默认开异步调度。
- 未截图、未起服务，浏览器验收留给审查环节。

## P5 审查（09-28）

审查员独立完成，只审不改页。严格串行、未启动子代理。

### 读取范围

- 正文 L79–L236 分两段读完（L79–158、L159–236）；frontmatter 只读了 L1–26、L67–78，来源区 L27–66 跳过。
- 「## 对照源码」（L237 起）只用 grep：五个 H3 齐全且顺序正确（L239 怎么开 / L252 会报什么错 / L263 开销和什么时候别开 / L269 版本差异 / L282 源码位置）；版本差异表头 L271 含 v0.23、v0.26、main。另 grep 了 L309–314 待核清单和 L252–262 报错表的关键词。
- 代码块、命令块未读；calc 两块读了（核算数字）。
- 偏差如实记录：核源码时有两处一次读了超过 40 行（`vllm/v1/engine/core.py` L505–559 共 55 行，`vllm/sampling_params.py` L930–973 共 44 行）。没有读取被拦，未跳过任何正文段。
- 未做浏览器验收（本模板不要求；写手记录里说留给审查环节，这一项仍未做）。

### 1. 初学者测试

只读前两屏能说出：「结构化输出是在模型打完分、采样之前，按请求要求的格式编译出一台文法状态机，每步算出一行 bitmask，把不合法候选的 logits 改成 −∞，于是只能选出合法 token；代价是 CPU 编译文法、每步填 bitmask、把 bitmask 作用到 logits（昇腾 V1 要整张 logits 往返 CPU），以及 MTP 草稿被文法截短。」——通过。

### 2. 核心概念（逐条对源码）

| 页面说法 | 位置 | 判定 | 证据 |
| --- | --- | --- | --- |
| bitmask 在 EngineCore（scheduler 侧）CPU 上算，前向非阻塞派发后再填 | L109、L163 | 对 | `vllm@0fc695fc:vllm/v1/engine/core.py#L455-L456`（execute_model non_block 后调 `scheduler.get_grammar_bitmask`）；`core/sched/scheduler.py#L1305-L1327` |
| chunked prefill 中间块不填 | L163 | 对 | `scheduler.py#L1317`（`not req.is_prefill_chunk`） |
| 作用到 logits 在 worker 侧；按请求 ID 重排、非约束行填全 1 | L173 | 对 | `vllm/v1/structured_output/utils.py#L44-L135` |
| 昇腾 V1 把整张 logits 拷 CPU、转 float、施加、拷回并恢复 dtype | L175 | 对 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2417-L2424` |
| 上游 GPU 实现在显卡上原地改写 | L110 | 对 | `utils.py#L109-L122` |
| V2 有 NPU Triton kernel；补丁默认不选 V2，靠环境变量 | L185 | 对 | `db701c1f:vllm_ascend/worker/v2/structured_outputs.py#L34-L66`；`patch/platform/patch_use_v2_model_runner.py#L14-L17`（无环境变量时 return False） |
| 四个后端；auto 先 xgrammar，失败退 guidance，少数退 outlines；lm-format-enforcer 只在显式指定时用 | L136 | 对 | `vllm/sampling_params.py#L940-L972`；`vllm/config/structured_outputs.py#L21`（默认 auto） |
| 一个引擎一个后端，由首个约束请求定下；昇腾补丁拒绝混用 | L138 | 对 | `structured_output/__init__.py#L125-L134`；`db701c1f:vllm_ascend/patch/platform/patch_structured_output.py#L46-L52`、`#L93-L101`（校验层）、`#L111-L122`（grammar_init 层） |
| 编译线程池 = CPU 核数一半；xgrammar 编译器 8 线程、缓存默认 512 MB | L144 | 对 | `__init__.py#L77`（`(cpu_count()+1)//2`）；`backend_xgrammar.py#L64-L69`；`vllm/envs.py#L1529` |
| 100 µs 是单次等待上限 | L144 | 对 | `structured_output/request.py#L48-L49`（`timeout=0.0001`） |
| external_launcher 下改同步编译 | L146 | 对 | `__init__.py#L47-L55` |
| bitmask 宽度取模型配置词表 154880 | L148 | 对 | `__init__.py#L133`（`model_config.get_vocab_size()`） |
| 缓冲 = max_num_seqs × (1 + 草稿数) | calc L154 | 对 | `__init__.py#L220-L229`；`--max-num-seqs 32` 见官方教程多机命令 |
| 并行填表条件：>128 个且无投机；本部署串行 | L165 | 结论对，理由略混（见 P3-1） | `__init__.py#L61-L69`（线程池只在 max_num_seqs>128 时建）、`#L239-L242`（每步分派条件） |
| MTP 每个位置一行；临时接受草稿、逐位填、回滚；−1 占位后停推进、后续行全 1；终态行全 1 | L167–L169 | 对 | `__init__.py#L186-L197`、`#L266-L291`；`backend_xgrammar.py#L118`（max_rollback_tokens = 草稿数） |
| 采样后文法拒绝 → 报错并终止请求 | L189 | 对 | `scheduler.py#L1462-L1475`（FINISHED_ERROR） |
| 下一轮草稿按文法截成最长合法前缀 | L191 | 对 | `scheduler.py#L1754-L1756`、`#L1783-L1786`（validate_tokens） |
| 无 reasoning parser → 从第一个输出 token 起填 bitmask、推进 | L199 | 对 | `__init__.py#L302-L320`、`#L322-L335`；`vllm/engine/arg_utils.py#L2173`（`--reasoning-parser` 进 structured_outputs_config） |
| 思考结束那一步先不推进；投机 + structural tag 例外当步推进 | L201 | 对 | `__init__.py#L341-L370` |
| glm45 = DeepSeek-V3 风格、默认思考模式的解析器 | L201 | 对 | `vllm/reasoning/__init__.py#L55-L58`（DeepSeekV3ReasoningWithThinkingParser） |
| 异步调度下上一步 token 未确认 → 前向照发、填表与采样推迟 | L207 | 机制对，但本部署状态写错、影响范围写窄（见 P1、P2） | `core.py#L524-L536`、`#L577-L596`；`core/sched/async_scheduler.py#L27-L29` |
| 停止字符串、max_tokens／上下文上限、重复检测、取消都不经过文法 | L215–L220 | 对 | `vllm/v1/core/sched/utils.py#L94-L120`（check_stop 含 eos、stop_token_ids、长度、repetition_detection）；停止字符串在前端 detokenizer 截断 |
| vLLM 不把三个结束编号交给 xgrammar，让它自己从分词器读 | L222 | 对 | `backend_xgrammar.py#L59-L63`：非 Mistral 分词器走 `TokenizerInfo.from_huggingface(tokenizer, vocab_size=...)`，不传 stop_token_ids |

### 3. 官方部署是否开启结构化输出

- 官方教程 `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 多机命令（L269–L340）没有任何 structured／guided／reasoning-parser／tool-call-parser 参数；FAQ（L416–L430）为函数调用另给 `--tool-call-parser glm47 --reasoning-parser glm45 --enable-auto-tool-choice`，并写明不支持 enable_thinking。
- 来源基线 `wiki/sources/glm-5-3-flash-baseline.md` grep structured／guided／reasoning／glm45 无命中。
- 页面 L124「官方双机命令没有为结构化输出加任何参数，按请求开启」、L199「官方双机命令没有配 reasoning parser」、L203「没有配工具解析器」都与教程一致。服务侧默认 backend=auto、enable_in_reasoning=False（`vllm/config/structured_outputs.py#L21`、`#L41`）。

### 4. 写手疑点：xgrammar 的结束编号能否覆盖 154820／154827／154829

- token 页 L95–L100 确认：三个编号是 `<|endoftext|>`、`<|user|>`、`<|observation|>`，均在特殊标记区 154820–154855；本页 L222 引用一致。
- vLLM 侧已核实：只把分词器对象和 vocab_size=154880 交给 xgrammar，自己的停止集合不传（`backend_xgrammar.py#L59-L63`）。
- xgrammar 侧无法用 grep 核实：本机没有 xgrammar（`python -c "import xgrammar"` 报 ModuleNotFoundError），wiki 仓 tools/ 下也没有 GLM 的 tokenizer_config／generation_config。**结论：维持「待核」，页面 L222 与页末 L312 如实标注，合格。**
- 给写手的线索（审查员记忆，不是证据，不能写进页面当事实）：xgrammar 的 from_huggingface 在没传 stop_token_ids 时大概率只取 `tokenizer.eos_token_id` 一个；如果 GLM 分词器的 eos_token 是 `<|endoftext|>`，文法到可结束位置时只放行 154820，另两个作为特殊标记被屏蔽。核实命令：在装有 xgrammar 的环境里对固定 revision 的分词器跑 `xgr.TokenizerInfo.from_huggingface(tok, vocab_size=154880).stop_token_ids`，同时打印 `special_token_ids`，一并回答 154856–154879 这 24 个编号的处理。

### 5. 数字

全部复算无误：154880÷32=4840；×4 B=19,360 B；128 行×19,360 B=2,478,080 B≈2.36 MiB；4×154880×2 B=1,239,040 B≈1.18 MiB；128×154880×2 B=39,649,280 B≈37.8 MiB；fp32 副本 79,298,560 B≈75.6 MiB。与底稿 `docs/mainline/03-sample-decode.md` L177–L184（all-gather 后 [4,154880]、bf16 1.18 MiB、满载 37.8 MiB）一致。154820／154856／24 行与 token 页 L95–L97 一致。32 请求、3 草稿与官方命令一致。

### 6. 篇幅与重复

- 15,120 字里，绝大部分是能在源码里逐条对上的机制细节（后端选择与混用、编译与等待、填表时机、MTP 多行与回滚、V1 往返、思考阶段两套判定、停止路径），作为问答底子有用，不是水分。
- 与 token 页、request-call-chain、one-request 第 5 站**没有整节重复**：L82（logits／采样）、L104（token≠字符）、L159（24 个空行）、L197（`<think>`）都是一两句带链接；request-call-chain L142、L150 只一句话指向本页。
- 唯一跨页重复推导：calc L179 第一行重新算了 R1 decode 的 logits 1.18 MiB，one-request L468、tensor-parallel L185 已推导过（见 P3-2）。
- 页内重复偏多：100 µs 讲了 3 遍（L144、L230、源码区），后端混用 3 遍（L138、L231、报错表），「常见误解」10 条几乎都复述正文，「开销和什么时候别开」L265 复述 L106–L111。符合模板结构，不算错，估计可压 10% 左右，不强制。

### 7. 有没有丢信息

- `git diff` 删掉的行对应旧版 5 个 H2（在采样前限制可选集合／从允许集合到一个 bitmask／文法在 CPU 侧维护／GLM 推理阶段与 MTP／昇腾 V1 与 V2 的 mask 成本），逐条在新版找到对应。
- 抽查旧版清单 6 条：F7（8 token 例、82、01010010 → L92、L96）✓；F11（异步编译、external_launcher → L144–L146）✓；F13（校验层与管理器层都拒绝混用 → L138 + 报错表 grep 到 `grammar_init`）✓；F15（按请求 ID 对齐 → L173）✓；F21（整张 logits、随行数增长 → L175 + calc + L229）✓；F23（V2 默认不启用、开启不证明兼容 → L185、L235）✓。
- F17 的改写（从「不应无条件从第一个思考 token 起约束」改为「官方命令没有 reasoning parser，所以从第一个输出 token 起就约束」）已对教程和 `__init__.py#L302-L335` 核实，改得对。

### 8. 链接与锚点

- 出链 10 类全部能解析：one-request `#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个`（one-request L392）、token `#编号要落在-154880-行之内`（token L89）、glm-5-3-flash-two-node `#部署前提`（L49）与 `#关键参数各管哪一步`（L74）、页内 `#收尾格式写完才放行结束编号别的停止照样截断`（L211），以及 async-scheduling、npu-model-runner、speculative-decoding 三页文件存在。
- 入链：request-call-chain L142、index L101／L241、warnings 三份巡检，均不带锚点，全部能解析。两张图 spec 与正文数字一致（8 个 logits、bitmask 0/1、屏蔽后取 6）。

### 9. wiki:audit

`pnpm wiki:audit` 退出码 1，唯一失败是 `concepts/npu-platform.md [hedge-ratio] 3.1%`，与本页无关。本页：evidence=C、正文 15120 字／6 节、来源 39 条，无失败项，只有教程 URL 未联网验证。正文无证据角标；calc 2 个分属两个 H3，表格与 calc 不相邻。

### 10. 打分：7／10

**P1**

- **P1-1 异步调度状态与底稿、兄弟页矛盾。** 位置：L209「本部署默认是否打开异步调度，主线底稿列为待核」、页末 L314。问题：底稿 `docs/mainline/03-sample-decode.md` L419–L424 已按源码判定本部署异步调度自动打开（`vllm@0fc695fc:vllm/config/vllm.py#L957-L997`，mtp 属于 EagleModelTypes、未开 disable_padded_drafter_batch、MultiprocExecutor 支持 → else 分支 `async_scheduling = True`，审查员已亲读确认）；request-call-chain L148 也写的是「按自动判定打开」。本页仍写「待核」，于是把「推迟采样」当成偶发分支。实际上异步调度打开时，受约束请求在稳态 decode 的每一步调度时都还带着上一步的占位（`async_scheduler.py#L27-L29`），所以每一步都走推迟分支（`core.py#L524-L536`、`#L577-L596`）。改法：删掉两处「待核」，写明「本部署异步调度按自动判定打开（链到底稿 03 第 24 条或 request-call-chain）」；在 GLM 走读第 3 节补一句：稳态 decode 下，本步的 bitmask 要等上一步结果处理完才填，填表仍与本步前向重叠。

**P2**

- **P2-1 推迟是整批的，没写出来，还和 L124 冲突。** 位置：L124「同一批里的其他请求照常采样」、L207、代价清单 L106–L111、L265。问题：`pending_structured_output_tokens` 对整个 SchedulerOutput 用 `|=` 汇总（`async_scheduler.py#L27`），推迟的是整批的 `sample_tokens` 调用（`core.py#L524-L536`）。批里只要有一个受约束请求处在 decode，同批不受约束的请求采样也要等上一步结果处理完。改法：L124 改成「其他请求不受屏蔽，但异步调度下要跟着一起推迟采样」；代价清单加第五处「异步调度下整批采样失去与上一步的重叠」；L234 的误解条目补上「整批」二字。

**P3**

- **P3-1** L165：「两个条件都不满足，并行用的线程池根本不会建」把两个条件混在一起了。线程池建不建只看 max_num_seqs 是否大于 128（`__init__.py#L61-L69`），「>128 个且无投机」是每一步是否分派到线程池的条件（`#L239-L242`）。改法：分开写，先说 max-num-seqs 32 ≤ 128 所以不建线程池，再说即使建了，开 MTP 也不走并行。
- **P3-2** calc L179 第一行重新推导了 R1 decode logits 1.18 MiB，one-request L468 已推导过。改法：这一行改成引用（「R1 一个 decode 步的 logits 1.18 MiB，推导见主线第 5 站」），calc 只留满载和 fp32 两行。
- **P3-3** 术语先用后讲：L111 首次出现「投机解码」「草稿」、L154／L165 首次出现 MTP，都没给一句解释；L146「TP rank」、L173「all-gather」没解释；L140／L199「结构化输出管理器」「管理器」是组件名，按术语规则应写 StructuredOutputManager。改法：L111 加半句解释并链接 speculative-decoding；其余首次出现时各补一句中文解释。
- **P3-4** L175「源码注释给的原因是：GPU 版用 torch.compile 优化这一步」：在固定上游 `utils.py#L44-L135` 中，apply_grammar_bitmask 已经不用 torch.compile（GPU 路径直接调 `xgr.apply_token_bitmask_inplace`），注释和上游对不上。改法：保留「注释这么写」，补一句「固定上游这个函数已不含 torch.compile，昇腾走 CPU 的真实原因未核」，免得读者把注释的理由当成事实。
- **P3-5** L222 与页末 L312 的结束编号待核：只写了「是否覆盖」，没写两种结果各有什么后果（只放行 154820 基本无害；一个都没识别出来，文法到终态前无法结束，只能等 max_tokens）。改法：补一句后果，并附上面第 4 节的核实命令。
- **P3-6** 页内重复（见第 6 节）可适当压缩，不强制。

### 结论

核心机制（bitmask 在 EngineCore CPU 生成、worker 侧作用、四个后端与 auto 回退、MTP 多行与回滚、思考阶段判定、停止路径）逐条对源码无误；官方部署说法与教程一致；数字全对。修掉 P1-1 和 P2-1 后可以通过。

## P5 修订记录（09-28，Opus 写手）

按上面「P5 审查」修 P1-1、P2-1 和 P3-1～P3-5；P3-6（页内重复压缩）未做，审查标为不强制。

- **P1-1 异步调度状态**：底稿 `docs/mainline/03-sample-decode.md` L417–L424 第 24 条与 `wiki/concepts/request-call-chain.md` L148、L249、L290 都写「未显式设开关，按自动判定打开」。本轮亲读 `vllm@0fc695fc:vllm/config/vllm.py#L957-L1001`（MTP 在 EagleModelTypes、未开 disable_padded_drafter_batch、执行器支持 → else 分支 `async_scheduling = True`），并 grep `vllm-ascend@db701c1f:vllm_ascend` 确认插件没有改写 `async_scheduling`。页面：H3 改名「异步调度：本部署开着，整批采样要等上一步」，写明按自动判定打开并链 request-call-chain、注明底稿 03 第 24 条同结论；补「decode 阶段每一步被调度时上一步 token 都未确认」、「填表时 NPU 仍在算本步前向」；删掉正文与页末两处「待核」（页末那条原写「底稿 01」也是错的）。启动日志 `Asynchronous scheduling is enabled.` 写进源码位置表作为运行时确认手段，与底稿 03 待核第 2 条、request-call-chain L249 口径一致。
- **P2-1 整批推迟**：亲读 `vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L35`（L27 对整个 SchedulerOutput 用 `|=` 汇总）与 `vllm/v1/engine/core.py#L515-L596`（标记为真时整批 `sample_tokens` 不发，先 pop 上一批、`update_from_output`、取草稿、填表后再发）。页面：L124 改为「不带约束的请求不受屏蔽，但采样跟着一起推迟」；代价清单由四处改为五处，加「异步调度下整批采样要等上一步」；异步 H3 加一段讲整批标记；「开销和什么时候别开」改为五处；常见误解补「整批」并新增一条「只有带 schema 的请求会变慢」；frontmatter 关系 note 同步。
- **P3-1**：并行填表拆成两道门槛——启动时 max-num-seqs > 128 才建线程池（`__init__.py#L61-L69`），每步 >128 个且无投机才分派（`#L239-L242`）；注明填表线程池与编译线程池是两个。
- **P3-2**：calc 删去 R1 的 1.18 MiB 一行，正文改为引用 one-request `#第二圈和第三圈decode-步一次验证-1--3-个-token`；calc 注释「前两行」改「第一行」。
- **P3-3**：L111 补投机解码、草稿、MTP 的一句解释并链 speculative-decoding；「结构化输出管理器／管理器」三处改 StructuredOutputManager 并首次出现时解释；TP rank 补解释并链 tensor-parallel；all-gather 改 All-Gather 并链 `collective-communication.md#all-gather`。
- **P3-4**：保留注释原话，补「固定上游 `utils.py#L109-L135` 已不含 torch.compile、GPU 路径直接调 xgrammar 原地改写」，实际原因移入页末待核（附需确认 `apply_token_bitmask_inplace` 能否处理 NPU 张量）。已亲读 `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2417-L2424`。
- **P3-5**：L222 补两种结果的后果（只认 154820 基本无害；一个都没认出则只能靠 max_tokens 等收尾）；页末待核补核实命令（`TokenizerInfo.from_huggingface(tok, vocab_size=154880)` 的 `stop_token_ids`、`special_token_ids`）。
- **来源**：frontmatter 加 `async_scheduler.py#L19-L35`、`config/vllm.py#L957-L1001`（39 → 41 条）；源码位置表加一行。
- **验证**：`pnpm wiki:lint` 本页无报错；`pnpm wiki:audit` 本页无失败项，正文 17003 字 / 6 节、来源 41 条，两条新来源行号有效。全库 lint／audit 仍有失败，均来自 `concepts/block-table.md`（summary 超 200 字，及 8 页 relation 指向它），不是本页。浏览器验收未做。

## P5 复审（09-28）

快速复审，只核对上面「P5 修订记录」里 P1-1、P2-1 两条是否落实，并重跑 audit。读取范围：本页 grep「异步调度|async|待核」、读 L207–L215；底稿 03 L415–L426；request-call-chain grep「异步调度」；固定上游源码两段各 ≤20 行。未读对照源码正文。

1. **P1-1 异步调度状态：落实。** 本页 L209 写明「本部署的异步调度是开着的：官方命令没写这个开关，vLLM 按自动判定打开」，链 request-call-chain 并注明底稿 03 第 24 条同结论；L114、L127、L240、L272 口径一致；源码位置表 L301 附 `vllm/config/vllm.py#L957-L1001` 与启动日志确认手段。与底稿 `docs/mainline/03-sample-decode.md` L419–L421（MTP 在 EagleModelTypes、未开 disable_padded_drafter_batch、MultiprocExecutor 支持 → `async_scheduling = True`）、`wiki/concepts/request-call-chain.md` L148、L290 一致。全页 grep「待核」只剩 L162（多出的 24 个编号）、L178（昇腾走 CPU 的原因）、L228（结束编号）和页末标题 L317，已无异步调度相关的待核。
2. **P2-1 整批推迟：落实。** L127 改为「同一批里不带约束的请求不受屏蔽……但本部署开着异步调度，它们的采样要跟着受约束的请求一起推迟」；L114 代价清单新增第五处；L213 讲整批标记；L241 新增误解「只有带 schema 的请求会变慢」；L272 开销改为五处。源码核对：`git show 0fc695fc:vllm/v1/core/sched/async_scheduler.py` L27–L29 对整个 SchedulerOutput 用 `|=` 汇总（仅跳过 prefill 中间块，条件是 `use_structured_output and num_output_placeholders > 0`）；`vllm/v1/engine/core.py` L524–L536 标记为假时立刻 `get_grammar_bitmask` + 整批 `sample_tokens`，为真时整批记入 `deferred_scheduler_output`。页面说法与源码一致。
3. **wiki:audit：本页通过。** `pnpm wiki:audit` 退出码 1，唯一失败项是 `concepts/block-table.md [schema] summary 超 200 字`，与本页无关。本页一行：evidence=C、正文 17003 字 / 6 节、来源 41 条；两条新来源 `async_scheduler.py#L19-L35`（文件 67 行）、`config/vllm.py#L957-L1001`（文件 2264 行）均为 ✓。

**剩余 P3（不阻塞）**

- L127「它们的采样要跟着受约束的请求一起推迟」没带条件；准确条件是受约束请求处在 decode、带着上一步占位（L114、L213 已写清）。可在 L127 补「处在 decode 时」四字。
- L209 链到 request-call-chain 未带锚点；底稿 03 第 24 条同时引了 `vllm/v1/executor/multiproc_executor.py#L511-L513`（执行器支持异步），本页源码位置表只引了 config 一处，可补。
- P3-6 页内重复压缩仍未做（原审查标为不强制）。

**分数：9／10。** P1、P2 已清零，可以通过。
