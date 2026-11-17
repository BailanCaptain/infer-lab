import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  createWikiRehypePlugins,
  type HastNode,
  WIKI_REHYPE_PLUGINS,
  WIKI_REMARK_PLUGINS,
} from "../../src/content/wiki/markdown";

const baseProcessor = unified()
  .use(remarkParse)
  .use(WIKI_REMARK_PLUGINS ?? [])
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(WIKI_REHYPE_PLUGINS ?? []);

/** Same transforms as the reader; raw HTML and URLs still pass ReactMarkdown's rendering safeguards. */
export function compileMarkdown(body: string, legacyAnchors?: Readonly<Record<string, string>>): HastNode {
  const hasLegacy = Boolean(legacyAnchors && Object.keys(legacyAnchors).length > 0);
  const processor = hasLegacy
    ? unified()
        .use(remarkParse)
        .use(WIKI_REMARK_PLUGINS ?? [])
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(createWikiRehypePlugins(legacyAnchors) ?? [])
    : baseProcessor;
  const tree = processor.runSync(processor.parse(body));
  const compact = (node: { position?: unknown; children?: unknown[] }) => {
    delete node.position;
    for (const child of node.children ?? []) compact(child as typeof node);
  };
  compact(tree);
  return tree as HastNode;
}
