# lmcache 页审查记录

## P5 写作记录（2026-09-29，第 16 批，Opus 写手）

### 改了什么

按新讲法重写整页，正文 4,021 → 约 18,900 字符（audit 口径正文约 9.3k 字），节数 5 → 8。

- 第一屏改成问题式 H2 + 一句话定义 + 直觉图，先讲 A 存 B 取的场景，不开算。
- 直觉图 `wiki/diagrams/lmcache.yaml` 重画：原图是「A 保存 / 外部存储 / B 加载」的左中右三格，看不出 LMCache 自己分层。新图按派发要求画**本地未命中后逐级往外取回**：三条泳道（显存 / LMCache 主机内存层 / 更远的磁盘或远端），段 1、段 2 命中主机内存层，段 3 只在更远那层、要先读到主机内存再进显存，段 4 谁那儿都没有、照常自己算。
- 新增「一次外部命中怎么算：按 chunk 取整」一节，用 chunk = 256（上游自带 adapter 的默认值）演一遍：A、B 各 600 个位置、共享开头 500，外部命中只有 256。旧版把这个结论写成「要看实现的查找和加载粒度」，没有演算。
- 新增「交接边界」一节（本批验收要点）：三个交接点（调度侧问一次 / 执行侧搬两趟 / 结束时收尾）+ 三层代码归属表，明确「引擎交出去块、LMCache 交回来位置数和完成信号」。
- 新增「和 AscendStore 的 KV Pool 有什么不同」对照表（派发要求的重点），六行：实现在哪、存取单位、怎么进显存、分层、混合模型、起名规则。不复制 kv-pool 页的调用链，只做边界对照并链过去。
- GLM 一节从「边界与版本」改写为**结论 + 推演链**：主线没开；且照钉住源码推演，打开会因为「连接器不支持混合缓存管理器 vs GLM 的分组必须要它」两头堵死。
- 已讲过的概念（kv-cache、prefix-caching、kv-cache-cpu-offload、kv-pool）都只留一句话 + 链接。
- 按 09-29 的暂停要求，没有加分镜动图。

### 数字取自哪里

- 每卡每个位置 13,056 B、一块 640 个位置 = 8,355,840 B：`docs/mainline/02-forward.md` §1.4，与部署页 `glm-5-3-flash-two-node.md#占住一个块号要用多少显存` 一致，只引不重算。
- 抢占场景（约 67,000 个位置、按 8,192 预算重算 9 步）：`docs/mainline/01-deploy-entry-schedule.md` §B3，链到 `concurrent-requests.md`，不重算块数。
- chunk = 256：上游自带 adapter 的默认参数（见下），不是昇腾包装定义的值，页面里写明「上游自带 adapter 里的默认值」。
- 本页没有任何 LMCache 的命中率 / 吞吐 / 时延实测数，页面已明写。

### 核心概念对照了什么

按钉住版本读源码（vLLM v0.23.0 = 0fc695fc；vllm-ascend：v0.23 维护分支 2c59ff10、GLM 快照 db701c1f、v0.26 = 2ed6cbba、main = baa023ad）：

1. 注册名与包装：`vllm_ascend/distributed/kv_transfer/__init__.py` L61–L65 在 2c59ff10 / db701c1f / 2ed6cbba 三处都注册 `LMCacheAscendConnector` → 包装模块导出上游 `LMCacheConnectorV1`；包装模块只有 5 行。main（baa023ad）已无此注册，`git show --stat 11e95c105` 显示该 PR 同时删了注册与部署文档里的用法，文档改成「改用 LMCache-Ascend 包自己的注册」。
2. adapter 分派：`lmcache_connector.py` L83–L115，`use_native` 默认 false → 导入外部 `lmcache` 包的 adapter；true → 用 vLLM 仓库自带的 `lmcache_integration/vllm_v1_adapter.py`。
3. chunk 取整与保存规则：`vllm_v1_adapter.py` L296–L340（按 chunk 边界取整、decode 阶段默认不存、尾巴是否丢由 `discard_partial_chunks` / `save_unfull_chunk` 决定）、L655–L670（`chunk_size`、`save_decode_cache` 读配置）、L1140–L1225（lookup 返回外部命中位置数；整条 prompt 全中时减 1）。构造函数默认 `lmcache_chunk_size: int = 256`（L273）。
4. **本页最关键的一条（新结论）**：`LMCacheConnectorV1` 没有继承 `SupportsHMA`（grep `SupportsHMA` 在 0fc695fc 的全部命中里不含 lmcache_connector.py）。于是 `vllm/config/vllm.py` L1479–L1501 在未显式表态时自动关掉混合缓存管理器；而 GLM 的分组要求它开着：`vllm_ascend/patch/platform/patch_kv_cache_utils.py` L517–L531（db701c1f）与 main 的 `vllm_ascend/models/glm5next/cache_config.py` L348–L354 都会直接 `ValueError`。显式要求开着，则 `kv_connector/factory.py` L54–L61 抛「does not support HMA」。两条路径都按代码推断，未实跑，页面按 `[I]` 标注。
5. MLA 相关限制：`vllm_v1_adapter.py` L460–L510（远端序列化必须 naive；MLA + 逐层模式直接 `ValueError`）。
6. 另一条同名家族：`lmcache_mp_connector.py` L70–L83（多于一个缓存组直接 `RuntimeError`，要求 `--disable-hybrid-kv-cache-manager`）。
7. 版本组合：`docs/source/user_guide/feature_guide/lmcache_ascend_deployment.md`，db701c1f 版给 LMCache 0.3.12 配 vllm-ascend 0.11.0 的镜像例子，baa023ad 版只剩一句「不再注册，用插件包自己的配置」。

