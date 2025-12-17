import type { Tables } from "@/lib/supabase/database.types";

// Supabase 조인 결과 타입 정의
export type InternalScoreWithRelations = Tables<"student_internal_scores"> & {
  subject_group?: { name: string } | null;
  subject?: { name: string } | null;
  subject_type?: { name: string } | null;
};

export type MockScoreWithRelations = Tables<"student_mock_scores"> & {
  subject_group?: { name: string } | null;
  subject?: { name: string } | null;
};

// 분석용 확장 타입
export type EnrichedInternalScore = InternalScoreWithRelations & {
  subject_name: string;
  subject_group_name: string;
};

export type EnrichedMockScore = MockScoreWithRelations & {
  subject_name: string;
  subject_group_name?: string;
};

