// ============================================
// Phase 6.5 — 조기 경보 엔진 (순수 함수)
// 기존 React Query 데이터로 클라이언트에서 계산
// ============================================

import type { RecordWarning } from "./types";
import type {
  RecordTabData,
  StorylineTabData,
  DiagnosisTabData,
  StrategyTabData,
  Storyline,
  RoadmapItem,
} from "../types";
import { MAJOR_RECOMMENDED_COURSES, getMajorRecommendedCourses } from "../constants";

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

const MIN_READINGS_PER_GRADE = 2;
const COURSE_ADEQUACY_THRESHOLD = 50;

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

  return warnings;
}

// ─── 기록 경고 ──────────────────────────────────

function checkMissingCareerActivity(input: WarningCheckInput): RecordWarning[] {
  const results: RecordWarning[] = [];
  for (const [grade, data] of input.recordsByGrade) {
    if (grade > input.currentGrade) continue;
    const hasCareer = data.changche.some(
      (c) => c.activity_type === "career" && c.content && c.content.trim().length > 10,
    );
    if (!hasCareer) {
      results.push({
        ruleId: "missing_career_activity",
        severity: grade < input.currentGrade ? "high" : "medium",
        category: "record",
        title: "진로활동 미기록",
        message: `${grade}학년 진로활동 기록이 없습니다.`,
        suggestion: "진로 관련 창체활동을 기록해주세요.",
      });
    }
  }
  return results;
}

function checkChangcheEmpty(input: WarningCheckInput): RecordWarning[] {
  const results: RecordWarning[] = [];
  const labels: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
  for (const [grade, data] of input.recordsByGrade) {
    if (grade > input.currentGrade) continue;
    const emptyTypes = ["autonomy", "club", "career"].filter((type) => {
      const record = data.changche.find((c) => c.activity_type === type);
      return !record || !record.content || record.content.trim().length < 10;
    });
    if (emptyTypes.length > 0) {
      results.push({
        ruleId: "changche_empty",
        severity: grade < input.currentGrade ? "high" : "medium",
        category: "record",
        title: "창체 미작성",
        message: `${grade}학년 ${emptyTypes.map((t) => labels[t] ?? t).join(", ")} 영역이 비어있습니다.`,
        suggestion: "해당 학년의 창체 활동을 기록해주세요.",
      });
    }
  }
  return results;
}

function checkHaengteukDraft(input: WarningCheckInput): RecordWarning[] {
  const results: RecordWarning[] = [];
  for (const [grade, data] of input.recordsByGrade) {
    if (grade >= input.currentGrade) continue; // 이전 학년만 체크
    if (!data.haengteuk || !data.haengteuk.content || data.haengteuk.content.trim().length < 20) {
      results.push({
        ruleId: "haengteuk_draft",
        severity: "high",
        category: "record",
        title: "행특 미확정",
        message: `${grade}학년 행동특성 및 종합의견이 작성되지 않았습니다.`,
        suggestion: "이전 학년 행특을 완성해주세요.",
      });
    }
  }
  return results;
}

function checkReadingInsufficient(input: WarningCheckInput): RecordWarning[] {
  const results: RecordWarning[] = [];
  for (const [grade, data] of input.recordsByGrade) {
    if (grade > input.currentGrade) continue;
    if (data.readings.length < MIN_READINGS_PER_GRADE) {
      results.push({
        ruleId: "reading_insufficient",
        severity: "medium",
        category: "record",
        title: "독서 부족",
        message: `${grade}학년 독서활동이 ${data.readings.length}건입니다 (권장: ${MIN_READINGS_PER_GRADE}권 이상).`,
        suggestion: "전공 관련 독서를 추가로 기록해주세요.",
      });
    }
  }
  return results;
}

// ─── 이수 경고 ──────────────────────────────────

function checkCourseInadequacy(input: WarningCheckInput): RecordWarning | null {
  const score = input.diagnosisData?.courseAdequacy?.score;
  if (score == null) return null;
  if (score < COURSE_ADEQUACY_THRESHOLD) {
    const notTaken = input.diagnosisData?.courseAdequacy?.notTaken ?? [];
    return {
      ruleId: "course_inadequacy",
      severity: score < 30 ? "critical" : "high",
      category: "course",
      title: "교과이수 부적합",
      message: `교과이수적합도 ${score}점으로 기준(${COURSE_ADEQUACY_THRESHOLD}점) 미달입니다.`,
      suggestion: notTaken.length > 0
        ? `미이수 추천 과목: ${notTaken.slice(0, 3).join(", ")}${notTaken.length > 3 ? ` 외 ${notTaken.length - 3}개` : ""}`
        : "추천 교과목 이수를 검토해주세요.",
    };
  }
  return null;
}

