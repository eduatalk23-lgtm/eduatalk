// ============================================
// 파이프라인 태스크 러너 공용 헬퍼
// 역량 분석, 가이드, Synthesis 모두에서 사용되는 유틸 함수
// ============================================

import type {
  PipelineContext,
  GradeAnalysisContext,
  RecordAnalysisContext,
  CompetencyAnalysisContext,
} from "./pipeline-types";
import type { HighlightAnalysisResult, GuideAnalysisContext } from "./llm/types";

// ============================================
// 동시성 제어
// ============================================

/** 동시성 제한 병렬 실행 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (idx < items.length) {
        const i = idx++;
        await fn(items[i]);
      }
    },
  );
  await Promise.allSettled(workers);
}

// ============================================
// 분석 맥락 헬퍼 함수 (Phase 1-3 → Phase 4-6 전달)
// ============================================

/** B- 이하로 판단하는 역량 등급 집합 */
const WEAK_COMPETENCY_GRADES = new Set(["B-", "C"]);

/**
 * runCompetencyForRecords 결과에서 분석 맥락을 추출하여 ctx.analysisContext에 축적한다.
 * Phase 1-3(역량 분석) 완료 시 호출. 실패한 레코드는 allResults에 포함되지 않으므로 자동 제외.
 */
export function collectAnalysisContext(
  ctx: PipelineContext,
  targetGrade: number,
  recordType: "setek" | "changche" | "haengteuk",
  records: Array<{ id: string; subjectName?: string }>,
  allResults: Map<string, HighlightAnalysisResult>,
): void {
  // 맥락 초기화
  if (!ctx.analysisContext) ctx.analysisContext = {};
  if (!ctx.analysisContext[targetGrade]) {
    ctx.analysisContext[targetGrade] = { grade: targetGrade, qualityIssues: [], weakCompetencies: [] };
  }
  const gradeCtx: GradeAnalysisContext = ctx.analysisContext[targetGrade];

  // 레코드 ID → subjectName 매핑
  const subjectNameById = new Map(records.map((r) => [r.id, r.subjectName]));

  for (const [recordId, result] of allResults) {
    // recordType이 일치하는 결과만 처리 (행특 집계에서 전체가 allResults에 있을 수 있음)
    // records 배열에 해당 id가 없으면 이 호출의 대상이 아님
    if (!subjectNameById.has(recordId)) continue;

    // 품질 이슈 수집
    const cq = result.contentQuality;
    if (cq && cq.issues.length > 0) {
      const existing = gradeCtx.qualityIssues.find((q) => q.recordId === recordId);
      if (!existing) {
        const recordCtx: RecordAnalysisContext = {
          recordId,
          recordType,
          subjectName: subjectNameById.get(recordId),
          issues: cq.issues,
          feedback: cq.feedback,
          overallScore: cq.overallScore,
        };
        gradeCtx.qualityIssues.push(recordCtx);
      }
    }

    // 약점 역량 수집 (B- / C)
    for (const cg of result.competencyGrades) {
      if (!WEAK_COMPETENCY_GRADES.has(cg.grade)) continue;
      const alreadyPresent = gradeCtx.weakCompetencies.some(
        (wc) => wc.item === cg.item && wc.grade === cg.grade,
      );
      if (!alreadyPresent) {
        const weakCtx: CompetencyAnalysisContext = {
          item: cg.item,
          grade: cg.grade,
          reasoning: cg.reasoning ?? null,
          rubricScores: cg.rubricScores?.map((rs) => ({
            questionIndex: rs.questionIndex,
            grade: rs.grade,
            reasoning: rs.reasoning,
          })),
        };
        gradeCtx.weakCompetencies.push(weakCtx);
      }
    }
  }
}

/**
 * GradeAnalysisContext → GuideAnalysisContext 변환.
 * Phase 4-6(가이드 생성) 호출부에서 사용.
 * gradeCtx가 undefined이거나 데이터가 없으면 undefined를 반환(프롬프트 섹션 생략).
 */
export function toGuideAnalysisContext(gradeCtx: GradeAnalysisContext | undefined): GuideAnalysisContext | undefined {
  if (!gradeCtx) return undefined;

  const qualityIssues = gradeCtx.qualityIssues
    .filter((q) => q.issues.length > 0)
    .map((q) => ({
      recordType: q.recordType,
      issues: q.issues,
      feedback: q.feedback,
    }));

  if (qualityIssues.length === 0 && gradeCtx.weakCompetencies.length === 0) {
    return undefined;
  }

  return {
    qualityIssues,
    weakCompetencies: gradeCtx.weakCompetencies,
  };
}

/**
 * fetchReportData 결과에서 GuideAnalysisContext를 구성한다.
 * 파이프라인이 아닌 경로(컨설턴트 수동 재생성)에서 사용.
 * targetGrade/recordType을 지정하면 해당 범위로 필터링.
 */
