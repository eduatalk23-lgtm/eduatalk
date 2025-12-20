import type { Participant } from "@/lib/data/campParticipants";

export type CampParticipantsListProps = {
  templateId: string;
  templateName: string;
};

export type SortColumn = "name" | "attendance_rate" | "study_minutes" | "plan_completion_rate";
export type SortOrder = "asc" | "desc";
export type StatusFilter = "all" | "accepted" | "pending" | "declined";

export type ParticipantsStats = {
  total: number;
  accepted: number;
  pending: number;
  declined: number;
  withPlan: number;
  needsAction: number;
};

export type { Participant };

