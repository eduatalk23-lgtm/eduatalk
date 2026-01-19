"use server";

/**
 * Planner Auto-Create Action
 *
 * 학생의 기본 플래너를 자동으로 생성하거나 기존 플래너를 반환합니다.
 * Phase 3.1: 여러 콘텐츠 → 여러 plan_group 생성을 위해 Planner 필수화
 *
 * @module lib/domains/plan/actions/planners/autoCreate
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAuthContext } from "@/lib/auth/strategies";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import type { TimeRange } from "@/lib/types/plan/domain";

// ============================================
// 타입 정의
// ============================================

/**
 * Planner 기본 상태
 */
type PlannerStatus = "draft" | "active" | "paused" | "archived" | "completed";

/**
 * 기본 플래너 반환 결과
 */
export interface GetOrCreateDefaultPlannerResult {
  plannerId: string;
  isNew: boolean;
  plannerName: string;
}

/**
 * 기본 플래너 생성 옵션
 */
export interface CreateDefaultPlannerOptions {
  /** 관리자 모드일 때 대상 학생 ID */
  studentId?: string;
  /** 기간 시작일 (기본값: 오늘) */
  periodStart?: string;
  /** 기간 종료일 (기본값: 3개월 후) */
  periodEnd?: string;
  /** 플래너 이름 (기본값: "기본 플래너") */
  name?: string;
}

// ============================================
// 내부 함수
// ============================================

/**
 * 학생의 기본(활성) 플래너를 조회합니다.
 */
async function _findDefaultPlanner(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  studentId: string
): Promise<{ id: string; name: string } | null> {
  // 가장 최근의 active 또는 draft 플래너를 찾음
  const { data, error } = await supabase
    .from("planners")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(
      `기본 플래너 조회 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return data ? { id: data.id, name: data.name } : null;
}

/**
 * 기본 플래너를 생성합니다.
 */
async function _createDefaultPlanner(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  studentId: string,
  userId: string,
  options: CreateDefaultPlannerOptions
): Promise<{ id: string; name: string }> {
  // 기본 기간 설정: 오늘부터 3개월
  const today = new Date();
  const threeMonthsLater = new Date(today);
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

  const periodStart =
    options.periodStart || today.toISOString().split("T")[0];
  const periodEnd =
    options.periodEnd || threeMonthsLater.toISOString().split("T")[0];
  const plannerName = options.name || "기본 플래너";

  // 기본 시간 설정
  const defaultStudyHours: TimeRange = { start: "10:00", end: "19:00" };
  const defaultSelfStudyHours: TimeRange = { start: "19:00", end: "22:00" };
  const defaultLunchTime: TimeRange = { start: "12:00", end: "13:00" };

  const { data, error } = await supabase
    .from("planners")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      name: plannerName,
      description: "자동 생성된 기본 플래너입니다.",
      period_start: periodStart,
      period_end: periodEnd,
      study_hours: defaultStudyHours,
      self_study_hours: defaultSelfStudyHours,
      lunch_time: defaultLunchTime,
      non_study_time_blocks: [],
      default_scheduler_type: "1730_timetable",
      default_scheduler_options: {
        study_days: 6,
        review_days: 1,
      },
      status: "active" as PlannerStatus,
      created_by: userId,
    })
    .select("id, name")
    .single();

  if (error) {
    throw new AppError(
      `기본 플래너 생성 실패: ${error.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  return { id: data.id, name: data.name };
}

/**
 * 기본 플래너를 가져오거나 생성합니다.
 *
 * 학생에게 active/draft 플래너가 없으면 자동으로 생성합니다.
 */
async function _getOrCreateDefaultPlanner(
  options: CreateDefaultPlannerOptions = {}
): Promise<GetOrCreateDefaultPlannerResult> {
  const auth = await resolveAuthContext({ studentId: options.studentId });
  const supabase = await createSupabaseServerClient();

  const targetStudentId = auth.studentId;
  const tenantId = auth.tenantId;
  const userId = auth.userId;

  // 1. 기존 기본 플래너 조회
  const existingPlanner = await _findDefaultPlanner(
    supabase,
    tenantId,
    targetStudentId
  );

  if (existingPlanner) {
    return {
      plannerId: existingPlanner.id,
      isNew: false,
      plannerName: existingPlanner.name,
    };
  }

  // 2. 새 플래너 생성
  const newPlanner = await _createDefaultPlanner(
    supabase,
    tenantId,
    targetStudentId,
    userId,
    options
  );

  return {
    plannerId: newPlanner.id,
    isNew: true,
    plannerName: newPlanner.name,
  };
}

// ============================================
// Public API
// ============================================

/**
 * 기본 플래너를 가져오거나 생성합니다.
 *
 * 학생에게 active/draft 플래너가 없으면 자동으로 생성합니다.
 * 학생 모드와 관리자 모드 모두 지원합니다.
 *
 * @param options 생성 옵션
 * @returns 플래너 ID, 신규 생성 여부, 플래너 이름
 *
 * @example
 * // 학생 모드: 자신의 플래너
 * const result = await getOrCreateDefaultPlannerAction();
 *
 * // 관리자 모드: 특정 학생의 플래너
 * const result = await getOrCreateDefaultPlannerAction({ studentId: "student-123" });
 */
export const getOrCreateDefaultPlannerAction = withErrorHandling(
  _getOrCreateDefaultPlanner
);
