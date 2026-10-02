# use-layerwise-b475778cd352 审查记录

## P5 写作记录（Opus 5.5，10-02，第 30 批小修）

本记录是写手自查与交接，不替代独立审查。按派发说明执行：小修、保留参数页 4 段式结构（一句话 / 事实表 / 为什么存在 / 开了的代价）、本页原本没有图，未新加图（直觉图沿用 [Layerwise KV offload](../../../../wiki/concepts/kv-cache-layerwise-offload.md) 那一页的）、不起服务、不截图、不开子代理。

### 旧版信息清单与勾选

`git diff --stat p4-checkpoint -- wiki/params/use-layerwise-b475778cd352.md` 无输出，旧版即改前现版。清单 10 条存于旧会话 scratchpad `p5/use-layerwise-b475778cd352-facts.md`，逐条核对：

1. 不在 `additional_config`、入口是 `kv_connector_extra_config`（含命令示例）—— 保留，标题改成「配置路径」，挪到定义句之后。
2. 它是 Layerwise KV offload 的总开关 —— 保留，改写成与 kv-cache-layerwise-offload 页一句话同口径（整趟搬一次 → 每层搬一次；算第 L 层时 L+1 层搬入、L−1 层存出），并移到第一段。
3. 同名四处及各自默认值 —— 保留，未动。
4. 存在范围 —— 保留，补一句 GLM 快照 db701c1f 读法相同（新来源 C22）。
5. 旧算例（Qwen3-0.6B 单卡）—— 保留原语境，改写为「本页早先的旧算例，不是 GLM 双机」，避免被读成双机实测。
6. 事实表 10 行 —— 保留 9 行原样；「对图模式的影响」一行改正（见下）；「官方文档口径」行末重复的 `[!]` 删去，同一结论在「开了的代价」里仍带 `[!]`。
7. 为什么存在（三类分叉、main 协议注册表）—— 保留；段末重复的 `[C4]` 删去，同段前文仍有。
8. main 的 mooncake 拓扑校验与报错原文 —— 保留，未动。
9. 代价五条 —— 保留四条原样（两处重复角标 `[C6]`、`[C2]` 删去，事实表与第 1 处仍有）；「图模式」一条改正并扩写。
10. 版本谱系、参数定义两节自动生成 —— 未动。

### 这次改了什么

1. **「一句话」开头先讲是什么**：先给与 offload 页一致的一句话 + 链接，再讲配置路径，不重讲机制。
2. **新增「放到 GLM 双机：没开」段（挂靠 B3）**：官方双机命令无 `--kv-transfer-config`，四处同名键都不会被读到；01 §B3 那条被抢占的请求（约 67,000 位置）回来是整段 prefill 重算，不是按层取回；开了以后一层要搬多少、快照上卡在哪两处，链接到 offload 页 GLM 一节，不重算；明写分层传输在这套部署上无实测数，GLM 主线时延都是关着时的数。
3. **改正一处事实错误（P2）**：改前事实表与「开了的代价」都写「图模式影响只在 main」。实核 `requires_piecewise_for_cudagraph` 在 2c59ff10 #L78-L83、db701c1f #L78-L83、2ed6cbba #L87-L92、baa023ad #L97-L102 都存在且返回本键；消费方是 vLLM v0.23.0 `vllm/config/vllm.py#L1244-L1269`：接了 KV 连接器、图模式含整图时把 cudagraph_mode 改为 PIECEWISE，只打 warning（原文逐字附在页面，出处第 1258–1269 行）。
4. **GLM 双机下开了会怎样（按源码，未实跑）**：部署是 `FULL_DECODE_ONLY`（01 §A0.6），开了会被 vLLM 改成 PIECEWISE；随后 db701c1f `vllm_ascend/platform.py#L596-L623` 的 PIECEWISE 分支把 `mla_forward` / `dsa_forward` 切出图外、关掉 npugraph_ex。平台钩子 `check_and_update_config` 在 vLLM 配置第 1335 行调用，晚于第 1244–1269 行的改写，所以平台看到的已是 PIECEWISE。写成「待核：缺 PIECEWISE 下的实跑记录」，不写成定论。
5. summary 末尾补「GLM 双机没开；开了会把图模式改成 PIECEWISE」；`updated` 改为 2026-10-02。
6. 来源追加 3 条（C22 db701c1f 连接器、C23 vLLM 配置改写、C24 db701c1f 平台 PIECEWISE 分支），原 21 条未动。

### 数字出处

- 约 67,000 位置、整段重算、前缀缓存关着：`docs/mainline/01-deploy-entry-schedule.md` §B3（第 1023–1035 行）。
- 12 层 MLA 存 KV、34 层 KDA 存固定状态：`docs/mainline/02-forward.md` §1.4 表。
- `FULL_DECODE_ONLY`：01 §A0.6；纯 decode 步才走图：01 §B2 第 957 行。
- 没有 `kv_transfer_config`：01 §B1 第 848 行。
- 本页未新增 calc、未改图。

### 核实方式（核参数与归档链接）

- 第 1 处默认值：四个提交（2c59ff10、db701c1f、2ed6cbba、baa023ad）的 `ascend_store_connector.py` 均为 `.get("use_layerwise", False)`（grep -n 定行）。
- 自动生成区：baa023ad `yuanrong_backend.py` 第 20 行 `use_layerwise: bool = False`，与生成区一致；两份 rawSources 归档文件存在，内容是该文件 L1-L180 的扫描快照。
- 页内链接与跨页锚点由 `pnpm wiki:lint` 校验通过（offload 页 GLM 节、concurrent-requests 抢占节、acl-graph GLM 节、部署前提）。

### 验证

