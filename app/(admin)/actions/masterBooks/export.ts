"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exportToExcel } from "@/lib/utils/excel";

/**
 * 교재 관리 데이터를 Excel 파일로 다운로드
 */
export async function exportMasterBooksToExcel(): Promise<Buffer> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("데이터베이스 연결에 실패했습니다.");
  }

  // 전체 교재 데이터 조회
  const { data: books, error } = await supabase
    .from("master_books")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`교재 데이터 조회 실패: ${error.message}`);
  }

  // Excel 시트 데이터 준비
  const sheets = {
    master_books: (books || []).map((book) => ({
      id: book.id,
      tenant_id: book.tenant_id ?? "",
      is_active: book.is_active ?? true,
      curriculum_revision_id: book.curriculum_revision_id ?? "",
      subject_id: book.subject_id ?? "",
      grade_min: book.grade_min ?? "",
      grade_max: book.grade_max ?? "",
      school_type: book.school_type ?? "",
      revision: book.revision ?? "",
      content_category: book.content_category ?? "",
      // semester 필드 제거됨 (2025-02-04)
      title: book.title,
      subtitle: book.subtitle ?? "",
      series_name: book.series_name ?? "",
      author: book.author ?? "",
      publisher_id: book.publisher_id ?? "",
      publisher_name: book.publisher_name ?? "",
      isbn_10: book.isbn_10 ?? "",
      isbn_13: book.isbn_13 ?? "",
      edition: book.edition ?? "",
      published_date: book.published_date ?? "",
      total_pages: book.total_pages ?? "",
      target_exam_type: Array.isArray(book.target_exam_type) ? book.target_exam_type.join(", ") : "",
      description: book.description ?? "",
      toc: book.toc ?? "",
      publisher_review: book.publisher_review ?? "",
      tags: Array.isArray(book.tags) ? book.tags.join(", ") : "",
      source: book.source ?? "",
      source_product_code: book.source_product_code ?? "",
      source_url: book.source_url ?? "",
      cover_image_url: book.cover_image_url ?? "",
      difficulty_level: book.difficulty_level ?? "",
      notes: book.notes ?? "",
      pdf_url: book.pdf_url ?? "",
      overall_difficulty: book.overall_difficulty ?? "",
      created_at: book.created_at ?? "",
      updated_at: book.updated_at ?? "",
    })),
  };

  return exportToExcel(sheets);
}

/**
 * 교재 관리 양식 파일 다운로드
 */
export async function downloadMasterBooksTemplate(): Promise<Buffer> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const sheets = {
    master_books: [
      "id",
      "tenant_id",
      "is_active",
      "curriculum_revision_id",
      "subject_id",
      "grade_min",
      "grade_max",
      "school_type",
      "revision",
      "content_category",
      // "semester", // 제거됨 (2025-02-04)
      "title",
      "subtitle",
      "series_name",
      "author",
      "publisher_id",
      "publisher_name",
      "isbn_10",
      "isbn_13",
      "edition",
      "published_date",
      "total_pages",
      "target_exam_type",
      "description",
      "toc",
      "publisher_review",
      "tags",
      "source",
      "source_product_code",
      "source_url",
      "cover_image_url",
      "difficulty_level",
      "notes",
      "pdf_url",
      "overall_difficulty",
      "created_at",
      "updated_at",
    ],
  };

  const { generateTemplateExcel } = await import("@/lib/utils/excel");
  return generateTemplateExcel(sheets);
}

