# 第 06 组：RFork、参数与来源页独立内容审查

2026-11-03；审查者 `/root/review_publication_fix`。本轮只写本报告和配套 JSON，没有修改教学页。

49 页均完成初读时的完整正文阅读；其中 43 页另做了本报告 JSON 所列主题的固定原始源码核对。**这不是 49 页所有事实已经逐条核实，也不是发布验收。** 六个来源/归档页主要完成内容与边界检查，没有重新验证其全部原始材料。正文初读后并发 rc2 更新继续修改文件，JSON 分别保存初读 SHA256 与报告时 SHA256；变化页仅复读了相关版本、入口、默认值段落，不把最终变化版本冒称整页重读。父任务整改后还需按最终差异验收。

已读 `docs/wiki-writing-standard.md`、`wiki/AGENTS-GUIDE.md`、`wiki/seeds/rfork.yaml`、`rfork/README.md`。本轮是纯文档审查，没有沿用代码任务的 Ponytail/ADHD 格式。未操作浏览器、未运行 NPU、未声称视觉或部署验收。

## 结论与整改项

未发现有证据支持的 P1。以下 P2 已即时通知主代理；应纳入本轮方案，而不是只加一段“rc2 对照”后保留互相矛盾的正文。

| 编号 | 级别与位置 | 影响及证据 | 修法 |
| --- | --- | --- | --- |
| G06-01 | P2，`wiki/concepts/rfork.md:187`、版本表 `319–327`；关联配置、身份、生命周期、传输、排障和官网来源页 | 泛称社区只有旧 6 文件、没有 Session/identity/manifest，遗漏 rc2 已有的新实现。新版不仅目录变了：Planner 要求、key、端口和重试都不同。具体源码见下表 | 保留工作版 `3284850b`，在总览和官方来源页建立独立 rc2 对照，关联页链接并突出会影响部署、日志与排错的差异 |
| G06-02 | P2，`wiki/params/prefetch-ratio.md:198`（初读时 205） | 自动表写 `additional_config["prefetch_ratio"]`，真实读取是 `weight_prefetch_config` 内部。`2c59ff10:ascend_config.py:718–720` 与 `ops/weight_prefetch.py:46–80`；照自动表复制到旧版会静默无效 | 改成完整嵌套路径，同时纠正扫描记录的身份，防止静态同步再覆盖回来 |
| G06-03 | P2，`wiki/params/layer-sharding.md:131–133` | 把 61 层除 16 卡的平均值当每卡实占和每卡接收量。源码 `2c59ff10:ops/layer_shard_linear.py:55–56` 按层号取模。沿用页面的单层 112 MiB、两窗口 224 MiB 假设，从层 0 起时 13 卡各 4 层、3 卡各 3 层，分别 672/560 MiB，而非每卡 651 MiB | 明确平均值和最高卡预算，通信量也按 57/58 个非本地层计算；不要把平均值称每卡硬预算。没有重核模型维度与量化实物，结论限于页面既有假设 |
| G06-04 | P2，`wiki/params/size-40a1c2ca47b8.md:89,105` | owner 仍写 `TP rank % size`，无法表达 rc2 的 PCP×TP 复制域。`7d825229:worker/worker.py:1144–1152` 用 `pcp_rank*TP+tp_rank`；`worker/kvpp_cache.py:30–35` 用 KVPP 组内 rank | 按版本列公式；旧快照机制可保留，rc2 不得继续套旧 owner 公式 |
| G06-05 | P2，`wiki/concepts/rfork-startup.md:80` | “从拿租约到读完才占名额”把传输完成当成 Planner 容量归还，与同页 90 行及后台释放冲突。工作版 `session.py:137–148` 只是启动后台归还；197–199 收到 RELEASED 才清 lease | 改成“读完不再读取来源字节；名额仍待 Planner 确认归还或回收”，保留不阻塞模型继续启动的结论 |
| G06-06 | P2，`wiki/params/stair-config-cca9e594a052.md:146,150,154` 及相关参数页 | 已有 rc2 pin 和运行时，却仍泛称“钉点没有、任何钉点起不来”，并在新默认 -1 后无范围地写默认搬运上限 1。`sfa-dcp-force-tmajor-restore:144`、`fused-op-type:108` 也有旧“只有 main/四个钉点都没有”残留 | 把旧范围变成显式历史小节；当前参数说明统一到 rc2 入口，旧算例仍保留自己的 pin。不要只让读者自行调和首段和后文 |
| G06-07 | P2，`wiki/concepts/rfork-transfer.md:392` 等 | 正式正文仍有“来源 14 已核、归档来源 20、本次只核……”等维护审计尾段；参数页也多处同类。它们不是用户要的教学解释 | 核完原始证据后，将有用的行为、适用条件、未实测范围融入正文；审查流水搬到 reviews。不能删掉不确定性后改成无依据的肯定 |
| G06-08 | P3，`wiki/params/enable-matmul-allreduce.md:102` | `bool(int(...))` 不是“只认 0/1”：合法非零整数也是真；`2c59ff10:envs.py:71` | 推荐使用 0/1，但把解析行为写准；`true` 字符串会报错的结论可留 |
| G06-09 | P3，`wiki/params/size-40a1c2ca47b8.md:133–152` | 通用单词 size 的几百文件命中、2025 引入记录与 KVPPConfig.size 无关；前文虽提醒不能按它判断，仍把无关历史展示给学习者 | 改为限定字段或定义身份的谱系；无法定位时不展示无关谱系 |

