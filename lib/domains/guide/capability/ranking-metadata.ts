// ============================================
// guide/capability/ranking-metadata.ts
//
// 가이드 랭킹 capability 입력 DTO(GuideMatchingInput) 의 사전 조회 헬퍼.
// M1-b (2026-04-27): pipeline phase-s2-guide-ranking 와 tool path(auto-recommend)가
//   동일한 DB 메타 조회 + 토큰화 로직을 공유하도록 추출.
//
// 본 파일은 Supabase 어댑터 — 산식 자체는 ./ranking.ts 의 computeGuideRanking 호출.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  classifyClubByName,
  type ClubHistoryEntry,
  type Lineage12,
  CAREER_FIELD_TO_LINEAGE_12,
} from "@/lib/domains/student-record/evaluation-criteria/club-lineage";
import { WEAK_STAGE_GUIDE_TYPE_MAP } from "./ranking";

type Client = SupabaseClient<Database>;

export interface RankingMetadata {
  clubHistory: ClubHistoryEntry[];
  lineageByGuide: Map<string, Lineage12 | null>;
  difficultyByGuide: Map<string, string | null>;
  clusterByGuide: Map<string, string | null>;
  sequelTargets: Set<string>;
  exploredClusters: Set<string>;
  majorMatchGuides: Set<string>;
  hyperedgeTokens: Set<string>;
  weakStageGuideTypes: Set<string>;
  storylineKeywords: Set<string>;
}

export interface LoadRankingMetadataOptions {
  /** 전공 적합 보너스용 — 학생 전공 권장 과목 id 집합. 없으면 majorBonus 미적용. */
  majorRecommendedSubjectIds?: Set<string>;
}

/**
 * 학생 동아리 활동 이력 조회 — 12계열 연속성 점수용.
 * (이전 phase-s2-guide-ranking.ts 의 fetchClubHistory 와 동일 로직.)
 */
export async function fetchClubHistory(
  supabase: Client,
  studentId: string,
  tenantId: string,
): Promise<ClubHistoryEntry[]> {
  const { data } = await supabase
    .from("student_record_changche")
    .select(
      "grade, content, imported_content, confirmed_content, ai_draft_content, activity_type",
    )
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("activity_type", "club")
    .order("grade");

  if (!data) return [];

  const history: ClubHistoryEntry[] = [];
  for (const row of data as Array<{
    grade: number;
    content?: string | null;
    imported_content?: string | null;
    confirmed_content?: string | null;
    ai_draft_content?: string | null;
  }>) {
    const text =
      row.imported_content?.trim() ||
      row.confirmed_content?.trim() ||
      row.content?.trim() ||
      row.ai_draft_content?.trim() ||
      "";
    if (!text) continue;
    const firstLine = text.split("\n")[0].slice(0, 80);
    const lineage = classifyClubByName(firstLine);
    history.push({ grade: row.grade, name: firstLine, lineage });
  }
  return history;
}

/**
 * 가이드 랭킹 metadata 사전 조회.
 * 호출자: phase-s2-guide-ranking, auto-recommend (tool path).
 *
 * 반환 객체를 그대로 computeGuideRanking() 의 input 으로 spread 가능.
 */
