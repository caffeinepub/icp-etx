import { cn } from "@/lib/utils";
import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BarChart2,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  ShieldAlert,
  Wallet,
  Zap,
} from "lucide-react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

const navItems = [
  {
    label: "Dashboard",
    path: "/" as const,
    icon: LayoutDashboard,
    exact: true,
  },
  { label: "Funding", path: "/funding" as const, icon: CreditCard },
  { label: "Pair Trades", path: "/pair-trades" as const, icon: ArrowLeftRight },
  { label: "Baskets", path: "/baskets" as const, icon: Package },
  { label: "Analysis", path: "/analysis" as const, icon: BarChart2 },
  { label: "Risk", path: "/risk" as const, icon: ShieldAlert },
  { label: "Wallet", path: "/wallet" as const, icon: Wallet },
  { label: "Chat", path: "/chat" as const, icon: MessageSquare },
  { label: "Swap History", path: "/swap-history" as const, icon: History },
];

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8 flex items-center justify-center">
        <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md" />
        <Zap className="relative z-10 text-primary" size={18} />
      </div>
      <span className="font-bold text-lg tracking-wider">
        <span className="neon-text-cyan">ICP</span>
        <span className="text-foreground"> ETX</span>
      </span>
    </div>
  );
}

function PrincipalBadge({ principal }: { principal: string }) {
  const short = `${principal.slice(0, 5)}...${principal.slice(-4)}`;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/30 shadow-neon-cyan-sm">
      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      <span className="text-primary text-xs font-mono-data font-medium">
        {short}
      </span>
    </div>
  );
}

function NavItems({ onClick }: { onClick?: () => void }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <>
      {navItems.map((item) => {
        const isActive = item.exact
          ? currentPath === item.path
          : currentPath.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClick}
            data-ocid={`nav.${item.label.toLowerCase().replace(" ", "-")}.link`}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary/10 text-primary shadow-neon-cyan-sm border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            <item.icon
              size={18}
              className={cn(
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            />
            {item.label}
            {isActive && (
              <div className="ml-auto w-1 h-1 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </>
  );
}

function SidebarNav() {
  const { identity, clear } = useInternetIdentity();
  const navigate = useNavigate();
  const principal = identity?.getPrincipal().toString() ?? "";

  const handleLogout = () => {
    clear();
    navigate({ to: "/" });
  };

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-30">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <Logo />
      </div>

      {/* Principal badge */}
      {identity && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <PrincipalBadge principal={principal} />
        </div>
      )}

      {/* Nav items */}
      <nav
        className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
        aria-label="Main navigation"
      >
        <NavItems />
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          type="button"
          onClick={handleLogout}
          data-ocid="nav.logout.button"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 w-full"
        >
          <LogOut size={18} />
          Disconnect
        </button>
        <p className="mt-3 px-3 text-xs text-muted-foreground/60">
          © {new Date().getFullYear()}{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </aside>
  );
}

function MobileHeader() {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? "";

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-30 flex items-center justify-between px-4">
      <Logo />
      {identity && <PrincipalBadge principal={principal} />}
    </header>
  );
}

function MobileBottomNav() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  // Show first 6 items on mobile to avoid crowding
  const mobileItems = navItems.slice(0, 6);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border z-30 flex"
      aria-label="Mobile navigation"
    >
      {mobileItems.map((item) => {
        const isActive = item.exact
          ? currentPath === item.path
          : currentPath.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            data-ocid={`mobile-nav.${item.label.toLowerCase().replace(" ", "-")}.link`}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-all duration-200",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon
              size={20}
              className={cn(isActive && "drop-shadow-[0_0_6px_currentColor]")}
            />
            <span className="text-[10px] font-medium">
              {item.label.split(" ")[0]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <SidebarNav />
      <MobileHeader />
      <MobileBottomNav />

      {/* Main content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-16 lg:pb-0 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
