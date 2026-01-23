/**
 * 향상된 AI 플랜 검증기
 *
 * 기본 검증(planValidator.ts) 외에 추가적인 품질 검증을 수행합니다:
 * - 콘텐츠 범위 검증 (총 페이지/강의 수 초과 여부)
 * - 과목 분포 균형 검증
 * - 난이도 진행 검증
 * - 학습 부하 최적화 검증
 * - 콘텐츠 중복 감지
 * - 품질 점수 계산
 *
 * @module lib/domains/plan/llm/validators/enhancedPlanValidator
 */

import type { GeneratedPlanItem, ContentInfo } from "../types";

// ============================================
// 검증 결과 타입
// ============================================

export interface QualityIssue {
  type:
    | "range_overflow"
    | "subject_imbalance"
    | "difficulty_jump"
    | "load_warning"
    | "content_duplicate"
    | "gap_too_long"
    | "range_gap"
    | "range_overlap";
  severity: "error" | "warning" | "info";
  planIndex?: number;
  date?: string;
  message: string;
  suggestion?: string;
}

export interface SubjectDistribution {
  subject: string;
  subjectCategory?: string;
  totalMinutes: number;
  planCount: number;
  percentage: number;
}

export interface QualityMetrics {
  /** 전체 품질 점수 (0-100) */
  overallScore: number;
  /** 범위 검증 점수 (0-100) */
  rangeScore: number;
  /** 과목 균형 점수 (0-100) */
  balanceScore: number;
  /** 부하 적정성 점수 (0-100) */
  loadScore: number;
  /** 연속성 점수 (0-100) */
  continuityScore: number;
}

