# 2026-11-10 收尾增量独立复核

本次是旧工作的收尾复核，不计入随后额外 200 项。审查者独立读取实际页面、定点源码和本轮 diff；没有委派其他审查者，没有修改正式页面或实现代码。**首轮增量独立发现 1 项 P1、4 项 P2；第二轮限定文档差量另发现 3 项 P2、1 项 P3；最后分离部署差量另发现 1 项 P2。以上均已由写手修订并复审关闭，限定范围内无未关闭发现。** 结论只覆盖下列实际审查范围，不代表全站、整组历史来源或设备实测已经通过。

## 范围与方法

- 基线是 `.tmp/closeout-2026-11-10/before/`，不是 Git HEAD。工作区已有大量无关改动，本次未将它们混入审查。
- 页面：api-server-entry、engine-processes、request-call-chain、vllm-v1-shape、npu-model-runner、npu-worker-lifecycle、vllm-engine-core、structured-output、prepare-inputs-flow；另核对主线底稿 `docs/mainline/01-deploy-entry-schedule.md` 的单步输出修订。读取这些页的开篇、职责及代价说明、全部本轮改动段落与相关上下文；没有宣称这些页面的全部历史来源已重新验收。
- 图：读取 `npu-model-runner-code-flow.yaml` 与本轮 diff；独立查看主代理实际浏览器生成的 `test-results/figshots/npu-model-runner-2.png`。图中文字、分支与源码一起核对；没有以生成成功代替事实判断。
- 代码：审查参数生成、巡检调用链、已有草稿入口和谱系发布入口。`sync-cli.test.ts` 的 before 备份遗漏，故该文件仅按主代理明确的本轮区段（首测试 written 3→1、两正式页保留断言、待审队列 skipped 断言）审查，不归因其余已有代码。
- 20 个参数页只检查此次自动定义/谱系恢复、正文保留与两个 suspect 字段的标识。size 页有一处独立正文纠错，另作定点核对。附带检查 graph-mode-layer 的三行反向 relation 删除，以及主代理沿 CR-01 补修的 streaming-output L197 单段 diff，没有扩大到这两页的全部正文。

已读 `AGENTS.md`、`docs/wiki-writing-standard.md`、`wiki/AGENTS-GUIDE.md`。代码阶段采用 Ponytail full 和 i-have-adhd；本文按文档审查需要保留依据、边界和说明。历史两份审查报告只用于定位，本节以下结论均另读了固定 Git 原文。

## 独立发现与修订状态

### CR-01 · P1 · 相邻页仍将引擎输入绝对化为编号

- 位置：`wiki/concepts/api-server-entry.md:243`；相邻职责表 `wiki/concepts/npu-model-runner.md:150`。
- 发现：前者原句“引擎只认编号”“没有编号就无从算起”，后者“不碰张量和模型”，会让读者把职责边界理解成消息类型限制，与已修的 V1 架构页冲突。
- 依据：实际读取 `vllm@0fc695fc:vllm/v1/engine/__init__.py#L83-L128`：prompt_token_ids 可为 None，L98 有 prompt_embeds 张量；同文件 L170–182 有 pooling_output 张量；`vllm/v1/core/sched/output.py#L31-L64` 将 prompt_embeds 放入 NewRequestData。
- 建议：纯文本例子就地限定输入路径；职责表说明谁执行模型计算，不以是否出现张量对象划界。
- 复审：最新 api-server-entry L243 已限定“本页的纯文本路径”，并解释预先算好的嵌入向量；runner L150 改为不执行模型前向或张量计算。主代理另发现并修正 streaming-output L197 的同类原句，本审查已读取其 before/current 单段 diff：文本生成路径与预计算 embedding 边界区分明确，原回程链接和说明保留。三处与 V1 架构页一致。**已关闭。**

### CR-02 · P2 · 纯行号迁移没有完整进入待审队列

