"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  GamificationActionResult,
  StudentGamificationStats,
  GamificationDashboard,
  AchievementWithDefinition,
  AchievementDefinition,
  StudentStudyHeatmap,
  GamificationEvent,
  LevelInfo,
  calculateLevelFromXp,
  getStreakMultiplier,
  calculateIntensityLevel,
  dbToAchievementDefinition,
  dbToStudentAchievement,
  dbToStudentGamificationStats,
  dbToStudentStudyHeatmap,
} from "../types";

/**
 * 학생 게이미피케이션 통계 조회/초기화
 */
export async function getOrCreateStats(
  studentId: string,
  tenantId: string
): Promise<GamificationActionResult<StudentGamificationStats>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.userId !== studentId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 기존 통계 조회
    const { data: existing, error: fetchError } = await supabase
      .from("student_gamification_stats")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      return { success: false, error: fetchError.message };
    }

    if (existing) {
      return { success: true, data: dbToStudentGamificationStats(existing) };
    }

    // 없으면 생성
    const { data: newStats, error: insertError } = await supabase
      .from("student_gamification_stats")
      .insert({
        student_id: studentId,
        tenant_id: tenantId,
      })
      .select()
      .single();

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    return { success: true, data: dbToStudentGamificationStats(newStats) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 게이미피케이션 대시보드 조회
 */
export async function getGamificationDashboard(
  studentId: string,
  tenantId: string
): Promise<GamificationActionResult<GamificationDashboard>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.userId !== studentId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 통계 조회/생성
    const statsResult = await getOrCreateStats(studentId, tenantId);
    if (!statsResult.success || !statsResult.data) {
      return { success: false, error: statsResult.error };
    }

    // 획득한 업적 조회
    const { data: achievementsData } = await supabase
      .from("student_achievements")
      .select(`
        *,
        achievement_definitions(*)
      `)
      .eq("student_id", studentId)
      .order("earned_at", { ascending: false });

    const achievements: AchievementWithDefinition[] = (achievementsData || []).map((a) => ({
      ...dbToStudentAchievement(a),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      definition: dbToAchievementDefinition((a as any).achievement_definitions),
    }));

    // 알림 안 된 업적
    const unnotifiedAchievements = achievements.filter((a) => !a.isNotified);

    // 최근 7일 업적
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentAchievements = achievements.filter(
      (a) => new Date(a.earnedAt) >= sevenDaysAgo
    );

    // 획득 가능한 업적 조회
    const { data: allDefsData } = await supabase
      .from("achievement_definitions")
      .select("*")
      .eq("is_active", true)
      .eq("is_hidden", false)
      .order("sort_order", { ascending: true });

    const allDefs = (allDefsData || []).map(dbToAchievementDefinition);
    const earnedCodes = achievements.map((a) => a.definition.code);
    const availableAchievements = allDefs.filter((d) => !earnedCodes.includes(d.code));

    // 히트맵 데이터 (최근 90일)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: heatmapData } = await supabase
      .from("student_study_heatmap")
      .select("*")
      .eq("student_id", studentId)
      .gte("study_date", ninetyDaysAgo.toISOString().split("T")[0])
      .order("study_date", { ascending: true });

    const heatmap = (heatmapData || []).map(dbToStudentStudyHeatmap);

    return {
      success: true,
      data: {
        stats: statsResult.data,
        achievements,
        recentAchievements,
        unnotifiedAchievements,
        availableAchievements,
        heatmapData: heatmap,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 플랜 완료 시 게이미피케이션 업데이트
 */
export async function updateGamificationOnPlanComplete(
  event: GamificationEvent
): Promise<GamificationActionResult<{ xpEarned: number; levelUp: boolean; newAchievements: string[] }>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { studentId, tenantId, studyDurationMinutes = 0 } = event;
    const today = new Date().toISOString().split("T")[0];

    // 통계 조회/생성
    const statsResult = await getOrCreateStats(studentId, tenantId);
    if (!statsResult.success || !statsResult.data) {
      return { success: false, error: statsResult.error };
    }

    const stats = statsResult.data;

    // 스트릭 계산
    let newStreak = stats.currentStreak;
    const lastStudy = stats.lastStudyDate;

    if (!lastStudy) {
      newStreak = 1;
    } else {
      const lastDate = new Date(lastStudy);
      const todayDate = new Date(today);
      const diffDays = Math.floor(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) {
        // 같은 날 - 스트릭 유지
      } else if (diffDays === 1) {
        // 다음 날 - 스트릭 증가
        newStreak += 1;
      } else {
        // 하루 이상 건너뜀 - 스트릭 리셋
        newStreak = 1;
      }
    }

    const longestStreak = Math.max(newStreak, stats.longestStreak);

    // XP 계산 (기본 10 XP + 스트릭 보너스)
    const baseXp = 10;
    const multiplier = getStreakMultiplier(newStreak);
    const xpEarned = Math.floor(baseXp * multiplier);

    const newTotalXp = stats.totalXp + xpEarned;
    const newLevel = calculateLevelFromXp(newTotalXp);
    const levelUp = newLevel.level > stats.currentLevel;

    const newTotalMinutes = stats.totalStudyMinutes + studyDurationMinutes;
    const newTotalCompleted = stats.totalPlansCompleted + 1;

    // 통계 업데이트
    await supabase
      .from("student_gamification_stats")
      .update({
        total_xp: newTotalXp,
        current_level: newLevel.level,
        current_streak: newStreak,
        longest_streak: longestStreak,
        total_study_minutes: newTotalMinutes,
        total_plans_completed: newTotalCompleted,
        last_study_date: today,
      })
      .eq("student_id", studentId);

    // 히트맵 업데이트
    const { data: existingHeatmap } = await supabase
      .from("student_study_heatmap")
      .select("*")
      .eq("student_id", studentId)
      .eq("study_date", today)
      .maybeSingle();

    if (existingHeatmap) {
      const newMinutes = existingHeatmap.total_minutes + studyDurationMinutes;
      const newCompleted = existingHeatmap.plans_completed + 1;
      await supabase
        .from("student_study_heatmap")
        .update({
          total_minutes: newMinutes,
          plans_completed: newCompleted,
          intensity_level: calculateIntensityLevel(newMinutes),
        })
        .eq("id", existingHeatmap.id);
    } else {
      await supabase.from("student_study_heatmap").insert({
        student_id: studentId,
        study_date: today,
        total_minutes: studyDurationMinutes,
        plans_completed: 1,
        intensity_level: calculateIntensityLevel(studyDurationMinutes),
      });
    }

    // 업적 체크 및 부여
    const newAchievements = await checkAndGrantAchievements(studentId, {
      totalMinutes: newTotalMinutes,
      totalCompleted: newTotalCompleted,
      currentStreak: newStreak,
      currentLevel: newLevel.level,
    });

    // Note: revalidatePath는 호출자(timer.ts의 completePlan)에서 처리하므로
    // 여기서는 제거하여 중복 revalidation으로 인한 모달 중복 노출 방지

    return {
      success: true,
      data: {
        xpEarned,
        levelUp,
        newAchievements,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 업적 체크 및 부여
 */
async function checkAndGrantAchievements(
  studentId: string,
  stats: {
    totalMinutes: number;
    totalCompleted: number;
    currentStreak: number;
    currentLevel: number;
  }
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const newAchievements: string[] = [];

  // 모든 업적 정의 조회
  const { data: allDefs } = await supabase
    .from("achievement_definitions")
    .select("*")
    .eq("is_active", true);

  if (!allDefs) return [];

  // 이미 획득한 업적 조회
  const { data: earnedData } = await supabase
    .from("student_achievements")
    .select("achievement_id")
    .eq("student_id", studentId);

  const earnedIds = new Set((earnedData || []).map((e) => e.achievement_id));

  // 업적 체크
  for (const def of allDefs) {
    if (earnedIds.has(def.id)) continue;

    let earned = false;

    switch (def.category) {
      case "study_time":
        if (def.threshold_value && stats.totalMinutes >= def.threshold_value) {
          earned = true;
        }
        break;
      case "completion":
        if (def.threshold_value && stats.totalCompleted >= def.threshold_value) {
          earned = true;
        }
        break;
      case "streak":
        if (def.threshold_value && stats.currentStreak >= def.threshold_value) {
          earned = true;
        }
        break;
      case "level":
        if (def.threshold_value && stats.currentLevel >= def.threshold_value) {
          earned = true;
        }
        break;
    }

    if (earned) {
      await supabase.from("student_achievements").insert({
        student_id: studentId,
        achievement_id: def.id,
      });
      newAchievements.push(def.code);

      // XP 보상
      if (def.xp_reward > 0) {
        await supabase.rpc("increment_student_xp", {
          p_student_id: studentId,
          p_xp_amount: def.xp_reward,
        });
      }
    }
  }

  return newAchievements;
}

/**
 * 알림 표시된 업적 마킹
 */
export async function markAchievementsNotified(
  studentId: string,
  achievementIds: string[]
): Promise<GamificationActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.userId !== studentId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    await supabase
      .from("student_achievements")
      .update({ is_notified: true })
      .eq("student_id", studentId)
      .in("id", achievementIds);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 레벨 정보 조회
 */
export async function getLevelInfo(
  studentId: string
): Promise<GamificationActionResult<LevelInfo>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.userId !== studentId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("student_gamification_stats")
      .select("total_xp")
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    const totalXp = data?.total_xp ?? 0;
    const levelInfo = calculateLevelFromXp(totalXp);

    return { success: true, data: levelInfo };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
