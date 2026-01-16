import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { convertDifficultyLevelToId } from "@/lib/utils/difficultyLevelConverter";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// 책 타입
export type Book = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  title: string;
  revision?: string | null;
  semester?: string | null;
  subject_category?: string | null;
  subject?: string | null;
  publisher?: string | null;
  difficulty_level?: string | null; // @deprecated: difficulty_level_id 사용 권장
  difficulty_level_id?: string | null;
  total_pages?: number | null;
  notes?: string | null;
  cover_image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

// 강의 타입
export type Lecture = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  title: string;
  revision?: string | null;
  semester?: string | null;
  subject_category?: string | null;
  subject?: string | null;
  platform?: string | null;
  difficulty_level?: string | null; // @deprecated: difficulty_level_id 사용 권장
  difficulty_level_id?: string | null;
  duration?: number | null; // 분 단위
  total_episodes?: number | null; // 총 에피소드 수
  linked_book_id?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

// 커스텀 콘텐츠 타입
export type CustomContent = {
  id: string;
  tenant_id?: string | null;
  student_id: string;
  title: string;
  content_type?: string | null;
  total_page_or_time?: number | null;
  subject?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ContentFilters = {
  studentId: string;
  tenantId?: string | null;
  contentType?: "book" | "lecture" | "custom";
  subject?: string;
};

/**
 * 책 목록 조회
 */
export async function getBooks(
  studentId: string,
  tenantId?: string | null,
  filters?: { subject?: string }
): Promise<Book[]> {
  const supabase = await createSupabaseServerClient();

  const selectBooks = () =>
    supabase
      .from("books")
      .select("id,tenant_id,student_id,title,revision,semester,subject_category,subject,publisher,difficulty_level,total_pages,notes,created_at,updated_at")
      .eq("student_id", studentId);

  let query = selectBooks();

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (filters?.subject) {
    query = query.eq("subject", filters.subject);
  }

  query = query.order("created_at", { ascending: false });

  let { data, error } = await query;

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const fallbackQuery = supabase.from("books").select("*");

    if (filters?.subject) {
      fallbackQuery.eq("subject", filters.subject);
    }

    ({ data, error } = await fallbackQuery.order("created_at", { ascending: false }));
  }

  if (error) {
    logActionError({ domain: "data", action: "getBooks" }, error, { studentId });
    return [];
  }

  return (data as Book[] | null) ?? [];
}

/**
 * 강의 목록 조회
 */
export async function getLectures(
  studentId: string,
  tenantId?: string | null,
  filters?: { subject?: string }
): Promise<Lecture[]> {
  const supabase = await createSupabaseServerClient();

  const selectLectures = () =>
    supabase
      .from("lectures")
      .select("id,tenant_id,student_id,title,revision,semester,subject_category,subject,platform,difficulty_level,duration,notes,created_at,updated_at")
      .eq("student_id", studentId);

  let query = selectLectures();

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (filters?.subject) {
    query = query.eq("subject", filters.subject);
  }

  query = query.order("created_at", { ascending: false });

  let { data, error } = await query;

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const fallbackQuery = supabase.from("lectures").select("*");

    if (filters?.subject) {
      fallbackQuery.eq("subject", filters.subject);
    }

    ({ data, error } = await fallbackQuery.order("created_at", { ascending: false }));
  }

  if (error) {
    logActionError({ domain: "data", action: "getLectures" }, error, { studentId });
    return [];
  }

  return (data as Lecture[] | null) ?? [];
}

/**
 * 커스텀 콘텐츠 목록 조회
 */
