// ============================================
// Phase 6.5 — 조기 경보 엔진 (순수 함수)
// 기존 React Query 데이터로 클라이언트에서 계산
// ============================================
//
// ============================================
// 합격률 낮은 패턴 14개 ↔ 경고 엔진 매핑
// ============================================
//
// [구조적 문제 — structural]
// P1  나열식              → checkContentQualityPatterns (PATTERN_MAP["P1_나열식"])    → ruleId: "setek_enumeration"
// P3  키워드만            → checkContentQualityPatterns (PATTERN_MAP["P3_키워드만"])  → ruleId: "inquiry_keyword_only"
// P4  내신↔탐구불일치     → checkContentQualityPatterns (PATTERN_MAP["P4_내신탐구불일치"]) → ruleId: "grade_inquiry_mismatch"
//
// [과학적/논리적 정합성 — scientific (F1~F6)]
// F1  별개활동포장        → checkContentQualityPatterns (SCIENTIFIC_PATTERN_CODES 통합 감지) → ruleId: "content_quality_scientific"
// F2  인과단절            → checkContentQualityPatterns (SCIENTIFIC_PATTERN_CODES 통합 감지) → ruleId: "content_quality_scientific"
// F3  출처불일치          → checkContentQualityPatterns (SCIENTIFIC_PATTERN_CODES 통합 감지) → ruleId: "content_quality_scientific"
// F4  전제불일치          → checkContentQualityPatterns (SCIENTIFIC_PATTERN_CODES 통합 감지) → ruleId: "content_quality_scientific"
// F5  비교군오류          → checkContentQualityPatterns (SCIENTIFIC_PATTERN_CODES 통합 감지) → ruleId: "content_quality_scientific"
// F6  자명한결론          → checkContentQualityPatterns (SCIENTIFIC_PATTERN_CODES 통합 감지) → ruleId: "content_quality_scientific"
// 참고: F1~F6는 각각 별도 ruleId를 두지 않고 "content_quality_scientific"으로 통합.
//       issues 배열에 세부 코드(F1~F6)가 보존되어 message로 노출됨.
//
// [거시적 패턴 — macro]
// F10 성장부재            → checkContentQualityPatterns (PATTERN_MAP["F10_성장부재"])      → ruleId: "setek_no_growth_curve"
// F12 자기주도성부재       → checkContentQualityPatterns (PATTERN_MAP["F12_자기주도성부재"]) → ruleId: "setek_abstract_generic"
// F16 진로과잉도배         → checkContentQualityPatterns (PATTERN_MAP["F16_진로과잉도배"])   → ruleId: "setek_career_overdose"
//
// [메타 패턴 — meta]
// M1  교사관찰불가         → checkContentQualityPatterns (PATTERN_MAP["M1_교사관찰불가"])    → ruleId: "setek_teacher_unobservable"
//
// ============================================

import type { RecordWarning } from "./types";
import type {
  RecordTabData,
  StorylineTabData,
  DiagnosisTabData,
  StrategyTabData,
  RoadmapItem,
} from "../types";

import {
  checkMissingCareerActivity,
  checkChangcheEmpty,
  checkHaengteukDraft,
  checkReadingInsufficient,
  checkReadingNotConnected,
} from "./checkers-record";
import {
  checkCourseInadequacy,
  checkStorylineWarnings,
} from "./checkers-curriculum";
import {
  checkMajorSubjectDecline,
  checkMinScoreTrendDown,
  checkMinScoreWarnings,
  checkStrategyWarnings,
  checkUnfinishedRoadmap,
} from "./checkers-trends";
import {
  checkContentQuality,
  checkContentQualityPatterns,
} from "./checkers-quality";

/** 학기별 성적 (경보 엔진용 경량 타입) */
export interface GradeEntry {
  subjectName: string;
  grade: number; // 학년
  semester: number;
  /** 등급. 9등급제: 1~9, 5등급제: 1~5. 비교 시 숫자가 클수록 낮은 등급. */
  rankGrade: number | null;
}

