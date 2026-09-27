# 审查：wiki/concepts/glm-5-3-flash-two-node.md

- 审查日期：2026-09-27
- 被审文件：`wiki/concepts/glm-5-3-flash-two-node.md`（286 行），以及它引用的 4 份图 spec：`wiki/diagrams/glm-two-node-{topology,groups,card-budget,startup}.yaml`
- 核对依据：主线底稿 `docs/mainline/01/02/03`（只用 grep 查数，加上 02 §1.3、§4.4、§6.4、§7.5 和 01 §0、A0.5、A2.2、B1 这几小段的定点阅读）、`wiki/TERMS.md`（grep）、`tools/repos/vllm`（HEAD = `0fc695fc`）、`tools/repos/vllm-ascend`（用 `git show db701c1f:` 读；教程用 `git show 0576b647:` 做 grep）
- 没有读取被拦截的文件。没读 HANDBOOK.md 和 docs/plans/。

## 一、10 项评分

| # | 项 | 分 | 理由 |
|---|---|---|---|
| 1 | 开头一两句话讲清这一页讲什么 | 2 | L49 一句话交代了「2 台 × 8 卡 = 16 卡、后面各章都按它算」，初学者能立刻明白这页的用途。 |
| 2 | 在「一条请求」主线上的位置、为什么需要 | 1 | 参数表的「管住主线的哪一步」一列（L188–201）和末尾「后果」一节（L222–233）有交代，但全页没有一段讲「一条请求进来后在这 16 张卡上经过哪里」：API server 在机器 0 分词 → 协调器选 DP 组 → EngineCore 调度 → 8 个 worker 前向 → MoE 跨机 → 结果回到机器 0。只在 L233 给了一个链接。 |
| 3 | 每张卡的具体数字、算式能否复核 | 1 | 数字很多，也大多和底稿一致（核了约 45 个）。但有 5 处算不回来或对不上：KDA 行 1149.0（L94）、单机「二十多 GiB」（L51）、预算算式悄悄换成「约 21 GiB」（L139）、预算图「预算外 10.02」（card-budget.yaml）、MTP 540.75 的组成说不全（L108）。另外「一个副本 / 两个完整副本」前后矛盾（L49 与 L57）。 |
| 4 | 图有没有用 | 1 | topology 和 groups 两张图确实帮人理解「谁跟谁一组」，groups 图把 {0,8}…{7,15} 画出来尤其有用。card-budget 图的思路对，但数字自相矛盾，还把图内存画进了预算。startup 图基本是把七个小标题排成方框，没增加信息（没画出哪台机器、哪个进程做哪一步）。 |
| 5 | 逐步推演 | 1 | 640 token 块（L118–123）、每块字节数（L127–133）、进程数（L163–172）、图尺寸换算成请求数（L182）都推得很好。但有几个关键数只给结论：每请求 12 个 KDA 块为什么是「每组 4 块」（L149）、MTP 540.75 MiB 由哪几项组成（L108）；另外预算算例和上面的权重表用的不是同一个数（L139）。 |
| 6 | `## 对照源码` 抽查 | 1 | frontmatter 里 21 处 `repo@commit:path#Lx-Ly` 全部核了，**行号都对得上**。但有 3 处引用的代码不支持页面结论：C18 显示门槛 128 取自 `max_cudagraph_capture_size`，页面却写成「= max-num-seqs 32 × 4」；C21 显示每步对齐默认走 `cpu_group`，页面 L83 却说是 HCCL；「版本差异」说 prefix caching 的判定被补丁改写过，但补丁只**读**这个开关，判定在上游 C19。 |
| 7 | 常见误解和坑 | 2 | 覆盖面好：DP 执行组和 DP 通信组的区别（L83）、block_size 的五种含义（L209）、64GB 和 64GiB（L215）、prefix caching 默认是关着的（L207）、空闲组陪跑（L227）、图模式取两组的最小值（L228）。扣分问题另记：其中「任何一个 prefill 都会翻到 All-Gather」这条坑本身写错了（见 P1-5）。 |
| 8 | 术语 | 1 | process group、rank、KV cache、HCCL、graph mode、MTP、worker、EngineCore、headless 第一次出现时都有中文解释，英文名也用对了。但 KDA、稀疏 MLA、索引器、mHC、router gate、MC2、scheduler、prefill/decode、eager、chunked prefill、W8A8、kernel 块在第一次出现时没有解释（见 P2-9）。大小写也和 TERMS 不一致：TERMS 写 `KV Cache`、`Chunked Prefill`。 |
| 9 | 否定式免责句占比 | 2 | 按脚本统计（去掉代码块和标题，按。！？；切句）：212 句里含「不能/不等于/尚未/并非/不代表」的有 **0 句，占 0%**，低于 3% 的目标。放宽到「不是/没有/不会/不影响/无法/没写」时是 24 句（11.3%），逐句看过，都是在给答案（比如「默认值不是开，而是关着的」），不是用来代替答案的。 |
| 10 | 玩具规模例子；术语先用后解释 | 0 | 全页没有玩具规模的例子，比如「2 台 × 2 卡」演示 rank 怎么编、DP 组怎么配对，或者「一条 7 token 的请求拿走 15 个块」的小账。先用后解释的情况有好几处：MC2 在 L76 出现，到 L226 才解释；KDA 在 L87 出现，到 L116 才部分解释；稀疏 MLA 和索引器从头到尾都没解释。 |
| | **总分** | **12 / 20** | |

