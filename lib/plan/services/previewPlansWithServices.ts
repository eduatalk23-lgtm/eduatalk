/**
 * 서비스 레이어 기반 플랜 미리보기 함수
 *
 * 기존 previewPlansRefactored.ts의 로직을 서비스 레이어로 점진적으로 이전합니다.
 * generatePlansWithServices와 동일한 로직을 사용하되, DB 저장 대신 미리보기 데이터를 반환합니다.
 *
 * Phase 5: 공통 로직 추출 (preparePlanGenerationData)
 *
 * @module lib/plan/services/previewPlansWithServices
 */

import type { ServiceContext } from "@/lib/plan/shared";
import { ServiceErrorCodes, toServiceError } from "./errors";
import { createServiceLogger, globalPerformanceTracker } from "./logging";
import { preparePlanGenerationData } from "./preparePlanGenerationData";
import { createPlanNumberCalculator } from "./planNumbering";

/**
 * 프리뷰 플랜 타입
 */
export type PreviewPlan = {
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  content_title: string | null;
  content_subject: string | null;
  content_subject_category: string | null;
  content_category: string | null;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter: string | null;
  start_time: string | null;
  end_time: string | null;
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
  week: number | null;
  day: number | null;
  is_partial: boolean;
  is_continued: boolean;
  plan_number: number | null;
  estimated_minutes?: number | null;
};

/**
 * 서비스 기반 플랜 미리보기 입력
 */
export type PreviewPlansWithServicesInput = {
  groupId: string;
  context: ServiceContext;
  accessInfo: {
    userId: string;
    role: "student" | "admin" | "consultant";
  };
};

/**
 * 서비스 기반 플랜 미리보기 결과
 */
export type PreviewPlansWithServicesResult = {
  success: boolean;
  plans?: PreviewPlan[];
  error?: string;
  errorCode?: string;
};

/**
 * 서비스 레이어를 사용한 플랜 미리보기
 *
 * 기존 previewPlansRefactored와 동일한 결과를 생성하되,
 * 내부적으로 서비스 레이어를 사용합니다.
 */
