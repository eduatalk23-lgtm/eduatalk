import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterLectureById, getMasterBooksList } from "@/lib/data/contentMasters";
import { MasterLectureEditForm } from "./MasterLectureEditForm";

export default async function EditMasterLecturePage({
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

  const { lecture, episodes } = await getMasterLectureById(id);

  if (!lecture) notFound();

  // 마스터 교재 목록 조회 (드롭다운용)
  const masterBooks = await getMasterBooksList();

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900">강의 수정</h1>
          </div>
          <Link
            href={`/admin/master-lectures/${id}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </Link>
        </div>

        <MasterLectureEditForm lecture={lecture} episodes={episodes} masterBooks={masterBooks} />
      </div>
    </section>
  );
}

