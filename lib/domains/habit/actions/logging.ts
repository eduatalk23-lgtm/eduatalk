"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  HabitLog,
  CheckInInput,
  HabitActionResult,
  dbToHabitLog,
  calculateStreak,
} from "../types";

/**
 * 습관 체크인 (완료 횟수 증가)
 */
export async function checkInHabit(
  input: CheckInInput
): Promise<HabitActionResult<HabitLog>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 습관 조회 및 권한 확인
    const { data: habit, error: habitError } = await supabase
      .from("habits")
      .select("*")
      .eq("id", input.habitId)
      .single();

    if (habitError || !habit) {
      return { success: false, error: "습관을 찾을 수 없습니다." };
    }

    if (habit.student_id !== user.userId) {
      return { success: false, error: "권한이 없습니다." };
    }

    // 기존 로그 확인
    const { data: existingLog } = await supabase
      .from("habit_logs")
      .select("*")
      .eq("habit_id", input.habitId)
      .eq("log_date", input.logDate)
      .single();

    let log: HabitLog;

    if (existingLog) {
      // 기존 로그 업데이트
      const newCount = input.completedCount ?? existingLog.completed_count + 1;
      const isCompleted = newCount >= habit.target_count;

      const { data, error } = await supabase
        .from("habit_logs")
        .update({
          completed_count: newCount,
          is_completed: isCompleted,
          notes: input.notes ?? existingLog.notes,
        })
        .eq("id", existingLog.id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      log = dbToHabitLog(data);
    } else {
      // 새 로그 생성
      const completedCount = input.completedCount ?? 1;
      const isCompleted = completedCount >= habit.target_count;

      const { data, error } = await supabase
        .from("habit_logs")
        .insert({
          habit_id: input.habitId,
          log_date: input.logDate,
          completed_count: completedCount,
          is_completed: isCompleted,
          notes: input.notes,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      log = dbToHabitLog(data);
    }

    // 스트릭 업데이트
    await updateHabitStreak(input.habitId);

    revalidatePath("/habits");
    revalidatePath("/today");

    return { success: true, data: log };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 체크인 취소 (횟수 감소)
 */
export async function uncheckHabit(
  habitId: string,
  logDate: string
): Promise<HabitActionResult<HabitLog | null>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 습관 조회 및 권한 확인
    const { data: habit, error: habitError } = await supabase
      .from("habits")
      .select("*")
      .eq("id", habitId)
      .single();

    if (habitError || !habit) {
      return { success: false, error: "습관을 찾을 수 없습니다." };
    }

    if (habit.student_id !== user.userId) {
      return { success: false, error: "권한이 없습니다." };
    }

    // 기존 로그 확인
    const { data: existingLog } = await supabase
      .from("habit_logs")
      .select("*")
      .eq("habit_id", habitId)
      .eq("log_date", logDate)
      .single();

    if (!existingLog) {
      return { success: true, data: null };
    }

    const newCount = Math.max(0, existingLog.completed_count - 1);

    if (newCount === 0) {
      // 횟수가 0이면 로그 삭제
      await supabase.from("habit_logs").delete().eq("id", existingLog.id);

      // 스트릭 업데이트
      await updateHabitStreak(habitId);

      revalidatePath("/habits");
      revalidatePath("/today");

      return { success: true, data: null };
    } else {
      // 횟수 감소
      const isCompleted = newCount >= habit.target_count;

      const { data, error } = await supabase
        .from("habit_logs")
        .update({
          completed_count: newCount,
          is_completed: isCompleted,
        })
        .eq("id", existingLog.id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // 스트릭 업데이트
      await updateHabitStreak(habitId);

      revalidatePath("/habits");
      revalidatePath("/today");

      return { success: true, data: dbToHabitLog(data) };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 특정 날짜 로그 조회
 */
export async function getHabitLog(
  habitId: string,
  logDate: string
): Promise<HabitActionResult<HabitLog | null>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("habit_logs")
      .select("*, habits!inner(student_id)")
      .eq("habit_id", habitId)
      .eq("log_date", logDate)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: true, data: null };
      }
      return { success: false, error: error.message };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((data as any).habits?.student_id !== user.userId) {
      return { success: false, error: "권한이 없습니다." };
    }

    return { success: true, data: dbToHabitLog(data) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 기간별 로그 조회
 */
export async function getHabitLogs(
  habitId: string,
  startDate: string,
  endDate: string
): Promise<HabitActionResult<HabitLog[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 습관 권한 확인
    const { data: habit, error: habitError } = await supabase
      .from("habits")
      .select("student_id")
      .eq("id", habitId)
      .single();

    if (habitError || !habit) {
      return { success: false, error: "습관을 찾을 수 없습니다." };
    }

    if (habit.student_id !== user.userId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { data, error } = await supabase
      .from("habit_logs")
      .select("*")
      .eq("habit_id", habitId)
      .gte("log_date", startDate)
      .lte("log_date", endDate)
      .order("log_date", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(dbToHabitLog) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 스트릭 업데이트 (내부 함수)
 */
async function updateHabitStreak(habitId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // 최근 90일 로그 조회
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: habit } = await supabase
    .from("habits")
    .select("frequency_days, current_streak, longest_streak")
    .eq("id", habitId)
    .single();

  if (!habit) return;

  const { data: logs } = await supabase
    .from("habit_logs")
    .select("*")
    .eq("habit_id", habitId)
    .eq("is_completed", true)
    .gte("log_date", ninetyDaysAgo.toISOString().split("T")[0])
    .order("log_date", { ascending: false });

  if (!logs) return;

  const habitLogs = logs.map(dbToHabitLog);
  const currentStreak = calculateStreak(habitLogs, habit.frequency_days || []);
  const longestStreak = Math.max(currentStreak, habit.longest_streak || 0);

  await supabase
    .from("habits")
    .update({
      current_streak: currentStreak,
      longest_streak: longestStreak,
    })
    .eq("id", habitId);
}
