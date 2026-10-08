# prefix-caching 页审查记录

## P5 写作记录（2026-09-28，深改）

**改了什么。** 全页重写：问题式开篇 + 直觉图（两条请求共享写满的前缀块、各自续写尾块，只画份数）→ 为什么/代价 → GLM 双机落地（默认关；显式开的 align 链条）→ 「哪些块能被共享」与「池子的预算怎么分」分成两节 → 常见误解 → 对照源码五个 H3。改前（p4-checkpoint 版）正文约 3,600 字符，改后 audit 口径 8,274 字 / 7 节 / 来源 25 条。直觉图 yaml 重画（900×320）。按验收要点，共享条件与预算分配各自成节；预算、登记、驱逐细节一律链接 vllm-kv-block-allocation.md，块数不在本页重述。

**数字取自哪。** 调度粒度 lcm(640, 4, 133120)=133,120、hybrid 默认关、R1 4 token 必重算：底稿 docs/mainline/01-deploy-entry-schedule.md §A2.3。逻辑块 640：glm-5-3-flash-two-node.md（链接）。开 APC 后指纹粒度 = 各组 gcd = 4、KDA 按 640 留档：照镜像源码推演（见下），页面上标明「未实跑」。

**核了哪些源码（钉点）。**
- 块哈希：vllm@0fc695fc `v1/core/kv_cache_utils.py` L563-590（parent hash + token + extra keys）、L525-561（LoRA/多模态/cache salt/prompt embeds）。
- 命中条件：`kv_cache_manager.py` L195-235（enable/skip 直接空手回、max_cache_hit_length=num_tokens-1）；混合公共长度定点循环 `kv_cache_coordinator.py` L582-683。
- GLM 能不能开：`config/model.py` L1758-1759、L1814-1857（hybrid→默认关，非硬禁）；`arg_utils.py` L2370-2419（显式设置不拦）；`models/config.py` L337-394（align 回退 + chunked prefill 断言）；镜像 db701c1f `patch_mamba_config.py`（L76 调上游、L153-158 块 640、L222-225 mamba_block_size）；镜像/main GLM 模型类均未实现 SupportsMambaPrefixCaching（glm5_next.py L2437、glm5next/model.py L839）。
- 各组表现：spec→manager 注册表 `single_type_kv_cache_manager.py` L1349-1401（MLAAttentionSpec→Full、SlidingWindowMLASpec→SlidingWindow、MambaSpec→Mamba）；镜像 `patch_mamba_manager.py` L20-50（KDA 一份边界档 + null 占位）；`patch_glm5_next_mamba_scheduler.py`（chunk 刀口对齐）；`patch_kv_cache_utils.py` L332-410（GLM 分支：关=lcm 不细哈希，开=gcd）。
- 版本差异：v0.23 vllm@0fc695fc 判不支持默认关；v0.26 vllm@568afb3a L2518-2524 判支持但 opt-in；main vllm@84030bbe L2777/L2138 默认开；ascend main baa023ad `patch_kv_cache_utils.py` L82-136 先筛 is_prefix_cacheable 组。2c59ff10、2ed6cbba 无 GLM 代码，镜像 db701c1f 单独标注。
- 死分支：镜像 `models/layer/attention/layer.py` L112-120（要求 TRITON_MLA/FLASHINFER）+ `dsa_v1.py` L191-199（get_name 只回 ASCEND_DSA/FLASH_ATTN）。

**旧版信息清单勾选。** 旧版=0f97c8b（Qwen3.6 设定，206 行）+ p4-checkpoint 版（63 行），共 29 条，全清单与逐条去向存 scratchpad p5/prefix-caching-facts.md。摘要：保留 19 条（机制、整块命中、身份哈希、align、死分支、三版默认值等，全部按 GLM 钉点重核）；挪走 3 条（块为什么 640→two-node；refresh_block_size 128 与静默改写日志→块分配页/kv-cache-spec）；删除 7 条并注明理由——旧模型算例（6000+37/2048/1941）、旧模型教程显式开 APC、CP 因子/310P/_get_kv_cache_view（本部署无关）、昇腾 CI 相等断言（本轮未复核，改标待核）、index_topk=2048 澄清（失去出现场景）、「不宣称默认开关」（被 two-node 页已核的「默认关」取代）。

