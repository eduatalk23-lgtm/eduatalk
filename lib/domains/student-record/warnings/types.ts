// ============================================
// Phase 6.5 — 조기 경보 타입
// ============================================

export type RecordWarningRuleId =
  | "missing_career_activity"
  | "major_subject_decline"
  | "changche_empty"
  | "haengteuk_draft"
  | "reading_insufficient"
  | "reading_not_connected"
  | "course_inadequacy"
  | "storyline_weak"
  | "storyline_gap"
  | "storyline_inconsistent"
  | "min_score_critical"
  | "min_score_bottleneck"
  | "min_score_trend_down"
  | "no_applications"
  | "strategy_incomplete"
  | "content_quality_critical"
  | "content_quality_low"
  | "content_quality_scientific"
  | "setek_enumeration"        // P1_나열식
  | "setek_abstract_generic"   // F12_자기주도성부재
  | "inquiry_keyword_only"     // P3_키워드만
  | "grade_inquiry_mismatch"   // P4_내신탐구불일치
  | "setek_no_growth_curve"    // F10_성장부재 (학년 간 성장 곡선 부재)
  | "setek_career_overdose"    // F16_진로과잉도배 (모든 교과 진로 키워드 도배)
  | "setek_teacher_unobservable" // M1_교사관찰불가 (교사가 관찰 불가한 내면 상태 기술)
  | "roadmap_unfinished_prev_grade"
  | "neis_forbidden_award"
  | "neis_forbidden_university"
  | "neis_forbidden_academy"
  | "neis_forbidden_certification"
  | "neis_forbidden_violence"
  | "neis_forbidden_other";

export type RecordWarningSeverity = "critical" | "high" | "medium" | "low";

export type RecordWarningCategory = "record" | "course" | "storyline" | "min_score" | "strategy" | "quality" | "roadmap" | "forbidden";

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
  reading_not_connected: "독서-탐구 미연결",
  course_inadequacy: "교과이수 부적합",
  storyline_weak: "스토리라인 약함",
  storyline_gap: "스토리라인 공백",
  storyline_inconsistent: "스토리라인 불일치",
  min_score_critical: "최저 미충족 위험",
  min_score_bottleneck: "최저 병목 과목",
  min_score_trend_down: "최저 추이 하락",
  no_applications: "지원 현황 미등록",
  strategy_incomplete: "보완전략 미수립",
  content_quality_critical: "콘텐츠 품질 부족",
  content_quality_low: "콘텐츠 품질 개선 권장",
  content_quality_scientific: "과학적 정합성 문제",
  setek_enumeration: "세특 나열식 기술",
  setek_abstract_generic: "세특 추상적/복붙 의심",
  inquiry_keyword_only: "탐구 키워드만 존재",
  grade_inquiry_mismatch: "내신↔탐구 심화도 불일치",
  setek_no_growth_curve: "학년 간 성장 곡선 부재",
  setek_career_overdose: "진로 키워드 과잉 도배",
  setek_teacher_unobservable: "교사 관찰 불가 표현",
  roadmap_unfinished_prev_grade: "이전 학년 미완료 로드맵",
  neis_forbidden_award: "수상 내역 기재 감지",
  neis_forbidden_university: "대학명 기재 감지",
  neis_forbidden_academy: "사교육 기관명 감지",
  neis_forbidden_certification: "자격증/시험 점수 감지",
  neis_forbidden_violence: "학교폭력 관련 감지",
  neis_forbidden_other: "NEIS 금칙어 감지",
};
