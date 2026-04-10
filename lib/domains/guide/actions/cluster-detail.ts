"use server";

/**
 * 클러스터 상세 데이터 조회
 * 난이도별 가이드 목록 + 사슬 관계 (클러스터 내부)
 */

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "guide", action: "clusterDetail" };

export interface ClusterGuide {
  id: string;
  title: string;
  guideType: string;
  status: string;
  qualityScore: number | null;
  qualityTier: string | null;
}

export interface SequelLink {
  fromId: string;
  fromTitle: string;
  fromDifficulty: string | null;
  toId: string;
  toTitle: string;
  toDifficulty: string | null;
  confidence: number;
  relationType: string;
}

export interface ClusterDetail {
  cluster: {
    id: string;
    name: string;
    description: string | null;
    guideType: string;
    careerFieldCodes: string[];
    subjectHints: string[];
    guideCount: number;
    difficultyDistribution: Record<string, number>;
  };
  guidesByDifficulty: {
    basic: ClusterGuide[];
    intermediate: ClusterGuide[];
    advanced: ClusterGuide[];
  };
  sequelLinks: SequelLink[];
}

export async function fetchClusterDetailAction(
  clusterId: string,
): Promise<ActionResponse<ClusterDetail>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 1. 클러스터 메타
    const { data: cluster, error: clusterErr } = await supabase
      .from("exploration_guide_topic_clusters")
      .select(
        "id, name, description, guide_type, career_field_codes, subject_hints, guide_count, difficulty_distribution",
      )
      .eq("id", clusterId)
      .single();

    if (clusterErr || !cluster) {
      return createErrorResponse("클러스터를 찾을 수 없습니다.");
    }

    // 2. 해당 클러스터의 가이드 목록 (is_latest만)
    const { data: guides, error: guidesErr } = await supabase
      .from("exploration_guides")
      .select(
        "id, title, guide_type, status, quality_score, quality_tier, difficulty_level",
      )
      .eq("topic_cluster_id", clusterId)
      .eq("is_latest", true)
      .order("quality_score", { ascending: false, nullsFirst: false });

    if (guidesErr) throw guidesErr;

    // 난이도별 그룹핑
    const guidesByDifficulty = {
      basic: [] as ClusterGuide[],
      intermediate: [] as ClusterGuide[],
      advanced: [] as ClusterGuide[],
    };

    for (const g of guides ?? []) {
      const diff = g.difficulty_level ?? "basic";
      const entry: ClusterGuide = {
        id: g.id,
        title: g.title,
        guideType: g.guide_type,
        status: g.status,
        qualityScore: g.quality_score,
        qualityTier: g.quality_tier,
      };
      if (diff in guidesByDifficulty) {
        guidesByDifficulty[diff as keyof typeof guidesByDifficulty].push(entry);
      } else {
        guidesByDifficulty.basic.push(entry);
      }
    }

    // 3. 사슬 관계 (이 클러스터 내)
    const { data: sequels, error: sequelErr } = await supabase
      .from("exploration_guide_sequels")
      .select(
        "from_guide_id, to_guide_id, confidence, relation_type, from_guide:exploration_guides!exploration_guide_sequels_from_guide_id_fkey(title, difficulty_level), to_guide:exploration_guides!exploration_guide_sequels_to_guide_id_fkey(title, difficulty_level)",
      )
      .eq("topic_cluster_id", clusterId)
      .gte("confidence", 0.4)
      .order("confidence", { ascending: false })
      .limit(30);

    if (sequelErr) throw sequelErr;

    const sequelLinks: SequelLink[] = (sequels ?? []).map((s) => {
      const from = s.from_guide as unknown as {
        title: string;
        difficulty_level: string | null;
      } | null;
      const to = s.to_guide as unknown as {
        title: string;
        difficulty_level: string | null;
      } | null;
      return {
        fromId: s.from_guide_id,
        fromTitle: from?.title ?? "",
        fromDifficulty: from?.difficulty_level ?? null,
        toId: s.to_guide_id,
        toTitle: to?.title ?? "",
        toDifficulty: to?.difficulty_level ?? null,
        confidence: s.confidence,
        relationType: s.relation_type,
      };
    });

    return createSuccessResponse({
      cluster: {
        id: cluster.id,
        name: cluster.name,
        description: cluster.description,
        guideType: cluster.guide_type,
        careerFieldCodes: cluster.career_field_codes ?? [],
        subjectHints: cluster.subject_hints ?? [],
        guideCount: cluster.guide_count,
        difficultyDistribution:
          (cluster.difficulty_distribution as Record<string, number>) ?? {},
      },
      guidesByDifficulty,
      sequelLinks,
    });
  } catch (error) {
    logActionError(LOG_CTX, error, { clusterId });
    return createErrorResponse("클러스터 상세를 불러올 수 없습니다.");
  }
}
