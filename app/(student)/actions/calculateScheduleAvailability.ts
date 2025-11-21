"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  calculateAvailableDates,
  type Block,
  type Exclusion,
  type AcademySchedule,
  type CalculateOptions,
} from "@/lib/scheduler/calculateAvailableDates";

type CalculateScheduleAvailabilityParams = {
  periodStart: string;
  periodEnd: string;
  blockSetId: string;
  exclusions: Exclusion[];
  academySchedules: AcademySchedule[];
  schedulerType: "1730_timetable" | "자동스케줄러";
  schedulerOptions?: {
    study_days?: number;
    review_days?: number;
  };
  timeSettings?: {
    lunch_time?: { start: string; end: string };
    camp_study_hours?: { start: string; end: string };
    camp_self_study_hours?: { start: string; end: string };
    designated_holiday_hours?: { start: string; end: string };
    use_self_study_with_blocks?: boolean;
    enable_self_study_for_holidays?: boolean;
    enable_self_study_for_study_days?: boolean;
  };
};

export async function calculateScheduleAvailability(
  params: CalculateScheduleAvailabilityParams
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "로그인이 필요합니다.",
      data: null,
    };
  }

  try {
    // 블록 세트의 블록 조회
    const { data: blocksData, error: blocksError } = await supabase
      .from("student_block_schedule")
      .select("day_of_week, start_time, end_time")
      .eq("student_id", user.id)
      .eq("block_set_id", params.blockSetId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (blocksError) {
      return {
        success: false,
        error: `블록 조회 실패: ${blocksError.message}`,
        data: null,
      };
    }

    const blocks: Block[] =
      blocksData?.map((b) => ({
        day_of_week: b.day_of_week,
        start_time: b.start_time,
        end_time: b.end_time,
      })) || [];

    // 계산 옵션 설정
    const options: CalculateOptions = {
      scheduler_type: params.schedulerType,
      scheduler_options: params.schedulerOptions,
      // 시간 설정 매핑
      lunch_time: params.timeSettings?.lunch_time,
      camp_study_hours: params.timeSettings?.camp_study_hours,
      camp_self_study_hours: params.timeSettings?.camp_self_study_hours,
      designated_holiday_hours: params.timeSettings?.designated_holiday_hours,
      use_self_study_with_blocks: params.timeSettings?.use_self_study_with_blocks,
      enable_self_study_for_holidays: params.timeSettings?.enable_self_study_for_holidays,
      enable_self_study_for_study_days: params.timeSettings?.enable_self_study_for_study_days,
    };

    // 계산 실행
    const result = calculateAvailableDates(
      params.periodStart,
      params.periodEnd,
      blocks,
      params.exclusions,
      params.academySchedules,
      options
    );

    return {
      success: true,
      error: null,
      data: result,
    };
  } catch (error) {
    console.error("[calculateScheduleAvailability] 계산 실패", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "스케줄 가능 날짜 계산 중 오류가 발생했습니다.",
      data: null,
    };
  }
}

