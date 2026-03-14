/**
 * 팀 관리 도메인 타입 정의
 */

// 역할 타입
export type InvitationRole = "admin" | "consultant";

// 팀원 정보 (조회용)
export interface TeamMember {
  id: string;
  email: string;
  displayName: string | null;
  role: "admin" | "consultant";
  isOwner: boolean;
  tenantId: string;
  createdAt: string;
  profileImageUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  phone: string | null;
}

// 팀 개요 (대시보드용)
export interface TeamOverview {
  totalMembers: number;
  adminCount: number;
  consultantCount: number;
  pendingInvitations: number;
}