## 二、约束检查

| 约束 | 结果 |
|---|---|
| `## 对照源码` 下的 H3 只能是五个固定名 | 通过（L237 怎么开 / L243 会报什么错 / L249 开销和什么时候别开 / L256 版本差异 / L262 源码位置） |
| `## 对照源码` 以上的正文没有证据角标 | 通过（L46–234 grep `[C*]/[D]/[S*]/[A]/[!]`，0 处） |
| 没有链接指向已合并的页 id | 通过（7 个 id 都是 0 处）；另外 17 个正文链接和 7 条 relations 指向的页都存在 |
| 「待核」写清缺什么 | 部分通过：L215–217 写清了；L218、L220 其实可以当场核掉（见 P2-3、P2-8）；L219 和 L220 后两项没写缺什么证据、影响多大（见 P3-9） |

## 三、问题清单

### P1（事实或数字错误）

**P1-1 KDA 行的合计错了**
- 位置：`wiki/concepts/glm-5-3-flash-two-node.md:94`
- 问题：`34.61 MiB × 34 层 = 1149.0 MiB` 算错了，34.61 × 34 = **1,176.7 MiB**。
- 证据：主干小计 20,537 MiB（L102）只有用 1,176.7 才加得回来：151.25 + 1,176.74 + 54 + 409.75 + 18,144 + 126 + 189 + 135 + 151.25 = 20,536.99。用 1149.0 加出来是 20,509.25。底稿 02 §4.4（`docs/mainline/02-forward.md:285`）写的是「34 层合计 **1.149 GiB**/卡」，02 §1.3（`02-forward.md:120`）抄成了 `1149.0 MiB`，单位错了，页面照搬了这个错。
- 建议：L94 改成 `× 34 层 = 1,176.7 MiB`，底稿 02 §1.3 L120 也同步改。

**P1-2 「为什么一台机器不够」的数字和结论都不成立**
- 位置：L51
- 问题：「把这些权重按 8 张卡摊开，一张卡还要放二十多 GiB」错了。二十多 GiB（20.58）是 **16 卡 EP16** 下的数。单机 8 卡时每卡要放 36 个专家：每卡非专家部分 2,502 MiB（`01-deploy-entry-schedule.md:352`），加上专家 43 层 × 36 × 24 MiB = 37,152 MiB，合计约 **38.7 GiB**。按本页自己的假设（64 GiB × 0.85 − 38.7 − 3.4），单机还剩约 12.3 GiB 给 KV，大约 1,578 块、101 万 token，并不是「顶不住」。
- 证据：路由专家每卡每层 432 MiB / 18 个 = 24 MiB 一个（L97、L57）；底稿里没有单机的推算（grep「单机」「EP8」都是 0 处）。
- 建议：改成可复核的对比：「单机 EP8 每卡权重约 38.7 GiB，按同一假设 KV 只剩约 12.3 GiB，是双机的 41%」。双机的理由写成「官方教程对 A2 的要求 + KV 容量」，别用「单机放不下」。

**P1-3 「一个模型副本」和「两台各是一个完整副本」前后矛盾**
- 位置：L49「一共 16 张卡，跑一个模型副本」；L57「两台机器各是一个完整副本」；L83「两台机器各是一个模型副本」
- 问题：EP=16 时，288 个专家摊在两台机器上，每台只有 144 个，所以哪台机器都不是「完整副本」。attention 和稠密层确实每台各一份，专家全局只有一份。初学者读到 L49 和 L57 会不知道该信哪句。
- 证据：L57 EP 行「288 个路由专家摊到全部 16 张卡上」；`vllm_ascend/distributed/parallel_state.py@db701c1f#L84-L96` 的 MC2 组覆盖 16 rank。
- 建议：统一成一句：「attention、稠密层和共享专家每台机器各一份（DP=2），路由专家 16 张卡合起来只有一份（EP=16）；所以每台机器是一个调度单位（执行组），但不是一个完整副本。」

