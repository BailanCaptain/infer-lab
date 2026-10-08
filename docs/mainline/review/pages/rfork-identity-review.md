# rfork-identity 审查记录

## P5 写作记录（2026-10-02，第 21 批深改）

**改了什么**

- 字数（写作标准口径，对照源码之前的教学正文）：2,086 → 4,786 字；audit 口径全页正文 15,428 字 / 11 节。写作标准自测（用 scripts/wiki/standard 的 checkStandard 对本页单跑）：行内代码 0/千字、角标 0、对照源码 ✓、calc 0.42/千字、相邻块 0、图先行 ✓、免责 1.4%、图宽 ✓。改前角标 1 处（首节的 [A]），已去掉。
- 结构按「是什么 → 为什么 / 代价 → 怎么算 → 细节 → GLM 双机 → 常见误解 → 对照源码」重排，H2 依次为：
  1. 已经有实例在跑同一个模型，B 为什么还会借不到（钥匙 = 部署指纹 + 分片编号 + 主 / 草稿；直觉图；与请求无关）
  2. 为什么要逐字配钥匙，而不是看模型路径（切法 / 数值表示 / NZ 排布三种「同模型不同字节」；代价两面；四行小表：指纹 / seed key / 清单核对 / 租约各管什么）
  3. 钥匙怎么算：两次 SHA256（SHA256 先讲后用；calc 用真算出来的简化描述哈希演示「改一处整个变样」；分两次的排错好处）
  4. 部署指纹里写了什么（六组表；新增「EP 组大小一栏实际为空」、量化摘要只看模型配置、配置类带模块路径）
  5. 分片编号和角色：要的是其中哪一份（七行表；新增全局编号定 seed 端口、PP 组没建好也报错）
  6. 一个实例的几张卡，各借各的（补示例 Planner 默认 1 个名额、lru 挑选、A1/A2 混借的例子）
  7. 钥匙对上了，也不能证明权重内容一样（补清单核对能拦什么、拦不住什么）
  8. 「没借到」要分清是匹配不到，还是根本没问成（代码流程图；三类结果；示例 Planner 60 s 心跳清理；六步排查，写明指纹只在每个 TP 组编号 0 的 Worker 上 info 打印）
  9. 放到 GLM 双机：一次热启动要配 32 把钥匙（指纹里切分组的取值、第 r 号卡编号 calc、第 1 / 9 号卡对比说明 EP 编号为何必须进钥匙、32 把只链总览、日志看第 0 / 8 号卡、首启必回退链总览）
  10. 常见误解（6 条，新增 EP16、全局编号、日志看差异三条）
  11. 对照源码：怎么开 / 会报什么错（9 行表）/ 开销和什么时候别开 / 版本差异（v0.23、v0.26、main、工作版逐项一句，明细只链 rfork.md#版本差异）/ 源码位置（字段表 + 21 行位置表 + 来源对应 + 待核 6 条）
- 图：
  - wiki/diagrams/rfork-identity.yaml 重画为直觉图：上排钥匙三段（部署指纹 / 分片编号 / 主或草稿 → seed key）；下排 A、B 两个 TP2 示意实例各四把钥匙一一配对，C（BF16）指纹不同配不上。不标字节、不画 GLM 形状。
  - 新增 wiki/diagrams/rfork-identity-flow.yaml：代码流程图（取编号 → 算指纹 → 算 seed key → 问 Planner → 借到 / 匹配不到 / 没问成，后两者同一句日志回退；两处直接报错停下）。
  - 两张图都用 pnpm wiki:figshots 从 5193 截图看过（只读访问）：第一版直觉图 B 侧行标签被箭头压住，已把连线收短到 552；calc 里以数字开头的哈希被当成数值结果，已统一加「」改成文字结果，复截确认。
- frontmatter：summary 改写（173 字）；updated → 2026-10-02；aliases 加 compatibility fingerprint、RFork 部署指纹、RFork 兼容性指纹、is_draft_worker；relations 加 rfork / tensor-parallel / expert-parallel（builds-on）；sources 原 1–8 不动，末尾追加第 9–21 条。

**数字出处**

- rank r 的 TP 编号 = r mod 8、EP 编号 = r、PP 编号为空，主 16 + 草稿 16 = 32 把钥匙，seed 须同为 TP8 / DP2 / EP16 / W8A8、同 checkpoint、同 NZ 模式：01 §A0.8「在我们部署下的具体数字」与「适用条件」。
- 每卡 18 个专家、EP 组为全部 16 卡：D 页「部署前提」「16 张卡怎样分组」。
- 量化方式 ascend：D 页「怎么开」参数表。
- calc 里 6 个哈希前缀：本轮用 Python 按工作版同样的序列化（sort_keys、紧凑分隔）对三项简化描述实算，页内标明是简化描述。
- 60 秒、1 个名额：examples/rfork/rfork_planner.py 69–74 行默认值（示例 Planner，非生产）。

**核心概念对照了什么（本轮实际读过的源码）**

- 工作版 rfork@3284850b（tools/repos/rfork HEAD）：identity.py 32–104（规范化各分支）、107–142（结构描述含模块路径 + 类名）、145–157（版本查找顺序）、160–167（并行大小取值，EP 找 expert_parallel_size / ep_size，默认 None）、170–194（量化摘要只取 hf_quant_config 或 hf_config.quantization_config）、196–251（指纹字段与 ensure_ascii=True 序列化）、254–287（seed key 七项、ensure_ascii=False）；rfork_loader.py 73–80、112–172（草稿判定、EP / PP 编号与报错）、441–485（会话、tp_rank 0 打 info 指纹）、614–650（拿到空 → 回退日志）；planner_client.py 45–109（seed key 构造、Planner 地址检查、acquire_seed 分支）、246–264（心跳警告带 seed key）；session.py 360–370（端口 = 基础端口 + 全局编号）；examples/rfork/rfork_planner.py 69–74、96–124、192–213、251–256、449–466；Dockerfile 53–54（VLLM_TAG=v0.26.0）。
- vLLM v0.26.0（vllm@568afb3a）：config/parallel.py 只有 is_moe_model、没有 expert_parallel_size / ep_size；config/vllm.py 946–951（is_moe_model = model_config.is_moe）；distributed/parallel_state.py 1893–1906（EP 组 = DP × PCP × TP，稠密模型不建 EP 组）。vLLM v0.23（0fc695fc）的 ParallelConfig 同样没有这两个属性。
- 社区三版的明文 seed key：沿用 01 §A0.8 的差异表与 rfork 页 P5 记录中已核的结论（db701c1f 与 2c59ff10 的 RFork 目录 diff 为空，三版都是含节点编号的明文拼接），本轮未重读社区源码。

