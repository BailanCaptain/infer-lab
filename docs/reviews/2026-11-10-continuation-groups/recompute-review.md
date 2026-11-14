# Recompute CPU Offload / Scheduler 独立审查

审查人：`/root/groups_recompute_review`。范围为 CPU 页 34 个冻结旧来源出现项、Scheduler 页旧来源 15–43 共 29 项，合计 63；CPU 首轮补证 35–41 共 7 项、独审发现 rc2 差异后补证 42–47 共 6 项，合计新增 13 项另账。Scheduler 旧来源 1–14 和前批新增 44–59 不重复计入本批，通过关联代码复核必要上下文。本审查不代表全站核验结束。

状态：63 旧项、13 新增的文本/语义、信息保留、图与最终局部视觉审查通过，最新统一五项工程检查全部 exit 0，本范围验收通过。失败及恢复过程保留在文末。未执行 NPU 推理、质量评测或真实 P/D 传输。

## 审查方法与材料

- 先读 `docs/wiki-writing-standard.md`、`wiki/AGENTS-GUIDE.md`、本批 preservation 清单，再读两页实际全文、所有图及源码，未只审 diff。
- 对照 `.tmp/continuation-groups-2026-11-10/recompute/before.zip`。独立归一化换行后的 diff 位于 `.tmp/continuation-groups-2026-11-10/review-recompute-recompute-cpu-offload.diff`、`review-recompute-recompute-scheduler.diff`；Scheduler 本轮无教学正文变更，前批结论与两图均保留。
- 固定源读取覆盖 CPU 1–41、Scheduler 15–43 的所有引用范围。独立补读完整旧指南 312 行、rc2 指南 322 行、RFC 10820 正文 559 行、PR 10742 正文 239 行、PR 16510 正文 24 行。旧指南来源 16 只引到 L307，全文另含末尾 Reference，已补读至 L312，未把引用末行冒充全文长度。正文来自本轮 GitHub 取回材料与本地固定 git 对象；作者自测不计为本站实测，RFC 计划不计为已实现功能。
- 运行独立校验脚本 `.tmp/continuation-groups-2026-11-10/review-recompute-integrity.py`：首轮 70 项中 64 个固定源码/文档范围均有效，摘录逐行匹配相应 git 对象；另外 3 项 GitHub 正文、1 个同源 URL 重复项、2 个原始归档分别处理，不混称 70 份官方全文。
- rc2 增量 42–47 六个固定范围全部独立阅读并复核，最终为 76 个来源出现项，其中 70 个固定源码/文档范围逐行匹配。另比较 rc2/main manager、worker、connector 差异，确认 rc2 专门分支不能以 main 代替；GLM/v0.23/v0.26 的旧 worker 与 connector 全文件 SHA256 各自一致。
- 原始归档 CPU 1079 行含 28 个片段，Scheduler 1184 行含 39 个片段；28/28、39/39 与各自固定版本原文一致，文件 SHA256 与文件名相符，没有未归属的前缀文本。仅证明归档完整性，不增加独立技术支持。详见独立 `review-recompute-integrity.json`。

## 发现、修订与复验

