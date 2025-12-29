/**
 * useWeeklyOptimization 훅
 *
 * 주간 학습 최적화를 위한 분석 데이터를 제공합니다.
 * - 일일 최적 학습량 계산
 * - 휴식 권장 요일 제안
 * - 간격 반복 콘텐츠 스케줄 생성
 *
 * @module lib/hooks/useWeeklyOptimization
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import {
  getAdaptiveScheduleAnalysis,
  getWeakSubjectReinforcement,
} from "@/lib/domains/plan/actions/plan-groups/adaptiveAnalysis";
import type {
  LearningPatternAnalysis,
  DayOfWeekPerformance,
  SubjectPerformance,
} from "@/lib/domains/plan/services/adaptiveScheduler";

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 간격 반복 스케줄 아이템
 */
export interface ContentSchedule {
  /** 과목명 */
  subject: string;
  /** 권장 학습 일자 (YYYY-MM-DD 형식) */
  recommendedDate: string;
  /** 권장 이유 */
  reason: string;
  /** 우선순위 (1이 가장 높음) */
  priority: number;
  /** 복습 간격 (일) */
  intervalDays: number;
}

/**
 * 주간 최적화 결과
 */
export interface WeeklyOptimizationResult {
  /** 일일 최적 학습량 (콘텐츠 수) */
  idealDailyLoad: number;
  /** 휴식 권장 요일 (YYYY-MM-DD 형식) */
  restDays: string[];
  /** 간격 반복 콘텐츠 스케줄 */
  spacedRepetition: ContentSchedule[];
  /** 원본 패턴 분석 데이터 */
  patterns: LearningPatternAnalysis | null;
  /** 최적 학습 시간대 */
  optimalTimePeriod: string | null;
  /** 최적 학습 요일 */
  optimalDayOfWeek: number | null;
  /** 취약 과목 목록 */
  weakSubjects: SubjectPerformance[];
}

/**
 * 훅 옵션
 */
export interface UseWeeklyOptimizationOptions {
  /** 분석할 과거 일수 (기본값: 30일) */
  daysBack?: number;
  /** 목표 완료율 (기본값: 80%) */
  targetCompletionRate?: number;
  /** 자동 조회 활성화 (기본값: true) */
  enabled?: boolean;
}

// ============================================================================
// 상수
// ============================================================================

const QUERY_KEY_BASE = "weeklyOptimization";
const DEFAULT_DAYS_BACK = 30;
const DEFAULT_TARGET_COMPLETION_RATE = 80;
const STALE_TIME = 5 * 60 * 1000; // 5분
const GC_TIME = 30 * 60 * 1000; // 30분

// 요일 라벨 (0 = 일요일)
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 휴식 권장 기준 완료율 (이 수치 이하면 휴식 권장)
const REST_DAY_THRESHOLD = 50;

// 간격 반복 기본 간격 (일)
const SPACED_REPETITION_INTERVALS = [1, 3, 7, 14, 30];

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 일일 최적 학습량 계산
 * 완료율과 평균 진행률을 기반으로 적정 학습량을 산정
 */
function calculateIdealDailyLoad(patterns: LearningPatternAnalysis): number {
  const { overallCompletionRate, dayOfWeekPerformance } = patterns;

  // 요일별 총 플랜 수의 평균 계산
  const totalPlansPerDay =
    dayOfWeekPerformance.length > 0
      ? dayOfWeekPerformance.reduce((sum, d) => sum + d.totalPlans, 0) /
        dayOfWeekPerformance.length
      : 0;

  // 완료율이 낮으면 학습량 감소, 높으면 유지 또는 약간 증가
  let loadMultiplier = 1.0;
  if (overallCompletionRate < 50) {
    loadMultiplier = 0.7; // 30% 감소
  } else if (overallCompletionRate < 70) {
    loadMultiplier = 0.85; // 15% 감소
  } else if (overallCompletionRate >= 90) {
    loadMultiplier = 1.1; // 10% 증가
  }

  // 최소 1개, 최대 10개로 제한
  const idealLoad = Math.round(totalPlansPerDay * loadMultiplier);
  return Math.max(1, Math.min(10, idealLoad || 3));
}

/**
 * 휴식 권장 요일 계산
 * 완료율이 낮은 요일을 휴식일로 권장
 */
