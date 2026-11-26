import { useSyncExternalStore } from "react";
import {
  ASCEND_CALC_CARDS,
  type AscendCalcCardId,
  WAVE4_DEMO_PRESETS,
} from "../../sim/modelspec/deployCalculator";
import { extractStructuralHfConfig, parseHfConfig } from "../../sim/modelspec/parseHfConfig";
import { getPresetSpec, MODEL_PRESETS } from "../../sim/modelspec/presets";
import type { ModelSpec } from "../../sim/modelspec/types";
import { evaluateCalculatorModelGate } from "./workbenchHandoff";

export const TARGET_MACHINE_STORAGE_KEY = "infer-lab:target-machine:v1";
export const TARGET_MACHINE_PAGE_STORAGE_PREFIX = "infer-lab:target-machine:page:";
export const MAX_CUSTOM_HF_CONFIG_BYTES = 64 * 1024;
export const CUSTOM_INFERENCE_BADGE_TEXT = "自定义推演态（静态推导，非实测）";
export const DEFAULT_RULER_BASELINE_MODEL = "qwen3-8b";
export const DEFAULT_RULER_CARD_ID: AscendCalcCardId = "a2-64g";
export const DEFAULT_RULER_GPU_UTIL = 0.9;

export type RulerWeightPrecision = "bf16" | "fp16" | "w8a8" | "w8a8_dynamic" | "w8a8sc_310p";
export type RulerTpSize = 1 | 2 | 4 | 8;
export type RulerMaxModelLen = 4096 | 32768 | 131072;

export interface RulerPresetOption {
  id: string;
  label: string;
  group: "baseline" | "wave4";
}

export const RULER_MODEL_PRESETS: readonly RulerPresetOption[] = [
  ...MODEL_PRESETS.map((p) => ({
    id: p.id,
    label:
      p.id === "qwen3-8b"
        ? `${p.name}（稠密审定基线）`
        : p.id === "qwen3-30b-a3b"
          ? `${p.name}（MoE 审定基线）`
          : p.name,
    group: "baseline" as const,
  })),
  ...WAVE4_DEMO_PRESETS.map((d) => ({
    id: d.id,
    label: `${d.shortLabel}（架构样例）`,
    group: "wave4" as const,
  })),
];

export const RULER_PRECISION_OPTIONS: readonly { value: RulerWeightPrecision; label: string }[] = [
  { value: "bf16", label: "BF16（2 B/数）" },
  { value: "fp16", label: "FP16（2 B/数 · 310P）" },
  { value: "w8a8", label: "W8A8（静态 INT8）" },
  { value: "w8a8_dynamic", label: "W8A8_DYNAMIC（动态 INT8）" },
  { value: "w8a8sc_310p", label: "W8A8SC（310P 稀疏）" },
];

export const RULER_TP_OPTIONS: readonly RulerTpSize[] = [1, 2, 4, 8];

export const RULER_MAX_LEN_OPTIONS: readonly { value: RulerMaxModelLen; label: string }[] = [
  { value: 4096, label: "4K (4,096)" },
  { value: 32768, label: "32K (32,768)" },
  { value: 131072, label: "128K (131,072)" },
];

export const RULER_U_OPTIONS: readonly number[] = [0.82, 0.85, 0.88, 0.9, 0.92, 0.95];

const ALLOWED_CARD_IDS = new Set<AscendCalcCardId>(ASCEND_CALC_CARDS.map((c) => c.id));
const ALLOWED_PRECISIONS = new Set<RulerWeightPrecision>([
  "bf16",
  "fp16",
  "w8a8",
  "w8a8_dynamic",
  "w8a8sc_310p",
]);
const ALLOWED_TP = new Set<RulerTpSize>(RULER_TP_OPTIONS);
const ALLOWED_MAX_LEN = new Set<RulerMaxModelLen>([4096, 32768, 131072]);
const ALLOWED_PRESET_IDS = new Set<string>(RULER_MODEL_PRESETS.map((p) => p.id));

export interface TargetMachineState {
  modelMode: "preset" | "custom";
  presetOverrideId: string | null;
  customDraftText: string;
  validatedCustomJsonText: string;
  customSpec: ModelSpec | null;
  customError: string | null;
  cardId: AscendCalcCardId;
  weightPrecision: RulerWeightPrecision;
  tpSize: RulerTpSize;
  maxModelLen: RulerMaxModelLen;
  gpuMemoryUtilization: number;
  enableEp: boolean;
}

