"use server";

// ============================================
// C3 — AI 가이드 생성 Server Action
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { generateObjectWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { zodSchema } from "ai";
import {
  createGuide,
  upsertGuideContent,
  replaceSubjectMappings,
  replaceCareerMappings,
  findGuideById,
  findAllSubjects,
  findAllCareerFields,
} from "../../repository";
import { embedSingleGuide } from "../../vector/embedding-service";
import { SubjectMatcher, CareerFieldMatcher } from "../../import/subject-matcher";
import {
  generatedGuideSchema,
  type GuideGenerationInput,
  type GeneratedGuideOutput,
} from "../types";
import {
  KEYWORD_SYSTEM_PROMPT,
  buildKeywordUserPrompt,
} from "../prompts/keyword-guide";
import {
  CLONE_SYSTEM_PROMPT,
  buildCloneUserPrompt,
} from "../prompts/clone-variant";

const LOG_CTX = { domain: "guide", action: "generateGuide" };
const AI_MODEL_VERSION = "gemini-2.0-flash";
const AI_PROMPT_VERSION = "c3-v1";

export async function generateGuideAction(
  input: GuideGenerationInput,
): Promise<ActionResponse<{ guideId: string; preview: GeneratedGuideOutput }>> {
  try {
    const { userId } = await requireAdminOrConsultant();

    // 할당량 확인
    const quota = geminiQuotaTracker.getQuotaStatus();
    if (quota.isExceeded) {
      return createErrorResponse(
        "오늘의 AI 사용 할당량이 초과되었습니다. 내일 다시 시도해주세요.",
      );
    }

    // 입력 검증 + 프롬프트 빌드
    let systemPrompt: string;
    let userPrompt: string;
    let sourceType: "ai_keyword" | "ai_clone_variant";
    let parentGuideId: string | undefined;

    if (input.source === "keyword") {
      if (!input.keyword?.keyword?.trim()) {
        return createErrorResponse("키워드를 입력해주세요.");
      }
      systemPrompt = KEYWORD_SYSTEM_PROMPT;
      userPrompt = buildKeywordUserPrompt(input.keyword);
      sourceType = "ai_keyword";
    } else if (input.source === "clone_variant") {
      if (!input.clone?.sourceGuideId) {
        return createErrorResponse("원본 가이드를 선택해주세요.");
      }
      const sourceGuide = await findGuideById(input.clone.sourceGuideId);
      if (!sourceGuide) {
        return createErrorResponse("원본 가이드를 찾을 수 없습니다.");
      }
      systemPrompt = CLONE_SYSTEM_PROMPT;
      userPrompt = buildCloneUserPrompt(sourceGuide, input.clone);
      sourceType = "ai_clone_variant";
      parentGuideId = input.clone.sourceGuideId;
    } else {
      return createErrorResponse("지원하지 않는 생성 방식입니다.");
    }

    // AI 생성
    const { object: generated } = await generateObjectWithRateLimit({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      schema: zodSchema(generatedGuideSchema),
      modelTier: "fast",
      temperature: 0.5,
      maxTokens: 8192,
    });

    // 과목/계열 이름 → ID 매핑
    const [allSubjects, allCareerFields] = await Promise.all([
      findAllSubjects(),
      findAllCareerFields(),
    ]);

    const subjectMatcher = new SubjectMatcher(allSubjects);
    const careerFieldMatcher = new CareerFieldMatcher(allCareerFields);

    const matchedSubjectIds = generated.suggestedSubjects
      .map((name) => subjectMatcher.match(name))
      .filter((r) => r.matched && r.subjectId)
      .map((r) => r.subjectId!);

    const matchedCareerFieldIds = generated.suggestedCareerFields.flatMap(
      (name) => careerFieldMatcher.match(name),
    );

    // DB 저장
    const guide = await createGuide({
      guideType: generated.guideType,
      title: generated.title,
      bookTitle: generated.bookTitle,
      bookAuthor: generated.bookAuthor,
      bookPublisher: generated.bookPublisher,
      status: "draft",
      sourceType,
      parentGuideId,
      contentFormat: "html",
      qualityTier: "ai_draft",
      aiModelVersion: AI_MODEL_VERSION,
      aiPromptVersion: AI_PROMPT_VERSION,
      registeredBy: userId,
    });

    await Promise.all([
      upsertGuideContent(guide.id, {
        motivation: generated.motivation,
        theorySections: generated.theorySections.map((s) => ({
          ...s,
          content_format: "html" as const,
        })),
        reflection: generated.reflection,
        impression: generated.impression,
        summary: generated.summary,
        followUp: generated.followUp,
        bookDescription: generated.bookDescription,
        relatedPapers: generated.relatedPapers,
        setekExamples: generated.setekExamples,
      }),
      replaceSubjectMappings(
        guide.id,
        matchedSubjectIds.map((id) => ({ subjectId: id })),
      ),
      replaceCareerMappings(guide.id, [...new Set(matchedCareerFieldIds)]),
    ]);

    // 임베딩 (비동기, 실패 무시)
    embedSingleGuide(guide.id).catch((err) => {
      logActionError({ ...LOG_CTX, action: "generateGuide.embedding" }, err, {
        guideId: guide.id,
      });
    });

    return createSuccessResponse({ guideId: guide.id, preview: generated });
  } catch (error) {
    logActionError(LOG_CTX, error, { source: input.source });

    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return createErrorResponse(
        "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
      );
    }

    return createErrorResponse("AI 가이드 생성에 실패했습니다.");
  }
}
