# short-request-first 审查记录

## P5 写作记录（2026-09-29，第 12 批，Opus 写手）

### 改了什么

- 深改 `wiki/concepts/short-request-first.md`，按「是什么 → 为什么 / 代价 → 怎么排 → 细节 → GLM 双机 → 常见误解 → 对照源码」重排。正文（去掉 frontmatter、不计空白）1567 → 11090 字，其中对照源码之上的讲解部分 6814 字。
- H2：短请求排在长请求后面，只能干等吗（第 49 行）/ 为什么需要它（第 68 行）/ 怎么排：三条车道（第 94 行）/ 细节（第 124 行）/ 放到 GLM 双机：钉住的代码里没有它（第 138 行）/ 常见误解（第 170 行）/ 对照源码（第 180 行，五个 H3 按固定顺序）。旧 H2 无外部锚点入链（全库 grep `short-request-first.md#` 为空），改标题安全。
- frontmatter：summary、updated 改写；sources 从 6 条扩到 25 条（v0.26 队列、配置、平台校验、同步安装点，上游 568afb3a 等待循环、挂起队列、抢占、对齐切分，0fc695fc 策略枚举，2c59ff10 与 db701c1f 平台层，main 平台层、配置类、profiling chunk 安装点，v0.26 与 main 官方文档）；relations 增加 concurrent-requests、balance-scheduling、batch-job-aware-scheduler。
- 全页用同一个示意例子贯穿（预算 16，A、B 各 8，C、D 各 2，门槛 2）；三个 calc：四条请求首 token 步数合计（第 76 行）、长车道队头老化判定（第 104 行）、GLM 变体步数账（第 148 行）。
- 标记 30 处（C 22、S 5、D 2、! 1），全部在对照源码内；讲解部分行内代码 2 处。

### 图

- 直觉图 `wiki/diagrams/short-request-first.yaml`（重画，900×432）：顶上是按到达先后的等待队列 A A…B B…C C D D（一格一个 token）；左栏先到先服务照原顺序取，右栏短请求优先先分成短车道 [C C D D] 和长车道 [A×8 B×8]；两栏下面是同样的「每步 16 格」预算窗口，各画第 1、2 步：左边 A8+B8 / A1 B1 C2 D2，右边 C2 D2 A8 B4 / C1 D1 A1 B4。深色 = 短提示词，浅色 = 长提示词，灰格 = 已在逐个生成（一步 1 格），空格 = 没用上的预算。这就是队列里写的「不同长度请求按策略排序后进入同一预算窗口」。
- 流程图 `wiki/diagrams/short-request-first-flow.yaml`（新增，900×820）：第 2 站调度 → 挂起队列有没有 → 虚框「短请求优先换掉的只有这一块」里的三道判断（恢复车道 / 等够上限的长车道队头且短车道有人 / 短车道，否则长车道）→ 看一眼队头并记住车道 → 上游截预算、借 KV 块 → 借不到停止接纳 / 借到了从记住的车道取走并回到循环；左侧虚线标出被抢占的请求重新分车道。pins 5 条（上游 L665-L680、L1976-L1978，SRF L171-L183、L237-L244、L329-L335），都落在页面 sources 的范围内。
- 没有用 exchanges 分镜动图（按 09-29 临时规定）。

### 数字出处

- 通用示意数（16、8、2、2000 ms 等）为编的示意数，页面已标「示意」。
- GLM 双机数字取自 `docs/mainline/01-deploy-entry-schedule.md` §B2：每 DP 组每步 8192、running 上限 32、每条 decode 4 个位置（1 + 3 个 MTP 草稿）、12 条 decode + 20,000 token 提示词分三步（8,144 / 8,144 / 3,712）。场景 M 设定与 20,000 token 逐步账只链接 [concurrent-requests](../../../wiki/concepts/concurrent-requests.md) 的「示例场景 M 与变体 M′」「提示词超过剩余预算时，分几步算」，本页没有重算它的表；只新增一条 4 token 短请求，推它在两种取法下第几步拿到第一个 token（先到先服务第 3 步，短请求优先第 1 步；长提示词都是第 3 步算完），明确标为按调度规则推演、非实测、数的是步数不是毫秒。
- R1 = 4 token 链接 one-request；「本部署没开 prefix caching、抢占要重算」链接 vllm-scheduler。
- 默认值 false / 256 / 0.0、退化门槛 3、统计日志 5 秒均取自 v0.26 源码。

