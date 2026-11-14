# 三份版本来源页增量独立复核

root，2026-11-03。GLM MLP、AscendConfig、rc2 基线三份精确 diff 均已完整读取；接受下述增量。逐项旧来源仍由作者账本记录，本报告不冒充三页全部引文的第二轮全文阅读。

GLM MLP：实际读取 rc2 模型 90–138、324–350、448–478。对 main 与 rc2 整个 model.py 做字节比较，43,769 字节完全相同，SHA256 `2a9381fa5897578bf4922b4b2bef99635dbc58236cd0f31fe5f93664b7252bbe`；两旧分支的指定新旧路径，以及 main/rc2 的旧路径，逐一 `git cat-file -e` 确认缺失。页面正确保留“路径缺失不等于功能不存在”和旧 GLM 部署的独立基线。

AscendConfig：独立读取新增 27–35 全范围及旧 getter 353–365 / 369–381、main 派生 573–628。确认整数环境解析、合法环境值下显式 JSON 的优先级，与 main/rc2 的逻辑或规则不同；rc2 的 profiling 条件、整个子字段选择、对象身份缓存、发布顺序与两属性守卫都有实际代码支持。未将配置字段当成调度或模型运行结果。

rc2 基线：读 patch 18–43、平台 import 20–27、Worker 保存与选择 192–193 / 491–506，以及 CPU Dockerfile 141–151 和该提交实际 patch。独立复核发现原增量把本地 v0.30.0 标签当成远端当前标签，已要求作者修正并复读第 62 行关闭：2026-11-03 06:56 UTC 的 `ls-remote` 中远端 tag 和 release branch 都为 ced6857a，本地同名 tag 为 9ed533eb。原始观测在 `.tmp/wiki-evidence-2026-11-03/v030-remote-ref-observation.txt`，不据此改动项目固定 pin。

最终页面 SHA256：

- glm-mlp-version-source：`ca11937f768380a0c4234c1c67e937b48bad4e465fffdeea5e6796cc9f63bbdb`
- ascend-config-version-source：`52d889eb11f8b03c72be822168de8bd5b32cb83bb0dbe84e02dbd36524962991`
- v030rc2-baseline：`f3635465da0de1262e029ae55a7bbf84f504c02de8638c91e620aa054926ba3d`

未进行 NPU、模型加载、部署或视觉验收。
