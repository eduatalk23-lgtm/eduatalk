// ============================================
// 가이드 자동 분류 (클러스터 + 난이도 + 사슬 + 중복 감지)
// Phase A 인프라 → 신규 가이드 자동 편입
// ============================================

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  logActionDebug,
  logActionWarn,
  logActionError,
} from "@/lib/utils/serverActionLogger";

const LOG_TAG = "guide.auto-classify";

/** 최소 유사도: 이 이하면 클러스터 미배정 */
const MIN_CLUSTER_SIMILARITY = 0.5;
/** 중복 경고 임계값 */
const DUPLICATE_SIMILARITY_THRESHOLD = 0.95;
/** 사슬 링크 최소 유사도 */
const MIN_SEQUEL_SIMILARITY = 0.4;
/** k-NN 투표 시 참조할 최근접 이웃 수 */
const KNN_K = 5;

export interface AutoClassifyResult {
  clusterId: string | null;
  clusterName: string | null;
  clusterConfidence: number;
  difficultyLevel: string | null;
  sequelLinksCreated: number;
  duplicate: { guideId: string; title: string; similarity: number } | null;
}

/**
 * 가이드 자동 분류
 * embedding 생성 완료 후 호출. pgvector cosine similarity 기반 k-NN 투표로
 * cluster + difficulty 배정, sequel 링크 생성, 중복 감지.
 */
export async function autoClassifyGuide(
  guideId: string,
): Promise<AutoClassifyResult | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    logActionError(LOG_TAG, "Admin client 생성 실패");
    return null;
  }

  // 1. 신규 가이드의 embedding 조회
  const { data: content } = await supabase
    .from("exploration_guide_content")
    .select("embedding")
    .eq("guide_id", guideId)
    .single();

  if (!content?.embedding) {
    logActionWarn(LOG_TAG, `embedding 없음, 분류 스킵: ${guideId}`);
    return null;
  }

  // 2. k-NN: 가장 유사한 기존 가이드 top-K 조회 (cluster + difficulty 투표용)
  //    + 중복 감지 (similarity > 0.95)
  const { data: neighbors, error: nnError } = await supabase.rpc(
    "find_nearest_guides",
    {
      p_guide_id: guideId,
      p_limit: KNN_K,
    },
  );

  if (nnError || !neighbors?.length) {
    logActionWarn(
      LOG_TAG,
      `k-NN 조회 실패 또는 이웃 없음: ${guideId} — ${nnError?.message}`,
    );
    return null;
  }

  // 3. 중복 감지
  const topNeighbor = neighbors[0] as {
    guide_id: string;
    title: string;
    similarity: number;
    topic_cluster_id: string | null;
    cluster_name: string | null;
    difficulty_level: string | null;
  };
  const duplicate =
    topNeighbor.similarity >= DUPLICATE_SIMILARITY_THRESHOLD
      ? {
          guideId: topNeighbor.guide_id,
          title: topNeighbor.title,
          similarity: topNeighbor.similarity,
        }
      : null;

  if (duplicate) {
    logActionWarn(
      LOG_TAG,
      `중복 의심: ${guideId} ↔ ${duplicate.guideId} (${duplicate.similarity.toFixed(3)})`,
    );
  }

  // 4. 클러스터 투표 (majority vote)
  const clusterVotes = new Map<
    string,
    { count: number; name: string; totalSim: number }
  >();
  for (const n of neighbors as typeof topNeighbor[]) {
    if (!n.topic_cluster_id || n.similarity < MIN_CLUSTER_SIMILARITY) continue;
    const existing = clusterVotes.get(n.topic_cluster_id);
    if (existing) {
      existing.count++;
      existing.totalSim += n.similarity;
    } else {
      clusterVotes.set(n.topic_cluster_id, {
        count: 1,
        name: n.cluster_name ?? "",
        totalSim: n.similarity,
      });
    }
  }

  let bestCluster: {
    id: string;
    name: string;
    confidence: number;
  } | null = null;

  if (clusterVotes.size > 0) {
    const sorted = [...clusterVotes.entries()].sort(
      (a, b) => b[1].count - a[1].count || b[1].totalSim - a[1].totalSim,
    );
    const [clusterId, vote] = sorted[0];
    bestCluster = {
      id: clusterId,
      name: vote.name,
      confidence: vote.totalSim / vote.count,
    };
  }

  // 5. 난이도 투표 (similarity-weighted vote)
  const diffVotes = new Map<string, number>();
  for (const n of neighbors as typeof topNeighbor[]) {
    if (!n.difficulty_level) continue;
    diffVotes.set(
      n.difficulty_level,
      (diffVotes.get(n.difficulty_level) ?? 0) + n.similarity,
    );
  }

  let bestDifficulty: string | null = null;
  if (diffVotes.size > 0) {
    bestDifficulty = [...diffVotes.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0][0];
  }

  // 6. 가이드 업데이트 (cluster + difficulty)
  const updatePayload: Record<string, unknown> = {};
  if (bestCluster) {
    updatePayload.topic_cluster_id = bestCluster.id;
    updatePayload.topic_cluster_confidence = bestCluster.confidence;
  }
  if (bestDifficulty) {
    updatePayload.difficulty_level = bestDifficulty;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateError } = await supabase
      .from("exploration_guides")
      .update(updatePayload)
      .eq("id", guideId);

    if (updateError) {
      logActionError(LOG_TAG, `가이드 업데이트 실패: ${updateError.message}`);
    }
  }

  // 7. 사슬 링크 생성 (클러스터 배정 + 난이도 있을 때만)
  let sequelLinksCreated = 0;
  if (bestCluster && bestDifficulty) {
    sequelLinksCreated = await createSequelLinks(
      supabase,
      guideId,
      bestCluster.id,
      bestDifficulty,
    );
  }

  logActionDebug(
    LOG_TAG,
    `분류 완료: ${guideId} → cluster=${bestCluster?.name ?? "없음"}, ` +
      `difficulty=${bestDifficulty ?? "없음"}, sequels=${sequelLinksCreated}` +
      (duplicate ? `, ⚠️ 중복=${duplicate.guideId}` : ""),
  );

  return {
    clusterId: bestCluster?.id ?? null,
    clusterName: bestCluster?.name ?? null,
    clusterConfidence: bestCluster?.confidence ?? 0,
    difficultyLevel: bestDifficulty,
    sequelLinksCreated,
    duplicate,
  };
}

