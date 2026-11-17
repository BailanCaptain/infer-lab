# 样板 3：`wiki/params/enable-super-kernel-ce990e186bfa.md` 旧事实与教学改进清单

- **目标文件**：[`wiki/params/enable-super-kernel-ce990e186bfa.md`](../../../wiki/params/enable-super-kernel-ce990e186bfa.md)（原 235 行，自动生成区刷新后当前工作区 224 行，`id: enable-super-kernel-ce990e186bfa`，`type: param`）
- **拟采用修订流程与类型**：
  1. **前置第 1 步（包 2 确定性生成区刷新，工作区已落盘、待 `041` 代码核验）**：当前正文 `L114`、`L120` 已正确写出固定 `v0.26` 维护快照 `2ed6cbba` 存在 `enable_super_kernel`（位于 `AscendCompilationConfig.__init__` 签名，`vllm_ascend/ascend_config.py#L599-L661`），此前出错的是受 `scripts/wiki/review.ts:459-464` 保护的自动生成区 `## 版本谱系`（原 `L175` 误标 `releases/v0.26.0rc | 无 | 2ed6cbba`）以及 `## 参数定义（自动生成）`（原 `L196-L222` 重复倾倒父子 4 段 `If` AST 片段）。包 2 修复 `scripts/wiki/params/scan.py`（识别 `__init__` 签名参数并去重嵌套约束块）并通过官方确定性同步入口刷新后，当前工作区 `L167-L224` 已更新为 `L175: | releases/v0.26.0rc | 有 | 2ed6cbba |` 且 `L196-L224` 去重为 3 段独立约束块（待 `041` 代码核验通过），**绝不拆除生成区保护，也不把生成区缺陷伪造成正文 `supersede.claims` 旧错**；
  2. **第 2 步（包 3 正文修订提案，基于刷新后的新 `base`）**：本轮清单对正文区（`L108-L165`）未提出需 `supersede.claims` 的正文纠错（不人为捏造正文旧错），拟采用 **`editorial`** 消除 `L110` 首句 `**v0.30.0rc2 对照：**` 劫持、归并 `L149` 裸“来源19”补丁段、扩充 `## 事实表` 纳入 `v0.30.0rc2` 对照，并保持稳定主键 `id: enable-super-kernel-ce990e186bfa` 与 `verified` 列表不变；若后续独立检视或源码核对发现新反证，则按实改判并启用 `supersede.claims` 有证更正，不以保真要求固化未核实旧错。

---

## 一、 现有 `sources`（37 条，L31-L83）与 `rawSources`（11 条，L84-L106）核对

| 编号（1-based） | `sources` 引用条目 | 覆盖的核心机制与版本 | 去向分类 |
|---|---|---|---|
| 来源 1–3 (`L32-L35`) | `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py` (`#L115`, `#L113-L134`, `#L136-L160`) | `main` 字段 `enable_super_kernel: bool = False`、`[C2]` `mode="before"` validator 省略时跟随 `enable_static_kernel`、`[C3]` 硬件降级与 `assert self.enable_static_kernel` (`Super kernel generation requires static kernel to be enabled.`) | **保留** |
| 来源 4–8 (`L36-L40`) | `vllm-ascend@baa023ad` (`compiler_interface.py#L122-L135, #L245-L255`, `utils.py#L1054-L1064`, `acl_graph.py#L246-L252`, `platform.py#L1188-L1229`) | `[C4]` 编译期塞 `super_kernel_optimize=True` 与 `dcci_after_kernel_end`、`[C5]` `super_kernel_scope` 上下文管理器、`[C6]` 捕获期调 `aclgraph.super_kernel_optimize(...)`、`[C7]` `NONE`/piecewise 关闭三级开关、`[C8]` 编译缓存 hash | **保留** |
| 来源 9–13, 19–20 (`L41-L48, L56-L58`) | `vllm-ascend@baa023ad` (`config_utils.py#L43-L48`, `hardware_profile.py#L287-L308`, `additional_config.md#L108-L112`, 线上 docs, `graph_mode.md#L271-L276, #L184-L186`, `acl_graph.py#L210-L213`) | `[C9]` `@config` `extra="forbid"`、`[C10]` `HardwareCapability.NPUGRAPH_EX`（310P 不支持）、`[S11]` 文档 `Default: Inherits enable_static_kernel`、`[S13]` JSON 配置示例、`[S19]` static kernel 启动编译耗时提示（几分钟到几十分钟）、`[C20]` `super_kernel_scope("full_model", ...)` 包裹 `self.runnable` | **保留** |
| 来源 14–16, 33–34 (`L49-L53, L78-L79`) | `vllm-ascend@2ed6cbba` (`ascend_config.py#L599-L661`, `additional_config.md#L124`, 线上 v0.26rc1 docs, `platform.py#L545-L605`, `compiler_interface.py#L244-L255`) | `[C14]` `v0.26` 维护快照 `2ed6cbba` 中 `__init__` 默认 `None` 跟随 `enable_static_kernel`、`is_310p()` 降级与 `Ascend 310P` 告警、`[S15]` v0.26 文档表、`[C33][C34]` v0.26 平台关闭分支与编译缓存 hash | **保留** |
| 来源 17–18, 23 (`L54-L55, L63`) | `vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L607-L614, #L640-L659`, `vllm-ascend@db701c1f:.../ascend_config.py#L588-L596` | `[C17][C23]` `v0.23` 维护分支与 GLM 固定镜像 `db701c1f` 无此键，传入时被 `__init__` 的 `**kwargs` 静默吞掉 | **保留** |
| 来源 21–22, 24–27, 37 (`L59-L62, L64-L71, L82-L83`) | `vllm-ascend@{39fef3f8,4d1412d1,9f9da556,75bfb762,2581a69b,01741ac9}:vllm_ascend/ascend_config.py`, `raw:sha256-42c8fbc3...` | 主线演进提交锚点与原始资料切片 | **保留** |
| 来源 28–30 (`L72-L75`) | `vllm-ascend@7d825229` (`ascend_config.py#L123-L170, #L126`, `acl_graph.py#L202-L217`) | `[C30]` `v0.30.0rc2` 字段定义 `bool = False`、before-validator 跟随、三级依赖与硬件能力降级 | **保留** |
| 来源 31–32, 35–36 (`L76-L77, L80-L81`) | `vllm-ascend@f2f74a16:.../ascend_config.py#L590-L647`, `vllm-ascend@3b318862:.../ascend_config.py#L59-L90`, `vllm-ascend@baa023ad` (`acl_graph.py#L66-L111`, `test_ascend_config.py#L937-L956`) | `[C31][C32]` 最初标签 `v0.26.0rc1` (`f2f74a16`) 与 `v0.27.1rc1` (`3b318862`) 无该键，维护快照 `2ed6cbba` 含 PR #15074、main 含 PR #15059、`v0.28.0.rc1` 可见；`[C35]` wrapper runnable 范围与单测 | **保留** |

