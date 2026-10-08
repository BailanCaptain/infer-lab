# vllm-ascend-overview 审查记录

## P5 写作记录（2026-09-28，写手 Opus 5.5，第 07 批）

### 改了什么

按「地图」定位深改整页：每一站只写一两句，再链到详细页。全页正文 5,937 字（`pnpm wiki:audit` 的「正文」口径，含对照源码与链接地址），≤6,000。

1. **第一屏「装上 vllm-ascend 以后，vLLM 里哪些部分换成了昇腾的？」**：一句话定义（上游决定这一步算什么，越过平台边界后怎么在 NPU 上算由它决定）+ 平台、Worker 两个词的白话 + 直觉图 + 图说明（实线每步走、虚线请求前完成）。
2. **第二屏「为什么做成插件，不直接改一份 vLLM？代价在哪」**：fork 与插件两条路、装包时登记 / 启动时被问，三笔代价（没接口只能打 patch、每个进程各做一遍、和上游版本绑得紧）。
3. **「两边各管什么：五个扩展点」**：平台、patch、模型、算子、配置各一句，分别链到 platform-plugin-registration、npu-platform、ascend-patch-system、platform-plugin-registration#模型入口…、quantization、ascend-config-system；P4 并入的「职责与状态归属」压成一段（状态归谁、排查从哪查起）。
4. **「一条请求走到这里：A0–A4 每站换了什么」**：落到 GLM 双机（2×A2×8、TP8 / DP2 / EP16、W8A8），A0 → engine-processes，A1 → global patch，A2 → kv-cache-spec，A3 → block-table，A4 → attention-qkv、linear-attention、sparse-attention、moe、expert-parallel。
5. **常见误解**六条：旧版三条找回（不是 fork、插件也碰上游、入口只交类路径），新增三条（「不在继承类就在 patch 里」、「调度与昇腾无关」、「哪个版本都能跑 GLM」）。
6. **「## 对照源码」**补齐五个 H3：怎么开（从旧版找回 entry point、_ensure_global_patch、NPUPlatform 类属性、五个接口位置）、会报什么错（新写，按现象 → 出在哪层 → 去哪页）、开销和什么时候别开（新写）、版本差异（四列：GLM 基线 / v0.23 维护 / v0.26 / main）、源码位置（换成 GLM 基线行号）。

图：`wiki/diagrams/ascend-vs-upstream.yaml` 重画。旧图三列（平台与实现选择 / 设备执行 / 模型与计算）没有上游调度，也没有边界，表达不了「上游调度 → 平台边界 → Ascend 执行侧」。新图上排是上游的请求接入 → Scheduler → Executor，中间一条分界线标「平台边界」，下排右列是 NPUWorker → NPUModelRunner → GLM 模型与算子（实线，每步走，另有一条回路「本步输出 / 交回引擎」），左侧是插件入口、NPUPlatform、Ascend 配置、patch、模型注册（虚线，启动时定路径；patch 的虚线伸过边界指向 Scheduler）。画布 900×510，四个 pins 沿用旧图、均在本页 sources 里。

frontmatter：summary 改成地图口径；aliases 并入旧版的昇腾插件、硬件插件、out-of-tree 插件、vllm_ascend；relations 增 glm-5-3-flash-two-node；`verified` 填三个分支；updated 2026-09-28；sources 由 21 条扩到 35 条（补回旧版的上游插件加载、Platform 基类、平台类属性、注意力后端与通信类位置、三版 setup.py、官方文档；P4 的状态归属来源全部保留）。

### 数字与出处

- 2×A2×8、TP8 / DP2 / EP16、W8A8：glm-5-3-flash-two-node「部署前提」。
- 20 个进程、16 个 Worker、入口清单读 19 遍：platform-plugin-registration「这张清单在本部署被读了 19 遍」与底稿 01 §A0.1。
- 59 个 patch 文件、三个 patch 只在 vLLM 不是 0.23.0 时导入：ls-tree 递归计数；ascend-patch-system「落到 GLM 双机」（平台侧两个、Worker 侧一个）。
- 逻辑块 640、两档页、5 个缓存组：kv-cache-spec summary 与正文；640 块号展开成 5 个 128：block-table summary。
- 34 层 KDA、11 层稀疏注意力、最多读 2051 个位置、42 层 MoE、288 选 8、EP16、MC2 / AllGather：one-request 第 4 站各小节、sparse-attention 与 expert-parallel summary / 正文。
- 两类注意力层在算子实现里自带后端：npu-platform「落到 GLM 双机」。
- 官方双机不传 JSON 键：ascend-config-system summary。
- `--quantization ascend` 由平台补进解析器：底稿 01 A0 第 6 步（platform.py 第 190–200 行，落在本页 [C8] 的 184–203 行范围内）。

