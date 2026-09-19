import { join, relative } from "node:path";
import type { Plugin } from "vite";
import { readReaderSnapshot } from "../../server/snapshot";
import { DIAGRAM_DIR } from "./diagrams";
import { PAGE_DIRS } from "./pages";

/** dev 下 wiki 文件变了：页面收到后就地刷新快照，刷不到才整页重载（WikiPage 里监听同名事件） */
const WIKI_CHANGED = "wiki:changed";
const moduleId = "virtual:wiki-reader-snapshot";
const resolvedId = `\0${moduleId}`;

/** Embed metadata, bodies and identity from one locked read; never import a stale registry separately. */
export function wikiReaderPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: "wiki-reader-snapshot",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === moduleId ? resolvedId : undefined;
    },
    async load(id) {
      if (id !== resolvedId) return;
      const snapshot = await readReaderSnapshot(root);
      return `export default ${JSON.stringify(snapshot)};`;
    },
    configureServer(server) {
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
