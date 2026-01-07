"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export type PlanType = "student_plan" | "ad_hoc_plan";

// ============================================
// 타입 정의
// ============================================

/**
 * student_plan과 plan_groups 조인 결과 타입
 */
type StudentPlanWithPlanGroup = {
  id: string;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  student_id: string;
  content_title: string | null;
  plan_group_id: string | null;
  version: number | null;
  plan_groups: {
    student_id: string;
  } | { student_id: string }[] | null;
};

/**
 * student_plan (버전만)과 plan_groups 조인 결과 타입
 */
type StudentPlanVersionWithPlanGroup = {
  id: string;
  version: number | null;
  plan_groups: {
    student_id: string;
  } | { student_id: string }[] | null;
};

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
 * 특정 날짜가 제외일인지 확인
 */
async function checkExclusionDate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  planGroupId: string,
  date: string
): Promise<{ isExclusion: boolean; reason?: string }> {
  const { data: exclusion } = await supabase
    .from("plan_exclusions")
    .select("exclusion_type, reason")
    .eq("plan_group_id", planGroupId)
    .eq("exclusion_date", date)
    .single();

  if (exclusion) {
    return {
      isExclusion: true,
      reason: exclusion.reason || undefined,
    };
  }

  return { isExclusion: false };
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
      // 기존 플랜 조회 (plan_group_id, version 포함)
      // Phase 2.2: Optimistic Locking을 위해 version 필드도 조회
      const { data: existingPlan, error: fetchError } = await supabase
        .from("student_plan")
        .select("id, plan_date, start_time, end_time, student_id, content_title, plan_group_id, version, plan_groups!inner(student_id)")
        .eq("id", planId)
        .single();

      if (fetchError || !existingPlan) {
        return { success: false, error: "플랜을 찾을 수 없습니다." };
      }

      // 권한 확인
      const isAdmin = user.role === "admin" || user.role === "superadmin";
      const planWithGroup = existingPlan as StudentPlanWithPlanGroup;
      const planGroups = planWithGroup.plan_groups;
      const groupStudentId = Array.isArray(planGroups) ? planGroups[0]?.student_id : planGroups?.student_id;
      const isOwner = groupStudentId === user.userId;
      if (!isAdmin && !isOwner) {
        return { success: false, error: "권한이 없습니다." };
      }

      // 제외일 검증
      if (existingPlan.plan_group_id && newDate !== existingPlan.plan_date) {
        const exclusionCheck = await checkExclusionDate(
          supabase,
          existingPlan.plan_group_id,
          newDate
        );
        if (exclusionCheck.isExclusion) {
          const reason = exclusionCheck.reason ? ` (${exclusionCheck.reason})` : "";
          return {
            success: false,
            error: `해당 날짜는 제외일입니다${reason}`,
          };
        }
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
        const planWithGroup2 = existingPlan as StudentPlanWithPlanGroup;
        const planGroups = planWithGroup2.plan_groups;
        const studentId = (Array.isArray(planGroups) ? planGroups[0]?.student_id : planGroups?.student_id) || user.userId;

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
      // Phase 2.2: Optimistic Locking - 버전 증가
      const currentVersion = existingPlan.version ?? 1;
      const updateData: Record<string, unknown> = {
        plan_date: newDate,
        updated_at: new Date().toISOString(),
        version: currentVersion + 1,
      };

      // 시간이 제공된 경우 설정
      if (newStartTime) {
        updateData.start_time = newStartTime;
        if (newEndTime) {
          updateData.end_time = newEndTime;
        }
      }

      // Optimistic Locking: 버전 체크와 함께 업데이트
      const { data: updatedPlan, error: updateError } = await supabase
        .from("student_plan")
        .update(updateData)
        .eq("id", planId)
        .eq("version", currentVersion)
        .select("id")
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // 버전 불일치로 업데이트 실패 (다른 요청이 먼저 수정함)
      if (!updatedPlan) {
        return {
          success: false,
          error: "플랜이 이미 수정되었습니다. 새로고침 후 다시 시도해주세요.",
        };
      }
    } else if (planType === "ad_hoc_plan") {
      // ad_hoc_plan 조회 (plan_group_id 포함)
      const { data: existingPlan, error: fetchError } = await supabase
        .from("ad_hoc_plans")
        .select("id, plan_date, start_time, end_time, student_id, plan_group_id")
        .eq("id", planId)
        .single();

      if (fetchError || !existingPlan) {
        return { success: false, error: "플랜을 찾을 수 없습니다." };
      }

      // 권한 확인 (자기 자신의 플랜만 수정 가능)
      if (existingPlan.student_id !== user.userId) {
        return { success: false, error: "권한이 없습니다." };
      }

      // 제외일 검증
      if (existingPlan.plan_group_id && newDate !== existingPlan.plan_date) {
        const exclusionCheck = await checkExclusionDate(
          supabase,
          existingPlan.plan_group_id,
          newDate
        );
        if (exclusionCheck.isExclusion) {
          const reason = exclusionCheck.reason ? ` (${exclusionCheck.reason})` : "";
          return {
            success: false,
            error: `해당 날짜는 제외일입니다${reason}`,
          };
        }
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
    const isAdmin = user.role === "admin" || user.role === "superadmin";

    if (planType === "student_plan") {
      // student_plan: plan_groups.student_id로 소유자 확인
      // Phase 2.2: Optimistic Locking을 위해 version 필드도 조회
      const { data: existingPlan, error: fetchError } = await supabase
        .from("student_plan")
        .select("id, version, plan_groups!inner(student_id)")
        .eq("id", planId)
        .single();

      if (fetchError || !existingPlan) {
        return { success: false, error: "플랜을 찾을 수 없습니다." };
      }

      // 권한 확인
      // 권한 확인
      const planWithGroup = existingPlan as StudentPlanVersionWithPlanGroup;
      const planGroups = planWithGroup.plan_groups;
      const groupStudentId = Array.isArray(planGroups) ? planGroups[0]?.student_id : planGroups?.student_id;
      const isOwner = groupStudentId === user.userId;
      if (!isAdmin && !isOwner) {
        return { success: false, error: "권한이 없습니다." };
      }

      // 업데이트
      // Phase 2.2: Optimistic Locking - 버전 체크와 함께 업데이트
      const currentVersion = existingPlan.version ?? 1;
      const { data: updatedPlan, error: updateError } = await supabase
        .from("student_plan")
        .update({
          start_time: newStartTime,
          end_time: newEndTime,
          updated_at: new Date().toISOString(),
          version: currentVersion + 1,
        })
        .eq("id", planId)
        .eq("version", currentVersion)
        .select("id")
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // 버전 불일치로 업데이트 실패 (다른 요청이 먼저 수정함)
      if (!updatedPlan) {
        return {
          success: false,
          error: "플랜이 이미 수정되었습니다. 새로고침 후 다시 시도해주세요.",
        };
      }
    } else {
      // ad_hoc_plans: student_id로 직접 확인
      const { data: existingPlan, error: fetchError } = await supabase
        .from("ad_hoc_plans")
        .select("id, student_id")
        .eq("id", planId)
        .single();

      if (fetchError || !existingPlan) {
        return { success: false, error: "플랜을 찾을 수 없습니다." };
      }

      // 권한 확인
      const isOwner = existingPlan.student_id === user.userId;
      if (!isAdmin && !isOwner) {
        return { success: false, error: "권한이 없습니다." };
      }

      // 업데이트
      const { error: updateError } = await supabase
        .from("ad_hoc_plans")
        .update({
          start_time: newStartTime,
          end_time: newEndTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
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
