// ============================================
// Student State Repository — α1-3 World Model 영속화
// student_state_snapshots CRUD
//
// buildStudentState() 결과의 시점 스냅샷을 읽고 쓴다.
// (학생, 학년도, 학년, 학기) 1건 UPSERT — 버전 이력은 별도 테이블로 분리하지 않음.
//
// database.types.ts 미반영 — 마이그레이션(20260419180000)이 적용되기 전까지
// 제네릭 from() 대신 `as never` 캐스트로 우회. 타입 재생성 후 점진적 제거.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { StudentState, StudentStateAsOf } from "../types/student-state";

// ============================================
// α1-3-b: metric events trigger source
// ============================================
export type MetricEventTriggerSource =
  | "pipeline_completion"
  | "nightly_cron"
  | "perception_trigger"
  | "manual"
  | "test";

type Client = SupabaseClient<Database>;

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

// ============================================
// 1. 타입
// ============================================

export interface PersistedStudentStateSnapshot {
  id: string;
  tenant_id: string;
  student_id: string;
  school_year: number;
  target_grade: number;
  target_semester: 1 | 2;
  as_of_label: string;
  hakjong_total: number | null;
  completeness_ratio: number;
  layer0_present: boolean;
  layer1_present: boolean;
  layer2_present: boolean;
  layer3_present: boolean;
  aux_volunteer_present: boolean;
  aux_awards_present: boolean;
  aux_attendance_present: boolean;
  aux_reading_present: boolean;
  blueprint_present: boolean;
  hakjong_computable: boolean;
  has_stale_layer: boolean;
  snapshot_data: Json;
  builder_version: string;
  built_at: string;
  created_at: string;
  updated_at: string;
}

interface SnapshotFromChain {
  select(cols: string): SnapshotFromChain;
  eq(col: string, val: unknown): SnapshotFromChain;
  order(
    col: string,
    opts?: { ascending?: boolean; nullsFirst?: boolean },
  ): SnapshotFromChain;
  limit(n: number): SnapshotFromChain;
  maybeSingle(): Promise<{
    data: PersistedStudentStateSnapshot | null;
    error: { message: string } | null;
  }>;
  single(): Promise<{
    data: PersistedStudentStateSnapshot | null;
    error: { message: string } | null;
  }>;
  then<T>(
    cb: (v: {
      data: PersistedStudentStateSnapshot[] | null;
      error: { message: string } | null;
    }) => T,
  ): Promise<T>;
  upsert(
    row: Record<string, unknown>,
    opts: { onConflict: string },
  ): SnapshotFromChain;
}

function snapshotTable(client: Client): SnapshotFromChain {
  // database.types.ts 미반영(migration 20260419180000) → as never 캐스트 우회
  return client.from("student_state_snapshots" as never) as unknown as SnapshotFromChain;
}

// ============================================
// 2. 조회
// ============================================

/**
 * 학생의 가장 최근 snapshot. built_at DESC 기준.
 * Agent Perception 진입 시 "현재 상태" 로드에 사용.
 */
