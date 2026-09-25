import { Link, useLocation } from "react-router";
import { LogOut, PanelLeftClose, PanelLeft } from "lucide-react";

import { cn } from "../ui/utils";
import { getNavigation, isPathActive } from "./navigation";

/**
 * Desktop navigation.
 *
 * The active item is a filled surface with brand-coloured text, not a solid
 * red pill: a saturated block on every screen spends the accent on furniture
 * and leaves nothing for the content. Groups carry quiet labels so the list
 * is a two-step lookup instead of a linear scan of fifteen items.
 */
export function AppSidebar({
  role,
  userName,
  userMeta,
  collapsed,
  onToggleCollapsed,
  onLogout,
}: {
  role: string | undefined;
  userName: string;
  userMeta: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onLogout: () => void;
}) {
  const { pathname } = useLocation();
  const { groups, footer } = getNavigation(role);

  const item = (
    { name, path, icon: Icon }: { name: string; path: string; icon: React.ElementType },
  ) => {
    const active = isPathActive(path, pathname);
    return (
      <li key={path}>
        <Link
          to={path}
          aria-current={active ? "page" : undefined}
          title={collapsed ? name : undefined}
          className={cn(
            "t-nav group relative flex items-center gap-3 rounded-md px-2.5 py-2",
            "transition-colors duration-[140ms]",
            collapsed && "justify-center px-0",
            active
              ? "bg-nav-active text-nav-fg-strong"
              : "text-nav-fg hover:bg-nav-hover hover:text-nav-fg-strong",
          )}
        >
          <Icon
            className={cn("size-4 shrink-0", active ? "text-brand" : "text-current")}
            aria-hidden="true"
          />
          {!collapsed && <span className="truncate">{name}</span>}
        </Link>
      </li>
    );
  };

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "hidden shrink-0 flex-col border-r border-nav-border bg-nav lg:flex",
        "transition-[width] duration-200",
        collapsed ? "w-[4.25rem]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center gap-2.5 border-b border-nav-border px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <img
          src="/sportaxis-mark-white.png"
          alt=""
          aria-hidden="true"
          className="size-6 shrink-0 object-contain"
        />
        {!collapsed && (
          <span className="t-nav font-semibold text-nav-fg-strong">SportAxis</span>
        )}
      </div>

      <nav
        aria-label="Main"
        className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((group, i) => (
          <div key={group.label ?? i} className={i > 0 ? "mt-6" : undefined}>
            {group.label && !collapsed && (
              <p className="t-overline px-2.5 pb-1.5 text-nav-section">{group.label}</p>
            )}
            {group.label && collapsed && (
              <div className="mx-auto mb-2 h-px w-6 bg-nav-border" aria-hidden="true" />
            )}
            <ul className="space-y-0.5">{group.items.map(item)}</ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-nav-border px-3 py-3">
        {footer.length > 0 && <ul className="mb-2 space-y-0.5">{footer.map(item)}</ul>}

        {!collapsed && (
          <div className="mb-2 px-2.5 py-1.5">
            <p className="truncate text-[0.8125rem] font-medium text-nav-fg-strong">
              {userName}
            </p>
            <p className="truncate text-xs text-nav-section">{userMeta}</p>
          </div>
        )}

        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          <button
            type="button"
            onClick={onLogout}
            className={cn(
              "t-nav flex flex-1 items-center gap-3 rounded-md px-2.5 py-2 text-nav-fg",
              "transition-colors duration-[140ms] hover:bg-nav-hover hover:text-nav-fg-strong",
              collapsed && "w-full justify-center px-0",
            )}
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Sign out</span>}
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-nav-fg",
              "transition-colors duration-[140ms] hover:bg-nav-hover hover:text-nav-fg-strong",
            )}
          >
            {collapsed ? (
              <PanelLeft className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
