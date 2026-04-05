"use server";

// ============================================
// H1: 세특 AI 초안 생성 Server Action
// 세특 방향 가이드(direction, keywords) + 학생 진로 맥락으로
// NEIS 500자 이내의 세특 초안을 생성하여 ai_draft_content에 저장
//
// fire-and-forget 패턴: Vercel 60초 타임아웃 방지
// 1. ai_draft_status = 'generating' 으로 설정 후 즉시 반환
// 2. AI 생성 + DB 저장을 비동기로 처리
// 3. 완료 시 ai_draft_status = 'done', 실패 시 'failed'
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "../ai-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { grade5To9 } from "../../grade-normalizer";
import {
  formatSetekFlowDetailed,
  formatDraftBannedPatterns,
  getGradeDiffLevel,
} from "../../evaluation-criteria/defaults";

const LOG_CTX = { domain: "student-record", action: "generateSetekDraft" };

const SYSTEM_PROMPT = `당신은 고등학교 세특(세부능력 및 특기사항) 작성 보조 도우미입니다.

## 역할
- 컨설턴트가 제공하는 방향, 키워드, 탐구 가이드를 기반으로 세특 초안을 생성합니다.
- 이 초안은 교사가 직접 수정하고 확정하는 **시작점**입니다. 완성본이 아닙니다.
- 세특은 학생의 수업 참여, 탐구 과정, 성장을 기술하는 공식 문서입니다.

## 좋은 세특의 8단계 흐름 (반드시 준수)
초안은 아래 흐름을 자연스럽게 따라야 합니다:
${formatSetekFlowDetailed()}

## 규칙
1. 습니다체(~했다, ~보였다, ~성장했다)를 사용합니다. 학생 3인칭 서술입니다.
2. NEIS 기준 500자(한글 500자, 1,500바이트) 이내로 작성합니다.
3. 구체적인 탐구 주제와 과정을 포함합니다 (보고서 작성, 실험, 발표 등).
4. 학업 태도(적극성, 질문, 협업)를 자연스럽게 녹입니다.
5. 제공된 키워드를 2-3개 이상 자연스럽게 포함합니다.
6. AI가 대신 쓴 티가 나지 않도록, 구체적이고 현실적인 활동을 기술합니다.
7. 일반적인 칭찬("우수한 학생", "뛰어난 능력")보다 구체적 행동 서술을 우선합니다.
8. plain text로만 응답합니다 (JSON이 아닌 일반 텍스트).

## 절대 금지 — 합격률 낮은 세특 패턴
아래 패턴은 입학사정관이 즉시 낮은 평가를 주는 유형이므로 절대 생성하지 마세요:
${formatDraftBannedPatterns()}`;

// ─── 내부 AI 생성 로직 (fire-and-forget 내부에서 호출) ────

async function _executeSetekDraftGeneration(
  recordId: string,
  input: Parameters<typeof generateSetekDraftAction>[1],
): Promise<void> {
  const adminClient = createSupabaseAdminClient();
  try {
    let userPrompt = `## 과목: ${input.subjectName} (${input.grade}학년)\n\n`;

    if (input.targetMajor) {
      userPrompt += `- 희망 전공: ${input.targetMajor}\n`;
    }

    // 등급 체계 통합: 9등급 기준으로 정규화하여 난이도 차등 적용
    if (input.rankGrade != null) {
      let grade9: number;
      let displayGrade: string;

      if (typeof input.rankGrade === "string") {
        // 5등급제 성취도("A"~"E") → 9등급 환산
        grade9 = grade5To9(input.rankGrade);
        displayGrade = `${input.rankGrade}(≈${grade9}등급)`;
      } else if (input.curriculumYear && input.curriculumYear >= 2022 && input.rankGrade <= 5) {
        // 5등급제 숫자(1~5) → 9등급 환산: 1→2, 2→3, 3→5, 4→7, 5→9
        const letterMap: Record<number, string> = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" };
        const letter = letterMap[input.rankGrade] ?? "C";
        grade9 = grade5To9(letter);
        displayGrade = `${input.rankGrade}등급(5등급제, ≈${grade9}등급)`;
      } else {
        // 9등급제 그대로
        grade9 = input.rankGrade;
        displayGrade = `${input.rankGrade}등급`;
      }

      const level = getGradeDiffLevel(grade9);
      userPrompt += `- 내신: ${displayGrade} → 탐구 난이도: **${level}** 수준으로 작성\n`;
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
      await adminClient
        .from("student_record_seteks")
        .update({ ai_draft_status: "failed" })
        .eq("id", recordId);
      return;
    }

    const draftContent = result.content.trim();

    const { error: updateErr } = await adminClient
      .from("student_record_seteks")
      .update({
        ai_draft_content: draftContent,
        ai_draft_at: new Date().toISOString(),
        ai_draft_status: "done",
      })
      .eq("id", recordId);

    if (updateErr) {
      logActionError(LOG_CTX, updateErr, { recordId });
      await adminClient
        .from("student_record_seteks")
        .update({ ai_draft_status: "failed" })
        .eq("id", recordId);
      return;
    }

    logActionDebug(LOG_CTX, `세특 AI 초안 생성 완료: ${draftContent.length}자`, { recordId });
  } catch (error) {
    logActionError(LOG_CTX, error, { recordId });
    await adminClient
      .from("student_record_seteks")
      .update({ ai_draft_status: "failed" })
      .eq("id", recordId)
      .catch((e) => logActionError({ ...LOG_CTX, action: "generateSetekDraft_statusUpdate" }, e, { recordId }));
  }
}

// ─── Public Server Action ────────────────────────────────────

export async function generateSetekDraftAction(
  recordId: string,
  input: {
    subjectName: string;
    grade: number;
    direction?: string;
    keywords?: string[];
    targetMajor?: string;
    existingContent?: string;
    /** 해당 교과 내신 등급. 9등급제: 숫자(1~9), 5등급제: 문자("A"~"E") 또는 숫자(1~5). */
    rankGrade?: number | string;
    /** 교육과정 연도 (2015 or 2022). 5등급/9등급 판별용. */
    curriculumYear?: number;
  },
): Promise<ActionResponse<{ generating: true }>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) return { success: false, error: "테넌트 정보가 없습니다." };

    // 1. 상태를 'generating'으로 설정 (request context 유지 중에 처리)
    const supabase = await createSupabaseServerClient();
    const { error: statusErr } = await supabase
      .from("student_record_seteks")
      .update({ ai_draft_status: "generating" })
      .eq("id", recordId);

    if (statusErr) {
      logActionError(LOG_CTX, statusErr, { recordId });
      return { success: false, error: "상태 업데이트에 실패했습니다." };
    }

    // 2. AI 생성을 fire-and-forget으로 실행 (request context 만료 후에도 실행 지속)
    _executeSetekDraftGeneration(recordId, input).catch((err) => {
      logActionError({ ...LOG_CTX, action: "generateSetekDraft_fireAndForget" }, err, { recordId });
    });

    // 3. 즉시 반환 — UI에서 폴링으로 완료 감지
    return { success: true, data: { generating: true } };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다." };
    }
    return { success: false, error: "세특 초안 생성 시작에 실패했습니다." };
  }
}
