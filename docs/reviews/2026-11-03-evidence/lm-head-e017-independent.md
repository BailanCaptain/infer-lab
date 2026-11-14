# LM Head E017 独立增量复核

2026-11-03，审查者 `/root/review_groups_03_04`，写手 `/root/review_first_pages`。

实际完整阅读 `lm-head-e017.diff` 原始增量及末次修改，核对当前相邻正文、`lm-head-intuition` / `lm-head-flow` 两份 YAML 全文和本次 SVG 文字差异。范围为本次增量，不代替整页 47 项来源再次独立核验，也不属于图像视觉验收。

实际读取的原始范围：db config 505–515、proposer 1158–1171 / 589–596 / 1260–1299 / 121–136、GLM 2515–2532、vocab 64–135、runner 2326–2327 / 2738–2742 及继承声明 L287；0fc logits 30–104、sampler 243–302、gpu runner 5399–5501；840 logits 201–251 与 proposer 424–442；baa config 458–465、proposer 1325–1377 / 1511–1583 / 1714–1742、GLM MTP 184–197；2c config 324–339；2ed config 344–349；rc2 config 580–586；db GLM 配置适配 14–30。两版量化配置复用本人已实际核验的固定 9e55cbc8 / 3121f187 内容。

核心结论：矩阵投影的逻辑字节预算不能保证实际 HBM 恰好读一次或必然受带宽限制；两版输出头为 FLOAT，设备 BF16 还需结合默认 dtype；MTP 共享输出头权重不取消输出投影计算；本地最大值归约须区分上游接口、模型能力与 Ascend 草拟调用路径；连续且按 rank 排序的词表分片是同分时最低全局编号推导的前提。原有分数、softmax、容量、4 FLOP/B 算例及适用条件保留。

发现并整改的两项 P2 已复看关闭：L171 原“logits 只能比大小”改为“logits 尚未归一化”；提示词 logprobs 的附加投影补充 sources 46、47 及 L346 映射，原始调用链确实对所需提示词 hidden 行调用 `compute_logits`。这保证“只对最后一行打分”限于没有请求提示词 logprobs 的普通生成。

复核后的 `lm-head.md` SHA256：`f0d4184c49c584bc7eaff37db995df14f7d512428d90b6659d4162497e3485cb`。

本次增量接受。未进行浏览器、3D、NPU 或性能测试。
