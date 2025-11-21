import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LectureEditForm } from "./LectureEditForm";
import { Lecture } from "@/app/types/content";

export default async function EditLecturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const selectLecture = () =>
    supabase
      .from("lectures")
      .select(
        "id,title,revision,semester,subject_category,subject,platform,difficulty_level,duration,notes,created_at"
      )
      .eq("id", id);

  let { data: lecture, error } = await selectLecture()
    .eq("student_id", user.id)
    .maybeSingle<Lecture>();

  if (error && error.code === "42703") {
    ({ data: lecture, error } = await selectLecture().maybeSingle<Lecture>());
  }

  if (error) {
    console.error(error);
    notFound();
  }

  if (!lecture) notFound();

  return (
    <section className="mx-auto w-full max-w-lg px-4 py-10">
      <Link
        href={`/contents/lectures/${lecture.id}`}
        className="text-sm text-gray-500 transition hover:text-gray-900"
      >
        ← 상세로 돌아가기
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">강의 정보 수정</h1>
      <p className="text-sm text-gray-500">
        등록된 내용을 수정한 뒤 저장하면 상세 페이지로 이동합니다.
      </p>

      <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <LectureEditForm lecture={lecture} />
      </div>
    </section>
  );
}

