/**
 * Admin Plan Management System Types
 * 관리자용 유연한 플랜 관리 시스템 타입 정의
 */

// ============================================
// 기본 타입
// ============================================

export type ContentType = 'book' | 'lecture' | 'custom';

export type RangeType = 'page' | 'chapter' | 'lecture_num' | 'custom';

export type ContainerType = 'daily' | 'weekly' | 'unfinished';

export type PlanStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';

export type ConsultationStatus = 'none' | 'pending' | 'scheduled' | 'completed';

export type ActorType = 'student' | 'admin' | 'system' | 'scheduler';

export type EventCategory =
  | 'plan_group'
  | 'plan_item'
  | 'volume'
  | 'content'
  | 'progress'
  | 'adhoc'
  | 'consultation'
  | 'system';

export type EventType =
  // 플랜 그룹 이벤트
  | 'plan_group_created'
  | 'plan_group_updated'
  | 'plan_group_deleted'
  | 'plan_group_activated'
  | 'plan_group_deactivated'
  | 'plan_group_locked'
  | 'plan_group_unlocked'
  | 'unlock_requested'
  | 'unlock_approved'
  | 'unlock_rejected'
  // 플랜 아이템 이벤트
  | 'plan_created'
  | 'plan_updated'
  | 'plan_deleted'
  | 'plan_completed'
  | 'plan_skipped'
  | 'plan_cancelled'
  | 'plan_rescheduled'
  | 'plan_carryover'
  | 'container_moved'
  // 볼륨 이벤트
  | 'volume_adjusted'
  | 'volume_redistributed'
  // 콘텐츠 이벤트
  | 'content_added'
  | 'content_removed'
  | 'content_replaced'
  // 진행 이벤트
  | 'progress_updated'
  | 'timer_started'
  | 'timer_paused'
  | 'timer_resumed'
  | 'timer_completed'
  // Ad-hoc 이벤트
  | 'adhoc_created'
  | 'adhoc_completed'
  | 'adhoc_cancelled'
  // 상담 이벤트
  | 'consultation_requested'
  | 'consultation_scheduled'
  | 'consultation_completed'
  // 시스템 이벤트
  | 'system_regenerated'
  | 'bulk_update'
  | 'import'
  | 'export';

// ============================================
// Flexible Contents (유연한 콘텐츠)
// ============================================

export interface FlexibleContent {
  id: string;
  tenant_id: string;
  content_type: ContentType;

  // 과목 정보
  curriculum: string | null;
  subject_area: string | null;
  subject: string | null;
  subject_id: string | null;

  // 콘텐츠 정보
  title: string;
  description: string | null;

  // 마스터 콘텐츠 연결 (선택적)
  master_book_id: string | null;
  master_lecture_id: string | null;
  master_custom_content_id: string | null;

  // 범위 정보
  range_type: RangeType | null;
  range_start: string | null;
  range_end: string | null;
  range_unit: string | null;
  total_volume: number | null;

