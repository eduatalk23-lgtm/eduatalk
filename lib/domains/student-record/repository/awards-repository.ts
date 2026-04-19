// ============================================
// α1-4: 수상(Awards) Repository
// student_record_awards 조회 (파이프라인 진입점 + buildStudentState 공용, 최소 API)
// ============================================

import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { RecordAward } from "../types";

type AnyServerSupabase =
  | SupabaseAdminClient
  | SupabaseClient<Database>;

/**
 * 특정 학년의 수상 목록 조회 (award_date 오름차순).
 * 빈 배열 허용 — 호출자는 빈 케이스를 정상 흐름으로 처리해야 한다.
 */
export async function fetchAwardsByGrade(
  supabase: AnyServerSupabase,
  studentId: string,
  tenantId: string,
  grade: number,
): Promise<RecordAward[]> {
  const { data, error } = await supabase
    .from("student_record_awards")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("grade", grade)
    .order("award_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as RecordAward[];
}

/**
 * asOf 시점까지의 수상 목록 (AwardState 집계용).
 * `upToSchoolYear` 이하 학년도에 속한 row 만 반환. award_date 오름차순.
 */
export async function fetchAwardsUpTo(
  supabase: AnyServerSupabase,
  studentId: string,
  tenantId: string,
  upToSchoolYear: number,
): Promise<RecordAward[]> {
  const { data, error } = await supabase
    .from("student_record_awards")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .lte("school_year", upToSchoolYear)
    .order("award_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as RecordAward[];
}

/**
 * 학년 내 수상 row의 안정적 content_hash 재료 문자열 생성.
 * 순서 독립성 보장을 위해 award_date/id 기준으로 정렬 후 직렬화.
 */
export function buildAwardsHashInput(
  rows: ReadonlyArray<
    Pick<RecordAward, "id" | "award_date" | "award_name" | "award_level" | "awarding_body" | "participants">
  >,
): string {
  const sorted = [...rows].sort((a, b) => {
    const da = a.award_date ?? "";
    const db = b.award_date ?? "";
    if (da !== db) return da.localeCompare(db);
    return a.id.localeCompare(b.id);
  });
  return sorted
    .map((r) =>
      `${r.id}|${r.award_date ?? ""}|${(r.award_name ?? "").trim()}|${r.award_level ?? ""}|${r.awarding_body ?? ""}|${r.participants ?? ""}`,
    )
    .join("\n");
}