export async function previewPlansWithServices(
  input: PreviewPlansWithServicesInput
): Promise<PreviewPlansWithServicesResult> {
  const { groupId, context, accessInfo } = input;

  // 로거 및 성능 추적 설정
  const logger = createServiceLogger("ServiceAdapter", {
    studentId: context.studentId,
    tenantId: context.tenantId,
    operationId: groupId,
  });
  const trackingId = globalPerformanceTracker.start(
    "ServiceAdapter",
    "previewPlansWithServices",
    groupId,
    { role: accessInfo.role }
  );

  try {
    logger.info("previewPlansWithServices", "서비스 기반 플랜 미리보기 시작", {
      groupId,
      role: accessInfo.role,
    });

    // 1-7. 공통 데이터 준비 (플랜 그룹 조회 ~ 시간 할당)
    const preparedData = await preparePlanGenerationData(input, logger);

    if (!preparedData.success) {
      logger.error("previewPlansWithServices", preparedData.error);
      globalPerformanceTracker.end(trackingId, false);
      return {
        success: false,
        error: preparedData.error,
        errorCode: preparedData.errorCode,
      };
    }

    const {
      group,
      contentMetadataMap,
      contentIdMap,
      weekDatesMap,
      dateAllocations,
    } = preparedData;

    logger.debug("previewPlansWithServices", "데이터 준비 완료", {
      dateAllocationsCount: dateAllocations.length,
      contentIdMapSize: contentIdMap.size,
    });

    // DEBUG: 데이터 확인
    if (process.env.NODE_ENV === "development") {
      console.log("[previewPlansWithServices] dateAllocations:", dateAllocations.length);
      if (dateAllocations.length > 0) {
        const firstAllocation = dateAllocations[0];
        console.log("[previewPlansWithServices] first allocation:", {
          date: firstAllocation.date,
          segmentsCount: firstAllocation.segments.length,
          firstSegment: firstAllocation.segments[0]?.plan,
        });
      }
    }

    // 8. 미리보기 플랜 생성
    const previewPlans: PreviewPlan[] = [];
    const planNumberCalc = createPlanNumberCalculator();

    for (const { date, segments, dateMetadata } of dateAllocations) {
      let blockIndex = 1;

      for (const segment of segments) {
        // 원본 content_id에서 변환된 ID 조회 (마스터 콘텐츠 ID → 학생 콘텐츠 ID)
        const originalContentId = segment.plan.content_id;
        const resolvedContentId = contentIdMap.get(originalContentId) ?? originalContentId;

        // 메타데이터는 변환된 ID로 조회
        const metadata = contentMetadataMap.get(resolvedContentId) ?? contentMetadataMap.get(originalContentId);

        // 주차별 일차 계산
        let weekDay: number | null = null;
        if (dateMetadata.week_number) {
          if (group.scheduler_type === "1730_timetable") {
            const weekDates = weekDatesMap.get(dateMetadata.week_number) || [];
            const dayIndex = weekDates.indexOf(date);
            if (dayIndex >= 0) {
              weekDay = dayIndex + 1;
            }
          } else {
            const start = new Date(group.period_start);
            const current = new Date(date);
            start.setHours(0, 0, 0, 0);
            current.setHours(0, 0, 0, 0);
            const diffTime = current.getTime() - start.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            weekDay = (diffDays % 7) + 1;
          }
        }

        // 플랜 번호 부여 (변환된 ID 사용)
        const planNumber = planNumberCalc.getPlanNumber(
          date,
          resolvedContentId,
          segment.plan.planned_start_page_or_time,
          segment.plan.planned_end_page_or_time
        );

        // DEBUG: plan_number 확인
        if (process.env.NODE_ENV === "development" && blockIndex <= 2) {
          console.log("[previewPlansWithServices] planNumber:", {
            date,
            blockIndex,
            planNumber,
            content_id: resolvedContentId.substring(0, 8),
          });
        }

        previewPlans.push({
          plan_date: date,
          block_index: blockIndex,
          content_type: segment.plan.content_type,
          content_id: resolvedContentId, // 변환된 학생 콘텐츠 ID 사용
          content_title: metadata?.title ?? null,
          content_subject: metadata?.subject ?? null,
          content_subject_category: metadata?.subject_category ?? null,
          content_category: metadata?.category ?? null,
          planned_start_page_or_time: segment.plan.planned_start_page_or_time,
          planned_end_page_or_time: segment.plan.planned_end_page_or_time,
          chapter: null,
          start_time: segment.start,
          end_time: segment.end,
          day_type: dateMetadata.day_type,
          week: dateMetadata.week_number,
          day: weekDay,
          is_partial: segment.isPartial,
          is_continued: segment.isContinued,
          plan_number: planNumber,
          estimated_minutes: segment.estimatedMinutes ?? null,
        });

        blockIndex++;
      }
    }

    logger.info("previewPlansWithServices", "서비스 기반 플랜 미리보기 완료", {
      previewPlansCount: previewPlans.length,
    });
    globalPerformanceTracker.end(trackingId, true);

    return {
      success: true,
      plans: previewPlans,
    };
  } catch (error) {
    const serviceError = toServiceError(error, "ServiceAdapter", {
      code: ServiceErrorCodes.ORCHESTRATION_FAILED,
      method: "previewPlansWithServices",
      operationId: groupId,
      studentId: context.studentId,
      tenantId: context.tenantId,
    });
    logger.error("previewPlansWithServices", "플랜 미리보기 실패", serviceError);
    globalPerformanceTracker.end(trackingId, false);

    return {
      success: false,
      error: serviceError.message,
      errorCode: serviceError.code,
    };
  }
}
