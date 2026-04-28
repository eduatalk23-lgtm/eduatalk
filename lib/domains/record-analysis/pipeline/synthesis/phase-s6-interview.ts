// ============================================
// S6: runInterviewGeneration + runRoadmapGeneration
// ============================================

import { logActionDebug } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
  type CachedSetek,
  type CachedChangche,
} from "../pipeline-types";
import * as repository from "@/lib/domains/student-record/repository";
import * as diagnosisRepo from "@/lib/domains/student-record/repository/diagnosis-repository";
import { resolveEffectiveContent } from "../pipeline-data-resolver";
import { computeSynthesisInputHash, tryReusePreviousResult } from "./cache-helper";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

// ============================================
// 13. 면접 예상 질문 생성
// ============================================

export async function runInterviewGeneration(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { supabase, studentId, tenantId, snapshot, results } = ctx;

  // 세특/창체 레코드 수집 (캐시 재사용, imported_content 포함)
  if (!ctx.cachedSeteks) {
    const { data } = await supabase
      .from("student_record_seteks")
      .select("id, content, confirmed_content, imported_content, ai_draft_content, grade, subject:subject_id(name)")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .returns<CachedSetek[]>();
    ctx.cachedSeteks = data ?? [];
  }
  if (!ctx.cachedChangche) {
    const { data } = await supabase
      .from("student_record_changche")
      .select("id, content, confirmed_content, imported_content, ai_draft_content, grade, activity_type")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId);
    ctx.cachedChangche = (data ?? []) as CachedChangche[];
  }

  // 타입 가드: 세특 vs 창체 판별
  type CachedRecord = import("../pipeline-types").CachedSetek | import("../pipeline-types").CachedChangche;
  function isCachedSetek(r: CachedRecord): r is import("../pipeline-types").CachedSetek {
    return "subject" in r;
  }
  function getSubjectLabel(r: CachedRecord): string {
    return isCachedSetek(r) ? (r.subject?.name ?? "과목 미정") : ((r as import("../pipeline-types").CachedChangche).activity_type ?? "기록");
  }
  function getRecordType(r: CachedRecord): "setek" | "changche" {
    return isCachedSetek(r) ? "setek" : "changche";
  }
  /** 콘텐츠 해소: `pipeline-data-resolver.resolveEffectiveContent` 재사용 (4-layer 우선순위 단일 소스) */
  const getEffectiveContent = (r: CachedRecord): string => resolveEffectiveContent(r).text;

  // 가장 긴 세특 레코드 5건 선택 (면접 질문 생성용) — imported_content 우선
  // 문턱 150자: 얕은 답안 생성을 방지 (50자 미만 기록은 면접 질문으로 부적절)
  // fallback: 150자 이상이 3개 미만이면 50자 문턱으로 완화하여 최소 공급 보장
  const allRecords: CachedRecord[] = [...ctx.cachedSeteks!, ...ctx.cachedChangche!];
  const strongRecords = allRecords
    .filter((r) => getEffectiveContent(r).length >= 150)
    .sort((a, b) => getEffectiveContent(b).length - getEffectiveContent(a).length);
  const candidateRecords: CachedRecord[] = (
    strongRecords.length >= 3
      ? strongRecords
      : allRecords
          .filter((r) => getEffectiveContent(r).length >= 50)
          .sort((a, b) => getEffectiveContent(b).length - getEffectiveContent(a).length)
  ).slice(0, 5);

  if (candidateRecords.length === 0) return "기록 부족 — 건너뜀";

  const { generateInterviewQuestions } = await import("../../llm/actions/generateInterviewQuestions");

  // 메인 레코드 + 추가 레코드로 교차 질문 생성
  const main = candidateRecords[0];
  const mainContent = getEffectiveContent(main);
  const mainSubject = getSubjectLabel(main);
  const mainType = getRecordType(main);

  const additionalRecords = candidateRecords.slice(1).map((r) => ({
    content: getEffectiveContent(r),
    recordType: getRecordType(r),
    subjectName: getSubjectLabel(r),
    grade: r.grade,
  }));

  // 설계 학년 가상 레코드를 보충 면접 자료로 추가 (방향 가이드 기반)
  if (ctx.unifiedInput?.hasAnyDesign) {
    const { collectDesignRecords } = await import("../pipeline-unified-input");
    const virtualRecords = collectDesignRecords(ctx.unifiedInput);
    for (const vr of virtualRecords) {
      if (vr.content.length >= 30) {
        additionalRecords.push({
          content: vr.content,
          recordType: vr.type as "setek" | "changche",
          subjectName: vr.subject,
          grade: vr.grade,
        });
      }
    }
  }

  // 진단 약점을 면접 질문에 반영 (DB에서 조회 — in-memory 결과는 ai_diagnosis 실패 시 undefined)
  const interviewDiag = await diagnosisRepo.findDiagnosis(studentId, calculateSchoolYear(), tenantId, "ai");
  const diagWeaknesses = interviewDiag?.weaknesses as string[] | undefined;

  // 진로 컨텍스트
  const targetMajor = (snapshot?.target_major as string) ?? undefined;
  const careerContext = targetMajor ? {
    targetMajor,
    targetSubClassification: (snapshot as Record<string, unknown>)?.target_sub_classification_name as string | undefined,
  } : undefined;

  // 역량 약점 (B- 이하) — Grade Pipeline 결과를 DB에서 직접 조회
  let weakCompetencies: { item: string; label: string; grade: string }[] | undefined;
  try {
    const { findCompetencyScores } = await import("@/lib/domains/student-record/repository/competency-repository");
    const currentYear = calculateSchoolYear();
    const allScores = await findCompetencyScores(studentId, currentYear, tenantId, "ai");
    if (allScores.length > 0) {
      const { COMPETENCY_ITEMS } = await import("@/lib/domains/student-record/constants");
      weakCompetencies = allScores
        .filter((s) => s.grade_value === "B-" || s.grade_value === "C")
        .map((s) => {
          const item = COMPETENCY_ITEMS.find((c) => c.code === s.competency_item);
          return { item: s.competency_item, label: item?.label ?? s.competency_item, grade: s.grade_value };
        });
      if (weakCompetencies.length === 0) weakCompetencies = undefined;
    }
  } catch (compErr) {
    logActionDebug(LOG_CTX, `역량 점수 조회 실패 (면접 생성 계속): ${compErr}`);
  }

  // Q4: 기존 질문 조회 (중복 방지)
  const { data: existingQs } = await supabase
    .from("student_record_interview_questions")
    .select("question")
    .eq("student_id", studentId)
    .limit(15);
  const existingQuestions = existingQs?.map((q) => q.question).filter(Boolean) ?? [];

  // H3: 약점 패턴 주입 — candidateRecords에 해당하는 content_quality.issues 로드
  // (F1~F6, P1~P4, 내신탐구불일치 등 → 면접 공격 각도로 매핑)
  type QualityIssueInput = {
    recordType: string;
    subjectName?: string;
    grade?: number;
    issues: string[];
    feedback?: string;
  };
  const qualityIssues: QualityIssueInput[] = [];
  try {
    const setekIds = candidateRecords.filter(isCachedSetek).map((r) => r.id);
    const changcheIds = candidateRecords.filter((r) => !isCachedSetek(r)).map((r) => r.id);
    const { data: qualityRows } = await supabase
      .from("student_record_content_quality")
      .select("record_type, record_id, school_year, issues, feedback")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("source", "ai")
      .in("record_id", [...setekIds, ...changcheIds]);

    for (const row of qualityRows ?? []) {
      const issuesArr = Array.isArray(row.issues) ? (row.issues as string[]).filter((x) => typeof x === "string" && x.length > 0) : [];
      if (issuesArr.length === 0) continue;
      const rec = candidateRecords.find((r) => r.id === row.record_id);
      if (!rec) continue;
      qualityIssues.push({
        recordType: getRecordType(rec),
        subjectName: getSubjectLabel(rec),
        grade: rec.grade,
        issues: issuesArr,
        feedback: (row.feedback as string | null) ?? undefined,
      });
    }
  } catch (qErr) {
    logActionDebug(LOG_CTX, `content_quality 조회 실패 (면접 생성 계속): ${qErr}`);
  }

  // M2: 지원 대학 면접 포맷 주입 — student_record_applications × university_evaluation_criteria
  type AppliedUniversityInput = {
    universityName: string;
    department?: string;
    admissionType?: string;
    interviewFormat?: string;
    interviewDetails?: string;
  };
  let appliedUniversities: AppliedUniversityInput[] | undefined;
  try {
    const { data: apps } = await supabase
      .from("student_record_applications")
      .select("university_name, department, admission_type")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId);

    if (apps && apps.length > 0) {
      const univNames = Array.from(new Set(apps.map((a) => a.university_name as string).filter(Boolean)));
      const { data: criteria } = await supabase
        .from("university_evaluation_criteria")
        .select("university_name, interview_format, interview_details")
        .in("university_name", univNames);

      const critByName = new Map<string, { interview_format: string | null; interview_details: string | null }>();
      for (const c of criteria ?? []) {
        critByName.set(c.university_name as string, {
          interview_format: (c.interview_format as string | null) ?? null,
          interview_details: (c.interview_details as string | null) ?? null,
        });
      }

      appliedUniversities = apps.map((a) => {
        const crit = critByName.get(a.university_name as string);
        return {
          universityName: a.university_name as string,
          department: (a.department as string | null) ?? undefined,
          admissionType: (a.admission_type as string | null) ?? undefined,
          interviewFormat: crit?.interview_format ?? undefined,
          interviewDetails: crit?.interview_details ?? undefined,
        };
      });
      if (appliedUniversities.length === 0) appliedUniversities = undefined;
    }
  } catch (uErr) {
    logActionDebug(LOG_CTX, `지원 대학/면접 포맷 조회 실패 (면접 생성 계속): ${uErr}`);
  }

  // Phase δ-6: 활성 메인 탐구 섹션 (best-effort)
  const { fetchActiveMainExplorationSection, buildBlueprintContextSection } = await import("./helpers");
  const mainExplorationSection = await fetchActiveMainExplorationSection(studentId, tenantId);

  // Blueprint-Axis: blueprint 서사 기준 (면접: 서사 정합성 확인 질문 생성에 활용)
  const blueprintSection = buildBlueprintContextSection(ctx);
  const combinedMainExploration = [mainExplorationSection, blueprintSection]
    .filter(Boolean)
    .join("\n\n") || undefined;

  // 격차 A: midPlan / hakjongScore / S5 strategy 섹션 로드 (best-effort)
  const { buildMidPlanSynthesisSection, buildMidPlanByGradeSection } = await import("../../llm/mid-plan-guide-section");
  const { buildHakjongScoreSection } = await import("../../llm/hakjong-score-section");
  const { buildStrategySummarySection } = await import("../../llm/strategy-summary-section");
  const { resolveMidPlan } = await import("../orient/resolve-mid-plan");
  const { parseSnapshotHakjongScore } = await import("./snapshot-helpers");

  // midPlan: resolveMidPlan 헬퍼 (S2 — ctx.midPlan ?? ctx.results["_midPlan"])
  const midPlanSynthesisSection = buildMidPlanSynthesisSection(resolveMidPlan(ctx));
  // 격차 1 다학년 통합: belief.midPlanByGrade 학년별 MidPlan 분포
  const midPlanByGradeSection = buildMidPlanByGradeSection(ctx.belief.midPlanByGrade);

  // hakjongScore: findLatestSnapshot → parseSnapshotHakjongScore (S3 헬퍼)
  let hakjongScoreSection: string | undefined;
  try {
    const { findLatestSnapshot } = await import("@/lib/domains/student-record/repository/student-state-repository");
    const snap = await findLatestSnapshot(studentId, tenantId, supabase as Parameters<typeof findLatestSnapshot>[2]);
    hakjongScoreSection = buildHakjongScoreSection(parseSnapshotHakjongScore(snap?.snapshot_data) ?? null);
  } catch (snapErr) {
    logActionDebug(LOG_CTX, `hakjongScore snapshot 조회 실패 (면접 생성 계속): ${snapErr}`);
  }

  // S5 strategies: priority high 위주 5건 직렬화
  let strategySummarySection: string | undefined;
  try {
    const { calculateSchoolYear: getYear } = await import("@/lib/utils/schoolYear");
    const { data: strategyRows } = await supabase
      .from("student_record_strategies")
      .select("priority, target_area, strategy_content")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", getYear())
      .in("priority", ["critical", "high", "medium"])
      .order("priority")
      .limit(10);
    strategySummarySection = buildStrategySummarySection(strategyRows ?? []);
  } catch (stratErr) {
    logActionDebug(LOG_CTX, `strategies 조회 실패 (면접 생성 계속): ${stratErr}`);
  }

  // Phase B G2: hyperedge → 면접 질문 (best-effort)
  let hyperedgeSummarySection: string | undefined;
  try {
    const { findHyperedges } = await import("@/lib/domains/student-record/repository/hyperedge-repository");
    const { buildHyperedgeSummarySection } = await import("./helpers");
    const hyperedges = await findHyperedges(studentId, tenantId, { contexts: ["analysis"] });
    if (hyperedges.length > 0) {
      hyperedgeSummarySection = buildHyperedgeSummarySection(hyperedges) ?? undefined;
    }
  } catch (heErr) {
    logActionDebug(LOG_CTX, `hyperedge 조회 실패 (면접 생성 계속): ${heErr}`);
  }

  // Phase C A1: 직전 실행 gap_tracking.topBridges → 면접 질문 미해결 격차 반영 (best-effort)
  let interviewPreviousRunOutputsSection: string | undefined;
  try {
    const prevRun = ctx.belief.previousRunOutputs;
    if (prevRun?.runId) {
      const { getPreviousRunResult } = await import("../pipeline-previous-run");
      const prevGap = getPreviousRunResult<{
        bridgeCount: number;
        topBridges: Array<{
          themeLabel: string;
          urgency: string;
          targetGrade: number | null;
          sharedCompetencies: string[];
        }>;
      }>(prevRun, "gap_tracking");
      const bridges = prevGap?.topBridges ?? [];
      if (bridges.length > 0) {
        const lines = bridges.map((b) => {
          const grade = b.targetGrade ? `${b.targetGrade}학년` : "학년 미정";
          const comps = b.sharedCompetencies.slice(0, 3).join(", ");
          return `- [${b.urgency}] ${grade} "${b.themeLabel}" (역량: ${comps || "없음"})`;
        });
        interviewPreviousRunOutputsSection = [
          `## 직전 실행(${prevRun.completedAt?.slice(0, 10) ?? "이전"}) 미해결 격차`,
          "아래 bridge 제안 중 아직 해결되지 않은 항목을 겨냥한 면접 질문을 우선 생성.",
          ...lines,
        ].join("\n");
      }
    }
  } catch (iPrevErr) {
    logActionDebug(LOG_CTX, `직전 실행 gap 섹션 빌드 실패 (면접 생성 계속): ${iPrevErr}`);
  }

  // Phase C A2: 전 학년 반복 품질 패턴 → 면접 공격 각도 추가 (best-effort)
  let interviewQualityPatternsSection: string | undefined;
  try {
    const patterns = ctx.belief.qualityPatterns;
    if (patterns && patterns.length > 0) {
      const lines = patterns
        .slice(0, 5)
        .map((p) => `- ${p.pattern} (${p.count}회, 과목: ${p.subjects.join(", ")})`);
      interviewQualityPatternsSection = [
        `## 전 학년 반복 품질 패턴 (면접 집중 확인 대상)`,
        ...lines,
      ].join("\n");
    }
  } catch (iQualErr) {
    logActionDebug(LOG_CTX, `qualityPatterns 섹션 빌드 실패 (면접 생성 계속): ${iQualErr}`);
  }

  // Phase D2: 학년 지배 교과 교차 테마 → 면접 서사 정합성 질문 (best-effort).
  // 격차 4: Synthesis 단독 phase 이므로 단일 belief.gradeThemes 폴백 제거 (dead).
  let interviewGradeThemesSection: string | undefined;
  try {
    const { buildGradeThemesByGradeSection } = await import("./helpers");
    const built = buildGradeThemesByGradeSection(ctx.belief.gradeThemesByGrade);
    if (built) interviewGradeThemesSection = built;
  } catch (iGtErr) {
    logActionDebug(LOG_CTX, `gradeThemes 섹션 빌드 실패 (면접 생성 계속): ${iGtErr}`);
  }

  // Phase C A4: 세특 8단계 서사 완성도 → 부족 단계 겨냥 면접 질문 (best-effort)
  let interviewNarrativeArcSection: string | undefined;
  try {
    const { buildNarrativeArcDiagnosisSection } = await import(
      "@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section"
    );
    interviewNarrativeArcSection = await buildNarrativeArcDiagnosisSection(studentId, tenantId, supabase) ?? undefined;
  } catch (iNaErr) {
    logActionDebug(LOG_CTX, `narrativeArc 섹션 빌드 실패 (면접 생성 계속): ${iNaErr}`);
  }

  // Phase C A6: 학생 정체성 프로필 카드 → 관심 일관성·강점 검증 면접 질문 (best-effort)
  const interviewProfileCardSection: string | undefined =
    ctx.belief.profileCard && ctx.belief.profileCard.trim().length > 0
      ? ctx.belief.profileCard
      : undefined;

  // M1-c W5 (2026-04-27): mainTheme + cascadePlan 통합 섹션
  let mainThemeCascadeSection: string | undefined;
  if (ctx.belief.mainTheme || ctx.belief.cascadePlan) {
    const { buildMainThemeCascadeSection } = await import("./helpers");
    const built = buildMainThemeCascadeSection({
      mainTheme: ctx.belief.mainTheme,
      cascadePlan: ctx.belief.cascadePlan,
    });
    if (built.trim().length > 0) mainThemeCascadeSection = built;
  }

  // ============================================
  // Synthesis cache (M1-c W6, 2026-04-28)
  // ============================================
  const interviewInput = {
    content: mainContent,
    recordType: mainType,
    subjectName: mainSubject ?? "",
    grade: main.grade,
    additionalRecordsKey: (additionalRecords ?? []).map((r) => `${r.recordType}|${r.grade}|${(r.content ?? "").length}`).sort(),
    diagnosticWeaknesses: [...(diagWeaknesses ?? [])].sort(),
    careerContext: careerContext ?? "",
    weakCompetenciesKey: (weakCompetencies ?? []).map((c) => `${c.item}|${c.grade}`).sort(),
    existingQuestionsKey: [...(existingQuestions ?? [])].sort(),
    qualityIssuesKey: (qualityIssues ?? []).map((q) => `${q.recordType}|${q.subjectName ?? ""}|${q.issues.length}`).sort(),
    appliedUniversitiesKey: (appliedUniversities ?? []).map((u) => `${u.universityName}|${u.department ?? ""}`).sort(),
    mainExplorationSection: combinedMainExploration ?? "",
    midPlanSynthesisSection: midPlanSynthesisSection ?? "",
    midPlanByGradeSection: midPlanByGradeSection ?? "",
    hakjongScoreSection: hakjongScoreSection ?? "",
    strategySummarySection: strategySummarySection ?? "",
    hyperedgeSummarySection: hyperedgeSummarySection ?? "",
    previousRunOutputsSection: interviewPreviousRunOutputsSection ?? "",
    qualityPatternsSection: interviewQualityPatternsSection ?? "",
    gradeThemesSection: interviewGradeThemesSection ?? "",
    narrativeArcSection: interviewNarrativeArcSection ?? "",
    profileCardSection: interviewProfileCardSection ?? "",
    mainThemeCascadeSection: mainThemeCascadeSection ?? "",
  };
  const inputHash = computeSynthesisInputHash(interviewInput as unknown as Record<string, unknown>);

  type CachedInterviewResult = {
    inputHash: string;
    totalCount: number;
    byType: Record<string, number>;
    topQuestions: Array<{ question: string; questionType: string; difficulty: string; sourceType: string }>;
  };
  const cached = tryReusePreviousResult<CachedInterviewResult>(
    ctx.belief.previousRunOutputs,
    "interview_generation",
    inputHash,
  );
  if (cached) {
    // 직전 ai-generated interview 질문이 살아있는지 확인
    const { count: aliveCount } = await supabase
      .from("student_record_interview_questions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("is_ai_generated", true);
    if ((aliveCount ?? 0) > 0) {
      return {
        preview: `면접 질문 캐시 적중 — LLM 호출 생략 (${aliveCount}건 유지)`,
        result: { ...cached, inputHash, totalCount: aliveCount ?? cached.totalCount },
      };
    }
  }

  const result = await generateInterviewQuestions({
    content: mainContent,
    recordType: mainType,
    subjectName: mainSubject,
    grade: main.grade,
    additionalRecords,
    diagnosticWeaknesses: diagWeaknesses,
    careerContext,
    weakCompetencies,
    existingQuestions: existingQuestions.length > 0 ? existingQuestions : undefined,
    qualityIssues: qualityIssues.length > 0 ? qualityIssues : undefined,
    appliedUniversities,
    mainExplorationSection: combinedMainExploration,
    midPlanSynthesisSection,
    midPlanByGradeSection,
    hakjongScoreSection,
    strategySummarySection,
    hyperedgeSummarySection,
    previousRunOutputsSection: interviewPreviousRunOutputsSection,
    qualityPatternsSection: interviewQualityPatternsSection,
    gradeThemesSection: interviewGradeThemesSection,
    narrativeArcSection: interviewNarrativeArcSection,
    profileCardSection: interviewProfileCardSection,
    mainThemeCascadeSection,
  });

  if (!result.success) throw new Error(result.error);

  // DB 저장: AI 질문은 재실행 시 전량 교체 (roadmap_generation 패턴과 동일)
  // 과거에 upsert + onConflict="student_id,question"을 사용했으나, 해당 UNIQUE 인덱스가
  // 없어 42P10 에러로 모든 insert가 rollback되던 이슈 수정.
  const questions = result.data.questions ?? [];
  if (questions.length === 0) {
    return "LLM 응답 없음 — 0건";
  }

  // 기존 AI 생성 질문만 삭제 (수동 입력 질문은 보존)
  const { error: delErr } = await supabase
    .from("student_record_interview_questions")
    .delete()
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("is_ai_generated", true);
  if (delErr) {
    throw new Error(`기존 AI 면접 질문 삭제 실패: ${delErr.message}`);
  }

  const { error: insertErr } = await supabase
    .from("student_record_interview_questions")
    .insert(
      questions.map((q) => ({
        student_id: studentId,
        tenant_id: tenantId,
        question: q.question,
        question_type: q.questionType,
        suggested_answer: q.suggestedAnswer ?? null,
        difficulty: q.difficulty,
        source_type: mainType,
        is_ai_generated: true,
      })),
    );
  if (insertErr) {
    throw new Error(`면접 질문 저장 실패: ${insertErr.message}`);
  }

  // Cross-run: 다음 실행 activity_summary 가 "질문이 많이 나왔던 활동 우선" 맥락 확보.
  const byType: Record<string, number> = {};
  for (const q of questions) byType[q.questionType] = (byType[q.questionType] ?? 0) + 1;
  // hard 우선, 이어서 medium, easy — 변별력 있는 질문부터.
  const difficultyRank: Record<string, number> = { hard: 0, medium: 1, easy: 2 };
  const topQuestions = [...questions]
    .sort(
      (a, b) => (difficultyRank[a.difficulty] ?? 3) - (difficultyRank[b.difficulty] ?? 3),
    )
    .slice(0, 10)
    .map((q) => ({
      question: q.question,
      questionType: q.questionType,
      difficulty: q.difficulty,
      sourceType: mainType,
    }));

  return {
    preview: `${questions.length}건 면접 질문 생성`,
    result: {
      totalCount: questions.length,
      byType,
      topQuestions,
      // M1-c W6 (2026-04-28): synthesis cache 키
      inputHash,
    },
  };
}

