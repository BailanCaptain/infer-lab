# npu-platform 审查记录

## P5 写作记录（2026-09-28，Opus 写手）

**改了什么。** 深改 `wiki/concepts/npu-platform.md`：正文从 1,852 字（p4-checkpoint）扩到 11,835 字，7 个 H2。结构按深入页六步重排：

1. 第一屏「你写在命令里的配置，为什么不是最后生效的那一份」——一句话定义 + 重画的直觉图 `platform-surface`（校验 → 改写 → 答名字三段，带「启动失败」分支和「GLM 两类层自带后端」旁路）。
2. 第二屏讲动机与三条代价（生效值与输入值分家、校验跟着版本走、拒答也是一种行为），动机用的真实数是「命令里没有 `--block-size`，逻辑块 640 由这一层的补丁定」，640 只链接不重算。
3. 「校验与改写怎样影响执行」（锚点保留，ascend-config-system 指向它）：按 `check_and_update_config` 的代码先后逐段讲，新增代码流程图 `platform-check-order`（两道早退 → 认量化 → 四校验 → 修组合建配置 → 编译与图模式 → Worker 三选一 → 块大小与三条角色检查）。
4. 「默认预算为何不能只看一个数字」（锚点保留，本页是唯一出处）：拒答 → 档位 → 四道加减 → 「只在未显式设置时才跑」这道闸门，补齐了批式 DP MoE 那条不看档位的陪跑入口（256）与三个缺省常量（2048 / 256 / 128）。
5. 「落到 GLM 双机」：平台交出的六个答案列表、注意力后端的通用映射与 GLM 专用绑定的区别、显式 8192 让整条回退链不生效、DP2 使 prefill 侧上下文并行只能是 1。
6. 常见误解 6 条；对照源码五个 H3 按固定顺序；证据角标全部下沉到页末「本页的推论」与「正文证据归档」两段，正文零角标。

