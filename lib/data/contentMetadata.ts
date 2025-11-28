/**
 * 콘텐츠 메타데이터 조회 유틸리티
 * TODO 주석 해결: 마스터 콘텐츠의 subject_category를 올바르게 조회
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePublicClient } from "@/lib/supabase/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";

/**
 * 콘텐츠 메타데이터 타입
 */
export type ContentMetadata = {
  title: string;
  subject_category: string;
  total_pages?: number; // 교재인 경우
  total_episodes?: number; // 강의인 경우
  subject?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
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
          .select("id, title, subject_category, master_content_id, subject, semester, revision, difficulty_level, publisher")
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
              .select("subject_category, total_pages")
              .eq("id", studentBook.master_content_id)
              .maybeSingle();

            return {
              title: studentBook.title || "제목 없음",
              subject_category: masterBook?.subject_category || studentBook.subject_category || "기타",
              total_pages: masterBook?.total_pages,
              subject: studentBook.subject,
              semester: studentBook.semester,
              revision: studentBook.revision,
              difficulty_level: studentBook.difficulty_level,
              publisher: studentBook.publisher,
            };
          }

          // master_content_id가 없으면 학생 콘텐츠 정보 사용
          return {
            title: studentBook.title || "제목 없음",
            subject_category: studentBook.subject_category || "기타",
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
          .select("id, title, subject_category, master_content_id, subject, semester, revision, difficulty_level, platform")
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
              .select("subject_category, total_episodes")
              .eq("id", studentLecture.master_content_id)
              .maybeSingle();

            return {
              title: studentLecture.title || "제목 없음",
              subject_category: masterLecture?.subject_category || studentLecture.subject_category || "기타",
              total_episodes: masterLecture?.total_episodes,
              subject: studentLecture.subject,
              semester: studentLecture.semester,
              revision: studentLecture.revision,
              difficulty_level: studentLecture.difficulty_level,
              platform: studentLecture.platform,
            };
          }

          // master_content_id가 없으면 학생 콘텐츠 정보 사용
          return {
            title: studentLecture.title || "제목 없음",
            subject_category: studentLecture.subject_category || "기타",
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
        .select("title, subject_category, total_pages, subject, semester, revision, difficulty_level, publisher")
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

      return {
        title: masterBook.title || "제목 없음",
        subject_category: masterBook.subject_category || "기타",
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
        .select("title, subject_category, total_episodes, subject, semester, revision, difficulty_level, platform")
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

      return {
        title: masterLecture.title || "제목 없음",
        subject_category: masterLecture.subject_category || "기타",
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
 */
export async function fetchContentMetadataBatch(
  contents: Array<{
    content_id: string;
    content_type: "book" | "lecture";
  }>,
  studentId?: string
): Promise<Map<string, ContentMetadata>> {
  const results = new Map<string, ContentMetadata>();
  
  // 병렬로 조회 (Promise.all 사용)
  const promises = contents.map(async (content) => {
    try {
      const metadata = await fetchContentMetadata(
        content.content_id,
        content.content_type,
        studentId
      );
      return { contentId: content.content_id, metadata };
    } catch (error) {
      // 개별 실패는 무시하고 계속 진행
      console.error(
        `[fetchContentMetadataBatch] 콘텐츠 ${content.content_id} 조회 실패:`,
        error
      );
      return null;
    }
  });

  const resolved = await Promise.all(promises);
  
  resolved.forEach((result) => {
    if (result) {
      results.set(result.contentId, result.metadata);
    }
  });

  return results;
}

// ============================================
// Education Metadata Types
// ============================================

export type CurriculumRevision = {
  id: string;
  name: string;
  year?: number | null; // 개정교육과정 연도 (예: 2015, 2022)
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
  // 관리자 작업이므로 Admin 클라이언트 우선 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  const supabase = supabaseAdmin || await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("curriculum_revisions")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("[contentMetadata] 개정교육과정 조회 실패", error);
    throw new Error(`개정교육과정 조회 실패: ${error.message}`);
  }

  return (data as CurriculumRevision[]) ?? [];
}

export async function createCurriculumRevision(
  name: string
): Promise<CurriculumRevision> {
  // 관리자 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    // Admin 클라이언트가 없으면 일반 서버 클라이언트 사용
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("curriculum_revisions")
      .insert({ name })
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

  const { data, error } = await supabaseAdmin
    .from("curriculum_revisions")
    .insert({ name })
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
  // 관리자 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    // Admin 클라이언트가 없으면 일반 서버 클라이언트 사용
    const supabase = await createSupabaseServerClient();
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

  const { data, error } = await supabaseAdmin
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
  // 관리자 작업이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    // Admin 클라이언트가 없으면 일반 서버 클라이언트 사용
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("curriculum_revisions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[contentMetadata] 개정교육과정 삭제 실패", error);
      throw new Error(`개정교육과정 삭제 실패: ${error.message}`);
    }
    return;
  }

  const { error } = await supabaseAdmin
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
  let query = supabase
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
  name: string
): Promise<Subject> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .insert({ subject_category_id, name })
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("platforms")
    .insert({ name, display_order })
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 플랫폼 생성 실패", error);
    throw new Error(`플랫폼 생성 실패: ${error.message}`);
  }

  return data as Platform;
}

export async function updatePlatform(
  id: string,
  updates: Partial<{ name: string; display_order: number; is_active: boolean }>
): Promise<Platform> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("platforms")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 플랫폼 수정 실패", error);
    throw new Error(`플랫폼 수정 실패: ${error.message}`);
  }

  return data as Platform;
}

export async function deletePlatform(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("publishers")
    .insert({ name, display_order })
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 출판사 생성 실패", error);
    throw new Error(`출판사 생성 실패: ${error.message}`);
  }

  return data as Publisher;
}

export async function updatePublisher(
  id: string,
  updates: Partial<{ name: string; display_order: number; is_active: boolean }>
): Promise<Publisher> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("publishers")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[contentMetadata] 출판사 수정 실패", error);
    throw new Error(`출판사 수정 실패: ${error.message}`);
  }

  return data as Publisher;
}

export async function deletePublisher(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("publishers").delete().eq("id", id);

  if (error) {
    console.error("[contentMetadata] 출판사 삭제 실패", error);
    throw new Error(`출판사 삭제 실패: ${error.message}`);
  }
}