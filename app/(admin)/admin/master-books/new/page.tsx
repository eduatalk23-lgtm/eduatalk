import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getPublishers, getCurriculumRevisions } from "@/lib/data/contentMetadata";
import { MasterBookForm } from "./MasterBookForm";

export default async function NewMasterBookPage() {
  const { role } = await getCurrentUserRole();

  // 관리자 권한 확인
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  // 데이터 조회
  const [curriculumRevisions, publishers] = await Promise.all([
    getCurriculumRevisions().catch(() => []),
    getPublishers().catch(() => []),
  ]);

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900">교재 등록</h1>
          </div>
          <Link
            href="/admin/master-books"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            목록으로
          </Link>
        </div>

        <MasterBookForm 
          curriculumRevisions={curriculumRevisions}
          publishers={publishers}
        />
      </div>
    </section>
  );
}

