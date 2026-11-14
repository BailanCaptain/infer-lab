# NIXL 与 MooncakeStore 官方承接独立审查

审查者：`/root/groups_replay_review`。本组 **72 条新增引文已经逐项独立核验通过**，三页修订和 UCM 两段相邻差量已完成文本与浏览器复审；最终 SHA 见 `transfer-coverage-final-acceptance.json`。这不是全站完成声明。审查者没有修改教学正文、图或产品代码，没有使用子审查者。

## 本组为什么继续查

前批引文队列归零不能证明官方内容已覆盖。99 项官方目录中的第 27、47、48、51、52 项，已经全文读过，但 NIXL 的短租约和跨轮读回、上游 MooncakeStore 的两种资源组织及 SSD 责任分工尚未在本站得到足够承接。此组从这五项及 disagg_prefill 母页出发，再核当前三页、四个上游固定提交、Ascend 注册与后端消费者。不能把上游特性移植成固定 GLM 镜像或 AscendStore 的已有能力。

完整读过本组修改前的 `pd-disaggregation.md`（523 行）、`mooncake-connector.md`（521 行）、`kv-pool.md`（471 行）；修改前正文 SHA、图清单与快照见 `transfer-coverage-manifest.json`。原图共 10 张，SVG/YAML 20 个资产已保留。审查不触碰另一会话的 3D 和 renderer 改动。

## 发现与处理要求

| 编号 | 级别 | 位置/影响 | 独立结论与要求 | 当前状态 |
|---|---|---|---|---|
| T1 | P2 | KV Pool 原 L274、部署/错误段及来源索引：未设 PYTHONHASHSEED 一律随机的说法跨版本泛化 | 0fc/568 确为随机根指纹；840/ced 对 SHA-256 系列使用固定缺省 seed，xxhash 系列仍随机。需四版和算法条件；统一 seed 不等于缓存身份完整兼容 | 已修并复审通过；正文、示例注释、错误判断、四版表、96–102 新来源与消费者吻合 |
| T2 | 官方承接缺口 | PD 现有讲解没有独立解释 NIXL 生命周期与跨轮缓存 | 补 P 的 30 秒租约、约 5 秒心跳、max 更新公式，D 的 480 秒固定 TTL；解释代理保留定位信息、双向读回及前缀责任 | 已补并复审通过；新段置于 GLM 案例前，26 条来源逐条通过；不套用到 Ascend 配方 |
| T3 | 官方承接缺口 | KV Pool/连接器只讲 AscendStore，缺上游 Store 母页的资源区别 | 补 embedded/standalone-store 的池所有者、global segment 与 local buffer、SSD 三方配置和 staging 预算；明确不是 Ascend JSON 的同义字段 | 已补并复审通过；4 rank 例将 32 GiB 池和 4 GiB 私有缓冲分账，39+7 条来源逐条通过 |
| T4 | 教学维护污染 | 页末源码区域仍有“待核”等标题和真实未验证条件 | 已将 KV 页改为“实测边界”；根助手明确要求此组不一概删改其余旧“待核”。正文未插入修订哈希、旧文历史或审查流水；实际调用链与硬件未知项保留为后续范围 | 局部修订通过；不宣称全站维护式标题已清零，也不将保留的未知项判为已证实 |
| T5 | 相邻差量 | UCM 中两处 hash seed 索引也泛化了旧基线 | 限定旧版、回链 KV Pool 的单一四版解释；仅验两处差量，不接管其他 UCM/3D 改动 | 两段 diff 已读，实际点击回链成功；其余 UCM 内容归原批审查，不重复计数 |
| T6 | P3 | NIXL 算例将两个等式塞同一行，浏览器显示成“初始租约=5” | 拆开初始租约与心跳间隔；补算式到状态表的承接句 | 根助手已修，最终截图实际确认 30 秒、5 秒分行清楚，max 反例保留 |
| T7 | 引文范围 | KV 新来源 88 旧范围截止 2037，未含 wait_for_save 的实际 add_request 提交 | 扩为 1999–2047，覆盖加载、保存提交和 get_finished 职责说明 | 本审查者重新实际读扩展范围，最终 sources/人工账均为 1999–2047 |

本组没有新增已证实的 P1。没有把官方部署示例当作设备成功结果。

## 精确补证与人工主张账

`transfer-coverage-evidence-additions.json` 有 17 个人工主张组、74 个来源范围。它们是主张和引用范围，**不是 74 页或 74 篇全文**。每组都列固定提交、文件 SHA、行号、实际主张、边界。来源抽取与人工判断分开，不能自动由历史“已读”推出新主张成立。

