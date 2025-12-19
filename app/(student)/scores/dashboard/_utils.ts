/**
 * 성적 대시보드 유틸리티
 * 
 * 새 구조의 내신/모의고사 성적을 레거시 형태로 변환하여 제공합니다.
 * 
 * @see lib/data/studentScores.ts - getInternalScores, getMockScores
 */

import { getInternalScores, getMockScores } from "@/lib/data/studentScores";
import { getSubjectById } from "@/lib/data/subjects";

type SupabaseServerClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>
>;

/**
 * 레거시 ScoreRow 타입 (하위 호환성 유지)
 */
export type ScoreRow = {
  id: string;
  subject_type: string | null;
  semester: string | null;
  course: string | null;
  course_detail: string | null;
  raw_score: number | null;
  grade: number | null;
  score_type_detail: string | null;
  test_date: string | null;
  created_at: string | null;
};

/**
 * 모든 성적 조회 (새 구조)
 * 
 * 내신 성적과 모의고사 성적을 조회하여 레거시 ScoreRow 형태로 변환합니다.
 */
export async function fetchAllScores(
  supabase: SupabaseServerClient,
  studentId: string,
  tenantId: string
): Promise<ScoreRow[]> {
  try {
    // 내신 성적과 모의고사 성적 병렬 조회
    const [internalScores, mockScores] = await Promise.all([
      getInternalScores(studentId, tenantId),
      getMockScores(studentId, tenantId),
    ]);

    // 내신 성적을 레거시 형태로 변환
    const internalRows: ScoreRow[] = await Promise.all(
      internalScores.map(async (score) => {
        // 과목 정보 조회
        let subject = null;
        let subjectGroupName = null;
        if (score.subject_id) {
          subject = await getSubjectById(score.subject_id);
          subjectGroupName = subject?.subjectGroup.name ?? null;
        }

        return {
          id: score.id,
          subject_type: null, // 새 구조에서는 subject_type_id 사용
          semester: score.semester ? `${score.grade}-${score.semester}` : null,
          course: subjectGroupName,
          course_detail: subject?.name ?? null,
          raw_score: score.raw_score,
          grade: score.rank_grade ?? null,
          score_type_detail: "내신",
          test_date: null, // 내신은 test_date 없음
          created_at: score.created_at,
        };
      })
    );

    // 모의고사 성적을 레거시 형태로 변환
    const mockRows: ScoreRow[] = await Promise.all(
      mockScores.map(async (score) => {
        // 과목 정보 조회
        let subject = null;
        let subjectGroupName = null;
        if (score.subject_id) {
          subject = await getSubjectById(score.subject_id);
          subjectGroupName = subject?.subjectGroup.name ?? null;
        }

        return {
          id: score.id,
          subject_type: null,
          semester: null,
          course: subjectGroupName,
          course_detail: subject?.name ?? null,
          raw_score: score.raw_score,
          grade: score.grade_score ?? null,
          score_type_detail: "모의고사",
          test_date: score.exam_date ?? null,
          created_at: score.created_at,
        };
      })
    );

    // 두 결과를 합치고 날짜순으로 정렬
    const allScores = [...internalRows, ...mockRows].sort((a, b) => {
      const dateA = a.test_date ? new Date(a.test_date).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
      const dateB = b.test_date ? new Date(b.test_date).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
      return dateA - dateB;
    });

    return allScores;
  } catch (error) {
    console.error("[dashboard] 성적 조회 실패", error);
    return [];
  }
}

// 학기별 성적 요약
export type SemesterSummary = {
  semester: string;
  totalScores: number;
  averageGrade: number;
  averageRawScore: number;
  courses: string[];
};

