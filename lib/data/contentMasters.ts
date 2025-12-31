/**
 * 콘텐츠 마스터 데이터 액세스 레이어
 * 
 * master_books, master_lectures 테이블 사용
 * typedQueryBuilder 패턴을 사용하여 타입 안전성과 에러 처리를 표준화합니다.
 */

import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import { getClientForRLSBypass } from "@/lib/supabase/clientSelector";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MasterBook,
  MasterLecture,
  MasterCustomContent,
  BookDetail,
  LectureEpisode,
  MasterBookWithJoins,
  MasterLectureWithJoins,
} from "@/lib/types/plan";
import {
  getSubjectGroups,
  getSubjectsByGroup,
  type SubjectGroup,
  type Subject,
} from "@/lib/data/subjects";
import { normalizeError } from "@/lib/errors";
import { logActionError, logActionDebug, logActionSuccess } from "@/lib/logging/actionLogger";
import {
  createMasterToStudentMap,
  extractMasterIds,
} from "@/lib/plan/content";
import { buildContentQuery } from "@/lib/data/contentQueryBuilder";
import { extractJoinedData } from "@/lib/utils/supabaseHelpers";
import { createTypedQuery, createTypedSingleQuery, createTypedParallelQueries } from "@/lib/data/core/typedQueryBuilder";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import type {
  MasterBookFilters,
  MasterLectureFilters,
  MasterCustomContentFilters,
  ContentSortOption,
} from "@/lib/types/contentFilters";

// 타입 재export (하위 호환성 유지)
export type {
  MasterBookFilters,
  MasterLectureFilters,
  MasterCustomContentFilters,
} from "@/lib/types/contentFilters";

/**
 * 통합 검색 필터 (하위 호환성)
 * @deprecated master_books, master_lectures로 분리됨. MasterBookFilters 또는 MasterLectureFilters 사용 권장
 */
export type ContentMasterFilters = {
  content_type?: "book" | "lecture";
  curriculum_revision_id?: string;
  subject_group_id?: string;
  subject_id?: string;
  publisher_id?: string; // 교재용
  platform_id?: string; // 강의용
  search?: string;
  difficulty?: string; // 난이도 필터링
  sort?: string; // 정렬 옵션
  tenantId?: string | null;
  limit?: number;
  offset?: number;
};

// ============================================
// 교재 관련 함수
// ============================================

/**
 * 교재 검색
 * @param filters 검색 필터
 * @param supabase Supabase 클라이언트 (선택적, 전달하지 않으면 일반 서버 클라이언트 사용)
 */
export async function searchMasterBooks(
  filters: MasterBookFilters,
  supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ data: MasterBook[]; total: number }> {
  const queryClient = supabase || (await createSupabaseServerClient());

  // 공통 쿼리 빌더 사용 (JOIN 포함)
  const result = await buildContentQuery<MasterBook & { difficulty_levels?: Array<{ id: string; name: string }> | null }>(
    queryClient,
    "master_books",
    filters
  );

  // JOIN된 difficulty_levels 데이터를 difficulty_level 필드에 매핑
  const enrichedData = result.data.map((item) => {
    const difficultyLevel = extractJoinedData<{ id: string; name: string }>(
      item.difficulty_levels
    );
    return {
      ...item,
      difficulty_level: difficultyLevel?.name || item.difficulty_level || null,
    } as MasterBook;
  });

  logActionDebug(
    { domain: "data", action: "searchMasterBooks" },
    "마스터 교재 조회 완료",
    {
      filters: {
        curriculum_revision_id: filters.curriculum_revision_id,
        subject_group_id: filters.subject_group_id,
        subject_id: filters.subject_id,
        publisher_id: filters.publisher_id,
        difficulty: filters.difficulty,
        sort: filters.sort,
        tenantId: filters.tenantId,
        limit: filters.limit,
      },
      result: {
        count: enrichedData.length,
        total: result.total,
        titles: enrichedData.slice(0, 3).map((b) => b.title),
      },
    }
  );

  return {
    data: enrichedData,
    total: result.total,
  };
}

/**
 * 마스터 교재 목록 조회 (드롭다운용)
 * 초기 로드 시 사용 (최대 50개)
 */
export async function getMasterBooksList(): Promise<
  Array<{ id: string; title: string }>
> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<Array<{ id: string; title: string }>>(
    async () => {
      return await supabase
        .from("master_books")
        .select("id, title")
        .eq("is_active", true)
        .order("title", { ascending: true })
        .limit(50);
    },
    {
      context: "[data/contentMasters] getMasterBooksList",
      defaultValue: [],
    }
  );

  return result ?? [];
}

/**
 * 마스터 교재 검색 (서버 사이드)
 * 검색어로 교재를 검색합니다. 최대 50개 반환.
 */
export async function searchMasterBooksForDropdown(
  searchQuery: string
): Promise<Array<{ id: string; title: string }>> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedQuery<Array<{ id: string; title: string }>>(
    async () => {
      return await supabase
        .from("master_books")
        .select("id, title")
        .eq("is_active", true)
        .ilike("title", `%${searchQuery}%`)
        .order("title", { ascending: true })
        .limit(50);
    },
    {
      context: "[data/contentMasters] searchMasterBooksForDropdown",
      defaultValue: [],
    }
  );

  return result ?? [];
}

/**
 * 마스터 교재 단일 조회 (ID로)
 * 선택된 교재 정보를 조회합니다.
 */
export async function getMasterBookForDropdown(
  bookId: string
): Promise<{ id: string; title: string } | null> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedSingleQuery<{ id: string; title: string }>(
    async () => {
      return await supabase
        .from("master_books")
        .select("id, title")
        .eq("id", bookId);
    },
    {
      context: "[data/contentMasters] getMasterBookForDropdown",
      defaultValue: null,
    }
  );

  return result;
}

/**
 * 교재 상세 조회 (세부 정보 포함)
 * subject_id, curriculum_revision_id, publisher_id로부터 관련 정보를 JOIN으로 조회
 * 
 * @param bookId - 조회할 교재 ID
 * @param supabase - 선택적 Supabase 클라이언트 (관리자/컨설턴트가 다른 테넌트의 콘텐츠를 조회할 때 Admin 클라이언트 전달)
 */
export async function getMasterBookById(
  bookId: string,
  supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>> | ReturnType<typeof createSupabaseAdminClient>
): Promise<{
  book: (MasterBook & {
    subject_category?: string | null;
    subject?: string | null;
    publisher?: string | null;
    revision?: string | null;
  }) | null;
  details: BookDetail[];
}> {
  const queryClient = supabase || (await createSupabaseServerClient());

  // 병렬 쿼리 실행
  const [bookResult, detailsResult] = await createTypedParallelQueries([
    async () => {
      return await queryClient
        .from("master_books")
        .select(
          `
        id,
        tenant_id,
        revision,
        content_category,
        title,
        total_pages,
        difficulty_level,
        difficulty_level_id,
        notes,
        pdf_url,
        ocr_data,
        page_analysis,
        overall_difficulty,
        updated_at,
        created_at,
        is_active,
        curriculum_revision_id,
        subject_id,
        subject_group_id,
        subject_category,
        subject,
        grade_min,
        grade_max,
        school_type,
        subtitle,
        series_name,
        author,
        publisher_id,
        publisher_name,
        isbn_10,
        isbn_13,
        edition,
        published_date,
        target_exam_type,
        description,
        toc,
        publisher_review,
        tags,
        source,
        source_product_code,
        source_url,
        cover_image_url,
        curriculum_revisions:curriculum_revision_id (
          id,
          name
        ),
        subjects:subject_id (
          id,
          name,
          subject_groups:subject_group_id (
            id,
            name
          )
        ),
        publishers:publisher_id (
          id,
          name
        ),
        difficulty_levels:difficulty_level_id (
          id,
          name
        )
      `
        )
        .eq("id", bookId)
        .maybeSingle();
    },
    async () => {
      return await queryClient
        .from("book_details")
        .select("*")
        .eq("book_id", bookId)
        .order("display_order", { ascending: true })
        .order("page_number", { ascending: true });
    },
  ], {
    context: "[data/contentMasters] getMasterBookById",
    defaultValue: null,
  });

  // bookResult는 단일 객체이므로 타입 처리
  const bookData = bookResult as MasterBookWithJoins | null;
  if (!bookData) {
    return {
      book: null,
      details: (detailsResult as BookDetail[] | null) ?? [],
    };
  }


  // JOIN된 데이터를 평탄화하여 표시용 필드 추가
  // Supabase의 중첩 SELECT는 배열로 반환될 수 있으므로 배열 처리
  const curriculumRevision = extractJoinedData<{ id: string; name: string }>(
    bookData.curriculum_revisions
  );

  const subject = extractJoinedData<{
    id: string;
    name: string;
    subject_groups?: Array<{ id: string; name: string }> | null;
  }>(bookData.subjects);

  // subject가 있을 때 subject_groups 처리
  // subject_group_id는 master_books에 직접 존재하지만, subjects를 통한 JOIN도 수행
  // denormalized 값(subject_category, subject)이 우선이므로 JOIN은 fallback으로만 사용
  const subjectGroup = extractJoinedData<{ id: string; name: string }>(
    subject?.subject_groups
  );

  const publisher = extractJoinedData<{ id: string; name: string }>(
    bookData.publishers
  );

  const difficultyLevel = extractJoinedData<{ id: string; name: string }>(
    bookData.difficulty_levels
  );

  logActionDebug(
    { domain: "data", action: "getMasterBookById" },
    "JOIN 결과",
    {
      bookId,
      subject_id: bookData.subject_id,
      subject_group_id: bookData.subject_group_id,
      curriculum_revision_id: bookData.curriculum_revision_id,
      difficulty_level_id: bookData.difficulty_level_id,
      hasCurriculumRevision: !!curriculumRevision,
      hasSubject: !!subject,
      hasSubjectGroup: !!subjectGroup,
      hasPublisher: !!publisher,
      hasDifficultyLevel: !!difficultyLevel,
      denormalizedSubjectCategory: bookData.subject_category,
      denormalizedSubject: bookData.subject,
      subjectData: subject,
      subjectGroupData: subjectGroup,
      difficultyLevelData: difficultyLevel,
    }
  );

  const book = {
    ...bookData,
    // revision: curriculum_revisions.name 우선, 없으면 denormalized revision 값 사용
    revision: curriculumRevision?.name || bookData.revision || null,
    // subject_category: JOIN 결과 우선, 없으면 denormalized 값 사용 (하위 호환성)
    // @note 마이그레이션 중: subject_groups.name (JOIN)을 우선 사용하여 정규화된 데이터 소스 활용
    // 향후 완전한 마이그레이션 후에는 subject_group_id와 JOIN만 사용 예정
    subject_category: subjectGroup?.name || bookData.subject_category || null,
    // subject: JOIN 결과 우선, 없으면 denormalized 값 사용 (하위 호환성)
    subject: subject?.name || bookData.subject || null,
    // publisher: denormalized 값(publisher_name) 우선, 없으면 JOIN 결과 사용
    publisher: bookData.publisher_name || publisher?.name || null,
    // difficulty_level: difficulty_levels.name 우선, 없으면 denormalized difficulty_level 값 사용
    // difficulty_level_id가 있으면 JOIN된 name을 우선 사용
    difficulty_level:
      difficultyLevel?.name || bookData.difficulty_level || null,
  } as MasterBook & {
    subject_category?: string | null;
    subject?: string | null;
    publisher?: string | null;
    revision?: string | null;
  };

  return {
    book,
    details: (detailsResult as BookDetail[] | null) ?? [],
  };
}

