"use client";

import Link from "next/link";

type ExpiredInvitationProps = {
  status: string;
  isExpired: boolean;
};

export function ExpiredInvitation({ status, isExpired }: ExpiredInvitationProps) {
  const getMessage = () => {
    if (status === "accepted") {
      return {
        title: "이미 수락된 초대",
        description: "이 초대는 이미 수락되었습니다.",
        icon: (
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
        bgColor: "bg-green-100",
      };
    }
    if (status === "cancelled") {
      return {
        title: "취소된 초대",
        description: "이 초대는 관리자에 의해 취소되었습니다.",
        icon: (
          <svg
            className="h-8 w-8 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        ),
        bgColor: "bg-gray-100",
      };
    }
    // expired
    return {
      title: "만료된 초대",
      description: "이 초대의 유효 기간이 만료되었습니다.",
      icon: (
        <svg
          className="h-8 w-8 text-amber-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      bgColor: "bg-amber-100",
    };
  };

  const { title, description, icon, bgColor } = getMessage();

  return (
    <div className="space-y-6 text-center">
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${bgColor}`}
      >
        {icon}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-gray-600">{description}</p>
      </div>

      <p className="text-sm text-gray-500">
        관리자에게 새로운 초대를 요청해주세요
      </p>

      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-xl bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
      >
        로그인 페이지로 이동
      </Link>
    </div>
  );
}