**P1-4 「每卡放一整份的只有两块」列得不全**
- 位置：L87
- 问题：页面说「还有两块权重每张卡各放一整份：`fused_qkv_a_proj` 和 `wk_weights_proj`」。实际上每张卡各放一整份的还有：索引器 `wq_b`（BF16，12 MiB，比 `wk_weights_proj` 的 1.25 MiB 大得多）、`index_kpool_compress_gate`、KDA 的 `f_a_proj`/`g_a_proj`、router gate（4.5 MiB/层）、mHC 参数、MTP 的 `eh_proj`（64 MiB）。
- 证据：`git show db701c1f:vllm_ascend/models/glm5_next.py` 第 1270 行是 `index_kpool_compress_gate = nn.Parameter`，1277 行是 `wq_b = ReplicatedLinear`，1598/1657 行是 `f_a_proj`/`g_a_proj = ReplicatedLinear`；底稿 `02-forward.md:390-399, 519, 585, 804`。
- 建议：改成「不切 TP、每卡一整份的有：MLA 的 `fused_qkv_a_proj`、整个索引器（`wq_b`、`wk_weights_proj`、`compress_gate`）、KDA 的 `f_a/g_a_proj`、router gate、mHC 参数，以及 MTP 的 `eh_proj`」，再加一句：索引器 32 个头每张卡各算一遍，是用冗余计算换掉一次通信。

**P1-5 「混进任何一个 prefill 就翻到 All-Gather」说过头了**
- 位置：L226（小标题和正文）；源码节 L251 也沿用了这个说法
- 问题：MoE 通信方式**只看 DP 组内最大 token 数是不是超过 128**，和批里有没有 prefill 无关。一个很短的 prefill 如果加起来不超过 128，照样走 MC2。
- 证据：`vllm_ascend/ascend_forward_context.py@db701c1f#L250-L252`（`num_tokens <= mc2_tokens_capacity` 就返回 MC2，没有别的条件）；底稿 02 §6.9 就用 R1 的 4 token prefill 走 MC2 当例子（`02-forward.md:735`）。底稿 02 §6.4 `02-forward.md:642` 也有同样的过度概括。
- 建议：小标题改成「DP 组里最大 token 数超过 128，两台机器一起从 MC2 翻到 All-Gather」。正文写：32 个请求全是 decode 时正好 128，仍然走 MC2；这时任何多出来的 token（比如一段 chunked prefill）都会越线。底稿 L642 同步改。

**P1-6 预算图的分段加起来不等于预算**
- 位置：`wiki/diagrams/glm-two-node-card-budget.yaml:11-17`
- 问题：权重 20.58 + 激活与图 3.4 + KV 30 = 53.98 GiB，但预算是 54.4 GiB；「预算外 10.02」也不对，应该是 64 − 54.4 = **9.6 GiB**。中间有 0.42 GiB 没画出来。原因是正文算例用了「约 21 GiB」，图里却用 20.58。
- 证据：同一张图 L21 写的就是「预算 = 64 × 0.85 = 54.4 GiB」。
- 建议：和 P2-1 一起改。要么全用 20.58（KV 就变成 30.42 GiB、3,909 块），要么在图和正文里都写「权重按 21 GiB 取整（多留 0.42 GiB 余量）」，把「预算外」改成 9.6。

### P2（违反页面标准或约束 / 初学者读不懂的关键段落）

**P2-1 预算算例换了权重数，却没说为什么**
- 位置：L139（`减权重 − 约 21 GiB`）
- 问题：上面的表刚算出 20.58 GiB，算例却用「约 21」。读者照表复核会得到 54.40 − 20.58 − 3.4 = 30.42 GiB，也就是 3,909 块，和页面的 3,855 对不上。底稿 01 A0.5（`01-deploy-entry-schedule.md:134, 231`）写明了「向上取整按 ≈21」，页面把这句说明丢了。
- 建议：在算例上方补一句「为了和后面各章的块数（3,855）保持一致，权重按 21 GiB 取整」，或者全链改用 20.58。