// ============================================
// 강의 관련 함수
// ============================================

/**
 * 강의 검색
 * @param filters 검색 필터
 * @param supabase Supabase 클라이언트 (선택적, 전달하지 않으면 일반 서버 클라이언트 사용)
 */
export async function searchMasterLectures(
  filters: MasterLectureFilters,
  supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ data: MasterLecture[]; total: number }> {
  const queryClient = supabase || (await createSupabaseServerClient());

  // 공통 쿼리 빌더 사용 (JOIN 포함)
  const result = await buildContentQuery<MasterLecture & { difficulty_levels?: Array<{ id: string; name: string }> | null }>(
    queryClient,
    "master_lectures",
    filters
  );

  // JOIN된 difficulty_levels 데이터를 difficulty_level 필드에 매핑
  const enrichedData = result.data.map((item) => {
    const difficultyLevel = extractJoinedData<{ id: string; name: string }>(
      item.difficulty_levels
    );
    return {
      ...item,
      difficulty_level: difficultyLevel?.name || item.difficulty_level || null,
    } as MasterLecture;
  });

  logActionDebug(
    { domain: "data", action: "searchMasterLectures" },
    "마스터 강의 조회 완료",
    {
      filters: {
        curriculum_revision_id: filters.curriculum_revision_id,
        subject_group_id: filters.subject_group_id,
        subject_id: filters.subject_id,
        platform_id: filters.platform_id,
        difficulty: filters.difficulty,
        sort: filters.sort,
        tenantId: filters.tenantId,
        limit: filters.limit,
      },
      result: {
        count: enrichedData.length,
        total: result.total,
        titles: enrichedData.slice(0, 3).map((l) => l.title),
      },
    }
  );

  return {
    data: enrichedData,
    total: result.total,
  };
}

/**
 * 강의 상세 조회
 * 
 * @param lectureId - 조회할 강의 ID
 * @param supabase - 선택적 Supabase 클라이언트 (관리자/컨설턴트가 다른 테넌트의 콘텐츠를 조회할 때 Admin 클라이언트 전달)
 */
export async function getMasterLectureById(
  lectureId: string,
  supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>> | ReturnType<typeof createSupabaseAdminClient>
): Promise<{ lecture: MasterLecture | null; episodes: LectureEpisode[] }> {
  const queryClient = supabase || (await createSupabaseServerClient());

  // 병렬 쿼리 실행
  const [lectureResult, episodesResult] = await createTypedParallelQueries([
    async () => {
      return await queryClient
        .from("master_lectures")
        .select(
          `
        *,
        difficulty_levels:difficulty_level_id (
          id,
          name
        )
      `
        )
        .eq("id", lectureId)
        .maybeSingle<MasterLecture>();
    },
    async () => {
      return await queryClient
        .from("lecture_episodes")
        .select(
          "id, lecture_id, episode_number, episode_title, duration, display_order, created_at, lecture_source_url"
        )
        .eq("lecture_id", lectureId)
        .order("display_order", { ascending: true })
        .order("episode_number", { ascending: true });
    },
  ], {
    context: "[data/contentMasters] getMasterLectureById",
    defaultValue: null,
  });

  // lectureResult는 단일 객체이므로 타입 처리
  const lectureData = lectureResult as MasterLectureWithJoins | null;
  if (!lectureData) {
    return {
      lecture: null,
      episodes: (episodesResult as LectureEpisode[] | null) ?? [],
    };
  }

  // JOIN된 데이터 처리
  const difficultyLevel = extractJoinedData<{ id: string; name: string }>(
    lectureData.difficulty_levels
  );

  // difficulty_level을 JOIN된 name으로 덮어쓰기 (fallback: 기존 값)
  const lecture = {
    ...lectureData,
    difficulty_level:
      difficultyLevel?.name || lectureData.difficulty_level || null,
  } as MasterLecture;

  return {
    lecture,
    episodes: (episodesResult as LectureEpisode[] | null) ?? [],
  };
}

// ============================================
// 통합 함수 (하위 호환성)
// ============================================

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

// ============================================
// 학생 콘텐츠 복사 함수
// ============================================

/**
 * 마스터 교재를 학생 교재로 복사
 * 주의: Admin 클라이언트를 사용하여 RLS 정책을 우회합니다.
 */
export async function copyMasterBookToStudent(
  bookId: string,
  studentId: string,
  tenantId: string
): Promise<{
  bookId: string;
  detailIdMap?: Map<string, string>; // masterDetailId -> studentDetailId
}> {
  // Admin 클라이언트 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error(
      "Admin 클라이언트를 생성할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY 환경 변수를 확인해주세요."
    );
  }

  const { book } = await getMasterBookById(bookId);
  if (!book) {
    throw new Error("교재를 찾을 수 없습니다.");
  }

  // 중복 체크: 같은 master_content_id를 가진 학생 교재가 이미 있는지 확인
  const { data: existingBook } = await supabase
    .from("books")
    .select("id")
    .eq("student_id", studentId)
    .eq("master_content_id", bookId) // books 테이블은 아직 master_content_id 사용 (교재용)
    .maybeSingle();

  if (existingBook) {
    // 이미 복사된 교재가 있으면 기존 ID와 함께 detail ID 매핑도 조회
    const { details: masterDetails } = await getMasterBookById(bookId);
    let detailIdMap: Map<string, string> | undefined;

    if (masterDetails.length > 0) {
      // display_order -> master detail id 매핑
      const displayOrderToMasterId = new Map(
        masterDetails.map((d) => [d.display_order, d.id])
      );

      // 기존 학생 교재의 details 조회
      const { data: existingDetails } = await supabase
        .from("student_book_details")
        .select("id, display_order")
        .eq("book_id", existingBook.id);

      if (existingDetails && existingDetails.length > 0) {
        detailIdMap = new Map();
        existingDetails.forEach((studentDetail) => {
          const masterDetailId = displayOrderToMasterId.get(studentDetail.display_order);
          if (masterDetailId) {
            detailIdMap!.set(masterDetailId, studentDetail.id);
          }
        });
      }
    }

    return { bookId: existingBook.id, detailIdMap };
  }

  if (!supabase) throw new Error("Supabase client uninitialized");

  const { data: studentBook, error } = await supabase
    .from("books")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      title: book.title,
      revision: book.revision,
      semester: null, // 마스터 콘텐츠에서 semester 필드 제거됨
      subject_category: book.subject_category,
      subject: book.subject,
      publisher: book.publisher,
      difficulty_level: book.difficulty_level,
      total_pages: book.total_pages,
      notes: book.notes,
      master_content_id: bookId, // books 테이블은 아직 master_content_id 사용 (교재용)
    })
    .select("id")
    .single();

  if (error) {
    logActionError(
      { domain: "data", action: "copyMasterBookToStudent" },
      error,
      { bookId, studentId, tenantId, code: error.code, hint: error.hint }
    );
    throw new Error(
      error.code === "42501"
        ? "RLS 정책 위반: 교재 복사 권한이 없습니다. Admin 클라이언트를 확인해주세요."
        : error.message || "교재 복사에 실패했습니다."
    );
  }

  // book_details도 함께 복사 (ID 매핑 생성)
  const { details } = await getMasterBookById(bookId);
  let detailIdMap: Map<string, string> | undefined;

  if (details.length > 0) {
    // display_order -> master detail id 매핑 (나중에 역매핑용)
    const displayOrderToMasterId = new Map(
      details.map((d) => [d.display_order, d.id])
    );

    const studentBookDetails = details.map((detail) => ({
      book_id: studentBook.id,
      major_unit: detail.major_unit,
      minor_unit: detail.minor_unit,
      page_number: detail.page_number,
      display_order: detail.display_order,
    }));

    if (!supabase) throw new Error("Supabase client uninitialized");

    const { data: insertedDetails, error: detailsError } = await supabase
      .from("student_book_details")
      .insert(studentBookDetails)
      .select("id, display_order");

    if (detailsError) {
      logActionError(
        { domain: "data", action: "copyMasterBookToStudent" },
        detailsError,
        { bookId: studentBook.id, code: detailsError.code, step: "book_details" }
      );
      // 상세 정보 복사 실패해도 교재는 복사됨
    } else if (insertedDetails && insertedDetails.length > 0) {
      // master detail id -> student detail id 매핑 생성
      detailIdMap = new Map();
      insertedDetails.forEach((studentDetail) => {
        const masterDetailId = displayOrderToMasterId.get(
          studentDetail.display_order
        );
        if (masterDetailId) {
          detailIdMap!.set(masterDetailId, studentDetail.id);
        }
      });
    }
  }

  return { bookId: studentBook.id, detailIdMap };
}

