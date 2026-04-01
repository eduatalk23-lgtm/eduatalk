"use server";

// ============================================
// C3 — AI 가이드 생성 Server Action
//
// placeholder 생성 + guideId 즉시 반환만 담당.
// 실제 AI 생성은 클라이언트가 API route (POST /api/admin/guides/generate)를
// 호출하여 maxDuration=300 환경에서 실행.
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createGuide } from "../../repository";
import type { GuideGenerationInput } from "../types";

const LOG_CTX = { domain: "guide", action: "generateGuide" };

export async function generateGuideAction(
  input: GuideGenerationInput,
): Promise<ActionResponse<{ guideId: string }>> {
  try {
    const { userId } = await requireAdminOrConsultant();

    if (!input.source) {
      return createErrorResponse("생성 소스(source)가 누락되었습니다.");
    }

    const guide = await createGuide({
      guideType: input.keyword?.guideType ?? input.pdf?.guideType ?? input.url?.guideType ?? "topic_exploration",
      title: "생성 중...",
      curriculumYear: input.curriculumYear ?? undefined,
      subjectArea: input.subjectArea ?? undefined,
      subjectSelect: input.subjectSelect ?? undefined,
      unitMajor: input.unitMajor ?? undefined,
      unitMinor: input.unitMinor ?? undefined,
      status: "ai_generating",
      sourceType: "ai_keyword",
      contentFormat: "html",
      qualityTier: "ai_draft",
      registeredBy: userId,
    });

    return createSuccessResponse({ guideId: guide.id });
  } catch (error) {
    logActionError(LOG_CTX, error, { source: input.source });
    return createErrorResponse("가이드 생성 요청에 실패했습니다.");
  }
}
