"use server";

/**
 * Learning Feedback Service
 *
 * 실시간 학습 피드백을 위한 마일스톤 체크 서비스
 * - 학습 시간 기반 마일스톤 (30분, 60분, 90분 등)
 * - 일일 목표 달성 체크
 * - 마일스톤 설정 관리
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================================
// Types - Re-export from types file for backwards compatibility
// ============================================================================

export type {
  MilestoneType,
  MilestoneSetting,
  AchievedMilestone,
  MilestoneCheckResult,
} from "@/lib/domains/today/types/milestone";

import type {
  MilestoneType,
  MilestoneSetting,
  AchievedMilestone,
  MilestoneCheckResult,
} from "@/lib/domains/today/types/milestone";

// ============================================================================
// Constants
// ============================================================================

/** 시간 기반 마일스톤 정의 */
const TIME_MILESTONES: Array<{
  type: MilestoneType;
  minutes: number;
  message: string;
  subMessage: string;
  celebrationLevel: "minor" | "major" | "epic";
}> = [
  {
    type: "study_30min",
    minutes: 30,
    message: "30분 학습 달성!",
    subMessage: "좋은 시작이에요. 계속 힘내세요!",
    celebrationLevel: "minor",
  },
  {
    type: "study_60min",
    minutes: 60,
    message: "1시간 학습 달성!",
    subMessage: "대단해요! 집중력이 훌륭해요.",
    celebrationLevel: "major",
  },
  {
    type: "study_90min",
    minutes: 90,
    message: "1시간 30분 학습 달성!",
    subMessage: "놀라운 집중력! 잠시 휴식도 좋아요.",
    celebrationLevel: "major",
  },
  {
    type: "study_120min",
    minutes: 120,
    message: "2시간 학습 달성!",
    subMessage: "오늘 정말 열심히 했네요!",
    celebrationLevel: "epic",
  },
];

/** 기본 마일스톤 설정 */
const DEFAULT_MILESTONE_SETTINGS: MilestoneSetting[] = [
  { milestoneType: "study_30min", isEnabled: true, soundEnabled: true },
  { milestoneType: "study_60min", isEnabled: true, soundEnabled: true },
  { milestoneType: "study_90min", isEnabled: true, soundEnabled: false },
  { milestoneType: "study_120min", isEnabled: true, soundEnabled: true },
  { milestoneType: "daily_goal", isEnabled: true, soundEnabled: true },
  { milestoneType: "plan_complete", isEnabled: false, soundEnabled: false },
];

// ============================================================================
// Service Functions
// ============================================================================

/**
 * 오늘의 마일스톤 달성 여부 체크
 *
 * @param studentId - 학생 ID
 * @param currentStudySeconds - 현재 세션의 학습 시간 (초)
 * @param planId - 현재 플랜 ID (선택)
 */
export async function checkMilestones(
  studentId: string,
  currentStudySeconds: number,
  planId?: string
): Promise<MilestoneCheckResult> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().split("T")[0];

  // 1. 오늘 이미 달성한 마일스톤 조회
  const { data: achievedToday } = await supabase
    .from("student_milestone_logs")
    .select("milestone_type, milestone_value")
    .eq("student_id", studentId)
    .gte("achieved_at", `${today}T00:00:00`)
    .lt("achieved_at", `${today}T23:59:59`);

  const achievedTypes = new Set(
    achievedToday?.map((m) => m.milestone_type) || []
  );

  // 2. 학생의 마일스톤 설정 조회
  const settings = await getMilestoneSettings(studentId);
  const enabledTypes = new Set(
    settings.filter((s) => s.isEnabled).map((s) => s.milestoneType)
  );

  // 3. 오늘 총 학습 시간 계산 (완료된 플랜들)
  const { data: completedPlans } = await supabase
    .from("student_plan")
    .select("total_duration_seconds")
    .eq("student_id", studentId)
    .eq("plan_date", today)
    .not("actual_end_time", "is", null);

  const completedStudySeconds =
    completedPlans?.reduce(
      (sum, p) => sum + (p.total_duration_seconds || 0),
      0
    ) || 0;

  const totalStudySeconds = completedStudySeconds + currentStudySeconds;
  const totalStudyMinutes = Math.floor(totalStudySeconds / 60);

  // 4. 시간 기반 마일스톤 체크
  const newlyAchieved: AchievedMilestone[] = [];

  for (const milestone of TIME_MILESTONES) {
    // 이미 달성했거나 비활성화된 경우 스킵
    if (achievedTypes.has(milestone.type) || !enabledTypes.has(milestone.type)) {
      continue;
    }

    // 마일스톤 달성 체크
    if (totalStudyMinutes >= milestone.minutes) {
      newlyAchieved.push({
        type: milestone.type,
        value: milestone.minutes,
        message: milestone.message,
        subMessage: milestone.subMessage,
        celebrationLevel: milestone.celebrationLevel,
      });

      // 로그 저장
      await logMilestoneAchievement(
        studentId,
        milestone.type,
        milestone.minutes,
        planId
      );
    }
  }

  return {
    achieved: newlyAchieved,
    totalStudyMinutesToday: totalStudyMinutes,
    completedPlansToday: completedPlans?.length || 0,
  };
}

