/**
 * 코호트 벤치마크 스냅샷 계산
 *
 * tenant-scoped: 동일 기관 내 동일 진로 학생 간 비교만 수행.
 * 개인정보 보호: cohortSize < 5이면 통계 미산출.
 *
 * 사용처: scripts/cohort-benchmark-refresh.ts (배치), report.ts (리포트)
 * 주의: createSupabaseAdminClient() 사용 — server-only
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ─── grade_value → 숫자 변환 ──────────────────────────────────────────────

export const GRADE_TO_NUMERIC: Record<string, number> = {
  "A+": 5,
  "A-": 4,
  "B+": 3.5,
  B: 3,
  "B-": 2.5,
  C: 1.5,
};

// ─── 타입 ─────────────────────────────────────────────────────────────────

export interface CohortBenchmark {
  tenantId: string;
  targetMajor: string;
  schoolYear: number;
  grade: number | null;
  cohortSize: number;
  avgGpa: number | null;
  medianGpa: number | null;
  minGpa: number | null;
  maxGpa: number | null;
  p25Gpa: number | null;
  p75Gpa: number | null;
  avgAcademic: number | null;
  avgCareer: number | null;
  avgCommunity: number | null;
  avgQualityScore: number | null;
  topCourses: Array<{ subjectName: string; takeRate: number }>;
  admissionCount: number;
  acceptanceRate: number | null;
}

// ─── GPA 퍼센타일 유틸 ────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)] ?? null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round2(n: number | null): number | null {
  if (n == null) return null;
  return Math.round(n * 100) / 100;
}

function round1(n: number | null): number | null {
  if (n == null) return null;
  return Math.round(n * 10) / 10;
}

// ─── 메인: 코호트 스냅샷 계산 ─────────────────────────────────────────────

/**
 * 동일 tenant + target_major + school_year (+ optional grade) 학생 코호트의
 * 통계를 계산한다.
 */
