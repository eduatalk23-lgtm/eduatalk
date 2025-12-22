/**
 * 서비스 레이어 기반 플랜 생성 함수
 *
 * 기존 generatePlansRefactored.ts의 로직을 서비스 레이어로 점진적으로 이전합니다.
 * Phase 3에서 기존 코드와 병행하여 사용되며, 점진적으로 기존 코드를 대체합니다.
 *
 * 현재 상태:
 * - ContentResolutionService: 완전 통합
 * - ScheduleGenerationService: 어댑터 통해 기존 함수 호출
 * - TimeAllocationService: 어댑터 통해 기존 함수 호출
 * - PlanPersistenceService: 완전 통합
 *
 * Phase 4: 통합 에러/로깅 시스템 적용
 * Phase 5: 공통 로직 추출 (preparePlanGenerationData)
 *
 * @module lib/plan/services/generatePlansWithServices
 */

import { getPlanPersistenceService } from "./PlanPersistenceService";
import type { ServiceContext } from "./types";
import type { PlanPayloadBase } from "@/lib/types/plan-generation";
import { ServiceErrorCodes, toServiceError } from "./errors";
import { createServiceLogger, globalPerformanceTracker } from "./logging";
import { preparePlanGenerationData } from "./preparePlanGenerationData";

/**
 * 서비스 기반 플랜 생성 입력
 */
export type GeneratePlansWithServicesInput = {
  groupId: string;
  context: ServiceContext;
  accessInfo: {
    userId: string;
    role: "student" | "admin" | "consultant";
  };
};

/**
 * 서비스 기반 플랜 생성 결과
 */
export type GeneratePlansWithServicesResult = {
  success: boolean;
  count?: number;
  error?: string;
  errorCode?: string;
};

/**
 * 서비스 레이어를 사용한 플랜 생성
 *
 * 기존 generatePlansRefactored와 동일한 결과를 생성하되,
 * 내부적으로 서비스 레이어를 사용합니다.
 */
export async function generatePlansWithServices(
  input: GeneratePlansWithServicesInput
): Promise<GeneratePlansWithServicesResult> {
  const { groupId, context, accessInfo } = input;

  // 로거 및 성능 추적 설정
  const logger = createServiceLogger("ServiceAdapter", {
    studentId: context.studentId,
    tenantId: context.tenantId,
    operationId: groupId,
  });
  const trackingId = globalPerformanceTracker.start(
    "ServiceAdapter",
    "generatePlansWithServices",
    groupId,
    { role: accessInfo.role }
  );

  try {
    logger.info("generatePlansWithServices", "서비스 기반 플랜 생성 시작", {
      groupId,
      role: accessInfo.role,
    });

    // 1-7. 공통 데이터 준비 (플랜 그룹 조회 ~ 시간 할당)
    const preparedData = await preparePlanGenerationData(input, logger);

    if (!preparedData.success) {
      logger.error("generatePlansWithServices", preparedData.error);
      globalPerformanceTracker.end(trackingId, false);
      return {
        success: false,
        error: preparedData.error,
        errorCode: preparedData.errorCode,
      };
    }

    const { contentMetadataMap, dateAllocations } = preparedData;

    logger.debug("generatePlansWithServices", "데이터 준비 완료", {
      dateAllocationsCount: dateAllocations.length,
    });

    // 8. 플랜 페이로드 생성
    const planPayloads: Array<
      PlanPayloadBase & {
        content_id: string;
        content_title?: string | null;
        content_subject?: string | null;
      }
    > = [];

    // plan_number 계산을 위한 Map
    const planNumberMap = new Map<string, number>();
    let nextPlanNumber = 1;

    for (const { date, segments, dateMetadata, dayType } of dateAllocations) {
      segments.forEach((segment, index) => {
        const metadata = contentMetadataMap.get(segment.plan.content_id);

        // plan_number 계산: 동일한 날짜+콘텐츠+범위는 같은 번호 부여
        const planKey = `${date}:${segment.plan.content_id}:${segment.plan.planned_start_page_or_time}:${segment.plan.planned_end_page_or_time}`;
        let planNumber: number;

        if (planNumberMap.has(planKey)) {
          planNumber = planNumberMap.get(planKey)!;
        } else {
          planNumber = nextPlanNumber;
          planNumberMap.set(planKey, planNumber);
          nextPlanNumber++;
        }

        planPayloads.push({
          plan_date: date,
          block_index: segment.plan.block_index ?? index,
          content_type: segment.plan.content_type,
          content_id: segment.plan.content_id,
          planned_start_page_or_time: segment.plan.planned_start_page_or_time,
          planned_end_page_or_time: segment.plan.planned_end_page_or_time,
          chapter: null,
          start_time: segment.start,
          end_time: segment.end,
          day_type: dayType as PlanPayloadBase["day_type"],
          week: dateMetadata.week_number,
          day: null,
          is_partial: segment.isPartial,
          is_continued: segment.isContinued,
          plan_number: planNumber,
          subject_type: segment.plan.subject_type ?? null,
          content_title: metadata?.title ?? null,
          content_subject: metadata?.subject ?? null,
        });
      });
    }

    // 9. 플랜 저장 (서비스 레이어 사용)
    const persistenceService = getPlanPersistenceService();
    const persistResult = await persistenceService.savePlans({
      plans: planPayloads,
      planGroupId: groupId,
      context,
      options: { deleteExisting: true },
    });

    if (!persistResult.success) {
      logger.error("generatePlansWithServices", "플랜 저장 실패", undefined, {
        error: persistResult.error,
      });
      globalPerformanceTracker.end(trackingId, false);
      return {
        success: false,
        error: persistResult.error ?? "플랜 저장에 실패했습니다.",
        errorCode: ServiceErrorCodes.PLAN_PERSISTENCE_FAILED,
      };
    }

    logger.info("generatePlansWithServices", "서비스 기반 플랜 생성 완료", {
      savedCount: persistResult.data?.savedCount ?? 0,
    });
    globalPerformanceTracker.end(trackingId, true);

    return {
      success: true,
      count: persistResult.data?.savedCount ?? 0,
    };
  } catch (error) {
    const serviceError = toServiceError(error, "ServiceAdapter", {
      code: ServiceErrorCodes.ORCHESTRATION_FAILED,
      method: "generatePlansWithServices",
      operationId: groupId,
      studentId: context.studentId,
      tenantId: context.tenantId,
    });
    logger.error("generatePlansWithServices", "플랜 생성 실패", serviceError);
    globalPerformanceTracker.end(trackingId, false);

    return {
      success: false,
      error: serviceError.message,
      errorCode: serviceError.code,
    };
  }
}

/**
 * 서비스 레이어 기반 플랜 생성 가능 여부 확인
 *
 * 환경 변수나 설정에 따라 새 서비스 레이어 사용 가능 여부 반환
 */
export function canUseServiceBasedGeneration(): boolean {
  return process.env.ENABLE_NEW_PLAN_SERVICES === "true";
}
