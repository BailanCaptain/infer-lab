# 逐层 KV 卸载本段验收

本段闭合一页三图、34 个冻结旧来源出现项和19个新增补证；不是34篇全文，也不是全部缓存组。独审与判断分别见 [layerwise-review.md](layerwise-review.md)、[layerwise-judgments.json](layerwise-judgments.json)。活动旧队列由1073减至1039，仍包括221项前批补证待落最终记录。

补齐了执行流程、Memcache依赖、代理回连、角色冲突、共享P eager条件，以及联合RD2H的物理槽读完与请求终态两种门槛。修正理想重叠与常规性能混淆、旧末层完成事件不保证前层成功、main文件有KDA hook不等于实际注册、GLM KDA 2.5MiB页容量不等于传输量。rc2新增的队列排空与仅空参数save行为已独审复核。原数值、误解和未实测问题保留，见保留清单。

34项：23有条件支持、4修正主张、4补证、2背景、1同版本重复。19新增来源分别判断，不计入旧队列完成量。旧独立指南241行全文刷新读取；v26 RD2H设计248行以及后续组合指南复用本轮实际全文阅读，详见sparse官方阅读记录，不能重复增加全文数量。

五项最终检查中check:content、wiki:audit、wiki:diagrams --check和build通过；wiki:lint仍是用户明确暂缓V2的3处阻塞，另9条非阻塞提示。机械审计164页/6751来源、6348有效行段、403 URL未联网、3006 raw机械待核；104/104写作标准名单页通过。结果见 [layerwise-verification.json](layerwise-verification.json)，语义判断不来自这些机械数字。

作者实际检查前两屏、3图、3表、4个算式及新增段落，点击4个跨页链接；独审独立检查并点击5链接，pageerror均为0。新增流程图880×690，未发现文字与箭头重叠。最终rc2措辞已由独审在重新生成索引后实际查看。浏览器证据位于.tmp/continuation-groups-2026-11-10/browser/layerwise*及layerwise-independent/。

学习路径可解释：预取数为什么包含本层、只开逐层为什么未必省HBM、共享槽何时能覆盖、P写完为何仍可能等D、旧版超时与rc2排队等待区别、GLM基线为何不能照抄新配置。无NPU，未测实际带宽、性能、GLM接入或KDA传输布局；这些待核仍保留。无须用户决定，继续KVPP、UCM与重算余项。