export async function computeCohortBenchmark(
  tenantId: string,
  targetMajor: string,
  schoolYear: number,
  grade?: number,
): Promise<CohortBenchmark> {
  const supabase = createSupabaseAdminClient();

  // 1. 코호트 학생 ID 목록
  let studentsQuery = supabase
    .from("students")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("target_major", targetMajor);

  if (grade != null) {
    studentsQuery = studentsQuery.eq("grade", grade);
  }

  const { data: studentsRaw } = await studentsQuery;
  const studentIds = (studentsRaw ?? []).map((s: { id: string }) => s.id);

  const cohortSize = studentIds.length;

  if (cohortSize < 5) {
    // 개인정보 보호: 코호트 5명 미만이면 통계 미산출
    return {
      tenantId,
      targetMajor,
      schoolYear,
      grade: grade ?? null,
      cohortSize,
      avgGpa: null,
      medianGpa: null,
      minGpa: null,
      maxGpa: null,
      p25Gpa: null,
      p75Gpa: null,
      avgAcademic: null,
      avgCareer: null,
      avgCommunity: null,
      avgQualityScore: null,
      topCourses: [],
      admissionCount: 0,
      acceptanceRate: null,
    };
  }

  // 병렬 조회
  const [gpaRes, competencyRes, qualityRes, coursePlanRes] = await Promise.allSettled([
    // 2. GPA 분포
    supabase
      .from("student_internal_scores")
      .select("grade_rank, score")
      .in("student_id", studentIds),
    // 3. 역량 점수
    supabase
      .from("student_record_competency_scores")
      .select("student_id, competency_area, grade_value")
      .in("student_id", studentIds),
    // 4. 콘텐츠 품질
    supabase
      .from("student_record_content_quality")
      .select("student_id, overall_score")
      .in("student_id", studentIds),
    // 5. 수강 계획 (과목별 이수 학생 수)
    supabase
      .from("student_course_plans")
      .select("student_id, subject_id, subjects(name)")
      .in("student_id", studentIds)
      .not("subject_id", "is", null),
  ]);

  // ── GPA 분포 ──
  const gpaRows = gpaRes.status === "fulfilled" ? (gpaRes.value.data ?? []) : [];
  // grade_rank: 9등급제 (1=최상, 9=최하) — 낮을수록 좋음.
  // percentile 계산 시 gpaPercentileRank()에서 역순 적용 (100 - rank).
  // score: raw 점수 필드 (grade_rank 없을 때 fallback).
  const gpaValues = gpaRows
    .map((r: { grade_rank?: number | null; score?: number | null }) => r.grade_rank ?? r.score)
    .filter((v): v is number => v != null && !isNaN(v));
  const sortedGpa = [...gpaValues].sort((a, b) => a - b);

  const avgGpa = round2(average(gpaValues));
  const medianGpa = round2(percentile(sortedGpa, 0.5));
  const minGpa = sortedGpa[0] ?? null;
  const maxGpa = sortedGpa[sortedGpa.length - 1] ?? null;
  const p25Gpa = round2(percentile(sortedGpa, 0.25));
  const p75Gpa = round2(percentile(sortedGpa, 0.75));

  // ── 역량 평균 ──
  const competencyRows = competencyRes.status === "fulfilled" ? (competencyRes.value.data ?? []) : [];

  function avgCompetency(area: string): number | null {
    const vals = competencyRows
      .filter((r: { competency_area: string; grade_value?: string | null }) => r.competency_area === area)
      .map((r: { grade_value?: string | null }) => GRADE_TO_NUMERIC[r.grade_value ?? ""] ?? null)
      .filter((v): v is number => v != null);
    return round1(average(vals));
  }

  const avgAcademic = avgCompetency("academic");
  const avgCareer = avgCompetency("career");
  const avgCommunity = avgCompetency("community");

  // ── 품질 점수 평균 ──
  const qualityRows = qualityRes.status === "fulfilled" ? (qualityRes.value.data ?? []) : [];
  const qualityVals = qualityRows
    .map((r: { overall_score?: number | null }) => r.overall_score)
    .filter((v): v is number => v != null);
  const avgQualityScore = round1(average(qualityVals));

  // ── 수강 패턴 (상위 10 과목 이수율) ──
  const coursePlanRows = coursePlanRes.status === "fulfilled" ? (coursePlanRes.value.data ?? []) : [];

  const subjectCount = new Map<string, { name: string; count: number }>();
  for (const row of coursePlanRows as Array<{ subject_id: string; subjects?: { name: string } | null }>) {
    const name = row.subjects?.name;
    if (!name) continue;
    const entry = subjectCount.get(row.subject_id) ?? { name, count: 0 };
    entry.count++;
    subjectCount.set(row.subject_id, entry);
  }

  const topCourses = [...subjectCount.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((s) => ({
      subjectName: s.name,
      takeRate: Math.round((s.count / cohortSize) * 100) / 100,
    }));

  return {
    tenantId,
    targetMajor,
    schoolYear,
    grade: grade ?? null,
    cohortSize,
    avgGpa,
    medianGpa,
    minGpa,
    maxGpa,
    p25Gpa,
    p75Gpa,
    avgAcademic,
    avgCareer,
    avgCommunity,
    avgQualityScore,
    topCourses,
    admissionCount: 0,
    acceptanceRate: null,
  };
}

// ─── 최신 스냅샷 조회 ─────────────────────────────────────────────────────

export async function fetchLatestCohortBenchmark(
  tenantId: string,
  targetMajor: string,
  schoolYear: number,
  grade?: number,
): Promise<CohortBenchmark | null> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("student_cohort_benchmarks")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("target_major", targetMajor)
    .eq("school_year", schoolYear)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (grade != null) {
    query = query.eq("grade", grade);
  } else {
    query = query.is("grade", null);
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;

  return {
    tenantId: data.tenant_id,
    targetMajor: data.target_major,
    schoolYear: data.school_year,
    grade: data.grade ?? null,
    cohortSize: data.cohort_size,
    avgGpa: data.avg_gpa != null ? Number(data.avg_gpa) : null,
    medianGpa: data.median_gpa != null ? Number(data.median_gpa) : null,
    minGpa: data.min_gpa != null ? Number(data.min_gpa) : null,
    maxGpa: data.max_gpa != null ? Number(data.max_gpa) : null,
    p25Gpa: data.p25_gpa != null ? Number(data.p25_gpa) : null,
    p75Gpa: data.p75_gpa != null ? Number(data.p75_gpa) : null,
    avgAcademic: data.avg_academic != null ? Number(data.avg_academic) : null,
    avgCareer: data.avg_career != null ? Number(data.avg_career) : null,
    avgCommunity: data.avg_community != null ? Number(data.avg_community) : null,
    avgQualityScore: data.avg_quality_score != null ? Number(data.avg_quality_score) : null,
    topCourses: Array.isArray(data.top_courses) ? (data.top_courses as Array<{ subjectName: string; takeRate: number }>) : [],
    admissionCount: data.admission_count ?? 0,
    acceptanceRate: data.acceptance_rate != null ? Number(data.acceptance_rate) : null,
  };
}

// ─── 스냅샷 저장 (upsert) ─────────────────────────────────────────────────

export async function saveCohortBenchmark(benchmark: CohortBenchmark): Promise<void> {
  const supabase = createSupabaseAdminClient();

  await supabase.from("student_cohort_benchmarks").upsert(
    {
      tenant_id: benchmark.tenantId,
      target_major: benchmark.targetMajor,
      school_year: benchmark.schoolYear,
      grade: benchmark.grade,
      snapshot_date: new Date().toISOString().slice(0, 10),
      cohort_size: benchmark.cohortSize,
      avg_gpa: benchmark.avgGpa,
      median_gpa: benchmark.medianGpa,
      min_gpa: benchmark.minGpa,
      max_gpa: benchmark.maxGpa,
      p25_gpa: benchmark.p25Gpa,
      p75_gpa: benchmark.p75Gpa,
      avg_academic: benchmark.avgAcademic,
      avg_career: benchmark.avgCareer,
      avg_community: benchmark.avgCommunity,
      avg_quality_score: benchmark.avgQualityScore,
      top_courses: benchmark.topCourses,
      admission_count: benchmark.admissionCount,
      acceptance_rate: benchmark.acceptanceRate,
    },
    {
      onConflict: "tenant_id,target_major,school_year,grade,snapshot_date",
    },
  );
}
