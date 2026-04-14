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

  // 4. 전공 권장교과 (교육과정 연도 반영)
  let recommendedCourses: StudentProfileContext["recommendedCourses"];
  if (targetMajor) {
    // 학생 교육과정 연도 resolve (students.curriculum_revision → curriculum_revisions.year)
    let curriculumYear: number | undefined;
    const { data: currRev } = await supabase
      .from("students")
      .select("curriculum_revision")
      .eq("id", studentId)
      .maybeSingle();
    if (currRev?.curriculum_revision) {
      const { data: rev } = await supabase
        .from("curriculum_revisions")
        .select("year")
        .eq("name", currRev.curriculum_revision as string)
        .maybeSingle();
      curriculumYear = rev?.year ?? undefined;
    }
    const courses = getMajorRecommendedCourses(targetMajor, curriculumYear);
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

  // 6. 스토리라인 (keywords + narrative 구조)
  let storylineKeywords: string[] | undefined;
  let storylineNarratives: StudentProfileContext["storylineNarratives"];
  const { data: storylines } = await supabase
    .from("student_record_storylines")
    .select("title, keywords, narrative, grade_1_theme, grade_2_theme, grade_3_theme, strength")
    .eq("student_id", studentId)
    .order("sort_order", { ascending: true })
    .limit(5);

  if (storylines && storylines.length > 0) {
    const allKeywords = storylines.flatMap(
      (sl) => (sl.keywords as string[]) ?? [],
    );
    storylineKeywords = [...new Set(allKeywords)].slice(0, 10);
    if (storylineKeywords.length === 0) storylineKeywords = undefined;

    storylineNarratives = storylines.map((sl) => ({
      title: (sl.title as string) ?? "",
      narrative: (sl.narrative as string | null) ?? null,
      grade1Theme: (sl.grade_1_theme as string | null) ?? null,
      grade2Theme: (sl.grade_2_theme as string | null) ?? null,
      grade3Theme: (sl.grade_3_theme as string | null) ?? null,
      strength: (sl.strength as string | null) ?? null,
    }));
  }

  // 7. P1: Layer 2 hyperedge 테마 (최대 5개, analysis context 만)
  let hyperedgeThemes: string[] | undefined;
  const { data: hyperedges } = await supabase
    .from("student_record_hyperedges")
    .select("theme_label, member_count, confidence")
    .eq("student_id", studentId)
    .eq("edge_context", "analysis")
    .order("member_count", { ascending: false })
    .limit(5);
  if (hyperedges && hyperedges.length > 0) {
    const labels = hyperedges
      .map((h) => (h.theme_label as string | null) ?? null)
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    if (labels.length > 0) hyperedgeThemes = labels;
  }

  // 8. P1: Layer 3 narrative_arc 단계 분포 — 8단계 중 약한 단계 식별
  let narrativeStageDistribution: StudentProfileContext["narrativeStageDistribution"];
  const { data: arcRows } = await supabase
    .from("student_record_narrative_arc")
    .select(
      "curiosity_present, topic_selection_present, inquiry_content_present, references_present, conclusion_present, teacher_observation_present, growth_narrative_present, reinquiry_present",
    )
    .eq("student_id", studentId);
  if (arcRows && arcRows.length > 0) {
    const total = arcRows.length;
    const count = (key: keyof typeof arcRows[number]) =>
      arcRows.filter((r) => r[key] === true).length;
    narrativeStageDistribution = [
      { stage: "지적호기심", count: count("curiosity_present") },
      { stage: "주제선정", count: count("topic_selection_present") },
      { stage: "탐구내용/이론", count: count("inquiry_content_present") },
      { stage: "참고문헌", count: count("references_present") },
      { stage: "결론/제언", count: count("conclusion_present") },
      { stage: "교사관찰", count: count("teacher_observation_present") },
      { stage: "성장서사", count: count("growth_narrative_present") },
      { stage: "오류분석→재탐구", count: count("reinquiry_present") },
    ];
    // 분모 정보(총 레코드 수)는 프롬프트 렌더링 시 비율 계산을 위해 별도 필드에 포함
    // → 현재는 count 만 넘기고 프롬프트에서 "N건 중 X건 present" 표기 대신
    //   "약한 단계 = count < total*0.5" 로 분류하도록 한다.
    // 총 레코드 수를 넘기기 위해 배열 첫 원소에 가상 stage="__total"로 인코딩.
    narrativeStageDistribution.unshift({ stage: "__total", count: total });
  }

  // 9. P1: Layer 0 profile_card 요약 (target_grade 최신 1건)
  let profileCardSummary: string | undefined;
  const { data: cardRow } = await supabase
    .from("student_record_profile_cards")
    .select(
      "persistent_strengths, persistent_weaknesses, recurring_quality_issues, cross_grade_themes, interest_consistency",
    )
    .eq("student_id", studentId)
    .order("target_grade", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cardRow) {
    const parts: string[] = [];
    const strengths = cardRow.persistent_strengths as string[] | null;
    const weaknesses = cardRow.persistent_weaknesses as string[] | null;
    const issues = cardRow.recurring_quality_issues as string[] | null;
    const themes = cardRow.cross_grade_themes as string[] | null;
    const consistency = cardRow.interest_consistency as string | null;
    if (strengths?.length) parts.push(`지속 강점: ${strengths.slice(0, 4).join(", ")}`);
    if (weaknesses?.length) parts.push(`지속 약점: ${weaknesses.slice(0, 3).join(", ")}`);
    if (issues?.length) parts.push(`반복 품질 이슈: ${issues.slice(0, 3).join(", ")}`);
    if (themes?.length) parts.push(`학년 관통 테마: ${themes.slice(0, 4).join(", ")}`);
    if (consistency) parts.push(`관심사 일관성: ${consistency}`);
    if (parts.length > 0) profileCardSummary = parts.join(" | ");
  }

  return {
    studentId,
    name,
    targetMajor,
    desiredCareerField,
    topCompetencies,
    weakCompetencies,
    storylineKeywords,
    storylineNarratives,
    hyperedgeThemes,
    narrativeStageDistribution,
    profileCardSummary,
    recommendedCourses,
    suggestedDifficulty,
  };
}
