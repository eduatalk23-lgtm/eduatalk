/**
 * 캠프 학습 통계 데이터 레이어
 *
 * 서비스 레이어로 위임하여 코드 중복을 제거합니다.
 * @see lib/domains/camp/services/learningProgressService.ts
 */

import {
  calculateCampLearningStats,
  calculateParticipantLearningStats,
  calculateParticipantDailyProgress,
  calculateParticipantSubjectProgress,
} from "@/lib/domains/camp/services/learningProgressService";
import type { CampLearningStats, ParticipantLearningStats } from "@/lib/domains/camp/types";

/**
 * 캠프별 학습 통계 계산
 * @param templateId 캠프 템플릿 ID
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM-DD)
 */
export async function getCampLearningStats(
  templateId: string,
  startDate: string,
  endDate: string
): Promise<CampLearningStats | null> {
  return calculateCampLearningStats(templateId, startDate, endDate);
}

/**
 * 참여자별 학습 통계 조회
 * @param templateId 캠프 템플릿 ID
 * @param studentId 학생 ID
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM-DD)
 */
export async function getParticipantLearningStats(
  templateId: string,
  studentId: string,
  startDate: string,
  endDate: string
): Promise<ParticipantLearningStats | null> {
  return calculateParticipantLearningStats(templateId, studentId, startDate, endDate);
}

/**
 * 참여자별 일별 학습 데이터 조회
 * @param templateId 캠프 템플릿 ID
 * @param studentId 학생 ID
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM-DD)
 */
export async function getParticipantDailyLearningData(
  templateId: string,
  studentId: string,
  startDate: string,
  endDate: string
): Promise<Array<{
  date: string;
  study_minutes: number;
  completed_plans: number;
  total_plans: number;
  completion_rate: number;
}>> {
  return calculateParticipantDailyProgress(templateId, studentId, startDate, endDate);
}

/**
 * 참여자별 과목별 상세 통계 조회
 * @param templateId 캠프 템플릿 ID
 * @param studentId 학생 ID
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM-DD)
 */
export async function getParticipantSubjectStats(
  templateId: string,
  studentId: string,
  startDate: string,
  endDate: string
): Promise<Array<{
  subject: string;
  study_minutes: number;
  completed_plans: number;
  total_plans: number;
  completion_rate: number;
  average_study_minutes_per_plan: number;
}>> {
  return calculateParticipantSubjectProgress(templateId, studentId, startDate, endDate);
}
