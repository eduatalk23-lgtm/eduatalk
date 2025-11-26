// 플랜 콘텐츠 데이터 액세스 레이어

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlanContent } from "@/lib/types/plan";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 콘텐츠 아이템 타입
 */
export type ContentItem = {
  id: string;
  title: string;
  subtitle?: string | null;
};

/**
 * 콘텐츠 상세 정보 타입
 */
export type ContentDetail = {
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  start_range: number;
  end_range: number;
  title: string;
  subject_category?: string | null;
  isRecommended: boolean; // 추천 콘텐츠 여부
  masterContentId?: string; // 원본 마스터 콘텐츠 ID
  // 자동 추천 관련 필드
  is_auto_recommended?: boolean;
  recommendation_source?: "auto" | "admin" | "template" | null;
  recommendation_reason?: string | null;
  recommendation_metadata?: {
    scoreDetails?: {
      schoolGrade?: number | null;
      schoolAverageGrade?: number | null;
      mockPercentile?: number | null;
      mockGrade?: number | null;
      riskScore?: number;
    };
    priority?: number;
  } | null;
};

/**
 * 학생의 책 목록 조회
 */
export async function fetchStudentBooks(
  studentId: string
): Promise<ContentItem[]> {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("books")
      .select("id, title, subject")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (
      data?.map((book) => ({
        id: book.id,
        title: book.title || "제목 없음",
        subtitle: book.subject || null,
      })) || []
    );
  } catch (err) {
    console.error("[data/planContents] 책 목록 조회 실패", err);
    return [];
  }
}

/**
 * 학생의 강의 목록 조회
 */
export async function fetchStudentLectures(
  studentId: string
): Promise<ContentItem[]> {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("lectures")
      .select("id, title, subject")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (
      data?.map((lecture) => ({
        id: lecture.id,
        title: lecture.title || "제목 없음",
        subtitle: lecture.subject || null,
      })) || []
    );
  } catch (err) {
    console.error("[data/planContents] 강의 목록 조회 실패", err);
    return [];
  }
}

/**
 * 학생의 커스텀 콘텐츠 목록 조회
 */
export async function fetchStudentCustomContents(
  studentId: string
): Promise<ContentItem[]> {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("student_custom_contents")
      .select("id, title, content_type")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (
      data?.map((custom) => ({
        id: custom.id,
        title: custom.title || "커스텀 콘텐츠",
        subtitle: custom.content_type || null,
      })) || []
    );
  } catch (err) {
    console.error("[data/planContents] 커스텀 콘텐츠 목록 조회 실패", err);
    return [];
  }
}

/**
 * 학생의 모든 콘텐츠 목록 조회 (통합)
 */
export async function fetchAllStudentContents(studentId: string): Promise<{
  books: ContentItem[];
  lectures: ContentItem[];
  custom: ContentItem[];
}> {
  const [books, lectures, custom] = await Promise.all([
    fetchStudentBooks(studentId),
    fetchStudentLectures(studentId),
    fetchStudentCustomContents(studentId),
  ]);

  return { books, lectures, custom };
}

/**
 * 플랜 콘텐츠를 학생/추천으로 분류하고 상세 정보 조회
 * N+1 쿼리 문제를 해결하기 위해 배치 조회 사용
 * 
 * @param contents 플랜 콘텐츠 목록
 * @param studentId 학생 ID
 * @returns 분류된 콘텐츠 목록
 */
