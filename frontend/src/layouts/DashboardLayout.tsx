import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/layouts/AppSidebar";
import { OutdatedOverridesBanner } from "@/features/plugins/components/OutdatedOverridesBanner";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center border-b border-border/50 px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-4 sm:p-6">
            <OutdatedOverridesBanner className="mb-6" />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
