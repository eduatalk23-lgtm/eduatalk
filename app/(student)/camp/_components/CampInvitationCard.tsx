"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CampInvitationActions } from "./CampInvitationActions";

type CampInvitationCardProps = {
  invitation: {
    id: string;
    status: string;
    isDraft: boolean;
    planGroupId: string | null;
    planGroupStatus: string | null;
    hasPlans: boolean;
    periodStart: string | null;
    periodEnd: string | null;
    template?: {
      name?: string;
      program_type?: string;
      description?: string;
    } | null;
  };
  detailLink: string;
};

export function CampInvitationCard({
  invitation,
  detailLink,
}: CampInvitationCardProps) {
  const router = useRouter();

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 버튼이나 링크를 클릭한 경우는 네비게이션하지 않음
    const target = e.target as HTMLElement;
    if (
      target.closest("a") ||
      target.closest("button") ||
      target.tagName === "A" ||
      target.tagName === "BUTTON"
    ) {
      return;
    }
    router.push(detailLink);
  };

  return (
    <div
      onClick={handleCardClick}
      className="block cursor-pointer rounded-lg border border-gray-200 bg-white p-6 transition hover:border-indigo-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {invitation.template?.name || "캠프 프로그램"}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {invitation.template?.program_type}
          </p>
          {invitation.template?.description && (
            <p className="mt-2 text-sm text-gray-500">
              {invitation.template.description}
            </p>
          )}
          {/* 플랜 상태 표시 */}
          <div className="mt-4 flex flex-col gap-3">
            {invitation.planGroupId ? (
              <>
                {/* 상태 뱃지 및 설명 */}
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const status = invitation.planGroupStatus;

                    // 초대 상태가 pending이고 플랜 그룹이 draft인 경우
                    if (invitation.status === "pending" && status === "draft") {
                      return (
                        <>
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">
                            작성 중
                          </span>
                          <Link
                            href={`/camp/${invitation.id}`}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            이어서 작성하기 →
                          </Link>
                        </>
                      );
                    }

                    // 플랜이 생성되지 않은 경우
                    if (!invitation.hasPlans) {
                      if (status === "draft" || status === "saved") {
                        return (
                          <>
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                              관리자 검토 중
                            </span>
                            <span className="text-xs text-gray-500">
                              플랜 생성 대기 중
                            </span>
                          </>
                        );
                      }
                    }

                    // 플랜이 생성된 경우 상태별 표시
                    if (invitation.hasPlans) {
                      if (status === "active") {
                        return (
                          <>
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                              학습 시작 가능
                            </span>
                            {invitation.periodStart && invitation.periodEnd && (
                              <span className="text-xs text-gray-500">
                                {new Date(invitation.periodStart).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ~ {new Date(invitation.periodEnd).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                              </span>
                            )}
                          </>
                        );
                      } else if (status === "paused") {
                        return (
                          <>
                            <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800">
                              일시정지됨
                            </span>
                            {invitation.periodStart && invitation.periodEnd && (
                              <span className="text-xs text-gray-500">
                                {new Date(invitation.periodStart).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ~ {new Date(invitation.periodEnd).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                              </span>
                            )}
                          </>
                        );
                      } else if (status === "completed") {
                        return (
                          <>
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800">
                              완료됨
                            </span>
                            {invitation.periodStart && invitation.periodEnd && (
                              <span className="text-xs text-gray-500">
                                {new Date(invitation.periodStart).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ~ {new Date(invitation.periodEnd).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                              </span>
                            )}
                          </>
                        );
                      } else if (status === "saved" || status === "draft") {
                        return (
                          <>
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                              플랜 생성 완료
                            </span>
                            <span className="text-xs text-gray-500">
                              활성화 대기 중
                            </span>
                          </>
                        );
                      }
                    }

                    return null;
                  })()}
                </div>

                {/* 진행 단계 표시 */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={invitation.status === "pending" && invitation.isDraft ? "font-medium text-gray-700" : ""}>
                    ① 참여 정보 제출
                  </span>
                  <span>→</span>
                  <span className={invitation.status === "accepted" && !invitation.hasPlans ? "font-medium text-gray-700" : ""}>
                    ② 플랜 생성
                  </span>
                  <span>→</span>
                  <span className={invitation.hasPlans && invitation.planGroupStatus === "active" ? "font-medium text-indigo-600" : ""}>
                    ③ 학습 시작
                  </span>
                </div>
              </>
            ) : invitation.status === "pending" ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">① 참여 정보 제출</span>
                <span>→</span>
                <span>② 플랜 생성</span>
                <span>→</span>
                <span>③ 학습 시작</span>
              </div>
            ) : null}
          </div>
        </div>
        <CampInvitationActions
          invitation={{
            id: invitation.id,
            status: invitation.status,
            isDraft: invitation.isDraft,
            planGroupId: invitation.planGroupId,
            planGroupStatus: invitation.planGroupStatus,
            hasPlans: invitation.hasPlans,
          }}
        />
      </div>
    </div>
  );
}


