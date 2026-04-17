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
  /** P3: Layer 2 hyperedge 테마 부합 (1.0 기본, 1.15 일치) */
  hyperedgeBonus?: number;
  /** P3: Layer 3 narrative_arc 약한 단계 보강 (1.0 기본, 1.1 해당) */
  narrativeArcBonus?: number;
  /** 스토리라인 키워드 매칭 (1.0 기본, 1.2 매칭) — 관점별 필터링 */
  storylineBonus?: number;
  /** 최종 가중치 점수 (모든 보너스 승수 곱) */
  finalScore: number;
}

/**
 * P3: narrative_arc 8단계 중 "약한 단계"를 보강 가능한 guide_type 매핑.
 * 휴리스틱(컨설턴트 직관 기반). 정확한 모델링은 향후 개선.
 */
const WEAK_STAGE_GUIDE_TYPE_MAP: Record<string, string[]> = {
  "참고문헌": ["reading"],
  "탐구내용/이론": ["topic_exploration", "experiment"],
  "결론/제언": ["experiment", "topic_exploration"],
  "성장서사": ["career_exploration_project", "reflection_program"],
  "오류분석→재탐구": ["experiment"],
  "교사관찰": ["reflection_program"],
  "주제선정": ["topic_exploration", "career_exploration_project"],
};

const MIN_GUIDES_FOR_AI_TRIGGER = 3; // Decision #2 Q2-1: 매칭이 3건 미만일 때만 AI 생성
// P2: 기본 ON. 명시적 "0"일 때만 OFF. Gemini 할당량 초과 시 runExplorationDesign
//     내부에서 자동 스킵하므로 안전. D6 feature flag.
const ENABLE_AI_GENERATION = process.env.PHASE2_AI_GUIDE_GENERATION !== "0";

