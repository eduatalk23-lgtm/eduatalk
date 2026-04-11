"use server";

/**
 * 세특 텍스트 → 학생 탐구 궤적 자동 추출
 *
 * 패턴 (API Route 분리):
 *   1. Server Action: 인증 검증 + 즉시 반환
 *   2. 클라이언트: API Route(/api/admin/guides/extract-trajectories)를 fire-and-forget fetch
 *   3. API Route(maxDuration=300): executeExtractTrajectories() 동기 실행
 */

import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  geminiRateLimiter,
  geminiQuotaTracker,
} from "@/lib/domains/plan/llm/providers/gemini";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "guide", action: "extractTrajectories" };
const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const KNN_K = 10;
const MIN_CLUSTER_SIMILARITY = 0.45;
const MAX_CLUSTERS_PER_GRADE = 5;
const MIN_TEXT_LENGTH = 50;
/** L3: 클러스터 투표 시 단일 클러스터가 차지할 수 있는 최대 투표 수 */
const MAX_VOTES_PER_CLUSTER = 4;

export interface ExtractedTrajectory {
  grade: number;
  clusterId: string;
  clusterName: string;
  confidence: number;
  difficultyLevel: string;
  sourceRecordIds: string[];
}

export interface ExtractResult {
  trajectories: ExtractedTrajectory[];
  embeddingCalls: number;
}

/**
 * Server Action: 인증만 검증하고 즉시 반환.
 * 실제 추출은 클라이언트가 API Route를 호출하여 실행.
 */
export async function extractTrajectoriesAction(
  studentId: string,
): Promise<ActionResponse<{ studentId: string }>> {
  try {
    await requireAdminOrConsultant();

    // 할당량 사전 확인 (빠른 실패)
    const quota = geminiQuotaTracker.getQuotaStatus();
    if (quota.isExceeded) {
      return createErrorResponse(
        "일일 AI 할당량이 초과되었습니다. 내일 다시 시도해주세요.",
      );
    }

    return createSuccessResponse({ studentId });
  } catch (error) {
    logActionError(LOG_CTX, error, { studentId });
    return createErrorResponse("궤적 추출 요청에 실패했습니다.");
  }
}

/**
 * API Route에서 호출하는 실행 함수 (maxDuration=300 보장).
 * createSupabaseAdminClient() 사용 (request context 독립).
 */
