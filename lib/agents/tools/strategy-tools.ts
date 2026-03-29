// ============================================
// Agent 4: 보완전략 도구
// suggestStrategies (Grounding 활용) + getWarnings
// ============================================

import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../types";
import { toolError, TOOL_ERRORS } from "../types";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import {
  SYSTEM_PROMPT as STRATEGY_SYSTEM_PROMPT,
  buildUserPrompt as buildStrategyUserPrompt,
  parseResponse as parseStrategyResponse,
} from "@/lib/domains/student-record/llm/prompts/strategyRecommend";
import type { CompetencyItemCode, CompetencyGrade } from "@/lib/domains/student-record/types";
import { findCompetencyScores } from "@/lib/domains/student-record/competency-repository";
import { findDiagnosis } from "@/lib/domains/student-record/diagnosis-repository";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "strategy-tools" };

export function createStrategyTools(ctx: AgentContext) {
  return {
    /**
     * 약점 기반 보완전략 제안 (Grounding 웹 검색 포함)
     */
    suggestStrategies: tool({
      description:
        "학생의 약점과 부족 역량을 분석하여 구체적인 보완전략을 제안합니다. Google 웹 검색(Grounding)을 통해 최신 프로그램, 대회, 활동 등 실질적 정보를 포함합니다.",
      inputSchema: z.object({
        weaknesses: z
          .array(z.string())
          .describe("진단에서 도출된 약점 목록"),
        weakCompetencies: z
          .array(
            z.object({
              item: z.string().describe("역량 항목 코드"),
              grade: z.string().describe("현재 등급"),
              label: z.string().describe("역량 항목 라벨"),
            }),
          )
          .describe("부족한 역량 목록 (B- 이하)"),
        targetMajor: z.string().optional().describe("희망 전공"),
        currentGrade: z.number().describe("현재 학년"),
      }),
      execute: async ({
        weaknesses,
        weakCompetencies,
        targetMajor,
        currentGrade,
      }) => {
        logActionDebug(
          LOG_CTX,
          `suggestStrategies: weaknesses=${weaknesses.length}, competencies=${weakCompetencies.length}`,
        );
        try {
          if (weaknesses.length === 0 && weakCompetencies.length === 0) {
            return {
              success: false,
              error: "약점이나 부족 역량 데이터가 없습니다. 먼저 진단을 실행해주세요.",
            };
          }

          const userPrompt = buildStrategyUserPrompt({
            weaknesses,
            weakCompetencies: weakCompetencies.map((c) => ({
              item: c.item as CompetencyItemCode,
              grade: c.grade as CompetencyGrade,
              label: c.label,
            })),
            targetMajor,
            grade: currentGrade,
          });

          const result = await generateTextWithRateLimit({
            system: STRATEGY_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.4,
            maxTokens: 3000,
            grounding: { enabled: true, mode: "dynamic", dynamicThreshold: 0.3 },
          });

          if (!result.content) {
            return { success: false, error: "AI 응답이 비어있습니다." };
          }

          const sourceUrls = result.groundingMetadata?.webResults
            ?.map((r) => r.url)
            .filter(Boolean) as string[] | undefined;

          return {
            success: true,
            data: parseStrategyResponse(result.content, sourceUrls),
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("보완전략 제안에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 학생 경보/주의사항 조회
     */
    getWarnings: tool({
      description:
        "학생의 현재 역량 데이터에서 경보(약점, 등급 하락, 미평가 항목)를 감지합니다. 위험 수준별로 분류된 경보 목록을 반환합니다.",
      inputSchema: z.object({
        schoolYear: z
          .number()
          .optional()
          .describe("조회할 학년도 (기본: 현재 학년도)"),
      }),
      execute: async ({ schoolYear }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `getWarnings: year=${year}`);
        try {
          if (!ctx.tenantId) {
            return TOOL_ERRORS.NO_TENANT;
          }

          const [scoresRes, diagnosisRes] = await Promise.allSettled([
            findCompetencyScores(ctx.studentId, year, ctx.tenantId),
            findDiagnosis(ctx.studentId, year, ctx.tenantId, "ai"),
          ]);
          const scores = scoresRes.status === "fulfilled" ? scoresRes.value : [];
          const diagnosis = diagnosisRes.status === "fulfilled" ? diagnosisRes.value : null;
          if (scoresRes.status === "rejected") logActionError(LOG_CTX, scoresRes.reason);
          if (diagnosisRes.status === "rejected") logActionError(LOG_CTX, diagnosisRes.reason);

          const warnings: Array<{
            level: "critical" | "warning" | "info";
            message: string;
          }> = [];

          // 역량 등급 경보
          for (const score of scores) {
            if (score.grade_value === "C") {
              warnings.push({
                level: "critical",
                message: `${score.competency_item} 역량이 C등급 (부족)입니다. 즉각 보완이 필요합니다.`,
              });
            } else if (score.grade_value === "B-") {
              warnings.push({
                level: "warning",
                message: `${score.competency_item} 역량이 B-등급 (다소 부족)입니다.`,
              });
            }
          }

          // 미평가 항목 경보
          if (scores.length < 10) {
            warnings.push({
              level: "info",
              message: `10개 역량 중 ${10 - scores.length}개가 미평가 상태입니다.`,
            });
          }

          // 진단 약점 경보
          if (diagnosis?.weaknesses) {
            for (const w of diagnosis.weaknesses as string[]) {
              warnings.push({
                level: "warning",
                message: `진단 약점: ${w}`,
              });
            }
          }

          return {
            success: true,
            data: {
              total: warnings.length,
              critical: warnings.filter((w) => w.level === "critical").length,
              warnings,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("경보 ");
        }
      },
    }),
  };
}
