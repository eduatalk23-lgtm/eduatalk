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
} from "../types";
import { MAJOR_RECOMMENDED_COURSES } from "../constants";

/** 학기별 성적 (경보 엔진용 경량 타입) */
export interface GradeEntry {
  subjectName: string;
  grade: number; // 학년
  semester: number;
  rankGrade: number | null; // 등급 (1~9)
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
  const { scores, targetMajorField } = input;
  if (!scores || scores.length === 0 || !targetMajorField) return null;

  const courseSet = MAJOR_RECOMMENDED_COURSES[targetMajorField];
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
