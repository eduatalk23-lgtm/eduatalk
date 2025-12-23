/**
 * 콘텐츠 메타데이터 조회 유틸리티
 * 
 * 학생 콘텐츠의 master_content_id를 통해 마스터 콘텐츠에서 subject_category를 조회합니다.
 * 이는 마스터 콘텐츠의 subject_category가 더 정확하고 일관된 정보를 제공하기 때문입니다.
 */

import { createSupabaseServerClient, createSupabasePublicClient } from "@/lib/supabase/server";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { PlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";

/**
 * subject_id를 통해 교과명 조회 헬퍼 함수
 */
async function fetchSubjectGroupName(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  subjectId: string | null | undefined
): Promise<string | null> {
  if (!subjectId) {
    return null;
  }

  try {
    const { data: subject, error } = await supabase
      .from("subjects")
      .select("subject_group_id, subject_groups!inner(name)")
      .eq("id", subjectId)
      .maybeSingle();

    if (error || !subject) {
      console.warn(`[fetchSubjectGroupName] 과목 조회 실패: ${subjectId}`, error);
      return null;
    }

    // subject_groups는 JOIN 결과이므로 타입 단언 필요
    const subjectGroup = (subject as any).subject_groups;
    return subjectGroup?.name || null;
  } catch (error) {
    console.warn(`[fetchSubjectGroupName] 교과명 조회 실패: ${subjectId}`, error);
    return null;
  }
}

/**
 * 여러 subject_id를 배치로 조회하여 교과명 맵 반환
 */
export async function fetchSubjectGroupNamesBatch(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  subjectIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  
  if (subjectIds.length === 0) {
    return result;
  }

  try {
    const { data: subjects, error } = await supabase
      .from("subjects")
      .select("id, subject_group_id, subject_groups!inner(name)")
      .in("id", subjectIds);

    if (error || !subjects) {
      console.warn(`[fetchSubjectGroupNamesBatch] 과목 배치 조회 실패:`, error);
      return result;
    }

    subjects.forEach((subject: any) => {
      const subjectGroup = subject.subject_groups;
      if (subjectGroup?.name) {
        result.set(subject.id, subjectGroup.name);
      }
    });
  } catch (error) {
    console.warn(`[fetchSubjectGroupNamesBatch] 교과명 배치 조회 실패:`, error);
  }

  return result;
}

/**
 * 콘텐츠 메타데이터 타입
 */
export type ContentMetadata = {
  title: string;
  subject_category: string;
  subject_id?: string | null; // 과목 ID (FK to subjects)
  subject_group_name?: string | null; // 교과명 (subject_groups.name)
  total_pages?: number; // 교재인 경우
  total_episodes?: number; // 강의인 경우
  subject?: string | null;
  semester?: string | null;
  revision?: string | null;
  /** @deprecated difficulty_level_id를 사용하세요. 하위 호환성을 위해 유지됩니다. */
  difficulty_level?: string | null;
  difficulty_level_id?: string | null;
  publisher?: string | null; // 교재인 경우
  platform?: string | null; // 강의인 경우
};

/**
 * 콘텐츠 메타데이터 조회 (서버 사이드)
 * 학생 콘텐츠 또는 마스터 콘텐츠의 메타데이터를 조회합니다.
 */
export async function fetchContentMetadata(
  contentId: string,
  contentType: "book" | "lecture",
  studentId?: string
): Promise<ContentMetadata> {
  const supabase = await createSupabaseServerClient();

  try {
    // 1. 학생 콘텐츠인 경우 먼저 조회
    if (studentId) {
      if (contentType === "book") {
        const { data: studentBook, error: studentError } = await supabase
          .from("books")
          .select("id, title, subject_category, subject_id, master_content_id, subject, semester, revision, difficulty_level, publisher")
          .eq("id", contentId)
          .eq("student_id", studentId)
          .maybeSingle();

        if (studentError) {
          throw new PlanGroupError(
            `학생 교재 조회 실패: ${studentError.message}`,
            PlanGroupErrorCodes.CONTENT_FETCH_FAILED,
            "콘텐츠 정보를 불러올 수 없습니다.",
            true,
            { contentId, contentType, studentId }
          );
        }

        if (studentBook) {
          // master_content_id가 있으면 원본 마스터 콘텐츠에서 subject_category 조회
          if (studentBook.master_content_id) {
            const { data: masterBook } = await supabase
              .from("master_books")
              .select("subject_category, subject_id, total_pages")
              .eq("id", studentBook.master_content_id)
              .maybeSingle();

            const finalSubjectId = studentBook.subject_id || masterBook?.subject_id || null;
            const subjectGroupName = await fetchSubjectGroupName(supabase, finalSubjectId);

            return {
              title: studentBook.title || "제목 없음",
              subject_category: masterBook?.subject_category || studentBook.subject_category || "기타",
              subject_id: finalSubjectId,
              subject_group_name: subjectGroupName,
              total_pages: masterBook?.total_pages,
              subject: studentBook.subject,
              semester: studentBook.semester,
              revision: studentBook.revision,
              difficulty_level: studentBook.difficulty_level,
              publisher: studentBook.publisher,
            };
          }

          // master_content_id가 없으면 학생 콘텐츠 정보 사용
          const subjectGroupName = await fetchSubjectGroupName(supabase, studentBook.subject_id);

          return {
            title: studentBook.title || "제목 없음",
            subject_category: studentBook.subject_category || "기타",
            subject_id: studentBook.subject_id || null,
            subject_group_name: subjectGroupName,
            subject: studentBook.subject,
            semester: studentBook.semester,
            revision: studentBook.revision,
            difficulty_level: studentBook.difficulty_level,
            publisher: studentBook.publisher,
          };
        }
      } else {
        // lecture
        const { data: studentLecture, error: studentError } = await supabase
          .from("lectures")
          .select("id, title, subject_category, subject_id, master_content_id, subject, semester, revision, difficulty_level, platform")
          .eq("id", contentId)
          .eq("student_id", studentId)
          .maybeSingle();

        if (studentError) {
          throw new PlanGroupError(
            `학생 강의 조회 실패: ${studentError.message}`,
            PlanGroupErrorCodes.CONTENT_FETCH_FAILED,
            "콘텐츠 정보를 불러올 수 없습니다.",
            true,
            { contentId, contentType, studentId }
          );
        }

        if (studentLecture) {
          // master_content_id가 있으면 원본 마스터 콘텐츠에서 subject_category 조회
          if (studentLecture.master_content_id) {
            const { data: masterLecture } = await supabase
              .from("master_lectures")
              .select("subject_category, subject_id, total_episodes")
              .eq("id", studentLecture.master_content_id)
              .maybeSingle();

            const finalSubjectId = studentLecture.subject_id || masterLecture?.subject_id || null;
            const subjectGroupName = await fetchSubjectGroupName(supabase, finalSubjectId);

            return {
              title: studentLecture.title || "제목 없음",
              subject_category: masterLecture?.subject_category || studentLecture.subject_category || "기타",
              subject_id: finalSubjectId,
              subject_group_name: subjectGroupName,
              total_episodes: masterLecture?.total_episodes,
              subject: studentLecture.subject,
              semester: studentLecture.semester,
              revision: studentLecture.revision,
              difficulty_level: studentLecture.difficulty_level,
              platform: studentLecture.platform,
            };
          }

          // master_content_id가 없으면 학생 콘텐츠 정보 사용
          const subjectGroupName = await fetchSubjectGroupName(supabase, studentLecture.subject_id);

          return {
            title: studentLecture.title || "제목 없음",
            subject_category: studentLecture.subject_category || "기타",
            subject_id: studentLecture.subject_id || null,
            subject_group_name: subjectGroupName,
            subject: studentLecture.subject,
            semester: studentLecture.semester,
            revision: studentLecture.revision,
            difficulty_level: studentLecture.difficulty_level,
            platform: studentLecture.platform,
          };
        }
      }
    }

    // 2. 마스터 콘텐츠 조회 (학생 콘텐츠가 없거나 studentId가 없는 경우)
    if (contentType === "book") {
      const { data: masterBook, error: masterError } = await supabase
        .from("master_books")
        .select("title, subject_category, subject_id, total_pages, subject, semester, revision, difficulty_level, publisher")
        .eq("id", contentId)
        .maybeSingle();

      if (masterError) {
        throw new PlanGroupError(
          `마스터 교재 조회 실패: ${masterError.message}`,
          PlanGroupErrorCodes.CONTENT_NOT_FOUND,
          "콘텐츠를 찾을 수 없습니다.",
          false,
          { contentId, contentType }
        );
      }

      if (!masterBook) {
        throw new PlanGroupError(
          `마스터 교재를 찾을 수 없습니다: ${contentId}`,
          PlanGroupErrorCodes.CONTENT_NOT_FOUND,
          "콘텐츠를 찾을 수 없습니다.",
          false,
          { contentId, contentType }
        );
      }

      const subjectGroupName = await fetchSubjectGroupName(supabase, masterBook.subject_id);

      return {
        title: masterBook.title || "제목 없음",
        subject_category: masterBook.subject_category || "기타",
        subject_id: masterBook.subject_id || null,
        subject_group_name: subjectGroupName,
        total_pages: masterBook.total_pages,
        subject: masterBook.subject,
        semester: masterBook.semester,
        revision: masterBook.revision,
        difficulty_level: masterBook.difficulty_level,
        publisher: masterBook.publisher,
      };
    } else {
      // lecture
      const { data: masterLecture, error: masterError } = await supabase
        .from("master_lectures")
        .select("title, subject_category, subject_id, total_episodes, subject, semester, revision, difficulty_level, platform")
        .eq("id", contentId)
        .maybeSingle();

      if (masterError) {
        throw new PlanGroupError(
          `마스터 강의 조회 실패: ${masterError.message}`,
          PlanGroupErrorCodes.CONTENT_NOT_FOUND,
          "콘텐츠를 찾을 수 없습니다.",
          false,
          { contentId, contentType }
        );
      }

      if (!masterLecture) {
        throw new PlanGroupError(
          `마스터 강의를 찾을 수 없습니다: ${contentId}`,
          PlanGroupErrorCodes.CONTENT_NOT_FOUND,
          "콘텐츠를 찾을 수 없습니다.",
          false,
          { contentId, contentType }
        );
      }

      const subjectGroupName = await fetchSubjectGroupName(supabase, masterLecture.subject_id);

      return {
        title: masterLecture.title || "제목 없음",
        subject_category: masterLecture.subject_category || "기타",
        subject_id: masterLecture.subject_id || null,
        subject_group_name: subjectGroupName,
        total_episodes: masterLecture.total_episodes,
        subject: masterLecture.subject,
        semester: masterLecture.semester,
        revision: masterLecture.revision,
        difficulty_level: masterLecture.difficulty_level,
        platform: masterLecture.platform,
      };
    }
  } catch (error) {
    if (error instanceof PlanGroupError) {
      throw error;
    }
    throw new PlanGroupError(
      `콘텐츠 메타데이터 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
      PlanGroupErrorCodes.CONTENT_METADATA_FETCH_FAILED,
      "콘텐츠 정보를 불러올 수 없습니다.",
      true,
      { contentId, contentType, studentId }
    );
  }
}

/**
 * 여러 콘텐츠의 메타데이터를 배치로 조회 (성능 최적화)
 * 개별 쿼리 대신 배치 쿼리 사용하여 N+1 문제 해결
 */
export async function fetchContentMetadataBatch(
  contents: Array<{
    content_id: string;
    content_type: "book" | "lecture";
  }>,
  studentId?: string
): Promise<Map<string, ContentMetadata>> {
  const results = new Map<string, ContentMetadata>();
  const supabase = await createSupabaseServerClient();

  // 콘텐츠를 타입별로 그룹화
  const bookIds: string[] = [];
  const lectureIds: string[] = [];
  const contentMap = new Map<string, { content_id: string; content_type: "book" | "lecture" }>();
  
  contents.forEach((content) => {
    contentMap.set(content.content_id, content);
    if (content.content_type === "book") {
      bookIds.push(content.content_id);
    } else {
      lectureIds.push(content.content_id);
    }
  });

  try {
    // 학생 콘텐츠가 있는 경우: 학생 콘텐츠를 배치로 조회
    if (studentId) {
      // 학생 교재 배치 조회
      if (bookIds.length > 0) {
        const { data: studentBooks, error: booksError } = await supabase
          .from("books")
          .select("id, title, subject_category, subject_id, master_content_id, subject, semester, revision, difficulty_level, publisher")
          .eq("student_id", studentId)
          .in("id", bookIds);

        if (!booksError && studentBooks) {
          // 마스터 콘텐츠 ID 수집
          const masterBookIds = studentBooks
            .map((book) => book.master_content_id)
            .filter((id): id is string => id !== null);

          // 마스터 교재 배치 조회 (필요한 경우)
          const masterBooksMap = new Map<string, { subject_category?: string | null; subject_id?: string | null; total_pages?: number | null }>();
          if (masterBookIds.length > 0) {
            const { data: masterBooks } = await supabase
              .from("master_books")
              .select("id, subject_category, subject_id, total_pages")
              .in("id", masterBookIds);

            if (masterBooks) {
              masterBooks.forEach((book) => {
                masterBooksMap.set(book.id, {
                  subject_category: book.subject_category,
                  subject_id: book.subject_id,
                  total_pages: book.total_pages,
                });
              });
            }
          }

          // subject_id 수집 (교과명 조회용)
          const allSubjectIds = studentBooks
            .map((book) => {
              const masterBook = book.master_content_id ? masterBooksMap.get(book.master_content_id) : null;
              return book.subject_id || masterBook?.subject_id || null;
            })
            .filter((id): id is string => id !== null);

          // 교과명 배치 조회
          const subjectGroupNamesMap = await fetchSubjectGroupNamesBatch(supabase, allSubjectIds);

          // 학생 교재 메타데이터 매핑
          studentBooks.forEach((book) => {
            const masterBook = book.master_content_id
              ? masterBooksMap.get(book.master_content_id)
              : null;
            
            const finalSubjectId = book.subject_id || masterBook?.subject_id || null;
            const subjectGroupName = finalSubjectId ? subjectGroupNamesMap.get(finalSubjectId) || null : null;
            
            results.set(book.id, {
              title: book.title || "제목 없음",
              subject_category: masterBook?.subject_category || book.subject_category || "기타",
              subject_id: finalSubjectId,
              subject_group_name: subjectGroupName,
              total_pages: masterBook?.total_pages ?? undefined,
              subject: book.subject,
              semester: book.semester,
              revision: book.revision,
              difficulty_level: book.difficulty_level,
              publisher: book.publisher,
            });
          });
        }
      }

      // 학생 강의 배치 조회
      if (lectureIds.length > 0) {
        const { data: studentLectures, error: lecturesError } = await supabase
          .from("lectures")
          .select("id, title, subject_category, subject_id, master_content_id, subject, semester, revision, difficulty_level, platform")
          .eq("student_id", studentId)
          .in("id", lectureIds);

        if (!lecturesError && studentLectures) {
          // 마스터 콘텐츠 ID 수집
          const masterLectureIds = studentLectures
            .map((lecture) => lecture.master_content_id)
            .filter((id): id is string => id !== null);

          // 마스터 강의 배치 조회 (필요한 경우)
          const masterLecturesMap = new Map<string, { subject_category?: string | null; subject_id?: string | null; total_episodes?: number | null }>();
          if (masterLectureIds.length > 0) {
            const { data: masterLectures } = await supabase
              .from("master_lectures")
              .select("id, subject_category, subject_id, total_episodes")
              .in("id", masterLectureIds);

            if (masterLectures) {
              masterLectures.forEach((lecture) => {
                masterLecturesMap.set(lecture.id, {
                  subject_category: lecture.subject_category,
                  subject_id: lecture.subject_id,
                  total_episodes: lecture.total_episodes,
                });
              });
            }
          }

          // subject_id 수집 (교과명 조회용)
          const allSubjectIds = studentLectures
            .map((lecture) => {
              const masterLecture = lecture.master_content_id ? masterLecturesMap.get(lecture.master_content_id) : null;
              return lecture.subject_id || masterLecture?.subject_id || null;
            })
            .filter((id): id is string => id !== null);

          // 교과명 배치 조회
          const subjectGroupNamesMap = await fetchSubjectGroupNamesBatch(supabase, allSubjectIds);

          // 학생 강의 메타데이터 매핑
          studentLectures.forEach((lecture) => {
            const masterLecture = lecture.master_content_id
              ? masterLecturesMap.get(lecture.master_content_id)
              : null;
            
            const finalSubjectId = lecture.subject_id || masterLecture?.subject_id || null;
            const subjectGroupName = finalSubjectId ? subjectGroupNamesMap.get(finalSubjectId) || null : null;
            
            results.set(lecture.id, {
              title: lecture.title || "제목 없음",
              subject_category: masterLecture?.subject_category || lecture.subject_category || "기타",
              subject_id: finalSubjectId,
              subject_group_name: subjectGroupName,
              total_episodes: masterLecture?.total_episodes ?? undefined,
              subject: lecture.subject,
              semester: lecture.semester,
              revision: lecture.revision,
              difficulty_level: lecture.difficulty_level,
              platform: lecture.platform,
            });
          });
        }
      }
    }

    // 마스터 콘텐츠 조회 (학생 콘텐츠가 없거나 studentId가 없는 경우)
    // 학생 콘텐츠에서 찾지 못한 항목들만 마스터에서 조회
    const missingBookIds = bookIds.filter((id) => !results.has(id));
    const missingLectureIds = lectureIds.filter((id) => !results.has(id));

    // 마스터 교재 배치 조회
    if (missingBookIds.length > 0) {
      const { data: masterBooks, error: masterBooksError } = await supabase
        .from("master_books")
        .select("id, title, subject_category, subject_id, total_pages, subject, semester, revision, difficulty_level, publisher")
        .in("id", missingBookIds);

      if (!masterBooksError && masterBooks) {
        // subject_id 수집 (교과명 조회용)
        const allSubjectIds = masterBooks
          .map((book) => book.subject_id)
          .filter((id): id is string => id !== null);

        // 교과명 배치 조회
        const subjectGroupNamesMap = await fetchSubjectGroupNamesBatch(supabase, allSubjectIds);

        masterBooks.forEach((book) => {
          const subjectGroupName = book.subject_id ? subjectGroupNamesMap.get(book.subject_id) || null : null;
          
          results.set(book.id, {
            title: book.title || "제목 없음",
            subject_category: book.subject_category || "기타",
            subject_id: book.subject_id || null,
            subject_group_name: subjectGroupName,
            total_pages: book.total_pages,
            subject: book.subject,
            semester: book.semester,
            revision: book.revision,
            difficulty_level: book.difficulty_level,
            publisher: book.publisher,
          });
        });
      }
    }

    // 마스터 강의 배치 조회
    if (missingLectureIds.length > 0) {
      const { data: masterLectures, error: masterLecturesError } = await supabase
        .from("master_lectures")
        .select("id, title, subject_category, subject_id, total_episodes, subject, semester, revision, difficulty_level, platform")
        .in("id", missingLectureIds);

      if (!masterLecturesError && masterLectures) {
        // subject_id 수집 (교과명 조회용)
        const allSubjectIds = masterLectures
          .map((lecture) => lecture.subject_id)
          .filter((id): id is string => id !== null);

        // 교과명 배치 조회
        const subjectGroupNamesMap = await fetchSubjectGroupNamesBatch(supabase, allSubjectIds);

        masterLectures.forEach((lecture) => {
          const subjectGroupName = lecture.subject_id ? subjectGroupNamesMap.get(lecture.subject_id) || null : null;
          
          results.set(lecture.id, {
            title: lecture.title || "제목 없음",
            subject_category: lecture.subject_category || "기타",
            subject_id: lecture.subject_id || null,
            subject_group_name: subjectGroupName,
            total_episodes: lecture.total_episodes,
            subject: lecture.subject,
            semester: lecture.semester,
            revision: lecture.revision,
            difficulty_level: lecture.difficulty_level,
            platform: lecture.platform,
          });
        });
      }
    }
  } catch (error) {
    console.error("[fetchContentMetadataBatch] 배치 조회 실패:", error);
    // 에러 발생 시 빈 Map 반환 (기존 동작 유지)
  }

  return results;
}

// ============================================
// Education Metadata Types
// ============================================

export type CurriculumRevision = {
  id: string;
  name: string;
  year?: number | null; // 개정교육과정 연도 (예: 2015, 2022)
  display_order?: number; // 표시 순서
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};


export type SubjectCategory = {
  id: string;
  name: string;
  code?: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Subject = {
  id: string;
  subject_category_id: string;
  name: string;
  code?: string | null;
  subject_type?: "common" | "elective" | "research" | "social" | null;
  display_order?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Platform = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Publisher = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

// ============================================
// Curriculum Revisions CRUD
// ============================================

export async function getCurriculumRevisions(): Promise<CurriculumRevision[]> {
  try {
    // Admin 클라이언트 우선 사용 (RLS 우회)
    const supabase = await getSupabaseClientForRLSBypass();
    
    const { data, error } = await supabase
      .from("curriculum_revisions")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      // 에러 객체의 모든 속성을 상세히 로깅
      console.error("[contentMetadata] 개정교육과정 조회 실패", {
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        errorHint: error.hint,
        errorStringified: JSON.stringify(error, null, 2),
      });
      
      // 에러 메시지가 없을 경우를 대비한 처리
      const errorMessage = error.message || error.details || error.hint || "알 수 없는 오류";
      throw new Error(`개정교육과정 조회 실패: ${errorMessage}`);
    }

    return (data as CurriculumRevision[]) ?? [];
  } catch (error) {
    // 예상치 못한 에러 처리
    console.error("[contentMetadata] getCurriculumRevisions 예외 발생", {
      error,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorStringified: error instanceof Error 
        ? JSON.stringify({ message: error.message, stack: error.stack }, null, 2)
        : JSON.stringify(error, null, 2),
    });
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error(`개정교육과정 조회 실패: ${String(error)}`);
  }
}

export async function createCurriculumRevision(
  name: string,
  displayOrder?: number
): Promise<CurriculumRevision> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("curriculum_revisions")
    .insert({ name, display_order: displayOrder })
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 개정교육과정 생성 실패", error);

    // 중복 키 에러 처리
    if (error.code === "23505") {
      if (error.message.includes("curriculum_revisions_name_key")) {
        throw new Error(`이미 존재하는 개정교육과정명입니다: "${name}"`);
      }
      throw new Error("이미 존재하는 데이터입니다.");
    }

    throw new Error(`개정교육과정 생성 실패: ${error.message}`);
  }

  return data as CurriculumRevision;
}

export async function updateCurriculumRevision(
  id: string,
  updates: Partial<{ name: string; is_active: boolean }>
): Promise<CurriculumRevision> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("curriculum_revisions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 개정교육과정 수정 실패", error);

    // 중복 키 에러 처리
    if (error.code === "23505") {
      if (error.message.includes("curriculum_revisions_name_key") && updates.name) {
        throw new Error(`이미 존재하는 개정교육과정명입니다: "${updates.name}"`);
      }
      throw new Error("이미 존재하는 데이터입니다.");
    }

    throw new Error(`개정교육과정 수정 실패: ${error.message}`);
  }

  return data as CurriculumRevision;
}

export async function deleteCurriculumRevision(id: string): Promise<void> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { error } = await supabase
    .from("curriculum_revisions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[contentMetadata] 개정교육과정 삭제 실패", error);
    throw new Error(`개정교육과정 삭제 실패: ${error.message}`);
  }
}


// ============================================
// Subject Categories CRUD
// ============================================

export async function getSubjectCategories(
  revisionId?: string
): Promise<SubjectCategory[]> {
  const supabase = await createSupabaseServerClient();
  const query = supabase
    .from("subject_categories")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  // Note: If revisionId filtering is needed, it would require a join or separate table
  // For now, we'll return all subject categories
  const { data, error } = await query;

  if (error) {
    console.error("[contentMetadata] 교과 조회 실패", error);
    throw new Error(`교과 조회 실패: ${error.message}`);
  }

  return (data as SubjectCategory[]) ?? [];
}

export async function createSubjectCategory(
  revision_id: string,
  name: string,
  display_order: number
): Promise<SubjectCategory> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subject_categories")
    .insert({ name, display_order })
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 교과 생성 실패", error);
    throw new Error(`교과 생성 실패: ${error.message}`);
  }

  return data as SubjectCategory;
}

export async function updateSubjectCategory(
  id: string,
  updates: Partial<{
    name: string;
    display_order: number;
    is_active: boolean;
  }>
): Promise<SubjectCategory> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subject_categories")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 교과 수정 실패", error);
    throw new Error(`교과 수정 실패: ${error.message}`);
  }

  return data as SubjectCategory;
}

export async function deleteSubjectCategory(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("subject_categories")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[contentMetadata] 교과 삭제 실패", error);
    throw new Error(`교과 삭제 실패: ${error.message}`);
  }
}

// ============================================
// Subjects CRUD
// ============================================

export async function getSubjects(
  subjectCategoryId?: string
): Promise<Subject[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("subjects")
    .select("*")
    .order("name", { ascending: true });

  if (subjectCategoryId) {
    query = query.eq("subject_category_id", subjectCategoryId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[contentMetadata] 과목 조회 실패", error);
    throw new Error(`과목 조회 실패: ${error.message}`);
  }

  return (data as Subject[]) ?? [];
}

export async function createSubject(
  subject_category_id: string,
  name: string,
  display_order?: number
): Promise<Subject> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .insert({ subject_category_id, name, display_order })
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 과목 생성 실패", error);
    throw new Error(`과목 생성 실패: ${error.message}`);
  }

  return data as Subject;
}

export async function updateSubject(
  id: string,
  updates: Partial<{
    name: string;
    is_active: boolean;
  }>
): Promise<Subject> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 과목 수정 실패", error);
    throw new Error(`과목 수정 실패: ${error.message}`);
  }

  return data as Subject;
}

export async function deleteSubject(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("subjects").delete().eq("id", id);

  if (error) {
    console.error("[contentMetadata] 과목 삭제 실패", error);
    throw new Error(`과목 삭제 실패: ${error.message}`);
  }
}

// ============================================
// Platforms CRUD
// ============================================

export async function getPlatforms(): Promise<Platform[]> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();
  
  const { data, error } = await supabase
    .from("platforms")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[contentMetadata] 플랫폼 조회 실패", error);
    throw new Error(`플랫폼 조회 실패: ${error.message}`);
  }

  return (data as Platform[]) ?? [];
}

export async function createPlatform(
  name: string,
  display_order: number
): Promise<Platform> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("platforms")
    .insert({ name, display_order })
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 플랫폼 생성 실패", error);

    // 중복 키 에러 처리
    if (error.code === "23505") {
      if (error.message.includes("platforms_name_key")) {
        throw new Error(`이미 존재하는 플랫폼명입니다: "${name}"`);
      }
      throw new Error("이미 존재하는 데이터입니다.");
    }

    throw new Error(`플랫폼 생성 실패: ${error.message}`);
  }

  return data as Platform;
}

export async function updatePlatform(
  id: string,
  updates: Partial<{ name: string; display_order: number; is_active: boolean }>
): Promise<Platform> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("platforms")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 플랫폼 수정 실패", error);

    // 중복 키 에러 처리
    if (error.code === "23505") {
      if (error.message.includes("platforms_name_key") && updates.name) {
        throw new Error(`이미 존재하는 플랫폼명입니다: "${updates.name}"`);
      }
      throw new Error("이미 존재하는 데이터입니다.");
    }

    throw new Error(`플랫폼 수정 실패: ${error.message}`);
  }

  return data as Platform;
}

export async function deletePlatform(id: string): Promise<void> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { error } = await supabase.from("platforms").delete().eq("id", id);

  if (error) {
    console.error("[contentMetadata] 플랫폼 삭제 실패", error);
    throw new Error(`플랫폼 삭제 실패: ${error.message}`);
  }
}

// ============================================
// Publishers CRUD
// ============================================

export async function getPublishers(): Promise<Publisher[]> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();
  
  const { data, error } = await supabase
    .from("publishers")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[contentMetadata] 출판사 조회 실패", error);
    throw new Error(`출판사 조회 실패: ${error.message}`);
  }

  return (data as Publisher[]) ?? [];
}

export async function createPublisher(
  name: string,
  display_order: number
): Promise<Publisher> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("publishers")
    .insert({ name, display_order })
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 출판사 생성 실패", error);

    // 중복 키 에러 처리
    if (error.code === "23505") {
      if (error.message.includes("publishers_name_key")) {
        throw new Error(`이미 존재하는 출판사명입니다: "${name}"`);
      }
      throw new Error("이미 존재하는 데이터입니다.");
    }

    throw new Error(`출판사 생성 실패: ${error.message}`);
  }

  return data as Publisher;
}

export async function updatePublisher(
  id: string,
  updates: Partial<{ name: string; display_order: number; is_active: boolean }>
): Promise<Publisher> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("publishers")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 출판사 수정 실패", error);

    // 중복 키 에러 처리
    if (error.code === "23505") {
      if (error.message.includes("publishers_name_key") && updates.name) {
        throw new Error(`이미 존재하는 출판사명입니다: "${updates.name}"`);
      }
      throw new Error("이미 존재하는 데이터입니다.");
    }

    throw new Error(`출판사 수정 실패: ${error.message}`);
  }

  return data as Publisher;
}

export async function deletePublisher(id: string): Promise<void> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { error } = await supabase.from("publishers").delete().eq("id", id);

  if (error) {
    console.error("[contentMetadata] 출판사 삭제 실패", error);
    throw new Error(`출판사 삭제 실패: ${error.message}`);
  }
}