**旧版信息清单勾选**（清单在 13898c74 scratchpad\p5\rfork-identity-facts.md，F1–F27、G1–G13）

- F1：Qwen3-0.6B、TP=1 的例子换成 TP2 示意实例 A / B / C（TP=1 画不出分片编号）；「数值类型、版本、布局不同则指纹不同」保留在首节与指纹六组表。
- F2–F27：全部保留在新版对应节。F6「切分组含 EP 大小」按源码更正为「留了一栏但实际为空，EP 组大小由 DP、TP 与是否开 EP 隐含」；F10 补 PP 组未建好也报错；F17 排查顺序由 5 步扩成 6 步（先分「没问成」）；F27 行号更新（草稿判定 112–150、编号 153–172 等）。
- G1–G13：全部写入（G9、G10 分别进待核 1 与推断说明，G11 进源码位置）。

**疑点 / 未做**

- 无 P1 疑点。
- 底稿疑点（请主会话定夺是否改底稿）：01 §A0.8「怎么走的」第 3 步把指纹输入写成「TP/PP/EP/DP 大小」，按工作版配套的 vLLM v0.26.0，EP 大小那一栏取不到属性、实际为 None。本页按源码写，未改底稿。
- 推断（页内均标「按代码推断」并列入待核）：只差 PCP 大小时指纹分不出；transformers 换模块路径会改指纹；第 9 号卡错借第 1 号卡专家时清单可能拦不住。
- 验证：pnpm wiki:lint 本页 0 报错（期间一度因别页 rfork-transfer.svg 缺失整体报 x，非本页）；pnpm wiki:diagrams --check 285 张一致、本页两张图无提示；pnpm wiki:audit 本页 21 条来源全部有效（vllm@568afb3a 与 Dockerfile 等 5 条标「raw 未定位」，属本地摘录未建，不是行号问题），全库通过。

**跳过的内容**

- 想核我们部署下 weight_nz_mode 的默认值（ascend_config.py 264 行附近），那次读取被拦，跳过，改列待核 3。
- 未读 HANDBOOK、docs/plans/；frontmatter sources 区只按行号 grep 了 8 条代码路径用来对齐角标编号，未读其他内容。
- 过程中有一次对 scratchpad 草稿文件并行发了 3 个 Edit，违反了「严格串行」，之后恢复串行。

## P5 审查（09-29）

审查员：Opus 5.5 独立审查（2026-10-02，第 21 批）。只审不改页面、不改底稿。

**结论：7 / 10。学习顺序通过；`pnpm wiki:audit` 本页通过（21 条来源全 ✓，全库 ok）；`pnpm wiki:lint` 通过、本页 0 条提示。P1 1 条，P2 2 条，P3 5 条。**

### 初学者测试
只读前两屏能说出：新实例 B 的每张卡用「部署指纹 + 分片编号 + 主 / 草稿」合成的 seed key 去 Planner 逐字配对，配上了才能从 A 的显存读权重；代价是宁可错过不会错配，而且钥匙只看配置、不看权重内容，对上了还要靠清单核对兜底。

### 学习顺序
是什么（L61–79，TP2 示意实例 A / B / C + 直觉图）→ 为什么 / 代价（L81–98）→ 怎么算（L100–124，calc 用简化描述）→ 细节（L126–204）→ GLM 双机（L206–231）→ 常见误解 → 对照源码。基础节不含 GLM 数字，第一节末尾没有堆链接。通过。

### 旧版信息清单
清单存在（13898c74 scratchpad\p5\rfork-identity-facts.md，F1–F27、G1–G13）。抽查 F2（L65）、F4（L79）、F11（L165）、F13（L175）、F16（L192–195）、F18（L235–240）均在新版；另按 `git diff` 删除行逐条对照，F19–F24 的报错字符串、`is_draft_worker`、patch7 / `topk_indices_buffer`、`hf_text_config` 都还在（L246–272、L293、L303）。没有丢信息。但 F20「EP 组未建好报错」在新版被升级成「启动停下」，见 P1-1。

### 核心概念逐条对照（rfork@3284850b）
- 指纹字段与序列化：identity.py L196–251，与 L130–137 六组表一致；`ensure_ascii=True`（L248–250）。✓
- seed key 七项：identity.py L254–287；缺 model_url / 策略名报 RuntimeError（L263–268）。✓
- calc 六个哈希前缀：本轮用 Python 按 `sort_keys=True, separators=(",",":")` 重算，89f742e1f557 / 12e7efe7fe5f / 9de863023bcd / da8d663a9e46 / b7065bcaeda3 / 8334f814aba1 全部吻合。✓
- 草稿判定：rfork_loader.py L112–145（`runner_type == "draft"`、model type 以 `_mtp` 结尾、架构名以 `MTPModel` 结尾）。✓
- EP / PP 编号取法：rfork_loader.py L153–171。✓（报错后的去向见 P1-1）
- 指纹 info 日志只在 tp_rank 0：rfork_loader.py L73–75、L466–476；回退日志 L647–649。✓（L198、L229 对）
- Planner 地址缺失、404、非 200、缺项、端口 ≤0 / rank <0：planner_client.py L63–67、L69–109，全部在 try 里，被 L107–109 捕获成 warning 返回 None。✓
- seed 端口：session.py L364–369，基础端口 > 0 时才加全局编号（见 P3-3）。
- 示例 Planner 60 s 心跳、1 个名额：rfork_planner.py L71、L74 ✓；挑之前先清过期 seed 与租约：L192–198 ✓；**默认分配策略是 fifo 不是 lru**，见 P2-1。

