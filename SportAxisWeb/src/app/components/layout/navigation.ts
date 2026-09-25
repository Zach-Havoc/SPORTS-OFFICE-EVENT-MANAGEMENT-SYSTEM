import {
  Archive, BarChart3, Calendar, CalendarCheck, CalendarRange, ClipboardList,
  FileBadge, FileText, Flag, Gavel, History, Home, Image as ImageIcon,
  LayoutDashboard, MapPin, Medal, Megaphone, Radio, Settings, Shield, Swords,
  TrendingUp, Trophy, UserCog, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  /** Shown in the mobile tab bar. At most four per role; the rest live in More. */
  primary?: boolean;
}

export interface NavGroup {
  /** Omitted for the lead group, which needs no label above a single item. */
  label?: string;
  items: NavItem[];
}

/**
 * The admin navigation used to be a flat list of fifteen items, which meant
 * every destination carried the same weight and finding one was a linear
 * scan. Grouping it by the job being done ("run the competition", "manage
 * people", "look something up") turns that scan into a two-step lookup.
 */
export function getNavigation(role: string | undefined): {
  groups: NavGroup[];
  footer: NavItem[];
} {
  if (!role) {
    return {
      groups: [
        {
          items: [
            { name: "Schedule", path: "/", icon: Home, primary: true },
            { name: "Live", path: "/live", icon: Radio, primary: true },
            { name: "Standings", path: "/leaderboard", icon: Medal, primary: true },
            { name: "Brackets", path: "/brackets", icon: Trophy },
            { name: "History", path: "/history", icon: History },
            { name: "News", path: "/announcements", icon: Megaphone, primary: true },
          ],
        },
      ],
      footer: [],
    };
  }

  if (role === "admin") {
    return {
      groups: [
        { items: [{ name: "Dashboard", path: "/admin", icon: LayoutDashboard, primary: true }] },
        {
          label: "Competition",
          items: [
            { name: "Events", path: "/admin/events", icon: Calendar, primary: true },
            { name: "Seasons", path: "/admin/seasons", icon: CalendarRange },
            { name: "Bracketing", path: "/admin/bracketing", icon: Trophy },
            { name: "Venues", path: "/admin/venues", icon: MapPin },
            { name: "Protests", path: "/admin/protests", icon: Gavel },
          ],
        },
        {
          label: "People",
          items: [
            { name: "Users", path: "/admin/users", icon: UserCog, primary: true },
            { name: "Coaches", path: "/admin/coaches", icon: Users },
            { name: "Requirements", path: "/admin/requirements", icon: FileBadge },
            { name: "Registration Codes", path: "/admin/registration-codes", icon: Shield },
          ],
        },
        {
          label: "Records",
          items: [
            { name: "Reports", path: "/admin/reports", icon: BarChart3, primary: true },
            { name: "History", path: "/admin/history", icon: History },
            { name: "Recovery & Audit", path: "/admin/trash", icon: Archive },
          ],
        },
      ],
      footer: [
        { name: "Site Content", path: "/admin/carousel", icon: ImageIcon },
        { name: "Settings", path: "/admin/settings", icon: Settings },
      ],
    };
  }

  if (role === "coach") {
    return {
      groups: [
        { items: [{ name: "Dashboard", path: "/coach", icon: LayoutDashboard, primary: true }] },
        {
          label: "My team",
          items: [
            { name: "Athletes", path: "/coach/athletes", icon: Users, primary: true },
            { name: "Line-up", path: "/coach/lineup", icon: Swords },
            { name: "Attendance", path: "/coach/attendance", icon: ClipboardList, primary: true },
            { name: "Performance", path: "/coach/performance", icon: TrendingUp },
            { name: "Requirements", path: "/coach/requirements", icon: FileText },
          ],
        },
        {
          label: "Competition",
          items: [
            { name: "Schedule", path: "/coach/schedule", icon: Calendar, primary: true },
            { name: "Protests", path: "/coach/protests", icon: Flag },
          ],
        },
        {
          label: "Communication",
          items: [{ name: "Announcements", path: "/coach/announcements", icon: Megaphone }],
        },
      ],
      footer: [{ name: "Settings", path: "/settings/account", icon: Settings }],
    };
  }

  if (role === "athlete") {
    return {
      groups: [
        { items: [{ name: "Home", path: "/athlete", icon: LayoutDashboard, primary: true }] },
        {
          label: "Me",
          items: [
            { name: "Schedule", path: "/athlete/schedule", icon: Calendar, primary: true },
            { name: "Attendance", path: "/athlete/attendance", icon: CalendarCheck, primary: true },
            { name: "Performance", path: "/athlete/performance", icon: TrendingUp },
            { name: "Requirements", path: "/athlete/requirements", icon: FileText },
          ],
        },
        {
          label: "Team",
          items: [{ name: "My Team", path: "/athlete/team", icon: Users, primary: true }],
        },
      ],
      footer: [{ name: "Settings", path: "/settings/account", icon: Settings }],
    };
  }

  if (role === "judge") {
    return {
      groups: [{ items: [{ name: "My Events", path: "/judge", icon: Gavel, primary: true }] }],
      footer: [{ name: "Settings", path: "/settings/account", icon: Settings }],
    };
  }

  return { groups: [], footer: [] };
}

export function flattenNav(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((g) => g.items);
}

/** Exact match for section roots so /coach never lights up on /coach/athletes. */
export function isPathActive(itemPath: string, pathname: string): boolean {
  if (itemPath === "/") return pathname === "/";
  const roots = ["/admin", "/coach", "/athlete", "/judge"];
  if (roots.includes(itemPath)) return pathname === itemPath;
  return pathname === itemPath || pathname.startsWith(itemPath + "/");
}