### 旧版信息清单勾选（清单存 scratchpad/p5/lmcache-facts.md，F1–F16）

- F1 A/B 共享前缀场景 → 第一节保留。
- F2 职责划分（它管外部数据、引擎管调度与显存）→ 「交接边界」一节展开。
- F3 存取不同时、配了连接器不等于每次命中 → 图后说明 + 常见误解第 2 条。
- F4 设备页与外部单位粒度不同 → 对照表「怎么进显存」；旧版「adapter 把段映射到页」这句改成「上游自带 adapter 按 token 的槽位地址拷」（按源码），外部包的映射方式列入待核。
- F5 600/512/88/500 的算例 → 保留结论，改用真实默认 chunk = 256 重演（旧版只说「要看实现粒度」，新版给出 256 这个数）。
- F6 旧版 2 MiB/页、8 MiB 的示意字节 → 换成 GLM 的真实口径（13,056 B/位置），「多 worker 各计」改成「一个 DP 组 8 张卡」；元数据、对齐的影响保留为 calc 旁注。
- F7 不能把别处的 chunk 默认值当通用约定 → 保留（页面写明 256 是「上游自带 adapter 的默认值」，且行为以实际装的包为准）。
- F8 / F9 / F10 / F11 三层代码、`use_native`、四项须钉住的行为、「注册入口存在 ≠ 能用」→ 全部保留在「交接边界」与「对照源码」。
- F12 收益取决于加载成本 → 「代价有五条」第 1 条 + 「开销和什么时候别开」。
- F13 无设备时怎么自查、实测要确认是外部命中 → 「怎么验」一条。
- F14 官方材料依赖社区插件、镜像是旧版本组合 → GLM 一节「版本组合也要自己钉」。
- F15 与 PD 分离共享接口但数据流不同、不能互相推断 → 移到「和 AscendStore 的 KV Pool 有什么不同」一节末尾，并保留「推不出」的结论。
- F16 GLM 外部副本必须含 KDA 与稀疏注意力状态；未核外部包实现 → GLM 一节「形状对不上」条目 + 待核清单。

### 验证

- `pnpm wiki:lint` exit 0（本页 0 报错）。
- `pnpm wiki:diagrams` 重新生成 `lmcache.svg`，图审查对本页 0 条提示；`pnpm wiki:diagrams --check` 本页一致（全库失败的两张是别人正在改的 dyntra-lb）。
- `pnpm wiki:audit` exit 0，全库 0 失败；本页 19 条来源行号全部有效。图 pin 的两条来源已与 frontmatter sources 对齐（协调者提到的 diagram-identifier 失败已消除）。
- 未起服务、未截图、未做浏览器验收。

### 疑点 / 待后续

- 外部 `lmcache` / `lmcache_ascend` 包的实现没有读（本地没装），chunk 与设备块怎么对上、尾巴存不存、加载失败能否退回重算，页面标为待核。
- LMCache-Ascend 插件自己注册的连接器是否声明支持混合缓存管理器，未核；若它声明支持，GLM 上的互斥结论只适用于上游这个连接器。
- 本页 5 与 GLM 的互斥链是按源码推断，未在设备上实跑。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，未改页面）。分数 **7 / 10**。学习顺序通过；`pnpm wiki:audit` 本页通过；P1 1 条，P2 3 条，P3 5 条。

### 本批重点结论：「GLM 上开它会两头抛错」——按钉住源码成立

逐条到源码核实（均为按源码推断，未实跑）：

