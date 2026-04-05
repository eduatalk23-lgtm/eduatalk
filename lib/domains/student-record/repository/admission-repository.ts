// ============================================
// 지원현황(applications) + 수능최저(min_score) 데이터 접근
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  RecordApplication, RecordApplicationInsert, RecordApplicationUpdate,
  MinScoreTarget, MinScoreTargetInsert, MinScoreTargetUpdate,
  MinScoreSimulation, MinScoreSimulationInsert,
} from "../types";

// ============================================
// 11. 지원현황 (applications)
// ============================================

export async function findApplicationsByStudentYear(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<RecordApplication[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_applications")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .order("round")
    .order("university_name");
  if (error) throw error;
  return (data as RecordApplication[]) ?? [];
}

export async function insertApplication(
  input: RecordApplicationInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_applications")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateApplicationById(
  id: string,
  updates: RecordApplicationUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_applications")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteApplicationById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_applications")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 15. 수능최저 목표 (min_score_targets)
// ============================================

export async function findMinScoreTargetsByStudent(
  studentId: string,
  tenantId: string,
): Promise<MinScoreTarget[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_min_score_targets")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("priority");
  if (error) throw error;
  return (data as MinScoreTarget[]) ?? [];
}

export async function insertMinScoreTarget(
  input: MinScoreTargetInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_min_score_targets")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateMinScoreTargetById(
  id: string,
  updates: MinScoreTargetUpdate,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_min_score_targets")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMinScoreTargetById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_min_score_targets")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// 16. 수능최저 시뮬레이션 (min_score_simulations)
// ============================================

export async function findMinScoreSimulationsByStudent(
  studentId: string,
  tenantId: string,
): Promise<MinScoreSimulation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_min_score_simulations")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("mock_score_date", { ascending: false });
  if (error) throw error;
  return (data as MinScoreSimulation[]) ?? [];
}

export async function insertMinScoreSimulation(
  input: MinScoreSimulationInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_min_score_simulations")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteMinScoreSimulationById(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_record_min_score_simulations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
