# Reasoning 增量保留清单

这批独审50项新增来源和四页教学差量。改前文件来自reasoning-coverage/*-before.md；具体hash、完整diff及机械身份检查见该目录review-identity.json、review-*.diff。没有把这些页既有几百来源重新记作本次核验。

- API原请求入口、长度/模板信任、MM/媒体缓存、评分回链、GLM两机和版本条件保留；新增模板思考参数解释、两组覆盖例子及一行版本表，没有删原正文。
- streaming原token/字节/文本片段机制、GLM推进例子、SSE、用量、Recipe与收尾保留。仅替换两句旧泛化：解析只改交付的总述改为明确分工并引出约束例外；每片都带概率改为允许返回概率的分支。两句原有效语义保留并补条件，未删除机制、数字或链接。
- sampling只在既有思考预算节加入三类控制与回链；原预算算例、Ascend基线不支持边界、GLM采样与新评分内容完整保留。
- structured-output只补非beam普通Chat的约束起点入口和回链；既有bitmask例子、异步/MTP/GLM/收尾内容保留。此批没有改变该页既有verified范围。
- 四页没有新增或修改任何图/3D；图按既有语义保留。浏览器实际看了四页首两屏和首图、所有受影响新表与新段，未将其他线程图改动冒认成本批成果。

冻结指纹与包见reasoning-checkpoint.json。后续renderer/HF/beam修改不由此冻结包代替验收。
