# RFork 盘点与处置建议（2026-09-27）

配套 `2026-09-27-mainline-rebuild.md` §8「RFork 盘点」一条。用户 09-27 决定 RFork 也纳入主线重构，本文把「RFork 是什么、12 页挂在主线哪一站、每页怎么处置、主线底稿要不要补」一次写清。

本轮只读不改：除本文件外没有动任何文件，没有提交，没有派子代理，没有读 `wiki/HANDBOOK.md`。

---

## 1. RFork 是什么

**一句话**：RFork（Tensor Remote Fork）是 vllm-ascend 的一条**热启动权重加载路径**——新实例不从磁盘读 checkpoint，而是向一个外部 Planner 申请一台身份兼容的 seed 实例，通过 YuanRong TransferEngine 把 seed 显存里**已经加载好的权重字节**直接读进自己的参数缓冲区；借不到或任何一步失败就清理干净、回退到默认 loader 从磁盘加载。

它只发生在**请求到达之前**，只替换「权重数据从哪来」，不改模型结构、不改调度、不共享 KV cache、不迁移会话。

### 1.1 上游官方实现（社区版）

- 官方文档：`vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/rfork.md`（`## Overview` / `## Usage` / `## Tested Models` / `## Note & Caveats`）。
- 代码目录 `vllm_ascend/model_loader/rfork/`，三个在册版本（v0.23 `2c59ff10`、v0.26 `2ed6cbba`、main `baa023ad`）都带，**6 个文件**：`__init__.py`、`rfork_loader.py`、`rfork_worker.py`、`seed_protocol.py`、`seed_server.py`、`transfer_backend.py`。
- 注册入口：`vllm_ascend/__init__.py#L54-L61` 的 `register_model_loader()` → `register_rforkloader()`；另在 `vllm_ascend/patch/worker/patch_process_weights_after_loading.py` 把昇腾版 `process_weights_after_loading` 注入 rfork loader 模块。
- 开启方式：`--load-format rfork`，配置走 `--model-loader-extra-config` 的 JSON。
- 硬前提（官方 `## Note & Caveats`）：
  1. 每个实例都要装 **YuanRong TransferEngine**（`yr.datasystem` 的 `TransferEngine` / `MemoryRegistration` / `ErrorCode`），缺了直接 `ImportError`；
  2. 要跑一个实现 seed 协议的 **Planner 服务**（仓库里只给了 mock：`examples/rfork/rfork_planner.py`）；
  3. 每个 worker 进程都要绑一个监听端口；
  4. `additional_config.layer_sharding` 开着就绕过 RFork；
  5. 动态 EPLB（`eplb_config.dynamic_eplb` 或 `expert_map_record_path`）开着也绕过。
- 官方 `## Tested Models`：Qwen2.5-7B / Qwen3-32B / Qwen3-235B-A22B（BF16）、DeepSeek-V4-Flash-W8A8-MTP（W8A8）、GLM5-W4A8、Kimi2.5-W4A8，全部 A2。**没有 GLM-5.3-Flash W8A8**。

### 1.2 用户同事仓库的工作版

两个本地工作树，同一个远端 `https://github.com/yangsonglin13/vllm-ascend`（**不是**用户本人的仓库）：

| 工作树 | HEAD | 分支 | 说明 |
|---|---|---|---|
| `tools/repos/rfork` | `3284850b42f94934dfe6909ed6f1c4c145a7f69c` | `codex/rfork-work` | **知识库钉的工作版**（`wiki/seeds/rfork.yaml` 的 `refs.main`），对应用户 patch7 |
| `tools/repos/rfork-series` | `7ddcfca9291fe9336a1ab8f9064d0dd819ddb2a4` | detached | patch1–6 那条历史的终点，只用来核对分叉 |

两条历史在 patch3 `395a59cb` 之后分叉，所以「patch1–6 原件 + patch7 原件」拼不出 `3284850b` 的代码；差的那段由 `rfork/reconciliation/patch6-to-patch7-base.diff` 单独登记。完整说明在 `rfork/VERSION-NOTE.md` 和 `rfork/README.md`，`pnpm rfork:verify --git` 已核过重放 tree = `62d2fd34…`。

**相对上游基线 `f2f74a16c`（v0.26.0rc 线上的一个社区提交，是 v0.26 钉点的祖先）**：

| | 文件数 | 增 / 删 | 新增模块 | 删除模块 |
|---|---|---|---|---|
| `rfork` @ `3284850b` | 28 | +8318 / −1416 | `config.py`、`identity.py`、`manifest.py`、`planner_client.py`、`seed_client.py`、`session.py`、`tensor_layout.py`、`types.py`、`compat.py` | `rfork_worker.py`、`seed_protocol.py` |
| `rfork-series` @ `7ddcfca9` | 20 | +5370 / −1425 | 同上（少 `session.py` 的租约重试等） | 同上 |