**P2-2 把图内存算进「切 KV 前要扣掉的」，和代码的顺序不一致**
- 位置：L135、L140；card-budget.yaml L12、L16
- 问题：页面把「激活峰值 + 图内存 3.4 GiB」放在切 KV 之前扣掉。代码里可用 KV = 预算 − (权重 + 激活峰值 + 非 torch)，激活峰值是**在图捕获之前**量的；图是切完 KV 之后才捕获的，它的内存从 0.85 以外那部分出，不从 KV 里扣。页面 L178 第五步的文字其实写对了（权重、激活峰值、非 torch），算例和图却和它不一致。
- 证据：`vllm_ascend/worker/worker.py@db701c1f#L557-L590`（注释写着 "Record torch peak ... BEFORE graph capture"；`available_kv_cache_memory_bytes = requested_memory - non_kv_cache_memory`），`#L716-L718`（`capture_model()` 在这之后调用）。底稿 01 A0.5 L231 也把图内存算了进去。
- 建议：算例里的 3.4 改名为「激活峰值 + 非 torch 占用（假设）」；图内存单独标在预算外的 9.6 GiB 里，并说明「图是切完 KV 之后才录的」。底稿同步改。

**P2-3 每步对齐默认走 CPU（gloo），页面写成了 HCCL；这条待核其实已经能关掉**
- 位置：L83（「HCCL…那 8 个跨机配对的两卡小组，用来让两台机器每一步走得一样宽」）、L75、L218（待核）
- 问题：每一步对齐 token 数和图模式，走的是 `get_dp_group()` 的 `cpu_group`（gloo）；只有 `dp_allreduce_on_npu=True` 时才走 HCCL 的 `device_group`。这个开关默认是 False，而官方教程里没有 `additional-config`。
- 证据：`vllm_ascend/worker/model_runner_v1.py@db701c1f#L715-L723`；`git show db701c1f:vllm_ascend/ascend_config.py` 第 317 行 `dp_allreduce_on_npu = additional_config.get("dp_allreduce_on_npu", False)`；在教程 `0576b647:.../GLM5.3-Flash.md` 里 grep `dp_allreduce|additional` 是 0 处。
- 建议：L83 改成：「这 8 个两卡小组各有一个 HCCL 通道和一个 CPU（gloo）通道：每步对齐走 CPU 通道（默认），MoE 走 All-Gather 路径时的 DP All-Gather / Reduce-Scatter 走 HCCL 通道（见 02 §1.2 L113）」。然后删掉 L218 这条待核。

**P2-4 门槛 128 的来源写错了因果**
- 位置：L197（「也定死了最大图尺寸 128」）、L226、L251（「门槛 128 = max-num-seqs 32 × 4 [D]」）
- 问题：这套部署里 `mc2_tokens_capacity` 取的是 `max_cudagraph_capture_size`，也就是教程显式写的 `cudagraph_capture_sizes` 里最大的 128；`max_num_reqs × uniform_decode_query_len` 只是没配图尺寸时的备选分支。`max-num-seqs` 也没有「定死」图尺寸，图尺寸是教程在 `--compilation-config` 里直接写的。两者相等是教程有意配成一致的结果。如果只把 `max-num-seqs` 改成 64，门槛还是 128。
- 证据：`vllm_ascend/ascend_forward_context.py@db701c1f#L206-L209`；教程 `GLM5.3-Flash.md` L290、L340 的 `cudagraph_capture_sizes`；底稿 `02-forward.md:636-639`。
- 建议：写成「门槛 = 最大图尺寸 128（代码直接读这个值），教程把它配成正好等于 32 个请求 × 4 个 token，所以满载的纯 decode 步刚好不越线」。L197 删掉「定死了最大图尺寸」。

**P2-5 MTP 那一段会让人以为每张卡放了 288 个专家，540.75 也凑不出来**
- 位置：L108；topology.yaml L30（「整套 540.75 MiB」）
- 问题：「每张卡都常驻一整套……自己的一整组 288 选 8 专家」，初学者会读成每张卡都放了 MTP 的 288 个专家。实际上每卡只有 18 个（432 MiB），MLA 也是按 TP 切的。另外，文中列出的几项（37.25 + 432 + 3 + 4.5）合计只有 476.75，漏了 `eh_proj` 的 64 MiB。
- 证据：`vllm_ascend/models/glm5_next_mtp.py@db701c1f#L53-L57`（`eh_proj = nn.Linear(8192→4096)`，不切 TP）；底稿 `02-forward.md:804-811`；`01-deploy-entry-schedule.md:339`（「其中 18 个专家 432 MiB」）。
- 建议：改成「MTP 层有自己独立的一套 MLA、索引器和 288 个专家（不和主干共用），按同样的切法摊到 16 张卡上。每卡：MLA + 索引器 37.25、18 个专家 432、共享专家 3、router gate 4.5、`eh_proj` 64（不切 TP）= 540.75 MiB」。图里「整套」改成「每卡 540.75 MiB」。

