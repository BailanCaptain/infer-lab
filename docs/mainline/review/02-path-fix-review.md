# 02 推理路径修正复审（稀疏 attention + MoE）

- 对象：`docs/mainline/02-forward.md` §12.5 第二行（「C3 复审：§5.5 与全文推理路径复核」）所列改动，以及 `wiki/concepts/one-request.md` 的对应 3 行
- 基线：`vllm-ascend@db701c1f`、`vllm@0fc695fc`（= v0.23.0）；官方双机部署：A2、DP2×TP8、EP16、W8A8
- 方法：只做源码静态核对，没有在 NPU 上实测。执行侧代码一律通过 `git show db701c1f:<path>` / `git show 0fc695fc:<path>` 读取
- 限制：`docs/mainline/` 整个目录没有纳入 git 跟踪（`??`）；one-request 的工作区相对 HEAD 是整页重写（+535/−176）。所以两份文件都没法用 diff 定位「这一轮具体改了什么」，改动范围按 §12.5 的修订记录加 grep 来认定；「数字没动」则通过文内自洽、重算和跨文档比对来确认
- 拦截记录：没有文件或命令被拦截。有一次回复在读完 `device_op.py#L717-L795` 之后被安全分类器中断；那段读取结果在中断前已经拿到，核对没有缺口
- 未读（按约束）：HANDBOOK.md、docs/plans/

## 一、问题清单

| # | 级别 | 文件:行 | 问题 | 证据 |
|---|---|---|---|---|
| 1 | **P2**（本轮范围外的同类问题） | `wiki/concepts/sparse-attention.md:11`、`mla.md:13`、`attention-cost.md:15`、`block-table.md:15`、`attention-backend-family.md:18` | 这 5 页的 sources 都引用了 `indexer_kpool_mla_v1.py#L980-L1061`，这段落在只供单测使用的 `_sparse_attention_pytorch` 里，正是本轮在 02 中纠正的那一类错误。§12.5 只 grep 了六个主线页，这 5 页不在其中，所以漏掉了。正文的说法本身没错，错在出处指向了推理时不执行的代码 | `_sparse_attention_pytorch` 从 L857（`@staticmethod`）起，到 L1064 结束；下一个 def 在 L1065。`git grep` 显示它的调用方只有 `tests/ut/models/test_glm5_next_indexer_kpool_mla.py:1661,1762`，外加 `tests/e2e/.../test_sfa_no_rope.py:108` 的一行 docstring。生产路径是 `indexer_kpool_mla_v1.py#L1065-L1104` → `device_op.py#L719-L793`。建议出处改成这两段 |
| 2 | P3 | `02-forward.md:549`（§5.9） | `topk_indices` 各行的描述（「前 3 行仅有 1/2/3 个尾部位置；末行 1 个完整 pool 展开为 0–3」）只对 **prefill 步（位置 0–3）** 成立。§5.9 标题没写是哪一步，而 §0.3 说 prefill 和 decode 的形状相同，§5.4:450 又在讲 decode 从 4 增到 8。如果套到 decode 步（位置 4–7），正确的描述是：前 3 行 = pool 0 展开 + 1/2/3 个尾部，末行 = 2 个完整 pool（0–7），尾部为 0 | triton `glm5_next_lightning_indexer.py` L90–91：`visible_pool_len = min((pos+1)//4, request_pool_len)`；L229–230：`tail_start/tail_count`。one-request:319/330/341 明确写的是 prefill 语境，与 02 一致。建议在 549 行加上「（prefill，位置 0–3）」 |
| 3 | P3 | `02-forward.md:677`（§6.5） | combine 写成了 `npu_moe_distribute_combine`，但 dispatch 写的是 `_v2`。两者由同一个开关控制，所以 combine 实际也是 `npu_moe_distribute_combine_v2`。字节数不受影响 | `token_dispatcher.py` L112 `enable_dispatch_v2 = hasattr(torch_npu, "npu_moe_distribute_dispatch_v2")`；L230–234 dispatch 用 v2；L333–337 在同一个开关下 combine 用 `_v2` |
| 4 | P3 | `02-forward.md:723`（§6.7） | `moe_runner.py#L654-L677` 这个区间没有包含真正调用 `_maybe_reduce_final_output` 的那一行 | `vllm@0fc695fc:.../runner/moe_runner.py` L678：`result = self._maybe_reduce_final_output(result, og_hidden_dim)`，L677 是空行。建议改为 `#L654-L678` |
| 5 | P3 | `02-forward.md:727`（§6.8） | 分支条件写得不完整：原文只写了「`enable_sp()` 为假」，代码里实际是 `enable_sp() or enable_sp_by_pass()`。结论不变，但条件应写全 | `prepare_finalize.py` L370、L520；`ascend_config.py` L291–295：`enable_sp_by_pass = not enforce_eager and pass_config.enable_sp`；`vllm/config/vllm.py` L250/L271 的默认值是 `enable_sp: IS_DENSE`，对 MoE 模型为假（只有 L1172–1173 在 `fuse_gemm_comms` 打开时才会强制开启） |
| 6 | P3 | `02-forward.md:673`、`:709` | 两处行号只覆盖了一部分：`apply` 的 def 在 L214，文中引的是 L290–L350（主体都在这段里，可以接受）；§6.6 说「转置并转 NZ」引 L358–L366，但转置在 L354–355，落在区间外。可能是之前就有的问题，不一定是本轮引入的 | `w8a8_dynamic.py` L214 `def apply`、L326 `fused_experts`、L354–355 `transpose`、L358–360 `if quant_type == W8A8: npu_format_cast(... NZ)` |
| 7 | P3 | `02-forward.md:1010-1044`（§11） | 源码索引缺了本轮新引用的 `csrc/torch_binding.cpp`（458 行）和 `v:vllm/model_executor/layers/fused_moe/runner/moe_runner.py`（723 行）。上一轮引用的 `ops/glm5_next_lightning_indexer.py`、`ops/triton/glm5_next_lightning_indexer.py`、`ops/glm5_next_kpool_state_compress.py`（417–432 行）也没有收进索引 | 对 §11 做 grep，上述文件都搜不到；`v` 列表里只有 `fused_moe/{config,layer}.py` |

