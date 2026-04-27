// ============================================
// phase-s2-guide-ranking.ts
//
// 가이드 랭킹 로직 분리 (Sub-task 2, 2026-04-26)
//
// applyContinuityRanking — 6개 보너스 + 클러스터 다양성 페널티
// computeDifficultyFit   — 학년↔난이도 적합도 (0.7~1.0)
// fetchClubHistory       — 동아리 활동 이력 조회
// insertAssignments      — 세특/창체 슬롯 배정 INSERT (D3 창체 auto-link 포함)
// RankedGuide            — 가이드 랭킹 인터페이스
// WEAK_STAGE_GUIDE_TYPE_MAP — narrative_arc 8단계 → guide_type 매핑
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import type { PipelineContext } from "../pipeline-types";
import {
  classifyClubByName,
  computeClubContinuityScore,
  type ClubHistoryEntry,
  type Lineage12,
} from "@/lib/domains/student-record/evaluation-criteria/club-lineage";
import { CAREER_FIELD_TO_LINEAGE_12 } from "@/lib/domains/student-record/evaluation-criteria/club-lineage";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

// ============================================
// 타입 + 상수
// ============================================

export interface RankedGuide {
  id: string;
  title: string;
  guide_type: string | null;
  match_reason: string;
  /** 기본 매칭 점수 (1: classification, 2: 2축, 3: 3축 모두) */
  baseScore: number;
  /** 12계열 연속성 점수 (0.5~1.0) */
  continuityScore: number;
  /** Phase A: 난이도 적합도 (0.7~1.0) */
  difficultyScore: number;
  /** Phase A: 사슬 보너스 (1.0 기본, 1.3 sequel) */
  sequelBonus: number;
  /** 전공 적합도 보너스 (1.0 기본, 1.2 전공 권장 과목 매칭) */
  majorBonus: number;
  /** P3: Layer 2 hyperedge 테마 부합 (1.0 기본, 1.15 일치) */
  hyperedgeBonus?: number;
  /** P3: Layer 3 narrative_arc 약한 단계 보강 (1.0 기본, 1.1 해당) */
  narrativeArcBonus?: number;
  /** 스토리라인 키워드 매칭 (1.0 기본, 1.2 매칭) — 관점별 필터링 */
  storylineBonus?: number;
  /** 격차 3: MidPlan focusHypothesis 키워드 매칭 (1.0 기본, 1.1 일치) */
  midPlanBonus?: number;
  /** 최종 가중치 점수 (모든 보너스 승수 곱) */
  finalScore: number;
}

/**
 * P3: narrative_arc 8단계 중 "약한 단계"를 보강 가능한 guide_type 매핑.
 * 휴리스틱(컨설턴트 직관 기반). 정확한 모델링은 향후 개선.
 */
export const WEAK_STAGE_GUIDE_TYPE_MAP: Record<string, string[]> = {
  "참고문헌": ["reading"],
  "탐구내용/이론": ["topic_exploration", "experiment"],
  "결론/제언": ["experiment", "topic_exploration"],
  "성장서사": ["career_exploration_project", "reflection_program"],
  "오류분석→재탐구": ["experiment"],
  "교사관찰": ["reflection_program"],
  "주제선정": ["topic_exploration", "career_exploration_project"],
};

// ============================================
// 배정 상한
// ============================================

export const MAX_GUIDES_PER_SLOT = 3;

// ============================================
// D4 helpers: 동아리 이력 조회
// ============================================

