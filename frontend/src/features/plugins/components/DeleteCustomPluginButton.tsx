import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getBlockingIntegrations } from "@/features/plugins/api";
import { useDeleteCustomPlugin } from "@/features/plugins/hooks";
import type { ApiPluginBlockingIntegration } from "@/features/plugins/types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteCustomPluginButtonProps {
  pluginId: string;
  pluginName: string;
  disabled?: boolean;
  onDeleted: (pluginId: string) => void;
}

interface DeleteBlock {
  message: string;
  integrations: ApiPluginBlockingIntegration[];
}

export function DeleteCustomPluginButton({ pluginId, pluginName, disabled, onDeleted }: DeleteCustomPluginButtonProps) {
  const deleteMutation = useDeleteCustomPlugin();
  const [open, setOpen] = useState(false);
  const [block, setBlock] = useState<DeleteBlock | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setBlock(null);
    }
  }

  function handleDelete() {
    deleteMutation.mutate(pluginId, {
      onSuccess: () => {
        setOpen(false);
        toast.success(`${pluginName} deleted.`);
        onDeleted(pluginId);
      },
      onError: (error) => {
        const integrations = getBlockingIntegrations(error);
        if (integrations) {
          setBlock({ message: error.message, integrations });
          return;
        }

        setOpen(false);
        toast.error(`Delete failed: ${error.message}`);
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive" disabled={disabled}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {block ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{pluginName} is in use</AlertDialogTitle>
              <AlertDialogDescription>{block.message}</AlertDialogDescription>
            </AlertDialogHeader>
            <ul data-testid="delete-blocking-integrations" className="space-y-1 text-sm">
              {block.integrations.map((integration) => (
                <li key={integration.id} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 font-mono text-xs">
                  {integration.url ?? `Integration ${integration.id}`}
                </li>
              ))}
            </ul>
            <AlertDialogFooter>
              <Button variant="outline" asChild>
                <Link to="/">Open dashboard</Link>
              </Button>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {pluginName}?</AlertDialogTitle>
              <AlertDialogDescription>
                The custom plugin file is deleted with no backup. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
                onClick={handleDelete}
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete plugin
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
