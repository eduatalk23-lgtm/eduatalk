"use server";

/**
 * 슬롯 추천 서버 액션
 *
 * 학생 프로필 기반 슬롯 추천을 제공합니다.
 */

import {
  recommendSlots,
  recommendSlotsFromPreset,
  getAvailablePresets,
  type StudentProfile,
  type RecommendationOptions,
  type SlotRecommendationResult,
  type GradeLevel,
  type PlanPurpose,
  type StudyIntensity,
} from "@/lib/plan/slotRecommendationService";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";

// Re-export types for client use
export type {
  StudentProfile,
  RecommendationOptions,
  SlotRecommendationResult,
  GradeLevel,
  PlanPurpose,
  StudyIntensity,
};

/**
 * 학생 프로필 기반 슬롯 추천
 */
export async function recommendSlotsAction(
  profile: StudentProfile,
  options?: RecommendationOptions
): Promise<{
  success: boolean;
  result?: SlotRecommendationResult;
  error?: string;
}> {
  try {
    const result = recommendSlots(profile, options);
    return { success: true, result };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "recommendSlotsAction" },
      error
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "추천에 실패했습니다.",
    };
  }
}

/**
 * 프리셋 기반 슬롯 추천
 */
export async function recommendSlotsFromPresetAction(
  presetKey: string,
  overrides?: Partial<StudentProfile>
): Promise<{
  success: boolean;
  result?: SlotRecommendationResult;
  error?: string;
}> {
  try {
    const result = recommendSlotsFromPreset(presetKey, overrides);
    if (!result) {
      return {
        success: false,
        error: `프리셋을 찾을 수 없습니다: ${presetKey}`,
      };
    }
    return { success: true, result };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "recommendSlotsFromPresetAction" },
      error,
      { presetKey }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "추천에 실패했습니다.",
    };
  }
}

/**
 * 사용 가능한 프리셋 목록 조회
 */
export async function getAvailablePresetsAction(): Promise<{
  success: boolean;
  presets?: { key: string; name: string }[];
  error?: string;
}> {
  try {
    const presets = getAvailablePresets();
    return { success: true, presets };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "getAvailablePresetsAction" },
      error
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "프리셋 조회에 실패했습니다.",
    };
  }
}

/**
 * 현재 로그인한 학생의 프로필로 슬롯 추천
 */
export async function recommendSlotsForCurrentStudentAction(
  planPurpose: PlanPurpose,
  options?: RecommendationOptions
): Promise<{
  success: boolean;
  result?: SlotRecommendationResult;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    // 학생 정보 조회
    const supabase = await createSupabaseServerClient();
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("grade")
      .eq("id", user.userId)
      .maybeSingle();

    if (studentError) {
      logActionError(
        { domain: "plan", action: "recommendSlotsForCurrentStudentAction", userId: user.userId },
        studentError,
        { step: "fetchStudent" }
      );
    }

    // 학년 정보를 GradeLevel로 변환
    const gradeLevel = parseGradeLevel(student?.grade);

    const profile: StudentProfile = {
      gradeLevel,
      planPurpose,
      studyIntensity: "normal",
    };

    const result = recommendSlots(profile, options);
    return { success: true, result };
  } catch (error) {
    logActionError(
      { domain: "plan", action: "recommendSlotsForCurrentStudentAction" },
      error,
      { planPurpose }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "추천에 실패했습니다.",
    };
  }
}

/**
 * 학년 문자열을 GradeLevel로 변환
 */
function parseGradeLevel(grade: string | null | undefined): GradeLevel {
  if (!grade) return "high_1";

  const gradeMap: Record<string, GradeLevel> = {
    중1: "middle_1",
    중2: "middle_2",
    중3: "middle_3",
    고1: "high_1",
    고2: "high_2",
    고3: "high_3",
    "N수": "n_su",
    N수생: "n_su",
    재수: "n_su",
  };

  // 정확한 매칭
  if (gradeMap[grade]) {
    return gradeMap[grade];
  }

  // 숫자 포함 매칭 (예: "고등학교 1학년" -> "high_1")
  if (grade.includes("1")) {
    if (grade.includes("중")) return "middle_1";
    if (grade.includes("고")) return "high_1";
  }
  if (grade.includes("2")) {
    if (grade.includes("중")) return "middle_2";
    if (grade.includes("고")) return "high_2";
  }
  if (grade.includes("3")) {
    if (grade.includes("중")) return "middle_3";
    if (grade.includes("고")) return "high_3";
  }

  return "high_1";
}