export async function fetchClubHistory(
  supabase: PipelineContext["supabase"],
  studentId: string,
  tenantId: string,
): Promise<ClubHistoryEntry[]> {
  const { data } = await supabase
    .from("student_record_changche")
    .select("grade, content, imported_content, confirmed_content, ai_draft_content, activity_type")
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

// ============================================
// D4: 12계열 연속성 ranking
// ============================================

export async function applyContinuityRanking(
  guides: Array<{ id: string; title: string; guide_type: string | null; match_reason: string }>,
  clubHistory: ClubHistoryEntry[],
  studentGrade: number,
  supabase: PipelineContext["supabase"],
  studentId: string,
  tenantIdForRanking: string,
  majorRecommendedSubjectIds?: Set<string>,
  /** 격차 3: MidPlan focusHypothesis 키워드 토큰 (caller 가 ctx.midPlan + belief.midPlanByGrade 에서 추출). 없으면 보너스 미적용. */
  midPlanFocusTokens?: Set<string>,
): Promise<RankedGuide[]> {
  if (guides.length === 0) return [];

  const guideIds = guides.map((g) => g.id);

  // P3: 학생 hyperedge 테마 + narrative_arc 약한 단계 사전 조회
  // PR 4 (2026-04-17): blueprint context 포함 — 상향식(analysis)과 하향식(blueprint) 수렴축을 모두
  //   랭킹 보너스에 반영. blueprint 하이퍼엣지는 gap_tracking 과 draft_generation 에서만 소비되던 것을
  //   guide_matching 수확 경로까지 확장.
  const [hyperedgeThemeRows, narrativeRowsP3] = await Promise.all([
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

  // hyperedge theme_label을 토큰화 (공백/중점 분리, 2자 이상만 유효)
  const hyperedgeTokens = new Set<string>();
  for (const row of hyperedgeThemeRows ?? []) {
    const label = (row.theme_label as string | null) ?? "";
    if (!label) continue;
    for (const tok of label.split(/[\s·,·/]+/)) {
      const t = tok.trim();
      if (t.length >= 2) hyperedgeTokens.add(t);
    }
  }

  // narrative_arc 약한 단계 → 우선 보강 가이드 타입 세트
  const weakStageGuideTypes = new Set<string>();
  if (narrativeRowsP3 && narrativeRowsP3.length > 0) {
    const total = narrativeRowsP3.length;
    const threshold = Math.max(1, Math.round(total * 0.5));
    const check = (key: keyof typeof narrativeRowsP3[number]): number =>
      narrativeRowsP3.filter((r) => r[key] === true).length;
    const stageCounts: Record<string, number> = {
      "지적호기심": check("curiosity_present"),
      "주제선정": check("topic_selection_present"),
      "탐구내용/이론": check("inquiry_content_present"),
      "참고문헌": check("references_present"),
      "결론/제언": check("conclusion_present"),
      "교사관찰": check("teacher_observation_present"),
      "성장서사": check("growth_narrative_present"),
      "오류분석→재탐구": check("reinquiry_present"),
    };
    for (const [stage, cnt] of Object.entries(stageCounts)) {
      if (cnt < threshold) {
        const types = WEAK_STAGE_GUIDE_TYPE_MAP[stage];
        if (types) for (const t of types) weakStageGuideTypes.add(t);
      }
    }
  }

  // 스토리라인 키워드 수집 (관점별 필터링용)
  // 1차: storylines.keywords.
  // 2차 fallback: storylines.title + grade_X_theme 토큰 추출 (keywords 비었을 때).
  // 3차 fallback: main_exploration.tier_plan 3단 theme (storylines 자체가 비었을 때).
  // 4차 fallback (PR 4, 2026-04-17): blueprint.targetConvergences.themeLabel/themeKeywords.
  //   메인 탐구 tier_plan 조차 없는 학생에게 top-down 설계 청사진을 매칭 신호로 사용.
  const { data: storylineRowsForBonus } = await supabase
    .from("student_record_storylines")
    .select("keywords, title, grade_1_theme, grade_2_theme, grade_3_theme")
    .eq("student_id", studentId);
  const storylineKeywords = new Set<string>();
  const addToken = (raw: string | null | undefined) => {
    if (!raw) return;
    for (const tok of raw.split(/[\s·,·/()[\]{}"'`~!@#$%^&*+=|<>?]+/)) {
      const t = tok.trim().toLowerCase();
      if (t.length >= 2) storylineKeywords.add(t);
    }
  };
  for (const row of storylineRowsForBonus ?? []) {
    const kws = (row.keywords as string[] | null) ?? [];
    for (const kw of kws) {
      const t = kw?.trim();
      if (t && t.length >= 2) storylineKeywords.add(t.toLowerCase());
    }
  }
  if (storylineKeywords.size === 0 && (storylineRowsForBonus?.length ?? 0) > 0) {
    for (const row of storylineRowsForBonus ?? []) {
      addToken(row.title as string | null);
      addToken(row.grade_1_theme as string | null);
      addToken(row.grade_2_theme as string | null);
      addToken(row.grade_3_theme as string | null);
    }
  }
  if (storylineKeywords.size === 0) {
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
  if (storylineKeywords.size === 0) {
    const { loadBlueprintForStudent } = await import(
      "@/lib/domains/record-analysis/blueprint/loader"
    );
    const blueprint = await loadBlueprintForStudent(studentId, tenantIdForRanking);
    if (blueprint) {
      for (const conv of blueprint.targetConvergences ?? []) {
        addToken(conv.themeLabel);
        for (const kw of conv.themeKeywords ?? []) addToken(kw);
      }
    }
  }

  // ── 병렬 메타데이터 조회: 12계열 + Phase A (난이도/클러스터/사슬) ──
  const [cfRows, phaseARows, existingAssignments, sequelRows, trajectoryRows, subjectMappingRows] = await Promise.all([
    // (1) career_field_mappings → 12계열
    supabase
      .from("exploration_guide_career_mappings")
      .select("guide_id, exploration_guide_career_fields!inner(name_kor)")
      .in("guide_id", guideIds)
      .then((r) => r.data),
    // (2) Phase A: 난이도 + 클러스터
    supabase
      .from("exploration_guides")
      .select("id, difficulty_level, topic_cluster_id")
      .in("id", guideIds)
      .then((r) => r.data),
    // (3) 이미 배정된 가이드 (sequel 보너스용)
    supabase
      .from("exploration_guide_assignments")
      .select("guide_id")
      .eq("student_id", studentId)
      .then((r) => r.data),
    // (4) Phase A: 후보 가이드의 sequel 관계 (이미 배정된 가이드 → 후보)
    supabase
      .from("exploration_guide_sequels")
      .select("from_guide_id, to_guide_id, confidence")
      .in("to_guide_id", guideIds)
      .gte("confidence", 0.4)
      .then((r) => r.data),
    // (5) Wave 4: 학생 궤적 (완료한 클러스터/난이도 기록)
    supabase
      .from("student_record_topic_trajectories")
      .select("topic_cluster_id, evidence")
      .eq("student_id", studentId)
      .then((r) => r.data),
    // (6) 전공 적합도: 가이드별 subject_id
    majorRecommendedSubjectIds && majorRecommendedSubjectIds.size > 0
      ? supabase
          .from("exploration_guide_subject_mappings")
          .select("guide_id, subject_id")
          .in("guide_id", guideIds)
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  // 12계열 매핑
  const lineageByGuide = new Map<string, Lineage12 | null>();
  for (const row of cfRows ?? []) {
    const r = row as {
      guide_id: string;
      exploration_guide_career_fields: { name_kor: string } | { name_kor: string }[];
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

  // Phase A: 난이도 + 클러스터 맵
  const difficultyByGuide = new Map<string, string | null>();
  const clusterByGuide = new Map<string, string | null>();
  for (const row of phaseARows ?? []) {
    difficultyByGuide.set(row.id, row.difficulty_level);
    clusterByGuide.set(row.id, row.topic_cluster_id);
  }

  // Phase A: sequel 보너스 — 이미 배정된 가이드의 sequel이면 보너스
  const assignedIds = new Set((existingAssignments ?? []).map((a) => a.guide_id));
  const sequelTargets = new Set<string>();
  for (const s of sequelRows ?? []) {
    if (assignedIds.has(s.from_guide_id)) {
      sequelTargets.add(s.to_guide_id);
    }
  }

  // 전공 적합도: 가이드별 전공 권장 과목 매칭 여부
  const majorMatchGuides = new Set<string>();
  if (majorRecommendedSubjectIds && majorRecommendedSubjectIds.size > 0 && subjectMappingRows) {
    for (const row of subjectMappingRows) {
      if (majorRecommendedSubjectIds.has(row.subject_id)) {
        majorMatchGuides.add(row.guide_id);
      }
    }
  }

  // Wave 4: 궤적에서 이미 탐구한 클러스터 → sequel 보너스 강화
  const exploredClusters = new Set<string>();
  for (const t of trajectoryRows ?? []) {
    if (t.topic_cluster_id) exploredClusters.add(t.topic_cluster_id);
  }

  // ── 점수 계산 ──
  const ranked: RankedGuide[] = guides.map((g) => {
    const lineage = lineageByGuide.get(g.id) ?? null;

    // baseScore: match_reason 매치 강도
    const baseScore =
      g.match_reason === "all"
        ? 3
        : g.match_reason === "both" ||
            g.match_reason === "classification+activity" ||
            g.match_reason === "subject+activity"
          ? 2
          : 1;

    // 12계열 연속성 점수
    const continuityScore = computeClubContinuityScore(clubHistory, lineage, studentGrade);

    // Phase A: 난이도 적합도 (학년↔난이도 매치)
    const difficulty = difficultyByGuide.get(g.id);
    const difficultyScore = computeDifficultyFit(studentGrade, difficulty);

    // Phase A: 사슬 보너스
    // 1.0 기본 → 1.3 sequel(배정 기반) → 1.5 sequel+궤적(실제 탐구 이력)
    const isSequel = sequelTargets.has(g.id);
    const clusterId = clusterByGuide.get(g.id);
    const hasTrajectory = clusterId ? exploredClusters.has(clusterId) : false;
    const sequelBonus = isSequel && hasTrajectory ? 1.5 : isSequel ? 1.3 : 1.0;

    // 전공 적합도 보너스: 전공 권장 과목에 매핑된 가이드 → 1.2×
    const majorBonus = majorMatchGuides.has(g.id) ? 1.2 : 1.0;

    // P3: Layer 2 hyperedge 테마 부합 — 가이드 title에 학생 수렴축 토큰이 포함되면 1.15×
    let hyperedgeBonus = 1.0;
    if (hyperedgeTokens.size > 0) {
      const titleLower = g.title.toLowerCase();
      for (const tok of hyperedgeTokens) {
        if (titleLower.includes(tok.toLowerCase())) {
          hyperedgeBonus = 1.15;
          break;
        }
      }
    }

    // P3: Layer 3 narrative_arc 약한 단계 보강 — guide_type이 약한 단계에 매핑되면 1.1×
    const narrativeArcBonus =
      g.guide_type && weakStageGuideTypes.has(g.guide_type) ? 1.1 : 1.0;

    // 스토리라인 키워드 매칭 — 관점별 필터링 (설계 서사 부합도)
    let storylineBonus = 1.0;
    if (storylineKeywords.size > 0) {
      const titleLower = g.title.toLowerCase();
      for (const kw of storylineKeywords) {
        if (titleLower.includes(kw)) {
          storylineBonus = 1.2;
          break;
        }
      }
    }

    // 격차 3: MidPlan focusHypothesis 토큰 매칭 (가이드 title 에 가설 키워드 포함 시 1.1×)
    let midPlanBonus = 1.0;
    if (midPlanFocusTokens && midPlanFocusTokens.size > 0) {
      const titleLower = g.title.toLowerCase();
      for (const tok of midPlanFocusTokens) {
        if (titleLower.includes(tok)) {
          midPlanBonus = 1.1;
          break;
        }
      }
    }

    return {
      id: g.id,
      title: g.title,
      guide_type: g.guide_type,
      match_reason: g.match_reason,
      baseScore,
      continuityScore,
      difficultyScore,
      sequelBonus,
      majorBonus,
      hyperedgeBonus,
      narrativeArcBonus,
      storylineBonus,
      midPlanBonus,
      finalScore:
        baseScore *
        continuityScore *
        difficultyScore *
        sequelBonus *
        majorBonus *
        hyperedgeBonus *
        narrativeArcBonus *
        storylineBonus *
        midPlanBonus,
    };
  });

  // ── Phase A: 클러스터 다양성 페널티 ──
  // 같은 클러스터에서 3개 초과 시 4번째부터 0.7배 감점
  ranked.sort((a, b) => b.finalScore - a.finalScore);
  const clusterCount = new Map<string, number>();
  for (const g of ranked) {
    const cid = clusterByGuide.get(g.id);
    if (!cid) continue;
    const count = (clusterCount.get(cid) ?? 0) + 1;
    clusterCount.set(cid, count);
    if (count > 3) {
      g.finalScore *= 0.7;
    }
  }

  // 최종 정렬
  ranked.sort((a, b) => b.finalScore - a.finalScore);
  return ranked;
}

// ============================================
// Phase A helper: 난이도↔학년 적합도
// ============================================

/** 학년에 맞는 난이도일수록 높은 점수 (0.7~1.0) */
export function computeDifficultyFit(studentGrade: number, difficulty: string | null | undefined): number {
  if (!difficulty) return 0.85; // 난이도 미분류 → 약간 감점
  // 학년별 이상적 난이도: 1학년=basic, 2학년=intermediate, 3학년=advanced
  const idealMap: Record<number, string> = { 1: "basic", 2: "intermediate", 3: "advanced" };
  const ideal = idealMap[studentGrade] ?? "intermediate";
  if (difficulty === ideal) return 1.0; // 정확히 매치
  // 1단계 차이 (basic↔intermediate, intermediate↔advanced)
  const levels = ["basic", "intermediate", "advanced"];
  const diff = Math.abs(levels.indexOf(difficulty) - levels.indexOf(ideal));
  if (diff === 1) return 0.85; // 인접
  return 0.7; // 2단계 차이 (basic↔advanced)
}

// ============================================
// 배정 INSERT (D3 창체 slot auto-link 포함)
// ============================================

export async function insertAssignments(
  ctx: PipelineContext,
  ranked: RankedGuide[],
): Promise<{ count: number; skippedOrphan: number; skippedOrphanGuides: Array<{ id: string; title: string }>; skippedSlotOverflow: number }> {
  const { supabase, studentId, tenantId, studentGrade } = ctx;

  // 이미 배정된 가이드 제외
  const { data: existing } = await supabase
    .from("exploration_guide_assignments")
    .select("guide_id, target_subject_id, target_activity_type")
    .eq("student_id", studentId);
  const existingIds = new Set((existing ?? []).map((a) => a.guide_id));
  // 기존 배정의 slot별 카운트 (재실행/누적 방지)
  const existingSlotCounts = new Map<string, number>();
  for (const row of existing ?? []) {
    const key = row.target_activity_type
      ? `activity:${row.target_activity_type}`
      : row.target_subject_id
        ? `subject:${row.target_subject_id}`
        : null;
    if (key) existingSlotCounts.set(key, (existingSlotCounts.get(key) ?? 0) + 1);
  }
  const newGuides = ranked.filter((g) => !existingIds.has(g.id));
  if (newGuides.length === 0) return { count: 0, skippedOrphan: 0, skippedOrphanGuides: [], skippedSlotOverflow: 0 };

  const currentSchoolYear = calculateSchoolYear();

  // Wave 5.1f: 설계 학년(consultingGrades) seteks 만 auto-link 대상.
  //   분석 학년(NEIS 확정) seteks 에는 가이드를 link 하지 않는다 — 탐구 가이드는
  //   "앞으로의 탐구" 안내이므로 이미 기록 확정된 학년엔 무의미.
  const consultingGradesSet = new Set(ctx.consultingGrades ?? []);

  // Phase 2 Wave 5.1d: 학생 실제 과목 풀 수집 → area-resolver 에 preferred 로 주입.
  // Phase 2 Wave 5.1f: 설계 학년(consultingGrades) 로 제한 — 탐구 가이드는
  //   설계 학년에만 의미가 있으므로 분석 학년 seteks/plans 는 풀에서 제외.
  const { resolveGuideTargetArea, collectStudentSubjectPool } = await import(
    "@/lib/domains/guide/actions/area-resolver"
  );
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const adminForAreaResolver = createSupabaseAdminClient();
  if (!adminForAreaResolver) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정: area-resolver admin client 생성 불가");
  }
  const studentSubjectPool = await collectStudentSubjectPool(studentId, {
    gradeFilter: consultingGradesSet.size > 0 ? consultingGradesSet : undefined,
  });
  // P3 라스트마일: 셸 가이드(status=queued_generation)의 subject_mappings 를 RLS 우회로 read.
  const areaMap = await resolveGuideTargetArea(
    newGuides.map((g) => g.id),
    { preferredSubjectIds: studentSubjectPool, adminClient: adminForAreaResolver },
  );

  // 세특 슬롯 조회 (subject_id 기반 auto-link) — 설계 학년만
  const { data: existingSeteks } = await supabase
    .from("student_record_seteks")
    .select("id, subject_id, school_year, grade")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);
  interface SetekSlot {
    id: string;
    schoolYear: number;
    grade: number;
  }
  const setekBySubject = new Map<string, SetekSlot>();
  for (const s of existingSeteks ?? []) {
    if (!consultingGradesSet.has(s.grade)) continue; // 설계 학년만
    const existing = setekBySubject.get(s.subject_id);
    if (!existing || (s.school_year ?? 0) > existing.schoolYear) {
      setekBySubject.set(s.subject_id, {
        id: s.id,
        schoolYear: s.school_year ?? currentSchoolYear,
        grade: s.grade ?? studentGrade,
      });
    }
  }

  // 창체 슬롯 조회 (activity_type 기반 auto-link — D3 신규)
  // 창체는 studentGrade(현재 학년) 기준으로만 — 이미 설계 학년 제약.
  const { data: existingChangche } = await supabase
    .from("student_record_changche")
    .select("id, activity_type, grade, school_year")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("grade", studentGrade);
  interface ChangcheSlot {
    id: string;
    schoolYear: number;
  }
  const changcheByActivity = new Map<string, ChangcheSlot>();
  for (const c of existingChangche ?? []) {
    if (!changcheByActivity.has(c.activity_type)) {
      changcheByActivity.set(c.activity_type, {
        id: c.id,
        schoolYear: c.school_year ?? currentSchoolYear,
      });
    }
  }

  // P4: 추천 시점 어느 스토리라인 키워드와 매칭됐는지 박제용 사전 조회.
  //     가이드 title을 토큰화해 각 storyline.keywords 와의 겹침이 가장 많은 것을 선택.
  const { data: storylineRows } = await supabase
    .from("student_record_storylines")
    .select("id, keywords")
    .eq("student_id", studentId);
  const storylineKwIndex: { id: string; keywords: string[] }[] =
    (storylineRows ?? []).map((s) => ({
      id: s.id as string,
      keywords: ((s.keywords as string[]) ?? []).filter((k) => k && k.length >= 2),
    }));

  function pickStorylineIdForGuide(guideTitle: string): string | null {
    if (storylineKwIndex.length === 0) return null;
    const titleLower = guideTitle.toLowerCase();
    let bestId: string | null = null;
    let bestOverlap = 0;
    for (const sl of storylineKwIndex) {
      let overlap = 0;
      for (const kw of sl.keywords) {
        if (titleLower.includes(kw.toLowerCase())) overlap++;
      }
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestId = sl.id;
      }
    }
    return bestOverlap > 0 ? bestId : null;
  }

  // Phase 2 Wave 5.1d: orphan 배정 skip + school_year 를 linked 레코드 기반으로 저장
  let skippedOrphan = 0;
  let skippedSlotOverflow = 0;
  const skippedOrphanGuides: Array<{ id: string; title: string }> = [];
  // slot별 배정 카운트 (세션 내 + 기존 배정 누적). MAX_GUIDES_PER_SLOT 초과 시 skip.
  const slotCounts = new Map<string, number>(existingSlotCounts);
  const insertRows: Array<{
    tenant_id: string;
    student_id: string;
    guide_id: string;
    assigned_by: null;
    school_year: number;
    grade: number;
    status: string;
    student_notes: string;
    target_subject_id: string | null;
    target_activity_type: string | null;
    linked_record_type: "setek" | "changche" | null;
    linked_record_id: string | null;
    ai_recommendation_reason: string;
    storyline_id: string | null;
  }> = [];

  for (const g of newGuides) {
    const area = areaMap.get(g.id);
    const targetSubjectId = area?.targetSubjectId ?? null;
    const targetActivityType = area?.targetActivityType ?? null;

    // 세특도 창체도 아닌 가이드(= 둘 다 null) → skip.
    // 세특 가이드인데 학생 실제 과목 풀과 매칭 안 됨 → targetSubjectId === null → skip.
    if (!targetSubjectId && !targetActivityType) {
      skippedOrphan++;
      skippedOrphanGuides.push({ id: g.id, title: g.title });
      continue;
    }

    // Slot별 상한 체크 (finalScore 내림차순 전제 — 상위 가이드가 slot을 먼저 차지)
    const slotKey = targetActivityType
      ? `activity:${targetActivityType}`
      : `subject:${targetSubjectId}`;
    const currentCount = slotCounts.get(slotKey) ?? 0;
    if (currentCount >= MAX_GUIDES_PER_SLOT) {
      skippedSlotOverflow++;
      continue;
    }
    slotCounts.set(slotKey, currentCount + 1);

    // D3: 창체는 changche 슬롯에, 세특은 setek 슬롯에 link
    let linkedRecordType: "setek" | "changche" | null = null;
    let linkedRecordId: string | null = null;
    let rowSchoolYear = currentSchoolYear;
    let rowGrade = studentGrade;

    if (targetActivityType) {
      const slot = changcheByActivity.get(targetActivityType);
      if (slot) {
        linkedRecordType = "changche";
        linkedRecordId = slot.id;
        rowSchoolYear = slot.schoolYear;
      }
    } else if (targetSubjectId) {
      const slot = setekBySubject.get(targetSubjectId);
      if (slot) {
        linkedRecordType = "setek";
        linkedRecordId = slot.id;
        // 버그 1 수정: linked 세특의 학년도/학년을 사용 (그전엔 currentSchoolYear 로 덮어썼음)
        rowSchoolYear = slot.schoolYear;
        rowGrade = slot.grade;
      }
      // linked 세특 없음 (설계 학년 planned subject) → school_year 는 currentSchoolYear 유지
    }

    insertRows.push({
      tenant_id: tenantId,
      student_id: studentId,
      guide_id: g.id,
      assigned_by: null,
      school_year: rowSchoolYear,
      grade: rowGrade,
      status: "assigned",
      student_notes: `[AI] 파이프라인 자동 배정 (${g.match_reason}, sim=${g.finalScore.toFixed(2)})`,
      target_subject_id: targetSubjectId,
      target_activity_type: targetActivityType,
      linked_record_type: linkedRecordType,
      linked_record_id: linkedRecordId,
      ai_recommendation_reason: g.match_reason,
      storyline_id: pickStorylineIdForGuide(g.title),
    });
  }

  if (insertRows.length === 0) {
    logActionDebug(
      LOG_CTX,
      `insertAssignments: insert할 배정 없음 (candidates=${newGuides.length}, skippedOrphan=${skippedOrphan}, skippedSlotOverflow=${skippedSlotOverflow})`,
      { studentId },
    );
    return { count: 0, skippedOrphan, skippedOrphanGuides, skippedSlotOverflow };
  }

  const { error: insertErr, count } = await supabase
    .from("exploration_guide_assignments")
    .insert(insertRows, { count: "exact" });

  if (insertErr) {
    logActionError(LOG_CTX, insertErr, { studentId, attempted: insertRows.length });
    return { count: 0, skippedOrphan, skippedOrphanGuides, skippedSlotOverflow };
  }
  logActionDebug(
    LOG_CTX,
    `insertAssignments: ${count ?? insertRows.length}건 배정 완료 (세특 ${insertRows.filter((r) => r.linked_record_type === "setek").length} / 창체 ${insertRows.filter((r) => r.linked_record_type === "changche").length} / 미연결 ${insertRows.filter((r) => !r.linked_record_type).length}, orphan skip ${skippedOrphan}, slot overflow skip ${skippedSlotOverflow})`,
  );

  // Phase A: 학생 궤적 자동 기록 (fire-and-forget)
  upsertTopicTrajectories(supabase, tenantId, studentId, insertRows.map((r) => r.guide_id), studentGrade).catch(() => {});

  return { count: count ?? insertRows.length, skippedOrphan, skippedOrphanGuides, skippedSlotOverflow };
}

/** Phase A: 배정된 가이드들의 궤적을 일괄 UPSERT */
async function upsertTopicTrajectories(
  supabase: PipelineContext["supabase"],
  tenantId: string,
  studentId: string,
  guideIds: string[],
  grade: number,
): Promise<void> {
  if (guideIds.length === 0) return;

  const { normalizeConfidence } = await import("@/lib/domains/guide/confidence");

  const { data: guides } = await supabase
    .from("exploration_guides")
    .select("id, topic_cluster_id, difficulty_level, title")
    .in("id", guideIds);

  const rows = (guides ?? [])
    .filter((g) => g.topic_cluster_id)
    .map((g) => ({
      tenant_id: tenantId,
      student_id: studentId,
      topic_cluster_id: g.topic_cluster_id!,
      grade,
      source: "auto_from_pipeline" as const,
      confidence: normalizeConfidence(0.8, "auto_from_pipeline"),
      evidence: {
        guide_id: g.id,
        difficulty_level: g.difficulty_level,
        title: g.title,
        assigned_at: new Date().toISOString(),
      },
    }));

  if (rows.length === 0) return;

  await supabase
    .from("student_record_topic_trajectories")
    .upsert(rows, { onConflict: "student_id,grade,topic_cluster_id" });
}
