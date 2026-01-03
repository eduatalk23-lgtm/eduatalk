/**
 * AIFramework → SchedulerOptions 변환기
 *
 * AI가 생성한 전략적 프레임워크를 코드 기반 스케줄러가 사용할 수 있는
 * SchedulerOptions 형식으로 변환합니다.
 *
 * @module lib/domains/plan/llm/converters/frameworkToSchedulerOptions
 */

import type {
  AIFramework,
  SubjectClassification,
  ContentPriority,
  AIRecommendations,
  FrameworkConversionResult,
} from "../types/aiFramework";

// ============================================
// 변환 타입
// ============================================

/**
 * 과목 할당 (변환 결과)
 */
interface SubjectAllocation {
  subject_id: string;
  subject_name: string;
  subject_type: "strategy" | "weakness";
  weekly_days: number;
}

/**
 * 콘텐츠 할당 (변환 결과)
 */
interface ContentAllocation {
  content_id: string;
  content_type: "book" | "lecture" | "custom";
  subject_type: "strategy" | "weakness";
  weekly_days: number;
}

/**
 * 변환된 스케줄러 옵션
 */
export interface ConvertedSchedulerOptions {
  weak_subject_focus: "low" | "medium" | "high";
  study_days: number;
  review_days: number;
  subject_allocations: SubjectAllocation[];
  content_allocations?: ContentAllocation[];
}

/**
 * 콘텐츠 매핑 정보 (변환 시 필요)
 */
export interface ContentMapping {
  contentId: string;
  subjectCategory: string;
  contentType: "book" | "lecture" | "custom";
}

/**
 * 변환 옵션
 */
export interface ConversionOptions {
  /** 콘텐츠 매핑 (contentId → 과목/타입) */
  contentMappings?: ContentMapping[];
  /** 기본 학습일 수 (기본값: 6) */
  defaultStudyDays?: number;
  /** 기본 복습일 수 (기본값: 1) */
  defaultReviewDays?: number;
}

// ============================================
// 핵심 변환 함수
// ============================================

/**
 * AIFramework를 SchedulerOptions로 변환
 *
 * @param framework AI가 생성한 프레임워크
 * @param options 변환 옵션
 * @returns 변환된 스케줄러 옵션 및 추가 정보
 */
export function convertFrameworkToSchedulerOptions(
  framework: AIFramework,
  options: ConversionOptions = {}
): FrameworkConversionResult {
  const {
    contentMappings = [],
    defaultStudyDays = 6,
    defaultReviewDays = 1,
  } = options;

  // 1. weak_subject_focus 계산
  const weakSubjectFocus = calculateWeakSubjectFocus(
    framework.subjectClassifications
  );

  // 2. subject_allocations 변환
  const subjectAllocations = convertSubjectAllocations(
    framework.subjectClassifications
  );

  // 3. content_allocations 변환 (콘텐츠 매핑이 있는 경우)
  const contentAllocations = contentMappings.length > 0
    ? convertContentAllocations(
        framework.contentPriority,
        framework.subjectClassifications,
        contentMappings
      )
    : undefined;

  // 4. study_days 계산 (주별 전략에서 추출)
  const studyDays = calculateStudyDays(framework, defaultStudyDays);

  // 5. review_days 계산 (리뷰 타입 요일 수)
  const reviewDays = calculateReviewDays(framework, defaultReviewDays);

  // 6. 콘텐츠 정렬 순서 맵 생성
  const contentOrdering = buildContentOrderingMap(framework.contentPriority);

  return {
    schedulerOptions: {
      weak_subject_focus: weakSubjectFocus,
      study_days: studyDays,
      review_days: reviewDays,
      subject_allocations: subjectAllocations,
      content_allocations: contentAllocations,
    },
    contentOrdering,
    aiRecommendations: framework.recommendations,
  };
}

// ============================================
// 변환 헬퍼 함수
// ============================================

/**
 * 취약 과목 집중도 계산
 *
 * 취약 과목의 비율과 우선순위에 따라 집중도를 결정합니다.
 */