### 核心概念对照了什么

- 队列机制逐条对照 `vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py`：分类 L148-L153、老化 L155-L162 与 L171-L183（老化插队要求短车道非空）、出队与退化计数 L198-L235（取走短请求或长请求出队时短车道为空则清零）、peek 钉车道 L237-L244、插回重新分类 L246-L255、恢复判据 L329-L335、安装函数 L338-L367、异步子类 L370-L384。
- 上游契约对照 `vllm@568afb3a:vllm/v1/core/sched/scheduler.py`：等待循环入口 L665-L680（先 running、三道闸、peek）、挂起状态与 FCFS 取队 L1962-L1978、抢占 L1212-L1233、对齐切分得 0 即 break L896-L905、关分块时装不下即 break L866-L871。
- 本部署没有该特性：`git ls-tree db701c1f vllm_ascend/core/` 与 `2c59ff10` 只有 recompute、dynamic_batch、profiling_chunk；两者全仓 `git grep -il short_request` 为 0；平台层改 `scheduler_cls` 只有 dynamic batch、profiling chunk 两处。2ed6cbba 有 SRF 但无 GLM 模型代码（无 glm5_next），baa023ad 两者都有。与 prefill 审查的结论一致。
- v0.26 与 main 的 `short_request_first_scheduler.py` 是同一 git blob（f9628b28）；main 的平台校验、pydantic 配置类、ProfilingChunkScheduler 自装队列逐条核过；main 官方文档仍写不支持 profiling-chunk（第 105 行），与代码不符。
- 官方文档 `docs/source/user_guide/feature_guide/short_request_first.md`（v0.26）：用途、配置示例、门槛 P70–P85 与「谷」、等待上限 W_normal/W_slo 定法、调度次序、退化警告、兼容性。

### 旧版信息清单勾选（清单在 scratchpad p5/short-request-first-facts.md）

旧版 = p4-checkpoint（与改前现版相同）；另把 P4 之前 c60c4fa 版（含对照源码）也列入清单。

- F1 队头阻塞 ✓ 第 1、2 节；F2 只改选择顺序、不预测输出、不替代预算/分配/执行 ✓ 定义句与第 2 节；F3 快照与 GLM 基线 ✓ 改为「钉住代码里没有」，并核实 v0.26 无 GLM、main 两者都有；F4 A/B/C/D 算例 ✓ 保留并补第 2 步；F5 轮数不等于毫秒 ✓ GLM 节「步数不等于毫秒」；F6 队列定先选谁、分块定算多少 ✓ 第 1 节末与细节；F7 三类队列 ✓；F8 老化规则、队头提升不承诺截止时间 ✓（补了一句「不保证多少毫秒内拿到第一个 token」）；F9 peek/pop 钉车道 ✓；F10 重新分配等待、饿死、老化削弱收益、恢复优先影响新请求 ✓（补了「恢复车道有人时新请求都得排后」）；F11 默认 256 / 0、评估指标 ✓；F12 输入短不等于作业短 ✓；F13 互斥与 D 节点 ✓ 会报什么错；F14 配置路径与异步子类 ✓ 怎么开；F15 GLM 额外条件 ✓ GLM 节三条。
- G1 Qwen3.6-35B-A3B 两卡算例：删除。理由：该例的模型与部署不是本站固定前提，数字不出自主线底稿；机制结论（短请求早一步、长 B 晚一步）由 A/B/C/D 示意例和 GLM 变体推演承接。
- G2–G19 ✓ 均保留（分车道只看提示词长度、恢复车道理由标 [D]、严格短优先、老化只在短车道有人时算插队、退化警告与清零条件、钉车道、与分块正交、管不到 running、挂起队列在前、四条误解、默认值与官方示例 2000、只换 waiting 对象、两条安装路径、恢复判据与抢占插回、报错与 RuntimeError）。
- G20 对齐切分得 0 即停 ✓ 保留为一般规则（细节节与开销节）；Qwen 块 2048 = 预算的特例删除（非固定前提），并写明 GLM 双机不走对齐模式。
- G21 版本差异 ✓；其中「均衡调度环境变量在 main 删除」挪到 [balance-scheduling](../../../wiki/concepts/balance-scheduling.md)，本页版本差异下留链接。
- G22 源码位置表 ✓。