---

## 二、 逐段旧事实与版本/硬件限定条件三出口核对表

| 原文位置 | 原子事实与版本/硬件限定条件摘要 | 关联来源 / 标记 | 出口分类 | 新稿承接位置与说明 |
|---|---|---|---|---|
| `L110` | `v0.30.0rc2` 对照说明：`ascend_compilation_config` 中静态默认仍为 `False`，若输入含 `enable_static_kernel` 而省略本键，before validator 令本键跟随前者；`super kernel → static kernel → npugraph_ex` 三级依赖，硬件画像不支持 `NPUGRAPH_EX` 时三者均告警关闭 | `[C30]`、来源 28–29 | **保留** | 从 `L110` 首句移出，取消 `**v0.30.0rc2 对照：**` 首句劫持；将其内容完整合入 `## 事实表`（扩为含 `v0.30.0rc2` 的四版本对照）与正文跟随机制段 |
| `L112-L115` | 核心定位与分支/标签存在边界：`ascend_compilation_config` 第三级开关（编译期 `super_kernel_optimize=True`，捕获期 `full_model` scope 包住 wrapper `runnable` 并调 `aclgraph.super_kernel_optimize()`；scope 给出范围不保证整网只剩 1 个 kernel）；跟随 `enable_static_kernel` 及硬件降级后 `assert self.enable_static_kernel`；固定 `v0.23`（`2c59ff10`）与 GLM 镜像（`db701c1f`）无此键；`v0.26` 维护快照 `2ed6cbba`（PR #15074）与 `main`（PR #15059）有，但早期标签 `v0.26.0rc1`（`f2f74a16`）与 `v0.27.1rc1`（`3b318862`）无，`v0.28.0.rc1` 可见 | `[C3]`、`[C17]`、`[C23]`、`[C31]`、`[C32]` | **保留** | 直接作为 `## 一句话` 首屏开篇，让读者第一眼读到“它是什么、跟谁走、哪两个时机生效、哪些版本/标签有” |
| `L116-L129` | `## 事实表` 九个维度对比（这个键是否存在、类型与默认、硬性依赖、只想开 static 怎么写、键名拼错 `**kwargs` vs `extra="forbid"`、值写成字符串 `"false"` 在 `v0.26` 为真触发 `assert` vs `main` pydantic 为假、硬件不支持 `is_310p()` vs `HardwareCapability.NPUGRAPH_EX`、`cudagraph_mode` 为 `NONE` 或需 piecewise 如 `FULL_AND_PIECEWISE` 时平台关闭三级开关、进编译缓存 hash） | `[C3]`、`[C9]`、`[C10]`、`[C14]`、`[S13]`、`[D]`、`[!]` | **保留** | `## 事实表` 保留紧凑机器标记（参数页 `type: param` 规范允许），将 `v0.30.0rc2`（`7d825229`）并入表格列（与 `main` 一致采用 pydantic `bool = False` + before-validator + `extra="forbid"` + `HardwareCapability.NPUGRAPH_EX`） |
| `L130-L142` | `## 为什么存在`：与局部子图融合规则（`fuse_norm_quant`、`fuse_qknorm_rope`、`fuse_muls_add`；旧 `fuse_allreduce_rms` 自 `v0.25.1rc1` 移除）的分工；`super_kernel_scope("full_model", ...)` 包裹 `self.runnable`；编译期与捕获期双生效点及 `{"dcci_after_kernel_end": [".*"]}` 选项、断言原文 `Super kernel generation requires static kernel to be enabled.`；`v0.26` `None` 哨兵 vs `main`/`v0.30.0rc2` `mode="before"` validator 与官方文档 `Inherits enable_static_kernel` 对照 | `[C2]`–`[C6]`、`[C14]`、`[C20]`、`[C35]`、`[S11]`、`[S15]` | **保留** | 原样保留 `## 为什么存在` 全部机制、代码标识与条件 |
| `L143-L165` | `## 开了的代价`：先确认最终图模式（`FULL` / `FULL_DECODE_ONLY` vs `NONE` / `FULL_AND_PIECEWISE`）；区分 static kernel 启动编译耗时（几分钟到几十分钟，`[S19]`）与 Super Kernel 额外成本（**消除 `L149` 裸“来源19”补丁段复读**）；显式写 `"enable_super_kernel": false` 的 `vllm serve` 命令示例；纳入 `AscendCompiler` 缓存 hash；310P 告警文本变化（`Ascend 310P` vs `current hardware profile`）；GLM 双机固定镜像 `db701c1f` 无此键（被 `**kwargs` 吞掉）及升级待核项 | `[C7]`、`[C8]`、`[C23]`、`[C33]`、`[C34]`、`[S11]`、`[S19]` | **保留**（将 `L149` 无损合入 `L147-L148` 并规范引用 `[S19]`） | `## 开了的代价` |
| `L167-L224` | 受 `review.ts:459-464` 保护的自动生成区：`## 版本谱系`（`L167-L176`）与 `## 参数定义（自动生成）`（`L178-L224`） | `scan.py` / `lineage-git.ts` / `pages.ts` 自动生成 | **保留并经包 2 官方确定性同步入口刷新** | 工作区已由包 2 修复 `scan.py` 识别 `AscendCompilationConfig.__init__` 签名参数并对约束 AST 去重后，确定性刷新 `L175` 为 `releases/v0.26.0rc | 有 | 2ed6cbba`，并消除原 `L196-L222` 重复 validator 代码块（现 `L196-L224` 共 3 段独立约束块，待 `041` 代码核验通过） |

