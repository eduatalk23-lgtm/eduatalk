// ============================================
// 격차 4: 설계 모드 AI 가안 품질 → S3 진단 / S5 전략 프롬프트 섹션 빌더
//
// P8 draft_analysis 가 student_record_content_quality(source='ai_projected') 에
// 저장한 5축 점수 + issues 를 학년별 집계하여 마크다운 섹션으로 렌더한다.
//
// 소비처:
//   pipeline/synthesis/phase-s3-diagnosis.ts  → diagQualityPatternSection 에 병합
//   pipeline/synthesis/phase-s5-strategy.ts   → combinedHyperedgeSection 에 병합
//
// 설계 원칙:
//   - 설계 모드 학년 없거나 P8 미실행(데이터 0건)이면 undefined 반환 (graceful, no-op)
//   - 순수 함수 (LLM 호출 없음, 부수효과 없음)
//   - fetchProjectedQualitySummary 는 Supabase 클라이언트를 파라미터로 받아 DB 조회만 수행
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProjectedQualityEntry {
  gradeYear: number;
  recordType: string;
  overallScore: number;
  specificity: number;
  depth: number;
  coherence: number;
  grammar: number;
  scientificValidity: number | null;
  issues: string[];
}

export interface ProjectedQualitySummary {
  /** 학년별 5축 평균 + 이슈 집계 */
  byGrade: Array<{
    gradeYear: number;
    avgOverall: number;
    avgSpecificity: number;
    avgDepth: number;
    avgCoherence: number;
    recordCount: number;
    topIssues: string[];
  }>;
  /** 전체 학생 평균 overall_score */
  grandAvgOverall: number;
  totalRecords: number;
}

/**
 * 학생의 source='ai_projected' content_quality 행을 학년별로 집계한다.
 *
 * @param supabase - Supabase 클라이언트 (서버 전용)
 * @param studentId - 학생 ID
 * @param tenantId  - 테넌트 ID
 * @returns 학년별 집계 결과, 데이터 없으면 null
 */
export async function fetchProjectedQualitySummary(
  supabase: SupabaseClient,
  studentId: string,
  tenantId: string,
): Promise<ProjectedQualitySummary | null> {
  const { data, error } = await supabase
    .from("student_record_content_quality")
    .select(
      "record_type, overall_score, specificity, depth, coherence, grammar, scientific_validity, issues",
    )
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("source", "ai_projected");

  if (error || !data || data.length === 0) return null;

  // school_year 컬럼이 없는 경우를 대비해 record_type 로만 집계
  // (P8 은 targetGrade 단위로 저장하지만 grade 컬럼이 없어 record_type 으로 대표)
  // school_year 컬럼을 포함해 재조회
  const { data: withYear } = await supabase
    .from("student_record_content_quality")
    .select(
      "record_type, school_year, overall_score, specificity, depth, coherence, grammar, scientific_validity, issues",
    )
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("source", "ai_projected");

  const rows = withYear ?? data.map((r) => ({ ...r, school_year: null }));

  // school_year 기준 집계 (null 이면 -1 로 통합)
  const byYearMap = new Map<
    number,
    {
      totalOverall: number;
      totalSpecificity: number;
      totalDepth: number;
      totalCoherence: number;
      count: number;
      issueBag: string[];
    }
  >();

  for (const row of rows) {
    const yr: number = (row.school_year as number | null) ?? -1;
    const existing = byYearMap.get(yr) ?? {
      totalOverall: 0,
      totalSpecificity: 0,
      totalDepth: 0,
      totalCoherence: 0,
      count: 0,
      issueBag: [],
    };

    existing.totalOverall += (row.overall_score as number) ?? 0;
    existing.totalSpecificity += (row.specificity as number) ?? 0;
    existing.totalDepth += (row.depth as number) ?? 0;
    existing.totalCoherence += (row.coherence as number) ?? 0;
    existing.count += 1;

    const issues = row.issues as string[] | null;
    if (Array.isArray(issues)) {
      for (const iss of issues) {
        if (typeof iss === "string" && iss.length > 0) existing.issueBag.push(iss);
      }
    }

    byYearMap.set(yr, existing);
  }

  const byGrade = [...byYearMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([yr, agg]) => {
      // 이슈 빈도 집계
      const issueFreq = new Map<string, number>();
      for (const iss of agg.issueBag) {
        issueFreq.set(iss, (issueFreq.get(iss) ?? 0) + 1);
      }
      const topIssues = [...issueFreq.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([iss]) => iss);

      return {
        gradeYear: yr,
        avgOverall: Math.round(agg.totalOverall / agg.count),
        avgSpecificity: Math.round(agg.totalSpecificity / agg.count),
        avgDepth: Math.round(agg.totalDepth / agg.count),
        avgCoherence: Math.round(agg.totalCoherence / agg.count),
        recordCount: agg.count,
        topIssues,
      };
    });

  if (byGrade.length === 0) return null;

  const grandAvgOverall = Math.round(
    byGrade.reduce((s, g) => s + g.avgOverall, 0) / byGrade.length,
  );

  return {
    byGrade,
    grandAvgOverall,
    totalRecords: rows.length,
  };
}

