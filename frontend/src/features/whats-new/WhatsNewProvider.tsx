import { useState, type ReactNode } from "react";
import { WhatsNewDialog } from "@/features/whats-new/components/WhatsNewDialog";
import { useMarkWhatsNewRead, useWhatsNew } from "@/features/whats-new/hooks";
import { WhatsNewContext } from "@/features/whats-new/whats-new-context";

export function WhatsNewProvider({ children }: { children: ReactNode }) {
  const { data: report, isLoading, error } = useWhatsNew();
  const markRead = useMarkWhatsNewRead();
  const [openedFromMenu, setOpenedFromMenu] = useState(false);
  const [autoOpenDismissed, setAutoOpenDismissed] = useState(false);
  const open = openedFromMenu || (!!report?.shouldAutoOpen && !autoOpenDismissed);

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    setOpenedFromMenu(false);
    setAutoOpenDismissed(true);
    if (report) markRead.mutate(Math.max(0, ...report.pluginUpdates.map((update) => update.id)));
  };

  return (
    <WhatsNewContext.Provider value={{ open: () => setOpenedFromMenu(true), report }}>
      {children}
      <WhatsNewDialog open={open} onOpenChange={handleOpenChange} report={report} isLoading={isLoading} error={error} />
    </WhatsNewContext.Provider>
  );
}
