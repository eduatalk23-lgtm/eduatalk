"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { diversifyByCluster } from "../utils/cluster-diversity";
import { computeGuideRanking, type RankedGuide } from "../capability/ranking";
import { loadGuideRankingMetadata } from "../capability/ranking-metadata";
import { loadToolRankingTokens } from "../capability/tool-ranking-context";

const LOG_CTX = { domain: "guide", action: "autoRecommend" } as const;

export type ActivityType = "autonomy" | "club" | "career";

/**
 * 매칭 사유 라벨.
 *
 * 후방 호환:
 *   - "both" — 레거시 (classification + subject 동시 매칭). phase-s2-edges.ts 가
 *     이 값을 priority 키로 사용하므로 보존. Wave 4 (D1 runGuideMatching 대수술) 에서 제거 예정.
 *
 * 신규 (Phase 2 Wave 3.2):
 *   - "activity" — activity_type 단독 매칭 (창체 영역)
 *   - "classification+activity" — KEDI 분류 + activity_type
 *   - "subject+activity" — 과목 + activity_type
 *   - "all" — 3축 모두 매칭
 */
export type MatchReason =
  | "classification"
  | "subject"
  | "both" // legacy: classification + subject (보존)
  | "activity"
  | "classification+activity"
  | "subject+activity"
  | "all"
  | "sequel"; // Phase A: 이미 배정된 가이드의 다음 단계

export interface RecommendedGuide {
  id: string;
  title: string;
  guide_type: string | null;
  book_title: string | null;
  match_reason: MatchReason;
  /** Phase β G10/G3 — 배정 시 재사용. 없으면 null. */
  difficulty_level?: "basic" | "intermediate" | "advanced" | null;
  topic_cluster_id?: string | null;
  /** Phase β G3 — 활성 main_exploration tier_plan 에 연결된 클러스터면 true */
  main_exploration_boosted?: boolean;
}

/**
 * DB 기반 가이드 자동 추천 (벡터 검색 X, API 할당량 소모 없음)
 *
 * 매칭 축 (Phase 2 Wave 3.2 시점, Decision #2/#5 반영):
 *   1. classification — exploration_guide_classification_mappings (KEDI 소분류)
 *   2. subject        — subjects → exploration_guide_subject_mappings (교과 매칭, 세특용)
 *   3. activity_type  — exploration_guide_activity_mappings (autonomy/club/career, 창체용)
 *
 * 이미 배정된 가이드 제외, approved + is_latest 필터.
 *
 * 호출자가 activity_type 만 지정하면 창체 영역 가이드만 매칭됨 (subject 없는 매칭).
 * runGuideMatching(synthesis Phase 2)에서 세특·창체 영역별로 분리 호출 가능.
 */
