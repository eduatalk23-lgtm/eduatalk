// ============================================
// L4-D / L1-Deterministic Validator — suggestStrategies 출력 검증
//
// diagnosis-validator 패턴 횡전개 (ai_strategy).
// LLM 호출 0회 — 규칙 기반으로 보완전략 의미·형식 결함 감지.
//
// 기존 parseResponse는 targetArea/priority의 enum 범위만 필터링하고,
// 빈 suggestions 배열은 상위 액션에서 early-return으로 처리한다.
// 본 검증은 그 이후의 의미적 결함(짧음/공허 문구/중복/빈 필드 등)을 감지.
// ============================================

import type { Violation, ValidationResult } from "./types";
import { summarizeViolations } from "./types";
import type { SuggestStrategiesResult } from "../types";
import { STRATEGY_TARGET_AREAS } from "@/lib/domains/student-record/constants";

// ─────────────────────────────────────────────
// 규칙 임계값
// ─────────────────────────────────────────────

const STRATEGY_CONTENT_MIN_CHARS = 30;
const REASONING_MIN_CHARS = 15;
const SUMMARY_MIN_CHARS = 30;
const SUGGESTIONS_MIN_COUNT = 3;
const SUGGESTIONS_MAX_COUNT = 6;

const VALID_TARGET_AREAS = new Set<string>(Object.keys(STRATEGY_TARGET_AREAS));
const VALID_PRIORITIES = new Set<string>(["critical", "high", "medium", "low"]);

/**
 * 공허한 구호성 전략 문구 — warning.
 * "더 열심히 공부", "꾸준히 노력", "성실히 임하기" 등 비실행 가능 문구.
 */
const GENERIC_STRATEGY_PATTERNS = [
  /^더\s*열심히/,
  /^꾸준히\s*노력/,
  /^성실히\s*임/,
  /^최선을\s*다/,
  /^열심히\s*공부/,
  /^적극적으로\s*참여/,
];

// ─────────────────────────────────────────────
// 규칙 체커 — 개별 suggestion
// ─────────────────────────────────────────────

function checkSuggestion(
  s: SuggestStrategiesResult["suggestions"][number],
  i: number,
  seenContent: Set<string>,
  vs: Violation[],
) {
  // targetArea enum 검증 (parser에서 걸렀지만 방어)
  if (!VALID_TARGET_AREAS.has(s.targetArea)) {
    vs.push({
      rule: "SUGGESTION_TARGET_AREA_INVALID",
      severity: "error",
      message: "targetArea가 허용된 영역이 아닙니다",
      fieldPath: `suggestions[${i}].targetArea`,
      actual: s.targetArea,
    });
  }

  // priority enum 검증
  if (!VALID_PRIORITIES.has(s.priority)) {
    vs.push({
      rule: "SUGGESTION_PRIORITY_INVALID",
      severity: "error",
      message: "priority는 critical|high|medium|low 중 하나여야 합니다",
      fieldPath: `suggestions[${i}].priority`,
      actual: s.priority,
    });
  }

  // strategyContent 빈/짧음/공허/중복
  const content = s.strategyContent?.trim() ?? "";
  if (content.length === 0) {
    vs.push({
      rule: "SUGGESTION_CONTENT_EMPTY",
      severity: "error",
      message: "strategyContent가 비어 있습니다",
      fieldPath: `suggestions[${i}].strategyContent`,
    });
  } else {
    if (content.length < STRATEGY_CONTENT_MIN_CHARS) {
      vs.push({
        rule: "SUGGESTION_CONTENT_TOO_SHORT",
        severity: "warning",
        message: `strategyContent가 너무 짧습니다 (최소 ${STRATEGY_CONTENT_MIN_CHARS}자)`,
        fieldPath: `suggestions[${i}].strategyContent`,
        actual: content.length,
        expected: STRATEGY_CONTENT_MIN_CHARS,
      });
    }
    if (seenContent.has(content)) {
      vs.push({
        rule: "SUGGESTION_DUPLICATE",
        severity: "error",
        message: "strategyContent가 중복됩니다",
        fieldPath: `suggestions[${i}].strategyContent`,
        actual: content.slice(0, 40),
      });
    }
    seenContent.add(content);
    for (const pat of GENERIC_STRATEGY_PATTERNS) {
      if (pat.test(content)) {
        vs.push({
          rule: "SUGGESTION_CONTENT_GENERIC",
          severity: "warning",
          message: "strategyContent가 공허한 구호성 문구입니다",
          fieldPath: `suggestions[${i}].strategyContent`,
          actual: content.slice(0, 60),
        });
        break;
      }
    }
  }

  // reasoning 빈/짧음
  const reasoning = s.reasoning?.trim() ?? "";
  if (reasoning.length === 0) {
    vs.push({
      rule: "SUGGESTION_REASONING_EMPTY",
      severity: "error",
      message: "reasoning(제안 이유)이 비어 있습니다",
      fieldPath: `suggestions[${i}].reasoning`,
    });
  } else if (reasoning.length < REASONING_MIN_CHARS) {
    vs.push({
      rule: "SUGGESTION_REASONING_TOO_SHORT",
      severity: "warning",
      message: `reasoning이 너무 짧습니다 (최소 ${REASONING_MIN_CHARS}자)`,
      fieldPath: `suggestions[${i}].reasoning`,
      actual: reasoning.length,
      expected: REASONING_MIN_CHARS,
    });
  }
}

