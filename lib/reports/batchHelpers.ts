import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 여러 콘텐츠의 과목 정보를 배치로 조회
 * N+1 쿼리 문제를 해결하기 위한 헬퍼 함수
 */
export async function getSubjectsForContentsBatch(
  supabase: SupabaseServerClient,
  studentId: string,
  contentKeys: Array<{ contentType: "book" | "lecture" | "custom"; contentId: string }>
): Promise<Map<string, string | null>> {
  const subjectMap = new Map<string, string | null>();

  if (contentKeys.length === 0) {
    return subjectMap;
  }

  // 콘텐츠 타입별로 분류
  const bookIds: string[] = [];
  const lectureIds: string[] = [];
  const customIds: string[] = [];

  contentKeys.forEach(({ contentType, contentId }) => {
    if (contentType === "book") {
      bookIds.push(contentId);
    } else if (contentType === "lecture") {
      lectureIds.push(contentId);
    } else {
      customIds.push(contentId);
    }
  });

  // 배치로 조회
  const [booksResult, lecturesResult, customResult] = await Promise.all([
    bookIds.length > 0
      ? supabase
          .from("books")
          .select("id,subject")
          .eq("student_id", studentId)
          .in("id", bookIds)
      : Promise.resolve({ data: [], error: null }),
    lectureIds.length > 0
      ? supabase
          .from("lectures")
          .select("id,subject")
          .eq("student_id", studentId)
          .in("id", lectureIds)
      : Promise.resolve({ data: [], error: null }),
    customIds.length > 0
      ? supabase
          .from("student_custom_contents")
          .select("id,subject")
          .eq("student_id", studentId)
          .in("id", customIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // 결과 매핑
  (booksResult.data ?? []).forEach((book: { id: string; subject?: string | null }) => {
    subjectMap.set(`book:${book.id}`, book.subject ?? null);
  });

  (lecturesResult.data ?? []).forEach((lecture: { id: string; subject?: string | null }) => {
    subjectMap.set(`lecture:${lecture.id}`, lecture.subject ?? null);
  });

  (customResult.data ?? []).forEach((custom: { id: string; subject?: string | null }) => {
    subjectMap.set(`custom:${custom.id}`, custom.subject ?? null);
  });

  return subjectMap;
}

/**
 * 여러 플랜의 콘텐츠 정보를 배치로 조회
 */
export async function getPlansContentBatch(
  supabase: SupabaseServerClient,
  studentId: string,
  planIds: string[]
): Promise<Map<string, { contentType: "book" | "lecture" | "custom"; contentId: string }>> {
  const planMap = new Map<string, { contentType: "book" | "lecture" | "custom"; contentId: string }>();

  if (planIds.length === 0) {
    return planMap;
  }

  const selectPlans = () =>
    supabase
      .from("student_plan")
      .select("id,content_type,content_id")
      .eq("student_id", studentId)
      .in("id", planIds);

  let { data: plans, error } = await selectPlans();

  if (error && error.code === "42703") {
    ({ data: plans, error } = await selectPlans());
  }

  if (error || !plans) {
    console.error("[batchHelpers] 플랜 조회 실패", error);
    return planMap;
  }

  plans.forEach((plan: { id: string; content_type?: string | null; content_id?: string | null }) => {
    if (plan.content_type && plan.content_id) {
      planMap.set(plan.id, {
        contentType: plan.content_type as "book" | "lecture" | "custom",
        contentId: plan.content_id,
      });
    }
  });

  return planMap;
}

/**
 * 여러 콘텐츠의 제목을 배치로 조회
 */
export async function getContentTitlesBatch(
  supabase: SupabaseServerClient,
  studentId: string,
  contentKeys: Array<{ contentType: "book" | "lecture" | "custom"; contentId: string }>
): Promise<Map<string, string>> {
  const titleMap = new Map<string, string>();

  if (contentKeys.length === 0) {
    return titleMap;
  }

  // 콘텐츠 타입별로 분류
  const bookIds: string[] = [];
  const lectureIds: string[] = [];
  const customIds: string[] = [];

  contentKeys.forEach(({ contentType, contentId }) => {
    if (contentType === "book") {
      bookIds.push(contentId);
    } else if (contentType === "lecture") {
      lectureIds.push(contentId);
    } else {
      customIds.push(contentId);
    }
  });

  // 배치로 조회
  const [booksResult, lecturesResult, customResult] = await Promise.all([
    bookIds.length > 0
      ? supabase
          .from("books")
          .select("id,title")
          .eq("student_id", studentId)
          .in("id", bookIds)
      : Promise.resolve({ data: [], error: null }),
    lectureIds.length > 0
      ? supabase
          .from("lectures")
          .select("id,title")
          .eq("student_id", studentId)
          .in("id", lectureIds)
      : Promise.resolve({ data: [], error: null }),
    customIds.length > 0
      ? supabase
          .from("student_custom_contents")
          .select("id,title")
          .eq("student_id", studentId)
          .in("id", customIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // 결과 매핑
  (booksResult.data ?? []).forEach((book: { id: string; title?: string | null }) => {
    titleMap.set(`book:${book.id}`, book.title ?? "제목 없음");
  });

  (lecturesResult.data ?? []).forEach((lecture: { id: string; title?: string | null }) => {
    titleMap.set(`lecture:${lecture.id}`, lecture.title ?? "제목 없음");
  });

  (customResult.data ?? []).forEach((custom: { id: string; title?: string | null }) => {
    titleMap.set(`custom:${custom.id}`, custom.title ?? "제목 없음");
  });

  return titleMap;
}

