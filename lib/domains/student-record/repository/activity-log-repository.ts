// ============================================
// 수상(awards) + 봉사(volunteer) + 징계(disciplinary) 데이터 접근
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  RecordAward, RecordAwardInsert,
  RecordVolunteer, RecordVolunteerInsert,
  RecordDisciplinary, RecordDisciplinaryInsert,
} from "../types";

// ============================================
// 12. 수상 (awards)
// ============================================

export async function findAwardsByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordAward[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_awards")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("award_date", { nullsFirst: false });
  if (error) throw error;
  return (data as RecordAward[]) ?? [];
}

export async function insertAward(
  input: RecordAwardInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_awards")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteAwardById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_awards")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 13. 봉사 (volunteer)
// ============================================

export async function findVolunteerByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordVolunteer[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_volunteer")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("activity_date", { nullsFirst: false });
  if (error) throw error;
  return (data as RecordVolunteer[]) ?? [];
}

export async function insertVolunteer(
  input: RecordVolunteerInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_volunteer")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteVolunteerById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_volunteer")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 14. 징계 (disciplinary)
// ============================================

export async function findDisciplinaryByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordDisciplinary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_disciplinary")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("decision_date", { nullsFirst: false });
  if (error) throw error;
  return (data as RecordDisciplinary[]) ?? [];
}

export async function insertDisciplinary(
  input: RecordDisciplinaryInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_disciplinary")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteDisciplinaryById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_disciplinary")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