即：社区版 6 个文件 → 工作版 **13 个文件**。改动**全部落在 `vllm_ascend/model_loader/rfork/` 一个目录内**，加上文档、`examples/rfork/rfork_planner.py` 和单测；**没有碰模型实现、调度器、attention、MoE、KV cache 任何一处**（`git grep -i rfork 3284850b4 -- 'vllm_ascend/*'` 在该目录外只有 `__init__.py` 的注册行和 `patch_process_weights_after_loading.py` 的那一行，与社区版一致）。

它解决什么问题，按模块说：

| 模块 | 解决的问题 |
|---|---|
| `session.py`（501 行） | 社区版没有统一管生命周期的对象。工作版把租约、已注册内存、seed 服务、回退清理、关停收进 `RForkSession`，并补上租约归还的后台重试与「延期发布 seed」 |
| `identity.py` | 两次 SHA256：先把模型版本/dtype/量化/并行大小算成兼容性指纹，再拼上 tp/pp/ep rank 与 main/draft 角色算出 seed key，避免拿错分片 |
| `manifest.py` | 传输前逐个张量核对 name/shape/numel/itemsize/dtype，并要求两端张量条数与总字节一致 |
| `tensor_layout.py` | 区分 checkpoint 布局与 processed 布局；排除 `topk_indices_buffer` 这类运行期 scratch 不跨实例传 |
| `transfer_backend.py`（802 行） | MemoryRegistration 的地址/底层 storage 保活、main 与 draft 的重叠地址排除、按 1 GiB / 512 段分批 `batch_transfer_sync_read`、注销与 finalize 分层 |
| `planner_client.py` / `seed_client.py` | 拆开「跟 Planner 记账」和「跟 seed 取元数据」两条 HTTP 通道；Planner 404 当幂等 |
| `config.py` | 11 项配置 + 环境变量兜底 + 严格/宽松两种校验 |

关键默认值（`config.py`）：`seed_timeout_sec=5.0`、`request_timeout_sec=10.0`、`heartbeat_interval_sec=30.0`、`lease_release_max_attempts=3`、`lease_release_retry_interval_sec=30.0`、`seed_bind_host="0.0.0.0"`、`seed_port_base=0`。传输上限（`transfer_backend.py`）：`MAX_TRANSFER_CHUNK_BYTES=1 GiB`、`MAX_TRANSFER_CHUNK_WEIGHTS=512`、`MAX_MEMORY_REGISTRATION_BATCH_ITEMS=4096`。

社区合入情况（现有 `rfork.md` 的「版本差异」表已核过，本轮复核一致）：patch 0001–0003 只进了 **main**（`bc5a79ede`、`a59dea592`），v0.23 与 v0.26 一个都没有；0004–0007 与衔接差异三条社区线都没有。

---

## 2. 页面清单

12 页 = 11 页 `wiki/concepts/` + 1 页 `wiki/sources/`。共 2385 行、约 12.96 万汉字、6 处图引用。全部 `evidence: C`、`verified: ['rfork:main']`、`chapters: []`。

