"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  CheckInActionResult,
  CheckInStatus,
  dbToCheckInTitle,
} from "../types";

/**
 * KST 기준 오늘 날짜
 */
function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

/**
 * 연속 출석일 계산 (KST 기준)
 */
function calculateStreak(dates: string[], today: string): number {
  if (dates.length === 0) return 0;

  // dates는 DESC 정렬 (최신순)
  // 오늘 체크인이 포함되어 있어야 스트릭 시작
  if (dates[0] !== today) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const current = new Date(dates[i - 1]);
    const prev = new Date(dates[i]);
    const diffMs = current.getTime() - prev.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * 현재 칭호 결정 (연속/누적 중 더 높은 것)
 */
async function resolveTitle(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  streak: number,
  totalDays: number
): Promise<{ currentTitle: string | null; newTitle: string | null }> {
  const { data: titles } = await supabase
    .from("check_in_titles")
    .select("*")
    .order("required_days", { ascending: false });

  if (!titles || titles.length === 0) {
    return { currentTitle: null, newTitle: null };
  }

  const allTitles = titles.map(dbToCheckInTitle);

  // 연속 출석 칭호: 달성한 것 중 가장 높은 것
  const streakTitle = allTitles.find(
    (t) => t.titleType === "streak" && streak >= t.requiredDays
  );

  // 누적 출석 칭호: 달성한 것 중 가장 높은 것
  const cumulativeTitle = allTitles.find(
    (t) => t.titleType === "cumulative" && totalDays >= t.requiredDays
  );

  // 둘 중 requiredDays가 더 높은 것 선택
  let currentTitle: string | null = null;
  if (streakTitle && cumulativeTitle) {
    currentTitle =
      streakTitle.requiredDays >= cumulativeTitle.requiredDays
        ? streakTitle.title
        : cumulativeTitle.title;
  } else {
    currentTitle = streakTitle?.title ?? cumulativeTitle?.title ?? null;
  }

  // 마일스톤 체크: 정확히 달성 일수와 일치하는 칭호가 있으면 방금 달성
  const exactStreakTitle = allTitles.find(
    (t) => t.titleType === "streak" && t.requiredDays === streak
  );
  const exactCumulativeTitle = allTitles.find(
    (t) => t.titleType === "cumulative" && t.requiredDays === totalDays
  );

  const newTitle = exactStreakTitle?.title ?? exactCumulativeTitle?.title ?? null;

  return { currentTitle, newTitle };
}

/**
 * 앱 접속 시 자동 출석 기록 (경량 버전)
 * 학생 레이아웃에서 호출 — 어떤 페이지든 접속하면 출석 기록됨.
 * 스트릭/칭호 계산 없이 upsert만 수행하므로 오버헤드 최소.
 */
export async function ensureDailyCheckIn(
  studentId: string,
  tenantId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const today = getTodayKST();

  await supabase.from("daily_check_ins").upsert(
    { student_id: studentId, tenant_id: tenantId, check_date: today },
    { onConflict: "student_id,check_date", ignoreDuplicates: true }
  );
}

/**
 * 대시보드 진입 시 자동 체크인 + 상태 반환
 */
export async function checkInAndGetStatus(): Promise<
  CheckInActionResult<CheckInStatus>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();
    const today = getTodayKST();
    const studentId = user.userId;

    // tenant_id 조회
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", studentId)
      .single();

    if (!student) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    // 오늘 이미 체크인했는지 확인
    const { data: existing } = await supabase
      .from("daily_check_ins")
      .select("id")
      .eq("student_id", studentId)
      .eq("check_date", today)
      .maybeSingle();

    // 체크인 기록 없으면 생성
    if (!existing) {
      const { error: insertError } = await supabase
        .from("daily_check_ins")
        .insert({
          student_id: studentId,
          tenant_id: student.tenant_id,
          check_date: today,
        });

      if (insertError && insertError.code !== "23505") {
        // 23505 = unique violation (동시 요청 시)
        return { success: false, error: insertError.message };
      }
    }

    // 스트릭 계산: 최근 체크인 날짜 조회 (최대 1500일)
    const { data: recentCheckins } = await supabase
      .from("daily_check_ins")
      .select("check_date")
      .eq("student_id", studentId)
      .order("check_date", { ascending: false })
      .limit(1500);

    const dates = (recentCheckins || []).map(
      (r) => r.check_date as string
    );
    const currentStreak = calculateStreak(dates, today);
    const totalDays = dates.length;

    // 칭호 결정
    const { currentTitle, newTitle } = await resolveTitle(
      supabase,
      currentStreak,
      totalDays
    );

    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        checkedInToday: true,
        currentStreak,
        totalDays,
        currentTitle,
        newTitle: !existing ? newTitle : null, // 이미 체크인했으면 새 칭호 알림 안 함
      },
    };
  } catch (error) {
    logActionError({ domain: "checkin", action: "performCheckIn" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 체크인 상태만 조회 (체크인 생성 안 함)
 */
export async function getCheckInStatus(): Promise<
  CheckInActionResult<CheckInStatus>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." };
    }

    const supabase = await createSupabaseServerClient();
    const today = getTodayKST();
    const studentId = user.userId;

    const { data: todayCheckIn } = await supabase
      .from("daily_check_ins")
      .select("id")
      .eq("student_id", studentId)
      .eq("check_date", today)
      .maybeSingle();

    const { data: recentCheckins } = await supabase
      .from("daily_check_ins")
      .select("check_date")
      .eq("student_id", studentId)
      .order("check_date", { ascending: false })
      .limit(1500);

    const dates = (recentCheckins || []).map(
      (r) => r.check_date as string
    );
    const currentStreak = calculateStreak(dates, today);
    const totalDays = dates.length;

    const { currentTitle } = await resolveTitle(
      supabase,
      currentStreak,
      totalDays
    );

    return {
      success: true,
      data: {
        checkedInToday: !!todayCheckIn,
        currentStreak,
        totalDays,
        currentTitle,
        newTitle: null,
      },
    };
  } catch (error) {
    logActionError({ domain: "checkin", action: "getCheckInStatus" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 캘린더용 월별 체크인 날짜 조회
 */
export async function getMonthlyCheckIns(
  year: number,
  month: number,
  targetStudentId?: string
): Promise<CheckInActionResult<string[]>> {
  try {
    // targetStudentId가 제공되면 auth 호출 스킵 (불필요한 getCurrentUser + user_profiles 쿼리 제거)
    let studentId: string;
    if (targetStudentId) {
      studentId = targetStudentId;
    } else {
      const user = await getCurrentUser();
      if (!user) {
        return { success: false, error: "로그인이 필요합니다." };
      }
      studentId = user.userId;
    }

    const supabase = await createSupabaseServerClient();
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const { data } = await supabase
      .from("daily_check_ins")
      .select("check_date")
      .eq("student_id", studentId)
      .gte("check_date", startDate)
      .lt("check_date", endDate)
      .order("check_date", { ascending: true });

    return {
      success: true,
      data: (data || []).map((r) => r.check_date as string),
    };
  } catch (error) {
    logActionError({ domain: "checkin", action: "getMonthlyCheckIns" }, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
