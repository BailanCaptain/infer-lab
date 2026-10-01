# ucm 审查记录

## P5 写作记录（2026-09-29，第 16 批深改，Opus 5.5）

### 接手时的状态

- 现版 = p4-checkpoint（14591fd），正文约 1,600 字、6 个 H2，没有对照源码区，只有一张 PD 两模式图。重写前最后一版是 2669d4b（正文约 12,000 字，含对照源码）。
- 旧版信息清单：scratchpad `p5/ucm-facts.md`（O1–O23 取自 2669d4b，G1–G10 取自 14591fd）。

### 改了什么

- 按「是什么 → 为什么 → 怎么做 → 细节 → GLM 双机 → 误解 → 对照源码」重排，共 9 个 H2：UCM 是什么 / 为什么需要 / 一条请求怎样经过 UCM / 三层怎样放 / 和 KV Pool、LMCache 有什么不同 / PD 分离时 UCM 站在哪 / 放到 GLM 双机（3 个 H3）/ 常见误解 / 对照源码（五个 H3 齐）。
- 图：新增 `ucm-intuition`（直觉图：两台实例、三层存储，A 经 UCMConnector 往下存、B 先问再经共享存储和本机内存取回、只算尾巴）；新增 `ucm-flow`（代码流程：调度器里 本地命中 → 问 UCM →「还没定」分支 → 借块回告 →「异步加载」分支；worker 里 发起加载 → 每层等到齐 → 算完交出去存 → 结束前等保存；右侧外部包两层存储）；改 `ucm`（PD 两模式图，补「两端都挂 UCM」「只挂 Mooncake」标注，caption 重写）。分镜动图按 09-29 暂停令未加。
- 两个 calc：接口记账示意（1,000 / 256 / 800 → 再供 544、要算 200）；P→D 交接 64 MiB 示意（集中式两趟 128 MiB、P2P 一趟 64 MiB）。
- 已完成页只一句话 + 链接：kv-cache、prefix-caching、kv-pool（KV connector 的问答与搬运、起名规则、GLM 推演）、kv-cache-cpu-offload、lmcache（只链页首，不链锚点，页面在写）、pd-disaggregation、mooncake-connector、data-parallel、vllm-kv-block-allocation、concurrent-requests、kv-cache-layerwise-offload、linear-attention、attention-cost、glm-5-3-flash-two-node。
- frontmatter：title、summary（约 150 字）、aliases 增补、sources 由 7 条扩到 32 条、relations 由 3 条扩到 6 条、updated 改 09-29。
- 未改 standard-pages.json、index.md、别页。

### 本部署是否启用（核实）

