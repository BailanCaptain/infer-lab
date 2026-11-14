# 算力群岛：机柜到 GPU / NPU

独立 Blender / Three.js 模型研究，未接入 infra-view 或 infra-view-new 产品代码。

## 使用

预览地址： http://127.0.0.1:4178/whole/

1. 选择 NVIDIA 或华为。
2. 依次进入整座机柜、抽出整机、展开内部、GPU / NPU 模组。
3. 在内部视图拖动展开距离；点击部件或列表进入独立观察。
4. 模组视图可抬起散热器。拖动环绕，滚轮缩放。

`rack-hardware.blend` 保存两座带整机与内部部件的机柜；`whole-hardware.blend` 保存两台整机和分组模型。GLB 文件在 assets，渲染图在 renders。

## 范围与资料

- NVIDIA DGX H100：8U，8 个 GPU、4 个 NVSwitch、2 个 CPU、32 个 DIMM 槽、12 个风扇、6 个电源、8 个数据盘位。
- 华为 Atlas 800T A2：4U，8 个 NPU 模组、4 个 CPU、32 个 DIMM 槽、8 个风扇、4 个电源、10 个可选盘位。
- [NVIDIA DGX H100 官方用户指南](https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html)：机箱、GPU 托盘、主板与部件数量。
- [Atlas 800T A2 官方产品规格](https://e.huawei.com/cn/products/computing/ascend/atlas-800t-a2)。
- [华为技术白皮书 v16](https://e.huawei.com/cn/documents/products/computing/b0b253c4d5da4e05ba80a39e3dc65fd2)，本地 reference/atlas800t.pdf：PDF 第 13 页部件爆炸图、第 35 页 NPU 模组、第 36 页载板、第 38 页内存布局。
- 风格依据：用户提供的云海茶屋截图。借用微缩场景、低饱和自然色、哑光材质、俯视取景和暖色纸质面板。

## 重要边界

机柜是通用 42U 展示结构。4 台 DGX / 8 台 Atlas，以及顶部通用网络设备和机柜线束，只用于展示，不代表厂商认证整柜方案、供电密度、散热能力或网络拓扑。

整机外形比例依据公开规格；内部按官方部件类别和数量重建，位置、尺寸、散热鳍片数量、小元器件、背面端口与紧固件均有简化。未表达真实晶粒或 HBM 内部结构。抬起散热器后的封装表面为简化示意，不是芯片内部布局。没有把旧项目的未核验 HCCS 连接补成真实布线。

## 可保留的资产结构

建模脚本为 tools/build_whole.py、tools/interiors.py；共用材质和几何函数。机柜场景由 tools/rack_scene.py 组装。每个可操作部件有独立节点与 kind、label、source、explodeZ 等属性。Three.js 读取同一 GLB 处理层级、选择和展开。

所有 GLB 均可独立使用，不依赖外部贴图。制造纹理以几何简化表达。每个语义部件按材质合并网格，避免每片鳍片单独提交绘制。

## 验证

tools/verify_assets.py 检查 GLB 头、长度、有限数值、内嵌缓冲区和 GPU / NPU / CPU / DIMM / NVSwitch 节点数量。结果写入 assets/verification.json。浏览器实测记录见 VERIFICATION.md。