export const DEFAULT_TARGET_MACHINE_STATE: TargetMachineState = {
  modelMode: "preset",
  presetOverrideId: null,
  customDraftText: "",
  validatedCustomJsonText: "",
  customSpec: null,
  customError: null,
  cardId: DEFAULT_RULER_CARD_ID,
  weightPrecision: "bf16",
  tpSize: 1,
  maxModelLen: 32768,
  gpuMemoryUtilization: DEFAULT_RULER_GPU_UTIL,
  enableEp: false,
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function resolveFenceBaselinePresetId(fenceModel?: string | undefined): string {
  if (!fenceModel) return DEFAULT_RULER_BASELINE_MODEL;
  const trimmed = fenceModel.trim();
  if (!trimmed) return DEFAULT_RULER_BASELINE_MODEL;
  const norm = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
  const modelHit = MODEL_PRESETS.find(
    (p) =>
      p.id.toLowerCase() === trimmed.toLowerCase() ||
      p.id.toLowerCase().replace(/[^a-z0-9]/g, "") === norm ||
      p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === norm ||
      p.hfRepo.toLowerCase().replace(/[^a-z0-9]/g, "") === norm,
  );
  if (modelHit) return modelHit.id;
  const wave4Hit = WAVE4_DEMO_PRESETS.find(
    (d) =>
      d.id.toLowerCase() === trimmed.toLowerCase() ||
      d.id.toLowerCase().replace(/[^a-z0-9]/g, "") === norm ||
      d.shortLabel.toLowerCase() === trimmed.toLowerCase(),
  );
  if (wave4Hit) return wave4Hit.id;
  return DEFAULT_RULER_BASELINE_MODEL;
}

export function validateCustomHfConfigText(
  rawText: string,
): { ok: true; spec: ModelSpec; normalizedJson: string } | { ok: false; error: string } {
  const byteLength = new TextEncoder().encode(rawText).byteLength;
  if (byteLength > MAX_CUSTOM_HF_CONFIG_BYTES) {
    return {
      ok: false,
      error: `自定义 config.json 大小（${(byteLength / 1024).toFixed(1)} KB）超过 64 KB 安全上限，请仅保留模型结构字段后再粘贴或拖入。`,
    };
  }
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: false, error: "请粘贴或拖入 HuggingFace config.json（JSON 对象）。" };
  }
  if (!trimmed.startsWith("{")) {
    return { ok: false, error: "自定义 config.json 须为合法的 JSON 对象（以 { 开头）。" };
  }
  const gate = evaluateCalculatorModelGate(trimmed, true);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }
  if (!gate.supportedInWave3) {
    return { ok: false, error: gate.reason };
  }
  try {
    const parsedObj: unknown = JSON.parse(trimmed);
    const cleanObj = extractStructuralHfConfig(parsedObj);
    const spec = parseHfConfig(cleanObj);
    return { ok: true, spec, normalizedJson: JSON.stringify(cleanObj) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "解析 config.json 失败，请核对关键维度字段。",
    };
  }
}

export function resolveSpecByPresetId(presetId: string): ModelSpec {
  const gate = evaluateCalculatorModelGate(presetId, false);
  if (gate.ok && gate.supportedInWave3) {
    return gate.spec;
  }
  return getPresetSpec(DEFAULT_RULER_BASELINE_MODEL);
}

export function resolveEffectiveRulerModel(
  state: TargetMachineState,
  fenceModel?: string | undefined,
): {
  spec: ModelSpec;
  activePresetId: string | null;
  baselinePresetId: string;
  isCustomModel: boolean;
  isDeviated: boolean;
} {
  const baselinePresetId = resolveFenceBaselinePresetId(fenceModel);
  const fallbackPresetId = state.presetOverrideId ?? baselinePresetId;
  const isCustomModel = state.modelMode === "custom" && state.customSpec !== null;
  const spec = isCustomModel ? state.customSpec! : resolveSpecByPresetId(fallbackPresetId);
  const activePresetId = isCustomModel ? null : fallbackPresetId;
  const isDeviated =
    isCustomModel ||
    (state.presetOverrideId !== null && state.presetOverrideId !== baselinePresetId) ||
    state.cardId !== DEFAULT_RULER_CARD_ID ||
    state.weightPrecision !== "bf16" ||
    state.tpSize !== 1 ||
    state.maxModelLen !== 32768 ||
    Math.abs(state.gpuMemoryUtilization - DEFAULT_RULER_GPU_UTIL) > 1e-6 ||
    state.enableEp !== false;

  return { spec, activePresetId, baselinePresetId, isCustomModel, isDeviated };
}

interface PersistedTargetMachinePayload {
  v: 1;
  modelMode: "preset" | "custom";
  presetOverrideId: string | null;
  validatedCustomJsonText?: string;
  customJsonText?: string;
  cardId: AscendCalcCardId;
  weightPrecision: RulerWeightPrecision;
  tpSize: RulerTpSize;
  maxModelLen: RulerMaxModelLen;
  gpuMemoryUtilization: number;
  enableEp: boolean;
}

function getDefaultBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function clampGpuUtil(u: number): number {
  if (!Number.isFinite(u)) return DEFAULT_RULER_GPU_UTIL;
  return Number(Math.min(0.98, Math.max(0.5, u)).toFixed(2));
}

function hydrateStateFromStorage(
  storage: StorageLike | null,
  storageKey: string = TARGET_MACHINE_STORAGE_KEY,
): TargetMachineState {
  if (!storage) return DEFAULT_TARGET_MACHINE_STATE;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return DEFAULT_TARGET_MACHINE_STATE;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return DEFAULT_TARGET_MACHINE_STATE;
    }
    const obj = parsed as Partial<PersistedTargetMachinePayload>;
    const cardId = obj.cardId && ALLOWED_CARD_IDS.has(obj.cardId) ? obj.cardId : DEFAULT_RULER_CARD_ID;
    const weightPrecision =
      obj.weightPrecision && ALLOWED_PRECISIONS.has(obj.weightPrecision) ? obj.weightPrecision : "bf16";
    const tpSize = obj.tpSize && ALLOWED_TP.has(obj.tpSize) ? obj.tpSize : 1;
    const maxModelLen = obj.maxModelLen && ALLOWED_MAX_LEN.has(obj.maxModelLen) ? obj.maxModelLen : 32768;
    const gpuMemoryUtilization =
      typeof obj.gpuMemoryUtilization === "number"
        ? clampGpuUtil(obj.gpuMemoryUtilization)
        : DEFAULT_RULER_GPU_UTIL;
    const enableEp = Boolean(obj.enableEp);
    const presetOverrideId =
      typeof obj.presetOverrideId === "string" && ALLOWED_PRESET_IDS.has(obj.presetOverrideId)
        ? obj.presetOverrideId
        : null;

    const persistedCustomJson =
      typeof obj.validatedCustomJsonText === "string" ? obj.validatedCustomJsonText : obj.customJsonText;
    if (obj.modelMode === "custom" && typeof persistedCustomJson === "string") {
      const checked = validateCustomHfConfigText(persistedCustomJson);
      if (checked.ok) {
        const hydratedCustom: TargetMachineState = {
          modelMode: "custom",
          presetOverrideId,
          customDraftText: checked.normalizedJson,
          validatedCustomJsonText: checked.normalizedJson,
          customSpec: checked.spec,
          customError: null,
          cardId,
          weightPrecision,
          tpSize,
          maxModelLen,
          gpuMemoryUtilization,
          enableEp,
        };
        if (obj.customJsonText !== undefined || persistedCustomJson !== checked.normalizedJson) {
          persistStateToStorage(storage, hydratedCustom, storageKey);
        }
        return hydratedCustom;
      }
    }

    const hydratedPreset: TargetMachineState = {
      modelMode: "preset",
      presetOverrideId,
      customDraftText: "",
      validatedCustomJsonText: "",
      customSpec: null,
      customError: null,
      cardId,
      weightPrecision,
      tpSize,
      maxModelLen,
      gpuMemoryUtilization,
      enableEp,
    };
    if (obj.customJsonText !== undefined || obj.validatedCustomJsonText !== undefined) {
      persistStateToStorage(storage, hydratedPreset, storageKey);
    }
    return hydratedPreset;
  } catch {
    return DEFAULT_TARGET_MACHINE_STATE;
  }
}

function persistStateToStorage(
  storage: StorageLike | null,
  state: TargetMachineState,
  storageKey: string = TARGET_MACHINE_STORAGE_KEY,
): void {
  if (!storage) return;
  try {
    const hasValidCustom =
      state.modelMode === "custom" && state.customSpec !== null && state.validatedCustomJsonText.length > 0;
    const payload: PersistedTargetMachinePayload = {
      v: 1,
      modelMode: hasValidCustom ? "custom" : "preset",
      presetOverrideId: state.presetOverrideId,
      ...(hasValidCustom ? { validatedCustomJsonText: state.validatedCustomJsonText } : {}),
      cardId: state.cardId,
      weightPrecision: state.weightPrecision,
      tpSize: state.tpSize,
      maxModelLen: state.maxModelLen,
      gpuMemoryUtilization: state.gpuMemoryUtilization,
      enableEp: state.enableEp,
    };
    storage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Ignore SecurityError / QuotaExceededError in privacy or sandboxed browser modes.
  }
}

