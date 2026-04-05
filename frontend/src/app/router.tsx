import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DashboardPage } from "@/features/integrations";
import NotFoundPage from "@/pages/NotFoundPage";

const HelpPage = lazy(() => import("@/features/help/HelpPage"));
const ManagePluginsPage = lazy(() => import("@/features/plugins/ManagePluginsPage"));
const SnapshotsPage = lazy(() => import("@/features/snapshots/SnapshotsPage"));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/plugins" element={<ManagePluginsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/snapshots" element={<SnapshotsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
