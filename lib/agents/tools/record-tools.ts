// ============================================
// Agent 1: 생기부 분석 도구
// 기존 LLM action의 core 로직을 tool()로 래핑
// auth 가드 없이 직접 호출 (API route에서 이미 인증 완료)
// ============================================

import { tool } from "ai";
import { z } from "zod";
import { type AgentContext, truncateWithMarker, toolError, TOOL_ERRORS } from "../types";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";

// 프롬프트 임포트
import {
  SYSTEM_PROMPT as TAG_SYSTEM_PROMPT,
  buildUserPrompt as buildTagUserPrompt,
  parseResponse as parseTagResponse,
} from "@/lib/domains/student-record/llm/prompts/competencyTagging";
import {
  HIGHLIGHT_SYSTEM_PROMPT,
  buildHighlightUserPrompt,
  parseHighlightResponse,
} from "@/lib/domains/student-record/llm/prompts/competencyHighlight";
import {
  INQUIRY_LINK_SYSTEM_PROMPT,
  buildInquiryLinkUserPrompt,
  parseInquiryLinkResponse,
} from "@/lib/domains/student-record/llm/prompts/inquiryLinking";
import type { RecordSummary } from "@/lib/domains/student-record/llm/prompts/inquiryLinking";
import { COMPETENCY_ITEMS, COMPETENCY_RUBRIC_QUESTIONS, COMPETENCY_AREA_LABELS, MAJOR_RECOMMENDED_COURSES, ADMISSION_TYPE_HINTS } from "@/lib/domains/student-record/constants";
import type { CompetencyItemCode, CompetencyGrade } from "@/lib/domains/student-record/types";
import { determineGradeSystem } from "@/lib/domains/student-record/grade-normalizer";
import { buildEdgeSummary } from "@/lib/domains/student-record/edge-summary";
import type { PipelineTaskKey } from "@/lib/domains/student-record/pipeline-types";
import { generateSetekDraftAction } from "@/lib/domains/student-record/llm/actions/generateSetekDraft";
import { upsertDiagnosis } from "@/lib/domains/student-record/diagnosis-repository";
import { upsertCompetencyScore } from "@/lib/domains/student-record/competency-repository";
import { insertStrategy } from "@/lib/domains/student-record/diagnosis-repository";
import {
  fetchPipelineStatus,
  runInitialAnalysisPipeline,
  rerunPipelineTasks,
} from "@/lib/domains/student-record/actions/pipeline";
import { calculateCourseAdequacy } from "@/lib/domains/student-record/course-adequacy";
import { generateRecommendationsAction } from "@/lib/domains/student-record/actions/coursePlan";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "record-tools" };