- 位置：`scripts/wiki/params/publish-sync.ts` 的待审 change 对象，当前 L181–190。
- 发现：新增钉点保护会正确跳过正式页，但队列此前只有 added/removed/changed，没有 relocated。字段只改位置时，队列只剩 name、file 和 outside-teaching-pin，旧、新行号及参数条目丢失。
- 复现：隔离 Git fixture 中 ExampleConfig.limit 保持默认 1，只在文件开头加空行，位置 L2→L3；教学 pin 不变，巡检 after 为新提交。实调 publishParamSync 返回 written=0；修前队列三个变更数组均空，relocated 缺失。
- 建议：将 diff.relocated 和其他差异一起持久化，并断言正式页字节不变、待审记录保留 L2→L3。
- 复审：现有 change 已含 relocated；新增回归覆盖上述复现。独立执行 `pnpm exec vitest run scripts/wiki/params/publish-sync.test.ts -t 'retains a patrol-only line relocation' --reporter=dot`，1 passed、5 skipped。**已关闭。**

### CR-03 · P2 · 加载回退差异漏列 rc2

- 位置：`wiki/concepts/npu-worker-lifecycle.md` 的版本差异段，当前 L322、L345。
- 发现：本轮新增 pt 回退和远端索引条件说明只列 v0.23/v0.26/main，已有 rc2 段没有回答这一差异，不满足四版差异要求。
- 依据：实际读取 `vllm@ced6857a:vllm/model_executor/model_loader/default_loader.py#L180-L233`，L188 要求 fall_back_to_pt 且未选 safetensors；L223 要求远端且权重文件数大于 1 才下载索引。这两处与固定 main 84030bbe 相同。
- 建议：rc2 段明确这两项与固定 main 相同，增加直接来源。
- 复审：L91 新增固定来源 L186–230，L322 已明确 rc2 行为。**已关闭。**

### CR-04 · P2 · 谱系刷新仍能绕过教学钉点

- 位置：`scripts/wiki-lineage.ts` 的默认 refs 选择；调用方 `scripts/wiki-lineage-apply.ts`，发布函数 `scripts/wiki/lineage-publish.ts`。
- 发现：apply 带 --page 调用 lineage CLI，但后者默认用 lineageRefs 查远端分支 tip，再把结果写进正式页。单独修 publishParamSync 和 build-param-pages 不能挡住这个入口。
- 复现：隔离 fixture 的教学 pin `6ba43f39` 有 ExampleConfig.limit，origin/main 的 tip `d20fb903` 删除它，seeds.refs.main 仍指旧 pin。执行 `wiki-lineage-apply --seeds seeds.yaml` 退出 0，正式页谱系变为 `main | 无 | d20fb903`，而自动定义仍是教学 pin。复现不依赖真实上游或正式 wiki 写入。
- 影响：刚恢复到 rc2/固定 main 的版本表可再次被浮动巡检状态覆盖，形成同页两套版本前提。
- 建议：用于页面发布的谱系必须取教学 seeds 的固定提交并保留版本标签；不带页面的历史查询可以保留选取分支能力。用上述删除字段场景加回归。
- 复审：`wiki-lineage.ts` 带 --page 且没有显式 --refs 时改取 Object.entries(repo.refs) 的固定提交，再把 presence 标签映射回 seeds 的版本名；apply 调用链不传 --refs，因此使用此受保护路径。不带页面的查询保留原行为。独立检查新增 fixture 后执行 `pnpm exec vitest run scripts/wiki/lineage-cli.test.ts -t 'publishes lineage at teaching pins' --reporter=dot`，1 passed、1 skipped；正式页使用教学 pin 并保持字段存在，而非删字段后的 origin/main。**已关闭。**

### CR-05 · P2 · size 的布尔转换说明缺少 helper 引用范围

- 位置：`wiki/params/size-40a1c2ca47b8.md:138`，sources 第 2 项。
- 发现：正文改为“Pydantic 布尔转换”是正确的；但原 sources 第 2 项从 L60 起，只覆盖调用点，不含执行转换的 helper。
- 依据：实际读取 `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L52-L57`，调用 TypeAdapter(bool).validate_python；rc2 7d825229 的同实现是 L54–59。
- 建议：将该页第 2 项来源扩为 L52–77，保留直接调用与 helper 的证据链。
- 复审：sources 第 2 项已扩至 baa023ad 的 L52–77，覆盖 helper 和调用方。**已关闭。**