export async function loadGuideRankingMetadata(
  supabase: Client,
  params: {
    studentId: string;
    tenantId: string;
    guideIds: string[];
  },
  options?: LoadRankingMetadataOptions,
): Promise<RankingMetadata> {
  const { studentId, tenantId, guideIds } = params;
  const majorRecommendedSubjectIds = options?.majorRecommendedSubjectIds;

  // 학생 동아리 이력 (12계열 연속성)
  const clubHistory = await fetchClubHistory(supabase, studentId, tenantId);

  // hyperedge 테마 + narrative_arc (analysis + blueprint context)
  const [hyperedgeThemeRows, narrativeRows] = await Promise.all([
    supabase
      .from("student_record_hyperedges")
      .select("theme_label")
      .eq("student_id", studentId)
      .in("edge_context", ["analysis", "blueprint"])
      .order("member_count", { ascending: false })
      .limit(8)
      .then((r) => r.data),
    supabase
      .from("student_record_narrative_arc")
      .select(
        "curiosity_present, topic_selection_present, inquiry_content_present, references_present, conclusion_present, teacher_observation_present, growth_narrative_present, reinquiry_present",
      )
      .eq("student_id", studentId)
      .then((r) => r.data),
  ]);

  // hyperedge → 토큰 (공백/중점 분리, 2자 이상)
  const hyperedgeTokens = new Set<string>();
  for (const row of hyperedgeThemeRows ?? []) {
    const label = (row.theme_label as string | null) ?? "";
    if (!label) continue;
    for (const tok of label.split(/[\s·,·/]+/)) {
      const t = tok.trim();
      if (t.length >= 2) hyperedgeTokens.add(t);
    }
  }

  // narrative_arc 약한 단계 → guide_type 세트
  const weakStageGuideTypes = new Set<string>();
  if (narrativeRows && narrativeRows.length > 0) {
    const total = narrativeRows.length;
    const threshold = Math.max(1, Math.round(total * 0.5));
    const check = (key: keyof (typeof narrativeRows)[number]): number =>
      narrativeRows.filter((r) => r[key] === true).length;
    const stageCounts: Record<string, number> = {
      지적호기심: check("curiosity_present"),
      주제선정: check("topic_selection_present"),
      "탐구내용/이론": check("inquiry_content_present"),
      참고문헌: check("references_present"),
      "결론/제언": check("conclusion_present"),
      교사관찰: check("teacher_observation_present"),
      성장서사: check("growth_narrative_present"),
      "오류분석→재탐구": check("reinquiry_present"),
    };
    for (const [stage, cnt] of Object.entries(stageCounts)) {
      if (cnt < threshold) {
        const types = WEAK_STAGE_GUIDE_TYPE_MAP[stage];
        if (types) for (const t of types) weakStageGuideTypes.add(t);
      }
    }
  }

  // 스토리라인 키워드 (4단 fallback: keywords → title/grade_theme → tier_plan → blueprint)
  const storylineKeywords = await collectStorylineKeywords(
    supabase,
    studentId,
    tenantId,
  );

  // 가이드 메타 + sequel + 궤적 + subject_mapping 병렬
  const guideIdsArray = guideIds.length > 0 ? guideIds : ["__none__"]; // 빈 배열일 때 .in() 가드
  const [
    cfRows,
    phaseARows,
    existingAssignments,
    sequelRows,
    trajectoryRows,
    subjectMappingRows,
  ] = await Promise.all([
    supabase
      .from("exploration_guide_career_mappings")
      .select("guide_id, exploration_guide_career_fields!inner(name_kor)")
      .in("guide_id", guideIdsArray)
      .then((r) => r.data),
    supabase
      .from("exploration_guides")
      .select("id, difficulty_level, topic_cluster_id")
      .in("id", guideIdsArray)
      .then((r) => r.data),
    supabase
      .from("exploration_guide_assignments")
      .select("guide_id")
      .eq("student_id", studentId)
      .then((r) => r.data),
    supabase
      .from("exploration_guide_sequels")
      .select("from_guide_id, to_guide_id, confidence")
      .in("to_guide_id", guideIdsArray)
      .gte("confidence", 0.4)
      .then((r) => r.data),
    supabase
      .from("student_record_topic_trajectories")
      .select("topic_cluster_id, evidence")
      .eq("student_id", studentId)
      .then((r) => r.data),
    majorRecommendedSubjectIds && majorRecommendedSubjectIds.size > 0
      ? supabase
          .from("exploration_guide_subject_mappings")
          .select("guide_id, subject_id")
          .in("guide_id", guideIdsArray)
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  // 12계열 매핑
  const lineageByGuide = new Map<string, Lineage12 | null>();
  for (const row of cfRows ?? []) {
    const r = row as {
      guide_id: string;
      exploration_guide_career_fields:
        | { name_kor: string }
        | { name_kor: string }[];
    };
    if (lineageByGuide.has(r.guide_id)) continue;
    const cf = Array.isArray(r.exploration_guide_career_fields)
      ? r.exploration_guide_career_fields[0]?.name_kor
      : r.exploration_guide_career_fields?.name_kor;
    if (!cf) continue;
    const possibleLineages = CAREER_FIELD_TO_LINEAGE_12[cf];
    if (possibleLineages && possibleLineages.length > 0) {
      lineageByGuide.set(r.guide_id, possibleLineages[0]);
    }
  }

  // 난이도 + 클러스터
  const difficultyByGuide = new Map<string, string | null>();
  const clusterByGuide = new Map<string, string | null>();
  for (const row of phaseARows ?? []) {
    difficultyByGuide.set(row.id, row.difficulty_level);
    clusterByGuide.set(row.id, row.topic_cluster_id);
  }

  // sequel: 이미 배정된 가이드의 후속
  const assignedIds = new Set((existingAssignments ?? []).map((a) => a.guide_id));
  const sequelTargets = new Set<string>();
  for (const s of sequelRows ?? []) {
    if (assignedIds.has(s.from_guide_id)) sequelTargets.add(s.to_guide_id);
  }

  // 전공 적합도
  const majorMatchGuides = new Set<string>();
  if (
    majorRecommendedSubjectIds &&
    majorRecommendedSubjectIds.size > 0 &&
    subjectMappingRows
  ) {
    for (const row of subjectMappingRows) {
      if (majorRecommendedSubjectIds.has(row.subject_id)) {
        majorMatchGuides.add(row.guide_id);
      }
    }
  }

  // 탐구한 클러스터
  const exploredClusters = new Set<string>();
  for (const t of trajectoryRows ?? []) {
    if (t.topic_cluster_id) exploredClusters.add(t.topic_cluster_id);
  }

  return {
    clubHistory,
    lineageByGuide,
    difficultyByGuide,
    clusterByGuide,
    sequelTargets,
    exploredClusters,
    majorMatchGuides,
    hyperedgeTokens,
    weakStageGuideTypes,
    storylineKeywords,
  };
}

/**
 * 스토리라인 키워드 4단 fallback:
 *  1) student_record_storylines.keywords
 *  2) storylines.title + grade_X_theme 토큰화
 *  3) student_main_explorations.tier_plan 3단 theme
 *  4) blueprint.targetConvergences (loader 동적 import)
 */
async function collectStorylineKeywords(
  supabase: Client,
  studentId: string,
  tenantId: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  const addToken = (raw: string | null | undefined) => {
    if (!raw) return;
    for (const tok of raw.split(/[\s·,·/()[\]{}"'`~!@#$%^&*+=|<>?]+/)) {
      const t = tok.trim().toLowerCase();
      if (t.length >= 2) out.add(t);
    }
  };

  const { data: storylineRows } = await supabase
    .from("student_record_storylines")
    .select("keywords, title, grade_1_theme, grade_2_theme, grade_3_theme")
    .eq("student_id", studentId);

  for (const row of storylineRows ?? []) {
    const kws = (row.keywords as string[] | null) ?? [];
    for (const kw of kws) {
      const t = kw?.trim();
      if (t && t.length >= 2) out.add(t.toLowerCase());
    }
  }

  if (out.size === 0 && (storylineRows?.length ?? 0) > 0) {
    for (const row of storylineRows ?? []) {
      addToken(row.title as string | null);
      addToken(row.grade_1_theme as string | null);
      addToken(row.grade_2_theme as string | null);
      addToken(row.grade_3_theme as string | null);
    }
  }

  if (out.size === 0) {
    const { data: tierRows } = await supabase
      .from("student_main_explorations")
      .select("tier_plan")
      .eq("student_id", studentId);
    for (const row of tierRows ?? []) {
      const tp = row.tier_plan as {
        foundational?: { theme?: string };
        development?: { theme?: string };
        advanced?: { theme?: string };
      } | null;
      if (!tp) continue;
      addToken(tp.foundational?.theme);
      addToken(tp.development?.theme);
      addToken(tp.advanced?.theme);
    }
  }

  if (out.size === 0) {
    try {
      const { loadBlueprintForStudent } = await import(
        "@/lib/domains/record-analysis/blueprint/loader"
      );
      const blueprint = await loadBlueprintForStudent(studentId, tenantId);
      if (blueprint) {
        for (const conv of blueprint.targetConvergences ?? []) {
          addToken(conv.themeLabel);
          for (const kw of conv.themeKeywords ?? []) addToken(kw);
        }
      }
    } catch {
      // best-effort
    }
  }

  return out;
}
