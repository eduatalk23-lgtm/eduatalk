"use server";

/**
 * 궤적 기반 보완/발전 가이드 추천
 *
 * 학생의 현재 탐구 궤적에서:
 * 1. sequel 체인의 다음 난이도 단계 가이드 (next_step)
 * 2. 이미 배정된 가이드 제외
 */

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "guide", action: "suggestGapGuides" };

const NEXT_DIFFICULTY: Record<string, string | null> = {
  basic: "intermediate",
  intermediate: "advanced",
  advanced: null,
};

const DIFFICULTY_LABELS: Record<string, string> = {
  basic: "기초",
  intermediate: "발전",
  advanced: "심화",
};

export interface GapSuggestion {
  guideId: string;
  title: string;
  guideType: string;
  clusterName: string;
  difficultyLevel: string;
  reason: "next_step" | "gap_fill";
  reasonDetail: string;
  sourceTrajectory?: {
    grade: number;
    clusterName: string;
    difficulty: string;
  };
}

/**
 * 학생의 궤적에서 다음 단계 가이드를 추천합니다.
 */
export async function suggestGapGuidesAction(
  studentId: string,
): Promise<ActionResponse<GapSuggestion[]>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    // 1. 학생 궤적 로드
    const { data: trajectories, error: trajErr } = await supabase
      .from("student_record_topic_trajectories")
      .select(
        "grade, topic_cluster_id, evidence, cluster:exploration_guide_topic_clusters!student_record_topic_trajectories_topic_cluster_id_fkey(name)",
      )
      .eq("student_id", studentId)
      .order("grade", { ascending: true });

    if (trajErr) throw trajErr;
    if (!trajectories || trajectories.length === 0) {
      return createSuccessResponse([]);
    }

    // 2. 이미 배정된 가이드 제외용
    const { data: assignments } = await supabase
      .from("exploration_guide_assignments")
      .select("guide_id")
      .eq("student_id", studentId)
      .is("deleted_at", null);

    const assignedIds = new Set(
      (assignments ?? []).map((a) => a.guide_id),
    );

    // 3. 각 궤적의 다음 단계 가이드 조회 (sequel 체인)
    const suggestions: GapSuggestion[] = [];

    for (const traj of trajectories) {
      const difficulty =
        (traj.evidence as { difficulty_level?: string })?.difficulty_level ??
        "basic";
      const nextDiff = NEXT_DIFFICULTY[difficulty];
      if (!nextDiff || !traj.topic_cluster_id) continue;

      const clusterName =
        (traj.cluster as { name: string } | null)?.name ?? "";

      // sequel 테이블에서 같은 클러스터의 다음 난이도 가이드 조회
      const { data: sequels } = await supabase
        .from("exploration_guide_sequels")
        .select(
          "to_guide_id, confidence, to_guide:exploration_guides!exploration_guide_sequels_to_guide_id_fkey(id, title, guide_type, topic_cluster_id, difficulty_level, status, is_latest)",
        )
        .eq("difficulty_step", `${difficulty}_to_${nextDiff}`)
        .gte("confidence", 0.4);

      if (!sequels?.length) continue;

      // 같은 클러스터 + approved + is_latest만 필터
      for (const s of sequels) {
        const guide = s.to_guide as {
          id: string;
          title: string;
          guide_type: string;
          topic_cluster_id: string | null;
          difficulty_level: string | null;
          status: string;
          is_latest: boolean;
        } | null;

        if (!guide) continue;
        if (guide.status !== "approved" || !guide.is_latest) continue;
        if (guide.topic_cluster_id !== traj.topic_cluster_id) continue;
        if (assignedIds.has(guide.id)) continue;

        // 중복 방지 (같은 가이드가 여러 sequel에서 나올 수 있음)
        if (suggestions.some((sg) => sg.guideId === guide.id)) continue;

        suggestions.push({
          guideId: guide.id,
          title: guide.title,
          guideType: guide.guide_type,
          clusterName,
          difficultyLevel: guide.difficulty_level ?? nextDiff,
          reason: "next_step",
          reasonDetail: `${DIFFICULTY_LABELS[difficulty]} 탐구 완료 → ${DIFFICULTY_LABELS[nextDiff]} 단계 추천`,
          sourceTrajectory: {
            grade: traj.grade,
            clusterName,
            difficulty,
          },
        });
      }
    }

    // 4. 탐구 이력이 있지만 sequel 매칭이 없는 클러스터 → gap_fill
    // 같은 클러스터의 다음 난이도 가이드를 직접 조회
    const coveredClusters = new Set(
      suggestions.map((s) => `${s.clusterName}:${s.difficultyLevel}`),
    );

    for (const traj of trajectories) {
      const difficulty =
        (traj.evidence as { difficulty_level?: string })?.difficulty_level ??
        "basic";
      const nextDiff = NEXT_DIFFICULTY[difficulty];
      if (!nextDiff || !traj.topic_cluster_id) continue;

      const clusterName =
        (traj.cluster as { name: string } | null)?.name ?? "";

      // 이미 sequel로 추천된 클러스터+난이도면 스킵
      if (coveredClusters.has(`${clusterName}:${nextDiff}`)) continue;

      // 같은 클러스터의 다음 난이도 가이드 직접 조회
      const { data: gapGuides } = await supabase
        .from("exploration_guides")
        .select("id, title, guide_type, difficulty_level")
        .eq("topic_cluster_id", traj.topic_cluster_id)
        .eq("difficulty_level", nextDiff)
        .eq("status", "approved")
        .eq("is_latest", true)
        .limit(2);

      for (const g of gapGuides ?? []) {
        if (assignedIds.has(g.id)) continue;
        if (suggestions.some((sg) => sg.guideId === g.id)) continue;

        suggestions.push({
          guideId: g.id,
          title: g.title,
          guideType: g.guide_type,
          clusterName,
          difficultyLevel: g.difficulty_level ?? nextDiff,
          reason: "gap_fill",
          reasonDetail: `${clusterName} 클러스터의 ${DIFFICULTY_LABELS[nextDiff]} 난이도 보완`,
          sourceTrajectory: {
            grade: traj.grade,
            clusterName,
            difficulty,
          },
        });
      }
    }

    // 5. 정렬: next_step > gap_fill
    const REASON_ORDER = { next_step: 0, gap_fill: 1 } as const;
    suggestions.sort(
      (a, b) => REASON_ORDER[a.reason] - REASON_ORDER[b.reason],
    );

    return createSuccessResponse(suggestions);
  } catch (error) {
    logActionError(LOG_CTX, error, { studentId });
    return createErrorResponse("보완 가이드 추천에 실패했습니다.");
  }
}
