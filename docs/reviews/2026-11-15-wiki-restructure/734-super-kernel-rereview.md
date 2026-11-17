# 第三篇 Super Kernel：734 返修版事实与阅读复审

审查人：砚砚。2026-11-16。结论：**038 Approved，0 P1 / 0 P2**，721/725 三项问题闭合。039 新旧教学对比尚待烁烁独立完成，因此当前仍是 2/24 篇候选双审完成；本文不是正式发布回执。

接受来源 `0001794819700333-000734-44ec178a`。候选 `03-enable-super-kernel-ce990e186bfa.md`：234 行，43 条 sources，SHA-256 `c18906ea533a6db74726d92089dcd7e8f451379761b2fcf87806d7b8bb8e1132`；正式旧稿仍为 `c2cd68ecb004004228ef280b825812ef00c45cd656b76f4f754f17d18292a83d`。HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f` 是工作区基线，候选以以上 SHA 单独绑定。

## 三项闭合

1. **L145 / L167 / L174** 现在准确写出 rc2/main 的联合条件：编译模式不是 `VLLM_COMPILE`，且 `VLLM_USE_BREAKABLE_CUDAGRAPH` 为假才报错；与 v0.26 piecewise 分支无条件执行模式断言区分。不再把开关真假误写成环境变量存在性。与已核 `2ed6cbba`、`7d825229`、`baa023ad` 的 `platform.py` 分支一致。
2. **L147 / L161 / L172** 补回显式 `None` / JSON `null` 差异：v0.26 的可空入参将 None 当继承哨兵；rc2/main 的非可空布尔字段仅在缺省键时由 before validator 补齐，显式 null 不等同省略。是依据固定字段类型及校验器控制流的结论，没有宣称本机执行了 NPU 配置运行测试。
3. **L118–L134** 先解释优化目标、跟随行为、三级关系与配置例子，把 `fuse_*`、validator 细节与早期标签放到后段；四版本完整矩阵移到同页折叠核验区，事实保留。新增来源 42、43 经本轮直接 `git show baa023ad:docs/source/user_guide/feature_guide/graph_mode.md` 回读，支持符合条件的已编译子 kernel 合并、依赖同步、可能减少调度等待，以及通过 profiling 验证实际覆盖与收益的解释；不把日志当性能结果，不保证全模型单 kernel 或必然加速。

## 本轮实测

独立探针 `node --import tsx %TEMP%/infra-wiki-review-20261115/734-super-kernel-review.mts` → exit 0。报告 `734-super-kernel-review.latest.json`，隔离目录 `734-super-kernel-preview-67SuAp`；没有执行作者会修写候选保护尾部的脚本。

- 解析无错误；本地 41 条源码/文档/raw 引用通过，另 2 个 URL 仅登记、未声称在线核验。正式原 37 条来源顺序与正文身份、relations、verified、rawSources 等元数据一致。
- 实际共享函数 `lineageSection` 与 `protectedParamSection` 对比相等；保护尾部完整移动到 L177–L234，`[C30]` 仍指原第 30 个来源。
- 隔离构建成功；Chromium 1440×900、禁用 API 后页面无运行错误。实际点击展开“对照源码”，两段生成保护内容位于折叠区之外；实际点击 `npugraph_ex` 到目标页面成功。
- 已目视检查新截图 `super-kernel-top.png`、`super-kernel-table.png`、`super-kernel-config.png`。首屏两段为 337 / 149 个渲染字符（之前 570 / 519），高度 175.47 / 70.19px（之前各 280.75px）；这只记录实际呈现改善，不设新的字数门槛。三级表宽 1076px，与容器相等，无横向溢出。完整四版本核验表保留在折叠区，宽 1415px，仍可横向滚动；代码示例长行也可横向滚动，没有把这些区域谎报成全部无需滚动。
- 阅读了本轮 27 行 mapping，章节与保护区位置、43 条来源追加说明匹配；“全库仅一个链接”应按已发布内容页的入链理解，生成索引/草稿也有文本出现，但没有正文入站锚点被破坏。
- 临时浏览器与 4197 服务已关闭；原正式页、3D、210 缓存与 4173/4174/4196 服务未改。

## 后续

708 参数自定标题门禁正在独立代码短轮处理。随后给烁烁本 SHA 和旧稿进行 039 对照，检查前两屏能否复述、配置省略/false/null 与版本门槛是否易懂，而不是仅复核角标数量；再接第四篇前置提炼。没有需要用户补批的决定。
