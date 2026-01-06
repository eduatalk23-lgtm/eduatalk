"use server";

/**
 * 플랜 배치 생성 Server Actions
 *
 * 여러 학생에게 동시에 플랜을 생성하기 위한 API
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import type { CreationMethod } from "../_types";

// ============================================
// 공통 타입 정의
// ============================================

export interface BatchStudentInput {
  studentId: string;
  studentName: string;
  tenantId?: string; // Optional - will be filled from current user if not provided
}

export interface BatchResult {
  studentId: string;
  studentName: string;
  success: boolean;
  message: string;
  planGroupId?: string;
  planId?: string;
  error?: string;
}

export interface BatchResponse {
  success: boolean;
  results: BatchResult[];
  successCount: number;
  failedCount: number;
  error?: string;
}

// ============================================
// 빠른 플랜 (QuickPlan) 배치 생성
// ============================================

export interface QuickPlanBatchInput {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  memo?: string;
  estimatedMinutes?: number;
}

/**
 * 여러 학생에게 빠른 플랜(Ad-hoc) 생성
 */
export async function createBatchQuickPlans(
  students: BatchStudentInput[],
  settings: QuickPlanBatchInput
): Promise<BatchResponse> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const results: BatchResult[] = [];

    for (const student of students) {
      try {
        // 사용자가 전달하지 않은 경우 현재 사용자의 tenantId 사용
        const studentTenantId = student.tenantId ?? tenantId;

        // 1. 학생의 기본 플랜 그룹 찾기 또는 생성
        let planGroupId: string;

        // 기존 활성 플랜 그룹 찾기
        const { data: existingGroup } = await supabase
          .from("plan_groups")
          .select("id")
          .eq("student_id", student.studentId)
          .eq("tenant_id", studentTenantId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingGroup) {
          planGroupId = existingGroup.id;
        } else {
          // 기본 플랜 그룹 생성
          const { data: newGroup, error: groupError } = await supabase
            .from("plan_groups")
            .insert({
              student_id: student.studentId,
              tenant_id: studentTenantId,
              name: `${settings.date} 빠른 플랜`,
              period_start: settings.date,
              period_end: settings.date,
              status: "active",
              creation_mode: "calendar_only",
              created_by: userId,
            })
            .select("id")
            .single();

          if (groupError || !newGroup) {
            results.push({
              studentId: student.studentId,
              studentName: student.studentName,
              success: false,
              message: "플랜 그룹 생성 실패",
              error: groupError?.message || "알 수 없는 오류",
            });
            continue;
          }
          planGroupId = newGroup.id;
        }

        // 2. Ad-hoc 플랜 생성
        const estimatedMinutes =
          settings.estimatedMinutes ||
          calculateMinutesDiff(settings.startTime, settings.endTime);

        const { data: adHocPlan, error: planError } = await supabase
          .from("ad_hoc_plans")
          .insert({
            tenant_id: studentTenantId,
            student_id: student.studentId,
            plan_group_id: planGroupId,
            title: settings.title,
            description: settings.memo || null,
            plan_date: settings.date,
            start_time: settings.startTime,
            end_time: settings.endTime,
            estimated_minutes: estimatedMinutes,
            container_type: "daily",
            status: "pending",
            created_by: userId,
          })
          .select("id")
          .single();

        if (planError || !adHocPlan) {
          results.push({
            studentId: student.studentId,
            studentName: student.studentName,
            success: false,
            message: "플랜 생성 실패",
            error: planError?.message || "알 수 없는 오류",
          });
          continue;
        }

        results.push({
          studentId: student.studentId,
          studentName: student.studentName,
          success: true,
          message: `"${settings.title}" 플랜이 추가되었습니다`,
          planId: adHocPlan.id,
          planGroupId,
        });
      } catch (err) {
        results.push({
          studentId: student.studentId,
          studentName: student.studentName,
          success: false,
          message: "플랜 생성 중 오류 발생",
          error: err instanceof Error ? err.message : "알 수 없는 오류",
        });
      }
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/plan-creation");

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return {
      success: failedCount === 0,
      results,
      successCount,
      failedCount,
    };
  } catch (err) {
    return {
      success: false,
      results: [],
      successCount: 0,
      failedCount: students.length,
      error: err instanceof Error ? err.message : "배치 처리 실패",
    };
  }
}

// ============================================
// 플랜 그룹 (PlanGroup) 배치 생성
// ============================================

export interface PlanGroupBatchInput {
  name: string;
  startDate: string;
  endDate: string;
  dailyStudyMinutes: number;
  daysPerWeek: number[];
}

/**
 * 여러 학생에게 플랜 그룹 생성
 */