- 官方教程 `0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 的全部 CLI 参数里没有 `--kv-transfer-config`，也没有 prefix caching 开关 → UCM 未启用，本页按「变体」写，GLM 一节全部是源码推演，无实测数。
- 01 §B3（抢占全部重算、约 67,000 位置、约 9 步）只以结论 + 链接（concurrent-requests、vllm-kv-block-allocation）出现；02 §1.4（每位置 13,056 B、KDA 每请求每卡约 85 MiB）只引结论并链到部署页与 attention-cost，没有重算，也没有写成 UCM 的效果。

### 数字取自哪里

- 官方对比数（32K/64K/128K 三档 TTFT、TPOT 64–66 ms、GLM-5.1-w4a8、P 4 台 DP4TP8、D 4 台 DP8TP4、128 并发、预存 80%）：`ucm_deployment.md` L459–L700、L755–L885（db701c1f）。明确标为官方在那套 8 台机器上的数，本站未复现、不能搬用。
- 64 GB 主机缓存、QwQ-32B、TP4、2P2D：同文档 L100–L170、L202–L330。
- 8,355,840 B / 13,056 B：部署页「占住一个块号要用多少显存」；85 MiB：attention-cost；67,000 位置 / 9 步：vllm-kv-block-allocation 与 concurrent-requests（底稿 01 §B3、02 §1.4）。
- 1,000 / 256 / 800、64 MiB：教学示意。

### 核心概念对照了什么

- 外壳（db701c1f `kv_pool/ucm_connector.py`，324 行）：L6 导入外部 `ucm` 包的 `UCMConnector`；L37 `UCMConnectorV1(KVConnectorBase_V1, SupportsHMA)`；L48 唯一成员 `_ucm_engine`；L50–L69 保留接口委托（外部分发器没显式声明时转给内层 `.connector`）；其余方法原样转发。与 2c59ff10、2ed6cbba、baa023ad（main 挪到 `ucm_connector/connector.py`）逐字 diff 为 0。
- 注册：`kv_transfer/__init__.py` L57–L59（main L85–L89）。`UCM_CONFIG_FILE` 在四个提交的 `vllm_ascend/` 下 grep 零命中。
- 上游接口（vllm@0fc695fc）：`base.py` L454–L487（返回 None = 下一步再问；bool = 异步；只报 prompt 里真可用的最长前缀）；`scheduler.py` L604–L640（只在 `num_computed_tokens == 0` 时问、None 就跳过）、L783–L812（`update_state_after_alloc`、异步挂起 `WAITING_FOR_REMOTE_KVS`、连接器命中统计）；`kv_connector_model_runner_mixin.py` L78–L101（`start_load_kv` / `wait_for_save`）；`base.py` L285–L290（`handle_preemptions`）、L542–L561（`request_finished` 可暂缓还块）；`config/vllm.py` L1479–L1500（不支持 HMA 才自动关）；factory 注册只记模块路径、创建时 `import_module`。
- KDA align：`patch_mamba_config.py` L24–L41 `_using_kv_store` 只认 AscendStoreConnector（含 MultiConnector 子项），L205–L226 只有它会把 none 改 align；不开 prefix caching 时 `mamba_block_size = max_model_len`。v0.23 / v0.26 / main 同样只认 AscendStore（grep 核过）。
- GLM 稀疏 MLA 的逐层调用点：`indexer_kpool_mla_v1.py` L557 `AscendIndexerKPoolMLAImpl(AscendSFAImpl)`，forward L800 起两处 `super().forward`；`sfa_v1.py` L1722 `wait_for_kv_layer_from_connector`、L2030 `maybe_save_kv_layer_to_connector`。KDA 层的实现未核（列入待核）。
- HMA：`AscendMultiConnector(MultiConnector, SupportsHMA)`、`MooncakeConnector(KVConnectorBase_V1, SupportsHMA)`（db701c1f）。
- LMCache：`lmcache_ascend_connector.py` 共 5 行，导入 `lmcache_ascend` 并复用上游 `LMCacheConnectorV1`。
- 部署文档：db701c1f 与 2c59ff10 逐字相同；2ed6cbba 与 baa023ad 相同，和前者只差空白与 32K→32k。KV Pool vs UCM 的对比句、三层架构、能力表（Prefix Cache / Sparse Attention / 4 种 PD / ReRoPE）、两种 PD 表、PipelineStore 推荐、共享存储要求、四份 yaml（use_layerwise 集中式 false，P2P-P、混部、大规模 EP-P 为 true；enable_event_sync 四份均 true）。

### 旧版信息清单勾选

- O1 ✓ 为什么需要（被挤掉 / 落在别处 / 重启清空）。O2 ✓ 首段定义。O3 ✓ PD 节首段「分清两件事」。O4 ✓ 怎么开（QwQ-32B、TP4、2P2D）；旧版「沿用 32B 稠密模型讲」的理由（Qwen3.6 无 PD）已随主线改为 GLM 失效，删。
- O5 ✓ 三层表。O6 ✓ 三层节 + 怎么开。O7 ✓ 三层节 + 误解。O8 ✓ 流程 1–3 +「命中只是一个计划」。O9 ✓ 流程 4–6。O10 ✓ PD 节「集中式为什么行得通」。O11 ✓ 代价「多一个外部依赖」+ 怎么开 + 待核。
- O12 ✓ PD 表 + 怎么开。O13 ✓ 并更正：按层开关实际是四份示例（旧版写三份），大规模 EP 的 P 侧也为 true。O14 ✓ 怎么开 + 待核（四份均 true）。O15 ✓ 怎么开。
- O16 ✓ 比较节「三种厚度」+ 三层节 + GLM 节；「整个类只有 _ucm_engine 一个成员」仍成立，另补保留接口委托。O17 ✓ 版本差异（main 路径；内容逐字相同即行号不变）。O18 ✓ 版本差异表下一段。O19 ✓ 误解三条均保留，另加 4 条。O20 ✓。O21 ✓。O22 ✓ 源码位置。O23 ✓ 怎么开末句。
- G1 ✓ PD 节首段。G2 ✓ PD 节。G3 ✓ PD 节 P2P 段。G4 ✓ calc。G5 ✓ 流程 2。G6 ✓ 流程 5。G7 ✓ 三层节。G8 ✓ 三层节「内容要对得上」。G9 ✓ GLM 节（KDA、稀疏 MLA、indexer；接口接得上、存得对不对未验证）；「KDA 递归状态」措辞改为「KDA 递推状态」随 kv-cache 页。G10 ✓ 源码区（版本表、来源对应）。

### 自查

- 写作标准（把 ucm 临时当名单页跑 `auditStandard`）：教学正文 5,639 字（标准口径）· 行内代码 0.0/千字 · 对照源码之上角标 0 · 五个 H3 齐 · calc 0.35/千字 · 表与 calc 不相邻 · 图先行 · 免责 1.3% · 图宽 ✓。
- 角标 29 处（C 19、S 7、A/D/I 各 1），C 占 66%。
- 字数：正文（不含 frontmatter）1,606 → 16,634 字符，其中对照源码之上 10,107。
- 疑点：无 P1。需审查留意：①官方对比数放在「为什么需要」作动机，已写明设定与「本站未复现」；②「只加 UCM 时 KDA 无中间存档」是源码推演 [I]，与 kv-pool 同一前提；③LMCache 列只写了本仓可核的事实，其余链 LMCache 页（该页在写）。
- 跳过：参考图库（refs/INDEX.md）只有通信原语与 TP/DP/EP 的图，和本页无关，没有逐张看；外部 `ucm` 包不在本地镜像，无法读源码；未截图、未起服务（按派发说明由审查环节浏览器验收）。

### 验证

- `pnpm wiki:lint`：本页 0 报错（每次保存后都跑）；全库最后一次失败项是别页 `dp-request-routing.md` 的 broken-anchor（此前还见过 `large-scale-ep.md` 的 dup-alias），均非本页。
- `pnpm wiki:diagrams --check`：ucm、ucm-intuition、ucm-flow 无问题；别页 `lm-head-intuition.svg`、`sampling-intuition.svg` 与 spec 不一致（非本页）。本页三张图用 scratchpad 的限定脚本只渲染自己的 id，未碰别页 svg。
- `pnpm wiki:audit`：通过；本页 32 条来源行号全部有效，1 条 URL 未联网验证。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审不改）。**7.0 / 10**。学习顺序：通过。`pnpm wiki:audit`：本页通过（32 条来源行号有效，1 条 URL 未联网；本页是名单外页）。`pnpm wiki:lint`：通过，本页无报错；全库无指向 `ucm.md#…` 的锚点入链。

