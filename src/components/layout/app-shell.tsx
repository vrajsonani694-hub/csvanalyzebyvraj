import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  BarChart3,
  Brain,
  FileSpreadsheet,
  LayoutDashboard,
  Moon,
  Sun,
  Table2,
  FileDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDatasetStore } from "@/store/dataset-store";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/preview", label: "Data", icon: Table2 },
  { to: "/analyze", label: "Analyze", icon: BarChart3 },
  { to: "/ml", label: "ML Studio", icon: Brain },
  { to: "/reports", label: "Reports", icon: FileDown },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const active = useDatasetStore((s) => s.active);
  const theme = useDatasetStore((s) => s.theme);
  const toggleTheme = useDatasetStore((s) => s.toggleTheme);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <Link to="/" className="flex items-center gap-2 border-b px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold leading-tight">AI CSV</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Analyzer Pro
            </p>
          </div>
        </Link>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          {active ? (
            <div className="rounded-lg bg-sidebar-accent/50 p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <p className="truncate text-xs font-medium" title={active.name}>
                  {active.name}
                </p>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {active.rows.length.toLocaleString()} rows · {active.columns.length} cols
              </p>
            </div>
          ) : (
            <p className="px-1 text-xs text-muted-foreground">No dataset loaded.</p>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b bg-background/70 px-4 py-3 backdrop-blur md:px-8">
          <div>
            <p className="text-xs text-muted-foreground">Workspace</p>
            <h1 className="font-display text-lg font-semibold">
              {active?.name ?? "AI CSV Analyzer Pro"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
