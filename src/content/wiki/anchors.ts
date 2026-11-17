/**
 * 标题锚点的唯一规则。正文里写 `xxx.md#锚点` 按它写，阅读页给标题生成 id 也只用它。
 *
 * 与 GitHub 渲染 markdown 的规则一致，作者在 GitHub 上预览时同一个锚点也能用：
 * 转小写，去掉标点和符号，空格变成 `-`；中文、字母、数字、`-`、`_` 原样保留。
 * 例：`## 剩下的显存变成多少 KV cache` → `剩下的显存变成多少-kv-cache`。
 */
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");
}

/** 一页之内的锚点：同名标题依次加 `-1`、`-2`，与 GitHub 的去重方式相同 */
export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = headingSlug(text);
    let slug = base;
    while (seen.has(slug)) {
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      slug = `${base}-${n}`;
    }
    seen.set(slug, 0);
    return slug;
  };
}

/** 结构化的 mdast 节点。@types/mdast 没装，这里只声明真正用到的字段。 */
type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hProperties?: Record<string, unknown> };
};

/** 标题的纯文字：行内代码、链接文字、加粗都按文字算 */
function plainText(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(plainText).join("");
}

/** 给每个标题挂上 id，经 mdast-util-to-hast 落到 `<h2 id>` 上 */
export function remarkHeadingIds() {
  return (tree: MdNode) => {
    const slug = createSlugger();
    const walk = (node: MdNode) => {
      for (const child of node.children ?? []) {
        if (child.type === "heading") {
          child.data = {
            ...child.data,
            hProperties: { ...child.data?.hProperties, id: slug(plainText(child)) },
          };
        } else {
          walk(child);
        }
      }
    };
    walk(tree);
  };
}

/** location.hash（`#锚点`，浏览器可能已百分号编码）→ 元素 id */
export function fragmentId(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 解析 legacyAnchors 的目标值：既可直接写目标标题文本，也可写已规范化/带去重后缀的锚点 slug */
export function resolveLegacyAnchorTarget(target: string, validIds: ReadonlySet<string>): string | undefined {
  const trimmed = target.trim();
  if (!trimmed) return undefined;
  if (validIds.has(trimmed)) return trimmed;
  const slug = headingSlug(trimmed);
  return slug && validIds.has(slug) ? slug : undefined;
}

type HastLike = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastLike[];
};

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/**
 * 为 frontmatter.legacyAnchors 声明的旧锚点注入零文本 `<span id="..." class="wiki-legacy-anchor" aria-hidden="true">`，
 * 挂载在目标标题元素内部，既兼容 PageToc（只读 h2/h3），又保留 `expandAncestorDetails` 自动展开与跳转。
 */
export function rehypeLegacyAnchors(legacyAnchors?: Readonly<Record<string, string>>) {
  return (tree: HastLike) => {
    if (!legacyAnchors) return;
    const entries = Object.entries(legacyAnchors);
    if (entries.length === 0) return;

    const existingIds = new Set<string>();
    const headingById = new Map<string, HastLike>();
    const walk = (node: HastLike) => {
      if (node.type === "element") {
        const id = node.properties?.id;
        if (typeof id === "string" && id.length > 0) {
          existingIds.add(id);
          if (HEADING_TAGS.has(node.tagName ?? "") && !headingById.has(id)) {
            headingById.set(id, node);
          }
        }
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);

    for (const [oldSlug, target] of entries) {
      if (!oldSlug || existingIds.has(oldSlug)) continue;
      const resolvedId = resolveLegacyAnchorTarget(target, existingIds);
      if (!resolvedId) continue;
      const heading = headingById.get(resolvedId);
      if (!heading) continue;
      existingIds.add(oldSlug);
      heading.children = [
        {
          type: "element",
          tagName: "span",
          properties: {
            id: oldSlug,
            className: ["wiki-legacy-anchor"],
            ariaHidden: "true",
          },
          children: [],
        },
        ...(heading.children ?? []),
      ];
    }
  };
}
