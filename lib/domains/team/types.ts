/**
 * 팀 관리 도메인 타입 정의
 */

import type { Database } from "@/lib/supabase/database.types";

// DB 테이블 타입
export type TeamInvitationRow = Database["public"]["Tables"]["team_invitations"]["Row"];
export type TeamInvitationInsert = Database["public"]["Tables"]["team_invitations"]["Insert"];
export type TeamInvitationUpdate = Database["public"]["Tables"]["team_invitations"]["Update"];

// 초대 상태
export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

// 초대 역할
export type InvitationRole = "admin" | "consultant";

// 초대 생성 입력
export interface CreateInvitationInput {
  email: string;
  role: InvitationRole;
}

// 초대 정보 (조회용)
export interface TeamInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  token: string;
  invitedBy: string;
  inviterName?: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  createdAt: string;
}

// 팀원 정보 (조회용)
export interface TeamMember {
  id: string;
  email: string;
  displayName: string | null;
  role: "admin" | "consultant";
  tenantId: string;
  createdAt: string;
}

// 초대 생성 결과
export interface CreateInvitationResult {
  success: boolean;
  invitation?: TeamInvitation;
  error?: string;
  /** 이메일 발송 성공 여부 */
  emailSent?: boolean;
  /** 이메일 발송 실패 시 에러 메시지 */
  emailError?: string;
}

// 초대 수락 입력
export interface AcceptInvitationInput {
  token: string;
}

// 초대 수락 결과
export interface AcceptInvitationResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

// 회원가입 + 초대 수락 입력
export interface SignUpAndAcceptInput {
  token: string;
  email: string;
  password: string;
  name: string;
}

// 회원가입 + 초대 수락 결과
export interface SignUpAndAcceptResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

// 팀 개요 (대시보드용)
export interface TeamOverview {
  totalMembers: number;
  adminCount: number;
  consultantCount: number;
  pendingInvitations: number;
}
