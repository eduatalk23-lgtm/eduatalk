"use client";

import Link from "next/link";

export function InvalidInvitation() {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <svg
          className="h-8 w-8 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">유효하지 않은 초대</h1>
        <p className="mt-2 text-gray-600">
          초대 링크가 올바르지 않거나 더 이상 유효하지 않습니다
        </p>
      </div>

      <div className="rounded-lg bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          링크가 정확한지 확인해주세요. 문제가 계속되면 관리자에게 새로운 초대를
          요청해주세요.
        </p>
      </div>

      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-xl bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
      >
        로그인 페이지로 이동
      </Link>
    </div>
  );
}
