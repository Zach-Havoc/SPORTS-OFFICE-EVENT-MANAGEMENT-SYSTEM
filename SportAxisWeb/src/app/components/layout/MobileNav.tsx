import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { LogOut, MoreHorizontal, X } from "lucide-react";

import { cn } from "../ui/utils";
import { getNavigation, isPathActive, type NavItem } from "./navigation";

/**
 * Mobile navigation is designed for the thumb, not shrunk from the desktop
 * sidebar. The four destinations a role actually reaches for sit in a fixed
 * bottom bar within thumb reach; everything else lives in a sheet that rises
 * from the same bar, grouped exactly as the sidebar groups it.
 *
 * A drawer sliding in from the left, mirroring a desktop sidebar, asks the
 * user to reach the top-left corner of a phone to change screens.
 */
export function MobileNav({
  role,
  userName,
  userMeta,
  onLogout,
}: {
  role: string | undefined;
  userName: string;
  userMeta: string;
  onLogout: () => void;
}) {
  const { pathname } = useLocation();
  const { groups, footer } = getNavigation(role);
  const [sheetOpen, setSheetOpen] = useState(false);
  // `shown` trails `sheetOpen` by a frame on the way in and leads it on the
  // way out, which is what gives the sheet a symmetric entrance and exit.
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    if (sheetOpen) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    exitTimer.current = setTimeout(() => setMounted(false), 240);
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [sheetOpen]);

  const all = groups.flatMap((g) => g.items);
  const primary = all.filter((i) => i.primary).slice(0, 4);
  const tabs = primary.length > 0 ? primary : all.slice(0, 4);

  // Any navigation closes the sheet, including the browser back button.
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  // A sheet that covers the page must not leave the page scrolling behind it.
  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetOpen]);

  const moreActive = !tabs.some((t) => isPathActive(t.path, pathname));

  const sheetItem = ({ name, path, icon: Icon }: NavItem) => {
    const active = isPathActive(path, pathname);
    return (
      <li key={path}>
        <Link
          to={path}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-3 text-[0.9375rem]",
            active
              ? "bg-brand-subtle font-medium text-brand-text"
              : "text-text-secondary hover:bg-surface-hover",
          )}
        >
          <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
          <span className="truncate">{name}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      {mounted && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSheetOpen(false)}
            className={cn(
              "absolute inset-0 bg-[--overlay] backdrop-blur-[2px]",
              "transition-opacity duration-200 ease-[--ease-out-expo]",
              shown ? "opacity-100" : "opacity-0",
              "motion-reduce:transition-none",
            )}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="All sections"
            className={cn(
              "safe-b absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto",
              "rounded-t-xl border-t border-border bg-surface shadow-lg",
              // Leaves through the bottom because that is where it came from.
              "transition-transform duration-[240ms] ease-[--ease-drawer]",
              shown ? "translate-y-0" : "translate-y-full",
              "motion-reduce:transition-none motion-reduce:translate-y-0",
            )}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-border-subtle bg-surface px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{userName}</p>
                <p className="truncate text-xs text-text-muted">{userMeta}</p>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close menu"
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-hover hover:text-text"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="px-3 pb-4 pt-2">
              {groups.map((group, i) => (
                <div key={group.label ?? i} className={i > 0 ? "mt-4" : undefined}>
                  {group.label && (
                    <p className="t-overline px-3 pb-1">{group.label}</p>
                  )}
                  <ul className="space-y-0.5">{group.items.map(sheetItem)}</ul>
                </div>
              ))}

              {footer.length > 0 && (
                <div className="mt-4 border-t border-border-subtle pt-3">
                  <ul className="space-y-0.5">{footer.map(sheetItem)}</ul>
                </div>
              )}

              {role && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-3 text-[0.9375rem] text-text-secondary hover:bg-surface-hover"
                >
                  <LogOut className="size-[1.125rem] shrink-0" aria-hidden="true" />
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className={cn(
          "safe-b fixed inset-x-0 bottom-0 z-40 lg:hidden",
          "border-t border-border bg-surface/92 backdrop-blur-md",
        )}
      >
        <ul className="flex items-stretch">
          {tabs.map(({ name, path, icon: Icon }) => {
            const active = isPathActive(path, pathname);
            return (
              <li key={path} className="flex-1">
                <Link
                  to={path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 px-1 py-2",
                    "text-[0.6875rem] font-medium transition-colors duration-[140ms]",
                    active ? "text-brand-text" : "text-text-muted",
                  )}
                >
                  <Icon className="size-[1.125rem]" aria-hidden="true" />
                  <span className="max-w-full truncate">{name}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-expanded={sheetOpen}
              aria-haspopup="dialog"
              className={cn(
                "flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-1 px-1 py-2",
                "text-[0.6875rem] font-medium transition-colors duration-[140ms]",
                moreActive ? "text-brand-text" : "text-text-muted",
              )}
            >
              <MoreHorizontal className="size-[1.125rem]" aria-hidden="true" />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
