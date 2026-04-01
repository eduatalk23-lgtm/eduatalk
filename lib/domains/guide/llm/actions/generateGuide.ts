"use server";

// ============================================
// C3 + C3.1 — AI 가이드 생성 Server Action
// 소스: keyword, clone_variant, pdf_extract, url_extract
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { splitSetekExamplesBlob } from "../../section-config";
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
import { enrichGuideResources } from "../services/enrich-sources";

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

    // AI 생성 — advanced(2.5-pro) 우선, 과부하 시 fast(2.5-flash) fallback
    let generated: import("../types").GeneratedGuideOutput;
    let modelId: string;
    try {
      const result = await generateObjectWithRateLimit({
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        schema: zodSchema(generatedGuideSchema),
        modelTier: "advanced",
        temperature: 0.5,
        maxTokens: 65536,
      });
      generated = result.object;
      modelId = result.modelId;
    } catch (primaryError) {
      // 과부하/rate limit → fast로 fallback
      const msg = primaryError instanceof Error ? primaryError.message : "";
      if (msg.includes("high demand") || msg.includes("429") || msg.includes("overloaded")) {
        const { logActionWarn } = await import("@/lib/logging/actionLogger");
        logActionWarn(LOG_CTX, "2.5-pro 과부하 → 2.5-flash fallback", { source: input.source });
        const result = await generateObjectWithRateLimit({
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          schema: zodSchema(generatedGuideSchema),
          modelTier: "fast",
          temperature: 0.5,
          maxTokens: 40960,
        });
        generated = result.object;
        modelId = result.modelId + " (fallback)";
      } else {
        throw primaryError;
      }
    }

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

    // 독서탐구 도서 실존 검증
    if (generated.guideType === "reading") {
      // confidence 누락 시 기본값 "medium" 적용
      if (!generated.bookConfidence && generated.bookTitle) {
        generated.bookConfidence = "medium";
        if (!generated.bookVerificationNote) {
          generated.bookVerificationNote = "AI 생성 시 confidence 미지정 — 컨설턴트 검수 필요";
        }
      }

      const { logActionWarn: logBookWarn } = await import("@/lib/logging/actionLogger");

      if (generated.bookConfidence === "low") {
        logBookWarn(LOG_CTX, `도서 신뢰도 low — 할루시네이션 위험: "${generated.bookTitle}" (${generated.bookAuthor})`, {
          bookTitle: generated.bookTitle,
          bookAuthor: generated.bookAuthor,
          bookConfidence: generated.bookConfidence,
          bookVerificationNote: generated.bookVerificationNote,
        });
      } else if (generated.bookConfidence === "medium") {
        logBookWarn(LOG_CTX, `도서 신뢰도 medium — 검수 필요: "${generated.bookTitle}" (${generated.bookAuthor})`, {
          bookTitle: generated.bookTitle,
          bookConfidence: generated.bookConfidence,
          bookVerificationNote: generated.bookVerificationNote,
        });
      }

      if (!generated.bookTitle?.trim()) {
        logBookWarn(LOG_CTX, "독서탐구인데 bookTitle이 비어 있음", { source: input.source });
      }
    }

    // outline 밀도 검증 (경고 로그)
    const contentOutlines = generated.sections
      .filter((s) => s.key === "content_sections" && s.outline?.length)
      .flatMap((s) => s.outline ?? []);
    const outlineStats = {
      total: contentOutlines.length,
      depth0: contentOutlines.filter((o) => o.depth === 0).length,
      tips: contentOutlines.filter((o) => o.tip).length,
      resources: contentOutlines.filter((o) => o.resources?.length).length,
    };
    if (outlineStats.total < 40 || outlineStats.depth0 < 5 || outlineStats.tips < 6 || outlineStats.resources < 5) {
      const { logActionWarn } = await import("@/lib/logging/actionLogger");
      logActionWarn(LOG_CTX, `Outline 밀도 미달: total=${outlineStats.total}/40, depth0=${outlineStats.depth0}/5, tips=${outlineStats.tips}/6, resources=${outlineStats.resources}/5`, {
        source: input.source,
        outlineStats,
      });
    }

    // 논문 실존 검증 — confidence 기본값 적용 + low 자동 제거
    if (generated.relatedPapers?.length) {
      // confidence 누락 시 기본값 "medium" 적용 (Gemini가 optional enum을 생략하는 경우 대비)
      for (const paper of generated.relatedPapers) {
        if (!paper.confidence) {
          paper.confidence = "medium";
          if (!paper.verificationNote) {
            paper.verificationNote = "AI 생성 시 confidence 미지정 — 컨설턴트 검수 필요";
          }
        }
      }

      const lowPapers = generated.relatedPapers.filter((p) => p.confidence === "low");
      if (lowPapers.length > 0) {
        const { logActionWarn: logPaperWarn } = await import("@/lib/logging/actionLogger");
        logPaperWarn(LOG_CTX, `논문 ${lowPapers.length}건 low confidence 제거: ${lowPapers.map((p) => p.title).join(", ")}`, {
          removed: lowPapers.map((p) => ({ title: p.title, verificationNote: p.verificationNote })),
        });
        generated.relatedPapers = generated.relatedPapers.filter((p) => p.confidence !== "low");
      }

      const mediumPapers = generated.relatedPapers.filter((p) => p.confidence === "medium");
      if (mediumPapers.length > 0) {
        const { logActionWarn: logPaperMedWarn } = await import("@/lib/logging/actionLogger");
        logPaperMedWarn(LOG_CTX, `논문 ${mediumPapers.length}건 medium confidence — 검수 필요: ${mediumPapers.map((p) => p.title).join(", ")}`, {
          papers: mediumPapers.map((p) => ({ title: p.title, verificationNote: p.verificationNote })),
        });
      }
    }

    // === 출처 수집 (Claude Web Search, non-fatal) ===
    try {
      const enrichResult = await enrichGuideResources(
        generated.sections.map((s) => ({
          key: s.key,
          label: s.label,
          content: s.content,
          content_format: "html" as const,
          items: s.items,
          order: s.order,
          outline: s.outline,
        })),
        generated.relatedPapers ?? [],
        generated.title,
        { maxResources: 8, validateUrls: true },
      );

      // enriched 데이터 병합
      for (let i = 0; i < generated.sections.length; i++) {
        const enrichedOutline = enrichResult.enrichedSections[i]?.outline;
        if (enrichedOutline) {
          generated.sections[i].outline = enrichedOutline;
        }
      }
      if (enrichResult.enrichedPapers.length > 0) {
        generated.relatedPapers = enrichResult.enrichedPapers;
      }

      const { logActionDebug: logDebug } = await import("@/lib/logging/actionLogger");
      logDebug(LOG_CTX, `Source enrichment: ${enrichResult.stats.urlsValidated}/${enrichResult.stats.totalResources} URLs`, enrichResult.stats);
    } catch (enrichError) {
      const { logActionWarn: logWarn } = await import("@/lib/logging/actionLogger");
      logWarn(LOG_CTX, "Source enrichment failed (non-fatal)", {
        error: enrichError instanceof Error ? enrichError.message : String(enrichError),
      });
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
      difficultyLevel: generated.difficultyLevel ?? undefined,
      difficultyAuto: true,
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
        contentSections: generated.sections.map((s) => {
          let items = s.items;
          if (s.key === "setek_examples" && !s.items?.length) {
            const split = s.content ? splitSetekExamplesBlob(s.content) : null;
            items = split ?? generated.setekExamples ?? (s.content ? [s.content] : undefined);
          }
          return {
            key: s.key,
            label: s.label,
            content: s.content,
            content_format: "html" as const,
            items,
            order: s.order,
            outline: s.outline,
          };
        }),
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
          input.difficultyLevel,
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
          input.difficultyLevel,
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
          input.difficultyLevel,
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
          input.difficultyLevel,
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
