/**
 * Attendance 도메인 Repository
 * 출석 기록 데이터 접근
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AttendanceRecord,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  AttendanceFilters,
} from "./types";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 학생 ID와 날짜로 출석 기록 조회
 */
export async function findAttendanceByStudentAndDate(
  studentId: string,
  date: string
): Promise<AttendanceRecord | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("student_id", studentId)
    .eq("attendance_date", date)
    .maybeSingle<AttendanceRecord>();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data ?? null;
}

/**
 * 출석 기록 생성
 */
export async function insertAttendanceRecord(
  tenantId: string,
  input: CreateAttendanceRecordInput
): Promise<AttendanceRecord> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("attendance_records")
    .insert({
      tenant_id: tenantId,
      student_id: input.student_id,
      attendance_date: input.attendance_date,
      check_in_time: input.check_in_time ?? null,
      check_out_time: input.check_out_time ?? null,
      check_in_method: input.check_in_method ?? null,
      check_out_method: input.check_out_method ?? null,
      status: input.status ?? "present",
      notes: input.notes ?? null,
    })
    .select()
    .single<AttendanceRecord>();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 출석 기록 수정
 */
export async function updateAttendanceRecord(
  recordId: string,
  input: UpdateAttendanceRecordInput
): Promise<AttendanceRecord> {
  const supabase = await createSupabaseServerClient();

  const updateData: Partial<AttendanceRecord> = {};

  if (input.check_in_time !== undefined) {
    updateData.check_in_time = input.check_in_time;
  }
  if (input.check_out_time !== undefined) {
    updateData.check_out_time = input.check_out_time;
  }
  if (input.check_in_method !== undefined) {
    updateData.check_in_method = input.check_in_method;
  }
  if (input.check_out_method !== undefined) {
    updateData.check_out_method = input.check_out_method;
  }
  if (input.status !== undefined) {
    updateData.status = input.status;
  }
  if (input.notes !== undefined) {
    updateData.notes = input.notes;
  }

  const { data, error } = await supabase
    .from("attendance_records")
    .update(updateData)
    .eq("id", recordId)
    .select()
    .single<AttendanceRecord>();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 출석 기록 삭제
 */
export async function deleteAttendanceRecord(
  recordId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", recordId);

  if (error) {
    throw error;
  }
}

/**
 * 기간별 출석 기록 조회
 */
export async function findAttendanceRecordsByDateRange(
  filters: AttendanceFilters,
  tenantId?: string | null
): Promise<AttendanceRecord[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("attendance_records")
    .select("*")
    .order("attendance_date", { ascending: false })
    .order("check_in_time", { ascending: false });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (filters.student_id) {
    query = query.eq("student_id", filters.student_id);
  }

  if (filters.start_date) {
    query = query.gte("attendance_date", filters.start_date);
  }

  if (filters.end_date) {
    query = query.lte("attendance_date", filters.end_date);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    // 에러 상세 정보 로깅
    console.error("[attendance/repository] 출석 기록 조회 실패", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  return (data as AttendanceRecord[]) ?? [];
}

/**
 * 학생별 출석 기록 조회
 */
export async function findAttendanceRecordsByStudent(
  studentId: string,
  startDate?: string,
  endDate?: string
): Promise<AttendanceRecord[]> {
  return findAttendanceRecordsByDateRange({
    student_id: studentId,
    start_date: startDate,
    end_date: endDate,
  });
}

