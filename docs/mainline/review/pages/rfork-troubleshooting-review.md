# rfork-troubleshooting 审查记录

## P5 写作记录（第 25 批，2026-10-02，Opus 写手）

### 改了什么

- 字数（写作标准口径，对照源码之前）：2992 → 5677。写作标准五项原先不过三项（对照源码缺两个 H3、全页无图、免责 8.9%），现在全过：图先行 ✓、对照源码五个 H3 ✓、免责 0.7%（1 句，集中在「哪些结论还要到现场核」一节）、行内代码 0、calc 0.18/千字、相邻块 0。
- 新增直觉图 `wiki/diagrams/rfork-troubleshooting.yaml`：B 借到来源后的四步（登记显存 → 要清单 → 核清单 → 分批读）各自先打一条具体异常，再汇成同一句汇总警告（原因一栏一字不差，都是 transfer failed.），最后清理改走默认加载。图说说明另外三种情况不走这张图（建后端 / 造模型异常带原因、没借到不打汇总、还租约失败不回退）。
- 新增 H2：「为什么不能只看最后那句」（三类状态）、「哪些结论还要到现场核」（待核集中处）、「放到 GLM 双机」、「常见误解」；「第一遍读日志」后加一段示意日志的读法演算；「还租约被 Planner 回 400 或 404」整节按源码重写，并加一个示意数 calc（用结果日志里的 held_elapsed 与示例 Planner 的租约有效期比，判断 404 是不是到期收回）。
- 每条「现象 → 原因 → 怎么办」都改链到讲机制的那一节：transfer 的第一～四步、登记了地址…、任何一步失败…、传完了…；config 的四类端口、超时与租约有效期、默认 60 秒、依赖和限制、怎么开；layout 的两条路、本机的工作区不从 A 搬；rfork 总览的「成功」四种、谁向谁借、每张卡读多少、这套部署能不能受益、开销和什么时候别开；官网差异页的「会影响排错的差异」。rfork-identity / rfork-lifecycle / rfork-startup 正在改，只链页面本身。
- 保留入链锚点：rfork-lifecycle.md 第 312 行链到本页「卡住了」一节，标题未改。
- 对照源码：日志原文全部改为与源码逐字一致的完整格式串并附文件 + 行号 + 级别；新增还租约（客户端、Session）与示例 Planner 两张表；怎么开（日志级别、Planner TTL 参数、重试默认值）与开销和什么时候别开两个 H3。
- frontmatter：summary 重写（≤200 字）、updated 改 2026-10-02、sources 追加 10 条（示例 Planner 4 段、Planner 单元测试、session 申请与阶段日志、loader EPLB 绕过与 summary rank、vLLM envs 日志级别、RFork config 默认值）。内联标记精简到 9 处（初稿 32 处触发 mark-flood 提示，现已消除）。

### HTTP 400 / TTL 判断句：核对工作版与 Planner 的 400 分支（验收要点）

结论：**「400 本身不能证明租约过期」事实成立，已恢复为加粗判断句；但旧版给 400 列的候选原因（借用编号不存在、来源身份对不上、另一份内存状态、Planner 重启）对示例 Planner 不成立——这些情况示例 Planner 回的是 404，已改正（旧版 P1 级错误）。**

证据（rfork@3284850b）：

- 客户端 `planner_client.py#L132-L150`：200/404 → RELEASED（#L134-L135 的 info 日志自注「404 means absent, not verified timely release」）；其他状态码一律先记 #L143 的 warning（带响应体），408/429/5xx → RETRYABLE，其余（含 400、3xx，因 #L130 `allow_redirects=False`）→ REJECTED；#L151-L155 requests 异常 → RETRYABLE；#L113-L117 Planner 未配置 → REJECTED。
- Session `session.py#L178-L213`：每次记 outcome（含 held_elapsed，起点是 #L77 的 acquisition_started）；REJECTED 或次数用完 → #L207-L209 error「lease remains unresolved, worker will not advertise a seed. Model loading/inference may continue.」，并清掉 `_deferred_seed_start`。
- 示例 Planner `examples/rfork/rfork_planner.py`：`/put_seed` 路由 #L469-L484 只在 `HeaderError` 时回 400（#L472-L473）；`HeaderError` 只来自 #L379-L393 的缺头 / 空值 / 非整数 / 低于下限（端口 ≥1、rank ≥0，#L410-L416）。`Store.put_seed` #L215-L229 先 `gc_expired_leases_locked`（#L276-L286，条件 `now - leased_at >= lease_ttl_sec`）再查，查不到或身份不符返回 False → 路由回 404「lease not found」（#L481-L482）。心跳超时的 seed 被 `gc_stale_seeds_locked`（#L251-L268）摘掉时连带删租约。
- 单元测试 `tests/ut/model_loader/rfork/test_rfork_planner.py#L103-L120`：到期后归还 → 404，重复归还 → 404。
- 客户端拿租约时的校验 `planner_client.py#L86-L98`（ip、port、user_id 非空、rank 存在；port >0、rank ≥0）与 Planner 的请求头校验条件等价，所以页面写「按源码对照，两端都是本工作版代码、中间没有改写请求头的代理时，这个 400 不该出现」——标明是源码对照推出，不是实测。
- 现场 Planner 若非示例实现：400/404 含义无法从仓库判断，写进「哪些结论还要到现场核」（待核：缺它的代码或接口约定）。
- held_elapsed 与租约年龄的关系：Planner 的 `leased_at` 在处理 get_seed 时取（#L210，时钟 `time.time`，#L145），晚于 B 的 acquisition_started；Planner 处理 put_seed 早于 B 收到回应，所以 Planner 侧年龄 < held_elapsed（前提：两端都没有调钟，页面已写明）。