### 初学者测试（只读前两屏）

UCM 是接在 vLLM KV connector 上的外部缓存包，把算过的前缀往本机内存和共享存储里存，别的实例或重启后同开头的请求能取回、少算 prefill；代价是取回要时间、写入占带宽和容量、存储必须真共享、多一个外部依赖。——能说清。

### 核对了什么

- 旧版信息清单 `p5/ucm-facts.md` 存在；抽 6 条到新版：O7（同名目录≠共享，L145）、O13（按层开关四份示例，L194；对照部署文档 L110 false、L246/L385/L510 true，写手的更正属实）、O19（三条误解，L221–L223）、G2（「已计划保存」≠「已可读」，L180）、G7（持久的前提，L146）、G9（KDA、稀疏 MLA、indexer，L209–L217）——全部在。`git diff` 删掉的 30 行逐条对照，信息都搬进了新版（措辞变化见 P1）。
- 上游接口（vllm@0fc695fc）：`base.py` L452–L487（None=下次再问、异步标志、只报 prompt 的可用前缀）、L285–L290、L542–L561；`scheduler.py` L604–L640（只在 `num_computed_tokens == 0` 时问，None 跳过）、L783–L812（回告、`WAITING_FOR_REMOTE_KVS`）；`kv_connector_model_runner_mixin.py` L76–L101；`config/vllm.py` L1479–L1500（HMA 只在不支持时自动关）；`models/config.py` L352–L365（开 prefix caching 时混合模型走 align）。流程第 1–7 步与源码一致。
- vllm-ascend@db701c1f：`ucm_connector.py` L5、L37–L69（唯一成员 `_ucm_engine`、保留接口委托）一致；`patch_mamba_config.py` L26–L41 只认 AscendStore、L215–L225 不开 prefix caching 时 `mamba_block_size = max_model_len`，GLM 小节的 KDA 推演成立；`lmcache_ascend_connector.py` 共 5 行属实。
- 部署文档 `ucm_deployment.md`（db701c1f）：对比表 9 个 TTFT 数、TPOT 64–66 / 65–66、GLM-5.1-w4a8、P 4 台 DP4TP8、D 4 台 DP8TP4、128 条、80% 预存、输出 1,000（L459–L466、L755–L885）全部对上；DP 路由导致 HBM 命中率低的解释（表下注）对上；KV Pool 对比句（L5）、三层（L19–L30）、能力表（L40–L49）、两种 PD 定位（L85–L86）、`Cache|Posix` 与 64 GB（L100–L117）、各份 `kv_role`（L138/L165/L274–L289/L322）对上。
- 数字：8,355,840 B、13,056 B（部署页 L211–L212，02 §1.4 L148–L149）；85 MiB（attention-cost L105，02 L312）；约 67,000 位置（concurrent-requests L243–L250，01 L1023–L1030）；133,120 / 640 / 5 个缓存组（kv-pool L190–L196）。都只引结论加链接，没有写成 UCM 的效果；GLM 节明确「没有实测数」。未发现虚构部署数字。
- 本部署是否启用：官方启动参数无 `--kv-transfer-config`，按变体写，属实（沿用写手核对，未再查教程原文）。
- 浏览器：Playwright 1440 宽打开 `#/wiki/ucm`，截图 `scratchpad\ucm-review-1.png`（第一屏）、`ucm-review-fig1/2/3.png`（三张图）、`ucm-review-zoom-arrow.png`（放大）。控制台只有 4 条 502（问答后端未起，与本页无关）。