## 本轮已核实的修订与信息保留

| 改动 | 独立核对的直接证据与结论 |
| --- | --- |
| API ID、日志等级、输入预算引用 | 0fc695fc engine/serving.py L387–396 与 chat_completion/serving.py L250–258 证明 header→request.request_id→随机的顺序；engine/protocol.py L35–57 确为 debug；renderers/params.py L188–193 的减法已被扩展来源覆盖。 |
| 执行器基类名 | 0fc695fc v1/executor/abstract.py L37–87 的基类是 Executor，直接类型和导入字符串两条路径都按它检查。 |
| Worker 日志与 profiler | db701c1f worker.py L599–667 有 msmonitor 计步和 profiler.step，没有本轮删去的 log_memory_stats；固定单 PP stage 的解释保留。 |
| EngineCore 消息类型 | 预嵌入、池化张量和多模态字段可通过消息携带。正文改成职责分工，保留纯文本 R1 的编号/块号轻量示例，没有将模型权重移动到调度侧。 |
| 零 token、PP 分支及回传卡 | db701c1f model_runner_v1.py L2027–2042、L2306–2397 分别覆盖 external_launcher+DP dummy、KV no-forward、输出广播及无执行状态的采样协作。0fc695fc multiproc_executor.py L495–509 与 L969–995 证明 output_rank 在发送侧过滤。本部署 8 卡执行，仅指定 0 号卡发结果。 |
| 异步草稿过滤 | 0fc695fc core.py L505–596 先发 execute_model，再取草稿/过滤/填 mask；scheduler.py L1745–1795 过滤后按原长度补 −1。修订正确区分同步提前截短与异步不省已派发前向，保留“接受率没有实测”。 |
| 单步输出与 SSE | 0fc695fc output_processor.py L45–100 的 collector 合并 DELTA。三处页面与主线 A7 均保留每个 decode 步 1–4 token 的计算，移除把它当流式片段上限的推论。原来的 R1 1、2、4/总计 7 token 和收尾块数解释没有删掉。 |
| 恢复请求的块表 | 0fc695fc gpu_model_runner.py L1282–1382，L1368–1379 明确持续请求追加、resumed 请求替换。两处“只追加”的绝对化已改，A/C 的位置、槽位、边界与选行算例保留。 |
| 加载回退与后台预读 | 0fc695fc default_loader.py L97–209、568afb3a/84030bbe L128–242 与 rc2 片段支持分版说明；0fc695fc weight_utils.py L801–892 确认后台线程启动、rank 分片读取，未误改为主线程同步等待。 |
| 异步默认与模型名 | 0fc695fc config/vllm.py L931–1002 与 84030bbe L1332–1394 支持 draft_model/dspark 自动默认差异；固定教程 0576b647 L269–286、L318–335 两端均为 served-model-name glm，示例 model 已同步。 |

对照本轮 before diff，纠错删除的是错误的绝对判断或错误推论，没有删去数值算例、代价、反例或真实待核项。此结论仅覆盖本轮改动段落，不是对全页每条历史结论的重新认证。

20 个参数页的自动定义现均指 `releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450`。逐页去除自动定义与谱系后比较，19 页教学正文逐字相同；size 页只改布尔转换一句，相关 1、TP×PCP、层分配与容量推导都保留。suspect 的 KVPPConfig.size 与 AscendConfig.kvpp_config 现在显示“字段身份（不代表用户输入入口）”，不把静态字段身份冒写成可直接输入的 JSON 路径。谱系删去的是浮动巡检的分支全集，改为 seeds 指定四版，不是把那些浮动分支算作已核教学支持。

graph-mode-layer 只删对 npugraph-ex 的反向 builds-on 三行；npugraph-ex→graph-mode-layer 的依赖和 graph-mode-layer 正文中指向融合说明的链接都仍在。

## 图与验证边界

