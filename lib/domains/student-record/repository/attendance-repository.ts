// ============================================
// α1-5: 출결(Attendance) + 징계(Disciplinary) Repository
// student_record_attendance + student_record_disciplinary 조회 (buildStudentState 집계용)
// ============================================

import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { RecordAttendance, RecordDisciplinary } from "../types";

type AnyServerSupabase =
  | SupabaseAdminClient
  | SupabaseClient<Database>;

/**
 * asOf 시점까지의 출결 row (AttendanceState 집계용).
 * `upToSchoolYear` 이하 학년도에 속한 row 만 반환. grade 오름차순.
 */
export async function fetchAttendanceUpTo(
  supabase: AnyServerSupabase,
  studentId: string,
  tenantId: string,
  upToSchoolYear: number,
): Promise<RecordAttendance[]> {
  const { data, error } = await supabase
    .from("student_record_attendance")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .lte("school_year", upToSchoolYear)
    .order("grade", { ascending: true });

  if (error) throw error;
  return (data ?? []) as RecordAttendance[];
}

/**
 * asOf 시점까지의 징계 row.
 * `upToSchoolYear` 이하 학년도. decision_date 오름차순 (최신 분석 순서 안정).
 */
export async function fetchDisciplinaryUpTo(
  supabase: AnyServerSupabase,
  studentId: string,
  tenantId: string,
  upToSchoolYear: number,
): Promise<RecordDisciplinary[]> {
  const { data, error } = await supabase
    .from("student_record_disciplinary")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .lte("school_year", upToSchoolYear)
    .order("decision_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as RecordDisciplinary[];
}
