"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseExcelFile, validateExcelFile } from "@/lib/utils/excel";
import { z } from "zod";

// Zod 스키마 정의
const masterLectureSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional().nullable(),
  linked_book_id: z.string().uuid().optional().nullable(),
  revision: z.string().optional().nullable(),
  content_category: z.string().optional().nullable(),
  semester: z.string().optional().nullable(),
  subject_category: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  title: z.string().min(1),
  platform: z.string().optional().nullable(),
  instructor: z.string().optional().nullable(),
  total_episodes: z.union([z.number(), z.string()]).optional().nullable().transform((val) => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "string") {
      const num = parseInt(val, 10);
      return isNaN(num) ? null : num;
    }
    return val;
  }),
  difficulty_level: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  video_url: z.string().optional().nullable(),
  overall_difficulty: z.union([z.number(), z.string()]).optional().nullable().transform((val) => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "string") {
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    }
    return val;
  }),
});

/**
 * 강의 관리 데이터를 Excel 파일에서 가져와 전체 교체
 */
export async function importMasterLecturesFromExcel(
  fileBuffer: Buffer | Uint8Array
): Promise<{ success: boolean; message: string; errors?: string[] }> {
  // Uint8Array를 Buffer로 변환
  const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
  // 권한 확인 (admin만 허용)
  const { role } = await requireAdminOrConsultant();
  if (role !== "admin" && role !== "superadmin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("데이터베이스 연결에 실패했습니다.");
  }

  // Excel 파일 검증
  const validation = await validateExcelFile(buffer, ["master_lectures"]);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error || "Excel 파일 검증에 실패했습니다.",
    };
  }

  // Excel 파일 파싱
  const sheets = await parseExcelFile(buffer);
  const errors: string[] = [];

  try {
    // 1. 기존 데이터 삭제
    const { error: deleteError } = await supabase
      .from("master_lectures")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteError) {
      throw new Error(`기존 데이터 삭제 실패: ${deleteError.message}`);
    }

    // 2. 새 데이터 삽입
    const lecturesData = sheets.master_lectures || [];
    const lecturesToInsert: Array<{
      id?: string;
      title: string;
      tenant_id?: string | null;
      linked_book_id?: string | null;
      revision?: string | null;
      content_category?: string | null;
      semester?: string | null;
      subject_category?: string | null;
      subject?: string | null;
      platform?: string | null;
      instructor?: string | null;
      total_episodes?: number | null;
      difficulty_level?: string | null;
      difficulty_level_id?: string | null;
      duration?: number | null;
      notes?: string | null;
      video_url?: string | null;
      overall_difficulty?: number | null;
    }> = [];

    for (const row of lecturesData) {
      try {
        const validated = masterLectureSchema.parse(row);
        
        const lectureData: {
          id?: string;
          title: string;
          tenant_id?: string | null;
          linked_book_id?: string | null;
          revision?: string | null;
          content_category?: string | null;
          semester?: string | null;
          subject_category?: string | null;
          subject?: string | null;
          platform?: string | null;
          instructor?: string | null;
          total_episodes?: number | null;
          difficulty_level?: string | null;
          difficulty_level_id?: string | null;
          duration?: number | null;
          notes?: string | null;
          video_url?: string | null;
          overall_difficulty?: number | null;
        } = {
          title: validated.title,
          tenant_id: validated.tenant_id || null,
          linked_book_id: validated.linked_book_id || null,
          revision: validated.revision || null,
          content_category: validated.content_category || null,
          semester: validated.semester || null,
          subject_category: validated.subject_category || null,
          subject: validated.subject || null,
          platform: validated.platform || null,
          instructor: validated.instructor || null,
          total_episodes: validated.total_episodes || null,
          difficulty_level: validated.difficulty_level || null,
          notes: validated.notes || null,
          video_url: validated.video_url || null,
          overall_difficulty: validated.overall_difficulty || null,
        };

        // ID가 있으면 포함
        if (validated.id) {
          lectureData.id = validated.id;
        }

        lecturesToInsert.push(lectureData);
      } catch (error) {
        errors.push(
          `강의 처리 실패 (${JSON.stringify(row)}): ${error instanceof Error ? error.message : "알 수 없는 오류"}`
        );
      }
    }

    // 배치 삽입 (Supabase는 최대 1000개까지 한 번에 삽입 가능)
    const batchSize = 1000;
    for (let i = 0; i < lecturesToInsert.length; i += batchSize) {
      const batch = lecturesToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("master_lectures")
        .insert(batch);

      if (insertError) {
        throw new Error(`데이터 삽입 실패: ${insertError.message}`);
      }
    }

    revalidatePath("/admin/master-lectures");

    if (errors.length > 0) {
      return {
        success: true,
        message: `데이터를 가져왔지만 일부 오류가 발생했습니다. (${errors.length}개 오류)`,
        errors,
      };
    }

    return {
      success: true,
      message: `데이터를 성공적으로 가져왔습니다. (${lecturesToInsert.length}개 강의)`,
    };
  } catch (error) {
    return {
      success: false,
      message: `데이터 가져오기 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      errors: [error instanceof Error ? error.message : "알 수 없는 오류"],
    };
  }
}