### 版本差异怎么核的

按分工只用 `git -C tools/repos/vllm-ascend ls-tree --name-only <commit> <dir>`（含 `-r` 递归列目录），**没有读任何源码文件内容**：

- models/：db701c1f 有 glm5_next.py、glm5_next_mtp.py、glm5_next_multimodal.py；2c59ff10（v0.23 维护）和 2ed6cbba（v0.26）没有 GLM-5-Next 文件；baa023ad（main）是 models/glm5next/ 目录（model、mtp、multimodal、kda、attention、sparse_attn_indexer_kpool、kv_cache、config、cache_config、processor、ops/）。**「v0.26 没有 GLM 模型代码」「main 移到 models/glm5next/」两点核实。** 另发现 v0.23 维护分支同样没有。
- GLM 配置 patch：db701c1f 有 patch_glm5_next_config（另有 patch_glm5_next_mamba_scheduler），main 有 patch_glm5next_config；v0.23 维护分支只有 glm47 工具调用解析、工具调用流式两个 patch，v0.26 只有推理用量统计 patch。
- GLM 专用算子：db701c1f 的 ops/ 与 ops/triton/ 各有 kpool 状态压缩、lightning indexer；main 在 ops/triton/ 下有 kpool 尾部压缩、lightning indexer。
- patch_*.py（递归）：59 / 59 / 64 / 60，与旧版的 59 / 64 / 60 一致。
- 仓库根目录：只有 db701c1f 带 vllm_patch/0729.patch 与 glm-5-next-adapt-0826/（Transformers 补丁）。
- entry point 组数（2/5、2/5、3/6）沿用旧版已核结论，本轮未重读 setup.py；main 有 observability 目录（ls-tree 可见），与第三组入口指向一致。

### 旧版信息清单勾选

清单：scratchpad `p5/vllm-ascend-overview-facts.md`，旧版取自 0f97c8b 时的页面（156 行），共 46 条（F1–F46）。结果：**保留或改写保留 36 条，链接到别页 4 条（F6、F7、F21、F24），部分删除 1 条（F10），删除 5 条（F5、F15、F23、F29、F43）**，理由如下：

- **F10（部分）/ F15 / F29：Qwen 专属数字全部删除**——Qwen3.6-35B-A3B、「两颗昇腾 NPU」、「40 层里哪层是注意力、哪层选专家」、「那条请求跑的 200 步」。理由：主线已换成 GLM-5.3-Flash 双机，这组数只属于旧的 Qwen 单请求例子，留在页上会和 A0–A4 的 GLM 数字打架。F10 里「框架怎么知道是 NPU、注意力调哪个算子、卡间用什么库」三个问题本身保留为第一屏「平台回答一切硬件问题」。
- **F5：relations → who-owns-what 删除**——该页已在 P4 并入本页。
- **F23：旧图说明「每行左上游、右昇腾」删除**——图已重画。
- **F43：版本差异里 NPUPlatform 所在行（128 / 127 / 82）删除**——「行号随提交变化」由全库「引用必带 commit」的规范保证；本轮只允许 ls-tree，无法复核 GLM 基线的行号。
- 改写保留中需要说明的两条：F13「算法归上游，硬件归昇腾」改成「上游管这一步算什么，昇腾管在 NPU 上怎么算」（GLM 的模型代码在昇腾包里，「算法归上游」对本部署不成立）；F26「看到昇腾行为，要么在继承版本里，要么在补丁目录里，没有第三处」已过时，改成误解第 4 条并纠正。

P4 版（改写前 105 行）的内容：职责与状态归属的五行表压成一段；「模型权重常驻」一行和「仓库 / 组件 / 进程是三种划分」一句为控字数删去（进程划分见 engine-processes）；P4 正文上方的 [C1]–[C21] 角标全部移走，对应 sources 保留。

