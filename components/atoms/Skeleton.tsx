"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";

export type SkeletonProps = {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
};

function SkeletonComponent({
  className,
  variant = "rectangular",
  width,
  height,
}: SkeletonProps) {
  // 동적 width/height는 인라인 스타일이 필요 (Tailwind arbitrary values는 빌드 시점에 생성되어야 함)
  const dynamicStyle: React.CSSProperties = {};
  if (width !== undefined) {
    dynamicStyle.width = typeof width === "number" ? `${width}px` : width;
  }
  if (height !== undefined) {
    dynamicStyle.height = typeof height === "number" ? `${height}px` : height;
  }

  return (
    <div
      className={cn(
        "animate-pulse bg-[rgb(var(--color-secondary-200))]",
        variant === "text" && "rounded",
        variant === "circular" && "rounded-full",
        variant === "rectangular" && "rounded-lg",
        className
      )}
      style={Object.keys(dynamicStyle).length > 0 ? dynamicStyle : undefined}
    />
  );
}

export const Skeleton = memo(SkeletonComponent);
export default Skeleton;

