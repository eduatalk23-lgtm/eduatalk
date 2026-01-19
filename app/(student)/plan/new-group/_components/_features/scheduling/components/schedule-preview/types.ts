/**
 * SchedulePreviewPanel 서브 컴포넌트용 타입 정의
 *
 * @module schedule-preview/types
 */

import type { WizardData } from "../../../../PlanGroupWizard";
import type {
  ScheduleAvailabilityResult,
  DailySchedule,
} from "@/lib/scheduler/utils/scheduleCalculator";

export type SchedulePreviewPanelProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  blockSets?: Array<{
    id: string;
    name: string;
    blocks?: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  }>;
  isTemplateMode?: boolean;
  isCampMode?: boolean;
  campTemplateId?: string;
};

export type ScheduleSummaryStatsProps = {
  summary: ScheduleAvailabilityResult["summary"];
};

export type WeeklyScheduleCardProps = {
  week: DailySchedule[];
  weekIndex: number;
  isExpanded: boolean;
  isVisible: boolean;
  onToggle: () => void;
  additionalPeriod?: {
    period_start: string;
    period_end: string;
  };
  weekRef: (el: HTMLDivElement | null) => void;
};

export type DayScheduleItemProps = {
  day: DailySchedule;
  isAdditionalPeriod: boolean;
  calculateTimeFromSlots: (
    timeSlots: Array<{ type: string; start: string; end: string }> | undefined,
    type: "학습시간" | "자율학습" | "이동시간" | "학원일정"
  ) => number;
};

export { type ScheduleAvailabilityResult, type DailySchedule };
