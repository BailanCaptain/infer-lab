import type { CompiledNode } from "./schema";

export type PackedFallbackNode = {
  type: string;
  tagName?: string | undefined;
  value?: string | undefined;
  properties?: Record<string, unknown> | undefined;
  children?: PackedHastNode[] | undefined;
};

export type PackedHastNode =
  | string
  | 2
  | [0, string]
  | [1, string]
  | ["r", ...PackedHastNode[]]
  | ["w", string]
  | ["e", string, 0 | Record<string, unknown>, ...PackedHastNode[]]
  | ["n", PackedFallbackNode];

const KNOWN_TEXT_KEYS = new Set(["type", "value"]);
const KNOWN_ROOT_KEYS = new Set(["type", "children"]);
const KNOWN_ELEMENT_KEYS = new Set(["type", "tagName", "properties", "children"]);

function hasOnlyKeys(obj: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key) && obj[key] !== undefined) return false;
  }
  return true;
}

function isPureTextNode(node: CompiledNode | undefined): node is { type: "text"; value: string } {
  return (
    node !== undefined &&
    node.type === "text" &&
    typeof node.value === "string" &&
    node.tagName === undefined &&
    node.properties === undefined &&
    node.children === undefined &&
    hasOnlyKeys(node as Record<string, unknown>, KNOWN_TEXT_KEYS)
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isExactClassProps(props: Record<string, unknown> | undefined, expected: readonly string[]): boolean {
  if (!isPlainRecord(props)) return false;
  const keys = Object.keys(props);
  if (keys.length !== 1 || keys[0] !== "className") return false;
  const cls = props.className;
  if (!Array.isArray(cls) || cls.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (cls[i] !== expected[i]) return false;
  }
  return true;
}

function isPackableClassList(cls: readonly unknown[]): cls is readonly string[] {
  if (cls.length === 0) return false;
  for (const item of cls) {
    if (typeof item !== "string" || item.length === 0 || /\s/.test(item)) return false;
  }
  return true;
}

function cloneJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (isPlainRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = cloneJsonValue(v);
    }
    return out;
  }
  return value;
}

function packElementProps(props: Record<string, unknown>): 0 | Record<string, unknown> {
  const entries = Object.entries(props).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return 0;
  const out: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (key === "className" && Array.isArray(value)) {
      const items: readonly unknown[] = value;
      out.className = isPackableClassList(items) ? items.join(" ") : items.map(cloneJsonValue);
    } else {
      out[key] = cloneJsonValue(value);
    }
  }
  return out;
}

function unpackElementProps(packed: 0 | Record<string, unknown>): Record<string, unknown> {
  if (packed === 0) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(packed)) {
    if (key === "className" && typeof value === "string") {
      out.className = value.split(" ");
    } else {
      out[key] = cloneJsonValue(value);
    }
  }
  return out;
}

/**
 * 将 `CompiledNode` 编码为紧凑 JSON 元组：
 * - 纯文本 → `value` 字符串
 * - `span.wiki-cell` → `[0, value]`
 * - `span.wiki-cell.is-wide` → `[1, value]`
 * - 空 `<wbr>` → `2`
 * - `root` → `["r", ...children]`
 * - `raw` → `["w", value]`
 * - 标准 `element` → `["e", tagName, propsOrZero, ...children]`
 * - 其余特殊节点 → `["n", fallback]` 保底无损还原
 */
export function packCompiledNode(node: CompiledNode): PackedHastNode {
  if (isPureTextNode(node)) {
    return node.value;
  }

  if (
    node.type === "raw" &&
    typeof node.value === "string" &&
    node.tagName === undefined &&
    node.properties === undefined &&
    node.children === undefined &&
    hasOnlyKeys(node as Record<string, unknown>, KNOWN_TEXT_KEYS)
  ) {
    return ["w", node.value];
  }

  if (
    node.type === "root" &&
    Array.isArray(node.children) &&
    node.tagName === undefined &&
    node.value === undefined &&
    node.properties === undefined &&
    hasOnlyKeys(node as Record<string, unknown>, KNOWN_ROOT_KEYS)
  ) {
    return ["r", ...node.children.map(packCompiledNode)];
  }

  if (
    node.type === "element" &&
    typeof node.tagName === "string" &&
    node.value === undefined &&
    isPlainRecord(node.properties) &&
    Array.isArray(node.children) &&
    hasOnlyKeys(node as Record<string, unknown>, KNOWN_ELEMENT_KEYS)
  ) {
    if (
      node.tagName === "wbr" &&
      node.children.length === 0 &&
      Object.keys(node.properties).every((k) => node.properties![k] === undefined)
    ) {
      return 2;
    }

    if (node.tagName === "span" && node.children.length === 1 && isPureTextNode(node.children[0])) {
      const textValue = node.children[0].value;
      if (isExactClassProps(node.properties, ["wiki-cell"])) {
        return [0, textValue];
      }
      if (isExactClassProps(node.properties, ["wiki-cell", "is-wide"])) {
        return [1, textValue];
      }
    }

    // 若原 properties.className 本身就是字符串而非数组，走保底分支避免 unpack 误拆为数组
    if (typeof node.properties.className !== "string") {
      return ["e", node.tagName, packElementProps(node.properties), ...node.children.map(packCompiledNode)];
    }
  }

  const fallback: PackedFallbackNode = { type: node.type };
  if (node.tagName !== undefined) fallback.tagName = node.tagName;
  if (node.value !== undefined) fallback.value = node.value;
  if (node.properties !== undefined) {
    fallback.properties = cloneJsonValue(node.properties) as Record<string, unknown>;
  }
  if (node.children !== undefined) {
    fallback.children = node.children.map(packCompiledNode);
  }
  return ["n", fallback];
}

