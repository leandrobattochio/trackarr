import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HttpSettingsTabProps {
  isDirty: boolean;
  isBusy: boolean;
  isLoading: boolean;
  error: Error | null;
  userAgent: string;
  checkForUpdates: boolean;
  checkForUpdatesOverridden: boolean;
  validationError: string | null;
  onChangeUserAgent: (value: string) => void;
  onChangeCheckForUpdates: (value: boolean) => void;
  onSave: () => void;
}

export function HttpSettingsTab({
  isDirty,
  isBusy,
  isLoading,
  error,
  userAgent,
  checkForUpdates,
  checkForUpdatesOverridden,
  validationError,
  onChangeUserAgent,
  onChangeCheckForUpdates,
  onSave,
}: HttpSettingsTabProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Outgoing Request Headers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading && (
          <div className="flex min-h-[220px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load settings: {error.message}
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="space-y-2">
              <Label htmlFor="user-agent">User-Agent</Label>
              <Input
                id="user-agent"
                value={userAgent}
                onChange={(event) => onChangeUserAgent(event.target.value)}
                placeholder="Mozilla/5.0 ..."
                autoComplete="off"
                disabled={isBusy}
              />
              <p className="text-sm text-muted-foreground">
                This value is required and is applied to plugin HTTP requests.
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="check-for-updates"
                  checked={checkForUpdates}
                  onCheckedChange={(checked) => onChangeCheckForUpdates(checked === true)}
                  disabled={isBusy}
                />
                <div className="space-y-1">
                  <Label htmlFor="check-for-updates">Check for TrackArr updates</Label>
                  <p className="text-sm text-muted-foreground">
                    The backend checks GitHub releases and reports when a newer container tag is available.
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {checkForUpdatesOverridden
                  ? "Saved in the database and overriding the environment flag."
                  : "Using the environment-configured default until this setting is saved."}
              </p>
            </div>

            {validationError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {validationError}
              </div>
            )}

            <div className="flex justify-end border-t border-border/60 pt-4">
              <Button onClick={onSave} disabled={isBusy || !isDirty}>
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