**P2-6 「每组 4 块」没讲为什么**
- 位置：L149
- 问题：12 个块这个数是短请求吃块的关键，但「每组 4 块」没有解释，读者复核不了。
- 证据：底稿 `01-deploy-entry-schedule.md:625`：`ceil((7 + 133120×3) / 133120) = 4`，也就是 1 页真状态加 3 页投机 lookahead。
- 建议：补一句「因为开了 MTP，每个 KDA 组要给 1 个当前状态加 3 个草稿位置各留一页，所以每组 4 块；再加上 full 组 1 块、索引器状态组 2 块，一条 7 token 的新请求一共拿 15 块，约 119.5 MiB」。这一句正好可以当作第 10 项要求的小例子。

**P2-7 「版本差异」里关于 prefix caching 的说法和本页自己的结论矛盾**
- 位置：L259（「块大小、KV 分组、prefix caching 的判定都被 `vllm_ascend/patch/platform/` 下的补丁改写过」）
- 问题：prefix caching 开不开由上游 `is_prefix_caching_supported` 决定（本页 C19）。Ascend 的补丁只**读** `enable_prefix_caching` 这个值，用它来定 `mamba_block_size` 和哈希块，没有改判定。
- 证据：在 `db701c1f:vllm_ascend/patch/platform` 下 grep `is_prefix_caching_supported` 是 0 处；`prefix_caching` 只出现在 `patch_kv_cache_utils.py:377, 403`、`patch_mamba_config.py:222`，三处都是读取。
- 建议：改成「块大小、KV 分组被补丁改写过；prefix caching 的开关沿用上游的判定，补丁只根据它来决定 KDA 块大小」。

**P2-8 待核里有一项其实能直接核掉，另外两项没写缺什么**
- 位置：L220
- 问题：「机器 0 是否带 `--data-parallel-start-rank`」查教程就能回答：机器 0 的命令里有 `--data-parallel-start-rank 0`（`0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` L275）。`--api-server-count` 和草稿 `enforce_eager` 两项没写需要什么证据、影响哪条结论。
- 建议：删掉第三项。`enforce_eager` 那项直接写成结论：教程的 `--speculative-config` 里有 `"enforce_eager": true`（L289、L339），草稿模型永远走 eager；还没核的只剩「它会不会影响主模型的图选择」。

**P2-9 术语先用后解释，或者从头到尾没解释**（第 8、10 项）
- 位置和问题：
  - L76 表头「EP / MC2 组」：MC2 到 L226 才解释；
  - L87：KDA、稀疏 MLA、索引器第一次出现。KDA 在 L116 只解释了一半，稀疏 MLA 和索引器全页都没解释；
  - L99–100：router gate、mHC 四路残差没解释；
  - L57、L121：scheduler、kernel 块没有中文解释；
  - L176：W8A8 没说是「权重和激活都用 8 位整数」；
  - L182、L199、L226：prefill、decode、eager、chunked prefill 都没解释。
- 证据：`wiki/TERMS.md` L39、L40、L42、L47、L48、L58、L63、L67、L70、L108 都有现成的中文释义。
- 建议：在「这套部署长什么样」一节末尾加一张 6–8 行的小术语表，用 TERMS 的释义；每个词第一次出现时加括注。

**P2-10 缺少一段「一条请求在这 16 张卡上怎么走」**（第 2 项）
- 位置：L47–64
- 建议：加 5–6 句的路径：机器 0 的 API server 分词 → 协调器按负载选 DP 组 → 那一组的 EngineCore 调度并广播给 8 个 worker → 每层 attention 在机内做 TP All-Reduce → MoE 层跨两机 dispatch/combine（另一组必须陪跑）→ 采样结果回到机器 0。每一步链接到对应小节。

**P2-11 「会报什么错」一节有两条没有证据**
- 位置：L246、L247
- 问题：L246 说「rank 凑不成 0–15，建通信域会失败」，既没有引代码也没有给报错原文。按教程设置的 `HCCL_CONNECT_TIMEOUT=1200`，更可能的表现是等到超时，而不是立刻报错。L247 只引了教程，说的是配置约束，不是报错。
- 建议：要么补上握手或建通信域失败时的日志原文和代码位置，要么把这两条移到待核，写明「缺实机报错日志」。

**P2-12 startup 图基本是装饰**
- 位置：`wiki/diagrams/glm-two-node-startup.yaml`
- 问题：七个方框就是正文的七个小标题，没有画出「哪台机器 / 哪个进程」做哪一步，也没画出「权重 → 预算 → 块数」这个数据依赖。说明文字「前四步定下每张卡的权重」也不对，第 1–3 步和权重无关。
- 建议：改成两条泳道（机器 0 / 机器 1）加进程层级，在第 4→5→6 步上标出 20.58 → 30.0 → 3,855 这条数据链；或者直接删掉，把篇幅留给 P2-10 那段路径。

