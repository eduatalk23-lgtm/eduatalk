// ============================================
// Agent 3: 입시 배치 도구
// 결정론적 엔진 → tool() 래핑
// ============================================

import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../types";
import { toolError, TOOL_ERRORS } from "../types";
import {
  searchAdmissions,
  getScoreConfig,
  getRestrictions,
  resolveUniversityAliases,
} from "@/lib/domains/admission/repository";
import { analyzePlacement } from "@/lib/domains/admission/placement/service";
import { filterVerdicts } from "@/lib/domains/admission/placement/engine";
import {
  convertToSuneungScores,
  type MockScoreInput,
} from "@/lib/domains/admission/placement/score-converter";
import {
  PLACEMENT_LABELS,
  type PlacementAnalysisResult,
  type PlacementVerdict,
} from "@/lib/domains/admission/placement/types";
import { simulateAllocation } from "@/lib/domains/admission/allocation/engine";
import type { AllocationCandidate } from "@/lib/domains/admission/allocation/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "admission-tools" };

/** PlacementVerdict → LLM 토큰 절약용 요약 */
function truncateVerdict(v: PlacementVerdict) {
  return {
    universityName: v.universityName,
    departmentName: v.departmentName,
    region: v.region,
    departmentType: v.departmentType,
    studentScore: v.studentScore,
    level: v.level,
    levelLabel: PLACEMENT_LABELS[v.level],
    admissionAvg: v.admissionAvg,
    scoreDiff: v.scoreDiff,
    confidence: v.confidence,
    notes: v.notes,
    replacementProbability: v.replacementInfo?.probabilityLevel ?? null,
    replacementMessage: v.replacementInfo?.message ?? null,
  };
}

