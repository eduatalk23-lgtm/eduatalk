"use server";

// ============================================
// Blueprint Phase — 진로→3년 수렴 설계 Server Action
//
// top-down 방향: WHO + SEED → LLM → blueprint 하이퍼엣지 + 서사 골격
// 소비자: pipeline/synthesis 또는 수동 호출 (admin API)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateSchoolYear, getCurriculumYear } from "@/lib/utils/schoolYear";
import {
  BLUEPRINT_SYSTEM_PROMPT,
  buildUserPrompt,
  parseResponse,
} from "../prompts/blueprintPhase";
import type { BlueprintPhaseInput, BlueprintPhaseOutput } from "../../blueprint/types";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "record-analysis", action: "generateBlueprint" };

/**
 * Blueprint Phase LLM 호출 — 진로→3년 수렴 설계 생성.
 *
 * 1. 학생의 메인 탐구(design/analysis overall)를 seed로 사용
 * 2. 유사 진로 exemplar 패턴을 few-shot으로 주입 (최대 3건)
 * 3. 기존 analysis 하이퍼엣지가 있으면 혼합 모드
 * 4. LLM 산출물을 blueprint 하이퍼엣지로 DB 영속화
 *
 * @returns BlueprintPhaseOutput (targetConvergences, storylineSkeleton, competencyGrowthTargets, milestones)
 */
