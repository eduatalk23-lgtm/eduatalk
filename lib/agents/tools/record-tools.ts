// ============================================
// Agent 1: 생기부 분석 도구
// 기존 LLM action의 core 로직을 tool()로 래핑
// auth 가드 없이 직접 호출 (API route에서 이미 인증 완료)
// ============================================

import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "../types";
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
import { COMPETENCY_ITEMS, COMPETENCY_RUBRIC_QUESTIONS, COMPETENCY_AREA_LABELS, MAJOR_RECOMMENDED_COURSES } from "@/lib/domains/student-record/constants";
import type { CompetencyItemCode, CompetencyGrade } from "@/lib/domains/student-record/types";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "record-tools" };

export function createRecordTools(_ctx: AgentContext) {
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
            return { success: false, error: "분석할 텍스트가 너무 짧습니다 (20자 이상 필요)." };
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
            return { success: false, error: "AI 응답이 비어있습니다." };
          }
          return { success: true, data: parseTagResponse(result.content) };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return { success: false, error: "역량 태그 분석에 실패했습니다." };
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
      }),
      execute: async ({ records }) => {
        logActionDebug(LOG_CTX, `analyzeCompetency: ${records.length}건`);
        try {
          if (records.length === 0) {
            return { success: false, error: "분석할 기록이 없습니다." };
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
4. JSON 형식으로만 응답하세요.

## 출력 형식
\`\`\`json
{
  "items": [{ "competencyItem": "...", "suggestedGrade": "B+", "reasoning": "...", "narrative": "..." }],
  "summary": "..."
}
\`\`\``;

          const recordText = records
            .map((r) => `[${r.label}]\n${r.content}`)
            .join("\n\n---\n\n");
          const userPrompt = `## 분석 대상 학생의 생기부 기록 (${records.length}건)\n\n${recordText}\n\n위 생기부 전체 기록을 종합 분석하여 10개 역량 항목의 등급을 JSON으로 제안해주세요.`;

          const result = await generateTextWithRateLimit({
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.3,
            maxTokens: 4000,
          });

          if (!result.content) {
            return { success: false, error: "AI 응답이 비어있습니다." };
          }

          let jsonStr = result.content.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();

          const parsed = JSON.parse(jsonStr);
          const validCodes = new Set<string>(COMPETENCY_ITEMS.map((i) => i.code));
          const validGrades = new Set<string>(["A+", "A-", "B+", "B", "B-", "C"]);

          const items = (parsed.items ?? [])
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
          return { success: false, error: "역량 분석에 실패했습니다." };
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
      }),
      execute: async ({ content, recordType, subjectName }) => {
        logActionDebug(LOG_CTX, `analyzeHighlight: type=${recordType}`);
        try {
          if (content.trim().length < 20) {
            return { success: false, error: "텍스트가 너무 짧습니다." };
          }
          const userPrompt = buildHighlightUserPrompt({ content, recordType, subjectName });
          const result = await generateTextWithRateLimit({
            system: HIGHLIGHT_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.3,
            maxTokens: 4000,
          });
          if (!result.content) {
            return { success: false, error: "AI 응답이 비어있습니다." };
          }
          return { success: true, data: parseHighlightResponse(result.content) };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return { success: false, error: "하이라이트 분석에 실패했습니다." };
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
      }),
      execute: async ({ records }) => {
        logActionDebug(LOG_CTX, `detectStoryline: ${records.length}건`);
        try {
          if (records.length < 2) {
            return { success: false, error: "탐구 연결 감지에는 최소 2건의 기록이 필요합니다." };
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
          const result = await generateTextWithRateLimit({
            system: INQUIRY_LINK_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.3,
            maxTokens: 3000,
          });
          if (!result.content) {
            return { success: false, error: "AI 응답이 비어있습니다." };
          }
          return {
            success: true,
            data: parseInquiryLinkResponse(result.content, records.length - 1),
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return { success: false, error: "스토리라인 감지에 실패했습니다." };
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
      }),
      execute: async ({ competencyScores, activityTags, targetMajor }) => {
        logActionDebug(LOG_CTX, `generateDiagnosis: scores=${competencyScores.length}, tags=${activityTags.length}`);
        try {
          if (competencyScores.length === 0 && activityTags.length === 0) {
            return { success: false, error: "역량 등급이나 활동 태그 데이터가 없습니다." };
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
              `  - ${COMPETENCY_ITEMS.find((i) => i.code === t.competency_item)?.label ?? t.competency_item}: ${t.evidence_summary?.slice(0, 80) ?? ""}`,
            ),
            negativeTags.length > 0 ? `부정 태그 (${negativeTags.length}건):` : "",
            ...negativeTags.map((t) =>
              `  - ${COMPETENCY_ITEMS.find((i) => i.code === t.competency_item)?.label ?? t.competency_item}: ${t.evidence_summary?.slice(0, 80) ?? ""}`,
            ),
            reviewTags.length > 0 ? `확인필요 (${reviewTags.length}건):` : "",
            ...reviewTags.map((t) =>
              `  - ${COMPETENCY_ITEMS.find((i) => i.code === t.competency_item)?.label ?? t.competency_item}: ${t.evidence_summary?.slice(0, 80) ?? ""}`,
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
- JSON으로만 응답`;

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
            return { success: false, error: "AI 응답이 비어있습니다." };
          }

          let jsonStr = result.content.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();

          const parsed = JSON.parse(jsonStr);
          const validGrades = new Set(["A+", "A-", "B+", "B", "B-", "C"]);
          const validStrengths = new Set(["strong", "moderate", "weak"]);

          return {
            success: true,
            data: {
              overallGrade: validGrades.has(parsed.overallGrade) ? parsed.overallGrade : "B",
              recordDirection: String(parsed.recordDirection ?? "").slice(0, 50),
              directionStrength: validStrengths.has(parsed.directionStrength)
                ? parsed.directionStrength
                : "moderate",
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
          return { success: false, error: "종합 진단 생성에 실패했습니다." };
        }
      },
    }),
  };
}