实际查看的流程图仍为左右两次调用，先后顺序没有被文字修订打乱；零 token、PP 未开输出广播、无执行状态和 0 号卡回传的文字完整可读，没有发现截断或重叠。YAML 画布仍是 900×640，布局和原有解释未删。本审查者查看的是本轮浏览器产出的真实截图，没有另开共享浏览器、操作全页链接或启动服务；桌面浏览器全页交互验收由主代理负责。

本次未做 NPU 推理，不把源码分支当成设备实测；未联网验证全部历史外链，未通读本组所有 sources，未声称全站审计通过。代码 fixture 使用临时本地 Git 仓库并在完成后清理，没有 fetch 上游、调用付费模型或改正式页。主代理的全站 lint、类型检查、构建等结果应在最终交付单独列明，不冒充本审查者执行的结果。

## 第二轮：缓存组及最后文档差量

本节只追加主代理明确提交的文档修订：`.tmp/closeout-2026-11-10/final-doc-fixes.py` 的七个文件、随后补齐的图框与来源，以及 `.tmp/closeout-2026-11-10/style-fixes.py` 的五句措辞。另按 `.tmp/wiki-evidence-resume-2026-11-08/baseline/` 比较 prefix-caching、recompute-cpu-offload、kv-cache-spec 三项旧缓存组重点修订及相关图；这里的 spec 是 kv-cache-spec，不是 speculative-decoding。历史 `cache-budget-citations.md` 仅用于定位，未把其来源数或“已读”记录改称全部已判定支持。文档阶段未沿用代码技能。

### 补轮发现与关闭证据

**CR-06 · P2 · 重算图仍混淆归还块号与覆盖数据的时点。** `wiki/diagrams/recompute-cpu-offload.yaml` 的第 ② 框原写“先拷到主机，再让块”，与新正文“调度器先归还逻辑块号，worker 先保存旧内容再覆盖”矛盾。直接读取 `vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L297-L345`：先登记换出，再调用抢占；`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L993` 在抢占中释放块；Ascend 同 pin 的 `distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L134-L175` 在新请求清零或前向前同步保存旧内容。建议只修时序措辞，保留 A 的 9 个位置、3 块及搬运路线。图框现为“先保存旧内容，再覆写”，新浏览器截图中的图框与图注一致，数字未变。**已关闭。**

**CR-07 · P2 · 新增 waiting 首次查缓存条件缺少直接调度器来源。** `wiki/diagrams/block-allocation-flow.yaml` 原有 manager 来源只能证明查缓存函数行为，不能证明只在 waiting 中已算数为 0 时调用。直接读取 `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L560-L612`，waiting 循环及 L609–612 的条件和调用均在。建议图 pins 与承载页补齐这一来源。现图 pins 和 `wiki/concepts/vllm-kv-block-allocation.md` 第 41 项均为固定 `scheduler.py#L562-L613`，包含完整条件及调用。**已关闭。**

**CR-08 · P2 · 扣除 null block 后的并发容量结论缺少“不共享”前提。** `wiki/concepts/recompute-cpu-offload.md:178` 引出的 16,383÷8,192 算例此前断言第二条必须再借 8,192 块，未限定它不命中已有主机块。直接读取 `db701c1f` 的 `recompute_cpu_offload/manager.py#L275-L333`：只为无哈希块及缺失哈希申请新块（L283–299），已有或同一步待保存的块可以共用（L323–330）。存在共享时，第二条新增需求可能小于 8,192，因此“只能一条”应限定到不共享算例。主代理已在 L178 增加“并假设请求之间没有命中可共享的主机块”；L226 的长请求结论明确引用上一节算例，沿用此前提。16,384−1=16,383、65,532 个位置、单条 8,192 块、余下 8,191 块等数字均保留；L249–255 的满足条件时共用块示例也保留。**已关闭。**

**CR-09 · P3 · block 图图注有重复连接词。** 修订中出现“随后然后”，不影响源码结论但妨碍连续阅读。现图注已改为“随后”，在本轮浏览器截图中核实。**已关闭。**

### 已复核的事实差量