| 路径 | 标题 | 行/汉字 | 图 | order | git | 一句话主题 |
|---|---|---|---|---|---|---|
| `wiki/concepts/rfork.md` | RFork：工作版机制与排错总览 | 204/12599 | 1（`rfork-architecture`） | 10 | 已改未提交 | 总图、三条通道、阅读顺序、四种「成功」、社区版逐补丁差异表 |
| `wiki/concepts/rfork-terms.md` | RFork 术语：把模型、内存和调度的名词分开 | 166/9408 | 0 | 20 | 已改未提交 | seed/rank/layout/storage/MR/manifest/lease 按层列表 |
| `wiki/concepts/rfork-startup.md` | RFork 启动：准备模型以后才借 seed，失败后先清理再重建 | 202/11034 | 1（`rfork-startup`） | 30 | 已改未提交 | 主路径十步、晚申请租约的理由、回退清理清单、两种提前返回 |
| `wiki/concepts/rfork-identity.md` | RFork 身份匹配：同模型、同布局，还要同一份分片 | 193/9668 | 1（`rfork-identity`） | 40 | 已改未提交 | 兼容性指纹 + seed key 两次哈希 |
| `wiki/concepts/rfork-layout.md` | RFork 张量布局：先对齐算子要的形状，再决定搬什么 | 162/8706 | 1（`rfork-layout`） | 50 | 已提交 | 量化/NZ 决定后处理放在传输前还是传输后；MoE 两道临时处理 |
| `wiki/concepts/rfork-memory.md` | RFork 内存：地址、底层存储与 main/draft 共享 | 156/9167 | 1（`rfork-memory`） | 60 | 已提交 | MR 登记的地址范围、storage owner 保活、draft 与主模型共享区间 |
| `wiki/concepts/rfork-transfer.md` | RFork 传输：先验整张清单，再按地址读字节 | 204/10104 | 1（复用 `rfork-architecture`） | 70 | 已改未提交 | manifest 五个量的校验、1 GiB/512 段分批读、「传完」的含义 |
| `wiki/concepts/rfork-lifecycle.md` | RFork 生命周期：模型可用、租约归还、成为 seed 是三件事 | 216/13199 | 1（`rfork-lifecycle`） | 80 | 已提交 | 七个阶段、租约归还三种结果、404 幂等、心跳与 TTL 各看各的钟 |
| `wiki/concepts/rfork-config.md` | RFork 配置：四类端口、各项超时与可复制的启动示例 | 306/14099 | 0 | 90 | 已改未提交 | 11 项配置分四组、键名写错不报错、四类端口、验收方法 |
| `wiki/concepts/rfork-troubleshooting.md` | RFork 排错：从第一条异常还原版本、阶段与资源状态 | 240/13544 | 0 | 100 | 已提交 | 按日志定位阶段，六步写诊断 |
| `wiki/concepts/rfork-maintenance.md` | RFork 版本维护：保留原补丁，钉住真正运行的完整代码 | 181/10265 | 0 | 110 | 已提交 | 七份补丁不是一条链、快照与完整仓库的分工、新补丁怎么接 |
| `wiki/sources/rfork-official-guide.md` | RFork 官网核读：原图、全部章节与工作版差异 | 155/7796 | 0 | 120 | 已改未提交 | 官方指南逐节对照工作版，标出申请时机、key、端口、依赖的差异 |

### 2.1 图

6 个 spec + svg 在 `wiki/diagrams/`：`rfork-architecture`（已改未提交）、`rfork-identity`、`rfork-layout`、`rfork-lifecycle`、`rfork-memory`、`rfork-startup`（后五个已提交）。`rfork-architecture` 被 `rfork.md` 和 `rfork-transfer.md` 两页引用。`rfork-config` / `rfork-terms` / `rfork-troubleshooting` / `rfork-maintenance` / `rfork-official-guide` 五页**一张图都没有**。

### 2.2 toc.ts 里的位置

- `src/content/wiki/toc.ts#L45`：`{ id: "rfork", title: "RFork 工作版", blurb: "独立演进的权重加载实现：机制、术语与故障定位" }`，是 11 个 part 里的第 9 个。
- `#L187-L191`：RFork part 不走 `CURATED`，而是兜底收集 `p.id === "rfork" || p.id.startsWith("rfork-")`，按 `order` 排。所以 `wiki/sources/rfork-official-guide.md` 虽然是 `type: source`，也被收进 RFork 章（id 前缀命中）。
- 含义：**新增或删除 RFork 页不用改 `CURATED`，但改 id 前缀会让页面掉出这一章**。

### 2.3 被代码钉住的东西

| 位置 | 钉住了什么 |
|---|---|
| `tests/rfork-wiki.spec.ts:6` | `toc-rfork` 下恰好 **12 条链接** |
| `tests/rfork-wiki.spec.ts:7` | 版本标签渲染成「RFork 工作版」（`src/app/pages/WikiPage.tsx:29` 把 `rfork:main` 映射过去） |
| `tests/rfork-wiki.spec.ts:8` | `toc-params` 的章号是「五」 |
| `tests/rfork-wiki.spec.ts:11-13` | `rfork.md` 正文里有一条锚文本恰为「术语」的链接，指向 `rfork-terms`，且该页正文含「Memory Region」 |
| `tests/rfork-wiki.spec.ts:14-15` | toc 里有「RFork 排错」开头的链接，该页正文含「400 本身不能证明 TTL 过期」 |
| `tests/rfork-wiki.spec.ts:16-17` | 页面里存在指向 `github.com/yangsonglin13/vllm-ascend/blob/3284850b/` 的链接 |
| `tests/rfork-wiki.spec.ts:21-33` | 六个 id（`rfork`、`rfork-startup`、`rfork-identity`、`rfork-layout`、`rfork-memory`、`rfork-lifecycle`）各自必须有一张图 |
| `tests/wiki.spec.ts:35-47` | RFork 独立成章，章标题「RFork 工作版」 |
| `src/content/wiki/toc.test.ts:116-131` | RFork part 用兜底规则、按 `order` 排；用例里造了 `rfork-new-topic` |
| `src/content/wiki/index.ts:19` + `index.test.ts:68-71` | `rfork@<sha>:path#L..` 解析到同事仓库，与社区仓库分开 |
| `wiki/seeds/rfork.yaml` | 工作版 pin `3284850b42f9…` |
| `package.json:38-39` | `rfork:verify`（`rfork/verify.mjs`）、`rfork:evidence`（`scripts/wiki-rfork-evidence.ts`，只重建 `wiki/concepts/rfork*.md` 的 raw 材料） |
| 入链 | 非 RFork 页里只有 `wiki/concepts/learning-guide.md:55` 链到 `rfork.md`；`wiki/index.md` 是派生物 |

