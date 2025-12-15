/**
 * 내신 분석 서비스
 * 
 * student_internal_scores 테이블을 기반으로 내신 분석을 수행합니다.
 * - 전체 GPA 계산
 * - Z-Index (학업역량 지수) 계산
 * - 교과군별 GPA 계산
 * 
 * 변경사항 (2025-01-XX):
 * - student_school_scores → student_internal_scores 테이블 사용
 * - studentTermId는 UUID 형식의 student_term_id 사용
 * - subject_group_id를 통해 subject_groups 조인하여 교과군명 조회
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 내신 분석 결과 타입
 */
export type InternalAnalysis = {
  totalGpa: number | null; // 전체 내신 평균 등급
  zIndex: number | null; // 학업역량 지수(Z-Index)
  subjectStrength: Record<string, number>; // 교과군명 → GPA
};

/**
 * 내신 분석 수행
 * 
 * @param tenantId - 테넌트 ID
 * @param studentId - 학생 ID
 * @param studentTermId - 학생 학기 ID (UUID 형식, 선택사항, 없으면 전체 학기 대상)
 * @returns 내신 분석 결과
 */
export async function getInternalAnalysis(
  tenantId: string,
  studentId: string,
  studentTermId?: string
): Promise<InternalAnalysis> {
  const supabase = await createSupabaseServerClient();

  // 1. 전체 GPA 계산
  let gpaQuery = supabase
    .from("student_internal_scores")
    .select("rank_grade, credit_hours")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .not("rank_grade", "is", null)
    .not("credit_hours", "is", null);

  // studentTermId가 있으면 student_term_id로 필터링
  if (studentTermId) {
    gpaQuery = gpaQuery.eq("student_term_id", studentTermId);
  }

  const { data: gpaData, error: gpaError } = await gpaQuery;

  if (gpaError) {
    console.error("[scores/internalAnalysis] GPA 계산 실패", gpaError);
  }

  // GPA 계산: SUM(rank_grade * credit_hours) / SUM(credit_hours)
  let totalGpa: number | null = null;
  if (gpaData && gpaData.length > 0) {
    const totalGradeCredit = gpaData.reduce(
      (sum, row) => sum + (Number(row.rank_grade) || 0) * (Number(row.credit_hours) || 0),
      0
    );
    const totalCredit = gpaData.reduce(
      (sum, row) => sum + (Number(row.credit_hours) || 0),
      0
    );

    if (totalCredit > 0) {
      totalGpa = totalGradeCredit / totalCredit;
    }
  }

  // 2. Z-Index 계산
  let zIndexQuery = supabase
    .from("student_internal_scores")
    .select("raw_score, avg_score, std_dev, credit_hours")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .not("raw_score", "is", null)
    .not("avg_score", "is", null)
    .not("std_dev", "is", null)
    .not("credit_hours", "is", null)
    .gt("std_dev", 0); // 표준편차가 0보다 큰 경우만

  if (studentTermId) {
    zIndexQuery = zIndexQuery.eq("student_term_id", studentTermId);
  }

  const { data: zIndexData, error: zIndexError } = await zIndexQuery;

  if (zIndexError) {
    console.error("[scores/internalAnalysis] Z-Index 계산 실패", zIndexError);
  }

  // Z-Index 계산: SUM(((raw_score - avg_score) / std_dev) * credit_hours) / SUM(credit_hours)
  let zIndex: number | null = null;
  if (zIndexData && zIndexData.length > 0) {
    const totalZCredit = zIndexData.reduce((sum, row) => {
      const rawScore = Number(row.raw_score) || 0;
      const avgScore = Number(row.avg_score) || 0;
      const stdDev = Number(row.std_dev) || 1;
      const creditHours = Number(row.credit_hours) || 0;

      if (stdDev > 0) {
        const z = (rawScore - avgScore) / stdDev;
        return sum + z * creditHours;
      }
      return sum;
    }, 0);

    const totalCredit = zIndexData.reduce(
      (sum, row) => sum + (Number(row.credit_hours) || 0),
      0
    );

    if (totalCredit > 0) {
      zIndex = totalZCredit / totalCredit;
    }
  }

  // 3. 교과군별 GPA 계산 (Relational Query로 한 번에 조인)
  let subjectQuery = supabase
    .from("student_internal_scores")
    .select(`
      rank_grade,
      credit_hours,
      subject_group_id,
      subject_group:subject_groups (
        id,
        name
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .not("rank_grade", "is", null)
    .not("credit_hours", "is", null);

  if (studentTermId) {
    subjectQuery = subjectQuery.eq("student_term_id", studentTermId);
  }

  const { data: subjectData, error: subjectError } = await subjectQuery;

  if (subjectError) {
    console.error("[scores/internalAnalysis] 교과군별 GPA 계산 실패", subjectError);
  }

  // 교과군별 GPA 계산
  const subjectStrength: Record<string, number> = {};
  if (subjectData && subjectData.length > 0) {
    // 교과군별로 그룹화 (조인 결과에서 직접 subject_group.name 사용)
    const subjectGroups: Record<string, { totalGradeCredit: number; totalCredit: number }> = {};

    for (const row of subjectData) {
      // Relational Query 결과에서 subject_group.name 추출
      const subjectGroupName = (row as any).subject_group?.name;
      if (!subjectGroupName) continue;

      const rankGrade = Number(row.rank_grade) || 0;
      const creditHours = Number(row.credit_hours) || 0;

      if (!subjectGroups[subjectGroupName]) {
        subjectGroups[subjectGroupName] = { totalGradeCredit: 0, totalCredit: 0 };
      }

      subjectGroups[subjectGroupName].totalGradeCredit += rankGrade * creditHours;
      subjectGroups[subjectGroupName].totalCredit += creditHours;
    }

    // 교과군별 GPA 계산
    for (const [name, { totalGradeCredit, totalCredit }] of Object.entries(subjectGroups)) {
      if (totalCredit > 0) {
        subjectStrength[name] = totalGradeCredit / totalCredit;
      }
    }
  }

  return {
    totalGpa,
    zIndex,
    subjectStrength,
  };
}

