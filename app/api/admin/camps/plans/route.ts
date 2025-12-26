/**
 * 멀티 캠프 플랜 진행 현황 API
 * GET /api/admin/camps/plans?campIds=id1,id2&date=2025-01-21
 *
 * 다중 캠프의 통합 플랜 진행 현황을 조회합니다.
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

export type PlanStatus = "not_started" | "in_progress" | "paused" | "completed";

export type PlanDetail = {
  planId: string;
  planDate: string;
  status: PlanStatus;
  startedAt: string | null;
  completedAt: string | null;
  pausedDuration: number; // seconds
  totalStudyTime: number; // seconds
  contentTitle: string | null;
  subjectName: string | null;
};

export type StudentPlanProgress = {
  studentId: string;
  studentName: string;
  campId: string;
  campName: string;
  planGroupId: string;
  planGroupStatus: string;
  plans: PlanDetail[];
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    completionRate: number;
    totalStudyTime: number; // seconds
  };
};

export type DailyPlanEvent = {
  time: string;
  type: "start" | "complete" | "pause" | "resume";
  studentId: string;
  studentName: string;
  campId: string;
  campName: string;
  planId: string;
  contentTitle: string | null;
  studyDuration?: number; // for complete type
};

export type MultiCampPlansStats = {
  camps: Array<{
    id: string;
    name: string;
    campStartDate: string | null;
    campEndDate: string | null;
    totalParticipants: number;
    planCompletionRate: number;
    totalStudyMinutes: number;
    averageStudyMinutesPerParticipant: number;
  }>;
  summary: {
    totalCamps: number;
    totalParticipants: number;
    totalPlans: number;
    completedPlans: number;
    inProgressPlans: number;
    notStartedPlans: number;
    overallCompletionRate: number;
    totalStudyMinutes: number;
  };
  students: StudentPlanProgress[];
  dailyTimeline: DailyPlanEvent[];
  dailyStats: Array<{
    date: string;
    camps: Array<{
      campId: string;
      campName: string;
      totalPlans: number;
      completed: number;
      inProgress: number;
      notStarted: number;
    }>;
  }>;
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
    const targetDate = searchParams.get("date"); // 특정 날짜 조회 시
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!campIdsParam) {
      return apiBadRequest("campIds 파라미터가 필요합니다.");
    }

    const campIds = campIdsParam.split(",").filter(Boolean);
    if (campIds.length === 0) {
      return apiBadRequest("하나 이상의 캠프를 선택해주세요.");
    }

    const supabase = await createSupabaseServerClient();

    // 1. 캠프 템플릿 정보 조회
    const { data: camps, error: campsError } = await supabase
      .from("camp_templates")
      .select("id, name, camp_start_date, camp_end_date, tenant_id")
      .in("id", campIds)
      .eq("tenant_id", tenantContext.tenantId);

    if (campsError) {
      throw new Error(`캠프 조회 실패: ${campsError.message}`);
    }

    if (!camps || camps.length === 0) {
      return apiSuccess<MultiCampPlansStats>({
        camps: [],
        summary: {
          totalCamps: 0,
          totalParticipants: 0,
          totalPlans: 0,
          completedPlans: 0,
          inProgressPlans: 0,
          notStartedPlans: 0,
          overallCompletionRate: 0,
          totalStudyMinutes: 0,
        },
        students: [],
        dailyTimeline: [],
        dailyStats: [],
      });
    }

    // 2. 각 캠프의 참여자(accepted 상태) 및 플랜 그룹 조회
    const { data: invitations, error: invError } = await supabase
      .from("camp_invitations")
      .select(
        `
        id,
        camp_template_id,
        student_id,
        student_name,
        status,
        plan_groups!camp_invitations_plan_group_id_fkey (
          id,
          status,
          student_id,
          camp_template_id
        )
      `
      )
      .in("camp_template_id", campIds)
      .eq("status", "accepted");

    if (invError) {
      throw new Error(`초대 조회 실패: ${invError.message}`);
    }

    // 3. 날짜 범위 결정
    let queryStartDate = startDate || targetDate;
    let queryEndDate = endDate || targetDate;

    if (!queryStartDate || !queryEndDate) {
      const allDates = camps
        .filter((c) => c.camp_start_date && c.camp_end_date)
        .flatMap((c) => [c.camp_start_date!, c.camp_end_date!]);

      if (allDates.length > 0) {
        queryStartDate = queryStartDate || allDates.sort()[0];
        queryEndDate = queryEndDate || allDates.sort().reverse()[0];
      }
    }

    // 4. 플랜 그룹 ID 수집
    const planGroupIds: string[] = [];
    const groupToCamp = new Map<string, string>();
    const groupToStudent = new Map<
      string,
      { studentId: string; studentName: string }
    >();

    invitations?.forEach((inv) => {
      const planGroups = inv.plan_groups as
        | Array<{
            id: string;
            status: string;
            student_id: string;
            camp_template_id: string;
          }>
        | null;
      if (planGroups && planGroups.length > 0) {
        planGroups.forEach((pg) => {
          planGroupIds.push(pg.id);
          groupToCamp.set(pg.id, inv.camp_template_id);
          groupToStudent.set(pg.id, {
            studentId: inv.student_id,
            studentName: inv.student_name || "알 수 없음",
          });
        });
      }
    });

    if (planGroupIds.length === 0) {
      return apiSuccess<MultiCampPlansStats>({
        camps: camps.map((c) => ({
          id: c.id,
          name: c.name,
          campStartDate: c.camp_start_date,
          campEndDate: c.camp_end_date,
          totalParticipants:
            invitations?.filter((i) => i.camp_template_id === c.id).length || 0,
          planCompletionRate: 0,
          totalStudyMinutes: 0,
          averageStudyMinutesPerParticipant: 0,
        })),
        summary: {
          totalCamps: camps.length,
          totalParticipants: invitations?.length || 0,
          totalPlans: 0,
          completedPlans: 0,
          inProgressPlans: 0,
          notStartedPlans: 0,
          overallCompletionRate: 0,
          totalStudyMinutes: 0,
        },
        students: [],
        dailyTimeline: [],
        dailyStats: [],
      });
    }

    // 5. 플랜 조회
    let plansQuery = supabase
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
        subject_id,
        master_content_id,
        subjects (
          name
        ),
        master_contents (
          title
        )
      `
      )
      .in("plan_group_id", planGroupIds);

    if (queryStartDate && queryEndDate) {
      plansQuery = plansQuery
        .gte("plan_date", queryStartDate)
        .lte("plan_date", queryEndDate);
    }

    const { data: plans, error: plansError } = await plansQuery.order(
      "plan_date",
      { ascending: true }
    );

    if (plansError) {
      throw new Error(`플랜 조회 실패: ${plansError.message}`);
    }

    // 6. 학생별 플랜 데이터 처리
    const studentPlansMap = new Map<string, StudentPlanProgress>();

    plans?.forEach((plan) => {
      const campId = groupToCamp.get(plan.plan_group_id) || "";
      const camp = camps.find((c) => c.id === campId);
      const studentInfo = groupToStudent.get(plan.plan_group_id);

      if (!studentInfo || !camp) return;

      const key = `${studentInfo.studentId}-${campId}`;

      if (!studentPlansMap.has(key)) {
        // 플랜 그룹 상태 가져오기
        const inv = invitations?.find(
          (i) =>
            i.student_id === studentInfo.studentId &&
            i.camp_template_id === campId
        );
        const planGroups = inv?.plan_groups as
          | Array<{ id: string; status: string }>
          | null;
        const planGroup = planGroups?.find(
          (pg) => pg.id === plan.plan_group_id
        );

        studentPlansMap.set(key, {
          studentId: studentInfo.studentId,
          studentName: studentInfo.studentName,
          campId,
          campName: camp.name,
          planGroupId: plan.plan_group_id,
          planGroupStatus: planGroup?.status || "unknown",
          plans: [],
          summary: {
            total: 0,
            completed: 0,
            inProgress: 0,
            notStarted: 0,
            completionRate: 0,
            totalStudyTime: 0,
          },
        });
      }

      const studentProgress = studentPlansMap.get(key)!;

      // 플랜 상태 결정
      let planStatus: PlanStatus = "not_started";
      if (plan.status === "completed") {
        planStatus = "completed";
      } else if (plan.status === "paused") {
        planStatus = "paused";
      } else if (plan.started_at) {
        planStatus = "in_progress";
      }

      // 학습 시간 계산 (completed_at - started_at - paused_duration)
      let totalStudyTime = 0;
      if (plan.started_at) {
        const startTime = new Date(plan.started_at).getTime();
        const endTime = plan.completed_at
          ? new Date(plan.completed_at).getTime()
          : Date.now();
        const pausedMs = (plan.paused_duration_seconds || 0) * 1000;
        totalStudyTime = Math.max(0, Math.floor((endTime - startTime - pausedMs) / 1000));
      }

      // subjects와 master_contents는 단일 객체로 조인됨
      const subjectsData = plan.subjects as unknown as { name: string } | null;
      const masterContentsData = plan.master_contents as unknown as { title: string } | null;

      studentProgress.plans.push({
        planId: plan.id,
        planDate: plan.plan_date,
        status: planStatus,
        startedAt: plan.started_at,
        completedAt: plan.completed_at,
        pausedDuration: plan.paused_duration_seconds || 0,
        totalStudyTime,
        contentTitle: masterContentsData?.title || null,
        subjectName: subjectsData?.name || null,
      });

      // 요약 업데이트
      studentProgress.summary.total++;
      studentProgress.summary.totalStudyTime += totalStudyTime;
      switch (planStatus) {
        case "completed":
          studentProgress.summary.completed++;
          break;
        case "in_progress":
        case "paused":
          studentProgress.summary.inProgress++;
          break;
        case "not_started":
          studentProgress.summary.notStarted++;
          break;
      }
    });

    // 완료율 계산
    studentPlansMap.forEach((progress) => {
      if (progress.summary.total > 0) {
        progress.summary.completionRate =
          Math.round((progress.summary.completed / progress.summary.total) * 1000) /
          10;
      }
    });

    const students = Array.from(studentPlansMap.values());

    // 7. 캠프별 통계 집계
    const campStats = camps.map((camp) => {
      const campStudents = students.filter((s) => s.campId === camp.id);
      const totalParticipants = campStudents.length;
      let totalPlans = 0;
      let completedPlans = 0;
      let totalStudyTime = 0;

      campStudents.forEach((s) => {
        totalPlans += s.summary.total;
        completedPlans += s.summary.completed;
        totalStudyTime += s.summary.totalStudyTime;
      });

      return {
        id: camp.id,
        name: camp.name,
        campStartDate: camp.camp_start_date,
        campEndDate: camp.camp_end_date,
        totalParticipants,
        planCompletionRate:
          totalPlans > 0
            ? Math.round((completedPlans / totalPlans) * 1000) / 10
            : 0,
        totalStudyMinutes: Math.round(totalStudyTime / 60),
        averageStudyMinutesPerParticipant:
          totalParticipants > 0
            ? Math.round(totalStudyTime / 60 / totalParticipants)
            : 0,
      };
    });

    // 8. 전체 통계 집계
    let totalPlans = 0;
    let completedPlans = 0;
    let inProgressPlans = 0;
    let notStartedPlans = 0;
    let totalStudyTime = 0;

    students.forEach((s) => {
      totalPlans += s.summary.total;
      completedPlans += s.summary.completed;
      inProgressPlans += s.summary.inProgress;
      notStartedPlans += s.summary.notStarted;
      totalStudyTime += s.summary.totalStudyTime;
    });

    // 9. 일별 타임라인 생성 (특정 날짜 조회 시)
    const dailyTimeline: DailyPlanEvent[] = [];

    if (targetDate) {
      students.forEach((student) => {
        student.plans
          .filter((p) => p.planDate === targetDate)
          .forEach((plan) => {
            if (plan.startedAt) {
              dailyTimeline.push({
                time: plan.startedAt,
                type: "start",
                studentId: student.studentId,
                studentName: student.studentName,
                campId: student.campId,
                campName: student.campName,
                planId: plan.planId,
                contentTitle: plan.contentTitle,
              });
            }
            if (plan.completedAt) {
              dailyTimeline.push({
                time: plan.completedAt,
                type: "complete",
                studentId: student.studentId,
                studentName: student.studentName,
                campId: student.campId,
                campName: student.campName,
                planId: plan.planId,
                contentTitle: plan.contentTitle,
                studyDuration: plan.totalStudyTime,
              });
            }
          });
      });

      // 시간순 정렬
      dailyTimeline.sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      );
    }

    // 10. 날짜별 캠프 통계
    const dateStatsMap = new Map<
      string,
      Map<string, { totalPlans: number; completed: number; inProgress: number; notStarted: number }>
    >();

    students.forEach((student) => {
      student.plans.forEach((plan) => {
        const date = plan.planDate;
        if (!dateStatsMap.has(date)) {
          dateStatsMap.set(date, new Map());
        }
        const dayMap = dateStatsMap.get(date)!;

        if (!dayMap.has(student.campId)) {
          dayMap.set(student.campId, {
            totalPlans: 0,
            completed: 0,
            inProgress: 0,
            notStarted: 0,
          });
        }

        const campDayStats = dayMap.get(student.campId)!;
        campDayStats.totalPlans++;

        switch (plan.status) {
          case "completed":
            campDayStats.completed++;
            break;
          case "in_progress":
          case "paused":
            campDayStats.inProgress++;
            break;
          case "not_started":
            campDayStats.notStarted++;
            break;
        }
      });
    });

    const dailyStats = Array.from(dateStatsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayMap]) => ({
        date,
        camps: camps.map((camp) => {
          const stats = dayMap.get(camp.id) || {
            totalPlans: 0,
            completed: 0,
            inProgress: 0,
            notStarted: 0,
          };
          return {
            campId: camp.id,
            campName: camp.name,
            ...stats,
          };
        }),
      }));

    return apiSuccess<MultiCampPlansStats>({
      camps: campStats,
      summary: {
        totalCamps: camps.length,
        totalParticipants: new Set(students.map((s) => s.studentId)).size,
        totalPlans,
        completedPlans,
        inProgressPlans,
        notStartedPlans,
        overallCompletionRate:
          totalPlans > 0
            ? Math.round((completedPlans / totalPlans) * 1000) / 10
            : 0,
        totalStudyMinutes: Math.round(totalStudyTime / 60),
      },
      students,
      dailyTimeline,
      dailyStats,
    });
  } catch (error) {
    return handleApiError(error, "[api/admin/camps/plans] 오류");
  }
}
