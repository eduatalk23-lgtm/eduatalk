"use server";

/**
 * Content-based PlanGroup Creation Actions
 *
 * 콘텐츠 기반 플랜그룹 생성 관련 서버 액션
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
// PLAN-004: AppError/ErrorCode/withErrorHandling 불필요 - { success, error } 패턴으로 통일
import { logActionError, logActionSuccess, logActionWarn } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CreateContentPlanGroupInput,
  ContentPlanGroupResult,
  ContentPlanGroupPreview,
  PreviewContentPlanGroupParams,
  PlanPreviewItem,
  GeneratedPlan,
} from "@/lib/types/plan";
import {
  copyMasterBookToStudent,
  copyMasterLectureToStudent,
} from "@/lib/data/contentMasters";
import { MAX_CONTENT_PLAN_GROUPS, MAX_CONTENTS_PER_PLAN_GROUP, type AddContentToCalendarOnlyInput } from "./types";
import {
  getAvailableStudyDates,
  getReviewDates,
  getWeekNumber,
  distributeDailyAmounts,
} from "./helpers";
import { getContentPlanGroupCount, getTemplateSettings } from "./queries";
import { generatePlansAtomic, type AtomicPlanPayload } from "@/lib/domains/plan/transactions";

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
      logActionError({ domain: "plan", action: "ensureStudentContent" }, error, { contentId, contentType, step: "student_custom_contents" });
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
    logActionError({ domain: "plan", action: "ensureStudentContent" }, studentError, { contentId, contentType, step: tableName });
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
    logActionError({ domain: "plan", action: "ensureStudentContent" }, masterError, { contentId, contentType, step: masterTableName });
    return { success: false, error: "마스터 콘텐츠 정보를 확인할 수 없습니다." };
  }

  if (!masterContent) {
    return { success: false, error: "콘텐츠를 찾을 수 없습니다." };
  }

  // 3. 마스터 콘텐츠 복사
  try {
    if (contentType === "book") {
      const result = await copyMasterBookToStudent(contentId, studentId, tenantId);
      logActionSuccess({ domain: "plan", action: "ensureStudentContent" }, { contentId, newContentId: result.bookId, contentType: "book" });
      return { success: true, studentContentId: result.bookId };
    } else {
      const result = await copyMasterLectureToStudent(contentId, studentId, tenantId);
      logActionSuccess({ domain: "plan", action: "ensureStudentContent" }, { contentId, newContentId: result.lectureId, contentType: "lecture" });
      return { success: true, studentContentId: result.lectureId };
    }
  } catch (copyError) {
    logActionError({ domain: "plan", action: "ensureStudentContent" }, copyError, { contentId, contentType, step: "copy" });
    return {
      success: false,
      error: copyError instanceof Error ? copyError.message : "콘텐츠 복사에 실패했습니다.",
    };
  }
}

// ============================================
// Preview Functions
// ============================================

/**
 * 콘텐츠 기반 플랜그룹 미리보기 생성
 */