export async function classifyPlanContents(
  contents: Array<{
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    start_range: number;
    end_range: number;
    // 자동 추천 관련 필드 (선택)
    is_auto_recommended?: boolean;
    recommendation_source?: "auto" | "admin" | "template" | null;
    recommendation_reason?: string | null;
    recommendation_metadata?: {
      scoreDetails?: {
        schoolGrade?: number | null;
        schoolAverageGrade?: number | null;
        mockPercentile?: number | null;
        mockGrade?: number | null;
        riskScore?: number;
      };
      priority?: number;
    } | null;
  }>,
  studentId: string
): Promise<{
  studentContents: Array<ContentDetail>;
  recommendedContents: Array<ContentDetail>;
}> {
  const supabase = await createSupabaseServerClient();

  // 1. 모든 콘텐츠 ID 수집 (배치 조회를 위해)
  const bookContentIds: string[] = [];
  const lectureContentIds: string[] = [];
  const customContentIds: string[] = [];

  contents.forEach((content) => {
    if (content.content_type === "book") {
      bookContentIds.push(content.content_id);
    } else if (content.content_type === "lecture") {
      lectureContentIds.push(content.content_id);
    } else if (content.content_type === "custom") {
      customContentIds.push(content.content_id);
    }
  });

  // 2. 배치 조회 (N+1 문제 해결)
  const [
    masterBooksResult,
    masterLecturesResult,
    studentBooksResult,
    studentLecturesResult,
    customContentsResult,
  ] = await Promise.all([
    // 마스터 콘텐츠 조회
    bookContentIds.length > 0
      ? supabase
          .from("master_books")
          .select("id, title, subject_category")
          .in("id", bookContentIds)
      : Promise.resolve({ data: [], error: null }),
    lectureContentIds.length > 0
      ? supabase
          .from("master_lectures")
          .select("id, title, subject_category")
          .in("id", lectureContentIds)
      : Promise.resolve({ data: [], error: null }),
    // 학생 콘텐츠 조회
    bookContentIds.length > 0
      ? supabase
          .from("books")
          .select("id, title, subject, master_content_id")
          .in("id", bookContentIds)
          .eq("student_id", studentId)
      : Promise.resolve({ data: [], error: null }),
    lectureContentIds.length > 0
      ? supabase
          .from("lectures")
          .select("id, title, subject, master_content_id")
          .in("id", lectureContentIds)
          .eq("student_id", studentId)
      : Promise.resolve({ data: [], error: null }),
    // 커스텀 콘텐츠 조회
    customContentIds.length > 0
      ? supabase
          .from("student_custom_contents")
          .select("id, title, content_type")
          .in("id", customContentIds)
          .eq("student_id", studentId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // 3. Map으로 변환 (빠른 조회)
  const masterBooksMap = new Map(
    (masterBooksResult.data || []).map((book) => [book.id, book])
  );
  const masterLecturesMap = new Map(
    (masterLecturesResult.data || []).map((lecture) => [lecture.id, lecture])
  );
  const studentBooksMap = new Map(
    (studentBooksResult.data || []).map((book) => [book.id, book])
  );
  const studentLecturesMap = new Map(
    (studentLecturesResult.data || []).map((lecture) => [lecture.id, lecture])
  );
  const customContentsMap = new Map(
    (customContentsResult.data || []).map((custom) => [custom.id, custom])
  );

  // 4. 마스터 콘텐츠 ID 추출 (학생 콘텐츠의 master_content_id)
  const masterContentIdsForLookup = new Set<string>();
  [...studentBooksMap.values(), ...studentLecturesMap.values()].forEach(
    (item) => {
      if (item.master_content_id) {
        masterContentIdsForLookup.add(item.master_content_id);
      }
    }
  );

  // 5. 원본 마스터 콘텐츠 조회 (학생 콘텐츠의 원본 참조용)
  const [originalMasterBooksResult, originalMasterLecturesResult] =
    await Promise.all([
      masterContentIdsForLookup.size > 0
        ? supabase
            .from("master_books")
            .select("id, title, subject_category, subject")
            .in("id", Array.from(masterContentIdsForLookup))
        : Promise.resolve({ data: [], error: null }),
      masterContentIdsForLookup.size > 0
        ? supabase
            .from("master_lectures")
            .select("id, title, subject_category, subject")
            .in("id", Array.from(masterContentIdsForLookup))
        : Promise.resolve({ data: [], error: null }),
    ]);

  const originalMasterBooksMap = new Map(
    (originalMasterBooksResult.data || []).map((book) => [book.id, book])
  );
  const originalMasterLecturesMap = new Map(
    (originalMasterLecturesResult.data || []).map((lecture) => [lecture.id, lecture])
  );

  // 6. 콘텐츠 분류 및 상세 정보 생성
  const studentContents: Array<ContentDetail> = [];
  const recommendedContents: Array<ContentDetail> = [];

  for (const content of contents) {
    let contentDetail: ContentDetail | null = null;
    let isRecommended = false;
    let masterContentId: string | undefined = undefined;

    if (content.content_type === "book") {
      // 마스터 콘텐츠인지 확인
      const masterBook = masterBooksMap.get(content.content_id);
      if (masterBook) {
        // 추천 콘텐츠
        isRecommended = true;
        masterContentId = content.content_id;
        contentDetail = {
          content_type: "book",
          content_id: content.content_id,
          start_range: content.start_range,
          end_range: content.end_range,
          title: masterBook.title || "제목 없음",
          subject_category: masterBook.subject_category || null,
          isRecommended: true,
          masterContentId: content.content_id,
          // 자동 추천 정보 전달
          is_auto_recommended: content.is_auto_recommended ?? false,
          recommendation_source: content.recommendation_source ?? null,
          recommendation_reason: content.recommendation_reason ?? null,
          recommendation_metadata: content.recommendation_metadata ?? null,
        };
      } else {
        // 학생 콘텐츠
        const studentBook = studentBooksMap.get(content.content_id);
        if (studentBook) {
          let title = studentBook.title || "제목 없음";
          let subjectCategory = studentBook.subject || null;

          // 원본 마스터 콘텐츠 정보 조회 (표시용)
          if (studentBook.master_content_id) {
            masterContentId = studentBook.master_content_id;
            const originalMasterBook = originalMasterBooksMap.get(
              studentBook.master_content_id
            );
            if (originalMasterBook) {
              title =
                originalMasterBook.title || studentBook.title || "제목 없음";
              subjectCategory =
                originalMasterBook.subject ||
                originalMasterBook.subject_category ||
                studentBook.subject ||
                null;
            }
          }

          contentDetail = {
            content_type: "book",
            content_id: content.content_id,
            start_range: content.start_range,
            end_range: content.end_range,
            title,
            subject_category: subjectCategory,
            isRecommended: false,
            masterContentId,
          };
        }
      }
    } else if (content.content_type === "lecture") {
      // 마스터 콘텐츠인지 확인
      const masterLecture = masterLecturesMap.get(content.content_id);
      if (masterLecture) {
        // 추천 콘텐츠
        isRecommended = true;
        masterContentId = content.content_id;
        contentDetail = {
          content_type: "lecture",
          content_id: content.content_id,
          start_range: content.start_range,
          end_range: content.end_range,
          title: masterLecture.title || "제목 없음",
          subject_category: masterLecture.subject_category || null,
          isRecommended: true,
          masterContentId: content.content_id,
          // 자동 추천 정보 전달
          is_auto_recommended: content.is_auto_recommended ?? false,
          recommendation_source: content.recommendation_source ?? null,
          recommendation_reason: content.recommendation_reason ?? null,
          recommendation_metadata: content.recommendation_metadata ?? null,
        };
      } else {
        // 학생 콘텐츠
        const studentLecture = studentLecturesMap.get(content.content_id);
        if (studentLecture) {
          let title = studentLecture.title || "제목 없음";
          let subjectCategory = studentLecture.subject || null;

          // 원본 마스터 콘텐츠 정보 조회 (표시용)
          if (studentLecture.master_content_id) {
            masterContentId = studentLecture.master_content_id;
            const originalMasterLecture = originalMasterLecturesMap.get(
              studentLecture.master_content_id
            );
            if (originalMasterLecture) {
              title =
                originalMasterLecture.title ||
                studentLecture.title ||
                "제목 없음";
              subjectCategory =
                originalMasterLecture.subject ||
                originalMasterLecture.subject_category ||
                studentLecture.subject ||
                null;
            }
          }

          contentDetail = {
            content_type: "lecture",
            content_id: content.content_id,
            start_range: content.start_range,
            end_range: content.end_range,
            title,
            subject_category: subjectCategory,
            isRecommended: false,
            masterContentId,
          };
        }
      }
    } else if (content.content_type === "custom") {
      // 커스텀 콘텐츠는 항상 학생 콘텐츠
      const customContent = customContentsMap.get(content.content_id);
      if (customContent) {
        contentDetail = {
          content_type: "custom",
          content_id: content.content_id,
          start_range: content.start_range,
          end_range: content.end_range,
          title: customContent.title || "커스텀 콘텐츠",
          subject_category: customContent.content_type || null,
          isRecommended: false,
        };
      }
    }

    if (contentDetail) {
      if (isRecommended) {
        recommendedContents.push(contentDetail);
      } else {
        studentContents.push(contentDetail);
      }
    }
  }

  return { studentContents, recommendedContents };
}