function calculateWeakSubjectFocus(
  classifications: SubjectClassification[]
): "low" | "medium" | "high" {
  if (classifications.length === 0) {
    return "medium";
  }

  const weaknessSubjects = classifications.filter(
    (c) => c.classification === "weakness"
  );
  const weaknessRatio = weaknessSubjects.length / classifications.length;

  // 취약 과목의 평균 우선순위 (낮을수록 높은 우선순위)
  const avgPriority =
    weaknessSubjects.length > 0
      ? weaknessSubjects.reduce((sum, c) => sum + c.priorityRank, 0) /
        weaknessSubjects.length
      : Infinity;

  // 취약 과목 비율이 50% 이상이거나 평균 우선순위가 2 이하면 high
  if (weaknessRatio >= 0.5 || avgPriority <= 2) {
    return "high";
  }

  // 취약 과목 비율이 25% 이상이거나 평균 우선순위가 4 이하면 medium
  if (weaknessRatio >= 0.25 || avgPriority <= 4) {
    return "medium";
  }

  return "low";
}

/**
 * 과목 분류를 subject_allocations로 변환
 */
function convertSubjectAllocations(
  classifications: SubjectClassification[]
): SubjectAllocation[] {
  return classifications
    .filter((c) => c.classification !== "neutral") // neutral은 제외
    .map((c) => ({
      subject_id: c.subjectId || generateSubjectId(c.subjectCategory),
      subject_name: c.subjectCategory,
      subject_type: c.classification as "strategy" | "weakness",
      weekly_days: c.recommendedWeeklyDays,
    }))
    .sort((a, b) => {
      // weakness 먼저, 그 다음 strategy
      if (a.subject_type !== b.subject_type) {
        return a.subject_type === "weakness" ? -1 : 1;
      }
      return b.weekly_days - a.weekly_days;
    });
}

/**
 * 콘텐츠 우선순위를 content_allocations로 변환
 */
function convertContentAllocations(
  contentPriority: ContentPriority[],
  subjectClassifications: SubjectClassification[],
  contentMappings: ContentMapping[]
): ContentAllocation[] {
  // 콘텐츠 매핑을 Map으로 변환
  const mappingMap = new Map(
    contentMappings.map((m) => [m.contentId, m])
  );

  // 과목 분류를 카테고리별 Map으로 변환
  const classificationMap = new Map(
    subjectClassifications.map((c) => [c.subjectCategory, c])
  );

  return contentPriority
    .map((cp) => {
      const mapping = mappingMap.get(cp.contentId);
      if (!mapping) return null;

      // 해당 콘텐츠의 과목 분류 찾기
      const classification = classificationMap.get(mapping.subjectCategory);

      // neutral이면 제외
      if (
        !classification ||
        classification.classification === "neutral"
      ) {
        // 콘텐츠 자체의 subjectType 사용
        if (cp.subjectType === "neutral") {
          return null;
        }
      }

      const subjectType =
        cp.subjectType !== "neutral"
          ? cp.subjectType
          : classification?.classification && classification.classification !== "neutral"
            ? classification.classification
            : "strategy"; // 기본값

      return {
        content_id: cp.contentId,
        content_type: mapping.contentType,
        subject_type: subjectType as "strategy" | "weakness",
        weekly_days: calculateContentWeeklyDays(cp, classification),
      };
    })
    .filter((c): c is ContentAllocation => c !== null);
}

/**
 * 콘텐츠별 주간 학습일 계산
 */
function calculateContentWeeklyDays(
  contentPriority: ContentPriority,
  classification?: SubjectClassification
): number {
  // 기본값: 과목의 권장 주간 일수 또는 3일
  const basedays = classification?.recommendedWeeklyDays ?? 3;

  // 긴급도에 따른 조정
  switch (contentPriority.urgency) {
    case "critical":
      return Math.min(basedays + 2, 7); // 최대 7일
    case "high":
      return Math.min(basedays + 1, 6);
    case "low":
      return Math.max(basedays - 1, 1); // 최소 1일
    default:
      return basedays;
  }
}

/**
 * 학습일 수 계산
 *
 * 주별 전략에서 intensive/balanced/light 타입의 일수를 계산합니다.
 */