### 底稿 01 EP 指纹核实
- 底稿位置：docs/mainline/01-deploy-entry-schedule.md L422，把兼容性指纹的输入写成「TP/PP/EP/DP 大小」。L511 写「seed 必须同为 TP8 / DP2 / EP16 / W8A8……否则指纹不同」。
- 源码：identity.py L233–235 确有 `expert_world_size` 这一栏，取值用 `_get_parallel_world_size(parallel_config, "expert_parallel_size", "ep_size", default=None)`；helper（L160–167）两个属性都取不到就返回默认值 None。
- 工作版配套 vLLM：rfork Dockerfile L54 `VLLM_TAG=v0.26.0`，即 vllm@568afb3a。它的 `ParallelConfig`（vllm/config/parallel.py）只有 `pipeline_parallel_size` L120、`tensor_parallel_size` L122、`prefill_context_parallel_size` L124、`data_parallel_size` L127、`is_moe_model` L161、`enable_expert_parallel` L163，**没有 `expert_parallel_size` / `ep_size`**。在 vllm v0.26.0 和 rfork/vllm_ascend 里 grep 对 `parallel_config.ep_size` / `expert_parallel_size` 的赋值或 setattr，命中 0 处（命中的 `ep_size` 都在 `FusedMoEParallelConfig` 或模型对象上，不是同一个对象）。arg_utils.py 里也没有 expert-parallel-size 参数。vLLM v0.23（0fc695fc）的 ParallelConfig 同样只有 `is_moe_model`（L152）。
- GLM 双机（TP8 / DP2 / EP16）下这一栏**不会被填上，恒为 null**。EP16 只能从 `tensor_world_size=8`、`data_world_size=2`、`expert_parallel_enabled=True`、`is_moe_model=True`（vllm/config/vllm.py L951 由 `model_config.is_moe` 填入）间接推出；vLLM 给 MoE 模型建 EP 组的规则是 DP × PCP × TP（vllm/distributed/parallel_state.py L1893–1906），而 PCP 大小不在指纹里。
- **结论：底稿错。** L422「EP 大小进指纹」与源码不符：键在，值为空。L511 的结论效果上仍然成立（EP16 由 TP、DP 和「开了 EP」隐含，PCP=1 时等价），但「否则指纹不同」不是因为 EP16 本身进了指纹。另外 L420 写 `ep_rank = get_ep_group().rank_in_group`，没写「开了 EP 且 is_moe_model 不是 False」这个前提（rfork_loader.py L155）。本页 L136–139、L210、L237 的写法和源码一致。建议主会话改底稿 L422。

### weight_nz_mode 默认值（写手被拦的待核 3）
核到了：rfork@3284850b vllm_ascend/ascend_config.py L262–269 按「additional_config 的 weight_nz_mode → 环境变量 VLLM_ASCEND_ENABLE_NZ」取值，envs.py L88 的默认值是 `int(os.getenv("VLLM_ASCEND_ENABLE_NZ", 1))` = 1；L263 注释写明 1 = 只有量化权重转 NZ（默认）。01 L306 已有同样结论。D 页和 01 的启动命令里 grep `VLLM_ASCEND_ENABLE_NZ` / `weight_nz_mode` 都没有设置，所以我们部署下应为 1（按代码推断，没有启动日志）。硬件排布策略（`weight_layout_policy`）本轮没核，待核 3 可以缩成只剩这一项（见 P3-5）。

### P1
1. **把「会回退」写成了「启动停下」**。位置：L163「会直接报错、启动停下，不会悄悄记成空」；L254 表格「两项配置缺一项，启动停下」；wiki/diagrams/rfork-identity-flow.yaml L26–27 的两处红字「报错停下」和 caption 里的「会让启动直接停下的错误，不会回退」。源码：`_ensure_rfork_session` 在 rfork_loader.py L563–565 的 `try` 里，这个 try 的 `except Exception as e`（L652–655）打 warning「RFork transfer failed: %s, clean up and fall back to default loader」，随后走默认 loader 从存储加载。只有 cleanup 返回 `RForkFallbackCleanupResult` 且 `can_schedule_seed` 为假时才中止（L667–671）；session 还没建出来时 cleanup_result 是 False，不会中止。所以缺模型地址或策略名、EP / PP 组没建好、规范化遇到自引用，都会回退到本地加载，不会让启动停下。影响：排错方向错。读者以为缺配置会起不来，实际是静默回退，还多了第三种日志（「RFork transfer failed …」），不在 L195 说的「同一句日志」里。改法：三处都改成「报错后被加载器捕获，打 warning `RFork transfer failed: …, clean up and fall back to default loader` 并回退到本地加载」；L189–202 的分类和排查步骤补上这第三种结果和对应日志；flow 图的两处红字改成「报错 → 回退」，连到回退框，并更新 caption。顺带改正 caption 的先后：钥匙在建空模型之前算（L565 早于 L572–577 的 `initialize_model`），问 Planner 才在建空模型之后（L612），不是「搭好空模型以后，先取编号」。

### P2
1. **示例 Planner 的默认挑选策略写反了**。位置：L169「默认挑最久没被借过的那个」；L316 源码位置表「默认按最久未借（lru），也可配 fifo」；写手记录也写成 lru。源码：examples/rfork/rfork_planner.py L49 `alloc_policy: str = "fifo"`、L75 环境变量默认 "fifo"、L110 Scheduler 默认 "fifo"、L580 帮助文字「default: … or fifo」。fifo 分支（L120–121）挑的是 `last_heartbeat_ts` 最早的 seed，lru（L123–124）才按最近一次被借的时间挑。改法：两处都改成「默认 fifo（挑最后一次心跳最早的那个），可配成 lru（最久没被借过的）」。
2. **术语没用英文原名**。L71「开了投机解码时」「[投机解码](speculative-decoding.md)」应写 speculative decoding（TERMS L64 的英文名；D 页 L183 也用英文）；L161「预填充 / 解码角色」应写 prefill / decode 角色（TERMS L39–40）。直觉图 caption「投机解码的草稿模型」同样要改。

### P3
1. 直觉图上排写着「再做一次 SHA256」（L73 引图），SHA256 到 L102 才解释；caption 里加半句「SHA256 是一种哈希，下文讲」，或者把图上的标注改成「再算一次哈希」。
2. 直觉图 caption 和 L77 几乎逐句重复；正文 L77 可以收成一句，只讲图里看不出的 C 为什么配不上。
3. L159、L238「全局编号决定 seed 端口」：只有基础端口 > 0 时才是「基础端口 + 全局编号」，为 0 时由系统随机分配（session.py L364–369）。补半句。
4. 草稿模型如果能完整复用主模型已经加载的权重，会在问 Planner 之前直接返回（rfork_loader.py L584–591，日志「RFork draft reuses all weights from the loaded target model.」），不会多一把钥匙去借。GLM 的 MTP 层有自己的权重，32 这个数不受影响，但 L165「各算各的指纹和钥匙」后面可以补一句这个边界。
5. 待核 3 可以缩小：weight_nz_mode 按上节已能核到（默认 1，我们的部署没覆盖），只剩硬件排布策略待核。另外 L139「vLLM 开了 EP 以后，EP 组的卡数等于……」：vLLM v0.26 对 MoE 模型不管开不开 EP 都会建 EP 组（parallel_state.py L1895–1896），措辞可以改成「EP 组的卡数按 DP × PCP × TP 算」。

