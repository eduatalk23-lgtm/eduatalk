/**
 * 출석 관리 공통 유틸리티 함수
 */

import type { AttendanceStatus, CheckMethod } from "@/lib/domains/attendance/types";
import {
  ATTENDANCE_STATUS_LABELS,
  CHECK_METHOD_LABELS,
} from "@/lib/domains/attendance/types";

/**
 * 출석 상태별 배지 스타일 클래스 반환
 */
export function getAttendanceStatusBadgeClass(
  status: AttendanceStatus | string
): string {
  switch (status) {
    case "present":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "late":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "early_leave":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "absent":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "excused":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
}

/**
 * 출석 시간 포맷팅 (HH:mm)
 */
export function formatAttendanceTime(time: string | null): string {
  if (!time) return "-";
  try {
    const date = new Date(time);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "-";
  }
}

/**
 * 출석 날짜 포맷팅 (YYYY-MM-DD → YYYY년 MM월 DD일)
 */
export function formatAttendanceDate(date: string): string {
  try {
    const [year, month, day] = date.split("-");
    return `${year}년 ${month}월 ${day}일`;
  } catch {
    return date;
  }
}

/**
 * 체크 방법 라벨 반환
 */
export function getCheckMethodLabel(
  method: CheckMethod | null | undefined
): string {
  if (!method) return "-";
  return CHECK_METHOD_LABELS[method] ?? "-";
}

/**
 * 출석 상태 라벨 반환
 */
export function getAttendanceStatusLabel(
  status: AttendanceStatus | string
): string {
  return (
    ATTENDANCE_STATUS_LABELS[status as AttendanceStatus] ?? "알 수 없음"
  );
}

