import { createHashRouter, RouterProvider } from "react-router";
import { AppShell } from "./AppShell";
import { SpikeCPage } from "./pages/dev/SpikeCPage";
import { HomePage } from "./pages/HomePage";
import { WikiPage } from "./pages/WikiPage";

const router = createHashRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, Component: HomePage },
      { path: "wiki", Component: WikiPage },
      { path: "wiki/:id", Component: WikiPage },
      { path: "dev/spike-c", Component: SpikeCPage },
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
  return <RouterProvider router={router} />;
}
