// ============================================
// Profile Card Repository — Layer 0 학생 프로필 카드
// student_record_profile_cards CRUD
//
// H2 (2026-04-14): ctx.profileCard 메모리 캐시 → DB 승격
// (tenant_id, student_id, target_grade, source) 단위 upsert.
// content_hash 기반 stale 판정으로 증분 캐시 실현.
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { StudentProfileCard } from "@/lib/domains/record-analysis/pipeline/pipeline-types";

// ============================================
// 1. 타입
// ============================================

export type ProfileCardSource = "ai" | "manual";

export interface PersistedProfileCard {
  id: string;
  tenant_id: string;
  student_id: string;
  pipeline_id: string | null;
  target_grade: number;
  target_school_year: number;
  prior_school_years: number[];
  overall_average_grade: string;
  average_quality_score: number | null;
  persistent_strengths: StudentProfileCard["persistentStrengths"];
  persistent_weaknesses: StudentProfileCard["persistentWeaknesses"];
  recurring_quality_issues: StudentProfileCard["recurringQualityIssues"];
  career_trajectory: StudentProfileCard["careerTrajectory"] | null;
  depth_progression: StudentProfileCard["depthProgression"] | null;
  cross_grade_themes: StudentProfileCard["crossGradeThemes"] | null;
  interest_consistency: StudentProfileCard["interestConsistency"] | null;
  content_hash: string;
  source: ProfileCardSource;
  model_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileCardUpsertInput {
  targetGrade: number;
  targetSchoolYear: number;
  card: StudentProfileCard;
  contentHash: string;
  source?: ProfileCardSource;
  modelName?: string | null;
  pipelineId?: string | null;
}

// ============================================
// 2. DB row ↔ StudentProfileCard 변환
// ============================================

/**
 * DB row → StudentProfileCard.
 * JSONB 필드는 `unknown`이지만 DDL 스키마/upsert 쓰는 쪽에서 형상 보장.
 */
export function rowToProfileCard(row: PersistedProfileCard): StudentProfileCard {
  return {
    priorSchoolYears: row.prior_school_years,
    overallAverageGrade: row.overall_average_grade,
    persistentStrengths: row.persistent_strengths,
    persistentWeaknesses: row.persistent_weaknesses,
    recurringQualityIssues: row.recurring_quality_issues,
    averageQualityScore: row.average_quality_score,
    ...(row.career_trajectory ? { careerTrajectory: row.career_trajectory } : {}),
    ...(row.depth_progression ? { depthProgression: row.depth_progression } : {}),
    ...(row.cross_grade_themes ? { crossGradeThemes: row.cross_grade_themes } : {}),
    ...(row.interest_consistency ? { interestConsistency: row.interest_consistency } : {}),
  };
}

// ============================================
// 3. 조회
// ============================================

/** 단일 카드 조회 (학생+학년+source 단위) */
export async function findProfileCard(
  studentId: string,
  tenantId: string,
  targetGrade: number,
  source: ProfileCardSource = "ai",
  supabase?: SupabaseClient<Database>,
): Promise<PersistedProfileCard | null> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("student_record_profile_cards")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("target_grade", targetGrade)
    .eq("source", source)
    .maybeSingle();

  if (error) throw error;
  return (data as PersistedProfileCard | null) ?? null;
}

/** 학생의 모든 카드 (학년 전체 조망 / UI용) */
export async function findProfileCardsByStudent(
  studentId: string,
  tenantId: string,
  options?: { source?: ProfileCardSource },
  supabase?: SupabaseClient<Database>,
): Promise<PersistedProfileCard[]> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client
    .from("student_record_profile_cards")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("source", options?.source ?? "ai")
    .order("target_grade");

  if (error) throw error;
  return (data ?? []) as PersistedProfileCard[];
}

/**
 * content_hash 비교로 카드 신선도 판정.
 * - null return = 카드 없음 (최초 빌드 필요)
 * - { stale: false, card } = 해시 일치 → 재사용 가능
 * - { stale: true, card } = 해시 불일치 → 재빌드 필요 (기존 카드 반환해 diff 로깅 가능)
 */
export async function getProfileCardFreshness(
  studentId: string,
  tenantId: string,
  targetGrade: number,
  currentHash: string,
  source: ProfileCardSource = "ai",
  supabase?: SupabaseClient<Database>,
): Promise<{ stale: boolean; card: PersistedProfileCard } | null> {
  const existing = await findProfileCard(studentId, tenantId, targetGrade, source, supabase);
  if (!existing) return null;
  return { stale: existing.content_hash !== currentHash, card: existing };
}

// ============================================
// 4. 업서트
// ============================================

/**
 * 카드 upsert (학생 + 학년 + source 단위).
 * UNIQUE(tenant_id, student_id, target_grade, source)에 따라 onConflict 덮어쓰기.
 */
export async function upsertProfileCard(
  studentId: string,
  tenantId: string,
  input: ProfileCardUpsertInput,
  supabase?: SupabaseClient<Database>,
): Promise<PersistedProfileCard> {
  const client = supabase ?? (await createSupabaseServerClient());

  const { card } = input;
  const payload = {
    tenant_id: tenantId,
    student_id: studentId,
    pipeline_id: input.pipelineId ?? null,
    target_grade: input.targetGrade,
    target_school_year: input.targetSchoolYear,
    prior_school_years: card.priorSchoolYears,
    overall_average_grade: card.overallAverageGrade,
    average_quality_score: card.averageQualityScore,
    persistent_strengths: card.persistentStrengths as unknown as Json,
    persistent_weaknesses: card.persistentWeaknesses as unknown as Json,
    recurring_quality_issues: card.recurringQualityIssues as unknown as Json,
    career_trajectory: (card.careerTrajectory ?? null) as unknown as Json,
    depth_progression: (card.depthProgression ?? null) as unknown as Json,
    cross_grade_themes: (card.crossGradeThemes ?? null) as unknown as Json,
    interest_consistency: (card.interestConsistency ?? null) as unknown as Json,
    content_hash: input.contentHash,
    source: input.source ?? "ai",
    model_name: input.modelName ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("student_record_profile_cards")
    .upsert(payload, {
      onConflict: "tenant_id,student_id,target_grade,source",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PersistedProfileCard;
}

// ============================================
// 5. 삭제 (재실행 cascade 용)
// ============================================

/** 학생의 ai source 카드 전부 삭제 (재실행 시 rebuild 강제) */
export async function deleteProfileCardsByStudent(
  studentId: string,
  tenantId: string,
  source: ProfileCardSource = "ai",
  supabase?: SupabaseClient<Database>,
): Promise<void> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { error } = await client
    .from("student_record_profile_cards")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("source", source);
  if (error) throw error;
}
