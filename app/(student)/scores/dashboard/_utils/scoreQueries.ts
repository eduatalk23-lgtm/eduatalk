import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type SchoolScoreRow = {
  id: string;
  student_id: string;
  grade: number;
  semester: number;
  subject_group: string;
  subject_type: string | null;
  subject_name: string | null;
  raw_score: number | null;
  grade_score: number | null;
  class_rank: number | null;
  created_at: string | null;
};

export type MockScoreRow = {
  id: string;
  student_id: string;
  grade: number;
  subject_group: string;
  exam_type: string;
  subject_name: string | null;
  raw_score: number | null;
  percentile: number | null;
  grade_score: number | null;
  exam_round: string | null;
  created_at: string | null;
};

// 내신 성적 조회
export async function fetchSchoolScores(
  studentId: string
): Promise<SchoolScoreRow[]> {
  try {
    const supabase = await createSupabaseServerClient();

    // tenant_id도 함께 조회 (RLS 정책 준수)
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) {
      console.warn("[dashboard] 사용자 정보 없음");
      return [];
    }

    const selectScores = () =>
      supabase
        .from("student_school_scores")
        .select("*")
        .eq("student_id", studentId)
        .order("grade", { ascending: true })
        .order("semester", { ascending: true })
        .order("created_at", { ascending: false });

    let { data: scores, error } = await selectScores();

    // fallback: student_id 컬럼이 없는 경우
    if (error && error.code === "42703") {
      ({ data: scores, error } = await supabase
        .from("student_school_scores")
        .select("*")
        .order("grade", { ascending: true })
        .order("semester", { ascending: true })
        .order("created_at", { ascending: false }));
    }

    if (error) {
      console.error("[dashboard] 내신 성적 조회 실패", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        error,
      });
      return [];
    }

    return (scores as SchoolScoreRow[] | null) ?? [];
  } catch (err) {
    console.error("[dashboard] 내신 성적 조회 중 예외 발생", err);
    return [];
  }
}

// 모의고사 성적 조회
export async function fetchMockScores(
  studentId: string
): Promise<MockScoreRow[]> {
  try {
    const supabase = await createSupabaseServerClient();

    // tenant_id도 함께 조회 (RLS 정책 준수)
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) {
      console.warn("[dashboard] 사용자 정보 없음");
      return [];
    }

    const selectScores = () =>
      supabase
        .from("student_mock_scores")
        .select("*")
        .eq("student_id", studentId)
        .order("grade", { ascending: true })
        .order("created_at", { ascending: false });

    let { data: scores, error } = await selectScores();

    // fallback: student_id 컬럼이 없는 경우
    if (error && error.code === "42703") {
      ({ data: scores, error } = await supabase
        .from("student_mock_scores")
        .select("*")
        .order("grade", { ascending: true })
        .order("created_at", { ascending: false }));
    }

    if (error) {
      console.error("[dashboard] 모의고사 성적 조회 실패", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        error,
      });
      return [];
    }

    return (scores as MockScoreRow[] | null) ?? [];
  } catch (err) {
    console.error("[dashboard] 모의고사 성적 조회 중 예외 발생", err);
    return [];
  }
}