1. 上游连接器不声明 HMA：vllm@0fc695fc `vllm/distributed/kv_transfer/kv_connector/v1/lmcache_connector.py` L72 `class LMCacheConnectorV1(KVConnectorBase_V1)`，没有 `SupportsHMA`；全仓 `SupportsHMA` 的命中里没有 lmcache 两个连接器。
2. Ascend 注册名指向同一个类：vllm-ascend@db701c1f `vllm_ascend/distributed/kv_transfer/__init__.py` L61–L65 注册 `LMCacheAscendConnector` → `kv_pool/lmcache_ascend_connector.py` L2–L5（先 `import lmcache_ascend`，再导出上游 `LMCacheConnectorV1`）；2c59ff10、2ed6cbba 同样注册，baa023ad 已无。
3. 不表态这条路：`scheduler.py` L132 默认 `None`；`vllm/config/vllm.py` L1479–L1501 在 `None` 时调 `supports_hma_config`，不支持就把 HMA 关掉，只打 warning。昇腾平台 `support_hybrid_kv_cache()` 返回 True（db701c1f `vllm_ascend/platform.py` L889–L890），所以唯一的关闭原因就是这个连接器。关掉后 db701c1f `vllm_ascend/patch/platform/patch_kv_cache_utils.py` L517–L532 对 GLM 直接 `ValueError ... requires the hybrid KV cache manager`；main 在 `vllm_ascend/models/glm5next/cache_config.py` L349–L351 同样抛错。vllm-ascend 里没有任何地方回写 `disable_hybrid_kv_cache_manager`（grep 只见读取）。
4. 显式开着这条路：`kv_connector/factory.py` L54–L59 在 `create_connector` 抛 `Connector ... does not support HMA`。
5. 页面标注：「对照源码 · 会报什么错」写了「两条都按代码推断，未实跑 [I]」，「源码位置」给了上述文件与行号（L1479–L1501、L54–L61、L517–L531），行号核对无误。正文 GLM 一节用「照钉住的源码推演」，并把「GLM 上的设备实测」列入待核。
6. 剩下的缺口（P3-4）：包装模块在导出前先 `import lmcache_ascend`，这次导入会不会改掉上游类，本地没有这个包，没法核。现在的待核只写了「插件自己的连接器」，应该把导入时的副作用也写进去。

### 初学者测试（前两屏）

「LMCache 是挂在引擎外面的一层 KV cache 存储：显存里的前缀被挤掉以后，同开头的下一条请求可以从主机内存、磁盘或远端逐级取回，少做 prefill。代价是取回要等搬运、写入是常态开销、按整单位认、多一套外部依赖，而且不会让显存池变大。」能说清，通过。

学习顺序：是什么（定义 + A/B 例子 + 图）→ 为什么（prefix caching 落空的两种情况）→ 怎么算（chunk 取整 calc）→ 细节（交接边界、和 KV Pool 对照）→ GLM → 常见误解 → 对照源码，通过。基础节没有 GLM 数字；kv-cache、prefix-caching、kv-cache-cpu-offload、kv-pool 都只留一句话加链接，没有重讲。和 KV Pool 的区别用六行表讲清楚了，混合模型那一行也有源码支撑（db701c1f `ascend_store_connector.py` L76 声明 `SupportsHMA`）。扩写没有明显注水。

### P1

**P1-1 外部包决定的行为被写成定论，归属写错，而且和本页自己的待核清单矛盾**
- 位置：L62「只认写满的整单位……连查询都问不出结果」；L68「上游自带 adapter 里的默认值是 256，只有写满的 chunk 才存得进去，查回来的也是整 chunk」；L74 calc「剩 88 个凑不满，不存」；L86、L157「decode 阶段默认不存」；L117 表格「默认 256 个位置」；L136「decode 阶段写满的默认不存」；对照源码 L176「自带 adapter 的 chunk 默认 256、save_decode_cache 默认关」。
- 问题：
  - (a) 256 和「decode 默认关」只是 vllm_v1_adapter.py L273–L276 里 `ReqMeta.from_request_tracker` 这个函数签名上的缺省值。真正调用时（L1345–L1352 等处）总是显式传入 `self._lmcache_chunk_size = config.chunk_size`、`config.save_decode_cache`（L668–L669），而这个 `config` 来自外部包的 `lmcache_get_or_create_config()`（L581，`LMCacheEngineConfig`）。缓冲区的 `chunk_size = lmcache_config.chunk_size` 也一样（L473）。所以即使是自带 adapter，生效的默认值也由外部包决定，本页没读外部包。再加上默认 `use_native=false`（lmcache_connector.py L93–L111），走的根本不是这个 adapter。
  - (b) 尾巴存不存是可配的，不是规则：L661–L665 `discard_partial_chunks = extra_config 缺省 False or not config.save_unfull_chunk`；L323–L332 在最后一段 prefill 且不丢尾时，保存 `input_token_len`（含不满一个 chunk 的尾巴）。「只有写满的 chunk 才存得进去」「凑不满连查询都问不出」和源码的可配逻辑冲突。
  - (c) 查找（`lookup_client.lookup`，L1185 起）在外部包里，「查回来的也是整 chunk」「一个位置不同整块认不出」也是外部行为。
  - (d) 这几条和 L108、L150 自己写的「尾巴存不存……要钉住实际装的 LMCache 版本」「待核：尾巴存不存」互相矛盾。旧版把「只保存完整段」标成假设 [A]，并且明写不能把 256 当约定。新版把假设升成了事实，是回退。
