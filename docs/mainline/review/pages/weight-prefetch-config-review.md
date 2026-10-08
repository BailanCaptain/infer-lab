# weight-prefetch-config 审查记录

## P5 写作记录（Opus 5.5，10-02，第 30 批小修）

本记录是写手自查与交接，不替代独立审查。按派发说明执行：小修、保留参数页 4 段式结构（一句话 / 事实表 / 为什么存在 / 开了的代价）、沿用现有图（本页原本无图，未新加）、与刚改完的 [prefetch-ratio](prefetch-ratio-review.md) 口径一致且不重讲、不起服务、不截图、不开子代理。

### 旧版信息清单与勾选

`git diff --stat p4-checkpoint -- wiki/params/weight-prefetch-config.md` 无输出，旧版即改前现版。清单 15 条存于旧会话 scratchpad `p5/weight-prefetch-config-facts.md`，逐条核对：

1. 定义（独立 stream、HBM→L2、藏在 vector 算子背后、默认 `{}`、低延迟别开）—— 保留，未动。
2. 存在范围（v0.24.0rc 起删除；v0.26 静默忽略 / main `extra="forbid"`）—— 保留，未动。
3. 旧算例 Qwen3-0.6B 走 MLP 那条路 —— 保留，但明确标成「旧模型记录（稠密、单卡 bf16，不是 GLM 双机，也不是实测）」，避免被读成双机实测。
4. 事实表 10 行 —— 一行未动。
5. 为什么存在（MTE 瓶颈、stream 单例、算子对、三个插桩点）—— 保留，只在 MTE 首现处补中文解释与 op-to-ai-core 链接。
6. `gate_up` 的 `self_attn` 起点判据与提前量 —— 保留，未动。
7. 血缘与去向（`enable_prefetch`、Ready to Deprecate、PR #11949、无替代）—— 保留，未动。
8. 别认错门（main 的 offloader/prefetch.py 是 CPU offload）—— 保留，未动。
9. 两道方向相反的 token 门槛 —— 保留，未动；GLM 一节里落到具体步数。
10. Qwen3-0.6B 字节算例四条 —— 全部保留，只在引子里加上「旧模型记录 / 非实测 / 只看量级」，并把该行重复的 `[D]` 删掉（整段标 `[D]` 的说明仍在段末）。
11. 代价（会反过来影响计算、低并发关掉、profiling 看 CMO 与 SwiGlu 重叠、显存无额外代价）—— 保留，未动。
12. 三个坑（`enabled` 不是 `enable`、整体替换、MLP down 依赖 sequence parallel）—— 保留，未动。
13. 升级必须删（v0.26 静默无效、main 起不来、`vllm_omni` 例外）—— 保留，未动。
14. 上游过期示例 —— 保留，未动。
15. 版本谱系、参数定义两节自动生成 —— 未动。

### 这次改了什么

1. **「一句话」新增「放到 GLM 双机：关着的」段（挂靠 A4）**：官方双机命令没传 `additional_config`，`WeightPrefetchConfig.enabled` 默认 `False`（v0.23 维护分支 2c59ff10 与含 GLM 代码的 db701c1f 相同，新来源 C33）；同名易混的 `--safetensors-load-strategy prefetch` 只提一句并链接到 prefetch-ratio，不重讲。
2. **「开了的代价」开头加「配置值 vs 测得效果」的界线**（本批验收要点，与 prefetch-ratio 同口径）：钉住提交上没有开与不开的实测对照，GLM 主线数字是预取关着那套部署的数字，不能当收益。
3. **新增「要是在 GLM 双机上手动开起来（按源码推演，未实跑）」四条**：
   - `mlp` 两项整条路不走——`mlp.enable = enabled and not is_moe`、`moe.enable = enabled and is_moe`（新来源 C34），GLM 是 MoE 模型；顺带给出稠密 MLP 每卡每层 18.0 MiB（02 §1.3）正好卡在上限却无插桩点。
   - `moe.gate_up` 唯一落得上且已饱和：`w13_weight` `[18, 4096, 4096]` int8 = 288 MiB（02 §6.6、§1.3）≫ 18 MiB；推导只链接 prefetch-ratio，不重算。
   - 门槛 96 在 decode 步上过不去：GLM 快照里 `MOE_PREFETCH_TOKEN_THRESHOLD = 96` 与 18 MiB 上限未变（C34）；底稿 01 §B2 里 13 条请求全 decode 的那一步一张卡只有 `13 × 4 = 52` token（补齐到 64），要够 96 得有 24 条以上并发 decode；prefill 步反而能过。写明「待核：门槛比的是补齐后还是补齐前的行数，缺实跑 profiling」，按源码推断，不作定论。
   - `attn` 两项挂在 W8A8 **静态** `apply` 上，而底稿推断稠密侧是 W8A8 **dynamic**；待核项（缺 `quant_model_description.json`）与 KDA 为 BF16 的推断指向 prefetch-ratio，不重复。
   - 末句重申这套部署上预取没有实测数。
