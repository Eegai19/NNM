import {
  Activity,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  Library,
  Server,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Roles allowed to see this entry; omit for "everyone". */
  roles?: UserRole[];
  end?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Operations",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Nodes", to: "/nodes", icon: Server, end: true },
      { label: "Activities", to: "/activities", icon: Activity },
      {
        label: "Assignments",
        to: "/assignments",
        icon: ClipboardList,
        roles: ["TPM", "LEAD"],
      },
    ],
  },
  {
    title: "Insights",
    items: [{ label: "Reports", to: "/reports", icon: FileSpreadsheet }],
  },
  {
    title: "Administration",
    items: [
      { label: "Users", to: "/users", icon: Users, roles: ["TPM"] },
      { label: "Master Data", to: "/master-data", icon: Library, roles: ["TPM", "LEAD"] },
    ],
  },
];

/** Drop the sections and items the given role may not see. */
export function visibleSections(role: UserRole | undefined): NavSection[] {
  if (!role) return [];
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
