// ============================================
// 금칙어 경고 어댑터
// detectForbiddenExpressions → RecordWarning[] 변환
// ============================================

import type { RecordWarning, RecordWarningRuleId } from "./types";
import { detectForbiddenExpressions, type ForbiddenCategory } from "../forbidden-expressions";
import { getEffective } from "./engine";

/** 카테고리 → 경고 rule ID 매핑 */
const CATEGORY_TO_RULE: Record<ForbiddenCategory, RecordWarningRuleId> = {
  award_mention: "neis_forbidden_award",
  university_name: "neis_forbidden_university",
  private_academy: "neis_forbidden_academy",
  certification_score: "neis_forbidden_certification",
  school_violence: "neis_forbidden_violence",
  external_org: "neis_forbidden_other",
  paper_citation: "neis_forbidden_other",
  outside_school_activity: "neis_forbidden_other",
  forbidden_special_char: "neis_forbidden_other",
};

/**
 * 레코드 배열에서 금칙어 감지 → RecordWarning 배열 반환
 */
export function checkForbiddenExpressions(
  records: Array<{
    imported_content?: string | null;
    confirmed_content?: string | null;
    content?: string | null;
    ai_draft_content?: string | null;
  }>,
): RecordWarning[] {
  const warnings: RecordWarning[] = [];
  const seen = new Set<string>(); // 중복 rule+category 방지

  for (const rec of records) {
    const text = getEffective(rec);
    if (!text || text.length < 5) continue;

    const result = detectForbiddenExpressions(text);
    for (const m of result.matches) {
      const ruleId = CATEGORY_TO_RULE[m.category];
      const key = `${ruleId}:${m.matchedText}`;
      if (seen.has(key)) continue;
      seen.add(key);

      warnings.push({
        ruleId,
        severity: m.severity === "error" ? "critical" : "medium",
        category: "forbidden",
        title: m.description,
        message: `"${m.matchedText}" — ${m.description}`,
        suggestion: "기재요령에 따라 해당 표현을 수정하거나 삭제해 주세요.",
      });
    }
  }

  return warnings;
}
