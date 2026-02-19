import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { SchedulePage } from "./pages/SchedulePage";
import { InstructorsPage } from "./pages/InstructorsPage";
import { RoomsPage } from "./pages/RoomsPage";
import { CoursesPage } from "./pages/CoursesPage";
import { ImportPage } from "./pages/ImportPage";
import { TermsPage } from "./pages/TermsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { LoginPage } from "./pages/LoginPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

const isFileProtocol = window.location.protocol === "file:";
const Router = isFileProtocol ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/instructors" element={<InstructorsPage />} />
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
