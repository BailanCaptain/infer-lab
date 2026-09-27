# 01 底稿 A0 增补部分独立审查（§A0.7 / §A0.8 / 社区版对照表）

审查对象：`docs/mainline/01-deploy-entry-schedule.md` 的 §A0.7（L262–386）、§A0.8（L388–519），以及 §A0.8 末尾的社区版/工作版差异表（L491–506）。
审查方式：逐处打开被引用的源码行核对内容与行号；所有 `[C]` `[D]` 算式重算；差异表两侧逐行核。
源码版本：执行侧 `vllm-ascend@db701c1f`，控制流 `vllm@0fc695fc`，RFork 工作版 `rfork@3284850b`（`tools/repos/rfork`）。

结论：**P1 × 1，P2 × 2，P3 × 7**。主要数字（≈307 GiB checkpoint、20.58 GiB 每卡权重、主模型 21 批、32 个 seed key、EP 过滤默认关、预取按 16 rank 分文件、W8A8 必须走 processed layout、回退条件）复算与源码核对全部成立，只有「草稿 session 传多少字节」一条是错的。

---

## P1

### P1-1 草稿 session 的传输字节漏了草稿自带的 `embed_tokens` 与 `shared_head.head`，`20.62 GiB / 330 GiB` 偏小约 0.3 GiB/卡

- **级别**：P1（数字错，且支撑它的结论与源码顺序矛盾）
- **位置**：`docs/mainline/01-deploy-entry-schedule.md:458-460`、连带 `:449`（"每卡合计"）、`:463`（整实例）、`:515`（待核 2 要核的 20.62）、`:516`（待核 3）
- **原结论**：
  > 草稿 session = MTP 层 540.75 MiB + 1 层 × 864 KiB ≈ 541.6 MiB（lm_head 与主模型共用，落在 exclude_blocks 里，不传）
  > 每卡合计 ≈ 20,572 + 541.6 ≈ 21,114 MiB ≈ 20.62 GiB；整个实例 ≈ 330 GiB
- **源码证据**：
  1. RFork 的内存登记与传输发生在 `get_model()` **内部**：`rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L572-L577`（`initialize_model`）→ `#L623`（`session.transfer_from_seed`）→ `#L636-L644`（`eval()` + 发布 seed）→ `#L644` 返回。
  2. 草稿与主模型的共享发生在 `get_model()` **返回之后**：`vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L325`（`self.model = self._get_model()`）→ `#L384-L387`（`_maybe_share_embeddings` / `_maybe_share_lm_head`）→ `#L548`（`del self.model.model.embed_tokens`）、`#L596`（`layer_module.shared_head.head = target_language_model.lm_head`）。工作版同构：`rfork@3284850b:vllm_ascend/spec_decode/llm_base_proposer.py#L464` vs `#L535-L537`、`#L638`、`#L703`。
  3. 所以在传输时刻，草稿模型持有自己的 `VocabParallelEmbedding(154880, 4096)`（`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L143-L150`）和 `SharedHead` 里的 `ParallelLMHead`（同文件 `#L79-L83`），两者都是 NPU 上的活张量，会被 `collect_processed_layout_tensors` 收进清单（`rfork@3284850b:vllm_ascend/model_loader/rfork/tensor_layout.py#L155-L174`）。
  4. 它们不可能落在 `exclude_blocks` 里：`exclude_blocks` 只取主模型 `transfer_backend.registered_weight_blocks`（`rfork_loader.py#L492-L501`），而草稿的这两份是此刻新分配的独立显存块（`transfer_backend.py#L71-L90` 的 `_is_tensor_in_blocks` 按地址区间判定）。
  5. 02 §1.3 / §7.5 把 `shared_head.head` 记 0、不记草稿 `embed_tokens`，讲的是**共享之后的稳态常驻显存**（`docs/mainline/02-forward.md:805`、`:816-828`），不是传输时刻的活张量账，两本账不能直接套用。
