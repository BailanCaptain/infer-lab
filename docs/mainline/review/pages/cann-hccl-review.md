# cann-hccl 审查记录

## P5 写作记录（2026-09-28，第 03 批）

### 改写范围与理由

- 重写 `wiki/concepts/cann-hccl.md`，保持 id、标题与原检索别名。先解释通信库、接口、链路的职责，再讲等待与缓冲成本、精度与基础计算，之后落到 A0 建组和 A4 使用。
- 重绘 `cann-hccl.yaml` / SVG：两侧框架请求经 HCCL、设备和物理链路交换数据，再将就绪结果交回计算。新建 `cann-hccl-flow.yaml` / SVG：A0 初始化后接 A4 普通通信 / MC2 分支，普通 All-to-All 画出切片与交换，并解释接收后拼接。两图画布宽均为 860。
- 将原合并页 AI QoS 的事实融入机制与源码区：VL / SP、Unified Bus 与 Unified Buffer 区别、五类流量与等级、AIV 驱动限制、默认 SDMA 源标签及目标 VL、端点和交换机的分别配置 / 恢复、A3 产品与最低软件条件全部保留。补齐三版五键到三键的变化。
- 旧两卡数值小例的 All-Gather / All-Reduce 语义保留，重复算例改链通信基础；通信库的单机、多机、集合及点对点能力保留。没有重算部署页或请求主线的账。
- 仅改本页、所引两组图和本记录；未改其他页面、共享索引、src、scripts、tests 或计划，未提交。

### 数字与原始依据

- 数字口径：`01-deploy-entry-schedule.md` §A0.2 的 TP8 / DP2 / EP16 与 CPU gloo 组；`02-forward.md` §1.2 的 218 个主干通信调用边界、BF16 的 [T,4096] TP 载荷、MoE 两条路径。R1 的 32 KiB 只引用 `one-request` 通信账；16 卡分组只引用部署页。
- CANN / HCCL 职责、集合与点对点、链路及 SUM / PROD / MAX / MIN：实际联网阅读页内两条 CANN 9.1.0 官方文档。
- 初始化与通信：定点读取 `vllm-ascend@db701c1f` 的 Worker 975–988、NPUCommunicator 40–68，及 `vllm@0fc695fc` 的 DeviceCommunicatorBase 180–207、parallel_state 1749–1875、parallel.py 683–707。
- QoS：定点读取固定快照的官方指南和 ai_qos.py 270–474；对比三版 `2c59ff10` / `2ed6cbba` / `baa023ad` 的 Worker、脚本及官方指南。前两版脚本与固定快照一致；main 为 AIV / SDMA / PCIEDMA 三键，等级、VL 与文档调用入口已单列。
- 未发现本页消费数字的新算错或队列矛盾。固定镜像完整软件配套、真实链路算法、带宽与 QoS 收益仍需实机证据，保留在页末待核。

### 独立审查与修订

独立审查者 `/root/review_cann_hccl` 实读修改前备份、实际页面、图 spec 和定点源码，提出：

| 级别 | 问题与影响 | 修订与复审 |
|---|---|---|
| P1 | token 曾写成位置编号，混淆词表编号与 position ID | 改为分词得到的基本单位、进入模型用词表编号表示；复读关闭 |
| P2 | 重排时漏写点对点与单机 / 多机能力 | 在首图后补回；复读关闭 |
| P2 | 版本表指向并不存在的完整五键 VL 表 | 填全五键目标 VL / 优先级；复读关闭 |

独立审查结论：文字、spec 和源码无未关闭 P1/P2。实际截图送审后，前两屏、两张完整图、版本表及末段视觉复核通过，无 P1/P2。主写手另逐屏核读了全部八屏。

### 统计与验证证据

字数采用项目 `measureStandard` 口径：汉字数＋拉丁单词数，去掉 frontmatter、围栏内容与 Markdown 链接 URL。含源码区的全文 **1298 → 4102 字**；新版教学正文 **2348 字**，源码区之前行内代码 0、证据角标 0、calc 0。数字推导归属其他页，因此未为本页凑 calc。首图之前无部署数字或 calc，仅有两卡通用说明。正文免责词命中 1 / 71 句（1.4%）。单页八项写作标准全部通过，来源角标共 22 处，其中 C 15 处（68.2%）。

| 实际验证 | 结果 |
|---|---|
| `pnpm.cmd check:content` | 通过，registry 131 页 |
| `pnpm.cmd wiki:diagrams --check` | 最终通过，163 图与 spec 一致；本页两图独立布局检查无错误 |
| `pnpm.cmd wiki:audit` | 最终通过；1523 条本地行号有效，0 无效提交 / 缺文件 / 越界；URL 与 raw 全库内容不属于该命令验证范围 |
| `pnpm.cmd wiki:lint` | 最新一次失败 1 处：`hardware-devices.md` 的两条 e.huawei.com 来源域名不在白名单。本页无 lint 错误；按范围未改该页 |
| `wiki:build` 对应脚本 | 将当前 concepts / params / sources 复制到 `tmp/p5-cann-hccl/build-check`，在该副本执行 `node --import tsx ../../../scripts/wiki-build.ts`，131 页生成通过；避免写回协调者管理的共享 registry / index |
| `pnpm.cmd build` | 前两次受其他页瞬时图 spec 问题、workflow 锁竞争阻塞；最后一次通过，2137 模块，构建 27.85 秒 |
| `pnpm.cmd check` | 类型检查和代码 lint 阶段通过；全套测试出现参数扫描用例失败及快照构建阻塞，后中止，不宣称全套通过。未修改测试或清理其他进程的锁 |
| 相关测试 | 读取本机配置设置 WIKI_PYTHON 后，运行 `pnpm.cmd exec vitest run scripts/wiki/standard.test.ts scripts/wiki/diagrams.test.ts`，2 文件 / 37 测试全部通过 |
| 差异检查 | 本页与图 `git diff --check` 无空白错误 |

当前没有可连接的 CUA 浏览器；使用项目已有 Playwright / Chromium 测试依赖打开真实生产页面。开发服务无响应后关闭，以生产预览在 **4175** 验收，视口 **1440×1000**，共八屏和两张完整图。浏览器验证标题、两图、A0 启动锚点跳转且进入视口、通信基础跳转与返回；页面与两图均无横向溢出，pageerror 为空。预览已关闭，netstat 确认 4175 无 LISTENING；未启动或停止 5193 / 8790 服务。

截图及浏览器结果：

`C:/Users/-/AppData/Local/Temp/claude/C--Users---Desktop-infra-view-new/13898c74-f916-4e2c-8924-fe9bf130f160/scratchpad/p5/cann-hccl/`

目录内为 `screen-01.png` 至 `screen-08.png`、`figure-1.png`、`figure-2.png`、`browser-results.json`。检查日志和改前备份在 `tmp/p5-cann-hccl/`。

### 取舍与未决

保留完整机制与合并事实，省去其他页已有的重复数字推导；只核本页相关版本行为，未将整套镜像标为三版 verified。无 NPU 实测。需要用户决定的问题：无；全库 lint 外部阻塞及完整镜像 / 性能待核已如上记录。
