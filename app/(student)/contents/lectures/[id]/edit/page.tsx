import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LectureEditForm } from "./LectureEditForm";
import { Lecture } from "@/app/types/content";
import { getContainerClass } from "@/lib/constants/layout";

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
    <section className={`${getContainerClass("FORM", "lg")} flex flex-col gap-6`}>
      <Link
        href={`/contents/lectures/${lecture.id}`}
        className="text-sm text-gray-500 dark:text-gray-400 transition hover:text-gray-900 dark:hover:text-gray-100"
      >
        ← 상세로 돌아가기
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">강의 정보 수정</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          등록된 내용을 수정한 뒤 저장하면 상세 페이지로 이동합니다.
        </p>
      </div>

      <LectureEditForm lecture={lecture} />
    </section>
  );
}