export async function executeExtractTrajectories(
  studentId: string,
): Promise<ExtractResult> {
  const supabase = createSupabaseAdminClient();

  // 1. 세특 레코드 로드 (4-layer 우선순위)
  const { data: seteks, error: setekErr } = await supabase
    .from("student_record_seteks")
    .select("id, grade, subject_name, imported_content, confirmed_content, content, ai_draft_content")
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .order("grade", { ascending: true });

  if (setekErr) throw setekErr;
  if (!seteks || seteks.length === 0) {
    return { trajectories: [], embeddingCalls: 0 };
  }

  // 2. 학년별로 세특 텍스트 결합
  const gradeTexts = new Map<number, { text: string; recordIds: string[] }>();
  for (const s of seteks) {
    const content =
      s.imported_content ?? s.confirmed_content ?? s.content ?? s.ai_draft_content;
    if (!content || content.length < MIN_TEXT_LENGTH) continue;

    const existing = gradeTexts.get(s.grade) ?? { text: "", recordIds: [] };
    existing.text += `[${s.subject_name}] ${stripHtml(content)}\n\n`;
    existing.recordIds.push(s.id);
    gradeTexts.set(s.grade, existing);
  }

  if (gradeTexts.size === 0) {
    return { trajectories: [], embeddingCalls: 0 };
  }

  // 3. 학년별 임베딩 → k-NN → 클러스터 투표
  const allTrajectories: ExtractedTrajectory[] = [];
  let embeddingCalls = 0;

  for (const [grade, { text, recordIds }] of gradeTexts) {
    const truncated = text.slice(0, 4000);

    // 임베딩 생성
    const { embedding } = await geminiRateLimiter.execute(async () =>
      embed({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        value: truncated,
        providerOptions: { google: { outputDimensionality: 768 } },
      }),
    );
    geminiQuotaTracker.recordRequest();
    embeddingCalls++;

    // search_guides RPC
    const { data: neighbors, error: searchErr } = await supabase.rpc(
      "search_guides",
      {
        query_embedding: JSON.stringify(embedding),
        career_filter: null,
        subject_filter: null,
        guide_type_filter: null,
        match_count: KNN_K,
        similarity_threshold: MIN_CLUSTER_SIMILARITY,
        classification_filter: null,
      },
    );

    if (searchErr || !neighbors?.length) {
      logActionDebug(
        LOG_CTX,
        `학년 ${grade}: 유사 가이드 없음 — ${searchErr?.message ?? "결과 0건"}`,
      );
      continue;
    }

    // 가이드 ID → 클러스터 + 난이도 조회
    const guideIds = (neighbors as Array<{ guide_id: string }>).map(
      (n) => n.guide_id,
    );
    const { data: guides } = await supabase
      .from("exploration_guides")
      .select("id, topic_cluster_id, difficulty_level")
      .in("id", guideIds);

    if (!guides?.length) continue;

    // 클러스터 매핑
    const guideCluster = new Map<
      string,
      { clusterId: string; difficulty: string | null }
    >();
    for (const g of guides) {
      if (g.topic_cluster_id) {
        guideCluster.set(g.id, {
          clusterId: g.topic_cluster_id,
          difficulty: g.difficulty_level,
        });
      }
    }

    // 클러스터 투표 (similarity-weighted, L3: ceiling 적용)
    const clusterVotes = new Map<
      string,
      { count: number; totalSim: number; difficulties: string[] }
    >();
    for (const n of neighbors as Array<{
      guide_id: string;
      score: number;
    }>) {
      const cluster = guideCluster.get(n.guide_id);
      if (!cluster) continue;
      const existing = clusterVotes.get(cluster.clusterId);
      if (existing) {
        // L3: 단일 클러스터 ceiling — 편중 방지
        if (existing.count >= MAX_VOTES_PER_CLUSTER) continue;
        existing.count++;
        existing.totalSim += n.score;
        if (cluster.difficulty) existing.difficulties.push(cluster.difficulty);
      } else {
        clusterVotes.set(cluster.clusterId, {
          count: 1,
          totalSim: n.score,
          difficulties: cluster.difficulty ? [cluster.difficulty] : [],
        });
      }
    }

    // 상위 N 클러스터
    const sorted = [...clusterVotes.entries()]
      .sort(
        (a, b) =>
          b[1].count - a[1].count || b[1].totalSim - a[1].totalSim,
      )
      .slice(0, MAX_CLUSTERS_PER_GRADE);

    // 클러스터 이름 조회
    const clusterIds = sorted.map(([id]) => id);
    const { data: clusters } = await supabase
      .from("exploration_guide_topic_clusters")
      .select("id, name")
      .in("id", clusterIds);

    const clusterNames = new Map<string, string>();
    for (const c of clusters ?? []) {
      clusterNames.set(c.id, c.name);
    }

    // 난이도 결정
    const gradeDifficultyDefault =
      grade === 1 ? "basic" : grade === 2 ? "intermediate" : "advanced";

    for (const [clusterId, vote] of sorted) {
      const diffCounts = new Map<string, number>();
      for (const d of vote.difficulties) {
        diffCounts.set(d, (diffCounts.get(d) ?? 0) + 1);
      }
      const bestDifficulty =
        diffCounts.size > 0
          ? [...diffCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
          : gradeDifficultyDefault;

      allTrajectories.push({
        grade,
        clusterId,
        clusterName: clusterNames.get(clusterId) ?? "",
        confidence: vote.totalSim / vote.count,
        difficultyLevel: bestDifficulty,
        sourceRecordIds: recordIds,
      });
    }
  }

  // 4. DB UPSERT
  if (allTrajectories.length > 0) {
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", studentId)
      .single();

    const rows = allTrajectories.map((t) => ({
      student_id: studentId,
      tenant_id: student?.tenant_id,
      grade: t.grade,
      topic_cluster_id: t.clusterId,
      source: "extracted_from_neis",
      confidence: Math.round(t.confidence * 100) / 100,
      evidence: {
        source_record_ids: t.sourceRecordIds,
        difficulty_level: t.difficultyLevel,
        extraction_reasoning: "세특 내용 벡터 유사도 기반 클러스터 투표",
        extracted_at: new Date().toISOString(),
      },
    }));

    const { error: upsertErr } = await supabase
      .from("student_record_topic_trajectories")
      .upsert(rows, {
        onConflict: "student_id,grade,topic_cluster_id",
      });

    if (upsertErr) throw upsertErr;
  }

  logActionDebug(
    LOG_CTX,
    `추출 완료: ${allTrajectories.length}건 (${embeddingCalls}회 임베딩)`,
  );

  return { trajectories: allTrajectories, embeddingCalls };
}

/** HTML 태그 제거 */
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
