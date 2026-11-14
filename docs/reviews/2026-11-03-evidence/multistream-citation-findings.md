# multistream_overlap_gate 逐项核验增量

37 项来源逐条判定，旧 raw 包的 26 个代码块逐字匹配本轮已读原始范围，单列为归档而非新证据。本文、YAML、SVG 比较本轮修改前快照的精确差异见 multistream-citation-remediation.diff；没有用 HEAD 覆盖既有改动。

主要 P2：初始化 info 日志只能证明配置分支，不证明设备重叠；两个 stream 不能推出两个独立显存池；prepare 的量化和 scale AllGather 在当前流，hidden AllGather 才在 quant_stream；gate 路径也可能收集选专家结果。理想 A+B 与 max(A,B) 保留独立工作假设，移除“小 decode 最大、长序列趋零”等无实验依据的保证。

额外 P2：310P 的三字段 False 只在非 vLLM 0.23.0 的 AscendMoERunner310 构造器。已读 2c 固定文件 143–259 与 310–367：legacy 类另有前向，先算路由专家再算共享专家，不能把新 runner 的赋值概括成所有 310P 都静默通过。LoRA 检查之前还有共享专家检查，故不能保证同开时必见旧文那一条错误文本。

已实际读取 main/rc2 严格未知键工厂及 Omni 警告过滤分支、两个真实量化消费者、v0.23 legacy 导入与 context 优先级、GLM db 的路由和 MC2 补齐切片；R1 的 4 行路由与 1 行隐藏态不匹配只作源码推导，具体下游错误、输出或性能未在 NPU 验证。PR 4065 与 11956 作者正文和对应引入/移除代码补丁已读；4065 图片未视觉检查，不把作者图片当作本轮已读性能实验。

图仅做定向 SVG 生成和文本/范围静态检查。本页无框内文本溢出；当次全图检查因另一个 agent 的两个在途 Dyntra SVG 未生成而失败，不能记全图通过。未作 UI、NPU 或部署验收。P2 整改待独立 agent 复核。
