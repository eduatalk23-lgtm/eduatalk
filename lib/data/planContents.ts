// 플랜 콘텐츠 데이터 액세스 레이어

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PlanContent } from "@/lib/types/plan";
import { fetchSubjectGroupNamesBatch } from "@/lib/data/contentMetadata";
import { getMasterContentId, extractMasterIds } from "@/lib/plan/content";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Supabase 쿼리 결과 타입 정의
interface BookRow {
  id: string;
  title: string | null;
  subject: string | null;
  subject_id: string | null;
  curriculum_revision_id: string | null;
  master_content_id: string | null;
  semester: string | null;
  revision: string | null;
  difficulty_level: string | null;
  publisher: string | null;
}

interface LectureRow {
  id: string;
  title: string | null;
  subject: string | null;
  subject_id: string | null;
  curriculum_revision_id: string | null;
  master_content_id: string | null;
  master_lecture_id: string | null;
  semester: string | null;
  revision: string | null;
  difficulty_level: string | null;
  platform: string | null;
}

/**
 * 여러 curriculum_revision_id를 배치로 조회하여 개정교육과정명 맵 반환
 */
async function fetchCurriculumRevisionNamesBatch(
  supabase: SupabaseServerClient,
  curriculumRevisionIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  
  if (curriculumRevisionIds.length === 0) {
    return result;
  }

  try {
    const { data: revisions, error } = await supabase
      .from("curriculum_revisions")
      .select("id, name")
      .in("id", curriculumRevisionIds);

    if (error || !revisions) {
      logActionDebug({ domain: "data", action: "fetchCurriculumRevisionNamesBatch" }, "개정교육과정 배치 조회 실패", { curriculumRevisionIds, error });
      return result;
    }

    revisions.forEach((revision) => {
      if (revision.name) {
        result.set(revision.id, revision.name);
      }
    });
  } catch (error) {
    logActionDebug({ domain: "data", action: "fetchCurriculumRevisionNamesBatch" }, "개정교육과정명 배치 조회 실패", { error });
  }

  return result;
}

/**
 * 콘텐츠 아이템 타입
 */
