/**
 * 통합 함수 (하위 호환성)
 */

import type {
  MasterBook,
  MasterLecture,
  MasterCustomContent,
  BookDetail,
} from "@/lib/types/plan";
import type { ContentSortOption } from "@/lib/types/contentFilters";
import type { ContentMasterFilters } from "./types";
import { searchMasterBooks, getMasterBookById } from "./books";
import { searchMasterLectures, getMasterLectureById } from "./lectures";
import { getMasterCustomContentById } from "./custom";

/**
 * 콘텐츠 마스터 검색 (하위 호환성)
 * @deprecated searchMasterBooks 또는 searchMasterLectures 사용 권장
 */
export async function searchContentMasters(
  filters: ContentMasterFilters
): Promise<{
  data: Array<
    | (MasterBook & { content_type: "book" })
    | (MasterLecture & { content_type: "lecture" })
  >;
  total: number;
}> {
  if (filters.content_type === "book") {
    const result = await searchMasterBooks({
      ...filters,
      sort: filters.sort as ContentSortOption | undefined,
    });
    // content_type 필드 추가
    const dataWithType = result.data.map((book) => ({
      ...book,
      content_type: "book" as const,
    }));
    return { data: dataWithType, total: result.total };
  } else if (filters.content_type === "lecture") {
    const result = await searchMasterLectures({
      ...filters,
      sort: filters.sort as ContentSortOption | undefined,
    });
    // content_type 필드 추가
    const dataWithType = result.data.map((lecture) => ({
      ...lecture,
      content_type: "lecture" as const,
    }));
    return { data: dataWithType, total: result.total };
  } else {
    // 둘 다 검색
    const [booksResult, lecturesResult] = await Promise.all([
      searchMasterBooks({
        ...filters,
        sort: filters.sort as ContentSortOption | undefined,
      }),
      searchMasterLectures({
        ...filters,
        sort: filters.sort as ContentSortOption | undefined,
      }),
    ]);
    // content_type 필드 추가
    const booksWithType = booksResult.data.map((book) => ({
      ...book,
      content_type: "book" as const,
    }));
    const lecturesWithType = lecturesResult.data.map((lecture) => ({
      ...lecture,
      content_type: "lecture" as const,
    }));
    return {
      data: [...booksWithType, ...lecturesWithType],
      total: booksResult.total + lecturesResult.total,
    };
  }
}

/**
 * 콘텐츠 마스터 상세 조회 (하위 호환성)
 * @deprecated getMasterBookById 또는 getMasterLectureById 사용 권장
 * @param content_type 콘텐츠 타입 (선택사항, 없으면 자동 감지)
 */
export async function getContentMasterById(
  masterId: string,
  content_type?: "book" | "lecture" | "custom"
): Promise<{
  master: MasterBook | MasterLecture | MasterCustomContent | null;
  details: BookDetail[];
}> {
  // content_type이 명시되어 있으면 해당 타입으로 직접 조회
  if (content_type === "book") {
    const bookResult = await getMasterBookById(masterId);
    if (bookResult.book) {
      return {
        master: bookResult.book,
        details: bookResult.details,
      };
    }
    return { master: null, details: [] };
  } else if (content_type === "lecture") {
    const { lecture } = await getMasterLectureById(masterId);
    if (lecture) {
      return {
        master: lecture,
        details: [], // 강의는 세부 정보 없음 (episodes는 별도)
      };
    }
    return { master: null, details: [] };
  } else if (content_type === "custom") {
    const { content } = await getMasterCustomContentById(masterId);
    if (content) {
      return {
        master: content,
        details: [], // 커스텀 콘텐츠는 세부 정보 없음
      };
    }
    return { master: null, details: [] };
  }

  // content_type이 없으면 자동 감지 (하위 호환성)
  // 먼저 교재에서 찾기
  const bookResult = await getMasterBookById(masterId);
  if (bookResult.book) {
    return {
      master: bookResult.book,
      details: bookResult.details,
    };
  }

  // 강의에서 찾기
  const { lecture } = await getMasterLectureById(masterId);
  if (lecture) {
    return {
      master: lecture,
      details: [], // 강의는 세부 정보 없음 (episodes는 별도)
    };
  }

  // 커스텀 콘텐츠에서 찾기
  const { content } = await getMasterCustomContentById(masterId);
  if (content) {
    return {
      master: content,
      details: [], // 커스텀 콘텐츠는 세부 정보 없음
    };
  }

  return { master: null, details: [] };
}