- 改法：L68 改成「chunk 长度和尾巴存不存都由 LMCache 自己的配置决定（`chunk_size`、`save_unfull_chunk`，外部包默认值本页未核）；下面的示意取 chunk = 256，并假设只存整 chunk」。calc 标题写明两条假设。L62 改成「按 chunk 取整；凑不满的尾巴存不存看配置」。decode 那几处改成「是否存由 `save_decode_cache` 决定（外部默认待核）」，同时可以补一条已核的事实：自带 adapter 查询时只拿 prompt 的 token 去问（L1163 `token_ids = request.prompt_token_ids`），生成部分即使存了，这条路径也问不到。L117、L176 的「默认 256」改成「外部配置决定；自带 adapter 函数签名的缺省写 256」。

### P2

**P2-1 分层和取回路径是外部包行为，没标待核**
- 位置：L50「主机内存是最靠前的一层……更远那层的数据要先读到主机内存，再进显存」；L119 表格「自带主机内存这一层」；图的注释「最近用过的段留在这里」「先读到主机内存，再进显存」。
- 问题：vLLM 的例子只能证明有 `local_cpu` / `max_local_cpu_size` / `local_disk` / `remote_url` 这几项配置（`examples/disaggregated/lmcache/...`）。例子里的 PD 配置恰恰是 `local_cpu: False`、`max_local_cpu_size: 0`（`disagg_prefill_lmcache_v1/configs/lmcache-prefiller-config.yaml` L1–L2），说明主机内存层可以关掉。至于经主机内存中转、按最近使用淘汰，是外部包的实现，本页没读。
- 改法：L50 补一句「主机内存层可以关掉；逐级取回的路径和淘汰策略按 LMCache 文档描述，本页未读外部实现」，把它加进 L150 的待核。图注「最近用过的段留在这里」改成中性的「这一层存着段 1、段 2」。

**P2-2 F6 勾选不属实：字节账的限定语丢了**
- 位置：GLM 一节 calc（L138–L144）及其旁注。
- 问题：写作记录说「元数据、对齐的影响保留为 calc 旁注」，实际旁注只写了 KDA，旧版那句「元数据、对齐、压缩或其他存储表示可能进一步改变字节数」丢了。另外，本页自己说自带 adapter 的缓冲形状对不上 GLM（L133），所以 3.19 MiB / 25.5 MiB 只是「按显存布局算、搬进 8 张卡显存的总量」，不是 LMCache 存储侧的字节。按 kv-cache-spec，MLA 与 indexer 在 8 卡上各存一份完整的，存储侧未必存 8 份。
- 改法：calc 标题或旁注写明「8 张卡显存侧合计；外部存储侧的格式、元数据、是否去重由 LMCache 决定，未核」。

**P2-3 「形状对不上」一条对 MLA 描述不准**
- 位置：L133。
- 问题：自带 adapter 的缓冲是 `(num_layer, 1 if use_mla else 2, chunk_size, num_kv_head, head_size)`（L470–L476）。MLA 模型本来就只开一格，不是「K 和 V 各一格」。对 GLM 真正对不上的有两处：层数按模型全部层（含 34 层 KDA 和 MTP）每个位置开一格，而 KDA 没有逐位置缓存；每层没有给 indexer 缓存留位置。
- 改法：改成「按全部层、每个位置开缓冲（MLA 一格，否则 K/V 两格）；GLM 的 34 层 KDA 状态不按位置累积，稀疏 MLA 每层还多一份索引器缓存，这两样都放不进这个形状」。

### P3
1. L99「三层代码拼起来」，下面的表却有四行（注册名、包装、上游连接器、外部包）。改成「四段代码、三方提供」。
2. L63「各自发版的三个软件」和 L193「四者的版本」不一致（漏了 LMCache-Ascend）。
3. 图：第 2、3 层的框标题贴在上一层框的下边线上，显得挤。显存那一行段 1–3 用了淡色格子，没有说明「待填」，和「本地一段都没有」对不上。箭头离段格较远。建议显存行的段 1–3 用空格加「待搬回」标注，框标题再下移一点。
4. 待核清单（L150）补一句：「Ascend 包装在导出前先 `import lmcache_ascend`，它导入时是否改动上游类未核」。
5. L127 这一段的结论句可以直接带上「未实跑」四个字，和对照源码的标注呼应。

