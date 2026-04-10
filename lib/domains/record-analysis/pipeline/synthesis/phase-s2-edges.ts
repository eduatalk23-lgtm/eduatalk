// ============================================
// S2: runEdgeComputation + runGuideMatching
//
// Phase 2 Wave 4 (D1+D2+D3+D4+D7) — runGuideMatching 대수술:
//   D2: course plan refresh 선호출 (Phase 순서 버그 fix)
//   D1: 3단계 폭포수 (풀 매칭 → 활성 풀 보강 → 조건부 AI 생성)
//   D3: 창체 slot auto-link 분기 (setek + changche)
//   D4: 12계열 연속성 점수 weighted ranking
//   D7: 0건 결과 시 explicit 메시지 (idempotency 재고)
// ============================================

import { logActionDebug, logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
  type ScoreRowWithSubject,
} from "../pipeline-types";
import type { PersistedEdge } from "@/lib/domains/student-record/repository/edge-repository";
import type { CrossRefEdge } from "@/lib/domains/student-record/cross-reference";
import * as competencyRepo from "@/lib/domains/student-record/repository/competency-repository";
import type { CourseAdequacyResult } from "@/lib/domains/student-record/types";
import {
  classifyClubByName,
  computeClubContinuityScore,
  type ClubHistoryEntry,
  type Lineage12,
} from "@/lib/domains/student-record/evaluation-criteria/club-lineage";
import { CAREER_FIELD_TO_LINEAGE_12 } from "@/lib/domains/student-record/evaluation-criteria/club-lineage";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

// ============================================
// 3. 엣지 계산
// ============================================

