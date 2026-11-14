# 第 06 组整改独立验收

日期：2026-11-03。审查者：`/root/review_first_pages`。审查者未编辑本组教学页；写手记录见 `group-06-remediation.md/json`，三处追加收尾见 `group-06-final-tail.md/json`。

## 结论与实际范围

本次独立验收没有发现尚未关闭的 P1/P2。发现 1 项续期时间表述的 P3，主代理修订后已重新对照源码关闭。三处追加尾段通过局部语义验收，原有条件和缺证据范围没有因清理维护叙事而消失。

已完整阅读 `.tmp/wiki-remediation-2026-11-03/g06-own.diff` 的 1–1063 行，覆盖 37 页的全部改动及差异上下文，基线是 `group06-before-remediation.zip`。随后在内存中将该差异应用到基线，与当前页面逐行比较；追加差异为引用计数尾段、sleep 尾段及续期时间修订，均已阅读。另以 `group06-final-tail-before.zip` 阅读 GLM 基线页等三处收尾的完整差异。对应版本的字节哈希、差异阅读范围和源码阅读范围记录在 `group-06-independent.json`。

本报告是整改差异的独立语义验收，不是本审查者再次全文阅读全部 49 页，更不是全部来源事实已经重新验证。此前全页初审由本组写手记录在 `group-06.md/json`。本轮对 STAIR 总参数页另完整读当前文件；对重点页读取差异上下文及必要现文。保留此前并发 rc2 补充，不将它归为删除或回退。预取参数路径和 size 扫描器由主代理修订并另作代码复核，本报告只检查相应教学解释与消费者的边界。

## 重点问题复核

| 项目 | 当前解释与独立证据 | 验收结果 |
|---|---|---|
| RFork 的工作版与社区 rc2 | 工作版仍固定 `rfork@3284850b`；新行为明确属于 `vllm-ascend@7d825229`。`rfork-identity.md:315` 的配置指纹与结构摘要，分别对照 `identity.py:219–339`、`tensor_layout.py:42–61`；`rfork_loader.py:471–524` 实际消费身份。结构摘要不读取权重内容，不能当逐字节校验和 | 新快照行为未倒灌工作版；保留了权重内容未验证的限制 |
| DP 分片身份 | `rfork-identity.md:318` 解释 fine-grained TP，以及 MoE/无法排除 MoE 且 DP>1 的隔离；`identity.py:257–293` 和 loader:514–522 支持该条件。普通复制 DP 不加入分片编号 | 不再概括成“DP 永远不进 key” |
| 登记与申请顺序 | rc2 的 loader:630–704、session:100–159 先准备和登记目标布局、绑定摘要，再申请；工作版流程单独保留 | 没有沿用旧指南 Overview 的顺序解释 rc2 |
| TTL 与续期 | `rfork-config.md:407`、`rfork-lifecycle.md:400` 对照 planner_client:117–245、session:37–51、149–188。TTL 必须有限且为正，缺失会使申请失败；续期开始前等待被限制在 0.1–30 秒的 TTL/3。P3 修后准确描述同步调用耗时 | 原始响应头契约、失败回退及未证明 native 读取停止的限制均保留 |
| 释放与发布 | `rfork-lifecycle.md:402` 对照 session:261–364、495–554；快速尝试耗尽后，暂态失败按至少 60 秒继续。RELEASED、REJECTED 和停止各走不同分支；有未归还租约时不启动 seed 服务。工作版 session:113–214 仍是自己的总次数上限 | “读取完成”“归还确认”“发布 seed”三个事件区分成立，未把读完推成 Planner 名额已空闲 |
| 端口 | `rfork-config.md:409` 对照 rc2 session:44–51、495–554；main/draft 相邻双槽、越界和绑定失败允许动态回退。transfer_backend:224–269 传 0 并读取 get_rpc_port | seed HTTP 与 TransferEngine 端口分开；不保证部署一定取得预期固定端口 |
| 清单与保活 | `rfork-transfer.md:359–361` 对照 rc2 manifest:64–214 与旧 main baa023ad transfer_backend:394–482。新版完整五元组及格式名称覆盖有代码依据；旧 main 已保留登记 Tensor 引用，工作版进一步保存登记时 storage owner | 不再把三个旧社区版本都写成完全没有保活；结构相容不等于内容一致 |
| layer_sharding 资源计数 | 2c59ff10 layer_shard_linear:30–145 按层号取模放置，并建立 prefetch_step+1 个窗口。61 层、16 卡、每层 112 MiB、两窗口的算例重新计算为 13×4+3×3=61；两类卡是 672/560 MiB，接收 57/58 层，对应 6384/6496 MiB | 651 MiB 只能作平均值；算例条件与非实测限制保留。没有从占位张量大小推出加载峰值 |
| KVPP owner 与 size | `size-40a1c2ca47b8.md:77–109` 对照 7d825229 worker:1144–1152、kvpp_cache:1–52。计划编号 PCP rank×TP+TP rank，执行用 KVPP 组内 rank；TP2/PCP2 两个 TP0 为 0/2。ascend_config:60–158、1834–1866 验证派生 size、用户配置剔除及支持条件 | 旧 TP 公式与 rc2 分开；旧 GLM 没有字段，不能说其 size 恒为 1 |
| STAIR 历史与默认值 | 当前总参数页完整阅读。7d825229 ascend_config:186–261、MRV2 eplb:38–66、factory:1–25、patch_eplb:152–239、283–314 支持接入、默认 stair、两限额默认 −1、自动回退 Gloo 只收紧未指定字段 | 历史 4d1412d1 未接入与默认 1 限定在旧快照；显式 communicator/限额的区别保留。未重新证明全部搜索算法的每项性能结论 |
| PCP 权重与 fused 路径 | 7d825229 ascend_config:581–585、SFA-PCP:82–109、DSA-PCP:2551–2584/2700–2714 支持默认 True、分片失败回退和全量权重等待。fused 字段、限制与实际 int8 分支对照 ascend_config:1693–1716、sfa_kv_offload:68–95/719–747/1625–1627，以及官方同 pin 指南:320–342 | rc2 与旧 main 的限制分开，声明注释落后于消费者的情况明确说明；默认开启不等于任意量化方法都可切分 |