### 参考图库

看过 refs/INDEX.md、HOW-THEY-TEACH.md 和 amd-04-hi.png。参考只覆盖通信原语和 TP/DP/PP/EP，没有调度排序的图；借了两种做法：一是「成对对照、同一骨架只改一处」（直觉图左右两栏用同一个预算窗口，只换取法），二是「逐步标出这一步谁在算」（两栏都按第 1 步、第 2 步分行）。其余无可借之处。

### 验证

- `pnpm wiki:lint`：本页 0 报错（最后一次全库通过）。
- `pnpm wiki:audit`：本页 25 条来源全部 ✓，全库 `ok wiki:audit`；写作标准按名单规则单跑本页：4448 字 · 行内代码 0.4/千字 · 角标 0 · 对照源码 ✓ · calc 0.67/千字 · 相邻块 0 · 图先行 · 免责 1.4% · 图宽 ✓。
- `pnpm wiki:diagrams --check`：246 张图与 spec 一致。中途全库 `wiki:diagrams` 曾因别的写手正在改的 batch-invariance / balance-scheduling 图失败，本页两张图当时用同一套函数（loadDiagrams、figureProblems、renderDiagram）单独渲染，最后全库 --check 通过。
- 没有截图、没有起服务；浏览器验收留给审查环节。

### 自查疑点

- 无 P1 疑点。待核三条写在页末：main 上 GLM 与本特性同开的限制、本部署默认是否开异步调度、TTFT 与等待分布无实测数。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审不改页）。分数 **8.5 / 10**；P1 0 条，P2 2 条，P3 5 条。学习顺序通过；`pnpm wiki:audit` 本页通过。

### 版本核实（自己 grep，不信写手自报）

- `vllm-ascend@db701c1f`（本部署 GLM 镜像）：`git grep -il 'short_request_first\|ShortRequestFirst'` 0 命中（另用 `short[_ -]?request|srf|long_max_wait` 宽搜，唯一命中是一张 jpg 的二进制误中）；`vllm_ascend/core/` 只有 recompute、dynamic batch、profiling chunk；`platform.py` 改 `scheduler_cls` 只有 L704、L712 两处。有 GLM 模型代码（`models/glm5_next.py` 等 13 个文件）。
- `2c59ff10`（v0.23 维护分支）：同样 0 命中、同样三种调度器、`scheduler_cls` 只在 L714、L722；没有 GLM 模型代码（只有两个 glm 工具调用解析补丁）。
- `2ed6cbba`（v0.26）：有，`vllm_ascend/core/short_request_first_scheduler.py`，另有 `ascend_config.py`（L940-L945 默认 threshold 256、long_max_wait_ms 0.0）、`platform.py`（L652-L679 校验与异步子类）、`patch/platform/patch_balance_schedule.py`、官方文档 `docs/source/user_guide/feature_guide/short_request_first.md` 和 4 个单测；没有 GLM 模型代码（只有 `patch_glm_reasoning_usage_accounting.py`）。
- `baa023ad`（main）：有（同一组文件，另加 `scheduler_profiling_chunk.py` 自装队列），也有 GLM 模型代码（`models/glm5next/`）；main 的 78 个含 glm 的测试文件里没有一个出现 short_request，页面「没有找到两者同开的测试」属实。
- 结论与页面 L140、L178 及版本差异表一致。

