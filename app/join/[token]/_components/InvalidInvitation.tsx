"use client";

import Link from "next/link";
import { AlertTriangle, Clock, XCircle } from "lucide-react";

interface InvalidInvitationProps {
  message?: string;
}

export function InvalidInvitation({ message }: InvalidInvitationProps) {
  const isExpired = message?.includes("만료");
  const isUsed = message?.includes("수락") || message?.includes("사용");

  const Icon = isExpired ? Clock : isUsed ? XCircle : AlertTriangle;
  const title = isExpired
    ? "초대가 만료되었습니다"
    : isUsed
      ? "이미 처리된 초대입니다"
      : "유효하지 않은 초대";

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Icon className="h-8 w-8 text-amber-600" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
        <p className="text-sm text-zinc-500">
          {message || "초대 링크가 유효하지 않습니다. 관리자에게 다시 초대를 요청해주세요."}
        </p>
      </div>

      <Link
        href="/login"
        className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
      >
        로그인 페이지로
      </Link>
    </div>
  );
}
