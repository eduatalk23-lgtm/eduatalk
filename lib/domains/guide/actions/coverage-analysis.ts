"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LOG_CTX = { domain: "guide", action: "coverage-analysis" };

export interface ClusterCoverage {
  id: string;
  name: string;
  description: string | null;
  guide_type: string;
  guide_count: number;
  difficulty_distribution: {
    basic?: number;
    intermediate?: number;
    advanced?: number;
  };
  career_field_codes: string[] | null;
  subject_hints: string[] | null;
  /** 경고: 빈 난이도 슬롯 */
  gaps: string[];
}

export interface CoverageReport {
  clusters: ClusterCoverage[];
  summary: {
    totalClusters: number;
    totalGuides: number;
    clustersWithGaps: number;
    noBasic: number;
    noAdvanced: number;
    noIntermediate: number;
  };
}

/** 클러스터별 커버리지 갭 분석 */
export async function fetchCoverageReportAction(): Promise<
  ActionResponse<CoverageReport>
> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("exploration_guide_topic_clusters")
      .select("id, name, description, guide_type, guide_count, difficulty_distribution, career_field_codes, subject_hints")
      .order("guide_count", { ascending: false });

    if (error) throw error;

    let noBasic = 0;
    let noIntermediate = 0;
    let noAdvanced = 0;

    const clusters: ClusterCoverage[] = (data ?? []).map((c) => {
      const dist = (c.difficulty_distribution ?? {}) as ClusterCoverage["difficulty_distribution"];
      const gaps: string[] = [];

      if (!dist.basic || dist.basic === 0) {
        gaps.push("basic");
        noBasic++;
      }
      if (!dist.intermediate || dist.intermediate === 0) {
        gaps.push("intermediate");
        noIntermediate++;
      }
      if (!dist.advanced || dist.advanced === 0) {
        gaps.push("advanced");
        noAdvanced++;
      }

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        guide_type: c.guide_type,
        guide_count: c.guide_count,
        difficulty_distribution: dist,
        career_field_codes: c.career_field_codes,
        subject_hints: c.subject_hints,
        gaps,
      };
    });

    const clustersWithGaps = clusters.filter((c) => c.gaps.length > 0).length;

    return createSuccessResponse({
      clusters,
      summary: {
        totalClusters: clusters.length,
        totalGuides: clusters.reduce((sum, c) => sum + c.guide_count, 0),
        clustersWithGaps,
        noBasic,
        noAdvanced,
        noIntermediate,
      },
    });
  } catch (error) {
    logActionError(LOG_CTX, error);
    return createErrorResponse("커버리지 분석에 실패했습니다.");
  }
}
