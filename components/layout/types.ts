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
  /** 프로필 이미지 URL */
  profileImageUrl?: string | null;
  /** 사용자 이메일 */
  userEmail?: string | null;
  /** A1 개선: 인앱 알림 센터에 사용할 userId */
  userId?: string | null;
};
