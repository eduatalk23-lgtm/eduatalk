"use server";

/**
 * AI 에이전트 가이드 편집 Server Action
 *
 * 패턴 (generateGuide와 동일 — API Route 분리):
 *   1. Server Action: 입력 검증 + 새 버전 생성(ai_improving) + guideId 즉시 반환
 *   2. 클라이언트: API Route(/api/admin/guides/agent-edit)를 fire-and-forget fetch
 *   3. API Route(maxDuration=300): executeAgentEdit() 동기 실행
 *   4. 성공: status="draft" + 수정 콘텐츠 저장 + auto-classify / 실패: status="ai_failed"
 */

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { generateObjectWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { zodSchema } from "ai";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createNewVersion,
  upsertGuideContent,
} from "../../repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatedGuideSchema } from "../types";
import type { GeneratedGuideOutput } from "../types";
import {
  buildAgentEditSystemPrompt,
  buildAgentEditUserPrompt,
} from "../prompts/agent-edit";
import { resolveContentSections } from "../../section-config";
import type { GuideType } from "../../types";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";

const LOG_CTX = { domain: "guide", action: "agentEditGuide" };

// ============================================
// 퍼블릭 Server Action — 즉시 반환
// ============================================

export async function agentEditGuideAction(
  guideId: string,
  instruction: string,
  targetSectionKeys?: string[],
): Promise<ActionResponse<{ guideId: string }>> {
  try {
    await requireAdminOrConsultant();

    if (!instruction.trim()) {
      return createErrorResponse("편집 지시를 입력해주세요.");
    }

    // 할당량 확인
    const quota = geminiQuotaTracker.getQuotaStatus();
    if (quota.isExceeded) {
      return createErrorResponse(
        "일일 AI 할당량이 초과되었습니다. 내일 다시 시도해주세요.",
      );
    }

    // 가이드 로드
    const { findGuideById } = await import("../../repository");
    const guide = await findGuideById(guideId);
    if (!guide) {
      return createErrorResponse("가이드를 찾을 수 없습니다.");
    }
    if (!guide.content) {
      return createErrorResponse("가이드 본문이 없습니다.");
    }

    // user ID 검증
    const user = await getCachedAuthUser();
    if (!user?.id) {
      return createErrorResponse("사용자 정보를 확인할 수 없습니다.");
    }

    // 새 버전을 "ai_improving" 상태로 즉시 생성
    const newGuide = await createNewVersion(guideId, user.id);

    const adminClient = createSupabaseAdminClient();
    await adminClient
      .from("exploration_guides")
      .update({
        status: "ai_improving",
        source_type: "ai_improve",
        quality_tier: "ai_draft",
        review_result: null,
        version_message: `AI 에이전트 편집 중... "${instruction.slice(0, 50)}${instruction.length > 50 ? "..." : ""}"`,
      })
      .eq("id", newGuide.id);

    return createSuccessResponse({ guideId: newGuide.id });
  } catch (error) {
    logActionError(LOG_CTX, error, { guideId });
    return createErrorResponse("AI 편집에 실패했습니다.");
  }
}

// ============================================
// 내부: 백그라운드 실행 함수
// ============================================

/**
 * @param askInput true이면 결과를 바로 저장하지 않고 awaiting_input 상태로 전환하여 사용자 확인 대기.
 *                 사용자 승인 후 applyAgentEditResult()로 저장.
 */
