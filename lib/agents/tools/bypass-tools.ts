// ============================================
// Agent: 우회학과 분석 도구
// searchBypassDepartments + runBypassAnalysis + getBypassCandidates
// ============================================

import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../types";
import { toolError, TOOL_ERRORS } from "../types";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "bypass-tools" };

export function createBypassTools(ctx: AgentContext) {
  return {
    /**
     * 우회학과 후보 조회 — 이미 분석된 결과를 불러옵니다.
     */
    getBypassCandidates: tool({
      description:
        "학생의 우회학과(교차지원) 분석 결과를 조회합니다. 목표 학과 대비 교차 지원 가능한 학과 후보 목록과 복합 점수를 반환합니다.",
      inputSchema: z.object({
        schoolYear: z
          .number()
          .optional()
          .describe("학년도 (기본: 현재)"),
      }),
      execute: async ({ schoolYear }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `getBypassCandidates: student=${ctx.studentId}, year=${year}`);
        try {
          const { findCandidates } = await import(
            "@/lib/domains/bypass-major/repository"
          );
          if (!ctx.tenantId) {
            return TOOL_ERRORS.NO_TENANT;
          }
          const candidates = await findCandidates(ctx.studentId, year);

          if (candidates.length === 0) {
            return {
              success: true,
              data: {
                candidates: [],
                message: "우회학과 분석 결과가 없습니다. runBypassAnalysis로 분석을 실행해주세요.",
              },
            };
          }

          return {
            success: true,
            data: {
              totalCandidates: candidates.length,
              candidates: candidates.slice(0, 10).map((c) => ({
                candidateDept: c.candidate_department?.department_name ?? "알 수 없음",
                candidateUniv: c.candidate_department?.university_name ?? "알 수 없음",
                targetDept: c.target_department?.department_name ?? "알 수 없음",
                compositeScore: c.composite_score,
                curriculumSimilarity: c.curriculum_similarity_score,
                competencyFit: c.competency_fit_score,
                status: c.status,
                source: c.source,
                rationale: c.rationale,
              })),
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("우회학과 후보 ");
        }
      },
    }),

    /**
     * 학과 검색 — 우회학과 분석의 목표 학과를 찾기 위한 검색
     */
    searchBypassDepartments: tool({
      description:
        "대학 학과를 검색합니다. 우회학과 분석의 목표 학과(1지망)를 찾을 때 사용합니다. 대학명 또는 학과명으로 검색할 수 있습니다.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("검색어 (대학명 또는 학과명)"),
        universityName: z
          .string()
          .optional()
          .describe("특정 대학으로 필터링"),
      }),
      execute: async ({ query, universityName }) => {
        logActionDebug(LOG_CTX, `searchBypassDepartments: query=${query}`);
        try {
          const { searchDepartments } = await import(
            "@/lib/domains/bypass-major/repository"
          );
          const result = await searchDepartments({
            query,
            universityName,
            page: 1,
            pageSize: 10,
          });

          return {
            success: true,
            data: {
              count: result.count,
              departments: result.data.map((d) => ({
                id: d.id,
                universityName: d.university_name,
                departmentName: d.department_name,
                majorClassification: d.major_classification,
                midClassification: d.mid_classification,
              })),
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("학과 검색에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 우회학과 종합 분석 실행 — 3필터 파이프라인 (커리큘럼 + 역량 + 배치)
     */
    runBypassAnalysis: tool({
      description:
        "목표 학과를 기준으로 우회학과(교차지원) 종합 분석을 실행합니다. 커리큘럼 유사도, 역량 적합도, 배치 가능성 3축으로 평가합니다. 먼저 searchBypassDepartments로 목표 학과 ID를 찾은 후 사용하세요.",
      inputSchema: z.object({
        targetDeptId: z
          .string()
          .uuid()
          .describe("목표 학과 ID (searchBypassDepartments 결과에서 획득)"),
      }),
      execute: async ({ targetDeptId }) => {
        logActionDebug(LOG_CTX, `runBypassAnalysis: target=${targetDeptId}, student=${ctx.studentId}`);
        try {
          const { runBypassPipeline } = await import(
            "@/lib/domains/bypass-major/pipeline"
          );
          if (!ctx.tenantId) {
            return TOOL_ERRORS.NO_TENANT;
          }
          const result = await runBypassPipeline({
            studentId: ctx.studentId,
            tenantId: ctx.tenantId,
            targetDeptId,
            schoolYear: ctx.schoolYear,
          });

          if (result.totalGenerated === 0) {
            return {
              success: true,
              data: {
                message: "분석 가능한 우회학과 후보가 없습니다. 목표 학과의 대분류에 해당하는 학과가 부족할 수 있습니다.",
                ...result,
              },
            };
          }

          return {
            success: true,
            data: {
              message: `${result.totalGenerated}건 분석 완료`,
              ...result,
              hint: "getBypassCandidates로 상세 결과를 조회하세요.",
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("우회학과 분석 실행에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),
  };
}