export function unpackCompiledNode(packed: PackedHastNode): CompiledNode {
  if (typeof packed === "string") {
    return { type: "text", value: packed };
  }
  if (packed === 2) {
    return { type: "element", tagName: "wbr", properties: {}, children: [] };
  }
  if (!Array.isArray(packed) || packed.length === 0) {
    throw new Error("非法的紧凑 HAST 节点格式");
  }
  const tag = packed[0];
  if (tag === 0) {
    if (packed.length !== 2 || typeof packed[1] !== "string") {
      throw new Error("非法的 wiki-cell 紧凑节点");
    }
    return {
      type: "element",
      tagName: "span",
      properties: { className: ["wiki-cell"] },
      children: [{ type: "text", value: packed[1] }],
    };
  }
  if (tag === 1) {
    if (packed.length !== 2 || typeof packed[1] !== "string") {
      throw new Error("非法的 wiki-cell is-wide 紧凑节点");
    }
    return {
      type: "element",
      tagName: "span",
      properties: { className: ["wiki-cell", "is-wide"] },
      children: [{ type: "text", value: packed[1] }],
    };
  }
  if (tag === "r") {
    const children: CompiledNode[] = [];
    for (let i = 1; i < packed.length; i++) {
      children.push(unpackCompiledNode(packed[i] as PackedHastNode));
    }
    return { type: "root", children };
  }
  if (tag === "w") {
    if (packed.length !== 2 || typeof packed[1] !== "string") {
      throw new Error("非法的 raw 紧凑节点");
    }
    return { type: "raw", value: packed[1] };
  }
  if (tag === "e") {
    if (packed.length < 3 || typeof packed[1] !== "string") {
      throw new Error("非法的 element 紧凑节点");
    }
    const rawProps = packed[2];
    if (rawProps !== 0 && !isPlainRecord(rawProps)) {
      throw new Error("非法的 element 属性紧凑节点");
    }
    const children: CompiledNode[] = [];
    for (let i = 3; i < packed.length; i++) {
      children.push(unpackCompiledNode(packed[i] as PackedHastNode));
    }
    return {
      type: "element",
      tagName: packed[1],
      properties: unpackElementProps(rawProps),
      children,
    };
  }
  if (tag === "n") {
    if (packed.length !== 2 || !isPlainRecord(packed[1]) || typeof packed[1].type !== "string") {
      throw new Error("非法的 fallback 紧凑节点");
    }
    const raw = packed[1] as PackedFallbackNode;
    const out: CompiledNode = { type: raw.type };
    if (typeof raw.tagName === "string") out.tagName = raw.tagName;
    if (typeof raw.value === "string") out.value = raw.value;
    if (isPlainRecord(raw.properties)) {
      out.properties = cloneJsonValue(raw.properties) as Record<string, unknown>;
    }
    if (Array.isArray(raw.children)) {
      out.children = raw.children.map(unpackCompiledNode);
    }
    return out;
  }
  throw new Error("未知的紧凑 HAST 节点标记");
}

export function isPackedHastNode(value: unknown): value is PackedHastNode {
  if (typeof value === "string" || value === 2) return true;
  if (!Array.isArray(value) || value.length === 0) return false;
  const tag = value[0];
  if (tag === 0 || tag === 1 || tag === "w") {
    return value.length === 2 && typeof value[1] === "string";
  }
  if (tag === "r") {
    for (let i = 1; i < value.length; i++) {
      if (!isPackedHastNode(value[i])) return false;
    }
    return true;
  }
  if (tag === "e") {
    if (value.length < 3 || typeof value[1] !== "string") return false;
    const props = value[2];
    if (props !== 0 && !isPlainRecord(props)) return false;
    for (let i = 3; i < value.length; i++) {
      if (!isPackedHastNode(value[i])) return false;
    }
    return true;
  }
  if (tag === "n") {
    if (value.length !== 2 || !isPlainRecord(value[1]) || typeof value[1].type !== "string") {
      return false;
    }
    const raw = value[1];
    if (raw.tagName !== undefined && typeof raw.tagName !== "string") return false;
    if (raw.value !== undefined && typeof raw.value !== "string") return false;
    if (raw.properties !== undefined && !isPlainRecord(raw.properties)) return false;
    if (raw.children !== undefined) {
      if (!Array.isArray(raw.children)) return false;
      for (const child of raw.children) {
        if (!isPackedHastNode(child)) return false;
      }
    }
    return true;
  }
  return false;
}

export function isPackedHastRoot(value: unknown): value is PackedHastNode {
  if (!Array.isArray(value) || value.length === 0) return false;
  if (value[0] === "r") return isPackedHastNode(value);
  if (value[0] === "n") {
    return (
      isPackedHastNode(value) &&
      isPlainRecord(value[1]) &&
      value[1].type === "root" &&
      Array.isArray(value[1].children)
    );
  }
  return false;
}
