"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";
import { BatchOperationDialog } from "./_components/BatchOperationDialog";
import { batchUpdateCampPlanGroupStatus } from "@/app/(admin)/actions/campTemplateActions";

type Participant = {
  invitation_id: string;
  student_id: string;
  student_name: string;
  student_grade: string | null;
  student_class: string | null;
  invitation_status: string; // 원본 상태 (pending, accepted, declined)
  display_status?: string; // 표시용 상태 (submitted 추가)
  plan_group_id: string | null;
  plan_group_name: string | null;
  plan_group_status: string | null;
  hasPlans: boolean;
  invited_at: string;
  accepted_at: string | null;
};

type CampParticipantsListProps = {
  templateId: string;
  templateName: string;
};

export function CampParticipantsList({
  templateId,
  templateName,
}: CampParticipantsListProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    Set<string>
  >(new Set());
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchOperationType, setBatchOperationType] = useState<
    "activate" | "status_change"
  >("activate");
  const [batchStatus, setBatchStatus] = useState<string>("active");

  useEffect(() => {
    loadParticipants();
  }, [templateId]);

  const loadParticipants = async () => {
    try {
      setLoading(true);
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
        console.error("[CampParticipantsList] 초대 조회 실패:", {
          templateId,
          error: invitationsError.message,
          errorCode: invitationsError.code,
          errorDetails: invitationsError.details,
        });
        throw invitationsError;
      }

      // 플랜 그룹 정보 별도 조회 (camp_invitation_id로)
      const invitationIds = (invitationsData || []).map((inv: any) => inv.id);
      let planGroupsData: any[] = [];

      if (invitationIds.length > 0) {
        // 방법 1: camp_invitation_id로 직접 조회
        const { data: method1Data, error: method1Error } = await supabase
          .from("plan_groups")
          .select("id, name, status, camp_invitation_id, student_id")
          .in("camp_invitation_id", invitationIds)
          .is("deleted_at", null);

        if (method1Error) {
          console.error(
            "[CampParticipantsList] 플랜 그룹 조회 실패 (방법 1):",
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
            ...method1Data.filter((pg: any) => pg.camp_invitation_id !== null),
          ];
        }

        // 방법 2: camp_template_id와 student_id로 조회 (fallback)
        // accepted 또는 pending 상태인 초대에 대해 플랜 그룹 조회
        // (학생이 제출했지만 상태가 아직 pending인 경우도 포함)
        const invitationsWithPlanGroups = (invitationsData || []).filter(
          (inv: any) => inv.status === "accepted" || inv.status === "pending"
        );

        if (invitationsWithPlanGroups.length > 0) {
          const studentIds = invitationsWithPlanGroups.map(
            (inv: any) => inv.student_id
          );
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
              "[CampParticipantsList] 플랜 그룹 조회 실패 (방법 2):",
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
            const existingGroupIds = new Set(
              planGroupsData.map((pg: any) => pg.id)
            );
            const newGroups = method2Data.filter(
              (pg: any) => !existingGroupIds.has(pg.id)
            );

            // camp_invitation_id가 없는 경우 매핑 시도 및 업데이트
            const groupsToUpdate: Array<{
              groupId: string;
              invitationId: string;
            }> = [];

            newGroups.forEach((pg: any) => {
              if (!pg.camp_invitation_id) {
                // student_id로 매칭되는 초대 찾기 (accepted 우선, 없으면 pending)
                const matchingInvitation =
                  invitationsWithPlanGroups.find(
                    (inv: any) =>
                      inv.student_id === pg.student_id &&
                      inv.status === "accepted"
                  ) ||
                  invitationsWithPlanGroups.find(
                    (inv: any) =>
                      inv.student_id === pg.student_id &&
                      inv.status === "pending"
                  );

                if (matchingInvitation) {
                  pg.camp_invitation_id = matchingInvitation.id;
                  groupsToUpdate.push({
                    groupId: pg.id,
                    invitationId: matchingInvitation.id,
                  });
                } else if (process.env.NODE_ENV === "development") {
                  console.warn(
                    "[CampParticipantsList] 매칭되는 초대를 찾을 수 없음:",
                    {
                      planGroupId: pg.id,
                      studentId: pg.student_id,
                      templateId: pg.camp_template_id,
                    }
                  );
                }
              }
            });

            // 매핑된 플랜 그룹들의 camp_invitation_id 업데이트 (비동기)
            if (groupsToUpdate.length > 0) {
              (async () => {
                for (const { groupId, invitationId } of groupsToUpdate) {
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
                        "[CampParticipantsList] camp_invitation_id 업데이트 실패 (방법 2):",
                        {
                          groupId,
                          invitationId,
                          error: updateError.message || updateError.toString(),
                          errorCode: updateError.code,
                          errorDetails: updateError.details,
                          fullError: updateError,
                        }
                      );
                    }
                  } catch (error) {
                    console.error(
                      "[CampParticipantsList] camp_invitation_id 업데이트 중 예외 (방법 2):",
                      {
                        groupId,
                        invitationId,
                        error:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      }
                    );
                  }
                }
              })();
            }

            planGroupsData = [...planGroupsData, ...newGroups];
          }
        }

        // 개발 환경에서 조회 결과 로깅
        if (process.env.NODE_ENV === "development") {
          console.log("[CampParticipantsList] 플랜 그룹 조회 결과:", {
            totalInvitations: invitationIds.length,
            planGroupsFound: planGroupsData.length,
            planGroupsWithInvitationId: planGroupsData.filter(
              (pg: any) => pg.camp_invitation_id
            ).length,
          });
        }
      }

      // 플랜 생성 여부 확인 (student_plan 테이블 조회)
      const planGroupIds = (planGroupsData || []).map((pg: any) => pg.id);
      let plansMap = new Map<string, boolean>();

      if (planGroupIds.length > 0) {
        const { data: plansData, error: plansError } = await supabase
          .from("student_plan")
          .select("plan_group_id")
          .in("plan_group_id", planGroupIds)
          .limit(1000);

        if (plansError) {
          console.error("[CampParticipantsList] 플랜 조회 실패:", plansError);
          // 에러 발생 시 빈 맵 사용 (플랜이 없다고 간주)
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "[CampParticipantsList] 플랜 조회 실패로 인해 hasPlans가 모두 false로 설정됩니다.",
              {
                planGroupIdsCount: planGroupIds.length,
                error: plansError.message,
              }
            );
          }
        } else {
          // 플랜 그룹별 플랜 생성 여부 매핑
          (plansData || []).forEach((plan: any) => {
            if (plan.plan_group_id) {
              plansMap.set(plan.plan_group_id, true);
            }
          });

          // 개발 환경에서 조회 결과 로깅
          if (process.env.NODE_ENV === "development") {
            console.log("[CampParticipantsList] 플랜 조회 결과:", {
              planGroupIdsCount: planGroupIds.length,
              plansFound: plansData?.length || 0,
              uniquePlanGroups: plansMap.size,
            });
          }
        }
      }

      // 플랜 그룹을 invitation_id로 매핑
      const planGroupsMap = new Map<string, any>();
      const planGroupsByStudentId = new Map<string, any[]>();

      // 먼저 camp_invitation_id가 있는 경우 매핑
      (planGroupsData || []).forEach((pg: any) => {
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
      const data = (invitationsData || []).map((invitation: any) => {
        let planGroup = planGroupsMap.get(invitation.id);

        // camp_invitation_id로 매핑되지 않은 경우, student_id로 fallback 시도
        if (!planGroup && invitation.student_id) {
          const studentPlanGroups = planGroupsByStudentId.get(
            invitation.student_id
          );
          if (studentPlanGroups && studentPlanGroups.length > 0) {
            // 가장 최근 플랜 그룹 선택 (camp_template_id가 일치하는 것 우선)
            const matchingGroup =
              studentPlanGroups.find(
                (pg: any) => pg.camp_template_id === templateId
              ) || studentPlanGroups[0];

            planGroup = matchingGroup;

            // camp_invitation_id가 없는 경우 업데이트 시도 (비동기)
            // UI 블로킹을 방지하기 위해 비동기로 처리하되, 에러 처리를 강화
            if (planGroup && !planGroup.camp_invitation_id) {
              (async () => {
                try {
                  const { error: updateError } = await supabase
                    .from("plan_groups")
                    .update({
                      camp_invitation_id: invitation.id,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", planGroup.id);

                  if (updateError) {
                    console.error(
                      "[CampParticipantsList] camp_invitation_id 업데이트 실패:",
                      {
                        planGroupId: planGroup.id,
                        invitationId: invitation.id,
                        studentId: invitation.student_id,
                        error: updateError.message || updateError.toString(),
                        errorCode: updateError.code,
                        errorDetails: updateError.details,
                        fullError: updateError,
                      }
                    );
                  } else if (process.env.NODE_ENV === "development") {
                    console.log(
                      "[CampParticipantsList] camp_invitation_id 업데이트 성공:",
                      {
                        planGroupId: planGroup.id,
                        invitationId: invitation.id,
                        studentId: invitation.student_id,
                      }
                    );
                  }
                } catch (error) {
                  console.error(
                    "[CampParticipantsList] camp_invitation_id 업데이트 중 예외:",
                    {
                      planGroupId: planGroup.id,
                      invitationId: invitation.id,
                      error:
                        error instanceof Error ? error.message : String(error),
                    }
                  );
                }
              })();
            }
          }
        }

        // 디버깅: 초대 상태가 accepted 또는 pending인데 플랜 그룹이 없는 경우
        if (
          (invitation.status === "accepted" ||
            invitation.status === "pending") &&
          !planGroup
        ) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "[CampParticipantsList] 초대 상태는 " +
                invitation.status +
                "인데 플랜 그룹이 조회되지 않음:",
              {
                invitationId: invitation.id,
                studentId: invitation.student_id,
                invitationStatus: invitation.status,
                planGroupsFound: planGroupsData?.length || 0,
                planGroupsForStudent:
                  planGroupsByStudentId.get(invitation.student_id)?.length || 0,
              }
            );
          }
        }

        // pending 상태이지만 플랜 그룹이 있는 경우: 제출 완료 상태로 간주
        // (학생이 제출했지만 아직 accepted로 변경되지 않은 경우)
        if (invitation.status === "pending" && planGroup) {
          // 제출 완료 상태로 표시하기 위해 planGroup에 플래그 추가
          planGroup.isSubmitted = true;
        }

        return {
          ...invitation,
          plan_group: planGroup || null,
        };
      });

      // 데이터 변환
      const participantsData: Participant[] = data.map((invitation: any) => {
        // pending 상태이지만 플랜 그룹이 있는 경우: 제출 완료 상태로 표시
        const isSubmitted =
          invitation.status === "pending" && invitation.plan_group !== null;
        const displayStatus = isSubmitted ? "submitted" : invitation.status;

        return {
          invitation_id: invitation.id,
          student_id: invitation.student_id,
          student_name: invitation.students?.name || "이름 없음",
          student_grade: invitation.students?.grade || null,
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

      setParticipants(participantsData);
    } catch (error) {
      console.error("[CampParticipantsList] 참여자 목록 로드 실패:", {
        templateId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      toast.showError(
        error instanceof Error
          ? `참여자 목록을 불러오는데 실패했습니다: ${error.message}`
          : "참여자 목록을 불러오는데 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  // 필터링된 참여자 목록
  const filteredParticipants = participants.filter((p) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "accepted") return p.invitation_status === "accepted";
    if (statusFilter === "pending") return p.invitation_status === "pending";
    if (statusFilter === "declined") return p.invitation_status === "declined";
    return true;
  });

  // 선택 가능한 참여자만 필터링 (플랜이 생성된 참여자만 활성화 가능)
  const selectableParticipants = filteredParticipants.filter(
    (p) => p.plan_group_id !== null && p.hasPlans
  );

  // 전체 선택/해제 핸들러
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectableIds = new Set(
        selectableParticipants
          .map((p) => p.plan_group_id)
          .filter(Boolean) as string[]
      );
      setSelectedParticipantIds(selectableIds);
    } else {
      setSelectedParticipantIds(new Set());
    }
  };

  // 개별 선택/해제 핸들러
  const handleToggleSelect = (planGroupId: string | null) => {
    if (!planGroupId) return;

    setSelectedParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(planGroupId)) {
        next.delete(planGroupId);
      } else {
        next.add(planGroupId);
      }
      return next;
    });
  };

  // 필터 변경 시 선택 해제
  useEffect(() => {
    setSelectedParticipantIds(new Set());
  }, [statusFilter]);

  // 일괄 작업 핸들러
  const handleBatchActivate = () => {
    if (selectedParticipantIds.size === 0) {
      toast.showError("선택된 참여자가 없습니다.");
      return;
    }
    setBatchOperationType("activate");
    setBatchStatus("active");
    setBatchDialogOpen(true);
  };

  const handleBatchStatusChange = (status: string) => {
    if (selectedParticipantIds.size === 0) {
      toast.showError("선택된 참여자가 없습니다.");
      return;
    }
    setBatchOperationType("status_change");
    setBatchStatus(status);
    setBatchDialogOpen(true);
  };

  const handleBatchConfirm = async () => {
    if (selectedParticipantIds.size === 0) {
      toast.showError("선택된 참여자가 없습니다.");
      setBatchDialogOpen(false);
      return;
    }

    const groupIds = Array.from(selectedParticipantIds);

    startTransition(async () => {
      try {
        const result = await batchUpdateCampPlanGroupStatus(
          groupIds,
          batchStatus
        );

        if (result.success) {
          toast.showSuccess(
            `${result.successCount}개 플랜 그룹의 상태가 변경되었습니다.`
          );
          setSelectedParticipantIds(new Set());
          setBatchDialogOpen(false);
          await loadParticipants();
        } else {
          const errorMsg =
            result.errors && result.errors.length > 0
              ? `${result.failureCount}개 실패: ${result.errors[0].error}`
              : "일괄 작업에 실패했습니다.";
          toast.showError(errorMsg);

          if (result.successCount > 0) {
            // 부분 성공 시 선택된 항목 갱신
            const successIds = new Set(
              groupIds.filter(
                (id) => !result.errors?.some((e) => e.groupId === id)
              )
            );
            setSelectedParticipantIds(successIds);
            await loadParticipants();
          }
        }
      } catch (error) {
        console.error("일괄 작업 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "일괄 작업에 실패했습니다."
        );
      }
    });
  };

  // 통계
  const stats = {
    total: participants.length,
    accepted: participants.filter((p) => p.display_status === "accepted")
      .length,
    pending: participants.filter(
      (p) => p.display_status === "pending" || p.display_status === "submitted"
    ).length,
    declined: participants.filter((p) => p.display_status === "declined")
      .length,
    withPlan: participants.filter((p) => p.plan_group_id !== null).length,
    needsAction: participants.filter(
      (p) => p.plan_group_id !== null && !p.hasPlans
    ).length,
  };

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="text-sm text-gray-500">
          참여자 목록을 불러오는 중...
        </div>
      </section>
    );
  }

  // 작업이 필요한 참여자 목록 (플랜 그룹이 있지만 플랜이 생성되지 않은 경우)
  const needsActionParticipants = participants.filter(
    (p) => p.plan_group_id !== null && !p.hasPlans
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              참여자 목록
            </h1>
            <p className="text-sm text-gray-500">{templateName}</p>
          </div>
          <Link
            href={`/admin/camp-templates/${templateId}`}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            템플릿으로 돌아가기
          </Link>
        </div>

        {/* 작업 필요 알림 */}
        {needsActionParticipants.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900">
                  작업이 필요한 참여자가 있습니다
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  {needsActionParticipants.length}명의 참여자가 제출을
                  완료했지만 플랜이 생성되지 않았습니다. "남은 단계 진행" 버튼을
                  클릭하여 플랜 생성을 완료해주세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 통계 */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">전체</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {stats.total}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">수락</div>
            <div className="mt-1 text-2xl font-semibold text-green-600">
              {stats.accepted}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">대기중</div>
            <div className="mt-1 text-2xl font-semibold text-yellow-600">
              {stats.pending}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">거절</div>
            <div className="mt-1 text-2xl font-semibold text-red-600">
              {stats.declined}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">플랜 생성 완료</div>
            <div className="mt-1 text-2xl font-semibold text-blue-600">
              {participants.filter((p) => p.hasPlans).length}
            </div>
          </div>
          <div
            className={`rounded-lg border p-4 ${
              needsActionParticipants.length > 0
                ? "border-orange-200 bg-orange-50"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="text-sm text-gray-600">작업 필요</div>
            <div
              className={`mt-1 text-2xl font-semibold ${
                needsActionParticipants.length > 0
                  ? "text-orange-600"
                  : "text-gray-900"
              }`}
            >
              {stats.needsAction}
            </div>
          </div>
        </div>

        {/* 필터 및 일괄 작업 버튼 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">
              상태 필터:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">전체</option>
              <option value="accepted">수락</option>
              <option value="pending">대기중</option>
              <option value="declined">거절</option>
            </select>
          </div>

          {selectedParticipantIds.size > 0 && (
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">
                <span className="font-medium">
                  {selectedParticipantIds.size}
                </span>
                개 선택됨
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBatchActivate}
                  disabled={isPending}
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="선택한 참여자의 플랜 그룹을 활성화합니다"
                >
                  일괄 활성화
                </button>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBatchStatusChange(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  disabled={isPending}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">상태 변경</option>
                  <option value="active">활성</option>
                  <option value="saved">저장됨</option>
                  <option value="paused">일시정지</option>
                  <option value="completed">완료</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 참여자 목록 */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse rounded-lg border border-gray-200 bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  <input
                    type="checkbox"
                    checked={
                      selectableParticipants.length > 0 &&
                      selectableParticipants.every(
                        (p) =>
                          p.plan_group_id &&
                          selectedParticipantIds.has(p.plan_group_id)
                      )
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  학생명
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  학년/반
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  초대 상태
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  플랜 그룹
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  플랜 상태
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  참여일
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    참여자가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((participant) => {
                  const isSelectable =
                    participant.plan_group_id !== null && participant.hasPlans;
                  const isSelected =
                    participant.plan_group_id !== null &&
                    selectedParticipantIds.has(participant.plan_group_id);

                  // 작업 필요 여부 확인
                  const needsAction =
                    participant.plan_group_id !== null && !participant.hasPlans;

                  return (
                    <tr
                      key={participant.invitation_id}
                      className={`hover:bg-gray-50 ${
                        needsAction ? "bg-orange-50/30" : ""
                      }`}
                    >
                      <td className="border-b border-gray-100 px-4 py-3">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              handleToggleSelect(participant.plan_group_id)
                            }
                            disabled={!isSelectable}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                            title={
                              !isSelectable
                                ? participant.plan_group_id === null
                                  ? "플랜 그룹이 없는 참여자는 선택할 수 없습니다."
                                  : !participant.hasPlans
                                  ? "플랜이 생성되지 않은 참여자는 선택할 수 없습니다. '남은 단계 진행' 버튼을 클릭하여 플랜을 생성해주세요."
                                  : "선택할 수 없습니다."
                                : "선택"
                            }
                            aria-label={
                              isSelectable
                                ? `${participant.student_name} 선택`
                                : needsAction
                                ? `${participant.student_name} - 플랜 생성 필요 (선택 불가)`
                                : `${participant.student_name} 선택 불가`
                            }
                          />
                          {!isSelectable && (
                            <span className="sr-only">
                              {needsAction
                                ? "플랜이 생성되지 않아 선택할 수 없습니다. 남은 단계 진행 버튼을 사용하여 플랜을 생성해주세요."
                                : "선택할 수 없습니다."}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">
                        {participant.student_name}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                        {participant.student_grade && participant.student_class
                          ? `${participant.student_grade}학년 ${participant.student_class}반`
                          : "—"}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm">
                        {participant.display_status === "submitted" && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                            제출 완료
                          </span>
                        )}
                        {participant.display_status === "pending" && (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                            대기중
                          </span>
                        )}
                        {participant.display_status === "accepted" && (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                            수락
                          </span>
                        )}
                        {participant.display_status === "declined" && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                            거절
                          </span>
                        )}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                        {participant.plan_group_name || "—"}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm">
                        {needsAction ? (
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                            작업 필요
                          </span>
                        ) : participant.plan_group_status ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                            {participant.plan_group_status}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                        {participant.accepted_at
                          ? new Date(
                              participant.accepted_at
                            ).toLocaleDateString("ko-KR")
                          : "—"}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {participant.plan_group_id ? (
                            <>
                              {/* 플랜이 생성되지 않은 경우 남은 단계 진행 버튼 표시 */}
                              {!participant.hasPlans ? (
                                <>
                                  <Link
                                    href={`/admin/camp-templates/${templateId}/participants/${participant.plan_group_id}/continue`}
                                    className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-700 shadow-sm"
                                    title="플랜 생성을 완료하려면 클릭하세요"
                                  >
                                    🔧 남은 단계 진행
                                  </Link>
                                  <Link
                                    href={`/admin/camp-templates/${templateId}/participants/${participant.plan_group_id}/review`}
                                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                                    title="학생이 제출한 내용을 확인합니다"
                                  >
                                    제출 내용 확인
                                  </Link>
                                  {process.env.NODE_ENV === "development" && (
                                    <span
                                      className="text-xs text-gray-400"
                                      title={`hasPlans: ${participant.hasPlans}, plan_group_id: ${participant.plan_group_id}`}
                                    >
                                      (디버그)
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Link
                                    href={`/admin/camp-templates/${templateId}/participants/${participant.plan_group_id}/review`}
                                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700"
                                  >
                                    상세 보기
                                  </Link>
                                  <Link
                                    href={`/admin/plan-groups/${participant.plan_group_id}`}
                                    className="text-indigo-600 hover:text-indigo-800 text-xs"
                                  >
                                    플랜 보기
                                  </Link>
                                </>
                              )}
                            </>
                          ) : (participant.display_status === "accepted" ||
                              participant.display_status === "submitted") &&
                            !participant.plan_group_id ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-orange-600 font-medium">
                                ⚠️ 제출 완료 (플랜 그룹 없음)
                              </span>
                              <span className="text-xs text-gray-500">
                                플랜 그룹이 생성되지 않았을 수 있습니다
                              </span>
                              {process.env.NODE_ENV === "development" && (
                                <span className="text-xs text-gray-400">
                                  디버그: invitation_id=
                                  {participant.invitation_id}, student_id=
                                  {participant.student_id}, status=
                                  {participant.invitation_status}
                                </span>
                              )}
                              <div className="mt-1 flex gap-2">
                                <button
                                  onClick={() => loadParticipants()}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  새로고침
                                </button>
                                <Link
                                  href={`/admin/camp-templates/${templateId}/participants?studentId=${participant.student_id}`}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                                >
                                  상세 확인
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">
                              참여 대기중
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 일괄 작업 다이얼로그 */}
        <BatchOperationDialog
          open={batchDialogOpen}
          onOpenChange={setBatchDialogOpen}
          operationType={batchOperationType}
          participantCount={selectedParticipantIds.size}
          status={batchStatus}
          onConfirm={handleBatchConfirm}
          isPending={isPending}
        />
      </div>
    </section>
  );
}
