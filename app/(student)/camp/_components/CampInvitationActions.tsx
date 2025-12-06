"use client";

import Link from "next/link";

type CampInvitationActionsProps = {
  invitation: {
    id: string;
    status: string;
    isDraft: boolean;
    planGroupId: string | null;
    planGroupStatus: string | null;
    hasPlans: boolean;
  };
};

export function CampInvitationActions({
  invitation,
}: CampInvitationActionsProps) {
  return (
    <div
      className="ml-4 flex flex-col items-end gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 초대 상태가 pending인 경우 */}
      {invitation.status === "pending" && !invitation.isDraft && (
        <Link
          href={`/camp/${invitation.id}`}
          className="inline-flex items-center justify-center rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-yellow-700 shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          참여하기
        </Link>
      )}
      {invitation.status === "pending" && invitation.isDraft && (
        <Link
          href={`/camp/${invitation.id}`}
          className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          이어서 작성
        </Link>
      )}

      {/* 초대 상태가 accepted이고 플랜이 생성된 경우 */}
      {invitation.status === "accepted" &&
        invitation.planGroupId &&
        invitation.hasPlans && (
          <>
            {invitation.planGroupStatus === "active" ? (
              <Link
                href="/camp/today"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 shadow-sm"
                onClick={(e) => e.stopPropagation()}
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
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                학습 시작하기
              </Link>
            ) : invitation.planGroupStatus === "paused" ? (
              <>
                <Link
                  href="/camp/today"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 shadow-sm"
                  onClick={(e) => e.stopPropagation()}
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
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  학습 재개하기
                </Link>
                <Link
                  href={`/plan/group/${invitation.planGroupId}?camp=true`}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  플랜 보기
                </Link>
              </>
            ) : (
              <Link
                href={`/plan/group/${invitation.planGroupId}?camp=true`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                onClick={(e) => e.stopPropagation()}
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
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                플랜 보기
              </Link>
            )}
          </>
        )}

      {/* 초대 상태가 accepted이지만 플랜이 아직 없는 경우 */}
      {invitation.status === "accepted" &&
        (!invitation.planGroupId || !invitation.hasPlans) && (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
            참여 완료
          </span>
        )}
    </div>
  );
}





