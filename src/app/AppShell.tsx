import { Outlet } from "react-router";

export function AppShell() {
  return (
    <div className="min-h-full bg-canvas text-ink">
      <Outlet />
    </div>
  );
}