**`tests/rfork-wiki.spec.ts:8` 很可能本来就是红的**：`src/app/pages/WikiPage.tsx:131` 用 `"一二三四五六七八九十"[i]`，`i` 是 `toc.map` 的下标；`PARTS` 有 11 项且都非空，`params` 是第 10 项 → 章号应为「十」，断言写的是「五」。本轮未起服务实跑 e2e，只是读代码推断，落地前按 mainline-rebuild §8 的待办单独跑一次确认。

---

## 3. RFork 和主线的关系

### 3.1 挂在哪一站

**全部落在 A0，且只在 A0 的「加载权重」这一步。** A1–A7、B1–B5 一站都不沾。更准确地说，它是 A0 的一个**变体分支**：把「每张卡从共享目录读自己那份 W8A8 safetensors」换成「每张卡向一台身份兼容的 seed 实例读同一份权重的显存字节」，其余（HCCL 建域 → 量显存 → 切 KV 块 → 捕获图）完全不变。

| 页 | 落在主线哪一步 |
|---|---|
| `rfork.md` | A0，权重加载整段 |
| `rfork-startup.md` | A0，模型初始化 → 布局后处理 → 借 seed → 读权重 → 发布 seed 的顺序 |
| `rfork-identity.md` | A0，与 TP8 / DP2 / EP16 的 rank 编号直接相关（seed key 里带 tp/pp/ep rank） |
| `rfork-layout.md` | A0，`--quantization ascend`（W8A8）决定后处理放在传输前 |
| `rfork-memory.md` | A0，并牵到 A5/A6 的 MTP：draft 模型与主模型共享已注册地址区间 |
| `rfork-transfer.md` | A0，权重字节真正搬运的那一步 |
| `rfork-lifecycle.md` | A0 之后到「服务就绪」之间；不在请求路径上 |
| `rfork-config.md` | A0 的启动命令 |
| `rfork-troubleshooting.md` | A0 的排错，不挂站 |
| `rfork-maintenance.md` | 不挂站（仓库维护流程） |
| `rfork-terms.md` | 横切术语，不挂站 |
| `rfork-official-guide.md` | 来源页，不挂站 |

值得在页面里写明的一句反向结论：**RFork 不改变 A1–A7 和 B1–B5 的任何数字**。同样的 KV 块数、同样的 8192 token 预算、同样的 decode 图尺寸；它只改变 A0 里「权重字节从磁盘来还是从远端实例来」，以及首个请求能被接住的时刻。

### 3.2 在我们的 GLM 双机部署下适用吗

**结论：原理上可用，但官方 GLM-5.3-Flash 教程不启用它，而且我们这套部署目前不满足它的前提。** 逐条：

