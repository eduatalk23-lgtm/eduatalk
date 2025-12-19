import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampTemplateById } from "@/app/(admin)/actions/campTemplateActions";
import { getParticipantStatsForCamp } from "./_utils/getParticipantStats";
import { CampParticipantDetailView } from "./_components/CampParticipantDetailView";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CampParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { id: templateId, studentId } = await params;
  const result = await getCampTemplateById(templateId);

  if (!result.success || !result.template) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">템플릿을 찾을 수 없습니다.</p>
        </div>
      </section>
    );
  }

  // 참여자 통계 조회
  const participantStats = await getParticipantStatsForCamp(templateId, studentId);

  // 플랜 그룹 ID 조회
  const supabase = await createSupabaseServerClient();
  const { data: planGroup } = await supabase
    .from("plan_groups")
    .select("id")
    .eq("camp_template_id", templateId)
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  return (
    <CampParticipantDetailView
      template={result.template}
      studentId={studentId}
      participantStats={participantStats}
      planGroupId={planGroup?.id || null}
    />
  );
}

