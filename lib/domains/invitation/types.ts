/**
 * 통합 초대 시스템 타입 정의
 */

// 초대 대상 역할
export type InvitationRole = "admin" | "consultant" | "student" | "parent";

// 발송 방식
export type DeliveryMethod = "email" | "sms" | "kakao" | "qr" | "manual";

// 발송 상태
export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";

// 초대 상태
export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

// 학부모 관계
export type InvitationRelation = "father" | "mother" | "guardian";

// ============================================
// 초대 데이터 (조회용)
// ============================================

export interface Invitation {
  id: string;
  token: string;
  tenantId: string;
  tenantName: string | null;
  targetRole: InvitationRole;
  email: string | null;
  phone: string | null;
  studentId: string | null;
  studentName: string | null;
  relation: InvitationRelation | null;
  legacyCode: string | null;
  status: InvitationStatus;
  expiresAt: string;
  deliveryMethod: DeliveryMethod;
  deliveryStatus: DeliveryStatus;
  deliveredAt: string | null;
  invitedBy: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  createdAt: string;
}

// ============================================
// 초대 생성 입력
// ============================================

export interface CreateInvitationInput {
  targetRole: InvitationRole;
  deliveryMethod: DeliveryMethod;

  // 대상 식별
  email?: string;
  phone?: string;
  studentId?: string;
  relation?: InvitationRelation;

  // 만료 일수 (기본: admin/consultant=7, student/parent=30)
  expiryDays?: number;
}

// ============================================
// 초대 생성 결과
// ============================================

export interface CreateInvitationResult {
  success: boolean;
  invitation?: Invitation;
  joinUrl?: string;
  error?: string;
  warning?: string;
  deliverySent?: boolean;
  deliveryError?: string;
}

// ============================================
// 초대 검증 결과 (토큰/코드로 조회)
// ============================================

export interface ValidateInvitationResult {
  success: boolean;
  invitation?: {
    id: string;
    token: string;
    tenantId: string;
    tenantName: string | null;
    targetRole: InvitationRole;
    studentId: string | null;
    studentName: string | null;
    relation: InvitationRelation | null;
    email: string | null;
    expiresAt: string;
  };
  error?: string;
}

// ============================================
// 초대 수락 결과
// ============================================

export interface AcceptInvitationResult {
  success: boolean;
  redirectTo?: string;
  error?: string;
}