export async function generateBlueprintDesign(
  studentId: string,
): Promise<ActionResponse<BlueprintPhaseOutput>> {
  try {
    const { tenantId: rawTenantId } = await requireAdminOrConsultant();
    if (!rawTenantId) return { success: false, error: "테넌트 정보가 없습니다." };
    const tenantId = rawTenantId;
    const supabase = await createSupabaseServerClient();

    // ── 1. 학생 정보 조회 ──────────────────────────
    const { data: student } = await supabase
      .from("students")
      .select("grade, target_major, desired_career_field, school_name, user_profiles(name)")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!student) {
      return { success: false, error: "��생 정보를 찾�� 수 없습니다." };
    }

    const studentGrade = (student.grade as number) ?? 1;
    const targetMajor = (student.target_major as string) ?? undefined;
    const careerField = (student.desired_career_field as string) ?? targetMajor ?? "";

    if (!careerField) {
      return { success: false, error: "진로 분야(career_field)가 설정되지 않았습니다. 학생 프로필에서 진로를 먼저 설정해���세요." };
    }

    // ── 2. 메인 탐구 조회 (design 우선 → analysis 폴백) ──
    const { listActiveMainExplorations } = await import(
      "@/lib/domains/student-record/repository/main-exploration-repository"
    );
    const activeExplorations = await listActiveMainExplorations(studentId, tenantId);
    const overall = activeExplorations.filter((m) => m.scope === "overall");
    const mainExploration =
      overall.find((m) => m.direction === "design") ??
      overall.find((m) => m.direction === "analysis") ??
      activeExplorations[0];

    if (!mainExploration) {
      return { success: false, error: "활성 메인 탐구가 없습니다. 메인 탐구를 먼저 생��해주세요." };
    }

    const themeKeywords = Array.isArray(mainExploration.theme_keywords)
      ? (mainExploration.theme_keywords as string[])
      : [];

    // ── 3. 병렬 데이터 수집 ──────────────────────────
    const currentSchoolYear = calculateSchoolYear();
    const enrollmentYear = currentSchoolYear - studentGrade + 1;
    const curriculumYear = getCurriculumYear(enrollmentYear);
    const remainingGrades = Array.from(
      { length: 3 - studentGrade + 1 },
      (_, i) => studentGrade + i,
    );

    const [
      exemplarPatternsResult,
      analysisHyperedgesResult,
      competencyScoresResult,
      coursePlansResult,
      storylinesResult,
    ] = await Promise.all([
      // exemplar few-shot (최대 3건)
      loadExemplarPatterns(careerField, supabase).catch(() => []),
      // 기존 analysis 하이퍼엣지
      loadAnalysisHyperedges(studentId, tenantId).catch(() => []),
      // 현재 역량 점수
      loadCompetencyScores(studentId, tenantId, currentSchoolYear).catch(() => []),
      // 수강 계획
      supabase
        .from("student_course_plans")
        .select("subject:subject_id(name), grade, semester, subject_type:subject_type_id(name)")
        .eq("student_id", studentId)
        .order("grade")
        .order("semester")
        .then((r) => r.data ?? [])
        .catch(() => []),
      // 스토리라인
      supabase
        .from("student_record_storylines")
        .select("title, keywords")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .then((r) => r.data ?? [])
        .catch(() => []),
    ]);

    // ── 4. 학교 권역 판정 ──────────────────────────
    const snapshot = await supabase
      .from("student_snapshots")
      .select("target_school_tier")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle()
      .then((r) => r.data);
    const schoolTier =
      (snapshot?.target_school_tier as string) === "top" ? "top" as const
        : (snapshot?.target_school_tier as string) === "low" ? "low" as const
          : "mid" as const;

    // ── 5. BlueprintPhaseInput 조합 ──────────────────
    const input: BlueprintPhaseInput = {
      identity: {
        careerField,
        targetMajor,
        schoolTier,
        identityKeywords: themeKeywords,
      },
      mainExploration: {
        themeLabel: mainExploration.theme_label,
        themeKeywords,
        tierPlan: (mainExploration.tier_plan ?? {}) as BlueprintPhaseInput["mainExploration"]["tierPlan"],
        careerField: mainExploration.career_field,
      },
      curriculum: {
        revisionYear: curriculumYear,
        currentGrade: studentGrade,
        remainingGrades,
        coursePlans: (coursePlansResult as Array<Record<string, unknown>>).map((cp) => ({
          subjectName: (cp.subject as { name: string } | null)?.name ?? "",
          grade: Number(cp.grade ?? 1),
          semester: Number(cp.semester ?? 1),
          subjectType: (cp.subject_type as { name: string } | null)?.name,
        })).filter((cp) => cp.subjectName),
      },
      exemplarPatterns: exemplarPatternsResult.length > 0
        ? exemplarPatternsResult
        : undefined,
      existingAnalysis: analysisHyperedgesResult.length > 0 || competencyScoresResult.length > 0
        ? {
          analysisHyperedges: analysisHyperedgesResult,
          competencyScores: competencyScoresResult,
          storylines: (storylinesResult as Array<Record<string, unknown>>).map((sl) => ({
            title: String(sl.title ?? ""),
            keywords: Array.isArray(sl.keywords) ? (sl.keywords as string[]) : [],
          })),
        }
        : undefined,
    };

    // ── 6. LLM 호출 ──────��─────────────────────────
    const userPrompt = buildUserPrompt(input);

    logActionDebug(LOG_CTX, "Blueprint LLM 호출 시작", {
      studentId,
      grade: studentGrade,
      remainingGrades,
      exemplarCount: exemplarPatternsResult.length,
      hasAnalysis: !!input.existingAnalysis,
    });

    const result = await withRetry(
      () =>
        generateTextWithRateLimit({
          system: BLUEPRINT_SYSTEM_PROMPT,
          prompt: userPrompt,
          modelTier: "standard",
          temperature: 0.5,
          maxTokens: 4000,
          label: "generateBlueprint",
        }),
      { label: "generateBlueprint" },
    );

    const output = parseResponse(result.content);

    // ── 7. Blueprint 하이퍼엣지 DB 영속화 ─────────────
    if (output.targetConvergences.length > 0) {
      try {
        const { replaceHyperedges } = await import(
          "@/lib/domains/student-record/repository/hyperedge-repository"
        );

        const hyperedgeInputs = output.targetConvergences.map((conv) => ({
          themeSlug: `blueprint:${conv.grade}:${conv.themeKeywords.slice(0, 3).join("-") || conv.themeLabel}`,
          themeLabel: conv.themeLabel,
          hyperedgeType: "theme_convergence" as const,
          members: conv.targetMembers.map((m) => ({
            recordType: m.recordType,
            recordId: `blueprint:${conv.grade}:${m.subjectOrActivity}`,
            label: `[${m.role}] ${m.subjectOrActivity}: ${m.description}`,
            grade: conv.grade,
            role: m.role,
          })),
          confidence: conv.confidence,
          evidence: conv.rationale,
          sharedKeywords: conv.themeKeywords,
          sharedCompetencies: conv.sharedCompetencies,
        }));

        const inserted = await replaceHyperedges(
          studentId,
          tenantId,
          null, // pipelineId — 수동 호출 시 null
          hyperedgeInputs,
          "blueprint" as "analysis", // DB에 blueprint context로 저장 (타입 캐스트 — 마이그레이션 적용 후 정상)
        );

        logActionDebug(LOG_CTX, "Blueprint 하이퍼엣지 저장", {
          studentId,
          count: inserted,
        });
      } catch (dbErr) {
        // DB 저장 실패해도 LLM 결과는 반환 (best-effort)
        logActionError(LOG_CTX, dbErr);
      }
    }

    logActionDebug(LOG_CTX, "Blueprint 설계 완료", {
      studentId,
      convergenceCount: output.targetConvergences.length,
      milestoneGrades: Object.keys(output.milestones),
      growthTargetCount: output.competencyGrowthTargets.length,
    });

    return { success: true, data: output };
  } catch (error) {
    return handleLlmActionError(error, "Blueprint 설계 생성", LOG_CTX);
  }
}

