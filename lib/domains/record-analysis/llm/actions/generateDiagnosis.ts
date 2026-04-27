"use server";

// ============================================
// AI 종합 진단 생성 Server Action
// 역량 등급 + 루브릭 질문별 상세 + 태그 + 성적추이 + 교과이수적합도
// → 강점/약점/추천전공 자동 도출
// NEIS 데이터 없는 경우: 수강계획 기반 예비 진단으로 자동 전환
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { extractJson } from "../extractJson";
import { withRetry } from "../retry";
import type { CompetencyScore, ActivityTag } from "@/lib/domains/student-record/types";
import {
  buildGradesSummary,
  buildTagsByItem,
  buildTagsSummary,
  buildTrendSection,
  buildAdequacySection,
  buildGapSection,
  buildCoursePlanSection,
  buildDiagnosisSystemPrompt,
  buildDiagnosisUserPrompt,
} from "../prompts/diagnosisPrompt";
import {
  generateStrengthsFallback,
  generateWeaknessesFallback,
  parseImprovements,
  generateImprovementsFallback,
  generateProspectiveDiagnosisInternal,
} from "./diagnosis-helpers";
// 타입은 diagnosis-helpers.ts에서 직접 import하여 사용
// NOTE: "use server" 모듈에서는 type re-export 금지 (런타임 ReferenceError 유발)
// 외부에서 이 타입이 필요하면 diagnosis-helpers.ts에서 직접 import할 것
import type { DiagnosisImprovement, DiagnosisEnrichedContext, CoursePlanContext } from "./diagnosis-helpers";

const LOG_CTX = { domain: "record-analysis", action: "generateDiagnosis" };

/**
 * L3-C: 진단 LLM이 서술 과정에서 추론한 동적 cross-reference.
 * 레코드 ID 대신 라벨을 사용하며, 서버에서 라벨→ID로 resolve한 뒤 insertEdges()로 저장.
 */
export interface DiagnosisInferredEdge {
  sourceLabel: string;
  targetLabel: string;
  edgeType: string;
  reason: string;
  sharedCompetencies?: string[];
}

export interface DiagnosisGenerationResult {
  overallGrade: string;
  recordDirection: string;
  directionStrength: "strong" | "moderate" | "weak";
  directionReasoning: string;
  strengths: string[];
  weaknesses: string[];
  improvements: DiagnosisImprovement[];
  recommendedMajors: string[];
  strategyNotes: string;
  inferredEdges?: DiagnosisInferredEdge[];
  warnings?: string[];
}