4. **补 MTE 的中文解释与 [算子怎么落到 AI Core](../../../../wiki/concepts/op-to-ai-core.md) 链接**（依赖项 op-to-ai-core，改前本页没有这个链接）；补 [部署前提](../../../../wiki/concepts/glm-5-3-flash-two-node.md#部署前提) 链接（依赖项 D）。
5. summary 末尾补「GLM 双机没开，开了也只有 moe.gate_up 落得上」；`updated` 改为 2026-10-02。
6. 来源追加 2 条（C33 `db701c1f:vllm_ascend/ascend_config.py#L685-L701`、C34 `db701c1f:vllm_ascend/ops/weight_prefetch.py#L14-L67`），原 32 条未动。

### 数字出处

- 稠密 MLP 每卡每层 18.0 MiB、路由专家每卡每层 432.0 MiB、每卡 18 个局部专家：`docs/mainline/02-forward.md` §1.3。
- `w13_weight` `[18, 4096, 4096]` int8 与 W8A8 MoE 算子链：同文件 §6.6。
- 13 条请求全 decode 的那一步 `13 × 4 = 52` token、补齐到捕获尺寸 64、捕获尺寸集合：`docs/mainline/01-deploy-entry-schedule.md` §B2（第 747 行）与 §A0.6。
- Qwen3-0.6B 的字节算例原样保留，出处仍是该模型配置（整段 `[D]`）。
- 本页未新增 calc、未改图、事实表行数未变。

### 核实方式（核参数与归档链接）

- `enabled` 默认值：`git -C tools/repos/vllm-ascend show <commit>:vllm_ascend/ascend_config.py | grep -n` —— 2c59ff10 第 719 行、db701c1f 第 700 行都是 `.get("enabled", False)`；2ed6cbba 与 baa023ad 上 `WeightPrefetchConfig` 已不存在，与原文「v0.24.0rc 起删除」一致。
- 门槛与上限：db701c1f `ops/weight_prefetch.py` 第 14–15 行 `MOE_PREFETCH_TOKEN_THRESHOLD = 96`、`MAX_PREFETCH_WEIGHT_SIZE = 18 * 1024 * 1024`；MoE 判据在第 90 行、MLP `num_tokens < 500` 在第 146 行；`mlp`/`moe` 的 `enable` 在第 42–67 行由 `is_moe_model` 决定。
- MoE 插桩点：db701c1f `ops/fused_moe/experts_selector.py` 第 74 行在 `select_experts` 开头调 `maybe_prefetch_moe_weight_preprocess(hidden_states, "gate_up")`，与底稿 02 §6.2 的 `select_experts` 调用链对应。
- 归档链接：两条新来源指向的文件在钉住提交上存在、行号在范围内（`pnpm wiki:audit` 行号校验通过）；本页 rawSources 两条未动。

### 验证

- `pnpm wiki:lint`：通过，本页 0 报错、0 待留意（中途一度因先引 C33 后补来源报 mark-index，已补来源；内联标记控制在 29 处，删掉了一处重复 `[D]`）。
- `pnpm wiki:diagrams --check`：通过，290 张图一致，本页无图。
- `pnpm wiki:audit`：通过；本页「正文 10817 字 / 6 节 / 来源 34 条」，全库无效 commit 0、文件不存在 0、行号越界 0。
- 正文字数（audit 口径）：8,935 → 10,817。

### 自查疑点

- 无 P1。
- 待核（已写进页面）：96 门槛比的是补齐后的行数还是真实 token 数（缺实跑 profiling）；attention 各投影最终命中哪个 `LinearMethod`（缺 `quant_model_description.json`，与 prefetch-ratio 同一条）。
- 跳过：读 `db701c1f:vllm_ascend/ops/weight_prefetch.py` 第 88–105 行那一次读取被拦，改用 grep 行号 + 已有结论完成核实，未再整段读该文件。

## P5 审查（10-02）

审查员：Opus 5.5（独立审查，只审不改）。口径：参数页小修，保持 4 段式，只核任务文件写明的问题。`db701c1f:vllm_ascend/ops/weight_prefetch.py` 按派发要求只做窄 grep 和 ≤20 行的小窗口，没有整段读；本次没有被拦。

**分数：6 / 10。audit 本页通过。P1 2 条，P2 2 条，P3 2 条。**

### 旧版信息清单

- 清单存在：旧会话 scratchpad `p5/weight-prefetch-config-facts.md`（15 条）。
- 抽查 6 条到新版，全部在：①定义与默认 `{}`、低延迟别开（第 74 行）；②存在范围与 v0.26 / main 两种删法（第 76 行）；④事实表仍是 10 行（第 86–95 行）；⑦血缘、Ready to Deprecate、PR #11949、无替代（第 105 行）；⑧main 的 offloader/prefetch.py 是 CPU offload（第 107 行）；⑫三个坑（第 128–130 行）。
- `git diff` 删掉的行只有 summary、`updated`、两句被改写的引子和 MTE 那句（改写后信息都在），没有丢信息。Qwen3-0.6B 算例数字复核无误（12 / 6 / 18 / 504 / 8 / 4 MiB）。

### 四条推演逐条对照源码

| 条 | 页面说法 | 源码 / 底稿 | 结论 |
|---|---|---|---|
| 1 mlp 路不走 | `mlp.enable` 要求非 MoE，`moe.enable` 要求 MoE | db701c1f `weight_prefetch.py` 第 59–61 行（moe：`enabled and self.is_moe`）、第 65–67 行（mlp：`enabled and not self.is_moe`） | 结论对；但「18.0 MiB 正好卡在上限」说法有问题，见 P2-1 |
| 2 moe.gate_up 饱和 | `w13_weight` 288 MiB ≫ 18 MiB，比例写多少都一样 | 288 MiB 在 02 §6.3 第 623 行；18 MiB 上限在 MoE 路径由后端截断（Python 侧 clamp 只在第 172–173、182–183 行的 MLP 两路），与 prefetch-ratio 第 114、125 行口径一致 | 结论对；出处标注见 P2-2；但「唯一」是错的，见 P1-1 |
| 3 decode 过不了 96 | 13 条全 decode 一步 52 token、补齐 64；要 24 条以上 | 门槛判据在第 90 行：`hidden_states.shape[0] >= MOE_PREFETCH_TOKEN_THRESHOLD`（第 14 行 = 96），调用点 `experts_selector.py` 第 71–74 行在 `select_experts` 开头；52 → 64 见 01 第 746 行 | 推断合理且已标「很可能 / 待核 / 不作定论」；数字出处见 P1-2 |
| 4 attn 待核 | 只挂 W8A8 静态 `apply`；待核 `quant_model_description.json` | 与 prefetch-ratio 第 126 行同一条待核 | 已标待核；措辞与 prefetch-ratio 有漂移，见 P3-1 |

### P1

**P1-1　「`moe.gate_up` 是唯一落得上的一项」不成立：漏了只看 `enabled` 的 MLA / SFA 预取路（第 135 行条 2 标题、第 139 行「四条」、summary 末句）。**
- 证据：db701c1f `vllm_ascend/ops/weight_prefetch.py` 第 48 行 `self.mla_sfa_prefetch_enable = weight_prefetch_config.enabled`（写手自己追加的 C34 范围 L14–L67 就包含这一行），第 202–227 行 `maybe_prefetch_mla_or_sla_weight_in_current_stream`：只判 `mla_sfa_prefetch_enable`，不看 `is_moe`、不看 96 门槛、不读 `prefetch_ratio`；`max_size` 不给时整块预取。调用点在 `vllm_ascend/attention/sfa_v1.py` 第 1757–1761 行（native 分支，预取 `fused_qkv_a_proj.weight`）和第 2005–2011 行（预取 `o_proj.weight`，上限 `MAX_O_PROJ_PREFETCH_SIZE` = 16 MiB，`mla_v1.py` 第 73 行；o_proj 若走 `AscendW8A8LinearMethod` 静态量化则跳过，`weight_prefetch.py` 第 215–222 行）。2c59ff10 第 48、209 行同样存在。
- 为什么落在 GLM 上：02 第 364–367 行写明 GLM 的 11 层稀疏 MLA 走 `AscendIndexerKPoolMLAImpl` → 父类 `AscendSFAImpl.forward`，且 GLM 关掉了 `enable_sfa_prolog_v3` / `enable_mlapo`，走的正是 native 分支（第 1756 行起）。所以手动开 `enabled: true` 后，每层稀疏 MLA 的 `fused_qkv_a_proj` 都会被整块预取，而且 decode 小 batch 也不受 96 门槛挡。
- 影响：GLM 推演的核心结论与 summary 都错了，读者会以为开了只有 MoE 一项、且小 batch decode 下等于没开。prefetch-ratio 页说「唯一」是在**比例**的语境里（这条路不读比例），所以那一页没错；本页讲的是整个开关，不能照搬。
- 改法：条 2 标题改成「`ratio` 管得到的几项里，只有 `moe.gate_up` 落得上，而且早就饱和」；新增第 5 条「稀疏 MLA 层自己的预取：只看 `enabled`」，写清预取 `fused_qkv_a_proj`（整块，不看门槛和比例）与 `o_proj`（静态 W8A8 时跳过，否则截到 16 MiB），出处补 `sfa_v1.py#L1756-L1761`、`#L2004-L2011` 和 `weight_prefetch.py#L202-L227`，标「按源码，未实跑」；`fused_qkv_a_proj` 每卡多大只链接 MLA 那一页或 02 §5 的出处，不在本页算。summary 末句与第 139 行「这四条」同步改。顺带：「为什么存在」第 101 行「三个插桩点」可补一句「另有稀疏 MLA / SFA 层在本流里的预取」，否则与新第 5 条对不上。

**P1-2　条 3 的 52 token 没有可追的出处，且在本页重列算式（第 136 行）。**
- 页面只写「按底稿」，随后写出 `13 × 4 = 52` 与补齐到 64。底稿出处是 01 第 746 行，站内单一出处是 [多条请求页](../../../../wiki/concepts/concurrent-requests.md) 第 181 行那张逐步表（第 4 步「13 条 × 4 = 52」）和 dp-request-routing 第 186 行（→ 64）。读者看到「按底稿」无处可查。
- 改法：「按底稿」换成链接到多条请求页那一步（或 dp-request-routing 那一行），本页只写结果「那一步一张卡 52 个 token，补齐到 64」，不再列 `13 × 4`。「要够到 96 得 24 条以上」是本页自己的推断，保留即可。

### P2

**P2-1　条 1「每卡每层 18.0 MiB 正好卡在 18 MiB 上限上」把一层合计和单次上限比（第 134 行）。** 18 MiB 是单次预取（一块权重）的上限；02 §3.3 第 226–228 行写明这 18.0 MiB 是 gate_up 12.0 MiB + down 6.0 MiB 两块。prefetch-ratio 第 124 行的说法是「两块都在单次 18 MiB 的上限以内」，两页口径不一致，本页的说法会让人以为一层是一次预取、刚好顶格。改法：照 prefetch-ratio 的写法，「gate_up 12 MiB、down 6 MiB 两块都在单次上限以内，本来能整块预取，可是没有插桩点会去取」，数字链接到 prefetch-ratio 引的那两处（部署页「每张卡上放了什么」、tensor-parallel 页），不另写内部代号。

**P2-2　条 2 的 288 MiB 出处标错节，且「推导在 prefetch_ratio」与那一页的写法对不上（第 135 行）。** 页面标「02 §6.6、§1.3」，但 288 MiB 这个数在 02 §6.3 第 623 行；§6.6 只有形状，§1.3 只有 432 MiB 合计。prefetch-ratio 第 125 行没写 288 MiB，写的是「432 MiB 的三分之二」。改法：二选一——要么照 prefetch-ratio 写「每卡每层 432 MiB 路由专家权重的三分之二」并链接过去；要么保留 288 MiB，但出处改成 02 §6.3，并去掉「推导在 prefetch_ratio」的说法。

### P3

1. **第 137 行条 4「底稿按上游配置推断稠密侧走的是 W8A8 dynamic」**：prefetch-ratio 第 126 行的口径是「只推断了稠密 MLP 走 dynamic，attention 各投影归哪个方法没有推断」。本页「稠密侧」容易被读成 attention 也已推断为 dynamic。改法：写成「底稿只推断了稠密 MLP 走 dynamic，attention 的投影没有推断」。另外「按底稿」「底稿按……」对读者是内部说法，可改成「按主线推算」或直接给链接。
2. **第 78 行「要是在 v0.23 上手动开起来」**：GLM 代码不在 v0.23 维护分支 2c59ff10 上，推演依据的是 db701c1f；第 132 行以下和 prefetch-ratio 都写成「在含 GLM 代码的那个提交上」。改法：同样改成「要是在含 GLM 代码的那份快照上手动开起来」。

### 其他核对

- `enabled` 默认 `False`：2c59ff10 `ascend_config.py` 第 719 行、db701c1f 第 700 行，C33 范围 L685–L701 覆盖到。
- 「配置值 vs 测得效果」界线（第 111 行）与末句「没有实测数」（第 139 行）都在，没有把 GLM 主线数字当成预取收益，也没有虚构收益数字。
- 旧模型记录（Qwen3-0.6B）已标「不是 GLM 双机，也不是实测」，没有伪装成双机实测。
- 链接：部署前提锚点存在（glm-5-3-flash-two-node 第 49 行）；op-to-ai-core、prefetch-ratio 链接有效。
- 预览 5193 截图（1440 宽）：`scratchpad/weight-prefetch-config-review-1.png`（第一屏）、`-2.png`（GLM 推演四条），渲染正常。

### 跳过

- frontmatter 来源区未读（audit 校验：本页 34 条，全库无效 commit / 行号越界 0）；「版本谱系」「参数定义（自动生成）」两节未改动、未读正文。
- `weight_prefetch.py` 第 88–105 行（MoE 预处理函数体）没有读，只用 grep 拿到第 90 行的门槛判据。

## P5 修订记录（Opus 5.5，10-02，按上面的审查逐条改）

逐条按钉住版本源码核过，`weight_prefetch.py` 第 88–105 行仍未读（只用窄 grep 拿第 90 行判据与第 48、202、209 行）。三检全站退出码 0。

### P1-1 成立，已改

核实：db701c1f `vllm_ascend/ops/weight_prefetch.py` 第 48 行 `self.mla_sfa_prefetch_enable = weight_prefetch_config.enabled`；第 202–227 行 `maybe_prefetch_mla_or_sla_weight_in_current_stream` 只判这个标志，不看 `is_moe`、不看 96 门槛、不读 `prefetch_ratio`；`linear_layer` 的 `quant_method` 是 `AscendW8A8LinearMethod` 时直接 `return`（注释说那种情况已在量化方法里预取过一次）；`max_size <= 0` 或大于权重实际字节时按实际字节整块取。调用点：`attention/sfa_v1.py` 第 1759 行（native 分支，`inputs=self.fused_qkv_a_proj.weight`，不给 `max_size`）、第 2006 行（`inputs=self.o_proj.weight`，`max_size=MAX_O_PROJ_PREFETCH_SIZE`，`linear_layer=self.o_proj`），常量 16 MiB 在 `attention/mla_v1.py` 第 73 行。GLM 走 native 分支：02 §5.2 第 363–367 行（`AscendIndexerKPoolMLAImpl` → `AscendSFAImpl.forward`，`enable_sfa_prolog_v3` / `enable_mlapo` 关）。

改法：条 2 标题改成「`prefetch_ratio` 管得到的几项里，只有 `moe.gate_up` 落得上，而且早就饱和」；新增条 5 写清这条只看 `enabled` 的预取（`fused_qkv_a_proj` 整块、`o_proj` 上限 16 MiB、静态 W8A8 时跳过），并说明「开了 `enabled` 不等于什么都没发生」；「这四条」改「这五条」；summary 末句改成「开了只有 moe.gate_up 与稀疏 MLA 那条路落得上」；「为什么存在」的三个插桩点后补一句指向条 5。`fused_qkv_a_proj` 的字节数本页不给，只链接 MLA 页（避免再造一个出处）。新增来源 C35（`weight_prefetch.py#L202-L227`）、C36（`sfa_v1.py#L1756-L2011`，两处调用点合为一段）。

### P1-2 成立，已改

52 与 64 不再在本页列算式，改成链接 [多条请求页「提示词超过剩余预算时，分几步算」](../../../../wiki/concepts/concurrent-requests.md#提示词超过剩余预算时分几步算)（该表第 4 步 13 条 × 4 = 52），本页只写结果「一张卡这一步只有 52 个 token，补齐到捕获尺寸 64」；「要够到 96 得 24 条以上」保留为本页推断，待核一句未动。

### P2-1 成立，已改

18 MiB 是单次预取上限，不该和一层合计比。改成 prefetch-ratio 的口径：GLM 前 3 层稠密 MLP 的 `gate_up` 与 `down` 两块各自都在单次上限以内，本来是比例线性起作用的尺寸，但 MoE 模型上没有插桩点去取；具体字节链接 prefetch-ratio，本页不写数。

### P2-2 成立，已改

288 MiB 的出处是 02 §6.3（不是 §6.6 / §1.3）。按审查给的第一个选项改：照 prefetch-ratio 写「每卡每层 432 MiB 路由专家权重里的三分之二」并链接过去，本页不再出现 288 MiB，也不再写「推导在 prefetch_ratio」之外的出处标注。

### P3-1、P3-2 成立，已改

- 条 4 改成「主线只推断了稠密 MLP 走 W8A8 dynamic，attention 的各个投影归哪个方法并没有推断」，去掉「稠密侧」这个会被误读的说法，也去掉面向读者的「按底稿」。
- 「要是在 v0.23 上手动开起来」「要是在 GLM 双机上手动开起来」统一改成「要是在含 GLM 代码的那份快照上手动开起来」，与 prefetch-ratio 一致。

### 顺带（为过 mark-flood 的 30 处上限）

删掉 3 处重复角标：条 3 的 `[C34]`（条 1 已引同一范围）、「不分配新张量」的 `[D]`（事实表同一行已标）、合并后的 `[C37]`。现内联标记 30 处以内，lint 0 报错。

### 验证

- `pnpm wiki:lint` 退出码 0（本页 0 报错、0 待留意）。
- `pnpm wiki:diagrams --check` 退出码 0。
- `pnpm wiki:audit` 退出码 0；本页「正文 11499 字 / 6 节 / 来源 36 条」，全库无效 commit 0、文件不存在 0、行号越界 0。
- 正文字数：10,817 → 11,499（改前原始版 8,935）。

### 自查

- 认为不成立的条目：无，六条全部成立并已改。
- 仍是推断、页面已标明的：96 门槛比的是补齐后还是补齐前的行数；attention 各投影的量化方法（缺 `quant_model_description.json`）；条 5 整条按源码读出、未实跑。

## P5 复审（10-02）

复审员：Opus 5.5（独立复审，只审不改）。按派发要求：页面正文用去 frontmatter 的固定命令分段读；源码先 grep 行号再读 ≤20 行；`weight_prefetch.py` 第 88–105 行只读了第 88–91 行（门槛判据那 4 行），csrc 没读。

**分数：7 / 10。上次两条 P1 都已修好；数字出处 52 / 18 MiB / 432 MiB 有链接，64 的链接落点不准（并入新 P1）。新 P1 1 条，P2 0 条，P3 3 条。**

### 上次 P1 / P2 逐条复核

| 条 | 现状 | 独立核实 | 结论 |
|---|---|---|---|
| P1-1 漏了稀疏 MLA / SFA 预取 | 条 2 标题已限定在「`prefetch_ratio` 管得到的几项里」；新增条 5；第 103 行三个插桩点后补了指向条 5 的一句；第 142 行「这五条」；summary 末句已同步 | db701c1f `weight_prefetch.py` 第 48 行标志只等于 `enabled`；第 209–227 行只判这个标志，`linear_layer` 是 `AscendW8A8LinearMethod` 时返回，`max_size <= 0` 时按实际字节取；`sfa_v1.py` 第 1756–1761 行（native 分支，`fused_qkv_a_proj.weight`，不给上限）、第 2004–2011 行（`o_proj.weight`，上限 `MAX_O_PROJ_PREFETCH_SIZE`），`mla_v1.py` 第 73 行 = 16 MiB。分支条件按配置层核：`indexer_kpool_mla_v1.py` 第 577–578 行 GLM 子类把 `enable_sfa_prolog_v3`、`enable_mlapo` 都置 False（注意 `VLLM_ASCEND_ENABLE_MLAPO` 默认是 1，`envs.py` 第 87 行，所以「走 native」靠的正是子类这两行，不是默认值），与 02 第 367 行一致 | **已修好** |
| P1-2 52 无出处、重列算式 | `13 × 4` 已删，52 链接到多条请求页「提示词超过剩余预算时，分几步算」 | 该节第 181 行第 4 步 = 52，锚点能解析（lint 0 报错） | **按原口径已修好**；但「补齐到 64」不在链接落点那一节（在同页第 273、284 行「先补到自己这组的图尺寸」），且条 3 的推理本身有误，见新 P1-3 |
| P2-1 18 MiB 一层合计 vs 单次上限 | 条 1 改为两块「各自都在单次 18 MiB 的上限以内」，字节链接 prefetch-ratio | 与 prefetch-ratio 第 124 行口径一致 | 已修好 |
| P2-2 288 MiB 出处 | 本页已无 288，改为「每卡每层 432 MiB 路由专家权重里的三分之二」并链接 prefetch-ratio | prefetch-ratio 第 125 行同口径；D 第 63 行每卡 18 个专家、第 109 行 24 MiB / 个 → 432 MiB | 已修好，本页不再重算 |
| P3-1 / P3-2 | 条 4 改为「主线只推断了稠密 MLP 走 dynamic」；两处「手动开起来」统一为「含 GLM 代码的那份快照」 | grep 本页已无「底稿」「v0.23 上手动」「双机上手动」 | 已修好 |

「手动开起来」五条各抽一处核：条 1 `moe` / `mlp` 的 enable 条件（`weight_prefetch.py` 第 59–67 行）对；条 2 每卡 18 个专家（D 第 63 行）对；条 4 attn 预取只在 `w8a8_static.py` 的 `AscendW8A8LinearMethod.apply`、且 `x.dtype != torch.int8`（第 34、81–85 行），`methods/` 下其余文件没有 attn 预取调用，对；条 5 见上表，对；**条 3 不对，见下**。

### P1

**P1-3　条 3 把进 `select_experts` 的行数当成「一张卡 52 → 64 个 token」，并推出「一个 DP 组得有 24 条以上请求同时 decode 才够 96」——按源码这两点都不成立（第 138 行）。** 这条是 P4 遗留，上次审查也放过了，不是本轮修订引入的。
- 证据链（db701c1f）：`fused_moe_0_23_0.py` 第 479–502 行先 `moe_comm_method.prepare` 再 `quant_method.apply`；`w8a8_dynamic.py` 第 270–271 行 `select_experts(hidden_states=x)` 用的是 prepare 之后的张量；`experts_selector.py` 第 72–74 行在这里调 MoE 预取，`weight_prefetch.py` 第 90 行比的是这个张量的 `shape[0]`。MC2 的 prepare 在 `tp_size > 1 且未开 enable_shared_expert_dp` 时沿 token 维 `tensor_split` 成 TP 份、本卡只留自己那份（`prepare_finalize.py` 第 246–247、286–290 行；`enable_shared_expert_dp` 默认 False，`ascend_config.py` 第 114–117 行）。02 §6.4 第 648–651 行：本部署 MC2 容量 128，不超过 128 个 token 的步走 MC2；§6.5 第 670–671 行同样写明「按 TP8 沿 token 维切」；§6.8 第 731–732 行：超过 128 走 AllGather，DP2 All-Gather 成 [2 × max, 4096]。
- 推出来的结论：MC2 步每卡进 `select_experts` 的最多 128 / 8 = 16 行，52 那一步是 64 / 8 = 8 行；一个 DP 组纯 decode 最多 32 条 × 4 = 128 个 token（D 第 82 行 `--max-num-seqs` 32），仍走 MC2，所以**纯 decode 步无论多少条请求都过不了 96**；「24 条以上」是错的（24 × 4 = 96 走 MC2 后每卡只有 12 行）。能过门槛的只有超过 128 个 token、改走 AllGather 的步（带 prefill 的步），那时每卡行数是两组最大值的 2 倍。页面的「待核：比补齐后还是补齐前」源码已能回答：比的是 prepare 之后（补齐并按 TP 切开 / 或 DP 汇齐）的行数。
- 影响：核心机制讲错，给出了一个错误的触发条件（24 条），读者照这个去调并发会白调；结论方向（decode 不预取）碰巧对，所以不显眼。
- 改法：条 3 标题改成「纯 decode 步过不了 96 的门槛」；正文写清 ①不超过 128 个 token 的步走 MC2，MoE 先按 TP8 沿 token 维切，每卡进选专家的只有 1/8 行（最多 16 行）；②一个 DP 组纯 decode 最多 32 条 × 4 = 128 个 token，所以纯 decode 步一律不预取；③超过 128 个 token 的步改走 AllGather，两组汇齐后行数远过 96，MoE 预取只会在带长 prefill 的步里出现。数字只链接不重算：128 与 MC2 / AllGather 的分界链 [EP 页「MC2 还是 AllGather」](../../../../wiki/concepts/expert-parallel.md#mc2-还是-allgather)，TP8 切 token 链 EP 页「2. dispatch：源卡负责一行……」那一节，32 条链部署页 `--max-num-seqs` 那一行；若保留 52 → 64，链到多条请求页「先补到自己这组的图尺寸」（那里第 284 行有 52 → 64），不要只链分块那一节。删掉「24 条以上」和「补齐前后」那条待核；整条标「按源码推演，未实跑」。出处可补 `fused_moe_0_23_0.py#L479-L502`、`prepare_finalize.py#L284-L290`、`w8a8_dynamic.py#L270-L271`（新增来源注意 mark-flood 上限）。改完 grep 本页第 115 行「MoE 模型的小 batch decode 也拿不到 MoE 侧的预取」仍成立，不用动。

### P2

无。

### P3

1. **summary 末句「开了只有 moe.gate_up 与稀疏 MLA 那条路落得上」**：条 4 的 attn 两项是待核（取决于 attention 投影是否走 W8A8 静态），summary 把它写成了「落不上」。改法：「开了确定落得上的是稀疏 MLA 那条路，moe.gate_up 只在超过 128 token 的步触发；attn 两项待核」（随 P1-3 一起改）。
2. **事实表没有稀疏 MLA / SFA 那条路**：第 86–97 行十行里没有「只看 `enabled`、不读比例、不看门槛」这一行；第 93 行「profiling 里看不到 CMO 就是这个原因」在 GLM 这类带 SFA 的模型上不完整（小 batch decode 仍会有 SFA 那条路的 CMO）。改法：加一行「MLA / SFA 层预取｜只看 `enabled`；`fused_qkv_a_proj` 整块、`o_proj` 上限 16 MiB（静态 W8A8 时跳过）｜——｜——｜DeepSeek V3.2、GLM 这类稀疏 MLA 模型开了就有」，第 93 行改成「看不到 MoE 那条的 CMO」。
3. **条 5「GLM 的 11 层稀疏 MLA」**：部署开了 MTP（D 第 84 行），MLA 页第 224 行写明第 45 层 MTP 层也是稀疏 MLA。改成「主干 11 层（开 MTP 时第 45 层同样）」。

### 其他核对

- `pnpm wiki:lint` 退出码 0（全站 4 处待留意，均在别的页的 mark-flood，本页 0）。
- `pnpm wiki:audit` 退出码 0；本页「正文 11499 字 / 6 节 / 来源 36 条」；全库无效 commit 0、文件不存在 0、行号越界 0。参数页不在达标名单内，只统计。
- `git diff` 删掉的正文行：summary、`updated`、四段被改写的段落和一个重复的 `[D]`，改写后信息都在，没有丢信息。
- 没有把 GLM 主线数字当成预取收益；「没有实测数」（第 142 行）与「按源码，未实跑」的标注都在。
- 标题未改，全库入链锚点由 lint 跨页锚点校验覆盖，通过。

### 跳过

- frontmatter 来源区未读（由 audit 校验）；「版本谱系」「参数定义（自动生成）」两节未读正文（本轮未改动）。
- `weight_prefetch.py` 第 92–105 行、csrc 实现未读。
- 本轮只改了文字，没有重新截预览图。

## P5 修订记录 2（Opus 5.5，10-02，按复审改）

只在配置 / 调度层核，`weight_prefetch.py` 第 92–105 行与 csrc 未读。三检退出码 0。

### 新 P1-3 成立，条 3 已按源码重写

独立核实（db701c1f）：
- `ops/fused_moe/fused_moe_0_23_0.py` 第 479–497 行先 `moe_comm_method.prepare(...)`、取 `prepare_output.hidden_states`，第 497 行之后才 `self.quant_method.apply(...)`；`quantization/methods/w8a8_dynamic.py` 第 270–271 行 `select_experts(hidden_states=x, ...)` 用的就是 prepare 之后那个张量，而 MoE 预取挂在 `ops/fused_moe/experts_selector.py` 第 74 行、门槛判据在 `ops/weight_prefetch.py` 第 90 行比 `shape[0]`。
- `ops/fused_moe/prepare_finalize.py` 第 284–290 行（`PrepareAndFinalizeWithMC2.prepare`，类定义第 228 行）：`tp_size > 1 and not enable_shared_expert_dp` 时 `torch.tensor_split(hidden_states, tp_size, dim=0)`，本卡只留 `tp_rank` 那一份。
- 底稿：02 §6.4 第 645–652 行（`mc2_tokens_capacity = 128`，纯 decode 32 条 × 4 = 128 一定走 MC2）、§6.5 第 668–671 行（MC2 prepare 按 TP8 沿 token 维切）、§6.8 第 729–732 行（超过 128 走 AllGather，DP2 All-Gather 成 `[2 × max, 4096]`）。

所以旧写法两处错：门槛比的是 prepare 之后本卡的行数（不是这一步的 token 总数），且纯 decode 步最多 128 token → 每卡 16 行，「24 条以上就能过 96」不成立（24 × 4 = 96，MC2 切完每卡 12 行）。

改后的条 3：标题改成「纯 decode 步一律过不了 96 的门槛（按源码推演，未实跑）」；正文按三层写——① 门槛比 prepare 之后进 `select_experts` 的行数，MC2 沿 token 维按 TP8 切，本卡只留 1/8；② 一个 DP 组纯 decode 最多 32 条 × 4 = 128 token，切完每卡最多 16 行，所以纯 decode 一律不预取；③ 超过 128 的步改走 AllGather，两组汇齐后远过 96，MoE 这一侧的预取只出现在带 prefill 的步里。删掉「24 条以上」和「补齐前后」那条待核（源码已能回答）。数字只链接：128 与两条路的分界链 [EP 页 MC2 还是 AllGather](../../../../wiki/concepts/expert-parallel.md#mc2-还是-allgather)，32 条链[部署页「关键参数各管哪一步」](../../../../wiki/concepts/glm-5-3-flash-two-node.md#关键参数各管哪一步)，52 → 64 链[并发页「再补到两组的最大值」](../../../../wiki/concepts/concurrent-requests.md#再补到两组的最大值)（即 64 的出处那一节，同时修掉复审指出的锚点落点问题）。新增来源 C37（`fused_moe_0_23_0.py#L479-L502`）、C38（`prepare_finalize.py#L284-L290`）。

### 64 的链接落点已改

旧链接指向并发页「提示词超过剩余预算时，分几步算」（只有 52），现改为「再补到两组的最大值」（64 的推导处），与 EP 页「场景 M · 纯 decode」引的是同一节。

### P3 三条已改

1. summary 末句改成「GLM 双机没开，开了也只有稀疏 MLA 那条路确定落得上」（不再把 attn 两项写成落不上，也不把 moe.gate_up 写成常态触发；为满足 summary ≤200 字，把「quantize / gating / SwiGLU」收成「vector 计算」）。
2. 事实表加「MLA / SFA 层预取｜只看 `enabled`，不读 ratio、不看门槛；`fused_qkv_a_proj` 整块、`o_proj` 上限 16 MiB（W8A8 静态时跳过）」一行；因为 lint 限 10 行，把原「MoE 触发门槛」「MLP 触发门槛」两行合成「两道方向相反的 token 门槛」一行（两条信息都保留），并把「看不到 CMO」改成「看不到 MoE 那条的 CMO」。
3. 条 5 改成「GLM 主干 11 层稀疏 MLA（开了 MTP 时第 45 层同样是稀疏 MLA）」。
4. 顺带把「先看它到底会不会被触发」那段里的 MoE 门槛说法同步成「进 `select_experts` 的行数 ≥ 96，比的不是这一步的 token 总数」，避免同页两种说法。
5. 为过 mark-flood 30 处上限，删掉重复的 `[S32]`（同一句里 S25 / S30 已标，S32 在 sources 中仍保留）。

### 验证

- `pnpm wiki:lint` 退出码 0（本页 0 报错、0 待留意）。
- `pnpm wiki:audit` 退出码 0；本页「正文 12102 字 / 6 节 / 来源 38 条」；全库无效 commit 0、文件不存在 0、行号越界 0。
- `pnpm wiki:diagrams --check` 退出码 0。
- 正文字数：11,499 → 12,102。

### 自查

- 复审四条（P1-3 与三条 P3）全部成立并已改，无认为不成立的条目。
- 仍标明为推断的：attention 各投影的量化方法（缺 `quant_model_description.json`）；条 3、条 5 整体「按源码推演，未实跑」。

## P5 第二次复审（10-02）

复审员：Opus 5.5（独立复审，只审不改）。页面正文用去 frontmatter 的固定命令分段读（每次 ≤60 行），frontmatter 只看了 summary 4 行；源码先 grep 行号再读 ≤20 行。`weight_prefetch.py` 第 92–105 行与 csrc 未读（例外见「跳过」）。

**分数：6 / 10。上轮新 P1-3 已修好，「64」的链接落点已改对。但把整页触发 / 门槛类说法逐条对照源码后，又查出新 P1 2 条（其中 1 条差第 98 行这一环没核，按派发没读）、P2 1 条、P3 3 条。**

### 上轮 P1-3 逐环复核（db701c1f，配置 / 调度层）

| 环 | 页面说法（第 141–144 行） | 独立核实 | 结论 |
|---|---|---|---|
| 1 先 prepare 再选专家 | `prepare` 之后的张量才交给选专家 | `fused_moe.py` 第 290–291 行在 vLLM 0.23.0 下导入 `fused_moe_0_23_0`；该文件第 479–486 行 `moe_comm_method.prepare` 后取 `prepare_output.hidden_states`，第 497 行起才 `quant_method.apply`；`w8a8_dynamic.py` 第 270–271 行 `select_experts(hidden_states=x)`。另一条分支 `multistream_overlap_gate` 默认 False（`ascend_config.py` 第 140 行），不影响 | 对 |
| 2 门槛判据 | 比进 `select_experts` 的行数 ≥ 96 | `experts_selector.py` 第 72–74 行用传入的 `hidden_states` 调预取；`weight_prefetch.py` 第 14、90 行 `shape[0] >= 96`；2c59ff10 同样是这两行 | 对 |
| 3 MC2 按 TP8 切 | 本卡只留 1/8 | `prepare_finalize.py` 第 228 行 MC2 类，第 284–290 行 `tp_size > 1 and not enable_shared_expert_dp` 时 `tensor_split` 后只留 `tp_rank` 那份；`enable_shared_expert_dp` 默认 False 且另要求 EP 与 TP>1（`ascend_config.py` 第 114–118 行）；切分在 `not replace_allreduce` 分支里，FlashComm1 本部署关（02 §6.8 第 727 行），所以走这条 | 对 |
| 4 纯 decode ≤128 → 每卡 ≤16 行 | 32 × 4 = 128 仍走 MC2 | 02 §6.4 第 645–652 行容量 128、判据取两组最大值；D 第 82 行 `--max-num-seqs` 32；教程 0576b647 `GLM5.3-Flash.md` 第 283、333 行同为 32；A2 选择函数不区分 draft 模型（`ascend_forward_context.py` 第 341–344 行），MTP 草拟宽度同样 ≤128 | 对 |
| 5 52 → 64 → 8 行 | 链到并发页「再补到两组的最大值」 | 该节第 298、305、309 行有 DP0 的 52 → 64；锚点能解析（lint 跨页锚点校验通过） | 对，落点已修好 |
| 6 >128 走 AllGather，行数远过 96 | 两组汇齐 | `prepare_finalize.py` 第 459–469 行补到 `max_tokens_across_dp` 后 DP 组 all_gather，不按 TP 切；02 §6.8 第 729–732 行 `[2 × max, 4096]`，>256 行 | **门槛这一环对**；但「这些步真的会发预取」还取决于取权重那一步，见新 P1-5 |

### 整页触发 / 门槛类说法逐条核（共 24 条）

对的 16 条：默认 `{}` 即关、`enabled` 默认 False（2c59ff10 `ascend_config.py` 第 719 行，db701c1f 第 700 行）；GLM 教程命令里没有 `additional-config`；v0.26 顶层未知键不拦（2ed6cbba 只对 `short_request_first_config` 子键做未知键检查，第 950–952 行）；main `extra="forbid"`，装了 vllm_omni 时改为 warning 后丢弃（baa023ad 第 1664–1671 行）；`enable` 被 `.get("enabled", False)` 读成关；MoE `>= 96`；MLP `num_tokens < 500`（第 146 行，两个提交相同）；mlp / moe 互斥（第 61、67 行）；越界 ratio 丢弃、模块随之关闭（第 27、34 行）；缺模块回填默认（第 52、61、67 行）；18 MiB 的 clamp 只写在 MLP 两条路径（第 172–173、182–183 行）；gate_up 起点判据 `self_attn`、取同一层（第 165–167 行）；MLA / SFA 只看 `enabled`、无门槛，`o_proj` 遇 W8A8 静态返回（第 202–227 行；`sfa_v1.py` 第 1755–1761、2004–2011 行）；以及上轮 P1-3 的纯 decode 不过门槛、MC2 切分、AllGather 汇齐三条结论。

有问题的 8 条，归并成下面 2 条 P1、1 条 P2、3 条 P3。

### P1

**P1-4　MLP `gate_up` 那条预取还要 o_proj 走 vllm-ascend 的自定义行并行算子，默认单卡不满足；页面把 MLP 路径的触发写成只看 `num_tokens < 500`，旧模型记录据此算出「gate_up 12 MiB 整块被预取、一层 18 MiB、28 层 504 MiB」，并把 SP 依赖写在了 `down` 上——按 v0.23 源码方向反了（第 85、96、118、122–124、135 行）。**
- 证据链（2c59ff10）：gate_up 的预取只挂在 `linear_op.py` 第 153–158 行 `CustomRowParallelOp.apply` 里（全仓 `MLP_GATE_UP` 只此一处调用），子类都不覆盖 `apply`。`AscendRowParallelLinear.forward`（`linear.py` 第 363–371 行）只在 `custom_op` 非空时走它，否则回到 vLLM 原生 `RowParallelLinear.forward`。`custom_op` 由 `_get_row_parallel_op`（`linear_op.py` 第 700–740 行）决定：o_proj 只有在 oproj TP、DSA-CP 层分片、matmul-allreduce、FlashComm2、FlashComm1（即 SP）之一打开时才拿到自定义算子，都不开就返回 None（第 739、783 行）。FlashComm1 默认关（`ascend_config.py` 第 84–88 行，`envs.py` 第 75 行默认 0）。
- 反过来，`down` 的预取挂在 `activation.py` 第 37–43 行 `AscendSiluAndMul.forward_oot`，`SiluAndMul` 一律换成它（`utils.py` 第 737 行），这条路径上没有任何 SP 判据（`weight_prefetch.py` 第 134–153、177–186 行）。官方文档第 31 行说的是「down 依赖 SP」，与 v0.23 代码不符；页面第 135 行照抄了文档。
- 影响：旧模型记录（单卡 bf16、TP=1、没说开 SP）在默认配置下只有 down 那 6 MiB / 层会被预取（28 层 168 MiB），gate_up 那 12 MiB 根本没有插桩点经过；页面给出的 18 MiB / 504 MiB 与「整块权重都被预取」不成立。事实表与「先看它到底会不会被触发」都少了这道开关，读者会以为 dense 模型只要 token 数够小就两块都预取。
- 改法：① 事实表「两道方向相反的 token 门槛」与第 118 行补一句：MLP 的 gate_up 还要 o_proj 走 vllm-ascend 的自定义行并行算子（实际就是开了 FlashComm1 / SP 之类），默认不开时只有 down 那一块会预取；② 第 135 行改成「官方文档说 down 依赖 SP；v0.23 代码里依赖它的其实是 gate_up（挂在 o_proj 的自定义算子上），down 挂在 SwiGLU 上、不看 SP——两者不一致，以代码为准」；③ 旧模型记录要么写明「假设开了 SP」，要么按默认改成「只有 down 6 MiB / 层，28 层 168 MiB；gate_up 12 MiB 默认不预取」，并同步「一层合计」那句；④ 第 85 行「走的是 MLP 那条路」加「默认只有 down 那一半」。出处可补 `linear_op.py#L153-L158`、`#L700-L740`、`linear.py#L363-L371`（注意 mark-flood 上限）。

**P1-5（差第 98 行一环，按派发没读，需能读该段的人确认）　MoE 那条取权重时要 `layer_idx > 0`，而 MoE 模型里没有任何地方推进 `layer_idx`；GLM 单流水线 `start_layer = 0`，取权重函数每次都返回 None。若第 98 行拿到 None 就跳过，那么 GLM 上 MoE 预取在哪一步都不会发，条 2「只有 `moe.gate_up` 落得上」和条 3 第三点「MoE 预取只在带 prefill 的步里出现」都要改（第 140、144 行）。**
- 证据链（db701c1f；2c59ff10 相同）：`_get_moe_gate_up_prefetch_weight`（`weight_prefetch.py` 第 112–131 行）在 `layer_idx is None or layer_idx <= 0` 时返回 None，注释说 `layer_idx` 应在 layernorm 处 +1。全仓写 `layer_idx` 到 forward context 的只有三处：`ascend_forward_context.py` 第 151、153 行（置 None 或 `model.start_layer`）和 `weight_prefetch.py` 第 186 行（MLP down 预取后 +1）；`ops/layernorm.py` 里没有。第 186 行只在 `mlp.enable` 为真时走到，而 MoE 模型 `mlp.enable` 恒假（第 67 行）。GLM 有 `model.start_layer`（`glm5_next.py` 第 2282 行，`has_layer_idx` 为真），PP=1 时为 0。`_EXTRA_CTX` 就是代理到当前 forward context（`ascend_forward_context.py` 第 407–426 行）。MoE 预处理在第 98 行调用这个函数（只 grep 了行号，没读内容）；预处理的签名只传 `hidden_states` 与比例键，没有别的取权重来源。
- 影响：若确认，GLM 双机即使开了 `enabled`，`prefetch_ratio` 管得到的几项里一项都落不上，只剩条 5 的稀疏 MLA 那条（summary 已写「只有稀疏 MLA 那条路确定落得上」，不受影响）。prefetch-ratio 页对 `moe.gate_up` 饱和的分析也要同步加前提。
- 改法：先读 `weight_prefetch.py` 第 92–105 行确认第 98 行拿到 None 时是否直接返回；确认后把条 2 改成「`moe.gate_up` 在这份代码里取不到权重（`layer_idx` 停在 0），所以一项都落不上」，条 3 第三点改为「能过 96 的步也只是过了门槛，取权重这一步仍返回空」，事实表 MoE 那行补这道条件；没确认前至少在条 2、条 3 标「待核：取权重要求 `layer_idx > 0`」。

### P2

**P2-3　`attn` 路径少了「层类型」这道条件，插桩点清单也漏了它（第 97、106、145 行）。** `maybe_prefetch_attn_weight_preprocess`（2c59ff10 `weight_prefetch.py` 第 71–80 行）只认 `linear_prefix_map` 里的两个类名：`AscendQKVParallelLinear` → qkv、`AscendRowParallelLinear` → o（第 53–56 行），不看 token 门槛，也没有 18 MiB 的 clamp。GLM 全模型没有 `QKVParallelLinear`（`glm5_next.py`：KDA 的 q / k / v 是三个 `ColumnParallelLinear`，第 1577–1591 行；MLA 用 `MergedColumnParallelLinear` 的 `fused_qkv_a_proj`，第 1918 行），所以 `attn.qkv` 在 GLM 上与量化方法无关、一定落不上；`attn.o` 认的是所有 W8A8 静态的 `RowParallelLinear`（含 MLP 的 `down_proj`），不只 attention。第 106 行「三个插桩点……这三处都受 ratio 和各自的 token 门槛管；除它们之外还有 SFA 那条」漏了 `w8a8_static.py` 第 81–88 行这一处（受 ratio 管、没有 token 门槛）。改法：事实表 attn 行补「且层类型是 QKV / Row 并行线性层」；第 106 行改成四处插桩、注明 attn 那处无 token 门槛；条 4 改成「qkv 在 GLM 上一定落不上（没有 QKV 合并层）；o 取决于各 `RowParallelLinear` 的量化方法，待核」。

### P3

1. **第 118 行「收益全落在 decode 阶段」**与第 85 行自相矛盾：37 token 的 prefill 同样满足 `< 500`，不足 500 token 的 prefill 和混合步也会预取。改成「几千 token 的长 prefill 不预取，短 prefill 和 decode 照常」。
2. **MLA 那条的范围**（第 99、106 行）：普通 MLA 也有同样两处预取（2c59ff10 `mla_v1.py` 第 1655–1659、1795–1801 行），不只稀疏 MLA；事实表「意味着什么」改成「MLA 类模型（DeepSeek V3 / V3.2、GLM）开了就有」。
3. **第 106 行「预取下一层 `mlp.gate_up_proj`」**与第 108 行「同一层 MLP」措辞冲突，源码取的是同一层（第 166–167 行）。改成「本层 MLP 的 `gate_up_proj`」。另：模块自动关闭的条件是比例全丢光**或全为 0**（第 34 行 `any(...)`），第 100 行可顺带补上。

### 其他核对

- `pnpm wiki:lint` 退出码 0（全站 4 处待留意，均为别的页的 mark-flood；本页 0）。
- `pnpm wiki:audit` 退出码 0；本页「正文 12102 字 / 6 节 / 来源 38 条」；C37 = `fused_moe_0_23_0.py#L479-L502`、C38 = `prepare_finalize.py#L284-L290`，行号有效；全库无效 commit 0、文件不存在 0、行号越界 0。
- `git diff` 删掉的正文行均为改写，新版信息都在；summary 与新 P1 不冲突。
- 「没有实测数」「按源码推演，未实跑」两处标注仍在；没有把 GLM 主线数字当成预取收益。

### 跳过

- `weight_prefetch.py` 第 92–105 行未读。例外：grep `_EXTRA_CTX` 时第 95 行一行内容（一个 None 检查）顺带出现在输出里；第 98 行只用 `grep -n | cut` 拿了行号，内容没读。P1-5 因此差这一环。
- csrc 未读，所以「attn / moe 靠后端截断到 18 MiB」与条 2「0.8 与 1.0 一样」没核。
- frontmatter 来源区未读（由 audit 校验）；「版本谱系」「参数定义」两节只按关键词 grep 了触发 / 门槛类说法，没有命中。
- 旧版信息清单本轮未重抽（首轮审查已核）；本轮只改了文字，没有截图。

## P5 修订记录 3（GPT-6 Astra）

2026-10-02。本轮按任务只修改 weight-prefetch-config 页面并追加本记录；该页原无引用图，未新增或修改其他页的图。未重做旧版信息清单，未提交 Git，未启动服务、未占用 5193 / 8790、未截图。本轮是文档事实核查，未启用代码协作技能。

### 结论与核读范围

修正 **16 组说法**：复审点名的 8 组，以及沿完整调用链补查的 8 组。下文独立列出 **8 条触发路径结论**，每条都有实际读取的文件与行号。原先「过 token 门槛就会发」「大权重一定发到上限」均不再成立；正文区分模块配置、调用入口、行数条件、权重取得、提交请求和设备效果。

- 完整读取 db701c1f 的 `vllm_ascend/ops/weight_prefetch.py` **1–238**，包括此前缺失的 **88–105**：98–101 明确在权重为空时清 active 并返回；不是仅看函数名或 grep 摘要。
- `git rev-parse <rev>:vllm_ascend/ops/weight_prefetch.py` 实际核对 **2c59ff10、db701c1f、e77502ef^**，三者对象均为 **6fbb6fba790f0c6ac495be50a7e109e1718a0ac2**；两次 `git diff` 为空，故完整正文相同，不把不同提交的同名文件凭空当同实现。完整读取 ff375759 引入时的文件；当时只有 attn 路径。2ed6cbba、baa023ad 的 `git ls-tree` 确认该文件不存在，并读配置入口与未知键处理。
- 读取配置的 WeightPrefetchConfig 完整定义、模块默认和开关、全局单例初始化与 stream 注册；读取完整 forward context / MC2 选择逻辑、行并行算子选择与调用、激活与 RMSNorm 钩子、W8A8 静态 apply、MoE prepare / selector 调用链、普通 MLA / SFA 两处入口及 GLM 子类强制 native 的代码。另查主模型和 MTP 的 context 参数，以及 PP 起点的上游实现。
- 全仓查当前 forward context 的 layer_idx 写入，仅初始化为 None / start_layer 和 MLP down 的递增；模型对象自身的 self.layer_idx 与其他计数器 moe_layer_index 不是同一个字段。RMSNorm 无 residual 分支只调用预取后处理，与 op-to-ai-core 现文一致。

### 两条 P1、一条 P2 与 8 条问题清单

复审未单列 8 个编号，以下按其引用位置拆分为 8 组；同组在摘要、事实表、解释段、GLM 段中的重复说法一起修正。

| 编号 | 对应审查 | 修订与证据 |
|---|---|---|
| 1 | P1-4：只写 MLP token 门槛 | 补 gate_up 的自定义行并行入口和 prefix / 模型结构条件。db701c1f `ops/linear.py` 363–371、`ops/linear_op.py` 153–158、709–790；2c59ff10 的选择函数 700–781。默认相关开关全关时没有 gate_up 调用，SP 只是可选入口之一。 |
| 2 | P1-4：旧 Qwen 两块全取、一层／一轮流量 | 撤回实际搬运量断言，保留 bf16 dense 单卡默认只有 down 有入口的路径对照。旧 12 MiB / 6 MiB 是权重体积，18 MiB / 504 MiB 不能当预取量；不在本页另算 168 MiB，也不虚构「假设开 SP」来保住旧数。权重配置未钉住列为待核，旧数字在历史记录中仍可追溯。 |
| 3 | P1-4：down 必须开 SP | 改成文档与源码不一致，以源码为准。2c59ff10、db701c1f `ops/activation.py` 37–43、`weight_prefetch.py` 134–156、177–186 无 SP 判据；gate_up 才依赖自定义行并行路径。 |
| 4 | P1-5：moe 唯一生效、带 prefill 才发 | **确认为错误。** `weight_prefetch.py` 98–101、112–131 完成此前缺失的一环；主干索引停 0，返回空权重，不提交请求。过 96 的 AllGather 步仍不发；不以假设取权重成功为前提宣称饱和。 |
| 5 | P2-3：attn 只查量化、三个插桩点 | 补精确类名、输入非 int8、无 token 门槛；插桩按职责分为四类。`weight_prefetch.py` 50–56、71–86，`quantization/methods/w8a8_static.py` 74–122；GLM `models/glm5_next.py` 1577–1597、1916–1963 没有 QKVParallelLinear。o 也匹配 MLP down_proj，不能只写 attention。 |
| 6 | P3-1：收益全在 decode | 改为短 prefill、混合步、decode 均可能过 MLP 门槛；长 prefill 只排除 MLP 两路，不能保证首 token 延迟不受其他路径影响。`weight_prefetch.py` 134–156 没有 prefill/decode 分类判断。 |
| 7 | P3-2：只列稀疏 MLA | 补普通 MLA：`attention/mla_v1.py` 1655–1659、1795–1803；不能泛化为所有 MLA 模型、所有分支开 enabled 就一定发。 |
| 8 | P3-3：下一层／全丢光才关 | 改同一层；模块过滤后全零也关闭。`weight_prefetch.py` 26–34、158–175。 |

P1-4、P1-5、P2-3 对本页的错误表述均已改正；设备收益和后端上限保留为明确待核，不以未实测替代对源码分支的结论。

### 其余 16 条原清单复核

| 原清单项目 | 结果及源码 |
|---|---|
| 1 默认空配置 | 保留：2c59ff10 / db701c1f `ascend_config.py` 52–53。 |
| 2 enabled 默认 False | 保留：分别 719–720 / 700–701。 |
| 3 官方 GLM 命令未打开本项 | 保留官方双机部署链接及磁盘 safetensors prefetch 的区分；启动配置与默认值不混成「启用了 L2 预取」。 |
| 4 v0.26 顶层未知键不拦 | 保留：2ed6cbba `ascend_config.py` 56–73 的读取入口；weight-prefetch 字段与实现均已删除。 |
| 5 main 拒绝／Omni 例外 | 保留并补齐概览和表格例外：baa023ad `ascend_config.py` 455、1660–1678；warning 后丢弃不叫静默。 |
| 6 enable 拼错无效 | 保留：db701c1f `ascend_config.py` 700 只取 enabled。 |
| 7 MoE ≥96 | 保留比较值，明确仅必要条件：`weight_prefetch.py` 14、88–104。 |
| 8 MLP <500 | 保留比较值，补层索引非空及 padded token 口径：`weight_prefetch.py` 134–156；runner 2265–2273。 |
| 9 MLP / MoE 互斥 | 保留，限定整模型分类，不按每一层分类：`weight_prefetch.py` 46–69。 |
| 10 越界比例丢弃／关闭 | 补齐「过滤后整组无正值」条件；单项丢弃不等于关闭该项：26–34、71–80、230–238。 |
| 11 缺模块回默认 | 保留空 dict 也回默认，区别于非空组中缺单项：50–69。 |
| 12 MLP 两路 Python clamp | 保留并收窄：172–173、182–183；公共封装 235–238 会把零尺寸变成整块。attn / moe 后端统一上限不再当事实。 |
| 13 self_attn 起点与同层 | 保留，修掉下一层和整个 attention 提前量：158–175、`linear_op.py` 153–158。 |
| 14 MLA 不读比例、不查 token | 保留辅助函数条件，并补调用分支、metadata 及静态 W8A8 跳过条件：202–227；SFA 1650–1761。 |
| 15 MC2 切分与纯 decode 过不了 96 | 保留固定部署条件；`prepare_finalize.py` 249–314，`ascend_forward_context.py` 97–101、202–217、240–252。容量数字链接单一出处，不重算。 |
| 16 AllGather 汇齐 | 保留行数结论，删除「所以会预取」：`prepare_finalize.py` 355–373、440–469，`weight_prefetch.py` 98–101。 |

### 额外系统修正 8 组

9. MLP 比较上下文的补齐后行数，非请求原始 token 数：runner 2265–2273 → context 136。
10. 先 prepare 后 selector 只写固定多流 gate 关闭的路径；打开多流 gate 时顺序改变：`fused_moe_0_23_0.py` 438–479；`w8a8_dynamic.py` 262–287。短 prefill 不等于一定跨过 MC2 容量。
11. MTP 单独追踪：proposer 1118–1135 不传模型实例，context 默认 None，MoE 94–96 返回，不把主干 start_layer=0 论证直接套到草拟模型。
12. 18 MiB 从统一硬上限收窄为 MLP 的 Python 正字节截断；已查 `csrc`，没有调用所用 npu_prefetch 的实现。官方 API 文档也不足以证明指定镜像统一上限，记录缺 torch_npu / CANN 的精确版本与底层证据。
13. 配置边界补单项缺失／零值在组仍开时可能请求整块；不能把缺键回填笼统写成「安全」或全零才能丢弃。
14. gate_up 提前量从「整个 attention」改为「attention 输出投影算完之后」；layernorm 钩子只有后处理，无索引递增。
15. GLM native 原因有直接证据：`indexer_kpool_mla_v1.py` 557–579 强制禁用两种融合前处理；SFA 1650–1666 缺 metadata 提前返回，普通 MLA 融合 QKV 必须存在。
16. MLA / SFA 的函数名不等于本流执行：202–227 最终调 `register_custom_ops.py` 137–142 切预取流；静态 W8A8 o_proj 的跳过只验方法，不证明 attn 路已实际发出，后者另有开关与输入 dtype 条件。

### 完整源码支持的 8 条触发路径结论

下列路径相对 `vllm_ascend/`，默认 db701c1f；通用 weight_prefetch 实现与 2c59ff10 相同。

| 路径 | 结论 | 文件 + 行号 |
|---|---|---|
| 1 MLP gate_up | enabled、非 MoE、组仍开、上下文索引／行数有效且 <500，再经过自定义行并行 apply，前缀倒数第二段 self_attn；取前缀对应同层权重。默认相关优化开关全关的单卡 dense 没有这一路调用。 | `weight_prefetch.py` 65–69、134–175；`ops/linear.py` 363–371；`ops/linear_op.py` 153–158、709–790（2c59ff10 为 700–781）。 |
| 2 MLP down | 同一组和上下文门槛，走带钩子的 SwiGLU 即可进入，不要求 SP；取得当前层 down 权重提交后索引才加一。 | `ops/activation.py` 37–55；`weight_prefetch.py` 134–156、177–200。 |
| 3 GLM 主干 MoE gate_up | ≥96 不是充分条件。PP1 start_layer=0，MoE 模型 MLP 关闭，索引不推进；取权重为空，清 active 返回，所有宽度均不发。 | `ascend_forward_context.py` 149–157；`models/glm5_next.py` 2282–2286；`weight_prefetch.py` 88–139、186；vllm@0fc695fc `model_executor/models/utils.py` 632–663、`distributed/utils.py` 109–154。 |
| 4 GLM MTP MoE gate_up | 独立 context 未传 model_instance，在模型实例检查就返回；不靠主干索引解释。 | `spec_decode/llm_base_proposer.py` 791–802、1118–1135；`ascend_forward_context.py` 67、149–157；`weight_prefetch.py` 94–96。 |
| 5 attn.qkv | 静态 W8A8 apply、输入非 int8、attn 组开且精确类名为 AscendQKVParallelLinear；GLM 没有该类型，所以不发，不依赖量化清单是否齐全。 | `weight_prefetch.py` 50–56、71–86；`quantization/methods/w8a8_static.py` 74–122；`models/glm5_next.py` 1577–1597、1916–1948。 |
| 6 attn.o | 静态 W8A8 apply、输入非 int8、attn 组开且精确类名为 AscendRowParallelLinear；无 token 门槛，覆盖范围可含 MLP down。GLM 哪些层实际进入待核量化清单与 dtype。 | `weight_prefetch.py` 50–56、71–86；`quantization/methods/w8a8_static.py` 74–122；`models/glm5_next.py` 1957–1963。 |
| 7 MLA / SFA 融合 QKV | 走到调用点且 enabled 即请求整块，不读 ratio / token / layer_idx；普通 MLA 须投影存在，SFA 须 native 且有 metadata；GLM 子类强制 native，真实输入满足该路径。 | `attention/mla_v1.py` 1655–1659；`attention/sfa_v1.py` 1650–1666、1703–1761；`attention/indexer_kpool_mla_v1.py` 557–579；`weight_prefetch.py` 202–227。 |
| 8 MLA / SFA o_proj | 走到调用点、enabled 且包装量化方法不是静态 W8A8 时，按权重大小与 16 MiB 请求上限取较小值；静态方法直接跳过，不担保其他路已发。 | `attention/mla_v1.py` 73、1795–1803；`attention/sfa_v1.py` 2004–2011；`weight_prefetch.py` 202–227。 |

### 数字、跨页口径与取舍

- 数字只链接底稿 02 §1.3 / §6.6、单请求 MoE 容量节、并发页补齐节和比例页；删除本页的 Qwen 乘法与每轮预取字节重算，也不另算 128 / TP8、64 / TP8。96、500、18 MiB、16 MiB 是实际读取的源码常量／比较值。
- `prefetch-ratio.md` 当前仍有「moe 唯一生效／已饱和」「旧 Qwen 两项都会读」「attn / moe 后端统一截断」等历史结论；本轮严格遵守只改本页范围，没有修改该页。**本页末尾已明确这些说法必须受新核实的触发条件限制，后端上限待核**；比例与体积的单一出处保留，不复制其错误的实际触发推断。这里不声称两页历史文本已全部同步。
- `op-to-ai-core.md` 已正确写 RMSNorm 的无 residual 分支仅有后处理钩子；本页按实际源码对齐，不把它当 MoE layer_idx 的推进点。
- 源码可确定的分支已写结论；待核只保留实际缺件：GLM 量化配置与输入 dtype、后端版本与上限实现、旧 Qwen 钉住配置、设备开关对照。未把读取失败伪装成未知，88–105 已完整读到。
- 对外链接补查了[官方 npu_prefetch API](https://www.hiascend.com/document/detail/zh/Pytorch/700/apiref/apilist/ptaoplist_001247.html)：其 max_size / dependency 说明不能证明当前镜像有统一 18 MiB 上限；不以其他版本文档替代钉住运行时。

### 验证

- Windows PowerShell 禁止执行 pnpm.ps1，改用同安装目录的 `pnpm.cmd`，没有更改执行策略。
- `pnpm.cmd wiki:lint`：退出码 0，本页 0 报错；全站 4 条非阻塞提示，均为其他页。
- `pnpm.cmd wiki:diagrams --check`：退出码 0，290 张图与 spec 一致；42 条既有非阻塞提示，本页无图错误。
- `pnpm.cmd wiki:audit`：退出码 0，无效 commit、文件不存在、行号越界、未知仓库均为 0；本页来源均有效。审计不代替本轮人工对调用条件的核对。
- `pnpm.cmd check:content`：退出码 0，registry 139 页内容校验通过；工具提示当前无章节，因此跳过 Term 引用检查。
- 按本轮共用说明不启动服务、不截图；这是源码与文档验证，未声称已跑 NPU 或浏览器验收。待用户决策项：无。

## P5 第三次复审（10-02）

复审员：Opus 5.5（独立复审，只审不改页面）。页面正文用去 frontmatter 的固定命令分段读（每次 ≤60 行），frontmatter 只 grep 了 summary；源码一律「函数签名 + 条件行 grep」或单行取数，`weight_prefetch.py` 88–105 没有整段读，只在该范围内 grep 了 `None / return / active / THRESHOLD` 几类条件行。

**分数：7.5 / 10。上轮 P1-4、P1-5、P2-3 与 8 条清单在本页上全部修好；修订记录 3 给出的源码行号逐条核对全部对上。扣分来自：比例页 prefetch-ratio 仍是旧口径，与本页直接冲突（新 P1 1 条，须改的是比例页）；本页有 2 条 P2。**

### 上轮 P1×2、P2×1 与 8 条清单逐条复核（对照页面现文）

| 编号 | 上轮问题 | 页面现文位置 | 结论 |
|---|---|---|---|
| 1 | P1-4：gate_up 还须走自定义行并行算子 | 事实表第 120 行；第 130、144、148 行 | 已修 |
| 2 | P1-4：旧 Qwen 18 MiB / 504 MiB 当预取量 | 第 109、148、150 行撤回，并写清「权重体积 ≠ 是否发预取」 | 已修（但整段字节算例被删，见新 P2-5） |
| 3 | P1-4：「down 依赖 SP」方向反了 | 第 158 行改为文档与源码不一致、以源码为准；源码位置表第 244、246 行 | 已修 |
| 4 | P1-5：MoE 取权重要 `layer_idx > 0` | 第 146、163、164 行；源码位置表第 247–249 行；summary 同步 | 已修，且补了 MTP 那条 |
| 5 | P2-3：attn 漏层类型条件、插桩点只列三处 | 第 121、130、165 行 | 已修 |
| 6 | P3-1：收益全落在 decode | 第 144 行 | 已修 |
| 7 | P3-2：只列稀疏 MLA | 第 123、166 行 | 已修 |
| 8 | P3-3：「下一层」与「全丢光才关」 | 第 124、130、134 行 | 已修 |

上轮「对的 16 条」抽查仍在：默认 `{}`、`enabled` 默认 False、`enable` 拼错、v0.26 不拦 / main 拒绝与 vllm_omni 例外、越界丢弃、缺模块回填、MLP / MoE 互斥、MLA / SFA 只看 enabled、静态 W8A8 时 o_proj 跳过，均在现文第 115–124、156–157、170 行。

### 修订记录 3 的行号引用核对（最窄读法）

共核 53 处，**全部对上**，没有一处需要扩大读取范围：

- 「8 条触发路径」表引用 32 处：`weight_prefetch.py` 50–56、61、65–69、71–86、88–139（只取 89–90 门槛、92–93 / 95–96 返回、98–101 空权重清 active 后返回）、112–131（115 行 `layer_idx <= 0` 返回 None）、134–156（146 行 `< 500` 且 layer_idx 非空）、158–175、177–200（186 行唯一递增）、202–227（209 行只看 enabled、225–226 行零值改整块）；`ops/linear.py` 363–371；`ops/linear_op.py` 153–158、709–790（2c59ff10 对应 700–781）；`ops/activation.py` 37–55；`ascend_forward_context.py` 67、149–157；`glm5_next.py` 2282、1577–1591（三个 ColumnParallelLinear）、1918（MergedColumnParallelLinear）、1957（RowParallelLinear），全文件无 `QKVParallelLinear`；`llm_base_proposer.py` 791–802、1118–1135（spec_decode 全目录无 `model_instance`）；`w8a8_static.py` 81（`x.dtype != torch.int8`）、85、119；`mla_v1.py` 73（16 MiB）、1655–1659、1796–1800；`sfa_v1.py` 1660–1666、1758–1759、2005–2009；`indexer_kpool_mla_v1.py` 577–578；vLLM@0fc695fc `models/utils.py` 632–663、`distributed/utils.py` 109–154。
- 其余 21 处：三个提交的 `weight_prefetch.py` blob 均为 6fbb6fba；2ed6cbba / baa023ad 无此文件；两份 `ascend_config.py` 默认值行（db701c1f 52–53、699–701；2c59ff10 718–720）；2ed6cbba 56–73；baa023ad 455、1664–1665；`register_custom_ops.py` 137–156；`utils.py` 509–528；`fused_moe_0_23_0.py` 438–502 的先后顺序；`w8a8_dynamic.py` 262–270；`experts_selector.py` 71–74；`prepare_finalize.py` 274–290、355–373、459–469；`ascend_forward_context.py` 97–98、202–217、250–252；`model_runner_v1.py` 2268、2273；`layernorm.py` 86–87（只调后处理）；全仓对上下文 `layer_idx` 的写入只有 forward context 151、153 与 `weight_prefetch.py` 186 三处；attention 目录无预取后处理调用。

推断与定论的区分：页面把 attn.o 在 GLM 上是否发出、后端是否统一截到 18 MiB、设备收益三件事明确标为待核（第 165、260 行），其余写成定论的都有上述源码支撑；没有发现把推断写成定论。数字方面，128、52 → 64、部署拓扑都只链接出处，96 / 500 / 18 MiB / 16 MiB 是源码常量；没有把 GLM 主线数字当成预取收益。

### 与 prefetch-ratio、op-to-ai-core 的口径

- op-to-ai-core：第 191 行「无 residual 分支只调用预取后处理」与本页第 134 行一致。**通过。**
- prefetch-ratio：**不一致**，见新 P1-6。

### P1

**P1-6（跨页，须改 prefetch-ratio）　比例页仍保留本页已推翻的触发结论，知识库对同一问题给出两种答案。** 位置（`wiki/params/prefetch-ratio.md` 文件行号）：
- 第 87 行：`down` 另需开序列并行。与本页第 158 行和源码（`activation.py` 37–43 无 SP 判据）相反；需要自定义行并行路径的是 gate_up。
- 第 86 行：`moe.gate_up` 的生效条件只写了「MoE 模型且 ≥ 96」，缺「有模型实例、上下文 `layer_idx > 0`、能取到 `w13_weight`」。
- 第 125 行：GLM 上 `moe.gate_up`「是唯一落得上的一项、饱和了的旋钮」。按本页第 163 行与源码，GLM 主干与 MTP 都取不到权重，一次都不发；而 attn.o 反倒可能发出（待核）。
- 第 84、104、114 行：把「attn / moe 由后端截到 18 MiB」写成定论，并据此推出 0.8 与 1.0 等价。本页第 119、260 行已说明后端上限待核。
- 影响：问答检索到比例页时会给出错误答案；本页第 258 行只好写一段「比例页的历史表述须加条件才能用」来打补丁，这种写法本身也不该长期留在页面上。
- 改法：按本页第 120、144、146、163、165 行的结论改比例页这几行。第 86 / 87 行补齐条件；第 125 行改成「GLM 上 moe.gate_up 取不到权重，一项都不发；attn.o 取决于量化与输入，待核」；第 84、104、114 行把后端截断改为待核，「0.8 与 1.0 等价」降级为「若后端也截到 18 MiB 才成立」。比例页改完后，把本页第 258 行压成一句「比例与尺寸见 prefetch_ratio」。这条不归本页写手的修改范围，需要主会话另派。

### P2

**P2-4　页面上留有过程性 meta 文本（第 237、258 行）。** 第 237 行写了「本轮完整读取 … 包括此前缺读的 88–105」；第 258 行有「本轮不把…当结论」和「历史表述」。这些是审查过程的记录，不是给读者的内容，按派发口径属于 meta 文本。改法：第 237 行删掉「本轮…缺读」那半句，只保留「源码能确定的是……仍需实测」；第 258 行的「本轮」改成陈述句（P1-6 修完后整段压成一句）。

**P2-5　旧 Qwen3-0.6B 字节算例整段删除，正确的部分也一起删了（原第 109–116 行）。** 删掉的错误只是「gate_up 整块被预取」和「一层 18 MiB、28 层 504 MiB 是预取量」。四块权重的形状与体积（gate_up 12 MiB、down 6 MiB、qkv 8 MiB、o 4 MiB）本身是对的，而且全库别处都没有。页面因此没有一个具体的数字例子，任务文件要求的「旧模型记录保留原语境」也只剩定性的一句。修订记录 3 给的理由是「缺钉住版本的模型配置」，但旧文本本来就标了 [D] 并注明 `intermediate_size` 取自模型配置，可以补一个 Qwen3-0.6B 配置的出处来解决。改法：在第 148 行后恢复一个精简算例：down 6 MiB / 层默认会被请求（< 18 MiB，整块）；gate_up 12 MiB 默认没有入口；qkv 8 MiB、o 4 MiB 因为是 bf16 不走静态 W8A8，不会发。标明「旧模型记录、单卡 bf16、非实测、请求字节 ≠ 实际收益」，并补模型配置出处。不恢复 504 MiB 的说法。

### P3

1. 第 130 行「四类……前三类中的 attn 没有 token 门槛」读起来别扭。改成「其中 attn 那一类没有 token 门槛」。
2. 旧事实表「MoE 门槛」行的排障提示「profiling 里看不到 CMO 就是这个原因」已删。在 GLM 上现在的真正原因是取不到权重，可以在第 163 行末补一句「所以开了也在 profiling 里看不到 MoE 的预取」，方便排障。
3. 本页是 34 个参数页里唯一带「## 对照源码」节的（`grep -l '^## 对照源码' wiki/params/*.md` 只命中本页）。生成脚本按 H2 整节替换「参数定义（自动生成）」（`scripts/wiki/lineage.ts` 第 38 行起），不会误删这一节，所以无害；只是与同类页结构不一致，留给统一决定。

### 其他核对

- `pnpm wiki:lint`：退出码 0；全站 4 处待留意，都是别的页的 mark-flood，本页 0。
- `pnpm wiki:audit`：退出码 0；本页「正文 14966 字 / 7 节 / 来源 62 条」；全库无效 commit 0、文件不存在 0、行号越界 0、未知仓库 0。
- 入链：index、log、prefetch-ratio 三处；prefetch-ratio 指向本页的 `#开了的代价` 锚点可以解析。
- summary（第 6–8 行）已与 P1-5 的结论同步。
- `git diff HEAD` 的删除行逐条对照：除 P2-5 与 P3-2 外，其余删除都是改写，或是把错误说法（「提前量接近整个 attention」「down 依赖 SP」「≥96 即触发」）改正。

### 跳过

- `weight_prefetch.py` 88–105 没有整段读，只 grep 了条件行（门槛、None 检查、return、active），已足以核对 94–96、98–101 两处引用。
- csrc 未读；后端上限页面本来就标为待核，不需要核。
- frontmatter 来源区未读（由 audit 校验）；「版本谱系」「参数定义」两节是自动生成的，只看了非表格行。
- 旧版信息清单本轮没有重抽（首轮审查已核），只核了第 10 条「Qwen 字节算例」的去向，见 P2-5。本轮只改了文字，没有截图。

## P5 修订记录 4（GPT-6 Astra）

2026-10-02，范围仅本页两条 P2 及本修订记录；未修改 prefetch-ratio、图、代码、索引或计划，未提交 git。

### 两条 P2 的处置

- **P2-4：过程性措辞已清理。** 页面原第 237 行删去核读轮次和补读区间，现第 250 行只保留源码能确定的请求提交行为与设备实测边界。原第 258 行改为现第 273 行的比例页链接及调用条件，不再讨论其他写手的历史表述或本轮修订过程。随 Qwen 算例恢复，原第 150 行的「撤回／不再重算」也改为读者可用的算例与适用条件。搜索「本轮／此前缺读／历史表述／撤回／不再重算」无命中。
- **P2-5：恢复精简的旧模型记录。** 从 `git log --oneline -- wiki/params/weight-prefetch-config.md` 定位 `14591fd`，核读该版本「开了的代价」中的 Qwen 算例。现第 151–161 行恢复单卡 TP1、bf16、28 层语境，四块权重的形状、元素字节口径与 12/6/8/4 MiB 体积，统一用一块 calc 展示。明确只开本参数、默认比例、其余相关开关关闭，并满足 MLP 门槛时 down 每层请求整块 6 MiB；gate_up 默认没有入口；qkv/o 的 bf16 路径不发静态 W8A8 预取。区分权重体积、请求字节与实测收益。
- **未恢复错误合计的逐点理由。** gate_up 的 12 MiB 是权重体积，默认路径不提交请求，故不能与 down 的 6 MiB 相加称为每层 18 MiB 预取量；28 层本身仍保留，但据上述错误合计乘出的 504 MiB 不能称为每轮预取量；即使提交了请求，也不能由请求字节推出设备实际搬运量、缓存命中或性能收益。qkv/o 的正确体积一并恢复，没有因不触发而删除。TP>1 保留需重算分片的边界，避免把单卡数直接推广。

### 数字与源码证据

- Qwen 数字不取 GLM 底稿：按本任务要求保留独立旧模型语境。新增 sources 第 63 条为 [Qwen3-0.6B 官方 config.json](https://huggingface.co/Qwen/Qwen3-0.6B/blob/167b8104f88905a951069f5f95f9776908da5f68/config.json)，钉住完整 commit `167b8104f88905a951069f5f95f9776908da5f68`；已联网打开该固定版本并核对第 9–19、25 行的头维度、hidden、中间维度、头数、层数及 dtype。页面第 271 行建立来源与推导的对应。raw URL 在 web 工具中失败后改用该 commit 的 blob 页完成核验。
- 本轮直接核读 `vllm-ascend@db701c1f`：`ops/weight_prefetch.py` 134–186（MLP 门槛、两路取权重与截断），并定位第 15、65–69 行的 18 MiB 常量与默认比例；`ops/activation.py` 37–43（down 从 SwiGLU 进入），`ops/linear.py` 363–371 与 `ops/linear_op.py` 153–158、709–748（自定义行并行路径的选择与 gate_up 入口），`quantization/methods/w8a8_static.py` 74–88（attn 预取位于静态 W8A8 apply）。这些证据支撑本次恢复算例的调用条件；其余既有源码表未改。
- 四块权重逐项复算得到 12,582,912 / 6,291,456 / 8,388,608 / 4,194,304 B，分别为 12 / 6 / 8 / 4 MiB。GLM 数字仍只链接底稿 02 §1.3、§6.6，本轮读取这两节但未新增 GLM 数字或收益推断。

### 验证与限制

- `pnpm.cmd wiki:lint`：退出码 **0**，本页 **0 报错**；全站 4 条不阻塞提示均属于其他页。初次直接使用 `pnpm` 被 PowerShell 的 ps1 执行策略阻止，改用同一 pnpm 的 `.cmd` 入口执行成功，未改变系统策略。
- `pnpm.cmd wiki:diagrams --check`：退出码 **0**，290 张图与 spec 一致；本页 **0 报错**，全站 42 条不阻塞提示均为其他图。
- `pnpm.cmd wiki:audit`：退出码 **0**，本页 **0 报错**，正文统计 15,759 字／7 节／63 条来源。全站 139 页，无效 commit、文件不存在、行号越界、未知仓库均为 **0**；名单内 100 页全部达标。本页属参数归档页，未把名单外的写作统计冒充完整语义审查。
- `pnpm.cmd check:content`：退出码 **0**，registry 139 页通过；尚无章节的 Term 引用检查由命令跳过。`git diff --check -- wiki/params/weight-prefetch-config.md` 通过。
- 原审计输出过长，第二次 audit 仅提取本页与全站汇总，以核实本页统计。外链由本轮单独联网核验，audit 自身不证明外链或语义正确。
- 沿用现有页面结构与图；新增 calc 仅一块，与表格不相邻，未增加教学正文证据角标。未新做旧版信息清单（用户本轮豁免），未起服务、未截图，未做硬件实测。
- **待核与取舍：** 已补齐 Qwen 固定版本配置，因此移除对应资料缺口；GLM attn.o 的量化与输入条件、MoE/attn 的后端上限和性能对照仍保留在页末。比例页 P1-6 由另一写手处理，本轮不宣称跨页问题已关闭；本页保留简短的事实边界，避免依赖该页修订进度。两条 P2 自查无新增 P1 疑点；需用户决定的问题：无。
- 2026-10-03 链接修正：第 163 行原先用相对链接 `../../docs/mainline/02-forward.md` 指向底稿 §1.3、§6.6，该路径越出 `wiki/` 目录，阅读页上打不开，还会让夜间巡检的文件存在性检查抛「非法审阅路径」并带崩整晚任务。现改链站内两处等价内容：每卡权重账改链 [glm-5-3-flash-two-node.md#每张卡上放了什么](../../../../wiki/concepts/glm-5-3-flash-two-node.md)，W8A8 精度配方改链 [matmul-and-weights.md#双机前提与-w8a8哪些矩阵是-8-位](../../../../wiki/concepts/matmul-and-weights.md)；GLM 数字本身未改。`pnpm wiki:lint`、`pnpm wiki:audit` 退出码均为 0（lint 的 4 条不阻塞提示仍属其他页）。工具侧根因与修法见 [nightly-maintenance-fix-1003.md](nightly-maintenance-fix-1003.md)。
