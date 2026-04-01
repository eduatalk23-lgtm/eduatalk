"use server";

// ============================================
// 행특 AI 초안 생성 Server Action
// 세특/창체 기록 요약 + 방향 가이드 + 7개 평가항목을 종합하여
// 담임교사 관점의 행동특성 및 종합의견 초안을 생성하여 ai_draft_content에 저장
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCharLimit } from "@/lib/domains/student-record/constants";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "student-record", action: "generateHaengteukDraft" };

// ─── 시스템 프롬프트 ────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 고등학교 행동특성 및 종합의견(행특) 작성 보조 도우미입니다.

## 역할
- 컨설턴트가 제공하는 방향 가이드, 세특/창체 기록 요약, 7개 평가항목을 기반으로 행특 초안을 생성합니다.
- 이 초안은 교사가 직접 수정하고 확정하는 시작점입니다. 완성본이 아닙니다.
- 행특은 담임교사가 1년간 관찰한 학생의 인성·생활태도·성장을 종합적으로 기술하는 교사 추천서 성격의 문서입니다.

## 규칙
1. 담임교사의 관점에서 학생에 대한 종합의견을 작성합니다. "담임으로서", "본 학생은" 등의 표현을 자연스럽게 사용합니다.
2. 습니다체(~했다, ~보였다, ~성장했다)를 사용합니다. 학생 3인칭 서술입니다.
3. NEIS 기준 글자수 이내로 작성합니다.
4. 구체적인 사례와 근거에 기반하여 작성하고, 추상적인 칭찬("우수한 학생", "뛰어난 능력")만 나열하지 않습니다.
5. 학생의 장점뿐 아니라 성장 과정과 변화 가능성도 자연스럽게 언급합니다.
6. 세특/창체 기록과 자연스럽게 연계하여, 교과 활동과 생활 태도의 일관성을 보여줍니다.
7. 7개 평가항목(자기주도성, 갈등관리, 리더십, 타인존중, 배려나눔, 성실성, 규칙준수)이 제공된 경우, 각 항목의 평가를 자연스러운 문장 안에 녹여서 서술합니다. 항목명을 직접 나열하지 않습니다.
8. 제공된 키워드를 2-3개 이상 자연스럽게 포함합니다.
9. AI가 대신 쓴 티가 나지 않도록, 구체적이고 현실적인 관찰 내용을 기술합니다.
10. plain text로만 응답합니다 (JSON이 아닌 일반 텍스트).

## 절대 금지 — 약한 행특 패턴
아래 표현은 입학사정관이 "변별력 없음"으로 평가하므로 사용하지 마세요:
- ❌ "수업에 성실히 참여함", "학습 태도가 좋음", "모범적인 학생" — 모든 학생에게 해당하는 상투적 표현
- ❌ "관심을 보임", "노력하는 모습을 보임" — 구체적 성과/근거 없음
- ❌ "~를 알게 됨", "~다짐함", "~생각함", "~깨닫게 됨" — 교사가 직접 관찰할 수 없는 내면 상태
- ❌ "적극적임", "흥미를 보임" — 구체적 관찰 불가능한 수식어

대신 사용해야 하는 좋은 표현:
- ✅ "특히, ~에서 두드러진 역할을 수행하며" — 해당 학생만의 개별적 특성 강조
- ✅ "날카로운 관찰력으로 ~를 발견하고" — 구체적 관찰 근거
- ✅ "갈등 상황에서 ~한 방식으로 합의를 이끌어내며" — 관찰 가능한 행동
- ✅ "1학기 대비 ~에서 성장을 보이며" — 성장 과정의 구체적 근거`;

// ─── Server Action ────────────────────────────────────────────

export async function generateHaengteukDraftAction(
  recordId: string,
  input: {
    grade: number;
    schoolYear: number;
    studentName?: string;
    direction?: string;
    keywords?: string[];
    teacherPoints?: string[];
    evaluationItems?: Array<{ item: string; score: string; reasoning: string }>;
    existingContent?: string;
    setekSummary?: string;
    changcheSummary?: string;
  },
): Promise<ActionResponse<{ draftContent: string }>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) return { success: false, error: "테넌트 정보가 없습니다." };

    const charLimit = getCharLimit("haengteuk", input.schoolYear);
    const studentLabel = input.studentName ? `${input.studentName} 학생` : "본 학생";

    let userPrompt = `## 행동특성 및 종합의견 (${input.grade}학년)\n\n`;
    userPrompt += `- 대상: ${studentLabel}\n`;
    userPrompt += `- NEIS 글자수 제한: ${charLimit}자 이내\n`;

    if (input.direction) {
      userPrompt += `\n## 작성 방향\n${input.direction}\n`;
    }

    if (input.keywords && input.keywords.length > 0) {
      userPrompt += `\n## 포함할 키워드\n${input.keywords.join(", ")}\n`;
    }

    if (input.teacherPoints && input.teacherPoints.length > 0) {
      userPrompt += `\n## 교사 전달 포인트\n${input.teacherPoints.map((p) => `- ${p}`).join("\n")}\n`;
    }

    if (input.evaluationItems && input.evaluationItems.length > 0) {
      userPrompt += `\n## 7개 평가항목 (자연스럽게 문장 안에 녹여주세요)\n`;
      for (const ei of input.evaluationItems) {
        userPrompt += `- ${ei.item} [${ei.score}]: ${ei.reasoning}\n`;
      }
    }

    if (input.setekSummary && input.setekSummary.trim().length > 10) {
      userPrompt += `\n## 세특 주요 내용 요약 (교과 활동 연계 참고)\n${input.setekSummary.slice(0, 400)}\n`;
    }

    if (input.changcheSummary && input.changcheSummary.trim().length > 10) {
      userPrompt += `\n## 창체 주요 내용 요약 (활동 연계 참고)\n${input.changcheSummary.slice(0, 400)}\n`;
    }

    if (input.existingContent && input.existingContent.trim().length > 10) {
      userPrompt += `\n## 기존 내용 (참고용, 중복 방지)\n${input.existingContent.slice(0, 300)}\n`;
    }

    userPrompt += `\n위 정보를 바탕으로 담임교사 관점의 NEIS ${charLimit}자 이내 행동특성 및 종합의견 초안을 작성해주세요. 7개 평가항목의 내용을 자연스러운 서술문으로 녹여야 합니다.`;

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

    const supabase = await createSupabaseServerClient();
    const { error: updateErr } = await supabase
      .from("student_record_haengteuk")
      .update({
        ai_draft_content: draftContent,
        ai_draft_at: new Date().toISOString(),
      })
      .eq("id", recordId);

    if (updateErr) {
      logActionError(LOG_CTX, updateErr, { recordId });
      return { success: false, error: "AI 초안 저장에 실패했습니다." };
    }

    logActionDebug(LOG_CTX, `행특 AI 초안 생성 완료: ${draftContent.length}자`, { recordId });
    return { success: true, data: { draftContent } };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다." };
    }
    return { success: false, error: "행특 초안 생성 중 오류가 발생했습니다." };
  }
}
