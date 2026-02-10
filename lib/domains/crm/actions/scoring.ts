"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  FIT_SCORE_BY_SOURCE,
  FIT_SCORE_BY_PROGRAM,
  FIT_SCORE_BY_GRADE,
  ENGAGEMENT_SCORE_BY_ACTIVITY,
  QUALITY_THRESHOLDS,
} from "../constants";
import type {
  CrmActionResult,
  QualityLevel,
  ScoreChange,
  ScoreResult,
  ScoreType,
  LeadScoreLog,
  CrmPaginatedResult,
} from "../types";

const CRM_PATH = "/admin/crm";

/**
 * 종합 점수에서 품질 레벨 판정
 */
function determineQualityLevel(totalScore: number): QualityLevel {
  for (const { level, minScore } of QUALITY_THRESHOLDS) {
    if (totalScore >= minScore) return level;
  }
  return "cold";
}

/**
 * 점수를 0~100 범위로 클램프
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * 리드 생성 시 초기 적합도(Fit) 스코어 계산
 * - 유입경로, 프로그램, 학년 기반
 */
function calculateInitialFitScore(lead: {
  lead_source: string;
  program_code?: string | null;
  student_grade?: number | null;
}): { score: number; changes: ScoreChange[] } {
  const changes: ScoreChange[] = [];
  let score = 0;

  // 유입경로 점수
  const sourceScore =
    FIT_SCORE_BY_SOURCE[lead.lead_source as keyof typeof FIT_SCORE_BY_SOURCE] ?? 0;
  if (sourceScore > 0) {
    score += sourceScore;
    changes.push({
      scoreType: "fit",
      delta: sourceScore,
      reason: `유입경로: ${lead.lead_source}`,
    });
  }

  // 프로그램 점수
  if (lead.program_code) {
    const programScore = FIT_SCORE_BY_PROGRAM[lead.program_code] ?? 0;
    if (programScore > 0) {
      score += programScore;
      changes.push({
        scoreType: "fit",
        delta: programScore,
        reason: `프로그램: ${lead.program_code}`,
      });
    }
  }

  // 학년 점수
  if (lead.student_grade) {
    const gradeScore = FIT_SCORE_BY_GRADE[lead.student_grade] ?? 0;
    if (gradeScore > 0) {
      score += gradeScore;
      changes.push({
        scoreType: "fit",
        delta: gradeScore,
        reason: `학년: ${lead.student_grade}학년`,
      });
    }
  }

  return { score: clamp(score), changes };
}

/**
 * 활동 기록 시 참여도(Engagement) 스코어 계산
 */
function calculateEngagementDelta(activityType: string): {
  delta: number;
  reason: string;
} {
  const delta = ENGAGEMENT_SCORE_BY_ACTIVITY[activityType] ?? 0;
  return {
    delta,
    reason: `활동: ${activityType}`,
  };
}

/**
 * 리드의 스코어를 업데이트하고 변동 이력을 기록
 */
export async function updateLeadScore(
  leadId: string,
  scoreType: ScoreType,
  delta: number,
  reason: string
): Promise<CrmActionResult<ScoreResult>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    if (delta === 0) {
      return { success: true };
    }

    const supabase = await createSupabaseServerClient();

    // 현재 스코어 조회
    const { data: lead, error: fetchError } = await supabase
      .from("sales_leads")
      .select("fit_score, engagement_score, tenant_id")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchError || !lead) {
      return { success: false, error: "리드를 찾을 수 없습니다." };
    }

    if (lead.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const currentFit = lead.fit_score;
    const currentEngagement = lead.engagement_score;

    let newFit = currentFit;
    let newEngagement = currentEngagement;

    if (scoreType === "fit") {
      newFit = clamp(currentFit + delta);
    } else {
      newEngagement = clamp(currentEngagement + delta);
    }

    const totalScore = newFit + newEngagement;
    const qualityLevel = determineQualityLevel(totalScore);

    const previousScore = scoreType === "fit" ? currentFit : currentEngagement;
    const newScore = scoreType === "fit" ? newFit : newEngagement;
    const actualDelta = newScore - previousScore;

    // 스코어 업데이트
    const { error: updateError } = await supabase
      .from("sales_leads")
      .update({
        fit_score: newFit,
        engagement_score: newEngagement,
        quality_level: qualityLevel,
        score_updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateError) {
      logActionError(
        { domain: "crm", action: "updateLeadScore", tenantId },
        updateError,
        { leadId, scoreType, delta }
      );
      return { success: false, error: updateError.message };
    }

    // 변동 이력 기록
    if (actualDelta !== 0) {
      await supabase.from("lead_score_logs").insert({
        tenant_id: tenantId,
        lead_id: leadId,
        score_type: scoreType,
        previous_score: previousScore,
        new_score: newScore,
        delta: actualDelta,
        reason,
      });
    }

    revalidatePath(CRM_PATH);
    return {
      success: true,
      data: {
        fitScore: newFit,
        engagementScore: newEngagement,
        qualityLevel,
        changes: [{ scoreType, delta: actualDelta, reason }],
      },
    };
  } catch (error) {
    logActionError({ domain: "crm", action: "updateLeadScore" }, error, {
      leadId,
      scoreType,
      delta,
    });
    return { success: false, error: "스코어 업데이트에 실패했습니다." };
  }
}