export type ContentItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  master_content_id?: string | null;
  subject?: string | null;
  subject_group_name?: string | null;
  curriculum_revision_name?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
  publisher?: string | null;
  platform?: string | null;
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
      .select("id, title, subject, subject_id, curriculum_revision_id, master_content_id, semester, revision, difficulty_level, publisher")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // master_content_id 목록 추출 (null이 아닌 것만)
    const masterContentIds = data
      .map((book) => book.master_content_id)
      .filter((id): id is string => id !== null && id !== undefined);

    // 마스터 콘텐츠에서 메타데이터 조회 (ContentCard와 동일한 정보)
    const masterContentsMap = new Map<string, { 
      curriculum_revision_id: string | null; 
      subject_id: string | null;
      subject: string | null;
      semester: string | null;
      revision: string | null;
      difficulty_level: string | null;
      publisher: string | null;
    }>();
    if (masterContentIds.length > 0) {
      const { data: masterBooks, error: masterError } = await supabase
        .from("master_books")
        .select("id, curriculum_revision_id, subject_id, subject, semester, revision, difficulty_level, publisher")
        .in("id", masterContentIds);

      if (!masterError && masterBooks) {
        masterBooks.forEach((masterBook) => {
          masterContentsMap.set(masterBook.id, {
            curriculum_revision_id: masterBook.curriculum_revision_id || null,
            subject_id: masterBook.subject_id || null,
            subject: masterBook.subject || null,
            semester: masterBook.semester || null,
            revision: masterBook.revision || null,
            difficulty_level: masterBook.difficulty_level || null,
            publisher: masterBook.publisher || null,
          });
        });
      }
    }

    // 최종 subject_id 및 curriculum_revision_id 목록 생성
    // 학생 콘텐츠에 없으면 마스터 콘텐츠에서 가져옴
    const allSubjectIds = new Set<string>();
    const allCurriculumRevisionIds = new Set<string>();

    data.forEach((book) => {
      const masterInfo = book.master_content_id
        ? masterContentsMap.get(book.master_content_id)
        : null;

      const finalSubjectId = book.subject_id || masterInfo?.subject_id || null;
      const finalCurriculumRevisionId =
        book.curriculum_revision_id || masterInfo?.curriculum_revision_id || null;

      if (finalSubjectId) {
        allSubjectIds.add(finalSubjectId);
      }
      if (finalCurriculumRevisionId) {
        allCurriculumRevisionIds.add(finalCurriculumRevisionId);
      }
    });

    // 배치로 교과명 및 개정교육과정명 조회
    const [subjectGroupNamesMap, curriculumRevisionNamesMap] = await Promise.all([
      allSubjectIds.size > 0
        ? fetchSubjectGroupNamesBatch(supabase, Array.from(allSubjectIds))
        : Promise.resolve(new Map<string, string>()),
      allCurriculumRevisionIds.size > 0
        ? fetchCurriculumRevisionNamesBatch(supabase, Array.from(allCurriculumRevisionIds))
        : Promise.resolve(new Map<string, string>()),
    ]);

    return (data as BookRow[]).map((book) => {
      const masterInfo = book.master_content_id
        ? masterContentsMap.get(book.master_content_id)
        : null;

      const finalSubjectId = book.subject_id || masterInfo?.subject_id || null;
      const finalCurriculumRevisionId =
        book.curriculum_revision_id || masterInfo?.curriculum_revision_id || null;

      // 학생 콘텐츠에 값이 없으면 마스터 콘텐츠에서 가져옴 (ContentCard와 동일한 로직)
      return {
        id: book.id,
        title: book.title || "제목 없음",
        subtitle: null, // subtitle은 더 이상 사용하지 않음
        master_content_id: book.master_content_id || null,
        subject: book.subject || masterInfo?.subject || null,
        subject_group_name: finalSubjectId
          ? subjectGroupNamesMap.get(finalSubjectId) || null
          : null,
        curriculum_revision_name: finalCurriculumRevisionId
          ? curriculumRevisionNamesMap.get(finalCurriculumRevisionId) || null
          : null,
        semester: book.semester || masterInfo?.semester || null,
        revision: book.revision || masterInfo?.revision || null,
        difficulty_level: book.difficulty_level || masterInfo?.difficulty_level || null,
        publisher: book.publisher || masterInfo?.publisher || null,
      };
    });
  } catch (err) {
    logActionError({ domain: "data", action: "fetchStudentBooks" }, err, { studentId });
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
      .select("id, title, subject, subject_id, curriculum_revision_id, master_content_id, master_lecture_id, semester, revision, difficulty_level, platform")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // ContentResolverService를 사용하여 마스터 강의 ID 목록 추출
    const masterLectureIds = extractMasterIds(data, "lecture");

    // 마스터 강의에서 메타데이터 조회 (ContentCard와 동일한 정보)
    const masterLecturesMap = new Map<string, { 
      curriculum_revision_id: string | null; 
      subject_id: string | null;
      subject: string | null;
      semester: string | null;
      revision: string | null;
      difficulty_level: string | null;
      platform: string | null;
    }>();
    if (masterLectureIds.length > 0) {
      const { data: masterLectures, error: masterError } = await supabase
        .from("master_lectures")
        .select("id, curriculum_revision_id, subject_id, subject, semester, revision, difficulty_level, platform")
        .in("id", masterLectureIds);

      if (!masterError && masterLectures) {
        masterLectures.forEach((masterLecture) => {
          masterLecturesMap.set(masterLecture.id, {
            curriculum_revision_id: masterLecture.curriculum_revision_id || null,
            subject_id: masterLecture.subject_id || null,
            subject: masterLecture.subject || null,
            semester: masterLecture.semester || null,
            revision: masterLecture.revision || null,
            difficulty_level: masterLecture.difficulty_level || null,
            platform: masterLecture.platform || null,
          });
        });
      }
    }

    // 최종 subject_id 및 curriculum_revision_id 목록 생성
    // 학생 콘텐츠에 없으면 마스터 콘텐츠에서 가져옴
    const allSubjectIds = new Set<string>();
    const allCurriculumRevisionIds = new Set<string>();

    data.forEach((lecture) => {
      // ContentResolverService를 사용하여 마스터 ID 추출
      const masterId = getMasterContentId(lecture, "lecture");
      const masterInfo = masterId ? masterLecturesMap.get(masterId) : null;

      const finalSubjectId = lecture.subject_id || masterInfo?.subject_id || null;
      const finalCurriculumRevisionId =
        lecture.curriculum_revision_id || masterInfo?.curriculum_revision_id || null;

      if (finalSubjectId) {
        allSubjectIds.add(finalSubjectId);
      }
      if (finalCurriculumRevisionId) {
        allCurriculumRevisionIds.add(finalCurriculumRevisionId);
      }
    });

    // 배치로 교과명 및 개정교육과정명 조회
    const [subjectGroupNamesMap, curriculumRevisionNamesMap] = await Promise.all([
      allSubjectIds.size > 0
        ? fetchSubjectGroupNamesBatch(supabase, Array.from(allSubjectIds))
        : Promise.resolve(new Map<string, string>()),
      allCurriculumRevisionIds.size > 0
        ? fetchCurriculumRevisionNamesBatch(supabase, Array.from(allCurriculumRevisionIds))
        : Promise.resolve(new Map<string, string>()),
    ]);

    return (data as LectureRow[]).map((lecture) => {
      // ContentResolverService를 사용하여 마스터 ID 추출
      const masterId = getMasterContentId(lecture, "lecture");
      const masterInfo = masterId ? masterLecturesMap.get(masterId) : null;

      const finalSubjectId = lecture.subject_id || masterInfo?.subject_id || null;
      const finalCurriculumRevisionId =
        lecture.curriculum_revision_id || masterInfo?.curriculum_revision_id || null;

      // 학생 콘텐츠에 값이 없으면 마스터 콘텐츠에서 가져옴 (ContentCard와 동일한 로직)
      return {
        id: lecture.id,
        title: lecture.title || "제목 없음",
        subtitle: null, // subtitle은 더 이상 사용하지 않음
        master_content_id: lecture.master_content_id || null,
        subject: lecture.subject || masterInfo?.subject || null,
        subject_group_name: finalSubjectId
          ? subjectGroupNamesMap.get(finalSubjectId) || null
          : null,
        curriculum_revision_name: finalCurriculumRevisionId
          ? curriculumRevisionNamesMap.get(finalCurriculumRevisionId) || null
          : null,
        semester: lecture.semester || masterInfo?.semester || null,
        revision: lecture.revision || masterInfo?.revision || null,
        difficulty_level: lecture.difficulty_level || masterInfo?.difficulty_level || null,
        platform: lecture.platform || masterInfo?.platform || null,
      };
    });
  } catch (err) {
    logActionError({ domain: "data", action: "fetchStudentLectures" }, err, { studentId });
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
    // student_custom_contents 테이블에는 subject_id, curriculum_revision_id 컬럼이 없음
    // 실제 테이블 스키마에 맞게 조회
    const { data, error } = await supabase
      .from("student_custom_contents")
      .select("id, title, content_type")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) {
      // Supabase 에러를 더 자세히 로깅 (안전한 직렬화)
      const errorInfo: Record<string, unknown> = {
        studentId,
      };
      
      // 에러 객체의 모든 속성을 안전하게 추출
      if (error.message) errorInfo.message = String(error.message);
      if (error.code) errorInfo.code = String(error.code);
      if (error.details) errorInfo.details = String(error.details);
      if (error.hint) errorInfo.hint = String(error.hint);
      
      // 에러 객체 전체를 JSON으로 직렬화 시도
      try {
        errorInfo.errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
      } catch {
        errorInfo.errorString = String(error);
      }
      
      // 에러 객체의 모든 키를 로깅
      if (typeof error === "object" && error !== null) {
        errorInfo.errorKeys = Object.keys(error);
        errorInfo.errorValues = Object.entries(error).reduce((acc, [key, value]) => {
          acc[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
          return acc;
        }, {} as Record<string, string>);
      }
      
      logActionError({ domain: "data", action: "fetchStudentCustomContents" }, error, errorInfo);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // student_custom_contents 테이블에는 subject_id, curriculum_revision_id가 없으므로
    // subject_group_name과 curriculum_revision_name은 항상 null로 반환
    return data.map((custom) => ({
      id: custom.id,
      title: custom.title || "커스텀 콘텐츠",
      subtitle: null, // subtitle은 더 이상 사용하지 않음
      subject: null, // student_custom_contents 테이블에는 subject 컬럼이 없음
      subject_group_name: null, // subject_id가 없으므로 null
      curriculum_revision_name: null, // curriculum_revision_id가 없으므로 null
    }));
  } catch (err) {
    // Supabase 에러는 PostgrestError 타입일 수 있음
    const errorDetails: Record<string, unknown> = {
      studentId,
    };

    // Error 인스턴스인 경우
    if (err instanceof Error) {
      errorDetails.error = err.message || "Unknown error";
      errorDetails.stack = err.stack || undefined;
      errorDetails.name = err.name || "Error";
      
      // Error 객체의 모든 속성 추출
      const errorProps = Object.getOwnPropertyNames(err);
      errorDetails.errorProperties = errorProps;
      
      // 각 속성 값을 안전하게 추출
      const errorValues: Record<string, string> = {};
      errorProps.forEach((prop) => {
        try {
          const value = (err as unknown as Record<string, unknown>)[prop];
          errorValues[prop] = typeof value === "object" 
            ? JSON.stringify(value) 
            : String(value ?? "null");
        } catch {
          errorValues[prop] = "[unable to serialize]";
        }
      });
      errorDetails.errorPropertyValues = errorValues;
    } else if (err && typeof err === "object") {
      // 객체인 경우
      errorDetails.error = String(err);
      errorDetails.errorType = typeof err;
      errorDetails.errorKeys = Object.keys(err);
      
      // 객체의 모든 속성을 안전하게 직렬화
      const errorValues: Record<string, string> = {};
      Object.entries(err).forEach(([key, value]) => {
        try {
          errorValues[key] = typeof value === "object" 
            ? JSON.stringify(value) 
            : String(value ?? "null");
        } catch {
          errorValues[key] = "[unable to serialize]";
        }
      });
      errorDetails.errorValues = errorValues;
      
      // Supabase PostgrestError의 경우 추가 정보 포함
      if ("code" in err) {
        errorDetails.code = String((err as { code?: unknown }).code ?? "undefined");
      }
      if ("details" in err) {
        errorDetails.details = String((err as { details?: unknown }).details ?? "undefined");
      }
      if ("hint" in err) {
        errorDetails.hint = String((err as { hint?: unknown }).hint ?? "undefined");
      }
      if ("message" in err) {
        errorDetails.message = String((err as { message?: unknown }).message ?? "undefined");
      }
    } else {
      // 원시 타입인 경우
      errorDetails.error = String(err);
      errorDetails.errorType = typeof err;
    }

    // 최종 로깅
    logActionError({ domain: "data", action: "fetchStudentCustomContents" }, err, errorDetails);

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
      logActionDebug({ domain: "data", action: "classifyPlanContents" }, "Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용", {
        studentId,
        currentUserId: options?.currentUserId,
        currentUserRole: options?.currentUserRole,
      });
      supabase = await createSupabaseServerClient();
    } else {
      // Database 타입이 동일하므로 단순 단언만으로 호환
      supabase = adminClient as SupabaseServerClient;
      isUsingAdminClient = true;
      if (process.env.NODE_ENV === "development") {
        logActionDebug({ domain: "data", action: "classifyPlanContents" }, "Admin 클라이언트 사용 (RLS 우회)", {
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
    logActionDebug({ domain: "data", action: "classifyPlanContents" }, "입력 데이터", {
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
  const masterCustomContentIds: string[] = [];

  // UUID 검증 정규식 (빈 문자열 방지)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  contents.forEach((content) => {
    // content_id가 없거나 UUID 형식이 아닌 경우 스킵
    if (!content.content_id || !uuidRegex.test(content.content_id)) {
      if (process.env.NODE_ENV === "development") {
        logActionDebug({ domain: "data", action: "classifyPlanContents" }, "유효하지 않은 content_id 스킵", { contentId: content.content_id });
      }
      return;
    }

    if (content.content_type === "book") {
      bookContentIds.push(content.content_id);
      // plan_contents에 저장된 master_content_id가 있으면 마스터 콘텐츠 ID로도 수집
      if (content.master_content_id && uuidRegex.test(content.master_content_id)) {
        masterBookIds.push(content.master_content_id);
      }
      // content_id 자체가 마스터 콘텐츠 ID일 수 있으므로 마스터 콘텐츠 조회 대상에 포함
      // (중복 제거는 Set을 사용하지 않고 배열에 push 후 나중에 조회 시 처리)
      masterBookIds.push(content.content_id);
    } else if (content.content_type === "lecture") {
      lectureContentIds.push(content.content_id);
      // plan_contents에 저장된 master_content_id가 있으면 마스터 콘텐츠 ID로도 수집
      if (content.master_content_id && uuidRegex.test(content.master_content_id)) {
        masterLectureIds.push(content.master_content_id);
      }
      // content_id 자체가 마스터 콘텐츠 ID일 수 있으므로 마스터 콘텐츠 조회 대상에 포함
      masterLectureIds.push(content.content_id);
    } else if (content.content_type === "custom") {
      customContentIds.push(content.content_id);
      // plan_contents에 저장된 master_content_id가 있으면 마스터 커스텀 콘텐츠 ID로도 수집
      if (content.master_content_id && uuidRegex.test(content.master_content_id)) {
        masterCustomContentIds.push(content.master_content_id);
      }
      // content_id 자체가 마스터 커스텀 콘텐츠 ID일 수 있으므로 마스터 콘텐츠 조회 대상에 포함
      masterCustomContentIds.push(content.content_id);
    }
  });

  // 중복 제거
  const uniqueMasterBookIds = [...new Set(masterBookIds)];
  const uniqueMasterLectureIds = [...new Set(masterLectureIds)];
  const uniqueMasterCustomContentIds = [...new Set(masterCustomContentIds)];

  if (process.env.NODE_ENV === "development") {
    logActionDebug({ domain: "data", action: "classifyPlanContents" }, "콘텐츠 ID 분류", {
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
    masterCustomContentsResult,
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
    // 마스터 커스텀 콘텐츠 조회 (plan_contents.master_content_id + content_id)
    uniqueMasterCustomContentIds.length > 0
      ? supabase
          .from("master_custom_contents")
          .select("id, title, subject_category, subject")
          .in("id", uniqueMasterCustomContentIds)
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
    // 커스텀 콘텐츠 조회 (학생 커스텀 콘텐츠)
    customContentIds.length > 0
      ? supabase
          .from("student_custom_contents")
          .select("id, title, content_type")
          .in("id", customContentIds)
          .eq("student_id", studentId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // 디버깅: 조회 결과 로그
  logActionDebug(
    { domain: "data", action: "classifyPlanContents" },
    "조회 결과",
    {
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
    }
  );

  // 관리자 모드에서 조회 실패 시 경고 로그
  if (isAdminOrConsultant && isOtherStudent) {
    const hasErrors = 
      studentBooksResult.error || 
      studentLecturesResult.error || 
      customContentsResult.error;
    
    if (hasErrors) {
      logActionDebug(
        { domain: "data", action: "classifyPlanContents" },
        "관리자 모드에서 콘텐츠 조회 중 에러 발생",
        {
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
        }
      );
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
      logActionDebug(
        { domain: "data", action: "classifyPlanContents" },
        "관리자 모드에서 일부 콘텐츠를 찾을 수 없음",
        {
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
        }
      );
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
  const masterCustomContentsMap = new Map(
    (masterCustomContentsResult.data || []).map((custom) => [custom.id, custom])
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
  logActionDebug(
    { domain: "data", action: "classifyPlanContents" },
    "Map 변환 결과",
    {
      masterBooksMapSize: masterBooksMap.size,
      masterLecturesMapSize: masterLecturesMap.size,
      studentBooksMapSize: studentBooksMap.size,
      studentLecturesMapSize: studentLecturesMap.size,
      customContentsMapSize: customContentsMap.size,
    }
  );

  // 4. 마스터 콘텐츠 Map은 이미 위에서 조회 완료 (plan_contents.master_content_id + 학생 콘텐츠의 master_content_id)

  // 6. 콘텐츠 분류 및 상세 정보 생성
  const studentContents: Array<ContentDetail> = [];
  const recommendedContents: Array<ContentDetail> = [];
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
          // master_content_id가 없으면 content_id가 마스터 콘텐츠 ID인지 확인
          // 템플릿에서 학생이 추가한 마스터 콘텐츠는 content_id가 학생 콘텐츠 ID이고 master_content_id가 없을 수 있음
          // 하지만 content_id 자체가 마스터 콘텐츠 ID일 수도 있음
          const masterBookByContentId = masterBooksMap.get(content.content_id);
          if (masterBookByContentId) {
            // content_id가 마스터 콘텐츠 ID인 경우
            masterContentId = content.content_id;
            title = masterBookByContentId.title || studentBook.title || "제목 없음";
            subjectCategory =
              masterBookByContentId.subject_category ||
              masterBookByContentId.subject ||
              studentBook.subject ||
              null;
          } else {
            masterContentId = studentBook.master_content_id || undefined;
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
          // master_content_id가 없으면 content_id가 마스터 콘텐츠 ID인지 확인
          // 템플릿에서 학생이 추가한 마스터 콘텐츠는 content_id가 학생 콘텐츠 ID이고 master_content_id가 없을 수 있음
          // 하지만 content_id 자체가 마스터 콘텐츠 ID일 수도 있음
          const masterLectureByContentId = masterLecturesMap.get(content.content_id);
          if (masterLectureByContentId) {
            // content_id가 마스터 콘텐츠 ID인 경우
            masterContentId = content.content_id;
            title = masterLectureByContentId.title || studentLecture.title || "제목 없음";
            subjectCategory =
              masterLectureByContentId.subject_category ||
              masterLectureByContentId.subject ||
              studentLecture.subject ||
              null;
          } else {
            masterContentId = studentLecture.master_content_id || undefined;
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
      // 1. plan_contents에 저장된 master_content_id가 있으면 우선 활용
      const masterCustomContentFromPlan = content.master_content_id
        ? masterCustomContentsMap.get(content.master_content_id)
        : null;

      // 2. content_id로 학생 커스텀 콘텐츠 조회
      const customContent = customContentsMap.get(content.content_id);

      if (customContent) {
        // 학생 커스텀 콘텐츠를 찾은 경우
        contentDetail = {
          content_type: "custom",
          content_id: content.content_id,
          start_range: content.start_range,
          end_range: content.end_range,
          title: customContent.title || "커스텀 콘텐츠",
          subject_category: customContent.content_type || null,
          isRecommended: false,
        };
      } else if (masterCustomContentFromPlan) {
        // 학생 커스텀 콘텐츠를 찾지 못했지만 plan_contents에 master_content_id가 있는 경우
        // → 마스터 커스텀 콘텐츠 (추천 콘텐츠)
        // content_id가 마스터 커스텀 콘텐츠 ID인지 확인
        const isMasterContentId = masterCustomContentsMap.has(content.content_id);
        
        contentDetail = {
          content_type: "custom",
          content_id: content.content_id,
          start_range: content.start_range,
          end_range: content.end_range,
          title: masterCustomContentFromPlan.title || "커스텀 콘텐츠",
          subject_category: masterCustomContentFromPlan.subject_category || masterCustomContentFromPlan.subject || null,
          isRecommended: isMasterContentId, // content_id가 마스터 ID면 추천 콘텐츠
          masterContentId: content.master_content_id ?? undefined,
          // 자동 추천 정보 전달
          is_auto_recommended: content.is_auto_recommended ?? false,
          recommendation_source: content.recommendation_source ?? null,
          recommendation_reason: content.recommendation_reason ?? null,
          recommendation_metadata: content.recommendation_metadata ?? null,
        };
      } else {
        // 학생 커스텀 콘텐츠도 없고 plan_contents의 master_content_id로도 조회 실패
        // content_id 자체가 마스터 커스텀 콘텐츠 ID인지 확인 (이미 masterCustomContentsMap에 조회됨)
        const masterCustomContentByContentId = masterCustomContentsMap.get(content.content_id);
        if (masterCustomContentByContentId) {
          // content_id가 마스터 커스텀 콘텐츠 ID인 경우 → 추천 콘텐츠
          contentDetail = {
            content_type: "custom",
            content_id: content.content_id,
            start_range: content.start_range,
            end_range: content.end_range,
            title: masterCustomContentByContentId.title || "커스텀 콘텐츠",
            subject_category: masterCustomContentByContentId.subject_category || masterCustomContentByContentId.subject || null,
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
            content_type: "custom",
            content_id: content.content_id,
            reason: `학생(${studentId})의 커스텀 콘텐츠를 찾을 수 없습니다. master_custom_contents에도 존재하지 않습니다.`,
          });
        }
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
      logActionDebug(
        { domain: "data", action: "classifyPlanContents" },
        "contentDetail이 null",
        {
          content_type: content.content_type,
          content_id: content.content_id,
          studentId,
        }
      );
    }
  }

  // 디버깅: 누락된 콘텐츠 로그
  if (missingContents.length > 0) {
    logActionDebug(
      { domain: "data", action: "classifyPlanContents" },
      "누락된 콘텐츠",
      {
        count: missingContents.length,
        missingContents,
        studentId,
      }
    );
  }

  // 최종 검증: custom 타입이 recommended에 포함된 경우 확인
  // 마스터 커스텀 콘텐츠는 추천 콘텐츠로 분류될 수 있으므로 경고만 출력
  const recommendedCustomContents = recommendedContents.filter(
    (c) => c.content_type === "custom"
  );

  if (recommendedCustomContents.length > 0) {
    logActionDebug(
      { domain: "data", action: "classifyPlanContents" },
      "마스터 커스텀 콘텐츠가 추천 콘텐츠로 분류됨",
      {
        contents: recommendedCustomContents.map((c) => ({
          content_id: c.content_id,
          masterContentId: c.masterContentId,
        })),
      }
    );
  }

  // 디버깅: 최종 결과 로그
  logActionDebug(
    { domain: "data", action: "classifyPlanContents" },
    "최종 결과",
    {
      studentContentsCount: studentContents.length,
      recommendedContentsCount: recommendedContents.length,
      missingContentsCount: missingContents.length,
      totalInputCount: contents.length,
    }
  );

  return { studentContents, recommendedContents };
}

/**
 * 특정 plan_content의 플랜(student_plan) 목록 조회
 * 콘텐츠 상세 페이지에서 해당 콘텐츠의 모든 플랜을 날짜별로 표시하기 위해 사용
 *
 * @param planGroupId 플랜 그룹 ID
 * @param contentId 콘텐츠 ID (plan_contents.id)
 * @returns 해당 콘텐츠의 플랜 목록 (날짜순 정렬)
 */
export async function getPlansByPlanContent(
  planGroupId: string,
  contentId: string
): Promise<{
  content: PlanContent | null;
  plans: Array<{
    id: string;
    plan_date: string;
    block_index: number;
    planned_start_page_or_time: number;
    planned_end_page_or_time: number;
    completed_amount: number | null;
    progress: number | null;
    content_title: string | null;
    content_subject: string | null;
    total_duration_seconds: number | null;
    status: "pending" | "in_progress" | "completed";
  }>;
  stats: {
    totalPlans: number;
    completedPlans: number;
    inProgressPlans: number;
    pendingPlans: number;
    totalDurationSeconds: number;
    averageProgress: number;
  };
}> {
  const supabase = await createSupabaseServerClient();

  // 1. plan_contents에서 콘텐츠 정보 조회
  const { data: contentData, error: contentError } = await supabase
    .from("plan_contents")
    .select("*")
    .eq("id", contentId)
    .eq("plan_group_id", planGroupId)
    .single();

  if (contentError || !contentData) {
    logActionDebug(
      { domain: "data", action: "getPlansByPlanContent" },
      "콘텐츠를 찾을 수 없음",
      {
        planGroupId,
        contentId,
        error: contentError?.message,
      }
    );
    return {
      content: null,
      plans: [],
      stats: {
        totalPlans: 0,
        completedPlans: 0,
        inProgressPlans: 0,
        pendingPlans: 0,
        totalDurationSeconds: 0,
        averageProgress: 0,
      },
    };
  }

  // 2. student_plan에서 해당 콘텐츠의 플랜들 조회
  // student_plan.content_id가 plan_contents.content_id와 같고
  // student_plan.plan_group_id가 같은 플랜들을 조회
  const { data: plansData, error: plansError } = await supabase
    .from("student_plan")
    .select(`
      id,
      plan_date,
      block_index,
      planned_start_page_or_time,
      planned_end_page_or_time,
      completed_amount,
      progress,
      content_title,
      content_subject,
      total_duration_seconds
    `)
    .eq("plan_group_id", planGroupId)
    .eq("content_id", contentData.content_id)
    .order("plan_date", { ascending: true })
    .order("block_index", { ascending: true });

  if (plansError) {
    logActionError(
      { domain: "data", action: "getPlansByPlanContent" },
      plansError,
      { planGroupId, contentId }
    );
    return {
      content: contentData as PlanContent,
      plans: [],
      stats: {
        totalPlans: 0,
        completedPlans: 0,
        inProgressPlans: 0,
        pendingPlans: 0,
        totalDurationSeconds: 0,
        averageProgress: 0,
      },
    };
  }

  // 3. 플랜 상태 계산 및 통계 생성
  const plans = (plansData || []).map((plan) => {
    // 진행률 기반 상태 결정
    const progress = plan.progress ?? 0;
    let status: "pending" | "in_progress" | "completed" = "pending";
    if (progress >= 100) {
      status = "completed";
    } else if (progress > 0) {
      status = "in_progress";
    }

    return {
      id: plan.id,
      plan_date: plan.plan_date,
      block_index: plan.block_index,
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
      completed_amount: plan.completed_amount,
      progress: plan.progress,
      content_title: plan.content_title,
      content_subject: plan.content_subject,
      total_duration_seconds: plan.total_duration_seconds,
      status,
    };
  });

  // 4. 통계 계산
  const completedPlans = plans.filter((p) => p.status === "completed").length;
  const inProgressPlans = plans.filter((p) => p.status === "in_progress").length;
  const pendingPlans = plans.filter((p) => p.status === "pending").length;
  const totalDurationSeconds = plans.reduce(
    (sum, p) => sum + (p.total_duration_seconds || 0),
    0
  );
  const averageProgress =
    plans.length > 0
      ? plans.reduce((sum, p) => sum + (p.progress || 0), 0) / plans.length
      : 0;

  return {
    content: contentData as PlanContent,
    plans,
    stats: {
      totalPlans: plans.length,
      completedPlans,
      inProgressPlans,
      pendingPlans,
      totalDurationSeconds,
      averageProgress: Math.round(averageProgress),
    },
  };
}

/**
 * 플랜 그룹의 콘텐츠 목록과 각 콘텐츠별 통계 조회
 * 캘린더 상세 페이지에서 콘텐츠 카드 목록을 표시하기 위해 사용
 *
 * @param planGroupId 플랜 그룹 ID
 * @returns 콘텐츠 목록 및 통계
 */
export async function getPlanContentsList(
  planGroupId: string
): Promise<Array<{
  content: PlanContent;
  contentTitle: string;
  contentType: "book" | "lecture" | "custom";
  stats: {
    totalPlans: number;
    completedPlans: number;
    progress: number;
    totalDurationSeconds: number;
  };
}>> {
  const supabase = await createSupabaseServerClient();

  // 1. plan_contents에서 해당 그룹의 모든 콘텐츠 조회
  const { data: contentsData, error: contentsError } = await supabase
    .from("plan_contents")
    .select("*")
    .eq("plan_group_id", planGroupId)
    .order("display_order", { ascending: true });

  if (contentsError || !contentsData || contentsData.length === 0) {
    return [];
  }

  // 2. 각 콘텐츠의 플랜 통계 조회
  const contentIds = contentsData.map((c) => c.content_id);

  const { data: plansData, error: plansError } = await supabase
    .from("student_plan")
    .select("content_id, progress, total_duration_seconds, content_title")
    .eq("plan_group_id", planGroupId)
    .in("content_id", contentIds);

  if (plansError) {
    logActionError(
      { domain: "data", action: "getPlanContentsList" },
      plansError,
      { planGroupId }
    );
  }

  // 3. 콘텐츠별 통계 집계
  const plansByContent = new Map<string, Array<{
    progress: number | null;
    total_duration_seconds: number | null;
    content_title: string | null;
  }>>();

  (plansData || []).forEach((plan) => {
    if (!plan.content_id) return;
    const existing = plansByContent.get(plan.content_id) || [];
    existing.push({
      progress: plan.progress,
      total_duration_seconds: plan.total_duration_seconds,
      content_title: plan.content_title,
    });
    plansByContent.set(plan.content_id, existing);
  });

  // 4. 결과 생성
  return contentsData.map((content) => {
    const plans = plansByContent.get(content.content_id) || [];
    const completedPlans = plans.filter((p) => (p.progress ?? 0) >= 100).length;
    const totalProgress = plans.reduce((sum, p) => sum + (p.progress ?? 0), 0);
    const avgProgress = plans.length > 0 ? Math.round(totalProgress / plans.length) : 0;
    const totalDurationSeconds = plans.reduce(
      (sum, p) => sum + (p.total_duration_seconds || 0),
      0
    );
    const contentTitle = plans[0]?.content_title || `콘텐츠 ${content.display_order + 1}`;

    return {
      content: content as PlanContent,
      contentTitle,
      contentType: content.content_type as "book" | "lecture" | "custom",
      stats: {
        totalPlans: plans.length,
        completedPlans,
        progress: avgProgress,
        totalDurationSeconds,
      },
    };
  });
}