### P1（1 条）

1. **外部包决定的行为在前两屏写成了定论，且缺一个官方示例必设的前提。**
   - 位置：L57（首段定义「哪怕落在另一台实例上，或者服务已经重启过——也能从那里取回」）、L69（「只要第 3 层的后端能持久保存、重启前也写完了，这些前缀就还在，重启后的第一条同开头请求照样能取回」）、L81、L204（「两台都挂上同一份共享存储时，UCM 能让它们互相取用」）。
   - 问题：跨实例命中、重启后找回都取决于外部 `ucm` 包怎样给前缀起名、何时写、重启后怎样恢复——这些正是本页页末「待核」第 1 条列的未知项，本页自己也承认「vllm-ascend 这一层适配证明不了后端的持久性」（L146）。p4 版原句是必要条件（「……服务**才可能**跨重启复用」），新版 L69 改成了充分条件（「只要……就……照样能取回」），语义被加强。更具体的风险：vLLM 自己的块指纹在没设 `PYTHONHASHSEED` 时每个进程随机（vllm@0fc695fc `v1/core/kv_cache_utils.py` L88–L113）；部署文档每一份 `vllm serve` 示例都设了它且 P、D 同值（`ucm_deployment.md` L122、L149、L255、L303、L525、L645），本页全文（含怎么开）一次都没提。若 UCM 的键沿用 vLLM 块指纹，各节点不一致或重启后换了种子，就会静默不命中——和 kv-pool 页 L221、L257 写明的后果同类。
   - 改法：L57、L81 的跨实例 / 跨重启说法注明「按官方部署文档」；L69 改回必要条件，并补一句「能不能认出同一段前缀取决于外部包的起名规则，见待核」；L204 同样加限定。「怎么开」补 `PYTHONHASHSEED`：官方每份示例都设、P 与 D 同值，是否必需待核，照抄最稳；「待核」第 1 条补「UCM 的键是否沿用 vLLM 块指纹」。

### P2（4 条）