function calculateRestDays(
  dayOfWeekPerformance: DayOfWeekPerformance[]
): string[] {
  const today = new Date();
  const restDays: string[] = [];

  // 완료율이 낮은 요일 찾기
  const lowPerformanceDays = dayOfWeekPerformance
    .filter((d) => d.completionRate < REST_DAY_THRESHOLD && d.totalPlans >= 3)
    .map((d) => d.dayOfWeek);

  // 앞으로 2주간의 해당 요일을 휴식일로 지정
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayOfWeek = date.getDay();

    if (lowPerformanceDays.includes(dayOfWeek)) {
      restDays.push(date.toISOString().slice(0, 10));
    }
  }

  return restDays;
}

/**
 * 간격 반복 스케줄 생성
 * 취약 과목을 기반으로 복습 스케줄 생성
 */
function generateSpacedRepetitionSchedule(
  weakSubjects: SubjectPerformance[],
  optimalDayOfWeek: number | null
): ContentSchedule[] {
  const today = new Date();
  const schedules: ContentSchedule[] = [];

  weakSubjects.forEach((subject, index) => {
    // 우선순위에 따라 간격 설정 (취약할수록 자주 복습)
    const intervalIndex = Math.min(
      index,
      SPACED_REPETITION_INTERVALS.length - 1
    );
    const interval = SPACED_REPETITION_INTERVALS[intervalIndex];

    // 복습 일자 계산 (최적 요일을 고려)
    let recommendedDate = new Date(today);
    recommendedDate.setDate(today.getDate() + interval);

    // 최적 요일이 있으면 가장 가까운 해당 요일로 조정
    if (optimalDayOfWeek !== null) {
      const currentDay = recommendedDate.getDay();
      const daysUntilOptimal = (optimalDayOfWeek - currentDay + 7) % 7;
      if (daysUntilOptimal > 0 && daysUntilOptimal <= 3) {
        recommendedDate.setDate(recommendedDate.getDate() + daysUntilOptimal);
      }
    }

    schedules.push({
      subject: subject.subject,
      recommendedDate: recommendedDate.toISOString().slice(0, 10),
      reason: `완료율 ${subject.completionRate}%로 보강이 필요합니다.`,
      priority: index + 1,
      intervalDays: interval,
    });
  });

  return schedules;
}

// ============================================================================
// 훅
// ============================================================================

/**
 * 주간 학습 최적화 훅
 *
 * @example
 * ```tsx
 * const {
 *   idealDailyLoad,
 *   restDays,
 *   spacedRepetition,
 *   isLoading,
 *   refetch
 * } = useWeeklyOptimization(studentId);
 *
 * // 일일 학습량 표시
 * <p>오늘 권장 학습량: {idealDailyLoad}개</p>
 *
 * // 휴식일 표시
 * {restDays.includes(today) && <Badge>오늘은 휴식일이에요</Badge>}
 *
 * // 복습 스케줄 표시
 * {spacedRepetition.map(s => (
 *   <div key={s.subject}>
 *     {s.subject}: {s.recommendedDate}에 복습
 *   </div>
 * ))}
 * ```
 */
