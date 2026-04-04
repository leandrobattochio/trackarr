import { toast } from "sonner";
import { useDeleteIntegration, useSyncIntegration } from "@/features/integrations/hooks";
import type { TrackerIntegration } from "@/features/integrations/types";

export function useTrackerCardActions(tracker: TrackerIntegration) {
  const { mutate: sync, isPending: isSyncing } = useSyncIntegration();
  const { mutate: remove, isPending: isDeleting } = useDeleteIntegration();

  const actionsDisabled = isSyncing || isDeleting;

  function handleSync() {
    sync(tracker.id, {
      onSuccess: (result) => {
        const message = result.lastSyncResult === "success"
          ? `${tracker.name} synced successfully`
          : result.lastSyncResult === "authFailed"
            ? `${tracker.name} sync failed: authentication failed`
            : `${tracker.name} sync failed: unknown error`;

        if (result.lastSyncResult === "success") {
          toast.success(message);
          return;
        }

        toast.error(message);
      },
      onError: (err) => toast.error(`Sync failed: ${err.message}`),
    });
  }

  function handleDelete() {
    remove(tracker.id, {
      onSuccess: () => toast.success(`${tracker.name} removed`),
      onError: (err) => toast.error(`Delete failed: ${err.message}`),
    });
  }

  return {
    isSyncing,
    isDeleting,
    actionsDisabled,
    handleSync,
    handleDelete,
  };
}