### 浏览器实测
用 Playwright（1440×900，只读访问用户的 5193，没有起停服务）截了第一屏和两张图，存在本会话 scratchpad：rfork-identity-review-first.png、rfork-identity-review-fig1.png（直觉图）、rfork-identity-review-all4.png（flow 图）。第一屏是问题式 H2 + 定义 + 直觉图起头，控制台 0 个 error；直觉图的 A / B / C 三组对齐清楚，没有压字；flow 图三类结果的分支清楚，问题只在 P1-1 那两处红字。页面没有新加分镜动图。

### 运行的验证
- `pnpm wiki:audit`：exit 0；本页 21 条来源全 ✓（5 条标「raw 未定位」，不是行号问题）；全库「ok … 通过」。
- `pnpm wiki:lint`：exit 0，「ok wiki:lint 通过（另有 5 处待留意）」，5 处都不是本页。
- 全库入链：10 个页面链到本页，都不带锚点；lint 的跨页锚点硬校验通过。
- calc 哈希用 Python 重算，全部吻合。

### 跳过的内容
- 「## 对照源码」只读了 L246、L254–258（为核 P1-1），并 grep 了 L316 等个别行；五个 H3 齐全、顺序对，版本差异里有 v0.23 / v0.26 / main。其余正文没读。
- 代码块、frontmatter 的 sources 区、HANDBOOK、docs/plans/ 都没读。没有开子代理。
- 硬件排布策略 `weight_layout_policy` 的实际取值没核。
- 生产 Planner（仓库外）没法核。

## P5 修订记录（10-02）

逐条对应「P5 审查」，均对照 rfork@3284850b 源码改：

- **P1-1 把回退写成「启动停下」→ 已改。** 先核了 rfork_loader.py 535（session 初始为 None）、563–577（`_ensure_rfork_session` 在 try 里，早于 `initialize_model`）、652–671（`except Exception` 打 warning「RFork transfer failed: %s, clean up and fall back to default loader」，session 为 None 时 cleanup_result 为 False，不中止）、698–710（session 为 None 时回退后不起 seed 服务）。改动：
  - 「分片编号和角色」一节：PP / EP 组没建好改成「抛出报错 → 被加载器接住 → 警告后改从存储加载，启动不会停下；会话没建起来，回退后不登记成 seed」。
  - 「没借到」一节改名为「「没借到」要分清：钥匙没算出来、匹配不到，还是根本没问成」（全库无入链锚点），结果从三类扩成四种，新增「钥匙没算出来」及其日志；排查步骤加第 1 步「先找传输失败、回退的警告，看原始报错」，共 7 步。
  - 会报什么错：缺配置、自引用、EP / PP 组四行的后果改成「被接住后回退」，新增一行「RFork transfer failed …」；怎么开里缺配置的那句补「被接住、回退、启动不停」。
  - flow 图重画：上排改为「取编号 → 算指纹 → 算 seed key → 搭空模型 → 向 Planner 借」（顺序按 563–577 与 612 行）；算钥匙三步的报错用红虚线汇到新框「钥匙没算出来」，再连到回退框；回退框改为「改从存储加载，启动不停」；标出「回退后不登记成 seed」与「同一句『没有可用的 seed』」；caption 重写。figshots 截图核过，无压字。
- **P2-1 示例 Planner 默认策略 → 已改。** 核 examples/rfork/rfork_planner.py 49（`alloc_policy="fifo"`）、75、110、120–124。正文改成「默认 fifo，挑最后一次心跳最早的；可配 lru，挑最久没被借过的」；源码位置表同改，补来源第 25 项（45–50 行）。
- **P2-2 术语 → 已改。** 「投机解码」改 speculative decoding（首现处一句解释），「预填充 / 解码角色」改 prefill / decode 角色，并把「PD 分离」写成 PD disaggregation 加一句解释；直觉图 caption 同改。
- **P3-1：** 直觉图 seed key 框的副标题改成「再算一次哈希」。
- **P3-2：** 正文图下段收成一句，只讲 C 为什么配不上（量化方式属于部署指纹）。
- **P3-3：** 全局编号的端口说法补「基础端口为 0 时由系统随机分配」（表格、常见误解、源码位置三处）。
- **P3-4：** 「怎么判断自己是草稿」后补「草稿权重全部与主模型共用时直接复用、不问 Planner；GLM 的 MTP 层有自己的权重，不属于这种情况」，源码位置补 582–591 行（来源第 24 项）。
- **P3-5：** 「EP 组大小那一栏为什么是空的」措辞改成「vLLM 给 MoE 模型建的 EP 组，卡数按 DP × PCP × TP 算」；只差 PCP 的推断写明「按代码推出、没有实测，和本页其他推断一起列在页末」。
- **weight_nz_mode：** 核 ascend_config.py 262–269、envs.py 88，默认 1（只有量化权重转 NZ）；D 页与 01 的启动命令都没设。GLM 一节写明「启动命令没设，取默认 1」；源码位置加一行，来源加第 26、27 项；待核 3 缩成只剩硬件排布策略。
- **底稿 01：** 只改 docs/mainline/01-deploy-entry-schedule.md 第 422 行：输入列表去掉「EP 大小」，补 `is_moe_model`，写明 `expert_world_size` 有键无值及出处（identity.py 160–167、233–235；Dockerfile 54；vllm@568afb3a parallel.py 161、parallel_state.py 1893–1906）。
- **全库沿用旧说法（只报，未改）：**
  - wiki/concepts/rfork.md 第 105 行：「各并行组的大小」做成哈希，没区分 EP 那一栏为空。
  - wiki/concepts/rfork.md 第 248 行：「seed 必须同为 TP8、DP2、EP16、W8A8……否则指纹不同」，结论效果成立，但读起来像 EP16 直接进指纹。
  - docs/mainline/01-deploy-entry-schedule.md 第 511 行：与上一条同样的说法（底稿，按指示只改了 422 行）。
- **降免责时的处理：** 没有把推断改成确定说法。上一轮把「B 的卡 0 可能借到 A1」改成了「是常有的事」，属于没有证据的频率说法，本轮改回中性的「这种组合是允许的」。推断三条（PCP、transformers 模块路径、第 9 号卡错借）仍标「按代码推断」，集中列在页末来源对应与待核 5、6。

**验证**