/** 품질 점수 경고 엔진용 경량 타입 */
export interface ContentQualityRow {
  record_type: "setek" | "changche" | "haengteuk" | "personal_setek";
  record_id: string;
  overall_score: number;
  issues: string[];
  feedback: string | null;
}

/** 경고 엔진에 전달할 데이터 */
export interface WarningCheckInput {
  /** 학년별 기록 데이터 (Map<grade, RecordTabData>) */
  recordsByGrade: Map<number, RecordTabData>;
  /** 스토리라인 데이터 */
  storylineData: StorylineTabData | null;
  /** 진단 데이터 */
  diagnosisData: DiagnosisTabData | null;
  /** 전략 데이터 */
  strategyData: StrategyTabData | null;
  /** 학생의 현재 학년 */
  currentGrade: number;
  /** 내신 성적 (전공교과 하락 감지용, optional) */
  scores?: GradeEntry[];
  /** 목표 전공 계열 → MAJOR_RECOMMENDED_COURSES key (optional) */
  targetMajorField?: string | null;
  /** 교육과정 연도 (2015 or 2022). 과목 목록 선택용. */
  curriculumYear?: number;
  /** Phase QA: 콘텐츠 품질 점수 (optional) */
  qualityScores?: ContentQualityRow[];
  /** 로드맵 항목 (미완료 이전 학년 경고용, optional) */
  roadmapItems?: RoadmapItem[];
}

/** 레코드의 유효 콘텐츠 (4-layer: imported > confirmed > content > ai_draft) */
export function getEffective(rec: { imported_content?: string | null; confirmed_content?: string | null; content?: string | null; ai_draft_content?: string | null }): string {
  return rec.imported_content?.trim() || rec.confirmed_content?.trim() || rec.content?.trim() || rec.ai_draft_content?.trim() || "";
}

/** 전체 경고 계산 */
export function computeWarnings(input: WarningCheckInput): RecordWarning[] {
  const warnings: RecordWarning[] = [];

  const push = (w: RecordWarning | null) => { if (w) warnings.push(w); };
  const pushAll = (ws: RecordWarning[]) => { for (const w of ws) warnings.push(w); };

  // ─── 기록 관련 ───
  pushAll(checkMissingCareerActivity(input));
  pushAll(checkChangcheEmpty(input));
  pushAll(checkHaengteukDraft(input));
  pushAll(checkReadingInsufficient(input));
  pushAll(checkReadingNotConnected(input));

  // ─── 이수 관련 ───
  push(checkCourseInadequacy(input));

  // ─── 스토리라인 관련 ───
  for (const w of checkStorylineWarnings(input)) push(w);

  // ─── 최저 관련 ───
  for (const w of checkMinScoreWarnings(input)) push(w);

  // ─── 성적 추이 관련 ───
  push(checkMajorSubjectDecline(input));
  push(checkMinScoreTrendDown(input));

  // ─── 전략 관련 ───
  pushAll(checkStrategyWarnings(input));

  // ─── 품질 관련 ───
  if (input.qualityScores && input.qualityScores.length > 0) {
    pushAll(checkContentQuality(input.qualityScores));
    pushAll(checkContentQualityPatterns(input.qualityScores));
  }

  // ─── 로드맵 관련 ───
  if (input.roadmapItems && input.roadmapItems.length > 0) {
    pushAll(checkUnfinishedRoadmap(input.roadmapItems, input.currentGrade));
  }

  // ─── 금칙어 관련 ───
  try {
    const { checkForbiddenExpressions } = require("./checkers-forbidden") as typeof import("./checkers-forbidden");
    const allRecords = Object.values(input.recordsByGrade ?? {}).flatMap((data) => [
      ...(data.seteks ?? []),
      ...(data.changches ?? []),
      ...(data.haengteuk ? [data.haengteuk] : []),
    ]);
    if (allRecords.length > 0) {
      pushAll(checkForbiddenExpressions(allRecords));
    }
  } catch {
    // 금칙어 모듈 로드 실패 시 무시 (graceful degradation)
  }

  return warnings;
}
