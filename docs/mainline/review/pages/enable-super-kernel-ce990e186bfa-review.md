# enable-super-kernel-ce990e186bfa 审查记录

## P5 写作记录（2026-10-02，第 28 批小修）

**旧版信息清单（小修，短版）。** `git show p4-checkpoint:wiki/params/enable-super-kernel-ce990e186bfa.md` 的正文与改前现版逐行相同，等于这一页从 p4 起没被动过，不存在旧版结论丢失的风险。旧版六条结论逐条核对，全部保留，没有删改：

1. 它是第三级开关，编译期多传 `super_kernel_optimize=True`、捕获期把整网框进 `full_model` scope —— 保留（一句话节）。
2. 跟随式默认：不写就取 `enable_static_kernel`；开了必须静态内核也开，否则 `assert` 失败 —— 保留，并补上 assert 的原话。
3. v0.23 维护分支没有这个键，v0.26 / main 有；v0.27.1rc 因分支时点错过 —— 保留（一句话节 + 版本谱系）。
4. 事实表九行（键名拼错、字符串 `"false"` 两版结论相反、310P 降级、图模式写回、进编译缓存 hash）—— 保留，未改动。
5. 为什么存在：编译期与捕获期两条路都只看这一个布尔值；两版实现「跟随」的手法不同（`None` 哨兵 vs before-validator）—— 保留。
6. 代价四条（默认图模式先关掉它、顺带接受静态内核的重编、关它要显式写 false、改一次作废编译缓存）—— 保留。

**本轮改了四处（只改任务文件写明的问题，4 段式结构与节名未动，本页没有图，无图可改）。**

1. **只解释自身开关。** 「为什么存在」开头加一段划界：四条 `fuse_*` 是算子级规则，这个键是整网级 scope 融合，两层各有开关；四条分别合什么、各自条件一句话带过并链到 [npugraph_ex](../../../../wiki/concepts/npugraph-ex.md) 的「怎么找出能合的一段，又怎么替换」锚点，与那一页刚定的规则清单口径一致（含 `fuse_allreduce_rms` 的编译区间起点 > 512 token 条件），本页不重讲。
2. **补 ops-and-kernels 依赖。** 一句话节里 kernel 这个词首次出现处链到 `wiki/concepts/ops-and-kernels.md`。
3. **报错原文逐字。** 旧版把 310P 的 warning 写成省略号形式 `super kernel requires static kernel ... Disabling it.`，现在按源码逐字写出，并指明两版措辞不同：v0.26 是 `... which is not supported on Ascend 310P. Disabling it.`（`vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L644-L650`），main 是 `... which is not supported by the current hardware profile. Disabling it.`（`baa023ad:vllm_ascend/ascend_config.py#L148-L155`），按 310P 去 grep 日志在 main 上搜不到。另补 assert 原话 `Super kernel generation requires static kernel to be enabled.`，两版一字不差（`2ed6cbba:#L660-L661`、`baa023ad:#L158-L159`）。
4. **GLM 双机按源码写，不虚构收益。** 新增一段：GLM 代码所在的 `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L588-L596` 的 `AscendCompilationConfig.__init__` 形参只有 `enable_npugraph_ex`、`enable_static_kernel` 和三个 `fuse_*`（含 `fuse_allreduce_rms`，默认 `False`），没有 `enable_super_kernel`，写进 `--additional-config` 会被 `**kwargs` 收走；要谈开它只能在 v0.26 / main 代码线上，那时图模式这道前提是满足的（双机命令 `cudagraph_mode=FULL_DECODE_ONLY`，链到 `glm-5-3-flash-two-node.md#部署前提`，不在平台层写回 `False` 的 `NONE` / 需要 piecewise 两种情形里），挡在前面的只剩静态内核一级。明确写出**待核**：缺 GLM 双机上开 static + super kernel 的启动捕获耗时、融出段数、TPOT 实测；并写明 02 §3.4（W8A8 稠密 MLP 链路）、§6.6（MoE 融合算子）那些算子级数字不是这个键的收益，不许挪用。

**核实到的源码（版本口径按派发说明）。** v0.26 = `2ed6cbba`：`enable_npugraph_ex` 默认 `True`、`enable_static_kernel` 默认 `False`、`enable_super_kernel` 默认 `None` 取前者（`#L599-L607`、`#L634-L635`）；310P 三条 warning 与三个开关一起置假（`#L637-L650`）；两条 assert（`#L658-L661`）。main = `baa023ad`：字段 `enable_super_kernel: bool = False` + before-validator 抄 `enable_static_kernel`（`#L115-L133`）、硬件档降级与同样两条 assert（`#L140-L159`）。GLM 线 = `db701c1f`（`#L588-L596`）。

