// ============================================
// Student State Repository — α1-3 World Model 영속화
// student_state_snapshots CRUD + student_state_metric_events append
//
// buildStudentState() 결과의 시점 스냅샷을 읽고 쓴다.
// (학생, 학년도, 학년, 학기) 1건 UPSERT — 버전 이력은 별도 테이블로 분리하지 않음.
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

type SnapshotRow = Database["public"]["Tables"]["student_state_snapshots"]["Row"];
type MetricEventRow = Database["public"]["Tables"]["student_state_metric_events"]["Row"];
type MetricEventInsert = Database["public"]["Tables"]["student_state_metric_events"]["Insert"];

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
  // α1-3-c: GENERATED ALWAYS AS ... STORED — 읽기만 가능, payload 에 포함 금지
  as_of_label: string;
  hakjong_total: number | null;
  completeness_ratio: number;
  /**
   * 9 비트 bitmap (α1-3-c):
   *   bit 0 layer0   bit 1 layer1   bit 2 layer2   bit 3 layer3
   *   bit 4 auxVolunteer  bit 5 auxAwards  bit 6 auxAttendance  bit 7 auxReading
   *   bit 8 blueprint
   */
  layer_flags: number;
  hakjong_computable: boolean;
  has_stale_layer: boolean;
  snapshot_data: Json;
  builder_version: string;
  built_at: string;
  created_at: string;
  updated_at: string;
}

// layer_flags bitmap 상수는 `types/student-state` 로 이관 (client-safe).
// 기존 서버 경로 호환용 re-export.
export { SNAPSHOT_LAYER_FLAGS } from "../types/student-state";

function toPersisted(row: SnapshotRow): PersistedStudentStateSnapshot {
  return {
    ...row,
    target_semester: row.target_semester as 1 | 2,
  };
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
  const { data, error } = await supabase
    .from("student_state_snapshots")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("built_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toPersisted(data) : null;
}

/**
 * 학생의 가장 최근 N개 snapshot. built_at DESC.
 *
 * Perception Scheduler (α4) 가 `[latest, prev]` 두 snapshot 을 받아
 * `computeStudentStateDiff` → `computePerceptionTrigger` 로 넘기는 주 진입점.
 *
 * N < 2 이면 null 반환은 없음 — 빈 배열만 반환. 호출자가 길이 검사 후 "no_prior_snapshot" 등 처리.
 */
export async function findTopNSnapshots(
  studentId: string,
  tenantId: string,
  n: number,
  client?: Client,
): Promise<PersistedStudentStateSnapshot[]> {
  if (n <= 0) return [];
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_state_snapshots")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("built_at", { ascending: false })
    .limit(n);

  if (error) throw new Error(error.message);
  return (data ?? []).map(toPersisted);
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
  const { data, error } = await supabase
    .from("student_state_snapshots")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("school_year", asOf.schoolYear)
    .eq("target_grade", asOf.grade)
    .eq("target_semester", asOf.semester)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toPersisted(data) : null;
}

/**
 * α4 하이브리드 (2026-04-20 C): snapshot 부재 시 metric_events 2 건으로 fallback diff.
 *
 * snapshot 은 (학년도 × 학년 × 학기) UPSERT 이므로 학기 내 변화가 덮임.
 * metric_events 는 append-only 라 학기 내 시계열을 보존 → hakjong/completeness delta 만 추출 가능.
 * captured_at DESC 로 최근 N 건.
 */
export async function findRecentMetricEvents(
  studentId: string,
  tenantId: string,
  n: number,
  client?: Client,
): Promise<MetricEventRow[]> {
  if (n <= 0) return [];
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_state_metric_events")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("captured_at", { ascending: false })
    .limit(n);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// 타입 재export — perception-scheduler 에서 직접 참조
export type { MetricEventRow };

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
  let chain = supabase
    .from("student_state_snapshots")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("school_year", { ascending: true })
    .order("target_grade", { ascending: true })
    .order("target_semester", { ascending: true });
  if (options?.limit) chain = chain.limit(options.limit);

  const { data, error } = await chain;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPersisted);
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

  // α1-3-c: 승격 컬럼(as_of_label/hakjong_total/completeness_ratio/layer_flags/
  // hakjong_computable/has_stale_layer)은 GENERATED ALWAYS AS ... STORED 로
  // snapshot_data 에서 자동 투영. payload 에서 명시적으로 제외 — 쓰면 에러.
  const payload = {
    tenant_id: state.tenantId,
    student_id: state.studentId,
    school_year: state.asOf.schoolYear,
    target_grade: state.asOf.grade,
    target_semester: state.asOf.semester,
    snapshot_data: state as unknown as Json,
    builder_version: options?.builderVersion ?? "v1",
    built_at: state.asOf.builtAt,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("student_state_snapshots")
    .upsert(payload, {
      onConflict: "tenant_id,student_id,school_year,target_grade,target_semester",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("student_state_snapshot upsert 결과가 비어있습니다.");

  await appendMetricEvent(supabase, state, data.id, options?.triggerSource ?? "manual");

  return toPersisted(data);
}

// ============================================
// α1-3-b: metric events append
// ============================================

async function appendMetricEvent(
  client: Client,
  state: StudentState,
  snapshotId: string,
  triggerSource: MetricEventTriggerSource,
): Promise<void> {
  const row: MetricEventInsert = {
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

  const { error } = await client.from("student_state_metric_events").insert(row);
  if (error) {
    // non-fatal — snapshot 은 저장 완료. 호출자가 실패 감지 원하면 try/catch.
    console.warn(`[student-state] metric_event insert failed: ${error.message}`);
  }
}