### 其他核对
- 图「本地未命中后逐级往外层取回」：结构画对了。查询是自上而下的虚线，数据从外层经主机内存回到显存；段 1–2 命中主机内存、段 3 在更远一层、段 4 自己算，前缀连续，语义自洽。问题见 P2-1 和 P3-3。截图：scratchpad `lmcache-review-diagram.png`（直接渲染 `wiki/diagrams/lmcache.svg`）。
- 数字：13,056 B/位置与 02 §1.4 L148、L506 一致；约 67,000 个位置、按 8,192 预算重算 9 步与 01 L1031 一致；256 × 13,056 = 3,342,336 B ≈ 3.19 MiB，× 8 ≈ 25.5 MiB，手算无误。全页没有虚构 LMCache 实测数。
- 丢信息：旧版 F1–F16 逐条对照，只有 F6 丢了限定语（见 P2-2）。F7 名义上保留，实际被 P1-1 反转。其余属实。
- 链接与锚点：出链锚点全部命中（kv-cache-spec L168、kv-cache-cpu-offload L73、vllm-kv-block-allocation L202、concurrent-requests L227、prefix-caching L75、glm-5-3-flash-two-node L49/L203、kv-pool 两处）。入链只有 kv-pool L143/L182 和 index，都不带锚点。`pnpm wiki:lint` 本页 0 报错（全库唯一失败在 mooncake-connector-hooks 缺 svg，与本页无关）。
- `pnpm wiki:audit` exit 0，本页 19 条来源行号有效。
- 对照源码五个 H3 齐全，顺序正确。版本差异表含 v0.23（2c59ff10）、GLM 快照 db701c1f、v0.26（2ed6cbba）、main（baa023ad）。对照源码以上没有证据角标。

### 跳过
- 页面截图：5193 前端能打开，但后端 8790 没起，页面返回 502，只截到空白。按规则不起服务，改为直接渲染 SVG 图。第一屏排版没有做浏览器验收。
- frontmatter 来源区；对照源码各节正文（只 grep）；代码块。
- 外部 `lmcache` / `lmcache_ascend` 包本地没有，无法核。

## P5 修订记录（09-29，写手）

审查意见 P1 ×1、P2 ×3、P3 ×5 全部处理，页面正文约 9.3k → 10.1k 字。

### P1-1 外部包决定的行为不再写成定论

复核后接受：`ReqMeta.from_request_tracker` 上的 256 与「decode 不存」只是缺省形参，真正调用处（vllm_v1_adapter.py L1346–L1352）显式传 `self._lmcache_chunk_size` / `self._save_decode_cache`，两者来自外部包的配置对象（L581 `lmcache_get_or_create_config()`、L668–L669）；且默认 `use_native=false` 时走的根本不是这套 adapter。

- 「一次外部命中怎么算」开头改成：chunk 长度和尾巴存不存由 LMCache 自己的配置决定（`chunk_size`、`save_unfull_chunk`），外部包默认值未核；示意取 chunk = 256 并假设只存整 chunk。calc 标题同步写上这两条假设。
- 代价一节「只认写满的整单位」改成「按整单位记账……尾巴存不存由配置决定」。
- decode 三处（边界条、GLM 一节、常见误解）改成「存不存是配置」，并补上一条**已核**的事实替代原结论：查询送出去的只有 `request.prompt_token_ids`（L1163），生成部分即使存了也匹配不到。
- 对照表「默认 256 个位置」改成「长度由 LMCache 自己的配置给定」；对照源码那条改成「自带 adapter 每次从外部配置取当前值再传下去；函数签名上的 256 只是缺省形参，生效值未核」。
- 相应条目补进待核清单。

### P2

- **P2-1**：图后一段改写——主机内存、磁盘、远端各是单独的配置项，主机内存这层可以整个关掉（vLLM 例子里的 PD 前缀端就是 `local_cpu: False`）；逐级取回路径与淘汰策略明确写成「外部实现，本页未读」，并进待核。对照表「分层」一行同步改。图注「最近用过的段留在这里」改成中性的「这一层存着段 1、段 2」。
- **P2-2**：GLM 一节 calc 标题改成「要往显存里搬多少」，旁注补回旧版那句限定——外部存储侧的格式、元数据、对齐、压缩以及各卡相同数据是否只存一份都由 LMCache 决定、未核。
- **P2-3**：「形状对不上」改成「按每层 × 每个位置开缓冲，MLA 一格、普通 attention 两格」，并把 GLM 对不上的两处写准：34 层 KDA 不按位置存；每层还多一份索引器缓存，形状里没有它的位置。

### P3

1. 「三层代码」→「四段代码，来自三方」。
2. 代价一节的「三个软件」→ 四个（补 LMCache-Ascend），与「开销」一节的四者口径一致。
3. 图：显存那一行改成空格 + 「待搬回」，三层框间距由 20 加到 34（框标题不再贴上一层的下边线），上下箭头缩到只跨层间空隙，画布高 372 → 424。
4. 待核补「昇腾包装导出前先导入插件包，这次导入是否改动上游类，未核」。
5. GLM 一节结论句补「按钉住源码推断、未实跑」。
6. 顺手修：正文「最后一行是本页和 GLM 最相关的一条」指错了行，改成「表里『混合模型』那一行」；删掉版本差异表里一处重复角标，内联标记回到 30 以内。

### 验证（09-29 修订后）

