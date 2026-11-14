# XGrammar 的两个 GLM 旧待核

本次固定外部 XGrammar v0.2.0 提交 `5433fdbea7003eea61cb863768a05fb8da3bf919`，与当前页面已采用的格式示例提交一致。完整读 tokenizer_info.py 460 行、tokenizer_info.cc 505 行、tokenizer_info_impl.h 128 行；grammar_matcher.cc 只读实际相关构造、AcceptToken、FillNextTokenBitmask、SetTokenBitmask 范围，没有声称全文。网页解析行数与原始文件行数不同，引用以固化 raw 的行号为准。

当前环境没有 xgrammar/transformers/torch，本轮没有加载原生 matcher，没有 NPU 推理。下面是固定源码与已验收 GLM 文件组合下的静态结论；不代表部署镜像必定安装这个 XGrammar 版本。证据 18 项见 `request-xgrammar-tokenizer-evidence.json`，数据计算见临时目录 `review-static-tokenizer-inputs.json`。

## P2：不能把漏识别的两个结束编号概括成“一直屏蔽、基本无害”

structured-output.md 收尾段当前写：若 XGrammar 只认出 154820，另两个编号照旧屏蔽，对 JSON 基本无害。这个推论不受固定代码支持。

1. 基线 vLLM 的非 Mistral 分支调用 TokenizerInfo.from_huggingface 时，只传 tokenizer 与模型 vocab_size；建 matcher 时也不 override 停止集合。
2. 固定 XGrammar 的 HF fast 分支只使用 tokenizer.eos_token_id，不读 generation_config 的 EOS 列表。固定 GLM tokenizer_config 的 eos_token 是 `<|endoftext|>`，对应 154820。
3. XGrammar 的 special 与 Hugging Face added_tokens.special 不是同一个分类。固定构造器将空字串作为 special；显式 stop 列表先单独分出；其余非空词进入普通字节匹配表。因此 `<|user|>` / `<|observation|>` 不因为 HF 把它们标为 special，就自动从文法候选里去掉。
4. 这两个词元的字符序列能作为 JSON 字符串的内容。例如已经生成 `{"x":"`、schema 允许任意字符串时，其文字本身不破坏当前 JSON 前缀。它们是否可选由当时文法状态决定，不能断言一律屏蔽。
5. 固定生成配置把 154827/154829 也列为 EOS；默认不忽略 EOS 时 vLLM 把额外编号加入停止集合。采样出该编号后，调度器满足 min_tokens 就会停止，不等待 JSON 完整。这是源码可达的提前收尾条件，不是已经测得发生率或该模型必定会选它。

建议将旧假设改成“必须核对文法停止集合与引擎停止集合是否一致；不一致时，额外停止词元可在文法允许其普通文本的状态中提前结束输出”。保留正常文法停止编号只在可收尾状态放行的解释，同时明确它只适用于被 matcher 识别为 stop 的编号。

## 24 个空槽的静态边界可以明确

固定 tokenizer JSON 的普通词表 154820 项、added tokens 36 项，最大 ID 154855；按 Python 构造器生成 154880 长度的词表后，154856–154879 全为空串，共 24 个。C++ 将这些编号列入 special；正常 FillNextTokenBitmask 调用 SetTokenBitmask 时传 allow_special_token=false，因此有效文法掩码屏蔽这 24 位。

不能扩成“服务任何时刻一律屏蔽”。vLLM 在没有应用文法的推理段、文法终态等分支会填全 1；本结论只针对实际由该 matcher 产生的约束掩码。上游是否调用约束、实际装的外部库版本和运行组合仍须按部署核对。

## 四版停止集合传递有实际差异

- 0fc695fc / 568afb3a：matcher 构造不传 override_stop_tokens，沿用 tokenizer 的集合。
- ced6857a / 84030bbe：管理器把请求 all_stop_token_ids 送到 compile_grammar，XGrammar backend 在非空时作为 matcher 的 override_stop_tokens。新版本因此不能沿用旧基线“vLLM 没有传这些编号”的说明。

GLM 旧主线仍是 0fc695fc，不将后两版改善套回旧算例。外部库版本范围不是唯一 pin，当前证据允许关闭“完全没有源码、不知道算法如何处理”的状态；真实镜像的元数据打印、原生编译、输出质量和设备性能仍没有验收。

未编辑教学正文，未重计旧 tokenizer JSON 的全文阅读，未改 99 总账。
