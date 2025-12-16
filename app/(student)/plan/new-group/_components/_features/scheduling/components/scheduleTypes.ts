import type { ContentData } from "../../../utils/scheduleTransform";

export type DailySchedule = {
  date: string;
  day_type: string;
  study_hours: number;
  week_number?: number; // 주차 번호 (선택적)
  time_slots?: Array<{
    type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
    start: string;
    end: string;
    label?: string;
  }>;
  exclusion?: {
    exclusion_type: string;
    reason?: string;
  } | null;
  academy_schedules?: Array<{
    academy_name?: string;
    subject?: string;
    start_time: string;
    end_time: string;
  }>;
  note?: string; // 일정 메모
};

export type Plan = {
  id: string;
  plan_date: string;
  block_index: number | null;
  content_type: string;
  content_id: string;
  chapter: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  completed_amount: number | null;
  plan_number: number | null;
  sequence: number | null;
  contentEpisode?: string | null; // episode/단원 정보 (강의: episode_title, 교재: major_unit/minor_unit)
};