- 写作标准（用 scripts/wiki/standard 的 checkStandard 单跑本页；本页不在名单里，audit 不打这一行）：5,238 字 · 行内代码 0.0/千字 · 角标 0 · 对照源码 ✓ · calc 0.38/千字 · 相邻块 0 · 图先行 ✓ · 免责 1.4%（2 句）· 图宽 ✓，全部 ✓。
- `pnpm wiki:audit` exit 0：本页 27 条来源全 ✓，全库 ok。
- `pnpm wiki:lint`：ok，本页 0 条。`pnpm wiki:diagrams --check`：285 张一致，本页两张图无提示。
- `pnpm wiki:figshots rfork-identity`（只读访问 5193）：两张图重截，新 flow 图分支清楚、无压字。

## P5 复审（10-02）

复审员：Opus 5.5 独立复审（P1 复审）。只审不改页面、不改底稿。源码一律对照 tools/repos/rfork@3284850b（rfork/source 下的 identity.py、rfork_loader.py 与之逐字节相同）和 tools/repos/vllm@568afb3a。

**结论：7.5 / 10。上轮 P1-1 已修好；上轮 P2 两条已修好；新 P1 1 条（上轮漏审的旧错），新 P2 0 条，P3 3 条。写作标准单跑全 ✓；`pnpm wiki:audit` exit 0、本页 27 条来源全 ✓；`pnpm wiki:lint` 通过、本页 0 条。**

### 上轮问题逐条核对
- **P1-1 回退 → 已修好。** 源码：rfork_loader.py L535 会话初值为 None；L563–565 `_ensure_rfork_session` 在 try 里；L652–655 `except Exception` 打 warning「RFork transfer failed … fall back to default loader」；L657–671 只在 cleanup 返回 `RForkFallbackCleanupResult` 且 `can_schedule_seed` 为假时中止，会话为 None 时 cleanup_result 为 False，不中止；L698–702 会话为 None 时回退后不起 seed 服务。页面 L169、L197、L204、L254、L262–267 和 flow 图都改成「被接住 → 回退、启动不停、不登记成 seed」，与源码一致。flow 图上排顺序「取编号 → 算指纹 → 算 seed key → 搭空模型 → 向 Planner 借」对照 L447–464（编号、指纹、会话）、L573（`initialize_model`）、L612（`acquire_seed`），正确。
- **P2-1 fifo → 已修好。** rfork_planner.py L49、L75、L110 默认 "fifo"；L120–121 fifo 按 `last_heartbeat_ts`，L123–124 lru 按 `last_used_ts`。页面 L175、L329、L345 一致。
- **P2-2 术语 → 已修好。** 页面和两张图的 yaml 里 grep「投机解码」「预填充」「PD 分离」均 0 处；L77 speculative decoding、L167 prefill / decode、PD disaggregation 首现都带一句解释。
- **P3-1～P3-5 → 已改。** 直觉图 seed key 副标题是「再算一次哈希」（rfork-identity.yaml L10）；L83 收成一句；端口说法对照 session.py L364–369 正确；草稿全复用对照 rfork_loader.py L584–591 正确；EP 组公式对照 vllm parallel_state.py L1893–1906 正确。

### 底稿 01 第 422 行
改后说法正确：identity.py L206–225 的输入是 model_url、strategy、revision、dtype、quantization、量化配置摘要、architecture；L226–238 并行组是 TP / PP 大小、`expert_world_size`、DP 大小、`enable_expert_parallel`、`is_moe_model`。`expert_world_size` 按 `expert_parallel_size` / `ep_size` 取值、默认 None（L160–167、L233–235）。rfork@3284850b:Dockerfile L54 `VLLM_TAG=v0.26.0`，`v0.26.0^{commit}` = 568afb3a；该版 `ParallelConfig` 只有 TP L122、DP L127、`is_moe_model` L161、`enable_expert_parallel` L163，没有这两个属性；在 rfork@3284850b 与 vllm@568afb3a 里 `git grep` 对这两个属性的赋值为 0 处。所以「有键无值」成立。

注意：写手记录说「按指示只改了 422 行」、511 行「只报，未改」，但当前 `git diff` 里 01 的 511 行也改了（改成「开 EP」并补一句 EP16 不单独进指纹）；rfork.md L105 也已带上「EP 组大小那一栏实际为空」。改后内容我核过是对的，只是和写手记录不符，应是别处改的，见 P3-3。

### weight_nz_mode 默认值 1 的出处
有出处：rfork@3284850b vllm_ascend/ascend_config.py L262–269（additional_config 的 `weight_nz_mode` → 环境变量 `VLLM_ASCEND_ENABLE_NZ`，注释写明 1 = 只有量化权重转 NZ，默认），envs.py L88 `int(os.getenv("VLLM_ASCEND_ENABLE_NZ", 1))`。页面来源第 26、27 项（frontmatter L45–46）和源码位置表 L323 都已挂上；D 页与 01 的启动命令里 grep 不到 `VLLM_ASCEND_ENABLE_NZ` / `weight_nz_mode`。L218「我们的启动命令没设，取默认值 1」成立。

### 降免责是否把推断改成了确定说法
没有。三条推断（只差 prefill context parallel 时分不出、transformers 换模块路径、第 9 号卡错借）在正文 L145、L153、L233 都还带「按代码推出 / 按代码推断」，页末 L348、L356–357 列着；L177 是中性的「这种组合是允许的」。GLM 一节 L216 仍标「推演，不是实测」。唯一一处新冒出来的无出处频率说法见 P3-1。

