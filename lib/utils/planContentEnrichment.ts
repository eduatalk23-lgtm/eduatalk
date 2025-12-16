import type { Plan } from "@/lib/data/studentPlans";
import {
  getStudentBookDetailsBatch,
  getStudentLectureEpisodesBatch,
} from "@/lib/data/contentMasters";

/**
 * 강의 Episode 정보 타입
 */
type LectureEpisode = {
  id: string;
  episode_number: number;
  episode_title: string | null;
  duration: number | null;
};

/**
 * 교재 BookDetail 정보 타입
 */
type BookDetail = {
  id: string;
  page_number: number;
  major_unit: string | null;
  minor_unit: string | null;
};

/**
 * contentEpisode만 추가된 플랜 타입 (기존 Plan 확장)
 */
type PlanWithEpisode = Plan & {
  contentEpisode?: string | null;
};

/**
 * 강의 콘텐츠의 contentEpisode 생성
 * @param episodes Episode 배열 (episode_number 오름차순 정렬됨)
 * @param startEpisodeNumber 시작 episode_number
 * @param endEpisodeNumber 종료 episode_number
 * @returns contentEpisode 문자열
 */
function createLectureEpisodeString(
  episodes: LectureEpisode[],
  startEpisodeNumber: number,
  endEpisodeNumber: number
): string | null {
  if (episodes.length === 0) {
    return null;
  }

  // episode_number로 episode 찾기
  const startEpisode = episodes.find(
    (ep) => ep.episode_number === startEpisodeNumber
  );
  const endEpisode =
    startEpisodeNumber === endEpisodeNumber
      ? startEpisode
      : episodes.find((ep) => ep.episode_number === endEpisodeNumber);

  // episode를 찾지 못한 경우
  if (!startEpisode) {
    return null;
  }

  // 단일 episode
  if (startEpisodeNumber === endEpisodeNumber || !endEpisode) {
    // episode_title이 있으면 사용, 없으면 episode_number 사용
    if (startEpisode.episode_title) {
      return startEpisode.episode_title;
    }
    return `${startEpisode.episode_number}강`;
  }

  // 범위 episode
  const startTitle = startEpisode.episode_title
    ? startEpisode.episode_title
    : `${startEpisode.episode_number}강`;
  const endTitle = endEpisode.episode_title
    ? endEpisode.episode_title
    : `${endEpisode.episode_number}강`;

  return `${startTitle} ~ ${endTitle}`;
}

/**
 * 교재 콘텐츠의 contentEpisode 생성
 * @param bookDetails BookDetail 배열 (page_number 오름차순 정렬됨)
 * @param startPage 시작 page_number
 * @param endPage 종료 page_number
 * @returns contentEpisode 문자열
 */
function createBookEpisodeString(
  bookDetails: BookDetail[],
  startPage: number,
  endPage: number
): string | null {
  if (bookDetails.length === 0) {
    return null;
  }

  // page_number <= startPage인 가장 큰 book_detail 찾기
  let startDetail: BookDetail | null = null;
  for (let i = bookDetails.length - 1; i >= 0; i--) {
    if (bookDetails[i].page_number <= startPage) {
      startDetail = bookDetails[i];
      break;
    }
  }

  // page_number <= endPage인 가장 큰 book_detail 찾기
  let endDetail: BookDetail | null = null;
  for (let i = bookDetails.length - 1; i >= 0; i--) {
    if (bookDetails[i].page_number <= endPage) {
      endDetail = bookDetails[i];
      break;
    }
  }

  // 단일 범위
  if (startDetail && endDetail && startDetail === endDetail) {
    const unit = startDetail.major_unit || startDetail.minor_unit;
    if (unit) {
      return unit;
    }
    // 단원 정보가 없으면 페이지 범위 표시
    return `${startPage}페이지${startPage !== endPage ? ` ~ ${endPage}페이지` : ""}`;
  }

  // 범위
  if (startDetail && endDetail) {
    const startUnit = startDetail.major_unit || startDetail.minor_unit;
    const endUnit = endDetail.major_unit || endDetail.minor_unit;

    if (startUnit && endUnit) {
      if (startUnit === endUnit) {
        return startUnit;
      }
      return `${startUnit} ~ ${endUnit}`;
    }

    // 단원 정보가 없으면 페이지 범위 표시
    return `${startPage}페이지 ~ ${endPage}페이지`;
  }

  // 단원 정보를 찾지 못한 경우 페이지 범위 표시
  return `${startPage}페이지${startPage !== endPage ? ` ~ ${endPage}페이지` : ""}`;
}