**留下的待核。**
1. 开 APC 后 KDA 留档的显存增量没有算（底稿只覆盖关缓存形态）。
2. GLM 双机显式开 APC 的实跑验证（输出一致性、TTFT 收益）没有做，页面按源码推演并标注。
3. main 列的指纹粒度：筛组后的具体数值未逐项核（页内标待核）。

**验证。** pnpm wiki:lint 退出 0（本页仅一条留意级 mark-flood 提示，非报错）；pnpm wiki:diagrams --check 退出 0；pnpm wiki:audit 退出 0（本页行号全部有效）。按协调方指示修了三处：图 pin 的 block_pool 引用补进 sources、scheduler patch 行号 L1-L61→L1-L60、与 vllm-kv-block-allocation 的 relation 双写改为只留本页一侧（对方页仅删那一行）。

## P5 审查（09-28）

审查人：Fable 5 独立审查（只审不改）。对象：wiki/concepts/prefix-caching.md（8,274 字 / 7 节 / 25 条来源，深改后未审版）。

### 分数：8.5 / 10

### 初学者测试（只读前两屏）

能说清。一句话：开头相同的请求，把已算好的整块 KV 按指纹（block hash）认领、直接指同一份不重算，省的是 prefill 的计算（TTFT），省不掉读；代价是登记查表、块池占用变长、混合模型还要为递推状态留档。第一屏问题式 H2 + 一句话定义 + 直觉图齐全，结构达标。

### 本批验收要点：共享条件与预算分配是否分开讲

**达标。**「哪些块能被共享」（L89–105）与「池子的预算怎么分，满了怎么办」（L107–115）各自成节，不混写。预算节只留三条与预算直接相关的结论，登记/计数/驱逐的机制细节全部链接 vllm-kv-block-allocation.md（#引用计数…、#池子不够时…两个锚点均存在，实测行号 118、202），没有重讲。

### 核心概念逐条核对（vLLM 0fc695fc / vllm-ascend db701c1f）

全部核对为**正确**：

1. **块哈希**：链式（parent hash + 本块 token + extra keys），extra keys 含 LoRA、多模态内容指纹、cache salt、prompt embeds——`vllm/v1/core/kv_cache_utils.py` L397–L590（need_extra_keys、generate_block_hash_extra_keys、hash_block_tokens）与页 L93/L95 一致。只有写满的块算指纹：`kv_cache_manager.py` L195 起 get_computed_blocks docstring「computed blocks must be full」。
2. **hybrid 默认关**：`vllm/config/model.py` L1852–L1857 对 attn_type=="hybrid" 返回 False（措辞「still experimental」）；`arg_utils.py` L2404–L2405 仅在开关为 None 时取该默认，显式设置不被拦。页 L79/L81 及误解条 L123 均正确。GLM 模型类 `db701c1f:vllm_ascend/models/glm5_next.py` L2437 只挂 IsHybrid/HasInnerState 等，无 SupportsMambaPrefixCaching；main `baa023ad:models/glm5next/model.py` L839 同样没有——版本差异表该行正确。
3. **align 回退与 chunked prefill 断言**：`vllm/model_executor/models/config.py` L348–L372：开 APC 且模型不支持 all → align，assert enable_chunked_prefill；开 APC 时 mamba_block_size 取 cache block（640），关时取 max_model_len（133,120）。页 L83–L84 逐条对得上。
4. **指纹粒度**：上游 `kv_cache_utils.py` resolve_kv_cache_block_sizes（L593 起）与镜像 `patch_kv_cache_utils.py` _ascend_resolve_kv_cache_block_sizes（L332 起）一致：关 APC 时 hash 粒度=调度粒度=lcm=133,120；开时取 gcd=4。与底稿 A2.3（L689）一致。
5. **各组命中行为**：MambaManager.find_longest_cache_hit（`single_type_kv_cache_manager.py` L971 起）从右向左找最后一份状态档、前面填 null 占位块，一份档即可——页 L102「一份停在目标位置的档就够、前面全用占位块填」正确。协调器 HybridKVCacheCoordinator.find_longest_cache_hit（`kv_cache_coordinator.py` L627 起 while True 循环）只砍不涨、砍过全组重查、alignment_tokens=调度块——页 L105「只砍不涨」描述正确，「公共长度总是 640 的整数倍」成立。
6. **patch_glm5_next_mamba_scheduler.py 与 APC 的关系**：该 patch 换掉 Scheduler._mamba_block_aligned_split，把 GLM 的 prefill 刀口对齐到 self.block_size（解析后的调度边界），保证每个边界留下完整 Mamba 状态档——页 L83「镜像专门把 prefill 的每一刀切在块边界上」讲对了，引用（L1–L60）内容相符。
7. **全命中留最后一个 token 重算、可能整块重算**：`kv_cache_manager.py` L215–L220 NOTE 原文即此。页 L124 正确。
8. **驱逐/捡回**：block_pool.touch（L402–L425）ref_cnt=0 时从空闲队列摘出再 +1，与页 L112–L113 一致。

