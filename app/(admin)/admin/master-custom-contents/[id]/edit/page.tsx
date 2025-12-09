import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getMasterCustomContentById } from "@/lib/data/contentMasters";
import { getSubjectById } from "@/lib/data/subjects";
import { getCurriculumRevisions } from "@/lib/data/contentMetadata";
import { MasterCustomContentEditForm } from "./MasterCustomContentEditForm";

export default async function EditMasterCustomContentPage({
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

  const { content } = await getMasterCustomContentById(id);

  if (!content) notFound();

  // 데이터 조회
  const [curriculumRevisions, currentSubject] = await Promise.all([
    getCurriculumRevisions().catch(() => []),
    content.subject_id ? getSubjectById(content.subject_id).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">서비스 마스터</p>
            <h1 className="text-h1 text-gray-900">커스텀 콘텐츠 수정</h1>
          </div>
          <Link
            href={`/admin/master-custom-contents/${id}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
          >
            취소
          </Link>
        </div>

        <MasterCustomContentEditForm 
          content={content} 
          curriculumRevisions={curriculumRevisions}
          currentSubject={currentSubject}
        />
      </div>
    </section>
  );
}