### 自查

- `pnpm wiki:lint`：通过（exit 0），本页 0 条；「另有 18 处待留意」均为他页。中途一度出现的 mark-flood（本页内联标记 64 处）已压到 21 处。
- `pnpm wiki:audit`：本页 35 条来源的文件与行号全部命中（无 ✗）；整体 exit 1 来自 concepts/rope.md 一条行号越界，与本页无关。
- `pnpm wiki:diagrams --check`：188 张图与 spec 一致。改图期间全量渲染一度被他页图（cpu-binding、mla）的报错挡住，本图用同一渲染函数单独写出，事后全量 check 一致。
- 写作标准（直接调用 `scripts/wiki/standard.ts` 的 measureStandard / standardProblems，本页不在强制名单）：problems 为空；对照源码之上角标 0、行内代码 0、免责句 0、calc 0；图宽 900；对照源码的 H3 依次为「怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置」。全页行内代码 12 个（约每千字 2 个）。
- 链接锚点：按 `src/content/wiki/anchors.ts` 的 headingSlug 逐个核对 7 个带锚点的链接（模型入口…、部署前提、三个「会报什么错」、两个本页「版本差异」），全部命中。
- 浏览器：本机 5193 前端打开 `#/wiki/vllm-ascend-overview`，控制台无报错，标题层级与上述结构一致，直觉图与版本差异表正常渲染（Playwright 截图，桌面 1440 宽）。第一次打开时被他页缺 mla-intuition.svg 导致 reader 快照 500，等对方补图后重试通过。

### 仍待核

1. GLM 基线根目录的 vllm_patch/0729.patch 是否在构建镜像时应用到 vLLM（来源基线页只确认了 Transformers 补丁）。若应用，「不改 vLLM 一行代码」对 GLM 镜像要加限定。
2. entry point 组数（2/5、2/5、3/6）本轮未重读 setup.py，沿用旧版结论。
3. 平台类属性（OOT、npu、ASCEND_RT_VISIBLE_DEVICES、PrivateUse1、eager）仍引 v0.23 维护分支 2c59ff10 的行号，GLM 基线上的对应行号未定位。

## P5 审查（09-28）

审查员：Opus 5.5（独立审查，未启动子代理）。纪律：串行读文件，**未读任何源码文件内容**，版本事实只用 `git ls-tree --name-only`。

**评分：8.5 / 10。** 无 P1。地图定位站得住，抽查各站说法与详细页全部对得上；扣分在「算子」这一站没有出口、A4 一站超出地图口径。

### 初学者测试（只读前两屏，60–83 行）

> vLLM 负责接请求、排调度、决定每一步算什么；vllm-ascend 是另外装的一个包，计划越过平台边界之后，用哪个 Worker、哪份模型代码、哪些算子和通信库都换成昇腾的实现。代价是上游没留接口的地方只能在运行时改掉上游函数（GLM 基线 59 个 patch 文件），每个进程都要各做一遍，而且和上游版本咬得紧。

前两屏能独立答出「是什么 + 代价在哪」，不需要往下翻。定位句（62 行）和三笔代价（80–82 行）各自成立。

### 地图准确性：抽查 10 项、覆盖 5 站，全部一致

| 本页说法 | 行 | 详细页证据 |
|---|---|---|
| 20 进程 / 16 Worker 各守一张卡 | 100 | engine-processes.md:133、152、158 |
| 入口清单在 19 个进程里各读一遍 | 100 | platform-plugin-registration.md:129–140（19 = 1 前端 + 2 EngineCore + 16 worker，差的第 20 个是 DP 协调器） |
| 平台选中 NPUWorker | 100 | npu-platform.md:104（本部署非 310P、未开 xlite，落常规分支） |
| 补上 W8A8 用的昇腾量化选项 | 100 | npu-platform.md:165（`ASCEND_QUANTIZATION_METHOD` 追加进 `--quantization` 候选，所以 `ascend` 不是上游自带取值） |
| NPUWorker 把几档 decode 批量录成图 | 100 | glm-5-3-flash-two-node.md:85、276（第七步，7 个尺寸 4…128） |
| 一个 global patch 让 vLLM 0.23.0 认得 GLM 配置 | 101 | ascend-patch-system.md:176（glm5_next_config → 由此认得 GLM 并按 MLA 解析）；平台侧即 global 见 engine-processes.md:337 |
| 逻辑块 640、四类状态→两档页→5 个缓存组 | 102 | kv-cache-spec.md:5、129、139–143、205；被换掉的函数见 ascend-patch-system.md:178、180 |
| 5 个缓存组各一张 block table，full 组 640 展开成 5 个 128 | 103 | block-table.md:5、144、170–176 |
| 45 层 = 34 层 KDA + 11 层稀疏；最多读 2051 个位置 | 104 | sparse-attention.md:135、139（2051 = 2048 + 3，是容量不是实际选中数） |
| 42 层 MoE、288 选 8、EP16、按 token 数在 MC2/AllGather 间选路 | 104 | expert-parallel.md:63、171、181、183（本部署前两个条件恒成立，只剩宽度 ≤128 这个门槛） |