- `pnpm wiki:lint`：通过，本页 0 报错、0 待留意（中途一度因先引 C22 后补来源报 mark-index、内联标记 31 处报 mark-flood，已补来源并删 4 处重复角标）。
- `pnpm wiki:diagrams --check`：通过，290 张图一致，本页无图。
- `pnpm wiki:audit`：通过；本页「正文 8918 字 / 6 节 / 来源 24 条」，全库无效 commit 0、文件不存在 0、行号越界 0。
- 正文字数（audit 口径）：7,528 → 8,918。

### 自查疑点

- 无 P1。改前的「图模式只在 main」属 P2 事实错误，已改正。
- 待核（已写进页面）：GLM 在 PIECEWISE 模式下能否起来、decode 慢多少。

## P5 审查（10-02）

审查员：Opus 5.5（独立审查，只审不改）。口径：参数页小修，保持 4 段式，只核任务文件写明的问题。

**分数：9 / 10。audit 本页通过。P1 0 条，P2 0 条，P3 3 条。**

### 旧版信息清单

- 清单存在：旧会话 scratchpad `p5/use-layerwise-b475778cd352-facts.md`（10 条）。
- 抽查 6 条到新版，全部在：①不在 `additional_config`、入口 `kv_connector_extra_config`（第 88 行）；③四处同名与默认值（第 95–100 行）；⑤旧算例不构造连接器（第 104 行）；⑥事实表仍是 10 行，`"false"` 字符串为真那一行在（第 112–121 行）；⑧main 的 `validate_layerwise_topology` → `validate_topology` 与报错原文（第 133 行）；⑨代价五条（第 137–151 行）。
- `git diff` 删掉的行：只有四处角标去重（同一结论在别处仍带角标）、「图模式只在 main」的错误写法、改写前的定义句和旧算例句，信息都在新版里。

### 重点核对 1：图模式 PIECEWISE「三个版本都有」——属实

- vllm-ascend 四个提交逐个 `git grep`：`requires_piecewise_for_cudagraph` 在 2c59ff10 / db701c1f 的 `ascend_store_connector.py` 第 78 行、2ed6cbba 第 87 行、baa023ad 第 97 行；方法体均为 `return extra_config.get("use_layerwise", False)`（分别在第 83 / 83 / 92 / 102 行）。与写作记录一致，改前「只在 main」确是事实错误，改正正确。
- vLLM v0.23.0（0fc695fc）`vllm/config/vllm.py` 第 1244–1270 行：条件是接了 KV 传输实例且 `cudagraph_mode.has_full_cudagraphs()`；warning 由三段字符串拼接，页面第 141 行引文与源码逐字一致。v0.26 对应的 vLLM（releases-v0.26.0）同一逻辑在第 1377 行，「三个版本都会」在 vLLM 侧也成立。
- `FULL_DECODE_ONLY` 的最大模式是 FULL（`compilation.py` 第 83–84 行 `has_full_cudagraphs`），所以 GLM 部署确会命中改写条件。
- 平台侧：db701c1f `platform.py` 第 596 行 `requires_piecewise_compilation()` 分支，第 614–619 行把 `vllm::mla_forward`、`vllm::dsa_forward` 加进切分算子，第 623 行关 npugraph_ex；vLLM 第 1335 行才调 `check_and_update_config`，晚于第 1270 行的改写。页面第 145 行描述正确，并标了「待核：缺 PIECEWISE 实跑记录」，没写成定论。

### 重点核对 2：GLM 双机「没开」段——口径一致，未重讲

- 第 106 行：没有 `--kv-transfer-config`（01 §B1 第 848 行）；被抢占那条约 67,000 位置、回来整段重算（01 §B3 第 1023–1035 行）；12 层 MLA / 34 层 KDA 与 kv-cache-layerwise-offload 页第 196–197 行一致。
- 每层搬多少、两处卡点没有在本页重算，一句话 + 链接到 offload 页 GLM 一节（锚点存在，第 190 行）。明写「无实测数，GLM 主线时延是关着时的数字」，没有把主线数字当成本开关效果。
- 「图模式退到分段」与 offload 页第 264 行口径一致（那一页也没有限定版本）。
- 一句话定义（第 86 行）与 offload 页第 52 行同口径。

### 链接与渲染

- 三个跨页锚点均存在：acl-graph 第 119 行、concurrent-requests 第 227 行、glm-5-3-flash-two-node 第 49 行「部署前提」。入链仅 index.md / identities.json / 旧巡检记录，不受影响。
- 预览 5193 截图（1440 宽）：`scratchpad/use-layerwise-b475778cd352-review-1.png`（第一屏）、`-2.png`（图模式一段与 warning 引文），排版、角标、链接正常。

### P3（不阻塞）

1. **第 104 行「本页早先的旧算例」**：读者在页面上看不到这个「早先的算例」，这是页面沿革式的说法。改法：去掉「本页早先的」，直接写「单卡小模型（Qwen3-0.6B，不是 GLM 双机）那类启动命令里没有 `--kv-transfer-config`……」。
2. **第 143 行出处行号**：写「第 1258–1269 行」，真正把模式改成 PIECEWISE 的赋值在第 1270 行，条件判断起于第 1244 行。改法：写成第 1244–1270 行，C23 的行号范围同步放宽到 L1270。
3. **第 143 行括号出处与 [C23] 重复**：同一出处既有角标又有正文括号说明；可只保留角标，或保留括号、去掉第 139 行的角标，二选一。

### 跳过

- frontmatter 来源区未读（由 audit 校验：本页 24 条，全库无效 commit / 行号越界 0）；「版本谱系」「参数定义（自动生成）」两节未改动、未读正文。
