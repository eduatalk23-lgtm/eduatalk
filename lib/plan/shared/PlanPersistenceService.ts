/**
 * 통합 플랜 저장 서비스
 *
 * lib/domains/plan/services/planPersistenceService.ts와
 * lib/plan/services/PlanPersistenceService.ts를 통합합니다.
 *
 * 특징:
 * - 배치 처리 지원 (configurable batch size)
 * - 명시적 롤백 기능
 * - PostgreSQL 에러 코드 처리
 * - Phase 4 에러/로깅 시스템 통합
 * - 두 가지 컨텍스트 패턴 지원 (Simple/Full)
 *
 * @module lib/plan/shared/PlanPersistenceService
 */

import {
  createStudentPlans,
  deleteStudentPlansByGroupId,
} from "@/lib/domains/plan/service";
import type { Plan } from "@/lib/domains/plan/types";
import type {
  ServiceResult,
  ServiceContext,
  PlanServiceContext,
  PlanPersistenceInput,
  PlanPersistenceOutput,
  GeneratePlanPayload,
  PlanInsertResult,
  PlanInsertError,
  BatchInsertOptions,
  IPlanPersistenceService,
  SupabaseAnyClient,
} from "./types";
import {
  logActionError,
  logActionDebug,
} from "@/lib/logging/actionLogger";

// ============================================
// 에러 코드 정의
// ============================================

export const PlanPersistenceErrorCodes = {
  PLAN_DELETE_FAILED: "PLAN_DELETE_FAILED",
  PLAN_INSERT_FAILED: "PLAN_INSERT_FAILED",
  PLAN_PERSISTENCE_FAILED: "PLAN_PERSISTENCE_FAILED",
  ROLLBACK_FAILED: "ROLLBACK_FAILED",
  STATUS_UPDATE_FAILED: "STATUS_UPDATE_FAILED",
} as const;

export type PlanPersistenceErrorCode =
  (typeof PlanPersistenceErrorCodes)[keyof typeof PlanPersistenceErrorCodes];

// ============================================
// PlanPersistenceService 클래스 (Context 기반)
// ============================================

/**
 * 플랜 저장 서비스 (Context 기반)
 *
 * PlanServiceContext를 사용하여 직접 DB 작업을 수행합니다.
 * 배치 처리, 롤백, 세부 에러 추적을 지원합니다.
 */
export class PlanPersistenceServiceWithContext {
  private ctx: PlanServiceContext;

  constructor(context: PlanServiceContext) {
    this.ctx = context;
  }

  /**
   * 기존 플랜을 삭제합니다.
   */
  async deleteExistingPlans(): Promise<void> {
    const { error } = await this.ctx.queryClient
      .from("student_plan")
      .delete()
      .eq("plan_group_id", this.ctx.groupId);

    if (error) {
      logActionError(
        { domain: "plan", action: "deleteExistingPlans" },
        error,
        { groupId: this.ctx.groupId }
      );
      throw new Error(
        `기존 플랜 삭제에 실패했습니다: ${error.message || error.code}`
      );
    }

    logActionDebug(
      { domain: "plan", action: "deleteExistingPlans" },
      "기존 플랜 삭제 완료",
      { groupId: this.ctx.groupId }
    );
  }

  /**
   * 플랜을 DB에 저장합니다.
   */
  async insertPlans(
    payloads: GeneratePlanPayload[],
    options: BatchInsertOptions = {}
  ): Promise<PlanInsertResult> {
    const { batchSize = 100, rollbackOnFailure = true } = options;
    const insertedIds: string[] = [];
    const errors: PlanInsertError[] = [];

    // DB 저장용 페이로드로 변환
    const dbPayloads = payloads.map((p) => this.toDbPayload(p));

    // 배치 크기가 지정된 경우 배치별로 삽입
    if (dbPayloads.length > batchSize) {
      const batches = this.splitIntoBatches(dbPayloads, batchSize);

      for (let i = 0; i < batches.length; i++) {
        try {
          const { data, error } = await this.ctx.queryClient
            .from("student_plan")
            .insert(batches[i])
            .select("id");

          if (error) {
            errors.push({
              batchIndex: i,
              message: this.formatInsertError(error),
              originalError: error,
            });

            if (rollbackOnFailure && insertedIds.length > 0) {
              await this.rollback(insertedIds);
              return {
                success: false,
                insertedIds: [],
                insertedCount: 0,
                errors,
              };
            }
          } else if (data) {
            insertedIds.push(...data.map((d) => d.id));
          }
        } catch (error) {
          errors.push({
            batchIndex: i,
            message: error instanceof Error ? error.message : String(error),
            originalError: error,
          });

          if (rollbackOnFailure && insertedIds.length > 0) {
            await this.rollback(insertedIds);
            return {
              success: false,
              insertedIds: [],
              insertedCount: 0,
              errors,
            };
          }
        }
      }
    } else {
      // 단일 삽입
      const { data, error } = await this.ctx.queryClient
        .from("student_plan")
        .insert(dbPayloads)
        .select("id");

      if (error) {
        errors.push({
          batchIndex: 0,
          message: this.formatInsertError(error),
          originalError: error,
        });
      } else if (data) {
        insertedIds.push(...data.map((d) => d.id));
      }
    }

    logActionDebug(
      { domain: "plan", action: "insertPlans" },
      `플랜 삽입 완료: ${insertedIds.length}개`,
      { groupId: this.ctx.groupId, insertedCount: insertedIds.length }
    );

    return {
      success: errors.length === 0,
      insertedIds,
      insertedCount: insertedIds.length,
      errors,
    };
  }