export async function runEdgeComputation(ctx: PipelineContext): Promise<TaskRunnerOutput & { computedEdges?: PersistedEdge[] | CrossRefEdge[]; sharedCourseAdequacy?: CourseAdequacyResult | null }> {
  assertSynthesisCtx(ctx);
  const { supabase, studentId, tenantId, pipelineId, studentGrade, snapshot } = ctx;

  // NEIS 레코드도 없고 설계 학년 가이드도 없으면 연결 계산 대상 없음 — skip
  const hasDesignData = ctx.unifiedInput?.hasAnyDesign &&
    Object.values(ctx.unifiedInput.grades).some((g) => g.mode === "design" && g.directionGuides.length > 0);
  if ((!ctx.neisGrades || ctx.neisGrades.length === 0) && !hasDesignData) {
    return "NEIS 기록 없음 — 기록 임포트 후 연결 분석 가능";
  }
  const { buildConnectionGraph } = await import("@/lib/domains/student-record/cross-reference");
  const { fetchCrossRefData } = await import("@/lib/domains/student-record/actions/cross-ref-data-builder");
  const edgeRepo = await import("@/lib/domains/student-record/repository/edge-repository");
  const { computeContentHash } = await import("@/lib/domains/student-record/content-hash");

  const { calculateCourseAdequacy } = await import("@/lib/domains/student-record/course-adequacy");

  const [allTags, crd] = await Promise.all([
    competencyRepo.findActivityTags(studentId, tenantId, { excludeTagContext: "draft_analysis" }),
    fetchCrossRefData(studentId, tenantId),
  ]);

  // F2: courseAdequacy 실제 계산 (COURSE_SUPPORTS 엣지 감지용)
  const targetMajor = (snapshot?.target_major as string) ?? null;
  let courseAdequacy: CourseAdequacyResult | null = null;
  if (targetMajor) {
    const { data: scoreRows } = await supabase
      .from("student_internal_scores")
      .select("subject:subject_id(name)")
      .eq("student_id", studentId)
      .returns<ScoreRowWithSubject[]>();
    const takenSubjects = [...new Set(
      (scoreRows ?? [])
        .map((s) => s.subject?.name)
        .filter((n): n is string => !!n),
    )];

    let offeredSubjects: string[] | null = null;
    const schoolName = (snapshot?.school_name as string) ?? null;
    if (schoolName) {
      const { data: profile } = await supabase
        .from("school_profiles")
        .select("id")
        .eq("school_name", schoolName)
        .maybeSingle();
      if (profile) {
        const { data: offered } = await supabase
          .from("school_offered_subjects")
          .select("subject:subject_id(name)")
          .eq("school_profile_id", profile.id);
        offeredSubjects = (offered ?? [])
          .map((o) => (o.subject as { name: string } | null)?.name)
          .filter((n): n is string => !!n);
      }
    }

    const { getCurriculumYear } = await import("@/lib/utils/schoolYear");
    const enrollmentYear = calculateSchoolYear() - studentGrade + 1;
    const curriculumYear = getCurriculumYear(enrollmentYear);
    courseAdequacy = calculateCourseAdequacy(targetMajor, takenSubjects, offeredSubjects, curriculumYear);
  }

  const graph = buildConnectionGraph({
    allTags,
    storylineLinks: crd.storylineLinks,
    readingLinks: crd.readingLinks,
    courseAdequacy,
    recordLabelMap: new Map(Object.entries(crd.recordLabelMap)),
    readingLabelMap: new Map(Object.entries(crd.readingLabelMap)),
    recordContentMap: crd.recordContentMap
      ? new Map(Object.entries(crd.recordContentMap))
      : undefined,
  });

  // DB 영속화
  const edgeCount = await edgeRepo.replaceEdges(studentId, tenantId, pipelineId, graph, "analysis");
  await edgeRepo.saveSnapshot(studentId, pipelineId, graph);

  // content_hash 저장 — stale-detection.ts의 checkPipelineStaleness와 동일한 범위 사용
  // (tenant 기준 전체 레코드 — recordLabelMap 필터 제거하여 false-positive stale 방지)
  const [sResAll, cResAll, hResAll] = await Promise.all([
    supabase
      .from("student_record_seteks")
      .select("id, updated_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("student_record_changche")
      .select("id, updated_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
    supabase
      .from("student_record_haengteuk")
      .select("id, updated_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
  ]);
  const allRecords = [
    ...(sResAll.data ?? []),
    ...(cResAll.data ?? []),
    ...(hResAll.data ?? []),
  ].map((r) => ({ id: r.id, updated_at: r.updated_at ?? null }));
  const hash = computeContentHash(allRecords);
  const { error: hashErr } = await supabase
    .from("student_record_analysis_pipelines")
    .update({ content_hash: hash })
    .eq("id", pipelineId);
  if (hashErr) logActionError({ domain: "record-analysis", action: "phase-s2-edges" }, hashErr, { pipelineId });

  // Phase E2: 후속 태스크용 엣지 배열
  const computedEdges = graph.nodes.flatMap((n) => n.edges) as PersistedEdge[] | CrossRefEdge[];

  const preview = `${edgeCount}개 엣지 감지 (${graph.nodes.length}개 영역)`;
  return { preview, result: { totalEdges: graph.totalEdges, nodeCount: graph.nodes.length }, computedEdges, sharedCourseAdequacy: courseAdequacy };
}

// ============================================
// 6. 가이드 매칭 + 배정 (Phase 2 Wave 4 재작성)
// ============================================

interface RankedGuide {
  id: string;
  title: string;
  guide_type: string | null;
  match_reason: string;
  /** 기본 매칭 점수 (1: classification, 2: 2축, 3: 3축 모두) */
  baseScore: number;
  /** 12계열 연속성 점수 (0.5~1.0) */
  continuityScore: number;
  /** 최종 가중치 점수 = baseScore × continuityScore */
  finalScore: number;
}

const MIN_GUIDES_FOR_AI_TRIGGER = 3; // Decision #2 Q2-1: 매칭이 3건 미만일 때만 AI 생성
const ENABLE_AI_GENERATION = process.env.PHASE2_AI_GUIDE_GENERATION === "1"; // D6 feature flag

export async function runGuideMatching(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { supabase, studentId, tenantId, studentGrade, snapshot } = ctx;

  // ── D2: course plan 보장 (Phase 순서 버그 fix) ──
  // synthesis pipeline은 phase별 별도 HTTP 요청이라, 이 task가 호출될 때 ctx.coursePlanData가
  // 없거나 stale일 수 있음. course_recommendation이 아직 안 돈 fresh 학생이면 빈 배열.
  // → 명시적으로 DB에서 다시 읽어 항상 최신 상태 보장.
  await refreshCoursePlanData(ctx);

  const classificationId = (snapshot?.target_sub_classification_id as number | null) ?? null;
  const targetMajorClassificationField = snapshot?.desired_career_field as string | null | undefined;

  const { autoRecommendGuidesAction } = await import("@/lib/domains/guide/actions/auto-recommend");

  // ── 풀 후보 수집 ──
  type RecommendedGuide = { id: string; title: string; guide_type: string | null; match_reason: string };
  const guideMap = new Map<string, RecommendedGuide>();

  // (1) classification 단독 매칭
  const classResult = await autoRecommendGuidesAction({ studentId, classificationId, limit: 10 });
  if (classResult.success && Array.isArray(classResult.data)) {
    for (const g of classResult.data) guideMap.set(g.id, g);
  }

  // (2) 수강계획 과목 매칭 (세특용)
  const plannedNames = collectPlannedSubjectNames(ctx);
  for (const subjectName of plannedNames.slice(0, 5)) {
    const subjectResult = await autoRecommendGuidesAction({
      studentId,
      classificationId,
      subjectName,
      limit: 5,
    });
    if (subjectResult.success && Array.isArray(subjectResult.data)) {
      for (const g of subjectResult.data) {
        const existing = guideMap.get(g.id);
        if (!existing || g.match_reason === "both" || g.match_reason === "all") {
          guideMap.set(g.id, g);
        }
      }
    }
  }

  // (3) activity_type 매칭 (창체용 — Wave 3.2 신규)
  for (const activityType of ["autonomy", "club", "career"] as const) {
    const activityResult = await autoRecommendGuidesAction({
      studentId,
      classificationId,
      activityType,
      limit: 5,
    });
    if (activityResult.success && Array.isArray(activityResult.data)) {
      for (const g of activityResult.data) {
        if (!guideMap.has(g.id)) guideMap.set(g.id, g);
      }
    }
  }

  // ── D4: 12계열 연속성 ranking ──
  const clubHistory = await fetchClubHistory(supabase, studentId, tenantId);
  const ranked = await applyContinuityRanking(
    [...guideMap.values()],
    clubHistory,
    studentGrade,
    supabase,
  );

  // ── D6: 조건부 AI 생성 (옵션, feature flag) ──
  // Decision #2 Q2-1: 설계 학년 + storyline 존재 + 매칭 < N건일 때만
  if (ENABLE_AI_GENERATION && shouldTriggerAiGeneration(ctx, ranked.length)) {
    try {
      const aiGuides = await triggerAiGuideGeneration(ctx);
      for (const g of aiGuides) {
        if (!guideMap.has(g.id)) {
          ranked.push(g);
        }
      }
    } catch (err) {
      // AI 생성 실패는 치명적이지 않음 — 기존 풀 결과로 진행
      logActionWarn(
        LOG_CTX,
        `AI 가이드 생성 실패 (fallback to pool only): ${err instanceof Error ? err.message : String(err)}`,
        { studentId },
      );
    }
  }

  // ── 배정 INSERT ──
  let assigned = 0;
  if (ranked.length > 0) {
    assigned = await insertAssignments(ctx, ranked);
  }

  // ── D7: 결과 메시지 ──
  const aiHint = ENABLE_AI_GENERATION ? "" : "";
  const continuityHint = clubHistory.length > 0
    ? ` / ${clubHistory.length}건 동아리 이력 반영`
    : "";

  void targetMajorClassificationField; // unused — 추후 확장용
  return `${assigned}건 가이드 배정 (${ranked.length}건 후보${continuityHint})${aiHint}`;
}

// ============================================
// D2 helper: course plan refresh
// ============================================

async function refreshCoursePlanData(ctx: PipelineContext): Promise<void> {
  const { data: refreshedPlans, error } = await ctx.supabase
    .from("student_course_plans")
    .select(
      `*, subject:subject_id ( id, name, subject_type:subject_type_id ( name ), subject_group:subject_group_id ( name ) )`,
    )
    .eq("student_id", ctx.studentId)
    .order("grade")
    .order("semester")
    .order("priority", { ascending: false })
    .returns<import("@/lib/domains/student-record/course-plan/types").CoursePlanWithSubject[]>();

  if (error) {
    logActionWarn(LOG_CTX, `refreshCoursePlanData 실패 (계속 진행): ${error.message}`, { studentId: ctx.studentId });
    return;
  }

  if (refreshedPlans) {
    ctx.coursePlanData = { plans: refreshedPlans };
  }
}

function collectPlannedSubjectNames(ctx: PipelineContext): string[] {
  if (!ctx.coursePlanData?.plans) return [];
  const names = new Set<string>();
  for (const p of ctx.coursePlanData.plans) {
    if (p.plan_status !== "confirmed" && p.plan_status !== "recommended") continue;
    const name = (p.subject as { name?: string } | null)?.name;
    if (name) names.add(name);
  }
  return [...names];
}

// ============================================
// D4 helpers: 12계열 연속성 ranking
// ============================================

async function fetchClubHistory(
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
    // 4-layer 우선순위로 동아리 이름 추출 (제목·키워드 단서)
    const text =
      row.imported_content?.trim() ||
      row.confirmed_content?.trim() ||
      row.content?.trim() ||
      row.ai_draft_content?.trim() ||
      "";
    if (!text) continue;
    // 첫 줄 또는 첫 50자에서 동아리 이름 추출 (휴리스틱)
    const firstLine = text.split("\n")[0].slice(0, 80);
    const lineage = classifyClubByName(firstLine);
    history.push({ grade: row.grade, name: firstLine, lineage });
  }
  return history;
}

async function applyContinuityRanking(
  guides: Array<{ id: string; title: string; guide_type: string | null; match_reason: string }>,
  clubHistory: ClubHistoryEntry[],
  studentGrade: number,
  supabase: PipelineContext["supabase"],
): Promise<RankedGuide[]> {
  if (guides.length === 0) return [];

  // 가이드별 12계열 추론 (career_field 매핑 기반)
  const guideIds = guides.map((g) => g.id);
  const lineageByGuide = new Map<string, Lineage12 | null>();

  // career_field_mappings 조회 → 8 career_field → 12계열 lossy 매핑
  const { data: cfRows } = await supabase
    .from("exploration_guide_career_mappings")
    .select("guide_id, exploration_guide_career_fields!inner(name_kor)")
    .in("guide_id", guideIds);

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
    // 첫 후보 사용 (lossy)
    if (possibleLineages && possibleLineages.length > 0) {
      lineageByGuide.set(r.guide_id, possibleLineages[0]);
    }
  }

  // 점수 계산 + 정렬
  const ranked: RankedGuide[] = guides.map((g) => {
    const lineage = lineageByGuide.get(g.id) ?? null;

    // baseScore: match_reason의 매치 강도
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

    return {
      id: g.id,
      title: g.title,
      guide_type: g.guide_type,
      match_reason: g.match_reason,
      baseScore,
      continuityScore,
      finalScore: baseScore * continuityScore,
    };
  });

  // 최종 점수 desc 정렬
  ranked.sort((a, b) => b.finalScore - a.finalScore);
  return ranked;
}

// ============================================
// D6 helpers: AI 생성 트리거 + 호출 (feature-flag)
// ============================================

function shouldTriggerAiGeneration(ctx: PipelineContext, currentMatchCount: number): boolean {
  // Decision #2 Q2-1: 설계 학년 + storyline 존재 + 매칭 < 3건
  if (currentMatchCount >= MIN_GUIDES_FOR_AI_TRIGGER) return false;
  const hasDesignGrade = ctx.unifiedInput?.hasAnyDesign === true;
  if (!hasDesignGrade) return false;
  // storyline 존재 여부는 task_results에서 확인
  const storylineResult = ctx.results?.storyline_generation as { storylineCount?: number } | undefined;
  if (!storylineResult || (storylineResult.storylineCount ?? 0) === 0) return false;
  return true;
}

async function triggerAiGuideGeneration(
  _ctx: PipelineContext,
): Promise<RankedGuide[]> {
  // TODO (Wave 5+): generateGuideCore 호출 — student-specific guides 생성.
  //   현재는 schema에 student_id 컬럼이 없어 "공용 풀 + pending_approval" 방식 필요.
  //   이는 Decision #2 Q2-5 (재사용 정책)와 함께 별도 wave로 분리.
  //
  //   호출 골격:
  //     const { generateGuideCore } = await import("@/lib/domains/guide/llm/actions/generateGuideCore");
  //     const result = await generateGuideCore({ source: "keyword", keyword: { ... } }, userId);
  //     → status='pending_approval' 가이드 4건 생성 후 RankedGuide[] 반환
  //
  //   현재는 PHASE2_AI_GUIDE_GENERATION=1 환경변수가 켜져있어도 빈 배열 반환.
  return [];
}

// ============================================
// 배정 INSERT (D3 창체 slot auto-link 포함)
// ============================================

async function insertAssignments(
  ctx: PipelineContext,
  ranked: RankedGuide[],
): Promise<number> {
  const { supabase, studentId, tenantId, studentGrade } = ctx;

  // 이미 배정된 가이드 제외
  const { data: existing } = await supabase
    .from("exploration_guide_assignments")
    .select("guide_id")
    .eq("student_id", studentId);
  const existingIds = new Set((existing ?? []).map((a) => a.guide_id));
  const newGuides = ranked.filter((g) => !existingIds.has(g.id));
  if (newGuides.length === 0) return 0;

  const currentSchoolYear = calculateSchoolYear();

  // area-resolver: 가이드별 대상 영역 도출 (subject + activity_type 둘 다)
  const { resolveGuideTargetArea } = await import("@/lib/domains/guide/actions/area-resolver");
  const areaMap = await resolveGuideTargetArea(newGuides.map((g) => g.id));

  // 세특 슬롯 조회 (subject_id 기반 auto-link)
  const { data: existingSeteks } = await supabase
    .from("student_record_seteks")
    .select("id, subject_id")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);
  const setekBySubject = new Map<string, string>();
  for (const s of existingSeteks ?? []) {
    if (!setekBySubject.has(s.subject_id)) {
      setekBySubject.set(s.subject_id, s.id);
    }
  }

  // 창체 슬롯 조회 (activity_type 기반 auto-link — D3 신규)
  const { data: existingChangche } = await supabase
    .from("student_record_changche")
    .select("id, activity_type, grade")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("grade", studentGrade);
  const changcheByActivity = new Map<string, string>();
  for (const c of existingChangche ?? []) {
    if (!changcheByActivity.has(c.activity_type)) {
      changcheByActivity.set(c.activity_type, c.id);
    }
  }

  const insertRows = newGuides.map((g) => {
    const area = areaMap.get(g.id);
    const targetSubjectId = area?.targetSubjectId ?? null;
    const targetActivityType = area?.targetActivityType ?? null;

    // D3: 창체 영역 가이드는 changche 슬롯에, 그 외는 setek 슬롯에 link
    let linkedRecordType: "setek" | "changche" | null = null;
    let linkedRecordId: string | null = null;
    if (targetActivityType) {
      // 창체 가이드 — activity_type 기반 link
      const changcheId = changcheByActivity.get(targetActivityType) ?? null;
      if (changcheId) {
        linkedRecordType = "changche";
        linkedRecordId = changcheId;
      }
    } else if (targetSubjectId) {
      // 세특 가이드 — subject_id 기반 link
      const setekId = setekBySubject.get(targetSubjectId) ?? null;
      if (setekId) {
        linkedRecordType = "setek";
        linkedRecordId = setekId;
      }
    }

    return {
      tenant_id: tenantId,
      student_id: studentId,
      guide_id: g.id,
      assigned_by: null,
      school_year: currentSchoolYear,
      grade: studentGrade,
      status: "assigned",
      student_notes: `[AI] 파이프라인 자동 배정 (${g.match_reason}, sim=${g.finalScore.toFixed(2)})`,
      target_subject_id: targetSubjectId,
      target_activity_type: targetActivityType,
      linked_record_type: linkedRecordType,
      linked_record_id: linkedRecordId,
      ai_recommendation_reason: g.match_reason,
    };
  });

  const { error: insertErr, count } = await supabase
    .from("exploration_guide_assignments")
    .insert(insertRows, { count: "exact" });

  if (insertErr) {
    logActionError(LOG_CTX, insertErr, { studentId, attempted: insertRows.length });
    return 0;
  }
  logActionDebug(
    LOG_CTX,
    `runGuideMatching: ${count ?? newGuides.length}건 배정 완료 (세특 ${insertRows.filter((r) => r.linked_record_type === "setek").length} / 창체 ${insertRows.filter((r) => r.linked_record_type === "changche").length} / 미연결 ${insertRows.filter((r) => !r.linked_record_type).length})`,
  );
  return count ?? newGuides.length;
}