| 级别 | 发现与影响 | 复验结论 |
|---|---|---|
| P1 | CPU 首两屏未明确同步搬运的等待代价，读者容易只记住“省重算” | 已在首屏定义后写锁页内存、存取两趟、该 worker 同步等待；1440×1100 浏览器首屏实看通过 |
| P2 | “发布分支默认 8 GiB”“主机不足就回 P”将旧版结论套到 rc2 | 已限定 v0.23/v0.26/GLM；rc2/main 比例预算和 rc2 细粒度 TP abort 单列，summary、relations、术语、开销、错误入口同步收窄 |
| P2 | 图和索引把归还块号、拷走旧字节、固定下一步生成混为一谈 | 机制图改为旧数据覆写前保存、发标记、完成报告后继续排队；源码索引改为完成报告处理后再调度。正文保留后续预算与排队条件 |
| P2 | “每个缓存组同一个块号各占一格”误导混合组块表关系 | 已改为各组各自块表、逐组登记合成计划，保留 Mamba/滑窗/MTP 说明 |
| P2 | CPU 页只有机制图，缺标准要求的代码流程图与主线站点 | 新增 `recompute-offload-flow`，把第 2/3/6 站、保存/恢复两次完成报告、未 ready 等待、失败分支放到同图；实际查看 SVG 渲染通过 |
| P2 | 默认比例预算被推成新版“一定多占很多主机内存” | 已改为占用随设备 KV 池变化，不继续套旧 8 GiB；实际横向滚动版本表看到右侧修订 |
| P2 | rc2 与 main 的混合恢复差异遗漏 | 独立 git diff 找到环形私有单块、Mamba Conv 接受位置修正、视图绑定校验、store event 去重；已补 42–47 证据及教学/错误/版本说明，文本与恢复服务后的最终局部视觉复验通过 |
| P3 | 含省略号的配置片段和完整指南的关系不清；Engram 只提名无落点 | 已明确旧版选项片段不能原样执行，添加两份固定完整指南直链；Engram 链接实际落到模型页主机共享小节 |

本轮复验没有靠删算例或删除边界消除问题。CPU 的 9 位置/3 块、32 层 128 KiB、16384−1 块、两条 32768 长请求只能放一条、三档传输/重算时间与 4 GiB/s 持平、120–121 块 GLM 对照全部保留。取消后的延迟回收、末位置采样、全有全无、共享完整哈希块与私有尾块、滑窗空位、MTP 截断和旧 GLM 混合状态未验证也保留。新增主机总预算按本地 worker 求和、MultiConnector 恢复优先、日志与完成证据区分。

Scheduler 的 64/60/4 与 1600 步示意、10−3+1=8 帧计数局限、旧版文本重投/v0.26 token 历史、直连 D/工具/多轮限制、实际类选择覆盖、worker 两处归类、旧客户端帧不等引擎收尾、rc2 abort/pending frees 条件及两张图均保留。

## 首两屏复述

CPU 页：D 节点让出一条正在跑的请求时，可以把其已算状态保存在本机主机内存；调度器可以先归还块号，worker 必须在旧字节被清零或覆写前拷走。排回来还要分块、搬回、处理完成报告和再次获得预算。这能少做历史重算，但预留锁页内存，存取两趟同步搬运会使该 worker 的其他请求等待；旧版不能保存可经代理退回 P，rc2 有特定直接中止分支。第二屏 9 位置/3 块示意说明状态去向，不冒充实测。

Scheduler 页：D 续块失败后选择一条请求让块，先问连接器能否接受保存；接受只登记保存路径，实际复制由连接器和 worker 完成。旧失败分支发 `recomputed` 客户端帧，由代理重投 P/D；旧 GLM 发帧并不完成引擎全部清理。保存付主机内存和搬运代价，回 P 付排队、重算、交接代价。前两屏已就地解释 P/D、KV 块、连接器和代理，能够说清三条去向及 rc2 例外。

## 逐项语义结论：CPU 冻结 1–34

“支持”均指页面注明的固定版本和条件；同一片段的行号有效不等于所有邻近文字都自动受支持。

