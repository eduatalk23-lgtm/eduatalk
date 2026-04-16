"use server";

// ============================================
// Past Strategy 생성 Server Action (scope='past')
//
// 4축×3층 통합 아키텍처 A층. 2026-04-16 D 세션 B.
// 이번 학기 ~ 다음 학기 내 실행 가능한 즉시 행동 권고만 제안.
// Blueprint/exemplar/장기 로드맵 참조 금지.
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  findDiagnosisByScope,
  deleteStrategiesByScope,
  findStrategiesByScope,
} from "@/lib/domains/student-record/repository/diagnosis-repository";
import * as competencyRepo from "@/lib/domains/student-record/repository/competency-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import {
  PAST_STRATEGY_SYSTEM_PROMPT,
  buildPastStrategyUserPrompt,
  parsePastStrategyResponse,
  type PastStrategyResult,
} from "../prompts/pastStrategyPrompt";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "record-analysis", action: "generatePastStrategy" };

export interface PastStrategyPersistResult extends PastStrategyResult {
  savedCount: number;
}

/**
 * Past Strategy LLM 호출 + scope='past' 영속화.
 * Past Diagnosis 약점에 대응하는 "이번/다음 학기 내 실행" 행동 제안만 생성.
 */
export async function generatePastStrategy(
  studentId: string,
  tenantId: string,
  neisGrades: number[],
  currentGrade: number,
  currentSemester: 1 | 2,
): Promise<ActionResponse<PastStrategyPersistResult>> {
  try {
    await requireAdminOrConsultant();

    if (!neisGrades || neisGrades.length === 0) {
      return { success: false, error: "NEIS 학년 없음 — Past Strategy 스킵" };
    }

    // ── 1. Past Diagnosis 조회 (선행 태스크) ──
    const pastDiagnoses = await findDiagnosisByScope(studentId, tenantId, "past");
    if (pastDiagnoses.length === 0) {
      return {
        success: false,
        error: "Past Diagnosis 없음 — 먼저 A2(Past Diagnosis)를 실행하세요.",
      };
    }

    // 가장 최근 school_year 기준 (Past Diagnosis는 보통 1건 단일 저장)
    const pastDiagnosis = pastDiagnoses.sort(
      (a, b) => (b.school_year ?? 0) - (a.school_year ?? 0),
    )[0];

    const weaknesses = Array.isArray(pastDiagnosis.weaknesses)
      ? (pastDiagnosis.weaknesses as string[])
      : [];
    const improvementsRaw = Array.isArray(pastDiagnosis.improvements)
      ? (pastDiagnosis.improvements as Array<{
          priority?: string;
          area?: string;
          gap?: string;
          action?: string;
          outcome?: string;
        }>)
      : [];
    const improvements = improvementsRaw.map((i) => ({
      priority: String(i.priority ?? "중간"),
      area: String(i.area ?? ""),
      gap: String(i.gap ?? ""),
      action: String(i.action ?? ""),
      outcome: String(i.outcome ?? ""),
    }));

    // ── 2. 부족 역량 추출 (B- 이하) ──
    const currentSchoolYear = calculateSchoolYear();
    const scores = await competencyRepo.findCompetencyScores(
      studentId,
      currentSchoolYear,
      tenantId,
    );
    const weakCompetencies = scores
      .filter((s) => s.source !== "ai_projected")
      .filter((s) =>
        ["B-", "C+", "C", "C-"].includes(s.grade_value ?? ""),
      )
      .map((s) => {
        const item = COMPETENCY_ITEMS.find((i) => i.code === s.competency_item);
        return {
          label: item?.label ?? s.competency_item,
          grade: s.grade_value ?? "",
        };
      });

    // ── 3. 기존 scope='past' 전략 내용 (중복 제거용) ──
    const existingPastStrategies = await findStrategiesByScope(
      studentId,
      tenantId,
      "past",
    );
    const existingContents = existingPastStrategies
      .map((s) => s.strategy_content)
      .filter((c): c is string => !!c);

    // ── 4. LLM 호출 ──
    const userPrompt = buildPastStrategyUserPrompt({
      neisGrades,
      currentGrade,
      currentSemester,
      weaknesses,
      improvements,
      weakCompetencies,
      existingStrategies: existingContents,
    });

    const result = await withRetry(
      () =>
        generateTextWithRateLimit({
          system: PAST_STRATEGY_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          modelTier: "fast",
          temperature: 0.4,
          maxTokens: 2500,
          responseFormat: "json",
        }),
      { label: "generatePastStrategy" },
    );

    if (!result.content) {
      return { success: false, error: "Past Strategy AI 응답이 비어있습니다." };
    }

    const parsed = parsePastStrategyResponse(result.content);

    if (parsed.suggestions.length === 0) {
      logActionDebug(LOG_CTX, "Past Strategy 제안 0건", { studentId });
      return {
        success: true,
        data: { ...parsed, savedCount: 0 },
      };
    }

    // ── 5. 기존 scope='past' 전략 제거 후 재삽입 ──
    await deleteStrategiesByScope(studentId, tenantId, "past");

    const supabase = await createSupabaseServerClient();
    let savedCount = 0;
    for (const s of parsed.suggestions) {
      const targetGrade =
        s.targetTerm === "this_semester"
          ? currentGrade
          : currentSemester === 1
            ? currentGrade
            : currentGrade + 1;
      const { error } = await supabase.from("student_record_strategies").insert({
        student_id: studentId,
        tenant_id: tenantId,
        school_year: currentSchoolYear,
        grade: targetGrade,
        target_area: s.targetArea,
        strategy_content: s.strategyContent,
        priority: s.priority,
        status: "planned",
        reasoning: s.reasoning || null,
        scope: "past",
      });
      if (error) {
        logActionError(LOG_CTX, error, { studentId, targetArea: s.targetArea });
        continue;
      }
      savedCount++;
    }

    logActionDebug(LOG_CTX, "Past Strategy 영속화 완료", {
      studentId,
      neisGrades,
      savedCount,
      totalProposed: parsed.suggestions.length,
    });

    return {
      success: true,
      data: { ...parsed, savedCount },
    };
  } catch (error) {
    return handleLlmActionError(error, "Past Strategy 생성", LOG_CTX);
  }
}