/**
 * 마스터 강의를 학생 강의로 복사
 * 주의: Admin 클라이언트를 사용하여 RLS 정책을 우회합니다.
 */
export async function copyMasterLectureToStudent(
  lectureId: string,
  studentId: string,
  tenantId: string
): Promise<{
  lectureId: string;
  episodeIdMap?: Map<string, string>; // masterEpisodeId -> studentEpisodeId
}> {
  // Admin 클라이언트 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error(
      "Admin 클라이언트를 생성할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY 환경 변수를 확인해주세요."
    );
  }

  const { lecture } = await getMasterLectureById(lectureId);
  if (!lecture) {
    throw new Error("강의를 찾을 수 없습니다.");
  }

  if (!supabase) throw new Error("Supabase client uninitialized");

  // 중복 체크: 같은 master_lecture_id를 가진 학생 강의가 이미 있는지 확인
  const { data: existingLecture } = await supabase
    .from("lectures")
    .select("id")
    .eq("student_id", studentId)
    .eq("master_lecture_id", lectureId) // 변경: master_content_id → master_lecture_id
    .maybeSingle();

  if (existingLecture) {
    // 이미 복사된 강의가 있으면 기존 ID와 함께 episode ID 매핑도 조회
    const { episodes: masterEpisodes } = await getMasterLectureById(lectureId);
    let episodeIdMap: Map<string, string> | undefined;

    if (masterEpisodes.length > 0) {
      // episode_number -> master episode id 매핑
      const episodeNumberToMasterId = new Map(
        masterEpisodes.map((ep) => [ep.episode_number, ep.id])
      );

      // 기존 학생 강의의 episodes 조회
      const { data: existingEpisodes } = await supabase
        .from("student_lecture_episodes")
        .select("id, episode_number")
        .eq("lecture_id", existingLecture.id);

      if (existingEpisodes && existingEpisodes.length > 0) {
        episodeIdMap = new Map();
        existingEpisodes.forEach((studentEp) => {
          const masterEpisodeId = episodeNumberToMasterId.get(studentEp.episode_number);
          if (masterEpisodeId) {
            episodeIdMap!.set(masterEpisodeId, studentEp.id);
          }
        });
      }
    }

    return { lectureId: existingLecture.id, episodeIdMap };
  }

  if (!supabase) throw new Error("Supabase client uninitialized");

  const { data: studentLecture, error } = await supabase
    .from("lectures")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      title: lecture.title,
      revision: lecture.revision,
      semester: null, // 마스터 콘텐츠에서 semester 필드 제거됨
      subject_category: lecture.subject_category,
      subject: lecture.subject,
      platform: lecture.platform_name, // 변경: platform → platform_name
      difficulty_level: lecture.difficulty_level,
      total_episodes: lecture.total_episodes, // 추가: 총 회차
      notes: lecture.notes,
      master_lecture_id: lectureId, // 변경: master_content_id → master_lecture_id
    })
    .select("id")
    .single();

  if (error) {
    logActionError(
      { domain: "data", action: "copyMasterLectureToStudent" },
      error,
      { lectureId, studentId, tenantId, code: error.code, hint: error.hint }
    );
    throw new Error(
      error.code === "42501"
        ? "RLS 정책 위반: 강의 복사 권한이 없습니다. Admin 클라이언트를 확인해주세요."
        : error.message || "강의 복사에 실패했습니다."
    );
  }

  // episodes도 함께 복사 (ID 매핑 생성)
  const { episodes } = await getMasterLectureById(lectureId);
  let episodeIdMap: Map<string, string> | undefined;

  if (episodes.length > 0) {
    // episode_number -> master episode id 매핑 (나중에 역매핑용)
    const episodeNumberToMasterId = new Map(
      episodes.map((ep) => [ep.episode_number, ep.id])
    );

    const studentEpisodes = episodes.map((episode) => ({
      lecture_id: studentLecture.id,
      episode_number: episode.episode_number,
      episode_title: episode.episode_title, // DB 컬럼명과 일치
      duration: episode.duration,
      display_order: episode.display_order,
    }));

    const { data: insertedEpisodes, error: episodesError } = await supabase
      .from("student_lecture_episodes")
      .insert(studentEpisodes)
      .select("id, episode_number");

    if (episodesError) {
      logActionError(
        { domain: "data", action: "copyMasterLectureToStudent" },
        episodesError,
        { lectureId: studentLecture.id, code: episodesError.code, step: "episodes" }
      );
      // episode 복사 실패해도 강의는 복사됨
    } else if (insertedEpisodes && insertedEpisodes.length > 0) {
      // master episode id -> student episode id 매핑 생성
      episodeIdMap = new Map();
      insertedEpisodes.forEach((studentEp) => {
        const masterEpisodeId = episodeNumberToMasterId.get(
          studentEp.episode_number
        );
        if (masterEpisodeId) {
          episodeIdMap!.set(masterEpisodeId, studentEp.id);
        }
      });
    }
  }

  // 마스터 강의에 연결된 교재가 있으면 복사하고 연결
  if (lecture.linked_book_id) {
    try {
      // 마스터 교재를 학생 교재로 복사
      const { bookId: studentBookId } = await copyMasterBookToStudent(
        lecture.linked_book_id,
        studentId,
        tenantId
      );

      // 학생 강의의 linked_book_id 업데이트
      const { error: updateError } = await supabase
        .from("lectures")
        .update({ linked_book_id: studentBookId })
        .eq("id", studentLecture.id);

      if (updateError) {
        logActionError(
          { domain: "data", action: "copyMasterLectureToStudent" },
          updateError,
          { lectureId: studentLecture.id, bookId: studentBookId, step: "link_book" }
        );
        // 교재 연결 실패해도 강의는 복사됨
      }
    } catch (error) {
      logActionError(
        { domain: "data", action: "copyMasterLectureToStudent" },
        error,
        { masterBookId: lecture.linked_book_id, lectureId: studentLecture.id, step: "copy_linked_book" }
      );
      // 교재 복사 실패해도 강의는 복사됨
    }
  }

  return { lectureId: studentLecture.id, episodeIdMap };
}

// ============================================
// 커스텀 콘텐츠 관련 함수
// ============================================

/**
 * 커스텀 콘텐츠 검색
 * @param filters 검색 필터
 * @param supabase Supabase 클라이언트 (선택적, 전달하지 않으면 일반 서버 클라이언트 사용)
 */
export async function searchMasterCustomContents(
  filters: MasterCustomContentFilters,
  supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ data: MasterCustomContent[]; total: number }> {
  const queryClient = supabase || (await createSupabaseServerClient());

  // 공통 쿼리 빌더 사용 (JOIN 포함)
  const result = await buildContentQuery<MasterCustomContent & { difficulty_levels?: Array<{ id: string; name: string }> | null }>(
    queryClient,
    "master_custom_contents",
    filters
  );

  // JOIN된 difficulty_levels 데이터를 difficulty_level 필드에 매핑
  const enrichedData = result.data.map((item) => {
    const difficultyLevel = extractJoinedData<{ id: string; name: string }>(
      item.difficulty_levels
    );
    return {
      ...item,
      difficulty_level: difficultyLevel?.name || item.difficulty_level || null,
    } as MasterCustomContent;
  });

  return {
    data: enrichedData,
    total: result.total,
  };
}

/**
 * 커스텀 콘텐츠 상세 조회
 */
export async function getMasterCustomContentById(
  contentId: string
): Promise<{ content: MasterCustomContent | null }> {
  const supabase = await createSupabaseServerClient();

  const result = await createTypedSingleQuery<MasterCustomContent & {
    difficulty_levels?: Array<{ id: string; name: string }> | null;
  }>(
    async () => {
      return await supabase
        .from("master_custom_contents")
        .select(
          `
      *,
      difficulty_levels:difficulty_level_id (
        id,
        name
      )
    `
        )
        .eq("id", contentId);
    },
    {
      context: "[data/contentMasters] getMasterCustomContentById",
      defaultValue: null,
    }
  );

  if (!result) {
    return {
      content: null,
    };
  }

  // JOIN된 데이터 처리
  const difficultyLevel = extractJoinedData<{ id: string; name: string }>(
    result.difficulty_levels
  );

  // difficulty_level을 JOIN된 name으로 덮어쓰기 (fallback: 기존 값)
  const content = {
    ...result,
    difficulty_level: difficultyLevel?.name || result.difficulty_level || null,
  } as MasterCustomContent;

  return {
    content,
  };
}

/**
 * 커스텀 콘텐츠 생성
 */
export async function createMasterCustomContent(
  data: Omit<MasterCustomContent, "id" | "created_at" | "updated_at">
): Promise<MasterCustomContent> {
  const supabase = await createSupabaseServerClient();

  const { data: content, error } = await supabase
    .from("master_custom_contents")
    .insert(data)
    .select("*")
    .single<MasterCustomContent>();

  if (error) {
    const normalizedError = normalizeError(error);
    logActionError(
      { domain: "data", action: "createMasterCustomContent" },
      normalizedError,
      { data: { ...data, notes: data.notes ? "[REDACTED]" : null } }
    );
    throw normalizedError;
  }

  return content;
}

/**
 * 커스텀 콘텐츠 수정
 */
export async function updateMasterCustomContent(
  contentId: string,
  updates: Partial<
    Omit<MasterCustomContent, "id" | "created_at" | "updated_at">
  >
): Promise<MasterCustomContent> {
  const supabase = await createSupabaseServerClient();

  const { data: content, error } = await supabase
    .from("master_custom_contents")
    .update(updates)
    .eq("id", contentId)
    .select("*")
    .single<MasterCustomContent>();

  if (error) {
    const normalizedError = normalizeError(error);
    logActionError(
      { domain: "data", action: "updateMasterCustomContent" },
      normalizedError,
      { contentId, updates: { ...updates, notes: updates.notes ? "[REDACTED]" : null } }
    );
    throw normalizedError;
  }

  return content;
}

