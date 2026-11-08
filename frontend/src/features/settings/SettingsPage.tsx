import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProxiesTab } from "@/features/proxies";
import { AboutTab, HttpSettingsTab, PluginDownloadStatus } from "@/features/settings/components";
import { useAboutInfo, usePluginDownloadStatus, useSettings, useUpdateSettings } from "@/features/settings/hooks";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePageTitle } from "@/shared/hooks/use-page-title";

export default function SettingsPage() {
  usePageTitle("TrackArr | Settings");

  const settingsQuery = useSettings();
  const aboutQuery = useAboutInfo();
  const pluginDownloadQuery = usePluginDownloadStatus();
  const updateMutation = useUpdateSettings();
  const [userAgent, setUserAgent] = useState("");
  const [baselineUserAgent, setBaselineUserAgent] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    setUserAgent(settingsQuery.data.userAgent);
    setBaselineUserAgent(settingsQuery.data.userAgent);
    setValidationError(null);
  }, [settingsQuery.data]);

  function handleSave() {
    const trimmedUserAgent = userAgent.trim();
    if (!trimmedUserAgent) {
      setValidationError("User-Agent must not be empty.");
      return;
    }

    updateMutation.mutate(trimmedUserAgent, {
      onSuccess: (updated) => {
        setUserAgent(updated.userAgent);
        setBaselineUserAgent(updated.userAgent);
        setValidationError(null);
        toast.success("Settings saved.");
      },
      onError: (error) => {
        toast.error(`Save failed: ${error.message}`);
      },
    });
  }

  function handleChangeUserAgent(value: string) {
    setUserAgent(value);
    if (validationError) {
      setValidationError(null);
    }
  }

  const isDirty = userAgent !== baselineUserAgent;
  const isBusy = settingsQuery.isLoading || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure application-wide behavior.
          </p>
        </div>

        <Tabs defaultValue="http" className="space-y-6">
          <TabsList>
            <TabsTrigger value="http">HTTP</TabsTrigger>
            <TabsTrigger value="proxies">Proxies</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="http" className="mt-0">
            <HttpSettingsTab
              isDirty={isDirty}
              isBusy={isBusy}
              isLoading={settingsQuery.isLoading}
              error={settingsQuery.error}
              userAgent={userAgent}
              validationError={validationError}
              onChangeUserAgent={handleChangeUserAgent}
              onSave={handleSave}
            />
          </TabsContent>

          <TabsContent value="proxies" className="mt-0">
            <ProxiesTab />
          </TabsContent>

          <TabsContent value="about" className="mt-0 space-y-6">
            <AboutTab
              isLoading={aboutQuery.isLoading}
              error={aboutQuery.error}
              aboutInfo={aboutQuery.data ?? null}
            />
            <PluginDownloadStatus
              isLoading={pluginDownloadQuery.isLoading}
              error={pluginDownloadQuery.error}
              status={pluginDownloadQuery.data ?? null}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
