/**
 * 적응형 스케줄 분석 액션
 *
 * 학습 패턴을 분석하고 스케줄 조정 권장사항을 생성합니다.
 *
 * @module lib/domains/plan/actions/plan-groups/adaptiveAnalysis
 */

"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  analyzeAdaptiveSchedule,
  analyzeGroupSchedule,
  generateStudentReinforcement,
  type AdaptiveScheduleAnalysis,
  type WeakSubjectReinforcementPlan,
} from "@/lib/domains/plan/services/adaptiveScheduler";
import { logActionError } from "@/lib/logging/actionLogger";

/**
 * 학생의 적응형 스케줄 분석 결과
 */
export type AdaptiveAnalysisResult = {
  success: boolean;
  data?: AdaptiveScheduleAnalysis;
  error?: string;
};

/**
 * 학생의 학습 패턴을 분석하고 스케줄 조정 권장사항을 생성합니다.
 *
 * @param studentId 학생 ID
 * @param daysBack 분석할 과거 일수 (기본값: 30일)
 * @returns 적응형 스케줄 분석 결과
 */
export async function getAdaptiveScheduleAnalysis(
  studentId: string,
  daysBack: number = 30
): Promise<AdaptiveAnalysisResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const analysis = await analyzeAdaptiveSchedule(supabase, studentId, daysBack);

    return {
      success: true,
      data: analysis,
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "getAdaptiveScheduleAnalysis" },
      error,
      { studentId, daysBack }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "분석에 실패했습니다.",
    };
  }
}

/**
 * 특정 플랜 그룹의 학습 패턴을 분석합니다.
 *
 * @param planGroupId 플랜 그룹 ID
 * @returns 적응형 스케줄 분석 결과
 */
export async function getGroupScheduleAnalysis(
  planGroupId: string
): Promise<AdaptiveAnalysisResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const analysis = await analyzeGroupSchedule(supabase, planGroupId);

    return {
      success: true,
      data: analysis,
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "getGroupScheduleAnalysis" },
      error,
      { planGroupId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "분석에 실패했습니다.",
    };
  }
}

/**
 * 취약 과목 강화 스케줄 결과
 */
export type ReinforcementPlanResult = {
  success: boolean;
  data?: WeakSubjectReinforcementPlan;
  error?: string;
};

/**
 * 학생의 취약 과목 강화 스케줄을 생성합니다.
 *
 * @param studentId 학생 ID
 * @param daysBack 분석할 과거 일수 (기본값: 30일)
 * @param targetCompletionRate 목표 완료율 (기본값: 80%)
 * @returns 취약 과목 강화 스케줄 계획
 */
export async function getWeakSubjectReinforcement(
  studentId: string,
  daysBack: number = 30,
  targetCompletionRate: number = 80
): Promise<ReinforcementPlanResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const plan = await generateStudentReinforcement(
      supabase,
      studentId,
      daysBack,
      targetCompletionRate
    );

    return {
      success: true,
      data: plan,
    };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "getWeakSubjectReinforcement" },
      error,
      { studentId, daysBack, targetCompletionRate }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "강화 스케줄 생성에 실패했습니다.",
    };
  }
}
