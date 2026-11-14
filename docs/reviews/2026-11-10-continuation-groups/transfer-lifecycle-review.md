# 传输生命周期独立补审（本组已验收）

审查者 `/root/groups_replay_review`，2026-11-10。依据 `docs/wiki-writing-standard.md`；本组不改教学正文。前批72引文已经另案封存，本组继续处理页面尾部未闭调用链，不能以旧队列清零宣布全站完成。

## 最终结论

三页修订已按本组范围接受，当前 P1/P2 未关闭项为 0。96 条主张—来源映射逐项有人工判断：86 条新增引用（Mooncake 63、逐层池 23），10 次复用，其中 9 次为既有引用、1 次为本批 MC127 供失败语义再次引用；唯一页面/来源编号共 95 个。不是 96 篇官方资料，也不重计前批72条。逐条结论见 `transfer-lifecycle-manual-judgments.json`，原始手写判断保存在 `.tmp/continuation-groups-2026-11-10/transfer-lifecycle/manual-judgments.tsv`。

核对的最终文件 SHA：Mooncake `e056c4fba4c6ae3b9c0b2c4ae0298a237633babc21bf04eaf6d618d778e2b140`；逐层池 `b439ec4ef3c174aab9e55e40c8f8a960fb6fb3128754fc2a05693ce8edd79324`；PD `c490e510f61b747aab3d37a235ce23504f1a0b323fe0d862fe76933f417d77c5`。最终接受、阅读、保留与工程证据分别见 `transfer-lifecycle-final-acceptance.json`、`transfer-lifecycle-reading.json`、`transfer-lifecycle-preservation.json`。

| 事项 | 独立结论与影响 | 状态 |
|---|---|---|
| 固定 GLM 的点对点 Layerwise | db 的 NPU runner 交出完整缓存名称；同一 MLA 物理层含主缓存、indexer K、尾状态多个名称，Layerwise 注册断言一层只能一个名称。 | P2已关闭：正文与报错节已明确初始化条件；CPU原循环复现不冒充设备首条日志 |
| 固定 GLM KDA 实际实现 | worker 注册 OOT；0.23 条件下旧 Kimi 类名被 AscendKimiGatedDeltaNetAttention 替换，其完整659行实现无逐层wait/save。 | P2已关闭：实际构造、custom op回调、计算路径均核对；不再按导入名误判 |
| 四版 KDA | 2c无此Ascend文件；db/v0.26旧类无hook；main/rc2 Kimi K3由decoder直接构造，均有wait/save。 | P2已关闭：rc2 549行wait写入正文，历史“无wait”由本报告明确否定；不反推旧GLM支持 |
| GLM V1 注册区间数 | 固定TP8/PP1/一个MTP：12大槽+12小槽，Mamba分支按非空原始张量登记24段，小于256。 | 数量源码缺口已关闭；地址、2MiB对齐和登记成功仍缺设备证据 |
| 旧Layerwise同步 | 后台等设备事件再同步网络写；空wait_for_save、空sending集合，请求结束不押块；最后回调通知D。 | 文字已区分源码缺失与未测竞态，不再用设计文档意图代替同步链 |
| 新版复用门 | 指定组合以物理槽事件接入AscendStore；v0.26的GVA门和main/rc2 worker逐层门分开核，空加载入口也等。 | 已正确写入；保存顺序/事件关闭时点明确，不等同V1请求级押块 |
| main V2真实pull | 全读main四个控制/worker文件，核到按层名/PP/TP/spec组织真实同步读、结果汇合及P释放。 | 源码阅读缺口已关闭；840上游只是比较点，非已实装组合 |
| V2失败语义 | main多组失败只告警仍报finished；rc2失败位经connector、NPU runner、worker汇合进入ced scheduler，默认fail、显式允许才recompute。 | P2已关闭：正文新H2及PD回链准确；CPU原run()故障注入只验证完成记账 |

