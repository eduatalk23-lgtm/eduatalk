// ============================================
// 성적 추이 / 전략 관련 경고 체커 (Phase 6.5)
// ============================================
// checkMajorSubjectDecline, checkMinScoreTrendDown, checkMinScoreWarnings,
// checkStrategyWarnings, checkUnfinishedRoadmap

import type { RecordWarning } from "./types";
import type { WarningCheckInput, GradeEntry } from "./engine";
import type { RoadmapItem } from "../types";
import { MAJOR_RECOMMENDED_COURSES, getMajorRecommendedCourses } from "../constants";

const MIN_CONSECUTIVE_DECLINE = 2;

/**
 * 전공교과 성적 하락 감지
 *
 * 목표 전공 계열의 추천 과목 중 2학기 연속 등급 하락인 과목을 찾는다.
 * scores, targetMajorField가 없으면 건너뜀.
 */
export function checkMajorSubjectDecline(input: WarningCheckInput): RecordWarning | null {
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
export function checkMinScoreTrendDown(input: WarningCheckInput): RecordWarning | null {
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

export function checkMinScoreWarnings(input: WarningCheckInput): RecordWarning[] {
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

export function checkStrategyWarnings(input: WarningCheckInput): RecordWarning[] {
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

/**
 * 이전 학년 미완료 로드맵 경고
 *
 * 현재 학년이 2학년 이상일 때, 이전 학년(currentGrade - 1)의
 * planning/in_progress 상태 로드맵 항목이 남아있으면 경고를 발행한다.
 */
export function checkUnfinishedRoadmap(roadmapItems: RoadmapItem[], currentGrade: number): RecordWarning[] {
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