**sources 变化。** 追加第 23 条 `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L588-L596`，正文用 `[C23]` 指它；为压住 mark-flood（上限 30）把 310P 段里一处重复的 `[C14]` 去掉，同段前文仍有该来源。`updated` 改为 2026-10-02。

**验证。** `pnpm wiki:lint` 通过（本页 0 报错 0 警告；全库另有 5 处既有警告，均为别页）；`pnpm wiki:diagrams --check` 290 张图一致；`pnpm wiki:audit` 本页来源与行号校验通过（23 条来源）。正文 10781 → 12088 字。

**疑点。** 无 P1。P3 一条：事实表里「值写成字符串 `"false"` 在 v0.26 为真」是旧版的 `[D]` 推导（Python 非空串为真，且 `__init__` 不做类型转换），本轮没有加跑验证，仍按推导标记，未升级成结论。

## P5 审查（10-02）

**结论：8.5 / 10。P1 0 条，P2 1 条，P3 3 条。`pnpm wiki:audit` 本页通过。**

### 四段式与小修范围
节序仍是 一句话 / 事实表 / 为什么存在 / 开了的代价 + 自动生成的版本谱系、参数定义，没有新增节、没有新增图（本页本来无图）。`git diff` 只删 4 行（`updated`、一句话段、编译期那条、310P 段），加 9 行，全部落在任务文件写明的四项上，没有顺手扩张。

### 重点核一：310P warning 与 assert 原文
- v0.26（`2ed6cbba:vllm_ascend/ascend_config.py`）：`#L646` 的 warning 与页面 L122 引的一字不差（`... which is not supported on Ascend 310P. Disabling it.`）；`#L661` 的 assert 与页面 L100 引的一字不差。
- main（`baa023ad:vllm_ascend/ascend_config.py`）：warning 在 `#L150-L151` 由两个字符串字面量拼成，拼起来等于页面写的那句（`... by the current hardware profile. Disabling it.`）；assert 在 `#L159`，与 v0.26 确实完全相同。
- 「照 310P 去 grep 日志在 main 上搜不到」成立：main 的判据换成 `get_current_hardware_profile().supports(HardwareCapability.NPUGRAPH_EX)`（`#L140`），措辞里没有 310P。
- 结论：这一项逐字核过，无问题。

### 重点核二：GLM 代码线无此键、被 `**kwargs` 吞掉
`db701c1f:vllm_ascend/ascend_config.py#L588-L596` 的 `AscendCompilationConfig.__init__` 形参为 `enable_npugraph_ex` / `enable_static_kernel` / 三个 `fuse_*` + `**kwargs`，确无 `enable_super_kernel`；对该提交全树 `git grep super_kernel` 只在 `csrc/cmake/scripts/util/` 两个构建脚本里命中，配置链路上没有。页面 L124 的说法成立，且没有给 GLM 上开它编任何收益数字，改为明确「待核」（启动捕获耗时 / 融出段数 / TPOT 都标未测），并点名 02 §3.4、§6.6 的算子级数字不得挪用——`docs/mainline/02-forward.md#L233`（3.4 W8A8 在这里的算子）、`#L699`（6.6 专家计算：W8A8 用的是哪些算子）两节确实存在且正是算子级内容。不虚构收益这条通过。
配套核过：双机确实用 `cudagraph_mode=FULL_DECODE_ONLY`（`wiki/concepts/glm-5-3-flash-two-node.md#L85`、`#L308`，`docs/mainline/01-deploy-entry-schedule.md#L247`）；平台层三处写回在 `2ed6cbba:vllm_ascend/platform.py#L553/#L586/#L602`，`FULL_DECODE_ONLY` 落在 `has_full_cudagraphs()` 那条只清 `splitting_ops` 的分支，不被置假，所以「挡在前面只剩静态内核一级」成立。

