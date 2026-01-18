/**
 * 학습 패턴 관련 데이터 로더
 *
 * - loadLearningPattern: 학습 패턴 + 30일 통계 조회
 *
 * @module loaders/patternLoader
 */

import type { SupabaseClient } from "./types";
import type { LearningPatternInfo } from "../prompts/contentRecommendation";

/**
 * 학습 패턴 및 30일 통계 조회
 */
export async function loadLearningPattern(
  supabase: SupabaseClient,
  studentId: string
): Promise<LearningPatternInfo | undefined> {
  // 학습 패턴 데이터 조회
  const { data: pattern } = await supabase
    .from("student_learning_patterns")
    .select("preferred_study_times, strong_days, weak_days")
    .eq("student_id", studentId)
    .single();

  // 최근 30일 통계 계산
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: plans } = await supabase
    .from("student_plan")
    .select("status, progress, estimated_minutes")
    .eq("student_id", studentId)
    .gte("plan_date", thirtyDaysAgo.toISOString().split("T")[0]);

  if (!plans || plans.length === 0) {
    return pattern
      ? {
          preferredStudyTimes: pattern.preferred_study_times ?? undefined,
        }
      : undefined;
  }

  const completed = plans.filter((p) => p.status === "completed").length;
  const completionRate = Math.round((completed / plans.length) * 100);
  const avgMinutes = Math.round(
    plans.reduce((sum, p) => sum + (p.estimated_minutes || 0), 0) / 30
  );

  return {
    preferredStudyTimes: pattern?.preferred_study_times ?? undefined,
    averageDailyMinutes: avgMinutes,
    completionRate,
  };
}