没有 P1。

## 二、逐处核实通过的内容

### 稀疏 attention（§5.5，另含 §5.2 / §5.11 / §10）

执行链逐跳核对，均符合原文：

1. `sfa_v1.py` L1994–2002 调用 `self._execute_sparse_flash_attention_process`，动态派发到子类重写 `indexer_kpool_mla_v1.py` L1065–1104。L1092 从 `_indexer_kpool_mla_caches["kv"]` 取出 packed KV，传给 `DeviceOperator.execute_sparse_attention_indexer_kpool_mla`（`sparse_mode=3`）
2. `device_op.py` L2317–2326：设备为 A5 时用 A5 适配器，为 310P 时用 310P 适配器，**其余情况（含 A2）一律用 `BaseDeviceAdaptor`**。L719–793 的参数与原文逐项一致：key 和 value 都传 packed KV，`query_rope/key_rope=None`，`sparse_block_size=1`，`TND`/`PA_BSND`，`attention_mode=2`
3. `csrc/torch_binding.cpp` L2849 定义 schema、L2859 注册实现；`sparse_flash_attention_torch_adpt.h` L93 是入口，L124–125 通过 `EXEC_NPU_CMD(aclnnSparseFlashAttention, …)` 下发
4. 返回后执行 `sfa_v1.py` L2004 的 `_v_up_proj` 和 L2028 的 `o_proj`
5. §5.2：`indexer_kpool_mla_v1.py` L577–578 把 `enable_sfa_prolog_v3` 和 `enable_mlapo` 强制设为 False，与 §5.11、§10 第 4 条一致
6. §5.5 的数字重算：8×2051×512×2 = 16.8 M MAC，即 33.6 MFLOP；乘 11 层 ≈ 370；2051×512×2 B = 2.00 MiB；12 层 24.0 MiB，11 层 22.0 MiB。全部对得上

### MoE（§6.5–6.8）：从模型 forward 到算子的完整链路

