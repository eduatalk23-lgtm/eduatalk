"use server";

/**
 * Content-based PlanGroup Query Actions
 *
 * 플랜그룹 조회 관련 서버 액션
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AppError, ErrorCode } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ContentPlanGroupCount,
  InheritedTemplateSettings,
  GetTemplateSettingsParams,
  StudyType,
} from "@/lib/types/plan";
import type { PlanGroup } from "@/lib/types/plan";
import { MAX_CONTENT_PLAN_GROUPS, type PlanGroupSummary } from "./types";
import { getDefaultRecommendation } from "./helpers";

// ============================================
// Query Functions
// ============================================

/**
 * 콘텐츠 기반 플랜그룹 개수 조회
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

/**
 * 템플릿 플랜그룹 설정 조회
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

  // 학원 일정 조회 (요일 기반 → 날짜로 변환)
  // academy_schedules는 day_of_week (0=일, 1=월, ..., 6=토) 기반
  if (params.includeAcademySchedules && template.period_start && template.period_end) {
    const { data: academySchedules } = await supabase
      .from("academy_schedules")
      .select("day_of_week, academy_name")
      .eq("plan_group_id", params.templatePlanGroupId);

    if (academySchedules && academySchedules.length > 0) {
      // 학원 일정 요일들을 Set으로 변환
      const academyDaysOfWeek = new Set(academySchedules.map(s => s.day_of_week));

      // 기간 내 모든 날짜를 순회하며 학원 일정 요일에 해당하는 날짜를 exclusion에 추가
      const startDate = new Date(template.period_start);
      const endDate = new Date(template.period_end);
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); // 0=일, 1=월, ..., 6=토
        if (academyDaysOfWeek.has(dayOfWeek)) {
          const schedule = academySchedules.find(s => s.day_of_week === dayOfWeek);
          exclusions.push({
            date: currentDate.toISOString().split("T")[0],
            reason: schedule?.academy_name ? `${schedule.academy_name} 수업` : "학원 일정",
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
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

/**
 * 콘텐츠 기반 플랜그룹 목록 조회
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

/**
 * 완료 임박 플랜그룹 조회 (95% 이상 진행)
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

/**
 * AI 기반 스마트 스케줄 추천
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
