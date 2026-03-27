"use server";

// ============================================
// H1: 세특 AI 초안 생성 Server Action
// 세특 방향 가이드(direction, keywords) + 학생 진로 맥락으로
// NEIS 500자 이내의 세특 초안을 생성하여 ai_draft_content에 저장
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "student-record", action: "generateSetekDraft" };

const SYSTEM_PROMPT = `당신은 고등학교 세특(세부능력 및 특기사항) 작성 보조 도우미입니다.

## 역할
- 컨설턴트가 제공하는 방향, 키워드, 탐구 가이드를 기반으로 세특 초안을 생성합니다.
- 이 초안은 교사가 직접 수정하고 확정하는 **시작점**입니다. 완성본이 아닙니다.
- 세특은 학생의 수업 참여, 탐구 과정, 성장을 기술하는 공식 문서입니다.

## 규칙
1. 습니다체(~했다, ~보였다, ~성장했다)를 사용합니다. 학생 3인칭 서술입니다.
2. NEIS 기준 500자(한글 500자, 1,500바이트) 이내로 작성합니다.
3. 구체적인 탐구 주제와 과정을 포함합니다 (보고서 작성, 실험, 발표 등).
4. 학업 태도(적극성, 질문, 협업)를 자연스럽게 녹입니다.
5. 제공된 키워드를 2-3개 이상 자연스럽게 포함합니다.
6. AI가 대신 쓴 티가 나지 않도록, 구체적이고 현실적인 활동을 기술합니다.
7. 일반적인 칭찬("우수한 학생", "뛰어난 능력")보다 구체적 행동 서술을 우선합니다.
8. plain text로만 응답합니다 (JSON이 아닌 일반 텍스트).`;

export async function generateSetekDraftAction(
  recordId: string,
  input: {
    subjectName: string;
    grade: number;
    direction?: string;
    keywords?: string[];
    targetMajor?: string;
    existingContent?: string;
  },
): Promise<ActionResponse<{ draftContent: string }>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) return { success: false, error: "테넌트 정보가 없습니다." };

    let userPrompt = `## 과목: ${input.subjectName} (${input.grade}학년)\n\n`;

    if (input.targetMajor) {
      userPrompt += `- 희망 전공: ${input.targetMajor}\n`;
    }

    if (input.direction) {
      userPrompt += `\n## 세특 방향\n${input.direction}\n`;
    }

    if (input.keywords && input.keywords.length > 0) {
      userPrompt += `\n## 포함할 키워드\n${input.keywords.join(", ")}\n`;
    }

    if (input.existingContent && input.existingContent.trim().length > 10) {
      userPrompt += `\n## 기존 내용 (참고용, 중복 방지)\n${input.existingContent.slice(0, 300)}\n`;
    }

    userPrompt += `\n위 정보를 바탕으로 NEIS 500자 이내의 세특 초안을 작성해주세요.`;

    const result = await generateTextWithRateLimit({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "standard",
      temperature: 0.5,
      maxTokens: 2000,
    });

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    const draftContent = result.content.trim();

    // DB에 ai_draft_content 저장
    const supabase = await createSupabaseServerClient();
    const { error: updateErr } = await supabase
      .from("student_record_seteks")
      .update({
        ai_draft_content: draftContent,
        ai_draft_at: new Date().toISOString(),
      })
      .eq("id", recordId);

    if (updateErr) {
      logActionError(LOG_CTX, updateErr, { recordId });
      return { success: false, error: "AI 초안 저장에 실패했습니다." };
    }

    logActionDebug(LOG_CTX, `세특 AI 초안 생성 완료: ${draftContent.length}자`, { recordId });
    return { success: true, data: { draftContent } };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다." };
    }
    return { success: false, error: "세특 초안 생성 중 오류가 발생했습니다." };
  }
}
