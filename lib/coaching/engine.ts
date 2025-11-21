import type { WeeklyMetricsData } from "./getWeeklyMetrics";

export type WeeklyCoaching = {
  highlights: string[]; // 이번주 잘한 점
  warnings: string[]; // 주의할 점
  nextWeekGuide: string[]; // 다음주 가이드
  summary: string; // 1줄 요약
};

/**
 * Rule-based Coaching Engine
 * 주간 메트릭을 기반으로 코칭 메시지 생성
 */
export function coachingEngine(metrics: WeeklyMetricsData): WeeklyCoaching {
  const highlights: string[] = [];
  const warnings: string[] = [];
  const nextWeekGuide: string[] = [];

  // ============================================
  // 1. HIGHLIGHTS (이번주 잘한 점)
  // ============================================

  // 학습시간 지난주 대비 +20% 이상
  if (metrics.weeklyStudyTrend >= 20) {
    highlights.push("학습량이 크게 늘었어요! 지난주 대비 " + Math.abs(metrics.weeklyStudyTrend) + "% 증가했습니다.");
  } else if (metrics.weeklyStudyTrend > 0) {
    highlights.push("학습량이 지난주보다 늘었어요! " + Math.abs(metrics.weeklyStudyTrend) + "% 증가했습니다.");
  }

  // 플랜 실행률 > 70%
  if (metrics.weeklyPlanCompletion >= 70) {
    highlights.push("계획 실행력이 매우 좋습니다. 실행률 " + metrics.weeklyPlanCompletion + "%를 달성했어요.");
  } else if (metrics.weeklyPlanCompletion >= 60) {
    highlights.push("계획 실행력이 양호합니다. 실행률 " + metrics.weeklyPlanCompletion + "%를 달성했어요.");
  }

  // 목표 달성 1개 이상 (진행률 100%)
  if (metrics.weeklyGoalsProgress >= 100) {
    highlights.push("목표를 완주했어요! 훌륭한 성과입니다.");
  } else if (metrics.weeklyGoalsProgress >= 80) {
    highlights.push("목표 달성률이 높아요! " + metrics.weeklyGoalsProgress + "% 진행 중입니다.");
  }

  // 연속성 점수 높음
  if (metrics.consistencyScore >= 80) {
    highlights.push("매일 꾸준히 학습하는 습관이 잘 형성되어 있어요!");
  } else if (metrics.consistencyScore >= 60) {
    highlights.push("학습 연속성이 좋아요!");
  }

  // 집중 점수 높음
  if (metrics.focusScore >= 80) {
    highlights.push("집중력이 뛰어나요! 긴 시간 동안 집중해서 학습하고 있어요.");
  } else if (metrics.focusScore >= 60) {
    highlights.push("집중해서 학습하는 모습이 보여요!");
  }

  // ============================================
  // 2. WARNINGS (주의할 점)
  // ============================================

  // 실행률 < 40%
  if (metrics.weeklyPlanCompletion < 40 && metrics.weeklyPlanCompletion > 0) {
    warnings.push("이번주는 계획 대비 실행이 낮았어요. 실행률 " + metrics.weeklyPlanCompletion + "%입니다.");
  }

  // 학습시간 급감
  if (metrics.weeklyStudyTrend < -20) {
    warnings.push("학습시간이 지난주 대비 " + Math.abs(metrics.weeklyStudyTrend) + "% 감소했어요.");
  }

  // 취약 과목 학습시간 부족
  if (metrics.weakSubjects.length > 0) {
    warnings.push("취약 과목 학습이 부족했어요. (" + metrics.weakSubjects.join(", ") + ")");
  }

  // Risk Level이 high
  if (metrics.riskLevel === "high") {
    warnings.push("집중 관리가 필요한 상태예요. 학습 패턴을 점검해보세요.");
  } else if (metrics.riskLevel === "medium") {
    warnings.push("학습 상태를 주의 깊게 관찰해야 해요.");
  }

  // 연속성 점수 낮음
  if (metrics.consistencyScore < 40) {
    warnings.push("학습 연속성이 낮아요. 매일 조금씩이라도 학습하는 습관을 만들어보세요.");
  }

  // 집중 점수 낮음
  if (metrics.focusScore < 40) {
    warnings.push("집중 시간이 짧아요. 더 긴 시간 동안 집중해서 학습해보세요.");
  }

  // 목표 진행률 저조
  if (metrics.weeklyGoalsProgress < 30 && metrics.weeklyGoalsProgress > 0) {
    warnings.push("목표 진행률이 낮아요. 현재 " + metrics.weeklyGoalsProgress + "% 진행 중입니다.");
  }

  // ============================================
  // 3. NEXT WEEK GUIDE (다음주 가이드)
  // ============================================

  // 목표 D-7 이하 존재 시
  // (이 정보는 metrics에 직접 포함되지 않으므로, 추천 엔진 결과를 활용)
  const urgentGoalRecommendations = metrics.recommendations.filter((rec) =>
    rec.includes("목표") || rec.includes("마감") || rec.includes("D-")
  );
  if (urgentGoalRecommendations.length > 0) {
    nextWeekGuide.push("다음주는 해당 목표 우선 집중이 필요해요: " + urgentGoalRecommendations[0]);
  }

  // 플랜 실행률 낮음 → 플랜 수 줄이기 추천
  if (metrics.weeklyPlanCompletion < 50) {
    nextWeekGuide.push("플랜 수를 줄이고 실행 가능성을 높이는 주간 전략을 추천해요.");
  }

  // 추천 엔진에 '학습 비중 조정' 항목 있으면 반영
  const balanceRecommendations = metrics.recommendations.filter(
    (rec) => rec.includes("비중") || rec.includes("균형") || rec.includes("조정")
  );
  if (balanceRecommendations.length > 0) {
    nextWeekGuide.push(balanceRecommendations[0]);
  }

  // 취약 과목 학습 강화
  if (metrics.weakSubjects.length > 0) {
    nextWeekGuide.push(
      "취약 과목(" + metrics.weakSubjects.join(", ") + ") 학습 시간을 늘려보세요."
    );
  }

  // 학습시간 부족 시
  if (metrics.weeklyStudyMinutes < 5 * 60) {
    // 5시간 미만
    nextWeekGuide.push("다음주는 학습 시간을 늘려보세요. 하루 최소 1시간 이상 학습을 목표로 해보세요.");
  }

  // 연속성 개선
  if (metrics.consistencyScore < 60) {
    nextWeekGuide.push("매일 조금씩이라도 학습하는 습관을 만들어보세요. 연속 학습일을 늘려가요.");
  }

  // 집중력 개선
  if (metrics.focusScore < 60) {
    nextWeekGuide.push("집중 시간을 늘려보세요. 30분 이상 연속으로 학습하는 세션을 늘려가요.");
  }

  // 기본 가이드 (위 조건에 해당하지 않는 경우)
  if (nextWeekGuide.length === 0) {
    nextWeekGuide.push("이번주처럼 꾸준히 학습을 이어가세요!");
  }

  // ============================================
  // 4. SUMMARY (1줄 요약)
  // ============================================

  const summary = generateSummary(metrics);

  return {
    highlights: highlights.length > 0 ? highlights : ["이번주도 수고하셨어요!"],
    warnings: warnings.length > 0 ? warnings : [],
    nextWeekGuide: nextWeekGuide.length > 0 ? nextWeekGuide : ["다음주도 화이팅!"],
    summary,
  };
}