- **影响的数字**：按 02 的 TP8 切法，每份 = 19,360 × 4096 × 2 B = 151.25 MiB。草稿 session ≈ 541.6 + 151.25 × 2 ≈ **844 MiB**；每卡合计 ≈ 20,572 + 844 ≈ **21,416 MiB ≈ 20.92 GiB**；整实例 ≈ 16 × 20.92 ≈ **335 GiB**。批数不变（草稿 844 MiB < 1 GiB，仍 1 批；主模型仍 ≥ 21 批）。
- **建议改法**：把草稿 session 改成「MTP 层 540.75 MiB + 1 层 864 KiB + 草稿自建的 `embed_tokens` 151.25 MiB + `shared_head.head` 151.25 MiB ≈ 844 MiB」，并加一句机制说明：**这两份在传完之后才被 proposer 换成主模型的同名张量**（`llm_base_proposer.py#L325` vs `#L384-L387`），所以传输时按自有张量计，稳态显存仍按 02 §7.5 计。随后同步改 `:449`、`:460`、`:463`、`:515` 的 20.62 / 330 GiB，并把待核 3（`embed_tokens` 是否共享）改成已核结论：**传输时不共享**。
- **附带提醒（同一处机制，不另计级别）**：登记是按 storage owner 保活的（`transfer_backend.py#L155-L175`、`#L400-L401`），所以 proposer 之后 `del embed_tokens` 也不会释放这段显存——本实例作为 seed 时会长期钉住这多出的 ~302.5 MiB/卡。若要写进底稿，属于新增事实，建议先实测日志再写。

---

## P2

### P2-1 「传完就登记成 seed」漏了延迟发布这一档

- **级别**：P2（结论缺源码支撑，且与代码路径不符）
- **位置**：`01-deploy-entry-schedule.md:399`（做了什么第 4 条）、`:431-434`（怎么走的第 7 步）
- **原结论**：「读完后把自己也登记成 seed，供下一个实例借」「调 `_start_rfork_seed_service`…依次做三件事：起 seed 服务 → `POST /add_seed` → 每 30 s 心跳」
- **源码证据**：传输成功后租约归还是**后台线程异步**做的（`session.py#L145-L147` → `_ensure_lease_release_retry_locked` `#L150-L168`）。`start_seed_service` 在 `self.seed_lease is not None` 时**不会**起服务，而是把参数存进 `_deferred_seed_start` 并返回 `DEFERRED`（`session.py#L336-L345`），loader 侧把 `DEFERRED` 当作「未启动」（`rfork_loader.py#L100-L101`）。真正发布要等租约归还后由 `_promote_deferred_seed_locked` 补做（`session.py#L227-L250`）。启动线程走完时是否已成为 seed，取决于 Planner `PUT /put_seed` 的往返。
- **建议改法**：第 7 步加一句：「若源租约尚未归还（归还在后台线程里做），`start_seed_service` 返回 `DEFERRED`，本实例先只做推理，等租约归还后再由 `_promote_deferred_seed_locked` 补发布（`session.py#L336-L345`、`#L227-L250`）。」做了什么第 4 条相应改成「读完后（租约归还后）把自己也登记成 seed」。

### P2-2 A0.8 的版本口径：`rfork@3284850b` 树里没有 GLM-5.3-Flash 的模型实现

- **级别**：P2（前提缺失，影响整节适用性的判断）
- **位置**：`01-deploy-entry-schedule.md:390`（本节源码以工作版为准）、`:444-445`（第 9 步 MTP 草稿）、`:485-488`（适用条件）
- **原结论**：本节源码以 `rfork@3284850b` 为准；第 9 步用该版本行号描述 GLM 的 MTP 草稿；适用条件只提到「官方测试表里没有 GLM-5.3-Flash W8A8」。
- **源码证据**：`git -C tools/repos/rfork ls-tree -r --name-only 3284850b | grep -i glm` 只有 `docs/…/GLM4.x|GLM5|GLM5.2` 和 e2e 配置，**没有** `vllm_ascend/models/glm5_next*.py`；而 GLM 的实现与 MTP 只存在于 `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py`、`glm5_next_mtp.py`（注册见 `db701c1f:vllm_ascend/models/__init__.py#L19-L24`）。工作版的模型集是 DeepSeek-V4 / Kimi-K3 / MiniMax 等。
- **影响**：A0.8 描述的「我们这套部署 + 工作版 RFork」是**两个代码基的组合**，不是某个可直接运行的 commit；第 9 步里「草稿是另一套 session」成立（`_is_mtp_hf_config` 按 `architectures` 以 `MTPModel` 结尾判定，`rfork_loader.py#L112-L126`；`Glm5NextMTPModel` 正好满足，`db701c1f:vllm_ascend/models/__init__.py#L19`），但结论依赖的是 db701c1f 的注册名。
- **建议改法**：在 `:390` 的版本说明里补一句：「工作版这棵树里没有 GLM-5.3-Flash 的模型实现（无 `glm5_next*.py`），本节是『工作版的 RFork loader + db701c1f 的 GLM 模型』的组合推演；真要跑，需要先确认两边合并后的代码。」并在适用条件里与「官方测试表没有 GLM-5.3-Flash」并列。

