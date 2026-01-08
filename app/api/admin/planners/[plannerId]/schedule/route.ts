/**
 * 플래너 스케줄 API
 *
 * 플래너의 지정 기간 동안의 스케줄 정보를 반환
 * - 일별 가용 학습 시간대
 * - 기존 플랜 점유 시간
 *
 * @module app/api/admin/planners/[plannerId]/schedule/route
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateScheduleForPlanner } from "@/lib/domains/admin-plan/actions/planCreation/scheduleGenerator";
import { getExistingPlansForDateRange } from "@/lib/domains/admin-plan/actions/planCreation/existingPlansQuery";

interface DailyScheduleInfo {
  date: string;
  dayType: string;
  weekNumber: number | null;
  timeSlots: Array<{ start: string; end: string }>;
  availableRanges: Array<{ start: string; end: string }>;
  existingPlans: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    contentType?: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ plannerId: string }> }
) {
  try {
    const { plannerId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get("studentId");
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");

    if (!studentId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { success: false, error: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 1. 플래너 기반 스케줄 생성
    const scheduleResult = await generateScheduleForPlanner(
      plannerId,
      periodStart,
      periodEnd
    );

    if (!scheduleResult.success) {
      return NextResponse.json({
        success: false,
        error: scheduleResult.error || "스케줄 생성 실패",
      });
    }

    // 2. 기존 플랜 조회
    const existingPlans = await getExistingPlansForDateRange(
      studentId,
      periodStart,
      periodEnd
    );

    // 3. 일별 스케줄 정보 구성
    const dailySchedules: DailyScheduleInfo[] = [];

    // dateTimeSlots에서 날짜 목록 추출
    const dates = new Set<string>();
    scheduleResult.dateTimeSlots.forEach((_, date) => dates.add(date));
    scheduleResult.dateAvailableTimeRanges.forEach((_, date) => dates.add(date));

    // 요청 기간 내 모든 날짜 포함
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.add(d.toISOString().slice(0, 10));
    }

    // 날짜별로 정보 조합
    const sortedDates = Array.from(dates).sort();
    for (const date of sortedDates) {
      const dailyInfo = scheduleResult.dailySchedule.find((d) => d.date === date);
      const timeSlots = scheduleResult.dateTimeSlots.get(date) || [];
      const availableRanges = scheduleResult.dateAvailableTimeRanges.get(date) || [];

      // 해당 날짜의 기존 플랜
      const plansOnDate = existingPlans
        .filter((plan) => plan.date === date && plan.start_time && plan.end_time)
        .map((plan) => ({
          id: plan.id,
          title: plan.content_title || plan.title || "플랜",
          start: plan.start_time!,
          end: plan.end_time!,
          contentType: plan.content_type ?? undefined,
        }));

      dailySchedules.push({
        date,
        dayType: dailyInfo?.day_type || "학습일",
        weekNumber: dailyInfo?.week_number || null,
        timeSlots,
        availableRanges,
        existingPlans: plansOnDate,
      });
    }

    return NextResponse.json({
      success: true,
      data: dailySchedules,
    });
  } catch (error) {
    console.error("[API] /admin/planners/[plannerId]/schedule 에러:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "서버 오류",
      },
      { status: 500 }
    );
  }
}
