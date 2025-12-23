/**
 * Camp Learning Stats 도메인 레이어
 * 캠프 단위 학습 통계 관리 비즈니스 로직
 */

import { getCampTemplate } from "@/lib/data/campTemplates";
import { getCampLearningStats, getParticipantLearningStats } from "@/lib/data/campLearningStats";
import type { CampLearningStats, ParticipantLearningStats } from "./types";

/**
 * 캠프별 학습 통계 계산
 */
export async function calculateCampLearningStats(
  templateId: string
): Promise<CampLearningStats | null> {
  const template = await getCampTemplate(templateId);
  
  if (!template) {
    return null;
  }

  // 템플릿 기간 정보 확인
  if (!template.camp_start_date || !template.camp_end_date) {
    return {
      template_id: templateId,
      template_name: template.name,
      total_study_minutes: 0,
      average_study_minutes_per_participant: 0,
      total_plans: 0,
      completed_plans: 0,
      participant_stats: [],
    };
  }

  return await getCampLearningStats(
    templateId,
    template.camp_start_date,
    template.camp_end_date
  );
}

/**
 * 참여자별 학습 통계 조회
 */
export async function getParticipantLearningStatsForCamp(
  templateId: string,
  studentId: string
): Promise<ParticipantLearningStats | null> {
  const template = await getCampTemplate(templateId);
  
  if (!template) {
    return null;
  }

  // 템플릿 기간 정보 확인
  if (!template.camp_start_date || !template.camp_end_date) {
    return null;
  }

  return await getParticipantLearningStats(
    templateId,
    studentId,
    template.camp_start_date,
    template.camp_end_date
  );
}

/**
 * 참여자별 일별 학습 데이터 조회
 */
export async function getParticipantDailyLearningDataForCamp(
  templateId: string,
  studentId: string
): Promise<Array<{
  date: string;
  study_minutes: number;
  completed_plans: number;
  total_plans: number;
  completion_rate: number;
}>> {
  const template = await getCampTemplate(templateId);
  
  if (!template || !template.camp_start_date || !template.camp_end_date) {
    return [];
  }

  const { getParticipantDailyLearningData } = await import("@/lib/data/campLearningStats");
  return getParticipantDailyLearningData(
    templateId,
    studentId,
    template.camp_start_date,
    template.camp_end_date
  );
}

/**
 * 참여자별 과목별 상세 통계 조회
 */
export async function getParticipantSubjectStatsForCamp(
  templateId: string,
  studentId: string
): Promise<Array<{
  subject: string;
  study_minutes: number;
  completed_plans: number;
  total_plans: number;
  completion_rate: number;
  average_study_minutes_per_plan: number;
}>> {
  const template = await getCampTemplate(templateId);
  
  if (!template || !template.camp_start_date || !template.camp_end_date) {
    return [];
  }

  const { getParticipantSubjectStats } = await import("@/lib/data/campLearningStats");
  return getParticipantSubjectStats(
    templateId,
    studentId,
    template.camp_start_date,
    template.camp_end_date
  );
}

