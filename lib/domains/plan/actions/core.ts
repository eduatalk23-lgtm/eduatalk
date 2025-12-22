"use server";

/**
 * Plan 도메인 Server Actions
 *
 * 권한 검증 + Service 호출 + 캐시 재검증을 담당합니다.
 * 비즈니스 로직은 service.ts에 있습니다.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AppError, ErrorCode } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordHistory } from "@/lib/history/record";
import { fetchContentTotal, type ContentType } from "@/lib/data/contentTotal";
import * as service from "../service";
import type {
  PlanGroupCreateResult,
  PlanGroupUpdateResult,
  PlanActionResult,
  PlanGroupInsert,
  PlanGroupUpdate,
  StudentPlanInsert,
  StudentPlanUpdate,
  PlanExclusionInsert,
  PlanContentInsert,
} from "../types";
// 도메인 타입은 service와 동일한 소스에서 import (타입 호환성 유지)
import type {
  PlanGroup,
  PlanExclusion,
  PlanContent,
  PlanPurpose,
} from "@/lib/types/plan";

// ============================================
// Context Helper
// ============================================

interface PlanServiceContext {
  userId: string;
  tenantId: string | null;
  studentId: string;
}

async function getServiceContext(): Promise<PlanServiceContext> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  return {
    userId: user.userId,
    tenantId: user.tenantId,
    studentId: user.userId,
  };
}

// ============================================
// Plan Group Actions
// ============================================

/**
 * 플랜 그룹 생성
 */
export async function createPlanGroup(
  input: Omit<PlanGroupInsert, "student_id" | "tenant_id">
): Promise<PlanGroupCreateResult> {
  try {
    const ctx = await getServiceContext();

    // Partial<PlanGroup>으로 변환 (Supabase Insert 타입 → 도메인 타입)
    const data = {
      ...input,
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId ?? undefined,
      plan_purpose: input.plan_purpose as PlanPurpose | null | undefined,
    } as Partial<PlanGroup>;

    const result = await service.createPlanGroup(data);

    if (result.success) {
      revalidatePath("/plan");
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 그룹 생성 중 오류가 발생했습니다",
    };
  }
}

/**
 * 플랜 그룹 수정
 */
export async function updatePlanGroup(
  groupId: string,
  updates: PlanGroupUpdate
): Promise<PlanGroupUpdateResult> {
  try {
    const ctx = await getServiceContext();

    // Partial<PlanGroup>으로 변환 (Supabase Update 타입 → 도메인 타입)
    const data = {
      ...updates,
      plan_purpose: updates.plan_purpose as PlanPurpose | null | undefined,
    } as Partial<PlanGroup>;

    const result = await service.updatePlanGroup(groupId, ctx.studentId, data);

    if (result.success) {
      revalidatePath("/plan");
      revalidatePath(`/plan/group/${groupId}`);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 그룹 수정 중 오류가 발생했습니다",
    };
  }
}

/**
 * 플랜 그룹 상태 업데이트
 */
export async function updatePlanGroupStatusAction(
  groupId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getServiceContext();

    const result = await service.updatePlanGroupStatus(groupId, ctx.studentId, status);

    if (result.success) {
      revalidatePath("/plan");
      revalidatePath(`/plan/group/${groupId}`);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "상태 업데이트 중 오류가 발생했습니다",
    };
  }
}

/**
 * 플랜 그룹 삭제
 */
export async function deletePlanGroup(
  groupId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getServiceContext();

    const result = await service.deletePlanGroup(groupId, ctx.studentId);

    if (result.success) {
      revalidatePath("/plan");
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 그룹 삭제 중 오류가 발생했습니다",
    };
  }
}

// ============================================
// Student Plan Actions
// ============================================

/**
 * 학생 플랜 생성
 */
export async function createStudentPlan(
  input: Omit<StudentPlanInsert, "student_id" | "tenant_id">
): Promise<PlanActionResult> {
  try {
    const ctx = await getServiceContext();

    const result = await service.createStudentPlan({
      ...input,
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId,
    });

    if (result.success) {
      revalidatePath("/today");
      revalidatePath("/plan");
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 생성 중 오류가 발생했습니다",
    };
  }
}

