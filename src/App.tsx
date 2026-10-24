import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { GameProvider } from "./contexts/GameContext";
import { AIAnalysisProvider } from "./contexts/AIAnalysisContext";
import { useEffect, lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import ProtectedRoute from "./components/ProtectedRoute";
import { ensureVIPPlayerExists } from "./utils/vipAdmin";
import { isMaintenanceMode } from "./config/maintenanceConfig";
import TabSwitchDetector from "./components/TabSwitchDetector";
import { AnimatePresence } from "framer-motion";
import "./styles/pageTransitions.css";

// ── Eagerly loaded: tiny pages needed immediately ──────────────────────────
import HomePage from "./pages/HomePage";
import NotFound from "./pages/NotFound";
import MaintenancePage from "./pages/MaintenancePage";

// ── Lazily loaded: all other pages (split into separate chunks) ────────────
const HostLoginPage        = lazy(() => import("./pages/HostLoginPage"));
const HostSignupPage       = lazy(() => import("./pages/HostSignupPage"));
const ProfileSetup         = lazy(() => import("./components/ProfileSetup"));
const HostDashboardPage    = lazy(() => import("./pages/HostDashboardPage"));
const HostGameRoomPage     = lazy(() => import("./pages/HostGameRoomPage"));
const PlayerGameRoomPage   = lazy(() => import("./pages/PlayerGameRoomPage"));
const JoinGamePage         = lazy(() => import("./pages/JoinGamePage"));
const PlayerSetupPage      = lazy(() => import("./pages/PlayerSetupPage"));
const LeaderAnimationPage  = lazy(() => import("./pages/LeaderAnimationPage"));
const CreateQuizPage       = lazy(() => import("./pages/CreateQuizPage"));
const PlayQuizPage         = lazy(() => import("./pages/PlayQuizPage"));
const PrivacyPolicyPage    = lazy(() => import("./pages/PrivacyPolicyPage"));
const ForgotPasswordPage    = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage     = lazy(() => import("./pages/ResetPasswordPage"));
const ContactDeveloperPage = lazy(() => import("./pages/ContactDeveloperPage"));

// ── Heavy UI widgets — loaded after paint ─────────────────────────────────
const CreatorAttribution   = lazy(() => import("./components/CreatorAttribution"));
const AIAnalysisWidget     = lazy(() => import("./components/AIAnalysisWidget"));
const AIAnalysisToggle     = lazy(() => import("./components/AIAnalysisToggle"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes — avoids re-fetching on navigation
      staleTime: 5 * 60 * 1000,
    },
  },
});

const App = () => {
  useEffect(() => {
    // Enable dark mode by default for eye-catching effect.
    document.documentElement.classList.add("dark");
  }, []);

  // If maintenance mode is enabled, show maintenance page only
  if (isMaintenanceMode()) {
    return <MaintenancePage />;
  }

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            {/* Tab switch detector with fade effect */}
            <TabSwitchDetector />
            <AuthProvider>
              <GameProvider>
                <AIAnalysisProvider>
                  <Toaster />
                  <Sonner />
                  {/* Heavy widgets load after paint — don't block routes */}
                  <Suspense fallback={null}>
                    <AIAnalysisWidget />
                    <AIAnalysisToggle />
                  </Suspense>
                  <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-800 to-indigo-900" />}>
                    <AnimatePresence mode="wait">
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/host-login" element={<HostLoginPage />} />
                        <Route path="/host-signup" element={<HostSignupPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="/profile-setup" element={<ProfileSetup />} />
                        <Route path="/host-dashboard" element={
                          <ProtectedRoute>
                            <HostDashboardPage />
                          </ProtectedRoute>
                        } />
                        <Route path="/host-game-room" element={
                          <ProtectedRoute>
                            <HostGameRoomPage />
                          </ProtectedRoute>
                        } />
                        <Route path="/game-room" element={<PlayerGameRoomPage />} />
                        <Route path="/join" element={<JoinGamePage />} />
                        <Route path="/player-setup" element={<PlayerSetupPage />} />
                        <Route path="/leader-animation" element={<LeaderAnimationPage />} />
                        <Route path="/mrdev-celebration" element={<LeaderAnimationPage />} />
                        <Route path="/play-quiz" element={
                          <ProtectedRoute>
                            <PlayQuizPage />
                          </ProtectedRoute>
                        } />
                        <Route path="/create-quiz" element={
                          <ProtectedRoute>
                            <CreateQuizPage />
                          </ProtectedRoute>
                        } />
                        <Route path="/play-quiz/:id" element={<PlayQuizPage />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                        <Route path="/contact" element={<ContactDeveloperPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AnimatePresence>
                  </Suspense>
                </AIAnalysisProvider>
              </GameProvider>
            </AuthProvider>
            {/* Attribution renders outside routes — always visible */}
            <Suspense fallback={null}>
              <CreatorAttribution />
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};
export default App;