### 报错原文逐字核对（文件 + 行号）

页面「会报什么错」各表的每一条都用 grep 在 rfork@3284850b 定位后按源码格式串照抄：transfer_backend.py #L216、#L225-L226、#L374、#L408-L409、#L425、#L434、#L443、#L457、#L500、#L600、#L690/#L703、#L768、#L785-L786；rfork_loader.py #L545、#L579、#L597、#L649、#L655、#L669-L670、#L624；planner_client.py #L78、#L87、#L108、#L116、#L134-L135、#L143、#L153；session.py #L139、#L190、#L208-L209、#L342-L343；seed_client.py #L101、#L152；manifest.py #L196、#L199、#L225-L227、#L237、#L246；tensor_layout.py #L21、#L25；示例 Planner #L382、#L390、#L392、#L482。

新发现并写进页面的源码事实：登记 / 要元数据 / 核清单 / 读四种失败时 `transfer_from_seed` 返回 False，loader `raise RuntimeError("transfer failed.")`（rfork_loader.py#L623-L624），所以汇总一律是 `RFork transfer failed: transfer failed., clean up ...`；四处在返回 False 前都先记 error（逐个返回点核过：transfer_backend #L359-L456、#L633-L775，seed_client #L89-L153，tensor_layout #L28-L44）。「没借到」只在 tp_rank==0 用 info（rfork_loader.py#L73-L75、#L647）；Planner 404 只记 debug（planner_client.py#L78）。分批读是顺序同步读、首个失败即返回（transfer_backend.py#L758-L775），所以「第 1 到 k−1 批已写入」改为确定说法。旧版「批量登记接口缺失或失败：日志为 requires …」不准确——那条只对应接口缺失，登记报错另有两条日志，已分开写。

### 数字出处

全部取自 01 §A0.8「在我们部署下的具体数字」：32 次申请 / 32 份租约、tp_rank = r mod 8；主模型每卡 ≈ 20,572 MiB、至少 21 批；草稿 ≈ 844 MiB、张量条数 ≤ 512 时 1 批；默认 60 秒租约对应 ≈ 0.33 GiB/s 链到 rfork-config「默认 60 秒的租约够不够」不重算；动态 EPLB 绕过取自 §A0.8「适用条件」。rank 0 与 rank 8 打 INFO 由 tp_rank = r mod 8 与 `_is_rfork_summary_rank` 推出。基础节的数（第 7/12 批、48.2 / 75.6 秒）是示意数并已标注。

### 旧版信息清单勾选（清单：scratchpad\p5\rfork-troubleshooting-facts.md）

F1–F15、F17–F29 全部保留在新版对应节（F2、F5、F10、F11、F14、F19、F24、F26、F28、F29 按源码改得更准或补了行号）。F16 按上节证据改正：TTL 判断句恢复，候选原因改为「示例 Planner 下 400 只来自请求头解析」，原候选移到 404 一侧，现场 Planner 的情况进待核。无删除项。

### 验证

- `pnpm wiki:lint`：本页 0 报错、0 提示。整体 lint 失败 1 处在 concepts/request-teardown.md（frontmatter 解析失败，别的写手的页）。
- `pnpm wiki:audit`：本页 20 条来源全部 ✓。写作标准（名单外，用同一套 checkStandard 单页实测）：全部 ✓。
- `pnpm wiki:diagrams --check`：本页图与 spec 一致、无越界无重叠；整体脚本被 rfork-lifecycle-threads.yaml 的重叠拦下（别的写手的图），本页 svg 用同一套 renderDiagram 单独生成。
- 图已用 Playwright 渲染 svg 截图目视检查：四列对齐、无溢出、汇总框红底反白可读。
- 浏览器整页验收**未完成**：`pnpm wiki:figshots rfork-troubleshooting` 在 5193 上等不到 h1（推测是 request-teardown 页 frontmatter 不合法导致整站打不开），留给审查环节。

## P5 审查（09-29）

审查日期 2026-10-02，Opus 审查员，只审未改页面。基线：RFork 工作版 rfork@3284850b（本仓 `rfork/source/`，manifest 第 55 行 patch7）。

### 结论