### P3（表述问题）

| # | 位置 | 问题 | 建议 |
|---|---|---|---|
| P3-1 | L209 | 「KV 初始化完成之后」引擎改写 block_size。代码里改写发生在算出 KV 配置之后、`initialize_from_config` 之前（`vllm/v1/engine/core.py@0fc695fc#L279-L289`） | 改成「算出 KV 配置之后」 |
| P3-2 | L247 | 「交换机侧的网卡名」说错了，教程说的是本机 `local_ip` 对应的网卡，也就是 `HCCL_SOCKET_IFNAME` | 改成「本机网卡名（`HCCL_SOCKET_IFNAME`）」 |
| P3-3 | L253 | 「3,855 个块是由源码值算出来的 [D]」，但 3,855 还依赖 [A] 的假设，和下一条自相矛盾 | 改成「18 个和 13,056 B 由源码算出；3,855 还依赖下一条的假设」 |
| P3-4 | L211 | 「空白三：`--kv-cache-dtype` 没写」，没说默认值和后果 | 补一句「MLA 主 cache 在代码里硬编码为 BF16（`02-forward.md:484`），这个空白不影响本页数字」 |
| P3-5 | L74 | TP 组的用途只写了 o_proj 和 MLP 输出投影的 All-Reduce，漏了词嵌入 All-Reduce、MoE finalize All-Gather、共享专家 All-Reduce、lm_head All-Gather（02 §1.2 L102–109） | 补全，或者写「等，完整清单见 02 §1.2」对应的知识页 |
| P3-6 | 全页 | `KV cache`、`chunked prefill` 和 TERMS 的大小写（`KV Cache`、`Chunked Prefill`）不一致；「嵌入表」没带英文 embedding | 按 TERMS 统一 |
| P3-7 | L207 | 「用 `grep -c` 数过，出现次数是 0」是过程描述，不该出现在正文 | 删掉括号，结论保留 |
| P3-8 | topology.yaml L28 | 「1/8 份 attention · 按 TP 切成 8 份」，但 attention 里有不少部件每卡一整份（见 P1-4） | 改成「attention 的大投影按 TP 切 8 份」 |
| P3-9 | L219 | 「索引器状态组稳态占 1 块还是 2 块」没写缺什么证据、影响哪个数 | 补「影响每请求固定块数（14 还是 15）；要看 `SlidingWindowManager.remove_skipped_blocks` 在 decode 稳态的实际行为」 |

### 附：沿用自主线底稿的问题（建议同步修）

- 02 §1.3 `02-forward.md:120` 的 `1149.0 MiB`，应为 1,176.7 MiB（P1-1）
- 02 §6.4 `02-forward.md:642` 的「任何一个 chunked prefill 混进来就翻到 ALLGATHER」（P1-5）
- 01 A0.5 `01-deploy-entry-schedule.md:231` 把图内存算进切 KV 前的扣除（P2-2）
- 01 B1 `01-deploy-entry-schedule.md:760` 写「各自是一个完整的模型副本」（P1-3 的来源）

## 四、源码抽查明细（21 / 21）