export async function createBatchPlanGroups(
  students: BatchStudentInput[],
  settings: PlanGroupBatchInput
): Promise<BatchResponse> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const results: BatchResult[] = [];

    for (const student of students) {
      try {
        // 사용자가 전달하지 않은 경우 현재 사용자의 tenantId 사용
        const studentTenantId = student.tenantId ?? tenantId;

        // 플랜 그룹 생성
        const { data: planGroup, error: groupError } = await supabase
          .from("plan_groups")
          .insert({
            student_id: student.studentId,
            tenant_id: studentTenantId,
            name: settings.name,
            period_start: settings.startDate,
            period_end: settings.endDate,
            status: "active",
            creation_mode: "calendar_only",
            daily_study_minutes: settings.dailyStudyMinutes,
            study_days: settings.daysPerWeek,
            created_by: userId,
          })
          .select("id")
          .single();

        if (groupError || !planGroup) {
          results.push({
            studentId: student.studentId,
            studentName: student.studentName,
            success: false,
            message: "플랜 그룹 생성 실패",
            error: groupError?.message || "알 수 없는 오류",
          });
          continue;
        }

        results.push({
          studentId: student.studentId,
          studentName: student.studentName,
          success: true,
          message: `"${settings.name}" 플랜 그룹이 생성되었습니다`,
          planGroupId: planGroup.id,
        });
      } catch (err) {
        results.push({
          studentId: student.studentId,
          studentName: student.studentName,
          success: false,
          message: "플랜 그룹 생성 중 오류 발생",
          error: err instanceof Error ? err.message : "알 수 없는 오류",
        });
      }
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/plan-creation");

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return {
      success: failedCount === 0,
      results,
      successCount,
      failedCount,
    };
  } catch (err) {
    return {
      success: false,
      results: [],
      successCount: 0,
      failedCount: students.length,
      error: err instanceof Error ? err.message : "배치 처리 실패",
    };
  }
}

// ============================================
// 콘텐츠 추가 (Content) 배치 처리
// ============================================

export interface ContentBatchInput {
  contentIds: string[];
  distributionStrategy: "even" | "front-loaded" | "back-loaded";
}

export interface ContentInfo {
  id: string;
  title: string;
  contentType: "book" | "lecture" | "custom";
  estimatedMinutes?: number;
}

/**
 * 여러 학생의 활성 플랜 그룹에 콘텐츠 추가
 */
export async function addBatchContents(
  students: BatchStudentInput[],
  settings: ContentBatchInput,
  contents: ContentInfo[]
): Promise<BatchResponse> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const results: BatchResult[] = [];

    for (const student of students) {
      try {
        // 사용자가 전달하지 않은 경우 현재 사용자의 tenantId 사용
        const studentTenantId = student.tenantId ?? tenantId;

        // 1. 학생의 활성 플랜 그룹 찾기
        const { data: planGroup } = await supabase
          .from("plan_groups")
          .select("id")
          .eq("student_id", student.studentId)
          .eq("tenant_id", studentTenantId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!planGroup) {
          results.push({
            studentId: student.studentId,
            studentName: student.studentName,
            success: false,
            message: "활성 플랜 그룹이 없습니다",
          });
          continue;
        }

        // 2. 콘텐츠 추가 (plan_contents 테이블에)
        const contentInserts = contents.map((content, index) => ({
          plan_group_id: planGroup.id,
          content_type: content.contentType,
          content_id: content.id,
          display_order: index + 1,
          generation_status: "pending",
        }));

        const { error: contentError } = await supabase
          .from("plan_contents")
          .insert(contentInserts);

        if (contentError) {
          results.push({
            studentId: student.studentId,
            studentName: student.studentName,
            success: false,
            message: "콘텐츠 추가 실패",
            error: contentError.message,
          });
          continue;
        }

        results.push({
          studentId: student.studentId,
          studentName: student.studentName,
          success: true,
          message: `${contents.length}개의 콘텐츠가 추가되었습니다`,
          planGroupId: planGroup.id,
        });
      } catch (err) {
        results.push({
          studentId: student.studentId,
          studentName: student.studentName,
          success: false,
          message: "콘텐츠 추가 중 오류 발생",
          error: err instanceof Error ? err.message : "알 수 없는 오류",
        });
      }
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/plan-creation");

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return {
      success: failedCount === 0,
      results,
      successCount,
      failedCount,
    };
  } catch (err) {
    return {
      success: false,
      results: [],
      successCount: 0,
      failedCount: students.length,
      error: err instanceof Error ? err.message : "배치 처리 실패",
    };
  }
}

// ============================================
// 유틸리티 함수
// ============================================

function calculateMinutesDiff(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}
