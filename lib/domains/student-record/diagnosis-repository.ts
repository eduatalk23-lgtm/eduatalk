// ============================================
// 종합 진단 + 보완전략 Repository
// Phase 5 — diagnosis + strategies CRUD
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Diagnosis,
  DiagnosisInsert,
  DiagnosisUpdate,
  Strategy,
  StrategyInsert,
  StrategyUpdate,
} from "./types";

// ============================================
// diagnosis
// ============================================

/** 학생의 학년도별 종합 진단 조회 */
export async function findDiagnosis(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<Diagnosis | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_diagnosis")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** 종합 진단 upsert (UNIQUE: tenant+student+year) */
export async function upsertDiagnosis(
  input: DiagnosisInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_diagnosis")
    .upsert(input, {
      onConflict: "tenant_id,student_id,school_year",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/** 종합 진단 수정 */
export async function updateDiagnosis(
  id: string,
  updates: DiagnosisUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_diagnosis")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

/** 종합 진단 삭제 */
export async function deleteDiagnosis(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_diagnosis")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ============================================
// strategies
// ============================================

/** 학생의 학년도별 보완전략 조회 */
export async function findStrategies(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<Strategy[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_strategies")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("grade")
    .order("priority")
    .order("target_area");

  if (error) throw error;
  return data ?? [];
}

/** 보완전략 추가 */
export async function insertStrategy(
  input: StrategyInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_strategies")
    .insert(input)
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/** 보완전략 수정 */
export async function updateStrategy(
  id: string,
  updates: StrategyUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_strategies")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

/** 보완전략 삭제 */
export async function deleteStrategy(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_strategies")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