1. **官方教程没开**。`vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 里 `--load-format` / `rfork` / `netloader` 出现 **0 次**（`git grep -c` 核过）。所以 A0 主线走的是默认 loader，RFork 是可选变体。
2. **缺两个外部件**。要装 YuanRong TransferEngine（`yr.datasystem`），还要有一个实现 seed 协议的 Planner 服务；仓库里只有 mock（`examples/rfork/rfork_planner.py`）。这两样是否在现场存在，**未核**。
3. **要有第二个实例才有收益**。我们的部署是**一个**跨两台机器的实例（DP2 在实例内部）。第一次冷启动必然借不到 seed → 走默认 loader，还白付一遍模型初始化 + 布局后处理的时间（`rfork-startup.md` 已经讲了这个代价）。RFork 只在**副本扩容或重启**时才划算。
4. **身份必须完全一致**。seed key 由兼容性指纹（模型版本、dtype、量化、并行大小）+ tp/pp/ep rank + main/draft 角色两次 SHA256 得到。我们这套 TP8 / DP2 / EP16 / W8A8 的实例只能向**布局一模一样**的另一个实例借；16 个 rank 各借各的 seed rank，不是整机借整机。
5. **W8A8 走 processed-layout 路径**。`RForkModelLoader._requires_processed_layout_transfer` 只要 `model_config.quantization is not None` 就返回 True，所以我们这套部署**一定**是「先在本地做完 `process_weights_after_loading` 和 `torch.npu.synchronize()`，再注册内存、再传输」这一条，不是传完再后处理。这正是 patch 0001 修的问题——社区 v0.23 / v0.26 上量化模型可能传到没转完的布局。
6. **MTP 有 draft 模型**。我们开了 `deepseek_mtp`，所以 main / draft 两套 session 并存，draft 注册时要减掉与 target 重叠的地址区间（patch 0003），否则撞 HCCL 拒绝重叠注册。官方 `## Tested Models` 里 DeepSeek-V4-Flash-W8A8-MTP 验过这条路，**GLM-5.3-Flash W8A8 没在表里**。
7. **两条绕过开关我们都没踩**。教程里既没有 `layer_sharding` 也没有 EPLB 配置，所以不触发 bypass。但要提醒：`_is_dynamic_eplb_enabled` 实际上 `parallel_config.enable_eplb`、`eplb_config.dynamic_eplb`、`eplb_config.expert_map_record_path` 三者任一为真就绕过——将来只要有人加 `--enable-eplb`，RFork 就**静默**退回默认 loader。
8. **版本对不上**。我们的执行侧钉在 `vllm-ascend@db701c1f`（官方镜像里的版本），它带的是**社区版 6 文件 RFork**；工作版 `rfork@3284850b` 是同事仓库的独立历史。**这 12 页讲的行为不能直接套到 db701c1f 上**——这一点现有 `rfork.md` 的「版本差异」已经说清，重构时必须保留。

---

## 4. 主线底稿要不要补

**要补，补两块，都在 `docs/mainline/01-deploy-entry-schedule.md` 的 A0。**

### 4.1 先补默认加载路径（这是现在的洞，不是 RFork 的问题）

01 号底稿 A0「怎么走的」第 6 步只讲了 `--quantization ascend` 和 GLM 的实现类，**没有一步讲权重是怎么被读进卡里的**：谁选的 loader、`load_format` 默认值是什么、safetensors 从哪读、`process_weights_after_loading` 什么时候跑。A0「待核 2」要的「权重实际字节 / `model_memory_usage`」也悬在这里。RFork 是这条路径的变体，没有底稿就没法讲变体。

要读的源码：

- `vllm@0fc695fc:vllm/config/load.py`（`LoadConfig.load_format` 的取值与默认）
- `vllm@0fc695fc:vllm/model_executor/model_loader/__init__.py`（`get_model` / `get_model_loader` 的选择逻辑、`register_model_loader` 注册表）
- `vllm@0fc695fc:vllm/model_executor/model_loader/default_loader.py`（默认 safetensors 路径）
- `vllm@0fc695fc:vllm/model_executor/model_loader/utils.py`（`process_weights_after_loading`、`initialize_model`、`set_default_torch_dtype`）
- `vllm-ascend@db701c1f:vllm_ascend/__init__.py#L54-L61`（`register_model_loader` → `register_netloader` + `register_rforkloader`）
- `vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_process_weights_after_loading.py`（昇腾版后处理注入哪两个 loader）
- `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py`（`AscendGlm5NextForCausalLM` 的 `load_weights`，权重名映射与 MoE 专家切分）

### 4.2 再补一节「A0 变体：RFork 热启动」

放在 A0 末尾，篇幅按一节（不是一整站），写清：

1. 它替换的是哪一步（权重字节来源），不替换哪几步（HCCL 建域、量显存、切 KV 块、捕获图）；
2. 在我们部署下的具体形态：16 个 rank 各自一条 seed key；W8A8 走 processed-layout 分支；MTP 的 draft 与 main 共享地址区间；一次要搬多少字节 = 每张卡的权重字节（与 A0 待核 2、02 号底稿 §7.5 的 20.58 GiB 整卡权重是同一个数，**不要另起一个玩具算例**）；按 1 GiB / 512 段分批；
3. 前提与不适用：YuanRong TransferEngine、Planner、第二个实例、EPLB/layer_sharding 绕过；
4. 版本边界：db701c1f 带的是社区 6 文件版，工作版是 `rfork@3284850b`。

要读的源码（全部在 `tools/repos/rfork`，用 `git -C tools/repos/rfork show 3284850b4:<path>` 读）：

