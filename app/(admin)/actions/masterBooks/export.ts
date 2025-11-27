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
      revision: book.revision ?? "",
      content_category: book.content_category ?? "",
      semester: book.semester ?? "",
      subject_category: book.subject_category ?? "",
      subject: book.subject ?? "",
      title: book.title,
      publisher: book.publisher ?? "",
      total_pages: book.total_pages,
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
      "revision",
      "content_category",
      "semester",
      "subject_category",
      "subject",
      "title",
      "publisher",
      "total_pages",
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

