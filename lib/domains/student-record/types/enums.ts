// ============================================
// 생기부 도메인 — 상수 유니온 타입
// ============================================

export type RecordStatus = "draft" | "review" | "final";

export type ChangcheActivityType = "autonomy" | "club" | "career";

export type ApplicationRound =
  | "early_comprehensive" | "early_subject" | "early_essay"
  | "early_practical" | "early_special" | "early_other"
  | "regular_ga" | "regular_na" | "regular_da"
  | "additional" | "special_quota";

export type ApplicationResult = "pending" | "accepted" | "waitlisted" | "rejected" | "registered";

export type CompetencyArea = "academic" | "career" | "community";

export type CompetencyItemCode =
  | "academic_achievement" | "academic_attitude" | "academic_inquiry"
  | "career_course_effort" | "career_course_achievement" | "career_exploration"
  | "community_collaboration" | "community_caring"
  | "community_integrity" | "community_leadership";

export type CompetencyGrade = "A+" | "A-" | "B+" | "B" | "B-" | "C";

export type StorylineStrength = "strong" | "moderate" | "weak";

export type RecordType = "setek" | "personal_setek" | "changche" | "haengteuk" | "reading";

export type RoadmapArea =
  | "autonomy" | "club" | "career"
  | "setek" | "personal_setek"
  | "reading" | "course_selection"
  | "competition" | "external"
  | "volunteer" | "general";

export type RoadmapItemStatus = "planning" | "confirmed" | "in_progress" | "completed";

export type SchoolCategory =
  | "general" | "autonomous_private" | "autonomous_public"
  | "science" | "foreign_lang" | "international"
  | "art" | "sports" | "meister" | "specialized" | "other";

export type InterviewQuestionType = "factual" | "reasoning" | "application" | "value" | "controversial";

export type TagEvaluation = "positive" | "negative" | "needs_review";

export type StrategyTargetArea =
  | "autonomy" | "club" | "career"
  | "setek" | "personal_setek" | "reading"
  | "haengteuk" | "score" | "general";

export type StrategyPriority = "critical" | "high" | "medium" | "low";

export type StrategyStatus = "planned" | "in_progress" | "done";

export type CompetencyScope = "yearly" | "cumulative";

export type DiagnosisSource = "ai" | "manual";

export type TagContext = "analysis" | "draft_analysis";

export type ActivityTagStatus = "suggested" | "confirmed";

export type DiagnosisStatus = "draft" | "confirmed";

export type ActivitySummaryStatus = "draft" | "confirmed" | "published";
