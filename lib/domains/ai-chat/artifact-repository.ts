/**
 * Phase C-2: Artifact 영속화 Repository.
 *
 * - `ai_artifacts` — conversation × type × subject_key 유일. latest_version 포인터.
 * - `ai_artifact_versions` — append-only. 신규 버전은 props hash 가 다를 때만 INSERT.
 *
 * 사용 경로:
 *  - `saveChatTurn` 의 onFinish(서버 context 외) — admin client 필수.
 *  - `/api/artifacts` GET — request 경로 + server client.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type ArtifactType =
  | "scores"
  | "plan"
  | "analysis"
  | "blueprint"
  | "generic";

export type ArtifactRow = {
  id: string;
  tenantId: string;
  conversationId: string;
  ownerUserId: string;
  type: ArtifactType;
  title: string;
  subtitle: string | null;
  originPath: string | null;
  subjectKey: string | null;
  latestVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type ArtifactVersionRow = {
  id: string;
  artifactId: string;
  versionNo: number;
  props: unknown;
  propsHash: string;
  createdByMessageId: string | null;
  editedByUserId: string | null;
  createdAt: string;
};

export type ArtifactWithLatestVersion = ArtifactRow & {
  latestProps: unknown;
  latestCreatedAt: string;
};

/**
 * 안정적인 JSON 직렬화 → sha-256. 같은 내용은 항상 같은 hash.
 * 객체 키 정렬로 순서 의존성 제거.
 */
