"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseExcelFile, validateExcelFile } from "@/lib/utils/excel";
import { z } from "zod";

// Zod 스키마 정의
const schoolSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.enum(["중학교", "고등학교", "대학교"]).optional().nullable(),
  region_id: z.string().uuid().optional().nullable(),
  address: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  address_detail: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  category: z.enum(["일반고", "특목고", "자사고", "특성화고"]).optional().nullable(),
  university_type: z.enum(["4년제", "2년제"]).optional().nullable(),
  university_ownership: z.enum(["국립", "사립"]).optional().nullable(),
  campus_name: z.string().optional().nullable(),
  display_order: z.union([z.number(), z.string()]).default(0).transform((val) => {
    if (typeof val === "string") {
      const num = parseInt(val, 10);
      return isNaN(num) ? 0 : num;
    }
    return val ?? 0;
  }),
  is_active: z.union([z.boolean(), z.string()]).default(true).transform((val) => {
    if (typeof val === "string") {
      return val === "true" || val === "1" || val === "on";
    }
    return val ?? true;
  }),
});

/**
 * 학교 관리 데이터를 Excel 파일에서 가져와 전체 교체
 */
export async function importSchoolsFromExcel(
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
  const validation = validateExcelFile(buffer, ["schools"]);
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
      .from("schools")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteError) {
      throw new Error(`기존 데이터 삭제 실패: ${deleteError.message}`);
    }

    // 2. 새 데이터 삽입
    const schoolsData = sheets.schools || [];
    const schoolsToInsert: any[] = [];

    for (const row of schoolsData) {
      try {
        const validated = schoolSchema.parse(row);
        
        const schoolData: any = {
          name: validated.name,
          type: validated.type || null,
          region_id: validated.region_id || null,
          address: validated.address || null,
          postal_code: validated.postal_code || null,
          address_detail: validated.address_detail || null,
          city: validated.city || null,
          district: validated.district || null,
          phone: validated.phone || null,
          category: validated.category || null,
          university_type: validated.university_type || null,
          university_ownership: validated.university_ownership || null,
          campus_name: validated.campus_name || null,
          display_order: validated.display_order,
          is_active: validated.is_active,
        };

        // ID가 있으면 포함
        if (validated.id) {
          schoolData.id = validated.id;
        }

        schoolsToInsert.push(schoolData);
      } catch (error) {
        errors.push(
          `학교 처리 실패 (${JSON.stringify(row)}): ${error instanceof Error ? error.message : "알 수 없는 오류"}`
        );
      }
    }

    // 배치 삽입 (Supabase는 최대 1000개까지 한 번에 삽입 가능)
    const batchSize = 1000;
    for (let i = 0; i < schoolsToInsert.length; i += batchSize) {
      const batch = schoolsToInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("schools")
        .insert(batch);

      if (insertError) {
        throw new Error(`데이터 삽입 실패: ${insertError.message}`);
      }
    }

    revalidatePath("/admin/schools");

    if (errors.length > 0) {
      return {
        success: true,
        message: `데이터를 가져왔지만 일부 오류가 발생했습니다. (${errors.length}개 오류)`,
        errors,
      };
    }

    return {
      success: true,
      message: `데이터를 성공적으로 가져왔습니다. (${schoolsToInsert.length}개 학교)`,
    };
  } catch (error) {
    return {
      success: false,
      message: `데이터 가져오기 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      errors: [error instanceof Error ? error.message : "알 수 없는 오류"],
    };
  }
}