/**
 * 학생 플랜 수정
 */
export async function updateStudentPlan(
  planId: string,
  updates: StudentPlanUpdate
): Promise<PlanActionResult> {
  try {
    const ctx = await getServiceContext();

    const result = await service.updateStudentPlan(planId, ctx.studentId, updates);

    if (result.success) {
      revalidatePath("/today");
      revalidatePath("/plan");
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 수정 중 오류가 발생했습니다",
    };
  }
}

/**
 * 학생 플랜 삭제
 */
export async function deleteStudentPlan(
  planId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getServiceContext();

    const result = await service.deleteStudentPlan(planId, ctx.studentId);

    if (result.success) {
      revalidatePath("/today");
      revalidatePath("/plan");
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 삭제 중 오류가 발생했습니다",
    };
  }
}

// ============================================
// Plan Exclusion Actions
// ============================================

/**
 * 플랜 제외일 생성
 */
export async function createPlanExclusion(
  input: Omit<PlanExclusionInsert, "student_id" | "tenant_id">
): Promise<{ success: boolean; error?: string; exclusion?: unknown }> {
  try {
    const ctx = await getServiceContext();

    // Partial<PlanExclusion>으로 변환 (Supabase Insert 타입 → 도메인 타입)
    // Note: Supabase types use `string` for enums, domain types use literal unions
    const result = await service.createPlanExclusion({
      exclusion_date: input.exclusion_date,
      exclusion_type: input.exclusion_type,
      plan_group_id: input.plan_group_id,
      reason: input.reason,
      student_id: ctx.studentId,
      tenant_id: ctx.tenantId ?? undefined,
    } as unknown as Partial<PlanExclusion>);

    if (result.success) {
      revalidatePath("/plan");
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "제외일 생성 중 오류가 발생했습니다",
    };
  }
}

/**
 * 플랜 제외일 삭제
 */
export async function deletePlanExclusion(
  exclusionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getServiceContext();

    const result = await service.deletePlanExclusion(exclusionId, ctx.studentId);

    if (result.success) {
      revalidatePath("/plan");
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "제외일 삭제 중 오류가 발생했습니다",
    };
  }
}

// ============================================
// Plan Contents Actions
// ============================================

/**
 * 플랜 콘텐츠 저장
 */
export async function savePlanContents(
  planGroupId: string,
  contents: PlanContentInsert[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await getServiceContext();

    // 콘텐츠에 tenant_id 추가하여 Partial<PlanContent>로 변환 (Supabase Insert 타입 → 도메인 타입)
    // Note: Supabase types use `null` for optional fields, domain types use `undefined`
    const contentsWithTenant = contents.map(content => ({
      ...content,
      tenant_id: ctx.tenantId ?? undefined,
      // null -> undefined 변환
      is_auto_recommended: content.is_auto_recommended ?? undefined,
    })) as unknown as Array<Partial<PlanContent>>;

    const result = await service.savePlanContents(planGroupId, contentsWithTenant);

    if (result.success) {
      revalidatePath("/plan");
      revalidatePath(`/plan/group/${planGroupId}`);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "콘텐츠 저장 중 오류가 발생했습니다",
    };
  }
}

// ============================================
// Progress Actions (from app/actions/progress.ts)
// ============================================

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 콘텐츠 진행률 업데이트 (FormData 기반)
 */
