// ============================================
// 파이프라인 태스크 러너 공용 헬퍼
// 역량 분석, 가이드, Synthesis 모두에서 사용되는 유틸 함수
// ============================================

import type {
  PipelineContext,
  GradeAnalysisContext,
  RecordAnalysisContext,
  CompetencyAnalysisContext,
  StudentProfileCard,
} from "./pipeline-types";
import type { HighlightAnalysisResult, GuideAnalysisContext, GuideWarningPattern, GradeThemeExtractionResult, GradeCrossSubjectThemesContext } from "../llm/types";
import { matchPattern } from "@/lib/domains/student-record/warnings/checkers-quality";
import { SCIENTIFIC_PATTERN_CODES } from "@/lib/domains/student-record/evaluation-criteria/defaults";

// ============================================
// 동시성 제어
// ============================================

/** 동시성 제한 병렬 실행
 *
 * opts.shouldCancel가 제공되면 각 작업 직전에 호출하여 true 반환 시
 * 새 작업을 시작하지 않는다(in-progress 작업은 정상 완료까지 기다림).
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  opts?: { shouldCancel?: () => Promise<boolean> | boolean },
): Promise<{ cancelled: boolean }> {
  if (items.length === 0) return { cancelled: false };
  let idx = 0;
  let cancelled = false;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (idx < items.length) {
        if (cancelled) return;
        if (opts?.shouldCancel && (await opts.shouldCancel())) {
          cancelled = true;
          return;
        }
        const i = idx++;
        await fn(items[i]);
      }
    },
  );
  await Promise.allSettled(workers);
  return { cancelled };
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
 * E1: issues 배열에서 경고 패턴 메타데이터를 추출한다.
 * PATTERN_MAP (P1/P3/P4/F10/F12/F16/M1) + SCIENTIFIC_PATTERN_CODES (F1~F6) 매칭.
 * 중복 ruleId는 1회만 포함.
 */
function extractWarningPatterns(allIssues: string[]): GuideWarningPattern[] {
  const patterns: GuideWarningPattern[] = [];
  const seenRuleIds = new Set<string>();
  const scientificCodes: string[] = [];

  for (const issue of allIssues) {
    // 개별 패턴 매칭 (P1, P3, P4, F10, F12, F16, M1)
    const mapping = matchPattern(issue);
    if (mapping && !seenRuleIds.has(mapping.ruleId)) {
      seenRuleIds.add(mapping.ruleId);
      patterns.push({
        code: issue,
        severity: mapping.severity,
        title: mapping.title,
        suggestion: mapping.suggestion,
      });
    }

    // 과학적 정합성 패턴 (F1~F6) 수집
    const normalized = issue.replace(/[\s:_]/g, "");
    if (SCIENTIFIC_PATTERN_CODES.some((p) => normalized.startsWith(p.split("_")[0]))) {
      scientificCodes.push(issue);
    }
  }

  // 과학적 정합성 통합 경고 (F1~F6)
  if (scientificCodes.length > 0 && !seenRuleIds.has("content_quality_scientific")) {
    patterns.push({
      code: scientificCodes[0],
      severity: scientificCodes.length >= 2 ? "high" : "medium",
      title: `과학적 정합성 문제 ${scientificCodes.length}건`,
      suggestion: "탐구 전제-실험-결론의 논리적 연결과 개념 정확성을 검토하세요",
    });
  }

  // severity 높은 순 정렬 (high → medium → low)
  const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  patterns.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));

  return patterns;
}

/**
 * H1: GradeThemeExtractionResult → GuideAnalysisContext에 주입할 컨텍스트로 압축.
 * dominantThemeIds 기준으로 themes 배열을 필터링·정렬하여 가이드 프롬프트 토큰을 절감한다.
 * dominant가 없으면 undefined.
 */
