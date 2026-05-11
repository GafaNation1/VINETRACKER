import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "./components/AppLayout";

const HomePage = lazy(() => import("./pages/HomePage"));
const ActivitiesPage = lazy(() => import("./pages/ActivitiesPage"));
const GroupsPage = lazy(() => import("./pages/GroupsPage"));
const ProgramsPage = lazy(() => import("./pages/ProgramsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ActivityDetailPage = lazy(() => import("./pages/ActivityDetailPage"));
const LogActivityPage = lazy(() => import("./pages/LogActivityPage"));
const BiblePage = lazy(() => import("./pages/BiblePage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const PrayerPage = lazy(() => import("./pages/PrayerPage"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const InviteAcceptPage = lazy(() => import("./pages/InviteAcceptPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-3">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground">🌿</div>
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const queryClient = new QueryClient();

const ROUTE_KEY = "vine:lastRoute";

const RoutePersister = () => {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== "/login" && location.pathname !== "/signup") {
      try {
        sessionStorage.setItem(ROUTE_KEY, location.pathname + location.search);
      } catch { /* ignore */ }
    }
  }, [location.pathname, location.search]);
  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground">🌿</div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (user) {
    // Restore last route on reload after login
    let target = "/";
    try {
      const stored = sessionStorage.getItem(ROUTE_KEY);
      if (stored && stored !== "/login" && stored !== "/signup") target = stored;
    } catch { /* ignore */ }
    return <Navigate to={target} replace state={{ from: location }} />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RoutePersister />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
              <Route path="/signup" element={<AuthRoute><SignupPage /></AuthRoute>} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/invite/:kind/:code" element={<InviteAcceptPage />} />

              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<HomePage />} />
                <Route path="/activities" element={<ActivitiesPage />} />
                <Route path="/activities/:categoryId" element={<ActivityDetailPage />} />
                <Route path="/activity/:categoryId" element={<ActivityDetailPage />} />
                <Route path="/log-activity" element={<LogActivityPage />} />
                <Route path="/groups" element={<GroupsPage />} />
                <Route path="/programs" element={<ProgramsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/prayer" element={<PrayerPage />} />
                <Route path="/journal" element={<JournalPage />} />
                <Route path="/bible" element={<BiblePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                {/* Redirects for removed pages */}
                <Route path="/mentorship" element={<Navigate to="/groups" replace />} />
                <Route path="/prayer-requests" element={<Navigate to="/prayer" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
