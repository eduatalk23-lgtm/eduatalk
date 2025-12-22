import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStudentBookDetailsBatch,
  getStudentLectureEpisodesBatch,
} from "@/lib/data/contentMasters";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import {
  apiSuccess,
  apiUnauthorized,
  apiBadRequest,
  handleApiError,
} from "@/lib/api";

// 동적 렌더링 설정: 인증이 필요하므로 동적 렌더링 필수

// 캐시 설정: 배치 API도 동일하게 5분 캐시
export const revalidate = 300;

type BatchRequest = {
  contents: Array<{
    contentId: string;
    contentType: "book" | "lecture";
  }>;
  includeMetadata?: boolean;
};

type BatchResponse = {
  [contentId: string]: {
    details?: Array<{
      id: string;
      page_number?: number;
      episode_number?: number;
      major_unit?: string | null;
      minor_unit?: string | null;
      title?: string | null;
    }>;
    episodes?: Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
      duration?: number | null;
    }>;
    metadata?: {
      subject?: string | null;
      semester?: string | null;
      revision?: string | null;
      difficulty_level?: string | null;
      publisher?: string | null;
      platform?: string | null;
    };
  };
};

/**
 * 학생 콘텐츠 상세 정보 배치 조회 API
 * POST /api/student-content-details/batch
 *
 * @returns
 * 성공: { success: true, data: BatchResponse }
 * 에러: { success: false, error: { code, message } }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { role } = await getCurrentUserRole();

    if (!user || (role !== "student" && role !== "admin" && role !== "consultant")) {
      return apiUnauthorized();
    }

    // 요청 본문 파싱 (빈 요청 처리)
    let body: BatchRequest & { student_id?: string };
    try {
      const text = await request.text();
      if (!text || text.trim() === "") {
        return apiBadRequest("요청 본문이 비어있습니다.");
      }
      body = JSON.parse(text);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return apiBadRequest("요청 본문이 유효한 JSON 형식이 아닙니다.");
      }
      throw error;
    }

    const { contents, includeMetadata = false, student_id } = body;

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return apiBadRequest("contents 배열이 필요하며, 최소 1개 이상의 항목이 필요합니다.");
    }

    // 최대 20개까지 배치 조회 허용 (서버 부하 방지)
    if (contents.length > 20) {
      return apiBadRequest("한 번에 최대 20개까지 조회할 수 있습니다.");
    }

    // 관리자/컨설턴트의 경우 student_id가 필요
    if ((role === "admin" || role === "consultant") && !student_id) {
      return apiBadRequest("관리자/컨설턴트의 경우 student_id가 필요합니다.");
    }

    const supabase = await createSupabaseServerClient();
    const targetStudentId = role === "student" ? user.userId : student_id!;

    // 콘텐츠를 타입별로 분류
    const bookIds: string[] = [];
    const lectureIds: string[] = [];
    const contentMap = new Map<string, "book" | "lecture">();

    contents.forEach((content) => {
      if (content.contentType === "book") {
        bookIds.push(content.contentId);
      } else {
        lectureIds.push(content.contentId);
      }
      contentMap.set(content.contentId, content.contentType);
    });

    // 병렬로 배치 조회 수행
    // 상세 정보와 메타데이터를 동시에 조회하여 성능 최적화
    const selectBookFields = includeMetadata
      ? "id, total_pages, master_content_id, subject, semester, revision, difficulty_level, publisher"
      : "id, total_pages, master_content_id";
    const selectLectureFields = includeMetadata
      ? "id, total_episodes, master_content_id, subject, semester, revision, difficulty_level, platform"
      : "id, total_episodes, master_content_id";

    const [
      bookDetailsMap,
      lectureEpisodesMap,
      booksDataResult,
      lecturesDataResult,
    ] = await Promise.all([
      bookIds.length > 0
        ? getStudentBookDetailsBatch(bookIds, targetStudentId)
        : Promise.resolve(new Map()),
      lectureIds.length > 0
        ? getStudentLectureEpisodesBatch(lectureIds, targetStudentId)
        : Promise.resolve(new Map()),
      bookIds.length > 0
        ? supabase
            .from("books")
            .select(selectBookFields)
            .in("id", bookIds)
            .eq("student_id", targetStudentId)
        : Promise.resolve({ data: null }),
      lectureIds.length > 0
        ? supabase
            .from("lectures")
            .select(selectLectureFields)
            .in("id", lectureIds)
            .eq("student_id", targetStudentId)
        : Promise.resolve({ data: null }),
    ]);

    // 메타데이터 및 총량 정보 맵 생성
    const metadataMap = new Map<
      string,
      {
        subject?: string | null;
        semester?: string | null;
        revision?: string | null;
        difficulty_level?: string | null;
        publisher?: string | null;
        platform?: string | null;
      }
    >();
    const totalPagesMap = new Map<string, number | null>();
    const totalEpisodesMap = new Map<string, number | null>();
    const masterContentIdMap = new Map<string, string | null>();

    // 교재 데이터 처리
    if (booksDataResult.data) {
      (booksDataResult.data as unknown as Array<{
        id: string;
        total_pages: number | null;
        master_content_id: string | null;
        subject?: string | null;
        semester?: string | null;
        revision?: string | null;
        difficulty_level?: string | null;
        publisher?: string | null;
      }>).forEach((book) => {
        totalPagesMap.set(book.id, book.total_pages);
        masterContentIdMap.set(book.id, book.master_content_id);
        if (includeMetadata) {
          metadataMap.set(book.id, {
            subject: book.subject,
            semester: book.semester,
            revision: book.revision,
            difficulty_level: book.difficulty_level,
            publisher: book.publisher,
          });
        }
      });
    }

    // 강의 데이터 처리
    if (lecturesDataResult.data) {
      (lecturesDataResult.data as unknown as Array<{
        id: string;
        total_episodes: number | null;
        master_content_id: string | null;
        subject?: string | null;
        semester?: string | null;
        revision?: string | null;
        difficulty_level?: string | null;
        platform?: string | null;
      }>).forEach((lecture) => {
        totalEpisodesMap.set(lecture.id, lecture.total_episodes);
        masterContentIdMap.set(lecture.id, lecture.master_content_id);
        if (includeMetadata) {
          metadataMap.set(lecture.id, {
            subject: lecture.subject,
            semester: lecture.semester,
            revision: lecture.revision,
            difficulty_level: lecture.difficulty_level,
            platform: lecture.platform,
          });
        }
      });
    }

    // master_content_id가 있지만 total_pages/total_episodes가 없는 경우 마스터에서 조회 (fallback)
    const masterBookIds = Array.from(masterContentIdMap.entries())
      .filter(([contentId, masterId]) => {
        const contentType = contentMap.get(contentId);
        return (
          contentType === "book" &&
          masterId &&
          !totalPagesMap.get(contentId)
        );
      })
      .map(([, masterId]) => masterId!);
    const masterLectureIds = Array.from(masterContentIdMap.entries())
      .filter(([contentId, masterId]) => {
        const contentType = contentMap.get(contentId);
        return (
          contentType === "lecture" &&
          masterId &&
          !totalEpisodesMap.get(contentId)
        );
      })
      .map(([, masterId]) => masterId!);

    const [masterBooksResult, masterLecturesResult] = await Promise.all([
      masterBookIds.length > 0
        ? supabase
            .from("master_books")
            .select("id, total_pages")
            .in("id", masterBookIds)
        : Promise.resolve({ data: null }),
      masterLectureIds.length > 0
        ? supabase
            .from("master_lectures")
            .select("id, total_episodes")
            .in("id", masterLectureIds)
        : Promise.resolve({ data: null }),
    ]);

    // 마스터 데이터로 fallback 처리
    if (masterBooksResult.data) {
      masterBooksResult.data.forEach((book: {
        id: string;
        total_pages: number | null;
      }) => {
        // master_content_id로 역매핑하여 contentId 찾기
        for (const [contentId, masterId] of masterContentIdMap.entries()) {
          if (masterId === book.id && contentMap.get(contentId) === "book") {
            if (!totalPagesMap.has(contentId) || !totalPagesMap.get(contentId)) {
              totalPagesMap.set(contentId, book.total_pages);
            }
            break;
          }
        }
      });
    }

    if (masterLecturesResult.data) {
      masterLecturesResult.data.forEach((lecture: {
        id: string;
        total_episodes: number | null;
      }) => {
        // master_content_id로 역매핑하여 contentId 찾기
        for (const [contentId, masterId] of masterContentIdMap.entries()) {
          if (
            masterId === lecture.id &&
            contentMap.get(contentId) === "lecture"
          ) {
            if (
              !totalEpisodesMap.has(contentId) ||
              !totalEpisodesMap.get(contentId)
            ) {
              totalEpisodesMap.set(contentId, lecture.total_episodes);
            }
            break;
          }
        }
      });
    }

    // 결과를 통합하여 응답 생성
    const response: BatchResponse & {
      [contentId: string]: {
        details?: Array<{
          id: string;
          page_number?: number;
          episode_number?: number;
          major_unit?: string | null;
          minor_unit?: string | null;
          title?: string | null;
        }>;
        episodes?: Array<{
          id: string;
          episode_number: number;
          episode_title: string | null;
          duration?: number | null;
        }>;
        total_pages?: number | null;
        total_episodes?: number | null;
        metadata?: {
          subject?: string | null;
          semester?: string | null;
          revision?: string | null;
          difficulty_level?: string | null;
          publisher?: string | null;
          platform?: string | null;
        };
      };
    } = {};

    contents.forEach((content) => {
      const contentType = contentMap.get(content.contentId);
      const metadata = includeMetadata ? metadataMap.get(content.contentId) : undefined;

      if (contentType === "book") {
        const details = bookDetailsMap.get(content.contentId) || [];
        response[content.contentId] = {
          details: details.map((d: { id: string; page_number: number | null; major_unit: string | null; minor_unit: string | null }) => ({
            id: d.id,
            page_number: d.page_number,
            major_unit: d.major_unit,
            minor_unit: d.minor_unit,
          })),
          total_pages: totalPagesMap.get(content.contentId) ?? null,
          metadata,
        };
      } else {
        const episodes = lectureEpisodesMap.get(content.contentId) || [];
        response[content.contentId] = {
          episodes: episodes.map((e: { id: string; episode_number: number; episode_title: string | null; duration: number | null }) => ({
            id: e.id,
            episode_number: e.episode_number,
            episode_title: e.episode_title,
            duration: e.duration ?? null,
          })),
          total_episodes: totalEpisodesMap.get(content.contentId) ?? null,
          metadata,
        };
      }
    });

    return apiSuccess(response);
  } catch (error) {
    return handleApiError(error, "[api/student-content-details/batch]");
  }
}


