# Token E019 独立增量复核

2026-11-03，审查者 `/root/review_groups_03_04`，写手 `/root/review_first_pages`。

完整读取 21,342 字符初始增量、两份 YAML 全文、本次 SVG 文字变化及最终 sources 62–64 和对应索引。这里验收本次增量，不冒称重新独立核验全页 64 项来源，也没有视觉验收。教学用 4 个编号、BPE 合并算例和图布局保留。

核心概念 P1 的修订获支持：added token 不等于 special token；字符级子词词表不保证覆盖任何字符；本模型的字符正则先于 ByteLevel；固定默认模板生成的编号数与正文裸文本的 4 个编号分开。实际逐项读了固定 tokenizer 的 36 个 added 条目、normalizer/pre-tokenizer/model 配置，完整读 tokenizer_config 与 261 行模板，没有声称逐字阅读整个词表和合并表。论文 1508.07909v5 §3.2 全文及脚注 3 支持字符覆盖的限制。

独立 CPU 对照使用固定 `690b7052` 三份模型文件和现有临时环境中的 tokenizers 0.22.1、Jinja2，脚本为 `.tmp/wiki-remediation-2026-11-03/check-token-e019-independent.py`，结果为同目录 `token-e019-independent-runtime.json`。复现 36 个 added 条目仅 18 个 special；256 个 ByteLevel 基本字符均存在；裸文本编号为 `[107934,106244,99311,98538]`；无 tools、单条 user 消息、add_generation_prompt=true、编码 add_special_tokens=false 时，默认模板得到正文所列的 16 个编号。skip_special_tokens 仍保留 `<think>abc</think>`，符合文件标记及 Rust 解码分支。这是 CPU 文件对照，不是部署镜像或 NPU 服务运行。

实际读取的原始实现范围：tokenizers 固定 afaae088 的 model.rs 475–535、mod.rs 885–911、added_vocabulary.rs 230–318；vLLM 0fc sched/utils.py 94–117、output_processor.py 210–270 和 512–541、renderers/hf.py 885–1087、Chat protocol 850–858、tokenizers/hf.py 112–126、sampling_params.py 590–618；840 tokenizers/registry.py 33–35、renderers/params.py 510–566。预计算嵌入例外另核三版实际消费者：0fc/568 processing/context.py 430–463、840 509–542，及对应配置范围。EmbeddingItems/DictEmbeddingItems 先检查 enable_mm_embeds，上限为 0 才跳过数量校验；普通媒体仍校验。原增量只引配置说明，建议补消费者，写手已追加 sources 62–64，当前映射复读接受。

最终正文 SHA256：`2d01e4fd3f1468bebf8be68c5b070065689aab05dfdc6790cb0573442be6a5c1`。本次事实增量接受，没有未闭 P1/P2。写手报告的三个 tokenizers GitHub 来源尚待项目正规登记问题，属于来源检查集成限制，不以删去原始证据或降低检查规则绕过；本报告不据此声称全站 lint 通过。没有浏览器、视觉、NPU 或性能验证。
