"use server";

// ============================================
// Phase 6.5 — AI 면접 예상 질문 생성 Server Action
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { handleLlmActionError } from "../error-handler";
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

const LOG_CTX = { domain: "record-analysis", action: "generateInterviewQuestions" };

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
  /** content_quality.issues 기반 약점 패턴 (F1~F6, P1~P4 등) + 학년/과목 맥락 */
  qualityIssues?: Array<{
    recordType: string;
    subjectName?: string;
    grade?: number;
    issues: string[];
    feedback?: string;
  }>;
  /** 지원 대학별 면접 포맷 (주어지면 해당 스타일 반영) */
  appliedUniversities?: Array<{
    universityName: string;
    department?: string;
    admissionType?: string;
    interviewFormat?: string;
    interviewDetails?: string;
  }>;
  /** Phase δ-6 (G11): 활성 메인 탐구 섹션 (record 의 tier 컨텍스트). buildMainExplorationSection() 결과. */
  mainExplorationSection?: string;
}): Promise<{ success: true; data: InterviewQuestionResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (!input.content || input.content.trim().length < 30) {
      return { success: false, error: "면접 질문 생성에는 최소 30자 이상의 텍스트가 필요합니다." };
    }

    let userPrompt = buildInterviewUserPrompt(input);
    if (input.additionalRecords?.length) {
      userPrompt += "\n\n## 관련 기록 (교차 질문 참고 — 원문 인용 가능)\n\n" + input.additionalRecords.map((r) =>
        `### ${r.subjectName ?? r.recordType} (${r.grade ?? ""}학년)\n${r.content.slice(0, 300)}`,
      ).join("\n\n");
    }
    if (input.careerContext?.targetMajor) {
      userPrompt += `\n\n## 학생 진로 정보\n- 목표 전공: ${input.careerContext.targetMajor}`;
      if (input.careerContext.targetSubClassification) {
        userPrompt += `\n- 세부 분류: ${input.careerContext.targetSubClassification}`;
      }
      userPrompt += `\n\n위 진로를 기준으로 **진로교과 vs 비진로교과** 차등 규칙(시스템 프롬프트 규칙 9)을 적용하라. 진로교과 세특에서는 ④참고문헌·⑤결론까지 깊게 묻고, 비진로교과는 순수 교과 역량에 집중.`;
    }
    if (input.qualityIssues?.length) {
      userPrompt += "\n\n## 감지된 약점 패턴 (면접 공격 각도 — 시스템 프롬프트의 패턴 매핑 참고)\n";
      for (const q of input.qualityIssues) {
        const header = `${q.subjectName ?? q.recordType}${q.grade ? ` (${q.grade}학년)` : ""}`;
        userPrompt += `\n### ${header}\n`;
        userPrompt += `- 패턴: ${q.issues.join(", ")}\n`;
        if (q.feedback) userPrompt += `- 감지 근거: ${q.feedback.slice(0, 250)}\n`;
      }
      userPrompt += `\n위 패턴 중 최소 2개 이상을 직접 겨냥하는 질문을 생성하라. 원문 인용 필수.`;
    }
    if (input.diagnosticWeaknesses?.length) {
      userPrompt += "\n\n## 종합 진단 약점\n" + input.diagnosticWeaknesses.map((w) => `- ${w}`).join("\n");
    }
    if (input.weakCompetencies?.length) {
      userPrompt += "\n\n## 역량 약점 (B- 이하)\n" + input.weakCompetencies.map((c) => `- ${c.label} (${c.grade})`).join("\n")
        + "\n\n해당 역량에 대한 자기 인식·극복 노력을 확인하는 질문을 1개 포함.";
    }
    if (input.appliedUniversities?.length) {
      userPrompt += "\n\n## 지원 대학 및 면접 포맷\n";
      for (const u of input.appliedUniversities) {
        const parts = [u.universityName];
        if (u.department) parts.push(u.department);
        if (u.admissionType) parts.push(u.admissionType);
        userPrompt += `\n### ${parts.join(" / ")}\n`;
        if (u.interviewFormat) userPrompt += `- 면접 포맷: ${u.interviewFormat}\n`;
        if (u.interviewDetails) userPrompt += `- 세부 특성: ${u.interviewDetails.slice(0, 300)}\n`;
      }
      userPrompt += `\n위 대학의 면접 포맷(제시문형/발표형/기록확인형 등)에 맞게 질문 스타일을 조정하라.`;
    }
    if (input.existingQuestions?.length) {
      userPrompt += "\n\n## 이미 생성된 질문 (중복 금지)\n" + input.existingQuestions.slice(0, 15).map((q) => `- ${q}`).join("\n");
    }
    if (input.mainExplorationSection) {
      userPrompt += `\n\n${input.mainExplorationSection}\n\n위 메인 탐구 tier_plan(기초/발전/심화) 을 기준으로 record 가 어느 tier 에 위치하는지 묻고, 다음 tier 로 전환하기 위한 후속 질문을 1개 이상 포함하라.`;
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
    return handleLlmActionError(error, "면접 질문 생성", LOG_CTX);
  }
}
