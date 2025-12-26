/**
 * 캠프 이상 징후 감지 API
 * GET /api/admin/camps/alerts?campIds=id1,id2
 *
 * 다중 캠프에서 주의가 필요한 학생들을 감지합니다.
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertCategory = "attendance" | "learning" | "progress";

export type StudentAlert = {
  id: string;
  studentId: string;
  studentName: string;
  campId: string;
  campName: string;
  category: AlertCategory;
  severity: AlertSeverity;
  type: string;
  title: string;
  description: string;
  value: number | string;
  threshold: number | string;
  detectedAt: string;
  metadata?: Record<string, unknown>;
};

export type AlertSummary = {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byCategory: {
    attendance: number;
    learning: number;
    progress: number;
  };
};

export type CampAlertsResponse = {
  alerts: StudentAlert[];
  summary: AlertSummary;
};

// 이상 징후 감지 규칙
const ALERT_RULES = {
  // 출석 관련
  consecutiveAbsent: { threshold: 2, severity: "critical" as AlertSeverity },
  consecutiveLate: { threshold: 3, severity: "warning" as AlertSeverity },
  lowAttendanceRate: { threshold: 70, severity: "warning" as AlertSeverity },

  // 학습 관련
  noActivityDays: { threshold: 3, severity: "critical" as AlertSeverity },
  longPause: { threshold: 30, severity: "warning" as AlertSeverity }, // 분
  lowCompletionRate: { threshold: 50, severity: "warning" as AlertSeverity },

  // 진행 관련
  completionRateDrop: { threshold: 30, severity: "critical" as AlertSeverity }, // % 하락
  belowAverageStudyTime: { threshold: 50, severity: "info" as AlertSeverity }, // 평균 대비 %
};

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "consultant")) {
      return apiUnauthorized();
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      return apiUnauthorized();
    }

    const { searchParams } = new URL(request.url);
    const campIdsParam = searchParams.get("campIds");

    if (!campIdsParam) {
      return apiBadRequest("campIds 파라미터가 필요합니다.");
    }

    const campIds = campIdsParam.split(",").filter(Boolean);
    if (campIds.length === 0) {
      return apiBadRequest("하나 이상의 캠프를 선택해주세요.");
    }

    const supabase = await createSupabaseServerClient();
    const alerts: StudentAlert[] = [];
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // 1. 캠프 정보 조회
    const { data: camps, error: campsError } = await supabase
      .from("camp_templates")
      .select("id, name, camp_start_date, camp_end_date")
      .in("id", campIds)
      .eq("tenant_id", tenantContext.tenantId);

    if (campsError) throw new Error(`캠프 조회 실패: ${campsError.message}`);
    if (!camps || camps.length === 0) {
      return apiSuccess<CampAlertsResponse>({
        alerts: [],
        summary: {
          total: 0,
          critical: 0,
          warning: 0,
          info: 0,
          byCategory: { attendance: 0, learning: 0, progress: 0 },
        },
      });
    }

    // 2. 참여자 조회
    const { data: invitations, error: invError } = await supabase
      .from("camp_invitations")
      .select("id, camp_template_id, student_id, student_name")
      .in("camp_template_id", campIds)
      .eq("status", "accepted");

    if (invError) throw new Error(`초대 조회 실패: ${invError.message}`);
    if (!invitations || invitations.length === 0) {
      return apiSuccess<CampAlertsResponse>({
        alerts: [],
        summary: {
          total: 0,
          critical: 0,
          warning: 0,
          info: 0,
          byCategory: { attendance: 0, learning: 0, progress: 0 },
        },
      });
    }

    const studentIds = invitations.map((i) => i.student_id);

    // 3. 최근 7일 출석 기록 조회
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: attendanceRecords, error: attError } = await supabase
      .from("attendance_records")
      .select("student_id, attendance_date, status")
      .in("student_id", studentIds)
      .eq("tenant_id", tenantContext.tenantId)
      .gte("attendance_date", sevenDaysAgo.toISOString().split("T")[0])
      .lte("attendance_date", today)
      .order("attendance_date", { ascending: false });

    if (attError) throw new Error(`출석 기록 조회 실패: ${attError.message}`);

    // 4. 플랜 그룹 및 플랜 조회
    const { data: planGroups, error: pgError } = await supabase
      .from("plan_groups")
      .select("id, student_id, camp_template_id, status")
      .in("camp_template_id", campIds)
      .is("deleted_at", null);

    if (pgError) throw new Error(`플랜 그룹 조회 실패: ${pgError.message}`);

    const planGroupIds = planGroups?.map((pg) => pg.id) || [];

    let plansData: Array<{
      id: string;
      plan_group_id: string;
      student_id: string;
      plan_date: string;
      status: string;
      started_at: string | null;
      completed_at: string | null;
      paused_duration_seconds: number | null;
    }> = [];

    if (planGroupIds.length > 0) {
      const { data: plans, error: plansError } = await supabase
        .from("student_plan")
        .select(
          "id, plan_group_id, student_id, plan_date, status, started_at, completed_at, paused_duration_seconds"
        )
        .in("plan_group_id", planGroupIds)
        .gte("plan_date", sevenDaysAgo.toISOString().split("T")[0])
        .lte("plan_date", today);

      if (plansError) throw new Error(`플랜 조회 실패: ${plansError.message}`);
      plansData = plans || [];
    }

    // 5. 학생별 이상 징후 분석
    for (const invitation of invitations) {
      const camp = camps.find((c) => c.id === invitation.camp_template_id);
      if (!camp) continue;

      const studentAttendance = attendanceRecords?.filter(
        (r) => r.student_id === invitation.student_id
      ) || [];

      const studentPlans = plansData.filter(
        (p) => p.student_id === invitation.student_id
      );

      // === 출석 관련 이상 징후 ===

      // 연속 결석 체크
      const sortedAttendance = [...studentAttendance].sort(
        (a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime()
      );

      let consecutiveAbsent = 0;
      for (const record of sortedAttendance) {
        if (record.status === "absent") {
          consecutiveAbsent++;
        } else {
          break;
        }
      }

      if (consecutiveAbsent >= ALERT_RULES.consecutiveAbsent.threshold) {
        alerts.push({
          id: `${invitation.student_id}-consecutive-absent`,
          studentId: invitation.student_id,
          studentName: invitation.student_name || "알 수 없음",
          campId: camp.id,
          campName: camp.name,
          category: "attendance",
          severity: ALERT_RULES.consecutiveAbsent.severity,
          type: "consecutive_absent",
          title: "연속 결석",
          description: `${consecutiveAbsent}일 연속 결석 중입니다.`,
          value: consecutiveAbsent,
          threshold: ALERT_RULES.consecutiveAbsent.threshold,
          detectedAt: now.toISOString(),
        });
      }

      // 연속 지각 체크
      let consecutiveLate = 0;
      for (const record of sortedAttendance) {
        if (record.status === "late") {
          consecutiveLate++;
        } else if (record.status !== "absent") {
          break;
        }
      }

      if (consecutiveLate >= ALERT_RULES.consecutiveLate.threshold) {
        alerts.push({
          id: `${invitation.student_id}-consecutive-late`,
          studentId: invitation.student_id,
          studentName: invitation.student_name || "알 수 없음",
          campId: camp.id,
          campName: camp.name,
          category: "attendance",
          severity: ALERT_RULES.consecutiveLate.severity,
          type: "consecutive_late",
          title: "연속 지각",
          description: `${consecutiveLate}일 연속 지각 중입니다.`,
          value: consecutiveLate,
          threshold: ALERT_RULES.consecutiveLate.threshold,
          detectedAt: now.toISOString(),
        });
      }

      // 낮은 출석률 체크
      if (studentAttendance.length >= 5) {
        const presentCount = studentAttendance.filter(
          (r) => r.status === "present" || r.status === "late"
        ).length;
        const attendanceRate = (presentCount / studentAttendance.length) * 100;

        if (attendanceRate < ALERT_RULES.lowAttendanceRate.threshold) {
          alerts.push({
            id: `${invitation.student_id}-low-attendance`,
            studentId: invitation.student_id,
            studentName: invitation.student_name || "알 수 없음",
            campId: camp.id,
            campName: camp.name,
            category: "attendance",
            severity: ALERT_RULES.lowAttendanceRate.severity,
            type: "low_attendance_rate",
            title: "낮은 출석률",
            description: `최근 7일 출석률이 ${Math.round(attendanceRate)}%입니다.`,
            value: Math.round(attendanceRate),
            threshold: ALERT_RULES.lowAttendanceRate.threshold,
            detectedAt: now.toISOString(),
          });
        }
      }

      // === 학습 관련 이상 징후 ===

      // 학습 활동 없음 체크
      const recentPlansWithActivity = studentPlans.filter((p) => p.started_at);
      const daysWithActivity = new Set(
        recentPlansWithActivity.map((p) => p.plan_date)
      ).size;

      const daysSinceLastActivity = (() => {
        if (recentPlansWithActivity.length === 0) return 7;
        const lastActivityDate = recentPlansWithActivity
          .map((p) => p.started_at!)
          .sort()
          .reverse()[0];
        const diffMs = now.getTime() - new Date(lastActivityDate).getTime();
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      })();

      if (daysSinceLastActivity >= ALERT_RULES.noActivityDays.threshold) {
        alerts.push({
          id: `${invitation.student_id}-no-activity`,
          studentId: invitation.student_id,
          studentName: invitation.student_name || "알 수 없음",
          campId: camp.id,
          campName: camp.name,
          category: "learning",
          severity: ALERT_RULES.noActivityDays.severity,
          type: "no_activity",
          title: "학습 활동 없음",
          description: `${daysSinceLastActivity}일간 학습 활동이 없습니다.`,
          value: daysSinceLastActivity,
          threshold: ALERT_RULES.noActivityDays.threshold,
          detectedAt: now.toISOString(),
        });
      }

      // 낮은 플랜 완료율 체크
      if (studentPlans.length >= 3) {
        const completedPlans = studentPlans.filter(
          (p) => p.status === "completed"
        ).length;
        const completionRate = (completedPlans / studentPlans.length) * 100;

        if (completionRate < ALERT_RULES.lowCompletionRate.threshold) {
          alerts.push({
            id: `${invitation.student_id}-low-completion`,
            studentId: invitation.student_id,
            studentName: invitation.student_name || "알 수 없음",
            campId: camp.id,
            campName: camp.name,
            category: "progress",
            severity: ALERT_RULES.lowCompletionRate.severity,
            type: "low_completion_rate",
            title: "낮은 플랜 완료율",
            description: `최근 플랜 완료율이 ${Math.round(completionRate)}%입니다.`,
            value: Math.round(completionRate),
            threshold: ALERT_RULES.lowCompletionRate.threshold,
            detectedAt: now.toISOString(),
          });
        }
      }

      // 장시간 일시정지 체크
      const pausedPlans = studentPlans.filter(
        (p) =>
          p.status === "paused" ||
          (p.started_at && !p.completed_at && p.paused_duration_seconds)
      );

      for (const plan of pausedPlans) {
        const pausedMinutes = Math.floor(
          (plan.paused_duration_seconds || 0) / 60
        );
        if (pausedMinutes >= ALERT_RULES.longPause.threshold) {
          alerts.push({
            id: `${invitation.student_id}-long-pause-${plan.id}`,
            studentId: invitation.student_id,
            studentName: invitation.student_name || "알 수 없음",
            campId: camp.id,
            campName: camp.name,
            category: "learning",
            severity: ALERT_RULES.longPause.severity,
            type: "long_pause",
            title: "장시간 일시정지",
            description: `플랜이 ${pausedMinutes}분간 일시정지 상태입니다.`,
            value: pausedMinutes,
            threshold: ALERT_RULES.longPause.threshold,
            detectedAt: now.toISOString(),
            metadata: { planId: plan.id, planDate: plan.plan_date },
          });
          break; // 학생당 하나만 표시
        }
      }
    }

    // 6. 요약 통계 계산
    const summary: AlertSummary = {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      info: alerts.filter((a) => a.severity === "info").length,
      byCategory: {
        attendance: alerts.filter((a) => a.category === "attendance").length,
        learning: alerts.filter((a) => a.category === "learning").length,
        progress: alerts.filter((a) => a.category === "progress").length,
      },
    };

    // 심각도 순으로 정렬
    alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return apiSuccess<CampAlertsResponse>({ alerts, summary });
  } catch (error) {
    return handleApiError(error, "[api/admin/camps/alerts] 오류");
  }
}
