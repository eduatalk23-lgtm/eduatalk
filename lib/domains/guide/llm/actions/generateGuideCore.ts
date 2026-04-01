// ============================================
// C3 + C3.1 — AI 가이드 생성 핵심 로직 (공유)
// Server Action + API Route 양쪽에서 사용
// ============================================

import { logActionError } from "@/lib/logging/actionLogger";
import { splitSetekExamplesBlob } from "../../section-config";

/**
 * setekExamples가 1개짜리 blob(여러 예시가 합쳐진 긴 문자열)이면 분리 시도.
 * 정상 배열이면 그대로 반환.
 */
function normalizeSetekExamples(items: string[] | undefined): string[] | undefined {
  if (!items || items.length === 0) return items;
  // 2개 이상이면 정상
  if (items.length >= 2) return items;
  // 1개인데 짧으면 (500자 미만) 단일 예시로 판단
  if (items[0].length < 500) return items;
  // 1개인데 길면 → blob일 가능성 높음, 분리 시도
  return splitSetekExamplesBlob(items[0]) ?? items;
}
import { generateObjectWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { geminiQuotaTracker } from "@/lib/domains/plan/llm/providers/gemini";
import { zodSchema } from "ai";
import {
  createGuide,
  upsertGuideContent,
  replaceSubjectMappings,
  replaceCareerMappings,
  replaceClassificationMappings,
  findGuideByIdPublic,
  findAllSubjects,
  findAllCareerFields,
  findAllClassifications,
} from "../../repository";
import { embedSingleGuide } from "../../vector/embedding-service";
import {
  SubjectMatcher,
  CareerFieldMatcher,
  ClassificationMatcher,
} from "../../import/subject-matcher";
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

/** 진행 단계 콜백 타입 */
export type GenerateProgressCallback = (
  step: "preparing" | "generating" | "enriching" | "saving",
  detail?: string,
) => void;

/** generateGuideCore 성공 결과 */
export interface GenerateGuideCoreSuccess {
  guideId: string;
  preview: GeneratedGuideOutput;
}

/** generateGuideCore 실패 결과 */
export interface GenerateGuideCoreError {
  error: string;
}

export type GenerateGuideCoreResult =
  | ({ ok: true } & GenerateGuideCoreSuccess)
  | ({ ok: false } & GenerateGuideCoreError);

// ============================================
// 핵심 로직: generateGuideCore
// ============================================

export async function generateGuideCore(
  input: GuideGenerationInput,
  userId: string,
  onProgress?: GenerateProgressCallback,
): Promise<GenerateGuideCoreResult> {
  try {
    // 할당량 확인
    const quota = geminiQuotaTracker.getQuotaStatus();
    if (quota.isExceeded) {
      return {
        ok: false,
        error: "오늘의 AI 사용 할당량이 초과되었습니다. 내일 다시 시도해주세요.",
      };
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

    // 난이도 자동 차등: difficultyLevel 미지정 시 학생 내신 기반 추론값 사용
    if (!input.difficultyLevel && input.studentProfile?.suggestedDifficulty) {
      input.difficultyLevel = input.studentProfile.suggestedDifficulty;
    }

    // 입력 검증 + 프롬프트 빌드
    onProgress?.("preparing", "프롬프트 생성 중");
    const promptResult = await buildPrompt(input);
    if (!promptResult.ok) {
      return { ok: false, error: promptResult.error };
    }

    const { systemPrompt, userPrompt, sourceType, parentGuideId } = promptResult;

    // AI 생성 — advanced(2.5-pro) 우선, 과부하 시 fast(2.5-flash) fallback
    onProgress?.("generating", "AI 가이드 생성 중 (30~90초 소요)");

    let generated: GeneratedGuideOutput;
    let modelId: string;
    try {
      const result = await generateObjectWithRateLimit({
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        schema: zodSchema(generatedGuideSchema),
        modelTier: "advanced",
        temperature: 0.5,
        maxTokens: 65536,
        timeoutMs: 180_000, // API Route는 5분이므로 여유롭게 설정
      });
      generated = result.object;
      modelId = result.modelId;
    } catch (primaryError) {
      const msg = primaryError instanceof Error ? primaryError.message : "";
      if (
        msg.includes("high demand") ||
        msg.includes("429") ||
        msg.includes("overloaded")
      ) {
        const { logActionWarn } = await import("@/lib/logging/actionLogger");
        logActionWarn(LOG_CTX, "2.5-pro 과부하 → 2.5-flash fallback", {
          source: input.source,
        });
        const result = await generateObjectWithRateLimit({
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          schema: zodSchema(generatedGuideSchema),
          modelTier: "fast",
          temperature: 0.5,
          maxTokens: 40960,
          timeoutMs: 120_000,
        });
        generated = result.object;
        modelId = result.modelId + " (fallback)";
      } else {
        throw primaryError;
      }
    }

    // selectedSectionKeys가 있으면 AI 출력을 필터링
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

    if (generated.sections.length === 0) {
      return {
        ok: false,
        error: "AI가 유효한 섹션을 생성하지 못했습니다. 다시 시도해주세요.",
      };
    }

    // 독서탐구 도서 실존 검증
    if (generated.guideType === "reading") {
      if (!generated.bookConfidence && generated.bookTitle) {
        generated.bookConfidence = "medium";
        if (!generated.bookVerificationNote) {
          generated.bookVerificationNote =
            "AI 생성 시 confidence 미지정 — 컨설턴트 검수 필요";
        }
      }

      const { logActionWarn: logBookWarn } = await import(
        "@/lib/logging/actionLogger"
      );

      if (generated.bookConfidence === "low") {
        logBookWarn(
          LOG_CTX,
          `도서 신뢰도 low — 할루시네이션 위험: "${generated.bookTitle}" (${generated.bookAuthor})`,
          {
            bookTitle: generated.bookTitle,
            bookAuthor: generated.bookAuthor,
            bookConfidence: generated.bookConfidence,
            bookVerificationNote: generated.bookVerificationNote,
          },
        );
      } else if (generated.bookConfidence === "medium") {
        logBookWarn(
          LOG_CTX,
          `도서 신뢰도 medium — 검수 필요: "${generated.bookTitle}" (${generated.bookAuthor})`,
          {
            bookTitle: generated.bookTitle,
            bookConfidence: generated.bookConfidence,
            bookVerificationNote: generated.bookVerificationNote,
          },
        );
      }

      if (!generated.bookTitle?.trim()) {
        logBookWarn(LOG_CTX, "독서탐구인데 bookTitle이 비어 있음", {
          source: input.source,
        });
      }
    }

    // outline 밀도 검증
    const contentOutlines = generated.sections
      .filter((s) => s.key === "content_sections" && s.outline?.length)
      .flatMap((s) => s.outline ?? []);
    const outlineStats = {
      total: contentOutlines.length,
      depth0: contentOutlines.filter((o) => o.depth === 0).length,
      tips: contentOutlines.filter((o) => o.tip).length,
      resources: contentOutlines.filter((o) => o.resources?.length).length,
    };
    if (
      outlineStats.total < 40 ||
      outlineStats.depth0 < 5 ||
      outlineStats.tips < 6 ||
      outlineStats.resources < 5
    ) {
      const { logActionWarn } = await import("@/lib/logging/actionLogger");
      logActionWarn(
        LOG_CTX,
        `Outline 밀도 미달: total=${outlineStats.total}/40, depth0=${outlineStats.depth0}/5, tips=${outlineStats.tips}/6, resources=${outlineStats.resources}/5`,
        { source: input.source, outlineStats },
      );
    }

    // 논문 실존 검증
    if (generated.relatedPapers?.length) {
      for (const paper of generated.relatedPapers) {
        if (!paper.confidence) {
          paper.confidence = "medium";
          if (!paper.verificationNote) {
            paper.verificationNote =
              "AI 생성 시 confidence 미지정 — 컨설턴트 검수 필요";
          }
        }
      }

      const lowPapers = generated.relatedPapers.filter(
        (p) => p.confidence === "low",
      );
      if (lowPapers.length > 0) {
        const { logActionWarn: logPaperWarn } = await import(
          "@/lib/logging/actionLogger"
        );
        logPaperWarn(
          LOG_CTX,
          `논문 ${lowPapers.length}건 low confidence 제거: ${lowPapers.map((p) => p.title).join(", ")}`,
          {
            removed: lowPapers.map((p) => ({
              title: p.title,
              verificationNote: p.verificationNote,
            })),
          },
        );
        generated.relatedPapers = generated.relatedPapers.filter(
          (p) => p.confidence !== "low",
        );
      }

      const mediumPapers = generated.relatedPapers.filter(
        (p) => p.confidence === "medium",
      );
      if (mediumPapers.length > 0) {
        const { logActionWarn: logPaperMedWarn } = await import(
          "@/lib/logging/actionLogger"
        );
        logPaperMedWarn(
          LOG_CTX,
          `논문 ${mediumPapers.length}건 medium confidence — 검수 필요: ${mediumPapers.map((p) => p.title).join(", ")}`,
          {
            papers: mediumPapers.map((p) => ({
              title: p.title,
              verificationNote: p.verificationNote,
            })),
          },
        );
      }
    }

    // 출처 수집 (non-fatal)
    onProgress?.("enriching", "출처 검증 및 수집 중");
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

      for (let i = 0; i < generated.sections.length; i++) {
        const enrichedOutline = enrichResult.enrichedSections[i]?.outline;
        if (enrichedOutline) {
          generated.sections[i].outline = enrichedOutline;
        }
      }
      if (enrichResult.enrichedPapers.length > 0) {
        generated.relatedPapers = enrichResult.enrichedPapers;
      }

      const { logActionDebug: logDebug } = await import(
        "@/lib/logging/actionLogger"
      );
      logDebug(
        LOG_CTX,
        `Source enrichment: ${enrichResult.stats.urlsValidated}/${enrichResult.stats.totalResources} URLs`,
        enrichResult.stats,
      );
    } catch (enrichError) {
      const { logActionWarn: logWarn } = await import(
        "@/lib/logging/actionLogger"
      );
      logWarn(LOG_CTX, "Source enrichment failed (non-fatal)", {
        error:
          enrichError instanceof Error
            ? enrichError.message
            : String(enrichError),
      });
    }

    // 과목/계열/소분류 이름 → ID 매핑
    onProgress?.("saving", "DB에 저장 중");
    const [allSubjects, allCareerFields, allClassifications] =
      await Promise.all([
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
        setekExamples: normalizeSetekExamples(
          legacy.setekExamples.length > 0
            ? legacy.setekExamples
            : generated.setekExamples,
        ),
        contentSections: generated.sections.map((s) => {
          let items = s.items;
          if (s.key === "setek_examples") {
            // items가 있어도 1개짜리 blob일 수 있으므로 정규화
            items = normalizeSetekExamples(
              s.items?.length
                ? s.items
                : s.content
                  ? splitSetekExamplesBlob(s.content) ?? generated.setekExamples ?? [s.content]
                  : generated.setekExamples,
            );
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
        .then(
          async ({
            findTopicsByTitle,
            incrementTopicGuideCreatedCount,
            incrementTopicUsedCount,
          }) => {
            const matchingTopics = await findTopicsByTitle(
              input.keyword!.keyword,
            );
            for (const topic of matchingTopics) {
              await Promise.all([
                incrementTopicGuideCreatedCount(topic.id),
                incrementTopicUsedCount(topic.id),
              ]);
            }
          },
        )
        .catch((err) => {
          console.error("[generateGuide] topic count increment failed:", err);
        });
    }

    return { ok: true, guideId: guide.id, preview: generated };
  } catch (error) {
    logActionError(LOG_CTX, error, { source: input.source });

    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return {
        ok: false,
        error: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
      };
    }
    if (msg.includes("PDF") || msg.includes("페이지")) {
      return { ok: false, error: msg };
    }

    return { ok: false, error: `AI 가이드 생성 실패: ${msg.slice(0, 500)}` };
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
      const sourceGuide = await findGuideByIdPublic(input.clone.sourceGuideId);
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
  sections: Array<{
    key: string;
    label: string;
    content: string;
    items?: string[];
    order?: number;
    outline?: import("../../types").OutlineItem[];
  }>,
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
          result.setekExamples = normalizeSetekExamples(s.items) ?? s.items;
        } else if (s.content) {
          result.setekExamples = normalizeSetekExamples([s.content]) ?? [s.content];
        }
        break;
    }
  }

  return result;
}
