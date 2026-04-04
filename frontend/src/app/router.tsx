import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DashboardPage } from "@/features/integrations";
import { HelpPage } from "@/features/help";
import { SnapshotsPage } from "@/features/snapshots";
import NotFoundPage from "@/pages/NotFoundPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/snapshots" element={<SnapshotsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