1. **NIXL 请求进入 waiting 就开始跟踪。** 上游 scheduler `add_request` 入队后调用 `connector.on_new_request`；NIXL 仅为带完整远端身份且 `do_remote_prefill` 的请求安排心跳。等待未被调度不是无需续租的空白期。
2. **租约是到期时刻，不是累计余额。** worker 用 `max(old_expiry, now + lease_extension)`，默认 extension 为 20 秒。图中的“延长约 20 秒”不能教成每个心跳把旧时刻加 20 秒。发送、通知处理和到期回收依赖执行循环；握手、长前向和检查顺序会影响墙钟时刻，不承诺严格 30/20 秒回收上界。
3. **P 和 D 的生命周期不同。** P 默认 30 秒并可心跳续约；D 跨轮块默认 480 秒固定 TTL。双向默认关闭。64 token 门槛只针对 D→P 还需要读回的部分，不能移到普通 P→D 全路径。
4. **官方 proxy 不是身份认证器。** 全局实际缓存 TTL 为 450 秒，类构造默认 600 秒没有被实例采用；`get` 会 pop。它保存上一轮 D 的参数，不保存 KV 本身，也不验证 token 前缀、聊天模板或思考轨迹一致。相同 conversation_id 不自动证明可安全复用。
5. **四版不能只看参数名相同。** v0.26 增加 D 到期时刻导出与读回 5 秒保护；main/rc2 另加 scheduler_clock 重定位本地 TTL。到期字段缺失仍正常读；拒绝读回走 transfer failure，最终行为要结合 failure policy。rc2 的 NixlConnector 是 pull 别名，本组不评价 push 全链路。
6. **上游 Store 两模式区分谁贡献主机池。** embedded 的每 rank global segment 属于共享池；standalone-store 的 vLLM rank 贡献为 0，外部 owner 持池。local buffer 是每 rank 私有操作空间，不能拿它替代共享池或 SSD staging 预算。
7. **vLLM 侧 enable_offload 不是启动 SSD 的总开关。** 四版 connector 都把该值用于 1280 MiB staging 预算及分批，普通 SDK setup 没有由它传入 enable_ssd_offload。存储端 master 和 owner 启用及目录才决定 SSD 路径。母页“分配 DirectIO staging buffer”的一句不足以替代实际分配消费者。
8. **参数表还需要消费者约束。** 四版实际传输执行路径断言 load_async=True：旧两版在 get_finished，新两版在 start_load_kv；这不是构造阶段报错，新版 capacity-only 还会在断言前早退。初版证据 claim 把执行路径误写成构造，根助手复核指出后已更正。旧 scheduler 的查询没有 producer 早退，不能将 producer 解释成绝对只写不读。rc2 cacheable groups、Mamba 对齐、多组 PCP 等约束需按本版说明。
9. **Ascend 和上游 Store 不是同一个类。** Ascend 的 MooncakeConnectorStoreV1 注册为 AscendStoreConnector；preferred_segment 类型和 SSD 字段不同。同一个 MOONCAKE_CONFIG_PATH 环境变量不使 JSON 互换。Ascend rc2 SDK 能力检测与真正 setup 传参已读，未将这份新代码追认成旧版能力。
10. **hash seed 修订有实际下游键。** 除 NONE_HASH 初始化，还核到 request block hashes 转十六进制后组成 pool key。Python 对 PoolKey 的 `__hash__` 不是跨实例存储键生成本身。

## 母页之外读到了什么

完整阅读账为 `transfer-coverage-reading.json`，函数级相同/差异复用依据为 `transfer-coverage-method-comparison.json`。

- 6 篇固定上游母文再次完整读并核当前主张，复用官方 99 目录的既有全文记录，**不新增 6 篇全文计数**。NIXL 两张租约图及跨轮图都实际打开看过，复用既有 3 张官方图身份。
- 沿母文 Mooncake 仓库链接进入 README，并由目录定位到迁移后的 SSD 部署和设计文档。在独立固定的 Mooncake `4da33e5b44c28aec262dff63458c0bdb1c9bc8b0` 下，完整读 README 374 行、SSD 部署 496 行、SSD 设计 303 行；继续完整读 build 546 行、总部署 1557 行、Store 总设计 908 行，共 **6 篇新全文、4184 行**单独记账。已有阅读记录按 SHA 搜索未发现同项。README 两张技术图与总设计/总部署共用的一张架构图均实际查看，共 3 个独立新图；各文中的表与 ASCII 架构/流程图实际阅读。
- 同一 Mooncake 目录的 store_py.cpp、real_client.cpp、master.cpp 只读与 SDK 角色/SSD 初始化对应的范围，不把 3581、9880、1816 行全文件算成全文。
- build、总部署、Store 总设计原来只是下载候选，随后按根助手追加要求逐段读完，正式范围与应用/排除理由见 `transfer-coverage-directory-followthrough.json`；该文件也保留下一层尚未全文读的 API、租户、Engram、实验存储、厂商后端等分支，不能由 6 篇完成推成整个 SDK 文档树完成。FileStorage 配置源码仍只是已下载候选。
- 本地一次抽取 118 个固定源码文件只是取材清单。实际完整代码文件、节选、整函数同字节复用和完整 diff 阅读分别列账，未把 118 当成 118 篇已读。