**结论：GLM 上 APC 的口径（默认关、显式可开、开后走 align、复用长度按 640 对齐、不足一块零收益、R1 命中恒 0）全部核实无误。**

### 数字与底稿

640 / 133,120（lcm）/ 4（gcd）/ R1 的 4 个 token 与底稿 §A2.3（L682–L689）逐一相符。页面不重述具体块数（无 33,280、208、15 之类），块数与逐出细节均为链接——块数隔离达标。

### 依赖边

本页 relations 含 { to: vllm-kv-block-allocation, kind: builds-on }；vllm-kv-block-allocation.md 全文 grep 只有 L120 一处正文链接、无反向 relation 残留。达标。

### 丢信息核对（git diff + facts 清单）

diff 删除行与 scratchpad p5/prefix-caching-facts.md 勾选逐条对过：29 条中标 ✅ 的均在新版找到落点（含 17 断言、18 死分支、27 全命中重算、29 浮点口径在「开销和什么时候别开」L148）；标 ❌ 的删除理由成立（Qwen 旧数字、旧模型 CI 断言、310P/CP、index_topk 澄清、"不宣称开关"被更强结论取代）；标 ➡️ 的落点存在。**一处勾选不实**：第 22 条标 ✅「共享条件四条」，但旧版「请求没有要求跳过这条路径」（`kv_cache_manager.py` L212 `request.skip_reading_prefix_cache`，prompt logprobs 场景）在新版四条件里没有落点——见 P3-1。

### 图

pnpm wiki:diagrams --check 退出 0，本页图无告警。yaml/svg 900×320（宽 ≤900 ✓）；只画份数（「写满 · 计数 2」），无字节数字 ✓；两请求共享两个写满前缀块、各写各的尾块，与正文和 touch/get_computed_blocks 语义一致 ✓；3 个 pin（hash_block_tokens、get_computed_blocks、touch）全部登记在本页 sources ✓，行号实测有效（get_computed_blocks 确在 L195 起）。

### 版本差异口径

钉点行（L152）：v0.23=2c59ff10（实测 `git ls-tree` 无 glm5 模型文件 ✓）、v0.26=2ed6cbba（同 ✓）、main=baa023ad、db701c1f 明确标 orphan、不算进 v0.23 列 ✓。五个 H3 齐全且顺序正确，版本差异含 v0.23/v0.26/main ✓。

### 工具结果

- pnpm wiki:audit 退出 0，本页行号引用全部有效、无报错。
- pnpm wiki:lint 退出 0；本页一条留意级提示 [mark-flood]（89% 标记为 [C]），非报错。
- pnpm wiki:diagrams --check 退出 0。

