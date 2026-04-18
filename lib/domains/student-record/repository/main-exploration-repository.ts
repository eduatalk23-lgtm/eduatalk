// ============================================
// 메인 탐구(Main Exploration) Repository — Phase α G1
// student_main_explorations CRUD + 버전 swap
//
// 합의 모델 (session-handoff-2026-04-15-c):
//   scope × track × direction 단위로 is_active=TRUE 1건 보장 (DB UNIQUE index).
//   갱신: UPDATE is_active=FALSE → INSERT new version 순차.
//
// 범위 (Step 2.1):
//   - 조회: getActive / listVersions / getById
//   - 쓰기: create (자동 swap) / deactivate / reactivate / setConsultantPin
//
// tier_plan JSONB 동기화(→ main_exploration_links)는 Step 2.6.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

import type {
  MainExploration,
  MainExplorationInsert,
  MainExplorationUpdate,
} from "../types/db-models";

// ============================================
// 1. 타입
// ============================================

export type MainExplorationScope = "overall" | "track" | "grade";
export type MainExplorationDirection = "analysis" | "design";
export type MainExplorationSemanticRole =
  | "hypothesis_root"
  | "aggregation_target"
  | "hybrid_recursion"
  | "consultant_pin";
export type MainExplorationSource = "ai" | "consultant" | "hybrid";
/**
 * Phase 3 Auto-Bootstrap 이중 가드의 세부 경로.
 *   - auto_bootstrap     : Phase 0~2 자동 셋업으로 생성된 초안
 *   - auto_bootstrap_v2  : Phase 4 Synthesis 학습 후 재부트스트랩으로 갱신
 *   - consultant_direct  : 컨설턴트가 UI 로 처음부터 작성
 *   - migrated           : Phase 3 도입 이전부터 존재 (backfill)
 *
 * source 는 대분류(AI/Consultant), origin 은 세부 경로 + 재부트스트랩 가드용.
 * `edited_by_consultant_at` 과 조합하여 `origin='auto_bootstrap*' AND edited_by_consultant_at IS NULL`
 * 인 row 만 재부트스트랩이 덮어쓰기 가능.
 */
export type MainExplorationOrigin =
  | "auto_bootstrap"
  | "auto_bootstrap_v2"
  | "consultant_direct"
  | "migrated";
export type MainExplorationTier = "foundational" | "development" | "advanced";

/** 메인 탐구 "슬라이스" 키 — scope × track × direction. */
export interface MainExplorationSlice {
  scope: MainExplorationScope;
  trackLabel?: string | null;
  direction: MainExplorationDirection;
}

/** tier_plan JSONB 한 단계 — Step 2.6 에서 zod 스키마로 승격 예정. */
export interface MainExplorationTierEntry {
  theme?: string;
  key_questions?: string[];
  suggested_activities?: string[];
  linked_storyline_ids?: string[];
  linked_roadmap_item_ids?: string[];
  linked_narrative_arc_ids?: string[];
  linked_hyperedge_ids?: string[];
  linked_setek_guide_ids?: string[];
  linked_changche_guide_ids?: string[];
  linked_haengteuk_guide_ids?: string[];
  linked_topic_trajectory_ids?: string[];
}

export interface MainExplorationTierPlan {
  foundational?: MainExplorationTierEntry;
  development?: MainExplorationTierEntry;
  advanced?: MainExplorationTierEntry;
}

export interface MainExplorationInput {
  studentId: string;
  tenantId: string;
  pipelineId?: string | null;
  schoolYear: number;
  grade: number;
  semester: 1 | 2;
  scope: MainExplorationScope;
  trackLabel?: string | null;
  direction: MainExplorationDirection;
  semanticRole: MainExplorationSemanticRole;
  source: MainExplorationSource;
  /** Phase 3. 생략 시 "consultant_direct" 기본. Bootstrap 경로는 "auto_bootstrap" 전달 필수. */
  origin?: MainExplorationOrigin;
  pinnedByConsultant?: boolean;
  themeLabel: string;
  themeKeywords?: string[];
  careerField?: string | null;
  tierPlan?: MainExplorationTierPlan;
  identityAlignmentScore?: number | null;
  exemplarReferenceIds?: string[];
  modelName?: string | null;
}

type Client = SupabaseClient<Database>;

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

// ============================================
// 2. 조회
// ============================================

/** scope × track × direction 슬라이스의 현재 활성 1건 (없으면 null). */
export async function getActiveMainExploration(
  studentId: string,
  tenantId: string,
  slice: MainExplorationSlice,
  client?: Client,
): Promise<MainExploration | null> {
  const supabase = await resolveClient(client);
  const base = supabase
    .from("student_main_explorations")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("scope", slice.scope)
    .eq("direction", slice.direction)
    .eq("is_active", true);

  const query =
    slice.trackLabel == null
      ? base.is("track_label", null)
      : base.eq("track_label", slice.trackLabel);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as MainExploration | null) ?? null;
}