| 引用 | 行号对得上 | 支持页面结论 |
|---|---|---|
| vllm `parallel_state.py#L1535-L1560` | 是（L1548 `rank = dp_rank * world_size + rank`） | 是 |
| vllm `parallel_state.py#L1758-L1888` | 是（TP/DP/EP 的 view/transpose） | 是 |
| va `distributed/parallel_state.py#L84-L96` | 是（`_MC2`，dp×pcp×tp） | 是 |
| vllm `v1/engine/utils.py#L1049-L1200` | 是（`launch_core_engines`、`DPCoordinator`） | 是 |
| vllm `entrypoints/cli/serve.py#L173-L245` | 是（`run_headless`） | 是 |
| vllm `multiproc_executor.py#L110-L247` | 是（`MessageQueue`、`make_worker_process`） | 是 |
| va `worker/worker.py#L975-L988` | 是（hccl、`init_ascend_model_parallel`） | 是 |
| va `platform.py#L190-L200` | 是（把 ascend 追加进 `--quantization` 的 choices） | 是 |
| va `modelslim_config.py#L632-L736` | 是（`is_layer_skipped_ascend`、`FLOAT`） | 是 |
| vllm `v1/engine/core.py#L236-L317` | 是 | 是（但见 P3-1 的时序） |
| va `worker/worker.py#L527-L597` | 是 | 支持第五步的文字；**不支持**算例把图内存算进去（P2-2） |
| va `patch_mamba_config.py#L59-L226` | 是（`min_attn_block_size`、`cdiv`） | 是 |
| va `patch_kv_cache_utils.py#L517-L698` | 是（`get_kv_cache_groups`、`bytes_per_block`、`shared_by`） | 是 |
| va `worker/worker.py#L693-L784` | 是（`compile_or_warm_up_model`、`capture_model`） | 是 |
| va `models/glm5_next.py#L1880-L1930` | 是（L1923 `disable_tp=True`） | 是（但页面漏了其它不切 TP 的权重，见 P1-4） |
| va `models/glm5_next_mtp.py#L39-L92` | 是（`eh_proj`、`mtp_block`） | 是 |
| va `ascend_forward_context.py#L202-L252` | 是 | 门槛 128 支持；「= 32 × 4」的因果**不支持**（P2-4）；「任何 prefill 都翻」**不支持**（P1-5） |
| vllm `config/model.py#L1851-L1857` | 是（hybrid 时返回 False） | 是 |
| vllm `v1/engine/core.py#L1869-L1945` | 是（`execute_dummy_batch`、`% 32`） | 是 |
| va `model_runner_v1.py#L692-L740` | 是 | 对齐内容支持；**不支持** L83 说的走 HCCL（P2-3） |
| va `spec_decode/llm_base_proposer.py#L400-L456` | 是（L455–456 `assert not missing_layers`） | 是 |

另外核对了：`vllm-ascend@baa023ad` 下确实有 `vllm_ascend/models/glm5next/`（L260 正确）；教程参数 133120、8192、32、0.85、[4…128]、DP 2 / local 1、TP 8、`deepseek_mtp`×3 都和页面一致。

## 五、以初学者身份读完后最卡住的 3 个地方

1. **到底有几个模型副本？** 开头说「16 张卡跑一个模型副本」，表格里又说「两台机器各是一个完整副本」，后面又冒出「DP 执行组」和「DP 通信组」。我没法在脑子里画出「哪些东西两台各有一份，哪些东西全局只有一份」。只要一句「attention 和稠密层每台一份，路由专家全局一份」就能解开，但页面没有这句。
2. **「每张卡上放了什么」那张表里一堆没见过的名字。** KDA、稀疏 MLA、索引器、mHC 四路残差、router gate、`q_b_proj`、`kv_b_proj`……表是按这些部件列的，可它们各自是干什么的，页面没说（有的要到三十行以后才解释一半）。我只能看懂「路由专家占了 86%」这一个结论，其余几行没法判断对不对，也就没法复核。
3. **KV 那一节的账我自己算不回来。** 表里说权重 20.58 GiB，算例里突然变成「约 21」；图里还多出一截「预算外 10.02」，而 64 × 0.15 明明是 9.6；「每个请求固定 12 个块，每组 4 块」为什么是 4 也没说。照着页面一步一步算，得到的是 3,909 块而不是 3,855，我会怀疑是自己算错了。


## 六、修订记录（2026-09-27，页面作者）

只改了 `wiki/concepts/glm-5-3-flash-two-node.md` 和它的 4 份图 spec + svg；主线底稿按协调者安排另派人改。

### P1

- P1-1 KDA 行 → **已改**：`1149.0` 改为 `1,176.7 MiB`。**合计无需重算**：主干 20,537 MiB、MTP 540.75 MiB、整卡 21,078 MiB = 20.58 GiB 本来就是按 1,176.7 加出来的（151.25+1,176.74+54+409.75+18,144+126+189+135+151.25 = 20,536.99）；因此余量 30.0 GiB、块数 3,855 也不变。
- P1-2 单机账 → **已改**：换成单机 EP8 / 双机 EP16 的对比表（每卡 38.72 vs 20.58 GiB、KV 12.28 vs 30.0 GiB、约 1,577 vs 3,855 块），明说「单机放不下」不成立，改写成三条真实收益（KV 容量 2.4 倍、每卡专家减半、EP≥16 才准走 MC2），并加「缺实机验证」的待核。块数用精确值 1,577（审查写 1,578，差在对 12.3 / 12.28 GiB 的取舍）。
- P1-3 副本口径 → **已改**：统一成「attention、稠密层、共享专家每台各一份，288 个路由专家全局一份；每台机器是执行组，不是完整副本」，DP 行和「DP 执行组 vs DP 通信组」那段同步改。
- P1-4 不切 TP 的权重 → **已改**：补全为 `fused_qkv_a_proj`、整个索引器、KDA 的 `f_a/g_a_proj`、router gate、mHC、MTP 的 `eh_proj`，并加上「冗余计算换通信」。
- P1-5 All-Gather → **已改**：小标题与正文改成「DP 组里最大 token 数一过 128 就翻」，明写短 Chunked Prefill 仍走 MC2。
- P1-6 预算图 → **已改**：分段改成 21 + 3.4 + 30.0 + 9.6 = 64.0，「预算外」改成 9.6。

