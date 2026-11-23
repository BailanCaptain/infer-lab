import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { defineConfig } from "vite";
import { wikiReaderPlugin } from "./scripts/wiki/reader-plugin";

export default defineConfig({
  base: "./",
  plugins: [
    wikiReaderPlugin(),
    // 只处理 .mdx：wiki/ 下的 .md 要以 ?raw 原文读取，交给 react-markdown 渲染，
    // 若让 MDX 插件接手会被编译成组件（曾导致 text.startsWith is not a function）。
    {
      enforce: "pre",
      ...mdx({ include: /\.mdx$/, remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm] }),
    },
    react({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
    tailwindcss(),
  ],
  resolve: { alias: { "@": "/src" } },
  // 问答服务在 server/，dev 下经代理走同源，避免 CORS
  server: {
    host: "127.0.0.1",
    // Build artifacts, receipts and cloned sources are not frontend inputs.
    watch: {
      ignored: [
        "**/preview-dist/**",
        "**/tools/wiki-runtime/**",
        "**/tools/repos/**",
        "**/tools/corpus/**",
        "**/wiki/_jobs/**",
        // Scratch dirs at the repo root (hundreds of MB), never imported by the app.
        "**/tmp/**",
        "**/.tmp/**",
      ],
    },
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.WIKI_SERVER_PORT ?? 8790}`,
        // 后端的写入保护要求 Origin 与 Host 一致（server/http.ts checkWriter）。
        // 代理会把 Host 换成后端地址，浏览器里点「批准」就永远 403；这里把读者看到的 Host 原样带过去。
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.headers.host) proxyReq.setHeader("host", req.headers.host);
          });
          // 仅运行 pnpm dev（未起 dev:server）时，将连接拒绝转为显式未启动标记（区分纯静态部署），避免 502 污染浏览器控制台。
          proxy.on("error", (_err, _req, res) => {
            if ("writeHead" in res && !res.headersSent) {
              res.writeHead(200, {
                "content-type": "text/plain; charset=utf-8",
                "x-wiki-backend-offline": "1",
                "x-wiki-backend-reason": "service-down",
                "cache-control": "no-store",
              });
              res.end("service-down");
            } else if ("end" in res && !("writableEnded" in res && res.writableEnded)) {
              res.end();
            }
          });
        },
      },
    },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](?:react|react-dom|react-router|scheduler)[\\/]/,
              priority: 40,
            },
            {
              name: "three-vendor",
              test: /node_modules[\\/]three[\\/]/,
              priority: 35,
            },
            {
              name: "markdown-katex",
              test: /node_modules[\\/](?:katex|rehype-katex|remark-|rehype-|unified|react-markdown|micromark|mdast-|hast-|unist-|vfile|property-information|space-separated-tokens|comma-separated-tokens|html-url-attributes|decode-named-character-reference|character-entities|zwitch|longest-streak|ccount|markdown-table|bail|trough|devlop|is-plain-obj|trim-lines|escape-string-regexp)/,
              priority: 30,
            },
            {
              name: "wiki-snapshot",
              test: /virtual:wiki-reader-snapshot/,
              priority: 28,
            },
            {
              name: "sim-rules",
              test: /[\\/]src[\\/]sim[\\/]rules[\\/]/,
              priority: 22,
            },
            {
              name: "sim-modelspec",
              test: /[\\/]src[\\/]sim[\\/]modelspec[\\/]/,
              priority: 20,
            },
            {
              name: "sim-doctor",
              test: /[\\/]src[\\/]sim[\\/]doctor[\\/]/,
              priority: 20,
            },
            {
              name: "sim-troubleshoot",
              test: /[\\/]src[\\/]sim[\\/]troubleshoot[\\/]/,
              priority: 20,
            },
            {
              name: "sim-aicore",
              test: /[\\/]src[\\/]sim[\\/]aicore[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  worker: { format: "es" },
});
