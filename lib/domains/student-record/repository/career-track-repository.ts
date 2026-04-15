// ============================================
// 진로 트랙(Career Track) Repository — Phase α G15
// student_career_tracks CRUD
//
// 다축 진로. 기존 students.desired_career_field(단일 VARCHAR) 확장.
// student_main_explorations.scope='track' 시 track_label 대응 엔티티.
//
// 범위 (Step 2.3):
//   - 조회: list (active only / all) / getByLabel / getById
//   - 쓰기: create / update / setActive / setPriority / remove (하드 삭제)
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

import type {
  CareerTrack,
  CareerTrackInsert,
  CareerTrackUpdate,
} from "../types/db-models";

// ============================================
// 1. 타입
// ============================================

export type CareerTrackSource = "student_input" | "consultant" | "ai_inferred";

export interface CareerTrackInput {
  studentId: string;
  tenantId: string;
  trackLabel: string;
  careerField?: string | null;
  priority?: number; // 1~9, default 1
  isActive?: boolean;
  source: CareerTrackSource;
  notes?: string | null;
}

export interface CareerTrackPatch {
  careerField?: string | null;
  priority?: number;
  isActive?: boolean;
  notes?: string | null;
}

type Client = SupabaseClient<Database>;

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

// ============================================
// 2. 조회
// ============================================

export async function listCareerTracks(
  studentId: string,
  tenantId: string,
  options?: { activeOnly?: boolean },
  client?: Client,
): Promise<CareerTrack[]> {
  const supabase = await resolveClient(client);
  let query = supabase
    .from("student_career_tracks")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);
  if (options?.activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CareerTrack[];
}

export async function getCareerTrackById(
  id: string,
  client?: Client,
): Promise<CareerTrack | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_career_tracks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as CareerTrack | null) ?? null;
}

export async function getCareerTrackByLabel(
  studentId: string,
  tenantId: string,
  trackLabel: string,
  client?: Client,
): Promise<CareerTrack | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_career_tracks")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("track_label", trackLabel)
    .maybeSingle();
  if (error) throw error;
  return (data as CareerTrack | null) ?? null;
}

// ============================================
// 3. 쓰기
// ============================================

/**
 * 신규 트랙 생성. UNIQUE (student_id, track_label) — 같은 label 재등록은 에러.
 * 기존 label 을 되살리려면 setCareerTrackActive(id, true) 사용.
 */
export async function createCareerTrack(
  input: CareerTrackInput,
  client?: Client,
): Promise<CareerTrack> {
  const supabase = await resolveClient(client);
  const label = input.trackLabel.trim();
  if (label.length === 0) throw new Error("track_label must not be empty");

  const priority = input.priority ?? 1;
  if (priority < 1 || priority > 9) {
    throw new Error(`priority must be 1..9 (got ${priority})`);
  }

  const insertRow: CareerTrackInsert = {
    student_id: input.studentId,
    tenant_id: input.tenantId,
    track_label: label,
    career_field: input.careerField ?? null,
    priority,
    is_active: input.isActive ?? true,
    source: input.source,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from("student_career_tracks")
    .insert(insertRow)
    .select("*")
    .single();
  if (error) throw error;
  return data as CareerTrack;
}

export async function updateCareerTrack(
  id: string,
  patch: CareerTrackPatch,
  client?: Client,
): Promise<CareerTrack> {
  const supabase = await resolveClient(client);

  if (patch.priority !== undefined && (patch.priority < 1 || patch.priority > 9)) {
    throw new Error(`priority must be 1..9 (got ${patch.priority})`);
  }

  const update: CareerTrackUpdate = {
    updated_at: new Date().toISOString(),
  };
  if (patch.careerField !== undefined) update.career_field = patch.careerField;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  if (patch.notes !== undefined) update.notes = patch.notes;

  const { data, error } = await supabase
    .from("student_career_tracks")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as CareerTrack;
}

export async function setCareerTrackActive(
  id: string,
  isActive: boolean,
  client?: Client,
): Promise<CareerTrack> {
  return updateCareerTrack(id, { isActive }, client);
}

export async function setCareerTrackPriority(
  id: string,
  priority: number,
  client?: Client,
): Promise<CareerTrack> {
  return updateCareerTrack(id, { priority }, client);
}

/**
 * 물리 삭제. 이력 보존이 필요하면 setCareerTrackActive(id, false) 사용.
 * 오타 track_label 같은 케이스에서만 쓰기 권장.
 */
export async function removeCareerTrack(
  id: string,
  client?: Client,
): Promise<void> {
  const supabase = await resolveClient(client);
  const { error } = await supabase
    .from("student_career_tracks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
