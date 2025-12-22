// app/contents/books/page.tsx

import Link from "next/link";
import { addBook } from "@/app/(student)/actions/contentActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getContainerClass } from "@/lib/constants/layout";

export default async function BooksPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: books } = await supabase
    .from("books")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <section className={getContainerClass("FORM", "lg")}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">교재 등록</h1>
          <Link
            href="/contents?tab=books"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            목록으로
          </Link>
        </div>

        {/* 등록 폼 */}
        <form action={addBook} className="space-y-4 border p-4 rounded">
        <input
          name="title"
          placeholder="교재명"
          required
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="publisher"
          placeholder="출판사"
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="subject"
          placeholder="과목"
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="number"
          name="total_pages"
          placeholder="총 페이지 수"
          required
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="difficulty"
          placeholder="난이도 (예: 상/중/하)"
          className="w-full border rounded px-3 py-2"
        />

        <button className="w-full bg-black text-white py-2 rounded">
          등록하기
        </button>
        </form>

        {/* 리스트 */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">등록된 교재</h2>

          <ul className="flex flex-col gap-3">
            {books?.map((book) => (
              <li key={book.id} className="border p-3 rounded">
                <strong>{book.title}</strong> ({book.subject})
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
