/**
 * Early Warning Service
 *
 * Phase 4.2: 조기 경고 시스템
 * 학생의 학습 패턴을 모니터링하고 위험 신호 감지 시 경고 생성
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  PredictionService,
  type WeeklyPerformancePrediction,
  type BurnoutRiskPrediction,
} from "./predictionService";

// ============================================================================
// Types
// ============================================================================

export type WarningType =
  | "completion_drop" // 완수율 급락
  | "streak_break" // 연속 학습 위험
  | "subject_struggle" // 과목별 어려움
  | "burnout_risk" // 번아웃 위험
  | "schedule_overload" // 과부하
  | "exam_unpreparedness"; // 시험 미준비

export type WarningSeverity = "low" | "medium" | "high" | "critical";

export type WarningActionType =
  | "acknowledged" // 확인
  | "contacted_student" // 학생 연락
  | "adjusted_schedule" // 일정 조정
  | "reduced_load" // 학습량 감소
  | "resolved"; // 해결 완료

export interface WarningContextData {
  currentRate?: number;
  previousRate?: number;
  affectedSubjects?: string[];
  streakDays?: number;
  overloadPercentage?: number;
  burnoutScore?: number;
  examDate?: string;
  examSubject?: string;
  completionRate?: number;
  [key: string]: unknown;
}

export interface RecommendedAction {
  action: string;
  priority: number;
  description?: string;
}

export interface EarlyWarning {
  id: string;
  studentId: string;
  tenantId: string;
  warningType: WarningType;
  severity: WarningSeverity;
  detectedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  contextData: WarningContextData;
  recommendedActions: RecommendedAction[];
  notificationSent: boolean;
  notificationSentAt: string | null;
  notificationChannels: string[];
}

export interface WarningTriggerCondition {
  type: WarningType;
  condition: (data: WarningCheckData) => boolean;
  severity: (data: WarningCheckData) => WarningSeverity;
  contextBuilder: (data: WarningCheckData) => WarningContextData;
  recommendedActions: RecommendedAction[];
}

export interface WarningCheckData {
  studentId: string;
  completionRate7d: number;
  completionRate30d: number;
  streakDays: number;
  upcomingPlanCount: number;
  avgWeeklyPlans: number;
  burnoutScore: number;
  strugglingSubjects: string[];
  weeklyPrediction: WeeklyPerformancePrediction | null;
  burnoutPrediction: BurnoutRiskPrediction | null;
}

export interface DetectionResult {
  warningsCreated: number;
  warningsUpdated: number;
  warningIds: string[];
}

// ============================================================================
// Constants
// ============================================================================

const WARNING_TRIGGER_CONDITIONS: WarningTriggerCondition[] = [
  // 완수율 급락
  {
    type: "completion_drop",
    condition: (data) =>
      data.completionRate30d > 0.5 &&
      data.completionRate7d < data.completionRate30d * 0.7,
    severity: (data) => {
      const dropRate = 1 - data.completionRate7d / data.completionRate30d;
      if (dropRate > 0.5) return "high";
      if (dropRate > 0.3) return "medium";
      return "low";
    },
    contextBuilder: (data) => ({
      currentRate: data.completionRate7d,
      previousRate: data.completionRate30d,
      dropPercentage: Math.round(
        (1 - data.completionRate7d / data.completionRate30d) * 100
      ),
    }),
    recommendedActions: [
      { action: "contact_student", priority: 1, description: "학생 상태 확인" },
      { action: "review_schedule", priority: 2, description: "일정 검토" },
    ],
  },

  // 연속 학습 위험
  {
    type: "streak_break",
    condition: (data) =>
      data.streakDays >= 3 &&
      data.weeklyPrediction !== null &&
      data.weeklyPrediction.riskLevel !== "low",
    severity: (data) => {
      if (data.streakDays >= 14) return "high";
      if (data.streakDays >= 7) return "medium";
      return "low";
    },
    contextBuilder: (data) => ({
      streakDays: data.streakDays,
      riskLevel: data.weeklyPrediction?.riskLevel,
    }),
    recommendedActions: [
      {
        action: "encourage_student",
        priority: 1,
        description: "학습 격려 메시지",
      },
      { action: "adjust_schedule", priority: 2, description: "부담 줄이기" },
    ],
  },

  // 과목별 어려움
  {
    type: "subject_struggle",
    condition: (data) => data.strugglingSubjects.length >= 2,
    severity: (data) => {
      if (data.strugglingSubjects.length >= 4) return "high";
      if (data.strugglingSubjects.length >= 3) return "medium";
      return "low";
    },
    contextBuilder: (data) => ({
      affectedSubjects: data.strugglingSubjects,
      subjectCount: data.strugglingSubjects.length,
    }),
    recommendedActions: [
      {
        action: "redistribute_subjects",
        priority: 1,
        description: "과목 배분 조정",
      },
      {
        action: "add_supplementary",
        priority: 2,
        description: "보충 학습 추가",
      },
    ],
  },

  // 번아웃 위험
  {
    type: "burnout_risk",
    condition: (data) => data.burnoutScore >= 50,
    severity: (data) => {
      if (data.burnoutScore >= 80) return "critical";
      if (data.burnoutScore >= 70) return "high";
      if (data.burnoutScore >= 60) return "medium";
      return "low";
    },
    contextBuilder: (data) => ({
      burnoutScore: data.burnoutScore,
      streakDays: data.streakDays,
      riskIndicators: data.burnoutPrediction?.riskIndicators ?? [],
    }),
    recommendedActions: [
      { action: "add_breaks", priority: 1, description: "휴식일 추가" },
      { action: "reduce_load", priority: 1, description: "학습량 감소" },
      { action: "contact_student", priority: 2, description: "상담 진행" },
    ],
  },

  // 과부하
  {
    type: "schedule_overload",
    condition: (data) =>
      data.upcomingPlanCount > data.avgWeeklyPlans * 1.5 &&
      data.avgWeeklyPlans > 0,
    severity: (data) => {
      const overloadRatio = data.upcomingPlanCount / data.avgWeeklyPlans;
      if (overloadRatio > 2) return "high";
      if (overloadRatio > 1.7) return "medium";
      return "low";
    },
    contextBuilder: (data) => ({
      upcomingPlanCount: data.upcomingPlanCount,
      avgWeeklyPlans: Math.round(data.avgWeeklyPlans),
      overloadPercentage: Math.round(
        (data.upcomingPlanCount / data.avgWeeklyPlans - 1) * 100
      ),
    }),
    recommendedActions: [
      { action: "reduce_load", priority: 1, description: "플랜 수 줄이기" },
      { action: "spread_plans", priority: 2, description: "플랜 분산" },
    ],
  },
];

const NOTIFICATION_POLICIES: Record<
  WarningSeverity,
  { channels: string[]; immediate: boolean }
> = {
  low: { channels: ["admin_dashboard"], immediate: false },
  medium: { channels: ["admin_dashboard", "daily_digest"], immediate: false },
  high: { channels: ["admin_dashboard", "email"], immediate: true },
  critical: {
    channels: ["admin_dashboard", "email", "push"],
    immediate: true,
  },
};

// ============================================================================
// Early Warning Service
// ============================================================================

export class EarlyWarningService {
  private tenantId: string;
  private predictionService: PredictionService;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.predictionService = new PredictionService(tenantId);
  }

  /**
   * 학생 경고 감지
   */
  async detectWarnings(studentId: string): Promise<DetectionResult> {
    try {
      // 예측 데이터 수집
      const [weeklyPrediction, burnoutPrediction, subjectPrediction] =
        await Promise.all([
          this.predictionService.predictWeeklyPerformance(studentId),
          this.predictionService.predictBurnoutRisk(studentId),
          this.predictionService.predictSubjectStruggle(studentId),
        ]);

      const features = weeklyPrediction.features;

      const checkData: WarningCheckData = {
        studentId,
        completionRate7d: features.avgCompletionRate7d ?? 0,
        completionRate30d: features.avgCompletionRate30d ?? 0,
        streakDays: features.currentStreakDays ?? 0,
        upcomingPlanCount: features.upcomingPlanCount ?? 0,
        avgWeeklyPlans: features.avgWeeklyPlans ?? 0,
        burnoutScore: burnoutPrediction.score,
        strugglingSubjects: subjectPrediction.strugglingSubjects,
        weeklyPrediction,
        burnoutPrediction,
      };

      const warningIds: string[] = [];
      let warningsCreated = 0;
      let warningsUpdated = 0;

      // 각 조건 검사
      for (const condition of WARNING_TRIGGER_CONDITIONS) {
        if (condition.condition(checkData)) {
          const result = await this.createOrUpdateWarning(
            studentId,
            condition.type,
            condition.severity(checkData),
            condition.contextBuilder(checkData),
            condition.recommendedActions
          );

          warningIds.push(result.id);
          if (result.created) {
            warningsCreated++;
          } else {
            warningsUpdated++;
          }
        }
      }

      return { warningsCreated, warningsUpdated, warningIds };
    } catch (error) {
      logActionError(
        { domain: "analysis", action: "detectWarnings" },
        error,
        { studentId }
      );
      throw error;
    }
  }

  /**
   * 경고 생성 또는 업데이트
   */
  private async createOrUpdateWarning(
    studentId: string,
    warningType: WarningType,
    severity: WarningSeverity,
    contextData: WarningContextData,
    recommendedActions: RecommendedAction[]
  ): Promise<{ id: string; created: boolean }> {
    const supabase = await createSupabaseServerClient();

    // 미해결 동일 유형 경고 조회
    const { data: existing } = await supabase
      .from("early_warnings")
      .select("id, severity, context_data")
      .eq("student_id", studentId)
      .eq("warning_type", warningType)
      .is("resolved_at", null)
      .order("detected_at", { ascending: false })
      .limit(1)
      .single();

    const notificationPolicy = NOTIFICATION_POLICIES[severity];

    if (existing) {
      // 심각도가 높아졌으면 업데이트
      const severityOrder: WarningSeverity[] = [
        "low",
        "medium",
        "high",
        "critical",
      ];
      const existingSeverityIndex = severityOrder.indexOf(
        existing.severity as WarningSeverity
      );
      const newSeverityIndex = severityOrder.indexOf(severity);

      if (newSeverityIndex > existingSeverityIndex) {
        await supabase
          .from("early_warnings")
          .update({
            severity,
            context_data: contextData,
            recommended_actions: recommendedActions,
            notification_channels: notificationPolicy.channels,
          })
          .eq("id", existing.id);
      }

      return { id: existing.id, created: false };
    }

    // 새 경고 생성
    const { data: newWarning, error } = await supabase
      .from("early_warnings")
      .insert({
        student_id: studentId,
        tenant_id: this.tenantId,
        warning_type: warningType,
        severity,
        context_data: contextData,
        recommended_actions: recommendedActions,
        notification_channels: notificationPolicy.channels,
      })
      .select("id")
      .single();

    if (error) throw error;

    // 즉시 알림 필요한 경우 처리
    if (notificationPolicy.immediate) {
      await this.sendImmediateNotification(
        newWarning.id,
        studentId,
        warningType,
        severity
      );
    }

    return { id: newWarning.id, created: true };
  }

  /**
   * 즉시 알림 전송
   */
  private async sendImmediateNotification(
    warningId: string,
    studentId: string,
    warningType: WarningType,
    severity: WarningSeverity
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();

    // 알림 전송 상태 업데이트
    await supabase
      .from("early_warnings")
      .update({
        notification_sent: true,
        notification_sent_at: new Date().toISOString(),
      })
      .eq("id", warningId);

    // TODO: 실제 알림 전송 구현 (이메일, 푸시 등)
    console.log(
      `[EarlyWarning] Immediate notification sent for ${warningType} (${severity}) - Student: ${studentId}`
    );
  }

  /**
   * 미해결 경고 조회
   */
  async getUnresolvedWarnings(
    studentId?: string
  ): Promise<EarlyWarning[]> {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("early_warnings")
      .select("*")
      .eq("tenant_id", this.tenantId)
      .is("resolved_at", null)
      .order("severity", { ascending: false })
      .order("detected_at", { ascending: false });

    if (studentId) {
      query = query.eq("student_id", studentId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data ?? []).map(this.mapWarningFromDB);
  }

  /**
   * 경고 확인
   */
  async acknowledgeWarning(
    warningId: string,
    userId: string
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();

    await supabase
      .from("early_warnings")
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq("id", warningId);

    // 조치 이력 기록
    await supabase.from("warning_actions").insert({
      warning_id: warningId,
      action_type: "acknowledged",
      action_taken_by: userId,
      action_notes: "경고 확인",
    });
  }

  /**
   * 경고 해결
   */
  async resolveWarning(
    warningId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();

    await supabase
      .from("early_warnings")
      .update({
        resolved_at: new Date().toISOString(),
      })
      .eq("id", warningId);

    // 조치 이력 기록
    await supabase.from("warning_actions").insert({
      warning_id: warningId,
      action_type: "resolved",
      action_taken_by: userId,
      action_notes: notes ?? "경고 해결",
    });
  }

  /**
   * 조치 기록
   */
  async recordAction(
    warningId: string,
    actionType: WarningActionType,
    userId: string,
    notes?: string
  ): Promise<void> {
    const supabase = await createSupabaseServerClient();

    await supabase.from("warning_actions").insert({
      warning_id: warningId,
      action_type: actionType,
      action_taken_by: userId,
      action_notes: notes,
    });
  }

  /**
   * 경고 통계 조회
   */
  async getWarningStats(): Promise<{
    total: number;
    bySeverity: Record<WarningSeverity, number>;
    byType: Record<WarningType, number>;
    unacknowledged: number;
  }> {
    const supabase = await createSupabaseServerClient();

    const { data: warnings, error } = await supabase
      .from("early_warnings")
      .select("severity, warning_type, acknowledged_at")
      .eq("tenant_id", this.tenantId)
      .is("resolved_at", null);

    if (error) throw error;

    const stats = {
      total: warnings?.length ?? 0,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      } as Record<WarningSeverity, number>,
      byType: {
        completion_drop: 0,
        streak_break: 0,
        subject_struggle: 0,
        burnout_risk: 0,
        schedule_overload: 0,
        exam_unpreparedness: 0,
      } as Record<WarningType, number>,
      unacknowledged: 0,
    };

    for (const warning of warnings ?? []) {
      stats.bySeverity[warning.severity as WarningSeverity]++;
      stats.byType[warning.warning_type as WarningType]++;
      if (!warning.acknowledged_at) {
        stats.unacknowledged++;
      }
    }

    return stats;
  }

  /**
   * DB 데이터를 EarlyWarning 타입으로 매핑
   */
  private mapWarningFromDB(row: Record<string, unknown>): EarlyWarning {
    return {
      id: row.id as string,
      studentId: row.student_id as string,
      tenantId: row.tenant_id as string,
      warningType: row.warning_type as WarningType,
      severity: row.severity as WarningSeverity,
      detectedAt: row.detected_at as string,
      acknowledgedAt: row.acknowledged_at as string | null,
      acknowledgedBy: row.acknowledged_by as string | null,
      resolvedAt: row.resolved_at as string | null,
      contextData: row.context_data as WarningContextData,
      recommendedActions: row.recommended_actions as RecommendedAction[],
      notificationSent: row.notification_sent as boolean,
      notificationSentAt: row.notification_sent_at as string | null,
      notificationChannels: row.notification_channels as string[],
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function detectWarnings(
  tenantId: string,
  studentId: string
): Promise<DetectionResult> {
  const service = new EarlyWarningService(tenantId);
  return service.detectWarnings(studentId);
}

export async function getUnresolvedWarnings(
  tenantId: string,
  studentId?: string
): Promise<EarlyWarning[]> {
  const service = new EarlyWarningService(tenantId);
  return service.getUnresolvedWarnings(studentId);
}

export async function acknowledgeWarning(
  tenantId: string,
  warningId: string,
  userId: string
): Promise<void> {
  const service = new EarlyWarningService(tenantId);
  return service.acknowledgeWarning(warningId, userId);
}

export async function resolveWarning(
  tenantId: string,
  warningId: string,
  userId: string,
  notes?: string
): Promise<void> {
  const service = new EarlyWarningService(tenantId);
  return service.resolveWarning(warningId, userId, notes);
}

export async function getWarningStats(tenantId: string): Promise<{
  total: number;
  bySeverity: Record<WarningSeverity, number>;
  byType: Record<WarningType, number>;
  unacknowledged: number;
}> {
  const service = new EarlyWarningService(tenantId);
  return service.getWarningStats();
}

// ============================================================================
// Warning Type Labels (Korean)
// ============================================================================

export const WARNING_TYPE_LABELS: Record<WarningType, string> = {
  completion_drop: "완수율 급락",
  streak_break: "연속 학습 위험",
  subject_struggle: "과목별 어려움",
  burnout_risk: "번아웃 위험",
  schedule_overload: "과부하",
  exam_unpreparedness: "시험 미준비",
};

export const SEVERITY_LABELS: Record<WarningSeverity, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  critical: "심각",
};

export const SEVERITY_COLORS: Record<WarningSeverity, string> = {
  low: "text-blue-600 bg-blue-50",
  medium: "text-yellow-600 bg-yellow-50",
  high: "text-orange-600 bg-orange-50",
  critical: "text-red-600 bg-red-50",
};
