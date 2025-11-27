"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseExcelFile, validateExcelFile } from "@/lib/utils/excel";
import { z } from "zod";

// Zod 스키마 정의
const masterBookSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional().nullable(),
  revision: z.string().optional().nullable(),
  content_category: z.string().optional().nullable(),
  semester: z.string().optional().nullable(),
  subject_category: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  title: z.string().min(1),
  publisher: z.string().optional().nullable(),
  total_pages: z.union([z.number(), z.string()]).transform((val) => {
    if (typeof val === "string") {
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) {
        throw new Error("total_pages는 1 이상의 숫자여야 합니다.");
      }
      return num;
    }
    if (val <= 0) {
      throw new Error("total_pages는 1 이상의 숫자여야 합니다.");
    }
    return val;
  }),
  difficulty_level: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  pdf_url: z.string().optional().nullable(),
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
 * 교재 관리 데이터를 Excel 파일에서 가져와 전체 교체
 */
export async function importMasterBooksFromExcel(
  fileBuffer: Buffer | Uint8Array
): Promise<{ success: boolean; message: string; errors?: string[] }> {
  // Uint8Array를 Buffer로 변환
  const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
  const { role } = await getCurrentUserRole();
  if (role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("데이터베이스 연결에 실패했습니다.");
  }

  // Excel 파일 검증
  const validation = validateExcelFile(buffer, ["master_books"]);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error || "Excel 파일 검증에 실패했습니다.",
    };
  }

  // Excel 파일 파싱
  const sheets = parseExcelFile(buffer);
  const errors: string[] = [];

  try {
    // 1. 기존 데이터 삭제
    const { error: deleteError } = await supabase
      .from("master_books")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteError) {
      throw new Error(`기존 데이터 삭제 실패: ${deleteError.message}`);
    }

    // 2. 새 데이터 삽입
    const booksData = sheets.master_books || [];
    const booksToInsert: any[] = [];

    for (const row of booksData) {
      try {
        const validated = masterBookSchema.parse(row);
        
        const bookData: any = {
          title: validated.title,
          total_pages: validated.total_pages,
          tenant_id: validated.tenant_id || null,
          revision: validated.revision || null,
          content_category: validated.content_category || null,
          semester: validated.semester || null,
          subject_category: validated.subject_category || null,
          subject: validated.subject || null,
          publisher: validated.publisher || null,
          difficulty_level: validated.difficulty_level || null,
          notes: validated.notes || null,
          pdf_url: validated.pdf_url || null,
          overall_difficulty: validated.overall_difficulty || null,
        };

        // ID가 있으면 포함
        if (validated.id) {
          bookData.id = validated.id;
        }

        booksToInsert.push(bookData);
      } catch (error) {
        errors.push(
          `교재 처리 실패 (${JSON.stringify(row)}): ${error instanceof Error ? error.message : "알 수 없는 오류"}`
        );
      }
    }

    // 배치 삽입 (Supabase는 최대 1000개까지 한 번에 삽입 가능)
    const batchSize = 1000;
    for (let i = 0; i < booksToInsert.length; i += batchSize) {
      const batch = booksToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("master_books")
        .insert(batch);

      if (insertError) {
        throw new Error(`데이터 삽입 실패: ${insertError.message}`);
      }
    }

    revalidatePath("/admin/master-books");

    if (errors.length > 0) {
      return {
        success: true,
        message: `데이터를 가져왔지만 일부 오류가 발생했습니다. (${errors.length}개 오류)`,
        errors,
      };
    }

    return {
      success: true,
      message: `데이터를 성공적으로 가져왔습니다. (${booksToInsert.length}개 교재)`,
    };
  } catch (error) {
    return {
      success: false,
      message: `데이터 가져오기 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      errors: [error instanceof Error ? error.message : "알 수 없는 오류"],
    };
  }
}

