import { ReactNode } from "react";

export type RoleBasedLayoutProps = {
  role: "student" | "admin" | "parent" | "consultant" | "superadmin";
  children: ReactNode;
  dashboardHref: string;
  roleLabel: string;
  showSidebar?: boolean;
  wrapper?: (children: ReactNode) => ReactNode;
  tenantInfo?: {
    name: string;
    type?: string;
  } | null;
  userName?: string | null;
  /** A1 개선: 인앱 알림 센터에 사용할 userId */
  userId?: string | null;
};
