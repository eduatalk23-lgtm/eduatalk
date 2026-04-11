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
  /** 전공 적합도 보너스 (1.0 기본, 1.2 전공 권장 과목 매칭) */
  majorBonus: number;
  /** 최종 가중치 점수 = baseScore × continuityScore × difficultyScore × sequelBonus × majorBonus */
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
  // desired_career_field는 이제 H3 careerFieldHint로 대체됨
  void (snapshot?.desired_career_field);

  const { autoRecommendGuidesAction } = await import("@/lib/domains/guide/actions/auto-recommend");
  // H3: 전공 기반 career field 힌트 (가이드 추천 풀에 전공 계열 가이드 포함)
  let careerFieldHint: string | null = null;
  const targetMajorForCareer = (snapshot?.target_major as string) ?? null;
  if (targetMajorForCareer) {
    const { inferCareerFieldFromMajor } = await import("@/lib/domains/student-record/constants");
    careerFieldHint = inferCareerFieldFromMajor(targetMajorForCareer);
  }

  // ── D6 v2: AI 설계 선행 → 풀 매칭 → 없으면 셸 생성 ──
  // 학생 맥락(스토리라인 + 방향가이드 + 수강계획)을 AI가 먼저 분석하여
  // "이 학생에게 필요한 탐구"를 설계한 뒤, 설계 결과에 맞는 풀 가이드를 매칭.
  // 풀에 없는 것만 셸(queued_generation)로 생성.

  const clubHistory = await fetchClubHistory(supabase, studentId, tenantId);
  const plannedNames = collectPlannedSubjectNames(ctx);

  // 전공 권장 과목 subject_id 세트 (ranking용)
  let majorRecommendedSubjectIds: Set<string> | undefined;
  const targetMajor = (snapshot?.target_major as string) ?? null;
  if (targetMajor) {
    const { getMajorRecommendedCourses } = await import(
      "@/lib/domains/student-record/constants"
    );
    const { getCurriculumYear } = await import("@/lib/utils/schoolYear");
    const enrollmentYear = calculateSchoolYear() - studentGrade + 1;
    const curriculumYear = getCurriculumYear(enrollmentYear);
    const recommended = getMajorRecommendedCourses(targetMajor, curriculumYear);
    if (recommended) {
      const allNames = [
        ...recommended.general,
        ...recommended.career,
        ...("fusion" in recommended && recommended.fusion ? recommended.fusion as string[] : []),
      ];
      if (allNames.length > 0) {
        const { normalizeSubjectName } = await import("@/lib/domains/subject/normalize");
        const normalizedNames = allNames.map(normalizeSubjectName);
        const { data: subjectRows } = await supabase
          .from("subjects")
          .select("id, name");
        majorRecommendedSubjectIds = new Set<string>();
        for (const s of subjectRows ?? []) {
          if (normalizedNames.includes(normalizeSubjectName(s.name))) {
            majorRecommendedSubjectIds.add(s.id);
          }
        }
      }
    }
  }

  let ranked: RankedGuide[] = [];

  // ── Phase A: AI 탐구 설계 (설계 학년 + 스토리라인 존재 시) ──
  const canDesign = ENABLE_AI_GENERATION && shouldTriggerAiGeneration(ctx, 0);

  if (canDesign) {
    try {
      // AI가 학생 맥락을 분석하여 필요한 탐구 N건을 설계
      const designs = await runExplorationDesign(ctx);

      for (const design of designs) {
        // 설계 결과의 키워드/제목으로 풀 매칭 시도
        const poolMatch = await matchDesignToPool(
          design,
          { studentId, classificationId, autoRecommendGuidesAction },
        );

        if (poolMatch) {
          // 풀에 맞는 가이드 있음 → 기존 가이드 사용
          ranked.push({
            ...poolMatch,
            match_reason: "ai_design_pool_match",
            baseScore: 3, // AI 설계 + 풀 매칭 = 최고 적합도
          });
          logActionDebug(LOG_CTX, `D6: 설계 "${design.title}" → 풀 매칭 "${poolMatch.title}"`, { studentId });
        } else {
          // 풀에 없음 → 셸 생성 (2단계에서 전문 생성)
          const shell = await createDesignShell(design, ctx);
          if (shell) {
            ranked.push(shell);
            logActionDebug(LOG_CTX, `D6: 설계 "${design.title}" → 셸 생성`, { studentId });
          }
        }
      }
    } catch (err) {
      logActionWarn(
        LOG_CTX,
        `D6: AI 탐구 설계 실패 — 기존 풀 매칭으로 fallback: ${err instanceof Error ? err.message : String(err)}`,
        { studentId },
      );
    }
  }

  // ── Phase B: 기존 풀 보충 매칭 (AI 설계 불가 or fallback) ──
  // AI 설계가 비활성이거나 실패한 경우, 또는 AI 설계 결과가 부족한 경우 보충
  if (ranked.length < MIN_GUIDES_FOR_AI_TRIGGER) {
    type RecommendedGuide = { id: string; title: string; guide_type: string | null; match_reason: string };
    const guideMap = new Map<string, RecommendedGuide>();
    // 이미 ranked에 있는 가이드 제외
    const rankedIds = new Set(ranked.map((r) => r.id));

    // (1) classification 매칭
    const classResult = await autoRecommendGuidesAction({ studentId, classificationId, careerFieldHint, limit: 10 });
    if (classResult.success && Array.isArray(classResult.data)) {
      for (const g of classResult.data) {
        if (!rankedIds.has(g.id)) guideMap.set(g.id, g);
      }
    }

    // (2) 수강계획 과목 매칭
    for (const subjectName of plannedNames.slice(0, 8)) {
      const subjectResult = await autoRecommendGuidesAction({
        studentId,
        classificationId,
        subjectName,
        careerFieldHint,
        limit: 5,
      });
      if (subjectResult.success && Array.isArray(subjectResult.data)) {
        for (const g of subjectResult.data) {
          if (!rankedIds.has(g.id)) {
            const existing = guideMap.get(g.id);
            if (!existing || g.match_reason === "both" || g.match_reason === "all") {
              guideMap.set(g.id, g);
            }
          }
        }
      }
    }

    // (3) activity_type 매칭 (창체용)
    for (const activityType of ["autonomy", "club", "career"] as const) {
      const activityResult = await autoRecommendGuidesAction({
        studentId,
        classificationId,
        activityType,
        careerFieldHint,
        limit: 5,
      });
      if (activityResult.success && Array.isArray(activityResult.data)) {
        for (const g of activityResult.data) {
          if (!rankedIds.has(g.id) && !guideMap.has(g.id)) guideMap.set(g.id, g);
        }
      }
    }

    // ranking 적용 후 기존 ranked에 추가
    const poolRanked = await applyContinuityRanking(
      [...guideMap.values()],
      clubHistory,
      studentGrade,
      supabase,
      studentId,
      majorRecommendedSubjectIds,
    );
    ranked.push(...poolRanked);
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

  // targetMajorClassificationField는 H3 careerFieldHint로 대체됨 — void 삭제
  const orphanHint = skippedOrphan > 0
    ? ` / ${skippedOrphan}건 미배정(과목 풀 불일치: ${skippedOrphanGuides.map((g) => g.title).slice(0, 3).join(", ")}${skippedOrphan > 3 ? " 외" : ""})`
    : "";

  // H4: 고아 가이드 세부 정보를 previews에 저장 (UI 표시용)
  if (skippedOrphanGuides.length > 0) {
    ctx.previews["guide_matching_orphans"] = JSON.stringify({
      count: skippedOrphan,
      guides: skippedOrphanGuides.slice(0, 10).map((g) => ({ id: g.id, title: g.title })),
    });
  }

  return `${assigned}건 가이드 배정 (${ranked.length}건 후보${continuityHint}${orphanHint})${aiHint}`;
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
  majorRecommendedSubjectIds?: Set<string>,
): Promise<RankedGuide[]> {
  if (guides.length === 0) return [];

  const guideIds = guides.map((g) => g.id);

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
      finalScore: baseScore * continuityScore * difficultyScore * sequelBonus * majorBonus,
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

// ============================================
// D6 v2: AI 설계 선행 → 풀 매칭 → 셸 생성
// ============================================

import type { ExplorationDesignItem } from "@/lib/domains/guide/llm/types";

/** AI 탐구 설계 수행 — 학생 맥락에서 필요한 탐구 N건을 설계 */
async function runExplorationDesign(
  ctx: PipelineContext,
): Promise<{ designs: ExplorationDesignItem[]; overallStrategy: string }> {
  const { supabase, studentId, snapshot, consultingGrades } = ctx;

  // 1. 스토리라인 (DB 조회)
  const { data: storylineRows } = await supabase
    .from("student_record_storylines")
    .select("title, keywords, narrative, grade_1_theme, grade_2_theme, grade_3_theme, strength")
    .eq("student_id", studentId)
    .order("sort_order", { ascending: true })
    .limit(5);

  const storylines = (storylineRows ?? []).map((s) => ({
    title: s.title ?? "",
    keywords: (s.keywords as string[]) ?? [],
    narrative: s.narrative as string | null,
    grade1Theme: s.grade_1_theme as string | null,
    grade2Theme: s.grade_2_theme as string | null,
    grade3Theme: s.grade_3_theme as string | null,
    strength: s.strength as string | null,
  }));

  if (storylines.length === 0) return { designs: [], overallStrategy: "" };

  // 2. 방향 가이드
  const directionGuides: {
    type: "setek" | "changche" | "haengteuk";
    subject?: string;
    activityType?: string;
    direction: string;
    keywords: string[];
    competencyFocus: string[];
  }[] = [];

  if (ctx.unifiedInput) {
    for (const grade of consultingGrades ?? []) {
      const gradeData = ctx.unifiedInput.grades[grade];
      if (!gradeData) continue;
      for (const dg of gradeData.directionGuides) {
        directionGuides.push({
          type: dg.type,
          subject: dg.subjectName,
          activityType: dg.activityType,
          direction: dg.direction,
          keywords: dg.keywords,
          competencyFocus: dg.competencyFocus,
        });
      }
    }
  }

  // 3. 수강계획 과목명 + 설계 학년
  const plannedSubjects = collectPlannedSubjectNames(ctx);
  const designGrade = (consultingGrades ?? []).length > 0
    ? Math.max(...(consultingGrades ?? []))
    : ctx.studentGrade;

  // 4. AI 호출
  const { generateObjectWithRateLimit } = await import("@/lib/domains/plan/llm/ai-sdk");
  const { geminiQuotaTracker } = await import("@/lib/domains/plan/llm/providers/gemini");
  const { zodSchema } = await import("ai");
  const { explorationDesignSchema } = await import("@/lib/domains/guide/llm/types");
  const {
    buildExplorationDesignSystemPrompt,
    buildExplorationDesignUserPrompt,
  } = await import("@/lib/domains/guide/llm/prompts/exploration-design");

  const quota = geminiQuotaTracker.getQuotaStatus();
  if (quota.isExceeded) {
    logActionWarn(LOG_CTX, "D6: Gemini 할당량 초과 — AI 탐구 설계 스킵", { studentId });
    return { designs: [], overallStrategy: "" };
  }

  const result = await generateObjectWithRateLimit({
    system: buildExplorationDesignSystemPrompt(),
    messages: [{
      role: "user",
      content: buildExplorationDesignUserPrompt({
        targetMajor: (snapshot?.target_major as string) ?? null,
        desiredCareerField: (snapshot?.desired_career_field as string) ?? null,
        designGrade,
        storylines,
        directionGuides,
        plannedSubjects,
        existingGuides: [], // 아직 매칭 전이므로 빈 배열
        neededCount: MIN_GUIDES_FOR_AI_TRIGGER + 1, // 여유 있게 설계 요청
      }),
    }],
    schema: zodSchema(explorationDesignSchema),
    modelTier: "fast" as const,
    temperature: 0.4,
    maxTokens: 4096,
  });

  logActionDebug(LOG_CTX, `D6: ${result.object.designs.length}건 탐구 설계 완료`, {
    studentId,
    strategy: result.object.overallStrategy,
  });

  return { designs: result.object.designs, overallStrategy: result.object.overallStrategy };
}

/** 설계 결과를 키워드로 풀에서 매칭 시도 */
async function matchDesignToPool(
  design: ExplorationDesignItem,
  opts: {
    studentId: string;
    classificationId: number | null;
    autoRecommendGuidesAction: (input: { studentId: string; classificationId: number | null; subjectName?: string; limit?: number }) => Promise<{ success: boolean; data?: { id: string; title: string; guide_type: string | null; match_reason: string }[] }>;
  },
): Promise<RankedGuide | null> {
  // 설계의 교과 연계에서 과목명 추출 (예: "생명과학II > 세포와 물질대사" → "생명과학II")
  const subjectName = design.subjectConnect?.split(" > ")[0]?.trim();
  if (!subjectName) return null;

  const result = await opts.autoRecommendGuidesAction({
    studentId: opts.studentId,
    classificationId: opts.classificationId,
    subjectName,
    limit: 5,
  });

  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) return null;

  // 설계 키워드와 제목이 겹치는 가이드를 우선 선택
  const designKeywords = new Set(design.keyTopics.map((k) => k.toLowerCase()));
  let bestMatch = result.data[0];
  let bestOverlap = 0;

  for (const candidate of result.data) {
    const titleLower = candidate.title.toLowerCase();
    let overlap = 0;
    for (const kw of designKeywords) {
      if (titleLower.includes(kw)) overlap++;
    }
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = candidate;
    }
  }

  // 키워드 겹침이 없으면 풀 매칭 실패 — 맥락 불일치
  if (bestOverlap === 0) return null;

  return {
    id: bestMatch.id,
    title: bestMatch.title,
    guide_type: bestMatch.guide_type,
    match_reason: "ai_design_pool_match",
    baseScore: 3,
    continuityScore: 1.0,
    difficultyScore: 1.0,
    sequelBonus: 1.0,
    majorBonus: 1.0,
    finalScore: 3.0,
  };
}