1. **L205 与页末待核自相矛盾。** 正文说「接口说明只让连接器报 prompt 里的可用前缀，已经生成出来的部分照样要重算」，是定论；待核第 3 条（L331）又把「UCM 能补回 prompt 还是也能补回已生成部分」列为未知。`base.py` L478–L483 的原文是 should 级的说明，不是强制检查，实际报多少由外部包决定。改法：改成「接口说明只要求报 prompt 里的可用前缀；UCM 实际会不会补回已生成的部分，见待核」。
2. **L225「也不会报错」是外部包行为，未核。** D 问不到时 vLLM 这边返回 0、照常自己算，这是可推的；UCM 对不可见路径会不会报错、打什么日志，本仓看不到。改法：删掉「也不会报错」，或改成「vLLM 这边只会当成没命中，UCM 会不会报错待核」。
3. **`ucm-flow` 图的存取箭头和正文的两段搬运对不上。** 「这一层算完 交出去存」的箭头直接指向「共享存储 / SSD」，绕过了「本机内存（快取）」；「搬进显存」的箭头从两个存储框之间的空隙发出。正文 L136、L144 讲的是 PipelineStore 先经本机内存（Cache 段）再落存储（Posix 段），图给初学者的印象是 worker 直接写共享存储。见 `ucm-review-fig2.png`。改法：两根箭头都接到「本机内存」框，由它和「共享存储」之间的「两段搬运」竖线承接下一段。
4. **`ucm-intuition` 图「① 往下存」箭头穿过分组标题。** 斜线从实例 1 的第 2 层穿过「多台机器共同挂载（NFS、3FS 等）」的「3FS」字样，也压着自己的标签「① 往下存」。见 `ucm-review-zoom-arrow.png`。改法：把分组标题挪到框内左上或换到右侧，或让箭头从标题左侧下行。

### P3

- L59 说连接器「怎样问答、怎样搬运，KV Pool 一页已经完整讲过」，但 L100–L132 又完整讲了一遍通用接口七步（kv-pool 页讲的是 AscendStore 自己怎么查、怎么搬，lmcache 页 L89–L100 也有一版三步交接）。这一节讲的是 kv-pool 页没有的通用部分（None、同步 / 异步、`request_finished`、抢占前通知），不算重讲，但 L59 的说法不准。建议改成「KV Pool 页讲了 AscendStore 自己怎么答、怎么搬；下面讲的是三种连接器共用的接口」。
- 「vllm-ascend 仓里只有一层转发外壳」在 L98、L157、L161、L226 讲了四遍，可以删掉一两处。
- `ucm-flow` 图：「执行时 · 每张卡的 worker」标题压在上方调度器框的下边线上。
- `ucm` 图（PD 两模式）：P、D 节点框内是空的，只有两道竖线，信息量低；不影响理解。
- 注水检查：对照源码之上约 1 万字，9 节各司其职，kv-cache、prefix caching、KV Pool、LMCache、KV cache CPU offload 都是一句话加链接；和 KV Pool、LMCache 的区别由一张表和「三种厚度」一段讲清。未发现成段注水。

### 跳过

- 「对照源码」正文按规定没读，只 grep 了五个 H3 的顺序（齐、顺序对）、「版本差异」里 v0.23 / v0.26 / main 都出现；因为本页重点要查外部包的说法，额外读了待核清单 L325–L333，以及怎么开的 L255–L256 一行（核 QwQ-32B 示例）。
- frontmatter 来源区未读（由 audit 校验）。
- 参考图库 refs 未看（只有通信原语、TP/DP/EP 的图，与本页无关）。
- GLM 官方教程 `0576b647` 的启动参数没有再打开核对，沿用写手结论。

## P5 修订记录（10-02）

修订者：Fable 5（只修本页与本页三张图）。改后正文行号整体 +2（sources 新增 2 条）。

### P1（1 条，已修）

