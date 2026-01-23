/**
 * Stage 2: 콘텐츠 해결
 *
 * AI 콜드 스타트 파이프라인을 통해 콘텐츠를 추천받습니다.
 */

import { runColdStartPipeline } from "../../coldStart/pipeline";
import type { RecommendationItem } from "../../coldStart/types";
import type {
  ValidatedPlanInput,
  ContentResolutionResult,
  ResolvedContentItem,
  StageResult,
} from "../types";
import { generateContentId } from "../utils/contentMapper";

/**
 * AI 추천 결과를 ResolvedContentItem으로 변환합니다.
 */
function mapRecommendationToResolvedContent(
  rec: RecommendationItem,
  subjectCategory: string,
  subject?: string
): ResolvedContentItem {
  // 강의의 경우 평균 에피소드 시간 계산
  // 1. averageEpisodeDuration이 있으면 사용 (양수인 경우만)
  // 2. 없으면 estimatedHours / totalRange로 계산
  // 3. 최소 1분 보장 (0분 에피소드 방지)
  let averageEpisodeDurationMinutes: number | undefined;
  if (rec.contentType === "lecture") {
    if (rec.averageEpisodeDuration && rec.averageEpisodeDuration > 0) {
      averageEpisodeDurationMinutes = rec.averageEpisodeDuration;
    } else if (rec.estimatedHours && rec.estimatedHours > 0 && rec.totalRange > 0) {
      const calculated = Math.round((rec.estimatedHours * 60) / rec.totalRange);
      averageEpisodeDurationMinutes = Math.max(1, calculated);
    }
  }

  return {
    id: generateContentId(rec.title, rec.contentType),
    title: rec.title,
    contentType: rec.contentType,
    totalRange: rec.totalRange,
    startRange: 1,
    endRange: rec.totalRange,
    author: rec.author,
    publisher: rec.publisher,
    subject: subject ?? subjectCategory,
    subjectCategory: subjectCategory,
    chapters: rec.chapters.map((ch) => ({
      title: ch.title,
      startRange: ch.startRange,
      endRange: ch.endRange,
    })),
    source: "ai_recommendation",
    matchScore: rec.matchScore,
    reason: rec.reason,
    averageEpisodeDurationMinutes,
  };
}

/**
 * Stage 2: 콘텐츠 해결
 *
 * AI 콜드 스타트 파이프라인을 호출하여 콘텐츠를 추천받습니다.
 *
 * @param input - 검증된 입력 데이터
 * @returns 해결된 콘텐츠 목록 또는 에러
 */
export async function resolveContent(
  input: ValidatedPlanInput
): Promise<StageResult<ContentResolutionResult>> {
  const { contentSelection, tenantId, generationOptions } = input;

  // Cold Start 파이프라인 호출
  const pipelineResult = await runColdStartPipeline(
    {
      subjectCategory: contentSelection.subjectCategory,
      subject: contentSelection.subject,
      difficulty: contentSelection.difficulty,
      contentType: contentSelection.contentType,
    },
    {
      preferences: {
        contentType: contentSelection.contentType ?? null,
        maxResults: contentSelection.maxResults ?? 5,
      },
      useMock: false,
      saveToDb: generationOptions.saveToDb && !generationOptions.dryRun,
      tenantId: tenantId,
      enableFallback: true,
    }
  );

  if (!pipelineResult.success) {
    return {
      success: false,
      error: `콘텐츠 추천 실패 (${pipelineResult.failedAt}): ${pipelineResult.error}`,
      details: { failedAt: pipelineResult.failedAt },
    };
  }

  // 추천 결과가 없는 경우
  if (pipelineResult.recommendations.length === 0) {
    return {
      success: false,
      error:
        "추천된 콘텐츠가 없습니다. 검색 조건을 변경해주세요.",
      details: {
        searchQuery: pipelineResult.stats.searchQuery,
        totalFound: pipelineResult.stats.totalFound,
      },
    };
  }

  // RecommendationItem을 ResolvedContentItem으로 변환
  const resolvedItems: ResolvedContentItem[] =
    pipelineResult.recommendations.map((rec) =>
      mapRecommendationToResolvedContent(
        rec,
        contentSelection.subjectCategory,
        contentSelection.subject
      )
    );

  const result: ContentResolutionResult = {
    items: resolvedItems,
    strategy: pipelineResult.stats.usedFallback
      ? "db_fallback"
      : "ai_recommendation",
    newlySaved: pipelineResult.persistence?.newlySaved ?? 0,
    aiRecommendations: pipelineResult.recommendations,
  };

  return { success: true, data: result };
}
