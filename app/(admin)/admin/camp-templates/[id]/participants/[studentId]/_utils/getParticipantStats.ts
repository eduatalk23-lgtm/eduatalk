/**
 * 참여자 통계 조회 유틸리티
 */

import { getParticipantStats } from "@/lib/domains/camp/attendance";
import { getParticipantLearningStatsForCamp } from "@/lib/domains/camp/learningStats";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ParticipantAttendanceStats } from "@/lib/domains/camp/types";
import type { ParticipantLearningStats } from "@/lib/domains/camp/types";

export type ParticipantStatsData = {
  student_id: string;
  student_name: string;
  attendance_stats: ParticipantAttendanceStats | null;
  learning_stats: ParticipantLearningStats | null;
};

/**
 * 캠프 참여자 통계 조회
 */
export async function getParticipantStatsForCamp(
  templateId: string,
  studentId: string
): Promise<ParticipantStatsData> {
  // 학생 정보 조회
  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, name")
    .eq("id", studentId)
    .maybeSingle();

  // 출석 및 학습 통계 병렬 조회
  const [attendanceStats, learningStats] = await Promise.all([
    getParticipantStats(templateId, studentId),
    getParticipantLearningStatsForCamp(templateId, studentId),
  ]);

  return {
    student_id: studentId,
    student_name: student?.name || "이름 없음",
    attendance_stats: attendanceStats,
    learning_stats: learningStats,
  };
}

