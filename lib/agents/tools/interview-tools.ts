// ============================================
// Agent 5: 면접 코칭 도구
// 면접 예상 질문 생성, 답변 평가, 면접 준비 현황
// ============================================

import { tool } from "ai";
import { z } from "zod";
import { type AgentContext, truncateWithMarker, sanitizeForPrompt } from "../types";
import { toolError, TOOL_ERRORS } from "../types";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import {
  INTERVIEW_SYSTEM_PROMPT,
  buildInterviewUserPrompt,
  parseInterviewResponse,
} from "@/lib/domains/record-analysis/llm/prompts/interviewQuestions";
import { getRecordTabData } from "@/lib/domains/student-record/service";
import { findApplicationsByStudentYear } from "@/lib/domains/student-record/repository";
import { checkInterviewConflicts } from "@/lib/domains/student-record/interview-conflict-checker";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "agent", action: "interview-tools" };

export function createInterviewTools(ctx: AgentContext) {
  return {
    /**
     * 학생 기록 기반 면접 예상 질문 10개 생성
     */
    generateInterviewQuestions: tool({
      description:
        "학생의 생기부 기록을 기반으로 면접 예상 질문 10개를 생성합니다. 기록 유형(세특/창체)과 학년을 지정할 수 있습니다. 질문 유형별(사실/추론/적용/가치관/심층) 분포를 포함합니다.",
      inputSchema: z.object({
        recordType: z
          .enum(["setek", "personal_setek", "changche", "haengteuk"])
          .optional()
          .describe("기록 유형 (기본: setek 우선)"),
        subjectName: z.string().max(50).optional().describe("교과명 필터"),
        grade: z.number().optional().describe("학년 필터"),
        schoolYear: z.number().optional().describe("학년도 (기본: 현재)"),
        targetUniversity: z.string().max(50).optional().describe("목표 대학 (프롬프트 참고용)"),
        interviewFormat: z
          .enum(["서류확인", "제시문", "mmi", "토론"])
          .optional()
          .describe("면접 유형. 미지정 시 서류확인 기본. MMI(의약학)/제시문(연세대 등) 학생은 반드시 지정하세요."),
      }),
      execute: async ({ recordType, subjectName, grade, schoolYear, targetUniversity, interviewFormat }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `generateInterviewQuestions: year=${year}`);
        try {
          if (!ctx.tenantId) {
            return TOOL_ERRORS.NO_TENANT;
          }

          // 기록 데이터 조회
          const data = await getRecordTabData(ctx.studentId, year, ctx.tenantId);

          // 기록 선택: setek → personal_setek → changche 우선순위
          type RecordCandidate = { content: string; recordType: string; subjectName?: string; grade?: number };
          const candidates: RecordCandidate[] = [];

          for (const s of data.seteks) {
            if (s.content && s.content.length >= 30) {
              candidates.push({ content: s.content, recordType: "setek", subjectName: s.subject_id, grade: s.grade });
            }
          }
          for (const ps of data.personalSeteks) {
            if (ps.content && ps.content.length >= 30) {
              candidates.push({ content: ps.content, recordType: "personal_setek", grade: ps.grade });
            }
          }
          for (const c of data.changche) {
            if (c.content && c.content.length >= 30) {
              candidates.push({ content: c.content, recordType: "changche", grade: c.grade });
            }
          }

          // 필터 적용
          let filtered = candidates;
          if (recordType) {
            filtered = filtered.filter((c) => c.recordType === recordType);
          }
          if (grade) {
            filtered = filtered.filter((c) => c.grade === grade);
          }

          if (filtered.length === 0) {
            return TOOL_ERRORS.NO_DATA("면접용 기록 (30자 이상)");
          }

          // 3000자 cap으로 텍스트 병합
          let mergedContent = "";
          for (const c of filtered) {
            if (mergedContent.length + c.content.length > 3000) break;
            mergedContent += `\n\n[${c.recordType}${c.grade ? ` ${c.grade}학년` : ""}]\n${c.content}`;
          }

          const userPrompt = buildInterviewUserPrompt({
            content: mergedContent.trim(),
            recordType: recordType ?? "setek",
            subjectName,
            grade,
          });

          // 면접 유형 + 목표 대학 정보 추가
          const FORMAT_GUIDES: Record<string, string> = {
            "서류확인": "생기부 기반 질문에 집중하세요. 활동 동기·과정·결과를 확인하는 질문을 위주로 생성하세요.",
            "제시문": "학술 텍스트 기반 논증 질문을 포함하세요. 분석력과 논리력을 평가하는 질문 비중을 높이세요. reasoning/application 유형 비중을 60% 이상으로 조정하세요.",
            "mmi": "윤리적 딜레마, 상황판단, 인성 관련 질문을 위주로 생성하세요. 의약학 면접 형식입니다. value/controversial 유형 비중을 60% 이상으로 조정하세요.",
            "토론": "찬반 토론 가능한 주제를 포함하세요. 논리적 반박과 경청 태도를 평가할 수 있는 controversial/reasoning 질문을 위주로 생성하세요.",
          };

          let systemPrompt = INTERVIEW_SYSTEM_PROMPT;
          if (interviewFormat) {
            systemPrompt += `\n\n## 면접 유형: ${interviewFormat}\n${FORMAT_GUIDES[interviewFormat]}`;
          }
          if (targetUniversity) {
            systemPrompt += `\n\n## 목표 대학: ${sanitizeForPrompt(targetUniversity, 50)}\n해당 대학 면접 스타일을 참고하여 질문을 생성하세요.`;
          }

          const result = await generateTextWithRateLimit({
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.4,
            maxTokens: 4000,
          });

          if (!result.content) {
            return TOOL_ERRORS.AI_EMPTY;
          }

          const parsed = parseInterviewResponse(result.content);

          if (parsed.questions.length === 0) {
            return TOOL_ERRORS.AI_EMPTY;
          }

          return {
            success: true,
            data: {
              questions: parsed.questions,
              summary: parsed.summary,
              sourceRecordCount: filtered.length,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("면접 질문 생성에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 학생 답변 평가 + 개선 피드백
     */
    evaluateAnswer: tool({
      description:
        "학생의 면접 답변을 평가하고 개선 피드백을 제공합니다. 질문, 모범 답변, 학생 답변을 입력하면 점수(1-5), 강점, 약점, 개선된 답변, 팁을 반환합니다.",
      inputSchema: z.object({
        question: z.string().max(500).describe("면접 질문"),
        suggestedAnswer: z.string().max(2000).describe("모범 답변"),
        studentAnswer: z.string().max(2000).describe("학생 답변"),
        recordContext: z.string().max(3000).optional().describe("관련 생기부 기록 원문 (선택)"),
      }),
      execute: async ({ question, suggestedAnswer, studentAnswer, recordContext }) => {
        logActionDebug(LOG_CTX, "evaluateAnswer");
        try {
          if (studentAnswer.trim().length < 10) {
            return TOOL_ERRORS.INVALID_INPUT("답변이 너무 짧습니다 (10자 이상 필요)");
          }

          const systemPrompt = `당신은 대입 면접 평가 전문가입니다. 학생의 면접 답변을 평가하고 개선 피드백을 제공합니다.

## 평가 기준 (1-5점)
- 5점: 모범 답변 수준, 구체적이고 논리적
- 4점: 양호, 핵심 포인트 대부분 포함
- 3점: 보통, 개선 여지 있음
- 2점: 부족, 핵심 포인트 누락
- 1점: 매우 부족, 답변 방향이 잘못됨

## 규칙
1. 생기부 기록과 일관성 있는지 확인
2. 구체적 근거 제시 여부 평가
3. 논리적 흐름과 표현력 평가
4. 개선된 답변은 학생 답변을 기반으로 보완
5. JSON 형식으로만 응답

## JSON 출력 형식
\`\`\`json
{
  "score": 3,
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "improvedAnswer": "개선된 답변...",
  "tips": ["팁1", "팁2"]
}
\`\`\``;

          let userPrompt = `## 면접 질문\n${question}\n\n## 모범 답변\n${suggestedAnswer}\n\n## 학생 답변\n${studentAnswer}`;
          if (recordContext) {
            userPrompt += `\n\n## 관련 생기부 기록\n${truncateWithMarker(recordContext, 1000)}`;
          }
          userPrompt += "\n\n위 답변을 평가하고 JSON으로 피드백을 제공해주세요.";

          const result = await generateTextWithRateLimit({
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.3,
            maxTokens: 1500,
          });

          if (!result.content) {
            return TOOL_ERRORS.AI_EMPTY;
          }

          let jsonStr = result.content.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            logActionError(LOG_CTX, `evaluateAnswer JSON 파싱 실패: ${jsonStr.slice(0, 200)}`);
            return TOOL_ERRORS.AI_FORMAT;
          }

          const score = Math.max(1, Math.min(5, Math.round(Number(parsed.score) || 3)));

          return {
            success: true,
            data: {
              score,
              strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
              weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
              improvedAnswer: String(parsed.improvedAnswer ?? ""),
              tips: Array.isArray(parsed.tips) ? parsed.tips.map(String) : [],
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("답변 평가에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 면접 실전 연습 (multi-turn)
     */
    conductMockInterview: tool({
      description:
        "면접 실전 연습을 진행합니다. 질문에 대한 답변을 평가하고, 피드백과 후속 질문을 생성합니다. previousExchanges로 이전 대화 맥락을 유지하여 다회차 연습이 가능합니다.",
      inputSchema: z.object({
        question: z.string().max(500).describe("현재 면접 질문"),
        answer: z.string().max(2000).describe("학생의 답변"),
        previousExchanges: z
          .array(
            z.object({
              question: z.string(),
              answer: z.string(),
              feedback: z.string(),
            }),
          )
          .default([])
          .describe("이전 질의응답 기록"),
      }),
      execute: async ({ question, answer, previousExchanges }) => {
        logActionDebug(LOG_CTX, `conductMockInterview: exchanges=${previousExchanges.length}`);
        try {
          if (!ctx.tenantId) {
            return TOOL_ERRORS.NO_TENANT;
          }

          if (answer.trim().length < 10) {
            return TOOL_ERRORS.INVALID_INPUT("답변이 너무 짧습니다 (10자 이상 필요)");
          }

          // 이전 대화 맥락 구성
          let contextSection = "";
          if (previousExchanges.length > 0) {
            const exchanges = previousExchanges.slice(-5); // 최근 5개만
            contextSection = "\n## 이전 면접 대화\n";
            for (const ex of exchanges) {
              contextSection += `Q: ${truncateWithMarker(ex.question, 200)}\nA: ${truncateWithMarker(ex.answer, 300)}\n피드백: ${truncateWithMarker(ex.feedback, 200)}\n\n`;
            }
          }

          const systemPrompt = `당신은 대입 면접 코치입니다. 학생의 면접 답변을 평가하고, 개선 피드백과 후속 질문을 생성합니다.

## 역할
1. 학생의 답변을 5점 척도로 평가합니다.
2. 구체적인 강점과 개선점을 피드백합니다.
3. 이전 대화 맥락을 고려하여 심화된 후속 질문을 생성합니다.
4. 후속 질문은 학생의 약점을 보완하거나 깊이를 확인하는 방향으로 설계합니다.

## 평가 기준 (1-5점)
- 5점: 모범 답변 수준, 구체적 근거 + 논리적 전개
- 4점: 양호, 핵심 포인트 대부분 포함
- 3점: 보통, 개선 여지 있음
- 2점: 부족, 핵심 포인트 누락
- 1점: 매우 부족, 답변 방향이 잘못됨

## 후속 질문 생성 원칙
- 답변에서 언급한 내용의 세부 사항을 파고드는 질문
- 논리적 약점이나 빈틈을 확인하는 질문
- 실제 면접관이 할 법한 자연스러운 질문
- 이전 대화에서 아직 다루지 않은 관점의 질문

## JSON 출력 형식
\`\`\`json
{
  "score": 3,
  "feedback": "구체적 피드백 내용...",
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "followUpQuestion": "후속 면접 질문...",
  "tips": ["실전 팁1", "실전 팁2"]
}
\`\`\``;

          let userPrompt = "";
          if (contextSection) {
            userPrompt += contextSection;
          }
          userPrompt += `## 현재 질문\n${question}\n\n## 학생 답변\n${answer}\n\n위 답변을 평가하고, 피드백과 후속 질문을 JSON으로 제공해주세요.`;

          const result = await generateTextWithRateLimit({
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.4,
            maxTokens: 2000,
          });

          if (!result.content) {
            return TOOL_ERRORS.AI_EMPTY;
          }

          // JSON 파싱
          let jsonStr = result.content.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            logActionError(LOG_CTX, `conductMockInterview JSON 파싱 실패: ${jsonStr.slice(0, 200)}`);
            return TOOL_ERRORS.AI_FORMAT;
          }

          const score = Math.max(1, Math.min(5, Math.round(Number(parsed.score) || 3)));

          return {
            success: true,
            data: {
              feedback: String(parsed.feedback ?? ""),
              score,
              strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
              weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
              followUpQuestion: String(parsed.followUpQuestion ?? ""),
              tips: Array.isArray(parsed.tips) ? parsed.tips.map(String) : [],
              exchangeCount: previousExchanges.length + 1,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return toolError("면접 실전 연습 처리에 실패.", { retryable: true, actionHint: "다시 시도하세요." });
        }
      },
    }),

    /**
     * 면접 준비 현황 조회
     */
    getInterviewPrep: tool({
      description:
        "학생의 면접 준비 현황을 조회합니다. 수시 지원 현황, 면접일 겹침 여부, 기존 생성된 면접 질문 수를 반환합니다.",
      inputSchema: z.object({
        schoolYear: z
          .number()
          .optional()
          .describe("조회할 학년도 (기본: 현재 학년도)"),
      }),
      execute: async ({ schoolYear }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `getInterviewPrep: year=${year}`);
        try {
          if (!ctx.tenantId) {
            return TOOL_ERRORS.NO_TENANT;
          }

          // 지원 현황 + 면접 질문 수 병렬 조회
          const supabase = await createSupabaseServerClient();
          const [appsRes, qCountRes] = await Promise.allSettled([
            findApplicationsByStudentYear(ctx.studentId, year, ctx.tenantId),
            supabase
              .from("student_record_interview_questions")
              .select("id", { count: "exact", head: true })
              .eq("student_id", ctx.studentId)
              .eq("tenant_id", ctx.tenantId),
          ]);
          const applications = appsRes.status === "fulfilled" ? appsRes.value : [];
          const questionCountResult = qCountRes.status === "fulfilled" ? qCountRes.value : { count: 0 };
          if (appsRes.status === "rejected") logActionError(LOG_CTX, appsRes.reason);
          if (qCountRes.status === "rejected") logActionError(LOG_CTX, qCountRes.reason);

          // 면접 겹침 체크
          const conflicts = checkInterviewConflicts(applications);

          // 지원 현황 요약
          const earlyApps = applications.filter((a) => a.round.startsWith("early_"));
          const regularApps = applications.filter((a) => a.round.startsWith("regular_"));

          return {
            success: true,
            data: {
              applicationSummary: {
                earlyCount: earlyApps.length,
                regularCount: regularApps.length,
                earlyApplications: earlyApps.map((a) => ({
                  universityName: a.university_name,
                  department: a.department,
                  round: a.round,
                  interviewDate: a.interview_date,
                })),
              },
              interviewConflicts: conflicts.map((c) => ({
                university1: c.university1,
                university2: c.university2,
                conflictDate: c.conflictDate,
                severity: c.severity,
              })),
              existingQuestionCount: questionCountResult.count ?? 0,
            },
          };
        } catch (error) {
          logActionError(LOG_CTX, error);
          return TOOL_ERRORS.DB_ERROR("면접 준비 현황 ");
        }
      },
    }),
  };
}
