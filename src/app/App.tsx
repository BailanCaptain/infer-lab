import { createHashRouter, RouterProvider } from "react-router";
import { AppShell } from "./AppShell";
import { HomePage } from "./pages/HomePage";

const router = createHashRouter([
  {
    path: "/",
    Component: AppShell,
    children: [{ index: true, Component: HomePage }],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
