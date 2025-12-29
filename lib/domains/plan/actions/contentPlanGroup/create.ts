"use server";

/**
 * Content-based PlanGroup Creation Actions
 *
 * 콘텐츠 기반 플랜그룹 생성 관련 서버 액션
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AppError, ErrorCode } from "@/lib/errors";
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
import { MAX_CONTENT_PLAN_GROUPS, type AddContentToCalendarOnlyInput } from "./types";
import {
  getAvailableStudyDates,
  getReviewDates,
  getWeekNumber,
  distributeDailyAmounts,
} from "./helpers";
import { getContentPlanGroupCount, getTemplateSettings } from "./queries";

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
// Preview Functions
// ============================================

/**
 * 콘텐츠 기반 플랜그룹 미리보기 생성
 */
export async function previewContentPlanGroup(
  params: PreviewContentPlanGroupParams
): Promise<ContentPlanGroupPreview> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // 템플릿 설정 조회
  const templateSettings = await getTemplateSettings({
    templatePlanGroupId: params.templatePlanGroupId,
    includeExclusions: true,
    includeAcademySchedules: true,
  });

  if (!templateSettings) {
    throw new AppError(
      "템플릿을 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
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
  };
}

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
      user.tenantId ?? ""
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
    const { data: planGroup, error: pgError } = await supabase
      .from("plan_groups")
      .insert({
        tenant_id: user.tenantId,
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
        scheduler_options: {
          ...templateSettings.schedulerOptions,
          weekdays,
        },
        study_hours: templateSettings.studyHours,
        self_study_hours: templateSettings.selfStudyHours,
      })
      .select()
      .single();

    if (pgError || !planGroup) {
      console.error("Plan group creation error:", pgError);
      return { success: false, error: "플랜그룹 생성에 실패했습니다." };
    }

    // 6. plan_contents 생성
    const { error: pcError } = await supabase.from("plan_contents").insert({
      plan_group_id: planGroup.id,
      content_type: input.content.type === "custom" ? "custom" : input.content.type,
      content_id: resolvedContentId,
      content_name: input.content.name,
      start_page_or_time: input.range.start,
      end_page_or_time: input.range.end,
      subject_name: input.content.subject ?? null,
      subject_category: input.content.subjectCategory ?? null,
    });

    if (pcError) {
      console.error("Plan content creation error:", pcError);
      // 롤백: 플랜그룹 삭제
      await supabase.from("plan_groups").delete().eq("id", planGroup.id);
      return { success: false, error: "콘텐츠 연결에 실패했습니다." };
    }

    // 7. student_plans 생성 (독에 배치)
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
        block_index: 0, // 독에서 정렬
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
      };
    });

    const { error: spError } = await supabase
      .from("student_plan")
      .insert(studentPlansToInsert);

    if (spError) {
      console.error("Student plans creation error:", spError);
      // 롤백
      await supabase.from("plan_contents").delete().eq("plan_group_id", planGroup.id);
      await supabase.from("plan_groups").delete().eq("id", planGroup.id);
      return { success: false, error: "플랜 생성에 실패했습니다." };
    }

    // 7b. 복습 플랜 생성 (reviewEnabled인 경우)
    let reviewDays = 0;
    if (input.studyType.reviewEnabled) {
      const reviewDateInfos = getReviewDates(studyDates, endDate);
      reviewDays = reviewDateInfos.length;

      // 날짜별 범위 매핑
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

      const reviewPlansToInsert = reviewDateInfos.map((reviewInfo) => {
        // 해당 주의 범위 계산
        let weekRangeStart = Infinity;
        let weekRangeEnd = 0;
        for (const planDate of reviewInfo.plansToReview) {
          const range = dateRangeMap.get(planDate.toISOString().split("T")[0]);
          if (range) {
            weekRangeStart = Math.min(weekRangeStart, range.start);
            weekRangeEnd = Math.max(weekRangeEnd, range.end);
          }
        }

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
          content_type: input.content.type === "custom" ? "custom" : input.content.type,
          content_id: resolvedContentId,
          content_title: `[복습] ${input.content.name}`,
          content_subject: input.content.subject ?? null,
          content_subject_category: input.content.subjectCategory ?? null,
          planned_start_page_or_time: weekRangeStart,
          planned_end_page_or_time: weekRangeEnd,
          status: "pending",
          container_type: "daily",
          subject_type: "review", // 복습 타입
          is_active: true,
        };
      });

      if (reviewPlansToInsert.length > 0) {
        const { error: rpError } = await supabase
          .from("student_plan")
          .insert(reviewPlansToInsert);

        if (rpError) {
          console.error("Review plans creation error:", rpError);
          // 복습 플랜 생성 실패는 경고만 (전체 롤백하지 않음)
        }
      }
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
    console.error("Create content plan group error:", error);
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
      user.tenantId ?? ""
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
      content_type: input.content.type === "custom" ? "custom" : input.content.type,
      content_id: resolvedContentId,
      content_name: input.content.name,
      start_page_or_time: input.range.start,
      end_page_or_time: input.range.end,
      subject_name: input.content.subject ?? null,
      subject_category: input.content.subjectCategory ?? null,
    });

    if (pcError) {
      console.error("Plan content creation error:", pcError);
      return { success: false, error: "콘텐츠 연결에 실패했습니다." };
    }

    // 6. student_plans 생성
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
        plan_group_id: input.planGroupId,
        plan_date: date.toISOString().split("T")[0],
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
      };
    });

    const { error: spError } = await supabase
      .from("student_plan")
      .insert(studentPlansToInsert);

    if (spError) {
      console.error("Student plans creation error:", spError);
      // 롤백
      await supabase.from("plan_contents").delete().eq("plan_group_id", input.planGroupId);
      return { success: false, error: "플랜 생성에 실패했습니다." };
    }

    // 7. 복습 플랜 생성 (reviewEnabled인 경우)
    let reviewDays = 0;
    if (input.studyType.reviewEnabled) {
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
            plan_group_id: input.planGroupId,
            plan_date: reviewInfo.date.toISOString().split("T")[0],
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
            is_active: true,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (reviewPlansToInsert.length > 0) {
        const { error: rpError } = await supabase
          .from("student_plan")
          .insert(reviewPlansToInsert);

        if (rpError) {
          console.error("Review plans creation error:", rpError);
        }
      }
    }

    // 8. 플랜 그룹 업데이트 (캘린더 전용 해제)
    const { error: updateError } = await supabase
      .from("plan_groups")
      .update({
        is_calendar_only: false,
        content_status: "complete",
        study_type: input.studyType.type,
        name: planGroup.name || input.content.name, // 이름이 없으면 콘텐츠 이름 사용
      })
      .eq("id", input.planGroupId);

    if (updateError) {
      console.error("Plan group update error:", updateError);
    }

    // 9. 캐시 재검증
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
    console.error("Add content to calendar-only group error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