| 来源 | 独立判断及适用范围 |
|---|---|
| 1 | 修订后支持：hook 真后登记保存并抢占，块号可归还；字节覆写前的保存由 9/11 支持。旧假分支 free/记名单，不能说正式结束全部引擎状态 |
| 2 | 支持旧版每 rank 优先、8 GiB 总预算、布尔校验；新版由 38 补证，不能把默认值跨版本推广 |
| 3 | 支持 PCP/DCP=1、CPU coordinator、完成计数；manager 的默认 True 被连接器显式 False 覆盖，不是实际开关默认 |
| 4 | 支持按带 shared_by 的张量总字节计算块数且至少 1；借用容量还需减 34 的 null block |
| 5 | 支持已有记录、未 ready 返回 None、可恢复边界夹值；组合恢复优先需 35，不能只看此函数 |
| 6 | 支持新记录前提、全有全无、完整哈希共享与私有块；混合组各自块表，不能解成各组共用一个物理 ID |
| 7 | 支持 all-worker 保存报告聚合与取消清理；是保存完成，不是 H2D 后请求已生成 |
| 8 | 支持每 worker 独立预分配锁页张量；本机总预算为本地 worker 求和的推导，与 Engram DP 共享不同 |
| 9 | 支持 D2H 在更新状态/覆写前、H2D 在前向前，均 sync=True |
| 10 | 支持设备同步、逐块逐张量 copy、event 同步；non_blocking=True 不把整条路径变成后台无等待 |
| 11 | 支持 model_runner_v1 在更新状态前调用保存 hook；不意味着调度器必须等复制后才归还块号 |
| 12 | 支持子连接器保存 hook 的 OR 汇总；恢复优先另见 35，不能推为所有连接器都能保存全部模型状态 |
| 13 | 支持 AscendMultiConnector 注册替换入口，非混合模型硬件正确性证明 |
| 14 | 官方冲突已处理：文档 DP 除法与 2/17 的 world_size 定义冲突，页面以代码明确预算口径 |
| 15 | 支持旧版 D/V1/调度器前提、滑窗对齐、MTP 截断、实验共享及 Qwen3.5 异步限制；流程还需 27–29 解释调度状态 |
| 16 | 支持 FAQ 概念与日志入口；DP 预算错误不能照抄，准备日志不独自证明恢复完成 |
| 17 | 支持 world_size=PP×TP×PCP，不含 DP；公式包含 PCP 不等于连接器支持 PCP>1 |
| 18 | 支持显存 prefix cache 的哈希登记时机；与 19 共同解释未前向块的旧修正，不证明任意状态已算 |
| 19 | 固定 v0.23 删除未写入前缀哈希的代码与 GLM 对照，属于同实现复用；不外推到 v0.26/main |
| 20 | 支持 v0.26 Mamba 尾部 1+spec 块与不参与共享，不能替代 rc2 卷积恢复差异或旧 GLM 验证 |
| 21 | 支持 main 容量解析入口；实际比例取整由 39，rc2 同类校验由 38 补足 |
| 22 | 支持 main 的 Mamba 尾块选择；不能据此称 rc2/main 的全部恢复行为相同 |
| 23 | 上下文支持：此范围到异常/日志，正式收尾完整路径需 Scheduler 20；不能宣称所有 worker 异常都兜底 |
| 24 | 支持 main MRV2 调用点，非对所有模型、所有模式的硬件验证 |
| 25 | 支持 main 配置名 PreemptOffloadConnector 与实现类名 V1 区别 |
| 26 | PR 16510 只作改名/MRV2 背景；作者 CI 说明不算本站测试，不推广其当时配套版本 |
| 27 | 支持外部状态加载本步 0 token、分块后 WAITING_FOR_REMOTE_KVS；copy 同步仍使用此调度状态 |
| 28 | 支持恢复后 min 夹值、满命中留末位置采样及原有 spec 处理；完成后仍受调度预算影响 |
| 29 | 支持完成水位与 finished_recving，配合 7/37 区分保存完成/恢复完成/引用回收；不保证固定下一轮生成 |
| 30 | 仅归档完整性：1079 行、28/28 固定片段及文件哈希匹配；不计独立技术支持 |
| 31 | rc2 指南支持新名、比例入口和嵌套开关；DP 示例仍与代码冲突，页面已指明；失败路径需 32 |
| 32 | 支持 rc2 oproj/mlp 实际分片大小>1 的保存失败 abort；其他条件走重算收尾，不能从 warning 字面推总回 P |
| 33 | 与 31 完全相同固定版本、文件、范围的 GitHub URL；去重记录，不增加全文数 |
| 34 | 支持初始化永久留一个 null block，16384 总块只有 16383 可借；仅分一个块等于无普通可借块 |

## 逐项语义结论：Scheduler 冻结 15–43

