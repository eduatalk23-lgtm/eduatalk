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
}

const MIN_READINGS_PER_GRADE = 2;
const COURSE_ADEQUACY_THRESHOLD = 50;

/** 전체 경고 계산 */
export function computeWarnings(input: WarningCheckInput): RecordWarning[] {
  const warnings: RecordWarning[] = [];

  const push = (w: RecordWarning | null) => { if (w) warnings.push(w); };

  // ─── 기록 관련 ───
  push(checkMissingCareerActivity(input));
  push(checkChangcheEmpty(input));
  push(checkHaengteukDraft(input));
  push(checkReadingInsufficient(input));

  // ─── 이수 관련 ───
  push(checkCourseInadequacy(input));

  // ─── 스토리라인 관련 ───
  for (const w of checkStorylineWarnings(input)) push(w);

  // ─── 최저 관련 ───
  for (const w of checkMinScoreWarnings(input)) push(w);

  return warnings;
}

// ─── 기록 경고 ──────────────────────────────────

function checkMissingCareerActivity(input: WarningCheckInput): RecordWarning | null {
  for (const [grade, data] of input.recordsByGrade) {
    if (grade > input.currentGrade) continue;
    const hasCareer = data.changche.some(
      (c) => c.activity_type === "career" && c.content && c.content.trim().length > 10,
    );
    if (!hasCareer) {
      return {
        ruleId: "missing_career_activity",
        severity: grade < input.currentGrade ? "high" : "medium",
        category: "record",
        title: "진로활동 미기록",
        message: `${grade}학년 진로활동 기록이 없습니다.`,
        suggestion: "진로 관련 창체활동을 기록해주세요.",
      };
    }
  }
  return null;
}

function checkChangcheEmpty(input: WarningCheckInput): RecordWarning | null {
  for (const [grade, data] of input.recordsByGrade) {
    if (grade > input.currentGrade) continue;
    const emptyTypes = ["autonomy", "club", "career"].filter((type) => {
      const record = data.changche.find((c) => c.activity_type === type);
      return !record || !record.content || record.content.trim().length < 10;
    });
    if (emptyTypes.length > 0) {
      const labels: Record<string, string> = { autonomy: "자율", club: "동아리", career: "진로" };
      return {
        ruleId: "changche_empty",
        severity: grade < input.currentGrade ? "high" : "medium",
        category: "record",
        title: "창체 미작성",
        message: `${grade}학년 ${emptyTypes.map((t) => labels[t] ?? t).join(", ")} 영역이 비어있습니다.`,
        suggestion: "해당 학년의 창체 활동을 기록해주세요.",
      };
    }
  }
  return null;
}

function checkHaengteukDraft(input: WarningCheckInput): RecordWarning | null {
  for (const [grade, data] of input.recordsByGrade) {
    if (grade >= input.currentGrade) continue; // 이전 학년만 체크
    if (!data.haengteuk || !data.haengteuk.content || data.haengteuk.content.trim().length < 20) {
      return {
        ruleId: "haengteuk_draft",
        severity: "high",
        category: "record",
        title: "행특 미확정",
        message: `${grade}학년 행동특성 및 종합의견이 작성되지 않았습니다.`,
        suggestion: "이전 학년 행특을 완성해주세요.",
      };
    }
  }
  return null;
}

function checkReadingInsufficient(input: WarningCheckInput): RecordWarning | null {
  for (const [grade, data] of input.recordsByGrade) {
    if (grade > input.currentGrade) continue;
    if (data.readings.length < MIN_READINGS_PER_GRADE) {
      return {
        ruleId: "reading_insufficient",
        severity: "medium",
        category: "record",
        title: "독서 부족",
        message: `${grade}학년 독서활동이 ${data.readings.length}건입니다 (권장: ${MIN_READINGS_PER_GRADE}권 이상).`,
        suggestion: "전공 관련 독서를 추가로 기록해주세요.",
      };
    }
  }
  return null;
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
