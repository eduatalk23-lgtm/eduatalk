"use server";

// ============================================
// Phase 6.5 — AI 면접 예상 질문 생성 Server Action
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import {
  INTERVIEW_SYSTEM_PROMPT,
  buildInterviewUserPrompt,
  parseInterviewResponse,
} from "../prompts/interviewQuestions";
import type { InterviewQuestionResult } from "../prompts/interviewQuestions";

// NOTE: "use server" 모듈에서는 type re-export 금지 (런타임 ReferenceError 유발)
// 외부에서 이 타입이 필요하면 ../prompts/interviewQuestions 에서 직접 import할 것

const LOG_CTX = { domain: "student-record", action: "generateInterviewQuestions" };

export async function generateInterviewQuestions(input: {
  content: string;
  recordType: string;
  subjectName?: string;
  grade?: number;
  /** 교차 질문 생성용 추가 레코드 (다른 과목/활동) */
  additionalRecords?: { content: string; recordType: string; subjectName?: string; grade?: number }[];
  /** 진단에서 발견된 약점 (약점 영역 기반 심층 질문 생성용) */
  diagnosticWeaknesses?: string[];
  /** 진로 컨텍스트: 면접 질문을 진로 적합성 관점에서 생성 */
  careerContext?: { targetMajor?: string; targetSubClassification?: string };
  /** 역량 약점 등급 (B-/C 등급 항목) — 해당 역량 관련 심층 질문 */
  weakCompetencies?: { item: string; label: string; grade: string }[];
  /** Q4: 기존 생성된 질문 (중복 방지용) */
  existingQuestions?: string[];
}): Promise<{ success: true; data: InterviewQuestionResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (!input.content || input.content.trim().length < 30) {
      return { success: false, error: "면접 질문 생성에는 최소 30자 이상의 텍스트가 필요합니다." };
    }

    let userPrompt = buildInterviewUserPrompt(input);
    if (input.additionalRecords?.length) {
      userPrompt += "\n\n## 관련 기록 (교차 질문 참고)\n\n" + input.additionalRecords.map((r) =>
        `### ${r.subjectName ?? r.recordType} (${r.grade ?? ""}학년)\n${r.content.slice(0, 300)}`
      ).join("\n\n");
    }
    if (input.diagnosticWeaknesses?.length) {
      userPrompt += "\n\n## 진단 약점 영역 (심층 질문 필요)\n" + input.diagnosticWeaknesses.map((w) => `- ${w}`).join("\n")
        + "\n\n위 약점 영역에 대해 학생이 어떻게 보완했는지, 또는 인식하고 있는지 확인하는 질문을 1~2개 추가로 생성해주세요.";
    }
    if (input.careerContext?.targetMajor) {
      userPrompt += `\n\n## 진로 정보\n- 목표 전공: ${input.careerContext.targetMajor}`;
      if (input.careerContext.targetSubClassification) {
        userPrompt += `\n- 세부 분류: ${input.careerContext.targetSubClassification}`;
      }
      userPrompt += "\n\n목표 전공과 관련하여 학생의 진로 적합성을 확인하는 질문도 포함해주세요.";
    }
    if (input.weakCompetencies?.length) {
      userPrompt += "\n\n## 역량 약점 (등급 B- 이하)\n" + input.weakCompetencies.map((c) => `- ${c.label} (${c.grade})`).join("\n")
        + "\n\n해당 역량에 대한 자기 인식과 극복 노력을 확인하는 질문을 포함해주세요.";
    }
    if (input.existingQuestions?.length) {
      userPrompt += "\n\n## 이미 생성된 질문 (중복 금지)\n" + input.existingQuestions.slice(0, 15).map((q) => `- ${q}`).join("\n")
        + "\n\n위 질문과 내용이 중복되지 않는 새로운 질문을 생성해주세요.";
    }

    const result = await withRetry(
      () => generateTextWithRateLimit({
        system: INTERVIEW_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: "fast",
        temperature: 0.4,
        maxTokens: 4000,
        responseFormat: "json",
      }),
      { label: "generateInterviewQuestions" },
    );

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
