import { lazy, Suspense } from "react";
import { createHashRouter, RouterProvider } from "react-router";
import { AppShell } from "./AppShell";
import { ExperiencePage } from "./pages/ExperiencePage";

const WikiPage = lazy(async () => ({ default: (await import("./pages/WikiPage")).WikiPage }));
const HomePage = lazy(async () => ({ default: (await import("./pages/HomePage")).HomePage }));
const ToolsPage = lazy(async () => ({ default: (await import("./pages/ToolsPage")).ToolsPage }));

// Commit the destination shell before loading its content, releasing the outgoing 3D scene.
const wikiRoute = {
  element: (
    <Suspense
      fallback={
        <p className="reader-loading" role="status">
          正在载入知识库…
        </p>
      }
    >
      <WikiPage />
    </Suspense>
  ),
};
const homeRoute = {
  element: (
    <Suspense
      fallback={
        <p className="reader-loading" role="status">
          正在载入首页…
        </p>
      }
    >
      <HomePage />
    </Suspense>
  ),
};
const toolsRoute = {
  element: (
    <Suspense
      fallback={
        <p className="reader-loading" role="status">
          正在载入交互工程工作台…
        </p>
      }
    >
      <ToolsPage />
    </Suspense>
  ),
};

// 旧链接仍可读；主阅读入口不加载历史课程及 3D。
const legacyCourseRoute = {
  HydrateFallback: () => (
    <p className="reader-loading" role="status">
      正在载入章节…
    </p>
  ),
  lazy: async () => ({ Component: (await import("./pages/CoursePage")).CoursePage }),
};

const router = createHashRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, ...homeRoute },
      { path: "home", ...homeRoute },
      { path: "chapters", ...wikiRoute },
      { path: "chapters/:id", ...legacyCourseRoute },
      { path: "model", element: <ExperiencePage kind="model" /> },
      { path: "hardware", element: <ExperiencePage kind="hardware" /> },
      { path: "wiki", ...wikiRoute },
      { path: "wiki/:id", ...wikiRoute },
      { path: "tools", ...toolsRoute },
      { path: "archive/home", ...homeRoute },
      {
        path: "*",
        lazy: async () => ({ Component: (await import("./pages/CoursePage")).NotFoundPage }),
      },
      {
        path: "dev/spike-c",
        lazy: async () => ({ Component: (await import("./pages/dev/SpikeCPage")).SpikeCPage }),
      },
      // 样式试样只给开发时挑方案用：构建里 DEV 是 false，整段被摇掉
      ...(import.meta.env.DEV
        ? [
            {
              path: "dev/wiki-specimen",
              HydrateFallback: () => null,
              lazy: async () => ({
                Component: (await import("./pages/dev/WikiSpecimenPage")).WikiSpecimenPage,
              }),
            },
          ]
        : []),
    ],
  },
]);

export function App() {
  // Leaving an active 3D iframe must commit the destination immediately.
  return <RouterProvider router={router} useTransitions={false} />;
}