- `vllm_ascend/model_loader/rfork/rfork_loader.py`（`RForkModelLoader.load_model` 主流程、EPLB bypass、回退清理）
- `vllm_ascend/model_loader/rfork/session.py`（`acquire_seed` / `transfer_from_seed` / `prepare_for_fallback` / `start_seed_service`）
- `vllm_ascend/model_loader/rfork/identity.py`（`build_compatibility_fingerprint`、`build_seed_key`）
- `vllm_ascend/model_loader/rfork/manifest.py`（`validate_weight_manifest`）
- `vllm_ascend/model_loader/rfork/transfer_backend.py`（`register_memory_region`、`read_weights_from_seed`、三个批量上限常量）
- `vllm_ascend/model_loader/rfork/config.py`（11 项配置与默认值）
- `vllm_ascend/model_loader/rfork/tensor_layout.py`（processed / checkpoint 两种布局的收集）
- 官方文档：`vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/rfork.md`
- Planner 参考实现：`rfork@3284850b:examples/rfork/rfork_planner.py`

**不建议**为 RFork 单开第四份底稿：它只占 A0 的一步，另起文件会和 01 号重复，踩 `cross-page-overlap`。

---

## 5. 每页的处置建议

判断标准按 `2026-09-27-mainline-rebuild.md` §5「页面标准 v2」：讲清挂在主线哪一步、在我们的部署下长什么样、带可复核的数字、源码位置、常见误解；专有名词用英文。

统计：**深入页重写 6、保留小修 4、合并 2、删除 0**。

| 路径 | 处置 | 理由 |
|---|---|---|
| `wiki/concepts/rfork.md` | 深入页重写 | 全章入口，必须先声明「挂在 A0、只替换权重来源、不改 A1–B5 任何数字」，再给我们部署下的前提与适用性（§3.2 七条）。删掉 `:84` 的 6 亿标量玩具算例，换成 A0 的每卡权重字节。**保留**「版本差异」逐补丁表和三条社区线的判定依据——这是全章最有价值、也已核过的部分。id 被 `tests/rfork-wiki.spec.ts` 多处钉住，不能改名 |
| `wiki/concepts/rfork-terms.md` | 合并到 `wiki/TERMS.md` + `rfork.md` | 09-27 已定 `TERMS.md` 是全库叫法的单一真相源，且已改成英文优先；这页在页内又维护一份词表，必然漂移（本页正文还在用「分片」「来源服务」这类中文代称）。把 seed / rank / layout / storage owner / Memory Region / manifest / lease 的条目并进 `TERMS.md`，在 `rfork.md` 留一小节「读这一章前先认的 7 个词」。**代价**：`tests/rfork-wiki.spec.ts:6` 的 12 条链接、`:11-13` 的「术语」跳转与「Memory Region」断言都要改 |
| `wiki/concepts/rfork-startup.md` | 深入页重写 | 机制主干，十步表和回退清理清单质量高，值得保留骨架。要补：A0 站号；`:89` 那组「假设的数字，不是实测」的 20/10/15 秒必须换成真实口径（用 A0 的权重字节 + 分批上限推，或标「待核：缺一次真实启动日志」）；说明 W8A8 下第 6 步一定发生 |
| `wiki/concepts/rfork-identity.md` | 深入页重写 | 这页最容易落到我们的部署上：把 seed key 的组成用 TP8 / DP2 / EP16 / W8A8 的真实取值填一遍（16 个 rank 各一条 key），比现在的抽象描述有用得多。也是解释「为什么整机借整机是错的」的唯一位置 |
| `wiki/concepts/rfork-layout.md` | 保留小修 | 机制讲得清楚、有图、篇幅合适。只需补：A0 站号；点明我们部署 `--quantization ascend` 必走 processed-layout 分支；把 patch 0001 修的「传到没转完的布局」与 v0.23/v0.26 的风险指回 `rfork.md` 的版本表（别复述，避免 `cross-page-overlap`） |
| `wiki/concepts/rfork-memory.md` | 合并到 `rfork-transfer.md` | 两页讲的是同一个文件 `transfer_backend.py` 的两半（注册地址 / 读字节），拆开后 `registered_weight_blocks`、`exclude_blocks` 在两页各讲一遍，正是 lint 的 `cross-page-overlap` 高危区；本页 156 行也是全章最短。合并后一页约 350 行，按「注册 → 验清单 → 读字节」一条线讲，MTP 的 main/draft 共享作为其中一节（我们部署开了 `deepseek_mtp`，这节要落到真实 MTP 层上）。**代价**：`tests/rfork-wiki.spec.ts:21-33` 的六图循环要去掉 `rfork-memory`，`wiki/diagrams/rfork-memory.*` 的内容并进 `rfork-architecture` 或新图。若评审认为 MTP 这一节值得独立成页，可改为「保留小修 + 两页互相引用」，但必须先把重复段落切干净 |
| `wiki/concepts/rfork-transfer.md` | 深入页重写（并吸收 `rfork-memory`） | 见上。重写时把「要搬多少字节」直接绑到 A0 的每卡权重字节，给出分批数的算式，替掉现在没有数字的描述 |
| `wiki/concepts/rfork-lifecycle.md` | 深入页重写 | 回答「权重传完 ≠ 能对外服务」，是这一章少数能讲出工程判断的页。要补 A0 站号与「不在请求路径上」的边界，并把 6 处免责句压到标准要求的比例以内 |
| `wiki/concepts/rfork-config.md` | 深入页重写（优先级最高） | 三个硬伤：① 全页把源码标识符译成中文代称（`:82-84` 的「模型身份串」= `model_url`、「部署策略名」= `model_deploy_strategy_name`，`:99` 的「端口基数」= `seed_port_base`，通篇「来源服务」= seed service），直接违反 09-27 的术语规则；② 0 张图，但它要讲四类端口，正是最该有图的一页；③ 标题承诺「可复制的启动示例」，而示例是占位符，没有落到我们的双机 GLM 命令上。重写时以教程里那条两机启动命令为底，加上 `--load-format rfork` 和 `--model-loader-extra-config`，并保留「键名写错不报错」这一段实测价值很高的内容 |
| `wiki/concepts/rfork-troubleshooting.md` | 保留小修 | 内容扎实、日志与源码对得上，是排错入口。小修：补 A0 站号；删/改 7 处免责句（全章最多）；补一张「日志行 → 阶段」的图，现在 240 行纯文字表格 |
| `wiki/concepts/rfork-maintenance.md` | 保留小修，并从 RFork 教学段挪到「来源与更新记录」 | 讲的是补丁归档、pin、快照重放的仓库维护流程，不是推理知识，挂在教学章里与主线无关。而且它和 `rfork/README.md`、`rfork/VERSION-NOTE.md` 大面积重叠——按单一真相源，页面应当只留「现在钉的是哪个 commit、怎么核」，流程细节引用那两份文件。**注意**：挪出 RFork part 需要改 id 前缀或改 `toc.ts#L187-L191` 的兜底规则，两者都会动测试 |
| `wiki/sources/rfork-official-guide.md` | 保留小修 | `type: source`，职责是「官方指南 vs 工作版」的不可变对照，该留。小修：按 `db701c1f` 的官方文档复核一次（本轮已读其 `## Tested Models` 与 `## Note & Caveats`，与页面说法一致）；补一句「官方 Tested Models 里没有 GLM-5.3-Flash W8A8」，这是我们部署最该知道的一条 |

