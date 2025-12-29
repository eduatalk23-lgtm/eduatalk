"use server";

/**
 * Quick Create Actions
 *
 * 빠른 플랜 생성 관련 서버 액션
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
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
} from "./types";
import { getAvailableStudyDates, getReviewDates, distributeDailyAmounts } from "./helpers";
import { getContentPlanGroupCount } from "./queries";

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
  // custom 타입은 마스터 복사 불필요
  if (contentType === "custom") {
    const { data, error } = await supabase
      .from("custom_contents")
      .select("id")
      .eq("id", contentId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      console.error(`[ensureStudentContent] custom_contents 조회 실패:`, error);
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
    console.error(`[ensureStudentContent] ${tableName} 조회 실패:`, studentError);
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
    console.error(`[ensureStudentContent] ${masterTableName} 조회 실패:`, masterError);
    return { success: false, error: "마스터 콘텐츠 정보를 확인할 수 없습니다." };
  }

  if (!masterContent) {
    return { success: false, error: "콘텐츠를 찾을 수 없습니다." };
  }

  // 3. 마스터 콘텐츠 복사
  try {
    if (contentType === "book") {
      const result = await copyMasterBookToStudent(contentId, studentId, tenantId);
      console.log(`[ensureStudentContent] 마스터 교재 복사 완료: ${contentId} → ${result.bookId}`);
      return { success: true, studentContentId: result.bookId };
    } else {
      const result = await copyMasterLectureToStudent(contentId, studentId, tenantId);
      console.log(`[ensureStudentContent] 마스터 강의 복사 완료: ${contentId} → ${result.lectureId}`);
      return { success: true, studentContentId: result.lectureId };
    }
  } catch (copyError) {
    console.error(`[ensureStudentContent] 마스터 콘텐츠 복사 실패:`, copyError);
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
      user.tenantId ?? ""
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
        tenant_id: user.tenantId,
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
      console.error("Quick create plan group error:", pgError);
      return { success: false, error: "플랜그룹 생성에 실패했습니다." };
    }

    // 4. plan_contents 생성
    const { error: pcError } = await supabase.from("plan_contents").insert({
      plan_group_id: planGroup.id,
      content_type: input.content.type,
      content_id: resolvedContentId,
      content_name: input.content.name,
      start_page_or_time: input.range.start,
      end_page_or_time: input.range.end,
      subject_name: input.content.subject ?? null,
      subject_category: input.content.subjectCategory ?? null,
    });

    if (pcError) {
      console.error("Quick create plan content error:", pcError);
      await supabase.from("plan_groups").delete().eq("id", planGroup.id);
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
        tenant_id: user.tenantId,
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
      console.error("Quick create student plans error:", spError);
      await supabase.from("plan_contents").delete().eq("plan_group_id", planGroup.id);
      await supabase.from("plan_groups").delete().eq("id", planGroup.id);
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
            tenant_id: user.tenantId,
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
    console.error("Quick create error:", error);
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

  const supabase = await createSupabaseServerClient();

  try {
    // 1. plan_group 생성 (plan_mode='quick', is_single_day=true)
    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .insert({
        student_id: user.userId,
        tenant_id: user.tenantId ?? null,
        name: input.title,
        plan_purpose: "기타",
        period_start: input.planDate,
        period_end: input.planDate,
        status: "active",
        plan_mode: "quick",
        is_single_day: true,
        creation_mode: "content_based",
      })
      .select("id")
      .single();

    if (groupError || !planGroup) {
      console.error("Failed to create quick plan group:", groupError);
      return {
        success: false,
        error: groupError?.message ?? "플랜그룹 생성에 실패했습니다.",
      };
    }

    // 2. student_plan 생성
    const estimatedMinutes = input.estimatedMinutes ?? 30;
    const { data: plan, error: planError } = await supabase
      .from("student_plan")
      .insert({
        student_id: user.userId,
        tenant_id: user.tenantId ?? null,
        plan_group_id: planGroup.id,
        title: input.title,
        plan_date: input.planDate,
        container_type: input.containerType ?? "daily",
        content_type: input.isFreeLearning
          ? input.freeLearningType ?? "free"
          : input.contentType ?? "custom",
        status: "pending",
        order_index: 0,
        is_virtual: false,
        estimated_minutes: estimatedMinutes,
        // 콘텐츠 연결 정보 (있는 경우)
        content_id: input.contentId ?? null,
        range_start: input.rangeStart ?? null,
        range_end: input.rangeEnd ?? null,
      })
      .select("id")
      .single();

    if (planError || !plan) {
      console.error("Failed to create quick plan:", planError);
      // 롤백: plan_group 삭제
      await supabase.from("plan_groups").delete().eq("id", planGroup.id);
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
    };
  } catch (error) {
    console.error("createQuickPlan error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
