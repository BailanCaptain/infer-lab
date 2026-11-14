# 在线接口尾项：作者整改记录

作者 spec_final_review，2026-11-11。承接既定目录 94（在线入口及包装）、96（协议）、98（语音），只改 api-server-entry 教学页；未改总账、其他作者页面或产品代码。独立验收由 queue_final_review 负责，本记录不替代独审。

## 结果与依据

原页已完整解释 Chat 七步、renderer、多模态、工具插件与离线回链，但仅列协议名称不足以回答 Responses 的会话记录、Messages 转换、pooling 返回结构、语音传输方式和部署包装层的问题。本轮增加三个教学小节及对应参数、错误和四版表：

- Responses 的 input/output 与 Chat choices 区分；请求 store=true 和服务保存默认关闭是两层；进程内记录、历史恢复及持续主机内存开销，与 prefix caching 分开解释。
- Messages 转为 Chat 再转回协议块；pooling 按模型任务准入，经 encode 返回向量、类别或分数，输入输出插件回链到已验收的唯一解释。
- multipart 文件转写、Chat 音频、WebSocket realtime 分清；PCM16/16 kHz/单声道的一秒 32000 B，单缓冲 base64 42668 字符；模型验证、普通 commit 启动和 final commit 结束输入有完整顺序。
- SageMaker 适配分发表与 Ray Serve 外层副本分别解释；官方 GPU 示例副本上下界均 1、TP8/PP2/H100，不推成 Ascend 配方或自动扩容实测。
- 旧 MiniCPM image_sizes 的“2 个数”精确成“宽、高两个数”，直接重读旧来源 245–246。

当前 sources 351→494，新增 **143 个引文项**，不是 143 篇全文。最终正文 SHA256：`d2748364a30c5081ef308e56b3971f1df267c913e9414057a901c76e1a811f29`。本组新增全站全文阅读计数 **0**。

## 实际阅读与复用

三份固定母文 README/openai_compatible_server/speech_to_text 分别 212/193/189 行已全文阅读；其 10 个生成 includes 全段读取：Completions 两个、Chat 两个、Responses 两个、转写两个、翻译两个。另全文阅读八个示例：Ray Serve、Responses 工具、基础 Completions/Chat、文件转写/翻译、实时文件/麦克风。模板等既有解释回链复用，不新增任意外部框架全生态阅读。

145 个证据范围中，143 对应新增 sources，2 对应旧 MiniCPM 来源。84 个不同摘录已实际读范围，61 项按精确片段字节 SHA 复用；完整文件 SHA 只用于身份，不把未读范围视为已读。相互覆盖的已读范围也不重复计为全文。v0.26 bounded-upload 的片段与本轮实际完整阅读的 rc2 工具文件逐字相同；清单按首次出现排序，所以复用指针指向 v0.26。其余具体范围、文件 SHA、片段 SHA 与复用对象见 api-tail-author-reading-ranges.json。

四版均按 vLLM 0fc695fc / 568afb3a / ced6857a / 84030bbe 核消费者。版本表限定九类合同：保存、Messages 基本转换、pooling 准入、语音文件读取、解码传参、格式守卫、Realtime 时序、SageMaker 分发表、Ray 示例。没有用相同接口名推断字段/模型/硬件全部相同。较新版上传限量读取、600 秒解码传参以及 rc2/main 的 256 MiB 解码容量参数均分别核对；正文描述“传给加载器的上限”，没有假称实际分配到该数或完整音频库实测。

逐项作者支撑判定在 api-tail-author-additions.json，页末来源映射按协议、语音、包装层分别列索引。三母文关联链接的覆盖/回链/范围边界单列 api-tail-link-disposition.md；下载的其他源码不自动列入阅读。

## 反例与原函数复现

临时目录 `.tmp/continuation-groups-2026-11-10/api-tail-author` 保存原源码、选区和 reproduce.py。脚本抽取固定原 AST 函数，保留函数分支，协作者及事件解析使用可控替身；没有启动模型、HTTP 推理、Ray 或 SageMaker。15 组结果见 reproduction-result.json：

1. 四版 realtime 初始 commit 均得到 model_not_validated；完成模型验证后，final-only 不启动生成，普通 commit 才启动；append 的原 PCM 转换给出 16000 个采样点，final 放入结束标志。母文/路由注释的 optional 说法没有压过实际消费者。
2. 四版 Responses 普通请求在服务不保存时都被改为 store=false；未知 previous_response_id 返回未找到；后台请求在服务保存关闭时被拒，background=true/store=false 也被原协议校验拒绝。通过适配器前设置的观察断点停止，未伪装成完整生成实测。
3. 三个较新版的原限量读取函数在已知超限大小时不调用 read，未知大小时在分段读取期间拒绝。
4. 四版环境 getter 用原 lambda 实测 0/1/2/-1，得到 false/true/true/true；独审指出“只有设为 1”过强后，留快照并修成“设为 1 启用保存”。这个 P2 交独审复核关闭。

临时脚本 select.py 曾与标准库名称冲突，复现导入时额外重建了选区；已更名 select_ranges.py 并重新跑完复现。它没有修改教学页或源代码，最终结果来自更名后运行。

## 保留与展示验收

修前快照 api-server-entry-before.md 的 SHA 为 `6bedd6d2f747acd76a940bd8ea88b30a2f2d9ec2c1e9f4e4afdb87fb472a82b2`。比较正文时仅统一 CRLF/LF，不抹除内容差异：原 351 来源完整前缀、其余 frontmatter 原样；4 个图块、3 个旧 calc 与全部旧链接保留；唯一旧段落替换为 MiniCPM 宽高精度修订。八个 YAML/SVG 图资产与前轮独审记录 SHA 一致。新增 PCM calc 后共 4 个 calc。正文 diff 与逐项结果保存在 preservation.json/body.diff。

作者实际打开浏览器、查看 22 张截图，涵盖前两屏、三个新增小节、参数/错误/版本、两张新表、全部 4 图和 4 calc；随后环境开关 P2 与确定条件措辞修订后另实际查看 4 张最终截图，共 26 张。六个链接实际点击成功，包括本页音频锚点、IO 插件、prefix caching、结构化输出、引擎进程与 PP。页面错误 0、横向溢出 false，新表宽均为 1076/正文 1076，单元格溢出 0；两轮浏览器各自运行前后 SHA 一致。记录在 browser/report.json、browser/final-report.json。

前两屏仍能复述“前端将 JSON 整理成编号和参数，登记回程后送引擎；CPU 与在途记录占主机资源，拥堵会在模型之前等待”。未把协议比较表挪到首屏，保留原七步示意。

标准口径为对照源码前、排除围栏内容的汉字数加拉丁单词数：13979 字，行内代码 3（0.215/千字），角标 0，calc 4（0.286/千字），免责词句 9/356（2.53%）；单页标准检查无问题。初测 3.1% 后，把本轮三个确定条件/结果表述改为直接说明，保留实际边界及旧正文，不靠删除未知事项降比例。

`pnpm check:content` 通过：164 页、11 个主题；`git diff --check -- wiki/concepts/api-server-entry.md` 退出 0。统一五工程检查和来源白名单由 root 汇总。没有模型或硬件性能实测；也没有把外部 API 产品全规范当作 vLLM 已实现能力。当前作者已处理收到的 P2，最终验收及是否有新问题以独立审查为准。无用户待决事项。
