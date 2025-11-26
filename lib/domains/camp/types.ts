/**
 * Camp 도메인 타입 정의
 *
 * Supabase Database 타입에서 파생됩니다.
 * @see lib/supabase/database.types.ts
 */

import type {
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "@/lib/supabase/database.types";

// ============================================
// Database 타입에서 파생된 타입
// ============================================

/**
 * 캠프 템플릿 타입
 */
export type CampTemplate = Tables<"camp_templates">;

/**
 * 캠프 템플릿 생성 입력 타입
 */
export type CampTemplateInsert = TablesInsert<"camp_templates">;

/**
 * 캠프 템플릿 수정 입력 타입
 */
export type CampTemplateUpdate = TablesUpdate<"camp_templates">;

/**
 * 캠프 초대 타입
 */
export type CampInvitation = Tables<"camp_invitations">;

/**
 * 캠프 초대 생성 입력 타입
 */
export type CampInvitationInsert = TablesInsert<"camp_invitations">;

/**
 * 캠프 초대 수정 입력 타입
 */
export type CampInvitationUpdate = TablesUpdate<"camp_invitations">;

// ============================================
// Enum 타입
// ============================================

/**
 * 캠프 프로그램 유형
 */
export type CampProgramType = Enums<"camp_program_type">;

/**
 * 캠프 템플릿 상태
 */
export type CampTemplateStatus = Enums<"camp_template_status">;

/**
 * 캠프 초대 상태
 */
export type CampInvitationStatus = Enums<"camp_invitation_status">;

// ============================================
// 비즈니스 로직용 타입
// ============================================

/**
 * 캠프 템플릿 조회 필터
 */
export type GetCampTemplatesFilter = {
  tenantId: string;
  status?: CampTemplateStatus | CampTemplateStatus[];
  programType?: CampProgramType;
};

/**
 * 캠프 초대 조회 필터
 */
export type GetCampInvitationsFilter = {
  tenantId?: string;
  studentId?: string;
  templateId?: string;
  status?: CampInvitationStatus | CampInvitationStatus[];
};

// ============================================
// 응답 타입
// ============================================

/**
 * 캠프 템플릿 액션 결과
 */
export type CampTemplateActionResult = {
  success: boolean;
  error?: string;
  templateId?: string;
  template?: CampTemplate;
};

/**
 * 캠프 초대 액션 결과
 */
export type CampInvitationActionResult = {
  success: boolean;
  error?: string;
  invitationId?: string;
  invitation?: CampInvitation;
};

