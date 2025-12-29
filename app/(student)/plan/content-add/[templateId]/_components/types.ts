/**
 * ContentAddWizard 타입 정의
 */

import type { RangeUnit, StudyType } from "@/lib/types/plan";

/**
 * 콘텐츠 추가 위저드 데이터 (ContentAddWizardData의 UI 서브셋)
 */
export interface WizardData {
  content: {
    id: string;
    type: "book" | "lecture" | "custom";
    name: string;
    totalUnits?: number;
    subject?: string;
    subjectCategory?: string;
  } | null;
  range: {
    start: number;
    end: number;
    unit: RangeUnit;
  } | null;
  studyType: {
    type: StudyType;
    daysPerWeek?: 2 | 3 | 4;
    reviewEnabled?: boolean;
  } | null;
  overrides?: {
    period?: { startDate: string; endDate: string };
    weekdays?: number[];
  };
}
