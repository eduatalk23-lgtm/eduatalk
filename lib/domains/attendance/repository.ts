/**
 * Attendance 도메인 Repository
 * 출석 기록 데이터 접근
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import type {
  AttendanceRecord,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  AttendanceFilters,
} from "./types";

/**
 * AttendanceRecord 테이블에서 조회할 컬럼 목록
 * 모든 조회 쿼리에서 select("*") 대신 사용
 */
const ATTENDANCE_COLUMNS = `
  id,
  tenant_id,
  student_id,
  attendance_date,
  check_in_time,
  check_out_time,
  check_in_method,
  check_out_method,
  status,
  notes,
  created_at,
  updated_at
` as const;

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
    .select(ATTENDANCE_COLUMNS)
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
 * RLS 정책 우회를 위해 Admin 클라이언트 사용
 */
export async function insertAttendanceRecord(
  tenantId: string,
  input: CreateAttendanceRecordInput
): Promise<AttendanceRecord> {
  // RLS 정책 우회를 위해 Admin 클라이언트 사용
  const supabase = await getSupabaseClientForRLSBypass({
    forceAdmin: false,
    fallbackToServer: true,
  });

  if (!supabase) {
    throw new Error("Supabase client uninitialized");
  }

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
    // 에러 상세 정보 로깅 추가
    console.error("[attendance/repository] 출석 기록 생성 실패", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      tenantId,
      input,
    });
    throw error;
  }

  return data;
}

/**
 * 출석 기록 수정
 * RLS 정책 우회를 위해 Admin 클라이언트 사용
 */
export async function updateAttendanceRecord(
  recordId: string,
  input: UpdateAttendanceRecordInput
): Promise<AttendanceRecord> {
  // RLS 정책 우회를 위해 Admin 클라이언트 사용
  const supabase = await getSupabaseClientForRLSBypass({
    forceAdmin: false,
    fallbackToServer: true,
  });

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

  if (!supabase) {
    throw new Error("Supabase client uninitialized");
  }

  const { data, error } = await supabase
    .from("attendance_records")
    .update(updateData)
    .eq("id", recordId)
    .select()
    .single<AttendanceRecord>();

  if (error) {
    // 에러 상세 정보 로깅 추가
    console.error("[attendance/repository] 출석 기록 수정 실패", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      recordId,
      input,
    });
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
    .select(ATTENDANCE_COLUMNS)
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

  if (filters.check_in_method) {
    query = query.eq("check_in_method", filters.check_in_method);
  }

  if (filters.check_out_method) {
    query = query.eq("check_out_method", filters.check_out_method);
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

/**
 * 출석 기록 조회 (페이지네이션 지원, 학생 정보 배치 조회)
 */
export type AttendanceRecordWithStudent = AttendanceRecord & {
  student_name: string | null;
};

export type AttendancePaginationParams = {
  page: number;
  pageSize: number;
  sortBy?: "date" | "student_name" | "status";
  sortOrder?: "asc" | "desc";
};

export type AttendancePaginationResult = {
  records: AttendanceRecordWithStudent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function findAttendanceRecordsWithPagination(
  filters: AttendanceFilters,
  pagination: AttendancePaginationParams,
  tenantId?: string | null
): Promise<AttendancePaginationResult> {
  const supabase = await createSupabaseServerClient();

  // 기본 쿼리 (학생 정보는 별도로 조회)
  let query = supabase
    .from("attendance_records")
    .select(ATTENDANCE_COLUMNS, { count: "exact" });

  // 테넌트 필터
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  // 필터 적용
  if (filters.student_ids && filters.student_ids.length > 0) {
    query = query.in("student_id", filters.student_ids);
  } else if (filters.student_id) {
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

  if (filters.check_in_method) {
    query = query.eq("check_in_method", filters.check_in_method);
  }

  if (filters.check_out_method) {
    query = query.eq("check_out_method", filters.check_out_method);
  }

  // 정렬
  const sortBy = pagination.sortBy ?? "date";
  const sortOrder = pagination.sortOrder ?? "desc";

  if (sortBy === "date") {
    query = query.order("attendance_date", { ascending: sortOrder === "asc" });
    query = query.order("check_in_time", { ascending: sortOrder === "asc" });
  } else if (sortBy === "status") {
    query = query.order("status", { ascending: sortOrder === "asc" });
    query = query.order("attendance_date", { ascending: false });
  }

  // 페이지네이션
  const from = (pagination.page - 1) * pagination.pageSize;
  const to = from + pagination.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("[attendance/repository] 출석 기록 조회 실패", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  const records = (data as AttendanceRecord[]) ?? [];

  // 학생 정보 배치 조회 (N+1 문제 해결)
  const studentIds = [...new Set(records.map((r) => r.student_id).filter(Boolean))];
  let studentMap = new Map<string, string | null>();

  if (studentIds.length > 0) {
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, name")
      .in("id", studentIds);

    if (studentsError) {
      console.error("[attendance/repository] 학생 정보 조회 실패", {
        message: studentsError.message,
        code: studentsError.code,
      });
    } else {
      studentMap = new Map(
        (students ?? []).map((s) => [s.id, s.name ?? null])
      );
    }
  }

  // 학생명 정렬 (클라이언트 사이드)
  let sortedRecords = records;
  if (sortBy === "student_name") {
    sortedRecords = [...records].sort((a, b) => {
      const nameA = studentMap.get(a.student_id) ?? "";
      const nameB = studentMap.get(b.student_id) ?? "";
      return sortOrder === "asc"
        ? nameA.localeCompare(nameB, "ko")
        : nameB.localeCompare(nameA, "ko");
    });
  }

  // 데이터 변환
  const recordsWithStudent: AttendanceRecordWithStudent[] = sortedRecords.map(
    (record) => ({
      ...record,
      student_name: studentMap.get(record.student_id) ?? null,
    })
  );

  const total = count ?? 0;
  const totalPages = Math.ceil(total / pagination.pageSize);

  return {
    records: recordsWithStudent,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages,
  };
}

/**
 * 출석 기록 개수 조회
 */
export async function countAttendanceRecords(
  filters: AttendanceFilters,
  tenantId?: string | null
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("attendance_records")
    .select("*", { count: "exact", head: true });

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

  if (filters.check_in_method) {
    query = query.eq("check_in_method", filters.check_in_method);
  }

  if (filters.check_out_method) {
    query = query.eq("check_out_method", filters.check_out_method);
  }

  const { count, error } = await query;

  if (error) {
    console.error("[attendance/repository] 출석 기록 개수 조회 실패", {
      message: error.message,
      code: error.code,
    });
    throw error;
  }

  return count ?? 0;
}

