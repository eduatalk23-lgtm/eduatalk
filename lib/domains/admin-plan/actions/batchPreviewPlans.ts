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
import type { GroundingConfig } from "@/lib/domains/plan/llm/providers/base";
import { getWebSearchContentService } from "@/lib/domains/plan/llm/services/webSearchContentService";
import type {
  AcademyScheduleForPrompt,
  BlockInfoForPrompt,
} from "@/lib/domains/plan/llm/transformers/requestBuilder";
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
import type { PreviewStreamingOptions } from "../types/streaming";

// ============================================
// 데이터 로딩 함수 (재사용)
// ============================================

async function loadStudentData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  tenantId?: string
) {
  let query = supabase
    .from("students")
    .select("id, name, grade, school_id, school_type")
    .eq("id", studentId);

  // tenant_id가 제공된 경우 추가 필터링
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query.single();

  // 디버깅을 위한 상세 로깅
  if (error) {
    console.error(`[batchPreviewPlans/loadStudentData] 학생 조회 실패 - studentId: ${studentId}`, {
      error: error.message,
      code: error.code,
      details: error.details,
      tenantId: tenantId || "not provided",
    });
  }

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

  // master_books와 master_lectures 테이블에서 조회 (books/lectures 테이블 없음)
  const [booksResult, lecturesResult] = await Promise.all([
    supabase
      .from("master_books")
      .select("id, title, subject, subject_category, total_pages, estimated_hours")
      .in("id", contentIds)
      .eq("is_active", true),
    supabase
      .from("master_lectures")
      .select("id, title, subject, subject_category, total_episodes, estimated_hours")
      .in("id", contentIds)
      .eq("is_active", true),
  ]);

  const contents = [
    ...(booksResult.data || []).map((b) => ({
      id: b.id,
      title: b.title,
      subject: b.subject,
      subject_category: b.subject_category,
      content_type: "book" as const,
      total_pages: b.total_pages,
      total_lectures: null,
      estimated_hours: b.estimated_hours ? Number(b.estimated_hours) : null,
    })),
    ...(lecturesResult.data || []).map((l) => ({
      id: l.id,
      title: l.title,
      subject: l.subject,
      subject_category: l.subject_category,
      content_type: "lecture" as const,
      total_pages: null,
      total_lectures: l.total_episodes,
      estimated_hours: l.estimated_hours ? Number(l.estimated_hours) : null,
    })),
  ];

  console.log(`[loadContents] Preview - books: ${booksResult.data?.length || 0}, lectures: ${lecturesResult.data?.length || 0}`);
  return contents;
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

/**
 * 학원 일정 로드 (검증용)
 */
async function loadAcademySchedules(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  tenantId: string
): Promise<AcademyScheduleForPrompt[]> {
  const { data: schedules } = await supabase
    .from("academy_schedules")
    .select("id, day_of_week, start_time, end_time, academy_name, subject, travel_time")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (!schedules || schedules.length === 0) {
    return [];
  }

  return schedules.map((s) => ({
    id: s.id,
    dayOfWeek: s.day_of_week,
    startTime: s.start_time ? s.start_time.slice(0, 5) : "00:00", // HH:mm
    endTime: s.end_time ? s.end_time.slice(0, 5) : "00:00",
    academyName: s.academy_name || undefined,
    subject: s.subject || undefined,
    travelTime: s.travel_time ? Number(s.travel_time) : undefined,
  }));
}

/**
 * 블록셋 정보 로드 (검증용)
 */
async function loadBlockSets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string
): Promise<BlockInfoForPrompt[]> {
  // 학생의 활성 블록셋 확인
  const { data: student } = await supabase
    .from("students")
    .select("active_block_set_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student?.active_block_set_id) {
    return [];
  }

  // 활성 블록셋의 블록 스케줄 조회
  const { data: blocks } = await supabase
    .from("student_block_schedule")
    .select("id, day_of_week, start_time, end_time")
    .eq("student_id", studentId)
    .eq("block_set_id", student.active_block_set_id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (!blocks || blocks.length === 0) {
    return [];
  }

  return blocks.map((b, index) => ({
    id: b.id,
    blockIndex: index,
    dayOfWeek: b.day_of_week,
    startTime: b.start_time ? b.start_time.slice(0, 5) : "00:00", // HH:mm
    endTime: b.end_time ? b.end_time.slice(0, 5) : "00:00",
    blockName: undefined,
  }));
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
    // 1. 학생 데이터 로드 (tenantId를 전달하여 정확한 tenant 컨텍스트에서 조회)
    const student = await loadStudentData(supabase, studentId, tenantId);
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
    const [scores, contents, timeSlots, learningStats, academySchedules, blockSets] =
      await Promise.all([
        loadScores(supabase, studentId),
        loadContents(supabase, contentIds),
        loadTimeSlots(supabase, tenantId),
        loadLearningStats(supabase, studentId),
        loadAcademySchedules(supabase, studentId, tenantId),
        loadBlockSets(supabase, studentId),
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
        school_name: undefined, // students 테이블에 해당 컬럼 없음
        target_university: undefined,
        target_major: undefined,
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

    // Grounding(웹 검색) 설정 빌드
    const grounding: GroundingConfig | undefined = settings.enableWebSearch
      ? {
          enabled: true,
          mode: settings.webSearchConfig?.mode || "dynamic",
          dynamicThreshold: settings.webSearchConfig?.dynamicThreshold ?? 0.3,
        }
      : undefined;

    const result = await createMessage({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
      grounding,
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
      academySchedules,
      blockSets,
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

    // 13. Grounding 메타데이터 처리 및 저장
    let webSearchResults: StudentPlanPreview["webSearchResults"];

    if (result.groundingMetadata && settings.enableWebSearch) {
      const metadata = result.groundingMetadata;

      webSearchResults = {
        searchQueries: metadata.searchQueries || [],
        resultsCount: metadata.webResults?.length || 0,
      };

      // 검색 결과 저장 옵션이 활성화된 경우 DB에 저장
      if (settings.webSearchConfig?.saveResults && metadata.webResults?.length > 0) {
        try {
          const webSearchService = getWebSearchContentService();
          const contents = webSearchService.transformToContent(metadata, {
            tenantId,
            subject: undefined, // LLM이 추론한 subject 사용
          });

          if (contents.length > 0) {
            const saveResult = await webSearchService.saveToDatabase(contents, tenantId);
            webSearchResults.savedCount = saveResult.savedCount;
            console.log(
              `[Batch Preview] 학생 ${studentId}: 웹 검색 결과 ${saveResult.savedCount}개 저장 완료`
            );
          }
        } catch (saveError) {
          console.error(`[Batch Preview] 웹 검색 결과 저장 오류:`, saveError);
          // 저장 실패해도 플랜 생성은 계속 진행
        }
      }
    }

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
      webSearchResults,
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
          period_start: preview.summary?.dateRange.start,
          period_end: preview.summary?.dateRange.end,
          status: "active",
          creation_mode: "ai",
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
      const plansToInsert = preview.plans!.map((plan, index) => ({
        student_id: preview.studentId,
        tenant_id: tenantContext.tenantId,
        plan_group_id: planGroup.id,
        content_id: plan.contentId,
        content_type: plan.contentType || "book",
        plan_date: plan.date,
        block_index: index,
        start_time: plan.startTime,
        end_time: plan.endTime,
        estimated_minutes: plan.estimatedMinutes,
        planned_start_page_or_time: plan.rangeStart,
        planned_end_page_or_time: plan.rangeEnd,
        memo: plan.notes,
        status: "pending",
      }));

      const { error: plansError } = await supabase
        .from("student_plan")
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

// ============================================
// 스트리밍 미리보기 생성 (Phase 3)
// ============================================

interface BatchPreviewStreamingInput extends BatchPreviewInput {
  streamingOptions?: PreviewStreamingOptions;
}

/**
 * 스트리밍을 지원하는 배치 미리보기 생성
 *
 * 학생별로 진행 상태를 실시간 스트리밍합니다.
 * 미리보기에서는 웹 검색(Grounding)을 비활성화하여 속도를 높입니다.
 */
export async function generateBatchPreviewWithStreaming(
  input: BatchPreviewStreamingInput
): Promise<BatchPreviewResult> {
  const { students, settings, streamingOptions } = input;
  const send = streamingOptions?.onProgress;
  const signal = streamingOptions?.signal;

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

  if (!students || students.length === 0) {
    throw new AppError(
      "처리할 학생이 없습니다.",
      ErrorCode.INVALID_INPUT,
      400,
      true
    );
  }

  // 시작 이벤트
  send?.({
    type: "preview_start",
    progress: 0,
    total: students.length,
    timestamp: Date.now(),
    studentIds: students.map((s) => s.studentId),
  });

  const previews: StudentPlanPreview[] = [];

  // 순차 처리 (스트리밍에서는 동시성 제한 없이 순차 처리)
  for (let i = 0; i < students.length; i++) {
    // 취소 확인
    if (signal?.aborted) {
      break;
    }

    const student = students[i];

    // 학생 이름 조회 (시작 이벤트용)
    const studentData = await loadStudentData(
      supabase,
      student.studentId,
      tenantContext.tenantId
    );
    const studentName = studentData?.name || "Unknown";

    // 학생 시작 이벤트
    send?.({
      type: "preview_student_start",
      progress: i,
      total: students.length,
      timestamp: Date.now(),
      studentId: student.studentId,
      studentName,
    });

    try {
      // 미리보기 생성 (Grounding 비활성화 - 속도 우선)
      const settingsWithoutGrounding: BatchPlanSettings = {
        ...settings,
        enableWebSearch: false, // 미리보기에서는 웹 검색 비활성화
      };

      const preview = await generatePreviewForStudent(
        supabase,
        tenantContext.tenantId,
        student.studentId,
        student.contentIds,
        settingsWithoutGrounding
      );

      previews.push(preview);

      // 학생 완료 이벤트
      send?.({
        type: "preview_student_complete",
        progress: i + 1,
        total: students.length,
        timestamp: Date.now(),
        studentId: student.studentId,
        studentName: preview.studentName,
        preview,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";

      const errorPreview: StudentPlanPreview = {
        studentId: student.studentId,
        studentName,
        status: "error",
        error: errorMessage,
      };

      previews.push(errorPreview);

      // 학생 오류 이벤트
      send?.({
        type: "preview_student_error",
        progress: i + 1,
        total: students.length,
        timestamp: Date.now(),
        studentId: student.studentId,
        studentName,
        error: errorMessage,
      });
    }
  }

  // 요약 계산
  const succeeded = previews.filter((p) => p.status === "success").length;
  const failed = previews.filter((p) => p.status === "error").length;
  const skipped = previews.filter((p) => p.status === "skipped").length;
  const totalPlans = previews.reduce(
    (sum, p) => sum + (p.summary?.totalPlans || 0),
    0
  );
  const totalCost = previews.reduce(
    (sum, p) => sum + (p.cost?.estimatedUSD || 0),
    0
  );

  const qualityScores = previews
    .filter((p) => p.qualityScore)
    .map((p) => p.qualityScore!.overall);
  const averageQualityScore =
    qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : 0;

  const summary = {
    total: students.length,
    succeeded,
    failed,
    skipped,
    totalPlans,
    totalCost,
    averageQualityScore: Math.round(averageQualityScore),
  };

  // 완료 이벤트
  send?.({
    type: "preview_complete",
    progress: students.length,
    total: students.length,
    timestamp: Date.now(),
    previews,
    summary,
  });

  return {
    success: true,
    previews,
    summary,
  };
}