这份 Mooncake 目录快照不是四版 vLLM 的依赖锁定版本。0fc 的依赖仅设 `mooncake-transfer-engine>=0.3.8`；SDK 文档自己的“standalone + DummyClient”与 vLLM 的 standalone-store 模式不能按同名合并。

## 官方材料自身需要保留的限制

SSD 部署指南有几处内部口径不一致：简版 master 启动步骤遗漏 enable_offload，而配置表、完整例子和排查段要求它；内存压力触发的概述不能概括默认 eager 模式；eviction 默认值、空 root 条目处理也有相邻不同说法。本组以源码支持的角色和开关为教学结论，不选取其中一处推导未核实的恢复或淘汰保证。SSD 设计的日志格式不能单独证明 crash recovery；没有因“目录存在/关闭清盘”就承诺恢复。

README 的传输性能图是官方指定网络条件下的技术图，不能视为本站 Ascend、GLM 或 DeepSeek 部署测量。所有 NPU 精度、容量峰值、带宽、失联恢复和命中收益仍无本组设备证据。

外部生产文章原始 3 张图仍未取得，403/验证码没有算通过；其尝试、正文可读取事实和补充图不能替代原图的身份已在 `external-tail-production-status.json` 留账，本组不关闭它。

## 最终逐条与保留验收

人工账原件为 `transfer-coverage-manual.tsv`；正式逐条账为 `transfer-coverage-judgments.json`。72 条分成 PD 26、KV Pool 39、Mooncake 连接器 7；均绑定当前页 SHA、实际来源文件 SHA、固定提交和行号。每条的支持范围与不支持的外推由人工写明；脚本只核对编号、来源和哈希，没有根据“曾读过”自动生成支持结论。原来源前缀 84 / 70 / 77 全部逐字保留，新来源追加；旧引用不重复入本组新增计数。

信息保留验收以冻结快照与当前全文 diff 为依据：三页原来的 7 个 calc 块全部逐字保留（PD 1、Mooncake 4、KV 2）；新加的只有租约与 Store 主机容量两例。KV 的 24/8/20 查询演算、GLM 段长 133,120/640、R1 不足一段、8,355,840 B 和 KDA 各卡身份仍在；Mooncake 地址换算、TP8/4/2、逐层重叠的 4.5/3.5 个示意单位 示意及 Layerwise 边界仍在；PD 的 GLM full 组传输缺口、P/D 资源案例与原失败边界没有被上游新段替换。10 张静态图的 20 个 SVG/YAML 资产与冻结副本同 SHA。另一会话的 3D/renderer 变动未归本组，截图中的 3D 加载框不算播放验收。

实际打开了三页首屏、静态图、新增租约/跨轮段、Store 模式/SSD 段和新版本表；UCM 只验相邻两段。四条新增回链实际点击后均到正确标题，四页无页面级横向溢出、无 pageerror，浏览器期间文件 SHA 稳定。PD 新版本表内部横向滚动实际从 0 滚到 30 px，最右侧的 Pull/Push 限定可完整查看。最终租约图块已经实际重新看过，初始 30 秒与心跳 5 秒没有合并歧义。截图取样与真正打开看的图片分别记在 `transfer-coverage-browser-reading.json`，不把所有截图当已读。

## 来源登记代码的有限独审

根助手为本组新增一个 Mooncake 固定提交前缀；按用户规则只在这段代码审查启用 Ponytail 与 i-have-adhd，纯文档部分未使用其简短化规则。本审查范围仅 `scripts/wiki/sources.ts` 的这一条登记、`sources.test.ts` 的 Mooncake 用例与 `wiki/HANDBOOK.md` 对应一行；没有把这些文件的其他既有 diff 认作本组修改。

