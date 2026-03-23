"use server";

// ============================================
// Phase 6.5 — AI 면접 예상 질문 생성 Server Action
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import {
  INTERVIEW_SYSTEM_PROMPT,
  buildInterviewUserPrompt,
  parseInterviewResponse,
} from "../prompts/interviewQuestions";
import type { InterviewQuestionResult } from "../prompts/interviewQuestions";

export type { InterviewQuestionResult, GeneratedInterviewQuestion, InterviewQuestionType } from "../prompts/interviewQuestions";

const LOG_CTX = { domain: "student-record", action: "generateInterviewQuestions" };

export async function generateInterviewQuestions(input: {
  content: string;
  recordType: string;
  subjectName?: string;
  grade?: number;
  /** 교차 질문 생성용 추가 레코드 (다른 과목/활동) */
  additionalRecords?: { content: string; recordType: string; subjectName?: string; grade?: number }[];
}): Promise<{ success: true; data: InterviewQuestionResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (!input.content || input.content.trim().length < 30) {
      return { success: false, error: "면접 질문 생성에는 최소 30자 이상의 텍스트가 필요합니다." };
    }

    const userPrompt = buildInterviewUserPrompt(input)
      + (input.additionalRecords?.length
        ? "\n\n## 관련 기록 (교차 질문 참고)\n\n" + input.additionalRecords.map((r) =>
          `### ${r.subjectName ?? r.recordType} (${r.grade ?? ""}학년)\n${r.content.slice(0, 300)}`
        ).join("\n\n")
        : "");

    const result = await generateTextWithRateLimit({
      system: INTERVIEW_SYSTEM_PROMPT,
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
      return { success: false, error: "면접 질문을 생성하지 못했습니다. 다시 시도해주세요." };
    }

    return { success: true, data: parsed };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요." };
    }
    return { success: false, error: "면접 질문 생성 중 오류가 발생했습니다." };
  }
}
