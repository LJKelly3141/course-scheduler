import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Users,
  DoorOpen,
  BarChart3,
  CalendarRange,
  FileUp,
  Calendar,
  Settings,
  ChevronsUpDown,
  GraduationCap,
  Monitor,
  Sun,
  Moon,
  HelpCircle,
} from "lucide-react";
import type { Term } from "@/api/types";
import { useTheme } from "@/hooks/useTheme";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navGroups = [
  {
    label: "Scheduling",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/schedule", label: "Schedule Grid", icon: CalendarDays },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/courses", label: "Courses", icon: BookOpen },
      { to: "/instructors", label: "Instructors", icon: Users },
      { to: "/rooms", label: "Rooms", icon: DoorOpen },
    ],
  },
  {
    label: "Analyze",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/rotation", label: "Course Rotation", icon: CalendarRange },
      { to: "/import", label: "Import / Export", icon: FileUp },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/terms", label: "Terms", icon: Calendar },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface AppSidebarProps {
  terms: Term[];
  selectedTerm: Term | null;
  onSelectTerm: (id: number) => void;
}

const themeOrder = ["system", "light", "dark"] as const;
const themeIcon = { system: Monitor, light: Sun, dark: Moon };
const themeLabel = { system: "System", light: "Light", dark: "Dark" };

export function AppSidebar({
  terms,
  selectedTerm,
  onSelectTerm,
}: AppSidebarProps) {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const idx = themeOrder.indexOf(theme);
    setTheme(themeOrder[(idx + 1) % themeOrder.length]);
  };

  const ThemeIcon = themeIcon[theme];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  tooltip="Select Term"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                    CS
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {selectedTerm?.name ?? "No Term"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {selectedTerm?.status === "final" ? "Final" : "Draft"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                {terms.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => onSelectTerm(t.id)}
                    className={t.id === selectedTerm?.id ? "bg-accent" : ""}
                  >
                    {t.name}
                    {t.status === "final" ? " (Final)" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="Main navigation">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <NavLink to={item.to}>
                      {({ isActive }) => (
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.label}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavLink to="/help">
              {({ isActive }) => (
                <SidebarMenuButton isActive={isActive} tooltip="Help" aria-current={isActive ? "page" : undefined}>
                  <HelpCircle className="size-4" />
                  <span>Help</span>
                </SidebarMenuButton>
              )}
            </NavLink>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={cycleTheme}
              tooltip={`Theme: ${themeLabel[theme]}`}
            >
              <ThemeIcon className="size-4" />
              <span>{themeLabel[theme]}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="UWRF Course Scheduler">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <GraduationCap className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Course Scheduler</span>
                <span className="truncate text-xs text-muted-foreground">
                  UWRF
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