- **分数：7.5 / 10**（P1 1 条，P2 2 条，P3 2 条）。
- **学习顺序：通过。** 第一屏是问题式 H2、一句话定义和直觉图；第二节讲为什么不能只看汇总（三类状态）；再讲怎么读日志（第 7/12 批示意例）；细节各节之后才是 GLM 双机，接着是常见误解和对照源码。GLM 数字（32 份、20,572 MiB、0.33 GiB/s 等）只出现在 GLM 双机一节（第 256 行起），基础节只用示意数和默认值。
- **初学者测试（只读前两屏）**：RFork 排错就是从「传输失败、回退」这句汇总往前找第一条具体异常，确认代码版本、坏在借权重的哪一步、失败后模型 / 租约 / 显存停在哪；只看汇总会把「中途失败」「根本没借到」「借成了但没当来源」三类混在一起，查错方向。
- **audit：通过。** `pnpm wiki:audit` 退出码 0，本页 20 条来源全部 ✓。本页不在 standard-pages.json 名单里，用 `checkStandard` 单页自测（临时脚本，跑完已删）：5677 字，行内代码 0.0/千字、角标 0、对照源码 ✓、calc 0.18/千字、相邻块 0、图先行 ✓、免责 0.7%、图宽 ✓，**全部 ✓**。`pnpm wiki:lint` 通过，本页 0 报错 0 提示（跨页锚点硬校验通过）。
- **浏览器验收：通过。** Playwright 桌面宽 1440 只读访问 http://localhost:5193/#/wiki/rfork-troubleshooting，没起停服务。h1 正常，控制台 0 错误。直觉图四列对齐、汇总框红底反白可读；calc 正常渲染。截图在审查会话 scratchpad：`rfork-troubleshooting-review-1.png`（第一屏）、`-2.png`（直觉图）、`-3.png`（404 calc）、`-4~7.png`（跳转后）。站内链接点击 4 条，都跳到了目标节，标题停在视口顶部 16px：rfork#成功至少有四种不能压成一个开关、rfork-transfer#第四步大张量切成不超过-1-gib-的段再按批读、rfork-config#超时重试间隔和租约有效期是三个量、本页#哪些结论还要到现场核。
- 入链：全库只有 rfork-lifecycle.md 第 314 行指向本页「卡住了」一节，锚点能解析。
- 旧版信息清单（`p5\rfork-troubleshooting-facts.md`）存在。抽查 F4、F8、F11、F13、F15、F20、F22，在新版第 116、174、184、190、198–202、232、236–243 行都找到了。F16 的处理见下面「专项」。
- 没有新加分镜动图。

### 专项：状态码与情况的对应（逐条对照源码，结论成立）

- 客户端 `planner_client.py#L132-L150`：200 和 404 → RELEASED，日志在 #L134-L135，自带说明「404 means absent, not verified timely release」。其余状态码都先在 #L143 记「rejected」警告，响应体里的 USER_ID 换成 `<lease-id>`，并截到 256 字符（#L22、#L140-L141）。408、429、5xx → RETRYABLE；其余状态码 → REJECTED，因为 #L130 设了 `allow_redirects=False`，所以包括 400 和 3xx。`requests` 异常 → RETRYABLE（#L151-L155）。没配 Planner → REJECTED（#L113-L117）。页面第 198–202 行和对照源码表都与此一致。
- 默认重试 3 次、间隔 30 秒：`config.py#L14-L15`，页面第 201 行正确。
- 示例 Planner `examples/rfork/rfork_planner.py`：put_seed 路由只在 `HeaderError` 时回 400（#L470-L473）。`HeaderError` 只来自这几种情况：缺头或空值（#L379-L383）、不是整数（#L386-L390）、低于下限（#L391-L392；端口下限 1、rank 下限 0，#L410-L418）。`Store.put_seed` 先调 `gc_expired_leases_locked`（#L218、#L276-L286）：查不到或身份不符时返回 False → 404「lease not found」（#L481-L482）。重复归还回 404，单元测试 `test_rfork_planner.py#L103-L120` 有断言。心跳超时时，`gc_stale_seeds_locked` 连带删掉租约（#L251-L268）。存储只在内存里，所以 Planner 重启后同样是 404。页面第 206–211 行成立。
- 客户端拿租约时的校验（#L86-L98：ip 非空、port 是整数且 >0、user_id 非空、rank 是整数且 ≥0）与 Planner 的请求头校验等价。页面第 210 行写成「按源码对照…不该出现」，标明了是从源码推出的，**不算把推断写成定论**。
- `held_elapsed` 的起点是 `acquisition_started = time.monotonic()`，在 get_seed 之前取（`session.py#L77`、`#L81`），终点是拿到回应后记日志时（#L190-L195）。Planner 的 `leased_at` 用 `time.time`（#L145、#L210）。所以 Planner 一侧的租约年龄 < held_elapsed，第 215–224 行的 calc 推理成立。
- 「400 不能证明租约 / TTL 到期」保留了（第 206 行加粗）。对示例 Planner，「400 与租约到期无关」是源码事实（400 在查存储之前就返回了）。
- 写作记录里说旧版候选是「旧版 P1 级错误」，这说重了：旧版第 151 行没有绑定示例 Planner，是一份标了「推断」的泛化候选。对示例 Planner 改正是对的，但见 P2-2。

