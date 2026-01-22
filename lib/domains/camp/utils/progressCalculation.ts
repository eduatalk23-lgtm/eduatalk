/**
 * 캠프 진행률 계산 유틸리티
 * 중복된 계산 로직을 통합하여 재사용성 향상
 */

// ============================================
// 타입 정의
// ============================================

export interface StudySession {
  plan_id: string;
  duration_seconds: number | null;
}

export interface Plan {
  id: string;
  student_id?: string;
  plan_date?: string;
  completed_amount?: number | null;
  subject?: string | null;
  status?: string | null;
  actual_end_time?: string | null;
}

export interface ProgressStats {
  studyMinutes: number;
  totalPlans: number;
  completedPlans: number;
  completionRate: number;
}

export interface SubjectDistribution {
  [subject: string]: number;
}

// ============================================
// 학습 시간 계산
// ============================================

/**
 * 학습 세션에서 플랜별 학습 시간 Map 생성
 * @param sessions 학습 세션 배열
 * @returns 플랜 ID → 학습 분(minutes) Map
 */
export function buildPlanStudyTimeMap(
  sessions: StudySession[]
): Map<string, number> {
  const timeMap = new Map<string, number>();

  for (const session of sessions) {
    if (session.plan_id && session.duration_seconds) {
      const current = timeMap.get(session.plan_id) || 0;
      timeMap.set(
        session.plan_id,
        current + Math.floor(session.duration_seconds / 60)
      );
    }
  }

  return timeMap;
}

/**
 * 플랜 목록의 총 학습 시간 계산
 * @param plans 플랜 배열
 * @param timeMap 플랜별 학습 시간 Map
 * @returns 총 학습 분
 */
export function calculateTotalStudyMinutes(
  plans: Plan[],
  timeMap: Map<string, number>
): number {
  return plans.reduce((sum, plan) => sum + (timeMap.get(plan.id) || 0), 0);
}

// ============================================
// 완료율 계산
// ============================================

/**
 * 플랜 완료 여부 확인
 * 완료 기준: status === 'completed' OR actual_end_time이 설정됨
 * @param plan 플랜 객체
 * @returns 완료 여부
 */
export function isPlanCompleted(plan: Plan): boolean {
  return plan.status === "completed" || plan.actual_end_time != null;
}

/**
 * 플랜 완료율 계산
 * @param plans 플랜 배열
 * @returns 완료율 (0-100)
 */
export function calculateCompletionRate(plans: Plan[]): number {
  if (plans.length === 0) return 0;

  const completedCount = plans.filter(isPlanCompleted).length;
  return Math.round((completedCount / plans.length) * 100);
}

/**
 * 완료된 플랜 수 계산
 * @param plans 플랜 배열
 * @returns 완료된 플랜 수
 */
export function countCompletedPlans(plans: Plan[]): number {
  return plans.filter(isPlanCompleted).length;
}

// ============================================
// 과목별 분포 계산
// ============================================

/**
 * 과목별 학습 시간 분포 계산
 * @param plans 플랜 배열 (subject 필드 포함)
 * @param timeMap 플랜별 학습 시간 Map
 * @returns 과목 → 학습 분 Record
 */
export function calculateSubjectDistribution(
  plans: Plan[],
  timeMap: Map<string, number>
): SubjectDistribution {
  const distribution: SubjectDistribution = {};

  for (const plan of plans) {
    if (plan.subject) {
      const minutes = timeMap.get(plan.id) || 0;
      distribution[plan.subject] = (distribution[plan.subject] || 0) + minutes;
    }
  }

  return distribution;
}

// ============================================
// 통합 통계 계산
// ============================================

/**
 * 플랜 목록에서 진행률 통계 계산 (통합)
 * @param plans 플랜 배열
 * @param sessions 학습 세션 배열
 * @returns 진행률 통계
 */
export function calculateProgressStats(
  plans: Plan[],
  sessions: StudySession[]
): ProgressStats {
  const timeMap = buildPlanStudyTimeMap(sessions);
  const studyMinutes = calculateTotalStudyMinutes(plans, timeMap);
  const completedPlans = countCompletedPlans(plans);
  const completionRate = calculateCompletionRate(plans);

  return {
    studyMinutes,
    totalPlans: plans.length,
    completedPlans,
    completionRate,
  };
}

/**
 * 학생별 플랜 필터링
 * @param plans 전체 플랜 배열
 * @param studentId 학생 ID
 * @returns 해당 학생의 플랜 배열
 */
export function filterPlansByStudent(plans: Plan[], studentId: string): Plan[] {
  return plans.filter((p) => p.student_id === studentId);
}

/**
 * 날짜별 플랜 그룹핑
 * @param plans 플랜 배열
 * @returns 날짜 → 플랜 배열 Map
 */
export function groupPlansByDate(plans: Plan[]): Map<string, Plan[]> {
  const grouped = new Map<string, Plan[]>();

  for (const plan of plans) {
    if (plan.plan_date) {
      const existing = grouped.get(plan.plan_date) || [];
      existing.push(plan);
      grouped.set(plan.plan_date, existing);
    }
  }

  return grouped;
}

/**
 * 과목별 플랜 그룹핑
 * @param plans 플랜 배열
 * @returns 과목 → 플랜 배열 Map
 */
export function groupPlansBySubject(plans: Plan[]): Map<string, Plan[]> {
  const grouped = new Map<string, Plan[]>();

  for (const plan of plans) {
    if (plan.subject) {
      const existing = grouped.get(plan.subject) || [];
      existing.push(plan);
      grouped.set(plan.subject, existing);
    }
  }

  return grouped;
}

// ============================================
// 집계 유틸리티
// ============================================

/**
 * 참여자 통계 배열에서 전체 통계 집계
 * @param participantStats 참여자별 통계 배열
 * @returns 집계된 통계
 */
export function aggregateParticipantStats(
  participantStats: Array<{
    study_minutes: number;
    total_plans: number;
    completed_plans: number;
  }>
): {
  totalStudyMinutes: number;
  averageStudyMinutes: number;
  totalPlans: number;
  completedPlans: number;
} {
  const totalStudyMinutes = participantStats.reduce(
    (sum, stat) => sum + stat.study_minutes,
    0
  );
  const averageStudyMinutes =
    participantStats.length > 0
      ? Math.round(totalStudyMinutes / participantStats.length)
      : 0;
  const totalPlans = participantStats.reduce(
    (sum, stat) => sum + stat.total_plans,
    0
  );
  const completedPlans = participantStats.reduce(
    (sum, stat) => sum + stat.completed_plans,
    0
  );

  return {
    totalStudyMinutes,
    averageStudyMinutes,
    totalPlans,
    completedPlans,
  };
}

// ============================================
// 빈 통계 생성 헬퍼
// ============================================

/**
 * 빈 캠프 학습 통계 생성
 * @param templateId 템플릿 ID
 * @param templateName 템플릿 이름
 */
export function createEmptyCampStats(
  templateId: string,
  templateName: string
) {
  return {
    template_id: templateId,
    template_name: templateName,
    total_study_minutes: 0,
    average_study_minutes_per_participant: 0,
    total_plans: 0,
    completed_plans: 0,
    participant_stats: [],
  };
}
