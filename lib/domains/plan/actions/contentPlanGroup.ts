"use server";

/**
 * Content-based PlanGroup Server Actions
 *
 * 콘텐츠별 플랜그룹 생성을 위한 4단계 간소화 플로우:
 * 1. 콘텐츠 선택
 * 2. 범위 설정
 * 3. 학습 유형 (전략/취약)
 * 4. 미리보기 및 생성
 *
 * 위저드 플랜그룹(템플릿)에서 설정을 상속받아 빠르게 생성합니다.
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AppError, ErrorCode } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CreateContentPlanGroupInput,
  ContentPlanGroupResult,
  ContentPlanGroupPreview,
  ContentPlanGroupCount,
  InheritedTemplateSettings,
  GetTemplateSettingsParams,
  PreviewContentPlanGroupParams,
  PlanPreviewItem,
  GeneratedPlan,
  StudyType,
} from "@/lib/types/plan";
import type { PlanGroup } from "@/lib/types/plan";

// ============================================
// Constants
// ============================================

const MAX_CONTENT_PLAN_GROUPS = 9;

// ============================================
// Helper Functions
// ============================================

/**
 * 학습 가능한 날짜 계산
 */
function getAvailableStudyDates(
  startDate: Date,
  endDate: Date,
  weekdays: number[],
  exclusions: Array<{ date: string }>,
  studyType: StudyType,
  strategyDaysPerWeek?: number,
  preferredDays?: number[]
): Date[] {
  const dates: Date[] = [];
  const exclusionSet = new Set(exclusions.map((e) => e.date));
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split("T")[0];

    // 해당 요일이 학습일이고 제외일이 아닌 경우
    if (weekdays.includes(dayOfWeek) && !exclusionSet.has(dateStr)) {
      dates.push(new Date(current));
    }

    current.setDate(current.getDate() + 1);
  }

  // 전략 과목인 경우: 주당 N일만 선택
  if (studyType === "strategy" && strategyDaysPerWeek) {
    return selectStrategyDates(dates, strategyDaysPerWeek, preferredDays);
  }

  return dates;
}

/**
 * 전략 과목용 날짜 선택 (주당 N일)
 * preferredDays가 지정되면 해당 요일 우선 선택
 */
function selectStrategyDates(
  allDates: Date[],
  daysPerWeek: number,
  preferredDays?: number[]
): Date[] {
  const weeklyDates = new Map<string, Date[]>();

  // 주별로 그룹화
  for (const date of allDates) {
    const weekKey = getWeekKey(date);
    if (!weeklyDates.has(weekKey)) {
      weeklyDates.set(weekKey, []);
    }
    weeklyDates.get(weekKey)!.push(date);
  }

  // 각 주에서 N일 선택
  const selectedDates: Date[] = [];
  for (const [, dates] of weeklyDates) {
    const count = Math.min(daysPerWeek, dates.length);

    if (preferredDays && preferredDays.length > 0) {
      // preferredDays가 지정된 경우: 해당 요일 우선 선택
      const preferredSet = new Set(preferredDays);
      const preferredMatches = dates.filter((d) =>
        preferredSet.has(d.getDay())
      );
      const otherDates = dates.filter((d) => !preferredSet.has(d.getDay()));

      // preferred에서 최대한 선택, 부족하면 다른 날짜에서 보충
      const selected = preferredMatches.slice(0, count);
      if (selected.length < count) {
        selected.push(...otherDates.slice(0, count - selected.length));
      }
      selectedDates.push(...selected.slice(0, count));
    } else {
      // preferredDays가 없으면 균등 분산
      const step = Math.floor(dates.length / count);
      for (let i = 0; i < count; i++) {
        selectedDates.push(dates[Math.min(i * step, dates.length - 1)]);
      }
    }
  }

  return selectedDates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * 주차 키 생성 (ISO week)
 */
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

/**
 * 일별 분량 분배
 */
function distributeDailyAmounts(
  totalAmount: number,
  studyDays: number
): number[] {
  const baseAmount = Math.floor(totalAmount / studyDays);
  const remainder = totalAmount % studyDays;
  const amounts: number[] = [];

  for (let i = 0; i < studyDays; i++) {
    // 나머지는 앞쪽 날짜에 분배
    amounts.push(baseAmount + (i < remainder ? 1 : 0));
  }

  return amounts;
}

// ============================================
// Content PlanGroup Count
// ============================================

/**
 * 현재 활성 콘텐츠별 플랜그룹 개수 조회
 */
export async function getContentPlanGroupCount(): Promise<ContentPlanGroupCount> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("plan_groups")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user.userId)
    .eq("creation_mode", "content_based")
    .eq("status", "active")
    .is("deleted_at", null);

  if (error) {
    throw new AppError(
      "플랜그룹 개수 조회 실패",
      ErrorCode.DATABASE_ERROR,
      500,
      false
    );
  }

  const current = count ?? 0;

  return {
    current,
    max: MAX_CONTENT_PLAN_GROUPS,
    canAdd: current < MAX_CONTENT_PLAN_GROUPS,
    remaining: MAX_CONTENT_PLAN_GROUPS - current,
  };
}

