/**
 * 캠프 참여자 데이터 페칭 및 관리
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CampInvitation } from "@/lib/domains/camp/types";

export type Participant = {
  invitation_id: string;
  student_id: string;
  student_name: string;
  student_grade: string | null;
  student_class: string | null;
  invitation_status: string | null; // 원본 상태 (pending, accepted, declined)
  display_status?: string | null; // 표시용 상태 (submitted 추가)
  plan_group_id: string | null;
  plan_group_name: string | null;
  plan_group_status: string | null;
  hasPlans: boolean;
  invited_at: string | null;
  accepted_at: string | null;
  // 통계 정보 (선택적)
  attendance_rate?: number | null;
  study_minutes?: number | null;
  plan_completion_rate?: number | null;
};

type PlanGroupData = {
  id: string;
  name: string | null;
  status: string | null;
  camp_invitation_id: string | null;
  camp_template_id: string | null;
  student_id: string;
};

/**
 * 캠프 참여자 목록 로드 (클라이언트 사이드)
 * 통계 정보 포함 옵션 추가
 */
export async function loadCampParticipants(
  templateId: string,
  _options?: { includeStats?: boolean }
): Promise<Participant[]> {
  const supabase = createSupabaseBrowserClient();

  // 초대와 학생 정보 조회
  const { data: invitationsData, error: invitationsError } = await supabase
    .from("camp_invitations")
    .select(
      `
      id,
      student_id,
      status,
      invited_at,
      accepted_at,
      students:student_id (
        name,
        grade,
        class
      )
    `
    )
    .eq("camp_template_id", templateId)
    .order("invited_at", { ascending: false });

  if (invitationsError) {
    console.error("[data/campParticipants] 초대 조회 실패:", {
      templateId,
      error: invitationsError.message,
      errorCode: invitationsError.code,
      errorDetails: invitationsError.details,
    });
    throw invitationsError;
  }

  // 플랜 그룹 정보 조회
  const planGroupsData = await loadPlanGroupsForTemplate(templateId, supabase);

  // 플랜 생성 여부 확인
  const plansMap = await loadPlansForPlanGroups(
    planGroupsData.map((pg) => pg.id),
    supabase
  );

  // 데이터 병합
  const participants = await mergeParticipantData(
    (invitationsData || []).map((inv) => ({
      ...inv,
      students: Array.isArray(inv.students) && inv.students.length > 0 
        ? inv.students[0] 
        : null,
    })) as InvitationWithStudent[],
    planGroupsData,
    plansMap,
    templateId,
    supabase
  );

  // 통계 정보 포함 옵션이 활성화된 경우
  // 클라이언트 컴포넌트에서는 서버 전용 함수를 호출할 수 없으므로,
  // 통계 정보는 API 엔드포인트를 통해 별도로 로드해야 합니다.
  // 여기서는 참여자 목록만 반환합니다.
  // 통계 정보가 필요한 경우, 클라이언트에서 별도로 API를 호출하세요.
  
  return participants;
}

/**
 * 템플릿별 플랜 그룹 로드
 */
async function loadPlanGroupsForTemplate(
  templateId: string,
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): Promise<PlanGroupData[]> {
  const invitationIds = await getInvitationIdsForTemplate(templateId, supabase);
  let planGroupsData: PlanGroupData[] = [];

  if (invitationIds.length === 0) {
    return planGroupsData;
  }

  // 방법 1: camp_invitation_id로 직접 조회
  const { data: method1Data, error: method1Error } = await supabase
    .from("plan_groups")
    .select("id, name, status, camp_invitation_id, camp_template_id, student_id")
    .in("camp_invitation_id", invitationIds)
    .is("deleted_at", null);

  if (method1Error) {
    console.error(
      "[data/campParticipants] 플랜 그룹 조회 실패 (방법 1):",
      {
        templateId,
        invitationIdsCount: invitationIds.length,
        error: method1Error.message,
        errorCode: method1Error.code,
        errorDetails: method1Error.details,
      }
    );
  } else if (method1Data) {
    planGroupsData = [
      ...planGroupsData,
      ...method1Data.filter((pg) => pg.camp_invitation_id !== null),
    ];
  }

  // 방법 2: camp_template_id와 student_id로 조회 (fallback)
  const invitationsWithPlanGroups = await getInvitationsForFallback(
    templateId,
    supabase
  );

  if (invitationsWithPlanGroups.length > 0) {
    const studentIds = invitationsWithPlanGroups.map((inv: CampInvitation) => inv.student_id);
    const { data: method2Data, error: method2Error } = await supabase
      .from("plan_groups")
      .select(
        "id, name, status, camp_invitation_id, camp_template_id, student_id"
      )
      .eq("camp_template_id", templateId)
      .eq("plan_type", "camp")
      .in("student_id", studentIds)
      .is("deleted_at", null);

    if (method2Error) {
      console.error(
        "[data/campParticipants] 플랜 그룹 조회 실패 (방법 2):",
        {
          templateId,
          studentIdsCount: studentIds.length,
          error: method2Error.message,
          errorCode: method2Error.code,
          errorDetails: method2Error.details,
        }
      );
    } else if (method2Data) {
      // 이미 조회된 플랜 그룹 제외하고 추가
      const existingGroupIds = new Set(planGroupsData.map((pg) => pg.id));
      const newGroups = method2Data.filter(
        (pg) => !existingGroupIds.has(pg.id)
      );

      // camp_invitation_id가 없는 경우 매핑 시도 및 업데이트
      await updateMissingInvitationIds(
        newGroups,
        invitationsWithPlanGroups,
        supabase
      );

      planGroupsData = [...planGroupsData, ...newGroups];
    }
  }

  return planGroupsData;
}

