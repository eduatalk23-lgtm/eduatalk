/**
 * 캠프 리포트 생성 기능
 * 캠프 템플릿별 출석 및 학습 통계 리포트 생성
 */

import { getCampTemplate } from "@/lib/data/campTemplates";
import { calculateCampAttendanceStats } from "@/lib/domains/camp/attendance";
import { calculateCampLearningStats } from "@/lib/domains/camp/learningStats";
import type { CampAttendanceStats } from "@/lib/domains/camp/types";
import type { CampLearningStats } from "@/lib/domains/camp/types";

/**
 * 캠프 리포트 데이터 타입
 */
export type CampReportData = {
  template_id: string;
  template_name: string;
  camp_start_date: string | null;
  camp_end_date: string | null;
  attendance_stats: CampAttendanceStats | null;
  learning_stats: CampLearningStats | null;
  generated_at: string;
};

/**
 * 캠프 리포트 데이터 수집
 */
export async function getCampReportData(
  templateId: string
): Promise<CampReportData | null> {
  const template = await getCampTemplate(templateId);
  
  if (!template) {
    return null;
  }

  // 출석 통계 및 학습 통계 병렬 조회
  const [attendanceStats, learningStats] = await Promise.all([
    calculateCampAttendanceStats(templateId),
    calculateCampLearningStats(templateId),
  ]);

  return {
    template_id: templateId,
    template_name: template.name,
    camp_start_date: template.camp_start_date,
    camp_end_date: template.camp_end_date,
    attendance_stats: attendanceStats,
    learning_stats: learningStats,
    generated_at: new Date().toISOString(),
  };
}

/**
 * 캠프 출석 리포트 생성
 */
export async function generateCampAttendanceReport(
  templateId: string
): Promise<CampAttendanceStats | null> {
  return await calculateCampAttendanceStats(templateId);
}

/**
 * 캠프 학습 리포트 생성
 */
export async function generateCampLearningReport(
  templateId: string
): Promise<CampLearningStats | null> {
  return await calculateCampLearningStats(templateId);
}

/**
 * 캠프 통합 리포트 생성 (출석 + 학습)
 */
export async function generateCampFullReport(
  templateId: string
): Promise<CampReportData | null> {
  return await getCampReportData(templateId);
}