export function calculateSemesterSummary(
  scores: ScoreRow[]
): SemesterSummary[] {
  const semesterMap = new Map<string, ScoreRow[]>();

  scores.forEach((score) => {
    if (!score.semester) return;
    const existing = semesterMap.get(score.semester) ?? [];
    existing.push(score);
    semesterMap.set(score.semester, existing);
  });

  const summaries: SemesterSummary[] = [];

  semesterMap.forEach((semesterScores, semester) => {
    const validGrades = semesterScores
      .map((s) => s.grade)
      .filter((g): g is number => g !== null && g !== undefined);
    const validRawScores = semesterScores
      .map((s) => s.raw_score)
      .filter((r): r is number => r !== null && r !== undefined);

    const courses = new Set<string>();
    semesterScores.forEach((s) => {
      if (s.course) courses.add(s.course);
    });

    summaries.push({
      semester,
      totalScores: semesterScores.length,
      averageGrade:
        validGrades.length > 0
          ? validGrades.reduce((a, b) => a + b, 0) / validGrades.length
          : 0,
      averageRawScore:
        validRawScores.length > 0
          ? validRawScores.reduce((a, b) => a + b, 0) / validRawScores.length
          : 0,
      courses: Array.from(courses).sort(),
    });
  });

  return summaries.sort((a, b) => a.semester.localeCompare(b.semester));
}

// 교과별 평균 등급
export type CourseAverageGrade = {
  course: string;
  averageGrade: number;
  count: number;
};

export function calculateCourseAverageGrades(
  scores: ScoreRow[]
): CourseAverageGrade[] {
  const courseMap = new Map<string, number[]>();

  scores.forEach((score) => {
    if (!score.course || score.grade === null) return;
    const existing = courseMap.get(score.course) ?? [];
    existing.push(score.grade);
    courseMap.set(score.course, existing);
  });

  const averages: CourseAverageGrade[] = [];

  courseMap.forEach((grades, course) => {
    const average =
      grades.length > 0
        ? grades.reduce((a, b) => a + b, 0) / grades.length
        : 0;

    averages.push({
      course,
      averageGrade: average,
      count: grades.length,
    });
  });

  return averages.sort((a, b) => a.averageGrade - b.averageGrade);
}

// 과목별 등급 변화 (시험일 기준)
export type SubjectGradeHistory = {
  course_detail: string;
  course: string;
  history: Array<{
    test_date: string;
    grade: number;
    raw_score: number | null;
    score_type_detail: string | null;
  }>;
};

export function calculateSubjectGradeHistory(
  scores: ScoreRow[]
): SubjectGradeHistory[] {
  const subjectMap = new Map<string, ScoreRow[]>();

  scores.forEach((score) => {
    if (!score.course_detail || score.grade === null) return;
    const key = `${score.course}:${score.course_detail}`;
    const existing = subjectMap.get(key) ?? [];
    existing.push(score);
    subjectMap.set(key, existing);
  });

  const histories: SubjectGradeHistory[] = [];

  subjectMap.forEach((subjectScores, key) => {
    const [course, course_detail] = key.split(":");
    const sortedScores = subjectScores.sort((a, b) => {
      const dateA = a.test_date ? new Date(a.test_date).getTime() : 0;
      const dateB = b.test_date ? new Date(b.test_date).getTime() : 0;
      return dateA - dateB;
    });

    histories.push({
      course_detail,
      course,
      history: sortedScores.map((s) => ({
        test_date: s.test_date ?? "",
        grade: s.grade!,
        raw_score: s.raw_score,
        score_type_detail: s.score_type_detail,
      })),
    });
  });

  return histories.sort((a, b) => a.course_detail.localeCompare(b.course_detail));
}

// 내신 vs 모의고사 비교
export type ScoreTypeComparison = {
  score_type: string;
  averageGrade: number;
  count: number;
  averageRawScore: number;
};

export function calculateScoreTypeComparison(
  scores: ScoreRow[]
): ScoreTypeComparison[] {
  const typeMap = new Map<string, ScoreRow[]>();

  scores.forEach((score) => {
    if (!score.score_type_detail || score.grade === null) return;
    const existing = typeMap.get(score.score_type_detail) ?? [];
    existing.push(score);
    typeMap.set(score.score_type_detail, existing);
  });

  const comparisons: ScoreTypeComparison[] = [];

  typeMap.forEach((typeScores, score_type) => {
    const validGrades = typeScores
      .map((s) => s.grade)
      .filter((g): g is number => g !== null && g !== undefined);
    const validRawScores = typeScores
      .map((s) => s.raw_score)
      .filter((r): r is number => r !== null && r !== undefined);

    comparisons.push({
      score_type,
      averageGrade:
        validGrades.length > 0
          ? validGrades.reduce((a, b) => a + b, 0) / validGrades.length
          : 0,
      count: typeScores.length,
      averageRawScore:
        validRawScores.length > 0
          ? validRawScores.reduce((a, b) => a + b, 0) / validRawScores.length
          : 0,
    });
  });

  return comparisons.sort((a, b) => a.averageGrade - b.averageGrade);
}