### 初学者测试（只读前两屏）

「短请求优先把还没开算的新请求按提示词长短分进短、长两条队，每步先接纳短的，让短请求不被排在前面的长提示词堵住；它不多造预算，只是把等待挪给长请求，短请求源源不断时长请求会被饿着。」能说清，通过。

### 学习顺序

是什么（L49，定义 + 16 格示意例 + 直觉图）→ 为什么 / 代价（L68，calc 在这里）→ 怎么排（L94）→ 细节（L124）→ GLM 双机（L138）→ 常见误解（L170）→ 对照源码（L180）。第一屏是问题式 H2、定义和图，没有开算，也没有 GLM 数字；GLM 数字只在 L138 之后。通过。

### 核心概念对照（2ed6cbba 源码 / 官方文档 / 上游 568afb3a）

- 分车道只看提示词 token 数、`<= threshold` 进短车道：`short_request_first_scheduler.py` L148-L153 ✓（页 L96）。
- 恢复车道判据（PREEMPTED / 已算过 / 已输出）：L329-L335 ✓（页 L98）；抢占后 `prepend_request` 重新分类落恢复车道：L246-L255 ✓。
- 选取次序 恢复 → 等够上限的长车道队头（且短车道非空）→ 短 → 长；`long_max_wait_ms <= 0` 不启用：L155-L183 ✓（页 L100-L102）。
- 退化警告：连续 3 次（`AGED_LONG_WARNING_STREAK = 3`，L47），`logger.warning_once`；取短请求或长请求出队时短车道为空则清零：L198-L235 ✓（页 L112）。统计日志 `STATS_LOG_INTERVAL_S = 5.0`（L46）、`logger.info` ✓。
- peek 记住车道、pop 从同一车道取：L237-L244、L198-L202 ✓（页 L114）。
- 上游：先挂起队列再 waiting（`_select_waiting_queue_for_scheduling` FCFS 分支，568afb3a L1976-L1978）✓；running 满即 break（L672-L673）✓；关分块装不下即停（L866-L871）✓；对齐切分得 0 即 break（L896-L905）✓。
- 官方文档：定位（L10 短请求 TTFT 比严格 FCFS 更重要）、门槛放在「谷」、P70-P85 起步（L45-L49）、等待上限是公平性闸门、W_normal/W_slo 定法、不拿短请求平均 TTFT 定（L53-L67）✓（页 L72、L134、L136、L176）。
- 核心概念无错。

### 数字

- 三个 calc 逐个手算：四条请求首 token 步数 6 / 5、平均 1.5 / 1.25 ✓；老化 2,400−1,000=1,400 < 2,000，3,100−1,000=2,100 ≥ 2,000 ✓；GLM 变体：先到先服务 48+8,144 两步、第 3 步 48+3,712+4=3,764，短请求优先第 1 步 48+4+8,140、第 2 步 52+8,140、第 3 步 52+3,720=3,772，均 8,192 封顶 ✓。运行顺序（短请求先进 running，第 2 步它的 4 个位置先于长提示词的第二段）与上游 running 循环一致。
- 8192 / 32 / 每条 decode 4 位置 / 12 条 decode / 20,000 token 分 8,144、8,144、3,712 与 01 §A2.1（L638）、§B2（L924-L942）一致；场景 M 6,000 token 与 01 L924-L925 一致。
- 「未启用 / 变体」口径：GLM 节开头明说钉住代码里没有、只按调度规则推演、数步数不数毫秒、无实测（L140），calc 标题带「按调度规则推演」，L162 再强调步数不等于毫秒。没有虚构部署实测数，没有把 GLM 主线数字当成这个特性的效果。通过。