  // 메타데이터
  student_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlexibleContentInsert {
  tenant_id: string;
  content_type: ContentType;
  title: string;
  curriculum?: string | null;
  subject_area?: string | null;
  subject?: string | null;
  subject_id?: string | null;
  description?: string | null;
  master_book_id?: string | null;
  master_lecture_id?: string | null;
  master_custom_content_id?: string | null;
  range_type?: RangeType | null;
  range_start?: string | null;
  range_end?: string | null;
  range_unit?: string | null;
  total_volume?: number | null;
  student_id?: string | null;
  created_by?: string | null;
}

export interface FlexibleContentUpdate {
  content_type?: ContentType;
  title?: string;
  curriculum?: string | null;
  subject_area?: string | null;
  subject?: string | null;
  subject_id?: string | null;
  description?: string | null;
  master_book_id?: string | null;
  master_lecture_id?: string | null;
  master_custom_content_id?: string | null;
  range_type?: RangeType | null;
  range_start?: string | null;
  range_end?: string | null;
  range_unit?: string | null;
  total_volume?: number | null;
}

// ============================================
// Ad-hoc Plans (단발성 플랜)
// ============================================

export interface AdHocPlan {
  id: string;
  tenant_id: string;
  student_id: string;
  plan_date: string;
  title: string;
  description: string | null;
  content_type: ContentType | null;
  flexible_content_id: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  status: PlanStatus;
  container_type: ContainerType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AdHocPlanInsert {
  tenant_id: string;
  student_id: string;
  plan_date: string;
  title: string;
  description?: string | null;
  content_type?: ContentType | null;
  flexible_content_id?: string | null;
  estimated_minutes?: number | null;
  container_type?: ContainerType;
  created_by?: string | null;
}

export interface AdHocPlanUpdate {
  plan_date?: string;
  title?: string;
  description?: string | null;
  content_type?: ContentType | null;
  flexible_content_id?: string | null;
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
  status?: PlanStatus;
  container_type?: ContainerType;
  started_at?: string | null;
  completed_at?: string | null;
}

// ============================================
// Plan Events (이벤트 소싱)
// ============================================

export interface PlanEvent {
  id: string;
  tenant_id: string;
  plan_group_id: string | null;
  student_plan_id: string | null;
  ad_hoc_plan_id: string | null;
  student_id: string;
  event_type: EventType;
  event_category: EventCategory;
  payload: Record<string, unknown>;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  actor_id: string | null;
  actor_type: ActorType;
  actor_name: string | null;
  occurred_at: string;
  correlation_id: string | null;
  causation_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface PlanEventInsert {
  tenant_id: string;
  student_id: string;
  event_type: EventType;
  event_category: EventCategory;
  plan_group_id?: string | null;
  student_plan_id?: string | null;
  ad_hoc_plan_id?: string | null;
  payload?: Record<string, unknown>;
  previous_state?: Record<string, unknown> | null;
  new_state?: Record<string, unknown> | null;
  actor_id?: string | null;
  actor_type?: ActorType;
  actor_name?: string | null;
  correlation_id?: string | null;
  causation_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

// ============================================
// Student Plan 확장 타입
// ============================================

export interface StudentPlanAdminExtension {
  container_type: ContainerType;
  is_locked: boolean;
  original_volume: number | null;
  carryover_from_date: string | null;
  carryover_count: number;
  flexible_content_id: string | null;
  custom_title: string | null;
  custom_range_display: string | null;
}

// ============================================
// Plan Groups 확장 타입
// ============================================

export interface PlanGroupAdminExtension {
  admin_memo: string | null;
  modification_history: ModificationHistoryEntry[];
  last_admin_id: string | null;
  consultation_status: ConsultationStatus;
  admin_stats: AdminStats | null;
  admin_modified_at: string | null;
  is_locked: boolean;
  unlock_requested: boolean;
  unlock_request_memo: string | null;
}

export interface ModificationHistoryEntry {
  timestamp: string;
  admin_id: string;
  admin_name: string;
  action: string;
  details: Record<string, unknown>;
}

export interface AdminStats {
  total_plans: number;
  completed_plans: number;
  pending_plans: number;
  completion_rate: number;
  average_daily_volume: number;
  last_calculated_at: string;
}

// ============================================
// 컨테이너 관련 타입
// ============================================

export interface ContainerSummary {
  unfinished: ContainerItemCount;
  daily: ContainerItemCount;
  weekly: ContainerItemCount;
}

export interface ContainerItemCount {
  count: number;
  total_volume: number;
  completed_volume: number;
}

// ============================================
// 재분배 관련 타입
// ============================================

export type RedistributionMode = 'auto' | 'manual' | 'weekly_dock';

export interface RedistributionRequest {
  plan_id: string;
  volume_change: number;
  mode: RedistributionMode;
  target_date?: string;
  preview_only?: boolean;
}

export interface RedistributionPreview {
  affected_plans: {
    plan_id: string;
    date: string;
    original_volume: number;
    new_volume: number;
    change: number;
  }[];
  total_redistributed: number;
}

export interface RedistributionResult {
  success: boolean;
  preview: RedistributionPreview;
  applied: boolean;
  event_id?: string;
}

// ============================================
// API 응답 타입
// ============================================

export interface AdminPlanResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  event_id?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// ============================================
// 필터 및 정렬 옵션
// ============================================

export interface FlexibleContentFilters {
  content_type?: ContentType;
  subject_area?: string;
  subject?: string;
  student_id?: string;
  has_master_content?: boolean;
  search?: string;
}

export interface AdHocPlanFilters {
  student_id?: string;
  plan_date_from?: string;
  plan_date_to?: string;
  status?: PlanStatus;
  container_type?: ContainerType;
}

export interface PlanEventFilters {
  student_id?: string;
  plan_group_id?: string;
  event_type?: EventType;
  event_category?: EventCategory;
  actor_type?: ActorType;
  date_from?: string;
  date_to?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  field: string;
  direction: SortDirection;
}