/**
 * 마일스톤 달성 로그 저장
 */
async function logMilestoneAchievement(
  studentId: string,
  milestoneType: MilestoneType,
  value: number,
  planId?: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  await supabase.from("student_milestone_logs").insert({
    student_id: studentId,
    plan_id: planId || null,
    milestone_type: milestoneType,
    milestone_value: value,
    achieved_at: new Date().toISOString(),
  });
}

/**
 * 학생의 마일스톤 설정 조회
 */
export async function getMilestoneSettings(
  studentId: string
): Promise<MilestoneSetting[]> {
  const supabase = await createSupabaseServerClient();

  const { data: settings } = await supabase
    .from("student_milestone_settings")
    .select("milestone_type, is_enabled, sound_enabled")
    .eq("student_id", studentId);

  if (!settings || settings.length === 0) {
    return DEFAULT_MILESTONE_SETTINGS;
  }

  // 저장된 설정과 기본 설정 병합
  const settingsMap = new Map(
    settings.map((s) => [
      s.milestone_type,
      {
        milestoneType: s.milestone_type as MilestoneType,
        isEnabled: s.is_enabled,
        soundEnabled: s.sound_enabled,
      },
    ])
  );

  return DEFAULT_MILESTONE_SETTINGS.map(
    (defaultSetting) =>
      settingsMap.get(defaultSetting.milestoneType) || defaultSetting
  );
}

/**
 * 학생의 마일스톤 설정 업데이트
 */
