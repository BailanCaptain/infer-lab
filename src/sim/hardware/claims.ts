/**
 * Atlas 800I A2 / 910B 教学硬件层的证据注册表。
 * HW- 前缀避免与 model/claims.ts 冲突；复用 Claim 类型，不复制证据结构。
 * 官方资料的适用范围是 Atlas A2 产品，不能外推到所有 910B 子型号。
 * 2026-09-06 已下载并阅读以下 PDF 原页；页号均为 PDF 阅读器的 1-based 页号。
 * 下载原件 SHA-256（用于识别同 URL 内容更新）：
 * CANN: 80d7fdb0a038448e30767544d3979e050f6ec8c559d054afaad96a4aa688aceb
 * Atlas: b90c2769230ac4ec68185142f566f8f8dc9909cf60ede0b199d8ae60ae4673a4
 * 尚未实现 NpuSpec / mapResidency，这些声明不表示硬件层已接通。
 */
import type { Claim } from "../model/claims";

const CANN =
  "https://www.hiascend.com/doc_center/source/zh/CANNCommunityEdition/81RC1alpha002/devguide/opdevg/ascendcopdevg/CANN%E7%A4%BE%E5%8C%BA%E7%89%88%208.1.RC1.alpha002%20Ascend%20C%E7%AE%97%E5%AD%90%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97%2001.pdf";
const ATLAS =
  "https://e.huawei.com/marketingcloud/pep/asset/20000001/Material/744857c25fe4438b97c85ed15fd79d1a/M3T1A669N1162432897309413660/%E5%A4%A7%E6%A8%A1%E5%9E%8B%E6%8E%A8%E7%90%86%E8%A7%A3%E5%86%B3%E6%96%B9%E6%A1%88R24_0-%E5%BD%A9%E9%A1%B5_25H2_.pdf";
const VERIFIED_ON = "2026-09-06";

export const HARDWARE_CLAIMS: Record<string, Claim> = {
  "HW-S01": {
    id: "HW-S01",
    kind: "S",
    text: "Atlas A2 训练系列与 Atlas 800I A2 推理产品采用分离架构：AIC、AIV 各有独立 Scalar，通过 GM 交换数据。",
    source: CANN,
    loc: "CANN 8.1.RC1.alpha002，文档版本 01（2025-08-26），§4.1，PDF p31–32（正文 p25–26）",
    verifiedOn: VERIFIED_ON,
  },
  "HW-S02": {
    id: "HW-S02",
    kind: "S",
    text: "Cube 做矩阵计算，Vector 做向量计算；Scalar 负责标量计算、流程控制和指令发射。",
    source: CANN,
    loc: "§4.2，PDF p33–34（正文 p27–28）",
    verifiedOn: VERIFIED_ON,
  },
  "HW-S03": {
    id: "HW-S03",
    kind: "S",
    text: "AIC 典型路径为 GM→L1→L0A/L0B→Cube→L0C→FixPipe→GM 或 L1；AIV 为 GM→UB→Vector→UB→GM。",
    source: CANN,
    loc: "§4.1 分离架构图与典型计算数据流，PDF p32（正文 p26）；§4.3，PDF p35（正文 p29）",
    verifiedOn: VERIFIED_ON,
  },
  "HW-S04": {
    id: "HW-S04",
    kind: "S",
    text: "核外 L2 Cache 缓存对 GM 的访问数据；L2 与核内 L1、L0、UB 是不同层级。",
    source: CANN,
    loc: "§4.2 说明，PDF p33（正文 p27）；§4.3，PDF p35（正文 p29）",
    verifiedOn: VERIFIED_ON,
  },
  "HW-S05": {
    id: "HW-S05",
    kind: "S",
    text: "Atlas 800I A2 是八昇腾模组服务器，八路 NPU 通过 HCCS 全互联，产品规格列有 HBM。",
    source: ATLAS,
    loc: "大模型推理解决方案 R24.0 彩页（25H2），PDF p3，产品规格及高速网络带宽",
    verifiedOn: VERIFIED_ON,
  },
  "HW-D01": {
    id: "HW-D01",
    kind: "D",
    text: "八节点全互联中，每节点有七个邻居，共 8×7÷2=28 对连接；这不等于物理 lane 数或官方端口编号。",
    source: "由 HW-S05 的八路 NPU 全互联按无向完全图推导。",
  },
  "HW-A01": {
    id: "HW-A01",
    kind: "A",
    text: "HBM 展示槽是概念分区，尚未核实 910B 各子型号的物理堆叠数；不得把 hbm[0..3] 标成四颗真实 HBM。",
    source: "教学建模边界；HW-S05 只证明产品使用 HBM，容量占位值不能用于推导堆叠数。",
  },
  "HW-A02": {
    id: "HW-A02",
    kind: "A",
    text: "单层演示假定权重常驻 HBM，按权重、激活、KV 划分逻辑区域；区域与槽位不代表实机地址分配。",
    source: "M1 驻留规则的教学假设；无设备内存分配或 profiler 记录。",
  },
  "HW-A03": {
    id: "HW-A03",
    kind: "A",
    text: "矩阵乘映射 Cube，RMSNorm、Softmax、RoPE、SwiGLU 与逐元素加法映射 Vector，是按运算性质选择的教学执行方式。",
    source: "依据 HW-S02/HW-S03 简化；不是对特定 CANN 或 vLLM-Ascend 融合算子调度的观测。",
  },
  "HW-A04": {
    id: "HW-A04",
    kind: "A",
    text: "若展示 HBM→L2→计算单元，必须标明省略核内缓冲与搬运单元；不表示整个张量同时驻留片上或每次访问均命中 L2。",
    source: "依据 HW-S03/HW-S04 折叠显示路径；计算单元不是存储器，实际计算依赖分块与局部缓冲。",
  },
  "HW-A05": {
    id: "HW-A05",
    kind: "A",
    text: "搬运字节按张量形状与教学 dtype 估算；教学步骤不等同 kernel 边界，也不代表含缓存复用、分块、融合的实际总线流量。",
    source: "M1 使用 TensorRecord.bytes 表示逻辑数据量，不作为设备带宽或性能实测。",
  },
  "HW-A06": {
    id: "HW-A06",
    kind: "A",
    text: "PCIe 锚点暂只表示概念连接；尚未核实目标模组的 Host 接线、代际、宽度与连接器形态。",
    source: "HW-S05 所在彩页 p3 的 PCIe 字段描述服务器扩展插槽，不能据此外推 NPU 模组接口。",
  },
};
