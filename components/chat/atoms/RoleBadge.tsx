/**
 * RoleBadge — 채팅 역할(관리자/상담사/학생/학부모) 배지
 *
 * 사용 사이트: ProfileCardPopup, MemberList. 색상 팔레트는 4개 역할 식별용으로
 * 시맨틱 토큰화하기 어려운 영역(긍정/부정/경고 등 의미와 무관). 디자이너 합의
 * 전까지는 lint 정책(no-restricted-syntax) 예외로 본 컴포넌트 1곳에만 격리.
 */

import { memo } from "react";
import { cn } from "@/lib/cn";

export type RoleBadgeKind = "admin" | "consultant" | "student" | "parent";

interface RoleBadgeProps {
  /** 역할 키 — admin 사용자가 consultant 인 경우 호출 측에서 분기 후 전달 */
  role: RoleBadgeKind;
  /** 라벨 커스텀 (기본값: 역할별 한글 라벨) */
  label?: string;
  className?: string;
}

const ROLE_LABEL: Record<RoleBadgeKind, string> = {
  admin: "관리자",
  consultant: "상담사",
  student: "학생",
  parent: "학부모",
};

/* eslint-disable no-restricted-syntax -- 역할 식별 컬러 팔레트는 시맨틱 외 영역, 본 컴포넌트 1곳에만 격리 */
const ROLE_CLASS: Record<RoleBadgeKind, string> = {
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  consultant:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  student:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  parent: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};
/* eslint-enable no-restricted-syntax */

function RoleBadgeComponent({ role, label, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium",
        ROLE_CLASS[role],
        className,
      )}
    >
      {label ?? ROLE_LABEL[role]}
    </span>
  );
}

export const RoleBadge = memo(RoleBadgeComponent);
