/**
 * CRM Domain Types
 *
 * 세일즈/상담 관리 시스템의 타입 정의
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

export type SalesLead = Tables<"sales_leads">;
export type SalesLeadInsert = TablesInsert<"sales_leads">;
export type SalesLeadUpdate = TablesUpdate<"sales_leads">;

export type LeadActivity = Tables<"lead_activities">;
export type LeadActivityInsert = TablesInsert<"lead_activities">;

export type Program = Tables<"programs">;
export type ProgramInsert = TablesInsert<"programs">;
export type ProgramUpdate = TablesUpdate<"programs">;

export type LeadScoreLog = Tables<"lead_score_logs">;

export type LeadTask = Tables<"lead_tasks">;
export type LeadTaskInsert = TablesInsert<"lead_tasks">;
export type LeadTaskUpdate = TablesUpdate<"lead_tasks">;

// ============================================
// 비즈니스 타입
// ============================================

export type PipelineStatus =
  | "new"
  | "contacted"
  | "consulting_done"
  | "follow_up"
  | "registration_in_progress"
  | "converted"
  | "lost"
  | "spam";

export type LeadSource =
  | "homepage"
  | "landing_page"
  | "referral"
  | "blog"
  | "phone_inbound"
  | "walk_in"
  | "event"
  | "sns"
  | "advertisement"
  | "naver_search"
  | "kakao_channel"
  | "iam_school"
  | "academy"
  | "other";

export type ActivityType =
  | "phone_call"
  | "sms"
  | "consultation"
  | "follow_up"
  | "status_change"
  | "note"
  | "email"
  | "meeting";

export type RegistrationChecklist = {
  registered: boolean;
  documents: boolean;
  sms_sent: boolean;
  payment: boolean;
};

export type QualityLevel = "hot" | "warm" | "cold";

export type ScoreType = "fit" | "engagement";

export type LeadTaskType =
  | "first_contact"
  | "follow_up_call"
  | "send_proposal"
  | "schedule_trial"
  | "post_trial_follow_up"
  | "collect_documents"
  | "payment_confirm"
  | "custom";

export type LeadTaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type LeadTaskPriority = "high" | "medium" | "low";

// ============================================
// 조인 결과 타입
// ============================================

export type SalesLeadWithRelations = SalesLead & {
  assigned_admin?: { id: string; name: string } | null;
  program?: { id: string; code: string; name: string } | null;
  student?: { id: string; name: string } | null;
};

// ============================================
// 결과 / 필터 타입
// ============================================

export type CrmActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type CrmPaginatedResult<T> = {
  items: T[];
  totalCount: number;
  hasMore: boolean;
};

export type SalesLeadFilter = {
  tenantId: string;
  pipelineStatus?: PipelineStatus;
  leadSource?: LeadSource;
  assignedTo?: string;
  programId?: string;
  qualityLevel?: QualityLevel;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  isSpam?: boolean;
  page?: number;
  pageSize?: number;
};

export type LeadActivityFilter = {
  leadId: string;
  tenantId: string;
  activityType?: ActivityType;
  page?: number;
  pageSize?: number;
};

export type PipelineStats = {
  status: PipelineStatus;
  count: number;
};

// ============================================
// 스코어링 타입
// ============================================

export type ScoreChange = {
  scoreType: ScoreType;
  delta: number;
  reason: string;
};

export type ScoreResult = {
  fitScore: number;
  engagementScore: number;
  qualityLevel: QualityLevel;
  changes: ScoreChange[];
};

// ============================================
// 태스크 필터 / 결과 타입
// ============================================

export type LeadTaskFilter = {
  tenantId: string;
  leadId?: string;
  assignedTo?: string;
  status?: LeadTaskStatus;
  priority?: LeadTaskPriority;
  isOverdue?: boolean;
  page?: number;
  pageSize?: number;
};

export type LeadTaskWithLead = LeadTask & {
  lead?: { id: string; contact_name: string; pipeline_status: string } | null;
};

// ============================================
// 상담 기록 타입
// ============================================

export type ConsultationResult =
  | "consultation_done"
  | "absent_sms"
  | "sms_info"
  | "spam";

export type CallerType = "mother" | "father" | "student" | "other";

export type ConsultationRecord = {
  id: string;
  activity_date: string;
  activity_type: ActivityType;
  title: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  performed_by: string | null;
  lead_id: string;
  lead_source: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  student_name: string | null;
  student_grade: number | null;
  student_school_name: string | null;
  region: string | null;
  program_name: string | null;
  pipeline_status: string | null;
  registration_checklist: RegistrationChecklist | null;
  performer_name: string | null;
};

export type ConsultationRecordFilter = {
  tenantId: string;
  search?: string;
  consultationResult?: ConsultationResult;
  leadSource?: LeadSource;
  performedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type ConsultationInput = {
  contactPhone: string;
  contactName?: string;
  studentName?: string;
  studentGrade?: number;
  studentSchool?: string;
  region?: string;
  callerType: CallerType;
  leadSource: LeadSource;
  programId?: string;
  performedBy?: string;
  consultationResult: ConsultationResult;
  description?: string;
  activityDate?: string;
  checklist?: Partial<RegistrationChecklist>;
  existingLeadId?: string;
};
