"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export type PlanType = "student_plan" | "ad_hoc_plan";

export interface DragDropResult {
  success: boolean;
  error?: string;
  planId?: string;
  newDate?: string;
  newStartTime?: string;
  /** 충돌이 감지된 경우 충돌하는 플랜 정보 */
  conflictingPlan?: {
    id: string;
    contentTitle?: string;
    startTime?: string;
    endTime?: string;
  };
}

/**
 * 시간대 겹침 여부 확인
 */
function checkTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const aStart = toMinutes(startA);
  const aEnd = toMinutes(endA);
  const bStart = toMinutes(startB);
  const bEnd = toMinutes(endB);

  // 겹치지 않는 경우: A가 B보다 완전히 앞이거나 완전히 뒤
  return !(aEnd <= bStart || aStart >= bEnd);
}

/**
 * 달력 드래그앤드롭으로 플랜 날짜/시간 변경
 * student_plan과 ad_hoc_plans 모두 지원
 */
export async function rescheduleOnDrop(
  planId: string,
  planType: PlanType,
  newDate: string,
  newStartTime?: string
): Promise<DragDropResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    if (planType === "student_plan") {
      // 기존 플랜 조회
      const { data: existingPlan, error: fetchError } = await supabase
        .from("student_plan")
        .select("id, plan_date, start_time, end_time, student_id, content_title, plan_groups!inner(student_id)")
        .eq("id", planId)
        .single();

      if (fetchError || !existingPlan) {
        return { success: false, error: "플랜을 찾을 수 없습니다." };
      }

      // 권한 확인
      const isAdmin = user.role === "admin" || user.role === "superadmin";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isOwner = (existingPlan as any).plan_groups?.student_id === user.userId;
      if (!isAdmin && !isOwner) {
        return { success: false, error: "권한이 없습니다." };
      }

      // 이동할 시간 계산
      let newEndTime: string | undefined;
      if (newStartTime && existingPlan.start_time && existingPlan.end_time) {
        const [startH, startM] = existingPlan.start_time.split(":").map(Number);
        const [endH, endM] = existingPlan.end_time.split(":").map(Number);
        const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

        const [newH, newM] = newStartTime.split(":").map(Number);
        const newEndMinutes = newH * 60 + newM + durationMinutes;
        const newEndH = Math.floor(newEndMinutes / 60) % 24;
        const newEndM = newEndMinutes % 60;
        newEndTime = `${String(newEndH).padStart(2, "0")}:${String(newEndM).padStart(2, "0")}`;
      }

      // 충돌 감지: 같은 날짜에 시간대가 겹치는 플랜이 있는지 확인
      if (newStartTime && newEndTime) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const studentId = (existingPlan as any).plan_groups?.student_id || user.userId;

        const { data: conflictingPlans } = await supabase
          .from("student_plan")
          .select("id, start_time, end_time, content_title")
          .eq("plan_date", newDate)
          .eq("student_id", studentId)
          .neq("id", planId)
          .not("start_time", "is", null)
          .not("end_time", "is", null);

        if (conflictingPlans && conflictingPlans.length > 0) {
          for (const plan of conflictingPlans) {
            if (plan.start_time && plan.end_time) {
              const hasOverlap = checkTimeOverlap(
                newStartTime,
                newEndTime,
                plan.start_time,
                plan.end_time
              );

              if (hasOverlap) {
                return {
                  success: false,
                  error: `이 시간대에 다른 플랜이 있습니다: "${plan.content_title || "플랜"}" (${plan.start_time} ~ ${plan.end_time})`,
                  conflictingPlan: {
                    id: plan.id,
                    contentTitle: plan.content_title || undefined,
                    startTime: plan.start_time,
                    endTime: plan.end_time,
                  },
                };
              }
            }
          }
        }

        // ad_hoc_plans와도 충돌 확인 (같은 학생의 모든 플랜과 충돌 방지)
        const { data: conflictingAdHocPlans } = await supabase
          .from("ad_hoc_plans")
          .select("id, start_time, end_time, title")
          .eq("plan_date", newDate)
          .eq("student_id", studentId)
          .not("start_time", "is", null)
          .not("end_time", "is", null);

        if (conflictingAdHocPlans && conflictingAdHocPlans.length > 0) {
          for (const plan of conflictingAdHocPlans) {
            if (plan.start_time && plan.end_time) {
              const hasOverlap = checkTimeOverlap(
                newStartTime,
                newEndTime,
                plan.start_time,
                plan.end_time
              );

              if (hasOverlap) {
                return {
                  success: false,
                  error: `이 시간대에 다른 플랜이 있습니다: "${plan.title || "플랜"}" (${plan.start_time} ~ ${plan.end_time})`,
                  conflictingPlan: {
                    id: plan.id,
                    contentTitle: plan.title || undefined,
                    startTime: plan.start_time,
                    endTime: plan.end_time,
                  },
                };
              }
            }
          }
        }
      }

      // 업데이트 데이터 구성
      const updateData: Record<string, unknown> = {
        plan_date: newDate,
        updated_at: new Date().toISOString(),
      };

      // 시간이 제공된 경우 설정
      if (newStartTime) {
        updateData.start_time = newStartTime;
        if (newEndTime) {
          updateData.end_time = newEndTime;
        }
      }

      const { error: updateError } = await supabase
        .from("student_plan")
        .update(updateData)
        .eq("id", planId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    } else if (planType === "ad_hoc_plan") {
      // ad_hoc_plan 조회
      const { data: existingPlan, error: fetchError } = await supabase
        .from("ad_hoc_plans")
        .select("id, plan_date, start_time, end_time, student_id")
        .eq("id", planId)
        .single();

      if (fetchError || !existingPlan) {
        return { success: false, error: "플랜을 찾을 수 없습니다." };
      }

      // 권한 확인 (자기 자신의 플랜만 수정 가능)
      if (existingPlan.student_id !== user.userId) {
        return { success: false, error: "권한이 없습니다." };
      }

      // 업데이트 데이터 구성
      const updateData: Record<string, unknown> = {
        plan_date: newDate,
        updated_at: new Date().toISOString(),
      };

      // 시간이 제공된 경우 설정
      let newEndTime: string | undefined;
      if (newStartTime) {
        updateData.start_time = newStartTime;

        // 기존 플랜의 지속 시간 계산 후 end_time 설정
        if (existingPlan.start_time && existingPlan.end_time) {
          const [startH, startM] = existingPlan.start_time.split(":").map(Number);
          const [endH, endM] = existingPlan.end_time.split(":").map(Number);
          const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

          const [newH, newM] = newStartTime.split(":").map(Number);
          const newEndMinutes = newH * 60 + newM + durationMinutes;
          const newEndH = Math.floor(newEndMinutes / 60) % 24;
          const newEndM = newEndMinutes % 60;
          newEndTime = `${String(newEndH).padStart(2, "0")}:${String(newEndM).padStart(2, "0")}`;
          updateData.end_time = newEndTime;
        }
      }

      // 충돌 감지: 같은 날짜에 시간대가 겹치는 플랜이 있는지 확인
      if (newStartTime && newEndTime) {
        // ad_hoc_plans에서 충돌 확인
        const { data: conflictingAdHocPlans } = await supabase
          .from("ad_hoc_plans")
          .select("id, start_time, end_time, title")
          .eq("plan_date", newDate)
          .eq("student_id", user.userId)
          .neq("id", planId)
          .not("start_time", "is", null)
          .not("end_time", "is", null);

        if (conflictingAdHocPlans && conflictingAdHocPlans.length > 0) {
          for (const plan of conflictingAdHocPlans) {
            if (plan.start_time && plan.end_time) {
              const hasOverlap = checkTimeOverlap(
                newStartTime,
                newEndTime,
                plan.start_time,
                plan.end_time
              );

              if (hasOverlap) {
                return {
                  success: false,
                  error: `이 시간대에 다른 플랜이 있습니다: "${plan.title || "플랜"}" (${plan.start_time} ~ ${plan.end_time})`,
                  conflictingPlan: {
                    id: plan.id,
                    contentTitle: plan.title || undefined,
                    startTime: plan.start_time,
                    endTime: plan.end_time,
                  },
                };
              }
            }
          }
        }

        // student_plan에서도 충돌 확인 (같은 학생의 모든 플랜과 충돌 방지)
        const { data: conflictingStudentPlans } = await supabase
          .from("student_plan")
          .select("id, start_time, end_time, content_title")
          .eq("plan_date", newDate)
          .eq("student_id", user.userId)
          .not("start_time", "is", null)
          .not("end_time", "is", null);

        if (conflictingStudentPlans && conflictingStudentPlans.length > 0) {
          for (const plan of conflictingStudentPlans) {
            if (plan.start_time && plan.end_time) {
              const hasOverlap = checkTimeOverlap(
                newStartTime,
                newEndTime,
                plan.start_time,
                plan.end_time
              );

              if (hasOverlap) {
                return {
                  success: false,
                  error: `이 시간대에 다른 플랜이 있습니다: "${plan.content_title || "플랜"}" (${plan.start_time} ~ ${plan.end_time})`,
                  conflictingPlan: {
                    id: plan.id,
                    contentTitle: plan.content_title || undefined,
                    startTime: plan.start_time,
                    endTime: plan.end_time,
                  },
                };
              }
            }
          }
        }
      }

      const { error: updateError } = await supabase
        .from("ad_hoc_plans")
        .update(updateData)
        .eq("id", planId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    revalidatePath("/plan/calendar");
    revalidatePath("/today");

    return { success: true, planId, newDate, newStartTime };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}

/**
 * 시간 블록 리사이즈로 시간 변경
 */
export async function resizePlanDuration(
  planId: string,
  planType: PlanType,
  newStartTime: string,
  newEndTime: string
): Promise<DragDropResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();
    const tableName = planType === "student_plan" ? "student_plan" : "ad_hoc_plans";

    // 플랜 조회
    const { data: existingPlan, error: fetchError } = await supabase
      .from(tableName)
      .select("id, student_id")
      .eq("id", planId)
      .single();

    if (fetchError || !existingPlan) {
      return { success: false, error: "플랜을 찾을 수 없습니다." };
    }

    // 권한 확인
    if (existingPlan.student_id !== user.userId) {
      const isAdmin = user.role === "admin" || user.role === "superadmin";
      if (!isAdmin) {
        return { success: false, error: "권한이 없습니다." };
      }
    }

    // 업데이트
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        start_time: newStartTime,
        end_time: newEndTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/plan/calendar");
    revalidatePath("/today");

    return { success: true, planId, newStartTime };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