| 差量 | 实际核对的固定原文与结论 |
| --- | --- |
| profile 的 3.4 GiB 与汇总日志 | `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L563-L597` 分开得到 torch 峰值增量、非 torch 增量，并与权重合计；L717–758 汇总输出这些项及图内存。正文现明确 3.4 GiB 是激活峰值与非 torch 增量的合计教学假设；“汇总入口”不再排除其他实际观测途径。未改原计算数值。 |
| KVPP 的版本、owner 等待和字节条件 | eager 限制限定到固定 main `baa023ad`，不覆盖 rc2 的 PIECEWISE 分支。实际读取 `baa023ad:vllm_ascend/distributed/kvpp.py#L1-L36`，异步广播任务等待也保护 owner 源数据的读取；同 pin 的 `core/kv_cache_placement.py#L18-L56` 与 `worker/kvpp_cache.py#L30-L57` 说明常驻和双 scratch 的容量成本。正文不再断言开启 KVPP 后块数只会增加，改为“若实际块数增加，广播字节随之增加”。 |
| prefix 的 all / align 和保留成本 | `vllm@0fc695fc:vllm/config/cache.py#L133-L141` 区分每个块边界与对齐调度步终点；`vllm/v1/core/single_type_kv_cache_manager.py#L1018-L1046`、L1121–1230 包含旧状态释放、null 占位及当前状态/候选槽复用。0→7,680 一次切分不等于自动留下 640、1,280 等内部边界，正文已正确区分；旧“每经过一块就永久增加一份状态”的成本推论已撤去。`block_pool.py#L402-L441` 则支持命中空闲队列块占用空闲容量、命中活跃共享块只增引用的区分。 |
| prefix 的版本限定和图中块号 | 完整物理块规则现就地限定 `0fc695fc`，后续版本部分尾块引用块分配页的版本差异，本次没有借此认可未复核的后续所有规则。图中 0/1 明确为示意逻辑编号，与 `block_pool.py#L149-L177` 保留物理 null block 0 不再混淆；共享份数与尾块示例保留。 |
| recompute 的 null block 扣减 | `db701c1f` 的 `recompute_cpu_offload/manager.py#L63-L156` 派生主机块数并建立同类块池，`vllm@0fc695fc:block_pool.py#L149-L177` 从初始空闲队列取出一个保留块。16,384→16,383、128→127 的扣减成立。GLM 量级算例仍是 120–121≤127、只装一条的条件对照；没有改写为设备验证，也没有删掉混合缓存恢复正确性尚未验证的边界。 |
| kv-cache-spec 的公式边界和启动顺序 | `vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L159-L200` 有 NVFP4 打包宽度与额外 scale，L353–384 有 `fp8_ds_mla` 特殊布局。普通注意力和 MLA 的简式现在有明确布局前提。`engine/core.py#L235-L270` 先取得规格、再测可用显存、再建立配置，正文/流程图已一致。`db701c1f:patch/platform/patch_kv_cache_utils.py#L459-L548` 按最长连续 KDA 段分组；文字“四组”改为“五个组的三种块长”，与页面保留的 full 1、尾状态 1、KDA 3 组说明一致。本项只复核改动和分组逻辑，未重做模型配置全部数值来源的验收。 |
| block 分配的先后顺序 | `vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L354-L406` 先执行启用时的 full_sequence_must_fit 整段准入，再归还 skipped blocks、计算本步新分配量。图的新增条件及 waiting/running 区别与调用点一致；新增 manager 来源始于 L354，未继续漏掉前置条件。 |
| RL 来源越界 | 实际读取 `vllm@84030bbe:vllm/entrypoints/scale_out/factories.py#L66-L102`，函数至文件末 L102。原 L69–106 改为 L66–102，覆盖注册路由主体，越界已消除；本次仅判定这一来源修订，不认证 RL 全页。 |

五句样式修订已逐句读上下文：ascend-patch-system 仍要求检查导入后的条件、派生类覆盖与入口是否被 patch 改动，未把“可能执行”改成“必然执行”；graph-mode-layer 只明确补齐行占用计算，未移除“有时降低回退成本、有时计算更多”的取舍。其他教学算例、适用条件与待核说明未因这轮措辞修订被删。

### 补轮图片与未验证范围