## 清理维护叙事后的信息去向

逐段对照 37 页的旧/新差异：RFork 的工作版身份、旧日志、GLM 算例、回退清理门槛、未做 NPU 验证、现场 Planner 协议和依赖库语义缺口仍在。STAIR 的阈值 OR 条件、样本加权 p95、平局次序、回退预算、失败候选与旧快照未接入限制仍在。其他参数页保留了 C8 缓冲容量、bias 延后、MoE 排除、sleep 空标签与发送等待、Super Kernel 独立成本缺口、fused dummy 与真实混批、CPP 计时/失败、layerwise 返回标志等有效解释。

尾段由“本轮已核、归档某行”改成行为条件及来源位置。`combine_quant_mode=3` 缺算子与硬件支持依据、PCP+DCP 完整组合路径缺证据、RFork 设备读取与 Planner 安全语义需要现场确认等限制没有被删除。这是信息保留复核，不将保留下来的每个旧断言都冒称已重新执行或实测。

追加三处局部验收：

| 文件与位置 | 原始证据 | 结果 |
|---|---|---|
| `wiki/sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md:99` | vllm 0fc695fc block_pool:419–441；先递减引用，再筛选 ref_cnt==0 且非 null | 引用计数未清零不能重新分配的条件保留，引用 C6 可追溯 |
| `wiki/sources/glm-5-3-flash-baseline.md:156` | db701c1f utils:905–931；仅初始化/refresh 分支内，初始赋值为假且 shared_expert_dp 参数真时覆写 | 不再依赖维护者的“本轮已核”；目标调用链实际传值仍缺证据，SP 关闭只作为条件性基线 |
| `wiki/params/enable-sleep-mode-extra-cleanup.md:129` | baa023ad ascend_config:261–292 与 platform:1318–1354 | 平台注入、RL 移除两种局部行为成立；相对于首次 allocator 构造的完整启动顺序及最终环境值仍未证明。当前句没有推成 main 必然触发或避开断言 |

## 新发现及复审闭环

**G06-I01，P3，已关闭：`rfork-lifecycle.md:400`。** 初稿把 TTL=60 的续期写成“每 20 秒发一次／客户端发起间隔”，容易理解为固定的请求开始周期。7d825229 session:181–188 实际先 wait(interval)，同步 renew 调用结束后才进入下一次 wait，因此开始间隔还包含调用耗时。已向写手和主代理提供最小修法；主代理将其改成先等、再调用、调用结束重新等。独立重读修订句及 session:149–188，说明与实现一致，关闭。

## 官方扩读、验证与限制

完整阅读本地固定 `921ccc52` 官方 `user_guide/feature_guide/rfork.md:1–239`，包括配置、身份、Planner、量化、传输契约、性能、命令和 caveats。指南 Overview 仍保留旧先申请后登记的顺序，Caveats 仍有随机端口概括，独立验收以同主题固定实现和指南细分段落交叉判断；没有把指南内部所有句子当成互相一致。旧官方阅读记录与本次固定文本扩读在来源页分开，未声称查看本次 flowchart 图像。

本轮执行的是固定 git 对象/指定行阅读、差异逐段比较及静态算例复算；没有新跑项目全量检查，也没有硬件、Planner 联调、TransferEngine 网络或浏览器验收。共享任务的全量测试结果由主代理汇总，不借写手的检查结果充当本次独立运行。未修改图或 3D，未做图像视觉通过声明。网页外链可达性及全部 raw 摘录语义不在本报告的验证范围内。

## 最终引用呈现增量复核

主代理随后仅整理了两页的引用呈现：`glm-5-3-flash-baseline.md:156` 将重复的 C25 角标改成“同上来源 25”（上一段 C25 仍在）；`rfork-startup.md:217/219/223` 将日志表三处角标改成“见来源 12/4/6”。已阅读实际增量及上下文，日志、触发条件、来源编号、版本范围和真实不确定性未改变。分别逆向还原这些精确替换后，字节哈希与本次前一版独立验收哈希完全一致，证明没有未登记的其他文本改动。两文件的最终哈希和替换记录已更新到同名 JSON 的 `incremental_reviews`；没有新增审查问题，审查者仍未修改教学页。此处不将主代理报告的 lint 结果写成审查者再次运行的结果。