export async function autoRecommendGuidesAction(input: {
  studentId: string;
  classificationId?: number | null;
  subjectName?: string | null;
  activityType?: ActivityType | null;
  /** H3: 학생 전공 기반 career_field 힌트 (예: "인문사회", "공학") */
  careerFieldHint?: string | null;
  limit?: number;
  /** Phase β G3 — 난이도 cap 비활성화 (테스트/컨설턴트 오버라이드) */
  skipDifficultyCap?: boolean;
}): Promise<ActionResponse<RecommendedGuide[]>> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();
    const limit = input.limit ?? 5;

    // Phase β G3 — 학생 격자 컨텍스트 자동 해결 (cap + tier 부스팅)
    const gridCtx = await resolveRecommendationGridContext(input.studentId);

    // 1. classification 기반 guide_id 조회
    const classGuideIds = new Set<string>();
    if (input.classificationId) {
      const { data: cm } = await supabase
        .from("exploration_guide_classification_mappings")
        .select("guide_id")
        .eq("classification_id", input.classificationId);
      for (const r of cm ?? []) classGuideIds.add(r.guide_id);
    }

    // 2. subject 기반 guide_id 조회
    // Wave 5.1e: `.limit(1)` 제거 → 동명 subject_id 가 여러 개인 경우(2022 개정
    //   교육과정 전환 잔재)에도 **모든** subject_id 의 매핑을 합집합으로 수집.
    //   예: "수학과제 탐구" 가 진로선택/융합선택 2종으로 등록돼 있을 때 한쪽만
    //   뽑아 가이드를 못 찾는 비결정적 버그를 차단.
    const subjectGuideIds = new Set<string>();
    if (input.subjectName) {
      const { data: subjectRows } = await supabase
        .from("subjects")
        .select("id")
        .eq("name", input.subjectName);

      if (subjectRows && subjectRows.length > 0) {
        const subjectIds = subjectRows.map((r) => r.id);
        const { data: sm } = await supabase
          .from("exploration_guide_subject_mappings")
          .select("guide_id")
          .in("subject_id", subjectIds);
        for (const r of sm ?? []) subjectGuideIds.add(r.guide_id);
      }
    }

    // 3. activity_type 기반 guide_id 조회 (Phase 2 Wave 3.2 신규)
    const activityGuideIds = new Set<string>();
    if (input.activityType) {
      const { data: am } = await supabase
        .from("exploration_guide_activity_mappings")
        .select("guide_id")
        .eq("activity_type", input.activityType);
      for (const r of am ?? []) activityGuideIds.add(r.guide_id);
    }

    // 3.5-pre. H3: career_field 기반 guide_id 조회 (전공 인식 매칭)
    // P5: careerFieldHint는 "자연과학" 등 학생 광역코드. 가이드 DB는 "자연계열" 등
    //     name_kor 이라 직접 ilike substring 매칭이 실패(이전 버그)했었다.
    //     getCompatibleGuideCareerFields() 로 호환 이름 세트로 변환해 IN 매칭.
    const { getCompatibleGuideCareerFields } = await import(
      "@/lib/domains/student-record/constants"
    );
    const compatibleGuideFields = getCompatibleGuideCareerFields(
      input.careerFieldHint ?? null,
    );
    const careerGuideIds = new Set<string>();
    if (compatibleGuideFields && compatibleGuideFields.length > 0) {
      const { data: cf } = await supabase
        .from("exploration_guide_career_fields")
        .select("id")
        .in("name_kor", compatibleGuideFields);
      const cfIds = (cf ?? []).map((r) => r.id);
      if (cfIds.length > 0) {
        const { data: cm } = await supabase
          .from("exploration_guide_career_mappings")
          .select("guide_id")
          .in("career_field_id", cfIds);
        for (const r of cm ?? []) careerGuideIds.add(r.guide_id);
      }
    }

    // 3.5. Phase A: 이미 배정된 가이드의 sequel 타겟 추가
    const sequelGuideIds = new Set<string>();
    if (input.studentId) {
      const { data: existingAssigns } = await supabase
        .from("exploration_guide_assignments")
        .select("guide_id")
        .eq("student_id", input.studentId);
      const assignedGuideIds = (existingAssigns ?? []).map((a) => a.guide_id);
      if (assignedGuideIds.length > 0) {
        const { data: sequels } = await supabase
          .from("exploration_guide_sequels")
          .select("to_guide_id")
          .in("from_guide_id", assignedGuideIds)
          .gte("confidence", 0.5);
        for (const s of sequels ?? []) sequelGuideIds.add(s.to_guide_id);
      }
    }

    // 4. UNION + match_reason 결정 (3축 + career 비트마스크 → 라벨)
    //
    // P5 (2026-04-14): careerGuideIds 는 union 에서 제외.
    //   - 이전 ilike 매칭 시 최대 3 cf 매칭이라 careerGuideIds 가 적어 union 추가 안전.
    //   - P5에서 IN 매칭으로 바꾸면서 호환 풀이 수천 건(예: 자연/의약/공학+전계열+미분류 = 7천+)이 되어
    //     candidateIds 가 폭증 → 후속 supabase `.in()` 호출이 PostgREST URL 한도 초과로 빈 결과 반환.
    //   - 어차피 P5 호환성 하드 필터(compatibleGuideFields)가 비호환 가이드를 차단하므로,
    //     career 매칭은 reason 라벨링용으로만 두고 풀 확장 효과는 호환 필터 통과로 자연 흡수.
    const guideReasonMap = new Map<string, MatchReason>();
    const allIds = new Set<string>([
      ...classGuideIds,
      ...subjectGuideIds,
      ...activityGuideIds,
      ...sequelGuideIds,
    ]);

    for (const id of allIds) {
      const c = classGuideIds.has(id);
      const s = subjectGuideIds.has(id);
      const a = activityGuideIds.has(id);
      const sq = sequelGuideIds.has(id);
      // H3: career_field 매칭은 기존 reason을 유지하되, 단독 매칭 시에만 match_reason 설정
      const cf = careerGuideIds.has(id);
      let reason: MatchReason;
      if (c && s && a) reason = "all";
      else if (c && s) reason = "both"; // 레거시 호환 — phase-s2-edges priority
      else if (c && a) reason = "classification+activity";
      else if (s && a) reason = "subject+activity";
      else if (c) reason = "classification";
      else if (s) reason = "subject";
      else if (a) reason = "activity";
      else if (sq) reason = "sequel";
      else if (cf) reason = "classification"; // career field 단독은 classification급
      else reason = "classification";
      guideReasonMap.set(id, reason);
    }

    if (guideReasonMap.size === 0) {
      return createSuccessResponse([]);
    }

    // 5. 이미 배정된 가이드 제외
    const { data: assigned } = await supabase
      .from("exploration_guide_assignments")
      .select("guide_id")
      .eq("student_id", input.studentId);
    const assignedIds = new Set((assigned ?? []).map((a) => a.guide_id));

    const candidateIds = [...guideReasonMap.keys()].filter(
      (id) => !assignedIds.has(id),
    );
    if (candidateIds.length === 0) {
      return createSuccessResponse([]);
    }

    // 5.5. P5: 전공 호환성 하드 필터 — 학생 careerFieldHint가 있을 때,
    //      career_mappings가 비호환 계열에만 매핑된 가이드는 제외.
    //      매핑이 아예 없는 가이드는 통과(보수적: 범용/미분류 가이드 살림).
    let filteredCandidateIds = candidateIds;
    if (compatibleGuideFields && compatibleGuideFields.length > 0) {
      const { data: mappingRows } = await supabase
        .from("exploration_guide_career_mappings")
        .select("guide_id, exploration_guide_career_fields!inner(name_kor)")
        .in("guide_id", candidateIds);

      const compatSet = new Set(compatibleGuideFields);
      const fieldsByGuide = new Map<string, string[]>();
      for (const row of mappingRows ?? []) {
        const r = row as {
          guide_id: string;
          exploration_guide_career_fields:
            | { name_kor: string }
            | { name_kor: string }[];
        };
        const name = Array.isArray(r.exploration_guide_career_fields)
          ? r.exploration_guide_career_fields[0]?.name_kor
          : r.exploration_guide_career_fields?.name_kor;
        if (!name) continue;
        const list = fieldsByGuide.get(r.guide_id) ?? [];
        list.push(name);
        fieldsByGuide.set(r.guide_id, list);
      }

      filteredCandidateIds = candidateIds.filter((id) => {
        const fields = fieldsByGuide.get(id);
        if (!fields || fields.length === 0) return true; // 매핑 없음 → 통과
        return fields.some((f) => compatSet.has(f)); // 하나라도 호환
      });

      if (filteredCandidateIds.length === 0) {
        return createSuccessResponse([]);
      }
    }

    // 6. approved 필터 + 메타 JOIN (topic_cluster_id 포함 — L3 다양성)
    //    Phase β G3 — difficulty cap: 학생 adequate_level 로 허용 난이도 상한 적용.
    //    허용 풀에 null(미분류)도 포함 — cap 체계 밖의 범용 가이드 살림.
    const fetchLimit = Math.min(filteredCandidateIds.length, limit * 3);
    let guidesQuery = supabase
      .from("exploration_guides")
      .select("id, title, guide_type, book_title, topic_cluster_id, difficulty_level")
      .in("id", filteredCandidateIds)
      .eq("status", "approved")
      .eq("is_latest", true);

    if (!input.skipDifficultyCap && gridCtx.allowedDifficulties) {
      // difficulty_level IS NULL 도 포함 (범용 가이드)
      const csv = gridCtx.allowedDifficulties
        .map((d) => `"${d}"`)
        .join(",");
      guidesQuery = guidesQuery.or(
        `difficulty_level.is.null,difficulty_level.in.(${csv})`,
      );
    }

    const { data: guides } = await guidesQuery.limit(fetchLimit);

    type ResultRow = RecommendedGuide & {
      topic_cluster_id: string | null;
      difficulty_level: "basic" | "intermediate" | "advanced" | null;
      main_exploration_boosted: boolean;
    };

    const result: ResultRow[] = (guides ?? []).map((g) => {
      const difficulty =
        g.difficulty_level === "basic" ||
        g.difficulty_level === "intermediate" ||
        g.difficulty_level === "advanced"
          ? g.difficulty_level
          : null;
      const boosted =
        g.topic_cluster_id != null &&
        gridCtx.boostedClusterIds.has(g.topic_cluster_id);
      return {
        id: g.id,
        title: g.title,
        guide_type: g.guide_type,
        book_title: g.book_title,
        match_reason: guideReasonMap.get(g.id) ?? "classification",
        topic_cluster_id: g.topic_cluster_id ?? null,
        difficulty_level: difficulty,
        main_exploration_boosted: boosted,
      };
    });

    // M1-b (2026-04-27): pipeline 과 동일한 capability 산식 적용.
    //   - 6 승수 보너스 + midPlanBonus(격차 3) + 클러스터 페널티가 tool 사용자에게도 도달.
    //   - main_exploration_boosted 는 capability finalScore 기반 정렬 위에 추가 가산.
    const tokens = await loadToolRankingTokens(supabase, input.studentId);
    const studentGrade = tokens.studentGrade ?? 1;
    const tenantId = tokens.tenantId;

    let ranked: RankedGuide[] = [];
    if (tenantId) {
      const metadata = await loadGuideRankingMetadata(supabase, {
        studentId: input.studentId,
        tenantId,
        guideIds: result.map((g) => g.id),
      });
      ranked = computeGuideRanking({
        guides: result.map((g) => ({
          id: g.id,
          title: g.title,
          guide_type: g.guide_type,
          match_reason: g.match_reason,
        })),
        studentGrade,
        clubHistory: metadata.clubHistory,
        lineageByGuide: metadata.lineageByGuide,
        difficultyByGuide: metadata.difficultyByGuide,
        clusterByGuide: metadata.clusterByGuide,
        sequelTargets: metadata.sequelTargets,
        exploredClusters: metadata.exploredClusters,
        majorMatchGuides: metadata.majorMatchGuides,
        hyperedgeTokens: metadata.hyperedgeTokens,
        weakStageGuideTypes: metadata.weakStageGuideTypes,
        storylineKeywords: metadata.storylineKeywords,
        midPlanFocusTokens: tokens.midPlanFocusTokens,
      });
    }

    // capability 결과를 base 로, ResultRow 메타(book_title / boosted / topic_cluster_id) 와 결합
    const rankedById = new Map(ranked.map((r) => [r.id, r]));
    const mergedScored = result.map((row) => {
      const r = rankedById.get(row.id);
      const base = r?.finalScore ?? 1;
      const boosted = row.main_exploration_boosted ? 1.1 : 1.0;
      return { row, score: base * boosted };
    });
    mergedScored.sort((a, b) => b.score - a.score);
    const sorted = mergedScored.map((m) => m.row);

    // L3: 클러스터 다양성 (capability 페널티 위에 추가로 N개 cap 적용)
    const diversified = diversifyByCluster(
      sorted,
      (g) => g.topic_cluster_id,
      limit,
    );

    return createSuccessResponse(
      diversified.map((g) => ({
        id: g.id,
        title: g.title,
        guide_type: g.guide_type,
        book_title: g.book_title,
        match_reason: g.match_reason,
        difficulty_level: g.difficulty_level,
        topic_cluster_id: g.topic_cluster_id,
        main_exploration_boosted: g.main_exploration_boosted,
      })),
    );
  } catch (error) {
    logActionError(LOG_CTX, error, { studentId: input.studentId });
    return createErrorResponse("가이드 추천 조회에 실패했습니다.");
  }
}

