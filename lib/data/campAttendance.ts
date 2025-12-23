/**
 * 캠프 출석 데이터 레이어
 * 캠프 템플릿별 출석 기록 조회 및 통계 계산
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractJoinResult } from "@/lib/supabase/queryHelpers";
import { getCampTemplate } from "./campTemplates";
import { getCampInvitationsForTemplate } from "./campTemplates";
import type { AttendanceRecord } from "@/lib/domains/attendance/types";
import { calculateStatsFromRecords } from "@/lib/domains/attendance/utils";
import { calculateTotalDays } from "@/lib/utils/statistics";
import type { CampAttendanceStats, ParticipantAttendanceStats } from "@/lib/domains/camp/types";

/**
 * 출석 기록 + 학생 정보 타입
 */
export type AttendanceRecordWithStudent = AttendanceRecord & {
  student_name: string | null;
};

/**
 * Supabase 쿼리 결과 타입: attendance_records with students join
 */
type AttendanceRecordRaw = AttendanceRecord & {
  students: { name: string | null } | { name: string | null }[] | null;
};

/**
 * 캠프 기간 출석 기록 조회
 * 템플릿에 초대된 모든 학생의 출석 기록을 조회합니다.
 */
export async function getCampAttendanceRecords(
  templateId: string,
  startDate: string,
  endDate: string
): Promise<AttendanceRecord[]> {
  const supabase = await createSupabaseServerClient();

  // 템플릿 정보 조회
  const template = await getCampTemplate(templateId);
  if (!template) {
    return [];
  }

  // 캠프 초대 목록 조회 (참여자 확인)
  const invitations = await getCampInvitationsForTemplate(templateId);
  const participantStudentIds = invitations
    .filter((inv) => inv.status === "accepted")
    .map((inv) => inv.student_id);

  if (participantStudentIds.length === 0) {
    return [];
  }

  // 출석 기록 조회 (배치 조회로 N+1 문제 방지)
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("tenant_id", template.tenant_id)
    .in("student_id", participantStudentIds)
    .gte("attendance_date", startDate)
    .lte("attendance_date", endDate)
    .order("attendance_date", { ascending: true })
    .order("check_in_time", { ascending: true });

  if (error) {
    console.error("[data/campAttendance] 출석 기록 조회 실패", {
      templateId,
      startDate,
      endDate,
      error: error.message,
      errorCode: error.code,
    });
    return [];
  }

  return (data || []) as AttendanceRecord[];
}

/**
 * 캠프별 출석 통계 계산
 */
export async function getCampAttendanceStats(
  templateId: string
): Promise<CampAttendanceStats | null> {
  const template = await getCampTemplate(templateId);
  if (!template) {
    return null;
  }

  // 템플릿 기간 정보 확인
  if (!template.camp_start_date || !template.camp_end_date) {
    return {
      template_id: templateId,
      template_name: template.name,
      total_participants: 0,
      total_days: 0,
      attendance_rate: 0,
      late_rate: 0,
      absent_rate: 0,
      participant_stats: [],
    };
  }

  // 캠프 초대 목록 조회
  const invitations = await getCampInvitationsForTemplate(templateId);
  const acceptedInvitations = invitations.filter(
    (inv) => inv.status === "accepted"
  );

  if (acceptedInvitations.length === 0) {
    return {
      template_id: templateId,
      template_name: template.name,
      total_participants: 0,
      total_days: 0,
      attendance_rate: 0,
      late_rate: 0,
      absent_rate: 0,
      participant_stats: [],
    };
  }

  // 출석 기록 조회
  const records = await getCampAttendanceRecords(
    templateId,
    template.camp_start_date,
    template.camp_end_date
  );

  // 전체 통계 계산
  const totalDays = calculateTotalDays(
    template.camp_start_date,
    template.camp_end_date
  );
  const overallStats = calculateStatsFromRecords(records);

  // 참여자별 통계 계산
  const participantStats = await Promise.all(
    acceptedInvitations.map(async (invitation) => {
      const studentRecords = records.filter(
        (r) => r.student_id === invitation.student_id
      );
      const studentStats = calculateStatsFromRecords(studentRecords);

      return {
        student_id: invitation.student_id,
        student_name: invitation.student_name || "이름 없음",
        attendance_rate: studentStats.attendance_rate,
        absent_count: studentStats.absent_count,
        late_count: studentStats.late_count,
        present_count: studentStats.present_count,
        early_leave_count: studentStats.early_leave_count,
        excused_count: studentStats.excused_count,
      };
    })
  );

  return {
    template_id: templateId,
    template_name: template.name,
    total_participants: acceptedInvitations.length,
    total_days: totalDays,
    attendance_rate: overallStats.attendance_rate,
    late_rate: overallStats.late_rate,
    absent_rate: overallStats.absent_rate,
    participant_stats: participantStats,
  };
}

/**
 * 참여자별 출석 통계 조회
 */
