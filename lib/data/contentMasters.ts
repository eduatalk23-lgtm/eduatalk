// 콘텐츠 마스터 데이터 액세스 레이어
// master_books, master_lectures 테이블 사용

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MasterBook, MasterLecture, BookDetail, LectureEpisode } from "@/lib/types/plan";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 교재 검색 필터
 */
export type MasterBookFilters = {
  subject?: string;
  subject_category?: string;
  semester?: string;
  revision?: string;
  search?: string; // 제목 검색
  tenantId?: string | null;
  limit?: number;
  offset?: number;
};

/**
 * 강의 검색 필터
 */
export type MasterLectureFilters = {
  subject?: string;
  subject_category?: string;
  semester?: string;
  revision?: string;
  search?: string; // 제목 검색
  tenantId?: string | null;
  limit?: number;
  offset?: number;
};

/**
 * 통합 검색 필터 (하위 호환성)
 */
export type ContentMasterFilters = {
  content_type?: "book" | "lecture";
  subject?: string;
  subject_category?: string;
  semester?: string;
  revision?: string;
  search?: string;
  tenantId?: string | null;
  limit?: number;
  offset?: number;
};

// ============================================
// 교재 관련 함수
// ============================================

/**
 * 교재 검색
 */
export async function searchMasterBooks(
  filters: MasterBookFilters
): Promise<{ data: MasterBook[]; total: number }> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("master_books")
    .select("*", { count: "exact" });

  // 필터 적용
  if (filters.subject) {
    query = query.eq("subject", filters.subject);
  }
  if (filters.subject_category) {
    query = query.eq("subject_category", filters.subject_category);
  }
  if (filters.semester) {
    query = query.eq("semester", filters.semester);
  }
  if (filters.revision) {
    query = query.eq("revision", filters.revision);
  }
  if (filters.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }
  if (filters.tenantId) {
    query = query.or(`tenant_id.is.null,tenant_id.eq.${filters.tenantId}`);
  } else {
    query = query.is("tenant_id", null); // 기본적으로 공개 콘텐츠만
  }

  // 정렬
  query = query.order("updated_at", { ascending: false });

  // 페이지네이션
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[data/contentMasters] 교재 검색 실패", error);
    throw new Error(error.message || "교재 검색에 실패했습니다.");
  }

  return {
    data: (data as MasterBook[] | null) ?? [],
    total: count ?? 0,
  };
}

/**
 * 마스터 교재 목록 조회 (드롭다운용)
 */
export async function getMasterBooksList(): Promise<Array<{ id: string; title: string }>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("master_books")
    .select("id, title")
    .order("title", { ascending: true });

  if (error) {
    console.error("[data/contentMasters] 교재 목록 조회 실패", error);
    return [];
  }

  return (data as Array<{ id: string; title: string }> | null) ?? [];
}

/**
 * 교재 상세 조회 (세부 정보 포함)
 */
export async function getMasterBookById(
  bookId: string
): Promise<{ book: MasterBook | null; details: BookDetail[] }> {
  const supabase = await createSupabaseServerClient();

  const [bookResult, detailsResult] = await Promise.all([
    supabase
      .from("master_books")
      .select("*")
      .eq("id", bookId)
      .maybeSingle<MasterBook>(),
    supabase
      .from("book_details")
      .select("*")
      .eq("book_id", bookId)
      .order("display_order", { ascending: true })
      .order("page_number", { ascending: true }),
  ]);

  if (bookResult.error) {
    console.error("[data/contentMasters] 교재 조회 실패", bookResult.error);
    throw new Error(bookResult.error.message || "교재 조회에 실패했습니다.");
  }

  if (detailsResult.error) {
    console.error("[data/contentMasters] 교재 세부 정보 조회 실패", detailsResult.error);
    // 세부 정보는 선택사항이므로 에러를 무시
  }

  return {
    book: bookResult.data,
    details: (detailsResult.data as BookDetail[] | null) ?? [],
  };
}

// ============================================
// 강의 관련 함수
// ============================================

/**
 * 강의 검색
 */
export async function searchMasterLectures(
  filters: MasterLectureFilters
): Promise<{ data: MasterLecture[]; total: number }> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("master_lectures")
    .select("*", { count: "exact" });

  // 필터 적용
  if (filters.subject) {
    query = query.eq("subject", filters.subject);
  }
  if (filters.subject_category) {
    query = query.eq("subject_category", filters.subject_category);
  }
  if (filters.semester) {
    query = query.eq("semester", filters.semester);
  }
  if (filters.revision) {
    query = query.eq("revision", filters.revision);
  }
  if (filters.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }
  if (filters.tenantId) {
    query = query.or(`tenant_id.is.null,tenant_id.eq.${filters.tenantId}`);
  } else {
    query = query.is("tenant_id", null); // 기본적으로 공개 콘텐츠만
  }

  // 정렬
  query = query.order("updated_at", { ascending: false });

  // 페이지네이션
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[data/contentMasters] 강의 검색 실패", error);
    throw new Error(error.message || "강의 검색에 실패했습니다.");
  }

  return {
    data: (data as MasterLecture[] | null) ?? [],
    total: count ?? 0,
  };
}

