# vllm-platform-interface 审查记录

## P5 写作记录（2026-09-28，第 02 批）

### 改写目的与范围

将原来的接口列表重排为“定义与直觉 → 动机和代价 → A0 平台交接 → 主机／设备分账 → 误解 → 对照源码”。首屏就地解释设备、内存、token、矩阵与平台契约；补充主机内存、设备显存、token 调度预算的区别。保留旧页的属性／准备／校验／选择职责、配置后续改写、默认预算回退、模型专用后端和版本组合证据边界。

只修改本页、它引用的 platform-hooks 图、新增的 platform-startup-contract 图及本记录；不修改共享来源页、目录、src、scripts、tests、计划，不提交 git。工作区同时存在其他页面的并行改动，验证结果须按当次日志判断。

### 数字与原始依据

- 双机落点与启动顺序：`docs/mainline/01-deploy-entry-schedule.md` §A0“怎么走的”；读者链接到 D 的“启动时发生了什么”和 K 的调用链。无独立双机推导、无新增容量算例。
- 两台 A2、每台 8 卡只引用部署结论；卡分组和显存账仍归 D。
- 2048／8192 token 是新增解释的上游查询失败后在线／离线默认基础档，直接核对 `vllm@0fc695fc:vllm/engine/arg_utils.py#L2300-L2335`，后续调整见 L2492–L2553；它们不来自 A0，也不是固定双机显式参数或最终默认值。
- 核心契约：上游 `Platform` 的设备属性、后端路径返回、配置钩子的原地修改，及 `platforms/__init__.py` 的当前进程惰性平台解析；配置调用与 Worker 加载后调整分别核对 `config/vllm.py`、`multiproc_executor.py`。
- 固定 Ascend：`db701c1f:platform.py` 的准备注册、主动拒绝早期设备内存查询、Worker 选择及配置拒绝分支；`worker/worker.py` 的显存测量与图捕获前激活峰值；`indexer_kpool_mla.py`、`kimi_kda.py` 的模型专用后端绑定。
- 三版：Ascend `2c59ff10 / 2ed6cbba / baa023ad`，上游 `0fc695fc / 568afb3a / 84030bbe`。main 的查询守卫与按硬件能力档案选 Worker 均逐段读取，未套到固定镜像。
- 联网读取官方 v0.23 Plugin System 和钉住 `0576b647` 的 GLM 教程；源码来自本机固定 Git 对象。audit 的 URL 检查本身不验证网络或结论语义。

### 独立审查与修订

独立审查者 `/root/platform_review` 对实际新旧正文、图 spec、固定提交及三版源码进行审查，未发现 P1 机制问题。

1. P2：启动图初稿的 tone、badge 和 link 字段不符合项目 schema，导致无法生成。修为 `danger`、`badges.n`，分支文字移到 texts；已生成 SVG，两图 `figureProblems=[]`，独立复核关闭。
2. P3：旧页到 NPUPlatform 的内链遗漏。已在首次命名处恢复，独立复核关闭。
3. P3：首段把 token 等同编号、未说明内存用途。改为基本单位用编号表示，补主机 CPU 与设备归属，独立复核关闭。

初学者文字复述通过：上游通过统一契约询问设备能力、校验配置和选择组件；模型计算交给后续组件，代价在兼容与初始化时序；查询失败的基础预算不是显存容量。

### 字数与密度

字数口径为去掉 frontmatter 后的 Markdown 字符数（含空白、标点、链接和源码区）：改前 1674，改后 6226。纯汉字计数分别为 926、3470。教学正文为“对照源码”以前，改后 3614 字符／2324 汉字；原页无源码区。

项目写作统计口径：教学正文 2339 字，行内代码 0／千字，正文证据角标 0，calc 0，无相邻表／calc；首图在第一个 H2 中，图前数字与 calc 均为 0。两图宽均 880px；源码区 H3 顺序正确；免责句匹配率 1.4%。页末角标 7 处，其中 C 级 5 处（71.4%），两个官方来源均实际用于相应结论。

### 验证记录

- 已运行 `pnpm.cmd wiki:audit`：131 页、本地来源行号全部有效，整体通过；本页 28 条源码来源与两条官方 URL 均可解析。raw 摘录并未因本次写作补齐，不能把 audit 通过当成摘录已核。
- 已运行 `pnpm.cmd wiki:diagrams --check`：163 张图与 spec 一致，通过。两张本页图还单独检查了边界与碰撞。
- 已运行 `pnpm.cmd check:content`：registry 131 页内容校验通过。
- 已运行 `pnpm.cmd wiki:lint`：本页无错误；当次全库剩 hardware-devices 的官方华为来源域名白名单问题，未修改他页或白名单。
- 在 `tmp/p5-platform/isolated-build` 对页面副本调用项目原有 `runBuild`：131 页、0 解析问题，目录与 registry 派生成功。共享派生物按分工不写回。
- 生产构建：`pnpm.cmd exec vite build --outDir tmp/p5-platform/dist` 成功，耗时 56.71 秒；产物只在临时目录。
- `pnpm.cmd check` 已通过 typecheck 和代码 lint，进入全量测试后出现两项失败，长时间无新输出后终止。另以 `pnpm.cmd exec vitest run src/content/wiki/index.test.ts scripts/wiki/params/scan.test.ts --maxWorkers 1` 定位：24 项中 22 通过、2 失败。`index.test.ts:20` 仍要求 Block Table 英文旧标题，而当前 block-table 标题已改；`scan.test.ts:95` 的 Python AST 示例在当前解释器下报 invalid syntax，要求 Python 3.11+。两项均不消费本次修改的页面或图，不修改范围外测试来制造通过。
- 单独运行 `pnpm.cmd check:deps` 通过；`check:content` 再次通过。全量测试没有最终通过结论。
- 浏览器使用成功生产构建的真实页面，Chromium 1440×1100，4176 端口。保存 screen-01 至 screen-06、figure-1、figure-2、sources 共 9 张截图；实际点击“部署启动”“NPUPlatform”“调用链页”，并展开 30 条来源。浏览器 pageerror 为 0，两图渲染数量为 2。预览验收阻断 API 请求，未访问 5193 或 8790；截图后关闭服务，确认 4176 无监听。
- 截图绝对目录：`C:/Users/-/AppData/Local/Temp/claude/C--Users---Desktop-infra-view-new/13898c74-f916-4e2c-8924-fe9bf130f160/scratchpad/p5/vllm-platform-interface/`。
- 独立审查者追加实际查看全部 6 屏、两张整图和来源展开截图：首屏定义与直觉图完整，前两屏能解释用途和代价，流程顺序与失败分支清楚，表格和来源可读；无新增 P1/P2/P3，前述三项全部关闭。
- 验收过程说明：开发服务的依赖预打包阻塞了页面读取，改用生产构建预览完成验收，未改应用代码。一次 PowerShell 重启命令被自动审批以“blocked by policy”拦截，随后通过已建立会话的 Ctrl+C 停止自建服务；最终预览在受控进程的 finally 中关闭。
- 检查日志和浏览器操作结果保存在 `tmp/p5-platform/`；`git diff --check` 对交付范围通过。

### 限制与待核

无 NPU 部署实测、无平台钩子耗时或主机／设备峰值实测；固定镜像内上游安装产物的对应关系仍待来源基线补证。没有发现本页独立算账错误；队列“无独立双机数”与新增上游默认基础档说明并不冲突。无须用户决定的问题。
