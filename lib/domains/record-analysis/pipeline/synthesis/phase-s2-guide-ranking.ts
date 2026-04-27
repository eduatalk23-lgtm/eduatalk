// ============================================
// phase-s2-guide-ranking.ts
//
// 가이드 랭킹의 DB 어댑터 + 사이드 이펙트 (Sub-task 2, 2026-04-26).
// M1-a (2026-04-27): 산식 자체는 `lib/domains/guide/capability/ranking.ts` 로 이전.
//   본 파일은 DB 메타 사전 조회 + capability 호출 + 어셈블리/INSERT 만 담당.
//
// applyContinuityRanking — DB 조회 후 capability(computeGuideRanking) 위임
// fetchClubHistory       — 동아리 활동 이력 조회
// insertAssignments      — 세특/창체 슬롯 배정 INSERT (D3 창체 auto-link 포함)
//
// RankedGuide / WEAK_STAGE_GUIDE_TYPE_MAP / computeDifficultyFit 는
// capability 모듈에서 import 후 re-export (기존 호출자 호환).
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import type { PipelineContext } from "../pipeline-types";
import type { ClubHistoryEntry } from "@/lib/domains/student-record/evaluation-criteria/club-lineage";
import {
  computeGuideRanking,
  WEAK_STAGE_GUIDE_TYPE_MAP,
  computeDifficultyFit,
  type RankedGuide,
} from "@/lib/domains/guide/capability/ranking";
import {
  loadGuideRankingMetadata,
  fetchClubHistory as fetchClubHistoryShared,
} from "@/lib/domains/guide/capability/ranking-metadata";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

// ============================================
// re-export (M1-a 하위 호환)
// ============================================

export { WEAK_STAGE_GUIDE_TYPE_MAP, computeDifficultyFit };
export type { RankedGuide };

// ============================================
// 배정 상한
// ============================================

export const MAX_GUIDES_PER_SLOT = 3;

// ============================================
// D4 helpers: 동아리 이력 조회 (capability 위임 + 하위 호환 export)
// ============================================

export async function fetchClubHistory(
  supabase: PipelineContext["supabase"],
  studentId: string,
  tenantId: string,
): Promise<ClubHistoryEntry[]> {
  return fetchClubHistoryShared(supabase, studentId, tenantId);
}

// ============================================
// D4: 12계열 연속성 ranking — metadata 로드 + capability 호출
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

  const metadata = await loadGuideRankingMetadata(
    supabase,
    {
      studentId,
      tenantId: tenantIdForRanking,
      guideIds: guides.map((g) => g.id),
    },
    { majorRecommendedSubjectIds },
  );

  // pipeline 호출자가 이미 fetch 한 clubHistory 를 우선 사용 (재조회 회피).
  return computeGuideRanking({
    guides,
    studentGrade,
    clubHistory: clubHistory.length > 0 ? clubHistory : metadata.clubHistory,
    lineageByGuide: metadata.lineageByGuide,
    difficultyByGuide: metadata.difficultyByGuide,
    clusterByGuide: metadata.clusterByGuide,
    sequelTargets: metadata.sequelTargets,
    exploredClusters: metadata.exploredClusters,
    majorMatchGuides: metadata.majorMatchGuides,
    hyperedgeTokens: metadata.hyperedgeTokens,
    weakStageGuideTypes: metadata.weakStageGuideTypes,
    storylineKeywords: metadata.storylineKeywords,
    midPlanFocusTokens,
  });
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
