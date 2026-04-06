import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DashboardPage } from "@/features/integrations";
import HelpPage from "@/features/help/HelpPage";
import ManagePluginsPage from "@/features/plugins/ManagePluginsPage";
import SettingsPage from "@/features/settings/SettingsPage";
import SnapshotsPage from "@/features/snapshots/SnapshotsPage";
import NotFoundPage from "@/pages/NotFoundPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/plugins" element={<ManagePluginsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/snapshots" element={<SnapshotsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