精确证据在 `transfer-lifecycle-evidence.json`：8组96范围、完整commit与文件SHA。阅读范围在 `transfer-lifecycle-reading.json`，方法级比较在两份comparison记录。范围条目不是官方全文数量；本组新增官方整篇与技术图阅读数均为0，复用已有母页的实际阅读，仅对新主张重核源码。

## 历史错误处理

`layerwise-review.md` 曾写rc2 KDA“完整搜索未发现wait”，改前页面也采用此结论。本组直接读取固定7d源码530–563，549行实际调用wait，且位于读state前。历史文件保留，但该错误判断已由本报告、当前正文与逐项来源76取代，不能继续当成正确证据。rc2保存入口718/741仍成立；新增wait不推导完整GLM支持。原阅读manifest中的extracted_not_read是下载当时的历史状态，实际阅读范围以当前reading和manual judgments为准，不能用下载记录冒充阅读。

## 信息保留清单

逐项保留表已核旧Mooncake定义、P/D方向、三组钩子、地址例子与字节/块范围、TP头数比、4.5/3.5示意、480秒V1押块及角色、连接器/Store区别、GLM5组和有效字节、PCP断言、错配及设备未测限制。新24段回链既有GLM布局，没有重造KV容量公式。

逐层池原2/3/2ms、28/16与21/36/22条件、32层224/100、8P→3P与37.5%、预留容量≠实传流量、prefill/eager/Memcache约束、rc2失败与队列排空边界全部保留。三页旧来源前缀84/53/110不变；全部10个calc块逐字保留；9图共18个SVG/YAML与前批checkpoint相同。PD改前采用根助手最后calc修订版a32c…，不误用研究启动时更早的1279…快照。

## 浏览器与工程证据

独立浏览器实际打开5201三页，阅读前两屏、9张静态图、10个calc、新正文与版本表。首屏能够复述：Mooncake负责两实例块号对照与按层搬运，代价是握手/传输、双份占用与失败清理；逐层池把外部存取拆成每层以遮等待，但不减少字节，需要带宽和共享槽完成条件；PD将prefill/decode分给独立实例，以交接等待和更多资源换取职责分离。不是仅依据截图生成成功作结论。

6个回链实际点击：MC→逐层共享槽、逐层→MC生命周期、PD→MC V2、MC→GLM单一布局、逐层→MC GLM条件、MC→逐层源码。目标标题都出现在距顶约108px处；3页runtime error=0，document overflow=0，哈希前后稳定。MC版本表有合法内部滚动，实际向右滚443px并查看main/rc2列，没有把被裁截图当完整表验收。记录与截图在 `.tmp/continuation-groups-2026-11-10/transfer-lifecycle/review-replay-final-browser/`。PD 3D loader为其他会话内容，未播放、未计作图验收。

旧图与新文无机制矛盾：首图的P释放限定V1；hooks图分别写V1押块/Layerwise不押，空sending集合由新段解释；逐层4.5/3.5是正常无争用到齐时间，未宣称网络完成与P释放已同步；逐层池流程图写正常完成条件及旧超时例外；PD流程图明确是V1，失败通知和成功放行分开，不能套用main V2多组失败漏洞。新增普通语言段没有源码角标，版本钉点及精确调用范围留在源码区。

根助手执行的5项检查记录为 `.tmp/continuation-groups-2026-11-10/lifecycle-current-checks.json`；本审查独立读取关键输出并核对日志SHA、exit code及3页最终SHA：content、lint、audit、diagrams、build均0。content164页，audit7679来源/7205有效行号/474URL未联网/3937raw机械待核，104标准名单通过；344图spec一致；build5.95s；lint另有10条非阻塞提示。这些机械结果不代表全站所有引文语义完成。逐层页verified保持原值：本组核rc2新增链路，未声称重新认证全页所有旧主张。

## 范围外尚未关闭

本组没有NPU/GPU部署、精度、时延、容量峰值或真实网络故障恢复结果。原生产文章3张缺图仍未取得，完整Mooncake SDK/TransferEngine及所有目录后代也没有声称读完。以上不属于已关闭的源码调用链缺口，不以本组验收宣布全站完成。