// ============================================
// 배정 상한 (과다 할당 방지)
//
// Phase A(AI 설계) + Phase B(풀 보충) 합집합 후 finalScore 기준으로
// 상위 N건만 배정. 한 세특 과목/창체 영역에는 최대 M건까지만 link.
// 이전: 합집합 후 상한 없음 → 최대 65건+ 후보가 그대로 insert 되어
//       한 과목에 10건+ 가이드가 달리는 문제 (사용자 피드백 2026-04-17).
// ============================================
const MAX_TOTAL_ASSIGNMENTS = 24;
const MAX_GUIDES_PER_SLOT = 3;

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

  // P2 진단(2026-04-14): Phase A가 왜 안/도는지 task_previews 에 박제.
  ctx.previews["d6_diagnosis"] = JSON.stringify({
    enableAiGeneration: ENABLE_AI_GENERATION,
    canDesign,
    consultingGrades: ctx.consultingGrades ?? null,
    hasAnyDesign: ctx.unifiedInput?.hasAnyDesign ?? null,
    hasUnifiedInput: !!ctx.unifiedInput,
    storylineCount:
      (ctx.results?.storyline_generation as { storylineCount?: number } | undefined)?.storylineCount ?? null,
  });

  if (canDesign) {
    try {
      // AI가 학생 맥락을 분석하여 필요한 탐구 N건을 설계
      const { designs, overallStrategy } = await runExplorationDesign(ctx);

      // P2 진단: Phase A 결과 박제
      ctx.previews["d6_phase_a_result"] = JSON.stringify({
        attempted: true,
        designsCount: designs.length,
        overallStrategy: overallStrategy?.slice(0, 200) ?? null,
        designs: designs.map((d) => ({
          title: d.title?.slice(0, 60) ?? null,
          guideType: d.guideType,
          difficulty: d.difficultyLevel,
          subjectConnect: d.subjectConnect?.slice(0, 60) ?? null,
        })),
      });

      // P2 진단: 각 design의 풀 매칭 / 셸 생성 결과 박제
      const designOutcomes: Array<{
        title: string;
        poolMatch: boolean;
        poolMatchTitle?: string;
        shellCreated?: boolean;
        shellError?: string;
      }> = [];

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
          designOutcomes.push({
            title: design.title?.slice(0, 60) ?? "",
            poolMatch: true,
            poolMatchTitle: poolMatch.title?.slice(0, 60),
          });
          logActionDebug(LOG_CTX, `D6: 설계 "${design.title}" → 풀 매칭 "${poolMatch.title}"`, { studentId });
        } else {
          // 풀에 없음 → 셸 생성 (2단계에서 전문 생성)
          let shellCreated = false;
          let shellError: string | undefined;
          try {
            const shell = await createDesignShell(design, ctx);
            if (shell) {
              ranked.push(shell);
              shellCreated = true;
              logActionDebug(LOG_CTX, `D6: 설계 "${design.title}" → 셸 생성`, { studentId });
            } else {
              shellError = "createDesignShell returned null";
            }
          } catch (shellErr) {
            // Supabase error 객체는 instanceof Error=false 이고 String()이 [object Object]가 되므로
            // JSON.stringify 로 message/code/details/hint 모두 추출.
            if (shellErr instanceof Error) {
              shellError = shellErr.message;
            } else if (shellErr && typeof shellErr === "object") {
              try {
                shellError = JSON.stringify(shellErr);
              } catch {
                shellError = "(unstringifiable shell error)";
              }
            } else {
              shellError = String(shellErr);
            }
          }
          designOutcomes.push({
            title: design.title?.slice(0, 60) ?? "",
            poolMatch: false,
            shellCreated,
            ...(shellError ? { shellError: shellError.slice(0, 300) } : {}),
          });
        }
      }
      ctx.previews["d6_design_outcomes"] = JSON.stringify(designOutcomes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // P2 진단: AI 설계 실패 박제
      ctx.previews["d6_phase_a_result"] = JSON.stringify({
        attempted: true,
        error: msg.slice(0, 500),
      });
      logActionWarn(
        LOG_CTX,
        `D6: AI 탐구 설계 실패 — 기존 풀 매칭으로 fallback: ${msg}`,
        { studentId },
      );
    }
  }

  // ── Phase B: 기존 풀 보충 매칭 (AI 설계 불가 or fallback) ──
  //
  // P3 라스트마일(2026-04-14): 임계 3 → 항상 합집합으로 변경.
  //   이전 가드(`< 3`)는 Phase A가 4건 처리(풀 매칭 1 + 셸 3)되면 임계 통과 못해
  //   Phase B 풀 보충이 0건 → 학생 전체 배정이 1건으로 격감하는 문제 유발.
  //   상용 MVP 기준선은 "AI 맞춤 설계 + 풀 보충 모두 제공"이 합리적이라
  //   Phase A 결과와 Phase B 보충을 항상 합집합으로 합산.
  //   (성능: Phase B는 DB만 사용, LLM 호출 없음 → 안전)
  if (true) {
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
      tenantId,
      majorRecommendedSubjectIds,
    );
    ranked.push(...poolRanked);
  }

  // ── Phase A + Phase B 합집합 정렬 + 전체 상한 ──
  //
  // Phase A (AI 설계)와 Phase B (풀 보충)가 합집합으로 쌓여 있으므로
  // finalScore 기준 글로벌 정렬 후 상위 MAX_TOTAL_ASSIGNMENTS 건만 insert.
  // 이전: 정렬·상한 없이 전부 insertAssignments 로 전달.
  const candidateCount = ranked.length;
  ranked.sort((a, b) => b.finalScore - a.finalScore);
  const capped = ranked.slice(0, MAX_TOTAL_ASSIGNMENTS);
  const overflowCount = Math.max(0, candidateCount - capped.length);

  if (overflowCount > 0) {
    ctx.previews["guide_matching_cap"] = JSON.stringify({
      candidateCount,
      cappedCount: capped.length,
      overflowCount,
      maxTotal: MAX_TOTAL_ASSIGNMENTS,
      maxPerSlot: MAX_GUIDES_PER_SLOT,
    });
  }

  // ── 배정 INSERT ──
  let assigned = 0;
  let skippedOrphan = 0;
  let skippedOrphanGuides: Array<{ id: string; title: string }> = [];
  let skippedSlotOverflow = 0;
  if (capped.length > 0) {
    const r = await insertAssignments(ctx, capped);
    assigned = r.count;
    skippedOrphan = r.skippedOrphan;
    skippedOrphanGuides = r.skippedOrphanGuides;
    skippedSlotOverflow = r.skippedSlotOverflow;
  }

  // ── D7: 결과 메시지 ──
  const aiHint = ENABLE_AI_GENERATION ? "" : "";
  const continuityHint = clubHistory.length > 0
    ? ` / ${clubHistory.length}건 동아리 이력 반영`
    : "";

  const orphanHint = skippedOrphan > 0
    ? ` / ${skippedOrphan}건 미배정(과목 풀 불일치: ${skippedOrphanGuides.map((g) => g.title).slice(0, 3).join(", ")}${skippedOrphan > 3 ? " 외" : ""})`
    : "";
  const slotCapHint = skippedSlotOverflow > 0
    ? ` / ${skippedSlotOverflow}건 슬롯 상한(${MAX_GUIDES_PER_SLOT}개) 제외`
    : "";
  const totalCapHint = overflowCount > 0
    ? ` / ${overflowCount}건 전체 상한(${MAX_TOTAL_ASSIGNMENTS}개) 제외`
    : "";

  // H4: 고아 가이드 세부 정보를 previews에 저장 (UI 표시용)
  if (skippedOrphanGuides.length > 0) {
    ctx.previews["guide_matching_orphans"] = JSON.stringify({
      count: skippedOrphan,
      guides: skippedOrphanGuides.slice(0, 10).map((g) => ({ id: g.id, title: g.title })),
    });
  }

  return `${assigned}건 가이드 배정 (${candidateCount}건 후보${continuityHint}${orphanHint}${slotCapHint}${totalCapHint})${aiHint}`;
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
  tenantIdForRanking: string,
  majorRecommendedSubjectIds?: Set<string>,
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
      finalScore:
        baseScore *
        continuityScore *
        difficultyScore *
        sequelBonus *
        majorBonus *
        hyperedgeBonus *
        narrativeArcBonus *
        storylineBonus,
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

  // P2 (2026-04-14): mode=analysis 학생도 consultingGrades에 설계 학년이 잡혀 있으면
  //   AI 설계 trigger. 이전엔 `unifiedInput.hasAnyDesign === true`만 봤는데
  //   김세린(mode=analysis, 3학년만 설계) 같은 케이스에서 hasAnyDesign이 null로 잡혀
  //   AI 설계가 한 번도 안 도는 문제가 있었다. consultingGrades가 더 정확한 신호.
  const hasDesignGrade =
    ctx.unifiedInput?.hasAnyDesign === true ||
    (ctx.consultingGrades?.length ?? 0) > 0;
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
  const { supabase, studentId, tenantId, snapshot, consultingGrades } = ctx;

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

  // P2: Layer 0/2/3 — 이 시점에 hyperedge_computation/narrative_arc_extraction이
  //     이미 선행 실행되어 DB에 있다(synthesis phase 2 순서상).
  //     이 데이터를 설계 프롬프트에 주입해 "약한 서사 단계 보강 / 수렴축 확장" 방향의 설계 유도.
  const [hyperedgeRows, narrativeRows, profileCardRow] = await Promise.all([
    supabase
      .from("student_record_hyperedges")
      .select("theme_label, member_count")
      .eq("student_id", studentId)
      .eq("edge_context", "analysis")
      .order("member_count", { ascending: false })
      .limit(5)
      .then((r) => r.data),
    supabase
      .from("student_record_narrative_arc")
      .select(
        "curiosity_present, topic_selection_present, inquiry_content_present, references_present, conclusion_present, teacher_observation_present, growth_narrative_present, reinquiry_present",
      )
      .eq("student_id", studentId)
      .then((r) => r.data),
    supabase
      .from("student_record_profile_cards")
      .select("persistent_strengths, persistent_weaknesses, recurring_quality_issues, cross_grade_themes, interest_consistency")
      .eq("student_id", studentId)
      .order("target_grade", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),
  ]);

  const hyperedgeThemes = (hyperedgeRows ?? [])
    .map((h) => (h.theme_label as string | null) ?? null)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  let narrativeStageDistribution:
    | { total: number; stages: { stage: string; count: number }[] }
    | undefined;
  if (narrativeRows && narrativeRows.length > 0) {
    const total = narrativeRows.length;
    const cnt = (key: keyof typeof narrativeRows[number]) =>
      narrativeRows.filter((r) => r[key] === true).length;
    narrativeStageDistribution = {
      total,
      stages: [
        { stage: "지적호기심", count: cnt("curiosity_present") },
        { stage: "주제선정", count: cnt("topic_selection_present") },
        { stage: "탐구내용/이론", count: cnt("inquiry_content_present") },
        { stage: "참고문헌", count: cnt("references_present") },
        { stage: "결론/제언", count: cnt("conclusion_present") },
        { stage: "교사관찰", count: cnt("teacher_observation_present") },
        { stage: "성장서사", count: cnt("growth_narrative_present") },
        { stage: "오류분석→재탐구", count: cnt("reinquiry_present") },
      ],
    };
  }

  let profileCardSummary: string | undefined;
  if (profileCardRow) {
    const parts: string[] = [];
    const s = profileCardRow.persistent_strengths as string[] | null;
    const w = profileCardRow.persistent_weaknesses as string[] | null;
    const iss = profileCardRow.recurring_quality_issues as string[] | null;
    const th = profileCardRow.cross_grade_themes as string[] | null;
    const ic = profileCardRow.interest_consistency as string | null;
    if (s?.length) parts.push(`지속 강점: ${s.slice(0, 4).join(", ")}`);
    if (w?.length) parts.push(`지속 약점: ${w.slice(0, 3).join(", ")}`);
    if (iss?.length) parts.push(`반복 품질 이슈: ${iss.slice(0, 3).join(", ")}`);
    if (th?.length) parts.push(`학년 관통 테마: ${th.slice(0, 4).join(", ")}`);
    if (ic) parts.push(`관심사 일관성: ${ic}`);
    if (parts.length > 0) profileCardSummary = parts.join(" | ");
  }

  // PR 4 (2026-04-17): Blueprint 설계 청사진 로드 — AI 에게 top-down 목표 공개
  let blueprintConvergences:
    | Array<{
        grade: number;
        themeLabel: string;
        themeKeywords: string[];
        rationale: string;
        tierAlignment: "foundational" | "development" | "advanced";
      }>
    | undefined;
  let blueprintArc: string | undefined;
  try {
    const { loadBlueprintForStudent } = await import(
      "@/lib/domains/record-analysis/blueprint/loader"
    );
    const bp = await loadBlueprintForStudent(studentId, tenantId);
    if (bp && Array.isArray(bp.targetConvergences) && bp.targetConvergences.length > 0) {
      blueprintConvergences = bp.targetConvergences.slice(0, 6).map((c) => ({
        grade: c.grade,
        themeLabel: c.themeLabel,
        themeKeywords: c.themeKeywords ?? [],
        rationale: c.rationale,
        tierAlignment: c.tierAlignment,
      }));
    }
    if (bp?.storylineSkeleton?.narrativeArc) {
      blueprintArc = bp.storylineSkeleton.narrativeArc;
    }
  } catch {
    // best-effort — blueprint 없이 진행
  }

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
        ...(hyperedgeThemes.length > 0 ? { hyperedgeThemes } : {}),
        ...(narrativeStageDistribution ? { narrativeStageDistribution } : {}),
        ...(profileCardSummary ? { profileCardSummary } : {}),
        ...(blueprintConvergences && blueprintConvergences.length > 0
          ? { blueprintConvergences }
          : {}),
        ...(blueprintArc ? { blueprintArc } : {}),
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
    storylineBonus: 1.0,
    finalScore: 3.0,
  };
}