### 丢信息

- 基线 p4-checkpoint（1,567 字，5 个 H2）逐条对照新版：队头阻塞、只改选择顺序不预测输出、A/B/C/D 算例、轮数≠毫秒、队列定先选谁 / 分块定算多少、三类队列、老化不承诺截止时间、peek/pop 钉车道、饿死与老化削弱收益、默认 256 / 0、评估指标、输入短≠作业短、接入条件（FCFS、拒 D 节点 `kv_consumer`、与批作业 / profiling chunk 互斥，见 L194）、配置路径与异步子类、GLM 额外条件——都在。
- facts 清单 G1（c60c4fa 版 Qwen3.6 两卡算例）删除：模型与部署不是本站固定前提、数不出自主线底稿，机制结论由示意例和 GLM 推演承接，接受。其余勾选抽查属实。

### 链接与锚点

- `pnpm wiki:lint` 通过，本页 0 条；页内 7 个跨页锚点（vllm-scheduler ×2、concurrent-requests ×2、chunked-prefill、glm-5-3-flash-two-node、async-scheduling）对应标题都在。全库入链 5 处（async-scheduling、cann-hccl、prefill、vllm-scheduler、index），都不带锚点，改 H2 无影响；vllm-scheduler L200、async-scheduling L193 的版本口径与本页一致。
- `pnpm wiki:audit`：本页 25 条来源通过，全库 ok。`pnpm wiki:diagrams --check`：247 张一致。

### 注水与重复

- 讲解部分 6,814 字，其余 4,276 字在对照源码。新增内容大多是实打实的机制（恢复车道理由、老化、退化警告、钉车道、挂起队列、对齐切分、门槛与上限定法、GLM 变体推演），没有大段注水。
- 与 vllm-scheduler 的重叠：开头一段调度器 / 预算 / running / waiting 的交代（L51）、「running 先于 waiting」（L126）、decode 每条 4 个位置（L142）都是一两句加链接，合格。与 balance-scheduling 只有一句链接（L219），合格。GLM 变体只新增一条 4 token 短请求，20,000 token 的逐步账链接 C，没重算 KV 块，符合「场景 M 统一引用 C」。
- 页内重复见 P3-1。

### 截图

`short-request-first-review-1.png`（第一屏）、`-2.png`（直觉图）、`-3.png`（流程图）、`-zoom.png`（流程图右侧连线放大），均在审查会话 scratchpad，Playwright 桌面宽 1440。直觉图两栏对照清楚，第 1、2 步格子与正文、calc 一致；流程图连线齐全。

### P1

无。

### P2

1. **L168 与 async-scheduling 已核的结论矛盾。** 本页写「本部署是否默认开着异步调度，主线底稿里还没核」；但 [async-scheduling](../../../wiki/concepts/async-scheduling.md) L200、L236、L253 已按自动判定核为「开着」（MTP 在允许名单、多进程执行器支持异步），vllm-scheduler L135 也按此写 AsyncScheduler。改法：改成「本部署按自动判定开着异步调度（见异步调度页 GLM 双机一节），换上它会走异步子类 ShortRequestFirstAsyncScheduler 这条路径」，删掉「还没核」；「装在哪条路径上」这条随之从「没覆盖的事」里改成已知结论（v0.26 下异步路径与 profiling chunk 互斥这一点可顺带一提）。
2. **L53 定义句「被抢占过」先用后讲。** 抢占到 L98 才解释，初学者在第一屏的加粗定义里就碰上。改法：定义句里加一个括号短解释（「KV 块不够时被调度器踢回等待队列的」），或定义句只讲短 / 长两条车道，恢复车道留到第 3 节展开。

### P3