审查期间并发改动已经修正：`fuse-allreduce-rms` 的 rc2 嵌套键/Omni 误说；combine、force-EPLB、embedding 等若干 main-only 范围；部分 STAIR 谱系与新默认说明；KVPP 新图模式与固定 MTP/DSpark 边界。上述改动按最新段落复核，不重复要求恢复旧文本。JSON 中 G06-10/11 标记为已改或部分已改。

维护审计噪声的初读位置还包括：`rfork.md:389`、`rfork-config.md:425–427`、`rfork-layout.md:261`、`rfork-lifecycle.md:416`、`rfork-troubleshooting.md:426–428`、`rfork-official-guide.md:143`，以及参数页 `kvpp-config:176`、`use-layerwise:179`、`sfa-dcp-force-tmajor-restore:238–240`、`stair-config:181` 等。并发更新会移动行号，整改以对应文字定位。`rfork-maintenance` 的版本维护说明、来源页的证据边界本来就是主题，不能按关键词整段删掉。

## RFork 可直接落地的新版本说明

工作版仍固定 `rfork@3284850b`；社区 rc2 固定 `vllm-ascend@7d825229`。**这是两份实现的对照，不能把社区升级自动写成用户工作版已升级。** 所有路径下文均相对 `vllm_ascend/model_loader/rfork/`。

| 主题 | 工作版与 rc2 的差异 | rc2 原始证据 |
| --- | --- | --- |
| 会话与入口 | rc2 已有独立 Session、identity、manifest 等 13 文件。`--load-format rfork` 注册到 RForkModelLoader，从 model-loader-extra-config 建配置；不能继续泛称社区没有这些类 | `rfork_loader.py:471–475,498–524`；目录树实查 |
| 匹配 key | rc2 配置指纹涵盖协议、模型标识、解析后的 revision、量化配置摘要、架构、RoPE、KV 角色、mix placement；另加可传张量名字、shape、dtype、NPU format 的结构摘要，再结合 TP/PP/EP、主草角色及条件性 DP 分片位置。不是权重内容 checksum | `identity.py:219–339`；`tensor_layout.py:42–61` |
| DP 身份 | fine-grained TP 或 MoE 且 DP>1 时把 data_parallel_rank 纳入 `sharded_dp_rank`；普通复制 DP 保持空。不能把“DP 永远复制、不进 key”泛化到 rc2。调用者实际传入该结果 | `identity.py:257–293`；`rfork_loader.py:514–522` |
| 启动顺序 | rc2 先构建/转换布局，再登记目的缓冲和绑定结构摘要，之后才拿租约，再取元数据/读权重。工作版先布局，再拿租约，之后才登记；旧十步图不能原样称 rc2 流程 | `rfork_loader.py:630–682`；`session.py:100–160,208–248` |
| 清单 | rc2 只接受完整五元组，还要求按名称覆盖的 NPU format 清单并逐项比对格式；旧工作版对 tuple/mapping、单独 shape 接口的兼容说明不能泛化。仍不是逐字节内容验证 | `manifest.py:64–76,87–214`；`types.py:101–106` |
| seed HTTP 端口 | 非零 base 时主模型 `base+2*global_rank`，草稿再加 1；超范围或指定端口不可用可回动态端口。工作版同 rank 主草没有这一分槽公式 | `session.py:44–51,527–554` |
| TransferEngine 端口 | rc2 向引擎传 port 0，由引擎绑定并持有，再调用 `get_rpc_port()` 得实际端口；缺 API 会失败。与 HTTP seed 端口是两回事 | `transfer_backend.py:224–269` |
| Planner 协议与续期 | rc2 的 get_seed **强制要求**返回有限正数 `LEASE_TTL_SEC`，缺失会被当作获取失败。成功后启动续期线程，每 `clamp(TTL/3,0.1,30)` 秒向 `/renew_seed_lease` 发请求。不是工作版的提案，也不是可选能力探测；续期失败会记录警告，现有循环没有凭此证明读取被及时停止 | `planner_client.py:117–167,218–245`；`session.py:149–188` |
| 释放租约 | rc2 暂态失败在默认 3 次快重试之后，按至少 60 秒间隔继续；永久 REJECTED 仍停并压制 seed 发布。读后后台释放不阻塞推理；尚未归还时延后发布。工作版达到 3 次就停止 | `session.py:261–364,495–504`；工作版 `session.py:170–214` |

