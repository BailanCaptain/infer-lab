# 03-request-call-chain.md 映射与核验台账

- **源页面**：`wiki/concepts/request-call-chain.md`（640 行）
- **候选文件**：`docs/reviews/2026-11-15-wiki-restructure/batch-5-2-candidates/03-request-call-chain.md`（638 行）
- **Frontmatter & Citations 盘点**：
  - `id: request-call-chain`，`type: concept`，`origin: direct`，`chapters: ['09']`，`order: 10`，`sources: 166 条`（`L32-L207` 逐行 100% 保留），`verified: 4 项`（`releases/v0.23.0`、`releases/v0.26.0rc`、`releases/v0.30.0rc2`、`main`，`L208-L212` 100% 保留），`evidence: C`，`relations: 6 条`（`L214-L232` 逐行 100% 保留）。
  - 图表与算式块：6 处 `wiki-diagram`（`request-call-chain` `L269-L271`、`request-call-chain-step` `L301-L303`、`request-call-chain-functions` `L330-L332`、`request-call-chain-branches` `L354-L356`、`request-call-chain-log-route` `L368-L370`、`request-offline-queue` `L400-L402`）与 1 个 `calc` 块（`分两次提交，最后一起收齐（示意）` `L406-L410`）逐字 100% 保留。
  - 行内引用标签：共 `27` 处（`22` 处 `[C...]`：`[C40]`、`[C12]`、`[C42]`、`[C34]`、`[C43]`、`[C23]`、`[C8]`、`[C10]`、`[C44]`、`[C49]`、`[C5]`、`[C14]`、`[C28]`、`[C27]`、`[C48]`、`[C46]`、`[C33]`、`[C15]`、`[C16]`、`[C51]`、`[C32]`、`[C13]`；`2` 处 `[D]`；`2` 处 `[I]`；`1` 处 `[A]`），100% 保留。
- **H2 / H3 锚点核对（`headersRemoved: []`）**：
  - 原文全部 9 个 H2 与 6 个 H3（共 15 个标题）原样保留，未删改任何标题文本。

## 段落级重排与反引号恢复映射表

| 原文行号（`wiki/concepts/request-call-chain.md`） | 原文内容摘要 | 候选文件行号（`03-request-call-chain.md`） | 变更说明 |
|---|---|---|---|
| `L1-L236` | Frontmatter（含 166 条 `sources`、4 项 `verified`、6 条 `relations`） | `L1-L236` | 逐字 100% 原样保留 |
| `L237-L363` | 导语、`## 七站分在三种进程里`、`## 进程之间的四条通道`、`## 一步之内：EngineCore 给 worker 发两次调用`、`## vllm-ascend 从六个口子接进 vLLM`、`## 七站逐站：从哪个函数进，往下调谁`、`## 同一条请求，第 1 步和第 2 步走的分支不同` | `L237-L363` | 原样保留全部叙述与 4 处 `wiki-diagram`，系统恢复被旧 `maxInlineCodePerK` 卡尺剥离的类名、方法名与配置标识反引号（`OutputProcessor`、`EngineCore`、`EngineCore_DP0`、`EngineCore_DP1`、`msgpack`、`gloo`、`future`、`AsyncScheduler`、`NPUPlatform`、`NPUWorker`、`NPUModelRunner`、`GPUModelRunner`、`AscendIndexerKPoolMLABackend`、`AsyncLLM`、`running`、`waiting`、`align`、`BalanceScheduler`、`input_batch`、`prepare`、`finalize`、`ExecuteModelState`、`ModelRunnerOutput`） |
| `L396-L425` | `## 出问题时，判断它停在哪一站`（含 `request-call-chain-log-route` 2D 图、最里层栈帧认站表、日志与卡住排障、图模式 `plog` 定位） | `L364-L393` | 前移紧接在七站主干与第 1/2 步分支（`L350-L363`）之后，使 HTTP 七站代码路径与按栈帧认站排障形成连续闭环；恢复 `aclnn`、`EngineCore`、`3000`、`plog` 反引号 |
| `L364-L395` | `## 离线脚本能先提交几组请求，再一起取结果吗？`（含 `request-offline-queue` 2D 图、`calc` 块与 `### 脚本能直接检查各个 Worker 吗？`） | `L394-L425` | 归置到七站排障之后、`## 常见误解` 之前，保留全部标题、2D 图与 `calc` 块，恢复 `LLM`、`level=0`、`collective_rpc`、`apply_model`、`UniProc`、`timeout` 反引号 |
| `L426-L433` | `## 常见误解`（5 条） | `L426-L433` | 5 条常见误解全部保留，恢复 `EngineCore` 反引号 |
| `L434-L509` | `## 对照源码` → `### 怎么开`、`### 会报什么错`、`### 开销和什么时候别开` | `L434-L509` | 完整保留离线队列、公开 RPC 与三个超时环境变量说明、报错条目及开销说明，恢复 `llm`、`sampling_params`、`mode="abort"`、`level=0`、`level=1`/`2`、`VLLM_ENABLE_V1_MULTIPROCESSING`、`wait_for_completion`、`RequestOutput`、`PoolingRequestOutput`、`output_type`、`enqueue`、`collective_rpc`、`timeout=None`、`timeout`、`args`、`kwargs`、`apply_model`、`get_model`、`ACLGraphWrapper`、`VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS`、`HCCL_CONNECT_TIMEOUT`、`HCCL_EXEC_TIMEOUT`、`hcclExecTimeOut`、`non_block`、`future.result`、`execute_dummy_batch`、`VLLM_RPC_TIMEOUT`、`fail_on_environ_validation`、`ValueError`、`UniProc`、`plog`、`generate`、`chat` 等反引号 |
| `L510-L555` | `### 版本差异`（含 `L527` `**v0.30.0rc2 需要更新按文件名认栈的路径。**` 补丁段与四张版本对比表） | `L510-L553` | 将原 `L527` 的 `v0.30.0rc2` 认栈路径变更（HTTP SSE 辅助入口迁至 `entrypoints/serve/utils`、`execute`/`sample`/`update` 次序保留、MTP proposer 改由 `get_spec_decode_method` 统一分派并按 `glm5_next_mtp`/`Glm5NextMTPModel` 白名单选 `AscendMultiKVCacheGroupMTPProposer`、排错看 `models/glm5next` 与 `multi_kv_cache_group_proposer` 而非只找旧 `AscendEagleProposer`、区分 `MRV1`/`MRV2`）完整并入公共引擎与 GLM 模型栈四版本对照表（`L536-L540`）及表下说明（`L542`），消除表上方独立粗体补丁段，保持 `v0.30.0rc2` 与 `固定 main` 边界精确 |
| `L556-L640` | `### 源码位置`（超时/rc2/离线队列/公开 RPC 来源索引、读源码顺序、一步的骨架、进程边界、第 2 站五处 patch、七站函数、六个接入点及来源 56–57） | `L554-L638` | 完整保留全部源码位置、内联引用标签与 166 条 `sources` 索引，恢复代码标识符反引号 |
