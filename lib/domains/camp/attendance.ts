/**
 * Camp Attendance 도메인 레이어
 * 캠프 단위 출석 관리 비즈니스 로직
 */

import { getCampTemplate } from "@/lib/data/campTemplates";
import { getCampInvitationsForTemplate } from "@/lib/data/campTemplates";
import { getCampAttendanceRecords, getCampAttendanceStats, getParticipantAttendanceStats } from "@/lib/data/campAttendance";
import type { CampAttendanceStats, ParticipantAttendanceStats } from "./types";
import type { AttendanceRecord } from "@/lib/domains/attendance/types";

/**
 * 캠프 템플릿 기간 필터링
 * 템플릿의 camp_start_date와 camp_end_date를 기반으로 날짜 범위를 반환합니다.
 */
export async function getCampDateRange(
  templateId: string
): Promise<{ startDate: string; endDate: string } | null> {
  const template = await getCampTemplate(templateId);
  
  if (!template) {
    return null;
  }

  // 템플릿에 기간 정보가 있는 경우
  if (template.camp_start_date && template.camp_end_date) {
    return {
      startDate: template.camp_start_date,
      endDate: template.camp_end_date,
    };
  }

  // 기간 정보가 없는 경우 null 반환
  return null;
}

/**
 * 캠프 참여자 출석 기록 조회
 * 템플릿에 초대된 모든 학생의 출석 기록을 조회합니다.
 */
export async function getCampParticipantAttendanceRecords(
  templateId: string,
  startDate?: string,
  endDate?: string
): Promise<Map<string, AttendanceRecord[]>> {
  // 템플릿 기간 정보 확인
  const dateRange = await getCampDateRange(templateId);
  const finalStartDate = startDate || dateRange?.startDate;
  const finalEndDate = endDate || dateRange?.endDate;

  if (!finalStartDate || !finalEndDate) {
    return new Map();
  }

  // 캠프 초대 목록 조회 (참여자 확인)
  const invitations = await getCampInvitationsForTemplate(templateId);
  const participantStudentIds = invitations
    .filter((inv) => inv.status === "accepted")
    .map((inv) => inv.student_id);

  if (participantStudentIds.length === 0) {
    return new Map();
  }

  // 출석 기록 조회
  const records = await getCampAttendanceRecords(
    templateId,
    finalStartDate,
    finalEndDate
  );

  // 학생별로 그룹화
  const recordsByStudent = new Map<string, AttendanceRecord[]>();
  records.forEach((record) => {
    const existing = recordsByStudent.get(record.student_id) || [];
    recordsByStudent.set(record.student_id, [...existing, record]);
  });

  return recordsByStudent;
}

/**
 * 캠프별 출석 통계 계산
 */
export async function calculateCampAttendanceStats(
  templateId: string
): Promise<CampAttendanceStats | null> {
  const template = await getCampTemplate(templateId);
  
  if (!template) {
    return null;
  }

  return await getCampAttendanceStats(templateId);
}

/**
 * 참여자별 출석 통계 조회
 */
export async function getParticipantStats(
  templateId: string,
  studentId: string
): Promise<ParticipantAttendanceStats | null> {
  return await getParticipantAttendanceStats(templateId, studentId);
}