| 来源 | 独立判断及适用范围 |
|---|---|
| 15 | 支持 v0.23 P 上关闭并写回、D 替换及角色门；后续 dynamic batch/profiling 可覆盖选择 |
| 16 | 支持 v0.26 登记后正式 finish_requests，与旧 GLM free-only/发帧区别成立 |
| 17 | 支持 v0.26 首 decode 静态 spec 补形状的多重条件与预算/长度限制，不泛化所有请求 |
| 18 | 支持 v0.26 真实 token 历史和一致性检查、扣实际输出 token；不证明随机轨迹或任意工具状态等价 |
| 19 | 文档嵌套优先/顶层弃用成立；P 上会失败的文字与 28 警告关闭冲突，页面已分清 |
| 20 | 支持 main 保存钩子异常捕获、正式收尾、成功委托父抢占；rc2 特例不能沿用 |
| 21 | 部分上下文：片段开始时策略选择已发生；完整 priority 选择由既有来源 48 补足，不能单独证明 max 排序 |
| 22 | 支持 main 同步/异步与 DyntraLB 组合类存在；具体选择需 23/29 |
| 23 | 支持 main 角色门、开关回写和 4 类选择；后续覆盖需 29 |
| 24 | 支持上游还 KV/encoder、清零、清草稿、计抢占、放队首；再调度可命中缓存，不一定全重算 |
| 25 | 支持上游接收成功缓存、满命中减一及失败有效 token 分支；旧 Ascend 附加 min 逻辑另见原有来源 5 |
| 26 | 支持 main 文本拼接、list content 追加文本和帧计数；不能混作 v0.26 token 历史方案 |
| 27 | 支持 v0.26 D 取队尾、hook 无异常兜底、失败正式 finish；与 GLM 收尾不同 |
| 28 | 支持 v0.26 P 警告/嵌套回写与 profiling/batch-job 覆盖，开关真不保证最终类 |
| 29 | 支持 main DyntraLB 特定组合分支，profiling/batch-job 仍可覆盖 |
| 30 | 支持旧 D、Mamba、Hybrid coordinator 同时满足才逐组查本地命中，不能泛化到 prefix caching 关闭 |
| 31 | 注释作设计动机；实际条件由 30、38、39 支持，不把注释视为整条执行证明 |
| 32 | 只有函数 docstring，单独不足；已有补证 49 覆盖实际角色/开关判定，本批不把此短片段自动记为完整支持 |
| 33 | 支持 attention 调用处启用短扩展 decode 判定；结合阈值和上下文条件，不是全部 prefill |
| 34 | 支持 PCP 输入准备在既有 context/阈值内按 N−1 判断 done_prefilling，与 33 对应 |
| 35 | 支持跳 DP all-reduce 的层级排除、dense/MoE、consumer、decode/prefill MC2 或开关条件 |
| 36 | 支持 token dispatcher 在 35 判定后选择 global_bs/mc2_mask 参数；不能独立证明全部 MC2 能力 |
| 37 | 支持 worker 用本地 token 填 DP 列表并早返，从而跳过后续 DP 汇总；与 35 联合使用 |
| 38 | 支持 enable_caching=False 选 NoPrefix coordinator，解释固定 GLM 不进入 Hybrid 命中特例 |
| 39 | 支持 Ascend 单组或无缓存委托上游工厂，与 38 一致 |
| 40 | PR 10742 作动机/已知限制/作者自测背景；不把 D OOM、工具限制或精度结果推广到所有部署 |
| 41 | 仅归档完整性：1184 行、39/39 固定片段及哈希匹配，不计独立官方全文 |
| 42 | 支持 rc2 finegrained 分片>1 保存失败 abort；其余正式重算收尾，日志本身不足以判断后继分支 |
| 43 | 支持 pending frees/候选不能立即释放时 break，以及按 priority 或队尾选；与完整选择、后续代码联合判断 |

## 首轮新增 CPU 35–41

