/**
 * 플랜 생성 오케스트레이터
 *
 * 플랜 생성의 전체 프로세스를 조율합니다.
 * 각 서비스(ContentResolution, ScheduleGeneration, TimeAllocation, PlanPersistence)를
 * 순서대로 호출하여 플랜을 생성합니다.
 *
 * NOTE: Phase 2에서는 서비스 레이어의 기본 구조만 제공합니다.
 * 실제 기존 generatePlansRefactored 함수와의 완전한 통합은 Phase 3에서 이루어집니다.
 *
 * @module lib/plan/services/PlanGenerationOrchestrator
 */

import { getPlanGroupById, getPlanContents } from "@/lib/domains/plan/service";
import {
  getContentResolutionService,
  type ContentResolutionService,
} from "./ContentResolutionService";
import {
  getScheduleGenerationService,
  type ScheduleGenerationService,
} from "./ScheduleGenerationService";
import {
  getTimeAllocationService,
  type TimeAllocationService,
} from "./TimeAllocationService";
import {
  getPlanPersistenceService,
  type PlanPersistenceService,
} from "./PlanPersistenceService";
import type {
  ServiceResult,
  ServiceContext,
  PlanGenerationOrchestratorInput,
  PlanGenerationOrchestratorOutput,
  IPlanGenerationOrchestrator,
} from "./types";
import type {
  PlanPayloadBase,
  ContentMetadataMap,
} from "@/lib/types/plan-generation";

/**
 * 오케스트레이터 내부 상태
 */
type OrchestratorState = {
  planGroupId: string;
  context: ServiceContext;
  options: PlanGenerationOrchestratorInput["options"];
  errors: string[];
};

/**
 * 플랜 생성 오케스트레이터 구현
 *
 * NOTE: 이 오케스트레이터는 Phase 2의 서비스 레이어 기본 구조를 보여줍니다.
 * 실제 프로덕션에서는 기존 generatePlansRefactored 함수를 사용하세요.
 */
export class PlanGenerationOrchestrator implements IPlanGenerationOrchestrator {
  private contentResolutionService: ContentResolutionService;
  private scheduleGenerationService: ScheduleGenerationService;
  private timeAllocationService: TimeAllocationService;
  private planPersistenceService: PlanPersistenceService;

  constructor() {
    this.contentResolutionService = getContentResolutionService();
    this.scheduleGenerationService = getScheduleGenerationService();
    this.timeAllocationService = getTimeAllocationService();
    this.planPersistenceService = getPlanPersistenceService();
  }

