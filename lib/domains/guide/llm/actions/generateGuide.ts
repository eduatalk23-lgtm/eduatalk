"use server";

// ============================================
// C3 + C3.1 — AI 가이드 생성 Server Action
// 소스: keyword, clone_variant, pdf_extract, url_extract
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
import type { GuideSourceType } from "../../types";
import {
  KEYWORD_SYSTEM_PROMPT,
  buildKeywordUserPrompt,
} from "../prompts/keyword-guide";
import {
  CLONE_SYSTEM_PROMPT,
  buildCloneUserPrompt,
} from "../prompts/clone-variant";
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from "../prompts/extraction-guide";
import { extractTextFromPdfUrl } from "../extract/pdf-extractor";
import { extractTextFromUrl } from "../extract/url-extractor";

const LOG_CTX = { domain: "guide", action: "generateGuide" };
const AI_MODEL_VERSION = "gemini-2.0-flash";
const AI_PROMPT_VERSION = "c3.1-v1";

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
    const promptResult = await buildPrompt(input);
    if (!promptResult.ok) {
      return createErrorResponse(promptResult.error);
    }

    const { systemPrompt, userPrompt, sourceType, parentGuideId } = promptResult;

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
    if (msg.includes("PDF") || msg.includes("페이지")) {
      return createErrorResponse(msg);
    }

    return createErrorResponse("AI 가이드 생성에 실패했습니다.");
  }
}

// ============================================
// 내부: 소스별 프롬프트 빌드
// ============================================

type PromptBuildResult =
  | {
      ok: true;
      systemPrompt: string;
      userPrompt: string;
      sourceType: GuideSourceType;
      parentGuideId?: string;
    }
  | { ok: false; error: string };

async function buildPrompt(
  input: GuideGenerationInput,
): Promise<PromptBuildResult> {
  switch (input.source) {
    case "keyword": {
      if (!input.keyword?.keyword?.trim()) {
        return { ok: false, error: "키워드를 입력해주세요." };
      }
      return {
        ok: true,
        systemPrompt: KEYWORD_SYSTEM_PROMPT,
        userPrompt: buildKeywordUserPrompt(input.keyword),
        sourceType: "ai_keyword",
      };
    }

    case "clone_variant": {
      if (!input.clone?.sourceGuideId) {
        return { ok: false, error: "원본 가이드를 선택해주세요." };
      }
      const sourceGuide = await findGuideById(input.clone.sourceGuideId);
      if (!sourceGuide) {
        return { ok: false, error: "원본 가이드를 찾을 수 없습니다." };
      }
      return {
        ok: true,
        systemPrompt: CLONE_SYSTEM_PROMPT,
        userPrompt: buildCloneUserPrompt(sourceGuide, input.clone),
        sourceType: "ai_clone_variant",
        parentGuideId: input.clone.sourceGuideId,
      };
    }

    case "pdf_extract": {
      if (!input.pdf?.pdfUrl?.trim()) {
        return { ok: false, error: "PDF URL을 입력해주세요." };
      }
      const pdfResult = await extractTextFromPdfUrl(input.pdf.pdfUrl);
      return {
        ok: true,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        userPrompt: buildExtractionUserPrompt({
          extractedText: pdfResult.text,
          sourceTitle: pdfResult.title,
          sourceUrl: input.pdf.pdfUrl,
          sourceType: "pdf",
          guideType: input.pdf.guideType,
          targetSubject: input.pdf.targetSubject,
          targetCareerField: input.pdf.targetCareerField,
          additionalContext: input.pdf.additionalContext,
        }),
        sourceType: "ai_pdf_extract",
      };
    }

    case "url_extract": {
      if (!input.url?.url?.trim()) {
        return { ok: false, error: "URL을 입력해주세요." };
      }
      const urlResult = await extractTextFromUrl(input.url.url);
      return {
        ok: true,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        userPrompt: buildExtractionUserPrompt({
          extractedText: urlResult.text,
          sourceTitle: urlResult.title,
          sourceUrl: urlResult.url,
          sourceType: "url",
          guideType: input.url.guideType,
          targetSubject: input.url.targetSubject,
          targetCareerField: input.url.targetCareerField,
          additionalContext: input.url.additionalContext,
        }),
        sourceType: "ai_url_extract",
      };
    }

    default:
      return { ok: false, error: "지원하지 않는 생성 방식입니다." };
  }
}
