# rope 审查记录

## P5 写作记录（2026-09-28，Opus 写手，第 08 批深改）

**改了什么**

- 按六步骨架重排：问题式 H2 + 一句话定义 + 直觉图 → 为什么需要、代价（含四行“位置”概念小表）→ 二维分量对与频率（1 个示意 calc）→ 点积只剩位置差 → 频率基数与 YaRN 等长上下文方法 → 推理引擎里旋转发生在哪一步 → GLM 双机（稀疏 MLA / 索引器 / KDA 三个 H3，1 个 calc）→ 常见误解 → 对照源码五个 H3。
- 直觉图 `rope.yaml` 重画：三个表盘（旋转前内容夹角 30° → k 在 3、q 在 5 → 都 +100），加旋转弧与夹角标注，说明点积只取决于角度差。新增代码流程图 `rope-glm.yaml`：位置编号怎样走到 KDA 与稀疏 MLA，三项构造条件与未走分支（淡色）。
- 新增内容：远程衰减、与线性注意力结合（论文 §3.3）、rope_theta、PI / NTK-aware / NTK-by-parts / YaRN、vLLM 最大长度推导与报错、Ascend 替换旋转模块、索引器池内偏置、KDA 丢弃位置编号、三版差异。
- 纠正旧版：旧版称专用实现“两处分支都要求旋转维大于 0”。实际主注意力要三项同时满足（维数大于 0、非 NoPE、有 RoPE 参数），索引器只看维数。
- 队列提示“稀疏 MLA 的 rope 只作用在 qk_rope_head_dim 部分”按源码核实：一般 MLA 如此，但本配置该部分为 0 维，什么也不转；已写进正文和误解。

**旧版信息清单**：27 条，逐条勾选见 scratchpad `p5/rope-facts.md`；全部保留或并入新版，无删除，1 处纠正（见上）。

**数字出处**

- RoPE 维数 0、qk_nope 256、潜向量 512、KDA 短卷积核 4、34 / 11 层：底稿 02 §0.2、§5.2。
- 主缓存宽度 512 + 0：底稿 02 §5.6（head_size 一行）。
- R1 位置编号 0–3：底稿 01 §A3；服务最大长度 133,120：底稿 01 §A2（教程）。
- max_position_embeddings 1,048,576、indexer_rope_interleave、mla_use_nope：模型配置（690b7052，与 glm-flow official-config.json 一致）。

**核心概念对照**

- RoFormer（arXiv 2104.09864v5）：§1 动机、式 15 频率与基数 10000、式 16 相对位置、§3.3 线性注意力、§3.4.2 逐元素实现、§3.4.3 远程衰减。
- YaRN（arXiv 2309.00071v2）：PI、NTK-aware、NTK-by-parts、温度 0.1·ln(s)+1、10 倍 token / 2.5 倍步数。
- vLLM@0fc695fc：rotary_embedding base.py / common.py / __init__.py，config/model.py 最大长度推导。
- vllm-ascend@db701c1f：glm5_next.py 1965–2000、2089–2103、1256–1269、1357–1383、880–887、236–251；kpool 压缩 200–202；indexer_kpool_mla(.py 70–71、_v1.py 641–646)；kimi_kda.py 244–251；model_runner_v1.py 863–868；utils.py 735–755。
- 版本：v0.23（2c59ff10 / 0fc695fc）、v0.26（2ed6cbba / 568afb3a）、main（baa023ad / 84030bbe）逐项核对 get_rope、Ascend 注册、GLM 专用实现。

**自查**：首图前 203 个非空白字符、0 个 calc；教学正文行内代码 0；对照源码之上角标 0，全页角标 19（C 占 74%）。wiki:lint、check:content、wiki:diagrams --check、wiki:audit 均通过；rope 两张图无提醒。未截图、未起服务。

**待核**：设备上 RoPE 算子耗时；main 以 0 维构造的索引器旋转模块是否在前向执行；池内偏置只核对 PyTorch 写法的路径。

**疑点（留给审查）**：底稿 02 §0.2 写“位置信息只由 KDA 的递归和短卷积携带”，与源码中索引器压池的池内偏置（4×128 可学习参数，加在门控分数上）及 glm-5-3-flash 页“三处”说法不完全一致，建议底稿改为三处。