export function createRecordTools(ctx: AgentContext) {
  return {
    /**
     * 세특/창체 텍스트 → 역량 태그 제안
     */
    suggestTags: tool({
      description:
        "세특이나 창체 텍스트를 분석하여 역량 태그를 제안합니다. 어떤 역량이 드러나는지, 평가(긍정/부정/확인필요)와 근거를 함께 제공합니다.",
      inputSchema: z.object({
        content: z.string().describe("분석할 세특/창체 텍스트"),
        recordType: z
          .enum(["setek", "personal_setek", "changche", "haengteuk"])
          .describe("기록 유형"),
        subjectName: z.string().optional().describe("교과명"),
        grade: z.number().optional().describe("학년"),
      }),
      execute: async ({ content, recordType, subjectName, grade }) => {
        logActionDebug(LOG_CTX, `suggestTags: type=${recordType}`);
        try {
          if (content.trim().length < 20) {
            return toolError("분석할 텍스트가 너무 짧습니다 (20자 이상 필요).", { actionHint: "더 긴 세특 텍스트를 전달하세요." });
          }
          const userPrompt = buildTagUserPrompt({ content, recordType, subjectName, grade });
          const result = await generateTextWithRateLimit({
            system: TAG_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.3,
            maxTokens: 2000,
          });
          if (!result.content) {
            return TOOL_ERRORS.AI_FORMAT;
          }
          return { success: true, data: parseTagResponse(result.content) };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("역량 태그 분석 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 전체 기록 → 10개 역량 등급 분석
     */
    analyzeCompetency: tool({
      description:
        "학생의 전체 생기부 기록을 종합하여 10개 역량 항목별 등급(A+~C)을 평가합니다. 각 등급에 대한 근거와 해석 서술을 함께 제공합니다.",
      inputSchema: z.object({
        records: z
          .array(
            z.object({
              type: z.string().describe("기록 유형 (setek, changche, 등)"),
              label: z.string().describe("표시 라벨"),
              content: z.string().describe("기록 내용"),
            }),
          )
          .describe("분석할 생기부 기록 배열"),
        admissionType: z
          .enum(["종합", "교과", "논술", "정시"])
          .optional()
          .describe("지원 전형 유형 (있으면 해당 전형에 맞춰 역량 가중치 조정)"),
      }),
      execute: async ({ records, admissionType }) => {
        logActionDebug(LOG_CTX, `analyzeCompetency: ${records.length}건`);
        try {
          if (records.length === 0) {
            return TOOL_ERRORS.NO_DATA("분석할 생기부 기록");
          }
          const competencySchema = COMPETENCY_ITEMS.map((item) => {
            const questions = COMPETENCY_RUBRIC_QUESTIONS[item.code];
            return `- ${item.code} (${item.label}): ${item.evalTarget}\n  루브릭: ${questions.join(" / ")}`;
          }).join("\n");

          const systemPrompt = `당신은 대입 컨설팅 전문가입니다. 학생의 생기부 전체 기록을 분석하여 10개 역량 항목의 등급을 평가합니다.

## 역량 체계 (3대 역량 × 10개 항목)

${competencySchema}

## 등급 기준
- A+: 해당 역량이 매우 우수하게 확인됨
- A-: 우수하게 확인됨
- B+: 양호하게 확인됨
- B: 보통 수준
- B-: 다소 부족
- C: 부족

## 규칙
1. 모든 10개 항목에 대해 등급을 제안하세요.
2. 각 등급에 1-2문장의 근거(reasoning)를 제시하세요.
3. 각 등급에 2-3문장의 해석 서술(narrative)을 작성하세요.
4. JSON 형식으로만 응답하세요.${admissionType ? `\n\n## 전형 맥락: ${admissionType}\n${ADMISSION_TYPE_HINTS[admissionType]}` : ""}

## 출력 형식
\`\`\`json
{
  "items": [{ "competencyItem": "...", "suggestedGrade": "B+", "reasoning": "...", "narrative": "..." }],
  "summary": "..."
}
\`\`\``;

          const MAX_ANALYSIS_INPUT_CHARS = 10000;
          let rawText = records
            .map((r) => `[${r.label}]\n${r.content}`)
            .join("\n\n---\n\n");

          if (rawText.length > MAX_ANALYSIS_INPUT_CHARS) {
            const ratio = MAX_ANALYSIS_INPUT_CHARS / rawText.length;
            rawText = records
              .map((r) => {
                const maxLen = Math.max(100, Math.floor(r.content.length * ratio));
                const truncated = truncateWithMarker(r.content, maxLen) ?? r.content;
                return `[${r.label}]\n${truncated}`;
              })
              .join("\n\n---\n\n");
          }

          const recordText = rawText;
          const userPrompt = `## 분석 대상 학생의 생기부 기록 (${records.length}건)\n\n${recordText}\n\n위 생기부 전체 기록을 종합 분석하여 10개 역량 항목의 등급을 JSON으로 제안해주세요.`;

          const result = await generateTextWithRateLimit({
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.3,
            maxTokens: 4000,
          });

          if (!result.content) {
            return TOOL_ERRORS.AI_FORMAT;
          }

          let jsonStr = result.content.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            logActionError(LOG_CTX, `analyzeCompetency JSON 파싱 실패: ${jsonStr.slice(0, 200)}`);
            return TOOL_ERRORS.AI_FORMAT;
          }
          const validCodes = new Set<string>(COMPETENCY_ITEMS.map((i) => i.code));
          const validGrades = new Set<string>(["A+", "A-", "B+", "B", "B-", "C"]);

          const items = (Array.isArray(parsed.items) ? parsed.items : [])
            .filter(
              (i: { competencyItem: string; suggestedGrade: string }) =>
                validCodes.has(i.competencyItem) && validGrades.has(i.suggestedGrade),
            )
            .map(
              (i: {
                competencyItem: string;
                suggestedGrade: string;
                reasoning?: string;
                narrative?: string;
              }) => ({
                competencyItem: i.competencyItem as CompetencyItemCode,
                suggestedGrade: i.suggestedGrade as CompetencyGrade,
                reasoning: String(i.reasoning ?? ""),
                narrative: String(i.narrative ?? ""),
              }),
            );

          return {
            success: true,
            data: { items, summary: String(parsed.summary ?? "") },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("역량 분석 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 세특 원문 → 구절별 역량 하이라이트 분석
     */
    analyzeHighlight: tool({
      description:
        "세특 텍스트의 구절을 분석하여 각 구절에 어떤 역량이 드러나는지 하이라이트합니다. 원문 인용과 역량 매핑을 제공합니다.",
      inputSchema: z.object({
        content: z.string().describe("분석할 세특 텍스트"),
        recordType: z
          .enum(["setek", "personal_setek", "changche", "haengteuk"])
          .describe("기록 유형"),
        subjectName: z.string().optional().describe("교과명"),
        admissionType: z
          .enum(["종합", "교과", "논술", "정시"])
          .optional()
          .describe("지원 전형 유형"),
      }),
      execute: async ({ content, recordType, subjectName, admissionType }) => {
        logActionDebug(LOG_CTX, `analyzeHighlight: type=${recordType}`);
        try {
          if (content.trim().length < 20) {
            return toolError("텍스트가 너무 짧습니다.", { actionHint: "더 긴 세특 텍스트를 전달하세요." });
          }
          const userPrompt = buildHighlightUserPrompt({ content, recordType, subjectName });
          const admissionContext = admissionType
            ? `\n\n## 전형 맥락: ${admissionType}\n${ADMISSION_TYPE_HINTS[admissionType]}`
            : "";
          const result = await generateTextWithRateLimit({
            system: HIGHLIGHT_SYSTEM_PROMPT + admissionContext,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.3,
            maxTokens: 4000,
          });
          if (!result.content) {
            return TOOL_ERRORS.AI_FORMAT;
          }
          return { success: true, data: parseHighlightResponse(result.content) };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("하이라이트 분석 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 학년간 탐구 연결 감지
     */
    detectStoryline: tool({
      description:
        "여러 학년의 세특 기록에서 탐구 주제 연결(스토리라인)을 자동으로 감지합니다. 학년간 일관된 탐구 흐름과 잠재적 연결고리를 찾아냅니다.",
      inputSchema: z.object({
        records: z
          .array(
            z.object({
              index: z.number().describe("기록 인덱스"),
              id: z.string().describe("기록 ID"),
              grade: z.number().describe("학년"),
              subject: z.string().describe("교과명"),
              type: z.string().describe("기록 유형 (setek, changche 등)"),
              content: z.string().describe("세특 내용"),
            }),
          )
          .describe("분석할 세특 기록 배열 (학년별)"),
        admissionType: z
          .enum(["종합", "교과", "논술", "정시"])
          .optional()
          .describe("지원 전형 유형 (종합전형은 스토리라인 깊이 분석, 정시는 간략 분석)"),
      }),
      execute: async ({ records, admissionType }) => {
        logActionDebug(LOG_CTX, `detectStoryline: ${records.length}건`);
        try {
          if (records.length < 2) {
            return toolError("탐구 연결 감지에는 최소 2건의 기록이 필요합니다.", { actionHint: "getStudentRecords로 기록을 먼저 확인하세요." });
          }
          const summaries: RecordSummary[] = records.map((r) => ({
            index: r.index,
            id: r.id,
            grade: r.grade,
            subject: r.subject,
            type: r.type,
            content: r.content,
          }));
          const userPrompt = buildInquiryLinkUserPrompt(summaries);
          const admissionContext = admissionType
            ? `\n\n## 전형 맥락: ${admissionType}\n${ADMISSION_TYPE_HINTS[admissionType]}`
            : "";
          const result = await generateTextWithRateLimit({
            system: INQUIRY_LINK_SYSTEM_PROMPT + admissionContext,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.3,
            maxTokens: 3000,
          });
          if (!result.content) {
            return TOOL_ERRORS.AI_FORMAT;
          }
          return {
            success: true,
            data: parseInquiryLinkResponse(result.content, records.length - 1),
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("스토리라인 감지 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 역량 데이터 기반 종합 진단 생성
     */
    generateDiagnosis: tool({
      description:
        "학생의 역량 등급과 활동 태그를 기반으로 종합 진단을 생성합니다. 강점, 약점, 추천 전공, 전략 메모를 포함합니다.",
      inputSchema: z.object({
        competencyScores: z
          .array(
            z.object({
              competency_item: z.string(),
              grade_value: z.string(),
              source: z.string(),
            }),
          )
          .describe("역량 등급 배열"),
        activityTags: z
          .array(
            z.object({
              competency_item: z.string(),
              evaluation: z.enum(["positive", "negative", "needs_review"]),
              evidence_summary: z.string().optional(),
            }),
          )
          .describe("활동 태그 배열"),
        targetMajor: z.string().optional().describe("희망 전공"),
        admissionType: z
          .enum(["종합", "교과", "논술", "정시"])
          .optional()
          .describe("지원 전형 유형"),
      }),
      execute: async ({ competencyScores, activityTags, targetMajor, admissionType }) => {
        logActionDebug(LOG_CTX, `generateDiagnosis: scores=${competencyScores.length}, tags=${activityTags.length}`);
        try {
          if (competencyScores.length === 0 && activityTags.length === 0) {
            return TOOL_ERRORS.NO_DATA("역량 등급/활동 태그");
          }

          const MAJOR_LIST = Object.keys(MAJOR_RECOMMENDED_COURSES).join(", ");

          const gradesSummary = COMPETENCY_ITEMS.map((item) => {
            const score = competencyScores.find(
              (s) => s.competency_item === item.code,
            );
            return `- ${COMPETENCY_AREA_LABELS[item.area]} > ${item.label}: ${score?.grade_value ?? "미평가"}`;
          }).join("\n");

          const positiveTags = activityTags.filter((t) => t.evaluation === "positive");
          const negativeTags = activityTags.filter((t) => t.evaluation === "negative");
          const reviewTags = activityTags.filter((t) => t.evaluation === "needs_review");

          const tagsSummary = [
            `긍정 태그 (${positiveTags.length}건):`,
            ...positiveTags.slice(0, 15).map((t) =>
              `  - ${COMPETENCY_ITEMS.find((i) => i.code === t.competency_item)?.label ?? t.competency_item}: ${truncateWithMarker(t.evidence_summary, 80) ?? ""}`,
            ),
            negativeTags.length > 0 ? `부정 태그 (${negativeTags.length}건):` : "",
            ...negativeTags.map((t) =>
              `  - ${COMPETENCY_ITEMS.find((i) => i.code === t.competency_item)?.label ?? t.competency_item}: ${truncateWithMarker(t.evidence_summary, 80) ?? ""}`,
            ),
            reviewTags.length > 0 ? `확인필요 (${reviewTags.length}건):` : "",
            ...reviewTags.map((t) =>
              `  - ${COMPETENCY_ITEMS.find((i) => i.code === t.competency_item)?.label ?? t.competency_item}: ${truncateWithMarker(t.evidence_summary, 80) ?? ""}`,
            ),
          ].filter(Boolean).join("\n");

          const systemPrompt = `당신은 대입 컨설팅 전문가입니다. 학생의 역량 평가 데이터를 종합하여 진단 보고서를 작성합니다.

## 진단 항목
1. overallGrade: 종합 등급 (A+/A-/B+/B/B-/C)
2. recordDirection: 생기부 기록 방향 (50자 이내)
3. directionStrength: 방향 강도 (strong/moderate/weak)
4. strengths: 강점 3~5개
5. weaknesses: 약점 2~4개
6. recommendedMajors: 추천 전공 2~3개 (선택: ${MAJOR_LIST})
7. strategyNotes: 전략 메모 (100자 이내)

## 규칙
- 역량 등급과 활동 태그 기반 판단
- JSON으로만 응답${admissionType ? `\n\n## 전형 맥락: ${admissionType}\n${ADMISSION_TYPE_HINTS[admissionType]}` : ""}`;

          const userPrompt = `## 학생 정보
${targetMajor ? `- 희망 전공: ${targetMajor}` : "- 희망 전공: 미정"}

## 역량 등급 (10항목)
${gradesSummary}

## 활동 태그 (총 ${activityTags.length}건)
${tagsSummary}

위 데이터를 종합하여 진단 보고서를 JSON으로 작성해주세요.`;

          const result = await generateTextWithRateLimit({
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.3,
            maxTokens: 2000,
          });

          if (!result.content) {
            return TOOL_ERRORS.AI_FORMAT;
          }

          let jsonStr = result.content.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            logActionError(LOG_CTX, `generateDiagnosis JSON 파싱 실패: ${jsonStr.slice(0, 200)}`);
            return TOOL_ERRORS.AI_FORMAT;
          }
          const validGrades = new Set(["A+", "A-", "B+", "B", "B-", "C"]);
          const validStrengths = new Set(["strong", "moderate", "weak"]);

          const og = String(parsed.overallGrade ?? "B");
          const ds = String(parsed.directionStrength ?? "moderate");

          return {
            success: true,
            data: {
              overallGrade: validGrades.has(og) ? og : "B",
              recordDirection: String(parsed.recordDirection ?? "").slice(0, 50),
              directionStrength: validStrengths.has(ds) ? ds : "moderate",
              strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
              weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
              recommendedMajors: Array.isArray(parsed.recommendedMajors)
                ? parsed.recommendedMajors.map(String)
                : [],
              strategyNotes: String(parsed.strategyNotes ?? ""),
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("종합 진단 생성 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 교차 과목 분석 — 전 과목 세특을 한 번에 비교하여 패턴 감지
     * UI가 1-3과목만 동시 표시하는 한계를 에이전트가 보완
     */
    crossSubjectAnalysis: tool({
      description:
        "모든 과목의 세특을 교차 분석하여 UI에서 동시에 볼 수 없는 패턴을 찾습니다. " +
        "역량 분포 불균형, 스토리라인 일관성, 교과 간 강약점을 분석합니다. " +
        "반드시 getStudentRecords로 데이터를 먼저 조회한 후 사용하세요.",
      inputSchema: z.object({
        schoolYear: z.number().optional().describe("학년도 (기본: 현재)"),
        focusArea: z
          .enum(["consistency", "gaps", "strengths", "all"])
          .optional()
          .describe("분석 초점: consistency(일관성), gaps(공백/약점), strengths(강점), all(전체)"),
      }),
      execute: async ({ schoolYear, focusArea = "all" }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `crossSubjectAnalysis: year=${year}, focus=${focusArea}`);
        try {
          if (!ctx.tenantId) {
            return TOOL_ERRORS.NO_TENANT;
          }

          const { getRecordTabData: fetchRecords } = await import(
            "@/lib/domains/student-record/service"
          );
          const { findActivityTags: fetchTags, findCompetencyScores: fetchScores } =
            await import("@/lib/domains/student-record/competency-repository");

          const [recordRes, tagsRes, scoresRes] = await Promise.allSettled([
            fetchRecords(ctx.studentId, year, ctx.tenantId),
            fetchTags(ctx.studentId, ctx.tenantId),
            fetchScores(ctx.studentId, year, ctx.tenantId),
          ]);
          if (recordRes.status === "rejected") {
            logActionError(LOG_CTX, recordRes.reason);
            return TOOL_ERRORS.DB_ERROR("기록 데이터");
          }
          const recordData = recordRes.value;
          const tags = tagsRes.status === "fulfilled" ? tagsRes.value : [];
          const scores = scoresRes.status === "fulfilled" ? scoresRes.value : [];
          if (tagsRes.status === "rejected") logActionError(LOG_CTX, tagsRes.reason);
          if (scoresRes.status === "rejected") logActionError(LOG_CTX, scoresRes.reason);

          const seteks = recordData.seteks;
          const subjectCount = new Set(seteks.map((s) => s.subject_id)).size;

          // 과목별 세특 길이 + 내용 요약
          const subjectSummaries = new Map<string, { charTotal: number; semesters: number; hasAiDraft: boolean; hasConfirmed: boolean }>();
          for (const s of seteks) {
            const key = s.subject_id;
            const prev = subjectSummaries.get(key) ?? { charTotal: 0, semesters: 0, hasAiDraft: false, hasConfirmed: false };
            prev.charTotal += (s.content?.length ?? 0);
            prev.semesters++;
            if (s.ai_draft_content) prev.hasAiDraft = true;
            if (s.confirmed_content) prev.hasConfirmed = true;
            subjectSummaries.set(key, prev);
          }

          // 역량 분포 분석
          const competencyDist = new Map<string, number>();
          for (const score of scores) {
            const current = competencyDist.get(score.competency_item) ?? 0;
            competencyDist.set(score.competency_item, current + 1);
          }

          // 태그 분포 (긍정/부정) — activity_tags는 학년도 구분 없이 전체
          const positiveCount = tags.filter((t) => t.evaluation === "positive").length;
          const negativeCount = tags.filter((t) => t.evaluation === "negative").length;

          // 비어 있는 과목 (content 없음)
          const emptySubjects = seteks
            .filter((s) => !s.content && !s.imported_content)
            .map((s) => s.subject_id);

          // AI 초안은 있으나 가안 없는 과목
          const pendingReview = seteks
            .filter((s) => s.ai_draft_content && !s.content)
            .map((s) => s.subject_id);

          return {
            success: true,
            data: {
              overview: {
                totalSubjects: subjectCount,
                totalSeteks: seteks.length,
                totalCharacters: seteks.reduce((sum, s) => sum + (s.content?.length ?? 0), 0),
              },
              competencyDistribution: Object.fromEntries(competencyDist),
              tagBalance: { positive: positiveCount, negative: negativeCount },
              emptySubjects: [...new Set(emptySubjects)],
              pendingAiReview: [...new Set(pendingReview)],
              subjectDetails: Object.fromEntries(
                Array.from(subjectSummaries.entries()).map(([id, v]) => [id, v]),
              ),
              focusArea,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("교차 과목 분석 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    // ============================================
    // 쓰기 도구 — 세특 초안 / 진단 저장 / 파이프라인 / 수강
    // ============================================

    /**
     * 세특 초안 AI 생성
     */
    generateSetekDraft: tool({
      description:
        "과목별 세특 초안을 AI로 생성합니다 (NEIS 500자 이내, 자동 DB 저장).",
      inputSchema: z.object({
        recordId: z.string().describe("세특 레코드 ID"),
        subjectName: z.string().describe("과목명"),
        grade: z.number().describe("학년"),
        direction: z.string().optional().describe("세특 방향 가이드 텍스트"),
        keywords: z.array(z.string()).optional().describe("포함할 키워드 (3-5개)"),
        targetMajor: z.string().optional().describe("희망 전공"),
        existingContent: z.string().optional().describe("기존 세특 내용 (중복 방지용)"),
      }),
      execute: async (input) => {
        logActionDebug(LOG_CTX, `generateSetekDraft: ${input.subjectName}`);
        try {
          const result = await generateSetekDraftAction(input.recordId, {
            subjectName: input.subjectName,
            grade: input.grade,
            direction: input.direction,
            keywords: input.keywords,
            targetMajor: input.targetMajor,
            existingContent: input.existingContent,
          });
          if (!result.success) return toolError(result.error ?? "세특 초안 생성 실패.", { retryable: true, actionHint: "다시 시도하세요." });
          return {
            success: true,
            data: {
              draftContent: result.data!.draftContent,
              message: "세특 초안이 생성되어 DB에 저장되었습니다.",
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("세특 초안 생성 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 종합 진단 결과 DB 저장
     */
    saveDiagnosisResult: tool({
      description:
        "종합 진단을 DB에 저장합니다 (source=ai). 사용자 요청 시에만 호출.",
      inputSchema: z.object({
        overallGrade: z.string().describe("종합 등급 (A+~C)"),
        strengths: z.array(z.string()).describe("강점 3~5개"),
        weaknesses: z.array(z.string()).describe("약점 2~4개"),
        recordDirection: z.string().optional().describe("생기부 기록 방향"),
        recommendedMajors: z.array(z.string()).optional().describe("추천 전공"),
        strategyNotes: z.string().optional().describe("전략 메모"),
      }),
      execute: async (input) => {
        logActionDebug(LOG_CTX, "saveDiagnosisResult");
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;
          const id = await upsertDiagnosis({
            tenant_id: ctx.tenantId,
            student_id: ctx.studentId,
            school_year: ctx.schoolYear,
            source: "ai",
            overall_grade: input.overallGrade,
            strengths: input.strengths,
            weaknesses: input.weaknesses,
            record_direction: input.recordDirection,
            recommended_majors: input.recommendedMajors,
            strategy_notes: input.strategyNotes,
          });
          return { success: true, data: { diagnosisId: id, message: "진단 결과가 저장되었습니다." } };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("진단 저장 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 역량 등급 DB 저장
     */
    saveCompetencyScore: tool({
      description:
        "역량 등급을 DB에 저장합니다. 사용자 요청 시에만 호출.",
      inputSchema: z.object({
        competencyItem: z.string().describe("역량 코드 (academic_achievement 등)"),
        gradeValue: z.string().describe("등급 (A+~C)"),
        reasoning: z.string().optional().describe("등급 근거"),
      }),
      execute: async (input) => {
        logActionDebug(LOG_CTX, `saveCompetencyScore: ${input.competencyItem}=${input.gradeValue}`);
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;
          const itemDef = COMPETENCY_ITEMS.find((i) => i.code === input.competencyItem);
          if (!itemDef) return TOOL_ERRORS.INVALID_INPUT(`알 수 없는 역량 코드: ${input.competencyItem}`);
          const id = await upsertCompetencyScore({
            tenant_id: ctx.tenantId,
            student_id: ctx.studentId,
            school_year: ctx.schoolYear,
            scope: "all",
            competency_area: itemDef.area,
            competency_item: input.competencyItem as CompetencyItemCode,
            source: "ai",
            grade_value: input.gradeValue as CompetencyGrade,
          });
          return { success: true, data: { scoreId: id } };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("역량 등급 저장 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 보완전략 DB 저장
     */
    saveStrategy: tool({
      description:
        "보완전략을 DB에 저장합니다. 사용자 요청 시에만 호출.",
      inputSchema: z.object({
        targetArea: z.enum(["autonomy", "club", "career", "setek", "personal_setek", "reading", "haengteuk", "score", "general"]).describe("보완 영역"),
        strategyContent: z.string().describe("전략 내용"),
        priority: z.enum(["critical", "high", "medium", "low"]).describe("우선순위"),
        reasoning: z.string().optional().describe("전략 근거"),
      }),
      execute: async (input) => {
        logActionDebug(LOG_CTX, `saveStrategy: ${input.targetArea}`);
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;
          const id = await insertStrategy({
            tenant_id: ctx.tenantId,
            student_id: ctx.studentId,
            school_year: ctx.schoolYear,
            grade: ctx.studentGrade ?? 1,
            target_area: input.targetArea,
            strategy_content: input.strategyContent,
            priority: input.priority,
            reasoning: input.reasoning,
          });
          return { success: true, data: { strategyId: id, message: "보완전략이 저장되었습니다." } };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("보완전략 저장 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * AI 분석 파이프라인 상태 조회
     */
    getPipelineStatus: tool({
      description: "AI 분석 파이프라인(12개 태스크)의 현재 상태를 조회합니다.",
      inputSchema: z.object({}),
      execute: async () => {
        logActionDebug(LOG_CTX, "getPipelineStatus");
        try {
          const result = await fetchPipelineStatus(ctx.studentId);
          if (!result.success || !result.data) {
            return { success: true, data: { status: null, message: "파이프라인이 아직 실행되지 않았습니다." } };
          }
          const p = result.data;
          return {
            success: true,
            data: {
              status: p.status,
              tasks: p.tasks,
              startedAt: p.startedAt,
              completedAt: p.completedAt,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("파이프라인 상태");
        }
      },
    }),

    /**
     * AI 분석 파이프라인 실행/재실행
     */
    triggerPipeline: tool({
      description:
        "AI 분석 파이프라인 실행 (30-120초). taskKeys 지정 시 특정 태스크만 재실행.",
      inputSchema: z.object({
        taskKeys: z
          .array(z.string())
          .optional()
          .describe("재실행할 태스크 키 배열 (미지정 시 전체 실행). 예: ['ai_diagnosis', 'setek_guide']"),
      }),
      execute: async ({ taskKeys }) => {
        logActionDebug(LOG_CTX, `triggerPipeline: tasks=${taskKeys?.join(",") ?? "full"}`);
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;

          if (taskKeys && taskKeys.length > 0) {
            const statusResult = await fetchPipelineStatus(ctx.studentId);
            if (!statusResult.success || !statusResult.data) {
              return toolError("재실행할 파이프라인이 없습니다.", { actionHint: "triggerPipeline(taskKeys 없이)으로 전체 실행을 먼저 하세요." });
            }
            const result = await rerunPipelineTasks(
              statusResult.data.id,
              taskKeys as PipelineTaskKey[],
            );
            if (!result.success) return toolError(result.error ?? "파이프라인 재실행 실패.", { retryable: true, actionHint: "다시 시도하세요." });

            // API route로 실행 트리거
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
            const { pipelineId: pid, studentId: sid, tenantId: tid, studentSnapshot, existingState } = result.data!;
            fetch(`${baseUrl}/api/admin/pipeline/run`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pipelineId: pid, studentId: sid, tenantId: tid, studentSnapshot, existingState }),
            }).catch(() => {});

            return {
              success: true,
              data: { pipelineId: pid, mode: "rerun", tasks: taskKeys },
            };
          }

          const result = await runInitialAnalysisPipeline(ctx.studentId, ctx.tenantId);
          if (!result.success) return toolError(result.error ?? "파이프라인 실행 실패.", { retryable: true, actionHint: "다시 시도하세요." });

          // API route로 실행 트리거
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
          const { pipelineId: pid2, studentId: sid2, tenantId: tid2, studentSnapshot: snap } = result.data!;
          fetch(`${baseUrl}/api/admin/pipeline/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pipelineId: pid2, studentId: sid2, tenantId: tid2, studentSnapshot: snap }),
          }).catch(() => {});
          return {
            success: true,
            data: {
              pipelineId: result.data!.pipelineId,
              mode: "full",
              message: "파이프라인 실행 시작 (30-120초 소요). getPipelineStatus로 상태를 확인하세요.",
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("파이프라인 실행 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 전공별 교과이수적합도 계산
     */
    getCourseAdequacy: tool({
      description: "학생의 전공별 교과이수적합도를 계산합니다 (0-100점). 이수한 과목과 추천 과목을 비교합니다.",
      inputSchema: z.object({
        majorCategory: z.string().describe("전공 계열 (경영·경제, 컴퓨터·정보, 의학·약학 등)"),
      }),
      execute: async ({ majorCategory }) => {
        logActionDebug(LOG_CTX, `getCourseAdequacy: ${majorCategory}`);
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;

          const supabase = await createSupabaseServerClient();

          // 학생의 이수 과목 조회 (성적이 있는 과목)
          const { data: scores } = await supabase
            .from("student_internal_scores")
            .select("subject_id")
            .eq("student_id", ctx.studentId);

          const takenSubjects = (scores ?? []).map(
            (s: { subject_id: string }) => s.subject_id,
          );

          // 학교 개설 과목 조회
          const { data: student } = await supabase
            .from("students")
            .select("school_name")
            .eq("id", ctx.studentId)
            .maybeSingle();

          let offeredSubjects: string[] | null = null;
          if (student?.school_name) {
            const { data: offered } = await supabase
              .from("school_offered_subjects")
              .select("subject_id")
              .eq("school_name", student.school_name);
            offeredSubjects = (offered ?? []).map(
              (s: { subject_id: string }) => s.subject_id,
            );
          }

          const result = calculateCourseAdequacy(
            majorCategory,
            takenSubjects,
            offeredSubjects,
          );

          if (!result) {
            return TOOL_ERRORS.RESOURCE_NOT_FOUND(`'${majorCategory}' 추천 과목 정보`);
          }
          return { success: true, data: result };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("교과이수적합도 계산 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * AI 수강 추천 생성
     */
    recommendCourses: tool({
      description:
        "학생의 목표 전공에 맞는 추천 과목을 생성하고 DB에 저장합니다. 기존 추천은 덮어씁니다.",
      inputSchema: z.object({}),
      execute: async () => {
        logActionDebug(LOG_CTX, "recommendCourses");
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;
          const result = await generateRecommendationsAction(ctx.studentId, ctx.tenantId);
          if (!result.success) return toolError(result.error ?? "수강 추천 실패.", { retryable: true, actionHint: "다시 시도하세요." });
          return {
            success: true,
            data: {
              count: (result.data ?? []).length,
              message: `${(result.data ?? []).length}개 과목이 추천되었습니다.`,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("수강 추천 생성 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 내신 등급 추이 분석
     */
    analyzeGradeTrend: tool({
      description:
        "학생의 학기별 내신 등급 변화를 분석합니다. 전체 평균 추이, 과목군별 추이, 상승/하락 패턴을 반환합니다.",
      inputSchema: z.object({}),
      execute: async () => {
        logActionDebug(LOG_CTX, "analyzeGradeTrend");
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;

          const supabase = await createSupabaseServerClient();
          const { data: scores, error } = await supabase
            .from("student_internal_scores")
            .select("grade, semester, rank_grade, subject_id, subjects(name), subject_groups(name)")
            .eq("student_id", ctx.studentId)
            .eq("tenant_id", ctx.tenantId)
            .not("rank_grade", "is", null)
            .order("grade", { ascending: true })
            .order("semester", { ascending: true });

          if (error || !scores || scores.length === 0) {
            return { success: true, data: { message: "내신 성적 데이터가 없습니다.", trends: null } };
          }

          type ScoreRow = {
            grade: number;
            semester: number;
            rank_grade: number;
            subject_id: string;
            subjects: { name: string } | { name: string }[] | null;
            subject_groups: { name: string } | { name: string }[] | null;
          };
          const rows = scores as unknown as ScoreRow[];

          // 학기별 평균 등급 계산
          const termMap = new Map<string, number[]>();
          for (const s of rows) {
            const key = `${s.grade}-${s.semester}`;
            const arr = termMap.get(key) ?? [];
            arr.push(s.rank_grade);
            termMap.set(key, arr);
          }

          const termAverages = [...termMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, grades]) => {
              const [g, sem] = key.split("-").map(Number);
              const avg = Math.round((grades.reduce((s, v) => s + v, 0) / grades.length) * 100) / 100;
              return { grade: g, semester: sem, label: `${g}학년 ${sem}학기`, avgGrade: avg, subjectCount: grades.length };
            });

          // 전체 추이 패턴 판정
          let trendPattern: string;
          if (termAverages.length < 2) {
            trendPattern = "데이터 부족 (1학기만)";
          } else {
            const first = termAverages[0].avgGrade;
            const last = termAverages[termAverages.length - 1].avgGrade;
            const mid = termAverages.length >= 3 ? termAverages[Math.floor(termAverages.length / 2)].avgGrade : null;

            if (last < first - 0.3) {
              trendPattern = "상승 추이 (등급 개선)";
            } else if (last > first + 0.3) {
              trendPattern = "하락 추이 (등급 하락)";
            } else if (mid !== null && mid > first + 0.3 && last < mid - 0.3) {
              trendPattern = "V자 반등 (하락 후 회복)";
            } else if (mid !== null && mid < first - 0.3 && last > mid + 0.3) {
              trendPattern = "역V자 (상승 후 하락)";
            } else {
              trendPattern = "유지 (안정적)";
            }
          }

          // 과목군별 추이
          const groupMap = new Map<string, { grade: number; semester: number; rankGrade: number }[]>();
          const getName = (ref: { name: string } | { name: string }[] | null | undefined): string | null => {
            if (!ref) return null;
            if (Array.isArray(ref)) return ref[0]?.name ?? null;
            return ref.name;
          };

          for (const s of rows) {
            const groupName = getName(s.subject_groups) ?? "기타";
            const arr = groupMap.get(groupName) ?? [];
            arr.push({ grade: s.grade, semester: s.semester, rankGrade: s.rank_grade });
            groupMap.set(groupName, arr);
          }

          const subjectGroupTrends = [...groupMap.entries()].map(([name, items]) => {
            items.sort((a, b) => a.grade - b.grade || a.semester - b.semester);
            const first = items[0].rankGrade;
            const last = items[items.length - 1].rankGrade;
            const diff = Math.round((last - first) * 100) / 100;
            return {
              subjectGroup: name,
              firstGrade: first,
              lastGrade: last,
              change: diff,
              direction: diff < -0.3 ? "상승" : diff > 0.3 ? "하락" : "유지",
              dataPoints: items.length,
            };
          });

          // 위험 과목 (최근 등급 6 이상)
          const latestTerm = termAverages[termAverages.length - 1];
          const riskSubjects = rows
            .filter((s) => s.grade === latestTerm.grade && s.semester === latestTerm.semester && s.rank_grade >= 6)
            .map((s) => ({
              subject: getName(s.subjects) ?? s.subject_id,
              rankGrade: s.rank_grade,
            }));

          // 등급 체계 정보 (2015: 9등급 / 2022: 5등급)
          const curriculumYear = ctx.curriculumRevision?.includes("2022") ? 2022 : 2015;
          const gradeSystem = determineGradeSystem(curriculumYear);
          const curriculumNote = gradeSystem === 5
            ? "2022 개정 교육과정: 진로선택/융합선택 과목은 A/B/C 성취평가제입니다. 이 추이 분석은 9등급(석차등급) 과목만 포함합니다."
            : null;

          return {
            success: true,
            data: {
              trendPattern,
              termAverages,
              subjectGroupTrends,
              riskSubjects,
              totalScoreCount: rows.length,
              gradeSystem,
              curriculumNote,
              interpretation: trendPattern === "상승 추이 (등급 개선)"
                ? "등급이 꾸준히 개선되고 있어 학생부종합전형에서 긍정적으로 평가됩니다."
                : trendPattern === "하락 추이 (등급 하락)"
                  ? "등급이 하락하고 있어 원인 분석과 보완 전략이 필요합니다. 특히 3학년 성적 하락은 평가에 불리합니다."
                  : trendPattern === "V자 반등 (하락 후 회복)"
                    ? "하락 후 회복한 패턴은 '극복 서사'로 활용할 수 있습니다. 면접에서 회복 과정을 구체적으로 설명하세요."
                    : "안정적 성적 유지는 성실성을 보여줍니다. 단, 상승 추이가 아니면 '도전 부족'으로 해석될 수 있습니다.",
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("내신 성적");
        }
      },
    }),

    /**
     * 비교과 강도 자동 판별
     */
    assessExtracurricularStrength: tool({
      description:
        "비교과 강도 자동 판별 (강함/보통/약함, 100점). 전형 선택 의사결정에 활용.",
      inputSchema: z.object({
        schoolYear: z.number().optional().describe("학년도 (기본: 현재)"),
      }),
      execute: async ({ schoolYear }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `assessExtracurricularStrength: year=${year}`);
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;

          // 4개 데이터 소스 병렬 조회
          const { getRecordTabData: fetchRecords } = await import(
            "@/lib/domains/student-record/service"
          );
          const { findActivityTags: fetchTags, findCompetencyScores: fetchScores } =
            await import("@/lib/domains/student-record/competency-repository");
          const { findStorylinesByStudent: fetchStorylines } =
            await import("@/lib/domains/student-record/repository");

          const [recordsRes, tagsRes, scoresRes, storylinesRes] = await Promise.allSettled([
            fetchRecords(ctx.studentId, year, ctx.tenantId),
            fetchTags(ctx.studentId, ctx.tenantId),
            fetchScores(ctx.studentId, year, ctx.tenantId),
            fetchStorylines(ctx.studentId, ctx.tenantId),
          ]);

          const records = recordsRes.status === "fulfilled" ? recordsRes.value : null;
          const tags = tagsRes.status === "fulfilled" ? tagsRes.value : [];
          const scores = scoresRes.status === "fulfilled" ? scoresRes.value : [];
          const storylines = storylinesRes.status === "fulfilled" ? storylinesRes.value : [];

          // ── 1. 활동 태그 점수 (30점 만점) ──
          const positiveTags = tags.filter((t) => t.evaluation === "positive").length;
          const negativeTags = tags.filter((t) => t.evaluation === "negative").length;
          const totalTags = tags.length;
          const positiveRatio = totalTags > 0 ? positiveTags / totalTags : 0;
          const tagScore = Math.min(30, Math.round(positiveRatio * 30 + (totalTags >= 10 ? 5 : 0)));

          // ── 2. 스토리라인 점수 (20점 만점) ──
          const storylineCount = storylines.length;
          const coherentStorylines = storylines.filter(
            (s) => s.grade_1_theme && s.grade_2_theme,
          ).length;
          const storylineScore = Math.min(20,
            storylineCount * 5 + coherentStorylines * 5,
          );

          // ── 3. 창체 다양성 + 깊이 점수 (25점 만점) ──
          let changcheScore = 0;
          if (records) {
            const changche = records.changche;
            const types = new Set(changche.map((c) => c.activity_type));
            changcheScore += types.size * 5; // 유형 다양성 (최대 15)
            const avgLength = changche.length > 0
              ? changche.reduce((s, c) => s + (c.content?.length ?? 0), 0) / changche.length
              : 0;
            changcheScore += avgLength > 300 ? 10 : avgLength > 150 ? 5 : 0; // 깊이
            changcheScore = Math.min(25, changcheScore);
          }

          // ── 4. 독서 + 개인 세특 점수 (10점 만점) ──
          let readingScore = 0;
          if (records) {
            const readingCount = records.readings.length;
            readingScore += Math.min(5, readingCount); // 독서 (최대 5)
            readingScore += Math.min(5, records.personalSeteks.length * 2); // 개인세특 (최대 5)
          }

          // ── 5. 공동체/진로 역량 점수 (15점 만점) ──
          const gradeToNum = (g: string): number => {
            const map: Record<string, number> = { "A+": 6, "A-": 5, "B+": 4, "B": 3, "B-": 2, "C": 1 };
            return map[g] ?? 3;
          };
          const communityCareerScores = scores.filter(
            (s) => s.competency_area === "community" || s.competency_area === "career",
          );
          const avgCompetency = communityCareerScores.length > 0
            ? communityCareerScores.reduce((s, c) => s + gradeToNum(c.grade_value), 0) / communityCareerScores.length
            : 3;
          const competencyScore = Math.min(15, Math.round((avgCompetency / 6) * 15));

          // ── 종합 ──
          const totalScore = tagScore + storylineScore + changcheScore + readingScore + competencyScore;
          const level: "강함" | "보통" | "약함" =
            totalScore >= 65 ? "강함" : totalScore >= 35 ? "보통" : "약함";

          return {
            success: true,
            data: {
              level,
              totalScore,
              maxScore: 100,
              breakdown: {
                activityTags: { score: tagScore, max: 30, detail: `긍정 ${positiveTags}건 / 부정 ${negativeTags}건 / 전체 ${totalTags}건 (긍정 비율 ${Math.round(positiveRatio * 100)}%)` },
                storylines: { score: storylineScore, max: 20, detail: `${storylineCount}개 스토리라인 (${coherentStorylines}개 학년 연결)` },
                changche: { score: changcheScore, max: 25, detail: records ? `${records.changche.length}건 (유형 ${new Set(records.changche.map((c) => c.activity_type)).size}개)` : "데이터 없음" },
                readingAndPersonal: { score: readingScore, max: 10, detail: records ? `독서 ${records.readings.length}건 + 개인세특 ${records.personalSeteks.length}건` : "데이터 없음" },
                competencyGrades: { score: competencyScore, max: 15, detail: `공동체/진로 역량 평균 ${avgCompetency.toFixed(1)}/6.0` },
              },
              recommendation: level === "강함"
                ? "비교과가 강합니다. 학생부종합전형을 주력으로 세특 깊이 + 스토리라인 일관성에 집중하세요."
                : level === "보통"
                  ? "비교과가 보통입니다. 종합전형과 교과/논술전형을 병행하세요. 핵심 활동 1-2개의 깊이를 강화하면 효과적입니다."
                  : "비교과가 약합니다. 교과전형을 주력으로 하고, 종합전형은 보조로만 활용하세요. 비교과 보완보다 내신 관리가 우선입니다.",
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("비교과 강도 판별 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 기록 간 교차 연결(엣지) 분석 — 스토리라인 일관성 진단
     */
    analyzeNarrativeConnections: tool({
      description:
        "기록 간 교차 연결(7종 엣지) 분석. 서사 일관성과 스토리라인 강도 진단.",
      inputSchema: z.object({}),
      execute: async () => {
        logActionDebug(LOG_CTX, "analyzeNarrativeConnections");
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;

          const { findEdges } = await import(
            "@/lib/domains/student-record/edge-repository"
          );
          const edges = await findEdges(ctx.studentId, ctx.tenantId);

          if (edges.length === 0) {
            return {
              success: true,
              data: {
                totalEdges: 0,
                message: "교차 연결이 없습니다. AI 분석 파이프라인을 실행하여 엣지를 생성하세요.",
                narrativeStrength: "없음",
              },
            };
          }

          // 엣지 유형별 집계
          const typeCounts: Record<string, number> = {};
          for (const e of edges) {
            typeCounts[e.edge_type] = (typeCounts[e.edge_type] ?? 0) + 1;
          }

          const TYPE_LABELS: Record<string, string> = {
            COMPETENCY_SHARED: "역량 공유",
            CONTENT_REFERENCE: "내용 연결",
            TEMPORAL_GROWTH: "성장 경로",
            COURSE_SUPPORTS: "교과 뒷받침",
            READING_ENRICHES: "독서 보강",
            THEME_CONVERGENCE: "테마 수렴",
            TEACHER_VALIDATION: "교사 검증",
          };

          const distribution = Object.entries(typeCounts).map(([type, count]) => ({
            type,
            label: TYPE_LABELS[type] ?? type,
            count,
          }));

          // 서사 강도 판정
          const total = edges.length;
          const hasGrowth = (typeCounts["TEMPORAL_GROWTH"] ?? 0) >= 2;
          const hasTheme = (typeCounts["THEME_CONVERGENCE"] ?? 0) >= 1;
          const narrativeStrength =
            total >= 15 && hasGrowth && hasTheme ? "강함" :
            total >= 7 ? "보통" : "약함";

          // stale 엣지 비율
          const staleCount = edges.filter((e) => e.is_stale).length;

          // 구조화된 텍스트 요약 (엣지 타입별 그룹핑 + 예시 쌍)
          const formattedSummary = buildEdgeSummary(edges);

          return {
            success: true,
            data: {
              totalEdges: total,
              distribution,
              narrativeStrength,
              formattedSummary,
              staleEdges: staleCount,
              staleWarning: staleCount > 0 ? `${staleCount}건의 연결이 기록 변경 후 업데이트되지 않았습니다. 파이프라인 재실행을 권장합니다.` : null,
              interpretation: narrativeStrength === "강함"
                ? "기록 간 연결이 풍부하여 강한 서사 구조를 갖추고 있습니다. 학생부종합전형에서 높이 평가될 수 있습니다."
                : narrativeStrength === "보통"
                  ? "기본적인 연결은 있으나 성장 경로나 테마 수렴이 부족합니다. 교과 간 연결고리를 강화하세요."
                  : "기록 간 연결이 매우 약합니다. 스토리라인이 산만해 보일 수 있습니다. 핵심 탐구 주제를 중심으로 교과/비교과를 연결하세요.",
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("교차 연결");
        }
      },
    }),

    /**
     * 수능최저학력기준 시뮬레이션
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

    /**
     * 수강 계획 충돌 검사
     */
    checkCoursePlanConflicts: tool({
      description:
        "학생의 수강 계획에서 충돌을 검사합니다. 과부하(학기당 4개+ 진로과목), 미개설, 중복, 선수과목 위반을 감지합니다.",
      inputSchema: z.object({}),
      execute: async () => {
        logActionDebug(LOG_CTX, "checkCoursePlanConflicts");
        try {
          if (!ctx.tenantId) return TOOL_ERRORS.NO_TENANT;

          const supabase = await createSupabaseServerClient();
          const { data: plans } = await supabase
            .from("student_course_plans")
            .select("id, subject_id, grade, semester, plan_status, is_school_offered, subjects(name)")
            .eq("student_id", ctx.studentId)
            .eq("tenant_id", ctx.tenantId)
            .order("grade")
            .order("semester");

          if (!plans || plans.length === 0) {
            return { success: true, data: { conflicts: [], message: "수강 계획이 없습니다. recommendCourses로 먼저 추천을 생성하세요." } };
          }

          const { detectPlanConflicts } = await import(
            "@/lib/domains/student-record/course-plan/recommendation"
          );

          const normalized = plans.map((p: Record<string, unknown>) => {
            const subRef = p.subjects;
            const subName = Array.isArray(subRef)
              ? (subRef as Array<{ name: string }>)[0]?.name
              : (subRef as { name: string } | null)?.name ?? "알 수 없음";
            return {
              id: p.id as string,
              subject_id: p.subject_id as string,
              grade: p.grade as number,
              semester: p.semester as number,
              plan_status: p.plan_status as string,
              is_school_offered: p.is_school_offered as boolean | null,
              subject: { name: subName },
            };
          });

          const conflicts = detectPlanConflicts(normalized);

          return {
            success: true,
            data: {
              totalConflicts: conflicts.length,
              conflicts: conflicts.map((c) => ({
                type: c.type,
                message: c.message,
                grade: c.grade,
                semester: c.semester,
                subjectIds: c.subjectIds,
              })),
              recommendation: conflicts.length === 0
                ? "수강 계획에 충돌이 없습니다."
                : `${conflicts.length}건의 충돌이 발견되었습니다. 가장 시급한 것부터 해결하세요.`,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("수강 계획");
        }
      },
    }),
  };
}
