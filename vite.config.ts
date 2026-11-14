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
        },
      },
    },
  },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
  worker: { format: "es" },
});
