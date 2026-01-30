"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { revalidatePath } from "next/cache";

// ============================================
// Types
// ============================================

export type ReorderWithTimeResult = {
  success: boolean;
  error?: string;
  updatedPlans?: Array<{
    id: string;
    sequence: number;
    start_time: string;
    end_time: string;
  }>;
};

interface ReorderInput {
  /** 새로운 순서대로 정렬된 플랜 ID 배열 */
  planIds: string[];
  studentId: string;
  planDate: string;
  /** 기준 시작 시간 (기본: 첫 플랜의 기존 start_time) */
  baseStartTime?: string;
}

// ============================================
// Time Utilities
// ============================================

/**
 * "HH:mm" 형식의 시간 문자열을 분 단위로 변환
 */
function parseTime(time: string): number {
  const [h, m] = time.substring(0, 5).split(":").map(Number);
  return h * 60 + m;
}

/**
 * 분 단위 시간을 "HH:mm" 형식으로 변환
 */
function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ============================================
// Time Calculation
// ============================================

interface PlanForTimeCalc {
  id: string;
  estimated_minutes: number | null;
  start_time: string | null;
}

/**
 * 플랜들의 시간을 순차적으로 재계산
 */
function calculatePlanTimes(
  plans: PlanForTimeCalc[],
  baseStartTime: string
): Array<{
  id: string;
  sequence: number;
  start_time: string;
  end_time: string;
}> {
  let currentTime = parseTime(baseStartTime);

  return plans.map((plan, index) => {
    const duration = plan.estimated_minutes ?? 30; // 기본 30분
    const startTime = formatTime(currentTime);
    const endTime = formatTime(currentTime + duration);
    currentTime += duration;

    return {
      id: plan.id,
      sequence: index + 1,
      start_time: startTime,
      end_time: endTime,
    };
  });
}

// ============================================
// Server Action
// ============================================

/**
 * 플랜 순서 변경 + 시간 자동 재계산
 *
 * DailyDock에서 드래그앤드롭으로 순서를 변경할 때 사용합니다.
 * 순서(sequence)와 시간(start_time, end_time)을 일괄 업데이트합니다.
 */
export async function reorderPlansWithTimeRecalculation(
  input: ReorderInput
): Promise<ReorderWithTimeResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { planIds, studentId, planDate, baseStartTime } = input;

    if (planIds.length === 0) {
      return { success: false, error: "No plans to reorder" };
    }

    // 권한 확인 (관리자 또는 해당 학생)
    const isAdmin = user.role === "admin" || user.role === "superadmin";
    const isOwner = studentId === user.userId;
    if (!isAdmin && !isOwner) {
      return { success: false, error: "Permission denied" };
    }

    const supabase = await createSupabaseServerClient();

    // 플랜 정보 조회 (estimated_minutes, start_time 필요)
    const { data: plans, error: fetchError } = await supabase
      .from("student_plan")
      .select("id, estimated_minutes, start_time, student_id, plan_date")
      .in("id", planIds);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!plans || plans.length === 0) {
      return { success: false, error: "Plans not found" };
    }

    // 모든 플랜이 같은 학생, 같은 날짜인지 확인
    const uniqueStudents = [...new Set(plans.map((p) => p.student_id))];
    const uniqueDates = [...new Set(plans.map((p) => p.plan_date))];

    if (uniqueStudents.length > 1) {
      return { success: false, error: "All plans must belong to same student" };
    }
    if (uniqueDates.length > 1) {
      return { success: false, error: "All plans must be on the same date" };
    }

    // planIds 순서대로 플랜 정렬
    const planMap = new Map(plans.map((p) => [p.id, p]));
    const orderedPlans = planIds
      .map((id) => planMap.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (orderedPlans.length !== planIds.length) {
      return {
        success: false,
        error: "Some plans not found or invalid",
      };
    }

    // 기준 시작 시간 결정
    // 1. 명시적으로 전달된 baseStartTime
    // 2. 첫 번째 플랜의 기존 start_time
    // 3. 기본값 "09:00"
    const effectiveBaseTime =
      baseStartTime ??
      orderedPlans[0]?.start_time?.substring(0, 5) ??
      "09:00";

    // 시간 재계산
    const updatedPlans = calculatePlanTimes(orderedPlans, effectiveBaseTime);

    // 개별 업데이트 실행 (Supabase는 bulk upsert with different values가 불편함)
    for (const plan of updatedPlans) {
      const { error: updateError } = await supabase
        .from("student_plan")
        .update({
          sequence: plan.sequence,
          start_time: plan.start_time,
          end_time: plan.end_time,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plan.id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    // 캐시 무효화
    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath("/today");

    return {
      success: true,
      updatedPlans,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
