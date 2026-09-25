// Suppress warnings before anything else loads
import "/src/suppress-recharts-warnings";

// Import warning suppression FIRST, before anything else
import "./utils/suppressWarnings";

import { RouterProvider, createBrowserRouter, Navigate } from "react-router";
import type { LazyRouteFunction, RouteObject } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import { Suspense, lazy, useEffect, useMemo } from "react";
import { startWarmup } from "./services/api";

// Start warming up the Edge Function immediately so pages don't have to wait as long
startWarmup();

// MainLayout, Login and PrivacyNotice are needed on first paint for most
// visitors (the app shell + the two routes reachable from a cold load), so
// they stay in the main bundle. Every other page is route-split below —
// each one only downloads when a user actually visits a page for their role,
// instead of every role's pages shipping in one shared bundle.
import MainLayout from "./components/layout/MainLayout";
import Login from "./pages/Login";
import PrivacyNotice from "./pages/PrivacyNotice";
import NotFound from "./pages/NotFound";

// `.then(m => ({ Component: m.default }))` matches every page's `export
// default` — this is the react-router v7 `route.lazy` code-splitting API.
const page = (
  loader: () => Promise<{ default: React.ComponentType }>,
): LazyRouteFunction<RouteObject> =>
  (() => loader().then((m) => ({ Component: m.default }))) as LazyRouteFunction<RouteObject>;

const AdminDashboardEnhanced = page(() => import("./pages/admin/DashboardEnhanced"));
const AdminEventsEnhanced = page(() => import("./pages/admin/EventsEnhanced"));
const AdminSettings = page(() => import("./pages/admin/Settings"));
const AdminReports = page(() => import("./pages/admin/Reports"));
const AdminHistory = page(() => import("./pages/admin/History"));
const AdminCarousel = page(() => import("./pages/admin/CarouselManagement"));
const AdminRegistrationCodes = page(() => import("./pages/admin/RegistrationCodes"));
const AdminVenues = page(() => import("./pages/admin/Venues"));
const AdminBracketing = page(() => import("./pages/admin/Bracketing"));
const AdminBracketDetail = page(() => import("./pages/admin/BracketDetail"));
const AdminCoaches = page(() => import("./pages/admin/Coaches"));
const AdminUsers = page(() => import("./pages/admin/Users"));
const AdminRequirements = page(() => import("./pages/admin/Requirements"));
const AdminTrash = page(() => import("./pages/admin/Trash"));
const AdminSeasons = page(() => import("./pages/admin/Seasons"));
const AdminProtests = page(() => import("./pages/admin/Protests"));
const JudgeDashboard = page(() => import("./pages/judge/Dashboard"));
const JudgeScoring = page(() => import("./pages/judge/Scoring"));
const CoachDashboard = page(() => import("./pages/coach/Dashboard"));
const CoachAthletes = page(() => import("./pages/coach/Athletes"));
const CoachLineup = page(() => import("./pages/coach/Lineup"));
const CoachAthleteForm = page(() => import("./pages/coach/AthleteForm"));
const CoachAthleteDetail = page(() => import("./pages/coach/AthleteDetail"));
const CoachAnnouncements = page(() => import("./pages/coach/Announcements"));
const CoachAttendance = page(() => import("./pages/coach/Attendance"));
const CoachSchedule = page(() => import("./pages/coach/Schedule"));
const CoachPerformance = page(() => import("./pages/coach/Performance"));
const CoachRequirements = page(() => import("./pages/coach/Requirements"));
const CoachProtests = page(() => import("./pages/coach/Protests"));
const Tryouts = page(() => import("./pages/coach/Tryouts"));
const AthleteDashboard = page(() => import("./pages/athlete/Dashboard"));
const AthleteSchedule = page(() => import("./pages/athlete/Schedule"));
const AthletePerformance = page(() => import("./pages/athlete/Performance"));
const AthleteRequirements = page(() => import("./pages/athlete/Requirements"));
const AthleteAttendance = page(() => import("./pages/athlete/Attendance"));
const AthleteTeam = page(() => import("./pages/athlete/Team"));
const AccountSettings = page(() => import("./pages/settings/AccountSettings"));
const PublicLeaderboard = page(() => import("./pages/public/Leaderboard"));
const PublicHistory = page(() => import("./pages/public/History"));
const PublicLiveBoard = page(() => import("./pages/public/LiveBoard"));
const StandingsBoard = page(() => import("./pages/public/StandingsBoard"));
const PublicAnnouncements = page(() => import("./pages/public/Announcements"));
const PublicBrackets = page(() => import("./pages/public/Brackets"));
const PublicBracket = page(() => import("./pages/public/Bracket"));

// PublicViewer and JudgeQRScoring are rendered directly as JSX (inside
// HomeRoute / QRCodePage below), not as a route's `Component`, so they use
// plain React.lazy + Suspense instead of the `page()` helper above.
const PublicViewer = lazy(() => import("./pages/public/Viewer"));
const JudgeQRScoring = lazy(() => import("./pages/JudgeQRScoring"));