**数字取自哪里。** 每步预算 8192、请求数上限 32、显存比例 0.85、单请求长度 133120 取自底稿 `01-deploy-entry-schedule.md` §A0「怎么走的」与 §A2.1「预算常量」，页面只写结论并链接 [部署前提](../../../../wiki/concepts/glm-5-3-flash-two-node.md#部署前提)；逻辑块 640 与 KV 容量都只链接部署页，不在本页重算。上游档位数（16384 / 8192 / 8192 / 2048、70 GiB 门槛）与三个缺省常量直接取自 `vllm@0fc695fc` 源码，不是底稿数。

**核心概念对照了什么。** 全部对着 `vllm-ascend@db701c1f`（orphan commit，用 `git show` 读）与 `vllm@0fc695fc` 核：
- `check_and_update_config`（platform.py L450-L700）的段落顺序、四个 `_validate_*` 的条件与报错字符串、`worker_cls` 三选一、`refresh_block_size` 调用位置、三条按 PD 角色的检查；
- `get_device_total_memory` 抛 `NotImplementedError` 与 docstring 理由；上游 `arg_utils.get_batch_defaults` 的容量门槛与两档取值、`_set_default_max_num_seqs_and_batched_tokens_args` 的四道加减与 `orig_... is None` 闸门、`SchedulerConfig` 三个常量、`ParallelConfig.use_batched_dp_moe` 的三个条件；
- 「平台为 GLM 选哪个后端」：通用 `backend_map` 的四个键值，与 GLM 侧的直接绑定（`IndexerKPoolMLACacheLayer.attn_backend = AscendIndexerKPoolMLABackend`、`AscendKimiGatedDeltaNetAttention.get_attn_backend` 返回 `AscendGDNAttentionBackend`）——结论是通用映射在 GLM 这两类层上不参与，页面按此写；
- 缓存精度改写的触发条件（模型配置有 indexer 的 top-k 字段）对照 `transformers_utils/configs/glm5_next.py` 的 `index_topk` 字段核实；
- 三版差异逐项对照 `2ed6cbba` 与 `baa023ad`：校验数量 4 / 2 / 1+2 个模块级函数、层切分校验只在 v0.23、显存查询 main 上按 `torch.npu.is_initialized()` 分流、并行校验条件在两个较新版本上改成「没开 v2 model runner 就抛」、main 改由硬件画像给出常规 Worker 类。

**不丢信息勾选。** 旧版清单（p4-checkpoint 版 + 重写前 `14591fd~1` 版）逐条列在 `scratchpad/p5/npu-platform-facts.md`，勾选结果同文件末尾。结论：旧版全部机制、数字、报错、版本差异均在新版出现或链接外移；删掉两项并写明理由——Qwen3.6-35B-A3B 的整套算例（本库固定 GLM-5.3-Flash，例子不适用）、H100 80 GiB 的对照默认值（未核该设备名与容量，档位表已足以推出）。p4 版丢掉的旧结论补回三条：注册量化名 ≠ 能按该量化运行、GLM 配置类型与模型实现各自的登记去处、v0.26 并行校验条件的变化。

**验证。** `pnpm wiki:lint` 通过（本页零告警）、`pnpm wiki:audit` 通过（本页 24 条来源行号全部有效）、`pnpm wiki:diagrams --check` 一致、`pnpm check:content` 通过。另用写作标准度量脚本单独量本页：行内代码 0.3/千字、正文角标 0、对照源码 H3 顺序正确、calc 0、表与 calc 不相邻、图先行、免责 2.2%、图宽 ≤900px，均达标（本页尚未进 `scripts/wiki/standard-pages.json` 名单，因为写手不改 scripts/）。未截图、未起服务，浏览器验收留给审查环节。

**仍待核。** 两条写进页末「待核」：删掉 `--max-num-batched-tokens` 之后启动日志里的实际预算值；main 分支上硬件画像在 A2 上给出的常规 Worker 类取值。两条都只有源码推导，没有 NPU 实测。

## P5 审查（09-28）

审查员：Opus 5.5（独立审查，只审不改页）。对照 `vllm-ascend@db701c1f`（`tools/repos/vllm-ascend`，`git show` 读）、`vllm@0fc695fc`，版本差异抽核 `2ed6cbba`（v0.26）、`baa023ad`（main）。

**打分：6.5 / 10。** 结构、篇幅、锚点、图先行都达标，Worker 三选一、`backend_map` 四键、GLM 两类层直接绑定、拒答显存、档位数与三个常量全部核对无误。扣分集中在四处核心机制/数字写偏（都是局部改句即可修）。

### 1. 初学者测试（只读前两屏）

能说清。我的一句话：**NPUPlatform 是昇腾交给 vLLM 的平台实现：启动时把整份配置按组合查一遍，不行就报错，能跑就就地改掉（Worker 类、块大小、缓存精度），之后再回答各组件该用哪个类；代价是命令里的值不等于生效值、校验随版本变、它拒答显存会让默认预算落到小档。** 障碍：第一屏出现 MLA、「图包装」未解释（见 P3-5）。

### 2. 核心概念逐条核对

| 页面说法 | 结论 | 源码依据 |
|---|---|---|
| 两道早退 → 认量化 → 四校验 → 修组合 → 建昇腾配置 | 对 | `platform.py` L453-L463、L465、L467-L470、L473、L475 |
| 层切分只许 producer | 对 | L338-L346 |
| 并行：DP>1 且 PCP>1 抛 | 对（仅 db701c1f/v0.23） | L349-L358；v0.26 改为「没开 v2 model runner 且 PCP>1」`2ed6cbba` L339 |
| 投机 + DCP「拦的是这个组合」 | **写偏**，见 P1-3 | L365-L380（MLA 草稿直接返回）、L393-L417 |
| PD+PP+MTP「三者同时出现时」 | **写偏**，见 P1-3 | L430-L447 |
| indexer top-k → 缓存精度改成模型 dtype | 对；GLM 配置恒有该字段 | L504-L505；`glm5_next.py` L190 |
| worker_cls 三候选，本部署 NPUWorker | 对 | L650-L660 |
| 块大小：空着填 128，混合模型跳过这条 | **错**，见 P1-1 | `utils.py` L1407-L1408、L1424-L1433 |
| 三条角色检查 | 对 | L668-L699；`_validate_kv_load_failure_policy` L893-L901 |
| backend_map 四键 + FA3 先判 + 310P 独立表 | 对 | L805-L831 |
| GLM 两类层不查表 | 对 | `ops/indexer_kpool_mla.py` L78（`IndexerKPoolMLACacheLayer`）；`ops/kimi_kda.py` L232-L233（`AscendKimiGatedDeltaNetAttention`） |
| 显存查询抛 NotImplementedError + 理由 | 对 | L275-L281；main 按 `torch.npu.is_initialized()` 分流 `baa023ad` L234-L235 |
| 档位 70 GiB / a100 / 16384·8192 / 8192·2048，异常吞掉按 0 | 对 | `arg_utils.py` L2305-L2335 |
| 批式 DP 三条件、256；常量 2048/256/128 | 对 | `parallel.py` L643-L652；`scheduler.py` L42-L44 |
| 四道加减 | 对 | `arg_utils.py` L2512-L2563 |
| 「显式写了，整条回退链一次都不跑」 | **结论对、机制错**，见 P1-2 | L2487-L2490 无条件调用 |

### 3. 数字

8192、32 与底稿 `01-deploy-entry-schedule.md` L636-L637 一致；0.85 与底稿 L236、`02-forward.md` L14（[S]）一致。上游档位数、常量均为源码直取，已逐个核。写手自报的两条「待核」：第一条其实可按源码推到一个条件值（见 P2-3）；第二条（main 硬件画像给 A2 的 Worker 类）本轮未核。

### 4. 有没有丢信息

`git diff` 删行 33 行，逐条对 `scratchpad/p5/npu-platform-facts.md` 的 O1–O20、N1–N13。

- **删 Qwen 算例（O5/O6）：理由成立**（本库固定 GLM，Qwen 的后端映射不适用）。但它原来的教学作用——「回退链真生效时得到几」——没有用 GLM 替补，见 P2-3。
- **删 H100 对照值（O2 末句）：理由不成立。** 写手说「没核设备名与容量」，但上游源码注释 `arg_utils.py` L2317 直接写了 H100、MI300x 走大档，可直接引用；这一行是「拒答让昇腾落小档」最直观的对照，建议恢复一句，见 P2-2。
- 清单里还有第三处删减（N10「教学请求另有简化预算」），写作记录只报了两项，见 P3-6。
- 抽查 4 条均在：O8 身份字段（L149）；O12 `update_block_size_for_backend` / `mamba_cache_mode`（L153）；O4 main 显存查询分流（L139、L189，已对 `baa023ad` L234-L235）；N3/N4 配置类型与模型实现的登记去处、注册量化名 ≠ 能按该量化跑（L150）。补回的 v0.26 并行条件（L190）也已对 `2ed6cbba` L339 核实。

### 5. 一致性（vllm-platform-interface、ascend-config-system）

- **vllm-platform-interface**：L137「回退档在本部署里不参与默认值选择」、L161、L199、L210 与本页结论一致，且措辞比本页 L107/L130 更准（没说「不跑」），无冲突。
- **ascend-config-system**：L124「平台先跑四个校验，再建配置」、L199「在四个校验之后」与本页一致；**L230 main 列写「一个」与本页 L187（一个类方法加两个模块级函数）和源码冲突**，同 P1-4，需一起改。

### 6. 链接与锚点

- 本页两个锚点 `#校验与改写怎样影响执行`（L66）、`#默认预算为何不能只看一个数字`（L97）都在；全库入链 ascend-config-system L124、vllm-platform-interface L161/L199/L210 全部能解析；无锚点入链（engine-processes、platform-plugin-registration、index 等）正常。
- 出链 7 个带锚点的目标（部署页 3 个 H2 + 1 个 H3、ascend-config-system 2 个、vllm-platform-interface 1 个）逐个对标题核过，全部存在。

### 7. `pnpm wiki:audit`

通过（exit 0）：本页 evidence=C、正文 12003 字 / 7 节、来源 24 条，无效 commit / 越界行号 0。本页不在写作标准名单里，标准项只统计不拦。

### P1

- **P1-1 块大小机制写反（L58、L93、L126；图 `platform-check-order.yaml` L45 注释；`platform-surface` 的「块大小写进缓存配置」同源）。** 源码里「空着填 128」对所有模型都先执行（`utils.py` L1407-L1408），混合模型跳过的是其后「块大小不是 128 且开了前缀缓存或 chunked prefill 就强制改回 128」（L1429-L1433）以及 xlite 的 ≤128 限制（L1439-L1446）。另外 640 不是「在平台这一次改写里落下来的」：补丁版 `HybridAttentionMambaModelConfig.verify_and_update_config` 在 `VllmConfig.__post_init__` 里（`vllm/config/vllm.py` L856 → L1902-L1903）先写入 640（`patch_mamba_config.py` L159），平台在更晚的 L1335 才被调用。**改法**：L93 改成「通用规则有两条：空着先填 128；已设的值不是 128 且开了前缀缓存或 chunked prefill 就强制改回 128。混合模型只跳过后一条——所以补丁更早写进的 640 能留下来」；L58 把「在平台这一次改写里落下来」改成「由更早一步的补丁写入，平台这一步负责不把它改回 128」；图注同步。
- **P1-2 回退链闸门位置写错（L107、L130；L140 同源）。** `get_batch_defaults` 被无条件调用（`arg_utils.py` L2487-L2490），所以平台每次都会被问、每次都拒答、档位每次都算出来；被 `is None` 闸住的只是赋值和三道加减（L2495、L2514-L2517、L2519、L2561）。「本部署 8192 原样生效」这个结论对，「整条回退链一次都不跑 / 档位不选」不对。**改法**：L107 改成「问与拒答、选档照常发生，但只在用户没显式写时才把选出的档写进去；翻倍、抬升、收窄同样被这道闸门挡住」；L130 把「一次都不跑：档位不选」改成「选出的档被丢弃，不翻倍、不抬升、不收窄」。
- **P1-3 四个校验里两条条件写偏（L83、L85；图 `platform-check-order.yaml` L20、L22）。** 投机 + DCP：只有 DCP>1、草稿模型不是 MLA 时才查三条头数约束（草稿 TP > KV 头数、DCP ≤ 草稿 TP ÷ KV 头数、每个 KV 头对应的 Q 头数能被 DCP 整除，L374-L417）；MLA 草稿直接放行（L379-L380）。表里写成「这个组合」会让人以为投机解码和 DCP 不能同开；GLM 的 MTP 草稿走 MLA，即使开 DCP 也不会被这一条拦。PD+PP+MTP：触发条件是「MTP 且 PP>1」，不在 producer 一侧就抛，**没配 PD 也会抛**（L430-L447）；「三者同时出现时」写错，而且和本页 L164 的报错表自相矛盾。**改法**：两行按上面改写，图里两个标签同步。
- **P1-4 校验数量「四个、两个、一个」（L63）与源码和本页 L187 冲突。** main 在建配置之前有三处校验：`cls._validate_indexer_pp_config` + 两个模块级函数（`baa023ad` L476-L479）。**改法**：写成「四个、两个、三个（main 上一个类方法加两个模块级函数）」，或者说「类方法形式的校验从四个减到一个」并注明另两条变成了模块级函数。ascend-config-system L230 同步改。

### P2

- **P2-1 批式 DP 取 256 的理由没有出处（L103）。**「给数据并行各组同步陪跑留的余量」在 `scheduler.py` L43、`parallel.py` L643-L652 里都没有依据。改法：删掉这句理由，或者找到出处后标成推论。
- **P2-2 恢复 H100 对照（L103 后加一句）。** 可以写：「同一条命令放到 H100（显存 ≥70 GiB、设备名不含 a100）上，API 服务方式默认 8192；昇腾因为拒答落到 2048」。出处用 `arg_utils.py` L2316-L2321（注释点名 H100）。
- **P2-3 Qwen 算例删掉后没补 GLM 的反事实数（L130）。**「得到的不会是 8192，而是小档再走三段加减的结果」没给出数字。按源码可以推：API 服务方式小档 2048；默认 balanced 模式，不翻倍；chunked prefill 开着（`arg_utils.py` L2376-L2377 按模型能力默认开，部署页也在用），不抬升；min(32 × 133120, 2048) = 2048。结论是删掉这个参数后大概率是 2048。唯一不确定的是多模态 prefix-LM 那道下限：GLM5Next 带视觉部分，需要核一下 `is_mm_prefix_lm`。改法：写成 [D] 推导，并把这个条件留在「待核」里。

### P3

- **P3-1 all2all 后端改写没写。** `worker_cls` 为 auto 的分支里，没开 `pass_config.enable_sp` 时会把 `all2all_backend` 改成 `flashinfer_all2allv`（L651-L653，注释说是为了关掉 `use_sequence_parallel_moe`）。这也是平台的就地改写，建议在 GLM 表或「选 Worker 类」段补一句，先核本部署 `enable_sp` 的取值。
- **P3-2 L76「认量化排在校验之前，所以校验能看到量化识别的结果」。** 四个校验都不读量化结果，这个因果不成立；而且 main 上顺序反过来了（`baa023ad` L476-L482）。改法：删掉因果，版本差异表加一行。
- **P3-3 L89 位置不准。** indexer top-k 改写在建完昇腾配置之后、编译段之前（L504-L505），不属于「定编译与图模式」那一段。改法：拆成独立一句。
- **P3-4 L84、L132 没标版本。**「DP2 → PCP 只能是 1」只在 db701c1f/v0.23 成立；v0.26 和 main 上跟 DP 无关（没开 v2 model runner 就拦）。改法：注明「在钉住的 db701c1f 上」，免得读者以为放弃 DP 就能开。
- **P3-5 术语先用后讲。** 这些词第一次出现时都没解释：MLA、图包装（L48/L54）、producer（L82）、MTP（L83）、xlite、310P、indexer top-k、dtype（L89/L91）、KDA、GDN（L128）。改法：第一次出现时各补一句解释。
- **P3-6 写作记录少报一处删减。** facts 清单里 N10「教学请求另有简化预算」是 ✖，写作记录只写了「删两项」。改法：补上，并在 L130 附近链接 R1 预算所在页。

### 跳过与未做

- 按纪律跳过 frontmatter 来源区（L9-L33）、全部代码块、HANDBOOK、docs/plans/。「## 对照源码」只用 grep 核了五个 H3（顺序正确）和版本差异里的 v0.23 / v0.26 / main（都在）。**例外**：为了比对 PP+MTP 的条件，读了 L160-L170 的报错表。
- 两张图只 grep 了 yaml 的标签，没有在浏览器里打开渲染结果，**浏览器验收未做**。
- 写手自报的第二条待核（main 硬件画像给 A2 的 Worker 类）本轮没有核。

## P5 修订记录（09-28，Opus 写手）

按「P5 审查（09-28）」的 P1-1～P1-4、P2-1～P2-3 修订；P3 未动。正文 12003 → 13977 字，来源 24 → 33 条。

**P1**
- **P1-1 块大小顺序**：L54、L58、L93、GLM 表「逻辑块」行、源码位置表改成「补丁先写 640（`VllmConfig.__post_init__` L856 → L1903，`patch_mamba_config.py` L159），平台在 L1335 才被调用；通用规则两条（空着填 128 / 不是 128 且开前缀缓存或 chunked prefill 就改回 128），混合模型只跳过后一条（连同 xlite ≤128）」。另注明上游建缓存配置时已先填默认 16（`vllm/config/cache.py` L237-L238），空着填 128 多是兜底。图 `platform-check-order` 注释、`platform-surface` 图注同步。对照：`vllm-ascend@db701c1f:vllm_ascend/utils.py` L1407-L1446。
- **P1-2 回退链闸门**：L107、GLM 预算段、常见误解、推论段改为「问显存、拒答、选档每次照常发生；`is None` 闸住的是赋值与三道加减」。对照 `vllm@0fc695fc:vllm/engine/arg_utils.py` L2487-L2490（无条件调 `get_batch_defaults`）、L2495、L2506、L2514-L2519。
- **P1-3 两条校验条件**：投机 + DCP 改为「DCP>1 且草稿不是 MLA 才查三条头数约束，MLA 草稿放行，两者本身可同开」（L365-L417）；PP+MTP 改为「MTP 且 PP>1、不在 producer 一侧就抛，没配 PD 也抛」（L430-L447）。报错表该行换成真实报错前缀与条件；图两个标签同步。
- **P1-4 校验数量**：L63 改为「四个、两个、三个（main 一个类方法加两个模块级函数）」，版本差异表 main 列写明「三个」。对照 `baa023ad` platform.py L476-L479、`2ed6cbba` L425-L426。

**P2**
- **P2-1 256 的出处**：删掉「陪跑余量」理由。新出处：`fused_moe/config.py` L1259 的 `max_num_tokens` 缺省值就是这个常量；它由上游 e1e318af01「Remove MoE DP chunking」引入，替掉的 `VLLM_MOE_DP_CHUNK_SIZE` 缺省 256，注释写明批式 all-to-all 下每个 DP 组按 256 个 token 派发（`vllm@f7e62e3d:vllm/envs.py` L1143-L1148）。「预算取 256 是为了不超过一次派发的量」标为推论。
- **P2-2 H100 对照**：恢复，出处 `arg_utils.py` L2316-L2317 的注释。
- **P2-3 删参后的数**：按源码推出约 2048（默认 all2all 后端 `allgather_reducescatter` 不进批式 DP，`parallel.py` L177；均衡模式不翻倍；chunked prefill 默认开，L2373-L2377；min(32 × 133,120, 2048)），标 [D]。prefix-LM 下限：上游名单和 glm5_next 配置类都不命中（`model_arch_config_convertor.py` L292-L308），模型 config.json 是否带该字段留在待核。

**审查员说法的一处更正（已写入待核）**：P1-3 说「GLM 的 MTP 草稿走 MLA，开 DCP 也不会被拦」，静态读源码不成立——草稿类型被改成 `glm5_next_mtp`（`patch_speculative_config.py` L121），它不在上游 MLA 名单里（`model_arch_config_convertor.py` L252-L276），插件只给 `glm5_next` / `glm5_next_text` 登记 MLA 判定（`patch_glm5_next_config.py` L29-L30）。页面因此只写「本部署 DCP 是 1，不触发」，草稿是否算 MLA 放进待核。

**相关页**
- `vllm-platform-interface.md` L137：原句「回退档路径不参与默认值选择」读起来像这条路径不跑，与 P1-2 同一误解；只改这一句，改成「上游照样查询、照样选出回退档，但被显式值覆盖，不生效」。L199「回退档不参与」没动。
- `kv-cache.md`：只说补丁在配置阶段写 640，一致，没动。
- `kv-cache-spec.md` L139：「配置对象先填 16；刷新逻辑遇到混合模型直接跳过，不改这个值」，暗示平台在补丁之前、值还是 16 时运行，与实际先后（补丁先写 640，平台后跑）不符；**不在本次范围，没改**，待定。
- `ascend-config-system.md` L230 main 列写「一个」，与 P1-4 同源；**不在本次范围，没改**，待定。

**验证**：`pnpm wiki:lint` 通过，两页无告警（中途 [C] 标记一度到 40 触发 mark-flood，改成「来源 25–33」文字引用后消除）；`pnpm wiki:diagrams` 只重写了 platform-check-order.svg、platform-surface.svg，`--check` 180 张一致；`pnpm wiki:audit` exit 0，本页来源 33 条，无效 commit 0、行号越界 0。浏览器验收未做。

## P5 复审（09-28）

审查员：Opus 5.5（快速复审，只核上一轮 P1-1～P1-4、P2-1～P2-3 是否落实，只审不改页）。源码一律 `git show <commit>:<path>` 读，每次不超过 20 行。页面行号为当前工作区版本。

**打分：8.0 / 10。**（上一轮 6.5）七条全部落实，源码逐条复核无误；新发现一处出处漏登（见下 P1-5，一行可修），P3 未动。

| 条目 | 结论 | 页面位置 | 复核依据 |
|---|---|---|---|
| P1-1 块大小先后 | **落实** | L67「这个值不是平台这一步写的，而是由更早一步的补丁写入……负责不把 640 改回 128」；L102 两条通用规则 + 混合模型只跳过后一条（连同 xlite）；L137 GLM 表；L218 源码位置表；图 `platform-check-order.yaml` L45、`platform-surface.yaml` L3 图注同步 | `vllm-ascend@db701c1f:vllm_ascend/utils.py` L1407-L1408（空着填 128，先于混合判断）、L1424-L1427（`is_hybrid` 返回）、L1429-L1433（非 128 且前缀缓存/chunked prefill 改回 128）、L1439（xlite >128） |
| P1-2 显式 8192 时平台照样被问、照样选档 | **落实** | L118「问显存、拒答、选档每次启动都照常发生……显式写了，选出的档就被丢弃」；L141「照样发生，但选出的档被丢弃」；L123、L151、L221 同口径 | `vllm@0fc695fc:vllm/engine/arg_utils.py` L2487-L2490 无条件调 `get_batch_defaults`；L2495、L2514、L2519 闸门；多模态下限 L2533 与收窄 L2550 都在 L2519 块内；L2561 另由 `orig_max_num_seqs` 闸 |
| P1-2 关联：`vllm-platform-interface.md` L137 | **落实，一致** | L137「上游照样查询、照样在失败后选出回退档，但选出的档被显式值覆盖，在本部署里不生效」 | 与本页 L118 说法一致。L199「回退档不参与」措辞仍可被读成「不跑」，但语境是「预算由命令显式给出」，不算冲突（P3） |
| P1-3 投机 + DCP、PP + MTP 条件 | **落实** | L92（「两者本身可以同开」，DCP>1 且草稿非 MLA 才查三条头数约束，MLA 放行）；L94（MTP 且 PP>1、不在 producer 就抛，没配 PD 也抛）；报错表 L175、L180；图 L20、L22 标签同步 | `db701c1f:vllm_ascend/platform.py` L375-L376（DCP≤1 返回）、L379-L380（MLA 返回）、L393/L402/L412 三条约束；L430-L445（MTP → PP≤1 返回 → producer 返回 → 抛） |
| P1-4 main 三处校验 | **落实** | L72「四个、两个、三个（main 上是一个类方法加两个模块级函数）」；L198 版本差异表 main 列写明三个及名称；`ascend-config-system.md` L230 也已改为「三个」（修订记录写「没改」，但工作区当前已一致） | `baa023ad:vllm_ascend/platform.py` L476（`cls._validate_indexer_pp_config`）、L478-L479（两个模块级函数） |
| P2-1 256 的出处 | **落实** | L114：删掉「陪跑余量」，改为源码出处 + 明确标「推论，上游没有直接写出理由」；L219 源码位置表；来源 L37-L38 | `vllm@0fc695fc:.../fused_moe/config.py` L1259（`max_num_tokens` 缺省 = 批式 DP 常量）；`vllm@f7e62e3d:vllm/envs.py` L1143-L1148（`VLLM_MOE_DP_CHUNK_SIZE` 缺省 256 及注释）；`f7e62e3d` 正是 `e1e318af01`「[MoE Refactor] Remove MoE DP chunking」的父提交，该提交改了 envs.py、scheduler.py、fused_moe/config.py |
| P2-2 H100 对照 | **落实** | L112「同一条命令放到 H100 上……API 服务方式默认 8192；昇腾因为拒答，落到 2048」 | `arg_utils.py` L2316-L2321（≥70 GiB 且非 a100 → API 8192；注释点名 H100、MI300x） |
| P2-3 删参后约 2048 | **落实** | L141 正文推导；L221 标 [D]；L225 待核写明 `is_mm_prefix_lm` 与 MTP 草稿是否 MLA 两项 | `vllm@0fc695fc:vllm/config/parallel.py` L177（默认 `allgather_reducescatter`）、L643-L652（批式 DP 只认 deepep_low_latency / nixl_ep）；`arg_utils.py` L2376-L2377（chunked prefill 按模型能力默认开） |
| `pnpm wiki:audit` | **本页通过；全库命令 exit 1，不是本页造成** | 本页：正文 13981 字 / 7 节，来源 33 条，33 ✓ / 0 ✗ | 唯一失败是 `concepts/gap-a5164fe10fa9184412f8.md` 的 `vllm@0fc695fc:vllm/utils/mem_utils.py#L256-L276` out-of-range（该页在工作区有未提交修改），与本页无关，需另行处理 |

### 新发现

- **P1-5（按标准计 P1，修复只需一行）出处漏登：L102「上游建缓存配置时通常已先填了默认 16」。** 数字本身已核对正确：`vllm@0fc695fc:vllm/config/cache.py` L46 `DEFAULT_BLOCK_SIZE = 16`，L231-L239 在 `model_validator(mode="after")` 里空着就填 16。但本页 frontmatter 来源和「源码位置」表都没有 cache.py（修订记录写了 L237-L238，页面没带上）。改法：来源加 `vllm@0fc695fc:vllm/config/cache.py#L231-L239`（或 L46 + L237-L239），源码位置表补一行。另外既然是 after-validator，常规路径上块大小不会是空的，「通常」可以去掉，直接写「上游构造缓存配置时已填默认 16，这条是兜底」。
- **P3-7 加减次数口径不一。** L116「加减四次」、L151「四道加减」、L221「三道加减不发生」、L118/L141 只列「翻倍、抬升、收窄」漏了多模态下限。源码里四项（翻倍、抬升、多模态下限、收窄）都在 `is None` 闸门内。改法：统一成「四道」，L118/L141 补上多模态下限或改成「后面的四道加减」。
- **P3-8 L112「同一条命令放到 H100 上……默认 8192」。** 官方命令显式写了 8192，「同一条命令」在 H100 上也是显式值生效，不体现默认档。改法：改成「同样不写这个参数，放到 H100 上……」。
- **P3-9 L67 简写「块大小不是 128 就改回 128」** 少了「开了前缀缓存或 chunked prefill」这个前提（L102 是完整的），建议加半句或写「那条改回 128 的规则」。
- 上一轮 P3-1～P3-6 按修订记录未动，仍然有效。

### 跳过与未做

- 按纪律只核七条修订涉及的行，没有重读全页；frontmatter 来源区只 grep 了 cache.py / fused_moe / envs.py 三个路径；代码块未读。
- `vllm-platform-interface.md` 只读了 L137、L161、L199、L210 四行。
- 两张图只看了 yaml 标签，**浏览器验收未做**。
- `2ed6cbba`（v0.26）的「两个校验」沿用上一轮结论，本轮没重读。

## P1-5 修订记录（09-28）

只修 P1-5「默认 16」出处漏登；P3-7～P3-9 未动。

- **出处**：`vllm@0fc695fc:vllm/config/cache.py` L46 `DEFAULT_BLOCK_SIZE: ClassVar[int] = 16`；L231-L239 `@model_validator(mode="after")` 的 `_apply_block_size_default` 在 `block_size is None` 时填 `DEFAULT_BLOCK_SIZE`（L238-L239）。另 grep 了 `vllm/config/` 与 `arg_utils.py`，没有把块大小重置为 None 的地方。
- **正文 L102**：「上游建缓存配置时通常已先填了默认 16，这条多是兜底」→「上游构造缓存配置 `CacheConfig` 时，它的 after 校验器已把空着的块大小填成类常量 `DEFAULT_BLOCK_SIZE = 16`，所以这条是兜底」（去掉「通常」）。
- **来源**：frontmatter 加 `vllm@0fc695fc:vllm/config/cache.py#L46`、`vllm@0fc695fc:vllm/config/cache.py#L231-L239`（33 → 35 条）；「源码位置」表加一行「上游先填的默认块大小 16」。
- **验证**：`pnpm wiki:lint` 通过（19 处待留意均不是本页）；`pnpm wiki:audit` exit 0，本页正文 14148 字 / 7 节、来源 35 条，两条新来源行号有效（cache.py 共 276 行）。

## 免责率修订记录（09-28，Opus 写手）

`pnpm wiki:audit` 报本页 `[hedge-ratio] 正文免责句 3 / 97 句 = 3.1%`（上限 3%）。grep「待核、尚未核实、未验证、可能、不确定」在「对照源码」之前命中 3 处，逐条处理，没有删信息：

- **L74「同一个键可能在一个版本上被拦下」**（用词含糊）：改为确定说法并补实例——「层切分那个键在 v0.23 上有专门的校验，到 v0.26 已经删掉」，与 `ascend-config-system.md` 版本差异表「建配置前的平台校验」一行一致。
- **L100「也可能把图整段关掉」**（可核实）：亲读 `vllm-ascend@db701c1f:vllm_ascend/platform.py` L517-L522、L535-L540、L570-L582、L593-L633，改为列出四种关图情况：xlite 全图模式且没开投机解码（同时改纯 eager）、编译档位不是 NONE／VLLM_COMPILE、图模式档位既非分段也不含整图、编码器-解码器请求整图又没走 vLLM 编译；并补「要求纯 eager 时上游已先关图」（`vllm@0fc695fc:vllm/config/vllm.py#L1054-L1060`，早于 L1335 的平台钩子）。来源加 `platform.py#L529-L634`、`config/vllm.py#L1054-L1060`（35 → 37 条）。
- **L143「配置文件里会不会另带这个开关字段，还待核」**（确实没法核实）：正文改为陈述触发条件（既按多模态架构加载、又被判成 prefix-LM；配置文件若另写该字段为真，上游优先读它，`model_arch_config_convertor.py#L293-L296`），查字段这件事指向页末清单。页末「待核」补两点：上游读法出处；这道下限还要求多模态架构（`vllm/engine/arg_utils.py#L2530-L2544`），而插件对 GLM 同时登记了 `Glm5NextForCausalLM` 与 `Glm5NextForConditionalGeneration`（`vllm_ascend/models/__init__.py#L12-L16`），走哪个取决于配置文件的 `architectures`，一并待查。
- **验证**：`pnpm wiki:lint` 本页无报错；`pnpm wiki:audit` 本页「✓免责 0.0%」，正文 14708 字 / 7 节、来源 37 条，新来源行号有效。全库 lint／audit 仍有失败，均来自 `concepts/block-table.md`（summary 超 200 字，及 8 页 relation 指向它），不是本页。P3-7～P3-9 未在本轮范围内。浏览器验收未做。

- **v0.23 列表头复核（09-28）：改了表头，表内未改。** 原表头写「v0.23 列校验清单与行号读自镜像 db701c1f，在 2c59ff10 上未核」，把 db701c1f 混进 v0.23 列。已按 `git diff db701c1f 2c59ff10 -- vllm_ascend/platform.py` 核：差异只有 L596/L627/L641 后三处编译开关复位与 L700 一处重算调度复位；2c59ff10 上 `get_device_total_memory` 在 L275、`check_and_update_config` 起于 L450、四个 `_validate_*` 在 L467–L470 顺序不变、`init_ascend_config` 在 L475，与表内各行一致。表头改为「v0.23 列 = 2c59ff10，db701c1f 单独注明」。表内没有 GLM 专属代码。
