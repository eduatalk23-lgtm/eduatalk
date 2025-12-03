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
      title: string | null;
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

    const body: BatchRequest = await request.json();
    const { contents, includeMetadata = false } = body;

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return apiBadRequest("contents 배열이 필요하며, 최소 1개 이상의 항목이 필요합니다.");
    }

    // 최대 20개까지 배치 조회 허용 (서버 부하 방지)
    if (contents.length > 20) {
      return apiBadRequest("한 번에 최대 20개까지 조회할 수 있습니다.");
    }

    const supabase = await createSupabaseServerClient();
    const targetStudentId = role === "student" ? user.userId : user.userId; // TODO: 관리자/컨설턴트의 경우 student_id 파라미터 지원

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
    const [bookDetailsMap, lectureEpisodesMap] = await Promise.all([
      bookIds.length > 0
        ? getStudentBookDetailsBatch(bookIds, targetStudentId)
        : Promise.resolve(new Map()),
      lectureIds.length > 0
        ? getStudentLectureEpisodesBatch(lectureIds, targetStudentId)
        : Promise.resolve(new Map()),
    ]);

    // 메타데이터 조회 (필요한 경우)
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

    if (includeMetadata) {
      // 교재 메타데이터 배치 조회
      if (bookIds.length > 0) {
        const { data: booksData } = await supabase
          .from("books")
          .select("id, subject, semester, revision, difficulty_level, publisher")
          .in("id", bookIds)
          .eq("student_id", targetStudentId);

        booksData?.forEach((book) => {
          metadataMap.set(book.id, {
            subject: book.subject,
            semester: book.semester,
            revision: book.revision,
            difficulty_level: book.difficulty_level,
            publisher: book.publisher,
          });
        });
      }

      // 강의 메타데이터 배치 조회
      if (lectureIds.length > 0) {
        const { data: lecturesData } = await supabase
          .from("lectures")
          .select("id, subject, semester, revision, difficulty_level, platform")
          .in("id", lectureIds)
          .eq("student_id", targetStudentId);

        lecturesData?.forEach((lecture) => {
          metadataMap.set(lecture.id, {
            subject: lecture.subject,
            semester: lecture.semester,
            revision: lecture.revision,
            difficulty_level: lecture.difficulty_level,
            platform: lecture.platform,
          });
        });
      }
    }

    // 결과를 통합하여 응답 생성
    const response: BatchResponse = {};

    contents.forEach((content) => {
      const contentType = contentMap.get(content.contentId);
      const metadata = includeMetadata ? metadataMap.get(content.contentId) : undefined;

      if (contentType === "book") {
        const details = bookDetailsMap.get(content.contentId) || [];
        response[content.contentId] = {
          details: details.map((d) => ({
            id: d.id,
            page_number: d.page_number,
            major_unit: d.major_unit,
            minor_unit: d.minor_unit,
          })),
          metadata,
        };
      } else {
        const episodes = lectureEpisodesMap.get(content.contentId) || [];
        response[content.contentId] = {
          episodes: episodes.map((e) => ({
            id: e.id,
            episode_number: e.episode_number,
            title: e.title,
            duration: e.duration ?? null,
          })),
          metadata,
        };
      }
    });

    return apiSuccess(response);
  } catch (error) {
    return handleApiError(error, "[api/student-content-details/batch]");
  }
}


