"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CampCard } from "../../plan/_shared/PlanCard";
import { StepProgress } from "../../plan/_shared/ProgressIndicator";
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

  // Determine badges and status
  const badges = [];
  let customStatus: string | undefined;

  if (invitation.status === "pending" && invitation.isDraft) {
    badges.push({ label: "작성 중", variant: "warning" as const });
  } else if (invitation.status === "accepted") {
    if (!invitation.hasPlans) {
      badges.push({ label: "관리자 검토 중", variant: "info" as const });
    } else if (invitation.planGroupStatus === "active") {
      badges.push({ label: "학습 시작 가능", variant: "success" as const });
      customStatus = "active";
    } else if (invitation.planGroupStatus === "paused") {
      badges.push({ label: "일시정지됨", variant: "warning" as const });
      customStatus = "paused";
    } else if (invitation.planGroupStatus === "completed") {
      badges.push({ label: "완료됨", variant: "default" as const });
      customStatus = "completed";
    } else if (invitation.planGroupStatus === "saved" || invitation.planGroupStatus === "draft") {
      badges.push({ label: "플랜 생성 완료", variant: "info" as const });
    }
  }

  // Prepare metadata
  const metadata = [];
  if (invitation.periodStart && invitation.periodEnd && invitation.hasPlans) {
    metadata.push({
      label: "학습 기간",
      value: `${new Date(invitation.periodStart).toLocaleDateString("ko-KR", { 
        month: "long", day: "numeric" 
      })} ~ ${new Date(invitation.periodEnd).toLocaleDateString("ko-KR", { 
        month: "long", day: "numeric" 
      })}`
    });
  }

  // Prepare step progress
  const steps = [
    {
      label: "① 참여 정보 제출",
      isActive: invitation.status === "pending" && invitation.isDraft,
      isCompleted: invitation.status === "accepted"
    },
    {
      label: "② 플랜 생성",
      isActive: invitation.status === "accepted" && !invitation.hasPlans,
      isCompleted: invitation.hasPlans
    },
    {
      label: "③ 학습 시작",
      isActive: invitation.hasPlans && invitation.planGroupStatus === "active",
      isCompleted: false
    },
  ];

  return (
    <CampCard
      title={invitation.template?.name || "캠프 프로그램"}
      subtitle={invitation.template?.program_type}
      description={invitation.template?.description}
      badges={badges}
      status={customStatus}
      metadata={metadata}
      onClick={handleCardClick}
      actions={
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
      }
    >
      {/* Step progress */}
      {invitation.planGroupId && (
        <StepProgress steps={steps} />
      )}
      
      {/* Continue button for draft */}
      {invitation.status === "pending" && invitation.isDraft && invitation.planGroupId && (
        <Link
          href={`/camp/${invitation.id}`}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          onClick={(e) => e.stopPropagation()}
        >
          이어서 작성하기 →
        </Link>
      )}
    </CampCard>
  );
}