独立查看四张本轮真实浏览器截图：`test-results/figshots/recompute-cpu-offload-1.png`、`test-results/figshots/vllm-kv-block-allocation-2.png`、`.tmp/closeout-2026-11-10/browser/prefix-caching.png`、`.tmp/closeout-2026-11-10/browser/kv-cache-spec-flow.png`。已核对本轮改动文字及对应箭头、流程顺序；四张图没有发现截断、重叠或图文冲突。prefix 图保留两请求共用两块与各自尾块；spec 图明确“报规格→量显存→两档页/5 组→按预算算块数”，未移除后续每请求站点。

截至本节，补轮限定差量无未关闭发现。本审查没有把旧缓存组 397 条来源统称为支持、没有补认历史未判断项，没有运行 GLM 混合缓存 offload 或 NPU 实测，也没有把主代理的全站 lint / audit 结果记为自己的执行结果。其余重绘图片和无关修改不在本节验收范围。

## 第三轮：分离部署遗留修订、投机说明与量化图

本节仅审 `.tmp/closeout-2026-11-10/last-diffs/` 的七页精确差量（kv-pool、pd-disaggregation、ucm、large-scale-ep、recompute-scheduler、ops-and-kernels、speculative-decoding），PD 图的成功/失败与 N>1 修订，以及量化直觉图输出矩阵改为 4×6。基线仍为本轮 before；没有借此接管分离部署整组 416 条来源或七页全部历史正文。`disaggregation-execution-citations.md` 列出的八项 P2 作为待闭合清单，以下另读原始证据。

### CR-10 · P2 · 卷积宽度的新增源码来源只证明默认值

`wiki/concepts/ops-and-kernels.md` 的短卷积说明保持 GLM 宽度 4，但新增第 42 项 `db701c1f:vllm_ascend/models/glm5_next.py#L199-L213` 在 `linear_attn_config` 存在时直接返回它，不能单独证明本部署最终采用默认值 4。建议保留数字、补实际模型的固定配置。独立通过官方固定下载地址读取 `GLM-5.3-Flash@690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json`，L126 为 `linear_attn_config`，L130 明确 `short_conv_kernel_size: 4`；现页面 L73 的第 43 项已加入该配置 L126–132，与 resolver 构成直接证据链。**已关闭。**

### 旧八项 P2 的限定关闭核对

