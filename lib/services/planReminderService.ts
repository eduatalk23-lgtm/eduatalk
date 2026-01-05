"use server";

/**
 * Plan Reminder Service
 *
 * 플랜 미완료 알림을 위한 리마인더 서비스
 * - 일일 미완료 알림
 * - 지연 플랜 경고
 * - 주간 미완료 요약
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendInAppNotification, type NotificationType } from "./inAppNotificationService";

// ============================================================================
// Types
// ============================================================================

/** 리마인더 타입 */
export type ReminderType =
  | "incomplete_daily" // 일일 미완료 알림
  | "delayed_warning" // 지연 플랜 경고
  | "weekly_summary"; // 주간 미완료 요약

/** 리마인더 설정 */
export interface ReminderSettings {
  incompleteReminderEnabled: boolean;
  incompleteReminderTime: string; // HH:MM 형식
  delayedPlanWarningEnabled: boolean;
  delayedPlanThreshold: number; // 일수
  weeklySummaryEnabled: boolean;
  weeklySummaryDay: number; // 0-6 (일-토)
}

/** 미완료 플랜 정보 */
export interface IncompletePlanInfo {
  planId: string;
  planDate: string;
  title: string;
  subject: string | null;
  daysDelayed: number;
}

/** 리마인더 체크 결과 */
export interface ReminderCheckResult {
  shouldNotify: boolean;
  reminderType: ReminderType;
  incompletePlans: IncompletePlanInfo[];
  message: string;
  subMessage?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** 기본 리마인더 설정 */
const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  incompleteReminderEnabled: true,
  incompleteReminderTime: "20:00",
  delayedPlanWarningEnabled: true,
  delayedPlanThreshold: 3,
  weeklySummaryEnabled: true,
  weeklySummaryDay: 0, // 일요일
};

// ============================================================================
// Service Functions
// ============================================================================

/**
 * 학생의 리마인더 설정 조회
 */
export async function getReminderSettings(
  studentId: string
): Promise<ReminderSettings> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("student_reminder_settings")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (!data) {
    return DEFAULT_REMINDER_SETTINGS;
  }

  return {
    incompleteReminderEnabled: data.incomplete_reminder_enabled ?? true,
    incompleteReminderTime: data.incomplete_reminder_time?.slice(0, 5) ?? "20:00",
    delayedPlanWarningEnabled: data.delayed_plan_warning_enabled ?? true,
    delayedPlanThreshold: data.delayed_plan_threshold ?? 3,
    weeklySummaryEnabled: data.weekly_summary_enabled ?? true,
    weeklySummaryDay: data.weekly_summary_day ?? 0,
  };
}

/**
 * 학생의 리마인더 설정 업데이트
 */