export async function getParticipantAttendanceStats(
  templateId: string,
  studentId: string
): Promise<ParticipantAttendanceStats | null> {
  const template = await getCampTemplate(templateId);
  if (!template) {
    return null;
  }

  // 템플릿 기간 정보 확인
  if (!template.camp_start_date || !template.camp_end_date) {
    return null;
  }

  // 출석 기록 조회
  const records = await getCampAttendanceRecords(
    templateId,
    template.camp_start_date,
    template.camp_end_date
  );

  // 해당 학생의 기록만 필터링
  const studentRecords = records.filter((r) => r.student_id === studentId);

  // 학생 정보 조회
  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase
    .from("students")
    .select("name")
    .eq("id", studentId)
    .maybeSingle();

  // 통계 계산
  const stats = calculateStatsFromRecords(studentRecords);
  const totalDays = calculateTotalDays(
    template.camp_start_date,
    template.camp_end_date
  );

  return {
    student_id: studentId,
    student_name: student?.name || "이름 없음",
    total_days: totalDays,
    present_count: stats.present_count,
    absent_count: stats.absent_count,
    late_count: stats.late_count,
    early_leave_count: stats.early_leave_count,
    excused_count: stats.excused_count,
    attendance_rate: stats.attendance_rate,
    late_rate: stats.late_rate,
    absent_rate: stats.absent_rate,
  };
}

/**
 * 특정 날짜의 출석 기록 조회 (학생 정보 포함)
 * N+1 문제를 방지하기 위해 JOIN으로 학생 정보를 함께 조회합니다.
 */
export async function getCampAttendanceRecordsByDate(
  templateId: string,
  date: string
): Promise<AttendanceRecordWithStudent[]> {
  const supabase = await createSupabaseServerClient();

  // 템플릿 정보 조회
  const template = await getCampTemplate(templateId);
  if (!template) {
    return [];
  }

  // 캠프 초대 목록 조회 (참여자 확인)
  const invitations = await getCampInvitationsForTemplate(templateId);
  const participantStudentIds = invitations
    .filter((inv) => inv.status === "accepted")
    .map((inv) => inv.student_id);

  if (participantStudentIds.length === 0) {
    return [];
  }

  // 출석 기록 조회 (학생 정보 JOIN)
  const { data, error } = await supabase
    .from("attendance_records")
    .select(
      `
      *,
      students:student_id (
        name
      )
    `
    )
    .eq("tenant_id", template.tenant_id)
    .in("student_id", participantStudentIds)
    .eq("attendance_date", date)
    .order("check_in_time", { ascending: true });

  if (error) {
    console.error("[data/campAttendance] 날짜별 출석 기록 조회 실패", {
      templateId,
      date,
      error: error.message,
      errorCode: error.code,
    });
    return [];
  }

  // 데이터 변환 (JOIN 결과를 평탄화)
  const records: AttendanceRecordWithStudent[] = (
    (data || []) as AttendanceRecordRaw[]
  ).map((record) => {
    const studentInfo = extractJoinResult(record.students);

    return {
      ...record,
      student_name: studentInfo?.name || null,
    };
  });

  return records;
}

/**
 * 캠프 기간 전체 출석 기록 조회 (학생 정보 포함, 달력용)
 * 날짜별 그룹화는 클라이언트에서 처리합니다.
 */
export async function getCampAttendanceRecordsWithStudents(
  templateId: string,
  startDate: string,
  endDate: string
): Promise<AttendanceRecordWithStudent[]> {
  const supabase = await createSupabaseServerClient();

  // 템플릿 정보 조회
  const template = await getCampTemplate(templateId);
  if (!template) {
    return [];
  }

  // 캠프 초대 목록 조회 (참여자 확인)
  const invitations = await getCampInvitationsForTemplate(templateId);
  const participantStudentIds = invitations
    .filter((inv) => inv.status === "accepted")
    .map((inv) => inv.student_id);

  if (participantStudentIds.length === 0) {
    return [];
  }

  // 출석 기록 조회 (학생 정보 JOIN)
  const { data, error } = await supabase
    .from("attendance_records")
    .select(
      `
      *,
      students:student_id (
        name
      )
    `
    )
    .eq("tenant_id", template.tenant_id)
    .in("student_id", participantStudentIds)
    .gte("attendance_date", startDate)
    .lte("attendance_date", endDate)
    .order("attendance_date", { ascending: true })
    .order("check_in_time", { ascending: true });

  if (error) {
    console.error("[data/campAttendance] 출석 기록 조회 실패", {
      templateId,
      startDate,
      endDate,
      error: error.message,
      errorCode: error.code,
    });
    return [];
  }

  // 데이터 변환 (JOIN 결과를 평탄화)
  const records: AttendanceRecordWithStudent[] = (
    (data || []) as AttendanceRecordRaw[]
  ).map((record) => {
    const studentInfo = extractJoinResult(record.students);

    return {
      ...record,
      student_name: studentInfo?.name || null,
    };
  });

  return records;
}


