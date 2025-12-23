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
export type CampProgramType = "윈터캠프" | "썸머캠프" | "파이널캠프" | "기타";

/**
 * 캠프 템플릿 상태
 */
export type CampTemplateStatus = "draft" | "active" | "archived";

/**
 * 캠프 초대 상태
 */
export type CampInvitationStatus = "pending" | "accepted" | "declined" | "expired";

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

// ============================================
// Adapter 관련 타입
// ============================================

/**
 * 캠프 플랜 설정 정보 (campAdapter에서 사용)
 */
export type CampPlanConfig = {
  blockSetId: string | null;
  templateBlocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
  templateBlockSetName: string | null;
  templateBlockSetId: string | null;
  isLegacy: boolean;
};

// ============================================
// 캠프 출석 관련 타입
// ============================================

/**
 * 캠프 출석 통계
 */
export type CampAttendanceStats = {
  template_id: string;
  template_name: string;
  total_participants: number;
  total_days: number;
  attendance_rate: number;
  late_rate: number;
  absent_rate: number;
  participant_stats: Array<{
    student_id: string;
    student_name: string;
    attendance_rate: number;
    absent_count: number;
    late_count: number;
    present_count: number;
    early_leave_count: number;
    excused_count: number;
  }>;
};

/**
 * 참여자별 출석 통계
 */
export type ParticipantAttendanceStats = {
  student_id: string;
  student_name: string;
  total_days: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  early_leave_count: number;
  excused_count: number;
  attendance_rate: number;
  late_rate: number;
  absent_rate: number;
};

// ============================================
// 캠프 학습 통계 관련 타입
// ============================================

/**
 * 캠프 학습 통계
 */
export type CampLearningStats = {
  template_id: string;
  template_name: string;
  total_study_minutes: number;
  average_study_minutes_per_participant: number;
  /** 전체 플랜 수 */
  total_plans: number;
  /** 완료된 플랜 수 */
  completed_plans: number;
  participant_stats: Array<{
    student_id: string;
    student_name: string;
    study_minutes: number;
    plan_completion_rate: number;
    subject_distribution: Record<string, number>;
    /** 해당 학생의 전체 플랜 수 */
    total_plans: number;
    /** 해당 학생의 완료된 플랜 수 */
    completed_plans: number;
  }>;
};

/**
 * 참여자별 학습 통계
 */
export type ParticipantLearningStats = {
  student_id: string;
  student_name: string;
  study_minutes: number;
  plan_completion_rate: number;
  subject_distribution: Record<string, number>;
  total_plans: number;
  completed_plans: number;
};