// ─────────────────────────────────────────────
// 규칙 체커 — 전체 집합
// ─────────────────────────────────────────────

function checkSuggestionCount(out: SuggestStrategiesResult, vs: Violation[]) {
  const n = out.suggestions.length;
  if (n === 0) {
    vs.push({
      rule: "SUGGESTIONS_EMPTY",
      severity: "error",
      message: "suggestions가 비어 있습니다",
      fieldPath: "suggestions",
      actual: 0,
    });
    return;
  }
  if (n < SUGGESTIONS_MIN_COUNT) {
    vs.push({
      rule: "SUGGESTIONS_COUNT_TOO_FEW",
      severity: "warning",
      message: `suggestions 개수가 부족합니다 (최소 ${SUGGESTIONS_MIN_COUNT}개 권장)`,
      fieldPath: "suggestions",
      actual: n,
      expected: SUGGESTIONS_MIN_COUNT,
    });
  }
  if (n > SUGGESTIONS_MAX_COUNT) {
    vs.push({
      rule: "SUGGESTIONS_COUNT_TOO_MANY",
      severity: "warning",
      message: `suggestions 개수가 과도합니다 (최대 ${SUGGESTIONS_MAX_COUNT}개 권장 — 초과 시 집중도 저하)`,
      fieldPath: "suggestions",
      actual: n,
      expected: SUGGESTIONS_MAX_COUNT,
    });
  }
}

function checkSummary(out: SuggestStrategiesResult, vs: Violation[]) {
  const summary = out.summary?.trim() ?? "";
  if (summary.length === 0) {
    vs.push({
      rule: "SUMMARY_EMPTY",
      severity: "warning",
      message: "summary가 비어 있습니다",
      fieldPath: "summary",
    });
    return;
  }
  if (summary.length < SUMMARY_MIN_CHARS) {
    vs.push({
      rule: "SUMMARY_TOO_SHORT",
      severity: "warning",
      message: `summary가 너무 짧습니다 (최소 ${SUMMARY_MIN_CHARS}자)`,
      fieldPath: "summary",
      actual: summary.length,
      expected: SUMMARY_MIN_CHARS,
    });
  }
}

// ─────────────────────────────────────────────
// 메인 진입점
// ─────────────────────────────────────────────

/**
 * suggestStrategies 출력에 대한 L1 deterministic validation.
 * LLM 호출 0회 — 규칙 기반 즉시 검증.
 *
 * 사용 예:
 *   const result = validateStrategyOutput(parsed);
 *   if (!result.passed) { logViolations(result.violations); }
 */
export function validateStrategyOutput(out: SuggestStrategiesResult): ValidationResult {
  const violations: Violation[] = [];
  checkSuggestionCount(out, violations);
  const seenContent = new Set<string>();
  out.suggestions.forEach((s, i) => checkSuggestion(s, i, seenContent, violations));
  checkSummary(out, violations);
  return summarizeViolations(violations);
}