- `pnpm wiki:lint`：本页 0 报错。全库当次失败 1 处，在别人正在改的 `concepts/dp-request-routing.md`（锚点 `#会报什么错` 暂缺）。
- `pnpm wiki:diagrams`：重新生成 `lmcache.svg`，本页 0 条图审查提示；`--check` 全库一致，exit 0。
- `pnpm wiki:audit`：本页 19 条来源全部有效、0 条 ✗。全库当次失败 2 处，都是别人的页（`diagrams/lm-head-split.yaml`、`concepts/kv-cache-sparse-offload.md` 的一条越界行号）。
- 仍未做：外部 `lmcache` / `lmcache_ascend` 包的实现、设备实测、浏览器验收。

## P5 复审（09-29）

复审员：Opus 5.5（独立复审，只审不改，未开子代理）。范围：上轮 P1 ×1、P2 ×3 的修订；全页外部包行为措辞复查；丢信息抽查；audit。分数 **7 / 10**（上轮 7）。上轮 P1-1 与三条 P2 都改对了；但本轮为替换「decode 不存」新写的一条「已核事实」推错了，新增 P1 1 条；新增 P2 1 条，P3 3 条。

### 上轮 P1-1：已修好
- chunk 默认 256：正文 L68、对照表 L117、对照源码 L177 都改成「由 LMCache 自己的配置给定、外部默认值未核」；示意 calc 标题 L73 写明「chunk = 256、只存整 chunk」两条假设。核源码 vllm@0fc695fc `vllm_v1_adapter.py`：L269–L276 形参缺省 256 / `discard_partial_chunks=True` / `save_decode_cache=False`；L661–L669 实际取 `config.chunk_size`、`config.save_unfull_chunk`、`config.save_decode_cache`；L581 的 `config` 来自外部包。页面描述与源码一致。
- 尾巴存不存：L62、L68、L108 均改成由配置决定，L151 待核列入；与 L323–L331 的可配逻辑一致，不再自相矛盾。
- decode 存不存：L86、L158、L177 改成配置项、外部默认待核（但 L86、L158 的后半句推错了，见 P1-N1）。
- 分层与取回路径：L50、L119、L179 改为「配置项 + 外部实现未读」，并入 L151 待核。
- 全页复查的残留：查找按整 chunk 认没标来源（P2-N1）；GLM 一节「整 chunk」漏了假设前提（P3-N1）。L61、L193「每写满一个 chunk 付一次外部写入」有本仓依据（L304–L317 的 `chunk_boundary` 跳过逻辑），不算问题。

### 关键结论「GLM 上开它会抛错」：保留，出处正确
逐条重核（按源码推断、未实跑，页面也这么标）：
- 结论仍在：GLM 一节 L127–L129、会报什么错 L186、别开 L197、常见误解 L161；L147 写明「按钉住源码推断、未实跑」。
- vllm@0fc695fc `lmcache_connector.py` L72：类只继承 `KVConnectorBase_V1`，没有 `SupportsHMA`。
- `vllm/config/vllm.py` L1479–L1501：未表态时 `supports_hma_config` 为假就关 HMA、只打 warning（[C10] 行号准）。
- `kv_connector/factory.py` L54–L61：HMA 开着且连接器不支持时抛 `does not support HMA`（[C11] 准）。
- vllm-ascend@db701c1f `patch_kv_cache_utils.py` L517–L531：GLM 分组函数在 HMA 被关时抛 `requires the hybrid KV cache manager`（[C12] 准；闭括号在 L532，不影响）。
- vllm-ascend@baa023ad `models/glm5next/cache_config.py`：抛错在 L352–L353，frontmatter 引用 L348–L354 覆盖（[C13] 准）。
- db701c1f `kv_transfer/__init__.py` L61–L65 注册 `LMCacheAscendConnector` → 上游 `LMCacheConnectorV1`；baa023ad 同文件已无 lmcache 注册。

### 上轮三条 P2：都改对
- P2-1：L50 改写到位，表格 L119 同步，图注改成中性的「这一层存着段 1、段 2」（yaml L49）。图里数据箭头仍画成远层→主机内存→显存两段（yaml links 第 3、4 条），但 L50 已声明只按配置画分层、路径未核，可接受（P3-N3 可选改）。
- P2-2：calc 标题 L139 改成「要往显存里搬多少」，L143–L144 旁注补回格式、元数据、对齐、压缩、各卡是否去重都未核。256 × 13,056 = 3,342,336 B ≈ 3.19 MiB，× 8 ≈ 25.5 MiB，复算无误。
- P2-3：L133 改成「每层 × 每位置，MLA 一格、普通 attention 两格」，与 adapter L476 `kv_shape = (num_layer, 1 if use_mla else 2, chunk_size, ...)` 一致；GLM 对不上的两处（KDA 不按位置存、稀疏 MLA 多一份索引器缓存）写准。L134 逐层 MLA 抛错与 L507 一致。