export function computePropsHash(props: unknown): string {
  return createHash("sha256").update(stableStringify(props)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export type UpsertArtifactArgs = {
  tenantId: string;
  conversationId: string;
  ownerUserId: string;
  type: ArtifactType;
  title: string;
  subtitle?: string | null;
  originPath?: string | null;
  subjectKey?: string | null;
  props: unknown;
  createdByMessageId?: string | null;
};

export type UpsertArtifactResult = {
  artifactId: string;
  versionNo: number;
  /** true: 신규 artifact 생성. false: 기존 artifact 재사용. */
  created: boolean;
  /** true: 새 버전 INSERT. false: 동일 hash 라 skip. */
  versionInserted: boolean;
};

/**
 * artifact 를 (conversation, type, subjectKey) 로 upsert 하고, 신규 버전을 추가한다.
 * props hash 가 직전 버전과 같으면 버전 INSERT 를 skip (결정 ①).
 *
 * 실패 시 throw. 호출자는 try/catch 로 감쌀 것 (saveChatTurn 실패와 분리되어야 함).
 */
export async function upsertArtifactWithVersion(
  args: UpsertArtifactArgs,
  supabase: SupabaseClient<Database>,
): Promise<UpsertArtifactResult> {
  const propsHash = computePropsHash(args.props);

  // 1) 기존 artifact 조회 — (conversation, type, subject_key) 유일 인덱스 기반.
  const subjectKeyOrNull = args.subjectKey ?? null;
  const existingQuery = supabase
    .from("ai_artifacts")
    .select("id, latest_version, tenant_id")
    .eq("conversation_id", args.conversationId)
    .eq("type", args.type)
    .limit(1);
  const existing = subjectKeyOrNull
    ? await existingQuery.eq("subject_key", subjectKeyOrNull).maybeSingle()
    : await existingQuery.is("subject_key", null).maybeSingle();

  if (existing.error) {
    throw new Error(`artifact lookup: ${existing.error.message}`);
  }

  if (existing.data) {
    // 2a) 기존 artifact — 직전 버전 hash 확인.
    const latest = await supabase
      .from("ai_artifact_versions")
      .select("version_no, props_hash")
      .eq("artifact_id", existing.data.id)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest.error) {
      throw new Error(`latest version lookup: ${latest.error.message}`);
    }

    if (latest.data && latest.data.props_hash === propsHash) {
      // 동일 내용 — skip.
      return {
        artifactId: existing.data.id,
        versionNo: latest.data.version_no,
        created: false,
        versionInserted: false,
      };
    }

    const nextVersion = (latest.data?.version_no ?? 0) + 1;
    const versionInsert = await supabase.from("ai_artifact_versions").insert({
      artifact_id: existing.data.id,
      version_no: nextVersion,
      props: args.props as never,
      props_hash: propsHash,
      created_by_message_id: args.createdByMessageId ?? null,
      edited_by_user_id: null,
    });
    if (versionInsert.error) {
      throw new Error(`version insert: ${versionInsert.error.message}`);
    }

    const pointerUpdate = await supabase
      .from("ai_artifacts")
      .update({
        latest_version: nextVersion,
        title: args.title,
        subtitle: args.subtitle ?? null,
        origin_path: args.originPath ?? null,
      })
      .eq("id", existing.data.id);
    if (pointerUpdate.error) {
      throw new Error(`artifact pointer update: ${pointerUpdate.error.message}`);
    }

    return {
      artifactId: existing.data.id,
      versionNo: nextVersion,
      created: false,
      versionInserted: true,
    };
  }

  // 2b) 신규 artifact — v1 로 생성.
  const insertArtifact = await supabase
    .from("ai_artifacts")
    .insert({
      tenant_id: args.tenantId,
      conversation_id: args.conversationId,
      owner_user_id: args.ownerUserId,
      type: args.type,
      title: args.title,
      subtitle: args.subtitle ?? null,
      origin_path: args.originPath ?? null,
      subject_key: subjectKeyOrNull,
      latest_version: 1,
    })
    .select("id")
    .single();

  if (insertArtifact.error || !insertArtifact.data) {
    throw new Error(
      `artifact insert: ${insertArtifact.error?.message ?? "no data"}`,
    );
  }

  const versionInsert = await supabase.from("ai_artifact_versions").insert({
    artifact_id: insertArtifact.data.id,
    version_no: 1,
    props: args.props as never,
    props_hash: propsHash,
    created_by_message_id: args.createdByMessageId ?? null,
    edited_by_user_id: null,
  });
  if (versionInsert.error) {
    throw new Error(`version v1 insert: ${versionInsert.error.message}`);
  }

  return {
    artifactId: insertArtifact.data.id,
    versionNo: 1,
    created: true,
    versionInserted: true,
  };
}

function mapArtifactRow(row: {
  id: string;
  tenant_id: string;
  conversation_id: string;
  owner_user_id: string;
  type: string;
  title: string;
  subtitle: string | null;
  origin_path: string | null;
  subject_key: string | null;
  latest_version: number;
  created_at: string;
  updated_at: string;
}): ArtifactRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    conversationId: row.conversation_id,
    ownerUserId: row.owner_user_id,
    type: row.type as ArtifactType,
    title: row.title,
    subtitle: row.subtitle,
    originPath: row.origin_path,
    subjectKey: row.subject_key,
    latestVersion: row.latest_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersionRow(row: {
  id: string;
  artifact_id: string;
  version_no: number;
  props: unknown;
  props_hash: string;
  created_by_message_id: string | null;
  edited_by_user_id: string | null;
  created_at: string;
}): ArtifactVersionRow {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    versionNo: row.version_no,
    props: row.props,
    propsHash: row.props_hash,
    createdByMessageId: row.created_by_message_id,
    editedByUserId: row.edited_by_user_id,
    createdAt: row.created_at,
  };
}

/**
 * 대화에 연결된 모든 artifact + 최신 버전 props 를 한번에 반환.
 * UI hydration 진입점.
 */