/**
 * 학년별 AI 가안 품질 집계 결과를 S3 진단 / S5 전략 프롬프트용 마크다운 섹션으로 렌더한다.
 *
 * @param summary - fetchProjectedQualitySummary 결과
 * @returns 마크다운 섹션, 데이터 없으면 undefined (no-op)
 */
export function buildProjectedQualitySection(
  summary: ProjectedQualitySummary | null | undefined,
): string | undefined {
  if (!summary || summary.byGrade.length === 0) return undefined;

  const lines: string[] = [];
  lines.push("## 설계 모드 AI 가안 품질 (P8 분석 결과, source=ai_projected)");
  lines.push(
    "⚠ 아래 점수는 NEIS 기록이 없는 학년의 AI 가안에 대한 분석 결과입니다. " +
      "확정 기록이 아닌 예상 가안의 품질이므로 약점 해석 및 보강 방향에 반영하세요.",
  );
  lines.push("");
  lines.push(`- 총 레코드: ${summary.totalRecords}건, 전체 평균 overall: **${summary.grandAvgOverall}점**`);
  lines.push("");

  for (const g of summary.byGrade) {
    const yr = g.gradeYear > 0 ? `${g.gradeYear}년도` : "학년 미상";
    lines.push(`### ${yr} (레코드 ${g.recordCount}건)`);
    lines.push(
      `- overall: **${g.avgOverall}점** | specificity: ${g.avgSpecificity} | depth: ${g.avgDepth} | coherence: ${g.avgCoherence}`,
    );
    if (g.topIssues.length > 0) {
      lines.push(`- 빈출 이슈: ${g.topIssues.join(" / ")}`);
    }

    // 품질 해석 힌트
    if (g.avgOverall < 60) {
      lines.push(
        `- **⚠ 이 학년 가안의 전반 품질이 낮습니다(${g.avgOverall}점). 진단은 해당 학년 탐구 깊이 부족을 약점으로 분류하고, 전략은 우선 보강 대상으로 지정하세요.**`,
      );
    } else if (g.avgOverall < 75) {
      lines.push(
        `- 이 학년 가안은 중간 수준(${g.avgOverall}점)입니다. specificity 또는 depth 가 낮은 항목을 중심으로 보강 방향을 제시하세요.`,
      );
    }
    lines.push("");
  }

  lines.push(
    "**진단/전략 작성 지침**: AI 가안 overall 이 낮은 학년은 " +
      '"탐구 깊이 부족" / "구체성 결여" 를 명시적 약점으로 언급하고, ' +
      "해당 학년의 세특/창체/행특 보완을 최우선 전략으로 제안하세요.",
  );

  return lines.join("\n");
}
