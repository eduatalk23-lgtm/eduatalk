/**
 * 캠프 실시간 모니터링 API
 * GET /api/admin/camps/live?campIds=id1,id2
 *
 * 선택된 캠프들의 현재 실시간 학습 상태를 조회합니다.
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

export type LiveStudentStatus = {
  studentId: string;
  studentName: string;
  campId: string;
  campName: string;
  planId: string;
  planDate: string;
  status: "in_progress" | "paused" | "completed" | "not_started";
  contentTitle: string;
  startedAt: string | null;
  elapsedMinutes: number;
  pausedMinutes: number;
  lastActivityAt: string | null;
  progressPercent: number;
};

export type CampLiveStats = {
  campId: string;
  campName: string;
  totalParticipants: number;
  activeNow: number;
  pausedNow: number;
  completedToday: number;
  notStarted: number;
};

export type LiveMonitoringResponse = {
  timestamp: string;
  students: LiveStudentStatus[];
  campStats: CampLiveStats[];
  summary: {
    totalActive: number;
    totalPaused: number;
    totalCompleted: number;
    totalNotStarted: number;
  };
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
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // 1. 캠프 정보 조회
    const { data: camps, error: campsError } = await supabase
      .from("camp_templates")
      .select("id, name")
      .in("id", campIds)
      .eq("tenant_id", tenantContext.tenantId);

    if (campsError) throw new Error(`캠프 조회 실패: ${campsError.message}`);
    if (!camps || camps.length === 0) {
      return apiSuccess<LiveMonitoringResponse>({
        timestamp: now.toISOString(),
        students: [],
        campStats: [],
        summary: {
          totalActive: 0,
          totalPaused: 0,
          totalCompleted: 0,
          totalNotStarted: 0,
        },
      });
    }

    const campMap = new Map(camps.map((c) => [c.id, c.name]));

    // 2. 참여자 조회
    const { data: invitations, error: invError } = await supabase
      .from("camp_invitations")
      .select("student_id, student_name, camp_template_id")
      .in("camp_template_id", campIds)
      .eq("status", "accepted");

    if (invError) throw new Error(`초대 조회 실패: ${invError.message}`);
    if (!invitations || invitations.length === 0) {
      return apiSuccess<LiveMonitoringResponse>({
        timestamp: now.toISOString(),
        students: [],
        campStats: camps.map((c) => ({
          campId: c.id,
          campName: c.name,
          totalParticipants: 0,
          activeNow: 0,
          pausedNow: 0,
          completedToday: 0,
          notStarted: 0,
        })),
        summary: {
          totalActive: 0,
          totalPaused: 0,
          totalCompleted: 0,
          totalNotStarted: 0,
        },
      });
    }

    const studentIds = invitations.map((i) => i.student_id);

    // 3. 플랜 그룹 조회
    const { data: planGroups, error: pgError } = await supabase
      .from("plan_groups")
      .select("id, student_id, camp_template_id")
      .in("camp_template_id", campIds)
      .is("deleted_at", null);

    if (pgError) throw new Error(`플랜 그룹 조회 실패: ${pgError.message}`);

    const planGroupIds = planGroups?.map((pg) => pg.id) || [];

    // 4. 오늘 날짜의 플랜 조회
    let plansData: Array<{
      id: string;
      plan_group_id: string;
      student_id: string;
      plan_date: string;
      status: string;
      started_at: string | null;
      completed_at: string | null;
      paused_duration_seconds: number | null;
      master_contents: { title: string } | null;
      subjects: { name: string } | null;
    }> = [];

    if (planGroupIds.length > 0) {
      const { data: plans, error: plansError } = await supabase
        .from("student_plan")
        .select(
          `
          id,
          plan_group_id,
          student_id,
          plan_date,
          status,
          started_at,
          completed_at,
          paused_duration_seconds,
          master_contents (title),
          subjects (name)
        `
        )
        .in("plan_group_id", planGroupIds)
        .eq("plan_date", today);

      if (plansError) throw new Error(`플랜 조회 실패: ${plansError.message}`);
      plansData = (plans || []).map((p) => ({
        ...p,
        master_contents: p.master_contents as unknown as { title: string } | null,
        subjects: p.subjects as unknown as { name: string } | null,
      }));
    }

    // 5. 학생별 실시간 상태 구성
    const students: LiveStudentStatus[] = [];
    const campStatsMap = new Map<
      string,
      { active: number; paused: number; completed: number; notStarted: number; total: number }
    >();

    // 캠프별 초기화
    camps.forEach((camp) => {
      campStatsMap.set(camp.id, {
        active: 0,
        paused: 0,
        completed: 0,
        notStarted: 0,
        total: 0,
      });
    });

    // 학생별 처리
    for (const invitation of invitations) {
      const studentCampStats = campStatsMap.get(invitation.camp_template_id);
      if (studentCampStats) {
        studentCampStats.total++;
      }

      const planGroup = planGroups?.find(
        (pg) =>
          pg.student_id === invitation.student_id &&
          pg.camp_template_id === invitation.camp_template_id
      );

      if (!planGroup) {
        if (studentCampStats) studentCampStats.notStarted++;
        continue;
      }

      const studentPlans = plansData.filter(
        (p) =>
          p.student_id === invitation.student_id &&
          p.plan_group_id === planGroup.id
      );

      if (studentPlans.length === 0) {
        if (studentCampStats) studentCampStats.notStarted++;
        continue;
      }

      // 가장 최근 활동 중인 플랜 찾기
      const activePlan = studentPlans.find(
        (p) => p.status === "in_progress" || p.status === "paused"
      );
      const completedPlan = studentPlans.find((p) => p.status === "completed");
      const currentPlan = activePlan || completedPlan || studentPlans[0];

      let status: LiveStudentStatus["status"] = "not_started";
      let elapsedMinutes = 0;
      let pausedMinutes = 0;

      if (currentPlan.status === "in_progress") {
        status = "in_progress";
        if (studentCampStats) studentCampStats.active++;

        if (currentPlan.started_at) {
          const startTime = new Date(currentPlan.started_at).getTime();
          const pausedMs = (currentPlan.paused_duration_seconds || 0) * 1000;
          elapsedMinutes = Math.floor((now.getTime() - startTime - pausedMs) / 60000);
        }
      } else if (currentPlan.status === "paused") {
        status = "paused";
        if (studentCampStats) studentCampStats.paused++;

        if (currentPlan.started_at) {
          const startTime = new Date(currentPlan.started_at).getTime();
          const pausedMs = (currentPlan.paused_duration_seconds || 0) * 1000;
          elapsedMinutes = Math.floor((now.getTime() - startTime - pausedMs) / 60000);
          pausedMinutes = Math.floor(pausedMs / 60000);
        }
      } else if (currentPlan.status === "completed") {
        status = "completed";
        if (studentCampStats) studentCampStats.completed++;

        if (currentPlan.started_at && currentPlan.completed_at) {
          const startTime = new Date(currentPlan.started_at).getTime();
          const endTime = new Date(currentPlan.completed_at).getTime();
          const pausedMs = (currentPlan.paused_duration_seconds || 0) * 1000;
          elapsedMinutes = Math.floor((endTime - startTime - pausedMs) / 60000);
        }
      } else {
        if (studentCampStats) studentCampStats.notStarted++;
      }

      const contentTitle =
        currentPlan.master_contents?.title ||
        currentPlan.subjects?.name ||
        "콘텐츠 없음";

      // 진행률 계산 (완료된 플랜 수 / 전체 플랜 수)
      const completedCount = studentPlans.filter(
        (p) => p.status === "completed"
      ).length;
      const progressPercent =
        studentPlans.length > 0
          ? Math.round((completedCount / studentPlans.length) * 100)
          : 0;

      students.push({
        studentId: invitation.student_id,
        studentName: invitation.student_name || "알 수 없음",
        campId: invitation.camp_template_id,
        campName: campMap.get(invitation.camp_template_id) || "알 수 없음",
        planId: currentPlan.id,
        planDate: currentPlan.plan_date,
        status,
        contentTitle,
        startedAt: currentPlan.started_at,
        elapsedMinutes: Math.max(0, elapsedMinutes),
        pausedMinutes: Math.max(0, pausedMinutes),
        lastActivityAt: currentPlan.completed_at || currentPlan.started_at,
        progressPercent,
      });
    }

    // 6. 캠프 통계 구성
    const campStats: CampLiveStats[] = camps.map((camp) => {
      const stats = campStatsMap.get(camp.id) || {
        active: 0,
        paused: 0,
        completed: 0,
        notStarted: 0,
        total: 0,
      };

      return {
        campId: camp.id,
        campName: camp.name,
        totalParticipants: stats.total,
        activeNow: stats.active,
        pausedNow: stats.paused,
        completedToday: stats.completed,
        notStarted: stats.notStarted,
      };
    });

    // 7. 요약 계산
    const summary = {
      totalActive: students.filter((s) => s.status === "in_progress").length,
      totalPaused: students.filter((s) => s.status === "paused").length,
      totalCompleted: students.filter((s) => s.status === "completed").length,
      totalNotStarted: students.filter((s) => s.status === "not_started").length,
    };

    // 활성 → 일시정지 → 미시작 → 완료 순으로 정렬
    students.sort((a, b) => {
      const statusOrder = { in_progress: 0, paused: 1, not_started: 2, completed: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });

    return apiSuccess<LiveMonitoringResponse>({
      timestamp: now.toISOString(),
      students,
      campStats,
      summary,
    });
  } catch (error) {
    return handleApiError(error, "[api/admin/camps/live] 오류");
  }
}
