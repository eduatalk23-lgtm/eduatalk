/**
 * P3 개선: React Query 캐시 키 상수
 *
 * 모든 React Query 캐시 키를 중앙에서 관리합니다.
 * 일관된 캐시 키 네이밍과 타입 안전성을 보장합니다.
 *
 * @module lib/query/keys
 *
 * @example
 * ```typescript
 * import { queryKeys } from '@/lib/query/keys';
 *
 * // 쿼리 옵션에서 사용
 * export const planGroupsQueryOptions = (studentId: string) => ({
 *   queryKey: queryKeys.planGroups.byStudent(studentId),
 *   queryFn: () => fetchPlanGroups(studentId),
 * });
 *
 * // 쿼리 무효화에서 사용
 * queryClient.invalidateQueries({
 *   queryKey: queryKeys.planGroups.all,
 * });
 * ```
 */

/**
 * 날짜 문자열 정규화 (YYYY-MM-DD)
 */
function normalizeDate(date?: string | Date): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return date;
}

/**
 * React Query 캐시 키 팩토리
 *
 * 각 도메인별로 계층적 캐시 키를 생성합니다.
 * 키는 배열 형태로, 더 구체적인 키가 더 일반적인 키를 포함합니다.
 */
export const queryKeys = {
  /**
   * 플랜 그룹 관련 쿼리 키
   */
  planGroups: {
    /** 모든 플랜 그룹 */
    all: ["planGroups"] as const,
    /** 특정 학생의 플랜 그룹 */
    byStudent: (studentId: string) => ["planGroups", studentId] as const,
    /** 특정 플랜 그룹 상세 */
    detail: (groupId: string) => ["planGroups", "detail", groupId] as const,
    /** 특정 상태의 플랜 그룹 */
    byStatus: (studentId: string, status: string) =>
      ["planGroups", studentId, status] as const,
  },

  /**
   * 일별 플랜 관련 쿼리 키
   */
  plans: {
    /** 모든 플랜 */
    all: ["plans"] as const,
    /** 특정 학생의 특정 날짜 플랜 */
    byStudentDate: (studentId: string, date?: string) =>
      ["plans", studentId, normalizeDate(date)] as const,
    /** 오늘 플랜 */
    today: (studentId: string, tenantId?: string) =>
      ["todayPlans", studentId, tenantId ?? ""] as const,
  },

  /**
   * 활성 플랜 관련 쿼리 키
   */
  activePlan: {
    /** 특정 학생의 활성 플랜 */
    byStudent: (studentId: string, date?: string) =>
      ["activePlan", studentId, normalizeDate(date)] as const,
    /** 활성 플랜 상세 */
    detail: (planId: string) => ["activePlanDetails", planId] as const,
  },

  /**
   * 블록 세트 관련 쿼리 키
   */
  blockSets: {
    /** 모든 블록 세트 */
    all: ["blockSets"] as const,
    /** 특정 학생의 블록 세트 */
    byStudent: (studentId: string) => ["blockSets", studentId] as const,
  },

  /**
   * 학생 콘텐츠 관련 쿼리 키
   */
  studentContents: {
    /** 모든 학생 콘텐츠 */
    all: ["studentContents"] as const,
    /** 특정 학생의 콘텐츠 */
    byStudent: (studentId: string) => ["studentContents", studentId] as const,
  },

  /**
   * 출석 관련 쿼리 키
   */
  attendance: {
    /** 모든 출석 */
    all: ["attendance"] as const,
    /** 출석 목록 */
    list: ["attendance", "list"] as const,
    /** 출석 통계 */
    statistics: ["attendance", "statistics"] as const,
    /** 특정 학생의 출석 */
    byStudent: (studentId: string) => ["attendance", studentId] as const,
  },

  /**
   * 대시보드 관련 쿼리 키
   */
  dashboard: {
    /** 대시보드 플랜 그룹 */
    planGroups: ["dashboard", "planGroups"] as const,
    /** 대시보드 진행률 */
    progress: ["dashboard", "progress"] as const,
    /** 대시보드 출석 */
    attendance: ["dashboard", "attendance"] as const,
  },

  /**
   * 오늘 진행률 관련 쿼리 키
   */
  today: {
    /** 오늘 진행률 */
    progress: ["today", "progress"] as const,
  },

  /**
   * 캠프 관련 쿼리 키
   */
  camp: {
    /** 캠프 템플릿 목록 */
    templates: (tenantId: string) => ["campTemplates", tenantId] as const,
    /** 캠프 통계 */
    stats: (templateId: string) => ["campStats", templateId] as const,
    /** 캠프 출석 통계 */
    attendanceStats: (templateId: string) =>
      ["campAttendanceStats", templateId] as const,
    /** 캠프 학습 통계 */
    learningStats: (templateId: string) =>
      ["campLearningStats", templateId] as const,
    /** 캠프 특정 날짜 출석 */
    dateAttendance: (templateId: string, date: string) =>
      ["campDateAttendance", templateId, date] as const,
    /** 캠프 출석 기록 */
    attendanceRecords: (templateId: string, startDate: string, endDate: string) =>
      ["campAttendanceRecords", templateId, startDate, endDate] as const,
    /** 캠프 특정 날짜 플랜 */
    datePlans: (templateId: string, date: string, studentIds?: string[]) =>
      ["campDatePlans", templateId, date, studentIds ?? []] as const,
    /** 캠프 학습 기록 */
    learningRecords: (templateId: string, startDate: string, endDate: string) =>
      ["campLearningRecords", templateId, startDate, endDate] as const,
    /** 캠프 학생별 학습 통계 */
    studentLearningStats: (templateId: string, studentId: string) =>
      ["campStudentLearningStats", templateId, studentId] as const,
  },

  /**
   * 관리자 관련 쿼리 키
   */
  admin: {
    /** 관리자 출석 */
    attendance: ["admin", "attendance"] as const,
    /** 관리자 대시보드 */
    dashboard: ["admin", "dashboard"] as const,
  },
} as const;

