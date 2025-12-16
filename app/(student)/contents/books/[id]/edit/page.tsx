import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BookEditForm } from "./BookEditForm";
import { Book } from "@/app/types/content";
import { getContainerClass } from "@/lib/constants/layout";

export default async function EditBookPage({
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

  const selectBook = () =>
    supabase
      .from("books")
      .select(
        "id,title,revision,semester,subject_category,subject,publisher,difficulty_level,total_pages,notes,created_at"
      )
      .eq("id", id);

  let { data: book, error } = await selectBook()
    .eq("student_id", user.id)
    .maybeSingle<Book>();

  if (error && error.code === "42703") {
    ({ data: book, error } = await selectBook().maybeSingle<Book>());
  }

  if (error) {
    console.error(error);
    notFound();
  }

  if (!book) notFound();

  return (
    <section className={`${getContainerClass("FORM", "lg")} flex flex-col gap-6`}>
      <Link
        href={`/contents/books/${book.id}`}
        className="text-sm text-gray-500 dark:text-gray-400 transition hover:text-gray-900 dark:hover:text-gray-100"
      >
        ← 상세로 돌아가기
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">책 정보 수정</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          등록된 내용을 수정한 뒤 저장하면 상세 페이지로 이동합니다.
        </p>
      </div>

      <BookEditForm book={book} />
    </section>
  );
}