### 丢信息
- 旧版信息清单存在：会话 13898c74 的 scratchpad `p5\lmcache-facts.md`（F1–F16）。
- 抽 5 条：F3（副本须存成功、未淘汰、兼容）→ L156 ✓；F7（不能把 256 当通用约定）→ L68、L177 ✓（上轮被反转，本轮恢复）；F13（无设备可列位置数 / 字节 / 需执行数，实测要确认真从外部搬回）→ L70–L79、L138–L145、L198 ✓；F15（与 PD 分离共享接口但不能互推）→ L123 ✓；F10（须钉住版本才能回答的几件事）→ L108 部分保留，旧版「支持哪些缓存规格和并行布局」里的「并行布局」丢了（P3-N2）。4 条过，1 条部分过。
- git diff：p4-checkpoint 与 HEAD 相同，工作区 diff 含本批首轮重写和本轮修订，没有修订前的单独快照。按上轮审查的行号和修订记录逐处对照，本轮删掉的只是被 P1-1 判错的定论句（凑不满连查询都问不出、只有写满的才存得进、decode 默认不存、默认 256 个位置），没有删掉别的事实。

### 新增 P1

**P1-N1 「生成出来的内容不能被下一条请求复用」推错了（本轮新写的「已核事实」）**
- 位置：L158 常见误解第 4 条；L86 边界第 2 条后半句；L178 措辞也缺限定。
- 问题：源码事实只是「自带 adapter 查询时拿**当前这条请求**的 `request.prompt_token_ids` 去问」（`vllm_v1_adapter.py` L1164，[C6] L1140–L1225 覆盖）。本轮把它推成「生成部分匹配不到 / 不能被下一条请求复用」，推理不成立：
  - 存的一侧会带上生成的 token：`RequestTracker.update` 在 decode 时把新 token 追加进 `token_ids`（L214–L223），`save_decode_cache` 打开时 decode 阶段不跳过保存（L316），存进去的内容里就有生成部分。
  - 下一条请求的 prompt 可以带着上一条生成的内容，典型是多轮对话：第二轮 prompt = 第一轮 prompt + 第一轮回答 + 新问题。按本页自己说的「按内容整块认」，第二轮能命中第一轮回答所在的 chunk。即便 `save_decode_cache` 关着，第二轮 prefill 时也会把含第一轮回答的这段存下，供第三轮复用。
  - 所以把「生成内容也能被下一条复用」列为误解是错的，还和 L196「适合开：多轮对话」相矛盾。源码真正支持的只有：**同一条请求**重新查询时（如 L136 讲的被抢占后）只拿自己的 prompt 去问，自己生成的那段补不回来。L136 的用法是对的。
  - 另外 [C6] 是 `use_native=true` 的自带 adapter，默认走外部包 adapter（L176）；L86「有一条是核到的」没交代只核了自带 adapter。
- 复现：`git -C tools/repos/vllm show 0fc695fc:vllm/distributed/kv_transfer/kv_connector/v1/lmcache_integration/vllm_v1_adapter.py | sed -n '214,223p;313,317p;1164p'`。
- 改法：L158 删掉这条，或改成「生成内容能不能被后来的请求复用，取决于它有没有被存下（`save_decode_cache`，外部默认待核）以及后来请求的 prompt 里是否带着同一段内容（例如多轮对话把上轮回答放进历史）」。L86 后半句改成「核到的一条（仅自带 adapter）：同一条请求重新查询时只拿它自己的 prompt 去问，所以被抢占的请求补不回自己已生成的那段」。L178 同样补「同一条请求、自带 adapter」的限定。

### 新增 P2

**P2-N1 「按内容整块认」仍是外部查找行为，没标来源也没进待核（上轮 P1-1(c) 未处理）**
- 位置：L81「chunk 按内容整块认，一处不同整块认不出」；连带 L157、L197「取整后为 0」、L62「存和取」的「取」。
- 问题：保存按 chunk 对齐有本仓依据（adapter L304–L331），但「查找按 chunk 的内容指纹匹配、chunk 内一处不同就整块不中」由外部包的 `lookup_client.lookup`（L1186）决定，本页没读。修订记录没提上轮 (c) 这一项，L151 待核也没有「查找按什么粒度匹配」。这条与 LMCache 公开设计相符，大概率是对的，所以不定 P1，但仍属「外部行为写成定论」。
- 改法：L81 句尾补「（查找在外部包里，这里按它以 chunk 为单位、按内容识别的设计推，本页未读实现）」；L151 待核加「查找按什么粒度匹配」。L157、L197 引用的是上面的示意，不必逐处改。

### P3
1. P3-N1：L136「最多补回它 prompt 里整 chunk 的部分」把「只存整 chunk」这条示意假设带出了 calc；若 `save_unfull_chunk` 打开，prompt 尾巴也可能补回。改成「最多补回它 prompt 的部分（按上面只存整 chunk 的示意，就是整 chunk 那部分）」。
2. P3-N2：F10 的「并行布局」丢了。L108 或 L151 补「支持哪些并行布局（TP / DP 下各卡各存一份还是合并）」，和 L144 的去重待核呼应。
3. P3-N3（可选）：图里远层的「搬回」箭头经主机内存中转，正文 L50 已说路径未核；想完全一致可把这段箭头改虚线，或图注写「路径示意」。