// ============================================
// 14. 로드맵 자동 생성
// ============================================

export async function runRoadmapGeneration(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { supabase, studentId, tenantId, pipelineId, studentGrade } = ctx;

  // Phase R1: LLM 기반 로드맵 생성 (planning/analysis 자동 감지)
  const { generateAiRoadmap } = await import("../../llm/actions/generateRoadmap");
  // NEIS 기반 모드 판정: neisGrades가 있으면 실 데이터 분석 모드, 없으면 수강계획 기반 계획 모드
  const llmMode = (ctx.neisGrades && ctx.neisGrades.length > 0) ? "analysis" : "planning";

  // 격차 B: midPlan / hakjongScore / S5 strategy 섹션 로드 (best-effort — interview와 동일 패턴)
  const { buildMidPlanSynthesisSection: buildMPSection, buildMidPlanByGradeSection: buildMPByGradeSection } = await import("../../llm/mid-plan-guide-section");
  const { buildHakjongScoreSection: buildHJSection } = await import("../../llm/hakjong-score-section");
  const { buildStrategySummarySection: buildStSection } = await import("../../llm/strategy-summary-section");
  const { resolveMidPlan: resolveMP } = await import("../orient/resolve-mid-plan");
  const { parseSnapshotHakjongScore: parseHJ } = await import("./snapshot-helpers");

  const roadmapMidPlanSection = buildMPSection(resolveMP(ctx));
  // 격차 1 다학년 통합: belief.midPlanByGrade
  const roadmapMidPlanByGradeSection = buildMPByGradeSection(ctx.belief.midPlanByGrade);

  let roadmapHakjongSection: string | undefined;
  try {
    const { findLatestSnapshot } = await import("@/lib/domains/student-record/repository/student-state-repository");
    const snap = await findLatestSnapshot(studentId, tenantId, supabase as Parameters<typeof findLatestSnapshot>[2]);
    roadmapHakjongSection = buildHJSection(parseHJ(snap?.snapshot_data) ?? null);
  } catch (rSnapErr) {
    logActionDebug(LOG_CTX, `roadmap hakjongScore 조회 실패 (로드맵 생성 계속): ${rSnapErr}`);
  }

  let roadmapStrategySection: string | undefined;
  try {
    const { calculateSchoolYear: getRYear } = await import("@/lib/utils/schoolYear");
    const { data: rStrategyRows } = await supabase
      .from("student_record_strategies")
      .select("priority, target_area, strategy_content")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("school_year", getRYear())
      .in("priority", ["critical", "high", "medium"])
      .order("priority")
      .limit(10);
    roadmapStrategySection = buildStSection(rStrategyRows ?? []);
  } catch (rStratErr) {
    logActionDebug(LOG_CTX, `roadmap strategies 조회 실패 (로드맵 생성 계속): ${rStratErr}`);
  }

  // Phase C A1: 직전 실행 gap_tracking.topBridges → 로드맵 미해결 격차 반영 (best-effort)
  let roadmapPreviousRunOutputsSection: string | undefined;
  try {
    const prevRun = ctx.belief.previousRunOutputs;
    if (prevRun?.runId) {
      const { getPreviousRunResult: getRoadmapPrevResult } = await import("../pipeline-previous-run");
      const prevGap = getRoadmapPrevResult<{
        bridgeCount: number;
        topBridges: Array<{
          themeLabel: string;
          urgency: string;
          targetGrade: number | null;
          sharedCompetencies: string[];
        }>;
      }>(prevRun, "gap_tracking");
      const bridges = prevGap?.topBridges ?? [];
      if (bridges.length > 0) {
        const lines = bridges.map((b) => {
          const grade = b.targetGrade ? `${b.targetGrade}학년` : "학년 미정";
          const comps = b.sharedCompetencies.slice(0, 3).join(", ");
          return `- [${b.urgency}] ${grade} "${b.themeLabel}" (역량: ${comps || "없음"})`;
        });
        roadmapPreviousRunOutputsSection = [
          `## 직전 실행(${prevRun.completedAt?.slice(0, 10) ?? "이전"}) 미해결 격차`,
          "아래 bridge 제안 중 아직 해결되지 않은 항목을 보완하는 활동을 로드맵에 포함.",
          ...lines,
        ].join("\n");
      }
    }
  } catch (rPrevErr) {
    logActionDebug(LOG_CTX, `직전 실행 gap 섹션 빌드 실패 (로드맵 생성 계속): ${rPrevErr}`);
  }

  // Phase C A2: 전 학년 반복 품질 패턴 → 로드맵 패턴 개선 활동 추가 (best-effort)
  let roadmapQualityPatternsSection: string | undefined;
  try {
    const rPatterns = ctx.belief.qualityPatterns;
    if (rPatterns && rPatterns.length > 0) {
      const lines = rPatterns
        .slice(0, 5)
        .map((p) => `- ${p.pattern} (${p.count}회, 과목: ${p.subjects.join(", ")})`);
      roadmapQualityPatternsSection = [
        `## 전 학년 반복 품질 패턴 (로드맵 개선 대상)`,
        ...lines,
      ].join("\n");
    }
  } catch (rQualErr) {
    logActionDebug(LOG_CTX, `qualityPatterns 섹션 빌드 실패 (로드맵 생성 계속): ${rQualErr}`);
  }

  // Phase D2: 학년 지배 교과 교차 테마 → 로드맵 학기별 배치에 반영 (best-effort).
  // 격차 4: Synthesis 단독 phase 이므로 단일 belief.gradeThemes 폴백 제거 (dead).
  let roadmapGradeThemesSection: string | undefined;
  try {
    const { buildGradeThemesByGradeSection } = await import("./helpers");
    const built = buildGradeThemesByGradeSection(ctx.belief.gradeThemesByGrade);
    if (built) roadmapGradeThemesSection = built;
  } catch (rGtErr) {
    logActionDebug(LOG_CTX, `gradeThemes 섹션 빌드 실패 (로드맵 생성 계속): ${rGtErr}`);
  }

  // Phase C A4: 세특 8단계 서사 완성도 → 부족 단계 보완 활동 로드맵 추가 (best-effort)
  let roadmapNarrativeArcSection: string | undefined;
  try {
    const { buildNarrativeArcDiagnosisSection } = await import(
      "@/lib/domains/record-analysis/llm/narrative-arc-diagnosis-section"
    );
    roadmapNarrativeArcSection = await buildNarrativeArcDiagnosisSection(studentId, tenantId, supabase) ?? undefined;
  } catch (rNaErr) {
    logActionDebug(LOG_CTX, `narrativeArc 섹션 빌드 실패 (로드맵 생성 계속): ${rNaErr}`);
  }

  // Phase C A5: hyperedge(N-ary 수렴 테마) → 로드맵 통합 테마 심화 활동 (best-effort)
  let roadmapHyperedgeSummarySection: string | undefined;
  try {
    const { findHyperedges: findRoadmapHyperedges } = await import("@/lib/domains/student-record/repository/hyperedge-repository");
    const { buildHyperedgeSummarySection: buildRoadmapHyperedgeSection } = await import("./helpers");
    const roadmapHyperedges = await findRoadmapHyperedges(studentId, tenantId, { contexts: ["analysis"] });
    if (roadmapHyperedges.length > 0) {
      roadmapHyperedgeSummarySection = buildRoadmapHyperedgeSection(roadmapHyperedges) ?? undefined;
    }
  } catch (rHeErr) {
    logActionDebug(LOG_CTX, `hyperedge 조회 실패 (로드맵 생성 계속): ${rHeErr}`);
  }

  // Phase C A6: 학생 정체성 프로필 카드 → 로드맵 활동 방향 정렬 (best-effort)
  const roadmapProfileCardSection: string | undefined =
    ctx.belief.profileCard && ctx.belief.profileCard.trim().length > 0
      ? ctx.belief.profileCard
      : undefined;

  // M1-c W5 (2026-04-27): mainTheme + cascadePlan → 로드맵 학기별 활동 정렬
  let roadmapMainThemeCascadeSection: string | undefined;
  if (ctx.belief.mainTheme || ctx.belief.cascadePlan) {
    try {
      const { buildMainThemeCascadeSection } = await import("./helpers");
      const built = buildMainThemeCascadeSection({
        mainTheme: ctx.belief.mainTheme,
        cascadePlan: ctx.belief.cascadePlan,
      });
      if (built.trim().length > 0) roadmapMainThemeCascadeSection = built;
    } catch {
      // best-effort
    }
  }

  // ============================================
  // Synthesis cache (M1-c W6, 2026-04-28)
  // ============================================
  const roadmapInputHash = computeSynthesisInputHash({
    studentId,
    llmMode,
    midPlanSynthesisSection: roadmapMidPlanSection ?? "",
    midPlanByGradeSection: roadmapMidPlanByGradeSection ?? "",
    hakjongScoreSection: roadmapHakjongSection ?? "",
    strategySummarySection: roadmapStrategySection ?? "",
    previousRunOutputsSection: roadmapPreviousRunOutputsSection ?? "",
    qualityPatternsSection: roadmapQualityPatternsSection ?? "",
    gradeThemesSection: roadmapGradeThemesSection ?? "",
    narrativeArcSection: roadmapNarrativeArcSection ?? "",
    hyperedgeSummarySection: roadmapHyperedgeSummarySection ?? "",
    profileCardSection: roadmapProfileCardSection ?? "",
    mainThemeCascadeSection: roadmapMainThemeCascadeSection ?? "",
  });

  type CachedRoadmapResult = {
    inputHash: string;
    mode: string;
    itemCount: number;
    items: Array<{ grade: number; semester: number | null; area: string }>;
  };
  const cachedRoadmap = tryReusePreviousResult<CachedRoadmapResult>(
    ctx.belief.previousRunOutputs,
    "roadmap_generation",
    roadmapInputHash,
  );
  if (cachedRoadmap) {
    // 직전 [AI] 로드맵 row 가 살아있는지 확인
    const aliveRoadmap = await repository.findAllRoadmapItemsByStudent(studentId, tenantId);
    const aliveAi = aliveRoadmap.filter((r) => r.plan_content.startsWith("[AI]"));
    if (aliveAi.length > 0) {
      return {
        preview: `로드맵 캐시 적중 — LLM 호출 생략 (${aliveAi.length}건 유지)`,
        result: { ...cachedRoadmap, inputHash: roadmapInputHash, itemCount: aliveAi.length },
      };
    }
  }

  const llmResult = await generateAiRoadmap(studentId, llmMode, {
    midPlanSynthesisSection: roadmapMidPlanSection,
    midPlanByGradeSection: roadmapMidPlanByGradeSection,
    hakjongScoreSection: roadmapHakjongSection,
    strategySummarySection: roadmapStrategySection,
    previousRunOutputsSection: roadmapPreviousRunOutputsSection,
    qualityPatternsSection: roadmapQualityPatternsSection,
    gradeThemesSection: roadmapGradeThemesSection,
    narrativeArcSection: roadmapNarrativeArcSection,
    hyperedgeSummarySection: roadmapHyperedgeSummarySection,
    profileCardSection: roadmapProfileCardSection,
    mainThemeCascadeSection: roadmapMainThemeCascadeSection,
  });
  if (llmResult.success && llmResult.data) {
    // Cross-run: 다음 실행 storyline_generation 이 "과거 계획 대비 진척" 서사 힌트로 활용.
    const items = llmResult.data.items.map((it) => ({
      grade: it.grade,
      semester: it.semester,
      area: it.area,
    }));
    return {
      preview: `${llmResult.data.items.length}건 AI 로드맵 (${llmMode})`,
      result: {
        mode: llmMode,
        itemCount: llmResult.data.items.length,
        items,
        // M1-c W6 (2026-04-28): synthesis cache 키
        inputHash: roadmapInputHash,
      },
    };
  }

  // LLM 실패 → 규칙 기반 fallback
  logActionDebug(LOG_CTX, `roadmap LLM 실패 → rule-based fallback: ${"error" in llmResult ? llmResult.error : "unknown"}`, { pipelineId });

  const currentSchoolYear = calculateSchoolYear();
  const [storylines, setekGuidesRes, diagnosis] = await Promise.all([
    repository.findStorylinesByStudent(studentId, tenantId),
    (async () => {
      const { fetchSetekGuides } = await import("@/lib/domains/student-record/actions/activitySummary");
      return fetchSetekGuides(studentId).catch(() => ({ success: false as const, error: "" }));
    })(),
    diagnosisRepo.findDiagnosis(studentId, currentSchoolYear, tenantId, "ai"),
  ]);

  if (storylines.length === 0 && !diagnosis) {
    return "스토리라인/진단 없음 — 건너뜀";
  }

  const existing = await repository.findAllRoadmapItemsByStudent(studentId, tenantId);
  const aiItems = existing.filter((r) => r.plan_content.startsWith("[AI]"));
  await Promise.allSettled(aiItems.map((r) => repository.deleteRoadmapItemById(r.id)));

  const setekGuides = setekGuidesRes.success && setekGuidesRes.data ? setekGuidesRes.data : [];
  const roadmapItems: Array<{ area: string; plan_content: string; plan_keywords: string[]; grade: number; semester: number | null; storyline_id: string | null }> = [];

  for (const sl of storylines) {
    for (const { grade, theme } of [
      { grade: 1, theme: sl.grade_1_theme },
      { grade: 2, theme: sl.grade_2_theme },
      { grade: 3, theme: sl.grade_3_theme },
    ].filter((t) => t.theme)) {
      roadmapItems.push({ area: "setek", plan_content: `[AI] ${sl.title} — ${theme}`, plan_keywords: sl.keywords ?? [], grade, semester: null, storyline_id: sl.id });
    }
  }

  for (const guide of setekGuides) {
    if (!guide.direction) continue;
    const guideGrade = guide.school_year ? studentGrade - (currentSchoolYear - guide.school_year) : studentGrade;
    const effectiveGrade = (guideGrade >= 1 && guideGrade <= 3) ? guideGrade : studentGrade;
    roadmapItems.push({ area: "setek", plan_content: `[AI] 세특방향: ${guide.direction.slice(0, 100)}`, plan_keywords: guide.keywords ?? [], grade: effectiveGrade, semester: null, storyline_id: null });
  }

  const improvements = Array.isArray(diagnosis?.improvements) ? (diagnosis.improvements as Array<{ priority: string; area: string; action: string }>) : [];
  if (improvements.length > 0) {
    const priorityOrder = { "높음": 0, "중간": 1, "낮음": 2 } as Record<string, number>;
    for (const imp of [...improvements].sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)).slice(0, 3)) {
      roadmapItems.push({ area: "general", plan_content: `[AI] [${imp.priority}] ${imp.area}: ${imp.action}`, plan_keywords: [], grade: studentGrade, semester: null, storyline_id: null });
    }
  } else {
    for (const weakness of ((diagnosis?.weaknesses as string[]) ?? []).slice(0, 3)) {
      roadmapItems.push({ area: "general", plan_content: `[AI] 보완: ${weakness}`, plan_keywords: [], grade: studentGrade, semester: null, storyline_id: null });
    }
  }

  if (roadmapItems.length === 0) return "생성 가능한 로드맵 없음";

  let savedCount = 0;
  const baseSortOrder = existing.filter((r) => !r.plan_content.startsWith("[AI]")).length;
  await Promise.allSettled(
    roadmapItems.map((item, i) =>
      repository.insertRoadmapItem({ tenant_id: tenantId, student_id: studentId, school_year: currentSchoolYear, grade: item.grade, semester: item.semester, area: item.area, plan_content: item.plan_content, plan_keywords: item.plan_keywords, storyline_id: item.storyline_id, sort_order: baseSortOrder + i }).then(() => { savedCount++; }),
    ),
  );
  // Cross-run: fallback 경로도 동일한 계약 — semester null 은 0 으로 정규화하여 노출.
  const fallbackItems = roadmapItems.map((it) => ({
    grade: it.grade,
    semester: it.semester ?? 0,
    area: it.area,
  }));
  return {
    preview: `${savedCount}건 로드맵 생성 (fallback)`,
    result: {
      mode: "fallback",
      itemCount: savedCount,
      items: fallbackItems,
    },
  };
}