- L59 首段、L206（原 L204）跨实例/跨重启说法均已注明「按官方部署文档」；L71（原 L69）改回必要条件（「只有……才还在」），并补「重启后的进程还得认出同一段开头，取决于外部包起名和找回的规则」；L83（原 L81）补「后两条都以外部包能认出同一段前缀为前提」。
- 「怎么开」新增一段（现 L269）：三份跨节点示例每台机器都 `export PYTHONHASHSEED`（集中式 123456，P2P 与大规模 EP 为 0）、同一示例 P 与 D 同值；vLLM 前缀块指纹没设种子时每进程随机（vllm@0fc695fc `v1/core/kv_cache_utils.py` L86–L113 已复核）；UCM 的键是否沿用待核。待核第 1 条已补这一项。
- **对审查的一处更正**：审查说「部署文档每一份 `vllm serve` 示例都设了它」，复核 db701c1f `ucm_deployment.md` 后不确：六处（L122/L149/L255/L303/L525/L645）都在跨节点示例里，单机混部那份（L398 起）没有设。正文按「三份跨节点示例都设、混部没设」写。
- 新增来源第 33 项（ucm_deployment.md#L122-L151）、第 34 项（kv_cache_utils.py#L86-L113），「来源与结论对应」已补对应句（未加 [S33]/[C34] 内联标记，避免触发 mark-flood 的 30 处上限；第 31、32 项有同样的先例）。

### P2（4 条，已修）

1. L207（原 L205）改为「接口说明只要求连接器报 prompt 里的可用前缀，UCM 实际会不会把已生成的部分也补回来，在外部包里（见页末待核）」，与待核第 3 条不再矛盾（base.py L478–L483 的 should 级措辞已复核）。
2. L227（原 L225）「也不会报错」删去，改为「vLLM 这边只当没命中、照常重算；UCM 自己会不会报错在外部包里」。
3. `ucm-flow` 图：两根搬运箭头都改接「本机内存」框（「这一层算完→本机内存」经 x=644 竖线上行，「本机内存→前向开始前」经 x=628 竖线下行，互不交叉），下一段由「两段搬运」竖线承接，与正文 L138/L146 的两段搬运一致。
4. `ucm-intuition` 图：存储框标题缩为「共享存储」，「多台机器共同挂载（NFS、3FS 等）」挪进框内右侧（854,394 anchor end）；①③ 斜线不再穿过任何文字，「① 往下存」标签挪到 (310,316)、离线 20px 以上。

### P3（4 条已修，1 条无需处理）

- L61（原 L59）改为「KV Pool 一页讲过 AscendStore 自己怎样答、怎样搬，三种连接器共用的接口步骤下文会完整走一遍」。
- 重复的「转发外壳」删 2 处（原 L98 的「vllm-ascend 只负责把调用转过去」、原 L226 的「本仓只有一层转发外壳」），保留表格、三种厚度两处。
- `ucm-flow`：worker 框下移（[20,342] 高 258），标题不再压调度器框下边线。
- `ucm` 图：P/D 节点标签补成「P 节点（prefill）」「D 节点（decode）」，「两端都挂 UCM」「Mooncake 直传」上移到 y=66 避开加长的标签。
- 注水检查：审查未发现问题，无需处理。

### 验证

- `pnpm wiki:lint`：通过，本页 0 报错 0 待留意（新增来源曾使内联标记到 31 处触发 mark-flood，去掉两个内联标记后回落）。
- `pnpm wiki:audit`：通过，本页 34 条来源行号全部有效，仍只有那 1 条 URL 未联网验证。
- `pnpm wiki:diagrams` 重新生成三张 SVG，`--check` 全库一致；三张图用 Playwright 开 file:// 截图复核（scratchpad `fixed-ucm-flow.png` / `fixed-ucm-intuition.png` / `fixed-ucm.png`），箭头走向、标题避让、标签间距均确认。按派发要求未起 5193/8790 服务，页面在站内的渲染未复测。
- 工作区有并行写手的未提交改动；`pnpm wiki:diagrams` 为全库派生命令，顺带把他们已改 spec 的 SVG 也生成了（派生产物，字节与其 spec 一一对应）。

## P5 复审（10-02）

复审员：Opus 5.5（独立复审，只审不改；只复核 P1、4 条 P2 与本轮删改，不重审整页）。**7.8 / 10**（上一轮 7.0）。`pnpm wiki:audit`：通过，本页 34 条来源，新增的第 33、34 项（`ucm_deployment.md#L122-L151`、`kv_cache_utils.py#L86-L113`）行号有效，仍只有 GLM 教程那 1 条 URL 未联网。`pnpm wiki:lint`：通过，本页无报错、无待留意。`pnpm wiki:diagrams --check`：271 张一致，三张 ucm 图无提示。输出存 scratchpad `ucm-rereview-audit.txt` / `ucm-rereview-lint.txt`。

