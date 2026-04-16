// ============================================
// 종합 진단 + 보완전략 Repository
// Phase 5 — diagnosis + strategies CRUD
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionWarn } from "@/lib/logging/actionLogger";
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

/**
 * 학생의 학년도별 종합 진단 조회 (source 필수).
 * **scope='final' 기본 필터** (2026-04-16 D). Past 진단은 findDiagnosisByScope로 조회.
 */
export async function findDiagnosis(
  studentId: string,
  schoolYear: number,
  tenantId: string,
  source: "ai" | "manual",
): Promise<Diagnosis | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_diagnosis")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .eq("source", source)
    .eq("scope", "final")
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * scope 기준 진단 조회 (2026-04-16 D: 4축×3층 아키텍처).
 * scope='past': Past Analytics A층 산출물 (NEIS 학년별)
 * scope='final': Final Integration C층 산출물
 * schoolYear=null이면 학생 전체 scope 조회.
 */
export async function findDiagnosisByScope(
  studentId: string,
  tenantId: string,
  scope: "past" | "final",
  schoolYear?: number,
): Promise<Diagnosis[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_diagnosis")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("scope", scope);
  if (schoolYear !== undefined) query = query.eq("school_year", schoolYear);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Diagnosis[];
}

/**
 * scope 기준 진단 일괄 삭제 (재실행 전 정리).
 * diagnosis_snapshots는 FK CASCADE로 자동 삭제됨.
 */
export async function deleteDiagnosisByScope(
  studentId: string,
  tenantId: string,
  scope: "past" | "final",
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_diagnosis")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("scope", scope)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/**
 * AI진단 + 컨설턴트진단 동시 조회.
 * **scope='final' 기본 필터** (2026-04-16 D). Past 진단은 findDiagnosisByScope로 조회.
 */
export async function findDiagnosisPair(
  studentId: string,
  schoolYear: number,
  tenantId: string,
): Promise<{ ai: Diagnosis | null; consultant: Diagnosis | null }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_diagnosis")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("tenant_id", tenantId)
    .eq("scope", "final");

  if (error) throw error;

  const ai = (data ?? []).find((d) => d.source === "ai") ?? null;
  const consultant = (data ?? []).find((d) => d.source === "manual") ?? null;
  return { ai, consultant };
}

/** 종합 진단 upsert (UNIQUE: tenant+student+year+source+scope) + 이전 상태 스냅샷 */
export async function upsertDiagnosis(
  input: DiagnosisInsert,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const scope = (input as { scope?: string }).scope ?? "final";

  // P2-4: 기존 진단이 있으면 스냅샷 생성 (fire-and-forget)
  const { data: existing } = await supabase
    .from("student_record_diagnosis")
    .select("*")
    .eq("tenant_id", input.tenant_id)
    .eq("student_id", input.student_id)
    .eq("school_year", input.school_year)
    .eq("source", input.source ?? "manual")
    .eq("scope", scope)
    .maybeSingle();

  if (existing) {
    const { error: snapErr } = await supabase
      .from("student_record_diagnosis_snapshots")
      .insert({
        diagnosis_id: existing.id,
        tenant_id: existing.tenant_id,
        student_id: existing.student_id,
        school_year: existing.school_year,
        source: existing.source,
        snapshot: existing,
      });
    if (snapErr) logActionWarn({ domain: "student-record", action: "diagnosis-snapshot" }, `스냅샷 저장 실패: ${snapErr.message}`, { diagnosisId: existing.id });
  }

  const { data, error } = await supabase
    .from("student_record_diagnosis")
    .upsert({ ...input, scope }, {
      onConflict: "tenant_id,student_id,school_year,source,scope",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/** 진단 변경 히스토리 조회 (최근 N건) */
export async function findDiagnosisSnapshots(
  studentId: string,
  schoolYear: number,
  source: "ai" | "manual",
  tenantId: string,
  limit = 10,
): Promise<Array<{ id: string; snapshot: Record<string, unknown>; created_at: string }>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_diagnosis_snapshots")
    .select("id, snapshot, created_at")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .eq("source", source)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Array<{ id: string; snapshot: Record<string, unknown>; created_at: string }>;
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

/**
 * 학생의 학년도별 보완전략 조회.
 * **scope='final' 기본 필터** (2026-04-16 D). Past 전략은 findStrategiesByScope로 조회.
 */
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
    .eq("scope", "final")
    .order("grade")
    .order("target_area");

  if (error) throw error;

  // priority를 의미 순서로 정렬 (critical > high > medium > low)
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return (data ?? []).sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    const pa = priorityOrder[a.priority ?? "medium"] ?? 2;
    const pb = priorityOrder[b.priority ?? "medium"] ?? 2;
    return pa - pb;
  });
}

/**
 * scope 기준 전략 조회 (2026-04-16 D: 4축×3층 아키텍처).
 * scope='past': Past Analytics A층 산출물 (즉시 행동 권고)
 * scope='final': Final Integration C층 산출물 (장기 전략)
 */
export async function findStrategiesByScope(
  studentId: string,
  tenantId: string,
  scope: "past" | "final",
  schoolYear?: number,
): Promise<Strategy[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("student_record_strategies")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("scope", scope)
    .order("grade")
    .order("target_area");
  if (schoolYear !== undefined) query = query.eq("school_year", schoolYear);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Strategy[];
}

/** scope 기준 전략 일괄 삭제 (재실행 전 정리) */
export async function deleteStrategiesByScope(
  studentId: string,
  tenantId: string,
  scope: "past" | "final",
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_strategies")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("scope", scope)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** 보완전략 추가 (reasoning/source_urls는 마이그레이션 적용 후 자동 반영) */
export async function insertStrategy(
  input: StrategyInsert & { reasoning?: string | null; source_urls?: string[] | null },
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_record_strategies")
    .insert(input as StrategyInsert)
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
