import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateStudentScore } from "@/app/actions/scores";
import { ScoreForm } from "../../_components/ScoreForm";

type ScoreRow = {
  id: string;
  subject_type: string | null;
  semester: string | null;
  course: string | null;
  course_detail: string | null;
  raw_score: number | null;
  grade: number | null;
  score_type_detail: string | null;
  test_date: string | null;
};

type EditScorePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditScorePage({ params }: EditScorePageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 성적 조회
  const selectScore = () =>
    supabase
      .from("student_scores")
      .select(
        "id,subject_type,semester,course,course_detail,raw_score,grade,score_type_detail,test_date"
      )
      .eq("id", id);

  let { data: score, error } = await selectScore().eq("student_id", user.id).single();

  if (error && error.code === "42703") {
    ({ data: score, error } = await selectScore().single());
  }

  if (error || !score) {
    notFound();
  }

  const scoreData = score as ScoreRow;

  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">성적 수정</h1>
        <p className="mt-2 text-sm text-gray-500">
          성적 정보를 수정하세요.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <ScoreForm
          action={(formData: FormData) => updateStudentScore(id, formData)}
          initialData={{
            subject_type: scoreData.subject_type ?? "",
            semester: scoreData.semester ?? "",
            course: scoreData.course ?? "",
            course_detail: scoreData.course_detail ?? "",
            raw_score: scoreData.raw_score?.toString() ?? "",
            grade: scoreData.grade?.toString() ?? "",
            score_type_detail: scoreData.score_type_detail ?? "",
            test_date: scoreData.test_date
              ? new Date(scoreData.test_date).toISOString().split("T")[0]
              : "",
          }}
        />
      </div>
    </section>
  );
}

