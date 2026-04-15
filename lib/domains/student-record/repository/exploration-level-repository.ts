// ============================================
// 탐구 레벨(Exploration Level) Repository — Phase α G2
// student_exploration_levels 학기 단위 snapshot
//
// leveling 모듈(gpaToLevel, resolveSchoolTier, computeAdequateLevel)의
// 계산 결과를 학기 단위로 영속화. Phase β 활동 격자 cap 의 기반.
//
// 범위 (Step 2.2):
//   - 조회: getSnapshot / listSnapshots
//   - 쓰기: upsertFromGpa (auto) / upsertConsultantOverride
//           (source='consultant_override' 시 override_reason 강제 — DB CHECK)
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

import { computeLevelingForStudent } from "../leveling";
import { calculateAverageGrade } from "@/lib/domains/score/service";

import type {
  ExplorationLevel,
  ExplorationLevelInsert,
} from "../types/db-models";

// ============================================
// 1. 타입
// ============================================

export type ExplorationLevelSource = "auto" | "consultant_override";

export interface ExplorationLevelSlice {
  schoolYear: number;
  semester: 1 | 2;
}

type Client = SupabaseClient<Database>;

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

// ============================================
// 2. 조회
// ============================================

export async function getExplorationLevelSnapshot(
  studentId: string,
  tenantId: string,
  slice: ExplorationLevelSlice,
  client?: Client,
): Promise<ExplorationLevel | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_exploration_levels")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", slice.schoolYear)
    .eq("semester", slice.semester)
    .maybeSingle();
  if (error) throw error;
  return (data as ExplorationLevel | null) ?? null;
}

export async function listExplorationLevelSnapshots(
  studentId: string,
  tenantId: string,
  client?: Client,
): Promise<ExplorationLevel[]> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_exploration_levels")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("school_year", { ascending: false })
    .order("semester", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ExplorationLevel[];
}

// ============================================
// 3. 쓰기 — AUTO (leveling 모듈 결과 스냅샷)
// ============================================

/**
 * 현재 GPA/projected/학교권을 leveling 모듈로 계산해서 학기 snapshot upsert.
 * UNIQUE(student_id, school_year, semester) 기준 merge.
 *
 * - gpa_average  ← calculateAverageGrade().schoolAvg
 * - school_tier  ← leveling.resolvedTier (명시값 → GPA 추론 → default 폴백)
 * - adequate_level / expected_level / adequate_from_gpa ← computeAdequateLevel()
 * - source = 'auto', override_reason = null
 *
 * **기본 guard**: 같은 slice 에 source='consultant_override' 가 이미 있으면 NO-OP 로
 *   기존 row 반환 (덮어쓰지 않음). 의도적으로 덮어쓰려면 `overrideConsultant: true`.
 */
export async function upsertExplorationLevelFromGpa(
  studentId: string,
  tenantId: string,
  slice: ExplorationLevelSlice & { grade: 1 | 2 | 3 },
  options?: { overrideConsultant?: boolean },
  client?: Client,
): Promise<ExplorationLevel> {
  const supabase = await resolveClient(client);

  if (!options?.overrideConsultant) {
    const existing = await getExplorationLevelSnapshot(
      studentId,
      tenantId,
      slice,
      supabase,
    );
    if (existing && existing.source === "consultant_override") {
      return existing;
    }
  }

  const [{ schoolAvg }, leveling] = await Promise.all([
    calculateAverageGrade(studentId, tenantId),
    computeLevelingForStudent({ studentId, tenantId, grade: slice.grade }),
  ]);

  const insertRow: ExplorationLevelInsert = {
    student_id: studentId,
    tenant_id: tenantId,
    school_year: slice.schoolYear,
    grade: slice.grade,
    semester: slice.semester,
    adequate_level: leveling.adequateLevel,
    expected_level: leveling.expectedLevel,
    adequate_from_gpa: leveling.hasGpaData ? leveling.adequateFromGpa : null,
    gpa_average: schoolAvg,
    school_tier: leveling.resolvedTier,
    source: "auto",
    override_reason: null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("student_exploration_levels")
    .upsert(insertRow, {
      onConflict: "student_id,school_year,semester",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ExplorationLevel;
}

// ============================================
// 4. 쓰기 — CONSULTANT OVERRIDE
// ============================================

export interface ExplorationLevelOverrideInput {
  adequateLevel: 1 | 2 | 3 | 4 | 5;
  expectedLevel: 1 | 2 | 3 | 4 | 5;
  overrideReason: string;
  adequateFromGpa?: 1 | 2 | 3 | 4 | 5 | null;
  gpaAverage?: number | null;
  schoolTier?: string | null;
}

/**
 * 컨설턴트가 자동 계산 결과를 덮어씀.
 * source='consultant_override' + override_reason 필수 (DB CHECK 강제).
 */
export async function upsertExplorationLevelConsultantOverride(
  studentId: string,
  tenantId: string,
  slice: ExplorationLevelSlice & { grade: 1 | 2 | 3 },
  override: ExplorationLevelOverrideInput,
  client?: Client,
): Promise<ExplorationLevel> {
  if (!override.overrideReason || override.overrideReason.trim().length === 0) {
    throw new Error("consultant override requires a non-empty reason");
  }
  const supabase = await resolveClient(client);

  const insertRow: ExplorationLevelInsert = {
    student_id: studentId,
    tenant_id: tenantId,
    school_year: slice.schoolYear,
    grade: slice.grade,
    semester: slice.semester,
    adequate_level: override.adequateLevel,
    expected_level: override.expectedLevel,
    adequate_from_gpa: override.adequateFromGpa ?? null,
    gpa_average: override.gpaAverage ?? null,
    school_tier: override.schoolTier ?? null,
    source: "consultant_override",
    override_reason: override.overrideReason.trim(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("student_exploration_levels")
    .upsert(insertRow, {
      onConflict: "student_id,school_year,semester",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ExplorationLevel;
}
