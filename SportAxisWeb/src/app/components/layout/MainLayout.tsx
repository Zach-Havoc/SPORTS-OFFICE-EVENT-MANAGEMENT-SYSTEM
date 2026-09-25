import { useState } from "react";
import { Outlet, useLocation, useNavigation, Link } from "react-router";
import { toast } from "sonner";

import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
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
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { getNavigation, isPathActive } from "./navigation";

const SECTION_LABELS: Record<string, string> = {
  admin: "Admin",
  coach: "Coach",
  athlete: "Athlete",
  judge: "Committee",
  settings: "Settings",
};

/**
 * Application shell.
 *
 * Authenticated: a grouped sidebar on desktop, a thumb-reach bottom bar on
 * mobile, and a slim header that carries only what neither of those can (the
 * route progress bar, notifications, and the current section on small
 * screens). The old shell floated the sidebar inside a rounded gutter and
 * spent the header on a "Home > admin" breadcrumb that restated what the
 * sidebar was already showing.
 *
 * Public: a conventional top bar, because a visitor checking a score has no
 * workspace to navigate and no reason to learn one.
 */
export default function MainLayout() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const routerNavigation = useNavigation();
  const [collapsed, setCollapsed] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out");
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("We couldn't sign you out. Please try again.");
    }
  };

  if (loading) {
    return <Loading message="Loading application" />;
  }

  const roleMeta = () => {
    if (!user) return "";
    if (user.role === "coach" && user.department) return `${user.department} coach`;
    return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  };

  const sectionLabel =
    SECTION_LABELS[location.pathname.split("/")[1] ?? ""] ?? "SportAxis";

  const publicNav = getNavigation(undefined).groups[0].items;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[--bg] lg:h-[100dvh] lg:flex-row lg:overflow-hidden">
      {user && (
        <AppSidebar
          role={user.role}
          userName={user.name}
          userMeta={roleMeta()}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          onLogout={() => setLogoutDialogOpen(true)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:overflow-hidden">
        <header
          className={cn(
            "sticky top-0 z-30 shrink-0 border-b border-border",
            "bg-[color-mix(in_oklch,var(--surface)_88%,transparent)] backdrop-blur-md",
          )}
        >
          <div
            className={cn(
              "flex h-14 items-center gap-3 px-4",
              user ? "sm:px-6" : "page-container",
            )}
          >
            {user ? (
              <>
                <span className="t-subsection lg:hidden">{sectionLabel}</span>
                <div className="ml-auto flex items-center gap-1">
                  <NotificationBell />
                </div>
              </>
            ) : (
              <>
                <Link to="/" className="flex shrink-0 items-center gap-2.5">
                  <img
                    src="/sportaxis-mark.png"
                    alt=""
                    aria-hidden="true"
                    className="size-7 object-contain"
                  />
                  <span className="t-subsection">SportAxis</span>
                </Link>

                <nav aria-label="Main" className="ml-6 hidden items-center gap-0.5 lg:flex">
                  {publicNav.map((item) => {
                    const active = isPathActive(item.path, location.pathname);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "t-nav rounded-md px-2.5 py-1.5 transition-colors duration-[140ms]",
                          active
                            ? "bg-brand-subtle text-brand-text"
                            : "text-text-secondary hover:bg-surface-hover hover:text-text",
                        )}
                      >
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/login">Sign in</Link>
                  </Button>
                </div>
              </>
            )}
          </div>

          {routerNavigation.state === "loading" && (
            <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-brand/20">
              <div className="h-full w-1/3 bg-brand [animation:loading-bar_1.1s_cubic-bezier(0.25,1,0.5,1)_infinite] motion-reduce:w-full motion-reduce:animate-none" />
            </div>
          )}
        </header>

        <main
          id="main"
          className={cn(
            "flex min-w-0 flex-1 flex-col lg:overflow-y-auto",
            // Clears the fixed bottom bar so the last row of any page is reachable.
            "pb-[4.5rem] lg:pb-0",
          )}
        >
          <div className="flex-1">
            <Outlet />
          </div>

          <footer className="mt-10 border-t border-border-subtle py-5">
            <div className="page-container">
              <p className="t-caption text-center">
                © 2026 SportAxis · BatStateU-TNEU ARASOF Sports Office ·{" "}
                <Link
                  to="/privacy-notice"
                  className="text-text-muted underline-offset-4 hover:text-text hover:underline"
                >
                  Data Privacy Notice
                </Link>
              </p>
            </div>
          </footer>
        </main>
      </div>

      <MobileNav
        role={user?.role}
        userName={user?.name ?? "Visitor"}
        userMeta={user ? roleMeta() : "Not signed in"}
        onLogout={() => setLogoutDialogOpen(true)}
      />

      {!user && <SitePopup />}

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              This ends your session on this device. Anything you have saved stays saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