### 报错 / 日志原文逐字核对

用脚本把「会报什么错」各表中带 `文件#L行` 的 36 行格式串，与源码对应行里的字符串字面量逐字比对，**36/36 一致**：transfer_backend 的 #L215、L224、L374、L408、L425、L434、L443、L457、L500、L600、L690、L768、L785；rfork_loader 的 #L545、L579、L597、L649、L655、L669；planner_client 的 #L78、L108、L116、L134、L143、L153；session 的 #L139、L190、L208、L342；seed_client 的 #L101、L152；manifest 的 #L196、L199、L225、L237、L246。示例 Planner 表的位置与原文也人工核过（#L379-L392、#L410-L418、#L218-L223、#L251-L268、#L276-L286、#L481-L484），一致。
其他核对，都与页面相符：「没借到」只在 tp_rank==0 时按 info 打（`rfork_loader.py#L73-L75`、`#L646-L647`）；Planner 回 404 时客户端只记 debug（#L78）；分批读按顺序同步进行，第一次失败就返回（`transfer_backend.py#L758-L775`）；批量注销遇到 not-found 时逐个地址补查（#L488-L503）；finalize 只在 kNotReady 时重试（#L598-L612）；动态 EPLB 绕过的警告（`rfork_loader.py#L540-L547`）；lease= 是 SHA-256 的前 12 位（`planner_client.py#L25-L27`）。

### 数字

32 次 get_seed / 32 份租约、`tp_rank = r mod 8`、同号 rank 借同号 Worker、20,572 MiB / 至少 21 批、844 MiB / 张量条数 ≤512 时 1 批，都与 01 §A0.8 第 468–496 行一致。0.33 GiB/s 链到 rfork-config，本页没有重算。Planner 租约 TTL 默认 60 秒（`rfork_planner.py#L39`）。示意数都标了「示意」。

### P1

**P1-1 「四种失败一字不差 / 任何一处失败都返回 False」把部分分支写成了全称定论**
- 位置：第 83 行（「无论坏在哪一步……一字不差」）、第 269 行（常见误解第 1 条）、第 312 行（「任何一处失败，`transfer_from_seed` 都返回 `False`」）；直觉图 `wiki/diagrams/rfork-troubleshooting.yaml` 第 3 行 caption（「四种情况一字不差」）和第 14 行汇总框（「四种失败一字不差」）。
- 问题：源码里这四步除了「先记 error 再返回 False」，还有直接抛异常的分支。抛出的异常会被 `rfork_loader.py#L651-L655` 接住，汇总的 `%s` 就是那条异常文本，而且前面**没有**单独的 error 日志。实际存在的抛出点：
  - 要元数据：`session.py#L123` 的 `build_seed_url` 在 try 外。端口超出 1..65535、地址格式不合法、带凭据或端口冲突时，`seed_client.py#L25-L54` 抛 ValueError。客户端拿租约时只校验 port>0，例如 Planner 回 SEED_PORT=70000，就会直接走到这里。
  - 登记：`transfer_backend.py#L338` 的 `_tensor_storage_owner`，取不到时在 #L175 抛 RuntimeError。
  - 分批读：#L748 的 `iter_transfer_chunks` 在 #L128、#L132 会抛 ValueError；#L760 的 `batch_transfer_sync_read` 没有 try。
  - `session.py#L114-L116` 的注释本身就写着：传输调用可能 raise，而不是只返回 False。
- 影响：读者按本页「往前找紧挨着的那条具体异常」去找，在这些情况下找不到；看到汇总原因不是 `transfer failed.`，又会以为不是这四步。这是本页的核心直觉图和常见误解，属于把部分分支说成全称（推断写成定论）。
- 改法：
  - 第 83、269、312 行和图的 caption / 汇总框改成「这四步**按检查查出**的失败，都先记一条具体 error，再汇成同一句、原因为 `transfer failed.` 的汇总」。
  - 补一句：「若某一步直接抛异常（如来源地址不合法、传输引擎调用抛错），汇总里的原因就是那条异常文本，前面没有单独的具体日志」。
  - 对照源码第 312 行补上述抛出点的位置。
  - 图里的汇总框可以改为「四种检查失败：原因一栏相同」。

### P2