锚点：7 个带锚点的链接逐个核到目标标题（platform-plugin-registration.md:123 与 :189、glm-5-3-flash-two-node.md:49、ascend-patch-system.md:248、npu-platform.md:173，本页 #版本差异 142）。19 个页面目标 + `../sources/glm-5-3-flash-baseline.md` 全部存在。全库指向本页的链接（index.md:41 与 :157、TERMS.md:80、vllm-ascend-repo-map.md:24、vllm-v1-shape.md:89）都不带锚点，无断锚。图 `wiki/diagrams/ascend-vs-upstream.yaml` 与 `.svg` 都在。

### v0.23 也没有 GLM 代码：核实通过

`git -C tools/repos/vllm-ascend ls-tree -r --name-only <commit> | grep -i glm`，只看 `vllm_ascend/` 下：

- `db701c1f`（GLM 基线）：13 个文件——models 三个、ops 四个（含 triton 两个）、patch 四个、transformers_utils 两个。
- `2c59ff10`（v0.23 维护）：**只有** `patch_glm47_tool_call_parser.py`、`patch_glm_tool_call_streaming.py`。无模型代码、无配置 patch、无专用算子。
- `2ed6cbba`（v0.26）：只有 `patch_glm_reasoning_usage_accounting.py`。
- `baa023ad`（main）：`models/glm5next/` 目录 17 个文件 + `ops/triton/` 两个 + `patch_glm5next_config.py`。

patch 文件数按 `patch_*.py` 递归计数：**59 / 59 / 64 / 60**，与 150 行表格一致。148–149 行的「无 / 无」和 113 行误解第 6 条都成立。写手新发现（v0.23 维护分支同样没有 GLM 代码）**确认**。

### 全库 v0.23 列排查：无人声称 v0.23 有 GLM 代码，但四页把 db701c1f 标成了「v0.23」

正面表述全部正确，六处显式区分了两个提交：kv-cache-spec.md:304–309（GLM 分支单独放在「本页镜像 db701c1f」列，v0.23 列写「无 GLM 分支」）、ascend-patch-system.md:265（「本部署 db701c1f」与「v0.23 2c59ff10」分列）、platform-plugin-registration.md:209 与 :232、moe.md:244（「本站钉住 db701c1f；维护分支 2c59ff10」）、matmul-and-weights.md:237 与 quantization.md:202（都写了「不能仅凭同属 v0.23 就互换执行源码」）、learning-guide.md:99。

**但下列四页的版本表把 GLM 基线提交 `db701c1f` 直接标成「v0.23」列（只列不改）：**

| 页面 | 行 | 表头写法 | 为什么判为有问题 |
|---|---|---|---|
| ascend-config-system.md | 222 | `v0.23（db701c1f）` | 列里是 db701c1f 的配置键构成（226–227 行），却以「v0.23」名义给出 |
| data-parallel.md | 230 | `v0.23（db701c1f）` | 最直接：该页主题是 GLM MoE 的 DP 行为，源码表 251 行引 `db701c1f:vllm_ascend/models/glm5_next.py`，而版本表把这个提交叫「v0.23」，读者会推出「v0.23 有 GLM MoE 代码」 |
| engine-processes.md | 334 | `v0.23（db701c1f，本页）` | 336–341 行六行全是 db701c1f 的行号（`__init__.py:21`、`platform.py:188`、`worker.py:110` 等），以「v0.23」名义给出 |
| npu-platform.md | 200 | `v0.23（db701c1f）` | 207 行「`check_and_update_config` 的起始行 450」是 db701c1f 的值，标在「v0.23」列下 |