export async function executeAgentEdit(
  newGuideId: string,
  sourceGuideId: string,
  instruction: string,
  targetSectionKeys?: string[],
  askInput = false,
): Promise<void> {
  const adminClient = createSupabaseAdminClient();

  try {
    // 원본 가이드 재로드 (admin client)
    const { findGuideByIdPublic } = await import("../../repository");
    const guide = await findGuideByIdPublic(sourceGuideId);
    if (!guide || !guide.content) {
      await adminClient
        .from("exploration_guides")
        .update({ status: "ai_failed" })
        .eq("id", newGuideId);
      return;
    }

    // content_sections 해석
    const contentSections = resolveContentSections(
      guide.guide_type as GuideType,
      guide.content,
    );

    // 프롬프트 조립
    const userPrompt = buildAgentEditUserPrompt({
      title: guide.title,
      guideType: guide.guide_type,
      instruction,
      targetSectionKeys,
      contentSections:
        contentSections.length > 0 ? contentSections : [],
      motivation: guide.content.motivation ?? "",
      theorySections: guide.content.theory_sections?.map((s) => ({
        title: s.title,
        content: s.content,
        outline: s.outline,
      })),
      reflection: guide.content.reflection ?? "",
      impression: guide.content.impression ?? "",
      summary: guide.content.summary ?? "",
      followUp: guide.content.follow_up ?? "",
      bookDescription: guide.content.book_description ?? undefined,
      setekExamples: guide.content.setek_examples,
    });

    // Gemini 호출 — advanced 우선, fallback fast
    let edited: GeneratedGuideOutput;
    let modelId: string;
    const editOpts = {
      system: buildAgentEditSystemPrompt(guide.guide_type as GuideType),
      messages: [{ role: "user" as const, content: userPrompt }],
      schema: zodSchema(generatedGuideSchema),
      temperature: 0.3,
      maxTokens: 65536,
    };

    try {
      const result = await generateObjectWithRateLimit({
        ...editOpts,
        modelTier: "advanced",
      });
      edited = result.object;
      modelId = result.modelId;
    } catch (primaryError) {
      const msg =
        primaryError instanceof Error ? primaryError.message : "";
      if (
        msg.includes("high demand") ||
        msg.includes("429") ||
        msg.includes("overloaded")
      ) {
        const { logActionWarn } = await import("@/lib/logging/actionLogger");
        logActionWarn(LOG_CTX, "2.5-pro 과부하 → 2.5-flash fallback", {
          newGuideId,
        });
        const result = await generateObjectWithRateLimit({
          ...editOpts,
          modelTier: "fast",
          maxTokens: 40960,
        });
        edited = result.object;
        modelId = result.modelId + " (fallback)";
      } else {
        throw primaryError;
      }
    }

    // 결과 검증
    if (edited.sections.length === 0) {
      await adminClient
        .from("exploration_guides")
        .update({ status: "ai_failed" })
        .eq("id", newGuideId);
      return;
    }

    // ask-input 모드: 결과를 agent_question에 임시 저장하고 awaiting_input 전환
    if (askInput) {
      // 수정된 섹션 요약 (사용자에게 보여줄 diff summary)
      const changedSections = edited.sections
        .map((s) => s.label)
        .join(", ");

      await adminClient
        .from("exploration_guides")
        .update({
          status: "awaiting_input",
          agent_question: {
            question: `다음 섹션이 수정되었습니다: ${changedSections}. 적용하시겠습니까?`,
            choices: ["적용", "취소"],
            context: instruction,
            editResult: edited, // LLM 결과 전체를 임시 보관
            modelId,
            sourceGuideId,
          },
          version_message: `AI 편집 확인 대기: "${instruction.slice(0, 50)}..."`,
          ai_model_version: modelId,
          ai_prompt_version: "agent-edit-v1",
        })
        .eq("id", newGuideId);
      return;
    }

    // 즉시 적용 모드: 결과 저장
    await applyEditResult(adminClient, newGuideId, edited, guide.content.setek_examples, instruction, modelId);

    // auto-classify 재실행 (임베딩 + 클러스터/난이도/사슬 재배정)
    try {
      const { embedSingleGuide } = await import(
        "../../vector/embedding-service"
      );
      const ok = await embedSingleGuide(newGuideId);
      if (ok) {
        const { autoClassifyGuide } = await import(
          "../../vector/auto-classify"
        );
        await autoClassifyGuide(newGuideId);
      }
    } catch (classifyErr) {
      const { logActionWarn: logWarn } = await import(
        "@/lib/logging/actionLogger"
      );
      logWarn(LOG_CTX, "auto-classify 실패 (편집 결과는 저장됨)", {
        newGuideId,
        error:
          classifyErr instanceof Error
            ? classifyErr.message
            : String(classifyErr),
      });
    }
  } catch (error) {
    logActionError(
      { ...LOG_CTX, action: "executeAgentEdit" },
      error,
      { newGuideId, sourceGuideId },
    );

    try {
      await adminClient
        .from("exploration_guides")
        .update({ status: "ai_failed" })
        .eq("id", newGuideId);
    } catch (updateError) {
      logActionError(
        { ...LOG_CTX, action: "executeAgentEdit.failUpdate" },
        updateError,
        { newGuideId },
      );
    }
  }
}

// ============================================
// 내부: sections → 레거시 역변환
// ============================================