export async function updateProgress(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const planIdInput = String(formData.get("plan_id") ?? "").trim();
  const completedAmountInput = formData.get("completed_amount");

  if (!planIdInput) {
    throw new Error("플랜 ID가 필요합니다.");
  }

  const completedAmount = completedAmountInput !== null ? Number(completedAmountInput) : null;

  if (completedAmount !== null && !Number.isFinite(completedAmount)) {
    throw new Error("올바른 완료량을 입력해주세요.");
  }

  try {
    // 1. student_plan 조회
    const plan = await fetchPlan(supabase, user.id, planIdInput);
    if (!plan || !plan.content_type || !plan.content_id) {
      throw new Error("플랜을 찾을 수 없습니다.");
    }

    const contentType = toContentType(plan.content_type);
    const contentId = plan.content_id;

    // 2. 콘텐츠별 총량 조회
    const totalAmount = await fetchContentTotal(supabase, user.id, contentType, contentId);
    if (totalAmount === null || totalAmount <= 0) {
      throw new Error("콘텐츠 총량을 확인할 수 없습니다.");
    }

    // 3. 기존 progress 레코드 조회
    const existingProgress = await fetchContentProgress(supabase, user.id, contentType, contentId);

    // 4. 완료량 계산
    const currentCompleted = existingProgress?.completed_amount ?? 0;
    const newCompletedAmount = completedAmount !== null ? currentCompleted + completedAmount : currentCompleted;

    // 5. 진행률 계산
    const progress = Math.min(Math.round((newCompletedAmount / totalAmount) * 100), 100);

    // 6. insert 또는 update
    if (existingProgress) {
      await updateContentProgressRecord(supabase, user.id, existingProgress.id, newCompletedAmount, progress);
    } else {
      await insertContentProgressRecord(supabase, user.id, contentType, contentId, newCompletedAmount, progress);
    }

    // 히스토리 기록
    await recordHistory(supabase, user.id, "content_progress", {
      content_type: contentType,
      content_id: contentId,
      completed_amount: newCompletedAmount,
      progress,
      plan_id: planIdInput,
    });

    revalidatePath("/today");
    redirect("/today");
  } catch (error) {
    console.error("[progress] 진행률 업데이트 실패", error);
    if (error instanceof Error) throw error;
    throw new Error("진행률 업데이트 중 오류가 발생했습니다.");
  }
}

/**
 * 플랜 진행률 업데이트 (FormData 기반)
 */
export async function updatePlanProgress(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const planIdInput = String(formData.get("plan_id") ?? "").trim();
  const progressInput = formData.get("progress");
  const startInput = formData.get("start_page_or_time");
  const endInput = formData.get("end_page_or_time");

  if (!planIdInput) {
    throw new Error("플랜 ID가 필요합니다.");
  }

  try {
    // 1. student_plan 조회
    const plan = await fetchPlan(supabase, user.id, planIdInput);
    if (!plan || !plan.content_type || !plan.content_id) {
      throw new Error("플랜을 찾을 수 없습니다.");
    }

    const contentType = toContentType(plan.content_type);
    const contentId = plan.content_id;

    // 2. 콘텐츠별 총량 조회
    const totalAmount = await fetchContentTotal(supabase, user.id, contentType, contentId);
    if (totalAmount === null || totalAmount <= 0) {
      throw new Error("콘텐츠 총량을 확인할 수 없습니다.");
    }

    // 3. 진행률 계산
    let progress: number;
    let startPageOrTime: number | null = null;
    let endPageOrTime: number | null = null;

    if (progressInput !== null && progressInput !== "") {
      progress = Number(progressInput);
      if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
        throw new Error("진행률은 0-100 사이의 값이어야 합니다.");
      }
    } else if (startInput !== null && endInput !== null) {
      const start = Number(startInput);
      const end = Number(endInput);

      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error("올바른 시작/종료 값을 입력해주세요.");
      }

      if (start < 0 || end < start) {
        throw new Error("시작 값은 0 이상이어야 하며, 종료 값은 시작 값보다 커야 합니다.");
      }

      if (end > totalAmount) {
        throw new Error(`종료 값은 총량(${totalAmount})을 초과할 수 없습니다.`);
      }

      startPageOrTime = start;
      endPageOrTime = end;
      const completedAmount = end - start;
      progress = Math.min(Math.round((completedAmount / totalAmount) * 100), 100);
    } else {
      throw new Error("진행률 또는 시작/종료 값을 입력해주세요.");
    }

    // 4. 기존 progress 레코드 조회
    const existingProgress = await fetchPlanProgressRecord(supabase, user.id, planIdInput);

    // 5. upsert
    if (existingProgress) {
      await updatePlanProgressRecord(supabase, user.id, existingProgress.id, progress, startPageOrTime, endPageOrTime);
    } else {
      await insertPlanProgressRecord(supabase, user.id, planIdInput, progress, startPageOrTime, endPageOrTime);
    }

    revalidatePath("/plan");
  } catch (error) {
    console.error("[progress] 플랜 진행률 업데이트 실패", error);
    if (error instanceof Error) throw error;
    throw new Error("진행률 업데이트 중 오류가 발생했습니다.");
  }
}

