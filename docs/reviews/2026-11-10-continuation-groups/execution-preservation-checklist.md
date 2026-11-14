# 执行组独立审查：先冻结的保留清单

审查者：`/root/groups_replay_review`。范围为6页48个旧引文项；不是48篇官方资料。冻结清单见 `execution-manifest.json`，原始28文件快照为 `.tmp/continuation-groups-2026-11-10/execution/before.zip`。本文件先记录必须保留的教学信息，修改后还须实际对照与浏览器复核。

| 页面 | 必须保留的解释、演算和边界 |
|---|---|
| npu-model-runner | A/C四行→选0/3→2×5词表分数→两个token；前向与采样两次调用、12项暂存及生命周期；零token/PP/pooling/connector分支；异步两处防护与校正时机；GLM TP8×DP2/EP16、MTP3、KDA接受数；BF16条件下1,304,576B≈1.24MiB，不冒称设备dtype实测 |
| npu-worker-lifecycle | 六阶段及EngineCore协调；快照早于HCCL；主/草稿两次权重遍历；14,923.5MiB、304.8GiB、19.05GiB、609.6GiB及非磁盘流量条件；64/0.85/21/3.4/30GiB预算示意；capture4–128；预读None/lazy/eager/prefetch和90%RAM边界；加载器注册与实际可运行的区别；sleep元数据与后处理子模块识别 |
| prepare-inputs-flow | A/C已算5/0、本步1/3、归属[0,1,1,1]、位置[5,0,1,2]、flat索引[5,8,9,10]、边界[0,1,4]、长度[6,3]、槽位[9,36,37,38]、选行[0,3]；恢复请求替换块表；chunk partial丢弃与草稿多行；GDN/FIA padding差别；GLM R1两步与5缓存组；CP不走的部署前提 |
| vllm-engine-core | 同一EngineCore共享循环；同步forward与grammar可重叠；取消双队列幂等、结果更新前处理；3prompt/2answer/4位置算例；批队列精确提前返回条件；DP dummy协作；R1三步1/2/4共7与满载32–128；队列容量不证明异步V1+PP可用；无启动日志/吞吐实测边界 |
| vllm-ascend-for-rl | rollout与训练分工；pause/sleep/transfer区别；wait/abort/keep权重版本边界；物理同卡IPC和跨卡HCCL；1+2=3参与者；main packed缺装载与rc2修正；trainer自动start/update/finish；概率/路由/token-only/工具/DP返回；统一配置不隐式启用所有能力；SparseHCCL/TraceReplay新指南条件；GLM未启用且无训练实测 |
| size-40a1c2ca47b8 | KVPPConfig身份与派生TP×PCP，默认1/不可用户直设；不跨DP/PP；层索引分配与remainder；scratch2、等大层放大L/(ceil(L/size)+2)、60层示例与上限L/3；MTP不分摊；main/rc2 PCP owner差异与运行限制；旧版本字段不存在不等于值为1 |

11张原SVG及YAML已冻结；其它会话3D与应用代码不在这批所有权范围。复审须检查解释去向和条件，而非仅比较数字字符串。

## 最终逐页复核结果

上表6行全部通过。runner原A/C、12状态与1.24MiB条件保留，纠正温度/seed/生命周期，新增MRV2不替代旧GLM走读；worker六阶段与两次遍历、预算假设、90%RAM、sleep/后处理边界均保留，新表的解释移到表后而非删除；prepare完整槽位算例、草稿选行、GDN与CP前提保留，恢复替换已同步到图；engine四圈结构、两圈示意、异步提前返回、7token与32–128范围保留，DP节拍改为带真实条件的承接；RL暂停方式、传输拓扑、packed差异、训练端生命周期及未实测限制保留；size整页未改变。

机械辅助检查也确认：原sources前缀均保留，旧链接目标没有删除，8个calc围栏内容不变；size公式围栏因整页同字节同时保留。9张图未变，2张图只修上述误导文字及恢复分支。最终逐页指纹和浏览器证据见 `execution-final-acceptance.json`；这些辅助结果不代替本段的语义复核。
