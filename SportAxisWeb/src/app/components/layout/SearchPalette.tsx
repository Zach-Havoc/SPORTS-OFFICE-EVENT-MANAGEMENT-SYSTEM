import { useMemo } from "react";
import { CalendarDays } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { getNavigation } from "./navigation";
import { useEvents } from "../../hooks/api";

/**
 * The header's Ctrl/Cmd+K search. Its own module so cmdk only downloads the
 * first time someone opens search, not with every page load.
 */
export default function SearchPalette({
  role,
  open,
  onOpenChange,
  go,
}: {
  role: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  go: (to: string) => void;
}) {
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

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
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
  );
}
