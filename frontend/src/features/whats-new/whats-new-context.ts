import { createContext, useContext } from "react";
import type { ApiWhatsNew } from "@/features/whats-new/types";

export interface WhatsNewContextValue {
  open: () => void;
  report: ApiWhatsNew | undefined;
}

export const WhatsNewContext = createContext<WhatsNewContextValue>({ open: () => {}, report: undefined });

export function useWhatsNewDialog() {
  return useContext(WhatsNewContext);
}
