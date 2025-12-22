import { redirect, notFound } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampPlanGroupForReview } from "@/lib/domains/camp/actions";
import { CampPlanGroupReviewForm } from "./CampPlanGroupReviewForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentById } from "@/lib/data/students";

export default async function CampPlanGroupReviewPage({
  params,
}: {
  params: Promise<{ id: string; groupId: string }>;
}) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { id: templateId, groupId } = await params;
  const result = await getCampPlanGroupForReview(groupId);

  if (!result.success || !result.group) {
    notFound();
  }

  // 학생 정보 조회
  const studentInfo = await getStudentById(result.group.student_id);

  return (
    <CampPlanGroupReviewForm
      templateId={templateId}
      groupId={groupId}
      group={result.group}
      contents={result.contents}
      exclusions={result.exclusions}
      academySchedules={result.academySchedules}
      templateBlocks={result.templateBlocks || []}
      templateBlockSetName={result.templateBlockSetName || null}
      templateBlockSetId={result.templateBlockSetId || null}
      studentInfo={studentInfo ? {
        name: studentInfo.name || "이름 없음",
        grade: studentInfo.grade || null,
        class: studentInfo.class || null,
      } : null}
    />
  );
}

