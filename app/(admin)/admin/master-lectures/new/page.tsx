import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurriculumRevisions } from "@/lib/data/contentMetadata";
import { getMasterBooksListAction } from "@/lib/domains/content";
import { getContainerClass } from "@/lib/constants/layout";
import { MasterLectureForm } from "./MasterLectureForm";

export default async function NewMasterLecturePage() {
  const { role } = await getCurrentUserRole();

  // 관리자 권한 확인
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  // 데이터 조회
  const [curriculumRevisions, masterBooks] = await Promise.all([
    getCurriculumRevisions().catch(() => []),
    getMasterBooksListAction().catch(() => []),
  ]);

  return (
    <section className={getContainerClass("MASTER_FORM", "lg")}>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">서비스 마스터</p>
            <h1 className="text-3xl font-semibold text-gray-900">강의 등록</h1>
          </div>
          <Link
            href="/admin/master-lectures"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            목록으로
          </Link>
        </div>

        <MasterLectureForm curriculumRevisions={curriculumRevisions} masterBooks={masterBooks} />
      </div>
    </section>
  );
}