### 重点核三：与 npugraph-ex 的融合规则分界
L94 新加的划界只做两件事：说清四条 `fuse_*` 是算子级、这个键是整网级 scope，然后把「四条分别合什么、各自条件」整体链到 `wiki/concepts/npugraph-ex.md#怎么找出能合的一段又怎么替换`。那一页确有四条规则表（`#L126` 行含 All-Reduce 接归一化的「编译区间起点超过 512 个 token」）与 `#L243` 的 pattern 出处清单，口径一致。本页**没有**重复讲任何一条 pattern 或门槛，不记 P2 重讲。锚点可解析（`pnpm wiki:lint` 的跨页锚点硬校验通过）。

### P2
1. **L76「两个 fuse 项」与源码不符（少算一个），且与 L124 自相矛盾。** `2c59ff10:vllm_ascend/ascend_config.py` 的 `__init__` 形参是 `enable_npugraph_ex`(L609)、`enable_static_kernel`(L610)、`fuse_norm_quant`(L611)、`fuse_qknorm_rope`(L612)、`fuse_allreduce_rms`(L613)、`**kwargs`(L614)——是**三个** fuse 项；页面引的来源范围 `#L607-L612` 正好在第三个之前截断。后果：读者把 L76（v0.23 维护分支「两个」）和 L124（GLM 线 db701c1f「三个」）一对照，会以为同是 v0.23 这条线的两次提交在 fuse 项上有差别，其实两边都是三个。改法：L76 改成「三个 fuse 项」，并把该条来源行号延到 `#L607-L614`（或 `#L609-L614`），改完跑 `pnpm wiki:audit`。

### P3
1. **旧版信息清单没放在约定位置。** 未找到 `scratchpad\p5\enable-super-kernel-ce990e186bfa-facts.md`（本会话与历史会话 scratchpad 全盘 `*facts*` 查过），清单被写进本 review 文件的写作记录里。未升级为 P1 的理由：我用 `git diff p4-checkpoint -- wiki/params/enable-super-kernel-ce990e186bfa.md` 独立核过，整页相对 p4 只有 9 增 4 删，六条旧结论在现版逐条可见（三级开关与 `full_model` scope L74；跟随式默认与 assert L74/L84/L100；存在范围与 v0.27.1rc 漏网 L76；事实表九行 L82-L90；两条路与两版手法 L98-L103；代价四条 L107/L109/L111/L120 加 310P L122），丢信息风险为零。
2. **「图模式把它关掉」漏了第三种情形。** L107 只说 `cudagraph_mode` 为 `NONE` 或 `requires_piecewise_compilation()` 为真，但 `2ed6cbba:vllm_ascend/platform.py#L596-L605` 还有一条「mode 在 NPU 上不支持 → 回落 NONE」同样把三个键写回 `False`（页面自己说「三处分支各写一遍」，与此对得上，只是前半句只列了两种）。一句话补上即可，不影响任何结论。
3. **事实表「字符串 `"false"` 在 v0.26 为真」仍是推导。** 同意写手自报：`2ed6cbba` 的 `__init__` 对该形参是直接赋值（`#L656`），没有任何类型转换，Python 非空串为真，推导站得住；页面已标 `[D]` 未升级成结论，保持原样即可。

### 未做到的部分
浏览器实测**未做**：5193 上没有监听（`netstat` 无该端口，Playwright 取到 `ERR_CONNECTION_REFUSED`），按派发要求不起停服务，故本页没有截图证据。本页无图，影响有限，但首屏观感未经读者视角验证。
`pnpm wiki:lint` 全库通过（5 处 mark-flood 警告都在别页）；`pnpm wiki:audit` 139 页 3568 条来源，行号越界 0、无效 commit 0。

