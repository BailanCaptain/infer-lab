import { join, relative } from "node:path";
import type { Plugin } from "vite";
import { readReaderSnapshot } from "../../server/snapshot";
import { DIAGRAM_DIR, diagramRefs } from "./diagrams";
import { PAGE_DIRS } from "./pages";

/** dev 下 wiki 文件变了：页面收到后就地刷新快照，刷不到才整页重载（WikiPage 里监听同名事件） */
const WIKI_CHANGED = "wiki:changed";
const moduleId = "virtual:wiki-reader-snapshot";
const resolvedId = `\0${moduleId}`;
const pagePrefix = "virtual:wiki-reader-page/";

/** Embed metadata, bodies and identity from one locked read; never import a stale registry separately. */
export function wikiReaderPlugin(): Plugin {
  let root = process.cwd();
  const revisions = new Map<string, Map<string, string>>();
  return {
    name: "wiki-reader-snapshot",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === moduleId || id.startsWith(pagePrefix) ? `\0${id}` : undefined;
    },
    async load(id) {
      if (id.startsWith(`\0${pagePrefix}`)) {
        const [revision, page] = id.slice(pagePrefix.length + 1).split("/");
        const source = revisions.get(revision!)?.get(page!);
        if (!source) throw new Error("知识库版本已更新，请刷新页面。");
        return source;
      }
      if (id !== resolvedId) return;
      const snapshot = await readReaderSnapshot(root);
      const texts = new Map(snapshot.pageTexts.map((page) => [page.file, page]));
      const modules = new Map<string, string>();
      const loaders = snapshot.registry.pages.map((page) => {
        const { text, compiled } = texts.get(page.file)!;
        const refs = new Set(diagramRefs(text));
        modules.set(
          page.id,
          `export default ${JSON.stringify({ revision: snapshot.revision, file: page.file, text, compiled, diagrams: snapshot.diagrams.filter((d) => refs.has(d.id)) })};`,
        );
        return `${JSON.stringify(page.id)}:()=>import(${JSON.stringify(`${pagePrefix}${snapshot.revision}/${page.id}`)}).then(m=>m.default)`;
      });
      revisions.set(snapshot.revision, modules);
      // Retain the previous dev generation for imports already in flight.
      while (revisions.size > 2) revisions.delete(revisions.keys().next().value!);
      return `export default ${JSON.stringify({ revision: snapshot.revision, registry: snapshot.registry, skipped: snapshot.skipped })};\nconst pages={${loaders.join(",")}};export const loadPage=id=>pages[id]();`;
    },
    configureServer(server) {
      void readReaderSnapshot(root).catch((error) =>
        server.config.logger.warn(`知识库预热未完成：${String(error)}`),
      );
      const wiki = join(root, "wiki");
      const watched = [...PAGE_DIRS, "raw", DIAGRAM_DIR];
      server.watcher.add([join(wiki, "HANDBOOK.md"), ...watched.map((dir) => join(wiki, dir))]);
      let pending: ReturnType<typeof setTimeout> | undefined;
      const changed = (_event: string, file: string) => {
        const path = relative(wiki, file).replace(/\\/g, "/");
        const inWatched = watched.some((dir) => path.startsWith(`${dir}/`));
        // 图改了也要刷：正文没动但画面变了，页面上仍应是新图
        const relevant =
          path === "HANDBOOK.md" ||
          (inWatched && (path.endsWith(".md") || path.startsWith(`${DIAGRAM_DIR}/`)));
        if (!relevant) return;
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (module) server.moduleGraph.invalidateModule(module);
        // 一次发布会连着写好几个文件。逐个文件整页重载，读者会在批准途中被反复刷掉——
        // 面板状态丢了，在途的批准请求也断了。攒成一次通知，由页面自己就地换数据。
        clearTimeout(pending);
        pending = setTimeout(() => server.ws.send({ type: "custom", event: WIKI_CHANGED }), 250);
      };
      server.watcher.on("all", changed);
      server.httpServer?.once("close", () => {
        clearTimeout(pending);
        server.watcher.off("all", changed);
      });
    },
  };
}
