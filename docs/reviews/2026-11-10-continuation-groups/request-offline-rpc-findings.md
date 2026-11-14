# 离线公共 RPC：与生成内部 RPC 的区别

建议接在 request-call-chain 既有 RPC 主解释／源码区，不重画已存在的 EngineCore→Worker 内部路径。本记录只取证，当前队列 47 项作者冻结正文保持不动。

本站已讲 execute_model/sample_tokens 内部调用，但尚未说明公开 Python LLM.collective_rpc / apply_model。官方离线母页直接链接这两个接口。可以用检查各 Worker 的类名、局部模型类名等小型控制结果说明：前者接受 Worker 方法名或以 Worker 侧对象为首参的函数；后者把每个 Worker 的模型对象交给函数。返回各 Worker 结果列表，不返回生成 token，也不经过一次 HTTP 请求的模板和采样流程。公开默认调用收当前执行器管理的各 Worker，不自动广播到所有 DP 组；前文生成内部调用只读 output_rank 的行为不能套到这条默认公共调用。

需要明确的实际消费者边界：

- apply_model 的函数收到每个 Worker 已加载的模型对象，不能把 TP/PP 分片对象当成未切分整模型。固定 GLM 的 NPUWorker→runner.get_model 还会拆掉 ACLGraphWrapper 外壳，但不会把多卡权重拼回一份。
- 基线 uni/mp 实现实际将 WorkerWrapperBase 传给 collective_rpc 的 callable，未在包装器找到的属性才转发到 Worker；API 层只须讲“Worker 侧对象”，不要承诺其 Python 类型就是 NPUWorker 或模型。
- public timeout 默认为 None。MP 执行器按同一个单调时钟截止时间等待各响应队列，超时会报 TimeoutError；等待超时不撤销远端已执行的操作。rc2/main 将剩余负数钳为 0。
- **UniProcExecutor 虽接受 timeout 参数，当前四版同步公共分支都直接 run_method，没有计时执行或强制中断。** 因而“任意执行器 timeout=N 都保证 N 秒返回”不成立；用户需要控制超时必须先明确实际 executor。
- 未实现的方法、回调自身异常和结果传输失败沿各执行器的异常路径返回；MP 普通公开调用会读取所有响应队列，原内部 unique_reply_rank 的结果收集范围不可套用。
- 回传大数组／张量增加序列化、传输与对象保留开销，宜用小型控制信息；确需数据通道时由调用方单独组织。把张量转 CPU 仍有拷贝成本，不将 introspection 例子写成大权重导出配方。

四版公共签名、engine/client委派、Worker apply_model 和 run_method 字节相同。v0.26 的 uni 同步路径增加 AsyncModelRunnerOutput 取实际结果，MP 把 handle_output 放进异常捕获；rc2/main 内部 MP 增加 EC 汇聚、剩余时间钳 0，Worker 调用拆入 _execute_worker_rpc。正文如只展示简单只读回调，须限定这种公共默认分支，不宣称全部内部 RPC 实现无差异。

`request-offline-rpc-evidence.json` 含 62 个精确候选范围，四版选定函数与基线 Ascend 两级消费者。baseline 全部所列函数已逐行读，全部非空差异已读，rc2 新 helper 完整读，main 相同 excerpt SHA 复用。未声称所下载文件全文已读，不新增全文计数；未调用实际 Worker/NPU/GPU，也未验 Ray/custom executor。
