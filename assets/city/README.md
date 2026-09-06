# 推理之旅 · 城市开篇模型

根据用户的新参考图，将首页从山境改为暖灰绿色的服务器城市。包含 GPU / NPU 地标、机架楼群、屋顶散热风扇、互联高架、海湾远景、观景台与简化背包人物。属于风格化概念模型，建筑尺寸和道路不表示真实硬件规格或网络拓扑。

## 文件与单一来源

- `compute-city.blend`：可编辑源文件，贴图已打包，不依赖外部素材。
- `../../public/models/compute-city.glb`：网页模型，Draco 压缩，立面贴图内嵌。
- `rack-albedo.png` / `rack-emission.png`：脚本生成的机架表面和灯光贴图。
- `../../src/app/intro/city.json`：地标位置、大小、文案、材质色、默认镜头与种子。
- `../../scripts/blender/build_city.py`：生成脚本，仅用 Blender 内置 Python / NumPy。
- `build-stats.json`：实际导出的面数、材质批次与模型字节数。

```powershell
& 'C:/Users/-/AppData/Local/Programs/Blender/blender-4.5.13-windows-x64/blender.exe' --background --python scripts/blender/build_city.py
pnpm dev
pnpm check
pnpm build
pnpm test:e2e
# 可选：实测窗口化浏览器，日志会打印实际 WebGL 渲染设备。
pnpm exec playwright test tests/intro.spec.ts --headed --grep '模型预算'
```

## 性能约定

- 立面指示灯来自两张 256×1024 图集，没有为每个灯建立 mesh / point light。
- 源文件保留语义分组，网页导出按材质合并。保留几何完整性，不对分材质壳体自动减面。
- `cityScene.ts` 按需申请动画帧；空闲时不运行 RAF、不绘制。页面隐藏时取消帧请求。
- 一个 1024² 静态阴影图，只在模型加载后生成一次；首帧会包含阴影和颜色两个 pass。之后正常视角只绘制颜色 pass。
- DPR 上限 1.25，绘图缓冲不超过 250 万像素；优先请求高性能 GPU。手动拖动/缩放跟随浏览器刷新，不限为 30 FPS；环游默认关闭，只有主动环游上限 30 FPS，保留时间余数避免降为 25 FPS。直接拖动，无惯性尾帧。
- 当前首页已移除悬浮标签、地标 raycast 和点击拉近逻辑；没有逐帧标签投影或 React 动画状态更新。
- 减少动态效果或 `?nofx=1` 下关闭环游，镜头直接到位。
- 资源加载使用本地解码器，退出页面时取消请求并释放 geometry、材质、贴图、ImageBitmap 和渲染器。

预算与回归验证在 `tests/intro.spec.ts`：GLB 小于 1.5 MB、正常帧不超过 25 次绘制 / 20 万三角面、空闲 500ms 不新增绘制；同时检查模型加载、点击文字/建筑不改变视角、持续拖动跟帧率、松手后零重绘、4K 像素预算、环游、卸载重入、手机十章目录和网络重试。帧率测量会打印 GPU 标识；SwiftShader 是软件渲染，不能当作真实显卡的性能结论。窗口化和无头浏览器应串行测量。

旧山境模型仅作为原工作区的本地草稿保留，未纳入当前版本，也不是构建依赖。最新标题改为「大模型推理之旅」，左侧十章目录复用已提交的 `world.json`，仅展示内容，不触发相机或课程跳转。