export function createAdmissionTools(ctx: AgentContext) {
  // Closure 캐시 — 요청 범위 내에서 runPlacement → filter/impact 간 공유
  let cachedAnalysis: PlacementAnalysisResult | null = null;
  let cachedScoreInput: MockScoreInput | null = null;

  return {
    /**
     * 대학 입시 데이터 검색
     * 입시 데이터(university_admissions)는 전역 공개 데이터이므로 tenantId 필터 불필요.
     * 테넌트별 커스텀 입시 데이터를 도입할 경우 tenantId 필터 추가 필요.
     */
    searchAdmissionData: tool({
      description:
        "대학 입시 데이터를 검색합니다. 대학명, 학과명, 지역, 계열, 전형으로 검색 가능합니다. 별칭(약칭, 영문명, 캠퍼스명)도 자동 해석됩니다.",
      inputSchema: z.object({
        universityName: z
          .string()
          .optional()
          .describe("대학명 (예: '서울대', 'KAIST')"),
        departmentName: z
          .string()
          .optional()
          .describe("학과명 (예: '경영학과')"),
        region: z.string().max(20).optional().describe("지역 (예: '서울')"),
        departmentType: z
          .enum(["공통", "예체능", "인문", "자연", "통합"])
          .optional()
          .describe("계열"),
        admissionType: z
          .enum(["논술", "실기/실적", "특기자", "학생부교과", "학생부종합"])
          .optional()
          .describe("전형"),
        page: z.number().optional().describe("페이지 (기본: 1)"),
      }),
      execute: async ({
        universityName,
        departmentName,
        region,
        departmentType,
        admissionType,
        page,
      }) => {
        logActionDebug(LOG_CTX, `searchAdmissionData: uni=${universityName}, dept=${departmentName}`);
        try {
          const result = await searchAdmissions(
            {
              universityName: universityName ?? undefined,
              departmentName: departmentName ?? undefined,
              region: region ?? undefined,
              departmentType: departmentType ?? undefined,
              admissionType: admissionType ?? undefined,
            },
            { page: page ?? 1, pageSize: 15 },
          );

          return {
            success: true,
            data: {
              rows: result.rows.map((r) => ({
                universityName: r.universityName,
                departmentName: r.departmentName,
                region: r.region,
                departmentType: r.departmentType,
                admissionType: r.admissionType,
                recruitmentCount: r.recruitmentCount,
                minScoreCriteria: r.minScoreCriteria,
                notes: r.notes,
              })),
              total: result.total,
              page: result.page,
              totalPages: result.totalPages,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("입시 데이터 검색에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 대학별 정시 환산 설정 조회
     */
    getUniversityScoreInfo: tool({
      description:
        "특정 대학의 정시 환산 설정을 조회합니다. 반영 과목 패턴, 선택/필수 구조, 결격사유, 환산 경로(과목별/백분위) 등을 반환합니다.",
      inputSchema: z.object({
        universityName: z.string().max(50).describe("대학명 (정확한 이름)"),
        dataYear: z
          .number()
          .optional()
          .describe("데이터 연도 (기본: 2026)"),
      }),
      execute: async ({ universityName, dataYear }) => {
        logActionDebug(LOG_CTX, `getUniversityScoreInfo: ${universityName}`);
        try {
          // Try original name first
          let resolvedName = universityName;
          let config = await getScoreConfig(resolvedName, dataYear);

          // If not found, try resolved aliases
          if (!config) {
            const aliases = await resolveUniversityAliases(universityName);
            for (const name of aliases) {
              config = await getScoreConfig(name, dataYear);
              if (config) {
                resolvedName = name;
                break;
              }
            }
          }

          if (!config) {
            return TOOL_ERRORS.RESOURCE_NOT_FOUND(`'${universityName}' 대학 환산 설정`);
          }

          const restrictions = await getRestrictions(resolvedName, dataYear);

          return {
            success: true,
            data: {
              universityName: config.universityName,
              scoringPath: config.scoringPath,
              mandatoryPattern: config.mandatoryPattern,
              optionalPattern: config.optionalPattern,
              weightedPattern: config.weightedPattern,
              inquiryCount: config.inquiryCount,
              mathSelection: config.mathSelection,
              inquirySelection: config.inquirySelection,
              historySubstitute: config.historySubstitute,
              foreignSubstitute: config.foreignSubstitute,
              restrictions: restrictions.map((r) => ({
                type: r.restrictionType,
                description: r.description,
              })),
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("환산 설정 ");
        }
      },
    }),

    /**
     * 전 대학 배치 분석 (메인 도구)
     */
    runPlacementAnalysis: tool({
      description:
        "학생의 수능/모평 점수로 전 대학 배치 분석을 실행합니다. 5단계(안정/적정/소신/불안정/위험) 판정과 요약을 반환합니다. 분석 후 filterPlacementResults로 세부 조회가 가능합니다. 반드시 점수 정보를 먼저 확인한 후 호출하세요.",
      inputSchema: z.object({
        koreanRaw: z.number().nullable().describe("국어 원점수"),
        korean: z.number().nullable().describe("국어 표준점수"),
        mathType: z
          .enum(["미적분", "기하", "확률과통계"])
          .describe("수학 선택과목"),
        mathRaw: z.number().nullable().describe("수학 원점수"),
        math: z.number().nullable().describe("수학 표준점수"),
        english: z.number().nullable().describe("영어 등급 (1-9)"),
        history: z.number().nullable().describe("한국사 등급 (1-9)"),
        inquiry1Subject: z.string().describe("탐구1 과목명"),
        inquiry1Raw: z.number().nullable().describe("탐구1 원점수"),
        inquiry2Subject: z.string().describe("탐구2 과목명"),
        inquiry2Raw: z.number().nullable().describe("탐구2 원점수"),
        foreignLang: z
          .number()
          .nullable()
          .optional()
          .describe("제2외국어/한문 등급"),
        dataYear: z
          .number()
          .optional()
          .describe("데이터 연도 (기본: 2026)"),
      }),
      execute: async (input) => {
        logActionDebug(LOG_CTX, "runPlacementAnalysis: 배치 분석 시작");
        try {
          // MockScoreInput 구성
          const scoreInput: MockScoreInput = {
            koreanRaw: input.koreanRaw,
            korean: input.korean,
            mathType: input.mathType,
            mathRaw: input.mathRaw,
            math: input.math,
            english: input.english,
            history: input.history,
            inquiry1Subject: input.inquiry1Subject,
            inquiry1Raw: input.inquiry1Raw,
            inquiry2Subject: input.inquiry2Subject,
            inquiry2Raw: input.inquiry2Raw,
            foreignLang: input.foreignLang ?? null,
          };

          const suneungScores = convertToSuneungScores(scoreInput);
          const result = await analyzePlacement(
            ctx.studentId,
            suneungScores,
            input.dataYear,
          );

          // Closure 캐시 저장
          cachedAnalysis = result;
          cachedScoreInput = scoreInput;

          // 상위 20건만 반환 (토큰 절약)
          const topVerdicts = result.verdicts
            .slice(0, 20)
            .map(truncateVerdict);

          return {
            success: true,
            data: {
              summary: {
                total: result.summary.total,
                byLevel: {
                  안정: result.summary.byLevel.safe,
                  적정: result.summary.byLevel.possible,
                  소신: result.summary.byLevel.bold,
                  불안정: result.summary.byLevel.unstable,
                  위험: result.summary.byLevel.danger,
                },
                disqualified: result.summary.disqualified,
              },
              topVerdicts,
              message: `총 ${result.summary.total}개 대학 분석 완료. 상위 20건 표시. filterPlacementResults로 세부 조회 가능.`,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("배치 분석에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 배치 분석 결과 필터링
     */
    filterPlacementResults: tool({
      description:
        "가장 최근 배치 분석 결과를 필터링합니다. 반드시 runPlacementAnalysis를 먼저 실행한 후 사용하세요. 판정 수준, 지역, 계열, 대학명/학과명으로 검색할 수 있습니다.",
      inputSchema: z.object({
        levels: z
          .array(z.enum(["safe", "possible", "bold", "unstable", "danger"]))
          .optional()
          .describe("판정 수준 필터 (예: ['safe', 'possible'])"),
        region: z.string().optional().describe("지역 필터"),
        departmentType: z.string().max(30).optional().describe("계열 필터"),
        search: z
          .string()
          .optional()
          .describe("대학명 또는 학과명 검색"),
        limit: z
          .number()
          .optional()
          .describe("반환할 최대 개수 (기본: 20)"),
      }),
      execute: async ({ levels, region, departmentType, search, limit }) => {
        logActionDebug(LOG_CTX, `filterPlacementResults: levels=${levels?.join(",")}, search=${search}`);
        try {
          if (!cachedAnalysis) {
            return TOOL_ERRORS.NO_DATA("배치 분석 결과. 먼저 runPlacementAnalysis를 실행하세요");
          }

          const filtered = filterVerdicts(cachedAnalysis.verdicts, {
            levels,
            region: region ?? undefined,
            departmentType: departmentType ?? undefined,
            search: search ?? undefined,
          });

          const maxCount = limit ?? 20;
          const truncated = filtered.slice(0, maxCount).map(truncateVerdict);

          return {
            success: true,
            data: {
              results: truncated,
              totalFiltered: filtered.length,
              showing: truncated.length,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("결과 필터링에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 수시 6장 최적 배분 시뮬레이션
     */
    simulateCardAllocation: tool({
      description:
        "수시 6장 최적 배분 시뮬레이션을 실행합니다. 후보 대학/학과 목록을 입력하면 티어(소신/적정/안정) 균형, 전형 다양성, 면접 겹침을 고려한 최적 조합을 추천합니다.",
      inputSchema: z.object({
        candidates: z
          .array(
            z.object({
              id: z.string().describe("고유 식별자"),
              universityName: z.string(),
              department: z.string(),
              round: z
                .string()
                .describe("전형명 (예: '학생부종합', '논술')"),
              placementLevel: z.enum([
                "safe",
                "possible",
                "bold",
                "unstable",
                "danger",
              ]),
              interviewDate: z
                .string()
                .nullable()
                .optional()
                .describe("면접일 (YYYY-MM-DD)"),
            }),
          )
          .describe("후보 대학/학과 목록"),
        topN: z
          .number()
          .optional()
          .describe("상위 N개 추천 (기본: 3)"),
      }),
      execute: async ({ candidates, topN }) => {
        logActionDebug(LOG_CTX, `simulateCardAllocation: ${candidates.length}개 후보`);
        try {
          if (candidates.length < 6) {
            return TOOL_ERRORS.INVALID_INPUT(`최소 6개 후보가 필요합니다. 현재 ${candidates.length}개`);
          }

          const allocationCandidates: AllocationCandidate[] = candidates.map(
            (c) => ({
              id: c.id,
              universityName: c.universityName,
              department: c.department,
              round: c.round,
              placementLevel: c.placementLevel,
              interviewDate: c.interviewDate,
            }),
          );

          const recommendations = simulateAllocation(
            allocationCandidates,
            undefined,
            topN ?? 3,
          );

          return {
            success: true,
            data: {
              recommendations: recommendations.map((r, idx) => ({
                rank: idx + 1,
                score: r.score,
                slots: r.slots.map((s) => ({
                  university: s.universityName,
                  department: s.department,
                  round: s.round,
                  level: PLACEMENT_LABELS[s.placementLevel],
                })),
                tierBreakdown: {
                  소신: r.byTier.reach?.length ?? 0,
                  적정: r.byTier.target?.length ?? 0,
                  안정: r.byTier.safety?.length ?? 0,
                },
                warnings: r.warnings,
                interviewConflicts: r.interviewConflicts,
              })),
              totalCandidates: candidates.length,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("6장 배분 시뮬레이션에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 과목 점수 변경 What-If 분석
     */
    analyzeScoreImpact: tool({
      description:
        "특정 과목 점수를 변경했을 때 배치 결과가 어떻게 달라지는지 분석합니다. 예: '수학을 5점 올리면 어떤 대학이 추가로 가능해질까?' 반드시 runPlacementAnalysis를 먼저 실행한 후 사용하세요.",
      inputSchema: z.object({
        targetSubject: z
          .enum([
            "korean",
            "math",
            "english",
            "history",
            "inquiry1",
            "inquiry2",
            "foreignLang",
          ])
          .describe("변경할 과목"),
        improvedScore: z
          .number()
          .describe("개선된 점수 (원점수 또는 등급)"),
      }),
      execute: async ({ targetSubject, improvedScore }) => {
        logActionDebug(LOG_CTX, `analyzeScoreImpact: ${targetSubject} → ${improvedScore}`);
        try {
          if (!cachedAnalysis || !cachedScoreInput) {
            return TOOL_ERRORS.NO_DATA("배치 분석 결과. 먼저 runPlacementAnalysis를 실행하세요");
          }

          // 점수 수정
          const modified: MockScoreInput = { ...cachedScoreInput };
          switch (targetSubject) {
            case "korean":
              modified.koreanRaw = improvedScore;
              break;
            case "math":
              modified.mathRaw = improvedScore;
              break;
            case "english":
              modified.english = improvedScore;
              break;
            case "history":
              modified.history = improvedScore;
              break;
            case "inquiry1":
              modified.inquiry1Raw = improvedScore;
              break;
            case "inquiry2":
              modified.inquiry2Raw = improvedScore;
              break;
            case "foreignLang":
              modified.foreignLang = improvedScore;
              break;
          }

          const modifiedScores = convertToSuneungScores(modified);
          const newResult = await analyzePlacement(
            ctx.studentId,
            modifiedScores,
            cachedAnalysis.dataYear,
          );

          // 판정 변동 비교
          const originalMap = new Map(
            cachedAnalysis.verdicts.map((v) => [
              `${v.universityName}|${v.departmentName}`,
              v.level,
            ]),
          );

          const upgrades: Array<{
            university: string;
            department: string;
            from: string;
            to: string;
          }> = [];
          const downgrades: Array<{
            university: string;
            department: string;
            from: string;
            to: string;
          }> = [];

          for (const v of newResult.verdicts) {
            const key = `${v.universityName}|${v.departmentName}`;
            const original = originalMap.get(key);
            if (original && original !== v.level) {
              const levelOrder = ["danger", "unstable", "bold", "possible", "safe"];
              const origIdx = levelOrder.indexOf(original);
              const newIdx = levelOrder.indexOf(v.level);
              const change = {
                university: v.universityName,
                department: v.departmentName,
                from: PLACEMENT_LABELS[original],
                to: PLACEMENT_LABELS[v.level],
              };
              if (newIdx > origIdx) {
                upgrades.push(change);
              } else {
                downgrades.push(change);
              }
            }
          }

          return {
            success: true,
            data: {
              subject: targetSubject,
              improvedScore,
              originalSummary: {
                안정: cachedAnalysis.summary.byLevel.safe,
                적정: cachedAnalysis.summary.byLevel.possible,
                소신: cachedAnalysis.summary.byLevel.bold,
              },
              newSummary: {
                안정: newResult.summary.byLevel.safe,
                적정: newResult.summary.byLevel.possible,
                소신: newResult.summary.byLevel.bold,
              },
              upgrades: upgrades.slice(0, 15),
              upgradeCount: upgrades.length,
              downgrades: downgrades.slice(0, 5),
              downgradeCount: downgrades.length,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("점수 변경 영향 분석에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 대학별 학생부종합전형 평가 기준 조회
     */
    getUniversityEvalCriteria: tool({
      description:
        "특정 대학의 학생부종합전형 평가 기준(인재상, 서류평가 요소, 면접 형식, 수능최저, 합격 핵심 팁)을 조회합니다. 대학명으로 검색하면 해당 대학의 모든 종합전형 정보를 반환합니다.",
      inputSchema: z.object({
        universityName: z
          .string()
          .describe("대학명 (예: '서울대학교', '연세대학교')"),
        admissionName: z
          .string()
          .optional()
          .describe("세부 전형명 필터 (예: '활동우수형', '학업우수전형')"),
      }),
      execute: async ({ universityName, admissionName }) => {
        logActionDebug(LOG_CTX, `getUniversityEvalCriteria: ${universityName}`);
        try {
          const supabase = await createSupabaseServerClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 마이그레이션 적용 전 타입 미생성
          let query = (supabase.from as any)("university_evaluation_criteria")
            .select("*")
            .ilike("university_name", `%${universityName}%`)
            .order("admission_name");

          if (admissionName) {
            query = query.ilike("admission_name", `%${admissionName}%`);
          }

          const { data, error } = await query;

          if (error) {
            return {
              success: true,
              data: {
                criteria: [],
                message: "대학 평가 기준 데이터가 아직 수집되지 않았습니다. 일반적인 학생부종합전형 가이드를 참고하세요.",
              },
            };
          }

          if (!data || data.length === 0) {
            return {
              success: true,
              data: {
                criteria: [],
                message: `'${universityName}'의 평가 기준이 아직 수집되지 않았습니다. 일반적인 학생부종합전형 가이드를 참고하세요.`,
              },
            };
          }

          return {
            success: true,
            data: {
              criteria: data.map((row: Record<string, unknown>) => ({
                universityName: row.university_name,
                admissionType: row.admission_type,
                admissionName: row.admission_name,
                idealStudent: row.ideal_student,
                evaluationFactors: row.evaluation_factors,
                documentEvalDetails: row.document_eval_details,
                interviewFormat: row.interview_format,
                interviewDetails: row.interview_details,
                minScoreCriteria: row.min_score_criteria,
                keyTips: row.key_tips,
              })),
              totalCount: data.length,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("대학 평가 기준 ");
        }
      },
    }),

    /**
     * 면접 기출문제 조회
     */
    getInterviewQuestionBank: tool({
      description:
        "대학별 면접 기출문제를 조회합니다. 대학명, 학과 계열, 면접 유형으로 검색할 수 있습니다. 면접 코칭 시 실제 기출을 참고하세요.",
      inputSchema: z.object({
        universityName: z.string().max(50).describe("대학명"),
        departmentCategory: z.string().max(30).optional().describe("학과 계열 (예: '인문계열', '자연계열', '의예과')"),
        interviewType: z.enum(["서류확인", "제시문", "mmi", "토론"]).optional(),
      }),
      execute: async ({ universityName, departmentCategory, interviewType }) => {
        logActionDebug(LOG_CTX, `getInterviewQuestionBank: ${universityName}`);
        try {
          const supabase = await createSupabaseServerClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query = (supabase.from as any)("university_interview_bank")
            .select("*")
            .ilike("university_name", `%${universityName}%`)
            .order("data_year", { ascending: false });

          if (departmentCategory) query = query.ilike("department_category", `%${departmentCategory}%`);
          if (interviewType) query = query.eq("interview_type", interviewType);

          const { data, error } = await query.limit(20);

          if (error || !data || data.length === 0) {
            return { success: true, data: { questions: [], message: `'${universityName}'의 면접 기출이 아직 수집되지 않았습니다.` } };
          }

          return {
            success: true,
            data: {
              questions: data.map((q: Record<string, unknown>) => ({
                universityName: q.university_name,
                admissionName: q.admission_name,
                departmentCategory: q.department_category,
                interviewType: q.interview_type,
                dataYear: q.data_year,
                questionText: q.question_text,
                questionContext: q.question_context,
                answerGuide: q.answer_guide,
              })),
              totalCount: data.length,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("면접 기출 ");
        }
      },
    }),

    /**
     * 모집단위별 면접 분야 조회
     */
    getDepartmentInterviewField: tool({
      description:
        "대학의 모집단위(학과)별 면접 출제 분야, 면접 시간, 준비 시간을 조회합니다. 서울대 일반전형은 학과별로 면접 분야가 다릅니다.",
      inputSchema: z.object({
        universityName: z.string().max(50).describe("대학명"),
        departmentName: z.string().max(50).optional().describe("학과명 (미지정 시 전체 조회)"),
      }),
      execute: async ({ universityName, departmentName }) => {
        logActionDebug(LOG_CTX, `getDepartmentInterviewField: ${universityName} ${departmentName ?? "전체"}`);
        try {
          const supabase = await createSupabaseServerClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query = (supabase.from as any)("university_department_interview_fields")
            .select("*")
            .ilike("university_name", `%${universityName}%`)
            .order("college_name");

          if (departmentName) query = query.ilike("department_name", `%${departmentName}%`);

          const { data, error } = await query.limit(30);

          if (error || !data || data.length === 0) {
            return { success: true, data: { departments: [], message: `'${universityName}'의 모집단위별 면접 분야가 아직 수집되지 않았습니다.` } };
          }

          return {
            success: true,
            data: {
              departments: data.map((d: Record<string, unknown>) => ({
                collegeName: d.college_name,
                departmentName: d.department_name,
                interviewField: d.interview_field,
                interviewDuration: d.interview_duration,
                prepTime: d.prep_time,
              })),
              totalCount: data.length,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("모집단위 면접 분야 ");
        }
      },
    }),

    /**
     * 수능최저학력기준 시뮬레이션 (Phase G S-3-b: record-tools 에서 이관)
     */
    simulateMinScoreRequirement: tool({
      description:
        "수능최저 충족 여부 시뮬레이션. 부족 시 개선 과목 제안.",
      inputSchema: z.object({
        grades: z
          .record(z.number())
          .describe("현재 등급. 예: { '국어': 2, '수학': 3, '영어': 1, '탐구1': 3, '탐구2': 4, '한국사': 2 }"),
        criteriaType: z
          .enum(["grade_sum", "single_grade", "none"])
          .describe("최저 유형"),
        subjects: z
          .array(z.string())
          .optional()
          .describe("반영 과목 목록 (grade_sum용). 예: ['국어', '수학', '영어', '탐구1']"),
        count: z
          .number()
          .optional()
          .describe("반영 과목 수 (subjects 중 상위 N개 선택)"),
        maxSum: z
          .number()
          .optional()
          .describe("등급합 기준. 예: 7 (4개 합 7 이내)"),
      }),
      execute: async ({ grades, criteriaType, subjects, count, maxSum }) => {
        logActionDebug(LOG_CTX, `simulateMinScoreRequirement: type=${criteriaType}`);
        try {
          const { simulateMinScore } = await import(
            "@/lib/domains/student-record/min-score-simulator"
          );

          const criteria = {
            type: criteriaType,
            subjects: subjects ?? [],
            count: count ?? subjects?.length ?? 4,
            maxSum: maxSum ?? 99,
            additional: [] as Array<{ subject: string; maxGrade?: number }>,
          };

          const result = simulateMinScore(criteria, grades);

          return {
            success: true,
            data: {
              isMet: result.isMet,
              gradeSum: result.gradeSum,
              gap: result.gap,
              bottleneckSubjects: result.bottleneckSubjects,
              whatIf: result.whatIf,
              recommendation: result.isMet
                ? "수능최저학력기준을 충족합니다."
                : `${result.gap}점 부족합니다. ${result.bottleneckSubjects.join(", ")} 과목 개선이 가장 효과적입니다.`,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("수능최저 시뮬레이션 실패.", { retryable: true, actionHint: "입력 등급을 확인하고 다시 시도하세요." });
        }
      },
    }),
  };
}