async function _previewContentPlanGroup(
  params: PreviewContentPlanGroupParams
): Promise<{ success: boolean; data?: ContentPlanGroupPreview; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 템플릿 설정 조회
  const templateSettings = await getTemplateSettings({
    templatePlanGroupId: params.templatePlanGroupId,
    includeExclusions: true,
    includeAcademySchedules: true,
  });

  if (!templateSettings) {
    return { success: false, error: "템플릿을 찾을 수 없습니다." };
  }

  // 오버라이드 적용
  const period = params.overrides?.period ?? templateSettings.period;
  const weekdays = params.overrides?.weekdays ?? templateSettings.weekdays;

  // 학습일 계산
  const startDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);
  const studyDates = getAvailableStudyDates(
    startDate,
    endDate,
    weekdays,
    templateSettings.exclusions,
    params.studyType.type,
    params.studyType.daysPerWeek,
    params.studyType.preferredDays
  );

  // 총 분량
  const totalAmount = params.range.end - params.range.start + 1;
  const studyDays = studyDates.length;

  // 분량 분배
  const dailyAmounts = distributeDailyAmounts(totalAmount, studyDays);

  // 플랜 미리보기 생성
  const planPreviews: PlanPreviewItem[] = [];
  let currentPosition = params.range.start;

  // 날짜별 범위 매핑 (복습용)
  const dateRangeMap = new Map<string, { start: number; end: number }>();

  for (let i = 0; i < studyDates.length; i++) {
    const date = studyDates[i];
    const amount = dailyAmounts[i];
    const dateStr = date.toISOString().split("T")[0];

    const rangeStart = currentPosition;
    const rangeEnd = currentPosition + amount - 1;

    dateRangeMap.set(dateStr, { start: rangeStart, end: rangeEnd });

    planPreviews.push({
      date: dateStr,
      dayType: "study",
      dayOfWeek: date.getDay(),
      rangeStart,
      rangeEnd,
      estimatedDuration: amount * 5, // 기본: 1단위당 5분
      weekNumber: getWeekNumber(date),
    });

    currentPosition += amount;
  }

  // 복습 플랜 추가
  let reviewDays = 0;
  if (params.studyType.reviewEnabled) {
    const reviewDateInfos = getReviewDates(studyDates, endDate);
    reviewDays = reviewDateInfos.length;

    for (const reviewInfo of reviewDateInfos) {
      // 해당 주의 범위 합산
      let weekRangeStart = Infinity;
      let weekRangeEnd = 0;

      for (const planDate of reviewInfo.plansToReview) {
        const dateStr = planDate.toISOString().split("T")[0];
        const range = dateRangeMap.get(dateStr);
        if (range) {
          weekRangeStart = Math.min(weekRangeStart, range.start);
          weekRangeEnd = Math.max(weekRangeEnd, range.end);
        }
      }

      if (weekRangeStart !== Infinity) {
        planPreviews.push({
          date: reviewInfo.date.toISOString().split("T")[0],
          dayType: "review",
          dayOfWeek: reviewInfo.date.getDay(),
          rangeStart: weekRangeStart,
          rangeEnd: weekRangeEnd,
          estimatedDuration: Math.ceil((weekRangeEnd - weekRangeStart + 1) * 2), // 복습은 빠르게
          weekNumber: reviewInfo.weekNumber,
        });
      }
    }

    // 날짜순 정렬
    planPreviews.sort((a, b) => a.date.localeCompare(b.date));
  }

  // 경고/정보 메시지
  const warnings: string[] = [];
  const info: string[] = [];

  if (studyDays === 0) {
    warnings.push("선택한 기간에 학습 가능한 날짜가 없습니다.");
  } else if (studyDays < totalAmount) {
    warnings.push(
      `학습일(${studyDays}일)보다 분량(${totalAmount})이 많아 하루에 여러 단위를 학습합니다.`
    );
  }

  if (params.studyType.type === "strategy") {
    info.push(
      `전략 과목: 주 ${params.studyType.daysPerWeek}일 학습`
    );
  } else {
    info.push("취약 과목: 매일 학습");
  }

  if (params.studyType.reviewEnabled && reviewDays > 0) {
    info.push(`주간 복습: ${reviewDays}회 (매주 토요일)`);
  }

  // 미리보기 개수 제한
  const limitedPreviews = params.maxPreviewPlans
    ? planPreviews.slice(0, params.maxPreviewPlans)
    : planPreviews;

  return {
    success: true,
    data: {
      inheritedSettings: templateSettings,
      distribution: {
        totalDays: studyDays + reviewDays,
        studyDays,
        reviewDays,
        dailyAmount: Math.ceil(totalAmount / studyDays) || 0,
      },
      planPreviews: limitedPreviews,
      warnings,
      info,
    },
  };
}

/**
 * 콘텐츠 플랜 그룹 미리보기 (서버 액션)
 *
 * 템플릿 설정을 기반으로 플랜 분배 미리보기를 생성합니다.
 * PLAN-004: 에러 처리 패턴 일관성을 위해 { success, data, error } 패턴 적용
 */
export const previewContentPlanGroup = _previewContentPlanGroup;

// ============================================
// Create Functions
// ============================================

/**
 * 콘텐츠 기반 플랜그룹 생성
 */
