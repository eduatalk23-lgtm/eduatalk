import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentCampInvitations } from "../actions/campActions";
import { CampInvitationCard } from "./_components/CampInvitationCard";
import { getContainerClass } from "@/lib/constants/layout";

export default async function CampPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = await getStudentCampInvitations();

  // 플랜 그룹 및 플랜 생성 상태 조회
  const invitationsWithPlanStatus = await Promise.all(
    (result.success && result.invitations.length > 0 ? result.invitations : []).map(async (invitation) => {
      // 플랜 그룹 조회 (accepted와 pending 모두 조회)
      const { data: planGroup } = await supabase
        .from("plan_groups")
        .select("id, status, period_start, period_end")
        .eq("camp_invitation_id", invitation.id)
        .maybeSingle();

      if (!planGroup) {
        return { 
          ...invitation, 
          planGroupId: null, 
          planGroupStatus: null,
          hasPlans: false,
          isDraft: false,
          periodStart: null,
          periodEnd: null,
        };
      }

      // 플랜 생성 여부 확인
      const { data: plans } = await supabase
        .from("student_plan")
        .select("id")
        .eq("plan_group_id", planGroup.id)
        .limit(1);

      return {
        ...invitation,
        planGroupId: planGroup.id,
        planGroupStatus: planGroup.status,
        hasPlans: (plans?.length || 0) > 0,
        isDraft: planGroup.status === "draft",
        periodStart: planGroup.period_start || null,
        periodEnd: planGroup.period_end || null,
      };
    })
  );

  return (
    <section className={getContainerClass("LIST", "lg")}>
      <div className="mb-8">
        <p className="text-sm font-medium text-gray-500">캠프 프로그램</p>
        <h1 className="text-3xl font-semibold text-gray-900">캠프 참여</h1>
        <p className="mt-2 text-sm text-gray-500">
          초대받은 캠프 프로그램에 참여하세요.
        </p>
      </div>
      {!result.success || invitationsWithPlanStatus.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">초대받은 캠프 프로그램이 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {invitationsWithPlanStatus.map((invitation) => {
            // 클릭 시 이동할 경로 결정
            const getDetailLink = () => {
              // pending 상태인 경우 항상 참여 페이지로
              if (invitation.status === "pending") {
                return `/camp/${invitation.id}`;
              }
              
              // accepted 상태인 경우
              if (invitation.status === "accepted") {
                // 플랜 그룹이 있고 플랜이 생성된 경우 플랜 그룹 상세로 (캠프 모드 표시)
                if (invitation.planGroupId && invitation.hasPlans) {
                  return `/plan/group/${invitation.planGroupId}?camp=true`;
                }
                // 플랜 그룹이 있지만 플랜이 아직 생성되지 않은 경우 제출 완료 상세로
                // (제출 완료 페이지는 플랜 그룹이 필수이므로 planGroupId가 있을 때만)
                if (invitation.planGroupId) {
                  return `/camp/${invitation.id}/submitted`;
                }
                // 플랜 그룹이 없는 경우는 이상한 케이스이므로 참여 페이지로 (안전장치)
                return `/camp/${invitation.id}`;
              }
              
              // 기본값: 참여 페이지 (안전장치)
              return `/camp/${invitation.id}`;
            };

            const detailLink = getDetailLink();

            // template의 null 값을 undefined로 변환하여 타입 호환성 확보
            const invitationForCard = {
              ...invitation,
              template: invitation.template
                ? {
                    name: invitation.template.name,
                    program_type: invitation.template.program_type || undefined,
                    description: invitation.template.description ?? undefined,
                    camp_location: invitation.template.camp_location ?? undefined,
                    camp_start_date: invitation.template.camp_start_date ?? undefined,
                    camp_end_date: invitation.template.camp_end_date ?? undefined,
                  }
                : null,
            };

            return (
              <CampInvitationCard
                key={invitation.id}
                invitation={invitationForCard}
                detailLink={detailLink}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