/**
 * 플랜에 콘텐츠 상세 정보를 추가하는 함수
 * - 강의: episode_title 표시 (예: "8강: 함수의 개념")
 * - 교재: major_unit/minor_unit 표시 (예: "1단원: 함수")
 * - Fallback: sequence 사용 (예: "1회차")
 *
 * @param plans 플랜 배열
 * @param studentId 학생 ID
 * @returns 콘텐츠 상세 정보가 추가된 플랜 배열
 */
export async function enrichPlansWithContentDetails(
  plans: Plan[],
  studentId: string
): Promise<PlanWithEpisode[]> {
  // 1. 콘텐츠 ID 수집
  const bookIds = new Set<string>();
  const lectureIds = new Set<string>();

  plans.forEach((plan) => {
    if (plan.content_type === "book" && plan.content_id) {
      bookIds.add(plan.content_id);
    } else if (plan.content_type === "lecture" && plan.content_id) {
      lectureIds.add(plan.content_id);
    }
  });

  // 2. 배치 조회 (병렬 처리)
  const [bookDetailsMap, lectureEpisodesMap] = await Promise.all([
    bookIds.size > 0
      ? getStudentBookDetailsBatch(Array.from(bookIds), studentId)
      : Promise.resolve(
          new Map<
            string,
            Array<{
              id: string;
              page_number: number;
              major_unit: string | null;
              minor_unit: string | null;
            }>
          >()
        ),
    lectureIds.size > 0
      ? getStudentLectureEpisodesBatch(Array.from(lectureIds), studentId)
      : Promise.resolve(
          new Map<
            string,
            Array<{
              id: string;
              episode_number: number;
              episode_title: string | null;
              duration: number | null;
            }>
          >()
        ),
  ]);

  // 3. 각 플랜에 contentEpisode 추가
  return plans.map((plan): PlanWithEpisode => {
    let contentEpisode: string | null = null;

    // 강의 콘텐츠 처리
    if (plan.content_type === "lecture" && plan.content_id) {
      const episodes = lectureEpisodesMap.get(plan.content_id) || [];
      const startEpisodeNumber = plan.planned_start_page_or_time;
      const endEpisodeNumber = plan.planned_end_page_or_time;

      if (
        startEpisodeNumber !== null &&
        startEpisodeNumber !== undefined &&
        endEpisodeNumber !== null &&
        endEpisodeNumber !== undefined
      ) {
        contentEpisode = createLectureEpisodeString(
          episodes,
          startEpisodeNumber,
          endEpisodeNumber
        );
      }
    }
    // 교재 콘텐츠 처리
    else if (plan.content_type === "book" && plan.content_id) {
      const bookDetails = bookDetailsMap.get(plan.content_id) || [];
      const startPage = plan.planned_start_page_or_time;
      const endPage = plan.planned_end_page_or_time;

      if (
        startPage !== null &&
        startPage !== undefined &&
        endPage !== null &&
        endPage !== undefined
      ) {
        contentEpisode = createBookEpisodeString(bookDetails, startPage, endPage);
      }
    }

    // Fallback: sequence 사용
    if (!contentEpisode && plan.sequence !== null && plan.sequence !== undefined) {
      contentEpisode = `${plan.sequence}회차`;
    }

    return {
      ...plan,
      contentEpisode,
    };
  });
}