export async function generateAiDiagnosis(
  competencyScores: CompetencyScore[],
  activityTags: ActivityTag[],
  studentInfo?: { targetMajor?: string; schoolName?: string; studentId?: string },
  edgeSummarySection?: string,
  enrichedContext?: DiagnosisEnrichedContext,
  /** 엣지의 shared_competencies에서 집계한 역량별 연결 빈도 (P2-1: 고립 역량 약점) */
  edgeCompetencyFreq?: Map<string, number>,
  /**
   * NEIS 데이터가 없는 경우(scores/tags 0건) 수강계획 기반 예비 진단으로 자동 전환.
   * 제공하지 않으면 기존대로 "역량 데이터 없음" 에러 반환.
   */
  coursePlanContext?: CoursePlanContext,
  /**
   * 전 학년 세특/창체/행특 품질 패턴 집계 섹션 (마크다운 문자열).
   * aggregateQualityPatterns()가 생성한 섹션을 그대로 전달. 없으면 생략.
   */
  qualityPatternSection?: string,
  /**
   * H1 후속: 전 학년 cross-subject theme 집계 섹션 (마크다운 문자열).
   * buildCrossSubjectThemesDiagnosisSection()이 생성한 섹션을 전달. 없으면 생략.
   */
  crossSubjectThemesSection?: string,
  /**
   * Phase δ-6 (G11): 활성 메인 탐구 섹션 (마크다운 문자열).
   * buildMainExplorationSection()이 생성한 섹션을 전달. 없으면 생략.
   */
  mainExplorationSection?: string,
  /**
   * S2 narrative_arc_extraction 산출물 기반 8단계 서사 완성도 섹션 (마크다운 문자열).
   * buildNarrativeArcDiagnosisSection()이 생성한 섹션을 전달. 없으면 생략.
   */
  narrativeArcSection?: string,
  /**
   * β 격차 1: MidPipeline Planner 메타 판정 섹션 (buildMidPlanSynthesisSection() 결과).
   * focusHypothesis / concernFlags 를 진단 방향에 반영하기 위해 주입한다. 없으면 생략.
   */
  midPlanSynthesisSection?: string,
  /**
   * 격차 1 다학년 통합: buildMidPlanByGradeSection() 결과.
   * 전 학년 탐구 축 연속성을 진단에 반영. 없으면 생략.
   */
  midPlanByGradeSection?: string,
  /**
   * 격차 6: 학종 3요소 통합 점수 섹션 (buildHakjongScoreSection() 결과).
   * α2 Reward 엔진이 계산한 학업/진로/공동체 0~100 점수. 없으면 생략.
   */
  hakjongScoreSection?: string,
  /** Phase B G3: gradeThemes 섹션 (buildGradeThemesSection() 결과). 없으면 생략. */
  gradeThemesSection?: string,
  /** Phase B G2: hyperedge 요약 섹션 (buildHyperedgeSummarySection() 결과). 없으면 생략. */
  hyperedgeSummarySection?: string,
  /** Phase B G5: 학생 정체성 프로필 카드 텍스트 (ctx.belief.profileCard). 없으면 생략. */
  profileCardSection?: string,
): Promise<{ success: true; data: DiagnosisGenerationResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (competencyScores.length === 0 && activityTags.length === 0) {
      // NEIS 데이터 없음 — 수강계획 컨텍스트가 있으면 예비 진단으로 전환
      if (coursePlanContext) {
        return generateProspectiveDiagnosisInternal(coursePlanContext);
      }
      return { success: false, error: "역량 등급이나 활동 태그 데이터가 없습니다. 먼저 역량 분석을 실행해주세요." };
    }

    // enrichedContext 자동 조회: studentId가 있고 enrichedContext가 없으면 DB에서 조립
    if (!enrichedContext && studentInfo?.studentId) {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();

      // 성적 추이
      type TrendRow = { subject: { name: string } | null; rank_grade: number | null; grade: number | null; semester: number | null };
      const { data: trendRows } = await supabase
        .from("student_internal_scores")
        .select("subject:subject_id(name), rank_grade, grade, semester")
        .eq("student_id", studentInfo.studentId)
        .order("grade")
        .order("semester")
        .returns<TrendRow[]>();
      const typedTrendRows = trendRows ?? [];
      const gradeTrend = typedTrendRows
        .filter((s) => s.rank_grade != null)
        .map((s) => ({
          grade: s.grade ?? 1,
          semester: s.semester ?? 1,
          subjectName: s.subject?.name ?? "",
          rankGrade: s.rank_grade!,
        }));

      // 교과이수적합도
      let courseAdequacy: DiagnosisEnrichedContext["courseAdequacy"] = null;
      if (studentInfo.targetMajor) {
        const { calculateCourseAdequacy } = await import("@/lib/domains/student-record/course-adequacy");
        const { calculateSchoolYear, getCurriculumYear } = await import("@/lib/utils/schoolYear");
        const { data: student } = await supabase
          .from("students")
          .select("grade")
          .eq("id", studentInfo.studentId)
          .maybeSingle();
        const studentGrade = (student?.grade as number) ?? 3;
        const enrollYear = calculateSchoolYear() - studentGrade + 1;
        const curYear = getCurriculumYear(enrollYear);
        const takenNames = [...new Set(gradeTrend.map((s: { subjectName: string }) => s.subjectName))];
        const result = calculateCourseAdequacy(studentInfo.targetMajor, takenNames, null, curYear);
        if (result) {
          courseAdequacy = {
            score: result.score,
            majorCategory: result.majorCategory,
            taken: result.taken,
            notTaken: result.notTaken,
            notOffered: result.notOffered,
            generalRate: result.generalRate,
            careerRate: result.careerRate,
            fusionRate: result.fusionRate,
          };
        }
      }

      enrichedContext = { gradeTrend, courseAdequacy };
    }

    // ── 프롬프트 데이터 조립 ──
    const { gradesSummary, rubricGaps } = buildGradesSummary(competencyScores);
    const tagsByItem = buildTagsByItem(activityTags);
    const tagsSummary = buildTagsSummary(activityTags, tagsByItem);
    const trendSection = buildTrendSection(enrichedContext);
    const adequacySection = buildAdequacySection(enrichedContext);
    const gapSection = buildGapSection(rubricGaps);
    const coursePlanSection = buildCoursePlanSection(coursePlanContext?.coursePlanData);

    // ── 시스템 프롬프트 ──
    const systemPrompt = buildDiagnosisSystemPrompt();

    // ── 사용자 프롬프트 ──
    // B1: NEIS 데이터 없이 수강계획만 있으면 prospective 프레임 활성화
    const isProspective = !!coursePlanContext && competencyScores.every((s) => s.source === "ai_projected");
    const userPrompt = buildDiagnosisUserPrompt({
      studentInfo,
      activityTags,
      gradesSummary,
      tagsSummary,
      trendSection,
      adequacySection,
      gapSection,
      edgeSummarySection,
      qualityPatternSection,
      crossSubjectThemesSection,
      coursePlanSection,
      mainExplorationSection,
      narrativeArcSection,
      midPlanSynthesisSection,
      midPlanByGradeSection,
      hakjongScoreSection,
      gradeThemesSection,
      hyperedgeSummarySection,
      profileCardSection,
      isProspective,
    });

    // Q2: 입력 복잡도 기반 모델 선택 — 태그 20개+ 또는 점수 8개+ → standard, 그 외 fast
    const inputComplexity = competencyScores.length + activityTags.length;
    const diagModelTier = inputComplexity >= 20 ? "standard" : "fast";

    const result = await withRetry(
      () => generateTextWithRateLimit({
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: diagModelTier,
        temperature: 0.3,
        maxTokens: 4000,
        responseFormat: "json",
      }),
      { label: "generateAiDiagnosis" },
    );

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJson<Record<string, unknown>>(result.content);
    } catch {
      return { success: false, error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요." };
    }

    if (!parsed || typeof parsed !== "object") {
      return { success: false, error: "AI 응답 형식이 올바르지 않습니다." };
    }

    const validGrades = new Set(["A+", "A-", "B+", "B", "B-", "C"]);
    const validStrengths = new Set(["strong", "moderate", "weak"]);

    const gradeFallback = !(typeof parsed.overallGrade === "string" && validGrades.has(parsed.overallGrade));
    const strengthFallback = !(typeof parsed.directionStrength === "string" && validStrengths.has(parsed.directionStrength));

    let aiStrengths = Array.isArray(parsed.strengths) ? parsed.strengths.filter((s): s is string => typeof s === "string" && s.length > 0) : [];
    let aiWeaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter((s): s is string => typeof s === "string" && s.length > 0) : [];

    const warnings: string[] = [];
    if (!edgeSummarySection) warnings.push("영역간 연결 분석 없이 생성되었습니다 (엣지 데이터 미제공)");
    if (gradeFallback) warnings.push("종합등급이 기본값(B)으로 설정되었습니다");
    if (strengthFallback) warnings.push("방향 강도가 기본값(보통)으로 설정되었습니다");

    // ── P0: 강점/약점 빈 배열 방어 — 프로그래밍 방식 fallback ──
    if (aiStrengths.length < 3) {
      const generated = generateStrengthsFallback(competencyScores, tagsByItem);
      aiStrengths = [...aiStrengths, ...generated].slice(0, 5);
      if (generated.length > 0) warnings.push(`강점 ${generated.length}건이 자동 생성되었습니다`);
    }
    if (aiWeaknesses.length < 2) {
      const generated = generateWeaknessesFallback(competencyScores, tagsByItem, rubricGaps, enrichedContext, edgeCompetencyFreq);
      aiWeaknesses = [...aiWeaknesses, ...generated].slice(0, 4);
      if (generated.length > 0) warnings.push(`약점 ${generated.length}건이 자동 생성되었습니다`);
    }

    // improvements 파싱 (신규 필드) + fallback
    let aiImprovements = parseImprovements(parsed.improvements);
    if (aiImprovements.length < 2) {
      const generated = generateImprovementsFallback(competencyScores, tagsByItem, rubricGaps, enrichedContext);
      aiImprovements = [...aiImprovements, ...generated].slice(0, 5);
      if (generated.length > 0) warnings.push(`개선전략 ${generated.length}건이 자동 생성되었습니다`);
    }

    if (warnings.length > 0) {
      logActionWarn(LOG_CTX, "AI 진단 응답에 fallback 적용", {
        gradeFallback: gradeFallback ? `"${String(parsed.overallGrade)}" → "B"` : null,
        strengthFallback: strengthFallback ? `"${String(parsed.directionStrength)}" → "moderate"` : null,
        strengthsCount: aiStrengths.length,
        weaknessesCount: aiWeaknesses.length,
      });
    }

    // L3-C: inferredEdges 파싱 — LLM이 진단 근거로 언급한 연결만 추출.
    // 라벨 기반 (레코드 ID 불필요), 서버에서 이후 ID resolve.
    const inferredEdges: DiagnosisInferredEdge[] = [];
    if (Array.isArray(parsed.inferredEdges)) {
      const allowedTypes = new Set([
        "TEACHER_VALIDATION", "COMPETENCY_SHARED", "COURSE_SUPPORTS",
        "TEMPORAL_GROWTH", "CONTENT_REFERENCE", "READING_ENRICHES", "THEME_CONVERGENCE",
      ]);
      for (const raw of parsed.inferredEdges) {
        if (!raw || typeof raw !== "object") continue;
        const e = raw as Record<string, unknown>;
        const sourceLabel = typeof e.sourceLabel === "string" ? e.sourceLabel.trim() : "";
        const targetLabel = typeof e.targetLabel === "string" ? e.targetLabel.trim() : "";
        const edgeType = typeof e.edgeType === "string" ? e.edgeType : "";
        const reason = typeof e.reason === "string" ? e.reason.trim() : "";
        if (!sourceLabel || !targetLabel || !edgeType || !reason) continue;
        if (!allowedTypes.has(edgeType)) continue;
        if (sourceLabel === targetLabel) continue;
        const sharedCompetencies = Array.isArray(e.sharedCompetencies)
          ? e.sharedCompetencies.filter((c): c is string => typeof c === "string")
          : undefined;
        inferredEdges.push({ sourceLabel, targetLabel, edgeType, reason, sharedCompetencies });
        if (inferredEdges.length >= 10) break;
      }
    }

    const finalData: DiagnosisGenerationResult = {
      overallGrade: !gradeFallback ? (parsed.overallGrade as string) : "B",
      recordDirection: String(parsed.recordDirection ?? "").slice(0, 50),
      directionStrength: !strengthFallback ? (parsed.directionStrength as "strong" | "moderate" | "weak") : "moderate",
      directionReasoning: String(parsed.directionReasoning ?? ""),
      strengths: aiStrengths,
      weaknesses: aiWeaknesses,
      improvements: aiImprovements,
      recommendedMajors: Array.isArray(parsed.recommendedMajors) ? parsed.recommendedMajors.filter((s): s is string => typeof s === "string" && s.length > 0) : [],
      strategyNotes: String(parsed.strategyNotes ?? "").slice(0, 500),
      ...(inferredEdges.length > 0 ? { inferredEdges } : {}),
    };

    // L4-D / L1+L2+L3: Hypothesis-Verify Loop
    // L1 규칙 검증 → L2 coherence (Flash judge) → L3 targeted repair (Flash, MAX=1)
    // 각 단계 실패는 non-fatal — 이전 단계 결과로 진행.
    const { formatViolationLabels } = await import("../validators/types");
    let diagnosisData: DiagnosisGenerationResult = finalData;
    const l1Violations: import("../validators/types").Violation[] = [];
    const l2Violations: import("../validators/types").Violation[] = [];

    try {
      const { validateDiagnosisOutput } = await import("../validators/diagnosis-validator");
      const validation = validateDiagnosisOutput(diagnosisData);
      if (validation.violations.length > 0) {
        l1Violations.push(...validation.violations);
        logActionWarn(LOG_CTX, "L1 validator violations", {
          errorCount: validation.errorCount,
          warningCount: validation.warningCount,
          rules: validation.violations.map((v) => v.rule),
        });
      }
    } catch (validatorErr) {
      logActionWarn(LOG_CTX, "L1 validator skipped (non-fatal)", { error: String(validatorErr) });
    }

    try {
      const { checkDiagnosisCoherence } = await import("../validators/diagnosis-coherence-checker");
      const coherence = await checkDiagnosisCoherence(
        diagnosisData,
        competencyScores,
        activityTags,
        studentInfo,
      );
      if (coherence.violations.length > 0) {
        l2Violations.push(...coherence.violations);
        logActionWarn(LOG_CTX, "L2 coherence violations", {
          errorCount: coherence.errorCount,
          warningCount: coherence.warningCount,
          rules: coherence.violations.map((v) => v.rule),
        });
      }
    } catch (coherenceErr) {
      logActionWarn(LOG_CTX, "L2 coherence check skipped (non-fatal)", {
        error: coherenceErr instanceof Error ? coherenceErr.message : String(coherenceErr),
      });
    }

    // L3 Targeted Repair — L1+L2 error만 대상, MAX=1 (재시도 금지)
    const combinedViolations = [...l1Violations, ...l2Violations];
    const hasErrors = combinedViolations.some((v) => v.severity === "error");
    let repairApplied = false;
    let postRepairViolations: import("../validators/types").Violation[] | null = null;

    if (hasErrors) {
      try {
        const { repairDiagnosis } = await import("../validators/diagnosis-repair");
        const repair = await repairDiagnosis(
          diagnosisData,
          combinedViolations,
          competencyScores,
          activityTags,
          studentInfo,
        );
        if (repair.repaired) {
          diagnosisData = {
            ...repair.output,
            // L3-C: inferredEdges는 L1/L2 검증 대상 아님 — repair 이후에도 원본 보존
            ...(finalData.inferredEdges ? { inferredEdges: finalData.inferredEdges } : {}),
          };
          repairApplied = true;
          postRepairViolations = repair.remainingViolations;
          warnings.push(
            `[REPAIRED] ${repair.repairedFieldPaths.join(", ")} 필드를 L3 repair로 재생성했습니다`,
          );
          logActionWarn(LOG_CTX, "L3 repair applied", {
            repairedFieldPaths: repair.repairedFieldPaths,
            remainingViolationCount: repair.remainingViolations.length,
            usage: repair.usage,
          });
        }
      } catch (repairErr) {
        logActionWarn(LOG_CTX, "L3 repair skipped (non-fatal)", {
          error: repairErr instanceof Error ? repairErr.message : String(repairErr),
        });
      }
    }

    // Warnings 첨부: repair 여부에 따라 분기
    if (repairApplied && postRepairViolations) {
      // repair 후: L1 재검증 결과 + L2 warnings (L2는 재실행하지 않음 — 비용)
      warnings.push(...formatViolationLabels(postRepairViolations));
      const l2Warnings = l2Violations.filter((v) => v.severity === "warning");
      if (l2Warnings.length > 0) warnings.push(...formatViolationLabels(l2Warnings));
    } else {
      // repair 없음/실패: L1+L2 violations 그대로 첨부
      if (combinedViolations.length > 0) {
        warnings.push(...formatViolationLabels(combinedViolations));
      }
    }

    return {
      success: true,
      data: {
        ...diagnosisData,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    };
  } catch (error) {
    return handleLlmActionError(error, "종합 진단 생성", LOG_CTX);
  }
}