export interface EnhancedValidationResult {
  valid: boolean;
  issues: QualityIssue[];
  metrics: QualityMetrics;
  distribution: SubjectDistribution[];
  summary: {
    totalPlans: number;
    totalMinutes: number;
    uniqueSubjects: number;
    uniqueContents: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}

// ============================================
// 콘텐츠 정보 타입 (검증용)
// ============================================

export interface ContentMetadata {
  id: string;
  contentType: "book" | "lecture" | "custom";
  totalPages?: number;
  totalLectures?: number;
  difficulty?: "easy" | "medium" | "hard";
}

// ============================================
// 검증 옵션
// ============================================

export interface EnhancedValidationOptions {
  plans: GeneratedPlanItem[];
  /** 콘텐츠 메타데이터 (범위 검증용) */
  contents?: ContentMetadata[];
  /** 일일 권장 학습 시간 (분) */
  dailyStudyMinutes?: number;
  /** 과목 균형 목표 (기본: true) */
  checkBalance?: boolean;
  /** 연속 동일 과목 최대 일수 (기본: 3) */
  maxConsecutiveSameSubject?: number;
  /** 세션 간 최대 공백 일수 (기본: 7) */
  maxGapDays?: number;
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 날짜 차이 계산 (일 단위)
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diff = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * 날짜 배열 정렬
 */
function sortByDate(plans: GeneratedPlanItem[]): GeneratedPlanItem[] {
  return [...plans].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 표준편차 계산
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

// ============================================
// 개별 검증 함수
// ============================================

/**
 * 콘텐츠 범위 검증
 *
 * 플랜의 rangeStart/rangeEnd가 콘텐츠의 총 페이지/강의 수를 초과하지 않는지 확인합니다.
 */
export function validateContentRanges(
  plans: GeneratedPlanItem[],
  contents: ContentMetadata[]
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const contentMap = new Map(contents.map((c) => [c.id, c]));

  plans.forEach((plan, index) => {
    const content = contentMap.get(plan.contentId);
    if (!content) return;

    const maxRange =
      content.contentType === "book"
        ? content.totalPages
        : content.totalLectures;

    if (maxRange && plan.rangeEnd && plan.rangeEnd > maxRange) {
      issues.push({
        type: "range_overflow",
        severity: "error",
        planIndex: index,
        date: plan.date,
        message: `${plan.contentTitle}의 범위(${plan.rangeEnd})가 최대값(${maxRange})을 초과합니다.`,
        suggestion: `범위를 ${maxRange} 이하로 조정하세요.`,
      });
    }

    if (plan.rangeStart && plan.rangeEnd && plan.rangeStart > plan.rangeEnd) {
      issues.push({
        type: "range_overflow",
        severity: "error",
        planIndex: index,
        date: plan.date,
        message: `${plan.contentTitle}의 시작 범위(${plan.rangeStart})가 종료 범위(${plan.rangeEnd})보다 큽니다.`,
      });
    }
  });

  return issues;
}

/**
 * 콘텐츠별 범위 연속성 검증
 *
 * 동일 콘텐츠의 범위가 겹치거나 빈틈이 있는지 확인합니다.
 */
export function validateRangeContinuity(
  plans: GeneratedPlanItem[]
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // 콘텐츠별로 플랜 그룹화
  const contentPlans = new Map<string, GeneratedPlanItem[]>();
  plans.forEach((plan) => {
    const existing = contentPlans.get(plan.contentId) || [];
    existing.push(plan);
    contentPlans.set(plan.contentId, existing);
  });

  contentPlans.forEach((contentPlansGroup, contentId) => {
    // 날짜순 정렬
    const sorted = sortByDate(contentPlansGroup);

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      if (!prev.rangeEnd || !curr.rangeStart) continue;

      // 범위 겹침 검사
      if (curr.rangeStart < prev.rangeEnd) {
        issues.push({
          type: "range_overlap",
          severity: "warning",
          date: curr.date,
          message: `${curr.contentTitle}의 범위가 이전 플랜과 겹칩니다 (${prev.rangeEnd} > ${curr.rangeStart}).`,
          suggestion: "범위를 조정하거나 복습으로 표시하세요.",
        });
      }

      // 범위 빈틈 검사 (5 이상 차이)
      if (curr.rangeStart - prev.rangeEnd > 5) {
        issues.push({
          type: "range_gap",
          severity: "info",
          date: curr.date,
          message: `${curr.contentTitle}의 범위에 빈틈이 있습니다 (${prev.rangeEnd} → ${curr.rangeStart}).`,
          suggestion: "누락된 범위가 있는지 확인하세요.",
        });
      }
    }
  });

  return issues;
}

/**
 * 과목 분포 균형 검증
 *
 * 과목별 학습 시간 분포가 균형적인지 확인합니다.
 */
export function validateSubjectBalance(
  plans: GeneratedPlanItem[]
): { issues: QualityIssue[]; distribution: SubjectDistribution[] } {
  const issues: QualityIssue[] = [];

  // 과목별 통계 계산
  const subjectStats = new Map<
    string,
    { minutes: number; count: number; category?: string }
  >();
  let totalMinutes = 0;

  plans.forEach((plan) => {
    const key = plan.subject;
    const existing = subjectStats.get(key) || {
      minutes: 0,
      count: 0,
      category: plan.subjectCategory,
    };
    existing.minutes += plan.estimatedMinutes;
    existing.count += 1;
    subjectStats.set(key, existing);
    totalMinutes += plan.estimatedMinutes;
  });

  // 분포 배열 생성
  const distribution: SubjectDistribution[] = Array.from(
    subjectStats.entries()
  ).map(([subject, stats]) => ({
    subject,
    subjectCategory: stats.category,
    totalMinutes: stats.minutes,
    planCount: stats.count,
    percentage: totalMinutes > 0 ? (stats.minutes / totalMinutes) * 100 : 0,
  }));

  // 균형 검사 (한 과목이 60% 이상이면 경고)
  const maxPercentage = Math.max(...distribution.map((d) => d.percentage));
  if (maxPercentage > 60 && distribution.length > 1) {
    const dominant = distribution.find((d) => d.percentage === maxPercentage);
    issues.push({
      type: "subject_imbalance",
      severity: "warning",
      message: `${dominant?.subject} 과목이 전체 학습의 ${maxPercentage.toFixed(1)}%를 차지합니다.`,
      suggestion: "다른 과목과의 균형을 고려하세요.",
    });
  }

  // 과목이 1개뿐인데 여러 콘텐츠가 있으면 정보 제공
  if (distribution.length === 1 && plans.length > 5) {
    issues.push({
      type: "subject_imbalance",
      severity: "info",
      message: "단일 과목만 포함된 플랜입니다.",
      suggestion: "의도된 집중 학습인지 확인하세요.",
    });
  }

  return { issues, distribution };
}

/**
 * 연속 동일 과목 검증
 *
 * 동일 과목이 연속으로 배치된 일수를 확인합니다.
 */
export function validateConsecutiveSubjects(
  plans: GeneratedPlanItem[],
  maxConsecutive: number = 3
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // 날짜별 과목 추출
  const dateSubjects = new Map<string, Set<string>>();
  plans.forEach((plan) => {
    const subjects = dateSubjects.get(plan.date) || new Set();
    subjects.add(plan.subject);
    dateSubjects.set(plan.date, subjects);
  });

  // 날짜 정렬
  const sortedDates = Array.from(dateSubjects.keys()).sort();

  // 과목별 연속 일수 추적
  const subjectStreaks = new Map<string, { count: number; startDate: string }>();

  sortedDates.forEach((date, idx) => {
    const subjects = dateSubjects.get(date)!;

    // 이전 날짜와 연속인지 확인
    const prevDate = idx > 0 ? sortedDates[idx - 1] : null;
    const isConsecutive =
      prevDate && daysBetween(prevDate, date) === 1;

    subjects.forEach((subject) => {
      if (!isConsecutive) {
        // 연속이 끊어짐 - 리셋
        subjectStreaks.set(subject, { count: 1, startDate: date });
      } else {
        const streak = subjectStreaks.get(subject);
        if (streak) {
          streak.count += 1;
          if (streak.count > maxConsecutive) {
            // 이미 경고를 발생했으면 추가 경고 안함
            const existingIssue = issues.find(
              (i) =>
                i.type === "load_warning" &&
                i.message.includes(subject) &&
                i.message.includes("연속")
            );
            if (!existingIssue) {
              issues.push({
                type: "load_warning",
                severity: "warning",
                date,
                message: `${subject} 과목이 ${streak.count}일 연속 배치되었습니다.`,
                suggestion: `${maxConsecutive}일 이하로 분산 배치를 권장합니다.`,
              });
            }
          }
        } else {
          subjectStreaks.set(subject, { count: 1, startDate: date });
        }
      }
    });

    // 오늘 포함되지 않은 과목은 연속 리셋
    subjectStreaks.forEach((streak, subject) => {
      if (!subjects.has(subject) && isConsecutive) {
        subjectStreaks.set(subject, { count: 0, startDate: "" });
      }
    });
  });

  return issues;
}

/**
 * 학습 공백 검증
 *
 * 플랜 간 공백이 너무 긴 경우를 감지합니다.
 */
export function validateLearningGaps(
  plans: GeneratedPlanItem[],
  maxGapDays: number = 7
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (plans.length < 2) return issues;

  const sortedPlans = sortByDate(plans);
  const uniqueDates = [...new Set(sortedPlans.map((p) => p.date))].sort();

  for (let i = 1; i < uniqueDates.length; i++) {
    const gap = daysBetween(uniqueDates[i - 1], uniqueDates[i]);
    if (gap > maxGapDays) {
      issues.push({
        type: "gap_too_long",
        severity: "warning",
        date: uniqueDates[i],
        message: `${uniqueDates[i - 1]}부터 ${uniqueDates[i]}까지 ${gap}일 공백이 있습니다.`,
        suggestion: "의도적인 휴식 기간인지 확인하세요.",
      });
    }
  }

  return issues;
}

/**
 * 콘텐츠 중복 검증
 *
 * 동일 날짜에 같은 콘텐츠가 중복 배치되었는지 확인합니다.
 */
export function validateContentDuplicates(
  plans: GeneratedPlanItem[]
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // 날짜+콘텐츠 조합 추적
  const seen = new Map<string, number[]>();

  plans.forEach((plan, index) => {
    if (plan.isReview) return; // 복습은 중복 허용
    if (plan.isPartialContent) return; // 분할된 콘텐츠는 중복 아님

    const key = `${plan.date}:${plan.contentId}`;
    const existing = seen.get(key) || [];
    existing.push(index);
    seen.set(key, existing);
  });

  seen.forEach((indices, key) => {
    if (indices.length > 1) {
      const [date] = key.split(":");
      const plan = plans[indices[0]];
      issues.push({
        type: "content_duplicate",
        severity: "warning",
        date,
        message: `${plan.contentTitle}이(가) ${date}에 ${indices.length}번 배치되었습니다.`,
        suggestion: "의도적인 반복 학습이 아니면 하나로 통합하세요.",
      });
    }
  });

  return issues;
}

/**
 * 일일 학습 부하 검증
 *
 * 일별 학습 시간이 적정 범위인지 확인합니다.
 */
export function validateDailyLoad(
  plans: GeneratedPlanItem[],
  targetMinutes: number
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // 일별 총 시간 계산
  const dailyTotals = new Map<string, number>();
  plans.forEach((plan) => {
    const current = dailyTotals.get(plan.date) || 0;
    dailyTotals.set(plan.date, current + plan.estimatedMinutes);
  });

  dailyTotals.forEach((total, date) => {
    // 목표의 30% 미만
    if (total < targetMinutes * 0.3) {
      issues.push({
        type: "load_warning",
        severity: "info",
        date,
        message: `${date}의 학습 시간(${total}분)이 목표(${targetMinutes}분)의 30% 미만입니다.`,
        suggestion: "추가 학습을 고려하거나 다른 날로 분산하세요.",
      });
    }
    // 목표의 150% 초과 (기본 검증에서는 120%만 체크)
    else if (total > targetMinutes * 1.5) {
      issues.push({
        type: "load_warning",
        severity: "warning",
        date,
        message: `${date}의 학습 시간(${total}분)이 목표(${targetMinutes}분)의 150%를 초과합니다.`,
        suggestion: "일부 플랜을 다른 날로 이동하세요.",
      });
    }
  });

  return issues;
}

// ============================================
// 품질 점수 계산
// ============================================

/**
 * 품질 메트릭 계산
 */
function calculateQualityMetrics(
  plans: GeneratedPlanItem[],
  issues: QualityIssue[],
  distribution: SubjectDistribution[],
  options: EnhancedValidationOptions
): QualityMetrics {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  // 범위 점수: 에러 하나당 -20점
  const rangeErrors = issues.filter((i) => i.type === "range_overflow").length;
  const rangeScore = Math.max(0, 100 - rangeErrors * 20);

  // 균형 점수: 표준편차 기반
  const percentages = distribution.map((d) => d.percentage);
  const stdDev = calculateStdDev(percentages);
  // 표준편차가 낮을수록 균형적 (0이면 100점, 30 이상이면 0점)
  const balanceScore = Math.max(0, Math.min(100, 100 - stdDev * 3.3));

  // 부하 점수: 경고 하나당 -10점
  const loadWarnings = issues.filter((i) => i.type === "load_warning").length;
  const loadScore = Math.max(0, 100 - loadWarnings * 10);

  // 연속성 점수: 공백/중복 경고 하나당 -15점
  const continuityIssues = issues.filter(
    (i) => i.type === "gap_too_long" || i.type === "content_duplicate"
  ).length;
  const continuityScore = Math.max(0, 100 - continuityIssues * 15);

  // 전체 점수: 가중 평균 (에러는 큰 감점)
  const baseScore =
    rangeScore * 0.3 +
    balanceScore * 0.2 +
    loadScore * 0.25 +
    continuityScore * 0.25;

  const overallScore = Math.max(
    0,
    baseScore - errorCount * 15 - warningCount * 5
  );

  return {
    overallScore: Math.round(overallScore),
    rangeScore: Math.round(rangeScore),
    balanceScore: Math.round(balanceScore),
    loadScore: Math.round(loadScore),
    continuityScore: Math.round(continuityScore),
  };
}

// ============================================
// 통합 검증 함수
// ============================================

/**
 * 향상된 플랜 검증 실행
 *
 * 기본 검증 외에 추가적인 품질 검증을 수행하고 점수를 계산합니다.
 */
export function validatePlansEnhanced(
  options: EnhancedValidationOptions
): EnhancedValidationResult {
  const {
    plans,
    contents = [],
    dailyStudyMinutes = 180,
    checkBalance = true,
    maxConsecutiveSameSubject = 3,
    maxGapDays = 7,
  } = options;

  const allIssues: QualityIssue[] = [];

  // 1. 콘텐츠 범위 검증
  if (contents.length > 0) {
    allIssues.push(...validateContentRanges(plans, contents));
  }

  // 2. 범위 연속성 검증
  allIssues.push(...validateRangeContinuity(plans));

  // 3. 과목 분포 검증
  let distribution: SubjectDistribution[] = [];
  if (checkBalance) {
    const balanceResult = validateSubjectBalance(plans);
    allIssues.push(...balanceResult.issues);
    distribution = balanceResult.distribution;
  } else {
    // 분포만 계산 (검증 없이)
    const { distribution: dist } = validateSubjectBalance(plans);
    distribution = dist;
  }

  // 4. 연속 동일 과목 검증
  allIssues.push(
    ...validateConsecutiveSubjects(plans, maxConsecutiveSameSubject)
  );

  // 5. 학습 공백 검증
  allIssues.push(...validateLearningGaps(plans, maxGapDays));

  // 6. 콘텐츠 중복 검증
  allIssues.push(...validateContentDuplicates(plans));

  // 7. 일일 부하 검증
  allIssues.push(...validateDailyLoad(plans, dailyStudyMinutes));

  // 품질 메트릭 계산
  const metrics = calculateQualityMetrics(plans, allIssues, distribution, options);

  // 요약 통계
  const uniqueSubjects = new Set(plans.map((p) => p.subject)).size;
  const uniqueContents = new Set(plans.map((p) => p.contentId)).size;
  const totalMinutes = plans.reduce((sum, p) => sum + p.estimatedMinutes, 0);
  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const infoCount = allIssues.filter((i) => i.severity === "info").length;

  return {
    valid: errorCount === 0,
    issues: allIssues,
    metrics,
    distribution,
    summary: {
      totalPlans: plans.length,
      totalMinutes,
      uniqueSubjects,
      uniqueContents,
      errorCount,
      warningCount,
      infoCount,
    },
  };
}

// ============================================
// 품질 등급 헬퍼
// ============================================

export type QualityGrade = "A" | "B" | "C" | "D" | "F";

/**
 * 점수를 등급으로 변환
 */
export function getQualityGrade(score: number): QualityGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * 품질 등급별 설명
 */
export function getGradeDescription(grade: QualityGrade): string {
  const descriptions: Record<QualityGrade, string> = {
    A: "우수한 품질의 학습 플랜입니다.",
    B: "양호한 품질의 학습 플랜입니다. 일부 개선 사항을 검토해 주세요.",
    C: "보통 수준의 학습 플랜입니다. 권장 사항을 확인해 주세요.",
    D: "개선이 필요한 학습 플랜입니다. 경고 사항을 검토해 주세요.",
    F: "심각한 문제가 있는 학습 플랜입니다. 에러를 수정해 주세요.",
  };
  return descriptions[grade];
}
