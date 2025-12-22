/**
 * 플랜 저장 서비스
 *
 * 생성된 플랜을 데이터베이스에 저장하고 관리합니다.
 * 기존 plan/service.ts의 함수들을 서비스 레이어로 래핑합니다.
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

    try {
      let deletedCount = 0;

      // 기존 플랜 삭제 옵션
      if (options?.deleteExisting) {
        const deleteResult = await this.deleteExistingPlans(planGroupId, context);
        if (!deleteResult.success) {
          return {
            success: false,
            error: deleteResult.error,
            errorCode: "DELETE_FAILED",
          };
        }
        deletedCount = deleteResult.data?.deletedCount ?? 0;
      }

      // 저장할 플랜이 없으면 성공 반환
      if (plans.length === 0) {
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
        return {
          success: false,
          error: result.error ?? "플랜 저장에 실패했습니다",
          errorCode: "SAVE_FAILED",
        };
      }

      return {
        success: true,
        data: {
          savedCount: result.planIds?.length ?? 0,
          deletedCount,
        },
      };
    } catch (error) {
      console.error("[PlanPersistenceService] savePlans 실패:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        errorCode: "SAVE_FAILED",
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
    try {
      const result = await deleteStudentPlansByGroupId(
        planGroupId,
        context.studentId
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error ?? "플랜 삭제에 실패했습니다",
          errorCode: "DELETE_FAILED",
        };
      }

      // 삭제된 개수는 알 수 없으므로 -1 반환 (성공 표시)
      return {
        success: true,
        data: { deletedCount: -1 },
      };
    } catch (error) {
      console.error("[PlanPersistenceService] deleteExistingPlans 실패:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        errorCode: "DELETE_FAILED",
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
