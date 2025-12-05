// 플랜 콘텐츠 데이터 액세스 레이어

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PlanContent } from "@/lib/types/plan";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 콘텐츠 아이템 타입
 */
export type ContentItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  master_content_id?: string | null;
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
      .select("id, title, subject, master_content_id")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (
      data?.map((book) => ({
        id: book.id,
        title: book.title || "제목 없음",
        subtitle: book.subject || null,
        master_content_id: book.master_content_id || null,
      })) || []
    );
  } catch (err) {
    console.error("[data/planContents] 책 목록 조회 실패", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      studentId,
    });
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
      .select("id, title, subject, master_content_id")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (
      data?.map((lecture) => ({
        id: lecture.id,
        title: lecture.title || "제목 없음",
        subtitle: lecture.subject || null,
        master_content_id: lecture.master_content_id || null,
      })) || []
    );
  } catch (err) {
    console.error("[data/planContents] 강의 목록 조회 실패", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      studentId,
    });
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
    console.error("[data/planContents] 커스텀 콘텐츠 목록 조회 실패", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      studentId,
    });
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
 * @param options 선택적 옵션 (관리자/컨설턴트 권한 관련)
 * @returns 분류된 콘텐츠 목록
 */
export async function classifyPlanContents(
  contents: Array<{
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    master_content_id?: string | null; // 마스터 콘텐츠 ID (plan_contents에서 조회한 값)
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
  studentId: string,
  options?: {
    currentUserRole?: "student" | "admin" | "consultant" | "parent";
    currentUserId?: string;
  }
): Promise<{
  studentContents: Array<ContentDetail>;
  recommendedContents: Array<ContentDetail>;
}> {
  // 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때는 Admin 클라이언트 사용 (RLS 우회)
  const isAdminOrConsultant = options?.currentUserRole === "admin" || options?.currentUserRole === "consultant";
  const isOtherStudent = isAdminOrConsultant && options?.currentUserId && studentId !== options.currentUserId;
  
  let supabase: SupabaseServerClient;
  let isUsingAdminClient = false;
  if (isOtherStudent) {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.warn("[classifyPlanContents] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용", {
        studentId,
        currentUserId: options?.currentUserId,
        currentUserRole: options?.currentUserRole,
      });
      supabase = await createSupabaseServerClient();
    } else {
      supabase = adminClient as any; // Admin 클라이언트를 SupabaseServerClient 타입으로 사용
      isUsingAdminClient = true;
      if (process.env.NODE_ENV === "development") {
        console.log("[classifyPlanContents] Admin 클라이언트 사용 (RLS 우회)", {
          studentId,
          currentUserId: options?.currentUserId,
          currentUserRole: options?.currentUserRole,
        });
      }
    }
  } else {
    supabase = await createSupabaseServerClient();
  }

  // 디버깅: 입력 데이터 로그
  if (process.env.NODE_ENV === "development") {
    console.log("[classifyPlanContents] 입력 데이터:", {
      contentsCount: contents.length,
      studentId,
      contents: contents.map((c) => ({
        content_type: c.content_type,
        content_id: c.content_id,
        start_range: c.start_range,
        end_range: c.end_range,
      })),
    });
  }

  // 1. 모든 콘텐츠 ID 및 마스터 콘텐츠 ID 수집 (배치 조회를 위해)
  const bookContentIds: string[] = [];
  const lectureContentIds: string[] = [];
  const customContentIds: string[] = [];
  const masterBookIds: string[] = [];
  const masterLectureIds: string[] = [];

  contents.forEach((content) => {
    if (content.content_type === "book") {
      bookContentIds.push(content.content_id);
      // plan_contents에 저장된 master_content_id가 있으면 마스터 콘텐츠 ID로도 수집
      if (content.master_content_id) {
        masterBookIds.push(content.master_content_id);
      }
      // content_id 자체가 마스터 콘텐츠 ID일 수 있으므로 마스터 콘텐츠 조회 대상에 포함
      // (중복 제거는 Set을 사용하지 않고 배열에 push 후 나중에 조회 시 처리)
      masterBookIds.push(content.content_id);
    } else if (content.content_type === "lecture") {
      lectureContentIds.push(content.content_id);
      // plan_contents에 저장된 master_content_id가 있으면 마스터 콘텐츠 ID로도 수집
      if (content.master_content_id) {
        masterLectureIds.push(content.master_content_id);
      }
      // content_id 자체가 마스터 콘텐츠 ID일 수 있으므로 마스터 콘텐츠 조회 대상에 포함
      masterLectureIds.push(content.content_id);
    } else if (content.content_type === "custom") {
      customContentIds.push(content.content_id);
    }
  });

  // 중복 제거
  const uniqueMasterBookIds = [...new Set(masterBookIds)];
  const uniqueMasterLectureIds = [...new Set(masterLectureIds)];

  if (process.env.NODE_ENV === "development") {
    console.log("[classifyPlanContents] 콘텐츠 ID 분류:", {
      bookCount: bookContentIds.length,
      lectureCount: lectureContentIds.length,
      customCount: customContentIds.length,
      bookIds: bookContentIds,
      lectureIds: lectureContentIds,
      customIds: customContentIds,
    });
  }

  // 2. 배치 조회 (N+1 문제 해결)
  // plan_contents.master_content_id를 우선 활용하여 마스터 콘텐츠 조회
  // content_id 자체가 마스터 콘텐츠 ID일 수 있으므로 마스터 콘텐츠 조회 대상에 포함
  const [
    masterBooksResult,
    masterLecturesResult,
    studentBooksResult,
    studentLecturesResult,
    customContentsResult,
  ] = await Promise.all([
    // 마스터 콘텐츠 조회 (plan_contents.master_content_id + content_id)
    uniqueMasterBookIds.length > 0
      ? supabase
          .from("master_books")
          .select("id, title, subject_category, subject")
          .in("id", uniqueMasterBookIds)
      : Promise.resolve({ data: [], error: null }),
    uniqueMasterLectureIds.length > 0
      ? supabase
          .from("master_lectures")
          .select("id, title, subject_category, subject")
          .in("id", uniqueMasterLectureIds)
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

  // 디버깅: 조회 결과 로그
  if (process.env.NODE_ENV === "development") {
    console.log("[classifyPlanContents] 조회 결과:", {
      isUsingAdminClient,
      isAdminOrConsultant,
      isOtherStudent,
      masterBooks: {
        count: masterBooksResult.data?.length || 0,
        ids: masterBooksResult.data?.map((b) => b.id) || [],
        error: masterBooksResult.error?.message || null,
      },
      masterLectures: {
        count: masterLecturesResult.data?.length || 0,
        ids: masterLecturesResult.data?.map((l) => l.id) || [],
        error: masterLecturesResult.error?.message || null,
      },
      studentBooks: {
        count: studentBooksResult.data?.length || 0,
        ids: studentBooksResult.data?.map((b) => b.id) || [],
        masterContentIds: studentBooksResult.data?.map((b) => b.master_content_id).filter(Boolean) || [],
        error: studentBooksResult.error?.message || null,
        queryParams: {
          studentId,
          bookContentIds,
          searchedIds: bookContentIds,
        },
      },
      studentLectures: {
        count: studentLecturesResult.data?.length || 0,
        ids: studentLecturesResult.data?.map((l) => l.id) || [],
        masterContentIds: studentLecturesResult.data?.map((l) => l.master_content_id).filter(Boolean) || [],
        error: studentLecturesResult.error?.message || null,
      },
      customContents: {
        count: customContentsResult.data?.length || 0,
        ids: customContentsResult.data?.map((c) => c.id) || [],
        error: customContentsResult.error?.message || null,
      },
    });
  }

  // 관리자 모드에서 조회 실패 시 경고 로그
  if (isAdminOrConsultant && isOtherStudent) {
    const hasErrors = 
      studentBooksResult.error || 
      studentLecturesResult.error || 
      customContentsResult.error;
    
    if (hasErrors) {
      console.warn("[classifyPlanContents] 관리자 모드에서 콘텐츠 조회 중 에러 발생:", {
        studentId,
        currentUserId: options?.currentUserId,
        currentUserRole: options?.currentUserRole,
        isUsingAdminClient,
        errors: {
          studentBooks: studentBooksResult.error ? {
            message: studentBooksResult.error.message,
            code: studentBooksResult.error.code,
          } : null,
          studentLectures: studentLecturesResult.error ? {
            message: studentLecturesResult.error.message,
            code: studentLecturesResult.error.code,
          } : null,
          customContents: customContentsResult.error ? {
            message: customContentsResult.error.message,
            code: customContentsResult.error.code,
          } : null,
        },
      });
    }

    // 조회된 콘텐츠 개수가 예상보다 적을 때 경고
    const expectedBookCount = bookContentIds.length;
    const actualBookCount = studentBooksResult.data?.length || 0;
    const expectedLectureCount = lectureContentIds.length;
    const actualLectureCount = studentLecturesResult.data?.length || 0;
    const expectedCustomCount = customContentIds.length;
    const actualCustomCount = customContentsResult.data?.length || 0;

    if (
      (expectedBookCount > 0 && actualBookCount < expectedBookCount) ||
      (expectedLectureCount > 0 && actualLectureCount < expectedLectureCount) ||
      (expectedCustomCount > 0 && actualCustomCount < expectedCustomCount)
    ) {
      console.warn("[classifyPlanContents] 관리자 모드에서 일부 콘텐츠를 찾을 수 없음:", {
        studentId,
        isUsingAdminClient,
        books: { expected: expectedBookCount, actual: actualBookCount },
        lectures: { expected: expectedLectureCount, actual: actualLectureCount },
        custom: { expected: expectedCustomCount, actual: actualCustomCount },
        searchedBookIds: bookContentIds,
        foundBookIds: studentBooksResult.data?.map((b) => b.id) || [],
        searchedLectureIds: lectureContentIds,
        foundLectureIds: studentLecturesResult.data?.map((l) => l.id) || [],
        searchedCustomIds: customContentIds,
        foundCustomIds: customContentsResult.data?.map((c) => c.id) || [],
      });
    }
  }

  // 3. Map으로 변환 (빠른 조회)
  // 마스터 콘텐츠 Map (plan_contents.master_content_id로 조회한 결과)
  const masterBooksMap = new Map(
    (masterBooksResult.data || []).map((book) => [book.id, book])
  );
  const masterLecturesMap = new Map(
    (masterLecturesResult.data || []).map((lecture) => [lecture.id, lecture])
  );
  // 학생 콘텐츠 Map
  const studentBooksMap = new Map(
    (studentBooksResult.data || []).map((book) => [book.id, book])
  );
  const studentLecturesMap = new Map(
    (studentLecturesResult.data || []).map((lecture) => [lecture.id, lecture])
  );
  const customContentsMap = new Map(
    (customContentsResult.data || []).map((custom) => [custom.id, custom])
  );
  
  // 학생 콘텐츠의 master_content_id도 수집 (추가 마스터 콘텐츠 조회용)
  const additionalMasterBookIds = new Set<string>();
  const additionalMasterLectureIds = new Set<string>();
  [...studentBooksMap.values()].forEach((book) => {
    if (book.master_content_id && !masterBookIds.includes(book.master_content_id)) {
      additionalMasterBookIds.add(book.master_content_id);
    }
  });
  [...studentLecturesMap.values()].forEach((lecture) => {
    if (lecture.master_content_id && !masterLectureIds.includes(lecture.master_content_id)) {
      additionalMasterLectureIds.add(lecture.master_content_id);
    }
  });
  
  // 추가 마스터 콘텐츠 조회 (학생 콘텐츠의 master_content_id)
  const [additionalMasterBooksResult, additionalMasterLecturesResult] =
    await Promise.all([
      additionalMasterBookIds.size > 0
        ? supabase
            .from("master_books")
            .select("id, title, subject_category, subject")
            .in("id", Array.from(additionalMasterBookIds))
        : Promise.resolve({ data: [], error: null }),
      additionalMasterLectureIds.size > 0
        ? supabase
            .from("master_lectures")
            .select("id, title, subject_category, subject")
            .in("id", Array.from(additionalMasterLectureIds))
        : Promise.resolve({ data: [], error: null }),
    ]);
  
  // 추가 마스터 콘텐츠를 기존 Map에 병합
  (additionalMasterBooksResult.data || []).forEach((book) => {
    masterBooksMap.set(book.id, book);
  });
  (additionalMasterLecturesResult.data || []).forEach((lecture) => {
    masterLecturesMap.set(lecture.id, lecture);
  });

  // 디버깅: Map 내용 로그
  if (process.env.NODE_ENV === "development") {
    console.log("[classifyPlanContents] Map 변환 결과:", {
      masterBooksMapSize: masterBooksMap.size,
      masterLecturesMapSize: masterLecturesMap.size,
      studentBooksMapSize: studentBooksMap.size,
      studentLecturesMapSize: studentLecturesMap.size,
      customContentsMapSize: customContentsMap.size,
    });
  }

  // 4. 마스터 콘텐츠 Map은 이미 위에서 조회 완료 (plan_contents.master_content_id + 학생 콘텐츠의 master_content_id)

  // 6. 콘텐츠 분류 및 상세 정보 생성
  const studentContents: Array<ContentDetail> = [];
  let recommendedContents: Array<ContentDetail> = [];
  const missingContents: Array<{
    content_type: string;
    content_id: string;
    reason: string;
  }> = [];

  for (const content of contents) {
    let contentDetail: ContentDetail | null = null;
    let masterContentId: string | undefined = undefined;

    if (content.content_type === "book") {
      // 1. plan_contents에 저장된 master_content_id가 있으면 우선 활용
      const masterBookFromPlan = content.master_content_id
        ? masterBooksMap.get(content.master_content_id)
        : null;

      // 2. content_id로 학생 콘텐츠 조회
      const studentBook = studentBooksMap.get(content.content_id);

      if (studentBook) {
        // 학생 콘텐츠를 찾은 경우
        let title = studentBook.title || "제목 없음";
        let subjectCategory = studentBook.subject || null;

        // plan_contents의 master_content_id 또는 학생 콘텐츠의 master_content_id로 마스터 정보 조회
        const masterBook = masterBookFromPlan ||
          (studentBook.master_content_id
            ? masterBooksMap.get(studentBook.master_content_id)
            : null);

        if (masterBook) {
          // 마스터 콘텐츠 정보 우선 사용 (더 정확한 정보)
          title = masterBook.title || studentBook.title || "제목 없음";
          subjectCategory =
            masterBook.subject_category ||
            masterBook.subject ||
            studentBook.subject ||
            null;
          masterContentId = content.master_content_id || studentBook.master_content_id || undefined;
        } else {
          masterContentId = studentBook.master_content_id || undefined;
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
      } else if (masterBookFromPlan) {
        // 학생 콘텐츠를 찾지 못했지만 plan_contents에 master_content_id가 있는 경우
        // → 추천 콘텐츠이거나 학생 콘텐츠가 삭제된 경우
        // content_id가 마스터 콘텐츠 ID인지 확인
        const isMasterContentId = masterBooksMap.has(content.content_id);
        
        contentDetail = {
          content_type: "book",
          content_id: content.content_id,
          start_range: content.start_range,
          end_range: content.end_range,
          title: masterBookFromPlan.title || "제목 없음",
          subject_category: masterBookFromPlan.subject_category || masterBookFromPlan.subject || null,
          isRecommended: isMasterContentId, // content_id가 마스터 ID면 추천 콘텐츠
          masterContentId: content.master_content_id ?? undefined,
          // 자동 추천 정보 전달
          is_auto_recommended: content.is_auto_recommended ?? false,
          recommendation_source: content.recommendation_source ?? null,
          recommendation_reason: content.recommendation_reason ?? null,
          recommendation_metadata: content.recommendation_metadata ?? null,
        };
      } else {
        // 학생 콘텐츠도 없고 plan_contents의 master_content_id로도 조회 실패
        // content_id 자체가 마스터 콘텐츠 ID인지 확인 (이미 masterBooksMap에 조회됨)
        const masterBookByContentId = masterBooksMap.get(content.content_id);
        if (masterBookByContentId) {
          // content_id가 마스터 콘텐츠 ID인 경우 → 추천 콘텐츠
          contentDetail = {
            content_type: "book",
            content_id: content.content_id,
            start_range: content.start_range,
            end_range: content.end_range,
            title: masterBookByContentId.title || "제목 없음",
            subject_category: masterBookByContentId.subject_category || masterBookByContentId.subject || null,
            isRecommended: true, // 마스터 콘텐츠이므로 추천 콘텐츠
            masterContentId: content.content_id, // content_id 자체가 마스터 ID
            // 자동 추천 정보 전달
            is_auto_recommended: content.is_auto_recommended ?? false,
            recommendation_source: content.recommendation_source ?? null,
            recommendation_reason: content.recommendation_reason ?? null,
            recommendation_metadata: content.recommendation_metadata ?? null,
          };
        } else {
          // 정말로 찾을 수 없는 경우
          missingContents.push({
            content_type: "book",
            content_id: content.content_id,
            reason: `학생(${studentId})의 교재를 찾을 수 없습니다. master_books에도 존재하지 않습니다.`,
          });
        }
      }
    } else if (content.content_type === "lecture") {
      // 1. plan_contents에 저장된 master_content_id가 있으면 우선 활용
      const masterLectureFromPlan = content.master_content_id
        ? masterLecturesMap.get(content.master_content_id)
        : null;

      // 2. content_id로 학생 콘텐츠 조회
      const studentLecture = studentLecturesMap.get(content.content_id);

      if (studentLecture) {
        // 학생 콘텐츠를 찾은 경우
        let title = studentLecture.title || "제목 없음";
        let subjectCategory = studentLecture.subject || null;

        // plan_contents의 master_content_id 또는 학생 콘텐츠의 master_content_id로 마스터 정보 조회
        const masterLecture = masterLectureFromPlan ||
          (studentLecture.master_content_id
            ? masterLecturesMap.get(studentLecture.master_content_id)
            : null);

        if (masterLecture) {
          // 마스터 콘텐츠 정보 우선 사용 (더 정확한 정보)
          title = masterLecture.title || studentLecture.title || "제목 없음";
          subjectCategory =
            masterLecture.subject_category ||
            masterLecture.subject ||
            studentLecture.subject ||
            null;
          masterContentId = content.master_content_id || studentLecture.master_content_id || undefined;
        } else {
          masterContentId = studentLecture.master_content_id || undefined;
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
      } else if (masterLectureFromPlan) {
        // 학생 콘텐츠를 찾지 못했지만 plan_contents에 master_content_id가 있는 경우
        // → 추천 콘텐츠이거나 학생 콘텐츠가 삭제된 경우
        // content_id가 마스터 콘텐츠 ID인지 확인
        const isMasterContentId = masterLecturesMap.has(content.content_id);
        
        contentDetail = {
          content_type: "lecture",
          content_id: content.content_id,
          start_range: content.start_range,
          end_range: content.end_range,
          title: masterLectureFromPlan.title || "제목 없음",
          subject_category: masterLectureFromPlan.subject_category || masterLectureFromPlan.subject || null,
          isRecommended: isMasterContentId, // content_id가 마스터 ID면 추천 콘텐츠
          masterContentId: content.master_content_id ?? undefined,
          // 자동 추천 정보 전달
          is_auto_recommended: content.is_auto_recommended ?? false,
          recommendation_source: content.recommendation_source ?? null,
          recommendation_reason: content.recommendation_reason ?? null,
          recommendation_metadata: content.recommendation_metadata ?? null,
        };
      } else {
        // 학생 콘텐츠도 없고 plan_contents의 master_content_id로도 조회 실패
        // content_id 자체가 마스터 콘텐츠 ID인지 확인 (이미 masterLecturesMap에 조회됨)
        const masterLectureByContentId = masterLecturesMap.get(content.content_id);
        if (masterLectureByContentId) {
          // content_id가 마스터 콘텐츠 ID인 경우 → 추천 콘텐츠
          contentDetail = {
            content_type: "lecture",
            content_id: content.content_id,
            start_range: content.start_range,
            end_range: content.end_range,
            title: masterLectureByContentId.title || "제목 없음",
            subject_category: masterLectureByContentId.subject_category || masterLectureByContentId.subject || null,
            isRecommended: true, // 마스터 콘텐츠이므로 추천 콘텐츠
            masterContentId: content.content_id, // content_id 자체가 마스터 ID
            // 자동 추천 정보 전달
            is_auto_recommended: content.is_auto_recommended ?? false,
            recommendation_source: content.recommendation_source ?? null,
            recommendation_reason: content.recommendation_reason ?? null,
            recommendation_metadata: content.recommendation_metadata ?? null,
          };
        } else {
          // 정말로 찾을 수 없는 경우
          missingContents.push({
            content_type: "lecture",
            content_id: content.content_id,
            reason: `학생(${studentId})의 강의를 찾을 수 없습니다. master_lectures에도 존재하지 않습니다.`,
          });
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
      } else {
        // 커스텀 콘텐츠를 찾지 못한 경우
        missingContents.push({
          content_type: "custom",
          content_id: content.content_id,
          reason: `학생(${studentId})의 커스텀 콘텐츠를 찾을 수 없습니다.`,
        });
      }
    }

    if (contentDetail) {
      // isRecommended는 contentDetail에 이미 설정되어 있음
      if (contentDetail.isRecommended) {
        recommendedContents.push(contentDetail);
      } else {
        studentContents.push(contentDetail);
      }
    } else {
      // contentDetail이 null인 경우 로그
      if (process.env.NODE_ENV === "development") {
        console.warn("[classifyPlanContents] contentDetail이 null:", {
          content_type: content.content_type,
          content_id: content.content_id,
          studentId,
        });
      }
    }
  }

  // 디버깅: 누락된 콘텐츠 로그
  if (missingContents.length > 0) {
    console.warn("[classifyPlanContents] 누락된 콘텐츠:", {
      count: missingContents.length,
      missingContents,
      studentId,
    });
  }

  // 최종 검증: custom 타입이 recommended에 포함되지 않았는지 확인
  const invalidRecommended = recommendedContents.filter(
    (c) => c.content_type === "custom"
  );

  if (invalidRecommended.length > 0) {
    console.warn(
      "[classifyPlanContents] custom 타입 콘텐츠가 추천 콘텐츠로 분류됨:",
      invalidRecommended.map((c) => c.content_id)
    );
    // custom 타입을 studentContents로 이동
    recommendedContents = recommendedContents.filter(
      (c) => c.content_type !== "custom"
    );
    studentContents.push(...invalidRecommended);
  }

  // 디버깅: 최종 결과 로그
  if (process.env.NODE_ENV === "development") {
    console.log("[classifyPlanContents] 최종 결과:", {
      studentContentsCount: studentContents.length,
      recommendedContentsCount: recommendedContents.length,
      missingContentsCount: missingContents.length,
      totalInputCount: contents.length,
      invalidRecommendedMoved: invalidRecommended.length,
    });
  }

  return { studentContents, recommendedContents };
}