// ─── 스토리라인 경고 ────────────────────────────

function checkStorylineWarnings(input: WarningCheckInput): RecordWarning[] {
  const warnings: RecordWarning[] = [];
  const storylines = input.storylineData?.storylines ?? [];

  if (storylines.length === 0 && input.currentGrade >= 2) {
    warnings.push({
      ruleId: "storyline_gap",
      severity: "high",
      category: "storyline",
      title: "스토리라인 없음",
      message: "등록된 스토리라인이 없습니다. 3년간 성장 서사를 구성해주세요.",
      suggestion: "AI 탐구 연결 감지를 활용하여 스토리라인을 자동 생성해보세요.",
    });
    return warnings;
  }

  for (const s of storylines) {
    // 약한 스토리라인
    if (s.strength === "weak") {
      warnings.push({
        ruleId: "storyline_weak",
        severity: "medium",
        category: "storyline",
        title: "스토리라인 약함",
        message: `"${s.title}" 스토리라인의 강도가 '약함'입니다.`,
        suggestion: "관련 활동을 보강하거나 근거를 추가해주세요.",
      });
    }

    // 학년 테마 공백
    const gaps = checkStorylineGradeGaps(s, input.currentGrade);
    if (gaps.length > 0) {
      warnings.push({
        ruleId: "storyline_gap",
        severity: "medium",
        category: "storyline",
        title: "스토리라인 공백",
        message: `"${s.title}" 스토리라인에 ${gaps.join(", ")} 테마가 비어있습니다.`,
        suggestion: "학년별 테마를 설정하여 성장 서사를 완성해주세요.",
      });
    }
  }

  return warnings;
}

function checkStorylineGradeGaps(s: Storyline, currentGrade: number): string[] {
  const gaps: string[] = [];
  if (currentGrade >= 1 && !s.grade_1_theme) gaps.push("1학년");
  if (currentGrade >= 2 && !s.grade_2_theme) gaps.push("2학년");
  if (currentGrade >= 3 && !s.grade_3_theme) gaps.push("3학년");
  return gaps;
}

// ─── 최저 경고 ──────────────────────────────────

function checkMinScoreWarnings(input: WarningCheckInput): RecordWarning[] {
  const warnings: RecordWarning[] = [];
  const sims = input.strategyData?.minScoreSimulations ?? [];
  const targets = input.strategyData?.minScoreTargets ?? [];

  if (sims.length === 0 || targets.length === 0) return warnings;

  for (const sim of sims) {
    const target = targets.find((t) => t.id === sim.target_id);
    if (!target) continue;
    const uniName = target.university_name ?? "대학";

    // 최저 미충족
    if (sim.is_met === false) {
      warnings.push({
        ruleId: "min_score_critical",
        severity: "critical",
        category: "min_score",
        title: "최저 미충족 위험",
        message: `${uniName} 수능최저를 충족하지 못합니다.`,
        suggestion: "모의고사 등급을 확인하고 취약 과목을 집중 보강하세요.",
      });
    }

    // 병목 과목 (notes에 기록된 정보 활용)
    if (sim.bottleneck_subjects && Array.isArray(sim.bottleneck_subjects) && sim.bottleneck_subjects.length > 0) {
      warnings.push({
        ruleId: "min_score_bottleneck",
        severity: "high",
        category: "min_score",
        title: "최저 병목 과목",
        message: `${uniName}: ${(sim.bottleneck_subjects as string[]).join(", ")} 과목이 병목입니다.`,
        suggestion: "해당 과목 등급 1단계 향상이 최저 충족에 가장 효과적입니다.",
      });
    }
  }

  return warnings;
}

// ─── 성적 추이 경고 ──────────────────────────────

const MIN_CONSECUTIVE_DECLINE = 2;

/**
 * 전공교과 성적 하락 감지
 *
 * 목표 전공 계열의 추천 과목 중 2학기 연속 등급 하락인 과목을 찾는다.
 * scores, targetMajorField가 없으면 건너뜀.
 */
