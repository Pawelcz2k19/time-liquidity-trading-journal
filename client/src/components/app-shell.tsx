import { Link, useLocation } from "wouter";
import { ReactNode } from "react";
import {
  LayoutDashboard, ListChecks, NotebookPen, BookOpen, BarChart3,
  Settings as SettingsIcon, Moon, Sun, PlusCircle, TrendingUp,
} from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "@/components/ui/button";

interface NavItem { href: string; label: string; icon: any; testid: string; }
const NAV: NavItem[] = [
  { href: "/",          label: "Dashboard",  icon: LayoutDashboard, testid: "nav-dashboard" },
  { href: "/trades",    label: "Trade Log",  icon: ListChecks,      testid: "nav-trades" },
  { href: "/journal",   label: "Journal",    icon: NotebookPen,     testid: "nav-journal" },
  { href: "/playbooks", label: "Playbooks",  icon: BookOpen,        testid: "nav-playbooks" },
  { href: "/reports",   label: "Reports",    icon: BarChart3,       testid: "nav-reports" },
  { href: "/settings",  label: "Settings",   icon: SettingsIcon,    testid: "nav-settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Trading Journal</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Time-Liquidity</span>
          </div>
        </div>

        <div className="px-3 pt-3">
          <Link href="/trades/new" data-testid="link-new-trade">
            <Button className="w-full justify-start gap-2" size="sm">
              <PlusCircle className="w-4 h-4" /> New Trade
            </Button>
          </Link>
        </div>

        <nav className="flex-1 px-3 pt-4 space-y-1">
          {NAV.map(item => {
            const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} data-testid={item.testid}>
                <div
                  className={[
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer hover-elevate",
                    active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground",
                  ].join(" ")}
                >
                  <Icon className="w-4 h-4" /> {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={toggle} data-testid="button-theme-toggle">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-20 bg-sidebar text-sidebar-foreground border-b border-sidebar-border px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold">Trading Journal</span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggle} data-testid="button-theme-toggle-mobile">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-sidebar border-t border-sidebar-border grid grid-cols-6">
        {NAV.map(item => {
          const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} data-testid={`${item.testid}-mobile`}>
              <div className={["flex flex-col items-center py-2 text-[10px]", active ? "text-primary" : "text-sidebar-foreground/70"].join(" ")}>
                <Icon className="w-4 h-4" /> {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 min-w-0 pt-12 md:pt-0 pb-16 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
