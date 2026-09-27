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