  /**
   * 플랜 생성 전체 프로세스 실행
   *
   * NOTE: 이 구현은 Phase 2의 기본 흐름을 보여줍니다.
   * 실제 프로덕션 사용은 Phase 3 이후를 권장합니다.
   */
  async generate(
    input: PlanGenerationOrchestratorInput
  ): Promise<ServiceResult<PlanGenerationOrchestratorOutput>> {
    const state: OrchestratorState = {
      planGroupId: input.planGroupId,
      context: input.context,
      options: input.options,
      errors: [],
    };

    try {
      // 1. 플랜 그룹 및 콘텐츠 조회
      const planGroup = await getPlanGroupById(
        input.planGroupId,
        input.context.studentId,
        input.context.tenantId
      );

      if (!planGroup) {
        return {
          success: false,
          error: "플랜 그룹을 찾을 수 없습니다",
          errorCode: "PLAN_GROUP_NOT_FOUND",
        };
      }

      const contents = await getPlanContents(input.planGroupId);
      if (contents.length === 0) {
        return {
          success: false,
          error: "플랜 콘텐츠가 없습니다",
          errorCode: "NO_CONTENTS",
        };
      }

      // 2. 콘텐츠 해석
      const contentResult = await this.contentResolutionService.resolve({
        contents: contents.map((c) => ({
          content_id: c.content_id,
          content_type: c.content_type as "book" | "lecture" | "custom",
          start_detail_id: c.start_detail_id,
          end_detail_id: c.end_detail_id,
          start_range: c.start_range,
          end_range: c.end_range,
        })),
        context: input.context,
      });

      if (!contentResult.success || !contentResult.data) {
        state.errors.push(contentResult.error ?? "콘텐츠 해석 실패");
        return this.buildErrorResult(state);
      }

      const { contentIdMap, contentDurationMap, contentMetadataMap } =
        contentResult.data;

      // 3. 사용 가능한 날짜 계산 (간단한 날짜 범위 생성)
      const availableDates = this.generateDateRange(
        planGroup.period_start,
        planGroup.period_end
      );

      if (availableDates.length === 0) {
        return {
          success: false,
          error: "사용 가능한 날짜가 없습니다",
          errorCode: "NO_AVAILABLE_DATES",
        };
      }

      // 4. 스케줄 생성 입력 준비
      const scheduleContents = contents.map((c, index) => {
        const mappedId = contentIdMap.get(c.content_id) ?? c.content_id;
        const duration = contentDurationMap.get(mappedId);

        return {
          content_id: mappedId,
          content_type: c.content_type as "book" | "lecture" | "custom",
          start_range: c.start_range ?? 1,
          end_range: c.end_range ?? 1,
          estimated_duration: duration?.duration ?? 60,
          display_order: c.display_order ?? index,
        };
      });

      // 5. 스케줄 생성
      const dateMetadataMap = new Map<string, { day_type: "학습일"; week_number: number }>();
      availableDates.forEach((date, index) => {
        dateMetadataMap.set(date, {
          day_type: "학습일",
          week_number: Math.floor(index / 7) + 1,
        });
      });

      const scheduleResult = await this.scheduleGenerationService.generateSchedule({
        contents: scheduleContents,
        availableDates,
        dateMetadataMap,
        options: {
          study_days: 5,
          review_days: 2,
          use1730Timetable: false,
        },
      });

      if (!scheduleResult.success || !scheduleResult.data) {
        state.errors.push(scheduleResult.error ?? "스케줄 생성 실패");
        return this.buildErrorResult(state);
      }

      // 6. 시간 할당
      const dateTimeRangesMap = new Map<string, Array<{ start: string; end: string }>>();
      availableDates.forEach((date) => {
        dateTimeRangesMap.set(date, [{ start: "09:00", end: "18:00" }]);
      });

      const timeResult = await this.timeAllocationService.allocateTime({
        scheduledPlans: scheduleResult.data.scheduledPlans,
        dateTimeRanges: dateTimeRangesMap,
        contentDurationMap,
      });

      if (!timeResult.success || !timeResult.data) {
        state.errors.push(timeResult.error ?? "시간 할당 실패");
        return this.buildErrorResult(state);
      }

      // 7. 미리보기 모드인 경우 저장하지 않고 반환
      if (input.options?.previewOnly) {
        return {
          success: true,
          data: {
            success: true,
            previewPlans: timeResult.data.allocatedPlans,
          },
        };
      }

      // 8. 플랜 저장
      const persistInput = {
        plans: this.enrichPlansWithMetadata(
          timeResult.data.allocatedPlans,
          contentMetadataMap
        ),
        planGroupId: input.planGroupId,
        context: input.context,
        options: {
          deleteExisting: input.options?.regenerate ?? true,
        },
      };

      const persistResult = await this.planPersistenceService.savePlans(persistInput);

      if (!persistResult.success) {
        state.errors.push(persistResult.error ?? "플랜 저장 실패");
        return this.buildErrorResult(state);
      }

      return {
        success: true,
        data: {
          success: true,
          savedCount: persistResult.data?.savedCount,
        },
      };
    } catch (error) {
      console.error("[PlanGenerationOrchestrator] generate 실패:", error);
      state.errors.push(error instanceof Error ? error.message : "알 수 없는 오류");
      return this.buildErrorResult(state);
    }
  }

  /**
   * 플랜 미리보기
   */
  async preview(
    input: Omit<PlanGenerationOrchestratorInput, "options">
  ): Promise<ServiceResult<{ previewPlans: PlanPayloadBase[] }>> {
    const result = await this.generate({
      ...input,
      options: { previewOnly: true },
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error,
        errorCode: result.errorCode,
      };
    }

    return {
      success: true,
      data: {
        previewPlans: result.data.previewPlans ?? [],
      },
    };
  }

  /**
   * 날짜 범위 생성 (내부 헬퍼)
   */
  private generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * 플랜에 메타데이터 추가 (내부 헬퍼)
   */
  private enrichPlansWithMetadata(
    plans: Array<PlanPayloadBase & { content_id: string; date: string }>,
    contentMetadataMap: ContentMetadataMap
  ): Array<
    PlanPayloadBase & {
      content_id: string;
      content_title?: string | null;
      content_subject?: string | null;
    }
  > {
    return plans.map((plan) => {
      const metadata = contentMetadataMap.get(plan.content_id);
      return {
        ...plan,
        content_title: metadata?.title ?? null,
        content_subject: metadata?.subject ?? null,
      };
    });
  }

  /**
   * 에러 결과 빌드 (내부 헬퍼)
   */
  private buildErrorResult(
    state: OrchestratorState
  ): ServiceResult<PlanGenerationOrchestratorOutput> {
    return {
      success: false,
      error: state.errors.join("; "),
      errorCode: "GENERATION_FAILED",
      data: {
        success: false,
        errors: state.errors,
      },
    };
  }
}

// 싱글톤 인스턴스
let instance: PlanGenerationOrchestrator | null = null;

/**
 * PlanGenerationOrchestrator 싱글톤 인스턴스 반환
 */
export function getPlanGenerationOrchestrator(): PlanGenerationOrchestrator {
  if (!instance) {
    instance = new PlanGenerationOrchestrator();
  }
  return instance;
}
