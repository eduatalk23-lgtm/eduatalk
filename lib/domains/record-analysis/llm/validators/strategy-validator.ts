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
import {
  GENERIC_SLOGAN_PATTERNS,
  checkNotEmpty,
  checkMinLength,
  checkDuplicate,
} from "./shared-rules";

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

// GENERIC_STRATEGY_PATTERNS은 shared-rules의 GENERIC_SLOGAN_PATTERNS(6종)으로 통합됨.

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
  const contentFp = `suggestions[${i}].strategyContent`;
  if (checkNotEmpty(content, "SUGGESTION_CONTENT_EMPTY", contentFp, vs)) {
    // 빈값 이후 검증 스킵 — seenContent에는 추가하지 않는다
  } else {
    checkMinLength(content, STRATEGY_CONTENT_MIN_CHARS, "SUGGESTION_CONTENT_TOO_SHORT", contentFp, vs);
    checkDuplicate(seenContent, content, "SUGGESTION_DUPLICATE", contentFp, vs);
    seenContent.add(content);
    for (const pat of GENERIC_SLOGAN_PATTERNS) {
      if (pat.test(content)) {
        vs.push({
          rule: "SUGGESTION_CONTENT_GENERIC",
          severity: "warning",
          message: "strategyContent가 공허한 구호성 문구입니다",
          fieldPath: contentFp,
          actual: content.slice(0, 60),
        });
        break;
      }
    }
  }

  // reasoning 빈/짧음
  const reasoning = s.reasoning?.trim() ?? "";
  const reasoningFp = `suggestions[${i}].reasoning`;
  if (!checkNotEmpty(reasoning, "SUGGESTION_REASONING_EMPTY", reasoningFp, vs)) {
    checkMinLength(reasoning, REASONING_MIN_CHARS, "SUGGESTION_REASONING_TOO_SHORT", reasoningFp, vs);
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
