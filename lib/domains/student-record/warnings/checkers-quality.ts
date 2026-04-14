// ============================================
// 콘텐츠 품질 관련 경고 체커 (Phase 6.5)
// ============================================
// checkContentQuality, checkContentQualityPatterns

import type { RecordWarning } from "./types";
import type { ContentQualityRow } from "./engine";
import { SCIENTIFIC_PATTERN_CODES } from "../evaluation-criteria/defaults";

const RECORD_TYPE_LABELS: Record<ContentQualityRow["record_type"], string> = {
  setek: "교과 세특",
  personal_setek: "개인 세특",
  changche: "창체",
  haengteuk: "행특",
};

/**
 * Phase QA: 콘텐츠 품질 점수 기반 경고
 * - overall_score < 40: severity "high" (content_quality_critical)
 * - overall_score < 60: severity "medium" (content_quality_low)
 */
export function checkContentQuality(qualityScores: ContentQualityRow[]): RecordWarning[] {
  const warnings: RecordWarning[] = [];

  for (const q of qualityScores) {
    if (q.overall_score < 40) {
      warnings.push({
        ruleId: "content_quality_critical",
        severity: "high",
        category: "quality",
        title: `${RECORD_TYPE_LABELS[q.record_type]} 품질 부족 (${q.overall_score}점)`,
        message: q.issues.length > 0 ? q.issues.join(", ") : "구체적 사례와 근거가 부족합니다",
        suggestion: q.feedback ?? "활동 성과, 배운 점, 발전 과정을 구체적으로 기술하세요",
      });
    } else if (q.overall_score < 60) {
      warnings.push({
        ruleId: "content_quality_low",
        severity: "medium",
        category: "quality",
        title: `${RECORD_TYPE_LABELS[q.record_type]} 품질 개선 권장 (${q.overall_score}점)`,
        message: q.issues.length > 0 ? q.issues.join(", ") : "작성 품질을 높이면 평가에 유리합니다",
        suggestion: q.feedback ?? "구체적 성과와 성장 과정을 보강해주세요",
      });
    }
  }

  return warnings;
}

// ============================================
// 합격률 낮은 패턴 14개 ↔ 경고 매핑
// ============================================
//
// [구조적 문제 — structural]
// P1  나열식              → PATTERN_MAP["P1_나열식"]    → ruleId: "setek_enumeration"
// P3  키워드만            → PATTERN_MAP["P3_키워드만"]  → ruleId: "inquiry_keyword_only"
// P4  내신↔탐구불일치     → PATTERN_MAP["P4_내신탐구불일치"] → ruleId: "grade_inquiry_mismatch"
//
// [과학적/논리적 정합성 — scientific (F1~F6)]
// F1~F6 → SCIENTIFIC_PATTERN_CODES 통합 감지 → ruleId: "content_quality_scientific"
//
// [거시적 패턴 — macro]
// F10 성장부재            → PATTERN_MAP["F10_성장부재"]      → ruleId: "setek_no_growth_curve"
// F12 자기주도성부재       → PATTERN_MAP["F12_자기주도성부재"] → ruleId: "setek_abstract_generic"
// F16 진로과잉도배         → PATTERN_MAP["F16_진로과잉도배"]   → ruleId: "setek_career_overdose"
//
// [메타 패턴 — meta]
// M1  교사관찰불가         → PATTERN_MAP["M1_교사관찰불가"]    → ruleId: "setek_teacher_unobservable"

/** E1: 패턴 코드 → 경고 메타데이터 매핑 (가이드 프롬프트 주입용으로도 사용) */
export const PATTERN_MAP: Record<string, { ruleId: RecordWarning["ruleId"]; severity: RecordWarning["severity"]; title: string; suggestion: string }> = {
  P1_나열식: {
    ruleId: "setek_enumeration",
    severity: "medium",
    title: "세특 나열식 기술",
    suggestion: "활동을 나열하지 말고, 호기심→탐구→결론→성장의 흐름으로 연결하세요",
  },
  // P2_추상적_복붙 삭제 — 수업태도 추상적 표현은 실패 아님 (F12로 포착)
  P3_키워드만: {
    ruleId: "inquiry_keyword_only",
    severity: "medium",
    title: "탐구 키워드만 존재",
    suggestion: "전문용어 나열이 아닌, 탐구 과정과 결론을 구체적으로 기술하세요",
  },
  P4_내신탐구불일치: {
    ruleId: "grade_inquiry_mismatch",
    severity: "high",
    title: "내신↔탐구 심화도 불일치",
    suggestion: "학생 수준에 맞는 탐구 내용으로 조정하거나, 탐구 과정의 근거를 보강하세요",
  },
  F10_성장부재: {
    ruleId: "setek_no_growth_curve",
    severity: "medium",
    title: "학년 간 성장 곡선 부재",
    suggestion: "학년이 올라갈수록 탐구 깊이가 심화되어야 합니다 (고1 넓은→고2 심화→고3 확장+제언)",
  },
  F12_자기주도성부재: {
    ruleId: "setek_abstract_generic",
    severity: "medium",
    title: "자기주도적 탐구 부재",
    suggestion: "교사 과제 수행만이 아닌, 학생이 스스로 질문을 만들고 탐구한 흔적이 필요합니다",
  },
  F16_진로과잉도배: {
    ruleId: "setek_career_overdose",
    severity: "high",
    title: "진로 키워드 과잉 도배",
    suggestion: "모든 교과에 동일 진로 키워드를 삽입하면 교과 고유 역량이 불명확해집니다. 진로 연결은 2~3과목으로 제한하세요",
  },
  M1_교사관찰불가: {
    ruleId: "setek_teacher_unobservable",
    severity: "medium",
    title: "교사 관찰 불가 표현",
    suggestion: '"~다짐함", "~생각함", "~깨닫게 됨" 등 교사가 직접 관찰할 수 없는 내면 상태 표현을 제거하고, 행동·결과 중심으로 기술하세요',
  },
  // F9_창체참여기록형 삭제 — P2와 동일 패턴으로 통합 삭제
};