/**
 * 강의 상세 조회
 */
export async function getMasterLectureById(
  lectureId: string
): Promise<{ lecture: MasterLecture | null; episodes: LectureEpisode[] }> {
  const supabase = await createSupabaseServerClient();

  const [lectureResult, episodesResult] = await Promise.all([
    supabase
      .from("master_lectures")
      .select("*")
      .eq("id", lectureId)
      .maybeSingle<MasterLecture>(),
    supabase
      .from("lecture_episodes")
      .select("*")
      .eq("lecture_id", lectureId)
      .order("display_order", { ascending: true })
      .order("episode_number", { ascending: true }),
  ]);

  if (lectureResult.error) {
    console.error("[data/contentMasters] 강의 조회 실패", lectureResult.error);
    throw new Error(lectureResult.error.message || "강의 조회에 실패했습니다.");
  }

  if (episodesResult.error) {
    console.error("[data/contentMasters] 강의 episode 조회 실패", episodesResult.error);
    // episode는 선택사항이므로 에러를 무시
  }

  return {
    lecture: lectureResult.data,
    episodes: (episodesResult.data as LectureEpisode[] | null) ?? [],
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
): Promise<{ data: any[]; total: number }> {
  if (filters.content_type === "book") {
    const result = await searchMasterBooks(filters);
    return { data: result.data, total: result.total };
  } else if (filters.content_type === "lecture") {
    const result = await searchMasterLectures(filters);
    return { data: result.data, total: result.total };
  } else {
    // 둘 다 검색
    const [booksResult, lecturesResult] = await Promise.all([
      searchMasterBooks(filters),
      searchMasterLectures(filters),
    ]);
    return {
      data: [...booksResult.data, ...lecturesResult.data],
      total: booksResult.total + lecturesResult.total,
    };
  }
}

/**
 * 콘텐츠 마스터 상세 조회 (하위 호환성)
 * @deprecated getMasterBookById 또는 getMasterLectureById 사용 권장
 */
export async function getContentMasterById(
  masterId: string
): Promise<{ master: any | null; details: BookDetail[] }> {
  const supabase = await createSupabaseServerClient();

  // 먼저 교재에서 찾기
  const bookResult = await getMasterBookById(masterId);
  if (bookResult.book) {
    return {
      master: bookResult.book,
      details: bookResult.details,
    };
  }

  // 강의에서 찾기
  const { lecture, episodes } = await getMasterLectureById(masterId);
  if (lecture) {
    return {
      master: lecture,
      details: [], // 강의는 세부 정보 없음 (episodes는 별도)
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
): Promise<{ bookId: string }> {
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
    .eq("master_content_id", bookId)
    .maybeSingle();

  if (existingBook) {
    // 이미 복사된 교재가 있으면 기존 ID 반환
    return { bookId: existingBook.id };
  }

  const { data: studentBook, error } = await supabase
    .from("books")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      title: book.title,
      revision: book.revision,
      semester: book.semester,
      subject_category: book.subject_category,
      subject: book.subject,
      publisher: book.publisher,
      difficulty_level: book.difficulty_level,
      total_pages: book.total_pages,
      notes: book.notes,
      master_content_id: bookId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[data/contentMasters] 교재 복사 실패", {
      bookId,
      studentId,
      tenantId,
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(
      error.code === "42501"
        ? "RLS 정책 위반: 교재 복사 권한이 없습니다. Admin 클라이언트를 확인해주세요."
        : error.message || "교재 복사에 실패했습니다."
    );
  }

  // book_details도 함께 복사
  const { details } = await getMasterBookById(bookId);
  if (details.length > 0) {
    const studentBookDetails = details.map((detail) => ({
      book_id: studentBook.id,
      major_unit: detail.major_unit,
      minor_unit: detail.minor_unit,
      page_number: detail.page_number,
      display_order: detail.display_order,
    }));

    const { error: detailsError } = await supabase
      .from("student_book_details")
      .insert(studentBookDetails);

    if (detailsError) {
      console.error("[data/contentMasters] 교재 상세 정보 복사 실패", {
        bookId: studentBook.id,
        error: detailsError.message,
        code: detailsError.code,
      });
      // 상세 정보 복사 실패해도 교재는 복사됨
    }
  }

  return { bookId: studentBook.id };
}

/**
 * 마스터 강의를 학생 강의로 복사
 * 주의: Admin 클라이언트를 사용하여 RLS 정책을 우회합니다.
 */
export async function copyMasterLectureToStudent(
  lectureId: string,
  studentId: string,
  tenantId: string
): Promise<{ lectureId: string }> {
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

  // 중복 체크: 같은 master_content_id를 가진 학생 강의가 이미 있는지 확인
  const { data: existingLecture } = await supabase
    .from("lectures")
    .select("id")
    .eq("student_id", studentId)
    .eq("master_content_id", lectureId)
    .maybeSingle();

  if (existingLecture) {
    // 이미 복사된 강의가 있으면 기존 ID 반환
    return { lectureId: existingLecture.id };
  }

  const { data: studentLecture, error } = await supabase
    .from("lectures")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      title: lecture.title,
      revision: lecture.revision,
      semester: lecture.semester,
      subject_category: lecture.subject_category,
      subject: lecture.subject,
      platform: lecture.platform,
      difficulty_level: lecture.difficulty_level,
      duration: lecture.total_duration, // 총 시간을 duration으로
      notes: lecture.notes,
      master_content_id: lectureId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[data/contentMasters] 강의 복사 실패", {
      lectureId,
      studentId,
      tenantId,
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(
      error.code === "42501"
        ? "RLS 정책 위반: 강의 복사 권한이 없습니다. Admin 클라이언트를 확인해주세요."
        : error.message || "강의 복사에 실패했습니다."
    );
  }

  // episodes도 함께 복사
  const { episodes } = await getMasterLectureById(lectureId);
  if (episodes.length > 0) {
    const studentEpisodes = episodes.map((episode) => ({
      lecture_id: studentLecture.id,
      episode_number: episode.episode_number,
      episode_title: episode.episode_title,
      duration: episode.duration,
      display_order: episode.display_order,
    }));

    const { error: episodesError } = await supabase
      .from("student_lecture_episodes")
      .insert(studentEpisodes);

    if (episodesError) {
      console.error("[data/contentMasters] 강의 episode 복사 실패", {
        lectureId: studentLecture.id,
        error: episodesError.message,
        code: episodesError.code,
      });
      // episode 복사 실패해도 강의는 복사됨
    }
  }

  return { lectureId: studentLecture.id };
}

/**
 * 마스터 콘텐츠를 학생 콘텐츠로 복사 (하위 호환성)
 * @deprecated copyMasterBookToStudent 또는 copyMasterLectureToStudent 사용 권장
 */
export async function copyMasterToStudentContent(
  masterId: string,
  studentId: string,
  tenantId: string
): Promise<{ bookId?: string; lectureId?: string }> {
  // 먼저 교재에서 찾기
  try {
    const result = await copyMasterBookToStudent(masterId, studentId, tenantId);
    return { bookId: result.bookId };
  } catch (error) {
    // 교재가 아니면 강의로 시도
    const result = await copyMasterLectureToStudent(masterId, studentId, tenantId);
    return { lectureId: result.lectureId };
  }
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
    console.error("[data/contentMasters] 교재 과목 목록 조회 실패", error);
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
    console.error("[data/contentMasters] 강의 과목 목록 조회 실패", error);
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
 */
export async function getSemesterList(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const [booksResult, lecturesResult] = await Promise.all([
    supabase.from("master_books").select("semester").not("semester", "is", null),
    supabase.from("master_lectures").select("semester").not("semester", "is", null),
  ]);

  const allSemesters = [
    ...(booksResult.data || []).map((item) => item.semester),
    ...(lecturesResult.data || []).map((item) => item.semester),
  ];

  const semesters = Array.from(new Set(allSemesters.filter(Boolean))).sort();

  return semesters as string[];
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
      revision: data.revision,
      content_category: data.content_category,
      semester: data.semester,
      subject_category: data.subject_category,
      subject: data.subject,
      title: data.title,
      publisher: data.publisher,
      total_pages: data.total_pages,
      difficulty_level: data.difficulty_level,
      notes: data.notes,
      pdf_url: data.pdf_url,
      ocr_data: data.ocr_data,
      page_analysis: data.page_analysis,
      overall_difficulty: data.overall_difficulty,
    })
    .select()
    .single();

  if (error) {
    console.error("[data/contentMasters] 교재 생성 실패", error);
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

  const { data: book, error } = await supabase
    .from("master_books")
    .update({
      revision: data.revision,
      content_category: data.content_category,
      semester: data.semester,
      subject_category: data.subject_category,
      subject: data.subject,
      title: data.title,
      publisher: data.publisher,
      total_pages: data.total_pages,
      difficulty_level: data.difficulty_level,
      notes: data.notes,
      pdf_url: data.pdf_url,
      ocr_data: data.ocr_data,
      page_analysis: data.page_analysis,
      overall_difficulty: data.overall_difficulty,
    })
    .eq("id", bookId)
    .select()
    .single();

  if (error) {
    console.error("[data/contentMasters] 교재 수정 실패", error);
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
    console.error("[data/contentMasters] 교재 삭제 실패", error);
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
      semester: data.semester,
      subject_category: data.subject_category,
      subject: data.subject,
      title: data.title,
      platform: data.platform,
      total_episodes: data.total_episodes,
      total_duration: data.total_duration,
      difficulty_level: data.difficulty_level,
      notes: data.notes,
      linked_book_id: data.linked_book_id,
      video_url: data.video_url,
      transcript: data.transcript,
      episode_analysis: data.episode_analysis,
      overall_difficulty: data.overall_difficulty,
    })
    .select()
    .single();

  if (error) {
    console.error("[data/contentMasters] 강의 생성 실패", error);
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

  const { data: lecture, error } = await supabase
    .from("master_lectures")
    .update({
      revision: data.revision,
      content_category: data.content_category,
      semester: data.semester,
      subject_category: data.subject_category,
      subject: data.subject,
      title: data.title,
      platform: data.platform,
      total_episodes: data.total_episodes,
      total_duration: data.total_duration,
      difficulty_level: data.difficulty_level,
      notes: data.notes,
      linked_book_id: data.linked_book_id,
      video_url: data.video_url,
      transcript: data.transcript,
      episode_analysis: data.episode_analysis,
      overall_difficulty: data.overall_difficulty,
    })
    .eq("id", lectureId)
    .select()
    .single();

  if (error) {
    console.error("[data/contentMasters] 강의 수정 실패", error);
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
    console.error("[data/contentMasters] 강의 삭제 실패", error);
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
    console.error("[data/contentMasters] 교재 상세 정보 추가 실패", error);
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
    console.error("[data/contentMasters] 교재 상세 정보 수정 실패", error);
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
    console.error("[data/contentMasters] 교재 상세 정보 삭제 실패", error);
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
    console.error("[data/contentMasters] 교재 상세 정보 일괄 삭제 실패", error);
    throw new Error(error.message || "교재 상세 정보 일괄 삭제에 실패했습니다.");
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
      episode_title: data.episode_title || null,
      duration: data.duration || null,
      display_order: data.display_order,
    })
    .select()
    .single();

  if (error) {
    console.error("[data/contentMasters] 강의 episode 추가 실패", error);
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

  const { data: episode, error } = await supabase
    .from("lecture_episodes")
    .update({
      episode_number: data.episode_number,
      episode_title: data.episode_title,
      duration: data.duration,
      display_order: data.display_order,
    })
    .eq("id", episodeId)
    .select()
    .single();

  if (error) {
    console.error("[data/contentMasters] 강의 episode 수정 실패", error);
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
    console.error("[data/contentMasters] 강의 episode 삭제 실패", error);
    throw new Error(error.message || "강의 episode 삭제에 실패했습니다.");
  }
}

/**
 * 강의 episode 일괄 삭제
 */
export async function deleteAllLectureEpisodes(lectureId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("lecture_episodes")
    .delete()
    .eq("lecture_id", lectureId);

  if (error) {
    console.error("[data/contentMasters] 강의 episode 일괄 삭제 실패", error);
    throw new Error(error.message || "강의 episode 일괄 삭제에 실패했습니다.");
  }
}

// ============================================
// 학생 콘텐츠 상세 정보 조회
// ============================================

/**
 * 학생 교재의 상세 정보 조회 (student_book_details)
 */
export async function getStudentBookDetails(
  bookId: string,
  studentId: string
): Promise<Array<{ id: string; page_number: number; major_unit: string | null; minor_unit: string | null }>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_book_details")
    .select("id, page_number, major_unit, minor_unit")
    .eq("book_id", bookId)
    .order("page_number", { ascending: true });

  if (error) {
    console.error("[data/contentMasters] 학생 교재 상세 정보 조회 실패", error);
    return [];
  }

  return (data as Array<{ id: string; page_number: number; major_unit: string | null; minor_unit: string | null }> | null) ?? [];
}

/**
 * 학생 강의의 episode 정보 조회 (student_lecture_episodes)
 */
export async function getStudentLectureEpisodes(
  lectureId: string,
  studentId: string
): Promise<Array<{ id: string; episode_number: number; episode_title: string | null }>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_lecture_episodes")
    .select("id, episode_number, episode_title")
    .eq("lecture_id", lectureId)
    .order("episode_number", { ascending: true });

  if (error) {
    console.error("[data/contentMasters] 학생 강의 episode 조회 실패", error);
    return [];
  }

  return (data as Array<{ id: string; episode_number: number; episode_title: string | null }> | null) ?? [];
}