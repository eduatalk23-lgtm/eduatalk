"use server";

// ============================================
// 창체 AI 초안 생성 Server Action
// 창체 방향 가이드(direction, keywords) + 활동유형별 역량 포커스로
// NEIS 글자수 이내의 창체 초안을 생성하여 ai_draft_content에 저장
//
// fire-and-forget 패턴: Vercel 60초 타임아웃 방지
// 1. ai_draft_status = 'generating' 으로 설정 후 즉시 반환
// 2. AI 생성 + DB 저장을 비동기로 처리
// 3. 완료 시 ai_draft_status = 'done', 실패 시 'failed'
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCharLimit } from "@/lib/domains/student-record/constants";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "student-record", action: "generateChangcheDraft" };

// ─── 활동유형별 시스템 프롬프트 ──────────────────────────────

const SYSTEM_PROMPTS: Record<"autonomy" | "club" | "career", string> = {
  autonomy: `당신은 고등학교 창체 자율활동 특기사항 작성 보조 도우미입니다.

## 역할
- 컨설턴트가 제공하는 방향, 키워드, 교사 포인트를 기반으로 자율활동 특기사항 초안을 생성합니다.
- 이 초안은 교사가 직접 수정하고 확정하는 시작점입니다. 완성본이 아닙니다.

## 규칙
1. 습니다체(~했다, ~보였다, ~성장했다)를 사용합니다. 학생 3인칭 서술입니다.
2. NEIS 기준 글자수 이내로 작성합니다.
3. 공동체역량(협업, 소통, 리더십, 책임감, 공동체의식)을 중심으로 서술합니다.
4. 자치활동은 공동 문제 해결과 공동체 역할을, 창의주제활동은 자기주도적 탐구를 강조합니다.
5. 단순 참여 나열 대신, 학생의 역할과 기여를 구체적으로 서술합니다.
6. 제공된 키워드를 2-3개 이상 자연스럽게 포함합니다.
7. AI가 대신 쓴 티가 나지 않도록, 구체적이고 현실적인 활동을 기술합니다.
8. plain text로만 응답합니다 (JSON이 아닌 일반 텍스트).`,

  club: `당신은 고등학교 창체 동아리활동 특기사항 작성 보조 도우미입니다.

## 역할
- 컨설턴트가 제공하는 방향, 키워드, 교사 포인트를 기반으로 동아리활동 특기사항 초안을 생성합니다.
- 이 초안은 교사가 직접 수정하고 확정하는 시작점입니다. 완성본이 아닙니다.

## 규칙
1. 습니다체(~했다, ~보였다, ~성장했다)를 사용합니다. 학생 3인칭 서술입니다.
2. NEIS 기준 글자수 이내로 작성합니다.
3. 진로역량(전공적합성, 탐구력, 적극적 참여)을 중심으로 협업 측면도 자연스럽게 녹입니다.
4. 동아리 내 구체적인 활동(탐구 주제, 프로젝트, 발표 등)과 학생의 개인 역할을 명시합니다.
5. 2년 이상 지속 활동 시 성장 과정과 역량 발전을 강조합니다.
6. 행사 나열보다 탐구 과정과 결과를 중심으로 서술합니다.
7. 제공된 키워드를 2-3개 이상 자연스럽게 포함합니다.
8. AI가 대신 쓴 티가 나지 않도록, 구체적이고 현실적인 활동을 기술합니다.
9. plain text로만 응답합니다 (JSON이 아닌 일반 텍스트).`,

  career: `당신은 고등학교 창체 진로활동 특기사항 작성 보조 도우미입니다.

## 역할
- 컨설턴트가 제공하는 방향, 키워드, 교사 포인트를 기반으로 진로활동 특기사항 초안을 생성합니다.
- 이 초안은 교사가 직접 수정하고 확정하는 시작점입니다. 완성본이 아닙니다.

## 규칙
1. 습니다체(~했다, ~보였다, ~성장했다)를 사용합니다. 학생 3인칭 서술입니다.
2. NEIS 기준 글자수 이내로 작성합니다.
3. 진로탐색→계획→실행 흐름으로 서술합니다. 단순 행사 나열은 금지합니다.
4. 후속 확장 활동(독서, 탐구, 심화학습 연결 등)이 핵심입니다. 이를 중심으로 서술합니다.
5. 진로역량(전공적합성, 자기주도탐구, 진로계획의 구체성)을 강조합니다.
6. 행사 참여 자체보다 참여 이후 학생의 변화와 심화 탐구를 서술합니다.
7. 제공된 키워드를 2-3개 이상 자연스럽게 포함합니다.
8. AI가 대신 쓴 티가 나지 않도록, 구체적이고 현실적인 활동을 기술합니다.
9. plain text로만 응답합니다 (JSON이 아닌 일반 텍스트).`,
};

