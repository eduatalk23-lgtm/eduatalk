import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateGuideCore } from "./generateGuideCore";
import {
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
import type { OutlineItem } from "../../types";
import { computeGuideInputHash, findCacheableGuide } from "../cache-helper";

const LOG_CTX = { domain: "guide", action: "generateGuide" };
const AI_PROMPT_VERSION = "c3.3-v1";

/**
 * 가이드 AI 생성 실행 — API route에서 호출
 * 성공 시 placeholder 가이드를 업데이트, 실패 시 ai_failed로 변경
 * 타임아웃 에러는 throw하여 route에서 retry 체이닝 가능
 */
export async function executeGuideGeneration(
  guideId: string,
  input: GuideGenerationInput,
  options?: { modelStartIndex?: number },
): Promise<void> {
  const admin = createSupabaseAdminClient();

  // ── B2 cross-student 본문 캐시: 동일 입력 hash 의 approved 가이드 검색 ──
  const inputHash = computeGuideInputHash(input, AI_PROMPT_VERSION);
  if (admin) {
    try {
      const cacheSource = await findCacheableGuide(admin, inputHash, guideId);
      if (cacheSource) {
        const copied = await copyGuideFromCache(admin, guideId, cacheSource, inputHash);
        if (copied) {
          logActionDebug(LOG_CTX, "B2 cache hit — LLM 호출 생략", {
            guideId,
            sourceGuideId: cacheSource.id,
            inputHash,
          });
          return;
        }
        // 복사 실패 시 graceful fallback (LLM 정상 경로)
      }
    } catch (cacheError) {
      // cache 조회/복사 실패는 non-fatal — 정상 LLM 경로 진행
      logActionError(
        { ...LOG_CTX, action: "executeGuideGeneration.cacheLookup" },
        cacheError,
        { guideId },
      );
    }
  }

  // ── B1 Stream-to-DB: throttled partial writer ──────────────
  // 5분 LLM 호출 중 streamObject partial 객체를 admin client UPDATE 로 누적.
  // 타임아웃 시 catch 블록이 streaming_progress 존재 여부로 ai_partial vs ai_failed 분기.
  const STREAM_THROTTLE_MS = 2000;
  const STREAM_MIN_DELTA_CHARS = 500;
  let lastWriteAt = 0;
  let lastSerializedLen = 0;
  let chunkCountSinceLastWrite = 0;
  let totalChunkCount = 0;
  let lastPartial: unknown = null;

  const flushStreamingProgress = async (
    partial: unknown,
    chunkIndex: number,
    force: boolean,
  ): Promise<void> => {
    if (!admin) return;
    lastPartial = partial;
    totalChunkCount = chunkIndex + 1;
    const serialized = JSON.stringify(partial ?? {});
    const delta = Math.abs(serialized.length - lastSerializedLen);
    const now = Date.now();
    const timeOk = now - lastWriteAt >= STREAM_THROTTLE_MS;
    const sizeOk = delta >= STREAM_MIN_DELTA_CHARS;
    if (!force && (!timeOk || !sizeOk)) {
      chunkCountSinceLastWrite++;
      return;
    }
    lastWriteAt = now;
    lastSerializedLen = serialized.length;
    chunkCountSinceLastWrite = 0;
    try {
      await admin
        .from("exploration_guides")
        .update({
          streaming_progress: partial as object,
          streaming_updated_at: new Date(now).toISOString(),
          streaming_chunk_count: totalChunkCount,
        })
        .eq("id", guideId);
    } catch (writeError) {
      // best-effort: write 실패는 stream 진행을 막지 않음
      logActionError(
        { ...LOG_CTX, action: "executeGuideGeneration.streamWrite" },
        writeError,
        { guideId, chunkIndex },
      );
    }
  };

  try {
    const result = await generateGuideCore(input, "system", undefined, {
      modelStartIndex: options?.modelStartIndex,
      onPartial: (partial, chunkIndex) =>
        flushStreamingProgress(partial, chunkIndex, false),
    });

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

    const { preview: generated, modelId, sourceType } = result;

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
        ai_model_version: modelId,
        ai_prompt_version: AI_PROMPT_VERSION,
        difficulty_level: generated.difficultyLevel ?? null,
        difficulty_auto: true,
        // B2: 정상 LLM 생성 성공 시 hash 영속 — 향후 다른 학생의 동일 입력에서 재사용
        ai_input_hash: inputHash,
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
          bookDescription: legacy.bookDescription ?? generated.bookDescription,
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
        { ...LOG_CTX, action: "executeGuideGeneration.embedding" },
        err,
        { guideId },
      );
    });

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
  } catch (error) {
    // 타임아웃 에러 → throw하여 route에서 retry 체이닝
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("modelIndex=")) {
      // B1: 타임아웃 직전까지의 partial 을 강제 flush 후 throw
      if (lastPartial !== null) {
        await flushStreamingProgress(lastPartial, totalChunkCount, true);
        try {
          await admin
            .from("exploration_guides")
            .update({
              status: "ai_partial",
              ai_model_version: `timeout (chunks=${totalChunkCount}): ${msg.slice(0, 400)}`,
            })
            .eq("id", guideId);
        } catch (partialUpdateError) {
          logActionError(
            { ...LOG_CTX, action: "executeGuideGeneration.partialUpdate" },
            partialUpdateError,
            { guideId },
          );
        }
      }
      throw error;
    }

    logActionError(
      { ...LOG_CTX, action: "executeGuideGeneration" },
      error,
      { guideId },
    );

    // B1: partial 회수 가능하면 ai_partial, 아니면 ai_failed
    const recoveryStatus: "ai_partial" | "ai_failed" =
      lastPartial !== null ? "ai_partial" : "ai_failed";
    if (lastPartial !== null) {
      await flushStreamingProgress(lastPartial, totalChunkCount, true);
    }

    try {
      await admin
        .from("exploration_guides")
        .update({
          status: recoveryStatus,
          ai_model_version: msg.slice(0, 500),
        })
        .eq("id", guideId);
    } catch (updateError) {
      logActionError(
        { ...LOG_CTX, action: "executeGuideGeneration.failUpdate" },
        updateError,
        { guideId },
      );
    }
  }
}