建议总览保留简短差异表，配置页突出新 Planner 要求和端口，身份页讲结构摘要/DP，启动页说明登记先后，生命周期和排障页讲续期及重试。其余章节用链接复用，避免把九项细节抄到每页。不要把“有新校验”写成“保证任何模型兼容”；NPU格式、共享存储、依赖 API 和实际输出仍需现场证据。

## 官方扩展阅读与证据边界

以下六份材料均完整读了文本、命令与表格；图像没有视觉验收，所有 SHA256 在 JSON：

1. `921ccc52` 官方 `user_guide/feature_guide/rfork.md`，239 行：配置、身份、端口、布局、日志与重试。它的简化流程与源码仍有顺序差别，也没有充分解释 rc2 必需的 TTL/续期协议，不能只转述这篇指南。
2. `3284850b` 工作版对应 RFork feature guide，385 行：工作版启动/清理、共享、有限重试与部署要求。
3. 同工作版 `developer_guide/Design_Documents/rfork_lease_lifecycle.md`，206 行：续期只是提案、现场 400 证据边界、晚拿租约和异步释放；不能拿提案说明 rc2 没有实现。
4. `921ccc52` 官方 KVPP user guide，235 行：eager/PIECEWISE、各种组合、容量/TTFT/吞吐数据、Memcache/Mooncake与MultiConnector。新官方已出现 Eagle3/MultiConnector 等比 rc2 更多内容；不能反向写进 rc2。rc2校验已按实际源码核对。
5. `921ccc52` MRV2 EPLB architecture，211 行：控制、数据和迁移路径，HIXL/Gloo一致性，异步提交、支持条件与日志；STAIR真实 controller/factory、十项参数消费另按 rc2 源码核对。
6. `921ccc52` Layerwise and Sparse KV Cache Offloading guide，181 行：PD、P/D连接器组合、主机池、BF16主KV/INT8索引、缓冲与端口。该组合指南不能替代所有存储后端的独立支持边界。

源码核查不是只扫字段：STAIR追到 MRV2 controller→factory→规划器、传输限制自动收紧；旧预取追到配置对象→比例→实际预取请求；RFork追到 loader→session→Planner/manifest/TransferEngine；KVPP追到分层与分配；sleep、super kernel、词表PCP、force-EPLB、combine和layerwise也读了消费代码。逐页范围在 JSON。没有复跑外部仓库单测、真实部署或性能测试。

## 逐页覆盖

下表由配套 JSON 生成；“变化”表示完整初读后文件被并发更新，不能将该行初读等同于报告时整页验收。

