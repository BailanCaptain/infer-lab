# 前置参考提炼稿 03：`wiki/params/enable-super-kernel-ce990e186bfa.md`（`enable_super_kernel`）

- **目标正式页**：[enable-super-kernel-ce990e186bfa.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/params/enable-super-kernel-ce990e186bfa.md)（`224` 行，`37` 条 `sources`，`SHA256 = c2cd68ecb004004228ef280b825812ef00c45cd656b76f4f754f17d18292a83d`）
- **历史编辑候选稿（仅吸收 `v0.30.0rc2` 增补锚点，不沿用旧四格模板锁死）**：[03-enable-super-kernel-ce990e186bfa.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/candidates/03-enable-super-kernel-ce990e186bfa.md)（`224` 行，`41` 条 `sources`，`SHA256 = 53b3a0b403a44a0adc9363e4a0208c3fddda2a849f473bbf541945be58cf48ba`；配套旧映射见 [03-enable-super-kernel-ce990e186bfa.mapping.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/candidates/03-enable-super-kernel-ce990e186bfa.mapping.md)）
- **流程角色**：任务 `558` 第三篇前置参考提炼（烁烁提炼 → 砚砚核检 → 墨墨短回合重写 → 烁烁 039 审讲法 + 砚砚 038 核事实）。**重要边界**：本提炼稿仅供重写导航与防丢核对，**不充当事实来源**；写手落笔时一切分支、默认值与行号必须回对固定一手 `sources`。

---

## 一、 读者带着什么问题来读这一页？

查配置参数页的读者通常正对着启动命令或报错日志，要立刻解开 **4 个具体问题**：
1. **它到底管哪一层？** 和 `enable_npugraph_ex`、`enable_static_kernel` 以及 `fuse_norm_quant` 这几个开关是什么关系，开了之后在编译和图捕获两步分别多做了什么？
2. **为什么我没写它，它却自己开了（或者我想只开 `static_kernel` 该怎么关掉它）？** 为什么看源码字段写着 `bool = False`，官方文档却写 `Default: Inherits enable_static_kernel`？
3. **为什么我明明写了 `true`，实际却没生效，或者直接启动报错/断言崩溃？**（典型踩坑：默认 piecewise 图模式把三级开关全关了、在 310P 上告警降级、在 `v0.23` / 旧标签 / GLM 固定镜像上被 `**kwargs` 静默吞掉、或在 `v0.26` 把布尔值写成字符串 `"false"` 反成真值触发 `assert`。）
4. **启动多花的几十分钟是谁的账？在固定 GLM 双机部署上能直接开吗？**

---

## 二、 保护区、锚点、配图与代码门禁边界（重写前必核）

