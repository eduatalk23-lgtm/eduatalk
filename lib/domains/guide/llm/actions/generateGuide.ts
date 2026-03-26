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
  replaceClassificationMappings,
  findGuideById,
  findAllSubjects,
  findAllCareerFields,
  findAllClassifications,
} from "../../repository";
import { embedSingleGuide } from "../../vector/embedding-service";
import { SubjectMatcher, CareerFieldMatcher, ClassificationMatcher } from "../../import/subject-matcher";
import {
  generatedGuideSchema,
  type GuideGenerationInput,
  type GeneratedGuideOutput,
} from "../types";
import type { GuideSourceType } from "../../types";
import {
  buildKeywordSystemPrompt,
  buildKeywordUserPrompt,
} from "../prompts/keyword-guide";
import {
  buildCloneSystemPrompt,
  buildCloneUserPrompt,
} from "../prompts/clone-variant";
import {
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
} from "../prompts/extraction-guide";
import { extractTextFromPdfUrl } from "../extract/pdf-extractor";
import { extractTextFromUrl } from "../extract/url-extractor";

const LOG_CTX = { domain: "guide", action: "generateGuide" };
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

    // 학생 프로필 자동 로드 (studentId가 있고 studentProfile이 없을 때)
    if (input.studentId && !input.studentProfile) {
      const { loadStudentProfileForGuide } = await import(
        "../loaders/student-profile-loader"
      );
      const profile = await loadStudentProfileForGuide(input.studentId);
      if (profile) {
        input.studentProfile = profile;
      }
    }

    // 입력 검증 + 프롬프트 빌드
    const promptResult = await buildPrompt(input);
    if (!promptResult.ok) {
      return createErrorResponse(promptResult.error);
    }

    const { systemPrompt, userPrompt, sourceType, parentGuideId } = promptResult;

    // AI 생성
    const tier = input.modelTier ?? "fast";
    const { object: generated, modelId } = await generateObjectWithRateLimit({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      schema: zodSchema(generatedGuideSchema),
      modelTier: tier,
      temperature: 0.5,
      maxTokens: tier === "advanced" ? 20480 : 14336,
    });

    // selectedSectionKeys가 있으면 AI 출력을 필터링 (선택하지 않은 섹션 제거)
    // Core 섹션은 항상 포함하여 데이터 무결성 보장
    if (input.selectedSectionKeys?.length) {
      const { getCoreSections } = await import("../../section-config");
      const guideType = generated.guideType as import("../../types").GuideType;
      const coreKeys = new Set(getCoreSections(guideType).map((s) => s.key));
      const allowedKeys = new Set([
        ...coreKeys,
        ...input.selectedSectionKeys,
      ]);
      generated.sections = generated.sections.filter((s) =>
        allowedKeys.has(s.key),
      );
    }

    // 필터링 후 유효성 검증
    if (generated.sections.length === 0) {
      return createErrorResponse(
        "AI가 유효한 섹션을 생성하지 못했습니다. 다시 시도해주세요.",
      );
    }

    // 과목/계열/소분류 이름 → ID 매핑
    const [allSubjects, allCareerFields, allClassifications] = await Promise.all([
      findAllSubjects(),
      findAllCareerFields(),
      findAllClassifications(),
    ]);

    const subjectMatcher = new SubjectMatcher(allSubjects);
    const careerFieldMatcher = new CareerFieldMatcher(allCareerFields);
    const classificationMatcher = new ClassificationMatcher(allClassifications);

    const matchedSubjectIds = generated.suggestedSubjects
      .map((name) => subjectMatcher.match(name))
      .filter((r) => r.matched && r.subjectId)
      .map((r) => r.subjectId!);

    const matchedCareerFieldIds = generated.suggestedCareerFields.flatMap(
      (name) => careerFieldMatcher.match(name),
    );

    const matchedClassificationIds = classificationMatcher.matchAll(
      generated.suggestedClassifications ?? [],
    );

    // DB 저장
    const guide = await createGuide({
      guideType: generated.guideType,
      title: generated.title,
      bookTitle: generated.bookTitle,
      bookAuthor: generated.bookAuthor,
      bookPublisher: generated.bookPublisher,
      curriculumYear: input.curriculumYear ?? undefined,
      subjectArea: input.subjectArea ?? undefined,
      subjectSelect: input.subjectSelect ?? undefined,
      unitMajor: input.unitMajor ?? undefined,
      unitMinor: input.unitMinor ?? undefined,
      status: "draft",
      sourceType,
      parentGuideId,
      contentFormat: "html",
      qualityTier: "ai_draft",
      aiModelVersion: modelId,
      aiPromptVersion: AI_PROMPT_VERSION,
      registeredBy: userId,
    });

    // sections → 레거시 필드 역변환 (하위 호환 이중 저장)
    const legacy = sectionsToLegacy(generated.sections, generated.guideType);

    await Promise.all([
      upsertGuideContent(guide.id, {
        // 레거시 backfill (sections 기반 우선, fallback으로 generated 직접 사용)
        motivation: legacy.motivation ?? generated.motivation ?? "",
        theorySections:
          legacy.theorySections.length > 0
            ? legacy.theorySections
            : (generated.theorySections ?? []).map((s) => ({
                ...s,
                content_format: "html" as const,
              })),
        reflection: legacy.reflection ?? generated.reflection ?? "",
        impression: legacy.impression ?? generated.impression ?? "",
        summary: legacy.summary ?? generated.summary ?? "",
        followUp: legacy.followUp ?? generated.followUp ?? "",
        bookDescription:
          legacy.bookDescription ?? generated.bookDescription,
        relatedPapers: generated.relatedPapers,
        setekExamples:
          legacy.setekExamples.length > 0
            ? legacy.setekExamples
            : generated.setekExamples,
        // 유형별 섹션 데이터 (신규 구조 — 우선 소스)
        contentSections: generated.sections.map((s) => ({
          key: s.key,
          label: s.label,
          content: s.content,
          content_format: "html" as const,
          items: s.items,
          order: s.order,
          outline: s.outline,
        })),
      }),
      replaceSubjectMappings(
        guide.id,
        matchedSubjectIds.map((id) => ({ subjectId: id })),
      ),
      replaceCareerMappings(guide.id, [...new Set(matchedCareerFieldIds)]),
      matchedClassificationIds.length > 0
        ? replaceClassificationMappings(guide.id, matchedClassificationIds)
        : Promise.resolve(),
    ]);

    // 임베딩 (비동기, 실패 무시)
    embedSingleGuide(guide.id).catch((err) => {
      logActionError({ ...LOG_CTX, action: "generateGuide.embedding" }, err, {
        guideId: guide.id,
      });
    });

    // guide_created_count + used_count 증가 (키워드 소스 + 비동기, 실패 무시)
    if (input.source === "keyword" && input.keyword?.keyword) {
      import("../../repository")
        .then(async ({ findTopicsByTitle, incrementTopicGuideCreatedCount, incrementTopicUsedCount }) => {
          const matchingTopics = await findTopicsByTitle(
            input.keyword!.keyword,
          );
          for (const topic of matchingTopics) {
            await Promise.all([
              incrementTopicGuideCreatedCount(topic.id),
              incrementTopicUsedCount(topic.id),
            ]);
          }
        })
        .catch((err) => {
          console.error(
            "[generateGuide] topic count increment failed:",
            err,
          );
        });
    }

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
        systemPrompt: buildKeywordSystemPrompt(
          input.keyword.guideType,
          input.studentProfile,
          input.selectedSectionKeys,
        ),
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
        systemPrompt: buildCloneSystemPrompt(
          sourceGuide.guide_type as import("../../types").GuideType,
          input.studentProfile,
          input.selectedSectionKeys,
        ),
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
        systemPrompt: buildExtractionSystemPrompt(
          input.pdf.guideType,
          input.studentProfile,
          input.selectedSectionKeys,
        ),
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
        systemPrompt: buildExtractionSystemPrompt(
          input.url.guideType,
          input.studentProfile,
          input.selectedSectionKeys,
        ),
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

// ============================================
// 내부: sections → 레거시 필드 역변환
// ============================================

interface LegacyBackfill {
  motivation: string | undefined;
  theorySections: Array<{
    order: number;
    title: string;
    content: string;
    content_format: "html";
    outline?: import("../../types").OutlineItem[];
  }>;
  reflection: string | undefined;
  impression: string | undefined;
  summary: string | undefined;
  followUp: string | undefined;
  bookDescription: string | undefined;
  setekExamples: string[];
}

function sectionsToLegacy(
  sections: Array<{ key: string; label: string; content: string; items?: string[]; order?: number; outline?: import("../../types").OutlineItem[] }>,
  _guideType: string,
): LegacyBackfill {
  const result: LegacyBackfill = {
    motivation: undefined,
    theorySections: [],
    reflection: undefined,
    impression: undefined,
    summary: undefined,
    followUp: undefined,
    bookDescription: undefined,
    setekExamples: [],
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
      case "setek_examples":
        if (s.items?.length) {
          result.setekExamples = s.items;
        } else if (s.content) {
          result.setekExamples = [s.content];
        }
        break;
    }
  }

  return result;
}
