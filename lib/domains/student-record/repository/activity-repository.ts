// ============================================
// 독서활동(reading) + 출결(attendance) 데이터 접근
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  RecordReading, RecordReadingInsert,
  RecordAttendance, RecordAttendanceInsert,
} from "../types";

// ============================================
// 5. 독서활동 (reading)
// ============================================

export async function findReadingsByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordReading[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_reading")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("created_at");
  if (error) throw error;
  return (data as RecordReading[]) ?? [];
}

export async function insertReading(
  input: RecordReadingInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_reading")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteReadingById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_reading")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 6. 출결 (attendance)
// ============================================

export async function findAttendanceByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordAttendance | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_attendance")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data as RecordAttendance | null;
}

export async function upsertAttendance(
  input: RecordAttendanceInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_attendance")
    .upsert(input, {
      onConflict: "tenant_id,student_id,school_year,grade",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
