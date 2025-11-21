import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterBookById } from "@/lib/data/contentMasters";
import { MasterBookEditForm } from "./MasterBookEditForm";

export default async function EditMasterBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role } = await getCurrentUserRole();

  // 관리자 권한 확인
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { book, details } = await getMasterBookById(id);

  if (!book) notFound();

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900">교재 수정</h1>
          </div>
          <Link
            href={`/admin/master-books/${id}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </Link>
        </div>

        <MasterBookEditForm book={book} details={details} />
      </div>
    </section>
  );
}

