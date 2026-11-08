import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProxyDialog } from "@/features/proxies/components/ProxyDialog";
import { useDeleteProxy, useProxies } from "@/features/proxies/hooks";
import { PROXY_TYPE_LABELS, type ApiProxy, type ProxyInUseBody } from "@/features/proxies/types";
import { ApiError } from "@/shared/api/http";

function deleteErrorMessage(error: Error) {
  if (error instanceof ApiError && error.status === 409) {
    const body = error.body as ProxyInUseBody;
    return `${body.error} Used by: ${body.integrations.map((integration) => integration.name).join(", ")}.`;
  }
  return `Delete failed: ${error.message}`;
}

export function ProxiesTab() {
  const { data: proxies = [], isLoading, error } = useProxies();
  const deleteProxy = useDeleteProxy();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApiProxy | null>(null);

  function openDialog(proxy: ApiProxy | null) {
    setEditing(proxy);
    setDialogOpen(true);
  }

  function handleDelete(proxy: ApiProxy) {
    deleteProxy.mutate(proxy.id, {
      onSuccess: () => toast.success(`Proxy ${proxy.name} deleted`),
      onError: (err) => toast.error(deleteErrorMessage(err)),
    });
  }

  return (
    <Card className="border-border/50" data-testid="proxies-tab">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Proxies</CardTitle>
          <CardDescription>
            HTTP, SOCKS4 or SOCKS5 proxies for trackers that must be reached through one. Pick the proxy in each
            integration's settings; other requests, such as the plugin download, never use a proxy.
          </CardDescription>
        </div>
        <Button onClick={() => openDialog(null)} data-testid="add-proxy">
          <Plus className="mr-2 h-4 w-4" />
          Add proxy
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && <p className="text-sm text-destructive">Failed to load proxies: {error.message}</p>}

        {!isLoading && !error && proxies.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No proxies yet.</p>
        )}

        {proxies.length > 0 && (
          <ul className="divide-y divide-border/50 rounded-md border border-border/50">
            {proxies.map((proxy) => (
              <li
                key={proxy.id}
                data-testid="proxy-row"
                data-proxy-name={proxy.name}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{proxy.name}</span>
                    <Badge variant="secondary">{PROXY_TYPE_LABELS[proxy.type]}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {proxy.host}:{proxy.port}
                    {proxy.username ? ` · user ${proxy.username}` : " · no login"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" aria-label={`Edit ${proxy.name}`} onClick={() => openDialog(proxy)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete ${proxy.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete proxy?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes {proxy.name}. A proxy that an integration still uses cannot be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDelete(proxy)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ProxyDialog open={dialogOpen} proxy={editing} onOpenChange={setDialogOpen} />
    </Card>
  );
}
