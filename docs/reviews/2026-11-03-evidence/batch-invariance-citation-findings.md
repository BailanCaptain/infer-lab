# 批次不变性：逐项核验与整改

38 项逐条见 batch-invariance-citations-batch.json 与组账本；本轮修改前快照保存在 .tmp/doc-gap-2026-11-03/evidence-batch-before，三文件精确 diff 为 batch-invariance-citation-remediation.diff。教学正文与图文字均手工修改，图布局未变。

已确认的 P2 包括：把 GPU 矩阵乘局部 split-K 注释说成整个计算栈唯一差异源；把开关设置或初始化 warning 当作运行保证；把所有自编译算子描述成整体自动回退；把源码未专门拒绝图组合说成必定无错误；把旧融合功能移除写成缺少保护；把官方的手动补装入口遗漏；把默认块大小 128 归因成唯一的前缀缓存／分块开关；以及把提交的请求列表、实际批、生成文本、token ID、已选 token logprob 与完整 logits 混为一谈。

已实际全读 db 指南 1–147、baa 指南 1–228（与 rc2 同文）、db batch_invariant.py 1–163、db→2ed／baa→7d 完整相关差异、Triton matmul.py 1–441、softmax.py 1–29、构建脚本 1–103。测试读取为 1–410 的相关用例范围，含最终 pytest.fail；没有把后续其它测试的截断输出当成全文验收。其余实际范围逐项记录，新增源码每项均做了行界检查。

float32 例用 Python struct 在每次加法后舍入，独立得到左结合 0、右结合 1，结果在 batch-float32-check.json。此为 CPU 数学复现，不是 NPU kernel 或整模型测试。图只修改示意标签与 caption，定向生成后 331 图静态一致；76 项既有 advisory，不代表视觉验收。

修订等待独立 agent 复核。没有执行设备安装、NPU 推理、浏览器或性能验收；GLM mHC 注册风险仍明确保留启动顺序与实机证据边界。