| 旧发现 | 本轮独立读取与修订结论 |
| --- | --- |
| KV Pool 同步加载失败边界 | `db701c1f:distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L838-L874`：返回失败或 None 时，单组更新 invalid blocks，多组记录错误并跳过该回退。正文与常见误解均已区分单组/多组，没有继续保证多组必然由默认策略结束；第 13 项来源也已扩至 L874。 |
| PD 混合模型重算策略限制 | `db701c1f:vllm_ascend/platform.py#L892-L900` 明确拒绝 hybrid+recompute；`vllm@0fc695fc:vllm/config/kv_transfer.py#L70-L73` 给出默认 fail。两处修改均限定“模型与平台允许时”，并明确本页固定 GLM 不能采用此退路，新增直接来源。 |
| UCM 的启动与测试配置缺口 | 亲读 `db701c1f:docs/source/user_guide/feature_guide/ucm_deployment.md` 的启动命令 L553–569、L673–689 及测试 L755–885：启动上限 17,000 与 32,000/64,000/128,000 输入加 1,000 输出不相容。新段落保留官方数表、明确缺少测试时的配置调整，不猜改上限，也不再把示例当成完整复现配方。附带 align 修订与第二轮已核源码一致。 |
| 稠密模型的外置 DP 拒绝条件 | `vllm@0fc695fc:vllm/engine/arg_utils.py#L1859-L1882` 同时要求 DP>1、外置分派、非 MoE 才抛该 ValueError；“显式开关或指定 rank”来源于 L1859–1861。新文字补齐条件，错误消息保留。 |
| DeepSeek-R1 配置浮动来源 | 独立打开官方 [固定配置](https://huggingface.co/deepseek-ai/DeepSeek-R1/blob/56d4cbbb4d29f4355bab4b9a39ccb717a14ad5ad/config.json)，确认 routed experts 256、每 token 选 8；第 27 项已从 main 改为此 revision，正文数值未删改。 |
| PR #10742 被当成源码证据 | 网页读取失败后，独立通过 GitHub 官方 API 读到 [PR #10742](https://github.com/vllm-project/vllm-ascend/pull/10742) 的 body 和 merge SHA。新段落改为作者对当时实现的设计说明，C40→S40，并删除未经本审查确认的分支祖先/内容全同断言；没有将作者对 OOM、工具调用与精度的说明升级为所有版本必然行为。 |
| PD 图失败后仍直接进入前向 | 亲读 `db701c1f:mooncake_connector.py#L720-L755`，失败也发释放信号；`0fc695fc:scheduler.py#L2154-L2186` 区分失败与成功接收后的处理。新图只将成功标为进入最后位置计算，另写默认失败结束、重算有条件。N>1 条件又由 `db701c1f:mooncake_connector.py#L1751-L1775` 直接核对；不据此宣称 N=1 的混合状态恢复已实测正确。 |
| ops 常量、旧版文件范围和登记表 | `_KDA_CHUNK_SIZE=64` 亲读于 `db701c1f:kimi_kda.py:38`，L434–475 将它传入两个 prefill 算子；卷积宽度补证见 CR-10。第 28/33 项现覆盖 2c59ff10 的 utils L690–821、rc2 7d825229 的 L819–955，已实际阅读登记表及注册循环。独立 `git ls-tree` 确认 2c59ff10 没有 `kimi_kda.py`，2c59ff10/2ed6cbba 的模型目录没有本页 GLM-5.3-Flash 适配文件。正文改用这一具体模型范围，并撤去“镜像逐行同位”的全同断言；没有将不同版本整个替换表认作相同。 |

以上关闭的是旧清单八项具体问题，不是其所在页面的完整验收。历史报告中的“已读待判”、raw 存档未比对、外部来源未读等状态不因本次修订自动转成支持。

### 投机说明与新增图复核

speculative-decoding 四处修订已结合实际上下文核对：`0fc695fc:config/speculative.py#L715-L727` 只警告重复使用 MTP 层可能降低接受率，不能从单层结构推出确定训练目标或逐位置严格下降；新文字保留连续跑三遍的结构和代价，去掉未证实推断。`baa023ad:models/glm5next/mtp.py#L89-L98` 的确调用 fused_eh_norm，新版表只说融合调用，不再据此保证数学等价。

首拒位置的纠正另核 `0fc695fc:worker/gpu_model_runner.py#L2752-L2798`：候选输入索引是相应 target logits 索引加 1；`sample/rejection_sampler.py#L715-L764` 在首个拒绝位置输出目标 argmax，L769–835 使用补抽结果，L861–925 从相应剩余概率构造补抽；`core/sched/scheduler.py#L1414-L1436` 按拒绝数回退已算位置。因此新说明正确区分“用前一输入位置的输出检验候选”和“被拒候选自身的前向及 KV 写入”，也没有再保证随机补抽等于一次独立采样的同一个 token。候选数、三遍草拟和原有数值算例未删。

独立再次查看 `test-results/figshots/pd-disaggregation-2.png` 的最新版本：首框为“混合模型多于 1 个位置才截尾”，第 6 框为成功后计算及失败条件，全部可读；三栏布局及完成信号路线保留。另查看 `test-results/figshots/quantization-2.png` 并读 `wiki/diagrams/quantization-intuition.yaml`：输入 4×6、权重 6×6，输出现为 4×6，与矩阵乘法维度一致；逐行/逐通道缩放示意及逻辑步骤说明保留。这里只验收输出形状这一图差量，不扩为量化全页或真实算子数的认证。

**最终状态：本报告实际审查的全部收尾增量无未关闭发现。** 主代理另取得旧六页审查会话的公开文本并执行页面浏览器验收；本审查仅阅读公开摘要，没有访问或输出其中其他内容，也没有把旧六页全部历史引文写成自己逐条认证。NPU 执行、整站验收及未判断历史来源仍按各自证据记录管理；本报告所有收尾工作均不计入后续额外 200 项。