export async function createContentPlanGroup(
  input: CreateContentPlanGroupInput
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

    // 2. 템플릿 설정 조회
    const templateSettings = await getTemplateSettings({
      templatePlanGroupId: input.templatePlanGroupId,
      includeExclusions: true,
      includeAcademySchedules: true,
    });

    if (!templateSettings) {
      return { success: false, error: "템플릿을 찾을 수 없습니다." };
    }

    // 2.5. 콘텐츠 확보 (소유권 검증 또는 마스터 콘텐츠 복사)
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

    // 학생 콘텐츠 ID 사용 (마스터 콘텐츠가 복사된 경우 새 ID)
    const resolvedContentId = contentResult.studentContentId;

    // 3. 설정 병합 (오버라이드 적용)
    const period = input.overrides?.period ?? templateSettings.period;
    const weekdays = input.overrides?.weekdays ?? templateSettings.weekdays;
    const blockSetId =
      input.overrides?.blockSetId ?? templateSettings.blockSetId;

    // 4. 학습일 계산
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);
    const studyDates = getAvailableStudyDates(
      startDate,
      endDate,
      weekdays,
      templateSettings.exclusions,
      input.studyType.type,
      input.studyType.daysPerWeek,
      input.studyType.preferredDays
    );

    if (studyDates.length === 0) {
      return {
        success: false,
        error: "선택한 기간에 학습 가능한 날짜가 없습니다.",
      };
    }

    // 5. 플랜그룹 생성
    // P3: 템플릿의 timeSettings, studyReviewCycle, nonStudyTimeBlocks 상속
    const mergedSchedulerOptions = {
      ...templateSettings.schedulerOptions,
      weekdays,
      // P3: timeSettings 병합
      ...(templateSettings.timeSettings && {
        lunch_time: templateSettings.timeSettings.lunch_time,
        camp_study_hours: templateSettings.timeSettings.camp_study_hours,
        camp_self_study_hours: templateSettings.timeSettings.camp_self_study_hours,
        designated_holiday_hours: templateSettings.timeSettings.designated_holiday_hours,
        use_self_study_with_blocks: templateSettings.timeSettings.use_self_study_with_blocks,
        enable_self_study_for_holidays: templateSettings.timeSettings.enable_self_study_for_holidays,
        enable_self_study_for_study_days: templateSettings.timeSettings.enable_self_study_for_study_days,
      }),
      // P3: studyReviewCycle 병합
      ...(templateSettings.studyReviewCycle && {
        study_days: templateSettings.studyReviewCycle.studyDays,
        review_days: templateSettings.studyReviewCycle.reviewDays,
      }),
    };

    const { data: planGroup, error: pgError } = await supabase
      .from("plan_groups")
      .insert({
        tenant_id: tenantId,
        student_id: user.userId,
        name: input.content.name,
        period_start: period.startDate,
        period_end: period.endDate,
        block_set_id: blockSetId,
        status: "active",
        creation_mode: "content_based",
        template_plan_group_id: input.templatePlanGroupId,
        study_type: input.studyType.type,
        strategy_days_per_week:
          input.studyType.type === "strategy"
            ? input.studyType.daysPerWeek ?? null
            : null,
        scheduler_options: mergedSchedulerOptions,
        study_hours: templateSettings.studyHours,
        self_study_hours: templateSettings.selfStudyHours,
        // P3: nonStudyTimeBlocks 상속
        non_study_time_blocks: templateSettings.nonStudyTimeBlocks ?? null,
      })
      .select()
      .single();

    if (pgError || !planGroup) {
      logActionError({ domain: "plan", action: "createContentPlanGroup" }, pgError, { step: "planGroup", templateId: input.templatePlanGroupId });
      return { success: false, error: "플랜그룹 생성에 실패했습니다." };
    }

    // 6. plan_contents 생성
    const { error: pcError } = await supabase.from("plan_contents").insert({
      plan_group_id: planGroup.id,
      tenant_id: tenantId,
      content_type: input.content.type === "custom" ? "custom" : input.content.type,
      content_id: resolvedContentId,
      content_name: input.content.name,
      start_range: input.range.start,
      end_range: input.range.end,
      subject_name: input.content.subject ?? null,
      subject_category: input.content.subjectCategory ?? null,
      display_order: 0,
    });

    if (pcError) {
      logActionError({ domain: "plan", action: "createContentPlanGroup" }, pcError, { step: "planContents", planGroupId: planGroup.id });
      // 롤백: 플랜그룹 삭제
      await supabase.from("plan_groups").delete().eq("id", planGroup.id);
      return { success: false, error: "콘텐츠 연결에 실패했습니다." };
    }

    // 7. student_plans 생성 (원자적 트랜잭션 사용)
    const totalAmount = input.range.end - input.range.start + 1;
    const dailyAmounts = distributeDailyAmounts(totalAmount, studyDates.length);

    const plans: GeneratedPlan[] = [];
    const allPlansToInsert: AtomicPlanPayload[] = [];
    let currentPosition = input.range.start;

    // 7a. 학습 플랜 준비
    const dateRangeMap = new Map<string, { start: number; end: number; planId: string }>();

    for (let index = 0; index < studyDates.length; index++) {
      const date = studyDates[index];
      const amount = dailyAmounts[index];
      const rangeStart = currentPosition;
      const rangeEnd = currentPosition + amount - 1;
      currentPosition += amount;

      const planId = crypto.randomUUID();
      const dateStr = date.toISOString().split("T")[0];

      dateRangeMap.set(dateStr, {
        start: rangeStart,
        end: rangeEnd,
        planId,
      });

      plans.push({
        id: planId,
        date: dateStr,
        rangeStart,
        rangeEnd,
        status: "pending",
        containerType: "daily",
        estimatedDuration: amount * 5,
      });

      allPlansToInsert.push({
        plan_group_id: planGroup.id,
        tenant_id: tenantId,
        student_id: user.userId,
        plan_date: dateStr,
        block_index: 0,
        content_type: input.content.type === "custom" ? "custom" : input.content.type,
        content_id: resolvedContentId,
        content_title: input.content.name,
        content_subject: input.content.subject ?? null,
        content_subject_category: input.content.subjectCategory ?? null,
        planned_start_page_or_time: rangeStart,
        planned_end_page_or_time: rangeEnd,
        status: "pending",
        container_type: "daily",
        subject_type: input.studyType.type,
        is_active: true,
      });
    }

    // 7b. 복습 플랜 준비 (reviewEnabled인 경우)
    let reviewDays = 0;
    if (input.studyType.reviewEnabled) {
      const reviewDateInfos = getReviewDates(studyDates, endDate);
      reviewDays = reviewDateInfos.length;

      for (const reviewInfo of reviewDateInfos) {
        // 해당 주의 범위 및 원본 플랜 ID 수집
        let weekRangeStart = Infinity;
        let weekRangeEnd = 0;
        const sourcePlanIds: string[] = [];

        for (const planDate of reviewInfo.plansToReview) {
          const range = dateRangeMap.get(planDate.toISOString().split("T")[0]);
          if (range) {
            weekRangeStart = Math.min(weekRangeStart, range.start);
            weekRangeEnd = Math.max(weekRangeEnd, range.end);
            if (range.planId) {
              sourcePlanIds.push(range.planId);
            }
          }
        }

        if (weekRangeStart === Infinity) continue;

        // 각 복습 플랜에 고유한 review_group_id 생성
        const reviewGroupId = crypto.randomUUID();
        const reviewPlanId = crypto.randomUUID();
        const reviewDateStr = reviewInfo.date.toISOString().split("T")[0];

        plans.push({
          id: reviewPlanId,
          date: reviewDateStr,
          rangeStart: weekRangeStart,
          rangeEnd: weekRangeEnd,
          status: "pending",
          containerType: "daily",
          estimatedDuration: Math.ceil((weekRangeEnd - weekRangeStart + 1) * 2),
        });

        allPlansToInsert.push({
          plan_group_id: planGroup.id,
          tenant_id: tenantId,
          student_id: user.userId,
          plan_date: reviewDateStr,
          block_index: 0,
          content_type: input.content.type === "custom" ? "custom" : input.content.type,
          content_id: resolvedContentId,
          content_title: `[복습] ${input.content.name}`,
          content_subject: input.content.subject ?? null,
          content_subject_category: input.content.subjectCategory ?? null,
          planned_start_page_or_time: weekRangeStart,
          planned_end_page_or_time: weekRangeEnd,
          status: "pending",
          container_type: "daily",
          subject_type: "review",
          day_type: "review",
          review_group_id: reviewGroupId,
          review_source_content_ids: sourcePlanIds,
          is_active: true,
        });
      }
    }

    // 7c. 모든 플랜을 원자적으로 삽입
    const atomicResult = await generatePlansAtomic(
      planGroup.id,
      allPlansToInsert,
      undefined, // 상태 업데이트 불필요
      false // RLS 사용 (학생 권한)
    );

    if (!atomicResult.success) {
      logActionError({ domain: "plan", action: "createContentPlanGroup" }, new Error(atomicResult.error ?? "Unknown"), { step: "atomicPlans", planGroupId: planGroup.id });
      // 롤백: plan_contents와 plan_group 삭제
      await supabase.from("plan_contents").delete().eq("plan_group_id", planGroup.id);
      await supabase.from("plan_groups").delete().eq("id", planGroup.id);
      return { success: false, error: atomicResult.error ?? "플랜 생성에 실패했습니다." };
    }

    // 8. 캐시 재검증
    revalidatePath("/plan");
    revalidatePath("/today");

    const studyDaysCount = studyDates.length;
    return {
      success: true,
      planGroup: {
        ...planGroup,
        template_plan_group_id: input.templatePlanGroupId,
        study_type: input.studyType.type,
        strategy_days_per_week:
          input.studyType.type === "strategy"
            ? input.studyType.daysPerWeek ?? null
            : null,
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
    logActionError({ domain: "plan", action: "createContentPlanGroup" }, error, { templateId: input.templatePlanGroupId, contentId: input.content.id });
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

/**
 * 캘린더 전용 플랜그룹에 콘텐츠 추가
 */
export async function addContentToCalendarOnlyGroup(
  input: AddContentToCalendarOnlyInput
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
    // 1. 플랜 그룹 조회 및 검증
    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .select("*")
      .eq("id", input.planGroupId)
      .eq("student_id", user.userId)
      .is("deleted_at", null)
      .single();

    if (groupError || !planGroup) {
      return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
    }

    // 2. 기존 콘텐츠 확인
    const { data: existingContents } = await supabase
      .from("plan_contents")
      .select("id")
      .eq("plan_group_id", input.planGroupId);

    // 이미 콘텐츠가 있고 캘린더 전용이 아닌 경우 거부
    if (existingContents && existingContents.length > 0 && !planGroup.is_calendar_only) {
      return { success: false, error: "이미 콘텐츠가 있는 플랜 그룹입니다." };
    }

    // 3. 콘텐츠 확보 (소유권 검증 또는 마스터 콘텐츠 복사)
    const contentResult = await ensureStudentContent(
      supabase,
      input.content.masterContentId || input.content.id,
      input.content.type,
      user.userId,
      tenantId
    );
    if (!contentResult.success || !contentResult.studentContentId) {
      return { success: false, error: contentResult.error ?? "콘텐츠 접근 권한이 없습니다." };
    }
    const resolvedContentId = contentResult.studentContentId;

    // 4. 학습일 계산
    const startDate = new Date(planGroup.period_start);
    const endDate = new Date(planGroup.period_end);

    // 스케줄러 옵션에서 요일 가져오기
    const schedulerOptions = planGroup.scheduler_options as { weekdays?: number[] } | null;
    const weekdays = schedulerOptions?.weekdays ?? [1, 2, 3, 4, 5]; // 기본: 월-금

    // 제외일 조회
    const { data: exclusions } = await supabase
      .from("plan_exclusions")
      .select("date")
      .eq("plan_group_id", input.planGroupId);

    const studyDates = getAvailableStudyDates(
      startDate,
      endDate,
      weekdays,
      exclusions ?? [],
      input.studyType.type,
      input.studyType.daysPerWeek,
      input.studyType.preferredDays
    );

    if (studyDates.length === 0) {
      return {
        success: false,
        error: "선택한 기간에 학습 가능한 날짜가 없습니다.",
      };
    }

    // 5. plan_contents 생성
    const { error: pcError } = await supabase.from("plan_contents").insert({
      plan_group_id: input.planGroupId,
      tenant_id: tenantId,
      content_type: input.content.type === "custom" ? "custom" : input.content.type,
      content_id: resolvedContentId,
      content_name: input.content.name,
      start_range: input.range.start,
      end_range: input.range.end,
      subject_name: input.content.subject ?? null,
      subject_category: input.content.subjectCategory ?? null,
      display_order: 0,
    });

    if (pcError) {
      logActionError({ domain: "plan", action: "addContentToCalendarOnlyGroup" }, pcError, { step: "planContents", planGroupId: input.planGroupId });
      return { success: false, error: "콘텐츠 연결에 실패했습니다." };
    }

    // 6. student_plans 생성 (원자적 트랜잭션 사용)
    const totalAmount = input.range.end - input.range.start + 1;
    const dailyAmounts = distributeDailyAmounts(totalAmount, studyDates.length);

    const plans: GeneratedPlan[] = [];
    const allPlansToInsert: AtomicPlanPayload[] = [];
    let currentPosition = input.range.start;

    // 6a. 학습 플랜 준비
    const dateRangeMap = new Map<string, { start: number; end: number; planId: string }>();

    for (let index = 0; index < studyDates.length; index++) {
      const date = studyDates[index];
      const amount = dailyAmounts[index];
      const rangeStart = currentPosition;
      const rangeEnd = currentPosition + amount - 1;
      currentPosition += amount;

      const planId = crypto.randomUUID();
      const dateStr = date.toISOString().split("T")[0];

      dateRangeMap.set(dateStr, {
        start: rangeStart,
        end: rangeEnd,
        planId,
      });

      plans.push({
        id: planId,
        date: dateStr,
        rangeStart,
        rangeEnd,
        status: "pending",
        containerType: "daily",
        estimatedDuration: amount * 5,
      });

      allPlansToInsert.push({
        plan_group_id: input.planGroupId,
        tenant_id: tenantId,
        student_id: user.userId,
        plan_date: dateStr,
        block_index: 0,
        content_type: input.content.type === "custom" ? "custom" : input.content.type,
        content_id: resolvedContentId,
        content_title: input.content.name,
        content_subject: input.content.subject ?? null,
        content_subject_category: input.content.subjectCategory ?? null,
        planned_start_page_or_time: rangeStart,
        planned_end_page_or_time: rangeEnd,
        status: "pending",
        container_type: "daily",
        subject_type: input.studyType.type,
        is_active: true,
      });
    }

    // 6b. 복습 플랜 준비 (reviewEnabled인 경우)
    let reviewDays = 0;
    if (input.studyType.reviewEnabled) {
      const reviewDateInfos = getReviewDates(studyDates, endDate);
      reviewDays = reviewDateInfos.length;

      for (const reviewInfo of reviewDateInfos) {
        // 해당 주의 범위 및 원본 플랜 ID 수집
        let weekRangeStart = Infinity;
        let weekRangeEnd = 0;
        const sourcePlanIds: string[] = [];

        for (const planDate of reviewInfo.plansToReview) {
          const range = dateRangeMap.get(planDate.toISOString().split("T")[0]);
          if (range) {
            weekRangeStart = Math.min(weekRangeStart, range.start);
            weekRangeEnd = Math.max(weekRangeEnd, range.end);
            if (range.planId) {
              sourcePlanIds.push(range.planId);
            }
          }
        }

        if (weekRangeStart === Infinity) continue;

        // 각 복습 플랜에 고유한 review_group_id 생성
        const reviewGroupId = crypto.randomUUID();
        const reviewPlanId = crypto.randomUUID();
        const reviewDateStr = reviewInfo.date.toISOString().split("T")[0];

        plans.push({
          id: reviewPlanId,
          date: reviewDateStr,
          rangeStart: weekRangeStart,
          rangeEnd: weekRangeEnd,
          status: "pending",
          containerType: "daily",
          estimatedDuration: Math.ceil((weekRangeEnd - weekRangeStart + 1) * 2),
        });

        allPlansToInsert.push({
          plan_group_id: input.planGroupId,
          tenant_id: tenantId,
          student_id: user.userId,
          plan_date: reviewDateStr,
          block_index: 0,
          content_type: input.content.type === "custom" ? "custom" : input.content.type,
          content_id: resolvedContentId,
          content_title: `[복습] ${input.content.name}`,
          content_subject: input.content.subject ?? null,
          content_subject_category: input.content.subjectCategory ?? null,
          planned_start_page_or_time: weekRangeStart,
          planned_end_page_or_time: weekRangeEnd,
          status: "pending",
          container_type: "daily",
          subject_type: "review",
          day_type: "review",
          review_group_id: reviewGroupId,
          review_source_content_ids: sourcePlanIds,
          is_active: true,
        });
      }
    }

    // 6c. 모든 플랜을 원자적으로 삽입
    const atomicResult = await generatePlansAtomic(
      input.planGroupId,
      allPlansToInsert,
      undefined,
      false
    );

    if (!atomicResult.success) {
      logActionError({ domain: "plan", action: "addContentToCalendarOnlyGroup" }, new Error(atomicResult.error ?? "Unknown"), { step: "atomicPlans", planGroupId: input.planGroupId });
      // 롤백: plan_contents 삭제
      await supabase.from("plan_contents").delete().eq("plan_group_id", input.planGroupId);
      return { success: false, error: atomicResult.error ?? "플랜 생성에 실패했습니다." };
    }

    // 7. 플랜 그룹 업데이트 (캘린더 전용 해제 + 활성화)
    const { error: updateError } = await supabase
      .from("plan_groups")
      .update({
        is_calendar_only: false,
        content_status: "complete",
        status: "active", // 콘텐츠 추가 완료 시 활성화
        study_type: input.studyType.type,
        name: planGroup.name || input.content.name, // 이름이 없으면 콘텐츠 이름 사용
      })
      .eq("id", input.planGroupId);

    if (updateError) {
      logActionWarn({ domain: "plan", action: "addContentToCalendarOnlyGroup" }, "플랜 그룹 업데이트 실패", { planGroupId: input.planGroupId });
    }

    // 8. 캐시 재검증
    revalidatePath("/plan");
    revalidatePath("/today");
    revalidatePath(`/plan/group/${input.planGroupId}`);

    const studyDaysCount = studyDates.length;
    return {
      success: true,
      planGroup: {
        ...planGroup,
        template_plan_group_id: planGroup.id, // 캘린더 전용의 경우 자기 자신
        study_type: input.studyType.type,
        strategy_days_per_week: input.studyType.type === "strategy"
          ? input.studyType.daysPerWeek ?? null
          : null,
        creation_mode: "content_based" as const,
        is_calendar_only: false,
        content_status: "complete",
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
    logActionError({ domain: "plan", action: "addContentToCalendarOnlyGroup" }, error, { planGroupId: input.planGroupId, contentId: input.content.id });
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

/**
 * 기존 플랜 그룹에 추가 콘텐츠를 넣는 함수
 * addContentToCalendarOnlyGroup과 달리 is_calendar_only 여부와 관계없이
 * 최대 콘텐츠 수(10개)까지 추가 가능
 */
export async function addContentToExistingPlanGroup(
  input: AddContentToCalendarOnlyInput
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
    // 1. 플랜 그룹 조회 및 검증
    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .select("*")
      .eq("id", input.planGroupId)
      .eq("student_id", user.userId)
      .is("deleted_at", null)
      .single();

    if (groupError || !planGroup) {
      return { success: false, error: "플랜 그룹을 찾을 수 없습니다." };
    }

    // 2. 기존 콘텐츠 수 확인 (최대 10개 제한)
    const { data: existingContents, error: contentsError } = await supabase
      .from("plan_contents")
      .select("id, display_order")
      .eq("plan_group_id", input.planGroupId)
      .order("display_order", { ascending: false });

    if (contentsError) {
      return { success: false, error: "기존 콘텐츠 조회에 실패했습니다." };
    }

    const currentContentCount = existingContents?.length ?? 0;
    if (currentContentCount >= MAX_CONTENTS_PER_PLAN_GROUP) {
      return {
        success: false,
        error: `플랜 그룹당 최대 ${MAX_CONTENTS_PER_PLAN_GROUP}개의 콘텐츠만 추가할 수 있습니다.`,
      };
    }

    // 다음 display_order 계산
    const nextDisplayOrder = (existingContents?.[0]?.display_order ?? -1) + 1;

    // 3. 콘텐츠 확보 (소유권 검증 또는 마스터 콘텐츠 복사)
    const contentResult = await ensureStudentContent(
      supabase,
      input.content.masterContentId || input.content.id,
      input.content.type,
      user.userId,
      tenantId
    );
    if (!contentResult.success || !contentResult.studentContentId) {
      return { success: false, error: contentResult.error ?? "콘텐츠 접근 권한이 없습니다." };
    }
    const resolvedContentId = contentResult.studentContentId;

    // 4. 학습일 계산
    const startDate = new Date(planGroup.period_start);
    const endDate = new Date(planGroup.period_end);

    // 스케줄러 옵션에서 요일 가져오기
    const schedulerOptions = planGroup.scheduler_options as { weekdays?: number[] } | null;
    const weekdays = schedulerOptions?.weekdays ?? [1, 2, 3, 4, 5]; // 기본: 월-금

    // 제외일 조회
    const { data: exclusions } = await supabase
      .from("plan_exclusions")
      .select("date")
      .eq("plan_group_id", input.planGroupId);

    const studyDates = getAvailableStudyDates(
      startDate,
      endDate,
      weekdays,
      exclusions ?? [],
      input.studyType.type,
      input.studyType.daysPerWeek,
      input.studyType.preferredDays
    );

    if (studyDates.length === 0) {
      return {
        success: false,
        error: "선택한 기간에 학습 가능한 날짜가 없습니다.",
      };
    }

    // 5. plan_contents 생성 (display_order 증가)
    const { data: newContent, error: pcError } = await supabase
      .from("plan_contents")
      .insert({
        plan_group_id: input.planGroupId,
        tenant_id: tenantId,
        content_type: input.content.type === "custom" ? "custom" : input.content.type,
        content_id: resolvedContentId,
        content_name: input.content.name,
        start_range: input.range.start,
        end_range: input.range.end,
        subject_name: input.content.subject ?? null,
        subject_category: input.content.subjectCategory ?? null,
        display_order: nextDisplayOrder,
      })
      .select("id")
      .single();

    if (pcError || !newContent) {
      logActionError({ domain: "plan", action: "addContentToExistingPlanGroup" }, pcError, { step: "planContents", planGroupId: input.planGroupId });
      return { success: false, error: "콘텐츠 연결에 실패했습니다." };
    }

    // 6. student_plans 생성 (기존 플랜과 별도로 추가)
    const totalAmount = input.range.end - input.range.start + 1;
    const dailyAmounts = distributeDailyAmounts(totalAmount, studyDates.length);

    const plans: GeneratedPlan[] = [];
    const newPlansToInsert: AtomicPlanPayload[] = [];
    let currentPosition = input.range.start;

    // 6a. 학습 플랜 준비
    const dateRangeMap = new Map<string, { start: number; end: number; planId: string }>();

    for (let index = 0; index < studyDates.length; index++) {
      const date = studyDates[index];
      const amount = dailyAmounts[index];
      const rangeStart = currentPosition;
      const rangeEnd = currentPosition + amount - 1;
      currentPosition += amount;

      const planId = crypto.randomUUID();
      const dateStr = date.toISOString().split("T")[0];

      dateRangeMap.set(dateStr, {
        start: rangeStart,
        end: rangeEnd,
        planId,
      });

      plans.push({
        id: planId,
        date: dateStr,
        rangeStart,
        rangeEnd,
        status: "pending",
        containerType: "daily",
        estimatedDuration: amount * 5,
      });

      newPlansToInsert.push({
        plan_group_id: input.planGroupId,
        tenant_id: tenantId,
        student_id: user.userId,
        plan_date: dateStr,
        block_index: 0,
        content_type: input.content.type === "custom" ? "custom" : input.content.type,
        content_id: resolvedContentId,
        content_title: input.content.name,
        content_subject: input.content.subject ?? null,
        content_subject_category: input.content.subjectCategory ?? null,
        planned_start_page_or_time: rangeStart,
        planned_end_page_or_time: rangeEnd,
        status: "pending",
        container_type: "daily",
        subject_type: input.studyType.type,
        is_active: true,
      });
    }

    // 6b. 복습 플랜 준비 (reviewEnabled인 경우)
    let reviewDays = 0;
    if (input.studyType.reviewEnabled) {
      const reviewDateInfos = getReviewDates(studyDates, endDate);
      reviewDays = reviewDateInfos.length;

      for (const reviewInfo of reviewDateInfos) {
        // 해당 주의 범위 및 원본 플랜 ID 수집
        let weekRangeStart = Infinity;
        let weekRangeEnd = 0;
        const sourcePlanIds: string[] = [];

        for (const planDate of reviewInfo.plansToReview) {
          const range = dateRangeMap.get(planDate.toISOString().split("T")[0]);
          if (range) {
            weekRangeStart = Math.min(weekRangeStart, range.start);
            weekRangeEnd = Math.max(weekRangeEnd, range.end);
            if (range.planId) {
              sourcePlanIds.push(range.planId);
            }
          }
        }

        if (weekRangeStart === Infinity) continue;

        // 각 복습 플랜에 고유한 review_group_id 생성
        const reviewGroupId = crypto.randomUUID();
        const reviewPlanId = crypto.randomUUID();
        const reviewDateStr = reviewInfo.date.toISOString().split("T")[0];

        plans.push({
          id: reviewPlanId,
          date: reviewDateStr,
          rangeStart: weekRangeStart,
          rangeEnd: weekRangeEnd,
          status: "pending",
          containerType: "daily",
          estimatedDuration: Math.ceil((weekRangeEnd - weekRangeStart + 1) * 2),
        });

        newPlansToInsert.push({
          plan_group_id: input.planGroupId,
          tenant_id: tenantId,
          student_id: user.userId,
          plan_date: reviewDateStr,
          block_index: 0,
          content_type: input.content.type === "custom" ? "custom" : input.content.type,
          content_id: resolvedContentId,
          content_title: `[복습] ${input.content.name}`,
          content_subject: input.content.subject ?? null,
          content_subject_category: input.content.subjectCategory ?? null,
          planned_start_page_or_time: weekRangeStart,
          planned_end_page_or_time: weekRangeEnd,
          status: "pending",
          container_type: "daily",
          subject_type: "review",
          day_type: "review",
          review_group_id: reviewGroupId,
          review_source_content_ids: sourcePlanIds,
          is_active: true,
        });
      }
    }

    // 6c. 새 플랜만 삽입 (기존 플랜 유지, generatePlansAtomic 대신 직접 삽입)
    const { error: insertError } = await supabase
      .from("student_plan")
      .insert(newPlansToInsert);

    if (insertError) {
      logActionError({ domain: "plan", action: "addContentToExistingPlanGroup" }, insertError, { step: "plansInsertion", planGroupId: input.planGroupId });
      // 롤백: 새로 추가한 plan_contents 삭제
      await supabase.from("plan_contents").delete().eq("id", newContent.id);
      return { success: false, error: "플랜 생성에 실패했습니다." };
    }

    // 7. 플랜 그룹 업데이트 (캘린더 전용 해제 + 활성화)
    const { error: updateError } = await supabase
      .from("plan_groups")
      .update({
        is_calendar_only: false,
        content_status: "complete",
        status: "active",
      })
      .eq("id", input.planGroupId);

    if (updateError) {
      logActionWarn({ domain: "plan", action: "addContentToExistingPlanGroup" }, "플랜 그룹 업데이트 실패", { planGroupId: input.planGroupId });
    }

    // 8. 캐시 재검증
    revalidatePath("/plan");
    revalidatePath("/today");
    revalidatePath(`/plan/group/${input.planGroupId}`);

    const studyDaysCount = studyDates.length;
    return {
      success: true,
      planGroup: {
        ...planGroup,
        template_plan_group_id: planGroup.template_plan_group_id ?? planGroup.id,
        study_type: input.studyType.type,
        strategy_days_per_week: input.studyType.type === "strategy"
          ? input.studyType.daysPerWeek ?? null
          : null,
        creation_mode: "content_based" as const,
        is_calendar_only: false,
        content_status: "complete",
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
    logActionError({ domain: "plan", action: "addContentToExistingPlanGroup" }, error, { planGroupId: input.planGroupId, contentId: input.content.id });
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
