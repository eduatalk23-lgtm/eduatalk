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
  /** Phase A: 난이도 적합도 (0.7~1.0) */
  difficultyScore: number;
  /** Phase A: 사슬 보너스 (1.0 기본, 1.3 sequel) */
  sequelBonus: number;
  /** 최종 가중치 점수 = baseScore × continuityScore × difficultyScore × sequelBonus */
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
  // Wave 5.1d 후속: 8개로 확장 — 3학년 plans 5 + 2학년 plans 3 까지 커버.
  // DB only 라 rate limit 고민 없음.
  const plannedNames = collectPlannedSubjectNames(ctx);
  for (const subjectName of plannedNames.slice(0, 8)) {
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
    studentId,
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
  // Wave 5.1f: **설계 학년(consultingGrades) 의 plans 만** 사용.
  //   탐구 가이드는 본질상 NEIS 가 아직 기록되지 않은 설계 학년 대상.
  //   분석 학년(NEIS 확정) 의 plans 를 포함하면 이미 끝난 활동에 가이드가
  //   link 되는 무의미한 상황 발생.
  // Wave 5.1d: grade 역순(높은 학년 우선)으로 정렬해 상위 slice 가 현재 학년을
  //   먼저 뽑도록. 설계 학년만 있는 지금도 여전히 grade 내림차순 정렬 유지.
  const consultingGradesSet = new Set(ctx.consultingGrades ?? []);
  if (consultingGradesSet.size === 0) return [];

  const byGrade = new Map<number, Set<string>>();
  for (const p of ctx.coursePlanData.plans) {
    if (p.plan_status !== "confirmed" && p.plan_status !== "recommended") continue;
    if (!consultingGradesSet.has(p.grade)) continue; // 설계 학년만
    const name = (p.subject as { name?: string } | null)?.name;
    if (!name) continue;
    const set = byGrade.get(p.grade) ?? new Set<string>();
    set.add(name);
    byGrade.set(p.grade, set);
  }
  const sortedGrades = [...byGrade.keys()].sort((a, b) => b - a); // 3 → 2 → 1
  const result: string[] = [];
  for (const grade of sortedGrades) {
    for (const name of byGrade.get(grade) ?? []) {
      if (!result.includes(name)) result.push(name);
    }
  }
  return result;
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
  studentId: string,
): Promise<RankedGuide[]> {
  if (guides.length === 0) return [];

  const guideIds = guides.map((g) => g.id);

  // ── 병렬 메타데이터 조회: 12계열 + Phase A (난이도/클러스터/사슬) ──
  const [cfRows, phaseARows, existingAssignments, sequelRows] = await Promise.all([
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

    // Phase A: 사슬 보너스 (이미 배정된 가이드의 sequel이면 1.3배)
    const sequelBonus = sequelTargets.has(g.id) ? 1.3 : 1.0;

    return {
      id: g.id,
      title: g.title,
      guide_type: g.guide_type,
      match_reason: g.match_reason,
      baseScore,
      continuityScore,
      difficultyScore,
      sequelBonus,
      finalScore: baseScore * continuityScore * difficultyScore * sequelBonus,
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
function computeDifficultyFit(studentGrade: number, difficulty: string | null | undefined): number {
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
  const studentSubjectPool = await collectStudentSubjectPool(studentId, {
    gradeFilter: consultingGradesSet.size > 0 ? consultingGradesSet : undefined,
  });
  const areaMap = await resolveGuideTargetArea(
    newGuides.map((g) => g.id),
    { preferredSubjectIds: studentSubjectPool },
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

  // Phase 2 Wave 5.1d: orphan 배정 skip + school_year 를 linked 레코드 기반으로 저장
  let skippedOrphan = 0;
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
  }> = [];

  for (const g of newGuides) {
    const area = areaMap.get(g.id);
    const targetSubjectId = area?.targetSubjectId ?? null;
    const targetActivityType = area?.targetActivityType ?? null;

    // 세특도 창체도 아닌 가이드(= 둘 다 null) → skip.
    // 세특 가이드인데 학생 실제 과목 풀과 매칭 안 됨 → targetSubjectId === null → skip.
    if (!targetSubjectId && !targetActivityType) {
      skippedOrphan++;
      continue;
    }

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
    });
  }

  if (insertRows.length === 0) {
    logActionDebug(
      LOG_CTX,
      `runGuideMatching: insert할 배정 없음 (candidates=${newGuides.length}, skippedOrphan=${skippedOrphan})`,
      { studentId },
    );
    return 0;
  }

  const { error: insertErr, count } = await supabase
    .from("exploration_guide_assignments")
    .insert(insertRows, { count: "exact" });

  if (insertErr) {
    logActionError(LOG_CTX, insertErr, { studentId, attempted: insertRows.length });
    return 0;
  }
  logActionDebug(
    LOG_CTX,
    `runGuideMatching: ${count ?? insertRows.length}건 배정 완료 (세특 ${insertRows.filter((r) => r.linked_record_type === "setek").length} / 창체 ${insertRows.filter((r) => r.linked_record_type === "changche").length} / 미연결 ${insertRows.filter((r) => !r.linked_record_type).length}, orphan skip ${skippedOrphan})`,
  );
  return count ?? insertRows.length;
}
