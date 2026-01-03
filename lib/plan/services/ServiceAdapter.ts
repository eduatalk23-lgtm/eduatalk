/**
 * 서비스 어댑터
 *
 * 기존 플랜 생성 함수들과 새로운 서비스 레이어 사이의 브릿지 역할을 합니다.
 * Phase 3에서 점진적 마이그레이션을 위해 사용됩니다.
 *
 * 사용법:
 * - 기존 코드에서 서비스 레이어 함수를 호출할 때 어댑터를 통해 호출
 * - 피처 플래그로 신규/기존 구현 선택 가능
 * - 점진적으로 기존 코드를 서비스 레이어로 대체
 *
 * @module lib/plan/services/ServiceAdapter
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolveContentIds,
  loadContentMetadata,
  loadContentDurations,
  loadContentChapters,
} from "@/lib/plan/contentResolver";
import { generatePlansFromGroup as schedulerGeneratePlans } from "@/lib/plan/scheduler";
import { assignPlanTimes } from "@/lib/plan/assignPlanTimes";
import { getContentResolutionService } from "./ContentResolutionService";
import type {
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  DateAvailableTimeRangesMap,
  PlanPayloadBase,
} from "@/lib/types/plan-generation";
import type {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
} from "@/lib/types/plan";
import type { ServiceContext, ScheduledPlan } from "./types";

/**
 * 콘텐츠 해석 어댑터
 *
 * 기존 contentResolver 함수들을 서비스 레이어 인터페이스로 래핑합니다.
 */
export async function adaptContentResolution(
  contents: PlanContent[],
  context: ServiceContext,
  options?: {
    useServiceLayer?: boolean;
  }
): Promise<{
  contentIdMap: ContentIdMap;
  contentMetadataMap: ContentMetadataMap;
  contentDurationMap: ContentDurationMap;
  chapterMap: Map<string, string | null>;
}> {
  // 피처 플래그: 서비스 레이어 사용 여부
  const useServiceLayer = options?.useServiceLayer ?? false;

  if (useServiceLayer) {
    // 새로운 서비스 레이어 사용
    const service = getContentResolutionService();
    const result = await service.resolve({
      contents: contents.map((c) => ({
        content_id: c.content_id,
        content_type: c.content_type,
        start_detail_id: c.start_detail_id,
        end_detail_id: c.end_detail_id,
        start_range: c.start_range,
        end_range: c.end_range,
      })),
      context,
    });

    if (!result.success || !result.data) {
      throw new Error(result.error ?? "콘텐츠 해석 실패");
    }

    return {
      contentIdMap: result.data.contentIdMap,
      contentMetadataMap: result.data.contentMetadataMap,
      contentDurationMap: result.data.contentDurationMap,
      chapterMap: result.data.chapterMap,
    };
  }

  // 기존 함수 사용 (직접 호출)
  const adminClient = createSupabaseAdminClient();
  const serverClient = await createSupabaseServerClient();

  if (!adminClient || !serverClient) {
    throw new Error("Supabase 클라이언트 생성 실패");
  }

  const contentIdMap = await resolveContentIds(
    contents,
    context.studentId,
    serverClient,
    adminClient
  );

  const contentMetadataMap = await loadContentMetadata(
    contents,
    contentIdMap,
    context.studentId,
    serverClient,
    adminClient
  );

  const contentDurationMap = await loadContentDurations(
    contents,
    contentIdMap,
    context.studentId,
    serverClient,
    adminClient
  );

  const chapterMap = await loadContentChapters(
    contents,
    contentIdMap,
    context.studentId,
    serverClient
  );

  return {
    contentIdMap,
    contentMetadataMap,
    contentDurationMap,
    chapterMap,
  };
}

/**
 * 스케줄 생성 어댑터 입력 타입
 */
export type ScheduleGenerationAdapterInput = {
  group: PlanGroup;
  contents: PlanContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  blocks: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    id?: string;
    block_index?: number;
    duration_minutes?: number;
  }>;
  contentIdMap: ContentIdMap;
  contentDurationMap: ContentDurationMap;
  chapterMap: Map<string, string | null>;
  dateAvailableTimeRanges: DateAvailableTimeRangesMap;
  dateTimeSlots: Map<string, Array<{ type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습"; start: string; end: string; label?: string }>>;
};

/**
 * 스케줄 생성 어댑터
 *
 * 기존 scheduler.ts의 generatePlansFromGroup를 서비스 레이어 인터페이스로 래핑합니다.
 */
