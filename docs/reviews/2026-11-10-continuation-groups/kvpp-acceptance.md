# KVPP 本段验收

本段闭合一页三图、38个冻结旧来源出现项与7项新增补证；独审见[kvpp-review.md](kvpp-review.md)，逐项结论见[kvpp-judgments.json](kvpp-judgments.json)。活动旧队列由1039减至1001；新增7项不抵扣旧队列，不把38项说成38篇全文。

修订覆盖每段缓冲额外2MiB、短PP段不保证增容、MLA/native与SFA融合等待位置、Memcache角色与异步配置、跨PP/TP命中、TTFT与容量测试条件，以及新Mooncake客户端接口前提。新增短段24→16块反例，原8层4卡示意、GLM条件化账单和官方测量全部保留。LayerSplit的SGLang实现与Ascend KVPP分开解释。

独审无P1，1项P2及4项P3全部复核关闭；45项语义逐项阅读，旧38摘录一致、raw30/30段一致。最终页SHA256为7b29db698555b61f5240139fe23abbea51e9cedb6d8560b15d7ac2b6d332902e。作者与独审分别实际查看3图、5表、4个算例，作者点击4个跨页入口、独审5个，浏览器pageerror均为0。新增多行JSON可完整显示，版本表与图脚注无裁切。

八份固定官方文档的实际范围及同文复用关系见[kvpp-official-reading.json](kvpp-official-reading.json)；Z.ai生产文章全文和5张技术图实际查看。文章支持其自身SGLang案例，不证明Ascend存在同样故障或收益。被链接组件的完整实现审计与P/D尾项继续分账。

最终check:content、wiki:audit、wiki:diagrams --check、build通过；wiki:lint仍仅有用户暂缓V2的3处阻塞及9条非阻塞提示，见[kvpp-verification.json](kvpp-verification.json)。机械审计164页/6758来源、6354有效本地行段、404未联网URL、3012 raw待机械外语义核验；104/104标准名单页通过，不把这些机械结果当作语义结论。

Z.ai官方单页按既有精确路径规则加入发布来源，未放宽整个域名。先复现精确URL未识别的失败测试，再运行来源及lint单测106/106通过，独审单独48/48通过；两处修改脚本的Biome检查、类型检查和构建通过。单测进程打印既有Vite关闭超时提示，但测试均通过并正常结束；记录位于.tmp/continuation-groups-2026-11-10/kvpp-source-{red,green}.log。

学习路径可解释：副本域如何确定、增加两块暂存为什么可能反而减容、谁等待哪次广播、组合池化要补哪些配置、GLM为何不能照抄非hybrid示例。没有NPU，未运行容量、性能或精度实测。无须用户决定，继续UCM和剩余全站任务。
