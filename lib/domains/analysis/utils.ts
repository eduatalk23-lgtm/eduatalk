/**
 * Analysis Domain Utilities
 *
 * Risk Index 계산 및 분석 관련 유틸리티 함수
 */

import { getInternalScores, getMockScores } from "@/lib/data/studentScores";
import { getSubjectById } from "@/lib/data/subjects";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { logActionError } from "@/lib/logging/actionLogger";
import type {
  ScoreRow,
  ProgressRow,
  PlanRow,
  SubjectRiskAnalysis,
} from "./types";

type SupabaseServerClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>
>;

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
          subject_type: null,
          semester: score.semester ? `${score.grade}-${score.semester}` : null,
          course: subjectGroupName,
          course_detail: subject?.name ?? null,
          raw_score: score.raw_score,
          grade: score.rank_grade ?? null,
          score_type_detail: "내신",
          test_date: null,
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

    // 두 결과를 합치고 날짜순으로 정렬 (최신순)
    const allScores = [...internalRows, ...mockRows].sort((a, b) => {
      const dateA = a.test_date
        ? new Date(a.test_date).getTime()
        : a.created_at
          ? new Date(a.created_at).getTime()
          : 0;
      const dateB = b.test_date
        ? new Date(b.test_date).getTime()
        : b.created_at
          ? new Date(b.created_at).getTime()
          : 0;
      return dateB - dateA; // 최신순
    });

    return allScores;
  } catch (error) {
    logActionError(
      { domain: "analysis", action: "fetchAllScores" },
      error,
      { studentId, tenantId }
    );
    return [];
  }
}