/**
 * Summary 생성 (1줄 요약)
 * 실행률 + 목표 + 집중 점수 기반
 */
function generateSummary(metrics: WeeklyMetricsData): string {
  // 실행률 기반 평가
  let executionRating = "";
  if (metrics.weeklyPlanCompletion >= 80) {
    executionRating = "매우 우수한";
  } else if (metrics.weeklyPlanCompletion >= 60) {
    executionRating = "양호한";
  } else if (metrics.weeklyPlanCompletion >= 40) {
    executionRating = "보통의";
  } else {
    executionRating = "개선이 필요한";
  }

  // 목표 달성률 기반 평가
  let goalRating = "";
  if (metrics.weeklyGoalsProgress >= 80) {
    goalRating = "목표 달성률이 높고";
  } else if (metrics.weeklyGoalsProgress >= 50) {
    goalRating = "목표 진행이 순조롭고";
  } else if (metrics.weeklyGoalsProgress > 0) {
    goalRating = "목표 진행이 필요하고";
  } else {
    goalRating = "목표 설정이 필요하고";
  }

  // 집중 점수 기반 평가
  let focusRating = "";
  if (metrics.focusScore >= 70) {
    focusRating = "집중력이 뛰어난";
  } else if (metrics.focusScore >= 50) {
    focusRating = "집중력이 양호한";
  } else {
    focusRating = "집중력 개선이 필요한";
  }

  // Risk Level 기반 평가
  let riskNote = "";
  if (metrics.riskLevel === "high") {
    riskNote = " 주의가 필요해요.";
  } else if (metrics.riskLevel === "medium") {
    riskNote = " 관심이 필요해요.";
  } else {
    riskNote = " 안정적인 상태예요.";
  }

  // 최종 요약 생성
  return `${executionRating} 실행력과 ${goalRating} ${focusRating} 학습 상태입니다.${riskNote}`;
}

