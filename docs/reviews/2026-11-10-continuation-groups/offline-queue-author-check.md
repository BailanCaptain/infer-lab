# 离线队列增量作者自查

状态：作者已冻结，等待根助手独立审查和统一工程检查；不能据此标成全站或第 93 项全部完成。

新增教学解释回答提交与等待的分工，明确默认后台进程已可计算、进程内等待逐步推进、等待全部而非 ID 子集、按编号返回、加入失败取消本次已加入请求；以 3+2 共 5 条示意并保留 level 0 从清醒空闲引擎开始的局部前提。四版对照列出 v0.26 起 wake 的内存检查和 rc2/main 完成暂停同步设备。原 GLM HTTP 七站及旧五图不变，详见 preservation。

来源从 55 个候选中选 47 项实际所需范围进入 94–140；`offline-queue-additions.json` 保留候选编号、语义结论、摘录 SHA、来源映射，`request-offline-queue-reading.json` 明确全母页复读／选段／完整差异复用。没有新增全文阅读数量，没有 NPU/GPU 生成、DP 暂停、吞吐或峰值内存实测。来源本身 no-start 的注释与默认 MP 消费者不一致，以实际发送、后台循环和进程内入口区分解释。

实际浏览器运行 `node .tmp/continuation-groups-2026-11-10/review-offline-author-browser.mjs`，1440×1100。先查看前两屏，随后查看新概念、算例、调用片段、错误、版本、来源；全部 6 张图、1 个 calc、11 张表均独立截图并由作者实际逐张 view_image 阅读，共 26 张截图。正文可读、四版表无裁切，新图能看出后台与进程内驱动差别，旧图保持可读。实际点击新增“进程布局”“进程开关”“异步调度”三处回链，均到预期页面与锚点。报告 stable=true，errors=[]，overflow=false，tableOverflow=0，brokenImages=[]。

单页使用现行 measureStandard / standardProblems 和现有规则检查：教学口径 5700 字，行内代码 57 处、10/千字，源码区前证据标记 0，calc 1，免责句 1/172（0.5814%），sourceSections/diagramFirst 为 null、stacked/wideDiagrams 为空、problems=[]。原始 Markdown 不含 frontmatter 的教学部分 11543 字符、含源码正文 27036 字符，行内代码分别 57/262；两个口径不混算。首图前 calc=0，无新增角标干扰正文。

新图第一次生成因 tone=label 非法失败；改成现有合法 ink 后 `pnpm exec tsx .tmp/continuation-groups-2026-11-10/review-offline-render.ts` 成功，figureProblems=0，只生成本图。保留脚本第一次因 Windows 路径比较把正文误纳入图哈希检查而失败；修正路径归一化后旧 10 图文件哈希逐项一致。未修改产品代码或放宽规则。

冻结指纹：

- request-call-chain.md：`329033532db9d45d074dae399c63ad8f417952bfb1c40ab49a95ae6202a5381a`
- request-offline-queue.yaml：`ad6a2bbf2f0106596ae63733dfa9e381eb2b51cd944469f29019066229be79b6`
- request-offline-queue.svg：`66f1cf7ab60d1655ad9e0cf7fc9bdb702d995fd00eeaf114375b9e3006779861`
- `.tmp/continuation-groups-2026-11-10/offline-queue-author.zip`：`30265eab4914d96eb6bc0300810f6fab4bcc9f2c933a61a129c524e4623055ec`

全站 content/lint/audit/diagrams/build 尚待根助手在并行作者内容稳定后统一运行，不把局部检查写成全站通过。
