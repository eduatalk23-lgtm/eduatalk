"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CampInvitationActions } from "./CampInvitationActions";
import { CampActionDialogs } from "./CampActionDialogs";
import { getCampStatusFromInvitation } from "@/lib/camp/campStatus";

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
      camp_location?: string | null;
      camp_start_date?: string | null;
      camp_end_date?: string | null;
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
    // detailLink가 유효한 경우에만 네비게이션
    if (detailLink) {
      router.push(detailLink);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="block cursor-pointer rounded-lg border border-gray-200 bg-white p-6 shadow-[var(--elevation-1)] transition-base hover:border-indigo-300 hover:shadow-[var(--elevation-4)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2">
            {invitation.template?.program_type && (
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800">
                {invitation.template.program_type}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {invitation.template?.name || "캠프 프로그램"}
          </h3>
          {invitation.template?.description && (
            <p className="text-sm text-gray-500">
              {invitation.template.description}
            </p>
          )}
          {/* 캠프 장소 */}
          {invitation.template?.camp_location && (
            <p className="text-sm text-gray-500">
              장소: {invitation.template.camp_location}
            </p>
          )}
          {/* 캠프 기간 */}
          {invitation.template?.camp_start_date && invitation.template?.camp_end_date && (
            <p className="text-sm text-gray-500">
              기간: {new Date(invitation.template.camp_start_date).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })} ~ {new Date(invitation.template.camp_end_date).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
          {/* 플랜 상태 표시 */}
          <div className="flex flex-col gap-3">
            {(() => {
              // 통합 상태 정보 가져오기
              const statusInfo = getCampStatusFromInvitation({
                status: invitation.status as "pending" | "accepted" | "declined",
                planGroupStatus: invitation.planGroupStatus as "draft" | "saved" | "active" | "paused" | "completed" | "cancelled" | null,
                hasPlans: invitation.hasPlans,
                isDraft: invitation.isDraft,
                id: invitation.id,
                planGroupId: invitation.planGroupId,
              });

              // 진행 단계 표시를 위한 상태 확인
              const isStep1Active = statusInfo.status === "PENDING_FORM";
              const isStep2Active = statusInfo.status === "WAITING_REVIEW";
              const isStep3Active = statusInfo.status === "IN_PROGRESS" || statusInfo.status === "READY_TO_START";

              return (
                <>
                  {/* 상태 뱃지 및 설명 */}
                  <div className="flex flex-wrap items-center gap-2">
                    {statusInfo.label && (
                      <span className={statusInfo.badgeClassName}>
                        {statusInfo.label}
                      </span>
                    )}
                    {statusInfo.linkHref && statusInfo.linkLabel && (
                      <Link
                        href={statusInfo.linkHref}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {statusInfo.linkLabel}
                      </Link>
                    )}
                    {statusInfo.description && (
                      <span className="text-xs text-gray-500">
                        {statusInfo.description}
                      </span>
                    )}
                    {/* 기간 표시 (periodStart, periodEnd가 있는 경우) */}
                    {invitation.periodStart && invitation.periodEnd && (
                      <span className="text-xs text-gray-500">
                        {new Date(invitation.periodStart).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ~ {new Date(invitation.periodEnd).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                      </span>
                    )}
                  </div>

                  {/* 진행 단계 표시 */}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={isStep1Active ? "font-medium text-gray-700" : ""}>
                      ① 참여 정보 제출
                    </span>
                    <span>→</span>
                    <span className={isStep2Active ? "font-medium text-gray-700" : ""}>
                      ② 플랜 생성
                    </span>
                    <span>→</span>
                    <span className={isStep3Active ? "font-medium text-indigo-600" : ""}>
                      ③ 학습 시작
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
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
          <CampActionDialogs
            invitationId={invitation.id}
            invitationStatus={invitation.status}
            planGroupStatus={invitation.planGroupStatus}
            hasPlans={invitation.hasPlans}
            templateName={invitation.template?.name}
          />
        </div>
      </div>
    </div>
  );
}


