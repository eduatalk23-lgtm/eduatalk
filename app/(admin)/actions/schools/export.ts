"use server";

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { exportToExcel } from "@/lib/utils/excel";

/**
 * 학교 관리 데이터를 Excel 파일로 다운로드
 */
export async function exportSchoolsToExcel(): Promise<Buffer> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("데이터베이스 연결에 실패했습니다.");
  }

  // 전체 학교 데이터 조회
  const { data: schools, error } = await supabase
    .from("schools")
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`학교 데이터 조회 실패: ${error.message}`);
  }

  // Excel 시트 데이터 준비
  const sheets = {
    schools: (schools || []).map((school) => ({
      id: school.id,
      name: school.name,
      type: school.type ?? "",
      region_id: school.region_id ?? "",
      address: school.address ?? "",
      postal_code: school.postal_code ?? "",
      address_detail: school.address_detail ?? "",
      city: school.city ?? "",
      district: school.district ?? "",
      phone: school.phone ?? "",
      category: school.category ?? "",
      university_type: school.university_type ?? "",
      university_ownership: school.university_ownership ?? "",
      campus_name: school.campus_name ?? "",
      display_order: school.display_order ?? 0,
      is_active: school.is_active ?? true,
      created_at: school.created_at ?? "",
      updated_at: school.updated_at ?? "",
    })),
  };

  return await exportToExcel(sheets);
}

/**
 * 학교 관리 양식 파일 다운로드
 */
export async function downloadSchoolsTemplate(): Promise<Buffer> {
  const { role } = await getCurrentUserRole();
  if (role !== "admin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const sheets = {
    schools: [
      "id",
      "name",
      "type",
      "region_id",
      "address",
      "postal_code",
      "address_detail",
      "city",
      "district",
      "phone",
      "category",
      "university_type",
      "university_ownership",
      "campus_name",
      "display_order",
      "is_active",
      "created_at",
      "updated_at",
    ],
  };

  const { generateTemplateExcel } = await import("@/lib/utils/excel");
  return await generateTemplateExcel(sheets);
}