- 版本分支：Dockerfile L42 `VLLM_TAG=v0.23.0`（对应 02:18）。`fused_moe.py` L290–291 在 v0.23.0 下导入 `fused_moe_0_23_0`，`utils.py` L763–768 把 `FusedMoE` 注册为 `AscendFusedMoE`
- 模型侧：`glm5_next.py` L1502–1503 调用 `FusedMoE(shared_experts=...)`，L1534 调用 `self.experts(...)`
- 进入 runner：`fused_moe_0_23_0.py` L287 把 `shared_experts` 交给 runner，L415 调用 `runner.forward`。vLLM 侧 `moe_runner.py` L594 `forward` → L280 `torch.ops.vllm.moe_forward_shared` → L134 `layer.runner._forward_impl`。回到 Ascend：L125 `_forward_impl` → L104 `forward_impl`，L122 进入 `shared_forward_impl`（L672）→ L693 调用 `forward_impl`（L420）
- 在 `forward_impl` 里依次执行：L479 `prepare`，L497 `quant_method.apply`，L541 `finalize`。L438 的 `multistream_overlap_gate` 分支因默认值为 False 被跳过（`ascend_config.py` L140）
- 量化方法：`w8a8_dynamic.py` L155 注册 `("W8A8_DYNAMIC","moe")`，L160 设 `quant_type = W8A8`。量化包里 `"W8A8"` 只注册了 linear，没有 moe，所以专家只能走 W8A8_DYNAMIC 方案（依据：本机没有 `quant_model_description.json`，因此这一条属于推断，与 02 §0.4 的限定一致）
- 通信方式的选择：`ascend_forward_context.py` L97–98 取 DP 组内 token 数的最大值；L303 起，A2 且开 EP 时走 `_select_a2_moe_comm_method`（L239–252），只在 MC2 和 ALLGATHER 之间二选一
- MLP 分支：`moe_mlp.py` L154–155 在 MC2 下成立。`w1_scale_bias` 为 None（因为 `fused_scale_flag` 为假，只有 FUSED_MC2 才为真），`w1_offset` 没有传入
- 共享专家：L567 的 stream switch 受开关控制，默认为 False（`ascend_config.py` L139）；L572 走 W8A8 分支；L576、580、596、612 四处算子与原文一致；L663–670 在 MC2 下做 TP All-Reduce
- 归约控制：`fused_moe_0_23_0.py` L95–101 → `register_custom_ops.py` L158–166。在 MC2 下直接返回；在 ALLGATHER 且 FlashComm1 关闭时做 all-reduce。`prepare_finalize.py` L543–560 只做 DP 维的 Reduce-Scatter，docstring 里提到的 TP all-reduce 在代码中并不存在，所以 02 把 TP8 All-Reduce 归到 `_maybe_reduce_final_output` 是对的
- `global_bs=0`：`utils.py` L1275–1287（未开分层通信、是 MoE 模型、不是 kv_consumer 时返回 False）→ `token_dispatcher.py` L133

### one-request 的 3 行与 02 一致

| one-request 行 | 对应 02 | 结论 |
|---|---|---|
| :37 `fused_moe_0_23_0.py#L479-L557` | 02:666 | 一致 |
| :330 选位置 | 02:549 | 一致。one-request 在 :319/:341 已明确是 prefill 语境，所以问题 #2 对 one-request 不成立 |
| :341 133120 → 33280 池，选 512 个，读 2048 个，尾部为 0 | 02:450 | 一致（重算：133120/4 = 33280，512/33280 = 1.5%，133120/2048 = 65） |

one-request 的 MoE 小节（:369–378）与 02 §6.9 逐项相同。

## 三、MoE 关键数（grep 抽查 + 重算）

