/**
 * 플랜 생성 관련 타입 정의
 *
 * plans.ts의 _generatePlansFromGroup, _previewPlansFromGroup 함수에서
 * 공통으로 사용하는 타입들을 정의합니다.
 *
 * @module lib/types/plan-generation
 */

import type {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
  ContentType,
} from "./plan";

// Re-export common types
export type { ContentType } from "./plan";

// ============================================
// 스케줄 관련 타입
// ============================================

/**
 * 일 유형 (학습일, 복습일, 제외일 등)
 */
export type DayType =
  | "학습일"
  | "복습일"
  | "지정휴일"
  | "휴가"
  | "개인일정"
  | null;

/**
 * 시간 슬롯 유형
 */
export type TimeSlotType =
  | "학습시간"
  | "점심시간"
  | "학원일정"
  | "이동시간"
  | "자율학습";

/**
 * 시간 슬롯
 */
export type TimeSlot = {
  type: TimeSlotType;
  start: string; // HH:mm
  end: string; // HH:mm
  label?: string;
};

/**
 * 사용 가능 시간 범위
 */
export type AvailableTimeRange = {
  start: string; // HH:mm
  end: string; // HH:mm
};

/**
 * 날짜별 사용 가능 시간 범위 맵
 */
export type DateAvailableTimeRangesMap = Map<string, AvailableTimeRange[]>;

/**
 * 날짜별 시간 슬롯 맵
 */
export type DateTimeSlotsMap = Map<string, TimeSlot[]>;

/**
 * 날짜별 메타데이터
 */
export type DateMetadata = {
  day_type: DayType;
  week_number: number | null;
};

/**
 * 날짜별 메타데이터 맵
 */
export type DateMetadataMap = Map<string, DateMetadata>;

/**
 * 주차별 날짜 목록 맵
 */
export type WeekDatesMap = Map<number, string[]>;

// ============================================
// 콘텐츠 관련 타입
// ============================================

/**
 * 콘텐츠 ID 매핑 (마스터 -> 학생)
 */
export type ContentIdMap = Map<string, string>;

/**
 * 콘텐츠 메타데이터
 */
export type ContentMetadata = {
  title?: string | null;
  subject?: string | null;
  subject_category?: string | null;
  category?: string | null;
};

/**
 * 콘텐츠 메타데이터 맵
 */
export type ContentMetadataMap = Map<string, ContentMetadata>;

/**
 * Episode 정보 타입
 */
export type EpisodeInfo = {
  episode_number: number;
  duration: number | null; // 회차별 소요시간 (분)
};

/**
 * 콘텐츠 소요시간 정보
 */
export type ContentDurationInfo = {
  content_type: ContentType;
  content_id: string;
  total_pages?: number | null;
  duration?: number | null; // 전체 강의 시간 (fallback용)
  total_page_or_time?: number | null;
  total_episodes?: number | null; // 강의 총 회차 수 (정확한 계산용)
  /** @deprecated difficulty_level_id를 사용하세요. 하위 호환성을 위해 유지됩니다. */
  difficulty_level?: string | null; // 난이도 (교재/강의)
  difficulty_level_id?: string | null;
  episodes?: EpisodeInfo[] | null; // 강의 episode별 duration 정보
};

/**
 * Episode 정보가 유효한지 확인하는 타입 가드
 */
export function hasValidEpisodes(
  episodes: ContentDurationInfo["episodes"]
): episodes is EpisodeInfo[] {
  return Array.isArray(episodes) && episodes.length > 0;
}

/**
 * ContentDurationInfo가 유효한지 확인하는 타입 가드
 */
export function isValidContentDurationInfo(
  info: ContentDurationInfo | null | undefined
): info is ContentDurationInfo {
  return info !== null && info !== undefined && !!info.content_id;
}

/**
 * 콘텐츠 소요시간 맵
 */
export type ContentDurationMap = Map<string, ContentDurationInfo>;

/**
 * 콘텐츠 과목 정보
 */
export type ContentSubjectInfo = {
  subject?: string | null;
  subject_category?: string | null;
};

/**
 * 콘텐츠 과목 맵
 */
export type ContentSubjectsMap = Map<string, ContentSubjectInfo>;

// ============================================
// 플랜 생성 컨텍스트 타입
// ============================================

/**
 * 플랜 그룹 데이터 로드 결과
 */
export type LoadedPlanGroupData = {
  group: PlanGroup;
  contents: PlanContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
};

/**
 * 스케줄 계산 결과
 */
export type ScheduleCalculationResult = {
  dateAvailableTimeRanges: DateAvailableTimeRangesMap;
  dateTimeSlots: DateTimeSlotsMap;
  dateMetadataMap: DateMetadataMap;
  weekDatesMap: WeekDatesMap;
};

/**
 * 콘텐츠 해석 결과
 */
