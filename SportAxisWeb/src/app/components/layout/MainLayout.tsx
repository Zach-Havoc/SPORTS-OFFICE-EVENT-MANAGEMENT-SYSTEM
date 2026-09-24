import { useState } from "react";
import { Outlet, useLocation, useNavigation, Link } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/button";
import {
  Trophy,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
  Calendar,
  Settings,
  Users,
  FileText,
  BarChart3,
  History,
  Gavel,
  Medal,
  Home,
  Shield,
  User,
  ChevronRight,
  Megaphone,
  ClipboardList,
  TrendingUp,
  UserCog,
  MapPin,
  Radio,
  Swords,
  Archive,
  CalendarRange,
  CalendarCheck,
  Flag,
  Image as ImageIcon,
  FileBadge,
} from "lucide-react";
import { cn } from "../ui/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import Loading from "../Loading";
import SitePopup from "../public/SitePopup";
import NotificationBell from "./NotificationBell";

export default function MainLayout() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const routerNavigation = useNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Successfully logged out. See you next time!");
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout. Please try again.");
    }
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  // Define navigation items based on user role
  const getNavigationItems = () => {
    if (!user) {
      return {
        main: [
          { name: "Match Schedule", path: "/", icon: Home },
          { name: "Live Scores", path: "/live", icon: Radio },
          { name: "Brackets", path: "/brackets", icon: Trophy },
          { name: "Leaderboard", path: "/leaderboard", icon: Medal },
          { name: "History", path: "/history", icon: History },
          { name: "Announcements", path: "/announcements", icon: Megaphone },
        ],
        bottom: [],
      };
    }

    if (user.role === "admin") {
      return {
        main: [
          { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
          { name: "Events", path: "/admin/events", icon: Calendar },
          { name: "Seasons", path: "/admin/seasons", icon: CalendarRange },
          { name: "Venues", path: "/admin/venues", icon: MapPin },
          { name: "Bracketing", path: "/admin/bracketing", icon: Trophy },
          { name: "Coaches", path: "/admin/coaches", icon: Users },
          { name: "Users", path: "/admin/users", icon: UserCog },
          {
            name: "CMO Requirements",
            path: "/admin/requirements",
            icon: FileBadge,
          },
          { name: "Reports", path: "/admin/reports", icon: BarChart3 },
          { name: "Protests", path: "/admin/protests", icon: Gavel },
          { name: "History", path: "/admin/history", icon: History },
        ],
        bottom: [
          { name: "Recovery & Audit", path: "/admin/trash", icon: Archive },
          {
            name: "Registration Codes",
            path: "/admin/registration-codes",
            icon: Shield,
          },
          { name: "Site Content", path: "/admin/carousel", icon: ImageIcon },
          { name: "Settings", path: "/admin/settings", icon: Settings },
        ],
      };
    }

    if (user.role === "coach") {
      return {
        main: [
          { name: "Dashboard", path: "/coach", icon: LayoutDashboard },
          { name: "My Athletes", path: "/coach/athletes", icon: Users },
          { name: "My Schedule", path: "/coach/schedule", icon: Calendar },
          { name: "Line-up", path: "/coach/lineup", icon: Swords },
          {
            name: "Attendance",
            path: "/coach/attendance",
            icon: ClipboardList,
          },
          { name: "Performance", path: "/coach/performance", icon: TrendingUp },
          { name: "CMO Requirements", path: "/coach/requirements", icon: FileText },
          {
            name: "Announcements",
            path: "/coach/announcements",
            icon: Megaphone,
          },
          { name: "Protests", path: "/coach/protests", icon: Flag },
        ],
        bottom: [
          { name: "Settings", path: "/settings/account", icon: Settings },
        ],
      };
    }

    if (user.role === "athlete") {
      return {
        main: [
          { name: "Dashboard", path: "/athlete", icon: LayoutDashboard },
          { name: "My Schedule", path: "/athlete/schedule", icon: Calendar },
          {
            name: "Performance",
            path: "/athlete/performance",
            icon: TrendingUp,
          },
          {
            name: "CMO Requirements",
            path: "/athlete/requirements",
            icon: FileText,
          },
          {
            name: "Attendance",
            path: "/athlete/attendance",
            icon: CalendarCheck,
          },
          {
            name: "My Team",
            path: "/athlete/team",
            icon: Users,
          },
        ],
        bottom: [
          { name: "Settings", path: "/settings/account", icon: Settings },
        ],
      };
    }

    if (user.role === "judge") {
      return {
        main: [{ name: "My Events", path: "/judge", icon: Gavel }],
        bottom: [
          { name: "Settings", path: "/settings/account", icon: Settings },
        ],
      };
    }

    return { main: [], bottom: [] };
  };

  const navigation = getNavigationItems();
  const isActive = (path: string) => {
    // Public root — exact match only
    if (path === "/") return location.pathname === "/";

    // Role dashboard roots: exact match so /coach never highlights when on /coach/athletes
    const dashboardRoots = ["/admin", "/coach", "/athlete", "/judge"];
    if (dashboardRoots.includes(path)) return location.pathname === path;

    // All other nav items: current path must start with this path followed by
    // '/' or end exactly here — prevents /admin/events matching /admin/events-foo
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  // Show loading screen
  if (loading) {
    return <Loading message="Loading application..." />;
  }

  return (
    <div className="relative min-h-[100dvh]">
      {/* Flat canvas. Depth comes from the panels sitting on it, not from a
          diagonal wash behind them. */}
      <div className="fixed inset-0 z-0 bg-background" />

      {/* Main Container */}
      <div className="relative z-10 flex h-[100dvh] overflow-hidden">
        {/* Mobile Menu Overlay for public users */}
        {!user && mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 sm:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Menu Panel for public users */}
        {!user && (
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-72 bg-card shadow-lg transition-transform duration-300 sm:hidden",
              mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center space-x-3">
                  <img
                    src="/sportaxis-mark.png"
                    alt="SportAxis"
                    className="h-9 w-9 object-contain"
                  />
                  <div>
                    <h2 className="text-base font-bold leading-tight text-foreground">
                      SportsAxis
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Competition Scoring System
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md p-2 transition-colors hover:bg-muted"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto py-6 px-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="space-y-1">
                  {navigation.main.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </nav>

              {/* Login Button */}
              <div className="p-4 border-t">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">
                    Login
                  </Button>
                </Link>
              </div>
            </div>
          </aside>
        )}

        {/* Sidebar - Only show for logged-in users */}
        {user && (
          <>
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar — flush full-height drawer on mobile (standard mobile
                pattern), floating rounded panel with a visible page-background
                gutter around it on desktop (lg:). */}
            <aside
              className={cn(
                "fixed lg:static inset-y-0 left-0 lg:inset-y-auto z-50 flex flex-col bg-sidebar text-sidebar-foreground shadow-2xl transition-all duration-300",
                "lg:my-3 lg:ml-3 lg:h-[calc(100dvh-1.5rem)] lg:rounded-2xl lg:shadow-lg",
                sidebarOpen
                  ? "translate-x-0"
                  : "-translate-x-full lg:translate-x-0",
                sidebarCollapsed ? "w-20" : "w-72",
              )}
            >
              {/* Sidebar Header */}
              <div
                className={cn(
                  "flex items-center justify-between p-6 border-b border-sidebar-border",
                  sidebarCollapsed && "justify-center p-4",
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-white p-2 rounded-xl shrink-0">
                    <img
                      src="/sportaxis-mark.png"
                      alt="SportAxis"
                      className="h-6 w-6 object-contain"
                    />
                  </div>
                  {!sidebarCollapsed && (
                    <div>
                      <h2 className="font-bold text-lg">SportsAxis</h2>
                      <p className="text-xs text-sidebar-foreground/60">Competition System</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() =>
                    sidebarCollapsed
                      ? setSidebarCollapsed(false)
                      : setSidebarOpen(false)
                  }
                  className="lg:hidden rounded-md p-2 transition-colors hover:bg-sidebar-accent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User Info */}
              <div
                className={cn(
                  "p-6 border-b border-sidebar-border",
                  sidebarCollapsed && "p-4",
                )}
              >
                <div
                  className={cn(
                    "flex items-center space-x-3",
                    sidebarCollapsed && "justify-center",
                  )}
                >
                  <div className="rounded-full bg-sidebar-accent p-2">
                    <User className="h-5 w-5" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-sidebar-foreground/60 capitalize">
                        {user.role === "coach"
                          ? [
                              user.department
                                ?.split(" ")
                                .filter(
                                  (w) =>
                                    ![
                                      "of",
                                      "and",
                                      "the",
                                      "for",
                                      "in",
                                      "at",
                                    ].includes(w.toLowerCase()),
                                )
                                .map((w) => w[0])
                                .join("")
                                .toUpperCase(),
                              user.genderCategory
                                ? `${user.genderCategory}'s`
                                : null,
                              user.sports?.length
                                ? user.sports.join(" / ")
                                : user.sport,
                              "Coach",
                            ]
                              .filter(Boolean)
                              .join(" ")
                          : user.role}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto py-6 px-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="space-y-1">
                  {navigation.main.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          sidebarCollapsed && "justify-center px-2",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            active
                              ? "text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground",
                          )}
                        />
                        {!sidebarCollapsed && (
                          <span className="font-medium">{item.name}</span>
                        )}
                        {!sidebarCollapsed && active && (
                          <ChevronRight className="h-4 w-4 ml-auto" />
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Bottom Navigation */}
                {navigation.bottom.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-sidebar-border space-y-1">
                    {navigation.bottom.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                            active
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            sidebarCollapsed && "justify-center px-2",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-5 w-5",
                              active
                                ? "text-sidebar-primary-foreground"
                                : "text-sidebar-foreground/55 group-hover:text-sidebar-accent-foreground",
                            )}
                          />
                          {!sidebarCollapsed && (
                            <span className="font-medium">{item.name}</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </nav>

              {/* Logout Button */}
              <div
                className={cn(
                  "p-4 border-t border-sidebar-border",
                  sidebarCollapsed && "p-2",
                )}
              >
                <Button
                  onClick={handleLogoutClick}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    sidebarCollapsed && "justify-center px-2",
                  )}
                >
                  <LogOut className="h-5 w-5" />
                  {!sidebarCollapsed && <span className="ml-3">Logout</span>}
                </Button>
              </div>

              {/* Collapse Toggle (Desktop Only) */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="absolute -right-3 top-20 hidden rounded-full bg-primary p-1.5 text-primary-foreground shadow-md transition-colors hover:bg-primary/90 lg:flex"
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform",
                    sidebarCollapsed ? "rotate-0" : "rotate-180",
                  )}
                />
              </button>
            </aside>
          </>
        )}

        {/* Main Content Area — matches the sidebar's floating gutter on
            desktop (lg:mr-3/lg:my-3) so both read as one system of panels
            over the gradient canvas, not a floating sidebar next to a flush
            rectangle. No rounding/overflow-hidden here on purpose — this
            wrapper holds every page in the app and some rely on true
            viewport-edge fixed positioning (modals, etc.); only the header
            gets the rounded top corners since it's a contained, known shape. */}
        <div className={cn("flex-1 min-w-0 flex flex-col overflow-hidden", user && "lg:my-3 lg:mr-3")}>
          {/* Top Navigation Bar */}
          <header className={cn(
            "z-30 border-b border-border bg-card/85 backdrop-blur-md",
            user && "lg:rounded-t-2xl",
          )}>
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                {/* Left Side */}
                <div className="flex items-center space-x-4">
                  {/* Mobile Menu Button for logged-in users */}
                  {user && (
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="rounded-md p-2 transition-colors hover:bg-muted lg:hidden"
                    >
                      <Menu className="h-6 w-6 text-muted-foreground" />
                    </button>
                  )}

                  {/* Mobile Menu Button for public users */}
                  {!user && (
                    <button
                      onClick={() => setMobileMenuOpen(true)}
                      className="rounded-md p-2 transition-colors hover:bg-muted sm:hidden"
                    >
                      <Menu className="h-6 w-6 text-muted-foreground" />
                    </button>
                  )}

                  {/* Logo for non-logged-in users */}
                  {!user && (
                    <Link to="/" className="flex items-center space-x-2">
                      <img
                        src="/sportaxis-mark.png"
                        alt="SportAxis"
                        className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
                      />
                      <div>
                        <h1 className="text-base font-bold text-foreground sm:text-xl">
                          SportsAxis
                        </h1>
                        <p className="hidden text-xs text-muted-foreground sm:block">
                          Competition Scoring System
                        </p>
                      </div>
                    </Link>
                  )}

                  {/* Breadcrumb for logged-in users */}
                  {user && (
                    <div className="hidden items-center space-x-2 text-sm text-muted-foreground sm:flex">
                      <Home className="h-4 w-4" />
                      <ChevronRight className="h-4 w-4" />
                      <span className="font-medium capitalize text-foreground">
                        {location.pathname.split("/")[1] || "Home"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right Side */}
                <div className="flex items-center space-x-3">
                  {user && <NotificationBell />}
                  {!user && (
                    <>
                      {/* Public Navigation for non-logged-in users */}
                      <nav className="hidden sm:flex items-center gap-1">
                        {[
                          { name: "Match Schedule", path: "/" },
                          { name: "Live Scores", path: "/live" },
                          { name: "Brackets", path: "/brackets" },
                          { name: "Leaderboard", path: "/leaderboard" },
                          { name: "History", path: "/history" },
                          { name: "Announcements", path: "/announcements" },
                        ].map((item) => (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                              isActive(item.path)
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            {item.name}
                          </Link>
                        ))}
                      </nav>
                      <Link to="/login">
                        <Button
                          size="sm"
                          className=""
                        >
                          Login
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto relative">
            {routerNavigation.state === "loading" && (
              <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-primary/20">
                <div className="h-full w-1/3 bg-primary [animation:loading-bar_1.1s_cubic-bezier(0.25,1,0.5,1)_infinite] motion-reduce:w-full motion-reduce:animate-none" />
              </div>
            )}
            <div className="h-full">
              <Outlet />
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-border bg-card/85 py-4 backdrop-blur-md">
            <div className="px-4 sm:px-6 lg:px-8">
              <p className="text-center text-sm text-muted-foreground">
                © 2026 SportsAxis. All rights reserved.
                {' '}·{' '}
                <Link to="/privacy-notice" className="hover:underline">Data Privacy Notice</Link>
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* Welcome popup for public visitors (admin-managed; once per session) */}
      {!user && <SitePopup />}

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout? This will end your session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