export async function listConversationArtifacts(
  conversationId: string,
  supabase: SupabaseClient<Database>,
): Promise<ArtifactWithLatestVersion[]> {
  const artifactsRes = await supabase
    .from("ai_artifacts")
    .select(
      "id, tenant_id, conversation_id, owner_user_id, type, title, subtitle, origin_path, subject_key, latest_version, created_at, updated_at",
    )
    .eq("conversation_id", conversationId)
    .order("updated_at", { ascending: false });

  if (artifactsRes.error || !artifactsRes.data || artifactsRes.data.length === 0) {
    return [];
  }

  const artifactIds = artifactsRes.data.map((r) => r.id);
  const versionsRes = await supabase
    .from("ai_artifact_versions")
    .select("artifact_id, version_no, props, props_hash, created_by_message_id, edited_by_user_id, created_at, id")
    .in("artifact_id", artifactIds);

  if (versionsRes.error || !versionsRes.data) {
    return [];
  }

  const latestByArtifact = new Map<string, ArtifactVersionRow>();
  for (const raw of versionsRes.data) {
    const v = mapVersionRow(raw);
    const prev = latestByArtifact.get(v.artifactId);
    if (!prev || v.versionNo > prev.versionNo) {
      latestByArtifact.set(v.artifactId, v);
    }
  }

  return artifactsRes.data.map((raw) => {
    const art = mapArtifactRow(raw);
    const latest = latestByArtifact.get(art.id);
    return {
      ...art,
      latestProps: latest?.props ?? null,
      latestCreatedAt: latest?.createdAt ?? art.updatedAt,
    };
  });
}

/**
 * Phase C-3: 사용자 편집 경로 전용 버전 INSERT.
 *
 * `upsertArtifactWithVersion` 과 차이:
 *  - 반드시 기존 artifact 가 존재해야 한다 (편집은 최소 v1 이 있어야 시작).
 *  - `edited_by_user_id` 를 강제로 채운다 (tool 생성 버전과 구분).
 *  - props hash 가 직전 버전과 같으면 no-op (skip).
 *
 * RLS: 호출자가 server client 를 전달 — artifact 조회 실패 시 권한 없음으로 간주.
 */
export type InsertEditedVersionArgs = {
  artifactId: string;
  editedByUserId: string;
  props: unknown;
};

export type InsertEditedVersionResult = {
  artifactId: string;
  versionNo: number;
  versionInserted: boolean;
};

export async function insertEditedVersion(
  args: InsertEditedVersionArgs,
  supabase: SupabaseClient<Database>,
): Promise<InsertEditedVersionResult> {
  const propsHash = computePropsHash(args.props);

  const artifact = await supabase
    .from("ai_artifacts")
    .select("id")
    .eq("id", args.artifactId)
    .maybeSingle();

  if (artifact.error) {
    throw new Error(`artifact lookup: ${artifact.error.message}`);
  }
  if (!artifact.data) {
    throw new Error("artifact not found or not accessible");
  }

  const latest = await supabase
    .from("ai_artifact_versions")
    .select("version_no, props_hash")
    .eq("artifact_id", args.artifactId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest.error) {
    throw new Error(`latest version lookup: ${latest.error.message}`);
  }

  if (latest.data && latest.data.props_hash === propsHash) {
    return {
      artifactId: args.artifactId,
      versionNo: latest.data.version_no,
      versionInserted: false,
    };
  }

  const nextVersion = (latest.data?.version_no ?? 0) + 1;
  const versionInsert = await supabase.from("ai_artifact_versions").insert({
    artifact_id: args.artifactId,
    version_no: nextVersion,
    props: args.props as never,
    props_hash: propsHash,
    created_by_message_id: null,
    edited_by_user_id: args.editedByUserId,
  });
  if (versionInsert.error) {
    throw new Error(`edited version insert: ${versionInsert.error.message}`);
  }

  const pointerUpdate = await supabase
    .from("ai_artifacts")
    .update({ latest_version: nextVersion })
    .eq("id", args.artifactId);
  if (pointerUpdate.error) {
    throw new Error(`artifact pointer update: ${pointerUpdate.error.message}`);
  }

  return {
    artifactId: args.artifactId,
    versionNo: nextVersion,
    versionInserted: true,
  };
}

/**
 * 특정 artifact 의 전체 버전 목록 (UI 버전 탭 드롭다운).
 * 최신 버전이 앞(DESC).
 */
export async function listArtifactVersions(
  artifactId: string,
  supabase: SupabaseClient<Database>,
): Promise<ArtifactVersionRow[]> {
  const res = await supabase
    .from("ai_artifact_versions")
    .select("id, artifact_id, version_no, props, props_hash, created_by_message_id, edited_by_user_id, created_at")
    .eq("artifact_id", artifactId)
    .order("version_no", { ascending: false });

  if (res.error || !res.data) return [];
  return res.data.map(mapVersionRow);
}
