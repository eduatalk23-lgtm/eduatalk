import "server-only";

/**
 * 학생 프로필 로더 — 가이드 생성 시 학생 진로/역량 맥락을 조회하여
 * StudentProfileContext를 구성합니다. 실패 시 null을 반환합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CAREER_FIELD_COMPETENCY_WEIGHTS } from "@/lib/domains/bypass-major/constants";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import { getMajorRecommendedCourses } from "@/lib/domains/student-record/constants";
import type { StudentProfileContext } from "../types";

const LOAD_TIMEOUT_MS = 2000;

/**
 * 학생 ID로 가이드 생성용 프로필 컨텍스트를 로드합니다.
 * - students 테이블에서 진로 정보 조회
 * - 역량 가중치에서 상위/하위 역량 추출
 * - 전공 권장교과 조회
 * - 스토리라인 키워드 조회
 *
 * 타임아웃 2초, 실패 시 null (프로필 없는 범용 모드로 동작)
 */
export async function loadStudentProfileForGuide(
  studentId: string,
): Promise<StudentProfileContext | null> {
  try {
    return await Promise.race([
      loadProfileInternal(studentId),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), LOAD_TIMEOUT_MS),
      ),
    ]);
  } catch {
    return null;
  }
}

async function loadProfileInternal(
  studentId: string,
): Promise<StudentProfileContext | null> {
  const supabase = await createSupabaseServerClient();

  // 1. 학생 기본 정보
  const { data: student } = await supabase
    .from("students")
    .select("target_major, desired_career_field")
    .eq("id", studentId)
    .maybeSingle();

  if (!student) return null;

  // 2. 학생 이름 (user_profiles JOIN)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("id", studentId)
    .maybeSingle();

  const name = profile?.name ?? "학생";
  const targetMajor = student.target_major ?? undefined;
  const desiredCareerField = student.desired_career_field ?? undefined;

  // 3. 역량 가중치에서 상위/하위 추출
  let topCompetencies: string[] | undefined;
  let weakCompetencies: string[] | undefined;

  if (targetMajor) {
    const weights =
      CAREER_FIELD_COMPETENCY_WEIGHTS[targetMajor] as
        | Record<string, number>
        | undefined;

    if (weights) {
      const sorted = Object.entries(weights).sort(([, a], [, b]) => b - a);

      topCompetencies = sorted
        .slice(0, 3)
        .filter(([, w]) => w >= 1.0)
        .map(([code, w]) => {
          const item = COMPETENCY_ITEMS.find((i) => i.code === code);
          return `${item?.label ?? code}(${w}배)`;
        });

      weakCompetencies = sorted
        .slice(-2)
        .filter(([, w]) => w < 0.8)
        .map(([code]) => {
          const item = COMPETENCY_ITEMS.find((i) => i.code === code);
          return item?.label ?? code;
        });

      if (topCompetencies.length === 0) topCompetencies = undefined;
      if (weakCompetencies.length === 0) weakCompetencies = undefined;
    }
  }

  // 4. 전공 권장교과
  let recommendedCourses: StudentProfileContext["recommendedCourses"];
  if (targetMajor) {
    const courses = getMajorRecommendedCourses(targetMajor);
    if (courses) {
      recommendedCourses = {
        general: courses.general,
        career: courses.career,
        fusion: courses.fusion,
      };
    }
  }

  // 5. 내신 평균 등급 기반 난이도 추론
  let suggestedDifficulty: "basic" | "intermediate" | "advanced" | undefined;
  const { data: gradeRecords } = await supabase
    .from("student_internal_scores")
    .select("rank_grade")
    .eq("student_id", studentId)
    .not("rank_grade", "is", null);
  if (gradeRecords && gradeRecords.length > 0) {
    const averageGrade = gradeRecords.reduce((sum, score) => sum + (score.rank_grade ?? 0), 0) / gradeRecords.length;
    suggestedDifficulty = averageGrade <= 2.5 ? "advanced" : averageGrade <= 4.5 ? "intermediate" : "basic";
  }

  // 6. 스토리라인 키워드 (있으면)
  let storylineKeywords: string[] | undefined;
  const { data: storylines } = await supabase
    .from("student_record_storylines")
    .select("keywords")
    .eq("student_id", studentId)
    .limit(5);

  if (storylines && storylines.length > 0) {
    const allKeywords = storylines.flatMap(
      (sl) => (sl.keywords as string[]) ?? [],
    );
    // 중복 제거, 최대 10개
    storylineKeywords = [...new Set(allKeywords)].slice(0, 10);
    if (storylineKeywords.length === 0) storylineKeywords = undefined;
  }

  return {
    studentId,
    name,
    targetMajor,
    desiredCareerField,
    topCompetencies,
    weakCompetencies,
    storylineKeywords,
    recommendedCourses,
    suggestedDifficulty,
  };
}
