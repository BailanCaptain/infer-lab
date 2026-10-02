# 目录编排与入链补齐（10-02）

范围：把 5 个新页编进 `src/content/wiki/toc.ts`，并按写手/审查的入链建议给已有页补链接。未改 `scripts/wiki/standard-pages.json`、`docs/plans/`、rfork-* 页，也没有提交 git。

## 一、目录落位

依据是 `docs/plans/2026-09-27-toc-tuning.md` §1.1 已经定好的落位表（只 grep 了这 5 个 id 所在的行），再对照各页 frontmatter 的 title/summary 和相邻页做了核对。

| 页 | 主题 › 小节 | 位置 | 理由 |
| --- | --- | --- | --- |
| `api-server-entry` | vLLM 与 Ascend 架构 › 组件、职责与进程 | `engine-processes` 之后、`request-call-chain` 之前 | 先认识三类进程，再细看第一类进程（API server）的入口，最后看七站代码路径；与微调清单一致 |
| `lm-head` | 模型结构与计算 › Decoder 层、MoE 与 lm_head | `moe` 之后（末位） | 小节标题本来就写了 lm_head，前向的最后一步；与清单一致 |
| `sampling` | 推理过程 › **新节「Sampling 与返回」** | 该节第一页 | 新节放在「Block table 与 prefix caching」之后、「Chunked prefill 与 speculative decoding」之前：sampling 是 speculative decoding 的前置（MTP 候选靠它验收） |
| `streaming-output` | 推理过程 › Sampling 与返回 | `sampling` 之后 | 选出 token 之后，紧接着就是还原成文字、推回客户端；与清单一致 |
| `dp-request-routing` | 分布式推理与部署 › DP 组分流与 expert 负载 | 该节第一页（`balance-scheduling` 之前） | 先讲新请求派到哪组，再讲各组一起停收（balance scheduling）和专家负载；与清单一致 |

新节标题：清单里叫「采样与返回」，这里写成「Sampling 与返回」，因为同一份清单 §5.2 已经把其他小节标题都换成了英文原名（Prefill、Block table、Chunked prefill…），和 sampling 页的标题也一致。清单里同节的 `request-teardown` 还没有建页，等建好后接在 `streaming-output` 之后。

测试：在 `src/content/wiki/toc.test.ts` 新增一条用例「请求入口、lm_head、sampling、流式输出与 DP 路由排在相邻页旁，不进待编排」。改 toc.ts 前先跑，结果是红的：api-server-entry 落进了待编排；改完以后变绿。

## 二、入链

