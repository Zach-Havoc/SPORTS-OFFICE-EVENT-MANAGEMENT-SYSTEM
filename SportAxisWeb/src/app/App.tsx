// Suppress warnings before anything else loads
import "/src/suppress-recharts-warnings";

// Import warning suppression FIRST, before anything else
import "./utils/suppressWarnings";

import {
  RouterProvider,
  createBrowserRouter,
} from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import { useEffect, useMemo } from "react";
import { startWarmup } from "./services/api";

// Start warming up the Edge Function immediately so pages don't have to wait as long
startWarmup();

// Import route components
import MainLayout from "./components/layout/MainLayout";
import Login from "./pages/Login";
import AdminDashboardEnhanced from "./pages/admin/DashboardEnhanced";
import AdminEventsEnhanced from "./pages/admin/EventsEnhanced";
import AdminSettings from "./pages/admin/Settings";
import AdminReports from "./pages/admin/Reports";
import AdminHistory from "./pages/admin/History";
import AdminCarousel from "./pages/admin/CarouselManagement";

import AdminRegistrationCodes from "./pages/admin/RegistrationCodes";
import AdminVenues from "./pages/admin/Venues";
import AdminBracketing from "./pages/admin/Bracketing";
import AdminBracketDetail from "./pages/admin/BracketDetail";
import AdminCoaches from "./pages/admin/Coaches";
import AdminUsers from "./pages/admin/Users";
import JudgeDashboard from "./pages/judge/Dashboard";
import JudgeScoring from "./pages/judge/Scoring";
import CoachDashboard from "./pages/coach/Dashboard";
import CoachAthletes from "./pages/coach/Athletes";
import CoachAthleteForm from "./pages/coach/AthleteForm";
import CoachAthleteDetail from "./pages/coach/AthleteDetail";
import CoachAnnouncements from "./pages/coach/Announcements";
import CoachAttendance from "./pages/coach/Attendance";
import CoachPerformance from "./pages/coach/Performance";
import CoachRequirements from "./pages/coach/Requirements";
import AthleteDashboard from "./pages/athlete/Dashboard";
import AthleteSchedule from "./pages/athlete/Schedule";
import AthletePerformance from "./pages/athlete/Performance";
import AthleteRequirements from "./pages/athlete/Requirements";
import AccountSettings from "./pages/settings/AccountSettings";
import PublicViewer from "./pages/public/Viewer";
import PublicLeaderboard from "./pages/public/Leaderboard";
import PublicHistory from "./pages/public/History";
import PublicLiveBoard from "./pages/public/LiveBoard";
import PublicAnnouncements from "./pages/public/Announcements";
import PublicBrackets from "./pages/public/Brackets";
import PublicBracket from "./pages/public/Bracket";
import JudgeQRScoring from "./pages/JudgeQRScoring";
import NotFound from "./pages/NotFound";

// Standalone wrapper for QR code page (no auth needed)
function QRCodePage() {
  return (
    <>
      <JudgeQRScoring />
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
            { index: true, Component: PublicViewer },
            { path: "login", Component: Login },
            {
              path: "leaderboard",
              Component: PublicLeaderboard,
            },
            { path: "history", Component: PublicHistory },
            {
              path: "announcements",
              Component: PublicAnnouncements,
            },
            { path: "live", Component: PublicLiveBoard },
            { path: "brackets", Component: PublicBrackets },
            { path: "bracket/:id", Component: PublicBracket },

            // Admin routes
            { path: "admin", Component: AdminDashboardEnhanced },
            {
              path: "admin/dashboard",
              Component: AdminDashboardEnhanced,
            },
            {
              path: "admin/events",
              Component: AdminEventsEnhanced,
            },
            {
              path: "admin/carousel",
              Component: AdminCarousel,
            },
            {
              path: "admin/settings",
              Component: AdminSettings,
            },
            { path: "admin/reports", Component: AdminReports },
            { path: "admin/history", Component: AdminHistory },
            {
              path: "admin/registration-codes",
              Component: AdminRegistrationCodes,
            },
            { path: "admin/venues", Component: AdminVenues },
            {
              path: "admin/bracketing",
              Component: AdminBracketing,
            },
            {
              path: "admin/bracketing/:id",
              Component: AdminBracketDetail,
            },
            { path: "admin/coaches", Component: AdminCoaches },
            { path: "admin/users", Component: AdminUsers },

            // Judge routes
            { path: "judge", Component: JudgeDashboard },
            {
              path: "judge/event/:eventId",
              Component: JudgeScoring,
            },

            // Coach routes
            { path: "coach", Component: CoachDashboard },
            {
              path: "coach/dashboard",
              Component: CoachDashboard,
            },
            {
              path: "coach/athletes",
              Component: CoachAthletes,
            },
            {
              path: "coach/athletes/new",
              Component: CoachAthleteForm,
            },
            {
              path: "coach/athletes/:id",
              Component: CoachAthleteDetail,
            },
            {
              path: "coach/athletes/:id/edit",
              Component: CoachAthleteForm,
            },
            {
              path: "coach/attendance",
              Component: CoachAttendance,
            },
            {
              path: "coach/performance",
              Component: CoachPerformance,
            },
            {
              path: "coach/requirements",
              Component: CoachRequirements,
            },
            {
              path: "coach/announcements",
              Component: CoachAnnouncements,
            },

            // Athlete routes
            { path: "athlete", Component: AthleteDashboard },
            {
              path: "athlete/dashboard",
              Component: AthleteDashboard,
            },
            {
              path: "athlete/schedule",
              Component: AthleteSchedule,
            },
            {
              path: "athlete/performance",
              Component: AthletePerformance,
            },
            {
              path: "athlete/requirements",
              Component: AthleteRequirements,
            },

            // Shared account settings (coach, athlete, judge)
            { path: "settings/account", Component: AccountSettings },

            { path: "*", Component: NotFound },
          ],
        },
        // QR Code Judge Scoring - standalone page without auth
        {
          path: "/judge-qr/:eventId/:token",
          Component: QRCodePage,
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