export async function findLatestSnapshot(
  studentId: string,
  tenantId: string,
  client?: Client,
): Promise<PersistedStudentStateSnapshot | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await snapshotTable(supabase)
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("built_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

/**
 * 특정 시점(학년도+학년+학기)의 snapshot.
 * UNIQUE 보장 → 있으면 1건, 없으면 null.
 */
export async function findSnapshotAt(
  studentId: string,
  tenantId: string,
  asOf: Pick<StudentStateAsOf, "schoolYear" | "grade" | "semester">,
  client?: Client,
): Promise<PersistedStudentStateSnapshot | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await snapshotTable(supabase)
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", asOf.schoolYear)
    .eq("target_grade", asOf.grade)
    .eq("target_semester", asOf.semester)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

/**
 * 학생의 시계열 trajectory.
 * 학년도 → 학년 → 학기 오름차순. 최신이 마지막.
 */
export async function listTrajectory(
  studentId: string,
  tenantId: string,
  options?: { limit?: number },
  client?: Client,
): Promise<PersistedStudentStateSnapshot[]> {
  const supabase = await resolveClient(client);
  let chain = snapshotTable(supabase)
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("school_year", { ascending: true })
    .order("target_grade", { ascending: true })
    .order("target_semester", { ascending: true });
  if (options?.limit) chain = chain.limit(options.limit);

  const { data, error } = await chain.then((v) => v);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ============================================
// 3. 업서트
// ============================================

/**
 * snapshot upsert + metric event append.
 *
 * UNIQUE (tenant_id, student_id, school_year, target_grade, target_semester) 단위로
 * 기존 snapshot 이 있으면 덮어쓴다 (시점당 최신 1건).
 *
 * α1-3-b: snapshot UPSERT 직후 student_state_metric_events 에 append.
 *   - snapshot 은 latest-view, metric_events 는 시계열 로그 (append-only).
 *   - metric insert 실패는 non-fatal — snapshot 자체는 이미 저장됨 (eventual consistency).
 *     그러나 정상 경로에서는 양쪽 다 성공해야 한다.
 */
export async function upsertSnapshot(
  state: StudentState,
  options?: {
    builderVersion?: string;
    /** α1-3-b: metric event trigger source. 기본 manual. */
    triggerSource?: MetricEventTriggerSource;
  },
  client?: Client,
): Promise<PersistedStudentStateSnapshot> {
  const supabase = await resolveClient(client);

  const payload = {
    tenant_id: state.tenantId,
    student_id: state.studentId,
    school_year: state.asOf.schoolYear,
    target_grade: state.asOf.grade,
    target_semester: state.asOf.semester,
    as_of_label: state.asOf.label,
    hakjong_total: state.hakjongScore?.total ?? null,
    completeness_ratio: state.metadata.completenessRatio,
    layer0_present: state.metadata.layer0Present,
    layer1_present: state.metadata.layer1Present,
    layer2_present: state.metadata.layer2Present,
    layer3_present: state.metadata.layer3Present,
    aux_volunteer_present: state.metadata.auxVolunteerPresent,
    aux_awards_present: state.metadata.auxAwardsPresent,
    aux_attendance_present: state.metadata.auxAttendancePresent,
    aux_reading_present: state.metadata.auxReadingPresent,
    blueprint_present: state.metadata.blueprintPresent,
    hakjong_computable: state.metadata.hakjongScoreComputable.total,
    has_stale_layer: state.metadata.staleness.hasStaleLayer,
    snapshot_data: state as unknown as Json,
    builder_version: options?.builderVersion ?? "v1",
    built_at: state.asOf.builtAt,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await snapshotTable(supabase)
    .upsert(payload, {
      onConflict: "tenant_id,student_id,school_year,target_grade,target_semester",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("student_state_snapshot upsert 결과가 비어있습니다.");

  await appendMetricEvent(supabase, state, data.id, options?.triggerSource ?? "manual");

  return data;
}

// ============================================
// α1-3-b: metric events append
// ============================================

interface MetricEventTableChain {
  insert(row: Record<string, unknown>): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

function metricEventTable(client: Client): MetricEventTableChain {
  return client.from("student_state_metric_events" as never) as unknown as MetricEventTableChain;
}

async function appendMetricEvent(
  client: Client,
  state: StudentState,
  snapshotId: string,
  triggerSource: MetricEventTriggerSource,
): Promise<void> {
  const row = {
    tenant_id: state.tenantId,
    student_id: state.studentId,
    snapshot_id: snapshotId,
    school_year: state.asOf.schoolYear,
    target_grade: state.asOf.grade,
    target_semester: state.asOf.semester,
    hakjong_total: state.hakjongScore?.total ?? null,
    hakjong_academic: state.hakjongScore?.academic ?? null,
    hakjong_career: state.hakjongScore?.career ?? null,
    hakjong_community: state.hakjongScore?.community ?? null,
    completeness_ratio: state.metadata.completenessRatio,
    area_completeness_academic: state.metadata.areaCompleteness.academic,
    area_completeness_career: state.metadata.areaCompleteness.career,
    area_completeness_community: state.metadata.areaCompleteness.community,
    trigger_source: triggerSource,
    captured_at: state.asOf.builtAt,
  };

  const { error } = await metricEventTable(client).insert(row);
  if (error) {
    // non-fatal — snapshot 은 저장 완료. 로깅 후 resume.
    // (서버리스에서 logger import 지양 — 호출자가 실패 감지 원하면 try/catch)
    // eslint-disable-next-line no-console
    console.warn(`[student-state] metric_event insert failed: ${error.message}`);
  }
}