function calculateStudyDays(
  framework: AIFramework,
  defaultDays: number
): number {
  if (framework.weeklyStrategies.length === 0) {
    return defaultDays;
  }

  // 첫 번째 주 기준으로 계산
  const firstWeek = framework.weeklyStrategies[0];
  if (!firstWeek.dailyStrategies || firstWeek.dailyStrategies.length === 0) {
    return defaultDays;
  }

  // review가 아닌 날의 수 = 학습일
  const studyDayCount = firstWeek.dailyStrategies.filter(
    (d) => d.focusType !== "review"
  ).length;

  return studyDayCount > 0 ? studyDayCount : defaultDays;
}

/**
 * 복습일 수 계산
 */
function calculateReviewDays(
  framework: AIFramework,
  defaultDays: number
): number {
  if (framework.weeklyStrategies.length === 0) {
    return defaultDays;
  }

  const firstWeek = framework.weeklyStrategies[0];
  if (!firstWeek.dailyStrategies || firstWeek.dailyStrategies.length === 0) {
    return defaultDays;
  }

  // review 타입 날의 수
  const reviewDayCount = firstWeek.dailyStrategies.filter(
    (d) => d.focusType === "review"
  ).length;

  return reviewDayCount > 0 ? reviewDayCount : defaultDays;
}

/**
 * 콘텐츠 정렬 순서 맵 생성
 *
 * 스케줄러가 콘텐츠 배치 시 사용할 정렬 순서를 제공합니다.
 */
function buildContentOrderingMap(
  contentPriority: ContentPriority[]
): Map<string, number> {
  const orderingMap = new Map<string, number>();

  // priorityRank 기준으로 정렬된 순서대로 인덱스 부여
  const sorted = [...contentPriority].sort(
    (a, b) => a.priorityRank - b.priorityRank
  );

  sorted.forEach((cp, index) => {
    orderingMap.set(cp.contentId, index);
  });

  return orderingMap;
}

/**
 * 과목 카테고리에서 ID 생성 (임시)
 */
function generateSubjectId(category: string): string {
  // 실제 환경에서는 DB 조회 필요
  return `subject_${category.toLowerCase().replace(/\s+/g, "_")}`;
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 프레임워크 버전 호환성 확인
 */
export function isCompatibleFrameworkVersion(
  framework: AIFramework
): boolean {
  return framework.version === "1.0";
}

/**
 * 프레임워크의 신뢰도 확인
 *
 * 전체 confidence가 임계값 이상인지 확인합니다.
 */
export function isHighConfidenceFramework(
  framework: AIFramework,
  threshold: number = 0.7
): boolean {
  return framework.meta.confidence >= threshold;
}

/**
 * 과목 분류의 평균 신뢰도 계산
 */
export function calculateAverageConfidence(
  classifications: SubjectClassification[]
): number {
  if (classifications.length === 0) return 0;

  const sum = classifications.reduce((acc, c) => acc + c.confidence, 0);
  return sum / classifications.length;
}

/**
 * 취약 과목 목록 추출
 */
export function extractWeaknessSubjects(
  classifications: SubjectClassification[]
): SubjectClassification[] {
  return classifications
    .filter((c) => c.classification === "weakness")
    .sort((a, b) => a.priorityRank - b.priorityRank);
}

/**
 * 전략 과목 목록 추출
 */
export function extractStrategySubjects(
  classifications: SubjectClassification[]
): SubjectClassification[] {
  return classifications
    .filter((c) => c.classification === "strategy")
    .sort((a, b) => a.priorityRank - b.priorityRank);
}

/**
 * 시간 힌트에서 특정 과목의 최적 시간대 찾기
 */
export function getOptimalTimeSlot(
  framework: AIFramework,
  subjectCategory: string
): "morning" | "afternoon" | "evening" | null {
  const hint = framework.timeHints.find(
    (h) => h.subjectCategory === subjectCategory
  );
  return hint?.preferredTimeSlot ?? null;
}

/**
 * 시간 힌트에서 특정 과목의 권장 학습 시간 찾기
 */
export function getRecommendedDuration(
  framework: AIFramework,
  subjectCategory: string
): { optimal: number; min: number; max: number } | null {
  const hint = framework.timeHints.find(
    (h) => h.subjectCategory === subjectCategory
  );
  if (!hint) return null;

  return {
    optimal: hint.optimalDurationMinutes,
    min: hint.minDurationMinutes,
    max: hint.maxDurationMinutes,
  };
}
