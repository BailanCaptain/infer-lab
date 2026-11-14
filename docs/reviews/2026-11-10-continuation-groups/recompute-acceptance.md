# 重算与窗口恢复批次验收

本段闭合71个冻结旧来源出现项：recompute-cpu-offload 34、recompute-scheduler 29、swa-bounded-replay 8。新增16项另记：CPU页13、SWA页3。它们不是87篇官方全文；Scheduler前批14项和16项旧补证也不重复充入本批。活动旧队列由964减至893，旧补证的最终逐项账继续单独收尾。

CPU页补齐每主机预算按本地worker相加、与Engram跨DP共享的区别、MultiConnector优先恢复私有尾块、保存计划与真正拷贝完成的区别、完成报告之后还须排队。修正把旧8GiB默认、必然退回P和必然下一轮出token推广到新版的说法。rc2的环形私有块、Mamba接受边界、卷积历史校正与布局错误有独立来源；5行总宽度含2行草稿的示例明确零基编号，不代表实测模型尺寸。新增七站流程图，原主机容量、时延、GLM账单和混合状态未实测边界保留。

SWA页补齐实际回退长度、早期chunk占位行、L1同源扩展/可见设备前提，以及L2的HF输入、CP/EP整除、MTP与confidence输出限制。原近似误差传播、窗口3算例、128/134/140的区别、1000→768→640区间与三张图均保留。Scheduler页在本段未改正文，核对其余调用方、失败分支、版本差异及代理续流边界。

独立审查见[recompute-review.md](recompute-review.md)、[replay-review.md](replay-review.md)，逐项账见[recompute-judgments.json](recompute-judgments.json)、[replay-judgments.json](replay-judgments.json)。确认的问题均已修订复验，无遗留P1/P2；旧来源顺序保留，raw归档28/28、39/39片段与固定git原文一致。归档一致只是完整性证据，不增加语义判断或全文阅读数。

本段实际阅读的指南、RFC、PR、固定源码和图片范围分别在recompute-official-reading.json与replay-official-reading.json。旧指南为312行，rc2指南322行；RFC10820正文559行、PR10742正文239行、PR16510正文24行。相同版本字节复用，版本差异按实际范围补读；未声称全部评论或链接仓库已读。SWA补看论文Fig.3与Fig.4的两个SVG，固定DeepInfer四张PNG另有记录；它们没有关闭生产文章仍缺的三张原图。

实际浏览器覆盖三页七张机制/流程图、七个calc及十张表。CPU/Scheduler独审实点57个内部href；SWA独审实点6个内部入口及新增版本/固定指南。根审查者又查看最终rc2切片段与新流程图。CPU版本表的容器横向滚动已实际操作，非整页溢出；最终pageerror为空，新增内容无裁切。图片与记录位于.tmp/continuation-groups-2026-11-10/review-recompute-browser/、review-replay-final-browser/及root-recompute-browser/。

最后五项check:content、wiki:lint、wiki:audit、wiki:diagrams --check、build全部返回0，见[supplement-closeout-verification.json](supplement-closeout-verification.json)。保留9条全站旧非阻塞提示。此前共享renderer缺失、后续类型错误及遗留workflow锁造成的失败没有改写为通过：锁owner45656确认已退出后，用现有recoverLock检查并恢复，重启本任务开发服务后重验成功；未修改其他会话的3D代码。全站机械通过不代表所有引文、官方外链或教学路径均已核完。

本组的学习路径可回答：让出设备块号时怎样保住旧字节；搬回为什么仍需完成报告；预算为什么还要按本机worker相加；恢复失败是否总能回P；窗口近似恢复与脚本布局等价分别验证什么。没有NPU/GPU实测，未运行质量集、P/D网络或性能测试。无须用户决策，继续全站余项。