---

## P3

| # | 位置 | 问题 | 证据 / 建议 |
|---|---|---|---|
| P3-1 | `:369` | 「整机 16 × 20.58 ≈ 329 GiB」与同一代码块 `:364-365` 的「每台机器 = 一个节点 8 卡」用词冲突 | 16 卡是**整个实例**（两台机器）。改成「整实例 16 × 20.58 ≈ 329 GiB（每台机器 8 × 20.58 ≈ 165 GiB）」 |
| P3-2 | `:298` | 「昇腾没有重载这个 loader（在 `vllm_ascend/ops/` 下 `git grep` 无命中）」 | 结论（FusedMoE 的 loader 未被重载）成立，但证据写法不准：`git grep "def weight_loader" db701c1f -- vllm_ascend/` 有 1 处命中 `vllm_ascend/ops/linear.py#L467`（`AscendColumnParallelLinear`，只对 `wo_a` 前缀特殊处理，其余走 `super()`；GLM 侧 `glm5_next.py` 无 `wo_a`）。建议改成「`git grep "def weight_loader"` 在 `vllm_ascend/` 下只有 `ops/linear.py#L467` 一处，且只针对 `wo_a`，FusedMoE 的 loader 没有重载」 |
| P3-3 | `:424` | `read_weights_from_seed（transfer_backend.py#L626-L775）` | `#L626` 是私有实现 `_read_weights_from_seed_locked`，公开方法在 `#L616-L624`。建议写 `#L616-L793` 或 `#L626-L793`（函数实际结束在 `#L793`） |
| P3-4 | `:426` | `validate_weight_manifest…要求张量条数与总字节两边相等（manifest.py#L164-L250）` | 条数/总字节的比较在 `manifest.py#L244-L252`，落在所引区间之外一截。改成 `#L164-L252` |
| P3-5 | `:423` | seed 侧路由 `seed_server.py#L162-L175` | `/get_rfork_transfer_engine_info` 在 `#L162-L172`；`#L174-L178` 是另一条 `/get_rfork_transfer_engine_shape_info`。改成 `#L162-L172` |
| P3-6 | `:352-356` | C 的还原把 MTP 层里「每卡整份」的参数（router gate 4.5 + `fused_qkv_a` 8 + `wk_weights_proj` 1.25 ≈ 13.75 MiB）当成 TP 分片 ×8 | 425.75 MiB 的清单只算了主干 42/45 层的那几项。C 因此偏大约 13.75 × 7 ≈ 96 MiB ≈ 0.09 GiB，对 ≈307 GiB 的结论无影响，但算式与 02 §1.3/§7.5 的口径不一致，建议在清单后加括号说明「MTP 层内的整份参数未单列，误差 ≈0.1 GiB」 |
| P3-7 | `:452-463` | A0.8 的每卡字节沿用 02 §1.3，同样不含视觉塔与 W8A8 Linear 的 scale/offset | A0.7 在待核 1 里写了这个口径（`:380`），A0.8 只在 `:462` 提了 Linear 的 scale「另计」，没提视觉塔。建议在 `:452` 的口径行里补一句与 A0.7 一致的说明 |

---

## 算式复算（全部通过）