/**
 * 쿼리 키 타입 추출 헬퍼
 */
export type QueryKeys = typeof queryKeys;

/**
 * 캐시 무효화 헬퍼
 *
 * 관련된 모든 쿼리를 무효화하는 프리셋을 제공합니다.
 */
export const invalidationPresets = {
  /**
   * 플랜 관련 모든 캐시 무효화
   */
  allPlans: () => [
    { queryKey: queryKeys.plans.all },
    { queryKey: queryKeys.planGroups.all },
    { queryKey: queryKeys.activePlan.byStudent("") }, // prefix match
    { queryKey: queryKeys.today.progress },
    { queryKey: queryKeys.dashboard.planGroups },
    { queryKey: queryKeys.dashboard.progress },
  ],

  /**
   * 특정 학생의 플랜 캐시 무효화
   */
  studentPlans: (studentId: string) => [
    { queryKey: queryKeys.planGroups.byStudent(studentId) },
    { queryKey: queryKeys.plans.byStudentDate(studentId, "") }, // prefix match
    { queryKey: queryKeys.activePlan.byStudent(studentId) },
    { queryKey: queryKeys.today.progress },
  ],

  /**
   * 출석 관련 모든 캐시 무효화
   */
  allAttendance: () => [
    { queryKey: queryKeys.attendance.all },
    { queryKey: queryKeys.dashboard.attendance },
    { queryKey: queryKeys.admin.attendance },
  ],
};

/**
 * 캐시 시간 상수 (밀리초)
 */
