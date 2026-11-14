# Layers E016 独立增量复核

2026-11-03，审查者 `/root/review_groups_03_04`，写手 `/root/review_first_pages`。

实际完整阅读 `layers-e016.diff`（约 21,210 字符）、当前相邻正文、两份 YAML 全文；核对本次改变的 SVG caption。范围为 layers-and-hidden、来源基线与两图的本次增量，不表示重新核完这两页全部旧引文，也不是图像视觉验收。

原始证据实际读取：db 配置类 70–118；baa model.py 461–548；2c torch_binding.cpp 2701–2727；db proposer 1456–1518、1184–1216；db MTP 94–124；db utils 905–931；db GLM 2128–2145；db 参考实现 1908–2000；2ed binding 3046–3071。mHC 原论文 2512.24880v1 的 §1、§3、§4、§5.1 完整文字已读，缓存位于 `.tmp/evidence-2026-11-03/groups-01-02/paper-2512.24880v1-*`。两版量化配置复用本人已实际取得并核对的固定 9e55cbc8 / 3121f187 证据。

核验结论：hc_post_pre 包装仍分别调用 post/pre，不能推导 kernel 数减少；有限 Sinkhorn 与稳定项只是近似双随机；非负系数不保证带正负值的 hidden 不抵消；主模型输出供 MTP 使用，生命周期不止主模型返回；SP 关闭须带共享专家条件；135 MiB 是主混合矩阵，另有 90 × 27 × 4 = 9,720 B 偏置和缩放。原 45 层、90 次、1,800 轮、四流与单流演算保留，基线量化版本对应正确。

发现并由写手整改的两项 P2：L264 的来源基线相对路径错误；L260 把整条请求的前向归为单个 DP 执行组。已实际复读：链接改为 `../sources/glm-5-3-flash-baseline.md#双机示例与教学视图`；请求调度和 attention 状态归一组，专家可跨组计算。两项接受关闭。

当前文件 SHA256：

- layers-and-hidden.md：`d66f60eac3266ddcea3aa4574021cd83689c44f8b367e6459eccdfaca63c7340`
- glm-5-3-flash-baseline.md：`a01a7b853ae4851fe984402f3702926cbaaa37c1b6a9d8eff3e08ba451bb7f12`
- layers-one-layer.yaml：`53aca43601c3cca02fe219b2d1098dbe7b3f919e3ea16a830629c810cb4678fd`
- layers-stack.yaml：`ea784885c74e281773886af1e7c78d2bcd9f35d7addcbe3acf5eaea60e407136`

本次增量接受。未进行浏览器、3D 播放、NPU 或性能测试。
