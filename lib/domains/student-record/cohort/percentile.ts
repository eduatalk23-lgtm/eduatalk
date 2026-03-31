/**
 * 개별 학생 코호트 퍼센타일 계산
 *
 * tenant-scoped: 동일 기관 내 동일 진로 학생 간 비교.
 * 개인정보 보호: cohortSize < 5이면 null 반환.
 *
 * 주의: createSupabaseAdminClient() 사용 — server-only
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GRADE_TO_NUMERIC } from "./benchmark";

// ─── 타입 ─────────────────────────────────────────────────────────────────

export interface StudentPercentile {
  /** GPA 상위 N% (낮은 GPA = 좋음 → 역순). 데이터 부족 시 null. */
  gpaPercentile: number | null;
  /** 학업역량 퍼센타일 (높을수록 좋음). 데이터 부족 시 null. */
  academicPercentile: number | null;
  /** 진로역량 퍼센타일. 데이터 부족 시 null. */
  careerPercentile: number | null;
  /** 공동체역량 퍼센타일. 데이터 부족 시 null. */
  communityPercentile: number | null;
  /** 콘텐츠 품질 퍼센타일. 데이터 부족 시 null. */
  qualityPercentile: number | null;
  /** 가중 종합 퍼센타일. 데이터 부족 시 null. */
  overallPercentile: number | null;
  cohortSize: number;
  cohortAvgGpa: number | null;
  /** "~이 코호트 상위 N%" */
  strengthsVsCohort: string[];
  /** "~이 코호트 하위 N%" */
  weaknessesVsCohort: string[];
}

// ─── 퍼센타일 계산 유틸 ───────────────────────────────────────────────────

/**
 * 값 목록에서 studentValue의 퍼센타일 순위를 반환.
 * 높을수록 좋은 지표(역량 등)에 사용.
 */
function percentileRank(values: number[], studentValue: number): number {
  if (values.length === 0) return 50;
  const below = values.filter((v) => v < studentValue).length;
  const equal = values.filter((v) => v === studentValue).length;
  return Math.round(((below + equal * 0.5) / values.length) * 100);
}

/**
 * GPA 퍼센타일: grade_rank는 1(최상)~9(최하)로 낮을수록 좋음.
 * percentileRank()는 높을수록 좋은 지표용이므로 역순 변환:
 *   "상위 N%" = 100 - percentileRank(values, studentValue)
 * 예) 전체 중 GPA가 가장 낮은(좋은) 학생 → percentileRank ≈ 0 → gpaPercentileRank ≈ 100 (상위 0%)
 */
