import type { Plan } from "@/lib/data/studentPlans";

export type PlanWithContent = Plan & {
  contentTitle: string;
  contentSubject: string | null;
  contentSubjectCategory: string | null; // 교과 (국어, 수학 등)
  contentCategory: string | null; // 유형 (개념서, 문제집 등)
  contentEpisode?: string | null; // 콘텐츠 회차 (예: "1강", "2회차" 등)
};

