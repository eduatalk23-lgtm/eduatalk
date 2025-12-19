/**
 * Attendance 도메인 유틸리티 함수
 * 통계 계산 로직 중복 제거
 */

import type { AttendanceRecord, AttendanceStatistics } from "./types";

/**
 * 출석 기록 배열로부터 통계 계산
 * @param records 출석 기록 배열
 * @returns 출석 통계
 */
export function calculateStatsFromRecords(
  records: AttendanceRecord[]
): AttendanceStatistics {
  const totalDays = records.length;
  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const lateCount = records.filter((r) => r.status === "late").length;
  const earlyLeaveCount = records.filter(
    (r) => r.status === "early_leave"
  ).length;
  const excusedCount = records.filter((r) => r.status === "excused").length;

  const attendanceRate = totalDays > 0 ? (presentCount / totalDays) * 100 : 0;
  const lateRate = totalDays > 0 ? (lateCount / totalDays) * 100 : 0;
  const absentRate = totalDays > 0 ? (absentCount / totalDays) * 100 : 0;

  return {
    total_days: totalDays,
    present_count: presentCount,
    absent_count: absentCount,
    late_count: lateCount,
    early_leave_count: earlyLeaveCount,
    excused_count: excusedCount,
    attendance_rate: Math.round(attendanceRate * 100) / 100,
    late_rate: Math.round(lateRate * 100) / 100,
    absent_rate: Math.round(absentRate * 100) / 100,
  };
}