### 验证
- `pnpm wiki:audit`：exit 0；本页 19 条来源全部 ✓、0 条 ✗；全库行号越界 0、文件不存在 0，名单页写作标准 73/73 达标。
- 源码核对：`git -C tools/repos/vllm show 0fc695fc:<path> | sed -n ...` 与 `git -C tools/repos/vllm-ascend show db701c1f|baa023ad:<path> | sed -n ...`，行号见上。

### 跳过
- 没重审整页讲法与学习顺序（上轮已过，本轮没改结构）。
- frontmatter 来源区（只 grep 了几条源码路径的行号）；没跑 `pnpm wiki:lint`；没做浏览器验收（不起服务）。
- 外部 `lmcache` / `lmcache_ascend` 包本地没有，P2-N1 与待核各项无法核。

## P5 复审后修订（10-02）

修订人：写手（Fable 5，未开子代理）。范围：只修复审新增的 P1-N1、P2-N1；P3 三条未动。

### P1-N1：已修（采纳复审意见）
- 先核源码确认复审推理成立：`git -C tools/repos/vllm show 0fc695fc:...lmcache_integration/vllm_v1_adapter.py`——`RequestTracker.update` 把新 token 追加进 `token_ids`（L214–L223）；`skip_save` 条件含 `is_decode_phase and not save_decode_cache`（decode 打开配置就存）；查询只拿 `request.prompt_token_ids`（L1164）且查找在外部 `lookup_client.lookup`（L1186）。所以「生成内容不能被下一条请求复用」确实推错了。
- L86：后半句改成「核到的一条（仅 vLLM 自带的 adapter）：同一条请求重新查询时只拿它自己 prompt 的 token 去问，所以被抢占的请求补不回自己已生成的那段」，补上「仅自带 adapter」限定。
- 常见误解第 4 条（原 L158）：误解反转为「自己生成的内容反正复用不了」，纠正里分两头：同一条请求补不回；后来的请求把这段带进 prompt（多轮对话）且当初被存下（`save_decode_cache`，外部默认待核）就能认出。与 L196「适合开：多轮对话」不再矛盾。
- 对照源码（原 L178）：改成「仅自带 adapter」+「同一条请求补不回自己已生成的那段；后来的请求 prompt 里带着这段内容则不在此限」，[C6]（L1140–L1225）仍覆盖该函数，引用不动。

### P2-N1：已修（采纳复审意见）
- L81 句尾补「（查找这一步在外部包里，这里按它以 chunk 为单位、按内容识别的设计推，本页没有读它的实现）」。
- 待核清单（原 L151）第一组加「查找按什么粒度匹配」。
- L157、L197 按复审意见不逐处改（引用的是上面的示意）。

### 验证
- `pnpm wiki:lint`：通过，lmcache 页 0 报错（7 处待留意均为其他页）。
- `pnpm wiki:diagrams --check`：271 张图与 spec 一致，输出中无 lmcache 条目。
- `pnpm wiki:audit`：exit 0；本页 19 条来源全部 ✓，行号越界 0、文件不存在 0，名单 74 页达标 74 页。

## P1 复核（10-02）

复核员：Fable 5（独立复核，只核 P1-N1，未开子代理，不改页面）。结论：**P1-N1 确认修好**。页面 `wiki/concepts/lmcache.md` L86、L158、L178 三处均已按复审意见改为「同一条请求补不回（仅自带 adapter）／后来的请求 prompt 带着这段且被存下则能复用」。独立 grep vllm@0fc695fc `vllm_v1_adapter.py` 核实：L1164 查询只送 `request.prompt_token_ids`；L223 `RequestTracker.update` 把新 token 追加进 `token_ids`；L316 跳存条件为 `is_decode_phase and not save_decode_cache`（配置打开即存）；L1186 查找在外部 `lookup_client.lookup`；L669 实际取 `config.save_decode_cache`（外部默认待核的措辞成立）；[C6] 覆盖区 L1140–L1225 恰为 `get_num_new_matched_tokens`（下一个 def 在 L1230）。
`pnpm wiki:audit` 实跑：exit 0，本页 19 条来源全部 ✓，全库 ✗ 0、行号越界 0、文件不存在 0，名单 74/74 达标。

### 补：hedge-ratio 达标（10-02，同日协调人追加）
本页入名单后 [hedge-ratio] 3/86=3.5% 超线。改法：L86、L158 括注里「默认取值待核」改为确定表述「取值由外部包的配置给定 / 在外部包的配置里」（配置项存在已核，[C8]；默认值这项不确定性保留在集中待核清单里，未删）；集中待核段落从 GLM 节末移到页末（照 acl-graph 等页惯例，源码位置表之后），正文不再散落免责括注。复验：wiki:audit 名单 75/75 达标、lint / diagrams 本页 0 报错。