/** 풀에 없는 설계 → 셸(queued_generation) 생성 */
async function createDesignShell(
  design: ExplorationDesignItem,
  ctx: PipelineContext,
): Promise<RankedGuide | null> {
  const { tenantId, studentId, consultingGrades } = ctx;
  const designGrade = (consultingGrades ?? []).length > 0
    ? Math.max(...(consultingGrades ?? []))
    : ctx.studentGrade;

  try {
    const { createGuideShell } = await import("@/lib/domains/guide/repository");
    const guideId = await createGuideShell({
      tenantId,
      title: design.title,
      guideType: design.guideType,
      difficultyLevel: design.difficultyLevel,
      sourceType: "ai_pipeline_design",
      aiGenerationMeta: {
        ...design,
        studentId,
        designGrade,
        designedAt: new Date().toISOString(),
      },
    });

    return {
      id: guideId,
      title: design.title,
      guide_type: design.guideType,
      match_reason: "ai_designed",
      baseScore: 2,
      continuityScore: 1.0,
      difficultyScore: 1.0,
      sequelBonus: 1.0,
      majorBonus: 1.0,
      finalScore: 2.0,
    };
  } catch (err) {
    logActionError(LOG_CTX, err, { studentId, design: design.title });
    return null;
  }
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
  const skippedOrphanGuides: Array<{ id: string; title: string }> = [];
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
      skippedOrphanGuides.push({ id: g.id, title: g.title });
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

  // Phase A: 학생 궤적 자동 기록 (fire-and-forget)
  upsertTopicTrajectories(supabase, studentId, insertRows.map((r) => r.guide_id), studentGrade).catch(() => {});

  return count ?? insertRows.length;
}

/** Phase A: 배정된 가이드들의 궤적을 일괄 UPSERT */
async function upsertTopicTrajectories(
  supabase: PipelineContext["supabase"],
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
