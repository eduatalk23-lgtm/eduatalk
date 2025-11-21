import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BookEditForm } from "./BookEditForm";
import { Book } from "@/app/types/content";

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
    <section className="mx-auto w-full max-w-lg px-4 py-10">
      <Link
        href={`/contents/books/${book.id}`}
        className="text-sm text-gray-500 transition hover:text-gray-900"
      >
        ← 상세로 돌아가기
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">책 정보 수정</h1>
      <p className="text-sm text-gray-500">
        등록된 내용을 수정한 뒤 저장하면 상세 페이지로 이동합니다.
      </p>

      <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <BookEditForm book={book} />
      </div>
    </section>
  );
}

