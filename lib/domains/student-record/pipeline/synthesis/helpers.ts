// ============================================
// Synthesis 파이프라인 — 공통 헬퍼
// ============================================

import type { PipelineContext } from "../../pipeline-types";

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

  const { COMPETENCY_ITEMS } = await import("../../constants");

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
export async function aggregateQualityPatterns(ctx: PipelineContext): Promise<{
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