export function buildGuideAnalysisContextFromReport(
  reportData: import("./actions/report").ReportData,
  targetGrade?: number,
  recordType?: "setek" | "changche" | "haengteuk",
): GuideAnalysisContext | undefined {
  const allQuality = reportData.contentQuality ?? [];
  const allWeak = reportData.weakCompetencyContexts ?? [];

  const filteredQuality = allQuality.filter((q) => {
    if (q.issues.length === 0) return false;
    if (recordType && q.record_type !== recordType) return false;
    return true;
  });

  const qualityIssues = filteredQuality.map((q) => ({
    recordType: q.record_type as "setek" | "changche" | "haengteuk",
    issues: q.issues,
    feedback: q.feedback ?? "",
  }));

  if (qualityIssues.length === 0 && allWeak.length === 0) return undefined;

  return {
    qualityIssues,
    weakCompetencies: allWeak,
  };
}

// targetGrade 파라미터는 현재 buildGuideAnalysisContextFromReport에서 필터링에 사용되지 않음
// (DB 조회가 아닌 reportData 전체에서 record_type만 필터링하므로)
// 향후 학년별 필터가 필요하면 record의 grade 필드를 참조하도록 확장 가능

/**
 * Impl-4: 이전 분석 학년의 보완방향을 프롬프트용 텍스트로 빌드.
 * retrospective 가이드를 DB에서 조회하여 학년별 요약 문자열을 반환.
 * @param supabase - Supabase 클라이언트
 * @param studentId - 학생 ID
 * @param currentSchoolYear - 현재(설계 대상) 학년도 (이 학년은 제외)
 */
export async function buildCrossGradeDirections(
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/lib/supabase/database.types").Database>,
  studentId: string,
  currentSchoolYear: number,
): Promise<string | undefined> {
  try {
  const [setekRes, changcheRes, haengteukRes] = await Promise.all([
    supabase.from("student_record_setek_guides")
      .select("school_year, direction, keywords")
      .eq("student_id", studentId)
      .eq("guide_mode", "retrospective")
      .neq("school_year", currentSchoolYear)
      .order("school_year", { ascending: true })
      .limit(20),
    supabase.from("student_record_changche_guides")
      .select("school_year, activity_type, direction, keywords")
      .eq("student_id", studentId)
      .eq("guide_mode", "retrospective")
      .neq("school_year", currentSchoolYear)
      .order("school_year", { ascending: true })
      .limit(10),
    supabase.from("student_record_haengteuk_guides")
      .select("school_year, direction, keywords")
      .eq("student_id", studentId)
      .eq("guide_mode", "retrospective")
      .neq("school_year", currentSchoolYear)
      .order("school_year", { ascending: true })
      .limit(5),
  ]);

  const sections: string[] = [];

  // 세특 보완방향
  const setekRows = (setekRes.data ?? []) as Array<{ school_year: number; direction: string; keywords: string[] }>;
  if (setekRows.length > 0) {
    const grouped = new Map<number, typeof setekRows>();
    for (const r of setekRows) {
      if (!grouped.has(r.school_year)) grouped.set(r.school_year, []);
      grouped.get(r.school_year)!.push(r);
    }
    for (const [year, rows] of grouped) {
      sections.push(`### ${year}학년도 세특 보완방향`);
      for (const r of rows.slice(0, 5)) {
        const kw = r.keywords?.length > 0 ? ` (${r.keywords.slice(0, 3).join(", ")})` : "";
        sections.push(`- ${r.direction.slice(0, 200)}${kw}`);
      }
    }
  }

  // 창체 보완방향
  const changcheRows = (changcheRes.data ?? []) as Array<{ school_year: number; activity_type: string; direction: string; keywords: string[] }>;
  if (changcheRows.length > 0) {
    const LABELS: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
    const grouped = new Map<number, typeof changcheRows>();
    for (const r of changcheRows) {
      if (!grouped.has(r.school_year)) grouped.set(r.school_year, []);
      grouped.get(r.school_year)!.push(r);
    }
    for (const [year, rows] of grouped) {
      sections.push(`### ${year}학년도 창체 보완방향`);
      for (const r of rows) {
        sections.push(`- [${LABELS[r.activity_type] ?? r.activity_type}] ${r.direction.slice(0, 200)}`);
      }
    }
  }

  // 행특 보완방향
  const haengteukRows = (haengteukRes.data ?? []) as Array<{ school_year: number; direction: string; keywords: string[] }>;
  if (haengteukRows.length > 0) {
    for (const r of haengteukRows) {
      sections.push(`### ${r.school_year}학년도 행특 보완방향`);
      sections.push(`- ${r.direction.slice(0, 300)}`);
    }
  }

  return sections.length > 0 ? sections.join("\n") : undefined;
  } catch {
    // cross-grade 조회 실패는 치명적이지 않음 — 해당 섹션 없이 진행
    return undefined;
  }
}
