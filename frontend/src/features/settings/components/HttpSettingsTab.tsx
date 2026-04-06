import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HttpSettingsTabProps {
  isDirty: boolean;
  isBusy: boolean;
  isLoading: boolean;
  error: Error | null;
  userAgent: string;
  validationError: string | null;
  onChangeUserAgent: (value: string) => void;
  onSave: () => void;
}

export function HttpSettingsTab({
  isDirty,
  isBusy,
  isLoading,
  error,
  userAgent,
  validationError,
  onChangeUserAgent,
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