**P2-1 「404 另有原因」的排查清单漏了两种常见来源**
- 位置：第 208 行（404 情况列表）、第 224 行（「要回去查借用编号、来源身份、心跳和重启」）、对照源码里的示例 Planner 表（第 359–367 行）。
- 问题：
  - (a) 来源 A 退出时会主动注销：进程 atexit 走 `session.py#L62` → `shutdown` #L486 → `_stop_seed_service_locked` #L450 `planner.remove_seed()`。示例 Planner 的 `remove_seed` 会「reclaim all of its leases」（`rfork_planner.py#L231-L246`），B 之后再还就是 404。这是扩缩容、重启 A 时最常见的情形。
  - (b) 前一次还租约其实已经生效，只是回应超时（requests 超时 → RETRYABLE，#L151-L155）。30 秒后重试时，Planner 已经删了这份租约，回 404。第 208 行列了「还第二次」，但第 224 行的排查清单没列。可以用结果日志里 `attempt=2/3` 或 `3/3` 来区分。
- 改法：第 208 行和示例 Planner 表各加一条「来源注销（remove_seed）连带删除租约 → 404」。第 224 行的清单补上「来源 A 是否退出或注销」，以及「看 outcome 日志的 attempt 是否大于 1（前次已生效、回应超时）」。

**P2-2 400 / 404 一节重讲了 rfork-lifecycle 已有的机制，且没有带上那里记的现场证据**
- 位置：第 198–213 行，以及第 134、204 行只链到 `rfork-lifecycle.md` 页面。
- 问题：三类分类表、404 只是「按约定当作还了」、400 本身不证明过期，这些已在 rfork-lifecycle「还租约：一个后台线程，三种结果」「400 和 404 各说明了什么」两节（lifecycle 第 145、169 行）讲清楚了，本页又整段重讲了一遍。lifecycle 第 186 行还记了一条与本页直接相关的现场信息：现场 Planner 还租约回 400，日志没留响应体；拿编造的借用编号去试，回复是「找不到这个编号」。本页第 213 行和第 251 行只写了「取决于它的实现」，旧版给现场 400 列的候选（标了推断）也整体删掉了。用现场 Planner 的读者在本页拿不到可用的候选方向。
- 改法：
  - 分类和 400、404 的语义压成一句，再加节锚点链接：rfork-lifecycle.md#还租约一个后台线程三种结果、#400-和-404-各说明了什么。
  - 本页只留排错特有的内容：示例 Planner 400 的四个请求头条件、held_elapsed 判 404 的 calc、不要做清单。
  - 第 213 行补一句：现场 Planner 有过「编造编号也回『找不到』」的记录，所以现场的 400 可能包含编号找不到。候选（编号不存在、身份不符、另一份内存状态、重启）标「推断」，并链到 lifecycle 那一节。

### P3

- **P3-1 链接粒度**：第 125、127、128、152 行链到 rfork-startup / rfork-identity，第 134、204 行链到 rfork-lifecycle，都只到页面级。写作记录说当时这些页还在改；现在可改成节锚点，例如第 134 行「当来源延后」链到 rfork-lifecycle#发布-seed已启动延期失败。
- **P3-2 偏 meta 的句子**：第 234 行「知识库不会因为……就编一个阻塞栈出来」、第 245 行「诊断记录可以留作问答来源页……」，是写给知识库或问答系统的规矩，不是写给读者的排错内容。建议改成面向读者的说法，例如「不要因为日志里出现『还租约』，就推断阻塞在还租约上」；第 245 行可以删，或移到维护页。

### 跳过

- frontmatter 的 sources 区按规定没读，由 audit 校验。
- 对照源码一节只用 grep、脚本比对，加上读了表格行（第 346–367 行）。「怎么开」「开销和什么时候别开」「源码位置」的正文没读。
- 没有被拦截的读取。

## P5 修订记录（2026-10-02，Opus 写手，回应「P5 审查」）

**P1-1（成立，已改）**：「四种失败一字不差」只对返回 False 的检查分支成立。核过源码：`transfer_from_seed`（session.py#L108-L136）没有 try，#L114-L116 注释写明传输调用会 raise；loader #L652-L655 接住后只把 `str(e)` 填进汇总，前面没有单独日志。已知抛出点逐个核实：`build_seed_url`（session.py#L123，在 `fetch_seed_transfer_info` 的 try 外）→ seed_client.py#L25-L54 七处 ValueError；`_tensor_storage_owner`（transfer_backend.py#L338 → #L175）；同名不同形张量 tensor_layout.py#L149-L152（登记 #L309、读前 #L643 调用）；`iter_transfer_chunks` #L128、#L132；`batch_transfer_sync_read` #L760 无 try，`_engine` #L238-L241。另核：`fetch_seed_transfer_info` 自身异常在 seed_client.py#L151-L153 被接住并记 error，不属于抛出分支。改动：
- 直觉图改成两条路：检查没通过（先记具体异常 → 汇总原因 = transfer failed.）与任何一步直接抛异常（汇总原因 = 异常原文、前面没有具体日志），图说同步重写；在 5193 上用 `pnpm wiki:figshots` 看过（test-results/figshots/rfork-troubleshooting-1.png），无溢出无重叠。
- 第一节图后改写，并新增读者规则：先看汇总的原因一栏，只写 transfer failed. 就往前找一行，写别的就是异常本身。
- 常见误解第 1 条、frontmatter summary 同步改正。
- 对照源码「汇总里的 %s」改为两条来路，列出全部抛出点的文件 + 行号。

