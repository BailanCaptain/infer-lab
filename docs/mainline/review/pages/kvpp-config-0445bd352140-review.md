# kvpp-config-0445bd352140 审查记录

## P5 写作记录（第 28 批，小修，2026-10-02）

**范围**：保持参数页 4 段式（一句话 / 事实表 / 为什么存在 / 开了的代价）+ 两节自动生成区不动；沿用现有图（本页本来无图）。按队列要求：只解释本字段，机制、通信与形状推导一句话 + 链接回 [kvpp](../../../../wiki/concepts/kvpp.md) 概念页，口径与概念页一致。

**字数**：正文非空白字符 7,316 → 9,947（同一 awk 去 frontmatter 后计数；audit 现报正文 6,533 字）。增量主要是新加的 GLM 双机段。

**改了什么**
1. 一句话：补一句 KVPP 是什么（与概念页「KVPP 是什么」口径一致：一组卡各存一份相同的 MLA KV cache → 按层分、每层一张常驻卡），链接到 `kvpp.md#kvpp-是什么`；版本范围补上提交号 v0.23=2c59ff10、v0.26=2ed6cbba、main=baa023ad，并补 GLM 钉住的 db701c1f 同样没有 KVPP、AscendConfig 逐键 `.get()`。
2. 事实表：「六条」改「七条」（P2 计数错误，见下）；「四处重算」改为 main baa023ad 实数 7 处重算 + 3 处读单例（P2 事实过时）；extra="forbid" 一行补 vLLM-Omni 例外；新增「GLM 双机」一行。
3. 为什么存在：三条消费路径各保留一句（只说读这个数），细节分别链回概念页「怎么开」「层怎么分，每张卡要留多少显存？」「算到某一层时，历史怎样到位？」；divmod 细节移交概念页。
4. 开了的代价：示例命令与正文「非 hybrid」统一为「非混合」；七条 ValueError 链回概念页「会报什么错」；PP/DP 一段补上 from_vllm_config 注释的意思；新增 GLM 双机段（见下）。
5. frontmatter：summary 补 GLM 一句（仍 ≤200 字）；updated 改 2026-10-02。未动 sources 区与自动生成区。

**GLM 双机段的依据（全部本轮实读）**
- 部署参数：底稿 01 第 69 行（tp=8, pp=1, pcp=1, dcp=1）、第 250 行（speculative-config 的 enforce_eager 只管草稿模型，主模型仍录 decode 图）、第 848 行（没有 kv_transfer_config）；部署页 D 第 85 行 cudagraph_mode=FULL_DECODE_ONLY。
- size 推导：vllm-ascend main baa023ad `vllm_ascend/ascend_config.py` 60–77（from_vllm_config：未开返回 size=1；开了 = TP × PCP；注释说复制域不跨 DP/PP）。
- 校验调用：`platform.py` 479（check_and_update_config → _validate_parallel_config）、1500–1502（size>1 才 validate）。
- 报错原文：`ascend_config.py` 91–92（eager）、93–94（non-hybrid MLA），逐字照抄；validate 共 7 个 raise（81–99 行起）。
- GLM 是混合模型：main `vllm_ascend/models/glm5next/model.py` 839 行 `Glm5NextForCausalLM(..., IsHybrid)`。
- 钉住版本无 KVPP：`git grep -i -c kvpp` 在 db701c1f / 2c59ff10 / 2ed6cbba 的 vllm_ascend 与 docs/source 下均为空；db701c1f `ascend_config.py` 27–46 为普通类逐键 `.get()`。
- 重算次数：main baa023ad `git grep 'kvpp_config.size\|KVPPConfig.from_vllm_config'` → from_vllm_config 7 处（ascend_config 1608、kv_cache_placement 135、ascend_store/pool_worker 126、platform 1500、v2/attn_utils 629、v2/kvpp 31、worker 1096），读单例 3 处（parallel_state 76、mooncake/base_worker 217、model_runner_v1 4772）。
- extra="forbid" 例外：`ascend_config.py` 1660–1671（装了 vllm_omni 时未知键告警后丢弃）、455（ConfigDict(extra="forbid")）。
- 无 KVPP 实测数：没写任何效果数字，没引用 02 §1.4 / §5.6 的 GLM KV 字节（变体推导留在概念页 GLM 一节，这里只链接）。