### 5.1 处置后的连带改动

- 12 → 10 页：`tests/rfork-wiki.spec.ts:6` 的链接数、`:11-13` 的「术语」跳转、`:21-33` 的六图循环都要跟着改。
- `rfork-maintenance` 挪出 RFork part 后，`src/content/wiki/toc.ts#L187-L191` 的兜底规则要么加例外、要么给它改 id。
- `wiki/TERMS.md` 要吸收 `rfork-terms` 的词条（英文优先、中文进别名）。
- `scripts/wiki-rfork-evidence.ts` 只重建 `wiki/concepts/rfork*.md` 的 raw 材料；重写正文后要重跑，`wiki/sources/rfork-official-guide.md` 仍须手工同步（`rfork/README.md` 已写明不自动覆盖它）。
- 全部 12 页现在 `chapters: []`。若重构后要把 RFork 挂进某一章，注意 `chapters` 只能填 `00`–`21`。

---

## 6. 质量现状

抽读三页正文：`rfork.md`、`rfork-startup.md`、`rfork-config.md`。

**结论：有 Codex 改版的退化，但形态和其他章不同——不是篇幅缩水，是「去具体化」。** 12 页全部由 `e0019e4`（09-25「Rewrite chapter 20 and the RFork chapter」）落地，其中 7 页还有 09-26 的未提交改动；行数没掉（最短 155 行、最长 306 行），但**具体的例子被换成了抽象描述 + 免责句**。

### 6.1 带行号的例子