// 취약과목 탐지
export type WeakSubject = {
  course_detail: string;
  course: string;
  reason: string;
  averageGrade: number;
  recentDecline?: number; // 최근 2번 등급 하락
  scoreVariance?: number; // raw_score 편차
  count: number;
};

export function detectWeakSubjects(scores: ScoreRow[]): WeakSubject[] {
  const subjectMap = new Map<string, ScoreRow[]>();

  scores.forEach((score) => {
    if (!score.course_detail || score.grade === null) return;
    const key = `${score.course}:${score.course_detail}`;
    const existing = subjectMap.get(key) ?? [];
    existing.push(score);
    subjectMap.set(key, existing);
  });

  const weakSubjects: WeakSubject[] = [];

  subjectMap.forEach((subjectScores, key) => {
    const [course, course_detail] = key.split(":");
    const sortedScores = subjectScores.sort((a, b) => {
      const dateA = a.test_date ? new Date(a.test_date).getTime() : 0;
      const dateB = b.test_date ? new Date(b.test_date).getTime() : 0;
      return dateB - dateA; // 최신순
    });

    const validGrades = sortedScores
      .map((s) => s.grade)
      .filter((g): g is number => g !== null && g !== undefined);
    const validRawScores = sortedScores
      .map((s) => s.raw_score)
      .filter((r): r is number => r !== null && r !== undefined);

    if (validGrades.length === 0) return;

    const averageGrade =
      validGrades.reduce((a, b) => a + b, 0) / validGrades.length;

    const reasons: string[] = [];

    // 1. 최근 2번 등급 하락 체크
    if (validGrades.length >= 2) {
      const recent2 = validGrades.slice(0, 2);
      if (recent2[0] > recent2[1]) {
        // 등급이 높아졌다는 것은 나빠졌다는 의미 (1등급이 최고)
        const decline = recent2[0] - recent2[1];
        reasons.push(`최근 2번 등급 ${decline}단계 하락`);
        weakSubjects.push({
          course_detail,
          course,
          reason: reasons.join(", "),
          averageGrade,
          recentDecline: decline,
          count: validGrades.length,
        });
        return; // 이미 추가했으므로 다음 과목으로
      }
    }

    // 2. 평균 등급이 낮은 순 (5등급 이상)
    if (averageGrade >= 5) {
      reasons.push(`평균 등급 ${averageGrade.toFixed(1)}등급 (낮음)`);
    }

    // 3. raw_score 편차가 큰 과목
    if (validRawScores.length >= 2) {
      const mean =
        validRawScores.reduce((a, b) => a + b, 0) / validRawScores.length;
      const variance =
        validRawScores.reduce((sum, score) => {
          return sum + Math.pow(score - mean, 2);
        }, 0) / validRawScores.length;
      const stdDev = Math.sqrt(variance);

      // 편차가 평균의 20% 이상이면 불안정
      if (stdDev > mean * 0.2) {
        reasons.push(`점수 편차 큼 (표준편차: ${stdDev.toFixed(1)})`);
        weakSubjects.push({
          course_detail,
          course,
          reason: reasons.join(", "),
          averageGrade,
          scoreVariance: stdDev,
          count: validGrades.length,
        });
        return;
      }
    }

    // 평균 등급이 낮은 경우만 추가
    if (averageGrade >= 5 && reasons.length > 0) {
      weakSubjects.push({
        course_detail,
        course,
        reason: reasons.join(", "),
        averageGrade,
        count: validGrades.length,
      });
    }
  });

  // 평균 등급 순으로 정렬
  return weakSubjects.sort((a, b) => b.averageGrade - a.averageGrade);
}

