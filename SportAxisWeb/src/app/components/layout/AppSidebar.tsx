import { Link, useLocation } from "react-router";
import { PanelLeftClose, PanelLeft, Plus } from "lucide-react";

import { cn } from "../ui/utils";
import { getNavigation, isPathActive } from "./navigation";

/** The one action each role starts most sessions with, pinned under the logo. */
const PRIMARY_ACTION: Record<string, { label: string; to: string }> = {
  admin: { label: "New event", to: "/admin/events?new=1" },
};

/**
 * Desktop navigation.
 *
 * Charcoal rail, paper content: the chrome recedes and the page carries the
 * colour. The active item is a lifted surface with a crimson icon and a short
 * crimson tick at the edge, not a solid red pill: a saturated block on every
 * screen spends the accent on furniture and leaves nothing for the content.
 * The one solid-red element is the role's primary action. Groups carry quiet
 * labels so the list is a two-step lookup instead of a scan of fifteen items.
 * The account (and sign out) lives in the header, which every width can reach.
 */
export function AppSidebar({
  role,
  collapsed,
  onToggleCollapsed,
}: {
  role: string | undefined;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const { pathname } = useLocation();
  const { groups, footer } = getNavigation(role);
  // Hidden on the page that owns the same action, so two create buttons never compete.
  const primary = role ? PRIMARY_ACTION[role] : undefined;
  const action =
    primary && !pathname.startsWith(primary.to.split("?")[0])
      ? primary
      : undefined;

  const item = ({
    name,
    path,
    icon: Icon,
  }: {
    name: string;
    path: string;
    icon: React.ElementType;
  }) => {
    const active = isPathActive(path, pathname);
    return (
      <li key={path}>
        <Link
          to={path}
          aria-current={active ? "page" : undefined}
          title={collapsed ? name : undefined}
          className={cn(
            "t-nav group relative flex h-9 items-center gap-3 rounded-md px-2.5",
            "transition-colors duration-[140ms]",
            "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-nav-fg-strong",
            collapsed && "justify-center px-0",
            active
              ? "bg-nav-active text-nav-fg-strong"
              : "text-nav-fg hover:bg-nav-hover hover:text-nav-fg-strong",
          )}
        >
          {active && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 -left-3 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
            />
          )}
          <Icon
            className={cn(
              "size-[1.0625rem] shrink-0",
              active
                ? "text-crimson-400"
                : "text-current opacity-80 group-hover:opacity-100",
            )}
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
        "hidden shrink-0 flex-col bg-nav lg:flex",
        "transition-[width] duration-200 motion-reduce:transition-none",
        collapsed ? "w-[4.25rem]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2.5 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <img
          src="/sportaxis-mark-white.png"
          alt=""
          aria-hidden="true"
          className="size-7 shrink-0 object-contain"
        />
        {!collapsed && (
          <span className="min-w-0 leading-tight">
            <span className="block text-[0.9375rem] font-semibold tracking-[-0.01em] text-nav-fg-strong">
              SportAxis
            </span>
            <span className="block truncate text-[0.6875rem] text-nav-section">
              BatStateU ARASOF Sports Office
            </span>
          </span>
        )}
      </div>

      {action && (
        <div className={cn("px-3 pt-2 pb-1", collapsed && "px-2.5")}>
          <Link
            to={action.to}
            title={collapsed ? action.label : undefined}
            className={cn(
              "flex h-9 items-center justify-center gap-2 rounded-md bg-brand text-[0.8125rem] font-semibold text-brand-on",
              "shadow-[0_1px_2px_-1px_oklch(0_0_0/0.4)] transition-colors duration-[140ms] hover:bg-brand-hover",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-fg-strong",
            )}
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span>{action.label}</span>}
            {collapsed && <span className="sr-only">{action.label}</span>}
          </Link>
        </div>
      )}

      <nav
        aria-label="Main"
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((group, i) => (
          <div key={group.label ?? i} className={i > 0 ? "mt-5" : undefined}>
            {group.label && !collapsed && (
              <p className="px-2.5 pb-1.5 text-[0.6875rem] font-medium text-nav-section">
                {group.label}
              </p>
            )}
            {group.label && collapsed && (
              <div
                className="mx-auto mb-2 h-px w-6 bg-nav-border"
                aria-hidden="true"
              />
            )}
            <ul className="space-y-px">{group.items.map(item)}</ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-nav-border px-3 py-3">
        {footer.length > 0 && (
          <ul className="mb-1 space-y-px">{footer.map(item)}</ul>
        )}

        <div
          className={cn(
            "flex items-center justify-end",
            collapsed && "justify-center",
          )}
        >
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className={cn(
              "flex size-9 items-center justify-center rounded-md text-nav-fg",
              "transition-colors duration-[140ms] hover:bg-nav-hover hover:text-nav-fg-strong",
              "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-nav-fg-strong",
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