export async function adaptScheduleGeneration(
  input: ScheduleGenerationAdapterInput,
  options?: {
    useServiceLayer?: boolean;
  }
): Promise<ScheduledPlan[]> {
  // 현재는 기존 함수만 사용 (서비스 레이어는 Phase 3에서 완전 통합)
  // 기존 함수는 많은 파라미터를 필요로 하므로 직접 호출
  const {
    group,
    contents,
    exclusions,
    academySchedules,
    blocks,
    contentIdMap,
    contentDurationMap,
    chapterMap,
    dateAvailableTimeRanges,
    dateTimeSlots,
  } = input;

  // 콘텐츠 과목 정보 맵 생성
  const contentSubjects = new Map<
    string,
    { subject?: string | null; subject_category?: string | null }
  >();

  // 기존 스케줄러 호출
  // NOTE: blocks는 빈 배열로 전달 (기존 generatePlansRefactored와 동일)
  // 실제 시간 정보는 dateAvailableTimeRanges와 dateTimeSlots에서 사용
  const scheduledPlans = await schedulerGeneratePlans(
    group,
    contents,
    exclusions,
    academySchedules,
    [], // blocks는 빈 배열 전달 (dateAvailableTimeRanges/dateTimeSlots 사용)
    contentSubjects,
    undefined, // riskIndexMap
    dateAvailableTimeRanges,
    dateTimeSlots,
    contentDurationMap,
    chapterMap
  );

  // ScheduledPlan 타입으로 변환
  return scheduledPlans.map((plan) => ({
    plan_date: plan.plan_date,
    block_index: plan.block_index,
    content_type: plan.content_type,
    content_id: plan.content_id,
    planned_start_page_or_time: plan.planned_start_page_or_time,
    planned_end_page_or_time: plan.planned_end_page_or_time,
    chapter: plan.chapter,
    is_reschedulable: plan.is_reschedulable,
    start_time: plan.start_time,
    end_time: plan.end_time,
    subject_type: plan.subject_type,
  }));
}

/**
 * 시간 할당 어댑터 입력 타입
 */
export type TimeAllocationAdapterInput = {
  plans: Array<{
    content_id: string;
    content_type: "book" | "lecture" | "custom";
    planned_start_page_or_time: number;
    planned_end_page_or_time: number;
    block_index?: number;
  }>;
  studyTimeSlots: Array<{ start: string; end: string }>;
  contentDurationMap: ContentDurationMap;
  dayType: string;
  totalStudyHours: number;
};

/**
 * 시간 할당 어댑터
 *
 * 기존 assignPlanTimes를 서비스 레이어 인터페이스로 래핑합니다.
 */
export function adaptTimeAllocation(
  input: TimeAllocationAdapterInput,
  options?: {
    useServiceLayer?: boolean;
  }
): Array<{
  plan: TimeAllocationAdapterInput["plans"][0];
  start: string;
  end: string;
  isPartial: boolean;
  isContinued: boolean;
}> {
  const {
    plans,
    studyTimeSlots,
    contentDurationMap,
    dayType,
    totalStudyHours,
  } = input;

  // 기존 함수 호출
  const segments = assignPlanTimes(
    plans,
    studyTimeSlots,
    contentDurationMap,
    dayType,
    totalStudyHours
  );

  return segments.map((segment) => ({
    plan: segment.plan,
    start: segment.start,
    end: segment.end,
    isPartial: segment.isPartial,
    isContinued: segment.isContinued,
  }));
}

/**
 * 어댑터 설정 타입
 */
export type ServiceAdapterConfig = {
  useContentResolutionService: boolean;
  useScheduleGenerationService: boolean;
  useTimeAllocationService: boolean;
  usePlanPersistenceService: boolean;
};

/**
 * 기본 어댑터 설정
 * Phase 3 초기: 모든 서비스 비활성화 (기존 함수 사용)
 * Phase 3 진행 중: 점진적으로 활성화
 */
export const DEFAULT_ADAPTER_CONFIG: ServiceAdapterConfig = {
  useContentResolutionService: false,
  useScheduleGenerationService: false,
  useTimeAllocationService: false,
  usePlanPersistenceService: false,
};

/**
 * 어댑터 설정 가져오기
 *
 * 레거시 코드가 제거되어 항상 활성화된 설정을 반환합니다.
 */
export function getAdapterConfig(): ServiceAdapterConfig {
  return {
    useContentResolutionService: true,
    useScheduleGenerationService: false, // 아직 완전 통합 안됨
    useTimeAllocationService: false, // 아직 완전 통합 안됨
    usePlanPersistenceService: true,
  };
}