// ============================================
// Template Settings
// ============================================

/**
 * 템플릿(위저드 플랜그룹)에서 상속할 설정 조회
 */
export async function getTemplateSettings(
  params: GetTemplateSettingsParams
): Promise<InheritedTemplateSettings | null> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const supabase = await createSupabaseServerClient();

  // 템플릿 플랜그룹 조회
  const { data: template, error } = await supabase
    .from("plan_groups")
    .select("*")
    .eq("id", params.templatePlanGroupId)
    .eq("student_id", user.userId)
    .is("deleted_at", null)
    .single();

  if (error || !template) {
    return null;
  }

  // 제외일 조회
  let exclusions: Array<{ date: string; reason: string }> = [];
  if (params.includeExclusions) {
    const { data: exclusionData } = await supabase
      .from("plan_exclusions")
      .select("exclusion_date, reason")
      .eq("plan_group_id", params.templatePlanGroupId);

    exclusions =
      exclusionData?.map((e) => ({
        date: e.exclusion_date,
        reason: e.reason ?? "",
      })) ?? [];
  }

  // 학원 일정 조회
  if (params.includeAcademySchedules) {
    const { data: academySchedules } = await supabase
      .from("academy_schedules")
      .select("schedule_date")
      .eq("plan_group_id", params.templatePlanGroupId);

    if (academySchedules) {
      for (const schedule of academySchedules) {
        exclusions.push({
          date: schedule.schedule_date,
          reason: "학원 일정",
        });
      }
    }
  }

  // 학습 요일 파싱 (scheduler_options에서)
  const schedulerOptions = template.scheduler_options as Record<
    string,
    unknown
  > | null;
  const weekdays =
    (schedulerOptions?.weekdays as number[]) ?? [1, 2, 3, 4, 5]; // 기본: 월-금

  return {
    period: {
      startDate: template.period_start,
      endDate: template.period_end,
    },
    weekdays,
    blockSetId: template.block_set_id,
    studyHours: template.study_hours,
    selfStudyHours: template.self_study_hours,
    exclusions,
    schedulerOptions: template.scheduler_options as InheritedTemplateSettings["schedulerOptions"],
  };
}

// ============================================
// Preview
// ============================================

/**
 * 콘텐츠별 플랜그룹 미리보기 생성
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

/**
 * ISO 주차 번호 계산
 */
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * 복습 날짜 계산 (매주 토요일)
 */
function getReviewDates(
  studyDates: Date[],
  endDate: Date
): { date: Date; weekNumber: number; plansToReview: Date[] }[] {
  if (studyDates.length === 0) return [];

  const reviewDates: { date: Date; weekNumber: number; plansToReview: Date[] }[] = [];
  const weeklyPlans = new Map<number, Date[]>();

  // 주차별로 학습일 그룹화
  for (const date of studyDates) {
    const weekNum = getWeekNumber(date);
    if (!weeklyPlans.has(weekNum)) {
      weeklyPlans.set(weekNum, []);
    }
    weeklyPlans.get(weekNum)!.push(date);
  }

  // 각 주의 토요일 (또는 마지막 학습일 다음 토요일)
  for (const [weekNum, plans] of weeklyPlans) {
    if (plans.length === 0) continue;

    // 해당 주의 마지막 학습일을 기준으로 토요일 찾기
    const lastPlan = plans[plans.length - 1];
    const dayOfWeek = lastPlan.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7; // 토요일이면 다음주 토요일

    const reviewDate = new Date(lastPlan);
    reviewDate.setDate(reviewDate.getDate() + daysUntilSaturday);

    // 종료일 이전이어야 함
    if (reviewDate <= endDate) {
      reviewDates.push({
        date: reviewDate,
        weekNumber: weekNum,
        plansToReview: plans,
      });
    }
  }

  return reviewDates.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ============================================
// Create Content PlanGroup
// ============================================

/**
 * 콘텐츠별 플랜그룹 생성
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
      content_id: input.content.id,
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
        content_id: input.content.id,
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
      const endDate = new Date(period.endDate);
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
          content_id: input.content.id,
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

// ============================================
// Get Content PlanGroups
// ============================================

/**
 * 콘텐츠별 플랜그룹 목록 조회
 */
export async function getContentPlanGroups(
  templateId?: string
): Promise<PlanGroup[]> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("plan_groups")
    .select("*")
    .eq("student_id", user.userId)
    .eq("creation_mode", "content_based")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (templateId) {
    query = query.eq("template_plan_group_id", templateId);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError(
      "플랜그룹 목록 조회 실패",
      ErrorCode.DATABASE_ERROR,
      500,
      false
    );
  }

  return (data ?? []) as PlanGroup[];
}