/** 학생의 활성 메인 탐구 전체 (모든 슬라이스). scope=track 다축 시 여러 건. */
export async function listActiveMainExplorations(
  studentId: string,
  tenantId: string,
  options?: { direction?: MainExplorationDirection },
  client?: Client,
): Promise<MainExploration[]> {
  const supabase = await resolveClient(client);
  let query = supabase
    .from("student_main_explorations")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (options?.direction) query = query.eq("direction", options.direction);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MainExploration[];
}

/** 동일 슬라이스의 version 이력 (최신 순). */
export async function listMainExplorationVersions(
  studentId: string,
  tenantId: string,
  slice: MainExplorationSlice,
  client?: Client,
): Promise<MainExploration[]> {
  const supabase = await resolveClient(client);
  const base = supabase
    .from("student_main_explorations")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("scope", slice.scope)
    .eq("direction", slice.direction);

  const query =
    slice.trackLabel == null
      ? base.is("track_label", null)
      : base.eq("track_label", slice.trackLabel);

  const { data, error } = await query.order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MainExploration[];
}

export async function getMainExplorationById(
  id: string,
  client?: Client,
): Promise<MainExploration | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_main_explorations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as MainExploration | null) ?? null;
}

// ============================================
// 3. 쓰기 — 생성 / 활성화 / 핀
// ============================================

/**
 * 새 메인 탐구 생성 (자동 버전 swap).
 *   - isActive=true (기본) 이고 같은 slice 에 활성 prev 가 있으면:
 *       prev 비활성화 → version = prev.version + 1, parent_version_id = prev.id 로 INSERT
 *   - isActive=false 면 slice 의 max(version) + 1 로 draft INSERT (prev 는 건드리지 않음).
 *
 * 원자성 주의: JS 순차 쿼리 (Supabase JS 트랜잭션 미지원).
 *   UPDATE 성공 + INSERT 실패 시 활성본이 잠시 공백 상태일 수 있음.
 *   호출 측이 reactivateMainExplorationVersion(prev.id) 로 복구 가능.
 *   DB UNIQUE (uq_sme_active_one_per_slice) 가 중복 활성 방지 안전망.
 */
export async function createMainExploration(
  input: MainExplorationInput,
  options?: { parentVersionId?: string | null; isActive?: boolean },
  client?: Client,
): Promise<MainExploration> {
  const supabase = await resolveClient(client);
  const shouldActivate = options?.isActive ?? true;

  let parentVersionId = options?.parentVersionId ?? null;
  let nextVersion = 1;

  const slice: MainExplorationSlice = {
    scope: input.scope,
    trackLabel: input.trackLabel ?? null,
    direction: input.direction,
  };

  if (shouldActivate) {
    const prev = await getActiveMainExploration(
      input.studentId,
      input.tenantId,
      slice,
      supabase,
    );
    if (prev) {
      parentVersionId = parentVersionId ?? prev.id;
      nextVersion = prev.version + 1;

      const { error: deactErr } = await supabase
        .from("student_main_explorations")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", prev.id);
      if (deactErr) throw deactErr;
    }
  } else {
    // draft: 같은 slice 전체 max(version) + 1
    const versions = await listMainExplorationVersions(
      input.studentId,
      input.tenantId,
      slice,
      supabase,
    );
    nextVersion = (versions[0]?.version ?? 0) + 1;
  }

  // Phase 3. origin 컬럼은 마이그레이션 20260418200000 에서 추가. DB types 재생성 전까지는
  // Insert 타입에 포함되지 않으므로 Record<string, unknown> 캐스팅으로 전달.
  const insertRow: MainExplorationInsert = {
    student_id: input.studentId,
    tenant_id: input.tenantId,
    pipeline_id: input.pipelineId ?? null,
    school_year: input.schoolYear,
    grade: input.grade,
    semester: input.semester,
    scope: input.scope,
    track_label: input.trackLabel ?? null,
    direction: input.direction,
    semantic_role: input.semanticRole,
    source: input.source,
    pinned_by_consultant: input.pinnedByConsultant ?? false,
    version: nextVersion,
    parent_version_id: parentVersionId,
    is_active: shouldActivate,
    theme_label: input.themeLabel,
    theme_keywords: input.themeKeywords ?? [],
    career_field: input.careerField ?? null,
    tier_plan: ((input.tierPlan ?? {}) as unknown) as Json,
    identity_alignment_score: input.identityAlignmentScore ?? null,
    exemplar_reference_ids: input.exemplarReferenceIds ?? [],
    model_name: input.modelName ?? null,
    ...(input.origin ? { origin: input.origin } : {}),
  } as MainExplorationInsert & { origin?: MainExplorationOrigin };

  const { data, error } = await supabase
    .from("student_main_explorations")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) throw error;
  return data as MainExploration;
}

