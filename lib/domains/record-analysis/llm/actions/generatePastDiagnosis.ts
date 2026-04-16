"use server";

// ============================================
// Past Diagnosis 생성 Server Action (scope='past')
//
// 4축×3층 통합 아키텍처 A층. 2026-04-16 D 세션 B.
// NEIS 확정 기록 범위 내에서 현상 진단. exemplar/Blueprint 참조 금지.
// school_year별로 저장 (NEIS 학년마다 1건).
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionDebug } from "@/lib/logging/actionLogger";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import * as competencyRepo from "@/lib/domains/student-record/repository/competency-repository";
import {
  deleteDiagnosisByScope,
} from "@/lib/domains/student-record/repository/diagnosis-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PAST_DIAGNOSIS_SYSTEM_PROMPT,
  buildPastDiagnosisUserPrompt,
  parsePastDiagnosisResponse,
  type PastDiagnosisResult,
} from "../prompts/pastDiagnosisPrompt";
import type { CompetencyScore, ActivityTag } from "@/lib/domains/student-record/types";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "record-analysis", action: "generatePastDiagnosis" };

export interface PastDiagnosisPersistResult extends PastDiagnosisResult {
  schoolYears: number[];
  savedCount: number;
}

/**
 * Past Diagnosis LLM 호출 + scope='past' 영속화.
 * NEIS 학년마다 1건씩 학생 전체 종합 1건으로 저장 (school_year=max(neisGrades)).
 * 역량 0건이면 skip.
 */
export async function generatePastDiagnosis(
  studentId: string,
  tenantId: string,
  neisGrades: number[],
  pastStorylineSection?: string,
): Promise<ActionResponse<PastDiagnosisPersistResult>> {
  try {
    await requireAdminOrConsultant();

    if (!neisGrades || neisGrades.length === 0) {
      return { success: false, error: "NEIS 학년 없음 — Past Diagnosis 스킵" };
    }

    const currentSchoolYear = calculateSchoolYear();

    // ── 1. NEIS 역량/태그 조회 ──
    const [scores, tags] = await Promise.all([
      competencyRepo.findCompetencyScores(studentId, currentSchoolYear, tenantId),
      competencyRepo.findActivityTags(studentId, tenantId, {
        excludeTagContext: "draft_analysis",
      }),
    ]);

    // NEIS 학년 범위 태그만 필터링 — draft_analysis 배제는 이미 적용됨
    const neisScores: CompetencyScore[] = scores.filter((s) => s.source !== "ai_projected");
    const neisTags: ActivityTag[] = tags.filter((t) =>
      neisGrades.includes(t.grade as number),
    );

    if (neisScores.length === 0 && neisTags.length === 0) {
      logActionDebug(LOG_CTX, "역량 데이터 없음 — Past Diagnosis 스킵", {
        studentId,
        neisGrades,
      });
      return {
        success: false,
        error: "NEIS 역량 데이터 없음 — 먼저 역량 분석을 실행하세요.",
      };
    }

    // ── 2. 학생 정보 조회 ──
    const supabase = await createSupabaseServerClient();
    const { data: snapshot } = await supabase
      .from("student_snapshots")
      .select("target_major, school_name")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // ── 3. LLM 호출 ──
    const userPrompt = buildPastDiagnosisUserPrompt({
      neisGrades,
      competencyScores: neisScores,
      activityTags: neisTags,
      pastStorylineSection,
      studentInfo: {
        targetMajor: (snapshot?.target_major as string) ?? undefined,
        schoolName: (snapshot?.school_name as string) ?? undefined,
      },
    });

    const result = await withRetry(
      () =>
        generateTextWithRateLimit({
          system: PAST_DIAGNOSIS_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          modelTier: "standard",
          temperature: 0.3,
          maxTokens: 3500,
          responseFormat: "json",
        }),
      { label: "generatePastDiagnosis" },
    );

    if (!result.content) {
      return { success: false, error: "Past Diagnosis AI 응답이 비어있습니다." };
    }

    const parsed = parsePastDiagnosisResponse(result.content);

    // ── 4. 기존 scope='past' 진단 제거 ──
    await deleteDiagnosisByScope(studentId, tenantId, "past");

    // ── 5. 영속화 — NEIS 범위 대표 학년도 1건으로 저장 ──
    const representativeSchoolYear = currentSchoolYear;
    const { toDbJson } = await import("@/lib/domains/student-record/types");

    const { error: insErr } = await supabase.from("student_record_diagnosis").insert({
      tenant_id: tenantId,
      student_id: studentId,
      school_year: representativeSchoolYear,
      overall_grade: parsed.overallGrade,
      record_direction: parsed.recordDirection,
      direction_strength: parsed.directionStrength,
      direction_reasoning: parsed.directionReasoning || null,
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      improvements: toDbJson(parsed.improvements),
      recommended_majors: [],
      strategy_notes: parsed.summary,
      source: "ai",
      status: "draft",
      scope: "past",
    });

    if (insErr) {
      throw insErr;
    }

    logActionDebug(LOG_CTX, "Past Diagnosis 영속화 완료", {
      studentId,
      neisGrades,
      overallGrade: parsed.overallGrade,
      weaknessCount: parsed.weaknesses.length,
    });

    return {
      success: true,
      data: {
        ...parsed,
        schoolYears: neisGrades,
        savedCount: 1,
      },
    };
  } catch (error) {
    return handleLlmActionError(error, "Past Diagnosis 생성", LOG_CTX);
  }
}
