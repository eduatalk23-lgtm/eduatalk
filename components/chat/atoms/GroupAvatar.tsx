"use client";

/**
 * GroupAvatar - 카카오톡 스타일 그룹 채팅 아바타
 *
 * 개별 원형 아바타를 겹침(overlap) 형태로 배치합니다.
 * - 1명: 단일 원형
 * - 2명: 2개 원형 겹침 (좌상단 + 우하단)
 * - 3명: 3개 원형 겹침 (상단 중앙 + 좌하단 + 우하단)
 * - 4명+: 4개 원형 2x2 겹침 배치
 */

import { memo } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import type { ChatMemberPreview } from "@/lib/domains/chat/types";
import { Users } from "lucide-react";

interface GroupAvatarProps {
  members: ChatMemberPreview[];
  /** 전체 컨테이너 크기 (px) */
  size?: number;
  className?: string;
}

/** 이름에서 이니셜 추출 */
function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0);
}

/** 이름 기반 배경색 */
function getBgColor(name: string): string {
  const colors = [
    "bg-indigo-400",
    "bg-blue-400",
    "bg-emerald-400",
    "bg-amber-400",
    "bg-rose-400",
    "bg-violet-400",
    "bg-cyan-400",
    "bg-pink-400",
    "bg-teal-400",
    "bg-orange-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/** Supabase 이미지 최적화 가능 여부 */
const optimizableHostname = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
})();

function isOptimizable(url: string): boolean {
  if (url.startsWith("/")) return true;
  if (!optimizableHostname) return false;
  try {
    return new URL(url).hostname === optimizableHostname;
  } catch {
    return false;
  }
}

/** 개별 원형 아바타 */
function MiniAvatar({
  member,
  diameter,
  style,
  className,
}: {
  member: ChatMemberPreview;
  diameter: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const src = member.profileImageUrl;

  return (
    <div
      className={cn(
        "absolute rounded-full overflow-hidden",
        "border-2 border-bg-primary dark:border-bg-primary",
        className
      )}
      style={{
        width: diameter,
        height: diameter,
        ...style,
      }}
    >
      {src ? (
        isOptimizable(src) ? (
          <Image
            src={src}
            alt={member.name}
            width={diameter}
            height={diameter}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={member.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        )
      ) : (
        <div
          className={cn(
            "w-full h-full flex items-center justify-center text-white font-medium",
            getBgColor(member.name)
          )}
          style={{ fontSize: diameter * 0.4 }}
        >
          {getInitial(member.name)}
        </div>
      )}
    </div>
  );
}

/**
 * 멤버 수에 따른 각 아바타의 위치/크기 계산
 * 카카오톡 패턴: 개별 원형 아바타를 겹쳐서 배치
 */
function getPositions(
  count: number,
  containerSize: number
): Array<{ top: number; left: number; diameter: number }> {
  if (count === 1) {
    return [{ top: 0, left: 0, diameter: containerSize }];
  }

  // 개별 아바타 크기: 컨테이너의 ~65%
  const d = Math.round(containerSize * 0.65);
  const offset = containerSize - d; // 겹침을 위한 오프셋

  if (count === 2) {
    // 좌상단 + 우하단
    return [
      { top: 0, left: 0, diameter: d },
      { top: offset, left: offset, diameter: d },
    ];
  }

  if (count === 3) {
    // 상단 중앙 + 좌하단 + 우하단
    const smallD = Math.round(containerSize * 0.58);
    const bottomY = containerSize - smallD;
    return [
      { top: 0, left: (containerSize - smallD) / 2, diameter: smallD },
      { top: bottomY, left: 0, diameter: smallD },
      { top: bottomY, left: containerSize - smallD, diameter: smallD },
    ];
  }

  // 4명+: 2x2 배치
  const quadD = Math.round(containerSize * 0.58);
  const quadOffset = containerSize - quadD;
  return [
    { top: 0, left: 0, diameter: quadD },
    { top: 0, left: quadOffset, diameter: quadD },
    { top: quadOffset, left: 0, diameter: quadD },
    { top: quadOffset, left: quadOffset, diameter: quadD },
  ];
}

function GroupAvatarComponent({
  members,
  size = 44,
  className,
}: GroupAvatarProps) {
  // 멤버가 없으면 기본 아이콘
  if (members.length === 0) {
    return (
      <div
        className={cn(
          "rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0",
          className
        )}
        style={{ width: size, height: size }}
      >
        <Users
          className="text-text-secondary"
          style={{ width: size * 0.45, height: size * 0.45 }}
        />
      </div>
    );
  }

  const display = members.slice(0, 4);
  const positions = getPositions(display.length, size);

  return (
    <div
      className={cn("relative flex-shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`그룹 멤버: ${display.map((m) => m.name).join(", ")}`}
    >
      {display.map((member, i) => (
        <MiniAvatar
          key={i}
          member={member}
          diameter={positions[i].diameter}
          style={{
            top: positions[i].top,
            left: positions[i].left,
          }}
        />
      ))}
    </div>
  );
}

export const GroupAvatar = memo(GroupAvatarComponent);
