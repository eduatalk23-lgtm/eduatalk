/**
 * Student Terms 데이터 접근 함수
 * 
 * student_terms 테이블을 관리하는 유틸리티 함수입니다.
 * 학생의 학년도별 학기 정보를 조회/생성합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * StudentTerm 타입 (student_terms 테이블)
 */
export type StudentTerm = Tables<"student_terms">;

/**
 * StudentTerm 생성 입력 타입
 */
export type StudentTermInsert = TablesInsert<"student_terms">;

/**
 * student_terms 조회 또는 생성
 * 
 * 주어진 조건에 맞는 student_term이 있으면 반환하고,
 * 없으면 새로 생성합니다.
 * 
 * @param params - 조회/생성 조건
 * @returns student_term_id
 */
export async function getOrCreateStudentTerm(params: {
  tenant_id: string;
  student_id: string;
  school_year: number; // 학년도 (예: 2024)
  grade: number; // 학년 (1~3)
  semester: number; // 학기 (1~2)
  curriculum_revision_id: string;
}): Promise<string> {
  const supabase = await createSupabaseServerClient();

  // 기존 student_term 조회
  const { data: existing, error: selectError } = await supabase
    .from("student_terms")
    .select("id")
    .eq("tenant_id", params.tenant_id)
    .eq("student_id", params.student_id)
    .eq("school_year", params.school_year)
    .eq("grade", params.grade)
    .eq("semester", params.semester)
    .maybeSingle();

  if (selectError) {
    console.error("[data/studentTerms] student_term 조회 실패", selectError);
    throw selectError;
  }

  // 기존 student_term이 있으면 반환
  if (existing) {
    return existing.id;
  }

  // 없으면 새로 생성
  const insertPayload: StudentTermInsert = {
    tenant_id: params.tenant_id,
    student_id: params.student_id,
    school_year: params.school_year,
    grade: params.grade,
    semester: params.semester,
    curriculum_revision_id: params.curriculum_revision_id,
  };

  const { data: created, error: insertError } = await supabase
    .from("student_terms")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError) {
    console.error("[data/studentTerms] student_term 생성 실패", insertError);
    throw insertError;
  }

  return created.id;
}

/**
 * student_terms 조회
 * 
 * @param params - 조회 조건
 * @returns student_term 또는 null
 */
export async function getStudentTerm(params: {
  tenant_id: string;
  student_id: string;
  school_year: number;
  grade: number;
  semester: number;
}): Promise<StudentTerm | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_terms")
    .select("*")
    .eq("tenant_id", params.tenant_id)
    .eq("student_id", params.student_id)
    .eq("school_year", params.school_year)
    .eq("grade", params.grade)
    .eq("semester", params.semester)
    .maybeSingle();

  if (error) {
    console.error("[data/studentTerms] student_term 조회 실패", error);
    return null;
  }

  return data as StudentTerm | null;
}

/**
 * 학생의 모든 student_terms 조회
 * 
 * @param studentId - 학생 ID
 * @param tenantId - 테넌트 ID
 * @returns student_term 배열
 */
export async function getStudentTerms(
  studentId: string,
  tenantId: string
): Promise<StudentTerm[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_terms")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("school_year", { ascending: false })
    .order("grade", { ascending: true })
    .order("semester", { ascending: true });

  if (error) {
    console.error("[data/studentTerms] student_terms 조회 실패", error);
    return [];
  }

  return (data as StudentTerm[]) ?? [];
}

/**
 * 학년도 계산 헬퍼 함수
 * 
 * 현재 날짜를 기준으로 학년도를 계산합니다.
 * 한국의 학년도는 3월부터 시작하므로, 3월~12월은 해당 연도, 1월~2월은 전년도입니다.
 * 
 * @param date - 기준 날짜 (기본값: 현재 날짜)
 * @returns 학년도 (예: 2024)
 */
export function calculateSchoolYear(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1~12

  // 3월~12월: 해당 연도, 1월~2월: 전년도
  if (month >= 3) {
    return year;
  } else {
    return year - 1;
  }
}

