/**
 * 멀티 캠프 출석 통계 API
 * GET /api/admin/camps/attendance?campIds=id1,id2&startDate=2025-01-01&endDate=2025-01-31
 *
 * 다중 캠프의 통합 출석 현황을 조회합니다.
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

export type MultiCampAttendanceStats = {
  camps: Array<{
    id: string;
    name: string;
    campStartDate: string | null;
    campEndDate: string | null;
    totalParticipants: number;
    attendanceRate: number;
    lateRate: number;
    absentRate: number;
  }>;
  summary: {
    totalCamps: number;
    totalParticipants: number;
    overallAttendanceRate: number;
    overallLateRate: number;
    overallAbsentRate: number;
  };
  dailyStats: Array<{
    date: string;
    camps: Array<{
      campId: string;
      campName: string;
      present: number;
      late: number;
      absent: number;
      excused: number;
      earlyLeave: number;
      total: number;
    }>;
  }>;
  students: Array<{
    studentId: string;
    studentName: string;
    camps: Array<{
      campId: string;
      campName: string;
    }>;
    attendanceByDate: Record<
      string,
      {
        campId: string;
        status: string;
        checkInTime: string | null;
        checkOutTime: string | null;
      }
    >;
    summary: {
      presentCount: number;
      lateCount: number;
      absentCount: number;
      attendanceRate: number;
    };
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
      return apiSuccess<MultiCampAttendanceStats>({
        camps: [],
        summary: {
          totalCamps: 0,
          totalParticipants: 0,
          overallAttendanceRate: 0,
          overallLateRate: 0,
          overallAbsentRate: 0,
        },
        dailyStats: [],
        students: [],
      });
    }

    // 2. 각 캠프의 참여자(accepted 상태) 조회
    const { data: invitations, error: invError } = await supabase
      .from("camp_invitations")
      .select("id, camp_template_id, student_id, student_name, status")
      .in("camp_template_id", campIds)
      .eq("status", "accepted");

    if (invError) {
      throw new Error(`초대 조회 실패: ${invError.message}`);
    }

    // 3. 날짜 범위 계산
    let queryStartDate = startDate;
    let queryEndDate = endDate;

    if (!queryStartDate || !queryEndDate) {
      // 선택된 캠프들의 기간을 모두 포함하는 범위 계산
      const allDates = camps
        .filter((c) => c.camp_start_date && c.camp_end_date)
        .flatMap((c) => [c.camp_start_date!, c.camp_end_date!]);

      if (allDates.length > 0) {
        queryStartDate = queryStartDate || allDates.sort()[0];
        queryEndDate = queryEndDate || allDates.sort().reverse()[0];
      } else {
        // 날짜 정보가 없으면 빈 결과 반환
        return apiSuccess<MultiCampAttendanceStats>({
          camps: camps.map((c) => ({
            id: c.id,
            name: c.name,
            campStartDate: c.camp_start_date,
            campEndDate: c.camp_end_date,
            totalParticipants: invitations?.filter(
              (i) => i.camp_template_id === c.id
            ).length || 0,
            attendanceRate: 0,
            lateRate: 0,
            absentRate: 0,
          })),
          summary: {
            totalCamps: camps.length,
            totalParticipants: invitations?.length || 0,
            overallAttendanceRate: 0,
            overallLateRate: 0,
            overallAbsentRate: 0,
          },
          dailyStats: [],
          students: [],
        });
      }
    }

    // 4. 출석 기록 조회
    const studentIds = [...new Set(invitations?.map((i) => i.student_id) || [])];

    if (studentIds.length === 0) {
      return apiSuccess<MultiCampAttendanceStats>({
        camps: camps.map((c) => ({
          id: c.id,
          name: c.name,
          campStartDate: c.camp_start_date,
          campEndDate: c.camp_end_date,
          totalParticipants: 0,
          attendanceRate: 0,
          lateRate: 0,
          absentRate: 0,
        })),
        summary: {
          totalCamps: camps.length,
          totalParticipants: 0,
          overallAttendanceRate: 0,
          overallLateRate: 0,
          overallAbsentRate: 0,
        },
        dailyStats: [],
        students: [],
      });
    }

    const { data: attendanceRecords, error: attError } = await supabase
      .from("attendance_records")
      .select("*")
      .in("student_id", studentIds)
      .eq("tenant_id", tenantContext.tenantId)
      .gte("attendance_date", queryStartDate)
      .lte("attendance_date", queryEndDate)
      .order("attendance_date", { ascending: true });

    if (attError) {
      throw new Error(`출석 기록 조회 실패: ${attError.message}`);
    }

    // 5. 캠프별 참여자 매핑
    const campParticipants = new Map<string, Set<string>>();
    const studentCamps = new Map<string, Array<{ campId: string; campName: string }>>();

    invitations?.forEach((inv) => {
      // 캠프별 학생
      if (!campParticipants.has(inv.camp_template_id)) {
        campParticipants.set(inv.camp_template_id, new Set());
      }
      campParticipants.get(inv.camp_template_id)!.add(inv.student_id);

      // 학생별 캠프
      if (!studentCamps.has(inv.student_id)) {
        studentCamps.set(inv.student_id, []);
      }
      const camp = camps.find((c) => c.id === inv.camp_template_id);
      if (camp) {
        studentCamps.get(inv.student_id)!.push({
          campId: camp.id,
          campName: camp.name,
        });
      }
    });

    // 6. 날짜별 통계 계산
    const dateStats = new Map<
      string,
      Map<string, { present: number; late: number; absent: number; excused: number; earlyLeave: number; total: number }>
    >();

    // 모든 날짜 생성
    const currentDate = new Date(queryStartDate!);
    const endDateObj = new Date(queryEndDate!);
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split("T")[0];
      dateStats.set(dateStr, new Map());
      camps.forEach((camp) => {
        dateStats.get(dateStr)!.set(camp.id, {
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
          earlyLeave: 0,
          total: campParticipants.get(camp.id)?.size || 0,
        });
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 7. 학생별 출석 데이터 계산
    const studentAttendance = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        camps: Array<{ campId: string; campName: string }>;
        attendanceByDate: Record<
          string,
          { campId: string; status: string; checkInTime: string | null; checkOutTime: string | null }
        >;
        presentCount: number;
        lateCount: number;
        absentCount: number;
      }
    >();

    // 학생 기본 정보 초기화
    invitations?.forEach((inv) => {
      if (!studentAttendance.has(inv.student_id)) {
        studentAttendance.set(inv.student_id, {
          studentId: inv.student_id,
          studentName: inv.student_name || "알 수 없음",
          camps: studentCamps.get(inv.student_id) || [],
          attendanceByDate: {},
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
        });
      }
    });

    // 출석 기록 처리
    attendanceRecords?.forEach((record) => {
      const dateStr = record.attendance_date;
      const studentId = record.student_id;

      // 학생이 속한 캠프들 확인
      const studentCampList = studentCamps.get(studentId) || [];

      studentCampList.forEach(({ campId }) => {
        const camp = camps.find((c) => c.id === campId);
        if (!camp) return;

        // 캠프 기간 내인지 확인
        if (camp.camp_start_date && camp.camp_end_date) {
          if (dateStr < camp.camp_start_date || dateStr > camp.camp_end_date) {
            return;
          }
        }

        // 날짜별 캠프 통계 업데이트
        const dayStats = dateStats.get(dateStr)?.get(campId);
        if (dayStats) {
          switch (record.status) {
            case "present":
              dayStats.present++;
              break;
            case "late":
              dayStats.late++;
              break;
            case "absent":
              dayStats.absent++;
              break;
            case "excused":
              dayStats.excused++;
              break;
            case "early_leave":
              dayStats.earlyLeave++;
              break;
          }
        }

        // 학생별 출석 데이터
        const student = studentAttendance.get(studentId);
        if (student) {
          student.attendanceByDate[dateStr] = {
            campId,
            status: record.status,
            checkInTime: record.check_in_time,
            checkOutTime: record.check_out_time,
          };

          switch (record.status) {
            case "present":
              student.presentCount++;
              break;
            case "late":
              student.lateCount++;
              break;
            case "absent":
              student.absentCount++;
              break;
          }
        }
      });
    });

    // 8. 캠프별 통계 집계
    const campStats = camps.map((camp) => {
      const participants = campParticipants.get(camp.id)?.size || 0;
      let totalPresent = 0;
      let totalLate = 0;
      let totalAbsent = 0;
      let totalRecords = 0;

      dateStats.forEach((dayMap) => {
        const campDayStats = dayMap.get(camp.id);
        if (campDayStats) {
          totalPresent += campDayStats.present;
          totalLate += campDayStats.late;
          totalAbsent += campDayStats.absent;
          totalRecords +=
            campDayStats.present +
            campDayStats.late +
            campDayStats.absent +
            campDayStats.excused +
            campDayStats.earlyLeave;
        }
      });

      const attendanceRate =
        totalRecords > 0 ? ((totalPresent + totalLate) / totalRecords) * 100 : 0;
      const lateRate = totalRecords > 0 ? (totalLate / totalRecords) * 100 : 0;
      const absentRate = totalRecords > 0 ? (totalAbsent / totalRecords) * 100 : 0;

      return {
        id: camp.id,
        name: camp.name,
        campStartDate: camp.camp_start_date,
        campEndDate: camp.camp_end_date,
        totalParticipants: participants,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        lateRate: Math.round(lateRate * 10) / 10,
        absentRate: Math.round(absentRate * 10) / 10,
      };
    });

    // 9. 전체 통계 집계
    const totalParticipants = new Set(invitations?.map((i) => i.student_id)).size;
    let overallPresent = 0;
    let overallLate = 0;
    let overallAbsent = 0;
    let overallTotal = 0;

    dateStats.forEach((dayMap) => {
      dayMap.forEach((stats) => {
        overallPresent += stats.present;
        overallLate += stats.late;
        overallAbsent += stats.absent;
        overallTotal +=
          stats.present + stats.late + stats.absent + stats.excused + stats.earlyLeave;
      });
    });

    // 10. 일별 통계 변환
    const dailyStats = Array.from(dateStats.entries()).map(([date, dayMap]) => ({
      date,
      camps: Array.from(dayMap.entries()).map(([campId, stats]) => {
        const camp = camps.find((c) => c.id === campId);
        return {
          campId,
          campName: camp?.name || "알 수 없음",
          ...stats,
        };
      }),
    }));

    // 11. 학생 데이터 변환
    const students = Array.from(studentAttendance.values()).map((student) => ({
      studentId: student.studentId,
      studentName: student.studentName,
      camps: student.camps,
      attendanceByDate: student.attendanceByDate,
      summary: {
        presentCount: student.presentCount,
        lateCount: student.lateCount,
        absentCount: student.absentCount,
        attendanceRate:
          student.presentCount + student.lateCount + student.absentCount > 0
            ? Math.round(
                ((student.presentCount + student.lateCount) /
                  (student.presentCount + student.lateCount + student.absentCount)) *
                  1000
              ) / 10
            : 0,
      },
    }));

    return apiSuccess<MultiCampAttendanceStats>({
      camps: campStats,
      summary: {
        totalCamps: camps.length,
        totalParticipants,
        overallAttendanceRate:
          overallTotal > 0
            ? Math.round(((overallPresent + overallLate) / overallTotal) * 1000) / 10
            : 0,
        overallLateRate:
          overallTotal > 0 ? Math.round((overallLate / overallTotal) * 1000) / 10 : 0,
        overallAbsentRate:
          overallTotal > 0 ? Math.round((overallAbsent / overallTotal) * 1000) / 10 : 0,
      },
      dailyStats,
      students,
    });
  } catch (error) {
    return handleApiError(error, "[api/admin/camps/attendance] 오류");
  }
}