/**
 * 템플릿(위저드) 플랜그룹 목록 조회
 */
export async function getTemplatePlanGroups(): Promise<PlanGroup[]> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("plan_groups")
    .select("*")
    .eq("student_id", user.userId)
    .eq("status", "active")
    .or("creation_mode.is.null,creation_mode.eq.wizard")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError(
      "템플릿 목록 조회 실패",
      ErrorCode.DATABASE_ERROR,
      500,
      false
    );
  }

  return (data ?? []) as PlanGroup[];
}

// ============================================
// Near Completion PlanGroups
// ============================================

type PlanGroupSummary = {
  id: string;
  name: string;
  progressPercent: number;
  canComplete: boolean;
};

/**
 * 완료에 가까운 플랜그룹 목록 조회 (95% 이상 진행)
 */
export async function getNearCompletionPlanGroups(): Promise<PlanGroupSummary[]> {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // 활성 content_based 플랜그룹 조회
  const { data: planGroups, error: pgError } = await supabase
    .from("plan_groups")
    .select("id, name")
    .eq("student_id", user.userId)
    .eq("creation_mode", "content_based")
    .eq("status", "active")
    .is("deleted_at", null);

  if (pgError || !planGroups) {
    return [];
  }

  const results: PlanGroupSummary[] = [];

  for (const pg of planGroups) {
    // 해당 플랜그룹의 플랜 진행률 조회
    const { data: plans } = await supabase
      .from("student_plan")
      .select("status")
      .eq("plan_group_id", pg.id)
      .eq("is_active", true);

    if (!plans || plans.length === 0) continue;

    const total = plans.length;
    const completed = plans.filter((p) => p.status === "completed").length;
    const progressPercent = Math.round((completed / total) * 100);

    if (progressPercent >= 95) {
      results.push({
        id: pg.id,
        name: pg.name ?? "이름 없음",
        progressPercent,
        canComplete: true,
      });
    }
  }

  // 진행률 높은 순으로 정렬
  return results.sort((a, b) => b.progressPercent - a.progressPercent);
}

// ============================================
// Quick Create (Content-First Approach)
// ============================================

/**
 * 빠른 플랜 생성 입력 타입
 * 템플릿 없이 콘텐츠에서 직접 플랜 생성
 */
export type QuickCreateInput = {
  content: {
    type: "book" | "lecture" | "custom";
    id: string;
    name: string;
    subject?: string;
    subjectCategory?: string;
    totalUnits?: number; // 총 페이지/회차
  };
  range: {
    start: number;
    end: number;
    unit: "page" | "episode" | "chapter" | "unit";
  };
  schedule: {
    startDate: string;
    endDate: string;
    weekdays: number[]; // 0-6 (일-토)
    studyType: StudyType;
    reviewEnabled?: boolean;
  };
};

/**
 * 빠른 플랜 생성 (템플릿 없이)
 *
 * 콘텐츠 우선 접근법: 사용자가 콘텐츠를 선택하고
 * 간단한 스케줄 설정만으로 플랜을 빠르게 생성합니다.
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
      content_id: input.content.id,
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
        content_id: input.content.id,
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
            content_id: input.content.id,
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
 * 콘텐츠 기반 스마트 추천 스케줄 계산
 *
 * 콘텐츠 분량과 사용자 학습 패턴을 분석하여
 * 적절한 학습 일정을 추천합니다.
 */
