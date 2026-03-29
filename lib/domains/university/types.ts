// ============================================
// 대학별 평가 기준 — 타입 + Zod 스키마
// ============================================

import { z } from "zod";

/** Gemini 구조화 출력용 스키마 */
export const UniversityEvalCriteriaSchema = z.object({
  universityName: z.string().describe("대학명 (정식명칭)"),
  admissionType: z.string().describe("전형 유형 (학생부종합, 학생부교과, 논술 등)"),
  admissionName: z.string().optional().describe("세부 전형명 (일반전형, 활동우수형 등)"),
  idealStudent: z
    .string()
    .describe("대학이 공식 발표한 인재상 (1-3문장)"),
  evaluationFactors: z
    .record(z.number())
    .describe("평가 요소별 비율. 예: { '학업역량': 0.4, '진로역량': 0.3, '공동체역량': 0.3 }. 합계 1.0"),
  documentEvalDetails: z
    .string()
    .describe("서류평가 세부 기준. 학업능력, 학업태도, 학업외소양 등 구체적 평가 항목"),
  interviewFormat: z
    .enum(["서류확인", "제시문", "mmi", "토론", "없음"])
    .describe("면접 형식"),
  interviewDetails: z
    .string()
    .optional()
    .describe("면접 상세. 시간, 면접관 수, 준비시간, 구조 등"),
  minScoreCriteria: z
    .string()
    .optional()
    .describe("수능최저학력기준 요약. 예: '4개 영역 등급합 8 이내'"),
  keyTips: z
    .array(z.string())
    .max(5)
    .describe("이 전형 합격을 위한 핵심 팁 (최대 5개)"),
});

export type UniversityEvalCriteria = z.infer<typeof UniversityEvalCriteriaSchema>;

/** DB 행 타입 */
export interface UniversityEvalCriteriaRow {
  id: string;
  university_name: string;
  admission_type: string;
  admission_name: string | null;
  ideal_student: string | null;
  evaluation_factors: Record<string, number>;
  document_eval_details: string | null;
  interview_format: string | null;
  interview_details: string | null;
  min_score_criteria: string | null;
  key_tips: string[];
  source_url: string | null;
  data_year: number;
  created_at: string;
}
