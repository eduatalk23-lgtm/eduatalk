// ============================================
// 이수/스토리라인 관련 경고 체커 (Phase 6.5)
// ============================================
// checkCourseInadequacy, checkStorylineWarnings, checkStorylineGradeGaps

import type { RecordWarning } from "./types";
import type { WarningCheckInput } from "./engine";
import type { Storyline } from "../types";
import { WARNING_THRESHOLDS } from "../evaluation-criteria/defaults";

const COURSE_ADEQUACY_THRESHOLD = WARNING_THRESHOLDS.courseAdequacyThreshold;

export function checkCourseInadequacy(input: WarningCheckInput): RecordWarning | null {
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

export function checkStorylineWarnings(input: WarningCheckInput): RecordWarning[] {
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

export function checkStorylineGradeGaps(s: Storyline, currentGrade: number): string[] {
  const gaps: string[] = [];
  if (currentGrade >= 1 && !s.grade_1_theme) gaps.push("1학년");
  if (currentGrade >= 2 && !s.grade_2_theme) gaps.push("2학년");
  if (currentGrade >= 3 && !s.grade_3_theme) gaps.push("3학년");
  return gaps;
}
