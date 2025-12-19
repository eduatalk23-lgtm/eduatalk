/**
 * 캠프 참여자 통계 데이터 레이어
 * 참여자별 출석 및 학습 통계 배치 조회
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCampTemplate } from "./campTemplates";
import { getParticipantAttendanceStats } from "./campAttendance";
import { getParticipantLearningStats } from "./campLearningStats";
import type { ParticipantAttendanceStats } from "@/lib/domains/camp/types";
import type { ParticipantLearningStats } from "@/lib/domains/camp/types";

/**
 * 참여자별 통계 정보
 */
export type ParticipantStats = {
  student_id: string;
  attendance_rate: number | null;
  study_minutes: number | null;
  plan_completion_rate: number | null;
};

/**
 * 여러 참여자의 통계를 배치로 조회
 */
export async function getCampParticipantStatsBatch(
  templateId: string,
  studentIds: string[]
): Promise<Map<string, ParticipantStats>> {
  const template = await getCampTemplate(templateId);
  if (!template || !template.camp_start_date || !template.camp_end_date) {
    return new Map();
  }

  if (studentIds.length === 0) {
    return new Map();
  }

  // 병렬로 통계 조회
  const statsPromises = studentIds.map(async (studentId) => {
    try {
      const [attendanceStats, learningStats] = await Promise.all([
        getParticipantAttendanceStats(
          templateId,
          studentId,
          template.camp_start_date,
          template.camp_end_date
        ),
        getParticipantLearningStats(
          templateId,
          studentId,
          template.camp_start_date,
          template.camp_end_date
        ),
      ]);

      return {
        student_id: studentId,
        attendance_rate: attendanceStats?.attendance_rate ?? null,
        study_minutes: learningStats?.study_minutes ?? null,
        plan_completion_rate: learningStats?.plan_completion_rate ?? null,
      };
    } catch (error) {
      console.error(
        `[data/campParticipantStats] 참여자 ${studentId} 통계 조회 실패`,
        error
      );
      return {
        student_id: studentId,
        attendance_rate: null,
        study_minutes: null,
        plan_completion_rate: null,
      };
    }
  });

  const statsArray = await Promise.all(statsPromises);
  const statsMap = new Map<string, ParticipantStats>();

  statsArray.forEach((stat) => {
    statsMap.set(stat.student_id, stat);
  });

  return statsMap;
}

