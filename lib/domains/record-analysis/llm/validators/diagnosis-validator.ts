// ============================================
// L4-D / L1-Deterministic Validator — ai_diagnosis 출력 검증
//
// 가이드 도메인 c3.3-v1 deterministic-validator.ts 패턴 이식.
// LLM 응답의 구조·의미적 결함을 규칙 기반으로 감지 (LLM 호출 0회).
// 기존 generateAiDiagnosis의 count-fallback과는 별도 차원의 검증:
//   - 기존: 강점·약점·improvements 개수 부족 시 자동 보충
//   - 본 검증: 내용의 의미적 일관성, 금지어, 형식 위반 등
//
// L2(LLM-judge) / L3(targeted repair)는 별도 모듈로 추가 예정 (drop-in).
// ============================================

import type { Violation, ValidationResult } from "./types";
import { summarizeViolations } from "./types";
import type { DiagnosisGenerationResult } from "../actions/generateDiagnosis";
import {
  GENERIC_SLOGAN_PATTERNS,
  checkNotEmpty,
  checkMinLength,
  checkDuplicate,
} from "./shared-rules";

// ─────────────────────────────────────────────
// 규칙 임계값
// ─────────────────────────────────────────────

const STRENGTH_MIN_CHARS = 15;
const WEAKNESS_MIN_CHARS = 15;
const IMPROVEMENT_ACTION_MIN_CHARS = 10;
const STRATEGY_NOTES_MIN_CHARS = 50;
const RECOMMENDED_MAJORS_MIN = 1;

const VALID_OVERALL_GRADES = new Set(["A+", "A-", "B+", "B", "B-", "C"]);
const VALID_DIRECTION_STRENGTHS = new Set(["strong", "moderate", "weak"]);
const VALID_IMPROVEMENT_PRIORITIES = new Set(["높음", "중간", "낮음"]);

/**
 * 강점에 등장하면 의미 충돌 — "강점인데 부정적 단어가 포함됨".
 * 정규표현식이 아니라 단어 매칭으로 처리하여 false positive 감소.
 */
const STRENGTH_NEGATIVE_TOKENS = [
  "약함", "약하다", "약합니다",
  "부족", "미흡", "미진",
  "낮음", "낮습니다", "낮다",
  "없음", "없습니다", "없다",
  "안 됨", "안됨", "취약",
  "결핍", "한계",
];

/**
 * 약점에 등장하면 의미 충돌 — "약점인데 강한 칭찬어".
 * 단, 약점 설명에서 "우수한 X에 비해 Y가 부족" 같은 비교 표현은 가능 →
 * warning 으로만 표시 (error 아님).
 */
const WEAKNESS_POSITIVE_TOKENS = [
  "탁월",
  "뛰어남", "뛰어납니다",
  "매우 우수", "월등",
  "최상위",
];

// GENERIC_ACTION_PATTERNS은 shared-rules의 GENERIC_SLOGAN_PATTERNS(6종)으로 통합됨.

// ─────────────────────────────────────────────
// 규칙 체커
// ─────────────────────────────────────────────

function checkOverallGrade(out: DiagnosisGenerationResult, vs: Violation[]) {
  if (!VALID_OVERALL_GRADES.has(out.overallGrade)) {
    vs.push({
      rule: "OVERALL_GRADE_INVALID",
      severity: "error",
      message: "overallGrade가 유효한 등급(A+|A-|B+|B|B-|C)이 아닙니다",
      fieldPath: "overallGrade",
      actual: out.overallGrade,
    });
  }
}

function checkDirectionStrength(out: DiagnosisGenerationResult, vs: Violation[]) {
  if (!VALID_DIRECTION_STRENGTHS.has(out.directionStrength)) {
    vs.push({
      rule: "DIRECTION_STRENGTH_INVALID",
      severity: "error",
      message: "directionStrength는 strong|moderate|weak 중 하나여야 합니다",
      fieldPath: "directionStrength",
      actual: out.directionStrength,
    });
  }
}

function checkStrengths(out: DiagnosisGenerationResult, vs: Violation[]) {
  const seen = new Set<string>();
  out.strengths.forEach((s, i) => {
    const trimmed = s.trim();
    const fp = `strengths[${i}]`;
    if (checkNotEmpty(trimmed, "STRENGTHS_EMPTY", fp, vs)) return;
    checkMinLength(trimmed, STRENGTH_MIN_CHARS, "STRENGTHS_TOO_SHORT", fp, vs);
    checkDuplicate(seen, trimmed, "STRENGTHS_DUPLICATE", fp, vs);
    seen.add(trimmed);
    for (const tok of STRENGTH_NEGATIVE_TOKENS) {
      if (trimmed.includes(tok)) {
        vs.push({
          rule: "STRENGTHS_NEGATIVE_WORD",
          severity: "error",
          message: `강점 항목에 부정 표현("${tok}")이 포함되어 있습니다`,
          fieldPath: fp,
          actual: trimmed.slice(0, 60),
        });
        break;
      }
    }
  });
}