### P1 复核：正文已修好，summary 漏一处（见下方 P2）

- 正文四处都已改：L59 首段与 L83、L206 加了「按官方部署文档」；L71 改回必要条件，并补「重启后的进程要认出同一段开头，取决于外部包的起名与找回规则」；L83 补「后两条以外部包能认出同一段前缀为前提」。出处成立：db701c1f `ucm_deployment.md` L11（重启、实例故障后缓存仍在）、L37（集中存储、实例间不各存一份）、L370（混部也写重启后仍在），都落在页面「源码位置」列的定位段 L3–L64 和混部段 L363–L416 里。
- `PYTHONHASHSEED`（L269）已核：L122、L149 集中式 P/D 都是 123456；L255、L303 P2P 都是 0；L525、L645 大规模 EP 的 `prefill.sh` / `decode.sh` 都是 0，而且写明在每台 P、D 节点上准备这两个脚本；混部段（L363–L460）一处都没有设。页面写的「三份跨节点示例都设、同一示例 P/D 同值、混部没设」全对。修订者对上一轮审查（「每一份都设」）的更正属实。vllm@0fc695fc `kv_cache_utils.py` L86–L113：没设种子时 `NONE_HASH` 取 `os.urandom(32)`，页面「每个进程各自随机」属实。待核第 1 条（L333）已补「是否沿用 vLLM 块指纹」。
- 全页 grep「重启 / 另一台 / 跨 / 互相 / 取回 / 持久 / 还在 / 找回 / 认出」，逐条看过：L93 是在转述官方表下注（db701c1f L885），有「文档的解释是」引出、句末也写了「本站没有复现」，可以；L99、L138、L147、L148、L182、L224 都是必要条件或「要实测」的说法；L167 讲的是 CPU offload。**只有 frontmatter `summary`（第 5 行）漏改**，见 P2-1。

### 上一轮 4 条 P2 复核：都改对了

1. L207 已改成「接口说明只要求报 prompt 里的可用前缀，UCM 会不会补回已生成的部分在外部包里（见待核）」，和待核第 3 条（L335）不再矛盾。
2. L227 去掉了「也不会报错」，改成「vLLM 这边只当没命中、照常重算，UCM 自己报不报错在外部包里」。
3. `ucm-flow`：我自己用 Playwright 打开 file:// 渲染（scratchpad `rereview-ucm-flow.png`）。「这一层算完」经 x=644 竖线接到「本机内存」，「搬进显存」从「本机内存」左边经 x=628 竖线下行。两根线不交叉，下一段由「两段搬运」竖线承接，和正文 L138、L146 一致。
4. `ucm-intuition`（`rereview-ucm-intuition.png`）：①、③ 两根斜线都不再穿过文字，「① 往下存」标签离线有间距；「多台机器共同挂载（NFS、3FS 等）」挪进了框内右下。

### 本轮删改是否丢信息

本轮之前的版本没有存档。我用修订脚本 `ucm-fix.mjs` 的替换对反推出改前文本，和现版做 `git diff --no-index --word-diff`。P2-1、P2-2 和 [S33]/[C34] 那三处是脚本跑完后又手改的，反推不回来，改成对照修订记录和现文逐句核。删掉的内容有：L61「KV Pool 已完整讲过」（说法本来就不准，已改准）、L71「重启后照样能取回」（说过头了，已改成带前提）、L100「vllm-ascend 只负责把调用转过去」、L228「本仓只有一层转发外壳」。后两处的意思仍在 L159 表格和 L163「三种厚度」里。L207 原句「接口只让报 prompt 前缀」的信息保留下来了。**没有丢信息。**

### P2（1 条，新发现，属于原 P1 没收干净）

1. **frontmatter `summary`（第 5 行）还是定论：换了实例、或者重启以后，「还能取回」，前面没有任何前提。**
   - 影响：这一行在页面最上方（`WikiPage.tsx` L341 `wiki-summary`），比正文第一段还先被读到。别的页面链到本页时，悬停卡片也显示它（`Term.tsx` L66），而卡片上没有正文的限定。问答检索也把它当页面摘要用（`retrieve.ts` L296）。正文 L59 已经加了「按官方部署文档」，摘要和正文说法不一样。
   - 复现：`grep -n '换实例或重启后' wiki/concepts/ucm.md` 命中第 5 行；`pnpm wiki:audit` 输出里本页标题下面那行就是它。
   - 改法：改成「按官方文档，换实例或重启后也能取回」，或者「多实例共用、可跨重启复用（取决于外部包的起名规则）」。改完跑 `pnpm wiki:lint`。