export async function getCustomContents(
  studentId: string,
  tenantId?: string | null,
  filters?: { subject?: string }
): Promise<CustomContent[]> {
  const supabase = await createSupabaseServerClient();

  const selectCustom = () =>
    supabase
      .from("student_custom_contents")
      .select("id,tenant_id,student_id,title,content_type,total_page_or_time,subject,created_at,updated_at")
      .eq("student_id", studentId);

  let query = selectCustom();

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (filters?.subject) {
    query = query.eq("subject", filters.subject);
  }

  query = query.order("created_at", { ascending: false });

  let { data, error } = await query;

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const fallbackQuery = supabase.from("student_custom_contents").select("*");

    if (filters?.subject) {
      fallbackQuery.eq("subject", filters.subject);
    }

    ({ data, error } = await fallbackQuery.order("created_at", { ascending: false }));
  }

  if (error) {
    logActionError({ domain: "data", action: "getCustomContents" }, error, { studentId });
    return [];
  }

  return (data as CustomContent[] | null) ?? [];
}

/**
 * 책 생성
 */
export async function createBook(
  book: {
    tenant_id?: string | null;
    student_id: string;
    title: string;
    revision?: string | null;
    semester?: string | null;
    subject_category?: string | null;
    subject?: string | null;
    publisher?: string | null;
    difficulty_level?: string | null;
    difficulty_level_id?: string | null;
    total_pages?: number | null;
    notes?: string | null;
    cover_image_url?: string | null;
  }
): Promise<{ success: boolean; bookId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // difficulty_level_id가 없으면 difficulty_level 문자열을 변환
  let difficultyLevelId = book.difficulty_level_id;
  if (!difficultyLevelId && book.difficulty_level) {
    difficultyLevelId = await convertDifficultyLevelToId(supabase, book.difficulty_level, "book");
  }

  const payload = {
    tenant_id: book.tenant_id || null,
    student_id: book.student_id,
    title: book.title,
    revision: book.revision || null,
    semester: book.semester || null,
    subject_category: book.subject_category || null,
    subject: book.subject || null,
    publisher: book.publisher || null,
    difficulty_level: book.difficulty_level || null, // 하위 호환성 유지
    difficulty_level_id: difficultyLevelId || null,
    total_pages: book.total_pages || null,
    notes: book.notes || null,
    cover_image_url: book.cover_image_url || null,
  };

  let { data, error } = await supabase
    .from("books")
    .insert(payload)
    .select("id")
    .single();

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
    ({ data, error } = await supabase
      .from("books")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (error) {
    logActionError({ domain: "data", action: "createBook" }, error, { studentId: book.student_id });
    return { success: false, error: error.message };
  }

  return { success: true, bookId: data?.id };
}

/**
 * 강의 생성
 */
export async function createLecture(
  lecture: {
    tenant_id?: string | null;
    student_id: string;
    title: string;
    revision?: string | null;
    semester?: string | null;
    subject_category?: string | null;
    subject?: string | null;
    platform?: string | null;
    difficulty_level?: string | null;
    difficulty_level_id?: string | null;
    duration?: number | null;
    total_episodes?: number | null;
    linked_book_id?: string | null;
    notes?: string | null;
  }
): Promise<{ success: boolean; lectureId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // difficulty_level_id가 없으면 difficulty_level 문자열을 변환
  let difficultyLevelId = lecture.difficulty_level_id;
  if (!difficultyLevelId && lecture.difficulty_level) {
    difficultyLevelId = await convertDifficultyLevelToId(supabase, lecture.difficulty_level, "lecture");
  }

  const payload = {
    tenant_id: lecture.tenant_id || null,
    student_id: lecture.student_id,
    title: lecture.title,
    revision: lecture.revision || null,
    semester: lecture.semester || null,
    subject_category: lecture.subject_category || null,
    subject: lecture.subject || null,
    platform: lecture.platform || null,
    difficulty_level: lecture.difficulty_level || null, // 하위 호환성 유지
    difficulty_level_id: difficultyLevelId || null,
    duration: lecture.duration || null,
    total_episodes: lecture.total_episodes || null,
    linked_book_id: lecture.linked_book_id || null,
    notes: lecture.notes || null,
  };

  let { data, error } = await supabase
    .from("lectures")
    .insert(payload)
    .select("id")
    .single();

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
    ({ data, error } = await supabase
      .from("lectures")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (error) {
    logActionError({ domain: "data", action: "createLecture" }, error, { studentId: lecture.student_id });
    return { success: false, error: error.message };
  }

  return { success: true, lectureId: data?.id };
}

/**
 * 커스텀 콘텐츠 생성
 */
export async function createCustomContent(
  content: {
    tenant_id?: string | null;
    student_id: string;
    title: string;
    content_type?: string | null;
    total_page_or_time?: number | null;
    subject?: string | null;
  }
): Promise<{ success: boolean; contentId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload = {
    tenant_id: content.tenant_id || null,
    student_id: content.student_id,
    title: content.title,
    content_type: content.content_type || null,
    total_page_or_time: content.total_page_or_time || null,
    subject: content.subject || null,
  };

  let { data, error } = await supabase
    .from("student_custom_contents")
    .insert(payload)
    .select("id")
    .single();

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
    ({ data, error } = await supabase
      .from("student_custom_contents")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (error) {
    logActionError({ domain: "data", action: "createCustomContent" }, error, { studentId: content.student_id });
    return { success: false, error: error.message };
  }

  return { success: true, contentId: data?.id };
}

/**
 * 책 업데이트
 */
export async function updateBook(
  bookId: string,
  studentId: string,
  updates: Partial<Omit<Book, "id" | "student_id" | "created_at" | "updated_at">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, any> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.revision !== undefined) payload.revision = updates.revision;
  if (updates.semester !== undefined) payload.semester = updates.semester;
  if (updates.subject_category !== undefined) payload.subject_category = updates.subject_category;
  if (updates.subject !== undefined) payload.subject = updates.subject;
  if (updates.publisher !== undefined) payload.publisher = updates.publisher;
  // difficulty_level_id 우선 사용, 없으면 difficulty_level 문자열 변환
  if (updates.difficulty_level_id !== undefined) {
    payload.difficulty_level_id = updates.difficulty_level_id || null;
  } else if (updates.difficulty_level !== undefined) {
    payload.difficulty_level = updates.difficulty_level;
    // difficulty_level이 변경되면 difficulty_level_id도 업데이트
    if (updates.difficulty_level) {
      payload.difficulty_level_id = await convertDifficultyLevelToId(supabase, updates.difficulty_level, "book");
    } else {
      payload.difficulty_level_id = null;
    }
  }
  if (updates.total_pages !== undefined) payload.total_pages = updates.total_pages;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.cover_image_url !== undefined) payload.cover_image_url = updates.cover_image_url;

  let { error } = await supabase
    .from("books")
    .update(payload)
    .eq("id", bookId)
    .eq("student_id", studentId);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ error } = await supabase.from("books").update(payload).eq("id", bookId));
  }

  if (error) {
    logActionError({ domain: "data", action: "updateBook" }, error, { bookId, studentId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 강의 업데이트
 */
export async function updateLecture(
  lectureId: string,
  studentId: string,
  updates: Partial<Omit<Lecture, "id" | "student_id" | "created_at" | "updated_at">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, any> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.revision !== undefined) payload.revision = updates.revision;
  if (updates.semester !== undefined) payload.semester = updates.semester;
  if (updates.subject_category !== undefined) payload.subject_category = updates.subject_category;
  if (updates.subject !== undefined) payload.subject = updates.subject;
  if (updates.platform !== undefined) payload.platform = updates.platform;
  // difficulty_level_id 우선 사용, 없으면 difficulty_level 문자열 변환
  if (updates.difficulty_level_id !== undefined) {
    payload.difficulty_level_id = updates.difficulty_level_id || null;
  } else if (updates.difficulty_level !== undefined) {
    payload.difficulty_level = updates.difficulty_level;
    // difficulty_level이 변경되면 difficulty_level_id도 업데이트
    if (updates.difficulty_level) {
      payload.difficulty_level_id = await convertDifficultyLevelToId(supabase, updates.difficulty_level, "lecture");
    } else {
      payload.difficulty_level_id = null;
    }
  }
  if (updates.duration !== undefined) payload.duration = updates.duration;
  if (updates.total_episodes !== undefined) payload.total_episodes = updates.total_episodes;
  if (updates.linked_book_id !== undefined) payload.linked_book_id = updates.linked_book_id;
  if (updates.notes !== undefined) payload.notes = updates.notes;

  let { error } = await supabase
    .from("lectures")
    .update(payload)
    .eq("id", lectureId)
    .eq("student_id", studentId);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ error } = await supabase.from("lectures").update(payload).eq("id", lectureId));
  }

  if (error) {
    logActionError({ domain: "data", action: "updateLecture" }, error, { lectureId, studentId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 커스텀 콘텐츠 업데이트
 */
export async function updateCustomContent(
  contentId: string,
  studentId: string,
  updates: Partial<Omit<CustomContent, "id" | "student_id" | "created_at" | "updated_at">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, any> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.content_type !== undefined) payload.content_type = updates.content_type;
  if (updates.total_page_or_time !== undefined) payload.total_page_or_time = updates.total_page_or_time;
  if (updates.subject !== undefined) payload.subject = updates.subject;

  let { error } = await supabase
    .from("student_custom_contents")
    .update(payload)
    .eq("id", contentId)
    .eq("student_id", studentId);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ error } = await supabase
      .from("student_custom_contents")
      .update(payload)
      .eq("id", contentId));
  }

  if (error) {
    logActionError({ domain: "data", action: "updateCustomContent" }, error, { contentId, studentId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 책 삭제 (Hard Delete)
 * @deprecated softDeleteBook 사용 권장 (TOCTOU 방지)
 */
export async function deleteBook(
  bookId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  let { error } = await supabase
    .from("books")
    .delete()
    .eq("id", bookId)
    .eq("student_id", studentId);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ error } = await supabase.from("books").delete().eq("id", bookId));
  }

  if (error) {
    logActionError({ domain: "data", action: "deleteBook" }, error, { bookId, studentId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 책 Soft Delete (TOCTOU 방지)
 * is_active = false로 설정하여 삭제 표시
 * 참조 확인과 삭제 사이의 Race Condition에서도 데이터 무결성 유지
 */
export async function softDeleteBook(
  bookId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("books")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookId)
    .eq("student_id", studentId);

  if (error) {
    logActionError({ domain: "data", action: "softDeleteBook" }, error, { bookId, studentId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 강의 삭제
 */
export async function deleteLecture(
  lectureId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  let { error } = await supabase
    .from("lectures")
    .delete()
    .eq("id", lectureId)
    .eq("student_id", studentId);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ error } = await supabase.from("lectures").delete().eq("id", lectureId));
  }

  if (error) {
    logActionError({ domain: "data", action: "deleteLecture" }, error, { lectureId, studentId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 커스텀 콘텐츠 삭제
 */
export async function deleteCustomContent(
  contentId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  let { error } = await supabase
    .from("student_custom_contents")
    .delete()
    .eq("id", contentId)
    .eq("student_id", studentId);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    ({ error } = await supabase
      .from("student_custom_contents")
      .delete()
      .eq("id", contentId));
  }

  if (error) {
    logActionError({ domain: "data", action: "deleteCustomContent" }, error, { contentId, studentId });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * ID 배열로 콘텐츠를 병렬 조회 (공통 함수)
 * @param bookIds 책 ID 배열
 * @param lectureIds 강의 ID 배열
 * @param customIds 커스텀 콘텐츠 ID 배열
 * @param studentId 학생 ID
 * @param tenantId 테넌트 ID (선택)
 * @returns 조회된 콘텐츠 객체
 */
export async function getContentsByIds(
  bookIds: string[],
  lectureIds: string[],
  customIds: string[],
  studentId: string,
  tenantId?: string | null
): Promise<{
  books: Book[];
  lectures: Lecture[];
  customContents: CustomContent[];
}> {
  const supabase = await createSupabaseServerClient();
  
  // Defensive: Limit IN clause size to prevent extremely large queries
  const MAX_IN_CLAUSE_SIZE = 500;
  const safeBookIds = bookIds.slice(0, MAX_IN_CLAUSE_SIZE);
  const safeLectureIds = lectureIds.slice(0, MAX_IN_CLAUSE_SIZE);
  const safeCustomIds = customIds.slice(0, MAX_IN_CLAUSE_SIZE);

  if (bookIds.length > MAX_IN_CLAUSE_SIZE) {
    logActionDebug({ domain: "data", action: "getContentsByIds" }, `bookIds truncated from ${bookIds.length} to ${MAX_IN_CLAUSE_SIZE}`, { studentId });
  }
  if (lectureIds.length > MAX_IN_CLAUSE_SIZE) {
    logActionDebug({ domain: "data", action: "getContentsByIds" }, `lectureIds truncated from ${lectureIds.length} to ${MAX_IN_CLAUSE_SIZE}`, { studentId });
  }
  if (customIds.length > MAX_IN_CLAUSE_SIZE) {
    logActionDebug({ domain: "data", action: "getContentsByIds" }, `customIds truncated from ${customIds.length} to ${MAX_IN_CLAUSE_SIZE}`, { studentId });
  }

  // 병렬 조회
  const [booksResult, lecturesResult, customContentsResult] = await Promise.all([
    safeBookIds.length > 0
      ? (async () => {
          try {
            let query = supabase
              .from("books")
              .select("id,tenant_id,student_id,title,revision,semester,subject_category,subject,publisher,difficulty_level,total_pages,notes,created_at,updated_at")
              .eq("student_id", studentId)
              .in("id", safeBookIds);
            
            if (tenantId) {
              query = query.eq("tenant_id", tenantId);
            }
            
            const { data, error } = await query;
            if (error) {
              logActionError({ domain: "data", action: "getContentsByIds" }, error, { type: "books", studentId });
              return [];
            }
            return (data as Book[]) ?? [];
          } catch (err) {
            logActionError({ domain: "data", action: "getContentsByIds" }, err, { type: "books", studentId });
            return [];
          }
        })()
      : Promise.resolve([]),
    safeLectureIds.length > 0
      ? (async () => {
          try {
            let query = supabase
              .from("lectures")
              .select("id,tenant_id,student_id,title,revision,semester,subject_category,subject,platform,difficulty_level,duration,notes,created_at,updated_at")
              .eq("student_id", studentId)
              .in("id", safeLectureIds);

            if (tenantId) {
              query = query.eq("tenant_id", tenantId);
            }

            const { data, error } = await query;
            if (error) {
              logActionError({ domain: "data", action: "getContentsByIds" }, error, { type: "lectures", studentId });
              return [];
            }
            return (data as Lecture[]) ?? [];
          } catch (err) {
            logActionError({ domain: "data", action: "getContentsByIds" }, err, { type: "lectures", studentId });
            return [];
          }
        })()
      : Promise.resolve([]),
    safeCustomIds.length > 0
      ? (async () => {
          try {
            let query = supabase
              .from("student_custom_contents")
              .select("id,tenant_id,student_id,title,content_type,total_page_or_time,subject,created_at,updated_at")
              .eq("student_id", studentId)
              .in("id", safeCustomIds);

            if (tenantId) {
              query = query.eq("tenant_id", tenantId);
            }

            const { data, error } = await query;
            if (error) {
              logActionError({ domain: "data", action: "getContentsByIds" }, error, { type: "customContents", studentId });
              return [];
            }
            return (data as CustomContent[]) ?? [];
          } catch (err) {
            logActionError({ domain: "data", action: "getContentsByIds" }, err, { type: "customContents", studentId });
            return [];
          }
        })()
      : Promise.resolve([]),
  ]);

  return {
    books: booksResult,
    lectures: lecturesResult,
    customContents: customContentsResult,
  };
}

