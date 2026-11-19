import { BookOpen, Box, Cpu, House } from "lucide-react";
import { Link, useLocation } from "react-router";

const ENTRANCES = [
  { to: "/home", label: "首页", title: "首页", detail: "展开大模型推理之旅", icon: House },
  { to: "/wiki", label: "主章节", title: "主章节", detail: "按主题阅读完整内容", icon: BookOpen },
  { to: "/model", label: "模型", title: "模型探索", detail: "观察 GLM 的计算过程", icon: Box },
  { to: "/hardware", label: "硬件", title: "硬件探索", detail: "从机柜走进芯片", icon: Cpu },
];

export function SiteNav() {
  const { pathname } = useLocation();
  const reading = pathname === "/chapters" || pathname.startsWith("/wiki") || pathname.startsWith("/tools");
  const current = reading ? "/wiki" : ["/", "/archive/home"].includes(pathname) ? "/home" : pathname;
  return (
    <nav className="site-nav" aria-label="全站导航">
      {ENTRANCES.map(({ to, label, title, detail, icon: Icon }) => {
        const active = current === to;
        return (
          <Link
            key={to}
            to={to}
            aria-label={label}
            className={active ? "active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
