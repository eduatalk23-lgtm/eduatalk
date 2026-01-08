"use server";

/**
 * Quick Create Actions
 *
 * 빠른 플랜 생성 관련 서버 액션
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { resolveAuthContext, isAdminContext } from "@/lib/auth/strategies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ContentPlanGroupResult, GeneratedPlan } from "@/lib/types/plan";
import {
  copyMasterBookToStudent,
  copyMasterLectureToStudent,
} from "@/lib/data/contentMasters";
import {
  MAX_CONTENT_PLAN_GROUPS,
  type QuickCreateInput,
  type CreateQuickPlanInput,
  type CreateQuickPlanResult,
  type CreateQuickPlanForStudentInput,
  type CreateQuickPlanForStudentResult,
} from "./types";
import { getAvailableStudyDates, getReviewDates, distributeDailyAmounts } from "./helpers";
import { getContentPlanGroupCount } from "./queries";
import { logActionError, logActionSuccess, logActionWarn, logActionDebug } from "@/lib/logging/actionLogger";
import { selectPlanGroupForPlanner, createPlanGroupForPlanner } from "@/lib/domains/admin-plan/utils/planGroupSelector";

// ============================================
// Rollback Helper Functions
// ============================================

/**
 * 빠른 플랜 생성 실패 시 롤백을 수행합니다.
 * 각 삭제 작업의 실패를 로깅하되, 전체 롤백을 계속 진행합니다.
 */
async function rollbackQuickCreate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  planGroupId: string,
  options?: {
    deleteStudentPlans?: boolean;
    deletePlanContents?: boolean;
    deletePlanGroup?: boolean;
  }
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  const opts = {
    deleteStudentPlans: true,
    deletePlanContents: true,
    deletePlanGroup: true,
    ...options,
  };

  // 1. student_plan 삭제
  if (opts.deleteStudentPlans) {
    const { error: spErr } = await supabase
      .from("student_plan")
      .delete()
      .eq("plan_group_id", planGroupId);
    if (spErr) {
      errors.push(`student_plan 삭제 실패: ${spErr.message}`);
      logActionError(
        { domain: "plan", action: "rollbackQuickCreate" },
        spErr,
        { planGroupId, step: "student_plan" }
      );
    }
  }

  // 2. plan_contents 삭제
  if (opts.deletePlanContents) {
    const { error: pcErr } = await supabase
      .from("plan_contents")
      .delete()
      .eq("plan_group_id", planGroupId);
    if (pcErr) {
      errors.push(`plan_contents 삭제 실패: ${pcErr.message}`);
      logActionError(
        { domain: "plan", action: "rollbackQuickCreate" },
        pcErr,
        { planGroupId, step: "plan_contents" }
      );
    }
  }

  // 3. plan_groups 삭제
  if (opts.deletePlanGroup) {
    const { error: pgErr } = await supabase
      .from("plan_groups")
      .delete()
      .eq("id", planGroupId);
    if (pgErr) {
      errors.push(`plan_groups 삭제 실패: ${pgErr.message}`);
      logActionError(
        { domain: "plan", action: "rollbackQuickCreate" },
        pgErr,
        { planGroupId, step: "plan_groups" }
      );
    }
  }

  if (errors.length > 0) {
    logActionWarn(
      { domain: "plan", action: "rollbackQuickCreate" },
      "롤백 중 일부 실패",
      { planGroupId, errors }
    );
  }

  return { success: errors.length === 0, errors };
}

// ============================================
// Helper Functions
// ============================================

/**
 * 콘텐츠 소유권 확인 및 마스터 콘텐츠 복사
 */
