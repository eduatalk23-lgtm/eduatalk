
import { WizardData } from "../../../PlanGroupWizard";

export type Step6FinalReviewProps = {
  /** WizardData (optional: Context에서 가져올 수 있음) */
  data?: WizardData;
  /** 데이터 업데이트 함수 (optional: Context에서 가져올 수 있음) */
  onUpdate?: (updates: Partial<WizardData>) => void;
  contents?: {
    books: Array<{ id: string; title: string; subtitle?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  isCampMode?: boolean;
  studentId?: string; // 캠프 모드에서 관리자가 사용하는 학생 ID
};

export type ContentInfo = {
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  title: string;
  subject_category?: string | null;
  subject_id?: string | null; // 과목 ID (FK to subjects)
  subject_group_name?: string | null; // 교과명 (subject_groups.name)
  start_range: number;
  end_range: number;
  isRecommended: boolean;
  // 자동 추천 관련 필드
  is_auto_recommended?: boolean;
  recommendation_source?: "auto" | "admin" | "template" | null;
  recommendation_reason?: string | null;
  recommendation_metadata?: {
    scoreDetails?: {
      schoolGrade?: number | null;
      schoolAverageGrade?: number | null;
      mockPercentile?: number | null;
      mockGrade?: number | null;
      riskScore?: number;
    };
    priority?: number;
  } | null;
  subject?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
  publisher?: string | null;
  platform?: string | null;
};

export type BookDetail = {
  id: string;
  page_number: number;
  major_unit: string | null;
  minor_unit: string | null;
};

export type LectureEpisode = {
  id: string;
  episode_number: number;
  episode_title: string | null;
};