判定依据：`db701c1f` 与 `2c59ff10` 是两个不同提交，ascend-patch-system.md:275 明确写了两者「文件数相同，内容不同」（本部署多两个 GLM 专用 patch，少 `patch_async_swa_kv_lifetime`、`patch_shm_broadcast`，同名 `patch_balance_schedule` 内容也不同）。本页 146 行用四列把两者分开，是全库最准的口径；上述四页用三列且把基线并进 v0.23，与本页直接冲突。**本页不需要改；建议后续统一为本页的四列口径，或在表头写「本部署镜像 db701c1f（非 v0.23 维护分支）」。**

### 删掉的 5 条 + 部分删掉 1 条：理由逐条成立

- **F10（部分）、F15、F29 删 Qwen 专属数字**（Qwen3.6-35B-A3B、两颗 NPU、40 层、200 步）：成立。主线已换 GLM-5.3-Flash 双机，这三组数只服务旧的 Qwen 单请求例子，留下会与 A0–A4 的 GLM 数字并列打架；按「数字只在单一出处推导」，Qwen 的数在本库另有出处。F10 的三个问题（框架怎么知道是 NPU / 注意力调哪个算子 / 卡间用什么库）保留为第一屏「平台是 vLLM 回答一切硬件问题的对象」（64 行），未丢。
- **F5 删 `who-owns-what` relation**：成立。该页 P4 已并入本页，目标不存在，保留就是坏链；内容落在 94 行「状态也按这条线分」一段。
- **F23 删旧图说明「每行左上游右昇腾」**：成立。图已重画为「上游调度 → 平台边界 → Ascend 执行侧」，旧说明不再描述任何现存元素。
- **F43 删 NPUPlatform 所在行（128/127/82）**：成立。行号由「引用必带 commit」的 sources 承担（本页 17 行 `2c59ff10:platform.py#L96-L146`），正文重复一遍只会漂移；且本轮只允许 ls-tree，无法复核基线行号。

结构层面未丢信息：`git show 0f97c8b` 的 8 个 H2/H3 逐个有落点（「上游留了五个口子」并入 对照源码「怎么开」第四段，教学区改用五个扩展点分组）；`git show HEAD`（P4 版）只有 5 个 H2 且**整个 对照源码 缺失**，新版补回五个 H3（117/127/138/142/155 行，顺序为 怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置，全对），版本差异里 v0.23、v0.26、main 齐全（146 行表头）。这是本轮实质改进。

### 五个扩展点的一句话概括

| 扩展点 | 行 | 判定 |
|---|---|---|
| 平台 | 88 | 准。「启动时校验并改写配置，回答 Worker、注意力后端、通信类各用哪个」与 npu-platform.md:61、67、136–139 一致，「校验+改写在启动同一次调用、答名字在稍后」两个时刻没被压错。 |
| patch | 89 | 准。「上游没留接口处替换函数或类，分平台侧和 Worker 侧两类」与 ascend-patch-system.md:113、168–170 一致。 |
| 模型 | 90 | 准。「在模型注册表里把 GLM 的架构名指向昇腾包里的实现」与 platform-plugin-registration.md:125、127 一致，且 127 行强调的「只建映射、不建层不读权重」没有被本页说过头。 |
| 算子 | 91 | 内容准，**出口缺失（见 P2-1）**。「注意力、MoE、量化矩阵乘和卡间通信在 NPU 上的实现」四类都有对应页：注意力→attention-backend-family.md（标题「注意力后端：模型机制、状态布局与设备实现的连接」，H2 含「稀疏 MLA 路径使用位置索引」「KDA 路径使用递推和卷积状态」）、总入口→ops-and-kernels.md（标题「算子与 kernel：从数学语义到设备实现」，H2 含「框架怎样把算子交给设备实现」「GLM 的两个具体入口」）、卡间通信→cann-hccl.md（标题「CANN 与 HCCL：计算、通信和物理链路」，summary 写「HCCL 负责组内通信」）、量化矩阵乘→quantization.md。四类划分与这些页的标题对得上，没有错分。 |
| 配置 | 92 | 准。「命令行、附带的 JSON、环境变量三路开关汇成每个进程的 Ascend 配置」与 ascend-config-system.md 一致；「官方双机不在附带 JSON 里传任何键」在 123 行另有交代。 |