| # | 建议来源 | 改在哪 | 加了什么 | 结果 |
| --- | --- | --- | --- | --- |
| 1 | api-server-entry P2-3 ① | one-request「第 1 站 入口」末段（L126） | 段末补「入口每一步的细节见[API server 入口]」 | 已加 |
| 2 | api-server-entry ② | request-call-chain「七站逐站」① 段（L181） | 「选 DP 组的规则见…」后补半句：前端怎样检查、套模板、分词、定采样参数，见[API server 入口] | 已加 |
| 3 | api-server-entry ③ | token「再交给某一个引擎等待调度」（L196） | 「成功才建立请求。」后补一句：每一步做什么、在哪里拒绝请求，见[API server 入口] | 已加 |
| 4 | api-server-entry ④ | engine-processes「每个进程里存着什么」中「API server 不是把请求交出去就没事了」段（L171） | 段末补「为什么要先登记再发出，见[API server 入口的第 ⑤ 到 ⑦ 步](…#怎么做包成引擎请求先登记回程再发出⑤-到-⑦)」 | 已加（带节锚点） |
| 5 | api-server-entry ⑤ | sampling「采样参数从哪来？」首段（L234） | 句中「入口」二字加链接，指向 `#怎么做从-json-到一串编号①-到-④`（第 ④ 步就是定输出上限和采样参数） | 已加（带节锚点） |
| 6 | api-server-entry ⑥ | vllm-v1-shape「vLLM 怎样把一条请求变成一步一步的计算？」中「前端」那条（L70） | 条末补「进门这几步各做什么、在哪里拒绝请求，见[API server 入口]」 | 已加 |
| 7 | api-server-entry ⑦ | dp-request-routing 第一节（L50「前端是…再由它交给某一组的引擎」之后） | 补一句：选组之前，前端已经做完检查、套模板、分词和定采样参数，见[API server 入口] | 已加 |
| 8 | streaming-output P2-1 ① | one-request「第 7 站 返回与收尾」（L530） | 段末补「增量反分词、停止字符串和 SSE 片段的细节见[流式输出]」 | 已加。写手建议「压成一句 + 链接」，这属于重写段落，没做，只补了链接 |
| 9 | streaming-output ② | token「生成的编号怎样变回文字？」（L149，「没有固定的一一对应关系」之后） | 补「增量反分词怎样攒字节、停止字符串怎样扣住文字，见[流式输出]」 | 已加 |
| 10 | streaming-output ③ | request-call-chain「七站逐站」⑦ 段（L195） | 句末补半句：增量反分词和 SSE 片段怎样拼出来，见[流式输出] | 已加 |
| 11 | streaming-output ④ | sampling「什么时候停下来？」第二条（L256） | 句末补半句 + [流式输出的停止字符串一节](…#停止字符串先扣住结尾几个字) | 已加（带节锚点） |
| 12 | dp-request-routing 审查第 8 条（「可以各加一行，不是本批验收要求」） | one-request 第 1 站第 3 步「选 DP 组」（L123） | 条末补「选组怎样一步步算、本地计数为什么会过时，见[DP 请求路由]」 | 已加。原想写「为什么乘 4」，查到该页只一句带过 ×4 的来由，就改成了它确实讲了的内容 |
| 13 | 同上 | concurrent-requests「第 1 站 入口」（L122，两种来路那段） | 段末补「这两条路和计数怎样滞后，见[DP 请求路由](…#计数表从哪来为什么会过时)」 | 已加（带节锚点） |

sampling 和 lm-head 的审查文件里，入链已由各自的修订轮补好（lm-head→sampling、one-request/speculative-decoding/structured-output→sampling、embedding/fine-grained-tp/sampling→lm-head），没有待办建议。

共加 13 条，不加 0 条。每页对每个目标只有一处：逐页 grep 过 `](api-server-entry.md`、`](streaming-output.md`、`](dp-request-routing.md` 的个数都是 1；request-call-chain 原有的那条 dp-request-routing 链接没动。`git diff -U0` 显示每处都只改了 1 行，只插入、没删字。

没在建议里、也没加的：vllm-v1-shape「前端」那条同时讲了回程「按流式格式一段段吐回」，也可以链到 streaming-output，但写手没有提这条，按范围不加，留给主会话定。

## 三、检查

| 检查 | 结果 |
| --- | --- |
| `npx vitest run src/content/wiki/toc.test.ts` | 先红（新增用例 1 失败）→ 后绿，11/11 通过 |
| `pnpm typecheck` | exit 0 |
| `pnpm lint`（biome check .） | exit 0；14 条 warning 和 2 条 info 都在 CSS 里，不是这次改的。toc.ts 一行超长，已用 `biome format --write` 只格式化了这两个文件 |
| `pnpm wiki:lint` | 每改一页跑一次，全部 exit 0；最后一次 exit 0（5 处 mark-flood 待留意，都不是本次改的页） |
| `pnpm wiki:diagrams --check` | exit 0，285 张图与 spec 一致 |
| `pnpm wiki:audit` | **exit 1**：2 处失败都在 `concepts/rfork-layout.md`（diagram-first、hedge-ratio 6.0%）。这页正在由审查员审，按纪律不碰。名单内 92 页里 91 页达标；本次改动的 8 页和 5 个新页都没有报错 |

## 四、浏览器实测（Playwright，桌面宽 1440，只读访问 5193）

脚本：scratchpad 里的 `toc-check.cjs`；输出存为 `toc-check.log`。

- 目录：5 页都在，各出现 1 次，位置和第一节的表一致；目录里已经没有「待编排」一组。
- 从目录点进 5 页：都能打开，h1 与标题一致，正文 1.5 万到 2 万字。
- 13 条新入链逐条点击，都跳到了目标页。带锚点的 4 条，目标标题都落在视口内（top=16px）。
- 控制台：除下面说的 502 以外，没有其他 error 或 pageerror。
- 截图：
  - 目录：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\1237c9d2-3224-4e8c-bd6d-e2ccf20e6feb\scratchpad\toc-directory.png`（左栏从「模型结构与计算」截到「分布式推理与部署」，窗口加高到不用滚动）
  - 跳转：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\1237c9d2-3224-4e8c-bd6d-e2ccf20e6feb\scratchpad\toc-jump.png`（engine-processes 点链接后，落在 api-server-entry「怎么做：包成引擎请求，先登记回程再发出（⑤ 到 ⑦）」）

## 五、遗留与需要知道的

1. **wiki-server 8790 没在运行。** `netstat` 里只有 5193 在监听，`curl` 直连 8790 连不上，经 5193 代理的 `/api/wiki/pages` 和 `/api/wiki/reviews` 返回 502，页面顶上显示「未能更新」。控制台里的 error 全是这些 502，每页都有，与内容改动无关。按要求没有去起停服务；页面数据来自 dev 构建里的 `virtual:wiki-reader-snapshot`，新页和新链接都已显示。另外，别的写手一改 wiki 文件，页面就会走「wiki:changed → 刷新失败 → 整页重载」，所以测试读链接时偶尔要重试一次（日志里有 1 次 retry）。
2. `src/content/wiki/registry.json` 停在 09-29，不含这 5 页，所以 toc.test 里「真实知识库每页恰好出现一次」那条用例覆盖不到它们。这次用新增的那条用例来锁定位置，没有跑 `wiki:build` 重新生成（不在范围内，而且 rfork 页正在改）。
3. `wiki:audit` 被 rfork-layout 卡住（见第三节）。
4. dp-request-routing 审查里还有一项没定：`DPLBAsyncMPClient` 这个 alias 要不要从 data-parallel 挪过来。不在本次范围。
5. engine-processes、dp-request-routing、concurrent-requests、request-call-chain 这四页的工作区文件是 CRLF。同目录里还有约 20 个没碰过的页也是 CRLF，所以不是这次编辑造成的；`.gitattributes` 是 `eol=lf`，提交时会统一成 LF。

## request-teardown（10-02 补）

### 目录

放在「推理过程 › Sampling 与返回」，`streaming-output` 之后（该节末位）：`["sampling", "streaming-output", "request-teardown"]`。写手、审查员和 09-27 的落位清单都是这个位置，我也按读者顺序核过：先定下 token（sampling）、再推回客户端（streaming-output）、最后一步是这条请求占的东西怎样还回去，和页面的 chapters 09、order 80 一致。小节标题没改：收尾是「返回」这一段的最后一步，单为一页改名不值。

测试：把上面那条用例扩成「请求入口、lm_head、sampling、流式输出、请求收尾与 DP 路由排在相邻页旁，不进待编排」，输入里打乱放进 `request-teardown`，期望它排在 `streaming-output` 之后。先跑是红的（request-teardown 落进了待编排，inference 组少一行），改 `toc.ts` 第 79 行以后变绿。

### 入链

| # | 建议来源 | 改在哪 | 加了什么 | 结果 |
| --- | --- | --- | --- | --- |
| 1 | 写手 ① | one-request「第 7 站 返回与收尾」的「归还块号」段末（L534） | 「前端、引擎和 worker 三处各删掉什么、客户端断开时中止消息怎样走，见[请求收尾]」 | 已加（页首，内容横跨多节） |
| 2 | 写手 ② / 审查 | streaming-output「收尾：长度到限，再归还块号」第 2 段末（L251，停止字符串顺序反过来那句之后） | 「这条路上中止消息怎样走、已经在算的那一步结果怎样处理，见[请求收尾](…#前端先发现停止字符串和客户端断开)」 | 已加（带节锚点） |
| 3 | 写手 ③ | api-server-entry「怎么做：包成引擎请求，先登记回程再发出（⑤ 到 ⑦）」末段断开那句之后（L167） | 「前端怎样察觉客户端走了、已经在算的那一步结果怎样处理，见[请求收尾](…#前端先发现停止字符串和客户端断开)」 | 已加（带节锚点） |
| 4 | 写手 ④ | vllm-kv-block-allocation「结束：16–17 块一次还清」第 2 段末（L175） | 「块之外，引擎、前端和 worker 各删了什么、worker 为什么晚一步才删，见[请求收尾](…#落到-glm-双机r1-结束时三处各还了什么)」 | 已加（带节锚点） |
| 5 | 写手 ⑤ | async-scheduling「在途的结果怎样收尾」第一条末（L182，「这条丢弃路径只为这种强制抢占而设」之后） | 「请求判停或被中止时，在途的结果怎样丢掉、worker 为什么晚一步才删它，见[请求收尾](…#异步调度下判停的时候下一步已经排好了)」 | 已加（带节锚点）。建议原指「对照源码 › 待核」那条；改在正文，因为读者是在正文这一节想问「正常结束和中止呢」，而往待核条目里写链接等于改它的结论 |
| 6 | 写手 ⑥ | vllm-scheduler「调度器怎样排一步」抢占那段末（L99） | 「抢占和请求结束都会把块全部还回池子，两者差在哪，见[请求收尾](…#抢占不是收尾块还了请求还在)」 | 已加（带节锚点）。常见误解里那条讲的是 running 会被卡住，不是结束和抢占的区别，没放那里 |
| 7 | 审查补 ① | concurrent-requests「第 5–7 站 采样、验证与收尾」末段（L403，continuous batching 收尾一侧那句之后） | 「一条请求结束时前端、引擎和 worker 各删什么，被中止时又怎样走，见[请求收尾]」 | 已加（页首） |
| 8 | 审查补 ② | sampling「什么时候停下来？」第一条（L255，「后面的直接丢掉」之后） | 「判停之后这条请求占的块怎样还、结束原因怎样发回前端，见[请求收尾](…#引擎先判停同一步里先还块再把结束原因发出去)」 | 已加（带节锚点）。「还有两点」下没有新增第三条，免得改动列表的数 |

没加的两处（都因「同页同目标只加一处」）：
- streaming-output「思考段、工具调用和断开连接」的「客户端断开」条（L211）：同页 L251 已加，且 L251 那节本来就叫「收尾」，读者在那里更会想往下看。
- vllm-kv-block-allocation「池子不够时：宁可抢占，也不借一半」：同页「结束」一节已加；这一节自己已把抢占讲透，抢占和收尾的区别由 vllm-scheduler 那条（#6）承担。

共加 8 条，每页对 request-teardown 只有 1 处正文链接（`grep -c '](request-teardown.md'` 逐页都是 1）。浏览器里 one-request 等 6 页对 request-teardown 显示 2 个链接，多出来的那个是 request-teardown frontmatter `relations` 生成的反向关系条目（如「builds-on one-request」），不是正文，没动。`git diff -U0` 每处只改 1 行、只在句末追加。

编辑方式：用只改指定行、不动行尾的小脚本（scratchpad `line-edit.cjs`）。streaming-output、async-scheduling、concurrent-requests 是 CRLF，改后 CR 数不变；其余是 LF。one-request 第一次用 perl 改时按 CRLF 误判过一次行尾，已核实原本就是 LF 并恢复成 LF（`git diff --stat` 无 CRLF 警告）。

### 检查

| 检查 | 结果 |
| --- | --- |
| `npx vitest run src/content/wiki/toc.test.ts` | 先红（1 failed / 10 passed）→ 后绿，11/11 通过 |
| `pnpm typecheck` | exit 0 |
| `pnpm lint`（biome check .） | exit 0；仍是那 14 条 warning、2 条 info，都在 CSS，不是这次改的 |
| `pnpm wiki:lint` | 每改一页跑一次，8 次全部 exit 0；最后一次 exit 0（4 处 mark-flood 待留意，都不是本次改的页） |
| `pnpm wiki:diagrams --check` | exit 0，290 张图与 spec 一致 |
| `pnpm wiki:audit` | exit 0；名单 100 页全部达标（上一节卡住的 rfork-layout 已不再报错） |

### 浏览器实测（Playwright，桌面宽 1440，只读访问 5193；8790 这次在运行）

脚本：scratchpad `toc-rtd-check.cjs`，输出 `toc-rtd-check.log`。

- 目录：request-teardown 出现 1 次，在 `toc-inference` 的「Sampling 与返回」，组内顺序 sampling → streaming-output → request-teardown；目录里没有「待编排」。
- 从目录点开：h1 为「请求收尾：一条请求结束或被中止后，它占的东西怎样一件件还回去」，正文约 1.9 万字。
- 8 条新入链逐条点击都到了 request-teardown；带锚点的 6 条，目标标题都落在视口内（top=16px）。
- 控制台：0 个 502，没有其他 error 或 pageerror。
- 截图：
  - 目录：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\1237c9d2-3224-4e8c-bd6d-e2ccf20e6feb\scratchpad\toc-rtd-directory.png`
  - 点开后：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\1237c9d2-3224-4e8c-bd6d-e2ccf20e6feb\scratchpad\toc-rtd-open.png`
  - 跳转：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\1237c9d2-3224-4e8c-bd6d-e2ccf20e6feb\scratchpad\toc-rtd-jump.png`（vllm-scheduler 点链接后，落在「抢占不是收尾：块还了，请求还在」）

### 遗留

1. async-scheduling「对照源码 › 待核」里「普通抢占与取消路径下，在途结果怎样处理」那条，取消路径的一半 request-teardown 已核过（审查 C3 ✓）。要不要把这条改成只留「普通抢占」，属于改结论，留给该页写手或主会话定。
2. `src/content/wiki/registry.json` 工作区有别人的改动，这次没碰；toc.test 的位置用例不依赖它。
3. 没碰 `wiki/params/weight-prefetch-config.md`，没提交 git。