export function toCrossSubjectThemesContext(
  themes: GradeThemeExtractionResult | undefined,
): GradeCrossSubjectThemesContext | undefined {
  if (!themes || themes.themes.length === 0) return undefined;
  const themeById = new Map(themes.themes.map((t) => [t.id, t]));
  const dominantThemes = themes.dominantThemeIds
    .map((id) => themeById.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((t) => ({
      id: t.id,
      label: t.label,
      keywords: t.keywords.slice(0, 5),
      affectedSubjects: t.affectedSubjects.slice(0, 5),
      subjectCount: t.subjectCount,
      ...(t.evolutionSignal ? { evolutionSignal: t.evolutionSignal } : {}),
    }));
  if (dominantThemes.length === 0) return undefined;
  return {
    dominantThemes,
    crossSubjectPatternCount: themes.crossSubjectPatternCount,
  };
}

/**
 * GradeAnalysisContext → GuideAnalysisContext 변환.
 * Phase 4-6(가이드 생성) 호출부에서 사용.
 * gradeCtx가 undefined이거나 데이터가 없으면 undefined를 반환(프롬프트 섹션 생략).
 *
 * @param gradeCtx 학년별 역량 분석 맥락
 * @param gradeThemes (옵션) H1 cross-subject 테마 결과 — 있으면 dominant만 추출하여 주입.
 *                    qualityIssues/weakCompetencies가 모두 비어 있어도 themes만 있으면 컨텍스트 반환.
 */
export function toGuideAnalysisContext(
  gradeCtx: GradeAnalysisContext | undefined,
  gradeThemes?: GradeThemeExtractionResult,
): GuideAnalysisContext | undefined {
  const crossSubjectThemes = toCrossSubjectThemesContext(gradeThemes);

  if (!gradeCtx) {
    return crossSubjectThemes ? { qualityIssues: [], weakCompetencies: [], crossSubjectThemes } : undefined;
  }

  const qualityIssues = gradeCtx.qualityIssues
    .filter((q) => q.issues.length > 0)
    .map((q) => ({
      recordType: q.recordType,
      issues: q.issues,
      feedback: q.feedback,
    }));

  if (qualityIssues.length === 0 && gradeCtx.weakCompetencies.length === 0 && !crossSubjectThemes) {
    return undefined;
  }

  // E1: issues에서 경고 패턴 메타데이터 추출
  const allIssues = [...new Set(qualityIssues.flatMap((qi) => qi.issues))];
  const warningPatterns = extractWarningPatterns(allIssues);

  return {
    qualityIssues,
    weakCompetencies: gradeCtx.weakCompetencies,
    warningPatterns: warningPatterns.length > 0 ? warningPatterns : undefined,
    ...(crossSubjectThemes ? { crossSubjectThemes } : {}),
  };
}

/**
 * 여러 학년의 GuideAnalysisContext를 하나로 병합한다.
 * NEIS 경로에서 복수 학년을 한 번에 가이드 생성할 때 사용.
 */
export function mergeGuideAnalysisContexts(
  contexts: (GuideAnalysisContext | undefined)[],
): GuideAnalysisContext | undefined {
  const defined = contexts.filter((c): c is GuideAnalysisContext => c != null);
  if (defined.length === 0) return undefined;

  // weakCompetencies는 item 기준으로 중복 제거 (가장 낮은 등급 유지)
  const GRADE_NUM: Record<string, number> = { "A+": 5, "A-": 4, "B+": 3, "B": 2, "B-": 1, "C": 0 };
  const SEVERITY_NUM: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const weakMap = new Map<string, CompetencyAnalysisContext>();
  for (const ctx of defined) {
    for (const wc of ctx.weakCompetencies) {
      const existing = weakMap.get(wc.item);
      if (!existing || (GRADE_NUM[wc.grade] ?? 2) < (GRADE_NUM[existing.grade] ?? 2)) {
        weakMap.set(wc.item, wc);
      }
    }
  }

  // E1: warningPatterns 병합 (ruleId 기반 중복 제거, severity 높은 쪽 유지)
  const patternMap = new Map<string, GuideWarningPattern>();
  for (const ctx of defined) {
    for (const wp of ctx.warningPatterns ?? []) {
      const existing = patternMap.get(wp.title);
      if (!existing || (SEVERITY_NUM[wp.severity] ?? 3) < (SEVERITY_NUM[existing.severity] ?? 3)) {
        patternMap.set(wp.title, wp);
      }
    }
  }
  const mergedPatterns = [...patternMap.values()];
  mergedPatterns.sort((a, b) => (SEVERITY_NUM[a.severity] ?? 3) - (SEVERITY_NUM[b.severity] ?? 3));

  // H1: crossSubjectThemes 병합 — 학년별로 dominant가 다를 수 있으므로 단순 병합 후 dedup
  const themeMap = new Map<string, GradeCrossSubjectThemesContext["dominantThemes"][number]>();
  let totalCrossSubjectPattern = 0;
  for (const ctx of defined) {
    if (!ctx.crossSubjectThemes) continue;
    totalCrossSubjectPattern += ctx.crossSubjectThemes.crossSubjectPatternCount;
    for (const t of ctx.crossSubjectThemes.dominantThemes) {
      if (!themeMap.has(t.id)) themeMap.set(t.id, t);
    }
  }
  const mergedThemes = [...themeMap.values()];
  const crossSubjectThemes: GradeCrossSubjectThemesContext | undefined =
    mergedThemes.length > 0
      ? { dominantThemes: mergedThemes, crossSubjectPatternCount: totalCrossSubjectPattern }
      : undefined;

  return {
    qualityIssues: defined.flatMap((c) => c.qualityIssues),
    weakCompetencies: [...weakMap.values()],
    warningPatterns: mergedPatterns.length > 0 ? mergedPatterns : undefined,
    ...(crossSubjectThemes ? { crossSubjectThemes } : {}),
  };
}

/**
 * fetchReportData 결과에서 GuideAnalysisContext를 구성한다.
 * 파이프라인이 아닌 경로(컨설턴트 수동 재생성)에서 사용.
 * targetGrade/recordType을 지정하면 해당 범위로 필터링.
 */
export function buildGuideAnalysisContextFromReport(
  reportData: import("@/lib/domains/student-record/actions/report").ReportData,
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

  // E1: issues에서 경고 패턴 메타데이터 추출
  const allIssues = [...new Set(qualityIssues.flatMap((qi) => qi.issues))];
  const warningPatterns = extractWarningPatterns(allIssues);

  return {
    qualityIssues,
    weakCompetencies: allWeak,
    warningPatterns: warningPatterns.length > 0 ? warningPatterns : undefined,
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
      grouped.get(r.school_year)?.push(r);
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
      grouped.get(r.school_year)?.push(r);
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

// ============================================
// Layer 0: 학생 프로필 카드 빌더
// buildCrossGradeDirections와 동일 패턴 — 실패는 non-fatal, undefined 반환
// P1-P3 역량 분석 시 모든 셀 프롬프트에 주입되는 글로벌 맥락
// ============================================

const GRADE_TO_NUMERIC: Record<string, number> = {
  "A+": 6, "A-": 5, "B+": 4, "B": 3, "B-": 2, "C": 1,
};
const NUMERIC_TO_GRADE = ["C", "B-", "B", "B+", "A-", "A+"] as const;

/**
 * 이전 학년(priorSchoolYears)의 `competency_scores` + `content_quality` (source=ai)를
 * 집계하여 `StudentProfileCard` 반환. 분석 대상이 1학년이면 prior 없음 → undefined.
 *
 * @param targetSchoolYear 현재 분석 대상의 school_year (예: 학생 3학년 = 올해 = 2026)
 * @param targetGrade      현재 분석 대상의 학년 (1/2/3). priors는 1..targetGrade-1 범위.
 *
 * - 지속 강점: 최고 등급 ≥ A- (≥ 5)
 * - 지속 약점: B-/C 등급이 ≥2개 학년에서 등장 (targetGrade=2면 ≥1로 완화)
 * - 반복 품질 이슈: count ≥ 2인 issue code top 3
 *
 * 실패(DB/파싱 오류)는 non-fatal — undefined 반환으로 프롬프트 섹션 생략.
 */
export async function buildStudentProfileCard(
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/lib/supabase/database.types").Database>,
  studentId: string,
  tenantId: string,
  targetSchoolYear: number,
  targetGrade: number,
): Promise<StudentProfileCard | undefined> {
  if (targetGrade <= 1) return undefined;
  const priorSchoolYears: number[] = [];
  for (let g = 1; g < targetGrade; g++) {
    priorSchoolYears.push(targetSchoolYear - targetGrade + g);
  }
  if (priorSchoolYears.length === 0) return undefined;

  try {
    const [scoresRes, qualityRes] = await Promise.all([
      supabase.from("student_record_competency_scores")
        .select("school_year, competency_item, grade")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .eq("source", "ai")
        .in("school_year", priorSchoolYears)
        .limit(200),
      supabase.from("student_record_content_quality")
        .select("school_year, overall_score, issues")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .eq("source", "ai")
        .in("school_year", priorSchoolYears)
        .limit(500),
    ]);

    const scores = (scoresRes.data ?? []) as Array<{
      school_year: number;
      competency_item: string;
      grade: string;
    }>;
    const quality = (qualityRes.data ?? []) as Array<{
      school_year: number;
      overall_score: number | null;
      issues: string[] | null;
    }>;

    if (scores.length === 0 && quality.length === 0) return undefined;

    // --- 역량 집계 ---
    let totalNumeric = 0;
    let totalCount = 0;
    const itemData = new Map<string, { grades: Array<{ year: number; numeric: number; label: string }> }>();
    for (const row of scores) {
      const numeric = GRADE_TO_NUMERIC[row.grade];
      if (numeric == null) continue;
      totalNumeric += numeric;
      totalCount++;
      const entry = itemData.get(row.competency_item) ?? { grades: [] };
      entry.grades.push({ year: row.school_year, numeric, label: row.grade });
      itemData.set(row.competency_item, entry);
    }
    const overallAverageGrade = totalCount > 0
      ? NUMERIC_TO_GRADE[Math.max(0, Math.min(5, Math.round(totalNumeric / totalCount) - 1))]
      : "B";

    const persistentStrengths: StudentProfileCard["persistentStrengths"] = [];
    const weakThreshold = targetGrade >= 3 ? 2 : 1;
    const persistentWeaknesses: StudentProfileCard["persistentWeaknesses"] = [];

    for (const [item, data] of itemData) {
      const maxNumeric = Math.max(...data.grades.map((g) => g.numeric));
      if (maxNumeric >= 5) {
        const best = data.grades.reduce((a, b) => (a.numeric >= b.numeric ? a : b));
        persistentStrengths.push({
          competencyItem: item,
          bestGrade: best.label,
          years: data.grades.map((g) => g.year).sort((a, b) => a - b),
        });
      }
      const weakYears = new Set(data.grades.filter((g) => g.numeric <= 2).map((g) => g.year));
      if (weakYears.size >= weakThreshold) {
        const worst = data.grades.reduce((a, b) => (a.numeric <= b.numeric ? a : b));
        persistentWeaknesses.push({
          competencyItem: item,
          worstGrade: worst.label,
          years: Array.from(weakYears).sort((a, b) => a - b),
        });
      }
    }
    persistentStrengths.sort((a, b) => GRADE_TO_NUMERIC[b.bestGrade] - GRADE_TO_NUMERIC[a.bestGrade]);
    persistentWeaknesses.sort((a, b) => GRADE_TO_NUMERIC[a.worstGrade] - GRADE_TO_NUMERIC[b.worstGrade]);

    // --- 품질 집계 ---
    let qualitySum = 0;
    let qualityCount = 0;
    const issueCounter = new Map<string, number>();
    for (const row of quality) {
      if (row.overall_score != null) {
        qualitySum += row.overall_score;
        qualityCount++;
      }
      for (const code of row.issues ?? []) {
        issueCounter.set(code, (issueCounter.get(code) ?? 0) + 1);
      }
    }
    const recurringQualityIssues = Array.from(issueCounter.entries())
      .filter(([, count]) => count >= 2)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const averageQualityScore = qualityCount > 0
      ? Math.round((qualitySum / qualityCount) * 10) / 10
      : null;

    return {
      priorSchoolYears,
      overallAverageGrade,
      persistentStrengths: persistentStrengths.slice(0, 5),
      persistentWeaknesses: persistentWeaknesses.slice(0, 5),
      recurringQualityIssues,
      averageQualityScore,
    };
  } catch {
    return undefined;
  }
}

/**
 * `StudentProfileCard`를 prompt 섹션 문자열로 렌더.
 * 섹션 제목 + 핵심 지표 bullet + 평가 지침으로 구성.
 */
export function renderStudentProfileCard(card: StudentProfileCard): string {
  const lines: string[] = ["## 학생 프로필 카드 (이전 학년 누적)"];
  const yearRange = card.priorSchoolYears.length === 1
    ? `${card.priorSchoolYears[0]}학년도`
    : `${card.priorSchoolYears[0]}~${card.priorSchoolYears.at(-1)}학년도`;
  lines.push(`- 누적 역량 평균: ${card.overallAverageGrade} (${yearRange})`);
  if (card.averageQualityScore != null) {
    lines.push(`- 누적 품질 평균: ${card.averageQualityScore}/100`);
  }
  if (card.persistentStrengths.length > 0) {
    const s = card.persistentStrengths.map((x) => `${x.competencyItem}(${x.bestGrade})`).join(", ");
    lines.push(`- 지속 강점: ${s}`);
  }
  if (card.persistentWeaknesses.length > 0) {
    const w = card.persistentWeaknesses.map((x) => `${x.competencyItem}(${x.worstGrade})`).join(", ");
    lines.push(`- 지속 약점: ${w}`);
  }
  if (card.recurringQualityIssues.length > 0) {
    const q = card.recurringQualityIssues.map((x) => `${x.code}(${x.count}회)`).join(", ");
    lines.push(`- 반복 품질 이슈: ${q}`);
  }
  lines.push("");
  lines.push("**평가 지침**: 위 '지속 약점'으로 이미 평가된 역량이 본 텍스트에서 또 드러나면 엄격히(B- 이하로) 평가하세요. '지속 강점'은 이미 입증된 역량이므로 본 텍스트에서 동일 역량을 재평가할 때 기준을 높게 잡으세요(단순 언급만으론 A- 이상 부여 금지). '반복 품질 이슈'는 이 셀에서도 동일 문제가 보이면 issues에 반드시 포함하세요.");
  return lines.join("\n");
}
