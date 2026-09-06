import { createHashRouter, RouterProvider } from "react-router";
import { AppShell } from "./AppShell";
import { SpikeCPage } from "./pages/dev/SpikeCPage";
import { HomePage } from "./pages/HomePage";

const router = createHashRouter([
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, Component: HomePage },
      { path: "dev/spike-c", Component: SpikeCPage },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