/**
 * 커스텀 콘텐츠 삭제
 */
export async function deleteMasterCustomContent(
  contentId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("master_custom_contents")
    .delete()
    .eq("id", contentId);

  if (error) {
    const normalizedError = normalizeError(error);
    logActionError(
      { domain: "data", action: "deleteMasterCustomContent" },
      normalizedError,
      { contentId }
    );
    throw normalizedError;
  }
}

/**
 * 마스터 커스텀 콘텐츠를 학생 커스텀 콘텐츠로 복사
 * 주의: Admin 클라이언트를 사용하여 RLS 정책을 우회합니다.
 */
export async function copyMasterCustomContentToStudent(
  contentId: string,
  studentId: string,
  tenantId: string
): Promise<{ contentId: string }> {
  // Admin 클라이언트 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error(
      "Admin 클라이언트를 생성할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY 환경 변수를 확인해주세요."
    );
  }

  const { content } = await getMasterCustomContentById(contentId);
  if (!content) {
    throw new Error("커스텀 콘텐츠를 찾을 수 없습니다.");
  }

  // 중복 체크: 같은 master_content_id를 가진 학생 커스텀 콘텐츠가 이미 있는지 확인
  const { data: existingContent } = await supabase
    .from("student_custom_contents")
    .select("id")
    .eq("student_id", studentId)
    .eq("title", content.title) // 제목으로 중복 체크 (master_content_id가 없을 수 있음)
    .maybeSingle();

  if (existingContent) {
    // 이미 복사된 콘텐츠가 있으면 기존 ID 반환
    return { contentId: existingContent.id };
  }

  const { data: studentContent, error } = await supabase
    .from("student_custom_contents")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      title: content.title,
      content_type: content.content_type,
      total_page_or_time: content.total_page_or_time,
      subject: content.subject,
    })
    .select("id")
    .single();

  if (error) {
    logActionError(
      { domain: "data", action: "copyMasterCustomContentToStudent" },
      error,
      { contentId, studentId, tenantId, code: error.code, hint: error.hint }
    );
    throw new Error(
      error.code === "42501"
        ? "RLS 정책 위반: 커스텀 콘텐츠 복사 권한이 없습니다. Admin 클라이언트를 확인해주세요."
        : error.message || "커스텀 콘텐츠 복사에 실패했습니다."
    );
  }

  return { contentId: studentContent.id };
}

/**
 * 마스터 콘텐츠를 학생 콘텐츠로 복사 (하위 호환성)
 * @deprecated copyMasterBookToStudent, copyMasterLectureToStudent, copyMasterCustomContentToStudent 사용 권장
 * @param content_type 콘텐츠 타입 (선택사항, 없으면 자동 감지)
 */
export async function copyMasterToStudentContent(
  masterId: string,
  studentId: string,
  tenantId: string,
  content_type?: "book" | "lecture" | "custom"
): Promise<{ bookId?: string; lectureId?: string; contentId?: string }> {
  // content_type이 명시되어 있으면 해당 타입으로 직접 복사
  if (content_type === "book") {
    const result = await copyMasterBookToStudent(masterId, studentId, tenantId);
    return { bookId: result.bookId };
  } else if (content_type === "lecture") {
    const result = await copyMasterLectureToStudent(masterId, studentId, tenantId);
    return { lectureId: result.lectureId };
  } else if (content_type === "custom") {
    const result = await copyMasterCustomContentToStudent(masterId, studentId, tenantId);
    return { contentId: result.contentId };
  }

  // content_type이 없으면 자동 감지 (하위 호환성)
  // 먼저 교재에서 찾기
  try {
    const result = await copyMasterBookToStudent(masterId, studentId, tenantId);
    return { bookId: result.bookId };
  } catch {
    // 교재가 아니면 강의로 시도
    try {
      const result = await copyMasterLectureToStudent(
        masterId,
        studentId,
        tenantId
      );
      return { lectureId: result.lectureId };
    } catch {
      // 강의도 아니면 커스텀 콘텐츠로 시도
      const result = await copyMasterCustomContentToStudent(
        masterId,
        studentId,
        tenantId
      );
      return { contentId: result.contentId };
    }
  }
}

// ============================================
// 필터 옵션 조회 함수
// ============================================

/**
 * 개정교육과정 목록 조회 (필터 옵션용)
 */
export async function getCurriculumRevisions(): Promise<
  Array<{ id: string; name: string }>
> {
  // Admin 클라이언트 우선 사용 (RLS 우회), 없으면 일반 서버 클라이언트 사용
  const supabase = await getClientForRLSBypass();

  if (!supabase) {
    handleQueryError(null, {
      context: "[data/contentMasters] getCurriculumRevisions",
      logError: true,
    });
    return [];
  }

  const result = await createTypedQuery<Array<{ id: string; name: string }>>(
    async () => {
      return await supabase
        .from("curriculum_revisions")
        .select("id, name")
        .order("name", { ascending: true });
    },
    {
      context: "[data/contentMasters] getCurriculumRevisions",
      defaultValue: [],
    }
  );

  return result ?? [];
}

/**
 * 교과 목록 조회 (필터 옵션용)
 * @param curriculumRevisionId 개정교육과정 ID (선택사항)
 */
export async function getSubjectGroupsForFilter(
  curriculumRevisionId?: string
): Promise<SubjectGroup[]> {
  return await getSubjectGroups(curriculumRevisionId);
}

/**
 * 과목 목록 조회 (필터 옵션용)
 * @param subjectGroupId 교과 그룹 ID (선택사항, 없으면 모든 과목 조회)
 */
export async function getSubjectsForFilter(
  subjectGroupId?: string
): Promise<Subject[]> {
  if (!subjectGroupId) {
    // 모든 과목 조회 (성능 고려하여 제한)
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .order("name", { ascending: true })
      .limit(500); // 최대 500개 제한

    if (error) {
      logActionError({ domain: "data", action: "getSubjectsForFilter" }, error);
      return [];
    }

    return (data as Subject[] | null) ?? [];
  }

  return await getSubjectsByGroup(subjectGroupId);
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 과목 목록 조회 (교재)
 */
export async function getBookSubjectList(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("master_books")
    .select("subject")
    .not("subject", "is", null);

  if (error) {
    logActionError({ domain: "data", action: "getBookSubjectList" }, error);
    return [];
  }

  const subjects = Array.from(
    new Set((data || []).map((item) => item.subject).filter(Boolean))
  ).sort();

  return subjects as string[];
}

/**
 * 과목 목록 조회 (강의)
 */
export async function getLectureSubjectList(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("master_lectures")
    .select("subject")
    .not("subject", "is", null);

  if (error) {
    logActionError({ domain: "data", action: "getLectureSubjectList" }, error);
    return [];
  }

  const subjects = Array.from(
    new Set((data || []).map((item) => item.subject).filter(Boolean))
  ).sort();

  return subjects as string[];
}

/**
 * 과목 목록 조회 (하위 호환성)
 * @deprecated getBookSubjectList 또는 getLectureSubjectList 사용 권장
 */
export async function getSubjectList(
  content_type?: "book" | "lecture"
): Promise<string[]> {
  if (content_type === "book") {
    return getBookSubjectList();
  } else if (content_type === "lecture") {
    return getLectureSubjectList();
  } else {
    // 둘 다 조회
    const [books, lectures] = await Promise.all([
      getBookSubjectList(),
      getLectureSubjectList(),
    ]);
    return Array.from(new Set([...books, ...lectures])).sort();
  }
}

/**
 * 학기 목록 조회
 * @deprecated 학년/학기 필터는 더 이상 사용하지 않습니다.
 */
/**
 * 학기 목록 조회 (학생 콘텐츠용)
 * @deprecated 마스터 콘텐츠에서 semester 필드가 제거됨 (2025-02-04)
 * 학생 콘텐츠(books, lectures)에서만 사용 가능
 */
export async function getSemesterList(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  // 마스터 콘텐츠에서 semester 필드 제거됨
  // 학생 콘텐츠(books, lectures)에서만 조회
  const [booksResult, lecturesResult] = await Promise.all([
    supabase.from("books").select("semester").not("semester", "is", null),
    supabase.from("lectures").select("semester").not("semester", "is", null),
  ]);

  const allSemesters = [
    ...(booksResult.data || []).map(
      (item: { semester: string }) => item.semester
    ),
    ...(lecturesResult.data || []).map(
      (item: { semester: string }) => item.semester
    ),
  ];

  const semesters = Array.from(new Set(allSemesters.filter(Boolean))).sort();

  return semesters as string[];
}

/**
 * 출판사 목록 조회 (필터 옵션용)
 * master_books 테이블에서 실제로 사용된 publisher_id를 기반으로 조회
 * @param tenantId 테넌트 ID (선택적, 없으면 공개 콘텐츠만)
 */
export async function getPublishersForFilter(
  tenantId?: string | null
): Promise<Array<{ id: string; name: string }>> {
  const supabase = await getClientForRLSBypass();
  if (!supabase) return [];

  // master_books에서 실제로 사용된 publisher_id 조회
  let publisherQuery = supabase
    .from("master_books")
    .select("publisher_id")
    .not("publisher_id", "is", null);

  // tenantId가 있으면 해당 테넌트 + 공개 콘텐츠만, 없으면 공개 콘텐츠만
  if (tenantId) {
    publisherQuery = publisherQuery.or(
      `tenant_id.is.null,tenant_id.eq.${tenantId}`
    );
  } else {
    publisherQuery = publisherQuery.is("tenant_id", null);
  }

  const { data: booksData, error: booksError } = await publisherQuery;

  if (booksError) {
    logActionError({ domain: "data", action: "getPublishersForFilter" }, booksError, { step: "getPublisherIds" });
    return [];
  }

  // 사용된 publisher_id 추출 (중복 제거)
  const publisherIds = Array.from(
    new Set(
      (booksData || [])
        .map((book: { publisher_id: string | null }) => book.publisher_id)
        .filter((id): id is string => id !== null)
    )
  );

  if (publisherIds.length === 0) {
    return [];
  }

  // publishers 테이블에서 해당 출판사 정보 조회
  const { data, error } = await supabase
    .from("publishers")
    .select("id, name")
    .in("id", publisherIds)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    logActionError({ domain: "data", action: "getPublishersForFilter" }, error, { step: "getPublisherDetails" });
    return [];
  }

  return (data as Array<{ id: string; name: string }> | null) ?? [];
}

