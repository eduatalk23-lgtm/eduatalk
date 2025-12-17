import type { RecommendedContent } from "@/lib/types/content-selection";

export interface ContentToAutoAdd {
  content_type: "book" | "lecture";
  content_id: string;
  start_range: number;
  end_range: number;
  title?: string;
  subject_category?: string;
  is_auto_recommended?: boolean;
}

/**
 * 콘텐츠의 범위 정보 조회 (상세 정보 + 총량)
 */
export async function fetchContentRange(
  contentType: "book" | "lecture",
  contentId: string
): Promise<{ startRange: number; endRange: number }> {
  let startRange = 1;
  let endRange = 100;

  try {
    // 1. 상세 정보 조회
    const detailsResponse = await fetch(
      `/api/master-content-details?contentType=${contentType}&contentId=${contentId}`
    );

    if (detailsResponse.ok) {
      const detailsResult = await detailsResponse.json();

      if (detailsResult.success && detailsResult.data) {
        if (contentType === "book") {
          const details = detailsResult.data.details || [];
          if (details.length > 0) {
            startRange = details[0].page_number || 1;
            endRange = details[details.length - 1].page_number || 100;
            return { startRange, endRange };
          }
        } else if (contentType === "lecture") {
          const episodes = detailsResult.data.episodes || [];
          if (episodes.length > 0) {
            startRange = episodes[0].episode_number || 1;
            endRange = episodes[episodes.length - 1].episode_number || 100;
            return { startRange, endRange };
          }
        }
      }
    }

    // 2. 상세 정보가 없으면 총량 조회
    const infoResponse = await fetch(
      `/api/master-content-info?content_type=${contentType}&content_id=${contentId}`
    );

    if (infoResponse.ok) {
      const infoResult = await infoResponse.json();
      if (infoResult.success && infoResult.data) {
        if (contentType === "book" && infoResult.data.total_pages) {
          endRange = infoResult.data.total_pages;
        } else if (contentType === "lecture" && infoResult.data.total_episodes) {
          endRange = infoResult.data.total_episodes;
        }
      }
    }
  } catch (error) {
    console.warn(
      `[fetchContentRange] 콘텐츠 ${contentId} 범위 조회 실패:`,
      error
    );
    // 조회 실패 시 기본값 사용
  }

  return { startRange, endRange };
}

/**
 * 추천 콘텐츠를 자동 배정용 데이터로 변환
 */
export async function prepareAutoAssignment(
  recommendations: RecommendedContent[]
): Promise<ContentToAutoAdd[]> {
  const contentsToAutoAdd: ContentToAutoAdd[] = [];

  for (const r of recommendations) {
    try {
      const { startRange, endRange } = await fetchContentRange(
        r.contentType,
        r.id
      );

      contentsToAutoAdd.push({
        content_type: r.contentType,
        content_id: r.id,
        start_range: startRange,
        end_range: endRange,
        title: r.title,
        subject_category: r.subject_category || undefined,
        is_auto_recommended: true,
      });
    } catch (error) {
      console.warn(
        `[prepareAutoAssignment] 콘텐츠 ${r.id} 준비 실패:`,
        error
      );
      // 조회 실패 시 기본값 사용
      contentsToAutoAdd.push({
        content_type: r.contentType,
        content_id: r.id,
        start_range: 1,
        end_range: 100,
        title: r.title,
        subject_category: r.subject_category || undefined,
        is_auto_recommended: true,
      });
    }
  }

  return contentsToAutoAdd;
}

/**
 * 자동 배정 실행 결과
 */
export interface AutoAssignResult {
  added: ContentToAutoAdd[];
  excluded: number;
  message: string;
}

/**
 * 최대 개수 제한을 고려한 자동 배정 처리
 */
export function applyAutoAssignmentLimit(
  contentsToAutoAdd: ContentToAutoAdd[],
  currentTotal: number,
  maxContents: number = 9
): AutoAssignResult {
  const toAdd = contentsToAutoAdd.length;

  if (currentTotal + toAdd > maxContents) {
    const maxToAdd = maxContents - currentTotal;
    const trimmed = contentsToAutoAdd.slice(0, maxToAdd);

    return {
      added: trimmed,
      excluded: toAdd - trimmed.length,
      message:
        trimmed.length > 0
          ? `추천 콘텐츠 ${trimmed.length}개가 자동으로 추가되었습니다. (최대 ${maxContents}개 제한으로 ${toAdd - trimmed.length}개 제외됨)`
          : `추가할 수 있는 콘텐츠가 없습니다. (최대 ${maxContents}개 제한)`,
    };
  }

  return {
    added: contentsToAutoAdd,
    excluded: 0,
    message: `추천 콘텐츠 ${contentsToAutoAdd.length}개가 자동으로 추가되었습니다.`,
  };
}
