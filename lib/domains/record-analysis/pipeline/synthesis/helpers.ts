// ============================================
// Synthesis 파이프라인 — 공통 헬퍼
// ============================================

import type { PipelineContext, CorePipelineFields } from "../pipeline-types";

// ============================================
// Phase δ-6 (G11): 활성 메인 탐구 섹션 조회
// ============================================

/**
 * 학생의 활성 메인 탐구(overall, direction=design 우선 → analysis 폴백)를 조회하여
 * 프롬프트 섹션 문자열을 반환. 활성 entry 가 없거나 오류 시 빈 문자열 반환.
 * S3/S5/S6 모든 산출물에서 best-effort 로 주입.
 */
export async function fetchActiveMainExplorationSection(
  studentId: string,
  tenantId: string,
): Promise<string> {
  try {
    const { listActiveMainExplorations } = await import(
      "@/lib/domains/student-record/repository/main-exploration-repository"
    );
    const active = await listActiveMainExplorations(studentId, tenantId);
    if (active.length === 0) return "";

    const overall = active.filter((m) => m.scope === "overall");
    const picked =
      overall.find((m) => m.direction === "design") ??
      overall.find((m) => m.direction === "analysis") ??
      active[0];

    const { buildMainExplorationSection } = await import(
      "@/lib/domains/record-analysis/llm/main-exploration-section"
    );
    return buildMainExplorationSection(picked);
  } catch {
    return "";
  }
}

// ============================================
// Blueprint-Axis: 프롬프트 섹션 빌더
// ============================================

/**
 * Blueprint Phase 산출물 → 프롬프트 섹션 문자열.
 * S3(진단), S5(전략), S6(면접/로드맵)에서 best-effort 주입.
 * ctx.results._blueprintPhase가 없으면 빈 문자열 반환.
 */
