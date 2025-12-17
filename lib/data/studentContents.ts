import { createSupabaseServerClient } from "@/lib/supabase/server";
import { POSTGRES_ERROR_CODES } from "@/lib/constants/errorCodes";

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
  difficulty_level?: string | null;
  total_pages?: number | null;
  notes?: string | null;
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
  difficulty_level?: string | null;
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

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const fallbackQuery = supabase.from("books").select("*");

    if (filters?.subject) {
      fallbackQuery.eq("subject", filters.subject);
    }

    ({ data, error } = await fallbackQuery.order("created_at", { ascending: false }));
  }

  if (error) {
    console.error("[data/studentContents] 책 조회 실패", error);
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

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const fallbackQuery = supabase.from("lectures").select("*");

    if (filters?.subject) {
      fallbackQuery.eq("subject", filters.subject);
    }

    ({ data, error } = await fallbackQuery.order("created_at", { ascending: false }));
  }

  if (error) {
    console.error("[data/studentContents] 강의 조회 실패", error);
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

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const fallbackQuery = supabase.from("student_custom_contents").select("*");

    if (filters?.subject) {
      fallbackQuery.eq("subject", filters.subject);
    }

    ({ data, error } = await fallbackQuery.order("created_at", { ascending: false }));
  }

  if (error) {
    console.error("[data/studentContents] 커스텀 콘텐츠 조회 실패", error);
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
    total_pages?: number | null;
    notes?: string | null;
  }
): Promise<{ success: boolean; bookId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload = {
    tenant_id: book.tenant_id || null,
    student_id: book.student_id,
    title: book.title,
    revision: book.revision || null,
    semester: book.semester || null,
    subject_category: book.subject_category || null,
    subject: book.subject || null,
    publisher: book.publisher || null,
    difficulty_level: book.difficulty_level || null,
    total_pages: book.total_pages || null,
    notes: book.notes || null,
  };

  let { data, error } = await supabase
    .from("books")
    .insert(payload)
    .select("id")
    .single();

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
    ({ data, error } = await supabase
      .from("books")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (error) {
    console.error("[data/studentContents] 책 생성 실패", error);
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
    duration?: number | null;
    linked_book_id?: string | null;
    notes?: string | null;
  }
): Promise<{ success: boolean; lectureId?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const payload = {
    tenant_id: lecture.tenant_id || null,
    student_id: lecture.student_id,
    title: lecture.title,
    revision: lecture.revision || null,
    semester: lecture.semester || null,
    subject_category: lecture.subject_category || null,
    subject: lecture.subject || null,
    platform: lecture.platform || null,
    difficulty_level: lecture.difficulty_level || null,
    duration: lecture.duration || null,
    linked_book_id: lecture.linked_book_id || null,
    notes: lecture.notes || null,
  };

  let { data, error } = await supabase
    .from("lectures")
    .insert(payload)
    .select("id")
    .single();

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
    ({ data, error } = await supabase
      .from("lectures")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (error) {
    console.error("[data/studentContents] 강의 생성 실패", error);
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

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    // fallback: tenant_id, student_id 컬럼이 없는 경우
    const { tenant_id: _tenantId, student_id: _studentId, ...fallbackPayload } = payload;
    ({ data, error } = await supabase
      .from("student_custom_contents")
      .insert(fallbackPayload)
      .select("id")
      .single());
  }

  if (error) {
    console.error("[data/studentContents] 커스텀 콘텐츠 생성 실패", error);
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
  if (updates.difficulty_level !== undefined) payload.difficulty_level = updates.difficulty_level;
  if (updates.total_pages !== undefined) payload.total_pages = updates.total_pages;
  if (updates.notes !== undefined) payload.notes = updates.notes;

  let { error } = await supabase
    .from("books")
    .update(payload)
    .eq("id", bookId)
    .eq("student_id", studentId);

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    ({ error } = await supabase.from("books").update(payload).eq("id", bookId));
  }

  if (error) {
    console.error("[data/studentContents] 책 업데이트 실패", error);
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
  if (updates.difficulty_level !== undefined) payload.difficulty_level = updates.difficulty_level;
  if (updates.duration !== undefined) payload.duration = updates.duration;
  if (updates.total_episodes !== undefined) payload.total_episodes = updates.total_episodes;
  if (updates.linked_book_id !== undefined) payload.linked_book_id = updates.linked_book_id;
  if (updates.notes !== undefined) payload.notes = updates.notes;

  let { error } = await supabase
    .from("lectures")
    .update(payload)
    .eq("id", lectureId)
    .eq("student_id", studentId);

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    ({ error } = await supabase.from("lectures").update(payload).eq("id", lectureId));
  }

  if (error) {
    console.error("[data/studentContents] 강의 업데이트 실패", error);
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

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    ({ error } = await supabase
      .from("student_custom_contents")
      .update(payload)
      .eq("id", contentId));
  }

  if (error) {
    console.error("[data/studentContents] 커스텀 콘텐츠 업데이트 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 책 삭제
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

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    ({ error } = await supabase.from("books").delete().eq("id", bookId));
  }

  if (error) {
    console.error("[data/studentContents] 책 삭제 실패", error);
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

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    ({ error } = await supabase.from("lectures").delete().eq("id", lectureId));
  }

  if (error) {
    console.error("[data/studentContents] 강의 삭제 실패", error);
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

  if (error && error.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
    ({ error } = await supabase
      .from("student_custom_contents")
      .delete()
      .eq("id", contentId));
  }

  if (error) {
    console.error("[data/studentContents] 커스텀 콘텐츠 삭제 실패", error);
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
    console.warn(`[data/studentContents] bookIds truncated from ${bookIds.length} to ${MAX_IN_CLAUSE_SIZE}`);
  }
  if (lectureIds.length > MAX_IN_CLAUSE_SIZE) {
    console.warn(`[data/studentContents] lectureIds truncated from ${lectureIds.length} to ${MAX_IN_CLAUSE_SIZE}`);
  }
  if (customIds.length > MAX_IN_CLAUSE_SIZE) {
    console.warn(`[data/studentContents] customIds truncated from ${customIds.length} to ${MAX_IN_CLAUSE_SIZE}`);
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
              console.error("[data/studentContents] 책 조회 실패", error);
              return [];
            }
            return (data as Book[]) ?? [];
          } catch (err) {
            console.error("[data/studentContents] 책 조회 예외", err);
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
              console.error("[data/studentContents] 강의 조회 실패", error);
              return [];
            }
            return (data as Lecture[]) ?? [];
          } catch (err) {
            console.error("[data/studentContents] 강의 조회 예외", err);
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
              console.error("[data/studentContents] 커스텀 콘텐츠 조회 실패", error);
              return [];
            }
            return (data as CustomContent[]) ?? [];
          } catch (err) {
            console.error("[data/studentContents] 커스텀 콘텐츠 조회 예외", err);
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