// ============================================
// B2 cache hit: 캐시 소스 가이드의 본문/매핑을 타깃 가이드로 복사
// ============================================
async function copyGuideFromCache(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  targetGuideId: string,
  source: import("../cache-helper").CacheSourceGuide,
  inputHash: string,
): Promise<boolean> {
  // 1) 본문 (exploration_guide_content) 조회
  const { data: srcContent, error: contentErr } = await admin
    .from("exploration_guide_content")
    .select(
      "motivation, theory_sections, reflection, impression, summary, follow_up, book_description, related_papers, related_books, image_paths, guide_url, setek_examples, raw_source, content_sections",
    )
    .eq("guide_id", source.id)
    .maybeSingle();
  if (contentErr || !srcContent) return false;

  // 2) 매핑 3종 조회 (subject / career / classification)
  const [{ data: subjMaps }, { data: careerMaps }, { data: classMaps }] =
    await Promise.all([
      admin
        .from("exploration_guide_subject_mappings")
        .select("subject_id, curriculum_revision_id")
        .eq("guide_id", source.id),
      admin
        .from("exploration_guide_career_mappings")
        .select("career_field_id")
        .eq("guide_id", source.id),
      admin
        .from("exploration_guide_classification_mappings")
        .select("classification_id")
        .eq("guide_id", source.id),
    ]);

  // 3) 타깃 가이드 메타 + ai_input_hash 마킹 (status=pending_approval)
  const { error: metaErr } = await admin
    .from("exploration_guides")
    .update({
      guide_type: source.guide_type,
      title: source.title,
      book_title: source.book_title,
      book_author: source.book_author,
      book_publisher: source.book_publisher,
      status: "pending_approval",
      source_type: source.source_type,
      quality_tier: source.quality_tier ?? "ai_draft",
      ai_model_version: `cache_hit:${source.id}`,
      ai_prompt_version: source.ai_prompt_version ?? AI_PROMPT_VERSION,
      difficulty_level: source.difficulty_level,
      difficulty_auto: false,
      ai_input_hash: inputHash,
      parent_version_id: source.id,
    })
    .eq("id", targetGuideId);
  if (metaErr) {
    logActionError(
      { ...LOG_CTX, action: "executeGuideGeneration.cacheCopy.meta" },
      metaErr,
      { targetGuideId, sourceGuideId: source.id },
    );
    return false;
  }

  // 4) 본문 + 매핑 복사 (병렬)
  await Promise.all([
    upsertGuideContent(
      targetGuideId,
      {
        motivation: srcContent.motivation ?? undefined,
        theorySections:
          (srcContent.theory_sections as LegacyBackfill["theorySections"]) ?? [],
        reflection: srcContent.reflection ?? undefined,
        impression: srcContent.impression ?? undefined,
        summary: srcContent.summary ?? undefined,
        followUp: srcContent.follow_up ?? undefined,
        bookDescription: srcContent.book_description ?? undefined,
        relatedPapers: (srcContent.related_papers as never) ?? [],
        relatedBooks: (srcContent.related_books as never) ?? [],
        imagePaths: (srcContent.image_paths as string[]) ?? [],
        guideUrl: srcContent.guide_url ?? undefined,
        setekExamples: (srcContent.setek_examples as string[]) ?? [],
        rawSource: srcContent.raw_source ?? undefined,
        contentSections:
          (srcContent.content_sections as never) ?? [],
      },
      admin,
    ),
    subjMaps && subjMaps.length > 0
      ? replaceSubjectMappings(
          targetGuideId,
          subjMaps.map((m) => ({
            subjectId: m.subject_id as string,
            curriculumRevisionId:
              (m.curriculum_revision_id as string | null) ?? undefined,
          })),
          admin,
        )
      : Promise.resolve(),
    careerMaps && careerMaps.length > 0
      ? replaceCareerMappings(
          targetGuideId,
          careerMaps.map((m) => m.career_field_id as number),
          admin,
        )
      : Promise.resolve(),
    classMaps && classMaps.length > 0
      ? replaceClassificationMappings(
          targetGuideId,
          classMaps.map((m) => m.classification_id as number),
          admin,
        )
      : Promise.resolve(),
  ]);

  // 5) embedding 재계산은 후속 (best-effort) — 본문이 동일하므로 source 의 embedding 도 복사 가능하지만
  //    UNIQUE(guide_id) 영속은 source 와 별개. 단순화를 위해 비동기 재임베딩.
  embedSingleGuide(targetGuideId).catch((err) => {
    logActionError(
      { ...LOG_CTX, action: "executeGuideGeneration.cacheCopy.embedding" },
      err,
      { targetGuideId, sourceGuideId: source.id },
    );
  });

  return true;
}

// sections → 레거시 필드 역변환
interface LegacyBackfill {
  motivation: string | undefined;
  theorySections: Array<{
    order: number;
    title: string;
    content: string;
    content_format: "html";
    outline?: OutlineItem[];
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
    outline?: OutlineItem[];
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