| 数 | 02 中出现的行 | 重算 / 旁证 |
|---|---|---|
| 18 专家/卡 | 636 | 288/16 |
| 门槛 128 | 651 | ceil(128/8) × 8 |
| 4,100 B / 32,800 B | 691、754、900、969 | 4096+4；×8 |
| 8,192 B / 65,536 B | 692、756、901、970 | 4096×2；×8 |
| 98,336 B → 4,130,112 B = 3.94 MiB | 693、695、1089 | 求和后 ×42 |
| 1.31 + 2.63 MiB | 695、968–970 | 32,800×42，65,536×42 |
| 共享专家 3.0 MiB/层，126 MiB | 717 | 2,097,152 + 1,048,576；×42 |
| 路由专家 432.0 MiB，18,144 MiB = 17.72 GiB | 123、625 | 18×(4096×4096+4096×2048) B |
| R1 期望 2 行、32,768 B | 755、758 | 4×8×18/288；4×4096×2 |
| §9.2 合计 218 次 / ≤7.3 MiB | 964–971 | 91+42+42+42+1；2.84+1.31+2.63+0.33+0.15 = 7.26 |

跨文档比对：`02-review.md`（09:04，早于本轮）第 78/119/136–139 行、`03-sample-decode.md` 第 206/209 行，以及 one-request :351–378 中的 432 MiB、18,144、65,536、3.0 MiB、98,336 都一致。**结论：MoE 的数字没有变动。**

## 四、修订记录（2026-09-27）

本轮按 `vllm@0fc695fc`、`vllm-ascend@db701c1f` 逐条静态核对，仅修改 `docs/mainline/02-forward.md` 和本节；上方问题清单保留审查时的原始行号与措辞。

| 意见 | 处理 | 源码核对与修改 |
|---|---|---|
| #2 P3：§5.9 缺少步骤限定 | 已改 | 标题明确为 prefill 步、位置 0–3；`ops/triton/glm5_next_lightning_indexer.py#L88-L91, L228-L236` 按当前位置限制完整池与尾部，原有各行数字仅适用于该步。 |
| #3 P3：combine 算子名 | 已改 | §6.5 改为 `npu_moe_distribute_combine_v2` 并补出处；`ops/fused_moe/token_dispatcher.py#L112, L230-L234, L329-L339` 确认 dispatch/combine 同受 `enable_dispatch_v2` 控制，使用 v2 时两者成对切换。 |
| #4 P3：最终归约行号 | 已改 | §6.7 的 `vllm/model_executor/layers/fused_moe/runner/moe_runner.py#L654-L678` 包含 L678 的 `_maybe_reduce_final_output` 调用。 |
| #5 P3：SP 条件不全 | 已改 | §6.8 补全 `enable_sp() or enable_sp_by_pass()` 为假；核对 `ops/fused_moe/prepare_finalize.py#L370-L373, L520-L523`、`ascend_config.py#L291-L295` 及 `vllm/config/vllm.py#L243-L272, L1170-L1173`，补充本部署下 pass 开关为假的依据。 |
| #6 P3：apply 与权重转置行号 | 已改 | §6.5 的 `quantization/methods/w8a8_dynamic.py#L214-L351` 覆盖 apply 定义至返回；§6.6 改引 L353–L366，包含 L354–L355 转置及 L358–L360 转 NZ。 |
| #7 P3：源码索引缺项 | 已改 | §11 补入 `csrc/torch_binding.cpp`、上游 `runner/moe_runner.py`、`ops/glm5_next_lightning_indexer.py`、`ops/triton/glm5_next_lightning_indexer.py`、`ops/glm5_next_kpool_state_compress.py`；均已核对指定提交中的定义或注册，并收录本轮新增引用的 `vllm/config/vllm.py`。 |
| #1 P2：5 个知识页的出处 | **P2 留到 P5** | 按本轮约束，`sparse-attention.md`、`mla.md`、`attention-cost.md`、`block-table.md`、`attention-backend-family.md` 均未修改，后续重写时一并处理。 |

验证：`pnpm wiki:audit` 的 PowerShell 入口因执行策略无法加载，改用等价入口 `pnpm.cmd wiki:audit`，退出码 0。审计 131 页、1417 条来源，1335 条行号有效；无效 commit、文件不存在、行号越界、未知仓库均为 0。82 条 URL 未联网验证、1158 条 raw 引用待核对；该审计不验证结论语义，本轮 6 条 P3 的语义依据为上述源码静态核对，未做 NPU 实测。未做 git 提交。
