// ============================================
// 학교 프로파일(school_profiles) + 개설과목(school_offered_subjects) 데이터 접근
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================
// 17. 학교 프로파일 (school_profiles)
// ============================================

export async function findSchoolProfileByName(
  tenantId: string,
  schoolName: string,
): Promise<{ id: string; school_name: string; school_category: string | null; updated_at: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("school_profiles")
    .select("id, school_name, school_category, updated_at")
    .eq("tenant_id", tenantId)
    .eq("school_name", schoolName)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findAllSchoolProfiles(
  tenantId: string,
): Promise<{ id: string; school_name: string; school_category: string | null; updated_at: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("school_profiles")
    .select("id, school_name, school_category, updated_at")
    .eq("tenant_id", tenantId)
    .order("school_name");
  if (error) throw error;
  return data ?? [];
}

export async function findOfferedSubjectsByProfile(
  profileId: string,
): Promise<{ id: string; school_profile_id: string; subject_id: string; grades: number[]; semesters: number[]; is_elective: boolean | null; notes: string | null }[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("school_offered_subjects")
    .select("id, school_profile_id, subject_id, grades, semesters, is_elective, notes")
    .eq("school_profile_id", profileId);
  if (error) throw error;
  return data ?? [];
}

export async function deleteOfferedSubject(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("school_offered_subjects")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