  /**
   * 삽입된 플랜을 롤백합니다.
   */
  async rollback(insertedIds: string[]): Promise<void> {
    if (insertedIds.length === 0) return;

    const { error } = await this.ctx.queryClient
      .from("student_plan")
      .delete()
      .in("id", insertedIds);

    if (error) {
      logActionError({ domain: "plan", action: "rollback" }, error, {
        groupId: this.ctx.groupId,
        insertedIds,
        errorMessage: error.message,
      });
    } else {
      logActionDebug(
        { domain: "plan", action: "rollback" },
        `플랜 롤백 완료: ${insertedIds.length}개 플랜 삭제됨`,
        { groupId: this.ctx.groupId, insertedCount: insertedIds.length }
      );
    }
  }

  /**
   * 플랜 그룹 상태를 업데이트합니다.
   */
  async updatePlanGroupStatus(
    status: string,
    insertedIds: string[]
  ): Promise<void> {
    const { error } = await this.ctx.queryClient
      .from("plan_groups")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", this.ctx.groupId);

    if (error) {
      logActionError(
        { domain: "plan", action: "updatePlanGroupStatus" },
        error,
        { groupId: this.ctx.groupId, targetStatus: status }
      );

      // 삽입된 플랜 롤백
      await this.rollback(insertedIds);

      throw new Error(
        "플랜 저장 후 상태 업데이트에 실패했습니다. 작업이 취소되었습니다."
      );
    }
  }

  /**
   * GeneratePlanPayload를 DB 저장용 페이로드로 변환합니다.
   */
  private toDbPayload(payload: GeneratePlanPayload): Record<string, unknown> {
    const now = new Date().toISOString();
    return {
      plan_group_id: payload.plan_group_id,
      student_id: payload.student_id,
      tenant_id: payload.tenant_id,
      plan_date: payload.plan_date,
      block_index: payload.block_index,
      status: "pending",
      content_type: payload.content_type,
      content_id: payload.content_id,
      planned_start_page_or_time: payload.planned_start_page_or_time,
      planned_end_page_or_time: payload.planned_end_page_or_time,
      chapter: payload.chapter,
      start_time: payload.start_time,
      end_time: payload.end_time,
      day_type: payload.day_type,
      week: payload.week,
      day: payload.day,
      is_partial: payload.is_partial,
      is_continued: payload.is_continued,
      content_title: payload.content_title,
      content_subject: payload.content_subject,
      content_subject_category: payload.content_subject_category,
      created_at: now,
      updated_at: now,
      sequence: payload.sequence,
      // 1730 Timetable 추가 필드
      cycle_day_number: payload.cycle_day_number ?? null,
      date_type: payload.date_type ?? null,
      // 가상 플랜 필드
      ...(payload.is_virtual && {
        is_virtual: true,
        slot_index: payload.slot_index,
        virtual_subject_category: payload.virtual_subject_category,
        virtual_description: payload.virtual_description,
      }),
    };
  }

  /**
   * 배열을 배치로 분할합니다.
   */
  private splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 삽입 에러를 포맷팅합니다.
   */
  private formatInsertError(error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  }): string {
    let message = "플랜 저장에 실패했습니다.";

    // PostgreSQL 에러 코드에 대한 구체적인 메시지
    if (error.code === "23503") {
      message =
        "참조 무결성 오류가 발생했습니다. 콘텐츠, 학생, 또는 플랜 그룹 정보를 확인해주세요.";
    } else if (error.code === "23505") {
      message = "중복된 플랜이 이미 존재합니다.";
    } else if (error.code === "23502") {
      message = "필수 필드가 누락되었습니다.";
    } else if (error.code === "23514") {
      message = "데이터 제약 조건을 위반했습니다.";
    } else if (error.message) {
      message += ` ${error.message}`;
    }

    return message;
  }
}

// ============================================
// PlanPersistenceService 클래스 (Singleton)
// ============================================