实际阅读了分类函数、HANDBOOK 解析函数及 lint 的两个消费者。域名全等和完整 40 位提交加末尾斜线共同限定路径；新增用例拒绝 main、不同 owner/fork、相似提交后缀、issues 与伪装域名，文档与源码正例通过。根助手的 red 日志确实显示登记前正例为 unlisted；本审查者独立重跑 `pnpm exec vitest run scripts/wiki/sources.test.ts scripts/wiki/lint.test.ts`，2 文件、109 测试通过，见 `transfer-coverage/review-replay-source-tests.log`。这是允许引用固定官方材料的分类，不证明仓库每个文件都已读，也不把 SDK 提交追认成 vLLM 依赖锁定。未发现此有限代码差量的 P1/P2。

根助手的 `index-dbo-final-{content,lint,audit,diagrams}.log` 与 `index-dbo-final-build-unlocked.log` 已逐项检查关键输出：content 164 页通过，lint 通过另有 10 条提示，audit 7414 来源的本地引用与行号检查通过，343 图一致，构建成功。其范围不含 URL 联网或 raw/结论语义验证。它们早于最后一处 Mooncake 来源边界句；该句已独立文本复审，实际打开截图并点击其中 KV Pool 回链到正确 H2，最后一句之后的统一工程检查由根助手下一阶段另记，未把早期结果伪装成最终同 SHA 全套检查。此前锁冲突构建日志保留，不算成功。

Mooncake 最终末句已把“没有核实现”修正为“完整内部实现尚未核完”，并准确回链本轮已读的 SDK 初始化、预算和 SSD 消费链；避免抹掉已做的有限阅读，同时没有升级为整仓核验。最终正文哈希已重新冻结，浏览器主回链 4 次，加这条末句回链 1 次，均成功。

## 仍需继续读或实测的明确对象

- **Layerwise 最后一层发送与 P 还块。** 目前知道请求结束还块与发送线程等事件；仍需继续追最后一层回调、发送完成通知、引擎还块和下一请求覆盖同块的同步关系。没有双机压测，不能由“线程等过事件”保证复用无竞争。
- **GLM KDA 与逐层发送接口。** 仍需从 GLM 调用的上游线性注意力入口追到 Ascend 包装/后端和逐层 save hook；不能把 MLA、稀疏注意力、GDN 已有 hook 等同于所有 KDA 状态可逐层推出。
- **注册段数与错误恢复。** 每卡合并后的实际注册段数是否小于 256、允许配置下端口连通、双机错误原文、失联与缓存恢复仍缺设备日志；纯源码阅读不能替代设备结果。
- **Store 内部与目录后续。** 本轮核了 SDK setup、RealClient 的 FileStorage 初始化和 master 配置消费者的有限范围，并非完整 TransferEngine/Store 实现；FileStorage 配置文件和总设计承接的 API、租户/隔离、实验后端、故障恢复等仍是后续阅读对象，详 `transfer-coverage-directory-followthrough.json`。不能把新目录的 Engram 子设计自动当成 DeepSeek 模型 Engram 的解释。
- **全局外部尾项。** 原生产文的 3 张图尚未取得；403/验证码没有关闭阅读项。硬件收益与精度无本组实测，不能由本组 72 引文通过推导全站完成。

## 最终演算呈现增量与工程对齐

根助手随后仅调整两个新增演算块：PD 将心跳例子写为 max(30, 5+20)=30 秒、max(30, 15+20)=35 秒，并补续约窗口单位；KV Pool 将未能附着于算式的 `>` 旁注改为完整说明行。独审读取两个完整差异，确认条件、数字、反例及全部来源未丢失；实际打开 `review-replay-calc-delta/pd-disaggregation-calc.png` 和 `kv-pool-calc.png`，文字与算式正常，`>` 不再误显示，浏览器 errors=0、页面横向溢出=false、两页读取前后 SHA 稳定。旧截图在这两个块之外复用，不把它们当作修改后截图。

最终 PD SHA 为 `a32c1268296d56dae87e0a4713eec6a77065c8a31b2dcc2e478f69406ee0c03c`，KV Pool SHA 为 `aab6d5b3c9858a67ebd191f5e03991c2b9c3d17cebd5b1606fa612598b460628`。Mooncake 与 UCM 未变；72 项逐条判断只更新绑定哈希，不新增阅读数。`coverage-transfer-media-scoring-vit-verification.json` 的五项退出码均为0，独审另读对应日志关键输出并核对四页哈希：164页、7535来源本地检查、344图一致、build 6.17秒；474 URL 与3793 raw机械未匹配仍非语义通过。上面的早期工程记录保留为历史，不再是最后检查时点。Layerwise/KDA/256/V2 后续研究另归 `transfer-lifecycle-*`，不从本次72验收推导全站完成。