// ============================================
// Progress Helper Functions
// ============================================

type PlanRow = {
  id: string;
  content_type?: string | null;
  content_id?: string | null;
};

type ContentProgressRow = {
  id: string;
  completed_amount?: number | null;
};

type PlanProgressRow = {
  id: string;
  progress?: number | null;
};

async function fetchPlan(
  supabase: SupabaseServerClient,
  studentId: string,
  planId: string
): Promise<PlanRow | null> {
  const { data, error } = await supabase
    .from("student_plan")
    .select("id,content_type,content_id")
    .eq("id", planId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) {
    console.error("[progress] 플랜 조회 실패", error);
    return null;
  }
  return data;
}

async function fetchContentProgress(
  supabase: SupabaseServerClient,
  studentId: string,
  contentType: ContentType,
  contentId: string
): Promise<ContentProgressRow | null> {
  const { data, error } = await supabase
    .from("student_content_progress")
    .select("id,completed_amount")
    .eq("student_id", studentId)
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("[progress] 진행률 조회 실패", error);
  }
  return data;
}

async function insertContentProgressRecord(
  supabase: SupabaseServerClient,
  studentId: string,
  contentType: ContentType,
  contentId: string,
  completedAmount: number,
  progress: number
): Promise<void> {
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", studentId)
    .single();

  if (!student?.tenant_id) {
    throw new Error("학생 정보를 찾을 수 없습니다.");
  }

  const { error } = await supabase.from("student_content_progress").insert({
    student_id: studentId,
    tenant_id: student.tenant_id,
    content_type: contentType,
    content_id: contentId,
    completed_amount: completedAmount,
    progress: progress,
    last_updated: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
}

async function updateContentProgressRecord(
  supabase: SupabaseServerClient,
  studentId: string,
  progressId: string,
  completedAmount: number,
  progress: number
): Promise<void> {
  const { error } = await supabase
    .from("student_content_progress")
    .update({
      completed_amount: completedAmount,
      progress: progress,
      last_updated: new Date().toISOString(),
    })
    .eq("id", progressId)
    .eq("student_id", studentId);

  if (error) throw new Error(error.message);
}

async function fetchPlanProgressRecord(
  supabase: SupabaseServerClient,
  studentId: string,
  planId: string
): Promise<PlanProgressRow | null> {
  const { data, error } = await supabase
    .from("student_content_progress")
    .select("id,progress")
    .eq("student_id", studentId)
    .eq("plan_id", planId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("[progress] 진행률 조회 실패", error);
  }
  return data;
}

async function insertPlanProgressRecord(
  supabase: SupabaseServerClient,
  studentId: string,
  planId: string,
  progress: number,
  startPageOrTime: number | null,
  endPageOrTime: number | null
): Promise<void> {
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", studentId)
    .single();

  if (!student?.tenant_id) {
    throw new Error("학생 정보를 찾을 수 없습니다.");
  }

  const { error } = await supabase.from("student_content_progress").insert({
    student_id: studentId,
    tenant_id: student.tenant_id,
    plan_id: planId,
    progress: progress,
    start_page_or_time: startPageOrTime,
    end_page_or_time: endPageOrTime,
    last_updated: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
}

async function updatePlanProgressRecord(
  supabase: SupabaseServerClient,
  studentId: string,
  progressId: string,
  progress: number,
  startPageOrTime: number | null,
  endPageOrTime: number | null
): Promise<void> {
  const { error } = await supabase
    .from("student_content_progress")
    .update({
      progress: progress,
      start_page_or_time: startPageOrTime,
      end_page_or_time: endPageOrTime,
      last_updated: new Date().toISOString(),
    })
    .eq("id", progressId)
    .eq("student_id", studentId);

  if (error) throw new Error(error.message);
}

function toContentType(raw?: string | null): ContentType {
  if (raw === "lecture" || raw === "custom") {
    return raw;
  }
  return "book";
}