/**
 * 플랜 저장 서비스 (Singleton)
 *
 * IPlanPersistenceService 인터페이스를 구현합니다.
 * 기존 createStudentPlans 함수를 사용하여 DB 작업을 수행합니다.
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
      logActionDebug(
        { domain: "plan", action: "savePlans" },
        "플랜 저장 시작",
        {
          plansCount: plans.length,
          deleteExisting: options?.deleteExisting,
          planGroupId,
        }
      );

      let deletedCount = 0;

      // 기존 플랜 삭제 옵션
      if (options?.deleteExisting) {
        const deleteResult = await this.deleteExistingPlans(planGroupId, context);
        if (!deleteResult.success) {
          return {
            success: false,
            error: deleteResult.error,
            errorCode: PlanPersistenceErrorCodes.PLAN_DELETE_FAILED,
          };
        }
        deletedCount = deleteResult.data?.deletedCount ?? 0;
      }

      // 저장할 플랜이 없으면 성공 반환
      if (plans.length === 0) {
        logActionDebug(
          { domain: "plan", action: "savePlans" },
          "저장할 플랜이 없음",
          { planGroupId }
        );
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
        logActionError(
          { domain: "plan", action: "savePlans" },
          new Error(result.error ?? "플랜 저장 실패"),
          { planGroupId }
        );
        return {
          success: false,
          error: result.error ?? "플랜 저장에 실패했습니다",
          errorCode: PlanPersistenceErrorCodes.PLAN_INSERT_FAILED,
        };
      }

      logActionDebug(
        { domain: "plan", action: "savePlans" },
        "플랜 저장 완료",
        {
          savedCount: result.planIds?.length ?? 0,
          deletedCount,
          planGroupId,
        }
      );

      return {
        success: true,
        data: {
          savedCount: result.planIds?.length ?? 0,
          deletedCount,
        },
      };
    } catch (error) {
      logActionError(
        { domain: "plan", action: "savePlans" },
        error instanceof Error ? error : new Error(String(error)),
        { planGroupId, plansCount: plans.length }
      );

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "플랜 저장에 실패했습니다",
        errorCode: PlanPersistenceErrorCodes.PLAN_PERSISTENCE_FAILED,
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
      logActionDebug(
        { domain: "plan", action: "deleteExistingPlans" },
        "기존 플랜 삭제 시작",
        { planGroupId }
      );

      const result = await deleteStudentPlansByGroupId(
        planGroupId,
        context.studentId
      );

      if (!result.success) {
        logActionError(
          { domain: "plan", action: "deleteExistingPlans" },
          new Error(result.error ?? "플랜 삭제 실패"),
          { planGroupId }
        );
        return {
          success: false,
          error: result.error ?? "플랜 삭제에 실패했습니다",
          errorCode: PlanPersistenceErrorCodes.PLAN_DELETE_FAILED,
        };
      }

      logActionDebug(
        { domain: "plan", action: "deleteExistingPlans" },
        "기존 플랜 삭제 완료",
        { planGroupId }
      );

      // 삭제된 개수는 알 수 없으므로 -1 반환 (성공 표시)
      return {
        success: true,
        data: { deletedCount: -1 },
      };
    } catch (error) {
      logActionError(
        { domain: "plan", action: "deleteExistingPlans" },
        error instanceof Error ? error : new Error(String(error)),
        { planGroupId }
      );

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "플랜 삭제에 실패했습니다",
        errorCode: PlanPersistenceErrorCodes.PLAN_DELETE_FAILED,
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

// ============================================
// 팩토리 함수
// ============================================

// Singleton 인스턴스
let singletonInstance: PlanPersistenceService | null = null;

/**
 * PlanPersistenceService Singleton 인스턴스 반환
 */
export function getPlanPersistenceService(): PlanPersistenceService {
  if (!singletonInstance) {
    singletonInstance = new PlanPersistenceService();
  }
  return singletonInstance;
}

/**
 * Context 기반 PlanPersistenceService 인스턴스 생성
 */
export function createPlanPersistenceService(
  context: PlanServiceContext
): PlanPersistenceServiceWithContext {
  return new PlanPersistenceServiceWithContext(context);
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * ServiceContext를 PlanServiceContext로 변환
 *
 * Supabase 클라이언트가 필요한 경우 사용합니다.
 */
export function createPlanServiceContext(
  context: ServiceContext,
  groupId: string,
  queryClient: SupabaseAnyClient,
  masterQueryClient?: SupabaseAnyClient
): PlanServiceContext {
  return {
    queryClient,
    masterQueryClient: masterQueryClient ?? queryClient,
    studentId: context.studentId,
    tenantId: context.tenantId,
    groupId,
    isCampMode: context.isCampMode,
  };
}