### 新 P1
1. **会话构造时的两项前置检查被漏掉，「没配 Planner 地址」归错了类，缺模型地址的报错原文也引错了。** 源码：rfork@3284850b session.py L38–44，`RForkSession.__init__` 一进来先查 `planner_url`，为空就抛 `ValueError: rfork_scheduler_url is required; configure it with model_loader_extra_config or RFORK_SCHEDULER_URL`；再查模型地址和策略名，为空就抛 `ValueError: RFork requires non-empty model_url and model_deploy_strategy_name`。这两处都在 `RForkPlannerClient` 构造（L48，也就是 `build_seed_key` 被调用）之前；而 `planner_url` 的默认值是空串（config.py L110）。所以：
   - 没配 Planner 地址时，`planner_client.py` L63–67 的 `_require_planner` 永远走不到，不会有「RFork planner seed acquisition failed」，也不会打「没有可用的 seed … registering this worker as a seed」；实际是 L652–655 的「RFork transfer failed: rfork_scheduler_url is required …」，会话为 None，回退后**不登记成 seed**——属于本页的「钥匙没算出来」那一类，不是「没问成」。
   - 缺模型地址或策略名时，日志里出现的是 session.py 的 `ValueError: RFork requires non-empty model_url …`，不是 identity.py L263–268 的 `RuntimeError: RFork seed key is not set …`（后者在正常流程里到不了）。
   - 页面错处：L198「没问成…或者 B 根本没配 Planner 的地址」；L202 说没问成「加载完把自己登记成 seed」且「更早会多一条向 Planner 要 seed 失败的警告」，对没配地址不成立；L205 第 2 步把 Planner 地址放在「向 Planner 要 seed 失败」下；L254「两者任一为空，`build_seed_key` 直接报错」；L262 报错原文；L269「没配地址」；flow 图 caption（rendered）「回复缺项或者没配 Planner 地址，是没问成」；源码位置表 L324 把 `_require_planner` 写成检查 Planner 地址的地方。
   - 影响：排错方向错。没配 Planner 地址的读者会按第 2 步去找一条不存在的警告，又以为回退后已经登记成 seed；按 L262 的原文 grep 日志也找不到缺模型地址的报错。
   - 改法：L197「钥匙没算出来」补上「没配 Planner 地址」，L198 删掉它；L202、L205 相应改；L254、L262 改成 session.py 的 `ValueError` 原文并说明发生在建会话时（`build_seed_key` 的同类检查是兜底，正常流程到不了）；L269 删「没配地址」；会报什么错表格补一行 `rfork_scheduler_url is required`；flow 图 caption 把「没配 Planner 地址」从「没问成」挪到「钥匙没算出来」（图上「缺配置」已覆盖，框不用改）；来源补 session.py L38–44，源码位置表补一行、L324 注明 `_require_planner` 在建会话已查过地址后实际到不了。这条是上轮审查漏掉的（上轮把 L63–67 记成 ✓），不是本轮修订引入的。

### 新 P2
无。

### P3
1. L145「prefill context parallel …多数部署取 1」是没有出处的频率说法。vllm@568afb3a parallel.py L124 默认值是 1、D 页没设，改成「默认 1，我们的部署没设」即可；L218「16 这个数由 DP 2 × TP 8 隐含」也可补半句「PCP 取默认 1」。
2. L169 说 PP / EP 编号的报错「和缺模型地址、策略名时的报错一样，发生在算钥匙这一步」：前者在 `_ensure_rfork_session` L447–448 取编号时，后者在建会话时（见新 P1），都在同一个 try 里，结论对；改 P1 时顺手把「一样」说清是「同样被接住」即可。
3. 写手记录与工作区不符：记录说 01 只改了 422 行、511 行未改，实际 511 行也改了（内容核过正确）。请主会话确认 511 行和 rfork.md L105 是谁改的，记录补一句。

### 浏览器实测
用 Playwright（1440×900，只读访问用户的 5193，没有起停 5193 / 8790）打开 http://localhost:5193/#/wiki/rfork-identity：第一屏是标题、摘要、问题式 H2「已经有实例在跑同一个模型，B 为什么还会借不到」、三项组成和直觉图起头，speculative decoding 链接正常；控制台 0 个 error；页面 4 个 figure。另截 flow 图：上排五步顺序对，「钥匙没算出来」红虚线汇入回退框、标「回退后不登记成 seed」，无压字；问题只在 caption 里「没配 Planner 地址，是没问成」（新 P1）。截图存在本会话 scratchpad：rfork-identity-recheck-first.png、rfork-identity-recheck-flow.png。

### 运行的验证
- `pnpm wiki:audit`：exit 0；本页「来源 27 条」全 ✓（3 条 vllm 来源标「raw 未定位」，不是行号问题）；全库「ok … 通过」。本页不在写作标准名单里，audit 不打本页的「写作标准」行。
- 写作标准单跑（scratchpad 下 std-check.ts，调 scripts/wiki/standard.ts 的 `checkStandard` + `formatStandard`，带图）：5238 字 · ✓行内代码 0.0/千字 · ✓角标 0 · ✓对照源码 · ✓calc 0.38/千字 · ✓相邻块 0 · ✓图先行 · ✓免责 1.4% · ✓图宽，problems 0。全 ✓。
- `pnpm wiki:lint`：exit 0，「ok wiki:lint 通过（另有 5 处待留意）」，本页 0 条；跨页锚点硬校验通过。

### 跳过的内容
- 「## 对照源码」只读了 L252–276（怎么开、会报什么错，为核 P1-1 和新 P1），并 grep 了 L323–329、L338–357 个别行；其余正文没读。
- 代码块、frontmatter 的 sources 区（只 grep 了 L44–46 三条）、HANDBOOK、docs/plans/ 都没读。没有开子代理。没有读取被拦。
- 硬件排布策略 `weight_layout_policy` 的实际取值、生产 Planner 仍无法核（页末待核 2、3 已列）。

## P5 修订记录（复审后，10-02）

- **新 P1 → 已改。** 核了 rfork@3284850b session.py 37–48（`RForkSession.__init__` 先查 `planner_url`，空就抛 `ValueError: rfork_scheduler_url is required; configure it with model_loader_extra_config or RFORK_SCHEDULER_URL`；再查模型地址与策略名，空就抛 `ValueError: RFork requires non-empty model_url and model_deploy_strategy_name`；都过了才在 48 行构造 Planner 客户端、算 seed key）、config.py 100–110（三项默认空串）、rfork_loader.py 464（会话在 `_ensure_rfork_session` 里构造，同在 563–565 的 try 内）。改动：
  - 「没借到」一节：「钥匙没算出来」补上没配 Planner 地址，并说明三项在建会话时先查；「没问成」去掉没配地址，改成「地址配了，但网络出错 / 别的状态码 / 回复缺项」；「没问成是连接或配置的问题」改为「连接或 Planner 本身的问题」；排查第 1 步列出三种缺配置，第 2 步改为「先查网络和 Planner 本身；地址填错但不为空也落在这一类」。
  - 分片编号一节（P3-2）：PP / EP 组报错改说「被加载器接住，和建会话时查出缺配置走同一条路」，不再说「一样、发生在算钥匙这一步」。
  - 怎么开：改为三项配置、默认空串，建会话时先查、为空抛 `ValueError`，被接住后回退、不登记成 seed；注明 `build_seed_key` 的同类检查正常流程走不到。
  - 会报什么错：新增两行建会话的 `ValueError` 原文（逐字取自 session.py 39–44），原 `seed key is not set` 一行改为「兜底检查，正常流程到不了」；`acquisition failed` 一行删去「没配地址」。
  - 源码位置：新增 session.py 37–48、config.py 100–110 两行；planner_client.py 45–67 一行注明 `_require_planner` 实际到不了。来源追加第 28、29 项，怎么开的角标改为 [C28][C29]，来源对应同步。
  - flow 图 caption：「没配 Planner 地址」从「没问成」挪到「钥匙没算出来」，「没问成」改为「地址配了但网络出错、回了别的状态码或者回复缺项」。图上框不变（「缺配置」已覆盖）。
