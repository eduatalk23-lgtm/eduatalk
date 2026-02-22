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
import type { Tables } from "@/lib/supabase/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * JOIN 결과 타입 (subject_group 포함)
 */
type InternalScoreWithSubjectGroup = Tables<"student_internal_scores"> & {
  subject_group?: { id: string; name: string } | null;
};

/**
 * 내신 분석 결과 타입
 */
export type InternalAnalysis = {
  totalGpa: number | null; // 전체 내신 평균 등급 (석차등급 기반)
  adjustedGpa: number | null; // 조정등급 기반 평균 등급
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

  // 3개 쿼리를 Promise.all로 병렬 실행
  const [gpaResult, zIndexResult, subjectResult] = await Promise.all([
    // 1. 전체 GPA 계산 (학기별 학점가중 평균 → 학기 수 나눔)
    (async () => {
      let gpaQuery = supabase
        .from("student_internal_scores")
        .select("rank_grade, adjusted_grade, credit_hours, grade, semester")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .not("credit_hours", "is", null);

      if (studentTermId) {
        gpaQuery = gpaQuery.eq("student_term_id", studentTermId);
      }

      const { data: gpaData, error: gpaError } = await gpaQuery;

      if (gpaError) {
        console.error("[scores/internalAnalysis] GPA 계산 실패", gpaError);
      }

      let totalGpa: number | null = null;
      let adjustedGpa: number | null = null;

      if (gpaData && gpaData.length > 0) {
        const termGroups: Record<string, { gradeCredit: number; credit: number }> = {};
        const adjTermGroups: Record<string, { gradeCredit: number; credit: number }> = {};

        for (const row of gpaData) {
          const key = `${row.grade}-${row.semester}`;
          const ch = Number(row.credit_hours) || 0;

          const rg = row.rank_grade != null ? Number(row.rank_grade) : null;
          if (rg != null) {
            if (!termGroups[key]) termGroups[key] = { gradeCredit: 0, credit: 0 };
            termGroups[key].gradeCredit += rg * ch;
            termGroups[key].credit += ch;
          }

          const ag = row.adjusted_grade != null ? Number(row.adjusted_grade) : null;
          if (ag != null) {
            if (!adjTermGroups[key]) adjTermGroups[key] = { gradeCredit: 0, credit: 0 };
            adjTermGroups[key].gradeCredit += ag * ch;
            adjTermGroups[key].credit += ch;
          }
        }

        const termGpas = Object.values(termGroups)
          .filter((t) => t.credit > 0)
          .map((t) => t.gradeCredit / t.credit);

        if (termGpas.length > 0) {
          totalGpa = termGpas.reduce((sum, g) => sum + g, 0) / termGpas.length;
        }

        const adjTermGpas = Object.values(adjTermGroups)
          .filter((t) => t.credit > 0)
          .map((t) => t.gradeCredit / t.credit);

        if (adjTermGpas.length > 0) {
          adjustedGpa = adjTermGpas.reduce((sum, g) => sum + g, 0) / adjTermGpas.length;
        }
      }

      return { totalGpa, adjustedGpa };
    })(),

    // 2. Z-Index 계산
    (async () => {
      let zIndexQuery = supabase
        .from("student_internal_scores")
        .select("raw_score, avg_score, std_dev, credit_hours")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .not("raw_score", "is", null)
        .not("avg_score", "is", null)
        .not("std_dev", "is", null)
        .not("credit_hours", "is", null)
        .gt("std_dev", 0);

      if (studentTermId) {
        zIndexQuery = zIndexQuery.eq("student_term_id", studentTermId);
      }

      const { data: zIndexData, error: zIndexError } = await zIndexQuery;

      if (zIndexError) {
        console.error("[scores/internalAnalysis] Z-Index 계산 실패", zIndexError);
      }

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

      return { zIndex };
    })(),

    // 3. 교과군별 GPA 계산 (Relational Query로 한 번에 조인)
    (async () => {
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

      const subjectStrength: Record<string, number> = {};
      if (subjectData && subjectData.length > 0) {
        const subjectGroups: Record<string, { totalGradeCredit: number; totalCredit: number }> = {};

        type SubjectQueryResult = {
          rank_grade: number | null;
          credit_hours: number | null;
          subject_group_id: string | null;
          subject_group: {
            id: string;
            name: string;
          } | null;
        };

        for (const row of subjectData) {
          const typedRow = row as unknown as SubjectQueryResult;
          const subjectGroup = Array.isArray(typedRow.subject_group)
            ? typedRow.subject_group[0]
            : typedRow.subject_group;
          const subjectGroupName = subjectGroup?.name;
          if (!subjectGroupName) continue;

          const rankGrade = Number(row.rank_grade) || 0;
          const creditHours = Number(row.credit_hours) || 0;

          if (!subjectGroups[subjectGroupName]) {
            subjectGroups[subjectGroupName] = { totalGradeCredit: 0, totalCredit: 0 };
          }

          subjectGroups[subjectGroupName].totalGradeCredit += rankGrade * creditHours;
          subjectGroups[subjectGroupName].totalCredit += creditHours;
        }

        for (const [name, { totalGradeCredit, totalCredit }] of Object.entries(subjectGroups)) {
          if (totalCredit > 0) {
            subjectStrength[name] = totalGradeCredit / totalCredit;
          }
        }
      }

      return { subjectStrength };
    })(),
  ]);

  return {
    totalGpa: gpaResult.totalGpa,
    adjustedGpa: gpaResult.adjustedGpa,
    zIndex: zIndexResult.zIndex,
    subjectStrength: subjectResult.subjectStrength,
  };
}