| # | Page | Full initial read | Original evidence topics | Initial SHA256 | Concurrent change |
| --- | --- | --- | ---: | --- | --- |
| 1 | `wiki/params/absolute-balance-threshold-71578a0c428d.md` | yes | 5 | `8fa7ded384fb` | yes |
| 2 | `wiki/sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md` | yes | 0 | `23e90dd4fafe` | no |
| 3 | `wiki/sources/ascend-config-version-source.md` | yes | 0 | `c3dd85d09d61` | no |
| 4 | `wiki/params/block-table-no-commit-optimize-8328d0d2d00d.md` | yes | 1 | `560e6161c279` | yes |
| 5 | `wiki/params/c8-enable-reshape-optim-8bd7e5f82c6c.md` | yes | 1 | `bbd9d2066fbc` | yes |
| 6 | `wiki/params/combine-quant-mode-2a3f7cd47997.md` | yes | 1 | `9efa6498b1f4` | yes |
| 7 | `wiki/params/cross-node-transfer-limit-06ee92260b7a.md` | yes | 5 | `7295b2103788` | yes |
| 8 | `wiki/params/enable-async-exponential.md` | yes | 2 | `34096bbcdae4` | yes |
| 9 | `wiki/params/enable-force-eplb-b7ec3661121f.md` | yes | 2 | `0a4c3c072ee6` | yes |
| 10 | `wiki/params/enable-matmul-allreduce.md` | yes | 1 | `805d764ddfa7` | yes |
| 11 | `wiki/params/enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9.md` | yes | 1 | `c094b9a56fc3` | yes |
| 12 | `wiki/params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md` | yes | 2 | `2d7ca221fe2d` | yes |
| 13 | `wiki/params/enable-sleep-mode-extra-cleanup.md` | yes | 1 | `974746c6c5c7` | yes |
| 14 | `wiki/params/enable-super-kernel-ce990e186bfa.md` | yes | 2 | `9623d908df63` | yes |
| 15 | `wiki/params/fuse-allreduce-rms.md` | yes | 2 | `01891c158e34` | yes |
| 16 | `wiki/params/fused-op-type-fc0f5fcd7be0.md` | yes | 1 | `7b9c37bb16ae` | yes |
| 17 | `wiki/sources/glm-5-3-flash-baseline.md` | yes | 0 | `b0a82840f665` | no |
| 18 | `wiki/sources/glm-mlp-version-source.md` | yes | 0 | `1bee92b8ab09` | no |
| 19 | `wiki/params/kvpp-config-0445bd352140.md` | yes | 3 | `edba28f43497` | yes |
| 20 | `wiki/params/layer-sharding.md` | yes | 1 | `169abfd9814d` | yes |
| 21 | `wiki/params/load-risk-quantile-d89a080ba048.md` | yes | 5 | `c0f00c16a540` | yes |
| 22 | `wiki/params/load-window-bins-cc21068b082d.md` | yes | 5 | `9f373b4e89fa` | yes |
| 23 | `wiki/params/multistream-overlap-gate.md` | yes | 1 | `13cd23ed78dd` | yes |
| 24 | `wiki/params/placement-search-backtrack-limit-82b03cef98b0.md` | yes | 5 | `9718f53bd0b6` | yes |
| 25 | `wiki/sources/pr-11953.md` | yes | 0 | `2b28dc75e164` | no |
| 26 | `wiki/params/prefetch-ratio.md` | yes | 2 | `486b879eca61` | yes |
| 27 | `wiki/params/profiling-chunk-config.md` | yes | 3 | `15bca47e2858` | yes |
| 28 | `wiki/params/rank-transfer-limit-99529b37d91d.md` | yes | 5 | `bf8030c0a12b` | yes |
| 29 | `wiki/params/relative-balance-threshold-bcbc40e7dc87.md` | yes | 5 | `b4d7d4e24950` | yes |
| 30 | `wiki/params/replica-search-beam-size-6556d1650a62.md` | yes | 5 | `166f57be5b2a` | yes |
| 31 | `wiki/params/replica-search-num-stages-e4b10925ff97.md` | yes | 5 | `6444e8ef4850` | yes |
| 32 | `wiki/params/replica-search-radius-cd3118b5aae5.md` | yes | 5 | `bd566b721870` | yes |
| 33 | `wiki/concepts/rfork.md` | yes | 9 | `3156ed251b2a` | no |
| 34 | `wiki/concepts/rfork-config.md` | yes | 9 | `f943bb1b8a31` | no |
| 35 | `wiki/concepts/rfork-identity.md` | yes | 9 | `92f9540eaa1b` | no |
| 36 | `wiki/concepts/rfork-layout.md` | yes | 4 | `27cdcb9c5f03` | no |
| 37 | `wiki/concepts/rfork-lifecycle.md` | yes | 9 | `86a11eba3838` | no |
| 38 | `wiki/concepts/rfork-maintenance.md` | yes | 4 | `32a7347daab9` | no |
| 39 | `wiki/sources/rfork-official-guide.md` | yes | 9 | `fa2473e2a544` | no |
| 40 | `wiki/concepts/rfork-startup.md` | yes | 9 | `340655b8aff5` | no |
| 41 | `wiki/concepts/rfork-transfer.md` | yes | 4 | `2ac2dd2aea93` | no |
| 42 | `wiki/concepts/rfork-troubleshooting.md` | yes | 9 | `935f71fbefee` | no |
| 43 | `wiki/params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md` | yes | 1 | `9cc7c4be2117` | yes |
| 44 | `wiki/params/size-40a1c2ca47b8.md` | yes | 4 | `8babed97f827` | yes |
| 45 | `wiki/params/stair-config-cca9e594a052.md` | yes | 5 | `c78716f87b58` | yes |
| 46 | `wiki/params/use-fused-overlap-75a180fff6ab.md` | yes | 1 | `c15736c5f259` | yes |
| 47 | `wiki/params/use-layerwise-b475778cd352.md` | yes | 2 | `649ef9e2c67c` | yes |
| 48 | `wiki/sources/v030rc2-baseline.md` | yes | 0 | `cb62bdc88b8c` | no |
| 49 | `wiki/params/weight-prefetch-config.md` | yes | 2 | `c59755e316e9` | yes |