export const CACHE_TIMES = {
  /** 테넌트 설정: 5분 */
  TENANT_SETTINGS: 5 * 60 * 1000,
  /** 블록 세트: 30분 */
  BLOCK_SETS: 30 * 60 * 1000,
  /** 스케줄 설정: 10분 */
  SCHEDULE_SETTINGS: 10 * 60 * 1000,
  /** 오늘 플랜: 1분 */
  TODAY_PLANS: 1 * 60 * 1000,
  /** 통계: 5분 */
  STATISTICS: 5 * 60 * 1000,
  /** 플랜 그룹: 5분 */
  PLAN_GROUPS: 5 * 60 * 1000,
  /** 콘텐츠 메타데이터: 1시간 */
  CONTENT_METADATA: 60 * 60 * 1000,
} as const;

/**
 * staleTime 상수 (밀리초)
 *
 * 데이터가 "신선"하다고 간주되는 시간
 */
export const STALE_TIMES = {
  /** 거의 실시간: 10초 */
  REALTIME: 10 * 1000,
  /** 짧은 시간: 30초 */
  SHORT: 30 * 1000,
  /** 기본: 1분 */
  DEFAULT: 60 * 1000,
  /** 긴 시간: 5분 */
  LONG: 5 * 60 * 1000,
  /** 정적 데이터: 30분 */
  STATIC: 30 * 60 * 1000,
} as const;

// ============================================
// 서버 액션 → 클라이언트 캐시 무효화 힌트
// ============================================

/**
 * 무효화 힌트 프리셋 타입
 *
 * 서버 액션에서 반환하여 클라이언트에서 자동 무효화할 수 있습니다.
 */
export type InvalidationPresetName =
  | "allPlans"
  | "studentPlans"
  | "allAttendance"
  | "planGroup"
  | "planSchedule";

/**
 * 서버 액션에서 반환할 무효화 힌트
 */
export interface InvalidationHint {
  /** 프리셋 이름 */
  preset: InvalidationPresetName;
  /** 프리셋에 전달할 파라미터 */
  params?: {
    studentId?: string;
    groupId?: string;
  };
}

/**
 * 플랜 생성 결과에 포함할 무효화 힌트 빌더
 *
 * @example
 * ```typescript
 * // 서버 액션에서 사용
 * return {
 *   success: true,
 *   planId: createdPlan.id,
 *   ...buildPlanCreationHints({ studentId, groupId }),
 * };
 * ```
 */
export function buildPlanCreationHints(params: {
  studentId?: string;
  groupId?: string;
}): { invalidationHints: InvalidationHint[] } {
  const hints: InvalidationHint[] = [];

  if (params.studentId) {
    hints.push({
      preset: "studentPlans",
      params: { studentId: params.studentId },
    });
  }

  if (params.groupId) {
    hints.push({
      preset: "planGroup",
      params: { groupId: params.groupId },
    });
    hints.push({
      preset: "planSchedule",
      params: { groupId: params.groupId },
    });
  }

  return { invalidationHints: hints };
}

/**
 * 무효화 힌트로부터 쿼리 키 배열 생성
 *
 * 클라이언트에서 서버 액션 결과를 받아 자동으로 캐시 무효화할 때 사용
 */
export function getQueryKeysFromHints(
  hints: InvalidationHint[]
): Array<{ queryKey: readonly unknown[] }> {
  const keys: Array<{ queryKey: readonly unknown[] }> = [];

  for (const hint of hints) {
    switch (hint.preset) {
      case "allPlans":
        keys.push(...invalidationPresets.allPlans());
        break;
      case "studentPlans":
        if (hint.params?.studentId) {
          keys.push(...invalidationPresets.studentPlans(hint.params.studentId));
        }
        break;
      case "allAttendance":
        keys.push(...invalidationPresets.allAttendance());
        break;
      case "planGroup":
        if (hint.params?.groupId) {
          keys.push({ queryKey: queryKeys.planGroups.detail(hint.params.groupId) });
          keys.push({ queryKey: ["plansExist", hint.params.groupId] });
        }
        break;
      case "planSchedule":
        if (hint.params?.groupId) {
          keys.push({ queryKey: ["planSchedule", hint.params.groupId] });
          keys.push({ queryKey: ["contentScheduleOverview", hint.params.groupId] });
        }
        break;
    }
  }

  return keys;
}