/**
 * 사슬 링크 생성: 인접 난이도 가이드와 embedding 유사도 top-3 연결
 */
async function createSequelLinks(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  guideId: string,
  clusterId: string,
  difficultyLevel: string,
): Promise<number> {
  if (!supabase) return 0;

  const nextLevel =
    difficultyLevel === "basic"
      ? "intermediate"
      : difficultyLevel === "intermediate"
        ? "advanced"
        : null;
  const prevLevel =
    difficultyLevel === "advanced"
      ? "intermediate"
      : difficultyLevel === "intermediate"
        ? "basic"
        : null;

  let created = 0;

  // forward links: this → next level (top 3)
  if (nextLevel) {
    const { data, error } = await supabase.rpc("create_sequel_links", {
      p_from_guide_id: guideId,
      p_cluster_id: clusterId,
      p_target_level: nextLevel,
      p_direction: "forward",
      p_limit: 3,
      p_min_similarity: MIN_SEQUEL_SIMILARITY,
    });
    if (!error && data) created += data as number;
  }

  // backward links: prev level → this (top 3)
  if (prevLevel) {
    const { data, error } = await supabase.rpc("create_sequel_links", {
      p_from_guide_id: guideId,
      p_cluster_id: clusterId,
      p_target_level: prevLevel,
      p_direction: "backward",
      p_limit: 3,
      p_min_similarity: MIN_SEQUEL_SIMILARITY,
    });
    if (!error && data) created += data as number;
  }

  return created;
}