export async function updateReminderSettings(
  studentId: string,
  settings: Partial<ReminderSettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const updateData: Record<string, unknown> = {
    student_id: studentId,
    updated_at: new Date().toISOString(),
  };

  if (settings.incompleteReminderEnabled !== undefined) {
    updateData.incomplete_reminder_enabled = settings.incompleteReminderEnabled;
  }
  if (settings.incompleteReminderTime !== undefined) {
    updateData.incomplete_reminder_time = settings.incompleteReminderTime + ":00";
  }
  if (settings.delayedPlanWarningEnabled !== undefined) {
    updateData.delayed_plan_warning_enabled = settings.delayedPlanWarningEnabled;
  }
  if (settings.delayedPlanThreshold !== undefined) {
    updateData.delayed_plan_threshold = settings.delayedPlanThreshold;
  }
  if (settings.weeklySummaryEnabled !== undefined) {
    updateData.weekly_summary_enabled = settings.weeklySummaryEnabled;
  }
  if (settings.weeklySummaryDay !== undefined) {
    updateData.weekly_summary_day = settings.weeklySummaryDay;
  }

  const { error } = await supabase
    .from("student_reminder_settings")
    .upsert(updateData, { onConflict: "student_id" });

  if (error) {
    console.error("[planReminderService] 설정 업데이트 오류:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 오늘의 미완료 플랜 조회
 */
export async function getTodayIncompletePlans(
  studentId: string
): Promise<IncompletePlanInfo[]> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("student_plan")
    .select(`
      id,
      plan_date,
      custom_title,
      student_content:student_content_master!left (
        subject,
        content_title:student_content_detail!left (
          detail_subject
        )
      )
    `)
    .eq("student_id", studentId)
    .eq("plan_date", today)
    .is("actual_end_time", null)
    .eq("container_type", "daily");

  if (error || !data) {
    return [];
  }

  return data.map((plan) => {
    const studentContent = plan.student_content as unknown as {
      subject: string | null;
      content_title: Array<{ detail_subject: string | null }> | null;
    } | null;

    return {
      planId: plan.id,
      planDate: plan.plan_date,
      title:
        plan.custom_title ||
        studentContent?.content_title?.[0]?.detail_subject ||
        "학습 플랜",
      subject: studentContent?.subject || null,
      daysDelayed: 0,
    };
  });
}

/**
 * 지연된 플랜 조회 (N일 이상 미완료)
 */
export async function getDelayedPlans(
  studentId: string,
  thresholdDays: number = 3
): Promise<IncompletePlanInfo[]> {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const thresholdDate = new Date(today);
  thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

  const { data, error } = await supabase
    .from("student_plan")
    .select(`
      id,
      plan_date,
      custom_title,
      student_content:student_content_master!left (
        subject,
        content_title:student_content_detail!left (
          detail_subject
        )
      )
    `)
    .eq("student_id", studentId)
    .lt("plan_date", thresholdDate.toISOString().split("T")[0])
    .is("actual_end_time", null)
    .order("plan_date", { ascending: true })
    .limit(10);

  if (error || !data) {
    return [];
  }

  return data.map((plan) => {
    const planDate = new Date(plan.plan_date);
    const daysDelayed = Math.floor(
      (today.getTime() - planDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const studentContent = plan.student_content as unknown as {
      subject: string | null;
      content_title: Array<{ detail_subject: string | null }> | null;
    } | null;

    return {
      planId: plan.id,
      planDate: plan.plan_date,
      title:
        plan.custom_title ||
        studentContent?.content_title?.[0]?.detail_subject ||
        "학습 플랜",
      subject: studentContent?.subject || null,
      daysDelayed,
    };
  });
}

/**
 * 주간 미완료 플랜 요약 조회
 */
export async function getWeeklyIncompleteSummary(
  studentId: string
): Promise<{
  totalIncomplete: number;
  bySubject: Record<string, number>;
  oldestPlanDate: string | null;
  delayedCount: number;
}> {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("student_plan")
    .select(`
      id,
      plan_date,
      student_content:student_content_master!left (
        subject
      )
    `)
    .eq("student_id", studentId)
    .gte("plan_date", weekAgo.toISOString().split("T")[0])
    .lte("plan_date", todayStr)
    .is("actual_end_time", null);

  if (error || !data || data.length === 0) {
    return {
      totalIncomplete: 0,
      bySubject: {},
      oldestPlanDate: null,
      delayedCount: 0,
    };
  }

  const bySubject: Record<string, number> = {};
  let oldestPlanDate: string | null = null;
  let delayedCount = 0;

  for (const plan of data) {
    const studentContent = plan.student_content as unknown as {
      subject: string | null;
    } | null;
    const subject = studentContent?.subject || "기타";
    bySubject[subject] = (bySubject[subject] || 0) + 1;

    if (!oldestPlanDate || plan.plan_date < oldestPlanDate) {
      oldestPlanDate = plan.plan_date;
    }

    // 오늘 이전 날짜의 플랜은 지연된 것으로 간주
    if (plan.plan_date < todayStr) {
      delayedCount++;
    }
  }

  return {
    totalIncomplete: data.length,
    bySubject,
    oldestPlanDate,
    delayedCount,
  };
}

/**
 * 리마인더 발송 여부 체크 (중복 방지)
 */
async function hasReminderBeenSent(
  studentId: string,
  reminderType: ReminderType,
  targetDate: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("plan_reminder_logs")
    .select("id")
    .eq("student_id", studentId)
    .eq("reminder_type", reminderType)
    .eq("reminder_date", targetDate)
    .maybeSingle();

  return !!data;
}

/**
 * 리마인더 발송 로그 저장
 */
async function logReminderSent(
  studentId: string,
  reminderType: ReminderType,
  targetDate: string,
  planCount: number
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  await supabase.from("plan_reminder_logs").insert({
    student_id: studentId,
    reminder_type: reminderType,
    reminder_date: targetDate,
    plan_count: planCount,
    sent_at: new Date().toISOString(),
  });
}

/**
 * 일일 미완료 알림 체크 및 생성
 */
export async function checkAndCreateIncompleteReminder(
  studentId: string,
  cachedSettings?: ReminderSettings
): Promise<ReminderCheckResult | null> {
  const settings = cachedSettings || await getReminderSettings(studentId);

  if (!settings.incompleteReminderEnabled) {
    return null;
  }

  const today = new Date().toISOString().split("T")[0];

  // 캐시된 설정이 없을 때만 중복 체크 (이미 checkAllReminders에서 체크됨)
  if (!cachedSettings) {
    const alreadySent = await hasReminderBeenSent(
      studentId,
      "incomplete_daily",
      today
    );
    if (alreadySent) {
      return null;
    }
  }

  // 미완료 플랜 조회
  const incompletePlans = await getTodayIncompletePlans(studentId);

  if (incompletePlans.length === 0) {
    return null;
  }

  // 알림 로그 저장
  await logReminderSent(studentId, "incomplete_daily", today, incompletePlans.length);

  // 인앱 알림 생성
  await sendInAppNotification(
    studentId,
    "plan_incomplete_reminder" as NotificationType,
    `오늘 ${incompletePlans.length}개의 플랜이 남았어요`,
    incompletePlans.length === 1
      ? `"${incompletePlans[0].title}" 플랜을 완료해보세요!`
      : `${incompletePlans[0].title} 외 ${incompletePlans.length - 1}개의 플랜이 기다리고 있어요.`,
    { actionUrl: "/today" }
  );

  return {
    shouldNotify: true,
    reminderType: "incomplete_daily",
    incompletePlans,
    message: `오늘 ${incompletePlans.length}개의 플랜이 남았어요`,
    subMessage:
      incompletePlans.length === 1
        ? `"${incompletePlans[0].title}" 플랜을 완료해보세요!`
        : `${incompletePlans[0].title} 외 ${incompletePlans.length - 1}개의 플랜이 기다리고 있어요.`,
  };
}

/**
 * 지연 플랜 경고 체크 및 생성
 */
export async function checkAndCreateDelayedWarning(
  studentId: string,
  cachedSettings?: ReminderSettings
): Promise<ReminderCheckResult | null> {
  const settings = cachedSettings || await getReminderSettings(studentId);

  if (!settings.delayedPlanWarningEnabled) {
    return null;
  }

  const today = new Date().toISOString().split("T")[0];

  // 캐시된 설정이 없을 때만 중복 체크
  if (!cachedSettings) {
    const alreadySent = await hasReminderBeenSent(
      studentId,
      "delayed_warning",
      today
    );
    if (alreadySent) {
      return null;
    }
  }

  // 지연 플랜 조회
  const delayedPlans = await getDelayedPlans(studentId, settings.delayedPlanThreshold);

  if (delayedPlans.length === 0) {
    return null;
  }

  // 알림 로그 저장
  await logReminderSent(studentId, "delayed_warning", today, delayedPlans.length);

  const oldestPlan = delayedPlans[0];

  // 인앱 알림 생성
  await sendInAppNotification(
    studentId,
    "plan_incomplete_reminder" as NotificationType,
    `${delayedPlans.length}개의 플랜이 ${settings.delayedPlanThreshold}일 이상 밀렸어요`,
    `가장 오래된 플랜: "${oldestPlan.title}" (${oldestPlan.daysDelayed}일 전)`,
    { actionUrl: "/today" }
  );

  return {
    shouldNotify: true,
    reminderType: "delayed_warning",
    incompletePlans: delayedPlans,
    message: `${delayedPlans.length}개의 플랜이 ${settings.delayedPlanThreshold}일 이상 밀렸어요`,
    subMessage: `가장 오래된 플랜: "${oldestPlan.title}" (${oldestPlan.daysDelayed}일 전)`,
  };
}

/**
 * 주간 요약 체크 및 생성
 */
export async function checkAndCreateWeeklySummary(
  studentId: string,
  cachedSettings?: ReminderSettings
): Promise<ReminderCheckResult | null> {
  const settings = cachedSettings || await getReminderSettings(studentId);

  if (!settings.weeklySummaryEnabled) {
    return null;
  }

  const today = new Date();
  const dayOfWeek = today.getDay();

  // 설정된 요일이 아니면 스킵
  if (dayOfWeek !== settings.weeklySummaryDay) {
    return null;
  }

  const todayStr = today.toISOString().split("T")[0];

  // 캐시된 설정이 없을 때만 중복 체크
  if (!cachedSettings) {
    const alreadySent = await hasReminderBeenSent(
      studentId,
      "weekly_summary",
      todayStr
    );
    if (alreadySent) {
      return null;
    }
  }

  // 주간 요약 조회
  const summary = await getWeeklyIncompleteSummary(studentId);

  if (summary.totalIncomplete === 0) {
    // 미완료가 없어도 축하 메시지 발송
    await logReminderSent(studentId, "weekly_summary", todayStr, 0);

    await sendInAppNotification(
      studentId,
      "daily_goal_complete" as NotificationType,
      "이번 주 플랜을 모두 완료했어요!",
      "대단해요! 다음 주도 화이팅!",
      { actionUrl: "/today" }
    );

    return {
      shouldNotify: true,
      reminderType: "weekly_summary",
      incompletePlans: [],
      message: "이번 주 플랜을 모두 완료했어요!",
      subMessage: "대단해요! 다음 주도 화이팅!",
    };
  }

  // 알림 로그 저장
  await logReminderSent(studentId, "weekly_summary", todayStr, summary.totalIncomplete);

  const subjectList = Object.entries(summary.bySubject)
    .map(([subject, count]) => `${subject} ${count}개`)
    .join(", ");

  // 인앱 알림 생성
  await sendInAppNotification(
    studentId,
    "weekly_plan_summary" as NotificationType,
    `이번 주 ${summary.totalIncomplete}개의 플랜이 미완료예요`,
    `과목별: ${subjectList}`,
    { actionUrl: "/today" }
  );

  return {
    shouldNotify: true,
    reminderType: "weekly_summary",
    incompletePlans: [],
    message: `이번 주 ${summary.totalIncomplete}개의 플랜이 미완료예요`,
    subMessage: `과목별: ${subjectList}`,
  };
}

/**
 * 모든 리마인더 체크 실행 (최적화 버전)
 * - 설정을 한 번만 조회하여 성능 개선
 * - 리마인더 로그 배치 조회
 * (스케줄러나 페이지 로드 시 호출)
 */
export async function checkAllReminders(
  studentId: string
): Promise<ReminderCheckResult[]> {
  const results: ReminderCheckResult[] = [];

  try {
    // 설정 한 번만 조회 (성능 최적화)
    const settings = await getReminderSettings(studentId);
    const todayStr = new Date().toISOString().split("T")[0];

    // 배치로 이미 발송된 리마인더 타입 조회
    const supabase = await createSupabaseServerClient();
    const { data: sentReminders } = await supabase
      .from("plan_reminder_logs")
      .select("reminder_type")
      .eq("student_id", studentId)
      .eq("reminder_date", todayStr);

    const sentTypes = new Set(sentReminders?.map((r) => r.reminder_type) || []);

    // 일일 미완료 알림 (이미 발송되지 않은 경우만)
    if (
      settings.incompleteReminderEnabled &&
      !sentTypes.has("incomplete_daily")
    ) {
      const incompleteResult = await checkAndCreateIncompleteReminder(
        studentId,
        settings
      );
      if (incompleteResult) {
        results.push(incompleteResult);
      }
    }

    // 지연 플랜 경고 (이미 발송되지 않은 경우만)
    if (
      settings.delayedPlanWarningEnabled &&
      !sentTypes.has("delayed_warning")
    ) {
      const delayedResult = await checkAndCreateDelayedWarning(
        studentId,
        settings
      );
      if (delayedResult) {
        results.push(delayedResult);
      }
    }

    // 주간 요약 (이미 발송되지 않은 경우만)
    if (settings.weeklySummaryEnabled && !sentTypes.has("weekly_summary")) {
      const weeklyResult = await checkAndCreateWeeklySummary(studentId, settings);
      if (weeklyResult) {
        results.push(weeklyResult);
      }
    }
  } catch (error) {
    console.error("[planReminderService] 리마인더 체크 오류:", error);
  }

  return results;
}

/**
 * 클라이언트에서 호출 가능한 미완료 플랜 정보 조회
 */
export async function getIncompleteReminderInfo(
  studentId: string
): Promise<{
  todayIncomplete: IncompletePlanInfo[];
  delayedPlans: IncompletePlanInfo[];
  weeklySummary: {
    totalIncomplete: number;
    bySubject: Record<string, number>;
  };
} | null> {
  try {
    const settings = await getReminderSettings(studentId);

    const [todayIncomplete, delayedPlans, weeklySummary] = await Promise.all([
      getTodayIncompletePlans(studentId),
      settings.delayedPlanWarningEnabled
        ? getDelayedPlans(studentId, settings.delayedPlanThreshold)
        : Promise.resolve([]),
      getWeeklyIncompleteSummary(studentId),
    ]);

    return {
      todayIncomplete,
      delayedPlans,
      weeklySummary: {
        totalIncomplete: weeklySummary.totalIncomplete,
        bySubject: weeklySummary.bySubject,
      },
    };
  } catch (error) {
    console.error("[planReminderService] 미완료 정보 조회 오류:", error);
    return null;
  }
}
