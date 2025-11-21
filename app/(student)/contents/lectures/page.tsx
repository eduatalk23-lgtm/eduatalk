// app/contents/lectures/page.tsx
import Link from "next/link";
import { addLecture } from "@/app/(student)/actions/contentActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LecturesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: lectures } = await supabase
    .from("lectures")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <section className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">강의 등록</h1>
        <Link
          href="/contents?tab=lectures"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          목록으로
        </Link>
      </div>

      <form action={addLecture} className="space-y-4 border p-4 rounded mb-10">
        <input
          name="title"
          placeholder="강의명"
          required
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="platform"
          placeholder="플랫폼 (메가스터디 등)"
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="subject"
          placeholder="과목"
          className="w-full border rounded px-3 py-2"
        />
        <input
          type="number"
          name="duration"
          placeholder="총 시간(분)"
          required
          className="w-full border rounded px-3 py-2"
        />
        <input
          name="difficulty"
          placeholder="난이도"
          className="w-full border rounded px-3 py-2"
        />

        <button className="w-full bg-black text-white py-2 rounded">
          등록하기
        </button>
      </form>

      <h2 className="text-lg font-medium">등록된 강의</h2>

      <ul className="mt-4 space-y-3">
        {lectures?.map((l) => (
          <li key={l.id} className="border p-3 rounded">
            <strong>{l.title}</strong> ({l.subject})
          </li>
        ))}
      </ul>
    </section>
  );
}
