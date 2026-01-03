"use server";

/**
 * 배치 플랜 미리보기 액션
 *
 * Phase 3: 미리보기 모드
 *
 * 플랜을 생성하되 DB에 저장하지 않고 미리보기만 제공합니다.
 * 검증 및 품질 점수를 함께 계산합니다.
 *
 * @module lib/domains/admin-plan/actions/batchPreviewPlans
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import { AppError, ErrorCode, withErrorHandlingSafe } from "@/lib/errors";
import { revalidatePath } from "next/cache";

import { createMessage, estimateCost } from "@/lib/domains/plan/llm/client";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
} from "@/lib/domains/plan/llm/prompts/planGeneration";
import {
  buildLLMRequest,
  validateRequest,
} from "@/lib/domains/plan/llm/transformers/requestBuilder";
import { parseLLMResponse } from "@/lib/domains/plan/llm/transformers/responseParser";
import { validatePlans } from "@/lib/domains/plan/llm/validators/planValidator";

import type { GeneratedPlanItem, ModelTier } from "@/lib/domains/plan/llm/types";
import type {
  BatchPlanSettings,
  StudentPlanResult,
} from "./batchAIPlanGeneration";
import type {
  StudentPlanPreview,
  BatchPreviewResult,
  QualityScore,
  PreviewToSaveInput,
  PreviewSaveResult,
} from "../types/preview";

// ============================================
// 데이터 로딩 함수 (재사용)
// ============================================

async function loadStudentData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
) {
  const { data } = await supabase
    .from("students")
    .select("id, name, grade, school_name, target_university, target_major")
    .eq("id", studentId)
    .single();
  return data;
}

async function loadScores(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
) {
  const { data } = await supabase
    .from("scores")
    .select("*")
    .eq("student_id", studentId)
    .order("exam_date", { ascending: false })
    .limit(20);
  return data || [];
}

async function loadContents(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  contentIds: string[]
) {
  if (contentIds.length === 0) return [];

  const { data: books } = await supabase
    .from("books")
    .select("id, title, subject, subject_category, total_pages, estimated_hours")
    .in("id", contentIds);

  const { data: lectures } = await supabase
    .from("lectures")
    .select("id, title, subject, subject_category, total_lectures, estimated_hours")
    .in("id", contentIds);

  return [
    ...(books || []).map((b) => ({ ...b, content_type: "book" as const })),
    ...(lectures || []).map((l) => ({ ...l, content_type: "lecture" as const })),
  ];
}

async function loadTimeSlots(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string
) {
  const { data } = await supabase
    .from("time_slots")
    .select("id, name, start_time, end_time, slot_type")
    .eq("tenant_id", tenantId);
  return data || [];
}

async function loadLearningStats(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data } = await supabase
    .from("student_plans")
    .select("is_completed, actual_minutes")
    .eq("student_id", studentId)
    .gte("plan_date", thirtyDaysAgo.toISOString().split("T")[0]);

  if (!data || data.length === 0) {
    return {
      average_completion_rate: 0,
      average_daily_minutes: 0,
      total_plans_completed: 0,
    };
  }

  const completed = data.filter((p) => p.is_completed).length;
  const totalMinutes = data.reduce((sum, p) => sum + (p.actual_minutes || 0), 0);

  return {
    average_completion_rate: data.length > 0 ? completed / data.length : 0,
    average_daily_minutes: data.length > 0 ? totalMinutes / data.length : 0,
    total_plans_completed: completed,
  };
}

// ============================================
// 품질 점수 계산
// ============================================

function calculateQualityScore(
  plans: GeneratedPlanItem[],
  contentIds: string[],
  dailyStudyMinutes: number
): QualityScore {
  if (plans.length === 0) {
    return { overall: 0, balance: 0, conflicts: 0, coverage: 0, pacing: 0 };
  }

  // 1. 과목 균형 점수 (표준편차 기반)
  const subjectMinutes: Record<string, number> = {};
  for (const plan of plans) {
    const subject = plan.subject || "기타";
    subjectMinutes[subject] = (subjectMinutes[subject] || 0) + plan.estimatedMinutes;
  }

  const subjects = Object.keys(subjectMinutes);
  const avgMinutes = Object.values(subjectMinutes).reduce((a, b) => a + b, 0) / subjects.length;
  const variance =
    subjects.length > 1
      ? Object.values(subjectMinutes).reduce((sum, m) => sum + Math.pow(m - avgMinutes, 2), 0) /
        subjects.length
      : 0;
  const stdDev = Math.sqrt(variance);
  const balanceScore = Math.max(0, 100 - (stdDev / avgMinutes) * 50);

  // 2. 충돌 수 (시간 겹침)
  let conflicts = 0;
  const plansByDate: Record<string, GeneratedPlanItem[]> = {};
  for (const plan of plans) {
    const date = plan.date;
    if (!plansByDate[date]) plansByDate[date] = [];
    plansByDate[date].push(plan);
  }

  for (const dayPlans of Object.values(plansByDate)) {
    for (let i = 0; i < dayPlans.length; i++) {
      for (let j = i + 1; j < dayPlans.length; j++) {
        const a = dayPlans[i];
        const b = dayPlans[j];
        if (a.startTime < b.endTime && b.startTime < a.endTime) {
          conflicts++;
        }
      }
    }
  }

  // 3. 콘텐츠 커버리지
  const coveredContentIds = new Set(plans.map((p) => p.contentId));
  const coverageScore = (coveredContentIds.size / Math.max(contentIds.length, 1)) * 100;

  // 4. 일일 학습량 분포 (목표 대비)
  const dailyMinutes: Record<string, number> = {};
  for (const plan of plans) {
    dailyMinutes[plan.date] = (dailyMinutes[plan.date] || 0) + plan.estimatedMinutes;
  }

  const days = Object.keys(dailyMinutes);
  const pacingDeviations = days.map((d) =>
    Math.abs(dailyMinutes[d] - dailyStudyMinutes) / dailyStudyMinutes
  );
  const avgDeviation = pacingDeviations.reduce((a, b) => a + b, 0) / Math.max(days.length, 1);
  const pacingScore = Math.max(0, 100 - avgDeviation * 100);

  // 전체 점수 (가중 평균)
  const overall =
    balanceScore * 0.25 +
    Math.max(0, 100 - conflicts * 10) * 0.25 +
    coverageScore * 0.25 +
    pacingScore * 0.25;

  return {
    overall: Math.round(overall),
    balance: Math.round(balanceScore),
    conflicts,
    coverage: Math.round(coverageScore),
    pacing: Math.round(pacingScore),
  };
}

// ============================================
// 개별 학생 미리보기 생성
// ============================================

async function generatePreviewForStudent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tenantId: string,
  studentId: string,
  contentIds: string[],
  settings: BatchPlanSettings
): Promise<StudentPlanPreview> {
  try {
    // 1. 학생 데이터 로드
    const student = await loadStudentData(supabase, studentId);
    if (!student) {
      return {
        studentId,
        studentName: "Unknown",
        status: "error",
        error: "학생 정보를 찾을 수 없습니다.",
      };
    }

    // 2. 콘텐츠 확인
    if (!contentIds || contentIds.length === 0) {
      return {
        studentId,
        studentName: student.name,
        status: "skipped",
        error: "선택된 콘텐츠가 없습니다.",
      };
    }

    // 3. 관련 데이터 로드
    const [scores, contents, timeSlots, learningStats] = await Promise.all([
      loadScores(supabase, studentId),
      loadContents(supabase, contentIds),
      loadTimeSlots(supabase, tenantId),
      loadLearningStats(supabase, studentId),
    ]);

    if (contents.length === 0) {
      return {
        studentId,
        studentName: student.name,
        status: "skipped",
        error: "유효한 콘텐츠가 없습니다.",
      };
    }

    // 4. LLM 요청 빌드
    const llmRequest = buildLLMRequest({
      student: {
        id: student.id,
        name: student.name,
        grade: student.grade,
        school_name: student.school_name,
        target_university: student.target_university,
        target_major: student.target_major,
      },
      scores,
      contents: contents.slice(0, 20).map((c) => ({
        id: c.id,
        title: c.title,
        subject: c.subject,
        subject_category: c.subject_category,
        content_type: c.content_type,
        total_pages: "total_pages" in c ? c.total_pages : undefined,
        total_lectures: "total_lectures" in c ? c.total_lectures : undefined,
        estimated_hours: c.estimated_hours,
      })),
      timeSlots: timeSlots.map((s) => ({
        id: s.id,
        name: s.name,
        start_time: s.start_time,
        end_time: s.end_time,
        slot_type: s.slot_type,
      })),
      learningStats,
      settings: {
        startDate: settings.startDate,
        endDate: settings.endDate,
        dailyStudyMinutes: settings.dailyStudyMinutes,
        excludeDays: settings.excludeDays,
        prioritizeWeakSubjects: settings.prioritizeWeakSubjects,
        balanceSubjects: settings.balanceSubjects,
        includeReview: settings.includeReview,
        reviewRatio: settings.reviewRatio,
      },
      additionalInstructions: settings.additionalInstructions,
    });

    // 5. 요청 유효성 검사
    const requestValidation = validateRequest(llmRequest);
    if (!requestValidation.valid) {
      return {
        studentId,
        studentName: student.name,
        status: "error",
        error: requestValidation.errors.join(", "),
      };
    }

    // 6. LLM 호출
    const modelTier = settings.modelTier || "fast";
    const userPrompt = buildUserPrompt(llmRequest);

    const result = await createMessage({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
    });

    // 7. 응답 파싱
    const parsed = parseLLMResponse(result.content, result.modelId, result.usage);

    if (!parsed.success || !parsed.response) {
      return {
        studentId,
        studentName: student.name,
        status: "error",
        error: parsed.error || "플랜 생성에 실패했습니다.",
      };
    }

    // 8. 플랜 추출
    const allPlans: GeneratedPlanItem[] = [];
    for (const matrix of parsed.response.weeklyMatrices) {
      for (const day of matrix.days) {
        allPlans.push(...day.plans);
      }
    }

    // 9. 검증
    const validation = validatePlans({
      plans: allPlans,
      academySchedules: [], // TODO: 학원 일정 로드
      blockSets: [], // TODO: 블록 정보 로드
      excludeDays: settings.excludeDays || [],
      excludeDates: [],
      dailyStudyMinutes: settings.dailyStudyMinutes,
    });

    // 10. 품질 점수 계산
    const qualityScore = calculateQualityScore(
      allPlans,
      contentIds,
      settings.dailyStudyMinutes
    );

    // 11. 요약 생성
    const subjectDistribution: Record<string, number> = {};
    for (const plan of allPlans) {
      const subject = plan.subject || "기타";
      subjectDistribution[subject] = (subjectDistribution[subject] || 0) + plan.estimatedMinutes;
    }

    const dates = allPlans.map((p) => p.date).sort();

    // 12. 비용 계산
    const cost = estimateCost(
      result.usage.inputTokens,
      result.usage.outputTokens,
      modelTier
    );

    return {
      studentId,
      studentName: student.name,
      status: "success",
      plans: allPlans,
      summary: {
        totalPlans: allPlans.length,
        totalMinutes: allPlans.reduce((sum, p) => sum + p.estimatedMinutes, 0),
        dateRange: {
          start: dates[0] || settings.startDate,
          end: dates[dates.length - 1] || settings.endDate,
        },
        subjectDistribution,
      },
      qualityScore,
      validation,
      cost: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        estimatedUSD: cost,
      },
    };
  } catch (error) {
    console.error(`[Batch Preview] 학생 ${studentId} 오류:`, error);
    return {
      studentId,
      studentName: "Unknown",
      status: "error",
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

// ============================================
// 배치 미리보기 생성
// ============================================

interface BatchPreviewInput {
  students: Array<{
    studentId: string;
    contentIds: string[];
  }>;
  settings: BatchPlanSettings;
}

async function _generateBatchPreview(
  input: BatchPreviewInput
): Promise<BatchPreviewResult> {
  // 권한 확인
  const user = await getCurrentUser();
  if (!user || !["admin", "consultant"].includes(user.role)) {
    throw new AppError(
      "관리자 또는 컨설턴트 권한이 필요합니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  const tenantContext = await requireTenantContext();
  const supabase = await createSupabaseServerClient();

  const { students, settings } = input;

  if (!students || students.length === 0) {
    throw new AppError(
      "처리할 학생이 없습니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  const previews: StudentPlanPreview[] = [];
  const CONCURRENCY_LIMIT = 3;

  // 배치 처리
  for (let i = 0; i < students.length; i += CONCURRENCY_LIMIT) {
    const batch = students.slice(i, i + CONCURRENCY_LIMIT);

    const batchResults = await Promise.all(
      batch.map((s) =>
        generatePreviewForStudent(
          supabase,
          tenantContext.tenantId,
          s.studentId,
          s.contentIds,
          settings
        )
      )
    );

    previews.push(...batchResults);

    // 레이트 리밋 방지
    if (i + CONCURRENCY_LIMIT < students.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // 요약 계산
  const succeeded = previews.filter((p) => p.status === "success").length;
  const failed = previews.filter((p) => p.status === "error").length;
  const skipped = previews.filter((p) => p.status === "skipped").length;
  const totalPlans = previews.reduce((sum, p) => sum + (p.summary?.totalPlans || 0), 0);
  const totalCost = previews.reduce((sum, p) => sum + (p.cost?.estimatedUSD || 0), 0);

  const qualityScores = previews
    .filter((p) => p.qualityScore)
    .map((p) => p.qualityScore!.overall);
  const averageQualityScore =
    qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : 0;

  return {
    success: true,
    previews,
    summary: {
      total: students.length,
      succeeded,
      failed,
      skipped,
      totalPlans,
      totalCost,
      averageQualityScore: Math.round(averageQualityScore),
    },
  };
}

export const generateBatchPreview = withErrorHandlingSafe(_generateBatchPreview);

// ============================================
// 미리보기에서 저장
// ============================================

async function _saveFromPreview(
  input: PreviewToSaveInput
): Promise<PreviewSaveResult> {
  const user = await getCurrentUser();
  if (!user || !["admin", "consultant"].includes(user.role)) {
    throw new AppError(
      "관리자 또는 컨설턴트 권한이 필요합니다.",
      ErrorCode.FORBIDDEN,
      403,
      true
    );
  }

  const tenantContext = await requireTenantContext();
  const supabase = await createSupabaseServerClient();

  const { studentIds, previews, planGroupNameTemplate } = input;

  // 선택된 학생의 미리보기만 필터링
  const selectedPreviews = previews.filter(
    (p) => studentIds.includes(p.studentId) && p.status === "success" && p.plans
  );

  const results: PreviewSaveResult["results"] = [];

  for (const preview of selectedPreviews) {
    try {
      // 플랜 그룹 생성
      const groupName = planGroupNameTemplate
        .replace("{startDate}", preview.summary?.dateRange.start || "")
        .replace("{endDate}", preview.summary?.dateRange.end || "")
        .replace("{studentName}", preview.studentName);

      const { data: planGroup, error: groupError } = await supabase
        .from("plan_groups")
        .insert({
          student_id: preview.studentId,
          tenant_id: tenantContext.tenantId,
          name: groupName,
          start_date: preview.summary?.dateRange.start,
          end_date: preview.summary?.dateRange.end,
          source: "ai",
        })
        .select("id")
        .single();

      if (groupError || !planGroup) {
        results.push({
          studentId: preview.studentId,
          studentName: preview.studentName,
          status: "error",
          error: groupError?.message || "플랜 그룹 생성 실패",
        });
        continue;
      }

      // 플랜 저장
      const plansToInsert = preview.plans!.map((plan) => ({
        student_id: preview.studentId,
        tenant_id: tenantContext.tenantId,
        plan_group_id: planGroup.id,
        content_id: plan.contentId,
        plan_date: plan.date,
        start_time: plan.startTime,
        end_time: plan.endTime,
        estimated_minutes: plan.estimatedMinutes,
        range_start: plan.rangeStart,
        range_end: plan.rangeEnd,
        notes: plan.notes,
        is_review: plan.isReview,
        source: "ai",
      }));

      const { error: plansError } = await supabase
        .from("student_plans")
        .insert(plansToInsert);

      if (plansError) {
        results.push({
          studentId: preview.studentId,
          studentName: preview.studentName,
          status: "error",
          error: plansError.message,
        });
        continue;
      }

      results.push({
        studentId: preview.studentId,
        studentName: preview.studentName,
        planGroupId: planGroup.id,
        status: "success",
      });
    } catch (error) {
      results.push({
        studentId: preview.studentId,
        studentName: preview.studentName,
        status: "error",
        error: error instanceof Error ? error.message : "저장 중 오류 발생",
      });
    }
  }

  // 캐시 무효화
  revalidatePath("/admin/students");

  return {
    success: results.some((r) => r.status === "success"),
    results,
    summary: {
      total: selectedPreviews.length,
      succeeded: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "error").length,
    },
  };
}

export const saveFromPreview = withErrorHandlingSafe(_saveFromPreview);