export type ContentResolutionResult = {
  contentIdMap: ContentIdMap;
  contentMetadataMap: ContentMetadataMap;
  contentDurationMap: ContentDurationMap;
  contentSubjects: ContentSubjectsMap;
};

/**
 * 플랜 생성 컨텍스트
 * 플랜 생성/미리보기에서 공통으로 사용하는 모든 데이터를 포함
 */
export type PlanGenerationContext = {
  // 권한 및 인증
  userId: string;
  role: "student" | "admin" | "consultant";
  tenantId: string;
  studentId: string;

  // 플랜 그룹 데이터
  planGroupData: LoadedPlanGroupData;

  // 스케줄 정보
  scheduleResult: ScheduleCalculationResult;

  // 콘텐츠 정보
  contentResolution: ContentResolutionResult;

  // 스케줄러 옵션
  schedulerOptions: {
    study_days: number;
    review_days: number;
    weak_subject_focus?: "low" | "medium" | "high" | boolean;
    review_scope?: string;
    lunch_time?: { start: string; end: string };
    camp_study_hours?: { start: string; end: string };
    self_study_hours?: { start: string; end: string };
  };
};

// ============================================
// 플랜 페이로드 타입
// ============================================

/**
 * 생성/미리보기 플랜 공통 필드
 */
export type PlanPayloadBase = {
  plan_date: string;
  block_index: number;
  content_type: ContentType;
  content_id: string;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter: string | null;
  start_time: string | null;
  end_time: string | null;
  day_type: DayType;
  week: number | null;
  day: number | null;
  is_partial: boolean;
  is_continued: boolean;
  plan_number: number | null;
  subject_type?: "strategy" | "weakness" | null; // 전략/취약 정보
};

/**
 * 플랜 생성용 페이로드 (DB 저장용)
 */
export type GeneratePlanPayload = PlanPayloadBase & {
  tenant_id: string;
  student_id: string;
  plan_group_id: string;
  is_reschedulable: boolean;
  content_title: string | null;
  content_subject: string | null;
  content_subject_category: string | null;
  content_category: string | null;
  sequence: number | null;
};

/**
 * 플랜 미리보기용 페이로드
 */
export type PreviewPlanPayload = PlanPayloadBase & {
  content_title: string | null;
  content_subject: string | null;
  content_subject_category: string | null;
  content_category: string | null;
};

// ============================================
// 블록 관련 타입
// ============================================

/**
 * 블록 정보
 */
export type BlockInfo = {
  id: string;
  day_of_week: number;
  block_index: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
};

// ============================================
// 유틸리티 타입
// ============================================

/**
 * 플랜 번호 매핑 (논리적 플랜 키 -> 플랜 번호)
 */
export type PlanNumberMap = Map<string, number>;

/**
 * 날짜별 사용된 블록 인덱스 맵
 */
export type UsedBlockIndicesByDateMap = Map<string, Set<number>>;

// ============================================
// 챕터/상세 정보 타입
// ============================================

/**
 * 챕터 정보
 */
export type ChapterInfo = {
  start_chapter: string;
  end_chapter: string;
  episode_title?: string | null;
};

/**
 * 콘텐츠별 챕터 정보 맵
 */
export type ContentChapterMap = Map<string, ChapterInfo>;

/**
 * 상세 ID 매핑 (마스터 -> 학생)
 * 에피소드 ID 또는 페이지 상세 ID 매핑
 */
export type DetailIdMap = Map<string, string>;

// ============================================
// 서비스 인터페이스 (Phase 2 리팩토링용)
// ============================================

/**
 * 콘텐츠 해석 서비스 결과
 */
export type ContentResolutionServiceResult = {
  contentIdMap: ContentIdMap;
  detailIdMap: DetailIdMap;
  contentMetadataMap: ContentMetadataMap;
  contentDurationMap: ContentDurationMap;
  chapterMap: ContentChapterMap;
};

/**
 * 스케줄 생성 서비스 입력
 */
export type ScheduleGenerationInput = {
  contents: Array<{
    content_id: string;
    content_type: ContentType;
    start_range: number;
    end_range: number;
    estimated_duration: number;
  }>;
  availableDates: string[];
  dateMetadataMap: DateMetadataMap;
  schedulerOptions: {
    study_days: number;
    review_days: number;
    use1730Timetable?: boolean;
  };
};

/**
 * 스케줄된 플랜 (스케줄러 출력)
 */
export type ScheduledPlan = {
  date: string;
  content_id: string;
  content_type: ContentType;
  start_range: number;
  end_range: number;
  estimated_duration: number;
  is_review: boolean;
  day_type: DayType;
  week_number?: number;
};

/**
 * 시간 할당 서비스 결과
 */
export type TimeAllocationResult = {
  segments: PlanPayloadBase[];
  unallocatedPlans: ScheduledPlan[];
};

/**
 * 플랜 저장 서비스 결과
 */
export type PlanPersistenceResult = {
  success: boolean;
  savedCount: number;
  errors?: string[];
};
