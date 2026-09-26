import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CalendarDays, ChevronDown, LogOut, Search, UserRound } from "lucide-react";

import { cn } from "../ui/utils";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import NotificationBell from "./NotificationBell";
import { getNavigation, isPathActive, type NavItem } from "./navigation";
import { useEvents } from "../../hooks/api";

/** Two-letter initials for the avatar: first and last word of the name. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/**
 * The page the user is on, from the navigation itself: the most specific
 * item whose path matches, with its group so the header reads as a location
 * ("Competition / Events") rather than repeating the page's own heading.
 */
function currentPlace(role: string, pathname: string) {
  const { groups, footer } = getNavigation(role);
  let best: { item: NavItem; group?: string } | null = null;
  const consider = (item: NavItem, group?: string) => {
    if (!isPathActive(item.path, pathname)) return;
    if (!best || item.path.length > best.item.path.length) best = { item, group };
  };
  groups.forEach((g) => g.items.forEach((i) => consider(i, g.label)));
  footer.forEach((i) => consider(i));
  return best as { item: NavItem; group?: string } | null;
}

/**
 * Signed-in header: where you are, a search that jumps to any page (and, for
 * the office, any event), notifications, and the account menu. The profile
 * lives here rather than at the foot of the sidebar so it is reachable at
 * every width without opening navigation.
 */
export function AppHeader({
  role,
  userName,
  userMeta,
  onLogout,
}: {
  role: string;
  userName: string;
  userMeta: string;
  onLogout: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const place = currentPlace(role, pathname);
  const title = place?.item.name ?? (pathname.startsWith("/settings") ? "Account settings" : "SportAxis");

  // Ctrl/Cmd+K opens search from anywhere in the console.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pages = useMemo(() => {
    const { groups, footer } = getNavigation(role);
    return [
      ...groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label ?? "Home" }))),
      ...footer.map((i) => ({ ...i, group: "Settings" })),
    ];
  }, [role]);

  // Only the office manages events, so only its search lists them. The query
  // is shared with the dashboard and the Events page, so this costs nothing
  // extra there, and it only runs once search is opened elsewhere.
  const isAdmin = role === "admin";
  const eventsQuery = useEvents(undefined, { enabled: isAdmin && open });
  const events = useMemo(
    () =>
      (eventsQuery.data ?? [])
        .slice()
        .sort((a: any, b: any) => String(b.schedule).localeCompare(String(a.schedule))),
    [eventsQuery.data],
  );

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-baseline gap-1.5">
          {place?.group && (
            <span className="t-label hidden truncate text-text-muted md:inline">
              {place.group}
              <span className="mx-1.5 text-border-strong" aria-hidden="true">/</span>
            </span>
          )}
          <span className="t-subsection truncate">{title}</span>
        </p>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-text-muted",
          "transition-colors duration-[140ms] hover:border-border-strong hover:text-text",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--focus-ring]",
          "sm:w-64 lg:w-72",
        )}
        aria-label="Search"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden flex-1 text-left text-[0.8125rem] sm:inline">
          {isAdmin ? "Search pages and events" : "Search pages"}
        </span>
        <kbd className="hidden rounded border border-border bg-bg-subtle px-1.5 py-0.5 font-sans text-[0.6875rem] text-text-muted sm:inline">
          Ctrl K
        </kbd>
      </button>

      <NotificationBell />

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-2.5 rounded-md py-1 pl-1 pr-1.5",
            "transition-colors duration-[140ms] hover:bg-surface-hover",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--focus-ring]",
          )}
          aria-label={`Account: ${userName}`}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-nav text-[0.75rem] font-semibold text-nav-fg-strong"
            aria-hidden="true"
          >
            {initials(userName)}
          </span>
          <span className="hidden min-w-0 text-left md:block">
            <span className="block max-w-40 truncate text-[0.8125rem] font-medium leading-tight text-text">
              {userName}
            </span>
            <span className="block max-w-40 truncate text-xs leading-tight text-text-muted">{userMeta}</span>
          </span>
          <ChevronDown className="hidden size-3.5 text-text-muted md:block" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium text-text">{userName}</span>
            <span className="block truncate text-xs text-text-muted">{userMeta}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/settings/account")}>
            <UserRound className="size-4" aria-hidden="true" />
            Account settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onLogout}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search SportAxis"
        description={isAdmin ? "Jump to a page or an event" : "Jump to a page"}
      >
        <CommandInput placeholder={isAdmin ? "Search pages and events…" : "Search pages…"} />
        <CommandList>
          <CommandEmpty>Nothing matches. Try a page name{isAdmin ? ", an event or a sport" : ""}.</CommandEmpty>
          <CommandGroup heading="Pages">
            {pages.map(({ name, path, icon: Icon, group }) => (
              <CommandItem key={path} value={`${name} ${group}`} onSelect={() => go(path)}>
                <Icon aria-hidden="true" />
                <span>{name}</span>
                <span className="ml-auto text-xs text-text-muted">{group}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          {isAdmin && events.length > 0 && (
            <CommandGroup heading="Events">
              {events.map((e: any) => (
                <CommandItem
                  key={e.id}
                  value={`${e.name} ${e.category} ${e.schedule}`}
                  onSelect={() => go(`/admin/events?q=${encodeURIComponent(e.name)}`)}
                >
                  <CalendarDays aria-hidden="true" />
                  <span className="truncate">{e.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-text-muted">
                    {e.category} · {e.schedule}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