1. 「它只改下一个接纳谁、不改预算」在 L53、L64、L87、L122、L172 出现五次，「长请求会被饿着」在 L89、L92、L173 出现三次；误解节复述正常，正文中 L122 那句可删到只剩「调度循环不用改一行」。
2. 流程图顶框写「第 2 站 调度」，站点代号对初学者是干扰（基础标准第 14 条）；改成「调度器一步的开头」。
3. 流程图「借到了」的虚线回到顶框「先给 running 续上」，读起来像每接纳一条就重新续一遍 running；回线改指「挂起队列里有请求吗？」更准。
4. L132「短请求先占掉一部分余量，长请求更常碰上取整得 0」是按规则的推断，不是源码直接写的；建议加「按规则推断」。
5. 术语：特性名全页用「短请求优先」，只在 L53 出现一次英文；按「有固定英文名的用英文原名」的约定，可考虑统一为 Short Request First（TERMS 里没有这一条，需要和全站口径一起定，不单改本页）。

### 跳过了什么

- frontmatter 的 sources 区、所有代码块和命令块未读；「## 对照源码」（L180-L237）只 grep 了五个 H3 的顺序、版本差异里的 v0.23 / v0.26 / main 和几处关键词（`kv_consumer`、`RuntimeError`、官方示例），没读正文。
- 没读 HANDBOOK、docs/plans/、TERMS 全文（只 grep）。

## P5 修订记录（09-29）

写手：Opus（同一写手按审查意见修订）。P2 修 2 条，P3 修 4 条，P3-5 按审查意见不单改本页。

- **P2-1 异步调度口径。** 先 grep async-scheduling 页：「落到 GLM 双机」一节第一句写明本部署靠自动判定开着异步调度（MTP 在允许名单、多进程执行器支持异步）。本页 GLM 节第 168 行改为确定说法：本部署开着异步调度，换上短请求优先会走专门的异步子类，并链接 `async-scheduling.md#落到-glm-双机r1-每一步的占位账`；顺带写明开着异步时不能和 profiling chunk 同开（v0.26 一律不行，main 只放开同步）。引导句从「三件事这份推演没有覆盖」改成「还要注意三件事」。对照源码「怎么开」的安装路径一条注明本部署开着并链接异步调度页；页末待核删去原第 2 条（剩 2 条）。
- **P2-2 定义句先用后讲。** 第 53 行加粗定义里「被抢占过」后加括注：KV 块不够时被调度器从 running 踢回等待队列。没有链到 recompute-scheduler，因为那一页讲的是 PD 分离 D 节点专用的调度器，不是通用的抢占；第 3 节恢复车道处仍有完整解释。
- **P3-1 重复。** 第 122 行删掉「只是换了一个从哪条队里拿下一个的答案」，只留「调度循环不用改一行」；第 92 行「长请求在尾部被饿着」改成「长请求的尾部等待」。
- **P3-2 流程图站点代号。** 顶框「第 2 站 调度」改为「调度器一步的开头」。
- **P3-3 流程图回线。** 「借到了」的虚线改指「挂起队列里有请求吗？」框的上沿；该框的副文字改为「扣预算；有余量、running 未满就看下一条」，把回到循环前的预算与条数检查写在回线起点上。
- **P3-4 推断标注。** 第 132 行改为「按这条规则推断，……长请求会更常碰上取整得 0」。
- **P3-5 术语未改。** 审查意见本身写明需和全站口径一起定（TERMS 无此条），本页保持「short request first（短请求优先）」首现英文、后文中文。
- **版本差异表加一行「有没有 GLM 模型代码」**，写入审查员核实的结论：v0.23 维护分支没有、本部署 db701c1f 有；v0.26 没有；main 有（models/glm5next/），含 GLM 的测试里没有和短请求优先同开的。

验证：`pnpm wiki:lint` 通过、本页 0 报错；`pnpm wiki:audit` 通过、本页 25 条来源 0 ✗；`pnpm wiki:diagrams` 重写 short-request-first-flow.svg 后 `--check` 247 张一致。写作标准单跑本页：4492 字，行内代码 0.4/千字，角标 0，calc 0.67/千字，免责 1.4%，全部 ✓。
