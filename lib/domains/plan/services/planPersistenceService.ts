/**
 * 플랜 저장 서비스
 *
 * 플랜 레코드를 DB에 저장하고 트랜잭션 롤백을 관리합니다.
 *
 * @module lib/domains/plan/services/planPersistenceService
 */

import type {
  PlanServiceContext,
  GeneratePlanPayload,
  PlanInsertResult,
  PlanInsertError,
  BatchInsertOptions,
} from "./types";
import {
  logActionError,
  logActionDebug,
} from "@/lib/logging/actionLogger";

// ============================================
// PlanPersistenceService 클래스
// ============================================

/**
 * 플랜 저장 서비스
 *
 * 플랜 레코드를 DB에 저장하고 실패 시 롤백을 수행합니다.
 */
export class PlanPersistenceService {
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
      throw new Error(
        `기존 플랜 삭제에 실패했습니다: ${error.message || error.code}`
      );
    }
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
      logActionError(
        { domain: "plan", action: "rollback" },
        error,
        {
          groupId: this.ctx.groupId,
          insertedIds,
          errorMessage: error.message,
        }
      );
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
      // 가상 플랜 필드
      ...((payload as { is_virtual?: boolean }).is_virtual && {
        is_virtual: true,
        slot_index: (payload as { slot_index?: number }).slot_index,
        virtual_subject_category: (
          payload as { virtual_subject_category?: string }
        ).virtual_subject_category,
        virtual_description: (payload as { virtual_description?: string })
          .virtual_description,
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

    // 특정 에러 코드에 대한 구체적인 메시지
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
// 유틸리티 함수
// ============================================

/**
 * 플랜 저장 서비스 인스턴스 생성
 */
export function createPlanPersistenceService(
  context: PlanServiceContext
): PlanPersistenceService {
  return new PlanPersistenceService(context);
}