### 篇幅：整体守住地图口径，A4 一站超出

五站字符数：A0 299、A1 168、A2 238、A3 265、**A4 504**。五个扩展点五条 129–220，匀称。A4 一条塞进 45 / 34 / 11 / 2051 / 42 / 288 / 8 / EP16 八个数和 5 个链接，是其余四站的两倍，已经不是「一两句 + 链接」。这些数都是结论加链接、没有在本页重做推导，所以不违反「数字只在单一出处推导」，但确实与 sparse-attention、expert-parallel 的第一屏重复。其余各段没有和详细页重复的推导；对照源码的版本表与源码位置属于该节应有内容。

### 问题清单

**P1：无。**

**P2-1（本页，必须改）｜位置 91 行｜「算子」是五站里唯一没有出口的一站。** 该 bullet 只链 quantization.md；ops-and-kernels.md、attention-backend-family.md、cann-hccl.md、collective-communication.md 四页**全库都没有被本页链接**（本页 26 个链接目标里没有它们）。地图的职责就是把读者送到详细页，读者想深入注意力算子或 HCCL 在本页无处可去，而这一站恰是 GLM 与上游差别最大的地方。改法：该 bullet 补链 ops-and-kernels.md（算子总入口）与 cann-hccl.md 或 collective-communication.md（卡间通信）；注意力可顺带链 attention-backend-family.md，它正是 npu-platform.md:143 指定的「完整对应关系」出处。

**P2-2（全库，不在本页）｜四页把 db701c1f 标成「v0.23」列。** ascend-config-system.md:222、data-parallel.md:230、engine-processes.md:334、npu-platform.md:200，详见上文表格。本页口径正确，建议另起一轮统一，本轮不改。

**P3-1｜位置 104 行｜A4 一站 504 字符，超出地图口径。** 改法：拆成「注意力两类」与「MoE」两条，或把 2051、288 选 8 这类只留在详细页。

**P3-2｜位置 151 行｜版本差异表 GLM 基线列的「2 组 5 个」没有角标**，其余三列有 [C31][C32][C33]。四个 setup.py 来源都在 frontmatter（11、41、42、43 行，audit 全部命中），补一个角标即可。

**P3-3｜位置 86 行与 119 行｜同页两组不相关的「五个」。** 教学区是「五个扩展点（平台、patch、模型、算子、配置）」，对照源码是「两组 entry point 共五个」。两者无关，相隔 33 行，读者容易并成一件事。改法：119 行写成「共 5 个入口名」，或在扩展点一节点明两者不同。

**P3-4｜写手自报待核第 2、3 条仍然成立**：entry point 组数本轮未重读 setup.py（沿用旧结论，但四个提交的 setup.py 来源都在 frontmatter 且 audit 命中）；平台类属性仍引 2c59ff10 行号——123 行明写「v0.23 维护分支上它标成 OOT」，表述诚实，不算错。待核第 1 条（根目录 vllm_patch/0729.patch 是否在构建时应用到 vLLM）本轮无法推进，需要读文件内容。

### wiki:audit

`pnpm wiki:audit` 整体 exit 1，**本页通过**：`concepts/vllm-ascend-overview.md … evidence=C 章节=10 正文 5937 字 / 6 节 来源 35 条`，35 条全部 ✓，无 ✗。唯一失败是 `concepts/rope.md` 的 `vllm@0fc695fc:vllm/config/model.py#L2178-L2250` 行号越界，与本页无关。全库统计：审计 133 页、来源 2194 条、行号越界 1、无效 commit 0、文件不存在 0。写手 57 行的自查如实。

另记：`wiki/warnings/patrol-2026-09-25.md:40`、`patrol-2026-09-26.md:23`、`patrol-2026-09-27.md:26` 三次巡检都对本页报过 mark-flood（09-27 报「内联标记 35 处，超过 30」）。本轮 audit 未再报；写手称已压到 21 处。我按「对照源码之上不能出现证据角标」核过 60–113 行，无角标。