// The root URL is the public Match Schedule for visitors; a signed-in user
// landing here (e.g. a hard refresh at "/") is sent to their own home so they
// don't get the admin shell wrapped around the public page.
const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  coach: "/coach",
  athlete: "/athlete",
  judge: "/judge",
};

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  const home = user ? ROLE_HOME[user.role] : undefined;
  return home ? (
    <Navigate to={home} replace />
  ) : (
    <Suspense fallback={null}>
      <PublicViewer />
    </Suspense>
  );
}

// Standalone wrapper for QR code page (no auth needed)
function QRCodePage() {
  return (
    <>
      <Suspense fallback={null}>
        <JudgeQRScoring />
      </Suspense>
      <Toaster />
    </>
  );
}

export default function App() {
  // Create router inside component
  const router = useMemo(
    () =>
      createBrowserRouter([
        {
          path: "/",
          element: (
            <AuthProvider>
              <MainLayout />
            </AuthProvider>
          ),
          children: [
            { index: true, Component: HomeRoute },
            { path: "login", Component: Login },
            { path: "privacy-notice", Component: PrivacyNotice },
            {
              path: "leaderboard",
              lazy: PublicLeaderboard,
            },
            { path: "history", lazy: PublicHistory },
            {
              path: "announcements",
              lazy: PublicAnnouncements,
            },
            { path: "live", lazy: PublicLiveBoard },
            { path: "brackets", lazy: PublicBrackets },
            { path: "bracket/:id", lazy: PublicBracket },

            // Admin routes
            { path: "admin", lazy: AdminDashboardEnhanced },
            {
              path: "admin/dashboard",
              lazy: AdminDashboardEnhanced,
            },
            {
              path: "admin/events",
              lazy: AdminEventsEnhanced,
            },
            {
              path: "admin/carousel",
              lazy: AdminCarousel,
            },
            {
              path: "admin/settings",
              lazy: AdminSettings,
            },
            { path: "admin/reports", lazy: AdminReports },
            { path: "admin/history", lazy: AdminHistory },
            {
              path: "admin/registration-codes",
              lazy: AdminRegistrationCodes,
            },
            { path: "admin/venues", lazy: AdminVenues },
            {
              path: "admin/bracketing",
              lazy: AdminBracketing,
            },
            {
              path: "admin/bracketing/:id",
              lazy: AdminBracketDetail,
            },
            { path: "admin/coaches", lazy: AdminCoaches },
            { path: "admin/users", lazy: AdminUsers },
            {
              path: "admin/requirements",
              lazy: AdminRequirements,
            },
            { path: "admin/tryouts", lazy: Tryouts },
            { path: "admin/seasons", lazy: AdminSeasons },
            { path: "admin/protests", lazy: AdminProtests },
            { path: "admin/trash", lazy: AdminTrash },

            // Judge routes
            { path: "judge", lazy: JudgeDashboard },
            {
              path: "judge/event/:eventId",
              lazy: JudgeScoring,
            },

            // Coach routes
            { path: "coach", lazy: CoachDashboard },
            {
              path: "coach/dashboard",
              lazy: CoachDashboard,
            },
            {
              path: "coach/athletes",
              lazy: CoachAthletes,
            },
            { path: "coach/lineup", lazy: CoachLineup },
            {
              path: "coach/athletes/new",
              lazy: CoachAthleteForm,
            },
            {
              path: "coach/athletes/:id",
              lazy: CoachAthleteDetail,
            },
            {
              path: "coach/athletes/:id/edit",
              lazy: CoachAthleteForm,
            },
            {
              path: "coach/schedule",
              lazy: CoachSchedule,
            },
            {
              path: "coach/attendance",
              lazy: CoachAttendance,
            },
            {
              path: "coach/performance",
              lazy: CoachPerformance,
            },
            {
              path: "coach/requirements",
              lazy: CoachRequirements,
            },
            { path: "coach/tryouts", lazy: Tryouts },
            {
              path: "coach/protests",
              lazy: CoachProtests,
            },
            {
              path: "coach/announcements",
              lazy: CoachAnnouncements,
            },

            // Athlete routes
            { path: "athlete", lazy: AthleteDashboard },
            {
              path: "athlete/dashboard",
              lazy: AthleteDashboard,
            },
            {
              path: "athlete/schedule",
              lazy: AthleteSchedule,
            },
            {
              path: "athlete/performance",
              lazy: AthletePerformance,
            },
            {
              path: "athlete/requirements",
              lazy: AthleteRequirements,
            },
            {
              path: "athlete/attendance",
              lazy: AthleteAttendance,
            },
            {
              path: "athlete/team",
              lazy: AthleteTeam,
            },

            // Shared account settings (coach, athlete, judge)
            { path: "settings/account", lazy: AccountSettings },

            { path: "*", Component: NotFound },
          ],
        },
        // QR Code Judge Scoring - standalone page without auth
        {
          path: "/judge-qr/:eventId/:token",
          Component: QRCodePage,
        },
        // Full-screen standings board for a venue TV — no app chrome.
        {
          path: "/standings",
          lazy: StandingsBoard,
        },
      ]),
    [],
  );

  useEffect(() => {
    // Demo data initialization and auth fixes for Supabase have been removed
    // since the project now relies purely on Laravel backend for API logic.
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