### 问题清单

**P1：无。**

**P2（1 条）：**

1. **全库指向本页的锚点断了 3 处（本页改标题引起，需随本次深改一并修）。**
   - wiki/concepts/gqa.md L169 → `prefix-caching.md#命中需要同时满足什么`（旧标题，已不存在）→ 应改为 `#哪些块能被共享`；
   - wiki/concepts/kv-cache-spec.md L240、L298 → `prefix-caching.md#glm-的状态恢复涉及多个缓存组`（旧标题）→ L240 语境是「细粒度哈希≠各组都能恢复」应指 `#哪些块能被共享`，L298 语境是「默认关、打开后的变化」应指 `#glm-双机上它开着吗`。
   - 影响：读者点击落到页顶，导航失效；audit 不校验 markdown 锚点所以没拦住。复现：`grep -rn 'prefix-caching\.md#' wiki/concepts/`。注意 gqa 页刚收尾，改动只限这一个链接目标。

**P3（4 条）：**

1. 旧版「请求标记跳过缓存读取」（prompt logprobs 场景直接返回未命中，`kv_cache_manager.py` L209–L213）被删，facts 清单第 22 条勾选与实情不符。改法：在「哪些块能被共享」或「对照源码·开销和什么时候别开」补半句。
2. L85 的 133,120 只给了规则（各组块大小的 lcm）没链出处；各组块大小的唯一出处是 kv-cache-spec，建议补链接（同句的 4 同理）。
3. L65 / L120「照样按全长读 K/V」对 GLM 不完全精确：稀疏 MLA 主注意力每查询最多读 2,051 个挑中位置，扫全程的是 indexer（attention-cost 页口径）。通用机制段可保留，建议半句限定，避免与 attention-cost 页对读时打架。
4. [mark-flood]：89% 标记为 [C]，等级不再携带信息；下次改动时可把推演处（如 L81 的「未实跑」段）细分为 [!]/[I]。另：图 caption 中 block hash 先于正文 L93 的定义出现，caption 里已用「指纹」并置，勉强可读，可在 caption 首现处加「（块指纹）」。

### 跳过的内容

无被拦读取；按模板未读 HANDBOOK、docs/plans/、「对照源码」正文（仅 grep 结构与关键词）、frontmatter sources 区（逐条行号由 audit 与抽查覆盖）。

## P5 修订记录（09-28 二）

按独立审查（8.5/10，无 P1）收尾：

- **P2（断链 3 处）**：选修入链方案（协调方授权）。gqa.md L169 改指 `#哪些块能被共享`；kv-cache-spec.md L240 改指 `#哪些块能被共享`、L298 改指 `#glm-双机上它开着吗`。三处只改链接目标，所在页其余内容未动。
- **P3-1**：「哪些块能被共享」开头补回请求级门槛——被标记「跳过缓存读取」的请求（如要求 prompt logprobs）直接按未命中处理；facts 清单第 22 条已改注。
- **P3-2**：133,120（lcm）与 4（gcd）所在句补链 kv-cache-spec（各组块大小唯一出处）。
- **P3-3**：「省不掉读」与误解节两处加 GLM 限定：主注意力稀疏 MLA 精读挑中位置、indexer 扫全程，链接 attention-cost；保留「命中不减少要读的历史」结论。
- **P3-4**：图 caption 首现 block hash 补「（块指纹）」并重生成 svg；推演/待核处细分角标（命中粒度 640 加 [I]、KDA 留档与 main 粒度待核加 [!]），删两个冗余 [C]（C5、C22 正文角标，来源仍在 sources），[C] 占比降到 79%，mark-flood 提示消除。

验证：pnpm wiki:lint 退出 0、pnpm wiki:audit 退出 0、pnpm wiki:diagrams 重生成后无本页告警；本页与 gqa、kv-cache-spec、vllm-kv-block-allocation 在 lint/audit 输出中均无条目。
