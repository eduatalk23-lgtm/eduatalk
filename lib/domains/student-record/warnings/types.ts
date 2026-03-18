// ============================================
// Phase 6.5 — 조기 경보 타입
// ============================================

export type RecordWarningRuleId =
  | "missing_career_activity"
  | "major_subject_decline"
  | "changche_empty"
  | "haengteuk_draft"
  | "reading_insufficient"
  | "course_inadequacy"
  | "storyline_weak"
  | "storyline_gap"
  | "storyline_inconsistent"
  | "min_score_critical"
  | "min_score_bottleneck"
  | "min_score_trend_down";

export type RecordWarningSeverity = "critical" | "high" | "medium" | "low";

export type RecordWarningCategory = "record" | "course" | "storyline" | "min_score";

export interface RecordWarning {
  ruleId: RecordWarningRuleId;
  severity: RecordWarningSeverity;
  category: RecordWarningCategory;
  title: string;
  message: string;
  suggestion?: string;
}

export const WARNING_LABELS: Record<RecordWarningRuleId, string> = {
  missing_career_activity: "진로활동 미기록",
  major_subject_decline: "전공교과 성적 하락",
  changche_empty: "창체 미작성",
  haengteuk_draft: "행특 미확정",
  reading_insufficient: "독서 부족",
  course_inadequacy: "교과이수 부적합",
  storyline_weak: "스토리라인 약함",
  storyline_gap: "스토리라인 공백",
  storyline_inconsistent: "스토리라인 불일치",
  min_score_critical: "최저 미충족 위험",
  min_score_bottleneck: "최저 병목 과목",
  min_score_trend_down: "최저 추이 하락",
};
