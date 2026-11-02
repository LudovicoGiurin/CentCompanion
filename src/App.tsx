import { BrowserRouter, useLocation, Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "./hooks/useAuth";
import { GeoProvider } from "./hooks/useGeo";
import { ThemeProvider } from "./hooks/useTheme";
import { ToastProvider } from "./hooks/useToast";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { EventsPage } from "./pages/EventsPage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { RulesPage } from "./pages/RulesPage";
import { BanlistPage } from "./pages/BanlistPage";
import { MetagamePage } from "./pages/MetagamePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import {
  VerifyEmailPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  ResendVerificationPage,
} from "./pages/AuthPages";
import { DashboardPage, SettingsPage } from "./pages/DashboardPage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { AdminPage } from "./pages/AdminPage";
import { JoinPage } from "./pages/JoinPage";
import { EventDisplayPage } from "./pages/EventDisplayPage";
import { OrganizerPage } from "./pages/OrganizerPage";
import { OrganizerProfilePage } from "./pages/OrganizerProfilePage";
import { OAuthCompletePage } from "./pages/OAuthCompletePage";
import { MagicLoginPage } from "./pages/MagicLoginPage";
import { PrivacyPage, TermsPage } from "./pages/LegalPages";
import { FramePreviewPage } from "./pages/FramePreviewPage";

function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/banlist" element={<BanlistPage />} />
        <Route path="/metagame" element={<MetagamePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/oauth/complete" element={<OAuthCompletePage />} />
        <Route path="/magic-login" element={<MagicLoginPage />} />
        <Route path="/organizers/:id" element={<OrganizerProfilePage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/resend-verification"
          element={<ResendVerificationPage />}
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/profile" element={<DashboardPage />} />
        <Route path="/users/:id" element={<PublicProfilePage />} />
        <Route path="/dashboard" element={<Navigate to="/profile" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/organizer" element={<OrganizerPage />} />
      </Routes>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <GeoProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                <Route
                  path="/events/:id/display"
                  element={<EventDisplayPage />}
                />
                {import.meta.env.DEV ? (
                  <Route path="/dev/frames" element={<FramePreviewPage />} />
                ) : null}
                <Route
                  path="*"
                  element={
                    <Layout>
                      <AppRoutes />
                    </Layout>
                  }
                />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </GeoProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
