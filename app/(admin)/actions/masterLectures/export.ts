"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exportToExcel } from "@/lib/utils/excel";

/**
 * 강의 관리 데이터를 Excel 파일로 다운로드
 */
export async function exportMasterLecturesToExcel(): Promise<Buffer> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("데이터베이스 연결에 실패했습니다.");
  }

  // 전체 강의 데이터 조회
  const { data: lectures, error } = await supabase
    .from("master_lectures")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`강의 데이터 조회 실패: ${error.message}`);
  }

  // Excel 시트 데이터 준비
  const sheets = {
    master_lectures: (lectures || []).map((lecture) => ({
      id: lecture.id,
      tenant_id: lecture.tenant_id ?? "",
      linked_book_id: lecture.linked_book_id ?? "",
      revision: lecture.revision ?? "",
      content_category: lecture.content_category ?? "",
      // semester 필드 제거됨 (2025-02-04)
      subject_category: lecture.subject_category ?? "",
      subject: lecture.subject ?? "",
      title: lecture.title,
      platform: lecture.platform ?? "",
      instructor: lecture.instructor ?? "",
      total_episodes: lecture.total_episodes ?? "",
      difficulty_level: lecture.difficulty_level ?? "",
      notes: lecture.notes ?? "",
      video_url: lecture.video_url ?? "",
      overall_difficulty: lecture.overall_difficulty ?? "",
      created_at: lecture.created_at ?? "",
      updated_at: lecture.updated_at ?? "",
    })),
  };

  return exportToExcel(sheets);
}

/**
 * 강의 관리 양식 파일 다운로드
 */
export async function downloadMasterLecturesTemplate(): Promise<Buffer> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const sheets = {
    master_lectures: [
      "id",
      "tenant_id",
      "linked_book_id",
      "revision",
      "content_category",
      // "semester", // 제거됨 (2025-02-04)
      "subject_category",
      "subject",
      "title",
      "platform",
      "instructor",
      "total_episodes",
      "difficulty_level",
      "notes",
      "video_url",
      "overall_difficulty",
      "created_at",
      "updated_at",
    ],
  };

  const { generateTemplateExcel } = await import("@/lib/utils/excel");
  return generateTemplateExcel(sheets);
}

