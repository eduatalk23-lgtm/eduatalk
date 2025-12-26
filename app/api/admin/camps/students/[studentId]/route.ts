/**
 * 학생 캠프 통합 프로필 API
 * GET /api/admin/camps/students/[studentId]
 *
 * 특정 학생의 모든 캠프 참여 현황을 통합 조회합니다.
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CampParticipation = {
  campId: string;
  campName: string;
  campStatus: string;
  startDate: string | null;
  endDate: string | null;
  invitationStatus: string;
  planGroupId: string | null;
  planGroupStatus: string | null;
  stats: {
    attendanceRate: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    totalDays: number;
    planCompletionRate: number;
    completedPlans: number;
    totalPlans: number;
    totalStudyMinutes: number;
  };
  recentActivity: Array<{
    date: string;
    type: "attendance" | "plan";
    status: string;
    details?: string;
  }>;
  alerts: Array<{
    type: string;
    severity: string;
    message: string;
  }>;
};

export type StudentCampProfile = {
  studentId: string;
  studentName: string;
  participations: CampParticipation[];
  overallStats: {
    totalCamps: number;
    activeCamps: number;
    completedCamps: number;
    overallAttendanceRate: number;
    overallCompletionRate: number;
    totalStudyMinutes: number;
  };
  timeline: Array<{
    date: string;
    events: Array<{
      campId: string;
      campName: string;
      type: "attendance" | "plan_start" | "plan_complete";
      status?: string;
      time?: string;
      details?: string;
    }>;
  }>;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "consultant")) {
      return apiUnauthorized();
    }

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      return apiUnauthorized();
    }

    const { studentId } = await params;
    const supabase = await createSupabaseServerClient();
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // 1. 학생 정보 조회
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name")
      .eq("id", studentId)
      .eq("tenant_id", tenantContext.tenantId)
      .single();

    if (studentError || !student) {
      return apiSuccess<StudentCampProfile>({
        studentId,
        studentName: "알 수 없음",
        participations: [],
        overallStats: {
          totalCamps: 0,
          activeCamps: 0,
          completedCamps: 0,
          overallAttendanceRate: 0,
          overallCompletionRate: 0,
          totalStudyMinutes: 0,
        },
        timeline: [],
      });
    }

    // 2. 캠프 초대 조회
    const { data: invitations, error: invError } = await supabase
      .from("camp_invitations")
      .select(
        `
        id,
        camp_template_id,
        status,
        accepted_at,
        camp_templates (
          id,
          name,
          status,
          camp_start_date,
          camp_end_date
        )
      `
      )
      .eq("student_id", studentId);

    if (invError) throw new Error(`초대 조회 실패: ${invError.message}`);

    const acceptedInvitations = invitations?.filter((i) => i.status === "accepted") || [];

    if (acceptedInvitations.length === 0) {
      return apiSuccess<StudentCampProfile>({
        studentId,
        studentName: student.name,
        participations: [],
        overallStats: {
          totalCamps: 0,
          activeCamps: 0,
          completedCamps: 0,
          overallAttendanceRate: 0,
          overallCompletionRate: 0,
          totalStudyMinutes: 0,
        },
        timeline: [],
      });
    }

    const campIds = acceptedInvitations.map((i) => i.camp_template_id);

    // 3. 플랜 그룹 조회
    const { data: planGroups, error: pgError } = await supabase
      .from("plan_groups")
      .select("id, camp_template_id, status")
      .eq("student_id", studentId)
      .in("camp_template_id", campIds)
      .is("deleted_at", null);

    if (pgError) throw new Error(`플랜 그룹 조회 실패: ${pgError.message}`);

    // 4. 출석 기록 조회
    const { data: attendanceRecords, error: attError } = await supabase
      .from("attendance_records")
      .select("attendance_date, status, check_in_time")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantContext.tenantId)
      .order("attendance_date", { ascending: false });

    if (attError) throw new Error(`출석 기록 조회 실패: ${attError.message}`);

    // 5. 플랜 조회
    const planGroupIds = planGroups?.map((pg) => pg.id) || [];
    let plansData: Array<{
      id: string;
      plan_group_id: string;
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
          "id, plan_group_id, plan_date, status, started_at, completed_at, paused_duration_seconds"
        )
        .in("plan_group_id", planGroupIds)
        .order("plan_date", { ascending: false });

      if (plansError) throw new Error(`플랜 조회 실패: ${plansError.message}`);
      plansData = plans || [];
    }

    // 6. 캠프별 참여 정보 구성
    const participations: CampParticipation[] = [];

    for (const invitation of acceptedInvitations) {
      const campData = invitation.camp_templates as unknown as {
        id: string;
        name: string;
        status: string;
        camp_start_date: string | null;
        camp_end_date: string | null;
      } | null;

      if (!campData) continue;

      const planGroup = planGroups?.find(
        (pg) => pg.camp_template_id === campData.id
      );

      // 해당 캠프 기간 내 출석 기록 필터링
      const campAttendance = attendanceRecords?.filter((r) => {
        if (!campData.camp_start_date || !campData.camp_end_date) return false;
        return (
          r.attendance_date >= campData.camp_start_date &&
          r.attendance_date <= campData.camp_end_date
        );
      }) || [];

      // 해당 캠프 플랜 필터링
      const campPlans = planGroup
        ? plansData.filter((p) => p.plan_group_id === planGroup.id)
        : [];

      // 출석 통계
      const presentCount = campAttendance.filter((r) => r.status === "present").length;
      const lateCount = campAttendance.filter((r) => r.status === "late").length;
      const absentCount = campAttendance.filter((r) => r.status === "absent").length;
      const totalAttendanceDays = campAttendance.length;
      const attendanceRate =
        totalAttendanceDays > 0
          ? Math.round(((presentCount + lateCount) / totalAttendanceDays) * 100)
          : 0;

      // 플랜 통계
      const completedPlans = campPlans.filter((p) => p.status === "completed").length;
      const totalPlans = campPlans.length;
      const planCompletionRate =
        totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

      // 학습 시간 계산
      let totalStudySeconds = 0;
      campPlans.forEach((plan) => {
        if (plan.started_at) {
          const startTime = new Date(plan.started_at).getTime();
          const endTime = plan.completed_at
            ? new Date(plan.completed_at).getTime()
            : Date.now();
          const pausedMs = (plan.paused_duration_seconds || 0) * 1000;
          totalStudySeconds += Math.max(0, (endTime - startTime - pausedMs) / 1000);
        }
      });

      // 최근 활동
      const recentActivity: CampParticipation["recentActivity"] = [];

      // 최근 출석 5개
      campAttendance.slice(0, 5).forEach((r) => {
        recentActivity.push({
          date: r.attendance_date,
          type: "attendance",
          status: r.status,
          details: r.check_in_time || undefined,
        });
      });

      // 최근 플랜 5개
      campPlans.slice(0, 5).forEach((p) => {
        recentActivity.push({
          date: p.plan_date,
          type: "plan",
          status: p.status,
        });
      });

      // 날짜순 정렬
      recentActivity.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // 알림 생성
      const alerts: CampParticipation["alerts"] = [];

      // 연속 결석 체크
      let consecutiveAbsent = 0;
      for (const r of campAttendance) {
        if (r.status === "absent") consecutiveAbsent++;
        else break;
      }
      if (consecutiveAbsent >= 2) {
        alerts.push({
          type: "consecutive_absent",
          severity: "critical",
          message: `${consecutiveAbsent}일 연속 결석`,
        });
      }

      // 낮은 완료율 체크
      if (totalPlans >= 3 && planCompletionRate < 50) {
        alerts.push({
          type: "low_completion",
          severity: "warning",
          message: `플랜 완료율 ${planCompletionRate}%`,
        });
      }

      participations.push({
        campId: campData.id,
        campName: campData.name,
        campStatus: campData.status,
        startDate: campData.camp_start_date,
        endDate: campData.camp_end_date,
        invitationStatus: invitation.status,
        planGroupId: planGroup?.id || null,
        planGroupStatus: planGroup?.status || null,
        stats: {
          attendanceRate,
          presentCount,
          lateCount,
          absentCount,
          totalDays: totalAttendanceDays,
          planCompletionRate,
          completedPlans,
          totalPlans,
          totalStudyMinutes: Math.round(totalStudySeconds / 60),
        },
        recentActivity: recentActivity.slice(0, 10),
        alerts,
      });
    }

    // 7. 전체 통계 계산
    const activeCamps = participations.filter(
      (p) => p.campStatus === "active"
    ).length;
    const completedCamps = participations.filter(
      (p) => p.campStatus === "archived" || (p.endDate && p.endDate < today)
    ).length;

    let totalAttendance = 0;
    let totalAttendanceDays = 0;
    let totalCompleted = 0;
    let totalPlanCount = 0;
    let totalStudyMinutes = 0;

    participations.forEach((p) => {
      totalAttendance += p.stats.presentCount + p.stats.lateCount;
      totalAttendanceDays += p.stats.totalDays;
      totalCompleted += p.stats.completedPlans;
      totalPlanCount += p.stats.totalPlans;
      totalStudyMinutes += p.stats.totalStudyMinutes;
    });

    const overallAttendanceRate =
      totalAttendanceDays > 0
        ? Math.round((totalAttendance / totalAttendanceDays) * 100)
        : 0;
    const overallCompletionRate =
      totalPlanCount > 0
        ? Math.round((totalCompleted / totalPlanCount) * 100)
        : 0;

    // 8. 타임라인 구성 (최근 14일)
    const timelineMap = new Map<
      string,
      Array<{
        campId: string;
        campName: string;
        type: "attendance" | "plan_start" | "plan_complete";
        status?: string;
        time?: string;
        details?: string;
      }>
    >();

    // 출석 이벤트 추가
    attendanceRecords?.slice(0, 30).forEach((r) => {
      const events = timelineMap.get(r.attendance_date) || [];

      // 해당 날짜의 캠프 찾기
      const participation = participations.find((p) => {
        if (!p.startDate || !p.endDate) return false;
        return r.attendance_date >= p.startDate && r.attendance_date <= p.endDate;
      });

      if (participation) {
        events.push({
          campId: participation.campId,
          campName: participation.campName,
          type: "attendance",
          status: r.status,
          time: r.check_in_time || undefined,
        });
        timelineMap.set(r.attendance_date, events);
      }
    });

    // 플랜 이벤트 추가
    plansData.slice(0, 30).forEach((p) => {
      const events = timelineMap.get(p.plan_date) || [];
      const planGroup = planGroups?.find((pg) => pg.id === p.plan_group_id);
      const participation = participations.find(
        (part) => part.planGroupId === p.plan_group_id
      );

      if (participation) {
        if (p.started_at) {
          events.push({
            campId: participation.campId,
            campName: participation.campName,
            type: "plan_start",
            time: p.started_at,
          });
        }
        if (p.completed_at) {
          events.push({
            campId: participation.campId,
            campName: participation.campName,
            type: "plan_complete",
            time: p.completed_at,
          });
        }
        timelineMap.set(p.plan_date, events);
      }
    });

    const timeline = Array.from(timelineMap.entries())
      .map(([date, events]) => ({ date, events }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 14);

    return apiSuccess<StudentCampProfile>({
      studentId,
      studentName: student.name,
      participations,
      overallStats: {
        totalCamps: participations.length,
        activeCamps,
        completedCamps,
        overallAttendanceRate,
        overallCompletionRate,
        totalStudyMinutes,
      },
      timeline,
    });
  } catch (error) {
    return handleApiError(error, "[api/admin/camps/students] 오류");
  }
}
