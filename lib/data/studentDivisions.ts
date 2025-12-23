/**
 * 학생 구분 항목 데이터 레이어
 * student_divisions 테이블 CRUD 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";

/**
 * 학생 구분 항목 타입
 */
export type StudentDivisionItem = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * 학생 구분 항목 목록 조회 (display_order 정렬)
 */
export async function getStudentDivisions(): Promise<StudentDivisionItem[]> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("student_divisions")
    .select("*")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[studentDivisions] 학생 구분 항목 조회 실패", error);
    throw new Error(`학생 구분 항목 조회 실패: ${error.message}`);
  }

  return (data as StudentDivisionItem[]) ?? [];
}

/**
 * 활성 학생 구분 항목만 조회
 */
export async function getActiveStudentDivisions(): Promise<StudentDivisionItem[]> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("student_divisions")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[studentDivisions] 활성 학생 구분 항목 조회 실패", error);
    throw new Error(`활성 학생 구분 항목 조회 실패: ${error.message}`);
  }

  return (data as StudentDivisionItem[]) ?? [];
}

/**
 * 단일 학생 구분 항목 조회
 */
export async function getStudentDivisionById(
  id: string
): Promise<StudentDivisionItem | null> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("student_divisions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[studentDivisions] 학생 구분 항목 조회 실패", error);
    throw new Error(`학생 구분 항목 조회 실패: ${error.message}`);
  }

  return data as StudentDivisionItem | null;
}

/**
 * 학생 구분 항목 생성
 */
export async function createStudentDivision(
  name: string,
  displayOrder: number
): Promise<StudentDivisionItem> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("student_divisions")
    .insert({ name, display_order: displayOrder })
    .select()
    .single();

  if (error) {
    console.error("[studentDivisions] 학생 구분 항목 생성 실패", error);

    // 중복 키 에러 처리
    if (error.code === "23505") {
      if (error.message.includes("student_divisions_name_key")) {
        throw new Error(`이미 존재하는 구분명입니다: "${name}"`);
      }
      throw new Error("이미 존재하는 데이터입니다.");
    }

    throw new Error(`학생 구분 항목 생성 실패: ${error.message}`);
  }

  return data as StudentDivisionItem;
}

/**
 * 학생 구분 항목 수정
 */
export async function updateStudentDivision(
  id: string,
  updates: Partial<{
    name: string;
    display_order: number;
    is_active: boolean;
  }>
): Promise<StudentDivisionItem> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { data, error } = await supabase
    .from("student_divisions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[studentDivisions] 학생 구분 항목 수정 실패", error);

    // 중복 키 에러 처리
    if (error.code === "23505") {
      if (
        error.message.includes("student_divisions_name_key") &&
        updates.name
      ) {
        throw new Error(`이미 존재하는 구분명입니다: "${updates.name}"`);
      }
      throw new Error("이미 존재하는 데이터입니다.");
    }

    throw new Error(`학생 구분 항목 수정 실패: ${error.message}`);
  }

  return data as StudentDivisionItem;
}

/**
 * 학생 구분 항목 삭제 전 사용 여부 확인
 */
export async function checkDivisionInUse(
  id: string
): Promise<{ inUse: boolean; count: number }> {
  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  // 해당 구분을 사용하는 학생 수 확인
  const division = await getStudentDivisionById(id);
  if (!division) {
    return { inUse: false, count: 0 };
  }

  const { count, error } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("division", division.name);

  if (error) {
    console.error("[studentDivisions] 학생 구분 사용 여부 확인 실패", error);
    throw new Error(`학생 구분 사용 여부 확인 실패: ${error.message}`);
  }

  return { inUse: (count ?? 0) > 0, count: count ?? 0 };
}

/**
 * 학생 구분 항목 삭제
 */
export async function deleteStudentDivision(id: string): Promise<void> {
  // 삭제 전 사용 여부 확인
  const { inUse, count } = await checkDivisionInUse(id);
  if (inUse) {
    throw new Error(
      `이 구분을 사용하는 학생이 ${count}명 있습니다. 삭제할 수 없습니다.`
    );
  }

  // Admin 클라이언트 우선 사용 (RLS 우회)
  const supabase = await getSupabaseClientForRLSBypass();

  const { error } = await supabase
    .from("student_divisions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[studentDivisions] 학생 구분 항목 삭제 실패", error);
    throw new Error(`학생 구분 항목 삭제 실패: ${error.message}`);
  }
}

