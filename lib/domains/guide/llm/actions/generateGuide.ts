"use server";

// ============================================
// C3 — AI 가이드 생성 Server Action (fire-and-forget)
//
// 패턴: pipeline.ts와 동일
//   1. 입력 검증 + 인증
//   2. 가이드를 status="ai_generating", title="생성 중..."으로 즉시 생성
//   3. guideId를 즉시 반환
//   4. executeGuideGeneration()을 fire-and-forget (.catch())
//   5. 내부에서 createSupabaseAdminClient() 사용 (request context 만료 방지)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateGuideCore } from "./generateGuideCore";
import {
  createGuide,
  upsertGuideContent,
  replaceSubjectMappings,
  replaceCareerMappings,
  replaceClassificationMappings,
  findAllSubjects,
  findAllCareerFields,
  findAllClassifications,
} from "../../repository";
import { embedSingleGuide } from "../../vector/embedding-service";
import { splitSetekExamplesBlob } from "../../section-config";
import {
  SubjectMatcher,
  CareerFieldMatcher,
  ClassificationMatcher,
} from "../../import/subject-matcher";
import type { GuideGenerationInput } from "../types";

const LOG_CTX = { domain: "guide", action: "generateGuide" };

// ============================================
// 퍼블릭 Server Action — 즉시 반환
// ============================================

export async function generateGuideAction(
  input: GuideGenerationInput,
): Promise<ActionResponse<{ guideId: string }>> {
  try {
    const { userId } = await requireAdminOrConsultant();

    // 입력 검증
    if (!input.source) {
      return createErrorResponse("생성 소스(source)가 누락되었습니다.");
    }

    // 가이드를 "ai_generating" 상태로 즉시 생성 (placeholder)
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

    // fire-and-forget — request context 만료 후에도 계속 실행
    executeGuideGeneration(guide.id, input, userId).catch((err) => {
      logActionError({ ...LOG_CTX, action: "executeGuideGeneration" }, err, {
        guideId: guide.id,
      });
    });

    return createSuccessResponse({ guideId: guide.id });
  } catch (error) {
    logActionError(LOG_CTX, error, { source: input.source });
    return createErrorResponse("가이드 생성 요청에 실패했습니다.");
  }
}

// ============================================
// 내부: 백그라운드 실행 함수
// createSupabaseAdminClient() 사용 (request context 만료 방지)
// ============================================

const AI_PROMPT_VERSION = "c3.1-v1";

async function executeGuideGeneration(
  guideId: string,
  input: GuideGenerationInput,
  userId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();

  try {
    // 핵심 생성 로직 실행
    const result = await generateGuideCore(input, userId);

    if (!result.ok) {
      // 생성 실패 → ai_failed 상태로 업데이트
      await admin
        .from("exploration_guides")
        .update({
          status: "ai_failed",
          ai_model_version: result.error,
        })
        .eq("id", guideId);
      return;
    }

    const { preview: generated } = result;

    // 과목/계열/소분류 이름 → ID 매핑
    const adminClient = admin ?? undefined;
    const [allSubjects, allCareerFields, allClassifications] = await Promise.all([
      findAllSubjects(adminClient),
      findAllCareerFields(adminClient),
      findAllClassifications(adminClient),
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

    // sourceType 결정
    const sourceTypeMap = {
      keyword: "ai_keyword",
      clone_variant: "ai_clone_variant",
      pdf_extract: "ai_pdf_extract",
      url_extract: "ai_url_extract",
    } as const;
    const sourceType = sourceTypeMap[input.source] ?? "ai_keyword";

    // 가이드 메타 업데이트 (title, status, 생성 결과 반영)
    await admin
      .from("exploration_guides")
      .update({
        guide_type: generated.guideType,
        title: generated.title,
        book_title: generated.bookTitle ?? null,
        book_author: generated.bookAuthor ?? null,
        book_publisher: generated.bookPublisher ?? null,
        status: "draft",
        source_type: sourceType,
        quality_tier: "ai_draft",
        ai_prompt_version: AI_PROMPT_VERSION,
        difficulty_level: generated.difficultyLevel ?? null,
        difficulty_auto: true,
      })
      .eq("id", guideId);

    // sections → 레거시 필드 역변환 (하위 호환)
    const legacy = sectionsToLegacy(generated.sections, generated.guideType);

    // 콘텐츠 저장
    await Promise.all([
      upsertGuideContent(guideId, {
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
        bookDescription: legacy.bookDescription ?? generated.bookDescription,
        relatedPapers: generated.relatedPapers,
        setekExamples:
          legacy.setekExamples.length > 0
            ? legacy.setekExamples
            : generated.setekExamples,
        contentSections: generated.sections.map((s) => {
          let items = s.items;
          if (s.key === "setek_examples" && !s.items?.length) {
            const split = s.content ? splitSetekExamplesBlob(s.content) : null;
            items =
              split ??
              generated.setekExamples ??
              (s.content ? [s.content] : undefined);
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
      }, adminClient),
      replaceSubjectMappings(
        guideId,
        matchedSubjectIds.map((id) => ({ subjectId: id })),
        adminClient,
      ),
      replaceCareerMappings(guideId, [...new Set(matchedCareerFieldIds)], adminClient),
      matchedClassificationIds.length > 0
        ? replaceClassificationMappings(guideId, matchedClassificationIds, adminClient)
        : Promise.resolve(),
    ]);

    // 임베딩 (비동기, 실패 무시)
    embedSingleGuide(guideId).catch((err) => {
      logActionError({ ...LOG_CTX, action: "executeGuideGeneration.embedding" }, err, {
        guideId,
      });
    });

    // guide_created_count + used_count 증가 (키워드 소스)
    if (input.source === "keyword" && input.keyword?.keyword) {
      import("../../repository")
        .then(
          async ({
            findTopicsByTitle,
            incrementTopicGuideCreatedCount,
            incrementTopicUsedCount,
          }) => {
            const matchingTopics = await findTopicsByTitle(input.keyword!.keyword);
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
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "executeGuideGeneration" }, error, { guideId });

    // 오류 발생 시 ai_failed 상태로 업데이트
    const msg = error instanceof Error ? error.message : String(error);
    try {
      await admin
        .from("exploration_guides")
        .update({
          status: "ai_failed",
          ai_model_version: msg.slice(0, 500),
        })
        .eq("id", guideId);
    } catch (updateError) {
      logActionError({ ...LOG_CTX, action: "executeGuideGeneration.failUpdate" }, updateError, { guideId });
    }
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
          result.setekExamples = s.items;
        } else if (s.content) {
          result.setekExamples = [s.content];
        }
        break;
    }
  }

  return result;
}
