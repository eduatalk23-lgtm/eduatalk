/**
 * 플랜 저장 서비스
 *
 * 생성된 플랜을 데이터베이스에 저장하고 관리합니다.
 * 기존 plan/service.ts의 함수들을 서비스 레이어로 래핑합니다.
 *
 * Phase 4: 통합 에러/로깅 시스템 적용
 *
 * @module lib/plan/services/PlanPersistenceService
 */

import {
  createStudentPlans,
  deleteStudentPlansByGroupId,
} from "@/lib/domains/plan/service";
import type { Plan } from "@/lib/domains/plan/types";
import type {
  ServiceResult,
  ServiceContext,
  PlanPersistenceInput,
  PlanPersistenceOutput,
  IPlanPersistenceService,
} from "./types";
import {
  ServiceErrorCodes,
  toServiceError,
} from "./errors";
import {
  createServiceLogger,
  globalPerformanceTracker,
} from "./logging";

/**
 * 플랜 저장 서비스 구현
 */
export class PlanPersistenceService implements IPlanPersistenceService {
  /**
   * 플랜을 데이터베이스에 저장
   */
  async savePlans(
    input: PlanPersistenceInput
  ): Promise<ServiceResult<PlanPersistenceOutput>> {
    const { plans, planGroupId, context, options } = input;

    // 로거 및 성능 추적 설정
    const logger = createServiceLogger("PlanPersistenceService", {
      studentId: context.studentId,
      tenantId: context.tenantId,
      operationId: planGroupId,
    });
    const trackingId = globalPerformanceTracker.start(
      "PlanPersistenceService",
      "savePlans",
      planGroupId,
      { plansCount: plans.length, deleteExisting: options?.deleteExisting }
    );

    try {
      logger.info("savePlans", "플랜 저장 시작", {
        plansCount: plans.length,
        deleteExisting: options?.deleteExisting,
      });

      let deletedCount = 0;

      // 기존 플랜 삭제 옵션
      if (options?.deleteExisting) {
        const deleteResult = await this.deleteExistingPlans(planGroupId, context);
        if (!deleteResult.success) {
          logger.error("savePlans", "기존 플랜 삭제 실패");
          globalPerformanceTracker.end(trackingId, false);
          return {
            success: false,
            error: deleteResult.error,
            errorCode: ServiceErrorCodes.PLAN_DELETE_FAILED,
          };
        }
        deletedCount = deleteResult.data?.deletedCount ?? 0;
      }

      // 저장할 플랜이 없으면 성공 반환
      if (plans.length === 0) {
        logger.info("savePlans", "저장할 플랜이 없음");
        globalPerformanceTracker.end(trackingId, true);
        return {
          success: true,
          data: {
            savedCount: 0,
            deletedCount,
          },
        };
      }

      // PlanPayloadBase를 DB 형식으로 변환
      const dbPlans = this.transformPlansForDB(plans, planGroupId, context);

      // 플랜 저장
      const result = await createStudentPlans(dbPlans);

      if (!result.success) {
        logger.error("savePlans", "플랜 저장 실패", undefined, {
          error: result.error,
        });
        globalPerformanceTracker.end(trackingId, false);
        return {
          success: false,
          error: result.error ?? "플랜 저장에 실패했습니다",
          errorCode: ServiceErrorCodes.PLAN_INSERT_FAILED,
        };
      }

      logger.info("savePlans", "플랜 저장 완료", {
        savedCount: result.planIds?.length ?? 0,
        deletedCount,
      });
      globalPerformanceTracker.end(trackingId, true);

      return {
        success: true,
        data: {
          savedCount: result.planIds?.length ?? 0,
          deletedCount,
        },
      };
    } catch (error) {
      const serviceError = toServiceError(error, "PlanPersistenceService", {
        code: ServiceErrorCodes.PLAN_PERSISTENCE_FAILED,
        method: "savePlans",
        operationId: planGroupId,
        studentId: context.studentId,
        tenantId: context.tenantId,
        metadata: { plansCount: plans.length },
      });
      logger.error("savePlans", "플랜 저장 실패", serviceError);
      globalPerformanceTracker.end(trackingId, false);

      return {
        success: false,
        error: serviceError.message,
        errorCode: serviceError.code,
      };
    }
  }

  /**
   * 기존 플랜 삭제
   */
  async deleteExistingPlans(
    planGroupId: string,
    context: ServiceContext
  ): Promise<ServiceResult<{ deletedCount: number }>> {
    const logger = createServiceLogger("PlanPersistenceService", {
      studentId: context.studentId,
      tenantId: context.tenantId,
      operationId: planGroupId,
    });
    const trackingId = globalPerformanceTracker.start(
      "PlanPersistenceService",
      "deleteExistingPlans",
      planGroupId
    );

    try {
      logger.info("deleteExistingPlans", "기존 플랜 삭제 시작");

      const result = await deleteStudentPlansByGroupId(
        planGroupId,
        context.studentId
      );

      if (!result.success) {
        logger.error("deleteExistingPlans", "플랜 삭제 실패", undefined, {
          error: result.error,
        });
        globalPerformanceTracker.end(trackingId, false);
        return {
          success: false,
          error: result.error ?? "플랜 삭제에 실패했습니다",
          errorCode: ServiceErrorCodes.PLAN_DELETE_FAILED,
        };
      }

      logger.info("deleteExistingPlans", "기존 플랜 삭제 완료");
      globalPerformanceTracker.end(trackingId, true);

      // 삭제된 개수는 알 수 없으므로 -1 반환 (성공 표시)
      return {
        success: true,
        data: { deletedCount: -1 },
      };
    } catch (error) {
      const serviceError = toServiceError(error, "PlanPersistenceService", {
        code: ServiceErrorCodes.PLAN_DELETE_FAILED,
        method: "deleteExistingPlans",
        operationId: planGroupId,
        studentId: context.studentId,
        tenantId: context.tenantId,
      });
      logger.error("deleteExistingPlans", "플랜 삭제 실패", serviceError);
      globalPerformanceTracker.end(trackingId, false);

      return {
        success: false,
        error: serviceError.message,
        errorCode: serviceError.code,
      };
    }
  }

  /**
   * 서비스 형식의 플랜을 DB 형식으로 변환 (내부 헬퍼)
   */
  private transformPlansForDB(
    plans: PlanPersistenceInput["plans"],
    planGroupId: string,
    context: ServiceContext
  ): Array<Partial<Plan>> {
    return plans.map((plan) => ({
      plan_group_id: planGroupId,
      student_id: context.studentId,
      tenant_id: context.tenantId,
      plan_date: plan.plan_date,
      block_index: plan.block_index,
      content_type: plan.content_type,
      content_id: plan.content_id,
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
      chapter: plan.chapter,
      start_time: plan.start_time,
      end_time: plan.end_time,
      day_type: plan.day_type,
      week: plan.week,
      day: plan.day,
      is_partial: plan.is_partial,
      is_continued: plan.is_continued,
      plan_number: plan.plan_number,
      subject_type: plan.subject_type ?? null,
      // 콘텐츠 메타데이터 (옵션)
      content_title: plan.content_title ?? null,
      content_subject: plan.content_subject ?? null,
      content_subject_category: plan.content_subject_category ?? null,
      content_category: plan.content_category ?? null,
    }));
  }
}

// 싱글톤 인스턴스
let instance: PlanPersistenceService | null = null;

/**
 * PlanPersistenceService 싱글톤 인스턴스 반환
 */
export function getPlanPersistenceService(): PlanPersistenceService {
  if (!instance) {
    instance = new PlanPersistenceService();
  }
  return instance;
}