### 跳过了哪些段（按纪律）

- **未读任何源码文件内容**（本页前两次审查因读源码被拦）。版本事实只用 `git ls-tree -r --name-only`，patch 文件数按文件名计数。
- **未读「## 对照源码」正文**（117–163 行的段落）。该节只用 grep 核：五个 H3 齐全且顺序正确、版本差异含三版、表格各行、角标位置、「五个」的两处用法、四个 setup.py 来源。
- **未读 frontmatter 的 sources 清单**（10–45 行）除 commit 与路径外的内容，来源由 audit 校验。
- **未跑 `git diff` 逐行看删除**：整页重写，改用 46 条清单（F1–F46）逐条对照，并用 `git show 0f97c8b` / `git show HEAD` 的 H2/H3 列表核结构落点。
- 详细页只 grep 需要核对的行并读其附近不超过 12 行；ops-and-kernels、attention-backend-family、cann-hccl 三页只取标题、summary 与 H2 列表。

## P2/P3 修订（09-28）

- **P2-1（算子一站没有出口）：已改。** 「算子」那条原只链 quantization.md，现在链四页：总入口 [算子与 kernel](ops-and-kernels.md)、注意力挑后端 [注意力后端](attention-backend-family.md)、卡间通信 [CANN 与 HCCL](cann-hccl.md)、量化 [W8A8 量化](quantization.md)。四个文件名与标题都先 `ls` + `grep '^## '` 确认存在（ops-and-kernels.md 五个 H2、cann-hccl.md 七个 H2）。
- **P2-2（四页把 db701c1f 标成 v0.23）：本页不改，另四页已改。** ascend-config-system、data-parallel、engine-processes、npu-platform 的版本差异表头已统一为「v0.23 列 = 2c59ff10，db701c1f 作为 orphan commit 单独注明」，各页复核结论记在各自的 review 末尾。其中 data-parallel 的「dummy batch 额外动作」一格原写「无」，按 2c59ff10 应为「先记一次显存统计」，已改并补 2c59ff10 源码位置；engine-processes 的 scheduler 类替换行号 v0.23 列应为 `:745`（镜像是 `:718`），已改。
- **P3-1（A4 一站 504 字）：已改，改后 246 字符（去掉链接语法后 171 字）。** 删的是与详细页第一屏重复的细节数（2051 个位置容量、288 选 8），它们在 sparse-attention.md、expert-parallel.md 原处已有且本条已链过去；结构数保留并补回：45 层里 34 层 KDA、11 层稀疏注意力、42 层的前馈是 MoE、EP16 摊到 16 张卡。34/11 核 sparse-attention.md:135 与 linear-attention.md:5，42 核 moe.md:153-155。
- **P3-2（entry point 表 GLM 基线列缺角标）：已改。** 补 `[C1]`（`vllm-ascend@db701c1f:setup.py#L543-L550`，sources 第 1 条），与另三列的 [C31][C32][C33] 对齐；角标在「对照源码」之内，不违反「对照源码之上不放角标」。
- **P3-3（同页两组「五个」）：已改。** entry point 那句改成「两组 entry point、共 5 个入口名」，与教学区「五个扩展点」区分开；没有在页面上写解释两者区别的说明文字。
- **P3-4：不改。** 三条自报待核属于未验证事实的诚实标注，本轮没有新证据推进。
- **验证。** `pnpm wiki:lint` 通过，本页与另四页均无告警（全库 18 处 mark-flood 待留意，都在别的页）；`pnpm wiki:diagrams --check` 189 张图与 spec 一致；`pnpm wiki:audit` 全库唯一失败是 `concepts/vllm-kv-block-allocation.md` 的 diagram-identifier，那一页与 `wiki/diagrams/block-allocation.yaml` 正被另一位写手同时改动（本轮运行期间文件时间戳变化），与这五页无关，本页与另四页 0 条 ✗。人工核对本页：五个 H3 顺序为 怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置，其后无 H2；行内代码 12 处、正文约 4.2 千字，合 2.8 处/千字（上限 13）；calc 0 个；免责词（待核/尚未核实/未验证/可能/不确定）命中 0 句（99 句，0%）。未改 scripts/ 与 standard-pages.json。