/**
 * 플랫폼 목록 조회 (필터 옵션용)
 * master_lectures 테이블에서 실제로 사용된 platform_id를 기반으로 조회
 * @param tenantId 테넌트 ID (선택적, 없으면 공개 콘텐츠만)
 */
export async function getPlatformsForFilter(
  tenantId?: string | null
): Promise<Array<{ id: string; name: string }>> {
  const supabase = await getClientForRLSBypass();
  if (!supabase) return [];

  // master_lectures에서 실제로 사용된 platform_id 조회

  let platformQuery = supabase
    .from("master_lectures")
    .select("platform_id")
    .not("platform_id", "is", null);

  // tenantId가 있으면 해당 테넌트 + 공개 콘텐츠만, 없으면 공개 콘텐츠만
  if (tenantId) {
    platformQuery = platformQuery.or(
      `tenant_id.is.null,tenant_id.eq.${tenantId}`
    );
  } else {
    platformQuery = platformQuery.is("tenant_id", null);
  }

  const { data: lecturesData, error: lecturesError } = await platformQuery;

  if (lecturesError) {
    logActionError({ domain: "data", action: "getPlatformsForFilter" }, lecturesError, { step: "getPlatformIds" });
    return [];
  }

  // 사용된 platform_id 추출 (중복 제거)
  const platformIds = Array.from(
    new Set(
      (lecturesData || [])
        .map((lecture: { platform_id: string | null }) => lecture.platform_id)
        .filter((id): id is string => id !== null)
    )
  );

  if (platformIds.length === 0) {
    return [];
  }

  // platforms 테이블에서 해당 플랫폼 정보 조회
  const { data, error } = await supabase
    .from("platforms")
    .select("id, name")
    .in("id", platformIds)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    logActionError({ domain: "data", action: "getPlatformsForFilter" }, error, { step: "getPlatformDetails" });
    return [];
  }

  return (data as Array<{ id: string; name: string }> | null) ?? [];
}

/**
 * 마스터 교재 난이도 목록 조회 (필터 옵션용)
 */
export async function getDifficultiesForMasterBooks(
  tenantId?: string | null
): Promise<string[]> {
  const supabase = await getClientForRLSBypass();

  if (!supabase) return [];
  let query = supabase
    .from("master_books")
    .select("difficulty_level")
    .not("difficulty_level", "is", null);

  // tenantId가 있으면 해당 테넌트 + 공개 콘텐츠만, 없으면 공개 콘텐츠만
  if (tenantId) {
    query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  } else {
    query = query.is("tenant_id", null);
  }

  const { data, error } = await query;

  if (error) {
    logActionError({ domain: "data", action: "getDifficultiesForMasterBooks" }, error);
    return [];
  }

  const difficulties = new Set<string>();
  (data ?? []).forEach((item: { difficulty_level: string | null }) => {
    if (item.difficulty_level) {
      difficulties.add(item.difficulty_level);
    }
  });

  return Array.from(difficulties).sort();
}

/**
 * 마스터 강의 난이도 목록 조회 (필터 옵션용)
 */
export async function getDifficultiesForMasterLectures(
  tenantId?: string | null
): Promise<string[]> {
  const supabase = await getClientForRLSBypass();

  if (!supabase) return [];
  let query = supabase
    .from("master_lectures")
    .select("difficulty_level")
    .not("difficulty_level", "is", null);

  // tenantId가 있으면 해당 테넌트 + 공개 콘텐츠만, 없으면 공개 콘텐츠만
  if (tenantId) {
    query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  } else {
    query = query.is("tenant_id", null);
  }

  const { data, error } = await query;

  if (error) {
    logActionError({ domain: "data", action: "getDifficultiesForMasterLectures" }, error);
    return [];
  }

  const difficulties = new Set<string>();
  (data ?? []).forEach((item: { difficulty_level: string | null }) => {
    if (item.difficulty_level) {
      difficulties.add(item.difficulty_level);
    }
  });

  return Array.from(difficulties).sort();
}

// ============================================
// CRUD 함수
// ============================================

/**
 * 교재 생성
 */
export async function createMasterBook(
  data: Omit<MasterBook, "id" | "created_at" | "updated_at">
): Promise<MasterBook> {
  const supabase = await createSupabaseServerClient();

  const { data: book, error } = await supabase
    .from("master_books")
    .insert({
      tenant_id: data.tenant_id,
      is_active: data.is_active,
      curriculum_revision_id: data.curriculum_revision_id,
      subject_id: data.subject_id,
      subject_group_id: data.subject_group_id,
      subject_category: data.subject_category,
      subject: data.subject,
      grade_min: data.grade_min,
      grade_max: data.grade_max,
      school_type: data.school_type,
      revision: data.revision,
      content_category: data.content_category,
      // semester 필드 제거됨 (2025-02-04)
      title: data.title,
      subtitle: data.subtitle,
      series_name: data.series_name,
      author: data.author,
      publisher_id: data.publisher_id,
      publisher_name: data.publisher_name,
      isbn_10: data.isbn_10,
      isbn_13: data.isbn_13,
      edition: data.edition,
      published_date: data.published_date,
      total_pages: data.total_pages,
      target_exam_type: data.target_exam_type,
      description: data.description,
      toc: data.toc,
      publisher_review: data.publisher_review,
      tags: data.tags,
      source: data.source,
      source_product_code: data.source_product_code,
      source_url: data.source_url,
      cover_image_url: data.cover_image_url,
      difficulty_level: data.difficulty_level, // @deprecated: difficulty_level_id 사용 권장
      difficulty_level_id: data.difficulty_level_id ?? null,
      notes: data.notes,
      pdf_url: data.pdf_url,
      ocr_data: data.ocr_data,
      page_analysis: data.page_analysis,
      overall_difficulty: data.overall_difficulty,
    })
    .select()
    .single();

  if (error) {
    logActionError({ domain: "data", action: "createMasterBook" }, error);
    throw new Error(error.message || "교재 생성에 실패했습니다.");
  }

  return book as MasterBook;
}

/**
 * 교재 수정
 */
export async function updateMasterBook(
  bookId: string,
  data: Partial<Omit<MasterBook, "id" | "created_at" | "updated_at">>
): Promise<MasterBook> {
  const supabase = await createSupabaseServerClient();

  // undefined 필드는 제외하고 실제 존재하는 필드만 업데이트
  const updateFields: Record<string, any> = {};

  if (data.tenant_id !== undefined) updateFields.tenant_id = data.tenant_id;
  if (data.is_active !== undefined) updateFields.is_active = data.is_active;
  if (data.curriculum_revision_id !== undefined)
    updateFields.curriculum_revision_id = data.curriculum_revision_id;
  if (data.subject_id !== undefined) updateFields.subject_id = data.subject_id;
  if (data.subject_group_id !== undefined)
    updateFields.subject_group_id = data.subject_group_id;
  if (data.subject_category !== undefined)
    updateFields.subject_category = data.subject_category;
  if (data.subject !== undefined) updateFields.subject = data.subject;
  if (data.grade_min !== undefined) updateFields.grade_min = data.grade_min;
  if (data.grade_max !== undefined) updateFields.grade_max = data.grade_max;
  if (data.school_type !== undefined)
    updateFields.school_type = data.school_type;
  if (data.revision !== undefined) updateFields.revision = data.revision;
  if (data.content_category !== undefined)
    updateFields.content_category = data.content_category;
  // semester 필드 제거됨 (2025-02-04)
  if (data.title !== undefined) updateFields.title = data.title;
  if (data.subtitle !== undefined) updateFields.subtitle = data.subtitle;
  if (data.series_name !== undefined)
    updateFields.series_name = data.series_name;
  if (data.author !== undefined) updateFields.author = data.author;
  if (data.publisher_id !== undefined)
    updateFields.publisher_id = data.publisher_id;
  if (data.publisher_name !== undefined)
    updateFields.publisher_name = data.publisher_name;
  if (data.isbn_10 !== undefined) updateFields.isbn_10 = data.isbn_10;
  if (data.isbn_13 !== undefined) updateFields.isbn_13 = data.isbn_13;
  if (data.edition !== undefined) updateFields.edition = data.edition;
  if (data.published_date !== undefined)
    updateFields.published_date = data.published_date;
  if (data.total_pages !== undefined)
    updateFields.total_pages = data.total_pages;
  if (data.target_exam_type !== undefined)
    updateFields.target_exam_type = data.target_exam_type;
  if (data.description !== undefined)
    updateFields.description = data.description;
  if (data.toc !== undefined) updateFields.toc = data.toc;
  if (data.publisher_review !== undefined)
    updateFields.publisher_review = data.publisher_review;
  if (data.tags !== undefined) updateFields.tags = data.tags;
  if (data.source !== undefined) updateFields.source = data.source;
  if (data.source_product_code !== undefined)
    updateFields.source_product_code = data.source_product_code;
  if (data.source_url !== undefined) updateFields.source_url = data.source_url;
  if (data.cover_image_url !== undefined)
    updateFields.cover_image_url = data.cover_image_url;
  if (data.difficulty_level !== undefined)
    updateFields.difficulty_level = data.difficulty_level; // @deprecated
  if (data.difficulty_level_id !== undefined)
    updateFields.difficulty_level_id = data.difficulty_level_id;
  if (data.notes !== undefined) updateFields.notes = data.notes;
  if (data.pdf_url !== undefined) updateFields.pdf_url = data.pdf_url;
  if (data.ocr_data !== undefined) updateFields.ocr_data = data.ocr_data;
  if (data.page_analysis !== undefined)
    updateFields.page_analysis = data.page_analysis;
  if (data.overall_difficulty !== undefined)
    updateFields.overall_difficulty = data.overall_difficulty;

  const { data: book, error } = await supabase
    .from("master_books")
    .update(updateFields)
    .eq("id", bookId)
    .select()
    .single();

  if (error) {
    logActionError({ domain: "data", action: "updateMasterBook" }, error, { bookId });
    throw new Error(error.message || "교재 수정에 실패했습니다.");
  }

  return book as MasterBook;
}

