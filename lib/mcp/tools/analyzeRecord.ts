/**
 * Phase F-1b: analyzeRecord tool 공유 정의.
 *
 * 실행 본체(`lookupRecordAnalysis`)는 `"use server"` 모듈이므로 얇은 래퍼만 둔다.
 * Chat Shell과 MCP 서버가 동일 description·inputShape·execute를 공유.
 */

import { z } from "zod";
import {
  lookupRecordAnalysis,
  type AnalyzeRecordOutput,
} from "@/lib/domains/ai-chat/actions/record-analysis";

export type { AnalyzeRecordOutput };

export const analyzeRecordDescription =
  "학생의 생기부 AI 분석 상태와 최신 진단 요약(종합등급·강점·약점·추천 전공)을 조회합니다. 관리자/컨설턴트가 '@XXX 분석 요약', '김세린 진단 어디까지', 'YYY 생기부 분석 결과' 등 특정 학생의 분석 결과·진행 상태를 물을 때 호출하세요. 분석 재실행은 하지 않으며, 필요 시 결과에 담긴 detailPath 로 이동을 안내합니다.";

export const analyzeRecordInputShape = {
  studentName: z
    .string()
    .min(1)
    .describe("조회 대상 학생의 이름. 반드시 제공. 같은 테넌트에서만 검색됨."),
} as const;

export const analyzeRecordInputSchema = z.object(analyzeRecordInputShape);

export type AnalyzeRecordInput = z.infer<typeof analyzeRecordInputSchema>;

export async function analyzeRecordExecute({
  studentName,
}: AnalyzeRecordInput): Promise<AnalyzeRecordOutput> {
  return lookupRecordAnalysis(studentName);
}