// ============================================
// 내부 헬퍼: 데이터 로더
// ============================================

/** 유사 진로 exemplar 패턴 로드 (최대 3건) */
async function loadExemplarPatterns(
  careerField: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<BlueprintPhaseInput["exemplarPatterns"] & object> {
  // exemplar 중 해당 진로 분야의 main_exploration_pattern이 있는 것을 조회
  const { data: exemplars } = await supabase
    .from("admission_exemplars")
    .select("id, desired_career_field, main_exploration_pattern")
    .not("main_exploration_pattern", "is", null)
    .limit(10);

  if (!exemplars || exemplars.length === 0) return [];

  // 진로 키워드 매칭으로 필터 (간단한 substring 매칭)
  const careerLower = careerField.toLowerCase();
  const matched = exemplars
    .filter((ex) => {
      const exCareer = (ex.desired_career_field as string ?? "").toLowerCase();
      return exCareer.includes(careerLower) || careerLower.includes(exCareer);
    })
    .slice(0, 3);

  return matched.map((ex) => {
    const pattern = ex.main_exploration_pattern as Record<string, unknown>;
    return {
      themeLabel: String(pattern.theme_label ?? ""),
      tierPlan: (pattern.tier_plan ?? {}) as BlueprintPhaseInput["mainExploration"]["tierPlan"],
      careerField: (ex.desired_career_field as string) ?? null,
    };
  });
}

/** 기존 analysis 하이퍼��지 로드 */
async function loadAnalysisHyperedges(
  studentId: string,
  tenantId: string,
): Promise<NonNullable<BlueprintPhaseInput["existingAnalysis"]>["analysisHyperedges"]> {
  const { findHyperedges } = await import(
    "@/lib/domains/student-record/repository/hyperedge-repository"
  );
  const hyperedges = await findHyperedges(studentId, tenantId, {
    contexts: ["analysis"],
  });

  return hyperedges.map((he) => ({
    themeLabel: he.theme_label,
    memberLabels: he.members.map((m) => m.label),
    grade: he.members[0]?.grade ?? null,
    sharedCompetencies: he.shared_competencies ?? [],
  }));
}

/** 현재 역량 점수 로드 */
async function loadCompetencyScores(
  studentId: string,
  tenantId: string,
  schoolYear: number,
): Promise<Array<{ item: string; grade: string }>> {
  const { findCompetencyScores } = await import(
    "@/lib/domains/student-record/repository/competency-repository"
  );
  const scores = await findCompetencyScores(studentId, schoolYear, tenantId);
  return scores.map((s) => ({
    item: s.competency_item,
    grade: s.grade_value,
  }));
}
