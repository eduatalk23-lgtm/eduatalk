/**
 * Phase C-3 S3 Sprint G1 (2026-04-21): getBlueprint MCP tool.
 *
 * student_main_explorations 의 활성 tier_plan 을 3 tier 평탄화 형태로 반환.
 * scope×track×direction 슬라이스 하나만 반환(기본 overall/design).
 *
 * ArtifactPanel 은 tiers 를 읽어 BlueprintCard 로 렌더. applyArtifactEdit
 * (type='blueprint') 는 output.mainExplorationId + tiers diff 를 받아
 * student_main_explorations 에 새 version row 를 INSERT (is_active 스왑).
 *
 * Layer 1 가드: admin/consultant/superadmin 만 호출 가능 (student/parent 는
 * tier_plan 직접 노출 부적절).
 */

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveStudentTarget } from "@/lib/mcp/tools/_shared/resolveStudent";
import {
  getActiveMainExploration,
  type MainExplorationScope,
  type MainExplorationDirection,
  type MainExplorationTierEntry,
  type MainExplorationTierPlan,
} from "@/lib/domains/student-record/repository/main-exploration-repository";

/** Card 렌더·편집 기준 — tier_plan 한 단계 평탄화본. */
export type BlueprintTierProps = {
  theme: string | null;
  keyQuestions: string[];
  suggestedActivities: string[];
  /**
   * Blueprint 편집 대상 아님(read-only 배지). 원본 tier_plan 의
   * linked_*_ids 를 UI 친화적으로 재그룹.
   */
  linkedIds: {
    storyline: string[];
    roadmapItem: string[];
    narrativeArc: string[];
    hyperedge: string[];
    setekGuide: string[];
    changcheGuide: string[];
    haengteukGuide: string[];
    topicTrajectory: string[];
  };
};

export type BlueprintTiers = {
  foundational: BlueprintTierProps;
  development: BlueprintTierProps;
  advanced: BlueprintTierProps;
};

export type GetBlueprintOutput =
  | {
      ok: true;
      mainExplorationId: string;
      studentId: string;
      studentName: string | null;
      schoolYear: number;
      grade: number;
      semester: number;
      scope: MainExplorationScope;
      trackLabel: string | null;
      direction: MainExplorationDirection;
      themeLabel: string;
      themeKeywords: string[];
      careerField: string | null;
      version: number;
      origin: string;
      tiers: BlueprintTiers;
    }
  | { ok: false; reason: string };

export const getBlueprintDescription =
  "학생의 Blueprint(메인 탐구의 3단 tier_plan)를 조회합니다. scope/track/direction 로 슬라이스 지정(생략 시 overall/design). admin/consultant 전용. ArtifactPanel 에 BlueprintCard 로 렌더되고, HITL 편집 후 applyArtifactEdit(type='blueprint') 로 writeback 가능합니다.";

export const getBlueprintInputShape = {
  studentName: z
    .string()
    .min(1)
    .describe("대상 학생 이름 (같은 테넌트 내 검색)"),
  scope: z
    .enum(["overall", "track", "grade"])
    .optional()
    .describe("조회 범위. 기본 overall"),
  trackLabel: z
    .string()
    .min(1)
    .optional()
    .describe("scope='track' 일 때 진로 트랙 라벨. 기타 scope 에선 무시"),
  direction: z
    .enum(["analysis", "design"])
    .optional()
    .describe("분석(bottom-up) vs 설계(top-down). 기본 design"),
} as const;

export const getBlueprintInputSchema = z.object(getBlueprintInputShape);
export type GetBlueprintInput = z.infer<typeof getBlueprintInputSchema>;

export async function getBlueprintExecute({
  studentName,
  scope,
  trackLabel,
  direction,
}: GetBlueprintInput): Promise<GetBlueprintOutput> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "로그인이 필요합니다." };

  if (
    user.role !== "admin" &&
    user.role !== "consultant" &&
    user.role !== "superadmin"
  ) {
    return {
      ok: false,
      reason: "getBlueprint 는 admin/consultant 전용입니다.",
    };
  }

  const target = await resolveStudentTarget({ studentName });
  if (!target.ok) return { ok: false, reason: target.reason };

  const resolvedScope: MainExplorationScope = scope ?? "overall";
  const resolvedDirection: MainExplorationDirection = direction ?? "design";
  const resolvedTrack = resolvedScope === "track" ? (trackLabel ?? null) : null;

  const supabase = await createSupabaseServerClient();
  const exp = await getActiveMainExploration(
    target.studentId,
    target.tenantId,
    {
      scope: resolvedScope,
      trackLabel: resolvedTrack,
      direction: resolvedDirection,
    },
    supabase,
  );
  if (!exp) {
    return {
      ok: false,
      reason: `${resolvedScope}×${resolvedDirection} 활성 blueprint 를 찾을 수 없습니다.`,
    };
  }

  const tierPlan = (exp.tier_plan ?? {}) as MainExplorationTierPlan;

  return {
    ok: true,
    mainExplorationId: exp.id,
    studentId: target.studentId,
    studentName: target.studentName,
    schoolYear: exp.school_year,
    grade: exp.grade,
    semester: exp.semester as 1 | 2,
    scope: exp.scope as MainExplorationScope,
    trackLabel: exp.track_label,
    direction: exp.direction as MainExplorationDirection,
    themeLabel: exp.theme_label,
    themeKeywords: exp.theme_keywords ?? [],
    careerField: exp.career_field,
    version: exp.version,
    origin: exp.origin,
    tiers: {
      foundational: flattenTier(tierPlan.foundational),
      development: flattenTier(tierPlan.development),
      advanced: flattenTier(tierPlan.advanced),
    },
  };
}

function flattenTier(
  entry: MainExplorationTierEntry | undefined,
): BlueprintTierProps {
  return {
    theme: entry?.theme ?? null,
    keyQuestions: entry?.key_questions ?? [],
    suggestedActivities: entry?.suggested_activities ?? [],
    linkedIds: {
      storyline: entry?.linked_storyline_ids ?? [],
      roadmapItem: entry?.linked_roadmap_item_ids ?? [],
      narrativeArc: entry?.linked_narrative_arc_ids ?? [],
      hyperedge: entry?.linked_hyperedge_ids ?? [],
      setekGuide: entry?.linked_setek_guide_ids ?? [],
      changcheGuide: entry?.linked_changche_guide_ids ?? [],
      haengteukGuide: entry?.linked_haengteuk_guide_ids ?? [],
      topicTrajectory: entry?.linked_topic_trajectory_ids ?? [],
    },
  };
}