**P2-1（成立，已改）**：(a) A 退出时 `atexit.register(self.shutdown)`（session.py#L62）→ `shutdown` #L477-L486 → `_stop_seed_service_locked` #L427-L450 调 `planner.remove_seed()`；示例 Planner `Store.remove_seed` 删除该来源的全部租约（rfork_planner.py#L231-L245）。(b) 请求超时 → RETRYABLE（planner_client.py#L151-L155），30 秒后重试若 Planner 已删租约则 404 → RELEASED。正文 404 来源改为七种的编号清单（含这两种），情形一之后的排查顺序补上「看是第几次尝试、前一次是否请求超时」和「来源 A 是否退出或撤销登记」；对照源码示例 Planner 表加 remove_seed 一行，客户端表 outcome 行补重试拿 404 的说明。sources 追加 rfork_planner.py#L231-L246、session.py#L55-L63 等 5 条。

**P2-2（成立，已改）**：三类分类与 400/404 语义压成一句，链到 rfork-lifecycle.md#还租约一个后台线程三种结果、#400-和-404-各说明了什么（锚点 lint 通过）。本节只留排错特有内容：被拒≠加载失败、示例 Planner 400 的请求头条件、现场 Planner 400 的候选（补上 lifecycle 记录的「编造编号也回『找不到』」现场记录，候选标推断并链到 lifecycle）、404 七种来源、held_elapsed 判 404 的 calc、不要做清单。另：写作记录里「旧版 P1 级错误」的措辞接受审查意见，旧版那份候选是未绑定示例 Planner 的泛化推断，说重了。

**P3-1（已改）**：「第一遍读日志」表改链节锚点：rfork-startup#十步各做什么做完手里有什么、rfork-identity#没借到要分清钥匙没算出来匹配不到还是根本没问成、rfork-startup#没有可用-seed有三类来源要靠旁边的日志分开、rfork-lifecycle#发布-seed已启动延期失败；「明明有来源却没借到」一节链 rfork-identity#部署指纹里写了什么。
**P3-2（已改）**：「知识库不会……编一个阻塞栈」改为面向读者的「不要因为日志里出现了『还租约』，就推断启动阻塞在还租约上」；「诊断记录可以留作问答来源页……」整段删除。

**验证**
- 本页：`pnpm wiki:lint` 0 报错 0 提示；`pnpm wiki:diagrams --check` 退出码 0（290 张图与 spec 一致）；`pnpm wiki:audit` 退出码 0，本页 25 条来源全部 ✓。写作标准（本页尚未进名单，用 checkStandard 单页自测）：5967 字，行内代码 0、角标 0、对照源码 ✓、calc 0.17/千字、相邻块 0、图先行 ✓、免责 0.7%、图宽 ✓，全 ✓。
- 全站 `pnpm wiki:lint` 退出码仍非 0：3 处报错都在 params/enable-sleep-mode-extra-cleanup.md（[mark-index] 角标越界），是别的写手的页，按纪律没动。

## P5 复审（10-02）

复审日期 2026-10-02，Opus 复审员，只审未改页面。基线同上：RFork 工作版 rfork@3284850b（本仓 `rfork/source/`）。

### 结论

- **分数：9.0 / 10**（P1 0 条，P2 0 条，P3 3 条）。上一轮的 P1-1、P2-1、P2-2、P3-1、P3-2 全部确认修好。
- **audit：通过。** `pnpm wiki:audit` 全站退出码 0，本页 25 条来源全部 ✓（审计 139 页，无效 commit / 文件不存在 / 行号越界都是 0）。本页不在 standard-pages.json 名单里，按名单口径用 `checkStandard` 单页自测（临时脚本放在复审会话 scratchpad，跑完已删）：5967 字，行内代码 0.0/千字、角标 0、对照源码 ✓、calc 0.17/千字、相邻块 0、图先行 ✓、免责 0.7%、图宽 ✓，problems 为空，**全部 ✓**。`pnpm wiki:lint` 退出码 0，本页 0 报错 0 提示（跨页锚点硬校验通过）。
- **浏览器：通过。** Playwright 桌面宽 1440 只读访问 http://localhost:5193/#/wiki/rfork-troubleshooting，没起停服务。h1 正常，控制台 0 错误。改过的直觉图：viewBox 900×430，SVG 文字没有越界；两条路（检查没通过 → 汇总原因只写 transfer failed.；任何一步直接抛异常 → 汇总原因是异常原文）都能看清，虚线从四步框右侧引出，不和第二排交叉。点击「400 和 404 各说明了什么」跳到 rfork-lifecycle 对应 H2，标题停在视口顶部 16px。截图在复审会话 scratchpad：`rfork-troubleshooting-recheck-1.png`（第一屏）、`-2.png`（直觉图）、`-3.png`（400/404 一节）、`-4.png`（跳转后）。
- 对照源码五个 H3 齐全、顺序正确；「版本差异」里 v0.23、v0.26、main 都在；对照源码之上没有证据角标。