export function buildBlueprintContextSection(
  ctx: Pick<PipelineContext, "results">,
): string {
  const bp = ctx.results?._blueprintPhase as import("../../blueprint/types").BlueprintPhaseOutput | undefined;
  if (!bp || !bp.targetConvergences?.length) return "";

  const lines: string[] = ["## 설계 청사진 (Blueprint Phase)"];
  lines.push("");
  lines.push("아래는 학생의 진로에서 역산한 3년 수렴 설계입니다. 진단/전략에 반영하세요.");
  lines.push("");

  // 스토리라인 골격
  if (bp.storylineSkeleton?.overarchingTheme) {
    lines.push(`### 3년 관통 테마`);
    lines.push(`${bp.storylineSkeleton.overarchingTheme}`);
    lines.push("");
  }

  // 학년별 수렴 요약
  const byGrade = new Map<number, typeof bp.targetConvergences>();
  for (const conv of bp.targetConvergences) {
    if (!byGrade.has(conv.grade)) byGrade.set(conv.grade, []);
    byGrade.get(conv.grade)!.push(conv);
  }
  for (const [grade, convs] of [...byGrade.entries()].sort((a, b) => a[0] - b[0])) {
    const yearTheme = bp.storylineSkeleton?.yearThemes?.[grade];
    lines.push(`### ${grade}학년${yearTheme ? ` — ${yearTheme}` : ""}`);
    for (const c of convs) {
      const members = c.targetMembers.map((m) => `${m.subjectOrActivity}(${m.role})`).join(", ");
      lines.push(`- "${c.themeLabel}": ${members}`);
      lines.push(`  역량: ${c.sharedCompetencies.join(", ")} | ${c.rationale}`);
    }
    lines.push("");
  }

  // 역량 성장 타겟
  if (bp.competencyGrowthTargets?.length) {
    lines.push(`### 역량 성장 목표`);
    for (const t of bp.competencyGrowthTargets) {
      const current = t.currentGrade ? `${t.currentGrade}→` : "";
      lines.push(`- ${t.competencyItem}: ${current}${t.targetGrade} (${t.yearTarget}학년) — ${t.pathway}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Gap Tracker 산출물 → 프롬프트 섹션 문자열.
 * S5(전략), S6(로드맵)에서 best-effort 주입.
 * ctx.results._gapTracker가 없으면 빈 문자열 반환.
 */
export function buildGapTrackerContextSection(
  ctx: Pick<PipelineContext, "results">,
): string {
  const gap = ctx.results?._gapTracker as import("../../blueprint/types").GapTrackerOutput | undefined;
  if (!gap || !gap.bridgeProposals?.length) return "";

  const lines: string[] = ["## 정합성 분석 (Gap Tracker)"];
  lines.push("");
  lines.push(`- Blueprint 커버리지: ${(gap.metrics.coverage * 100).toFixed(0)}%`);
  lines.push(`- Drift (의외 수렴): ${gap.metrics.driftCount}건`);
  lines.push(`- 종합 정합성: ${(gap.metrics.coherenceScore * 100).toFixed(0)}%`);
  lines.push("");

  // urgency=high 우선 표시
  const sorted = [...gap.bridgeProposals].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.urgency] - order[b.urgency];
  });

  lines.push(`### Bridge 행동 제안 (${sorted.length}건)`);
  for (const b of sorted.slice(0, 8)) {
    lines.push(`- [${b.urgency}] ${b.recommendedAction}`);
    if (b.competencyGaps.length > 0) {
      lines.push(`  역량 갭: ${b.competencyGaps.map((g) => `${g.item}(${g.currentGrade ?? "미측정"}→${g.targetGrade})`).join(", ")}`);
    }
  }

  // drift
  if (gap.journeyGap.driftItems.length > 0) {
    lines.push("");
    lines.push(`### Drift (의외 수렴)`);
    for (const d of gap.journeyGap.driftItems.slice(0, 5)) {
      lines.push(`- [${d.driftType}] ${d.description}`);
    }
  }

  return lines.join("\n");
}

// ============================================
// 헬퍼: eval 연결 (시계열 + 대학 프로필 매칭)
// ============================================

/** 역량 등급 → 0~100 점수 변환 (eval 함수 입력용) */
export function competencyGradeToScore(grade: string): number {
  switch (grade) {
    case "A+": return 95;
    case "A-": return 85;
    case "B+": return 75;
    case "B": return 70;
    case "B-": return 60;
    case "C": return 50;
    default: return 0;
  }
}

export interface AllYearScoreRow {
  gradeYear: number;
  competencyItem: string;
  competencyLabel: string;
  gradeValue: string;
}

/** 전 학년 역량 점수를 DB에서 조회하여 학년별로 태깅 */
export async function fetchAllYearCompetencyScores(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  studentId: string,
  tenantId: string,
): Promise<AllYearScoreRow[]> {
  const { data: rows } = await supabase
    .from("student_record_competency_scores")
    .select("school_year, competency_item, grade_value")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("source", "ai")
    .order("school_year", { ascending: true });

  if (!rows || rows.length === 0) return [];

  const { COMPETENCY_ITEMS } = await import("@/lib/domains/student-record/constants");

  // 학생 학년으로부터 각 school_year를 gradeYear(1~3)로 매핑
  // school_year 목록에서 최소값을 1학년으로 추정
  const schoolYears = [...new Set((rows as Array<{ school_year: number }>).map((r) => r.school_year))].sort();
  const baseYear = Math.min(...schoolYears);

  return (rows as Array<{ school_year: number; competency_item: string; grade_value: string }>)
    .map((r) => {
      const gradeYear = Math.min(3, Math.max(1, r.school_year - baseYear + 1));
      const itemDef = COMPETENCY_ITEMS.find((i) => i.code === r.competency_item);
      return {
        gradeYear,
        competencyItem: r.competency_item,
        competencyLabel: itemDef?.label ?? r.competency_item,
        gradeValue: r.grade_value,
      };
    });
}

/** 시계열 분석 결과 → 진단 프롬프트 주입용 마크다운 섹션 */
export function buildTimeseriesPromptSection(
  analysis: import("../../eval/timeseries-analyzer").TimeSeriesAnalysis,
): string {
  const lines = ["## 역량 시계열 분석 (학년별 추이)"];
  lines.push("");
  lines.push(`- 요약: ${analysis.summary}`);
  lines.push(`- 전체 평균 성장률: ${analysis.overallGrowthRate > 0 ? "+" : ""}${analysis.overallGrowthRate}점`);

  if (analysis.anomalies.length > 0) {
    lines.push("");
    lines.push("### 이상 감지");
    for (const a of analysis.anomalies) {
      lines.push(`- ${a.competencyName}: ${a.anomalyReason ?? "이상 감지"} (추세: ${a.trend})`);
    }
  }

  const rising = analysis.trends.filter((t) => t.trend === "rising");
  const falling = analysis.trends.filter((t) => t.trend === "falling");

  if (rising.length > 0) {
    lines.push("");
    lines.push(`### 상승 역량: ${rising.map((t) => `${t.competencyName}(+${t.growthRate})`).join(", ")}`);
  }
  if (falling.length > 0) {
    lines.push("");
    lines.push(`### 하락 역량: ${falling.map((t) => `${t.competencyName}(${t.growthRate})`).join(", ")}`);
  }

  return lines.join("\n");
}

/** 대학 계열 매칭 결과 → 전략 프롬프트 주입용 마크다운 섹션 */
export function buildUniversityMatchPromptSection(
  analysis: import("../../eval/university-profile-matcher").UniversityMatchAnalysis,
): string {
  const lines: string[] = [];
  lines.push(`- 요약: ${analysis.summary}`);

  // 상위 3개 트랙
  const top3 = analysis.matches.slice(0, 3);
  for (const m of top3) {
    lines.push(`- ${m.label} (${m.grade}등급, ${m.matchScore}점): 강점=${m.strengths.join("/")} | 갭=${m.gaps.join("/")}`);
    lines.push(`  추천: ${m.recommendation}`);
  }

  return lines.join("\n");
}

// ============================================
// 헬퍼: 전 학년 세특/창체/행특 품질 패턴 집계
// ============================================

/**
 * student_record_content_quality 테이블에서 해당 학생의 모든 issues를 수집하고
 * 동일 패턴이 2건 이상 등장하면 반복 패턴으로 집계한다.
 * Synthesis 파이프라인(진단/전략)에서 사용.
 *
 * 과목명은 student_record_seteks → subjects JOIN으로만 가능.
 * changche/haengteuk은 과목명 없음 → record_type을 label로 사용.
 *
 * @returns repeatingPatterns — issues[]의 반복 항목 (2건 이상)
 * @returns qualityPatternSection — 프롬프트 주입용 마크다운 섹션 (데이터 없으면 "")
 */
export async function aggregateQualityPatterns(ctx: Pick<CorePipelineFields, "supabase" | "studentId" | "tenantId">): Promise<{
  repeatingPatterns: Array<{ pattern: string; count: number; subjects: string[] }>;
  qualityPatternSection: string;
}> {
  const { supabase, studentId, tenantId } = ctx;

  // 1. content_quality 전체 조회 (issues가 있는 행만, ai source만)
  const { data: qualityRows } = await supabase
    .from("student_record_content_quality")
    .select("record_id, record_type, issues, feedback")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("source", "ai");

  const rows = (qualityRows ?? []) as Array<{
    record_id: string;
    record_type: string;
    issues: string[];
    feedback: string | null;
  }>;

  const nonEmptyRows = rows.filter((r) => Array.isArray(r.issues) && r.issues.length > 0);
  if (nonEmptyRows.length === 0) {
    return { repeatingPatterns: [], qualityPatternSection: "" };
  }

  // 2. setek record_id → subject name 매핑 (1회 쿼리)
  const setekIds = nonEmptyRows
    .filter((r) => r.record_type === "setek" || r.record_type === "personal_setek")
    .map((r) => r.record_id);

  const subjectNameById = new Map<string, string>();
  if (setekIds.length > 0) {
    type SetekRow = { id: string; subject: { name: string } | null };
    const { data: setekRows } = await supabase
      .from("student_record_seteks")
      .select("id, subject:subject_id(name)")
      .in("id", setekIds)
      .returns<SetekRow[]>();

    for (const s of setekRows ?? []) {
      if (s.subject?.name) {
        subjectNameById.set(s.id, s.subject.name);
      }
    }
  }

  // 3. 패턴별 집계 (issue → {count, subjects[]})
  const patternMap = new Map<string, { count: number; subjects: Set<string> }>();
  for (const row of nonEmptyRows) {
    const label =
      subjectNameById.get(row.record_id) ??
      (row.record_type === "changche" ? "창체" : row.record_type === "haengteuk" ? "행특" : row.record_type);

    for (const issue of row.issues) {
      const entry = patternMap.get(issue) ?? { count: 0, subjects: new Set<string>() };
      entry.count += 1;
      entry.subjects.add(label);
      patternMap.set(issue, entry);
    }
  }

  // 4. 반복 패턴 필터 (2건 이상)
  const repeatingPatterns = Array.from(patternMap.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([pattern, v]) => ({
      pattern,
      count: v.count,
      subjects: Array.from(v.subjects),
    }));

  if (repeatingPatterns.length === 0) {
    return { repeatingPatterns: [], qualityPatternSection: "" };
  }

  // 5. 고유 피드백 수집 (중복 제거, 최대 5개)
  const feedbackSet = new Set<string>();
  for (const row of nonEmptyRows) {
    if (row.feedback && row.feedback.trim().length > 0) {
      feedbackSet.add(row.feedback.trim());
      if (feedbackSet.size >= 5) break;
    }
  }

  // 6. 마크다운 섹션 생성
  const patternLines = repeatingPatterns
    .map((p) => `- ${p.pattern} (${p.count}건: ${p.subjects.join(", ")}) — 학생의 습관적 약점으로 진단에 반영`)
    .join("\n");

  const feedbackLines =
    feedbackSet.size > 0
      ? `\n### 품질 피드백 요약\n${Array.from(feedbackSet)
          .map((f) => `- "${f}"`)
          .join("\n")}`
      : "";

  const qualityPatternSection = `## 세특 품질 패턴 분석 (전 학년 종합)\n\n### 반복 감지된 패턴\n${patternLines}${feedbackLines}`;

  return { repeatingPatterns, qualityPatternSection };
}

// ============================================
// H1 후속: 전 학년 cross-subject theme 집계 (S3 진단 주입용)
// ============================================

import type { GradeTheme } from "../../llm/types";

export interface GradeThemesByGrade {
  [grade: number]: {
    themes: GradeTheme[];
    dominantThemeIds: string[];
  };
}

/**
 * 완료된 Grade Pipeline의 `task_results.cross_subject_theme_extraction`을 학년별로 집계한다.
 * H1 cross-subject theme은 학년 단위로만 산출되므로, Synthesis(S3 진단)에서 다학년 관통
 * 서사를 형성하려면 이렇게 aggregation 단계가 필요하다.
 */
export async function aggregateGradeThemes(
  ctx: Pick<CorePipelineFields, "supabase" | "studentId" | "tenantId">,
): Promise<GradeThemesByGrade> {
  const { supabase, studentId, tenantId } = ctx;

  const { data: rows } = await supabase
    .from("student_record_analysis_pipelines")
    .select("grade, task_results, created_at")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("pipeline_type", "grade")
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const byGrade: GradeThemesByGrade = {};
  for (const row of (rows ?? []) as Array<{ grade: number | null; task_results: unknown }>) {
    if (row.grade == null || byGrade[row.grade]) continue; // 최신 1개만 유지
    const tr = row.task_results as Record<string, unknown> | null;
    const entry = tr?.cross_subject_theme_extraction as Record<string, unknown> | undefined;
    if (!entry) continue;
    const themes = Array.isArray(entry.themes) ? (entry.themes as GradeTheme[]) : [];
    const dominantThemeIds = Array.isArray(entry.dominantThemeIds)
      ? (entry.dominantThemeIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (themes.length === 0) continue;
    byGrade[row.grade] = { themes, dominantThemeIds };
  }
  return byGrade;
}

/**
 * GradeThemesByGrade → Synthesis S3/S5/S6/S7 프롬프트 주입용 마크다운 섹션.
 * belief.gradeThemesByGrade 에서 읽어 buildCrossSubjectThemesDiagnosisSection 과 동일 형식으로 렌더.
 * 데이터 없으면 빈 문자열 — 호출부에서 graceful omit.
 * Phase D2: Synthesis belief 시딩 후 S3/S5/S6/S7 의 gradeThemes fallback 대체.
 */
export function buildGradeThemesByGradeSection(byGrade: GradeThemesByGrade | undefined): string {
  if (!byGrade) return "";
  return buildCrossSubjectThemesDiagnosisSection(byGrade);
}

/**
 * aggregateGradeThemes 결과 → 진단 프롬프트 주입용 마크다운 섹션.
 *
 * 출력 구성:
 * 1) 학년별 dominant 테마 라인 (id/label/affectedSubjects/evolutionSignal)
 * 2) 다학년 반복 테마 (id 기준으로 ≥2학년 등장) — F16(진로과잉도배) 구조 감지용 시그널
 *
 * 데이터가 비면 빈 문자열 반환 — 호출부에서 그대로 concat.
 */
export function buildCrossSubjectThemesDiagnosisSection(byGrade: GradeThemesByGrade): string {
  const grades = Object.keys(byGrade).map(Number).sort();
  if (grades.length === 0) return "";

  const EVOLUTION_LABEL: Record<NonNullable<GradeTheme["evolutionSignal"]>, string> = {
    deepening: "심화",
    stagnant: "정체",
    pivot: "전환",
    new: "신규",
  };

  const lines: string[] = ["## 학년별 과목 교차 테마 (H1 cross-subject)", ""];

  // 1) 학년별 dominant 테마
  for (const g of grades) {
    const { themes, dominantThemeIds } = byGrade[g];
    const themeById = new Map(themes.map((t) => [t.id, t]));
    const dominants = dominantThemeIds
      .map((id) => themeById.get(id))
      .filter((t): t is GradeTheme => Boolean(t));
    if (dominants.length === 0) continue;
    lines.push(`### ${g}학년 dominant`);
    for (const t of dominants) {
      const subjects = t.affectedSubjects.length > 0 ? ` [${t.affectedSubjects.join(", ")}]` : "";
      const evolution = t.evolutionSignal ? ` · ${EVOLUTION_LABEL[t.evolutionSignal]}` : "";
      lines.push(`- \`${t.id}\` ${t.label} (${t.subjectCount}과목${evolution})${subjects}`);
    }
    lines.push("");
  }

  // 2) 다학년 반복 테마 (id 동일하거나 label 정확히 동일)
  const idToGrades = new Map<string, { label: string; grades: number[]; evolution: Set<string> }>();
  for (const g of grades) {
    for (const t of byGrade[g].themes) {
      const key = t.id;
      const entry = idToGrades.get(key) ?? { label: t.label, grades: [], evolution: new Set<string>() };
      entry.grades.push(g);
      if (t.evolutionSignal) entry.evolution.add(t.evolutionSignal);
      idToGrades.set(key, entry);
    }
  }
  const recurring = [...idToGrades.entries()]
    .filter(([, v]) => v.grades.length >= 2)
    .sort((a, b) => b[1].grades.length - a[1].grades.length);

  if (recurring.length > 0) {
    lines.push("### 다학년 반복 테마 (≥2학년 등장)");
    for (const [id, v] of recurring) {
      const evoLabel = v.evolution.size > 0
        ? ` · 변화: ${[...v.evolution].map((e) => EVOLUTION_LABEL[e as NonNullable<GradeTheme["evolutionSignal"]>]).join("/")}`
        : "";
      lines.push(`- \`${id}\` ${v.label} — ${v.grades.join("/")}학년 (${v.grades.length}회)${evoLabel}`);
    }
    lines.push("");
  }

  lines.push("→ 위 테마 분포를 근거로 학년 간 심화 곡선(넓게 → 좁고 깊게)과 전공 정합성을 평가하세요.");
  lines.push("→ 모든 학년 dominant가 단일 진로 키워드에 수렴하면 **진로과잉도배** 위험으로 약점/개선전략에 반드시 반영하세요.");

  return lines.join("\n");
}

// ============================================
// Phase 1 Layer 2: Hyperedge 프롬프트 섹션 빌더
// ============================================

type HyperedgeLike = {
  theme_label: string;
  member_count: number;
  members: Array<{ label: string; grade: number | null }>;
  confidence: number;
  evidence: string | null;
  shared_competencies: string[] | null;
};

/**
 * hyperedge 목록 → S5 전략 프롬프트 주입용 섹션.
 * 컨설턴트 관점: "3+ 레코드가 하나의 주제로 수렴하는 축"을 전략 우선순위 근거로 제시.
 * 데이터 없으면 빈 문자열.
 */
export function buildHyperedgeSummarySection(hyperedges: HyperedgeLike[]): string {
  if (hyperedges.length === 0) return "";

  const sorted = [...hyperedges].sort((a, b) => b.confidence - a.confidence);
  const lines: string[] = ["## 통합 테마 (3+ 레코드 수렴, Layer 2 hyperedge)", ""];
  for (const h of sorted) {
    const comps = h.shared_competencies && h.shared_competencies.length > 0
      ? ` · 공유역량 ${h.shared_competencies.join("/")}`
      : "";
    const memberSummary = h.members
      .map((m) => (m.grade ? `${m.grade}학년 ${m.label}` : m.label))
      .join(" + ");
    lines.push(`- **${h.theme_label}** (${h.member_count}개 레코드, conf ${h.confidence.toFixed(2)}${comps})`);
    lines.push(`  · 멤버: ${memberSummary}`);
  }
  lines.push("");
  lines.push("→ 위 통합 테마는 학생의 **수렴 서사축**입니다. 보완전략은 이 축을 강화/보강하거나, 축과 괴리된 활동을 재정렬하는 방향으로 우선 배치하세요.");
  return lines.join("\n");
}