export interface TargetMachineStore {
  getSnapshot: () => TargetMachineState;
  subscribe: (listener: () => void) => () => void;
  setPreset: (presetId: string) => void;
  applyCustomConfig: (rawJson: string) => { ok: boolean; error: string | null };
  setCardId: (cardId: AscendCalcCardId) => void;
  setWeightPrecision: (precision: RulerWeightPrecision) => void;
  setTpSize: (tpSize: RulerTpSize) => void;
  setMaxModelLen: (maxModelLen: RulerMaxModelLen) => void;
  setGpuMemoryUtilization: (u: number) => void;
  setEnableEp: (enableEp: boolean) => void;
  resetToBaseline: () => void;
}

export function createTargetMachineStore(
  customStorage?: StorageLike | null,
  storageKey: string = TARGET_MACHINE_STORAGE_KEY,
): TargetMachineStore {
  const storage = customStorage === undefined ? getDefaultBrowserStorage() : customStorage;
  let state: TargetMachineState = hydrateStateFromStorage(storage, storageKey);
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const commit = (next: TargetMachineState, persist = true) => {
    state = next;
    if (persist) persistStateToStorage(storage, state, storageKey);
    emit();
  };

  if (customStorage === undefined && typeof window !== "undefined") {
    try {
      window.addEventListener("storage", (e) => {
        if (e.key === storageKey) {
          state = hydrateStateFromStorage(getDefaultBrowserStorage(), storageKey);
          emit();
        }
      });
    } catch {
      // Ignore environments without storage events.
    }
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setPreset: (presetId) => {
      if (!ALLOWED_PRESET_IDS.has(presetId)) return;
      commit({
        ...state,
        modelMode: "preset",
        presetOverrideId: presetId,
        customError: null,
      });
    },
    applyCustomConfig: (rawJson) => {
      const checked = validateCustomHfConfigText(rawJson);
      if (checked.ok) {
        commit({
          ...state,
          modelMode: "custom",
          customDraftText: checked.normalizedJson,
          validatedCustomJsonText: checked.normalizedJson,
          customSpec: checked.spec,
          customError: null,
        });
        return { ok: true, error: null };
      }
      commit(
        {
          ...state,
          modelMode: state.modelMode,
          customDraftText: rawJson.slice(0, MAX_CUSTOM_HF_CONFIG_BYTES + 256),
          customError: checked.error,
        },
        false,
      );
      return { ok: false, error: checked.error };
    },
    setCardId: (cardId) => {
      if (!ALLOWED_CARD_IDS.has(cardId) || state.cardId === cardId) return;
      commit({ ...state, cardId });
    },
    setWeightPrecision: (weightPrecision) => {
      if (!ALLOWED_PRECISIONS.has(weightPrecision) || state.weightPrecision === weightPrecision) return;
      commit({ ...state, weightPrecision });
    },
    setTpSize: (tpSize) => {
      if (!ALLOWED_TP.has(tpSize) || state.tpSize === tpSize) return;
      commit({ ...state, tpSize });
    },
    setMaxModelLen: (maxModelLen) => {
      if (!ALLOWED_MAX_LEN.has(maxModelLen) || state.maxModelLen === maxModelLen) return;
      commit({ ...state, maxModelLen });
    },
    setGpuMemoryUtilization: (u) => {
      const nextU = clampGpuUtil(u);
      if (Math.abs(state.gpuMemoryUtilization - nextU) < 1e-6) return;
      commit({ ...state, gpuMemoryUtilization: nextU });
    },
    setEnableEp: (enableEp) => {
      if (state.enableEp === enableEp) return;
      commit({ ...state, enableEp });
    },
    resetToBaseline: () => {
      state = { ...DEFAULT_TARGET_MACHINE_STATE };
      try {
        storage?.removeItem(storageKey);
      } catch {
        // Ignore privacy mode exceptions.
      }
      emit();
    },
  };
}

export const targetMachineStore: TargetMachineStore = createTargetMachineStore();

const pageStoreCache = new Map<string, TargetMachineStore>();

export function getPageTargetMachineStore(
  pageSlug: string,
  customStorage?: StorageLike | null,
): TargetMachineStore {
  const slug = pageSlug.trim();
  if (!slug) return targetMachineStore;
  const key = `${TARGET_MACHINE_PAGE_STORAGE_PREFIX}${slug}`;
  if (customStorage !== undefined) {
    return createTargetMachineStore(customStorage, key);
  }
  const existing = pageStoreCache.get(slug);
  if (existing) return existing;
  const created = createTargetMachineStore(undefined, key);
  pageStoreCache.set(slug, created);
  return created;
}

export function resetAllPageTargetMachineStores(): void {
  for (const store of pageStoreCache.values()) {
    store.resetToBaseline();
  }
  pageStoreCache.clear();
}

export function useTargetMachine(store: TargetMachineStore = targetMachineStore): TargetMachineState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
