import { absMax, type Tensor } from "../tensor/tensor";
import { type LazyWeight, weightThumb } from "../weights";
import type { Step, TensorId, TensorRecord, TensorRole } from "./types";

type StepInput = Omit<Step, "hardware"> & { hardware?: Step["hardware"] };

/**
 * Recorder：前向过程中登记张量、记录步骤。hardware 字段由 mapResidency 后处理填充。
 */
export class Recorder {
  readonly tensors: Record<TensorId, TensorRecord> = {};
  readonly steps: Step[] = [];
  constructor(private readonly bytesPerElem: number) {}

  /** bytesPerElem 可覆盖模型 dtype（如 int32 id），与 JS Float32 容器解耦。 */
  dense(id: TensorId, name: string, t: Tensor, role: TensorRole, bytesPerElem = this.bytesPerElem): TensorId {
    if (this.tensors[id]) throw new Error(`张量 id 重复：${id}`);
    this.tensors[id] = {
      id,
      name,
      shape: [...t.shape],
      dims: [...t.dims],
      role,
      data: t.data,
      bytes: t.data.length * bytesPerElem,
      absMax: absMax(t),
    };
    return id;
  }

  weight(name: string, w: LazyWeight): TensorId {
    if (this.tensors[w.id]) return w.id;
    const thumb = weightThumb(w);
    let m = 0;
    for (const v of thumb.data) m = Math.max(m, Math.abs(v));
    this.tensors[w.id] = {
      id: w.id,
      name,
      shape: [...w.shape],
      dims: [...w.dims],
      role: "weight",
      lazy: w,
      thumb,
      bytes: w.shape[0] * w.shape[1] * this.bytesPerElem,
      absMax: m,
    };
    return w.id;
  }

  step(s: StepInput): void {
    if (this.steps.some((x) => x.id === s.id)) throw new Error(`step id 重复：${s.id}`);
    for (const t of s.model.tensors)
      if (!this.tensors[t]) throw new Error(`step ${s.id} 引用未登记张量 ${t}`);
    this.steps.push({
      ...s,
      hardware: s.hardware ?? { residency: {}, transfers: [], active: [] },
    });
  }
}