### P1-1 复核：哪些失败走「transfer failed.」、哪些直接抛异常（逐个分支对源码，结论成立）

- loader：`rfork_loader.py#L623-L624` 在 `transfer_from_seed` 返回 False 时抛 `RuntimeError("transfer failed.")`；`#L652-L655` 接住任何 Exception，把 `str(e)` 填进汇总。`#L563` 的外层 try 从建会话、造模型就开始覆盖，所以「建传输后端或造模型时出错走第二种」成立。
- `session.py#L108-L136`：没有 try；#L114-L116 的注释写明传输调用可能 raise。#L110-L112 没有租约时先记 error 再返回 False，也属于第一种。
- 返回 False 的分支前面都有 error 日志，逐个核过：登记 `transfer_backend.py#L291-L344`、#L359、#L373、#L407、#L424/#L433/#L442；要元数据 `seed_client.py#L101-L152`（连不上也在 #L151-L152 接住记 error，所以图里「要清单失败：连不上」放在第二排是对的）；核清单 `manifest.py#L175-L264` 每个 `return None` 前都有 error；读前检查 `transfer_backend.py#L638-L707`；形状对齐 `tensor_layout.py#L37`、#L43；分批读 `transfer_backend.py#L767-L775`。#L300 的 return False 前面没有直接的 error，但调用的 `_unregister_weight_blocks` 自己记日志，不影响结论。
- 直接抛出的点逐个核过：`build_seed_url` 在 `session.py#L123`，位于 `fetch_seed_transfer_info` 的 try 之外，`seed_client.py#L28/L35/L37/L39/L41/L51/L54` 共 7 处 ValueError；客户端拿租约只查 `parsed_port <= 0`（`planner_client.py#L96`），所以 SEED_PORT=70000 会一路走到这里，页面的例子成立。`_tensor_storage_owner`：`transfer_backend.py#L338` → #L175，外面没有 try。`tensor_layout.py#L149-L152` 的同名冲突 ValueError：`collect_transferable_tensors` 在 `transfer_backend.py#L309`、#L643 被调用，#L696 也调了一次（页面没列，同一类异常，不影响结论）。`iter_transfer_chunks`：#L748 → #L128、#L132。`batch_transfer_sync_read`：#L760，外面没有 try；`_engine` 在 #L238-L241 抛错。
- 正文第 88、90 行，常见误解第 277 行，对照源码第 321–323 行，frontmatter summary，图的 caption 和两个汇总框，都已经改成「检查没通过 / 直接抛异常」两条路，和源码一致。

### P2-1 复核：404 清单新补的两类（成立）

- 第 5 种「来源注销」：`session.py#L62` 用 `atexit.register(self.shutdown)`；`shutdown`（#L477-L486）调用 `_stop_seed_service_locked`（#L427-L450），心跳线程按时停下后，在 #L450 调 `planner.remove_seed()`。示例 Planner 的 `Store.remove_seed`（`rfork_planner.py#L231-L245`）会删掉借这个来源的全部租约。
- 第 4 种「重试拿到的 404」：`requests` 异常归为 RETRYABLE（`planner_client.py#L151-L155`）；重试间隔默认 30 秒（`config.py#L15`，`session.py#L214` 的 wait）；每次尝试都记 outcome（`session.py#L190`，结果字段用 `result.name`，所以日志里是 `attempt=2/3 result=RELEASED`），对照源码表第 364 行和这一致。
- `put_seed` 路由（`rfork_planner.py#L468-L484`）的 404 只有一个出口：`Store.put_seed` 返回 False（#L218 先 GC，#L219-L223 查不到或身份不符）。七种来源都会落到这个出口，没有漏掉别的 404 分支。第 234 行「情形一」之后的排查顺序已经补上「第几次尝试 / 前一次是否请求超时」和「来源 A 有没有退出或撤销登记」。

### P2-2 复核：400/404 一节已压缩并链出（成立）

- 第 205 行用一句话交代三类结果和「404 只算按约定还了、400 不证明过期」，然后链到 `rfork-lifecycle.md#还租约一个后台线程三种结果` 和 `#400-和-404-各说明了什么`。两个锚点分别对应 lifecycle 第 145、169 行的 H2，lint 跨页锚点校验通过，浏览器点击也跳对了。
- 本节只保留排错特有的内容：被拒不等于加载失败、示例 Planner 400 的请求头条件、现场 400 的候选（和 lifecycle 第 186–188 行的现场记录一致，标了推断）、404 七种来源、held_elapsed 的 calc、不要做清单。
- 旧版信息清单 F15、F16、F18 在新版第 205、209–211、236 行都还在。

### 抽查 8 条「现象 → 原因 → 怎么办」（0 错）