/**
 * 초대 ID 목록 조회
 */
async function getInvitationIdsForTemplate(
  templateId: string,
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): Promise<string[]> {
  const { data: invitations } = await supabase
    .from("camp_invitations")
    .select("id")
    .eq("camp_template_id", templateId);

  return ((invitations || []) as CampInvitation[]).map((inv) => inv.id);
}

/**
 * Fallback용 초대 목록 조회 (accepted 또는 pending 상태)
 */
async function getInvitationsForFallback(
  templateId: string,
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): Promise<CampInvitation[]> {
  const { data: invitations } = await supabase
    .from("camp_invitations")
    .select("id, student_id, status")
    .eq("camp_template_id", templateId)
    .in("status", ["accepted", "pending"]);

  return (invitations as CampInvitation[] | null) ?? [];
}

/**
 * 누락된 camp_invitation_id 업데이트
 */
async function updateMissingInvitationIds(
  planGroups: PlanGroupData[],
  invitations: CampInvitation[],
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): Promise<void> {
  const groupsToUpdate: Array<{
    groupId: string;
    invitationId: string;
  }> = [];

  planGroups.forEach((pg) => {
    if (!pg.camp_invitation_id) {
      // student_id로 매칭되는 초대 찾기 (accepted 우선, 없으면 pending)
      const matchingInvitation =
        invitations.find(
          (inv) => inv.student_id === pg.student_id && inv.status === "accepted"
        ) ||
        invitations.find(
          (inv) => inv.student_id === pg.student_id && inv.status === "pending"
        );

      if (matchingInvitation) {
        pg.camp_invitation_id = matchingInvitation.id;
        groupsToUpdate.push({
          groupId: pg.id,
          invitationId: matchingInvitation.id,
        });
      }
    }
  });

  // 매핑된 플랜 그룹들의 camp_invitation_id 업데이트 (비동기)
  if (groupsToUpdate.length > 0) {
    await Promise.all(
      groupsToUpdate.map(async ({ groupId, invitationId }) => {
        try {
          const { error: updateError } = await supabase
            .from("plan_groups")
            .update({
              camp_invitation_id: invitationId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", groupId);

          if (updateError) {
            console.error(
              "[data/campParticipants] camp_invitation_id 업데이트 실패:",
              {
                groupId,
                invitationId,
                error: updateError.message || updateError.toString(),
                errorCode: updateError.code,
                errorDetails: updateError.details,
              }
            );
          }
        } catch (error) {
          console.error(
            "[data/campParticipants] camp_invitation_id 업데이트 중 예외:",
            {
              groupId,
              invitationId,
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }
      })
    );
  }
}

/**
 * 플랜 그룹별 플랜 생성 여부 확인
 */
async function loadPlansForPlanGroups(
  planGroupIds: string[],
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): Promise<Map<string, boolean>> {
  const plansMap = new Map<string, boolean>();

  if (planGroupIds.length === 0) {
    return plansMap;
  }

  const { data: plansData, error: plansError } = await supabase
    .from("student_plan")
    .select("plan_group_id")
    .in("plan_group_id", planGroupIds)
    .limit(1000);

  if (plansError) {
    console.error("[data/campParticipants] 플랜 조회 실패:", plansError);
    // 에러 발생 시 빈 맵 사용 (플랜이 없다고 간주)
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[data/campParticipants] 플랜 조회 실패로 인해 hasPlans가 모두 false로 설정됩니다.",
        {
          planGroupIdsCount: planGroupIds.length,
          error: plansError.message,
        }
      );
    }
    return plansMap;
  }

  // 플랜 그룹별 플랜 생성 여부 매핑
  (plansData || []).forEach((plan) => {
    if (plan.plan_group_id) {
      plansMap.set(plan.plan_group_id, true);
    }
  });

  return plansMap;
}

/**
 * 참여자 데이터 병합
 */
type InvitationWithStudent = CampInvitation & {
  students?: {
    name: string | null;
    grade: number | null;
    class: string | null;
  } | null;
};

type PlanGroupWithPlans = PlanGroupData & {
  hasPlans: boolean;
  isSubmitted?: boolean;
};

function mergeParticipantData(
  invitationsData: InvitationWithStudent[],
  planGroupsData: PlanGroupData[],
  plansMap: Map<string, boolean>,
  templateId: string,
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): Participant[] {
  // 플랜 그룹을 invitation_id로 매핑
  const planGroupsMap = new Map<string, PlanGroupWithPlans>();
  const planGroupsByStudentId = new Map<string, PlanGroupWithPlans[]>();

  // 먼저 camp_invitation_id가 있는 경우 매핑
  planGroupsData.forEach((pg) => {
    if (pg.camp_invitation_id) {
      planGroupsMap.set(pg.camp_invitation_id, {
        ...pg,
        hasPlans: plansMap.has(pg.id),
      });
    }

    // student_id로도 매핑 (fallback용)
    if (pg.student_id) {
      if (!planGroupsByStudentId.has(pg.student_id)) {
        planGroupsByStudentId.set(pg.student_id, []);
      }
      planGroupsByStudentId.get(pg.student_id)!.push({
        ...pg,
        hasPlans: plansMap.has(pg.id),
      });
    }
  });

  // 데이터 병합
  const data = invitationsData.map((invitation) => {
    let planGroup = planGroupsMap.get(invitation.id);

    // camp_invitation_id로 매핑되지 않은 경우, student_id로 fallback 시도
    if (!planGroup && invitation.student_id) {
      const studentPlanGroups = planGroupsByStudentId.get(invitation.student_id);
      if (studentPlanGroups && studentPlanGroups.length > 0) {
        // 가장 최근 플랜 그룹 선택 (camp_template_id가 일치하는 것 우선)
        const matchingGroup =
          studentPlanGroups.find(
            (pg) => pg.camp_template_id === templateId
          ) || studentPlanGroups[0];

        planGroup = matchingGroup;

        // camp_invitation_id가 없는 경우 업데이트 시도 (비동기)
        if (planGroup && !planGroup.camp_invitation_id) {
          updateInvitationIdForPlanGroup(
            planGroup.id,
            invitation.id,
            supabase
          );
        }
      }
    }

    // pending 상태이지만 플랜 그룹이 있는 경우: 제출 완료 상태로 간주
    if (invitation.status === "pending" && planGroup) {
      planGroup.isSubmitted = true;
    }

    return {
      ...invitation,
      plan_group: planGroup || null,
    };
  }) ?? [];

  // 데이터 변환
  return data.map((invitation) => {
    // pending 상태이지만 플랜 그룹이 있는 경우: 제출 완료 상태로 표시
    const isSubmitted =
      invitation.status === "pending" && invitation.plan_group !== null;
    const displayStatus = isSubmitted ? "submitted" : invitation.status;

    return {
      invitation_id: invitation.id,
      student_id: invitation.student_id,
      student_name: invitation.students?.name || "이름 없음",
      student_grade: invitation.students?.grade ? String(invitation.students.grade) : null,
      student_class: invitation.students?.class || null,
      invitation_status: invitation.status, // 원본 상태 유지
      display_status: displayStatus, // 표시용 상태
      plan_group_id: invitation.plan_group?.id || null,
      plan_group_name: invitation.plan_group?.name || null,
      plan_group_status: invitation.plan_group?.status || null,
      hasPlans: invitation.plan_group?.hasPlans || false,
      invited_at: invitation.invited_at,
      accepted_at: invitation.accepted_at,
    };
  });
}

/**
 * 플랜 그룹의 camp_invitation_id 업데이트 (비동기)
 */
async function updateInvitationIdForPlanGroup(
  planGroupId: string,
  invitationId: string,
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): Promise<void> {
  try {
    const { error: updateError } = await supabase
      .from("plan_groups")
      .update({
        camp_invitation_id: invitationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planGroupId);

    if (updateError) {
      console.error(
        "[data/campParticipants] camp_invitation_id 업데이트 실패:",
        {
          planGroupId,
          invitationId,
          error: updateError.message || updateError.toString(),
          errorCode: updateError.code,
          errorDetails: updateError.details,
        }
      );
    }
  } catch (error) {
    console.error(
      "[data/campParticipants] camp_invitation_id 업데이트 중 예외:",
      {
        planGroupId,
        invitationId,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