export async function updateMilestoneSetting(
  studentId: string,
  milestoneType: MilestoneType,
  isEnabled: boolean,
  soundEnabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("student_milestone_settings").upsert(
    {
      student_id: studentId,
      milestone_type: milestoneType,
      is_enabled: isEnabled,
      sound_enabled: soundEnabled,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "student_id,milestone_type",
    }
  );

  if (error) {
    console.error("[learningFeedbackService] 설정 업데이트 오류:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 오늘 달성한 마일스톤 목록 조회
 */
export async function getTodayAchievedMilestones(
  studentId: string
): Promise<Array<{ type: MilestoneType; value: number; achievedAt: string }>> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("student_milestone_logs")
    .select("milestone_type, milestone_value, achieved_at")
    .eq("student_id", studentId)
    .gte("achieved_at", `${today}T00:00:00`)
    .lt("achieved_at", `${today}T23:59:59`)
    .order("achieved_at", { ascending: true });

  return (
    data?.map((m) => ({
      type: m.milestone_type as MilestoneType,
      value: m.milestone_value || 0,
      achievedAt: m.achieved_at,
    })) || []
  );
}

/**
 * 일일 목표 달성 체크 및 마일스톤 발행
 *
 * @param studentId - 학생 ID
 * @param completedCount - 완료된 플랜 수
 * @param totalCount - 전체 플랜 수
 */
export async function checkDailyGoalMilestone(
  studentId: string,
  completedCount: number,
  totalCount: number
): Promise<AchievedMilestone | null> {
  if (completedCount < totalCount || totalCount === 0) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().split("T")[0];

  // 오늘 이미 달성했는지 확인
  const { data: existing } = await supabase
    .from("student_milestone_logs")
    .select("id")
    .eq("student_id", studentId)
    .eq("milestone_type", "daily_goal")
    .gte("achieved_at", `${today}T00:00:00`)
    .lt("achieved_at", `${today}T23:59:59`)
    .maybeSingle();

  if (existing) {
    return null;
  }

  // 설정 확인
  const settings = await getMilestoneSettings(studentId);
  const dailyGoalSetting = settings.find((s) => s.milestoneType === "daily_goal");

  if (!dailyGoalSetting?.isEnabled) {
    return null;
  }

  // 마일스톤 달성 로그
  await logMilestoneAchievement(studentId, "daily_goal", completedCount);

  return {
    type: "daily_goal",
    value: completedCount,
    message: "오늘의 목표 달성!",
    subMessage: `${completedCount}개의 플랜을 모두 완료했어요!`,
    celebrationLevel: "epic",
  };
}

/**
 * 주간 마일스톤 달성 내역 조회 (코칭 엔진 통합용)
 */
export async function getWeeklyMilestoneAchievements(
  studentId: string
): Promise<{
  totalAchievements: number;
  byType: Record<string, number>;
  hasStreak: boolean;
  streakDays: number;
}> {
  const supabase = await createSupabaseServerClient();

  // 이번 주 범위 계산 (월요일부터)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekStartStr = weekStart.toISOString();
  const weekEndStr = weekEnd.toISOString();

  // 이번 주 마일스톤 로그 조회
  const { data: milestones } = await supabase
    .from("student_milestone_logs")
    .select("milestone_type, achieved_at")
    .eq("student_id", studentId)
    .gte("achieved_at", weekStartStr)
    .lte("achieved_at", weekEndStr);

  // 타입별 집계
  const byType: Record<string, number> = {};
  milestones?.forEach((m) => {
    const type = m.milestone_type;
    byType[type] = (byType[type] || 0) + 1;
  });

  // 연속 학습일 계산 (오늘부터 역순으로)
  let streakDays = 0;
  const checkDate = new Date(today);
  for (let i = 0; i < 30; i++) {
    const dateStr = checkDate.toISOString().split("T")[0];
    const dayMilestones = milestones?.filter(
      (m) => m.achieved_at.startsWith(dateStr)
    );
    if (dayMilestones && dayMilestones.length > 0) {
      streakDays++;
    } else if (i > 0) {
      // 오늘은 스킵 가능 (아직 학습 안 했을 수 있음)
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    totalAchievements: milestones?.length || 0,
    byType,
    hasStreak: streakDays >= 3,
    streakDays,
  };
}

/**
 * 마일스톤 메시지 생성 헬퍼 (내부 함수)
 */
function getMilestoneMessage(
  type: MilestoneType,
  value?: number
): { message: string; subMessage: string } {
  const timeMilestone = TIME_MILESTONES.find((m) => m.type === type);
  if (timeMilestone) {
    return {
      message: timeMilestone.message,
      subMessage: timeMilestone.subMessage,
    };
  }

  switch (type) {
    case "daily_goal":
      return {
        message: "오늘의 목표 달성!",
        subMessage: value
          ? `${value}개의 플랜을 모두 완료했어요!`
          : "모든 플랜을 완료했어요!",
      };
    case "plan_complete":
      return {
        message: "플랜 완료!",
        subMessage: "한 단계 더 성장했어요.",
      };
    case "streak_3days":
      return {
        message: "3일 연속 학습!",
        subMessage: "꾸준함이 실력을 만들어요.",
      };
    case "streak_7days":
      return {
        message: "7일 연속 학습!",
        subMessage: "일주일 내내 대단해요!",
      };
    default:
      return {
        message: "마일스톤 달성!",
        subMessage: "축하해요!",
      };
  }
}
