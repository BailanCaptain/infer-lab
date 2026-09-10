import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [
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
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
  worker: { format: "es" },
});
