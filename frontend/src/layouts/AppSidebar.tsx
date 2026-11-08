import { CircleHelp, ChartLine, LayoutDashboard, Puzzle, Settings2, Sparkles } from "lucide-react";
import { AppUpdateNotice } from "@/features/whats-new/components/AppUpdateNotice";
import { useWhatsNewDialog } from "@/features/whats-new/whats-new-context";
import { NavLink } from "@/layouts/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Snapshots", url: "/snapshots", icon: ChartLine },
  { title: "Manage Plugins", url: "/plugins", icon: Puzzle },
  { title: "Settings", url: "/settings", icon: Settings2 },
  { title: "Help", url: "/help", icon: CircleHelp },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const whatsNew = useWhatsNewDialog();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-4 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-display text-xs font-bold text-primary-foreground">
            TA
          </div>
          {!collapsed && <span className="font-display text-base font-bold text-foreground">TrackArr</span>}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-accent" activeClassName="bg-accent text-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton type="button" onClick={whatsNew.open} className="hover:bg-accent">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {!collapsed && <span>What's New</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            {!collapsed && <AppUpdateNotice app={whatsNew.report?.app} className="px-2 pt-3" />}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