async function ensureStudentContent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  contentId: string,
  contentType: string,
  studentId: string,
  tenantId: string
): Promise<{ success: boolean; studentContentId?: string; error?: string }> {
  // contentId UUID 검증 (빈 문자열 방지)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!contentId || !uuidRegex.test(contentId)) {
    return { success: false, error: "유효하지 않은 콘텐츠 ID입니다." };
  }

  // custom 타입은 마스터 복사 불필요
  if (contentType === "custom") {
    const { data, error } = await supabase
      .from("student_custom_contents")
      .select("id")
      .eq("id", contentId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      logActionError(
        { domain: "plan", action: "ensureStudentContent" },
        error,
        { contentId, contentType, studentId }
      );
      return { success: false, error: "콘텐츠 정보를 확인할 수 없습니다." };
    }

    if (!data) {
      return { success: false, error: "콘텐츠를 찾을 수 없거나 접근 권한이 없습니다." };
    }

    return { success: true, studentContentId: contentId };
  }

  // book 또는 lecture 타입
  const tableName = contentType === "book" ? "books" : "lectures";
  const masterIdColumn = contentType === "book" ? "master_content_id" : "master_lecture_id";

  // 1. 먼저 학생 콘텐츠에서 검색 (직접 ID 또는 master_*_id로)
  const { data: studentContent, error: studentError } = await supabase
    .from(tableName)
    .select("id")
    .eq("student_id", studentId)
    .or(`id.eq.${contentId},${masterIdColumn}.eq.${contentId}`)
    .maybeSingle();

  if (studentError) {
    logActionError(
      { domain: "plan", action: "ensureStudentContent" },
      studentError,
      { contentId, contentType, studentId, tableName }
    );
    return { success: false, error: "콘텐츠 정보를 확인할 수 없습니다." };
  }

  // 학생 콘텐츠가 있으면 해당 ID 반환
  if (studentContent) {
    return { success: true, studentContentId: studentContent.id };
  }

  // 2. 학생 콘텐츠가 없으면 마스터 테이블에서 검색
  const masterTableName = contentType === "book" ? "master_books" : "master_lectures";
  const { data: masterContent, error: masterError } = await supabase
    .from(masterTableName)
    .select("id")
    .eq("id", contentId)
    .maybeSingle();

  if (masterError) {
    logActionError(
      { domain: "plan", action: "ensureStudentContent" },
      masterError,
      { contentId, contentType, masterTableName }
    );
    return { success: false, error: "마스터 콘텐츠 정보를 확인할 수 없습니다." };
  }

  if (!masterContent) {
    return { success: false, error: "콘텐츠를 찾을 수 없습니다." };
  }

  // 3. 마스터 콘텐츠 복사
  try {
    if (contentType === "book") {
      const result = await copyMasterBookToStudent(contentId, studentId, tenantId);
      logActionSuccess(
        { domain: "plan", action: "ensureStudentContent" },
        { masterContentId: contentId, studentContentId: result.bookId, contentType: "book" }
      );
      return { success: true, studentContentId: result.bookId };
    } else {
      const result = await copyMasterLectureToStudent(contentId, studentId, tenantId);
      logActionSuccess(
        { domain: "plan", action: "ensureStudentContent" },
        { masterContentId: contentId, studentContentId: result.lectureId, contentType: "lecture" }
      );
      return { success: true, studentContentId: result.lectureId };
    }
  } catch (copyError) {
    logActionError(
      { domain: "plan", action: "ensureStudentContent" },
      copyError,
      { contentId, contentType, step: "copyMasterContent" }
    );
    return {
      success: false,
      error: copyError instanceof Error ? copyError.message : "콘텐츠 복사에 실패했습니다.",
    };
  }
}

// ============================================
// Quick Create Functions
// ============================================

/**
 * 콘텐츠에서 빠르게 플랜그룹 생성
 */
