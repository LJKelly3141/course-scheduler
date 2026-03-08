import {
  Rocket,
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Users,
  DoorOpen,
  Calendar,
  BarChart3,
  Upload,
  Settings,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import gettingStarted from "./content/getting-started.md?raw";
import dashboard from "./content/dashboard.md?raw";
import scheduleGrid from "./content/schedule-grid.md?raw";
import courses from "./content/courses.md?raw";
import instructors from "./content/instructors.md?raw";
import rooms from "./content/rooms.md?raw";
import terms from "./content/terms.md?raw";
import analytics from "./content/analytics.md?raw";
import importExport from "./content/import-export.md?raw";
import settings from "./content/settings.md?raw";
import conflicts from "./content/conflicts.md?raw";
import tips from "./content/tips.md?raw";

export interface HelpTopic {
  id: string;
  label: string;
  icon: LucideIcon;
  content: string;
}

export const helpTopics: HelpTopic[] = [
  { id: "getting-started", label: "Getting Started", icon: Rocket, content: gettingStarted },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, content: dashboard },
  { id: "schedule-grid", label: "Schedule Grid", icon: CalendarDays, content: scheduleGrid },
  { id: "courses", label: "Courses", icon: BookOpen, content: courses },
  { id: "instructors", label: "Instructors", icon: Users, content: instructors },
  { id: "rooms", label: "Rooms", icon: DoorOpen, content: rooms },
  { id: "terms", label: "Terms", icon: Calendar, content: terms },
  { id: "analytics", label: "Analytics", icon: BarChart3, content: analytics },
  { id: "import-export", label: "Import & Export", icon: Upload, content: importExport },
  { id: "settings", label: "Settings", icon: Settings, content: settings },
  { id: "conflicts", label: "Conflicts", icon: AlertTriangle, content: conflicts },
  { id: "tips", label: "Tips & Shortcuts", icon: Lightbulb, content: tips },
];