- **P3-1 → 已改。** 「多数部署取 1」改为「vLLM 默认取 1」（vllm@568afb3a parallel.py 124，来源第 30 项）；GLM 一节补「prefill context parallel 我们的启动命令没设，取默认 1」（D 页未设）。
- **P3-3 说明：** 01 第 511 行和 rfork.md 第 105、248 行是我在上一轮修订之后，按主会话的第二次裁定改的；当时已在 rfork-review.md 末尾追加了修正说明。上一节「P5 修订记录（10-02）」写的「只报、未改」是那次裁定之前的状态。
- **同类错误在 rfork 章其他页（只报，未改）：** grep `seed key is not set`、`_require_planner`、`build_seed_key`、`rfork_scheduler_url`、「Planner 地址」与「没配…地址」，未发现同样的错归或错引。rfork-config.md 第 97、160、366–367 行的说法与源码一致（空地址 → 建会话 `ValueError` → warning 后回退、不当 seed）；rfork.md 第 264 行「缺一项建会话时就报错」、第 280 行 `acquisition failed` 的归类，以及 rfork-troubleshooting.md 第 197 行，都没有把没配地址归进去。

**验证**

- 写作标准（checkStandard 单跑本页）：5,295 字 · 行内代码 0.0/千字 · 角标 0 · 对照源码 ✓ · calc 0.38/千字 · 相邻块 0 · 图先行 ✓ · 免责 1.4%（2 句）· 图宽 ✓，全 ✓。
- `pnpm wiki:lint`：exit 0，本页 0 条。`pnpm wiki:diagrams --check`：287 张一致。
- `pnpm wiki:audit`：本页 30 条来源全 ✓；**全站 exit 1**，唯一失败在别页 rfork-lifecycle.md 的来源 `rfork_loader.py#L621-L711` 越界（文件 710 行），复跑一次仍在，不是本页，按纪律没动。

## P5 第二次复审（10-02）

复审员：Opus 5.5 独立复审（第二次 P1 复审）。只审不改页面。源码对照 tools/repos/rfork@3284850b 与 vllm@568afb3a（`git show`）。页面行号按当前工作区。

**结论：8.5 / 10。上轮新 P1 已修好；整页「出错 / 回退 / 报错」类说法逐条核了 30 条，错 2 条（都是 P2，不是本轮修订引入的）；新 P1 0 条，新 P2 2 条，P3 1 条。写作标准单跑全 ✓；`pnpm wiki:audit` exit 0、本页 30 条来源全 ✓；`pnpm wiki:lint` 通过；`pnpm wiki:diagrams --check` 287 张一致。**

### 上轮新 P1 → 已修好
- 分支顺序对照源码：rfork_loader.py L447–450 先取 PP / EP / TP 编号、算指纹；L464 才 `RForkSession(...)`；session.py L39–44 先查 `planner_url`、再查 `model_url` / `model_deploy_strategy_name`，都过了 L48 才构造 Planner 客户端（planner_client.py L53 算 seed key）。三项默认空串（config.py L100–110）。会话构造失败时 rfork_loader.py L535 的 `session` 仍为 None，L655 打 warning，L698 不起 seed 服务。
- 页面归类与之一致：L200「钥匙没算出来」含没配 Planner 地址、缺模型地址或策略名、并行组没建好、自引用；L201「没问成」只剩地址已配时的网络错 / 别的状态码 / 缺项；L205 的「更早多一条 acquisition failed 警告」只对没问成说；L207–208 排查两步、L257 怎么开、flow 图 caption（rfork-identity-flow.yaml L3）都改对了。`_require_planner`（planner_client.py L63–67）在源码位置表 L331 已注明正常流程到不了。
- 报错原文逐字比对：L265 = session.py L40–42；L266 = session.py L44；L267、L268 是 identity.py L264–268、L270–274 的前缀节选；L269 = identity.py L50；L270 = rfork_loader.py L161；L271 = L171；L272 = L655；L273 = planner_client.py L78；L274 = L108；L275 = rfork_loader.py L620、L649；L276 = planner_client.py L261。全部一致。

### 整页出错 / 回退 / 报错说法逐条核对（30 条）
✓ 28 条：L100 钥匙对不上只能回退；L150 自引用直接报错（identity.py L50）；L172 PP / EP 组没建好抛错、被接住、回退且不登记 seed（rfork_loader.py L153–172、L563–565、L652–655、L698）；L174 草稿全共用时不问 Planner（L584–591）；L186 清单任一项对不上就不传（manifest.py L164–260）；L200–203 四种结果；L202 示例 Planner 挑之前先清心跳超时的 seed（rfork_planner.py L192–199、L251–256）；L205 没问成和匹配不到同一句日志、前者多一条 warning（planner_client.py L107–108，rfork_loader.py L619–650）；L207 那句 warning 借到后传输出错也会出现（L623–624 → L655）；L208 地址填错但不为空落在没问成（L69–109 的 `except Exception`）；L209、L240 只有 TP 编号 0 打 info（L73–75、L466–477、L647）；L242、L287 第一次必然走回退；L257 怎么开；L265–271、L273–275 原文与含义；L278 示例 Planner 无名额也回 404、头信息不合法回 400（rfork_planner.py L454–458）；flow 图五个框与 caption。
✗ 2 条，见下面两条 P2。

### 新 P1
无。

