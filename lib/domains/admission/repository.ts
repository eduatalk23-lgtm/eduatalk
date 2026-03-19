// ============================================
// 대학 입시 Repository
// Phase 8.1 — 기본 조회 (이후 Phase에서 확장)
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** 대학명으로 입시 데이터 검색 */
export async function findAdmissionsByUniversity(
  universityName: string,
  dataYear?: number,
) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("university_admissions")
    .select("*")
    .ilike("university_name", `%${universityName}%`)
    .order("department_name");

  if (dataYear) {
    query = query.eq("data_year", dataYear);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** 학과명으로 입시 데이터 검색 */
export async function findAdmissionsByDepartment(
  departmentName: string,
  dataYear?: number,
) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("university_admissions")
    .select("*")
    .ilike("department_name", `%${departmentName}%`)
    .order("university_name");

  if (dataYear) {
    query = query.eq("data_year", dataYear);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** 미적분/기하 지정과목 조회 */
export async function findMathRequirements(dataYear?: number) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("university_math_requirements")
    .select("*")
    .order("university_name");

  if (dataYear) {
    query = query.eq("data_year", dataYear);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
