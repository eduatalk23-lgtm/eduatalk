// ============================================
// S2: runEdgeComputation + runGuideMatching
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
  type ScoreRowWithSubject,
} from "../pipeline-types";
import type { PersistedEdge } from "../../repository/edge-repository";
import type { CrossRefEdge } from "../../cross-reference";
import * as competencyRepo from "../../repository/competency-repository";
import type { CourseAdequacyResult } from "../../types";

const LOG_CTX = { domain: "student-record", action: "pipeline" };

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
  const { buildConnectionGraph } = await import("../../cross-reference");
  const { fetchCrossRefData } = await import("../../actions/cross-ref-data-builder");
  const edgeRepo = await import("../../repository/edge-repository");
  const { computeContentHash } = await import("../../content-hash");

  const { calculateCourseAdequacy } = await import("../../course-adequacy");

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
  if (hashErr) logActionError({ domain: "student-record", action: "phase-s2-edges" }, hashErr, { pipelineId });

  // Phase E2: 후속 태스크용 엣지 배열
  const computedEdges = graph.nodes.flatMap((n) => n.edges) as PersistedEdge[] | CrossRefEdge[];

  const preview = `${edgeCount}개 엣지 감지 (${graph.nodes.length}개 영역)`;
  return { preview, result: { totalEdges: graph.totalEdges, nodeCount: graph.nodes.length }, computedEdges, sharedCourseAdequacy: courseAdequacy };
}

// ============================================
// 6. 가이드 매칭 + 배정
// ============================================

export async function runGuideMatching(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { supabase, studentId, tenantId, studentGrade, snapshot } = ctx;

  const { autoRecommendGuidesAction } = await import("@/lib/domains/guide/actions/auto-recommend");
  const classificationId = snapshot?.target_sub_classification_id as number | null;

  // Impl-8: 진로분류 기반 + 수강계획 과목 기반 매칭 병합
  type RecommendedGuide = { id: string; title: string; match_reason: string };
  const guideMap = new Map<string, RecommendedGuide>();

  // 1) 진로분류 기반 매칭
  const classResult = await autoRecommendGuidesAction({ studentId, classificationId });
  if (classResult.success && Array.isArray(classResult.data)) {
    for (const g of classResult.data) guideMap.set(g.id, g);
  }

  // 2) 수강계획 과목 기반 매칭 (설계 모드 학년 포함)
  if (ctx.coursePlanData?.plans) {
    const plannedNames = [
      ...new Set(
        ctx.coursePlanData.plans
          .filter((p) => p.plan_status === "confirmed" || p.plan_status === "recommended")
          .map((p) => (p.subject as { name?: string } | null)?.name)
          .filter((n): n is string => !!n),
      ),
    ];
    // 최대 5개 과목만 (rate limit 방지)
    for (const subjectName of plannedNames.slice(0, 5)) {
      const subjectResult = await autoRecommendGuidesAction({ studentId, classificationId, subjectName });
      if (subjectResult.success && Array.isArray(subjectResult.data)) {
        for (const g of subjectResult.data) {
          // "both" 우선, 기존보다 높은 매칭이면 덮어쓰기
          const existing = guideMap.get(g.id);
          if (!existing || g.match_reason === "both") {
            guideMap.set(g.id, g);
          }
        }
      }
    }
  }

  const guides = [...guideMap.values()];
  let assigned = 0;
  if (guides.length > 0) {
    const { data: existing } = await supabase
      .from("exploration_guide_assignments")
      .select("guide_id")
      .eq("student_id", studentId);
    const existingIds = new Set((existing ?? []).map((a) => a.guide_id));
    const newGuides = guides.filter((g) => !existingIds.has(g.id));
    if (newGuides.length > 0) {
      const currentSchoolYear = calculateSchoolYear();

      // area-resolver로 가이드별 대상 영역 도출
      const { resolveGuideTargetArea } = await import("@/lib/domains/guide/actions/area-resolver");
      const areaMap = await resolveGuideTargetArea(newGuides.map((g) => g.id));

      // 기존 세특 조회 (auto-link용 — 설계 모드 슬롯 포함)
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

      const { error: insertErr } = await supabase
        .from("exploration_guide_assignments")
        .insert(newGuides.map((g) => {
          const area = areaMap.get(g.id);
          const targetSubjectId = area?.targetSubjectId ?? null;
          const setekId = targetSubjectId ? setekBySubject.get(targetSubjectId) ?? null : null;
          return {
            tenant_id: tenantId,
            student_id: studentId,
            guide_id: g.id,
            assigned_by: null,
            school_year: currentSchoolYear,
            grade: studentGrade,
            status: "assigned",
            student_notes: `[AI] 파이프라인 자동 배정 (${g.match_reason})`,
            target_subject_id: targetSubjectId,
            target_activity_type: area?.targetActivityType ?? null,
            linked_record_type: setekId ? "setek" : null,
            linked_record_id: setekId,
            ai_recommendation_reason: g.match_reason,
          };
        }));
      if (!insertErr) assigned = newGuides.length;
    }
  }

  void LOG_CTX;
  return `${assigned}건 가이드 배정 (${guides.length}건 추천)`;
}