| 算式 | 底稿值 | 复算 | 结论 |
|---|---|---|---|
| 路由专家全量 `288 × 43 × 3 × 4096 × 2048 × 1 B` | 311,653,564,416 B = 290.25 GiB | 288×3×8,388,608 = 7,247,757,312 B/层（= 6912 MiB = 每卡 432 MiB × 16）；×43 = 311,653,564,416 B；÷1024³ = 290.25 | ✅ 精确 |
| 每卡非专家 `21,078 − 43 × 432` | 2,502 MiB | 43×432 = 18,576；21,078−18,576 = 2,502 | ✅ |
| 每卡整份项 `189 + 135 + 8×11 + 1.25×11` | 425.75 MiB | 189+135+88+13.75 = 425.75 | ✅ |
| 还原整份 `(2,502 − 425.75) × 8 + 425.75` | 17,035.75 MiB ≈ 16.64 GiB | 2,076.25×8 = 16,610；+425.75 = 17,035.75；÷1024 = 16.636 | ✅（口径见 P3-6） |
| `C ≈ 290.25 + 16.64` | ≈ 306.9 GiB（文中另处写 ≈307） | 306.89 | ✅ |
| 预取每 rank `C/16` | ≈ 19.2 GiB；8 rank ≈ 153 GiB | 306.9/16 = 19.18；×8 = 153.5 | ✅ |
| 每 rank 过手 `2C` | ≈ 614 GiB | 2×306.9 = 613.8 | ✅ |
| 主模型 session `20,537 + 42 × 864 KiB` | ≈ 20,572 MiB ≈ 20.09 GiB | 42×864 KiB = 35.44 MiB；20,572.4 MiB；÷1024 = 20.09 | ✅ |
| `864 KiB = 18 × 4096 × (2+2+2+2+4) B` | 864 KiB | 18×4096×12 = 884,736 B = 864 KiB | ✅ |
| A0.7 的 `43 层 × 864 KiB` | 36.3 MiB | 37,152 KiB = 36.28 MiB | ✅（与 A0.8 的 42+1 拆法自洽） |
| 每卡合计 | 21,114 MiB ≈ 20.62 GiB | 20,572+541.6 = 21,113.6；÷1024 = 20.62 | ⚠️ 算术对，输入错，见 P1-1 |
| 主模型批数 `⌈20,572/1024⌉` | ≥ 21 批 | 20.09 → 21；分批规则 `chunk_bytes + seg > 1 GiB` 才切（`transfer_backend.py#L142-L144`），下界成立 | ✅ |
| 单张量最大 `w13_weight` | 288 MiB < 1 GiB | 18×4096×4096×1 B = 301,989,888 B = 288 MiB；`w2` = 144 MiB | ✅（不触发切段） |
| seed key 数 | 主 16 + 草稿 16 = 32 | key 含 `tp_rank`(r mod 8) + `ep_rank`(= 全局 rank) + `is_draft_worker`（`identity.py#L254-L287`），16 个 rank 两两不同；草稿另起 session（`rfork_loader.py#L149-L150`） | ✅ |

---

## 关键结论逐条核对

1. **EP 过滤默认关，每 rank 要把整份 checkpoint 过两遍** ✅
   `enable_ep_weight_filter: bool = False`（`vllm@0fc695fc:vllm/config/parallel.py#L156-L162`）；`_init_ep_weight_filter` 三个条件全真才生效（`vllm/model_executor/model_loader/default_loader.py#L318-L379`，`#L330-L334`），否则 `local_expert_ids = None`，迭代器不跳过（`weight_utils.py#L1021-L1027` 的 `should_skip_weight`）。教程 `--ep-weight-filter` 0 次命中（`grep -c` 复核）。草稿走同一条默认 loader：`draft_load_config` 默认 `None`（`vllm/config/speculative.py#L187`）→ `get_model` 回落 `vllm_config.load_config`（`model_loader/__init__.py#L140`）→ `_create_draft_vllm_config` 只 `replace` kernel/attention 配置（`vllm/v1/spec_decode/llm_base_proposer.py#L1157-L1180`），`AscendSpecDecodeBaseProposer` 继承该类（`db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L152`、`#L296-L317`）。MTP 只留第 45 层（`glm5_next_mtp.py#L281-L291`），主模型跳过第 45 层（`glm5_next.py#L2346-L2347`）。