// 학습 진행률 조회
export async function fetchProgressMap(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<Record<string, ProgressRow>> {
  try {
    const selectProgress = () =>
      supabase
        .from("student_content_progress")
        .select("content_type,content_id,progress,last_updated");

    let { data, error } = await selectProgress().eq("student_id", studentId);

    if (ErrorCodeCheckers.isColumnNotFound(error)) {
      ({ data, error } = await selectProgress());
    }

    if (error) throw error;

    const rows = (data as ProgressRow[] | null) ?? [];
    return rows.reduce<Record<string, ProgressRow>>((acc, row) => {
      if (row.content_type && row.content_id) {
        const key = `${row.content_type}:${row.content_id}`;
        acc[key] = row;
      }
      return acc;
    }, {});
  } catch (error) {
    logActionError(
      { domain: "analysis", action: "fetchProgressMap" },
      error,
      { studentId }
    );
    return {};
  }
}

// 학습 플랜 조회 (학습 시간 계산용)
export async function fetchPlansForSubject(
  supabase: SupabaseServerClient,
  studentId: string,
  subject: string
): Promise<PlanRow[]> {
  try {
    // 콘텐츠 조회 (subject로 필터링)
    const selectBooks = () =>
      supabase.from("books").select("id").eq("subject", subject);
    const selectLectures = () =>
      supabase.from("lectures").select("id").eq("subject", subject);
    const selectCustom = () =>
      supabase
        .from("student_custom_contents")
        .select("id")
        .eq("subject", subject);

    const [books, lectures, custom] = await Promise.all([
      selectBooks().eq("student_id", studentId),
      selectLectures().eq("student_id", studentId),
      selectCustom().eq("student_id", studentId),
    ]);

    // 42703 fallback
    let bookIds: string[] = [];
    let lectureIds: string[] = [];
    let customIds: string[] = [];

    if (ErrorCodeCheckers.isColumnNotFound(books.error)) {
      const { data } = await selectBooks();
      bookIds = (data ?? []).map((b) => b.id);
    } else if (books.data) {
      bookIds = books.data.map((b) => b.id);
    }

    if (ErrorCodeCheckers.isColumnNotFound(lectures.error)) {
      const { data } = await selectLectures();
      lectureIds = (data ?? []).map((l) => l.id);
    } else if (lectures.data) {
      lectureIds = lectures.data.map((l) => l.id);
    }

    if (ErrorCodeCheckers.isColumnNotFound(custom.error)) {
      const { data } = await selectCustom();
      customIds = (data ?? []).map((c) => c.id);
    } else if (custom.data) {
      customIds = custom.data.map((c) => c.id);
    }

    if (
      bookIds.length === 0 &&
      lectureIds.length === 0 &&
      customIds.length === 0
    ) {
      return [];
    }

    // 플랜 조회 (OR 조건으로 한 번에)
    const planQueries: Promise<PlanRow[]>[] = [];

    if (bookIds.length > 0) {
      const selectPlans = () =>
        supabase
          .from("student_plan")
          .select("id,content_type,content_id,plan_date,completed_amount")
          .eq("content_type", "book")
          .in("content_id", bookIds);

      const query = selectPlans().eq("student_id", studentId);
      planQueries.push(
        (async () => {
          const { data } = await query;
          return (data ?? []) as PlanRow[];
        })()
      );
    }

    if (lectureIds.length > 0) {
      const selectPlans = () =>
        supabase
          .from("student_plan")
          .select("id,content_type,content_id,plan_date,completed_amount")
          .eq("content_type", "lecture")
          .in("content_id", lectureIds);

      const query = selectPlans().eq("student_id", studentId);
      planQueries.push(
        (async () => {
          const { data } = await query;
          return (data ?? []) as PlanRow[];
        })()
      );
    }

    if (customIds.length > 0) {
      const selectPlans = () =>
        supabase
          .from("student_plan")
          .select("id,content_type,content_id,plan_date,completed_amount")
          .eq("content_type", "custom")
          .in("content_id", customIds);

      const query = selectPlans().eq("student_id", studentId);
      planQueries.push(
        (async () => {
          const { data } = await query;
          return (data ?? []) as PlanRow[];
        })()
      );
    }

    if (planQueries.length === 0) return [];

    const planResults = await Promise.all(planQueries);
    const allPlans: PlanRow[] = planResults.flat();

    return allPlans;
  } catch (error) {
    logActionError(
      { domain: "analysis", action: "fetchPlansForSubject" },
      error,
      { studentId, subject }
    );
    return [];
  }
}

// Risk Index 계산
export function calculateRiskIndex(
  subject: string,
  scores: ScoreRow[],
  plans: PlanRow[],
  _progressMap: Record<string, ProgressRow>
): SubjectRiskAnalysis {
  // 해당 과목의 성적만 필터링
  const subjectScores = scores
    .filter(
      (s) => s.course?.toLowerCase().trim() === subject.toLowerCase().trim()
    )
    .filter((s) => s.grade !== null && s.grade !== undefined)
    .sort((a, b) => {
      const dateA = a.test_date ? new Date(a.test_date).getTime() : 0;
      const dateB = b.test_date ? new Date(b.test_date).getTime() : 0;
      return dateB - dateA; // 최신순
    });

  if (subjectScores.length === 0) {
    return {
      subject,
      risk_score: 0,
      recent_grade_trend: 0,
      consistency_score: 100,
      mastery_estimate: 0,
      recent3AvgGrade: 0,
      gradeChange: 0,
      scoreVariance: 0,
      improvementRate: 0,
    };
  }

  const validGrades = subjectScores
    .map((s) => s.grade!)
    .filter((g): g is number => g !== null && g !== undefined);
  const validRawScores = subjectScores
    .map((s) => s.raw_score)
    .filter((r): r is number => r !== null && r !== undefined);

  // 1. 최근 3회 등급 평균
  const recent3Grades = validGrades.slice(0, 3);
  const recent3AvgGrade =
    recent3Grades.length > 0
      ? recent3Grades.reduce((a, b) => a + b, 0) / recent3Grades.length
      : (validGrades[0] ?? 0);

  // 2. 최근 등급 변화 (하락 = 위험도 증가)
  let gradeChange = 0;
  let recentGradeTrend = 0; // -1 (하락), 0 (유지), 1 (상승)
  if (validGrades.length >= 2) {
    const latest = validGrades[0];
    const previous = validGrades[1];
    gradeChange = latest - previous; // 양수면 하락 (나빠짐)
    if (gradeChange > 0) {
      recentGradeTrend = -1; // 하락
    } else if (gradeChange < 0) {
      recentGradeTrend = 1; // 상승
    } else {
      recentGradeTrend = 0; // 유지
    }
  }

  // 3. 난이도 대비 raw_score 편차
  let scoreVariance = 0;
  if (validRawScores.length >= 2) {
    const mean =
      validRawScores.reduce((a, b) => a + b, 0) / validRawScores.length;
    const variance =
      validRawScores.reduce((sum, score) => {
        return sum + Math.pow(score - mean, 2);
      }, 0) / validRawScores.length;
    scoreVariance = Math.sqrt(variance);
  }

  // 4. 학습 시간 대비 성취도 개선율
  // 플랜의 completed_amount 합계를 학습 시간으로 간주
  const totalLearningTime = plans.reduce((sum, plan) => {
    return sum + (plan.completed_amount ?? 0);
  }, 0);

  // 개선율: 최근 등급이 개선되었는지와 학습 시간의 비율
  let improvementRate = 0;
  if (validGrades.length >= 2) {
    const latestGrade = validGrades[0];
    const oldestGrade = validGrades[validGrades.length - 1];
    const gradeImprovement = oldestGrade - latestGrade; // 양수면 개선 (등급이 낮아짐)

    if (totalLearningTime > 0) {
      // 학습 시간 대비 등급 개선도 (등급 1단계 개선당 학습 시간 비율)
      improvementRate = (gradeImprovement / totalLearningTime) * 1000; // 스케일 조정
    } else {
      // 학습 시간이 없으면 등급 변화만으로 추정
      improvementRate = gradeImprovement * 10; // 등급 1단계 = 10점
    }
  }

  // 일관성 점수 (등급 편차가 작을수록 높음)
  let consistencyScore = 100;
  if (validGrades.length >= 2) {
    const gradeMean =
      validGrades.reduce((a, b) => a + b, 0) / validGrades.length;
    const gradeVariance =
      validGrades.reduce((sum, grade) => {
        return sum + Math.pow(grade - gradeMean, 2);
      }, 0) / validGrades.length;
    const gradeStdDev = Math.sqrt(gradeVariance);
    // 표준편차가 0이면 100점, 2 이상이면 0점
    consistencyScore = Math.max(0, 100 - gradeStdDev * 50);
  }

  // 숙련도 추정 (최근 등급이 좋을수록, 일관성이 높을수록 높음)
  // 1등급=100, 5등급=50, 9등급=0
  const gradeBasedMastery = ((9 - recent3AvgGrade) / 8) * 100;
  const masteryEstimate = gradeBasedMastery * 0.7 + consistencyScore * 0.3;

  // Risk Score 계산 (0-100, 높을수록 위험)
  let riskScore = 0;

  // 1. 최근 3회 평균 등급 (40%)
  const gradeRisk = ((recent3AvgGrade - 1) / 8) * 100;
  riskScore += gradeRisk * 0.4;

  // 2. 등급 하락 패널티 (30%)
  if (gradeChange > 0) {
    riskScore += Math.min(100, gradeChange * 20) * 0.3;
  }

  // 3. 원점수 편차 (20%)
  // 편차가 20 이상이면 위험
  const varianceRisk = Math.min(100, (scoreVariance / 20) * 100);
  riskScore += varianceRisk * 0.2;

  // 4. 개선율 부족 패널티 (10%)
  // 개선율이 낮거나 음수면 위험
  if (improvementRate <= 0) {
    riskScore += 50 * 0.1;
  } else if (improvementRate < 1) {
    riskScore += (1 - improvementRate) * 50 * 0.1;
  }

  riskScore = Math.min(100, Math.max(0, riskScore));

  return {
    subject,
    risk_score: riskScore,
    recent_grade_trend: recentGradeTrend,
    consistency_score: consistencyScore,
    mastery_estimate: masteryEstimate,
    recent3AvgGrade,
    gradeChange,
    scoreVariance,
    improvementRate,
  };
}

// 모든 과목의 Risk Index 계산
export async function calculateAllRiskIndices(
  supabase: SupabaseServerClient,
  studentId: string,
  tenantId: string
): Promise<SubjectRiskAnalysis[]> {
  const [scores, progressMap] = await Promise.all([
    fetchAllScores(supabase, studentId, tenantId),
    fetchProgressMap(supabase, studentId),
  ]);

  // 과목 목록 추출
  const subjects = new Set<string>();
  scores.forEach((score) => {
    if (score.course) {
      subjects.add(score.course.toLowerCase().trim());
    }
  });

  const analyses: SubjectRiskAnalysis[] = [];

  for (const subject of subjects) {
    const plans = await fetchPlansForSubject(supabase, studentId, subject);
    const analysis = calculateRiskIndex(subject, scores, plans, progressMap);
    analyses.push(analysis);
  }

  // Risk Score 순으로 정렬 (높을수록 위험)
  return analyses.sort((a, b) => b.risk_score - a.risk_score);
}

// student_analysis 테이블에 저장
export async function saveRiskAnalysis(
  supabase: SupabaseServerClient,
  studentId: string,
  analyses: SubjectRiskAnalysis[]
): Promise<void> {
  try {
    // student의 tenant_id 조회
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", studentId)
      .single();

    if (!student || !student.tenant_id) {
      logActionError(
        { domain: "analysis", action: "saveRiskAnalysis" },
        new Error("Student not found or missing tenant_id"),
        { studentId }
      );
      return;
    }

    // 기존 데이터 삭제 (새 테이블 사용)
    const { error: deleteError } = await supabase
      .from("student_risk_analysis")
      .delete()
      .eq("student_id", studentId);

    if (deleteError && deleteError.code !== "PGRST116") {
      // PGRST116은 "no rows found" 에러, 무시 가능
      throw deleteError;
    }

    // 새 데이터 삽입
    const insertData = analyses.map((analysis) => ({
      student_id: studentId,
      tenant_id: student.tenant_id,
      subject: analysis.subject,
      risk_score: analysis.risk_score,
      recent_grade_trend: analysis.recent_grade_trend,
      consistency_score: analysis.consistency_score,
      mastery_estimate: analysis.mastery_estimate,
      recent_3_avg_grade: analysis.recent3AvgGrade,
      grade_change: analysis.gradeChange,
      score_variance: analysis.scoreVariance,
      improvement_rate: analysis.improvementRate,
      calculated_at: new Date().toISOString(),
    }));

    if (insertData.length === 0) return;

    const { error: insertError } = await supabase
      .from("student_risk_analysis")
      .insert(insertData);

    if (insertError) throw insertError;
  } catch (error) {
    logActionError(
      { domain: "analysis", action: "saveRiskAnalysis" },
      error,
      { studentId, analysisCount: analyses.length }
    );
    // 저장 실패해도 계속 진행 (테이블이 없을 수 있음)
  }
}
