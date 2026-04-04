/**
 * 레벨링 시스템 — 파이프라인 통합 진입점
 *
 * 사용법:
 *   const leveling = await computeLevelingForStudent({ studentId, tenantId, grade });
 *   // leveling.adequateLevel → P7 프롬프트 난이도
 *   // leveling.levelDirective → P7 시스템 프롬프트 주입 텍스트
 */

export { computeAdequateLevel, gpaToLevel, gpaToInferredTier, tierToExpectedLevel } from "./engine";
export { resolveSchoolTier } from "./resolve-tier";
export type {
  DifficultyLevel,
  LevelingInput,
  LevelingResult,
  LevelingForStudentInput,
} from "./types";
export { DIFFICULTY_LABELS } from "./types";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateAverageGrade } from "@/lib/domains/score/service";
import { computeAdequateLevel, gpaToLevel } from "./engine";
import { resolveSchoolTier } from "./resolve-tier";
import type { DifficultyLevel, LevelingForStudentInput, LevelingResult } from "./types";

/** competency grade → 숫자 점수 (A+=6, A-=5, B+=4, B=3, B-=2, C=1) */
const GRADE_TO_SCORE: Record<string, number> = {
  "A+": 6, "A-": 5, "B+": 4, "B": 3, "B-": 2, "C": 1,
};

/** projected scores 평균 → 현재 레벨 산출 */
function scoresToCurrentLevel(
  scores: Array<{ grade_value: string | null }>,
): DifficultyLevel | null {
  const nums = scores
    .map((s) => GRADE_TO_SCORE[s.grade_value as string] ?? 0)
    .filter((n) => n > 0);
  if (nums.length === 0) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  // 6~5 → L5, 4~5 → L4, 3~4 → L3, 2~3 → L2, else L1
  if (avg >= 5) return 5;
  if (avg >= 4) return 4;
  if (avg >= 3) return 3;
  if (avg >= 2) return 2;
  return 1;
}

/**
 * 파이프라인에서 한 줄로 호출하는 통합 함수
 *
 * 1. students.target_school_tier 조회
 * 2. 내신 평균 등급 조회
 * 3. 폴백 체인으로 학교권 해석
 * 4. projected scores에서 현재 레벨 산출
 * 5. 엔진 실행 → LevelingResult 반환
 */
export async function computeLevelingForStudent(
  input: LevelingForStudentInput,
): Promise<LevelingResult> {
  const { studentId, tenantId, grade } = input;

  // 1. target_school_tier 조회
  const supabase = await createSupabaseServerClient();
  const { data: studentRow } = await supabase
    .from("students")
    .select("target_school_tier")
    .eq("id", studentId)
    .maybeSingle();

  const explicitTier = studentRow?.target_school_tier ?? null;

  // 2. 내신 평균 등급 조회
  const { schoolAvg } = await calculateAverageGrade(studentId, tenantId);

  // 3. 폴백 체인
  const { tier } = resolveSchoolTier({
    explicitTier,
    currentGpa: schoolAvg,
  });

  // 4. projected scores에서 현재 레벨 산출 (있으면)
  const { calculateSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calculateSchoolYear();
  const { data: projScores } = await supabase
    .from("student_record_competency_scores")
    .select("grade_value")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", currentSchoolYear)
    .eq("source", "ai_projected");

  const currentLevel = scoresToCurrentLevel(projScores ?? []);

  // 5. 엔진 실행
  return computeAdequateLevel({
    targetSchoolTier: tier,
    currentGpa: schoolAvg,
    grade,
    currentLevel,
  });
}