2. **预取按 16 个 rank 分文件，每台机器只预热一半** ✅
   `paths_to_prefetch = sorted_files[rank::world_size]`（`weight_utils.py#L829-L835`），rank/world_size 取自默认进程组；DP 下 `rank = dp_rank*8 + local_rank`、`world_size = world_size_across_dp = 16`（`vllm/distributed/parallel_state.py#L1545-L1551`）。后台守护线程 `#L884-L890`，8 线程 / 16 MiB 块来自 `vllm/config/load.py#L12-L13`。教程带 `--safetensors-load-strategy prefetch`（`GLM5.3-Flash.md#L282`、`#L332`，`grep` 复核 3 次命中）。
3. **RFork 每卡传多少、主模型分几批、32 个 seed key** — 批数与 key 数 ✅，字节数 ❌ 见 P1-1。分批规则、1 GiB/512 段常量、`batch_transfer_sync_read(session_id, 本地, seed, 长度)` 参数顺序均与源码一致（`transfer_backend.py#L33-L34`、`#L121-L152`、`#L740-L765`）。EP 组序号等于全局 rank：`all_ranks.transpose(1,2).reshape(-1, dp*pcp*tp)` 得到唯一一组 `[0..15]`（`parallel_state.py#L1749-L1755`、`#L1854-L1864`），与 A0.2 一致。
4. **W8A8 必须走 processed-layout 分支** ✅
   `_requires_processed_layout_transfer` 在 `model_config.quantization` 非空时直接 True（`rfork_loader.py#L503-L505`），教程带 `--quantization ascend`；为真时先对空模型跑后处理再 `torch.npu.synchronize()`（`#L593-L608`，同步在 `#L603`），MoE 换成去包装的原始后处理（`#L353-L370`）；官方文档同口径（`db701c1f:docs/source/user_guide/feature_guide/rfork.md#L67-L72`，`W_UV`/`W_UK_T` 在 `#L71`）。昇腾后处理的替换点也核过：`base_loader.py#L80` 调的函数被 `patch_process_weights_after_loading.py#L63-L64` 换掉，该补丁比上游多认 `AscendIndexerKPoolMLAAttention`（`#L18-L23`、`#L47-L55`），MLA 转交 `impl`（`ops/indexer_kpool_mla.py#L139-L140`）；`weight_nz_mode` 默认 1（`ascend_config.py#L247-L254` + `envs.py#L92` 的 `VLLM_ASCEND_ENABLE_NZ` 默认 1）。
5. **回退条件** ✅
   `_RForkSeedUnavailable`（`rfork_loader.py#L619-L620`、`#L645-L651`）与任意异常（`#L652-L655`）→ `prepare_for_fallback` 最多 2 次（`#L59`、`#L657-L662`）→ `_reset_process_global_model_state`（`#L664-L665`）→ 清理失败直接抛错拒绝回退（`#L667-L671`）→ gc + `empty_cache`（`#L673-L681`）→ `_make_fallback_load_config`（`#L174-L178`，只改 `load_format` 与 extra config，保留教程设的 prefetch）→ `get_model`（`#L683-L696`）→ `load_source="fallback"` 登记 seed（`#L699-L710`）。dynamic EPLB 的绕过在建 session 之前（`#L540-L561`、判定 `#L373-L383`），教程 `enable-eplb` 0 次命中。

---

## 差异表逐行核对（L493–506）