/**
 * 리드 생성 시 초기 스코어링 (createLead 내부에서 호출)
 */
export async function scoreNewLead(
  leadId: string,
  lead: {
    lead_source: string;
    program_code?: string | null;
    student_grade?: number | null;
  }
): Promise<CrmActionResult<ScoreResult>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const { score: fitScore, changes } = calculateInitialFitScore(lead);

    if (fitScore === 0) {
      return { success: true };
    }

    const qualityLevel = determineQualityLevel(fitScore);

    const supabase = await createSupabaseServerClient();

    const { error: updateError } = await supabase
      .from("sales_leads")
      .update({
        fit_score: fitScore,
        quality_level: qualityLevel,
        score_updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateError) {
      logActionError(
        { domain: "crm", action: "scoreNewLead", tenantId },
        updateError,
        { leadId }
      );
      return { success: false, error: updateError.message };
    }

    // 변동 이력 기록
    for (const change of changes) {
      await supabase.from("lead_score_logs").insert({
        tenant_id: tenantId,
        lead_id: leadId,
        score_type: "fit",
        previous_score: 0,
        new_score: fitScore,
        delta: change.delta,
        reason: change.reason,
      });
    }

    return {
      success: true,
      data: {
        fitScore,
        engagementScore: 0,
        qualityLevel,
        changes,
      },
    };
  } catch (error) {
    logActionError({ domain: "crm", action: "scoreNewLead" }, error, {
      leadId,
    });
    return { success: false, error: "초기 스코어링에 실패했습니다." };
  }
}

/**
 * 활동 기록 시 참여도 자동 갱신 (addLeadActivity 내부에서 호출)
 */
export async function scoreLeadActivity(
  leadId: string,
  activityType: string
): Promise<CrmActionResult<ScoreResult>> {
  const { delta, reason } = calculateEngagementDelta(activityType);
  if (delta === 0) return { success: true };
  return updateLeadScore(leadId, "engagement", delta, reason);
}

/**
 * 수동 스코어 조정 (관리자가 직접 점수 보정)
 */
export async function adjustLeadScore(
  leadId: string,
  scoreType: ScoreType,
  delta: number,
  reason: string
): Promise<CrmActionResult<ScoreResult>> {
  if (!reason.trim()) {
    return { success: false, error: "점수 변동 사유를 입력해주세요." };
  }
  return updateLeadScore(leadId, scoreType, delta, `[수동 조정] ${reason}`);
}

/**
 * 리드 스코어 변동 이력 조회
 */
export async function getLeadScoreLogs(
  leadId: string,
  options?: { page?: number; pageSize?: number }
): Promise<CrmActionResult<CrmPaginatedResult<LeadScoreLog>>> {
  try {
    const { role, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("lead_score_logs")
      .select("*", { count: "exact" })
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (role !== "superadmin") {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error, count } = await query;

    if (error) {
      logActionError(
        { domain: "crm", action: "getLeadScoreLogs", tenantId },
        error,
        { leadId }
      );
      return { success: false, error: error.message };
    }

    const totalCount = count ?? 0;
    return {
      success: true,
      data: {
        items: data ?? [],
        totalCount,
        hasMore: from + pageSize < totalCount,
      },
    };
  } catch (error) {
    logActionError({ domain: "crm", action: "getLeadScoreLogs" }, error, {
      leadId,
    });
    return { success: false, error: "스코어 이력 조회에 실패했습니다." };
  }
}