1. **自动生成尾部逐字节保护（硬红线）**：
   - [review.ts:459-464](file:///C:/Users/-/Desktop/infra-view-new/scripts/wiki/review.ts#L459-L464) 对正式参数页校验 `lineageSection`（`## 版本谱系`，现 `L167-L176`）与 `protectedParamSection`（`## 参数定义（自动生成）`，现 `L178-L224`）未发生任何字节变化。
   - 当前工作区已由包 2 确定性同步刷新过该尾部（`L175` 已为 `releases/v0.26.0rc | 有 | 2ed6cbba`，`L196-L224` 已去重为 3 段约束块，`L187` 含 `[C30]` 指向第 `30` 条 `sources` 即 `7d825229c770...:vllm_ascend/ascend_config.py#L126`）。重写稿必须**原封不动保留 `L167-L224` 生成尾部**，并保持前 `37` 条 `sources` 顺序与下标不变（确保 `[C30]` 不错位）。
2. **Frontmatter、3D 与 2D 图边界**：
   - 保持 `id: enable-super-kernel-ce990e186bfa`、`title: enable_super_kernel`、`type: param`、`origin: seed`、`verified: [releases/v0.23.0, releases/v0.26.0rc, main]`、`evidence: C`、2 条 `relations`（`npugraph-ex`、`acl-graph`）与 11 条 `rawSources` 不变；建议保留旧候选末尾追加的第 `38–41` 条 `7d825229` 源码锚点（并可按需追加 `vllm-ascend@7d825229:vllm_ascend/compilation/acl_graph.py#L246-L252` 补齐 `v0.30.0rc2` 捕获后调用）。
   - 本页无 3D `wiki-scene`，也无既有 2D 图；依据 [wiki-writing-standard.md:60](file:///C:/Users/-/Desktop/infra-view-new/docs/wiki-writing-standard.md#L60)「概念、边界或参数页若靠清晰文字、对比表与源码对照即可讲清，不硬塞凑数流程图」，**不新增凑数 2D 图**。
3. **跨页入站 `#锚点` 扫描结果**：
   - 全库扫描 `wiki/**/*.{md,yaml}` 确认仅 [npugraph-ex.md:274](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/npugraph-ex.md#L274) 链接 `../params/enable-super-kernel-ce990e186bfa.md`（不带 `#anchor`），**全库零 `#锚点` 入站锁死**。
4. **反八股结构、角标归仓与 `lint.ts:196` 遗留门禁精确说明**：
   - 依 [wiki-writing-standard.md:29, 57, 62, 66](file:///C:/Users/-/Desktop/infra-view-new/docs/wiki-writing-standard.md#L57)：**严禁首句 `**v0.30.0rc2 对照：**` 劫持开篇**；不把旧稿 `一句话 / 事实表 / 为什么存在 / 开了的代价` 当必须冻结顺序的八股模板；教学主干用自然语言交代版本与硬件条件、**不散布 `[C#]/[S#]` 机器角标**（参数页允许在 `## 事实表` 保留紧凑标记，其余行号与版本源码索引统一收进 `## 对照源码`）。
   - **折叠区边界已核实**：[markdown.ts:387-428](file:///C:/Users/-/Desktop/infra-view-new/src/content/wiki/markdown.ts#L387-L428) `rehypeCollapsibleSourceSection` 从 `## 对照源码` 起仅折叠到下一个 `<h2>` 为止；因此把 `## 对照源码` 放在 `## 版本谱系` 之前，前端只会折叠 `## 对照源码`，不会吞掉后面的自动生成尾部（且 `params/` 不在 `standard-pages.json` 名单内，不触发“对照源码后无 H2”检查）。
   - **静态检查代码实情提示**：[scripts/wiki/lint.ts:196, 526-545](file:///C:/Users/-/Desktop/infra-view-new/scripts/wiki/lint.ts#L196) 仍残留早期 `REQUIRED_SECTIONS.param = ["一句话", "事实表", "为什么存在", "开了的代价"]` 阻塞检查（`concept`/`feature` 已置 `[]`），且 `factsTable()`（`lint.ts:250, 575-591`）要求 `## 事实表` 行数 `≤ 10`（`WARN_ONLY`）且表头不含「来源」列。建议在代码侧将 `lint.ts:196` `param` 同步放开为 `[]`（与写作标准一致）使正文标题完全按问题组织；若在 `lint.ts` 未改前先落候选，仍须彻底打破旧稿内部倒装顺序并清退教学段内机器角标。

---

## 三、 旧稿与旧候选稿诊断：哪些好内容必须保留，哪些地方必须重写

### 3.1 已经写得清楚、应吸收保留的好内容（不搞盲目推倒重来）
1. **`## 事实表` 的 9 行横向速查矩阵**（正式 `L118-L129` / 旧候选 `L120-L130`）：把是否存在、默认跟随、硬性依赖、只开 static 写法、键名拼错、字符串 `"false"` 反直觉陷阱、310P 硬件降级、图模式关闭分支、编译缓存 hash 压在一张 `9` 行表里，信息密度高且对比极强（旧候选补入 `v0.30.0rc2` 方向正确，但需避免与 `## 对照源码` 重复堆砌过多角标导致 `[C]` 占比超 `80%`）。
2. **`fuse_*` 局部算子融合 vs 三级编译捕获链的分工辨析**（正式 `L132-L135`）：一句划清 `fuse_norm_quant` / `fuse_qknorm_rope` / `fuse_muls_add`（局部子图替换）与 `npugraph_ex → static_kernel → super_kernel`（在静态算子之上额外提交 Super Kernel 优化选项与图捕获范围以利用范围内的 kernel 调度机会；实际 kernel 变化与性能收益须实测）的层次关系。
3. **“不写就跟随 `enable_static_kernel`”在两代配置框架下的源码反差解释**（正式 `L141`）：解释了为什么文档写 `Inherits enable_static_kernel` 而 `v0.30.0rc2`/`main` 字段静态定义写 `bool = False`（`v0.26` 用 `None` 哨兵，`v0.30.0rc2`/`main` 迁到 pydantic 后用 `mode="before"` validator 在缺省本键且传入 `enable_static_kernel` 时拷贝过去），帮读者彻底打通“看代码以为默认关、跑起来其实跟着开”的疑惑。
4. **补齐 `FULL_DECODE_ONLY` 的实用 `vllm serve` 命令示例**（正式 `L153-L157`）：在官方示例基础上补出 `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'`，防止读者照抄官方单行 `--additional-config` 却因默认 `FULL_AND_PIECEWISE` 被平台层静默关掉三级开关。

### 3.2 正式旧稿与旧候选稿仍存在的 5 处病灶（必须重组重写）
1. **开篇信息过载且先抛内部符号（旧候选虽去掉 `**v0.30.0rc2 对照：**` 抬头，却把它塞成 280 字长句）**：
   - 正式 `L110` 用 `**v0.30.0rc2 对照：**` 劫持第一句；旧候选 `L114` 把它并进首段后，读者还没弄懂“三级开关每一级干什么”，第一段就迎面砸来 `super_kernel_optimize=True`、`full_model`、`wrapper runnable`、`before validator`、`NPUGRAPH_EX` 和断言报错，紧接着第二段又砸 6 个 commit hash 与 rc 标签，初学者第一屏直接劝退。
2. **教学正文布满 `[C2][C28]`、`[C7][C33][C40]` 机器角标噪音**：
   - 旧候选不仅没清退教学段内的机器角标，反而把每处扩成三连标（全页 `37` 处标记已超 `MARK_FLOOD = 30` 阈值！）。必须按现行标准把教学段写成干净流畅的白话条件，机器角标只保留在紧凑 `## 事实表` 与文末 `## 对照源码`（全页总标记严控 `≤ 30` 且 `[C]` 占比 `< 80%`）。
3. **旧栏目名 `## 开了的代价` 文不对题、把四类不同问题混成一锅粥**：
   - 原 `## 开了的代价` 下既塞了“怎么配才不会被 piecewise 关掉”、又塞了“怎么显式写 `false` 关掉它”、还塞了“310P 不支持”和“GLM 双机镜像根本没有这个键”——这些是**生效前提、配置写法与版本/硬件支持边界**，根本不是“开启后的运行代价”；真正的代价与缓存影响只有启动编译耗时归属（static kernel 占几分钟到几十分钟 vs Super Kernel 额外增量需固定 static 单独测）和编译缓存 hash 变化。
4. **正式页 `L149` 残留裸文本补丁段**：`来源19（baa023ad graph_mode.md 184–186）的时间范围描述static kernel的启动编译...` 系后期生贴的审计备注，中英粘连且与 `L147` 复读，须无损融进成本辨析段。
5. **配置顺序倒置**：读者最需要的配置形式示例与“只想开 static、不想连带开 super 怎么写”被埋在第 153 行页尾，应前移到机制与配置章节。

---

## 四、 最顺的推荐讲解主线（按读者认知与排障顺序重排，不锁死旧模板）

1. **第一屏：它是什么、在三级开关里处于哪一层、为什么“没写也会跟着开”（开篇即答核心困惑）**
   - 先用两三句白话把三级阶梯立住：`ascend_compilation_config` 里的图编译优化分三级递进——`enable_npugraph_ex`（把计算图交给昇腾图编译器，默认开）→ `enable_static_kernel`（按固定解码批次形状预先编译静态算子二进制，默认关）→ **`enable_super_kernel`**（在静态算子之上，向编译与图捕获额外提交 Super Kernel 优化选项及优化范围 `scope`，供底层利用范围内的 kernel 调度机会；它只给出优化请求与范围，**不保证整张网最终只剩单个 kernel，实际 kernel 变化与收益须在设备上实测**）。顺手一句话点明它与 `fuse_norm_quant` / `fuse_qknorm_rope` / `fuse_muls_add`（局部几步算子替换，旧 `fuse_allreduce_rms` 自 `v0.25.1rc1` 已移除）分属不同层级。
   - 紧接点明最关键的使用直觉：**它是跟随式开关**——只开 `enable_static_kernel: true` 而不写 `enable_super_kernel` 时，它会自动跟着变成 `true`；且开启它硬性依赖 `enable_static_kernel`（后者又依赖 `enable_npugraph_ex`）。一句话交代清楚版本大盘：`v0.23` 与固定 GLM 双机镜像没有此键，`v0.26` 维护快照（不含早期 `v0.26.0rc1`/`v0.27.1rc1` 标签）、`v0.30.0rc2` 与 `main` 可用（具体标签与 commit 细节留给下表与源码区，不在第一屏堆哈希）。
2. **第二屏：`## 事实表`（四版本行为与踩坑一表扫清）**
   - 保留 9 行高价值对照表（列：`项 | v0.23（及 GLM 固定镜像） | v0.26 维护快照 | v0.30.0rc2 / main | 实际影响`），让读者 15 秒查清存在性、默认继承、只开 static 写法、键名拼错（`**kwargs` 静默吞 vs `extra="forbid"` 报错）、字符串 `"false"` 陷阱、硬件降级、图模式联动与缓存 hash（此处保留精炼紧凑的证据标记即可）。
3. **第三屏：两个生效时机与配置写法（配置形式示例、怎么只留 static 关掉它、为什么配了却没生效）**
   - **编译期 + 捕获期两步配合**：开启后，编译期在 `enable_static_kernel` 分支内向 `npugraph_ex` 追加 `super_kernel_optimize=True` 与 `{"dcci_after_kernel_end": [".*"]}`（若 static 没开根本进不去该分支，因此配置校验会直接抛 `AssertionError: Super kernel generation requires static kernel to be enabled.`）；ACL Graph 捕获期用 `super_kernel_scope("full_model", ...)` 包住 wrapper 的 `self.runnable`（关闭时直通、开启时调 `scope_begin/end`；名字虽叫 `full_model`，实际只覆盖该 wrapper 执行的 `runnable`，不代表覆盖服务全流程），录完图再调 `aclgraph.super_kernel_optimize(...)` 传入同一份 `dcci_after_kernel_end` 选项。
   - **给出配置形式示例并写清生效前提**：展示补出 `--compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}'` 的 `vllm serve` 配置形式示例（明确限定为**配置形式示例，实际可用仍需对应版本、模型图模式与支持 `NPUGRAPH_EX` 的硬件配合，本工作区无 NPU 实机执行验证**），同时讲透三道最常踩的“配了却不生效/报错”门槛：① 图模式门槛（`NONE`、不支持的图模式、以及需要 piecewise 编译的 `FULL_AND_PIECEWISE` 都会在平台层把三级开关全关掉，piecewise 分支还会先校验编译模式合法性；须按模型支持选择 `FULL` 或 `FULL_DECODE_ONLY`）；② 硬件能力门槛（310P 不支持 `npugraph_ex`，三级开关都会告警并关闭，且日志关键词从 `Ascend 310P` 变成了 `current hardware profile`）；③ JSON 布尔类型门槛（只想开 static、关 super 时必须写布尔 `false`，不能写字符串 `"false"`）。
4. **第四屏：启动耗时归属、编译缓存与固定 GLM 双机现状**
   - **把 static 和 super 的账算清**：官方文档提示启动捕获可能多花几分钟到几十分钟，这笔时间是 `static_kernel` 按形状编译算子二进制的成本，不能算成 `enable_super_kernel` 单独增加的开销；要测 Super Kernel 的真实增量，必须固定 `enable_static_kernel=true` 只切 `enable_super_kernel` 对比启动耗时、融合数与吞吐时延（当前无实机对照数）。
   - **编译缓存键**：`AscendCompiler` 把 `torch_npu_version` 与三级开关一起算进缓存 hash，切换布尔值会换缓存键（对应键若已有缓存仍可命中，不等于清空全部缓存或每次必付全量重编时间）。
   - **固定 GLM 双机边界**：`db701c1f` 镜像尚无此键，写进 JSON 只会被 `**kwargs` 静默忽略；即使升级到含该键的新版本，仍需逐项验证 GLM 专用补丁、量化、runner、CANN/`torch_npu`、图模式与算子兼容性，不能把教程里的 `FULL_DECODE_ONLY` 字面配置当成升级后已兼容证明，也不能拿主线局部算子融合数充当 Super Kernel 收益。
5. **第五屏：默认折叠 `## 对照源码` + 原封保护的自动生成尾部（`## 版本谱系`、`## 参数定义（自动生成）`）**
   - 在 `## 对照源码` 集中收纳：维护分支 vs 发布标签精确核验链（`2c59ff10`、`db701c1f`、`f2f74a16`、`3b318862`、`2ed6cbba` PR #15074、`baa023ad` PR #15059、`v0.28.0.rc1`、`7d825229` 及演进提交 `39fef3f8`/`4d1412d1`/`9f9da556`/`75bfb762`/`2581a69b`/`01741ac9`）、两代默认跟随源码机制（`None` 哨兵 vs `mode="before"` validator 与官方文档 `Inherits enable_static_kernel` 对照）、编译/捕获/平台降级/缓存 hash 四版本源码行号与 `**待核**` 项；紧接逐字节未改动的 `## 版本谱系` 与 `## 参数定义（自动生成）`。

---

## 五、 各版本默认值、继承、校验、设备与图编译条件的一手事实清单（零遗漏三出口核对表）

重写稿必须 100% 保留以下原子事实与成立条件（本轮正文重排属 `editorial`，无捏造 `supersede` 旧错；若写手或审阅发现新源码反证再按实启用 `supersede.claims`）：

| 维度 | `v0.23`（`2c59ff10`）与 GLM 镜像（`db701c1f`） | `v0.26` 维护快照（`2ed6cbba`，PR #15074） | `v0.30.0rc2`（`7d825229`）与 `main`（`baa023ad`，PR #15059） | 必保边界与固定一手 `sources` 引用 |
|---|---|---|---|---|
| **字段与发布标签存在性** | **不存在**（`AscendCompilationConfig.__init__` 仅含 `enable_npugraph_ex`、`enable_static_kernel`、`fuse_norm_quant`、`fuse_qknorm_rope`、`fuse_allreduce_rms` 及 `**kwargs`；传入本键被 `**kwargs` 静默吞掉） | 维护快照 `2ed6cbba` **有**；但早期发布标签 `v0.26.0rc1`（`f2f74a16`）与 `v0.27.1rc1`（`3b318862`）**均无**，主线实现自 `v0.28.0.rc1` 可见 | **有**（`enable_super_kernel: bool = False`） | 严禁按“版本号 ≥ v0.26”或线上 v0.26 文档反推早期 rc 标签已支持。<br>来源：`[C17]` `2c59ff10:ascend_config.py#L607-L614`、`[C18]` `#L640-L659`、`[C23]` `db701c1f:ascend_config.py#L588-L596`、`[C31]` `f2f74a16:ascend_config.py#L590-L647`、`[C32]` `3b318862:ascend_config.py#L59-L90`、演进链 `sources` `21,22,24–26,37` |
| **默认值与跟随继承链** | — | 签名 `enable_super_kernel: bool \| None = None`；进入 `__init__` 首步执行 `if enable_super_kernel is None: enable_super_kernel = enable_static_kernel` | 静态字段默认 `False`；`@model_validator(mode="before")` `_default_super_kernel_to_static_kernel` 在 `ArgsKwargs` 或 `dict` 缺省 `'enable_super_kernel'` 且含 `'enable_static_kernel'` 时将后者赋给前者 | 两版外部净效果一致（省略即跟随 `enable_static_kernel`）；官方文档 Default 栏写 `Inherits enable_static_kernel`，单抄静态字段 `False` 会漏掉实际生效链。<br>来源：`[C1]`/`[C2]` `baa023ad:ascend_config.py#L113-L134`、`[C28]`/`[C30]` `7d825229:ascend_config.py#L123-L145`、`[C14]` `2ed6cbba:ascend_config.py#L599-L638`、`[S11]` `baa023ad:additional_config.md#L108-L112`、`[S15]` `2ed6cbba:additional_config.md#L124`、单测 `[C36]` `baa023ad:tests/ut/test_ascend_config.py#L937-L956` |
| **未知键与字符串 `"false"` 校验差异** | 键名拼错或传本键均落入 `**kwargs` 静默忽略 | 键名拼错落入 `**kwargs` 静默忽略；值写成字符串 `"false"` 无类型转换，Python 非空字符串判真，若未开 static 会直接撞上 `assert` | `@config` 装饰器默认 `ConfigDict(extra="forbid")`，键名拼错直接校验报错；字符串 `"false"` 经 pydantic 宽松布尔解析为 `False`；只开 static 统一推荐写 JSON 布尔 `false` | 同一份写 `"false"` 的配置在 `v0.26` 与 `v0.30.0rc2`/`main` 结论完全相反；另旧 `fuse_allreduce_rms` 自 `v0.25.1rc1` 移除，在 `extra="forbid"` 版本传入会报错。<br>来源：`[C9]` `baa023ad:config_utils.py#L43-L48`、`[C38]` `7d825229:config_utils.py#L43-L50`、`[C14]`、`[S13]` `baa023ad:graph_mode.md#L271-L276` |
| **设备硬件画像降级与三级硬依赖断言** | `is_310p()` 告警并关闭 `enable_npugraph_ex`、`enable_static_kernel`；随后检查 `assert self.enable_npugraph_ex` | `is_310p()` 依次对开启的 `npugraph_ex`/`static`/`super` 打含 `Ascend 310P` 的 warning 并全部置 `False`；降级后校验 `if self.enable_static_kernel: assert self.enable_npugraph_ex` 与 `if self.enable_super_kernel: assert self.enable_static_kernel` | `@model_validator(mode="after")` 查 `get_current_hardware_profile().supports(HardwareCapability.NPUGRAPH_EX)`（310P profile 的 `capabilities` 不含该项），不支持时对开启项打含 `current hardware profile` 的 warning 并把三级全置 `False`；降级后执行相同两条 `assert` | 两条断言原文两版一字不差：`Static kernel generation requires npugraph_ex to be enabled.` 与 `Super kernel generation requires static kernel to be enabled.`；查日志不能只搜 `310P`。<br>来源：`[C3]` `baa023ad:ascend_config.py#L136-L160`、`[C10]` `baa023ad:hardware_profile.py#L287-L308`、`[C28]` `7d825229:ascend_config.py#L147-L170`、`[C39]` `7d825229:hardware_profile.py#L315-L337`、`[C14]` |
| **图模式（`cudagraph_mode`）平台层联动** | — | `cudagraph_mode == NONE`、需 piecewise 编译（含 `FULL_AND_PIECEWISE`；`2ed6cbba` 在写回前**无条件校验** `assert compilation_config.mode == CompilationMode.VLLM_COMPILE`，无环境变量豁免）或不支持的 NPU 图模式时，平台层将三级开关全部置 `False`（同时写回 `ascend_config.ascend_compilation_config` 与 `additional_config["ascend_compilation_config"]`）；仅 `has_full_cudagraphs()`（如 `FULL`、`FULL_DECODE_ONLY`）保留并清空 `splitting_ops = []` | **最终关闭三级开关的分支结论相同，但 piecewise 前置断言条件不同**：`7d825229` 与 `baa023ad` 改为 `if compilation_config.mode != CompilationMode.VLLM_COMPILE and not envs_vllm.VLLM_USE_BREAKABLE_CUDAGRAPH: raise AssertionError(...)`（新增 `VLLM_USE_BREAKABLE_CUDAGRAPH` 豁免） | 仅把 `enable_super_kernel` 设为 `true` 不够，未配 `FULL` / `FULL_DECODE_ONLY` 落入 piecewise 分支会被平台层关闭，且必须区分 `v0.26` 无条件断言与 `v0.30.0rc2`/`main` 的 `VLLM_USE_BREAKABLE_CUDAGRAPH` 豁免差异。<br>来源：`[C33]` `2ed6cbba:platform.py#L545-L605`（断言在 `#L557-L564`）、`[C7]` `baa023ad:platform.py#L1188-L1229`（断言在 `#L1193-L1201`）、`[C40]` `7d825229:platform.py#L1305-L1343`（断言在 `#L1310-L1318`） |
| **编译期、捕获期双生效点与缓存键、耗时边界** | — | 编译期与捕获期选项、缓存 hash 因子同右 | ① 编译期：`compiler_interface.py` 在 `if enable_static_kernel:` 内嵌 `if enable_super_kernel:` 写入 `options["super_kernel_optimize"] = True` 与 `{"dcci_after_kernel_end": [".*"]}`；<br>② 捕获期：`acl_graph.py` 用 `super_kernel_scope("full_model", self.enable_super_kernel)`（`utils.py` 关闭直通、开启调 `torch.npu.super_kernel_scope_begin/end`）包裹 `self.runnable`，图录完后调 `aclgraph.super_kernel_optimize(optimize_options={"dcci_after_kernel_end": [".*"]})`；<br>③ 缓存键：`AscendCompiler.compute_hash` 对 `{torch_npu_version, enable_npugraph_ex, enable_static_kernel, enable_super_kernel}` 取 SHA-256 前 10 位 | `full_model` 仅代表 wrapper `runnable` 范围，不保证整网合为单一 kernel 或覆盖全部服务步骤；`graph_mode.md#L184-L186` “几分钟到几十分钟”系 `static_kernel` 启动编译耗时提示，非 Super Kernel 独占增量；切换开关改变缓存键但不清空旧键缓存。<br>来源：`[C4]`/`[C8]` `baa023ad:compiler_interface.py#L122-L135, #L245-L255`、`[C5]` `baa023ad:utils.py#L1054-L1064`、`[C6]`/`[C20]`/`[C35]` `baa023ad:acl_graph.py#L66-L111, #L210-L213, #L246-L252`、`[C29]` `7d825229:acl_graph.py#L202-L217`（可补 `#L246-L252`）、`[C34]` `2ed6cbba:compiler_interface.py#L244-L255`、`[C41]` `7d825229:compiler_interface.py#L241-L255`、`[S19]` `baa023ad:graph_mode.md#L184-L186` |

---

## 六、 重写后双审验收标尺

1. **`039`（烁烁对照旧稿审讲法）必核**：首屏是否一眼立住三级递进与跟随行为（无 `**v0.30.0rc2 对照：**` 首句劫持、无首段符号与 commit 轰炸）；教学正文是否清退 `[C#]/[S#]` 角标噪音（仅 `## 事实表` 与 `## 对照源码` 保留紧凑标记，全页总标记 `≤ 30` 且 `[C] < 80%`）；是否打破“把配置前提和关闭写法全塞进 `开了的代价`”的错位结构并清理 `L149` 裸补丁段；`## 对照源码` 默认折叠是否未吞掉自动生成尾部。
2. **`038`（砚砚独立核源码与门禁）必核**：上表六大维度四版本事实与条件零遗漏；`L167-L224` 自动生成尾部与刷新后 `base` 逐字节一致、前 `37` 条 `sources` 下标不变（`[C30]` 准确对应 `sources[29]`）；若保留或放开 `lint.ts:196` `REQUIRED_SECTIONS.param`，`pnpm wiki:lint` 与 `pnpm wiki:audit` 全绿通过。