---

## 三、 具体讲法改进位置与实施要点

1. **前置通过包 2 确定性入口刷新自动生成区，消解 `L120` 与 `L175` 的表观矛盾（`L167-L224`）**：
   - **一手源码证据**：固定提交 `vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L599-L661`（亦收录于 `raw:sha256-42c8fbc306605cf0e919ba3633fd18873e64133802338c685a530f755989462b.md#L199-L264`）中，`AscendCompilationConfig.__init__` 签名第 `603` 行已显式声明 `enable_super_kernel: bool | None = None`，第 `634-635` 行实现 `if enable_super_kernel is None: enable_super_kernel = enable_static_kernel` 默认跟随，第 `656` 行完成 `self.enable_super_kernel = enable_super_kernel` 赋值；证实正文 `L114`/`L120` 关于 `2ed6cbba` 存在该键的结论与上游源码一致，矛盾源于自动生成区 `L175` 的 `scan.py` 漏扫 `__init__` 构造参数（注：`Temp/infra-wiki-review-20261115/preservation-eval/before.answers.json` 基线问答模型仅输入四页正文，其证据范围仅在于证明读者/问答模型会如实识别出页面内正文 `L120` 与生成区谱系 `L175` 的自相矛盾，不能替代上游源码验证）。
   - 严格按 `review.ts:459-464` 规程：先由烁烁在包 2 修好 `scripts/wiki/params/scan.py` 并运行官方参数页同步入口刷新 `## 版本谱系`（`L175` `无` → `有`）与 `## 参数定义（自动生成）`（去除 `L196-L222` 的重复子块），再以刷新后的文件作为新 `base` 提交正文 `editorial` 修订。
2. **解除 `L110` 首句 `**v0.30.0rc2 对照：**` 劫持（`L108-L129`）**：
   - 删除 `L110` 抢占首屏的粗体补丁抬头，让 `## 一句话` 直接从 `ascend_compilation_config` 的三级递进关系（`npugraph_ex → static_kernel → super_kernel`）、跟随默认行为与两个生效点讲起；
   - 将 `v0.30.0rc2`（`7d825229`）合并进 `## 事实表`（与 `main` 并列或单列），使四版本行为一目了然。
3. **合并 `L149` 裸“来源19”补丁段（`L147-L150`）**：
   - 将 `L149`（`来源19（baa023ad graph_mode.md 184–186）的时间范围描述static kernel的启动编译...`）与 `L147-L148` 合并为一段通顺说明，保留“保持 static 开启、只切换 Super Kernel 对比启动时间、实际融合数量与性能；当前尚无设备实测对照”的全部边界条件，消除裸文本 `来源19` 与中英粘连。