export async function getSmartScheduleRecommendation(
  contentId: string,
  totalUnits: number,
  unitType: "page" | "episode" | "chapter"
): Promise<{
  recommendedDuration: number; // 총 학습 기간 (일)
  recommendedDailyAmount: number;
  recommendedWeekdays: number[];
  studyType: StudyType;
  estimatedEndDate: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    // 기본 추천
    return getDefaultRecommendation(totalUnits, unitType);
  }

  const supabase = await createSupabaseServerClient();

  // 사용자의 과거 학습 패턴 분석
  const { data: pastPlans } = await supabase
    .from("student_plan")
    .select("plan_date, planned_start_page_or_time, planned_end_page_or_time, status")
    .eq("student_id", user.userId)
    .eq("status", "completed")
    .order("plan_date", { ascending: false })
    .limit(100);

  if (!pastPlans || pastPlans.length < 10) {
    // 데이터 부족 - 기본 추천
    return getDefaultRecommendation(totalUnits, unitType);
  }

  // 일일 평균 학습량 계산
  let totalDailyAmount = 0;
  let planCount = 0;
  const weekdayFrequency = new Map<number, number>();

  for (const plan of pastPlans) {
    const start = plan.planned_start_page_or_time ?? 0;
    const end = plan.planned_end_page_or_time ?? 0;
    const amount = end - start + 1;

    if (amount > 0) {
      totalDailyAmount += amount;
      planCount++;
    }

    // 요일 빈도
    const dayOfWeek = new Date(plan.plan_date).getDay();
    weekdayFrequency.set(dayOfWeek, (weekdayFrequency.get(dayOfWeek) ?? 0) + 1);
  }

  const avgDailyAmount = planCount > 0 ? Math.ceil(totalDailyAmount / planCount) : 10;

  // 가장 자주 학습하는 요일 선택 (상위 5개)
  const sortedWeekdays = Array.from(weekdayFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([day]) => day);

  const recommendedWeekdays = sortedWeekdays.length >= 3 ? sortedWeekdays : [1, 2, 3, 4, 5];

  // 추천 기간 계산
  const daysPerWeek = recommendedWeekdays.length;
  const totalStudyDays = Math.ceil(totalUnits / avgDailyAmount);
  const totalWeeks = Math.ceil(totalStudyDays / daysPerWeek);
  const recommendedDuration = totalWeeks * 7;

  const today = new Date();
  const estimatedEnd = new Date(today);
  estimatedEnd.setDate(estimatedEnd.getDate() + recommendedDuration);

  return {
    recommendedDuration,
    recommendedDailyAmount: avgDailyAmount,
    recommendedWeekdays,
    studyType: totalUnits > 100 ? "strategy" : "weakness",
    estimatedEndDate: estimatedEnd.toISOString().split("T")[0],
    confidence: pastPlans.length > 50 ? "high" : "medium",
    reasoning:
      pastPlans.length > 50
        ? `과거 ${pastPlans.length}개 학습 기록 분석: 일평균 ${avgDailyAmount}단위`
        : `${pastPlans.length}개 학습 기록 기반 추천`,
  };
}

/**
 * 기본 추천 (학습 기록 부족 시)
 */
function getDefaultRecommendation(
  totalUnits: number,
  unitType: "page" | "episode" | "chapter"
): {
  recommendedDuration: number;
  recommendedDailyAmount: number;
  recommendedWeekdays: number[];
  studyType: StudyType;
  estimatedEndDate: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
} {
  // 단위 타입별 기본 일일 학습량
  const defaultAmounts: Record<typeof unitType, number> = {
    page: 20,
    episode: 2,
    chapter: 1,
  };

  const dailyAmount = defaultAmounts[unitType];
  const totalStudyDays = Math.ceil(totalUnits / dailyAmount);
  const totalWeeks = Math.ceil(totalStudyDays / 5); // 주 5일 기준
  const recommendedDuration = totalWeeks * 7;

  const today = new Date();
  const estimatedEnd = new Date(today);
  estimatedEnd.setDate(estimatedEnd.getDate() + recommendedDuration);

  return {
    recommendedDuration,
    recommendedDailyAmount: dailyAmount,
    recommendedWeekdays: [1, 2, 3, 4, 5], // 월-금
    studyType: totalUnits > 100 ? "strategy" : "weakness",
    estimatedEndDate: estimatedEnd.toISOString().split("T")[0],
    confidence: "low",
    reasoning: `기본 추천: ${unitType === "page" ? "페이지" : unitType === "episode" ? "회차" : "챕터"}당 일일 ${dailyAmount}${unitType === "page" ? "페이지" : "단위"}`,
  };
}