// 과학적 정합성 패턴 (F1~F6) — 상수에서 import
const SCIENTIFIC_PATTERNS = SCIENTIFIC_PATTERN_CODES;

// prefix 기반 매칭 — LLM이 "P1_나열식", "P1 나열식", "P1: 나열식" 등 변형 출력 대응
const PATTERN_PREFIXES = Object.keys(PATTERN_MAP).map((key) => {
  const prefix = key.split("_")[0]; // "P1", "P2", "F10" 등
  return { prefix, key };
});

/** E1: 이슈 코드를 PATTERN_MAP에 매칭 (prefix 기반 유연 매칭). 가이드 프롬프트 주입에도 사용. */
export function matchPattern(issue: string): typeof PATTERN_MAP[string] | undefined {
  // 1. 정확 매칭 시도
  if (PATTERN_MAP[issue]) return PATTERN_MAP[issue];
  // 2. prefix 매칭 (issue가 "P1"로 시작하면 P1_나열식에 매핑)
  const normalized = issue.replace(/[\s:_]/g, "");
  for (const { prefix, key } of PATTERN_PREFIXES) {
    if (normalized.startsWith(prefix)) return PATTERN_MAP[key];
  }
  return undefined;
}

/**
 * ContentQualityRow.issues 배열에 포함된 패턴 코드(P1~F16)를 기반으로
 * 합격률 낮은 세특 패턴 경고를 발행한다.
 *
 * @param options.skipNarrativeSignals — true면 F10(성장부재)/M1(교사관찰불가)는 스킵.
 *   Layer 3 narrative_arc가 제공된 경우 `checkNarrativeArc()`가 더 정확한 판정을 하므로 중복 방지.
 */
export function checkContentQualityPatterns(
  qualityScores: ContentQualityRow[],
  options: { skipNarrativeSignals?: boolean } = {},
): RecordWarning[] {
  const warnings: RecordWarning[] = [];
  const { skipNarrativeSignals = false } = options;
  const NARRATIVE_RULES = new Set(["setek_no_growth_curve", "setek_teacher_unobservable"]);

  const seenRules = new Set<string>();
  const scientificIssues: string[] = [];

  for (const q of qualityScores) {
    for (const issue of q.issues) {
      // 패턴 코드 매칭 (prefix 기반 유연 매칭)
      const mapping = matchPattern(issue);
      if (mapping && !seenRules.has(mapping.ruleId)) {
        if (skipNarrativeSignals && NARRATIVE_RULES.has(mapping.ruleId)) continue;
        seenRules.add(mapping.ruleId);
        warnings.push({
          ruleId: mapping.ruleId,
          severity: mapping.severity,
          category: "quality",
          title: mapping.title,
          message: `${RECORD_TYPE_LABELS[q.record_type]}에서 감지: ${issue}`,
          suggestion: mapping.suggestion,
        });
      }

      // 과학적 정합성 패턴 (F1~F6) 수집 — prefix 매칭
      const normalizedIssue = issue.replace(/[\s:_]/g, "");
      if (SCIENTIFIC_PATTERNS.some((p) => normalizedIssue.startsWith(p.split("_")[0]))) {
        scientificIssues.push(`${RECORD_TYPE_LABELS[q.record_type]}: ${issue}`);
      }
    }
  }

  // 과학적 정합성 문제가 하나라도 있으면 통합 경고
  if (scientificIssues.length > 0) {
    warnings.push({
      ruleId: "content_quality_scientific",
      severity: scientificIssues.length >= 2 ? "high" : "medium",
      category: "quality",
      title: `과학적 정합성 문제 ${scientificIssues.length}건`,
      message: scientificIssues.slice(0, 3).join("; ") + (scientificIssues.length > 3 ? ` 외 ${scientificIssues.length - 3}건` : ""),
      suggestion: "탐구 전제-실험-결론의 논리적 연결과 개념 정확성을 검토하세요",
    });
  }

  return warnings;
}
