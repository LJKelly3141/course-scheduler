import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./hooks/useTheme";
import { UndoRedoProvider } from "./hooks/useUndoRedo";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { SchedulePage } from "./pages/SchedulePage";
import { InstructorHubPage } from "./pages/InstructorHub";
import { RoomsPage } from "./pages/RoomsPage";
import { CoursesPage } from "./pages/CoursesPage";
import { ImportPage } from "./pages/ImportPage";
import { TermsPage } from "./pages/TermsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { CourseRotationPage } from "./pages/CourseRotationPage";
import { ReassignmentPlanPage } from "./pages/ReassignmentPlanPage";
import { HelpPage } from "./pages/HelpPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

const isFileProtocol = window.location.protocol === "file:";
const Router = isFileProtocol ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <UndoRedoProvider>
        <Router>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/instructors" element={<InstructorHubPage />} />
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/rotation" element={<CourseRotationPage />} />
              <Route path="/reassignment-plan" element={<ReassignmentPlanPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Route>
          </Routes>
        </Router>
        <Toaster position="bottom-right" />
        </UndoRedoProvider>
      </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