### 新 P2
1. **L272「接住上面几类」一行把「借到以后传输出错」也说成「启动不会停下」，以偏概全。** 源码：rfork_loader.py L657–671，会话存在时先 `prepare_for_fallback`（session.py L274–286），清理结果的 `can_schedule_seed` 为假（seed 服务没停掉或已登记内存没清掉，types.py L47–49）时直接抛 `RuntimeError: RFork fallback aborted because seed service or registered memory cleanup failed; …`，启动停下。钥匙没算出来时会话为 None、不走这条，所以 L200 和 flow 图对「三种没借到」说「启动不停」是对的，错只在这一行把传输出错并进来。影响：借到后传输出错又清理失败的读者，按本表会以为不可能停机。改法：括号里的「以及借到以后传输出错」单独说「借到以后传输出错也在这里接住，但清理失败时会中止启动，见[启动页](rfork-startup.md)」，或干脆删掉这个括号，只讲算钥匙的报错。
2. **L276「seed 一侧」一行把首次登记失败也归到 `RFork heartbeat failed`。** 源码：首次登记在 session.py L388–392，`report_seed_once` 返回假就抛 `planner rejected the initial seed advertisement`，被 L415–418 接住打 `RFork seed service startup failed for global_rank=…`，外层 rfork_loader.py L104–108 再打「seed service startup failed; inference can continue」；心跳线程只在首次登记成功后才起（L393–407），且 `initial_delay=True`，所以 `heartbeat failed`（planner_client.py L261）只出现在登记成功之后的某次心跳。影响：seed 一开始就没登记上的读者 grep `heartbeat failed` 找不到。改法：意思栏改成「登记成功之后某次心跳没被接受（网络错或非 200）」；另起一行或半句写首次登记失败的原文 `RFork seed service startup failed … planner rejected the initial seed advertisement`，后果是这张卡照常推理、但不当 seed。

### P3
1. L207 第 1 步列「钥匙没算出来」的原始报错时漏了「描述里有容器引用了自己」，L200 和会报什么错表格 L269 都有；补上半句即可。

### 新改动有没有引入新问题、有没有把推断写成定论
- 本轮改动（L148 PCP 默认值、L172、L200–208、L221、L257、L265–267、源码位置 L329–331、flow caption）都核过，没有引入新错。L148「vLLM 默认取 1」= vllm@568afb3a config/parallel.py L124；L221「我们的启动命令没设，取默认 1」与 01 L69（pcp=1）、L105（2×1×8）一致。
- 推断仍带标注：L148「按代码推出的，没有实测」、L156、L236「按代码推断」、L219「推演，不是实测」。L208「地址填错但不为空也落在这一类」是 `except Exception` 的直接结论，不是推断，可以不加免责。

### 运行的验证
- `pnpm wiki:audit`：exit 0，全库「ok wiki:audit … 通过」（rfork-lifecycle 的越界已不在）；本页「来源 30 条」全 ✓。本页不在写作标准名单里，audit 不打本页写作标准行。
- 写作标准单跑（本会话 scratchpad\std-check.ts，调 `checkStandard` + `formatStandard`，带图）：listed=false；5295 字 · ✓行内代码 0.0/千字 · ✓角标 0 · ✓对照源码 · ✓calc 0.38/千字 · ✓相邻块 0 · ✓图先行 · ✓免责 1.4% · ✓图宽；problems 0。全 ✓。
- `pnpm wiki:lint`：exit 0，「ok wiki:lint 通过（另有 5 处待留意）」，本页 0 条。
- `pnpm wiki:diagrams --check`：287 张图与 spec 一致。
- 没有重新开浏览器截图：本轮图只改了 caption 文字，已在 rfork-identity-flow.yaml L3 核对，`--check` 确认 SVG 与 spec 一致。

### 跳过的内容
- frontmatter 的 sources 区、代码块、HANDBOOK、docs/plans/ 都没读；「## 对照源码」只读了 L253–288（怎么开、会报什么错、开销），版本差异和源码位置只 grep 了个别行（L291–294、L315–337）。
- 没有开子代理；没有读取被拦。

## P5 修订记录（第二次复审后，10-02）

- **P2-1 清理失败会中止启动 → 已改。** 核 rfork@3284850b rfork_loader.py 59（`FALLBACK_CLEANUP_MAX_ATTEMPTS = 2`）、657–671（会话已建时先 `prepare_for_fallback`，`can_schedule_seed` 为假就抛 `RuntimeError`）、types.py 45–49（`can_schedule_seed` = 服务已停且内存已清）。会报什么错表「接住上面几类」一行改为：算钥匙时的报错会话为空、直接回退、启动不停、不登记成 seed；借到后传输出错也打这句，但要先清理，清理失败就中止。新增一行逐字给出 `RuntimeError: RFork fallback aborted because seed service or registered memory cleanup failed; tensor owners remain retained. Refusing to allocate a second model while old weights are pinned.`（rfork_loader.py 667–671），后果为启动停下，链到启动页。源码位置表补一行，来源追加第 32 项（types.py 45–49）。
- **P2-2 首次登记失败归错类 → 已改。** 核 session.py 386–392（首次 `report_seed_once` 失败抛 `planner rejected the initial seed advertisement`）、413–418（接住后打 `RFork seed service startup failed for global_rank=%s: %s`）、rfork_loader.py 102–108（外层再打 `RFork %s model loaded from %s is ready, but seed service startup failed; inference can continue.`）；心跳线程在首次登记成功之后才起（session.py 394 起）。「seed 一侧」一行拆成两行：「首次登记」给出上面两句原文，后果是照常推理、不当 seed、心跳不起；「之后的心跳」保留 `RFork heartbeat failed for seed_key=...`（planner_client.py 261），限定在首次登记成功之后。源码位置表补一行，来源追加第 31、33 项（session.py 386–419、rfork_loader.py 96–110），来源对应同步。
- **P3-1 → 已改。** 排查第 1 步的原始报错清单补上「描述里有容器引用了自己」。
- **rfork 章其他页（grep `heartbeat failed`、`initial seed advertisement`、`seed service startup failed`、`fallback aborted`、「启动不会停下 / 启动不停」、「传输失败 / transfer failed」、「心跳 + 登记 / 失败」）：** 未发现同样的错。rfork.md 第 282–283 行把「传输失败 → 先清理再回退」和「清理失败 → 启动失败」分两行写，正确；rfork-transfer.md 第 321 行写明清理最多 2 次及 `can_schedule_seed`，正确；rfork-lifecycle.md（在审）第 352、354、357 行首次登记、心跳、回退中止三句分开，正确；rfork-startup.md（在写）第 205、207 行、rfork-troubleshooting.md（在写）第 195 行也没有同类错。没有改任何别页。

**验证**

- 写作标准（checkStandard 单跑本页）：5,306 字 · 行内代码 0.0/千字 · 角标 0 · 对照源码 ✓ · calc 0.38/千字 · 相邻块 0 · 图先行 ✓ · 免责 1.4% · 图宽 ✓，全 ✓。
- `pnpm wiki:lint` exit 0（本页 0 条）；`pnpm wiki:audit` exit 0，全站通过，本页 33 条来源全 ✓；`pnpm wiki:diagrams --check` 287 张一致。
