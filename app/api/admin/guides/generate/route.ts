import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateGuideCore } from "@/lib/domains/guide/llm/actions/generateGuideCore";
import {
  upsertGuideContent,
  replaceSubjectMappings,
  replaceCareerMappings,
  replaceClassificationMappings,
  findAllSubjects,
  findAllCareerFields,
  findAllClassifications,
} from "@/lib/domains/guide/repository";
import { embedSingleGuide } from "@/lib/domains/guide/vector/embedding-service";
import { splitSetekExamplesBlob } from "@/lib/domains/guide/section-config";
import {
  SubjectMatcher,
  CareerFieldMatcher,
  ClassificationMatcher,
} from "@/lib/domains/guide/import/subject-matcher";
import type { GuideGenerationInput } from "@/lib/domains/guide/llm/types";

export const maxDuration = 300; // 5분 — Vercel Hobby 최대

const LOG_CTX = { domain: "guide", action: "generateGuide" };
const AI_PROMPT_VERSION = "c3.1-v1";

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrConsultant();

    const { guideId, input } = (await request.json()) as {
      guideId: string;
      input: GuideGenerationInput;
    };

    if (!guideId || !input) {
      return NextResponse.json(
        { error: "guideId와 input이 필요합니다." },
        { status: 400 },
      );
    }

    // 동기 실행 — 생성 완료까지 응답을 보내지 않음
    // Vercel은 응답 전이므로 maxDuration(300초)까지 함수를 유지
    // 클라이언트는 fetch를 fire-and-forget으로 호출하므로 응답을 기다리지 않음
    const admin = createSupabaseAdminClient();
    await executeGeneration(guideId, input, admin);

    return NextResponse.json({ completed: true });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return NextResponse.json(
      { error: "가이드 생성 요청에 실패했습니다." },
      { status: 500 },
    );
  }
}

async function executeGeneration(
  guideId: string,
  input: GuideGenerationInput,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<void> {
  try {
    const result = await generateGuideCore(input, "system");

    if (!result.ok) {
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

    const adminClient = admin ?? undefined;
    const [allSubjects, allCareerFields, allClassifications] =
      await Promise.all([
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

    const sourceTypeMap = {
      keyword: "ai_keyword",
      clone_variant: "ai_clone_variant",
      pdf_extract: "ai_pdf_extract",
      url_extract: "ai_url_extract",
    } as const;
    const sourceType = sourceTypeMap[input.source] ?? "ai_keyword";

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

    const legacy = sectionsToLegacy(generated.sections, generated.guideType);

    await Promise.all([
      upsertGuideContent(
        guideId,
        {
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
          contentSections: generated.sections.map((s) => {
            let items = s.items;
            if (s.key === "setek_examples" && !s.items?.length) {
              const split = s.content
                ? splitSetekExamplesBlob(s.content)
                : null;
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
        },
        adminClient,
      ),
      replaceSubjectMappings(
        guideId,
        matchedSubjectIds.map((id) => ({ subjectId: id })),
        adminClient,
      ),
      replaceCareerMappings(
        guideId,
        [...new Set(matchedCareerFieldIds)],
        adminClient,
      ),
      matchedClassificationIds.length > 0
        ? replaceClassificationMappings(
            guideId,
            matchedClassificationIds,
            adminClient,
          )
        : Promise.resolve(),
    ]);

    embedSingleGuide(guideId).catch((err) => {
      logActionError(
        { ...LOG_CTX, action: "apiGenerateGuide.embedding" },
        err,
        { guideId },
      );
    });

    if (input.source === "keyword" && input.keyword?.keyword) {
      import("@/lib/domains/guide/repository")
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
  } catch (error) {
    logActionError(
      { ...LOG_CTX, action: "apiGenerateGuide" },
      error,
      { guideId },
    );

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
      logActionError(
        { ...LOG_CTX, action: "apiGenerateGuide.failUpdate" },
        updateError,
        { guideId },
      );
    }
  }
}

// sections → 레거시 필드 역변환
interface LegacyBackfill {
  motivation: string | undefined;
  theorySections: Array<{
    order: number;
    title: string;
    content: string;
    content_format: "html";
    outline?: import("@/lib/domains/guide/types").OutlineItem[];
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
    outline?: import("@/lib/domains/guide/types").OutlineItem[];
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
