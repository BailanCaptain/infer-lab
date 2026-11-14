# RFork 总览增量独立复核

复核者：`/root/review_first_pages`。只读教学页；没有设备运行、浏览器或图视觉验收。

已完整读取 `rfork-overview-remediation.diff`、`rfork-overview-diagram-remediation.diff`，并复读当前总览 119–145 行及修改段上下文。结论仅覆盖本批增量，不代替总览全部来源的逐条核验。

本批修订通过：

- `2c59ff10` transfer_backend.py 298–459、31–100 实际含独立 shape 表、从 tuple/shape 表取形状及 `view` 尝试。`2ed6cbba` 298–315、421–459 对应行为相同，因此旧版“没有 shape”不能成立。main `baa023ad` 529–592 仍有同类处理，不等于工作版的 dtype/名称集合完整核验。
- `baa023ad` transfer_backend.py 149–246 全读：processed 收集参数、buffer、模块普通属性；checkpoint 在参数与 buffer 外只补扫 impl。两者按地址去重。修订保留了路径与属性挂载条件，没有继续声称 main 无条件收集所有属性。
- 工作版 rfork_loader.py 521–710 全读，并复用前轮实际读过的 441–465、session.py 251–317：会话及身份先于空模型，布局准备先于借租约；全部共享草稿可提前返回；传输完成后后台归还，适用的后处理和 eval 后先尝试发布，再 return。当前流程顺序正确。
- 工作版 session.py 321–420 全读；未确认租约归还时延期发布，首次登记失败不等于模型读取失败。停止服务与内存清理门槛采用 types.py 38–49 的 `service_stopped && memory_reset`，租约未归还本身不阻回退。当前总览 138 行及两路径图已保留这个区别。
- `7d825229` session.py 40–51 实际确认主草端口槽；seed_server.py 141–167 全读，动态回退要求固定端口、开启 fallback 且 errno 为 EADDRINUSE。其他绑定错误重抛；越界处理复用同一轮实际读过的 session.py 495–554。
- 新来源 37–41 逐项读取完毕；来源 6 扩大的 main 收集范围亦已实际读取。约 305 GiB 的修订限定为所列语言权重遍历估算，与独立核过的容量子账一致，未再声称每机磁盘量或完整下界。

两路径图 YAML/SVG 的本批文本一致，坐标布局没有变；没有看图或浏览器实测，不能据此宣称视觉通过。传输页来源 26、排错页来源 30 新增 types.py 38–49 与图 pin 一致，引用登记修正通过；本记录不把之前失败的 lint 改记成通过。

本批无剩余 P1/P2。对应精确文件哈希见同名 JSON。