1. 第 121 行：「没借到」只有 TP 序号为 0 的 Worker 按 INFO 打（`rfork_loader.py#L73-L75`、#L647），Planner 回 404 只记 debug（`planner_client.py#L77-L79`）。✓
2. 第 123 行：日志里租约那一栏是借用编号的 SHA-256 前 12 位（`planner_client.py#L25-L27`）。✓
3. 第 153、199 行：分批读按顺序同步进行，第一次失败就返回，所以第 1 到 k−1 批已经写入；日志原文 `Failed to transfer weights chunk %d/%d, first: %s, last: %s, ret=%s`（#L767-L775）逐字一致。✓
4. 第 157 行：申请来源时，404 只记 debug；非 200、头不全、端口 / rank 非法都进 except，记 warning `RFork planner seed acquisition failed: %s`（`planner_client.py#L69-L109`），页面第 306 行原文和行号一致。✓
5. 第 189 行 / 表第 346 行：`TransferEngine memory registration raised for batch of %d logical regions: %s`（`transfer_backend.py#L424-L425`）逐字一致，按「检查没通过」处理（#L445 return False），归类正确。✓
6. 第 191 行：finalize 只在错误码等于 not-ready 时 sleep 后重试，其他错误码直接 return False（`transfer_backend.py#L598-L613`）。✓
7. 第 98 行 / 表第 316 行：清理失败时安全门抛 RuntimeError，拒绝分配第二份模型（`rfork_loader.py#L667-L671`），原文由两段字符串拼接，和页面逐字一致。✓
8. 第 213、225–234 行：`put_seed` 先 GC 再查；租约在 `now - leased_at >= ttl` 时收回（`rfork_planner.py#L279`），TTL 默认 60 秒，可用 `--lease-ttl-sec` 或环境变量改（#L39、#L73、#L565）；held_elapsed 从 `acquire_seed` 之前取的 monotonic 起算（`session.py#L77`、#L81）；还租约在读完后立即触发（`session.py#L137-L148`），所以第 271 行「要在到期前读完」成立。情形一、情形二的推理成立；情形二写的是「候选之一」，没有把推断写成定论。✓

另核：第 209 行「按源码对照…不该出现」标明了是从源码推出的；第 211 行现场候选标了推断。没有发现把推断写成定论的地方。

### P3

- **P3-1 「往前找紧挨着的那一行」在一种情况下不准**：第 88、90 行和图的汇总框说，原因一栏只写 transfer failed. 时，紧挨着的那条就是具体异常。但登记失败而且回滚也没做完时（`transfer_backend.py#L431-L445`），紧挨着汇总的是「RFork registration rollback is incomplete…」，原始的登记报错在它前面；多 rank 混在一起的日志也会插进别的行。改法：第 90 行改成「往前找这个 rank 的第一条具体异常（登记回滚没做完时，紧挨着的是回滚日志，原始报错还在更前面）」。第 127 行「紧跟的第一条异常」的说法本来就是对的。
- **P3-2 「七种来源」写成了穷举**：示例 Planner 如果部署成多副本、前面挂负载均衡，归还请求落到另一个副本也会回 404，和第 159、211 行讲的「另一份内存状态」是同一类。可以并进第 7 种，写成「Planner 重启过，或请求落到了另一份内存状态」。另外第 5 种「进程退出时会自动收尾」只覆盖正常退出（`atexit`）；被强杀时走的是第 6 种（心跳超时），可以补半句。
- **P3-3 图的 caption 可以更完整**：caption 只写了「建传输后端或造模型时出错走第二种」。实际上 #L563 的 try 还包住了建会话、算配对键，以及读完之后的后处理（#L631-L633）；这些抛错也是「汇总原因 = 异常原文」。补一个「等」字，或者在对照源码第 323 行列全。

### 跳过

- frontmatter 的 sources 区按规定没读，由 audit 校验。
- 对照源码一节只读了第 318–325 行（汇总两条来路）和第 364、372–385 行（还租约与示例 Planner 表），其余只用 grep 核对。「怎么开」「开销和什么时候别开」「源码位置」的正文没读。
- 页面第 106–119 行的 text 代码块（报问题模板）按规定跳过。
- 没有被拦截的读取。

- **P5 复审 P3 修订（2026-10-02，Opus 写手）**：三条都成立，已改。P3-1 第一节改为「往前找这个 rank 的第一条具体异常」，并写明两种例外：登记失败且回滚没做完时紧挨汇总的是回滚日志（transfer_backend.py#L431-L445），以及多 rank 日志交错；图说同步改。P3-2 第 5 种补「正常退出才收尾，被强杀走第 6 种」，第 7 种并入「多副本、落到另一份内存状态」。P3-3 图说和对照源码补全 #L563 try 里的抛出来源：建会话、算部署指纹（rfork_loader.py#L441-L476）、读完后的后处理（#L631-L633）。验证：wiki:lint 退出码 0、wiki:audit 退出码 0（本页写作标准全 ✓，6091 字、免责 0.7%）、wiki:diagrams --check 退出码 0。图只改了图说，版面没动。