const ACTIVITY_LABELS: Record<"autonomy" | "club" | "career", string> = {
  autonomy: "자율활동",
  club: "동아리활동",
  career: "진로활동",
};

// ─── 내부 AI 생성 로직 (fire-and-forget 내부에서 호출) ────

async function _executeChangcheDraftGeneration(
  recordId: string,
  input: Parameters<typeof generateChangcheDraftAction>[1],
): Promise<void> {
  const adminClient = createSupabaseAdminClient();
  try {
    const charLimit = getCharLimit(input.activityType, input.schoolYear);
    const activityLabel = ACTIVITY_LABELS[input.activityType];
    const systemPrompt = SYSTEM_PROMPTS[input.activityType];

    let userPrompt = `## ${activityLabel} (${input.grade}학년)\n\n`;
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

    if (input.existingContent && input.existingContent.trim().length > 10) {
      userPrompt += `\n## 기존 내용 (참고용, 중복 방지)\n${input.existingContent.slice(0, 300)}\n`;
    }

    userPrompt += `\n위 정보를 바탕으로 NEIS ${charLimit}자 이내의 ${activityLabel} 특기사항 초안을 작성해주세요.`;

    const result = await withRetry(
      () => generateTextWithRateLimit({
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: "standard",
        temperature: 0.5,
        maxTokens: 2000,
      }),
      { label: "generateChangcheDraft" },
    );

    if (!result.content) {
      await adminClient
        .from("student_record_changche")
        .update({ ai_draft_status: "failed" })
        .eq("id", recordId);
      return;
    }

    const draftContent = result.content.trim();

    const { error: updateErr } = await adminClient
      .from("student_record_changche")
      .update({
        ai_draft_content: draftContent,
        ai_draft_at: new Date().toISOString(),
        ai_draft_status: "done",
      })
      .eq("id", recordId);

    if (updateErr) {
      logActionError(LOG_CTX, updateErr, { recordId });
      await adminClient
        .from("student_record_changche")
        .update({ ai_draft_status: "failed" })
        .eq("id", recordId);
      return;
    }

    logActionDebug(LOG_CTX, `창체 AI 초안 생성 완료: ${draftContent.length}자 (${activityLabel})`, { recordId });
  } catch (error) {
    logActionError(LOG_CTX, error, { recordId });
    await adminClient
      .from("student_record_changche")
      .update({ ai_draft_status: "failed" })
      .eq("id", recordId)
      .catch((e) => logActionError({ ...LOG_CTX, action: "generateChangcheDraft_statusUpdate" }, e, { recordId }));
  }
}

// ─── Public Server Action ────────────────────────────────────────────

export async function generateChangcheDraftAction(
  recordId: string,
  input: {
    activityType: "autonomy" | "club" | "career";
    grade: number;
    schoolYear: number;
    direction?: string;
    keywords?: string[];
    teacherPoints?: string[];
    existingContent?: string;
  },
): Promise<ActionResponse<{ generating: true }>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) return { success: false, error: "테넌트 정보가 없습니다." };

    // 1. 상태를 'generating'으로 설정
    const supabase = await createSupabaseServerClient();
    const { error: statusErr } = await supabase
      .from("student_record_changche")
      .update({ ai_draft_status: "generating" })
      .eq("id", recordId);

    if (statusErr) {
      logActionError(LOG_CTX, statusErr, { recordId });
      return { success: false, error: "상태 업데이트에 실패했습니다." };
    }

    // 2. AI 생성을 fire-and-forget으로 실행
    _executeChangcheDraftGeneration(recordId, input).catch((err) => {
      logActionError({ ...LOG_CTX, action: "generateChangcheDraft_fireAndForget" }, err, { recordId });
    });

    // 3. 즉시 반환
    return { success: true, data: { generating: true } };
  } catch (error) {
    return handleLlmActionError(error, "창체 초안 생성 시작", LOG_CTX);
  }
}