| 表行 | 社区版引用 | 工作版引用 | 判定 |
|---|---|---|---|
| 文件（6 vs 13） | `ls-tree db701c1f` = `__init__/rfork_loader/rfork_worker/seed_protocol/seed_server/transfer_backend` | `ls-tree 3284850b` = 上述去掉 2 个 + `session/identity/manifest/planner_client/seed_client/tensor_layout/config/types/compat` | ✅ 6 与 13 都对 |
| 何时问 Planner | `#L264-L265`（`is_seed_available()` 在 `#L267` 的 `initialize_model` 之前） | `#L610-L620`（`acquire_seed()` 在 `#L572-L577` 建模型、`#L593-L608` 后处理之后） | ✅ |
| 后处理后同步 | `#L275-L277` 只有 `process_weights_after_loading` | `#L603` `torch.npu.synchronize()` | ✅ |
| 绕过条件 | `#L110-L124`（`_is_layer_sharding_enabled` + `_is_dynamic_eplb_enabled`）、`#L236-L239` | `#L373-L383` 只判 EPLB；`git grep layer_sharding` 在工作版 rfork 目录 0 命中（已复跑） | ✅ |
| seed key | `seed_protocol.py#L28-L59`：明文、含 `node_rank`、不含 dtype/量化/并行大小 | `identity.py#L196-L287`：SHA256(指纹 + tp/pp/ep + draft)，不含 `node_rank` | ✅（指纹内容与底稿列的 11 项一致，另含 `is_moe_model`，未列，无碍） |
| 收集张量 | `transfer_backend.py#L149-L204`，`seen_data_ptrs` 去重 | `tensor_layout.py#L118-L197`，按名字去重、冲突 `raise`、`#L21` 排除 `topk_indices_buffer` | ✅ |
| 清单校验 | `#L435-L442` 只核 numel/element_size | `manifest.py#L164-L250` 另核 dtype（`#L235-L242`）、条数与总字节（`#L244-L252`） | ✅（行号见 P3-4） |
| 分批 | `#L27-L28` 常量、`#L215-L248` 按整张量分组 | `#L121-L152` 先切段再分组 | ✅；「本部署最大张量 288 MiB，两种切法结果相同」成立 |
| 内存登记 | `#L344` `batch_register_memory(addresses, sizes)` | `#L405-L422` `batch_register_memory_ex` + `MemoryRegistration`，每批 ≤ 4096（`#L35`），storage owner 保活（`#L155-L175`） | ✅ |
| MTP 草稿 | 社区版 `register_memory_region(self, model)`（`#L298`）无 exclude 参数 | `rfork_loader.py#L492-L501` + `#L584-L591` | ✅ |
| 非量化分支顺序 | `#L291-L293` 先 `start_seed_service` 再后处理 | `#L631-L644` 先后处理、`eval()` 再发布 | ✅ |
| 回退清理 | `#L296-L308` `post_transfer` + `reset_transfer_state` + `del model` | `#L657-L681` | ✅ |

---

## 与 01 其他部分、02 §1.3 的一致性

- A0 第 6a/6b 步（`:73-74`）与 §A0.7/§A0.8 的入口、默认 `auto`→`DefaultModelLoader`、回退描述一致 ✅。
- A0.3（`:133-134`）与 A0.7（`:273`、`:337`）都以 02 §1.3 的 **21,078 MiB = 20.58 GiB**（主干 20,537 + MTP 540.75）为单一真相源，`docs/mainline/02-forward.md:128-130` 一致 ✅；A0.5 用的 ≈21 GiB 向上取整也自洽。
- A0.7 的路由专家每卡每层 432 MiB、43 层口径与 02 §1.3（42 层 ×432 + MTP 内 432）一致 ✅。
- A0.8 的 scale/offset/FP32 拆成「主 42 层 + 草稿 1 层」与 A0.7 的「43 层 × 864 KiB = 36.3 MiB」一致 ✅。
- 唯一的跨文件不一致来自 P1-1：A0.8 把 02 §7.5 的**稳态**口径（lm_head 记 0、不记草稿 embed）直接当成**传输时刻**的活张量口径。

---

## 本轮被跳过 / 未核

1. `vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py` 的函数体读取被安全分类器拦断，只用 `grep` 确认了函数起始行：`AscendW8A8DynamicLinearMethod.process_weights_after_loading` 在 `#L127`、`AscendW8A8DynamicFusedMoEMethod.get_weight` 在 `#L188`、`get_dynamic_quant_param` 在 `#L200`、`process_weights_after_loading` 在 `#L353`，与底稿引的 `#L127-L152`、`#L188-L212`、`#L353-L365` 的起点吻合。**函数体未逐行核**，因此底稿 `:284`、`:302-303`、`:322-331`、`:476` 描述的具体形状、`transpose` 轴、`w13_weight_scale_fp32` 是否只有 w13 一份，本轮只做了口径自洽性检查（288/144 MiB、864 KiB 复算通过），没有源码逐行确认。
2. 按任务约束未读：`HANDBOOK.md`、`docs/plans/`、`wiki/concepts/glm-5-3-flash-two-node.md`；02 只读了 §1.3 与 §7.5（P1-1 需要）。
3. 未实测：所有需要启动日志的项（checkpoint 实际大小与文件数、`Available RAM`、`Loading model weights took`、RFork 的 `weights=/chunks=/bytes=`），与底稿各自的「待核」一致。
