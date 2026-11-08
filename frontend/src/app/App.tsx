import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppRouter } from "@/app/router";
import { WhatsNewProvider } from "@/features/whats-new/WhatsNewProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <WhatsNewProvider>
        <AppRouter />
      </WhatsNewProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
