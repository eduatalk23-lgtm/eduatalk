import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterBookById } from "@/lib/data/contentMasters";
import { getSubjectById } from "@/lib/data/subjects";
import { getPublishers, getCurriculumRevisions } from "@/lib/data/contentMetadata";
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

  // 데이터 조회
  const [curriculumRevisions, publishers, currentSubject] = await Promise.all([
    getCurriculumRevisions().catch(() => []),
    getPublishers().catch(() => []),
    book.subject_id ? getSubjectById(book.subject_id).catch(() => null) : Promise.resolve(null),
  ]);

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

        <MasterBookEditForm 
          book={book} 
          details={details}
          curriculumRevisions={curriculumRevisions}
          publishers={publishers}
          currentSubject={currentSubject}
        />
      </div>
    </section>
  );
}