/**
 * Phase β G3 — 추천 격자 컨텍스트.
 *   - allowedDifficulties: 학생 adequate_level → leveling_to_difficulty cap 허용 풀
 *   - boostedClusterIds:  활성 main_exploration tier_plan 의 linked_topic_trajectory_ids
 *                         → topic_cluster_ids 집합
 * 조회 실패 시 null/빈 set 로 폴백 — 기존 동작 회귀 없음.
 */
async function resolveRecommendationGridContext(studentId: string): Promise<{
  allowedDifficulties: ("basic" | "intermediate" | "advanced")[] | null;
  boostedClusterIds: Set<string>;
}> {
  const boostedClusterIds = new Set<string>();
  let allowedDifficulties:
    | ("basic" | "intermediate" | "advanced")[]
    | null = null;

  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { allowedDifficulties: null, boostedClusterIds };

  try {
    const { data: studentRow } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", studentId)
      .maybeSingle();
    const tenantId = studentRow?.tenant_id ?? null;
    if (!tenantId) return { allowedDifficulties: null, boostedClusterIds };

    // 1. adequate_level → difficulty cap
    const { data: level } = await supabase
      .from("student_exploration_levels")
      .select("adequate_level")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .order("school_year", { ascending: false })
      .order("semester", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (level?.adequate_level != null) {
      const lv = level.adequate_level;
      if (lv <= 2) allowedDifficulties = ["basic"];
      else if (lv === 3) allowedDifficulties = ["basic", "intermediate"];
      else allowedDifficulties = ["basic", "intermediate", "advanced"];
    }

    // 2. 활성 main_exploration tier_plan → trajectory ids → topic_cluster_ids
    const { getActiveMainExploration } = await import(
      "@/lib/domains/student-record/repository/main-exploration-repository"
    );
    const design = await getActiveMainExploration(studentId, tenantId, {
      scope: "overall",
      trackLabel: null,
      direction: "design",
    });
    const active =
      design ??
      (await getActiveMainExploration(studentId, tenantId, {
        scope: "overall",
        trackLabel: null,
        direction: "analysis",
      }));

    if (active?.tier_plan) {
      const trajectoryIds = collectLinkedTrajectoryIds(active.tier_plan);
      if (trajectoryIds.length > 0) {
        const { data: trajectories } = await supabase
          .from("student_record_topic_trajectories")
          .select("topic_cluster_id")
          .in("id", trajectoryIds);
        for (const t of trajectories ?? []) {
          if (t.topic_cluster_id) boostedClusterIds.add(t.topic_cluster_id);
        }
      }
    }
  } catch {
    // fallback 유지
  }

  return { allowedDifficulties, boostedClusterIds };
}

function collectLinkedTrajectoryIds(tierPlan: unknown): string[] {
  if (!tierPlan || typeof tierPlan !== "object") return [];
  const out = new Set<string>();
  for (const tier of ["foundational", "development", "advanced"] as const) {
    const entry = (tierPlan as Record<string, unknown>)[tier];
    if (!entry || typeof entry !== "object") continue;
    const ids = (entry as Record<string, unknown>).linked_topic_trajectory_ids;
    if (Array.isArray(ids)) {
      for (const id of ids) if (typeof id === "string") out.add(id);
    }
  }
  return [...out];
}