function checkWeaknesses(out: DiagnosisGenerationResult, vs: Violation[]) {
  const seen = new Set<string>();
  out.weaknesses.forEach((w, i) => {
    const trimmed = w.trim();
    const fp = `weaknesses[${i}]`;
    if (checkNotEmpty(trimmed, "WEAKNESSES_EMPTY", fp, vs)) return;
    checkMinLength(trimmed, WEAKNESS_MIN_CHARS, "WEAKNESSES_TOO_SHORT", fp, vs);
    checkDuplicate(seen, trimmed, "WEAKNESSES_DUPLICATE", fp, vs);
    seen.add(trimmed);
    for (const tok of WEAKNESS_POSITIVE_TOKENS) {
      if (trimmed.includes(tok)) {
        vs.push({
          rule: "WEAKNESSES_POSITIVE_WORD",
          severity: "warning",
          message: `약점 항목에 강한 칭찬어("${tok}")가 포함되어 있습니다 — 의미 충돌 가능성`,
          fieldPath: fp,
          actual: trimmed.slice(0, 60),
        });
        break;
      }
    }
  });
}

function checkImprovements(out: DiagnosisGenerationResult, vs: Violation[]) {
  out.improvements.forEach((imp, i) => {
    if (!VALID_IMPROVEMENT_PRIORITIES.has(imp.priority)) {
      vs.push({
        rule: "IMPROVEMENT_PRIORITY_INVALID",
        severity: "error",
        message: "improvement.priority는 높음|중간|낮음 중 하나여야 합니다",
        fieldPath: `improvements[${i}].priority`,
        actual: imp.priority,
      });
    }
    if (!imp.area || imp.area.trim().length === 0) {
      vs.push({
        rule: "IMPROVEMENT_AREA_EMPTY",
        severity: "error",
        message: "improvement.area가 비어 있습니다",
        fieldPath: `improvements[${i}].area`,
      });
    }
    const action = imp.action?.trim() ?? "";
    if (action.length < IMPROVEMENT_ACTION_MIN_CHARS) {
      vs.push({
        rule: "IMPROVEMENT_ACTION_TOO_SHORT",
        severity: "warning",
        message: `improvement.action이 너무 짧습니다 (최소 ${IMPROVEMENT_ACTION_MIN_CHARS}자)`,
        fieldPath: `improvements[${i}].action`,
        actual: action.length,
        expected: IMPROVEMENT_ACTION_MIN_CHARS,
      });
    } else {
      for (const pat of GENERIC_SLOGAN_PATTERNS) {
        if (pat.test(action)) {
          vs.push({
            rule: "IMPROVEMENT_ACTION_GENERIC",
            severity: "warning",
            message: "improvement.action이 공허한 구호성 문구입니다",
            fieldPath: `improvements[${i}].action`,
            actual: action.slice(0, 60),
          });
          break;
        }
      }
    }
    if (!imp.gap || imp.gap.trim().length === 0) {
      vs.push({
        rule: "IMPROVEMENT_GAP_EMPTY",
        severity: "warning",
        message: "improvement.gap이 비어 있습니다 — 갭 설명 누락",
        fieldPath: `improvements[${i}].gap`,
      });
    }
  });
}

function checkRecommendedMajors(out: DiagnosisGenerationResult, vs: Violation[]) {
  if (out.recommendedMajors.length < RECOMMENDED_MAJORS_MIN) {
    vs.push({
      rule: "RECOMMENDED_MAJORS_MIN",
      severity: "warning",
      message: `추천 전공이 부족합니다 (최소 ${RECOMMENDED_MAJORS_MIN}개)`,
      fieldPath: "recommendedMajors",
      actual: out.recommendedMajors.length,
      expected: RECOMMENDED_MAJORS_MIN,
    });
  }
}

function checkStrategyNotes(out: DiagnosisGenerationResult, vs: Violation[]) {
  const len = out.strategyNotes?.trim().length ?? 0;
  if (len < STRATEGY_NOTES_MIN_CHARS) {
    vs.push({
      rule: "STRATEGY_NOTES_TOO_SHORT",
      severity: "warning",
      message: `strategyNotes가 너무 짧습니다 (최소 ${STRATEGY_NOTES_MIN_CHARS}자)`,
      fieldPath: "strategyNotes",
      actual: len,
      expected: STRATEGY_NOTES_MIN_CHARS,
    });
  }
}

// ─────────────────────────────────────────────
// 메인 진입점
// ─────────────────────────────────────────────

/**
 * ai_diagnosis 출력에 대한 L1 deterministic validation.
 * LLM 호출 0회 — 규칙 기반 즉시 검증.
 *
 * 사용 예:
 *   const result = validateDiagnosisOutput(parsed);
 *   if (!result.passed) { logViolations(result.violations); }
 */
export function validateDiagnosisOutput(out: DiagnosisGenerationResult): ValidationResult {
  const violations: Violation[] = [];
  checkOverallGrade(out, violations);
  checkDirectionStrength(out, violations);
  checkStrengths(out, violations);
  checkWeaknesses(out, violations);
  checkImprovements(out, violations);
  checkRecommendedMajors(out, violations);
  checkStrategyNotes(out, violations);
  return summarizeViolations(violations);
}