### P2

- P2-1 → **已改**：算例上方补了「按 21 GiB 取整、多留 0.42 GiB、后面各章的 3,855 从这来；照 20.58 精确算是 30.42 GiB、约 3,908 块」（审查写 3,909，同上取舍差）。
- P2-2 → **已改**：算例那行改名「激活峰值与非 torch 占用」，正文和图 caption 都写明 decode 图的显存从预算外的 9.6 GiB 出。
- P2-3 → **已改**：DP 组一行改成「各有一条 HCCL 通道和一条 CPU（gloo）通道，每步对齐默认走 CPU」，另把引擎之间那条 CPU 组单列；`dp_allreduce_on_npu` 那条待核已删。
- P2-4 → **已改**：门槛改写成「直接取自最大图尺寸 128，教程把它配成正好等于 32 × 4」；参数表里 `--max-num-seqs` 删掉「定死了最大图尺寸」。
- P2-5 → **已改**：MTP 段逐项列出 37.25 + 432 + 3 + 4.5 + `eh_proj` 64 = 540.75 MiB，并说明专家也是每卡 18 个；topology 图标签改成「每卡 540.75 MiB」。
- P2-6 → **已改**：补了「每组 4 块 = 1 页当前状态 + 3 页草稿位置」，并加了 7 token 请求拿 15 块 ≈ 119.5 MiB（真正装 token 的只有 ≈89 KiB）这个小例子。
- P2-7 → **已改**：改成「块大小和 KV 分组被补丁改写；prefix caching 沿用上游判定，补丁只读这个开关」。
- P2-8 → **已改**：删掉 `--data-parallel-start-rank` 那条；`enforce_eager` 改成结论 + 剩余问题；`--api-server-count` 写清影响面。
- P2-9 → **已改**：在第一节末尾加了 9 行小术语表（KDA、稀疏 MLA、索引器、mHC、router gate、MC2、prefill/decode、Chunked Prefill、W8A8），embedding、eager 就地括注。
- P2-10 → **已改**：新增一节「一条请求在这 16 张卡上怎么走」，6 步各带链接。
- P2-11 → **已改**：rank 对不上那条改成待核并写明「缺实机日志、更可能是等到 `HCCL_CONNECT_TIMEOUT` 超时」；网卡名那条改成本机 `HCCL_SOCKET_IFNAME` 的配置约束，并注明不是运行期报错。
- P2-12 → **部分改**：第 1 步改成「两机各起引擎进程 / 机器 0 还有前端和协调器」，第 4→5→6 步补上 20.58 → 30.0 → 3,855 的数据链，说明文字改成「第 2–7 步两台机器同时做」。**不改**的是「拆成两条泳道」：七步里只有第 1 步两端不同，画两条泳道会把其余六步重复一遍，收益不抵噪音。

### P3

- P3-1 ~ P3-5、P3-7 ~ P3-9 → **全部已改**。
- P3-6 → **已改**，按 `wiki/TERMS.md` 现值统一为 `KV Cache`、`Chunked Prefill`，「嵌入表」加了英文。**注意冲突**：`docs/plans/2026-09-27-toc-tuning.md` §5.3 主张把章名改成小写 `KV cache`，与 TERMS 现值相反；本页按 TERMS（硬约束里的真相源）走，等 TERMS 定稿后若改小写，本页要跟着改。

### 不改的其它一项

- 评分第 10 项建议的「2 台 × 2 卡缩小版演示 rank 编号」→ **不改**：`glm-two-node-groups` 图已经把 16 个 rank 和 8 个 DP 配对全画出来了，再加一个缩小版例子与图重复。第 10 项的另一半（小账例子）已按 P2-6 补上。

### 核对结果

- 每卡权重合计：**21,078 MiB = 20.58 GiB**（未变）
- 可用 KV（权重按 21 GiB 取整）：**30.0 GiB**；按 20.58 精确：30.42 GiB
- block 数：**3,855**（取整口径）／约 3,908（精确口径）
- 检查：`pnpm wiki:lint` 0 错、本页 0 告警；`pnpm check:content` 通过；`pnpm wiki:diagrams --check` 本页 4 张图一致（全库仅 `eplb-cycle.svg` 不一致，属他人改动，未动）。