export async function quickCreateFromContent(
  input: QuickCreateInput
): Promise<ContentPlanGroupResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // tenant_id 필수 검증
  if (!user.tenantId) {
    return { success: false, error: "테넌트 정보가 없습니다. 관리자에게 문의하세요." };
  }
  const tenantId = user.tenantId;

  const supabase = await createSupabaseServerClient();

  try {
    // 1. 9개 제한 체크
    const countInfo = await getContentPlanGroupCount();
    if (!countInfo.canAdd) {
      return {
        success: false,
        error: `콘텐츠별 플랜그룹은 최대 ${MAX_CONTENT_PLAN_GROUPS}개까지 생성할 수 있습니다.`,
      };
    }

    // 1.5. 콘텐츠 확보 (소유권 검증 또는 마스터 콘텐츠 복사)
    const contentResult = await ensureStudentContent(
      supabase,
      input.content.id,
      input.content.type,
      user.userId,
      tenantId
    );
    if (!contentResult.success || !contentResult.studentContentId) {
      return { success: false, error: contentResult.error ?? "콘텐츠 접근 권한이 없습니다." };
    }
    const resolvedContentId = contentResult.studentContentId;

    // 2. 학습일 계산
    const startDate = new Date(input.schedule.startDate);
    const endDate = new Date(input.schedule.endDate);
    const studyDates = getAvailableStudyDates(
      startDate,
      endDate,
      input.schedule.weekdays,
      [], // 제외일 없음 (빠른 생성)
      input.schedule.studyType,
      input.schedule.studyType === "strategy" ? 3 : undefined, // 전략 과목 기본 주 3일
      undefined
    );

    if (studyDates.length === 0) {
      return {
        success: false,
        error: "선택한 기간에 학습 가능한 날짜가 없습니다.",
      };
    }

    // 3. 플랜그룹 생성
    const { data: planGroup, error: pgError } = await supabase
      .from("plan_groups")
      .insert({
        tenant_id: tenantId,
        student_id: user.userId,
        name: input.content.name,
        period_start: input.schedule.startDate,
        period_end: input.schedule.endDate,
        status: "active",
        creation_mode: "content_based",
        study_type: input.schedule.studyType,
        scheduler_options: {
          weekdays: input.schedule.weekdays,
          studyType: input.schedule.studyType,
          reviewEnabled: input.schedule.reviewEnabled ?? false,
        },
      })
      .select()
      .single();

    if (pgError || !planGroup) {
      logActionError(
        { domain: "plan", action: "quickCreateFromContent" },
        pgError ?? new Error("planGroup is null"),
        { userId: user.userId, step: "plan_groups" }
      );
      return { success: false, error: "플랜그룹 생성에 실패했습니다." };
    }

    // 4. plan_contents 생성
    const { error: pcError } = await supabase.from("plan_contents").insert({
      plan_group_id: planGroup.id,
      tenant_id: tenantId,
      content_type: input.content.type,
      content_id: resolvedContentId,
      content_name: input.content.name,
      start_range: input.range.start,
      end_range: input.range.end,
      subject_name: input.content.subject ?? null,
      subject_category: input.content.subjectCategory ?? null,
      display_order: 0,
    });

    if (pcError) {
      logActionError(
        { domain: "plan", action: "quickCreateFromContent" },
        pcError,
        { planGroupId: planGroup.id, step: "plan_contents" }
      );
      // 롤백: plan_group만 삭제 (plan_contents는 생성 실패)
      const rollback = await rollbackQuickCreate(supabase, planGroup.id, {
        deleteStudentPlans: false,
        deletePlanContents: false,
        deletePlanGroup: true,
      });
      if (!rollback.success) {
        logActionWarn(
          { domain: "plan", action: "quickCreateFromContent" },
          "Rollback partial failure",
          { planGroupId: planGroup.id, errors: rollback.errors }
        );
      }
      return { success: false, error: "콘텐츠 연결에 실패했습니다." };
    }

    // 5. student_plans 생성
    const totalAmount = input.range.end - input.range.start + 1;
    const dailyAmounts = distributeDailyAmounts(totalAmount, studyDates.length);

    const plans: GeneratedPlan[] = [];
    let currentPosition = input.range.start;

    const studentPlansToInsert = studyDates.map((date, index) => {
      const amount = dailyAmounts[index];
      const rangeStart = currentPosition;
      const rangeEnd = currentPosition + amount - 1;
      currentPosition += amount;

      const planId = crypto.randomUUID();
      plans.push({
        id: planId,
        date: date.toISOString().split("T")[0],
        rangeStart,
        rangeEnd,
        status: "pending",
        containerType: "daily",
        estimatedDuration: amount * 5,
      });

      return {
        id: planId,
        tenant_id: tenantId,
        student_id: user.userId,
        plan_group_id: planGroup.id,
        plan_date: date.toISOString().split("T")[0],
        block_index: 0,
        content_type: input.content.type,
        content_id: resolvedContentId,
        content_title: input.content.name,
        content_subject: input.content.subject ?? null,
        content_subject_category: input.content.subjectCategory ?? null,
        planned_start_page_or_time: rangeStart,
        planned_end_page_or_time: rangeEnd,
        status: "pending",
        container_type: "daily",
        subject_type: input.schedule.studyType,
        is_active: true,
      };
    });

    const { error: spError } = await supabase
      .from("student_plan")
      .insert(studentPlansToInsert);

    if (spError) {
      logActionError(
        { domain: "plan", action: "quickCreateFromContent" },
        spError,
        { planGroupId: planGroup.id, step: "student_plan" }
      );
      // 롤백: plan_contents와 plan_groups 삭제 (student_plan은 생성 실패)
      const rollback = await rollbackQuickCreate(supabase, planGroup.id, {
        deleteStudentPlans: false,
        deletePlanContents: true,
        deletePlanGroup: true,
      });
      if (!rollback.success) {
        logActionWarn(
          { domain: "plan", action: "quickCreateFromContent" },
          "Rollback partial failure",
          { planGroupId: planGroup.id, errors: rollback.errors }
        );
      }
      return { success: false, error: "플랜 생성에 실패했습니다." };
    }

    // 6. 복습 플랜 생성 (선택적)
    let reviewDays = 0;
    if (input.schedule.reviewEnabled) {
      const reviewDateInfos = getReviewDates(studyDates, endDate);
      reviewDays = reviewDateInfos.length;

      const dateRangeMap = new Map<string, { start: number; end: number }>();
      let pos = input.range.start;
      for (let i = 0; i < studyDates.length; i++) {
        const amount = dailyAmounts[i];
        dateRangeMap.set(studyDates[i].toISOString().split("T")[0], {
          start: pos,
          end: pos + amount - 1,
        });
        pos += amount;
      }

      const reviewPlansToInsert = reviewDateInfos
        .map((reviewInfo) => {
          let weekRangeStart = Infinity;
          let weekRangeEnd = 0;
          for (const planDate of reviewInfo.plansToReview) {
            const range = dateRangeMap.get(planDate.toISOString().split("T")[0]);
            if (range) {
              weekRangeStart = Math.min(weekRangeStart, range.start);
              weekRangeEnd = Math.max(weekRangeEnd, range.end);
            }
          }

          if (weekRangeStart === Infinity) return null;

          const reviewPlanId = crypto.randomUUID();
          plans.push({
            id: reviewPlanId,
            date: reviewInfo.date.toISOString().split("T")[0],
            rangeStart: weekRangeStart,
            rangeEnd: weekRangeEnd,
            status: "pending",
            containerType: "daily",
            estimatedDuration: Math.ceil((weekRangeEnd - weekRangeStart + 1) * 2),
          });

          return {
            id: reviewPlanId,
            tenant_id: tenantId,
            student_id: user.userId,
            plan_group_id: planGroup.id,
            plan_date: reviewInfo.date.toISOString().split("T")[0],
            block_index: 0,
            content_type: input.content.type,
            content_id: resolvedContentId,
            content_title: `[복습] ${input.content.name}`,
            content_subject: input.content.subject ?? null,
            content_subject_category: input.content.subjectCategory ?? null,
            planned_start_page_or_time: weekRangeStart,
            planned_end_page_or_time: weekRangeEnd,
            status: "pending",
            container_type: "daily",
            subject_type: "review",
            is_active: true,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (reviewPlansToInsert.length > 0) {
        await supabase.from("student_plan").insert(reviewPlansToInsert);
      }
    }

    // 7. 캐시 재검증
    revalidatePath("/plan");
    revalidatePath("/today");

    const studyDaysCount = studyDates.length;
    return {
      success: true,
      planGroup: {
        ...planGroup,
        study_type: input.schedule.studyType,
        creation_mode: "content_based" as const,
      },
      plans,
      summary: {
        totalPlans: studyDaysCount + reviewDays,
        studyDays: studyDaysCount,
        reviewDays,
        dailyAmount: Math.ceil(totalAmount / studyDaysCount),
        estimatedEndDate: studyDates[studyDates.length - 1].toISOString().split("T")[0],
        totalRange: totalAmount,
      },
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "quickCreateFromContent" },
      error,
      { userId: user.userId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

/**
 * 단일 빠른 플랜 생성 (하루짜리)
 */
export async function createQuickPlan(
  input: CreateQuickPlanInput
): Promise<CreateQuickPlanResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // tenant_id 필수 검증
  if (!user.tenantId) {
    return { success: false, error: "테넌트 정보가 없습니다. 관리자에게 문의하세요." };
  }
  const tenantId = user.tenantId;

  const supabase = await createSupabaseServerClient();

  try {
    // 0. content_id 확보 (자유 학습인 경우 flexible_contents 생성)
    let resolvedContentId: string;
    const isFreeLearning = input.isFreeLearning || !input.contentId || input.contentId === "";

    if (isFreeLearning) {
      // 자유 학습: flexible_contents에 플레이스홀더 생성
      const { data: flexibleContent, error: fcError } = await supabase
        .from("flexible_contents")
        .insert({
          tenant_id: tenantId,
          student_id: user.userId,
          content_type: "free",
          title: input.title,
          item_type: input.freeLearningType ?? "free",
          estimated_minutes: input.estimatedMinutes ?? 30,
        })
        .select("id")
        .single();

      if (fcError || !flexibleContent) {
        logActionError(
          { domain: "plan", action: "createQuickPlan" },
          fcError ?? new Error("flexibleContent is null"),
          { userId: user.userId, step: "flexible_contents" }
        );
        return {
          success: false,
          error: fcError?.message ?? "자유 학습 콘텐츠 생성에 실패했습니다.",
        };
      }
      resolvedContentId = flexibleContent.id;
    } else {
      // 기존 콘텐츠 사용: UUID 형식 검증
      // isFreeLearning이 false이면 input.contentId는 truthy하고 빈 문자열이 아님
      const contentId = input.contentId as string;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(contentId)) {
        return {
          success: false,
          error: "유효하지 않은 콘텐츠 ID입니다.",
        };
      }
      resolvedContentId = contentId;
    }

    // 1. plan_group 생성 (plan_mode='quick', is_single_day=true)
    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .insert({
        student_id: user.userId,
        tenant_id: tenantId,
        name: input.title,
        plan_purpose: "기타",
        period_start: input.planDate,
        period_end: input.planDate,
        status: "active",
        plan_mode: "quick",
        is_single_day: true,
        creation_mode: isFreeLearning ? "free_learning" : "content_based",
      })
      .select("id")
      .single();

    if (groupError || !planGroup) {
      logActionError(
        { domain: "plan", action: "createQuickPlan" },
        groupError ?? new Error("planGroup is null"),
        { userId: user.userId, step: "plan_groups" }
      );
      return {
        success: false,
        error: groupError?.message ?? "플랜그룹 생성에 실패했습니다.",
      };
    }

    // 2. student_plan 생성
    const estimatedMinutes = input.estimatedMinutes ?? 30;
    const contentType = isFreeLearning
      ? input.freeLearningType ?? "free"
      : input.contentType ?? "custom";

    const { data: plan, error: planError } = await supabase
      .from("student_plan")
      .insert({
        student_id: user.userId,
        tenant_id: tenantId,
        plan_group_id: planGroup.id,
        plan_date: input.planDate,
        block_index: 0, // NOT NULL 필수
        content_type: contentType,
        content_id: resolvedContentId,
        content_title: input.title,
        container_type: input.containerType ?? "daily",
        status: "pending",
        is_virtual: false,
        flexible_content_id: isFreeLearning ? resolvedContentId : null,
        planned_start_page_or_time: input.rangeStart ?? null,
        planned_end_page_or_time: input.rangeEnd ?? null,
      })
      .select("id")
      .single();

    if (planError || !plan) {
      logActionError(
        { domain: "plan", action: "createQuickPlan" },
        planError ?? new Error("plan is null"),
        { planGroupId: planGroup.id, step: "student_plan" }
      );
      // 롤백: plan_group 삭제
      const rollback = await rollbackQuickCreate(supabase, planGroup.id, {
        deleteStudentPlans: false,
        deletePlanContents: false,
        deletePlanGroup: true,
      });
      if (!rollback.success) {
        logActionWarn(
          { domain: "plan", action: "createQuickPlan" },
          "Rollback partial failure",
          { planGroupId: planGroup.id, errors: rollback.errors }
        );
      }
      // 자유 학습인 경우 flexible_contents도 삭제
      if (isFreeLearning) {
        const { error: fcDeleteError } = await supabase
          .from("flexible_contents")
          .delete()
          .eq("id", resolvedContentId);
        if (fcDeleteError) {
          logActionError(
            { domain: "plan", action: "createQuickPlan" },
            fcDeleteError,
            { resolvedContentId, step: "rollback_flexible_contents" }
          );
        }
      }
      return {
        success: false,
        error: planError?.message ?? "플랜 생성에 실패했습니다.",
      };
    }

    revalidatePath("/today");
    revalidatePath("/plan");
    revalidatePath("/plan/calendar");

    return {
      success: true,
      planGroupId: planGroup.id,
      planId: plan.id,
      flexibleContentId: isFreeLearning ? resolvedContentId : undefined,
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "createQuickPlan" },
      error,
      { userId: user.userId }
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

// ============================================
// Admin Quick Create Functions
// ============================================

/**
 * 관리자가 학생을 대신하여 빠른 플랜 생성
 *
 * Strategy Pattern을 사용하여 인증을 처리합니다.
 * admin/consultant 역할만 사용 가능합니다.
 *
 * @param input 빠른 플랜 생성 입력 (studentId 필수)
 * @returns 생성 결과
 */
export async function createQuickPlanForStudent(
  input: CreateQuickPlanForStudentInput
): Promise<CreateQuickPlanForStudentResult> {
  // Strategy Pattern으로 인증 해결
  const auth = await resolveAuthContext({ studentId: input.studentId });

  // Admin/Consultant만 허용
  if (!isAdminContext(auth)) {
    return {
      success: false,
      error: "관리자 권한이 필요합니다.",
    };
  }

  const studentId = auth.studentId;
  const tenantId = input.tenantId || auth.tenantId;

  if (!tenantId) {
    return {
      success: false,
      error: "테넌트 정보가 필요합니다.",
    };
  }

  logActionDebug(
    { domain: "plan", action: "createQuickPlanForStudent" },
    `Admin ${auth.userId} creating quick plan for student ${studentId}`,
    { adminRole: auth.adminRole, tenantId }
  );

  const supabase = await createSupabaseServerClient();

  try {
    // 0. content_id 확보 (자유 학습인 경우 flexible_contents 생성)
    let resolvedContentId: string;
    const isFreeLearning = input.isFreeLearning || !input.contentId || input.contentId === "";

    if (isFreeLearning) {
      // 자유 학습: flexible_contents에 플레이스홀더 생성
      const { data: flexibleContent, error: fcError } = await supabase
        .from("flexible_contents")
        .insert({
          tenant_id: tenantId,
          student_id: studentId,
          content_type: "free",
          title: input.title,
          item_type: input.freeLearningType ?? "free",
          estimated_minutes: input.estimatedMinutes ?? 30,
        })
        .select("id")
        .single();

      if (fcError || !flexibleContent) {
        logActionError(
          { domain: "plan", action: "createQuickPlanForStudent" },
          fcError ?? new Error("flexibleContent is null"),
          { adminUserId: auth.userId, studentId, step: "flexible_contents" }
        );
        return {
          success: false,
          error: fcError?.message ?? "자유 학습 콘텐츠 생성에 실패했습니다.",
        };
      }
      resolvedContentId = flexibleContent.id;
    } else {
      // 기존 콘텐츠 사용: UUID 형식 검증
      const contentId = input.contentId as string;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(contentId)) {
        return {
          success: false,
          error: "유효하지 않은 콘텐츠 ID입니다.",
        };
      }
      resolvedContentId = contentId;
    }

    // 1. 플래너에 연결된 Plan Group 찾기 또는 생성
    let planGroupId: string;

    // plannerId가 제공된 경우 플래너 기반으로 Plan Group 선택
    if (input.plannerId) {
      const planGroupResult = await selectPlanGroupForPlanner(input.plannerId, {
        studentId,
        preferPeriod: { start: input.planDate, end: input.planDate },
      });

      if (planGroupResult.status === "found" || planGroupResult.status === "multiple") {
        // 기존 Plan Group 사용
        planGroupId = planGroupResult.planGroupId!;
        logActionDebug(
          { domain: "plan", action: "createQuickPlanForStudent" },
          `Using existing plan group: ${planGroupId}`,
          { plannerId: input.plannerId }
        );
      } else if (planGroupResult.status === "not-found") {
        // 새 Plan Group 생성 (플래너에 연결)
        const createResult = await createPlanGroupForPlanner({
          plannerId: input.plannerId,
          studentId,
          tenantId,
          name: input.title,
          periodStart: input.planDate,
          periodEnd: input.planDate,
        });

        if (!createResult.success || !createResult.planGroupId) {
          logActionError(
            { domain: "plan", action: "createQuickPlanForStudent" },
            new Error(createResult.error ?? "Plan Group 생성 실패"),
            { adminUserId: auth.userId, studentId, step: "create_plan_group" }
          );
          return {
            success: false,
            error: createResult.error ?? "플랜그룹 생성에 실패했습니다.",
          };
        }
        planGroupId = createResult.planGroupId;
      } else {
        // 에러 상태
        return {
          success: false,
          error: planGroupResult.message ?? "플랜그룹 조회/생성에 실패했습니다.",
        };
      }
    } else {
      // 레거시 지원: plannerId 없이 호출된 경우 기존 방식으로 생성
      const { data: planGroup, error: groupError } = await supabase
        .from("plan_groups")
        .insert({
          student_id: studentId,
          tenant_id: tenantId,
          name: input.title,
          plan_purpose: "기타",
          period_start: input.planDate,
          period_end: input.planDate,
          status: "active",
          plan_mode: "quick",
          is_single_day: true,
          creation_mode: isFreeLearning ? "free_learning" : "content_based",
          last_admin_id: auth.userId,
          admin_modified_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (groupError || !planGroup) {
        logActionError(
          { domain: "plan", action: "createQuickPlanForStudent" },
          groupError ?? new Error("planGroup is null"),
          { adminUserId: auth.userId, studentId, step: "plan_groups" }
        );
        return {
          success: false,
          error: groupError?.message ?? "플랜그룹 생성에 실패했습니다.",
        };
      }
      planGroupId = planGroup.id;
    }

    // 2. student_plan 생성
    const contentType = isFreeLearning
      ? input.freeLearningType ?? "free"
      : input.contentType ?? "custom";

    const { data: plan, error: planError } = await supabase
      .from("student_plan")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
        plan_group_id: planGroupId,
        plan_date: input.planDate,
        block_index: 0,
        content_type: contentType,
        content_id: resolvedContentId,
        content_title: input.title,
        container_type: input.containerType ?? "daily",
        status: "pending",
        is_virtual: false,
        flexible_content_id: isFreeLearning ? resolvedContentId : null,
        planned_start_page_or_time: input.rangeStart ?? null,
        planned_end_page_or_time: input.rangeEnd ?? null,
      })
      .select("id")
      .single();

    if (planError || !plan) {
      logActionError(
        { domain: "plan", action: "createQuickPlanForStudent" },
        planError ?? new Error("plan is null"),
        { planGroupId, step: "student_plan" }
      );
      // 롤백: plan_group 삭제 (레거시 방식으로 생성된 경우만)
      if (!input.plannerId) {
        const rollback = await rollbackQuickCreate(supabase, planGroupId, {
          deleteStudentPlans: false,
          deletePlanContents: false,
          deletePlanGroup: true,
        });
        if (!rollback.success) {
          logActionWarn(
            { domain: "plan", action: "createQuickPlanForStudent" },
            "Rollback partial failure",
            { planGroupId, errors: rollback.errors }
          );
        }
      }
      // 자유 학습인 경우 flexible_contents도 삭제
      if (isFreeLearning) {
        const { error: fcDeleteError } = await supabase
          .from("flexible_contents")
          .delete()
          .eq("id", resolvedContentId);
        if (fcDeleteError) {
          logActionError(
            { domain: "plan", action: "createQuickPlanForStudent" },
            fcDeleteError,
            { resolvedContentId, step: "rollback_flexible_contents" }
          );
        }
      }
      return {
        success: false,
        error: planError?.message ?? "플랜 생성에 실패했습니다.",
      };
    }

    // Admin 페이지 캐시 재검증
    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath(`/admin/students/${studentId}`);

    logActionSuccess(
      { domain: "plan", action: "createQuickPlanForStudent" },
      {
        planGroupId,
        planId: plan.id,
        studentId,
        adminUserId: auth.userId,
        adminRole: auth.adminRole,
        plannerId: input.plannerId,
      }
    );

    return {
      success: true,
      planGroupId,
      planId: plan.id,
      flexibleContentId: isFreeLearning ? resolvedContentId : undefined,
      studentId,
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "createQuickPlanForStudent" },
      error,
      { adminUserId: auth.userId, studentId }
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