function checkMajorSubjectDecline(input: WarningCheckInput): RecordWarning | null {
  const { scores, targetMajorField, curriculumYear } = input;
  if (!scores || scores.length === 0 || !targetMajorField) return null;

  // 교육과정 연도에 따라 2015/2022 과목 목록 선택
  const courseSet = getMajorRecommendedCourses(targetMajorField, curriculumYear)
    ?? MAJOR_RECOMMENDED_COURSES[targetMajorField];
  if (!courseSet) return null;

  const majorSubjects = new Set([...courseSet.general, ...courseSet.career]);

  const majorScores = scores.filter(
    (s) => s.rankGrade != null && majorSubjects.has(s.subjectName),
  );

  // 과목별 그룹핑
  const bySubject = new Map<string, GradeEntry[]>();
  for (const s of majorScores) {
    const existing = bySubject.get(s.subjectName);
    if (existing) existing.push(s);
    else bySubject.set(s.subjectName, [s]);
  }

  const declining: string[] = [];

  for (const [subjectName, entries] of bySubject) {
    entries.sort((a, b) => a.grade * 10 + a.semester - (b.grade * 10 + b.semester));
    if (entries.length < MIN_CONSECUTIVE_DECLINE + 1) continue;

    let consecutiveDeclines = 0;
    let maxConsecutiveDeclines = 0;
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].rankGrade! > entries[i - 1].rankGrade!) {
        consecutiveDeclines++;
      } else {
        consecutiveDeclines = 0;
      }
      maxConsecutiveDeclines = Math.max(maxConsecutiveDeclines, consecutiveDeclines);
    }
    if (maxConsecutiveDeclines >= MIN_CONSECUTIVE_DECLINE) {
      declining.push(subjectName);
    }
  }

  if (declining.length === 0) return null;

  return {
    ruleId: "major_subject_decline",
    severity: declining.length >= 2 ? "critical" : "high",
    category: "record",
    title: "전공교과 성적 하락",
    message: `${declining.join(", ")} 과목이 ${MIN_CONSECUTIVE_DECLINE}학기 연속 하락 추세입니다.`,
    suggestion: "해당 전공교과의 등급 회복이 학종 평가에 중요합니다.",
  };
}

/**
 * 수능최저 충족 추이 하락 감지
 *
 * 동일 목표 대학에 대해 이전 시뮬 vs 최신 시뮬을 비교하여
 * 충족 대학 수가 감소했으면 경보.
 */
function checkMinScoreTrendDown(input: WarningCheckInput): RecordWarning | null {
  const sims = input.strategyData?.minScoreSimulations ?? [];
  if (sims.length < 2) return null;

  const sorted = [...sims].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  // target_id별 가장 최근 2건 비교
  const latestByTarget = new Map<string, { prev: boolean | null; latest: boolean | null }>();
  for (const sim of sorted) {
    const existing = latestByTarget.get(sim.target_id);
    if (!existing) {
      latestByTarget.set(sim.target_id, { prev: null, latest: sim.is_met });
    } else {
      existing.prev = existing.latest;
      existing.latest = sim.is_met;
    }
  }

  let prevMetCount = 0;
  let latestMetCount = 0;
  let hasTrend = false;

  for (const { prev, latest } of latestByTarget.values()) {
    if (prev == null || latest == null) continue;
    hasTrend = true;
    if (prev) prevMetCount++;
    if (latest) latestMetCount++;
  }

  if (!hasTrend || latestMetCount >= prevMetCount) return null;

  return {
    ruleId: "min_score_trend_down",
    severity: prevMetCount - latestMetCount >= 2 ? "critical" : "high",
    category: "min_score",
    title: "최저 충족 추이 하락",
    message: `수능최저 충족 대학이 ${prevMetCount}개 → ${latestMetCount}개로 감소했습니다.`,
    suggestion: "최근 모의고사 성적을 점검하고 취약 과목을 보강하세요.",
  };
}

// ─── 전략 경고 ──────────────────────────────────

function checkStrategyWarnings(input: WarningCheckInput): RecordWarning[] {
  const warnings: RecordWarning[] = [];

  // 3학년인데 지원 현황 없음
  if (input.currentGrade >= 3) {
    const applications = input.strategyData?.applications ?? [];
    if (applications.length === 0) {
      warnings.push({
        ruleId: "no_applications",
        severity: "high",
        category: "strategy",
        title: "지원 현황 미등록",
        message: "3학년이지만 수시/정시 지원 현황이 등록되지 않았습니다.",
        suggestion: "지원 전략 섹션에서 목표 대학을 등록해주세요.",
      });
    }
  }

  // 진단은 있는데 보완전략 없음
  if (input.diagnosisData?.consultantDiagnosis && input.diagnosisData.strategies.length === 0) {
    warnings.push({
      ruleId: "strategy_incomplete",
      severity: "medium",
      category: "strategy",
      title: "보완전략 미수립",
      message: "종합진단이 완료되었지만 보완전략이 아직 등록되지 않았습니다.",
      suggestion: "AI 전략 제안을 활용하여 보완전략을 수립해주세요.",
    });
  }

  return warnings;
}

