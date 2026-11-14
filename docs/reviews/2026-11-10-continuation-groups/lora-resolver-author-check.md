# LoRA resolver 作者自查

已补旧来源查找入口遗漏：未知 model 名如何触发 resolver、文件/Hub 两类定位、配置匹配与真实加载的边界、同名锁与登记复用、Hub 子目录清单、revision 未传递、插件白名单与顺序、404/400 与异常捕获范围。四个固定上游消费者实际核验，38 项补证在 lora-resolver-additions.json；已有全文/精确范围阅读复用 request-lora-resolver-followthrough-reading.json，不新增全文数量。

没有把官方示例中的 bin 当唯一权重格式，没有将 S3 示例当内置插件，也没有建议关闭名字校验来绕过失败。运行时模型加载成功不等于设备上任意模型/EP/量化组合受支持，旧 GLM 限制保留。

只生成 lora-resolver-loading.svg，临时渲染命令的 figureProblems 为 0，未批量重写其他线程图。作者实际打开 5201 lora 页，查看首两屏、原图、新图、新增正文、两张新表、源码索引和共 11 张截图；实际点击 API server 请求检查回链成功。浏览器 errors=0、页面/表格横向溢出=0，前后页面与新图 hash 稳定。证据在 review-lora-author-browser/report.json；这是自查，不是独立验收。

首图仍为原 lora 图，图前 calc 为 0；首图前既有 rank 示例和缩放定义保留，没有增加图前数值。按包含空白/标点的原始 Markdown 字符口径，教学正文 6601 字符、含源码区全文 14797 字符，教学行内代码 33 处（约 5.0 处/千字符），正文证据角标 0。新流程不涉及数值推导，没有新增 calc；既有演算保持原样。

根代理负责新的独立审查与最终五项统一工程检查；此前工程记录不套用本次改动。没有启动 GPU/NPU 或请求真实适配器下载，没有性能和现场兼容性结论。

## 独审反馈闭合（第二次作者局部验收）

- 按 root 独审 P2，在「开销和什么时候别开」补内置 Hub resolver 不面向生产环境，并连接固定适配器／受控本地目录的使用方式；依据现有来源 50 的构造函数告警与来源 85 官方设计说明。
- 同时把旧基线 safetensors → bin/pt 优先级限定为「未使用 Tensorizer 时」，依据来源 84 先于该分支的 Tensorizer 处理。
- 最终本次正文 SHA256：39a6008c7716fb0c611a0f6c4494505371415498b53b6ed9e665c9b8ca72a709。图与来源 49–86 未改。
- 局部浏览器证据：`.tmp/continuation-groups-2026-11-10/review-lora-fix-browser/report.json`，前后 hash 相同、page errors 0、横向溢出 0；`formats.png`、`scope.png` 均实际打开检查，段落完整可读。该记录是作者自检，独立验收仍由 root 记录；统一工程检查由 root 执行。

- 后续独审补充同一适用条件：来源 86 的动态装卸指南要求生产使用在隔离且完全可信的环境中；已在运行中装卸段写明，与内置 Hub resolver 不面向生产环境的限制分开。重新运行局部浏览器检查，三处文字均存在、stable/errors0/overflow0，新增 `dynamic.png` 实际查看通过。
- 该补充后的最终正文 SHA256：47bcdb780f37fe1d9aeb4177434bece7288e17dcc53b6dcff1b3c0a27bf301c8（取代上段 39a6008c 的中间指纹）。图与 38 项新增来源不变。