function gpaPercentileRank(values: number[], studentValue: number): number {
  return 100 - percentileRank(values, studentValue);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ─── 메인: 학생 퍼센타일 계산 ─────────────────────────────────────────────

export async function computeStudentPercentile(
  studentId: string,
  tenantId: string,
): Promise<StudentPercentile | null> {
  const supabase = createSupabaseAdminClient();

  // 1. 학생 정보 (target_major, grade, school_year)
  const { data: studentRow } = await supabase
    .from("students")
    .select("target_major, grade")
    .eq("id", studentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!studentRow?.target_major) return null;

  const { target_major: targetMajor, grade: studentGrade } = studentRow;

  // 2. 코호트 학생 ID 목록 (동일 major, 동일 기관)
  let coQuery = supabase
    .from("students")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("target_major", targetMajor);

  if (studentGrade != null) {
    coQuery = coQuery.eq("grade", studentGrade);
  }

  const { data: cohortStudentsRaw } = await coQuery;
  const cohortIds = (cohortStudentsRaw ?? []).map((s: { id: string }) => s.id);

  if (cohortIds.length < 5) return null;

  // 3. 병렬 데이터 조회 (6개 Promise를 동시 실행 — N+1 없음)
  // 코호트 전체(GPA/역량/품질)와 본인 데이터를 단일 Promise.allSettled로 묶어 병렬 처리.
  // Supabase REST API JOIN 한계상 테이블별 별도 쿼리이나 순차 실행은 아님.
  const [gpaRes, competencyRes, qualityRes, myGpaRes, myCompetencyRes, myQualityRes] =
    await Promise.allSettled([
      supabase
        .from("student_internal_scores")
        .select("student_id, grade_rank, score")
        .in("student_id", cohortIds),
      supabase
        .from("student_record_competency_scores")
        .select("student_id, competency_area, grade_value")
        .in("student_id", cohortIds),
      supabase
        .from("student_record_content_quality")
        .select("student_id, quality_score")
        .in("student_id", cohortIds),
      // 이 학생의 GPA
      supabase
        .from("student_internal_scores")
        .select("grade_rank, score")
        .eq("student_id", studentId),
      // 이 학생의 역량
      supabase
        .from("student_record_competency_scores")
        .select("competency_area, grade_value")
        .eq("student_id", studentId),
      // 이 학생의 품질
      supabase
        .from("student_record_content_quality")
        .select("quality_score")
        .eq("student_id", studentId),
    ]);

  // ── 코호트 GPA 배열 ──
  type GpaRow = { student_id: string; grade_rank?: number | null; score?: number | null };
  const gpaRows: GpaRow[] = gpaRes.status === "fulfilled" ? (gpaRes.value.data ?? []) : [];

  // 학생별 평균 GPA (여러 학기 → 평균)
  const gpaByStudent = new Map<string, number[]>();
  for (const row of gpaRows) {
    const val = row.grade_rank ?? row.score;
    if (val == null || isNaN(val)) continue;
    const arr = gpaByStudent.get(row.student_id) ?? [];
    arr.push(val);
    gpaByStudent.set(row.student_id, arr);
  }
  const cohortGpaValues = cohortIds
    .map((id) => {
      const vals = gpaByStudent.get(id);
      return vals && vals.length > 0 ? average(vals) : null;
    })
    .filter((v): v is number => v != null);

  const cohortAvgGpa = cohortGpaValues.length > 0 ? average(cohortGpaValues) : null;
  const cohortAvgGpaRounded = cohortAvgGpa != null ? Math.round(cohortAvgGpa * 100) / 100 : null;

  // 이 학생의 GPA
  type MyGpaRow = { grade_rank?: number | null; score?: number | null };
  const myGpaRows: MyGpaRow[] = myGpaRes.status === "fulfilled" ? (myGpaRes.value.data ?? []) : [];
  const myGpaVals = myGpaRows
    .map((r) => r.grade_rank ?? r.score)
    .filter((v): v is number => v != null);
  const myGpa = myGpaVals.length > 0 ? average(myGpaVals) : null;

  // ── 코호트 역량 배열 ──
  type CompRow = { student_id: string; competency_area: string; grade_value?: string | null };
  const competencyRows: CompRow[] = competencyRes.status === "fulfilled" ? (competencyRes.value.data ?? []) : [];

  function cohortAreaValues(area: string): number[] {
    return competencyRows
      .filter((r) => r.competency_area === area)
      .map((r) => GRADE_TO_NUMERIC[r.grade_value ?? ""] ?? null)
      .filter((v): v is number => v != null);
  }

  const cohortAcademic = cohortAreaValues("academic");
  const cohortCareer = cohortAreaValues("career");
  const cohortCommunity = cohortAreaValues("community");

  // 이 학생의 역량
  type MyCompRow = { competency_area: string; grade_value?: string | null };
  const myCompRows: MyCompRow[] = myCompetencyRes.status === "fulfilled" ? (myCompetencyRes.value.data ?? []) : [];

  function myAreaValue(area: string): number | null {
    const rows = myCompRows.filter((r) => r.competency_area === area);
    const vals = rows.map((r) => GRADE_TO_NUMERIC[r.grade_value ?? ""] ?? null).filter((v): v is number => v != null);
    return vals.length > 0 ? (average(vals) ?? null) : null;
  }

  const myAcademic = myAreaValue("academic");
  const myCareer = myAreaValue("career");
  const myCommunity = myAreaValue("community");

  // ── 코호트 품질 배열 ──
  type QualRow = { student_id: string; quality_score?: number | null };
  const qualityRows: QualRow[] = qualityRes.status === "fulfilled" ? (qualityRes.value.data ?? []) : [];
  const cohortQuality = qualityRows
    .map((r) => r.quality_score)
    .filter((v): v is number => v != null);

  type MyQualRow = { quality_score?: number | null };
  const myQualityRows: MyQualRow[] = myQualityRes.status === "fulfilled" ? (myQualityRes.value.data ?? []) : [];
  const myQuality = myQualityRows[0]?.quality_score ?? null;

  // ── 퍼센타일 계산 ──
  // 데이터가 없는 차원은 null (50 기본값은 통계적으로 오해 소지 있음)
  const gpaP: number | null = myGpa != null && cohortGpaValues.length > 0
    ? gpaPercentileRank(cohortGpaValues, myGpa)
    : null;
  const academicP: number | null = myAcademic != null && cohortAcademic.length > 0
    ? percentileRank(cohortAcademic, myAcademic)
    : null;
  const careerP: number | null = myCareer != null && cohortCareer.length > 0
    ? percentileRank(cohortCareer, myCareer)
    : null;
  const communityP: number | null = myCommunity != null && cohortCommunity.length > 0
    ? percentileRank(cohortCommunity, myCommunity)
    : null;
  const qualityP: number | null = myQuality != null && cohortQuality.length > 0
    ? percentileRank(cohortQuality, myQuality)
    : null;

  // 종합 퍼센타일: 유효한 차원만으로 가중 평균 (GPA 30%, 역량 각 20%, 품질 10%)
  // 특정 차원 데이터가 없을 경우 나머지 차원으로만 계산
  const WEIGHTS: Array<{ value: number | null; weight: number }> = [
    { value: gpaP, weight: 0.3 },
    { value: academicP, weight: 0.2 },
    { value: careerP, weight: 0.2 },
    { value: communityP, weight: 0.2 },
    { value: qualityP, weight: 0.1 },
  ];
  const validWeights = WEIGHTS.filter((w): w is { value: number; weight: number } => w.value != null);
  const totalWeight = validWeights.reduce((sum, w) => sum + w.weight, 0);
  const overallPercentile: number | null = validWeights.length > 0
    ? Math.round(validWeights.reduce((sum, w) => sum + w.value * w.weight, 0) / totalWeight)
    : null;

  // ── 강점 / 약점 생성 ──
  const strengthsVsCohort: string[] = [];
  const weaknessesVsCohort: string[] = [];

  const metrics: Array<{ label: string; percentile: number | null }> = [
    { label: "GPA", percentile: gpaP },
    { label: "학업역량", percentile: academicP },
    { label: "진로역량", percentile: careerP },
    { label: "공동체역량", percentile: communityP },
    { label: "콘텐츠 품질", percentile: qualityP },
  ];

  for (const m of metrics) {
    if (m.percentile == null) continue;
    if (m.percentile > 70) {
      strengthsVsCohort.push(`${m.label}이 코호트 상위 ${100 - m.percentile}%`);
    } else if (m.percentile < 30) {
      weaknessesVsCohort.push(`${m.label}이 코호트 하위 ${m.percentile}%`);
    }
  }

  return {
    gpaPercentile: gpaP != null ? Math.round(gpaP) : null,
    academicPercentile: academicP != null ? Math.round(academicP) : null,
    careerPercentile: careerP != null ? Math.round(careerP) : null,
    communityPercentile: communityP != null ? Math.round(communityP) : null,
    qualityPercentile: qualityP != null ? Math.round(qualityP) : null,
    overallPercentile,
    cohortSize: cohortIds.length,
    cohortAvgGpa: cohortAvgGpaRounded,
    strengthsVsCohort,
    weaknessesVsCohort,
  };
}