**旧版信息清单勾选**（清单：scratchpad\p5\kvpp-config-0445bd352140-facts.md；旧版 = p4-checkpoint = 改前现版）
- F1 唯一字段 size、默认 1：保留（一句话、事实表）。
- F2 不是用户键、_NON_USER_INPUT_KEYS 静默丢弃：保留。
- F3 只 main 有：保留，补提交号与 db701c1f。
- F4 旧分支逐键 .get() 静默忽略：保留。
- F5 本页只讲字段：保留（措辞「六条启动校验」改为「启动检查」）。
- F6 enable_kvpp 真假与 TP=1、PCP=1：保留（事实表）。
- F7 main 其他错键 extra="forbid" 拒收：保留并补 vLLM-Omni 例外。
- F8 阈值 size>1：保留。
- F9 size==1 不跑 validate：保留。
- F10 多处重算：保留，「四处」更正为 7 处 + 3 处读单例（证据见上）。
- F11 为什么做成对象：保留。
- F12 三条路：保留各一句；divmod / remainder 细节挪到概念页「层怎么分，每张卡要留多少显存？」与「怎么开」（已有链接）。
- F13 真开关 enable_kvpp、官方配置表：保留。
- F14 配 kvpp_config 什么都不发生 + 示例：保留。
- F15 size==1 整条校验链不跑：保留，「六条」更正为「七条」。
- F16 复制域不跨 DP/PP：保留并补注释含义。
- F17 / F18 自动生成区：未动。

**自查疑点**：无 P1。已修 2 处 P2（七条 vs 六条；重算处数过时）。待核：无。

**验证**：每次保存后 `pnpm wiki:lint` 通过（仅他页 5 处 mark-flood 提示）；`pnpm wiki:diagrams --check` 290 张一致（他页 vllm-ascend-repo-map 有代码名提示）；`pnpm wiki:audit` 通过，本页不在名单内，无报错。

## P5 审查（10-02）

审查员：独立审查（Opus 5.5），只审不改。按参数页小修口径审（4 段式 + 两节自动生成区），不按深入页骨架扣分。

**结论：8.5 / 10。audit 本页通过；P1 0 条；P2 1 条；P3 2 条。另有 1 条他页发现（不计本页分）。**

### 初学者测试（只读一句话 + 事实表）
我的一句话：`kvpp_config` 是程序按 `enable_kvpp` 和 TP×PCP 自己算出来的「KVPP 组有几张卡」，用户写了会被静默丢掉；代价是 `size` 落在 1 时整条启动检查都不跑，配错没有任何提示。——能说清，通过。一句话段先补了一句「KVPP 是什么」再讲字段，顺序合适。

### 两处 P2 旧错的修正：核实属实
- **校验条数「六条 → 七条」**：main `baa023ad` `vllm_ascend/ascend_config.py` 79–100 行 `validate()` 共 7 个 `raise ValueError`（82 DCP、86 连接器、88 decode 侧、92 eager、94 非混合 MLA、98 投机方法非 mtp、100 MTP 步数不固定）。页面 114 行括号里列的 7 项与源码一一对应。正确。
- **重算处数「四处 → 7 处 + 3 处读单例」**：`git grep` main `baa023ad`（排除 tests）：`KVPPConfig.from_vllm_config` 7 处 = ascend_config 1608、core/kv_cache_placement 135、kv_pool/ascend_store/pool_worker 126、platform 1500、worker/v2/attn_utils 629、worker/v2/kvpp 31、worker/worker 1096；读单例 `.kvpp_config.size` 3 处 = parallel_state 76、mooncake/base_worker 217、model_runner_v1 4772。与写手记录、页面 86 行一致。正确。
- 顺带核实：`from_vllm_config` 未开返回 `cls()`、开了 = TP × PCP，注释说复制域不跨 DP/PP（ascend_config 67–77）；platform 1500–1502 `size > 1` 才 `validate()`；分层 `divmod` 在 kv_cache_placement 149、`owner_rank < remainder` 的前几张卡多拿一层（152）；GLM 模型类声明 `IsHybrid`（glm5next/model.py 839）；报错原文 91–92、93–94 行号准确。
- GLM 部署前提对照底稿 01：第 69 行 tp=8/pp=1/pcp=1/dcp=1，第 250 行 speculative-config 的 `enforce_eager` 只管草稿模型、主模型仍录 decode 图，第 848 行无 `kv_transfer_config`。页面 118 行推导（size = 8×1 = 8 > 1 → 进 validate → 前三条过、撞 eager）成立。
- 没有虚构收益数字，没有把 GLM 主线数字当成 KVPP 效果；明写「本部署也没有任何 KVPP 实测数」。符合「变体」口径。

### 旧版信息清单
清单存在：`13898c74…/scratchpad/p5/kvpp-config-0445bd352140-facts.md`（F1–F18）。抽查 6 条到新版：F1（69、79 行）✓；F2（69 行）✓；F4（71 行）✓；F12（96–98 行，divmod 细节改成「除不尽时前几张卡各多拿一层」+ 链接概念页「层怎么分」，信息未丢）✓；F14（104–112 行）✓；F16（116 行）✓。`git diff p4-checkpoint` 删除行逐条看过，没有丢信息。

