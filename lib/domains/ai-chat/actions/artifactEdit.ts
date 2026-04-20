"use server";

/**
 * Phase C-3 Sprint 1: Artifact 스냅샷 편집.
 *
 * 사용자가 ArtifactPanel 에서 성적/플랜 값을 수정하고 저장하면, 새 `ai_artifact_versions`
 * 행을 INSERT 하고 `edited_by_user_id` 를 채운다. 원본 DB(`scores` 등)는 건드리지 않는다
 * (what-if 시뮬레이션). 원본 writeback 은 Sprint 2 범위.
 *
 * 보안: server client 의 RLS 로 artifact 소유권 검증. 권한 없는 artifact 조회는 maybeSingle
 * null → repository 가 "not found" 로 throw.
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertEditedVersion } from "@/lib/domains/ai-chat/artifact-repository";

export type SaveArtifactEditInput = {
  artifactId: string;
  props: unknown;
};

export type SaveArtifactEditResult =
  | {
      ok: true;
      artifactId: string;
      versionNo: number;
      versionInserted: boolean;
    }
  | {
      ok: false;
      reason: "unauthenticated" | "invalid" | "failed";
      message?: string;
    };

export async function saveArtifactEdit(
  input: SaveArtifactEditInput,
): Promise<SaveArtifactEditResult> {
  if (!input || typeof input.artifactId !== "string" || input.artifactId.length === 0) {
    return { ok: false, reason: "invalid", message: "artifactId 필수" };
  }
  if (input.props === undefined) {
    return { ok: false, reason: "invalid", message: "props 필수" };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const result = await insertEditedVersion(
      {
        artifactId: input.artifactId,
        editedByUserId: user.id,
        props: input.props,
      },
      supabase,
    );
    return {
      ok: true,
      artifactId: result.artifactId,
      versionNo: result.versionNo,
      versionInserted: result.versionInserted,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: "failed", message };
  }
}
