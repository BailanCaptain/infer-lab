import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { Plugin } from "vite";
import {
  type LockedEvidenceSnapshot,
  readLockedEvidenceSnapshot,
  readReaderSnapshot,
  readReaderSnapshotWithEvidenceLock,
} from "../../server/snapshot";
import { packCompiledNode } from "../../src/content/wiki/hast-pack";
import { extractReaderGraph } from "../../src/content/wiki/schema";
import { DIAGRAM_DIR, diagramRefs } from "./diagrams";
import { buildAllLockedEvidence, buildPageEvidenceFromLocked } from "./evidence";
import { PAGE_DIRS } from "./pages";
import { collectSnapshotPublishedRawPaths, emitStaticRawSnapshots, serveWikiRawPage } from "./raw-viewer";

/** dev 下 wiki 文件变了：页面收到后就地刷新快照，刷不到才整页重载（WikiPage 里监听同名事件） */
const WIKI_CHANGED = "wiki:changed";
const moduleId = "virtual:wiki-reader-snapshot";
const resolvedId = `\0${moduleId}`;
const pagePrefix = "virtual:wiki-reader-page/";
const indexPrefix = "virtual:wiki-reader-index/";
const graphPrefix = "virtual:wiki-reader-graph/";
const evidencePrefix = "virtual:wiki-reader-evidence/";