### 与 kvpp 概念页口径
- 「KVPP 是什么」一句、三条消费路径各一句 + 链接、「逐条报错原文见概念页」，口径与 `wiki/concepts/kvpp.md` 一致。所有锚点（`#kvpp-是什么`、`#怎么开`、`#层怎么分每张卡要留多少显存`、`#算到某一层时历史怎样到位`、`#会报什么错`、`#放到-glm-双机这套部署能开-kvpp-吗`、`glm-5-3-flash-two-node.md#部署前提`）在目标页都有对应标题；`pnpm wiki:lint` 通过。
- 入链：kvpp.md 254 行、index.md 120/174 行、size-40a1c2ca47b8.md 21/53 行，均可解析。

### P2
1. **118–126 行 GLM 段重讲了概念页已讲过的结论。** 概念页 GLM 一节（kvpp.md 191 行）已用一段说清「钉住版本没 KVPP；换到 main 也过不了启动检查：混合模型 + 录了 decode 图」，「会报什么错」表（275 行）也已注明 GLM 会先撞 eager 那条。本页又用四段把两条报错原文逐字引用并附源码行号，和本页 114 行自己定的「逐条报错原文见概念页」口径相冲。本字段特有、应保留的只有：`size = 8 × 1 = 8 > 1` → platform 调 `validate()`。改法：保留这条推导，接一句「先撞 eager 那条，补上 `--enforce-eager` 后撞非混合 MLA 那条，所以建组、分层、换分配路径都走不到」，链接概念页「会报什么错」与 GLM 一节；删掉两段引用和正文里的行号（行号留给 sources / 对照源码）。

### P3
1. 79–88 行事实表「覆盖版本：只有 main 有」与同页「版本谱系」表里 `releases/v0.28.0rc`、`v0.29.0rc`「有」字面冲突（旧版就有，非本轮引入）。建议改成「本站跟踪的三个版本里只有 main 有」，和 summary 里的「在册版本里」一致。
2. 92 行「这样自己重算的地方共 7 处」：7 处里包含配置工厂首次计算（ascend_config 1608），严格说是 1 处首算 + 6 处拿不到单例时重算。事实表 86 行「7 处各自 `from_vllm_config` 一遍」的写法是准确的，这里照着改一下措辞即可。

### 他页发现（不计本页分，建议另派小修）
- `wiki/params/size-40a1c2ca47b8.md` 第 100 行仍写「`validate()` 那六条硬校验」，与本页刚改正的「七条」和源码不符，是同一处旧错，跨页口径现在不一致。

### 验证
- `pnpm wiki:audit`：exit 0，「审计 139 页…无效 commit 0，文件不存在 0，行号越界 0」；本页 19 条来源除官方线上 URL（未联网验证，正常）外全部 ✓。
- `pnpm wiki:lint`：ok（另有 5 处待留意，均不在本页）。
- 浏览器：5193 端口本轮未在监听（127.0.0.1 返回 000、netstat 无 5193），按要求不起服务，**未截图**。本页无图，只影响排版观感的复查。

## P5 修订记录（10-02，按审查）

**P2-1 成立，已改。** 「开了的代价」末尾 GLM 段由四段（两条报错原文引用 + 源码行号）压成一段：只保留本字段特有的推导「TP8、PCP1 → `size = 8 × 1 = 8` > 1 → platform 调 `validate()`」，接一句「先撞只支持 eager，补 `--enforce-eager` 后撞只支持非混合 MLA，建组、分层、换分配路径都走不到」，报错原文链到概念页 `kvpp.md#会报什么错`，GLM 为什么过不了链到 `kvpp.md#放到-glm-双机这套部署能开-kvpp-吗`（两锚点均已存在，lint 通过）。正文不再出现行号；行号证据仍在本文件「P5 写作记录」。

**P3-1 成立，已改。** 事实表「覆盖版本」改为「本站跟踪的三个版本里只有 main 有（v0.28.0rc / v0.29.0rc 发布分支也已带上，见「版本谱系」）」；一句话段「存在范围」同步改为「本站跟踪的三个版本里只在 main……」。本轮复核：`git grep -l 'class KVPPConfig'` 在 `origin/releases/v0.27.1rc` 0 个文件，`v0.28.0rc`、`v0.29.0rc` 各 1 个。

**P3-2 成立，已改。** 「为什么存在」一句改为「调 `from_vllm_config` 的共 7 处：配置工厂首算 1 处，拿不到单例时自己重算 6 处；另有 3 处读单例」，与事实表一致。

**他页转记（不改）。** 审查员发现 `wiki/params/size-40a1c2ca47b8.md` 第 100 行仍写「`validate()` 那六条硬校验」，与源码（7 个 raise）和本页不一致；该页属第 29 批，本轮按主会话指示**未改**，留给第 29 批写手。

**三项检查（本轮实际运行，全站退出码）。** `pnpm wiki:lint` exit 0（另 5 处他页 mark-flood 提示）；`pnpm wiki:diagrams --check` exit 0；`pnpm wiki:audit` exit 0，本页 evidence=C、来源 19 条、正文 6203 字 / 6 节。未起服务、未截图（本页无图）。
