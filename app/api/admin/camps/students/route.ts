/**
 * 캠프 학생 목록 API
 * GET /api/admin/camps/students
 *
 * 선택된 캠프들에 참여 중인 모든 학생 목록을 조회합니다.
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CampStudentSummary = {
  studentId: string;
  studentName: string;
  campCount: number;
  activeCampCount: number;
  overallAttendanceRate: number;
  overallCompletionRate: number;
  hasAlerts: boolean;
  alertCount: number;
  criticalAlertCount: number;
  camps: Array<{
    campId: string;
    campName: string;
    campStatus: string;
    attendanceRate: number;
    completionRate: number;
  }>;
};

export type CampStudentsListResponse = {
  students: CampStudentSummary[];
  total: number;
  summary: {
    totalStudents: number;
    studentsWithAlerts: number;
    studentsWithCriticalAlerts: number;
    avgAttendanceRate: number;
    avgCompletionRate: number;
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
    const searchQuery = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    const campIds = campIdsParam ? campIdsParam.split(",").filter(Boolean) : [];

    const supabase = await createSupabaseServerClient();
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // 1. 캠프 ID가 지정되지 않은 경우 활성 캠프 전체 조회
    let targetCampIds = campIds;

    if (targetCampIds.length === 0) {
      const { data: activeCamps } = await supabase
        .from("camp_templates")
        .select("id")
        .eq("tenant_id", tenantContext.tenantId)
        .eq("status", "active");

      targetCampIds = activeCamps?.map((c) => c.id) || [];
    }

    if (targetCampIds.length === 0) {
      return apiSuccess<CampStudentsListResponse>({
        students: [],
        total: 0,
        summary: {
          totalStudents: 0,
          studentsWithAlerts: 0,
          studentsWithCriticalAlerts: 0,
          avgAttendanceRate: 0,
          avgCompletionRate: 0,
        },
      });
    }

    // 2. 캠프 정보 조회
    const { data: camps } = await supabase
      .from("camp_templates")
      .select("id, name, status, camp_start_date, camp_end_date")
      .in("id", targetCampIds);

    const campMap = new Map(camps?.map((c) => [c.id, c]) || []);

    // 3. 초대된 학생 조회
    const { data: invitations } = await supabase
      .from("camp_invitations")
      .select(`
        id,
        student_id,
        camp_template_id,
        status,
        students (
          id,
          name
        )
      `)
      .in("camp_template_id", targetCampIds)
      .eq("status", "accepted");

    if (!invitations || invitations.length === 0) {
      return apiSuccess<CampStudentsListResponse>({
        students: [],
        total: 0,
        summary: {
          totalStudents: 0,
          studentsWithAlerts: 0,
          studentsWithCriticalAlerts: 0,
          avgAttendanceRate: 0,
          avgCompletionRate: 0,
        },
      });
    }

    // 학생별 초대 그룹화
    const studentInvitationsMap = new Map<
      string,
      { name: string; campIds: string[] }
    >();

    invitations.forEach((inv) => {
      const studentData = inv.students as unknown as { id: string; name: string } | null;
      if (!studentData) return;

      const existing = studentInvitationsMap.get(inv.student_id);
      if (existing) {
        existing.campIds.push(inv.camp_template_id);
      } else {
        studentInvitationsMap.set(inv.student_id, {
          name: studentData.name,
          campIds: [inv.camp_template_id],
        });
      }
    });

    const studentIds = Array.from(studentInvitationsMap.keys());

    // 검색어 필터링
    let filteredStudentIds = studentIds;
    if (searchQuery) {
      filteredStudentIds = studentIds.filter((id) => {
        const student = studentInvitationsMap.get(id);
        return student?.name.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    // 4. 플랜 그룹 조회
    const { data: planGroups } = await supabase
      .from("plan_groups")
      .select("id, student_id, camp_template_id, status")
      .in("student_id", filteredStudentIds)
      .in("camp_template_id", targetCampIds)
      .is("deleted_at", null);

    const planGroupMap = new Map<string, typeof planGroups>();
    planGroups?.forEach((pg) => {
      const key = `${pg.student_id}-${pg.camp_template_id}`;
      const existing = planGroupMap.get(key) || [];
      existing.push(pg);
      planGroupMap.set(key, existing);
    });

    // 5. 플랜 조회
    const planGroupIds = planGroups?.map((pg) => pg.id) || [];
    let plansData: Array<{
      plan_group_id: string;
      status: string;
    }> = [];

    if (planGroupIds.length > 0) {
      const { data: plans } = await supabase
        .from("student_plan")
        .select("plan_group_id, status")
        .in("plan_group_id", planGroupIds);
      plansData = plans || [];
    }

    // 6. 출석 기록 조회
    const { data: attendanceRecords } = await supabase
      .from("attendance_records")
      .select("student_id, attendance_date, status")
      .in("student_id", filteredStudentIds)
      .eq("tenant_id", tenantContext.tenantId);

    // 7. 학생별 통계 계산
    const students: CampStudentSummary[] = [];

    for (const studentId of filteredStudentIds) {
      const studentInfo = studentInvitationsMap.get(studentId);
      if (!studentInfo) continue;

      const studentCamps: CampStudentSummary["camps"] = [];
      let totalAttendance = 0;
      let totalAttendanceDays = 0;
      let totalCompleted = 0;
      let totalPlans = 0;
      let activeCampCount = 0;
      let alertCount = 0;
      let criticalAlertCount = 0;

      for (const campId of studentInfo.campIds) {
        const camp = campMap.get(campId);
        if (!camp) continue;

        if (camp.status === "active") activeCampCount++;

        // 출석 통계
        const campAttendance = attendanceRecords?.filter((r) => {
          if (r.student_id !== studentId) return false;
          if (!camp.camp_start_date || !camp.camp_end_date) return false;
          return (
            r.attendance_date >= camp.camp_start_date &&
            r.attendance_date <= camp.camp_end_date
          );
        }) || [];

        const presentCount = campAttendance.filter((r) =>
          r.status === "present" || r.status === "late"
        ).length;
        const attendanceRate =
          campAttendance.length > 0
            ? Math.round((presentCount / campAttendance.length) * 100)
            : 0;

        totalAttendance += presentCount;
        totalAttendanceDays += campAttendance.length;

        // 연속 결석 체크
        let consecutiveAbsent = 0;
        for (const r of campAttendance.sort(
          (a, b) =>
            new Date(b.attendance_date).getTime() -
            new Date(a.attendance_date).getTime()
        )) {
          if (r.status === "absent") consecutiveAbsent++;
          else break;
        }
        if (consecutiveAbsent >= 2) {
          criticalAlertCount++;
          alertCount++;
        }

        // 플랜 통계
        const key = `${studentId}-${campId}`;
        const pgs = planGroupMap.get(key) || [];
        const pgIds = pgs.map((pg) => pg.id);
        const campPlans = plansData.filter((p) => pgIds.includes(p.plan_group_id));

        const completedPlans = campPlans.filter((p) => p.status === "completed").length;
        const completionRate =
          campPlans.length > 0
            ? Math.round((completedPlans / campPlans.length) * 100)
            : 0;

        totalCompleted += completedPlans;
        totalPlans += campPlans.length;

        // 낮은 완료율 체크
        if (campPlans.length >= 3 && completionRate < 50) {
          alertCount++;
        }

        studentCamps.push({
          campId,
          campName: camp.name,
          campStatus: camp.status,
          attendanceRate,
          completionRate,
        });
      }

      const overallAttendanceRate =
        totalAttendanceDays > 0
          ? Math.round((totalAttendance / totalAttendanceDays) * 100)
          : 0;
      const overallCompletionRate =
        totalPlans > 0 ? Math.round((totalCompleted / totalPlans) * 100) : 0;

      students.push({
        studentId,
        studentName: studentInfo.name,
        campCount: studentInfo.campIds.length,
        activeCampCount,
        overallAttendanceRate,
        overallCompletionRate,
        hasAlerts: alertCount > 0,
        alertCount,
        criticalAlertCount,
        camps: studentCamps,
      });
    }

    // 8. 정렬
    students.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.studentName.localeCompare(b.studentName, "ko");
          break;
        case "attendance":
          comparison = a.overallAttendanceRate - b.overallAttendanceRate;
          break;
        case "completion":
          comparison = a.overallCompletionRate - b.overallCompletionRate;
          break;
        case "alerts":
          comparison = a.alertCount - b.alertCount;
          break;
        case "camps":
          comparison = a.campCount - b.campCount;
          break;
        default:
          comparison = a.studentName.localeCompare(b.studentName, "ko");
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    // 9. 요약 통계
    const totalStudents = students.length;
    const studentsWithAlerts = students.filter((s) => s.hasAlerts).length;
    const studentsWithCriticalAlerts = students.filter(
      (s) => s.criticalAlertCount > 0
    ).length;
    const avgAttendanceRate =
      totalStudents > 0
        ? Math.round(
            students.reduce((sum, s) => sum + s.overallAttendanceRate, 0) /
              totalStudents
          )
        : 0;
    const avgCompletionRate =
      totalStudents > 0
        ? Math.round(
            students.reduce((sum, s) => sum + s.overallCompletionRate, 0) /
              totalStudents
          )
        : 0;

    return apiSuccess<CampStudentsListResponse>({
      students,
      total: totalStudents,
      summary: {
        totalStudents,
        studentsWithAlerts,
        studentsWithCriticalAlerts,
        avgAttendanceRate,
        avgCompletionRate,
      },
    });
  } catch (error) {
    return handleApiError(error, "[api/admin/camps/students] 오류");
  }
}
