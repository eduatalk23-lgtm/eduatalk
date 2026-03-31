// ============================================
// 메모리 도구 — 유사 케이스 + 교정 피드백 + 입시 결과
// 에이전트가 과거 경험을 참조할 수 있게 함
// ============================================

import { tool } from "ai";
import { z } from "zod";
import type { AgentContext, AgentToolResult } from "../types";
import { TOOL_ERRORS } from "../types";
import { searchSimilarCases } from "../memory/search-service";
import { searchSimilarCorrections } from "../memory/correction-service";
import { getPredictionAccuracy, getOutcomesForUniversity, type PredictionAccuracy, type OutcomeSummary } from "../memory/outcome-service";
import type { CaseSearchResult, CorrectionSearchResult } from "../memory/types";

export function createMemoryTools(ctx: AgentContext) {
  return {
    recallSimilarCases: tool({
      description:
        "과거 유사 컨설팅 사례를 검색합니다. 비슷한 프로필의 학생에게 어떤 진단과 전략이 적용되었는지 확인할 수 있습니다. " +
        "새 학생 분석 전 유사 사례를 먼저 확인하면 더 정확한 판단이 가능합니다.",
      parameters: z.object({
        query: z
          .string()
          .describe("검색 쿼리 (예: '내신 3등급 자사고 정치외교학 종합전형')"),
        gradeFilter: z
          .number()
          .min(1)
          .max(3)
          .optional()
          .describe("학년 필터 (1, 2, 3)"),
        majorFilter: z
          .string()
          .optional()
          .describe("전공 키워드 필터"),
        limit: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe("결과 수 (기본: 5)"),
      }),
      execute: async ({
        query,
        gradeFilter,
        majorFilter,
        limit,
      }): Promise<AgentToolResult<{ cases: CaseSearchResult[]; total: number }>> => {
        try {
          const results = await searchSimilarCases({
            query,
            tenantId: ctx.tenantId,
            gradeFilter: gradeFilter ?? null,
            majorFilter: majorFilter ?? null,
            matchCount: limit ?? 5,
          });

          if (results.length === 0) {
            return {
              success: true,
              data: { cases: [], total: 0 },
              actionHint: "유사 사례가 없습니다. 새로운 분석을 진행하세요.",
            };
          }

          return {
            success: true,
            data: { cases: results, total: results.length },
          };
        } catch {
          return TOOL_ERRORS.DB_ERROR("유사 사례 검색");
        }
      },
    }),

    recallPastCorrections: tool({
      description:
        "과거 컨설턴트가 교정한 내용을 검색합니다. 비슷한 상황에서 에이전트가 했던 실수와 교정 내용을 확인합니다. " +
        "분석 전 이 도구로 과거 교정을 확인하면 같은 실수를 반복하지 않을 수 있습니다.",
      parameters: z.object({
        query: z
          .string()
          .describe("검색 쿼리 (예: '자사고 내신 해석', '3학년 전략 추천')"),
        correctionType: z
          .enum(["factual", "strategic", "nuance", "missing"])
          .optional()
          .describe("교정 유형 필터"),
        limit: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe("결과 수 (기본: 5)"),
      }),
      execute: async ({
        query,
        correctionType,
        limit,
      }): Promise<AgentToolResult<{ corrections: CorrectionSearchResult[]; total: number }>> => {
        try {
          const results = await searchSimilarCorrections({
            query,
            tenantId: ctx.tenantId,
            correctionTypeFilter: correctionType ?? null,
            matchCount: limit ?? 5,
          });

          if (results.length === 0) {
            return {
              success: true,
              data: { corrections: [], total: 0 },
              actionHint: "관련 교정 내역이 없습니다.",
            };
          }

          return {
            success: true,
            data: { corrections: results, total: results.length },
          };
        } catch {
          return TOOL_ERRORS.DB_ERROR("교정 내역 검색");
        }
      },
    }),

    getPredictionAccuracy: tool({
      description:
        "연도별 입시 예측 정확도를 조회합니다. 배치 분석의 신뢰도를 판단하는 데 활용하세요. " +
        "정확도가 낮으면 보수적으로 판단해야 합니다.",
      parameters: z.object({
        dataYear: z
          .number()
          .optional()
          .describe("조회할 입시 연도 (미지정 시 전체)"),
      }),
      execute: async ({
        dataYear,
      }): Promise<AgentToolResult<{ accuracies: PredictionAccuracy[] }>> => {
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;
          const results = await getPredictionAccuracy(ctx.tenantId, dataYear);
          return { success: true, data: { accuracies: results } };
        } catch {
          return TOOL_ERRORS.DB_ERROR("예측 정확도 조회");
        }
      },
    }),

    getUniversityOutcomes: tool({
      description:
        "특정 대학/학과의 과거 입시 예측 결과와 실제 결과를 조회합니다. " +
        "해당 대학에 대한 과거 예측이 얼마나 정확했는지 참고할 수 있습니다.",
      parameters: z.object({
        universityName: z.string().describe("대학 이름"),
        departmentName: z.string().optional().describe("학과 이름"),
        limit: z.number().min(1).max(20).optional().describe("결과 수 (기본: 10)"),
      }),
      execute: async ({
        universityName,
        departmentName,
        limit,
      }): Promise<AgentToolResult<{ outcomes: OutcomeSummary[]; total: number }>> => {
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;
          const results = await getOutcomesForUniversity(
            ctx.tenantId,
            universityName,
            departmentName,
            limit ?? 10,
          );
          return { success: true, data: { outcomes: results, total: results.length } };
        } catch {
          return TOOL_ERRORS.DB_ERROR("입시 결과 조회");
        }
      },
    }),
  };
}
