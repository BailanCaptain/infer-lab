# GLM 来源基线增量独立复核

root，2026-11-03。完整读取本次精确 diff 与作者逐项 findings，读新增 db 配置 84–122、ModelSlim 810–828 / 67；生成式 chunked prefill 的 1804–1811 已在同轮块分配来源核验中读取。共享专家 DP 的默认与 EP/TP 联合条件，以及描述文件实际加载入口，支持本次修改。它们不证明现场配置未另作修改。

镜像复制层的计数有实际独立重跑证据：先阅读 `check-glm-source-layer.py`，再运行 `python -X utf8 .tmp/wiki-evidence-2026-11-03/check-glm-source-layer.py`，结果仍为 3,063 个 blob 匹配、0 缺失、0 差异，另一个 catlass gitlink 排除；不含 Git 元数据的额外普通文件 889。压缩层 SHA256 为 `40ef41925930b4378818ef80495eea345e689f43b4cfb0a4d41ba5d5abf6d56c`，层内 ref 为 db701c1f。这里只静态读取 tar，未执行镜像代码，未把子模块或后续层纳入一致性结论。

接受本次增量，不声明独立重读全部 30 项来源。最终页面 SHA256：`62ef6d7f0874120b319aa9918a0e6edef334fb7148f1c4ba3632a2b2c3e8c486`。