/**
 * 교재 삭제
 */
export async function deleteMasterBook(bookId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("master_books")
    .delete()
    .eq("id", bookId);

  if (error) {
    logActionError({ domain: "data", action: "deleteMasterBook" }, error, { bookId });
    throw new Error(error.message || "교재 삭제에 실패했습니다.");
  }
}

/**
 * 강의 생성
 */
export async function createMasterLecture(
  data: Omit<MasterLecture, "id" | "created_at" | "updated_at">
): Promise<MasterLecture> {
  const supabase = await createSupabaseServerClient();

  const { data: lecture, error } = await supabase
    .from("master_lectures")
    .insert({
      tenant_id: data.tenant_id,
      revision: data.revision,
      content_category: data.content_category,
      // semester 필드 제거됨 (2025-02-04)
      subject_category: data.subject_category,
      subject: data.subject,
      title: data.title,
      platform: data.platform,
      total_episodes: data.total_episodes,
      total_duration: data.total_duration,
      difficulty_level: data.difficulty_level, // @deprecated: difficulty_level_id 사용 권장
      difficulty_level_id: data.difficulty_level_id ?? null,
      notes: data.notes,
      linked_book_id: data.linked_book_id,
      video_url: data.video_url,
      lecture_source_url: data.lecture_source_url,
      transcript: data.transcript,
      episode_analysis: data.episode_analysis,
      overall_difficulty: data.overall_difficulty,
    })
    .select()
    .single();

  if (error) {
    logActionError({ domain: "data", action: "createMasterLecture" }, error);
    throw new Error(error.message || "강의 생성에 실패했습니다.");
  }

  return lecture as MasterLecture;
}

/**
 * 강의 수정
 */
export async function updateMasterLecture(
  lectureId: string,
  data: Partial<Omit<MasterLecture, "id" | "created_at" | "updated_at">>
): Promise<MasterLecture> {
  const supabase = await createSupabaseServerClient();

  // undefined 필드는 제외하고 실제 존재하는 필드만 업데이트
  const updateFields: Record<string, any> = {};

  if (data.tenant_id !== undefined) updateFields.tenant_id = data.tenant_id;
  // MasterLecture 타입에 정의된 필드들은 직접 접근
  if (data.curriculum_revision_id !== undefined)
    updateFields.curriculum_revision_id = data.curriculum_revision_id;
  if (data.subject_id !== undefined)
    updateFields.subject_id = data.subject_id;
  if (data.subject_group_id !== undefined)
    updateFields.subject_group_id = data.subject_group_id;
  // is_active는 MasterLecture 타입에 없으므로 타입 확장으로 처리
  if ('is_active' in data && data.is_active !== undefined)
    updateFields.is_active = data.is_active as boolean;
  if (data.revision !== undefined) updateFields.revision = data.revision;
  if (data.content_category !== undefined)
    updateFields.content_category = data.content_category;
  // semester 필드 제거됨 (2025-02-04)
  if (data.subject_category !== undefined)
    updateFields.subject_category = data.subject_category;
  if (data.subject !== undefined) updateFields.subject = data.subject;
  if (data.title !== undefined) updateFields.title = data.title;
  if (data.platform !== undefined) updateFields.platform = data.platform;
  if (data.platform_name !== undefined)
    updateFields.platform_name = data.platform_name;
  if (data.platform_id !== undefined)
    updateFields.platform_id = data.platform_id;
  if (data.total_episodes !== undefined)
    updateFields.total_episodes = data.total_episodes;
  if (data.total_duration !== undefined)
    updateFields.total_duration = data.total_duration;
  if (data.difficulty_level !== undefined)
    updateFields.difficulty_level = data.difficulty_level; // @deprecated
  if (data.difficulty_level_id !== undefined)
    updateFields.difficulty_level_id = data.difficulty_level_id;
  if (data.notes !== undefined) updateFields.notes = data.notes;
  if (data.linked_book_id !== undefined)
    updateFields.linked_book_id = data.linked_book_id;
  if (data.video_url !== undefined) updateFields.video_url = data.video_url;
  if (data.lecture_source_url !== undefined)
    updateFields.lecture_source_url = data.lecture_source_url;
  // cover_image_url은 DB에 컬럼이 없으므로 제외
  if (data.transcript !== undefined) updateFields.transcript = data.transcript;
  if (data.episode_analysis !== undefined)
    updateFields.episode_analysis = data.episode_analysis;
  if (data.overall_difficulty !== undefined)
    updateFields.overall_difficulty = data.overall_difficulty;
  if (data.instructor_name !== undefined)
    updateFields.instructor_name = data.instructor_name;
  if (data.grade_level !== undefined)
    updateFields.grade_level = data.grade_level;
  if (data.grade_min !== undefined) updateFields.grade_min = data.grade_min;
  if (data.grade_max !== undefined) updateFields.grade_max = data.grade_max;
  if (data.lecture_type !== undefined)
    updateFields.lecture_type = data.lecture_type;

  const { data: lecture, error } = await supabase
    .from("master_lectures")
    .update(updateFields)
    .eq("id", lectureId)
    .select()
    .single();

  if (error) {
    logActionError({ domain: "data", action: "updateMasterLecture" }, error, { lectureId });
    throw new Error(error.message || "강의 수정에 실패했습니다.");
  }

  return lecture as MasterLecture;
}

/**
 * 강의 삭제
 */
export async function deleteMasterLecture(lectureId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("master_lectures")
    .delete()
    .eq("id", lectureId);

  if (error) {
    logActionError({ domain: "data", action: "deleteMasterLecture" }, error, { lectureId });
    throw new Error(error.message || "강의 삭제에 실패했습니다.");
  }
}

// ============================================
// 교재 상세 정보 CRUD
// ============================================

/**
 * 교재 상세 정보 추가
 */
export async function createBookDetail(
  data: Omit<BookDetail, "id" | "created_at">
): Promise<BookDetail> {
  const supabase = await createSupabaseServerClient();

  const { data: detail, error } = await supabase
    .from("book_details")
    .insert({
      book_id: data.book_id,
      major_unit: data.major_unit,
      minor_unit: data.minor_unit,
      page_number: data.page_number,
      display_order: data.display_order,
    })
    .select()
    .single();

  if (error) {
    logActionError({ domain: "data", action: "createBookDetail" }, error, { bookId: data.book_id });
    throw new Error(error.message || "교재 상세 정보 추가에 실패했습니다.");
  }

  return detail as BookDetail;
}

/**
 * 교재 상세 정보 수정
 */
export async function updateBookDetail(
  detailId: string,
  data: Partial<Omit<BookDetail, "id" | "created_at">>
): Promise<BookDetail> {
  const supabase = await createSupabaseServerClient();

  const { data: detail, error } = await supabase
    .from("book_details")
    .update({
      major_unit: data.major_unit,
      minor_unit: data.minor_unit,
      page_number: data.page_number,
      display_order: data.display_order,
    })
    .eq("id", detailId)
    .select()
    .single();

  if (error) {
    logActionError({ domain: "data", action: "updateBookDetail" }, error, { detailId });
    throw new Error(error.message || "교재 상세 정보 수정에 실패했습니다.");
  }

  return detail as BookDetail;
}

/**
 * 교재 상세 정보 삭제
 */
export async function deleteBookDetail(detailId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("book_details")
    .delete()
    .eq("id", detailId);

  if (error) {
    logActionError({ domain: "data", action: "deleteBookDetail" }, error, { detailId });
    throw new Error(error.message || "교재 상세 정보 삭제에 실패했습니다.");
  }
}

/**
 * 교재의 모든 상세 정보 삭제
 */
export async function deleteAllBookDetails(bookId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("book_details")
    .delete()
    .eq("book_id", bookId);

  if (error) {
    logActionError({ domain: "data", action: "deleteAllBookDetails" }, error, { bookId });
    throw new Error(
      error.message || "교재 상세 정보 일괄 삭제에 실패했습니다."
    );
  }
}

// ============================================
// 강의 Episode 관련 함수
// ============================================

/**
 * 강의 episode 생성
 */
export async function createLectureEpisode(
  data: Omit<LectureEpisode, "id" | "created_at">
): Promise<LectureEpisode> {
  const supabase = await createSupabaseServerClient();

  const { data: episode, error } = await supabase
    .from("lecture_episodes")
    .insert({
      lecture_id: data.lecture_id,
      episode_number: data.episode_number,
      episode_title: data.episode_title || null, // 수정: title → episode_title (DB 스키마와 일치)
      duration: data.duration || null,
      display_order: data.display_order,
    })
    .select()
    .single();

  if (error) {
    logActionError({ domain: "data", action: "createLectureEpisode" }, error, { lectureId: data.lecture_id });
    throw new Error(error.message || "강의 episode 추가에 실패했습니다.");
  }

  return episode as LectureEpisode;
}

/**
 * 강의 episode 수정
 */
export async function updateLectureEpisode(
  episodeId: string,
  data: Partial<Omit<LectureEpisode, "id" | "created_at">>
): Promise<LectureEpisode> {
  const supabase = await createSupabaseServerClient();

  const updateFields: Record<string, unknown> = {};
  if (data.episode_number !== undefined)
    updateFields.episode_number = data.episode_number;
  if (data.episode_title !== undefined)
    updateFields.episode_title = data.episode_title; // 수정: title → episode_title
  if (data.duration !== undefined) updateFields.duration = data.duration;
  if (data.display_order !== undefined)
    updateFields.display_order = data.display_order;

  const { data: episode, error } = await supabase
    .from("lecture_episodes")
    .update(updateFields)
    .eq("id", episodeId)
    .select()
    .single();

  if (error) {
    logActionError({ domain: "data", action: "updateLectureEpisode" }, error, { episodeId });
    throw new Error(error.message || "강의 episode 수정에 실패했습니다.");
  }

  return episode as LectureEpisode;
}

