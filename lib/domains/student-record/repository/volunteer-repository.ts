// ============================================
// α1-2: 봉사활동 Repository
// student_record_volunteer 조회 (파이프라인 진입점 전용, 최소 API)
// ============================================

import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { RecordVolunteer } from "../types";

type AnyServerSupabase =
  | SupabaseAdminClient
  | SupabaseClient<Database>;

/**
 * 특정 학년의 봉사활동 목록 조회 (activity_date 오름차순).
 * 빈 배열 허용 — 호출자는 빈 케이스를 정상 흐름으로 처리해야 한다.
 */
export async function fetchVolunteerByGrade(
  supabase: AnyServerSupabase,
  studentId: string,
  tenantId: string,
  grade: number,
): Promise<RecordVolunteer[]> {
  const { data, error } = await supabase
    .from("student_record_volunteer")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("grade", grade)
    .order("activity_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as RecordVolunteer[];
}

/**
 * α1-3: asOf 시점까지의 봉사 목록 (VolunteerState 집계용).
 * `upToSchoolYear` 이하 학년도에 속한 row 만 반환. activity_date 오름차순.
 */
export async function fetchVolunteerUpTo(
  supabase: AnyServerSupabase,
  studentId: string,
  tenantId: string,
  upToSchoolYear: number,
): Promise<RecordVolunteer[]> {
  const { data, error } = await supabase
    .from("student_record_volunteer")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .lte("school_year", upToSchoolYear)
    .order("activity_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as RecordVolunteer[];
}

/**
 * 학년 내 봉사 row의 안정적 content_hash 재료 문자열 생성.
 * 순서가 다르면 다른 해시가 나오므로 activity_date/id 기준으로 정렬 후 직렬화.
 */
export function buildVolunteerHashInput(
  rows: ReadonlyArray<Pick<RecordVolunteer, "id" | "activity_date" | "location" | "description" | "hours">>,
): string {
  const sorted = [...rows].sort((a, b) => {
    const da = a.activity_date ?? "";
    const db = b.activity_date ?? "";
    if (da !== db) return da.localeCompare(db);
    return a.id.localeCompare(b.id);
  });
  return sorted
    .map((r) =>
      `${r.id}|${r.activity_date ?? ""}|${r.location ?? ""}|${(r.description ?? "").trim()}|${r.hours ?? 0}`,
    )
    .join("\n");
}