export function useWeeklyOptimization(
  studentId: string | null,
  options: UseWeeklyOptimizationOptions = {}
) {
  const {
    daysBack = DEFAULT_DAYS_BACK,
    targetCompletionRate = DEFAULT_TARGET_COMPLETION_RATE,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();

  // 적응형 스케줄 분석 쿼리
  const analysisQuery = useQuery({
    queryKey: [QUERY_KEY_BASE, "analysis", studentId, daysBack] as const,
    queryFn: async () => {
      if (!studentId) return null;
      const result = await getAdaptiveScheduleAnalysis(studentId, daysBack);
      if (!result.success) {
        throw new Error(result.error || "분석에 실패했습니다.");
      }
      return result.data ?? null;
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    enabled: enabled && !!studentId,
  });

  // 취약 과목 강화 쿼리
  const reinforcementQuery = useQuery({
    queryKey: [
      QUERY_KEY_BASE,
      "reinforcement",
      studentId,
      daysBack,
      targetCompletionRate,
    ] as const,
    queryFn: async () => {
      if (!studentId) return null;
      const result = await getWeakSubjectReinforcement(
        studentId,
        daysBack,
        targetCompletionRate
      );
      if (!result.success) {
        throw new Error(result.error || "강화 스케줄 생성에 실패했습니다.");
      }
      return result.data ?? null;
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    enabled: enabled && !!studentId,
  });

  // 최적화 결과 계산
  const optimizationResult = useMemo((): WeeklyOptimizationResult => {
    const analysis = analysisQuery.data;
    const patterns = analysis?.patterns ?? null;

    if (!patterns) {
      return {
        idealDailyLoad: 3, // 기본값
        restDays: [],
        spacedRepetition: [],
        patterns: null,
        optimalTimePeriod: null,
        optimalDayOfWeek: null,
        weakSubjects: [],
      };
    }

    const idealDailyLoad = calculateIdealDailyLoad(patterns);
    const restDays = calculateRestDays(patterns.dayOfWeekPerformance);
    const spacedRepetition = generateSpacedRepetitionSchedule(
      patterns.weakSubjects,
      patterns.optimalDayOfWeek?.dayOfWeek ?? null
    );

    return {
      idealDailyLoad,
      restDays,
      spacedRepetition,
      patterns,
      optimalTimePeriod: patterns.optimalTimePeriod?.label ?? null,
      optimalDayOfWeek: patterns.optimalDayOfWeek?.dayOfWeek ?? null,
      weakSubjects: patterns.weakSubjects,
    };
  }, [analysisQuery.data]);

  // 데이터 새로고침
  const refetch = useCallback(async () => {
    await Promise.all([
      analysisQuery.refetch(),
      reinforcementQuery.refetch(),
    ]);
  }, [analysisQuery, reinforcementQuery]);

  // 캐시 무효화
  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [QUERY_KEY_BASE],
    });
  }, [queryClient]);

  return {
    // 최적화 결과
    ...optimizationResult,

    // 쿼리 상태
    isLoading: analysisQuery.isLoading || reinforcementQuery.isLoading,
    isError: analysisQuery.isError || reinforcementQuery.isError,
    error: analysisQuery.error || reinforcementQuery.error,

    // 원본 데이터
    analysis: analysisQuery.data,
    reinforcement: reinforcementQuery.data,

    // 권장사항
    recommendations: analysisQuery.data?.recommendations ?? [],

    // 액션
    refetch,
    invalidate,
  };
}

// ============================================================================
// 유틸리티 훅
// ============================================================================

/**
 * 오늘이 휴식일인지 확인하는 훅
 */
export function useIsRestDay(studentId: string | null) {
  const { restDays, isLoading } = useWeeklyOptimization(studentId);
  const today = new Date().toISOString().slice(0, 10);

  return {
    isRestDay: restDays.includes(today),
    isLoading,
  };
}

/**
 * 특정 날짜의 최적화 정보를 가져오는 훅
 */
export function useDateOptimization(
  studentId: string | null,
  date: string // YYYY-MM-DD 형식
) {
  const {
    restDays,
    spacedRepetition,
    idealDailyLoad,
    optimalTimePeriod,
    isLoading,
  } = useWeeklyOptimization(studentId);

  const scheduledSubjects = spacedRepetition
    .filter((s) => s.recommendedDate === date)
    .map((s) => s.subject);

  return {
    isRestDay: restDays.includes(date),
    scheduledSubjects,
    recommendedLoad: restDays.includes(date) ? 0 : idealDailyLoad,
    optimalTimePeriod,
    isLoading,
  };
}

/**
 * 요일별 최적화 힌트를 제공하는 훅
 */
export function useDayOfWeekHints(studentId: string | null) {
  const { patterns, isLoading } = useWeeklyOptimization(studentId);

  const hints = useMemo(() => {
    if (!patterns) return [];

    return patterns.dayOfWeekPerformance.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      label: DAY_LABELS[d.dayOfWeek],
      completionRate: d.completionRate,
      averageProgress: d.averageProgress,
      isOptimal: d.dayOfWeek === patterns.optimalDayOfWeek?.dayOfWeek,
      isRestRecommended: d.completionRate < REST_DAY_THRESHOLD && d.totalPlans >= 3,
      hint: getPerformanceHint(d.completionRate),
    }));
  }, [patterns]);

  return {
    hints,
    isLoading,
  };
}

function getPerformanceHint(completionRate: number): string {
  if (completionRate >= 90) return "최상의 학습 효율!";
  if (completionRate >= 70) return "좋은 학습 흐름입니다";
  if (completionRate >= 50) return "조금 더 집중해보세요";
  return "이 요일은 휴식이 좋을 수 있어요";
}
