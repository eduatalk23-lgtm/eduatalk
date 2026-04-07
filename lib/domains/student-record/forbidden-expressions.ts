// ============================================
// NEIS 금칙어(금지 표현) 검증 엔진
// 순수 함수, regex + 키워드 매칭
// ============================================

import { NEIS_FORBIDDEN_RULES, getActiveRules } from "./forbidden-expressions-rules";

/** NEIS 금칙어 카테고리 */
export type ForbiddenCategory =
  | "award_mention"
  | "external_org"
  | "university_name"
  | "private_academy"
  | "certification_score"
  | "paper_citation"
  | "outside_school_activity"
  | "forbidden_special_char"
  | "school_violence";

export type ForbiddenSeverity = "error" | "warning";

export interface ForbiddenExpressionRule {
  id: string;
  category: ForbiddenCategory;
  severity: ForbiddenSeverity;
  /** Pre-compiled regex pattern */
  pattern: RegExp;
  description: string;
  /** Applicable from this curriculum year (inclusive). null = all years */
  fromYear?: number | null;
  /** Applicable until this curriculum year (inclusive). null = all years */
  untilYear?: number | null;
}

export interface ForbiddenExpressionMatch {
  ruleId: string;
  category: ForbiddenCategory;
  severity: ForbiddenSeverity;
  description: string;
  matchedText: string;
  startIndex: number;
  endIndex: number;
}

export interface ForbiddenExpressionResult {
  matches: ForbiddenExpressionMatch[];
  hasErrors: boolean;
  hasWarnings: boolean;
  errorCount: number;
  warningCount: number;
}

export interface DetectOptions {
  curriculumYear?: number;
  /** Record section — certain rules exempt in specific sections */
  sectionType?: "setek" | "changche" | "haengteuk" | "personal_setek" | "reading";
  /** Categories to skip */
  skipCategories?: ForbiddenCategory[];
}

/**
 * NEIS 금지 표현 감지 (순수 함수)
 *
 * 교육부 학교생활기록부 기재요령에 따른 금칙어를 검출.
 * pre-compiled regex로 500자 입력에서 sub-ms 성능.
 */
export function detectForbiddenExpressions(
  text: string,
  options?: DetectOptions,
): ForbiddenExpressionResult {
  if (!text || text.trim().length === 0) {
    return { matches: [], hasErrors: false, hasWarnings: false, errorCount: 0, warningCount: 0 };
  }

  const rules = options?.curriculumYear
    ? getActiveRules(options.curriculumYear)
    : NEIS_FORBIDDEN_RULES;

  const skipSet = new Set(options?.skipCategories ?? []);
  const matches: ForbiddenExpressionMatch[] = [];

  for (const rule of rules) {
    if (skipSet.has(rule.category)) continue;

    // Reset regex lastIndex for global patterns
    rule.pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(text)) !== null) {
      matches.push({
        ruleId: rule.id,
        category: rule.category,
        severity: rule.severity,
        description: rule.description,
        matchedText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });

      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        rule.pattern.lastIndex++;
      }
    }
  }

  const errorCount = matches.filter((m) => m.severity === "error").length;
  const warningCount = matches.filter((m) => m.severity === "warning").length;

  return {
    matches,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
    errorCount,
    warningCount,
  };
}