| 来源 | 独立判断 |
|---|---|
| 35 | 支持对已保存请求优先调用相应连接器，无关配置先后；未 ready 仍等待，有贡献才选中并分派，无贡献回普通查询 |
| 36 | 支持按组构造 H2D 映射、范围截断、空范围/组数错误；Prepared 日志在完成复制之前，不能用于确认恢复完毕 |
| 37 | 支持请求/事件释放、已完成共享引用、重置清理条件；释放块是返还预分配池，非释放整个锁页张量 |
| 38 | rc2 比例先校验正且有限，即使同时给字节；per-rank 优先于 total/world_size，有效字节须正；supports_divergent_local_hybrid_hits 不等所有模型通过 |
| 39 | main L153–185 实际支持比例 int 后 max(1)，字节按总缓存字节取整；小预算可能只得到 null block，不能宣传至少可存一个正常块 |
| 40 | rc2 完整指南后段支持 P/D D/V1/调度器限定、滑窗/MTP、日志和 Qwen3.5 异步限制；泛称失败回重算须受 32 的实际分支修正 |
| 41 | RFC 完整正文仅作设计、现有限制、作者自测和后续计划；stable boundary、专用 copy、合并 SimpleCPUOffload 不能写成已实现 |

## 独审追加 CPU 42–47

| 来源 | 独立判断 |
|---|---|
| 42 | rc2 Mamba 仍存尾部 1+spec 块且不哈希共享；非 Mamba 的环形组要求恰一个正块 ID，逻辑块数固定 1、禁止前缀哈希共享；非法布局抛错 |
| 43 | rc2 根据接受位置选递推状态块；带 Conv 的组另外使用运行状态块和经缓存边界修正的偏移；环形组恢复 slot 0。支持映射检查，不证明所有模型恢复正确 |
| 44 | rc2 按指针/形状/stride/dtype/状态语义区分 Mamba view；Conv 必须二维且匹配规格、scale=1。LINEAR/SHORT_CONV/MAMBA1/MAMBA2/GDN 的判定在固定实现有明确分支 |
| 45 | rc2 对已提交保存事件去重；H2D 传递卷积校正元数据且仍 sync=True，不是异步无等待能力 |
| 46 | rc2 先普通整块 H2D，再校正 Conv 历史前缀 width−spec 行；非法偏移、非正历史长度或无绑定抛错。不能说草稿工作区从未复制，只能说不参与这次历史校正 |
| 47 | 环形判定支持 CircularBufferSpec/is_circular；Uniform 组必须非空且全成员符合，不是所有 sliding window 都视为一个环形块 |

rc2 小例子按总宽度 5、草稿区 2、源偏移 1 演算：有效历史 3 行，零基编号主机行 1–3 校正设备行 0–2。这里只演示切片布局，不作为真实模型尺寸或质量测量。官方 Qwen3.5 异步限制继续保留。

## 浏览器证据

运行 `node .tmp/continuation-groups-2026-11-10/review-recompute-browser.mjs`，实际打开 `http://127.0.0.1:5201/#/wiki/recompute-cpu-offload` 与 `#/wiki/recompute-scheduler`。新增流程图后 CPU 5 个 figure（2 图+3 calc）、Scheduler 4 个 figure（2 图+2 calc），5 张 table。已实际查看首/次屏、4 图、5 calc、版本/对照/源码表及配置、容量、错误小节截图。

所有内部连接按精确 href 点击，而非文本近似匹配：CPU 36、Scheduler 21，共 57 个唯一 href；目标 URL 与锚点核对通过，页面无横向溢出，无 pageerror。前一轮脚本按文本选取误点同名锚点已经修正并重跑，不把该轮结果作验收依据。

CPU 旧版本表为容器内横向滚动，独立执行 `review-recompute-scroll.mjs` 从 scrollLeft 0 滚至 407（clientWidth 1076、scrollWidth 1483），右侧 main/解释列可访问；不是全页面溢出。截图与机器记录在 `.tmp/continuation-groups-2026-11-10/review-recompute-browser/`。