/** 풀에 없는 설계 → 셸(queued_generation) 생성. P2: 실패 시 throw하여 호출자가 사유 박제 */
async function createDesignShell(
  design: ExplorationDesignItem,
  ctx: PipelineContext,
): Promise<RankedGuide | null> {
  const { tenantId, studentId, consultingGrades } = ctx;
  const designGrade = (consultingGrades ?? []).length > 0
    ? Math.max(...(consultingGrades ?? []))
    : ctx.studentGrade;

  // title 방어 — zod 스키마는 required지만, AI가 공백/짧은 값을 보낼 수 있어
  // 키토픽/교과연계 기반 fallback 조립. UI의 "(제목 없음)" 폴백 노출을 막기 위함.
  const trimmedTitle = design.title?.trim() ?? "";
  const safeTitle = trimmedTitle.length >= 5
    ? trimmedTitle
    : (design.keyTopics?.[0] ?? design.subjectConnect ?? "탐구 설계")
        + " 탐구";

  // P2 (2026-04-14): synthesis pipeline은 server-autonomous라 RLS 우회용 admin client 필요.
  //   기본 server client는 사용자 권한 → exploration_guides INSERT 시 RLS 정책 차단(42501).
  const { createGuideShell } = await import("@/lib/domains/guide/repository");
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정: synthesis pipeline 진행 불가");
  }
  const guideId = await createGuideShell(
    {
      tenantId,
      title: safeTitle,
      guideType: design.guideType,
      difficultyLevel: design.difficultyLevel,
      sourceType: "ai_pipeline_design",
      aiGenerationMeta: {
        ...design,
        studentId,
        designGrade,
        designedAt: new Date().toISOString(),
      },
    },
    adminClient,
  );

  // P3 라스트마일(2026-04-14): 셸 가이드는 subject_mapping이 비어있어 area-resolver가
  //   학생 과목 슬롯에 link 못함 → 무조건 orphan 처리됐던 문제. design.subjectConnect
  //   ("교과명 > 단원명") 에서 교과명을 normalize 매칭해 subject_mappings 자동 INSERT.
  const subjectName = design.subjectConnect?.split(" > ")[0]?.trim();
  if (subjectName) {
    try {
      const { normalizeSubjectName } = await import("@/lib/domains/subject/normalize");
      const normalized = normalizeSubjectName(subjectName);
      const { data: allSubjects } = await adminClient
        .from("subjects")
        .select("id, name");
      const matchedIds = (allSubjects ?? [])
        .filter((s) => normalizeSubjectName(s.name) === normalized)
        .map((s) => s.id as string);
      if (matchedIds.length > 0) {
        await adminClient
          .from("exploration_guide_subject_mappings")
          .insert(matchedIds.map((sid) => ({ guide_id: guideId, subject_id: sid })));
      }
    } catch {
      // mapping 실패는 셸 생성을 막지 않음 (best-effort). area-resolver에서 orphan 처리됨.
    }
  }

  void logActionError;

  return {
    id: guideId,
    title: safeTitle,
    guide_type: design.guideType,
    match_reason: "ai_designed",
    baseScore: 2,
    continuityScore: 1.0,
    difficultyScore: 1.0,
    sequelBonus: 1.0,
    majorBonus: 1.0,
    storylineBonus: 1.0,
    finalScore: 2.0,
  };
}

// ============================================
// 배정 INSERT (D3 창체 slot auto-link 포함)
// ============================================

async function insertAssignments(
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
      `runGuideMatching: insert할 배정 없음 (candidates=${newGuides.length}, skippedOrphan=${skippedOrphan}, skippedSlotOverflow=${skippedSlotOverflow})`,
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
    `runGuideMatching: ${count ?? insertRows.length}건 배정 완료 (세특 ${insertRows.filter((r) => r.linked_record_type === "setek").length} / 창체 ${insertRows.filter((r) => r.linked_record_type === "changche").length} / 미연결 ${insertRows.filter((r) => !r.linked_record_type).length}, orphan skip ${skippedOrphan}, slot overflow skip ${skippedSlotOverflow})`,
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