/**
 * 강의 episode 삭제
 */
export async function deleteLectureEpisode(episodeId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("lecture_episodes")
    .delete()
    .eq("id", episodeId);

  if (error) {
    logActionError({ domain: "data", action: "deleteLectureEpisode" }, error, { episodeId });
    throw new Error(error.message || "강의 episode 삭제에 실패했습니다.");
  }
}

/**
 * 강의 episode 일괄 삭제
 */
export async function deleteAllLectureEpisodes(
  lectureId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("lecture_episodes")
    .delete()
    .eq("lecture_id", lectureId);

  if (error) {
    logActionError({ domain: "data", action: "deleteAllLectureEpisodes" }, error, { lectureId });
    throw new Error(error.message || "강의 episode 일괄 삭제에 실패했습니다.");
  }
}

// ============================================
// 학생 콘텐츠 상세 정보 조회
// ============================================

/**
 * 학생 교재의 상세 정보 조회 (student_book_details)
 * @param bookId 교재 ID
 * @param studentId 학생 ID (현재는 사용되지 않음)
 * @param supabaseClient 선택적 Supabase 클라이언트 (관리자/컨설턴트의 경우 Admin 클라이언트 전달 가능)
 */
export async function getStudentBookDetails(
  bookId: string,
  studentId: string,
  supabaseClient?: SupabaseClient
): Promise<
  Array<{
    id: string;
    page_number: number;
    major_unit: string | null;
    minor_unit: string | null;
  }>
> {
  const supabase = supabaseClient || await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_book_details")
    .select("id, page_number, major_unit, minor_unit")
    .eq("book_id", bookId)
    .order("page_number", { ascending: true });

  if (error) {
    logActionError({ domain: "data", action: "getStudentBookDetails" }, error, { bookId, studentId });
    return [];
  }

  return (
    (data as Array<{
      id: string;
      page_number: number;
      major_unit: string | null;
      minor_unit: string | null;
    }> | null) ?? []
  );
}

/**
 * 학생 강의의 episode 정보 조회 (student_lecture_episodes)
 * @param lectureId 강의 ID
 * @param studentId 학생 ID (현재는 사용되지 않음)
 * @param supabaseClient 선택적 Supabase 클라이언트 (관리자/컨설턴트의 경우 Admin 클라이언트 전달 가능)
 * @returns Episode 정보 배열 (episode_title 필드 사용)
 */
export async function getStudentLectureEpisodes(
  lectureId: string,
  studentId: string,
  supabaseClient?: SupabaseClient
): Promise<
  Array<{ id: string; episode_number: number; episode_title: string | null }>
> {
  const supabase = supabaseClient || await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_lecture_episodes")
    .select("id, episode_number, episode_title")
    .eq("lecture_id", lectureId)
    .order("episode_number", { ascending: true });

  if (error) {
    logActionError({ domain: "data", action: "getStudentLectureEpisodes" }, error, { lectureId, studentId });
    return [];
  }

  return (
    (data as Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
    }> | null) ?? []
  );
}

/**
 * 여러 교재의 상세 정보를 배치로 조회 (성능 최적화)
 * @param bookIds 조회할 교재 ID 배열
 * @param studentId 학생 ID
 * @returns Map<bookId, BookDetail[]> 형태로 반환
 */
export async function getStudentBookDetailsBatch(
  bookIds: string[],
  _studentId: string
): Promise<
  Map<
    string,
    Array<{
      id: string;
      page_number: number;
      major_unit: string | null;
      minor_unit: string | null;
    }>
  >
> {
  if (bookIds.length === 0) {
    return new Map();
  }

  // RLS 정책 우회를 위해 admin 클라이언트 사용
  // (admin이 학생 플랜을 볼 때 auth.uid()가 admin ID이므로 RLS가 차단됨)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    logActionError({ domain: "data", action: "getStudentBookDetailsBatch" }, new Error("admin 클라이언트 생성 실패"));
    return new Map();
  }

  // 성능 측정 시작
  const queryStart = performance.now();

  const { data, error } = await supabase
    .from("student_book_details")
    .select("id, book_id, page_number, major_unit, minor_unit")
    .in("book_id", bookIds)
    .order("book_id", { ascending: true })
    .order("page_number", { ascending: true });

  const queryTime = performance.now() - queryStart;

  if (error) {
    logActionError({ domain: "data", action: "getStudentBookDetailsBatch" }, error);
    return new Map();
  }

  // 결과를 bookId별로 그룹화하여 Map으로 반환 (최적화: push() 사용)
  const resultMap = new Map<
    string,
    Array<{
      id: string;
      page_number: number;
      major_unit: string | null;
      minor_unit: string | null;
    }>
  >();

  (data || []).forEach(
    (detail: {
      id: string;
      book_id: string;
      page_number: number;
      major_unit: string | null;
      minor_unit: string | null;
    }) => {
      if (!resultMap.has(detail.book_id)) {
        resultMap.set(detail.book_id, []);
      }
      resultMap.get(detail.book_id)!.push({
        id: detail.id,
        page_number: detail.page_number,
        major_unit: detail.major_unit,
        minor_unit: detail.minor_unit,
      });
    }
  );

  // 조회 결과가 없는 bookId들도 빈 배열로 초기화
  bookIds.forEach((bookId) => {
    if (!resultMap.has(bookId)) {
      resultMap.set(bookId, []);
    }
  });

  // 성능 로깅 (개발 환경에서만) - resultMap 생성 후 실행
  if (process.env.NODE_ENV === "development") {
    const resultCount = data?.length || 0;
    const emptyBookIds = bookIds.filter(
      (bookId) => !resultMap.has(bookId) || resultMap.get(bookId)!.length === 0
    );

    logActionDebug({ domain: "data", action: "getStudentBookDetailsBatch" }, "쿼리 성능", {
      bookCount: bookIds.length,
      resultCount,
      queryTime: `${queryTime.toFixed(2)}ms`,
      avgTimePerBook:
        bookIds.length > 0
          ? `${(queryTime / bookIds.length).toFixed(2)}ms`
          : "N/A",
      emptyBookCount: emptyBookIds.length,
      emptyBookIds: emptyBookIds.length > 0 ? emptyBookIds : undefined,
    });

    // 목차가 없는 교재가 있는 경우 추가 로깅
    if (emptyBookIds.length > 0) {
      logActionDebug({ domain: "data", action: "getStudentBookDetailsBatch" }, "목차가 없는 교재", {
        count: emptyBookIds.length,
        bookIds: emptyBookIds,
        reason:
          "student_book_details 테이블에 해당 교재의 목차 정보가 없습니다.",
      });
    }
  }

  return resultMap;
}

/**
 * 여러 강의의 episode 정보를 배치로 조회 (성능 최적화)
 * @param lectureIds 조회할 강의 ID 배열
 * @param studentId 학생 ID
 * @returns Map<lectureId, Episode[]> 형태로 반환
 */
export async function getStudentLectureEpisodesBatch(
  lectureIds: string[],
  studentId: string
): Promise<
  Map<
    string,
    Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }>
  >