// ─── 품질 경고 ──────────────────────────────────

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
function checkContentQuality(qualityScores: ContentQualityRow[]): RecordWarning[] {
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

// ─── 로드맵 경고 ──────────────────────────────

/**
 * 이전 학년 미완료 로드맵 경고
 *
 * 현재 학년이 2학년 이상일 때, 이전 학년(currentGrade - 1)의
 * planning/in_progress 상태 로드맵 항목이 남아있으면 경고를 발행한다.
 */
function checkUnfinishedRoadmap(roadmapItems: RoadmapItem[], currentGrade: number): RecordWarning[] {
  const prevGrade = currentGrade - 1;
  if (prevGrade < 1) return [];

  const unfinished = roadmapItems.filter(
    (r) => r.grade === prevGrade && (r.status === "planning" || r.status === "in_progress"),
  );

  if (unfinished.length === 0) return [];

  const preview = unfinished
    .slice(0, 3)
    .map((r) => r.plan_content)
    .join(", ");
  const suffix = unfinished.length > 3 ? ` 외 ${unfinished.length - 3}건` : "";

  return [
    {
      ruleId: "roadmap_unfinished_prev_grade",
      severity: "medium",
      category: "roadmap",
      title: `이전 학년(${prevGrade}학년) 미완료 로드맵 ${unfinished.length}건`,
      message: preview + suffix,
      suggestion: "미완료 항목을 검토하고 새 학년 로드맵에 반영하세요",
    },
  ];
}

// ─── 세특 품질 패턴 경고 (issues 코드 기반) ──────────────────

/**
 * ContentQualityRow.issues 배열에 포함된 패턴 코드(P1~F16)를 기반으로
 * 합격률 낮은 세특 패턴 경고를 발행한다.
 */
function checkContentQualityPatterns(qualityScores: ContentQualityRow[]): RecordWarning[] {
  const warnings: RecordWarning[] = [];

  // issues 코드 → 경고 매핑
  const PATTERN_MAP: Record<string, { ruleId: RecordWarning["ruleId"]; severity: RecordWarning["severity"]; title: string; suggestion: string }> = {
    P1_나열식: {
      ruleId: "setek_enumeration",
      severity: "medium",
      title: "세특 나열식 기술",
      suggestion: "활동을 나열하지 말고, 호기심→탐구→결론→성장의 흐름으로 연결하세요",
    },
    P2_추상적_복붙: {
      ruleId: "setek_abstract_generic",
      severity: "high",
      title: "세특 추상적/복붙 의심",
      suggestion: "모든 학생에게 쓸 수 있는 상투적 표현을 구체적 사례와 근거로 대체하세요",
    },
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
      ruleId: "content_quality_low",
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
      ruleId: "content_quality_low",
      severity: "medium",
      title: "진로 키워드 과잉 도배",
      suggestion: "모든 교과에 동일 진로 키워드를 삽입하면 교과 고유 역량이 불명확해집니다. 진로 연결은 2~3과목으로 제한하세요",
    },
  };

  // 과학적 정합성 패턴 (F1~F6)
  const SCIENTIFIC_PATTERNS = ["F1_별개활동포장", "F2_인과단절", "F3_출처불일치", "F4_전제불일치", "F5_비교군오류", "F6_자명한결론"];

  const seenRules = new Set<string>();
  const scientificIssues: string[] = [];

  // prefix 기반 매칭 — LLM이 "P1_나열식", "P1 나열식", "P1: 나열식" 등 변형 출력 대응
  const PATTERN_PREFIXES = Object.keys(PATTERN_MAP).map((key) => {
    const prefix = key.split("_")[0]; // "P1", "P2", "F10" 등
    return { prefix, key };
  });

  function matchPattern(issue: string): typeof PATTERN_MAP[string] | undefined {
    // 1. 정확 매칭 시도
    if (PATTERN_MAP[issue]) return PATTERN_MAP[issue];
    // 2. prefix 매칭 (issue가 "P1"로 시작하면 P1_나열식에 매핑)
    const normalized = issue.replace(/[\s:_]/g, "");
    for (const { prefix, key } of PATTERN_PREFIXES) {
      if (normalized.startsWith(prefix)) return PATTERN_MAP[key];
    }
    return undefined;
  }

  for (const q of qualityScores) {
    for (const issue of q.issues) {
      // 패턴 코드 매칭 (prefix 기반 유연 매칭)
      const mapping = matchPattern(issue);
      if (mapping && !seenRules.has(mapping.ruleId)) {
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