/** 비활성화 (이력은 보존). */
export async function deactivateMainExploration(
  id: string,
  client?: Client,
): Promise<void> {
  const supabase = await resolveClient(client);
  const { error } = await supabase
    .from("student_main_explorations")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * 특정 version 을 활성으로 복원 (롤백).
 * 같은 slice 의 다른 활성 row 를 먼저 비활성화한 후 해당 id 를 활성화.
 */
export async function reactivateMainExplorationVersion(
  id: string,
  client?: Client,
): Promise<MainExploration> {
  const supabase = await resolveClient(client);
  const target = await getMainExplorationById(id, supabase);
  if (!target) throw new Error(`main_exploration not found: ${id}`);

  const base = supabase
    .from("student_main_explorations")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("student_id", target.student_id)
    .eq("tenant_id", target.tenant_id)
    .eq("scope", target.scope)
    .eq("direction", target.direction)
    .eq("is_active", true)
    .neq("id", id);
  const deactQuery =
    target.track_label == null
      ? base.is("track_label", null)
      : base.eq("track_label", target.track_label);

  const { error: deactErr } = await deactQuery;
  if (deactErr) throw deactErr;

  const { data, error } = await supabase
    .from("student_main_explorations")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as MainExploration;
}

// ============================================
// 5. category_scores (Phase δ-4)
// ============================================

/** category_scores JSONB shape (10 inquiry_category 점수 + 메타). */
export interface MainExplorationCategoryScores {
  scores: Record<string, number>;
  source: "auto" | "consultant_override" | "hybrid";
  classifierVersion?: string | null;
  updatedBy?: string | null;
  updatedAt?: string;
  reasons?: Array<{
    category: string;
    source: string;
    matched: string;
    delta: number;
  }>;
}

/** 단일 메인 탐구의 category_scores 조회. NULL 이면 null 반환. */
export async function getMainExplorationCategoryScores(
  id: string,
  client?: Client,
): Promise<MainExplorationCategoryScores | null> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("student_main_explorations")
    .select("category_scores")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.category_scores) return null;
  return parseCategoryScoresJson(data.category_scores);
}

/**
 * category_scores 업서트.
 * source=auto 는 분류기(classifier v0/v1) 결과, consultant_override 는 컨설턴트 수동 입력.
 * 같은 메인 탐구 id 에 덮어쓰기 (history 는 main_exploration version 체인이 책임).
 */
export async function upsertMainExplorationCategoryScores(
  id: string,
  payload: MainExplorationCategoryScores,
  client?: Client,
): Promise<MainExploration> {
  const supabase = await resolveClient(client);
  const value = {
    scores: payload.scores,
    source: payload.source,
    classifier_version: payload.classifierVersion ?? null,
    updated_by: payload.updatedBy ?? null,
    updated_at: payload.updatedAt ?? new Date().toISOString(),
    ...(payload.reasons ? { reasons: payload.reasons } : {}),
  };

  const { data, error } = await supabase
    .from("student_main_explorations")
    .update({
      category_scores: value as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as MainExploration;
}

function parseCategoryScoresJson(
  raw: unknown,
): MainExplorationCategoryScores | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const scores = obj.scores;
  const source = obj.source;
  if (!scores || typeof scores !== "object") return null;
  if (source !== "auto" && source !== "consultant_override" && source !== "hybrid") return null;
  return {
    scores: scores as Record<string, number>,
    source,
    classifierVersion: typeof obj.classifier_version === "string" ? obj.classifier_version : null,
    updatedBy: typeof obj.updated_by === "string" ? obj.updated_by : null,
    updatedAt: typeof obj.updated_at === "string" ? obj.updated_at : undefined,
    reasons: Array.isArray(obj.reasons)
      ? (obj.reasons as MainExplorationCategoryScores["reasons"])
      : undefined,
  };
}

/**
 * 컨설턴트 수동 핀. pinned_by_consultant 플래그 토글.
 * promoteToConsultantPin=true 면 semantic_role 도 consultant_pin 으로 승격.
 */
export async function setMainExplorationConsultantPin(
  id: string,
  options: { pinned: boolean; promoteToConsultantPin?: boolean },
  client?: Client,
): Promise<MainExploration> {
  const supabase = await resolveClient(client);
  const update: MainExplorationUpdate = {
    pinned_by_consultant: options.pinned,
    updated_at: new Date().toISOString(),
  };
  if (options.pinned && options.promoteToConsultantPin) {
    update.semantic_role = "consultant_pin";
  }

  const { data, error } = await supabase
    .from("student_main_explorations")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as MainExploration;
}
