import Link from "next/link";
import { CampFlowIndicator } from "./CampFlowIndicator";

interface CampParticipationHeaderProps {
  template: {
    name: string;
    program_type?: string;
    description?: string | null;
  };
  invitation: {
    id: string;
    status: string;
    isDraft: boolean;
    hasPlans: boolean;
    planGroupStatus: string | null;
  };
  showBackButton?: boolean;
}

export function CampParticipationHeader({
  template,
  invitation,
  showBackButton = true,
}: CampParticipationHeaderProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header with back button */}
      {showBackButton && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Link
            href="/camp"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            캠프 목록으로
          </Link>
        </div>
      )}

      {/* Title and description */}
      <div>
        <p className="text-sm font-medium text-gray-700">캠프 프로그램</p>
        <h1 className="text-3xl font-semibold text-gray-900">
          {template.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {template.program_type && (
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
              {template.program_type}
            </span>
          )}
        </div>
        {template.description && (
          <p className="mt-2 text-sm text-gray-700">{template.description}</p>
        )}
      </div>

      {/* Flow indicator */}
      <CampFlowIndicator
        currentStep={
          invitation.status === "pending" && invitation.isDraft
            ? "participation"
            : invitation.status === "accepted" && !invitation.hasPlans
            ? "review"
            : invitation.hasPlans && invitation.planGroupStatus !== "active"
            ? "planning"
            : "activation"
        }
        invitation={invitation}
      />
    </div>
  );
}

