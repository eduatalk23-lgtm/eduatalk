"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  Habit,
  HabitWithLogs,
  CreateHabitInput,
  UpdateHabitInput,
  HabitActionResult,
  dbToHabit,
  dbToHabitLog,
} from "../types";

/**
 * 학생의 모든 습관 조회
 */
export async function getHabits(
  studentId: string,
  options?: { includeArchived?: boolean }
): Promise<HabitActionResult<Habit[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    if (user.userId !== studentId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("habits")
      .select("*")
      .eq("student_id", studentId)
      .order("order_index", { ascending: true });

    if (!options?.includeArchived) {
      query = query.neq("status", "archived");
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const habits = (data || []).map(dbToHabit);
    return { success: true, data: habits };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 오늘 로그와 함께 습관 조회
 */
export async function getHabitsWithTodayLog(
  studentId: string
): Promise<HabitActionResult<HabitWithLogs[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    if (user.userId !== studentId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const supabase = await createSupabaseServerClient();
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("habits")
      .select(`
        *,
        habit_logs!inner(*)
      `)
      .eq("student_id", studentId)
      .neq("status", "archived")
      .order("order_index", { ascending: true });

    if (error) {
      // 로그가 없는 경우도 처리
      const { data: habitsOnly, error: habitsError } = await supabase
        .from("habits")
        .select("*")
        .eq("student_id", studentId)
        .neq("status", "archived")
        .order("order_index", { ascending: true });

      if (habitsError) {
        return { success: false, error: habitsError.message };
      }

      const habits = (habitsOnly || []).map((h) => ({
        ...dbToHabit(h),
        logs: [],
        todayLog: undefined,
      }));

      return { success: true, data: habits };
    }

    const habits = (data || []).map((h) => {
      const habit = dbToHabit(h);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logs = ((h as any).habit_logs || []).map((log: Record<string, unknown>) => dbToHabitLog(log));
      const todayLog = logs.find((l: { logDate: string }) => l.logDate === today);

      return {
        ...habit,
        logs,
        todayLog,
      };
    });

    return { success: true, data: habits };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 단일 습관 조회
 */
export async function getHabit(
  habitId: string
): Promise<HabitActionResult<Habit>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("habits")
      .select("*")
      .eq("id", habitId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.student_id !== user.userId) {
      return { success: false, error: "권한이 없습니다." };
    }

    return { success: true, data: dbToHabit(data) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 습관 생성
 */
export async function createHabit(
  input: CreateHabitInput
): Promise<HabitActionResult<Habit>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    if (user.userId !== input.studentId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 최대 order_index 조회
    const { data: maxOrder } = await supabase
      .from("habits")
      .select("order_index")
      .eq("student_id", input.studentId)
      .order("order_index", { ascending: false })
      .limit(1)
      .single();

    const newOrderIndex = (maxOrder?.order_index ?? -1) + 1;

    const { data, error } = await supabase
      .from("habits")
      .insert({
        tenant_id: input.tenantId,
        student_id: input.studentId,
        title: input.title,
        description: input.description || null,
        icon: input.icon || "Check",
        color: input.color || "#3B82F6",
        frequency_type: input.frequencyType || "daily",
        frequency_days: input.frequencyDays || [],
        target_count: input.targetCount || 1,
        order_index: newOrderIndex,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/habits");
    revalidatePath("/today");

    return { success: true, data: dbToHabit(data) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 습관 수정
 */
export async function updateHabit(
  habitId: string,
  input: UpdateHabitInput
): Promise<HabitActionResult<Habit>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 권한 확인
    const { data: existing, error: fetchError } = await supabase
      .from("habits")
      .select("student_id")
      .eq("id", habitId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "습관을 찾을 수 없습니다." };
    }

    if (existing.student_id !== user.userId) {
      return { success: false, error: "권한이 없습니다." };
    }

    // 업데이트
    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.frequencyType !== undefined) updateData.frequency_type = input.frequencyType;
    if (input.frequencyDays !== undefined) updateData.frequency_days = input.frequencyDays;
    if (input.targetCount !== undefined) updateData.target_count = input.targetCount;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.orderIndex !== undefined) updateData.order_index = input.orderIndex;

    // 아카이브 시 archived_at 설정
    if (input.status === "archived") {
      updateData.archived_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("habits")
      .update(updateData)
      .eq("id", habitId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/habits");
    revalidatePath("/today");

    return { success: true, data: dbToHabit(data) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 습관 삭제
 */
export async function deleteHabit(
  habitId: string
): Promise<HabitActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 권한 확인
    const { data: existing, error: fetchError } = await supabase
      .from("habits")
      .select("student_id")
      .eq("id", habitId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "습관을 찾을 수 없습니다." };
    }

    if (existing.student_id !== user.userId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { error } = await supabase.from("habits").delete().eq("id", habitId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/habits");
    revalidatePath("/today");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 습관 순서 변경
 */
export async function reorderHabits(
  habitIds: string[]
): Promise<HabitActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 각 습관의 order_index 업데이트
    const updates = habitIds.map((id, index) =>
      supabase
        .from("habits")
        .update({ order_index: index })
        .eq("id", id)
        .eq("student_id", user.userId)
    );

    await Promise.all(updates);

    revalidatePath("/habits");
    revalidatePath("/today");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