1. **真实例子被换成玩具假设 + 免责句**——`wiki/concepts/rfork.md:84`。09-25 版原文是「拿一个小模型算一遍：一个 6 亿参数的模型（Qwen3-0.6B）……整份权重约 1.12 GiB……按 1 GiB 一批，大约分成 2 批」；09-26 未提交版改成「用 6 亿个 BF16 标量作**容量教学假设**……**不能从参数量单独算出**。这个小算例**不代表** GLM 或某个真实 checkpoint 的传输清单」。同一处退化在 `:169` 的「对照源码」里又出现一次。模型名没了，结论也被自己否掉了。
2. **开场从场景改成流程描述**——`wiki/concepts/rfork.md:56-58`。原文「扩容时要再起一个实例 B。常规做法是 B 从磁盘把整份权重读进来、搬上 NPU，模型越大等得越久」被改成「模型启动通常要读取 checkpoint、构建模型并准备设备上的权重；随后才能分配推理状态、预热并接收请求」。读者看不到「为什么要有 RFork」了。
3. **明文切断和主线部署的联系**——`wiki/concepts/rfork-terms.md:78`（09-26 未提交新增）：「……**不将 GLM 双机命令当作该工作版已经验证的部署**」。事实判断没错，但写法是拿免责句代替回答：正确做法是讲清前提（YuanRong + Planner + 第二个实例）后给出「在我们部署下会怎样」，而不是声明不谈。
4. **编造的数字**——`wiki/concepts/rfork-startup.md:89`：「打个比方（**假设的数字，不是实测**）：初始化 20 秒、布局处理 10 秒、登记加读取 15 秒」。标准明文禁止用玩具规模代替真实参数。
5. **通篇不用源码里的英文名**——`wiki/concepts/rfork-config.md:82-84`、`:92-102`、`:128-135`：`model_url` → 「模型身份串」、`model_deploy_strategy_name` → 「部署策略名」、`seed_port_base` → 「端口基数」、seed service → 「来源服务」、TransferEngine → 「传输引擎」。同一批里 `rfork.md`、`rfork-startup.md` 却保留了 seed / Planner / manifest / rank 的英文原名——**同一章内前后不一致**，读者对不上源码。
6. **免责句密度**——按 `不代表|不等于|不能证明|不保证|尚未|还没有在真实|不是实测|假设的数字|不说明` 统计正文命中数：`rfork-troubleshooting` 7、`rfork-lifecycle` 6、`rfork-official-guide` 6、`rfork-config` 5、`rfork-terms` 5、`rfork` 4，其余 2–3。典型如 `wiki/concepts/rfork-config.md:73`「各项含义来自读源码，**还没有在真实 NPU 上跑通过一次完整加载**」、`:170`「只测一条小请求正常，不能说明所有模型、量化方式和共享路径都支持」。
7. **没有一页落到我们的部署上**——12 页里 `GLM|Atlas|A2|TP8|DP2|EP16|W8A8|双机` 的命中几乎全是「GLM5-W4A8 在官方测试表里」「W8A8 词条见术语页」这类，**没有一处**写我们这套 2×A2 / TP8 / DP2 / EP16 / W8A8 / MTP 的部署下 RFork 是什么样。这是 12 页共同的最大缺口，也是重写的主要工作量。

### 6.2 这一章比别处好的地方（重写时要保住）

- `rfork.md:177-192` 的逐补丁社区合入表 + 判定依据（`merge-base --is-ancestor`、按 PR 号 `--grep`、hunk 逐行 diff），是全库少见的、方法写清楚的版本核对，本轮复核未发现与源码冲突。
- `rfork.md:115-124` 的「四种成功」、`rfork-startup.md:70-81` 的十步表、`rfork-config.md:113-124` 的「键名写错不报错」，都是从源码里读出来的真结论，不是套话。
- 12 页全部已是「讲解 + `## 对照源码`」两层结构（`2026-09-27-page-inventory.md:319` 也这么记），结构上不用返工。

---

## 7. 本轮被跳过 / 未核的

1. 未读 `wiki/HANDBOOK.md`（任务约束）。
2. 未起服务跑 `pnpm test:e2e`，所以 `tests/rfork-wiki.spec.ts:8`「章号是五」只是读 `WikiPage.tsx:131` 推断为红，**未实测**。
3. 未跑 `pnpm check` / `wiki:lint`（本轮只读不改，且仓库有 423 处未提交改动，跑了也分不清是谁的问题）。
4. 只抽读了 3 页正文（`rfork.md`、`rfork-startup.md`、`rfork-config.md`）；另外 9 页只看了 frontmatter、各级标题和脚本统计。
5. 一次读取 `rfork_loader.py` 正文时被安全分类器拦下，之后改用「类/函数清单 + 关键常量 + 官方文档」取证，`RForkModelLoader.load_model` 的主流程结论据此得出；EPLB bypass、processed-layout 判定、回退清理这三处与官方文档 `## Note & Caveats` 和页面现有描述三方一致。
6. 现场事实未核：YuanRong TransferEngine 是否已装、是否有生产 Planner、我们是否真的会起第二个实例、每卡权重实际字节（与 01 号底稿 A0「待核 2」是同一件事）。