### P3

- `ucm-flow`：本轮把 worker 框往下挪以后，「借块，回告块号 → 前向开始前」这根竖线正好穿过「执行时 · 每张卡的 worker」标题里的「w」（scratchpad `rereview-zoom-flow-title.png`）。可以把标题挪到箭头右边（x>280），或者让标题左对齐、在竖线前截住。
- `ucm-flow`：「两段搬运」这几个字被竖向双箭头从中间穿过（`rereview-zoom-flow-twoseg.png`），上一轮就是这样，不是新问题。标签往右挪 10–15px 就行。
- `ucm` 图：「Mooncake 直传」挪到 y=66 以后，离它要说明的 P→D 箭头（y≈135）太远，乍看像整个 P2P 框的副标题。可以把标签放到箭头正上方、两个节点标签之间。
- L75 小节导语把共享存储说成「重启后还在的地方」，没带前提；下面 L83 紧接着限定了，不算定论。顺手可以改成「后端能持久保存时重启后还在」。
- L277 写「只是命中为 0、照常重算」，L227 已经补了「UCM 自己报不报错在外部包里」，两处可以对齐。L277 开头有「本仓不报错」限定范围，不算错。
- frontmatter `relations` 里 kv-pool 那条的 note 还写着「问答、加载、写回流程先在 KV Pool 讲过」，和本轮修正后的 L61（KV Pool 讲的是 AscendStore 自己那一份，共用接口在本页讲）不一致。顺手对齐就行。

### 跳过

- 正文没有整页重读，只读了 L57–L101、L136–L168、L169–L232、L264–L280、L322–L337 这几段，再加上述关键词的全页 grep。
- frontmatter 的 sources 区没读（行号由 audit 校验）。只 grep 了 `summary`、`relations` 等单行。
- 站内渲染没测：按派发要求不起 5193/8790，三张图只用 file:// 单独渲染核对。
- 参考图库 refs 没看（本页不涉及通信原语、TP/DP/EP）。

### P5 复审后的补修（10-02，Fable 5）

- 复审 P2（summary 定论）：frontmatter 第 5 行改为「按官方文档换实例或重启后也能取回」，与正文 L59 一致，summary 现约 135 字。
- 复审 P3 六条全部处理：L75 导语补「后端能持久保存时」；L277 补「UCM 自己报不报错在外部包里」与 L227 对齐；relations 里 kv-pool 的 note 改为「KV Pool 讲过 AscendStore 的问答与搬运；共用的接口步骤在本页讲」；`ucm-flow` 的「借块→前向开始前」竖线右移到 x=252 避开 worker 框标题、「两段搬运」右移到 x=777 离开双箭头；`ucm` 图「Mooncake 直传」改为箭头正上方两行（size 11，bbox 643.7–696.3，距两框边各 3.7px，缩放截图核过）。
- 验证：`pnpm wiki:lint` 本页 0 报错 0 待留意；`pnpm wiki:audit` 通过、34 条来源行号有效；`pnpm wiki:diagrams --check` 271 张一致；三处图改动均用 file:// 截图复核（scratchpad `fix2-flow-title.png` / `fix2-flow-twoseg.png` / `fix4-pd-mooncake.png` / `fix4-zoom.png`）。

### 达标名单 hedge-ratio 补修（10-02，Fable 5）

- 入名单后 [hedge-ratio] 5/160 句 = 3.1% 超线。处理：正文三处散落的「（见页末待核）」指针删去并入页末待核（L71、L83、L207，不确定性本身仍在待核第 1、3 条）；L80「可能落在另一组」改为「落在哪一组由路由决定；落在另一组时…」；保留 L219 指向待核清单的那一句总指针。没有删任何真实的不确定性。
- 验证：audit 写作标准本页 9 项全 ✓（免责 0.6%），lint 本页 0 报错，diagrams --check 271 张一致。
