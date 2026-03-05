/**
 * 학부모 파일 페이지
 * 자녀의 드라이브 파일 + 워크플로우 요청 열람/제출
 */

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents, canAccessStudent } from "@/lib/domains/parent";
import { StudentSelector } from "../_components/StudentSelector";
import { ParentFilesClient } from "./_components/ParentFilesClient";

export const metadata = {
  title: "자녀 파일 | TimeLevelUp",
};

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ParentFilesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  const linkedStudents = await getLinkedStudents(supabase, userId);

  if (linkedStudents.length === 0) {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="flex flex-col gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-yellow-900">
            연결된 자녀가 없습니다
          </h2>
        </div>
      </section>
    );
  }

  const selectedStudentId = params.studentId || linkedStudents[0].id;

  const hasAccess = await canAccessStudent(supabase, userId, selectedStudentId);

  if (!hasAccess) {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-900">
            접근 권한이 없습니다
          </h2>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <StudentSelector
        students={linkedStudents}
        selectedStudentId={selectedStudentId}
      />
      <ParentFilesClient studentId={selectedStudentId} />
    </section>
  );
}