> {
  if (lectureIds.length === 0) {
    return new Map();
  }

  // RLS 정책 우회를 위해 admin 클라이언트 사용
  // (admin이 학생 플랜을 볼 때 auth.uid()가 admin ID이므로 RLS가 차단됨)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    logActionError({ domain: "data", action: "getStudentLectureEpisodesBatch" }, new Error("admin 클라이언트 생성 실패"));
    return new Map();
  }

  // 성능 측정 시작
  const queryStart = performance.now();

  const { data, error } = await supabase
    .from("student_lecture_episodes")
    .select("id, lecture_id, episode_number, episode_title, duration")
    .in("lecture_id", lectureIds)
    .order("lecture_id", { ascending: true })
    .order("episode_number", { ascending: true });

  const queryTime = performance.now() - queryStart;

  if (error) {
    logActionError({ domain: "data", action: "getStudentLectureEpisodesBatch" }, error, { lectureIds, studentId });
    return new Map();
  }

  // 결과를 lectureId별로 그룹화하여 Map으로 반환 (최적화: push() 사용)
  const resultMap = new Map<
    string,
    Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }>
  >();

  (data || []).forEach(
    (episode: {
      id: string;
      lecture_id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }) => {
      if (!resultMap.has(episode.lecture_id)) {
        resultMap.set(episode.lecture_id, []);
      }
      resultMap.get(episode.lecture_id)!.push({
        id: episode.id,
        episode_number: episode.episode_number,
        episode_title: episode.episode_title,
        duration: episode.duration,
      });
    }
  );

  // 조회 결과가 없는 lectureId들 확인
  const emptyLectureIds = lectureIds.filter(
    (lectureId) =>
      !resultMap.has(lectureId) || resultMap.get(lectureId)!.length === 0
  );

  // 마스터 콘텐츠 fallback: student_lecture_episodes에 없는 경우 마스터 강의에서 조회
  if (emptyLectureIds.length > 0) {
    // 학생 강의의 master_lecture_id 및 master_content_id 조회
    const { data: studentLectures } = await supabase
      .from("lectures")
      .select("id, master_lecture_id, master_content_id")
      .in("id", emptyLectureIds)
      .eq("student_id", studentId);

    // ContentResolverService를 사용하여 마스터 ID 추출 (중복 제거됨)
    const masterLectureIds = extractMasterIds(studentLectures || [], "lecture");

    if (masterLectureIds.length > 0) {
      // 마스터 강의의 episodes 조회
      const { data: masterEpisodesData, error: masterError } = await supabase
        .from("lecture_episodes")
        .select("id, lecture_id, episode_number, episode_title, duration")
        .in("lecture_id", masterLectureIds)
        .order("lecture_id", { ascending: true })
        .order("episode_number", { ascending: true });

      if (masterError) {
        logActionError({ domain: "data", action: "getStudentLectureEpisodesBatch" }, masterError, { step: "masterFallback", masterLectureIds });
      } else if (masterEpisodesData && masterEpisodesData.length > 0) {
        // ContentResolverService를 사용하여 마스터 → 학생 ID 매핑 생성
        const masterToStudentMap = createMasterToStudentMap(
          studentLectures || [],
          "lecture"
        );

        // 마스터 episodes를 학생 강의 ID로 매핑하여 resultMap에 추가
        masterEpisodesData.forEach((ep) => {
          const studentLectureIds =
            masterToStudentMap.get(ep.lecture_id) || [];
          studentLectureIds.forEach((studentLectureId) => {
            if (!resultMap.has(studentLectureId)) {
              resultMap.set(studentLectureId, []);
            }
            resultMap.get(studentLectureId)!.push({
              id: ep.id,
              episode_number: ep.episode_number,
              episode_title: ep.episode_title,
              duration: ep.duration,
            });
          });
        });
      }
    }

    // 캠프 모드 직접 마스터 fallback: lectureIds가 이미 마스터 강의 ID인 경우
    // (캠프 모드에서는 plan_contents.start_detail_id/end_detail_id가 마스터 콘텐츠 ID를 직접 참조)
    const stillEmptyLectureIds = lectureIds.filter(
      (lectureId) =>
        !resultMap.has(lectureId) || resultMap.get(lectureId)!.length === 0
    );

    if (stillEmptyLectureIds.length > 0) {
      // lecture_episodes 테이블에서 직접 조회 (lectureIds가 마스터 강의 ID인 경우)
      const { data: directMasterData, error: directMasterError } =
        await supabase
          .from("lecture_episodes")
          .select("id, lecture_id, episode_number, episode_title, duration")
          .in("lecture_id", stillEmptyLectureIds)
          .order("lecture_id", { ascending: true })
          .order("episode_number", { ascending: true });

      if (directMasterError) {
        logActionError({ domain: "data", action: "getStudentLectureEpisodesBatch" }, directMasterError, { step: "campModeFallback", stillEmptyLectureIds });
      } else if (directMasterData && directMasterData.length > 0) {
        // 마스터 강의 ID를 그대로 키로 사용하여 resultMap에 추가
        directMasterData.forEach((ep) => {
          if (!resultMap.has(ep.lecture_id)) {
            resultMap.set(ep.lecture_id, []);
          }
          resultMap.get(ep.lecture_id)!.push({
            id: ep.id,
            episode_number: ep.episode_number,
            episode_title: ep.episode_title,
            duration: ep.duration,
          });
        });

        if (process.env.NODE_ENV === "development") {
          logActionDebug({ domain: "data", action: "getStudentLectureEpisodesBatch" }, "캠프 모드 직접 마스터 fallback 성공", {
            requestedIds: stillEmptyLectureIds,
            foundCount: directMasterData.length,
          });
        }
      }
    }

    // 여전히 조회 결과가 없는 lectureId들은 빈 배열로 초기화
    lectureIds.forEach((lectureId) => {
      if (!resultMap.has(lectureId)) {
        resultMap.set(lectureId, []);
      }
    });
  }

  // 성능 로깅 (개발 환경에서만) - resultMap 생성 후 실행
  if (process.env.NODE_ENV === "development") {
    const resultCount = data?.length || 0;
    const finalEmptyLectureIds = lectureIds.filter(
      (lectureId) =>
        !resultMap.has(lectureId) || resultMap.get(lectureId)!.length === 0
    );

    logActionDebug({ domain: "data", action: "getStudentLectureEpisodesBatch" }, "쿼리 성능", {
      lectureCount: lectureIds.length,
      resultCount,
      queryTime: `${queryTime.toFixed(2)}ms`,
      avgTimePerLecture:
        lectureIds.length > 0
          ? `${(queryTime / lectureIds.length).toFixed(2)}ms`
          : "N/A",
      emptyLectureCount: finalEmptyLectureIds.length,
      emptyLectureIds:
        finalEmptyLectureIds.length > 0 ? finalEmptyLectureIds : undefined,
      fallbackUsed: emptyLectureIds.length > 0,
    });

    // 회차가 없는 강의가 있는 경우 추가 로깅
    if (finalEmptyLectureIds.length > 0) {
      logActionDebug({ domain: "data", action: "getStudentLectureEpisodesBatch" }, "회차가 없는 강의", {
        count: finalEmptyLectureIds.length,
        lectureIds: finalEmptyLectureIds,
        reason:
          "student_lecture_episodes 및 lecture_episodes 테이블 모두에 해당 강의의 회차 정보가 없습니다.",
      });
    }
  }

  return resultMap;
}

/**
 * 여러 마스터 강의의 episode 정보를 배치로 조회 (성능 최적화)
 * @param masterLectureIds 조회할 마스터 강의 ID 배열
 * @returns Map<masterLectureId, Episode[]> 형태로 반환
 */
export async function getMasterLectureEpisodesBatch(
  masterLectureIds: string[]
): Promise<
  Map<
    string,
    Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }>
  >
> {
  if (masterLectureIds.length === 0) {
    return new Map();
  }

  const supabase = await createSupabaseServerClient();

  // 성능 측정 시작
  const queryStart = performance.now();

  const { data, error } = await supabase
    .from("lecture_episodes")
    .select("id, lecture_id, episode_number, episode_title, duration")
    .in("lecture_id", masterLectureIds)
    .order("lecture_id", { ascending: true })
    .order("episode_number", { ascending: true });

  const queryTime = performance.now() - queryStart;

  if (error) {
    logActionError({ domain: "data", action: "getMasterLectureEpisodesBatch" }, error, { masterLectureIds });
    return new Map();
  }

  // 결과를 lectureId별로 그룹화하여 Map으로 반환
  const resultMap = new Map<
    string,
    Array<{
      id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }>
  >();

  (data || []).forEach(
    (episode: {
      id: string;
      lecture_id: string;
      episode_number: number;
      episode_title: string | null;
      duration: number | null;
    }) => {
      if (!resultMap.has(episode.lecture_id)) {
        resultMap.set(episode.lecture_id, []);
      }
      resultMap.get(episode.lecture_id)!.push({
        id: episode.id,
        episode_number: episode.episode_number,
        episode_title: episode.episode_title,
        duration: episode.duration,
      });
    }
  );

  // 조회 결과가 없는 lectureId들도 빈 배열로 초기화
  masterLectureIds.forEach((lectureId) => {
    if (!resultMap.has(lectureId)) {
      resultMap.set(lectureId, []);
    }
  });

  // 성능 로깅 (개발 환경에서만)
  if (process.env.NODE_ENV === "development") {
    const resultCount = data?.length || 0;
    const emptyLectureIds = masterLectureIds.filter(
      (lectureId) =>
        !resultMap.has(lectureId) || resultMap.get(lectureId)!.length === 0
    );

    logActionDebug({ domain: "data", action: "getMasterLectureEpisodesBatch" }, "쿼리 성능", {
      lectureCount: masterLectureIds.length,
      resultCount,
      queryTime: `${queryTime.toFixed(2)}ms`,
      avgTimePerLecture:
        masterLectureIds.length > 0
          ? `${(queryTime / masterLectureIds.length).toFixed(2)}ms`
          : "N/A",
      emptyLectureCount: emptyLectureIds.length,
      emptyLectureIds: emptyLectureIds.length > 0 ? emptyLectureIds : undefined,
    });
  }

  return resultMap;
}

/**
 * 통합 Episode 조회 함수
 * 학생 강의 episode를 우선 조회하고, 없으면 마스터 강의 episode를 사용합니다.
 *
 * @param lectureId 학생 강의 ID
 * @param masterLectureId 마스터 강의 ID (선택사항, fallback용)
 * @param studentId 학생 ID (선택사항, 현재는 사용하지 않지만 향후 확장 가능)
 * @returns Episode 정보 배열 (episode_title 필드 사용)
 */
export async function getLectureEpisodesWithFallback(
  lectureId: string,
  masterLectureId: string | null | undefined,
  _studentId?: string
): Promise<
  Array<{
    id: string;
    lecture_id: string;
    episode_number: number;
    episode_title: string | null;
    duration: number | null;
    display_order: number;
    created_at: string;
  }>
> {
  const supabase = await createSupabaseServerClient();

  // 먼저 학생 강의 episode 조회
  const { data: studentEpisodes, error: studentError } = await supabase
    .from("student_lecture_episodes")
    .select(
      "id, episode_number, episode_title, duration, display_order, created_at"
    )
    .eq("lecture_id", lectureId)
    .order("display_order", { ascending: true })
    .order("episode_number", { ascending: true });

  if (studentError) {
    logActionError({ domain: "data", action: "getLectureEpisodesWithFallback" }, studentError, { lectureId, masterLectureId, step: "studentEpisodes" });
  }

  // 학생 강의 episode가 있으면 반환
  if (studentEpisodes && studentEpisodes.length > 0) {
    return studentEpisodes.map((e) => ({
      id: e.id,
      lecture_id: lectureId,
      episode_number: e.episode_number,
      episode_title: e.episode_title,
      duration: e.duration,
      display_order: e.display_order,
      created_at: e.created_at || "",
    }));
  }

  // 학생 강의 episode가 없고 마스터 강의 ID가 있으면 마스터에서 조회
  if (masterLectureId) {
    try {
      const { episodes } = await getMasterLectureById(masterLectureId);
      return episodes.map((e) => ({
        id: e.id,
        lecture_id: lectureId,
        episode_number: e.episode_number,
        episode_title: e.episode_title,
        duration: e.duration,
        display_order: e.display_order,
        created_at: e.created_at || "",
      }));
    } catch (err) {
      logActionError({ domain: "data", action: "getLectureEpisodesWithFallback" }, err, { lectureId, masterLectureId, step: "masterFallback" });
    }
  }

  // 둘 다 없으면 빈 배열 반환
  return [];
}