### 补记（审第二页时发现，属本页 P2，总分改为 8 / 10：P1 0 条、P2 2 条、P3 3 条）
**L94 新加的划界段把 `fuse_allreduce_rms` 算进「四条 `fuse_*`」，但在本键存在的那两条代码线上它已经被删掉了。** 核过：`2ed6cbba:vllm_ascend/ascend_config.py` 的 fuse 形参只有 `fuse_norm_quant`(#L604)、`fuse_qknorm_rope`(#L605)，加上从额外关键字读的 `fuse_muls_add`(#L657)，共三条；`2ed6cbba:vllm_ascend/compilation/passes/` 下没有 `allreduce_rmsnorm_fusion_pass.py`（`db701c1f` 有）；`baa023ad` 同样查不到 `fuse_allreduce_rms`。本站 `wiki/concepts/npugraph-ex.md` 的版本差异表（「`passes/` 里的融合规则」那一行）正是写「v0.26 没有 All-Reduce 接归一化那一条、main 也没有」，`wiki/params/fuse-allreduce-rms.md` 更专门讲它在 v0.26 会被 `**kwargs` 静默吞掉。所以本页这一句与同库两页冲突，读者按它去 v0.26 上配 `fuse_allreduce_rms` 会什么提示都没有地失效。改法：把该句的清单改成这条代码线上真有的三条（`fuse_norm_quant`、`fuse_qknorm_rope`、`fuse_muls_add`），并加一句限定：第四条 `fuse_allreduce_rms` 只在 v0.23 这条线上有，v0.25.1rc 起已删（链 `fuse-allreduce-rms.md`）。按 CLAUDE.md，P2 需在本轮处理。

## P5 修订记录（10-02，按上面的审查逐条处理）

**P2-1（补记那条）：「四条 `fuse_*`」按版本改正。** 核过三条线的源码：`2c59ff10:vllm_ascend/ascend_config.py#L607-L614` 的 `__init__` 里 fuse 形参是 `fuse_norm_quant`(#L611)、`fuse_qknorm_rope`(#L612)、`fuse_allreduce_rms`(#L613)；`2ed6cbba` 只有 `fuse_norm_quant`(#L604)、`fuse_qknorm_rope`(#L605)，加上 `self.fuse_muls_add = kwargs.get("fuse_muls_add", True)`(#L657)；`baa023ad:#L116-L118` 是 `fuse_norm_quant` / `fuse_qknorm_rope` / `fuse_muls_add` 三个字段，默认都为真，全树查不到 `fuse_allreduce_rms`。所以划界段不再写「四条」，改成：这个键存在的两条线上只有三条（v0.26 的两个形参 + 从额外关键字读的 `fuse_muls_add`，main 是三个同名字段），第四条 `fuse_allreduce_rms` 只在 v0.23 这条线上有、v0.25.1rc 起连开关带 pass 一起删了，并链到 `fuse-allreduce-rms.md`。

**npugraph-ex 没有改，理由有源码证据。** 它讲的是钉住的 v0.23 源码（`db701c1f` 下四条规则确实都在，`graph_fusion_pass_manager.py#L64` 还按原始 dict 缺省 `True` 读 `fuse_allreduce_rms`），而版本差异表「`passes/` 里的融合规则」那一行已经写明 v0.26 与 main 都没有 All-Reduce 接归一化这一条（`wiki/concepts/npugraph-ex.md#L229`）。口径打架的是本页旧句把三条线混成一张清单，不是那一页的规则清单，故未动它，也不必重跑它的 audit 结论（全站 audit 仍通过）。

**P2-2：「两个 fuse 项」改为三个。** 正文照 `2c59ff10:#L611-L613` 列出三个名字，并把该条来源的行号从 `#L607-L612` 延到 `#L607-L614`（原范围正好在第三个形参前截断，这是漏数的来源）；`pnpm wiki:audit` 的行号校验通过。

**P3-2：补上第三种被写回 `False` 的情形。** `2ed6cbba:vllm_ascend/platform.py#L594-L605` 的 else 分支在「给的 `cudagraph_mode` 在 NPU 上不支持」时打一条 info、把模式回落成 `NONE`，同样把三个键写回假（还顺手写回 `additional_config` 里的同名键）。正文那句由「两种情形」改成三种，与后半句「三处分支各写一遍」对齐。

**P3-1：旧版信息清单补到约定位置。** 已写入 `scratchpad\p5\enable-super-kernel-ce990e186bfa-facts.md`（八条旧结论 + 新版位置 + 处理），本 review 里的写作记录保留作索引。

**P3-3（字符串 `"false"` 仍是 `[D]`）：按审查意见不改**，保持 `[D]`。

**顺带的格式处理。** 新增一处 `[C14]` 后内联标记到 31 处、超过 lint 的 30，故把事实表「硬性依赖」行里重复的「同 [C3]」改成「同左」（同一条 assert 在正文已标两次），回到 30 处。

**验证。** 本页 `pnpm wiki:lint` 0 报错 0 警告；`pnpm wiki:diagrams --check` 290 张图一致（本页无图）；`pnpm wiki:audit` 本页通过（来源 23 条，含改过行号的那一条）。正文 12088 → 12412 字。**全站 lint 当前有 2 处报错，都在别的写手正在改的 `params/prefetch-ratio.md`（`mark-unnumbered`：两处 `[C]` 没带来源编号），不在我的范围，未动。**
