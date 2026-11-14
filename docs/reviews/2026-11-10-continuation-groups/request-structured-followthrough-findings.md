# 结构化输出官方承接复核

范围为 99 目录第 83 项的显式示例目录，以及当前页面尚缺的 rc2 逐项对照。完整读当前 structured-output 教学页；没有修改教学页、图、verified 或 99 总账。

## P2：rc2 两张版本表未补齐

当前页 L590–620 两表只有 v0.23 / v0.26 / main。L586 的 rc2 段只解释推理结束与草稿约束，不能代替参数默认、前置校验、后端编译消费者、Ascend runner/补丁的逐项说明。写作标准 L56 要求四版逐项比较。补证见 `request-structured-followthrough-evidence.json`，33 候选范围，其中第 24 项可复用当前来源 92，不必重复登记。

- rc2 六种主约束及三辅助默认与固定 main 一致，空/多约束用 VLLMValidationError。空 JSON、json_object=false、NUL 正则明确前置拒绝；扩散模型也有独立拒绝。不能从已接受约束类型推断所有模型可用。
- rc2 协议已在 generate/base，公共覆盖函数只改同名约束。rc2 与固定 main 均有标签的 HTTP 前置校验：response_format 和 structured_outputs 两入口都验证；当前 main 格只有“迁到 generate/base”，应补实际阶段差异。
- rc2 请求辅助字段没有进入 key 或编译调用。编译入口多传 stop_token_ids；两个服务格式选项仍由 xgrammar/guidance 读取。后端支持矩阵与正草稿数限制有对应消费者，不能只靠字段定义判断。
- rc2 配置、512 MiB getter、Python 字典转换、CLI 入口和 parser 回填已分别实际读源。
- rc2 管理器仍是门槛 128、缓冲请求上限 ×（1+草稿数）、无草稿且本步受约束请求超过 128 才并行；已有 rc2 约束起点源可复用。
- Ascend rc2 的 V1 仍将 logits 送 CPU/FP32，再送回设备并转原 dtype；V2 默认 False，kernel 已在 ops/triton/v2。rc2 结构补丁全文是单后端 + outlines 终态接受停止编号，不再安装 v0.26 的 grammar_bitmask/should_advance 覆盖。

`comparison.json` 记录实际比较的 rc2/main AST 范围。12 组均同字节；只允许复用相应读到的范围，不据此声称整个文件或两版本整体一样。main 是固定比较点，不宣称它和 Ascend main 精确配套。

## 示例承接：已读完整四文件，不照搬上游误写命令

固定 0fc695fc 示例目录的 README 58 行、offline.py 113 行、client.py 268 行、pyproject.toml 8 行均实际完整读过。HTTP 客户端有 choice/regex/json/grammar/旧 structural tag、并发请求、流式打印；离线脚本用 LLM.generate 顺序跑 choice/regex/json/grammar。当前页 L376–543 已解释 HTTP/Python 位置、独立约束、schema、标签和后端限制，流式输出的完整契约在 streaming-output 主解释，不需复制五份车型示例。

官方 README 的 Usage 把 --stream / --constraint / --reasoning 写到 offline.py 上，实际参数解析在 client.py；offline.py 不读取这些 CLI 参数。pyproject 的 console entry point 指向 structured_outputs:main，而固定目录只有 client/offline 两模块。本站当前示例没有照搬该错误。客户端 --reasoning 只控制打印已有 reasoning 字段，不能作为模型启停思考的开关。

该目录无教学图片、无 include。README 回链到已读母文，不另计全文。读取示例不代表运行了 Qwen 或 GLM 推理，不把 uvx 配方当成本轮可运行验收。

## 尚存边界

本组可关闭“示例目录未读”这一承接，rc2 表仍须作者补齐后独审。外部 XGrammar 的具体 tokenizer 元数据行为（GLM 24 个 padding 编号、三个结束编号）仍是已有显式待核，当前只读参数格式和编译接口不能关项。四种后端库的全部功能、全部第三方 API 不在此次接续中冒认完成。

取证脚本范围断言曾拦截拟写 Ascend patch 结束行 172：固定文件实际 163 行，已更正为 L20–163 后才生成证据 JSON。没有越界来源写入教学。
