# 云隐 · 开篇山境

根据用户提供的东方云海悬山参考图创作的风格化三维场景，供 infer-lab 开篇使用。不是照片级复原；没有重建参考图的前景人物。

- `cloud-mountains.blend`：可编辑 Blender 源文件，包含悬山、十座山门、松树、十三座桥、瀑布细流、石灯、文字、相机和灯光。
- `../../public/models/cloud-mountains.glb`：带 Draco 压缩的浏览器模型。
- `../../src/app/intro/world.json`：篇章文案、布局、材质色与随机种子。编辑这一处后重建模型，网页与模型保持一致。
- `../../scripts/blender/build_intro.py`：确定性生成脚本。仅依赖 Blender 自带 Python，中文文字使用 Windows 宋体 `C:/Windows/Fonts/simsun.ttc`，换操作系统时需要替换字体路径。
- `build-stats.json`：本轮实际生成的三角形数、模型字节数与种子。

## 使用与重建

```powershell
pnpm dev
# 打开 Vite 输出的本地 URL，首页即山境。
& 'C:/Users/-/AppData/Local/Programs/Blender/blender-4.5.13-windows-x64/blender.exe' --background --python scripts/blender/build_intro.py
pnpm check
pnpm build
pnpm test:e2e
```

网页通过 `GLTFLoader` 读取 GLB。Draco 解码器随网站放在 `public/draco/`，来源为本项目安装的 Three.js 包，不访问第三方 CDN。升级 Three.js 时应同步这三个解码文件。

拖动旋转、滚轮/双指缩放，目录与山门都能定位。Esc 或复位按钮返回总览。环游默认关闭，手动操作停止环游。浏览器支持 WebGL 2 时显示场景；加载失败时保留目录并支持重试与模型下载。手机上目录折叠为菜单。

模型为实时风格化作品，使用几何岩层与松冠，云海由网页中的实例化透明面片叠加，Blender 源文件不包含网页云层。网页导出按材质合并批次并使用 Draco 压缩，保留原始几何以避免分材质岩层和台阶在减面时出现裂口；精确面数、批次与字节数见 `build-stats.json`。静态阴影只计算一次，空闲时不重复绘制，主动环游以 24 FPS 为上限。现有十境仅用于展示和篇章导览，未新增教学正文；低端移动 GPU 的帧率仍需真机评估。