/** Embed metadata, bodies and identity from one locked read; never import a stale registry separately. */
export function wikiReaderPlugin(): Plugin {
  let root = process.cwd();
  let outDir = resolve(root, "dist");
  let isBuild = false;
  let lockedPublishedRawPaths: Set<string> | undefined;
  let lockedSearchIndex: { revision: string; json: string } | undefined;
  let lockedGraph: { revision: string; json: string } | undefined;
  let lockedEvidenceSnapshot: LockedEvidenceSnapshot | undefined;
  const revisions = new Map<
    string,
    {
      pages: Map<string, string>;
      searchIndex: string;
      searchIndexJson: string;
      graph: string;
      graphJson: string;
      lockedEvidence: LockedEvidenceSnapshot;
      evidenceJsonCache: Map<string, string>;
    }
  >();
  return {
    name: "wiki-reader-snapshot",
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
      isBuild = config.command === "build";
    },
    resolveId(id) {
      return id === moduleId ||
        id.startsWith(pagePrefix) ||
        id.startsWith(indexPrefix) ||
        id.startsWith(graphPrefix) ||
        id.startsWith(evidencePrefix)
        ? `\0${id}`
        : undefined;
    },
    async load(id) {
      if (id.startsWith(`\0${pagePrefix}`)) {
        const [revision, page] = id.slice(pagePrefix.length + 1).split("/");
        const source = revisions.get(revision!)?.pages.get(page!);
        if (!source) throw new Error("知识库版本已更新，请刷新页面。");
        return source;
      }
      if (id.startsWith(`\0${indexPrefix}`)) {
        const revision = id.slice(indexPrefix.length + 1);
        const source = revisions.get(revision)?.searchIndex;
        if (!source) throw new Error("知识库版本已更新，请刷新页面。");
        return source;
      }
      if (id.startsWith(`\0${graphPrefix}`)) {
        const revision = id.slice(graphPrefix.length + 1);
        const source = revisions.get(revision)?.graph;
        if (!source) throw new Error("知识库版本已更新，请刷新页面。");
        return source;
      }
      if (id.startsWith(`\0${evidencePrefix}`)) {
        const [revision, page] = id.slice(evidencePrefix.length + 1).split("/");
        const entry = revisions.get(revision!);
        if (!entry) throw new Error("知识库版本已更新，请刷新页面。");
        let json = entry.evidenceJsonCache.get(page!);
        if (!json) {
          const pack = buildPageEvidenceFromLocked(root, entry.lockedEvidence, page!);
          if (!pack) throw new Error("未找到对应知识库页面。");
          json = JSON.stringify(pack);
          entry.evidenceJsonCache.set(page!, json);
        }
        return `export default JSON.parse(${JSON.stringify(json)});`;
      }
      if (id !== resolvedId) return;
      const { reader: snapshot, locked } = await readReaderSnapshotWithEvidenceLock(root);
      lockedEvidenceSnapshot = locked;
      lockedPublishedRawPaths = collectSnapshotPublishedRawPaths(snapshot);
      const texts = new Map(snapshot.pageTexts.map((page) => [page.file, page]));
      const modules = new Map<string, string>();
      const loaders = snapshot.registry.pages.map((page) => {
        const { text, compiled } = texts.get(page.file)!;
        const refs = new Set(diagramRefs(text));
        // Keep compiled Markdown as data so Vite does not transform its entire tree as JavaScript.
        const payload = JSON.stringify({
          revision: snapshot.revision,
          file: page.file,
          ...(isBuild && compiled ? {} : { text }),
          ...(compiled ? { packedCompiled: packCompiledNode(compiled) } : {}),
          sources: page.sources,
          ...(page.rawSources ? { rawSources: page.rawSources } : {}),
          relations: page.relations,
          backlinks: page.backlinks,
          diagrams: snapshot.diagrams.filter((d) => refs.has(d.id)),
        });
        modules.set(page.id, `export default JSON.parse(${JSON.stringify(payload)});`);
        return `${JSON.stringify(page.id)}:()=>import(${JSON.stringify(`${pagePrefix}${snapshot.revision}/${page.id}`)}).then(m=>m.default)`;
      });
      const lightRegistry = {
        ...snapshot.registry,
        pages: snapshot.registry.pages.map(
          ({
            sources: _sources,
            rawSources: _rawSources,
            relations: _relations,
            backlinks: _backlinks,
            ...light
          }) => light,
        ),
      };
      const indexPayload = JSON.stringify(snapshot.searchIndex);
      lockedSearchIndex = { revision: snapshot.revision, json: indexPayload };
      const graphPayload = JSON.stringify(extractReaderGraph(snapshot.revision, snapshot.registry.pages));
      lockedGraph = { revision: snapshot.revision, json: graphPayload };
      revisions.set(snapshot.revision, {
        pages: modules,
        searchIndex: `export default JSON.parse(${JSON.stringify(indexPayload)});`,
        searchIndexJson: indexPayload,
        graph: `export default JSON.parse(${JSON.stringify(graphPayload)});`,
        graphJson: graphPayload,
        lockedEvidence: locked,
        evidenceJsonCache: new Map(),
      });
      // Retain the previous dev generation for imports already in flight.
      while (revisions.size > 2) revisions.delete(revisions.keys().next().value!);
      const fetchIndexExpr = `fetch(${JSON.stringify(`./wiki-search/index-${snapshot.revision}.json`)}).then(r=>{if(!r.ok)throw new Error("检索索引加载失败，请检查连接后重试。");return r.json();},()=>{throw new Error("检索索引加载失败，请检查连接后重试。");})`;
      const loadIndexExpr = isBuild
        ? `()=>${fetchIndexExpr}`
        : `()=>typeof window==="undefined"?import(${JSON.stringify(`${indexPrefix}${snapshot.revision}`)}).then(m=>m.default):${fetchIndexExpr}`;
      const fetchGraphExpr = `fetch(${JSON.stringify(`./wiki-graph/graph-${snapshot.revision}.json`)}).then(r=>{if(!r.ok)throw new Error("知识图谱加载失败，请检查连接后重试。");return r.json();},()=>{throw new Error("知识图谱加载失败，请检查连接后重试。");})`;
      const loadGraphExpr = isBuild
        ? `()=>${fetchGraphExpr}`
        : `()=>typeof window==="undefined"?import(${JSON.stringify(`${graphPrefix}${snapshot.revision}`)}).then(m=>m.default):${fetchGraphExpr}`;
      const buildRevLiteral = JSON.stringify(snapshot.revision);
      const fetchEvidenceExpr = `(id,rev)=>fetch(rev===${buildRevLiteral}?"./wiki-evidence/"+rev+"/"+encodeURIComponent(id)+".json":"/api/wiki/evidence?page="+encodeURIComponent(id)+"&revision="+encodeURIComponent(rev)).then(r=>{if(!r.ok)throw new Error("证据资料加载失败，请检查连接后重试。");return r.json();},()=>{throw new Error("证据资料加载失败，请检查连接后重试。");})`;
      const manifestJson = JSON.stringify({
        revision: snapshot.revision,
        registry: lightRegistry,
        skipped: snapshot.skipped,
      });
      if (isBuild) {
        return `export default ${manifestJson};\nconst pages={${loaders.join(",")}};export const loadPage=id=>pages[id]();export const loadSearchIndex=${loadIndexExpr};export const loadWikiGraph=${loadGraphExpr};export const loadPageEvidence=${fetchEvidenceExpr};`;
      }
      const evLoaders = snapshot.registry.pages.map(
        (page) =>
          `${JSON.stringify(page.id)}:()=>import(${JSON.stringify(`${evidencePrefix}${snapshot.revision}/${page.id}`)}).then(m=>m.default)`,
      );
      return `export default ${manifestJson};\nconst pages={${loaders.join(",")}};const evPages={${evLoaders.join(",")}};export const loadPage=id=>pages[id]();export const loadSearchIndex=${loadIndexExpr};export const loadWikiGraph=${loadGraphExpr};export const loadPageEvidence=(id,rev)=>typeof window==="undefined"&&rev===${buildRevLiteral}&&evPages[id]?evPages[id]():(${fetchEvidenceExpr})(id,rev);`;
    },
    configureServer(server) {
      void readReaderSnapshot(root).catch((error) =>
        server.config.logger.warn(`知识库预热未完成：${String(error)}`),
      );
      const wiki = join(root, "wiki");
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith("/wiki-evidence/")) {
          const pathname = new URL(req.url, "http://127.0.0.1").pathname;
          const m = /^\/wiki-evidence\/([a-f0-9]{64})\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(pathname);
          if (!m) {
            res.writeHead(404, {
              "content-type": "text/plain; charset=utf-8",
              "x-content-type-options": "nosniff",
            });
            res.end("未找到对应页面的证据资料。");
            return;
          }
          const entry = revisions.get(m[1]!);
          let json = entry?.evidenceJsonCache.get(m[2]!);
          if (!json) {
            const locked = entry?.lockedEvidence ?? (await readLockedEvidenceSnapshot(root));
            if (locked.revision === m[1]) {
              const pack = buildPageEvidenceFromLocked(root, locked, m[2]!);
              if (pack) {
                json = JSON.stringify(pack);
                entry?.evidenceJsonCache.set(m[2]!, json);
              }
            }
          }
          if (!json) {
            res.writeHead(404, {
              "content-type": "text/plain; charset=utf-8",
              "x-content-type-options": "nosniff",
            });
            res.end("知识库版本已更新或页面不存在，请刷新页面。");
            return;
          }
          res.writeHead(200, {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          });
          res.end(json);
          return;
        }
        if (req.url?.startsWith("/wiki-search/")) {
          const pathname = new URL(req.url, "http://127.0.0.1").pathname;
          const m = /^\/wiki-search\/index-([a-f0-9]{64})\.json$/.exec(pathname);
          if (!m) {
            res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
            res.end("未找到对应版本的检索索引。");
            return;
          }
          let json = revisions.get(m[1]!)?.searchIndexJson;
          if (!json) {
            const snapshot = await readReaderSnapshot(root);
            if (snapshot.revision === m[1]) json = JSON.stringify(snapshot.searchIndex);
          }
          if (!json) {
            res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
            res.end("知识库版本已更新，请刷新页面。");
            return;
          }
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(json);
          return;
        }
        if (req.url?.startsWith("/wiki-graph/")) {
          const pathname = new URL(req.url, "http://127.0.0.1").pathname;
          const m = /^\/wiki-graph\/(?:graph-)?([a-f0-9]{64})\.json$/.exec(pathname);
          if (!m) {
            res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
            res.end("未找到对应版本的知识图谱。");
            return;
          }
          let json = revisions.get(m[1]!)?.graphJson;
          if (!json) {
            const snapshot = await readReaderSnapshot(root);
            if (snapshot.revision === m[1]) {
              json = JSON.stringify(extractReaderGraph(snapshot.revision, snapshot.registry.pages));
            }
          }
          if (!json) {
            res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
            res.end("知识库版本已更新，请刷新页面。");
            return;
          }
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(json);
          return;
        }
        if (!req.url?.startsWith("/wiki-raw/")) return next();
        let url: URL;
        try {
          url = new URL(req.url, "http://127.0.0.1");
        } catch {
          res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
          res.end("非法请求地址。");
          return;
        }
        try {
          const snapshot = await readReaderSnapshot(root);
          const published = collectSnapshotPublishedRawPaths(snapshot);
          if (!serveWikiRawPage(req.method, url, res, wiki, published)) next();
        } catch {
          res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
          res.end("知识库快照暂不可用，请稍后重试。");
        }
      });
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
    async writeBundle(options) {
      const targetOut = options.dir ? resolve(root, options.dir) : outDir;
      const snapshot =
        lockedPublishedRawPaths && lockedSearchIndex && lockedGraph
          ? undefined
          : await readReaderSnapshot(root);
      const published = lockedPublishedRawPaths ?? collectSnapshotPublishedRawPaths(snapshot!);
      const searchEntry = lockedSearchIndex ?? {
        revision: snapshot!.revision,
        json: JSON.stringify(snapshot!.searchIndex),
      };
      const graphEntry = lockedGraph ?? {
        revision: snapshot!.revision,
        json: JSON.stringify(extractReaderGraph(snapshot!.revision, snapshot!.registry.pages)),
      };
      emitStaticRawSnapshots(join(root, "wiki"), targetOut, published);
      const searchDir = join(targetOut, "wiki-search");
      mkdirSync(searchDir, { recursive: true });
      writeFileSync(join(searchDir, `index-${searchEntry.revision}.json`), searchEntry.json, "utf8");
      const graphDir = join(targetOut, "wiki-graph");
      mkdirSync(graphDir, { recursive: true });
      writeFileSync(join(graphDir, `graph-${graphEntry.revision}.json`), graphEntry.json, "utf8");
      const lockedEvidence = lockedEvidenceSnapshot ?? (await readLockedEvidenceSnapshot(root));
      const evidenceDir = join(targetOut, "wiki-evidence", lockedEvidence.revision);
      mkdirSync(evidenceDir, { recursive: true });
      for (const [pageId, pack] of buildAllLockedEvidence(root, lockedEvidence)) {
        writeFileSync(join(evidenceDir, `${pageId}.json`), JSON.stringify(pack), "utf8");
      }
    },
  };
}