工程检查由主写手在最终修改后运行，本审查已读相应日志和结构化结果；前端截图和引用匹配不能替代工程检查，更不能替代 NPU 测试。

## 最终补录

2026-11-10，rc2 补证 42–47、总宽度 5 行/含 2 行草稿/零基编号示例均已落盘并逐项复验。原有 63 条旧来源的版本、文件和顺序未改变，新增共 13 条，独立完整性脚本 76 项无无效范围/摘录差异。

主写手 `recompute-final-verification.json` 记录时间 `2026-11-10T09:23:55.456600+00:00`；本审查实际读记录及日志：

| 命令 | 结果与边界 |
|---|---|
| `pnpm check:content` | 0；164 页、11 主题内容完整且无重复 |
| `pnpm wiki:lint` | 0；另有 9 处全站既存提示，不声称全站全部问题清零 |
| `pnpm wiki:audit` | 0；104 个名单页全部达标，无无效 commit/文件不存在/越界；467 个 URL 未联网验证、3093 个 raw 待核仍是全站剩余，不把机械通过当全部语义核验 |
| `pnpm wiki:diagrams --check` | 0；341 张图与 spec 一致，新流程图过长副标题已缩写；最终缩字后画面仍需下项补验 |
| `pnpm build` | 2；`src/app/wiki/WikiScene.tsx(174,63)` 引用的 `./wiki-optimization-renderer` 尚不存在。来自共享的并行 3D 修改，本审查未改动该代码，也未屏蔽错误 |

最终局部浏览器脚本 `review-recompute-final-browser.mjs` 在 `wiki-body` 等待 30000ms 后超时，未获得新 rc2 段及缩字后流程图的最终截图。此前四图、五 calc、五表、57 个内部链接的浏览器验证已完成且保留，但不能据此称最终状态全部通过。需待共享依赖恢复后重跑 build 和此局部视觉脚本，再补完成记录；文本/来源状态可以单独冻结，不冒充全量验收完成。

**局部视觉补验完成。** renderer 落盘后仍出现 WikiPage 动态模块加载失败，主任务查明并恢复遗留的工作流锁、重启自己的 5201 服务后，本审查重新运行上述脚本，exit 0。实际查看最终 rc2 环形/卷积段、总宽度 5/草稿 2/零基偏移 1 示例、rc2 错误和版本段，以及已缩短 `get_finished` 副标题的流程图，文字完整、箭头和步骤清楚；无页面横向溢出、无 pageerror。结果保存在 `review-recompute-browser/final-report.json` 与 `recompute-cpu-offload-final-flow.png`、`-rc2-state.png`、`-rc2-version.png`、`-rc2-errors.png`。早先失败记录仍保留作为过程证据，不覆盖为从未失败。

最终文本/来源/图与局部浏览器独审无开放 P1/P2；build 的后续结果由主任务重跑并补录，不因为页面现在能打开就声称构建已通过。

**最终工程闭环。** 已实际读取 `supplement-closeout-verification.json`（`2026-11-10T09:36:28.785834+00:00`）及对应 build/audit 日志；`pnpm check:content`、`pnpm wiki:lint`、`pnpm wiki:audit`、`pnpm wiki:diagrams --check`、`pnpm build` 均 exit 0，build 完成为 `built in 6.19s`。这轮已包含 Recompute 47 来源和最终文本，取代早先失败作为最终工程结论。全站既存提示、未核 URL/raw 与 NPU 限制仍按上文保留。

两页与四图的 10 个教学文件已校验最终 SHA256 并冻结在 `.tmp/continuation-groups-2026-11-10/review-recompute-accepted.zip`，清单和压缩包摘要见同目录 `review-recompute-files.json`。正文、旧算例和图保持已复验状态。Why：防止时序、预算及版本边界误导学习者。What：63 旧项与 13 补证、两页四图独审及已发现问题闭环。Evidence：逐条源读、字节校验、实际页面与链接操作、最终五项通过。Tradeoff：只接受本批内容与工程状态，不认证全站或真实设备正确性。Open Questions：无待用户决定项。