function sectionsToLegacy(
  sections: Array<{
    key: string;
    label: string;
    content: string;
    items?: string[];
    order?: number;
    outline?: import("../../types").OutlineItem[];
  }>,
) {
  const result = {
    motivation: undefined as string | undefined,
    theorySections: [] as Array<{
      order: number;
      title: string;
      content: string;
      content_format: "html";
      outline?: import("../../types").OutlineItem[];
    }>,
    reflection: undefined as string | undefined,
    impression: undefined as string | undefined,
    summary: undefined as string | undefined,
    followUp: undefined as string | undefined,
    bookDescription: undefined as string | undefined,
  };

  for (const s of sections) {
    switch (s.key) {
      case "motivation":
        result.motivation = s.content;
        break;
      case "content_sections":
        result.theorySections.push({
          order: s.order ?? result.theorySections.length + 1,
          title: s.label,
          content: s.content,
          content_format: "html",
          outline: s.outline,
        });
        break;
      case "reflection":
        result.reflection = s.content;
        break;
      case "impression":
        result.impression = s.content;
        break;
      case "summary":
        result.summary = s.content;
        break;
      case "follow_up":
        result.followUp = s.content;
        break;
      case "book_description":
        result.bookDescription = s.content;
        break;
    }
  }
  return result;
}

// ============================================
// 내부: LLM 결과 → DB 저장 (즉시 적용 / Phase 2 공용)
// ============================================

async function applyEditResult(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  newGuideId: string,
  edited: GeneratedGuideOutput,
  originalSetekExamples: string[] | undefined,
  instruction: string,
  modelId: string,
): Promise<void> {
  const legacy = sectionsToLegacy(edited.sections);

  await upsertGuideContent(
    newGuideId,
    {
      motivation: legacy.motivation ?? edited.motivation ?? "",
      theorySections:
        legacy.theorySections.length > 0
          ? legacy.theorySections
          : (edited.theorySections ?? []).map((s) => ({
              ...s,
              content_format: "html" as const,
            })),
      reflection: legacy.reflection ?? edited.reflection ?? "",
      impression: legacy.impression ?? edited.impression ?? "",
      summary: legacy.summary ?? edited.summary ?? "",
      followUp: legacy.followUp ?? edited.followUp ?? "",
      bookDescription: legacy.bookDescription ?? edited.bookDescription,
      relatedPapers: edited.relatedPapers,
      setekExamples: edited.setekExamples ?? originalSetekExamples,
      contentSections: edited.sections.map((s) => ({
        key: s.key,
        label: s.label,
        content: s.content,
        content_format: "html" as const,
        items: s.items,
        order: s.order,
        outline: s.outline,
      })),
    },
    adminClient,
  );

  await adminClient
    .from("exploration_guides")
    .update({
      status: "draft",
      quality_score: null,
      quality_tier: "ai_draft",
      review_result: null,
      agent_question: null,
      version_message: `AI 에이전트 편집: "${instruction.slice(0, 80)}${instruction.length > 80 ? "..." : ""}"`,
      ai_model_version: modelId,
      ai_prompt_version: "agent-edit-v1",
    })
    .eq("id", newGuideId);
}

// ============================================
// Phase 2 진입점: awaiting_input 상태에서 사용자 승인 후 적용
// ============================================

export async function applyAgentEditResult(
  guideId: string,
): Promise<void> {
  const adminClient = createSupabaseAdminClient();

  // agent_question에서 임시 저장된 LLM 결과 로드
  const { data: guide, error } = await adminClient
    .from("exploration_guides")
    .select("status, agent_question")
    .eq("id", guideId)
    .single();

  if (error || !guide) throw new Error("가이드를 찾을 수 없습니다.");
  if (guide.status !== "awaiting_input") {
    throw new Error(`상태가 awaiting_input이 아닙니다: ${guide.status}`);
  }

  const q = guide.agent_question as {
    editResult: GeneratedGuideOutput;
    modelId: string;
    context: string;
    sourceGuideId: string;
  } | null;

  if (!q?.editResult) throw new Error("저장된 편집 결과가 없습니다.");

  // 원본 가이드에서 setek_examples 가져오기
  const { findGuideByIdPublic } = await import("../../repository");
  const sourceGuide = await findGuideByIdPublic(q.sourceGuideId);

  await applyEditResult(
    adminClient,
    guideId,
    q.editResult,
    sourceGuide?.content?.setek_examples,
    q.context,
    q.modelId,
  );

  // auto-classify
  try {
    const { embedSingleGuide } = await import("../../vector/embedding-service");
    const ok = await embedSingleGuide(guideId);
    if (ok) {
      const { autoClassifyGuide } = await import("../../vector/auto-classify");
      await autoClassifyGuide(guideId);
    }
  } catch {
    // auto-classify 실패해도 편집 결과는 저장됨
  }
}
