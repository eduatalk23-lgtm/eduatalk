// ============================================
// Agent 5: 면접 코칭 도구
// 면접 예상 질문 생성, 답변 평가, 면접 준비 현황
// ============================================

import { tool } from "ai";
import { z } from "zod";
import { type AgentContext, truncateWithMarker } from "../types";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import {
  INTERVIEW_SYSTEM_PROMPT,
  buildInterviewUserPrompt,
  parseInterviewResponse,
} from "@/lib/domains/student-record/llm/prompts/interviewQuestions";
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
        subjectName: z.string().optional().describe("교과명 필터"),
        grade: z.number().optional().describe("학년 필터"),
        schoolYear: z.number().optional().describe("학년도 (기본: 현재)"),
        targetUniversity: z.string().optional().describe("목표 대학 (프롬프트 참고용)"),
      }),
      execute: async ({ recordType, subjectName, grade, schoolYear, targetUniversity }) => {
        const year = schoolYear ?? ctx.schoolYear;
        logActionDebug(LOG_CTX, `generateInterviewQuestions: year=${year}`);
        try {
          if (!ctx.tenantId) {
            return { success: false, error: "테넌트 정보가 없습니다." };
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
            return { success: false, error: "면접 질문 생성에 사용할 기록이 없습니다. (30자 이상 기록 필요)" };
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

          // 목표 대학 정보 추가
          const systemPrompt = targetUniversity
            ? `${INTERVIEW_SYSTEM_PROMPT}\n\n## 추가 정보\n- 목표 대학: ${targetUniversity}\n- 해당 대학 면접 스타일을 참고하여 질문을 생성하세요.`
            : INTERVIEW_SYSTEM_PROMPT;

          const result = await generateTextWithRateLimit({
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            modelTier: "fast",
            temperature: 0.4,
            maxTokens: 4000,
          });

          if (!result.content) {
            return { success: false, error: "AI 응답이 비어있습니다." };
          }

          const parsed = parseInterviewResponse(result.content);

          if (parsed.questions.length === 0) {
            return { success: false, error: "면접 질문을 생성하지 못했습니다." };
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
          return { success: false, error: "면접 질문 생성에 실패했습니다." };
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
        question: z.string().describe("면접 질문"),
        suggestedAnswer: z.string().describe("모범 답변"),
        studentAnswer: z.string().describe("학생 답변"),
        recordContext: z.string().optional().describe("관련 생기부 기록 원문 (선택)"),
      }),
      execute: async ({ question, suggestedAnswer, studentAnswer, recordContext }) => {
        logActionDebug(LOG_CTX, "evaluateAnswer");
        try {
          if (studentAnswer.trim().length < 10) {
            return { success: false, error: "답변이 너무 짧습니다 (10자 이상 필요)." };
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
            return { success: false, error: "AI 응답이 비어있습니다." };
          }

          let jsonStr = result.content.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            logActionError(LOG_CTX, `evaluateAnswer JSON 파싱 실패: ${jsonStr.slice(0, 200)}`);
            return { success: false, error: "AI 응답 형식 오류입니다. 다시 시도해주세요." };
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
          return { success: false, error: "답변 평가에 실패했습니다." };
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
            return { success: false, error: "테넌트 정보가 없습니다." };
          }

          // 지원 현황 + 면접 질문 수 병렬 조회
          const supabase = await createSupabaseServerClient();
          const [applications, questionCountResult] = await Promise.all([
            findApplicationsByStudentYear(ctx.studentId, year, ctx.tenantId),
            supabase
              .from("student_record_interview_questions")
              .select("id", { count: "exact", head: true })
              .eq("student_id", ctx.studentId)
              .eq("tenant_id", ctx.tenantId),
          ]);

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
          return { success: false, error: "면접 준비 현황 조회에 실패했습니다." };
        }
      },
    }),
  };
}
