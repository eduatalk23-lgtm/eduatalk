/**
 * 마스터 교재 CRUD 함수
 */

import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import type {
  MasterBook,
  BookDetail,
  MasterBookWithJoins,
} from "@/lib/types/plan";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { extractJoinedData } from "@/lib/utils/supabaseHelpers";
import { createTypedParallelQueries } from "@/lib/data/core/typedQueryBuilder";

/**
 * 교재 상세 조회 (세부 정보 포함)
 * subject_id, curriculum_revision_id, publisher_id로부터 관련 정보를 JOIN으로 조회
 *
 * @param bookId - 조회할 교재 ID
 * @param supabase - 선택적 Supabase 클라이언트 (관리자/컨설턴트가 다른 테넌트의 콘텐츠를 조회할 때 Admin 클라이언트 전달)
 */
export async function getMasterBookById(
  bookId: string,
  supabase?:
    | Awaited<ReturnType<typeof createSupabaseServerClient>>
    | ReturnType<typeof createSupabaseAdminClient>
): Promise<{
  book:
    | (MasterBook & {
        subject_category?: string | null;
        subject?: string | null;
        publisher?: string | null;
        revision?: string | null;
      })
    | null;
  details: BookDetail[];
}> {
  const queryClient = supabase || (await createSupabaseServerClient());

  // 병렬 쿼리 실행
  const [bookResult, detailsResult] = await createTypedParallelQueries(
    [
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
    ],
    {
      context: "[data/contentMasters] getMasterBookById",
      defaultValue: null,
    }
  );

  // bookResult는 단일 객체이므로 타입 처리
  const bookData = bookResult as MasterBookWithJoins | null;
  if (!bookData) {
    return {
      book: null,
      details: (detailsResult as BookDetail[] | null) ?? [],
    };
  }

  // JOIN된 데이터를 평탄화하여 표시용 필드 추가
  const curriculumRevision = extractJoinedData<{ id: string; name: string }>(
    bookData.curriculum_revisions
  );

  const subject = extractJoinedData<{
    id: string;
    name: string;
    subject_groups?: Array<{ id: string; name: string }> | null;
  }>(bookData.subjects);

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
    revision: curriculumRevision?.name || bookData.revision || null,
    subject_category: subjectGroup?.name || bookData.subject_category || null,
    subject: subject?.name || bookData.subject || null,
    publisher: bookData.publisher_name || publisher?.name || null,
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
      difficulty_level: data.difficulty_level,
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
  const updateFields: Record<string, unknown> = {};

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
    updateFields.difficulty_level = data.difficulty_level;
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
    logActionError(
      { domain: "data", action: "updateMasterBook" },
      error,
      { bookId }
    );
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
    logActionError(
      { domain: "data", action: "deleteMasterBook" },
      error,
      { bookId }
    );
    throw new Error(error.message || "교재 삭제에 실패했습니다.");
  }
}
